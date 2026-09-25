Definição dos três fluxos (nós e conexões) e código puro dos nós Code, em .mjs.
Mesmas funções puras são testadas por n8n/build.test.mjs, sem depender do n8n.
Preenchido pelo P23 (build), P24 (fluxo 2), P25 (fluxo 3) e P26 (fluxo 1).

Fluxo 2 (P24): fluxo-2-pausar-notificar.mjs monta os 19 nós do PRD 19.3 e o nó 8a.
Regras em code/: motivos-handoff.js, pular-classificador.js, normalizar-entrada-handoff.js,
ler-classificacao-pedido.js e estado-handoff.js. Um arquivo pode importar outro com
import { x } from './arquivo.js'; o build junta as dependências num script só por nó Code.
lib/simulador.mjs roda o JSON gerado nos testes (fluxo-2.test.mjs), com banco, OpenAI,
UAZAPI e Redis falsos. Contrato esperado do banco para o fluxo 2 no topo de estado-handoff.js.
