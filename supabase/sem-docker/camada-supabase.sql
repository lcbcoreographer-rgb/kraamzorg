-- =============================================================================
-- supabase/sem-docker/camada-supabase.sql
--
-- Reproduz, num Postgres 16 comum, o que um projeto Supabase novo já traz
-- ANTES da primeira migration do Kraamzorg OS: papéis, os grants que tornam a
-- RLS obrigatória, o schema auth com auth.users e auth.uid()/role()/jwt(),
-- o schema extensions com as extensões do projeto, um stub de pg_net (schema
-- net) e um stub da Vault (schema vault), e pg_cron de verdade.
--
-- resetar.sh aplica este arquivo logo depois de criar o banco, antes de
-- qualquer migration de supabase/migrations. As migrations do projeto (a
-- partir do P01) continuam livres para fazer "create schema if not exists
-- api/privado/assistencial/agente/agente_n8n" e "create extension if not
-- exists ..." normalmente: são idempotentes, então rodar depois deste
-- arquivo não quebra nada.
--
-- O que este arquivo NÃO faz (documentado em detalhe no README.md):
--   - Não sobe GoTrue: ninguém loga de verdade, auth.users só tem as linhas
--     que os testes e o seed inserem à mão.
--   - Não sobe PostgREST: não há troca de papel automática por JWT de
--     requisição HTTP. Os testes trocam de papel com "set local role" e
--     simulam o JWT com set_config('request.jwt.claims', ...).
--   - Não cria o schema storage (ver nota no fim deste arquivo).
--   - Não revoga o "execute" padrão de PUBLIC nas funções novas: isso é
--     trabalho da migration do próprio projeto (PRD 11.10, feito no P01),
--     não da camada Supabase de base.
--
-- Idempotente na parte de papéis (cluster-wide, sobrevivem a um "drop
-- database"): usa DO blocks com IF NOT EXISTS. O resto ("create schema if
-- not exists", "create extension if not exists", "create or replace
-- function") já é idempotente por natureza.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Papéis
--
-- Imita: os cinco papéis que todo projeto Supabase tem prontos antes da
-- primeira migration. anon e authenticated são os dois papéis que o
-- PostgREST assume conforme o JWT da requisição; service_role ignora RLS
-- (bypassrls) e é o que o servidor usa; authenticator é o papel de login que
-- o PostgREST usa para conectar e trocar (SET ROLE) para anon/authenticated/
-- service_role; supabase_admin é o papel administrativo que a plataforma usa
-- para gerenciar o projeto.
--
-- Difere: no Supabase real, authenticator tem LOGIN e senha (é com ela que o
-- PostgREST conecta) e supabase_admin é efetivamente superusuário. Aqui não
-- roda PostgREST nenhum, então authenticator fica NOLOGIN (nada precisa
-- logar como ele); e quem faz o papel de "pode tudo" nos scripts é o dono do
-- cluster local (papel "postgres", superusuário de verdade), não
-- supabase_admin, que por isso fica só com CREATEROLE/CREATEDB/BYPASSRLS,
-- sem SUPERUSER, para não sugerir um poder que os scripts sem-docker não
-- dão a ele de fato.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin noinherit createrole createdb bypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator nologin noinherit;
  end if;
end
$$;

comment on role anon is 'sem-docker: papel que o PostgREST assumiria para requisição sem JWT. Aqui os testes fazem "set local role anon" direto.';
comment on role authenticated is 'sem-docker: papel que o PostgREST assumiria para requisição com JWT válido. Aqui os testes fazem "set local role authenticated" e simulam o JWT com set_config.';
comment on role service_role is 'sem-docker: bypassrls ligado, igual ao Supabase real. Nunca deve ser usado por nada que rode no navegador (CLAUDE.md).';
comment on role authenticator is 'sem-docker: existe só por completude. No Supabase real é o papel de login do PostgREST (NOLOGIN aqui porque não há PostgREST rodando).';
comment on role supabase_admin is 'sem-docker: NÃO é superusuário aqui (diferente do Supabase real). Quem administra o cluster local é o papel "postgres".';

grant anon to authenticator;
grant authenticated to authenticator;
grant service_role to authenticator;
grant supabase_admin to authenticator;

-- Igual ao Supabase real (script de provisionamento de um projeto novo):
-- anon e authenticated saem com um limite de tempo de consulta mais curto
-- que o padrão do Postgres. Não afeta RLS nem privilégio, só corta consulta
-- lenta antes da hora; documentado aqui para não faltar quando um teste ou
-- uma migration futura decidir depender do valor de "statement_timeout".
alter role anon set statement_timeout = '3s';
alter role authenticated set statement_timeout = '8s';


-- -----------------------------------------------------------------------------
-- 2. Schema extensions
--
-- Imita: o schema "extensions" onde o Supabase instala as extensões que o
-- projeto liga (o schema "public" não ganha create extension nem acesso
-- direto a elas). pgtap entra aqui só para o ambiente sem-docker: no
-- Supabase real o pgtap não fica instalado no projeto, é o "supabase test
-- db" que sobe um container Postgres à parte já com ele.
--
-- Difere: num projeto Supabase novo, pgcrypto e uuid-ossp costumam já vir
-- instalados por padrão; vector, pg_trgm, unaccent, btree_gist e citext
-- normalmente são ligados pela própria migration do projeto (é exatamente o
-- que o PRD 6.0 faz no P01). Aqui as sete entram todas de uma vez, porque
-- esta máquina só tem essas bibliotecas disponíveis (sem rede para baixar
-- imagem do Supabase, sem CLI); quando a migration real do P01 rodar depois
-- deste arquivo, o "create extension if not exists" dela não vai fazer nada
-- (já existe) e vai passar batido, sem erro.
-- -----------------------------------------------------------------------------

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;
comment on schema extensions is 'sem-docker: onde moram pgcrypto, uuid-ossp, pg_trgm, unaccent, vector, btree_gist, citext e pgtap, como no Supabase real (menos pgtap, que só existe aqui).';

create extension if not exists pgcrypto    with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm     with schema extensions;
create extension if not exists unaccent    with schema extensions;
create extension if not exists vector      with schema extensions;
create extension if not exists btree_gist  with schema extensions;
create extension if not exists citext      with schema extensions;
create extension if not exists pgtap       with schema extensions;

grant usage on schema extensions to anon, authenticated, service_role;

-- Igual ao Supabase real: o banco do projeto sai com "extensions" no
-- search_path por padrão, para que "gen_random_uuid()", "unaccent()" etc.
-- funcionem sem qualificar o schema. Sem isto, pgtap também não funciona
-- (plan(), is(), results_eq()... moram em extensions.pgtap): pg_prove abriria
-- uma conexão nova por arquivo de teste e "select plan(4);" falharia com
-- "function plan(integer) does not exist".
do $$
begin
  execute format(
    'alter database %I set search_path = "$user", public, extensions',
    current_database()
  );
end
$$;


-- -----------------------------------------------------------------------------
-- 3. Schema public: grants e default privileges
--
-- Imita: o motivo pelo qual RLS é obrigatória no Supabase. Um projeto novo
-- já sai com anon, authenticated e service_role tendo grant total (select,
-- insert, update, delete) em toda tabela, sequência e função do schema
-- public, inclusive nas que uma migration futura vier a criar (default
-- privileges). Sem RLS ligada, qualquer um desses papéis lê e escreve
-- direto. É por isso que o PRD (6.10 regra 6, CLAUDE.md) trata "RLS em toda
-- tabela" como não negociável: o grant já existe antes da RLS, a RLS é a
-- única coisa que falta pra fechar o acesso.
--
-- Difere: nada de importante aqui, isto é fiel ao comportamento real.
-- -----------------------------------------------------------------------------

grant usage on schema public to postgres, anon, authenticated, service_role;

-- objetos que a migration do projeto ainda vai criar
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- objetos que já existirem no schema public no momento em que este arquivo
-- roda (normalmente nenhum: resetar.sh aplica isto logo após criar o banco)
grant all on all tables    in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 4. Schema auth: auth.users e auth.uid() / auth.role() / auth.jwt()
--
-- Imita: as únicas partes do schema auth (GoTrue) que o projeto realmente
-- lê: a tabela auth.users (perfil referencia auth.users(id), PRD 6.1) e as
-- três funções que toda política de RLS do projeto usa. As três funções são
-- cópia literal da definição do Supabase: leem request.jwt.claims (e, no
-- caso de auth.uid()/auth.role(), também o atalho request.jwt.claim.sub /
-- request.jwt.claim.role) da configuração de sessão do Postgres. O README
-- explica como um teste simula esse JWT com set_config.
--
-- Difere: só estas seis colunas existem em auth.users (id, email, phone,
-- raw_app_meta_data, raw_user_meta_data, created_at, updated_at). Faltam
-- dezenas de colunas do Supabase real (encrypted_password, confirmed_at,
-- banned_until, instance_id, is_sso_user, etc.) e faltam as tabelas
-- relacionadas (auth.identities, auth.sessions, auth.refresh_tokens,
-- auth.mfa_factors, auth.mfa_amr_claims...). O nível de autenticação da
-- sessão (AAL) não é coluna em lugar nenhum, nem no Supabase real: ele vive
-- só no claim "aal" do JWT da sessão, por isso não tem "aal" na tabela
-- aqui. Como não existe GoTrue, nada popula auth.users sozinho: os testes e
-- o seed inserem as linhas que precisam à mão.
-- -----------------------------------------------------------------------------

create schema if not exists auth;
grant usage on schema auth to postgres, anon, authenticated, service_role;
comment on schema auth is 'sem-docker: só auth.users e as três funções auth.uid()/auth.role()/auth.jwt(). Sem GoTrue: nada aqui loga de verdade nem envia e-mail.';

create table if not exists auth.users (
  id                 uuid primary key default extensions.gen_random_uuid(),
  email              text,
  phone              text,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table auth.users is 'sem-docker: só as colunas que o Kraamzorg OS usa (perfil.id referencia esta tabela, PRD 6.1). Sem GoTrue, ninguém popula sozinho: testes e seed inserem as linhas que precisam. Não existe coluna de AAL: o nível de autenticação vive só no claim "aal" do JWT simulado (ver README), nunca numa coluna.';

grant select, insert, update, delete on auth.users to postgres, service_role;
-- anon e authenticated não leem auth.users direto no Supabase real; o acesso
-- deles à própria sessão é só via auth.uid()/auth.role()/auth.jwt().

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;
comment on function auth.uid() is 'sem-docker: definição idêntica à do Supabase. Lê o claim "sub" do JWT simulado por set_config(''request.jwt.claims'', ...).';

create or replace function auth.role()
returns text
language sql
stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
$$;
comment on function auth.role() is 'sem-docker: definição idêntica à do Supabase. Lê o claim "role" do JWT simulado.';

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;
comment on function auth.jwt() is 'sem-docker: definição idêntica à do Supabase. Devolve o JWT inteiro simulado como jsonb, usado por exemplo para ler o claim "aal" ((auth.jwt() ->> ''aal'')).';

grant execute on function auth.uid()   to public;
grant execute on function auth.role()  to public;
grant execute on function auth.jwt()   to public;


-- -----------------------------------------------------------------------------
-- 5. Schema net: stub de pg_net
--
-- Imita: a assinatura de net.http_post e net.http_get do pg_net, para
-- privado.processar_automacoes (PRD 10) e qualquer outra função de banco que
-- chame rota externa por pg_net continuarem compilando e rodando aqui sem
-- rede. Toda chamada é gravada em net._chamadas em vez de sair para a rede.
--
-- Difere: não é uma extensão de verdade (esta máquina não tem a biblioteca
-- pg_net instalada: "não existe pg_net" no enunciado desta tarefa). Por
-- isso, quando a migration real do capítulo 6.0 chegar com
-- "create extension if not exists pg_net;", ela vai FALHAR aqui (extensão
-- não disponível) -- é uma diferença conhecida, documentada no README, e
-- não algo que este arquivo tenta esconder. Além disso, o pg_net real é
-- assíncrono: enfileira a chamada, um worker em background faz a requisição
-- e a resposta chega depois em net._http_response (ou net._http_collect_
-- response). Aqui não tem fila nem worker: a função devolve um id na hora e
-- pronto, ninguém deve esperar por uma resposta.
-- -----------------------------------------------------------------------------

create schema if not exists net;
grant usage on schema net to postgres, service_role;
comment on schema net is 'sem-docker: stub de pg_net. Não faz chamada HTTP nenhuma; grava em net._chamadas para os testes conferirem. Extensão pg_net de verdade não está instalada nesta máquina (ver README).';

create table if not exists net._chamadas (
  id            bigserial primary key,
  metodo        text not null check (metodo in ('GET', 'POST')),
  url           text not null,
  corpo         jsonb,
  parametros    jsonb,
  cabecalhos    jsonb,
  timeout_ms    integer,
  chamado_por   text not null default current_user,
  chamado_em    timestamptz not null default clock_timestamp()
);
comment on table net._chamadas is 'sem-docker: histórico das chamadas que passariam por net.http_post/net.http_get, só para os testes conferirem o que seria enviado (método, url, corpo, quem chamou). Não existe no pg_net real.';

grant select, insert on net._chamadas to postgres, service_role;
grant usage, select on all sequences in schema net to postgres, service_role;

create or replace function net.http_post(
  url                  text,
  body                 jsonb default null,
  params               jsonb default '{}'::jsonb,
  headers              jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
)
returns bigint
language plpgsql
as $$
declare
  id_chamada bigint;
begin
  insert into net._chamadas (metodo, url, corpo, parametros, cabecalhos, timeout_ms)
  values ('POST', url, body, params, headers, timeout_milliseconds)
  returning id into id_chamada;
  return id_chamada;
end;
$$;
comment on function net.http_post(text, jsonb, jsonb, jsonb, integer) is 'sem-docker: mesma assinatura de net.http_post do pg_net. Não sai da máquina; grava em net._chamadas e devolve um id sequencial na hora (o pg_net real devolve o id de uma fila processada em background).';

create or replace function net.http_get(
  url                  text,
  params               jsonb default '{}'::jsonb,
  headers              jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
)
returns bigint
language plpgsql
as $$
declare
  id_chamada bigint;
begin
  insert into net._chamadas (metodo, url, corpo, parametros, cabecalhos, timeout_ms)
  values ('GET', url, null, params, headers, timeout_milliseconds)
  returning id into id_chamada;
  return id_chamada;
end;
$$;
comment on function net.http_get(text, jsonb, jsonb, integer) is 'sem-docker: mesma assinatura de net.http_get do pg_net. Não sai da máquina; grava em net._chamadas.';

grant execute on function net.http_post(text, jsonb, jsonb, jsonb, integer) to postgres, service_role;
grant execute on function net.http_get(text, jsonb, jsonb, integer)        to postgres, service_role;


-- -----------------------------------------------------------------------------
-- 6. Schema vault: stub da Supabase Vault
--
-- Imita: a superfície que o projeto usa (PRD 10.2: segredo da rota
-- /api/interno/automacao guardado na Vault) -- a tabela vault.secrets, a
-- função vault.create_secret e a view vault.decrypted_secrets, com as
-- mesmas colunas e a mesma assinatura do Supabase real.
--
-- Difere, e isto é o mais importante deste bloco: NÃO CIFRA NADA. O
-- Supabase real cifra o segredo com pgsodium e uma chave gerenciada fora do
-- banco; a view vault.decrypted_secrets decifra na leitura. Aqui
-- vault.secrets.secret fica em texto puro dentro do Postgres, e
-- decrypted_secrets é só um "select" direto dessa coluna. Nunca trate o
-- conteúdo desta tabela, neste ambiente, como protegido -- e nunca coloque
-- segredo de verdade nela (aliás, nenhum segredo de verdade entra no
-- sem-docker: é ambiente local com dado sintético, como todo o resto).
-- -----------------------------------------------------------------------------

create schema if not exists vault;
grant usage on schema vault to postgres, service_role;
comment on schema vault is 'sem-docker: stub da Supabase Vault. NÃO CIFRA NADA -- vault.secrets.secret fica em texto puro. Ver README.';

create table if not exists vault.secrets (
  id          uuid primary key default extensions.gen_random_uuid(),
  name        text unique,
  description text not null default '',
  secret      text not null,
  key_id      uuid,
  nonce       bytea,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table vault.secrets is 'sem-docker: mesmas colunas da vault.secrets real, mas "secret" fica em texto puro (a real guarda cifrado e só decifra na view decrypted_secrets).';

grant select, insert, update, delete on vault.secrets to postgres, service_role;

create or replace function vault.create_secret(
  new_secret      text,
  new_name        text default null,
  new_description text default ''
)
returns uuid
language plpgsql
as $$
declare
  id_segredo uuid;
begin
  insert into vault.secrets (name, description, secret)
  values (new_name, coalesce(new_description, ''), new_secret)
  returning id into id_segredo;
  return id_segredo;
end;
$$;
comment on function vault.create_secret(text, text, text) is 'sem-docker: mesma assinatura de vault.create_secret do Supabase. Não cifra: grava o segredo em texto puro.';

grant execute on function vault.create_secret(text, text, text) to postgres, service_role;

create or replace view vault.decrypted_secrets
with (security_invoker = true)
as
  select
    id,
    name,
    description,
    secret as decrypted_secret,
    key_id,
    nonce,
    created_at,
    updated_at
  from vault.secrets;
comment on view vault.decrypted_secrets is 'sem-docker: mesmo formato da view real (coluna decrypted_secret), mas é só um alias direto de secrets.secret -- não existe cifra pra desfazer aqui.';

grant select on vault.decrypted_secrets to postgres, service_role;


-- -----------------------------------------------------------------------------
-- 7. pg_cron: extensão de verdade
--
-- Imita: pg_cron roda de verdade aqui (a biblioteca está instalada nesta
-- máquina). O Supabase real também roda pg_cron dentro do próprio banco do
-- projeto.
--
-- Difere: shared_preload_libraries e cron.database_name são parâmetros de
-- SERVIDOR (não dá para mudar por SQL depois que o Postgres já subiu). No
-- Supabase real a plataforma cuida disso; aqui é o scripts/iniciar.sh que
-- escreve os dois no postgresql.conf do cluster ANTES do primeiro start.
-- Se "create extension pg_cron" abaixo falhar com algo como "pg_cron must
-- be loaded via shared_preload_libraries", o cluster em $PGDATA foi criado
-- antes dessa configuração existir: apague o diretório (ou rode
-- scripts/parar.sh e apague $PGDATA) e rode scripts/iniciar.sh de novo.
-- -----------------------------------------------------------------------------

create extension if not exists pg_cron;
comment on extension pg_cron is 'sem-docker: extensão real, igual ao Supabase. cron.database_name e shared_preload_libraries são configurados pelo scripts/iniciar.sh no postgresql.conf, antes do primeiro start do servidor.';

grant usage on schema cron to postgres, service_role;


-- -----------------------------------------------------------------------------
-- Fora de escopo, de propósito: schema storage
--
-- O Supabase Storage (schema "storage", buckets, políticas de objeto) não
-- entra na camada sem-docker. Nenhuma sessão de P01 a P09, P20 ou P21 lê ou
-- escreve nesse schema (o projeto usa Supabase Storage só a partir de
-- sessões posteriores, para PDF e áudio). Se uma sessão futura precisar
-- testar política de storage sem Docker, o jeito mais simples é acrescentar
-- aqui uma tabela storage.objects mínima (bucket_id, name, owner, metadata)
-- só com as colunas que a política testada usa -- não existe hoje porque
-- ainda não tem RLS de storage para reproduzir.
-- =============================================================================
