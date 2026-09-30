// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ARQUIVO_SQL,
  extrairSeedRelacao,
  montarModulo,
} from "../../../../scripts/gerar-seed-relacao.mjs";
import { PARAMETROS_RELACAO, TEXTOS_RELACAO } from "./relacao-seed.gerado";

/**
 * O modo demonstração lê parâmetros e textos de um arquivo gerado do seed
 * (nenhum texto nem limite escrito duas vezes à mão), e o seed obedece às
 * regras de texto do CLAUDE.md.
 */

const TRAVESSOES = new RegExp("[\\u2013\\u2014]");
const sql = readFileSync(ARQUIVO_SQL, "utf8");
const extraido = extrairSeedRelacao(sql) as unknown as {
  parametros: Record<string, unknown>;
  textos: { chave: string; texto: string }[];
};

describe("seed do relacionamento (0027)", () => {
  it("o arquivo gerado tem os mesmos dados do seed SQL", () => {
    expect(PARAMETROS_RELACAO).toEqual(extraido.parametros);
    expect(TEXTOS_RELACAO).toEqual(extraido.textos);
    expect(montarModulo(extraido as never)).toContain("PARAMETROS_RELACAO");
  });

  it("todo texto de mensagem_modelo entra como rascunho, até o Leonardo aprovar", () => {
    const linhas = sql
      .split("\n")
      .filter((l) => /'(rascunho|aprovada|ativa)'\)[,;]?\s*$/.test(l));
    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) expect(linha).toContain("'rascunho'");
    expect(sql).not.toMatch(/'aprovad[oa]'\)/);
  });

  it("nenhum texto tem travessão, meia-risca nem apelido proibido", () => {
    const tudo = JSON.stringify([extraido.parametros, extraido.textos]);
    expect(tudo).not.toMatch(TRAVESSOES);
    expect(tudo).not.toMatch(/mãezinha|mamãe|papai/i);
    expect(sql).not.toMatch(TRAVESSOES);
  });

  it("a página pública de candidatura nasce desligada", () => {
    expect(
      (PARAMETROS_RELACAO.talentos_pagina_publica as { ativa: boolean }).ativa,
    ).toBe(false);
  });

  it("o roteiro de seleção tem 26 perguntas em blocos e 10 critérios de 1 a 5", () => {
    const roteiro = PARAMETROS_RELACAO.talentos_roteiro as {
      escala: { min: number; max: number };
      blocos: { perguntas: { id: string }[] }[];
      criterios: { id: string }[];
    };
    const perguntas = roteiro.blocos.flatMap((b) =>
      b.perguntas.map((p) => p.id),
    );
    expect(perguntas).toHaveLength(26);
    expect(new Set(perguntas).size).toBe(26);
    expect(roteiro.criterios).toHaveLength(10);
    expect(roteiro.escala).toEqual({ min: 1, max: 5 });
  });

  it("o copiloto usa uma lista de termos assistenciais em parâmetro, sem acento e em minúsculas", () => {
    const termos = (
      PARAMETROS_RELACAO.copiloto as { termos_assistenciais: string[] }
    ).termos_assistenciais;
    expect(termos.length).toBeGreaterThan(10);
    for (const t of termos)
      expect(t).toBe(t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  });

  it("o aviso da vedação ética existe como texto a validar com o jurídico", () => {
    const aviso = TEXTOS_RELACAO.find(
      (t) => t.chave === "parceiros_aviso_vedacao",
    );
    expect(aviso?.texto).toMatch(/contrapartida financeira/);
    expect(aviso?.texto).toMatch(/jurídico/);
  });

  it("cada {variável} de um texto faz parte da lista declarada no seed", () => {
    // O seed declara as variáveis em array[...]; quem esquece uma quebra o envio.
    const bloco =
      /\('([a-z_0-9]+)',\s*'[a-z]+',\s*'[a-z]+',\s*(E?'(?:[^']|'')*'),\s*array\[([^\]]*)\]/g;
    let achou = 0;
    for (const m of sql.matchAll(bloco)) {
      const usadas = [...m[2]!.matchAll(/\{([a-z_]+)\}/g)].map((x) => x[1]!);
      const declaradas = [...m[3]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!);
      for (const v of usadas)
        expect(declaradas, `${m[1]}: {${v}}`).toContain(v);
      achou += 1;
    }
    expect(achou).toBeGreaterThan(20);
  });
});
