-- =============================================================================
-- supabase/tests/027_p49_portal_familia.sql
--
-- Aceite do P49 (PROMPTS.md v2): "família sintética acessa só o próprio
-- portal; RLS testada."
--   1. Liberar e suspender o acesso (papéis, contrato assinado, e-mail,
--      freio) e o convite como tarefa com texto sugerido.
--   2. Link mágico (as duas funções abertas, só service_role): limite,
--      resposta igual para e-mail desconhecido e família em estado sensível,
--      vínculo do usuário.
--   3. O portal: cada família vê só a própria; a enfermeira só com
--      autorização; evoluções desligadas; suspensão vale na hora; família em
--      bloqueio_total vê só o contato.
--   4. RLS: a conta da família não lê nenhuma tabela de negócio nem chama
--      função de equipe; a equipe sem acesso ao portal recebe 42501.
--   5. Autorização da enfermeira para nome e foto.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(74);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2900000-0000-4000-8000-000000000001', 'comercial.p49@exemplo.invalid'),
  ('a2900000-0000-4000-8000-000000000002', 'coordenacao.p49@exemplo.invalid'),
  ('a2900000-0000-4000-8000-000000000003', 'enfermeira.a.p49@exemplo.invalid'),
  ('a2900000-0000-4000-8000-000000000004', 'enfermeira.b.p49@exemplo.invalid'),
  ('a2900000-0000-4000-8000-000000000005', 'marketing.p49@exemplo.invalid'),
  ('a2900000-0000-4000-8000-0000000000f1', 'mae.a.p49@exemplo.invalid'),
  ('a2900000-0000-4000-8000-0000000000f2', 'mae.b.p49@exemplo.invalid'),
  ('a2900000-0000-4000-8000-0000000000f3', 'mae.c.p49@exemplo.invalid'),
  ('a2900000-0000-4000-8000-0000000000f4', 'estranha.p49@exemplo.invalid');
insert into perfil (id, nome, email, ativo) values
  ('a2900000-0000-4000-8000-000000000001', 'Perfil Teste Comercial P49', 'comercial.p49@exemplo.invalid', true),
  ('a2900000-0000-4000-8000-000000000002', 'Perfil Teste Coordenação P49', 'coordenacao.p49@exemplo.invalid', true),
  ('a2900000-0000-4000-8000-000000000003', 'Perfil Teste Enfermeira A P49', 'enfermeira.a.p49@exemplo.invalid', true),
  ('a2900000-0000-4000-8000-000000000004', 'Perfil Teste Enfermeira B P49', 'enfermeira.b.p49@exemplo.invalid', true),
  ('a2900000-0000-4000-8000-000000000005', 'Perfil Teste Marketing P49', 'marketing.p49@exemplo.invalid', true);
insert into usuario_papel (usuario_id, papel) values
  ('a2900000-0000-4000-8000-000000000001', 'comercial'),
  ('a2900000-0000-4000-8000-000000000002', 'coordenacao'),
  ('a2900000-0000-4000-8000-000000000003', 'enfermeira'),
  ('a2900000-0000-4000-8000-000000000004', 'enfermeira'),
  ('a2900000-0000-4000-8000-000000000005', 'marketing');

insert into profissional (id, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero) values
  ('d2900000-0000-4000-8000-000000000001', 'a2900000-0000-4000-8000-000000000003', 'Enfermeira A P49', 'enfermeira_obstetrica', 'COREN', 'SP', '000901'),
  ('d2900000-0000-4000-8000-000000000002', 'a2900000-0000-4000-8000-000000000004', 'Enfermeira B P49', 'enfermeira_neonatal', 'COREN', 'SP', '000902');

insert into pacote (id, nome, dias) values ('b2900000-0000-4000-8000-000000000001', 'Pacote Teste P49', 3);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2900000-0000-4000-8000-000000000002', 'b2900000-0000-4000-8000-000000000001', 100, 6, '2020-01-01');

-- A: completa (assinado, pago, pré-natal realizado, enfermeira A, duas visitas, pesquisa enviada).
-- B: contrato assinado, sem enfermeira autorizando nada. C: bloqueio_total. D: sem contrato assinado.
insert into familia (id, nome_exibicao, dpp, data_nascimento, estado_sensivel) values
  ('c2900000-0000-4000-8000-0000000000a1', 'Família Teste Aurora P49', '2033-01-10', '2033-01-05', 'normal'),
  ('c2900000-0000-4000-8000-0000000000a2', 'Família Teste Brisa P49', '2033-02-10', null, 'normal'),
  ('c2900000-0000-4000-8000-0000000000a3', 'Família Teste Cais P49', '2033-03-10', null, 'bloqueio_total'),
  ('c2900000-0000-4000-8000-0000000000a4', 'Família Teste Duna P49', '2033-04-10', null, 'normal');
insert into pessoa (id, familia_id, papel, nome, telefone_e164, email, contato_principal) values
  ('f2900000-0000-4000-8000-0000000000a1', 'c2900000-0000-4000-8000-0000000000a1', 'mae', 'Aurora Mãe P49', '+5511900049001', 'mae.a.p49@exemplo.invalid', true),
  ('f2900000-0000-4000-8000-0000000000a2', 'c2900000-0000-4000-8000-0000000000a2', 'mae', 'Brisa Mãe P49', '+5511900049002', 'MAE.B.P49@exemplo.invalid', true),
  ('f2900000-0000-4000-8000-0000000000a3', 'c2900000-0000-4000-8000-0000000000a3', 'mae', 'Cais Mãe P49', '+5511900049003', 'mae.c.p49@exemplo.invalid', true),
  ('f2900000-0000-4000-8000-0000000000a4', 'c2900000-0000-4000-8000-0000000000a4', 'mae', 'Duna Mãe P49', '+5511900049004', null, true),
  ('f2900000-0000-4000-8000-0000000000a5', 'c2900000-0000-4000-8000-0000000000a1', 'presenteador', 'Presenteador P49', null, 'presente.p49@exemplo.invalid', false);
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status, assinado_em) values
  ('e2900000-0000-4000-8000-0000000000a1', 'c2900000-0000-4000-8000-0000000000a1', 'b2900000-0000-4000-8000-000000000002', 100, 'teste', 'assinado', '2033-01-01 10:00-03'),
  ('e2900000-0000-4000-8000-0000000000a2', 'c2900000-0000-4000-8000-0000000000a2', 'b2900000-0000-4000-8000-000000000002', 100, 'teste', 'assinado', '2033-01-02 10:00-03'),
  ('e2900000-0000-4000-8000-0000000000a3', 'c2900000-0000-4000-8000-0000000000a3', 'b2900000-0000-4000-8000-000000000002', 100, 'teste', 'assinado', '2033-01-03 10:00-03'),
  ('e2900000-0000-4000-8000-0000000000a4', 'c2900000-0000-4000-8000-0000000000a4', 'b2900000-0000-4000-8000-000000000002', 100, 'teste', 'gerado', null);
insert into cobranca (contrato_id, parcela, valor_centavos, vencimento, external_id, status, valor_pago_centavos, pago_em) values
  ('e2900000-0000-4000-8000-0000000000a1', 1, 100, '2033-01-05', 'p49-a1', 'paga', 100, '2033-01-02 10:00-03');
insert into consulta_prenatal (familia_id, instrumento_versao, status, agendada_para, realizada_em) values
  ('c2900000-0000-4000-8000-0000000000a1', 'v1-2026-09', 'realizada', '2033-01-03 10:00-03', '2033-01-03 10:30-03');
insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, estado) values
  ('d2900000-0000-4000-8000-000000000011', 'e2900000-0000-4000-8000-0000000000a1', 'c2900000-0000-4000-8000-0000000000a1', 3, 6, 'em_execucao'),
  ('d2900000-0000-4000-8000-000000000012', 'e2900000-0000-4000-8000-0000000000a2', 'c2900000-0000-4000-8000-0000000000a2', 3, 6, 'ativo');
insert into designacao (id, acompanhamento_id, profissional_id, papel, status) values
  ('a2900000-0000-4000-8000-0000000000d1', 'd2900000-0000-4000-8000-000000000011', 'd2900000-0000-4000-8000-000000000001', 'titular', 'aceita'),
  ('a2900000-0000-4000-8000-0000000000d2', 'd2900000-0000-4000-8000-000000000012', 'd2900000-0000-4000-8000-000000000002', 'titular', 'aceita');
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista, estado) values
  ('d2900000-0000-4000-8000-000000000011', 'd2900000-0000-4000-8000-000000000001', 1, '2033-01-08', '09:00', 'encerrada'),
  ('d2900000-0000-4000-8000-000000000011', 'd2900000-0000-4000-8000-000000000001', 2, '2033-01-09', '09:00', 'agendada');
insert into pos_venda (acompanhamento_id, pesquisa_enviada_em) values ('d2900000-0000-4000-8000-000000000011', '2033-01-12 10:00-03');

-- Consulta como a conta logada, engolindo a recusa de permissão: 0 quando a RLS ou o grant negam.
create function pg_temp.t_visiveis(tabela text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from %s', tabela) into n;
  return n;
exception when insufficient_privilege or invalid_schema_name or undefined_table then
  return 0;
end $$;
grant execute on function pg_temp.t_visiveis(text) to public;

create temp table t_r (chave text primary key, j jsonb);
grant all on t_r to public;

-- -----------------------------------------------------------------------------
-- 1. Liberar e suspender
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($s$ select api.portal_familia_liberar('f2900000-0000-4000-8000-0000000000a1') $s$, '42501', null, 'marketing não libera o portal');
select throws_ok($s$ select api.portal_familia_acessos() $s$, '42501', null, 'marketing não lista os acessos');
select testes.encerrar();
select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ select api.portal_familia_liberar('f2900000-0000-4000-8000-0000000000a1') $s$, '42501', null, 'enfermeira não libera o portal');
select testes.encerrar();

select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.portal_familia_liberar('f2900000-0000-4000-8000-0000000000a4') $s$, 'P0001', null, 'sem e-mail no cadastro: recusado');
select throws_ok($s$ select api.portal_familia_liberar('f2900000-0000-4000-8000-0000000000a5') $s$, 'P0001', null, 'o presenteador não entra no portal');
select throws_ok($s$ select api.portal_familia_liberar('f2900000-0000-4000-8000-0000000000a3') $s$, 'P0001', null, 'família em bloqueio_total: nenhum convite');
insert into t_r select 'lib_a', api.portal_familia_liberar('f2900000-0000-4000-8000-0000000000a1');
insert into t_r select 'lib_b', api.portal_familia_liberar('f2900000-0000-4000-8000-0000000000a2');
select is((select j ->> 'ok' from t_r where chave = 'lib_a'), 'true', 'comercial libera o portal da família A');
select isnt((select j ->> 'tarefa_id' from t_r where chave = 'lib_a'), null, 'o convite vira tarefa com texto sugerido');
select is((select j ->> 'ja_liberado' from (select api.portal_familia_liberar('f2900000-0000-4000-8000-0000000000a1') as j) x), 'true', 'liberar de novo não duplica');
select is((select count(*)::integer from jsonb_array_elements(api.portal_familia_acessos()) x where x ->> 'nome_exibicao' like '%P49'), 3,
  'a lista traz as famílias com contrato assinado (A, B e C) e não a D');
select ok(not (api.portal_familia_acessos()::text ~* 'p49@exemplo|@'), 'a lista nunca devolve o e-mail');
select testes.encerrar();

select ok((select payload ->> 'textoSugerido' from tarefa where id = (select (j ->> 'tarefa_id')::uuid from t_r where chave = 'lib_a')) like '%https://app.exemplo.invalid/familia%',
  'o texto do convite cita o endereço do portal (de parametro), sem link com token');
select ok((select payload ->> 'textoSugerido' from tarefa where id = (select (j ->> 'tarefa_id')::uuid from t_r where chave = 'lib_a')) like 'Oi, Aurora.%',
  'o convite chama a mãe pelo primeiro nome');

-- -----------------------------------------------------------------------------
-- 2. Link mágico: as duas funções abertas
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select public.portal_familia_localizar('mae.a.p49@exemplo.invalid', 'x') $s$, '42501', null, 'a equipe não chama a função aberta');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select public.portal_familia_localizar('mae.a.p49@exemplo.invalid', 'x') $s$, '42501', null, 'anônimo não chama a função aberta');
select testes.encerrar();

select testes.autenticar_service_role();
insert into t_r select 'loc_a', public.portal_familia_localizar('  Mae.A.P49@exemplo.invalid ', '203.0.113.20');
insert into t_r select 'loc_b', public.portal_familia_localizar('mae.b.p49@exemplo.invalid', '203.0.113.21');
select is((select j ->> 'situacao' from t_r where chave = 'loc_a'), 'ok', 'e-mail cadastrado: acha o acesso (sem diferenciar maiúscula nem espaço)');
select is((select j ->> 'situacao' from t_r where chave = 'loc_b'), 'ok', 'e-mail salvo em maiúsculas também acha');
select ok(not (select j::text from t_r where chave = 'loc_a') ~* 'aurora|p49@', 'a resposta não devolve nome nem e-mail');
select is(public.portal_familia_localizar('ninguem@exemplo.invalid', '203.0.113.22') ->> 'situacao', 'nao_encontrado', 'e-mail desconhecido: nao_encontrado');
select is(public.portal_familia_localizar('mae.c.p49@exemplo.invalid', '203.0.113.23') ->> 'situacao', 'nao_encontrado',
  'e-mail sem acesso liberado: a mesma resposta');
select is(public.portal_familia_localizar('nao é e-mail', '203.0.113.24') ->> 'situacao', 'nao_encontrado', 'texto que não é e-mail: a mesma resposta');
select testes.encerrar();

-- o acesso da família em estado sensível existia antes do bloqueio: nada sai por e-mail
insert into privado.acesso_familia (familia_id, pessoa_id) values ('c2900000-0000-4000-8000-0000000000a3', 'f2900000-0000-4000-8000-0000000000a3');
select testes.autenticar_service_role();
select is(public.portal_familia_localizar('mae.c.p49@exemplo.invalid', '203.0.113.25') ->> 'situacao', 'nao_encontrado',
  'família em bloqueio_total: o sistema não manda e-mail e responde como e-mail desconhecido');
select is(public.portal_familia_vincular('mae.a.p49@exemplo.invalid', 'a2900000-0000-4000-8000-0000000000f1') ->> 'situacao',
  'ok', 'o servidor vincula o usuário do link à pessoa A');
select is(public.portal_familia_vincular('  Mae.B.P49@exemplo.invalid ', 'a2900000-0000-4000-8000-0000000000f2') ->> 'situacao',
  'ok', 'e à pessoa B');
select is(public.portal_familia_vincular('mae.b.p49@exemplo.invalid', 'a2900000-0000-4000-8000-0000000000f1') ->> 'situacao',
  'conflito', 'o mesmo usuário não vira duas pessoas');
select is(public.portal_familia_vincular('  Mae.B.P49@exemplo.invalid ', 'a2900000-0000-4000-8000-0000000000f2') ->> 'situacao',
  'ok', 'vincular de novo o mesmo usuário é idempotente');
select testes.encerrar();
update privado.acesso_familia set usuario_id = 'a2900000-0000-4000-8000-0000000000f3' where pessoa_id = 'f2900000-0000-4000-8000-0000000000a3';

-- limite de pedidos por e-mail
update parametro set valor = valor || '{"link_max_por_email": 2, "link_max_por_origem": 50}' where chave = 'portal_familia';
select testes.autenticar_service_role();
select is(public.portal_familia_localizar('limite@exemplo.invalid', '203.0.113.30') ->> 'situacao', 'nao_encontrado', 'limite: primeiro pedido');
select is(public.portal_familia_localizar('limite@exemplo.invalid', '203.0.113.31') ->> 'situacao', 'nao_encontrado', 'limite: segundo pedido');
select is(public.portal_familia_localizar('limite@exemplo.invalid', '203.0.113.32') ->> 'situacao', 'limite', 'limite: o terceiro pedido do mesmo e-mail é recusado, de qualquer origem');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 3. O portal: cada família vê só a própria
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2900000-0000-4000-8000-0000000000f1', 'aal1');
insert into t_r select 'pa', api.portal_familia();
select testes.encerrar();
select testes.autenticar_authenticated('a2900000-0000-4000-8000-0000000000f2', 'aal1');
insert into t_r select 'pb', api.portal_familia();
select testes.encerrar();

select is((select j #>> '{familia,nome_exibicao}' from t_r where chave = 'pa'), 'Família Teste Aurora P49', 'a família A vê o portal da A');
select is((select j #>> '{familia,nome_exibicao}' from t_r where chave = 'pb'), 'Família Teste Brisa P49', 'a família B vê o portal da B');
select is((select j #>> '{pessoa,primeiro_nome}' from t_r where chave = 'pa'), 'Aurora', 'o portal chama pelo primeiro nome');
select ok(not (select j::text from t_r where chave = 'pa') ~* 'Brisa|Cais|Duna', 'o portal da A não tem nada das outras famílias');
select ok(not (select j::text from t_r where chave = 'pb') ~* 'Aurora|Cais|Duna', 'o portal da B não tem nada das outras famílias');
select is((select j #>> '{datas,dpp}' from t_r where chave = 'pa'), '2033-01-10', 'a DPP vem separada (estimativa)');
select is((select j #>> '{datas,data_nascimento}' from t_r where chave = 'pa'), '2033-01-05', 'o nascimento vem separado (fato)');
select isnt((select j ->> 'contrato_assinado_em' from t_r where chave = 'pa'), null, 'a A tem contrato assinado');
select isnt((select j ->> 'pagamento_confirmado_em' from t_r where chave = 'pa'), null, 'a A tem pagamento confirmado');
select is((select j ->> 'pagamento_confirmado_em' from t_r where chave = 'pb'), null, 'a B ainda não pagou');
select is((select j #>> '{prenatal,estado}' from t_r where chave = 'pa'), 'realizada', 'o pré-natal da A foi realizado');
select is(pg_catalog.jsonb_array_length((select j -> 'visitas' from t_r where chave = 'pa')), 2, 'a A vê as duas visitas (dia, data e hora)');
select is((select j #>> '{visitas,0,feita}' from t_r where chave = 'pa'), 'true', 'a primeira visita já foi feita');
select ok(not (select j::text from t_r where chave = 'pa') ~* 'endereco|cpf|valor|centavos', 'o portal não devolve endereço, CPF nem valores');
select is((select j #>> '{pesquisa,enviada}' from t_r where chave = 'pa'), 'true', 'a pesquisa aparece como enviada');
select is((select j #>> '{evolucoes,ativo}' from t_r where chave = 'pa'), 'false', 'evoluções desligadas até o K-10 ser decidido');
select is((select j #>> '{enfermeira,nome}' from t_r where chave = 'pa'), null, 'a enfermeira sem autorização não tem nome no portal');
select ok((select j -> 'enfermeira' from t_r where chave = 'pa') is not null, 'mas o portal sabe que há enfermeira designada');
select ok((select j #>> '{textos,titulo}' from t_r where chave = 'pa') = 'Oi, Aurora.', 'os textos vêm de mensagem_modelo, com o nome');

-- suspensão vale na hora
select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000002', 'aal2');
select is(api.portal_familia_suspender('f2900000-0000-4000-8000-0000000000a2') ->> 'ok', 'true', 'a coordenação suspende o acesso da B');
select testes.encerrar();
select testes.autenticar_authenticated('a2900000-0000-4000-8000-0000000000f2', 'aal1');
select throws_ok($s$ select api.portal_familia() $s$, '42501', null, 'acesso suspenso: o portal fecha na hora');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 4. RLS: a conta da família não lê negócio nem chama função de equipe
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2900000-0000-4000-8000-0000000000f1', 'aal1');
select is(pg_temp.t_visiveis('public.familia'), 0::bigint, 'RLS: a conta da família não lê a tabela familia');
select is(pg_temp.t_visiveis('public.pessoa'), 0::bigint, 'RLS: nem pessoa');
select is(pg_temp.t_visiveis('public.contrato'), 0::bigint, 'RLS: nem contrato');
select is(pg_temp.t_visiveis('public.cobranca'), 0::bigint, 'RLS: nem cobrança');
select is(pg_temp.t_visiveis('public.mensagem_modelo'), 0::bigint, 'RLS: nem os textos internos');
select is(pg_temp.t_visiveis('public.parametro'), 0::bigint, 'RLS: nem os parâmetros');
select is(pg_temp.t_visiveis('public.oportunidade'), 0::bigint, 'RLS: nem oportunidade');
select is(pg_temp.t_visiveis('public.visita'), 0::bigint, 'RLS: nem visita');
select is(pg_temp.t_visiveis('privado.acesso_familia'), 0::bigint, 'nem a tabela de acesso ao portal');
select throws_ok($s$ select api.marketing_canais() $s$, '42501', null, 'a conta da família não chama função de marketing');
select throws_ok($s$ select api.portal_familia_acessos() $s$, '42501', null, 'nem a lista de acessos');
select throws_ok($s$ select api.familias_do_dia() $s$, '42501', null, 'nem o portal da enfermeira');
select throws_ok($s$ select api.copiloto_config() $s$, '42501', null, 'nem o copiloto');
select testes.encerrar();

select testes.autenticar_authenticated('a2900000-0000-4000-8000-0000000000f4', 'aal1');
select throws_ok($s$ select api.portal_familia() $s$, '42501', null, 'conta sem acesso ao portal recebe 42501');
select testes.encerrar();
select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.portal_familia() $s$, '42501', null, 'a equipe também: o portal é da família');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select api.portal_familia() $s$, '42501', null, 'anônimo não abre o portal');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 5. Família em bloqueio_total e nome/foto da enfermeira
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2900000-0000-4000-8000-0000000000f3', 'aal1');
insert into t_r select 'pc', api.portal_familia();
select testes.encerrar();
select is((select j ->> 'situacao' from t_r where chave = 'pc'), 'contato', 'bloqueio_total: o portal mostra só o contato de uma pessoa da equipe');
select ok(not (select j ? 'datas' or j ? 'visitas' or j ? 'enfermeira' or j ? 'prenatal' from t_r where chave = 'pc'), 'bloqueio_total: nenhuma data, visita nem enfermeira');
select is((select j #>> '{contato,nome}' from t_r where chave = 'pc'), 'Contato de teste da coordenação', 'bloqueio_total: o contato vem de parametro.portal_familia');

-- a enfermeira A autoriza o nome, mas não a foto
select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($s$ select api.profissional_portal_salvar('d2900000-0000-4000-8000-000000000001', true, true) $s$, '42501', null,
  'uma enfermeira não registra a autorização de outra');
select testes.encerrar();
select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ select api.profissional_portal_salvar('d2900000-0000-4000-8000-000000000001', true, true, 'profissionais/Enfermeira A/foto.jpg') $s$, 'P0001', null,
  'o caminho da foto com nome é recusado');
select api.profissional_portal_salvar('d2900000-0000-4000-8000-000000000001', true, false, 'profissionais/d2900000-0000-4000-8000-000000000001/foto.jpg');
select testes.encerrar();
select testes.autenticar_authenticated('a2900000-0000-4000-8000-0000000000f1', 'aal1');
select is(api.portal_familia() #>> '{enfermeira,nome}', 'Enfermeira A P49', 'com a autorização, o portal mostra o nome');
select is(api.portal_familia() #>> '{enfermeira,foto_path}', null, 'sem autorização da foto, o portal não mostra a foto');
select testes.encerrar();
select testes.autenticar_authenticated('a2900000-0000-4000-8000-000000000002', 'aal2');
select api.profissional_portal_salvar('d2900000-0000-4000-8000-000000000001', true, true);
select testes.encerrar();
select testes.autenticar_authenticated('a2900000-0000-4000-8000-0000000000f1', 'aal1');
select is(api.portal_familia() #>> '{enfermeira,foto_path}', 'profissionais/d2900000-0000-4000-8000-000000000001/foto.jpg', 'com as duas autorizações, o portal traz o caminho da foto');
select testes.encerrar();

select * from finish();
rollback;
