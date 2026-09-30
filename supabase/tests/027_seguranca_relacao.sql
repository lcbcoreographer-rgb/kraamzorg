-- =============================================================================
-- supabase/tests/027_seguranca_relacao.sql
--
-- Segurança das funções e das tabelas da migration 0027 (P47 a P51), tentada
-- de fora, como em 024_seguranca_onda.sql:
--   1. Matriz papel x AAL: cada função de api recusa (42501) quem não tem o
--      papel e quem tem o papel sem o AAL2 que a função pede. As funções são
--      chamadas com argumentos nulos: a checagem de papel vem antes de tudo,
--      então uma recusa de negócio (P0001) prova que passou pela porta.
--   2. Concessões: anon não executa nada; api só para authenticated; as
--      funções abertas de public só para service_role; nenhuma função nova de
--      privado é executável pelo app.
--   3. As tabelas novas têm RLS e nenhuma concessão, e as que guardam
--      alteração têm o gatilho de auditoria.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(9);

insert into auth.users (id, email)
select ('a2701000-0000-4000-8000-00000000000' || n)::uuid, 'papel' || n || '.seg27@exemplo.invalid' from generate_series(1, 6) n;
insert into perfil (id, nome, email, ativo)
select ('a2701000-0000-4000-8000-00000000000' || n)::uuid, 'Perfil Teste Seg27 ' || n, 'papel' || n || '.seg27@exemplo.invalid', true from generate_series(1, 6) n;
insert into usuario_papel (usuario_id, papel) values
  ('a2701000-0000-4000-8000-000000000001', 'comercial'),
  ('a2701000-0000-4000-8000-000000000002', 'enfermeira'),
  ('a2701000-0000-4000-8000-000000000003', 'financeiro'),
  ('a2701000-0000-4000-8000-000000000004', 'marketing'),
  ('a2701000-0000-4000-8000-000000000005', 'coordenacao'),
  ('a2701000-0000-4000-8000-000000000006', 'diretoria');

create temp table esperado_fn (fn text primary key, papeis text[] not null, exige_aal2 boolean not null);
insert into esperado_fn values
  ('marketing_canais',               '{marketing,diretoria}', false),
  ('marketing_canal_salvar',         '{marketing,diretoria}', false),
  ('marketing_custo_salvar',         '{financeiro,diretoria}', true),
  ('marketing_relatorio',            '{marketing,diretoria,financeiro}', false),
  ('marketing_exportar',             '{marketing,diretoria}', false),
  ('copiloto_config',                '{comercial,diretoria}', false),
  ('copiloto_registrar',             '{comercial,diretoria}', false),
  ('copiloto_historico',             '{comercial,diretoria}', false),
  ('copiloto_pipeline',              '{comercial,diretoria}', false),
  ('copiloto_conversao',             '{comercial,diretoria}', false),
  ('copiloto_leads_origem',          '{comercial,diretoria}', false),
  ('copiloto_receita',               '{financeiro,diretoria}', true),
  ('copiloto_ocupacao',              '{comercial,coordenacao,diretoria}', false),
  ('portal_familia',                 '{}', false),
  ('portal_familia_acessos',         '{comercial,coordenacao,diretoria}', false),
  ('portal_familia_liberar',         '{comercial,coordenacao,diretoria}', false),
  ('portal_familia_suspender',       '{comercial,coordenacao,diretoria}', false),
  ('profissionais_portal',           '{coordenacao,diretoria}', false),
  ('profissional_portal_salvar',     '{enfermeira,coordenacao,diretoria}', false),
  ('parceiros_listar',               '{comercial,diretoria}', false),
  ('parceiro_salvar',                '{comercial,diretoria}', false),
  ('parceiro_contato_registrar',     '{comercial,diretoria}', false),
  ('parceiro_tarefa_criar',          '{comercial,diretoria}', false),
  ('indicacao_registrar',            '{comercial,diretoria}', false),
  ('indicacoes_relatorio',           '{comercial,diretoria}', false),
  ('tarefas_por_equipe',             '{coordenacao,diretoria}', true),
  ('manuais_listar',                 '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', false),
  ('manual_obter',                   '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', false),
  ('manual_confirmar_leitura',       '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', false),
  ('trilhas_listar',                 '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', false),
  ('manual_salvar',                  '{coordenacao,diretoria}', true),
  ('manual_leituras',                '{coordenacao,diretoria}', true),
  ('trilha_salvar',                  '{coordenacao,diretoria}', true),
  ('talentos_roteiro',               '{coordenacao,diretoria}', true),
  ('talentos_listar',                '{coordenacao,diretoria}', true),
  ('talento_obter',                  '{coordenacao,diretoria}', true),
  ('talento_salvar',                 '{coordenacao,diretoria}', true),
  ('talento_estado',                 '{coordenacao,diretoria}', true),
  ('talento_avaliar',                '{coordenacao,diretoria}', true);
grant all on esperado_fn to public;

create temp table observado (fn text, papel text, aal text, resultado text);
grant all on observado to public;

-- Chama cada função com argumentos nulos, como cada papel em cada AAL. Recusa
-- 42501 = negado; qualquer outro desfecho (sucesso ou recusa de negócio) = a
-- porta abriu. Cada chamada roda numa subtransação, então nada fica gravado.
do $$
declare
  v_fn    record;
  v_papel record;
  v_aal   text;
  v_res   text;
  v_args  text;
begin
  for v_fn in select e.fn, p.oid from esperado_fn e join pg_proc p on p.proname = e.fn and p.pronamespace = 'api'::regnamespace loop
    select coalesce(string_agg('null::' || format_type(t, null), ', '), '')
      into v_args
    from unnest((select proargtypes::oid[] from pg_proc where oid = v_fn.oid)) t;
    for v_papel in select * from (values
        ('a2701000-0000-4000-8000-000000000001', 'comercial'), ('a2701000-0000-4000-8000-000000000002', 'enfermeira'),
        ('a2701000-0000-4000-8000-000000000003', 'financeiro'), ('a2701000-0000-4000-8000-000000000004', 'marketing'),
        ('a2701000-0000-4000-8000-000000000005', 'coordenacao'), ('a2701000-0000-4000-8000-000000000006', 'diretoria')) x(id, papel) loop
      foreach v_aal in array array['aal1', 'aal2'] loop
        perform testes.autenticar_authenticated(v_papel.id::uuid, v_aal);
        begin
          execute 'select api.' || v_fn.fn || '(' || v_args || ')';
          v_res := 'aberta';
        exception when insufficient_privilege then
          v_res := 'negada';
        when others then
          v_res := 'aberta';
        end;
        perform testes.encerrar();
        insert into observado values (v_fn.fn, v_papel.papel, v_aal, v_res);
      end loop;
    end loop;
  end loop;
end $$;

select is((select count(*)::integer from observado), 39 * 12, 'a matriz chamou as 39 funções, em 6 papéis e 2 níveis de AAL');

select is_empty(
  $$ select o.fn, o.papel, o.aal, o.resultado
     from observado o join esperado_fn e on e.fn = o.fn
     where o.resultado <> case
       when o.papel = any (e.papeis)
            and (o.aal = 'aal2' or (not e.exige_aal2 and o.papel in ('comercial', 'marketing')))
       then 'aberta' else 'negada' end $$,
  'cada função abre só para o papel certo, e pede o AAL2 de quem tem MFA ou da função que o exige');

select ok(not exists (select 1 from observado where fn = 'portal_familia' and resultado = 'aberta'),
  'nenhum papel da equipe abre o portal da família');

-- Concessões
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join esperado_fn e on e.fn = p.proname
     where p.pronamespace = 'api'::regnamespace
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute')
            or not has_function_privilege('authenticated', p.oid, 'execute')) $$,
  'as 39 funções de api: authenticated executa; anon e service_role não');

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('captacao_pagina', 'captacao_iniciar', 'portal_familia_localizar', 'portal_familia_vincular', 'portal_familia_pagina', 'candidatura_abrir', 'candidatura_enviar')
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
            or not has_function_privilege('service_role', p.oid, 'execute')
            or not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)) $$,
  'as sete funções abertas de public: só service_role executa, security definer e search_path vazio');

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'privado'::regnamespace
       and p.proname ~ '^(relacao_|captacao_|textos_site|portal_acesso|parceiro_so_sem_familia|manual_versao_imutavel|manual_visivel)'
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'as funções internas novas de privado não são executáveis por nenhum papel do app');

-- Tabelas
select is_empty(
  $$ select c.oid::regclass::text from pg_class c
     where c.relnamespace = 'privado'::regnamespace and c.relkind = 'r'
       and c.relname in ('limite_publico', 'canal_captacao', 'captacao_visita', 'conversa_origem', 'custo_canal', 'copiloto_pergunta',
                         'acesso_familia', 'profissional_portal', 'parceiro_medico', 'indicacao', 'manual', 'manual_versao', 'manual_leitura',
                         'trilha', 'trilha_item', 'candidata', 'candidata_avaliacao')
       and (not c.relrowsecurity
            or has_table_privilege('anon', c.oid, 'select,insert,update,delete')
            or has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')
            or has_table_privilege('service_role', c.oid, 'select,insert,update,delete')) $$,
  'as 17 tabelas novas: RLS ligada e nenhuma concessão a anon, authenticated nem service_role');

select is_empty(
  $$ select t.tabela from (values ('canal_captacao'), ('custo_canal'), ('copiloto_pergunta'), ('acesso_familia'), ('profissional_portal'),
                                  ('parceiro_medico'), ('indicacao'), ('manual'), ('manual_versao'), ('manual_leitura'), ('trilha'),
                                  ('candidata'), ('candidata_avaliacao')) t(tabela)
     where not exists (select 1 from pg_trigger g where g.tgrelid = ('privado.' || t.tabela)::regclass and g.tgname = 'auditar') $$,
  'as tabelas que guardam alteração têm o gatilho de auditoria');

select is_empty(
  $$ select s.entidade || '.' || s.coluna from privado.auditoria_coluna_sensivel s
     where s.entidade like 'privado.%'
       and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'privado' and 'privado.' || c.table_name = s.entidade and c.column_name = s.coluna) $$,
  'toda coluna sensível declarada em privado existe na tabela');

select * from finish();
rollback;
