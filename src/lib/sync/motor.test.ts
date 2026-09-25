// Precisa vir antes de importar db.ts: fake-indexeddb substitui o global
// `indexedDB` que o Dexie usa (invariante 4, PRD 16.1: "Vitest com
// IndexedDB falso").
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoOffline, type BancoOffline } from "./db";
import {
  calcularEsperaMs,
  processarFila,
  salvarCampo,
  type EnviarLote,
} from "./motor";
import type { ItemSincronizacaoEntrada, RespostaSincronizacao } from "./tipos";

let contador = 0;
function novoBanco(): BancoOffline {
  contador += 1;
  return criarBancoOffline(`teste-motor-${contador}-${Date.now()}`);
}

describe("salvarCampo", () => {
  let db: BancoOffline;

  beforeEach(() => {
    db = novoBanco();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("grava o rascunho e enfileira no mesmo instante, como rascunho_local", async () => {
    const item = await salvarCampo(db, {
      usuarioId: "enfermeira-1",
      entidade: "visita",
      entidadeId: "visita-1",
      campo: "temperatura",
      valor: "36.8",
      versaoBase: 3,
    });

    expect(item.estado).toBe("rascunho_local");

    const naFila = await db.fila.get(item.id);
    expect(naFila).toBeDefined();
    expect(naFila?.payload).toBe("36.8");

    const rascunho = await db.rascunhos.get("visita:visita-1:temperatura");
    expect(rascunho?.valor).toBe("36.8");
    expect(rascunho?.itemFilaId).toBe(item.id);
  });

  it("dois campos diferentes geram dois itens de fila independentes", async () => {
    await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "temperatura",
      valor: "36.8",
    });
    await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "pressao",
      valor: "120x80",
    });

    expect(await db.fila.count()).toBe(2);
    expect(await db.rascunhos.count()).toBe(2);
  });
});

function respostaOk(id: string): RespostaSincronizacao {
  return { resultados: [{ id, status: "processado", versaoResultante: 4 }] };
}

describe("processarFila", () => {
  let db: BancoOffline;

  beforeEach(() => {
    db = novoBanco();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("marca sincronizado quando o servidor confirma", async () => {
    const item = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "temperatura",
      valor: "36.8",
      versaoBase: 3,
    });

    const enviar: EnviarLote = vi.fn(async () => respostaOk(item.id));
    const resumo = await processarFila(db, enviar);

    expect(resumo.sincronizados).toBe(1);
    expect(resumo.pendentesRestantes).toBe(0);
    expect((await db.fila.get(item.id))?.estado).toBe("sincronizado");
  });

  it("marca conflito e preserva o original recebido do servidor", async () => {
    const item = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "temperatura",
      valor: "36.8",
      versaoBase: 3,
    });

    const enviar: EnviarLote = vi.fn(async () => ({
      resultados: [
        {
          id: item.id,
          status: "conflito" as const,
          conflito: {
            original: { temperatura: "37.2" },
            versaoAtual: 4,
            tentativa: "36.8",
          },
        },
      ],
    }));

    const resumo = await processarFila(db, enviar);
    expect(resumo.conflitos).toBe(1);

    const naFila = await db.fila.get(item.id);
    expect(naFila?.estado).toBe("conflito");
    expect(naFila?.conflito?.versaoAtual).toBe(4);
    expect(naFila?.conflito?.original).toEqual({ temperatura: "37.2" });
  });

  it("erro de rede volta o item para a fila com espera crescente, sem perder o item", async () => {
    const item = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "temperatura",
      valor: "36.8",
    });

    const enviar: EnviarLote = vi.fn(async () => {
      throw new Error("sem sinal");
    });

    const agora = Date.now();
    const resumo = await processarFila(db, enviar, agora);
    expect(resumo.erros).toBe(1);
    expect(resumo.pendentesRestantes).toBe(1);

    const naFila = await db.fila.get(item.id);
    expect(naFila?.estado).toBe("erro");
    expect(naFila?.tentativas).toBe(1);
    expect(naFila?.proximoEnvioEm).toBe(agora + calcularEsperaMs(1));

    // Antes da espera passar, uma nova tentativa não reenvia (mesmo item).
    const antesDaEspera = await processarFila(
      db,
      enviar,
      agora + calcularEsperaMs(1) - 1,
    );
    expect(antesDaEspera.pendentesRestantes).toBe(1);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("a espera cresce a cada nova falha (espera crescente)", async () => {
    const item = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "temperatura",
      valor: "36.8",
    });

    const enviar: EnviarLote = vi.fn(async () => {
      throw new Error("sem sinal");
    });

    let agora = Date.now();
    await processarFila(db, enviar, agora);
    const primeiraEspera = (await db.fila.get(item.id))!.proximoEnvioEm - agora;

    agora = (await db.fila.get(item.id))!.proximoEnvioEm;
    await processarFila(db, enviar, agora);
    const segundaEspera = (await db.fila.get(item.id))!.proximoEnvioEm - agora;

    expect(segundaEspera).toBeGreaterThan(primeiraEspera);
  });

  it("id gerado no aparelho garante que reenviar o mesmo item não duplica a fila", async () => {
    const item = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "temperatura",
      valor: "36.8",
    });

    const idsEnviados: string[] = [];
    const enviar: EnviarLote = vi.fn(
      async (itens: ItemSincronizacaoEntrada[]) => {
        idsEnviados.push(...itens.map((i) => i.id));
        return respostaOk(item.id);
      },
    );

    await processarFila(db, enviar);
    expect(await db.fila.count()).toBe(1);
    expect(new Set(idsEnviados).size).toBe(1);
  });

  it("processa vários itens na ordem em que foram criados", async () => {
    const primeiro = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "a",
      valor: 1,
    });
    const segundo = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: "v1",
      campo: "b",
      valor: 2,
    });

    const ordemRecebida: string[] = [];
    const enviar: EnviarLote = vi.fn(
      async (itens: ItemSincronizacaoEntrada[]) => {
        ordemRecebida.push(...itens.map((i) => i.id));
        return {
          resultados: itens.map((i) => ({
            id: i.id,
            status: "processado" as const,
          })),
        };
      },
    );

    await processarFila(db, enviar);
    expect(ordemRecebida).toEqual([primeiro.id, segundo.id]);
  });
});

describe("calcularEsperaMs", () => {
  it("cresce a cada tentativa e não passa do teto", () => {
    const valores = [0, 1, 2, 3, 4, 5, 10, 20].map(calcularEsperaMs);
    for (let i = 1; i < valores.length; i += 1) {
      expect(valores[i]).toBeGreaterThanOrEqual(valores[i - 1]!);
    }
    expect(valores.at(-1)).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});
