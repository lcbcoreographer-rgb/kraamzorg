// Precisa vir antes de importar db.ts (invariante 4, PRD 16.1).
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { respostasVazias } from "@/lib/instrumentos/respostas";
import { criarBancoOffline, type BancoOffline } from "./db";
import type { EnviarLote } from "./motor";
import {
  aguardarFilaVazia,
  criarPersistenciaPrenatal,
  lerRascunhosPrenatal,
  sobreporRascunhos,
} from "./persistencia-prenatal";
import { CAMPO_PROGRESSO } from "./prenatal";
import type { ItemSincronizacaoEntrada } from "./tipos";

/**
 * A entrevista do DOC 1 sobre o motor offline: cada resposta grava no
 * aparelho e entra na fila com a marca de onde a pessoa parou (etapa e
 * campo), para reabrir no mesmo lugar mesmo sem sinal (P35).
 */

const CONSULTA = "22222222-2222-4222-8222-222222222222";
let contador = 0;

function novoBanco(): BancoOffline {
  contador += 1;
  return criarBancoOffline(`teste-prenatal-${contador}-${Date.now()}`);
}

/** Servidor que confirma tudo o que recebe. */
const enviarOk: EnviarLote = vi.fn(
  async (itens: ItemSincronizacaoEntrada[]) => ({
    resultados: itens.map((i) => ({
      id: i.id,
      status: "processado" as const,
      versaoResultante: 2,
    })),
  }),
);

/** Sem sinal: nada sobe. */
const enviarSemSinal: EnviarLote = vi.fn(async () => {
  throw new Error("sem sinal");
});

describe("persistência da entrevista pré-natal", () => {
  let db: BancoOffline;
  beforeEach(() => {
    db = novoBanco();
    vi.clearAllMocks();
  });
  afterEach(async () => {
    await db.delete();
  });

  function criar(enviar: EnviarLote, etapa: () => number) {
    return criarPersistenciaPrenatal({
      db,
      usuarioId: "u1",
      consultaId: CONSULTA,
      versaoInicial: 1,
      enviar,
      etapaAtual: etapa,
    });
  }

  it("cada resposta vai à fila com a marca da etapa e do campo onde a pessoa parou", async () => {
    const p = criar(enviarSemSinal, () => 4);
    await p.salvarCampo(
      { bloco: "D", campo: "intercorrencias_gestacao_atual" },
      "Nenhuma",
    );

    const locais = await lerRascunhosPrenatal(db, CONSULTA);
    expect(locais.respostas).toEqual([
      {
        endereco: { bloco: "D", campo: "intercorrencias_gestacao_atual" },
        valor: "Nenhuma",
      },
    ]);
    expect(locais.progresso).toEqual({
      etapa: 4,
      campo: "D.intercorrencias_gestacao_atual",
    });
    const campos = (await db.fila.toArray()).map((i) => i.campo).sort();
    expect(campos).toEqual([
      "D.intercorrencias_gestacao_atual",
      CAMPO_PROGRESSO,
    ]);
  });

  it("trocar de etapa zera o campo da marca; a etapa nova é a que vale", async () => {
    let etapa = 4;
    const p = criar(enviarSemSinal, () => etapa);
    await p.salvarCampo({ bloco: "D", campo: "filhos_vivos" }, "1");
    etapa = 5;
    p.registrarEtapa(5);
    await vi.waitFor(async () => {
      const { progresso } = await lerRascunhosPrenatal(db, CONSULTA);
      expect(progresso).toEqual({ etapa: 5, campo: null });
    });
  });

  it("o que já subiu não volta como rascunho: vale o que está no servidor", async () => {
    const p = criar(enviarOk, () => 2);
    await p.salvarCampo({ bloco: "C", campo: "nome_da_gestante" }, "Ana Teste");
    expect(await aguardarFilaVazia(db, CONSULTA, enviarOk, 3_000)).toBe(true);
    const locais = await lerRascunhosPrenatal(db, CONSULTA);
    expect(locais.respostas).toEqual([]);
    expect(locais.progresso).toBeNull();
  });

  it("sem sinal, aguardarFilaVazia desiste no tempo máximo e diz que sobrou item", async () => {
    const p = criar(enviarSemSinal, () => 1);
    await p.salvarCampo({ bloco: "C", campo: "nome_da_gestante" }, "Ana Teste");
    expect(await aguardarFilaVazia(db, CONSULTA, enviarSemSinal, 600)).toBe(
      false,
    );
    // o rascunho continua no aparelho
    expect((await lerRascunhosPrenatal(db, CONSULTA)).respostas).toHaveLength(
      1,
    );
  });

  it("rascunho de outra consulta não aparece", async () => {
    const outra = criarPersistenciaPrenatal({
      db,
      usuarioId: "u1",
      consultaId: "33333333-3333-4333-8333-333333333333",
      versaoInicial: 1,
      enviar: enviarSemSinal,
      etapaAtual: () => 1,
    });
    await outra.salvarCampo(
      { bloco: "C", campo: "nome_da_gestante" },
      "Outra Teste",
    );
    const locais = await lerRascunhosPrenatal(db, CONSULTA);
    expect(locais.respostas).toEqual([]);
    expect(locais.progresso).toBeNull();
  });
});

describe("sobreporRascunhos", () => {
  it("o que está no aparelho vale sobre o servidor, e null apaga a resposta", () => {
    const servidor = {
      blocos: { C: { nome_da_gestante: "Ana", idade_da_gestante: 30 } },
      por_bebe: {},
    };
    const final = sobreporRascunhos(servidor, [
      {
        endereco: { bloco: "C", campo: "nome_da_gestante" },
        valor: "Ana Maria",
      },
      { endereco: { bloco: "C", campo: "idade_da_gestante" }, valor: null },
      { endereco: { bloco: "D", campo: "filhos_vivos" }, valor: "1" },
    ]);
    expect(final.blocos).toEqual({
      C: { nome_da_gestante: "Ana Maria" },
      D: { filhos_vivos: "1" },
    });
    expect(servidor.blocos.C.nome_da_gestante).toBe("Ana");
  });

  it("aceita servidor vazio", () => {
    expect(sobreporRascunhos(respostasVazias(), []).blocos).toEqual({});
  });
});
