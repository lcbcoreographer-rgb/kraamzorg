// Testes do fluxo 2 "Pausar IA e Notificar Equipe" (PRD 19.3 v4.2, P24).
// Duas camadas:
// 1. As funções puras do "Pular Classificador?", do "Ler Classificação" e do
//    estado do fluxo, importadas direto de `n8n/src/code/`.
// 2. Os cenários do P24 v2 rodando o JSON gerado pelo build no simulador
//    (`src/lib/simulador.mjs`): os nós Code executam o código embutido de
//    verdade, e banco, OpenAI, UAZAPI e Redis são falsos em memória. O banco
//    falso imita o contrato de `agente.registrar_handoff` do Apêndice A
//    (deduplicação só comercial, alerta repetido com "ATUALIZAÇÃO"); o que
//    ele devolve é fixture de teste, nunca texto do fluxo.
//
// Roda junto com `node --test n8n/build.test.mjs` (importado no fim dele) ou
// sozinho: `node --test n8n/fluxo-2.test.mjs`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gerarFluxos } from './build.mjs';
import { carregarConfig } from './src/lib/config.mjs';
import { extrairPrompt } from './src/lib/prompts.mjs';
import { simularFluxo, avaliarParametro } from './src/lib/simulador.mjs';
import { executarTodosOsValidadoresEstruturais } from './src/lib/validadores.mjs';
import { NOS, ENTRADAS, montarFluxo } from './src/fluxo-2-pausar-notificar.mjs';

import {
  MOTIVOS_SEM_CLASSIFICADOR,
  MOTIVOS_COMERCIAIS,
  ORDEM_URGENCIA,
  prioridadeDoMotivo,
  nivelPrioridade,
  compararUrgencia,
} from './src/code/motivos-handoff.js';
import { pularClassificador } from './src/code/pular-classificador.js';
import { normalizarEntradaHandoff, converterDados, chaveTextoAlerta } from './src/code/normalizar-entrada-handoff.js';
import { lerClassificacaoPedido } from './src/code/ler-classificacao-pedido.js';
import {
  separarPedidoAtual,
  lerRegistroHandoff,
  montarAvisoReserva,
  consolidarNotificacao,
} from './src/code/estado-handoff.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

async function configExemplo() {
  const { config } = await carregarConfig('hml', AQUI, { log: () => {} });
  return config;
}

async function fluxo2() {
  return gerarFluxos(await configExemplo(), 'hml').fluxo2;
}

// ---------------------------------------------------------------------------
// Ambiente falso: banco, OpenAI, UAZAPI e Redis.
// ---------------------------------------------------------------------------

const DEZ_MINUTOS = 10 * 60 * 1000;
const MATRIZ_PRIORIDADE = {
  saude: 'maxima',
  perda: 'maxima',
  contratar: 'alta',
  reuniao: 'alta',
  pediu_humano: 'alta',
  bebe_nasceu: 'alta',
  reclamacao: 'alta',
  estado_sensivel_escreveu: 'alta',
  validacao_resposta: 'alta',
};
const NIVEL = { normal: 1, alta: 2, maxima: 3 };
const PLANTAO_FALSO = ['000000000091', '000000000092'];

function criarAmbiente(opcoes = {}) {
  const relogio = { agora: 0 };
  const falhas = new Set(opcoes.falhas ?? []);
  const ativacaoBanco = opcoes.ativacaoBanco ?? {};
  const estado = {
    handoffs: [],
    chamadasBanco: [],
    envios: [],
    chamadasOpenAi: [],
    redis: [],
    notificacoes: [],
  };
  let sequencia = 0;

  const funcoesBanco = {
    mensagem_alerta(conversaId, acao, chave) {
      let efetiva = acao === 'perda' ? 'perda' : chave;
      if (efetiva === 'alerta_internacao' && !ativacaoBanco.alerta_internacao_ativo) efetiva = 'alerta_saude';
      if (efetiva === 'alerta_emocional' && !ativacaoBanco.alerta_emocional_ativo) efetiva = 'alerta_saude';
      if (!['alerta_saude', 'alerta_internacao', 'alerta_emocional', 'alerta_saude_sensivel', 'perda'].includes(efetiva)) {
        efetiva = 'alerta_saude';
      }
      return { ok: true, chave: efetiva, texto: `[texto aprovado ${efetiva}]` };
    },
    registrar_mensagem(jid, direcao, enviadoPor, conteudo) {
      return { ok: true, conversa_id: 'conversa-resolvida', jid, direcao, enviado_por: enviadoPor, conteudo };
    },
    contexto_conversa() {
      return (
        opcoes.contexto ?? {
          ok: true,
          iniciada_por: 'familia',
          classificacao: 'lead',
          mensagens: [
            { de: 'familia', texto: 'Oi, queria saber dos planos', em: 't1' },
            { de: 'isadora', texto: 'Claro! Te mando a apresentação.', em: 't2' },
            { de: 'familia', texto: opcoes.pedidoAtual ?? 'quero fechar', em: 't3' },
          ],
        }
      );
    },
    marcar_nao_lead(conversaId, tipo) {
      return { ok: true, tipo, texto_encaminhamento: '[encaminhamento]', instrucao_agente: '[instrucao_nao_lead]' };
    },
    mensagem_sistema(conversaId, chave) {
      return { ok: true, texto: `[${chave}]` };
    },
    registrar_handoff(conversaId, motivo, resumo, solicitacao, dadosJson, origem, textoFamilia) {
      const dados = JSON.parse(dadosJson);
      const meta = dados._fluxo2;
      const comercial = !['saude', 'perda', 'estado_sensivel_escreveu'].includes(motivo);
      const existente = estado.handoffs.find(
        (h) =>
          h.conversa_id === conversaId &&
          h.motivo === motivo &&
          relogio.agora - h.em <= DEZ_MINUTOS &&
          (!comercial || h.solicitacao === solicitacao),
      );
      const matriz = MATRIZ_PRIORIDADE[motivo] ?? 'normal';
      const prioridade = NIVEL[meta.prioridade_minima] > NIVEL[matriz] ? meta.prioridade_minima : matriz;
      const humanoComercial = Boolean(opcoes.leadQualificado) && ['reuniao', 'contratar', 'condicao_comercial'].includes(motivo);
      const duplicado = Boolean(opcoes.forcarDuplicado) || (comercial && Boolean(existente));
      const atualizacao = !comercial && Boolean(existente);
      const handoffId = existente ? existente.id : `handoff-${++sequencia}`;
      if (!existente) {
        estado.handoffs.push({ id: handoffId, conversa_id: conversaId, motivo, solicitacao, em: relogio.agora });
      }
      estado.ultimoHandoff = { motivo, prioridade, dados, origem, texto_familia: textoFamilia, resumo };
      const enviada = meta.mensagem_enviada ?? 'nenhuma mensagem saiu, responder agora';
      const opcoesTexto = meta.manter_opcoes && dados.opcoes ? ` · opções: ${dados.opcoes}` : '';
      return {
        ok: true,
        handoff_id: handoffId,
        duplicado,
        atualizacao,
        mensagem_grupo: `${atualizacao ? 'ATUALIZAÇÃO · ' : ''}[grupo ${motivo} ${prioridade}] "${textoFamilia}" · família recebeu: "${enviada}"${opcoesTexto}`,
        grupo_jid: '000000000000-0000000001@g.us',
        plantao: prioridade === 'maxima' ? PLANTAO_FALSO : [],
        instrucao_agente: `[instrucao ${motivo}]`,
        pausa_horas: humanoComercial ? null : 48,
        humano_comercial: humanoComercial,
      };
    },
    registrar_notificacao_handoff(handoffId, ok, erro) {
      estado.notificacoes.push({ handoffId, ok, erro });
      return { ok: true };
    },
  };

  function postgres(parametros) {
    const funcao = /agente\.(\w+)\(/.exec(parametros.query)[1];
    const argumentos = parametros.options.queryReplacement;
    estado.chamadasBanco.push({ funcao, argumentos });
    if (falhas.has('banco') || falhas.has(funcao)) throw new Error(`connect ECONNREFUSED (${funcao})`);
    return [{ resultado: funcoesBanco[funcao](...argumentos) }];
  }

  const uazapi = (nomeNo) => (parametros) => {
    const corpo = parametros.jsonBody;
    estado.envios.push({ no: nomeNo, url: parametros.url, ...corpo });
    if (falhas.has('uazapi') || falhas.has(nomeNo)) throw new Error('UAZAPI 503');
    return { messageid: `msg-${estado.envios.length}` };
  };

  const servicos = {
    [NOS.buscarTextoAlerta]: postgres,
    [NOS.registrarTextoAlerta]: postgres,
    [NOS.buscarContexto]: postgres,
    [NOS.marcarNaoLead]: postgres,
    [NOS.buscarInstrucaoSemAviso]: postgres,
    [NOS.registrarHandoff]: postgres,
    [NOS.registrarNotificacao]: postgres,
    [NOS.enviarTextoAlerta]: uazapi(NOS.enviarTextoAlerta),
    [NOS.notificarGrupo]: uazapi(NOS.notificarGrupo),
    [NOS.avisarPlantao]: uazapi(NOS.avisarPlantao),
    [NOS.avisarGrupoReserva]: uazapi(NOS.avisarGrupoReserva),
    [NOS.classificarPedido]: (parametros) => {
      estado.chamadasOpenAi.push(parametros.jsonBody);
      if (falhas.has('openai')) throw new Error('OpenAI 500');
      const conteudo =
        typeof opcoes.classificacao === 'string' ? opcoes.classificacao : JSON.stringify(opcoes.classificacao ?? { tipo: 'outro', porque: 'x' });
      return { choices: [{ message: { content: conteudo } }] };
    },
    [NOS.redisMarcarPausa]: (parametros) => {
      if (falhas.has('redis')) throw new Error('Redis fora do ar');
      estado.redis.push({ key: parametros.key, value: parametros.value, ttl: parametros.ttl, expire: parametros.expire });
    },
  };

  return {
    relogio,
    estado,
    servicos,
    chamadas: (funcao) => estado.chamadasBanco.filter((c) => c.funcao === funcao),
    enviosDe: (no) => estado.envios.filter((e) => e.no === no),
  };
}

const ENTRADA_BASE = {
  acao: 'transferir',
  wa_jid: '000000000001@s.whatsapp.net',
  conversa_id: '11111111-1111-4111-8111-111111111111',
  nome: 'Ana',
  motivo: 'contratar',
  resumo: 'Quer fechar o Continuado',
  solicitacao: 'quer contratar o Continuado',
  dados: { semanas: 30 },
  texto_familia: 'quero fechar',
  chave_texto: null,
  enviar_texto: false,
  origem_chamada: 'agente',
  modo: 'vendas',
};

function entrada(sobrescrever = {}) {
  return { ...ENTRADA_BASE, ...sobrescrever };
}

async function rodar(fluxo, ambiente, entradaDoTeste) {
  const resultado = simularFluxo(fluxo, { entrada: entradaDoTeste, servicos: ambiente.servicos });
  assert.equal(resultado.saida.length, 1, 'o sub-fluxo devolve exatamente um item');
  return { ...resultado, retorno: resultado.saida[0] };
}

// ---------------------------------------------------------------------------
// Funções puras
// ---------------------------------------------------------------------------

describe('fluxo 2 · Pular Classificador? (função pura)', () => {
  test('pula para ação de alerta, origem que não é o agente e os seis motivos do nó 5', () => {
    assert.equal(pularClassificador({ acao: 'alerta_saude', origem_chamada: 'agente', motivo: 'contratar' }).pular, true);
    assert.equal(pularClassificador({ acao: 'perda', origem_chamada: 'agente', motivo: 'perda' }).pular, true);
    for (const origem of ['filtro_termos', 'classificador', 'agendado', 'sistema', undefined]) {
      assert.equal(pularClassificador({ acao: 'transferir', origem_chamada: origem, motivo: 'contratar' }).pular, true, origem);
    }
    for (const motivo of MOTIVOS_SEM_CLASSIFICADOR) {
      assert.equal(pularClassificador({ acao: 'transferir', origem_chamada: 'agente', motivo }).pular, true, motivo);
    }
    assert.deepEqual(MOTIVOS_SEM_CLASSIFICADOR, [
      'estado_sensivel_escreveu',
      'midia_recebida',
      'validacao_resposta',
      'pediu_humano',
      'reclamacao',
      'bebe_nasceu',
    ]);
  });

  test('não pula para motivo comercial vindo do agente', () => {
    for (const motivo of MOTIVOS_COMERCIAIS) {
      assert.equal(pularClassificador({ acao: 'transferir', origem_chamada: 'agente', motivo }).pular, false, motivo);
    }
  });
});

describe('fluxo 2 · Normalizar Entrada (função pura)', () => {
  test('dados convertido com segurança; motivo fora do enum vira outro', () => {
    assert.deepEqual(converterDados('{"semanas": 30}'), { semanas: 30 });
    assert.deepEqual(converterDados('não é json'), {});
    assert.deepEqual(converterDados([1, 2]), {});
    assert.deepEqual(converterDados({ a: 1, _fluxo2: { forjado: true } }), { a: 1 });
    const estado = normalizarEntradaHandoff(entrada({ motivo: 'inventado' }));
    assert.equal(estado.motivo, 'outro');
  });

  test('tipo da ferramenta de saúde vira ação e chave; internação e emocional só com ativação ligada', () => {
    const emocionalDesligado = normalizarEntradaHandoff(entrada({ tipo: 'emocional', enviar_texto: true, motivo: 'saude' }));
    assert.equal(emocionalDesligado.acao, 'alerta_saude');
    assert.equal(emocionalDesligado.chave_texto, 'alerta_saude');

    const emocionalLigado = normalizarEntradaHandoff(
      entrada({ tipo: 'emocional', enviar_texto: true, alerta_emocional_ativo: true }),
    );
    assert.equal(emocionalLigado.chave_texto, 'alerta_emocional');

    const internacaoDesligado = normalizarEntradaHandoff(entrada({ tipo: 'internacao', enviar_texto: true }));
    assert.equal(internacaoDesligado.chave_texto, 'alerta_saude');
    const internacaoLigado = normalizarEntradaHandoff(
      entrada({ tipo: 'internacao', enviar_texto: true, alerta_internacao_ativo: 'true' }),
    );
    assert.equal(internacaoLigado.chave_texto, 'alerta_internacao');

    const perda = normalizarEntradaHandoff(entrada({ tipo: 'perda', enviar_texto: true }));
    assert.equal(perda.acao, 'perda');
    assert.equal(perda.motivo, 'perda');
    assert.equal(perda.chave_texto, 'perda');
  });

  test('chaveTextoAlerta aceita alerta_saude_sensivel e rebaixa chave desconhecida para alerta_saude', () => {
    assert.equal(chaveTextoAlerta({ acao: 'alerta_saude', chaveTexto: 'alerta_saude_sensivel' }), 'alerta_saude_sensivel');
    assert.equal(chaveTextoAlerta({ acao: 'alerta_saude', chaveTexto: 'qualquer' }), 'alerta_saude');
  });

  test('enviar_texto só vale com verdadeiro explícito', () => {
    for (const valor of [undefined, null, false, 'false', 1, 'sim']) {
      const estado = normalizarEntradaHandoff(entrada({ acao: 'alerta_saude', enviar_texto: valor, origem_chamada: 'filtro_termos' }));
      assert.equal(estado.enviar_texto_alerta, false, String(valor));
    }
    for (const valor of [true, 'true']) {
      const estado = normalizarEntradaHandoff(entrada({ acao: 'alerta_saude', enviar_texto: valor, origem_chamada: 'filtro_termos' }));
      assert.equal(estado.enviar_texto_alerta, true, String(valor));
    }
  });

  test('transferência com motivo saude nunca é rebaixada: vira alerta, com texto quando veio do agente', () => {
    const doAgente = normalizarEntradaHandoff(entrada({ motivo: 'saude', enviar_texto: false }));
    assert.equal(doAgente.acao, 'alerta_saude');
    assert.equal(doAgente.enviar_texto_alerta, true);
    const doSistema = normalizarEntradaHandoff(entrada({ motivo: 'perda', origem_chamada: 'sistema', enviar_texto: false }));
    assert.equal(doSistema.acao, 'perda');
    assert.equal(doSistema.enviar_texto_alerta, false);
  });

  test('telefone vem da entrada ou do jid @s.whatsapp.net, nunca de um @lid', () => {
    assert.equal(normalizarEntradaHandoff(entrada()).telefone, '000000000001');
    assert.equal(normalizarEntradaHandoff(entrada({ wa_jid: '123456789012345@lid' })).telefone, '');
    assert.equal(normalizarEntradaHandoff(entrada({ telefone: '000000000009' })).telefone, '000000000009');
  });
});

describe('fluxo 2 · Ler Classificação (função pura, regras v4.2)', () => {
  const classificar = (tipo, extra = {}) =>
    lerClassificacaoPedido({ motivoAgente: 'outro', saidaModelo: JSON.stringify({ tipo, porque: 'x' }), modo: 'vendas', ...extra });

  test('sem_aviso: aceito só para duvida_sem_resposta e outro em modo vendas', () => {
    assert.equal(classificar('sem_aviso', { motivoAgente: 'duvida_sem_resposta' }).acao, 'sem_aviso');
    assert.equal(classificar('sem_aviso', { motivoAgente: 'outro' }).acao, 'sem_aviso');
    const contratar = classificar('sem_aviso', { motivoAgente: 'contratar' });
    assert.equal(contratar.acao, 'transferir');
    assert.equal(contratar.motivoFinal, 'contratar');
    assert.equal(contratar.recusa, 'sem_aviso_motivo_nao_elegivel');
    const cliente = classificar('sem_aviso', { modo: 'cliente' });
    assert.equal(cliente.acao, 'transferir');
    assert.equal(cliente.recusa, 'sem_aviso_fora_do_modo_vendas');
    assert.equal(classificar('sem_aviso', { modo: null }).acao, 'transferir', 'modo ausente: na dúvida avisa');
  });

  test('troca de motivo mantém a maior prioridade entre o original e o novo e mantém as opções', () => {
    const reduziria = lerClassificacaoPedido({
      motivoAgente: 'reuniao',
      saidaModelo: JSON.stringify({ tipo: 'cobertura_taxa', porque: 'x' }),
      modo: 'vendas',
      dados: { opcoes: 'quinta ou sexta às 10h' },
    });
    assert.equal(reduziria.motivoFinal, 'cobertura_taxa');
    assert.equal(reduziria.prioridadeMinima, 'alta');
    assert.equal(reduziria.manterOpcoes, true);

    const sobe = lerClassificacaoPedido({
      motivoAgente: 'condicao_comercial',
      saidaModelo: JSON.stringify({ tipo: 'contratar', porque: 'x' }),
      modo: 'vendas',
    });
    assert.equal(sobe.motivoFinal, 'contratar');
    assert.equal(sobe.prioridadeMinima, 'alta');
  });

  test('pediu_humano tem prioridade maior que condicao_comercial, logo depois de reclamacao', () => {
    assert.ok(nivelPrioridade(prioridadeDoMotivo('pediu_humano')) > nivelPrioridade(prioridadeDoMotivo('condicao_comercial')));
    assert.ok(compararUrgencia('pediu_humano', 'condicao_comercial') < 0);
    assert.ok(compararUrgencia('reclamacao', 'pediu_humano') < 0);
    assert.equal(ORDEM_URGENCIA.indexOf('pediu_humano'), ORDEM_URGENCIA.indexOf('reclamacao') + 1);
  });

  test('a ordem de urgência é a mesma frase de classificar-pedido.md', async () => {
    const prompt = extrairPrompt(await readFile(path.join(AQUI, 'prompts/classificar-pedido.md'), 'utf8'));
    const frase = /nesta ordem:\s*([^.]+),\s*e depois os demais\./.exec(prompt);
    assert.ok(frase, 'frase de ordem de urgência não encontrada no prompt');
    const ordemDoPrompt = frase[1].split(',').map((parte) => parte.trim());
    assert.deepEqual(ordemDoPrompt, ORDEM_URGENCIA);
  });

  test('não lead preservado; gestante (semanas, DPP ou plano na ficha) nunca vira não lead', () => {
    const marcada = lerClassificacaoPedido({
      motivoAgente: 'outro',
      saidaModelo: JSON.stringify({ tipo: 'contratar', porque: 'x' }),
      modo: 'vendas',
      jaNaoLead: true,
    });
    assert.equal(marcada.acao, 'nao_lead');

    const gestanteDoLeonardo = lerClassificacaoPedido({
      motivoAgente: 'outro',
      saidaModelo: JSON.stringify({ tipo: 'nao_lead', porque: 'citou o Leonardo como médico' }),
      modo: 'vendas',
      dados: { semanas: 32 },
    });
    assert.equal(gestanteDoLeonardo.acao, 'transferir');
    assert.equal(gestanteDoLeonardo.motivoFinal, 'outro');
    assert.equal(gestanteDoLeonardo.recusa, 'nao_lead_com_sinal_de_lead');

    assert.equal(classificar('nao_lead').acao, 'nao_lead');
    assert.equal(classificar('nao_lead', { motivoAgente: 'reuniao' }).acao, 'transferir');
  });

  test('saúde e perda sobem até em conversa já marcada como não lead', () => {
    const resultado = lerClassificacaoPedido({
      motivoAgente: 'outro',
      saidaModelo: JSON.stringify({ tipo: 'perda', porque: 'x' }),
      jaNaoLead: true,
    });
    assert.equal(resultado.acao, 'perda');
    assert.equal(resultado.subiuParaAlerta, true);
  });

  test('tipo fora dos comerciais não troca motivo comercial (só saúde e perda sobem)', () => {
    const resultado = lerClassificacaoPedido({
      motivoAgente: 'condicao_comercial',
      saidaModelo: JSON.stringify({ tipo: 'pediu_humano', porque: 'x' }),
      modo: 'vendas',
    });
    assert.equal(resultado.motivoFinal, 'condicao_comercial');
    assert.equal(resultado.recusa, 'troca_fora_dos_motivos_comerciais');
  });
});

describe('fluxo 2 · estado (funções puras)', () => {
  test('pedido atual são as mensagens da família desde a última resposta', () => {
    const { pedido, anteriores } = separarPedidoAtual([
      { de: 'familia', texto: 'a' },
      { de: 'equipe', texto: 'b' },
      { de: 'familia', texto: 'c' },
      { de: 'familia', texto: 'd' },
    ]);
    assert.deepEqual(pedido.map((m) => m.texto), ['c', 'd']);
    assert.deepEqual(anteriores.map((m) => m.texto), ['a', 'b']);
  });

  test('registro falhou em alerta: usa o grupo de reserva e a instrução continua instrucao_saude', () => {
    const estado = normalizarEntradaHandoff(entrada({ acao: 'alerta_saude', enviar_texto: true }));
    const lido = lerRegistroHandoff(estado, { error: { message: 'ECONNREFUSED' } });
    assert.equal(lido.registro_ok, false);
    assert.equal(lido.usar_grupo_reserva, true);
    assert.equal(lido.instrucao_chave, 'instrucao_saude');
    assert.equal(lido.ok, false);
  });

  test('registro falhou em pedido comercial: sem grupo de reserva, instrução de erro', () => {
    const estado = normalizarEntradaHandoff(entrada());
    const lido = lerRegistroHandoff(estado, { error: 'x' });
    assert.equal(lido.usar_grupo_reserva, false);
    assert.equal(lido.instrucao_chave, 'instrucao_erro');
  });

  test('duplicado só silencia motivo comercial', () => {
    const resposta = { resultado: { ok: true, handoff_id: 'h1', duplicado: true, pausa_horas: 48 } };
    assert.equal(lerRegistroHandoff(normalizarEntradaHandoff(entrada()), resposta).duplicado_sem_aviso, true);
    for (const extra of [{ acao: 'alerta_saude' }, { acao: 'perda' }, { motivo: 'estado_sensivel_escreveu', origem_chamada: 'sistema' }]) {
      const estado = normalizarEntradaHandoff(entrada(extra));
      assert.equal(lerRegistroHandoff(estado, resposta).duplicado_sem_aviso, false, JSON.stringify(extra));
    }
  });

  test('aviso de reserva troca {telefone} e {texto_familia} do modelo do config', () => {
    const estado = normalizarEntradaHandoff(entrada({ texto_familia: 'sangrando muito' }));
    const aviso = montarAvisoReserva(estado, { modelo: 'X · {telefone} · "{texto_familia}"', jid: 'g@g.us' });
    assert.equal(aviso.aviso_reserva_texto, 'X · 000000000001 · "sangrando muito"');
    assert.equal(aviso.aviso_reserva_jid, 'g@g.us');
  });

  test('falha de um aviso de plantão deixa a notificação com erro (faixa vermelha no CRM)', () => {
    const estado = { grupo_jid: 'g@g.us', mensagem_grupo: 'm' };
    const lido = consolidarNotificacao(estado, { messageid: '1' }, [{ messageid: '2' }, { error: { message: 'x' } }]);
    assert.equal(lido.notificacao_ok, false);
    assert.match(lido.notificacao_erro, /plantão: 1 de 2/);
  });
});

// ---------------------------------------------------------------------------
// Cenários do P24 v2, rodando o JSON gerado.
// ---------------------------------------------------------------------------

describe('fluxo 2 · cenários do P24 (JSON gerado no simulador)', () => {
  test('classificador pulado para motivos do sistema, pediu_humano, reclamacao e bebe_nasceu', async () => {
    const fluxo = await fluxo2();
    const casos = [
      { origem_chamada: 'sistema', motivo: 'midia_recebida' },
      { origem_chamada: 'sistema', motivo: 'audio_nao_transcrito' },
      { origem_chamada: 'agendado', motivo: 'contratar' },
      { origem_chamada: 'agente', motivo: 'validacao_resposta' },
      { origem_chamada: 'agente', motivo: 'estado_sensivel_escreveu' },
      { origem_chamada: 'agente', motivo: 'pediu_humano' },
      { origem_chamada: 'agente', motivo: 'reclamacao' },
      { origem_chamada: 'agente', motivo: 'bebe_nasceu' },
    ];
    for (const caso of casos) {
      const ambiente = criarAmbiente({ classificacao: { tipo: 'sem_aviso', porque: 'x' } });
      const { retorno, rodou } = await rodar(fluxo, ambiente, entrada(caso));
      assert.equal(rodou(NOS.classificarPedido), false, `classificador não pode rodar: ${JSON.stringify(caso)}`);
      assert.equal(rodou(NOS.buscarContexto), false);
      assert.equal(ambiente.estado.ultimoHandoff.motivo, caso.motivo);
      assert.equal(ambiente.enviosDe(NOS.notificarGrupo).length, 1);
      assert.equal(retorno.ok, true);
    }
  });

  test('motivo comercial do agente passa pelo classificador, com o prompt preenchido', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ classificacao: { tipo: 'contratar', porque: 'x' }, pedidoAtual: 'quero fechar o de 12 dias' });
    const { rodou } = await rodar(fluxo, ambiente, entrada());
    assert.equal(rodou(NOS.classificarPedido), true);
    const corpo = ambiente.estado.chamadasOpenAi[0];
    assert.equal(corpo.model, 'gpt-4.1-mini');
    assert.equal(corpo.temperature, 0);
    assert.deepEqual(corpo.response_format, { type: 'json_object' });
    const prompt = corpo.messages[0].content;
    assert.match(prompt, /Motivo escolhido pela assistente: contratar/);
    assert.match(prompt, /Família: quero fechar o de 12 dias/);
    assert.match(prompt, /Isadora: Claro! Te mando a apresentação\./);
    assert.ok(!prompt.includes('{{'), 'variável do prompt sem troca');
  });

  test('classificador falhou (erro ou JSON inválido): vale o motivo do agente, marcado classificador_falhou', async () => {
    const fluxo = await fluxo2();
    for (const opcoes of [{ falhas: ['openai'] }, { classificacao: 'não é json' }, { classificacao: { tipo: 'inventado' } }]) {
      const ambiente = criarAmbiente(opcoes);
      const { retorno } = await rodar(fluxo, ambiente, entrada({ motivo: 'reuniao' }));
      assert.equal(ambiente.estado.ultimoHandoff.motivo, 'reuniao');
      assert.equal(ambiente.estado.ultimoHandoff.dados._fluxo2.classificador_falhou, true);
      assert.equal(ambiente.enviosDe(NOS.notificarGrupo).length, 1, 'falha do classificador nunca cala o aviso');
      assert.equal(retorno.ok, true);
      assert.equal(retorno.instrucao_chave, 'instrucao_reuniao');
    }
  });

  test('classificador sobe para saúde (nó 8a): família recebe alerta_saude, grupo com mensagem_enviada, agente recebe instrucao_saude', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ classificacao: { tipo: 'saude', porque: 'relata sangramento' } });
    const { retorno, vezes, ordem } = await rodar(
      fluxo,
      ambiente,
      entrada({
        motivo: 'duvida_sem_resposta',
        texto_familia: 'Queria saber do contrato, e desde ontem estou com um sangramento',
        enviar_texto: false,
      }),
    );

    const [textoFamilia] = ambiente.enviosDe(NOS.enviarTextoAlerta);
    assert.equal(textoFamilia.number, ENTRADA_BASE.wa_jid);
    assert.equal(textoFamilia.text, '[texto aprovado alerta_saude]');
    assert.equal(textoFamilia.track_source, 'kraamzorg-agente');
    assert.deepEqual(ambiente.chamadas('mensagem_alerta')[0].argumentos, [ENTRADA_BASE.conversa_id, 'alerta_saude', 'alerta_saude']);
    assert.equal(ambiente.chamadas('registrar_mensagem').length, 1, 'texto que saiu é registrado');

    assert.equal(vezes(NOS.textoDeAlerta), 2, 'o fluxo volta ao nó 3 depois do 8a');
    assert.ok(ordem.indexOf(NOS.enviarTextoAlerta) < ordem.indexOf(NOS.registrarHandoff), 'texto à família antes do registro');

    assert.equal(ambiente.estado.ultimoHandoff.motivo, 'saude');
    assert.equal(ambiente.estado.ultimoHandoff.prioridade, 'maxima');
    assert.equal(ambiente.estado.ultimoHandoff.dados._fluxo2.mensagem_enviada, '[texto aprovado alerta_saude]');
    const [grupo] = ambiente.enviosDe(NOS.notificarGrupo);
    assert.match(grupo.text, /família recebeu: "\[texto aprovado alerta_saude\]"/);
    assert.equal(ambiente.enviosDe(NOS.avisarPlantao).length, PLANTAO_FALSO.length);

    assert.equal(retorno.instrucao_chave, 'instrucao_saude');
    assert.equal(retorno.acao, 'alerta_saude');
    assert.equal(retorno.ok, true);
  });

  test('classificador sobe para perda: texto perda à família e freio pelo banco', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ classificacao: { tipo: 'perda', porque: 'x' } });
    const { retorno } = await rodar(fluxo, ambiente, entrada({ motivo: 'outro' }));
    assert.equal(ambiente.enviosDe(NOS.enviarTextoAlerta)[0].text, '[texto aprovado perda]');
    assert.equal(ambiente.estado.ultimoHandoff.motivo, 'perda');
    assert.equal(retorno.instrucao_chave, 'instrucao_saude');
  });

  test('sem_aviso recusado para contratar e para o modo cliente; aceito para duvida_sem_resposta em vendas', async () => {
    const fluxo = await fluxo2();
    const semAviso = { tipo: 'sem_aviso', porque: 'x' };

    const contratar = criarAmbiente({ classificacao: semAviso });
    const r1 = await rodar(fluxo, contratar, entrada({ motivo: 'contratar' }));
    assert.equal(contratar.chamadas('registrar_handoff').length, 1);
    assert.equal(contratar.enviosDe(NOS.notificarGrupo).length, 1);
    assert.equal(r1.retorno.instrucao_chave, 'instrucao_contratar');

    const cliente = criarAmbiente({ classificacao: semAviso });
    await rodar(fluxo, cliente, entrada({ motivo: 'outro', modo: 'cliente' }));
    assert.equal(cliente.chamadas('registrar_handoff').length, 1);
    assert.equal(cliente.estado.ultimoHandoff.dados._fluxo2.classificacao_recusa, 'sem_aviso_fora_do_modo_vendas');

    const aceito = criarAmbiente({ classificacao: semAviso });
    const r3 = await rodar(fluxo, aceito, entrada({ motivo: 'duvida_sem_resposta', modo: 'vendas' }));
    assert.equal(aceito.chamadas('registrar_handoff').length, 0, 'nada registrado');
    assert.equal(aceito.estado.envios.length, 0, 'nenhum aviso');
    assert.deepEqual(aceito.chamadas('mensagem_sistema')[0].argumentos, [ENTRADA_BASE.conversa_id, 'instrucao_sem_aviso']);
    assert.equal(r3.retorno.instrucao_chave, 'instrucao_sem_aviso');
    assert.equal(r3.retorno.instrucao, '[instrucao_sem_aviso]');
    assert.equal(r3.retorno.handoff_id, null);
  });

  test('troca de motivo pelo classificador leva a prioridade maior e as opções ao banco', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ classificacao: { tipo: 'cobertura_taxa', porque: 'x' } });
    await rodar(fluxo, ambiente, entrada({ motivo: 'reuniao', dados: { semanas: 30, opcoes: 'quinta ou sexta às 10h' } }));
    const handoff = ambiente.estado.ultimoHandoff;
    assert.equal(handoff.motivo, 'cobertura_taxa');
    assert.equal(handoff.prioridade, 'alta');
    assert.equal(handoff.dados.opcoes, 'quinta ou sexta às 10h');
    assert.match(ambiente.enviosDe(NOS.notificarGrupo)[0].text, /opções: quinta ou sexta às 10h/);
  });

  test('não lead preservado; gestante que cita o Leonardo como médico continua lead', async () => {
    const fluxo = await fluxo2();
    const marcada = criarAmbiente({
      classificacao: { tipo: 'contratar', porque: 'x' },
      contexto: { ok: true, classificacao: 'candidata', iniciada_por: 'familia', mensagens: [] },
    });
    const r1 = await rodar(fluxo, marcada, entrada({ motivo: 'outro', dados: { tipo_contato: 'candidata' } }));
    assert.deepEqual(marcada.chamadas('marcar_nao_lead')[0].argumentos, [ENTRADA_BASE.conversa_id, 'candidata']);
    assert.equal(marcada.chamadas('registrar_handoff').length, 0);
    assert.equal(marcada.estado.envios.length, 0);
    assert.equal(r1.retorno.instrucao_chave, 'instrucao_nao_lead');
    assert.equal(r1.retorno.instrucao, '[instrucao_nao_lead]');

    const gestante = criarAmbiente({ classificacao: { tipo: 'nao_lead', porque: 'citou o Leonardo' } });
    await rodar(
      fluxo,
      gestante,
      entrada({ motivo: 'outro', dados: { semanas: 32 }, texto_familia: 'O Leonardo é meu obstetra, queria o pós-parto' }),
    );
    assert.equal(gestante.chamadas('marcar_nao_lead').length, 0);
    assert.equal(gestante.estado.ultimoHandoff.motivo, 'outro');
  });

  test('pedido comercial duplicado em 10 minutos não gera novo aviso', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ classificacao: { tipo: 'contratar', porque: 'x' } });
    const r1 = await rodar(fluxo, ambiente, entrada());
    ambiente.relogio.agora += 3 * 60 * 1000;
    const r2 = await rodar(fluxo, ambiente, entrada());
    assert.equal(ambiente.enviosDe(NOS.notificarGrupo).length, 1, 'segundo pedido igual não reenvia');
    assert.equal(r2.retorno.handoff_id, r1.retorno.handoff_id);
    assert.equal(r2.retorno.ok, true);
    assert.equal(r2.retorno.instrucao_chave, 'instrucao_contratar');

    ambiente.relogio.agora += 1000;
    await rodar(fluxo, ambiente, entrada({ solicitacao: 'outra coisa' }));
    assert.equal(ambiente.enviosDe(NOS.notificarGrupo).length, 2, 'solicitação diferente é pedido novo');
  });

  test('dois alertas de saúde em 5 minutos geram dois avisos ao grupo e ao plantão, o segundo com ATUALIZAÇÃO', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente();
    const alerta = { acao: 'alerta_saude', motivo: 'saude', origem_chamada: 'filtro_termos', enviar_texto: true };
    const r1 = await rodar(fluxo, ambiente, entrada({ ...alerta, texto_familia: 'estou com febre' }));
    ambiente.relogio.agora += 4 * 60 * 1000;
    const r2 = await rodar(fluxo, ambiente, entrada({ ...alerta, texto_familia: 'agora sangrando muito' }));

    const grupo = ambiente.enviosDe(NOS.notificarGrupo);
    assert.equal(grupo.length, 2);
    assert.ok(!grupo[0].text.startsWith('ATUALIZAÇÃO'));
    assert.ok(grupo[1].text.startsWith('ATUALIZAÇÃO · '));
    assert.match(grupo[1].text, /agora sangrando muito/);
    assert.equal(ambiente.enviosDe(NOS.avisarPlantao).length, 2 * PLANTAO_FALSO.length);
    assert.equal(r2.retorno.handoff_id, r1.retorno.handoff_id, 'reaproveita o handoff aberto');
    assert.equal(ambiente.enviosDe(NOS.enviarTextoAlerta).length, 2);
  });

  test('alerta repetido reenvia mesmo se o banco marcar duplicado (defesa), e estado_sensivel_escreveu também', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ forcarDuplicado: true });
    await rodar(fluxo, ambiente, entrada({ acao: 'perda', origem_chamada: 'filtro_termos', enviar_texto: true }));
    await rodar(fluxo, ambiente, entrada({ motivo: 'estado_sensivel_escreveu', origem_chamada: 'sistema' }));
    await rodar(fluxo, ambiente, entrada({ motivo: 'estado_sensivel_escreveu', origem_chamada: 'sistema' }));
    assert.equal(ambiente.enviosDe(NOS.notificarGrupo).length, 3);
  });

  test('banco fora do ar em saúde: grupo de reserva com a marca "não registrado no sistema"', async () => {
    const config = await configExemplo();
    const fluxo = gerarFluxos(config, 'hml').fluxo2;
    const ambiente = criarAmbiente({ falhas: ['banco'] });
    const { retorno } = await rodar(
      fluxo,
      ambiente,
      entrada({ acao: 'alerta_saude', origem_chamada: 'filtro_termos', enviar_texto: true, texto_familia: 'sangramento forte' }),
    );
    const [reserva] = ambiente.enviosDe(NOS.avisarGrupoReserva);
    assert.equal(reserva.number, config.grupoFallbackJid);
    assert.equal(reserva.text, '[NÃO REGISTRADO NO SISTEMA] Possível alerta de saúde · 000000000001 · "sangramento forte"');
    assert.equal(reserva.track_source, 'kraamzorg-agente');
    assert.equal(ambiente.enviosDe(NOS.notificarGrupo).length, 0, 'sem banco não há grupo_jid');
    assert.equal(ambiente.enviosDe(NOS.avisarPlantao).length, 0, 'sem banco não há plantão');
    assert.equal(ambiente.enviosDe(NOS.enviarTextoAlerta).length, 0, 'sem banco não há texto aprovado');
    assert.equal(retorno.ok, false);
    assert.equal(retorno.instrucao_chave, 'instrucao_saude');
  });

  test('só registrar_handoff fora do ar em perda: família recebe o texto e o grupo de reserva é avisado', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ falhas: ['registrar_handoff'] });
    await rodar(fluxo, ambiente, entrada({ acao: 'perda', origem_chamada: 'filtro_termos', enviar_texto: true, texto_familia: 'perdi o bebê' }));
    assert.equal(ambiente.enviosDe(NOS.enviarTextoAlerta).length, 1);
    assert.equal(ambiente.enviosDe(NOS.avisarGrupoReserva).length, 1);
    assert.match(ambiente.enviosDe(NOS.avisarGrupoReserva)[0].text, /^\[NÃO REGISTRADO NO SISTEMA\]/);
  });

  test('banco fora do ar em pedido comercial: sem grupo de reserva, instrução de erro', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ falhas: ['banco'], classificacao: { tipo: 'contratar', porque: 'x' } });
    const { retorno } = await rodar(fluxo, ambiente, entrada());
    assert.equal(ambiente.estado.envios.length, 0);
    assert.equal(retorno.ok, false);
    assert.equal(retorno.instrucao_chave, 'instrucao_erro');
  });

  test('texto de alerta enviado só com enviar_texto verdadeiro', async () => {
    const fluxo = await fluxo2();
    for (const enviar of [false, undefined, 'false']) {
      const ambiente = criarAmbiente();
      await rodar(fluxo, ambiente, entrada({ acao: 'alerta_saude', origem_chamada: 'filtro_termos', enviar_texto: enviar }));
      assert.equal(ambiente.chamadas('mensagem_alerta').length, 0, String(enviar));
      assert.equal(ambiente.enviosDe(NOS.enviarTextoAlerta).length, 0, String(enviar));
      assert.match(ambiente.enviosDe(NOS.notificarGrupo)[0].text, /nenhuma mensagem saiu, responder agora/);
    }
    const ambiente = criarAmbiente();
    await rodar(fluxo, ambiente, entrada({ acao: 'alerta_saude', origem_chamada: 'filtro_termos', enviar_texto: true }));
    assert.equal(ambiente.enviosDe(NOS.enviarTextoAlerta).length, 1);
  });

  test('transferência comum nunca envia texto de alerta, mesmo com enviar_texto verdadeiro', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ classificacao: { tipo: 'contratar', porque: 'x' } });
    await rodar(fluxo, ambiente, entrada({ enviar_texto: true }));
    assert.equal(ambiente.chamadas('mensagem_alerta').length, 0);
    assert.equal(ambiente.enviosDe(NOS.enviarTextoAlerta).length, 0);
  });

  test('acionar_equipe_saude com tipo emocional e alerta_emocional_ativo falso envia alerta_saude', async () => {
    const fluxo = await fluxo2();
    const desligado = criarAmbiente();
    await rodar(fluxo, desligado, entrada({ acao: 'alerta_saude', tipo: 'emocional', enviar_texto: true, alerta_emocional_ativo: false }));
    assert.equal(desligado.chamadas('mensagem_alerta')[0].argumentos[2], 'alerta_saude');
    assert.equal(desligado.enviosDe(NOS.enviarTextoAlerta)[0].text, '[texto aprovado alerta_saude]');

    const ligado = criarAmbiente({ ativacaoBanco: { alerta_emocional_ativo: true } });
    await rodar(fluxo, ligado, entrada({ acao: 'alerta_saude', tipo: 'emocional', enviar_texto: true, alerta_emocional_ativo: true }));
    assert.equal(ligado.chamadas('mensagem_alerta')[0].argumentos[2], 'alerta_emocional');
    assert.equal(ligado.enviosDe(NOS.enviarTextoAlerta)[0].text, '[texto aprovado alerta_emocional]');
  });

  test('falha no envio do texto de alerta: nada é registrado como enviado e o grupo sabe que nada saiu', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ falhas: [NOS.enviarTextoAlerta] });
    await rodar(fluxo, ambiente, entrada({ acao: 'alerta_saude', origem_chamada: 'filtro_termos', enviar_texto: true }));
    assert.equal(ambiente.chamadas('registrar_mensagem').length, 0);
    assert.equal(ambiente.estado.ultimoHandoff.dados._fluxo2.mensagem_enviada, null);
    assert.match(ambiente.enviosDe(NOS.notificarGrupo)[0].text, /nenhuma mensagem saiu/);
  });

  test('pausa no Redis com o prazo do banco; humano_comercial não ganha cache de pausa', async () => {
    const fluxo = await fluxo2();
    const comPrazo = criarAmbiente({ classificacao: { tipo: 'duvida_sem_resposta', porque: 'x' } });
    await rodar(fluxo, comPrazo, entrada({ motivo: 'duvida_sem_resposta' }));
    assert.deepEqual(comPrazo.estado.redis, [
      { key: `kz:pausa:${ENTRADA_BASE.conversa_id}`, value: 'duvida_sem_resposta', ttl: 48 * 3600, expire: true },
    ]);

    const qualificado = criarAmbiente({ classificacao: { tipo: 'reuniao', porque: 'x' }, leadQualificado: true });
    const { retorno } = await rodar(fluxo, qualificado, entrada({ motivo: 'reuniao' }));
    assert.equal(qualificado.estado.redis.length, 0);
    assert.equal(qualificado.enviosDe(NOS.notificarGrupo).length, 1);
    assert.equal(retorno.instrucao_chave, 'instrucao_reuniao');
  });

  test('Redis fora do ar não impede o aviso ao grupo', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ falhas: ['redis'] });
    await rodar(fluxo, ambiente, entrada({ acao: 'alerta_saude', origem_chamada: 'filtro_termos', enviar_texto: true }));
    assert.equal(ambiente.enviosDe(NOS.notificarGrupo).length, 1);
    assert.equal(ambiente.enviosDe(NOS.avisarPlantao).length, PLANTAO_FALSO.length);
  });

  test('falha do aviso ao grupo é registrada como notificação com erro', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ falhas: [NOS.notificarGrupo], classificacao: { tipo: 'contratar', porque: 'x' } });
    const { retorno } = await rodar(fluxo, ambiente, entrada());
    assert.equal(ambiente.estado.notificacoes.length, 1);
    assert.equal(ambiente.estado.notificacoes[0].ok, false);
    assert.match(ambiente.estado.notificacoes[0].erro, /grupo: UAZAPI 503/);
    assert.equal(retorno.ok, true, 'o handoff foi registrado; a falha do aviso vai para o CRM');
  });

  test('toda chamada ao banco usa conversa_id como chave; o jid só vai para registrar_mensagem', async () => {
    const fluxo = await fluxo2();
    const ambiente = criarAmbiente({ classificacao: { tipo: 'saude', porque: 'x' } });
    await rodar(fluxo, ambiente, entrada({ motivo: 'outro' }));
    for (const chamada of ambiente.estado.chamadasBanco) {
      if (chamada.funcao === 'registrar_mensagem') {
        assert.equal(chamada.argumentos[0], ENTRADA_BASE.wa_jid);
      } else if (chamada.funcao === 'registrar_notificacao_handoff') {
        assert.match(chamada.argumentos[0], /^handoff-/);
      } else {
        assert.equal(chamada.argumentos[0], ENTRADA_BASE.conversa_id, chamada.funcao);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Estrutura do fluxo 2 gerado.
// ---------------------------------------------------------------------------

function predecessores(fluxo, nome) {
  const lista = [];
  for (const [origem, porTipo] of Object.entries(fluxo.connections)) {
    (porTipo.main ?? []).forEach((saida, indice) => {
      for (const destino of saida ?? []) if (destino.node === nome) lista.push({ origem, saida: indice });
    });
  }
  return lista;
}

function alcancaveis(fluxo, inicio, bloqueados = new Set()) {
  const vistos = new Set();
  const fila = [inicio];
  while (fila.length > 0) {
    const atual = fila.shift();
    if (vistos.has(atual) || bloqueados.has(atual)) continue;
    vistos.add(atual);
    for (const saida of fluxo.connections[atual]?.main ?? []) for (const destino of saida ?? []) fila.push(destino.node);
  }
  return vistos;
}

describe('fluxo 2 · estrutura do JSON gerado', () => {
  test('tem os 19 nós do 19.3 e o nó 8a, com os nomes do PRD', async () => {
    const fluxo = await fluxo2();
    const nomes = new Set(fluxo.nodes.map((no) => no.name));
    for (const nome of [
      'Quando Chamado',
      'Normalizar Entrada',
      'Texto de Alerta?',
      'Enviar Texto de Alerta',
      'Pular Classificador?',
      'Buscar Contexto',
      'Classificar Pedido',
      'Ler Classificação',
      'Subiu para Alerta?',
      'É Não Lead?',
      'Marcar Não Lead',
      'Avisar a Equipe?',
      'Registrar Handoff',
      'Registro OK?',
      'Redis Marcar Pausa',
      'Duplicado?',
      'Notificar Grupo',
      'Avisar Plantão',
      'Registrar Notificação',
      'Retorno',
    ]) {
      assert.ok(nomes.has(nome), `falta o nó "${nome}"`);
    }
  });

  test('passa por todos os verificadores estruturais do 19.5', async () => {
    const resultado = executarTodosOsValidadoresEstruturais(await fluxo2());
    assert.ok(resultado.ok, resultado.problemas.join(' | '));
  });

  test('gatilho declara as doze entradas do 19.3, na ordem, mais as opcionais', async () => {
    const fluxo = await fluxo2();
    const gatilho = fluxo.nodes.find((no) => no.name === NOS.quandoChamado);
    const nomes = gatilho.parameters.workflowInputs.values.map((v) => v.name);
    assert.deepEqual(nomes.slice(0, 12), [
      'acao',
      'wa_jid',
      'conversa_id',
      'nome',
      'motivo',
      'resumo',
      'solicitacao',
      'dados',
      'texto_familia',
      'chave_texto',
      'enviar_texto',
      'origem_chamada',
    ]);
    assert.deepEqual(nomes, ENTRADAS.map((e) => e.name));
  });

  test('o texto de alerta só é alcançado pela saída verdadeira do "Texto de Alerta?"', async () => {
    const fluxo = await fluxo2();
    assert.deepEqual(predecessores(fluxo, NOS.buscarTextoAlerta), [{ origem: NOS.textoDeAlerta, saida: 0 }]);
    const semPortao = alcancaveis(fluxo, NOS.quandoChamado, new Set([NOS.textoDeAlerta]));
    assert.ok(!semPortao.has(NOS.enviarTextoAlerta), 'existe caminho até o envio sem passar pelo "Texto de Alerta?"');
  });

  test('nó 8a volta ao nó 3 e nunca chega ao registro sem passar por ele', async () => {
    const fluxo = await fluxo2();
    assert.deepEqual(fluxo.connections[NOS.subirParaAlerta].main, [[{ node: NOS.textoDeAlerta, type: 'main', index: 0 }]]);
    const semPortao = alcancaveis(fluxo, NOS.subirParaAlerta, new Set([NOS.textoDeAlerta]));
    assert.ok(!semPortao.has(NOS.registrarHandoff));
  });

  test('grupo de reserva só é alcançado pelo ramo de falha do "Registro OK?"', async () => {
    const fluxo = await fluxo2();
    assert.deepEqual(predecessores(fluxo, NOS.precisaGrupoReserva), [{ origem: NOS.registroOk, saida: 1 }]);
    assert.deepEqual(predecessores(fluxo, NOS.avisarGrupoReserva), [{ origem: NOS.montarAvisoReserva, saida: 0 }]);
  });

  test('nenhum texto para família ou equipe no fluxo, fora o aviso de reserva do config', async () => {
    const config = await configExemplo();
    const fluxo = gerarFluxos(config, 'hml').fluxo2;
    const semPrompt = fluxo.nodes.filter((no) => no.name !== NOS.montarPrompt && no.name !== NOS.montarAvisoReserva);
    const texto = JSON.stringify(semPrompt);
    for (const trecho of [
      'SAMU',
      'Sinto muito',
      'PRIORIDADE MÁXIMA',
      'A equipe foi avisada',
      'nenhuma mensagem saiu',
      'NÃO REGISTRADO',
      'ATUALIZAÇÃO',
      'Responda só [SILENCIO]',
    ]) {
      assert.ok(!texto.includes(trecho), `texto "${trecho}" dentro do fluxo`);
    }
    const reserva = fluxo.nodes.find((no) => no.name === NOS.montarAvisoReserva);
    assert.ok(reserva.parameters.jsCode.includes(JSON.stringify(config.grupoFallbackTexto)));
    assert.ok(reserva.parameters.jsCode.includes(JSON.stringify(config.grupoFallbackJid)));
  });

  test('prompt do classificador vem de n8n/prompts entre as marcas, com as variáveis trocadas por expressão', async () => {
    const fluxo = await fluxo2();
    const prompt = extrairPrompt(await readFile(path.join(AQUI, 'prompts/classificar-pedido.md'), 'utf8'));
    const valor = fluxo.nodes.find((no) => no.name === NOS.montarPrompt).parameters.assignments.assignments[0].value;
    assert.ok(valor.startsWith('='));
    const renderizado = avaliarParametro(valor, {
      $json: { pedido_atual: 'P', contexto_texto: 'C', motivo_agente: 'M', resumo_agente: 'R', iniciada_por: 'I' },
      $: () => {
        throw new Error('sem referência a outro nó');
      },
      $input: {},
    });
    const esperado = prompt
      .replace('{{pedido_atual}}', 'P')
      .replace('{{contexto}}', 'C')
      .replace('{{motivo_agente}}', 'M')
      .replace('{{resumo_agente}}', 'R')
      .replace('{{iniciada_por}}', 'I');
    assert.equal(renderizado, esperado);
  });

  test('modelo e temperatura do classificador vêm do config; sem aceitaTemperatura, sem temperature', async () => {
    const config = await configExemplo();
    const semTemperatura = structuredClone(config);
    semTemperatura.modelos.classificadores.aceitaTemperatura = false;
    semTemperatura.modelos.classificadores.modelo = 'modelo-de-teste';
    const corpo = montarFluxo(semTemperatura).nodes.find((no) => no.name === NOS.classificarPedido).parameters.jsonBody;
    assert.ok(!corpo.includes('temperature'));
    assert.ok(corpo.includes('"modelo-de-teste"'));
    const comTemperatura = montarFluxo(config).nodes.find((no) => no.name === NOS.classificarPedido).parameters.jsonBody;
    assert.ok(comTemperatura.includes('temperature: 0'));
  });

  test('regras do "Pular Classificador?" e do "Ler Classificação" embutidas a partir de n8n/src/code', async () => {
    const fluxo = await fluxo2();
    const codigo = (nome) => fluxo.nodes.find((no) => no.name === nome).parameters.jsCode;
    assert.ok(codigo(NOS.normalizarEntrada).includes('function pularClassificador('));
    assert.ok(codigo(NOS.lerClassificacao).includes('function lerClassificacaoPedido('));
    const fonte = await readFile(path.join(AQUI, 'src/code/pular-classificador.js'), 'utf8');
    const corpoFuncao = fonte.slice(fonte.indexOf('function pularClassificador('));
    assert.ok(codigo(NOS.normalizarEntrada).includes(corpoFuncao.trim()), 'corpo da função igual ao arquivo fonte');
  });

  test('credenciais só por id e nome do config; UAZAPI por Header Auth, OpenAI pela credencial própria', async () => {
    // [P25] Com envio real (envioSimulado desligado), o envio usa a
    // credencial Header Auth da UAZAPI.
    const config = structuredClone(await configExemplo());
    config.homologacao.envioSimulado = false;
    const fluxo = gerarFluxos(config, 'hml').fluxo2;
    for (const no of fluxo.nodes) {
      if (no.type === 'n8n-nodes-base.postgres') assert.deepEqual(no.credentials, { postgres: config.credenciais.postgres });
      if (no.type === 'n8n-nodes-base.redis') assert.deepEqual(no.credentials, { redis: config.credenciais.redis });
      if (no.type === 'n8n-nodes-base.httpRequest' && no.parameters.url.includes('/send/text')) {
        assert.ok(no.parameters.url.startsWith(config.uazapi.urlBase));
        assert.equal(no.parameters.authentication, 'genericCredentialType');
        assert.equal(no.parameters.genericAuthType, 'httpHeaderAuth');
        assert.deepEqual(no.credentials, { httpHeaderAuth: config.credenciais.uazapi });
      }
      if (no.name === NOS.classificarPedido) assert.deepEqual(no.credentials, { openAiApi: config.credenciais.openai });
    }
  });

  test('[P25] com envioSimulado, todo envio vai para a rota de captura, sem credencial da UAZAPI', async () => {
    const config = await configExemplo();
    assert.equal(config.homologacao.envioSimulado, true);
    const fluxo = gerarFluxos(config, 'hml').fluxo2;
    const envios = fluxo.nodes.filter((no) => no.type === 'n8n-nodes-base.httpRequest' && no.parameters.url.includes('/send/'));
    assert.ok(envios.length >= 4);
    for (const no of envios) {
      assert.equal(no.parameters.url, `${config.homologacao.urlCaptura}/send/text`, no.name);
      assert.equal(no.parameters.authentication, 'none', no.name);
      assert.equal(no.credentials, undefined, no.name);
      assert.ok(no.parameters.jsonBody.includes('track_source'), no.name);
    }
  });

  test('[P25] prioridade_minima opcional só sobe a prioridade do motivo, nunca baixa', () => {
    assert.equal(normalizarEntradaHandoff(entrada({ motivo: 'outro', origem_chamada: 'sistema', prioridade_minima: 'alta' })).prioridade_minima, 'alta');
    assert.equal(normalizarEntradaHandoff(entrada({ motivo: 'reuniao', prioridade_minima: 'normal' })).prioridade_minima, 'alta');
    assert.equal(normalizarEntradaHandoff(entrada({ motivo: 'outro', prioridade_minima: 'inventada' })).prioridade_minima, 'normal');
  });

  test('id do fluxo 2 é estável e é o mesmo que config.example.json anota para o fluxo 3', async () => {
    const config = await configExemplo();
    assert.equal((await fluxo2()).id, config.fluxo.idFluxo2);
  });

  test('aviso ao plantão sai em lote', async () => {
    const fluxo = await fluxo2();
    const plantao = fluxo.nodes.find((no) => no.name === NOS.avisarPlantao);
    assert.ok(plantao.parameters.options.batching.batch.batchSize >= 1);
  });
});
