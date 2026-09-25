// Fluxo 1: Ingestão RAG (PRD 19.2, P26). Indexa só o conteúdo aprovado da
// base de conhecimento no PGVector, sem deixar a base vazia durante a
// reindexação: o lote novo entra por inteiro antes de qualquer documento do
// lote anterior ser removido (troca atômica, nós 9 a 11).
//
// Os três gatilhos (manual, a cada 6h, webhook de reindexação com segredo no
// caminho) convergem no nó 4 "Novo Lote", que gera um `lote_id` novo por
// execução. Nenhum nó Postgres qualifica nem transforma texto: os textos que
// entram na base vêm de `agente.base_para_indexar()`, nunca do fluxo (PRD
// 19.1).
//
// Nenhum conteúdo clínico entra na base (protocolos, sinais de alerta,
// condutas): quem decide o que fica aprovado é a tela de base de
// conhecimento (P27), não este fluxo.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { criarNotaCabecalho } from './lib/no.mjs';
import { aplicarConfiguracoesFluxo } from './lib/settings.mjs';
import { idEstavel } from './lib/id-estavel.mjs';
import { criarConstrutor, credencialDoConfig } from './lib/construtor.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_CODE = path.join(AQUI, 'code');

export const FLUXO_CHAVE = 'kraamzorg-fluxo-1-ingestao-rag';
export const NOME_FLUXO = 'Kraamzorg · Ingestão RAG (Base de Conhecimento)';

// Nomes dos nós, num lugar só: os testes usam os mesmos. Nomes exatamente
// como o PRD 19.2 lista, mais os nós "Ler ..."/"...?" que juntam o estado do
// fluxo com o resultado da chamada anterior (mesma convenção do fluxo 3:
// Postgres, Data Loader e vectorStorePGVector trocam o item pela resposta).
export const NOS = {
  rodarManualmente: 'Rodar Manualmente',
  aCada6h: 'A Cada 6h',
  webhookReindexar: 'Webhook Reindexar',
  novoLote: 'Novo Lote',
  buscarBaseAprovada: 'Buscar Base Aprovada',
  montarDocumentos: 'Montar Documentos',
  temDocumento: 'Tem Documento?',
  nadaAIndexar: 'Nada a Indexar',
  indexarNoPGVector: 'Indexar no PGVector',
  dataLoader: 'Data Loader',
  divisorDeTexto: 'Divisor de Texto',
  embeddings: 'Embeddings text-3-small',
  lerIndexacao: 'Ler Indexação',
  indexacaoOk: 'Indexação OK?',
  promoverLote: 'Promover Lote',
  lerPromocao: 'Ler Promoção',
  promocaoOk: 'Promoção OK?',
  falhaDoLote: 'Falha do Lote',
  registrarExecucao: 'Registrar Execução',
  descartarLote: 'Descartar Lote',
  registrarFalha: 'Registrar Falha',
};

const EXPR_LOTE = `$(${JSON.stringify(NOS.novoLote)}).item.json.lote_id`;
const EXPR_PROMOCAO = (campo) => `$(${JSON.stringify(NOS.lerPromocao)}).item.json.${campo}`;
const EXPR_FALHA = (campo) => `$(${JSON.stringify(NOS.falhaDoLote)}).item.json.${campo}`;

export function montarFluxo(config) {
  const fluxoChave = FLUXO_CHAVE;
  const c = criarConstrutor({ fluxoChave, config, dirCode: DIR_CODE });
  const { ligar, ligarIA, no, code, se, postgres } = c;

  c.adicionar(
    criarNotaCabecalho({
      fluxoChave,
      config,
      titulo: NOME_FLUXO,
      descricao:
        'Indexa só o conteúdo aprovado da base de conhecimento no PGVector, sem deixar a base vazia durante a reindexação (PRD 19.2). Troca atômica: o lote novo entra por inteiro (nó 9) antes de qualquer documento do lote anterior sair; falha no meio descarta o lote parcial (nó 11) e a base anterior continua valendo.',
      posicao: [-1600, -240],
    }),
  );

  // --- Gatilhos (1 a 3) ------------------------------------------------

  no('manualTrigger', NOS.rodarManualmente, {}, [-1600, 0]);
  no('scheduleTrigger', NOS.aCada6h, { rule: { interval: [{ field: 'hours', hoursInterval: 6 }] } }, [-1600, 160]);
  no(
    'webhook',
    NOS.webhookReindexar,
    {
      httpMethod: 'POST',
      path: config.webhooks.fluxo1Reindexar,
      authentication: 'none',
      responseMode: 'onReceived',
      options: {},
    },
    [-1600, 320],
    { webhookId: idEstavel(`${fluxoChave}:webhookId:${NOS.webhookReindexar}`) },
  );

  // --- 4. Novo Lote ------------------------------------------------------

  code(NOS.novoLote, 'ingestao-rag.js', 'return { json: novoLote() };', [-1380, 160]);

  // --- 5. Buscar Base Aprovada --------------------------------------------

  postgres(NOS.buscarBaseAprovada, 'select * from agente.base_para_indexar()', [], [-1160, 160]);

  // --- 6. Montar Documentos -----------------------------------------------

  code(
    NOS.montarDocumentos,
    'ingestao-rag.js',
    `return montarDocumentos(${EXPR_LOTE}, $input.all().map((item) => item.json)).map((documento) => ({ json: documento }));`,
    [-940, 160],
    { modo: 'runOnceForAllItems' },
  );

  // --- 7. Tem Documento? ---------------------------------------------------

  se(NOS.temDocumento, '$json.tem_documento === true', [-720, 160]);

  code(NOS.nadaAIndexar, 'ingestao-rag.js', `return { json: nadaAIndexar(${EXPR_LOTE}) };`, [-500, 320]);

  // --- 8. Indexar no PGVector, com Data Loader (8a) e Embeddings (8b) -----

  no(
    'vectorStorePGVector',
    NOS.indexarNoPGVector,
    {
      mode: 'insert',
      tableName: 'documentos',
      embeddingBatchSize: 200,
      options: {
        columnNames: {
          values: { idColumnName: 'id', vectorColumnName: 'embedding', contentColumnName: 'text', metadataColumnName: 'metadata' },
        },
        collection: { values: { useCollection: false, collectionName: 'n8n', collectionTableName: 'n8n_vector_collections' } },
      },
    },
    [-500, 40],
    { credentials: { postgres: credencialDoConfig(config, 'postgres') }, onError: 'continueRegularOutput', alwaysOutputData: true },
  );

  // Modo personalizado (custom) com divisor de 2.000 caracteres, para cada
  // item (até 1.500) virar um documento só: o modo simples fatiaria a cada
  // 1.000, sem expor o tamanho como parâmetro (n8n/referencia/README.md).
  no(
    'documentDefaultDataLoader',
    NOS.dataLoader,
    {
      dataType: 'json',
      jsonMode: 'expressionData',
      jsonData: '={{ $json.texto }}',
      textSplittingMode: 'custom',
      options: {
        metadata: {
          values: [
            { name: 'tipo', value: '={{ $json.tipo }}' },
            { name: 'fonte_id', value: '={{ $json.fonte_id }}' },
            { name: 'titulo', value: '={{ $json.titulo }}' },
            { name: 'pagina_pdf', value: '={{ $json.pagina_pdf }}' },
            { name: 'lote_id', value: '={{ $json.lote_id }}' },
          ],
        },
      },
    },
    [-720, -140],
  );
  no('textSplitterRecursiveCharacterTextSplitter', NOS.divisorDeTexto, { chunkSize: 2000, chunkOverlap: 0, options: {} }, [-940, -260]);
  no(
    'embeddingsOpenAi',
    NOS.embeddings,
    { model: config.modelos.embeddings.modelo, options: {} },
    [-500, -260],
    { credentials: { openAiApi: credencialDoConfig(config, 'openai') } },
  );

  // --- Ler Indexação / Indexação OK? --------------------------------------

  code(
    NOS.lerIndexacao,
    'ingestao-rag.js',
    `return [{ json: conferirIndexacao($input.all().map((item) => item.json), ${EXPR_LOTE}) }];`,
    [-280, 40],
    { modo: 'runOnceForAllItems' },
  );
  se(NOS.indexacaoOk, '$json.indexado === true', [-60, 40]);

  // --- 9 e 10. Promover Lote e Registrar Execução -------------------------
  // O retorno do nó 9 também é conferido ("Ler Promoção"): sem `ok` do banco
  // o lote novo é descartado e a execução fica registrada como `falhou`.

  postgres(NOS.promoverLote, 'select agente.promover_lote($1) as resultado', [EXPR_LOTE], [160, -80], { executeOnce: true });
  code(
    NOS.lerPromocao,
    'ingestao-rag.js',
    `return { json: conferirPromocao($(${JSON.stringify(NOS.lerIndexacao)}).item.json, $json) };`,
    [380, -80],
  );
  se(NOS.promocaoOk, '$json.promovido === true', [600, -80]);
  postgres(
    NOS.registrarExecucao,
    'select agente.registrar_ingestao($1, $2, $3, $4) as resultado',
    [EXPR_PROMOCAO('lote_id'), EXPR_PROMOCAO('total_documentos'), "'ok'", 'null'],
    [820, -160],
  );

  // --- 11. Descartar Lote e Registrar Falha (falha do nó 8 ou do nó 9) ---

  code(NOS.falhaDoLote, 'ingestao-rag.js', 'return { json: falhaDoLote($json) };', [820, 200]);
  postgres(NOS.descartarLote, 'select agente.descartar_lote($1) as resultado', [EXPR_FALHA('lote_id')], [1040, 200]);
  postgres(
    NOS.registrarFalha,
    'select agente.registrar_ingestao($1, $2, $3, $4) as resultado',
    [EXPR_FALHA('lote_id'), EXPR_FALHA('total_documentos'), "'falhou'", EXPR_FALHA('erro')],
    [1260, 200],
  );

  // --- Conexões ------------------------------------------------------------

  ligar(NOS.rodarManualmente, NOS.novoLote);
  ligar(NOS.aCada6h, NOS.novoLote);
  ligar(NOS.webhookReindexar, NOS.novoLote);

  ligar(NOS.novoLote, NOS.buscarBaseAprovada);
  ligar(NOS.buscarBaseAprovada, NOS.montarDocumentos);
  ligar(NOS.montarDocumentos, NOS.temDocumento);
  ligar(NOS.temDocumento, NOS.indexarNoPGVector, 0);
  ligar(NOS.temDocumento, NOS.nadaAIndexar, 1);

  ligarIA(NOS.divisorDeTexto, NOS.dataLoader, 'ai_textSplitter');
  ligarIA(NOS.dataLoader, NOS.indexarNoPGVector, 'ai_document');
  ligarIA(NOS.embeddings, NOS.indexarNoPGVector, 'ai_embedding');

  ligar(NOS.indexarNoPGVector, NOS.lerIndexacao);
  ligar(NOS.lerIndexacao, NOS.indexacaoOk);
  ligar(NOS.indexacaoOk, NOS.promoverLote, 0);
  ligar(NOS.indexacaoOk, NOS.falhaDoLote, 1);
  ligar(NOS.promoverLote, NOS.lerPromocao);
  ligar(NOS.lerPromocao, NOS.promocaoOk);
  ligar(NOS.promocaoOk, NOS.registrarExecucao, 0);
  ligar(NOS.promocaoOk, NOS.falhaDoLote, 1);
  ligar(NOS.falhaDoLote, NOS.descartarLote);
  ligar(NOS.descartarLote, NOS.registrarFalha);

  return {
    id: idEstavel(fluxoChave),
    name: NOME_FLUXO,
    nodes: c.nos,
    connections: c.conexoes,
    settings: aplicarConfiguracoesFluxo(config),
  };
}
