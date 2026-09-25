import { describe, expect, it } from "vitest";
import { POST } from "./route";
import type { RespostaSincronizacao } from "@/lib/sync/tipos";

function requisicao(corpo: unknown): Request {
  return new Request("http://localhost/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

function item(sobrescreve: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    usuarioId: "usuario-1",
    entidade: "visita",
    entidadeId: null,
    campo: null,
    payload: { observacoes: "primeira visita" },
    versaoBase: null,
    criadoNoClienteEm: "2026-09-24T10:00:00.000Z",
    ...sobrescreve,
  };
}

describe("POST /api/sync", () => {
  it("processa um item válido e devolve 200", async () => {
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(200);

    const corpo = (await resposta.json()) as RespostaSincronizacao;
    expect(corpo.resultados).toHaveLength(1);
    expect(corpo.resultados[0]?.status).toBe("processado");
  });

  it("é idempotente: reenviar o mesmo id não reprocessa", async () => {
    const mesmoItem = item({
      id: "22222222-2222-4222-8222-222222222222",
    });

    const primeira = await POST(requisicao({ itens: [mesmoItem] }));
    const segunda = await POST(requisicao({ itens: [mesmoItem] }));

    const corpoPrimeira = (await primeira.json()) as RespostaSincronizacao;
    const corpoSegunda = (await segunda.json()) as RespostaSincronizacao;

    expect(corpoSegunda.resultados).toEqual(corpoPrimeira.resultados);
  });

  it("recusa corpo sem itens, com 400", async () => {
    const resposta = await POST(requisicao({ itens: [] }));
    expect(resposta.status).toBe(400);
  });

  it("recusa item sem id válido, com 400", async () => {
    const resposta = await POST(
      requisicao({ itens: [item({ id: "não é um uuid" })] }),
    );
    expect(resposta.status).toBe(400);
  });

  it("recusa corpo que não é JSON, com 400", async () => {
    const resposta = await POST(
      new Request("http://localhost/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ isso não é json",
      }),
    );
    expect(resposta.status).toBe(400);
  });
});
