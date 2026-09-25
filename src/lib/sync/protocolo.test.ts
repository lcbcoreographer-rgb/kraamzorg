import { describe, expect, it } from "vitest";
import { processarLote } from "./protocolo";
import { RepositorioSincronizacaoMemoria } from "./repositorio-memoria";
import type { ItemSincronizacaoEntrada } from "./tipos";

/**
 * Testes do invariante 4 (PRD 16.1, linha "Fila de sincronização"): id
 * gerado no aparelho chega íntegro e na ordem, mesmo idempotente, mesmo
 * fora de ordem de chegada, com conflito por versão e adendo do registro
 * assistencial. `processarLote` é a mesma função que `POST /api/sync`
 * chama (src/app/api/sync/route.ts); aqui roda sem HTTP nem Dexie.
 */

function item(
  parcial: Partial<ItemSincronizacaoEntrada> &
    Pick<ItemSincronizacaoEntrada, "id" | "criadoNoClienteEm">,
): ItemSincronizacaoEntrada {
  return {
    usuarioId: "usuario-1",
    entidade: "visita",
    entidadeId: "visita-1",
    campo: "observacoes",
    payload: "valor",
    versaoBase: null,
    ...parcial,
  };
}

describe("processarLote: ordem de criação", () => {
  it("aplica dois itens da mesma entidade na ordem de criação, não na ordem de chegada", async () => {
    const repo = new RepositorioSincronizacaoMemoria();

    const criacao = item({
      id: "a",
      entidadeId: null,
      criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
      payload: { observacoes: "inicial" },
    });

    // Só sabemos o entidadeId depois de aplicar a criação; então processamos
    // em dois lotes, mas o segundo chega ao servidor primeiro (fora de
    // ordem) para provar que a ordenação por criadoNoClienteEm decide.
    const primeiraResposta = await processarLote({ itens: [criacao] }, repo);
    const idCriado = primeiraResposta.resultados[0]!;
    expect(idCriado.status).toBe("processado");
    expect(idCriado.versaoResultante).toBe(1);

    const estado = await repo.buscarEstado("visita", "memoria-1");
    expect(estado?.versao).toBe(1);

    const atualizacao1 = item({
      id: "b",
      entidadeId: "memoria-1",
      versaoBase: 1,
      criadoNoClienteEm: "2026-09-24T10:01:00.000Z",
      payload: "primeira edição",
    });
    const atualizacao2 = item({
      id: "c",
      entidadeId: "memoria-1",
      versaoBase: 2, // só existe depois que "b" aplicar
      criadoNoClienteEm: "2026-09-24T10:02:00.000Z",
      payload: "segunda edição",
    });

    // Chegam ao servidor em ordem invertida (c antes de b); o protocolo
    // reordena por criadoNoClienteEm antes de aplicar.
    const resposta = await processarLote(
      { itens: [atualizacao2, atualizacao1] },
      repo,
    );

    const porId = new Map(resposta.resultados.map((r) => [r.id, r]));
    expect(porId.get("b")?.status).toBe("processado");
    expect(porId.get("b")?.versaoResultante).toBe(2);
    expect(porId.get("c")?.status).toBe("processado");
    expect(porId.get("c")?.versaoResultante).toBe(3);

    const estadoFinal = await repo.buscarEstado("visita", "memoria-1");
    expect(estadoFinal?.dados).toEqual({ observacoes: "segunda edição" });
  });
});

describe("processarLote: idempotência", () => {
  it("reenviar o mesmo id não reaplica nem muda o resultado", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const criacao = item({
      id: "id-fixo",
      entidadeId: null,
      criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
      payload: { observacoes: "único" },
    });

    const primeira = await processarLote({ itens: [criacao] }, repo);
    const segunda = await processarLote({ itens: [criacao] }, repo);
    const terceira = await processarLote({ itens: [criacao] }, repo);

    expect(primeira.resultados).toEqual(segunda.resultados);
    expect(primeira.resultados).toEqual(terceira.resultados);

    // E o estado da entidade não avançou de versão a cada reenvio.
    const estado = await repo.buscarEstado("visita", "memoria-1");
    expect(estado?.versao).toBe(1);
  });

  it("idempotência sobrevive a um lote com o item duas vezes", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const criacao = item({
      id: "dup",
      entidadeId: null,
      criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
      payload: { observacoes: "x" },
    });

    const resposta = await processarLote({ itens: [criacao, criacao] }, repo);
    expect(resposta.resultados).toHaveLength(2);
    expect(resposta.resultados[0]).toEqual(resposta.resultados[1]);

    const estado = await repo.buscarEstado("visita", "memoria-1");
    expect(estado?.versao).toBe(1);
  });
});

describe("processarLote: conflito por versão", () => {
  it("versaoBase divergente vira conflito, com o original preservado", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const criacao = item({
      id: "a",
      entidadeId: null,
      criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
      payload: { temperatura: "36.5" },
    });
    await processarLote({ itens: [criacao] }, repo);

    // Outro aparelho aplicou uma mudança entre o momento em que este leu a
    // versão 1 e o momento em que tenta enviar a própria.
    const doOutroAparelho = item({
      id: "b",
      entidadeId: "memoria-1",
      campo: "temperatura",
      versaoBase: 1,
      criadoNoClienteEm: "2026-09-24T10:01:00.000Z",
      payload: "37.0",
    });
    await processarLote({ itens: [doOutroAparelho] }, repo);

    const estadoAntes = await repo.buscarEstado("visita", "memoria-1");
    expect(estadoAntes?.versao).toBe(2);

    const desteAparelho = item({
      id: "c",
      entidadeId: "memoria-1",
      campo: "temperatura",
      versaoBase: 1, // já defasado
      criadoNoClienteEm: "2026-09-24T10:02:00.000Z",
      payload: "36.8",
    });
    const resposta = await processarLote({ itens: [desteAparelho] }, repo);
    const resultado = resposta.resultados[0]!;

    expect(resultado.status).toBe("conflito");
    expect(resultado.conflito?.versaoAtual).toBe(2);
    expect(resultado.conflito?.tentativa).toBe("36.8");

    // O original (versão 2, de "b") nunca foi alterado pelo conflito.
    const estadoDepois = await repo.buscarEstado("visita", "memoria-1");
    expect(estadoDepois?.versao).toBe(2);
    expect((estadoDepois?.dados as Record<string, unknown>).temperatura).toBe(
      "37.0",
    );
  });
});

describe("processarLote: registro assistencial nunca sobrescrito", () => {
  it("primeira gravação de registro_atendimento aplica direto", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const registro = item({
      id: "reg-1",
      entidade: "registro_atendimento",
      entidadeId: "visita-42", // convenção: entidadeId é o visita_id
      campo: null,
      versaoBase: null,
      criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
      payload: {
        dados: { febre: false },
        resumoDescritivo: "Visita tranquila",
      },
    });

    const resposta = await processarLote({ itens: [registro] }, repo);
    expect(resposta.resultados[0]?.status).toBe("processado");
    expect(resposta.resultados[0]?.virouAdendo).toBeFalsy();
    expect(repo.listarAdendos()).toHaveLength(0);
  });

  it("uma segunda gravação divergente vira adendo, sem sobrescrever o original", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const original = item({
      id: "reg-1",
      entidade: "registro_atendimento",
      entidadeId: "visita-42",
      campo: null,
      versaoBase: null,
      criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
      payload: {
        dados: { febre: false },
        resumoDescritivo: "Visita tranquila",
      },
    });
    await processarLote({ itens: [original] }, repo);

    const divergente = item({
      id: "reg-2",
      entidade: "registro_atendimento",
      entidadeId: "visita-42",
      campo: null,
      versaoBase: null,
      criadoNoClienteEm: "2026-09-24T11:00:00.000Z",
      payload: {
        dados: { febre: true },
        resumoDescritivo: "Na verdade teve febre",
      },
    });
    const resposta = await processarLote({ itens: [divergente] }, repo);

    expect(resposta.resultados[0]).toMatchObject({
      status: "processado",
      virouAdendo: true,
    });
    expect(repo.listarAdendos()).toHaveLength(1);
    expect(repo.listarAdendos()[0]?.conteudo).toEqual(divergente.payload);

    // O original nunca muda: D-05, PRD 6.10 regra 4.
    const estado = await repo.buscarEstado("registro_atendimento", "visita-42");
    expect(estado?.dados).toEqual(original.payload);
  });

  it("reenviar exatamente o mesmo conteúdo não gera adendo (não é divergência)", async () => {
    const repo = new RepositorioSincronizacaoMemoria();
    const payload = { dados: { febre: false }, resumoDescritivo: "Ok" };
    const original = item({
      id: "reg-1",
      entidade: "registro_atendimento",
      entidadeId: "visita-42",
      campo: null,
      versaoBase: null,
      criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
      payload,
    });
    await processarLote({ itens: [original] }, repo);

    // Mesmo conteúdo, id novo (ex.: o aparelho reenviou depois de perder o
    // ack da primeira vez, mas sem deduplicar pelo id original).
    const reenvioIdentico = item({
      id: "reg-1-retry",
      entidade: "registro_atendimento",
      entidadeId: "visita-42",
      campo: null,
      versaoBase: null,
      criadoNoClienteEm: "2026-09-24T10:05:00.000Z",
      payload,
    });
    const resposta = await processarLote({ itens: [reenvioIdentico] }, repo);

    expect(resposta.resultados[0]).toMatchObject({
      status: "processado",
      virouAdendo: false,
    });
    expect(repo.listarAdendos()).toHaveLength(0);
  });
});
