// Precisa vir antes de importar db.ts: fake-indexeddb substitui o global
// `indexedDB` que o Dexie usa (invariante 4, PRD 16.1: "Vitest com
// IndexedDB falso").
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoOffline, type BancoOffline } from "./db";
import {
  calcularEsperaMs,
  enfileirarRegistroAssistencial,
  processarFila,
  salvarCampo,
  type EnviarLote,
} from "./motor";
import { processarLote } from "./protocolo";
import { RepositorioSincronizacaoMemoria } from "./repositorio-memoria";
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

/** Envia direto ao protocolo do servidor, com o repositório em memória. */
function servidorEmMemoria(repo: RepositorioSincronizacaoMemoria): EnviarLote {
  return (itens) => processarLote({ itens }, repo);
}

/** Cria uma visita no "servidor" (versão 1) e devolve o id gerado. */
async function criarVisitaNoServidor(
  repo: RepositorioSincronizacaoMemoria,
): Promise<string> {
  const resposta = await processarLote(
    {
      itens: [
        {
          id: "criacao-servidor",
          usuarioId: "outro-aparelho",
          entidade: "visita",
          entidadeId: null,
          campo: null,
          payload: {},
          versaoBase: null,
          criadoNoClienteEm: "2026-09-24T08:00:00.000Z",
        },
      ],
    },
    repo,
  );
  return resposta.resultados[0]!.entidadeIdCriado!;
}

describe("invariante 4: ordem de criação no aparelho", () => {
  let db: BancoOffline;

  beforeEach(() => {
    db = novoBanco();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.delete();
  });

  it("dois campos salvos no mesmo milissegundo ganham instantes crescentes e sobem nessa ordem", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T10:00:00.000Z"));

    const ids: string[] = [];
    for (const campo of ["c", "a", "b", "d"]) {
      const item = await salvarCampo(db, {
        usuarioId: "u1",
        entidade: "visita",
        entidadeId: null,
        campo,
        valor: campo,
      });
      ids.push(item.id);
    }

    const instantes = (await db.fila.bulkGet(ids)).map(
      (item) => item!.criadoNoClienteEm,
    );
    expect(new Set(instantes).size).toBe(4);
    expect([...instantes].sort()).toEqual(instantes);

    const recebidos: string[] = [];
    await processarFila(db, async (itens) => {
      recebidos.push(...itens.map((i) => i.id));
      return {
        resultados: itens.map((i) => ({
          id: i.id,
          status: "processado" as const,
        })),
      };
    });
    expect(recebidos).toEqual(ids);
  });

  it("um item novo não passa na frente de um mais antigo que está na espera crescente", async () => {
    const antigo = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: null,
      campo: "a",
      valor: 1,
    });

    const agora = Date.now();
    await processarFila(
      db,
      async () => {
        throw new Error("sem sinal");
      },
      agora,
    );
    expect((await db.fila.get(antigo.id))?.proximoEnvioEm).toBeGreaterThan(
      agora,
    );

    const novo = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: null,
      campo: "b",
      valor: 2,
    });

    // O novo já está pronto; o antigo ainda está na espera crescente.
    const depois = Date.now();
    expect(depois).toBeLessThan((await db.fila.get(antigo.id))!.proximoEnvioEm);

    const lotes: string[][] = [];
    await processarFila(
      db,
      async (itens) => {
        lotes.push(itens.map((i) => i.id));
        return {
          resultados: itens.map((i) => ({
            id: i.id,
            status: "processado" as const,
          })),
        };
      },
      depois,
    );

    // Um lote só, com o antigo na frente: nunca o novo sozinho.
    expect(lotes).toEqual([[antigo.id, novo.id]]);
  });

  it("conexão de volta sobe na hora, sem esperar a espera crescente", async () => {
    const item = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: null,
      campo: "a",
      valor: 1,
    });
    const agora = Date.now();
    await processarFila(
      db,
      async () => {
        throw new Error("sem sinal");
      },
      agora,
    );

    const enviar: EnviarLote = vi.fn(
      async (itens: ItemSincronizacaoEntrada[]) => ({
        resultados: itens.map((i) => ({
          id: i.id,
          status: "processado" as const,
        })),
      }),
    );

    await processarFila(db, enviar, agora + 1);
    expect(enviar).not.toHaveBeenCalled();

    await processarFila(db, enviar, agora + 1, { ignorarEspera: true });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect((await db.fila.get(item.id))?.estado).toBe("sincronizado");
  });

  it("item que ficou enviando (aba fechada no meio do envio) sobe de novo", async () => {
    const item = await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: null,
      campo: "a",
      valor: 1,
    });
    await db.fila.update(item.id, { estado: "enviando" });

    const enviar: EnviarLote = vi.fn(
      async (itens: ItemSincronizacaoEntrada[]) => ({
        resultados: itens.map((i) => ({
          id: i.id,
          status: "processado" as const,
        })),
      }),
    );
    const resumo = await processarFila(db, enviar);

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(resumo.sincronizados).toBe(1);
    expect((await db.fila.get(item.id))?.estado).toBe("sincronizado");
  });

  it("gatilhos simultâneos não enviam o mesmo item duas vezes", async () => {
    await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: null,
      campo: "a",
      valor: 1,
    });

    const enviar: EnviarLote = vi.fn(
      async (itens: ItemSincronizacaoEntrada[]) => ({
        resultados: itens.map((i) => ({
          id: i.id,
          status: "processado" as const,
        })),
      }),
    );

    await Promise.all([
      processarFila(db, enviar),
      processarFila(db, enviar),
      processarFila(db, enviar),
    ]);

    expect(enviar).toHaveBeenCalledTimes(1);
  });
});

describe("invariante 4: aparelho e servidor juntos (conflito por versão)", () => {
  let db: BancoOffline;

  beforeEach(() => {
    db = novoBanco();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("vários campos da mesma visita salvos sem sinal chegam todos, sem conflito com o próprio aparelho", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const visitaId = await criarVisitaNoServidor(repo);

    // A tela leu a visita na versão 1 e passa essa versão em todo campo.
    for (const [campo, valor] of [
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
    ] as const) {
      await salvarCampo(db, {
        usuarioId: "u1",
        entidade: "visita",
        entidadeId: visitaId,
        campo,
        valor,
        versaoBase: 1,
      });
    }

    const bases = (await db.fila.orderBy("criadoNoClienteEm").toArray()).map(
      (item) => item.versaoBase,
    );
    expect(bases).toEqual([1, 2, 3]);

    const resumo = await processarFila(db, servidorEmMemoria(repo));
    expect(resumo).toMatchObject({ sincronizados: 3, conflitos: 0, erros: 0 });

    const estado = await repo.buscarEstado("visita", visitaId);
    expect(estado?.versao).toBe(4);
    expect(estado?.dados).toEqual({ a: "1", b: "2", c: "3" });

    // Depois de sincronizar, a tela ainda com a versão 1 salva mais um
    // campo: o motor parte da versão que o servidor devolveu (4).
    await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: visitaId,
      campo: "d",
      valor: "4",
      versaoBase: 1,
    });
    const segundo = await processarFila(db, servidorEmMemoria(repo));
    expect(segundo.sincronizados).toBe(1);
    expect((await repo.buscarEstado("visita", visitaId))?.versao).toBe(5);
  });

  it("mudança de outro aparelho no meio vira conflito, com o original preservado, e o campo seguinte também para", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const visitaId = await criarVisitaNoServidor(repo);

    await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: visitaId,
      campo: "a",
      valor: "deste aparelho",
      versaoBase: 1,
    });

    // Outro aparelho grava antes deste subir.
    await processarLote(
      {
        itens: [
          {
            id: "outro-aparelho-1",
            usuarioId: "u2",
            entidade: "visita",
            entidadeId: visitaId,
            campo: "a",
            payload: "do outro aparelho",
            versaoBase: 1,
            criadoNoClienteEm: "2026-09-24T09:00:00.000Z",
          },
        ],
      },
      repo,
    );

    const primeiro = await processarFila(db, servidorEmMemoria(repo));
    expect(primeiro.conflitos).toBe(1);

    // Campo novo na mesma visita, depois do conflito: continua em conflito
    // em vez de gravar por cima do que o outro aparelho fez.
    await salvarCampo(db, {
      usuarioId: "u1",
      entidade: "visita",
      entidadeId: visitaId,
      campo: "b",
      valor: "outro campo",
      versaoBase: 1,
    });
    const segundo = await processarFila(db, servidorEmMemoria(repo));
    expect(segundo.conflitos).toBe(1);

    const estado = await repo.buscarEstado("visita", visitaId);
    expect(estado?.versao).toBe(2);
    expect(estado?.dados).toEqual({ a: "do outro aparelho" });

    const emConflito = await db.fila
      .where("estado")
      .equals("conflito")
      .toArray();
    expect(emConflito).toHaveLength(2);
    expect(emConflito[0]?.conflito?.original).toEqual({
      a: "do outro aparelho",
    });
  });
});

describe("registro assistencial no aparelho", () => {
  let db: BancoOffline;

  beforeEach(() => {
    db = novoBanco();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("salvarCampo recusa registro_atendimento (sobe inteiro, nunca por campo)", async () => {
    await expect(
      salvarCampo(db, {
        usuarioId: "u1",
        entidade: "registro_atendimento",
        entidadeId: "visita-1",
        campo: "qualquer",
        valor: "x",
      }),
    ).rejects.toThrow();
    expect(await db.fila.count()).toBe(0);
  });

  it("registro inteiro sobe; um segundo divergente vira adendo e o original não muda", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const original = { dados: { item: "a" }, resumo: "primeiro" };
    const divergente = { dados: { item: "b" }, resumo: "corrigido" };

    await enfileirarRegistroAssistencial(db, {
      usuarioId: "u1",
      visitaId: "visita-9",
      registro: original,
    });
    await enfileirarRegistroAssistencial(db, {
      usuarioId: "u1",
      visitaId: "visita-9",
      registro: divergente,
    });

    const resumo = await processarFila(db, servidorEmMemoria(repo));
    expect(resumo.sincronizados).toBe(2);

    expect(
      (await repo.buscarEstado("registro_atendimento", "visita-9"))?.dados,
    ).toEqual(original);
    expect(repo.listarAdendos().map((a) => a.conteudo)).toEqual([divergente]);
  });
});
