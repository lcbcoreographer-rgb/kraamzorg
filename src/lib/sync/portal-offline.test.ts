// Antes de importar db.ts: o IndexedDB falso do invariante 4.
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { USUARIOS } from "@/lib/dados/demonstracao/fixtures";
import { criarRepositoriosDemonstracao } from "@/lib/dados/demonstracao";
import {
  obterLojaEquipe,
  reiniciarLojaEquipe,
} from "@/lib/dados/demonstracao/equipe";
import { reiniciarLoja } from "@/lib/dados/demonstracao/loja";
import type { PortalRepositorio } from "@/lib/dados/repositorios";
import { criarBancoOffline, type BancoOffline } from "./db";
import { processarFila, salvarCampo, type EnviarLote } from "./motor";
import { processarLote } from "./protocolo";
import { RepositorioSincronizacaoComposto } from "./repositorio-composto";
import { RepositorioSincronizacaoMemoria } from "./repositorio-memoria";
import { RepositorioSincronizacaoVisita } from "./repositorio-visita";

/**
 * Invariante 4 para o portal da enfermeira (P38): chegada e saída feitas
 * sem sinal ficam no aparelho e sobem inteiras, na ordem e uma só vez,
 * quando a conexão volta. O "servidor" aqui é o mesmo `processarLote` de
 * POST /api/sync, com o repositório de sincronização real da visita sobre o
 * portal da demonstração (as regras de 0022_agenda_portal.sql).
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

let contador = 0;
let db: BancoOffline;
let portal: PortalRepositorio;
let usuarioId: string;

function servidor(): EnviarLote {
  const repo = new RepositorioSincronizacaoComposto(
    new RepositorioSincronizacaoVisita(portal),
    ["visita"],
    new RepositorioSincronizacaoMemoria(),
  );
  return (itens) => processarLote({ itens }, repo);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T15:00:00Z"));
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLoja();
  reiniciarLojaEquipe();
  const u = USUARIOS.find((x) => x.papeis.includes("enfermeira"))!;
  usuarioId = u.id;
  portal = criarRepositoriosDemonstracao({
    usuarioId: u.id,
    papeis: [...u.papeis],
    aal: "aal2",
  }).portal;
  contador += 1;
  db = criarBancoOffline(`teste-portal-${contador}-${Date.now()}`);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
  for (const [chave, valor] of Object.entries(ORIGINAL)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
});

async function primeiraVisita() {
  const hoje = await portal.obterHoje();
  return hoje.visitas[0]!;
}

describe("chegada e saída sem sinal", () => {
  it("as duas ficam no aparelho e sobem juntas, na ordem, sem conflito consigo mesmas", async () => {
    const visita = await primeiraVisita();
    const chegada = "2026-09-29T12:06:00.000Z"; // 09:06 em Brasília
    const saida = "2026-09-29T14:58:00.000Z"; // 11:58

    // sem sinal: nada sobe, mas as duas ficam guardadas
    const c = await salvarCampo(db, {
      usuarioId,
      entidade: "visita",
      entidadeId: visita.visitaId,
      campo: "checkin_em",
      valor: chegada,
      versaoBase: visita.versao,
    });
    const s = await salvarCampo(db, {
      usuarioId,
      entidade: "visita",
      entidadeId: visita.visitaId,
      campo: "checkout_em",
      valor: saida,
      versaoBase: visita.versao,
    });
    expect(c.versaoBase).toBe(visita.versao);
    expect(s.versaoBase).toBe(visita.versao + 1);
    expect(
      (await db.rascunhos.get(`visita:${visita.visitaId}:checkin_em`))?.valor,
    ).toBe(chegada);
    expect(await db.fila.where("estado").equals("rascunho_local").count()).toBe(
      2,
    );

    // a conexão volta
    const resumo = await processarFila(db, servidor(), undefined, {
      ignorarEspera: true,
    });
    expect(resumo).toMatchObject({
      sincronizados: 2,
      conflitos: 0,
      erros: 0,
      pendentesRestantes: 0,
    });

    const depois = await primeiraVisita();
    expect(depois).toMatchObject({
      estado: "ficha_pendente",
      checkinEm: chegada,
      checkoutEm: saida,
    });
    expect(depois.versao).toBe(visita.versao + 2);
  });

  it("reenviar o mesmo lote depois de uma resposta perdida não reaplica nem dá conflito", async () => {
    const visita = await primeiraVisita();
    const chegada = "2026-09-29T12:06:00.000Z";
    const item = await salvarCampo(db, {
      usuarioId,
      entidade: "visita",
      entidadeId: visita.visitaId,
      campo: "checkin_em",
      valor: chegada,
      versaoBase: visita.versao,
    });
    const enviar = servidor();
    const entrada = {
      id: item.id,
      usuarioId,
      entidade: item.entidade,
      entidadeId: item.entidadeId,
      campo: item.campo,
      payload: item.payload,
      versaoBase: item.versaoBase,
      criadoNoClienteEm: item.criadoNoClienteEm,
    };
    const primeira = await enviar([entrada]);
    const segunda = await enviar([entrada]);
    expect(primeira.resultados[0]).toMatchObject({
      status: "processado",
      versaoResultante: visita.versao + 1,
    });
    expect(segunda.resultados[0]).toMatchObject({
      status: "processado",
      versaoResultante: visita.versao + 1,
    });
    expect((await primeiraVisita()).versao).toBe(visita.versao + 1);
  });

  it("se a coordenação mexeu na visita enquanto ela estava sem sinal, o conflito é guardado e a chegada não é sobrescrita", async () => {
    const visita = await primeiraVisita();
    // a coordenação reagenda a visita para outro horário do mesmo dia (versão sobe)
    obterLojaEquipe().visitas.find((v) => v.id === visita.visitaId)!.versao +=
      1;
    await salvarCampo(db, {
      usuarioId,
      entidade: "visita",
      entidadeId: visita.visitaId,
      campo: "checkin_em",
      valor: "2026-09-29T12:06:00.000Z",
      versaoBase: visita.versao,
    });
    const resumo = await processarFila(db, servidor(), undefined, {
      ignorarEspera: true,
    });
    expect(resumo.conflitos).toBe(1);
    expect((await primeiraVisita()).checkinEm).toBeNull();
    const item = (await db.fila.toArray())[0]!;
    expect(item.estado).toBe("conflito");
    expect(item.conflito?.versaoAtual).toBe(visita.versao + 1);
  });

  it("uma recusa do banco (hora de outro dia) vira erro só desse item e a fila segue", async () => {
    const visita = await primeiraVisita();
    await salvarCampo(db, {
      usuarioId,
      entidade: "visita",
      entidadeId: visita.visitaId,
      campo: "checkin_em",
      valor: "2026-09-28T12:06:00.000Z",
      versaoBase: visita.versao,
    });
    const resumo = await processarFila(db, servidor(), undefined, {
      ignorarEspera: true,
    });
    expect(resumo.erros).toBe(1);
    const item = (await db.fila.toArray())[0]!;
    expect(item.estado).toBe("erro");
    expect(item.erroMensagem).toContain("equipe:");
    // a visita continua como estava e o item fica na fila para nova tentativa
    expect((await primeiraVisita()).checkinEm).toBeNull();
    expect(resumo.pendentesRestantes).toBe(1);
  });

  it("outra enfermeira não consegue subir chegada na visita alheia", async () => {
    const dela = obterLojaEquipe().visitas.find(
      (v) =>
        v.profissionalId.endsWith("000000000004") && v.data === "2026-09-29",
    )!;
    await salvarCampo(db, {
      usuarioId,
      entidade: "visita",
      entidadeId: dela.id,
      campo: "checkin_em",
      valor: "2026-09-29T12:06:00.000Z",
      versaoBase: dela.versao,
    });
    // o portal da enfermeira não enxerga a visita da Norte 1: estado nulo => "não encontrada"
    const resumo = await processarFila(db, servidor(), undefined, {
      ignorarEspera: true,
    });
    expect(resumo.erros).toBe(1);
    expect(dela.checkinEm).toBeNull();
  });
});
