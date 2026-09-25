/**
 * Só para testes: lê as linhas de `regra_alerta` do `supabase/seed.sql`,
 * para o motor ser testado com o mesmo JSON que o banco guarda (e o
 * catálogo de referência ser conferido contra ele). Nada de dado real: o
 * seed é sintético e o bloco lido é só o DOC 3.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LinhaRegraAlerta } from "./tipos";

const TEXTO_SQL = String.raw`'((?:[^']|'')*)'`;
const TEXTO_OU_NULO = String.raw`(null|'(?:[^']|'')*')`;
const LINHA = new RegExp(
  [
    String.raw`\(\s*'([A-Z]{2}-\d{2})'`,
    TEXTO_SQL,
    TEXTO_SQL,
    TEXTO_SQL,
    TEXTO_SQL,
    TEXTO_OU_NULO,
    TEXTO_OU_NULO,
    TEXTO_SQL,
    String.raw`(true|false)\s*\)`,
  ].join(String.raw`\s*,\s*`),
  "g",
);

function textoSql(bruto: string): string | null {
  if (bruto === "null") return null;
  return bruto.slice(1, -1).replace(/''/g, "'");
}

export function lerRegrasDoSeed(): LinhaRegraAlerta[] {
  // O Vitest roda a partir da raiz do repositório.
  const sql = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf8");
  const inicio = sql.indexOf("insert into regra_alerta");
  if (inicio < 0) throw new Error("seed.sql sem insert em regra_alerta");
  const fim = sql.indexOf(";\n", inicio);
  const bloco = sql.slice(inicio, fim);

  const linhas: LinhaRegraAlerta[] = [];
  for (const encontrado of bloco.matchAll(LINHA)) {
    // Todos os grupos da expressão são obrigatórios; o "" nunca aparece.
    const [
      ,
      id = "",
      grupo = "",
      descricao = "",
      severidade = "",
      conduta = "",
      campo = "null",
      condicao = "null",
      instrumentoVersao = "",
      ativa = "",
    ] = encontrado;
    const condicaoJson = textoSql(condicao);
    linhas.push({
      id,
      grupo: grupo.replace(/''/g, "'"),
      descricao: descricao.replace(/''/g, "'"),
      severidade,
      conduta: conduta.replace(/''/g, "'"),
      campo: textoSql(campo),
      condicao: condicaoJson === null ? null : JSON.parse(condicaoJson),
      instrumento_versao: instrumentoVersao,
      ativa: ativa === "true",
    });
  }
  return linhas;
}
