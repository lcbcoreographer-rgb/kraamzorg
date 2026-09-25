Fluxos do agente Isadora: build a partir de código, nunca editados pela interface.
n8n/dist é gerado e fica fora do git; n8n/config.*.json também, menos o example.
n8n/src preenchido pelo P23; n8n/build.mjs e build.test.mjs também pelo P23.
Fluxo 2 pelo P24 (fluxo-2.test.mjs), fluxo 3 pelo P25 (fluxo-3.test.mjs) e fluxo 1
(ingestão RAG) pelo P26 (fluxo-1.test.mjs); os três arquivos de teste são
importados por build.test.mjs, então um comando roda tudo:
node --test n8n/build.test.mjs
Build com o config fora do repositório (recomendado, o config real nunca entra em n8n/):
node n8n/build.mjs --env hml --config /caminho/do/cofre/config.hml.json --saida /pasta/temporaria
Passo a passo de importação em homologação: n8n/IMPORTAR.md.
