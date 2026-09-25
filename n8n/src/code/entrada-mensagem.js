// Estado da entrada A do fluxo 3 (PRD 19.4, nós 7 a 15): registro da
// mensagem, transcrição de áudio e agrupamento. Funções puras: recebem o
// estado do nó Code anterior e o resultado cru de uma chamada externa, e
// devolvem o próximo estado. O build embute este arquivo (com as
// dependências) nos nós Code; os testes importam as mesmas funções.
//
// O `conversa_id` NÃO entra no estado: toda chamada ao banco lê a chave direto
// do nó "Registrar Msg Família" (ou "Registrar Msg Humana") por expressão,
// nunca de um campo que outro nó possa ter mudado (CLAUDE.md, PRD 19.1). O
// estado guarda só se o registro deu certo.
//
// Contrato esperado do banco (P21 implementa; `select agente.f(...) as
// resultado`, jsonb com `ok`):
// - registrar_mensagem(jid, direcao, enviado_por, conteudo, tipo,
//   wa_message_id, nome_whatsapp, telefone, lid, nome_contato) -> {ok,
//   conversa_id, primeira_mensagem, classificacao, numero_equipe,
//   numero_plantao, agrupamento_segundos}. `agrupamento_segundos` é o
//   parâmetro `agente_debounce_segundos` (11.3), lido pelo banco porque
//   valor de negócio não vai no config (P23 item 1).
// - pausar(conversa_id, horas, motivo) -> {ok, horas}; `horas` nulo usa
//   `agente_pausa_humano_horas`.
// - registrar_transcricao(wa_message_id, texto) -> {ok}.

import { limitarTexto, mascararDocumentos } from './mascarar-documentos.js';
import { agrupamento, lerBufferRedis } from './agrupamento.js';
import { comMarca, resultadoDoBanco, falhouChamada, descreverErro, textoLimpo } from './resultado-no.js';

function numeroPositivo(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

// Nó "Estado da Mensagem", depois do nó 10 "Registrar Msg Família".
export function iniciarEstado(dados, respostaRegistro) {
  const resultado = resultadoDoBanco(respostaRegistro);
  const conversaId = textoLimpo(resultado?.conversa_id);
  const registroOk = resultado?.ok === true && conversaId.length > 0;
  return comMarca({
    ...dados,
    registro_ok: registroOk,
    registro_erro: registroOk
      ? null
      : resultado
        ? textoLimpo(resultado.erro) || 'registrar_mensagem sem conversa_id'
        : descreverErro(respostaRegistro),
    primeira_mensagem: resultado?.primeira_mensagem === true,
    classificacao_conversa: textoLimpo(resultado?.classificacao) || null,
    numero_equipe: resultado?.numero_equipe === true,
    numero_plantao: resultado?.numero_plantao === true,
    agrupamento_segundos: numeroPositivo(resultado?.agrupamento_segundos),
    texto_agrupado: dados?.texto ?? '',
    audio_nao_transcrito: false,
    handoff_id_execucao: null,
  });
}

// Nó "Ler Transcrição", depois do nó 12. A transcrição sai mascarada, como
// qualquer texto da família. Falha da transcrição em si marca o tipo
// `audio_nao_transcrito`, nunca mídia comum (PRD 19.4 nó 13).
export function lerTranscricao(estado, resposta) {
  const falhou = falhouChamada(resposta);
  const bruto = falhou ? '' : textoLimpo(resposta.transcription ?? resposta.transcricao ?? resposta.text);
  const ok = bruto.length > 0;
  return comMarca({
    ...estado,
    transcricao_ok: ok,
    transcricao_erro: ok ? null : falhou ? descreverErro(resposta) : 'transcrição vazia',
    texto: ok ? mascararDocumentos(limitarTexto(bruto)) : estado.texto ?? '',
    tipo: ok ? 'audio' : 'audio_nao_transcrito',
    audio_nao_transcrito: !ok,
  });
}

// Nó "Conferir Gravação da Transcrição", depois do nó 13. Se só a gravação
// falhou, o texto transcrito segue no fluxo e passa pelos nós 17 a 20; o erro
// fica registrado à parte (PRD 19.4 nó 13, v4.2).
export function conferirGravacaoTranscricao(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  const ok = resultado?.ok === true;
  return comMarca({
    ...estado,
    gravacao_transcricao_ok: ok,
    gravacao_transcricao_erro: ok ? null : resultado ? textoLimpo(resultado.erro) || 'sem ok' : descreverErro(resposta),
  });
}

// Nó "Preparar Agrupamento" (nó 14, antes do Redis).
export function prepararAgrupamento(estado) {
  const id = textoLimpo(estado.message_id) || String(estado.carimbo || '');
  const entrada = {
    id,
    texto: estado.texto ?? '',
    carimbo: Number(estado.carimbo) || 0,
    midia: estado.midia === true,
    tipo: estado.tipo ?? null,
    audio_nao_transcrito: estado.audio_nao_transcrito === true,
  };
  const agrupar = estado.registro_ok === true && estado.agrupamento_segundos !== null && id.length > 0;
  return comMarca({
    ...estado,
    agrupar,
    buffer_id: id,
    buffer_entrada: entrada,
    buffer_valor: JSON.stringify({ [id]: JSON.stringify(entrada) }),
    texto_agrupado: entrada.texto,
    tipos_midia: entrada.midia && entrada.tipo ? [entrada.tipo] : [],
  });
}

// Nó "Decidir Agrupamento", depois do redis get. Falha do Redis (erro ou item
// repassado sem o campo `buffer`) segue sem agrupar.
export function decidirAgrupamento(estado, respostaRedis) {
  const buffer = falhouChamada(respostaRedis) ? null : lerBufferRedis(respostaRedis.buffer);
  const decisao = agrupamento({
    buffer,
    idExecucaoAtual: estado.buffer_id,
    textoAtual: estado.texto,
    falhaRedis: buffer === null,
    entradaAtual: estado.buffer_entrada,
  });
  return comMarca({
    ...estado,
    redis_falhou: buffer === null,
    deve_responder: decisao.deveResponder,
    texto_agrupado: decisao.texto,
    agrupado: decisao.agrupado,
    quantidade_agrupada: decisao.quantidade,
    midia: decisao.midia,
    tipos_midia: decisao.tiposMidia,
    audio_nao_transcrito: decisao.audioNaoTranscrito,
  });
}

// Nó "Estado Agrupado": ponto único antes do nó 15, venha o item do
// agrupamento ou do caminho sem agrupar.
export function fecharAgrupamento(estado) {
  const texto = textoLimpo(estado.texto_agrupado ?? estado.texto);
  const midia = estado.midia === true;
  return comMarca({
    ...estado,
    texto_agrupado: texto,
    midia,
    com_legenda: midia && texto.length > 0,
    audio_nao_transcrito: estado.audio_nao_transcrito === true,
    tipos_midia: Array.isArray(estado.tipos_midia) ? estado.tipos_midia : [],
  });
}

// Nó "Ler Pausa por Humano" (nó 8): o cache `kz:pausa` só é gravado com o
// prazo que o banco devolveu.
export function lerPausa(resposta) {
  const resultado = resultadoDoBanco(resposta);
  const horas = numeroPositivo(resultado?.horas);
  const ok = resultado?.ok === true && horas !== null;
  return comMarca({
    pausa_ok: ok,
    pausa_ttl_segundos: ok ? Math.round(horas * 3600) : null,
    pausa_erro: ok ? null : resultado ? 'pausar sem horas' : descreverErro(resposta),
  });
}
