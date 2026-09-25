// Carrega a configuração do ambiente para o build (PRD 19.5, P23 item 1).
//
// `n8n/config.{env}.json` é o único arquivo com segredo real, fora do git
// (CLAUDE.md, "n8n/config.*.json (menos o example) e n8n/dist fora do git").
// `n8n/config.example.json` é o único versionado, com valores de exemplo
// óbvios. Quando `config.{env}.json` não existe (máquina de desenvolvimento
// sem o cofre), o build usa o example para `--env hml`, nunca para
// `--env prod`, e avisa alto no console: gerar um JSON com segredo de
// exemplo em homologação é seguro, gerar um "prod" com segredo de exemplo
// seria um jeito fácil de publicar o exemplo por engano.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const AMBIENTES_VALIDOS = ['hml', 'prod'];

export function caminhoConfig(env, raizN8n) {
  return path.join(raizN8n, `config.${env}.json`);
}

export function caminhoConfigExample(raizN8n) {
  return path.join(raizN8n, 'config.example.json');
}

async function lerJson(caminho) {
  const conteudo = await readFile(caminho, 'utf8');
  return JSON.parse(conteudo);
}

async function existe(caminho) {
  try {
    await readFile(caminho);
    return true;
  } catch {
    return false;
  }
}

// `caminho` (opcional, `--config` do build): lê o config de um arquivo fora
// do repositório (o do cofre, ou uma cópia temporária), para o config real
// nunca precisar ficar dentro de `n8n/`. Em produção, apontar para o
// `config.example.json` é recusado do mesmo jeito.
export async function carregarConfig(env, raizN8n, { log = console.error, caminho = null } = {}) {
  if (!AMBIENTES_VALIDOS.includes(env)) {
    throw new Error(`ambiente invalido: "${env}" (esperado um de ${AMBIENTES_VALIDOS.join(', ')})`);
  }

  const caminhoExample = caminhoConfigExample(raizN8n);

  if (caminho) {
    const escolhido = path.resolve(caminho);
    if (env === 'prod' && (escolhido === path.resolve(caminhoExample) || path.basename(escolhido) === 'config.example.json')) {
      throw new Error('producao nunca usa n8n/config.example.json (segredo de exemplo), nem pelo --config');
    }
    if (!(await existe(escolhido))) {
      throw new Error(`config nao encontrado: ${escolhido}`);
    }
    return { config: await lerJson(escolhido), origem: escolhido, usouExample: escolhido === path.resolve(caminhoExample) };
  }

  const caminhoReal = caminhoConfig(env, raizN8n);

  if (await existe(caminhoReal)) {
    const config = await lerJson(caminhoReal);
    return { config, origem: caminhoReal, usouExample: false };
  }

  if (env === 'prod') {
    throw new Error(
      `n8n/config.prod.json nao encontrado. Producao nunca usa n8n/config.example.json (segredo de exemplo). ` +
        `Traga o config real do cofre da Kraamzorg antes de rodar "--env prod".`,
    );
  }

  if (!(await existe(caminhoExample))) {
    throw new Error(`nem n8n/config.${env}.json nem n8n/config.example.json foram encontrados em ${raizN8n}`);
  }

  log(
    `aviso: n8n/config.${env}.json nao encontrado; usando n8n/config.example.json (valores de exemplo, nunca reais) ` +
      `para o build de "${env}".`,
  );
  const config = await lerJson(caminhoExample);
  return { config, origem: caminhoExample, usouExample: true };
}
