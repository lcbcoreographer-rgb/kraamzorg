# Ligar o Supabase de verdade (homologação e produção)

Passo a passo para a Kraamzorg ligar os projetos `kraamzorg-hml` e
`kraamzorg-prod` a partir deste repositório. Vale o PRD (5.1, 5.2, 5.5, 13,
21) e o CLAUDE.md; este arquivo só junta, em ordem, o que precisa ser feito à
mão.

Regras que não mudam em nenhum passo:

- Nenhum segredo neste arquivo, em commit, em issue, em mensagem de WhatsApp
  ou de e-mail. Senha, chave e token nascem e ficam no cofre de senhas da
  Kraamzorg; daqui só saem digitados na hora, no lugar certo.
- Nenhuma migration vai para hml ou produção sem revisão humana do SQL
  (CLAUDE.md). Rodar verde local não dispensa a revisão.
- Sempre hml primeiro. Produção só depois do aceite em hml.
- Dado real só existe em produção. Homologação usa só o seed sintético.
- Nunca rode `supabase db reset --linked` (apaga o banco remoto inteiro) nem
  `supabase test db --linked` contra produção.

## 1. Antes de começar

1. Contas em nome da Kraamzorg (D-12): organização no Supabase no plano Pro,
   com MFA ligado na conta de quem administra (PROMPTS.md, P-1 item 2).
2. Uma máquina com Docker e a CLI do Supabase, para a prova local final.
   `supabase/sem-docker` serve para escrever SQL sem Docker, mas não
   substitui `supabase db reset` e `supabase test db` (README daquela pasta).
3. Acesso ao cofre para criar e ler: a senha do banco de cada projeto, a
   chave do HMAC da auditoria, o token interno das automações, a senha do
   papel `n8n_agente` e as chaves do app. Um valor diferente por projeto
   (hml nunca repete o de produção).
4. Aprovação por escrito do Leonardo e da Edilaine da matriz de permissões
   (PRD 22.4, O-05; `docs/adr/0002-permissoes.md`) antes de a migration
   `0007_permissoes.sql` ir para qualquer projeto remoto (PROMPTS.md, P-1
   item 18a).

## 2. Prova local com Docker (antes de cada envio)

Na raiz do repositório:

```bash
supabase start
supabase db reset        # migrations em ordem + seeds de [db.seed] do config.toml
supabase test db         # pgTAP de supabase/tests (invariantes 1, 2 e 3)
pnpm db:types            # regenera src/lib/db/types.ts pela CLI
pnpm typecheck
```

- `supabase/config.toml` é a configuração local: expõe só `public` e `api`,
  liga o MFA TOTP, sessão de 8 horas, cadastro fechado (conta só por convite
  da diretoria) e carrega `seed.sql` e `dados/base_conhecimento_seed.sql`.
- `supabase test db` liga o pgTAP sozinho durante o teste nas versões
  atuais da CLI. Se a sua versão não ligar, rode antes, só no banco local,
  `create extension if not exists pgtap with schema extensions;`.
- `supabase/tests/000_harness.sql` cria o schema `testes` com funções que
  simulam papel e AAL, com execute para `anon`. Ele existe só no banco local
  de teste e nunca vai para hml nem produção: por isso os testes nunca rodam
  com `--linked`.
- Tudo verde é condição para o passo 5. Qualquer vermelho para o envio.

## 3. Criar os projetos

Para cada um (`kraamzorg-hml` e `kraamzorg-prod`):

1. Novo projeto na organização da Kraamzorg, região `sa-east-1` (São Paulo),
   plano Pro.
2. A senha do banco é gerada pelo painel e vai direto para o cofre. Não
   anote em outro lugar.
3. Anote no cofre o `project ref` e a URL do projeto (não são segredo, mas
   ficam junto das chaves para ninguém confundir hml com produção).
4. Confira a versão do Postgres do projeto e ajuste `major_version` em
   `supabase/config.toml` se for diferente (a CLI avisa no `link`).

## 4. Configurar o painel igual ao config.toml

O painel não lê `config.toml`. Em cada projeto:

| Onde no painel | O que deixar | Por quê |
| :-- | :-- | :-- |
| API, schemas expostos | só `public` e `api` (tirar `graphql_public` se não for usado) | PRD 5.2: `privado`, `assistencial`, `agente` e `agente_n8n` nunca expostos |
| API, extra search path | `public, extensions` | igual ao local |
| Auth, cadastro | desligado ("Allow new users to sign up" desligado) | conta nasce do convite da diretoria (P07) |
| Auth, e-mail | confirmação de e-mail ligada, confirmação dupla na troca de e-mail, troca de senha segura | PRD 21.2 |
| Auth, senha | mínimo de 12 caracteres, com minúscula, maiúscula e número | mesmo valor do `config.toml` [confirmar: Leonardo] |
| Auth, MFA | TOTP ligado (cadastro e verificação); telefone e WebAuthn desligados | PRD 5.1, 13, 21.2 |
| Auth, sessões | limite de 8 horas por sessão ("time-box") | PRD 5.1, 13, 21.2 |
| Auth, JWT | expiração do access token em 3600 s | é o tempo máximo que um aparelho ainda usa o token depois de `api.revogar_sessoes` |
| Auth, URLs | Site URL e redirect URLs do ambiente (hml: domínio de homologação e previews da Vercel; produção: `app.kraamzorgbrasil.com.br` [confirmar]) | convite e recuperação de senha voltam para o app certo |
| Auth, SMTP | SMTP próprio pelo Resend (domínio com SPF, DKIM e DMARC); a credencial vai do cofre direto para o painel | e-mail de convite e de senha com remetente da Kraamzorg |
| Database, SSL | "Enforce SSL" ligado | n8n e app só por TLS |
| Database, backups | backups diários do Pro; PITR opcional; restauração testada todo mês num projeto temporário, com registro | PRD 21.2 |

## 5. Ligar o repositório ao projeto

```bash
supabase login                              # token pessoal, pedido na hora; não salve em arquivo
supabase link --project-ref <ref do projeto> # a senha do banco é pedida na hora, do cofre
```

`supabase/.temp` guarda o vínculo e está no `.gitignore`. Faça o `link` com
o ref de hml; troque para o de produção só no dia do envio para produção, e
volte para hml logo depois.

## 6. Segredos no Vault, antes do primeiro envio

Duas migrations criam um segredo no Vault quando ele ainda não existe:
`0005_auditoria.sql` (`auditoria_hmac`) e `0012_automacoes.sql`
(`automacao_interno_token`). Se a migration criar, ninguém fica com cópia do
valor. Por isso os dois são criados antes, com o valor do cofre, e a
migration encontra o segredo e não faz nada.

Como criar sem deixar rastro do valor:

1. Gere o valor no cofre (ou numa máquina de confiança, com
   `openssl rand -hex 32`) e guarde no cofre com o nome do projeto.
2. Conecte com o `psql` sem histórico e com TLS. A connection string vem do
   cofre, digitada na hora:
   `PSQL_HISTORY=/dev/null psql "<connection string do cofre>"`.
   Não use o SQL Editor do painel para isto: ele guarda o histórico das
   consultas.
3. Rode, colando o valor do cofre no lugar indicado:

   ```sql
   select vault.create_secret('<valor do cofre>', 'auditoria_hmac',
     'Chave do HMAC-SHA256 das colunas sensíveis em log_auditoria (PRD 13).');
   select vault.create_secret('<outro valor do cofre>', 'automacao_interno_token',
     'Token do cabeçalho Authorization de /api/interno/automacao (PRD 10).');
   ```

4. Confira só o nome, nunca o valor:
   `select name, created_at from vault.secrets order by name;`
5. Se um comando falhar, gere um valor novo (a mensagem de erro pode ter
   ido para o log do Postgres).

Cuidados:

- Trocar `auditoria_hmac` depois de ter dado real faz os HMACs antigos
  deixarem de bater com os novos. Troca só por decisão registrada.
- `automacao_interno_token` é o mesmo valor que a rota
  `/api/interno/automacao` do app confere (variável de ambiente da Vercel no
  mesmo ambiente). A rota ainda não existe no app (P20, parte de tela); o
  nome da variável fica definido nessa sessão.

## 7. Revisão humana do SQL antes de cada `db push`

Para cada envio, em hml e depois em produção:

1. Liste o que vai subir: `supabase db push --dry-run`.
2. Uma pessoa que não escreveu a migration lê cada arquivo listado inteiro
   e confere, no mínimo:
   - RLS ligada em toda tabela nova e política ou ausência de `grant`
     justificada no ADR 0002;
   - toda função `security definer` com `set search_path = ''` e nomes
     qualificados;
   - `execute` revogado de `public` e `grant` explícito só para quem usa;
     nada para `anon`; nada do schema `agente` para `authenticated`;
   - nenhum valor de preço, prazo, texto ou limite fixo no SQL (vai para
     `parametro` e demais tabelas de configuração);
   - nenhum segredo e nenhum dado real;
   - nada que edite migration já aplicada (mudança é migration nova).
3. A aprovação fica registrada no pull request (quem revisou, data, lista de
   arquivos). A `0007_permissoes.sql` ainda depende do O-05 (passo 1.4).
4. Só então: `supabase db push`.
5. Em hml, depois do push, rode as conferências do passo 11.

Seed:

- Homologação usa o seed sintético (PRD 5.5). Depois da revisão, carregue
  com `supabase db push --include-seed` só no projeto de hml, ou rode os
  arquivos de `[db.seed]` pelo `psql`. Os textos em rascunho do seed ficam
  todos aprovados só em hml, para os testes de homologação rodarem (P08).
- Produção nunca recebe `--include-seed` (passo 10).

## 8. Senha do papel `n8n_agente`

A migration `0013_agente_parte1.sql` cria o papel `n8n_agente` com login e
sem senha (PRD 11.10). A senha é definida à mão, uma por projeto:

1. Gere a senha no cofre.
2. `PSQL_HISTORY=/dev/null psql "<connection string do cofre>"` e, dentro do
   `psql`, `\password n8n_agente`. O `psql` pede a senha duas vezes e manda
   ao banco só o hash, sem o texto da senha passar por log.
3. No n8n, credencial "Postgres Kraamzorg Agente" do ambiente certo: host do
   pooler do projeto em modo sessão (porta 5432), usuário
   `n8n_agente.<ref do projeto>`, banco `postgres`, SSL obrigatório, senha do
   cofre. Nunca a chave `service_role` no n8n (CLAUDE.md).
4. Teste: com a credencial, `select agente.pode_responder('<id de conversa
   do seed de hml>');` responde, e `select count(*) from public.familia;`
   é negado.

## 9. Variáveis do app na Vercel

Por ambiente (Preview e hml apontam para `kraamzorg-hml`; Production para
`kraamzorg-prod`), valores do cofre, nunca repetidos entre ambientes:

| Variável | De onde vem | Observação |
| :-- | :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto | vai ao navegador |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anônima (publishable) do projeto | vai ao navegador; respeita RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | chave de serviço do projeto | só servidor; nunca com prefixo `NEXT_PUBLIC_`, nunca no n8n |
| `INTERNAL_ROUTES_SECRET` | cofre | rotas internas (`/api/interno/notificar`) |
| `CRON_SECRET` | cofre | rotas chamadas por agendamento |
| `NEXT_PUBLIC_APP_ENV` | `homologacao` ou `producao` | nunca `desenvolvimento` fora do local |
| `KZ_DADOS` | vazio | `demonstracao` só funciona em desenvolvimento e nunca é preenchido em hml nem em produção |

As demais variáveis de `.env.example` (Resend, UAZAPI, OpenAI, Autentique,
InfinitePay, NFS-e, Turnstile, Sentry, VAPID) seguem as sessões de cada
integração. `.env.local` nunca vai para o git.

## 10. O que não pode ir para produção

- `supabase/seed.sql` inteiro: perfis de teste (`*.teste@kraamzorgbrasil.test`),
  famílias, pessoas, conversas e mensagens fictícias. Nada de
  `--include-seed` em produção.
- Os parâmetros do seed que apontam para o ambiente local:
  `automacao_rota_interna` e `link_ficha_modelo` (`http://localhost:3000`).
- `agente_modo` diferente de `teste` ou `desligado` antes da homologação da
  Isadora (P28) e do adaptador `cloud_api` (P18b, T-01).
- Textos de `mensagem_modelo` aprovados só para teste (em hml o seed aprova
  todos; em produção só entram aprovados pela Kraamzorg).
- `supabase/tests`, o schema `testes` e a extensão `pgtap`.
- `supabase/sem-docker` (é ferramenta local; nada dali roda em projeto
  remoto).
- Qualquer dado real em hml, e qualquer cópia de produção para hml ou para
  máquina local.

Pendência antes do primeiro envio para produção: produção precisa da parte
de configuração do seed (regiões, cidades, municípios do IBGE, pacotes e
versões, condições comerciais, `parametro`, `mensagem_modelo`, `regua_faixa`,
`termo_alerta`, `automacao`, `regra_alerta`) sem nenhum dado sintético de
pessoa ou família. Hoje isso está misturado no `seed.sql`. Antes de
produção, separe essa carga num arquivo próprio, revisado como migration,
com os valores de produção (URLs do app de produção, `agente_modo`
`desligado`). A base de conhecimento inicial
(`supabase/dados/base_conhecimento_seed.sql`, tudo em rascunho) pode ir
nessa carga, para o Leonardo e a Edilaine aprovarem pela tela do P27.

## 11. Conferências depois de cada envio (hml primeiro)

Pelo `psql` (passo 6.2), sem alterar nada:

```sql
-- toda tabela dos schemas do projeto com RLS (esperado: nenhuma linha)
select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
  and not c.relrowsecurity;

-- nenhuma função do projeto executável por anon (esperado: nenhuma linha)
select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
  and has_function_privilege('anon', p.oid, 'execute');

-- agendamentos (esperado: recalculo_diario, processar_automacoes, retencao_diaria, conferir_agente_n8n)
select jobname, schedule, command from cron.job order by jobname;

-- segredos pelo nome (esperado: auditoria_hmac, automacao_interno_token)
select name from vault.secrets order by name;
```

E, em hml, com o app:

1. Convite da diretoria cria o perfil sem papel; o cadastro pela tela de
   entrar está fechado.
2. MFA: perfis de enfermeira, financeiro, coordenação e diretoria só entram
   em AAL2.
3. Sessões: entrar com um usuário de teste em dois aparelhos, revogar pela
   tela da diretoria (`api.revogar_sessoes`) e conferir que os dois caem no
   máximo em uma hora (quando o access token expira) e que a linha
   `revogar_sessoes` aparece em `log_auditoria`. Se a função responder
   permissão negada, o papel `postgres` do projeto perdeu `delete` em
   `auth.sessions`: registre e não contorne pela chave de serviço sem nova
   decisão.
4. O gatilho `criar_perfil_do_convite` em `auth.users` e os jobs do
   `pg_cron` precisam existir depois do push; se o projeto recusar gatilho
   em `auth.users`, pare e registre antes de seguir.
5. No Supabase real, `pg_net` concede `execute` em `net.http_post` a `anon` e
   `authenticated`. O schema `net` não é exposto pelo PostgREST e nenhuma
   função do app chama `net` direto, mas confira em
   `supabase/sem-docker/README.md` a nota sobre essa diferença e registre a
   decisão da revisão.

## 12. Onde está cada coisa

- Migrations: `supabase/migrations/` (ordem pelo prefixo numérico).
- Testes pgTAP: `supabase/tests/`.
- Seed sintético: `supabase/seed.sql` e `supabase/dados/base_conhecimento_seed.sql`
  (conferência de nomes e telefones: `node supabase/checar-seed.mjs`).
- Permissões: `docs/adr/0002-permissoes.md`. Fronteira do agente:
  `docs/adr/0003-fronteira-agente.md`.
- Relatórios das sessões de banco: `docs/sessoes/P01.md` a `P09.md`,
  `P17-banco.md`, `P19-banco.md`, `P20-banco.md`, `P21.md` e `P22.md`.
