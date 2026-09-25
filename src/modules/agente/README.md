Fronteira do agente Isadora no app: fila, handoff e tela de acompanhamento.
Todo acesso a banco passa pelo schema agente, nunca por dado assistencial (D-14).
Preenchido a partir do P21 (fronteira do agente, parte 1).

## P27 · Tela do agente no CRM

Dono das rotas `/conversas`, `/conversas/[id]`, `/transferencias` e
`/agente` (a navegação e a casca são do P10; este módulo só troca o
conteúdo). Documentação completa da sessão: `docs/sessoes/p27-agente.md`.

- `tipos.ts`: tipos do módulo (`SituacaoConversa`, `ConversaComPausa`,
  `DesfechoTransferencia`, `ModoAgente`, `ItemBaseConhecimento`,
  `MetricasAgente`), separados de `src/lib/dados/tipos.ts` porque esta
  sessão só acrescenta dentro da própria pasta (ver "Pendências" no
  relatório da sessão).
- `formatacao.ts`: em que mão está a conversa (`situacaoDaConversa`,
  espelha o filtro que `AgenteRepositorio.listarConversas` já aplica).
- `repositorio.ts`: o que este módulo acrescenta aos repositórios da
  fundação (pausa e retomada do agente numa conversa, resolver
  transferência com desfecho, modo do agente e números de teste, base de
  conhecimento, métricas). Cada função diz, no comentário, se já funciona
  contra o Supabase real (grants do P07) ou se espera uma função `api.*`
  ainda não escrita (0012 a 0014, `rpcPendente`).
- `loja-extra.ts`: loja em memória do modo demonstração só para o que a
  loja da fundação (`src/lib/dados/demonstracao/loja.ts`) não guarda.
- `acoes.ts` / `admin-acoes.ts`: Server Actions das telas.
- `conversas/`, `conversa-detalhe/`, `transferencias/`, `regras-retomada/`,
  `modo/`, `base-conhecimento/`, `metricas/`: um subdomínio por tela ou
  seção, cada um com `dados.ts` (o que a tela lê) e `componentes/`.

Dono só destas pastas e de `src/app/(app)/conversas/**`,
`src/app/(app)/transferencias/**`, `src/app/(app)/agente/**`,
`src/app/api/teste/uazapi/**` e `src/app/api/agente/reindexar/**`. Reaproveita,
sem editar, `src/modules/crm/ficha` (P16: `CabecalhoFicha`, `obterFichaTela`,
`obterFreioDesfazerSegundos`) e `src/modules/mensageria/tarefas` (P18:
`textoPrazo`, `criarVerificadorFreio`).
