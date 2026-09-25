// Mapa curto -> `type` completo do n8n, para os nós usados no capítulo 19 do
// PRD. As versões (`typeVersion`) não moram aqui: vêm de `config.nos` no
// config do ambiente, copiadas de `n8n/referencia/versoes-nos.json` (P23
// item 1: "versão de cada nó tirada de versoes-nos.json").

export const TIPO_NO = {
  webhook: 'n8n-nodes-base.webhook',
  code: 'n8n-nodes-base.code',
  if: 'n8n-nodes-base.if',
  switch: 'n8n-nodes-base.switch',
  set: 'n8n-nodes-base.set',
  httpRequest: 'n8n-nodes-base.httpRequest',
  postgres: 'n8n-nodes-base.postgres',
  postgresTool: 'n8n-nodes-base.postgresTool',
  redis: 'n8n-nodes-base.redis',
  wait: 'n8n-nodes-base.wait',
  splitOut: 'n8n-nodes-base.splitOut',
  splitInBatches: 'n8n-nodes-base.splitInBatches',
  scheduleTrigger: 'n8n-nodes-base.scheduleTrigger',
  manualTrigger: 'n8n-nodes-base.manualTrigger',
  executeWorkflowTrigger: 'n8n-nodes-base.executeWorkflowTrigger',
  executeWorkflow: 'n8n-nodes-base.executeWorkflow',
  stickyNote: 'n8n-nodes-base.stickyNote',
  toolWorkflow: '@n8n/n8n-nodes-langchain.toolWorkflow',
  agent: '@n8n/n8n-nodes-langchain.agent',
  lmChatOpenAi: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  embeddingsOpenAi: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
  vectorStorePGVector: '@n8n/n8n-nodes-langchain.vectorStorePGVector',
  documentDefaultDataLoader: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader',
  textSplitterRecursiveCharacterTextSplitter:
    '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter',
  memoryPostgresChat: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
};

// Chave usada em `config.nos` para buscar a `typeVersion` de cada tipo. É a
// mesma chave de `TIPO_NO` para todos, exceto os dois modos do PGVector, que
// no config compartilham a mesma versão de tipo (1.3) mas em
// `versoes-nos.json` aparecem como duas entradas (`vectorStorePGVectorInsert`
// e `vectorStorePGVectorRetrieveAsTool`) só para documentar parâmetros
// diferentes por modo.
export function chaveVersaoConfig(tipoCurto) {
  if (tipoCurto === 'vectorStorePGVectorInsert' || tipoCurto === 'vectorStorePGVectorRetrieveAsTool') {
    return 'vectorStorePGVector';
  }
  return tipoCurto;
}
