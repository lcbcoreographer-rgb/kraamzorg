Definição dos três fluxos (nós e conexões) e código puro dos nós Code, em .mjs.
Mesmas funções puras são testadas por n8n/build.test.mjs, sem depender do n8n.
Preenchido pelo P23 (build), P24 (fluxo 2), P25 (fluxo 3) e P26 (fluxo 1).

Fluxo 2 (P24): fluxo-2-pausar-notificar.mjs monta os 19 nós do PRD 19.3 e o nó 8a.
Regras em code/: motivos-handoff.js, pular-classificador.js, normalizar-entrada-handoff.js,
ler-classificacao-pedido.js e estado-handoff.js. Um arquivo pode importar outro com
import { x } from './arquivo.js'; o build junta as dependências num script só por nó Code.
lib/simulador.mjs roda o JSON gerado nos testes (fluxo-2.test.mjs), com banco, OpenAI,
UAZAPI e Redis falsos. Contrato esperado do banco para o fluxo 2 no topo de estado-handoff.js.

Fluxo 3 (P25): fluxo-3-agente-isadora.mjs monta a entrada A (nós 1 a 35) e a entrada B
(nós 36 a 41) do PRD 19.4, com lib/construtor.mjs (Postgres, If, Switch, Code) e
lib/uazapi.mjs (envio real ou rota de captura de homologação). Regras em code/:
extrair-dados.js, entrada-mensagem.js, agrupamento.js, modo-agente.js, modos.js,
chamadas-fluxo2.js, envio-sistema.js, contexto-agente.js, saida-agente.js,
resposta-agente.js, validar-resposta.js, preparar-envio.js, marcas-sistema.js,
followup.js e validar-followup.js. Cada arquivo embute só o que importa, para o JSON
não carregar o pacote inteiro em todo nó Code. Contrato esperado do banco no topo de
entrada-mensagem.js, modo-agente.js, contexto-agente.js e followup.js.
fluxo-3.test.mjs roda o JSON gerado no simulador (inclusive com o fluxo 2 gerado de
verdade) e confere pelas conexões a ordem de segurança do 19.4.

Fluxo 1 (P26): fluxo-1-ingestao-rag.mjs monta os 11 nós do PRD 19.2 (mais 8a Data
Loader e 8b Embeddings), com lib/construtor.mjs. Os três gatilhos (manual, a cada
6h, webhook de reindexação) convergem no nó 4 "Novo Lote"; a troca do lote é atômica
(nó 9 promove antes do nó 11 descartar, nunca os dois). Regra em code/:
ingestao-rag.js (novoLote, montarDocumentos, conferirIndexacao, conferirPromocao,
falhaDoLote, nadaAIndexar). O nó 9 também é conferido ("Ler Promoção" e "Promoção OK?"):
sem ok do banco, o lote novo é descartado pelo mesmo caminho do nó 11 ("Falha do Lote").
conferirIndexacao só aceita o que o n8n devolve quando grava de verdade
({pageContent, metadata} com o lote_id do lote): se o nó inteiro falha, o n8n repassa os
itens de entrada, e isso nunca pode virar promoção. O sandbox do nó Code (task runner do
n8n 2.40.6) não expõe crypto: novoLote usa uuidV4, com Math.random quando não há crypto.
O nó 8 "Indexar no PGVector" segue o mesmo padrão do resto do projeto (onError:
continueRegularOutput e checagem explícita do retorno num nó Code, em vez do
segundo output do n8n); por isso o simulador trata vectorStorePGVector em modo
insert como chamada externa comum (lib/simulador.mjs). Nenhum texto para família ou
equipe entra aqui: o fluxo só indexa o que `agente.base_para_indexar()` aprovou.
fluxo-1.test.mjs roda os três cenários do 19.2 (documento aprovado, nada a indexar,
falha no meio) no simulador, mais o PGVector falhando inteiro e a promoção falhando.
