// Construtor de fluxo usado pelo fluxo 3 (P25): nós e conexões declarados em
// código, com as convenções do PRD 19.1 num lugar só (Postgres com
// parâmetros em lista, chamadas externas com `onError`, credenciais só por id
// e nome do config, If e Switch com validação estrita).

import path from 'node:path';

import { criarNo } from './no.mjs';
import { idEstavel } from './id-estavel.mjs';
import { embutirCodigoComDependencias } from './codigo-embutido.mjs';

export function credencialDoConfig(config, chave) {
  const { id, name } = config.credenciais[chave];
  return { id, name };
}

const OPCOES_CONDICAO = { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 };

export function criarConstrutor({ fluxoChave, config, dirCode }) {
  const nos = [];
  const conexoes = {};

  const adicionar = (no) => {
    if (nos.some((existente) => existente.name === no.name)) {
      throw new Error(`nó repetido no fluxo: "${no.name}"`);
    }
    nos.push(no);
    return no;
  };

  const ligar = (origem, destino, saida = 0) => {
    conexoes[origem] ??= {};
    conexoes[origem].main ??= [];
    const saidas = conexoes[origem].main;
    while (saidas.length <= saida) saidas.push([]);
    saidas[saida].push({ node: destino, type: 'main', index: 0 });
  };

  // Conexão de sub-nó de IA (modelo, memória, ferramenta, embeddings).
  const ligarIA = (origem, destino, tipo) => {
    conexoes[origem] ??= {};
    conexoes[origem][tipo] ??= [[]];
    conexoes[origem][tipo][0].push({ node: destino, type: tipo, index: 0 });
  };

  const no = (tipo, nome, parametros, posicao, extras = {}) =>
    adicionar(criarNo({ fluxoChave, tipo, nome, config, posicao, parametros, ...extras }));

  const code = (nome, arquivo, chamada, posicao, { modo = 'runOnceForEachItem' } = {}) =>
    no(
      'code',
      nome,
      {
        mode: modo,
        language: 'javaScript',
        jsCode: arquivo
          ? embutirCodigoComDependencias({ caminhoArquivo: path.join(dirCode, arquivo), chamada })
          : `${chamada.trim()}\n`,
      },
      posicao,
    );

  const condicao = (chave, expressao, operador, direita) => ({
    id: idEstavel(`${fluxoChave}:condicao:${chave}`),
    leftValue: `={{ ${expressao} }}`,
    rightValue: direita,
    operator: operador,
  });

  // If com uma condição booleana (`expressao` devolve true ou false).
  const se = (nome, expressao, posicao) =>
    no(
      'if',
      nome,
      {
        conditions: {
          options: OPCOES_CONDICAO,
          conditions: [condicao(nome, expressao, { type: 'boolean', operation: 'true', singleValue: true }, true)],
          combinator: 'and',
        },
        looseTypeValidation: false,
        options: {},
      },
      posicao,
    );

  // Switch por igualdade de texto: uma saída por rótulo, na ordem; o que não
  // casa com nenhum rótulo para (fallback none).
  const escolha = (nome, expressao, rotulos, posicao) =>
    no(
      'switch',
      nome,
      {
        mode: 'rules',
        rules: {
          values: rotulos.map((rotulo) => ({
            conditions: {
              options: OPCOES_CONDICAO,
              conditions: [condicao(`${nome}:${rotulo}`, expressao, { type: 'string', operation: 'equals' }, rotulo)],
              combinator: 'and',
            },
            renameOutput: true,
            outputKey: rotulo,
          })),
        },
        options: { fallbackOutput: 'none' },
      },
      posicao,
    );

  // Postgres: `query` literal e parâmetros como expressão que devolve lista
  // (PRD 19.1, armadilha 1).
  const postgres = (nome, query, listaParametros, posicao, extra = {}) =>
    no(
      'postgres',
      nome,
      {
        resource: 'database',
        operation: 'executeQuery',
        query,
        options: listaParametros.length > 0 ? { queryReplacement: `={{ [ ${listaParametros.join(', ')} ] }}` } : {},
      },
      posicao,
      {
        credentials: { postgres: credencialDoConfig(config, 'postgres') },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        ...extra,
      },
    );

  return { nos, conexoes, adicionar, ligar, ligarIA, no, code, se, escolha, postgres };
}
