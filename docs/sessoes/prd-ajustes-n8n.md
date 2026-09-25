# PRD ajustes n8n · Pequenos ajustes no PRD.md apontados pela trilha do n8n

Data: 25/09/2026
Branch e commits: `trilha/prd-ajustes-n8n`, worktree isolado. Commit único desta sessão (ver `git log`).

## Feito

Leitura de `n8n/IMPORTAR.md` (seção 9) e de `docs/sessoes/P23.md` a `P26.md`, e os seis ajustes que a trilha do n8n apontou, todos em `PRD.md`, marcados `[v4.2]`, sem renumerar nada:

1. **19.1**, expressão da chave: `$('Registrar Msg Família').item.json.resultado.conversa_id` (o nó Postgres devolve a resposta dentro de `resultado`), com a explicação entre parênteses. O texto antigo (`...item.json.conversa_id`) nunca bateu com o build real (decisão 3 do P25).
2. **19.5**, tempo de agrupamento: tirado da lista do que entra no `config.{env}.json` e trocado por uma frase dizendo que ele vem do banco, parâmetro `agente_debounce_segundos` (6.8), lido no fluxo 3 quando a conversa é registrada. O 6.8 já estava certo (o build seguiu o P23); só o 19.5 divergia.
3. **19.4, nó 15**: reescrito para deixar explícito que, com `ok = false` (conversa não encontrada), o modo `vendas` vale só para os nós 17 a 20 decidirem se sai alerta; havendo alerta ou não, a execução termina depois do nó 20 e nunca chega ao nó 21, então o agente não responde (leitura do P25, decisão 6).
4. **19.4, nós 26 e 35, e Apêndice A `sincronizar_memoria`**: documentado que o nó 26b grava a fala do modelo na memória antes de qualquer validação ou envio; quando nada do texto gerado chega à família (saúde ou perda, nó 27; `[SILENCIO]`, nó 27; violação que persiste depois da reescrita, nó 29), o fluxo chama `agente.sincronizar_memoria` com o papel novo `descartado` (texto sempre nulo), que apaga a última linha `type = 'ai'` da sessão em vez de trocar o conteúdo. Fecha a pendência que o P25 tinha deixado em aberto ("avaliar no P21 um papel que troque a última fala da IA por um marcador quando nada saiu").
5. **19.4, nó 26, e 23.3**: o resumo "IA fora do ar, responder a família" deixou de estar implícito no config do build e virou chave nova de `mensagem_modelo`, `resumo_ia_fora_do_ar`, documentada em 23.3 como bullet `[v4.2]`, marcada `[confirmar: Leonardo]` (P25 decisão 4 e pendência correspondente).
6. **Apêndice A e 19.3**: registradas as extensões de contrato que o fluxo 2 usa (P24 decisão 1 e n8n/IMPORTAR.md seção 9):
   - `mensagem_sistema` passa a listar a chave `instrucao_sem_aviso`, usada pelo nó 11 do fluxo 2 para a instrução ao agente (23.4);
   - `registrar_handoff` passa a documentar a leitura de `dados._fluxo2` (`prioridade_minima`, que só sobe a prioridade da matriz; `manter_opcoes`, que mantém `dados.opcoes` no texto do grupo na troca de motivo comercial; `mensagem_enviada`, o texto que já saiu à família, usado em `{mensagem_enviada}` de `grupo_saude`), tanto no nó 12 do 19.3 quanto no próprio Apêndice A;
   - a lista de "Entradas" do 19.3 ganhou um parágrafo `[v4.2]` com as entradas opcionais `tipo`, `modo`, `telefone`, `alerta_internacao_ativo` e `alerta_emocional_ativo`, e o que acontece quando elas faltam.

## Ficou de fora (e por quê)

- `PROMPTS.md`: não precisou de ajuste. A seção do config (linha 488) já diz que "valores de negócio (tempo de agrupamento, pausa, PDF oficial) não vão no config", coerente com o item 2; a linha 518 registra, como histórico do que o P25 executou, o texto literal "IA fora do ar, responder a família" que existia antes desta correção. Como é relatório de prompt já executado, não histórico a reescrever, foi deixado como está.
- Não foi criado item novo no capítulo 22 (Pendências) para o `[confirmar: Leonardo]` da chave `resumo_ia_fora_do_ar`: seguiu o padrão de várias outras confirmações inline do PRD (por exemplo 6.8) que não duplicam linha no capítulo 22.
- Nenhuma mudança em `n8n/` nem em `supabase/`, como pedido pela tarefa.

## Decisões tomadas nesta sessão

- O papel novo `descartado` de `sincronizar_memoria` apaga a linha em vez de reescrevê-la com um marcador, porque o objetivo (a Isadora nunca "lembrar" de algo que a família não leu) fica mais simples de garantir apagando do que inventando um texto de marcador que teria de ser filtrado depois.
- A nova chave `resumo_ia_fora_do_ar` entrou como bullet em 23.3, no mesmo padrão dos outros complementos `[v4.2]` daquele capítulo, e não como linha da tabela `Chave | Modelo` (que é só de mensagens inteiras ao grupo), porque ela é um resumo livre passado a `registrar_handoff`, não uma mensagem pronta.

## Mudanças no PRD

Os seis itens acima, todos em `PRD.md`, todos marcados `[v4.2]`. Nenhuma renumeração de capítulo, nó ou item.

## Pendências novas ([confirmar], [clínico], terceiros)

- `[confirmar: Leonardo]` o texto da chave `resumo_ia_fora_do_ar` em `mensagem_modelo` (23.3), como as demais chaves de mensagem.
- Seguem em aberto as pendências do P21/P22 já registradas em `n8n/IMPORTAR.md` seção 9 para implementar de fato `mensagem_sistema` aceitando `instrucao_sem_aviso`, `registrar_handoff` lendo `dados._fluxo2` e o papel `descartado` de `sincronizar_memoria`; esta sessão só ajustou o texto do PRD, sem tocar em `n8n/` nem `supabase/`.

## Como testar

```sh
pnpm lint
pnpm typecheck
pnpm test
gitleaks detect --no-banner
git diff PRD.md
```

Não há tela nem rota nesta trilha: `pnpm build` e specs Playwright não se aplicam.

## Resultado dos invariantes

Sessão só de texto em `PRD.md`; não mexe em banco, app nem n8n, então os quatro invariantes do 16.1 não rodam por completo. `pnpm lint`: 0 erros, 5 avisos pré-existentes (não relacionados a esta sessão). `pnpm typecheck`: sem erro. `pnpm test`: 213 testes de Vitest passam; os quatro arquivos `n8n/*.test.mjs` falham ao carregar sob o Vitest (erro pré-existente do bundler ao importar `node:test`, não causado por esta sessão, já que ela não toca em `n8n/`) — rodados à parte com `node --test n8n/build.test.mjs`: 311 ok, 1 pulado (sem banco local), 0 falhas. `gitleaks detect`: nenhum vazamento.
