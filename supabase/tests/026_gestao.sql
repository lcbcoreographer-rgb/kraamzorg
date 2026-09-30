-- =============================================================================
-- supabase/tests/026_gestao.sql
--
-- Fase 3 de gestão · P45 (capacidade probabilística e sobrevenda), P46
-- (financeiro, DRE e pagamento da equipe) e P52 (painel executivo) ·
-- migration 0026_gestao.sql.
--
--   1. P45: soma de Bernoullis, distribuição do nascimento (referência,
--      histórico próprio e uniforme), capacidade por semana com cenários
--      sintéticos (o alerta dispara acima do limite), cobertura de backup,
--      conferência da probabilidade contra a conta feita à parte, alerta à
--      diretoria uma vez por região e semana, disponibilidade do agente,
--      api.capacidade.
--   2. P46: DRE do mês fecha com os lançamentos (e no fuso de São Paulo),
--      despesas, inadimplência, previsão, pagamento da equipe bloqueado sem
--      evolução enviada, extrato que nunca dá baixa.
--   3. P52: cada número do painel contra a consulta da tabela de origem.
--   4. Segurança: matriz de papel e AAL, tabelas sem grant, anônimo.
--
-- Só dado sintético, criado aqui e desfeito no rollback. Datas de cenário em
-- 2031 e em maio de 2026, longe de qualquer dado do seed.
-- =============================================================================

begin;

select plan(277);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2600000-0000-4000-8000-000000000001', 'financeiro.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000002', 'diretoria.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000003', 'coordenacao.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000004', 'comercial.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000005', 'marketing.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000006', 'enfermeira.p.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000007', 'enfermeira.b.p46@exemplo.invalid');
insert into perfil (id, nome, email) values
  ('a2600000-0000-4000-8000-000000000001', 'Perfil Teste Financeiro P46', 'financeiro.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000002', 'Perfil Teste Diretoria P46', 'diretoria.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000003', 'Perfil Teste Coordenação P46', 'coordenacao.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000004', 'Perfil Teste Comercial P46', 'comercial.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000005', 'Perfil Teste Marketing P46', 'marketing.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000006', 'Perfil Teste Enfermeira P P46', 'enfermeira.p.p46@exemplo.invalid'),
  ('a2600000-0000-4000-8000-000000000007', 'Perfil Teste Enfermeira B P46', 'enfermeira.b.p46@exemplo.invalid');
insert into usuario_papel (usuario_id, papel) values
  ('a2600000-0000-4000-8000-000000000001', 'financeiro'),
  ('a2600000-0000-4000-8000-000000000002', 'diretoria'),
  ('a2600000-0000-4000-8000-000000000003', 'coordenacao'),
  ('a2600000-0000-4000-8000-000000000004', 'comercial'),
  ('a2600000-0000-4000-8000-000000000005', 'marketing'),
  ('a2600000-0000-4000-8000-000000000006', 'enfermeira'),
  ('a2600000-0000-4000-8000-000000000007', 'enfermeira');

-- Os parâmetros do seed de gestão (gestao_seed.sql), reafirmados para o teste
-- não depender de outro arquivo ter mexido neles.
insert into parametro (chave, valor) values
  ('capacidade_modelo', '"probabilistico"'),
  ('capacidade_alerta_pct', '85'),
  ('sobrevenda_prob_pct', '10'),
  ('capacidade_semanas_painel', '8'),
  ('backup_reserva_profissionais', '1'),
  ('agenda_visitas_por_dia', '2'),
  ('janela_dpp_dias', '{"antes": 3, "depois": 3}')
on conflict (chave) do update set valor = excluded.valor;
update automacao set ativa = true where id = 'sobrevenda';

-- Regiões do cenário
--   A  limite 3, duas profissionais       B  limite 1, duas profissionais
--   C  limite 3, nenhuma profissional     D  limite 5, duas profissionais
insert into regiao (id, nome, praca, limite_familias_semana) values
  ('b2600000-0000-4000-8000-000000000001', 'Região A Teste P45', 'Teste', 3),
  ('b2600000-0000-4000-8000-000000000002', 'Região B Teste P45', 'Teste', 1),
  ('b2600000-0000-4000-8000-000000000003', 'Região C Teste P45', 'Teste', 3),
  ('b2600000-0000-4000-8000-000000000004', 'Região D Teste P45', 'Teste', 5);

insert into profissional (id, usuario_id, nome, funcao, regioes, valor_hora_centavos, adicional_deslocamento_centavos) values
  ('d2600000-0000-4000-8000-000000000001', 'a2600000-0000-4000-8000-000000000006', 'Profissional A1 Teste P45', 'enfermeira_obstetrica',
     array['b2600000-0000-4000-8000-000000000001'::uuid], null, 10000),
  ('d2600000-0000-4000-8000-000000000002', 'a2600000-0000-4000-8000-000000000007', 'Profissional A2 Teste P45', 'enfermeira_neonatal',
     array['b2600000-0000-4000-8000-000000000001'::uuid], 12000, 0),
  ('d2600000-0000-4000-8000-000000000003', null, 'Profissional B1 Teste P45', 'enfermeira_neonatal',
     array['b2600000-0000-4000-8000-000000000002'::uuid], null, 0),
  ('d2600000-0000-4000-8000-000000000004', null, 'Profissional B2 Teste P45', 'enfermeira_neonatal',
     array['b2600000-0000-4000-8000-000000000002'::uuid], null, 0),
  ('d2600000-0000-4000-8000-000000000005', null, 'Profissional D1 Teste P45', 'enfermeira_neonatal',
     array['b2600000-0000-4000-8000-000000000004'::uuid], null, 0),
  ('d2600000-0000-4000-8000-000000000006', null, 'Profissional D2 Teste P45', 'enfermeira_neonatal',
     array['b2600000-0000-4000-8000-000000000004'::uuid], null, 0);

insert into pacote (id, nome, dias) values ('b2600000-0000-4000-8000-000000000021', 'Pacote Teste P45', 6);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2600000-0000-4000-8000-000000000022', 'b2600000-0000-4000-8000-000000000021', 420000, 3, '2020-01-01');

-- família e contrato do cenário; devolve o id do contrato
create function pg_temp.nova_familia(p_id uuid, p_nome text, p_regiao uuid, p_dpp date, p_inicio date default null)
  returns uuid language plpgsql as $$
begin
  insert into familia (id, nome_exibicao, regiao_id, dpp, data_inicio_efetivo)
  values (p_id, p_nome, p_regiao, p_dpp, p_inicio);
  insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao)
  values (p_id, p_id, 'b2600000-0000-4000-8000-000000000022', 420000, 'teste');
  return p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. P45 · Soma de Bernoullis
-- -----------------------------------------------------------------------------

select is(privado.poisson_binomial(array[0.5, 0.5]::numeric[]), array[0.25, 0.5, 0.25]::numeric[],
  'soma de duas moedas: 25%, 50%, 25%');
select is(privado.poisson_binomial(array[]::numeric[]), array[1]::numeric[], 'sem famílias, zero famílias com certeza');
select is(privado.poisson_binomial(array[1, 1, 0]::numeric[]), array[0, 0, 1, 0]::numeric[],
  'probabilidade 1 e 0 dão o número exato');
select is(privado.poisson_binomial(array[0.5, 0.5, 0.2]::numeric[]), array[0.2, 0.45, 0.3, 0.05]::numeric[],
  'três famílias com 0,5, 0,5 e 0,2');

-- -----------------------------------------------------------------------------
-- 2. P45 · Distribuição do nascimento
-- -----------------------------------------------------------------------------

select ok((select abs(sum(peso) - 1) < 0.000000001 from privado.distribuicao_nascimento()),
  'a distribuição de referência soma 1');
select is((select count(*)::integer from privado.distribuicao_nascimento()), 77,
  'referência: 77 dias, de 8 semanas antes da DPP a 3 semanas depois');
select is(privado.distribuicao_nascimento_info() ->> 'fonte', 'referencia',
  'sem histórico suficiente, a fonte é a referência do parâmetro');
select ok((select abs(sum(peso) filter (where deslocamento between -14 and 13) - 0.79) < 0.0001
           from privado.distribuicao_nascimento()),
  'a referência põe 79% dos nascimentos entre 38 e 41 semanas e 6 dias');

-- 30 partos próprios, todos no dia da DPP: o histórico vence a referência
insert into familia (nome_exibicao, dpp, data_nascimento)
select 'Família Teste Histórico ' || g, date '2029-01-10' + g, date '2029-01-10' + g from generate_series(1, 30) g;
update parametro set valor = jsonb_set(valor, '{historico_minimo}', '30') where chave = 'distribuicao_nascimento';
select is(privado.distribuicao_nascimento_info() ->> 'fonte', 'historico',
  'com partos próprios suficientes, a fonte é o histórico');
select ok((select abs(sum(peso) filter (where deslocamento between 0 and 6) - 1) < 0.000000001
           from privado.distribuicao_nascimento()),
  'histórico: todo o peso cai na faixa em que os 30 partos aconteceram');
update parametro set valor = jsonb_set(valor, '{historico_minimo}',
  to_jsonb(((privado.distribuicao_nascimento_info() ->> 'historico_n')::integer + 1))) where chave = 'distribuicao_nascimento';
select is(privado.distribuicao_nascimento_info() ->> 'fonte', 'referencia',
  'um parto a menos que o mínimo: volta a referência');
update parametro set valor = jsonb_set(valor, '{historico_minimo}', '1000') where chave = 'distribuicao_nascimento';

update parametro set valor = '"uniforme"' where chave = 'capacidade_modelo';
select results_eq(
  $$ select count(*)::integer, round(min(peso), 6), round(max(peso), 6) from privado.distribuicao_nascimento() $$,
  $$ values (7, 0.142857::numeric, 0.142857::numeric) $$,
  'modelo uniforme: a janela da Fase 1 (3 antes e 3 depois), 1/7 por dia');
update parametro set valor = '"probabilistico"' where chave = 'capacidade_modelo';

delete from parametro where chave = 'distribuicao_nascimento';
select is((select count(*)::integer from privado.distribuicao_nascimento()), 0,
  'sem o parâmetro da distribuição não há distribuição (nada inventado)');
insert into parametro (chave, valor) values ('distribuicao_nascimento',
  '{"versao":"teste","historico_minimo":1000,"deslocamento_inicio_dias":2,"intervalo_provavel_pct":95,"faixas":[{"de":-56,"ate":-43,"peso":1.5},{"de":-42,"ate":-22,"peso":6.5},{"de":-21,"ate":-15,"peso":10},{"de":-14,"ate":-8,"peso":20},{"de":-7,"ate":-1,"peso":27},{"de":0,"ate":6,"peso":22},{"de":7,"ate":13,"peso":10},{"de":14,"ate":20,"peso":3}]}');

-- -----------------------------------------------------------------------------
-- 3. P45 · Capacidade por semana, cenários sintéticos com início conhecido
--    (segunda-feira 03/03/2031, pacote de 6 dias todo na mesma semana)
-- -----------------------------------------------------------------------------

select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000001', 'Família Teste A1 P45', 'b2600000-0000-4000-8000-000000000001', '2031-03-01', '2031-03-03');
select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000002', 'Família Teste A2 P45', 'b2600000-0000-4000-8000-000000000001', '2031-03-01', '2031-03-03');
select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000003', 'Família Teste A3 P45', 'b2600000-0000-4000-8000-000000000001', '2031-03-01', '2031-03-03');
select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000004', 'Família Teste A4 P45', 'b2600000-0000-4000-8000-000000000001', '2031-03-01', '2031-03-03');

select results_eq(
  $$ select familias_esperadas, familias_p90, ocupacao_pct, prob_excesso_pct, nivel
     from privado.capacidade_semanal('2031-03-03', '2031-03-03', 'b2600000-0000-4000-8000-000000000001') $$,
  $$ values (4.00::numeric, 4, 114.3::numeric, 100.0::numeric, 'sobrevenda'::text) $$,
  'quatro famílias começando na mesma semana num limite de três: sobrevenda com certeza');

update contrato set status = 'cancelado' where id = 'c2600000-0000-4000-8000-000000000004';
select results_eq(
  $$ select familias_esperadas, ocupacao_pct, prob_excesso_pct, nivel
     from privado.capacidade_semanal('2031-03-03', '2031-03-03', 'b2600000-0000-4000-8000-000000000001') $$,
  $$ values (3.00::numeric, 85.7::numeric, 0.0::numeric, 'atencao'::text) $$,
  'três famílias no limite de três: sem sobrevenda, mas ocupação de 85,7% pede atenção');

update contrato set status = 'cancelado' where id = 'c2600000-0000-4000-8000-000000000003';
select results_eq(
  $$ select familias_esperadas, familias_p90, ocupacao_pct, profissionais_ativas, capacidade_equipe, cobertura, nivel
     from privado.capacidade_semanal('2031-03-03', '2031-03-03', 'b2600000-0000-4000-8000-000000000001') $$,
  $$ values (2.00::numeric, 2, 57.1::numeric, 2, 4, 'ok'::text, 'folga'::text) $$,
  'duas famílias e duas profissionais livres: a equipe cobre o pior caso e a reserva de backup, folga');

insert into bloqueio_agenda (profissional_id, inicio, fim, motivo)
values ('d2600000-0000-4000-8000-000000000001', '2031-03-03', '2031-03-09', 'Férias sintéticas');
select results_eq(
  $$ select capacidade_equipe, cobertura, nivel
     from privado.capacidade_semanal('2031-03-03', '2031-03-03', 'b2600000-0000-4000-8000-000000000001') $$,
  $$ values (2, 'sem_reserva'::text, 'atencao'::text) $$,
  'uma profissional de férias na semana: a equipe só cobre o pior caso, sem reserva de backup, atenção');
delete from bloqueio_agenda where profissional_id = 'd2600000-0000-4000-8000-000000000001';

select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000011', 'Família Teste C1 P45', 'b2600000-0000-4000-8000-000000000003', '2031-03-01', '2031-03-03');
select results_eq(
  $$ select profissionais_ativas, capacidade_equipe, cobertura, nivel
     from privado.capacidade_semanal('2031-03-03', '2031-03-03', 'b2600000-0000-4000-8000-000000000003') $$,
  $$ values (0, 0, 'insuficiente'::text, 'atencao'::text) $$,
  'região sem profissional ativa: cobertura insuficiente');

select is((select nivel from privado.capacidade_semanal('2031-03-10', '2031-03-10', 'b2600000-0000-4000-8000-000000000001')),
  'folga', 'a semana seguinte, sem famílias, está em folga');
select is((select count(*)::integer from privado.capacidade_semanal('2031-03-03', '2031-04-27', 'b2600000-0000-4000-8000-000000000001')), 8,
  'entre 03/03 e 27/04 são oito semanas por região');

-- limite de alerta vem do parâmetro: com 60%, duas famílias (57,1%) passam a 'folga' e com 50% viram atenção
update parametro set valor = '50' where chave = 'capacidade_alerta_pct';
select is((select nivel from privado.capacidade_semanal('2031-03-03', '2031-03-03', 'b2600000-0000-4000-8000-000000000001')), 'atencao',
  'o limite de alerta é o parâmetro: com 50%, 57,1% é atenção');
update parametro set valor = '85' where chave = 'capacidade_alerta_pct';

delete from parametro where chave = 'sobrevenda_prob_pct';
select throws_ok(
  $$ select * from privado.capacidade_semanal('2031-03-03', '2031-03-03', 'b2600000-0000-4000-8000-000000000001') $$,
  'P0001', null, 'sem o parâmetro do limite de sobrevenda a conta recusa em vez de inventar um número');
insert into parametro (chave, valor) values ('sobrevenda_prob_pct', '10');

-- conservação: um contrato só com a DPP distribui exatamente os seus 6 dias
select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000021', 'Família Teste D1 P45', 'b2600000-0000-4000-8000-000000000004', '2031-09-16');
select ok((select abs(sum(dias_atendimento) - 6) < 0.15
           from privado.capacidade_semanal('2031-07-01', '2031-12-31', 'b2600000-0000-4000-8000-000000000004')),
  'a DPP distribui os 6 dias contratados pelas semanas (soma 6, a menos do arredondamento por semana)');
select ok((select max(prob_excesso_pct) = 0 and bool_and(nivel = 'folga')
           from privado.capacidade_semanal('2031-07-01', '2031-12-31', 'b2600000-0000-4000-8000-000000000004')),
  'uma família num limite de cinco não é sobrevenda em semana nenhuma');

-- -----------------------------------------------------------------------------
-- 4. P45 · A probabilidade confere com a conta feita à parte
--    Três famílias com a mesma DPP num limite de uma: passar do limite é duas
--    ou mais em atendimento na mesma semana, 1 - (1-p)³ - 3p(1-p)² (independência).
-- -----------------------------------------------------------------------------

select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000031', 'Família Teste B1 P45', 'b2600000-0000-4000-8000-000000000002', '2031-06-10');
select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000032', 'Família Teste B2 P45', 'b2600000-0000-4000-8000-000000000002', '2031-06-10');
select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000033', 'Família Teste B5 P45', 'b2600000-0000-4000-8000-000000000002', '2031-06-10');

select results_eq(
  $$ select semana, prob_excesso_pct, familias_esperadas
     from privado.capacidade_semanal('2031-04-01', '2031-08-31', 'b2600000-0000-4000-8000-000000000002')
     where familias_esperadas > 0 order by semana $$,
  $$ with ini as (
       select date '2031-06-10' + deslocamento + 2 as s, peso from privado.distribuicao_nascimento()
     ),
     toca as (
       select date_trunc('week', s)::date as semana, peso from ini
       union all
       select date_trunc('week', s + 5)::date, peso from ini where date_trunc('week', s) <> date_trunc('week', s + 5)
     ),
     pw as (select semana, sum(peso) as p from toca group by semana)
     select semana, round(100 * (1 - power(1 - p, 3) - 3 * p * power(1 - p, 2)), 1), round(3 * p, 2)
     from pw where round(3 * p, 2) > 0 order by semana $$,
  'probabilidade de passar o limite e famílias esperadas de cada semana batem com a conta independente');

select ok(exists (select 1 from privado.capacidade_semanal('2031-04-01', '2031-08-31', 'b2600000-0000-4000-8000-000000000002') where nivel = 'sobrevenda'),
  'três famílias com a mesma DPP num limite de uma têm semana de sobrevenda');
update parametro set valor = '100' where chave = 'sobrevenda_prob_pct';
select ok(not exists (select 1 from privado.capacidade_semanal('2031-04-01', '2031-08-31', 'b2600000-0000-4000-8000-000000000002') where nivel = 'sobrevenda'),
  'o limite de sobrevenda é o parâmetro: exigindo 100% não há alerta sem certeza');
update parametro set valor = '10' where chave = 'sobrevenda_prob_pct';

-- nascimento registrado é fato: o início passa a ser o nascimento mais o deslocamento, com peso 1
update familia set data_nascimento = '2031-06-03' where id = 'c2600000-0000-4000-8000-000000000031';
select results_eq(
  $$ select inicio, peso from privado.capacidade_cenarios() where familia_id = 'c2600000-0000-4000-8000-000000000031' $$,
  $$ values (date '2031-06-05', 1::numeric) $$,
  'nascimento registrado (fato) vale mais que a DPP: início dois dias depois, um cenário só');
update familia set data_nascimento = null where id = 'c2600000-0000-4000-8000-000000000031';

-- DPP passada sem nascimento: só resta o que ainda pode acontecer (nascimentos de hoje em diante)
insert into familia (id, nome_exibicao, regiao_id, dpp) values
  ('c2600000-0000-4000-8000-000000000041', 'Família Teste Passada P45', 'b2600000-0000-4000-8000-000000000004', privado.hoje_sp() - 5);
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao) values
  ('c2600000-0000-4000-8000-000000000041', 'c2600000-0000-4000-8000-000000000041', 'b2600000-0000-4000-8000-000000000022', 420000, 'teste');
select ok((select min(inicio) >= privado.hoje_sp() + 2 and abs(sum(peso) - 1) < 0.000000001
           from privado.capacidade_cenarios() where familia_id = 'c2600000-0000-4000-8000-000000000041'),
  'DPP passada sem nascimento: nenhum início antes de hoje, e os pesos continuam somando 1');
delete from contrato where id = 'c2600000-0000-4000-8000-000000000041';
delete from familia where id = 'c2600000-0000-4000-8000-000000000041';

-- -----------------------------------------------------------------------------
-- 5. P45 · Alerta à diretoria (recálculo diário), uma vez por região e semana
-- -----------------------------------------------------------------------------

select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000051', 'Família Teste B3 P45', 'b2600000-0000-4000-8000-000000000002', privado.hoje_sp() + 30);
select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000052', 'Família Teste B4 P45', 'b2600000-0000-4000-8000-000000000002', privado.hoje_sp() + 30);
select pg_temp.nova_familia('c2600000-0000-4000-8000-000000000053', 'Família Teste B6 P45', 'b2600000-0000-4000-8000-000000000002', privado.hoje_sp() + 30);

select ok(privado.pode_executar(null, 'sobrevenda'), 'a automação sobrevenda passa pelo freio (sem família, nada a frear)');
create temp table t_rec1 on commit drop as select privado.recalculo_ocupacao() as r;
select ok((select (r ->> 'alertas_sobrevenda')::integer >= 1 from t_rec1), 'o recálculo alerta a região com semana de sobrevenda');
select is((select count(*)::integer from notificacao
            where papel = 'diretoria' and titulo = 'Sobrevenda provável em Região B Teste P45' and prioridade = 'alta' and link = '/capacidade'),
  1, 'a diretoria recebe uma notificação por região, com prioridade alta e o link da capacidade');
select ok((select corpo like '%Região B Teste P45%' and corpo not like '%Família%' from notificacao
            where titulo = 'Sobrevenda provável em Região B Teste P45'),
  'o texto do aviso nomeia a região e não traz nenhuma família');
select ok((select count(*) from automacao_execucao where automacao_id = 'sobrevenda' and status = 'executada'
                and payload ->> 'regiao_id' = 'b2600000-0000-4000-8000-000000000002') >= 1,
  'cada região e semana avisada fica registrada como execução da automação sobrevenda');
create temp table t_rec2 on commit drop as select privado.recalculo_ocupacao() as r;
select is((select count(*)::integer from notificacao where titulo = 'Sobrevenda provável em Região B Teste P45'), 1,
  'segundo recálculo no mesmo dia não repete o aviso');
select is((select (r ->> 'alertas_sobrevenda')::integer from t_rec2), 0, 'e o recálculo diz que não avisou de novo');

create temp table t_rd on commit drop as select privado.recalculo_diario() as r;
select is((select r -> 'etapas' ->> 'ocupacao' from t_rd), 'ok', 'a etapa ocupacao do recálculo diário roda sem erro no modelo probabilístico');

update automacao set ativa = false where id = 'sobrevenda';
delete from notificacao where titulo = 'Sobrevenda provável em Região B Teste P45';
delete from automacao_execucao where automacao_id = 'sobrevenda';
create temp table t_rec3 on commit drop as select privado.recalculo_ocupacao() as r;
select is((select count(*)::integer from notificacao where titulo = 'Sobrevenda provável em Região B Teste P45'), 0,
  'com a automação sobrevenda desligada não há aviso (a foto das semanas continua sendo gravada)');
select ok((select jsonb_array_length(r -> 'semanas') > 0 from t_rec3), 'a foto das semanas segue no resultado da etapa');
update automacao set ativa = true where id = 'sobrevenda';

-- -----------------------------------------------------------------------------
-- 6. P45 · Disponibilidade do agente: só 'disponivel' ou 'confirmar_com_equipe'
-- -----------------------------------------------------------------------------

select is(privado.disponibilidade('2032-01-15', 'b2600000-0000-4000-8000-000000000004'), 'disponivel',
  'região com equipe, sem sobrevenda nem falta de reserva: disponível');
select is(privado.disponibilidade('2031-06-10', 'b2600000-0000-4000-8000-000000000002'), 'confirmar_com_equipe',
  'DPP cujo nascimento provável cai em semana de sobrevenda: confirmar com a equipe');
select is(privado.disponibilidade('2032-01-15', 'b2600000-0000-4000-8000-000000000003'), 'confirmar_com_equipe',
  'região sem profissional ativa (sem cobertura de backup): confirmar com a equipe');
delete from parametro where chave = 'sobrevenda_prob_pct';
select is(privado.disponibilidade('2032-01-15', 'b2600000-0000-4000-8000-000000000004'), 'confirmar_com_equipe',
  'sem o parâmetro de sobrevenda o agente nunca promete vaga');
insert into parametro (chave, valor) values ('sobrevenda_prob_pct', '10');
update parametro set valor = '"uniforme"' where chave = 'capacidade_modelo';
select is(privado.disponibilidade('2032-01-15', 'b2600000-0000-4000-8000-000000000003'), 'disponivel',
  'modelo uniforme (Fase 1): a região sem equipe não entra na conta, como antes do P45');
update parametro set valor = '"probabilistico"' where chave = 'capacidade_modelo';
select is((select array_agg(k order by k) from jsonb_object_keys(agente.verificar_disponibilidade(
             to_char(date '2032-01-15', 'DD/MM/YYYY'), 'São Paulo')) k), array['ok', 'status']::text[],
  'a ferramenta do agente continua devolvendo só ok e status, nenhum número de capacidade');

-- -----------------------------------------------------------------------------
-- 7. P45 · api.capacidade
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000003', 'aal2');
create temp table t_cap on commit drop as select api.capacidade() as r;
select testes.encerrar();
select is((select jsonb_array_length(r -> 'regioes') from t_cap), (select count(*)::integer from regiao where ativa and limite_familias_semana > 0),
  'a coordenação vê uma linha por região ativa com limite');
select is((select jsonb_array_length(r -> 'regioes' -> 0 -> 'semanas') from t_cap), 8, 'oito semanas por região (parâmetro)');
select ok((select r::text not like '%Família Teste%' and r::text not like '%nome_exibicao%' from t_cap),
  'a capacidade não carrega nome de família');
select ok((select r -> 'distribuicao' ->> 'fonte' = 'referencia' and jsonb_typeof(r -> 'distribuicao' -> 'faixas') = 'array' from t_cap),
  'a tela sabe de onde vem a distribuição');
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000002', 'aal2');
select is(jsonb_array_length(api.capacidade(2) -> 'regioes' -> 0 -> 'semanas'), 2, 'a diretoria escolhe quantas semanas ver');
select throws_like($$ select api.capacidade(0) $$, '%gestao:semanas_invalidas%', 'zero semanas é recusado');
select testes.encerrar();


-- =============================================================================
-- P46 · Financeiro
-- =============================================================================

-- Famílias e contratos do DRE (maio de 2026). Contrato K_D1: 4.200 menos 200 de
-- desconto mais 350 de taxa = 4.350; K_D2: 7.800.
insert into familia (id, nome_exibicao, regiao_id, origem, codigo_origem, criado_em) values
  ('c2600000-0000-4000-8000-000000000101', 'Família Teste DRE1 P46', 'b2600000-0000-4000-8000-000000000001', 'meta_ads', 'wa-teste-01', '2026-05-03 12:00+00'),
  ('c2600000-0000-4000-8000-000000000102', 'Família Teste DRE2 P46', 'b2600000-0000-4000-8000-000000000001', 'instagram_organico', null, '2026-05-08 12:00+00'),
  ('c2600000-0000-4000-8000-000000000103', 'Família Teste Lead3 P46', 'b2600000-0000-4000-8000-000000000001', 'instagram_organico', null, '2026-05-12 12:00+00'),
  ('c2600000-0000-4000-8000-000000000104', 'Família Teste Lead4 P46', 'b2600000-0000-4000-8000-000000000001', 'indicacao_amigo', null, '2026-05-15 12:00+00'),
  ('c2600000-0000-4000-8000-000000000105', 'Família Teste Lead5 P46', 'b2600000-0000-4000-8000-000000000001', 'indicacao_medica', null, '2026-05-20 12:00+00'),
  ('c2600000-0000-4000-8000-000000000106', 'Família Teste Abril P46', 'b2600000-0000-4000-8000-000000000001', 'meta_ads', null, '2026-04-28 12:00+00');
insert into familia (id, nome_exibicao, regiao_id, origem, criado_em, mesclada_em_id) values
  ('c2600000-0000-4000-8000-000000000107', 'Família Teste Mesclada P46', 'b2600000-0000-4000-8000-000000000001', 'meta_ads', '2026-05-25 12:00+00',
   'c2600000-0000-4000-8000-000000000101');

insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, taxa_deslocamento_centavos, desconto_centavos, template_versao, status, assinado_em) values
  ('c2600000-0000-4000-8000-000000000201', 'c2600000-0000-4000-8000-000000000101', 'b2600000-0000-4000-8000-000000000022', 420000, 35000, 20000, 'teste', 'assinado', '2026-05-04 12:00+00'),
  ('c2600000-0000-4000-8000-000000000202', 'c2600000-0000-4000-8000-000000000102', 'b2600000-0000-4000-8000-000000000022', 780000, 0, 0, 'teste', 'assinado', '2026-05-11 12:00+00'),
  ('c2600000-0000-4000-8000-000000000203', 'c2600000-0000-4000-8000-000000000103', 'b2600000-0000-4000-8000-000000000022', 420000, 100000, 0, 'teste', 'assinado', '2026-05-18 12:00+00'),
  ('c2600000-0000-4000-8000-000000000204', 'c2600000-0000-4000-8000-000000000104', 'b2600000-0000-4000-8000-000000000022', 420000, 0, 0, 'teste', 'assinado', '2026-06-02 12:00+00'),
  ('c2600000-0000-4000-8000-000000000205', 'c2600000-0000-4000-8000-000000000105', 'b2600000-0000-4000-8000-000000000022', 420000, 0, 0, 'teste', 'rascunho', null);

-- CB1 e CB2 pagas em maio (CB2 às 23h de 31/05 em São Paulo, já 1º de junho em UTC);
-- CB3 estornada não conta; CB4 paga em 1º de junho de manhã em São Paulo.
insert into cobranca (id, contrato_id, parcela, valor_centavos, vencimento, external_id, status, pago_em, valor_pago_centavos) values
  ('c2600000-0000-4000-8000-000000000301', 'c2600000-0000-4000-8000-000000000201', 1, 435000, '2026-05-09', 'ext-p46-1', 'paga', '2026-05-10 15:00+00', 435000),
  ('c2600000-0000-4000-8000-000000000302', 'c2600000-0000-4000-8000-000000000202', 1, 780000, '2026-05-30', 'ext-p46-2', 'paga', '2026-06-01 02:00+00', 780000),
  ('c2600000-0000-4000-8000-000000000303', 'c2600000-0000-4000-8000-000000000202', 2, 300000, '2026-05-12', 'ext-p46-3', 'estornada', '2026-05-12 12:00+00', 300000),
  ('c2600000-0000-4000-8000-000000000304', 'c2600000-0000-4000-8000-000000000201', 2, 100000, '2026-06-01', 'ext-p46-4', 'paga', '2026-06-01 04:00+00', 100000);

-- Despesas pelo caminho do app (financeiro, AAL2)
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
create temp table t_desp on commit drop as
  select 'mkt' as chave, (api.salvar_despesa(null, '2026-05-05', 'marketing_anuncios', 'Anúncios de maio sintéticos', 'Plataforma Teste', 150000, 'meta_ads') ->> 'id')::uuid as id
  union all select 'mkt2', (api.salvar_despesa(null, '2026-05-06', 'marketing_anuncios', 'Impulsionamento sem canal', null, 20000) ->> 'id')::uuid
  union all select 'cont', (api.salvar_despesa(null, '2026-05-15', 'contabilidade', 'Contabilidade de maio sintética', 'Escritório Teste', 50000) ->> 'id')::uuid
  union all select 'tec', (api.salvar_despesa(null, '2026-05-16', 'tecnologia', 'Hospedagem sintética', null, 30000) ->> 'id')::uuid
  union all select 'out', (api.salvar_despesa(null, '2026-05-20', 'outros', 'Material sintético', null, 1000) ->> 'id')::uuid
  union all select 'jun', (api.salvar_despesa(null, '2026-06-05', 'tecnologia', 'Hospedagem de junho sintética', null, 20000) ->> 'id')::uuid;
select testes.encerrar();
select is((select count(*)::integer from t_desp), 6, 'seis despesas lançadas pelo financeiro');

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select throws_like($$ select api.salvar_despesa(null, current_date + 30, 'outros', 'Futura', null, 100) $$, '%gestao:data_futura%',
  'despesa com data futura é recusada (regime de caixa: só o que já foi pago)');
select throws_like($$ select api.salvar_despesa(null, '2026-05-05', 'outros', 'Zero', null, 0) $$, '%gestao:valor_invalido%', 'valor zero é recusado');
select throws_like($$ select api.salvar_despesa(null, '2026-05-05', 'outros', 'Enorme', null, 2000000000) $$, '%gestao:valor_invalido%',
  'valor acima do teto do parâmetro é recusado');
select throws_like($$ select api.salvar_despesa(null, '2026-05-05', 'outros', 'Com canal', null, 100, 'meta_ads') $$, '%gestao:canal_so_no_marketing%',
  'canal só vale para marketing e anúncios');
select throws_like($$ select api.salvar_despesa(null, '2026-05-05', 'outros', '   ', null, 100) $$, '%gestao:descricao_invalida%', 'descrição vazia é recusada');
select testes.encerrar();

-- DRE de maio: receita 4.350 + 7.800 = 12.150 (o estorno e a cobrança de 1º de junho ficam de fora);
-- despesas 1.500 + 200 + 500 + 300 + 10 = 2.510; resultado 9.640; margem 79,3%.
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
create temp table t_dre1 on commit drop as select api.dre('2026-05-17') as r, api.lancamentos('2026-05-01') as l;
select testes.encerrar();
select results_eq(
  $$ select (r ->> 'receita_centavos')::bigint, (r ->> 'despesas_centavos')::bigint, (r ->> 'resultado_centavos')::bigint,
            (r ->> 'margem_pct')::numeric, r ->> 'regime', r ->> 'mes' from t_dre1 $$,
  $$ values (1215000::bigint, 251000::bigint, 964000::bigint, 79.3::numeric, 'caixa'::text, '2026-05-01'::text) $$,
  'DRE de maio: receita, despesas, resultado e margem em regime de caixa, no fuso de São Paulo');
select is((select jsonb_array_length(r -> 'despesas_por_categoria') from t_dre1), 7, 'o DRE lista as sete categorias, mesmo as zeradas');
select results_eq(
  $$ select x ->> 'categoria', (x ->> 'centavos')::bigint from t_dre1, jsonb_array_elements(r -> 'despesas_por_categoria') with ordinality as t(x, n) order by n $$,
  $$ values ('equipe_assistencial'::text, 0::bigint), ('marketing_anuncios', 170000), ('deslocamento', 0), ('contabilidade', 50000),
            ('tecnologia', 30000), ('pro_labore', 0), ('outros', 1000) $$,
  'despesas por categoria na ordem do PRD');
select is((select jsonb_array_length(r -> 'serie') from t_dre1), 6, 'a série tem os seis meses do parâmetro');
select is((select (r -> 'serie' -> 5 ->> 'resultado_centavos')::bigint from t_dre1), 964000::bigint, 'o último mês da série é o mês do DRE');
-- o DRE fecha com os lançamentos: a soma linha a linha dá o mesmo resultado
select results_eq(
  $$ select (l ->> 'receitas_centavos')::bigint, (l ->> 'despesas_centavos')::bigint, (l ->> 'saldo_centavos')::bigint, jsonb_array_length(l -> 'lancamentos') from t_dre1 $$,
  $$ values (1215000::bigint, 251000::bigint, 964000::bigint, 7) $$,
  'os lançamentos do mês (duas cobranças e cinco despesas) somam a receita e as despesas do DRE');
select ok((select (r ->> 'resultado_centavos')::bigint = (l ->> 'saldo_centavos')::bigint from t_dre1),
  'o resultado do DRE é o saldo dos lançamentos');
select ok((select (select sum((x ->> 'valor_centavos')::bigint) from jsonb_array_elements(l -> 'lancamentos') x where x ->> 'tipo' = 'receita')
                = (r ->> 'receita_centavos')::bigint from t_dre1),
  'a soma das linhas de receita é a receita do DRE');

-- despesa removida sai do DRE e fica registrada; a do mês seguinte não entra em maio
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select throws_like(format($$ select api.remover_despesa(%L, 'curto') $$, (select id from t_desp where chave = 'out')), '%gestao:motivo_invalido%',
  'remover pede um motivo de pelo menos 10 letras');
select lives_ok(format($$ select api.remover_despesa(%L, 'Lançamento em duplicidade, conferido no extrato') $$, (select id from t_desp where chave = 'out')),
  'remover com motivo funciona');
select is((api.dre('2026-05-01') ->> 'despesas_centavos')::bigint, 250000::bigint, 'a despesa removida sai do DRE');
select throws_like(format($$ select api.remover_despesa(%L, 'Lançamento em duplicidade, conferido no extrato') $$, (select id from t_desp where chave = 'out')),
  '%gestao:despesa_removida%', 'remover duas vezes é recusado');
select lives_ok(format($$ select api.salvar_despesa(%L, '2026-05-16', 'tecnologia', 'Hospedagem sintética corrigida', null, 30000) $$, (select id from t_desp where chave = 'tec')),
  'corrigir uma despesa funciona');
select testes.encerrar();
select is((select count(*)::integer from privado.despesa where id = (select id from t_desp where chave = 'out') and removida_em is not null and removida_por is not null), 1,
  'a despesa removida continua no banco, com quem removeu');
-- volta a despesa "outros" (nova) para os números seguintes ficarem redondos
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select lives_ok($$ select api.salvar_despesa(null, '2026-05-20', 'outros', 'Material sintético (relançado)', null, 1000) $$, 'relança a despesa removida');
select testes.encerrar();

-- o log de auditoria prova a mudança sem copiar o texto da despesa
select is((select count(*)::integer from log_auditoria
            where entidade = 'privado.despesa' and (valor_depois::text like '%Hospedagem sintética%' or valor_depois::text like '%Plataforma Teste%')), 0,
  'o log de auditoria da despesa não copia descrição nem fornecedor');
select ok(exists (select 1 from log_auditoria where entidade = 'privado.despesa' and valor_depois::text like '%[oculto]%'),
  'o log grava "[oculto]" no lugar do texto livre');

-- -----------------------------------------------------------------------------
-- Inadimplência e previsão
-- -----------------------------------------------------------------------------

insert into familia (id, nome_exibicao, regiao_id) values
  ('c2600000-0000-4000-8000-000000000111', 'Família Teste Inadimplente P46', 'b2600000-0000-4000-8000-000000000001');
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status, assinado_em) values
  ('c2600000-0000-4000-8000-000000000211', 'c2600000-0000-4000-8000-000000000111', 'b2600000-0000-4000-8000-000000000022', 420000, 'teste', 'assinado', '2026-03-01 12:00+00');
insert into cobranca (id, contrato_id, parcela, valor_centavos, vencimento, external_id, status) values
  ('c2600000-0000-4000-8000-000000000311', 'c2600000-0000-4000-8000-000000000211', 1, 200000, privado.hoje_sp() - 5, 'ext-p46-11', 'aberta'),
  ('c2600000-0000-4000-8000-000000000312', 'c2600000-0000-4000-8000-000000000211', 2, 300000, privado.hoje_sp() - 20, 'ext-p46-12', 'aberta'),
  ('c2600000-0000-4000-8000-000000000313', 'c2600000-0000-4000-8000-000000000211', 3, 100000, privado.hoje_sp() - 45, 'ext-p46-13', 'aberta'),
  ('c2600000-0000-4000-8000-000000000314', 'c2600000-0000-4000-8000-000000000211', 4, 400000, privado.hoje_sp() + 10, 'ext-p46-14', 'aberta'),
  ('c2600000-0000-4000-8000-000000000315', 'c2600000-0000-4000-8000-000000000211', 5, 50000, privado.hoje_sp() - 40, 'ext-p46-15', 'cancelada');

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000002', 'aal2');
create temp table t_inad on commit drop as select api.inadimplencia() as r, api.previsao_recebimentos() as p;
select testes.encerrar();
select is((select (r ->> 'vencido_centavos')::bigint from t_inad),
  (select coalesce(sum(valor_centavos), 0)::bigint from cobranca where status in ('aberta', 'vencida') and vencimento < privado.hoje_sp()),
  'inadimplência: o vencido em aberto é a soma das cobranças abertas com vencimento passado');
select ok((select (r ->> 'vencido_centavos')::bigint >= 600000 from t_inad), 'e inclui as três cobranças vencidas do cenário (6.000), sem a cancelada');
select is((select count(*)::integer from t_inad, jsonb_array_elements(r -> 'itens') x
            where (x ->> 'id') in ('c2600000-0000-4000-8000-000000000311', 'c2600000-0000-4000-8000-000000000312', 'c2600000-0000-4000-8000-000000000313')), 3,
  'a lista traz as três vencidas');
select results_eq(
  $$ select (x ->> 'dias_atraso')::integer from t_inad, jsonb_array_elements(r -> 'itens') x
     where (x ->> 'id') in ('c2600000-0000-4000-8000-000000000311', 'c2600000-0000-4000-8000-000000000312', 'c2600000-0000-4000-8000-000000000313')
     order by 1 $$,
  $$ values (5), (20), (45) $$, 'dias de atraso: 5, 20 e 45');
select results_eq(
  $$ select (x ->> 'de_dias')::integer, (x ->> 'ate_dias')::integer, (x ->> 'qtd')::integer from t_inad, jsonb_array_elements(r -> 'faixas') x order by 1 $$,
  $$ select 1, 7, count(*)::integer from cobranca where status in ('aberta', 'vencida') and vencimento < privado.hoje_sp() and privado.hoje_sp() - vencimento between 1 and 7
     union all select 8, 30, count(*)::integer from cobranca where status in ('aberta', 'vencida') and vencimento < privado.hoje_sp() and privado.hoje_sp() - vencimento between 8 and 30
     union all select 31, null, count(*)::integer from cobranca where status in ('aberta', 'vencida') and vencimento < privado.hoje_sp() and privado.hoje_sp() - vencimento >= 31
     order by 1 $$,
  'as faixas de atraso (parâmetro 7 e 30 dias) contam as vencidas de cada faixa');
select is((select sum((x ->> 'qtd')::integer)::integer from t_inad, jsonb_array_elements(r -> 'faixas') x), (select (r ->> 'vencidas_qtd')::integer from t_inad),
  'a soma das faixas é o total de vencidas');
select ok((select (r ->> 'taxa_pct')::numeric = round(100.0 * (r ->> 'vencido_centavos')::bigint / (r ->> 'emitido_ate_hoje_centavos')::bigint, 1) from t_inad),
  'a taxa é o vencido sobre o emitido até hoje');
select is((select (r ->> 'emitido_ate_hoje_centavos')::bigint from t_inad),
  (select coalesce(sum(case when status = 'paga' then coalesce(valor_pago_centavos, valor_centavos) else valor_centavos end), 0)::bigint
     from cobranca where vencimento <= privado.hoje_sp() and status in ('aberta', 'vencida', 'paga')),
  'emitido até hoje: pagas e em aberto com vencimento até hoje, sem cancelada nem estornada');
select is((select (p ->> 'atrasadas_centavos')::bigint from t_inad), (select (r ->> 'vencido_centavos')::bigint from t_inad),
  'a previsão mostra as atrasadas com o mesmo valor da inadimplência');
select ok((select (p ->> 'a_vencer_centavos')::bigint >= 400000 from t_inad), 'e a previsão traz a cobrança que vence em dez dias (4.000)');
select is((select jsonb_array_length(p -> 'meses') from t_inad), 3, 'previsão dos próximos três meses (parâmetro)');
select is((select (p ->> 'a_vencer_centavos')::bigint from t_inad),
  (select coalesce(sum(valor_centavos), 0)::bigint from cobranca where status in ('aberta', 'vencida') and vencimento >= privado.hoje_sp()
      and vencimento < (privado.inicio_do_mes(privado.hoje_sp()) + interval '3 months')::date),
  'a previsão soma as abertas que vencem de hoje até o fim do terceiro mês');

-- -----------------------------------------------------------------------------
-- Pagamento da equipe
-- -----------------------------------------------------------------------------

insert into familia (id, nome_exibicao, regiao_id, dpp, data_nascimento, data_alta) values
  ('c2600000-0000-4000-8000-000000000121', 'Família Teste Equipe P46', 'b2600000-0000-4000-8000-000000000001', '2026-05-01', '2026-05-02', '2026-05-04');
insert into bebe (id, familia_id, ordem, nome, peso_nascimento_g) values
  ('e2600000-0000-4000-8000-000000000001', 'c2600000-0000-4000-8000-000000000121', 1, 'Bebê Teste Equipe P46', 3200);
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status, assinado_em) values
  ('c2600000-0000-4000-8000-000000000221', 'c2600000-0000-4000-8000-000000000121', 'b2600000-0000-4000-8000-000000000022', 420000, 'teste', 'assinado', '2026-04-20 12:00+00');
insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, estado) values
  ('d2600000-0000-4000-8000-000000000101', 'c2600000-0000-4000-8000-000000000221', 'c2600000-0000-4000-8000-000000000121', 6, 3, 'encerrado');
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, estado)
select 'd2600000-0000-4000-8000-000000000101',
       case when g <= 4 then 'd2600000-0000-4000-8000-000000000001'::uuid else 'd2600000-0000-4000-8000-000000000002'::uuid end,
       g, date '2026-05-10' + g, 'concluida'
from generate_series(1, 6) g;
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, estado)
values ('d2600000-0000-4000-8000-000000000101', 'd2600000-0000-4000-8000-000000000001', 7, '2026-05-17', 'agendada');

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
create temp table t_pg1 on commit drop as select api.pagamentos_equipe('2026-05-01') as r;
select testes.encerrar();
select set_config('t.pg_p1', (select id::text from privado.pagamento_equipe
  where acompanhamento_id = 'd2600000-0000-4000-8000-000000000101' and profissional_id = 'd2600000-0000-4000-8000-000000000001'), true);
-- profissional A1: 4 visitas × 3 h = 12 h × R$ 100 (valor padrão do parâmetro) = 1.200,00, mais a ajuda 100 × 4/6 = 66,67
select results_eq(
  $$ select (x ->> 'visitas')::integer, (x ->> 'horas')::numeric, (x ->> 'valor_hora_centavos')::integer, (x ->> 'valor_horas_centavos')::integer,
            (x ->> 'ajuda_deslocamento_centavos')::integer, (x ->> 'total_centavos')::integer, x ->> 'status', x ->> 'motivo_bloqueio'
     from t_pg1, jsonb_array_elements(r -> 'pagamentos') x where x ->> 'profissional_id' = 'd2600000-0000-4000-8000-000000000001'
       and x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000101' $$,
  $$ values (4, 12.0::numeric, 10000, 120000, 6667, 126667, 'bloqueado'::text, 'evolucao_nao_enviada'::text) $$,
  'horas por visita vezes valor da hora mais ajuda de deslocamento, bloqueado sem evolução enviada');
-- profissional A2 (valor da hora próprio de R$ 120, sem ajuda): 2 × 3 h = 6 h × 120 = 720,00
select results_eq(
  $$ select (x ->> 'visitas')::integer, (x ->> 'valor_hora_centavos')::integer, (x ->> 'total_centavos')::integer, x ->> 'status'
     from t_pg1, jsonb_array_elements(r -> 'pagamentos') x where x ->> 'profissional_id' = 'd2600000-0000-4000-8000-000000000002'
       and x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000101' $$,
  $$ values (2, 12000, 72000, 'bloqueado'::text) $$,
  'a backup recebe pelas visitas que fez, com o valor da hora dela');
select is((select count(*)::integer from privado.pagamento_equipe where acompanhamento_id = 'd2600000-0000-4000-8000-000000000101'), 2,
  'só as visitas realizadas contam: a visita agendada não gera linha extra');

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select throws_like(format($$ select api.pagar_equipe(%L, '2026-05-25') $$, current_setting('t.pg_p1')),
  '%gestao:pagamento_bloqueado evolucao_nao_enviada%', 'pagar sem evolução enviada é recusado');
select testes.encerrar();

-- só a evolução puerperal enviada: falta a neonatal do bebê, segue bloqueado
-- (a 0024 exige aprovação e arquivo para o estado enviado)
insert into relatorio_medico (id, acompanhamento_id, tipo, conteudo, profissional_id, status, aprovado_em, aprovado_por, enviado_em, pdf_path) values
  ('e2600000-0000-4000-8000-000000000010', 'd2600000-0000-4000-8000-000000000101', 'puerperal', '{"dados":{},"conteudo":{}}', 'd2600000-0000-4000-8000-000000000001', 'enviado',
   '2026-05-18 11:00+00', 'a2600000-0000-4000-8000-000000000001', '2026-05-18 12:00+00', 'evolucoes/e2600000-0000-4000-8000-000000000010.pdf');
select ok(not privado.evolucoes_enviadas('d2600000-0000-4000-8000-000000000101'), 'só a puerperal enviada não basta: falta a do bebê');
-- evolução neonatal em revisão também não conta
insert into relatorio_medico (id, acompanhamento_id, tipo, bebe_id, conteudo, profissional_id, status) values
  ('e2600000-0000-4000-8000-000000000011', 'd2600000-0000-4000-8000-000000000101', 'neonatal', 'e2600000-0000-4000-8000-000000000001', '{"dados":{},"conteudo":{}}',
   'd2600000-0000-4000-8000-000000000001', 'em_revisao');
select ok(not privado.evolucoes_enviadas('d2600000-0000-4000-8000-000000000101'), 'neonatal em revisão não conta como enviada');
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select is((select count(*)::integer from jsonb_array_elements(api.pagamentos_equipe('2026-05-01') -> 'pagamentos') x
            where x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000101' and x ->> 'status' = 'bloqueado'), 2,
  'as duas continuam bloqueadas até o envio da neonatal');
select testes.encerrar();
update relatorio_medico set status = 'enviado', aprovado_em = '2026-05-19 11:00+00', aprovado_por = 'a2600000-0000-4000-8000-000000000001',
  enviado_em = '2026-05-19 12:00+00', pdf_path = 'evolucoes/e2600000-0000-4000-8000-000000000011.pdf' where id = 'e2600000-0000-4000-8000-000000000011';
select ok(privado.evolucoes_enviadas('d2600000-0000-4000-8000-000000000101'), 'puerperal e neonatal do bebê enviadas: as evoluções estão completas');

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
create temp table t_pg2 on commit drop as select api.pagamentos_equipe('2026-05-01') as r;
select testes.encerrar();
select is((select count(*)::integer from t_pg2, jsonb_array_elements(r -> 'pagamentos') x
            where x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000101' and x ->> 'status' = 'liberado'), 2,
  'com todas as evoluções enviadas os dois pagamentos são liberados');
select ok((select (r -> 'resumo' ->> 'liberado_centavos')::bigint >= 198667 from t_pg2), 'o resumo soma o liberado (1.266,67 mais 720,00)');

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
create temp table t_pago on commit drop as
  select api.pagar_equipe(current_setting('t.pg_p1')::uuid, '2026-05-25') as r;
select testes.encerrar();
select is((select (r ->> 'total_centavos')::integer from t_pago), 126667, 'pagou o valor calculado');
select results_eq(
  $$ select categoria::text, valor_centavos, data, pagamento_equipe_id is not null from privado.despesa where id = (select (r ->> 'despesa_id')::uuid from t_pago) $$,
  $$ values ('equipe_assistencial'::text, 126667, date '2026-05-25', true) $$,
  'o pagamento vira despesa de equipe assistencial na data do pagamento');
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select throws_like(format($$ select api.pagar_equipe(%L, '2026-05-26') $$, current_setting('t.pg_p1')),
  '%gestao:pagamento_ja_pago%', 'pagar duas vezes é recusado');
select throws_like(format($$ select api.remover_despesa(%L, 'Tentativa de remover o pagamento da equipe') $$, (select (r ->> 'despesa_id')::uuid from t_pago)),
  '%gestao:despesa_da_equipe%', 'a despesa do pagamento da equipe não se remove à mão');
select throws_like(format($$ select api.salvar_despesa(%L, '2026-05-25', 'outros', 'Trocando a categoria', null, 126667) $$, (select (r ->> 'despesa_id')::uuid from t_pago)),
  '%gestao:despesa_da_equipe%', 'nem se edita');
select testes.encerrar();
-- pago não muda mais, mesmo que o valor da hora suba depois
update profissional set valor_hora_centavos = 20000 where id = 'd2600000-0000-4000-8000-000000000001';
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select is((select (x ->> 'total_centavos')::integer from jsonb_array_elements(api.pagamentos_equipe('2026-05-01') -> 'pagamentos') x
            where x ->> 'profissional_id' = 'd2600000-0000-4000-8000-000000000001' and x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000101'),
  126667, 'pagamento já pago não é recalculado');
select testes.encerrar();
update profissional set valor_hora_centavos = null where id = 'd2600000-0000-4000-8000-000000000001';

-- sem valor da hora (nem da profissional, nem no parâmetro) o pagamento não é inventado: fica bloqueado
insert into familia (id, nome_exibicao, regiao_id) values ('c2600000-0000-4000-8000-000000000131', 'Família Teste SemValor P46', 'b2600000-0000-4000-8000-000000000004');
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao) values
  ('c2600000-0000-4000-8000-000000000231', 'c2600000-0000-4000-8000-000000000131', 'b2600000-0000-4000-8000-000000000022', 420000, 'teste');
insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, estado) values
  ('d2600000-0000-4000-8000-000000000102', 'c2600000-0000-4000-8000-000000000231', 'c2600000-0000-4000-8000-000000000131', 6, 3, 'em_execucao');
insert into visita (acompanhamento_id, profissional_id, dia_numero, data, estado)
values ('d2600000-0000-4000-8000-000000000102', 'd2600000-0000-4000-8000-000000000005', 1, '2026-05-12', 'concluida');
update parametro set valor = '{"dias_por_ajuda":6}' where chave = 'pagamento_equipe';
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select results_eq(
  $$ select x ->> 'status', x ->> 'motivo_bloqueio', (x ->> 'total_centavos')::integer
     from jsonb_array_elements(api.pagamentos_equipe('2026-05-01') -> 'pagamentos') x
     where x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000102' $$,
  $$ values ('bloqueado'::text, 'sem_valor_hora'::text, 0) $$,
  'sem valor da hora o pagamento fica bloqueado com o motivo, sem valor inventado');
select testes.encerrar();
update parametro set valor = '{"valor_hora_padrao_centavos":10000,"dias_por_ajuda":6}' where chave = 'pagamento_equipe';

-- a enfermeira vê só os próprios pagamentos, sem nome de família
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000006', 'aal2');
create temp table t_meus_p on commit drop as select api.meus_pagamentos() as r;
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000007', 'aal2');
create temp table t_meus_b on commit drop as select api.meus_pagamentos() as r;
select testes.encerrar();
select is((select count(*)::integer from t_meus_p, jsonb_array_elements(r -> 'pagamentos') x where x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000101'), 1,
  'a enfermeira A1 vê o próprio pagamento');
select is((select count(*)::integer from t_meus_b, jsonb_array_elements(r -> 'pagamentos') x where x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000101'), 1,
  'a enfermeira A2 vê o dela');
select ok((select bool_and(x ->> 'profissional_id' = 'd2600000-0000-4000-8000-000000000001') from t_meus_p, jsonb_array_elements(r -> 'pagamentos') x),
  'e nenhum pagamento de outra profissional');
select ok((select r::text not like '%Família Teste%' from t_meus_p), 'sem o nome da família');
select ok((select (x ->> 'total_centavos')::integer = 126667 and x ->> 'status' = 'pago' from t_meus_p, jsonb_array_elements(r -> 'pagamentos') x
            where x ->> 'acompanhamento_id' = 'd2600000-0000-4000-8000-000000000101'), 'com o valor e a situação dela');

-- o DRE de maio depois do pagamento da equipe
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000002', 'aal2');
create temp table t_dre2 on commit drop as select api.dre('2026-05-31') as r, api.lancamentos('2026-05-31') as l;
select testes.encerrar();
select results_eq(
  $$ select (r ->> 'despesas_centavos')::bigint, (r ->> 'resultado_centavos')::bigint, (r ->> 'margem_pct')::numeric from t_dre2 $$,
  $$ values (377667::bigint, 837333::bigint, 68.9::numeric) $$,
  'DRE de maio com o pagamento da equipe: despesas 3.776,67, resultado 8.373,33, margem 68,9%');
select ok((select (r ->> 'resultado_centavos')::bigint = (l ->> 'saldo_centavos')::bigint
              and (r ->> 'despesas_centavos')::bigint = (l ->> 'despesas_centavos')::bigint from t_dre2),
  'e o DRE segue fechando com os lançamentos');

-- -----------------------------------------------------------------------------
-- Extrato do banco: confere, nunca dá baixa
-- -----------------------------------------------------------------------------

select set_config('t.hoje', privado.hoje_sp()::text, true);
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
create temp table t_ext on commit drop as
  select api.importar_extrato(repeat('a', 64), 'csv', jsonb_build_array(
    jsonb_build_object('data', '2026-05-10', 'valor_centavos', 435000, 'descricao', 'PIX RECEBIDO SINTETICO', 'documento', 'doc-1'),
    jsonb_build_object('data', current_setting('t.hoje')::date - 5, 'valor_centavos', 200000, 'descricao', 'PIX SINTETICO DOIS'),
    jsonb_build_object('data', '2026-05-25', 'valor_centavos', -126667, 'descricao', 'PAGAMENTO EQUIPE SINTETICO'),
    jsonb_build_object('data', '2026-05-05', 'valor_centavos', -150000, 'descricao', 'ANUNCIOS SINTETICO'),
    jsonb_build_object('data', '2026-05-07', 'valor_centavos', 123, 'descricao', 'SEM PAR SINTETICO'))) as r;
select testes.encerrar();
select results_eq(
  $$ select (r -> 'conferencia' ->> 'conferidas')::integer, (r -> 'conferencia' ->> 'sugeridas')::integer, (r -> 'conferencia' ->> 'sem_correspondencia')::integer,
            (r ->> 'linhas_novas')::integer, (r ->> 'ja_importado')::boolean from t_ext $$,
  $$ values (3, 1, 1, 5, false) $$,
  'três linhas conferidas (uma cobrança paga e duas despesas), uma sugerida e uma sem par');
select results_eq(
  $$ select l.situacao::text, l.cobranca_id, l.despesa_id from privado.extrato_linha l
     where l.importacao_id = (select (r ->> 'importacao_id')::uuid from t_ext) and l.valor_centavos = 435000 $$,
  $$ values ('conferida'::text, 'c2600000-0000-4000-8000-000000000301'::uuid, null::uuid) $$,
  'o crédito de 4.350 casa com a cobrança paga do mesmo valor');
select results_eq(
  $$ select l.situacao::text, l.cobranca_id from privado.extrato_linha l
     where l.importacao_id = (select (r ->> 'importacao_id')::uuid from t_ext) and l.valor_centavos = 200000 $$,
  $$ values ('sugerida'::text, 'c2600000-0000-4000-8000-000000000311'::uuid) $$,
  'o crédito de 2.000 só sugere a cobrança em aberto');
select results_eq(
  $$ select status::text, pago_em is null, valor_pago_centavos is null from cobranca where id = 'c2600000-0000-4000-8000-000000000311' $$,
  $$ values ('aberta'::text, true, true) $$,
  'o extrato nunca dá baixa: a cobrança sugerida segue aberta, sem pagamento (D-07)');
select is((select count(*)::integer from privado.extrato_linha l join privado.despesa d on d.id = l.despesa_id
            where l.importacao_id = (select (r ->> 'importacao_id')::uuid from t_ext) and l.situacao = 'conferida' and d.categoria in ('equipe_assistencial', 'marketing_anuncios')), 2,
  'os débitos casam com a despesa do pagamento da equipe e com a de anúncios');
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select results_eq(
  $$ select (api.importar_extrato(repeat('a', 64), 'csv', '[{"data":"2026-05-10","valor_centavos":1,"descricao":"x"}]'::jsonb) ->> 'ja_importado')::boolean $$,
  $$ values (true) $$, 'importar o mesmo arquivo de novo (mesmo sha256) não duplica nada');
select testes.encerrar();
select is((select count(*)::integer from privado.extrato_linha where importacao_id = (select (r ->> 'importacao_id')::uuid from t_ext)), 5, 'continuam cinco linhas');

-- outro arquivo com uma linha que já veio e uma nova: só a nova entra
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
create temp table t_ext2 on commit drop as
  select api.importar_extrato(repeat('b', 64), 'ofx', jsonb_build_array(
    jsonb_build_object('data', '2026-05-07', 'valor_centavos', 123, 'descricao', 'SEM PAR SINTETICO'),
    jsonb_build_object('data', '2026-05-08', 'valor_centavos', -777, 'descricao', 'TARIFA SINTETICA'))) as r;
select testes.encerrar();
select is((select (r ->> 'linhas_novas')::integer from t_ext2), 1, 'linha repetida em outro arquivo não duplica; só a nova entra');

-- depois da baixa manual pela tela de cobranças, a conferência fecha o par
update cobranca set status = 'paga', valor_pago_centavos = 200000,
       pago_em = ((privado.hoje_sp() - 5)::timestamp + interval '15 hours') at time zone 'America/Sao_Paulo'
 where id = 'c2600000-0000-4000-8000-000000000311';
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
create temp table t_ext3 on commit drop as select api.reconciliar_extrato((select (r ->> 'importacao_id')::uuid from t_ext)) as r;
select testes.encerrar();
select is((select (r ->> 'conferidas')::integer from t_ext3), 1, 'reconferir depois da baixa manual: a linha sugerida vira conferida');
select is((select situacao::text from privado.extrato_linha where importacao_id = (select (r ->> 'importacao_id')::uuid from t_ext) and valor_centavos = 200000),
  'conferida', 'e fica conferida com a cobrança já paga');

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select throws_like($$ select api.importar_extrato('curto', 'csv', '[]'::jsonb) $$, '%gestao:arquivo_invalido%', 'hash inválido é recusado');
select throws_like($$ select api.importar_extrato(repeat('c', 64), 'pdf', '[]'::jsonb) $$, '%gestao:formato_invalido%', 'formato fora de ofx e csv é recusado');
select throws_like($$ select api.importar_extrato(repeat('c', 64), 'csv', '[]'::jsonb) $$, '%gestao:extrato_vazio%', 'extrato vazio é recusado');
select throws_like($$ select api.importar_extrato(repeat('c', 64), 'csv', '[{"data":"amanhã","valor_centavos":1,"descricao":"x"}]'::jsonb) $$, '%gestao:linha_invalida 1%',
  'linha com data inválida é recusada, com o número da linha');
select is(jsonb_array_length(api.extrato() -> 'importacoes'), 2, 'a lista mostra as duas importações, cada uma com as contagens por situação');
select is(jsonb_array_length(api.extrato((select (r ->> 'importacao_id')::uuid from t_ext)) -> 'linhas'), 5, 'as linhas de uma importação vêm com o par conferido');
select testes.encerrar();

-- =============================================================================
-- P52 · Painel executivo: cada número contra a consulta da tabela de origem
--
-- @indicadores: comercial.leads comercial.sessoes_realizadas comercial.contratos_assinados comercial.conversao_pct comercial.faturamento_centavos comercial.ticket_medio_centavos marketing.leads_por_origem marketing.custo_por_canal marketing.custo_total_centavos marketing.receita_por_origem marketing.receita_por_campanha operacao.familias_ativas operacao.familias_iniciadas operacao.visitas_realizadas operacao.ocorrencias_abertas operacao.capacidade_semanas operacao.capacidade operacao.semanas_em_sobrevenda operacao.semanas_em_atencao experiencia.respostas experiencia.promotores experiencia.detratores experiencia.amostra_minima experiencia.nps experiencia.indicacoes experiencia.depoimentos financeiro.recebimentos_centavos financeiro.custos_centavos financeiro.resultado_centavos financeiro.margem_pct financeiro.inadimplencia_pct financeiro.vencido_centavos financeiro.previsao_a_vencer_centavos financeiro.previsao_atrasadas_centavos financeiro.faturamento_centavos
-- =============================================================================

-- Sessões de venda: duas realizadas em maio, uma em junho, uma só agendada
insert into sessao_venda (familia_id, status, realizada_em, agendada_para) values
  ('c2600000-0000-4000-8000-000000000101', 'realizada', '2026-05-09 14:00+00', '2026-05-09 14:00+00'),
  ('c2600000-0000-4000-8000-000000000102', 'realizada', '2026-05-20 14:00+00', '2026-05-20 14:00+00'),
  ('c2600000-0000-4000-8000-000000000103', 'realizada', '2026-06-03 14:00+00', '2026-06-03 14:00+00'),
  ('c2600000-0000-4000-8000-000000000104', 'agendada', null, '2026-05-22 14:00+00');

-- Acompanhamentos e pesquisa: sete famílias criadas em abril (fora dos leads de maio)
create function pg_temp.nova_acomp(p_n integer, p_estado text, p_inicio date) returns uuid language plpgsql as $$
declare
  v_f uuid := ('c2600000-0000-4000-8000-0000000004' || lpad(p_n::text, 2, '0'))::uuid;
begin
  insert into familia (id, nome_exibicao, regiao_id, origem, criado_em)
  values (v_f, 'Família Teste Pesquisa ' || p_n || ' P52', 'b2600000-0000-4000-8000-000000000004', 'site', '2026-04-10 12:00+00');
  insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao)
  values (v_f, v_f, 'b2600000-0000-4000-8000-000000000022', 420000, 'teste');
  insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, estado, inicio_efetivo)
  values (v_f, v_f, v_f, 6, 3, p_estado::estado_acompanhamento, p_inicio);
  return v_f;
end;
$$;
select pg_temp.nova_acomp(1, 'em_execucao', '2026-05-06');
select pg_temp.nova_acomp(2, 'em_execucao', '2026-05-13');
select pg_temp.nova_acomp(3, 'em_execucao', '2026-04-20');
select pg_temp.nova_acomp(4, 'ativo', null);
select pg_temp.nova_acomp(5, 'encerrado', '2026-04-01');
select pg_temp.nova_acomp(6, 'encerrado', '2026-04-02');
select pg_temp.nova_acomp(7, 'encerrado', '2026-04-03');

-- seis respostas em maio (4 promotores, 1 neutro, 1 detrator) e uma em junho
insert into pos_venda (acompanhamento_id, estagio, pesquisa_respondida_em, nps, classificacao, depoimento_autorizado) values
  ('c2600000-0000-4000-8000-000000000401', 'classificado', '2026-05-21 12:00+00', 10, 'promotor', true),
  ('c2600000-0000-4000-8000-000000000402', 'classificado', '2026-05-22 12:00+00', 10, 'promotor', true),
  ('c2600000-0000-4000-8000-000000000403', 'classificado', '2026-05-23 12:00+00', 9, 'promotor', false),
  ('c2600000-0000-4000-8000-000000000404', 'classificado', '2026-05-24 12:00+00', 9, 'promotor', null),
  ('c2600000-0000-4000-8000-000000000405', 'classificado', '2026-05-25 12:00+00', 8, 'neutro', false),
  ('c2600000-0000-4000-8000-000000000406', 'classificado', '2026-05-26 12:00+00', 3, 'detrator', false),
  ('c2600000-0000-4000-8000-000000000407', 'classificado', '2026-06-04 12:00+00', 10, 'promotor', true);

-- ocorrências abertas (duas) e uma resolvida
insert into ocorrencia (tipo, prioridade, titulo, descricao, status) values
  ('experiencia', 'normal', 'Ocorrência sintética 1', 'Descrição sintética', 'aberta'),
  ('reclamacao', 'alta', 'Ocorrência sintética 2', 'Descrição sintética', 'triagem'),
  ('outro', 'normal', 'Ocorrência sintética 3', 'Descrição sintética', 'resolvida');

-- Visitas de maio: as seis do acompanhamento da equipe (P46) já estão em 2026-05-11 a 16

select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000002', 'aal2');
create temp table t_painel on commit drop as select api.painel_executivo('2026-05-14') as r;
create temp table t_painel_dre on commit drop as select api.dre('2026-05-14') as r;
create temp table t_painel_inad on commit drop as select api.inadimplencia() as r, api.previsao_recebimentos() as p;
select testes.encerrar();

-- os números de cada pergunta batem com a consulta da tabela de origem (escrita à parte)
select is((select (r -> 'comercial' ->> 'leads')::integer from t_painel),
  (select count(*)::integer from familia f where f.mesclada_em_id is null and f.criado_em >= '2026-05-01 03:00+00' and f.criado_em < '2026-06-01 03:00+00'),
  'leads: famílias criadas no mês (fuso de São Paulo), sem as mescladas');
select is((select (r -> 'comercial' ->> 'leads')::integer from t_painel), 5, 'e no cenário são cinco (a de abril e a mesclada ficam fora)');
select is((select (r -> 'comercial' ->> 'sessoes_realizadas')::integer from t_painel),
  (select count(*)::integer from sessao_venda where status = 'realizada' and realizada_em >= '2026-05-01 03:00+00' and realizada_em < '2026-06-01 03:00+00'),
  'sessões realizadas no mês');
select is((select (r -> 'comercial' ->> 'sessoes_realizadas')::integer from t_painel), 2, 'no cenário, duas');
select is((select (r -> 'comercial' ->> 'contratos_assinados')::integer from t_painel),
  (select count(*)::integer from contrato where status = 'assinado' and assinado_em >= '2026-05-01 03:00+00' and assinado_em < '2026-06-01 03:00+00'),
  'contratos assinados no mês');
select is((select (r -> 'comercial' ->> 'contratos_assinados')::integer from t_painel), 3, 'no cenário, três (a de junho e o rascunho ficam fora)');
select is((select (r -> 'comercial' ->> 'faturamento_centavos')::bigint from t_painel),
  (select coalesce(sum(valor_centavos - desconto_centavos + taxa_deslocamento_centavos), 0)::bigint from contrato
    where status = 'assinado' and assinado_em >= '2026-05-01 03:00+00' and assinado_em < '2026-06-01 03:00+00'),
  'faturamento: valor menos desconto mais taxa dos contratos assinados no mês');
select is((select (r -> 'comercial' ->> 'faturamento_centavos')::bigint from t_painel), 1735000::bigint, 'no cenário, R$ 17.350,00');
select is((select (r -> 'comercial' ->> 'ticket_medio_centavos')::bigint from t_painel), 578333::bigint, 'ticket médio: faturamento sobre contratos');
select is((select (r -> 'comercial' ->> 'conversao_pct')::numeric from t_painel), 60.0::numeric, 'conversão: 3 contratos sobre 5 leads');

select results_eq(
  $$ select x ->> 'origem', (x ->> 'leads')::integer from t_painel, jsonb_array_elements(r -> 'marketing' -> 'leads_por_origem') x
     order by (x ->> 'leads')::integer desc, x ->> 'origem' $$,
  $$ select f.origem::text, count(*)::integer from familia f
     where f.mesclada_em_id is null and f.criado_em >= '2026-05-01 03:00+00' and f.criado_em < '2026-06-01 03:00+00'
     group by f.origem order by 2 desc, 1 $$,
  'leads por origem batem com a tabela de famílias');
select results_eq(
  $$ select x ->> 'canal', (x ->> 'centavos')::bigint from t_painel, jsonb_array_elements(r -> 'marketing' -> 'custo_por_canal') x
     order by (x ->> 'centavos')::bigint desc $$,
  $$ values ('meta_ads'::text, 150000::bigint), (null, 20000) $$,
  'custo por canal: anúncios com canal e o impulsionamento sem canal (nulo), só marketing e anúncios do mês');
select is((select (r -> 'marketing' ->> 'custo_total_centavos')::bigint from t_painel), 170000::bigint, 'custo total de marketing do mês');
select results_eq(
  $$ select x ->> 'origem', (x ->> 'centavos')::bigint from t_painel, jsonb_array_elements(r -> 'marketing' -> 'receita_por_origem') x order by 2 desc $$,
  $$ values ('instagram_organico'::text, 780000::bigint), ('meta_ads', 435000) $$,
  'receita por origem: cobranças pagas no mês, por origem da família (o estorno e junho ficam fora)');
select results_eq(
  $$ select x ->> 'campanha', (x ->> 'centavos')::bigint from t_painel, jsonb_array_elements(r -> 'marketing' -> 'receita_por_campanha') x $$,
  $$ values ('wa-teste-01'::text, 435000::bigint) $$,
  'receita por campanha: pelo código de origem do link');

select is((select (r -> 'operacao' ->> 'familias_ativas')::integer from t_painel),
  (select count(distinct familia_id)::integer from acompanhamento where estado in ('ativo', 'em_execucao', 'ultima_visita_realizada', 'pendencias')),
  'famílias ativas: acompanhamentos em atendimento agora');
select is((select (r -> 'operacao' ->> 'familias_iniciadas')::integer from t_painel),
  (select count(distinct familia_id)::integer from acompanhamento where inicio_efetivo >= '2026-05-01' and inicio_efetivo < '2026-06-01'),
  'famílias que iniciaram no mês');
select is((select (r -> 'operacao' ->> 'familias_iniciadas')::integer from t_painel), 2, 'no cenário, duas');
select is((select (r -> 'operacao' ->> 'visitas_realizadas')::integer from t_painel),
  (select count(*)::integer from visita where estado in ('concluida', 'ficha_pendente', 'ficha_entregue', 'encerrada') and data >= '2026-05-01' and data < '2026-06-01'),
  'visitas realizadas no mês');
select ok((select (r -> 'operacao' ->> 'visitas_realizadas')::integer >= 7 from t_painel), 'no cenário, as seis da equipe e a da pesquisa');
select is((select (r -> 'operacao' ->> 'ocorrencias_abertas')::integer from t_painel),
  (select count(*)::integer from ocorrencia where status not in ('resolvida', 'encerrada')), 'ocorrências abertas');
select is((select (r -> 'operacao' ->> 'ocorrencias_abertas')::integer from t_painel), 2, 'no cenário, duas');
select is((select (r -> 'operacao' ->> 'capacidade_semanas')::integer from t_painel), 8, 'capacidade das próximas oito semanas');
select is((select jsonb_array_length(r -> 'operacao' -> 'capacidade') from t_painel),
  (select count(*)::integer from privado.capacidade_semanal(date_trunc('week', privado.hoje_sp())::date, date_trunc('week', privado.hoje_sp())::date + 55)),
  'a capacidade do painel tem as mesmas linhas da função de capacidade');
select is((select (r -> 'operacao' ->> 'semanas_em_sobrevenda')::integer from t_painel),
  (select count(*)::integer from privado.capacidade_semanal(date_trunc('week', privado.hoje_sp())::date, date_trunc('week', privado.hoje_sp())::date + 55) where nivel = 'sobrevenda'),
  'semanas em sobrevenda: as mesmas da tela de capacidade');
select ok((select (r -> 'operacao' ->> 'semanas_em_sobrevenda')::integer >= 1 from t_painel), 'e no cenário (três famílias na mesma DPP num limite de uma) há sobrevenda');

select results_eq(
  $$ select (r -> 'experiencia' ->> 'respostas')::integer, (r -> 'experiencia' ->> 'promotores')::integer, (r -> 'experiencia' ->> 'detratores')::integer,
            (r -> 'experiencia' ->> 'nps')::integer from t_painel $$,
  $$ select count(*)::integer, count(*) filter (where classificacao = 'promotor')::integer, count(*) filter (where classificacao = 'detrator')::integer,
            round(100.0 * (count(*) filter (where classificacao = 'promotor') - count(*) filter (where classificacao = 'detrator')) / count(*))::integer
     from pos_venda where nps is not null and pesquisa_respondida_em >= '2026-05-01 03:00+00' and pesquisa_respondida_em < '2026-06-01 03:00+00' $$,
  'NPS: promotores menos detratores sobre as respostas do mês');
select is((select (r -> 'experiencia' ->> 'nps')::integer from t_painel), 50, 'no cenário, NPS 50 (4 promotores, 1 detrator, 6 respostas)');
select is((select (r -> 'experiencia' ->> 'indicacoes')::integer from t_painel), 2, 'indicações: as duas famílias que chegaram por indicação no mês');
select is((select (r -> 'experiencia' ->> 'depoimentos')::integer from t_painel), 2, 'depoimentos autorizados no mês (o de junho fica fora)');

select is((select (r -> 'financeiro' ->> 'recebimentos_centavos')::bigint from t_painel), (select (r ->> 'receita_centavos')::bigint from t_painel_dre),
  'recebimentos do painel = receita do DRE');
select is((select (r -> 'financeiro' ->> 'custos_centavos')::bigint from t_painel), (select (r ->> 'despesas_centavos')::bigint from t_painel_dre), 'custos = despesas do DRE');
select is((select (r -> 'financeiro' ->> 'resultado_centavos')::bigint from t_painel), (select (r ->> 'resultado_centavos')::bigint from t_painel_dre), 'resultado = resultado do DRE');
select is((select (r -> 'financeiro' ->> 'margem_pct')::numeric from t_painel), (select (r ->> 'margem_pct')::numeric from t_painel_dre), 'margem = margem do DRE');
select is((select (r -> 'financeiro' ->> 'inadimplencia_pct')::numeric from t_painel), (select (r ->> 'taxa_pct')::numeric from t_painel_inad),
  'inadimplência = taxa da tela de inadimplência');
select is((select (r -> 'financeiro' ->> 'vencido_centavos')::bigint from t_painel), (select (r ->> 'vencido_centavos')::bigint from t_painel_inad), 'vencido = vencido da tela');
select is((select (r -> 'financeiro' ->> 'previsao_a_vencer_centavos')::bigint from t_painel), (select (p ->> 'a_vencer_centavos')::bigint from t_painel_inad),
  'previsão = previsão de recebimentos');
select is((select (r -> 'financeiro' ->> 'previsao_atrasadas_centavos')::bigint from t_painel), (select (p ->> 'atrasadas_centavos')::bigint from t_painel_inad),
  'atrasadas = atrasadas da previsão');
select is((select (r -> 'financeiro' ->> 'faturamento_centavos')::bigint from t_painel), (select (r -> 'comercial' ->> 'faturamento_centavos')::bigint from t_painel),
  'faturamento do financeiro = faturamento do comercial');

-- metas, progresso e congelamento
select results_eq(
  $$ select (r -> 'metas' ->> 'contratos_mes')::integer, (r -> 'metas' ->> 'familias_mes')::integer, (r -> 'metas' ->> 'faturamento_mes_centavos')::bigint,
            (r -> 'metas' ->> 'nps')::integer from t_painel $$,
  $$ values (18, 18, 7560000::bigint, 90) $$, 'metas da Kraamzorg: 18 contratos, 18 famílias, R$ 75.600 e NPS 90');
select results_eq(
  $$ select (r -> 'progresso' ->> 'contratos')::integer, (r -> 'progresso' ->> 'familias')::integer, (r -> 'progresso' ->> 'faturamento_centavos')::bigint,
            (r -> 'progresso' ->> 'nps')::integer from t_painel $$,
  $$ values (3, 2, 1735000::bigint, 50) $$, 'o progresso repete os números do painel');
select results_eq(
  $$ select r -> 'congelamento' ->> 'data', r -> 'congelamento' ->> 'tag', (r -> 'congelamento' ->> 'dias_restantes')::integer from t_painel $$,
  $$ values ('2026-11-13'::text, 'v1.0.0-rc.1'::text, (date '2026-11-13' - privado.hoje_sp())) $$,
  'congelamento do desenvolvimento em 13/11 com a tag da versão candidata e os dias que faltam');

-- toda chave do painel é um indicador documentado: a lista da linha "@indicadores" acima
select is((select array_agg(s.secao || '.' || k order by s.secao || '.' || k)
             from (select 'comercial' as secao, r -> 'comercial' as o from t_painel
                   union all select 'marketing', r -> 'marketing' from t_painel
                   union all select 'operacao', r -> 'operacao' from t_painel
                   union all select 'experiencia', r -> 'experiencia' from t_painel
                   union all select 'financeiro', r -> 'financeiro' from t_painel) s,
                  jsonb_object_keys(s.o) k),
  (select array_agg(i order by i) from unnest(array['comercial.leads', 'comercial.sessoes_realizadas', 'comercial.contratos_assinados', 'comercial.conversao_pct',
        'comercial.faturamento_centavos', 'comercial.ticket_medio_centavos', 'marketing.leads_por_origem', 'marketing.custo_por_canal',
        'marketing.custo_total_centavos', 'marketing.receita_por_origem', 'marketing.receita_por_campanha', 'operacao.familias_ativas',
        'operacao.familias_iniciadas', 'operacao.visitas_realizadas', 'operacao.ocorrencias_abertas', 'operacao.capacidade_semanas',
        'operacao.capacidade', 'operacao.semanas_em_sobrevenda', 'operacao.semanas_em_atencao', 'experiencia.respostas',
        'experiencia.promotores', 'experiencia.detratores', 'experiencia.amostra_minima', 'experiencia.nps', 'experiencia.indicacoes',
        'experiencia.depoimentos', 'financeiro.recebimentos_centavos', 'financeiro.custos_centavos', 'financeiro.resultado_centavos',
        'financeiro.margem_pct', 'financeiro.inadimplencia_pct', 'financeiro.vencido_centavos', 'financeiro.previsao_a_vencer_centavos',
        'financeiro.previsao_atrasadas_centavos', 'financeiro.faturamento_centavos']::text[]) i),
  'o painel devolve exatamente os 35 indicadores documentados, nem um a mais nem um a menos');

-- NPS sem amostra mínima não vira número
update pos_venda set pesquisa_respondida_em = '2026-04-27 12:00+00'
 where acompanhamento_id in ('c2600000-0000-4000-8000-000000000404', 'c2600000-0000-4000-8000-000000000405', 'c2600000-0000-4000-8000-000000000406');
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000002', 'aal2');
select is((api.painel_executivo('2026-05-14') -> 'experiencia' ->> 'nps'), null, 'com menos respostas que o mínimo do parâmetro, o NPS não é calculado');
select is((api.painel_executivo('2026-05-14') -> 'experiencia' ->> 'respostas')::integer, 3, 'mas as respostas são contadas');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- Segurança: papel e AAL em cada função, tabelas sem grant, anônimo
-- -----------------------------------------------------------------------------

create temp table t_chamadas (papel_ok text[] not null, sql text not null, nome text not null);
insert into t_chamadas values
  (array['coordenacao', 'diretoria'], $$ select api.capacidade() $$, 'api.capacidade'),
  (array['financeiro', 'diretoria'], $$ select api.pagamentos_equipe() $$, 'api.pagamentos_equipe'),
  (array['financeiro', 'diretoria'], $$ select api.pagar_equipe('c2600000-0000-4000-8000-0000000009ff') $$, 'api.pagar_equipe'),
  (array['enfermeira'], $$ select api.meus_pagamentos() $$, 'api.meus_pagamentos'),
  (array['financeiro', 'diretoria'], $$ select api.dre() $$, 'api.dre'),
  (array['financeiro', 'diretoria'], $$ select api.lancamentos() $$, 'api.lancamentos'),
  (array['financeiro', 'diretoria'], $$ select api.despesas() $$, 'api.despesas'),
  (array['financeiro', 'diretoria'], $$ select api.salvar_despesa(null, '2026-05-01', 'outros', 'Teste', null, 100) $$, 'api.salvar_despesa'),
  (array['financeiro', 'diretoria'], $$ select api.remover_despesa('c2600000-0000-4000-8000-0000000009ff', 'Motivo de teste longo') $$, 'api.remover_despesa'),
  (array['financeiro', 'diretoria'], $$ select api.inadimplencia() $$, 'api.inadimplencia'),
  (array['financeiro', 'diretoria'], $$ select api.previsao_recebimentos() $$, 'api.previsao_recebimentos'),
  (array['financeiro', 'diretoria'], $$ select api.importar_extrato(repeat('d', 64), 'csv', '[]'::jsonb) $$, 'api.importar_extrato'),
  (array['financeiro', 'diretoria'], $$ select api.reconciliar_extrato() $$, 'api.reconciliar_extrato'),
  (array['financeiro', 'diretoria'], $$ select api.extrato() $$, 'api.extrato'),
  (array['diretoria'], $$ select api.painel_executivo() $$, 'api.painel_executivo');
grant select on t_chamadas to authenticated;

create temp table t_papeis (papel text primary key, usuario uuid not null);
insert into t_papeis values
  ('comercial', 'a2600000-0000-4000-8000-000000000004'), ('marketing', 'a2600000-0000-4000-8000-000000000005'),
  ('enfermeira', 'a2600000-0000-4000-8000-000000000006'), ('financeiro', 'a2600000-0000-4000-8000-000000000001'),
  ('coordenacao', 'a2600000-0000-4000-8000-000000000003'), ('diretoria', 'a2600000-0000-4000-8000-000000000002');
grant select on t_papeis to authenticated;

-- quem não tem o papel é recusado com 42501 em AAL2
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000004', 'aal2');
select throws_ok(c.sql, '42501', null, 'comercial não executa ' || c.nome) from t_chamadas c order by c.nome;
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000005', 'aal2');
select throws_ok(c.sql, '42501', null, 'marketing não executa ' || c.nome) from t_chamadas c order by c.nome;
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000006', 'aal2');
select throws_ok(c.sql, '42501', null, 'enfermeira não executa ' || c.nome) from t_chamadas c where not ('enfermeira' = any (c.papel_ok)) order by c.nome;
select lives_ok($$ select api.meus_pagamentos() $$, 'a enfermeira executa api.meus_pagamentos');
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(c.sql, '42501', null, 'financeiro não executa ' || c.nome) from t_chamadas c where not ('financeiro' = any (c.papel_ok)) order by c.nome;
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000003', 'aal2');
select throws_ok(c.sql, '42501', null, 'coordenação não executa ' || c.nome) from t_chamadas c where not ('coordenacao' = any (c.papel_ok)) order by c.nome;
-- quem tem o papel, mas só passou pela senha (AAL1), também é recusado
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal1');
select throws_ok(c.sql, '42501', null, 'financeiro em AAL1 não executa ' || c.nome) from t_chamadas c where 'financeiro' = any (c.papel_ok) order by c.nome;
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000003', 'aal1');
select throws_ok(c.sql, '42501', null, 'coordenação em AAL1 não executa api.capacidade') from t_chamadas c where c.nome = 'api.capacidade';
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000002', 'aal1');
select throws_ok(c.sql, '42501', null, 'diretoria em AAL1 não executa ' || c.nome) from t_chamadas c order by c.nome;
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$ select api.meus_pagamentos() $$, '42501', null, 'enfermeira em AAL1 não vê os pagamentos');
select testes.encerrar();

-- o painel é só da diretoria: nem coordenação nem financeiro
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$ select api.painel_executivo() $$, '42501', null, 'a coordenação não abre o painel executivo');
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ select api.painel_executivo() $$, '42501', null, 'o financeiro não abre o painel executivo');
select testes.encerrar();

-- tabelas do financeiro: nenhum grant, nem leitura direta
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ select * from privado.despesa $$, '42501', null, 'financeiro não lê privado.despesa direto');
select throws_ok($$ select * from privado.extrato_linha $$, '42501', null, 'nem privado.extrato_linha');
select throws_ok($$ insert into privado.despesa (data, categoria, descricao, valor_centavos) values ('2026-05-01', 'outros', 'x', 1) $$, '42501', null,
  'nem grava despesa direto (o valor passa pelas validações da função)');
select throws_ok($$ update privado.pagamento_equipe set status = 'liberado' $$, '42501', null, 'nem libera pagamento da equipe direto');
select testes.autenticar_authenticated('a2600000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select * from privado.extrato_importacao $$, '42501', null, 'a diretoria também usa as funções, não a tabela');
select testes.encerrar();

select ok((select bool_and(not has_table_privilege(r, t, 'select, insert, update, delete') and not has_table_privilege(r, t, 'truncate'))
            from (values ('anon'), ('authenticated'), ('service_role')) x(r),
                 (values ('privado.despesa'), ('privado.pagamento_equipe'), ('privado.extrato_importacao'), ('privado.extrato_linha')) y(t)),
  'anon, authenticated e service_role sem nenhum privilégio nas quatro tabelas do financeiro');
select ok((select bool_and(c.relrowsecurity) from pg_class c
            where c.oid in ('privado.despesa'::regclass, 'privado.pagamento_equipe'::regclass, 'privado.extrato_importacao'::regclass, 'privado.extrato_linha'::regclass)),
  'RLS ligada nas quatro tabelas');
select is((select count(*)::integer from pg_trigger g where not g.tgisinternal and g.tgname = 'auditar'
            and g.tgrelid in ('privado.despesa'::regclass, 'privado.pagamento_equipe'::regclass, 'privado.extrato_importacao'::regclass, 'privado.extrato_linha'::regclass)),
  4, 'o gatilho de auditoria está nas quatro tabelas');

-- execute: só authenticated nas funções de api; nada em anon nem service_role; internas sem nenhum grant
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'api' and p.proname in ('capacidade', 'pagamentos_equipe', 'pagar_equipe', 'meus_pagamentos', 'dre', 'lancamentos', 'despesas',
        'salvar_despesa', 'remover_despesa', 'inadimplencia', 'previsao_recebimentos', 'importar_extrato', 'reconciliar_extrato', 'extrato', 'painel_executivo')
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute')
            or not has_function_privilege('authenticated', p.oid, 'execute')) $$,
  'as 15 funções de api da gestão: execute só para authenticated');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'privado' and p.proname in ('capacidade_modelo', 'distribuicao_nascimento', 'distribuicao_nascimento_info', 'capacidade_cenarios',
        'poisson_binomial', 'parametro_numero', 'capacidade_semanal', 'gestao_recusar', 'hoje_sp', 'inicio_do_mes', 'evolucoes_enviadas',
        'pagamento_equipe_sincronizar', 'pagamento_equipe_json', 'receita_periodo', 'dre_mes', 'previsao_recebimentos', 'extrato_conciliar',
        'inadimplencia_resumo', 'painel_comercial', 'painel_marketing', 'painel_operacao', 'painel_experiencia', 'painel_financeiro',
        'disponibilidade', 'recalculo_ocupacao')
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'as funções internas da gestão em privado não têm execute para os papéis da aplicação');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('api', 'privado') and p.prosecdef and not coalesce(p.proconfig, '{}') @> array['search_path=""']
       and p.proname in ('capacidade', 'pagamentos_equipe', 'pagar_equipe', 'meus_pagamentos', 'dre', 'lancamentos', 'despesas', 'salvar_despesa',
                         'remover_despesa', 'inadimplencia', 'previsao_recebimentos', 'importar_extrato', 'reconciliar_extrato', 'extrato',
                         'painel_executivo', 'disponibilidade') $$,
  'toda função security definer da gestão tem search_path vazio');
select testes.autenticar_anon();
select throws_ok($$ select api.painel_executivo() $$, '42501', null, 'o anônimo não executa o painel');
select throws_ok($$ select api.dre() $$, '42501', null, 'nem o DRE');
select testes.encerrar();

select * from finish();
rollback;
