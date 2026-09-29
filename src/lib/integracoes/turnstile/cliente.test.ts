import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configuracaoTurnstile,
  ehChaveDeTeste,
  TURNSTILE_TESTE,
  verificarTurnstile,
} from "./cliente";

const ORIGINAL = { ...process.env };

function ambiente(valores: Record<string, string | undefined>) {
  for (const chave of [
    "NEXT_PUBLIC_APP_ENV",
    "VERCEL_ENV",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ]) {
    delete process.env[chave];
  }
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor !== undefined) process.env[chave] = valor;
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("configuracaoTurnstile", () => {
  it("em desenvolvimento sem chaves usa as chaves de teste da Cloudflare", () => {
    ambiente({ NEXT_PUBLIC_APP_ENV: "desenvolvimento" });
    expect(configuracaoTurnstile()).toEqual({
      siteKey: TURNSTILE_TESTE.siteSempreAceita,
      segredo: TURNSTILE_TESTE.segredoSempreAceita,
    });
  });

  it("em homologação sem chaves fica fechado", () => {
    ambiente({ NEXT_PUBLIC_APP_ENV: "homologacao" });
    expect(configuracaoTurnstile()).toEqual({ siteKey: null, segredo: null });
  });

  it("sem ambiente definido não cai no modo de teste", () => {
    ambiente({});
    expect(configuracaoTurnstile().segredo).toBeNull();
  });

  it("em produção recusa chave de teste mesmo configurada", () => {
    ambiente({
      NEXT_PUBLIC_APP_ENV: "producao",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_TESTE.siteSempreAceita,
      TURNSTILE_SECRET_KEY: TURNSTILE_TESTE.segredoSempreAceita,
    });
    expect(configuracaoTurnstile()).toEqual({ siteKey: null, segredo: null });
  });

  it("um deploy de produção da Vercel nunca entra no modo de teste", () => {
    ambiente({
      NEXT_PUBLIC_APP_ENV: "desenvolvimento",
      VERCEL_ENV: "production",
    });
    expect(configuracaoTurnstile().segredo).toBeNull();
  });

  it("com chaves reais configuradas, usa as configuradas", () => {
    ambiente({
      NEXT_PUBLIC_APP_ENV: "producao",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAsiteDeVerdade",
      TURNSTILE_SECRET_KEY: "0x4AAAAAAAsegredoDeVerdade",
    });
    expect(configuracaoTurnstile()).toEqual({
      siteKey: "0x4AAAAAAAsiteDeVerdade",
      segredo: "0x4AAAAAAAsegredoDeVerdade",
    });
  });
});

describe("verificarTurnstile", () => {
  it("sem token recusa antes de qualquer rede", async () => {
    ambiente({ NEXT_PUBLIC_APP_ENV: "desenvolvimento" });
    const fetchImpl = vi.fn();
    expect(await verificarTurnstile("", null, fetchImpl)).toEqual({
      ok: false,
      motivo: "sem_token",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("chaves de teste respondem como a documentação da Cloudflare, sem rede", async () => {
    const fetchImpl = vi.fn();
    ambiente({ NEXT_PUBLIC_APP_ENV: "desenvolvimento" });
    expect(
      await verificarTurnstile("XXXX.DUMMY.TOKEN.XXXX", null, fetchImpl),
    ).toEqual({ ok: true });

    ambiente({
      NEXT_PUBLIC_APP_ENV: "desenvolvimento",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_TESTE.siteSempreAceita,
      TURNSTILE_SECRET_KEY: TURNSTILE_TESTE.segredoSempreRecusa,
    });
    expect(
      await verificarTurnstile("XXXX.DUMMY.TOKEN.XXXX", null, fetchImpl),
    ).toEqual({
      ok: false,
      motivo: "recusado",
    });

    ambiente({
      NEXT_PUBLIC_APP_ENV: "desenvolvimento",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_TESTE.siteSempreAceita,
      TURNSTILE_SECRET_KEY: TURNSTILE_TESTE.segredoTokenGasto,
    });
    expect(
      await verificarTurnstile("XXXX.DUMMY.TOKEN.XXXX", null, fetchImpl),
    ).toEqual({
      ok: false,
      motivo: "recusado",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("com chave real chama a Cloudflare com o IP e aceita success", async () => {
    ambiente({
      NEXT_PUBLIC_APP_ENV: "producao",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAsiteDeVerdade",
      TURNSTILE_SECRET_KEY: "0x4AAAAAAAsegredoDeVerdade",
    });
    const fetchImpl = vi.fn(async () => Response.json({ success: true }));
    expect(
      await verificarTurnstile("token-do-widget", "203.0.113.9", fetchImpl),
    ).toEqual({ ok: true });
    const [url, pedido] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    const corpo = new URLSearchParams(pedido.body as URLSearchParams);
    expect(corpo.get("response")).toBe("token-do-widget");
    expect(corpo.get("remoteip")).toBe("203.0.113.9");
  });

  it("resposta sem success recusa; falha de rede vira indisponível", async () => {
    ambiente({
      NEXT_PUBLIC_APP_ENV: "producao",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAsiteDeVerdade",
      TURNSTILE_SECRET_KEY: "0x4AAAAAAAsegredoDeVerdade",
    });
    expect(
      await verificarTurnstile(
        "t",
        null,
        vi.fn(async () =>
          Response.json({
            success: false,
            "error-codes": ["timeout-or-duplicate"],
          }),
        ),
      ),
    ).toEqual({ ok: false, motivo: "recusado" });
    expect(
      await verificarTurnstile(
        "t",
        null,
        vi.fn(async () => {
          throw new Error("rede");
        }),
      ),
    ).toEqual({ ok: false, motivo: "indisponivel" });
  });

  it("em produção sem chave nenhum envio passa", async () => {
    ambiente({ NEXT_PUBLIC_APP_ENV: "producao" });
    expect(await verificarTurnstile("t", null, vi.fn())).toEqual({
      ok: false,
      motivo: "indisponivel",
    });
  });
});

describe("ehChaveDeTeste", () => {
  it("reconhece só a forma das chaves de teste", () => {
    expect(ehChaveDeTeste(TURNSTILE_TESTE.siteSempreAceita)).toBe(true);
    expect(ehChaveDeTeste(TURNSTILE_TESTE.segredoTokenGasto)).toBe(true);
    expect(ehChaveDeTeste("0x4AAAAAAAsiteDeVerdade")).toBe(false);
  });
});
