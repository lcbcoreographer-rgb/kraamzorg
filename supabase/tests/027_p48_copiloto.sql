-- =============================================================================
-- supabase/tests/027_p48_copiloto.sql
--
-- Aceite do P48 (PROMPTS.md v2), o lado do banco: "sempre com as permissões
-- de quem pergunta. Sem dado assistencial. Perguntas registradas no log e
-- custo do mês visível." As dez perguntas de teste com resposta certa e a
-- recusa da pergunta assistencial ao comercial estão em
-- src/modules/copiloto/*.test.ts, que usam estas mesmas funções na demonstração.
--   1. As cinco funções de leitura: resultado com dados conhecidos e o que
--      cada papel pode chamar (o comercial não vê receita).
--   2. Nenhuma delas toca tabela assistencial (o texto da função é conferido).
--   3. Perguntas registradas: log de auditoria com o texto oculto, histórico
--      por pessoa e a diretoria vê todas.
--   4. Custo do mês pelo preço de parametro.copiloto.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(37);

insert into auth.users (id, email) values
  ('a2800000-0000-4000-8000-000000000001', 'comercial.p48@exemplo.invalid'),
  ('a2800000-0000-4000-8000-000000000002', 'diretoria.p48@exemplo.invalid'),
  ('a2800000-0000-4000-8000-000000000003', 'financeiro.p48@exemplo.invalid'),
  ('a2800000-0000-4000-8000-000000000004', 'marketing.p48@exemplo.invalid'),
  ('a2800000-0000-4000-8000-000000000005', 'coordenacao.p48@exemplo.invalid'),
  ('a2800000-0000-4000-8000-000000000006', 'enfermeira.p48@exemplo.invalid');
insert into perfil (id, nome, email, ativo) values
  ('a2800000-0000-4000-8000-000000000001', 'Perfil Teste Comercial P48', 'comercial.p48@exemplo.invalid', true),
  ('a2800000-0000-4000-8000-000000000002', 'Perfil Teste Diretoria P48', 'diretoria.p48@exemplo.invalid', true),
  ('a2800000-0000-4000-8000-000000000003', 'Perfil Teste Financeiro P48', 'financeiro.p48@exemplo.invalid', true),
  ('a2800000-0000-4000-8000-000000000004', 'Perfil Teste Marketing P48', 'marketing.p48@exemplo.invalid', true),
  ('a2800000-0000-4000-8000-000000000005', 'Perfil Teste Coordenação P48', 'coordenacao.p48@exemplo.invalid', true),
  ('a2800000-0000-4000-8000-000000000006', 'Perfil Teste Enfermeira P48', 'enfermeira.p48@exemplo.invalid', true);
insert into usuario_papel (usuario_id, papel) values
  ('a2800000-0000-4000-8000-000000000001', 'comercial'),
  ('a2800000-0000-4000-8000-000000000002', 'diretoria'),
  ('a2800000-0000-4000-8000-000000000003', 'financeiro'),
  ('a2800000-0000-4000-8000-000000000004', 'marketing'),
  ('a2800000-0000-4000-8000-000000000005', 'coordenacao'),
  ('a2800000-0000-4000-8000-000000000006', 'enfermeira');

create temp table t_r (chave text primary key, j jsonb);
grant all on t_r to public;

-- Dados de 2041: 4 leads (2 meta, 1 google, 1 site), 2 ganhos, 1 perdido, 1 sessão realizada.
insert into pacote (id, nome, dias) values ('b2800000-0000-4000-8000-000000000001', 'Pacote Teste P48', 3);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2800000-0000-4000-8000-000000000002', 'b2800000-0000-4000-8000-000000000001', 100, 6, '2020-01-01');
insert into familia (id, nome_exibicao, origem, criado_em) values
  ('c2800000-0000-4000-8000-0000000000a1', 'Família Teste A P48', 'meta_ads', '2041-02-10 12:00-03'),
  ('c2800000-0000-4000-8000-0000000000a2', 'Família Teste B P48', 'meta_ads', '2041-02-11 12:00-03'),
  ('c2800000-0000-4000-8000-0000000000a3', 'Família Teste C P48', 'google', '2041-02-12 12:00-03'),
  ('c2800000-0000-4000-8000-0000000000a4', 'Família Teste D P48', 'site', '2041-02-13 12:00-03');
insert into oportunidade (familia_id, pipeline, estagio_p1, estagio_p2) values
  ('c2800000-0000-4000-8000-0000000000a1', 2, null, 'pagamento_confirmado'),
  ('c2800000-0000-4000-8000-0000000000a2', 2, null, 'pagamento_confirmado'),
  ('c2800000-0000-4000-8000-0000000000a3', 1, 'perdido', null),
  ('c2800000-0000-4000-8000-0000000000a4', 1, 'qualificado', null);
insert into sessao_venda (familia_id, status) values ('c2800000-0000-4000-8000-0000000000a4', 'realizada');
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status) values
  ('e2800000-0000-4000-8000-0000000000a1', 'c2800000-0000-4000-8000-0000000000a1', 'b2800000-0000-4000-8000-000000000002', 100, 'teste', 'assinado'),
  ('e2800000-0000-4000-8000-0000000000a2', 'c2800000-0000-4000-8000-0000000000a2', 'b2800000-0000-4000-8000-000000000002', 100, 'teste', 'assinado');
insert into cobranca (contrato_id, parcela, valor_centavos, vencimento, external_id, status, valor_pago_centavos, pago_em) values
  ('e2800000-0000-4000-8000-0000000000a1', 1, 4000, '2041-02-20', 'p48-a1', 'paga', 4000, '2041-02-20 10:00-03'),
  ('e2800000-0000-4000-8000-0000000000a2', 1, 2500, '2041-03-05', 'p48-b1', 'paga', 2500, '2041-03-05 10:00-03'),
  ('e2800000-0000-4000-8000-0000000000a2', 2, 900, '2041-03-25', 'p48-b2', 'aberta', null, null),
  ('e2800000-0000-4000-8000-0000000000a1', 2, 300, '2041-01-25', 'p48-a2', 'vencida', null, null);

-- -----------------------------------------------------------------------------
-- 1. Ferramentas de leitura, com as permissões de quem pergunta
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000001', 'aal1');
insert into t_r select 'conv', api.copiloto_conversao('2041-01-01', '2041-12-31');
select is((select j ->> 'leads' from t_r where chave = 'conv'), '4', 'conversão: 4 leads em 2041');
select is((select j ->> 'qualificados' from t_r where chave = 'conv'), '3', 'conversão: 3 qualificados (2 ganhos e 1 qualificado)');
select is((select j ->> 'ganhos' from t_r where chave = 'conv'), '2', 'conversão: 2 ganhos');
select is((select j ->> 'perdidos' from t_r where chave = 'conv'), '1', 'conversão: 1 perdido');
select is((select j ->> 'sessoes_realizadas' from t_r where chave = 'conv'), '1', 'conversão: 1 sessão de venda realizada');
select is((select j ->> 'taxa_ganho_pct' from t_r where chave = 'conv'), '50.0', 'conversão: taxa de ganho de 50%');

insert into t_r select 'orig', api.copiloto_leads_origem('2041-01-01', '2041-12-31');
select is((select x ->> 'leads' from t_r, jsonb_array_elements(j -> 'itens') x where chave = 'orig' and x ->> 'origem' = 'meta_ads'), '2', 'leads por origem: meta_ads 2');
select is((select x ->> 'ganhos' from t_r, jsonb_array_elements(j -> 'itens') x where chave = 'orig' and x ->> 'origem' = 'meta_ads'), '2', 'leads por origem: meta_ads 2 ganhos');

insert into t_r select 'pipe', api.copiloto_pipeline(1);
select ok((select j ->> 'total' from t_r where chave = 'pipe')::integer >= 2, 'pipeline 1: traz o total de oportunidades');
select is((select j ->> 'total' from t_r where chave = 'pipe')::integer,
  (select sum((x ->> 'oportunidades')::integer)::integer from t_r, jsonb_array_elements(j -> 'estagios') x where chave = 'pipe'),
  'pipeline 1: o total é a soma dos estágios');
select ok((select (x ->> 'oportunidades')::integer from t_r, jsonb_array_elements(j -> 'estagios') x where chave = 'pipe' and x ->> 'estagio' = 'perdido') >= 1,
  'pipeline 1: traz a contagem do estágio perdido');
select throws_ok($s$ select api.copiloto_pipeline(3) $s$, 'P0001', null, 'pipeline que não existe é recusado');

insert into t_r select 'ocup', api.copiloto_ocupacao();
select ok((select j -> 'itens' from t_r where chave = 'ocup') is not null, 'ocupação: devolve a lista por praça e semana');
select is((select j ->> 'alerta_pct' from t_r where chave = 'ocup'), '85', 'ocupação: traz o limite de alerta de parametro');
select ok(not (select j::text ~* 'nome_exibicao|familia_id' from t_r where chave = 'ocup'), 'ocupação: nenhuma família, só números por praça');

-- o comercial não vê cobrança (PRD 13)
select throws_ok($s$ select api.copiloto_receita('2041-01-01', '2041-12-31') $s$, '42501', null, 'comercial não pergunta receita');
select testes.encerrar();

select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000002', 'aal2');
insert into t_r select 'rec', api.copiloto_receita('2041-01-01', '2041-12-31');
select testes.encerrar();
select is((select j ->> 'pago_centavos' from t_r where chave = 'rec'), '6500', 'receita: soma dos pagamentos confirmados de 2041');
select is((select j ->> 'contratos_pagos' from t_r where chave = 'rec'), '2', 'receita: 2 contratos com pagamento');
select is(pg_catalog.jsonb_array_length((select j -> 'por_mes' from t_r where chave = 'rec')), 2, 'receita: dois meses (fevereiro e março)');
select is((select x ->> 'pago_centavos' from t_r, jsonb_array_elements(j -> 'por_mes') x where chave = 'rec' and x ->> 'mes' = '2041-03-01'), '2500', 'receita: março 2500');
select ok((select (j ->> 'em_aberto_centavos')::integer from t_r where chave = 'rec') >= 900, 'receita: o que segue em aberto');
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000003', 'aal2');
select is(api.copiloto_receita('2041-01-01', '2041-12-31') ->> 'pago_centavos', '6500', 'o financeiro também pergunta receita');
select throws_ok($s$ select api.copiloto_conversao() $s$, '42501', null, 'financeiro não pergunta funil comercial');
select testes.encerrar();

select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000004', 'aal1');
select throws_ok($s$ select api.copiloto_config() $s$, '42501', null, 'marketing não usa o copiloto');
select testes.encerrar();
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ select api.copiloto_pipeline(1) $s$, '42501', null, 'enfermeira não usa o copiloto');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select api.copiloto_pipeline(1) $s$, '42501', null, 'anônimo não usa o copiloto');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 2. Nenhuma ferramenta toca tabela assistencial
-- -----------------------------------------------------------------------------

select is_empty(
  $$
  select p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api' and p.proname like 'copiloto\_%'
    and pg_get_functiondef(p.oid) ~* '(registro_atendimento|registro_adendo|checklist|alerta_clinico|consulta_prenatal|relatorio_medico|anexo_audio|assistencial\.)'
  $$,
  'nenhuma função do copiloto lê tabela ou função assistencial');

-- -----------------------------------------------------------------------------
-- 3. Perguntas registradas e custo do mês
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000001', 'aal1');
select api.copiloto_registrar('Quantos leads chegaram este mês?', 'copiloto_conversao', '{"desde":"2041-02-01"}', 'respondida', null, 1000000, 0);
select api.copiloto_registrar('Como está o registro assistencial da família X?', null, '{}', 'recusada', 'assistencial', 0, 0);
select testes.encerrar();
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000002', 'aal2');
select api.copiloto_registrar('Qual foi a receita de fevereiro?', 'copiloto_receita', '{"desde":"2041-02-01"}', 'respondida', null, 0, 1000000);
select testes.encerrar();

select is((select count(*)::integer from privado.copiloto_pergunta where pergunta like '%P48%' or pergunta like 'Quantos leads%' or pergunta like 'Como está%' or pergunta like 'Qual foi%'), 3,
  'as três perguntas ficaram registradas');
select is((select valor_depois ->> 'pergunta' from log_auditoria where entidade = 'privado.copiloto_pergunta' and acao = 'insert' order by id desc limit 1),
  '[oculto]', 'o log de auditoria grava a pergunta como [oculto]');
select ok((select valor_depois -> '_hmac' from log_auditoria where entidade = 'privado.copiloto_pergunta' and acao = 'insert' order by id desc limit 1) is not null,
  'o log de auditoria guarda o HMAC da pergunta');

select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000001', 'aal1');
select is(pg_catalog.jsonb_array_length(api.copiloto_historico(20)), 2, 'o comercial vê só as próprias perguntas');
select is((api.copiloto_historico(20) -> 0 ->> 'quem'), null, 'e não vê o nome de ninguém');
select testes.encerrar();
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000002', 'aal2');
select is(pg_catalog.jsonb_array_length(api.copiloto_historico(20)), 3, 'a diretoria vê as perguntas de todos');
select is(api.copiloto_config() ->> 'custo_mes_centavos', '1100', 'custo do mês: 1 milhão de tokens de entrada (220) mais 1 milhão de saída (880)');
select is(api.copiloto_config() ->> 'perguntas_mes', '3', 'perguntas do mês: 3');
select is(api.copiloto_config() ->> 'orcamento_mensal_centavos', '5000', 'o orçamento do mês vem de parametro.copiloto');
select ok((api.copiloto_config() -> 'termos_assistenciais') @> '"prontuario"'::jsonb, 'a configuração traz os termos que o copiloto recusa');
select testes.encerrar();

select * from finish();
rollback;
