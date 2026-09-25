// Fluxo 1: Ingestão RAG (PRD 19.2). Nesta sessão (P23) só a máquina de build
// existe; os nós de indexação (4 a 11 do PRD 19.2) entram no P26. O esqueleto
// aqui já traz os três gatilhos reais do fluxo (manual, agendado e webhook de
// reindexação) porque eles não dependem de nenhum nó posterior.

import { criarNo, criarNotaCabecalho } from './lib/no.mjs';
import { aplicarConfiguracoesFluxo } from './lib/settings.mjs';
import { idEstavel } from './lib/id-estavel.mjs';

export const FLUXO_CHAVE = 'kraamzorg-fluxo-1-ingestao-rag';
export const NOME_FLUXO = 'Kraamzorg · Ingestão RAG (Base de Conhecimento)';

export function montarFluxo(config) {
  const fluxoChave = FLUXO_CHAVE;

  const nota = criarNotaCabecalho({
    fluxoChave,
    config,
    titulo: NOME_FLUXO,
    descricao:
      'Indexa só o conteúdo aprovado da base de conhecimento no PGVector, sem deixar a base vazia durante a reindexação (PRD 19.2). Esqueleto do P23: os nós de indexação entram no P26.',
    posicao: [-1600, -240],
  });

  const rodarManualmente = criarNo({
    fluxoChave,
    tipo: 'manualTrigger',
    nome: 'Rodar Manualmente',
    config,
    parametros: {},
    posicao: [-1600, 0],
  });

  const aCada6h = criarNo({
    fluxoChave,
    tipo: 'scheduleTrigger',
    nome: 'A Cada 6h',
    config,
    parametros: {
      rule: {
        interval: [{ field: 'hours', hoursInterval: 6 }],
      },
    },
    posicao: [-1600, 160],
  });

  const webhookReindexar = criarNo({
    fluxoChave,
    tipo: 'webhook',
    nome: 'Webhook Reindexar',
    config,
    parametros: {
      httpMethod: 'POST',
      path: config.webhooks.fluxo1Reindexar,
      authentication: 'none',
      responseMode: 'onReceived',
      options: {},
    },
    posicao: [-1600, 320],
    webhookId: idEstavel(`${fluxoChave}:webhookId:Webhook Reindexar`),
  });

  return {
    id: idEstavel(fluxoChave),
    name: NOME_FLUXO,
    nodes: [nota, rodarManualmente, aCada6h, webhookReindexar],
    connections: {},
    settings: aplicarConfiguracoesFluxo(config),
  };
}
