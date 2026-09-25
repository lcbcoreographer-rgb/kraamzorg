// Fluxo 3: Agente Isadora, entrada via webhook (PRD 19.4). Nesta sessão
// (P23) só os dois gatilhos de entrada existem (entrada A: webhook da
// UAZAPI; entrada B: follow-up agendado a cada 30 min); os nós 2 a 41 entram
// no P25.

import { criarNo, criarNotaCabecalho } from './lib/no.mjs';
import { aplicarConfiguracoesFluxo } from './lib/settings.mjs';
import { idEstavel } from './lib/id-estavel.mjs';

export const FLUXO_CHAVE = 'kraamzorg-fluxo-3-agente-isadora';
export const NOME_FLUXO = 'Kraamzorg · Agente Isadora (Entrada via Webhook)';

export function montarFluxo(config) {
  const fluxoChave = FLUXO_CHAVE;

  const nota = criarNotaCabecalho({
    fluxoChave,
    config,
    titulo: NOME_FLUXO,
    descricao:
      'O filtro de saúde roda antes de qualquer decisão de modo, em todo modo menos desligado (PRD 19.4). Esqueleto do P23: os nós 2 a 41 (entradas A e B completas) entram no P25.',
    posicao: [-1600, -240],
  });

  const webhookUazapi = criarNo({
    fluxoChave,
    tipo: 'webhook',
    nome: 'Webhook UAZAPI',
    config,
    parametros: {
      httpMethod: 'POST',
      path: config.webhooks.fluxo3Entrada,
      authentication: 'none',
      responseMode: 'onReceived',
      options: {},
    },
    posicao: [-1600, 0],
    webhookId: idEstavel(`${fluxoChave}:webhookId:Webhook UAZAPI`),
  });

  const aCada30Min = criarNo({
    fluxoChave,
    tipo: 'scheduleTrigger',
    nome: 'A Cada 30 Min',
    config,
    parametros: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 30 }],
      },
    },
    posicao: [-1600, 400],
  });

  return {
    id: idEstavel(fluxoChave),
    name: NOME_FLUXO,
    nodes: [nota, webhookUazapi, aCada30Min],
    connections: {},
    settings: aplicarConfiguracoesFluxo(config),
  };
}
