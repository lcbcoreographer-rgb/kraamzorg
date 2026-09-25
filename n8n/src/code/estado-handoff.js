// Transições de estado do fluxo 2 "Pausar IA e Notificar Equipe" (PRD 19.3).
// Cada função é pura: recebe o estado que veio do nó Code anterior e o
// resultado cru de uma chamada externa (Postgres, OpenAI, UAZAPI) e devolve o
// próximo estado. O build embute este arquivo (com as dependências) nos nós
// Code do fluxo; os testes importam as mesmas funções.
//
// Nenhum texto para a família ou para a equipe mora aqui: os textos vêm de
// `agente.mensagem_alerta`, `agente.registrar_handoff`,
// `agente.marcar_nao_lead` e `agente.mensagem_sistema`. A única exceção é o
// aviso ao grupo de reserva sem banco, cujo modelo vem do config do build
// (PRD 19.1 e 23.3) e entra aqui como parâmetro.
//
// Contrato que o fluxo espera do banco (P21/P22 implementam; cada chamada é
// `select agente.f(...) as resultado`, jsonb com `ok`):
// - mensagem_alerta(conversa_id, acao, chave) -> {ok, texto, chave}
// - registrar_mensagem(jid, 'saida', 'sistema', texto, 'texto', wa_message_id,
//   null, telefone, null, null) -> {ok, conversa_id}
// - contexto_conversa(conversa_id, 50) -> {ok, mensagens: [{de, texto, em}],
//   iniciada_por, classificacao, posicao_ultima_resposta?}; `de` em
//   familia, isadora, equipe ou sistema, da mais antiga para a mais nova
// - marcar_nao_lead(conversa_id, tipo) -> {ok, texto_encaminhamento,
//   instrucao_agente} (instrução 23.4 já com o encaminhamento)
// - mensagem_sistema(conversa_id, 'instrucao_sem_aviso') -> {ok, texto}
// - registrar_handoff(conversa_id, motivo, resumo, solicitacao, dados,
//   origem, texto_familia) -> {ok, handoff_id, duplicado, atualizacao,
//   mensagem_grupo, grupo_jid, plantao: [numero], instrucao_agente,
//   instrucao_chave?, pausa_horas, humano_comercial}. Lê de
//   `dados._fluxo2`: prioridade_minima (nunca abaixo dela), manter_opcoes,
//   mensagem_enviada (nula: o banco usa o complemento do PRD 23.3)
// - registrar_notificacao_handoff(handoff_id, ok, erro) -> {ok}

import { MOTIVOS_NUNCA_DEDUPLICADOS, ehAcaoDeAlerta, maiorPrioridade } from './motivos-handoff.js';
import { chaveTextoAlerta, derivarEstado } from './normalizar-entrada-handoff.js';
import { lerClassificacaoPedido } from './ler-classificacao-pedido.js';

// Classificação da conversa já marcada no banco que conta como não lead
// (PRD 11.7: candidata, fornecedor, consultório).
export const CLASSIFICACOES_NAO_LEAD = ['candidata', 'fornecedor', 'consultorio'];

// Instrução devolvida ao agente por motivo (PRD 23.4). Só a chave: o texto
// vem do banco.
export function instrucaoChaveDoMotivo(motivo) {
  switch (motivo) {
    case 'reuniao':
      return 'instrucao_reuniao';
    case 'contratar':
      return 'instrucao_contratar';
    case 'condicao_comercial':
      return 'instrucao_condicao';
    case 'bebe_nasceu':
      return 'instrucao_bebe_nasceu';
    case 'saude':
    case 'perda':
      return 'instrucao_saude';
    default:
      return 'instrucao_generica';
  }
}

// Resultado de `select agente.f(...) as resultado`: o driver entrega jsonb
// como objeto, mas um texto JSON também é aceito. Qualquer outra coisa vira
// nulo.
export function lerJsonb(valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    try {
      const objeto = JSON.parse(valor);
      return objeto && typeof objeto === 'object' && !Array.isArray(objeto) ? objeto : null;
    } catch {
      return null;
    }
  }
  return null;
}

// Item de saída de um nó com `onError: continueRegularOutput` que falhou.
export function falhouChamada(resposta) {
  return !resposta || typeof resposta !== 'object' || resposta.error !== undefined;
}

export function descreverErro(resposta, padrao = 'falha sem detalhe') {
  if (!resposta || typeof resposta !== 'object') return padrao;
  const erro = resposta.error;
  if (!erro) return padrao;
  if (typeof erro === 'string') return erro;
  if (typeof erro.message === 'string') return erro.message;
  return padrao;
}

function textoOuVazio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

// ---------------------------------------------------------------------------
// Nó 4: Enviar Texto de Alerta (mensagem_alerta, envio, registro).
// ---------------------------------------------------------------------------

export function prepararTextoAlerta(estado, respostaMensagemAlerta) {
  const resultado = falhouChamada(respostaMensagemAlerta) ? null : lerJsonb(respostaMensagemAlerta.resultado);
  const texto = textoOuVazio(resultado?.texto);
  return {
    ...estado,
    texto_alerta: texto || null,
    chave_texto_enviada: texto ? resultado?.chave ?? estado.chave_texto : null,
    tem_texto_alerta: texto.length > 0,
    envio_alerta_erro: texto
      ? null
      : falhouChamada(respostaMensagemAlerta)
        ? `mensagem_alerta: ${descreverErro(respostaMensagemAlerta)}`
        : 'mensagem_alerta: sem texto',
  };
}

export function conferirEnvioAlerta(estado, respostaEnvio) {
  const enviado = estado.tem_texto_alerta === true && !falhouChamada(respostaEnvio);
  return {
    ...estado,
    mensagem_enviada: enviado ? estado.texto_alerta : null,
    registrar_envio_alerta: enviado,
    wa_message_id_alerta: enviado ? respostaEnvio.messageid ?? respostaEnvio.id ?? null : null,
    envio_alerta_erro: enviado ? null : `envio: ${descreverErro(respostaEnvio)}`,
  };
}

// ---------------------------------------------------------------------------
// Nós 6 a 8a: contexto, classificador de pedido e subida para alerta.
// ---------------------------------------------------------------------------

const ROTULO_AUTOR = {
  familia: 'Família',
  cliente: 'Família',
  isadora: 'Isadora',
  ia: 'Isadora',
  sistema: 'Isadora',
  equipe: 'Equipe',
  humano: 'Equipe',
};

function ehResposta(de) {
  return de !== 'familia' && de !== 'cliente';
}

function formatarMensagens(mensagens) {
  return mensagens
    .map((mensagem) => `${ROTULO_AUTOR[mensagem.de] ?? 'Família'}: ${textoOuVazio(mensagem.texto)}`)
    .join('\n');
}

// Separa o pedido atual (mensagens da família desde a última resposta da
// equipe ou da Isadora) do resto da conversa, que é só contexto (PRD 19.3
// nó 7). Usa `posicao_ultima_resposta` quando o banco devolve; senão procura
// a última mensagem que não é da família.
export function separarPedidoAtual(mensagens = [], posicaoUltimaResposta = null) {
  const lista = Array.isArray(mensagens) ? mensagens.filter((m) => m && typeof m === 'object') : [];
  let corte = -1;
  if (Number.isInteger(posicaoUltimaResposta) && posicaoUltimaResposta >= -1 && posicaoUltimaResposta < lista.length) {
    corte = posicaoUltimaResposta;
  } else {
    for (let i = lista.length - 1; i >= 0; i -= 1) {
      if (ehResposta(lista[i].de)) {
        corte = i;
        break;
      }
    }
  }
  return { pedido: lista.slice(corte + 1), anteriores: lista.slice(0, corte + 1) };
}

export function prepararClassificacao(estado, respostaContexto) {
  const contexto = falhouChamada(respostaContexto) ? null : lerJsonb(respostaContexto.resultado);
  const { pedido, anteriores } = separarPedidoAtual(contexto?.mensagens, contexto?.posicao_ultima_resposta);

  const pedidoAtual = pedido.length > 0
    ? formatarMensagens(pedido)
    : estado.texto_familia
      ? `Família: ${estado.texto_familia}`
      : '(nenhuma mensagem nova)';

  return {
    ...estado,
    contexto_ok: contexto !== null && contexto.ok !== false,
    ja_nao_lead: CLASSIFICACOES_NAO_LEAD.includes(contexto?.classificacao),
    pedido_atual: pedidoAtual,
    contexto_texto: anteriores.length > 0 ? formatarMensagens(anteriores) : '(sem conversa anterior)',
    resumo_agente: estado.resumo || '(sem resumo)',
    iniciada_por: textoOuVazio(contexto?.iniciada_por) || 'desconhecido',
  };
}

// Conteúdo devolvido pela API de chat da OpenAI, ou nulo em falha.
export function conteudoDaRespostaOpenAi(resposta) {
  if (falhouChamada(resposta)) return null;
  const conteudo = resposta?.choices?.[0]?.message?.content;
  return typeof conteudo === 'string' ? conteudo : null;
}

export function aplicarClassificacao(estado, respostaOpenAi) {
  const leitura = lerClassificacaoPedido({
    motivoAgente: estado.motivo_agente,
    saidaModelo: conteudoDaRespostaOpenAi(respostaOpenAi),
    modo: estado.modo,
    jaNaoLead: estado.ja_nao_lead === true,
    dados: estado.dados,
  });

  const motivo = leitura.acao === 'transferir' || leitura.subiuParaAlerta ? leitura.motivoFinal : estado.motivo_agente;

  return derivarEstado({
    ...estado,
    motivo,
    prioridade_minima: maiorPrioridade(leitura.prioridadeMinima, estado.prioridade_minima),
    manter_opcoes: leitura.manterOpcoes,
    decisao: leitura.acao,
    subiu_para_alerta: leitura.subiuParaAlerta,
    eh_nao_lead: leitura.acao === 'nao_lead',
    tipo_nao_lead: tipoNaoLead(estado),
    avisar_equipe: leitura.acao !== 'sem_aviso',
    classificador_falhou: leitura.classificadorFalhou,
    classificacao: {
      tipo: leitura.tipoClassificado,
      porque: leitura.porque,
      falhou: leitura.classificadorFalhou,
      recusa: leitura.recusa,
    },
  });
}

// Nó 8a "Subiu para Alerta?" (v4.2): a ação de entrada `transferir` passa a
// `alerta_saude` ou `perda`, `chave_texto` idem (com a regra de ativação do
// nó 2), `enviar_texto` verdadeiro, e o fluxo volta ao nó 3 antes do nó 12.
export function subirParaAlerta(estado) {
  const acao = estado.decisao === 'perda' || estado.motivo === 'perda' ? 'perda' : 'alerta_saude';
  return derivarEstado({
    ...estado,
    acao,
    motivo: acao === 'perda' ? 'perda' : 'saude',
    prioridade_minima: 'maxima',
    chave_texto: chaveTextoAlerta({
      acao,
      chaveTexto: acao === 'perda' ? 'perda' : 'alerta_saude',
      ativacao: estado.ativacao ?? {},
    }),
    enviar_texto: true,
    subiu_para_alerta: true,
  });
}

// ---------------------------------------------------------------------------
// Nós 12 a 15: registro, pausa e deduplicação.
// ---------------------------------------------------------------------------

// Parâmetros de `agente.registrar_handoff($1..$7)` (Apêndice A): conversa_id,
// motivo, resumo, solicitacao, dados, origem, texto_familia. O que o fluxo
// decidiu vai em `dados._fluxo2`, para o banco aplicar a prioridade mínima,
// manter as opções no texto do grupo e preencher `{mensagem_enviada}`.
export function prepararRegistro(estado) {
  const dadosHandoff = {
    ...(estado.dados ?? {}),
    _fluxo2: {
      acao: estado.acao,
      motivo_agente: estado.motivo_agente,
      prioridade_minima: estado.prioridade_minima,
      manter_opcoes: estado.manter_opcoes === true,
      classificador_falhou: estado.classificador_falhou === true,
      classificacao_tipo: estado.classificacao?.tipo ?? null,
      classificacao_porque: estado.classificacao?.porque ?? null,
      classificacao_recusa: estado.classificacao?.recusa ?? null,
      subiu_para_alerta: estado.subiu_para_alerta === true,
      chave_texto: estado.chave_texto,
      enviar_texto: estado.enviar_texto === true,
      mensagem_enviada: estado.mensagem_enviada,
      envio_alerta_erro: estado.envio_alerta_erro,
      modo: estado.modo,
    },
  };
  return {
    ...estado,
    registro_dados_json: JSON.stringify(dadosHandoff),
  };
}

function listaDePlantao(plantao) {
  if (!Array.isArray(plantao)) return [];
  return plantao
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return textoOuVazio(item.jid ?? item.telefone ?? item.numero);
      return '';
    })
    .filter((numero) => numero.length > 0);
}

export function lerRegistroHandoff(estado, respostaRegistro) {
  const resultado = falhouChamada(respostaRegistro) ? null : lerJsonb(respostaRegistro.resultado);
  const handoffId = textoOuVazio(resultado?.handoff_id);
  const registroOk = resultado?.ok === true && handoffId.length > 0;
  const ehAlerta = ehAcaoDeAlerta(estado.acao);

  const pausaHoras = Number(resultado?.pausa_horas);
  const humanoComercial = resultado?.humano_comercial === true;
  const pausaComPrazo = registroOk && !humanoComercial && Number.isFinite(pausaHoras) && pausaHoras > 0;

  const duplicado = registroOk && resultado?.duplicado === true;
  const nuncaDeduplica = ehAlerta || MOTIVOS_NUNCA_DEDUPLICADOS.includes(estado.motivo);
  const plantao = registroOk ? listaDePlantao(resultado?.plantao) : [];

  let instrucaoChave;
  if (ehAlerta) instrucaoChave = 'instrucao_saude';
  else if (!registroOk) instrucaoChave = 'instrucao_erro';
  else instrucaoChave = textoOuVazio(resultado?.instrucao_chave) || instrucaoChaveDoMotivo(estado.motivo);

  return {
    ...estado,
    registro_ok: registroOk,
    registro_erro: registroOk
      ? null
      : falhouChamada(respostaRegistro)
        ? descreverErro(respostaRegistro)
        : textoOuVazio(resultado?.erro) || 'registrar_handoff sem handoff_id',
    handoff_id: registroOk ? handoffId : null,
    duplicado,
    atualizacao: registroOk && resultado?.atualizacao === true,
    duplicado_sem_aviso: duplicado && !nuncaDeduplica,
    mensagem_grupo: registroOk ? textoOuVazio(resultado?.mensagem_grupo) || null : null,
    grupo_jid: registroOk ? textoOuVazio(resultado?.grupo_jid) || null : null,
    plantao,
    tem_plantao: plantao.length > 0,
    humano_comercial: humanoComercial,
    pausa_horas: pausaComPrazo ? pausaHoras : null,
    pausa_com_prazo: pausaComPrazo,
    pausa_ttl_segundos: pausaComPrazo ? Math.round(pausaHoras * 3600) : null,
    usar_grupo_reserva: !registroOk && ehAlerta,
    ok: registroOk,
    instrucao: registroOk ? textoOuVazio(resultado?.instrucao_agente) || null : null,
    instrucao_chave: instrucaoChave,
  };
}

// ---------------------------------------------------------------------------
// Nó 13, ramo sem banco: aviso ao grupo de reserva (PRD 19.1 e 23.3).
// ---------------------------------------------------------------------------

export function montarAvisoReserva(estado, { modelo, jid }) {
  const telefone = textoOuVazio(estado.telefone) || textoOuVazio(estado.wa_jid);
  const texto = String(modelo ?? '')
    .split('{telefone}')
    .join(telefone)
    .split('{texto_familia}')
    .join(textoOuVazio(estado.texto_familia));
  return {
    ...estado,
    aviso_reserva_jid: jid,
    aviso_reserva_texto: texto,
  };
}

// ---------------------------------------------------------------------------
// Nós 16 a 18: grupo, plantão em lote e registro da notificação.
// ---------------------------------------------------------------------------

export function montarAvisosPlantao(estado) {
  return (estado.plantao ?? []).map((numero) => ({
    numero,
    texto: estado.mensagem_grupo,
    handoff_id: estado.handoff_id,
  }));
}

export function consolidarNotificacao(estado, respostaGrupo, respostasPlantao = []) {
  const grupoOk = Boolean(estado.grupo_jid && estado.mensagem_grupo) && !falhouChamada(respostaGrupo);
  const falhasPlantao = respostasPlantao.filter((resposta) => falhouChamada(resposta)).length;

  const erros = [];
  if (!estado.grupo_jid) erros.push('grupo: registrar_handoff sem grupo_jid');
  else if (!estado.mensagem_grupo) erros.push('grupo: registrar_handoff sem mensagem_grupo');
  else if (!grupoOk) erros.push(`grupo: ${descreverErro(respostaGrupo)}`);
  if (falhasPlantao > 0) erros.push(`plantão: ${falhasPlantao} de ${respostasPlantao.length} avisos falharam`);

  return {
    ...estado,
    notificacao_grupo_ok: grupoOk,
    notificacao_plantao_enviados: respostasPlantao.length - falhasPlantao,
    notificacao_ok: grupoOk && falhasPlantao === 0,
    notificacao_erro: erros.length > 0 ? erros.join('; ') : null,
  };
}

// ---------------------------------------------------------------------------
// Nós 9 a 11 e 19: não lead, sem aviso e retorno.
// ---------------------------------------------------------------------------

// `marcar_nao_lead` recebe o tipo da classificação de contato; o
// classificador de pedido não distingue candidata, fornecedor e consultório,
// então vale o que a ficha trouxer, ou `outro`.
export function tipoNaoLead(estado) {
  const tipo = estado.dados?.tipo_contato;
  return ['candidata', 'fornecedor', 'consultorio', 'outro'].includes(tipo) ? tipo : 'outro';
}

export function lerNaoLead(estado, respostaMarcar) {
  const resultado = falhouChamada(respostaMarcar) ? null : lerJsonb(respostaMarcar.resultado);
  const ok = resultado?.ok === true;
  return {
    ...estado,
    ok,
    handoff_id: null,
    instrucao: ok ? textoOuVazio(resultado?.instrucao_agente) || null : null,
    instrucao_chave: ok ? 'instrucao_nao_lead' : 'instrucao_erro',
  };
}

export function lerInstrucaoSemAviso(estado, respostaInstrucao) {
  const resultado = falhouChamada(respostaInstrucao) ? null : lerJsonb(respostaInstrucao.resultado);
  return {
    ...estado,
    ok: true,
    handoff_id: null,
    instrucao: textoOuVazio(resultado?.texto) || null,
    instrucao_chave: 'instrucao_sem_aviso',
  };
}

// Campos do nó 19 "Retorno" (`{ok, handoff_id, instrucao}`, mais a chave da
// instrução, para o fluxo 3 reconhecer `instrucao_saude` mesmo sem banco).
export function montarRetorno(estado) {
  return {
    ok: estado.ok === true,
    handoff_id: estado.handoff_id ?? null,
    instrucao: estado.instrucao ?? null,
    instrucao_chave: estado.instrucao_chave ?? 'instrucao_erro',
    motivo: estado.motivo ?? null,
    acao: estado.acao ?? null,
  };
}
