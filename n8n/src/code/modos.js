// Modos em que o texto de alerta (e o de áudio não transcrito) sai para a
// família (PRD 19.4 nó 20, v4.2). Fora da lista: teste fora da lista,
// humano_nominal (salvo alerta_saude_sensivel), banco fora do ar e modo
// desconhecido, em que só a equipe é avisada. Arquivo pequeno de propósito:
// entra em vários nós Code do fluxo 3.

export const MODOS_COM_TEXTO_DE_ALERTA = ['vendas', 'cliente', 'pausado', 'nao_lead', 'humano_comercial'];
export const MODOS_DO_AGENTE = ['vendas', 'cliente'];

export function enviarTextoPorModo(modo) {
  return MODOS_COM_TEXTO_DE_ALERTA.includes(modo);
}
