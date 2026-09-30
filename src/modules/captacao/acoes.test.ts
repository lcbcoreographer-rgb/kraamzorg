// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

const verificarTurnstile = vi.fn();
vi.mock("@/lib/integracoes/turnstile/cliente", () => ({
  verificarTurnstile: (...args: unknown[]) => verificarTurnstile(...args),
}));

import { reiniciarLojaRelacao } from "@/lib/dados/demonstracao/relacao-loja";
import { acaoIniciarCaptacao } from "./acoes";
import { utmDaBusca } from "./tipos";

/**
 * Botão da página de captação (P47): o link wa.me só sai com o Turnstile
 * confirmado, o canal precisa existir e estar ativo, e a resposta leva o
 * código de origem no texto e nada da pessoa.
 */

const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

beforeEach(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLojaRelacao();
  verificarTurnstile.mockReset();
  verificarTurnstile.mockResolvedValue({ ok: true });
});

afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
});

describe("acaoIniciarCaptacao", () => {
  it("com o Turnstile confirmado devolve o link wa.me com o código de origem", async () => {
    const r = await acaoIniciarCaptacao({
      canal: "IGBIO",
      utm: { utm_source: "instagram" },
      verificacao: "token",
    });
    expect(r.situacao).toBe("ok");
    if (r.situacao !== "ok") return;
    expect(r.url).toMatch(/^https:\/\/wa\.me\/\d{10,15}\?text=/);
    expect(decodeURIComponent(r.url)).toMatch(/KZ-IGBIO/);
    expect(verificarTurnstile).toHaveBeenCalledWith("token", "203.0.113.7");
  });

  it("sem verificação do Turnstile nada sai", async () => {
    verificarTurnstile.mockResolvedValue({ ok: false });
    expect(
      await acaoIniciarCaptacao({ canal: "IGBIO", utm: {}, verificacao: null }),
    ).toEqual({ situacao: "verificacao" });
  });

  it("canal que não existe ou vazio fica indisponível, sem detalhe", async () => {
    expect(
      await acaoIniciarCaptacao({ canal: "NADA", utm: {}, verificacao: "t" }),
    ).toEqual({ situacao: "indisponivel" });
    expect(
      await acaoIniciarCaptacao({ canal: "", utm: {}, verificacao: "t" }),
    ).toEqual({ situacao: "indisponivel" });
  });

  it("o limite por origem vira a situação limite depois de tentativas demais", async () => {
    const maximo = 200;
    let ultima = "ok";
    for (let i = 0; i < maximo && ultima === "ok"; i += 1) {
      ultima = (
        await acaoIniciarCaptacao({ canal: "IGBIO", utm: {}, verificacao: "t" })
      ).situacao;
    }
    expect(ultima).toBe("limite");
  });
});

describe("utmDaBusca", () => {
  it("guarda só as cinco chaves utm_*, cada uma curta", () => {
    expect(
      utmDaBusca({
        utm_source: "instagram",
        utm_medium: ["bio", "outro"],
        utm_campaign: "x".repeat(81),
        nome: "Fulana",
        telefone: "11999990000",
      }),
    ).toEqual({ utm_source: "instagram", utm_medium: "bio" });
  });
});
