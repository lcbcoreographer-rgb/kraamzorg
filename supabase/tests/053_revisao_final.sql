-- =============================================================================
-- supabase/tests/053_revisao_final.sql
--
-- Revisão final de segurança (P53), sobre todas as migrations. Em vez de
-- listar função por função, varre o catálogo e chama cada função de api com
-- ids reais do seed, como um atacante faria pelo PostgREST:
--   1. Catálogo: nenhuma função dos schemas do app executável por anon ou por
--      PUBLIC; toda security definer com search_path vazio; toda tabela com
--      RLS; nenhuma função de api fora de security definer.
--   2. Papel: toda função de api recusa (42501) quem está logado sem papel
--      (a conta da família no portal, P49), em AAL2.
--   3. IDOR: uma enfermeira sem designação e uma pessoa do marketing chamam
--      toda função de api que recebe id, com ids reais de famílias, visitas,
--      relatórios, alertas, registros e cobranças. Nenhuma resposta traz id
--      de família, de pessoa ou de visita.
--   4. RLS: a conta sem papel não lê linha nenhuma das tabelas de public,
--      além do próprio perfil.
--
-- Nada disto falhava na revisão: o teste registra o que está fechado, para
-- uma migration nova não abrir sem ninguém ver. Só dado sintético, criado
-- aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(9);

-- -----------------------------------------------------------------------------
-- 0. Preparação: quatro contas sintéticas
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a5300000-0000-4000-8000-0000000000e1', 'p53.enfermeira.b@exemplo.invalid'),
  ('a5300000-0000-4000-8000-0000000000e2', 'p53.marketing@exemplo.invalid'),
  ('a5300000-0000-4000-8000-0000000000e3', 'p53.sem.papel@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a5300000-0000-4000-8000-0000000000e1', 'Perfil Teste Enfermeira B P53', 'p53.enfermeira.b@exemplo.invalid', true),
  ('a5300000-0000-4000-8000-0000000000e2', 'Perfil Teste Marketing P53', 'p53.marketing@exemplo.invalid', true),
  ('a5300000-0000-4000-8000-0000000000e3', 'Perfil Teste Sem Papel P53', 'p53.sem.papel@exemplo.invalid', true)
on conflict (id) do nothing;

insert into usuario_papel (usuario_id, papel) values
  ('a5300000-0000-4000-8000-0000000000e1', 'enfermeira'),
  ('a5300000-0000-4000-8000-0000000000e2', 'marketing');

insert into profissional (usuario_id, nome, funcao, ativa)
values ('a5300000-0000-4000-8000-0000000000e1', 'Profissional Teste B P53', 'enfermeira', true);

create temp table p53_resultado (funcao text, papel text, estado text, retorno text);
grant all on p53_resultado to public;

-- ids que o atacante tenta, por nome de parâmetro
create temp table p53_alvo (param text, tabela text);
grant all on p53_alvo to public;
insert into p53_alvo values
  ('familia_id', 'public.familia'), ('p_familia_id', 'public.familia'),
  ('visita_id', 'public.visita'), ('p_relatorio_id', 'public.relatorio_medico'),
  ('p_acompanhamento_id', 'public.acompanhamento'), ('acompanhamento_id', 'public.acompanhamento'),
  ('alerta_id', 'public.alerta_clinico'), ('registro_id', 'public.registro_atendimento'),
  ('p_ocorrencia_id', 'public.ocorrencia'), ('designacao_id', 'public.designacao'),
  ('consulta_id', 'public.consulta_prenatal'), ('p_nota_id', 'public.nota_fiscal'),
  ('contrato_id', 'public.contrato'), ('sessao_id', 'public.sessao_venda'),
  ('cobranca_id', 'public.cobranca'), ('oportunidade_id', 'public.oportunidade'),
  ('conversa_id', 'public.conversa'), ('p_conversa_id', 'public.conversa'),
  ('pessoa_id', 'public.pessoa'), ('handoff_id', 'public.handoff'),
  ('p_pos_venda_id', 'public.pos_venda'), ('tarefa_id', 'public.tarefa'),
  ('medico_id', 'public.medico'), ('bebe_id', 'public.bebe'), ('p_bebe_id', 'public.bebe');

-- -----------------------------------------------------------------------------
-- 1. Catálogo
-- -----------------------------------------------------------------------------

select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'api', 'privado', 'assistencial', 'agente', 'agente_n8n')
      and p.proname not like 'teste\_%'
      and (has_function_privilege('anon', p.oid, 'execute')
           or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE'))),
  '{}'::text[],
  'nenhuma função dos schemas do app é executável por anon ou por PUBLIC');

select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('public', 'api', 'privado', 'assistencial', 'agente', 'agente_n8n')
      and not coalesce(p.proconfig @> array['search_path=""'] or p.proconfig @> array['search_path='], false)),
  '{}'::text[],
  'toda função security definer tem search_path vazio');

select is(
  (select coalesce(array_agg(n.nspname || '.' || c.relname order by 1), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname in ('public', 'api', 'privado', 'assistencial', 'agente', 'agente_n8n')
      and not c.relrowsecurity),
  '{}'::text[],
  'toda tabela dos schemas do app tem RLS ligada');

select is(
  (select coalesce(array_agg(p.proname::text order by 1), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api' and not p.prosecdef and p.proname not like 'teste\_%'),
  '{}'::text[],
  'toda função de api é security definer (checa papel e AAL por dentro)');

-- -----------------------------------------------------------------------------
-- 2. Conta sem papel (portal da família) contra toda função de api
-- -----------------------------------------------------------------------------

do $$
declare
  f    record;
  args text;
begin
  for f in
    select p.proname, array(select unnest(p.proargtypes::oid[])) as tipos
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'api' and p.proname not like 'teste\_%'
  loop
    select string_agg('null::' || format_type(t, null), ',') into args from unnest(f.tipos) t;
    begin
      perform testes.autenticar('authenticated', 'a5300000-0000-4000-8000-0000000000e3', 'aal2');
      execute format('select api.%I(%s)', f.proname, coalesce(args, ''));
      reset role;
      insert into p53_resultado values (f.proname, 'sem_papel', 'executou', null);
    exception when others then
      reset role;
      if sqlstate <> '42501' then
        insert into p53_resultado values (f.proname, 'sem_papel', sqlstate, null);
      end if;
    end;
  end loop;
end $$;

-- api.transicoes_permitidas valida a máquina antes do papel e devolve 22023
-- sem ler nada; api.portal_familia (P49) é da conta da família e recusa com
-- 42501 quando não há acesso liberado.
select is(
  (select coalesce(array_agg(funcao || ':' || estado order by 1), '{}') from p53_resultado
    where papel = 'sem_papel' and funcao <> 'transicoes_permitidas'),
  '{}'::text[],
  'a conta sem papel é recusada (42501) por toda função de api');

-- -----------------------------------------------------------------------------
-- 3. IDOR: enfermeira sem designação e marketing com ids reais do seed
-- -----------------------------------------------------------------------------

do $$
declare
  f      record;
  a      record;
  ids    uuid[];
  v      uuid;
  args   text;
  ret    text;
  quem   record;
begin
  for quem in
    select * from (values ('enfermeira', 'a5300000-0000-4000-8000-0000000000e1'::uuid),
                          ('marketing',  'a5300000-0000-4000-8000-0000000000e2'::uuid)) q(papel, uid)
  loop
    for f in
      select p.proname, p.proargnames, array(select unnest(p.proargtypes::oid[])) as tipos
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'api' and 'uuid'::regtype = any (p.proargtypes::oid[])
    loop
      for a in
        select i, m.tabela
          from generate_subscripts(f.tipos, 1) i
          join p53_alvo m on m.param = f.proargnames[i]
         where f.tipos[i] = 'uuid'::regtype
      loop
        execute format('select array_agg(id) from (select id from %s order by id limit 3) x', a.tabela) into ids;
        continue when ids is null;
        foreach v in array ids loop
          select string_agg(case when j = a.i then quote_literal(v) || '::uuid'
                                 else 'null::' || format_type(f.tipos[j], null) end, ',' order by j)
            into args from generate_subscripts(f.tipos, 1) j;
          begin
            perform testes.autenticar('authenticated', quem.uid, 'aal2');
            execute format('select (api.%I(%s))::text', f.proname, args) into ret;
            reset role;
            insert into p53_resultado values (f.proname, quem.papel, 'executou', ret);
          exception when others then
            reset role;
          end;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

select is(
  (select coalesce(array_agg(distinct r.funcao order by r.funcao), '{}')
     from p53_resultado r
    where r.papel = 'enfermeira' and r.retorno is not null
      and (exists (select 1 from public.familia x where strpos(r.retorno, x.id::text) > 0)
           or exists (select 1 from public.pessoa x where strpos(r.retorno, x.id::text) > 0)
           or exists (select 1 from public.visita x where strpos(r.retorno, x.id::text) > 0))),
  '{}'::text[],
  'enfermeira sem designação não recebe id de família, pessoa ou visita de nenhuma função de api');

select is(
  (select coalesce(array_agg(distinct r.funcao order by r.funcao), '{}')
     from p53_resultado r where r.papel = 'marketing'),
  '{}'::text[],
  'marketing não executa nenhuma função de api que recebe id de família, visita ou cobrança');

-- -----------------------------------------------------------------------------
-- 4. RLS: a conta sem papel não lê tabela nenhuma de public
-- -----------------------------------------------------------------------------

create temp table p53_visivel (tabela text, linhas bigint);
grant all on p53_visivel to public;

do $$
declare
  t record;
  n bigint;
begin
  for t in
    select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relkind = 'r'
  loop
    begin
      perform testes.autenticar('authenticated', 'a5300000-0000-4000-8000-0000000000e3', 'aal2');
      execute format('select count(*) from public.%I', t.relname) into n;
      reset role;
      if n > 0 then insert into p53_visivel values (t.relname, n); end if;
    exception when others then
      reset role;
    end;
  end loop;
end $$;

select is(
  (select coalesce(array_agg(tabela || '=' || linhas order by tabela), '{}') from p53_visivel),
  array['perfil=1'],
  'a conta sem papel lê só o próprio perfil');

select ok(
  (select count(*) from public.familia) > 0 and (select count(*) from public.visita) > 0,
  'o seed tem famílias e visitas, então a varredura de IDOR não ficou vazia');

select * from finish();
rollback;
