-- =============================================================================
-- 0001_extensoes_schemas.sql
--
-- P01 (PROMPTS.md) · PRD 6.0, 5.2 e 11.10
--
-- Extensões e schemas do projeto, antes de qualquer tabela. Cria só o
-- alicerce: nenhuma tabela de negócio nasce aqui (isso começa no P02).
--
-- O que esta migration faz:
--   1. Liga as extensões do capítulo 6.0 no schema `extensions`.
--   2. Cria os schemas de negócio que o app usa (`agente`, `agente_n8n`,
--      `privado`, `assistencial`) e o schema `api`, que é a única porta que
--      o PostgREST expõe além de `public` (PRD 5.2).
--   3. Cria `privado.sem_acento()`, usada por índice de expressão em `cidade`
--      (P02) e por buscas insensíveis a acento no projeto inteiro.
--   4. Revoga o `execute` padrão de `public` (o pseudo-papel, não o schema)
--      em funções futuras de todos os schemas do projeto, e confere que
--      nenhum papel além do dono tem `create` em `public` (PRD 11.10).
--
-- Cada papel de aplicação (anon, authenticated, service_role, n8n_agente)
-- só recebe `usage`/`execute` explícito quando alguma sessão futura precisar
-- (P05 em diante). Até lá, criar algo nestes schemas não dá acesso a
-- ninguém além do dono (postgres/supabase_admin).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensões (PRD 6.0)
--
-- `extensions` já existe e já tem pgcrypto, uuid-ossp, pg_trgm, unaccent,
-- vector, btree_gist e pgtap instalados pela camada sem-docker (mimetiza o
-- que um projeto Supabase novo já traz pronto). As linhas abaixo são
-- idempotentes: aqui não fazem nada; num projeto Supabase novo de verdade,
-- são elas que instalam. `pg_cron` e `pg_net` não recebem `with schema`
-- porque cada um cria o próprio schema (`cron`, `net`); a camada sem-docker
-- também já deixa os dois prontos (pg_net como extensão FALSA, ver
-- supabase/sem-docker/README.md).
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;  -- exigida pelos nós LangChain do n8n
create extension if not exists pg_trgm with schema extensions;      -- deduplicação por similaridade de nome
create extension if not exists unaccent with schema extensions;
create extension if not exists vector with schema extensions;       -- RAG do agente
create extension if not exists btree_gist with schema extensions;   -- vigência sem sobreposição por pacote (6.3)
create extension if not exists pg_cron;
create extension if not exists pg_net;


-- -----------------------------------------------------------------------------
-- 2. Schemas de negócio (PRD 6.0 e 5.2)
--
-- agente        · funções da fronteira do agente (PRD 11.10), security definer,
--                 chamadas só pelo papel n8n_agente (criado no P21).
-- agente_n8n    · só as duas tabelas que os nós LangChain do n8n usam
--                 (documentos, chat_memoria). Nenhuma função entra aqui.
-- privado       · funções internas do sistema, nunca expostas ao PostgREST.
-- assistencial  · funções de leitura e escrita auditada de dado clínico (13).
-- api           · única porta, além de public, que o PostgREST expõe. Toda
--                 chamada do app é uma função security definer daqui, que
--                 confere papel e AAL antes de chamar privado/assistencial.
-- -----------------------------------------------------------------------------

create schema if not exists agente;
comment on schema agente is 'Funções da fronteira do agente de IA (PRD 11.10, Apêndice A). Security definer, chamadas só pelo papel n8n_agente. Nunca devolve dado assistencial.';

create schema if not exists agente_n8n;
comment on schema agente_n8n is 'Só as duas tabelas que os nós LangChain do n8n usam (documentos, chat_memoria, PRD 6.8). O papel n8n_agente recebe create aqui porque os nós rodam "create table if not exists" ao iniciar (PRD 11.10). Nenhuma função entra neste schema, e ele nunca aparece no search_path de função security definer.';

create schema if not exists privado;
comment on schema privado is 'Funções internas do sistema (máquina de estado, freio, automações, auditoria). Nunca exposto ao PostgREST (PRD 5.2).';

create schema if not exists assistencial;
comment on schema assistencial is 'Funções de leitura e escrita auditada de dado clínico (PRD 13). Tabela assistencial não tem select direto: leitura só por assistencial.ler_*, que grava log_auditoria antes de devolver.';

create schema if not exists api;
comment on schema api is 'Única porta, além de public, que o PostgREST expõe (PRD 5.2). Toda função aqui é security definer, confere papel e AAL, e por dentro chama privado/assistencial.';


-- -----------------------------------------------------------------------------
-- 3. privado.sem_acento() (PRD 6.0)
--
-- unaccent() é STABLE e não pode entrar em índice de expressão. O wrapper
-- com dicionário fixo ('extensions.unaccent'::regdictionary) é imutável, o
-- que permite usá-lo no índice único de cidade (P02) e em qualquer
-- comparação sem acento do projeto (termo_alerta, busca de nome).
-- -----------------------------------------------------------------------------

create function privado.sem_acento(texto text) returns text
  language sql immutable parallel safe strict
  set search_path = ''
  as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, texto) $$;

comment on function privado.sem_acento(text) is 'Wrapper imutável de extensions.unaccent(), com dicionário fixo, para poder entrar em índice de expressão (unaccent() sozinha é STABLE). PRD 6.0.';

-- Esta função nasce ANTES do "alter default privileges" da seção 4, então
-- recebe o padrão de fábrica do Postgres (execute para o pseudo-papel
-- public). A revogação explícita abaixo deixa a função igual a todas as
-- outras do projeto: só o dono executa. O P07 concede execute de volta só a
-- authenticated (PRD 11.10: quem grava em cidade precisa dela, porque o
-- índice único calcula a expressão no insert); anon não recebe.
revoke execute on function privado.sem_acento(text) from public;


-- -----------------------------------------------------------------------------
-- 4. Fronteira de privilégio (PRD 5.2 e 11.10)
--
-- "Nenhum acesso" não se consegue só deixando de conceder, porque o
-- Postgres dá `execute` em toda função nova para o pseudo-papel `public`
-- por padrão (PRD 11.10: "o Postgres dá execute em toda função nova para
-- public"). A linha abaixo muda esse padrão para o papel que roda esta
-- migration (postgres): toda função nova criada por ele, em QUALQUER
-- schema (existente hoje ou criado no futuro), nasce sem execute para
-- public.
--
-- [Verificado na prática, nesta máquina, antes de fechar a migration]
-- "alter default privileges IN SCHEMA x revoke execute on functions from
-- public" sozinho não funciona: quando o resultado guardado ficaria igual
-- ao padrão embutido do Postgres (só o dono com privilégio), o Postgres
-- apaga a entrada de pg_default_acl em vez de guardá-la vazia, e uma função
-- nova volta a nascer com execute para public, como se a revogação nunca
-- tivesse rodado. A forma SEM "in schema" (para todos os schemas do papel)
-- não sofre dessa otimização e funciona; é também mais segura, porque cobre
-- os cinco schemas do PRD 11.10 (public, privado, assistencial, agente,
-- api) e qualquer schema futuro dentro de uma migration só. Uma vez
-- revogado no nível global, um "alter default privileges in schema x
-- grant execute on functions to <papel>" comum, específico de um schema,
-- volta a conceder normalmente só para esse schema (confirmado abaixo com
-- anon/authenticated em public) -- é assim que P05 em diante concede, papel
-- por papel, schema por schema.
alter default privileges revoke execute on functions from public;

-- [PRD 11.10] No Supabase, o schema public já vem com default privileges que
-- dão execute a anon e authenticated (é o que supabase/sem-docker/
-- camada-supabase.sql reproduz, seção 3, "alter default privileges in schema
-- public grant all on functions to anon, authenticated, service_role").
-- Essas regras foram fixadas pelo papel que rodou aquele script (postgres),
-- então revogar precisa mirar "for role postgres" para desfazer exatamente
-- isso; diferente do caso acima, aqui sobra uma entrada não trivial (o
-- grant a service_role) depois da revogação, então o "in schema public"
-- funciona normalmente. service_role continua com o default de fábrica
-- (ele roda só no servidor, nunca no navegador nem no n8n, CLAUDE.md).
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. Nenhum papel além do dono com create em public (PRD 11.10, item do P01)
--
-- Desde o Postgres 15, uma base nova já nasce sem "create" em public para o
-- pseudo-papel PUBLIC (comportamento de fábrica, não algo que o Supabase
-- concede). A linha abaixo é defensiva e idempotente: garante o mesmo
-- resultado mesmo que o cluster tenha sido criado de outro jeito. Dono do
-- schema public continua sendo quem já era (postgres/pg_database_owner);
-- nenhum grant de create é passado para anon, authenticated ou service_role.
-- -----------------------------------------------------------------------------

revoke create on schema public from public;
