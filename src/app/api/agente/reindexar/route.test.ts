// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SessaoUsuario } from "@/lib/auth/tipos";

vi.mock("@/lib/auth/sessao", () => {
  let sessaoAtual: SessaoUsuario | null = null;
  return {
    obterSessao: async () => sessaoAtual,
    __definirSessao: (s: SessaoUsuario | null) => {
      sessaoAtual = s;
    },
  };
});

import { POST } from "./route";

function sessaoDe(papeis: SessaoUsuario["papeis"]): SessaoUsuario {
  return {
    usuarioId: "usuario-teste",
    nome: "Perfil Teste",
    email: "teste@kraamzorgbrasil.test",
    papeis,
    ativo: true,
    aal: "aal2",
    aalPossivel: "aal2",
  };
}

async function logarComo(papeis: SessaoUsuario["papeis"] | null) {
  const modulo = (await import("@/lib/auth/sessao")) as unknown as {
    __definirSessao: (s: SessaoUsuario | null) => void;
  };
  modulo.__definirSessao(papeis ? sessaoDe(papeis) : null);
}

const ORIGINAL_URL = process.env.N8N_WEBHOOK_REINDEXAR_URL;

beforeEach(() => {
  process.env.N8N_WEBHOOK_REINDEXAR_URL =
    "https://n8n.exemplo.invalid/webhook/reindexar-segredo";
});

afterEach(() => {
  process.env.N8N_WEBHOOK_REINDEXAR_URL = ORIGINAL_URL;
  vi.restoreAllMocks();
});

describe("POST /api/agente/reindexar (P26 item 3, botão do P27)", () => {
  it("sem sessão, recusa com 401 e não chama o webhook", async () => {
    await logarComo(null);
    const buscar = vi.fn();
    vi.stubGlobal("fetch", buscar);
    const resposta = await POST();
    expect(resposta.status).toBe(401);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("papel sem acesso (enfermeira), recusa com 403", async () => {
    await logarComo(["enfermeira"]);
    const buscar = vi.fn();
    vi.stubGlobal("fetch", buscar);
    const resposta = await POST();
    expect(resposta.status).toBe(403);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("sem N8N_WEBHOOK_REINDEXAR_URL configurada, devolve 503 e não chama fetch", async () => {
    delete process.env.N8N_WEBHOOK_REINDEXAR_URL;
    await logarComo(["diretoria"]);
    const buscar = vi.fn();
    vi.stubGlobal("fetch", buscar);
    const resposta = await POST();
    expect(resposta.status).toBe(503);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("diretoria com a variável configurada: chama o webhook e devolve 200", async () => {
    await logarComo(["diretoria"]);
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", buscar);

    const resposta = await POST();

    expect(resposta.status).toBe(200);
    expect(buscar).toHaveBeenCalledWith(
      "https://n8n.exemplo.invalid/webhook/reindexar-segredo",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("comercial também pode reindexar (PRD 13: leitura do comercial)", async () => {
    await logarComo(["comercial"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    const resposta = await POST();
    expect(resposta.status).toBe(200);
  });

  it("diretoria sem o código do aplicativo (AAL1) recusa com 403 e não chama o webhook", async () => {
    const modulo = (await import("@/lib/auth/sessao")) as unknown as {
      __definirSessao: (s: SessaoUsuario | null) => void;
    };
    modulo.__definirSessao({
      ...sessaoDe(["diretoria"]),
      aal: "aal1",
      aalPossivel: "aal2",
    });
    const buscar = vi.fn();
    vi.stubGlobal("fetch", buscar);
    const resposta = await POST();
    expect(resposta.status).toBe(403);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("a resposta de erro nunca expõe a URL secreta do webhook", async () => {
    await logarComo(["diretoria"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("erro", { status: 500 })),
    );
    const resposta = await POST();
    expect(JSON.stringify(await resposta.json())).not.toContain(
      "reindexar-segredo",
    );
  });

  it("webhook recusa (HTTP 500): devolve 502 com mensagem clara", async () => {
    await logarComo(["diretoria"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("erro", { status: 500 })),
    );
    const resposta = await POST();
    expect(resposta.status).toBe(502);
  });
});
