-- =============================================================================
-- supabase/tests/029_parametros_agente.sql
--
-- Migration 0029_parametros_agente (PRD 6.8, 13 e 22.4 O-16 [v4.5]): os
-- parâmetros do agente ficam fora do app.
--   1. Coluna parametro.restrito e gatilho: chave agente_*, agenda_* e as da
--      lista do PRD 6.8 nascem e continuam restritas; as outras não.
--   2. RLS: nenhum papel do app lê, cria ou altera parâmetro restrito, nem a
--      diretoria; o resto continua como era (só a diretoria lê e grava).
--   3. api.parametros_da_tela: sem parâmetro do agente; chave restrita recusada.
--   4. api.log_auditoria: sem o histórico de parâmetro restrito.
--   5. O n8n segue lendo pelas funções do agente (security definer), sem
--      ler a tabela; privilégios das funções novas.
--
-- Só dado sintético, desfeito no rollback.
-- =============================================================================

begin;

select plan(41);

-- -----------------------------------------------------------------------------
-- 0. Usuários sintéticos
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2900000-0000-4000-8000-000000000001', 'diretoria.p29@exemplo.invalid'),
  ('a2900000-0000-4000-8000-000000000002', 'comercial.p29@exemplo.invalid'),
  ('a2900000-0000-4000-8000-000000000003', 'coordenacao.p29@exemplo.invalid');
insert into perfil (id, nome, email, ativo) values
  ('a2900000-0000-4000-8000-000000000001', 'Perfil Teste P29 diretoria',   'diretoria.p29@exemplo.invalid',   true),
  ('a2900000-0000-4000-8000-000000000002', 'Perfil Teste P29 comercial',   'comercial.p29@exemplo.invalid',   true),
  ('a2900000-0000-4000-8000-000000000003', 'Perfil Teste P29 coordenacao', 'coordenacao.p29@exemplo.invalid', true);
insert into usuario_papel (usuario_id, papel) values
  ('a2900000-0000-4000-8000-000000000001', 'diretoria'),
  ('a2900000-0000-4000-8000-000000000002', 'comercial'),
  ('a2900000-0000-4000-8000-000000000003', 'coordenacao');

-- =============================================================================
-- 1. Coluna e gatilho (como postgres: a regra vale para quem grava, seed incluso)
-- =============================================================================

select has_column('public', 'parametro', 'restrito', 'parametro.restrito existe');
select col_not_null('public', 'parametro', 'restrito', 'parametro.restrito é not null');
select col_default_is('public', 'parametro', 'restrito', 'false', 'parametro.restrito começa falso');

insert into parametro (chave, valor, restrito) values
  ('agente_teste_p29',          '1', false),
  ('agenda_teste_p29',          '2', false),
  ('validador_listas',          '{"palavras":["x"]}', false),
  ('plantao_telefones',         '["+5511900000029"]', false),
  ('alerta_emocional_ativo',    'false', false),
  ('freio_desfazer_segundos',   '10', false),
  ('comercial_resposta_no_app', 'false', false),
  ('whatsapp_janela_horas',     '24', false),
  ('teste_p29_livre',           '"a"', false),
  ('agente_modo',               '"teste"', false),
  ('agente_pausa_humano_horas', '48', false),
  ('agente_followup_horas',     '48', false)
on conflict (chave) do update set valor = excluded.valor, restrito = false;

select is((select restrito from parametro where chave = 'agente_teste_p29'), true,
  'prefixo agente_: o gatilho marca restrito mesmo com falso pedido');
select is((select restrito from parametro where chave = 'agenda_teste_p29'), true,
  'prefixo agenda_: restrito');
select is((select restrito from parametro where chave = 'validador_listas'), true,
  'validador_listas (lista do PRD 6.8): restrito');
select is((select restrito from parametro where chave = 'plantao_telefones'), true,
  'plantao_telefones: restrito');
select is((select restrito from parametro where chave = 'alerta_emocional_ativo'), true,
  'alerta_emocional_ativo: restrito');
select is((select bool_or(restrito) from parametro
            where chave in ('freio_desfazer_segundos', 'comercial_resposta_no_app', 'whatsapp_janela_horas', 'teste_p29_livre')),
  false, 'os parâmetros que o app usa não são restritos');

update parametro set restrito = false where chave = 'agente_teste_p29';
select is((select restrito from parametro where chave = 'agente_teste_p29'), true,
  'o gatilho não deixa desmarcar chave do agente');

update parametro set restrito = true where chave = 'teste_p29_livre';
select is((select restrito from parametro where chave = 'teste_p29_livre'), true,
  'a implantação pode restringir outra chave à mão');
update parametro set restrito = false where chave = 'teste_p29_livre';

select ok(not exists (select 1 from parametro where privado.chave_parametro_restrita(chave) and not restrito),
  'nenhuma chave da regra ficou sem a marca (inclui o seed)');
select ok((select count(*) from parametro where restrito) >= 20,
  'o seed traz mais de vinte parâmetros do agente restritos');
select is(privado.chave_parametro_restrita(null), false, 'chave nula não é restrita');

-- =============================================================================
-- 2. RLS: diretoria não alcança o que é restrito
-- =============================================================================

select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000001', 'aal2');

select is((select count(*)::integer from parametro where chave = 'agente_modo'), 0,
  'diretoria: não lê agente_modo');
select is((select count(*)::integer from parametro where chave like 'agente\_%' or chave like 'agenda\_%'), 0,
  'diretoria: não lê nenhum agente_* nem agenda_*');
select is((select count(*)::integer from parametro where restrito), 0,
  'diretoria: nenhuma linha restrita na leitura');
select is((select count(*)::integer from parametro where chave in ('freio_desfazer_segundos', 'teste_p29_livre')), 2,
  'diretoria: lê o que não é restrito');

update parametro set valor = '"producao"' where chave = 'agente_modo';
select testes.encerrar();
select is((select valor from parametro where chave = 'agente_modo'), '"teste"'::jsonb,
  'diretoria: o update em agente_modo não altera nada');

select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ insert into parametro (chave, valor) values ('agente_novo_p29', '1') $$,
  '42501', null, 'diretoria: não cria chave agente_*');
select throws_ok($$ insert into parametro (chave, valor) values ('agenda_novo_p29', '1') $$,
  '42501', null, 'diretoria: não cria chave agenda_*');
select throws_ok($$ insert into parametro (chave, valor, restrito) values ('teste_p29_nova_restrita', '1', true) $$,
  '42501', null, 'diretoria: não cria chave já marcada restrita');
select lives_ok($$ insert into parametro (chave, valor, descricao) values ('teste_p29_nova', '1', 'sintético') $$,
  'diretoria: cria chave comum');
select throws_ok($$ update parametro set restrito = true where chave = 'teste_p29_nova' $$,
  '42501', null, 'diretoria: não transforma chave comum em restrita');
update parametro set valor = '"b"' where chave = 'teste_p29_livre';
select is((select valor from parametro where chave = 'teste_p29_livre'), '"b"'::jsonb,
  'diretoria: altera parâmetro comum como antes');
select testes.encerrar();

select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000002', 'aal1');
select is((select count(*)::integer from parametro), 0, 'comercial: continua sem ler parametro');
select testes.encerrar();

-- =============================================================================
-- 3. api.parametros_da_tela
-- =============================================================================

select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000002', 'aal1');
select set_eq($$ select chave from api.parametros_da_tela() $$,
  $$ values ('comercial_resposta_no_app'), ('freio_desfazer_segundos') $$,
  'parametros_da_tela: o comercial recebe só as duas chaves que a tela usa');
select throws_ok($$ select * from api.parametros_da_tela(array['agente_pausa_humano_horas']) $$,
  '42501', null, 'parametros_da_tela: agente_pausa_humano_horas recusada');
select throws_ok($$ select * from api.parametros_da_tela(array['agente_followup_horas']) $$,
  '42501', null, 'parametros_da_tela: agente_followup_horas recusada');
select testes.encerrar();

select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ select * from api.parametros_da_tela(array['plantao_telefones']) $$,
  '42501', null, 'parametros_da_tela: nem a diretoria pede chave restrita');
select is((select count(*)::integer from api.parametros_da_tela() where chave like 'agente\_%'), 0,
  'parametros_da_tela: a diretoria não recebe agente_*');
select testes.encerrar();

-- =============================================================================
-- 4. api.log_auditoria: sem o histórico de parâmetro restrito
-- =============================================================================

-- Mudanças feitas por quem tem acesso direto (implantação), para gerar log.
update parametro set valor = '"producao"' where chave = 'agente_modo';
update parametro set valor = '"c"' where chave = 'teste_p29_livre';

select ok(exists (select 1 from log_auditoria where entidade = 'parametro' and entidade_id = 'agente_modo'),
  'controle: o log bruto guarda a mudança de agente_modo (é a leitura pela api que a omite)');
select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000001', 'aal2');
select ok((select count(*) from api.log_auditoria('parametro', 'teste_p29_livre')) >= 1,
  'log_auditoria: o histórico de parâmetro comum continua visível');
select is((select count(*)::integer from api.log_auditoria('parametro', 'agente_modo')), 0,
  'log_auditoria: sem o histórico de agente_modo (valor antes e depois)');
select is((select count(*)::integer from api.log_auditoria('parametro')
            where entidade_id like 'agente\_%' or entidade_id like 'agenda\_%' or entidade_id = 'plantao_telefones'), 0,
  'log_auditoria: lista geral de parâmetros sem chave do agente');
select testes.encerrar();

-- =============================================================================
-- 5. O n8n continua lendo pelas funções; privilégios
-- =============================================================================

select is(privado.agente_parametro('agente_modo'), '"producao"'::jsonb,
  'as funções do agente (security definer) leem o parâmetro restrito');
set local role n8n_agente;
select throws_ok('select count(*) from public.parametro', '42501', null,
  'n8n_agente não lê a tabela parametro');
select lives_ok($$ select agente.parametros_agenda() $$,
  'n8n_agente lê a agenda pela função do agente');
reset role;

select ok(not has_function_privilege('authenticated', 'privado.chave_parametro_restrita(text)', 'execute'),
  'authenticated não executa chave_parametro_restrita');
select ok(not has_function_privilege('authenticated', 'privado.marcar_parametro_restrito()', 'execute')
      and not has_function_privilege('authenticated', 'privado.parametro_restrito(text)', 'execute'),
  'authenticated não executa o gatilho nem parametro_restrito');
select ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
             from pg_proc p
            where p.oid in ('api.parametros_da_tela(text[])'::regprocedure,
                            'api.log_auditoria(text, text, timestamptz, timestamptz, integer)'::regprocedure,
                            'privado.parametro_restrito(text)'::regprocedure)),
  'funções com leitura de parametro são security definer com search_path vazio');

select * from finish();
rollback;
