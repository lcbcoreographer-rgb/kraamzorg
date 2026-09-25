// Regra do nó 5 "Pular Classificador?" do fluxo 2 (PRD 19.3). Função pura:
// o build embute este arquivo nos nós Code que montam o estado do fluxo
// (Normalizar Entrada, Subir para Alerta) e o nó If só lê o booleano
// `pular_classificador`; os testes importam a mesma função.
//
// Pula o classificador de pedido quando:
// - a ação é de alerta (`alerta_saude` ou `perda`): o alerta já está decidido
//   e o classificador nunca rebaixa alerta;
// - `origem_chamada` não é `agente`: caminhos determinísticos do fluxo 3
//   (filtro de termos, classificador de mensagem, agendado, sistema);
// - o motivo é `estado_sensivel_escreveu`, `midia_recebida`,
//   `validacao_resposta`, `pediu_humano`, `reclamacao` ou `bebe_nasceu`.

import { MOTIVOS_SEM_CLASSIFICADOR, ehAcaoDeAlerta } from './motivos-handoff.js';

export function pularClassificador({ acao, origem_chamada: origemChamada, motivo } = {}) {
  if (ehAcaoDeAlerta(acao)) {
    return { pular: true, razao: 'acao_de_alerta' };
  }
  if (origemChamada !== 'agente') {
    return { pular: true, razao: 'origem_nao_agente' };
  }
  if (MOTIVOS_SEM_CLASSIFICADOR.includes(motivo)) {
    return { pular: true, razao: 'motivo_sem_classificador' };
  }
  return { pular: false, razao: 'classificar' };
}
