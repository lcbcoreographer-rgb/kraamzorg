import { afterEach, describe, expect, it } from "vitest";
import { estaEmProducao, vitrineLiberada } from "./ambiente";

const ORIGINAL_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

function definirAmbiente(appEnv?: string, vercelEnv?: string) {
  if (appEnv === undefined) {
    delete process.env.NEXT_PUBLIC_APP_ENV;
  } else {
    process.env.NEXT_PUBLIC_APP_ENV = appEnv;
  }
  if (vercelEnv === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = vercelEnv;
  }
}

afterEach(() => {
  definirAmbiente(ORIGINAL_APP_ENV, ORIGINAL_VERCEL_ENV);
});

describe("estaEmProducao", () => {
  it("é verdadeiro só com NEXT_PUBLIC_APP_ENV=producao", () => {
    definirAmbiente("producao");
    expect(estaEmProducao()).toBe(true);
  });

  it("é falso sem a variável", () => {
    definirAmbiente(undefined);
    expect(estaEmProducao()).toBe(false);
  });

  it("é falso com um valor digitado errado", () => {
    definirAmbiente("production");
    expect(estaEmProducao()).toBe(false);
  });
});

describe("vitrineLiberada", () => {
  it("libera em desenvolvimento", () => {
    definirAmbiente("desenvolvimento");
    expect(vitrineLiberada()).toBe(true);
  });

  it("libera em homologacao", () => {
    definirAmbiente("homologacao");
    expect(vitrineLiberada()).toBe(true);
  });

  it("recusa em producao", () => {
    definirAmbiente("producao");
    expect(vitrineLiberada()).toBe(false);
  });

  it("recusa sem a variável (não libera por omissão)", () => {
    definirAmbiente(undefined);
    expect(vitrineLiberada()).toBe(false);
  });

  it("recusa com um valor digitado errado, como 'production' em inglês", () => {
    definirAmbiente("production");
    expect(vitrineLiberada()).toBe(false);
  });

  it("recusa quando VERCEL_ENV é production, mesmo com NEXT_PUBLIC_APP_ENV liberado", () => {
    definirAmbiente("desenvolvimento", "production");
    expect(vitrineLiberada()).toBe(false);
  });

  it("libera com VERCEL_ENV de pré-visualização e NEXT_PUBLIC_APP_ENV liberado", () => {
    definirAmbiente("homologacao", "preview");
    expect(vitrineLiberada()).toBe(true);
  });
});
