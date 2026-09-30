#!/usr/bin/env node
/**
 * Gera src/lib/dados/demonstracao/relacao-seed.gerado.ts a partir de
 * supabase/dados/relacao_seed.sql: os parâmetros (captação, marketing,
 * copiloto, portal da família, indicações, talentos) e os textos de
 * mensagem_modelo que o modo demonstração usa. Assim a demonstração e o
 * seed nunca divergem (nenhum texto nem limite escrito duas vezes à mão).
 *
 * Uso: node scripts/gerar-seed-relacao.mjs && npx prettier --write \
 *        src/lib/dados/demonstracao/relacao-seed.gerado.ts
 *
 * O teste src/lib/dados/demonstracao/relacao-seed.test.ts roda a mesma
 * extração e confere os dados com o arquivo gerado.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ARQUIVO_SQL = resolve(RAIZ, "supabase/dados/relacao_seed.sql");
export const ARQUIVO_SAIDA = resolve(
  RAIZ,
  "src/lib/dados/demonstracao/relacao-seed.gerado.ts",
);

/** Lê um literal SQL ('...' ou E'...') a partir de `i`; devolve [texto, próximo]. */
function lerLiteral(sql, i) {
  let escape = false;
  if (sql[i] === "E") {
    escape = true;
    i += 1;
  }
  if (sql[i] !== "'") throw new Error(`literal esperado na posição ${i}`);
  i += 1;
  let saida = "";
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") {
      if (sql[i + 1] === "'") {
        saida += "'";
        i += 2;
        continue;
      }
      return [saida, i + 1];
    }
    if (escape && c === "\\" && sql[i + 1] === "n") {
      saida += "\n";
      i += 2;
      continue;
    }
    saida += c;
    i += 1;
  }
  throw new Error("literal sem fim");
}

function pularEspacos(sql, i) {
  while (i < sql.length && /[\s]/.test(sql[i])) i += 1;
  return i;
}

/** Tira comentários de linha (-- ...) fora de literais. */
function semComentarios(sql) {
  let saida = "";
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'" || (sql[i] === "E" && sql[i + 1] === "'")) {
      const [, fim] = lerLiteral(sql, i);
      saida += sql.slice(i, fim);
      i = fim;
      continue;
    }
    if (sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    saida += sql[i];
    i += 1;
  }
  return saida;
}

export function extrairSeedRelacao(sqlBruto) {
  const sql = semComentarios(sqlBruto);
  const parametros = {};
  const textos = [];

  const blocoParametro = sql.indexOf("insert into parametro");
  if (blocoParametro < 0) throw new Error("bloco de parâmetros não achado");
  let i = sql.indexOf("values", blocoParametro) + "values".length;
  for (;;) {
    i = pularEspacos(sql, i);
    if (sql[i] !== "(") break;
    i += 1;
    i = pularEspacos(sql, i);
    const [chave, a] = lerLiteral(sql, i);
    i = pularEspacos(sql, a);
    if (sql[i] !== ",") throw new Error(`vírgula esperada após ${chave}`);
    i = pularEspacos(sql, i + 1);
    const [json, b] = lerLiteral(sql, i);
    parametros[chave] = JSON.parse(json);
    i = pularEspacos(sql, b);
    if (sql[i] !== ",") throw new Error(`descrição esperada após ${chave}`);
    i = pularEspacos(sql, i + 1);
    const [, c] = lerLiteral(sql, i);
    i = pularEspacos(sql, c);
    if (sql[i] !== ")") throw new Error(`fecha parêntese esperado em ${chave}`);
    i = pularEspacos(sql, i + 1);
    if (sql[i] === ",") {
      i += 1;
      continue;
    }
    break;
  }

  const blocoTexto = sql.indexOf("insert into mensagem_modelo");
  if (blocoTexto < 0) throw new Error("bloco de textos não achado");
  i = sql.indexOf("values", blocoTexto) + "values".length;
  for (;;) {
    i = pularEspacos(sql, i);
    if (sql[i] !== "(") break;
    i += 1;
    const campos = [];
    for (let n = 0; n < 4; n += 1) {
      i = pularEspacos(sql, i);
      const [valor, proximo] = lerLiteral(sql, i);
      campos.push(valor);
      i = pularEspacos(sql, proximo);
      if (sql[i] !== ",") throw new Error(`vírgula esperada em ${campos[0]}`);
      i += 1;
    }
    // array[...] e 'rascunho'
    const fim = sql.indexOf(")", sql.indexOf("'rascunho'", i));
    if (fim < 0) throw new Error(`tupla sem fim em ${campos[0]}`);
    i = pularEspacos(sql, fim + 1);
    textos.push({
      chave: campos[0],
      canal: campos[1],
      destinatario: campos[2],
      texto: campos[3],
    });
    if (sql[i] === ",") {
      i += 1;
      continue;
    }
    break;
  }
  return { parametros, textos };
}

export function montarModulo({ parametros, textos }) {
  return `// GERADO por scripts/gerar-seed-relacao.mjs a partir de
// supabase/dados/relacao_seed.sql. Não edite à mão: mude o seed e rode
// \`node scripts/gerar-seed-relacao.mjs\`. O teste relacao-seed.test.ts falha
// se os dados deste arquivo ficarem diferentes do seed.
import type { Json } from "@/lib/db/types";

export const PARAMETROS_RELACAO: Record<string, Json> = ${JSON.stringify(parametros, null, 2)};

export const TEXTOS_RELACAO: {
  chave: string;
  canal: string;
  destinatario: string;
  texto: string;
}[] = ${JSON.stringify(textos, null, 2)};
`;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const modulo = montarModulo(
    extrairSeedRelacao(readFileSync(ARQUIVO_SQL, "utf8")),
  );
  writeFileSync(ARQUIVO_SAIDA, modulo);
  console.log(`escrito ${ARQUIVO_SAIDA}`);
}
