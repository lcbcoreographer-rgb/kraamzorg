# supabase/sem-docker

Postgres 16 local, sem Docker, para escrever e rodar migrations e testes
pgTAP nesta máquina enquanto a CLI do Supabase e as imagens Docker do
Supabase não baixam (rede bloqueada). Não substitui `supabase start` nem
`supabase test db`: é um jeito de trabalhar aqui até esta máquina ter Docker
de novo. A regra final está no fim deste arquivo, leia antes de confiar
nesta pasta.

## Para que serve

`supabase/migrations` e `supabase/tests` vão ser escritos ao longo das
sessões P01 em diante. Cada um precisa rodar e passar antes do commit
(CLAUDE.md, "Como terminar cada sessão"). Sem Docker, `supabase db reset` e
`supabase test db` não funcionam nesta máquina. Esta pasta reproduz, num
Postgres 16 já instalado aqui, só o que importa para RLS, privilégios e
funções: os papéis do Supabase, os grants que tornam a RLS obrigatória, o
schema `auth` com `auth.users` e `auth.uid()/role()/jwt()`, o schema
`extensions` com as extensões do projeto, um stub de `pg_net`, um stub da
Vault e `pg_cron` de verdade.

## Como usar

```bash
cd supabase/sem-docker

scripts/iniciar.sh    # sobe o Postgres local (initdb na primeira vez, idempotente)
scripts/resetar.sh    # recria o banco: camada-supabase.sql + supabase/migrations/*.sql em ordem + seed.sql se existir
scripts/testar.sh     # reseta e roda pg_prove em supabase/tests/*.sql; código de saída != 0 se algum teste falhar
scripts/parar.sh      # para o servidor (não apaga o banco)
```

Fluxo normal de uma sessão que escreve migration: `iniciar.sh` uma vez,
depois `resetar.sh` e `testar.sh` quantas vezes precisar enquanto escreve o
SQL, `parar.sh` no fim (opcional: pode deixar o servidor no ar).

Variáveis de ambiente (todas opcionais, com padrão):

| Variável         | Padrão                       | Uso                                                 |
| :--------------- | :--------------------------- | :-------------------------------------------------- |
| `PGDATA`         | `/tmp/kz-pg`                 | Diretório de dados do cluster, fora do repositório  |
| `PGPORT`         | `54329`                      | Porta do servidor                                   |
| `DB_NAME`        | `kraamzorg`                  | Nome do banco da aplicação                          |
| `MIGRATIONS_DIR` | `supabase/migrations`        | Pasta com as migrations, aplicadas em ordem de nome |
| `TESTS_DIR`      | `supabase/tests`             | Pasta com os testes pgTAP (`*.sql`)                 |
| `SEED_SQL`       | `supabase/seed.sql`          | Seed opcional; se o arquivo não existir, é pulado   |
| `PG_BIN`         | `/usr/lib/postgresql/16/bin` | Onde estão os binários do Postgres 16               |
| `PG_USER_OS`     | `postgres`                   | Usuário do sistema operacional dono do cluster      |

`resetar.sh` também aceita a pasta de migrations como primeiro parâmetro, e
`testar.sh` aceita a pasta de testes como primeiro parâmetro (o parâmetro
tem prioridade sobre a variável de ambiente). Exemplo, testando uma pasta
fora do repositório sem tocar em `supabase/migrations` nem
`supabase/tests`:

```bash
MIGRATIONS_DIR=/tmp/kz-fumaca/migrations TESTS_DIR=/tmp/kz-fumaca/tests scripts/testar.sh
# ou
scripts/resetar.sh /tmp/kz-fumaca/migrations
scripts/testar.sh /tmp/kz-fumaca/tests
```

**Por que `sudo -u postgres` aparece na saída dos scripts:** o Postgres
recusa `initdb` e o próprio servidor rodando como root, de propósito. Os
scripts detectam se já estão rodando como o usuário `postgres` do sistema; se
não estiverem (é o caso mais comum, sessão como root), trocam para ele com
`sudo -u postgres` só nos comandos que falam com o Postgres (`initdb`,
`pg_ctl`, `psql`, `pg_prove`). Isso pede que `sudo -u postgres` funcione sem
senha para quem roda os scripts (já é o caso nesta máquina).

## Como simular `authenticated` em `aal1` e `aal2`

`auth.uid()`, `auth.role()` e `auth.jwt()` (definidas em
`camada-supabase.sql`, iguais ao Supabase real) leem a configuração de sessão
`request.jwt.claims`. Um teste pgTAP troca de papel com `set local role` e
grava o JWT simulado com `set_config(..., true)` (terceiro parâmetro `true` =
só para a transação corrente, do mesmo jeito que `supabase test db` faz):

```sql
-- aal1: passou usuário e senha, ainda não fez o desafio do MFA
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated',
    'aal', 'aal1'
  )::text,
  true
);
-- ... aqui uma política que exige aal2 (auth.jwt() ->> 'aal' = 'aal2') nega
reset role;

-- aal2: já fez o desafio do MFA (TOTP)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated',
    'aal', 'aal2'
  )::text,
  true
);
-- ... aqui a mesma política deixa passar
reset role;
```

O claim `aal` fica dentro do JWT (não é coluna em `auth.users`: não existe
"AAL por sessão" na tabela, nem no Supabase real). O exemplo completo, com as
quatro asserções (anon, `aal1`, `aal2`, `service_role`), está no teste de
fumaça descrito abaixo (fora do repositório, mas o texto é reaproveitável
como modelo para `supabase/tests/000_harness.sql`, do P01).

## Conferência contra o Supabase real

Depois que esta pasta foi montada, uma segunda sessão conferiu, contra a
documentação oficial e o código-fonte aberto do Supabase (não só a memória do
modelo), os pontos que mais importam para RLS e privilégio:

- `auth.uid()`, `auth.role()` e `auth.jwt()`: comparadas linha a linha com as
  migrations reais do GoTrue
  (`supabase/auth`, arquivos `20220224000811_update_auth_functions.up.sql` e
  `20220531120530_add_auth_jwt_function.up.sql`). São cópia idêntica, inclusive
  o `coalesce`/`nullif` com o atalho `request.jwt.claim.sub` e o fallback pelo
  jsonb `request.jwt.claims`. Confirmado, sem correção necessária.
- Onde fica o claim `aal`: confirmado nos docs oficiais de RLS
  (`guides/database/postgres/row-level-security`, seção MFA) que o padrão é
  `(select auth.jwt()->>'aal') = 'aal2'`, claim solto no JWT, igual ao que
  `camada-supabase.sql` e o teste de fumaça já faziam. Não existe, no Supabase
  real nem aqui, uma coluna de AAL em `auth.users`. Confirmado.
- Grants padrão de `public` para `anon`/`authenticated`/`service_role`
  (select/insert/update/delete em tabela, uso de sequência, execução de
  função, inclusive via `alter default privileges` para objetos futuros):
  comparados com o script de provisionamento de um projeto novo
  (`supabase/postgres`, `migrations/db/init-scripts/00000000000000-initial-schema.sql`).
  Bateram. Dois detalhes desse mesmo script que faltavam aqui foram
  corrigidos nesta conferência (ver abaixo).
- `service_role` com `bypassrls`: confirmado no mesmo script
  (`create role service_role ... bypassrls`). Já estava certo.
- Schema onde ficam as extensões do projeto: confirmado que `pgcrypto` e
  `uuid-ossp` já saem instaladas por padrão com `schema extensions` num
  projeto novo (mesmo script), e que `pg_net` também cria seu próprio schema
  `net` (visto no `pg_net.control` da extensão e nas migrations de permissão
  de `pg_net` em `supabase/postgres`), igual ao que a camada já reproduzia.
  Confirmado.
- `execute` padrão de `PUBLIC` em função nova: confirmado que isso é
  comportamento padrão do Postgres (não algo que o Supabase concede ou
  revoga na base do projeto) e que é a própria migration do projeto que
  revoga isso, exatamente como o PRD 11.10 descreve
  ("a migration revoga esse padrão em public, privado, assistencial, agente
  e api") e como o README já dizia. Confirmado, nada a corrigir.

Fontes consultadas: `supabase/auth` (migrations do schema `auth`, incluindo
`auth.jwt()`), `supabase/postgres` (script de provisionamento inicial do
projeto, migrations de permissão de `pg_net`, schema real de `auth.users`
antigo para contraste com o recortado aqui), a documentação oficial de Row
Level Security do Supabase (seção de funções auxiliares e MFA) e a
documentação de JWT/AAL do Supabase Auth (níveis `aal1`/`aal2`).

### O que foi corrigido nesta conferência

Dois detalhes verificados contra
`migrations/db/init-scripts/00000000000000-initial-schema.sql` do
`supabase/postgres` estavam faltando em `camada-supabase.sql` e foram
acrescentados (seção 1, papéis):

1. `grant supabase_admin to authenticator;` — no Supabase real, `authenticator`
   (o papel que o PostgREST usa) também recebe `supabase_admin`. Sem
   PostgREST rodando aqui isso não muda o resultado de nenhum teste, mas
   deixar de fora era uma diferença real, não só cosmética.
2. `alter role anon set statement_timeout = '3s';` e
   `alter role authenticated set statement_timeout = '8s';` — limite de
   tempo de consulta que um projeto novo já sai com. Não afeta RLS nem
   privilégio, mas é um valor que existe no Supabase real e não existia
   aqui; se algum teste futuro depender de "quanto tempo uma consulta de
   `anon` tem antes de ser cancelada", o valor real agora está presente.

Os dois foram testados com o teste de fumaça (resetar.sh + testar.sh,
repetido, inclusive depois de parar.sh/iniciar.sh) e continuam com as quatro
asserções verdes.

### Diferença nova encontrada (documentada, não corrigida de propósito)

O `pg_net` real, depois de instalado, concede `execute` em
`net.http_get`/`net.http_post` para `anon`, `authenticated`, `service_role` e
`postgres` (visto na migration `20250220051611_pg_net_perms_fix.sql` de
`supabase/postgres`). O stub daqui concede só para `postgres` e
`service_role`. Isso foi deixado assim de propósito, não corrigido: nenhuma
função do PRD (10, 11.10) chama `net.*` a partir de `anon`/`authenticated`
diretamente — quem chama pg_net no Kraamzorg OS é automação interna,
rodando como `postgres`/`service_role` por trás de função `security
definer`. Conceder a mais aqui seria destoar do princípio de menor
privilégio que o próprio PRD 11.10 usa ("revoga o padrão, concede só o que
cada papel usa"). Se uma sessão futura escrever uma função que precisa
chamar `net.*` diretamente como `anon`/`authenticated`, o grant certo é
`grant execute on function net.http_post(...) to <papel>;` na própria
migration do projeto, não uma mudança nesta camada de base.

## O que difere do Supabase real

- **Versão do Postgres.** Aqui é 16. O Supabase real roda 15 em projetos mais
  antigos e 17 em projetos novos, dependendo de quando o projeto foi criado.
  Nada no PRD depende de um recurso exclusivo de uma versão específica, mas é
  uma diferença de versão real, não só de nome.
- **`pg_net` é uma extensão FALSA, não a biblioteca real.** A biblioteca
  verdadeira não está instalada nesta máquina (sem rede para baixar). Em vez
  disso, `scripts/iniciar.sh` grava uma extensão de nome `pg_net` (arquivos
  `pg_net.control` e `pg_net--1.0.sql`) no diretório de extensões do Postgres
  local, de forma idempotente, sem mexer em nenhuma migration versionada. O
  schema `net` dela tem `net.http_post`/`net.http_get` com a mesma
  assinatura, mas são síncronas e só gravam a chamada em `net._chamadas`: não
  saem para a rede, não enfileiram nada e não existe `net._http_response`.
  Como a extensão falsa já existe antes da primeira migration (seção 5 de
  `camada-supabase.sql`, mesmo padrão de pgcrypto/uuid-ossp na seção 2), a
  migration 0001 do capítulo 6.0 do PRD (`create extension if not exists
  pg_net;`) encontra a extensão já instalada e não faz nada, sem falhar.
  Continua sendo uma diferença real do pg_net de verdade (que é assíncrono, com
  fila e worker em background), só documentada aqui, não escondida.
- **Vault é stub, não cifra nada.** `vault.secrets.secret` fica em texto
  puro. A Vault real cifra com pgsodium e chave gerenciada fora do banco.
  Nunca trate o conteúdo de `vault.secrets` neste ambiente como protegido, e
  nunca coloque segredo de verdade aqui (é ambiente local com dado sintético,
  como todo o resto do projeto).
- **Sem GoTrue.** Não existe cadastro, login, e-mail de confirmação nem MFA de
  verdade. `auth.users` só tem as seis colunas que o projeto lê (PRD 6.1) e
  ninguém a popula sozinho: testes e seed inserem as linhas à mão. O nível de
  autenticação (`aal`) nunca vem de uma tabela, só do JWT simulado.
- **Sem PostgREST.** Não há troca automática de papel por JWT de requisição
  HTTP nem exposição de `public`/`api` como API REST. Os testes trocam de
  papel com `set local role` e simulam o JWT com `set_config`, como descrito
  acima. `anon`, `authenticated` e `authenticator` existem como papéis, mas
  `authenticator` fica `NOLOGIN` (nada precisa logar como ele, porque não tem
  PostgREST rodando).
- **Sem Storage, sem Realtime, sem Studio, sem branching, sem painel.** Nada
  disso existe aqui. O schema `storage` fica de fora de propósito (ver
  comentário no fim de `camada-supabase.sql`): nenhuma sessão de P01 a P09,
  P20 ou P21 usa Storage.
- **`supabase_admin` não é superusuário aqui.** No Supabase real ele tem
  poder equivalente a superusuário. Nos scripts sem-docker, quem administra o
  cluster é o papel `postgres` (o superusuário real do Postgres local);
  `supabase_admin` existe só por completude, com `CREATEROLE`, `CREATEDB` e
  `BYPASSRLS`.
- **O `execute` padrão de `PUBLIC` em funções novas não é revogado por esta
  camada.** Isso é comportamento padrão do Postgres (não do Supabase) e fica
  para a própria migration do projeto revogar (PRD 11.10, feito no P01,
  "Conferir que nenhum papel além do dono tem `create` em `public`. Revogar o
  `execute` padrão de `public`..."). `camada-supabase.sql` só reproduz o que o
  Supabase adiciona _antes_ da primeira migration: os grants de tabela,
  sequência e função para `anon`/`authenticated`/`service_role` que tornam a
  RLS obrigatória (seção 3 do arquivo).
- **Locale.** O cluster local usa `C.UTF-8` (o que já vem pronto nesta
  máquina, sem rede). O Supabase real normalmente usa `en_US.UTF-8`. Afeta
  ordenação de texto (`order by`, índices de texto), não afeta RLS,
  privilégio ou o comportamento das funções testadas aqui.
- **`fsync`, `full_page_writes` e `synchronous_commit` desligados**
  (`scripts/iniciar.sh`), para o ciclo resetar+testar ser rápido. Nunca faça
  isso num banco que precisa sobreviver a uma queda de energia; aqui não
  importa, porque `resetar.sh` sempre recria o banco do zero.

Cada bloco de `camada-supabase.sql` tem, em comentário, o que imita do
Supabase e onde difere — este README resume, o arquivo é a referência
completa.

## A regra que não muda

A prova final é sempre `supabase db reset` e `supabase test db` num ambiente
com Docker de verdade. `supabase/sem-docker` é uma ferramenta de trabalho
enquanto esta máquina não tem Docker, não um substituto do Supabase real: as
diferenças listadas acima são exatamente os lugares onde um teste pode passar
aqui e se comportar diferente lá (mais provável: `pg_net`, Vault, qualquer
coisa que dependa de GoTrue ou PostgREST). E, como CLAUDE.md já diz: nenhuma
migration vai para homologação ou produção sem revisão humana do SQL — rodar
verde aqui não dispensa isso, é só o que permite continuar escrevendo SQL
nesta máquina até o Docker voltar.
