-- =============================================================================
-- supabase/tests/021_prenatal_nascimento.sql
--
-- Migration 0021_prenatal_nascimento (P35 consulta pré-natal e alerta de 34
-- semanas, P36 designação, radar, nascimento e alta):
--   1. Pagamento confirmado abre a consulta e a tarefa (urgente acima de 34
--      semanas) e nunca desfaz a baixa se algo falhar.
--   2. Agendar, abrir (em branco, com log), salvar campo (destinos do bloco H,
--      conflito, retomada), concluir e alterar depois com motivo.
--   3. alerta_34s: só a coordenação, uma vez, sem nada para a família.
--   4. Designação: oferta, resposta, recusa que aciona o backup, prazo
--      vencido, atribuição direta, cada papel só vê o que é seu.
--   5. Nascimento e alta: P2 só por transicionar, seis ou doze visitas no
--      mesmo período, tarefa do guia, aviso à titular, fatos vindos da ficha.
--   6. Radar e alertas de DPP (a DPP nunca move nada).
--   7. Privilégios.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(273);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2100000-0000-4000-8000-000000000001', 'coordenacao.p35@exemplo.invalid'),
  ('a2100000-0000-4000-8000-000000000002', 'diretoria.p35@exemplo.invalid'),
  ('a2100000-0000-4000-8000-000000000003', 'comercial.p35@exemplo.invalid'),
  ('a2100000-0000-4000-8000-000000000004', 'financeiro.p35@exemplo.invalid'),
  ('a2100000-0000-4000-8000-000000000011', 'enfa.p36@exemplo.invalid'),
  ('a2100000-0000-4000-8000-000000000012', 'enfb.p36@exemplo.invalid'),
  ('a2100000-0000-4000-8000-000000000013', 'enfc.p36@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a2100000-0000-4000-8000-000000000001', 'Beatriz Teste Coordenação', 'coordenacao.p35@exemplo.invalid', true),
  ('a2100000-0000-4000-8000-000000000002', 'Perfil Teste Diretoria P35', 'diretoria.p35@exemplo.invalid', true),
  ('a2100000-0000-4000-8000-000000000003', 'Perfil Teste Comercial P35', 'comercial.p35@exemplo.invalid', true),
  ('a2100000-0000-4000-8000-000000000004', 'Perfil Teste Financeiro P35', 'financeiro.p35@exemplo.invalid', true),
  ('a2100000-0000-4000-8000-000000000011', 'Ana Teste Enfermeira', 'enfa.p36@exemplo.invalid', true),
  ('a2100000-0000-4000-8000-000000000012', 'Bia Teste Enfermeira', 'enfb.p36@exemplo.invalid', true),
  ('a2100000-0000-4000-8000-000000000013', 'Carla Teste Enfermeira', 'enfc.p36@exemplo.invalid', true);

insert into usuario_papel (usuario_id, papel) values
  ('a2100000-0000-4000-8000-000000000001', 'coordenacao'),
  ('a2100000-0000-4000-8000-000000000002', 'diretoria'),
  ('a2100000-0000-4000-8000-000000000003', 'comercial'),
  ('a2100000-0000-4000-8000-000000000004', 'financeiro'),
  ('a2100000-0000-4000-8000-000000000011', 'enfermeira'),
  ('a2100000-0000-4000-8000-000000000012', 'enfermeira'),
  ('a2100000-0000-4000-8000-000000000013', 'enfermeira');

insert into profissional (id, usuario_id, nome, funcao, telefone_e164, regioes, ativa) values
  ('d2100000-0000-4000-8000-000000000011', 'a2100000-0000-4000-8000-000000000011', 'Ana Teste Enfermeira',
   'enfermeira_obstetrica', '+5511900021011', array[(select id from regiao where nome = 'São Paulo')], true),
  ('d2100000-0000-4000-8000-000000000012', 'a2100000-0000-4000-8000-000000000012', 'Bia Teste Enfermeira',
   'enfermeira_neonatal', '+5511900021012', array[(select id from regiao where nome = 'São Paulo')], true),
  ('d2100000-0000-4000-8000-000000000013', 'a2100000-0000-4000-8000-000000000013', 'Carla Teste Enfermeira',
   'enfermeira_obstetrica', '+5511900021013', array[(select id from regiao where nome = 'São Paulo')], true),
  ('d2100000-0000-4000-8000-000000000014', null, 'Dora Teste Inativa',
   'enfermeira_obstetrica', '+5511900021014', array[(select id from regiao where nome = 'São Paulo')], false),
  ('d2100000-0000-4000-8000-000000000015', 'a2100000-0000-4000-8000-000000000001', 'Beatriz Teste Coordenação',
   'coordenacao', '+5511900021015', array[(select id from regiao where nome = 'São Paulo')], true);

-- os parâmetros e a ativação das automações são do seed; o teste não
-- depende dele ter rodado
insert into parametro (chave, valor) values
  ('prenatal_semanas_alerta', '34'),
  ('designacao_prazo_resposta_horas', '24'),
  ('alta_primeira_visita_dias', '1'),
  ('visita_hora_por_periodo', '{"manha":"09:00","tarde":"14:00"}'),
  ('visitas_maximo_por_dia', '2'),
  ('radar_horizonte_dias', '56'),
  ('radar_sem_contato_dias', '7'),
  ('janela_dpp_dias', '{"antes":21,"depois":14}'),
  ('capacidade_alerta_pct', '85')
on conflict (chave) do update set valor = excluded.valor;
update automacao set ativa = true
 where id in ('prenatal_urgente', 'alerta_34s', 'checkin_dpp', 'dpp_sem_confirmacao', 'dpp_sem_contato', 'nascimento', 'alta');

-- o DOC 1 aprovado (o teste 045 prova que a migration de dados não aprova)
update instrumento set vigente = true where codigo = 'DOC1_ENTREVISTA' and versao = 'v1-2026-09';

create function testes.p21_hoje() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;
create function testes.p21_id(prefixo text, n integer) returns uuid language sql immutable as $$
  select (prefixo || '2100000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function testes.p21_afetadas(p_sql text) returns integer language plpgsql as $$
declare
  v_n integer;
begin
  execute p_sql;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- chama uma função de api como um usuário e devolve o jsonb; o papel volta a
-- ser o do dono antes de qualquer conferência direta nas tabelas
create function testes.p21_api(p_uid uuid, p_sql text, p_aal text default 'aal2') returns jsonb language plpgsql as $$
declare
  v_r jsonb;
begin
  perform testes.autenticar_authenticated(p_uid, p_aal);
  execute p_sql into v_r;
  perform testes.encerrar();
  return v_r;
end;
$$;
create function testes.p21_coord(p_sql text) returns jsonb language sql as $$
  select testes.p21_api('a2100000-0000-4000-8000-000000000001', p_sql)
$$;

-- família com contrato, cobrança aberta e oportunidade num estágio do P2
create function testes.p21_familia(
  p_n integer, p_nome text, p_dpp date, p_estagio text default 'cobranca_gerada', p_dias integer default 6,
  p_estado text default 'normal'
) returns uuid language plpgsql as $$
declare
  v_f uuid := testes.p21_id('c', p_n);
begin
  insert into familia (id, nome_exibicao, dpp, estado_sensivel, regiao_id, bairro)
  values (v_f, p_nome, p_dpp, p_estado::estado_sensivel, (select id from regiao where nome = 'São Paulo'), 'Bairro Teste');
  insert into pessoa (id, familia_id, papel, nome, telefone_e164, contato_principal)
  values (testes.p21_id('d', p_n), v_f, 'mae', 'Mãe ' || p_nome, '+551190002' || lpad(p_n::text, 4, '0'), true);
  insert into oportunidade (id, familia_id, pipeline, estagio_p1, estagio_p2)
  values (testes.p21_id('e', p_n), v_f, 2, null, p_estagio::estagio_p2);
  insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status)
  values (testes.p21_id('f', p_n), v_f,
          (select pv.id from pacote_versao pv join pacote pc on pc.id = pv.pacote_id
            where pc.dias = p_dias and not pc.gemelar order by pv.vigencia_inicio desc limit 1),
          420000, 'teste', 'assinado');
  insert into cobranca (id, contrato_id, valor_centavos, vencimento, external_id, status)
  values (testes.p21_id('b', p_n), testes.p21_id('f', p_n), 420000, current_date + 5, 'p21-cobranca-' || p_n, 'aberta');
  return v_f;
end;
$$;

do $$
begin
  perform testes.p21_familia(1,  'Família Teste Prenatal Normal',  testes.p21_hoje() + 100);
  perform testes.p21_familia(2,  'Família Teste Prenatal Urgente', testes.p21_hoje() + 20);
  perform testes.p21_familia(3,  'Família Teste Limite 34',        testes.p21_hoje() + 42, 'pagamento_confirmado');
  perform testes.p21_familia(4,  'Família Teste Trinta e Tres',    testes.p21_hoje() + 49, 'pagamento_confirmado');
  perform testes.p21_familia(12, 'Família Teste Atrasada Sem Nada', testes.p21_hoje() - 30, 'aguardando_nascimento');
end $$;

-- a lead que ainda não contratou, já com 36 semanas
insert into familia (id, nome_exibicao, dpp) values
  ('c2100000-0000-4000-8000-000000000005', 'Família Teste Lead Trinta e Seis', testes.p21_hoje() + 28);
insert into oportunidade (familia_id, pipeline, estagio_p1) values
  ('c2100000-0000-4000-8000-000000000005', 1, 'qualificado');

-- =============================================================================
-- 1. Pagamento confirmado abre a consulta pré-natal
-- =============================================================================

select is((select count(*)::integer from consulta_prenatal where familia_id in
            (testes.p21_id('c', 1), testes.p21_id('c', 2))), 0,
  'antes do pagamento não existe consulta pré-natal');

update cobranca set status = 'paga', pago_em = now() where id = testes.p21_id('b', 1);
update cobranca set status = 'paga', pago_em = now() where id = testes.p21_id('b', 2);

select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 1)), 'pagamento_confirmado',
  'pagamento: o P2 sai de cobranca_gerada para pagamento_confirmado (por transicionar)');
select results_eq(
  $$ select status::text, urgente, instrumento_versao from consulta_prenatal where familia_id = testes.p21_id('c', 1) $$,
  $$ values ('pendente'::text, false, 'v1-2026-09'::text) $$,
  'pagamento com 25 semanas: consulta pendente, não urgente, na versão do DOC 1');
select results_eq(
  $$ select status::text, urgente from consulta_prenatal where familia_id = testes.p21_id('c', 2) $$,
  $$ values ('pendente'::text, true) $$,
  'pagamento com mais de 34 semanas: consulta urgente');
select results_eq(
  $$ select tipo::text, papel_responsavel::text, prioridade::text, status::text from tarefa
      where familia_id = testes.p21_id('c', 1) and tipo = 'agendar_prenatal' $$,
  $$ values ('agendar_prenatal'::text, 'coordenacao'::text, 'normal'::text, 'aberta'::text) $$,
  'tarefa agendar_prenatal para a coordenação, prioridade normal');
select results_eq(
  $$ select prioridade::text, origem_automacao_id from tarefa
      where familia_id = testes.p21_id('c', 2) and tipo = 'agendar_prenatal' $$,
  $$ values ('maxima'::text, 'prenatal_urgente'::text) $$,
  'urgente: a tarefa nasce com prioridade máxima (prenatal_urgente)');
select is((select vence_em from tarefa where familia_id = testes.p21_id('c', 2) and tipo = 'agendar_prenatal') <= clock_timestamp(), true,
  'urgente: a tarefa já está vencendo');
select is((select count(*)::integer from notificacao where papel = 'coordenacao' and prioridade = 'maxima'
            and link = '/prenatal/' || testes.p21_id('c', 2)::text), 1,
  'urgente: a coordenação é avisada no mesmo instante, com prioridade máxima e link da entrevista');
select is((select count(*)::integer from notificacao where link = '/prenatal/' || testes.p21_id('c', 1)::text), 0,
  'não urgente: nenhum aviso imediato');
select is((select count(*)::integer from notificacao where titulo like '%' || 'Família Teste' || '%'), 0,
  'nenhum título de aviso leva nome de família (o push mostra só o título)');
select results_eq(
  $$ select estado::text, dias_contratados, horas_por_visita from acompanhamento where familia_id = testes.p21_id('c', 1) $$,
  $$ values ('aguardando'::text, 6, 3.0::numeric) $$,
  'o acompanhamento nasce em aguardando, com os dias e as horas da versão do pacote');
select is((select count(*)::integer from mensagem m join conversa c on c.id = m.conversa_id
            where c.familia_id in (testes.p21_id('c', 1), testes.p21_id('c', 2))), 0,
  'nada saiu para a família no pagamento (aviso urgente é interno)');

-- idempotência: uma segunda parcela paga não abre outra consulta
insert into cobranca (id, contrato_id, parcela, valor_centavos, vencimento, external_id, status)
  values (testes.p21_id('b', 101), testes.p21_id('f', 1), 2, 100, current_date + 30, 'p21-cobranca-101', 'aberta');
update cobranca set status = 'paga' where id = testes.p21_id('b', 101);
select is((select count(*)::integer from consulta_prenatal where familia_id = testes.p21_id('c', 1)), 1,
  'segunda parcela paga: continua uma consulta viva por família');
select is((select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 1) and tipo = 'agendar_prenatal'), 1,
  'segunda parcela paga: uma tarefa só');

-- o pagamento vale mesmo se o que vem depois falhar
create function testes.p21_falha() returns trigger language plpgsql as $$
begin
  raise exception 'falha simulada';
end;
$$;
do $$ begin perform testes.p21_familia(30, 'Família Teste Falha No Pagamento', testes.p21_hoje() + 90); end $$;
create trigger p21_falha before insert on consulta_prenatal for each row execute function testes.p21_falha();
update cobranca set status = 'paga' where id = testes.p21_id('b', 30);
drop trigger p21_falha on consulta_prenatal;
select is((select status::text from cobranca where id = testes.p21_id('b', 30)), 'paga',
  'falha depois do pagamento: a baixa da cobrança continua');
select results_eq(
  $$ select tipo::text, prioridade::text from tarefa where familia_id = testes.p21_id('c', 30) $$,
  $$ values ('outro'::text, 'alta'::text) $$,
  'falha depois do pagamento: vira tarefa para a coordenação');

-- família que já teve o parto não ganha consulta
do $$ begin perform testes.p21_familia(31, 'Família Teste Pagou Depois Do Parto', testes.p21_hoje() - 3); end $$;
update familia set data_nascimento = testes.p21_hoje() - 2 where id = testes.p21_id('c', 31);
update cobranca set status = 'paga' where id = testes.p21_id('b', 31);
select is((select count(*)::integer from consulta_prenatal where familia_id = testes.p21_id('c', 31)), 0,
  'pagamento depois do parto: nenhuma consulta pré-natal');


-- =============================================================================
-- 2. Agendar, abrir, salvar campo, concluir
-- =============================================================================

-- papéis e AAL
select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ select api.agendar_consulta_prenatal('c2100000-0000-4000-8000-000000000001', now() + interval '2 days') $s$,
  '42501', null, 'comercial não agenda a consulta pré-natal');
select throws_ok($s$ select api.prenatal_abrir('c2100000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'comercial não abre a entrevista');
select is((api.prenatal_estado('c2100000-0000-4000-8000-000000000001') ->> 'status'), 'pendente',
  'comercial vê o estado da consulta');
select is((api.prenatal_estado('c2100000-0000-4000-8000-000000000001') - 'existe' - 'status' - 'agendada_para'
            - 'realizada_em' - 'em_andamento'), '{}'::jsonb,
  'o estado do comercial não leva resposta, plano nem período');
select testes.encerrar();

select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($s$ select api.prenatal_estado('c2100000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'financeiro não vê nem o estado do pré-natal');
select testes.encerrar();

select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000011', 'aal2');
select throws_ok($s$ select api.prenatal_abrir('c2100000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'enfermeira não abre a entrevista');
select throws_ok($s$ select api.prenatal_consultas() $s$, '42501', null, 'enfermeira não lista as consultas');
select testes.encerrar();

select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.prenatal_abrir('c2100000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'coordenação em AAL1 não abre a entrevista (dado assistencial exige AAL2)');
select testes.encerrar();

-- a lista
create temp table t_p21 (chave text primary key, r jsonb) on commit drop;
grant all on t_p21 to public;
insert into t_p21 select 'lista', testes.p21_coord('select api.prenatal_consultas()');
select is((select jsonb_array_length(r) >= 2 from t_p21 where chave = 'lista'), true, 'a lista traz as consultas vivas');
select is((select (e ->> 'urgente')::boolean from t_p21, jsonb_array_elements(r) e
            where chave = 'lista' and e ->> 'familia_id' = testes.p21_id('c', 2)::text), true, 'a lista marca a urgente');
select is((select (r -> 0 ->> 'urgente')::boolean from t_p21 where chave = 'lista'), true,
  'a urgente vem primeiro');

select is((select (e ->> 'chegou_alerta')::boolean from t_p21, jsonb_array_elements(r) e
            where chave = 'lista' and e ->> 'familia_id' = testes.p21_id('c', 2)::text), true,
  'a lista marca quem já chegou às 34 semanas (aviso interno, só da coordenação)');
select is((select (e ->> 'chegou_alerta')::boolean from t_p21, jsonb_array_elements(r) e
            where chave = 'lista' and e ->> 'familia_id' = testes.p21_id('c', 1)::text), false,
  'e não marca quem tem 25 semanas');

-- agendar
select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.agendar_consulta_prenatal('c2100000-0000-4000-8000-000000000001', now() - interval '1 hour') $s$,
  'P0001', 'operacao:data_no_passado ', 'agendar no passado é recusado');
select throws_ok($s$ select api.agendar_consulta_prenatal('c2100000-0000-4000-8000-000000000001', now() + interval '2 days',
                       'a2100000-0000-4000-8000-000000000003') $s$,
  'P0001', 'operacao:condutor_invalido ', 'quem conduz é coordenação ou diretoria');
select testes.encerrar();

select is((testes.p21_coord($s$ select api.agendar_consulta_prenatal('c2100000-0000-4000-8000-000000000001', now() + interval '2 days') $s$) ->> 'ok')::boolean,
  true, 'agendar a consulta');
select results_eq(
  $$ select status::text, conduzida_por from consulta_prenatal where familia_id = testes.p21_id('c', 1) $$,
  $$ values ('agendada'::text, 'a2100000-0000-4000-8000-000000000001'::uuid) $$,
  'consulta agendada, conduzida por quem agendou');
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 1)), 'consulta_prenatal_agendada',
  'agendar leva o P2 a consulta_prenatal_agendada');
select is((select status::text from tarefa where familia_id = testes.p21_id('c', 1) and tipo = 'agendar_prenatal'), 'concluida',
  'agendar conclui a tarefa agendar_prenatal');
select is((testes.p21_coord($s$ select api.agendar_consulta_prenatal('c2100000-0000-4000-8000-000000000001', now() + interval '3 days') $s$) ->> 'ok')::boolean,
  true, 'remarcar é permitido');
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 1)), 'consulta_prenatal_agendada',
  'remarcar não mexe no P2');

-- abrir: em branco, com definição aprovada e leitura no log
insert into t_p21 select 'abrir1', testes.p21_coord($s$ select api.prenatal_abrir('c2100000-0000-4000-8000-000000000001') $s$);
select is((select r -> 'respostas' from t_p21 where chave = 'abrir1'), '{}'::jsonb,
  'toda entrevista nasce em branco');
select is((select jsonb_array_length(r -> 'definicao' -> 'blocos') from t_p21 where chave = 'abrir1'), 8,
  'a definição aprovada do DOC 1 (blocos A a H) acompanha');
select is((select r -> 'sugestoes' ->> 'B.data_provavel_do_parto' from t_p21 where chave = 'abrir1'),
  (testes.p21_hoje() + 100)::text, 'a DPP do cadastro da mesma família vem como sugestão');
select is((select r -> 'sugestoes' ->> 'C.telefone_da_gestante' from t_p21 where chave = 'abrir1'), '+5511900020001',
  'o telefone do cadastro da mesma família vem como sugestão');
select is((select r -> 'sugestoes' ? 'A.como_chegou' from t_p21 where chave = 'abrir1'), false,
  'a origem do lead não vai para a coordenação (PRD 13: "Lead e origem" sem acesso)');
select is((select r -> 'familia' ->> 'ig' from t_p21 where chave = 'abrir1'),
  (select ig.texto from ig(testes.p21_hoje() + 100, testes.p21_hoje()) ig), 'a IG vem calculada da DPP, nunca gravada');
select is((select count(*)::integer from log_auditoria where acao = 'leitura' and entidade = 'consulta_prenatal'
            and entidade_id = testes.p21_id('c', 1)::text), 1, 'abrir a entrevista grava a leitura no log');

-- salvar campo, um por vez
create temp table t_v (chave text primary key, v integer) on commit drop;
grant all on t_v to public;
insert into t_v select 'v0', (r -> 'consulta' ->> 'versao')::integer from t_p21 where chave = 'abrir1';
create function testes.p21_consulta(n integer) returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.consulta_prenatal where familia_id = testes.p21_id('c', n)
$$;

insert into t_p21 select 's1', testes.p21_coord(format(
  $f$ select api.prenatal_salvar_campo(%L, 'A', 'como_chegou', '"instagram"', %s) $f$,
  testes.p21_consulta(1), (select v from t_v where chave = 'v0')));
select is((select (r ->> 'ok')::boolean from t_p21 where chave = 's1'), true, 'salvar um campo');
select is((select (r ->> 'versao')::integer from t_p21 where chave = 's1'), (select v + 1 from t_v where chave = 'v0'),
  'a versão sobe uma vez por campo');
select is((select ficha -> 'A' ->> 'como_chegou' from consulta_prenatal where familia_id = testes.p21_id('c', 1)), 'instagram',
  'o campo foi para a ficha do DOC 1');
select isnt((select iniciada_em from consulta_prenatal where familia_id = testes.p21_id('c', 1)), null,
  'a primeira resposta marca a entrevista como iniciada');

-- conflito de versão: nada é gravado, o original fica
insert into t_p21 select 's2', testes.p21_coord(format(
  $f$ select api.prenatal_salvar_campo(%L, 'A', 'como_chegou', '"presente"', %s) $f$,
  testes.p21_consulta(1), (select v from t_v where chave = 'v0')));
select results_eq(
  $$ select (r ->> 'ok')::boolean, (r ->> 'conflito')::boolean, r ->> 'original' from t_p21 where chave = 's2' $$,
  $$ values (false, true, 'instagram'::text) $$,
  'versão desatualizada: conflito, com o original');
select is((select ficha -> 'A' ->> 'como_chegou' from consulta_prenatal where familia_id = testes.p21_id('c', 1)), 'instagram',
  'no conflito o valor gravado não muda');

-- recusas de negócio
select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(format($f$ select api.prenatal_salvar_campo(%L, 'Z', 'nada', '"x"') $f$, testes.p21_consulta(1)),
  'P0001', 'operacao:campo_inexistente ', 'campo que não está na definição');
select throws_ok(format($f$ select api.prenatal_salvar_campo(%L, 'B', 'coletador', '"Quem quer que seja"') $f$, testes.p21_consulta(1)),
  'P0001', 'operacao:campo_automatico ', 'campo automático não se grava (coletador vem do login)');
select throws_ok(format($f$ select api.prenatal_salvar_campo(%L, 'B', 'idade_gestacional_atual', '"34s"') $f$, testes.p21_consulta(1)),
  'P0001', 'operacao:campo_automatico ', 'a IG nunca é gravada');
select throws_ok(format($f$ select api.prenatal_salvar_campo(%L, 'H', 'preferencia_de_periodo', '["madrugada"]') $f$, testes.p21_consulta(1)),
  'P0001', 'operacao:periodo_invalido ', 'período fora do enum');
select throws_ok(format($f$ select api.prenatal_salvar_campo(%L, null, null, null) $f$, testes.p21_consulta(1)),
  'P0001', 'operacao:dados_obrigatorios bloco ou progresso', 'sem bloco nem progresso não há o que gravar');
select throws_ok(format($f$ select api.prenatal_salvar_campo(%L, 'F', 'medos_e_receios', to_jsonb(repeat('x', 20001))) $f$, testes.p21_consulta(1)),
  'P0001', 'operacao:valor_grande_demais ', 'valor grande demais');
select testes.encerrar();

-- retomada: onde parou, na etapa e no campo
select is((testes.p21_coord(format(
  $f$ select api.prenatal_salvar_campo(%L, null, null, null, null, '{"etapa": 4, "campo": "D.gestacoes_anteriores"}') $f$,
  testes.p21_consulta(1))) ->> 'ok')::boolean, true, 'grava onde a pessoa parou');
insert into t_p21 select 'abrir2', testes.p21_coord($s$ select api.prenatal_abrir('c2100000-0000-4000-8000-000000000001') $s$);
select results_eq(
  $$ select (r -> 'consulta' -> 'progresso' ->> 'etapa')::integer, r -> 'consulta' -> 'progresso' ->> 'campo'
       from t_p21 where chave = 'abrir2' $$,
  $$ values (4, 'D.gestacoes_anteriores'::text) $$,
  'sair na etapa 4 e voltar reabre na etapa 4, no campo onde parou');
select is((select r -> 'respostas' -> 'A' ->> 'como_chegou' from t_p21 where chave = 'abrir2'), 'instagram',
  'ao voltar, as respostas já dadas estão lá');

-- idempotência: o mesmo item da fila offline nunca reaplica
insert into t_p21 select 'i1', testes.p21_coord(format(
  $f$ select api.prenatal_salvar_campo(%L, 'F', 'medos_e_receios', '"Medo de não dar conta"', null, null, null, %L) $f$,
  testes.p21_consulta(1), 'b2100000-0000-4000-8000-000000000001'));
insert into t_p21 select 'i2', testes.p21_coord(format(
  $f$ select api.prenatal_salvar_campo(%L, 'F', 'medos_e_receios', '"Outro texto qualquer"', null, null, null, %L) $f$,
  testes.p21_consulta(1), 'b2100000-0000-4000-8000-000000000001'));
select is((select (r ->> 'repetido')::boolean from t_p21 where chave = 'i2'), true,
  'reenviar o mesmo item da fila devolve o resultado guardado');
select is((select ficha -> 'F' ->> 'medos_e_receios' from consulta_prenatal where familia_id = testes.p21_id('c', 1)),
  'Medo de não dar conta', 'e não reaplica o valor');
select is((select (r ->> 'versao') from t_p21 where chave = 'i2'), (select (r ->> 'versao') from t_p21 where chave = 'i1'),
  'nem sobe a versão');
select is((select resultado::text like '%Medo%' from privado.sync_item where item_id = 'b2100000-0000-4000-8000-000000000001'), false,
  'o registro de idempotência guarda só a versão, nunca a resposta');

-- destinos do bloco H
select testes.p21_coord(format($f$ select api.prenatal_salvar_campo(%L, 'H', 'nome_do_obstetra', '"Dra. Teste Obstetra"') $f$, testes.p21_consulta(1)));
select is((select count(*)::integer from medico where familia_id = testes.p21_id('c', 1) and especialidade = 'obstetra'), 1,
  'nome do obstetra: nasce o médico em medico');
select testes.p21_coord(format($f$ select api.prenatal_salvar_campo(%L, 'H', 'telefone_do_obstetra', '"(11) 90000-0101"') $f$, testes.p21_consulta(1)));
select results_eq(
  $$ select nome, telefone_e164, origem_cadastro from medico
      where familia_id = testes.p21_id('c', 1) and especialidade = 'obstetra' $$,
  $$ values ('Dra. Teste Obstetra'::text, '+11900000101'::text, 'prenatal'::text) $$,
  'telefone do obstetra em E.164 e origem prenatal');
select testes.p21_coord(format($f$ select api.prenatal_salvar_campo(%L, 'H', 'nome_do_pediatra', '"Dr. Teste Pediatra"') $f$, testes.p21_consulta(1)));
select is((select count(*)::integer from medico where familia_id = testes.p21_id('c', 1)), 2,
  'obstetra e pediatra em medico');
select testes.p21_coord(format($f$ select api.prenatal_salvar_campo(%L, 'H', 'nome_do_pediatra', null) $f$, testes.p21_consulta(1)));
select is((select count(*)::integer from medico where familia_id = testes.p21_id('c', 1) and especialidade = 'pediatra'), 0,
  'apagar o nome do pediatra tira o médico (opcional aqui)');
select testes.p21_coord(format(
  $f$ select api.prenatal_salvar_campo(%L, 'H', 'recomendacoes_pedidos_especiais', '"Quer a visita sem barulho de manhã cedo."') $f$,
  testes.p21_consulta(1)));
select is((select plano_cuidado from consulta_prenatal where familia_id = testes.p21_id('c', 1)),
  'Quer a visita sem barulho de manhã cedo.', 'recomendações vão para o plano de cuidado');
select testes.p21_coord(format($f$ select api.prenatal_salvar_campo(%L, 'H', 'preferencia_de_periodo', '["tarde", "manha"]') $f$, testes.p21_consulta(1)));
select is((select periodo_preferido::text[] from consulta_prenatal where familia_id = testes.p21_id('c', 1)),
  array['tarde', 'manha'], 'preferência de período em ordem em consulta_prenatal.periodo_preferido');

-- o log de auditoria não copia o prontuário
select is((select valor_depois ->> 'ficha' from log_auditoria
            where entidade = 'consulta_prenatal' and entidade_id = testes.p21_consulta(1)::text and acao = 'update'
              and valor_depois ? 'ficha' order by id desc limit 1), '[oculto]',
  'o log de auditoria troca a ficha por [oculto]');
select is((select count(*)::integer from log_auditoria where entidade = 'consulta_prenatal'
            and (valor_depois::text like '%Dra. Teste Obstetra%' or valor_depois::text like '%instagram%')), 0,
  'nenhuma resposta da entrevista aparece em claro no log');

-- outra família: nasce em branco, sem nada da primeira
select is((testes.p21_coord($s$ select api.prenatal_abrir('c2100000-0000-4000-8000-000000000002') $s$) -> 'respostas'), '{}'::jsonb,
  'a entrevista de outra família nasce em branco: nada é copiado');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('api', 'privado', 'assistencial')
              and (p.proname like '%duplicar%' or p.proname like '%copiar%') and p.proname like '%prenatal%'), 0,
  'não existe função de duplicar entrevista');

-- concluir
select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.prenatal_concluir('c2100000-0000-4000-8000-0000000000ff') $s$,
  'P0001', 'operacao:sem_consulta ', 'concluir consulta que não existe');
select testes.encerrar();
select is((testes.p21_coord(format($f$ select api.prenatal_concluir(%L) $f$, testes.p21_consulta(1))) ->> 'estagio_p2'),
  'consulta_realizada', 'concluir leva o P2 a consulta_realizada');
select results_eq(
  $$ select status::text, realizada_em is not null from consulta_prenatal where familia_id = testes.p21_id('c', 1) $$,
  $$ values ('realizada'::text, true) $$, 'consulta realizada');
select is((select prioridade::text from tarefa where familia_id = testes.p21_id('c', 1) and tipo = 'designar_profissional'),
  'normal', 'sem titular, a tarefa designar_profissional nasce');
select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(format($f$ select api.prenatal_concluir(%L) $f$, testes.p21_consulta(1)),
  'P0001', 'operacao:consulta_ja_realizada ', 'concluir duas vezes');

-- alterar depois de concluída exige motivo e deixa histórico
select throws_ok(format($f$ select api.prenatal_salvar_campo(%L, 'A', 'como_chegou', '"presente"') $f$, testes.p21_consulta(1)),
  'P0001', 'operacao:motivo_obrigatorio ', 'alterar depois de concluída exige motivo');
select testes.encerrar();
select is((testes.p21_coord(format(
  $f$ select api.prenatal_salvar_campo(%L, 'A', 'como_chegou', '"presente"', null, null, 'Correção pedida pela família') $f$,
  testes.p21_consulta(1))) ->> 'ok')::boolean, true, 'com motivo, altera');
select results_eq(
  $$ select restrito, dados ->> 'campo' from evento_familia
      where familia_id = testes.p21_id('c', 1) and titulo like 'Entrevista pré-natal alterada%' $$,
  $$ values (true, 'como_chegou'::text) $$,
  'a alteração depois de concluída deixa evento restrito');

-- instrumento sem aprovação: a entrevista não abre
update instrumento set vigente = false, aprovado_em = null where codigo = 'DOC1_ENTREVISTA';
update consulta_prenatal set instrumento_versao = 'v1-2026-09' where familia_id = testes.p21_id('c', 2);
select testes.autenticar_authenticated('a2100000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.prenatal_abrir('c2100000-0000-4000-8000-000000000002') $s$,
  'P0001', 'operacao:instrumento_nao_aprovado ', 'sem versão aprovada do DOC 1, a entrevista não abre');
select testes.encerrar();
update instrumento set vigente = true where codigo = 'DOC1_ENTREVISTA' and versao = 'v1-2026-09';

-- versão nova aprovada depois: entrevista em branco muda de versão; respondida fica na sua
insert into instrumento (codigo, versao, definicao, vigente)
  select 'DOC1_ENTREVISTA', 'v2-teste', definicao, true from instrumento
   where codigo = 'DOC1_ENTREVISTA' and versao = 'v1-2026-09';
update instrumento set vigente = false where codigo = 'DOC1_ENTREVISTA' and versao = 'v1-2026-09';
insert into t_p21 select 'abrir_v2', testes.p21_coord($s$ select api.prenatal_abrir('c2100000-0000-4000-8000-000000000002') $s$);
select is((select r -> 'consulta' ->> 'instrumento_versao' from t_p21 where chave = 'abrir_v2'), 'v2-teste',
  'entrevista ainda em branco passa para a versão aprovada mais nova');
select is((select instrumento_versao from consulta_prenatal where familia_id = testes.p21_id('c', 1)), 'v1-2026-09',
  'aprovar versão nova não muda o registro antigo: continua apontando para a versão usada');
delete from instrumento where codigo = 'DOC1_ENTREVISTA' and versao = 'v2-teste';
update instrumento set vigente = true where codigo = 'DOC1_ENTREVISTA' and versao = 'v1-2026-09';
update consulta_prenatal set instrumento_versao = 'v1-2026-09' where familia_id = testes.p21_id('c', 2);

-- =============================================================================
-- 3. alerta_34s: só a coordenação, uma vez
-- =============================================================================

select is((privado.recalculo_alerta_34s() ->> 'notificadas')::integer >= 1, true, 'o alerta de 34 semanas roda');
select is((select count(*)::integer from notificacao where papel = 'coordenacao' and usuario_id is null
            and link = '/familias/' || testes.p21_id('c', 3)::text), 1,
  'família com 34 semanas: um aviso para a coordenação, com o link da ficha');
select is((select count(*)::integer from notificacao where link = '/familias/' || testes.p21_id('c', 4)::text), 0,
  '33 semanas: sem aviso');
select is((select count(*)::integer from notificacao where link = '/familias/c2100000-0000-4000-8000-000000000005'), 0,
  'lead que não contratou, mesmo com 36 semanas: sem aviso');
select is((select papel::text || '/' || coalesce(usuario_id::text, 'todos') from notificacao
            where link = '/familias/' || testes.p21_id('c', 3)::text), 'coordenacao/todos',
  'o aviso é da coordenação, nunca de outra pessoa nem da família');
select is((select count(*)::integer from mensagem m join conversa c on c.id = m.conversa_id
            where c.familia_id = testes.p21_id('c', 3)), 0, 'nada à família no alerta de 34 semanas (D-10)');
select is((select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 3)), 0,
  'o alerta é aviso interno: nenhuma tarefa de mensagem para a família');
select is((select executor::text || '/' || categoria::text from automacao where id = 'alerta_34s'), 'sistema/interna',
  'alerta_34s é automação interna do sistema');
select privado.recalculo_alerta_34s();
select is((select count(*)::integer from notificacao where link = '/familias/' || testes.p21_id('c', 3)::text), 1,
  'uma vez por família: rodar de novo não repete');
select is((select corpo like '%pré-natal ainda não foi feita%' and corpo like '%Falta a titular%' from notificacao
            where link = '/familias/' || testes.p21_id('c', 3)::text), true,
  'o aviso diz o que falta: consulta e titular');
delete from parametro where chave = 'prenatal_semanas_alerta';
select is(privado.recalculo_alerta_34s() ->> 'parametro_ausente', 'prenatal_semanas_alerta',
  'sem o parâmetro do limite, o alerta não dispara');
insert into parametro (chave, valor) values ('prenatal_semanas_alerta', '34');

-- =============================================================================
-- 4. Designação: oferta, resposta, recusa que aciona o backup, prazo, atribuição direta
-- =============================================================================

create function testes.p21_prof(n integer) returns uuid language sql immutable as $$
  select ('d2100000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function testes.p21_user(n integer) returns uuid language sql immutable as $$
  select ('a2100000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
create function testes.p21_desig(p_fam integer, p_papel text, p_prof integer default null) returns uuid
  language sql stable security definer set search_path = '' as $$
  select d.id
  from public.designacao d
  join public.acompanhamento a on a.id = d.acompanhamento_id
  where a.familia_id = testes.p21_id('c', p_fam) and d.papel = p_papel::public.papel_designacao
    and (p_prof is null or d.profissional_id = testes.p21_prof(p_prof))
  order by d.criado_em desc, d.id
  limit 1
$$;
create function testes.p21_oferecer(fam integer, prof integer, papel text) returns jsonb language sql as $$
  select testes.p21_coord(format($f$ select api.oferecer_designacao(%L, %L, %L) $f$,
                                 testes.p21_id('c', fam), testes.p21_prof(prof), papel))
$$;
create function testes.p21_responder(usr integer, desig uuid, aceita boolean, motivo text default null) returns jsonb
  language sql as $$
  select testes.p21_api(testes.p21_user(usr), format($f$ select api.responder_designacao(%L, %L::boolean, %L) $f$, desig, aceita::text, motivo))
$$;

do $$
begin
  perform testes.p21_familia(6,  'Família Teste Recusa Com Backup',  testes.p21_hoje() + 30, 'pagamento_confirmado');
  perform testes.p21_familia(7,  'Família Teste Recusa Backup Oferta', testes.p21_hoje() + 30, 'pagamento_confirmado');
  perform testes.p21_familia(8,  'Família Teste Recusa Sem Backup',  testes.p21_hoje() + 30, 'pagamento_confirmado');
  perform testes.p21_familia(9,  'Família Teste Prazo Vencido',      testes.p21_hoje() + 30, 'pagamento_confirmado');
  perform testes.p21_familia(10, 'Família Teste Responde Vencido',   testes.p21_hoje() + 30, 'pagamento_confirmado');
  perform testes.p21_familia(11, 'Família Teste Atribuição Direta',  testes.p21_hoje() + 10, 'pagamento_confirmado');
  -- os pagamentos abrem a consulta e o acompanhamento (gatilho)
  update cobranca set status = 'paga' where id in (select testes.p21_id('b', n) from generate_series(6, 11) n);
end $$;

-- papéis e AAL
select testes.autenticar_authenticated(testes.p21_user(3), 'aal2');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'titular') $f$, testes.p21_id('c', 6), testes.p21_prof(11)),
  '42501', null, 'comercial não oferece designação');
select testes.encerrar();
select testes.autenticar_authenticated(testes.p21_user(11), 'aal2');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'titular') $f$, testes.p21_id('c', 6), testes.p21_prof(11)),
  '42501', null, 'enfermeira não oferece designação a si mesma');
select throws_ok(format($f$ select api.atribuir_designacao(%L, %L, 'titular', 'urgência') $f$, testes.p21_id('c', 6), testes.p21_prof(11)),
  '42501', null, 'enfermeira não atribui direto');
select testes.encerrar();
select testes.autenticar_authenticated(testes.p21_user(1), 'aal1');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'titular') $f$, testes.p21_id('c', 6), testes.p21_prof(11)),
  '42501', null, 'coordenação em AAL1 não oferece');
select testes.encerrar();

-- a coordenação escreve só pelas funções: sem insert nem update direto
select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ insert into designacao (acompanhamento_id, profissional_id, papel, status)
                             values ((select id from acompanhamento where familia_id = %L), %L, 'titular', 'aceita') $f$,
                        testes.p21_id('c', 6), testes.p21_prof(11)),
  '42501', null, 'insert direto em designacao é negado, até para a coordenação');
select throws_ok(format($f$ update designacao set status = 'aceita' where id = %L $f$, testes.p21_id('c', 6)),
  '42501', null, 'update direto em designacao é negado, até para a coordenação');
select testes.encerrar();

-- F1: oferta de titular, backup, recusas de negócio
select is((testes.p21_oferecer(1, 11, 'titular') ->> 'ok')::boolean, true, 'oferta de titular');
select is((select prazo_resposta_em between now() + interval '23 hours' and now() + interval '25 hours'
             from designacao where id = testes.p21_desig(1, 'titular')), true,
  'o prazo de resposta é parametro.designacao_prazo_resposta_horas (24 h)');
select is((select count(*)::integer from notificacao where usuario_id = testes.p21_user(11) and link = '/ofertas'), 1,
  'a profissional recebe o aviso da oferta');
select is((select count(*)::integer from notificacao where usuario_id = testes.p21_user(11) and titulo like '%Família%'), 0,
  'o título do aviso não leva nome de família');
select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'titular') $f$, testes.p21_id('c', 1), testes.p21_prof(12)),
  'P0001', 'operacao:papel_ocupado oferecida', 'uma titular por vez');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'backup') $f$, testes.p21_id('c', 1), testes.p21_prof(11)),
  'P0001', 'operacao:mesma_profissional ', 'a mesma profissional não é titular e backup');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'backup') $f$, testes.p21_id('c', 1), testes.p21_prof(14)),
  'P0001', 'operacao:profissional_invalida ', 'profissional inativa não recebe oferta');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'backup') $f$, testes.p21_id('c', 1), testes.p21_prof(15)),
  'P0001', 'operacao:profissional_invalida ', 'a coordenação não entra como enfermeira da escala');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'backup') $f$, testes.p21_id('c', 5), testes.p21_prof(12)),
  'P0001', 'operacao:sem_contrato só se designa depois do pagamento', 'lead sem contrato não recebe designação');
select testes.encerrar();
select is((testes.p21_oferecer(1, 12, 'backup') ->> 'ok')::boolean, true, 'oferta de backup');

-- cada enfermeira vê só as próprias ofertas, sem dado da família além do necessário
create temp table t_o (chave text primary key, r jsonb) on commit drop;
grant all on t_o to public;
insert into t_o select 'ana', testes.p21_api(testes.p21_user(11), 'select api.minhas_ofertas()');
insert into t_o select 'bia', testes.p21_api(testes.p21_user(12), 'select api.minhas_ofertas()');
insert into t_o select 'carla', testes.p21_api(testes.p21_user(13), 'select api.minhas_ofertas()');
select is((select jsonb_array_length(r) from t_o where chave = 'ana'), 1, 'a enfermeira vê a própria oferta');
select is((select r -> 0 ->> 'papel' from t_o where chave = 'ana'), 'titular', 'a oferta diz o papel');
select is((select jsonb_array_length(r) from t_o where chave = 'carla'), 0, 'quem não tem oferta não vê a dos outros');
select is((select (r -> 0) ?| array['telefone', 'telefone_e164', 'endereco', 'endereco_atendimento', 'cpf', 'email']
             from t_o where chave = 'ana'), false,
  'a oferta não leva telefone, endereço, CPF nem e-mail');
select is((select r -> 0 ? 'prazo_resposta_em' and r -> 0 ? 'dpp' and r -> 0 ? 'dias' and r -> 0 ? 'bairro' from t_o where chave = 'ana'), true,
  'a oferta leva o que a enfermeira precisa para decidir: prazo, DPP, dias, bairro');
select testes.autenticar_authenticated(testes.p21_user(12), 'aal2');
select throws_ok(format($f$ select api.responder_designacao(%L, true) $f$, testes.p21_desig(1, 'titular')),
  'P0001', 'operacao:oferta_inexistente ', 'a oferta de outra pessoa não existe para quem pergunta');
select testes.encerrar();
select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ select api.responder_designacao(%L, true) $f$, testes.p21_desig(1, 'titular')),
  '42501', null, 'a coordenação não responde pela enfermeira');
select testes.encerrar();

-- antes do aceite a enfermeira não enxerga a família; depois, sim
select testes.autenticar_authenticated(testes.p21_user(11), 'aal2');
select is((select count(*)::integer from privado.familias_atribuidas() f where f = testes.p21_id('c', 1)), 0,
  'oferta não dá acesso à família');
select testes.encerrar();

-- aceite: a enfermeira não anda o P2 (papel), o cron anda
select is((testes.p21_responder(11, testes.p21_desig(1, 'titular'), true) ->> 'aceita')::boolean, true, 'a titular aceita');
select is((select status::text from designacao where id = testes.p21_desig(1, 'titular')), 'aceita', 'designação aceita');
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 1)), 'consulta_realizada',
  'a enfermeira que aceita não tem papel para andar o P2: ele espera o cron');
select is((select status::text from tarefa where familia_id = testes.p21_id('c', 1) and tipo = 'designar_profissional'), 'concluida',
  'titular aceita conclui a tarefa de designar');
select testes.autenticar_authenticated(testes.p21_user(11), 'aal2');
select is((select count(*)::integer from privado.familias_atribuidas() f where f = testes.p21_id('c', 1)), 1,
  'depois do aceite, a família é dela (privado.familias_atribuidas)');
select testes.encerrar();
select is((privado.processar_designacoes() ->> 'avancos')::integer >= 1, true, 'o cron processa as designações');
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 1)), 'aguardando_nascimento',
  'consulta realizada mais titular aceita: o P2 vai a aguardando_nascimento (passando por enfermeira_designada)');
select is((select count(*)::integer from evento_familia where familia_id = testes.p21_id('c', 1) and tipo = 'estagio'
            and dados ->> 'para' = 'enfermeira_designada'), 1, 'a passagem por enfermeira_designada está na linha do tempo');
select is((testes.p21_responder(12, testes.p21_desig(1, 'backup'), true) ->> 'aceita')::boolean, true, 'o backup aceita');
select throws_ok(format($f$ select 1 from testes.p21_responder(11, %L, true) $f$, testes.p21_desig(1, 'titular')),
  'P0001', 'operacao:oferta_ja_respondida aceita', 'responder duas vezes');

-- recusa da titular com backup que já aceitou: o backup assume, a coordenação é avisada
select testes.p21_oferecer(6, 11, 'titular');
select testes.p21_oferecer(6, 12, 'backup');
select testes.p21_responder(12, testes.p21_desig(6, 'backup'), true);
select throws_ok(format($f$ select 1 from testes.p21_responder(11, %L, false) $f$, testes.p21_desig(6, 'titular')),
  'P0001', 'operacao:motivo_obrigatorio ', 'recusar exige motivo');
select is((testes.p21_responder(11, testes.p21_desig(6, 'titular'), false, 'agenda') ->> 'desfecho'), 'backup_assumiu',
  'recusa da titular: o backup assume');
select results_eq(
  $$ select d.status::text, d.papel::text from designacao d join acompanhamento a on a.id = d.acompanhamento_id
      where a.familia_id = testes.p21_id('c', 6) and d.profissional_id = testes.p21_prof(12) $$,
  $$ values ('aceita'::text, 'titular'::text) $$, 'a backup que tinha aceitado passa a titular');
select is((select status::text from designacao d where d.profissional_id = testes.p21_prof(11)
             and d.acompanhamento_id = (select id from acompanhamento where familia_id = testes.p21_id('c', 6))), 'recusada',
  'a recusa fica registrada, com o motivo');
select is((select prioridade::text from notificacao where papel = 'coordenacao' and titulo = 'A titular recusou a oferta'
             and corpo like '%Recusa Com Backup%'), 'alta', 'a coordenação é avisada, com prioridade alta');
select is((select link from notificacao where papel = 'coordenacao' and titulo = 'A titular recusou a oferta'
             and corpo like '%Recusa Com Backup%'), '/radar/' || testes.p21_id('c', 6)::text,
  'o aviso leva ao radar da família');
select is((select count(*)::integer from notificacao where usuario_id = testes.p21_user(12)
             and titulo = 'Você passou a ser a titular de um acompanhamento'), 1, 'a nova titular é avisada');
select is((select titulo from tarefa where familia_id = testes.p21_id('c', 6) and tipo = 'designar_profissional'),
  'Designar um novo backup', 'e a coordenação ganha a tarefa de designar um novo backup');

-- recusa da titular com backup ainda em oferta: a oferta segue para ele
select testes.p21_oferecer(7, 11, 'titular');
select testes.p21_oferecer(7, 12, 'backup');
select is((testes.p21_responder(11, testes.p21_desig(7, 'titular'), false, 'distância') ->> 'desfecho'), 'oferta_passou_ao_backup',
  'recusa da titular com backup em oferta: a oferta segue para ele');
select results_eq(
  $$ select d.papel::text, d.status::text, d.prazo_resposta_em > now() + interval '20 hours'
       from designacao d join acompanhamento a on a.id = d.acompanhamento_id
      where a.familia_id = testes.p21_id('c', 7) and d.profissional_id = testes.p21_prof(12) $$,
  $$ values ('titular'::text, 'oferecida'::text, true) $$, 'o backup recebe a oferta como titular, com prazo novo');
select is((select count(*)::integer from notificacao where usuario_id = testes.p21_user(12)
             and titulo = 'Sua oferta agora é como titular'), 1, 'o backup é avisado da oferta nova');

-- recusa da titular sem backup
select testes.p21_oferecer(8, 11, 'titular');
select is((testes.p21_responder(11, testes.p21_desig(8, 'titular'), false, 'agenda') ->> 'desfecho'), 'sem_backup',
  'recusa da titular sem backup');
select results_eq(
  $$ select titulo, prioridade::text from tarefa where familia_id = testes.p21_id('c', 8) and tipo = 'designar_profissional' $$,
  $$ values ('Oferecer a outra enfermeira'::text, 'alta'::text) $$, 'vira a tarefa "Oferecer a outra enfermeira"');
select is((select count(*)::integer from notificacao where papel = 'coordenacao' and titulo = 'A titular recusou a oferta'
             and corpo like '%Recusa Sem Backup%não há backup%'), 1, 'a coordenação é avisada de que não há backup');

-- prazo vencido: vale como recusa
select testes.p21_oferecer(9, 13, 'titular');
update designacao set prazo_resposta_em = now() - interval '1 hour' where id = testes.p21_desig(9, 'titular');
select is((privado.processar_designacoes() ->> 'expiradas')::integer >= 1, true, 'o cron vence a oferta sem resposta');
select is((select status::text from designacao where id = testes.p21_desig(9, 'titular')), 'expirada', 'oferta expirada');
select is((select count(*)::integer from notificacao where papel = 'coordenacao'
             and titulo = 'O prazo de uma oferta venceu sem resposta' and corpo like '%Prazo Vencido%'), 1,
  'a coordenação é avisada do prazo vencido');
select is((select titulo from tarefa where familia_id = testes.p21_id('c', 9) and tipo = 'designar_profissional'),
  'Oferecer a outra enfermeira', 'e ganha a tarefa de oferecer a outra enfermeira');

-- responder depois do prazo
select testes.p21_oferecer(10, 13, 'titular');
update designacao set prazo_resposta_em = now() - interval '1 minute' where id = testes.p21_desig(10, 'titular');
select results_eq(
  $$ select r ->> 'ok', r ->> 'expirada' from (select testes.p21_responder(13, testes.p21_desig(10, 'titular'), true) as r) x $$,
  $$ values ('false'::text, 'true'::text) $$, 'responder depois do prazo: expirada, não aceita');
select is((select status::text from designacao where id = testes.p21_desig(10, 'titular')), 'expirada', 'fica expirada');

-- atribuição direta em urgência
select testes.p21_oferecer(11, 13, 'titular');
select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ select api.atribuir_designacao(%L, %L, 'titular', '  ') $f$, testes.p21_id('c', 11), testes.p21_prof(11)),
  'P0001', 'operacao:motivo_obrigatorio ', 'atribuição direta exige motivo');
select testes.encerrar();
select is((testes.p21_coord(format($f$ select api.atribuir_designacao(%L, %L, 'titular', 'Parto antecipado, ela mora perto') $f$,
                                   testes.p21_id('c', 11), testes.p21_prof(11))) ->> 'ok')::boolean, true, 'atribuição direta');
select results_eq(
  $$ select d.status::text, d.direta, d.motivo_direta is not null from designacao d where d.id = testes.p21_desig(11, 'titular', 11) $$,
  $$ values ('aceita'::text, true, true) $$, 'nasce aceita e marcada como direta, com motivo');
select is((select status::text from designacao where id = testes.p21_desig(11, 'titular', 13)), 'cancelada',
  'a oferta que ocupava o papel é cancelada');
select is((select count(*)::integer from notificacao where usuario_id = testes.p21_user(11)
             and titulo = 'Você foi designada como titular de um acompanhamento'), 1, 'a profissional é avisada');
select is((select valor_depois ->> 'motivo_direta' from log_auditoria where entidade = 'designacao'
            and entidade_id = testes.p21_desig(11, 'titular', 11)::text and acao = 'insert' order by id desc limit 1), '[oculto]',
  'o motivo da atribuição direta fica oculto no log (HMAC)');
select is((select count(*)::integer from log_auditoria where acao = 'designacao_atribuida'), 1, 'a atribuição direta grava log');

-- índices: uma titular e um backup ativos, a mesma pessoa nunca em dois papéis
select throws_ok(format($f$ insert into designacao (acompanhamento_id, profissional_id, papel, status)
                             values ((select id from acompanhamento where familia_id = %L), %L, 'titular', 'aceita') $f$,
                        testes.p21_id('c', 1), testes.p21_prof(13)),
  '23505', null, 'no banco, duas titulares ativas no mesmo acompanhamento são impossíveis');
select throws_ok(format($f$ insert into designacao (acompanhamento_id, profissional_id, papel, status)
                             values ((select id from acompanhamento where familia_id = %L), %L, 'backup', 'oferecida') $f$,
                        testes.p21_id('c', 1), testes.p21_prof(11)),
  '23505', null, 'no banco, a mesma profissional não fica em dois papéis ativos');

-- =============================================================================
-- 5. Nascimento e alta
-- =============================================================================

create function testes.p21_nascer(fam integer, dia date, bebes jsonb, previsao date default null) returns jsonb
  language sql as $$
  select testes.p21_coord(format($f$ select api.registrar_nascimento(%L, %L, %L::jsonb, %L) $f$,
                                 testes.p21_id('c', fam), dia, bebes::text, previsao))
$$;
create function testes.p21_alta(fam integer, dia date, primeira date default null, periodo text default null) returns jsonb
  language sql as $$
  select testes.p21_coord(format($f$ select api.registrar_alta(%L, %L, %L, %L) $f$,
                                 testes.p21_id('c', fam), dia, primeira, periodo))
$$;
create function testes.p21_visitas(fam integer) returns integer
  language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.visita v join public.acompanhamento a on a.id = v.acompanhamento_id
   where a.familia_id = testes.p21_id('c', fam)
$$;

-- recusas de negócio
select testes.autenticar_authenticated(testes.p21_user(3), 'aal2');
select throws_ok(format($f$ select api.registrar_nascimento(%L, current_date, '[{}]'::jsonb) $f$, testes.p21_id('c', 1)),
  '42501', null, 'comercial não registra nascimento');
select testes.encerrar();
select testes.autenticar_authenticated(testes.p21_user(11), 'aal2');
select throws_ok(format($f$ select api.registrar_alta(%L, current_date) $f$, testes.p21_id('c', 1)),
  '42501', null, 'enfermeira não registra alta');
select testes.encerrar();
select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ select api.registrar_nascimento(%L, %L, '[{}]'::jsonb) $f$, testes.p21_id('c', 1), testes.p21_hoje() + 1),
  'P0001', 'operacao:data_no_futuro nascimento é fato: não fica no futuro', 'nascimento no futuro é recusado');
select throws_ok(format($f$ select api.registrar_nascimento(%L, %L, '[{},{},{}]'::jsonb) $f$, testes.p21_id('c', 1), testes.p21_hoje()),
  'P0001', 'operacao:bebes_invalidos um bebê ou gêmeos', 'mais de dois bebês');
select throws_ok(format($f$ select api.registrar_nascimento(%L, %L, '[{"peso_nascimento_g": 0}]'::jsonb) $f$, testes.p21_id('c', 1), testes.p21_hoje()),
  'P0001', 'operacao:bebes_invalidos peso', 'peso zero');
select throws_ok(format($f$ select api.registrar_nascimento(%L, %L, '[{"tipo_parto": "fórceps"}]'::jsonb) $f$, testes.p21_id('c', 1), testes.p21_hoje()),
  'P0001', 'operacao:bebes_invalidos tipo_parto', 'tipo de parto fora do enum');
select throws_ok(format($f$ select api.registrar_nascimento(%L, %L, '[{}]'::jsonb) $f$, 'c2100000-0000-4000-8000-000000000005'::uuid, testes.p21_hoje()),
  'P0001', 'operacao:sem_contrato o nascimento de operação é registrado depois do pagamento', 'lead sem contrato');
select throws_ok(format($f$ select api.registrar_alta(%L, %L) $f$, testes.p21_id('c', 1), testes.p21_hoje()),
  'P0001', 'operacao:sem_nascimento registre o nascimento antes da alta', 'alta sem nascimento');
select testes.encerrar();

-- F1: o bebê nasceu; titular e backup já aceitas, pré-natal feito
select is((testes.p21_nascer(1, testes.p21_hoje() - 2,
  '[{"nome": "Bebê Teste Um", "sexo": "feminino", "peso_nascimento_g": 3200, "tipo_parto": "cesarea"}]') ->> 'estagio_p2'),
  'bebe_nasceu', 'nascimento leva o P2 a bebe_nasceu');
select results_eq(
  $$ select data_nascimento, data_alta, dpp from familia where id = testes.p21_id('c', 1) $$,
  $$ values (testes.p21_hoje() - 2, null::date, testes.p21_hoje() + 100) $$,
  'a data de nascimento é fato gravado; a DPP não muda e a alta ainda não existe');
select results_eq(
  $$ select nome, sexo, peso_nascimento_g, tipo_parto, data_nascimento from bebe where familia_id = testes.p21_id('c', 1) $$,
  $$ values ('Bebê Teste Um'::text, 'feminino'::text, 3200, 'cesarea'::text, testes.p21_hoje() - 2) $$,
  'o bebê nasce com nome, sexo, peso em gramas, tipo de parto e data');
select is((select count(*)::integer from notificacao where papel = 'coordenacao' and titulo = 'Um bebê nasceu'
             and link = '/radar/' || testes.p21_id('c', 1)::text), 1, 'a operação é avisada');
select is((select count(*)::integer from notificacao where usuario_id = testes.p21_user(11)
             and titulo = 'O bebê de uma das suas famílias nasceu'), 1, 'a titular é avisada, sem nome de família no título');
select results_eq(
  $$ select papel_responsavel::text, prioridade::text,
            payload ->> 'textoSugerido' like '%Bebê Teste Um%' and payload ->> 'textoSugerido' like '%Ana%'
       from tarefa where familia_id = testes.p21_id('c', 1) and payload ->> 'mensagemChave' = 'parabens_nascimento' $$,
  $$ values ('coordenacao'::text, 'alta'::text, true) $$,
  'a tarefa pede a previsão de alta, com o texto parabens_nascimento (nome do bebê e da enfermeira)');
select is((select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 1)
            and tipo in ('agendar_prenatal', 'designar_profissional') and status = 'aberta'), 0,
  'pré-natal feito e titular definida: nada ficou para trás');
select is((select count(*)::integer from mensagem m join conversa c on c.id = m.conversa_id where c.familia_id = testes.p21_id('c', 1)), 0,
  'a mensagem à família é tarefa de uma pessoa: nada saiu sozinho');
-- de novo, mesma data: seguro
select is((testes.p21_nascer(1, testes.p21_hoje() - 2, '[{"nome": "Bebê Teste Um"}]') ->> 'ok')::boolean, true,
  'registrar o mesmo nascimento de novo é seguro');
select is((select count(*)::integer from notificacao where papel = 'coordenacao' and titulo = 'Um bebê nasceu'
             and link = '/radar/' || testes.p21_id('c', 1)::text), 1, 'e não repete o aviso');
select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ select api.registrar_nascimento(%L, %L, '[{}]'::jsonb) $f$, testes.p21_id('c', 1), testes.p21_hoje() - 1),
  'P0001', 'operacao:nascimento_ja_registrado ', 'outra data para o mesmo nascimento é recusada');

-- previsão de alta (estimativa) e alta (fato)
select throws_ok(format($f$ select api.registrar_previsao_alta(%L, %L) $f$, testes.p21_id('c', 1), testes.p21_hoje() - 3),
  'P0001', 'operacao:previsao_antes_do_nascimento ', 'previsão antes do nascimento');
select testes.encerrar();
select is((testes.p21_coord(format($f$ select api.registrar_previsao_alta(%L, %L) $f$, testes.p21_id('c', 1), testes.p21_hoje() + 1)) ->> 'ok')::boolean,
  true, 'previsão de alta');
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 1)), 'aguardando_alta',
  'previsão de alta leva o P2 a aguardando_alta');
select results_eq(
  $$ select previsao_alta, (select data_alta from familia where id = testes.p21_id('c', 1)) from acompanhamento
      where familia_id = testes.p21_id('c', 1) $$,
  $$ values (testes.p21_hoje() + 1, null::date) $$, 'a previsão fica no acompanhamento; data_alta continua vazia (é fato)');
select is((select status::text from tarefa where familia_id = testes.p21_id('c', 1) and payload ->> 'mensagemChave' = 'parabens_nascimento'),
  'concluida', 'a tarefa que pedia a previsão é concluída');

select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ select api.registrar_alta(%L, %L) $f$, testes.p21_id('c', 1), testes.p21_hoje() + 1),
  'P0001', 'operacao:data_no_futuro alta é fato: não fica no futuro', 'alta no futuro');
select throws_ok(format($f$ select api.registrar_alta(%L, %L) $f$, testes.p21_id('c', 1), testes.p21_hoje() - 3),
  'P0001', 'operacao:alta_antes_do_nascimento ', 'alta antes do nascimento');
select throws_ok(format($f$ select api.registrar_alta(%L, %L, null, 'noite_avaliar') $f$, testes.p21_id('c', 1), testes.p21_hoje()),
  'P0001', 'operacao:periodo_invalido visita só de manhã ou à tarde', 'visita só de manhã ou à tarde');
select throws_ok(format($f$ select api.registrar_alta(%L, %L, %L) $f$, testes.p21_id('c', 1), testes.p21_hoje(), testes.p21_hoje() - 1),
  'P0001', 'operacao:primeira_visita_antes_da_alta ', 'D1 antes da alta');
select testes.encerrar();

select is((testes.p21_alta(1, testes.p21_hoje(), null, 'manha') ->> 'visitas')::integer, 6, 'a alta gera as visitas: seis');
select results_eq(
  $$ select v.dia_numero, v.data, v.profissional_id, v.hora_prevista, v.estado::text
       from visita v join acompanhamento a on a.id = v.acompanhamento_id
      where a.familia_id = testes.p21_id('c', 1) order by v.dia_numero $$,
  $$ select n, testes.p21_hoje() + 1 + (n - 1), testes.p21_prof(11), time '09:00', 'agendada'::text from generate_series(1, 6) n $$,
  'D1 a D6 em dias corridos a partir do dia seguinte à alta, com a titular, às 9h e agendadas');
select results_eq(
  $$ select a.periodo::text, a.estado::text, a.inicio_efetivo from acompanhamento a where a.familia_id = testes.p21_id('c', 1) $$,
  $$ values ('manha'::text, 'ativo'::text, testes.p21_hoje() + 1) $$,
  'o acompanhamento fica ativo, no período combinado, com o D1');
select results_eq(
  $$ select data_alta, data_inicio_efetivo, data_nascimento from familia where id = testes.p21_id('c', 1) $$,
  $$ values (testes.p21_hoje(), testes.p21_hoje() + 1, testes.p21_hoje() - 2) $$,
  'as três datas de fato ficam separadas: nascimento, alta e o D1 (a DPP continua só estimativa)');
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 1)), 'atendimento_liberado',
  'a alta leva o P2 a atendimento_liberado');
select results_eq(
  $$ select papel_responsavel::text, prioridade::text,
            payload ->> 'textoSugerido' like '%Ana%' and payload ->> 'textoSugerido' like '%09:00%' and payload ->> 'textoSugerido' like '%chega%'
       from tarefa where familia_id = testes.p21_id('c', 1) and tipo = 'enviar_guia' $$,
  $$ values ('coordenacao'::text, 'alta'::text, true) $$,
  'tarefa do guia, com o texto alta_boas_vindas (enfermeira, dia e hora)');
select is((select count(*)::integer from notificacao where usuario_id = testes.p21_user(11)
             and titulo = 'Um acompanhamento seu foi liberado'), 1, 'a profissional é avisada da alta');
select is((testes.p21_alta(1, testes.p21_hoje(), null, 'manha') ->> 'visitas')::integer, 6, 'repetir a mesma alta é seguro');
select is(testes.p21_visitas(1), 6, 'e não duplica visita');
select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ select api.registrar_alta(%L, %L) $f$, testes.p21_id('c', 1), testes.p21_hoje() - 1),
  'P0001', 'operacao:alta_ja_registrada ', 'outra data de alta é recusada');
select testes.encerrar();

-- doze visitas no mesmo período
do $$
begin
  perform testes.p21_familia(16, 'Família Teste Doze Dias', testes.p21_hoje() - 3, 'pagamento_confirmado', 12);
  update cobranca set status = 'paga' where id = testes.p21_id('b', 16);
end $$;
select testes.p21_coord(format($f$ select api.atribuir_designacao(%L, %L, 'titular', 'Escala fechada por telefone') $f$,
                               testes.p21_id('c', 16), testes.p21_prof(12)));
select testes.p21_nascer(16, testes.p21_hoje() - 3, '[{"nome": "Bebê Teste Doze"}]');
select is((testes.p21_alta(16, testes.p21_hoje() - 1, testes.p21_hoje(), 'tarde') ->> 'visitas')::integer, 12,
  'plano de 12 dias: doze visitas');
select results_eq(
  $$ select count(*)::integer, min(v.data), max(v.data), count(distinct v.hora_prevista)::integer, min(v.hora_prevista)
       from visita v join acompanhamento a on a.id = v.acompanhamento_id where a.familia_id = testes.p21_id('c', 16) $$,
  $$ values (12, testes.p21_hoje(), testes.p21_hoje() + 11, 1, time '14:00') $$,
  'D1 a D12 em dias corridos, sempre no mesmo período (tarde, 14h)');
select is((select a.periodo::text from acompanhamento a where a.familia_id = testes.p21_id('c', 16)), 'tarde',
  'o período do acompanhamento vale do D1 ao último dia');

-- nascimento antes do pré-natal e sem titular: o que ficou para trás vira tarefa
do $$
begin
  perform testes.p21_familia(13, 'Família Teste Nasceu Cedo', testes.p21_hoje() + 100, 'pagamento_confirmado');
  update cobranca set status = 'paga' where id = testes.p21_id('b', 13);
end $$;
select is((select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 13) and tipo = 'agendar_prenatal' and prioridade = 'normal'), 1,
  'antes do parto: a tarefa de agendar o pré-natal está normal');
select is((testes.p21_nascer(13, testes.p21_hoje() - 1, '[{}]') ->> 'estagio_p2'), 'bebe_nasceu',
  'o parto pode chegar de qualquer estágio depois do pagamento (direto para bebe_nasceu)');
select results_eq(
  $$ select urgente from consulta_prenatal where familia_id = testes.p21_id('c', 13) $$,
  $$ values (true) $$, 'a consulta pré-natal não realizada fica urgente');
select results_eq(
  $$ select tipo::text, prioridade::text from tarefa
      where familia_id = testes.p21_id('c', 13) and tipo in ('agendar_prenatal', 'designar_profissional') and status = 'aberta' order by tipo $$,
  $$ values ('agendar_prenatal'::text, 'maxima'::text), ('designar_profissional', 'maxima') $$,
  'pré-natal não realizado e designação urgente: tarefas de prioridade máxima');
select is((select a.previsao_alta is null from acompanhamento a where a.familia_id = testes.p21_id('c', 13)), true,
  'sem previsão de alta ainda');

-- gêmeos
do $$
begin
  perform testes.p21_familia(14, 'Família Teste Gemelar', testes.p21_hoje() + 5, 'aguardando_nascimento');
end $$;
select is((testes.p21_nascer(14, testes.p21_hoje(), '[{"nome": "Um", "sexo": "masculino"}, {"nome": "Dois", "sexo": "feminino"}]', testes.p21_hoje() + 3) ->> 'estagio_p2'),
  'aguardando_alta', 'gêmeos com previsão de alta: o P2 vai a aguardando_alta');
select results_eq(
  $$ select ordem, nome from bebe where familia_id = testes.p21_id('c', 14) order by ordem $$,
  $$ values (1, 'Um'::text), (2, 'Dois') $$, 'um bebê por ordem: tudo que é do bebê referencia bebe_id');
select is((select gemelar from familia where id = testes.p21_id('c', 14)), true, 'a família passa a gemelar');
select is((select payload ->> 'textoSugerido' like '%Um e Dois%' from tarefa
             where familia_id = testes.p21_id('c', 14) and payload ->> 'mensagemChave' = 'parabens_nascimento'), true,
  'o texto cita os dois bebês');

-- a data que chega pela ficha (P16) também dispara a automação, como sistema
do $$
begin
  perform testes.p21_familia(15, 'Família Teste Data Da Ficha', testes.p21_hoje() + 2, 'aguardando_nascimento');
end $$;
update familia set data_nascimento = testes.p21_hoje() - 1 where id = testes.p21_id('c', 15);
select is((select count(*)::integer from privado.fato_operacao where familia_id = testes.p21_id('c', 15) and tipo = 'nascimento' and processado_em is null), 1,
  'a data preenchida pela ficha entra na fila');
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 15)), 'aguardando_nascimento',
  'enquanto o cron não roda, o P2 não anda');
select privado.processar_designacoes();
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 15)), 'bebe_nasceu',
  'o cron processa como sistema (transição automática) e leva o P2 a bebe_nasceu');
select is((select count(*)::integer from privado.fato_operacao where familia_id = testes.p21_id('c', 15) and processado_em is null), 0,
  'o fato sai da fila');
update familia set data_nascimento = testes.p21_hoje() - 1 where id = 'c2100000-0000-4000-8000-000000000005';
select privado.processar_designacoes();
select is((select estagio_p1::text || '/' || coalesce(estagio_p2::text, 'sem p2') from oportunidade
             where familia_id = 'c2100000-0000-4000-8000-000000000005'), 'qualificado/sem p2',
  'lead que ainda não contratou: o nascimento é fato de venda e não move a operação');

-- alta sem titular: a designação urgente
do $$
begin
  perform testes.p21_familia(17, 'Família Teste Alta Sem Titular', testes.p21_hoje() - 4, 'pagamento_confirmado');
  update cobranca set status = 'paga' where id = testes.p21_id('b', 17);
end $$;
select testes.p21_nascer(17, testes.p21_hoje() - 3, '[{}]');
select is((testes.p21_alta(17, testes.p21_hoje() - 1, null, 'manha') ->> 'visitas')::integer, 0,
  'alta sem titular: nenhuma visita ainda');
select results_eq(
  $$ select prioridade::text from tarefa where familia_id = testes.p21_id('c', 17) and tipo = 'designar_profissional' and status = 'aberta' $$,
  $$ values ('maxima'::text) $$,
  'alta sem titular: uma tarefa de designação urgente (a do nascimento, sem duplicar), em vez de espera em silêncio');
select testes.p21_coord(format($f$ select api.atribuir_designacao(%L, %L, 'titular', 'Alta já registrada, cobrir hoje') $f$,
                               testes.p21_id('c', 17), testes.p21_prof(13)));
select is(testes.p21_visitas(17), 6, 'quando a titular chega depois da alta, as seis visitas saem na hora');
select is((select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 17) and tipo = 'enviar_guia'), 1,
  'e a tarefa do guia');

-- alta sem período: a tarefa certa
do $$
begin
  perform testes.p21_familia(18, 'Família Teste Alta Sem Periodo', testes.p21_hoje() - 4, 'pagamento_confirmado');
  update cobranca set status = 'paga' where id = testes.p21_id('b', 18);
end $$;
select testes.p21_coord(format($f$ select api.atribuir_designacao(%L, %L, 'titular', 'Escala combinada') $f$,
                               testes.p21_id('c', 18), testes.p21_prof(13)));
select testes.p21_nascer(18, testes.p21_hoje() - 3, '[{}]');
select is((testes.p21_alta(18, testes.p21_hoje() - 1) ->> 'visitas')::integer, 0, 'alta sem período e sem preferência: nenhuma visita');
select is((select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 18) and tipo = 'outro'
             and titulo = 'A alta foi registrada: definir o período e o primeiro dia das visitas'), 1,
  'a tarefa pede o período');
select is((testes.p21_alta(18, testes.p21_hoje() - 1, null, 'tarde') ->> 'visitas')::integer, 6,
  'com o período informado, as visitas saem');

-- sobrecarga: no máximo 2 por dia por profissional (aviso, não trava)
do $$
begin
  perform testes.p21_familia(19, 'Família Teste Sobrecarga', testes.p21_hoje() - 4, 'pagamento_confirmado');
  update cobranca set status = 'paga' where id = testes.p21_id('b', 19);
end $$;
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, estado)
  select a.id, testes.p21_prof(12), 20 + n, testes.p21_hoje(), 'agendada'
    from acompanhamento a, generate_series(1, 2) n where a.familia_id = testes.p21_id('c', 16);
select testes.p21_coord(format($f$ select api.atribuir_designacao(%L, %L, 'titular', 'Mais ninguém na região') $f$,
                               testes.p21_id('c', 19), testes.p21_prof(12)));
select testes.p21_nascer(19, testes.p21_hoje() - 3, '[{}]');
select is((testes.p21_alta(19, testes.p21_hoje() - 1, testes.p21_hoje(), 'manha') ->> 'visitas')::integer, 6,
  'com a agenda cheia, as visitas saem mesmo assim');
select is((select count(*)::integer from notificacao where papel = 'coordenacao'
             and titulo = 'A agenda de uma titular passa do limite de visitas por dia' and corpo like '%Sobrecarga%'), 1,
  'e a coordenação é avisada do dia que passa de 2 visitas');

-- freio: família em estado sensível não recebe visita automática (automação operacional)
do $$
begin
  perform testes.p21_familia(20, 'Família Teste Freio Na Alta', testes.p21_hoje() - 4, 'pagamento_confirmado', 6, 'encerrado_sensivel');
  update cobranca set status = 'paga' where id = testes.p21_id('b', 20);
end $$;
select testes.autenticar_authenticated(testes.p21_user(1), 'aal2');
select throws_ok(format($f$ select api.oferecer_designacao(%L, %L, 'titular') $f$, testes.p21_id('c', 20), testes.p21_prof(13)),
  'P0001', 'operacao:familia_em_estado_sensivel ', 'não se oferece designação a família em estado sensível');
select testes.encerrar();
insert into designacao (acompanhamento_id, profissional_id, papel, status, respondida_em)
  select a.id, testes.p21_prof(13), 'titular', 'aceita', now() from acompanhamento a where a.familia_id = testes.p21_id('c', 20);
select testes.p21_nascer(20, testes.p21_hoje() - 3, '[{}]');
select is((testes.p21_alta(20, testes.p21_hoje() - 1, null, 'manha') ->> 'visitas')::integer, 0,
  'estado sensível: o freio barra a geração automática das visitas');
select is((select count(*)::integer >= 1 from automacao_execucao where automacao_id = 'alta'
             and familia_id = testes.p21_id('c', 20) and status = 'abortada_freio'), true,
  'o aborto pelo freio fica registrado');
select is((select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 20) and tipo = 'enviar_guia'), 0,
  'e nenhuma tarefa de mensagem nasce');
select is((select estagio_p2::text from oportunidade where id = testes.p21_id('e', 20)), 'atendimento_liberado',
  'o fato (alta) continua registrado e o P2 anda: o freio barra a automação, não o fato');

-- =============================================================================
-- 6. Alertas de DPP e radar de nascimentos (a DPP nunca move nada)
-- =============================================================================

do $$
begin
  -- dentro da janela, com titular e backup aceitas
  perform testes.p21_familia(22, 'Família Teste Radar Na Janela', testes.p21_hoje() + 5, 'aguardando_nascimento');
  -- DPP passou há 4 dias
  perform testes.p21_familia(23, 'Família Teste Passou Quatro Dias', testes.p21_hoje() - 4, 'aguardando_nascimento');
  -- DPP passou há 11 dias, sem contato, com titular
  perform testes.p21_familia(24, 'Família Teste Sem Contato', testes.p21_hoje() - 11, 'aguardando_nascimento');
  -- DPP passou há 11 dias, mas a família escreveu depois
  perform testes.p21_familia(25, 'Família Teste Escreveu Depois', testes.p21_hoje() - 11, 'aguardando_nascimento');
  -- DPP em 3 dias, mas em bloqueio total
  perform testes.p21_familia(26, 'Família Teste Bloqueio Total', testes.p21_hoje() + 3, 'aguardando_nascimento', 6, 'bloqueio_total');
end $$;

insert into acompanhamento (contrato_id, familia_id, dias_contratados, horas_por_visita, estado)
  select testes.p21_id('f', n), testes.p21_id('c', n), 6, 3, 'aguardando' from unnest(array[22, 23, 24, 25, 26]) n;
insert into designacao (acompanhamento_id, profissional_id, papel, status, respondida_em)
  select a.id, testes.p21_prof(case a.familia_id when testes.p21_id('c', 22) then 11 else 13 end), 'titular', 'aceita', now()
    from acompanhamento a where a.familia_id in (testes.p21_id('c', 22), testes.p21_id('c', 24));
insert into designacao (acompanhamento_id, profissional_id, papel, status, respondida_em)
  select a.id, testes.p21_prof(12), 'backup', 'aceita', now() from acompanhamento a where a.familia_id = testes.p21_id('c', 22);
-- a família 25 escreveu ontem
insert into conversa (id, wa_jid, telefone_e164, familia_id, classificacao, iniciada_por) values
  ('f2100000-0000-4000-8000-000000000025', '5511900020025@s.whatsapp.net', '+5511900020025',
   testes.p21_id('c', 25), 'cliente', 'cliente');
insert into mensagem (conversa_id, direcao, enviado_por, tipo, conteudo, enviada_em) values
  ('f2100000-0000-4000-8000-000000000025', 'entrada', 'cliente', 'texto', 'Oi, ainda nada do bebê.', now() - interval '1 day');

create temp table t_e (chave text primary key, n integer) on commit drop;
grant all on t_e to public;
insert into t_e values
  ('estagios', (select count(*)::integer from oportunidade where familia_id in (select testes.p21_id('c', n) from generate_series(22, 26) n)
                                                             and estagio_p2 = 'aguardando_nascimento')),
  ('visitas', (select count(*)::integer from visita v join acompanhamento a on a.id = v.acompanhamento_id
                where a.familia_id in (select testes.p21_id('c', n) from generate_series(22, 26) n)));

select privado.recalculo_alertas_dpp();

select results_eq(
  $$ select tipo::text, papel_responsavel::text, origem_automacao_id, payload ->> 'textoSugerido' like '%A data prevista está chegando%'
       from tarefa where familia_id = testes.p21_id('c', 22) and tipo = 'checkin_dpp' $$,
  $$ values ('checkin_dpp'::text, 'coordenacao'::text, 'checkin_dpp'::text, true) $$,
  'DPP menos 7 dias: tarefa de check-in com o texto de 23.2, para uma pessoa enviar');
select is((select payload -> 'confirmar' from tarefa where familia_id = testes.p21_id('c', 22) and tipo = 'checkin_dpp'),
  '["alocacao", "backup"]'::jsonb, 'o check-in pede para confirmar a alocação e o backup');
select is((select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 4) and tipo = 'checkin_dpp'), 0,
  'ainda longe da DPP: sem check-in');
select results_eq(
  $$ select payload ? 'textoSugerido', payload ->> 'estado_sensivel', payload ? 'sem_texto'
       from tarefa where familia_id = testes.p21_id('c', 26) and tipo = 'checkin_dpp' $$,
  $$ values (false, 'bloqueio_total'::text, true) $$,
  'bloqueio total: a tarefa interna nasce sem o texto e com o estado sensível à vista');
select is((select count(*)::integer from notificacao where papel = 'coordenacao' and prioridade = 'alta'
             and titulo = 'A data provável do parto passou e o nascimento não foi confirmado'
             and link = '/radar/' || testes.p21_id('c', 23)::text), 1,
  'DPP mais 3 dias: aviso alto para a coordenação');
select is((select count(*)::integer from notificacao where link = '/radar/' || testes.p21_id('c', 22)::text
             and titulo like 'A data provável%'), 0, 'antes dos 3 dias: sem aviso');
select results_eq(
  $$ select tipo::text, prioridade::text, responsavel_id, status::text from ocorrencia where familia_id = testes.p21_id('c', 24) $$,
  $$ values ('contato_perdido'::text, 'alta'::text, testes.p21_user(13), 'responsavel_definido'::text) $$,
  'DPP mais 10 dias sem contato: ocorrência contato_perdido, com a titular como responsável');
select is((select count(*)::integer from ocorrencia where familia_id = testes.p21_id('c', 25)), 0,
  'a família que escreveu depois da DPP não vira ocorrência');
select is((select count(*)::integer from ocorrencia where familia_id = testes.p21_id('c', 23)), 0,
  'DPP mais 4 dias: ainda não é ocorrência');
select is((select count(*)::integer from automacao where id in ('checkin_dpp', 'dpp_sem_confirmacao', 'dpp_sem_contato')
            and categoria = 'interna'), 3, 'as três automações da DPP são internas: só preparam a equipe');
select privado.recalculo_alertas_dpp();
select results_eq(
  $$ select (select count(*)::integer from tarefa where familia_id = testes.p21_id('c', 22) and tipo = 'checkin_dpp'),
            (select count(*)::integer from ocorrencia where familia_id = testes.p21_id('c', 24)) $$,
  $$ values (1, 1) $$, 'rodar de novo não repete tarefa nem ocorrência');
select is((select count(*)::integer from oportunidade where familia_id in (select testes.p21_id('c', n) from generate_series(22, 26) n)
                                                          and estagio_p2 = 'aguardando_nascimento'),
  (select n from t_e where chave = 'estagios'), 'a DPP não moveu nenhum estágio');
select is((select count(*)::integer from familia where id in (select testes.p21_id('c', n) from generate_series(22, 26) n)
                                                     and (data_nascimento is not null or data_alta is not null)), 0,
  'a DPP não preencheu nascimento nem alta');
select is((select count(*)::integer from visita v join acompanhamento a on a.id = v.acompanhamento_id
            where a.familia_id in (select testes.p21_id('c', n) from generate_series(22, 26) n)),
  (select n from t_e where chave = 'visitas'), 'a DPP não gerou visita');
select is((select count(*)::integer from mensagem m join conversa c on c.id = m.conversa_id
            where c.familia_id in (select testes.p21_id('c', n) from generate_series(22, 26) n) and m.direcao = 'saida'), 0,
  'e nenhuma mensagem saiu para a família');
select is((select count(*)::integer from privado.fato_operacao where familia_id in (select testes.p21_id('c', n) from generate_series(22, 26) n)), 0,
  'a DPP nunca entra na fila de fatos');

-- o recálculo diário chama a etapa
insert into t_p21 select 'diario', privado.recalculo_diario();
select is((select e.status::text from privado.recalculo_etapa e
            where e.execucao_id = (select (r ->> 'execucao_id')::bigint from t_p21 where chave = 'diario') and e.etapa = 'alertas_dpp'), 'ok',
  'o recálculo diário roda a etapa alertas_dpp');

-- radar
select testes.autenticar_authenticated(testes.p21_user(3), 'aal2');
select throws_ok($s$ select api.radar_nascimentos() $s$, '42501', null, 'comercial não vê o radar');
select testes.encerrar();
select testes.autenticar_authenticated(testes.p21_user(11), 'aal2');
select throws_ok($s$ select api.radar_nascimentos() $s$, '42501', null, 'enfermeira não vê o radar');
select testes.encerrar();
select testes.autenticar_authenticated(testes.p21_user(1), 'aal1');
select throws_ok($s$ select api.radar_nascimentos() $s$, '42501', null, 'coordenação em AAL1 não vê o radar');
select testes.encerrar();

insert into t_p21 select 'radar', testes.p21_coord('select api.radar_nascimentos()');
select is((select r -> 'familias' @> jsonb_build_array(jsonb_build_object('familia_id', testes.p21_id('c', 22))) from t_p21 where chave = 'radar'), true,
  'o radar mostra a família dentro da janela');
select results_eq(
  $$ select (e ->> 'na_janela')::boolean, (e ->> 'passou_da_janela')::boolean, e -> 'titular' ->> 'nome', e -> 'backup' ->> 'nome',
            (e ->> 'checkin_pendente')::boolean, (e ->> 'sem_contato')::boolean, e ->> 'ig'
       from t_p21, jsonb_array_elements(r -> 'familias') e where chave = 'radar' and e ->> 'familia_id' = testes.p21_id('c', 22)::text $$,
  $$ select true, false, 'Ana Teste Enfermeira'::text, 'Bia Teste Enfermeira'::text, true, true,
            (select ig.texto from ig(testes.p21_hoje() + 5, testes.p21_hoje()) ig) $$,
  'linha do radar: na janela, titular e backup, check-in pendente, sem contato, IG calculada');
select results_eq(
  $$ select (e ->> 'passou_da_janela')::boolean, (e ->> 'dpp_sem_confirmacao')::boolean, (e ->> 'dpp_sem_contato')::boolean
       from t_p21, jsonb_array_elements(r -> 'familias') e where chave = 'radar' and e ->> 'familia_id' = testes.p21_id('c', 24)::text $$,
  $$ values (false, true, true) $$, 'DPP mais 11 dias: alertas de confirmação e de contato no radar');
select is((select (e ->> 'passou_da_janela')::boolean from t_p21, jsonb_array_elements(r -> 'familias') e
            where chave = 'radar' and e ->> 'familia_id' = testes.p21_id('c', 12)::text), true,
  'DPP mais de 14 dias sem nascimento: passou da janela, continua no radar');
select is((select (e ->> 'sem_contato')::boolean from t_p21, jsonb_array_elements(r -> 'familias') e
            where chave = 'radar' and e ->> 'familia_id' = testes.p21_id('c', 25)::text), false,
  'quem escreveu ontem não está sem contato');
select is((select r -> 'familias' @> jsonb_build_array(jsonb_build_object('familia_id', 'c2100000-0000-4000-8000-000000000005')) from t_p21 where chave = 'radar'), false,
  'lead que não contratou não está no radar');
select is((select r -> 'familias' @> jsonb_build_array(jsonb_build_object('familia_id', testes.p21_id('c', 1))) from t_p21 where chave = 'radar'), false,
  'quem já nasceu sai da lista da janela');
select is((select r -> 'nasceram' @> jsonb_build_array(jsonb_build_object('familia_id', testes.p21_id('c', 13))) from t_p21 where chave = 'radar'), true,
  'quem nasceu e espera a alta aparece à parte');
select is((select r -> 'janela' from t_p21 where chave = 'radar'), '{"antes": 21, "depois": 14}'::jsonb,
  'a janela vem de parametro.janela_dpp_dias');
select is((select jsonb_typeof(r -> 'ocupacao') from t_p21 where chave = 'radar'), 'array', 'e a ocupação por praça acompanha');
select is((testes.p21_coord(format($f$ select api.radar_nascimentos(%L) $f$, 'aaaaaaaa-0000-4000-8000-000000000000'))
             -> 'familias'), '[]'::jsonb, 'o filtro por praça recorta o radar');

-- a tela Designar de uma família
insert into t_p21 select 'aloc', testes.p21_coord(format($f$ select api.alocacao_familia(%L) $f$, testes.p21_id('c', 22)));
select is((select jsonb_array_length(r -> 'designacoes') from t_p21 where chave = 'aloc'), 2, 'a tela Designar mostra titular e backup');
select results_eq(
  $$ select bool_and(c ->> 'nome' <> 'Dora Teste Inativa' and c ->> 'nome' <> 'Beatriz Teste Coordenação'),
            count(*) filter (where c ->> 'nome' in ('Ana Teste Enfermeira', 'Bia Teste Enfermeira', 'Carla Teste Enfermeira'))::integer
       from t_p21, jsonb_array_elements(r -> 'candidatas') c where chave = 'aloc' $$,
  $$ values (true, 3) $$,
  'candidatas: as enfermeiras ativas (a inativa e a coordenação ficam de fora)');
insert into t_p21 select 'aloc1', testes.p21_coord(format($f$ select api.alocacao_familia(%L) $f$, testes.p21_id('c', 1)));
select results_eq(
  $$ select jsonb_array_length(r -> 'acompanhamento' -> 'lista_visitas'), r -> 'acompanhamento' -> 'lista_visitas' -> 0 ->> 'data',
            r -> 'acompanhamento' -> 'lista_visitas' -> 5 ->> 'profissional'
       from t_p21 where chave = 'aloc1' $$,
  $$ select 6, (testes.p21_hoje() + 1)::text, 'Ana Teste Enfermeira'::text $$,
  'a tela de alocação mostra as seis visitas geradas, com data e profissional');
select is((select r -> 'tarefas' -> 0 ->> 'tipo' from t_p21 where chave = 'aloc'), 'checkin_dpp',
  'a tela Designar mostra o que a operação ainda precisa fazer (aqui, o check-in de DPP)');
select is((select (r -> 'familia' ->> 'janela_inicio')::date from t_p21 where chave = 'aloc'), testes.p21_hoje() + 5 - 21,
  'a janela da DPP acompanha, só para escolher a candidata');
select is((select count(*)::integer from log_auditoria where acao = 'leitura' and entidade = 'consulta_prenatal'
             and entidade_id = testes.p21_id('c', 22)::text), 1,
  'ler o período preferido da entrevista deixa a leitura no log');

-- =============================================================================
-- 7. Privilégios
-- =============================================================================

select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'api' and p.proname in (
              'prenatal_consultas', 'prenatal_estado', 'agendar_consulta_prenatal', 'prenatal_abrir',
              'prenatal_salvar_campo', 'prenatal_concluir', 'alocacao_familia', 'oferecer_designacao',
              'atribuir_designacao', 'minhas_ofertas', 'responder_designacao', 'radar_nascimentos',
              'registrar_nascimento', 'registrar_previsao_alta', 'registrar_alta')
              and p.prosecdef and coalesce(p.proconfig, '{}') @> array['search_path=""']
              and has_function_privilege('authenticated', p.oid, 'execute')
              and not has_function_privilege('anon', p.oid, 'execute')
              and not has_function_privilege('service_role', p.oid, 'execute')), 15,
  'as quinze funções api do P35 e P36: security definer, search_path vazio, só authenticated');
select is_empty(
  $$ select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('privado', 'assistencial')
        and p.proname in ('abrir_prenatal', 'ao_pagar_cobranca', 'garantir_acompanhamento', 'gerar_visitas', 'aplicar_nascimento',
                          'aplicar_alta', 'tratar_recusa', 'expirar_ofertas', 'processar_designacoes', 'processar_fatos_operacao',
                          'recalculo_alertas_dpp', 'recalculo_alerta_34s', 'avancar_designacao', 'op_avancar_p2', 'op_iniciar_automacao',
                          'ler_consulta_prenatal', 'enfileirar_fato_operacao', 'op_notificar', 'op_evento')
        and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')
             or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'as funções internas do P35 e P36 não têm execute para nenhum papel do app');
select ok(not has_table_privilege('authenticated', 'privado.fato_operacao', 'select')
          and not has_table_privilege('anon', 'privado.fato_operacao', 'select')
          and not has_table_privilege('service_role', 'privado.fato_operacao', 'select'),
  'a fila de fatos não tem privilégio nenhum');
select ok(has_column_privilege('authenticated', 'public.designacao', 'status', 'select')
          and has_column_privilege('authenticated', 'public.designacao', 'profissional_id', 'select')
          and not has_column_privilege('authenticated', 'public.designacao', 'motivo_recusa', 'select')
          and not has_column_privilege('authenticated', 'public.designacao', 'motivo_direta', 'select')
          and not has_table_privilege('authenticated', 'public.designacao', 'insert')
          and not has_column_privilege('authenticated', 'public.designacao', 'status', 'update'),
  'designacao: leitura das linhas sem os motivos em texto livre; escrita só pelas funções');
select ok(not has_table_privilege('authenticated', 'public.consulta_prenatal', 'select')
          and not has_table_privilege('authenticated', 'public.consulta_prenatal', 'update'),
  'consulta_prenatal continua sem select nem update direto (tabela assistencial)');
select is((select count(*)::integer from cron.job where jobname = 'processar_designacoes' and schedule = '*/5 * * * *'), 1,
  'pg_cron: processar_designacoes a cada 5 minutos');
select is((select count(*)::integer from pg_indexes where schemaname = 'public'
            and indexname in ('designacao_papel_ativo', 'designacao_profissional_ativa', 'consulta_prenatal_viva')), 3,
  'os três índices únicos (uma titular, uma backup, uma consulta viva) existem');
select is((select count(*)::integer from privado.auditoria_coluna_sensivel where entidade = 'designacao'), 2,
  'motivo da atribuição direta e motivo da recusa entram na lista de colunas ocultas do log');

select * from finish();

rollback;
