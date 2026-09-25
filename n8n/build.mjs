#!/usr/bin/env node
// Gera os três JSON dos fluxos n8n do agente a partir do repositório (PRD 19,
// P23). Lê o config do ambiente com `--env`, monta os fluxos a partir de
// `n8n/src/fluxo-*.mjs`, aplica as configurações do 19.1 e grava
// `n8n/dist/*.json`. Nunca monta fluxo pela interface (CLAUDE.md).
//
// Uso:
//   node n8n/build.mjs --env hml
//   node n8n/build.mjs --env prod
//
// Este arquivo também é importável como módulo (os testes de
// `build.test.mjs` chamam `gerarFluxos`, `nomeArquivoDist` etc. diretamente,
// sem passar pelo disco).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { carregarConfig } from './src/lib/config.mjs';
import { montarFluxo as montarFluxo1 } from './src/fluxo-1-ingestao-rag.mjs';
import { montarFluxo as montarFluxo2 } from './src/fluxo-2-pausar-notificar.mjs';
import { montarFluxo as montarFluxo3 } from './src/fluxo-3-agente-isadora.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// Nome base de cada arquivo gerado, exatamente como a tabela do PRD 19 lista
// ("Arquivo gerado"), sem a extensão.
export const ARQUIVOS_DIST = {
  fluxo1: 'kraamzorg-ingestao-rag',
  fluxo2: 'kraamzorg-pausar-ia-notificar-equipe',
  fluxo3: 'kraamzorg-agente-isadora',
};

// Em homologação o nome do arquivo (e o nome do fluxo dentro do n8n) leva
// "(HML)", para não confundir com produção quando os dois existem na mesma
// instância de teste (P23 item 2: "grava n8n/dist/*.json com (HML) no nome
// em homologação").
export function nomeArquivoDist(nomeBase, env) {
  const sufixo = env === 'prod' ? '' : ' (HML)';
  return `${nomeBase}${sufixo}.json`;
}

export function nomeFluxoComAmbiente(nomeFluxo, env) {
  return env === 'prod' ? nomeFluxo : `${nomeFluxo} (HML)`;
}

// Monta os três fluxos (objetos JS, sem gravar nada) a partir do config já
// carregado. É a função que os testes chamam diretamente.
export function gerarFluxos(config, env) {
  const fluxo1 = montarFluxo1(config);
  const fluxo2 = montarFluxo2(config);
  const fluxo3 = montarFluxo3(config);

  return {
    fluxo1: { ...fluxo1, name: nomeFluxoComAmbiente(fluxo1.name, env) },
    fluxo2: { ...fluxo2, name: nomeFluxoComAmbiente(fluxo2.name, env) },
    fluxo3: { ...fluxo3, name: nomeFluxoComAmbiente(fluxo3.name, env) },
  };
}

function parseArgsEnv(argv) {
  const indice = argv.indexOf('--env');
  if (indice === -1 || indice === argv.length - 1) {
    throw new Error('uso: node n8n/build.mjs --env <hml|prod>');
  }
  return argv[indice + 1];
}

export async function gravarDist({ raizN8n, fluxos, env, log = console.log }) {
  const dirDist = path.join(raizN8n, 'dist');
  await mkdir(dirDist, { recursive: true });

  const gravados = [];
  for (const [chave, nomeBase] of Object.entries(ARQUIVOS_DIST)) {
    const nomeArquivo = nomeArquivoDist(nomeBase, env);
    const caminho = path.join(dirDist, nomeArquivo);
    const conteudo = `${JSON.stringify(fluxos[chave], null, 2)}\n`;
    await writeFile(caminho, conteudo, 'utf8');
    gravados.push(caminho);
    log(`gravado: ${caminho}`);
  }
  return gravados;
}

export async function build({ env, raizN8n = AQUI, log = console.log, logAviso = console.error }) {
  const { config, origem, usouExample } = await carregarConfig(env, raizN8n, { log: logAviso });
  log(`config: ${origem}${usouExample ? ' (exemplo)' : ''}`);

  const fluxos = gerarFluxos(config, env);
  return gravarDist({ raizN8n, fluxos, env, log });
}

async function main() {
  const env = parseArgsEnv(process.argv.slice(2));
  await build({ env });
}

const ehExecucaoDireta = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (ehExecucaoDireta) {
  main().catch((erro) => {
    console.error(`build falhou: ${erro.message}`);
    process.exitCode = 1;
  });
}
