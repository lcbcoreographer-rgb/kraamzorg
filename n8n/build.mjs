#!/usr/bin/env node
// Gera os três JSON dos fluxos n8n do agente a partir do repositório (PRD 19,
// P23). Lê o config do ambiente com `--env`, monta os fluxos a partir de
// `n8n/src/fluxo-*.mjs`, aplica as configurações do 19.1 e grava
// `n8n/dist/*.json`. Nunca monta fluxo pela interface (CLAUDE.md).
//
// Uso:
//   node n8n/build.mjs --env hml
//   node n8n/build.mjs --env prod
//   node n8n/build.mjs --env hml --config /caminho/fora/do/repo/config.hml.json --saida /caminho/temporario
//
// `--config` lê o config de fora do repositório (o arquivo do cofre, ou uma
// cópia temporária) e `--saida` grava os JSON numa pasta própria em vez de
// `n8n/dist/`; sem os dois, vale o padrão do PRD 19.5 (`n8n/config.{env}.json`
// e `n8n/dist/`, ambos fora do git).
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

// [P25] Envio e transcrição simulados só existem em homologação (P25 item
// 5): um build de produção com qualquer um ligado mandaria as mensagens da
// família para a rota de captura, e ninguém receberia nada.
export function conferirHomologacao(config, env) {
  const homologacao = config?.homologacao ?? {};
  if (env === 'prod' && (homologacao.envioSimulado === true || homologacao.transcricaoSimulada === true)) {
    throw new Error('produção com homologacao.envioSimulado ou homologacao.transcricaoSimulada ligado: desligue os dois no config.prod.json');
  }
}

// Monta os três fluxos (objetos JS, sem gravar nada) a partir do config já
// carregado. É a função que os testes chamam diretamente.
export function gerarFluxos(config, env) {
  conferirHomologacao(config, env);
  const fluxo1 = montarFluxo1(config);
  const fluxo2 = montarFluxo2(config);
  const fluxo3 = montarFluxo3(config);

  return {
    fluxo1: { ...fluxo1, name: nomeFluxoComAmbiente(fluxo1.name, env) },
    fluxo2: { ...fluxo2, name: nomeFluxoComAmbiente(fluxo2.name, env) },
    fluxo3: { ...fluxo3, name: nomeFluxoComAmbiente(fluxo3.name, env) },
  };
}

const USO = 'uso: node n8n/build.mjs --env <hml|prod> [--config <arquivo>] [--saida <pasta>]';

export function lerArgumentos(argv) {
  const valorDe = (opcao, obrigatoria) => {
    const indice = argv.indexOf(opcao);
    if (indice === -1) {
      if (obrigatoria) throw new Error(USO);
      return null;
    }
    const valor = argv[indice + 1];
    if (!valor || valor.startsWith('--')) throw new Error(USO);
    return valor;
  };
  return { env: valorDe('--env', true), caminhoConfig: valorDe('--config', false), dirSaida: valorDe('--saida', false) };
}

export async function gravarDist({ raizN8n, fluxos, env, log = console.log, dirSaida = null }) {
  const dirDist = dirSaida ? path.resolve(dirSaida) : path.join(raizN8n, 'dist');
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

export async function build({ env, raizN8n = AQUI, log = console.log, logAviso = console.error, caminhoConfig = null, dirSaida = null }) {
  const { config, origem, usouExample } = await carregarConfig(env, raizN8n, { log: logAviso, caminho: caminhoConfig });
  log(`config: ${origem}${usouExample ? ' (exemplo)' : ''}`);

  const fluxos = gerarFluxos(config, env);
  return gravarDist({ raizN8n, fluxos, env, log, dirSaida });
}

async function main() {
  const { env, caminhoConfig, dirSaida } = lerArgumentos(process.argv.slice(2));
  await build({ env, caminhoConfig, dirSaida });
}

const ehExecucaoDireta = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (ehExecucaoDireta) {
  main().catch((erro) => {
    console.error(`build falhou: ${erro.message}`);
    process.exitCode = 1;
  });
}
