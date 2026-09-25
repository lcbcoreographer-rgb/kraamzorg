# P15 e P17 (tela) · Pipelines 1 e 2, deduplicação e mesclagem

Data: 2026-09-25
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q` (sem commit; a integração faz o commit no fim, conforme instrução da tarefa)

## Feito

**P15 · Pipelines 1 e 2** (`src/app/(app)/pipeline`, `src/modules/crm/pipeline`)

1. Tela de pipeline em `/pipeline`: lista agrupada por estágio no celular (pílulas de atalho + seções), quadro em colunas no computador (`lg:`), com abas Pipeline 1 / Pipeline 2. Filtros de região, classificação, semanas de gestação (calculadas, nunca gravadas) e "só as minhas famílias"; busca por nome ou telefone (reaproveita `familias.listarPipeline` da fundação).
2. Mudança de estágio pelo menu "Mover para" (`componentes/menu-mover.tsx`), que só lista os destinos de `estagios.ts` (cópia local de `privado.transicao_permitida`, migrations 0006). A chamada é sempre `familias.transicionar` da fundação (`api.transicionar` no Supabase). "Perdido" abre a folha `folha-perda.tsx`: motivo (enum `motivo_perda`) obrigatório em pílulas e detalhe opcional; grava `motivo_perda`/`motivo_perda_detalhe` antes de transicionar (essas colunas não passam por `privado.transicionar`, que só mexe no estágio — ver grants de `oportunidade` em `0007_permissoes.sql`).
3. Cartão da oportunidade (`cartao-oportunidade.tsx`): nome, semanas calculadas da DPP (`idade-gestacional.ts`, mesma fórmula de `ig()`), cidade, tempo no estágio (aproximado por `atualizado_em`, ver pendência), próximo contato e sinais (classificação, apresentação enviada, transferência aberta, freio na cor `sensivel`).
4. Cadastro manual de lead (`formulario-lead.tsx` + `acaoCriarLead`): família, pessoa e oportunidade (nasce em `novo`, pipeline 1), com origem. No Supabase é insert direto em `familia`, `pessoa` e `oportunidade` (grants já existem para comercial e diretoria); no modo demonstração, escreve na loja em memória da fundação.

**P17 (a parte de tela) · Deduplicação, mesclagem e vínculo de nova gestação** (`src/app/(app)/pipeline/duplicatas`, `src/modules/crm/deduplicacao`)

1. Detecção (`deteccao.ts`): duplicata certa por telefone normalizado; duplicata provável por nome parecido (aproximação de `pg_trgm` em JavaScript, só no modo demonstração) com DPP a até 14 dias; mesmo telefone com DPP a mais de 180 dias vira "pode ser nova gestação" (PRD 6.10 regra 12), nunca duplicata. No Supabase chama `rpcPendente` para a função `api.*` de detecção, que ainda não existe (ver Pendências): devolve `indisponivelNoBanco`, texto diferente de "nenhuma duplicata".
2. Tela `/pipeline/duplicatas`: três listas (certa, provável, nova gestação), com link "Comparar e mesclar" para a tela lado a lado.
3. Mesclagem lado a lado (`/pipeline/duplicatas/[idA]~[idB]`, `mesclagem-form.tsx`): escolha de qual família fica, escolha de qual oportunidade fica quando as duas têm uma aberta (a outra passa para `perdido`, motivo `outro`, detalhe "mesclada em `<id>`", pela mesma `privado.transicionar`, antes de mover), confirmação explícita ("não há como desfazer"). Move pessoas, conversas e tarefas; os eventos não se movem (`evento_familia` é append-only): a linha do tempo juntar os da família mesclada por `mesclada_em_id` fica para a ficha (P16), que ainda vai ler esse vínculo.
4. Vínculo de nova gestação (`vincularNovaGestacao`): não mescla nada, só grava `familia_anterior_id` (coluna já com grant de update para comercial e diretoria).

**Testes**

- Vitest: `estagios.test.ts`, `idade-gestacional.test.ts`, `normalizar.test.ts` (lógica pura); `dados.test.ts`, `acoes.test.ts` (pipeline) e `deteccao.test.ts`, `mesclagem.test.ts`, `acoes.test.ts` (deduplicação), todos de comportamento sobre o modo demonstração real (loja em memória da fundação, sessão simulada); `folha-perda.test.tsx` e `formulario-lead.test.tsx` de componente (Testing Library), exercitando a Server Action de verdade. 71 testes, todos verdes.
- Playwright, `tests/e2e/p15-p17-pipeline/`: `pipeline-fluxo.spec.ts` (leva a Família Teste Aurora de novo a sessão agendada só pelas transições oferecidas; confirma que uma transição fora da tabela não aparece no menu; perda exige motivo), `pipeline-cadastro-lead.spec.ts` (cadastro manual, validação de campo obrigatório), `duplicatas.spec.ts` (cria uma duplicata certa pelo cadastro manual, compara e mescla, confirma que ela some da lista). Não rodei `pnpm e2e` (a integração roda no fim, conforme a tarefa); as specs seguem os mesmos helpers de `tests/e2e/apoio/entrar.ts` que o resto da suíte já usa.

## Ficou de fora (e por quê)

- **Drag and drop no quadro do computador.** O protótipo tem os dois (arrastar e o menu "Mover para"); implementei só o menu, que já cobre a troca de estágio com teclado e leitor de tela. Arrastar pode entrar depois como reforço, sem mudar a Server Action.
- **"Tempo no estágio" exato.** O cartão usa `atualizado_em` da oportunidade como aproximação (qualquer escrita na oportunidade atualiza esse carimbo, não só a troca de estágio). O tempo exato por estágio pediria ler `evento_familia` (tipo `estagio`), que é domínio da ficha (P16); documentando aqui para quem for refinar.
- **Filtro "responsável" como lista de nomes.** A tela oferece "Só as minhas famílias" (o único responsável do seed fictício é o comercial de teste) em vez de um seletor de pessoa: não existe hoje um método de repositório para listar a equipe comercial por papel, e criar um seria mexer fora da minha pasta.
- **Linha do tempo somando eventos da família mesclada por `mesclada_em_id`.** A mesclagem grava o vínculo (no Supabase, é a coluna real; no modo demonstração, um mapa deste módulo, porque o tipo da loja em memória é da fundação). Juntar os eventos na linha do tempo é código de `ficha.linhaDoTempo` (P16), fora da minha pasta.
- **Cálculo de pontuação (`privado.calcular_score`) e os pgTAP de P17.** O prompt do P17 completo pede isso; a tarefa desta sessão foi só a parte de tela, com a nota explícita de que a pontuação e as funções `api.*` de detecção e mesclagem são de outra trilha (migrations 0012 a 0014, em andamento).

## Decisões tomadas nesta sessão

1. **"Mover para" lista todas as transições da tabela, sem filtrar por `automatica`.** Reli `privado.transicionar` (0006_maquinas_estado.sql): para quem chama autenticado, a permissão é só `papel_minimo` (a coluna `automatica` só importa para chamada sem usuário, ex. automação). Por isso o menu mostra toda transição de `privado.transicao_permitida` a partir do estágio atual, inclusive as marcadas `automatica: true` no JSON de demonstração (ex.: `novo → em_conversa_ia`) — sem isso, o aceite "leva um lead de novo a sessao_venda_agendada" não teria como ser cumprido manualmente pela tela.
2. **Perda grava `motivo_perda`/`motivo_perda_detalhe` antes de chamar `transicionar`.** `privado.transicionar` só grava um `motivo` de texto livre no evento e na auditoria; as colunas do motivo ficam fora dela (grant de update direto em `oportunidade`, comercial e diretoria). A ordem (gravar o motivo primeiro, transicionar depois) evita uma leitura no meio do caminho ver "perdido" sem motivo nenhum.
3. **Cadastro manual de lead por insert direto (não por RPC).** Não existe `api.criar_lead`; a migration 0007 já dá grant de insert em `familia`, `pessoa` e `oportunidade` para comercial e diretoria, com a oportunidade nascendo obrigatoriamente em `pipeline 1, estagio_p1 novo` (o gatilho `proteger_estado` exige isso). A cidade fica só em `cidade_informada` (texto livre), igual à intenção da coluna (comentário da migration 0002: "como a família escreveu"); `cidade_id` fica para quem resolver o cadastro depois.
4. **Detecção e mesclagem usam `rpcPendente` no Supabase.** O banco já tem `privado.buscar_duplicatas` (migration 0010, dentro das 0001 a 0011 prontas), mas revogada de `authenticated` de propósito: falta o wrapper `api.*` que a tela chama, que é de outra trilha (0012 a 0014). Não existe função de mesclagem em nenhuma migration. Os dois casos usam o padrão já existente em `src/lib/dados/supabase/comum.ts` (`rpcPendente`), devolvendo um estado "banco ainda não tem essa função" diferente de "nenhuma duplicata"/erro genérico.
5. **Cortes de duplicata (`limiar_nome` 0,6, `dpp_dias` 14) fixos no código do módulo, não lidos de `parametro`.** `configuracoes.lerParametro` só devolve algo para a diretoria (PRD 13: "Parâmetros e configurações: sem acesso" para o comercial); como a tela de duplicatas também é do comercial, usei os mesmos valores do parâmetro `deduplicacao` do seed (`src/lib/dados/demonstracao/parametros.json`), documentados no comentário de `deteccao.ts`.
6. **Duplicatas e mesclagem moram em subrotas de `/pipeline`.** Meu acesso de rota é só `src/app/(app)/pipeline/**`; a navegação (`src/lib/navegacao/index.ts`) já leva `/pipeline` e qualquer subcaminho para quem pode abrir pipeline, então `/pipeline/duplicatas` não precisou de registro novo.

## Mudanças no PRD

Nenhuma.

## Pendências novas ([confirmar], [clínico], terceiros)

- **Falta o wrapper `api.*` de `privado.buscar_duplicatas`** (revogada de `authenticated` em 0010) **e a função de mesclagem de famílias**, para a tela de duplicatas e a mesclagem funcionarem de verdade no Supabase. Hoje devolvem "o banco ainda não tem essa função" (`indisponivelNoBanco` / `funcao_pendente`). Como isso é a trilha 0012 a 0014, que a tarefa avisou estar em andamento, só registro aqui para quem fechar essas migrations saber que a tela já está pronta para consumir.
- **`privado.calcular_score`** também não existe ainda: o cadastro manual de lead cria a oportunidade com `score: 0` (demonstração) / sem `score` (Supabase, coluna fica nula) até o cron ou a próxima automação recalcular.
- **Linha do tempo da família mesclada.** A ficha (P16) precisa ler `mesclada_em_id` e juntar os eventos da família que saiu; hoje a mesclagem só grava o vínculo (Supabase: coluna real; demonstração: mapa deste módulo, `mesclagem.ts`, função `familiaFicaDemo`).
- **Filtro por responsável (nome, não só "minhas").** Precisaria de um método de repositório para listar a equipe comercial (provavelmente de P07/usuários ou de um módulo de equipe), fora da minha pasta.

## Como testar

```bash
# Nas minhas pastas
pnpm eslint "src/app/(app)/pipeline/**/*.{ts,tsx}" "src/modules/crm/pipeline/**/*.{ts,tsx}" "src/modules/crm/deduplicacao/**/*.{ts,tsx}" "tests/e2e/p15-p17-pipeline/**/*.ts"
pnpm typecheck   # erros fora das minhas pastas são de outro agente em andamento
pnpm vitest run "src/app/(app)/pipeline" "src/modules/crm/pipeline" "src/modules/crm/deduplicacao"

# Roteiro manual (modo demonstração, NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao)
# 1. Entrar como "Comercial". /pipeline mostra o quadro (computador) ou a
#    lista por estágio (celular, 390 px).
# 2. Buscar "Aurora"; "Mover para" só oferece os destinos de "novo" (Em
#    conversa, Nutrição, Não qualificado, Fora de cobertura, Perdido).
#    Mover até Sessão agendada, um passo de cada vez.
# 3. Buscar "Cedro" (qualificado); "Mover para" > "Perdido, com motivo";
#    sem escolher motivo, mostra o aviso; escolher "Preço" e confirmar
#    marca como perdida.
# 4. "Cadastrar lead": preencher família, contato e telefone; a família
#    aparece em Novo. Cadastrar de novo com o mesmo telefone de uma família
#    do seed (ex.: +5511900000301, da Família Teste Aurora).
# 5. Ir em "Duplicatas" (cabeçalho do pipeline): a duplicata certa aparece;
#    "Comparar e mesclar" abre a tela lado a lado; escolher qual família
#    fica e confirmar. A duplicata some da lista.
```

A integração (fim da trilha) roda `pnpm build`, `pnpm lint`, `pnpm typecheck` e `pnpm e2e` do repositório inteiro; não rodei nenhum dos dois aqui, conforme a instrução da tarefa.

## Resultado dos invariantes

Não se aplicam nesta sessão: os quatro invariantes do capítulo 16.1 (`supabase test db`, `pnpm e2e:offline`) são checados na integração, que roda o build e o e2e completos. Do que rodei:

- `pnpm eslint` nas minhas pastas: 0 erros, 0 avisos.
- `pnpm typecheck`: 0 erros nas minhas pastas (os erros do restante do `tsc` são de `src/modules/configuracoes`, outro agente em andamento).
- `pnpm vitest run` nas minhas pastas: 71 testes, 71 verdes, 10 arquivos.
- `prettier --check` nas minhas pastas: sem diferença.
