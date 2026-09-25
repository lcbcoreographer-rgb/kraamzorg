// Chamadas do fluxo 3 ao fluxo 2 "Pausar IA e Notificar Equipe" (PRD 19.4
// nós 20, 21, 23, 24, 26, 29). Funções puras, embutidas nos nós Code; os
// testes importam as mesmas.
//
// Cada "preparar" monta `estado.fluxo2` com as entradas de conteúdo do fluxo
// 2. `conversa_id`, `wa_jid` e `nome` NÃO passam por aqui: o nó Execute
// Workflow lê os três por expressão direto dos nós "Registrar Msg Família" e
// "Extrair Dados" (CLAUDE.md: a chave nunca vem de um campo intermediário).
//
// Nenhum texto para a família ou para a equipe mora aqui. O resumo "IA fora do
// ar" e o aviso ao grupo de reserva vêm do config do build (PRD 19.1, 19.4 nó
// 26 e 23.3), como parâmetro.

import { HANDOFF_MOTIVOS } from './motivos-handoff.js';
import { enviarTextoPorModo } from './modos.js';
import { comMarca, falhouChamada, descreverErro, textoLimpo } from './resultado-no.js';

function entradaBase(estado) {
  const ativacao = estado.ativacao ?? {};
  return {
    acao: 'transferir',
    motivo: 'outro',
    resumo: '',
    solicitacao: '',
    dados: {},
    texto_familia: estado.texto_agrupado ?? '',
    chave_texto: '',
    enviar_texto: false,
    origem_chamada: 'sistema',
    tipo: '',
    modo: estado.modo_banco ?? estado.modo ?? '',
    telefone: estado.telefone ?? '',
    alerta_internacao_ativo: ativacao.alerta_internacao_ativo === true,
    alerta_emocional_ativo: ativacao.alerta_emocional_ativo === true,
    prioridade_minima: '',
  };
}

function comFluxo2(estado, campos) {
  return comMarca({ ...estado, fluxo2: { ...entradaBase(estado), ...campos } });
}

// Nó 20 "Caminho de Alerta" (v4.2): `enviar_texto` verdadeiro em vendas,
// cliente, pausado, nao_lead e humano_comercial; falso em teste fora da lista
// e em humano_nominal, salvo `alerta_saude_sensivel_ativo` com ação
// `alerta_saude` (texto `alerta_saude_sensivel`, K-20); com perda, falso em
// humano_nominal sempre.
export function prepararAlerta(estado) {
  const perda = estado.alerta === 'perda';
  const acao = perda ? 'perda' : 'alerta_saude';
  let enviarTexto = estado.enviar_texto_alerta === true && !estado.teste_fora_lista && !estado.banco_fora;
  let chave = estado.chave_texto_alerta || (perda ? 'perda' : 'alerta_saude');
  if (estado.modo === 'humano_nominal') {
    enviarTexto = false;
    if (!perda && estado.ativacao?.alerta_saude_sensivel_ativo === true) {
      enviarTexto = true;
      chave = 'alerta_saude_sensivel';
    }
  }
  return comFluxo2(estado, {
    acao,
    motivo: perda ? 'perda' : 'saude',
    chave_texto: chave,
    enviar_texto: enviarTexto,
    origem_chamada: estado.origem_alerta === 'filtro_termos' ? 'filtro_termos' : 'classificador',
    dados: {
      origem_alerta: estado.origem_alerta ?? null,
      termo: estado.termo?.termo ?? null,
      perda_temporalidade: perda ? estado.perda_temporalidade ?? null : null,
    },
  });
}

// Nó 21, antes do switch: áudio que não foi transcrito. Em humano_nominal
// vale `estado_sensivel_escreveu`; o texto `audio_nao_transcrito` sai nos
// mesmos modos em que o texto de alerta sairia.
export function prepararAudioNaoTranscrito(estado) {
  const sensivel = estado.modo === 'humano_nominal';
  const enviar = enviarTextoPorModo(estado.modo) && !estado.teste_fora_lista && !estado.banco_fora;
  return comMarca({
    ...comFluxo2(estado, { motivo: sensivel ? 'estado_sensivel_escreveu' : 'audio_nao_transcrito' }),
    enviar_texto_audio: enviar,
  });
}

// Nó 21, `humano_nominal`: transferência `estado_sensivel_escreveu`.
export function prepararEstadoSensivel(estado) {
  return comFluxo2(estado, { motivo: 'estado_sensivel_escreveu' });
}

// Nó 21, `humano_comercial`: o texto novo vai para o handoff aberto, sem
// novo aviso (P22 lê `dados._fluxo3.acrescentar_ao_aberto`).
export function prepararAcrescimo(estado) {
  const motivo = HANDOFF_MOTIVOS.includes(estado.motivo_encerramento) ? estado.motivo_encerramento : 'outro';
  return comFluxo2(estado, {
    motivo,
    solicitacao: estado.texto_agrupado ?? '',
    dados: { _fluxo3: { acrescentar_ao_aberto: true } },
  });
}

// Nó 23, parceiro médico no início da conversa.
export function prepararParceiroMedico(estado) {
  return comFluxo2(estado, { motivo: 'parceiro_medico', origem_chamada: 'classificador' });
}

// Nó 24, mídia sem alerta, com ou sem legenda.
export function prepararMidia(estado) {
  return comFluxo2(estado, {
    motivo: 'midia_recebida',
    dados: { tipos_midia: estado.tipos_midia ?? [], com_legenda: estado.com_legenda === true },
  });
}

// Nó 26, modelo de conversa fora do ar (ou ficha que não veio): motivo
// `outro`, prioridade alta, resumo do config; nada vai para a família.
export function prepararIaForaDoAr(estado, { resumo }) {
  return comFluxo2(estado, {
    motivo: 'outro',
    prioridade_minima: 'alta',
    resumo: textoLimpo(resumo),
    dados: { falha: estado.falha_agente ?? 'modelo_de_conversa' },
  });
}

// Nó 29, reescrita que devolveu `transferir`: a transferência abre antes do
// envio, para a promessa "o Leonardo fala com você" ser verdade.
export function prepararTransferenciaReescrita(estado) {
  return comFluxo2(estado, { motivo: estado.reescrita_transferir, solicitacao: estado.texto_agrupado ?? '' });
}

// Nó 29, violação que persistiu: `validacao_resposta`.
export function prepararTransferenciaValidacao(estado) {
  return comFluxo2(estado, {
    motivo: 'validacao_resposta',
    dados: { violacoes: (estado.violacoes ?? []).map((violacao) => violacao.regra) },
  });
}

// Retorno do fluxo 2 (`{ok, handoff_id, instrucao, instrucao_chave, motivo,
// acao}`). `rodou` falso quando o fluxo 2 nem chegou ao Retorno (erro ou item
// repassado). `reserva`: 'se_nao_rodou' (alerta: o fluxo 2 já cuida da
// reserva quando roda) ou 'se_nao_registrou' (IA fora do ar: o fluxo 2 só usa
// a reserva em saúde e perda).
export function lerRetornoFluxo2(estado, resposta, { reserva = null } = {}) {
  const rodou = !falhouChamada(resposta) && typeof resposta.instrucao_chave === 'string';
  const ok = rodou && resposta.ok === true;
  const handoffId = rodou ? textoLimpo(resposta.handoff_id) || null : null;
  let usarReserva = false;
  if (reserva === 'se_nao_rodou') usarReserva = !rodou;
  if (reserva === 'se_nao_registrou') usarReserva = !ok;
  return comMarca({
    ...estado,
    fluxo2_rodou: rodou,
    fluxo2_ok: ok,
    fluxo2_erro: rodou ? null : descreverErro(resposta),
    fluxo2_instrucao_chave: rodou ? resposta.instrucao_chave : null,
    handoff_id_execucao: handoffId ?? estado.handoff_id_execucao ?? null,
    usar_grupo_reserva: usarReserva,
  });
}

// Aviso ao grupo de reserva do config (PRD 19.1 e 23.3), quando o registro
// não aconteceu.
export function montarAvisoReserva(estado, { modelo, jid }) {
  const telefone = textoLimpo(estado.telefone) || textoLimpo(estado.jid);
  const texto = String(modelo ?? '')
    .split('{telefone}')
    .join(telefone)
    .split('{texto_familia}')
    .join(textoLimpo(estado.texto_agrupado ?? estado.texto));
  return comMarca({ ...estado, aviso_reserva_jid: jid, aviso_reserva_texto: texto });
}

// Nó 24, depois da transferência `midia_recebida`: sem legenda, o texto
// `midia_recebida` sai (com o `handoff_id` desta transferência no
// `pode_enviar`) e a execução para; com legenda, segue ao agente.
export function lerTransferenciaMidia(estado, resposta) {
  const lido = lerRetornoFluxo2(estado, resposta);
  return comMarca({ ...lido, sem_legenda: lido.com_legenda !== true, chave_texto_sistema: 'midia_recebida' });
}
