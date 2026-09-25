// Decisões de modo e de alerta do fluxo 3 (PRD 19.4 nós 15 a 22 e 11.7).
// Funções puras, embutidas nos nós Code; os testes importam as mesmas.
//
// A ordem é a regra de segurança do fluxo: o nó 16 "Parar Aqui?" só para
// `desligado` e número da equipe ou do plantão; todo o resto (inclusive teste
// fora da lista, pausado, humano_nominal, humano_comercial e banco fora do
// ar) passa pelo filtro de termos e pelo classificador (nós 17 a 20) antes do
// "Decidir Modo" (nó 21). O modo muda só o texto que a família recebe.
//
// Contrato esperado do banco (P21):
// - pode_responder(conversa_id) -> {ok, modo, agente_modo, na_whitelist,
//   pausa, motivo, agente_encerrado_motivo, alerta_internacao_ativo,
//   alerta_emocional_ativo, alerta_saude_sensivel_ativo}. `modo` em vendas,
//   cliente, humano_nominal, humano_comercial, nao_lead, pausado, desligado,
//   teste (fora da lista) ou silencio (equipe e plantão). Os três
//   `*_ativo` são os parâmetros de ativação dos textos clínicos (11.11 itens
//   2a e 2b, K-20): o fluxo não lê `parametro` sozinho.
// - checar_termos_alerta(texto) -> {ok, alerta, acao, termo, mensagem_chave}.
// - contexto_conversa(conversa_id, limite) -> {ok, mensagens: [{de, texto}]}.

import { lerClassificacaoMensagem } from './ler-classificacao-mensagem.js';
import { MODOS_DO_AGENTE, enviarTextoPorModo } from './modos.js';
import { comMarca, resultadoDoBanco, conteudoOpenAi, descreverErro, textoLimpo } from './resultado-no.js';

export const TIPOS_NAO_LEAD_NO_INICIO = ['candidata', 'fornecedor', 'consultorio', 'parceiro_medico'];
// `registrar_mensagem.classificacao` devolve o enum de `conversa.classificacao`,
// que inclui `nao_classificado` (ADR 0003, divergência 1): a conversa ainda
// não classificada não é `null`, é esta string. O nó 22 "Não Lead no Início?"
// precisa tratar as duas como "ainda não classificada".
export const CLASSIFICACAO_NAO_CLASSIFICADA = 'nao_classificado';
const MODOS_DO_CLASSIFICADOR = ['vendas', 'cliente', 'pausado', 'nao_lead', 'humano_nominal', 'humano_comercial'];

// Nó "Ler Pode Responder", depois do nó 15, e a regra do nó 16.
export function lerPodeResponder(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  const bancoFora = resultado === null;
  const conversaNaoEncontrada = !bancoFora && resultado.ok !== true;
  const modoBanco = bancoFora ? null : textoLimpo(resultado.modo) || null;
  const agenteModo = bancoFora ? null : textoLimpo(resultado.agente_modo) || null;
  const naWhitelist = resultado?.na_whitelist === true;

  const equipe = estado.numero_equipe === true || estado.numero_plantao === true || modoBanco === 'silencio';
  const desligado = agenteModo === 'desligado' || modoBanco === 'desligado';
  const testeForaDaLista = !desligado && !equipe && (modoBanco === 'teste' || (agenteModo === 'teste' && !naWhitelist));

  let modo;
  if (bancoFora) modo = 'desconhecido';
  else if (conversaNaoEncontrada) modo = 'vendas';
  else if (testeForaDaLista) modo = 'teste_fora_lista';
  else modo = modoBanco ?? 'desconhecido';

  const parar = desligado || equipe;
  return comMarca({
    ...estado,
    banco_fora: bancoFora,
    conversa_nao_encontrada: conversaNaoEncontrada,
    pode_responder_erro: bancoFora ? descreverErro(resposta) : conversaNaoEncontrada ? textoLimpo(resultado.erro) || 'conversa não encontrada' : null,
    modo,
    modo_banco: modoBanco,
    agente_modo: agenteModo,
    na_whitelist: naWhitelist,
    teste_fora_lista: testeForaDaLista,
    parar,
    razao_parada: desligado ? 'desligado' : equipe ? 'equipe_ou_plantao' : null,
    motivo_encerramento: textoLimpo(resultado?.agente_encerrado_motivo) || null,
    ativacao: {
      alerta_internacao_ativo: resultado?.alerta_internacao_ativo === true,
      alerta_emocional_ativo: resultado?.alerta_emocional_ativo === true,
      alerta_saude_sensivel_ativo: resultado?.alerta_saude_sensivel_ativo === true,
    },
    enviar_texto_alerta: enviarTextoPorModo(modo),
  });
}

// Nó "Ler Termos", depois do nó 17. Falha do filtro não bloqueia o
// classificador (PRD 19.4 nó 15).
export function lerTermos(estado, resposta) {
  const resultado = resultadoDoBanco(resposta);
  return comMarca({
    ...estado,
    termos_falhou: resultado === null,
    termo: {
      alerta: resultado?.alerta === true,
      acao: textoLimpo(resultado?.acao) || null,
      chaveTexto: textoLimpo(resultado?.mensagem_chave ?? resultado?.chave) || null,
      termo: textoLimpo(resultado?.termo) || null,
    },
  });
}

const ROTULOS = { familia: 'Família', cliente: 'Família' };

// Últimas mensagens antes do pedido atual, no formato do prompt
// `classificar-mensagem.md` ("Família: ..." e "Kraamzorg: ...").
export function historicoParaClassificador(mensagens, limite) {
  const lista = Array.isArray(mensagens) ? mensagens.filter((m) => m && typeof m === 'object') : [];
  let corte = lista.length;
  while (corte > 0 && ROTULOS[lista[corte - 1].de]) corte -= 1;
  const anteriores = lista.slice(0, corte).slice(-limite);
  if (anteriores.length === 0) return '(sem conversa anterior)';
  return anteriores.map((m) => `${ROTULOS[m.de] ?? 'Kraamzorg'}: ${textoLimpo(m.texto)}`).join('\n');
}

// Nó "Preparar Classificação da Mensagem", depois do "Buscar Histórico".
export function prepararClassificacaoMensagem(estado, respostaContexto, { limite = 12 } = {}) {
  const contexto = resultadoDoBanco(respostaContexto);
  return comMarca({
    ...estado,
    historico_texto: historicoParaClassificador(contexto?.mensagens, limite),
    mensagem_texto: estado.texto_agrupado || '(mensagem sem texto)',
    modo_classificador: MODOS_DO_CLASSIFICADOR.includes(estado.modo_banco) ? estado.modo_banco : 'vendas',
  });
}

// Rota do nó 21 "Decidir Modo" (só roda sem alerta).
export function rotaDoModo(estado) {
  if (estado.banco_fora || estado.conversa_nao_encontrada || estado.teste_fora_lista) return 'parar';
  if (MODOS_DO_AGENTE.includes(estado.modo)) return 'seguir';
  if (estado.modo === 'humano_nominal') return 'humano_nominal';
  if (estado.modo === 'humano_comercial') return 'humano_comercial';
  return 'parar';
}

// Nó 19 "Ler Classificação": decide o alerta (nenhum, saúde, perda) e a chave
// do texto, e já calcula a rota do nó 21 e a regra do nó 22.
export function aplicarClassificacaoMensagem(estado, respostaOpenAi) {
  const ativacao = estado.ativacao ?? {};
  const leitura = lerClassificacaoMensagem({
    termoAlerta: estado.termo ?? { alerta: false, acao: null, chaveTexto: null },
    saidaModelo: conteudoOpenAi(respostaOpenAi),
    parametrosAtivacao: {
      alertaInternacaoAtivo: ativacao.alerta_internacao_ativo === true,
      alertaEmocionalAtivo: ativacao.alerta_emocional_ativo === true,
    },
  });
  const rota = rotaDoModo(estado);
  const semClassificacao = !estado.classificacao_conversa || estado.classificacao_conversa === CLASSIFICACAO_NAO_CLASSIFICADA;
  return comMarca({
    ...estado,
    alerta: leitura.alerta,
    tem_alerta: leitura.alerta !== 'nenhum',
    chave_texto_alerta: leitura.chaveTexto,
    perda_temporalidade: leitura.perdaTemporalidade,
    tipo_contato: leitura.tipoContato,
    classificador_falhou: leitura.classificadorFalhou,
    origem_alerta: estado.termo?.alerta === true ? 'filtro_termos' : 'classificador',
    rota_modo: rota,
    nao_lead_no_inicio: rota === 'seguir' && semClassificacao && TIPOS_NAO_LEAD_NO_INICIO.includes(leitura.tipoContato),
    eh_parceiro_medico: leitura.tipoContato === 'parceiro_medico',
  });
}
