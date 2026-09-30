import { describe, expect, it } from "vitest";
import { checarAmbiente, normalizarAmbiente } from "./checar-ambiente.mjs";

type Problema = { variavel: string; motivo: string };

const SEGREDO = "x".repeat(32);
const HML: Record<string, string> = {
  NEXT_PUBLIC_APP_ENV: "homologacao",
  NEXT_PUBLIC_SUPABASE_URL: "https://hml.supabase.exemplo.invalid",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "servico",
  APP_BASE_URL: "https://hml.app.exemplo.invalid",
  CRON_SECRET: SEGREDO,
  INTERNAL_ROUTES_SECRET: SEGREDO,
  RESEND_API_KEY: "re_x",
  RESEND_FROM_EMAIL: "avisos@exemplo.invalid",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
  TURNSTILE_SECRET_KEY: "segredo-do-hml",
  NEXT_PUBLIC_SENTRY_DSN: "https://k@o1.ingest.sentry.io/1",
  AUTENTIQUE_API_TOKEN: "t",
  AUTENTIQUE_WEBHOOK_SECRET: SEGREDO,
  INFINITEPAY_HANDLE: "handle",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
  VAPID_SUBJECT: "mailto:avisos@exemplo.invalid",
};
const PROD: Record<string, string> = {
  ...HML,
  NEXT_PUBLIC_APP_ENV: "producao",
  AUTENTIQUE_SANDBOX: "false",
  WHATSAPP_CLOUD_TOKEN: "t",
  WHATSAPP_PHONE_NUMBER_ID: "123",
  WHATSAPP_APP_SECRET: SEGREDO,
  WHATSAPP_VERIFY_TOKEN: SEGREDO,
};

const nomes = (ambiente: string, vars: Record<string, string | undefined>) =>
  (checarAmbiente(ambiente, vars).problemas as Problema[]).map(
    (p) => p.variavel,
  );

describe("checarAmbiente", () => {
  it("aceita apelidos e recusa ambiente desconhecido", () => {
    expect(normalizarAmbiente("hml")).toBe("homologacao");
    expect(normalizarAmbiente("prod")).toBe("producao");
    expect(() => checarAmbiente("staging", {})).toThrow(/desconhecido/);
  });

  it("homologação completa passa; produção completa passa", () => {
    expect(nomes("hml", HML)).toEqual([]);
    expect(nomes("producao", PROD)).toEqual([]);
  });

  it("lista as variáveis que faltam, sem mostrar valor", () => {
    const { problemas } = checarAmbiente("hml", {
      NEXT_PUBLIC_APP_ENV: "homologacao",
    });
    expect(problemas.length).toBeGreaterThan(10);
    expect(JSON.stringify(problemas)).not.toContain(SEGREDO);
  });

  it("nunca deixa o modo demonstração ligado fora do desenvolvimento", () => {
    expect(nomes("hml", { ...HML, KZ_DADOS: "demonstracao" })).toEqual([
      "KZ_DADOS",
    ]);
    expect(nomes("producao", { ...PROD, KZ_DADOS: "demonstracao" })).toEqual([
      "KZ_DADOS",
    ]);
  });

  it("NEXT_PUBLIC_APP_ENV tem de ser o do ambiente", () => {
    expect(
      nomes("producao", { ...PROD, NEXT_PUBLIC_APP_ENV: "homologacao" }),
    ).toEqual(["NEXT_PUBLIC_APP_ENV"]);
  });

  it("produção exige Cloud API, sandbox desligado e Turnstile de verdade", () => {
    const semNuvem = { ...PROD };
    delete semNuvem.WHATSAPP_CLOUD_TOKEN;
    expect(nomes("producao", semNuvem)).toEqual(["WHATSAPP_CLOUD_TOKEN"]);
    expect(nomes("producao", { ...PROD, AUTENTIQUE_SANDBOX: "true" })).toEqual([
      "AUTENTIQUE_SANDBOX",
    ]);
    const semSandbox = { ...PROD };
    delete semSandbox.AUTENTIQUE_SANDBOX;
    expect(nomes("producao", semSandbox)).toEqual(["AUTENTIQUE_SANDBOX"]);
    expect(
      nomes("producao", {
        ...PROD,
        TURNSTILE_SECRET_KEY: "1x00000000000000000000AA",
      }),
    ).toEqual(["TURNSTILE_SECRET_KEY"]);
    expect(nomes("producao", { ...PROD, VERCEL_ENV: "preview" })).toEqual([
      "VERCEL_ENV",
    ]);
  });

  it("homologação não exige a Cloud API (cai na captura) nem o Production da Vercel", () => {
    expect(nomes("hml", HML)).toEqual([]);
    expect(nomes("hml", { ...HML, VERCEL_ENV: "production" })).toEqual([
      "VERCEL_ENV",
    ]);
  });

  it("formatos: https, sem barra no fim, segredo curto, assunto do VAPID", () => {
    expect(
      nomes("hml", { ...HML, NEXT_PUBLIC_SUPABASE_URL: "http://x" }),
    ).toEqual(["NEXT_PUBLIC_SUPABASE_URL"]);
    expect(
      nomes("hml", { ...HML, APP_BASE_URL: "https://x.exemplo.invalid/" }),
    ).toEqual(["APP_BASE_URL"]);
    expect(nomes("hml", { ...HML, CRON_SECRET: "curto" })).toEqual([
      "CRON_SECRET",
    ]);
    expect(nomes("hml", { ...HML, VAPID_SUBJECT: "avisos@x" })).toEqual([
      "VAPID_SUBJECT",
    ]);
    expect(
      nomes("hml", { ...HML, NEXT_PUBLIC_SENTRY_DSN: "http://k@x/1" }),
    ).toEqual(["NEXT_PUBLIC_SENTRY_DSN"]);
  });

  it("desenvolvimento só pede o ambiente certo", () => {
    expect(
      nomes("desenvolvimento", { NEXT_PUBLIC_APP_ENV: "desenvolvimento" }),
    ).toEqual([]);
    expect(
      nomes("desenvolvimento", { NEXT_PUBLIC_APP_ENV: "producao" }),
    ).toEqual(["NEXT_PUBLIC_APP_ENV"]);
  });
});
