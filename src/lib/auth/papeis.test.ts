import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { descreverPapeis, exigeMfa, PAPEIS_COM_MFA } from "./papeis";

describe("papéis com MFA obrigatório", () => {
  it("a lista do app é a mesma de privado.perfil_exige_mfa() na migration 0007", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../../supabase/migrations/0007_permissoes.sql"),
      "utf8",
    );
    const corpo =
      /create function privado\.perfil_exige_mfa\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(
        sql,
      )?.[1];
    expect(
      corpo,
      "função privado.perfil_exige_mfa não encontrada na 0007",
    ).toBeTruthy();
    const noBanco = [...corpo!.matchAll(/tem_papel\('([a-z_]+)'\)/g)]
      .map((m) => m[1])
      .sort();
    expect([...PAPEIS_COM_MFA].sort()).toEqual(noBanco);
  });

  it("exigeMfa olha todos os papéis da pessoa", () => {
    expect(exigeMfa(["comercial"])).toBe(false);
    expect(exigeMfa(["comercial", "financeiro"])).toBe(true);
  });

  it("descreverPapeis escreve sem travessão", () => {
    expect(descreverPapeis(["comercial", "diretoria"])).toBe(
      "Comercial e diretoria",
    );
    expect(descreverPapeis(["diretoria", "comercial", "financeiro"])).toBe(
      "Diretoria, comercial e financeiro",
    );
  });
});
