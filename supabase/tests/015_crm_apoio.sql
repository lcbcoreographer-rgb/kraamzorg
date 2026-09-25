-- =============================================================================
-- supabase/tests/015_crm_apoio.sql
--
-- Migration 0015_crm_apoio (integração da trilha de banco com o CRM):
--   1. api.revogar_sessoes(usuario_id): só diretoria em AAL2; apaga as
--      sessões e os refresh tokens só do usuário pedido; grava log sem dado
--      pessoal; recusa usuário inexistente e id nulo.
--   2. api.transicoes_permitidas(maquina, de): devolve exatamente as linhas
--      de privado.transicao_permitida; "pode" segue a conferência de papel
--      de privado.transicionar (diretoria não sai de intercorrencia,
--      coordenação cobre enfermeira); mesmos papéis e AAL de
--      api.transicionar; máquina desconhecida recusada.
--   3. api.parametros_da_tela(chaves): lista fechada por papel; chave fora
--      da lista ou do papel recusada com 42501; a tabela parametro continua
--      fechada para quem não é diretoria.
--   4. Privilégios: security definer, search_path vazio, execute só para
--      authenticated.
--
-- Só dado sintético, criado aqui e desfeito no rollback. Não depende do
-- seed (cria os próprios usuários e parâmetros).
-- =============================================================================

begin;

select plan(62);

-- -----------------------------------------------------------------------------
-- 0. Usuários sintéticos (um por papel, um sem papel, um diretor inativo)
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a1500000-0000-4000-8000-000000000001', 'comercial.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000002', 'enfermeira.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000003', 'financeiro.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000004', 'marketing.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000005', 'coordenacao.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000006', 'diretoria.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000007', 'sempapel.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000008', 'diretoriainativa.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000009', 'alvo.p15@exemplo.invalid'),
  ('a1500000-0000-4000-8000-000000000010', 'outro.p15@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a1500000-0000-4000-8000-000000000001', 'Perfil Teste P15 comercial',   'comercial.p15@exemplo.invalid',   true),
  ('a1500000-0000-4000-8000-000000000002', 'Perfil Teste P15 enfermeira',  'enfermeira.p15@exemplo.invalid',  true),
  ('a1500000-0000-4000-8000-000000000003', 'Perfil Teste P15 financeiro',  'financeiro.p15@exemplo.invalid',  true),
  ('a1500000-0000-4000-8000-000000000004', 'Perfil Teste P15 marketing',   'marketing.p15@exemplo.invalid',   true),
  ('a1500000-0000-4000-8000-000000000005', 'Perfil Teste P15 coordenacao', 'coordenacao.p15@exemplo.invalid', true),
  ('a1500000-0000-4000-8000-000000000006', 'Perfil Teste P15 diretoria',   'diretoria.p15@exemplo.invalid',   true),
  ('a1500000-0000-4000-8000-000000000007', 'Perfil Teste P15 sem papel',   'sempapel.p15@exemplo.invalid',    true),
  ('a1500000-0000-4000-8000-000000000008', 'Perfil Teste P15 inativa',     'diretoriainativa.p15@exemplo.invalid', false),
  ('a1500000-0000-4000-8000-000000000009', 'Perfil Teste P15 alvo',        'alvo.p15@exemplo.invalid',        true),
  ('a1500000-0000-4000-8000-000000000010', 'Perfil Teste P15 outro',       'outro.p15@exemplo.invalid',       true);

insert into usuario_papel (usuario_id, papel) values
  ('a1500000-0000-4000-8000-000000000001', 'comercial'),
  ('a1500000-0000-4000-8000-000000000002', 'enfermeira'),
  ('a1500000-0000-4000-8000-000000000003', 'financeiro'),
  ('a1500000-0000-4000-8000-000000000004', 'marketing'),
  ('a1500000-0000-4000-8000-000000000005', 'coordenacao'),
  ('a1500000-0000-4000-8000-000000000006', 'diretoria'),
  ('a1500000-0000-4000-8000-000000000008', 'diretoria'),
  ('a1500000-0000-4000-8000-000000000009', 'comercial'),
  ('a1500000-0000-4000-8000-000000000010', 'comercial');

-- Sessões sintéticas: duas do alvo (uma com refresh token), uma do outro
-- usuário e um refresh token avulso do alvo (formato antigo, sem sessão).
insert into auth.sessions (id, user_id, created_at, aal) values
  ('a1500000-0000-4000-8000-0000000000a1', 'a1500000-0000-4000-8000-000000000009', now(), 'aal1'),
  ('a1500000-0000-4000-8000-0000000000a2', 'a1500000-0000-4000-8000-000000000009', now(), 'aal2'),
  ('a1500000-0000-4000-8000-0000000000b1', 'a1500000-0000-4000-8000-000000000010', now(), 'aal1');
insert into auth.refresh_tokens (token, user_id, revoked, session_id) values
  ('token-teste-p15-a1', 'a1500000-0000-4000-8000-000000000009', false, 'a1500000-0000-4000-8000-0000000000a1'),
  ('token-teste-p15-a2', 'a1500000-0000-4000-8000-000000000009', false, 'a1500000-0000-4000-8000-0000000000a2'),
  ('token-teste-p15-av', 'a1500000-0000-4000-8000-000000000009', false, null),
  ('token-teste-p15-b1', 'a1500000-0000-4000-8000-000000000010', false, 'a1500000-0000-4000-8000-0000000000b1');

-- Parâmetros com valores do teste (o seed do P08 semeia os oficiais)
insert into parametro (chave, valor) values
  ('freio_desfazer_segundos',   '10'),
  ('comercial_resposta_no_app', 'false'),
  ('agente_pausa_humano_horas', '48'),
  ('agente_followup_horas',     '48'),
  ('plantao_telefones',         '["+5511900000003"]')
on conflict (chave) do update set valor = excluded.valor;


-- =============================================================================
-- 1. api.revogar_sessoes
-- =============================================================================

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ select api.revogar_sessoes('a1500000-0000-4000-8000-000000000009') $$,
  '42501', null, 'revogar_sessoes: comercial em aal2 é recusado');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$ select api.revogar_sessoes('a1500000-0000-4000-8000-000000000009') $$,
  '42501', null, 'revogar_sessoes: coordenação em aal2 é recusada');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$ select api.revogar_sessoes('a1500000-0000-4000-8000-000000000009') $$,
  '42501', null, 'revogar_sessoes: diretoria em aal1 é recusada (exige MFA)');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000008', 'aal2');
select throws_ok($$ select api.revogar_sessoes('a1500000-0000-4000-8000-000000000009') $$,
  '42501', null, 'revogar_sessoes: diretoria com perfil desativado é recusada');
select testes.autenticar_anon();
select throws_ok($$ select api.revogar_sessoes('a1500000-0000-4000-8000-000000000009') $$,
  '42501', null, 'revogar_sessoes: anon é recusado');
select testes.encerrar();

select is((select count(*)::integer from auth.sessions where user_id = 'a1500000-0000-4000-8000-000000000009'), 2,
  'as recusas não apagaram nenhuma sessão');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($$ select api.revogar_sessoes(null) $$,
  '22023', null, 'revogar_sessoes: id nulo é recusado');
select throws_ok($$ select api.revogar_sessoes('a1500000-0000-4000-8000-0000000000ff') $$,
  'P0002', null, 'revogar_sessoes: usuário inexistente é recusado');
select throws_ok($$ select count(*) from auth.sessions $$,
  '42501', null, 'authenticated (mesmo a diretoria) não lê auth.sessions direto');

create temp table r15 (chave text primary key, r jsonb) on commit drop;
grant all on r15 to authenticated;
insert into r15 select 'revoga', api.revogar_sessoes('a1500000-0000-4000-8000-000000000009');
select testes.encerrar();

select is((select (r ->> 'sessoes_revogadas')::integer from r15 where chave = 'revoga'), 2,
  'revogar_sessoes devolve as duas sessões revogadas');
select is((select count(*)::integer from auth.sessions where user_id = 'a1500000-0000-4000-8000-000000000009'), 0,
  'nenhuma sessão do alvo sobra');
select is((select count(*)::integer from auth.refresh_tokens where user_id = 'a1500000-0000-4000-8000-000000000009'), 0,
  'nenhum refresh token do alvo sobra (cascata e avulso)');
select is((select count(*)::integer from auth.sessions where user_id = 'a1500000-0000-4000-8000-000000000010'), 1,
  'a sessão de outro usuário fica intacta');
select is((select count(*)::integer from auth.refresh_tokens where user_id = 'a1500000-0000-4000-8000-000000000010'), 1,
  'o refresh token de outro usuário fica intacto');
select results_eq(
  $$ select usuario_id, entidade, (valor_depois ->> 'sessoes_revogadas')::integer, origem
       from log_auditoria
      where acao = 'revogar_sessoes' and entidade_id = 'a1500000-0000-4000-8000-000000000009' $$,
  $$ values ('a1500000-0000-4000-8000-000000000006'::uuid, 'perfil'::text, 2, 'app'::text) $$,
  'revogar_sessoes grava uma linha no log: quem revogou, de quem e quantas');
select ok(
  (select bool_and(coalesce(valor_depois::text, '') not like '%@%' and coalesce(valor_antes::text, '') not like '%@%')
     from log_auditoria where acao = 'revogar_sessoes'),
  'o log da revogação não copia e-mail nem outro dado pessoal');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000006', 'aal2');
select is((api.revogar_sessoes('a1500000-0000-4000-8000-000000000009') ->> 'sessoes_revogadas')::integer, 0,
  'revogar de novo, sem sessão ativa, devolve zero e não falha');
select testes.encerrar();
select is((select count(*)::integer from log_auditoria where acao = 'revogar_sessoes' and entidade_id = 'a1500000-0000-4000-8000-000000000009'), 2,
  'cada revogação pedida fica no log, mesmo sem sessão');


-- =============================================================================
-- 2. api.transicoes_permitidas
-- =============================================================================

-- p1: comercial em aal1 (a mesma regra de api.transicionar)
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000001', 'aal1');
create temp table t15 (origem text, destino text, automatica boolean, papel_minimo papel_usuario, pode boolean) on commit drop;
grant all on t15 to authenticated;
insert into t15 select * from api.transicoes_permitidas('p1', 'novo');
select testes.encerrar();

select set_eq(
  $$ select origem, destino, automatica, papel_minimo from t15 $$,
  $$ select de, para, automatica, papel_minimo from privado.transicao_permitida where maquina = 'p1' and de = 'novo' $$,
  'p1 a partir de novo: exatamente as linhas de transicao_permitida');
select ok((select bool_and(pode) from t15), 'comercial pode todas as saídas de novo no p1');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000001', 'aal1');
select is((select count(*)::integer from api.transicoes_permitidas('p1')),
  22, 'de nulo: todas as transições do p1');
select throws_ok($$ select * from api.transicoes_permitidas('p2', 'proposta_enviada') $$,
  '42501', null, 'p2 em aal1 é recusado (api.transicionar exige AAL2 no p2)');
select throws_ok($$ select * from api.transicoes_permitidas('p9') $$,
  '22023', null, 'máquina desconhecida é recusada');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000001', 'aal2');
select ok((select count(*) > 0 from api.transicoes_permitidas('p2', 'proposta_enviada')),
  'p2 em aal2: comercial vê as saídas de proposta_enviada');
select throws_ok($$ select * from api.transicoes_permitidas('visita', 'agendada') $$,
  '42501', null, 'comercial não vê a máquina de visita');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$ select * from api.transicoes_permitidas('p1', 'novo') $$,
  '42501', null, 'marketing não vê a máquina do p1');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select * from api.transicoes_permitidas('p1', 'novo') $$,
  '42501', null, 'enfermeira não vê a máquina do p1');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000007', 'aal2');
select throws_ok($$ select * from api.transicoes_permitidas('p1', 'novo') $$,
  '42501', null, 'perfil sem papel é recusado');
select testes.autenticar_anon();
select throws_ok($$ select * from api.transicoes_permitidas('p1', 'novo') $$,
  '42501', null, 'anon é recusado');

-- intercorrencia: só a coordenação sai (PRD 7.2), a diretoria não
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000006', 'aal2');
select ok((select count(*) > 0 and not bool_or(pode) from api.transicoes_permitidas('acompanhamento', 'intercorrencia')),
  'diretoria vê as saídas de intercorrencia, todas com pode = falso');
select ok((select bool_and(pode) from api.transicoes_permitidas('p1', 'novo')),
  'diretoria pode as saídas de novo no p1 (substitui o comercial)');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000005', 'aal2');
select ok((select bool_and(pode) from api.transicoes_permitidas('acompanhamento', 'intercorrencia')),
  'coordenação pode todas as saídas de intercorrencia');
select ok((select bool_and(pode) from api.transicoes_permitidas('visita', 'agendada')),
  'coordenação cobre as transições de enfermeira da visita');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($$ select * from api.transicoes_permitidas('visita', 'agendada') $$,
  '42501', null, 'coordenação em aal1 é recusada');

-- enfermeira: pode as de enfermeira, não as de coordenação
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000002', 'aal2');
select results_eq(
  $$ select destino, pode from api.transicoes_permitidas('visita', 'agendada') order by destino $$,
  $$ values ('cancelada'::text, false), ('confirmada', true), ('nao_realizada_familia', true),
            ('nao_realizada_profissional', true), ('reagendada', false) $$,
  'enfermeira: pode as transições de enfermeira da visita e não as da coordenação');
select testes.encerrar();


-- =============================================================================
-- 3. api.parametros_da_tela
-- =============================================================================

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000001', 'aal1');
select results_eq(
  $$ select chave, valor from api.parametros_da_tela(array['freio_desfazer_segundos', 'comercial_resposta_no_app']) $$,
  $$ values ('comercial_resposta_no_app'::text, 'false'::jsonb), ('freio_desfazer_segundos', '10'::jsonb) $$,
  'comercial em aal1 lê as duas chaves que pediu, com o valor do banco');
select set_eq(
  $$ select chave from api.parametros_da_tela() $$,
  $$ values ('freio_desfazer_segundos'), ('comercial_resposta_no_app'), ('agente_pausa_humano_horas'), ('agente_followup_horas') $$,
  'comercial, sem lista: as quatro chaves do papel');
select throws_ok($$ select * from api.parametros_da_tela(array['plantao_telefones']) $$,
  '42501', null, 'plantao_telefones (telefone pessoal) fica fora da lista');
select throws_ok($$ select * from api.parametros_da_tela(array['agente_whitelist']) $$,
  '42501', null, 'agente_whitelist fica fora da lista');
select throws_ok($$ select * from api.parametros_da_tela(array['freio_desfazer_segundos', 'score_pesos']) $$,
  '42501', null, 'uma chave fora da lista recusa o pedido inteiro');
select throws_ok($$ select * from api.parametros_da_tela(array[null]::text[]) $$,
  '42501', null, 'chave nula é recusada');
select is_empty($$ select * from api.parametros_da_tela(array[]::text[]) $$,
  'lista vazia não devolve nada');
select is((select count(*)::integer from parametro), 0,
  'a tabela parametro continua fechada para o comercial (a RLS não devolve linha)');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000002', 'aal2');
select set_eq($$ select chave from api.parametros_da_tela() $$, $$ values ('freio_desfazer_segundos') $$,
  'enfermeira: só o prazo do Desfazer do freio');
select throws_ok($$ select * from api.parametros_da_tela(array['comercial_resposta_no_app']) $$,
  '42501', null, 'enfermeira não lê comercial_resposta_no_app');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000002', 'aal1');
select throws_ok($$ select * from api.parametros_da_tela() $$,
  '42501', null, 'enfermeira em aal1 é recusada (perfil exige MFA)');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000003', 'aal2');
select set_eq($$ select chave from api.parametros_da_tela() $$, $$ values ('freio_desfazer_segundos') $$,
  'financeiro: só o prazo do Desfazer do freio');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000004', 'aal1');
select is_empty($$ select * from api.parametros_da_tela() $$, 'marketing: nenhuma chave');
select throws_ok($$ select * from api.parametros_da_tela(array['freio_desfazer_segundos']) $$,
  '42501', null, 'marketing não lê o prazo do freio');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($$ select * from api.parametros_da_tela() $$,
  '42501', null, 'coordenação em aal1 é recusada (perfil exige MFA)');
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000005', 'aal2');
select is((select valor from api.parametros_da_tela(array['agente_pausa_humano_horas'])), '48'::jsonb,
  'coordenação em aal2 lê agente_pausa_humano_horas');

select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000007', 'aal2');
select throws_ok($$ select * from api.parametros_da_tela() $$,
  '42501', null, 'perfil sem papel é recusado');
select testes.autenticar_anon();
select throws_ok($$ select * from api.parametros_da_tela() $$,
  '42501', null, 'anon é recusado');
select testes.encerrar();

-- chave da lista que ainda não existe em parametro: não inventa valor
delete from parametro where chave = 'agente_followup_horas';
select testes.autenticar_authenticated('a1500000-0000-4000-8000-000000000001', 'aal1');
select is_empty($$ select * from api.parametros_da_tela(array['agente_followup_horas']) $$,
  'chave da lista ausente em parametro: nenhuma linha, nenhum valor inventado');
select testes.encerrar();


-- =============================================================================
-- 4. Privilégios
-- =============================================================================

select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api' and p.proname in ('revogar_sessoes', 'transicoes_permitidas', 'parametros_da_tela')),
  'as três funções são security definer com search_path vazio');
select ok(has_function_privilege('authenticated', 'api.revogar_sessoes(uuid)', 'execute'),
  'authenticated executa api.revogar_sessoes');
select ok(has_function_privilege('authenticated', 'api.transicoes_permitidas(text, text)', 'execute'),
  'authenticated executa api.transicoes_permitidas');
select ok(has_function_privilege('authenticated', 'api.parametros_da_tela(text[])', 'execute'),
  'authenticated executa api.parametros_da_tela');
select ok(not has_function_privilege('anon', 'api.revogar_sessoes(uuid)', 'execute')
      and not has_function_privilege('anon', 'api.transicoes_permitidas(text, text)', 'execute')
      and not has_function_privilege('anon', 'api.parametros_da_tela(text[])', 'execute'),
  'anon não executa nenhuma das três');
select ok(not has_function_privilege('service_role', 'api.revogar_sessoes(uuid)', 'execute')
      and not has_function_privilege('service_role', 'api.transicoes_permitidas(text, text)', 'execute')
      and not has_function_privilege('service_role', 'api.parametros_da_tela(text[])', 'execute'),
  'service_role não executa nenhuma das três');
select ok(not has_function_privilege('n8n_agente', 'api.revogar_sessoes(uuid)', 'execute')
      and not has_function_privilege('n8n_agente', 'api.transicoes_permitidas(text, text)', 'execute')
      and not has_function_privilege('n8n_agente', 'api.parametros_da_tela(text[])', 'execute'),
  'n8n_agente não executa nenhuma das três');
select ok(not has_table_privilege('authenticated', 'auth.sessions', 'select, delete'),
  'authenticated não tem privilégio em auth.sessions (só pela função)');

select * from finish();

rollback;
