#!/usr/bin/env node
// comparar.mjs - importa um fluxo n8n, exporta de volta e lista as
// diferencas de parametros (e de chaves de nivel de no) entre o JSON de
// entrada e o JSON que o n8n devolveu depois de importar.
//
// Uso:
//   node comparar.mjs arquivo.json
//
// Sai com codigo 0 se nao houver diferenca, 1 se houver diferenca
// (nao é necessariamente um erro: parametro desconhecido some, ou vira
// padrao, sem quebrar a importacao; o script so torna essa mudanca visivel),
// 2 em erro de uso/execucao.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function achaN8nBin() {
  const local = path.join(scriptDir, "node_modules", ".bin", "n8n");
  if (existsSync(local)) return { cmd: local, args: [] };
  return { cmd: "npx", args: ["--yes", "n8n"] };
}

function rodar(cmd, args, env) {
  return execFileSync(cmd, args, {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function main() {
  const entrada = process.argv[2];
  if (!entrada) {
    console.error("uso: node comparar.mjs arquivo.json");
    process.exit(2);
  }
  if (!existsSync(entrada)) {
    console.error(`arquivo nao encontrado: ${entrada}`);
    process.exit(2);
  }

  const tmpHome = mkdtempSync(path.join(tmpdir(), "n8n-comparar-"));
  const exportDir = mkdtempSync(path.join(tmpdir(), "n8n-comparar-export-"));
  const exportFile = path.join(exportDir, "exportado.json");

  const env = {
    ...process.env,
    N8N_USER_FOLDER: tmpHome,
    N8N_DIAGNOSTICS_ENABLED: "false",
    N8N_VERSION_NOTIFICATIONS_ENABLED: "false",
    N8N_TEMPLATES_ENABLED: "false",
    DB_TYPE: "sqlite",
    N8N_RUNNERS_ENABLED: "false",
  };

  const { cmd, args } = achaN8nBin();

  try {
    console.error(`== importando ${entrada} ==`);
    rodar(cmd, [...args, "import:workflow", `--input=${entrada}`], env);

    console.error("== exportando de volta ==");
    rodar(cmd, [...args, "export:workflow", "--all", `--output=${exportFile}`], env);
  } catch (erro) {
    console.error("ERRO ao importar/exportar:");
    console.error(erro.stdout || "");
    console.error(erro.stderr || erro.message || String(erro));
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(exportDir, { recursive: true, force: true });
    process.exit(2);
  }

  const jsonEntrada = JSON.parse(readFileSync(entrada, "utf8"));
  let jsonSaida = JSON.parse(readFileSync(exportFile, "utf8"));
  // export:workflow --all grava um array de workflows; pega o que bate
  // pelo nome do fluxo de entrada (ou o primeiro, se so houver um).
  if (Array.isArray(jsonSaida)) {
    jsonSaida =
      jsonSaida.find((w) => w.name === jsonEntrada.name) ?? jsonSaida[0];
  }

  rmSync(tmpHome, { recursive: true, force: true });
  rmSync(exportDir, { recursive: true, force: true });

  if (!jsonSaida) {
    console.error("ERRO: export nao devolveu nenhum workflow");
    process.exit(2);
  }

  const diffs = compararFluxos(jsonEntrada, jsonSaida);

  if (diffs.length === 0) {
    console.log("nenhuma diferenca de parametros encontrada.");
    process.exit(0);
  }

  console.log(`${diffs.length} diferenca(s) encontrada(s):\n`);
  for (const d of diffs) {
    console.log(`- [${d.no}] ${d.caminho}`);
    console.log(`    entrada : ${formatar(d.entrada)}`);
    console.log(`    export  : ${formatar(d.saida)}`);
  }
  process.exit(1);
}

function formatar(v) {
  if (v === undefined) return "(ausente)";
  return JSON.stringify(v);
}

// Compara dois workflows no nivel de cada no: parametros e as chaves
// de nivel do no que importam para o build (onError, continueOnFail,
// alwaysOutputData, retryOnFail, typeVersion).
function compararFluxos(entrada, saida) {
  const diffs = [];
  const nosEntrada = new Map((entrada.nodes || []).map((n) => [n.name, n]));
  const nosSaida = new Map((saida.nodes || []).map((n) => [n.name, n]));

  for (const [nome, noEntrada] of nosEntrada) {
    const noSaida = nosSaida.get(nome);
    if (!noSaida) {
      diffs.push({ no: nome, caminho: "(no inteiro)", entrada: "presente", saida: undefined });
      continue;
    }

    if (noEntrada.typeVersion !== noSaida.typeVersion) {
      diffs.push({
        no: nome,
        caminho: "typeVersion",
        entrada: noEntrada.typeVersion,
        saida: noSaida.typeVersion,
      });
    }

    for (const chave of ["onError", "continueOnFail", "alwaysOutputData", "retryOnFail", "maxTries", "waitBetweenTries"]) {
      if (JSON.stringify(noEntrada[chave]) !== JSON.stringify(noSaida[chave])) {
        diffs.push({
          no: nome,
          caminho: chave,
          entrada: noEntrada[chave],
          saida: noSaida[chave],
        });
      }
    }

    diffParametros(nome, "parameters", noEntrada.parameters || {}, noSaida.parameters || {}, diffs);
  }

  for (const nome of nosSaida.keys()) {
    if (!nosEntrada.has(nome)) {
      diffs.push({ no: nome, caminho: "(no inteiro)", entrada: undefined, saida: "presente" });
    }
  }

  return diffs;
}

function diffParametros(no, prefixo, a, b, diffs) {
  const chaves = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const chave of chaves) {
    const caminho = `${prefixo}.${chave}`;
    const va = a?.[chave];
    const vb = b?.[chave];
    const ehObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

    if (ehObjeto(va) && ehObjeto(vb)) {
      diffParametros(no, caminho, va, vb, diffs);
      continue;
    }

    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diffs.push({ no, caminho, entrada: va, saida: vb });
    }
  }
}

main();
