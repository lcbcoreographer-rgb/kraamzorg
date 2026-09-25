// Monta um nó de fluxo n8n a partir de um tipo curto (ver `tipos-no.mjs`), da
// versão declarada em `config.nos` (copiada de `versoes-nos.json`) e de um id
// estável derivado do nome do fluxo e do nome do nó.
//
// Chaves como `onError`, `retryOnFail`, `maxTries`, `alwaysOutputData` e
// `continueOnFail` ficam no nível do nó, nunca dentro de `parameters`
// (`n8n/referencia/README.md`, armadilha 12; PRD 19.1).

import { TIPO_NO, chaveVersaoConfig } from './tipos-no.mjs';
import { idEstavel } from './id-estavel.mjs';

const CHAVES_NIVEL_NO = [
  'onError',
  'retryOnFail',
  'maxTries',
  'waitBetweenTries',
  'alwaysOutputData',
  'continueOnFail',
  'notes',
  'notesInFlow',
  'disabled',
  'webhookId',
  'credentials',
  'executeOnce',
];

export function versaoDoNo(config, tipoCurto) {
  const chave = chaveVersaoConfig(tipoCurto);
  const versao = config?.nos?.[chave]?.typeVersion;
  if (versao === undefined) {
    throw new Error(`config.nos nao declara a versao do tipo "${chave}" (nó de tipo curto "${tipoCurto}")`);
  }
  return versao;
}

export function criarNo({ fluxoChave, tipo, nome, config, parametros = {}, posicao = [0, 0], ...resto }) {
  const tipoCompleto = TIPO_NO[tipo];
  if (!tipoCompleto) {
    throw new Error(`tipo de nó desconhecido: "${tipo}"`);
  }

  const no = {
    id: idEstavel(`${fluxoChave}:no:${nome}`),
    name: nome,
    type: tipoCompleto,
    typeVersion: versaoDoNo(config, tipo),
    position: posicao,
    parameters: parametros,
  };

  for (const chave of CHAVES_NIVEL_NO) {
    if (resto[chave] !== undefined) {
      no[chave] = resto[chave];
    }
  }

  return no;
}

export function criarNotaCabecalho({ fluxoChave, config, titulo, descricao, posicao = [-1600, -200] }) {
  const conteudo = `## ${titulo}\n${descricao}\n\nGerado por n8n/build.mjs. Não edite na interface.`;
  return criarNo({
    fluxoChave,
    tipo: 'stickyNote',
    nome: 'Nota · Gerado pelo build',
    config,
    posicao,
    parametros: {
      content: conteudo,
      height: 200,
      width: 380,
      color: 4,
    },
  });
}
