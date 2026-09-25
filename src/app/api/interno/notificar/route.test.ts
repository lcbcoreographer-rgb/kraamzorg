// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const ORIGINAL_SECRET = process.env.INTERNAL_ROUTES_SECRET;

function requisicao(corpo: unknown, segredo?: string): NextRequest {
  return new NextRequest("http://localhost/api/interno/notificar", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(segredo !== undefined ? { "x-kz-interno-secret": segredo } : {}),
    },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  process.env.INTERNAL_ROUTES_SECRET = "segredo-de-teste-bem-comprido";
});

afterEach(() => {
  process.env.INTERNAL_ROUTES_SECRET = ORIGINAL_SECRET;
  vi.restoreAllMocks();
});

describe("POST /api/interno/notificar", () => {
  it("sem cabeçalho de segredo, recusa com 401 e não despacha nada", async () => {
    const buscar = vi.fn();
    vi.stubGlobal("fetch", buscar);
    const resposta = await POST(requisicao({ titulo: "x", canais: ["email"] }));
    expect(resposta.status).toBe(401);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("com segredo errado, recusa com 401, mesmo com o prefixo certo", async () => {
    const resposta = await POST(
      requisicao(
        { titulo: "x", canais: ["email"] },
        "segredo-de-teste-bem-comprid0",
      ),
    );
    expect(resposta.status).toBe(401);
  });

  it("sem INTERNAL_ROUTES_SECRET configurado no ambiente, recusa sempre", async () => {
    delete process.env.INTERNAL_ROUTES_SECRET;
    const resposta = await POST(
      requisicao({ titulo: "x", canais: ["email"] }, "qualquer-coisa"),
    );
    expect(resposta.status).toBe(401);
  });

  it("corpo inválido (sem canais), devolve 400", async () => {
    const resposta = await POST(
      requisicao({ titulo: "x" }, "segredo-de-teste-bem-comprido"),
    );
    expect(resposta.status).toBe(400);
  });

  it("com segredo certo e corpo válido, despacha e devolve 200 com os resultados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    process.env.RESEND_API_KEY = "re_teste";
    process.env.RESEND_FROM_EMAIL = "central@kraamzorg.example";

    const resposta = await POST(
      requisicao(
        {
          titulo: "🚨 SAÚDE",
          corpo: "Assumir agora",
          canais: ["email"],
          emails: ["equipe@kraamzorg.example"],
        },
        "segredo-de-teste-bem-comprido",
      ),
    );

    expect(resposta.status).toBe(200);
    const corpo = (await resposta.json()) as { resultados: unknown[] };
    expect(corpo.resultados).toEqual([
      {
        canal: "email",
        destino: "equipe@kraamzorg.example",
        ok: true,
        motivo: undefined,
      },
    ]);
  });
});
