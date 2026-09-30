import { describe, expect, it } from "vitest";
import { CSP_API, cabecalhosFixos, gerarNonce, montarCsp } from "./cabecalhos";

const SUPABASE = "https://abcd1234.supabase.co";
const DSN = "https://chave@o123.ingest.de.sentry.io/456";

function diretiva(csp: string, nome: string): string[] {
  const linha = csp.split("; ").find((d) => d.startsWith(`${nome} `));
  return linha ? linha.split(" ").slice(1) : [];
}

describe("gerarNonce", () => {
  it("gera um valor novo a cada chamada, em base64 de 128 bits", () => {
    const a = gerarNonce();
    const b = gerarNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("montarCsp (produção)", () => {
  const csp = montarCsp({
    nonce: "NONCE123",
    supabaseUrl: SUPABASE,
    sentryDsn: DSN,
  });

  it("script só com o nonce da requisição, strict-dynamic e o Turnstile; nunca unsafe-inline nem unsafe-eval", () => {
    const script = diretiva(csp, "script-src");
    expect(script).toContain("'nonce-NONCE123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).toContain("https://challenges.cloudflare.com");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("ninguém embute o app e nada de plugin, base ou formulário para fora", () => {
    expect(diretiva(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(diretiva(csp, "object-src")).toEqual(["'none'"]);
    expect(diretiva(csp, "base-uri")).toEqual(["'self'"]);
    expect(diretiva(csp, "form-action")).toEqual(["'self'"]);
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("conexão só com o app, o Supabase (https e wss) e o Sentry", () => {
    expect(diretiva(csp, "connect-src")).toEqual([
      "'self'",
      SUPABASE,
      "wss://abcd1234.supabase.co",
      "https://o123.ingest.de.sentry.io",
    ]);
  });

  it("imagem do próprio app, data, blob e o Storage do Supabase; nenhum host solto", () => {
    expect(diretiva(csp, "img-src")).toEqual([
      "'self'",
      "data:",
      "blob:",
      SUPABASE,
    ]);
    expect(csp).not.toContain("*");
  });

  it("service worker e manifesto só do próprio app; frame só do Turnstile", () => {
    expect(diretiva(csp, "worker-src")).toEqual(["'self'"]);
    expect(diretiva(csp, "manifest-src")).toEqual(["'self'"]);
    expect(diretiva(csp, "frame-src")).toEqual([
      "https://challenges.cloudflare.com",
    ]);
  });

  it("sem Sentry e sem Supabase configurados, fica só o app", () => {
    const enxuta = montarCsp({ nonce: "N" });
    expect(diretiva(enxuta, "connect-src")).toEqual(["'self'"]);
    expect(diretiva(enxuta, "img-src")).toEqual(["'self'", "data:", "blob:"]);
  });

  it("URL inválida de Supabase ou de DSN é ignorada, nunca vira diretiva quebrada", () => {
    const csp2 = montarCsp({
      nonce: "N",
      supabaseUrl: "não é url",
      sentryDsn: "javascript:alert(1)",
    });
    expect(diretiva(csp2, "connect-src")).toEqual(["'self'"]);
  });
});

describe("montarCsp (desenvolvimento)", () => {
  const csp = montarCsp({ nonce: "N", desenvolvimento: true });
  it("libera unsafe-eval e WebSocket do HMR, sem upgrade-insecure-requests", () => {
    expect(diretiva(csp, "script-src")).toContain("'unsafe-eval'");
    expect(diretiva(csp, "connect-src")).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("montarCsp (ambiente local com build de produção)", () => {
  it("não força https em http://127.0.0.1, mas segue sem unsafe-eval", () => {
    const csp = montarCsp({ nonce: "N", ambienteLocal: true });
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(diretiva(csp, "script-src")).not.toContain("'unsafe-eval'");
  });
});

describe("cabecalhosFixos e CSP_API", () => {
  const cabecalhos = Object.fromEntries(
    cabecalhosFixos().map((c) => [c.key, c.value]),
  );
  it("HSTS de um ano com subdomínios, nosniff, sem moldura e referrer restrito", () => {
    expect(cabecalhos["Strict-Transport-Security"]).toMatch(
      /max-age=31536000; includeSubDomains/,
    );
    expect(cabecalhos["X-Content-Type-Options"]).toBe("nosniff");
    expect(cabecalhos["X-Frame-Options"]).toBe("DENY");
    expect(cabecalhos["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });
  it("permissões: só o microfone do próprio app (gravador da visita)", () => {
    const p = cabecalhos["Permissions-Policy"];
    expect(p).toContain("microphone=(self)");
    expect(p).toContain("camera=()");
    expect(p).toContain("geolocation=()");
  });
  it("a API não carrega nada e ninguém a embute", () => {
    expect(CSP_API).toBe("default-src 'none'; frame-ancestors 'none'");
  });
});
