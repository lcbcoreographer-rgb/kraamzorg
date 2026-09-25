// Nó 8 "Ler Classificação" do fluxo 2, depois do classificador de pedido
// (`n8n/prompts/classificar-pedido.md`, PRD 19.3). Função pura: recebe o
// motivo que o agente informou e a saída bruta do classificador, devolve o
// motivo final, a decisão e a prioridade mínima que o banco deve respeitar.
// O build embute este arquivo no nó Code; os testes importam a mesma função.
//
// Regras (PRD 19.3, "Regras do Ler Classificação", v4.2):
// - Classificador falhou ou devolveu tipo inválido: vale o motivo do agente,
//   marcado `classificador_falhou`.
// - O classificador pode subir para `saude` ou `perda`, nunca descer. Subiu:
//   segue pelo nó 8a (texto à família antes do registro).
// - Conversa já marcada como não lead no banco continua não lead (salvo
//   subida para saúde ou perda, que sempre vence).
// - `sem_aviso` e `nao_lead` só valem quando o motivo do agente foi
//   `duvida_sem_resposta` ou `outro`. `sem_aviso` só vale em modo `vendas`,
//   nunca em `cliente` (modo ausente conta como não `vendas`: na dúvida a
//   equipe é avisada).
// - Gestante é lead, nunca `nao_lead`: com semanas, DPP ou plano de interesse
//   na ficha da transferência, o `nao_lead` do classificador é recusado (caso
//   da gestante que cita o Leonardo como seu médico).
// - Nos demais motivos, o classificador só troca o destino entre os motivos
//   comerciais. A troca mantém a maior prioridade da 11.4 entre o motivo do
//   agente e o novo (`prioridadeMinima`, aplicada por
//   `agente.registrar_handoff`) e mantém `dados.opcoes` no texto do grupo
//   (`manterOpcoes`).
// - Tipo fora dos comerciais (`pediu_humano`, `reclamacao`, `bebe_nasceu`,
//   `pos_venda_operacao`) com motivo do agente comercial, ou motivo do agente
//   fora dos comerciais: mantém o motivo do agente.

import {
  MOTIVOS_COMERCIAIS,
  prioridadeDoMotivo,
  maiorPrioridade,
} from './motivos-handoff.js';

export const TIPOS_CLASSIFICADOR_PEDIDO = [
  'contratar',
  'reuniao',
  'condicao_comercial',
  'cobertura_taxa',
  'reembolso_fiscal',
  'duvida_sem_resposta',
  'pediu_humano',
  'bebe_nasceu',
  'pos_venda_operacao',
  'reclamacao',
  'parceiro_medico',
  'outro',
  'nao_lead',
  'sem_aviso',
  'saude',
  'perda',
];

const MOTIVOS_QUE_ACEITAM_SILENCIO = ['duvida_sem_resposta', 'outro'];

function analisarSaidaModelo(saidaModelo) {
  let objeto = null;
  try {
    objeto = typeof saidaModelo === 'string' ? JSON.parse(saidaModelo) : saidaModelo;
  } catch {
    objeto = null;
  }
  if (!objeto || typeof objeto !== 'object' || !TIPOS_CLASSIFICADOR_PEDIDO.includes(objeto.tipo)) {
    return null;
  }
  return { tipo: objeto.tipo, porque: typeof objeto.porque === 'string' ? objeto.porque : '' };
}

function valorPreenchido(valor) {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'string') return valor.trim().length > 0;
  return true;
}

// Sinal de que quem escreve é uma gestante interessada (lead), vindo da
// ficha que o agente mandou na transferência.
export function temSinalDeLead(dados = {}) {
  if (!dados || typeof dados !== 'object') return false;
  return ['semanas', 'dpp', 'plano_interesse'].some((campo) => valorPreenchido(dados[campo]));
}

function temOpcoes(dados = {}) {
  if (!dados || typeof dados !== 'object') return false;
  const opcoes = dados.opcoes;
  if (Array.isArray(opcoes)) return opcoes.length > 0;
  return valorPreenchido(opcoes);
}

function resultado({
  motivoFinal,
  acao,
  motivoAgente,
  classificadorFalhou = false,
  tipoClassificado = null,
  porque = '',
  prioridadeMinima,
  manterOpcoes = false,
  recusa = null,
}) {
  const subiuParaAlerta = acao === 'alerta_saude' || acao === 'perda';
  return {
    motivoFinal,
    acao,
    classificadorFalhou,
    tipoClassificado,
    porque,
    prioridadeMinima: prioridadeMinima ?? prioridadeDoMotivo(motivoFinal),
    manterOpcoes,
    recusa,
    subiuParaAlerta,
    chaveTexto: subiuParaAlerta ? (acao === 'perda' ? 'perda' : 'alerta_saude') : null,
    enviarTexto: subiuParaAlerta,
    motivoAgente,
  };
}

export function lerClassificacaoPedido({ motivoAgente, saidaModelo, modo = null, jaNaoLead = false, dados = {} }) {
  const classificacao = analisarSaidaModelo(saidaModelo);
  const tipo = classificacao?.tipo ?? null;
  const porque = classificacao?.porque ?? '';

  // Subir para saúde ou perda sempre vale, inclusive em conversa não lead.
  if (tipo === 'saude' || tipo === 'perda') {
    return resultado({
      motivoFinal: tipo,
      acao: tipo === 'perda' ? 'perda' : 'alerta_saude',
      motivoAgente,
      tipoClassificado: tipo,
      porque,
      prioridadeMinima: 'maxima',
    });
  }

  if (jaNaoLead) {
    return resultado({ motivoFinal: 'nao_lead', acao: 'nao_lead', motivoAgente, tipoClassificado: tipo, porque });
  }

  if (tipo === null) {
    return resultado({ motivoFinal: motivoAgente, acao: 'transferir', motivoAgente, classificadorFalhou: true });
  }

  const aceitaSilencio = MOTIVOS_QUE_ACEITAM_SILENCIO.includes(motivoAgente);

  if (tipo === 'sem_aviso') {
    if (aceitaSilencio && modo === 'vendas') {
      return resultado({ motivoFinal: 'sem_aviso', acao: 'sem_aviso', motivoAgente, tipoClassificado: tipo, porque });
    }
    return resultado({
      motivoFinal: motivoAgente,
      acao: 'transferir',
      motivoAgente,
      tipoClassificado: tipo,
      porque,
      recusa: aceitaSilencio ? 'sem_aviso_fora_do_modo_vendas' : 'sem_aviso_motivo_nao_elegivel',
    });
  }

  if (tipo === 'nao_lead') {
    if (aceitaSilencio && !temSinalDeLead(dados)) {
      return resultado({ motivoFinal: 'nao_lead', acao: 'nao_lead', motivoAgente, tipoClassificado: tipo, porque });
    }
    return resultado({
      motivoFinal: motivoAgente,
      acao: 'transferir',
      motivoAgente,
      tipoClassificado: tipo,
      porque,
      recusa: aceitaSilencio ? 'nao_lead_com_sinal_de_lead' : 'nao_lead_motivo_nao_elegivel',
    });
  }

  if (MOTIVOS_COMERCIAIS.includes(tipo) && MOTIVOS_COMERCIAIS.includes(motivoAgente)) {
    const prioridadeMinima = maiorPrioridade(prioridadeDoMotivo(motivoAgente), prioridadeDoMotivo(tipo));
    return resultado({
      motivoFinal: tipo,
      acao: 'transferir',
      motivoAgente,
      tipoClassificado: tipo,
      porque,
      prioridadeMinima,
      manterOpcoes: motivoAgente === 'reuniao' || temOpcoes(dados),
    });
  }

  return resultado({
    motivoFinal: motivoAgente,
    acao: 'transferir',
    motivoAgente,
    tipoClassificado: tipo,
    porque,
    recusa: tipo === motivoAgente ? null : 'troca_fora_dos_motivos_comerciais',
  });
}
