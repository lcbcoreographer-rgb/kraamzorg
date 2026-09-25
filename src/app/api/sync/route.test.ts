import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "desenvolvimento");
    vi.stubEnv("VERCEL_ENV", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("item inválido recebe erro sozinho, sem derrubar os válidos do mesmo lote", async () => {
    const valido = item({ id: "44444444-4444-4444-8444-444444444444" });
    const resposta = await POST(
      requisicao({ itens: [item({ id: "não é um uuid" }), valido] }),
    );
    expect(resposta.status).toBe(200);

    const corpo = (await resposta.json()) as RespostaSincronizacao;
    const porId = new Map(corpo.resultados.map((r) => [r.id, r]));
    expect(porId.get("não é um uuid")?.status).toBe("erro");
    expect(porId.get(valido.id)?.status).toBe("processado");
  });

  it("recusa lote que não é uma lista de itens, com 400", async () => {
    const resposta = await POST(requisicao({ itens: "nada" }));
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

  it("recusa o item com criadoNoClienteEm que não é data ISO", async () => {
    const resposta = await POST(
      requisicao({
        itens: [
          item({
            id: "33333333-3333-4333-8333-333333333333",
            criadoNoClienteEm: "ontem à tarde",
          }),
        ],
      }),
    );
    const corpo = (await resposta.json()) as RespostaSincronizacao;
    expect(corpo.resultados).toEqual([
      expect.objectContaining({
        id: "33333333-3333-4333-8333-333333333333",
        status: "erro",
      }),
    ]);
  });
});

describe("POST /api/sync em produção (sem autenticação ainda, P07)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("responde 404 com NEXT_PUBLIC_APP_ENV de produção", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "producao");
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(404);
  });

  it("responde 404 sem NEXT_PUBLIC_APP_ENV definido (recusa por omissão)", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "");
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(404);
  });

  it("responde 404 num deploy de produção do Vercel, mesmo com o ambiente liberado", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
    vi.stubEnv("VERCEL_ENV", "production");
    const resposta = await POST(requisicao({ itens: [item()] }));
    expect(resposta.status).toBe(404);
  });
});
