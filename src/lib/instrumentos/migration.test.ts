import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gerarMigration } from "../../../scripts/gerar-migration-instrumentos.mjs";

/**
 * P34 item 2: a migration 0045 é derivada dos JSON em
 * supabase/dados/instrumentos e carrega tudo com vigente = false.
 */
const RAIZ = join(__dirname, "..", "..", "..");
const SQL = readFileSync(
  join(RAIZ, "supabase", "migrations", "0045_instrumentos_v1.sql"),
  "utf-8",
);

describe("0045_instrumentos_v1.sql", () => {
  it("é exatamente a saída do gerador (ninguém editou à mão nem esqueceu de gerar)", () => {
    expect(SQL).toBe(gerarMigration());
  });

  it("carrega as quatro definições iguais aos JSON, com vigente = false", () => {
    const blocos = [
      ...SQL.matchAll(
        /values \('(\w+)', '([\w-]+)', \$instrumento\$([\s\S]*?)\$instrumento\$::jsonb, (\w+)\)/g,
      ),
    ];
    expect(blocos.map((m) => [m[1], m[2], m[4]])).toEqual([
      ["DOC1_ENTREVISTA", "v1-2026-09", "false"],
      ["DOC2_CHECKLIST", "v1-2026-09", "false"],
      ["DOC3_ALERTAS", "v1-2026-09", "false"],
      ["DOC4_MAMADA", "v1-2026-09", "false"],
    ]);
    blocos.forEach((m, i) => {
      const arquivo = JSON.parse(
        readFileSync(
          join(RAIZ, "supabase", "dados", "instrumentos", `doc${i + 1}.json`),
          "utf-8",
        ),
      );
      expect(JSON.parse(m[3]!)).toEqual(arquivo);
    });
  });

  it("não aprova versão, não mexe em vigente de versão aprovada e não tem segredo", () => {
    expect(SQL).not.toMatch(/aprovado_por\s*=|aprovado_em\s*=\s*now/);
    expect(SQL).not.toMatch(/vigente\s*=\s*true/);
    expect(
      SQL.match(/where public\.instrumento\.aprovado_em is null/g),
    ).toHaveLength(4);
    expect(SQL).not.toMatch(
      /eyJ[A-Za-z0-9_-]{10,}|service_role|senha|password/i,
    );
  });
});
