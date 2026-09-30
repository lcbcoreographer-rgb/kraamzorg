-- =============================================================================
-- supabase/tests/027_p50_indicacoes.sql
--
-- Aceite do P50 (PROMPTS.md v2): "indicação registrada aparece no relatório
-- por origem."
--   1. Médicos parceiros (medico sem família): cadastro, edição, contato,
--      tarefa de relacionamento, papéis.
--   2. Indicação do médico e da família promotora: origem e vínculo na
--      família, uma por família, regras de consistência.
--   3. Relatório de indicações e o relatório de origem do marketing.
--   4. Nenhuma contrapartida financeira: nenhuma coluna nem argumento de valor,
--      e o aviso da vedação ética na listagem.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(38);

insert into auth.users (id, email) values
  ('a3000000-0000-4000-8000-000000000001', 'comercial.p50@exemplo.invalid'),
  ('a3000000-0000-4000-8000-000000000002', 'diretoria.p50@exemplo.invalid'),
  ('a3000000-0000-4000-8000-000000000003', 'marketing.p50@exemplo.invalid'),
  ('a3000000-0000-4000-8000-000000000004', 'enfermeira.p50@exemplo.invalid');
insert into perfil (id, nome, email, ativo) values
  ('a3000000-0000-4000-8000-000000000001', 'Perfil Teste Comercial P50', 'comercial.p50@exemplo.invalid', true),
  ('a3000000-0000-4000-8000-000000000002', 'Perfil Teste Diretoria P50', 'diretoria.p50@exemplo.invalid', true),
  ('a3000000-0000-4000-8000-000000000003', 'Perfil Teste Marketing P50', 'marketing.p50@exemplo.invalid', true),
  ('a3000000-0000-4000-8000-000000000004', 'Perfil Teste Enfermeira P50', 'enfermeira.p50@exemplo.invalid', true);
insert into usuario_papel (usuario_id, papel) values
  ('a3000000-0000-4000-8000-000000000001', 'comercial'),
  ('a3000000-0000-4000-8000-000000000002', 'diretoria'),
  ('a3000000-0000-4000-8000-000000000003', 'marketing'),
  ('a3000000-0000-4000-8000-000000000004', 'enfermeira');

create temp table t_r (chave text primary key, j jsonb);
grant all on t_r to public;

-- 5 famílias de 2042: duas indicadas pela médica, uma pela família promotora, duas sem indicação.
insert into familia (id, nome_exibicao, origem, criado_em) values
  ('c3000000-0000-4000-8000-0000000000a1', 'Família Teste A P50', 'desconhecida', '2042-05-10 12:00-03'),
  ('c3000000-0000-4000-8000-0000000000a2', 'Família Teste B P50', 'desconhecida', '2042-05-11 12:00-03'),
  ('c3000000-0000-4000-8000-0000000000a3', 'Família Teste C P50', 'desconhecida', '2042-05-12 12:00-03'),
  ('c3000000-0000-4000-8000-0000000000a4', 'Família Teste D P50', 'desconhecida', '2042-05-13 12:00-03'),
  ('c3000000-0000-4000-8000-0000000000a5', 'Família Promotora P50', 'site', '2041-01-01 12:00-03');
insert into medico (id, familia_id, especialidade, nome) values
  ('e3000000-0000-4000-8000-0000000000b1', 'c3000000-0000-4000-8000-0000000000a4', 'obstetra', 'Médica da Família D P50');
insert into pacote (id, nome, dias) values ('b3000000-0000-4000-8000-000000000001', 'Pacote Teste P50', 3);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001', 100, 6, '2020-01-01');
insert into oportunidade (familia_id, pipeline, estagio_p1, estagio_p2) values
  ('c3000000-0000-4000-8000-0000000000a1', 2, null, 'pagamento_confirmado'),
  ('c3000000-0000-4000-8000-0000000000a2', 1, 'qualificado', null),
  ('c3000000-0000-4000-8000-0000000000a3', 1, 'novo', null);

-- -----------------------------------------------------------------------------
-- 1. Médicos parceiros
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a3000000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($s$ select api.parceiros_listar() $s$, '42501', null, 'enfermeira não abre os parceiros');
select testes.encerrar();
select testes.autenticar_authenticated('a3000000-0000-4000-8000-000000000003', 'aal1');
select throws_ok($s$ select api.parceiro_salvar(null, 'Médica Teste', 'obstetra') $s$, '42501', null, 'marketing não cadastra parceiro');
select testes.encerrar();

select testes.autenticar_authenticated('a3000000-0000-4000-8000-000000000001', 'aal1');
insert into t_r select 'med', api.parceiro_salvar(null, ' Dra. Parceira P50 ', 'obstetra', '(11) 90000-5001', 'parceira.p50@exemplo.invalid', 'Hospital de Teste', 'prospeccao', 'Conheceu a Kraamzorg num evento.', null);
select is((select j ->> 'ok' from t_r where chave = 'med'), 'true', 'comercial cadastra o médico parceiro');
select throws_ok($s$ select api.parceiro_salvar(null, 'X', 'obstetra') $s$, 'P0001', null, 'nome curto demais é recusado');
select throws_ok($s$ select api.parceiro_salvar(null, 'Dr. Teste', 'obstetra', 'abc') $s$, 'P0001', null, 'telefone inválido é recusado');
select throws_ok($s$ select api.parceiro_salvar(null, 'Dr. Teste', 'obstetra', null, 'sem-arroba') $s$, 'P0001', null, 'e-mail inválido é recusado');
select throws_ok($s$ select api.parceiro_salvar(null, 'Dr. Teste', 'obstetra', null, null, null, 'inexistente') $s$, 'P0001', null, 'estado que não existe é recusado');
select throws_ok($s$ select api.parceiro_salvar('e3000000-0000-4000-8000-0000000000b1', 'Médica da Família', 'obstetra') $s$, 'P0001', null,
  'o médico de uma família não vira parceiro por edição');
select testes.encerrar();
select is((select familia_id from medico where id = (select (j ->> 'medico_id')::uuid from t_r where chave = 'med')), null, 'o parceiro é um medico sem família (PRD 6.2)');
select is((select telefone_e164 from medico where id = (select (j ->> 'medico_id')::uuid from t_r where chave = 'med')), '+5511900005001', 'telefone em E.164');
select throws_ok($s$ insert into privado.parceiro_medico (medico_id) values ('e3000000-0000-4000-8000-0000000000b1') $s$, '23514', null,
  'o gatilho barra parceiro que tem família');

select testes.autenticar_authenticated('a3000000-0000-4000-8000-000000000001', 'aal1');
select is(api.parceiro_contato_registrar((select (j ->> 'medico_id')::uuid from t_r where chave = 'med'), 'Almoço combinado.') ->> 'proximo_contato_em',
  ((now() at time zone 'America/Sao_Paulo')::date + 60)::text, 'o contato de hoje marca o próximo em relacionamento_dias (60)');
insert into t_r select 'tarefa', api.parceiro_tarefa_criar((select (j ->> 'medico_id')::uuid from t_r where chave = 'med'), 'Enviar a apresentação institucional', '2042-06-01');
select is((select j ->> 'ok' from t_r where chave = 'tarefa'), 'true', 'cria a tarefa de relacionamento');
select throws_ok($s$ select api.parceiro_tarefa_criar('e3000000-0000-4000-8000-0000000000b1', 'Tarefa qualquer') $s$, 'P0001', null, 'tarefa só para parceiro');
insert into t_r select 'lista', api.parceiros_listar();
select testes.encerrar();
select is((select j #>> '{parceiros,0,estado}' from t_r where chave = 'lista'), 'ativo', 'o primeiro contato passa a prospecção para ativo');
select is((select j #>> '{parceiros,0,tarefas_abertas}' from t_r where chave = 'lista'), '1', 'a lista conta a tarefa aberta');
select is((select j #>> '{parceiros,0,dias_sem_contato}' from t_r where chave = 'lista'), '0', 'e os dias sem contato');
select is((select tipo::text from tarefa where id = (select (j ->> 'tarefa_id')::uuid from t_r where chave = 'tarefa')), 'outro', 'a tarefa é do tipo outro, sem família');

-- -----------------------------------------------------------------------------
-- 2. Indicações
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a3000000-0000-4000-8000-000000000001', 'aal1');
select api.indicacao_registrar('c3000000-0000-4000-8000-0000000000a1', (select (j ->> 'medico_id')::uuid from t_r where chave = 'med'), null, 'Indicada no consultório.');
select api.indicacao_registrar('c3000000-0000-4000-8000-0000000000a2', (select (j ->> 'medico_id')::uuid from t_r where chave = 'med'));
select api.indicacao_registrar('c3000000-0000-4000-8000-0000000000a3', null, 'c3000000-0000-4000-8000-0000000000a5');
select throws_ok($s$ select api.indicacao_registrar('c3000000-0000-4000-8000-0000000000a1', null, 'c3000000-0000-4000-8000-0000000000a5') $s$, 'P0001', null,
  'uma indicação por família');
select throws_ok($s$ select api.indicacao_registrar('c3000000-0000-4000-8000-0000000000a4') $s$, 'P0001', null, 'sem médico nem promotora: recusado');
select throws_ok($s$ select api.indicacao_registrar('c3000000-0000-4000-8000-0000000000a4', 'e3000000-0000-4000-8000-0000000000b1', 'c3000000-0000-4000-8000-0000000000a5') $s$, 'P0001', null,
  'médico e promotora ao mesmo tempo: recusado');
select throws_ok($s$ select api.indicacao_registrar('c3000000-0000-4000-8000-0000000000a4', 'e3000000-0000-4000-8000-0000000000b1') $s$, 'P0001', null,
  'o médico de uma família não é parceiro para indicar');
select throws_ok($s$ select api.indicacao_registrar('c3000000-0000-4000-8000-0000000000a5', null, 'c3000000-0000-4000-8000-0000000000a5') $s$, 'P0001', null,
  'a família não indica a si mesma');
select testes.encerrar();

select is((select origem::text from familia where id = 'c3000000-0000-4000-8000-0000000000a1'), 'indicacao_medica', 'indicação do médico: origem indicacao_medica');
select is((select indicacao_medico_id from familia where id = 'c3000000-0000-4000-8000-0000000000a1'), (select (j ->> 'medico_id')::uuid from t_r where chave = 'med'),
  'e o vínculo com o médico');
select is((select origem::text from familia where id = 'c3000000-0000-4000-8000-0000000000a3'), 'indicacao_cliente', 'indicação da família promotora: origem indicacao_cliente');
select is((select indicacao_familia_id from familia where id = 'c3000000-0000-4000-8000-0000000000a3'), 'c3000000-0000-4000-8000-0000000000a5', 'e o vínculo com a promotora');
select ok(exists (select 1 from evento_familia where familia_id = 'c3000000-0000-4000-8000-0000000000a1' and tipo = 'indicacao'), 'a linha do tempo registra a indicação');
select ok(not exists (select 1 from evento_familia where tipo = 'indicacao' and titulo ~* 'Dra|Parceira'), 'o evento não leva o nome do médico');

-- -----------------------------------------------------------------------------
-- 3. Relatórios
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a3000000-0000-4000-8000-000000000001', 'aal1');
insert into t_r select 'rel', api.indicacoes_relatorio(null, null);
select testes.encerrar();
select is((select x ->> 'indicacoes' from t_r, jsonb_array_elements(j -> 'por_medico') x where chave = 'rel'), '2', 'relatório por médico: 2 indicações');
select is((select x ->> 'qualificadas' from t_r, jsonb_array_elements(j -> 'por_medico') x where chave = 'rel'), '2', 'relatório por médico: 2 qualificadas');
select is((select x ->> 'contratos' from t_r, jsonb_array_elements(j -> 'por_medico') x where chave = 'rel'), '1', 'relatório por médico: 1 virou contrato');
select is((select x ->> 'indicacoes' from t_r, jsonb_array_elements(j -> 'por_promotora') x where chave = 'rel'), '1', 'relatório por promotora: 1 indicação');

select testes.autenticar_authenticated('a3000000-0000-4000-8000-000000000002', 'aal2');
insert into t_r select 'orig', api.marketing_relatorio('2042-05-01', '2042-05-31');
select testes.encerrar();
select is((select x ->> 'leads' from t_r, jsonb_array_elements(j -> 'por_origem') x where chave = 'orig' and x ->> 'origem' = 'indicacao_medica'), '2',
  'a indicação do médico aparece no relatório por origem');
select is((select x ->> 'leads' from t_r, jsonb_array_elements(j -> 'por_origem') x where chave = 'orig' and x ->> 'origem' = 'indicacao_cliente'), '1',
  'e a da família promotora também');

-- -----------------------------------------------------------------------------
-- 4. Nenhuma contrapartida financeira
-- -----------------------------------------------------------------------------

select is_empty(
  $$ select table_name || '.' || column_name from information_schema.columns
     where table_schema = 'privado' and table_name in ('parceiro_medico', 'indicacao')
       and column_name ~* '(valor|comiss|pagamento|preco|centavos|percent|desconto|brinde|bonus|repasse|premio)' $$,
  'as tabelas de parceiro e indicação não têm coluna de dinheiro');
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'api' and p.proname ~ '^(parceiro|indicac)'
       and pg_get_function_arguments(p.oid) ~* '(valor|comiss|pagamento|preco|centavos|percent|desconto|brinde|bonus|repasse|premio)' $$,
  'as funções de parceiro e indicação não recebem valor nenhum');
select matches((select j ->> 'aviso' from t_r where chave = 'lista'), 'não paga nem oferece comissão', 'a listagem traz o aviso da vedação ética');

select * from finish();
rollback;
