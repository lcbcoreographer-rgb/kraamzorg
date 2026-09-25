Referência de formato de nó para os três fluxos do capítulo 19 do PRD.

Preenchido pelo item 15 do checklist humano (P-1); consumido pelo P23 a P26.

## O que este arquivo é, e o que não é

O item 15 original pedia um fluxo de amostra exportado de uma instância real do n8n (`amostra-nos.json`). Essa instância não existe ainda neste projeto, então em vez de inventar um export (o que criaria uma referência falsa, com riscos de parâmetro errado passando despercebido), este material foi reconstruído a partir do código fonte publicado dos pacotes de nó, sem acesso a nenhuma instância. `versoes-nos.json` é o resultado: para cada tipo de nó usado no capítulo 19, o `type` completo, as versões suportadas, a versão padrão atual, um exemplo mínimo de parâmetros válidos e as conexões de entrada/saída.

Quando a Kraamzorg tiver uma instância de homologação (P-1, item 9 e 10), o ideal é gerar também um `amostra-nos.json` real a partir dela e comparar com este arquivo: a diferença mostra o que este levantamento não capturou (customizações de UI, comportamento de credencial, etc.).

## Método

1. `npm pack` das versões mais recentes estáveis em `registry.npmjs.org` (sem acesso a mais nenhuma rede):
   - `n8n-nodes-base@2.15.1`
   - `@n8n/n8n-nodes-langchain@2.40.3`
   - `n8n-workflow@2.16.0`
   - `n8n@2.40.6` (pacote principal, só para ler a lógica de geração automática dos nós "Tool" a partir de nós comuns, que não mora em `n8n-nodes-base`)
   - `@langchain/community@1.1.27` (dependência do PGVector Store e da Postgres Chat Memory, para achar o SQL exato de `CREATE TABLE`/`CREATE EXTENSION`)
   - `@n8n/ai-utilities@0.33.1` (fábrica genérica `createVectorStoreNode`, usada por todo nó "Vector Store" do n8n, incluindo o PGVector)
2. Extração dos `.tgz` e leitura do `dist/nodes/**/*.node.js` (JS compilado, não TypeScript) de cada nó: `description.name`, `description.version`/`versions`, `description.defaultVersion`, `description.properties` (nomes, tipos, valores padrão, `displayOptions`) e `description.inputs`/`outputs`.
3. Para os dois nós que escrevem schema no banco ao iniciar (PGVector e Postgres Chat Memory), leitura do método que roda o SQL (`ensureTableInDatabase` em `@langchain/community/dist/vectorstores/pgvector.cjs` e `ensureTable` em `@langchain/community/dist/stores/message/postgres.cjs`), para pegar a string de `CREATE TABLE`/`CREATE EXTENSION` literal.
4. Para o `$fromAI`, leitura de `n8n-workflow/dist/cjs/from-ai-parse-utils.js` (a função que faz o parse de `$fromAI(...)` dentro de uma expressão).
5. Para o mecanismo que transforma um nó comum (como o Postgres) em ferramenta de agente (o `postgresTool` do capítulo 19), leitura de `n8n/dist/tool-generation/ai-tools.js`, porque esse código não está em `n8n-nodes-base`.

Nenhum arquivo consultado tem token, URL de projeto real ou id de credencial: são só pacotes públicos do npm.

## Convenção de versão quando o nó não declara `defaultVersion`

Vários nós (Wait, Schedule Trigger, Execute Workflow, Execute Workflow Trigger, Postgres Chat Memory, Vector Store PGVector) declaram um array de versões suportadas mas não um `defaultVersion` explícito no arquivo fonte. Nesses casos, a versão corrente para um nó novo é a maior do array, pela convenção do próprio n8n (`VersionedNodeType.getLatestVersion()`, em `n8n-workflow/dist/cjs/versioned-node-type.js`, usada quando `defaultVersion` não é informado). `versoes-nos.json` marca isso na observação de cada nó em vez de tratar como certeza absoluta, porque não foi possível confirmar contra uma instância real rodando.

## O que cada nó escreve no banco ao iniciar

Dois nós do capítulo 19 criam schema sozinhos na primeira execução, e é por isso que o papel `n8n_agente` precisa de `usage, create` no schema `agente_n8n` (11.10):

**Vector Store PGVector**, em qualquer modo (`insert`, `retrieve`, `retrieve-as-tool`), antes de qualquer operação, roda em sequência:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS <tabela> (
  "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "text" text,
  "metadata" jsonb,
  "embedding" vector
);
```
Os nomes das colunas (`id`, `text`, `metadata`, `embedding`) vêm do campo `options.columnNames`, que tem esses quatro nomes como padrão (podem ser trocados). O tipo da coluna de vetor sai como `vector` sem dimensão fixa, porque a fábrica genérica de vector store do `@n8n/ai-utilities` nunca passa um número de dimensões para esse método, em nenhum dos nós de vector store que a usam. Isso é uma armadilha real: sem dimensão fixa, a Kraamzorg não ganha automaticamente um índice HNSW/IVFFlat de verdade (esses índices em pgvector pedem dimensão conhecida). Se a busca precisar de performance em escala, uma migration própria (fora do build do n8n) tem que alterar a coluna para `vector(1536)` (dimensão do `text-embedding-3-small`) e criar o índice; o n8n sozinho só garante que a tabela existe, nunca otimiza ela.

**Postgres Chat Memory**, em toda leitura ou escrita de mensagem, roda:
```sql
CREATE TABLE IF NOT EXISTS <tabela> (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  message JSONB NOT NULL
);
```
Sem `CREATE EXTENSION`, porque essa tabela não usa pgvector. `session_id` é sempre o valor de `sessionKey` (a chave que o capítulo 19 preenche com o id da conversa).

Os demais nós Postgres do capítulo 19 (`postgres`, `postgresTool`) não criam nada sozinhos: rodam só a função de banco que a query chama, e essa função é responsabilidade da migration do projeto, não do n8n.

## Armadilhas encontradas

**1. `options.queryReplacement` do Postgres muda de comportamento na versão 2.5.** O rótulo na interface ainda diz "lista separada por vírgula" e o placeholder mostra `value1,value2,value3`, mas o código de execução (`executeQuery.operation.js`) só faz esse split simples por vírgula quando `typeVersion < 2.5`. Da 2.5 em diante (a versão padrão atual, 2.6, inclusive), o nó avalia a expressão inteira em `options.queryReplacement` e espera que o resultado já seja um array; se vier uma string, tenta separar por vírgula mesmo assim como fallback. Por isso a convenção do capítulo 19.1 (`{{ [ $json.jid, $json.texto ] }}`, uma expressão que devolve lista, em vez de uma string com vírgulas) não é só estilo, é o jeito correto de não quebrar quando algum valor de conteúdo (como uma mensagem da família) tiver vírgula dentro dele.

**2. O nome do parâmetro muda com o tipo de dado no HTTP Request e no Code.** No HTTP Request, o corpo da requisição vai em `jsonBody` quando `specifyBody = 'json'`, ou em `bodyParameters.parameters[]` quando `specifyBody = 'keypair'`; um build que troca de formato sem trocar o nome do parâmetro simplesmente não envia nada. No Code, o campo do código muda entre `jsCode` (JavaScript) e `pythonCode` (Python nativo, que só funciona com task runner habilitado no servidor n8n, algo a confirmar em homologação).

**3. `postgresTool` não é um nó publicado: é gerado em tempo de execução.** Todo nó com `usableAsTool: true` na sua `description` (o Postgres é um deles) ganha automaticamente, quando o n8n carrega os tipos de nó, uma versão "Tool" com o nome original mais o sufixo `Tool` (`postgres` vira `postgresTool`), `inputs` zerado, `outputs` forçado para `["ai_tool"]`, e um campo novo, `toolDescription`, inserido logo depois da última `callout` das propriedades originais (mais um campo `descriptionType`, auto/manual, quando o nó tem `resource` ou `operation`, que é o caso do Postgres). Consequência prática para o build: a `typeVersion` do `postgresTool` no JSON gerado sempre tem que bater com a `typeVersion` do nó Postgres real que está sendo "convertido" (aqui, 2.6); não existe uma numeração de versão própria para a variante Tool.

**4. O que `$fromAI` aceita, e onde ele não deve entrar.** A assinatura, confirmada no parser (`from-ai-parse-utils.js`), é `$fromAI(chave, descrição?, tipo?, valorPadrão?)`, com `tipo` em `string | number | boolean | json` (padrão `string`) e `valorPadrão` convertido para o tipo pedido. Isso vale para qualquer campo de expressão dentro de uma ferramenta (`postgresTool`, `toolWorkflow`, `httpRequestTool` etc.): o modelo preenche só o que está dentro de um `$fromAI(...)`. O `jid`/`conversa_id`/`wa_jid` de toda ferramenta do capítulo 19 nunca deve vir de `$fromAI`, porque isso deixaria o texto da conversa (potencialmente manipulado por quem escreve) decidir de qual família o agente lê ou grava dados (ver 11.10, "uma mensagem com instrução maliciosa não consegue fazer o agente ler ou alterar a ficha de outra família").

**5. Como referenciar dados de outro nó dentro de uma ferramenta.** Dentro de `postgresTool` ou `toolWorkflow`, um campo que não deve vir do modelo é preenchido com uma expressão n8n normal referenciando o nó de origem por nome, por exemplo `={{ $('Extrair Dados').item.json.jid }}`, e não com `$json.jid` puro (porque dentro de uma sub-execução de ferramenta o "item atual" não é necessariamente o item do nó anterior no fluxo principal). O `workflowInputs` do `toolWorkflow` é um `resourceMapper` (`mappingMode: 'defineBelow'` + objeto `value` chave/valor), diferente do `workflowInputs` do `executeWorkflowTrigger`, que é um `fixedCollection` de `{name, type}`; são conceitos irmãos (declarar as entradas de um sub-fluxo) mas com JSON diferente, não dá para copiar um formato para o outro.

**6. Sim, o Tool Workflow aceita valores fixos por expressão em entradas que o modelo não preenche.** Isso é exatamente o padrão do capítulo 19: cada entrada mapeada em `workflowInputs.value` pode ser um `$fromAI(...)` (o modelo decide) ou uma expressão comum apontando para outro nó (fixo, decidido pelo fluxo). Não existe obrigação de todo campo do `resourceMapper` vir do modelo.

**7. O nome da ferramenta de busca vetorial muda de fonte entre versões.** Até a `typeVersion` 1.2 do PGVector (e de qualquer nó de vector store construído pela mesma fábrica), existe um campo "Name" (`toolName`) para o nome que o modelo vê como função. Da 1.3 em diante (a versão padrão atual) esse campo some da interface e o nome da função passa a ser derivado automaticamente do nome do próprio nó no canvas (sanitizado). Ou seja: renomear o nó `base_conhecimento` no editor muda, sem tocar em nenhum parâmetro, o nome que a Isadora usa para chamar a ferramenta, algo para o `build.mjs` e os testes considerarem se algum dia o nome do nó virar variável.

**8. A pergunta que o modelo manda para o PGVector como ferramenta não passa por `$fromAI`.** No modo `retrieve-as-tool`, o framework já entrega a busca da IA como argumento único de uma função (`query: string`) automaticamente; diferente do `postgresTool` e do `toolWorkflow`, não existe (nem faz sentido) um campo de parâmetro com `$fromAI('query', ...)` dentro do PGVector.

**9. `contextWindowLength` (Postgres Chat Memory) e `topK` (PGVector retrieve) têm defaults menores do que o capítulo 19 pede.** O nó de memória vem com janela de 5 mensagens por padrão; o capítulo 19 pede 30, e isso precisa estar explícito no `parameters.contextWindowLength` do JSON gerado, senão a Isadora "esquece" a conversa rápido demais. O PGVector como ferramenta vem com `topK` padrão 4; o capítulo 11.9 pede 5.

**10. `sessionKey` é o mesmo nome de parâmetro para duas coisas diferentes na Postgres Chat Memory.** A definição do nó declara duas propriedades diferentes com o mesmo `name: 'sessionKey'`, uma visível (e desabilitada para edição) quando `sessionIdType = 'fromInput'` (mostra a expressão que o nó vai usar de qualquer forma, `{{ $json.sessionId }}`), outra editável quando `sessionIdType = 'customKey'` (o caso do capítulo 19, que usa o id da conversa como sessão). No JSON final só uma delas importa de verdade, a de `customKey`, mas um leitor apressado do código pode achar que são a mesma propriedade com o mesmo comportamento nos dois modos; não são.

**11. `options.temperature` no OpenAI Chat Model não é filtrado automaticamente para modelos de raciocínio.** O código do nó (`LmChatOpenAi`, método `supplyData`) sempre repassa `options.temperature` para o cliente da API quando o campo está preenchido, sem checar se o modelo escolhido é da família que recusa esse parâmetro. Isso confirma, no código, a ressalva do capítulo 19.1 ("modelos de raciocínio da família GPT-5 podem recusar `temperature`"): a decisão de incluir ou não `options.temperature` no JSON de um nó `gpt-5.1` tem que vir do arquivo de configuração do build, por ambiente, e ser validada pelo teste de fumaça (P25) contra a conta real, porque o próprio nó não protege contra esse erro. `options.reasoningEffort` (`low`/`medium`/`high`) é o parâmetro certo e separado para controlar esforço em modelo de raciocínio.

**12. `onError`, `alwaysOutputData`, `retryOnFail`, `maxTries`, `waitBetweenTries` e `continueOnFail` não ficam dentro de `parameters`.** São chaves do nó como um todo (tipo `INode` em `n8n-workflow`), no mesmo nível de `type`, `typeVersion`, `name` e `parameters`, nunca dentro do objeto `parameters`. `onError` aceita só três valores: `'continueRegularOutput'`, `'continueErrorOutput'` ou `'stopWorkflow'` (padrão quando ausente). O mesmo vale para as configurações do fluxo inteiro citadas na 19.1 (`executionOrder`, `callerPolicy`, `saveDataSuccessExecution`, `saveDataErrorExecution`, `timezone`): ficam em `settings`, no nível raiz do JSON do workflow, não em nenhum nó. `callerPolicy` aceita `'any' | 'none' | 'workflowsFromAList' | 'workflowsFromSameOwner'`, confirmando o valor usado no capítulo 19.1.

**13. Split In Batches (Loop Over Items) trocou o nome de exibição, mas não o `type`.** O `type` no JSON continua `n8n-nodes-base.splitInBatches` mesmo depois de a interface passar a chamar o nó de "Loop Over Items"; e a ordem das saídas na v3 é `done` (índice 0) e `loop` (índice 1), então o build tem que casar a conexão pelo nome da saída no JSON de exportação, não confiar na posição.

## Como usar este arquivo no `build.mjs`

`versoes-nos.json` não substitui `n8n/config.{env}.json` (que traz ids de credencial e segredos reais); ele é só o formato esperado de cada tipo de nó, por versão, para o gerador montar o JSON de cada um dos três fluxos do capítulo 19 sem adivinhar nome de parâmetro. Quando a instância de homologação existir, o ideal é comparar um export real dela com este arquivo (mesma versão de pacote) e atualizar aqui qualquer divergência, junto com a data em `geradoEm`.
