// Fluxo 3: Agente Isadora, entrada via webhook (PRD 19.4 v4.2, P25).
//
// Entrada A (nós 1 a 35) e entrada B (nós 36 a 41) com os nomes do PRD. Onde
// o PRD descreve um nó como várias chamadas (nó 8, 14, 23, 24, 32, 35, 40,
// 41), cada chamada vira um nó. Nós Code curtos ("Ler ...", "Preparar ...",
// "Conferir ...") juntam o estado do fluxo com o resultado da chamada
// anterior, porque os nós Postgres, HTTP e Execute Workflow trocam o item
// inteiro pela resposta. Toda regra mora nas funções puras de
// `n8n/src/code/`; os nós If e Switch só leem campos já calculados.
//
// A ordem é a regra de segurança: filtro de termos e classificador (nós 17 a
// 20) antes do "Decidir Modo" (nó 21) e do desvio de mídia (nó 24); o nó 16
// só para `desligado` e número da equipe ou do plantão; depois do "Caminho de
// Alerta" (nó 20) a execução termina em todos os modos (nenhuma conexão do
// ramo de alerta chega ao nó 26). `n8n/fluxo-3.test.mjs` confere tudo isso
// pelas conexões.
//
// A chave de toda chamada ao banco é o `conversa_id` lido do nó "Registrar
// Msg Família" (ou "Registrar Msg Humana") por expressão; o jid vem do
// "Extrair Dados" e só serve para enviar (CLAUDE.md, PRD 19.1 e Apêndice A).
//
// Nenhum texto para a família ou para a equipe mora aqui: vem das funções do
// banco. Exceções do config, documentadas: o aviso ao grupo de reserva
// (`grupoFallbackTexto`, PRD 19.1 e 23.3), o resumo "IA fora do ar" (19.4 nó
// 26) e a linha da mídia com legenda que vai ao agente (19.4 nó 24).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { criarNotaCabecalho } from './lib/no.mjs';
import { aplicarConfiguracoesFluxo } from './lib/settings.mjs';
import { idEstavel } from './lib/id-estavel.mjs';
import { carregarPromptSync, trocarVariaveisPorExpressoes, variaveisDoPrompt } from './lib/prompts.mjs';
import { criarConstrutor, credencialDoConfig } from './lib/construtor.mjs';
import { destinoUazapi, corpoEnvioTexto, corpoEnvioDocumento, CAMINHOS_UAZAPI } from './lib/uazapi.mjs';
import { URL_OPENAI_CHAT, corpoChatJson } from './lib/openai.mjs';
import { ENTRADAS as ENTRADAS_FLUXO2 } from './fluxo-2-pausar-notificar.mjs';
import { VARIAVEIS_PROMPT_ISADORA } from './code/contexto-agente.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_CODE = path.join(AQUI, 'code');
const DIR_PROMPTS = path.join(AQUI, '..', 'prompts');

export const FLUXO_CHAVE = 'kraamzorg-fluxo-3-agente-isadora';
export const NOME_FLUXO = 'Kraamzorg · Agente Isadora (Entrada via Webhook)';

// Nomes dos nós, num lugar só: os testes usam os mesmos.
export const NOS = {
  // Entrada A
  webhook: 'Webhook UAZAPI',
  validarOrigem: 'Validar Origem',
  extrairDados: 'Extrair Dados',
  ehGrupo: 'É Grupo?',
  filtroFromMe: 'Filtro FromMe',
  ecoDoAgente: 'Eco do Agente?',
  registrarMsgHumana: 'Registrar Msg Humana',
  pausarPorHumano: 'Pausar por Humano',
  lerPausaHumana: 'Ler Pausa por Humano',
  pausaHumanaComPrazo: 'Pausa com Prazo?',
  redisPausaHumana: 'Redis Pausa por Humano',
  memoriaEquipe: 'Memória: Fala da Equipe',
  registrarMsgFamilia: 'Registrar Msg Família',
  estadoMensagem: 'Estado da Mensagem',
  tipoMensagem: 'Tipo de Mensagem',
  transcreverAudio: 'Transcrever Áudio',
  lerTranscricao: 'Ler Transcrição',
  transcreveu: 'Transcreveu?',
  registrarTranscricao: 'Registrar Transcrição',
  conferirGravacao: 'Conferir Gravação da Transcrição',
  prepararAgrupamento: 'Preparar Agrupamento',
  agrupar: 'Agrupar?',
  agruparMensagens: 'Agrupar Mensagens',
  esperarAgrupamento: 'Esperar Agrupamento',
  lerMensagensAgrupadas: 'Redis Ler Mensagens',
  decidirAgrupamento: 'Decidir Agrupamento',
  ultimaMensagem: 'Última Mensagem?',
  limparAgrupamento: 'Redis Limpar Mensagens',
  estadoAgrupado: 'Estado Agrupado',
  podeResponder: 'Pode Responder?',
  lerPodeResponder: 'Ler Pode Responder',
  pararAqui: 'Parar Aqui?',
  checarTermos: 'Checar Termos de Alerta',
  lerTermos: 'Ler Termos',
  buscarHistorico: 'Buscar Histórico',
  prepararClassificacao: 'Preparar Classificação da Mensagem',
  montarPromptMensagem: 'Montar Prompt da Mensagem',
  classificarMensagem: 'Classificar Mensagem',
  lerClassificacao: 'Ler Classificação',
  temAlerta: 'Tem Alerta?',
  prepararAlerta: 'Preparar Alerta',
  caminhoDeAlerta: 'Caminho de Alerta',
  conferirCaminhoAlerta: 'Conferir Caminho de Alerta',
  alertaSemFluxo2: 'Fluxo 2 Falhou no Alerta?',
  audioNaoTranscrito: 'Áudio Não Transcrito?',
  prepararAudio: 'Preparar Áudio Não Transcrito',
  transferirAudio: 'Transferir Áudio Não Transcrito',
  lerTransferenciaAudio: 'Ler Transferência de Áudio',
  enviarTextoAudioSe: 'Enviar Texto de Áudio?',
  buscarTextoAudio: 'Buscar Texto de Áudio',
  lerTextoAudio: 'Ler Texto de Áudio',
  temTextoAudio: 'Tem Texto de Áudio?',
  enviarTextoAudio: 'Enviar Texto de Áudio',
  conferirEnvioAudio: 'Conferir Envio de Áudio',
  audioSaiu: 'Áudio Saiu?',
  registrarTextoAudio: 'Registrar Texto de Áudio',
  decidirModo: 'Decidir Modo',
  prepararEstadoSensivel: 'Preparar Estado Sensível',
  avisarEstadoSensivel: 'Avisar Estado Sensível',
  prepararAcrescimo: 'Preparar Acréscimo',
  acrescentarHandoff: 'Acrescentar ao Handoff Aberto',
  naoLeadNoInicio: 'Não Lead no Início?',
  parceiroMedico: 'Parceiro Médico?',
  prepararParceiro: 'Preparar Parceiro Médico',
  transferirParceiro: 'Transferir Parceiro Médico',
  respostaNaoLead: 'Resposta Não Lead',
  lerNaoLead: 'Ler Não Lead',
  temMidia: 'Tem Mídia?',
  prepararMidia: 'Preparar Mídia',
  midiaRecebida: 'Mídia Recebida',
  lerTransferenciaMidia: 'Ler Transferência de Mídia',
  midiaSemLegenda: 'Mídia Sem Legenda?',
  buscarTextoSistema: 'Buscar Texto do Sistema',
  lerTextoSistema: 'Ler Texto do Sistema',
  temTextoSistema: 'Tem Texto do Sistema?',
  podeEnviarSistema: 'Pode Enviar Texto do Sistema',
  lerPodeEnviarSistema: 'Ler Pode Enviar do Sistema',
  liberadoSistema: 'Liberado para Enviar?',
  enviarTextoSistema: 'Enviar Texto do Sistema',
  conferirTextoSistema: 'Conferir Texto do Sistema',
  textoSistemaSaiu: 'Texto do Sistema Saiu?',
  registrarTextoSistema: 'Registrar Texto do Sistema',
  estadoParaAgente: 'Estado para o Agente',
  montarContexto: 'Montar Contexto do Agente',
  prepararEntradaAgente: 'Preparar Entrada do Agente',
  fichaOk: 'Ficha OK?',
  agente: 'Agente Isadora',
  modeloConversa: 'Modelo de Conversa',
  memoria: 'Memória Postgres',
  embeddings: 'Embeddings text-3-small',
  lerSaidaAgente: 'Ler Saída do Agente',
  iaDecidiuResponder: 'IA Decidiu Responder?',
  modeloFalhou: 'Modelo Falhou?',
  prepararIaForaDoAr: 'Preparar Aviso de IA Fora do Ar',
  avisarIaForaDoAr: 'Avisar IA Fora do Ar',
  lerAvisoIaForaDoAr: 'Ler Aviso de IA Fora do Ar',
  iaSemRegistro: 'IA Fora do Ar sem Registro?',
  montarAvisoReserva: 'Montar Aviso de Reserva',
  avisarGrupoReserva: 'Avisar Grupo de Reserva',
  validarResposta: 'Validar Resposta',
  respostaAprovada: 'Resposta Aprovada?',
  montarPromptReescrita: 'Montar Prompt da Reescrita',
  reescrever: 'Reescrever',
  lerReescrita: 'Ler Reescrita',
  reescritaAprovada: 'Reescrita Aprovada?',
  transferirPelaReescritaSe: 'Transferir pela Reescrita?',
  prepararTransferenciaReescrita: 'Preparar Transferência da Reescrita',
  transferirPelaReescrita: 'Transferir pela Reescrita',
  lerTransferenciaReescrita: 'Ler Transferência da Reescrita',
  buscarFallback: 'Buscar Fallback',
  lerFallback: 'Ler Fallback',
  prepararTransferenciaValidacao: 'Preparar Transferência da Validação',
  transferirValidacao: 'Transferir Validação',
  lerTransferenciaValidacao: 'Ler Transferência da Validação',
  prepararEnvio: 'Preparar Envio',
  temEnvio: 'Tem Envio?',
  faltouApresentacao: 'Faltou Apresentação?',
  reconsultar: 'Reconsultar Antes de Enviar',
  lerReconsulta: 'Ler Reconsulta',
  podeEnviar: 'Pode Enviar?',
  separarBlocos: 'Separar Blocos',
  loopEnvio: 'Loop de Envio',
  ehApresentacao: 'É Apresentação?',
  enviarApresentacao: 'Enviar Apresentação',
  conferirApresentacao: 'Conferir Envio da Apresentação',
  enviarTexto: 'Enviar Texto',
  conferirTexto: 'Conferir Envio do Texto',
  esperarEntreBlocos: 'Esperar Entre Blocos',
  separarEnviosFeitos: 'Separar Envios Feitos',
  registrarEnvio: 'Registrar Envio',
  consolidarEnvio: 'Consolidar Envio',
  pdfSaiu: 'PDF Saiu?',
  registrarPdf: 'Registrar PDF Enviado',
  textoSaiu: 'Texto Saiu?',
  memoriaIa: 'Memória: Fala da IA',
  // Entrada B
  aCada30Min: 'A Cada 30 Min',
  buscarFollowups: 'Buscar Follow-ups Devidos',
  separarFollowups: 'Separar Follow-ups',
  montarPromptFollowup: 'Montar Prompt do Follow-up',
  gerarMensagem: 'Gerar Mensagem',
  validarFollowup: 'Validar',
  followupAprovado: 'Follow-up Aprovado?',
  reconsultarEEnviar: 'Reconsultar e Enviar',
  lerReconsultaFollowup: 'Ler Reconsulta do Follow-up',
  podeEnviarFollowup: 'Pode Enviar Follow-up?',
  enviarFollowup: 'Enviar Follow-up',
  conferirFollowup: 'Conferir Envio do Follow-up',
  fecharFollowup: 'Fechar Follow-up',
  registrarFollowup: 'Registrar Follow-up',
  followupSaiu: 'Follow-up Saiu?',
  memoriaFollowup: 'Memória: Follow-up',
};

// As nove ferramentas da 11.9. O nome do nó é o nome que o modelo vê (PGVector
// 1.3 e Tool Workflow 2.2 tiram o nome da ferramenta do nome do nó).
export const FERRAMENTAS = {
  baseConhecimento: 'base_conhecimento',
  consultarPlanos: 'consultar_planos',
  verificarCobertura: 'verificar_cobertura',
  verificarDisponibilidade: 'verificar_disponibilidade',
  atualizarFicha: 'atualizar_ficha',
  registrarRetorno: 'registrar_retorno',
  marcarNaoContatar: 'marcar_nao_contatar',
  transferirParaEquipe: 'transferir_para_equipe',
  acionarEquipeSaude: 'acionar_equipe_saude',
};

// Expressões de chave (CLAUDE.md, PRD 19.1): o `conversa_id` sai sempre do
// resultado de `agente.registrar_mensagem`; o jid, do "Extrair Dados".
export const EXPR_CONVERSA = `$(${JSON.stringify(NOS.registrarMsgFamilia)}).item.json.resultado.conversa_id`;
export const EXPR_CONVERSA_HUMANA = `$(${JSON.stringify(NOS.registrarMsgHumana)}).item.json.resultado.conversa_id`;
export const EXPR_JID = `$(${JSON.stringify(NOS.extrairDados)}).item.json.jid`;
const EXPR_DADOS = (campo) => `$(${JSON.stringify(NOS.extrairDados)}).item.json.${campo}`;
const EXPR_ENTRADA_AGENTE = (campo) => `$(${JSON.stringify(NOS.prepararEntradaAgente)}).item.json.${campo}`;

// Últimas mensagens que o classificador de mensagem recebe (PRD 19.4 nó 18).
const HISTORICO_CLASSIFICADOR = 12;

// Variáveis dos prompts -> campo do estado.
export const VARIAVEIS_PROMPT_CLASSIFICAR_MENSAGEM = {
  historico: '$json.historico_texto',
  mensagem: '$json.mensagem_texto',
  modo: '$json.modo_classificador',
};
export const VARIAVEIS_PROMPT_REESCREVER = {
  resposta: '$json.texto_para_reescrita',
  violacoes: '$json.violacoes_texto',
  ultima_mensagem: '$json.texto_agrupado',
};
export const VARIAVEIS_PROMPT_FOLLOWUP = {
  texto_base: '$json.texto_base',
  nome: '$json.nome',
  data_hora: '$json.data_hora',
  ultimas_mensagens: '$json.ultimas_mensagens_texto',
  tempo_sem_resposta: '$json.tempo_sem_resposta',
};
export const VARIAVEIS_PROMPT_ISADORA_EXPR = Object.fromEntries(
  VARIAVEIS_PROMPT_ISADORA.map((variavel) => [variavel, `$json.prompt[${JSON.stringify(variavel)}]`]),
);

export function promptComExpressoes(arquivo, mapa) {
  const prompt = carregarPromptSync(path.join(DIR_PROMPTS, arquivo));
  const faltando = variaveisDoPrompt(prompt).filter((nome) => !(nome in mapa));
  if (faltando.length > 0) {
    throw new Error(`${arquivo} usa variáveis sem expressão no fluxo 3: ${faltando.join(', ')}`);
  }
  return trocarVariaveisPorExpressoes(prompt, mapa);
}

// Descrições das ferramentas (o modelo lê; não vão para a família).
const DESCRICOES = {
  base_conhecimento:
    'Busca na base de conhecimento aprovada da Kraamzorg: como o cuidado funciona, perguntas frequentes, objeções, políticas, evidências e depoimentos. Pesquise com as palavras da família. Não serve para dúvida clínica.',
  consultar_planos: 'Lista os planos vigentes com valores e parcelas. Use só se o bloco de planos do contexto vier vazio.',
  verificar_cobertura:
    'Confere se a cidade e o bairro onde a família vai estar depois da alta são atendidos. Devolve atendida, confirmar, nao_atendida ou desconhecida. Nunca use o DDD do telefone.',
  verificar_disponibilidade:
    'Confere se há disponibilidade para a DPP na cidade. Devolve disponivel ou confirmar_com_equipe. Precisa da DPP.',
  atualizar_ficha:
    'Registra na ficha cada dado novo que a família contou (nome, para quem, semanas ou DPP, cidade, bairro, primeiro bebê, gêmeos, rede de apoio, principal preocupação como tema curto, plano de interesse, pagamento preferido, origem) e as marcas quer_contratar, sem_interesse e historico_sensivel (sem detalhe). Nunca registra perda.',
  registrar_retorno: 'Registra que a família pediu para ser chamada depois, com a data combinada ou as semanas-alvo.',
  marcar_nao_contatar: 'Registra o pedido explícito da família para não receber mais mensagens.',
  transferir_para_equipe:
    'Transfere para a equipe nas situações de "Quando passar para a equipe", exceto saúde e perda. Devolve uma instrução; siga a instrução ao pé da letra.',
  acionar_equipe_saude:
    'Aciona a coordenação diante de sinal de saúde ou notícia de perda. O sistema envia a mensagem aprovada e avisa a equipe; depois disso a resposta é só [SILENCIO].',
};

function schemaDoFluxo2() {
  return ENTRADAS_FLUXO2.map((entrada) => ({
    id: entrada.name,
    displayName: entrada.name,
    required: false,
    defaultMatch: false,
    display: true,
    canBeUsedToMatch: true,
    type: entrada.type,
    removed: false,
  }));
}

function workflowInputsFluxo2(valores) {
  const faltando = ENTRADAS_FLUXO2.map((entrada) => entrada.name).filter((nome) => !(nome in valores));
  if (faltando.length > 0) throw new Error(`chamada ao fluxo 2 sem as entradas: ${faltando.join(', ')}`);
  return {
    mappingMode: 'defineBelow',
    value: valores,
    matchingColumns: [],
    schema: schemaDoFluxo2(),
    attemptToConvertTypes: false,
    convertFieldsToString: false,
  };
}

function referenciaFluxo2(config) {
  const id = config?.fluxo?.idFluxo2;
  if (typeof id !== 'string' || !id) throw new Error('config.fluxo.idFluxo2 é obrigatório para o fluxo 3');
  return { __rl: true, mode: 'id', value: id };
}

// Entradas do fluxo 2 nas chamadas determinísticas: conteúdo de
// `$json.fluxo2` (montado pelas funções de `chamadas-fluxo2.js`); chave e jid
// por expressão dos nós de origem.
function entradasDeterministicas() {
  const valores = {};
  for (const { name } of ENTRADAS_FLUXO2) valores[name] = `={{ $json.fluxo2.${name} }}`;
  valores.conversa_id = `={{ ${EXPR_CONVERSA} }}`;
  valores.wa_jid = `={{ ${EXPR_JID} }}`;
  valores.nome = `={{ ${EXPR_DADOS('nome_whatsapp')} }}`;
  return valores;
}

export function montarFluxo(config) {
  const fluxoChave = FLUXO_CHAVE;
  const c = criarConstrutor({ fluxoChave, config, dirCode: DIR_CODE });
  const { ligar, ligarIA, se, escolha, postgres, code } = c;

  const destinoTexto = destinoUazapi(config, CAMINHOS_UAZAPI.texto);
  const destinoMidia = destinoUazapi(config, CAMINHOS_UAZAPI.midia);
  const destinoDownload = destinoUazapi(config, CAMINHOS_UAZAPI.download);
  const prefixo = config.redis.prefixo;
  const textos = config.textosSistema ?? {};
  const envio = config.envio ?? {};
  for (const campo of ['resumoIaForaDoAr', 'linhaMidia']) {
    if (typeof textos[campo] !== 'string' || !textos[campo]) throw new Error(`config.textosSistema.${campo} é obrigatório`);
  }

  const envioUazapi = (nome, destino, jsonBody, posicao) =>
    c.no(
      'httpRequest',
      nome,
      {
        method: 'POST',
        url: destino.url,
        ...destino.autenticacao,
        sendBody: true,
        specifyBody: 'json',
        jsonBody,
        options: { timeout: 15000 },
      },
      posicao,
      { credentials: destino.credentials, onError: 'continueRegularOutput' },
    );

  const chatOpenAi = (nome, modelo, expressaoPrompt, posicao) =>
    c.no(
      'httpRequest',
      nome,
      {
        method: 'POST',
        url: URL_OPENAI_CHAT,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'openAiApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: corpoChatJson(modelo, expressaoPrompt),
        options: { timeout: 30000 },
      },
      posicao,
      { credentials: { openAiApi: credencialDoConfig(config, 'openai') }, onError: 'continueRegularOutput' },
    );

  const montarPrompt = (nome, campo, prompt, posicao) =>
    c.no(
      'set',
      nome,
      {
        mode: 'manual',
        assignments: {
          assignments: [{ id: idEstavel(`${fluxoChave}:atribuicao:${nome}`), name: campo, type: 'string', value: `=${prompt}` }],
        },
        includeOtherFields: true,
        options: {},
      },
      posicao,
    );

  const chamarFluxo2 = (nome, posicao) =>
    c.no(
      'executeWorkflow',
      nome,
      {
        source: 'database',
        workflowId: referenciaFluxo2(config),
        workflowInputs: workflowInputsFluxo2(entradasDeterministicas()),
        mode: 'once',
        options: { waitForSubWorkflow: true },
      },
      posicao,
      { onError: 'continueRegularOutput' },
    );

  const redis = (nome, parametros, posicao) =>
    c.no('redis', nome, parametros, posicao, {
      credentials: { redis: credencialDoConfig(config, 'redis') },
      onError: 'continueRegularOutput',
    });

  const registrarMensagem = (nome, jid, direcao, enviadoPor, conteudo, tipo, messageId, posicao) =>
    postgres(
      nome,
      'select agente.registrar_mensagem($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as resultado',
      [jid, `'${direcao}'`, `'${enviadoPor}'`, conteudo, tipo, messageId, 'null', `${EXPR_DADOS('telefone')} || null`, 'null', 'null'],
      posicao,
    );

  c.adicionar(
    criarNotaCabecalho({
      fluxoChave,
      config,
      titulo: NOME_FLUXO,
      descricao:
        'Entrada A: mensagem recebida pela UAZAPI. Entrada B: follow-up a cada 30 min. O filtro de saúde (termos e classificador) roda antes de qualquer decisão de modo e do desvio de mídia, em todo modo menos desligado; depois de um alerta a execução termina. A chave de toda chamada ao banco é o conversa_id do "Registrar Msg Família"; o jid só envia (PRD 19.4).',
      posicao: [-2000, -700],
    }),
  );

  // -------------------------------------------------------------------------
  // Entrada A, nós 1 a 10
  // -------------------------------------------------------------------------
  c.no(
    'webhook',
    NOS.webhook,
    { httpMethod: 'POST', path: config.webhooks.fluxo3Entrada, authentication: 'none', responseMode: 'onReceived', options: {} },
    [-2000, 0],
    { webhookId: idEstavel(`${fluxoChave}:webhookId:${NOS.webhook}`) },
  );
  const instancia = JSON.stringify(config.uazapi.instancia);
  se(
    NOS.validarOrigem,
    `Boolean($json.body) && $json.body.EventType === 'messages' && [$json.body.instanceName, $json.body.instance].includes(${instancia})`,
    [-1780, 0],
  );
  code(NOS.extrairDados, 'extrair-dados.js', 'return { json: extrairDadosMensagem($json.body) };', [-1560, 0]);
  se(NOS.ehGrupo, '$json.eh_grupo === true', [-1340, 0]);
  se(NOS.filtroFromMe, '$json.from_me === true', [-1120, 0]);
  se(NOS.ecoDoAgente, '$json.eh_eco === true', [-900, -400]);
  registrarMensagem(NOS.registrarMsgHumana, '$json.jid', 'saida', 'humano', '$json.texto', '$json.tipo', '$json.message_id', [-680, -400]);
  postgres(NOS.pausarPorHumano, 'select agente.pausar($1, $2, $3) as resultado', [EXPR_CONVERSA_HUMANA, 'null', "'humano_digitou'"], [-460, -400]);
  code(NOS.lerPausaHumana, 'entrada-mensagem.js', 'return { json: lerPausa($json) };', [-240, -400]);
  se(NOS.pausaHumanaComPrazo, '$json.pausa_ok === true', [-20, -400]);
  redis(
    NOS.redisPausaHumana,
    {
      operation: 'set',
      key: `=${prefixo}pausa:{{ ${EXPR_CONVERSA_HUMANA} }}`,
      value: 'humano_digitou',
      keyType: 'automatic',
      expire: true,
      ttl: '={{ $json.pausa_ttl_segundos }}',
    },
    [200, -500],
  );
  postgres(
    NOS.memoriaEquipe,
    'select agente.sincronizar_memoria($1, $2, $3) as resultado',
    [EXPR_CONVERSA_HUMANA, "'equipe'", EXPR_DADOS('texto')],
    [420, -400],
  );

  registrarMensagem(NOS.registrarMsgFamilia, '$json.jid', 'entrada', 'cliente', '$json.texto', '$json.tipo', '$json.message_id', [-900, 200]);
  code(
    NOS.estadoMensagem,
    'entrada-mensagem.js',
    `return { json: iniciarEstado($(${JSON.stringify(NOS.extrairDados)}).item.json, $json) };`,
    [-680, 200],
  );

  // 11. Tipo de Mensagem
  escolha(NOS.tipoMensagem, '$json.tipo_mensagem', ['texto', 'midia', 'audio'], [-460, 200]);

  // 12 e 13. Transcrever Áudio / Registrar Transcrição
  envioUazapi(
    NOS.transcreverAudio,
    destinoDownload,
    '={{ { id: $json.message_id, transcribe: true, return_base64: false, return_link: false } }}',
    [-240, 400],
  );
  code(
    NOS.lerTranscricao,
    'entrada-mensagem.js',
    `return { json: lerTranscricao($(${JSON.stringify(NOS.estadoMensagem)}).item.json, $json) };`,
    [-20, 400],
  );
  se(NOS.transcreveu, '$json.transcricao_ok === true', [200, 400]);
  postgres(NOS.registrarTranscricao, 'select agente.registrar_transcricao($1, $2) as resultado', ['$json.message_id', '$json.texto'], [420, 500]);
  code(
    NOS.conferirGravacao,
    'entrada-mensagem.js',
    `return { json: conferirGravacaoTranscricao($(${JSON.stringify(NOS.transcreveu)}).item.json, $json) };`,
    [640, 500],
  );

  // 14. Agrupar Mensagens (hash no Redis com TTL, espera, leitura, decisão,
  // limpeza). Falha do Redis segue sem agrupar.
  code(NOS.prepararAgrupamento, 'entrada-mensagem.js', 'return { json: prepararAgrupamento($json) };', [860, 200]);
  se(NOS.agrupar, '$json.agrupar === true', [1080, 200]);
  const chaveBuffer = `=${prefixo}buf:{{ ${EXPR_CONVERSA} }}`;
  redis(
    NOS.agruparMensagens,
    {
      operation: 'set',
      key: chaveBuffer,
      value: '={{ $json.buffer_valor }}',
      keyType: 'hash',
      valueIsJSON: true,
      expire: true,
      ttl: Number(config.redis.ttlAgrupamentoSegundos),
    },
    [1300, 100],
  );
  c.no(
    'wait',
    NOS.esperarAgrupamento,
    { resume: 'timeInterval', amount: `={{ $(${JSON.stringify(NOS.prepararAgrupamento)}).item.json.agrupamento_segundos }}`, unit: 'seconds' },
    [1520, 100],
  );
  redis(
    NOS.lerMensagensAgrupadas,
    { operation: 'get', propertyName: 'buffer', key: chaveBuffer, keyType: 'hash', options: {} },
    [1740, 100],
  );
  code(
    NOS.decidirAgrupamento,
    'entrada-mensagem.js',
    `return { json: decidirAgrupamento($(${JSON.stringify(NOS.prepararAgrupamento)}).item.json, $json) };`,
    [1960, 100],
  );
  se(NOS.ultimaMensagem, '$json.deve_responder === true', [2180, 100]);
  redis(NOS.limparAgrupamento, { operation: 'delete', key: chaveBuffer }, [2400, 0]);
  code(NOS.estadoAgrupado, 'entrada-mensagem.js', 'return { json: fecharAgrupamento($json) };', [2620, 200]);

  // 15 e 16. Pode Responder? / Parar Aqui?
  postgres(NOS.podeResponder, 'select agente.pode_responder($1) as resultado', [EXPR_CONVERSA], [2840, 200]);
  code(
    NOS.lerPodeResponder,
    'modo-agente.js',
    `return { json: lerPodeResponder($(${JSON.stringify(NOS.estadoAgrupado)}).item.json, $json) };`,
    [3060, 200],
  );
  se(NOS.pararAqui, '$json.parar === true', [3280, 200]);

  // 17 a 19. Termos, histórico, classificador de mensagem.
  postgres(NOS.checarTermos, 'select agente.checar_termos_alerta($1) as resultado', ['$json.texto_agrupado'], [3500, 300]);
  code(NOS.lerTermos, 'modo-agente.js', `return { json: lerTermos($(${JSON.stringify(NOS.pararAqui)}).item.json, $json) };`, [3720, 300]);
  postgres(NOS.buscarHistorico, 'select agente.contexto_conversa($1, $2) as resultado', [EXPR_CONVERSA, String(HISTORICO_CLASSIFICADOR + 8)], [3940, 300]);
  code(
    NOS.prepararClassificacao,
    'modo-agente.js',
    `return { json: prepararClassificacaoMensagem($(${JSON.stringify(NOS.lerTermos)}).item.json, $json, { limite: ${HISTORICO_CLASSIFICADOR} }) };`,
    [4160, 300],
  );
  montarPrompt(
    NOS.montarPromptMensagem,
    'prompt_classificador',
    promptComExpressoes('classificar-mensagem.md', VARIAVEIS_PROMPT_CLASSIFICAR_MENSAGEM),
    [4380, 300],
  );
  chatOpenAi(NOS.classificarMensagem, config.modelos.classificadores, '$json.prompt_classificador', [4600, 300]);
  code(
    NOS.lerClassificacao,
    'modo-agente.js',
    `return { json: aplicarClassificacaoMensagem($(${JSON.stringify(NOS.montarPromptMensagem)}).item.json, $json) };`,
    [4820, 300],
  );
  se(NOS.temAlerta, '$json.tem_alerta === true', [5040, 300]);

  // 20. Caminho de Alerta: depois dele a execução termina em todos os modos.
  code(NOS.prepararAlerta, 'chamadas-fluxo2.js', 'return { json: prepararAlerta($json) };', [5260, 0]);
  chamarFluxo2(NOS.caminhoDeAlerta, [5480, 0]);
  code(
    NOS.conferirCaminhoAlerta,
    'chamadas-fluxo2.js',
    `return { json: lerRetornoFluxo2($(${JSON.stringify(NOS.prepararAlerta)}).item.json, $json, { reserva: 'se_nao_rodou' }) };`,
    [5700, 0],
  );
  se(NOS.alertaSemFluxo2, '$json.usar_grupo_reserva === true', [5920, 0]);

  // Grupo de reserva (alerta sem fluxo 2 ou IA fora do ar sem registro).
  code(
    NOS.montarAvisoReserva,
    'chamadas-fluxo2.js',
    `return { json: montarAvisoReserva($json, { modelo: ${JSON.stringify(config.grupoFallbackTexto)}, jid: ${JSON.stringify(config.grupoFallbackJid)} }) };`,
    [6140, -100],
  );
  envioUazapi(
    NOS.avisarGrupoReserva,
    destinoTexto,
    corpoEnvioTexto('$json.aviso_reserva_jid', '$json.aviso_reserva_texto'),
    [6360, -100],
  );

  // 21. Antes do switch: áudio que não foi transcrito.
  se(NOS.audioNaoTranscrito, '$json.audio_nao_transcrito === true', [5260, 600]);
  code(NOS.prepararAudio, 'chamadas-fluxo2.js', 'return { json: prepararAudioNaoTranscrito($json) };', [5480, 500]);
  chamarFluxo2(NOS.transferirAudio, [5700, 500]);
  code(
    NOS.lerTransferenciaAudio,
    'chamadas-fluxo2.js',
    `return { json: lerRetornoFluxo2($(${JSON.stringify(NOS.prepararAudio)}).item.json, $json) };`,
    [5920, 500],
  );
  se(NOS.enviarTextoAudioSe, '$json.enviar_texto_audio === true', [6140, 500]);
  postgres(NOS.buscarTextoAudio, 'select agente.mensagem_sistema($1, $2) as resultado', [EXPR_CONVERSA, "'audio_nao_transcrito'"], [6360, 400]);
  code(
    NOS.lerTextoAudio,
    'envio-sistema.js',
    `return { json: lerTextoDoSistema($(${JSON.stringify(NOS.enviarTextoAudioSe)}).item.json, $json) };`,
    [6580, 400],
  );
  se(NOS.temTextoAudio, '$json.tem_texto_sistema === true', [6800, 400]);
  envioUazapi(NOS.enviarTextoAudio, destinoTexto, corpoEnvioTexto(EXPR_JID, '$json.texto_sistema'), [7020, 400]);
  code(
    NOS.conferirEnvioAudio,
    'envio-sistema.js',
    `return { json: conferirEnvio($(${JSON.stringify(NOS.temTextoAudio)}).item.json, $json) };`,
    [7240, 400],
  );
  se(NOS.audioSaiu, '$json.envio_saiu === true', [7460, 400]);
  registrarMensagem(NOS.registrarTextoAudio, EXPR_JID, 'saida', 'sistema', '$json.texto_sistema', "'texto'", '$json.envio_message_id', [7680, 400]);

  // 21. Decidir Modo
  escolha(NOS.decidirModo, '$json.rota_modo', ['seguir', 'humano_nominal', 'humano_comercial', 'parar'], [5480, 900]);
  code(NOS.prepararEstadoSensivel, 'chamadas-fluxo2.js', 'return { json: prepararEstadoSensivel($json) };', [5700, 1100]);
  chamarFluxo2(NOS.avisarEstadoSensivel, [5920, 1100]);
  code(NOS.prepararAcrescimo, 'chamadas-fluxo2.js', 'return { json: prepararAcrescimo($json) };', [5700, 1300]);
  chamarFluxo2(NOS.acrescentarHandoff, [5920, 1300]);

  // 22 e 23. Não lead no início.
  se(NOS.naoLeadNoInicio, '$json.nao_lead_no_inicio === true', [5700, 800]);
  se(NOS.parceiroMedico, '$json.eh_parceiro_medico === true', [5920, 700]);
  code(NOS.prepararParceiro, 'chamadas-fluxo2.js', 'return { json: prepararParceiroMedico($json) };', [6140, 600]);
  chamarFluxo2(NOS.transferirParceiro, [6360, 600]);
  postgres(NOS.respostaNaoLead, 'select agente.marcar_nao_lead($1, $2) as resultado', [EXPR_CONVERSA, '$json.tipo_contato'], [6140, 750]);
  code(
    NOS.lerNaoLead,
    'envio-sistema.js',
    `return { json: lerNaoLead($(${JSON.stringify(NOS.parceiroMedico)}).item.json, $json) };`,
    [6360, 750],
  );

  // 24. Mídia Recebida.
  se(NOS.temMidia, '$json.midia === true', [5920, 900]);
  code(NOS.prepararMidia, 'chamadas-fluxo2.js', 'return { json: prepararMidia($json) };', [6140, 900]);
  chamarFluxo2(NOS.midiaRecebida, [6360, 900]);
  code(
    NOS.lerTransferenciaMidia,
    'chamadas-fluxo2.js',
    `return { json: lerTransferenciaMidia($(${JSON.stringify(NOS.prepararMidia)}).item.json, $json) };`,
    [6580, 900],
  );
  se(NOS.midiaSemLegenda, '$json.sem_legenda === true', [6800, 900]);
  postgres(NOS.buscarTextoSistema, 'select agente.mensagem_sistema($1, $2) as resultado', [EXPR_CONVERSA, '$json.chave_texto_sistema'], [7020, 850]);
  code(
    NOS.lerTextoSistema,
    'envio-sistema.js',
    `return { json: lerTextoDoSistema($(${JSON.stringify(NOS.midiaSemLegenda)}).item.json, $json) };`,
    [7240, 850],
  );

  // Texto do sistema com `pode_enviar` (mídia sem legenda e não lead).
  se(NOS.temTextoSistema, '$json.tem_texto_sistema === true', [7460, 750]);
  postgres(
    NOS.podeEnviarSistema,
    'select agente.pode_enviar($1, $2, $3) as resultado',
    [EXPR_CONVERSA, "'resposta'", '$json.handoff_id_execucao || null'],
    [7680, 750],
  );
  code(
    NOS.lerPodeEnviarSistema,
    'envio-sistema.js',
    `return { json: lerPodeEnviar($(${JSON.stringify(NOS.temTextoSistema)}).item.json, $json) };`,
    [7900, 750],
  );
  se(NOS.liberadoSistema, '$json.pode_enviar === true', [8120, 750]);
  envioUazapi(NOS.enviarTextoSistema, destinoTexto, corpoEnvioTexto(EXPR_JID, '$json.texto_sistema'), [8340, 750]);
  code(
    NOS.conferirTextoSistema,
    'envio-sistema.js',
    `return { json: conferirEnvio($(${JSON.stringify(NOS.liberadoSistema)}).item.json, $json) };`,
    [8560, 750],
  );
  se(NOS.textoSistemaSaiu, '$json.envio_saiu === true', [8780, 750]);
  registrarMensagem(NOS.registrarTextoSistema, EXPR_JID, 'saida', 'sistema', '$json.texto_sistema', "'texto'", '$json.envio_message_id', [9000, 750]);

  // 25. Montar Contexto do Agente.
  code(NOS.estadoParaAgente, null, 'return { json: $json };', [7020, 1100]);
  postgres(NOS.montarContexto, 'select agente.ficha_para_agente($1) as resultado', [EXPR_CONVERSA], [7240, 1100]);
  code(
    NOS.prepararEntradaAgente,
    'contexto-agente.js',
    `return { json: prepararEntradaAgente($(${JSON.stringify(NOS.estadoParaAgente)}).item.json, $json, { linhaMidia: ${JSON.stringify(textos.linhaMidia)}, nomesMidia: ${JSON.stringify(textos.nomesMidia ?? {})} }) };`,
    [7460, 1100],
  );
  se(NOS.fichaOk, '$json.ficha_ok === true', [7680, 1100]);

  // 26. Agente Isadora, com modelo, memória e as nove ferramentas.
  const sistema = promptComExpressoes('isadora-system.md', VARIAVEIS_PROMPT_ISADORA_EXPR);
  c.no(
    'agent',
    NOS.agente,
    {
      promptType: 'define',
      text: '={{ $json.entrada_agente }}',
      hasOutputParser: false,
      needsFallback: false,
      options: { systemMessage: `=${sistema}`, maxIterations: 10, returnIntermediateSteps: true, enableStreaming: false },
    },
    [7900, 1100],
    { onError: 'continueRegularOutput' },
  );

  const modelo = config.modelos.conversa;
  const opcoesModelo = {};
  if (modelo.aceitaTemperatura === true) opcoesModelo.temperature = Number(modelo.temperatura);
  if (modelo.reasoningEffort) opcoesModelo.reasoningEffort = modelo.reasoningEffort;
  c.no(
    'lmChatOpenAi',
    NOS.modeloConversa,
    { model: { __rl: true, mode: 'list', value: modelo.modelo }, options: opcoesModelo },
    [7700, 1400],
    { credentials: { openAiApi: credencialDoConfig(config, 'openai') } },
  );
  c.no(
    'memoryPostgresChat',
    NOS.memoria,
    { sessionIdType: 'customKey', sessionKey: `={{ ${EXPR_CONVERSA} }}`, tableName: 'chat_memoria', contextWindowLength: 30 },
    [7880, 1400],
    { credentials: { postgres: credencialDoConfig(config, 'postgres') } },
  );
  c.no(
    'vectorStorePGVector',
    FERRAMENTAS.baseConhecimento,
    {
      mode: 'retrieve-as-tool',
      toolDescription: DESCRICOES.base_conhecimento,
      tableName: 'documentos',
      topK: 5,
      includeDocumentMetadata: true,
      useReranker: false,
      options: {
        columnNames: {
          values: { idColumnName: 'id', vectorColumnName: 'embedding', contentColumnName: 'text', metadataColumnName: 'metadata' },
        },
        distanceStrategy: 'cosine',
      },
    },
    [8060, 1400],
    { credentials: { postgres: credencialDoConfig(config, 'postgres') } },
  );
  c.no(
    'embeddingsOpenAi',
    NOS.embeddings,
    { model: config.modelos.embeddings.modelo, options: {} },
    [8060, 1600],
    { credentials: { openAiApi: credencialDoConfig(config, 'openai') } },
  );

  const ferramentaPostgres = (nome, query, parametros, posicao) =>
    c.no(
      'postgresTool',
      nome,
      {
        resource: 'database',
        operation: 'executeQuery',
        query,
        descriptionType: 'manual',
        toolDescription: DESCRICOES[nome],
        options: parametros.length > 0 ? { queryReplacement: `={{ [ ${parametros.join(', ')} ] }}` } : {},
      },
      posicao,
      { credentials: { postgres: credencialDoConfig(config, 'postgres') } },
    );
  ferramentaPostgres(FERRAMENTAS.consultarPlanos, 'select agente.planos_vigentes() as resultado', [], [8240, 1400]);
  ferramentaPostgres(
    FERRAMENTAS.verificarCobertura,
    'select agente.verificar_cobertura($1, $2, $3) as resultado',
    [
      "$fromAI('cidade', 'cidade onde a família vai estar depois da alta, como ela escreveu', 'string')",
      "$fromAI('bairro', 'bairro, ou vazio se não souber', 'string')",
      "$fromAI('uf', 'sigla do estado, ou vazio se não souber', 'string')",
    ],
    [8420, 1400],
  );
  ferramentaPostgres(
    FERRAMENTAS.verificarDisponibilidade,
    'select agente.verificar_disponibilidade($1, $2) as resultado',
    [
      "$fromAI('dpp', 'data provável do parto em dd/mm/aaaa', 'string')",
      "$fromAI('cidade', 'cidade onde a família vai estar depois da alta', 'string')",
    ],
    [8600, 1400],
  );
  ferramentaPostgres(
    FERRAMENTAS.atualizarFicha,
    'select agente.atualizar_lead($1, $2) as resultado',
    [EXPR_CONVERSA, "JSON.stringify($fromAI('dados', 'objeto só com os campos novos que a família contou', 'json'))"],
    [8780, 1400],
  );
  ferramentaPostgres(
    FERRAMENTAS.registrarRetorno,
    "select agente.registrar_marco($1, 'proximo_contato', $2) as resultado",
    [EXPR_CONVERSA, "$fromAI('quando', 'data combinada em dd/mm/aaaa ou semanas-alvo', 'string')"],
    [8960, 1400],
  );
  ferramentaPostgres(
    FERRAMENTAS.marcarNaoContatar,
    "select agente.registrar_marco($1, 'nao_contatar', null) as resultado",
    [EXPR_CONVERSA],
    [9140, 1400],
  );

  const fixosDaFerramenta = {
    wa_jid: `={{ ${EXPR_JID} }}`,
    conversa_id: `={{ ${EXPR_CONVERSA} }}`,
    nome: `={{ ${EXPR_DADOS('nome_whatsapp')} }}`,
    texto_familia: `={{ ${EXPR_ENTRADA_AGENTE('texto_agrupado')} }}`,
    chave_texto: '',
    origem_chamada: 'agente',
    modo: `={{ ${EXPR_ENTRADA_AGENTE('modo_banco')} }}`,
    telefone: `={{ ${EXPR_DADOS('telefone')} }}`,
    alerta_internacao_ativo: `={{ ${EXPR_ENTRADA_AGENTE('ativacao.alerta_internacao_ativo')} === true }}`,
    alerta_emocional_ativo: `={{ ${EXPR_ENTRADA_AGENTE('ativacao.alerta_emocional_ativo')} === true }}`,
    prioridade_minima: '',
  };
  const ferramentaFluxo2 = (nome, valores, posicao) =>
    c.no(
      'toolWorkflow',
      nome,
      {
        description: DESCRICOES[nome],
        source: 'database',
        workflowId: referenciaFluxo2(config),
        workflowInputs: workflowInputsFluxo2({ ...fixosDaFerramenta, ...valores }),
      },
      posicao,
    );
  ferramentaFluxo2(
    FERRAMENTAS.transferirParaEquipe,
    {
      acao: 'transferir',
      motivo: "={{ $fromAI('motivo', 'um motivo de Quando passar para a equipe: contratar, reuniao, condicao_comercial, cobertura_taxa, reembolso_fiscal, bebe_nasceu, pos_venda_operacao, reclamacao, pediu_humano, parceiro_medico, duvida_sem_resposta ou outro', 'string') }}",
      resumo: "={{ $fromAI('resumo', 'uma ou duas frases só com o que a família disse', 'string') }}",
      solicitacao: "={{ $fromAI('solicitacao', 'o pedido com as palavras da família', 'string') }}",
      dados: "={{ $fromAI('dados', 'o que ajuda a equipe: opções de horário, plano, pagamento preferido, para quem é', 'json') }}",
      enviar_texto: false,
      tipo: '',
    },
    [9320, 1400],
  );
  ferramentaFluxo2(
    FERRAMENTAS.acionarEquipeSaude,
    {
      acao: 'alerta_saude',
      motivo: 'saude',
      tipo: "={{ $fromAI('tipo', 'saude, internacao, emocional ou perda', 'string') }}",
      resumo: "={{ $fromAI('resumo', 'uma frase com o que a família contou', 'string') }}",
      solicitacao: '',
      dados: '={{ {} }}',
      enviar_texto: true,
    },
    [9500, 1400],
  );

  ligarIA(NOS.modeloConversa, NOS.agente, 'ai_languageModel');
  ligarIA(NOS.memoria, NOS.agente, 'ai_memory');
  ligarIA(NOS.embeddings, FERRAMENTAS.baseConhecimento, 'ai_embedding');
  for (const ferramenta of Object.values(FERRAMENTAS)) ligarIA(ferramenta, NOS.agente, 'ai_tool');

  // 27. IA Decidiu Responder?
  code(
    NOS.lerSaidaAgente,
    'saida-agente.js',
    [
      'let saudeExecutada = false;',
      `try { saudeExecutada = $(${JSON.stringify(FERRAMENTAS.acionarEquipeSaude)}).isExecuted === true; } catch (erro) { saudeExecutada = false; }`,
      `return { json: lerSaidaAgente($(${JSON.stringify(NOS.prepararEntradaAgente)}).item.json, $json, { saudeExecutada }) };`,
    ].join('\n'),
    [8120, 1100],
  );
  se(NOS.iaDecidiuResponder, '$json.responder === true', [8340, 1100]);
  se(NOS.modeloFalhou, '$json.modelo_falhou === true', [8560, 1300]);

  // IA fora do ar (ou ficha que não veio, ou apresentação indisponível).
  code(
    NOS.prepararIaForaDoAr,
    'chamadas-fluxo2.js',
    `return { json: prepararIaForaDoAr($json, { resumo: ${JSON.stringify(textos.resumoIaForaDoAr)} }) };`,
    [8780, 1500],
  );
  chamarFluxo2(NOS.avisarIaForaDoAr, [9000, 1500]);
  code(
    NOS.lerAvisoIaForaDoAr,
    'chamadas-fluxo2.js',
    `return { json: lerRetornoFluxo2($(${JSON.stringify(NOS.prepararIaForaDoAr)}).item.json, $json, { reserva: 'se_nao_registrou' }) };`,
    [9220, 1500],
  );
  se(NOS.iaSemRegistro, '$json.usar_grupo_reserva === true', [9440, 1500]);

  // 28 e 29. Validar Resposta / Reescrever.
  code(NOS.validarResposta, 'resposta-agente.js', 'return { json: validarRespostaDoAgente($json) };', [8560, 1000]);
  se(NOS.respostaAprovada, '$json.resposta_aprovada === true', [8780, 1000]);
  montarPrompt(
    NOS.montarPromptReescrita,
    'prompt_reescrita',
    promptComExpressoes('reescrever-resposta.md', VARIAVEIS_PROMPT_REESCREVER),
    [9000, 1150],
  );
  chatOpenAi(NOS.reescrever, config.modelos.classificadores, '$json.prompt_reescrita', [9220, 1150]);
  code(
    NOS.lerReescrita,
    'resposta-agente.js',
    `return { json: lerReescrita($(${JSON.stringify(NOS.montarPromptReescrita)}).item.json, $json) };`,
    [9440, 1150],
  );
  se(NOS.reescritaAprovada, '$json.reescrita_aprovada === true', [9660, 1150]);
  se(NOS.transferirPelaReescritaSe, '$json.tem_transferencia_reescrita === true', [9880, 1050]);
  code(
    NOS.prepararTransferenciaReescrita,
    'chamadas-fluxo2.js',
    'return { json: prepararTransferenciaReescrita($json) };',
    [10100, 950],
  );
  chamarFluxo2(NOS.transferirPelaReescrita, [10320, 950]);
  code(
    NOS.lerTransferenciaReescrita,
    'chamadas-fluxo2.js',
    `return { json: lerRetornoFluxo2($(${JSON.stringify(NOS.prepararTransferenciaReescrita)}).item.json, $json) };`,
    [10540, 950],
  );
  postgres(NOS.buscarFallback, 'select agente.mensagem_sistema($1, $2) as resultado', [EXPR_CONVERSA, "'fallback_confirmar'"], [9880, 1300]);
  code(
    NOS.lerFallback,
    'resposta-agente.js',
    `return { json: lerFallback($(${JSON.stringify(NOS.reescritaAprovada)}).item.json, $json) };`,
    [10100, 1300],
  );
  code(NOS.prepararTransferenciaValidacao, 'chamadas-fluxo2.js', 'return { json: prepararTransferenciaValidacao($json) };', [10320, 1300]);
  chamarFluxo2(NOS.transferirValidacao, [10540, 1300]);
  code(
    NOS.lerTransferenciaValidacao,
    'chamadas-fluxo2.js',
    `return { json: lerRetornoFluxo2($(${JSON.stringify(NOS.prepararTransferenciaValidacao)}).item.json, $json) };`,
    [10760, 1300],
  );

  // 30 e 31. Preparar Envio / Reconsultar Antes de Enviar.
  code(
    NOS.prepararEnvio,
    'saida-agente.js',
    `return { json: prepararEnvioDoAgente($json, { agora: new Date().toISOString(), digitacao: { minimoMs: ${Number(envio.digitacaoMinimaMs)}, maximoMs: ${Number(envio.digitacaoMaximaMs)} }, intervaloSegundos: ${Number(envio.intervaloEntreBlocosSegundos) || 0} }) };`,
    [10980, 1100],
  );
  se(NOS.temEnvio, '$json.tem_envio === true', [11200, 1100]);
  se(NOS.faltouApresentacao, '$json.faltou_apresentacao === true', [11420, 1300]);
  postgres(
    NOS.reconsultar,
    'select agente.pode_enviar($1, $2, $3) as resultado',
    [EXPR_CONVERSA, "'resposta'", '$json.handoff_id_execucao || null'],
    [11420, 1000],
  );
  code(
    NOS.lerReconsulta,
    'envio-sistema.js',
    `return { json: lerPodeEnviar($(${JSON.stringify(NOS.temEnvio)}).item.json, $json) };`,
    [11640, 1000],
  );
  se(NOS.podeEnviar, '$json.pode_enviar === true', [11860, 1000]);

  // 32 a 34. Loop de Envio.
  c.no('splitOut', NOS.separarBlocos, { fieldToSplitOut: 'envios', include: 'noOtherFields', options: {} }, [12080, 1000]);
  c.no('splitInBatches', NOS.loopEnvio, { batchSize: 1, options: {} }, [12300, 1000]);
  se(NOS.ehApresentacao, "$json.tipo === 'documento'", [12520, 1100]);
  envioUazapi(NOS.enviarApresentacao, destinoMidia, corpoEnvioDocumento(EXPR_JID, '$json.arquivo', '$json.nome_arquivo'), [12740, 1000]);
  code(
    NOS.conferirApresentacao,
    'envio-sistema.js',
    `return { json: conferirEnvio($(${JSON.stringify(NOS.ehApresentacao)}).item.json, $json) };`,
    [12960, 1000],
  );
  envioUazapi(NOS.enviarTexto, destinoTexto, corpoEnvioTexto(EXPR_JID, '$json.texto', '$json.delay_ms'), [12740, 1200]);
  code(
    NOS.conferirTexto,
    'envio-sistema.js',
    `return { json: conferirEnvio($(${JSON.stringify(NOS.ehApresentacao)}).item.json, $json) };`,
    [12960, 1200],
  );
  c.no('wait', NOS.esperarEntreBlocos, { resume: 'timeInterval', amount: '={{ $json.espera_segundos }}', unit: 'seconds' }, [13180, 1100]);

  // 35. Registrar Envio, marco do PDF e memória com o que de fato saiu.
  code(
    NOS.separarEnviosFeitos,
    'saida-agente.js',
    'return $input.all().map((item, indice) => ({ json: item.json, pairedItem: indice })).filter((item) => separarEnviosFeitos([item.json]).length > 0);',
    [12520, 800],
    { modo: 'runOnceForAllItems' },
  );
  registrarMensagem(
    NOS.registrarEnvio,
    EXPR_JID,
    'saida',
    'ia',
    "$json.tipo === 'documento' ? $json.nome_arquivo : $json.texto",
    '$json.tipo',
    '$json.envio_message_id',
    [12740, 800],
  );
  code(
    NOS.consolidarEnvio,
    'saida-agente.js',
    `return [{ json: consolidarEnvio($(${JSON.stringify(NOS.separarEnviosFeitos)}).all().map((item) => item.json)), pairedItem: 0 }];`,
    [12960, 800],
    { modo: 'runOnceForAllItems' },
  );
  se(NOS.pdfSaiu, '$json.pdf_saiu === true', [13180, 800]);
  postgres(NOS.registrarPdf, "select agente.registrar_marco($1, 'pdf_enviado', null) as resultado", [EXPR_CONVERSA], [13400, 700]);
  se(NOS.textoSaiu, `$(${JSON.stringify(NOS.consolidarEnvio)}).item.json.textos_enviados > 0`, [13620, 800]);
  postgres(
    NOS.memoriaIa,
    'select agente.sincronizar_memoria($1, $2, $3) as resultado',
    [EXPR_CONVERSA, "'ia'", `$(${JSON.stringify(NOS.consolidarEnvio)}).item.json.texto_enviado`],
    [13840, 800],
  );

  // -------------------------------------------------------------------------
  // Entrada B, nós 36 a 41: follow-up agendado.
  // -------------------------------------------------------------------------
  c.no('scheduleTrigger', NOS.aCada30Min, { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } }, [-2000, 2200]);
  postgres(NOS.buscarFollowups, 'select agente.followups_devidos() as resultado', [], [-1780, 2200]);
  code(
    NOS.separarFollowups,
    'followup.js',
    'return separarFollowups($input.first().json).map((json) => ({ json, pairedItem: 0 }));',
    [-1560, 2200],
    { modo: 'runOnceForAllItems' },
  );
  montarPrompt(NOS.montarPromptFollowup, 'prompt_followup', promptComExpressoes('isadora-followup.md', VARIAVEIS_PROMPT_FOLLOWUP), [-1340, 2200]);
  chatOpenAi(NOS.gerarMensagem, config.modelos.followup, '$json.prompt_followup', [-1120, 2200]);
  code(
    NOS.validarFollowup,
    'validar-followup.js',
    `return { json: validarFollowup($(${JSON.stringify(NOS.montarPromptFollowup)}).item.json, $json) };`,
    [-900, 2200],
  );
  se(NOS.followupAprovado, '$json.followup_aprovado === true', [-680, 2200]);
  postgres(NOS.reconsultarEEnviar, 'select agente.pode_enviar($1, $2, $3) as resultado', ['$json.conversa_id', "'conteudo'", 'null'], [-460, 2100]);
  code(
    NOS.lerReconsultaFollowup,
    'envio-sistema.js',
    `return { json: lerPodeEnviar($(${JSON.stringify(NOS.followupAprovado)}).item.json, $json) };`,
    [-240, 2100],
  );
  se(NOS.podeEnviarFollowup, '$json.pode_enviar === true', [-20, 2100]);
  envioUazapi(NOS.enviarFollowup, destinoTexto, corpoEnvioTexto('$json.wa_jid', '$json.texto_followup'), [200, 2000]);
  code(
    NOS.conferirFollowup,
    'envio-sistema.js',
    `return { json: conferirEnvio($(${JSON.stringify(NOS.podeEnviarFollowup)}).item.json, $json) };`,
    [420, 2000],
  );
  code(NOS.fecharFollowup, 'followup.js', 'return { json: fecharFollowup($json) };', [640, 2200]);
  postgres(
    NOS.registrarFollowup,
    'select agente.registrar_followup($1, $2, $3) as resultado',
    ['$json.execucao_id', '$json.texto_enviado', '$json.followup_ok'],
    [860, 2200],
  );
  se(NOS.followupSaiu, `$(${JSON.stringify(NOS.fecharFollowup)}).item.json.followup_ok === true`, [1080, 2200]);
  postgres(
    NOS.memoriaFollowup,
    'select agente.sincronizar_memoria($1, $2, $3) as resultado',
    [`$(${JSON.stringify(NOS.fecharFollowup)}).item.json.conversa_id`, "'followup'", `$(${JSON.stringify(NOS.fecharFollowup)}).item.json.texto_enviado`],
    [1300, 2200],
  );

  // -------------------------------------------------------------------------
  // Conexões
  // -------------------------------------------------------------------------
  ligar(NOS.webhook, NOS.validarOrigem);
  ligar(NOS.validarOrigem, NOS.extrairDados, 0);
  ligar(NOS.extrairDados, NOS.ehGrupo);
  ligar(NOS.ehGrupo, NOS.filtroFromMe, 1);
  ligar(NOS.filtroFromMe, NOS.ecoDoAgente, 0);
  ligar(NOS.filtroFromMe, NOS.registrarMsgFamilia, 1);
  ligar(NOS.ecoDoAgente, NOS.registrarMsgHumana, 1);
  ligar(NOS.registrarMsgHumana, NOS.pausarPorHumano);
  ligar(NOS.pausarPorHumano, NOS.lerPausaHumana);
  ligar(NOS.lerPausaHumana, NOS.pausaHumanaComPrazo);
  ligar(NOS.pausaHumanaComPrazo, NOS.redisPausaHumana, 0);
  ligar(NOS.pausaHumanaComPrazo, NOS.memoriaEquipe, 1);
  ligar(NOS.redisPausaHumana, NOS.memoriaEquipe);

  ligar(NOS.registrarMsgFamilia, NOS.estadoMensagem);
  ligar(NOS.estadoMensagem, NOS.tipoMensagem);
  ligar(NOS.tipoMensagem, NOS.prepararAgrupamento, 0);
  ligar(NOS.tipoMensagem, NOS.prepararAgrupamento, 1);
  ligar(NOS.tipoMensagem, NOS.transcreverAudio, 2);
  ligar(NOS.transcreverAudio, NOS.lerTranscricao);
  ligar(NOS.lerTranscricao, NOS.transcreveu);
  ligar(NOS.transcreveu, NOS.registrarTranscricao, 0);
  ligar(NOS.transcreveu, NOS.prepararAgrupamento, 1);
  ligar(NOS.registrarTranscricao, NOS.conferirGravacao);
  ligar(NOS.conferirGravacao, NOS.prepararAgrupamento);

  ligar(NOS.prepararAgrupamento, NOS.agrupar);
  ligar(NOS.agrupar, NOS.agruparMensagens, 0);
  ligar(NOS.agrupar, NOS.estadoAgrupado, 1);
  ligar(NOS.agruparMensagens, NOS.esperarAgrupamento);
  ligar(NOS.esperarAgrupamento, NOS.lerMensagensAgrupadas);
  ligar(NOS.lerMensagensAgrupadas, NOS.decidirAgrupamento);
  ligar(NOS.decidirAgrupamento, NOS.ultimaMensagem);
  ligar(NOS.ultimaMensagem, NOS.limparAgrupamento, 0);
  ligar(NOS.limparAgrupamento, NOS.estadoAgrupado);

  ligar(NOS.estadoAgrupado, NOS.podeResponder);
  ligar(NOS.podeResponder, NOS.lerPodeResponder);
  ligar(NOS.lerPodeResponder, NOS.pararAqui);
  ligar(NOS.pararAqui, NOS.checarTermos, 1);
  ligar(NOS.checarTermos, NOS.lerTermos);
  ligar(NOS.lerTermos, NOS.buscarHistorico);
  ligar(NOS.buscarHistorico, NOS.prepararClassificacao);
  ligar(NOS.prepararClassificacao, NOS.montarPromptMensagem);
  ligar(NOS.montarPromptMensagem, NOS.classificarMensagem);
  ligar(NOS.classificarMensagem, NOS.lerClassificacao);
  ligar(NOS.lerClassificacao, NOS.temAlerta);

  ligar(NOS.temAlerta, NOS.prepararAlerta, 0);
  ligar(NOS.prepararAlerta, NOS.caminhoDeAlerta);
  ligar(NOS.caminhoDeAlerta, NOS.conferirCaminhoAlerta);
  ligar(NOS.conferirCaminhoAlerta, NOS.alertaSemFluxo2);
  ligar(NOS.alertaSemFluxo2, NOS.montarAvisoReserva, 0);
  ligar(NOS.montarAvisoReserva, NOS.avisarGrupoReserva);

  ligar(NOS.temAlerta, NOS.audioNaoTranscrito, 1);
  ligar(NOS.audioNaoTranscrito, NOS.prepararAudio, 0);
  ligar(NOS.audioNaoTranscrito, NOS.decidirModo, 1);
  ligar(NOS.prepararAudio, NOS.transferirAudio);
  ligar(NOS.transferirAudio, NOS.lerTransferenciaAudio);
  ligar(NOS.lerTransferenciaAudio, NOS.enviarTextoAudioSe);
  ligar(NOS.enviarTextoAudioSe, NOS.buscarTextoAudio, 0);
  ligar(NOS.buscarTextoAudio, NOS.lerTextoAudio);
  ligar(NOS.lerTextoAudio, NOS.temTextoAudio);
  ligar(NOS.temTextoAudio, NOS.enviarTextoAudio, 0);
  ligar(NOS.enviarTextoAudio, NOS.conferirEnvioAudio);
  ligar(NOS.conferirEnvioAudio, NOS.audioSaiu);
  ligar(NOS.audioSaiu, NOS.registrarTextoAudio, 0);

  ligar(NOS.decidirModo, NOS.naoLeadNoInicio, 0);
  ligar(NOS.decidirModo, NOS.prepararEstadoSensivel, 1);
  ligar(NOS.decidirModo, NOS.prepararAcrescimo, 2);
  ligar(NOS.prepararEstadoSensivel, NOS.avisarEstadoSensivel);
  ligar(NOS.prepararAcrescimo, NOS.acrescentarHandoff);

  ligar(NOS.naoLeadNoInicio, NOS.parceiroMedico, 0);
  ligar(NOS.naoLeadNoInicio, NOS.temMidia, 1);
  ligar(NOS.parceiroMedico, NOS.prepararParceiro, 0);
  ligar(NOS.parceiroMedico, NOS.respostaNaoLead, 1);
  ligar(NOS.prepararParceiro, NOS.transferirParceiro);
  ligar(NOS.respostaNaoLead, NOS.lerNaoLead);
  ligar(NOS.lerNaoLead, NOS.temTextoSistema);

  ligar(NOS.temMidia, NOS.prepararMidia, 0);
  ligar(NOS.temMidia, NOS.estadoParaAgente, 1);
  ligar(NOS.prepararMidia, NOS.midiaRecebida);
  ligar(NOS.midiaRecebida, NOS.lerTransferenciaMidia);
  ligar(NOS.lerTransferenciaMidia, NOS.midiaSemLegenda);
  ligar(NOS.midiaSemLegenda, NOS.buscarTextoSistema, 0);
  ligar(NOS.midiaSemLegenda, NOS.estadoParaAgente, 1);
  ligar(NOS.buscarTextoSistema, NOS.lerTextoSistema);
  ligar(NOS.lerTextoSistema, NOS.temTextoSistema);

  ligar(NOS.temTextoSistema, NOS.podeEnviarSistema, 0);
  ligar(NOS.podeEnviarSistema, NOS.lerPodeEnviarSistema);
  ligar(NOS.lerPodeEnviarSistema, NOS.liberadoSistema);
  ligar(NOS.liberadoSistema, NOS.enviarTextoSistema, 0);
  ligar(NOS.enviarTextoSistema, NOS.conferirTextoSistema);
  ligar(NOS.conferirTextoSistema, NOS.textoSistemaSaiu);
  ligar(NOS.textoSistemaSaiu, NOS.registrarTextoSistema, 0);

  ligar(NOS.estadoParaAgente, NOS.montarContexto);
  ligar(NOS.montarContexto, NOS.prepararEntradaAgente);
  ligar(NOS.prepararEntradaAgente, NOS.fichaOk);
  ligar(NOS.fichaOk, NOS.agente, 0);
  ligar(NOS.fichaOk, NOS.prepararIaForaDoAr, 1);
  ligar(NOS.agente, NOS.lerSaidaAgente);
  ligar(NOS.lerSaidaAgente, NOS.iaDecidiuResponder);
  ligar(NOS.iaDecidiuResponder, NOS.validarResposta, 0);
  ligar(NOS.iaDecidiuResponder, NOS.modeloFalhou, 1);
  ligar(NOS.modeloFalhou, NOS.prepararIaForaDoAr, 0);
  ligar(NOS.prepararIaForaDoAr, NOS.avisarIaForaDoAr);
  ligar(NOS.avisarIaForaDoAr, NOS.lerAvisoIaForaDoAr);
  ligar(NOS.lerAvisoIaForaDoAr, NOS.iaSemRegistro);
  ligar(NOS.iaSemRegistro, NOS.montarAvisoReserva, 0);

  ligar(NOS.validarResposta, NOS.respostaAprovada);
  ligar(NOS.respostaAprovada, NOS.prepararEnvio, 0);
  ligar(NOS.respostaAprovada, NOS.montarPromptReescrita, 1);
  ligar(NOS.montarPromptReescrita, NOS.reescrever);
  ligar(NOS.reescrever, NOS.lerReescrita);
  ligar(NOS.lerReescrita, NOS.reescritaAprovada);
  ligar(NOS.reescritaAprovada, NOS.transferirPelaReescritaSe, 0);
  ligar(NOS.reescritaAprovada, NOS.buscarFallback, 1);
  ligar(NOS.transferirPelaReescritaSe, NOS.prepararTransferenciaReescrita, 0);
  ligar(NOS.transferirPelaReescritaSe, NOS.prepararEnvio, 1);
  ligar(NOS.prepararTransferenciaReescrita, NOS.transferirPelaReescrita);
  ligar(NOS.transferirPelaReescrita, NOS.lerTransferenciaReescrita);
  ligar(NOS.lerTransferenciaReescrita, NOS.prepararEnvio);
  ligar(NOS.buscarFallback, NOS.lerFallback);
  ligar(NOS.lerFallback, NOS.prepararTransferenciaValidacao);
  ligar(NOS.prepararTransferenciaValidacao, NOS.transferirValidacao);
  ligar(NOS.transferirValidacao, NOS.lerTransferenciaValidacao);
  ligar(NOS.lerTransferenciaValidacao, NOS.prepararEnvio);

  ligar(NOS.prepararEnvio, NOS.temEnvio);
  ligar(NOS.temEnvio, NOS.reconsultar, 0);
  ligar(NOS.temEnvio, NOS.faltouApresentacao, 1);
  ligar(NOS.faltouApresentacao, NOS.prepararIaForaDoAr, 0);
  ligar(NOS.reconsultar, NOS.lerReconsulta);
  ligar(NOS.lerReconsulta, NOS.podeEnviar);
  ligar(NOS.podeEnviar, NOS.separarBlocos, 0);
  ligar(NOS.separarBlocos, NOS.loopEnvio);
  ligar(NOS.loopEnvio, NOS.separarEnviosFeitos, 0);
  ligar(NOS.loopEnvio, NOS.ehApresentacao, 1);
  ligar(NOS.ehApresentacao, NOS.enviarApresentacao, 0);
  ligar(NOS.ehApresentacao, NOS.enviarTexto, 1);
  ligar(NOS.enviarApresentacao, NOS.conferirApresentacao);
  ligar(NOS.enviarTexto, NOS.conferirTexto);
  ligar(NOS.conferirApresentacao, NOS.esperarEntreBlocos);
  ligar(NOS.conferirTexto, NOS.esperarEntreBlocos);
  ligar(NOS.esperarEntreBlocos, NOS.loopEnvio);
  ligar(NOS.separarEnviosFeitos, NOS.registrarEnvio);
  ligar(NOS.registrarEnvio, NOS.consolidarEnvio);
  ligar(NOS.consolidarEnvio, NOS.pdfSaiu);
  ligar(NOS.pdfSaiu, NOS.registrarPdf, 0);
  ligar(NOS.pdfSaiu, NOS.textoSaiu, 1);
  ligar(NOS.registrarPdf, NOS.textoSaiu);
  ligar(NOS.textoSaiu, NOS.memoriaIa, 0);

  ligar(NOS.aCada30Min, NOS.buscarFollowups);
  ligar(NOS.buscarFollowups, NOS.separarFollowups);
  ligar(NOS.separarFollowups, NOS.montarPromptFollowup);
  ligar(NOS.montarPromptFollowup, NOS.gerarMensagem);
  ligar(NOS.gerarMensagem, NOS.validarFollowup);
  ligar(NOS.validarFollowup, NOS.followupAprovado);
  ligar(NOS.followupAprovado, NOS.reconsultarEEnviar, 0);
  ligar(NOS.followupAprovado, NOS.fecharFollowup, 1);
  ligar(NOS.reconsultarEEnviar, NOS.lerReconsultaFollowup);
  ligar(NOS.lerReconsultaFollowup, NOS.podeEnviarFollowup);
  ligar(NOS.podeEnviarFollowup, NOS.enviarFollowup, 0);
  ligar(NOS.podeEnviarFollowup, NOS.fecharFollowup, 1);
  ligar(NOS.enviarFollowup, NOS.conferirFollowup);
  ligar(NOS.conferirFollowup, NOS.fecharFollowup);
  ligar(NOS.fecharFollowup, NOS.registrarFollowup);
  ligar(NOS.registrarFollowup, NOS.followupSaiu);
  ligar(NOS.followupSaiu, NOS.memoriaFollowup, 0);

  return {
    id: idEstavel(fluxoChave),
    name: NOME_FLUXO,
    nodes: c.nos,
    connections: c.conexoes,
    settings: aplicarConfiguracoesFluxo(config),
  };
}
