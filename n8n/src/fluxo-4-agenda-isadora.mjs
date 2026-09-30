// Fluxo 4: Agenda da Isadora (PRD 19.6 v4.3, D-19). É o serviço de agenda do
// agente e o único fluxo com nó do Google Calendar e com a credencial do
// Google (T-11). Duas entradas:
//
// Entrada A: chamado pelo fluxo 3 (as ferramentas consultar_horarios_edilaine,
// agendar_reuniao, remarcar_reuniao, cancelar_reuniao e consultar_equipe são
// `toolWorkflow` para este fluxo; a entrada B do fluxo 3 o chama com
// `conferir_evento` e `consultar`).
// Entrada B: a cada 30 minutos, compara as reuniões da Isadora dos próximos
// dias com o calendário (evento movido atualiza a sessão; evento apagado
// cancela a sessão e cria a tarefa da Edilaine). Não escreve à família.
//
// Como no fluxo 3: banco só pelo papel `n8n_agente` e funções do schema
// `agente`; `conversa_id` da chamada (o fluxo 3 o lê do "Registrar Msg
// Família"), nunca do modelo; o id do evento sempre de
// `agente.reuniao_da_conversa`; falha do Google nunca vira exceção para o
// modelo, vira o estado `indisponivel`. Toda regra mora em
// `n8n/src/code/agenda*.js`; os nós If e Switch só leem campos já calculados.
//
// Com `homologacao.agendaSimulada` ligado, os nós do Google Calendar viram
// chamadas HTTP à rota de captura do app (`/api/teste/agenda`), sem
// credencial: é o calendário de teste do P28. O build recusa `--env prod`
// com a opção ligada.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { criarNotaCabecalho } from './lib/no.mjs';
import { aplicarConfiguracoesFluxo } from './lib/settings.mjs';
import { idEstavel } from './lib/id-estavel.mjs';
import { criarConstrutor, credencialDoConfig } from './lib/construtor.mjs';
import { destinoUazapi, corpoEnvioTexto, CAMINHOS_UAZAPI } from './lib/uazapi.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_CODE = path.join(AQUI, 'code');

export const FLUXO_CHAVE = 'kraamzorg-fluxo-4-agenda-isadora';
export const NOME_FLUXO = 'Kraamzorg · Agenda da Isadora';

// Entradas do sub-fluxo (o `toolWorkflow` e o `executeWorkflow` do fluxo 3
// mapeiam exatamente estas). Nenhuma é id de evento, de calendário ou de
// sessão (PRD 11.14).
export const ENTRADAS = [
  { name: 'operacao', type: 'string' },
  { name: 'modo', type: 'string' },
  { name: 'conversa_id', type: 'string' },
  { name: 'id_opcao', type: 'string' },
  { name: 'preferencia', type: 'string' },
  { name: 'email', type: 'string' },
  { name: 'email_parceiro', type: 'string' },
  { name: 'motivo', type: 'string' },
  { name: 'tipo', type: 'string' },
  { name: 'pergunta', type: 'string' },
  { name: 'maximo', type: 'number' },
];

export const NOS = {
  // Entrada A
  quandoChamado: 'Quando Chamado',
  normalizarEntrada: 'Normalizar Entrada',
  buscarParametros: 'Parâmetros da Agenda',
  lerParametros: 'Ler Parâmetros',
  buscarReuniao: 'Reunião da Conversa',
  decidirRota: 'Ler Reunião e Decidir Rota',
  rotear: 'Rotear',
  prepararConsulta: 'Preparar Consulta',
  consultarOcupacao: 'Consultar Ocupação',
  calcularOpcoes: 'Calcular Opções',
  depoisDaConsulta: 'Depois da Consulta',
  registrarOpcoes: 'Registrar Opções',
  lerOpcoes: 'Ler Opções Registradas',
  prepararValidacao: 'Preparar Validação',
  validarOpcao: 'Validar Opção',
  lerOpcaoValidada: 'Ler Opção Validada',
  opcaoValida: 'Opção Válida?',
  registrarLivre: 'Registrar Conferência Livre',
  lerLivre: 'Ler Conferência Livre',
  registrarOcupado: 'Registrar Conferência Ocupada',
  lerOcupado: 'Ler Conferência Ocupada',
  depoisDaConferencia: 'Depois da Conferência',
  prepararEvento: 'Preparar Evento',
  criarEvento: 'Criar Evento',
  lerCriacao: 'Ler Criação do Evento',
  depoisDaCriacao: 'Depois da Criação',
  recuperarEvento: 'Recuperar Evento',
  lerRecuperacao: 'Ler Recuperação do Evento',
  registrarReuniao: 'Registrar Reunião',
  lerReuniao: 'Ler Reunião Registrada',
  depoisDoRegistro: 'Depois do Registro',
  prepararCompensacao: 'Preparar Compensação',
  apagarCriado: 'Apagar Evento Criado',
  lerCompensacao: 'Ler Compensação',
  lerEvento: 'Ler Evento',
  conferirOrigem: 'Conferir Origem do Evento',
  depoisDaOrigem: 'Depois da Origem',
  prepararMovimento: 'Preparar Movimento',
  moverEvento: 'Mover Evento',
  lerMovimento: 'Ler Movimento do Evento',
  movimentoOk: 'Movimento Confirmado?',
  registrarRemarcacao: 'Registrar Remarcação',
  lerRemarcacao: 'Ler Remarcação Registrada',
  apagarEvento: 'Apagar Evento',
  lerApagamento: 'Ler Apagamento do Evento',
  apagou: 'Apagou?',
  registrarCancelamento: 'Registrar Cancelamento',
  lerCancelamento: 'Ler Cancelamento Registrado',
  compararEvento: 'Comparar Evento',
  precisaSincronizar: 'Precisa Sincronizar?',
  sincronizarReuniao: 'Sincronizar Reunião',
  lerSincronizacao: 'Ler Sincronização',
  concluir: 'Concluir',
  depoisDeConcluir: 'Depois de Concluir',
  consultaEquipe: 'Consulta à Equipe',
  lerConsulta: 'Ler Consulta à Equipe',
  avisarGrupo: 'Avisar Grupo',
  lerAviso: 'Ler Aviso do Grupo',
  fecharConsulta: 'Fechar Consulta',
  lerConsultaNotificada: 'Ler Consulta Notificada',
  resposta: 'Resposta da Ferramenta',
  // Entrada B
  aCada30Min: 'A Cada 30 Min',
  sessoesASincronizar: 'Sessões a Sincronizar',
  separarSessoes: 'Separar Sessões',
  lerEventoDaSessao: 'Ler Evento da Sessão',
  compararESGravar: 'Comparar e Gravar',
  mudou: 'Mudou?',
  gravarSincronizacao: 'Gravar Sincronização',
};

// Rótulos das saídas dos nós Switch, num lugar só (os testes leem os mesmos).
export const ROTAS = ['consultar', 'validar_opcao', 'ler_evento', 'concluir'];
export const PROXIMOS_DA_CONSULTA = ['gravar_opcoes', 'livre', 'ocupado', 'concluir'];
export const ROTAS_DA_CONFERENCIA = ['concluir', 'preparar_evento', 'preparar_movimento'];
export const PROXIMOS_DA_CRIACAO = ['registrar', 'recuperar', 'compensar', 'concluir'];
export const PROXIMOS_DA_ORIGEM = ['validar_opcao', 'apagar', 'comparar', 'registrar_cancelamento', 'concluir'];
export const SAIDAS_DO_FECHAMENTO = ['consulta', 'aviso', 'notificada', 'resposta'];

function localizadorDoCalendario(valor) {
  return { __rl: true, mode: 'id', value: valor };
}

export function montarFluxo(config) {
  const fluxoChave = FLUXO_CHAVE;
  const c = criarConstrutor({ fluxoChave, config, dirCode: DIR_CODE });
  const { ligar, se, escolha, postgres, code } = c;

  const agenda = config.agenda ?? {};
  const calendarioDaReuniao = agenda.calendarId;
  if (typeof calendarioDaReuniao !== 'string' || !calendarioDaReuniao) {
    throw new Error('config.agenda.calendarId é obrigatório para o fluxo 4');
  }
  const calendarios = [calendarioDaReuniao, ...(Array.isArray(agenda.calendarIdsOcupacao) ? agenda.calendarIdsOcupacao : [])];
  const simulada = config.homologacao?.agendaSimulada === true;
  const textos = config.textosSistema?.agenda ?? {};
  for (const campo of ['perguntaHorario', 'perguntaReuniaoDaEquipe']) {
    if (typeof textos[campo] !== 'string' || !textos[campo]) throw new Error(`config.textosSistema.agenda.${campo} é obrigatório`);
  }

  // Nó do Google Calendar ou, na homologação simulada, a chamada equivalente à
  // rota de captura do app. As duas formas devolvem o mesmo formato (os
  // intervalos ocupados, o evento do Google ou o erro), então os nós Code
  // seguintes não sabem a diferença.
  const noCalendario = (nome, operacao, googleParametros, corpoSimulado, posicao) => {
    if (simulada) {
      const base = config.homologacao?.urlCaptura;
      if (typeof base !== 'string' || !base.startsWith('https://')) {
        throw new Error('homologacao.urlCaptura (https) é obrigatório com agendaSimulada ligado');
      }
      return c.no(
        'httpRequest',
        nome,
        {
          method: 'POST',
          url: `${base.replace(/\/$/, '')}/agenda/${operacao}`,
          authentication: 'none',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: `={{ ${corpoSimulado} }}`,
          options: { timeout: 15000 },
        },
        posicao,
        { onError: 'continueRegularOutput', ...(operacao === 'livre-ocupado' ? { alwaysOutputData: true } : {}) },
      );
    }
    return c.no('googleCalendar', nome, googleParametros, posicao, {
      credentials: { googleCalendarOAuth2Api: credencialDoConfig(config, 'googleCalendar') },
      onError: 'continueRegularOutput',
      ...(operacao === 'livre-ocupado' ? { alwaysOutputData: true } : {}),
    });
  };

  const destinoTexto = destinoUazapi(config, CAMINHOS_UAZAPI.texto);

  c.adicionar(
    criarNotaCabecalho({
      fluxoChave,
      config,
      titulo: NOME_FLUXO,
      descricao:
        'Serviço de agenda da reunião inicial com a Edilaine (PRD 11.14 e 19.6). Entrada A: chamado pelo fluxo 3 como ferramenta e como passo da entrada B. Entrada B: sincronização com o calendário a cada 30 minutos. Único fluxo com o nó do Google Calendar e com a credencial do Google. O id do evento vem sempre do banco (agente.reuniao_da_conversa); o retorno de sucesso só existe depois de o evento voltar do Google com id, link do Meet e o horário pedido.',
      posicao: [-2000, -900],
    }),
  );

  // -------------------------------------------------------------------------
  // Entrada A, nós 1 a 4: entrada, parâmetros, reunião e rota
  // -------------------------------------------------------------------------
  c.no(
    'executeWorkflowTrigger',
    NOS.quandoChamado,
    { inputSource: 'workflowInputs', workflowInputs: { values: ENTRADAS } },
    [-2000, 0],
  );
  code(
    NOS.normalizarEntrada,
    'agenda-fluxo4.js',
    'return { json: normalizarEntradaAgenda($json, { agora: new Date().toISOString() }) };',
    [-1780, 0],
  );
  postgres(NOS.buscarParametros, 'select agente.parametros_agenda() as resultado', [], [-1560, 0]);
  code(
    NOS.lerParametros,
    'agenda-fluxo4.js',
    `return { json: lerParametrosAgenda($(${JSON.stringify(NOS.normalizarEntrada)}).item.json, $json) };`,
    [-1340, 0],
  );
  postgres(NOS.buscarReuniao, 'select agente.reuniao_da_conversa($1) as resultado', ['$json.conversa_id'], [-1120, 0]);
  code(
    NOS.decidirRota,
    'agenda-fluxo4.js',
    `return { json: decidirRota($(${JSON.stringify(NOS.lerParametros)}).item.json, $json) };`,
    [-900, 0],
  );
  escolha(NOS.rotear, '$json.rota', ROTAS, [-680, 0]);

  // -------------------------------------------------------------------------
  // Consulta ao Google: sugerir e conferir
  // -------------------------------------------------------------------------
  code(
    NOS.prepararConsulta,
    'agenda-fluxo4.js',
    `return prepararConsulta($input.first().json, { calendarios: ${JSON.stringify(calendarios)} }).map((json) => ({ json }));`,
    [-460, -300],
    { modo: 'runOnceForAllItems' },
  );
  noCalendario(
    NOS.consultarOcupacao,
    'livre-ocupado',
    {
      resource: 'calendar',
      operation: 'availability',
      calendar: localizadorDoCalendario('={{ $json.calendar_id }}'),
      timeMin: '={{ $json.time_min }}',
      timeMax: '={{ $json.time_max }}',
      options: { outputFormat: 'bookedSlots' },
    },
    '{ calendar_id: $json.calendar_id, time_min: $json.time_min, time_max: $json.time_max }',
    [-240, -300],
  );
  code(
    NOS.calcularOpcoes,
    'agenda-fluxo4.js',
    `return [{ json: calcularConsulta($(${JSON.stringify(NOS.prepararConsulta)}).first().json.estado, $input.all().map((item) => item.json)) }];`,
    [-20, -300],
    { modo: 'runOnceForAllItems' },
  );
  escolha(NOS.depoisDaConsulta, '$json.proximo', PROXIMOS_DA_CONSULTA, [200, -300]);
  postgres(
    NOS.registrarOpcoes,
    'select agente.registrar_opcoes_horario($1, $2, $3) as resultado',
    ['$json.conversa_id', 'JSON.stringify($json.consulta.opcoes.map((opcao) => opcao.inicio))', '$json.agora'],
    [420, -500],
  );
  code(
    NOS.lerOpcoes,
    'agenda-fluxo4.js',
    `return { json: lerOpcoesRegistradas($(${JSON.stringify(NOS.depoisDaConsulta)}).item.json, $json) };`,
    [640, -500],
  );

  // Validar a opção (conferir, agendar, remarcar) e conferir o horário no Google.
  // "Preparar Validação" só repassa o estado: o nó Postgres troca o item pela
  // resposta, e quem lê a resposta precisa de um único nó de onde tirar o
  // estado (a validação vem de duas rotas).
  code(NOS.prepararValidacao, null, 'return { json: $json };', [-680, 200]);
  postgres(NOS.validarOpcao, 'select agente.validar_opcao_horario($1, $2) as resultado', ['$json.conversa_id', '$json.id_opcao'], [-460, 200]);
  code(
    NOS.lerOpcaoValidada,
    'agenda-fluxo4.js',
    `return { json: lerOpcaoValidada($(${JSON.stringify(NOS.prepararValidacao)}).item.json, $json) };`,
    [-240, 200],
  );
  se(NOS.opcaoValida, "$json.rota === 'consultar_slot'", [-20, 200]);

  postgres(
    NOS.registrarLivre,
    'select agente.registrar_conferencia_horario($1, $2, $3) as resultado',
    ['$json.conversa_id', '$json.opcao.id_opcao', 'true'],
    [420, -120],
  );
  code(
    NOS.lerLivre,
    'agenda-fluxo4.js',
    `return { json: lerConferencia($(${JSON.stringify(NOS.depoisDaConsulta)}).item.json, $json, { livre: true }) };`,
    [640, -120],
  );
  escolha(NOS.depoisDaConferencia, '$json.rota', ROTAS_DA_CONFERENCIA, [860, -120]);
  postgres(
    NOS.registrarOcupado,
    'select agente.registrar_conferencia_horario($1, $2, $3) as resultado',
    ['$json.conversa_id', '$json.opcao.id_opcao', 'false'],
    [420, 100],
  );
  code(
    NOS.lerOcupado,
    'agenda-fluxo4.js',
    `return { json: lerConferencia($(${JSON.stringify(NOS.depoisDaConsulta)}).item.json, $json, { livre: false }) };`,
    [640, 100],
  );

  // -------------------------------------------------------------------------
  // Agendar: criar o evento, conferir, registrar
  // -------------------------------------------------------------------------
  code(NOS.prepararEvento, 'agenda-fluxo4.js', 'return { json: prepararEvento($json) };', [1080, -300]);
  noCalendario(
    NOS.criarEvento,
    'eventos',
    {
      resource: 'event',
      operation: 'create',
      calendar: localizadorDoCalendario(calendarioDaReuniao),
      start: '={{ $json.evento.inicio_local }}',
      end: '={{ $json.evento.fim_local }}',
      useDefaultReminders: true,
      additionalFields: {
        id: '={{ $json.evento.evento_id }}',
        summary: '={{ $json.evento.titulo }}',
        description: '={{ $json.evento.descricao }}',
        attendees: '={{ $json.evento.convidados }}',
        sendUpdates: 'all',
        conferenceDataUi: { conferenceDataValues: { conferenceSolution: 'hangoutsMeet' } },
      },
    },
    '{ calendar_id: ' +
      JSON.stringify(calendarioDaReuniao) +
      ', id: $json.evento.evento_id, summary: $json.evento.titulo, description: $json.evento.descricao, start: $json.evento.inicio_local, end: $json.evento.fim_local, attendees: $json.evento.convidados }',
    [1300, -300],
  );
  code(
    NOS.lerCriacao,
    'agenda-fluxo4.js',
    `return { json: lerCriacaoDoEvento($(${JSON.stringify(NOS.prepararEvento)}).item.json, $json) };`,
    [1520, -300],
  );
  escolha(NOS.depoisDaCriacao, '$json.proximo', PROXIMOS_DA_CRIACAO, [1740, -300]);
  noCalendario(
    NOS.recuperarEvento,
    'eventos/obter',
    {
      resource: 'event',
      operation: 'get',
      calendar: localizadorDoCalendario(calendarioDaReuniao),
      eventId: '={{ $json.evento.evento_id }}',
      options: {},
    },
    '{ calendar_id: ' + JSON.stringify(calendarioDaReuniao) + ', evento_id: $json.evento.evento_id }',
    [1960, -500],
  );
  code(
    NOS.lerRecuperacao,
    'agenda-fluxo4.js',
    `return { json: lerCriacaoDoEvento($(${JSON.stringify(NOS.depoisDaCriacao)}).item.json, $json, { recuperando: true }) };`,
    [2180, -500],
  );
  postgres(
    NOS.registrarReuniao,
    'select agente.registrar_reuniao($1, $2, $3, $4, $5, $6) as resultado',
    [
      '$json.conversa_id',
      '$json.opcao.id_opcao',
      '$json.evento_confirmado.evento_id',
      '$json.evento_confirmado.link',
      '$json.email',
      '$json.email_parceiro || null',
    ],
    [1960, -100],
  );
  code(
    NOS.lerReuniao,
    'agenda-fluxo4.js',
    `return { json: lerReuniaoRegistrada($(${JSON.stringify(NOS.depoisDaCriacao)}).item.json, $json) };`,
    [2180, -100],
  );
  escolha(NOS.depoisDoRegistro, '$json.proximo', ['concluir', 'compensar'], [2400, -100]);
  code(NOS.prepararCompensacao, null, 'return { json: $json };', [2400, 100]);
  noCalendario(
    NOS.apagarCriado,
    'eventos/excluir',
    {
      resource: 'event',
      operation: 'delete',
      calendar: localizadorDoCalendario(calendarioDaReuniao),
      eventId: '={{ $json.evento.evento_id }}',
      options: { sendUpdates: 'all' },
    },
    '{ calendar_id: ' + JSON.stringify(calendarioDaReuniao) + ', evento_id: $json.evento.evento_id }',
    [2620, 100],
  );
  code(
    NOS.lerCompensacao,
    'agenda-fluxo4.js',
    `return { json: lerCompensacao($(${JSON.stringify(NOS.prepararCompensacao)}).item.json, $json) };`,
    [2840, 100],
  );

  // -------------------------------------------------------------------------
  // Remarcar, cancelar e conferir o evento (lembrete): tudo parte de "Ler
  // Evento" e de "Conferir Origem do Evento"
  // -------------------------------------------------------------------------
  noCalendario(
    NOS.lerEvento,
    'eventos/obter',
    {
      resource: 'event',
      operation: 'get',
      calendar: localizadorDoCalendario(calendarioDaReuniao),
      eventId: '={{ $json.reuniao.evento_id }}',
      options: {},
    },
    '{ calendar_id: ' + JSON.stringify(calendarioDaReuniao) + ', evento_id: $json.reuniao.evento_id }',
    [-460, 600],
  );
  code(
    NOS.conferirOrigem,
    'agenda-fluxo4.js',
    `return { json: conferirOrigemDoEvento($(${JSON.stringify(NOS.decidirRota)}).item.json, $json) };`,
    [-240, 600],
  );
  escolha(NOS.depoisDaOrigem, '$json.proximo', PROXIMOS_DA_ORIGEM, [-20, 600]);

  code(NOS.prepararMovimento, 'agenda-fluxo4.js', 'return { json: prepararMovimento($json) };', [1080, 100]);
  noCalendario(
    NOS.moverEvento,
    'eventos/atualizar',
    {
      resource: 'event',
      operation: 'update',
      calendar: localizadorDoCalendario(calendarioDaReuniao),
      eventId: '={{ $json.evento.evento_id }}',
      useDefaultReminders: true,
      updateFields: { start: '={{ $json.evento.inicio_local }}', end: '={{ $json.evento.fim_local }}', sendUpdates: 'all' },
    },
    '{ calendar_id: ' + JSON.stringify(calendarioDaReuniao) + ', evento_id: $json.evento.evento_id, start: $json.evento.inicio_local, end: $json.evento.fim_local }',
    [1300, 100],
  );
  code(
    NOS.lerMovimento,
    'agenda-fluxo4.js',
    `return { json: lerMovimentoDoEvento($(${JSON.stringify(NOS.prepararMovimento)}).item.json, $json) };`,
    [1520, 100],
  );
  se(NOS.movimentoOk, "$json.proximo === 'registrar'", [1740, 100]);
  postgres(
    NOS.registrarRemarcacao,
    'select agente.registrar_remarcacao($1, $2) as resultado',
    [
      '$json.conversa_id',
      'JSON.stringify({ id_opcao: $json.opcao.id_opcao, evento_id: $json.evento_confirmado.evento_id, link: $json.evento_confirmado.link })',
    ],
    [1960, 100],
  );
  code(
    NOS.lerRemarcacao,
    'agenda-fluxo4.js',
    `return { json: lerRemarcacaoRegistrada($(${JSON.stringify(NOS.movimentoOk)}).item.json, $json) };`,
    [2180, 100],
  );

  noCalendario(
    NOS.apagarEvento,
    'eventos/excluir',
    {
      resource: 'event',
      operation: 'delete',
      calendar: localizadorDoCalendario(calendarioDaReuniao),
      eventId: '={{ $json.reuniao.evento_id }}',
      options: { sendUpdates: 'all' },
    },
    '{ calendar_id: ' + JSON.stringify(calendarioDaReuniao) + ', evento_id: $json.reuniao.evento_id }',
    [200, 800],
  );
  code(
    NOS.lerApagamento,
    'agenda-fluxo4.js',
    `return { json: lerApagamentoDoEvento($(${JSON.stringify(NOS.depoisDaOrigem)}).item.json, $json) };`,
    [420, 800],
  );
  se(NOS.apagou, "$json.proximo === 'registrar_cancelamento'", [640, 800]);
  postgres(
    NOS.registrarCancelamento,
    'select agente.registrar_cancelamento($1, $2) as resultado',
    ['$json.conversa_id', 'JSON.stringify({ motivo: $json.motivo })'],
    [860, 800],
  );
  code(
    NOS.lerCancelamento,
    'agenda-fluxo4.js',
    `return { json: lerCancelamentoRegistrado($(${JSON.stringify(NOS.depoisDaOrigem)}).item.json, $json) };`,
    [1080, 800],
  );

  code(NOS.compararEvento, 'agenda-fluxo4.js', 'return { json: compararEventoDoLembrete($json) };', [200, 1100]);
  se(NOS.precisaSincronizar, '$json.sincronizar !== null && $json.sincronizar !== undefined', [420, 1100]);
  postgres(
    NOS.sincronizarReuniao,
    'select agente.sincronizar_reuniao($1, $2, $3, $4, $5) as resultado',
    ['$json.sincronizar.sessao_id', '$json.sincronizar.inicio', '$json.sincronizar.fim', '$json.sincronizar.status', '$json.sincronizar.link'],
    [640, 1000],
  );
  code(
    NOS.lerSincronizacao,
    'agenda-fluxo4.js',
    `return { json: lerSincronizacao($(${JSON.stringify(NOS.precisaSincronizar)}).item.json, $json) };`,
    [860, 1000],
  );

  // -------------------------------------------------------------------------
  // Fechamento: consulta à equipe, aviso ao grupo e resposta
  // -------------------------------------------------------------------------
  code(
    NOS.concluir,
    'agenda-fluxo4.js',
    `return { json: concluirAgenda($json, { textos: ${JSON.stringify(textos)} }) };`,
    [3060, 400],
  );
  escolha(NOS.depoisDeConcluir, '$json.saida', SAIDAS_DO_FECHAMENTO, [3280, 400]);
  postgres(
    NOS.consultaEquipe,
    'select agente.registrar_consulta_equipe($1, $2, $3, $4) as resultado',
    ['$json.conversa_id', '$json.consulta_params.tipo', '$json.consulta_params.pergunta', 'JSON.stringify($json.consulta_params.preferencia)'],
    [3500, 200],
  );
  code(
    NOS.lerConsulta,
    'agenda-fluxo4.js',
    `return { json: lerConsultaAberta($(${JSON.stringify(NOS.depoisDeConcluir)}).item.json, $json) };`,
    [3720, 200],
  );
  c.no(
    'httpRequest',
    NOS.avisarGrupo,
    {
      method: 'POST',
      url: destinoTexto.url,
      ...destinoTexto.autenticacao,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: corpoEnvioTexto('$json.aviso.jid', '$json.aviso.texto'),
      options: { timeout: 15000 },
    },
    [3500, 400],
    { credentials: destinoTexto.credentials, onError: 'continueRegularOutput' },
  );
  code(
    NOS.lerAviso,
    'agenda-fluxo4.js',
    `return { json: lerAvisoEnviado($(${JSON.stringify(NOS.depoisDeConcluir)}).item.json, $json) };`,
    [3720, 400],
  );
  postgres(
    NOS.fecharConsulta,
    'select agente.fechar_consulta($1, $2, $3) as resultado',
    ['$json.consulta_id', "'notificada'", 'null'],
    [3500, 600],
  );
  code(
    NOS.lerConsultaNotificada,
    'agenda-fluxo4.js',
    `return { json: lerConsultaNotificada($(${JSON.stringify(NOS.depoisDeConcluir)}).item.json) };`,
    [3720, 600],
  );
  code(NOS.resposta, 'agenda-fluxo4.js', 'return { json: montarRespostaAgenda($json) };', [3500, 800]);

  // -------------------------------------------------------------------------
  // Entrada B: sincronização com o calendário, a cada 30 minutos
  // -------------------------------------------------------------------------
  c.no('scheduleTrigger', NOS.aCada30Min, { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } }, [-2000, 1600]);
  postgres(NOS.sessoesASincronizar, 'select agente.sessoes_para_sincronizar() as resultado', [], [-1780, 1600]);
  code(
    NOS.separarSessoes,
    'agenda-fluxo4.js',
    'return separarSessoes($input.first().json).map((json) => ({ json, pairedItem: 0 }));',
    [-1560, 1600],
    { modo: 'runOnceForAllItems' },
  );
  noCalendario(
    NOS.lerEventoDaSessao,
    'eventos/obter',
    {
      resource: 'event',
      operation: 'get',
      calendar: localizadorDoCalendario(calendarioDaReuniao),
      eventId: '={{ $json.evento_id }}',
      options: {},
    },
    '{ calendar_id: ' + JSON.stringify(calendarioDaReuniao) + ', evento_id: $json.evento_id }',
    [-1340, 1600],
  );
  code(
    NOS.compararESGravar,
    'agenda-fluxo4.js',
    `return { json: compararSessaoComEvento($(${JSON.stringify(NOS.separarSessoes)}).item.json, $json) };`,
    [-1120, 1600],
  );
  se(NOS.mudou, '$json.gravar === true', [-900, 1600]);
  postgres(
    NOS.gravarSincronizacao,
    'select agente.sincronizar_reuniao($1, $2, $3, $4, $5) as resultado',
    ['$json.sessao_id', '$json.inicio', '$json.fim', '$json.status', '$json.link'],
    [-680, 1500],
  );

  // -------------------------------------------------------------------------
  // Conexões
  // -------------------------------------------------------------------------
  ligar(NOS.quandoChamado, NOS.normalizarEntrada);
  ligar(NOS.normalizarEntrada, NOS.buscarParametros);
  ligar(NOS.buscarParametros, NOS.lerParametros);
  ligar(NOS.lerParametros, NOS.buscarReuniao);
  ligar(NOS.buscarReuniao, NOS.decidirRota);
  ligar(NOS.decidirRota, NOS.rotear);
  ligar(NOS.rotear, NOS.prepararConsulta, 0);
  ligar(NOS.rotear, NOS.prepararValidacao, 1);
  ligar(NOS.rotear, NOS.lerEvento, 2);
  ligar(NOS.rotear, NOS.concluir, 3);

  ligar(NOS.prepararConsulta, NOS.consultarOcupacao);
  ligar(NOS.consultarOcupacao, NOS.calcularOpcoes);
  ligar(NOS.calcularOpcoes, NOS.depoisDaConsulta);
  ligar(NOS.depoisDaConsulta, NOS.registrarOpcoes, 0);
  ligar(NOS.depoisDaConsulta, NOS.registrarLivre, 1);
  ligar(NOS.depoisDaConsulta, NOS.registrarOcupado, 2);
  ligar(NOS.depoisDaConsulta, NOS.concluir, 3);
  ligar(NOS.registrarOpcoes, NOS.lerOpcoes);
  ligar(NOS.lerOpcoes, NOS.concluir);

  ligar(NOS.prepararValidacao, NOS.validarOpcao);
  ligar(NOS.validarOpcao, NOS.lerOpcaoValidada);
  ligar(NOS.lerOpcaoValidada, NOS.opcaoValida);
  ligar(NOS.opcaoValida, NOS.prepararConsulta, 0);
  ligar(NOS.opcaoValida, NOS.concluir, 1);

  ligar(NOS.registrarLivre, NOS.lerLivre);
  ligar(NOS.lerLivre, NOS.depoisDaConferencia);
  ligar(NOS.depoisDaConferencia, NOS.concluir, 0);
  ligar(NOS.depoisDaConferencia, NOS.prepararEvento, 1);
  ligar(NOS.depoisDaConferencia, NOS.prepararMovimento, 2);
  ligar(NOS.registrarOcupado, NOS.lerOcupado);
  ligar(NOS.lerOcupado, NOS.prepararConsulta);

  ligar(NOS.prepararEvento, NOS.criarEvento);
  ligar(NOS.criarEvento, NOS.lerCriacao);
  ligar(NOS.lerCriacao, NOS.depoisDaCriacao);
  ligar(NOS.depoisDaCriacao, NOS.registrarReuniao, 0);
  ligar(NOS.depoisDaCriacao, NOS.recuperarEvento, 1);
  ligar(NOS.depoisDaCriacao, NOS.prepararCompensacao, 2);
  ligar(NOS.depoisDaCriacao, NOS.concluir, 3);
  ligar(NOS.recuperarEvento, NOS.lerRecuperacao);
  ligar(NOS.lerRecuperacao, NOS.depoisDaCriacao);
  ligar(NOS.registrarReuniao, NOS.lerReuniao);
  ligar(NOS.lerReuniao, NOS.depoisDoRegistro);
  ligar(NOS.depoisDoRegistro, NOS.concluir, 0);
  ligar(NOS.depoisDoRegistro, NOS.prepararCompensacao, 1);
  ligar(NOS.prepararCompensacao, NOS.apagarCriado);
  ligar(NOS.apagarCriado, NOS.lerCompensacao);
  ligar(NOS.lerCompensacao, NOS.concluir);

  ligar(NOS.lerEvento, NOS.conferirOrigem);
  ligar(NOS.conferirOrigem, NOS.depoisDaOrigem);
  ligar(NOS.depoisDaOrigem, NOS.prepararValidacao, 0);
  ligar(NOS.depoisDaOrigem, NOS.apagarEvento, 1);
  ligar(NOS.depoisDaOrigem, NOS.compararEvento, 2);
  ligar(NOS.depoisDaOrigem, NOS.registrarCancelamento, 3);
  ligar(NOS.depoisDaOrigem, NOS.concluir, 4);

  ligar(NOS.prepararMovimento, NOS.moverEvento);
  ligar(NOS.moverEvento, NOS.lerMovimento);
  ligar(NOS.lerMovimento, NOS.movimentoOk);
  ligar(NOS.movimentoOk, NOS.registrarRemarcacao, 0);
  ligar(NOS.movimentoOk, NOS.concluir, 1);
  ligar(NOS.registrarRemarcacao, NOS.lerRemarcacao);
  ligar(NOS.lerRemarcacao, NOS.concluir);

  ligar(NOS.apagarEvento, NOS.lerApagamento);
  ligar(NOS.lerApagamento, NOS.apagou);
  ligar(NOS.apagou, NOS.registrarCancelamento, 0);
  ligar(NOS.apagou, NOS.concluir, 1);
  ligar(NOS.registrarCancelamento, NOS.lerCancelamento);
  ligar(NOS.lerCancelamento, NOS.concluir);

  ligar(NOS.compararEvento, NOS.precisaSincronizar);
  ligar(NOS.precisaSincronizar, NOS.sincronizarReuniao, 0);
  ligar(NOS.precisaSincronizar, NOS.concluir, 1);
  ligar(NOS.sincronizarReuniao, NOS.lerSincronizacao);
  ligar(NOS.lerSincronizacao, NOS.concluir);

  ligar(NOS.concluir, NOS.depoisDeConcluir);
  ligar(NOS.depoisDeConcluir, NOS.consultaEquipe, 0);
  ligar(NOS.depoisDeConcluir, NOS.avisarGrupo, 1);
  ligar(NOS.depoisDeConcluir, NOS.fecharConsulta, 2);
  ligar(NOS.depoisDeConcluir, NOS.resposta, 3);
  ligar(NOS.consultaEquipe, NOS.lerConsulta);
  ligar(NOS.lerConsulta, NOS.concluir);
  ligar(NOS.avisarGrupo, NOS.lerAviso);
  ligar(NOS.lerAviso, NOS.concluir);
  ligar(NOS.fecharConsulta, NOS.lerConsultaNotificada);
  ligar(NOS.lerConsultaNotificada, NOS.concluir);

  ligar(NOS.aCada30Min, NOS.sessoesASincronizar);
  ligar(NOS.sessoesASincronizar, NOS.separarSessoes);
  ligar(NOS.separarSessoes, NOS.lerEventoDaSessao);
  ligar(NOS.lerEventoDaSessao, NOS.compararESGravar);
  ligar(NOS.compararESGravar, NOS.mudou);
  ligar(NOS.mudou, NOS.gravarSincronizacao, 0);

  return {
    id: idEstavel(fluxoChave),
    name: NOME_FLUXO,
    nodes: c.nos,
    connections: c.conexoes,
    settings: aplicarConfiguracoesFluxo(config),
  };
}
