// Fluxo 2: Pausar IA e Notificar Equipe (PRD 19.3). Sub-fluxo chamado pelas
// ferramentas do agente e pelos caminhos determinísticos do fluxo 3. Nesta
// sessão (P23) só o gatilho de entrada existe, com os campos exatos do
// PRD 19.3; os nós 2 a 19 entram no P24.

import { criarNo, criarNotaCabecalho } from './lib/no.mjs';
import { aplicarConfiguracoesFluxo } from './lib/settings.mjs';
import { idEstavel } from './lib/id-estavel.mjs';

export const FLUXO_CHAVE = 'kraamzorg-fluxo-2-pausar-notificar-equipe';
export const NOME_FLUXO = 'Kraamzorg · Pausar IA e Notificar Equipe';

// Entradas do sub-fluxo, exatamente como o PRD 19.3 descreve: "acao, wa_jid,
// conversa_id, nome, motivo (enum handoff_motivo), resumo, solicitacao,
// dados (JSON), texto_familia, chave_texto, enviar_texto (booleano),
// origem_chamada".
const ENTRADAS = [
  { name: 'acao', type: 'string' },
  { name: 'wa_jid', type: 'string' },
  { name: 'conversa_id', type: 'string' },
  { name: 'nome', type: 'string' },
  { name: 'motivo', type: 'string' },
  { name: 'resumo', type: 'string' },
  { name: 'solicitacao', type: 'string' },
  { name: 'dados', type: 'object' },
  { name: 'texto_familia', type: 'string' },
  { name: 'chave_texto', type: 'string' },
  { name: 'enviar_texto', type: 'boolean' },
  { name: 'origem_chamada', type: 'string' },
];

export function montarFluxo(config) {
  const fluxoChave = FLUXO_CHAVE;

  const nota = criarNotaCabecalho({
    fluxoChave,
    config,
    titulo: NOME_FLUXO,
    descricao:
      'Sub-fluxo chamado por transferir_para_equipe, acionar_equipe_saude e pelos caminhos determinísticos do fluxo 3 (PRD 19.3). Único lugar que envia o texto fixo de saúde ou perda. Esqueleto do P23: os nós 2 a 19 entram no P24.',
    posicao: [-1600, -240],
  });

  const quandoChamado = criarNo({
    fluxoChave,
    tipo: 'executeWorkflowTrigger',
    nome: 'Quando Chamado',
    config,
    parametros: {
      inputSource: 'workflowInputs',
      workflowInputs: { values: ENTRADAS },
    },
    posicao: [-1600, 0],
  });

  return {
    id: idEstavel(fluxoChave),
    name: NOME_FLUXO,
    nodes: [nota, quandoChamado],
    connections: {},
    settings: aplicarConfiguracoesFluxo(config),
  };
}
