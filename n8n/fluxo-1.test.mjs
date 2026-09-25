// Testes do fluxo 1 "Ingestão RAG" (PRD 19.2, P26). Duas camadas:
// 1. As funções puras de `n8n/src/code/ingestao-rag.js`, importadas direto.
// 2. Os três cenários do 19.2 (documento indexado, nada a indexar, falha no
//    meio) rodando o JSON gerado pelo build no simulador
//    (`src/lib/simulador.mjs`): os nós Code executam o código embutido de
//    verdade; Postgres e o vectorStorePGVector são serviços falsos em
//    memória. O que eles devolvem é fixture de teste, nunca texto do fluxo
//    (este fluxo não manda nenhum texto à família nem à equipe).
//
// Roda junto com `node --test n8n/build.test.mjs` (importado no fim dele) ou
// sozinho: `node --test n8n/fluxo-1.test.mjs`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gerarFluxos } from './build.mjs';
import { carregarConfig } from './src/lib/config.mjs';
import { simularFluxo, erroNoInteiro } from './src/lib/simulador.mjs';
import { executarTodosOsValidadoresEstruturais, alcancaveis } from './src/lib/validadores.mjs';
import { NOS } from './src/fluxo-1-ingestao-rag.mjs';

import {
  novoLote,
  uuidV4,
  montarDocumentos,
  conferirIndexacao,
  conferirPromocao,
  falhaDoLote,
  nadaAIndexar,
} from './src/code/ingestao-rag.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

async function configExemplo() {
  const { config } = await carregarConfig('hml', AQUI, { log: () => {} });
  return config;
}

async function fluxo1() {
  return gerarFluxos(await configExemplo(), 'hml').fluxo1;
}

function predecessores(fluxo, nome) {
  const lista = [];
  for (const [origem, porTipo] of Object.entries(fluxo.connections)) {
    (porTipo.main ?? []).forEach((saida, indice) => {
      for (const destino of saida ?? []) if (destino.node === nome) lista.push({ origem, saida: indice });
    });
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Funções puras.
// ---------------------------------------------------------------------------

describe('fluxo 1 · Novo Lote (função pura)', () => {
  test('gera lote_id a partir do gerador injetado', () => {
    assert.deepEqual(novoLote(() => 'lote-fixo'), { lote_id: 'lote-fixo' });
  });

  test('sem gerador, devolve um uuid v4', () => {
    const { lote_id: loteId } = novoLote();
    assert.match(loteId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('sem `crypto` no sandbox do nó Code (n8n 2.40.6), o uuid v4 sai do gerador de números', () => {
    let semente = 0;
    const aleatorio = () => {
      semente = (semente * 9301 + 49297) % 233280;
      return semente / 233280;
    };
    const id = uuidV4(aleatorio);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.notEqual(uuidV4(aleatorio), id);
  });

  test('o código embutido no "Novo Lote" roda sem `crypto` global', async () => {
    const fluxo = await fluxo1();
    const jsCode = fluxo.nodes.find((no) => no.name === NOS.novoLote).parameters.jsCode;
    const rodar = new Function('crypto', 'globalThis', `${jsCode}`);
    const saida = rodar(undefined, {});
    assert.match(saida.json.lote_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe('fluxo 1 · Montar Documentos (função pura)', () => {
  test('anexa lote_id e mantém os campos que o Data Loader espera', () => {
    const documentos = montarDocumentos('lote-1', [
      { tipo: 'conhecimento', fonte_id: 'fc-001', titulo: 'Como funciona', texto: 'A Kraamzorg cuida...', pagina_pdf: null },
    ]);
    assert.deepEqual(documentos, [
      {
        tipo: 'conhecimento',
        fonte_id: 'fc-001',
        titulo: 'Como funciona',
        texto: 'A Kraamzorg cuida...',
        pagina_pdf: null,
        lote_id: 'lote-1',
        tem_documento: true,
      },
    ]);
  });

  test('descarta linha sem tipo, sem fonte_id ou sem texto', () => {
    const documentos = montarDocumentos('lote-1', [
      { tipo: '', fonte_id: 'x', texto: 'algo' },
      { tipo: 'plano', fonte_id: '', texto: 'algo' },
      { tipo: 'plano', fonte_id: 'essencial', texto: '   ' },
      { tipo: 'plano', fonte_id: 'essencial', texto: 'Plano Essencial' },
    ]);
    assert.equal(documentos.length, 1);
    assert.equal(documentos[0].fonte_id, 'essencial');
  });

  test('descarta duplicata por tipo + fonte_id, mantém a primeira', () => {
    const documentos = montarDocumentos('lote-1', [
      { tipo: 'praca', fonte_id: 'sp', titulo: 'primeira', texto: 'A' },
      { tipo: 'praca', fonte_id: 'sp', titulo: 'segunda', texto: 'B' },
    ]);
    assert.equal(documentos.length, 1);
    assert.equal(documentos[0].titulo, 'primeira');
  });

  test('linha que já veio como erro do banco é descartada, não vira documento', () => {
    const documentos = montarDocumentos('lote-1', [{ error: { message: 'falhou' } }]);
    assert.equal(documentos.length, 1);
    assert.equal(documentos[0].tem_documento, false);
  });

  test('sem nenhuma linha válida, devolve um item único com tem_documento false', () => {
    assert.deepEqual(montarDocumentos('lote-1', []), [{ lote_id: 'lote-1', tem_documento: false }]);
    assert.deepEqual(montarDocumentos('lote-1', null), [{ lote_id: 'lote-1', tem_documento: false }]);
  });
});

const doc = (loteId, texto = 'x') => ({ pageContent: texto, metadata: { lote_id: loteId, tipo: 'faq' } });

describe('fluxo 1 · conferirIndexacao, conferirPromocao e nadaAIndexar (funções puras)', () => {
  test('todos os documentos gravados com o lote certo: indexado true, com a contagem', () => {
    const estado = conferirIndexacao([doc('lote-1'), doc('lote-1')], 'lote-1');
    assert.deepEqual(estado, { lote_id: 'lote-1', indexado: true, total_documentos: 2, erro: null });
  });

  test('um item com erro: indexado false, com a mensagem', () => {
    const estado = conferirIndexacao([doc('lote-1'), { error: { message: 'sem espaço' } }], 'lote-1');
    assert.equal(estado.indexado, false);
    assert.equal(estado.erro, 'sem espaço');
    assert.equal(estado.total_documentos, 2);
  });

  test('nó inteiro falhou (o n8n repassa os itens de entrada): indexado false, nunca promove', () => {
    const entrada = [
      { tipo: 'faq', fonte_id: 'a', texto: 'A', lote_id: 'lote-1', tem_documento: true },
      { tipo: 'faq', fonte_id: 'b', texto: 'B', lote_id: 'lote-1', tem_documento: true },
    ];
    const estado = conferirIndexacao(entrada, 'lote-1');
    assert.equal(estado.indexado, false);
    assert.match(estado.erro, /não confirmou/);
  });

  test('documento de outro lote na saída: indexado false', () => {
    assert.equal(conferirIndexacao([doc('lote-1'), doc('lote-0')], 'lote-1').indexado, false);
  });

  test('lista vazia: indexado false (nada foi indexado)', () => {
    assert.equal(conferirIndexacao([], 'lote-1').indexado, false);
  });

  test('conferirPromocao: só `ok` verdadeiro do banco promove', () => {
    const estado = { lote_id: 'lote-1', total_documentos: 3, indexado: true, erro: null };
    assert.deepEqual(conferirPromocao(estado, { resultado: { ok: true } }), {
      lote_id: 'lote-1',
      total_documentos: 3,
      promovido: true,
      erro: null,
    });
    assert.equal(conferirPromocao(estado, { resultado: '{"ok":true}' }).promovido, true);
    assert.equal(conferirPromocao(estado, { error: { message: 'deadlock' } }).erro, 'deadlock');
    assert.equal(conferirPromocao(estado, { resultado: { ok: false, erro: 'lote vazio' } }).erro, 'lote vazio');
    // Nó inteiro falhou: o n8n repassa o item de entrada, sem `resultado`.
    assert.equal(conferirPromocao(estado, { ...estado }).promovido, false);
  });

  test('falhaDoLote deixa só lote, contagem e erro', () => {
    assert.deepEqual(falhaDoLote({ lote_id: 'lote-1', total_documentos: 2, indexado: false, erro: 'x', outro: 1 }), {
      lote_id: 'lote-1',
      total_documentos: 2,
      erro: 'x',
    });
    assert.equal(falhaDoLote({ lote_id: 'lote-1' }).erro, 'falha sem detalhe');
  });

  test('nadaAIndexar devolve estado terminal, sem indexar nada', () => {
    assert.deepEqual(nadaAIndexar('lote-1'), {
      lote_id: 'lote-1',
      indexado: false,
      total_documentos: 0,
      motivo: 'sem_documento_aprovado',
    });
  });
});

// ---------------------------------------------------------------------------
// Cenários do 19.2 no JSON gerado, via simulador.
// ---------------------------------------------------------------------------

const LINHAS_BASE = [
  { tipo: 'conhecimento', fonte_id: 'fc-001', titulo: 'Como funciona', texto: 'A Kraamzorg acompanha a família por dias consecutivos.', pagina_pdf: null },
  { tipo: 'plano', fonte_id: 'essencial', titulo: 'Essencial', texto: 'Plano Essencial: 6 dias, 3 horas por visita.', pagina_pdf: 11 },
  { tipo: 'praca', fonte_id: 'sao-paulo', titulo: 'São Paulo', texto: 'Atendemos São Paulo capital, sem taxa.', pagina_pdf: null },
];

describe('fluxo 1 · cenários do P26 (JSON gerado no simulador)', () => {
  test('documento aprovado: indexa, promove o lote e registra a execução como ok', async () => {
    const fluxo = await fluxo1();
    const chamadas = { registrarExecucao: [], promoverLote: [], indexar: [] };
    const servicos = {
      [NOS.buscarBaseAprovada]: () => LINHAS_BASE,
      [NOS.indexarNoPGVector]: (parametros, itemJson) => {
        chamadas.indexar.push(itemJson);
        return { pageContent: itemJson.texto, metadata: { tipo: itemJson.tipo, fonte_id: itemJson.fonte_id, lote_id: itemJson.lote_id } };
      },
      [NOS.promoverLote]: (parametros) => {
        chamadas.promoverLote.push(parametros);
        return { resultado: { ok: true } };
      },
      [NOS.registrarExecucao]: (parametros) => {
        chamadas.registrarExecucao.push(parametros);
        return { resultado: { ok: true } };
      },
      [NOS.descartarLote]: () => {
        throw new Error('não deveria descartar quando a indexação deu certo');
      },
      [NOS.registrarFalha]: () => {
        throw new Error('não deveria registrar falha quando a indexação deu certo');
      },
    };

    const resultado = simularFluxo(fluxo, { entrada: {}, servicos, gatilho: NOS.rodarManualmente });

    assert.equal(resultado.rodou(NOS.indexarNoPGVector), true);
    assert.equal(chamadas.indexar.length, 3, 'os três documentos aprovados deveriam ir ao PGVector');
    assert.equal(resultado.rodou(NOS.promoverLote), true);
    assert.equal(resultado.rodou(NOS.registrarExecucao), true);
    assert.equal(resultado.rodou(NOS.descartarLote), false);
    assert.equal(resultado.rodou(NOS.nadaAIndexar), false);

    const loteId = resultado.saidaDe(NOS.novoLote)[0].lote_id;
    assert.deepEqual(chamadas.promoverLote[0].options.queryReplacement, [loteId]);
    assert.deepEqual(chamadas.registrarExecucao[0].options.queryReplacement, [loteId, 3, 'ok', null]);
  });

  test('sem item aprovado: não chama o PGVector, cai em "Nada a Indexar" e a base anterior não é tocada', async () => {
    const fluxo = await fluxo1();
    const servicos = {
      [NOS.buscarBaseAprovada]: () => [],
      [NOS.indexarNoPGVector]: () => {
        throw new Error('não deveria indexar sem documento aprovado');
      },
      [NOS.promoverLote]: () => {
        throw new Error('não deveria promover lote vazio');
      },
      [NOS.descartarLote]: () => {
        throw new Error('não há lote para descartar quando não havia documento');
      },
    };

    const resultado = simularFluxo(fluxo, { entrada: {}, servicos, gatilho: NOS.aCada6h });

    assert.equal(resultado.rodou(NOS.indexarNoPGVector), false);
    assert.equal(resultado.rodou(NOS.nadaAIndexar), true);
    assert.equal(resultado.saidaDe(NOS.nadaAIndexar)[0].indexado, false);
  });

  test('falha no meio da indexação: descarta o lote parcial, registra falhou e não promove nada', async () => {
    const fluxo = await fluxo1();
    const chamadas = { descartarLote: [], registrarFalha: [] };
    const servicos = {
      [NOS.buscarBaseAprovada]: () => LINHAS_BASE,
      [NOS.indexarNoPGVector]: (parametros, itemJson) => {
        if (itemJson.tipo === 'plano') throw new Error('embedding indisponível');
        return { pageContent: itemJson.texto, metadata: { lote_id: itemJson.lote_id } };
      },
      [NOS.promoverLote]: () => {
        throw new Error('não deveria promover um lote que falhou');
      },
      [NOS.descartarLote]: (parametros) => {
        chamadas.descartarLote.push(parametros);
        return { resultado: { ok: true } };
      },
      [NOS.registrarFalha]: (parametros) => {
        chamadas.registrarFalha.push(parametros);
        return { resultado: { ok: true } };
      },
    };

    const resultado = simularFluxo(fluxo, { entrada: {}, servicos, gatilho: NOS.webhookReindexar });

    assert.equal(resultado.rodou(NOS.promoverLote), false);
    assert.equal(resultado.rodou(NOS.registrarExecucao), false);
    assert.equal(resultado.rodou(NOS.descartarLote), true);
    assert.equal(resultado.rodou(NOS.registrarFalha), true);

    const loteId = resultado.saidaDe(NOS.novoLote)[0].lote_id;
    assert.deepEqual(chamadas.descartarLote[0].options.queryReplacement, [loteId]);
    assert.deepEqual(chamadas.registrarFalha[0].options.queryReplacement, [loteId, 3, 'falhou', 'embedding indisponível']);
  });
});

describe('fluxo 1 · falhas que o n8n de verdade produz (nó inteiro e promoção)', () => {
  test('PGVector falha inteiro (o n8n repassa os documentos de entrada): descarta, registra falhou e não promove', async () => {
    const fluxo = await fluxo1();
    const chamadas = { descartarLote: [], registrarFalha: [] };
    const servicos = {
      [NOS.buscarBaseAprovada]: () => LINHAS_BASE,
      [NOS.indexarNoPGVector]: () => {
        throw erroNoInteiro('OpenAI 503 no segundo lote de embeddings');
      },
      [NOS.promoverLote]: () => {
        throw new Error('promover aqui apagaria a base anterior com um lote parcial');
      },
      [NOS.descartarLote]: (parametros) => {
        chamadas.descartarLote.push(parametros);
        return { resultado: { ok: true } };
      },
      [NOS.registrarFalha]: (parametros) => {
        chamadas.registrarFalha.push(parametros);
        return { resultado: { ok: true } };
      },
    };

    const resultado = simularFluxo(fluxo, { entrada: {}, servicos, gatilho: NOS.rodarManualmente });

    assert.equal(resultado.rodou(NOS.promoverLote), false);
    assert.equal(resultado.rodou(NOS.registrarExecucao), false);
    const loteId = resultado.saidaDe(NOS.novoLote)[0].lote_id;
    assert.deepEqual(chamadas.descartarLote[0].options.queryReplacement, [loteId]);
    assert.equal(chamadas.registrarFalha[0].options.queryReplacement[2], 'falhou');
  });

  test('promover_lote falha: o lote novo é descartado e a execução fica "falhou", nunca "ok"', async () => {
    const fluxo = await fluxo1();
    const chamadas = { descartarLote: [], registrarFalha: [] };
    const servicos = {
      [NOS.buscarBaseAprovada]: () => LINHAS_BASE,
      [NOS.indexarNoPGVector]: (parametros, itemJson) => ({ pageContent: itemJson.texto, metadata: { lote_id: itemJson.lote_id } }),
      [NOS.promoverLote]: () => {
        throw new Error('deadlock detected');
      },
      [NOS.registrarExecucao]: () => {
        throw new Error('não deveria registrar ok sem a promoção');
      },
      [NOS.descartarLote]: (parametros) => {
        chamadas.descartarLote.push(parametros);
        return { resultado: { ok: true } };
      },
      [NOS.registrarFalha]: (parametros) => {
        chamadas.registrarFalha.push(parametros);
        return { resultado: { ok: true } };
      },
    };

    const resultado = simularFluxo(fluxo, { entrada: {}, servicos, gatilho: NOS.rodarManualmente });

    assert.equal(resultado.rodou(NOS.promoverLote), true);
    assert.equal(resultado.rodou(NOS.registrarExecucao), false);
    const loteId = resultado.saidaDe(NOS.novoLote)[0].lote_id;
    assert.deepEqual(chamadas.descartarLote[0].options.queryReplacement, [loteId]);
    assert.deepEqual(chamadas.registrarFalha[0].options.queryReplacement, [loteId, 3, 'falhou', 'deadlock detected']);
  });
});

// ---------------------------------------------------------------------------
// Estrutura do fluxo 1 gerado.
// ---------------------------------------------------------------------------

describe('fluxo 1 · estrutura do JSON gerado', () => {
  test('tem os 11 nós do 19.2 (mais 8a e 8b), com os nomes do PRD', async () => {
    const fluxo = await fluxo1();
    const nomes = new Set(fluxo.nodes.map((no) => no.name));
    for (const nome of [
      'Rodar Manualmente',
      'A Cada 6h',
      'Webhook Reindexar',
      'Novo Lote',
      'Buscar Base Aprovada',
      'Montar Documentos',
      'Tem Documento?',
      'Indexar no PGVector',
      'Data Loader',
      'Embeddings text-3-small',
      'Promover Lote',
      'Registrar Execução',
      'Descartar Lote',
      'Registrar Falha',
    ]) {
      assert.ok(nomes.has(nome), `falta o nó "${nome}"`);
    }
  });

  test('passa por todos os verificadores estruturais do 19.5', async () => {
    const resultado = executarTodosOsValidadoresEstruturais(await fluxo1());
    assert.ok(resultado.ok, resultado.problemas.join(' | '));
  });

  test('os três gatilhos convergem só no "Novo Lote"', async () => {
    const fluxo = await fluxo1();
    assert.deepEqual(
      predecessores(fluxo, NOS.novoLote).map((p) => p.origem).sort(),
      [NOS.aCada6h, NOS.rodarManualmente, NOS.webhookReindexar].sort(),
    );
  });

  test('Webhook Reindexar usa o caminho com segredo do config, nunca um valor fixo', async () => {
    const config = await configExemplo();
    const fluxo = gerarFluxos(config, 'hml').fluxo1;
    const webhook = fluxo.nodes.find((no) => no.name === NOS.webhookReindexar);
    assert.equal(webhook.parameters.path, config.webhooks.fluxo1Reindexar);
    assert.equal(webhook.parameters.authentication, 'none');
  });

  test('Data Loader no modo personalizado, com o Divisor de Texto de 2.000 caracteres', async () => {
    const fluxo = await fluxo1();
    const dataLoader = fluxo.nodes.find((no) => no.name === NOS.dataLoader);
    assert.equal(dataLoader.parameters.textSplittingMode, 'custom');
    const divisor = fluxo.nodes.find((no) => no.name === NOS.divisorDeTexto);
    assert.equal(divisor.parameters.chunkSize, 2000);
    assert.deepEqual(fluxo.connections[NOS.divisorDeTexto].ai_textSplitter, [[{ node: NOS.dataLoader, type: 'ai_textSplitter', index: 0 }]]);
    assert.deepEqual(fluxo.connections[NOS.dataLoader].ai_document, [[{ node: NOS.indexarNoPGVector, type: 'ai_document', index: 0 }]]);
    assert.deepEqual(fluxo.connections[NOS.embeddings].ai_embedding, [[{ node: NOS.indexarNoPGVector, type: 'ai_embedding', index: 0 }]]);
  });

  test('documentos de plano não levam valor: o campo não existe na metadata do Data Loader', async () => {
    const fluxo = await fluxo1();
    const dataLoader = fluxo.nodes.find((no) => no.name === NOS.dataLoader);
    const nomesMetadata = dataLoader.parameters.options.metadata.values.map((v) => v.name);
    assert.deepEqual(nomesMetadata.sort(), ['fonte_id', 'lote_id', 'pagina_pdf', 'tipo', 'titulo'].sort());
    assert.ok(!nomesMetadata.includes('valor'));
  });

  test('Indexar no PGVector usa a tabela "documentos", igual ao fluxo 3', async () => {
    const fluxo = await fluxo1();
    const no = fluxo.nodes.find((n) => n.name === NOS.indexarNoPGVector);
    assert.equal(no.parameters.mode, 'insert');
    assert.equal(no.parameters.tableName, 'documentos');
  });

  test('"Tem Documento?" só indexa na saída verdadeira; a falsa vai direto para "Nada a Indexar"', async () => {
    const fluxo = await fluxo1();
    assert.deepEqual(predecessores(fluxo, NOS.indexarNoPGVector), [{ origem: NOS.temDocumento, saida: 0 }]);
    assert.deepEqual(predecessores(fluxo, NOS.nadaAIndexar), [{ origem: NOS.temDocumento, saida: 1 }]);
    const semTemDocumento = alcancaveis(fluxo, NOS.montarDocumentos, new Set([NOS.temDocumento]));
    assert.ok(!semTemDocumento.has(NOS.indexarNoPGVector), 'existe caminho até o índice sem passar pelo "Tem Documento?"');
  });

  test('"Indexação OK?" separa promover (verdadeiro) de descartar (falso); a troca é atômica, nunca os dois', async () => {
    const fluxo = await fluxo1();
    assert.deepEqual(predecessores(fluxo, NOS.promoverLote), [{ origem: NOS.indexacaoOk, saida: 0 }]);
    assert.deepEqual(
      predecessores(fluxo, NOS.falhaDoLote),
      [
        { origem: NOS.indexacaoOk, saida: 1 },
        { origem: NOS.promocaoOk, saida: 1 },
      ],
    );
    assert.deepEqual(predecessores(fluxo, NOS.descartarLote), [{ origem: NOS.falhaDoLote, saida: 0 }]);
  });

  test('"Registrar Execução" (ok) só roda depois de "Promoção OK?" verdadeiro', async () => {
    const fluxo = await fluxo1();
    assert.deepEqual(predecessores(fluxo, NOS.registrarExecucao), [{ origem: NOS.promocaoOk, saida: 0 }]);
    assert.deepEqual(predecessores(fluxo, NOS.promocaoOk), [{ origem: NOS.lerPromocao, saida: 0 }]);
    assert.deepEqual(predecessores(fluxo, NOS.lerPromocao), [{ origem: NOS.promoverLote, saida: 0 }]);
  });

  test('nenhum preço, texto de família ou de equipe dentro do fluxo (nenhum prompt carregado aqui)', async () => {
    const fluxo = await fluxo1();
    const texto = JSON.stringify(fluxo);
    for (const trecho of ['R$', 'Sinto muito', 'PRIORIDADE MÁXIMA', 'mãezinha']) {
      assert.ok(!texto.includes(trecho), `texto "${trecho}" dentro do fluxo`);
    }
  });
});
