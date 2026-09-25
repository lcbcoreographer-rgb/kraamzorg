// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { despacharNotificacao } from "./despachar";

const ORIGINAL = {
  UAZAPI_BASE_URL: process.env.UAZAPI_BASE_URL,
  UAZAPI_TOKEN: process.env.UAZAPI_TOKEN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
};

beforeEach(() => {
  process.env.UAZAPI_BASE_URL = "https://uazapi.exemplo.com";
  process.env.UAZAPI_TOKEN = "token-teste";
  process.env.RESEND_API_KEY = "re_teste";
  process.env.RESEND_FROM_EMAIL = "central@kraamzorg.example";
});

afterEach(() => {
  Object.assign(process.env, ORIGINAL);
  vi.restoreAllMocks();
});

describe("despacharNotificacao", () => {
  it("push aparece como pendente, sem tentar a rede", async () => {
    const resultados = await despacharNotificacao({
      titulo: "Título",
      canais: ["push"],
    });
    expect(resultados).toEqual([
      {
        canal: "push",
        destino: "-",
        ok: false,
        motivo: expect.stringMatching(/P11/),
      },
    ]);
  });

  it("whatsapp_interno envia para cada destino, sem checar o freio (categoria interna)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: "wa-1" }), { status: 200 }),
      ),
    );

    const resultados = await despacharNotificacao({
      titulo: "🚨 SAÚDE",
      corpo: "Assumir agora",
      canais: ["whatsapp_interno"],
      whatsappInterno: [{ telefoneOuJid: "12036@g.us" }],
    });

    expect(resultados).toEqual([
      {
        canal: "whatsapp_interno",
        destino: "12036@g.us",
        ok: true,
        motivo: undefined,
      },
    ]);
  });

  it("email envia para cada destinatário pelo Resend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );

    const resultados = await despacharNotificacao({
      titulo: "Aviso",
      canais: ["email"],
      emails: ["equipe@kraamzorg.example"],
    });

    expect(resultados).toEqual([
      {
        canal: "email",
        destino: "equipe@kraamzorg.example",
        ok: true,
        motivo: undefined,
      },
    ]);
  });

  it("o assunto do e-mail é neutro: título com nome de família fica só no corpo", async () => {
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", buscar);

    await despacharNotificacao({
      titulo: "Família Teste Aurora quer contratar",
      canais: ["email"],
      emails: ["equipe@kraamzorg.example"],
    });

    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    const corpo = JSON.parse(String(init.body)) as {
      subject: string;
      text: string;
    };
    expect(corpo.subject).not.toMatch(/Aurora/);
    expect(corpo.text).toMatch(/Aurora/);
  });

  it("preferências da pessoa desligam o canal que ela escolheu", async () => {
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", buscar);

    const resultados = await despacharNotificacao({
      titulo: "Aviso",
      canais: ["email", "push"],
      emails: ["equipe@kraamzorg.example"],
      preferencias: {
        usuarioId: "u1",
        push: true,
        whatsappInterno: true,
        email: false,
      },
    });

    expect(resultados.map((r) => r.canal)).toEqual(["push"]);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("sem canal nenhum, devolve lista vazia", async () => {
    expect(await despacharNotificacao({ titulo: "x", canais: [] })).toEqual([]);
  });
});
