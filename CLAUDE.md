# CLAUDE.md · Kraamzorg OS

Sistema operacional da Kraamzorg Brasil: CRM comercial, operação domiciliar pós-parto, registro assistencial offline e a agente de WhatsApp Isadora. Cliente trata dado de saúde de gestantes e recém-nascidos (LGPD art. 11). Erro aqui machuca família real.

## Fontes de verdade

1. `PRD.md` manda em tudo. Capítulo 4 (decisões travadas), 5 (stack e convenções), 6 (modelo de dados), 8 (freio global), 16 (invariantes).
2. `PROMPTS.md` define a sessão da vez. Cada sessão executa um prompt (P00 a P54) e nada além dele.
3. Este arquivo resume como trabalhar. Se ele e o PRD divergirem, vale o PRD, e você avisa a divergência.

Se a conversa pedir algo que contradiz o PRD, pare e diga isso antes de codar. Mudança de regra se faz editando o PRD primeiro, num commit separado.

## Como começar cada sessão

1. Leia este arquivo, o prompt da vez em `PROMPTS.md` e os capítulos do PRD que ele lista.
2. Rode `git status` e os testes (`pnpm test`, `supabase test db`). Se algo já estiver vermelho, conte antes de começar.
3. Crie o branch `pNN-nome-curto` a partir de `hml`. O pull request volta para `hml`. A `main` é produção e só recebe promoção de `hml` depois do aceite, num passo controlado.
4. Faça um fluxo só. Sessão longa demais: commit, resumo e nova sessão.

## Como terminar cada sessão

1. Rode os quatro invariantes (capítulo 16.1): `supabase test db` (1, 2 e 3), `pnpm test` e `pnpm e2e:offline` (4), mais `node --test n8n/build.test.mjs` quando mexer no n8n. Falha bloqueia o commit.
2. Rode `pnpm lint`, `pnpm typecheck` e `gitleaks detect`.
3. Escreva `docs/sessoes/PNN.md` com: o que foi feito, o que ficou de fora, decisões tomadas, pendências novas e comandos para testar.
4. Atualize os itens `[confirmar]` do capítulo 22 do PRD que a sessão resolveu ou criou.
5. Commit em português, no imperativo, com o ID do prompt: `P07: aplica RLS da matriz de permissões`.

## Regras que não se negociam

Banco e dados
- Migration: você escreve o arquivo em `supabase/migrations/`, mostra o SQL e para. Só aplica (`supabase db push`) depois de revisão humana. Nunca edite migration já aplicada; crie outra.
- Nomes de tabela, coluna, enum e função em português snake_case, iguais ao PRD.
- Todo estado é enum. Mudança de estágio só por `privado.transicionar()`. Update direto de estágio é recusado pelo banco, de propósito.
- Dinheiro em centavos (`integer`). Datas em `date` ou `timestamptz`, fuso `America/Sao_Paulo`. Telefone em E.164.
- Idade gestacional nunca é gravada: calcule com `ig(dpp, data)`.
- As quatro datas (`dpp` estimativa; `data_nascimento`, `data_alta` e `data_inicio_efetivo` fatos) nunca se confundem. Nenhuma automação de operação dispara pela DPP.
- `registro_atendimento` é append-only. Correção vira `registro_adendo`. Sem UPDATE, sem DELETE.
- RLS em toda tabela. Tabela assistencial não tem `select` direto: leitura por `assistencial.ler_*`, que grava `log_auditoria` antes de devolver.
- Função `security definer` sempre com `set search_path = ''` e nomes qualificados (`public.familia`, `extensions.unaccent`).
- O PostgREST expõe só `public` e `api`. O app chama por RPC apenas funções de `api`, que checam papel e AAL e chamam as internas de `privado` e `assistencial`. O `execute` padrão para `public` é revogado em todo schema; cada papel recebe só o que usa.
- Função que grava log (as `assistencial.ler_*`) é `volatile`. `privado.tem_papel` e `privado.familias_atribuidas` são `security definer`, senão as políticas entram em recursão.
- O gatilho de auditoria grava colunas alteradas com as pessoais e sensíveis (CPF, endereço, fichas clínicas, transcrições, conteúdo de mensagem, resumo de handoff, motivo de estado sensível, entre outras da lista do ADR 0002) trocadas por "[oculto]" e um **HMAC-SHA256 com chave no Supabase Vault** (nunca hash puro, que se reverte). O log prova a mudança sem copiar o prontuário. **[v4.2]**
- Nenhum preço, prazo, texto, limite ou lista de termos no código. Vai para `parametro`, `pacote_versao`, `mensagem_modelo`, `termo_alerta`, `regua_faixa`, `regra_alerta` ou `condicao_comercial`.

Mensagens e automações
- Toda mensagem do app para família sai pelo adaptador de mensageria (`src/lib/messaging`) e passa por `privado.pode_enviar_mensagem()`. Nenhum módulo do app chama WhatsApp, UAZAPI ou e-mail direto. A única exceção é o n8n, que envia pela UAZAPI e chama `agente.pode_enviar()` imediatamente antes de cada resposta ou follow-up à família. **[v4.2]** Essa checagem nunca entra no texto de alerta de saúde ou perda (`agente.mensagem_alerta`, que sai pelo sistema, não pelo modelo) nem nos avisos internos ao grupo ou ao plantão: são caminhos à parte, sem pausa nem janela de horário.
- Toda automação passa por `privado.pode_executar()` e reconsulta o freio no instante do envio.
- O agente só sobe o freio. Nunca baixa.

Segurança e LGPD
- Dado real nunca sai de produção. Desenvolvimento e homologação usam só o seed sintético. Nenhum arquivo do Drive do cliente entra no repositório.
- **[v4.2]** As vinte conversas reais de WhatsApp do treinamento do agente (onboarding, capítulo 10.1) nunca entram no repositório, nem como arquivo nem como trecho colado em documento, prompt ou seed: ficam só no Drive ou no cofre da Kraamzorg, para leitura humana. Só os exemplos fictícios do treinamento de 24/09 (nomes trocados) entram no repositório, na base de conhecimento do agente (P26).
- Nome de paciente nunca em nome de arquivo, caminho de storage, URL, query string, assunto de e-mail, metadado de PDF ou log.
- `service_role` só no servidor (rotas de API e jobs), nunca no navegador e nunca no n8n.
- Segredos só em variáveis de ambiente e no cofre da Kraamzorg. Nada de segredo em código, teste, fixture ou migration. `n8n/config.*.json` (menos o example) e `n8n/dist/` ficam fora do git. Papel de banco é criado sem senha; a senha é definida à mão a partir do cofre.
- Storage privado com URL assinada curta. A única exceção é o PDF comercial da apresentação.
- Perfis com acesso assistencial ou financeiro exigem MFA (AAL2) nas políticas.

Clínico
- Você não cria, remove nem renomeia campo clínico. Campo clínico vem de `instrumento` (definição JSON aprovada pela Edilaine). Item com `[clínico]` no PRD entra parametrizado e desligado até aprovação.

Agente e n8n
- O n8n acessa o banco só pelo papel `n8n_agente`: funções do schema `agente` e as duas tabelas de `agente_n8n` que os nós LangChain usam (D-14). Nunca lê dado assistencial.
- O filtro de saúde roda antes de qualquer decisão de modo, em todos os modos menos `desligado`. Nenhuma mudança no fluxo 3 pode colocar a checagem de pausa ou de mídia antes dele. **[v4.2]** Isso vale também no modo `humano_comercial`: o filtro de saúde continua rodando ali, com `enviar_texto` verdadeiro.
- **[v4.2]** A chave de toda chamada ao banco é o `conversa_id`, lido do nó "Registrar Msg Família" (ou "Registrar Msg Humana"), nunca de um parâmetro que o modelo preenche. O `jid` vem do webhook e só serve para enviar.
- Os JSON dos fluxos são gerados por `n8n/build.mjs`. Nunca edite JSON à mão nem monte fluxo pela interface.
- Textos da Isadora e dos classificadores moram em `n8n/prompts/`. Mudança de texto passa por aprovação do Leonardo (e da Edilaine no que for clínico).
- **[v4.2]** `humano_comercial`: modo do agente para lead comercial já qualificado e transferido ao comercial (`reuniao`, `contratar`, `condicao_comercial`, ou qualquer transferência ao comercial com a oportunidade em `qualificado` ou adiante; PRD 11.4 e 11.7; o Leonardo confirma a lista exata). Nesse modo a Isadora não volta a responder com conteúdo comercial: nem pela pausa vencer, nem pelo botão "resolver" da fila de transferências. Só o botão específico "Devolver à Isadora" (via `privado.retomar_agente`) reabre a conversa. Decisão do Leonardo em 24/09 (notas-reuniao-24-09.md).

## Texto de interface

- Tom calmo, claro, seguro e acolhedor (PRD 20.3). Frases completas, sem jargão técnico para a família.
- Sem travessão e sem meia-risca em nenhum texto de interface, e-mail ou PDF.
- Nunca "mãezinha", "mamãe", "papai".
- Erro diz o que aconteceu e o que fazer: "Sem sinal agora. O registro está salvo no aparelho e sobe sozinho quando a conexão voltar."
- Formatação brasileira: R$ 4.200, 24/09/2026, 38s2d.

## Design

**[v4.2]** Direção visual e de experiência em `docs/design/DESIGN.md` (tokens, iconografia, componentes, microcopy) e `docs/design/fluxos.md` (fluxos A a E, tela a tela). Protótipo de referência em `docs/prototipo/`. O PRD trava paleta, fontes e regras de acessibilidade; o DESIGN.md e o fluxos.md dizem a direção, a hierarquia e o padrão de componente. Sessão de tela que tenha um grupo correspondente no protótipo lê os dois antes de codar (PROMPTS.md lista qual grupo em cada sessão).

Tokens só em `src/app/globals.css` (`@theme` do Tailwind v4). Nenhuma tela inventa cor, fonte, raio ou sombra.

| Token | Valor | Uso |
| :-- | :-- | :-- |
| `marinho` | #0F1F36 | Texto principal, ação primária, barra lateral |
| `dourado` | #BC9C5D | Destaque, ícones, bordas ativas. Texto sobre dourado sempre marinho |
| `areia` | #E8DAC5 | Superfícies secundárias |
| `creme` | #FCF8ED | Fundo das telas |
| `branco` | #FFFFFF | Cartões |
| `sucesso` | #4B7358 | Concluído, sincronizado |
| `aviso` | #B5822A | Pendente, prazo perto |
| `alerta` | #9E4438 | Urgente, erro, alerta clínico imediato |
| `sensivel` | #63557A | Estado sensível (perda, intercorrência). Nunca use vermelho para luto |

Fontes: títulos em Jost (Codec Pro quando a licença web for confirmada), interface em Inter, dados em IBM Plex Mono. Logo só como arquivo de `/public/brand`. Mobile primeiro (D-02): área de toque de 44 px, contraste AA, formulário longo em etapas com salvamento por campo, botão de freio em um toque no cabeçalho da família.

## Comandos

```bash
pnpm dev                          # app local
supabase start                    # banco local (Docker)
supabase db reset                 # recria o banco local com migrations e seed.sql
supabase test db                  # pgTAP: invariantes 1, 2 e 3
supabase gen types typescript --local > src/lib/db/types.ts
pnpm test                         # Vitest (unitários e invariante 4)
pnpm e2e                          # Playwright
pnpm e2e:offline                  # Playwright com a rede desligada (invariante 4)
pnpm lint && pnpm typecheck
node n8n/build.mjs --env hml      # gera n8n/dist/*.json para homologação
node --test n8n/build.test.mjs    # testes estruturais e das funções dos nós
gitleaks detect --no-banner

# [v4.2] sem Docker nesta máquina, alternativa a supabase start/db reset/test db
# (a prova final continua sendo as três linhas acima, com Docker de verdade)
supabase/sem-docker/scripts/iniciar.sh   # sobe o Postgres local
supabase/sem-docker/scripts/resetar.sh   # recria o banco: camada + migrations + seed
supabase/sem-docker/scripts/testar.sh    # reseta e roda pg_prove em supabase/tests
```

## Estrutura

```
supabase/migrations  supabase/seed.sql  supabase/tests
src/app/(auth) (app) (enfermeira) (familia) (publico) api/
src/modules/crm operacao assistencial financeiro agente automacoes mensageria
src/lib/auth db sync messaging pdf regras-alerta auditoria formatacao
src/components/ui shell
n8n/build.mjs  n8n/build.test.mjs  n8n/src  n8n/prompts  n8n/referencia  n8n/dist
tests/  docs/  public/brand/
```

## Pronto quer dizer

- O aceite do prompt foi cumprido e demonstrado (teste automatizado ou roteiro manual escrito em `docs/sessoes/PNN.md`).
- Os quatro invariantes passam.
- Funciona no celular (viewport 390 px) e no computador.
- Nenhum texto, valor ou limite novo ficou no código.
- Nenhum dado real, segredo ou nome de paciente foi parar no repositório.

## Quando parar e perguntar

- A tarefa pede um campo clínico que não está no instrumento aprovado.
- A tarefa contradiz uma decisão do capítulo 4.
- Falta credencial ou conta que só a Kraamzorg pode criar.
- Um teste de invariante falha e a correção exigiria afrouxar a regra.
- Você está prestes a aplicar migration, apagar dado, mexer em RLS de tabela assistencial ou publicar algo em produção.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
