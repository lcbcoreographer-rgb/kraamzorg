// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { enviarEmail } from "./email";

const ORIGINAL = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
};

afterEach(() => {
  Object.assign(process.env, ORIGINAL);
});

describe("enviarEmail", () => {
  it("sem RESEND_API_KEY ou RESEND_FROM_EMAIL, falha sem tentar a rede", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const buscar = vi.fn();
    const resultado = await enviarEmail(
      "a@exemplo.com",
      "Assunto",
      "Texto",
      buscar,
    );
    expect(resultado.ok).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("com as duas configuradas, chama a API do Resend com o remetente certo", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    process.env.RESEND_FROM_EMAIL = "central@kraamzorg.example";
    const buscar = vi.fn(async () => new Response("{}", { status: 200 }));

    const resultado = await enviarEmail(
      "a@exemplo.com",
      "Assunto",
      "Texto",
      buscar,
    );

    expect(resultado.ok).toBe(true);
    const [url, init] = buscar.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer re_teste",
    );
    const corpo = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(corpo.from).toBe("central@kraamzorg.example");
    expect(corpo.to).toEqual(["a@exemplo.com"]);
  });

  it("HTTP de erro vira resultado sem sucesso", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    process.env.RESEND_FROM_EMAIL = "central@kraamzorg.example";
    const buscar = vi.fn(async () => new Response("erro", { status: 422 }));
    const resultado = await enviarEmail(
      "a@exemplo.com",
      "Assunto",
      "Texto",
      buscar,
    );
    expect(resultado.ok).toBe(false);
  });
});
