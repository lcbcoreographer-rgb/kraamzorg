-- =============================================================================
-- supabase/tests/000_harness.sql
--
-- P01 (PROMPTS.md) · PRD 5.1, 5.5, 6.0 e 6.10 (regra 11)
--
-- Não é migration: roda só como teste pgTAP, nunca em hml nem em produção
-- (supabase/tests não faz parte de supabase/migrations). Dois papéis:
--
--   1. Cria o schema `testes` com funções auxiliares para os demais arquivos
--      (001, 002, 003, 004...) simularem o papel e o nível de autenticação
--      (AAL) do PostgREST, do jeito descrito em supabase/sem-docker/
--      README.md ("Como simular authenticated em aal1 e aal2"): "set local
--      role" para trocar de papel dentro da transação do teste, e
--      set_config('request.jwt.claims', ..., true) para simular o JWT que
--      auth.uid()/auth.role()/auth.jwt() leem. Fica FORA de qualquer bloco
--      "begin ... rollback" deste arquivo, para persistir de verdade no
--      banco (pg_prove abre uma conexão nova por arquivo de teste).
--   2. Faz o teste de sanidade do P01: extensões, schemas, privado.sem_acento(),
--      a fronteira de privilégio (nenhum papel além do dono com create em
--      public; execute padrão revogado de public/anon/authenticated nos
--      schemas do projeto) e uma prova de que as próprias funções auxiliares
--      simulam o papel e o AAL corretamente.
--
-- Nomeado 000 para rodar antes de qualquer outro teste (pg_prove ordena por
-- nome de arquivo).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Schema `testes` e funções auxiliares (fora de transação: precisam
--    persistir para os arquivos de teste seguintes, cada um numa conexão
--    própria).
-- -----------------------------------------------------------------------------

create schema if not exists testes;
comment on schema testes is 'sem-docker/pgTAP: só funções auxiliares para simular papel e AAL do PostgREST nos testes. Nunca migra para supabase/migrations, nunca vai para hml nem produção.';

-- A migration 0001 revoga o execute padrão de public em TODO schema (item 4
-- daquela migration), inclusive schemas criados depois dela, como este. Sem
-- os grants abaixo, um teste que troca para anon/authenticated (para provar
-- que RLS ou uma política nega algo) ficaria travado: não conseguiria nem
-- chamar testes.encerrar() para voltar a ser o dono. Concede geral porque
-- este schema só existe para pgTAP local, nunca migra para hml/prod.
grant usage on schema testes to anon, authenticated, service_role;

-- Troca para o papel pedido dentro da transação corrente ("set local role",
-- válido só até o fim da transação, igual ao PostgREST troca por requisição)
-- e grava o JWT simulado que auth.uid()/auth.role()/auth.jwt() leem.
-- papel:  'anon' | 'authenticated' | 'service_role' (ou qualquer papel de
--         login futuro, como n8n_agente a partir do P21).
-- sub:    id simulado do usuário (auth.users.id); ignorado para anon.
-- aal:    'aal1' | 'aal2' | null (null = claim "aal" ausente do JWT, caso
--         real de sessão sem MFA configurado). Ignorado para anon e
--         service_role, que não carregam JWT de usuário.
create or replace function testes.autenticar(papel text, sub uuid default null, aal text default null)
returns void
language plpgsql
as $$
declare
  claims jsonb;
begin
  execute format('set local role %I', papel);

  if papel = 'service_role' then
    -- service_role real não chega com JWT de usuário (a chave é usada
    -- direto, sem passar pela troca de papel do PostgREST por claim).
    perform set_config('request.jwt.claims', '', true);
    return;
  end if;

  -- anon real também carrega "role" no JWT que o PostgREST resolve (é por
  -- isso que "auth.role() = 'anon'" é uma política válida no Supabase de
  -- verdade); só não tem "sub" nem "aal", porque não há usuário logado.
  claims := jsonb_build_object('role', papel);
  if papel <> 'anon' then
    claims := claims || jsonb_build_object('sub', coalesce(sub, extensions.gen_random_uuid()));
    if aal is not null then
      claims := claims || jsonb_build_object('aal', aal);
    end if;
  end if;
  perform set_config('request.jwt.claims', claims::text, true);
end;
$$;
comment on function testes.autenticar(text, uuid, text) is 'sem-docker/pgTAP: troca de papel (set local role) e simula o JWT (request.jwt.claims) dentro da transação do teste. Ver supabase/sem-docker/README.md.';

create or replace function testes.autenticar_anon()
returns void language sql as $$ select testes.autenticar('anon') $$;
comment on function testes.autenticar_anon() is 'sem-docker/pgTAP: atalho para testes.autenticar(''anon'').';

create or replace function testes.autenticar_authenticated(sub uuid, aal text default 'aal1')
returns void language sql as $$ select testes.autenticar('authenticated', sub, aal) $$;
comment on function testes.autenticar_authenticated(uuid, text) is 'sem-docker/pgTAP: atalho para testes.autenticar(''authenticated'', sub, aal). aal padrão ''aal1'' (login sem desafio de MFA ainda feito).';

create or replace function testes.autenticar_service_role()
returns void language sql as $$ select testes.autenticar('service_role') $$;
comment on function testes.autenticar_service_role() is 'sem-docker/pgTAP: atalho para testes.autenticar(''service_role''). bypassrls ligado, igual ao Supabase real.';

-- Volta ao papel de conexão (postgres, dono do teste) e limpa o JWT simulado.
-- "reset role" desfaz só o "set local role" da transação corrente.
create or replace function testes.encerrar()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;
comment on function testes.encerrar() is 'sem-docker/pgTAP: desfaz testes.autenticar(...) (reset role + limpa o JWT simulado). Chamar no fim de um teste que trocou de papel, antes de qualquer asserção que precise ser dono/postgres de novo.';

-- execute para os papéis que os testes simulam (ver comentário do "grant
-- usage on schema testes" acima: a migration 0001 revoga o execute padrão
-- de public em todo schema, este incluído).
grant execute on all functions in schema testes to anon, authenticated, service_role;
alter default privileges in schema testes grant execute on functions to anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. Teste de sanidade (dentro de transação; "rollback" no fim, nada deste
--    bloco persiste além das definições da seção 1 acima).
-- -----------------------------------------------------------------------------

begin;

select plan(34);

-- --- Schemas (PRD 6.0 e 5.2) -------------------------------------------------

select has_schema('extensions',   'schema extensions existe (pgcrypto, uuid-ossp, pg_trgm, unaccent, vector, btree_gist, pgtap)');
select has_schema('agente',       'schema agente existe (fronteira do agente, PRD 11.10)');
select has_schema('agente_n8n',   'schema agente_n8n existe (tabelas dos nós LangChain, PRD 6.8)');
select has_schema('privado',      'schema privado existe (funções internas, nunca exposto ao PostgREST)');
select has_schema('assistencial', 'schema assistencial existe (leitura e escrita auditada de dado clínico)');
select has_schema('api',          'schema api existe (única porta além de public para o PostgREST)');

-- --- Extensões (PRD 6.0) -----------------------------------------------------

select has_extension('pgcrypto',    'extensão pgcrypto ligada');
select has_extension('uuid-ossp',   'extensão uuid-ossp ligada (exigida pelos nós LangChain do n8n)');
select has_extension('pg_trgm',     'extensão pg_trgm ligada (deduplicação por nome)');
select has_extension('unaccent',    'extensão unaccent ligada');
select has_extension('vector',      'extensão vector ligada (RAG do agente)');
select has_extension('btree_gist',  'extensão btree_gist ligada (exclusão de vigência de pacote_versao, 6.3)');
select has_extension('pg_cron',     'extensão pg_cron ligada (motor de automações, PRD 10)');
select has_extension('pg_net',      'extensão pg_net ligada (FALSA nesta máquina, ver supabase/sem-docker/README.md)');

-- --- privado.sem_acento() (PRD 6.0) ------------------------------------------

select has_function('privado', 'sem_acento', array['text'], 'privado.sem_acento(text) existe');
select is(privado.sem_acento('São Paulo'), 'Sao Paulo', 'privado.sem_acento remove acento e cedilha não muda (cidade sem cedilha)');
select is(privado.sem_acento('Conceição do Araguaia'), 'Conceicao do Araguaia', 'privado.sem_acento remove acento inclusive de cedilha');

-- --- Nenhum papel além do dono com create em public (PRD 11.10) -------------

select ok(not has_schema_privilege('anon', 'public', 'create'),          'anon não tem create em public');
select ok(not has_schema_privilege('authenticated', 'public', 'create'), 'authenticated não tem create em public');
select ok(not has_schema_privilege('service_role', 'public', 'create'),  'service_role não tem create em public');

-- --- execute padrão de public revogado em cada schema (PRD 5.2 e 11.10) -----
-- Cria uma função descartável em cada schema como o dono (postgres, o
-- mesmo papel que roda a migration 0001) e confere que anon e authenticated
-- não ganham execute por padrão; service_role continua com o de fábrica
-- (ele não foi revogado, só anon/authenticated em public).

create function public.teste_execute_padrao()       returns void language sql as $$ select 1 $$;
create function privado.teste_execute_padrao()      returns void language sql as $$ select 1 $$;
create function assistencial.teste_execute_padrao() returns void language sql as $$ select 1 $$;
create function agente.teste_execute_padrao()       returns void language sql as $$ select 1 $$;
create function api.teste_execute_padrao()          returns void language sql as $$ select 1 $$;

select ok(
  not has_function_privilege('anon', 'public.teste_execute_padrao()', 'execute')
  and not has_function_privilege('authenticated', 'public.teste_execute_padrao()', 'execute'),
  'função nova em public nasce sem execute para anon/authenticated'
);
select ok(
  not has_function_privilege('anon', 'privado.teste_execute_padrao()', 'execute')
  and not has_function_privilege('authenticated', 'privado.teste_execute_padrao()', 'execute'),
  'função nova em privado nasce sem execute para anon/authenticated'
);
select ok(
  not has_function_privilege('anon', 'assistencial.teste_execute_padrao()', 'execute')
  and not has_function_privilege('authenticated', 'assistencial.teste_execute_padrao()', 'execute'),
  'função nova em assistencial nasce sem execute para anon/authenticated'
);
select ok(
  not has_function_privilege('anon', 'agente.teste_execute_padrao()', 'execute')
  and not has_function_privilege('authenticated', 'agente.teste_execute_padrao()', 'execute'),
  'função nova em agente nasce sem execute para anon/authenticated'
);
select ok(
  not has_function_privilege('anon', 'api.teste_execute_padrao()', 'execute')
  and not has_function_privilege('authenticated', 'api.teste_execute_padrao()', 'execute'),
  'função nova em api nasce sem execute para anon/authenticated'
);
select ok(
  has_function_privilege('service_role', 'public.teste_execute_padrao()', 'execute'),
  'service_role continua com o execute de fábrica em public (só anon/authenticated foram revogados)'
);

drop function public.teste_execute_padrao();
drop function privado.teste_execute_padrao();
drop function assistencial.teste_execute_padrao();
drop function agente.teste_execute_padrao();
drop function api.teste_execute_padrao();

-- --- Sanidade do próprio harness: simulação de papel e AAL -------------------

select testes.autenticar_anon();
select is(auth.role(), 'anon', 'testes.autenticar_anon() troca para o papel anon');
select is(current_user, 'anon', 'testes.autenticar_anon() muda current_user para anon');
select testes.encerrar();

select is(current_user, 'postgres', 'testes.encerrar() devolve o papel de conexão (postgres)');

select testes.autenticar_authenticated('11111111-1111-1111-1111-111111111111'::uuid, 'aal1');
select is(auth.role(), 'authenticated',                                   'testes.autenticar_authenticated() troca para o papel authenticated');
select is(auth.uid()::text, '11111111-1111-1111-1111-111111111111',       'testes.autenticar_authenticated() grava o sub certo em auth.uid()');
select is(auth.jwt() ->> 'aal', 'aal1',                                   'testes.autenticar_authenticated() simula aal1 por padrão');
select testes.encerrar();

select testes.autenticar_authenticated('11111111-1111-1111-1111-111111111111'::uuid, 'aal2');
select is(auth.jwt() ->> 'aal', 'aal2', 'testes.autenticar_authenticated() simula aal2 quando pedido (política de MFA, PRD 13)');
select testes.encerrar();

select testes.autenticar_service_role();
select is(current_user, 'service_role', 'testes.autenticar_service_role() troca para o papel service_role');

select * from finish();

rollback;
