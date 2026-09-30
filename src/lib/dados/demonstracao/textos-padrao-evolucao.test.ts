// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS_PADRAO_EVOLUCAO } from "./textos-padrao-evolucao";

/**
 * A cópia dos textos padrão da evolução que o modo demonstração usa tem de ser
 * a mesma que a migration 0024 grava em `mensagem_modelo`. Sem este teste, o
 * texto que a enfermeira vê na demonstração poderia divergir do que o banco
 * entrega (e do que a Edilaine revisa).
 */

const MIGRATION = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/0024_evolucao_ocorrencia_nf.sql",
  ),
  "utf8",
);

function textosDaMigration(): Record<string, string> {
  const saida: Record<string, string> = {};
  const linha =
    /\('(evo_[a-z0-9_]+)', 'email', 'medico', (E?)'((?:[^']|'')*)'/g;
  for (const achado of MIGRATION.matchAll(linha)) {
    const [, chave, escape, bruto] = achado;
    let texto = bruto!.replace(/''/g, "'");
    if (escape === "E") texto = texto.replace(/\\n/g, "\n");
    saida[chave!] = texto;
  }
  return saida;
}

describe("textos padrão da evolução", () => {
  const daMigration = textosDaMigration();

  it("a migration grava os textos", () => {
    expect(Object.keys(daMigration).length).toBeGreaterThan(30);
  });

  it("a cópia da demonstração tem as mesmas chaves e os mesmos textos da migration", () => {
    expect(Object.keys(TEXTOS_PADRAO_EVOLUCAO).sort()).toEqual(
      Object.keys(daMigration).sort(),
    );
    for (const [chave, texto] of Object.entries(daMigration)) {
      expect(TEXTOS_PADRAO_EVOLUCAO[chave], chave).toBe(texto);
    }
  });

  it("nenhum texto tem travessão ou meia-risca", () => {
    for (const [chave, texto] of Object.entries(TEXTOS_PADRAO_EVOLUCAO)) {
      expect(/[\u2013\u2014]/.test(texto), chave).toBe(false);
    }
  });

  it("texto com concordância de gênero existe nas duas formas", () => {
    const chaves = Object.keys(TEXTOS_PADRAO_EVOLUCAO);
    for (const chave of chaves) {
      if (chave.endsWith("_masculino")) {
        expect(chaves, chave).toContain(
          chave.replace(/_masculino$/, "_feminino"),
        );
      }
      if (chave.endsWith("_feminino")) {
        expect(chaves, chave).toContain(
          chave.replace(/_feminino$/, "_masculino"),
        );
      }
    }
  });
});
