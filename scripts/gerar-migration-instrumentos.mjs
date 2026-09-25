#!/usr/bin/env node
/**
 * Gera supabase/migrations/0045_instrumentos_v1.sql a partir das definições
 * em supabase/dados/instrumentos/doc1.json a doc4.json (P34 item 2).
 *
 * O JSON é a fonte; a migration é derivada e nunca editada à mão. O teste
 * src/lib/instrumentos/migration.test.ts confere que as duas coisas batem.
 * Depois de aplicada, a migration não muda mais: versão nova do
 * instrumento entra por migration nova (CLAUDE.md, "Banco e dados").
 *
 * Uso: node scripts/gerar-migration-instrumentos.mjs [--conferir]
 *   --conferir  não grava; sai com código 1 se o arquivo estiver diferente.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_DADOS = join(RAIZ, "supabase", "dados", "instrumentos");
const DESTINO = join(
  RAIZ,
  "supabase",
  "migrations",
  "0045_instrumentos_v1.sql",
);
const ARQUIVOS = ["doc1.json", "doc2.json", "doc3.json", "doc4.json"];
const DELIMITADOR = "$instrumento$";

export function gerarMigration() {
  const definicoes = ARQUIVOS.map((arquivo) => {
    const texto = readFileSync(join(PASTA_DADOS, arquivo), "utf-8");
    const json = JSON.parse(texto);
    const corpo = JSON.stringify(json, null, 2);
    if (corpo.includes(DELIMITADOR)) {
      throw new Error(`${arquivo} contém o delimitador ${DELIMITADOR}`);
    }
    return { arquivo, json, corpo };
  });

  const linhas = [
    "-- =============================================================================",
    "-- 0045_instrumentos_v1.sql",
    "--",
    "-- P34 (PROMPTS.md v2) · PRD 6.5 (instrumento), 9.1 a 9.4 e Apêndice B",
    "--",
    "-- Migration de dados. Carrega a definição v1 dos quatro instrumentos",
    "-- clínicos (DOC 1 a DOC 4) com vigente = false: nenhuma versão vale até a",
    '-- coordenação aprovar na tela de instrumentos (PRD 9, CLAUDE.md, "Clínico").',
    "--",
    "-- GERADA por scripts/gerar-migration-instrumentos.mjs a partir de",
    "-- supabase/dados/instrumentos/doc1.json a doc4.json. Não edite à mão.",
    "--",
    "-- Conflito com (codigo, versao) já existente: só substitui a definição",
    '-- provisória sem blocos que o seed.sql do P08 deixou ("definição completa',
    '-- fica para o P34"), e só se ela nunca foi aprovada. Versão aprovada ou com',
    "-- conteúdo real fica intacta.",
    "--",
    "-- Revisão humana do SQL antes de qualquer db push (CLAUDE.md).",
    "-- =============================================================================",
    "",
  ];

  for (const { arquivo, json, corpo } of definicoes) {
    linhas.push(
      `-- ${json.codigo} ${json.versao} · ${json.titulo} (${arquivo})`,
      "insert into public.instrumento (codigo, versao, definicao, vigente)",
      `values ('${json.codigo}', '${json.versao}', ${DELIMITADOR}${corpo}${DELIMITADOR}::jsonb, false)`,
      "on conflict (codigo, versao) do update",
      "  set definicao = excluded.definicao,",
      "      vigente = false",
      "  where public.instrumento.aprovado_em is null",
      "    and coalesce(jsonb_array_length(public.instrumento.definicao -> 'blocos'), 0) = 0;",
      "",
    );
  }

  return linhas.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sql = gerarMigration();
  if (process.argv.includes("--conferir")) {
    const atual = readFileSync(DESTINO, "utf-8");
    if (atual !== sql) {
      console.error(
        "0045_instrumentos_v1.sql está diferente dos JSON. Rode o gerador.",
      );
      process.exit(1);
    }
    console.log("0045_instrumentos_v1.sql confere com os JSON.");
  } else {
    writeFileSync(DESTINO, sql);
    console.log(`Gravado ${DESTINO}`);
  }
}
