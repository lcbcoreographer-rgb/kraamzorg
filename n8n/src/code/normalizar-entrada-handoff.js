// Nó 2 "Normalizar Entrada" do fluxo 2 (PRD 19.3). Função pura: recebe o
// item bruto do gatilho "Quando Chamado" e devolve o estado inicial do fluxo.
// O build embute este arquivo (com as dependências) no nó Code; os testes
// importam a mesma função.
//
// Regras (PRD 19.3 nó 2, 11.9 e 11.11 itens 2a e 2b):
// - `dados` é convertido com segurança: objeto vira cópia, texto JSON vira
//   objeto, qualquer outra coisa vira `{}`. A chave reservada `_fluxo2`
//   vinda de fora é descartada (só o fluxo escreve nela).
// - Motivo fora do enum `handoff_motivo` vira `outro`.
// - O `tipo` da ferramenta `acionar_equipe_saude` (`saude`, `internacao`,
//   `emocional`, `perda`) vira ação e chave do texto. `internacao` e
//   `emocional` só viram `alerta_internacao` e `alerta_emocional` com
//   `alerta_internacao_ativo` ou `alerta_emocional_ativo` ligado; desligado
//   (ou ausente), a chave é `alerta_saude`. `agente.mensagem_alerta` repete a
//   mesma checagem no banco.
// - Ação de alerta sempre leva motivo `saude` ou `perda`. Transferência com
//   motivo `saude` ou `perda` nunca é rebaixada: vira alerta, e quando a
//   chamada veio do agente o texto sai (`enviar_texto` verdadeiro), como no
//   nó 8a.
// - `enviar_texto` só é verdadeiro com `true` explícito (booleano ou o texto
//   "true" que o Tool Workflow pode mandar); ausente é falso.
// - `conversa_id` é a chave de tudo; `wa_jid` só serve para enviar.
//
// Entradas opcionais além da lista do 19.3, preenchidas pelo fluxo 3 quando
// existem: `tipo` (da ferramenta de saúde), `modo` (lido em
// `agente.pode_responder`, usado na regra do `sem_aviso`), `telefone` (para o
// aviso de reserva sem banco) e os dois parâmetros de ativação. [P25]
// `prioridade_minima` (normal, alta ou maxima) só sobe a prioridade do
// motivo, nunca baixa (transferência "IA fora do ar" do fluxo 3).

import {
  HANDOFF_MOTIVOS,
  ACOES_HANDOFF,
  CHAVES_TEXTO_ALERTA,
  ORIGENS_CHAMADA,
  ehAcaoDeAlerta,
  prioridadeDoMotivo,
  maiorPrioridade,
  NIVEIS_PRIORIDADE,
} from './motivos-handoff.js';
import { pularClassificador } from './pular-classificador.js';

export const TIPOS_FERRAMENTA_SAUDE = ['saude', 'internacao', 'emocional', 'perda'];

function texto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function booleanoExplicito(valor) {
  return valor === true || valor === 'true';
}

export function converterDados(dados) {
  let objeto = dados;
  if (typeof dados === 'string') {
    try {
      objeto = JSON.parse(dados);
    } catch {
      objeto = null;
    }
  }
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    return {};
  }
  const copia = { ...objeto };
  delete copia._fluxo2;
  return copia;
}

// Telefone para o aviso de reserva: o informado, ou os dígitos de um jid
// `@s.whatsapp.net`. Um jid `@lid` não é telefone e fica de fora.
export function telefoneDaEntrada({ telefone, wa_jid: waJid }) {
  const informado = texto(telefone);
  if (informado) return informado;
  const casamento = /^(\d{10,15})@s\.whatsapp\.net$/.exec(texto(waJid));
  return casamento ? casamento[1] : '';
}

// Chave do texto de alerta a partir do `tipo` da ferramenta de saúde ou de
// uma chave já pedida, aplicando a regra de ativação (PRD 19.3 nó 2).
export function chaveTextoAlerta({ acao, tipo, chaveTexto, ativacao = {} }) {
  if (acao === 'perda' || tipo === 'perda' || chaveTexto === 'perda') return 'perda';

  const pedida = tipo === 'internacao' ? 'alerta_internacao' : tipo === 'emocional' ? 'alerta_emocional' : chaveTexto;

  if (pedida === 'alerta_internacao') {
    return ativacao.alertaInternacaoAtivo === true ? 'alerta_internacao' : 'alerta_saude';
  }
  if (pedida === 'alerta_emocional') {
    return ativacao.alertaEmocionalAtivo === true ? 'alerta_emocional' : 'alerta_saude';
  }
  if (pedida === 'alerta_saude_sensivel') {
    // Decidido no fluxo 3 (nó 20) com `alerta_saude_sensivel_ativo`; o banco
    // confere de novo em `agente.mensagem_alerta`.
    return 'alerta_saude_sensivel';
  }
  return 'alerta_saude';
}

// Recalcula os campos derivados do estado. Chamado por todo nó Code que
// muda ação, motivo ou `enviar_texto`, para os nós If lerem só booleanos.
export function derivarEstado(estado) {
  const ehAlerta = ehAcaoDeAlerta(estado.acao);
  const pulo = pularClassificador(estado);
  return {
    ...estado,
    eh_alerta: ehAlerta,
    enviar_texto_alerta: ehAlerta && estado.enviar_texto === true,
    pular_classificador: pulo.pular,
    razao_pulo_classificador: pulo.razao,
  };
}

export function normalizarEntradaHandoff(entrada = {}) {
  const origemChamada = ORIGENS_CHAMADA.includes(entrada.origem_chamada) ? entrada.origem_chamada : 'sistema';
  const ativacao = {
    alertaInternacaoAtivo: booleanoExplicito(entrada.alerta_internacao_ativo),
    alertaEmocionalAtivo: booleanoExplicito(entrada.alerta_emocional_ativo),
  };

  // O tipo da ferramenta de saúde pode vir em `tipo` ou, por compatibilidade,
  // no próprio `chave_texto`.
  const tipoSaude = TIPOS_FERRAMENTA_SAUDE.includes(entrada.tipo)
    ? entrada.tipo
    : TIPOS_FERRAMENTA_SAUDE.includes(entrada.chave_texto)
      ? entrada.chave_texto
      : null;

  const motivoInformado = HANDOFF_MOTIVOS.includes(entrada.motivo) ? entrada.motivo : 'outro';

  let acao = ACOES_HANDOFF.includes(entrada.acao) ? entrada.acao : 'transferir';
  if (tipoSaude) {
    acao = tipoSaude === 'perda' ? 'perda' : 'alerta_saude';
  }
  let enviarTexto = booleanoExplicito(entrada.enviar_texto);
  let promovidaPeloMotivo = false;

  // Nunca rebaixa: transferência com motivo de saúde ou perda vira alerta.
  if (acao === 'transferir' && (motivoInformado === 'saude' || motivoInformado === 'perda')) {
    acao = motivoInformado === 'perda' ? 'perda' : 'alerta_saude';
    promovidaPeloMotivo = true;
    if (origemChamada === 'agente') enviarTexto = true;
  }

  const ehAlerta = ehAcaoDeAlerta(acao);
  const motivo = ehAlerta ? (acao === 'perda' ? 'perda' : 'saude') : motivoInformado;

  const chavePedida = CHAVES_TEXTO_ALERTA.includes(entrada.chave_texto) ? entrada.chave_texto : null;
  const chaveTexto = ehAlerta
    ? chaveTextoAlerta({ acao, tipo: tipoSaude, chaveTexto: chavePedida, ativacao })
    : null;

  const estado = {
    acao,
    conversa_id: texto(entrada.conversa_id),
    wa_jid: texto(entrada.wa_jid),
    telefone: telefoneDaEntrada(entrada),
    nome: texto(entrada.nome),
    motivo,
    motivo_agente: motivo,
    motivo_informado: HANDOFF_MOTIVOS.includes(entrada.motivo) ? entrada.motivo : null,
    prioridade_minima: Object.prototype.hasOwnProperty.call(NIVEIS_PRIORIDADE, entrada.prioridade_minima)
      ? maiorPrioridade(prioridadeDoMotivo(motivo), entrada.prioridade_minima)
      : prioridadeDoMotivo(motivo),
    resumo: texto(entrada.resumo),
    solicitacao: texto(entrada.solicitacao),
    dados: converterDados(entrada.dados),
    texto_familia: texto(entrada.texto_familia),
    chave_texto: chaveTexto,
    enviar_texto: enviarTexto,
    origem_chamada: origemChamada,
    modo: texto(entrada.modo) || null,
    tipo_saude: tipoSaude,
    promovida_pelo_motivo: promovidaPeloMotivo,
    ativacao,
    classificacao: null,
    subiu_para_alerta: false,
    texto_alerta: null,
    mensagem_enviada: null,
    envio_alerta_erro: null,
  };

  return derivarEstado(estado);
}
