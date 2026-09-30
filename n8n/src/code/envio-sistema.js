// Texto do sistema para a família (mídia sem legenda, não lead, áudio não
// transcrito), `pode_enviar` e conferência de envio no fluxo 3 (PRD 19.4 nós
// 21, 23, 24, 31 e 40). Funções puras, embutidas nos nós Code; os testes
// importam as mesmas. Nenhum texto mora aqui: vem de `agente.mensagem_sistema`
// e `agente.marcar_nao_lead`.

import { comMarca, falhouChamada, resultadoDoBanco, descreverErro, textoLimpo } from './resultado-no.js';

// Depois de `agente.mensagem_sistema(conversa_id, chave)` -> {ok, texto}.
export function lerTextoDoSistema(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  const texto = textoLimpo(resultado?.texto);
  return comMarca({
    ...estado,
    texto_sistema: texto || null,
    tem_texto_sistema: resultado?.ok !== false && texto.length > 0,
  });
}

// Depois de `agente.marcar_nao_lead(conversa_id, tipo)` ->
// {ok, texto_encaminhamento}.
export function lerNaoLead(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  const texto = textoLimpo(resultado?.texto_encaminhamento);
  return comMarca({
    ...estado,
    nao_lead_ok: resultado?.ok === true,
    texto_sistema: texto || null,
    tem_texto_sistema: resultado?.ok === true && texto.length > 0,
  });
}

// Depois de `agente.pode_enviar(conversa_id, tipo, handoff_id)` ->
// {pode, motivo}. Falha do banco não libera o envio.
export function lerPodeEnviar(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  return comMarca({
    ...estado,
    pode_enviar: resultado?.pode === true,
    pode_enviar_motivo: resultado ? textoLimpo(resultado.motivo) || null : descreverErro(resposta),
  });
}

// Depois de um envio pela UAZAPI (`messageid`, `id`) ou pela Cloud API do
// WhatsApp (`messages[0].id`, o wamid; P18b). Sem o id da Cloud API, a Meta
// não confirmou o envio e ele não conta como saído.
export function conferirEnvio(estado, resposta) {
  const idCloudApi = Array.isArray(resposta?.messages) ? resposta.messages[0]?.id : undefined;
  const saiu = !falhouChamada(resposta) && !(Array.isArray(resposta?.messages) && !idCloudApi);
  return comMarca({
    ...estado,
    envio_saiu: saiu,
    envio_message_id: saiu ? textoLimpo(resposta.messageid ?? resposta.id ?? resposta.key?.id ?? idCloudApi) || null : null,
    envio_erro: saiu ? null : descreverErro(resposta),
  });
}
