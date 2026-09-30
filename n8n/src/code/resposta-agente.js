// Nós 28 e 29 do fluxo 3 (PRD 19.4 e 11.11): validação da resposta do
// agente, reescrita e `fallback_confirmar`. Funções puras,
// embutidas nos nós Code; os testes importam as mesmas.

import { validarResposta, violacoesEmTexto, AGENDA_ESTADO_CONVITE } from './validar-resposta.js';
import { REGRAS_DE_AGENDA } from './agenda-validador.js';
import { temSilencio } from './marcas-sistema.js';
import { HANDOFF_MOTIVOS } from './motivos-handoff.js';
import { comMarca, conteudoOpenAi, jsonDoModelo, resultadoDoBanco, textoLimpo } from './resultado-no.js';

// [v4.3] Antes da reunião realizada, desconto, parcelamento e contrato não
// abrem transferência: viram a anotação `anotacao_comercial` (PRD 19.4 nó 29).
// Os outros motivos comerciais também deixam de transferir (11.4).
export const MOTIVOS_DA_REESCRITA_QUE_VIRAM_ANOTACAO = ['condicao_comercial', 'contratar'];
export const MOTIVOS_DA_REESCRITA_SEM_TRANSFERENCIA = [
  'reuniao',
  'cobertura_taxa',
  'reembolso_fiscal',
  'duvida_sem_resposta',
];

// O e-mail do convite só pode ser pedido com o horário conferido e livre: a
// ficha (lida no começo da execução) ou a conferência que a ferramenta acabou
// de devolver nesta execução.
function estadoDaAgendaNaExecucao(estado) {
  const daFicha = estado.agenda?.estado ?? estado.validador?.agenda_estado ?? '';
  const conferencias = (estado.agenda_estados ?? []).filter((item) => item === 'livre' || item === 'ocupado');
  return conferencias[conferencias.length - 1] === 'livre' ? AGENDA_ESTADO_CONVITE : daFicha;
}

function contextoDeValidacao(estado, { anotacaoDoSistema = false } = {}) {
  const motivos = [estado.validador?.motivo_em_curso, ...(estado.motivos_transferidos ?? [])].filter(Boolean);
  return {
    ...(estado.validador ?? {}),
    motivo_em_curso: motivos,
    fechamento_venda: estado.fechamento_venda === true,
    // [v4.3] itens 9 e 10 do 11.11: o que a ficha e as ferramentas de agenda
    // desta execução autorizam a Isadora a dizer.
    agenda_estado: estadoDaAgendaNaExecucao(estado),
    agenda_horarios: [...(estado.agenda?.horarios ?? []), ...(estado.agenda_horarios_ferramentas ?? [])],
    agenda_estados: estado.agenda_estados ?? [],
    agenda_reuniao_marcada: estado.agenda?.reuniao_marcada === true,
    anotacao_registrada: estado.anotacao_registrada === true || anotacaoDoSistema,
  };
}

// Nó 28 "Validar Resposta".
export function validarRespostaDoAgente(estado) {
  const resultado = validarResposta(estado.saida_modelo, contextoDeValidacao(estado));
  return comMarca({
    ...estado,
    resposta_aprovada: resultado.aprovada,
    texto_resposta: resultado.texto,
    violacoes: resultado.violacoes,
    violacoes_texto: violacoesEmTexto(resultado.violacoes),
    correcoes: resultado.correcoes,
    texto_para_reescrita: resultado.texto,
  });
}

// Nó 29 "Reescrever": lê a saída do modelo de reescrita e valida de novo.
// `[SEGURANCA]`, JSON inválido, falha da chamada ou nova violação: sai
// `fallback_confirmar` e o fluxo 2 com `validacao_resposta`.
export function lerReescrita(estado, respostaOpenAi) {
  const objeto = jsonDoModelo(conteudoOpenAi(respostaOpenAi));
  const texto = textoLimpo(objeto?.texto);
  const seguranca = /\[\s*SEGURANCA\s*\]/i.test(texto);
  const pedido = HANDOFF_MOTIVOS.includes(objeto?.transferir) && !['saude', 'perda'].includes(objeto.transferir)
    ? objeto.transferir
    : null;
  const anotar = MOTIVOS_DA_REESCRITA_QUE_VIRAM_ANOTACAO.includes(pedido);
  const transferir = anotar || MOTIVOS_DA_REESCRITA_SEM_TRANSFERENCIA.includes(pedido) ? null : pedido;
  if (!objeto || !texto || seguranca || temSilencio(texto)) {
    return comMarca({
      ...estado,
      reescrita_aprovada: false,
      reescrita_motivo: !objeto ? 'reescrita_sem_json' : seguranca ? 'reescrita_seguranca' : 'reescrita_vazia',
      reescrita_transferir: null,
      reescrita_anotar: false,
    });
  }
  const resultado = validarResposta(texto, contextoDeValidacao(estado, { anotacaoDoSistema: anotar }));
  return comMarca({
    ...estado,
    reescrita_aprovada: resultado.aprovada,
    reescrita_motivo: resultado.aprovada ? null : 'violacao_persistiu',
    texto_resposta: resultado.aprovada ? resultado.texto : estado.texto_resposta,
    violacoes: resultado.aprovada ? estado.violacoes : [...(estado.violacoes ?? []), ...resultado.violacoes],
    reescrita_transferir: resultado.aprovada ? transferir : null,
    tem_transferencia_reescrita: resultado.aprovada && transferir !== null,
    // [v4.3] o sistema grava a anotação para o Leonardo (o pedido da família,
    // com as palavras dela) antes de enviar o texto reescrito.
    reescrita_anotar: resultado.aprovada && anotar,
  });
}

// Depois de `agente.mensagem_sistema(conversa_id, 'fallback_confirmar')`.
export function lerFallback(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  const texto = textoLimpo(resultado?.texto);
  return comMarca({
    ...estado,
    texto_resposta: texto || null,
    fallback_ok: texto.length > 0,
    // [v4.3] PRD 11.11 item 9: violação de horário ou de confirmação que a
    // reescrita não resolveu abre a consulta `horario_edilaine` (sem
    // transferir a conversa) em vez do handoff `validacao_resposta`.
    violacao_de_agenda: (estado.violacoes ?? []).some((violacao) => REGRAS_DE_AGENDA.includes(violacao.regra)),
  });
}

// [v4.3] Nó "Ler Anotação da Reescrita", depois de `agente.registrar_marco(...,
// 'anotacao_comercial', ...)`: o pedido da família (desconto, parcelamento,
// contrato) vai para o resumo do Leonardo. Falha não impede o envio do texto
// reescrito; fica registrada.
export function lerAnotacaoDaReescrita(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  return comMarca({ ...estado, anotacao_gravada: resultado?.ok === true });
}

// [v4.3] Nó "Ler Consulta de Horário", depois do fluxo 4 com a operação
// `abrir_consulta_horario` (violação de agenda que a reescrita não resolveu).
export function lerConsultaDeHorario(estado, resposta) {
  const aberta = Boolean(resposta && resposta.origem === 'agenda_isadora' && resposta.estado === 'aberta');
  return comMarca({ ...estado, consulta_horario_aberta: aberta });
}
