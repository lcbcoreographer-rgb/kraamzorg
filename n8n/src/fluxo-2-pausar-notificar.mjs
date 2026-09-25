// Fluxo 2: Pausar IA e Notificar Equipe (PRD 19.3 v4.2, P24). Sub-fluxo
// chamado pelas ferramentas `transferir_para_equipe` e `acionar_equipe_saude`
// do agente e pelos caminhos determinísticos do fluxo 3. É o único lugar que
// envia o texto fixo de saúde ou de perda.
//
// Os 19 nós do 19.3, mais o nó 8a "Subiu para Alerta?". Onde o PRD descreve
// um nó como mais de uma chamada (nó 4: postgres, httpRequest, postgres; nó
// 17: aviso em lote), cada chamada vira um nó próprio com o nome do PRD como
// prefixo de sentido. Nós Code auxiliares ("Preparar ...", "Ler ...",
// "Conferir ...") só juntam o estado do fluxo com o resultado da chamada
// anterior, porque os nós Postgres e HTTP trocam o item inteiro pela
// resposta. Toda regra mora nas funções puras de `n8n/src/code/`; os nós If
// só leem booleanos já calculados.
//
// Nenhum texto para a família ou para a equipe mora aqui: vem das funções do
// banco. A exceção documentada é o aviso ao grupo de reserva sem banco
// (`grupoFallbackJid` e `grupoFallbackTexto` do config, PRD 19.1 e 23.3).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { criarNo, criarNotaCabecalho } from './lib/no.mjs';
import { aplicarConfiguracoesFluxo } from './lib/settings.mjs';
import { idEstavel } from './lib/id-estavel.mjs';
import { embutirCodigoComDependencias } from './lib/codigo-embutido.mjs';
import { carregarPromptSync, trocarVariaveisPorExpressoes, variaveisDoPrompt } from './lib/prompts.mjs';
import { destinoUazapi, corpoEnvioTexto, TRACK_SOURCE_AGENTE, CAMINHOS_UAZAPI } from './lib/uazapi.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_CODE = path.join(AQUI, 'code');
const DIR_PROMPTS = path.join(AQUI, '..', 'prompts');

export const FLUXO_CHAVE = 'kraamzorg-fluxo-2-pausar-notificar-equipe';
export const NOME_FLUXO = 'Kraamzorg · Pausar IA e Notificar Equipe';

export const TRACK_SOURCE = TRACK_SOURCE_AGENTE;
export const URL_OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions';

// Entradas do sub-fluxo. As doze primeiras são exatamente as do PRD 19.3; as
// cinco seguintes são opcionais e vêm do fluxo 3 quando ele as tem (ver
// `normalizar-entrada-handoff.js`): `tipo` da ferramenta de saúde, `modo`
// lido na entrada (regra do `sem_aviso`), `telefone` (aviso de reserva sem
// banco) e os parâmetros de ativação dos textos de internação e emocional.
// [P25] `prioridade_minima`, também opcional: o fluxo 3 pede prioridade alta
// na transferência "IA fora do ar" (motivo `outro`, PRD 19.4 nó 26); nunca
// baixa a prioridade da 11.4.
export const ENTRADAS = [
  { name: 'acao', type: 'string' },
  { name: 'wa_jid', type: 'string' },
  { name: 'conversa_id', type: 'string' },
  { name: 'nome', type: 'string' },
  { name: 'motivo', type: 'string' },
  { name: 'resumo', type: 'string' },
  { name: 'solicitacao', type: 'string' },
  { name: 'dados', type: 'object' },
  { name: 'texto_familia', type: 'string' },
  { name: 'chave_texto', type: 'string' },
  { name: 'enviar_texto', type: 'boolean' },
  { name: 'origem_chamada', type: 'string' },
  { name: 'tipo', type: 'string' },
  { name: 'modo', type: 'string' },
  { name: 'telefone', type: 'string' },
  { name: 'alerta_internacao_ativo', type: 'boolean' },
  { name: 'alerta_emocional_ativo', type: 'boolean' },
  { name: 'prioridade_minima', type: 'string' },
];

// Nomes dos nós, num lugar só: os testes e o fluxo 3 (P25) usam os mesmos.
export const NOS = {
  quandoChamado: 'Quando Chamado',
  normalizarEntrada: 'Normalizar Entrada',
  textoDeAlerta: 'Texto de Alerta?',
  buscarTextoAlerta: 'Buscar Texto de Alerta',
  prepararTextoAlerta: 'Preparar Texto de Alerta',
  textoPronto: 'Texto Pronto?',
  enviarTextoAlerta: 'Enviar Texto de Alerta',
  conferirEnvioAlerta: 'Conferir Envio do Alerta',
  alertaSaiu: 'Alerta Saiu?',
  registrarTextoAlerta: 'Registrar Texto de Alerta',
  retomarEstadoAlerta: 'Retomar Estado do Alerta',
  pularClassificador: 'Pular Classificador?',
  buscarContexto: 'Buscar Contexto',
  prepararClassificacao: 'Preparar Classificação',
  montarPrompt: 'Montar Prompt do Classificador',
  classificarPedido: 'Classificar Pedido',
  lerClassificacao: 'Ler Classificação',
  subiuParaAlerta: 'Subiu para Alerta?',
  subirParaAlerta: 'Subir para Alerta',
  ehNaoLead: 'É Não Lead?',
  marcarNaoLead: 'Marcar Não Lead',
  lerNaoLead: 'Ler Não Lead',
  avisarEquipe: 'Avisar a Equipe?',
  buscarInstrucaoSemAviso: 'Buscar Instrução Sem Aviso',
  lerInstrucaoSemAviso: 'Ler Instrução Sem Aviso',
  prepararRegistro: 'Preparar Registro',
  registrarHandoff: 'Registrar Handoff',
  lerRegistro: 'Ler Registro',
  registroOk: 'Registro OK?',
  pausaComPrazo: 'Pausa com Prazo?',
  redisMarcarPausa: 'Redis Marcar Pausa',
  duplicado: 'Duplicado?',
  notificarGrupo: 'Notificar Grupo',
  temPlantao: 'Tem Plantão?',
  separarPlantao: 'Separar Plantão',
  avisarPlantao: 'Avisar Plantão',
  consolidarNotificacao: 'Consolidar Notificação',
  registrarNotificacao: 'Registrar Notificação',
  precisaGrupoReserva: 'Precisa Grupo Reserva?',
  montarAvisoReserva: 'Montar Aviso de Reserva',
  avisarGrupoReserva: 'Avisar Grupo de Reserva',
  fecharRetorno: 'Fechar Retorno',
  retorno: 'Retorno',
};

// Variáveis do prompt `classificar-pedido.md` -> campo do estado montado por
// "Preparar Classificação".
export const VARIAVEIS_PROMPT_CLASSIFICAR_PEDIDO = {
  pedido_atual: '$json.pedido_atual',
  contexto: '$json.contexto_texto',
  motivo_agente: '$json.motivo_agente',
  resumo_agente: '$json.resumo_agente',
  iniciada_por: '$json.iniciada_por',
};

function credencial(config, chave) {
  const { id, name } = config.credenciais[chave];
  return { id, name };
}

function condicaoVerdadeira(fluxoChave, nomeNo, expressao) {
  return {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [
        {
          id: idEstavel(`${fluxoChave}:condicao:${nomeNo}`),
          leftValue: `={{ ${expressao} }}`,
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: false,
    options: {},
  };
}


// Corpo da chamada ao classificador de pedido. `temperature` só entra quando
// o config do ambiente mandar (PRD 19.1).
function corpoClassificador(config) {
  const modelo = config.modelos.classificadores;
  const partes = [`model: ${JSON.stringify(modelo.modelo)}`];
  if (modelo.aceitaTemperatura === true) {
    partes.push(`temperature: ${Number(modelo.temperatura ?? 0)}`);
  }
  partes.push('response_format: { type: "json_object" }');
  partes.push('messages: [ { role: "system", content: $json.prompt_classificador } ]');
  return `={{ { ${partes.join(', ')} } }}`;
}

export function promptClassificarPedidoComExpressoes() {
  const prompt = carregarPromptSync(path.join(DIR_PROMPTS, 'classificar-pedido.md'));
  const faltando = variaveisDoPrompt(prompt).filter((nome) => !(nome in VARIAVEIS_PROMPT_CLASSIFICAR_PEDIDO));
  if (faltando.length > 0) {
    throw new Error(`classificar-pedido.md usa variáveis sem expressão no fluxo 2: ${faltando.join(', ')}`);
  }
  return trocarVariaveisPorExpressoes(prompt, VARIAVEIS_PROMPT_CLASSIFICAR_PEDIDO);
}

export function montarFluxo(config) {
  const fluxoChave = FLUXO_CHAVE;
  const nos = [];
  const conexoes = {};

  const adicionar = (no) => {
    nos.push(no);
    return no;
  };

  const ligar = (origem, destino, saida = 0) => {
    conexoes[origem] ??= { main: [] };
    const saidas = conexoes[origem].main;
    while (saidas.length <= saida) saidas.push([]);
    saidas[saida].push({ node: destino, type: 'main', index: 0 });
  };

  const noCode = (nome, arquivo, chamada, posicao, { modo = 'runOnceForEachItem' } = {}) =>
    adicionar(
      criarNo({
        fluxoChave,
        tipo: 'code',
        nome,
        config,
        posicao,
        parametros: {
          mode: modo,
          language: 'javaScript',
          jsCode: arquivo
            ? embutirCodigoComDependencias({ caminhoArquivo: path.join(DIR_CODE, arquivo), chamada })
            : `${chamada.trim()}\n`,
        },
      }),
    );

  const noIf = (nome, expressao, posicao) =>
    adicionar(
      criarNo({ fluxoChave, tipo: 'if', nome, config, posicao, parametros: condicaoVerdadeira(fluxoChave, nome, expressao) }),
    );

  const noPostgres = (nome, query, listaParametros, posicao) =>
    adicionar(
      criarNo({
        fluxoChave,
        tipo: 'postgres',
        nome,
        config,
        posicao,
        parametros: {
          resource: 'database',
          operation: 'executeQuery',
          query,
          options: { queryReplacement: `={{ [ ${listaParametros.join(', ')} ] }}` },
        },
        credentials: { postgres: credencial(config, 'postgres') },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
      }),
    );

  // [P25] Com `homologacao.envioSimulado`, o envio vai para a rota de captura
  // do app, sem credencial (`lib/uazapi.mjs`).
  const destinoTexto = destinoUazapi(config, CAMINHOS_UAZAPI.texto);
  const noEnvioUazapi = (nome, expressaoNumero, expressaoTexto, posicao, opcoesExtras = {}) =>
    adicionar(
      criarNo({
        fluxoChave,
        tipo: 'httpRequest',
        nome,
        config,
        posicao,
        parametros: {
          method: 'POST',
          url: destinoTexto.url,
          ...destinoTexto.autenticacao,
          sendBody: true,
          specifyBody: 'json',
          jsonBody: corpoEnvioTexto(expressaoNumero, expressaoTexto),
          options: { timeout: 15000, ...opcoesExtras },
        },
        credentials: destinoTexto.credentials,
        onError: 'continueRegularOutput',
      }),
    );

  adicionar(
    criarNotaCabecalho({
      fluxoChave,
      config,
      titulo: NOME_FLUXO,
      descricao:
        'Sub-fluxo chamado por transferir_para_equipe, acionar_equipe_saude e pelos caminhos determinísticos do fluxo 3 (PRD 19.3). Único lugar que envia o texto fixo de saúde ou perda (agente.mensagem_alerta), só com enviar_texto verdadeiro. O classificador de pedido pode subir para saúde ou perda (nó 8a) e nunca desce. Sem banco em saúde ou perda, o aviso vai ao grupo de reserva do config.',
      posicao: [-1600, -700],
    }),
  );

  // 1. Quando Chamado
  adicionar(
    criarNo({
      fluxoChave,
      tipo: 'executeWorkflowTrigger',
      nome: NOS.quandoChamado,
      config,
      posicao: [-1600, 0],
      parametros: { inputSource: 'workflowInputs', workflowInputs: { values: ENTRADAS } },
    }),
  );

  // 2. Normalizar Entrada
  noCode(
    NOS.normalizarEntrada,
    'normalizar-entrada-handoff.js',
    'return { json: normalizarEntradaHandoff($json) };',
    [-1380, 0],
  );

  // 3. Texto de Alerta?
  noIf(NOS.textoDeAlerta, '$json.enviar_texto_alerta === true', [-1160, 0]);

  // 4. Enviar Texto de Alerta: mensagem_alerta, envio e registro.
  noPostgres(
    NOS.buscarTextoAlerta,
    'select agente.mensagem_alerta($1, $2, $3) as resultado',
    ['$json.conversa_id', '$json.acao', '$json.chave_texto'],
    [-940, -400],
  );
  noCode(
    NOS.prepararTextoAlerta,
    'estado-handoff.js',
    `return { json: prepararTextoAlerta($(${JSON.stringify(NOS.textoDeAlerta)}).item.json, $json) };`,
    [-720, -400],
  );
  noIf(NOS.textoPronto, '$json.tem_texto_alerta === true', [-500, -400]);
  noEnvioUazapi(NOS.enviarTextoAlerta, '$json.wa_jid', '$json.texto_alerta', [-280, -400]);
  noCode(
    NOS.conferirEnvioAlerta,
    'estado-handoff.js',
    `return { json: conferirEnvioAlerta($(${JSON.stringify(NOS.prepararTextoAlerta)}).item.json, $json) };`,
    [-60, -400],
  );
  noIf(NOS.alertaSaiu, '$json.registrar_envio_alerta === true', [160, -400]);
  // `registrar_mensagem` é a função que resolve a conversa pelo jid
  // (Apêndice A); é a única chamada deste fluxo que recebe o jid, e ela
  // grava o texto que de fato saiu, na mesma conversa para onde foi enviado.
  noPostgres(
    NOS.registrarTextoAlerta,
    'select agente.registrar_mensagem($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as resultado',
    [
      '$json.wa_jid',
      "'saida'",
      "'sistema'",
      '$json.mensagem_enviada',
      "'texto'",
      '$json.wa_message_id_alerta',
      'null',
      '$json.telefone || null',
      'null',
      'null',
    ],
    [380, -400],
  );
  noCode(
    NOS.retomarEstadoAlerta,
    null,
    `return { json: $(${JSON.stringify(NOS.conferirEnvioAlerta)}).item.json };`,
    [600, -400],
  );

  // 5. Pular Classificador?
  noIf(NOS.pularClassificador, '$json.pular_classificador === true', [820, 0]);

  // 6. Buscar Contexto
  noPostgres(
    NOS.buscarContexto,
    'select agente.contexto_conversa($1, 50) as resultado',
    ['$json.conversa_id'],
    [1040, 300],
  );
  noCode(
    NOS.prepararClassificacao,
    'estado-handoff.js',
    `return { json: prepararClassificacao($(${JSON.stringify(NOS.pularClassificador)}).item.json, $json) };`,
    [1260, 300],
  );
  adicionar(
    criarNo({
      fluxoChave,
      tipo: 'set',
      nome: NOS.montarPrompt,
      config,
      posicao: [1480, 300],
      parametros: {
        mode: 'manual',
        assignments: {
          assignments: [
            {
              id: idEstavel(`${fluxoChave}:atribuicao:prompt_classificador`),
              name: 'prompt_classificador',
              type: 'string',
              value: `=${promptClassificarPedidoComExpressoes()}`,
            },
          ],
        },
        includeOtherFields: true,
        options: {},
      },
    }),
  );

  // 7. Classificar Pedido
  adicionar(
    criarNo({
      fluxoChave,
      tipo: 'httpRequest',
      nome: NOS.classificarPedido,
      config,
      posicao: [1700, 300],
      parametros: {
        method: 'POST',
        url: URL_OPENAI_CHAT,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'openAiApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: corpoClassificador(config),
        options: { timeout: 30000 },
      },
      credentials: { openAiApi: credencial(config, 'openai') },
      onError: 'continueRegularOutput',
    }),
  );

  // 8. Ler Classificação
  noCode(
    NOS.lerClassificacao,
    'estado-handoff.js',
    `return { json: aplicarClassificacao($(${JSON.stringify(NOS.montarPrompt)}).item.json, $json) };`,
    [1920, 300],
  );

  // 8a. Subiu para Alerta? (v4.2): volta ao nó 3 antes do nó 12.
  noIf(NOS.subiuParaAlerta, '$json.subiu_para_alerta === true', [2140, 300]);
  noCode(NOS.subirParaAlerta, 'estado-handoff.js', 'return { json: subirParaAlerta($json) };', [2360, 100]);

  // 9 e 10. É Não Lead? / Marcar Não Lead
  noIf(NOS.ehNaoLead, '$json.eh_nao_lead === true', [2360, 400]);
  noPostgres(
    NOS.marcarNaoLead,
    'select agente.marcar_nao_lead($1, $2) as resultado',
    ['$json.conversa_id', '$json.tipo_nao_lead'],
    [2580, 600],
  );
  noCode(
    NOS.lerNaoLead,
    'estado-handoff.js',
    `return { json: lerNaoLead($(${JSON.stringify(NOS.ehNaoLead)}).item.json, $json) };`,
    [2800, 600],
  );

  // 11. Avisar a Equipe? (`sem_aviso` devolve a instrução de seguir normal)
  noIf(NOS.avisarEquipe, '$json.avisar_equipe === true', [2580, 400]);
  noPostgres(
    NOS.buscarInstrucaoSemAviso,
    'select agente.mensagem_sistema($1, $2) as resultado',
    ['$json.conversa_id', "'instrucao_sem_aviso'"],
    [2800, 800],
  );
  noCode(
    NOS.lerInstrucaoSemAviso,
    'estado-handoff.js',
    `return { json: lerInstrucaoSemAviso($(${JSON.stringify(NOS.avisarEquipe)}).item.json, $json) };`,
    [3020, 800],
  );

  // 12. Registrar Handoff
  noCode(NOS.prepararRegistro, 'estado-handoff.js', 'return { json: prepararRegistro($json) };', [3020, 0]);
  noPostgres(
    NOS.registrarHandoff,
    'select agente.registrar_handoff($1, $2, $3, $4, $5, $6, $7) as resultado',
    [
      '$json.conversa_id',
      '$json.motivo',
      '$json.resumo',
      '$json.solicitacao',
      '$json.registro_dados_json',
      '$json.origem_chamada',
      '$json.texto_familia',
    ],
    [3240, 0],
  );
  noCode(
    NOS.lerRegistro,
    'estado-handoff.js',
    `return { json: lerRegistroHandoff($(${JSON.stringify(NOS.prepararRegistro)}).item.json, $json) };`,
    [3460, 0],
  );

  // 13. Registro OK?
  noIf(NOS.registroOk, '$json.registro_ok === true', [3680, 0]);

  // 14. Redis Marcar Pausa (só pausa com prazo; `humano_comercial` não vence
  // por prazo e não ganha cache)
  noIf(NOS.pausaComPrazo, '$json.pausa_com_prazo === true', [3900, 0]);
  adicionar(
    criarNo({
      fluxoChave,
      tipo: 'redis',
      nome: NOS.redisMarcarPausa,
      config,
      posicao: [4120, -150],
      parametros: {
        operation: 'set',
        key: `=${config.redis.prefixo}pausa:{{ $json.conversa_id }}`,
        value: '={{ $json.motivo }}',
        keyType: 'automatic',
        expire: true,
        ttl: '={{ $json.pausa_ttl_segundos }}',
      },
      credentials: { redis: credencial(config, 'redis') },
      onError: 'continueRegularOutput',
    }),
  );

  // 15. Duplicado? (só motivos comerciais; alerta repetido sempre reenvia)
  noIf(NOS.duplicado, `$(${JSON.stringify(NOS.lerRegistro)}).item.json.duplicado_sem_aviso === true`, [4340, 0]);

  // 16. Notificar Grupo
  noEnvioUazapi(
    NOS.notificarGrupo,
    `$(${JSON.stringify(NOS.lerRegistro)}).item.json.grupo_jid`,
    `$(${JSON.stringify(NOS.lerRegistro)}).item.json.mensagem_grupo`,
    [4560, 100],
  );

  // 17. Avisar Plantão (prioridade máxima, em lote)
  noIf(NOS.temPlantao, `$(${JSON.stringify(NOS.lerRegistro)}).item.json.tem_plantao === true`, [4780, 100]);
  noCode(
    NOS.separarPlantao,
    'estado-handoff.js',
    `return montarAvisosPlantao($(${JSON.stringify(NOS.lerRegistro)}).first().json).map((aviso) => ({ json: aviso, pairedItem: 0 }));`,
    [5000, -50],
    { modo: 'runOnceForAllItems' },
  );
  noEnvioUazapi(NOS.avisarPlantao, '$json.numero', '$json.texto', [5220, -50], {
    batching: { batch: { batchSize: 5, batchInterval: 500 } },
  });
  noCode(
    NOS.consolidarNotificacao,
    'estado-handoff.js',
    [
      `const estado = $(${JSON.stringify(NOS.lerRegistro)}).first().json;`,
      `const grupo = $(${JSON.stringify(NOS.notificarGrupo)}).first().json;`,
      `const plantao = $(${JSON.stringify(NOS.avisarPlantao)}).isExecuted ? $(${JSON.stringify(NOS.avisarPlantao)}).all().map((item) => item.json) : [];`,
      'return [{ json: consolidarNotificacao(estado, grupo, plantao), pairedItem: 0 }];',
    ].join('\n'),
    [5440, 100],
    { modo: 'runOnceForAllItems' },
  );

  // 18. Registrar Notificação
  noPostgres(
    NOS.registrarNotificacao,
    'select agente.registrar_notificacao_handoff($1, $2, $3) as resultado',
    ['$json.handoff_id', '$json.notificacao_ok', '$json.notificacao_erro'],
    [5660, 100],
  );

  // 13, ramo sem banco: saúde ou perda vão ao grupo de reserva do config.
  noIf(NOS.precisaGrupoReserva, '$json.usar_grupo_reserva === true', [3900, 400]);
  noCode(
    NOS.montarAvisoReserva,
    'estado-handoff.js',
    `return { json: montarAvisoReserva($json, { modelo: ${JSON.stringify(config.grupoFallbackTexto)}, jid: ${JSON.stringify(config.grupoFallbackJid)} }) };`,
    [4120, 400],
  );
  noEnvioUazapi(NOS.avisarGrupoReserva, '$json.aviso_reserva_jid', '$json.aviso_reserva_texto', [4340, 400]);

  // 19. Retorno
  noCode(
    NOS.fecharRetorno,
    'estado-handoff.js',
    `return { json: montarRetorno($(${JSON.stringify(NOS.lerRegistro)}).item.json) };`,
    [5880, 100],
  );
  adicionar(
    criarNo({
      fluxoChave,
      tipo: 'set',
      nome: NOS.retorno,
      config,
      posicao: [6100, 100],
      parametros: {
        mode: 'manual',
        assignments: {
          assignments: [
            ['ok', 'boolean'],
            ['handoff_id', 'string'],
            ['instrucao', 'string'],
            ['instrucao_chave', 'string'],
            ['motivo', 'string'],
            ['acao', 'string'],
          ].map(([campo, tipo]) => ({
            id: idEstavel(`${fluxoChave}:retorno:${campo}`),
            name: campo,
            type: tipo,
            value: `={{ $json.${campo} }}`,
          })),
        },
        includeOtherFields: false,
        options: { ignoreConversionErrors: true },
      },
    }),
  );

  // Conexões
  ligar(NOS.quandoChamado, NOS.normalizarEntrada);
  ligar(NOS.normalizarEntrada, NOS.textoDeAlerta);
  ligar(NOS.textoDeAlerta, NOS.buscarTextoAlerta, 0);
  ligar(NOS.textoDeAlerta, NOS.pularClassificador, 1);
  ligar(NOS.buscarTextoAlerta, NOS.prepararTextoAlerta);
  ligar(NOS.prepararTextoAlerta, NOS.textoPronto);
  ligar(NOS.textoPronto, NOS.enviarTextoAlerta, 0);
  ligar(NOS.textoPronto, NOS.pularClassificador, 1);
  ligar(NOS.enviarTextoAlerta, NOS.conferirEnvioAlerta);
  ligar(NOS.conferirEnvioAlerta, NOS.alertaSaiu);
  ligar(NOS.alertaSaiu, NOS.registrarTextoAlerta, 0);
  ligar(NOS.alertaSaiu, NOS.pularClassificador, 1);
  ligar(NOS.registrarTextoAlerta, NOS.retomarEstadoAlerta);
  ligar(NOS.retomarEstadoAlerta, NOS.pularClassificador);

  ligar(NOS.pularClassificador, NOS.prepararRegistro, 0);
  ligar(NOS.pularClassificador, NOS.buscarContexto, 1);
  ligar(NOS.buscarContexto, NOS.prepararClassificacao);
  ligar(NOS.prepararClassificacao, NOS.montarPrompt);
  ligar(NOS.montarPrompt, NOS.classificarPedido);
  ligar(NOS.classificarPedido, NOS.lerClassificacao);
  ligar(NOS.lerClassificacao, NOS.subiuParaAlerta);
  ligar(NOS.subiuParaAlerta, NOS.subirParaAlerta, 0);
  ligar(NOS.subiuParaAlerta, NOS.ehNaoLead, 1);
  ligar(NOS.subirParaAlerta, NOS.textoDeAlerta);
  ligar(NOS.ehNaoLead, NOS.marcarNaoLead, 0);
  ligar(NOS.ehNaoLead, NOS.avisarEquipe, 1);
  ligar(NOS.marcarNaoLead, NOS.lerNaoLead);
  ligar(NOS.lerNaoLead, NOS.retorno);
  ligar(NOS.avisarEquipe, NOS.prepararRegistro, 0);
  ligar(NOS.avisarEquipe, NOS.buscarInstrucaoSemAviso, 1);
  ligar(NOS.buscarInstrucaoSemAviso, NOS.lerInstrucaoSemAviso);
  ligar(NOS.lerInstrucaoSemAviso, NOS.retorno);

  ligar(NOS.prepararRegistro, NOS.registrarHandoff);
  ligar(NOS.registrarHandoff, NOS.lerRegistro);
  ligar(NOS.lerRegistro, NOS.registroOk);
  ligar(NOS.registroOk, NOS.pausaComPrazo, 0);
  ligar(NOS.registroOk, NOS.precisaGrupoReserva, 1);
  ligar(NOS.pausaComPrazo, NOS.redisMarcarPausa, 0);
  ligar(NOS.pausaComPrazo, NOS.duplicado, 1);
  ligar(NOS.redisMarcarPausa, NOS.duplicado);
  ligar(NOS.duplicado, NOS.fecharRetorno, 0);
  ligar(NOS.duplicado, NOS.notificarGrupo, 1);
  ligar(NOS.notificarGrupo, NOS.temPlantao);
  ligar(NOS.temPlantao, NOS.separarPlantao, 0);
  ligar(NOS.temPlantao, NOS.consolidarNotificacao, 1);
  ligar(NOS.separarPlantao, NOS.avisarPlantao);
  ligar(NOS.avisarPlantao, NOS.consolidarNotificacao);
  ligar(NOS.consolidarNotificacao, NOS.registrarNotificacao);
  ligar(NOS.registrarNotificacao, NOS.fecharRetorno);
  ligar(NOS.precisaGrupoReserva, NOS.montarAvisoReserva, 0);
  ligar(NOS.precisaGrupoReserva, NOS.fecharRetorno, 1);
  ligar(NOS.montarAvisoReserva, NOS.avisarGrupoReserva);
  ligar(NOS.avisarGrupoReserva, NOS.fecharRetorno);
  ligar(NOS.fecharRetorno, NOS.retorno);

  return {
    id: idEstavel(fluxoChave),
    name: NOME_FLUXO,
    nodes: nos,
    connections: conexoes,
    settings: aplicarConfiguracoesFluxo(config),
  };
}
