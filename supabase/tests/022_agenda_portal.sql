-- =============================================================================
-- supabase/tests/022_agenda_portal.sql
--
-- Migration 0022_agenda_portal (P37 agenda, escalas e equipe; P38 portal da
-- enfermeira):
--   1. Versão de sincronização: uma vez por transação e por linha.
--   2. Estado da profissional sempre calculado (sem coluna), de todos os
--      estados do fluxo C.
--   3. api.equipe e api.escala_semanal: quem vê, o que devolve.
--   4. Conflitos (limite por dia, período diferente do D1, bloqueio,
--      sobreposição) antes de salvar; reagendamento recusa conflito sem
--      confirmação e motivo; cascata mantém o horário e o período.
--   5. Cadastro: profissional, documento com validade e bloqueio.
--   6. Etapa documentos_vencendo (30 dias antes) e o motor de automações.
--   7. Portal da enfermeira: só as famílias atribuídas, leitura no log,
--      chegada e saída (idempotentes, hora do aparelho, origem sync), estado
--      "em visita" no check-in e de volta no check-out.
--   8. Privilégios.
--
-- Só dado sintético, criado aqui e desfeito no rollback. Datas relativas a
-- hoje, no fuso da operação (America/Sao_Paulo), e horários informados pelo
-- aparelho relativos ao mesmo instante e sempre dentro de hoje (testes.p37_atras),
-- para o resultado não depender da hora em que a suíte roda, nem perto da
-- meia-noite de São Paulo nem entre 00:00 e 03:00 UTC.
-- =============================================================================

begin;

select plan(188);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2200000-0000-4000-8000-000000000001', 'coordenacao.p37@exemplo.invalid'),
  ('a2200000-0000-4000-8000-000000000002', 'diretoria.p37@exemplo.invalid'),
  ('a2200000-0000-4000-8000-000000000003', 'enfermeira.a.p37@exemplo.invalid'),
  ('a2200000-0000-4000-8000-000000000004', 'enfermeira.b.p37@exemplo.invalid'),
  ('a2200000-0000-4000-8000-000000000005', 'comercial.p37@exemplo.invalid'),
  ('a2200000-0000-4000-8000-000000000006', 'financeiro.p37@exemplo.invalid'),
  ('a2200000-0000-4000-8000-000000000007', 'enfermeira.nova.p37@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a2200000-0000-4000-8000-000000000001', 'Perfil Teste Coordenação P37', 'coordenacao.p37@exemplo.invalid', true),
  ('a2200000-0000-4000-8000-000000000002', 'Perfil Teste Diretoria P37', 'diretoria.p37@exemplo.invalid', true),
  ('a2200000-0000-4000-8000-000000000003', 'Perfil Teste Enfermeira A', 'enfermeira.a.p37@exemplo.invalid', true),
  ('a2200000-0000-4000-8000-000000000004', 'Perfil Teste Enfermeira B', 'enfermeira.b.p37@exemplo.invalid', true),
  ('a2200000-0000-4000-8000-000000000005', 'Perfil Teste Comercial P37', 'comercial.p37@exemplo.invalid', true),
  ('a2200000-0000-4000-8000-000000000006', 'Perfil Teste Financeiro P37', 'financeiro.p37@exemplo.invalid', true),
  ('a2200000-0000-4000-8000-000000000007', 'Perfil Teste Enfermeira Nova', 'enfermeira.nova.p37@exemplo.invalid', true);

insert into usuario_papel (usuario_id, papel) values
  ('a2200000-0000-4000-8000-000000000001', 'coordenacao'),
  ('a2200000-0000-4000-8000-000000000002', 'diretoria'),
  ('a2200000-0000-4000-8000-000000000003', 'enfermeira'),
  ('a2200000-0000-4000-8000-000000000004', 'enfermeira'),
  ('a2200000-0000-4000-8000-000000000005', 'comercial'),
  ('a2200000-0000-4000-8000-000000000006', 'financeiro'),
  ('a2200000-0000-4000-8000-000000000007', 'enfermeira');

-- o seed traz os parâmetros e liga a automação (antes de o teste os repor)
select is((select count(*)::integer from parametro where chave in
            ('agenda_visitas_por_dia', 'periodos_visita', 'visita_registro_horario', 'documento_profissional_tipos')), 4,
  'o seed traz os quatro parâmetros da agenda e do portal');
select is((select ativa from automacao where id = 'documento_vencendo'), true, 'o seed liga a automação documento_vencendo');

-- parâmetros com os valores do seed (o teste não depende do seed ter rodado)
insert into parametro (chave, valor) values
  ('agenda_visitas_por_dia', '2'),
  ('periodos_visita', '{"manha":{"inicio":"05:00","fim":"12:00"},"tarde":{"inicio":"12:00","fim":"20:00"}}'),
  ('visita_registro_horario', '{"tolerancia_futuro_minutos":5,"max_atraso_horas":48}'),
  ('janela_dpp_dias', '{"antes":21,"depois":14}')
on conflict (chave) do update set valor = excluded.valor;
update automacao set ativa = true where id = 'documento_vencendo';

insert into regiao (id, nome, praca, limite_familias_semana)
  values ('b2200000-0000-4000-8000-000000000001', 'Região Teste P37', 'Praça Teste P37', 5);
insert into regiao (id, nome, praca, limite_familias_semana)
  values ('b2200000-0000-4000-8000-000000000002', 'Região Outra P37', 'Praça Outra P37', 5);

create temp table t_h (hoje date not null) on commit drop;
grant all on t_h to public;
insert into t_h values ((now() at time zone 'America/Sao_Paulo')::date);

create temp table t_r (chave text primary key, r jsonb) on commit drop;
grant all on t_r to public;

insert into profissional (id, usuario_id, nome, funcao, regioes, vinculo) values
  ('d2200000-0000-4000-8000-000000000101', 'a2200000-0000-4000-8000-000000000003', 'Profissional Teste A', 'enfermeira_obstetrica', array['b2200000-0000-4000-8000-000000000001'::uuid], 'mei'),
  ('d2200000-0000-4000-8000-000000000102', 'a2200000-0000-4000-8000-000000000004', 'Profissional Teste B', 'enfermeira_neonatal',   array['b2200000-0000-4000-8000-000000000001'::uuid], 'pj'),
  ('d2200000-0000-4000-8000-000000000103', null, 'Profissional Teste C', 'enfermeira_obstetrica', array['b2200000-0000-4000-8000-000000000001'::uuid], 'clt'),
  ('d2200000-0000-4000-8000-000000000104', null, 'Profissional Teste D', 'enfermeira_obstetrica', array['b2200000-0000-4000-8000-000000000001'::uuid], 'clt'),
  ('d2200000-0000-4000-8000-000000000105', null, 'Profissional Teste E', 'enfermeira_obstetrica', array['b2200000-0000-4000-8000-000000000001'::uuid], 'clt'),
  ('d2200000-0000-4000-8000-000000000106', null, 'Profissional Teste F', 'enfermeira_obstetrica', array['b2200000-0000-4000-8000-000000000001'::uuid], 'clt'),
  ('d2200000-0000-4000-8000-000000000107', 'a2200000-0000-4000-8000-000000000001', 'Coordenação Teste P37', 'coordenacao', array['b2200000-0000-4000-8000-000000000001'::uuid], 'socia'),
  ('d2200000-0000-4000-8000-000000000108', null, 'Profissional Teste Outra Região', 'enfermeira_obstetrica', array['b2200000-0000-4000-8000-000000000002'::uuid], 'clt');
update perfil set profissional_id = 'd2200000-0000-4000-8000-000000000101' where id = 'a2200000-0000-4000-8000-000000000003';
update perfil set profissional_id = 'd2200000-0000-4000-8000-000000000102' where id = 'a2200000-0000-4000-8000-000000000004';

insert into familia (id, nome_exibicao, dpp, data_nascimento, estado_sensivel) values
  ('c2200000-0000-4000-8000-000000000001', 'Família Teste Agenda A1', (select hoje + 40 from t_h), null, 'normal'),
  ('c2200000-0000-4000-8000-000000000002', 'Família Teste Agenda A2', (select hoje + 40 from t_h), null, 'normal'),
  ('c2200000-0000-4000-8000-000000000003', 'Família Teste Agenda A3', (select hoje + 40 from t_h), null, 'normal'),
  ('c2200000-0000-4000-8000-000000000004', 'Família Teste Agenda A4', (select hoje + 3 from t_h),  null, 'normal'),
  ('c2200000-0000-4000-8000-000000000005', 'Família Teste Agenda A5', (select hoje + 5 from t_h),  null, 'normal'),
  ('c2200000-0000-4000-8000-000000000006', 'Família Teste Agenda A6', (select hoje + 40 from t_h), null, 'normal'),
  ('c2200000-0000-4000-8000-000000000007', 'Família Teste Agenda A7', (select hoje + 40 from t_h), null, 'normal'),
  ('c2200000-0000-4000-8000-000000000008', 'Família Teste Agenda A8', (select hoje - 60 from t_h), null, 'normal'),
  ('c2200000-0000-4000-8000-000000000009', 'Família Teste Agenda A9', (select hoje + 40 from t_h), null, 'normal');
insert into pessoa (familia_id, papel, nome, telefone_e164, contato_principal) values
  ('c2200000-0000-4000-8000-000000000001', 'mae', 'Helena Teste Portal', '+5511900002201', true),
  ('c2200000-0000-4000-8000-000000000002', 'mae', 'Clara Teste Portal',  '+5511900002202', true);
insert into oportunidade (familia_id, pipeline, estagio_p1, estagio_p2, desconto_pct, responsavel_id)
  values ('c2200000-0000-4000-8000-000000000001', 2, null, 'pagamento_confirmado', 0, 'a2200000-0000-4000-8000-000000000005');

insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao)
select ('c2210000-0000-4000-8000-00000000000' || g)::uuid, ('c2200000-0000-4000-8000-00000000000' || g)::uuid,
       (select id from pacote_versao order by id limit 1), 100, 'teste'
from generate_series(1, 9) g;

insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, periodo, estado) values
  ('e2200000-0000-4000-8000-000000000001', 'c2210000-0000-4000-8000-000000000001', 'c2200000-0000-4000-8000-000000000001', 6, 3.0, 'manha', 'ativo'),
  ('e2200000-0000-4000-8000-000000000002', 'c2210000-0000-4000-8000-000000000002', 'c2200000-0000-4000-8000-000000000002', 6, 3.0, 'tarde', 'ativo'),
  ('e2200000-0000-4000-8000-000000000003', 'c2210000-0000-4000-8000-000000000003', 'c2200000-0000-4000-8000-000000000003', 6, 3.0, 'manha', 'ativo'),
  ('e2200000-0000-4000-8000-000000000004', 'c2210000-0000-4000-8000-000000000004', 'c2200000-0000-4000-8000-000000000004', 6, 3.0, 'manha', 'aguardando'),
  ('e2200000-0000-4000-8000-000000000005', 'c2210000-0000-4000-8000-000000000005', 'c2200000-0000-4000-8000-000000000005', 6, 3.0, null,    'aguardando'),
  ('e2200000-0000-4000-8000-000000000006', 'c2210000-0000-4000-8000-000000000006', 'c2200000-0000-4000-8000-000000000006', 6, 3.0, 'tarde', 'ativo'),
  ('e2200000-0000-4000-8000-000000000007', 'c2210000-0000-4000-8000-000000000007', 'c2200000-0000-4000-8000-000000000007', 6, 3.0, 'manha', 'ativo'),
  ('e2200000-0000-4000-8000-000000000008', 'c2210000-0000-4000-8000-000000000008', 'c2200000-0000-4000-8000-000000000008', 2, 3.0, 'manha', 'encerrado');

insert into designacao (acompanhamento_id, profissional_id, papel, status, oferecida_em) values
  ('e2200000-0000-4000-8000-000000000001', 'd2200000-0000-4000-8000-000000000101', 'titular', 'aceita', now() - interval '20 days'),
  ('e2200000-0000-4000-8000-000000000002', 'd2200000-0000-4000-8000-000000000101', 'titular', 'aceita', now() - interval '20 days'),
  ('e2200000-0000-4000-8000-000000000006', 'd2200000-0000-4000-8000-000000000101', 'titular', 'aceita', now() - interval '20 days'),
  ('e2200000-0000-4000-8000-000000000003', 'd2200000-0000-4000-8000-000000000102', 'titular', 'aceita', now() - interval '20 days'),
  ('e2200000-0000-4000-8000-000000000004', 'd2200000-0000-4000-8000-000000000103', 'titular', 'aceita', now() - interval '3 days'),
  ('e2200000-0000-4000-8000-000000000004', 'd2200000-0000-4000-8000-000000000102', 'backup',  'aceita', now() - interval '3 days'),
  ('e2200000-0000-4000-8000-000000000005', 'd2200000-0000-4000-8000-000000000104', 'titular', 'oferecida', now() - interval '5 hours'),
  ('e2200000-0000-4000-8000-000000000007', 'd2200000-0000-4000-8000-000000000105', 'titular', 'aceita', now() - interval '20 days'),
  ('e2200000-0000-4000-8000-000000000008', 'd2200000-0000-4000-8000-000000000101', 'titular', 'aceita', now() - interval '80 days');

-- A1: D1..D6 de hoje a hoje + 5, 08:00 (manhã), profissional A
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista)
select 'e2200000-0000-4000-8000-000000000001', 'd2200000-0000-4000-8000-000000000101', g, (select hoje from t_h) + g - 1, time '08:00'
from generate_series(1, 6) g;
-- A2: D1..D3 de hoje a hoje + 2, 14:00 (tarde), profissional A
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista)
select 'e2200000-0000-4000-8000-000000000002', 'd2200000-0000-4000-8000-000000000101', g, (select hoje from t_h) + g - 1, time '14:00'
from generate_series(1, 3) g;
-- A3: D1..D3 em hoje + 10 .. + 12, 09:00, profissional B (a cascata)
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista)
select 'e2200000-0000-4000-8000-000000000003', 'd2200000-0000-4000-8000-000000000102', g, (select hoje from t_h) + 9 + g, time '09:00'
from generate_series(1, 3) g;
-- A6: D1 e D2 em hoje + 4 e + 5, 15:00 (tarde), profissional A
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista)
select 'e2200000-0000-4000-8000-000000000006', 'd2200000-0000-4000-8000-000000000101', g, (select hoje from t_h) + 3 + g, time '15:00'
from generate_series(1, 2) g;
-- A7: D1 em hoje + 20, 09:00, profissional E (que está de folga)
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista)
values ('e2200000-0000-4000-8000-000000000007', 'd2200000-0000-4000-8000-000000000105', 1, (select hoje + 20 from t_h), time '09:00');
-- A8: acompanhamento encerrado, nada a reagendar
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista, estado, checkin_em, checkout_em)
select 'e2200000-0000-4000-8000-000000000008', 'd2200000-0000-4000-8000-000000000101', g, (select hoje - 30 from t_h) + g, time '08:00', 'encerrada',
       ((select hoje - 30 from t_h) + g)::timestamptz + time '08:05', ((select hoje - 30 from t_h) + g)::timestamptz + time '11:00'
from generate_series(1, 2) g;

insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, periodo, estado)
  values ('e2200000-0000-4000-8000-000000000009', 'c2210000-0000-4000-8000-000000000009', 'c2200000-0000-4000-8000-000000000009', 6, 3.0, 'manha', 'ativo');
insert into designacao (acompanhamento_id, profissional_id, papel, status)
  values ('e2200000-0000-4000-8000-000000000009', 'd2200000-0000-4000-8000-000000000102', 'titular', 'aceita');
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista)
  values ('e2200000-0000-4000-8000-000000000009', 'd2200000-0000-4000-8000-000000000102', 1, (select hoje + 31 from t_h), time '09:30');

insert into bloqueio_agenda (profissional_id, inicio, fim, motivo)
  values ('d2200000-0000-4000-8000-000000000105', (select hoje from t_h), (select hoje + 2 from t_h), 'folga de teste');
insert into documento_profissional (id, profissional_id, tipo, numero, validade) values
  ('d2210000-0000-4000-8000-000000000001', 'd2200000-0000-4000-8000-000000000101', 'Carteira do conselho', 'TESTE-0001', (select hoje + 20 from t_h)),
  ('d2210000-0000-4000-8000-000000000002', 'd2200000-0000-4000-8000-000000000101', 'Contrato de prestação de serviço', null, (select hoje + 120 from t_h)),
  ('d2210000-0000-4000-8000-000000000003', 'd2200000-0000-4000-8000-000000000101', 'Comprovante de vacinação', null, (select hoje - 3 from t_h)),
  ('d2210000-0000-4000-8000-000000000004', 'd2200000-0000-4000-8000-000000000106', 'Carteira do conselho', 'TESTE-0006', null);

-- auxiliar do teste: simula o começo de uma transação nova (a versão de
-- sincronização sobe uma vez por transação; o teste roda tudo numa só)
create function testes.p37_nova_transacao() returns void language sql as $$
  select set_config('app.versao_incrementada', '', true)
$$;
-- Horário que o aparelho informa "há N minutos", sempre dentro do dia de hoje
-- (fuso da operação). A visita do teste é de hoje, e registrar_chegada e
-- registrar_saida recusam hora de outro dia (equipe:fora_do_dia_da_visita).
-- Nos primeiros minutos depois da meia-noite de São Paulo, "há 20 minutos"
-- cairia ontem e o teste falharia sem que o código estivesse errado. Por isso
-- o recuo encolhe na mesma proporção do que já passou do dia (fator 1 a partir
-- de 21 minutos depois da meia-noite): a ordem entre os horários se mantém e
-- nenhum passa da meia-noite. O arquivo roda numa transação só, então now() é
-- o mesmo instante em toda chamada e o resultado é o mesmo em toda chamada.
create function testes.p37_atras(p_minutos numeric) returns timestamptz language sql stable as $$
  select now() - (p_minutos::float8
                  * least(1.0::float8,
                          extract(epoch from now() - (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'))::float8 / 60.0 / 21.0))
                 * interval '1 minute'
$$;
create function testes.p37_erro(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end;
$$;
-- leituras como dono (o papel simulado não lê o log nem os eventos restritos)
create function testes.p37_eventos_visita(p_familia uuid, p_para text[]) returns integer language sql security definer set search_path = '' as $$
  select count(*)::integer from public.evento_familia e
  where e.familia_id = p_familia and e.dados ->> 'maquina' = 'visita' and e.dados ->> 'para' = any (p_para)
$$;
create function testes.p37_log_acoes(p_acao text) returns integer language sql security definer set search_path = '' as $$
  select count(*)::integer from public.log_auditoria l where l.acao = p_acao
$$;
create function testes.p37_notificacoes(p_usuario uuid, p_titulo text) returns integer language sql security definer set search_path = '' as $$
  select count(*)::integer from public.notificacao n where n.usuario_id = p_usuario and n.titulo = p_titulo
$$;
grant execute on function testes.p37_nova_transacao(), testes.p37_atras(numeric), testes.p37_erro(text), testes.p37_eventos_visita(uuid, text[]),
  testes.p37_log_acoes(text), testes.p37_notificacoes(uuid, text) to public;

-- -----------------------------------------------------------------------------
-- 1. Versão de sincronização: uma vez por transação e por linha
-- -----------------------------------------------------------------------------

select is((select versao from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000007' and dia_numero = 1), 1,
  'visita nasce na versão 1');
update visita set hora_prevista = '09:30' where acompanhamento_id = 'e2200000-0000-4000-8000-000000000007' and dia_numero = 1;
update visita set hora_prevista = '09:00', versao = 99 where acompanhamento_id = 'e2200000-0000-4000-8000-000000000007' and dia_numero = 1;
select is((select versao from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000007' and dia_numero = 1), 2,
  'dois updates na mesma transação são uma gravação lógica: a versão sobe uma vez, e a versão enviada é ignorada');
select testes.p37_nova_transacao();
update visita set hora_prevista = '09:00' where acompanhamento_id = 'e2200000-0000-4000-8000-000000000007' and dia_numero = 1;
select is((select versao from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000007' and dia_numero = 1), 3,
  'numa transação nova, o primeiro update volta a subir a versão');

-- -----------------------------------------------------------------------------
-- 2. O estado da profissional é sempre calculado (nunca coluna)
-- -----------------------------------------------------------------------------

select hasnt_column('public', 'profissional', 'status', 'profissional não tem coluna de status: o estado é calculado');
select hasnt_column('public', 'profissional', 'estado', 'profissional não tem coluna de estado: o estado é calculado');

select is(privado.status_profissional('d2200000-0000-4000-8000-000000000101')::text, 'em_atendimento',
  'titular de acompanhamento ativo com visita na semana, fora de visita: em atendimento');
select is(privado.status_profissional('d2200000-0000-4000-8000-000000000102')::text, 'backup',
  'backup aceita de família na janela da DPP: backup');
select is(privado.status_profissional('d2200000-0000-4000-8000-000000000103')::text, 'reservada',
  'titular aceita de família que aguarda o nascimento, com a janela cruzando a semana: reservada');
select is(privado.status_profissional('d2200000-0000-4000-8000-000000000104')::text, 'oferta_pendente',
  'oferta sem resposta: oferta pendente');
select is(privado.status_profissional('d2200000-0000-4000-8000-000000000105')::text, 'folga',
  'bloqueio de agenda cobrindo o dia: folga');
select is(privado.status_profissional('d2200000-0000-4000-8000-000000000106')::text, 'livre',
  'nenhum dos anteriores: livre');

-- -----------------------------------------------------------------------------
-- 3. api.equipe: só coordenação e diretoria, AAL2
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$ select api.equipe('b2200000-0000-4000-8000-000000000001') $$, '42501', null,
  'comercial não abre a equipe');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($$ select api.equipe('b2200000-0000-4000-8000-000000000001') $$, '42501', null,
  'financeiro não abre a equipe');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$ select api.equipe('b2200000-0000-4000-8000-000000000001') $$, '42501', null,
  'a enfermeira não abre a equipe (vê só o próprio estado, por api.status_equipe)');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.equipe('b2200000-0000-4000-8000-000000000001') $$, '42501', null,
  'coordenação em AAL1 é recusada (MFA)');

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'equipe', api.equipe('b2200000-0000-4000-8000-000000000001');
select is(jsonb_array_length(r -> 'profissionais'), 7, 'a equipe da região traz as sete profissionais dela (a outra região fica fora)')
  from t_r where chave = 'equipe';
select is((select r #>> '{resumo,em_atendimento}' from t_r where chave = 'equipe')::integer, 1, 'resumo: uma em atendimento');
select is((select r #>> '{resumo,backup}' from t_r where chave = 'equipe')::integer, 1, 'resumo: uma backup');
select is((select r #>> '{resumo,reservada}' from t_r where chave = 'equipe')::integer, 1, 'resumo: uma reservada');
select is((select r #>> '{resumo,oferta_pendente}' from t_r where chave = 'equipe')::integer, 1, 'resumo: uma com oferta pendente');
select is((select r #>> '{resumo,folga}' from t_r where chave = 'equipe')::integer, 1, 'resumo: uma de folga');
select is((select r #>> '{resumo,livre}' from t_r where chave = 'equipe')::integer, 1, 'resumo: uma livre (a coordenação não conta)');
select is((select r #>> '{resumo,em_visita}' from t_r where chave = 'equipe')::integer, 0, 'resumo: nenhuma em visita agora');
select cmp_ok((select (r #>> '{resumo,oferta_mais_antiga_horas}')::integer from t_r where chave = 'equipe'), '>=', 4,
  'resumo: a oferta sem resposta mais antiga tem horas contadas');
select is((select e ->> 'status' from t_r, jsonb_array_elements(r -> 'profissionais') e
           where chave = 'equipe' and e ->> 'id' = 'd2200000-0000-4000-8000-000000000101'), 'em_atendimento',
  'a profissional A aparece como em atendimento');
select is((select e ->> 'atende_visitas' from t_r, jsonb_array_elements(r -> 'profissionais') e
           where chave = 'equipe' and e ->> 'id' = 'd2200000-0000-4000-8000-000000000107'), 'false',
  'a coordenação está na lista mas não conta como quem faz visita');
select is((select jsonb_array_length(e -> 'semana') from t_r, jsonb_array_elements(r -> 'profissionais') e
           where chave = 'equipe' and e ->> 'id' = 'd2200000-0000-4000-8000-000000000101'), 7, 'a semana tem sete dias');
select is((select jsonb_array_length(e -> 'familias') from t_r, jsonb_array_elements(r -> 'profissionais') e
           where chave = 'equipe' and e ->> 'id' = 'd2200000-0000-4000-8000-000000000101'), 3,
  'a profissional A tem três famílias em curso (a encerrada fica fora)');
select is((select f ->> 'dia_atual' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'familias') f
           where chave = 'equipe' and e ->> 'id' = 'd2200000-0000-4000-8000-000000000101'
             and f ->> 'nome_exibicao' = 'Família Teste Agenda A1'), null,
  'sem visita iniciada, o dia da família ainda não começou');
select is((select string_agg(d ->> 'situacao', ',' order by d ->> 'tipo')
           from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'documentos') d
           where chave = 'equipe' and e ->> 'id' = 'd2200000-0000-4000-8000-000000000101'),
  'vencendo,vencido,em_dia',
  'documentos: 20 dias vencendo, 120 dias em dia, vencido há 3 dias');
select is((select d ->> 'situacao' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'documentos') d
           where chave = 'equipe' and e ->> 'id' = 'd2200000-0000-4000-8000-000000000106'), 'sem_validade',
  'documento sem validade não vence');
select is((select r ->> 'documento_aviso_dias' from t_r where chave = 'equipe'), '30', 'o aviso vem da automação documento_vencendo (30 dias)');
select is(jsonb_array_length(api.equipe('b2200000-0000-4000-8000-000000000002') -> 'profissionais'), 1, 'filtro por região');

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000002', 'aal2');
select is(jsonb_array_length(api.equipe('b2200000-0000-4000-8000-000000000001') -> 'profissionais'), 7, 'a diretoria abre a equipe');

-- -----------------------------------------------------------------------------
-- 4. api.escala_semanal
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'escala', api.escala_semanal(null, 'b2200000-0000-4000-8000-000000000001');
select is(jsonb_array_length(r -> 'profissionais'), 6, 'a escala tem as seis que fazem visita (a coordenação fica fora)')
  from t_r where chave = 'escala';
select is((select e #>> '{dias,0,dia}' from t_r, jsonb_array_elements(r -> 'profissionais') e
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000101'),
  date_trunc('week', (select hoje from t_h))::date::text, 'a semana começa na segunda');
select is((select d #>> '{turnos,manha,estado}' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000101'
             and d ->> 'dia' = (select hoje::text from t_h)), 'visita', 'A tem visita de manhã hoje');
select is((select d #>> '{turnos,tarde,estado}' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000101'
             and d ->> 'dia' = (select hoje::text from t_h)), 'visita', 'A tem visita à tarde hoje');
select is((select d ->> 'sobrecarga' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000101'
             and d ->> 'dia' = (select hoje::text from t_h)), 'false', 'duas visitas no dia não é sobrecarga');
select is((select d #>> '{turnos,manha,estado}' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000105'
             and d ->> 'dia' = (select hoje::text from t_h)), 'folga', 'E está de folga hoje');
select is((select d #>> '{turnos,manha,estado}' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000103'
             and d ->> 'dia' = (select hoje::text from t_h)), 'reservada', 'C está reservada (turno da família)');
select is((select d #>> '{turnos,tarde,estado}' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000103'
             and d ->> 'dia' = (select hoje::text from t_h)), 'livre', 'C fica livre no outro turno da família');
select is((select d #>> '{turnos,manha,estado}' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000102'
             and d ->> 'dia' = (select hoje::text from t_h)), 'backup', 'B está de backup');
select is((select d #>> '{turnos,manha,estado}' from t_r, jsonb_array_elements(r -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
           where chave = 'escala' and e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000104'
             and d ->> 'dia' = (select hoje::text from t_h)), 'oferta', 'D tem oferta sem resposta');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select is(jsonb_array_length(api.escala_semanal(null, null) -> 'profissionais'), 1, 'a enfermeira vê só a própria linha da escala');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$ select api.escala_semanal(null, null) $$, '42501', null, 'comercial não abre a escala');

-- -----------------------------------------------------------------------------
-- 5. Agenda e conflitos, antes de salvar
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$ select api.agenda((select hoje from t_h), (select hoje + 3 from t_h), null) $$, '42501', null, 'a enfermeira não abre a agenda geral');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ select api.agenda((select hoje + 3 from t_h), (select hoje from t_h), null) $$, 'P0001', null, 'período ao contrário é recusado');
select is(jsonb_array_length(api.agenda((select hoje from t_h), (select hoje from t_h), 'd2200000-0000-4000-8000-000000000101') -> 'visitas'), 2,
  'agenda do dia da profissional A: duas visitas');
select is((select jsonb_array_length(v -> 'conflitos') from jsonb_array_elements(
             api.agenda((select hoje from t_h), (select hoje from t_h), 'd2200000-0000-4000-8000-000000000101') -> 'visitas') v limit 1), 0,
  'sem conflito nas visitas de hoje da profissional A');
select is(jsonb_array_length(api.agenda((select hoje from t_h), (select hoje + 30 from t_h), null) -> 'visitas') >= 10, true,
  'agenda geral do mês traz as visitas de todas');

-- simular mostra os conflitos e não grava nada
insert into t_r select 'sim_periodo', api.reagendar_visita(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3),
  (select hoje from t_h), '14:30', null, null, true, false);
select is((select r ->> 'simulado' from t_r where chave = 'sim_periodo'), 'true', 'simular devolve simulado');
select ok((select r -> 'conflitos' from t_r where chave = 'sim_periodo') @> '[{"codigo": "periodo_diferente_do_d1"}]',
  'conflito: período diferente do D1 (família da manhã, visita à tarde)');
select ok((select r -> 'conflitos' from t_r where chave = 'sim_periodo') @> '[{"codigo": "sobreposicao"}]',
  'conflito: sobreposição com a visita das 14:00 da outra família');
select is((select data from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3),
  (select hoje + 2 from t_h), 'simular não muda a visita');
select is((select estado::text from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3), 'agendada',
  'simular não passa pela máquina de estados');

insert into t_r select 'sim_limite', api.reagendar_visita(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000006' and dia_numero = 1),
  (select hoje from t_h), '19:00', null, null, true, false);
select ok((select r -> 'conflitos' from t_r where chave = 'sim_limite') @> '[{"codigo": "limite_visitas_dia", "limite": 2, "quantas": 3}]',
  'conflito: passa do limite de duas visitas por dia (limite e contagem vêm do banco)');

insert into t_r select 'sim_bloqueio', api.reagendar_visita(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000007' and dia_numero = 1),
  (select hoje + 1 from t_h), null, null, null, true, false);
select ok((select r -> 'conflitos' from t_r where chave = 'sim_bloqueio') @> '[{"codigo": "bloqueio"}]',
  'conflito: dia com bloqueio de agenda');

insert into t_r select 'sim_limpo', api.reagendar_visita(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3),
  (select hoje + 2 from t_h), '10:00', null, null, true, false);
select is((select r -> 'conflitos' from t_r where chave = 'sim_limpo'), '[]'::jsonb, 'horário livre: nenhum conflito');

-- salvar com conflito: recusa sem confirmação, recusa sem motivo, grava com os dois
select throws_ok(
  format($$ select api.reagendar_visita(%L, %L, '14:30', null, null, false, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3), (select hoje from t_h)),
  'P0001', null, 'com conflito e sem confirmação, o banco recusa');
select matches(testes.p37_erro(format($$ select api.reagendar_visita(%L, %L, '14:30', null, null, false, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3), (select hoje from t_h))),
  '^equipe:conflito ', 'a recusa tem o código equipe:conflito');
select matches(testes.p37_erro(format($$ select api.reagendar_visita(%L, %L, '14:30', null, null, false, true) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3), (select hoje from t_h))),
  '^equipe:motivo_obrigatorio', 'confirmar o conflito exige motivo');
select is((select data from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3),
  (select hoje + 2 from t_h), 'as recusas não mudam a visita');

select throws_ok(
  format($$ select api.reagendar_visita(%L, %L, null, %L, null, false, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3), (select hoje + 2 from t_h),
    'd2200000-0000-4000-8000-000000000106'), 'P0001', null,
  'outra profissional sem designação aceita na família não recebe a visita');

-- sem conflito: grava, mantém o horário quando a hora não vem, e passa pela máquina de estados
insert into t_r select 'mover', api.reagendar_visita(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3),
  (select hoje + 8 from t_h), null, null, 'Pedido da família', false, false);
select is((select r ->> 'ok' from t_r where chave = 'mover'), 'true', 'reagendar sem conflito grava');
select is((select data from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3),
  (select hoje + 8 from t_h), 'a visita foi para o novo dia');
select is((select hora_prevista::text from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3),
  '08:00:00', 'a hora (logo o período) foi mantida');
select is((select estado::text from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 3), 'agendada',
  'a visita volta a agendada');
select cmp_ok(testes.p37_eventos_visita('c2200000-0000-4000-8000-000000000001', array['reagendada']), '>=', 1,
  'a passagem por reagendada ficou na linha do tempo');
select cmp_ok(testes.p37_log_acoes('visita_reagendada'), '>=', 1, 'o reagendamento tem log');

-- com conflito, confirmado e com motivo: grava e avisa
insert into t_r select 'forcado', api.reagendar_visita(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000006' and dia_numero = 1),
  (select hoje from t_h), '19:00', null, 'Única data possível da família', false, true);
select ok((select r -> 'conflitos' from t_r where chave = 'forcado') @> '[{"codigo": "limite_visitas_dia"}]',
  'reagendar com conflito confirmado e motivo grava e devolve o conflito');
select is((select data from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000006' and dia_numero = 1),
  (select hoje from t_h), 'a visita foi para o dia com conflito confirmado');
select is((select d #>> '{sobrecarga}' from jsonb_array_elements(
   api.escala_semanal(null, 'b2200000-0000-4000-8000-000000000001') -> 'profissionais') e, jsonb_array_elements(e -> 'dias') d
   where e ->> 'profissional_id' = 'd2200000-0000-4000-8000-000000000101' and d ->> 'dia' = (select hoje::text from t_h)), 'true',
  'a escala marca a sobrecarga do dia');
select ok((select cmp from (select count(*) filter (where v -> 'conflitos' @> '[{"codigo": "limite_visitas_dia"}]') as cmp
   from jsonb_array_elements(api.agenda((select hoje from t_h), (select hoje from t_h), 'd2200000-0000-4000-8000-000000000101') -> 'visitas') v) t) >= 1,
  'a agenda marca o conflito nas visitas do dia');

-- comercial e enfermeira não reagendam
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000005', 'aal2');
select throws_ok(format($$ select api.reagendar_visita(%L, %L, null, null, null, true, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 4), (select hoje + 20 from t_h)),
  '42501', null, 'comercial não reagenda');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select throws_ok(format($$ select api.reagendar_visita(%L, %L, null, null, null, true, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 4), (select hoje + 20 from t_h)),
  '42501', null, 'a enfermeira não reagenda');

-- -----------------------------------------------------------------------------
-- 6. Cascata (nascimento ou alta mudam), mantendo o período
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'casc_sim', api.reagendar_cascata('e2200000-0000-4000-8000-000000000003', (select hoje + 20 from t_h), null, true, false);
select is((select r ->> 'deslocamento_dias' from t_r where chave = 'casc_sim'), '10', 'a simulação calcula o deslocamento de dias');
select is((select jsonb_array_length(r -> 'visitas') from t_r where chave = 'casc_sim'), 3, 'a simulação lista as três visitas');
select is((select r #>> '{visitas,0,para}' from t_r where chave = 'casc_sim'), (select (hoje + 20)::text from t_h), 'D1 vai para a nova data de início');
select is((select r #>> '{visitas,2,para}' from t_r where chave = 'casc_sim'), (select (hoje + 22)::text from t_h), 'D3 mantém o espaçamento');
select is((select min(data) from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000003'), (select hoje + 10 from t_h),
  'a simulação não mudou nada');

insert into t_r select 'casc', api.reagendar_cascata('e2200000-0000-4000-8000-000000000003', (select hoje + 20 from t_h), 'Nascimento antecipado', false, false);
select is((select r ->> 'conflitos_total' from t_r where chave = 'casc'), '0', 'a cascata sem conflito não traz conflito');
select is((select string_agg(data::text, ',' order by dia_numero) from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000003'),
  (select (hoje + 20)::text || ',' || (hoje + 21)::text || ',' || (hoje + 22)::text from t_h), 'as três visitas andaram dez dias');
select is((select string_agg(distinct hora_prevista::text, ',') from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000003'),
  '09:00:00', 'a cascata manteve o horário, logo o período da manhã');
select is((select string_agg(distinct estado::text, ',') from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000003'),
  'agendada', 'as visitas voltam a agendada');
select is(testes.p37_eventos_visita('c2200000-0000-4000-8000-000000000003', array['reagendada']),
  3, 'cada visita passou pela máquina de estados');
select is(testes.p37_notificacoes('a2200000-0000-4000-8000-000000000004', 'visita_reagendada'), 1,
  'a profissional é avisada uma vez pela cascata');

-- cascata para trás
insert into t_r select 'casc_volta', api.reagendar_cascata('e2200000-0000-4000-8000-000000000003', (select hoje + 15 from t_h), 'Alta antecipada', false, false);
select is((select min(data) from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000003'), (select hoje + 15 from t_h),
  'a cascata também anda para trás');

-- cascata com conflito: outra família da profissional B no meio do caminho
-- outra família da profissional B (A9, 09:30 em hoje + 31) fica no caminho da cascata
select testes.p37_nova_transacao();
select matches(testes.p37_erro(format($$ select api.reagendar_cascata('e2200000-0000-4000-8000-000000000003', %L, 'teste', false, false) $$, (select hoje + 30 from t_h))),
  '^equipe:conflito ', 'cascata que bate em outra visita (sobreposição) é recusada por inteiro');
select is((select min(data) from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000003'), (select hoje + 15 from t_h),
  'a recusa desfez tudo: nenhuma visita andou');
insert into t_r select 'casc_conf_sim', api.reagendar_cascata('e2200000-0000-4000-8000-000000000003', (select hoje + 30 from t_h), null, true, false);
select cmp_ok((select (r ->> 'conflitos_total')::integer from t_r where chave = 'casc_conf_sim'), '>=', 1, 'a simulação mostra o conflito antes de salvar');
select matches(testes.p37_erro(format($$ select api.reagendar_cascata('e2200000-0000-4000-8000-000000000003', %L, null, false, true) $$, (select hoje + 30 from t_h))),
  '^equipe:motivo_obrigatorio', 'confirmar o conflito da cascata exige motivo');
insert into t_r select 'casc_forcada', api.reagendar_cascata('e2200000-0000-4000-8000-000000000003', (select hoje + 30 from t_h), 'Sem outra data', false, true);
select is((select min(data) from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000003'), (select hoje + 30 from t_h),
  'cascata com conflito confirmado e motivo grava');

select matches(testes.p37_erro($$ select api.reagendar_cascata('e2200000-0000-4000-8000-000000000008', (select hoje + 3 from t_h), null, false, false) $$),
  '^equipe:nada_a_reagendar', 'acompanhamento sem visita a mover: nada a reagendar');
select matches(testes.p37_erro(format($$ select api.reagendar_visita(%L, (select hoje + 3 from t_h), null, null, null, true, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000008' and dia_numero = 1))),
  '^equipe:visita_nao_movivel', 'visita já encerrada não se reagenda');

-- -----------------------------------------------------------------------------
-- 7. Cadastro: profissional, documento e bloqueio
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'prof_nova', api.salvar_profissional(null, 'Profissional Teste Nova', 'enfermeira_neonatal', 'sp', 'TESTE-0100',
  '+5511900002299', array['b2200000-0000-4000-8000-000000000001'::uuid], 'mei', 10000, 5000, true, 'a2200000-0000-4000-8000-000000000007');
select is((select r ->> 'nova' from t_r where chave = 'prof_nova'), 'true', 'cadastra a profissional');
select is((select conselho || ' ' || conselho_uf || ' ' || conselho_numero from profissional where id = (select (r ->> 'id')::uuid from t_r where chave = 'prof_nova')),
  'COREN SP TESTE-0100', 'conselho COREN, UF em maiúsculas e número');
select is((select valor_hora_centavos || '/' || adicional_deslocamento_centavos from profissional where id = (select (r ->> 'id')::uuid from t_r where chave = 'prof_nova')),
  '10000/5000', 'valor da hora e ajuda de deslocamento em centavos');
select is((select profissional_id from perfil where id = 'a2200000-0000-4000-8000-000000000007'), (select (r ->> 'id')::uuid from t_r where chave = 'prof_nova'),
  'perfil.profissional_id acompanha o vínculo');
select matches(testes.p37_erro($$ select api.salvar_profissional(null, 'X', 'enfermeira_obstetrica', null, null, '11999990000', '{}', 'mei', 100, 0, true, null) $$),
  '^equipe:telefone_invalido', 'telefone fora do E.164 é recusado');
select matches(testes.p37_erro($$ select api.salvar_profissional(null, 'X', 'pediatra', null, null, null, '{}', 'mei', 100, 0, true, null) $$),
  '^equipe:funcao_invalida', 'função desconhecida é recusada');
select matches(testes.p37_erro($$ select api.salvar_profissional(null, 'X', 'enfermeira_obstetrica', 'SP', null, null, '{}', 'mei', 100, 0, true, null) $$),
  '^equipe:conselho_incompleto', 'UF do conselho sem número é recusada');
select matches(testes.p37_erro($$ select api.salvar_profissional(null, 'X', 'enfermeira_obstetrica', null, null, null, array['00000000-0000-4000-8000-00000000abcd'::uuid], 'mei', 100, 0, true, null) $$),
  '^equipe:regiao_inexistente', 'região que não existe é recusada');
select matches(testes.p37_erro($$ select api.salvar_profissional(null, 'X', 'enfermeira_obstetrica', null, null, null, '{}', 'mei', -1, 0, true, null) $$),
  '^equipe:valor_invalido', 'valor negativo é recusado');
select matches(testes.p37_erro($$ select api.salvar_profissional(null, 'X', 'enfermeira_obstetrica', null, null, null, '{}', 'mei', 100, 0, true, 'a2200000-0000-4000-8000-000000000003') $$),
  '^equipe:usuario_ja_vinculado', 'o usuário já ligado a outra profissional é recusado');
insert into t_r select 'prof_alt', api.salvar_profissional((select (r ->> 'id')::uuid from t_r where chave = 'prof_nova'), 'Profissional Teste Nova', 'enfermeira_neonatal',
  'SP', 'TESTE-0100', '+5511900002299', array['b2200000-0000-4000-8000-000000000001'::uuid], 'pj', 11000, 0, false, null);
select is((select r ->> 'nova' from t_r where chave = 'prof_alt'), 'false', 'altera a profissional existente');
select is((select ativa from profissional where id = (select (r ->> 'id')::uuid from t_r where chave = 'prof_nova')), false, 'desativa');
select is((select profissional_id from perfil where id = 'a2200000-0000-4000-8000-000000000007'), null, 'sem usuário, o perfil perde o vínculo');

insert into t_r select 'doc_novo', api.salvar_documento_profissional(null, 'd2200000-0000-4000-8000-000000000103', 'Carteira do conselho', 'TESTE-0003', (select hoje + 400 from t_h));
select is((select validade from documento_profissional where id = (select (r ->> 'id')::uuid from t_r where chave = 'doc_novo')), (select hoje + 400 from t_h),
  'cadastra o documento com validade');
insert into t_r select 'doc_alt', api.salvar_documento_profissional((select (r ->> 'id')::uuid from t_r where chave = 'doc_novo'), 'd2200000-0000-4000-8000-000000000103', 'Carteira do conselho', 'TESTE-0003', (select hoje + 500 from t_h));
select is((select validade from documento_profissional where id = (select (r ->> 'id')::uuid from t_r where chave = 'doc_novo')), (select hoje + 500 from t_h),
  'altera a validade do documento');
select matches(testes.p37_erro($$ select api.salvar_documento_profissional(null, 'd2200000-0000-4000-8000-000000000103', '  ', null, null) $$),
  '^equipe:tipo_obrigatorio', 'documento sem tipo é recusado');

insert into t_r select 'bloq', api.salvar_bloqueio_agenda(null, 'd2200000-0000-4000-8000-000000000102', (select hoje + 32 from t_h), (select hoje + 32 from t_h), 'Consulta médica');
select is((select jsonb_array_length(r -> 'visitas_afetadas') from t_r where chave = 'bloq'), 1,
  'o bloqueio devolve as visitas já marcadas nesses dias, para reagendar');
select matches(testes.p37_erro($$ select api.salvar_bloqueio_agenda(null, 'd2200000-0000-4000-8000-000000000102', (select hoje + 5 from t_h), (select hoje + 4 from t_h), 'x') $$),
  '^equipe:periodo_invalido', 'bloqueio que termina antes de começar é recusado');
select matches(testes.p37_erro($$ select api.salvar_bloqueio_agenda(null, 'd2200000-0000-4000-8000-000000000102', (select hoje + 4 from t_h), (select hoje + 5 from t_h), '  ') $$),
  '^equipe:motivo_obrigatorio', 'bloqueio sem motivo é recusado');
insert into t_r select 'bloq_rem', api.remover_bloqueio_agenda((select (r ->> 'id')::uuid from t_r where chave = 'bloq'));
select is((select count(*)::integer from bloqueio_agenda where id = (select (r ->> 'id')::uuid from t_r where chave = 'bloq')), 0, 'remove o bloqueio');
select matches(testes.p37_erro(format($$ select api.remover_bloqueio_agenda(%L) $$, (select (r ->> 'id') from t_r where chave = 'bloq'))),
  '^equipe:bloqueio_inexistente', 'remover de novo é recusado');

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$ select api.salvar_profissional(null, 'X', 'enfermeira_obstetrica', null, null, null, '{}', 'mei', 100, 0, true, null) $$,
  '42501', null, 'a enfermeira não cadastra profissional');
select throws_ok($$ select api.salvar_bloqueio_agenda(null, 'd2200000-0000-4000-8000-000000000101', (select hoje + 4 from t_h), (select hoje + 5 from t_h), 'x') $$,
  '42501', null, 'a enfermeira não cria bloqueio de agenda');

-- -----------------------------------------------------------------------------
-- 8. Etapa documentos_vencendo (30 dias antes) e o motor de automações
-- -----------------------------------------------------------------------------

select testes.encerrar();
select is((privado.recalculo_documentos_vencendo() ->> 'materializadas')::integer, 2,
  'a etapa agenda os dois documentos que entraram nos 30 dias ou já venceram (o em dia e o sem validade ficam de fora)');
select is((privado.recalculo_documentos_vencendo() ->> 'materializadas')::integer, 0, 'rodar de novo não repete o aviso');
update documento_profissional set validade = (select hoje + 200 from t_h) where id = 'd2210000-0000-4000-8000-000000000001';
select is((privado.recalculo_documentos_vencendo() ->> 'materializadas')::integer, 0, 'documento renovado sai do aviso');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'documento_vencendo' and familia_id is null and status = 'agendada'), 2,
  'as duas execuções esperam o motor');
insert into t_r select 'motor', privado.processar_automacoes();
select is((select count(*)::integer from automacao_execucao where automacao_id = 'documento_vencendo' and status = 'executada'), 2,
  'o motor executa as duas (pode_executar passa: sem família, nada a frear)');
select cmp_ok((select count(*)::integer from notificacao where papel = 'coordenacao' and titulo = 'documento_vencendo'), '>=', 2,
  'a coordenação é notificada');
update automacao set ativa = false where id = 'documento_vencendo';
select is(privado.recalculo_documentos_vencendo() ->> 'ativa', 'false', 'com a automação desligada a etapa não faz nada');
update automacao set ativa = true where id = 'documento_vencendo';

-- -----------------------------------------------------------------------------
-- 9. Portal da enfermeira
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$ select api.portal_hoje() $$, '42501', null, 'comercial não abre o portal');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ select api.portal_hoje() $$, '42501', null, 'coordenação usa a agenda, não o portal da enfermeira');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal1');
select throws_ok($$ select api.portal_hoje() $$, '42501', null, 'enfermeira em AAL1 é recusada (dado assistencial exige MFA)');

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
insert into t_r select 'hoje_a', api.portal_hoje();
select is((select jsonb_array_length(r -> 'visitas') from t_r where chave = 'hoje_a'), 3,
  'A vê as três visitas dela de hoje (as duas do início e a que a coordenação trouxe)');
select is((select r #>> '{visitas,0,nome_exibicao}' from t_r where chave = 'hoje_a'), 'Família Teste Agenda A1', 'em ordem de horário: a das 08:00 primeiro');
select is((select r #>> '{visitas,0,turno}' from t_r where chave = 'hoje_a'), 'manha', 'a visita das 08:00 é da manhã');
select is((select r #>> '{visitas,1,turno}' from t_r where chave = 'hoje_a'), 'tarde', 'a visita das 14:00 é da tarde');
select is((select r #>> '{visitas,0,contato_nome}' from t_r where chave = 'hoje_a'), 'Helena Teste Portal', 'traz o contato principal');
select is((select r #>> '{visitas,0,dias_contratados}' from t_r where chave = 'hoje_a'), '6', 'traz o dia e o total (D1 de 6)');
select ok(not exists (select 1 from t_r, jsonb_array_elements(r -> 'visitas') v, jsonb_object_keys(v) k
                      where chave = 'hoje_a' and k in ('origem', 'utm', 'codigo_origem', 'estagio_p1', 'estagio_p2', 'score', 'oportunidade', 'valor_centavos')),
  'nenhum dado comercial no portal');
select is((select r ->> 'status' from t_r where chave = 'hoje_a'), 'em_atendimento', 'o estado de hoje vem calculado');
select is((select count(*)::integer from visita), 11, 'pela RLS a enfermeira A só enxerga as próprias visitas nas tabelas');
select is((select count(*)::integer from acompanhamento), 3, 'e só os acompanhamentos das famílias atribuídas a ela');

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000004', 'aal2');
select is(jsonb_array_length(api.portal_hoje() -> 'visitas'), 0, 'B não tem visita hoje');
select is((select count(*)::integer from jsonb_array_elements(api.portal_familias()) f), 3,
  'B vê só as famílias dela: A3 e A9 (titular) e A4 (backup)');
select is((select string_agg(f ->> 'nome_exibicao', ',' order by f ->> 'nome_exibicao') from jsonb_array_elements(api.portal_familias()) f),
  'Família Teste Agenda A3,Família Teste Agenda A4,Família Teste Agenda A9', 'B não vê as famílias de A');
select is((select f ->> 'papel' from jsonb_array_elements(api.portal_familias()) f where f ->> 'nome_exibicao' = 'Família Teste Agenda A4'), 'backup',
  'papel de backup aparece na lista');
select throws_ok(format($$ select api.registrar_chegada(%L, null, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1)),
  '42501', null, 'B não registra chegada na visita de A');

select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select is((select count(*)::integer from jsonb_array_elements(api.portal_familias()) f), 3, 'A vê as três famílias atribuídas (a encerrada há mais de sete dias sai)');
select is((select f #>> '{acompanhamento,dias_contratados}' from jsonb_array_elements(api.portal_familias()) f where f ->> 'nome_exibicao' = 'Família Teste Agenda A1'), '6',
  'a lista traz o acompanhamento');
select is((select jsonb_array_length(f -> 'visitas') from jsonb_array_elements(api.portal_familias()) f where f ->> 'nome_exibicao' = 'Família Teste Agenda A1'), 6,
  'e as visitas dele');

select testes.encerrar();
select cmp_ok((select count(*)::integer from log_auditoria where acao = 'leitura' and entidade = 'familia'
                 and entidade_id = 'c2200000-0000-4000-8000-000000000001' and valor_depois ->> 'funcao' = 'api.portal_hoje'), '>=', 1,
  'a leitura do portal grava log por família');
select cmp_ok((select count(*)::integer from log_auditoria where acao = 'leitura' and entidade = 'acompanhamento'
                 and entidade_id = 'c2200000-0000-4000-8000-000000000001'), '>=', 2,
  'o acompanhamento é lido por assistencial.ler_acompanhamento, que grava o log antes de devolver');

-- chegada
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select is((select versao from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), 1, 'a visita começa na versão 1');
select matches(testes.p37_erro(format($$ select api.registrar_chegada(%L, now() + interval '2 hours', false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1))),
  '^equipe:hora_no_futuro', 'chegada no futuro é recusada');
select matches(testes.p37_erro(format($$ select api.registrar_chegada(%L, now() - interval '1 day', false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1))),
  '^equipe:fora_do_dia_da_visita', 'chegada de outro dia é recusada');
select matches(testes.p37_erro(format($$ select api.registrar_saida(%L, null, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1))),
  '^equipe:saida_sem_chegada', 'saída sem chegada é recusada');
select matches(testes.p37_erro(format($$ select api.registrar_chegada(%L, null, false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 2))),
  '^equipe:fora_do_dia_da_visita', 'chegada numa visita de outro dia é recusada');

select testes.p37_nova_transacao();
insert into t_r select 'chegada', api.registrar_chegada(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), testes.p37_atras(10), false);
select is((select r ->> 'estado' from t_r where chave = 'chegada'), 'iniciada', 'a chegada leva a visita a iniciada');
select is((select checkin_em from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), testes.p37_atras(10),
  'a hora de chegada gravada é a informada (a do aparelho), não a do servidor');
select is((select versao from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), 2,
  'as três transições e a hora são uma gravação lógica só: versão 1 para 2');
select is(testes.p37_eventos_visita('c2200000-0000-4000-8000-000000000001', array['confirmada', 'a_caminho', 'iniciada']), 3,
  'a linha do tempo tem as três passagens de estado');
select is((select status::text from api.status_equipe(null, null) where dia = (select hoje from t_h)), 'em_visita',
  'com a chegada, o estado da profissional passa a em visita (calculado, ninguém digitou)');
select is((select (api.portal_hoje() -> 'visitas' -> 0 ->> 'checkin_em') is not null), true, 'o portal mostra a chegada');

-- de novo: idempotente
select testes.p37_nova_transacao();
insert into t_r select 'chegada2', api.registrar_chegada(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), now(), false);
select is((select r ->> 'ja_registrada' from t_r where chave = 'chegada2'), 'true', 'registrar a chegada de novo não faz nada');
select is((select versao from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), 2, 'e não mexe na versão');

-- saída
select matches(testes.p37_erro(format($$ select api.registrar_saida(%L, testes.p37_atras(12), false) $$,
    (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1))),
  '^equipe:saida_antes_da_chegada', 'saída antes da chegada é recusada');
select testes.p37_nova_transacao();
insert into t_r select 'saida', api.registrar_saida(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), testes.p37_atras(1), false);
select is((select r ->> 'estado' from t_r where chave = 'saida'), 'ficha_pendente', 'a saída deixa a ficha pendente');
select is((select versao from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), 3, 'a saída é uma gravação lógica: versão 2 para 3');
select is((select status::text from api.status_equipe(null, null) where dia = (select hoje from t_h)), 'em_atendimento',
  'com a saída, o estado volta ao de antes: em atendimento');
select is((select jsonb_array_length(api.portal_hoje() -> 'fichas_pendentes')), 1, 'a visita sem ficha aparece nas fichas pendentes');
select is((select api.portal_hoje() #>> '{fichas_pendentes,0,estado}'), 'ficha_pendente', 'com o estado da ficha');
insert into t_r select 'saida2', api.registrar_saida(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1), now(), false);
select is((select r ->> 'ja_registrada' from t_r where chave = 'saida2'), 'true', 'registrar a saída de novo também é idempotente');

-- pelo motor offline: a hora vem do aparelho e a origem do log é sync
select testes.p37_nova_transacao();
insert into t_r select 'chegada_sync', api.registrar_chegada(
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000002' and dia_numero = 1), testes.p37_atras(20), true);
select testes.encerrar();
select is((select origem from log_auditoria where entidade = 'visita'
             and entidade_id = (select id::text from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000002' and dia_numero = 1)
             and acao = 'visita_chegada' order by id desc limit 1), 'sync', 'chegada que veio da fila do aparelho tem origem sync no log');
select is((select origem from log_auditoria where entidade = 'visita'
             and entidade_id = (select id::text from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000001' and dia_numero = 1)
             and acao = 'visita_chegada' order by id desc limit 1), 'app', 'chegada direta tem origem app');
select ok(not exists (select 1 from log_auditoria where acao in ('visita_chegada', 'visita_saida') and valor_depois::text ~* '(Helena|Clara|Família)'),
  'o log da chegada e da saída não leva nome de família');

-- itens da fila do aparelho já processados (idempotência do POST /api/sync)
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select is(api.sincronizacao_item('f2200000-0000-4000-8000-000000000001'), null, 'item ainda não processado: nulo');
select api.sincronizacao_registrar('f2200000-0000-4000-8000-000000000001', 'visita',
  (select id from visita where acompanhamento_id = 'e2200000-0000-4000-8000-000000000002' and dia_numero = 1),
  'checkin_em', '"2030-01-01T08:00:00Z"', 2, now(), 'processado', null);
select is(api.sincronizacao_item('f2200000-0000-4000-8000-000000000001') ->> 'status', 'processado', 'item registrado volta como processado');
select api.sincronizacao_registrar('f2200000-0000-4000-8000-000000000001', 'visita', null, 'checkin_em', '"outro"', 9, now(), 'conflito',
  '{"original": {}, "versaoAtual": 9, "tentativa": "outro"}');
select is(api.sincronizacao_item('f2200000-0000-4000-8000-000000000001') ->> 'status', 'processado', 'registrar de novo o mesmo id não muda nada');
select matches(testes.p37_erro($$ select api.sincronizacao_registrar('f2200000-0000-4000-8000-000000000002', 'visita', null, 'x', '1', 1, now(), 'erro', null) $$),
  '^equipe:status_invalido', 'status erro não é guardado (o aparelho tenta de novo)');
select matches(testes.p37_erro($$ select api.sincronizacao_registrar('f2200000-0000-4000-8000-000000000002', 'familia', null, 'x', '1', 1, now(), 'processado', null) $$),
  '^equipe:entidade_invalida', 'entidade desconhecida é recusada');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000004', 'aal2');
select is(api.sincronizacao_item('f2200000-0000-4000-8000-000000000001'), null, 'o item de uma pessoa não aparece para outra');
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal1');
select throws_ok($$ select api.sincronizacao_item('f2200000-0000-4000-8000-000000000001') $$, '42501', null, 'sem MFA a fila não abre');
select testes.encerrar();

-- desativar a profissional corta o acesso na hora
update profissional set ativa = false where id = 'd2200000-0000-4000-8000-000000000101';
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000003', 'aal2');
select matches(testes.p37_erro($$ select api.portal_hoje() $$), '^equipe:sem_profissional', 'profissional desativada perde o portal');
select is((select count(*)::integer from privado.familias_atribuidas()), 0, 'e a lista de famílias atribuídas fica vazia');
select testes.encerrar();

-- perfil
select testes.autenticar_authenticated('a2200000-0000-4000-8000-000000000004', 'aal2');
insert into t_r select 'perfil_b', api.portal_perfil();
select is((select r #>> '{profissional,nome}' from t_r where chave = 'perfil_b'), 'Profissional Teste B', 'perfil da própria enfermeira');
select ok(not (select r -> 'profissional' from t_r where chave = 'perfil_b') ? 'valor_hora_centavos', 'sem valor da hora no perfil da enfermeira');
select is((select r ->> 'status' from t_r where chave = 'perfil_b'), 'backup', 'o estado de hoje vem calculado');

-- -----------------------------------------------------------------------------
-- 10. Privilégios
-- -----------------------------------------------------------------------------

select testes.encerrar();
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'api'
             and p.proname in ('equipe', 'escala_semanal', 'agenda', 'reagendar_visita', 'reagendar_cascata', 'salvar_profissional',
                               'salvar_documento_profissional', 'salvar_bloqueio_agenda', 'remover_bloqueio_agenda', 'portal_hoje',
                               'portal_familias', 'portal_perfil', 'registrar_chegada', 'registrar_saida', 'sincronizacao_item', 'sincronizacao_registrar')
             and has_function_privilege('authenticated', p.oid, 'execute')
             and not has_function_privilege('anon', p.oid, 'execute')
             and not has_function_privilege('service_role', p.oid, 'execute')
             and p.prosecdef), 16,
  'as dezesseis funções novas de api: só authenticated executa, todas security definer');
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'privado'
       and p.proname in ('equipe_recusar', 'equipe_log', 'visita_movivel', 'visita_ocupa_agenda', 'turno_da_visita', 'limite_visitas_dia',
                         'documento_aviso_dias', 'dia_do_acompanhamento', 'conflitos_visita', 'mover_visita',
                         'recalculo_documentos_vencendo', 'portal_profissional', 'visita_do_portal', 'horario_do_registro')
       and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')) $$,
  'as auxiliares novas de privado não têm execute para o app');
select testes.autenticar_anon();
select throws_ok($$ select api.portal_hoje() $$, '42501', null, 'anon não executa o portal');
select testes.encerrar();

select * from finish();

rollback;
