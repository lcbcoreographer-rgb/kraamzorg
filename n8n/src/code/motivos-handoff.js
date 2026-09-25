// Tabelas de motivo do handoff usadas pelas regras puras do fluxo 2 (PRD 11.4
// e 19.3). Sem texto para família ou equipe: só nomes de enum, prioridade e
// ordem. A matriz completa (destino, SLA) mora em `parametro.handoff_matriz`
// e é aplicada por `agente.registrar_handoff`; aqui fica só o que o fluxo
// precisa decidir antes de chamar o banco.

// Enum `handoff_motivo` do PRD (capítulo 5), na mesma ordem.
export const HANDOFF_MOTIVOS = [
  'contratar',
  'reuniao',
  'condicao_comercial',
  'cobertura_taxa',
  'reembolso_fiscal',
  'bebe_nasceu',
  'pos_venda_operacao',
  'duvida_sem_resposta',
  'saude',
  'perda',
  'reclamacao',
  'pediu_humano',
  'parceiro_medico',
  'midia_recebida',
  'validacao_resposta',
  'estado_sensivel_escreveu',
  'outro',
  'audio_nao_transcrito',
];

// Ações de entrada do fluxo 2 (PRD 19.3, "Entradas").
export const ACOES_HANDOFF = ['transferir', 'alerta_saude', 'perda'];
export const ACOES_ALERTA = ['alerta_saude', 'perda'];

// Chaves de texto de alerta aceitas por `agente.mensagem_alerta` (Apêndice A).
export const CHAVES_TEXTO_ALERTA = [
  'alerta_saude',
  'alerta_internacao',
  'alerta_emocional',
  'alerta_saude_sensivel',
  'perda',
];

// Valores de `origem_chamada` (PRD 19.3).
export const ORIGENS_CHAMADA = ['agente', 'filtro_termos', 'classificador', 'agendado', 'sistema'];

// Motivos comerciais: a mesma lista de `n8n/prompts/classificar-pedido.md`
// (PRD 19.3). Só entre eles o classificador de pedido troca o destino.
export const MOTIVOS_COMERCIAIS = [
  'contratar',
  'reuniao',
  'condicao_comercial',
  'cobertura_taxa',
  'reembolso_fiscal',
  'parceiro_medico',
  'duvida_sem_resposta',
  'outro',
];

// Motivos em que o nó 5 "Pular Classificador?" pula o classificador mesmo
// quando a chamada veio do agente (PRD 19.3, nó 5).
export const MOTIVOS_SEM_CLASSIFICADOR = [
  'estado_sensivel_escreveu',
  'midia_recebida',
  'validacao_resposta',
  'pediu_humano',
  'reclamacao',
  'bebe_nasceu',
];

// Motivos que nunca são deduplicados: repetidos, reaproveitam o handoff
// aberto e sempre avisam o grupo e o plantão de novo (PRD 19.3, nós 12 e 15).
export const MOTIVOS_NUNCA_DEDUPLICADOS = ['saude', 'perda', 'estado_sensivel_escreveu'];

// Prioridade da 11.4 em número (maior = mais urgente). `midia_recebida` é
// normal para lead e alta para cliente; aqui vale o piso (normal), e o banco
// sobe conforme a ficha.
export const NIVEIS_PRIORIDADE = { normal: 1, alta: 2, maxima: 3 };

export const PRIORIDADE_MOTIVO = {
  saude: 'maxima',
  perda: 'maxima',
  contratar: 'alta',
  reuniao: 'alta',
  pediu_humano: 'alta',
  bebe_nasceu: 'alta',
  reclamacao: 'alta',
  estado_sensivel_escreveu: 'alta',
  validacao_resposta: 'alta',
  audio_nao_transcrito: 'alta',
  condicao_comercial: 'normal',
  cobertura_taxa: 'normal',
  reembolso_fiscal: 'normal',
  duvida_sem_resposta: 'normal',
  pos_venda_operacao: 'normal',
  parceiro_medico: 'normal',
  midia_recebida: 'normal',
  outro: 'normal',
};

// Desempate entre tipos, em ordem de urgência (PRD 19.3, v4.2): perda,
// saude, reclamacao, pediu_humano, bebe_nasceu, contratar, reuniao,
// condicao_comercial e os demais. É a mesma ordem da frase "escolha o mais
// urgente nesta ordem" de `classificar-pedido.md`; o teste compara as duas.
export const ORDEM_URGENCIA = [
  'perda',
  'saude',
  'reclamacao',
  'pediu_humano',
  'bebe_nasceu',
  'contratar',
  'reuniao',
  'condicao_comercial',
];

export function prioridadeDoMotivo(motivo) {
  return PRIORIDADE_MOTIVO[motivo] ?? 'normal';
}

export function nivelPrioridade(prioridade) {
  return NIVEIS_PRIORIDADE[prioridade] ?? NIVEIS_PRIORIDADE.normal;
}

// A mais alta de duas prioridades (texto do enum `prioridade`).
export function maiorPrioridade(a, b) {
  return nivelPrioridade(a) >= nivelPrioridade(b) ? a : b;
}

// Posição na ordem de urgência (menor = mais urgente); fora da lista vem
// depois de todos, empatados.
export function posicaoUrgencia(motivo) {
  const indice = ORDEM_URGENCIA.indexOf(motivo);
  return indice === -1 ? ORDEM_URGENCIA.length : indice;
}

// Compara dois motivos pela urgência: prioridade da 11.4 primeiro, ordem de
// desempate depois. Negativo quando `a` é mais urgente que `b`.
export function compararUrgencia(a, b) {
  const porPrioridade = nivelPrioridade(prioridadeDoMotivo(b)) - nivelPrioridade(prioridadeDoMotivo(a));
  if (porPrioridade !== 0) return porPrioridade;
  return posicaoUrgencia(a) - posicaoUrgencia(b);
}

export function ehAcaoDeAlerta(acao) {
  return ACOES_ALERTA.includes(acao);
}
