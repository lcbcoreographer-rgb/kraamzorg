// Testes do fluxo 3 "Agente Isadora" (PRD 19.4 v4.2, P25). Três camadas:
// 1. As funções puras de `n8n/src/code/`, importadas direto (validarResposta,
//    prepararEnvio, decisões de modo, saída do agente, follow-up).
// 2. Os cenários do P25 rodando o JSON gerado pelo build no simulador
//    (`src/lib/simulador.mjs`): os nós Code executam o código embutido de
//    verdade; banco, OpenAI, UAZAPI, Redis, agente e fluxo 2 são falsos em
//    memória. Dois cenários chamam o fluxo 2 gerado de verdade.
// 3. A estrutura do JSON: a ordem de segurança pelas conexões, a chave da
//    conversa, as ferramentas, a memória, os prompts e o config.
//
// Roda junto com `node --test n8n/build.test.mjs` (importado no fim dele) ou
// sozinho: `node --test n8n/fluxo-3.test.mjs`. Nenhum dado real: números,
// jids e textos são fictícios.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gerarFluxos, conferirHomologacao } from './build.mjs';
import { carregarConfig } from './src/lib/config.mjs';
import { extrairPrompt } from './src/lib/prompts.mjs';
import { simularFluxo, avaliarParametro, erroNoInteiro, escopoDeFerramenta } from './src/lib/simulador.mjs';
import {
  executarTodosOsValidadoresEstruturais,
  alcancaveis,
  todoCaminhoPassaPor,
  nenhumCaminhoEntre,
  conversaIdSoDoRegistro,
  codeCompila,
} from './src/lib/validadores.mjs';
import {
  NOS,
  FERRAMENTAS,
  EXPR_CONVERSA,
  EXPR_CONVERSA_HUMANA,
  EXPR_JID,
  montarFluxo,
  VARIAVEIS_PROMPT_ISADORA_EXPR,
} from './src/fluxo-3-agente-isadora.mjs';
import { NOS as NOS2 } from './src/fluxo-2-pausar-notificar.mjs';

import { extrairDadosMensagem, tipoDaMensagem, telefoneE164 } from './src/code/extrair-dados.js';
import { agrupamento, lerBufferRedis } from './src/code/agrupamento.js';
import { iniciarEstado, lerTranscricao, prepararAgrupamento, decidirAgrupamento } from './src/code/entrada-mensagem.js';
import { lerPodeResponder, rotaDoModo, aplicarClassificacaoMensagem, historicoParaClassificador } from './src/code/modo-agente.js';
import { MODOS_COM_TEXTO_DE_ALERTA, enviarTextoPorModo } from './src/code/modos.js';
import { prepararAlerta, prepararAudioNaoTranscrito, lerRetornoFluxo2, prepararIaForaDoAr } from './src/code/chamadas-fluxo2.js';
import { validarResposta, encontrarValores, planosCitados, temValorPorExtenso } from './src/code/validar-resposta.js';
import { prepararEnvio, montarBlocos, apresentacaoPorValorSai } from './src/code/preparar-envio.js';
import { lerSaidaAgente, consolidarEnvio } from './src/code/saida-agente.js';
import { lerReescrita, validarRespostaDoAgente } from './src/code/resposta-agente.js';
import { separarFollowups, fecharFollowup } from './src/code/followup.js';
import { validarFollowup, hashDoTexto, semelhanca } from './src/code/validar-followup.js';
import { prepararEntradaAgente, VARIAVEIS_PROMPT_ISADORA, resolverUrlPdf } from './src/code/contexto-agente.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

async function configExemplo() {
  const { config } = await carregarConfig('hml', AQUI, { log: () => {} });
  return config;
}

async function fluxos() {
  return gerarFluxos(await configExemplo(), 'hml');
}

// ---------------------------------------------------------------------------
// Fixtures fictícias
// ---------------------------------------------------------------------------

const JID = '000000000001@s.whatsapp.net';
const CONVERSA = '33333333-3333-4333-8333-333333333333';
const PLANOS = [
  { nome: 'Essencial', valor_centavos: 420000, parcelas: 3, parcela_centavos: 140000 },
  { nome: 'Imersão', valor_centavos: 630000, parcelas: 3, parcela_centavos: 210000 },
  { nome: 'Continuado', apelidos: ['plano de 12 dias'], valor_centavos: 810000, parcelas: 3, parcela_centavos: 270000 },
  { nome: 'Gemelar Essencial', valor_centavos: 540000, parcelas: 3, parcela_centavos: 180000 },
  { nome: 'Gemelar Continuado', valor_centavos: 1030000, parcelas: 3, parcela_centavos: 343333 },
];
const LISTAS = {
  palavras_evitadas: ['mãezinha', 'mamãe', 'papai', 'amiga', 'cura', 'milagre', 'garantimos'],
  promessas: ['vai dar tudo certo', 'resultado garantido', 'garantimos'],
  escassez: ['última vaga', 'imperdível', 'corre'],
  pedido_dado: ['cpf', 'rg', 'endereço', 'cep', 'data de nascimento', 'e-mail', 'documento', 'documentos'],
  negar_assistente: ['sou humana', 'não sou um robô', 'não sou assistente virtual'],
  palavras_condicao: ['desconto', 'pix', 'à vista', 'cupom', 'parcela'],
};
const CONTEXTO_VALIDADOR = { planos: PLANOS, taxas_centavos: [], valor_minimo_centavos: 420000, listas: LISTAS };

const FICHA = {
  ok: true,
  ficha: 'Nome: Ana\nSemanas hoje: 30s0d',
  data_hora: 'quinta-feira, 24/09/2026, 19:40',
  planos: 'Essencial, 6 dias',
  valores_permitidos: 'R$ 4.200',
  pdf_status: 'ainda não enviado',
  horarios_edilaine: 'sem horários cadastrados',
  valor: {
    essencial: 'R$ 4.200',
    imersao: 'R$ 6.300',
    continuado: 'R$ 8.100',
    gemelar_essencial: 'R$ 5.400',
    gemelar_continuado: 'R$ 10.300',
    minimo: 'R$ 4.200',
  },
  parcela: { continuado: '3x de R$ 2.700' },
  pagina: { filho_unico: '7', gemelar: '8' },
  validador: { ...CONTEXTO_VALIDADOR, motivo_em_curso: null, quer_contratar: false },
  pdf: { url: 'https://exemplo-nao-real.kraamzorg.invalid/apresentacao.pdf', nome_arquivo: 'Kraamzorg.pdf', reenvio_janela_horas: 0, enviado_em: null },
};

function corpo({
  texto = 'Olá! Gostaria de receber mais informações',
  tipo = 'Conversation',
  mediaType,
  fromMe = false,
  wasSentByApi = false,
  trackSource,
  isGroup = false,
  chatid = JID,
  id = 'msg-1',
  timestamp = 1000,
  instancia,
  chatlid,
} = {}) {
  return {
    EventType: 'messages',
    instanceName: instancia,
    token: 'token-do-corpo-nunca-lido',
    message: {
      chatid,
      chatlid,
      sender_pn: chatid,
      text: texto,
      messageType: tipo,
      mediaType,
      fromMe,
      wasSentByApi,
      track_source: trackSource,
      isGroup,
      messageid: id,
      senderName: 'Ana',
      messageTimestamp: timestamp,
    },
    chat: { phone: '000000000001', wa_contactName: 'Ana paciente potencial' },
  };
}

// ---------------------------------------------------------------------------
// Ambiente falso do fluxo 3
// ---------------------------------------------------------------------------

function criarAmbiente(opcoes = {}) {
  const falhas = new Set(opcoes.falhas ?? []);
  const estado = { banco: [], envios: [], openai: [], redis: new Map(), fluxo2: [], agente: [], transcricoes: [] };
  if (opcoes.redisInicial) for (const [chave, valor] of Object.entries(opcoes.redisInicial)) estado.redis.set(chave, { ...valor });

  const funcoesBanco = {
    registrar_mensagem: (jid, direcao, enviadoPor) => ({
      ok: true,
      conversa_id: opcoes.conversaPorJid?.[jid] ?? CONVERSA,
      primeira_mensagem: true,
      classificacao: opcoes.classificacaoConversa === undefined ? 'lead' : opcoes.classificacaoConversa,
      numero_equipe: opcoes.equipe === true && direcao === 'entrada',
      numero_plantao: false,
      agrupamento_segundos: 20,
      enviado_por: enviadoPor,
    }),
    pausar: () => ({ ok: true, horas: 48 }),
    sincronizar_memoria: () => ({ ok: true }),
    registrar_transcricao: () => ({ ok: true }),
    pode_responder: () =>
      opcoes.podeResponder ?? {
        ok: true,
        modo: 'vendas',
        agente_modo: 'producao',
        na_whitelist: false,
        alerta_internacao_ativo: false,
        alerta_emocional_ativo: false,
        alerta_saude_sensivel_ativo: false,
      },
    checar_termos_alerta: (texto) => {
      for (const [termo, acao, chave] of opcoes.termos ?? []) {
        if (String(texto).toLowerCase().includes(termo)) return { ok: true, alerta: true, acao, termo, mensagem_chave: chave ?? null };
      }
      return { ok: true, alerta: false };
    },
    contexto_conversa: () => ({ ok: true, mensagens: [{ de: 'isadora', texto: 'Oi!' }, { de: 'familia', texto: 'oi' }] }),
    mensagem_sistema: (conversaId, chave) => ({ ok: true, texto: `[texto ${chave}]` }),
    marcar_nao_lead: (conversaId, tipo) => ({ ok: true, texto_encaminhamento: `[encaminhamento ${tipo}]` }),
    pode_enviar: (conversaId, tipo, handoffId) => opcoes.podeEnviar?.(tipo, handoffId) ?? { pode: true, motivo: null },
    ficha_para_agente: () => opcoes.ficha ?? FICHA,
    registrar_marco: () => ({ ok: true }),
    followups_devidos: () => opcoes.followups ?? { ok: true, itens: [] },
    registrar_followup: () => ({ ok: true }),
  };

  const postgres = (parametros) => {
    const funcao = /agente\.(\w+)\(/.exec(parametros.query)[1];
    const argumentos = parametros.options.queryReplacement ?? [];
    estado.banco.push({ funcao, argumentos });
    if (falhas.has('banco') || falhas.has(funcao)) throw new Error(`connect ECONNREFUSED (${funcao})`);
    return [{ resultado: funcoesBanco[funcao](...argumentos) }];
  };

  const uazapi = (nomeNo) => (parametros) => {
    estado.envios.push({ no: nomeNo, url: parametros.url, ...parametros.jsonBody });
    if (falhas.has('uazapi') || falhas.has(nomeNo)) throw new Error('UAZAPI 503');
    return { messageid: `wa-${estado.envios.length}` };
  };

  const openai = (tipo) => (parametros) => {
    estado.openai.push({ tipo, corpo: parametros.jsonBody });
    if (falhas.has('openai') || falhas.has(`openai_${tipo}`)) throw new Error('OpenAI 500');
    const saida = opcoes[tipo];
    const conteudo =
      typeof saida === 'string'
        ? saida
        : JSON.stringify(
            saida ??
              (tipo === 'classificacao'
                ? { tipo_contato: 'lead', saude: 'nenhum', perda: false, perda_temporalidade: 'nenhuma', internacao: false, saude_mental: false, porque: 'x' }
                : { texto: '[SEGURANCA]', transferir: null }),
          );
    return { choices: [{ message: { content: conteudo } }] };
  };

  const redis = (parametros) => {
    if (falhas.has('redis')) throw erroNoInteiro('Redis: connect ECONNREFUSED');
    const { operation, key } = parametros;
    if (operation === 'set' && parametros.keyType === 'hash') {
      const atual = estado.redis.get(key) ?? {};
      estado.redis.set(key, { ...atual, ...JSON.parse(parametros.value) });
      estado.ttl = parametros.ttl;
    } else if (operation === 'set') {
      estado.redis.set(key, parametros.value);
    } else if (operation === 'get') {
      return estado.redis.get(key) ?? {};
    } else if (operation === 'delete') {
      estado.redis.delete(key);
    }
    return null;
  };

  const fluxo2 = (nomeNo) => (parametros) => {
    const entrada = parametros.workflowInputs.value;
    estado.fluxo2.push({ no: nomeNo, entrada });
    if (falhas.has('fluxo2') || falhas.has(nomeNo)) throw new Error('sub-fluxo falhou');
    if (opcoes.executarFluxo2) return opcoes.executarFluxo2(entrada);
    const alerta = ['alerta_saude', 'perda'].includes(entrada.acao);
    const ok = !(opcoes.fluxo2SemRegistro === true);
    return {
      ok,
      handoff_id: ok ? `handoff-${estado.fluxo2.length}` : null,
      instrucao: ok ? '[instrução]' : null,
      instrucao_chave: alerta ? 'instrucao_saude' : ok ? 'instrucao_generica' : 'instrucao_erro',
      motivo: entrada.motivo,
      acao: entrada.acao,
    };
  };

  const agente = (parametros, item, ctx) => {
    estado.agente.push({ entrada: parametros.text, sistema: parametros.options.systemMessage });
    if (falhas.has('agente')) throw new Error('OpenAI timeout');
    const resposta = opcoes.agente ? opcoes.agente(parametros, item, ctx) : { output: 'Oi! Que bom receber sua mensagem 🤍' };
    return resposta;
  };

  return {
    estado,
    montarServicos(fluxo) {
      const servicos = {};
      for (const no of fluxo.nodes) {
        if (no.type === 'n8n-nodes-base.postgres') servicos[no.name] = postgres;
        else if (no.type === 'n8n-nodes-base.redis') servicos[no.name] = redis;
        else if (no.type === 'n8n-nodes-base.executeWorkflow') servicos[no.name] = fluxo2(no.name);
        else if (no.type === '@n8n/n8n-nodes-langchain.agent') servicos[no.name] = agente;
        else if (no.type === 'n8n-nodes-base.httpRequest') {
          const url = no.parameters.url;
          if (url.includes('/send/')) servicos[no.name] = uazapi(no.name);
          else if (url.includes('/message/download')) {
            servicos[no.name] = (parametros) => {
              estado.transcricoes.push({ url: parametros.url, corpo: parametros.jsonBody });
              if (falhas.has('transcricao')) throw new Error('transcrição falhou');
              return { transcription: opcoes.transcricao ?? 'estou bem, obrigada' };
            };
          } else if (no.name === NOS.classificarMensagem) servicos[no.name] = openai('classificacao');
          else if (no.name === NOS.reescrever) servicos[no.name] = openai('reescrita');
          else if (no.name === NOS.gerarMensagem) servicos[no.name] = openai('followup');
        }
      }
      return servicos;
    },
    chamadas: (funcao) => estado.banco.filter((c) => c.funcao === funcao),
    enviosDe: (no) => estado.envios.filter((e) => e.no === no),
  };
}

async function rodar(ambiente, corpoWebhook, { fluxo } = {}) {
  const config = await configExemplo();
  const fluxo3 = fluxo ?? (await fluxos()).fluxo3;
  const body = { ...corpoWebhook, instanceName: corpoWebhook.instanceName ?? config.uazapi.instancia };
  return simularFluxo(fluxo3, { gatilho: NOS.webhook, entrada: { headers: {}, body }, servicos: ambiente.montarServicos(fluxo3) });
}

const CLASSIFICACAO_URGENCIA = {
  tipo_contato: 'lead',
  saude: 'urgencia',
  perda: false,
  perda_temporalidade: 'nenhuma',
  internacao: false,
  saude_mental: false,
  porque: 'x',
};

// ---------------------------------------------------------------------------
// 1. Funções puras
// ---------------------------------------------------------------------------

describe('fluxo 3 · Extrair Dados (função pura)', () => {
  test('texto, jid, telefone E.164, CPF mascarado e o token do corpo nunca lido', () => {
    const dados = extrairDadosMensagem(corpo({ texto: 'meu cpf é 529.982.247-25' }));
    assert.equal(dados.jid, JID);
    assert.equal(dados.telefone, '+000000000001');
    assert.equal(dados.texto, 'meu cpf é [CPF ocultado]');
    assert.equal(dados.tipo_mensagem, 'texto');
    assert.ok(!JSON.stringify(dados).includes('token-do-corpo'));
  });

  test('mídia com e sem legenda leva midia = true; áudio vai para transcrição; figurinha e reação param', () => {
    const foto = extrairDadosMensagem(corpo({ texto: '', tipo: 'ImageMessage', mediaType: 'image' }));
    assert.deepEqual([foto.tipo, foto.tipo_mensagem, foto.midia, foto.com_legenda], ['imagem', 'midia', true, false]);
    const comLegenda = extrairDadosMensagem(corpo({ texto: 'o que vocês acham?', tipo: 'ImageMessage', mediaType: 'image' }));
    assert.deepEqual([comLegenda.midia, comLegenda.com_legenda], [true, true]);
    assert.equal(extrairDadosMensagem(corpo({ texto: '', tipo: 'AudioMessage', mediaType: 'ptt' })).tipo_mensagem, 'audio');
    assert.equal(extrairDadosMensagem(corpo({ texto: '', tipo: 'StickerMessage' })).tipo_mensagem, 'ignorar');
    assert.equal(extrairDadosMensagem(corpo({ texto: '👍', tipo: 'ReactionMessage' })).tipo_mensagem, 'ignorar');
    assert.equal(tipoDaMensagem({ messageType: 'DocumentWithCaptionMessage' }), 'documento');
  });

  test('grupo, broadcast e newsletter marcados; eco por wasSentByApi ou track_source', () => {
    assert.equal(extrairDadosMensagem(corpo({ chatid: '000000000000-0000000001@g.us' })).eh_grupo, true);
    assert.equal(extrairDadosMensagem(corpo({ chatid: 'status@broadcast' })).eh_grupo, true);
    assert.equal(extrairDadosMensagem(corpo({ fromMe: true, wasSentByApi: true })).eh_eco, true);
    assert.equal(extrairDadosMensagem(corpo({ fromMe: true, trackSource: 'kraamzorg-agente' })).eh_eco, true);
    assert.equal(extrairDadosMensagem(corpo({ fromMe: true })).eh_eco, false);
    assert.equal(extrairDadosMensagem(corpo({ wasSentByApi: true })).eh_eco, false, 'sem fromMe nunca é eco');
  });

  test('N8N-01: em mensagem nossa, o LID é o do chat, nunca o sender_lid (que é o do número da Kraamzorg)', () => {
    const LID_DONO = '999000000000001@lid';
    const nossa = (chatid, extra = {}) => {
      const c = corpo({ fromMe: true, chatid });
      Object.assign(c.message, { sender_lid: LID_DONO }, extra);
      return c;
    };
    const paraA = extrairDadosMensagem(nossa('000000000011@s.whatsapp.net'));
    const paraB = extrairDadosMensagem(nossa('000000000022@s.whatsapp.net'));
    assert.equal(paraA.lid, '', 'fromMe só com sender_lid: sem LID');
    assert.equal(paraB.lid, '', 'duas famílias diferentes nunca saem com o mesmo LID do dono');
    assert.equal(extrairDadosMensagem(nossa('000000000033@lid')).lid, '000000000033@lid', 'chatid já em @lid vale como LID do chat');
    assert.equal(
      extrairDadosMensagem(nossa('000000000011@s.whatsapp.net', { chatlid: '000000000011000@lid' })).lid,
      '000000000011000@lid',
      'chatlid continua valendo em mensagem nossa',
    );
    const daFamilia = corpo({ chatid: '000000000044@s.whatsapp.net' });
    daFamilia.message.sender_lid = '000000000044000@lid';
    assert.equal(extrairDadosMensagem(daFamilia).lid, '000000000044000@lid', 'na mensagem da família, o sender_lid é dela');
  });

  test('LGPD-01: cartão seguido de validade e CVV na mesma linha sai mascarado antes do Redis e da memória', () => {
    const dados = extrairDadosMensagem(corpo({ texto: 'pode passar no cartão 4111 1111 1111 1111 12/28 123' }));
    assert.equal(dados.texto, 'pode passar no cartão [cartão ocultado] [dado de cartão ocultado] 123');
  });

  test('SEG-BANCO-01: texto da família cortado em 20 mil caracteres antes da máscara, em tempo linear', () => {
    const inicio = performance.now();
    const dados = extrairDadosMensagem(corpo({ texto: '1 '.repeat(30000) }));
    assert.ok(performance.now() - inicio < 1000);
    assert.equal(dados.texto.length, 20000);
    const transcrito = lerTranscricao({ texto: '' }, { transcription: '1 '.repeat(30000) });
    assert.equal(transcrito.texto.length, 20000);
  });

  test('em mensagem nossa, o telefone é o da família (do chat), nunca o remetente', () => {
    assert.equal(telefoneE164({ senderPn: '000000000099@s.whatsapp.net', telefoneChat: '00 0000-0001', jid: JID, fromMe: true }), '+0000000001');
    assert.equal(telefoneE164({ senderPn: '000000000099@lid', telefoneChat: '', jid: 'x@lid', fromMe: false }), '');
  });
});

describe('fluxo 3 · agrupamento e entrada (funções puras)', () => {
  test('buffer do Redis vem em hash e é ordenado pelo carimbo', () => {
    const lista = lerBufferRedis({
      b: JSON.stringify({ id: 'b', texto: 'segunda', carimbo: 2 }),
      a: JSON.stringify({ id: 'a', texto: 'primeira', carimbo: 1 }),
    });
    assert.deepEqual(lista.map((m) => m.id), ['a', 'b']);
    assert.equal(lerBufferRedis('não é hash'), null);
  });

  test('entrada desta execução fora do buffer (chave já apagada por outra) segue sozinha', () => {
    const entrada = { id: 'c', texto: 'terceira', midia: false };
    const resultado = agrupamento({ buffer: [{ id: 'd', texto: 'outra' }], idExecucaoAtual: 'c', textoAtual: 'terceira', entradaAtual: entrada });
    assert.deepEqual([resultado.deveResponder, resultado.texto], [true, 'terceira']);
  });

  test('marcas de mídia e de áudio não transcrito valem para o grupo inteiro', () => {
    const buffer = [
      { id: 'a', texto: '', midia: true, tipo: 'imagem' },
      { id: 'b', texto: 'o que acham?', midia: false },
    ];
    const resultado = agrupamento({ buffer, idExecucaoAtual: 'b', textoAtual: 'o que acham?', entradaAtual: buffer[1] });
    assert.deepEqual([resultado.deveResponder, resultado.midia, resultado.tiposMidia], [true, true, ['imagem']]);
  });

  test('Redis que falha (item repassado sem buffer) segue sem agrupar, nunca para', () => {
    const estado = prepararAgrupamento(iniciarEstado(extrairDadosMensagem(corpo()), { resultado: { ok: true, conversa_id: CONVERSA, agrupamento_segundos: 20 } }));
    const decisao = decidirAgrupamento(estado, { ...estado });
    assert.deepEqual([decisao.redis_falhou, decisao.deve_responder, decisao.texto_agrupado], [true, true, estado.texto]);
  });

  test('sem conversa registrada ou sem tempo de agrupamento do banco, não agrupa', () => {
    const semBanco = prepararAgrupamento(iniciarEstado(extrairDadosMensagem(corpo()), { error: { message: 'x' } }));
    assert.equal(semBanco.agrupar, false);
    const semTempo = prepararAgrupamento(iniciarEstado(extrairDadosMensagem(corpo()), { resultado: { ok: true, conversa_id: CONVERSA } }));
    assert.equal(semTempo.agrupar, false);
  });

  test('transcrição que falha vira audio_nao_transcrito; a que funciona sai mascarada', () => {
    const base = iniciarEstado(extrairDadosMensagem(corpo({ texto: '', tipo: 'AudioMessage' })), { resultado: { ok: true, conversa_id: CONVERSA } });
    const falhou = lerTranscricao(base, { error: { message: 'timeout' } });
    assert.deepEqual([falhou.transcricao_ok, falhou.tipo, falhou.audio_nao_transcrito], [false, 'audio_nao_transcrito', true]);
    const ok = lerTranscricao(base, { transcription: 'meu cpf é 52998224725' });
    assert.deepEqual([ok.transcricao_ok, ok.texto], [true, 'meu cpf é [CPF ocultado]']);
  });
});

describe('fluxo 3 · modo e alerta (funções puras)', () => {
  const base = { numero_equipe: false, numero_plantao: false, texto_agrupado: 'x' };
  const pode = (resultado) => lerPodeResponder(base, { resultado });

  test('o nó 16 só para desligado e número da equipe ou do plantão', () => {
    assert.equal(pode({ ok: true, modo: 'vendas', agente_modo: 'desligado' }).parar, true);
    assert.equal(pode({ ok: true, modo: 'silencio', agente_modo: 'producao' }).parar, true);
    assert.equal(lerPodeResponder({ ...base, numero_plantao: true }, { resultado: { ok: true, modo: 'vendas' } }).parar, true);
    for (const modo of ['vendas', 'cliente', 'pausado', 'nao_lead', 'humano_nominal', 'humano_comercial', 'teste']) {
      assert.equal(pode({ ok: true, modo, agente_modo: 'producao' }).parar, false, modo);
    }
  });

  test('teste fora da lista passa pelo filtro com enviar_texto falso e para no nó 21', () => {
    const estado = pode({ ok: true, modo: 'vendas', agente_modo: 'teste', na_whitelist: false });
    assert.deepEqual([estado.parar, estado.teste_fora_lista, estado.enviar_texto_alerta, rotaDoModo(estado)], [false, true, false, 'parar']);
    const naLista = pode({ ok: true, modo: 'vendas', agente_modo: 'teste', na_whitelist: true });
    assert.deepEqual([naLista.teste_fora_lista, naLista.enviar_texto_alerta, rotaDoModo(naLista)], [false, true, 'seguir']);
  });

  test('texto de alerta sai em vendas, cliente, pausado, nao_lead e humano_comercial, nunca nos outros', () => {
    assert.deepEqual(MODOS_COM_TEXTO_DE_ALERTA, ['vendas', 'cliente', 'pausado', 'nao_lead', 'humano_comercial']);
    for (const modo of ['humano_nominal', 'teste_fora_lista', 'desconhecido', 'silencio']) assert.equal(enviarTextoPorModo(modo), false, modo);
  });

  test('banco fora do ar: não para, não responde, alerta só interno', () => {
    const estado = lerPodeResponder(base, { error: { message: 'ECONNREFUSED' } });
    assert.deepEqual([estado.parar, estado.banco_fora, estado.enviar_texto_alerta, rotaDoModo(estado)], [false, true, false, 'parar']);
  });

  test('conversa não encontrada segue como vendas para o alerta, mas o agente não responde', () => {
    const estado = pode({ ok: false, erro: 'conversa não encontrada' });
    assert.deepEqual([estado.modo, estado.enviar_texto_alerta, rotaDoModo(estado)], ['vendas', true, 'parar']);
  });

  test('humano_nominal: alerta sem texto, salvo alerta_saude_sensivel_ativo; perda nunca sai', () => {
    const estado = { ...pode({ ok: true, modo: 'humano_nominal', agente_modo: 'producao' }), alerta: 'saude', chave_texto_alerta: 'alerta_saude' };
    assert.equal(prepararAlerta(estado).fluxo2.enviar_texto, false);
    const ativo = { ...estado, ativacao: { alerta_saude_sensivel_ativo: true } };
    assert.deepEqual([prepararAlerta(ativo).fluxo2.enviar_texto, prepararAlerta(ativo).fluxo2.chave_texto], [true, 'alerta_saude_sensivel']);
    assert.equal(prepararAlerta({ ...ativo, alerta: 'perda', chave_texto_alerta: 'perda' }).fluxo2.enviar_texto, false);
  });

  test('perda de gestação anterior vai ao fluxo 2 com a observação para o aviso ao grupo', () => {
    const estado = { ...pode({ ok: true, modo: 'vendas', agente_modo: 'producao' }), alerta: 'perda', chave_texto_alerta: 'perda', perda_temporalidade: 'anterior' };
    const { fluxo2 } = prepararAlerta(estado);
    assert.deepEqual([fluxo2.acao, fluxo2.motivo, fluxo2.enviar_texto, fluxo2.dados.perda_temporalidade], ['perda', 'perda', true, 'anterior']);
  });

  test('áudio não transcrito: estado_sensivel_escreveu em humano_nominal; texto só nos modos do alerta', () => {
    const nominal = prepararAudioNaoTranscrito({ modo: 'humano_nominal' });
    assert.deepEqual([nominal.fluxo2.motivo, nominal.enviar_texto_audio], ['estado_sensivel_escreveu', false]);
    const pausado = prepararAudioNaoTranscrito({ modo: 'pausado' });
    assert.deepEqual([pausado.fluxo2.motivo, pausado.enviar_texto_audio], ['audio_nao_transcrito', true]);
    assert.equal(prepararAudioNaoTranscrito({ modo: 'vendas', teste_fora_lista: true }).enviar_texto_audio, false);
  });

  test('não lead no início só com conversa ainda não classificada', () => {
    const resposta = { choices: [{ message: { content: JSON.stringify({ tipo_contato: 'candidata', saude: 'nenhum', perda: false }) } }] };
    const estado = { ...pode({ ok: true, modo: 'vendas', agente_modo: 'producao' }), termo: { alerta: false } };
    assert.equal(aplicarClassificacaoMensagem({ ...estado, classificacao_conversa: null }, resposta).nao_lead_no_inicio, true);
    assert.equal(aplicarClassificacaoMensagem({ ...estado, classificacao_conversa: 'lead' }, resposta).nao_lead_no_inicio, false);
  });

  test('não lead no início também dispara com classificacao_conversa "nao_classificado" (ADR 0003, divergência 1: registrar_mensagem.classificacao devolve o enum, não null)', () => {
    const resposta = { choices: [{ message: { content: JSON.stringify({ tipo_contato: 'candidata', saude: 'nenhum', perda: false }) } }] };
    const estado = { ...pode({ ok: true, modo: 'vendas', agente_modo: 'producao' }), termo: { alerta: false } };
    assert.equal(aplicarClassificacaoMensagem({ ...estado, classificacao_conversa: 'nao_classificado' }, resposta).nao_lead_no_inicio, true);
  });

  test('histórico do classificador: até 12 mensagens antes do pedido atual', () => {
    const mensagens = Array.from({ length: 20 }, (_, i) => ({ de: i % 2 ? 'familia' : 'isadora', texto: `m${i}` }));
    const texto = historicoParaClassificador([...mensagens, { de: 'familia', texto: 'nova' }], 12);
    assert.equal(texto.split('\n').length, 12);
    assert.ok(!texto.includes('nova'));
    assert.ok(texto.startsWith('Kraamzorg: ') || texto.startsWith('Família: '));
  });

  test('retorno do fluxo 2: reserva no alerta só se o fluxo 2 não rodou; na IA fora do ar, se não registrou', () => {
    const rodouSemBanco = { ok: false, handoff_id: null, instrucao_chave: 'instrucao_saude' };
    assert.equal(lerRetornoFluxo2({}, rodouSemBanco, { reserva: 'se_nao_rodou' }).usar_grupo_reserva, false);
    assert.equal(lerRetornoFluxo2({ _kz_estado: true }, { _kz_estado: true }, { reserva: 'se_nao_rodou' }).usar_grupo_reserva, true);
    assert.equal(lerRetornoFluxo2({}, { ok: false, instrucao_chave: 'instrucao_erro' }, { reserva: 'se_nao_registrou' }).usar_grupo_reserva, true);
    const ia = prepararIaForaDoAr({ texto_agrupado: 'oi' }, { resumo: 'RESUMO DO CONFIG' });
    assert.deepEqual([ia.fluxo2.motivo, ia.fluxo2.prioridade_minima, ia.fluxo2.resumo, ia.fluxo2.enviar_texto], ['outro', 'alta', 'RESUMO DO CONFIG', false]);
  });
});

describe('fluxo 3 · validarResposta (11.11 itens 3 a 8 e 5a)', () => {
  const validar = (texto, extra = {}) => validarResposta(texto, { ...CONTEXTO_VALIDADOR, ...extra });
  const regras = (resultado) => resultado.violacoes.map((v) => v.regra);

  test('valores em qualquer forma: "R$ x", "x reais", "3x de x", "x mil"', () => {
    const valores = encontrarValores('R$ 4.200, 8.100 reais, 3x de R$ 2.700, 3x de 1.400 e 4,2 mil');
    assert.deepEqual(
      valores.map((v) => [v.forma, v.centavos]),
      [['avista', 420000], ['avista', 810000], ['parcela', 270000], ['parcela', 140000], ['avista', 420000]],
    );
    assert.equal(encontrarValores('em até 3x sem juros, 12 dias, às 10h').length, 0);
  });

  test('valor fora da tabela reprova', () => {
    assert.ok(regras(validar('O Essencial é R$ 3.900.')).includes('valor_fora_da_tabela'));
    assert.ok(regras(validar('O Essencial sai por 3.500 reais.')).includes('valor_fora_da_tabela'));
  });

  test('valor por extenso reprova', () => {
    assert.ok(temValorPorExtenso('quatro mil e duzentos reais'));
    assert.ok(regras(validar('O Essencial é quatro mil e duzentos reais.')).includes('valor_por_extenso'));
  });

  test('plano citado no mesmo bloco: "O Continuado cuida de vocês por 12 dias. O investimento é R$ 4.200" reprova', () => {
    assert.ok(regras(validar('O Continuado cuida de vocês por 12 dias. O investimento é R$ 4.200')).includes('valor_de_outro_plano'));
    assert.equal(validar('O Continuado cuida de vocês por 12 dias. O investimento é R$ 8.100').aprovada, true);
  });

  test('plano do bloco anterior vale para o bloco sem plano', () => {
    assert.equal(validar('O Continuado é o de 12 dias.\n\nO investimento é R$ 8.100 ou 3x de R$ 2.700.').aprovada, true);
    assert.ok(regras(validar('O Continuado é o de 12 dias.\n\nO investimento é R$ 4.200.')).includes('valor_de_outro_plano'));
  });

  test('bloco com mais de um plano: cada valor na mesma frase do seu plano', () => {
    assert.equal(validar('O Essencial é R$ 4.200. O Continuado é R$ 8.100.').aprovada, true);
    assert.equal(validar('O Essencial é R$ 4.200, o Imersão é R$ 6.300 e o Continuado é R$ 8.100.').aprovada, true);
    assert.ok(regras(validar('Temos o Essencial e o Continuado. O valor é R$ 8.100.')).includes('valor_sem_o_plano_na_frase'));
  });

  test('sem plano citado: só o menor valor com "a partir de"', () => {
    assert.equal(validar('São três formatos, a partir de R$ 4.200, em até 3x sem juros.').aprovada, true);
    assert.ok(regras(validar('São três formatos, a partir de R$ 6.300.')).includes('valor_sem_plano'));
    assert.ok(regras(validar('O investimento é R$ 4.200.')).includes('valor_sem_plano'));
  });

  test('"Gemelar Essencial" não conta como "Essencial"; apelido do plano vale como citação', () => {
    assert.deepEqual(planosCitados('o Gemelar Essencial', PLANOS), [3]);
    assert.equal(validar('O Gemelar Essencial é R$ 5.400.').aprovada, true);
    assert.equal(validar('O plano de 12 dias é R$ 8.100 ou 3x de R$ 2.700.').aprovada, true);
  });

  test('parcela precisa ser a parcela do plano, no número de vezes do plano', () => {
    assert.ok(regras(validar('O Continuado sai em 3x de R$ 1.400.')).includes('valor_de_outro_plano'));
    assert.ok(regras(validar('O Continuado sai em 6x de R$ 1.350.')).includes('valor_fora_da_tabela'));
  });

  test('taxa só passa quando está na lista (taxa_visivel_agente)', () => {
    assert.ok(regras(validar('A taxa de deslocamento é R$ 150.')).includes('valor_fora_da_tabela'));
    assert.equal(validar('A taxa de deslocamento é R$ 150.', { taxas_centavos: [15000] }).aprovada, true);
  });

  test('percentual perto de condição reprova; percentual sem condição passa', () => {
    assert.ok(regras(validar('No Pix tem 10% de desconto.')).includes('percentual_de_condicao'));
    assert.equal(validar('75% das complicações acontecem na primeira semana.').aprovada, true);
  });

  test('promessa, escassez, negar ser assistente virtual', () => {
    assert.ok(regras(validar('Pode ficar tranquila, vai dar tudo certo.')).includes('promessa'));
    assert.ok(regras(validar('Corre, é a última vaga.')).includes('escassez'));
    assert.ok(regras(validar('Não sou um robô, sou humana.')).includes('nega_assistente_virtual'));
  });

  test('palavra evitada por palavra inteira: "cura" reprova, "curativo" passa', () => {
    assert.ok(regras(validar('Não é cura.')).includes('palavra_evitada'));
    assert.equal(validar('A enfermeira olha o curativo.').aprovada, true);
    assert.ok(regras(validar('Oi, mamãe!')).includes('palavra_evitada'));
  });

  test('pedido de documento ou dado pessoal reprova; dizer que não precisa mandar passa', () => {
    assert.ok(regras(validar('Me passa seu CPF?')).includes('pedido_de_dado'));
    assert.ok(regras(validar('Não se preocupe, me passa seu e-mail.')).includes('pedido_de_dado'));
    assert.equal(validar('Por segurança, não precisa mandar documentos por aqui.').aprovada, true);
  });

  test('com a lista de verbos de pedido, menção sem pedido passa', () => {
    const comVerbos = { listas: { ...LISTAS, pedido_verbos: ['manda', 'passa', 'envia', 'informe'] } };
    assert.equal(validar('O documento fiscal descreve o cuidado domiciliar.', comVerbos).aprovada, true);
    assert.ok(regras(validar('Me manda o documento.', comVerbos)).includes('pedido_de_dado'));
  });

  test('travessão e meia-risca viram vírgula; markdown sai; um negrito do WhatsApp por bloco', () => {
    const resultado = validar('## Título\n- Oi — tudo bem? **Claro** *Essencial* e *Continuado* ficam. [link](https://x)');
    assert.equal(resultado.texto.includes('—'), false);
    assert.equal(resultado.texto.includes('**'), false);
    assert.equal(resultado.texto.includes('##'), false);
    assert.equal((resultado.texto.match(/\*/g) ?? []).length, 2);
    assert.ok(resultado.correcoes.includes('travessao_trocado_por_virgula'));
    assert.ok(resultado.correcoes.includes('markdown_removido'));
    assert.ok(resultado.texto.startsWith('Título\nOi, tudo bem?'));
  });

  test('emoji: um por resposta; nenhum com "R$"; nenhum com motivo em curso saúde, perda ou reclamação', () => {
    assert.equal(validar('Oi 😊 tudo bem? 🤍').texto, 'Oi 😊 tudo bem?');
    assert.equal(validar('O Essencial é R$ 4.200 🤍').texto, 'O Essencial é R$ 4.200');
    for (const motivo of ['saude', 'perda', 'reclamacao']) {
      assert.equal(validar('Sinto muito 🤍', { motivo_em_curso: motivo }).texto, 'Sinto muito', motivo);
    }
  });

  test('uma exclamação por bloco', () => {
    assert.equal(validar('Que alegria!! Parabéns!').texto, 'Que alegria! Parabéns.');
  });

  test('mais de um "?" fora de citação reprova, exceto no fechamento da venda', () => {
    assert.ok(regras(validar('Qual a sua DPP? E a cidade?')).includes('perguntas_demais'));
    assert.equal(validar('Ela disse "vocês atendem? tem vaga?" e eu respondi. Qual a sua DPP?').aprovada, true);
    assert.equal(validar('Qual plano? E prefere cartão ou Pix?', { fechamento_venda: true }).aprovada, true);
  });

  test('texto entre colchetes reprova, salvo [ENVIAR_APRESENTACAO] sozinho numa linha', () => {
    assert.equal(validar('[ENVIAR_APRESENTACAO]\nTe mandei a apresentação.').aprovada, true);
    assert.ok(regras(validar('Te mandei [ENVIAR_APRESENTACAO] a apresentação.')).includes('colchetes'));
    assert.ok(regras(validar('Vou chamar a equipe [transferir_para_equipe].')).includes('colchetes'));
  });

  test('marca precisa_pdf com valor ou com o pedido de apresentação', () => {
    assert.equal(validar('O Essencial é R$ 4.200.').precisa_pdf, true);
    assert.equal(validar('[ENVIAR_APRESENTACAO]\nSegue.').precisa_pdf, true);
    assert.equal(validar('Oi!').precisa_pdf, false);
  });

  test('link reprova; listas ausentes reprovam tudo (falha fechada)', () => {
    assert.ok(regras(validar('Veja em https://exemplo.invalid')).includes('link'));
    assert.ok(regras(validarResposta('Oi!', { planos: PLANOS })).includes('validador_sem_listas'));
  });
});

describe('fluxo 3 · prepararEnvio (função pura)', () => {
  const pdf = FICHA.pdf;
  const agora = '2026-09-24T22:40:00.000Z';
  const digitacao = { minimoMs: 2500, maximoMs: 5000 };

  test('no máximo três blocos de cerca de 280 caracteres, sem quebrar frase', () => {
    const frase = 'Esta é uma frase de exemplo com tamanho médio para encher o bloco. ';
    const texto = `${frase.repeat(6)}\n\n${frase.repeat(6)}\n\n${frase.repeat(6)}`;
    const { envios } = prepararEnvio({ texto, pdf, agora, digitacao });
    assert.ok(envios.length <= 3);
    for (const envio of envios) assert.match(envio.texto, /[.!?]$/);
    const { blocos } = montarBlocos(`${frase.repeat(4)}`);
    assert.ok(blocos.every((bloco) => bloco.texto.length <= 300));
  });

  test('apresentação antes do primeiro bloco com valor', () => {
    const { envios, apresentacao } = prepararEnvio({
      texto: 'Que bom que você quer conhecer.\n\nO Essencial é R$ 4.200.\n\nQual a sua DPP?',
      pdf,
      agora,
      digitacao,
    });
    assert.equal(apresentacao, 'valor');
    assert.deepEqual(envios.map((e) => e.tipo), ['texto', 'documento', 'texto', 'texto']);
    assert.equal(envios[1].arquivo, pdf.url);
  });

  test('janela de reenvio: zero (padrão) manda sempre; dentro da janela não repete', () => {
    assert.equal(apresentacaoPorValorSai({ reenvio_janela_horas: 0, enviado_em: agora }, agora), true);
    assert.equal(apresentacaoPorValorSai({ reenvio_janela_horas: 24, enviado_em: '2026-09-24T20:00:00.000Z' }, agora), false);
    assert.equal(apresentacaoPorValorSai({ reenvio_janela_horas: 24, enviado_em: '2026-09-22T20:00:00.000Z' }, agora), true);
    const { envios } = prepararEnvio({
      texto: 'O Essencial é R$ 4.200.',
      pdf: { ...pdf, reenvio_janela_horas: 24, enviado_em: '2026-09-24T20:00:00.000Z' },
      agora,
      digitacao,
    });
    assert.deepEqual(envios.map((e) => e.tipo), ['texto']);
  });

  test('[ENVIAR_APRESENTACAO] manda sempre, no ponto marcado, e a linha não sai como texto', () => {
    const { envios } = prepararEnvio({
      texto: 'Que bom!\n\n[ENVIAR_APRESENTACAO]\nTe mandei a nossa apresentação.',
      pdf: { ...pdf, reenvio_janela_horas: 24, enviado_em: agora },
      agora,
      digitacao,
    });
    assert.deepEqual(envios.map((e) => e.tipo), ['texto', 'documento', 'texto']);
    assert.ok(!envios.some((e) => (e.texto ?? '').includes('ENVIAR_APRESENTACAO')));
    const soMarca = prepararEnvio({ texto: '[ENVIAR_APRESENTACAO]', pdf, agora, digitacao });
    assert.deepEqual(soMarca.envios.map((e) => e.tipo), ['documento']);
  });

  test('[SILENCIO] em qualquer posição encerra', () => {
    for (const texto of ['[SILENCIO]', 'Tente se deitar e beber água. [SILENCIO]', 'Oi\n\n[ SILENCIO ]\n\ntchau']) {
      const resultado = prepararEnvio({ texto, pdf, agora, digitacao });
      assert.deepEqual([resultado.silencio, resultado.envios.length], [true, 0], texto);
    }
  });

  test('sem o arquivo da apresentação, valor nenhum sai (e o fluxo transfere)', () => {
    const resultado = prepararEnvio({ texto: 'O Essencial é R$ 4.200.', pdf: { ...pdf, url: '' }, agora, digitacao });
    assert.deepEqual([resultado.tem_envio, resultado.faltou_apresentacao], [false, true]);
  });

  test('digitação de 2,5 a 5 s por bloco, proporcional ao tamanho', () => {
    const curto = prepararEnvio({ texto: 'Oi.', pdf, agora, digitacao }).envios[0].delay_ms;
    const longo = prepararEnvio({ texto: `${'Frase longa de exemplo. '.repeat(12)}`, pdf, agora, digitacao }).envios[0].delay_ms;
    assert.ok(curto >= 2500 && curto < 3000);
    assert.ok(longo >= 4500 && longo <= 5000);
  });
});

describe('fluxo 3 · saída do agente e reescrita (funções puras)', () => {
  const estado = { validador: CONTEXTO_VALIDADOR, handoff_id_execucao: null };

  test('acionar_equipe_saude descarta a saída, seja qual for', () => {
    const passos = [{ action: { tool: 'acionar_equipe_saude', toolInput: { tipo: 'saude' } }, observation: '[{"ok":true}]' }];
    const lido = lerSaidaAgente(estado, { output: 'Tente se deitar e beber água. [SILENCIO]', intermediateSteps: passos });
    assert.deepEqual([lido.responder, lido.saida_descartada_saude, lido.modelo_falhou], [false, true, false]);
    const semPasso = lerSaidaAgente(estado, { output: 'Tente se deitar e beber água.' }, { saudeExecutada: true });
    assert.deepEqual([semPasso.responder, semPasso.saida_descartada_saude], [false, true]);
  });

  test('transferência que o fluxo 2 subiu para saúde (instrucao_saude) também descarta', () => {
    const passos = [
      {
        action: { tool: 'transferir_para_equipe', toolInput: { motivo: 'contratar' } },
        observation: JSON.stringify([{ ok: true, handoff_id: 'h-1', instrucao_chave: 'instrucao_saude' }]),
      },
    ];
    const lido = lerSaidaAgente(estado, { output: 'O Leonardo segue com vocês.', intermediateSteps: passos });
    assert.deepEqual([lido.responder, lido.saida_descartada_saude], [false, true]);
  });

  test('handoff_id da transferência desta execução vai para o pode_enviar', () => {
    const passos = [
      { action: { tool: 'transferir_para_equipe', toolInput: { motivo: 'reuniao' } }, observation: '{"ok":true,"handoff_id":"h-9","instrucao_chave":"instrucao_reuniao"}' },
    ];
    const lido = lerSaidaAgente(estado, { output: 'Combinado!', intermediateSteps: passos });
    assert.deepEqual([lido.responder, lido.handoff_id_execucao, lido.motivos_transferidos], [true, 'h-9', ['reuniao']]);
  });

  test('[SILENCIO] em qualquer posição encerra; falha do modelo e texto vazio vão para "IA fora do ar"', () => {
    assert.deepEqual([lerSaidaAgente(estado, { output: 'Oi [SILENCIO] tchau' }).silencio, lerSaidaAgente(estado, { output: 'Oi [SILENCIO]' }).responder], [true, false]);
    assert.equal(lerSaidaAgente(estado, { error: 'timeout' }).modelo_falhou, true);
    assert.equal(lerSaidaAgente(estado, { _kz_estado: true }).modelo_falhou, true, 'item repassado');
    assert.equal(lerSaidaAgente(estado, { output: '   ' }).modelo_falhou, true);
  });

  test('fechamento da venda: atualizar_ficha com quer_contratar libera as perguntas juntas', () => {
    const passos = [{ action: { tool: 'atualizar_ficha', toolInput: { dados: { quer_contratar: true } } }, observation: '{}' }];
    const lido = lerSaidaAgente(estado, { output: 'Que alegria! Qual plano? E prefere cartão ou Pix?', intermediateSteps: passos });
    assert.equal(validarRespostaDoAgente(lido).resposta_aprovada, true);
  });

  test('reescrita: [SEGURANCA] e violação que persiste reprovam; transferir só com motivo válido', () => {
    const resposta = (objeto) => ({ choices: [{ message: { content: JSON.stringify(objeto) } }] });
    const base = { validador: CONTEXTO_VALIDADOR, texto_resposta: 'x', violacoes: [] };
    assert.equal(lerReescrita(base, resposta({ texto: '[SEGURANCA]', transferir: null })).reescrita_aprovada, false);
    assert.equal(lerReescrita(base, resposta({ texto: 'O Essencial é R$ 3.000.', transferir: null })).reescrita_aprovada, false);
    const ok = lerReescrita(base, resposta({ texto: 'Essa condição quem confirma é o Leonardo.', transferir: 'condicao_comercial' }));
    assert.deepEqual([ok.reescrita_aprovada, ok.reescrita_transferir, ok.tem_transferencia_reescrita], [true, 'condicao_comercial', true]);
    assert.equal(lerReescrita(base, resposta({ texto: 'Ok.', transferir: 'inventado' })).reescrita_transferir, null);
    assert.equal(lerReescrita(base, { error: 'x' }).reescrita_aprovada, false);
  });

  test('só o que saiu vai para o registro e para a memória', () => {
    const consolidado = consolidarEnvio([
      { tipo: 'texto', texto: 'um', envio_saiu: true, ordem: 0 },
      { tipo: 'documento', envio_saiu: true, ordem: 1 },
      { tipo: 'texto', texto: 'dois', envio_saiu: false, ordem: 2 },
    ]);
    assert.deepEqual([consolidado.pdf_saiu, consolidado.texto_enviado], [true, 'um']);
  });

  test('entrada do agente: mídia com legenda ganha a linha do config, sem comentar a imagem', () => {
    const estadoMidia = { midia: true, texto_agrupado: 'o que vocês acham?', tipos_midia: ['imagem'], modo: 'vendas' };
    const entrada = prepararEntradaAgente(estadoMidia, { resultado: FICHA }, { linhaMidia: '[{midia} · {legenda}]', nomesMidia: { imagem: 'FOTO' } });
    assert.equal(entrada.entrada_agente, '[FOTO · o que vocês acham?]');
    assert.equal(entrada.prompt['valor.continuado'], 'R$ 8.100');
    assert.deepEqual(Object.keys(entrada.prompt), VARIAVEIS_PROMPT_ISADORA);
  });

  test('resolverUrlPdf (ADR 0003, divergência 4): URL absoluta passa direto; caminho cru só vira URL com urlPublicaMarketing; sem base, some (nunca manda link quebrado)', () => {
    assert.equal(resolverUrlPdf('https://exemplo.invalid/a.pdf', ''), 'https://exemplo.invalid/a.pdf');
    assert.equal(resolverUrlPdf('https://exemplo.invalid/a.pdf', 'https://outra.invalid/marketing'), 'https://exemplo.invalid/a.pdf');
    assert.equal(resolverUrlPdf('apresentacao/kraamzorg.pdf', 'https://exemplo.invalid/marketing/'), 'https://exemplo.invalid/marketing/apresentacao/kraamzorg.pdf');
    assert.equal(resolverUrlPdf('apresentacao/kraamzorg.pdf', 'https://exemplo.invalid/marketing'), 'https://exemplo.invalid/marketing/apresentacao/kraamzorg.pdf');
    assert.equal(resolverUrlPdf('apresentacao/kraamzorg.pdf', ''), '');
    assert.equal(resolverUrlPdf('', 'https://exemplo.invalid/marketing'), '');
  });

  test('ficha_para_agente com pdf.url só como caminho (seed real, sem "url" em pdf_apresentacao): a entrada do agente monta a URL a partir do config, nunca manda o caminho cru', () => {
    const fichaComCaminho = { ...FICHA, pdf: { ...FICHA.pdf, url: 'apresentacao/kraamzorg-2026-leve.pdf' } };
    const estado = { texto_agrupado: 'oi', modo: 'vendas' };
    const semConfig = prepararEntradaAgente(estado, { resultado: fichaComCaminho }, {});
    assert.equal(semConfig.pdf.url, '', 'sem urlPublicaMarketing, o caminho cru não vira envio (faltou_apresentacao cuida do resto)');
    const comConfig = prepararEntradaAgente(estado, { resultado: fichaComCaminho }, { urlPublicaMarketing: 'https://exemplo.invalid/marketing' });
    assert.equal(comConfig.pdf.url, 'https://exemplo.invalid/marketing/apresentacao/kraamzorg-2026-leve.pdf');
  });
});

describe('fluxo 3 · follow-up (funções puras)', () => {
  const estado = { listas: LISTAS, enviados_hoje: ['Oi, Carla! Conseguiu ver a apresentação com calma?'], limite_similaridade: 0.7 };
  const resposta = (texto) => ({ choices: [{ message: { content: JSON.stringify({ texto }) } }] });

  test('[SILENCIO] lido antes do validador; valor, colchete e JSON inválido reprovam', () => {
    assert.equal(validarFollowup(estado, resposta('[SILENCIO]')).followup_motivo, 'silencio');
    assert.equal(validarFollowup(estado, resposta('Oi! O Essencial é R$ 4.200.')).followup_motivo, 'validador');
    assert.equal(validarFollowup(estado, resposta('[ENVIAR_APRESENTACAO]\nOi!')).followup_motivo, 'validador');
    assert.equal(validarFollowup(estado, { choices: [{ message: { content: 'não é json' } }] }).followup_motivo, 'geracao_falhou');
  });

  test('nunca a mesma mensagem proativa a duas famílias no mesmo dia (hash e semelhança)', () => {
    assert.equal(hashDoTexto('Oi, Carla!'), hashDoTexto('oi carla'));
    assert.ok(semelhanca('Oi Ana, conseguiu ver a apresentação com calma?', 'Oi Carla, conseguiu ver a apresentação com calma?') >= 0.7);
    assert.match(validarFollowup(estado, resposta('Oi, Carla! Conseguiu ver a apresentação com calma?')).followup_motivo, /^repete_envio_do_dia/);
    assert.match(validarFollowup(estado, resposta('Oi, Ana! Conseguiu ver a apresentação com calma?')).followup_motivo, /semelhanca/);
    assert.equal(validarFollowup(estado, resposta('Oi! Como está a gestação? Se quiser, te conto como funciona o cuidado.')).followup_aprovado, true);
  });

  test('só follow-up completo (id, conversa, jid) entra; fechado com ok só quando saiu', () => {
    const itens = separarFollowups({ resultado: { ok: true, itens: [{ execucao_id: 'e1', conversa_id: 'c1', wa_jid: JID }, { execucao_id: 'e2' }], validador: { listas: LISTAS } } });
    assert.deepEqual(itens.map((i) => i.execucao_id), ['e1']);
    assert.equal(separarFollowups({ error: 'x' }).length, 0);
    assert.equal(fecharFollowup({ followup_aprovado: true, pode_enviar: true, envio_saiu: true, texto_followup: 'x' }).followup_ok, true);
    assert.equal(fecharFollowup({ followup_aprovado: true, pode_enviar: false }).followup_ok, false);
  });
});

// ---------------------------------------------------------------------------
// 2. Cenários do P25 no simulador
// ---------------------------------------------------------------------------

describe('fluxo 3 · cenários do P25 (JSON gerado no simulador)', () => {
  test('"Olá" em vendas: pode_enviar resposta, envio com track_source, registro e memória com o que saiu', async () => {
    const ambiente = criarAmbiente();
    const execucao = await rodar(ambiente, corpo());
    assert.ok(execucao.rodou(NOS.agente));
    const envios = ambiente.enviosDe(NOS.enviarTexto);
    assert.equal(envios.length, 1);
    assert.equal(envios[0].number, JID);
    assert.equal(envios[0].track_source, 'kraamzorg-agente');
    assert.ok(envios[0].delay >= 2500);
    const podeEnviar = ambiente.chamadas('pode_enviar');
    assert.deepEqual(podeEnviar.map((c) => c.argumentos.slice(0, 2)), [[CONVERSA, 'resposta']]);
    assert.ok(execucao.ordem.indexOf(NOS.reconsultar) < execucao.ordem.indexOf(NOS.enviarTexto));
    const memoria = ambiente.chamadas('sincronizar_memoria');
    assert.deepEqual(memoria.map((c) => c.argumentos), [[CONVERSA, 'ia', 'Oi! Que bom receber sua mensagem 🤍']]);
    assert.ok(ambiente.chamadas('registrar_mensagem').some((c) => c.argumentos[1] === 'saida' && c.argumentos[2] === 'ia'));
  });

  test('ordem de segurança: termos e classificador rodam antes do Decidir Modo e do agente', async () => {
    const ambiente = criarAmbiente();
    const { ordem } = await rodar(ambiente, corpo());
    const posicao = (nome) => ordem.indexOf(nome);
    assert.ok(posicao(NOS.checarTermos) < posicao(NOS.decidirModo));
    assert.ok(posicao(NOS.classificarMensagem) < posicao(NOS.decidirModo));
    assert.ok(posicao(NOS.decidirModo) < posicao(NOS.agente));
  });

  test('apresentação chega antes do primeiro valor', async () => {
    const ambiente = criarAmbiente({ agente: () => ({ output: 'Que bom que você quer conhecer.\n\nO Continuado é R$ 8.100 ou 3x de R$ 2.700.' }) });
    await rodar(ambiente, corpo({ texto: 'Quanto é o de 12 dias?' }));
    const envios = ambiente.estado.envios.filter((e) => e.no === NOS.enviarTexto || e.no === NOS.enviarApresentacao);
    assert.deepEqual(envios.map((e) => e.no), [NOS.enviarTexto, NOS.enviarApresentacao, NOS.enviarTexto]);
    assert.equal(envios[1].type, 'document');
    assert.ok(ambiente.chamadas('registrar_marco').some((c) => c.argumentos[0] === CONVERSA));
  });

  test('teste fora da lista com "sangramento": fluxo 2 com enviar_texto falso, nada à família, agente não roda', async () => {
    const ambiente = criarAmbiente({
      podeResponder: { ok: true, modo: 'vendas', agente_modo: 'teste', na_whitelist: false },
      termos: [['sangramento', 'handoff_saude']],
    });
    const execucao = await rodar(ambiente, corpo({ texto: 'estou com sangramento' }));
    assert.equal(ambiente.estado.fluxo2.length, 1);
    const { entrada } = ambiente.estado.fluxo2[0];
    assert.deepEqual([entrada.acao, entrada.enviar_texto, entrada.origem_chamada, entrada.conversa_id, entrada.wa_jid], ['alerta_saude', false, 'filtro_termos', CONVERSA, JID]);
    assert.ok(!execucao.rodou(NOS.decidirModo));
    assert.ok(!execucao.rodou(NOS.agente));
    assert.equal(ambiente.estado.envios.length, 0);
  });

  test('vendas "perdi o bebê": fluxo 2 com perda e texto; o modelo de conversa não roda', async () => {
    const ambiente = criarAmbiente({ termos: [['perdi o bebe', 'bloqueio_total']] });
    const execucao = await rodar(ambiente, corpo({ texto: 'perdi o bebe' }));
    const { entrada } = ambiente.estado.fluxo2[0];
    assert.deepEqual([entrada.acao, entrada.motivo, entrada.chave_texto, entrada.enviar_texto], ['perda', 'perda', 'perda', true]);
    assert.ok(!execucao.rodou(NOS.agente));
    assert.equal(ambiente.estado.agente.length, 0);
  });

  test('alerta termina a execução em todos os modos (vendas, cliente, pausado, humano_comercial, humano_nominal)', async () => {
    for (const [modo, enviar] of [['vendas', true], ['cliente', true], ['pausado', true], ['nao_lead', true], ['humano_comercial', true], ['humano_nominal', false]]) {
      const ambiente = criarAmbiente({ podeResponder: { ok: true, modo, agente_modo: 'producao' }, classificacao: CLASSIFICACAO_URGENCIA });
      const execucao = await rodar(ambiente, corpo({ texto: 'estou passando mal' }));
      assert.equal(ambiente.estado.fluxo2.length, 1, modo);
      assert.equal(ambiente.estado.fluxo2[0].entrada.enviar_texto, enviar, modo);
      assert.equal(ambiente.estado.fluxo2[0].entrada.origem_chamada, 'classificador', modo);
      for (const no of [NOS.decidirModo, NOS.agente, NOS.acrescentarHandoff, NOS.avisarEstadoSensivel]) assert.ok(!execucao.rodou(no), `${modo}: ${no}`);
    }
  });

  test('família em bloqueio_total com sintoma: alerta_saude_sensivel só com o parâmetro ligado', async () => {
    const ligado = criarAmbiente({
      podeResponder: { ok: true, modo: 'humano_nominal', agente_modo: 'producao', alerta_saude_sensivel_ativo: true },
      classificacao: CLASSIFICACAO_URGENCIA,
    });
    await rodar(ligado, corpo({ texto: 'febre alta e sangrando muito' }));
    assert.deepEqual([ligado.estado.fluxo2[0].entrada.enviar_texto, ligado.estado.fluxo2[0].entrada.chave_texto], [true, 'alerta_saude_sensivel']);
  });

  test('falha do filtro de termos não bloqueia o classificador; classificador que falha não cala o agente', async () => {
    const ambiente = criarAmbiente({ falhas: ['checar_termos_alerta', 'openai_classificacao'] });
    const execucao = await rodar(ambiente, corpo());
    assert.ok(execucao.rodou(NOS.classificarMensagem));
    assert.ok(execucao.rodou(NOS.agente));
  });

  test('"Queria saber do contrato, e desde ontem estou com um sangramento" com filtro e classificador falhando: saída do modelo descartada', async () => {
    const ambiente = criarAmbiente({
      falhas: ['checar_termos_alerta', 'openai_classificacao'],
      agente: () => ({
        output: 'O Leonardo segue com vocês.',
        intermediateSteps: [
          {
            action: { tool: 'transferir_para_equipe', toolInput: { motivo: 'contratar' } },
            observation: JSON.stringify([{ ok: true, handoff_id: 'h-1', instrucao_chave: 'instrucao_saude' }]),
          },
        ],
      }),
    });
    const execucao = await rodar(ambiente, corpo({ texto: 'Queria saber do contrato, e desde ontem estou com um sangramento' }));
    assert.ok(execucao.rodou(NOS.agente));
    assert.equal(ambiente.estado.envios.length, 0);
    assert.ok(!execucao.rodou(NOS.validarResposta));
  });

  test('"Tente se deitar e beber água. [SILENCIO]" depois de acionar_equipe_saude: nada sai, e a memória descarta a fala que a família nunca leu (ADR 0003, divergência 2)', async () => {
    const ambiente = criarAmbiente({
      agente: (parametros, item, ctx) => {
        ctx.marcarExecutado(FERRAMENTAS.acionarEquipeSaude);
        return { output: 'Tente se deitar e beber água. [SILENCIO]' };
      },
    });
    await rodar(ambiente, corpo({ texto: 'estou meio tonta' }));
    assert.equal(ambiente.estado.envios.length, 0);
    assert.equal(ambiente.chamadas('pode_enviar').length, 0);
    assert.deepEqual(ambiente.chamadas('sincronizar_memoria').map((c) => c.argumentos), [[CONVERSA, 'descartado', null]]);
  });

  test('[SILENCIO] no meio do texto: nada sai, e a memória descarta a fala que a família nunca leu (ADR 0003, divergência 2)', async () => {
    const ambiente = criarAmbiente({ agente: () => ({ output: 'Combinado. [SILENCIO] Até mais.' }) });
    const execucao = await rodar(ambiente, corpo({ texto: 'ok, obrigada' }));
    assert.equal(ambiente.estado.envios.length, 0);
    assert.ok(!execucao.rodou(NOS.validarResposta));
    assert.deepEqual(ambiente.chamadas('sincronizar_memoria').map((c) => c.argumentos), [[CONVERSA, 'descartado', null]]);
  });

  test('modelo de conversa fora do ar: fluxo 2 com outro, prioridade alta e resumo do config; nada à família', async () => {
    const config = await configExemplo();
    const ambiente = criarAmbiente({ falhas: ['agente'] });
    const execucao = await rodar(ambiente, corpo());
    const chamada = ambiente.estado.fluxo2.find((c) => c.no === NOS.avisarIaForaDoAr);
    assert.deepEqual(
      [chamada.entrada.motivo, chamada.entrada.prioridade_minima, chamada.entrada.resumo, chamada.entrada.enviar_texto],
      ['outro', 'alta', config.textosSistema.resumoIaForaDoAr, false],
    );
    assert.equal(ambiente.estado.envios.length, 0);
    assert.ok(!execucao.rodou(NOS.montarAvisoReserva));
  });

  test('modelo fora do ar e registrar_handoff falhando: grupo de reserva com o texto do config', async () => {
    const config = await configExemplo();
    const ambiente = criarAmbiente({ falhas: ['agente'], fluxo2SemRegistro: true });
    await rodar(ambiente, corpo({ texto: 'oi, alguém aí?' }));
    const reserva = ambiente.enviosDe(NOS.avisarGrupoReserva);
    assert.equal(reserva.length, 1);
    assert.equal(reserva[0].number, config.grupoFallbackJid);
    assert.equal(reserva[0].text, config.grupoFallbackTexto.replace('{telefone}', '+000000000001').replace('{texto_familia}', 'oi, alguém aí?'));
  });

  test('fluxo 2 que nem roda no alerta: o fluxo 3 avisa o grupo de reserva', async () => {
    const ambiente = criarAmbiente({ termos: [['sangramento', 'handoff_saude']], falhas: [NOS.caminhoDeAlerta] });
    await rodar(ambiente, corpo({ texto: 'sangramento' }));
    assert.equal(ambiente.enviosDe(NOS.avisarGrupoReserva).length, 1);
  });

  test('banco fora do ar no "Pode Responder?": não responde, mas o texto passa pelo filtro e o alerta chega ao fluxo 2', async () => {
    const semAlerta = criarAmbiente({ falhas: ['pode_responder'] });
    const execucao = await rodar(semAlerta, corpo());
    assert.ok(execucao.rodou(NOS.classificarMensagem));
    assert.ok(!execucao.rodou(NOS.agente));
    assert.equal(semAlerta.estado.envios.length, 0);

    const comAlerta = criarAmbiente({ falhas: ['pode_responder'], classificacao: CLASSIFICACAO_URGENCIA });
    await rodar(comAlerta, corpo({ texto: 'socorro' }));
    assert.equal(comAlerta.estado.fluxo2[0].entrada.enviar_texto, false);
  });

  test('desligado e número da equipe param no nó 16, antes do filtro (a mensagem já está gravada)', async () => {
    const desligado = criarAmbiente({ podeResponder: { ok: true, modo: 'vendas', agente_modo: 'desligado' } });
    const execucao = await rodar(desligado, corpo());
    assert.ok(execucao.rodou(NOS.registrarMsgFamilia));
    assert.ok(!execucao.rodou(NOS.checarTermos));
    const equipe = criarAmbiente({ equipe: true });
    assert.ok(!(await rodar(equipe, corpo())).rodou(NOS.classificarMensagem));
  });

  test('pausado, nao_lead e teste fora da lista sem alerta: nada sai', async () => {
    for (const podeResponder of [
      { ok: true, modo: 'pausado', agente_modo: 'producao' },
      { ok: true, modo: 'nao_lead', agente_modo: 'producao' },
      { ok: true, modo: 'vendas', agente_modo: 'teste', na_whitelist: false },
    ]) {
      const ambiente = criarAmbiente({ podeResponder });
      const execucao = await rodar(ambiente, corpo());
      assert.ok(execucao.rodou(NOS.decidirModo), podeResponder.modo);
      assert.ok(!execucao.rodou(NOS.agente), podeResponder.modo);
      assert.equal(ambiente.estado.envios.length + ambiente.estado.fluxo2.length, 0, podeResponder.modo);
    }
  });

  test('humano_comercial: a mensagem vai para o handoff aberto e ninguém responde', async () => {
    const ambiente = criarAmbiente({ podeResponder: { ok: true, modo: 'humano_comercial', agente_modo: 'producao', agente_encerrado_motivo: 'reuniao' } });
    const execucao = await rodar(ambiente, corpo({ texto: 'e aí, conseguiu ver o horário?' }));
    const chamada = ambiente.estado.fluxo2[0];
    assert.equal(chamada.no, NOS.acrescentarHandoff);
    assert.deepEqual([chamada.entrada.motivo, chamada.entrada.dados._fluxo3.acrescentar_ao_aberto, chamada.entrada.enviar_texto], ['reuniao', true, false]);
    assert.ok(!execucao.rodou(NOS.agente));
    assert.equal(ambiente.estado.envios.length, 0);
  });

  test('resposta depois da transferência com reuniao passa com o handoff_id desta execução', async () => {
    const ambiente = criarAmbiente({
      agente: () => ({
        output: 'Combinado! Vou conferir a agenda da Edilaine com a equipe, e a resposta vem por aqui 😊',
        intermediateSteps: [
          { action: { tool: 'transferir_para_equipe', toolInput: { motivo: 'reuniao' } }, observation: '[{"ok":true,"handoff_id":"h-77","instrucao_chave":"instrucao_reuniao"}]' },
        ],
      }),
      podeEnviar: (tipo, handoffId) => ({ pode: handoffId === 'h-77' }),
    });
    await rodar(ambiente, corpo({ texto: 'Quinta ou sexta às 10h' }));
    assert.deepEqual(ambiente.chamadas('pode_enviar')[0].argumentos, [CONVERSA, 'resposta', 'h-77']);
    assert.equal(ambiente.enviosDe(NOS.enviarTexto).length, 1);
  });

  test('humano_nominal sem alerta: estado_sensivel_escreveu e nenhuma resposta', async () => {
    const ambiente = criarAmbiente({ podeResponder: { ok: true, modo: 'humano_nominal', agente_modo: 'producao' } });
    await rodar(ambiente, corpo({ texto: 'oi' }));
    assert.deepEqual(ambiente.estado.fluxo2.map((c) => [c.no, c.entrada.motivo]), [[NOS.avisarEstadoSensivel, 'estado_sensivel_escreveu']]);
    assert.equal(ambiente.estado.envios.length, 0);
  });

  test('áudio transcrito entra no agrupamento e é respondido; a transcrição é gravada', async () => {
    const ambiente = criarAmbiente({ transcricao: 'queria saber como funciona' });
    const execucao = await rodar(ambiente, corpo({ texto: '', tipo: 'AudioMessage', mediaType: 'ptt' }));
    assert.deepEqual(ambiente.chamadas('registrar_transcricao')[0].argumentos, ['msg-1', 'queria saber como funciona']);
    assert.equal(ambiente.estado.agente[0].entrada, 'queria saber como funciona');
    assert.ok(execucao.rodou(NOS.enviarTexto));
  });

  test('áudio com a transcrição falhando: audio_nao_transcrito (sem pode_enviar) e o texto audio_nao_transcrito', async () => {
    const ambiente = criarAmbiente({ falhas: ['transcricao'] });
    const execucao = await rodar(ambiente, corpo({ texto: '', tipo: 'AudioMessage', mediaType: 'ptt' }));
    assert.deepEqual(ambiente.estado.fluxo2.map((c) => c.entrada.motivo), ['audio_nao_transcrito']);
    assert.deepEqual(ambiente.enviosDe(NOS.enviarTextoAudio).map((e) => e.text), ['[texto audio_nao_transcrito]']);
    assert.equal(ambiente.chamadas('pode_enviar').length, 0);
    assert.ok(!execucao.rodou(NOS.midiaRecebida));
    assert.ok(!execucao.rodou(NOS.agente));
  });

  test('áudio "estou com muito sangramento", transcrição certa e registrar_transcricao falhando: fluxo 2 com alerta_saude', async () => {
    const ambiente = criarAmbiente({
      transcricao: 'estou com muito sangramento',
      falhas: ['registrar_transcricao'],
      termos: [['sangramento', 'handoff_saude']],
    });
    await rodar(ambiente, corpo({ texto: '', tipo: 'AudioMessage', mediaType: 'ptt' }));
    assert.deepEqual(ambiente.estado.fluxo2.map((c) => [c.entrada.acao, c.entrada.texto_familia]), [['alerta_saude', 'estou com muito sangramento']]);
  });

  test('foto sem legenda: midia_recebida e o texto midia_recebida com o handoff_id no pode_enviar; agente não roda', async () => {
    const ambiente = criarAmbiente();
    const execucao = await rodar(ambiente, corpo({ texto: '', tipo: 'ImageMessage', mediaType: 'image' }));
    assert.deepEqual(ambiente.estado.fluxo2.map((c) => c.entrada.motivo), ['midia_recebida']);
    assert.deepEqual(ambiente.chamadas('pode_enviar')[0].argumentos, [CONVERSA, 'resposta', 'handoff-1']);
    assert.deepEqual(ambiente.enviosDe(NOS.enviarTextoSistema).map((e) => e.text), ['[texto midia_recebida]']);
    assert.ok(!execucao.rodou(NOS.agente));
  });

  test('foto com legenda neutra: midia_recebida aberto e o agente responde à legenda com a linha do config', async () => {
    const ambiente = criarAmbiente({ agente: () => ({ output: 'Recebi, obrigada. Alguém da equipe vai olhar a imagem e te responde por aqui.' }) });
    await rodar(ambiente, corpo({ texto: 'o que vocês acham?', tipo: 'ImageMessage', mediaType: 'image' }));
    assert.deepEqual(ambiente.estado.fluxo2.map((c) => c.entrada.motivo), ['midia_recebida']);
    assert.equal(ambiente.estado.agente[0].entrada, '[a família enviou uma foto com a legenda: o que vocês acham?; a equipe já foi avisada]');
    assert.equal(ambiente.chamadas('pode_enviar')[0].argumentos[2], 'handoff-1');
    assert.equal(ambiente.enviosDe(NOS.enviarTexto).length, 1);
  });

  test('foto com legenda "o umbigo está com pus": caminho de saúde, não de mídia', async () => {
    const ambiente = criarAmbiente({ classificacao: { ...CLASSIFICACAO_URGENCIA, saude: 'relato_sintoma' } });
    const execucao = await rodar(ambiente, corpo({ texto: 'o umbigo está com pus', tipo: 'ImageMessage', mediaType: 'image' }));
    assert.deepEqual(ambiente.estado.fluxo2.map((c) => [c.no, c.entrada.acao]), [[NOS.caminhoDeAlerta, 'alerta_saude']]);
    assert.ok(!execucao.rodou(NOS.midiaRecebida));
  });

  test('candidata no início: marca não lead e envia o encaminhamento do banco depois do pode_enviar', async () => {
    const ambiente = criarAmbiente({
      classificacaoConversa: null,
      classificacao: { tipo_contato: 'candidata', saude: 'nenhum', perda: false, perda_temporalidade: 'nenhuma', internacao: false, saude_mental: false },
    });
    const execucao = await rodar(ambiente, corpo({ texto: 'Queria mandar meu currículo' }));
    assert.deepEqual(ambiente.chamadas('marcar_nao_lead')[0].argumentos, [CONVERSA, 'candidata']);
    assert.deepEqual(ambiente.enviosDe(NOS.enviarTextoSistema).map((e) => e.text), ['[encaminhamento candidata]']);
    assert.ok(execucao.ordem.indexOf(NOS.podeEnviarSistema) < execucao.ordem.indexOf(NOS.enviarTextoSistema));
    assert.ok(!execucao.rodou(NOS.agente));
  });

  test('pode_enviar recusado: nada sai', async () => {
    const ambiente = criarAmbiente({ podeEnviar: () => ({ pode: false, motivo: 'bloqueio_total' }) });
    await rodar(ambiente, corpo());
    assert.equal(ambiente.estado.envios.length, 0);
    assert.equal(ambiente.chamadas('sincronizar_memoria').length, 0);
  });

  test('resposta com valor fora da tabela: reescrita aprovada sai no lugar', async () => {
    const ambiente = criarAmbiente({
      agente: () => ({ output: 'O Essencial é R$ 3.900.' }),
      reescrita: { texto: 'Os valores estão na apresentação.\n\n[ENVIAR_APRESENTACAO]', transferir: null },
    });
    await rodar(ambiente, corpo({ texto: 'quanto custa?' }));
    assert.ok(ambiente.estado.openai.some((c) => c.tipo === 'reescrita' && c.corpo.messages[0].content.includes('R$ 3.900')));
    assert.deepEqual(ambiente.estado.envios.map((e) => e.no), [NOS.enviarTexto, NOS.enviarApresentacao]);
  });

  test('reescrita que tira desconto abre condicao_comercial antes do envio', async () => {
    const ambiente = criarAmbiente({
      agente: () => ({ output: 'No Pix tem 10% de desconto.' }),
      reescrita: { texto: 'Essa condição quem confirma é o Leonardo, tá? Vou pedir para ele falar com você por aqui.', transferir: 'condicao_comercial' },
    });
    const execucao = await rodar(ambiente, corpo({ texto: 'tem desconto no pix?' }));
    assert.deepEqual(ambiente.estado.fluxo2.map((c) => [c.no, c.entrada.motivo]), [[NOS.transferirPelaReescrita, 'condicao_comercial']]);
    assert.ok(execucao.ordem.indexOf(NOS.transferirPelaReescrita) < execucao.ordem.indexOf(NOS.enviarTexto));
    assert.equal(ambiente.chamadas('pode_enviar')[0].argumentos[2], 'handoff-1');
  });

  test('violação que persiste: fallback_confirmar e fluxo 2 com validacao_resposta', async () => {
    const ambiente = criarAmbiente({ agente: () => ({ output: 'Garantimos a sua vaga.' }), reescrita: { texto: 'Garantimos sim.', transferir: null } });
    await rodar(ambiente, corpo({ texto: 'tem vaga?' }));
    assert.deepEqual(ambiente.estado.fluxo2.map((c) => c.entrada.motivo), ['validacao_resposta']);
    assert.deepEqual(ambiente.enviosDe(NOS.enviarTexto).map((e) => e.text), ['[texto fallback_confirmar]']);
  });

  test('agrupamento: a execução mais antiga para; a última responde com as duas mensagens', async () => {
    const config = await configExemplo();
    const chave = `${config.redis.prefixo}buf:${CONVERSA}`;
    const posterior = { 'msg-2': JSON.stringify({ id: 'msg-2', texto: 'sou a Marina', carimbo: 2000 }) };
    const antiga = criarAmbiente({ redisInicial: { [chave]: posterior } });
    const execucaoAntiga = await rodar(antiga, corpo({ texto: 'oi', id: 'msg-1', timestamp: 1000 }));
    assert.ok(!execucaoAntiga.rodou(NOS.podeResponder));

    const ultima = criarAmbiente({ redisInicial: { [chave]: { 'msg-1': JSON.stringify({ id: 'msg-1', texto: 'oi', carimbo: 1000 }) } } });
    await rodar(ultima, corpo({ texto: 'sou a Marina', id: 'msg-2', timestamp: 2000 }));
    assert.equal(ultima.estado.agente[0].entrada, 'oi sou a Marina');
    assert.equal(ultima.estado.redis.has(chave), false, 'buffer apagado depois de agrupar');
    assert.equal(ultima.estado.ttl, config.redis.ttlAgrupamentoSegundos);
  });

  test('Redis fora do ar segue sem agrupar e responde', async () => {
    const ambiente = criarAmbiente({ falhas: ['redis'] });
    const execucao = await rodar(ambiente, corpo());
    assert.ok(execucao.rodou(NOS.agente));
    assert.equal(ambiente.enviosDe(NOS.enviarTexto).length, 1);
  });

  test('eco do agente é ignorado; mensagem da equipe pausa, grava no Redis e vai para a memória', async () => {
    const eco = criarAmbiente();
    const execucaoEco = await rodar(eco, corpo({ fromMe: true, wasSentByApi: true, trackSource: 'kraamzorg-agente' }));
    assert.ok(!execucaoEco.rodou(NOS.registrarMsgHumana));
    assert.equal(eco.estado.banco.length, 0);

    const humana = criarAmbiente();
    await rodar(humana, corpo({ fromMe: true, texto: 'Oi Ana, aqui é o Leonardo' }));
    assert.deepEqual(humana.chamadas('registrar_mensagem')[0].argumentos.slice(0, 3), [JID, 'saida', 'humano']);
    assert.deepEqual(humana.chamadas('pausar')[0].argumentos, [CONVERSA, null, 'humano_digitou']);
    assert.deepEqual(humana.chamadas('sincronizar_memoria')[0].argumentos, [CONVERSA, 'equipe', 'Oi Ana, aqui é o Leonardo']);
    assert.equal(humana.estado.redis.get(`kz:pausa:${CONVERSA}`), 'humano_digitou');
  });

  test('registrar_mensagem recebe nome do WhatsApp, telefone, LID e nome salvo (Apêndice A, 19.4 nó 10)', async () => {
    const familia = criarAmbiente();
    await rodar(familia, corpo({ texto: 'oi', chatlid: '000000000000009@lid' }));
    const entrada = familia.chamadas('registrar_mensagem')[0].argumentos;
    assert.deepEqual(entrada.slice(0, 3), [JID, 'entrada', 'cliente']);
    assert.equal(entrada[6], 'Ana', 'nome_whatsapp');
    assert.match(entrada[7], /^\+\d+$/, 'telefone');
    assert.equal(entrada[8], '000000000000009@lid', 'lid');
    assert.equal(entrada[9], 'Ana paciente potencial', 'nome_contato');

    const humana = criarAmbiente();
    await rodar(humana, corpo({ fromMe: true, texto: 'Oi Ana', chatlid: '000000000000009@lid' }));
    const saida = humana.chamadas('registrar_mensagem')[0].argumentos;
    assert.equal(saida[6], null, 'senderName da mensagem da equipe é o da Kraamzorg, não vai como nome da família');
    assert.equal(saida[8], '000000000000009@lid');
    assert.equal(saida[9], 'Ana paciente potencial');

    const semLid = criarAmbiente();
    await rodar(semLid, corpo({ texto: 'oi' }));
    assert.equal(semLid.chamadas('registrar_mensagem')[0].argumentos[8], null, 'sem LID vai nulo, nunca texto vazio');

    // N8N-01: evento fromMe sem chatlid, só com o LID do número da Kraamzorg
    const doDono = corpo({ fromMe: true, texto: 'Oi Ana' });
    doDono.message.sender_lid = '999000000000001@lid';
    const humanaSemChatlid = criarAmbiente();
    await rodar(humanaSemChatlid, doDono);
    assert.equal(
      humanaSemChatlid.chamadas('registrar_mensagem')[0].argumentos[8],
      null,
      'mensagem da equipe nunca manda o LID do dono como LID da família',
    );
  });

  test('grupo e instância diferente são ignorados', async () => {
    const grupo = criarAmbiente();
    await rodar(grupo, corpo({ chatid: '000000000000-0000000001@g.us', isGroup: true }));
    assert.equal(grupo.estado.banco.length, 0);
    const outra = criarAmbiente();
    await rodar(outra, { ...corpo(), instanceName: 'outra-instancia' });
    assert.equal(outra.estado.banco.length, 0);
  });

  test('toda chamada ao banco usa o conversa_id do registro; o jid só vai para registrar_mensagem', async () => {
    const ambiente = criarAmbiente({ agente: () => ({ output: 'O Essencial é R$ 4.200.' }) });
    await rodar(ambiente, corpo({ texto: 'quanto é?' }));
    for (const chamada of ambiente.estado.banco) {
      if (chamada.funcao === 'registrar_mensagem') assert.equal(chamada.argumentos[0], JID);
      else if (chamada.funcao === 'checar_termos_alerta') assert.equal(chamada.argumentos[0], 'quanto é?');
      else assert.equal(chamada.argumentos[0], CONVERSA, chamada.funcao);
    }
    for (const envio of ambiente.estado.envios) assert.equal(envio.number, JID);
  });

  test('duas conversas: as ferramentas resolvem o conversa_id de cada execução, nunca do modelo', async () => {
    const { fluxo3 } = await fluxos();
    const execucoes = [];
    for (const [jid, conversa] of [['000000000001@s.whatsapp.net', 'conversa-a'], ['000000000002@s.whatsapp.net', 'conversa-b']]) {
      const ambiente = criarAmbiente({ conversaPorJid: { [jid]: conversa } });
      const execucao = await rodar(ambiente, corpo({ chatid: jid }));
      execucoes.push({ execucao, jid, conversa });
    }
    const fromAiMalicioso = (chave) => (chave === 'conversa_id' ? 'conversa-de-outra-familia' : `valor-${chave}`);
    for (const { execucao, jid, conversa } of execucoes) {
      const escopo = escopoDeFerramenta(execucao.contexto, fromAiMalicioso);
      for (const nome of Object.values(FERRAMENTAS)) {
        const no = fluxo3.nodes.find((n) => n.name === nome);
        if (no.type === 'n8n-nodes-base.postgresTool' && no.parameters.options.queryReplacement) {
          const lista = avaliarParametro(no.parameters.options.queryReplacement, escopo);
          const funcao = /agente\.(\w+)\(/.exec(no.parameters.query)[1];
          if (['atualizar_lead', 'registrar_marco'].includes(funcao)) assert.equal(lista[0], conversa, nome);
          assert.ok(!lista.includes('conversa-de-outra-familia'), nome);
        }
        if (no.type === '@n8n/n8n-nodes-langchain.toolWorkflow') {
          const valores = avaliarParametro(no.parameters.workflowInputs.value, escopo);
          assert.deepEqual([valores.conversa_id, valores.wa_jid], [conversa, jid], nome);
        }
      }
      const memoria = fluxo3.nodes.find((n) => n.name === NOS.memoria);
      assert.equal(avaliarParametro(memoria.parameters.sessionKey, escopo), conversa);
    }
  });

  test('integração com o fluxo 2 gerado: teste fora da lista não manda texto de alerta; vendas manda', async () => {
    const { fluxo2 } = await fluxos();
    const rodarComFluxo2 = async (podeResponder) => {
      const envios2 = [];
      const bancoFluxo2 = {
        mensagem_alerta: (c, acao, chave) => ({ ok: true, chave, texto: `[texto ${chave}]` }),
        registrar_mensagem: () => ({ ok: true }),
        registrar_handoff: () => ({ ok: true, handoff_id: 'h-int', duplicado: false, mensagem_grupo: '[grupo]', grupo_jid: '000000000000-0000000001@g.us', plantao: [], instrucao_agente: '[instr]', pausa_horas: 48 }),
        registrar_notificacao_handoff: () => ({ ok: true }),
      };
      const servicos2 = {};
      for (const no of fluxo2.nodes) {
        if (no.type === 'n8n-nodes-base.postgres') {
          servicos2[no.name] = (p) => [{ resultado: bancoFluxo2[/agente\.(\w+)\(/.exec(p.query)[1]](...p.options.queryReplacement) }];
        } else if (no.type === 'n8n-nodes-base.httpRequest') {
          servicos2[no.name] = (p) => {
            envios2.push({ no: no.name, ...p.jsonBody });
            return { messageid: 'x' };
          };
        } else if (no.type === 'n8n-nodes-base.redis') servicos2[no.name] = () => null;
      }
      const ambiente = criarAmbiente({
        podeResponder,
        termos: [['sangramento', 'handoff_saude']],
        executarFluxo2: (entrada) => simularFluxo(fluxo2, { entrada, servicos: servicos2 }).saida[0],
      });
      await rodar(ambiente, corpo({ texto: 'estou com sangramento' }));
      return envios2;
    };
    const teste = await rodarComFluxo2({ ok: true, modo: 'vendas', agente_modo: 'teste', na_whitelist: false });
    assert.equal(teste.filter((e) => e.no === NOS2.enviarTextoAlerta).length, 0);
    assert.equal(teste.filter((e) => e.no === NOS2.notificarGrupo).length, 1);
    const vendas = await rodarComFluxo2({ ok: true, modo: 'vendas', agente_modo: 'producao' });
    assert.deepEqual(vendas.filter((e) => e.no === NOS2.enviarTextoAlerta).map((e) => [e.number, e.text]), [[JID, '[texto alerta_saude]']]);
  });
});

describe('fluxo 3 · entrada B (follow-up) no simulador', () => {
  const agendado = async (ambiente) => {
    const { fluxo3 } = await fluxos();
    return simularFluxo(fluxo3, { gatilho: NOS.aCada30Min, entrada: {}, servicos: ambiente.montarServicos(fluxo3) });
  };
  const followups = (itens) => ({
    ok: true,
    itens,
    validador: { listas: LISTAS },
    enviados_hoje: ['Oi! Vi que você entrou em contato com a Kraamzorg Brasil. Me conta de quantas semanas você está.'],
    limite_similaridade: 0.8,
  });
  const item = (i) => ({ execucao_id: `e${i}`, conversa_id: `c${i}`, wa_jid: `00000000000${i}@s.whatsapp.net`, nome: 'Ana', texto_base: '[base]', tempo_sem_resposta: 'mais de 2 dias', ultimas_mensagens: [] });

  test('follow-up aprovado: pode_enviar conteudo, envio, registrar_followup ok e memória', async () => {
    const ambiente = criarAmbiente({ followups: followups([item(1)]), followup: { texto: 'Oi, Ana! Conseguiu ver a apresentação com calma?' } });
    await agendado(ambiente);
    assert.deepEqual(ambiente.chamadas('pode_enviar')[0].argumentos, ['c1', 'conteudo', null]);
    assert.deepEqual(ambiente.enviosDe(NOS.enviarFollowup).map((e) => [e.number, e.track_source]), [['000000000001@s.whatsapp.net', 'kraamzorg-agente']]);
    assert.deepEqual(ambiente.chamadas('registrar_followup')[0].argumentos, ['e1', 'Oi, Ana! Conseguiu ver a apresentação com calma?', true]);
    assert.deepEqual(ambiente.chamadas('sincronizar_memoria')[0].argumentos.slice(0, 2), ['c1', 'followup']);
    assert.ok(ambiente.estado.openai[0].corpo.messages[0].content.includes('mais de 2 dias'));
  });

  test('[SILENCIO], valor, repetição do dia ou pode_enviar recusado: nada sai e a execução fecha com ok falso', async () => {
    for (const [followup, podeEnviar] of [
      [{ texto: '[SILENCIO]' }, undefined],
      [{ texto: 'Oi! O Essencial é R$ 4.200.' }, undefined],
      [{ texto: 'Oi! Vi que você entrou em contato com a Kraamzorg Brasil. Me conta de quantas semanas você está.' }, undefined],
      [{ texto: 'Oi, Ana! Tudo certo por aí?' }, () => ({ pode: false })],
      ['não é json', undefined],
    ]) {
      const ambiente = criarAmbiente({ followups: followups([item(1)]), followup, podeEnviar });
      await agendado(ambiente);
      assert.equal(ambiente.estado.envios.length, 0, JSON.stringify(followup));
      assert.deepEqual(ambiente.chamadas('registrar_followup')[0].argumentos, ['e1', null, false], JSON.stringify(followup));
      assert.equal(ambiente.chamadas('sincronizar_memoria').length, 0);
    }
  });

  test('vários follow-ups na mesma rodada, cada um com a sua conversa', async () => {
    const ambiente = criarAmbiente({ followups: followups([item(1), item(2)]), followup: { texto: 'Oi, Ana! Como está a gestação?' } });
    await agendado(ambiente);
    assert.deepEqual(ambiente.chamadas('registrar_followup').map((c) => c.argumentos[0]).sort(), ['e1', 'e2']);
    assert.deepEqual(ambiente.enviosDe(NOS.enviarFollowup).map((e) => e.number).sort(), ['000000000001@s.whatsapp.net', '000000000002@s.whatsapp.net']);
  });
});

// ---------------------------------------------------------------------------
// 3. Estrutura do JSON gerado
// ---------------------------------------------------------------------------

describe('fluxo 3 · estrutura do JSON gerado', () => {
  const predecessores = (fluxo, nome) => {
    const lista = [];
    for (const [origem, porTipo] of Object.entries(fluxo.connections)) {
      (porTipo.main ?? []).forEach((saida, indice) => {
        for (const destino of saida ?? []) if (destino.node === nome) lista.push({ origem, saida: indice });
      });
    }
    return lista;
  };

  test('tem os nós do 19.4 com os nomes do PRD, id na raiz e as configurações do 19.1', async () => {
    const { fluxo3 } = await fluxos();
    const nomes = new Set(fluxo3.nodes.map((no) => no.name));
    for (const nome of [
      'Webhook UAZAPI', 'Validar Origem', 'Extrair Dados', 'É Grupo?', 'Filtro FromMe', 'Eco do Agente?', 'Registrar Msg Humana',
      'Pausar por Humano', 'Memória: Fala da Equipe', 'Registrar Msg Família', 'Tipo de Mensagem', 'Transcrever Áudio',
      'Registrar Transcrição', 'Agrupar Mensagens', 'Pode Responder?', 'Parar Aqui?', 'Checar Termos de Alerta',
      'Classificar Mensagem', 'Ler Classificação', 'Caminho de Alerta', 'Decidir Modo', 'Não Lead no Início?',
      'Resposta Não Lead', 'Mídia Recebida', 'Montar Contexto do Agente', 'Agente Isadora', 'Modelo de Conversa',
      'Memória Postgres', 'IA Decidiu Responder?', 'Validar Resposta', 'Reescrever', 'Preparar Envio',
      'Reconsultar Antes de Enviar', 'Loop de Envio', 'Enviar Texto', 'Enviar Apresentação', 'Registrar Envio',
      'A Cada 30 Min', 'Buscar Follow-ups Devidos', 'Gerar Mensagem', 'Validar', 'Reconsultar e Enviar', 'Registrar Follow-up',
      ...Object.values(FERRAMENTAS),
    ]) {
      assert.ok(nomes.has(nome), `falta o nó "${nome}"`);
    }
    assert.equal(typeof fluxo3.id, 'string');
    assert.deepEqual(fluxo3.settings, {
      executionOrder: 'v1',
      callerPolicy: 'workflowsFromSameOwner',
      timezone: 'America/Sao_Paulo',
      saveDataSuccessExecution: 'none',
      saveDataErrorExecution: 'all',
    });
  });

  test('passa por todos os verificadores estruturais do 19.5, e todo nó Code compila', async () => {
    const { fluxo3 } = await fluxos();
    const resultado = executarTodosOsValidadoresEstruturais(fluxo3);
    assert.ok(resultado.ok, resultado.problemas.join(' | '));
    assert.ok(codeCompila(fluxo3).ok);
  });

  test('ordem de segurança: nada chega ao Decidir Modo, à mídia, ao não lead ou ao agente sem passar pelo filtro e pelo classificador', async () => {
    const { fluxo3 } = await fluxos();
    const alvos = [NOS.decidirModo, NOS.temMidia, NOS.midiaRecebida, NOS.naoLeadNoInicio, NOS.audioNaoTranscrito, NOS.agente, NOS.enviarTexto];
    for (const portao of [NOS.checarTermos, NOS.classificarMensagem, NOS.lerClassificacao, NOS.temAlerta]) {
      const resultado = todoCaminhoPassaPor(fluxo3, { inicios: [NOS.webhook], alvos, portao });
      assert.ok(resultado.ok, resultado.problemas.join(' | '));
    }
  });

  test('nenhuma conexão liga o ramo de alerta ativo (nó 20) ao nó 26, ao Decidir Modo ou a envio à família', async () => {
    const { fluxo3 } = await fluxos();
    const proibidos = [NOS.agente, NOS.decidirModo, NOS.enviarTexto, NOS.enviarApresentacao, NOS.enviarTextoSistema, NOS.enviarTextoAudio, NOS.midiaRecebida];
    for (const origem of [NOS.prepararAlerta, NOS.caminhoDeAlerta]) {
      const resultado = nenhumCaminhoEntre(fluxo3, { origem, proibidos });
      assert.ok(resultado.ok, resultado.problemas.join(' | '));
    }
    assert.deepEqual(fluxo3.connections[NOS.temAlerta].main[0], [{ node: NOS.prepararAlerta, type: 'main', index: 0 }]);
    assert.deepEqual(predecessores(fluxo3, NOS.decidirModo), [{ origem: NOS.audioNaoTranscrito, saida: 1 }]);
    assert.deepEqual(predecessores(fluxo3, NOS.audioNaoTranscrito), [{ origem: NOS.temAlerta, saida: 1 }]);
  });

  test('o nó 16 não para teste fora da lista antes do nó 17: a saída falsa vai ao filtro e a verdadeira não liga a nada', async () => {
    const { fluxo3 } = await fluxos();
    const saidas = fluxo3.connections[NOS.pararAqui].main;
    assert.deepEqual(saidas[0] ?? [], []);
    assert.deepEqual(saidas[1], [{ node: NOS.checarTermos, type: 'main', index: 0 }]);
    const condicao = fluxo3.nodes.find((no) => no.name === NOS.pararAqui).parameters.conditions.conditions[0].leftValue;
    assert.equal(condicao, '={{ $json.parar === true }}');
    const teste = lerPodeResponder({}, { resultado: { ok: true, modo: 'vendas', agente_modo: 'teste', na_whitelist: false } });
    assert.equal(teste.parar, false);
  });

  test('pode_enviar antes de toda resposta ou follow-up à família; o texto de áudio e o alerta não passam por ele', async () => {
    const { fluxo3 } = await fluxos();
    const podeEnviar = fluxo3.nodes
      .filter((no) => no.type === 'n8n-nodes-base.postgres' && /agente\.pode_enviar\(/.test(no.parameters.query))
      .map((no) => no.name);
    assert.deepEqual(podeEnviar.sort(), [NOS.podeEnviarSistema, NOS.reconsultar, NOS.reconsultarEEnviar].sort());
    const semPodeEnviar = alcancaveis(fluxo3, [NOS.webhook, NOS.aCada30Min], new Set(podeEnviar));
    for (const envio of [NOS.enviarTexto, NOS.enviarApresentacao, NOS.enviarTextoSistema, NOS.enviarFollowup]) {
      assert.ok(!semPodeEnviar.has(envio), `"${envio}" alcançável sem pode_enviar`);
    }
    assert.ok(semPodeEnviar.has(NOS.enviarTextoAudio), 'o texto de áudio sai nos modos do alerta, sem pode_enviar');
    const tipos = Object.fromEntries(
      fluxo3.nodes.filter((no) => podeEnviar.includes(no.name)).map((no) => [no.name, no.parameters.options.queryReplacement]),
    );
    assert.ok(tipos[NOS.reconsultar].includes("'resposta'") && tipos[NOS.reconsultar].includes('handoff_id_execucao'));
    assert.ok(tipos[NOS.reconsultarEEnviar].includes("'conteudo'"));
  });

  test('a chave de toda chamada ao banco é o conversa_id do "Registrar Msg Família" (ou "Humana"); entrada B usa o de followups_devidos', async () => {
    const { fluxo3 } = await fluxos();
    const entradaB = alcancaveis(fluxo3, NOS.aCada30Min);
    const resultado = conversaIdSoDoRegistro(fluxo3, {
      expressoesPermitidas: [EXPR_CONVERSA, EXPR_CONVERSA_HUMANA],
      nosIgnorados: entradaB,
    });
    assert.ok(resultado.ok, resultado.problemas.join(' | '));
    const resultadoB = conversaIdSoDoRegistro(
      { ...fluxo3, nodes: fluxo3.nodes.filter((no) => entradaB.has(no.name)) },
      { expressoesPermitidas: ['$json.conversa_id', `$(${JSON.stringify(NOS.fecharFollowup)}).item.json.conversa_id`] },
    );
    assert.ok(resultadoB.ok, resultadoB.problemas.join(' | '));
    for (const no of fluxo3.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow')) {
      assert.equal(no.parameters.workflowInputs.value.conversa_id, `={{ ${EXPR_CONVERSA} }}`, no.name);
      assert.equal(no.parameters.workflowInputs.value.wa_jid, `={{ ${EXPR_JID} }}`, no.name);
    }
  });

  test('entradas A e B não se cruzam', async () => {
    const { fluxo3 } = await fluxos();
    const b = alcancaveis(fluxo3, NOS.aCada30Min);
    const a = alcancaveis(fluxo3, NOS.webhook);
    for (const nome of b) assert.ok(!a.has(nome), nome);
  });

  test('as nove ferramentas da 11.9: conversa_id fixo por expressão, só campos de conteúdo por $fromAI', async () => {
    const config = await configExemplo();
    const { fluxo3 } = await fluxos();
    const conteudo = {
      verificar_cobertura: ['cidade', 'bairro', 'uf'],
      verificar_disponibilidade: ['dpp', 'cidade'],
      atualizar_ficha: ['dados'],
      registrar_retorno: ['quando'],
      transferir_para_equipe: ['motivo', 'resumo', 'solicitacao', 'dados'],
      acionar_equipe_saude: ['tipo', 'resumo'],
    };
    const conexoesAgente = [];
    for (const [origem, porTipo] of Object.entries(fluxo3.connections)) {
      for (const destino of porTipo.ai_tool?.[0] ?? []) if (destino.node === NOS.agente) conexoesAgente.push(origem);
    }
    assert.deepEqual(conexoesAgente.sort(), Object.values(FERRAMENTAS).sort());
    for (const nome of Object.values(FERRAMENTAS)) {
      const no = fluxo3.nodes.find((n) => n.name === nome);
      const texto = JSON.stringify(no.parameters);
      const chaves = [...texto.matchAll(/\$fromAI\('([a-z_]+)'/g)].map((m) => m[1]);
      assert.deepEqual([...new Set(chaves)].sort(), [...(conteudo[nome] ?? [])].sort(), nome);
      if (no.type === '@n8n/n8n-nodes-langchain.toolWorkflow') {
        assert.equal(no.parameters.workflowId.value, config.fluxo.idFluxo2);
        assert.equal(no.parameters.workflowInputs.value.conversa_id, `={{ ${EXPR_CONVERSA} }}`);
        assert.equal(no.parameters.workflowInputs.value.wa_jid, `={{ ${EXPR_JID} }}`);
        assert.equal(no.parameters.workflowInputs.value.origem_chamada, 'agente');
      }
    }
    const saude = fluxo3.nodes.find((n) => n.name === FERRAMENTAS.acionarEquipeSaude).parameters.workflowInputs.value;
    assert.deepEqual([saude.enviar_texto, saude.acao], [true, 'alerta_saude']);
    const transferir = fluxo3.nodes.find((n) => n.name === FERRAMENTAS.transferirParaEquipe).parameters.workflowInputs.value;
    assert.equal(transferir.enviar_texto, false);
    for (const nome of [FERRAMENTAS.atualizarFicha, FERRAMENTAS.registrarRetorno, FERRAMENTAS.marcarNaoContatar]) {
      const lista = fluxo3.nodes.find((n) => n.name === nome).parameters.options.queryReplacement;
      assert.ok(lista.startsWith(`={{ [ ${EXPR_CONVERSA}`), nome);
    }
  });

  test('descrição de atualizar_ficha lista as chaves que agente.atualizar_lead aceita e diz que chave desconhecida é ignorada (ADR 0003, divergência 3)', async () => {
    const { fluxo3 } = await fluxos();
    const descricao = fluxo3.nodes.find((n) => n.name === FERRAMENTAS.atualizarFicha).parameters.toolDescription;
    // Mesma lista de `v_aceitas` em supabase/migrations/0013_agente_parte1.sql (agente.atualizar_lead).
    const chaves = [
      'nome', 'para_quem', 'dpp', 'semanas', 'cidade', 'bairro', 'uf',
      'primeira_gestacao', 'primeiro_bebe', 'gemelar', 'gemeos', 'rede_apoio',
      'principal_preocupacao', 'parceiro_participa', 'plano_interesse', 'plano',
      'pagamento_preferido', 'pagamento', 'origem', 'historico_sensivel',
      'quer_contratar', 'sem_interesse',
    ];
    for (const chave of chaves) assert.ok(descricao.includes(chave), `descrição de atualizar_ficha sem a chave "${chave}"`);
    assert.match(descricao, /ignorad[ao]/i);
  });

  test('nada sai para a família (saúde/silêncio, faltou apresentação): sincronizar_memoria(descartado) é o destino das duas saídas falsas que hoje ficam sem conexão (ADR 0003, divergência 2)', async () => {
    const { fluxo3 } = await fluxos();
    const no = fluxo3.nodes.find((n) => n.name === NOS.memoriaDescartada);
    assert.ok(no, 'nó "Memória: Fala Descartada" não existe no fluxo 3');
    assert.match(no.parameters.query, /^select agente\.sincronizar_memoria\(\$1, \$2, \$3\)/);
    assert.equal(no.parameters.options.queryReplacement, `={{ [ ${EXPR_CONVERSA}, 'descartado', null ] }}`);
    assert.deepEqual(fluxo3.connections[NOS.modeloFalhou].main[1], [{ node: NOS.memoriaDescartada, type: 'main', index: 0 }]);
    assert.deepEqual(fluxo3.connections[NOS.faltouApresentacao].main[1], [{ node: NOS.memoriaDescartada, type: 'main', index: 0 }]);
  });

  test('memória Postgres com session_id = conversa_id e janela de 30; PGVector como ferramenta com topK 5', async () => {
    const { fluxo3 } = await fluxos();
    const memoria = fluxo3.nodes.find((n) => n.name === NOS.memoria);
    assert.deepEqual(memoria.parameters, { sessionIdType: 'customKey', sessionKey: `={{ ${EXPR_CONVERSA} }}`, tableName: 'chat_memoria', contextWindowLength: 30 });
    assert.deepEqual(fluxo3.connections[NOS.memoria].ai_memory, [[{ node: NOS.agente, type: 'ai_memory', index: 0 }]]);
    const base = fluxo3.nodes.find((n) => n.name === FERRAMENTAS.baseConhecimento);
    assert.deepEqual([base.parameters.mode, base.parameters.topK, base.parameters.tableName], ['retrieve-as-tool', 5, 'documentos']);
    assert.deepEqual(fluxo3.connections[NOS.embeddings].ai_embedding, [[{ node: FERRAMENTAS.baseConhecimento, type: 'ai_embedding', index: 0 }]]);
    const agente = fluxo3.nodes.find((n) => n.name === NOS.agente);
    assert.equal(agente.parameters.options.maxIterations, 10);
    assert.equal(agente.parameters.options.returnIntermediateSteps, true);
    assert.equal(agente.onError, 'continueRegularOutput');
  });

  test('modelo de conversa e temperatura do config; sem aceitaTemperatura, sem temperature', async () => {
    const config = structuredClone(await configExemplo());
    const semTemperatura = montarFluxo(config).nodes.find((n) => n.name === NOS.modeloConversa);
    assert.equal(config.modelos.conversa.aceitaTemperatura, false);
    assert.deepEqual(semTemperatura.parameters.options, { reasoningEffort: config.modelos.conversa.reasoningEffort });
    config.modelos.conversa.aceitaTemperatura = true;
    const comTemperatura = montarFluxo(config).nodes.find((n) => n.name === NOS.modeloConversa);
    assert.equal(comTemperatura.parameters.options.temperature, config.modelos.conversa.temperatura);
    const followup = montarFluxo(config).nodes.find((n) => n.name === NOS.gerarMensagem).parameters.jsonBody;
    assert.ok(followup.includes(`temperature: ${config.modelos.followup.temperatura}`));
  });

  test('prompts vêm de n8n/prompts entre as marcas, com as variáveis trocadas por expressão', async () => {
    const { fluxo3 } = await fluxos();
    const renderizar = (valor, json) =>
      avaliarParametro(valor, { $json: json, $: () => { throw new Error('sem referência a outro nó'); }, $input: {} });
    const arquivo = async (nome) => extrairPrompt(await readFile(path.join(AQUI, 'prompts', nome), 'utf8'));

    const classificador = fluxo3.nodes.find((n) => n.name === NOS.montarPromptMensagem).parameters.assignments.assignments[0].value;
    assert.equal(
      renderizar(classificador, { historico_texto: 'H', mensagem_texto: 'M', modo_classificador: 'vendas' }),
      (await arquivo('classificar-mensagem.md')).replace('{{historico}}', 'H').replace('{{mensagem}}', 'M').replace('{{modo}}', 'vendas'),
    );

    const sistema = fluxo3.nodes.find((n) => n.name === NOS.agente).parameters.options.systemMessage;
    const prompt = Object.fromEntries(VARIAVEIS_PROMPT_ISADORA.map((v) => [v, `<${v}>`]));
    let esperado = await arquivo('isadora-system.md');
    for (const variavel of VARIAVEIS_PROMPT_ISADORA) esperado = esperado.split(`{{${variavel}}}`).join(`<${variavel}>`);
    assert.equal(renderizar(sistema, { prompt }), esperado);
    assert.ok(!renderizar(sistema, { prompt }).includes('{{'));
    assert.deepEqual(Object.keys(VARIAVEIS_PROMPT_ISADORA_EXPR), VARIAVEIS_PROMPT_ISADORA);

    const reescrita = fluxo3.nodes.find((n) => n.name === NOS.montarPromptReescrita).parameters.assignments.assignments[0].value;
    assert.ok(renderizar(reescrita, { texto_para_reescrita: 'R', violacoes_texto: 'V', texto_agrupado: 'U' }).includes('Resposta barrada:\nR'));
    const followup = fluxo3.nodes.find((n) => n.name === NOS.montarPromptFollowup).parameters.assignments.assignments[0].value;
    assert.ok(renderizar(followup, { texto_base: 'B', nome: 'N', data_hora: 'D', ultimas_mensagens_texto: 'U', tempo_sem_resposta: 'T' }).includes('não responde há T.'));
  });

  test('nenhum texto para família ou equipe no fluxo, fora os prompts e os textos do config', async () => {
    const config = await configExemplo();
    const { fluxo3 } = await fluxos();
    const comPrompt = new Set([NOS.agente, NOS.montarPromptMensagem, NOS.montarPromptReescrita, NOS.montarPromptFollowup]);
    const comConfig = new Set([NOS.montarAvisoReserva, NOS.prepararIaForaDoAr, NOS.prepararEntradaAgente]);
    const texto = JSON.stringify(fluxo3.nodes.filter((no) => !comPrompt.has(no.name) && !comConfig.has(no.name)));
    for (const trecho of [
      'SAMU', 'Sinto muito', 'Recebi. Vou pedir', 'Não consegui ouvir', 'Essa informação eu vou confirmar',
      'currículo', 'NÃO REGISTRADO', 'responder a família', 'a equipe já foi avisada', 'contato@',
    ]) {
      assert.ok(!texto.includes(trecho), `texto "${trecho}" dentro do fluxo`);
    }
    const reserva = fluxo3.nodes.find((no) => no.name === NOS.montarAvisoReserva).parameters.jsCode;
    assert.ok(reserva.includes(JSON.stringify(config.grupoFallbackTexto)) && reserva.includes(JSON.stringify(config.grupoFallbackJid)));
  });

  test('envio simulado vai para a rota de captura sem credencial; envio real usa a credencial da UAZAPI', async () => {
    const config = structuredClone(await configExemplo());
    const urls = (fluxo) =>
      fluxo.nodes.filter((no) => no.type === 'n8n-nodes-base.httpRequest' && !no.parameters.url.includes('openai')).map((no) => [no.name, no.parameters.url, no.credentials]);
    for (const [nome, url, credenciais] of urls(montarFluxo(config))) {
      assert.ok(url.startsWith(config.homologacao.urlCaptura), nome);
      assert.equal(credenciais, undefined, nome);
    }
    config.homologacao.envioSimulado = false;
    config.homologacao.transcricaoSimulada = false;
    for (const [nome, url, credenciais] of urls(montarFluxo(config))) {
      assert.ok(url.startsWith(config.uazapi.urlBase), nome);
      assert.deepEqual(credenciais, { httpHeaderAuth: config.credenciais.uazapi }, nome);
    }
    config.homologacao.transcricaoSimulada = true;
    const transcrever = montarFluxo(config).nodes.find((no) => no.name === NOS.transcreverAudio);
    assert.equal(transcrever.parameters.url, `${config.homologacao.urlCaptura}/message/download`);
    assert.equal(montarFluxo(config).nodes.find((no) => no.name === NOS.enviarTexto).parameters.url, `${config.uazapi.urlBase}/send/text`);
  });

  test('o build recusa produção com envio ou transcrição simulada', async () => {
    const config = structuredClone(await configExemplo());
    assert.throws(() => conferirHomologacao(config, 'prod'), /produção/);
    config.homologacao.envioSimulado = false;
    assert.throws(() => conferirHomologacao(config, 'prod'), /produção/);
    config.homologacao.transcricaoSimulada = false;
    assert.doesNotThrow(() => conferirHomologacao(config, 'prod'));
    const exemplo = structuredClone(await configExemplo());
    assert.doesNotThrow(() => conferirHomologacao(exemplo, 'hml'));
  });

  test('ferramentas e sub-fluxos apontam para o id do fluxo 2 do config, que é o id do fluxo 2 gerado', async () => {
    const config = await configExemplo();
    const { fluxo2, fluxo3 } = await fluxos();
    assert.equal(fluxo2.id, config.fluxo.idFluxo2);
    const chamadas = fluxo3.nodes.filter((no) => ['n8n-nodes-base.executeWorkflow', '@n8n/n8n-nodes-langchain.toolWorkflow'].includes(no.type));
    assert.equal(chamadas.length, 11);
    for (const no of chamadas) {
      assert.equal(no.parameters.workflowId.value, config.fluxo.idFluxo2, no.name);
      assert.deepEqual(no.parameters.workflowInputs.schema.map((s) => s.id), fluxo2.nodes.find((n) => n.name === NOS2.quandoChamado).parameters.workflowInputs.values.map((v) => v.name));
    }
  });
});
