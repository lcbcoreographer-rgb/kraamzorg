-- =============================================================================
-- supabase/tests/011_ocupacao.sql
--
-- Aceite do P19 (PROMPTS.md v2), parte de banco: "pgTAP com cenário
-- sintético de São Paulo confere os percentuais; cron registrado".
--
--   1. public.ocupacao_projetada: cenário de São Paulo (e um de Londrina)
--      com início conhecido, início pela alta, janela uniforme da DPP,
--      janela a partir do nascimento, e os contratos que não contam
--      (cancelado, acompanhamento encerrado, família mesclada). Percentuais
--      conferidos à mão.
--   2. privado.disponibilidade: disponível abaixo do limite de alerta,
--      confirmar_com_equipe na semana cheia e sempre que falta dado.
--   3. privado.recalculo_diario: etapas na ordem do PRD 10.2, vazias para o
--      que ainda não existe, erro isolado numa etapa, resultado gravado; job
--      do pg_cron às 10:00 UTC. [P20] regua_nutricao e alerta_34s passam a
--      'ok' assim que 0012_automacoes.sql cria privado.recalculo_regua_nutricao
--      e privado.recalculo_alerta_34s: privado.recalculo_diario (0011) já
--      procura essas funções pelo nome a cada rodada, sem precisar mudar.
--   4. Privilégios.
--
-- Janela da DPP do teste: 3 dias antes e 3 depois (7 inícios possíveis),
-- para as contas à mão ficarem curtas. Datas em 2030, longe de qualquer dado.
-- Só dado sintético, criado aqui e desfeito no rollback. Não depende do seed.
-- =============================================================================

begin;

select plan(28);

-- -----------------------------------------------------------------------------
-- 0. Dados sintéticos
-- -----------------------------------------------------------------------------

insert into parametro (chave, valor) values
  ('janela_dpp_dias', '{"antes": 3, "depois": 3}'),
  ('capacidade_alerta_pct', '85')
on conflict (chave) do update set valor = excluded.valor;

-- São Paulo do teste: limite 5 famílias por semana = 35 dias de atendimento.
-- Londrina do teste: limite 3 = 21.
insert into regiao (id, nome, praca, limite_familias_semana) values
  ('b2000000-0000-4000-8000-000000000001', 'São Paulo Teste P19', 'São Paulo', 5),
  ('b2000000-0000-4000-8000-000000000002', 'Londrina Teste P19',  'Londrina', 3),
  ('b2000000-0000-4000-8000-000000000003', 'Região Inativa Teste P19', 'Teste', 5);
update regiao set ativa = false where id = 'b2000000-0000-4000-8000-000000000003';
insert into cidade (id, nome, uf, regiao_id) values
  ('b2000000-0000-4000-8000-000000000011', 'Cidade Teste Paulista P19', 'SP', 'b2000000-0000-4000-8000-000000000001');
insert into pacote (id, nome, dias) values ('b2000000-0000-4000-8000-000000000021', 'Pacote Teste P19', 6);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2000000-0000-4000-8000-000000000022', 'b2000000-0000-4000-8000-000000000021', 100, 6, '2020-01-01');

-- Famílias do cenário (a região vem da família ou da cidade)
--   A  início conhecido 04/03/2030 (segunda), 6 dias
--   B  início conhecido 08/03/2030 (sexta), 6 dias: 3 numa semana, 3 na outra
--   C  sem início: DPP 21/03/2030 (quinta), janela 18 a 24/03, 7 inícios
--   D  contrato cancelado (não conta)
--   E  Londrina, início 04/03/2030
--   F  acompanhamento encerrado (não conta)
--   G  família mesclada (não conta)
--   H  DPP 10/04/2030, nasceu 12/04: inícios só em 12 e 13/04
--   I  alta em 01/05/2030 (quarta), sem acompanhamento: começa na alta
insert into familia (id, nome_exibicao, regiao_id, cidade_id, dpp, data_nascimento, data_alta) values
  ('c2000000-0000-4000-8000-00000000000a', 'Família Teste A P19', 'b2000000-0000-4000-8000-000000000001', null, '2030-03-10', null, null),
  ('c2000000-0000-4000-8000-00000000000b', 'Família Teste B P19', null, 'b2000000-0000-4000-8000-000000000011', '2030-03-10', null, null),
  ('c2000000-0000-4000-8000-00000000000c', 'Família Teste C P19', 'b2000000-0000-4000-8000-000000000001', null, '2030-03-21', null, null),
  ('c2000000-0000-4000-8000-00000000000d', 'Família Teste D P19', 'b2000000-0000-4000-8000-000000000001', null, '2030-03-10', null, null),
  ('c2000000-0000-4000-8000-00000000000e', 'Família Teste E P19', 'b2000000-0000-4000-8000-000000000002', null, '2030-03-10', null, null),
  ('c2000000-0000-4000-8000-00000000000f', 'Família Teste F P19', 'b2000000-0000-4000-8000-000000000001', null, '2030-03-10', null, null),
  ('c2000000-0000-4000-8000-000000000010', 'Família Teste H P19', 'b2000000-0000-4000-8000-000000000001', null, '2030-04-10', '2030-04-12', null),
  ('c2000000-0000-4000-8000-000000000011', 'Família Teste I P19', 'b2000000-0000-4000-8000-000000000001', null, '2030-04-25', '2030-04-28', '2030-05-01');
insert into familia (id, nome_exibicao, regiao_id, dpp, mesclada_em_id) values
  ('c2000000-0000-4000-8000-000000000012', 'Família Teste G P19', 'b2000000-0000-4000-8000-000000000001', '2030-03-10',
   'c2000000-0000-4000-8000-00000000000a');

insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status)
  select ('c2000000-0000-4000-8000-0000000001' || right(f.id::text, 2))::uuid, f.id,
         'b2000000-0000-4000-8000-000000000022', 100, 'teste',
         case when f.nome_exibicao = 'Família Teste D P19' then 'cancelado'::status_contrato else 'assinado'::status_contrato end
  from familia f where f.nome_exibicao like 'Família Teste _ P19';

insert into acompanhamento (contrato_id, familia_id, dias_contratados, horas_por_visita, inicio_efetivo, estado)
  select k.id, k.familia_id, 6, 6, v.inicio::date, v.estado::estado_acompanhamento
  from contrato k
  join (values ('c2000000-0000-4000-8000-00000000000a', '2030-03-04', 'ativo'),
               ('c2000000-0000-4000-8000-00000000000b', '2030-03-08', 'ativo'),
               ('c2000000-0000-4000-8000-00000000000d', '2030-03-04', 'aguardando'),
               ('c2000000-0000-4000-8000-00000000000e', '2030-03-04', 'ativo'),
               ('c2000000-0000-4000-8000-00000000000f', '2030-03-04', 'encerrado'),
               ('c2000000-0000-4000-8000-000000000012', '2030-03-04', 'ativo'))
       as v(familia, inicio, estado) on v.familia::uuid = k.familia_id;


-- =============================================================================
-- 1. Percentuais do cenário (contas à mão)
--
-- São Paulo, capacidade 35:
--   04/03  A 6 + B 3                            = 9     → 25,7%  (2 famílias)
--   11/03  B 3                                  = 3     →  8,6%
--   18/03  C: inícios de 18 a 24/03, 6 dias; dias na semana por início
--          6,6,5,4,3,2,1 = 27; 27/7 = 3,857    →        11,0%
--   25/03  C: 42 − 27 = 15; 15/7 = 2,143        →         6,1%
--   08/04  H: início 12/04 dá 3 dias, 13/04 dá 2; (3+2)/2 = 2,5  → 7,1%
--   15/04  H: 3 e 4; (3+4)/2 = 3,5              →        10,0%
--   29/04  I: alta 01/05, quarta a domingo = 5  →        14,3%
--   06/05  I: 1                                 →         2,9%
-- Londrina, capacidade 21:
--   04/03  E 6                                  →        28,6%
-- =============================================================================

select results_eq(
  $$ select regiao, semana, ocupacao_pct, familias
       from ocupacao_projetada
      where regiao_id in ('b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002')
      order by regiao desc, semana $$,
  $$ values ('São Paulo Teste P19'::text, '2030-03-04'::date, 25.7::numeric, 2),
            ('São Paulo Teste P19', '2030-03-11', 8.6, 1),
            ('São Paulo Teste P19', '2030-03-18', 11.0, 1),
            ('São Paulo Teste P19', '2030-03-25', 6.1, 1),
            ('São Paulo Teste P19', '2030-04-08', 7.1, 1),
            ('São Paulo Teste P19', '2030-04-15', 10.0, 1),
            ('São Paulo Teste P19', '2030-04-29', 14.3, 1),
            ('São Paulo Teste P19', '2030-05-06', 2.9, 1),
            ('Londrina Teste P19',  '2030-03-04', 28.6, 1) $$,
  'ocupação projetada do cenário de São Paulo e de Londrina: percentuais e famílias por semana');

select results_eq(
  $$ select dias_atendimento, capacidade_dias from ocupacao_projetada
      where regiao_id = 'b2000000-0000-4000-8000-000000000001' and semana in ('2030-03-18', '2030-03-25') order by semana $$,
  $$ values (3.86::numeric, 35), (2.14::numeric, 35) $$,
  'janela uniforme da DPP: 27/7 e 15/7 dias de atendimento esperados, capacidade 5 × 7');

select ok((select extract(isodow from semana) = 1 from ocupacao_projetada limit 1)
          and not exists (select 1 from ocupacao_projetada where extract(isodow from semana) <> 1),
  'a semana da ocupação é sempre a segunda-feira');

select is(
  (select sum(dias_atendimento) from ocupacao_projetada where regiao_id = 'b2000000-0000-4000-8000-000000000001'),
  30.00::numeric,
  'São Paulo soma 6 dias por contrato que conta (A, B, C, H e I, 5 × 6 = 30); D, F e G não entram');

-- a janela vem do parâmetro: com 0 e 0, C começa na própria DPP (quinta, 4 dias na semana de 18/03)
update parametro set valor = '{"antes": 0, "depois": 0}' where chave = 'janela_dpp_dias';
select is((select ocupacao_pct from ocupacao_projetada
            where regiao_id = 'b2000000-0000-4000-8000-000000000001' and semana = '2030-03-18'), 11.4,
  'janela vem do parâmetro: sem janela, C começa na DPP e dá 4 dias na semana (11,4%)');
update parametro set valor = '{"antes": 3, "depois": 3}' where chave = 'janela_dpp_dias';

-- sem o parâmetro, a estimativa some da view (e a disponibilidade recusa, seção 2)
delete from parametro where chave = 'janela_dpp_dias';
select is((select count(*)::integer from ocupacao_projetada
            where regiao_id = 'b2000000-0000-4000-8000-000000000001' and semana in ('2030-03-18', '2030-03-25')), 0,
  'sem parametro.janela_dpp_dias, contrato sem início conhecido não é projetado');
insert into parametro (chave, valor) values ('janela_dpp_dias', '{"antes": 3, "depois": 3}');


-- =============================================================================
-- 2. privado.disponibilidade (PRD 10.2, 11.9)
-- =============================================================================

-- semana de 03/06/2030 com 5 famílias de 6 dias = 30/35 = 85,7% (acima de 85)
insert into familia (id, nome_exibicao, regiao_id)
  select ('c2000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid, 'Família Teste Lotação ' || n || ' P19',
         'b2000000-0000-4000-8000-000000000001'
  from generate_series(1, 5) n;
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status)
  select ('c2000000-0000-4000-8000-0000000003' || lpad(n::text, 2, '0'))::uuid,
         ('c2000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid,
         'b2000000-0000-4000-8000-000000000022', 100, 'teste', 'assinado'
  from generate_series(1, 5) n;
insert into acompanhamento (contrato_id, familia_id, dias_contratados, horas_por_visita, inicio_efetivo)
  select ('c2000000-0000-4000-8000-0000000003' || lpad(n::text, 2, '0'))::uuid,
         ('c2000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid, 6, 6, '2030-06-03'
  from generate_series(1, 5) n;

select is((select ocupacao_pct from ocupacao_projetada
            where regiao_id = 'b2000000-0000-4000-8000-000000000001' and semana = '2030-06-03'), 85.7,
  'semana de 03/06/2030 com cinco famílias: 85,7%');

select is(privado.disponibilidade('2030-06-12', 'b2000000-0000-4000-8000-000000000001'), 'confirmar_com_equipe',
  'DPP cuja janela cai na semana acima do limite de alerta: confirmar_com_equipe');
select is(privado.disponibilidade('2030-09-11', 'b2000000-0000-4000-8000-000000000001'), 'disponivel',
  'DPP com todas as semanas prováveis vazias: disponivel');
select is(privado.disponibilidade('2030-03-13', 'b2000000-0000-4000-8000-000000000001'), 'disponivel',
  'DPP em semanas com 25,7% e 8,6%: disponivel (abaixo de 85)');
select is(privado.disponibilidade('2030-05-29', 'b2000000-0000-4000-8000-000000000001'), 'confirmar_com_equipe',
  'DPP antes da semana cheia, mas com o pacote de 6 dias entrando nela: confirmar_com_equipe');

update parametro set valor = '86' where chave = 'capacidade_alerta_pct';
select is(privado.disponibilidade('2030-06-12', 'b2000000-0000-4000-8000-000000000001'), 'disponivel',
  'o limite vem do parâmetro: com 86, a semana de 85,7% passa');
update parametro set valor = '85' where chave = 'capacidade_alerta_pct';

select is(privado.disponibilidade(null, 'b2000000-0000-4000-8000-000000000001'), 'confirmar_com_equipe', 'sem DPP: confirmar_com_equipe');
select is(privado.disponibilidade('2030-09-11', null), 'confirmar_com_equipe', 'sem região: confirmar_com_equipe');
select is(privado.disponibilidade('2030-09-11', 'b2000000-0000-4000-8000-000000000003'), 'confirmar_com_equipe',
  'região inativa: confirmar_com_equipe');

delete from parametro where chave = 'capacidade_alerta_pct';
select is(privado.disponibilidade('2030-09-11', 'b2000000-0000-4000-8000-000000000001'), 'confirmar_com_equipe',
  'sem parametro.capacidade_alerta_pct: confirmar_com_equipe (nunca promete vaga sem dado)');
insert into parametro (chave, valor) values ('capacidade_alerta_pct', '85');

delete from parametro where chave = 'janela_dpp_dias';
select is(privado.disponibilidade('2030-09-11', 'b2000000-0000-4000-8000-000000000001'), 'confirmar_com_equipe',
  'sem parametro.janela_dpp_dias: confirmar_com_equipe');
insert into parametro (chave, valor) values ('janela_dpp_dias', '{"antes": 3, "depois": 3}');


-- =============================================================================
-- 3. Recálculo diário (PRD 10.2)
-- =============================================================================

select results_eq(
  $$ select schedule, command from cron.job where jobname = 'recalculo_diario' $$,
  $$ values ('0 10 * * *'::text, 'select privado.recalculo_diario()'::text) $$,
  'pg_cron: recalculo_diario registrado às 10:00 UTC (7h em Brasília)');

-- uma família com oportunidade aberta no P1, para a etapa de score ter o que calcular
insert into familia (id, nome_exibicao, regiao_id, dpp)
  values ('c2000000-0000-4000-8000-000000000401', 'Família Teste Lead P19', 'b2000000-0000-4000-8000-000000000001', '2030-09-11');
insert into oportunidade (familia_id, pipeline, estagio_p1) values ('c2000000-0000-4000-8000-000000000401', 1, 'novo');

-- sem os parâmetros da pontuação, a etapa score falha sozinha
delete from parametro where chave in ('score_pesos', 'score_cortes');
create temp table r1 on commit drop as select privado.recalculo_diario() as r;

select results_eq(
  $$ select e.ordem, e.etapa, e.status::text from privado.recalculo_etapa e
      where e.execucao_id = (select (r ->> 'execucao_id')::bigint from r1) order by e.ordem $$,
  $$ values (1, 'idade_gestacional'::text, 'ok'::text), (2, 'ocupacao', 'ok'), (3, 'score', 'erro'),
            (4, 'regua_nutricao', 'ok'), (5, 'alertas_dpp', 'vazia'), (6, 'ficha_pendente', 'vazia'),
            (7, 'prazo_relatorio', 'vazia'), (8, 'documentos_vencendo', 'vazia'), (9, 'alerta_34s', 'ok') $$,
  -- [P20] regua_nutricao passa a 'ok' (0012_automacoes.sql, privado.recalculo_regua_nutricao:
  -- roda contra as famílias do seed com conversa iniciada pela família, sem erro, mesmo sem
  -- nenhuma família nova nesta seção). alerta_34s também vira 'ok' (privado.recalculo_alerta_34s
  -- existe), mas fica sem efeito nenhum porque ativa = false no seed (Fase 2, pré-natal online).
  'recálculo: etapas na ordem do PRD 10.2; módulo que ainda não existe fica vazio; erro de uma etapa não para as outras');
select results_eq(
  $$ select status::text, origem, concluido_em is not null from privado.recalculo_execucao
      where id = (select (r ->> 'execucao_id')::bigint from r1) $$,
  $$ values ('concluido_com_erro'::text, 'cron'::text, true) $$,
  'recálculo: rodada gravada como concluída com erro, origem cron');
select ok((select erro like '22023:%' from privado.recalculo_etapa
            where execucao_id = (select (r ->> 'execucao_id')::bigint from r1) and etapa = 'score'),
  'recálculo: a etapa com erro guarda o código e a mensagem');

select ok(
  (select resultado -> 'acima_do_limite' @> jsonb_build_array(jsonb_build_object(
            'regiao_id', 'b2000000-0000-4000-8000-000000000001', 'semana', '2030-06-03', 'ocupacao_pct', 85.7))
     from privado.recalculo_etapa
    where execucao_id = (select (r ->> 'execucao_id')::bigint from r1) and etapa = 'ocupacao'),
  'recálculo: a etapa de ocupação grava as semanas acima do limite de alerta');
select ok(
  (select jsonb_array_length(resultado -> 'semanas') >= 9 and (resultado ->> 'limite_alerta_pct')::numeric = 85
     from privado.recalculo_etapa
    where execucao_id = (select (r ->> 'execucao_id')::bigint from r1) and etapa = 'ocupacao'),
  'recálculo: a etapa de ocupação grava a foto das semanas e o limite usado');

-- com os parâmetros, a rodada fecha sem erro
insert into parametro (chave, valor) values
  ('score_pesos', '{
     "fit_operacional": {"peso": 40, "componentes": {"cidade_atendida": 1, "regiao_com_profissional": 1, "dpp_com_capacidade": 1}},
     "fit_comercial":   {"peso": 35, "componentes": {"interesse": 1, "engajamento": 1, "sessao_agendada": 1, "parceiro_envolvido": 1}},
     "momento":         {"peso": 25, "componentes": {"trimestre": 1, "proximidade_dpp": 1, "bebe_nasceu": 1}},
     "criterios": {"engajamento_mensagens": 3,
                   "trimestre": [{"semana_min": 0, "valor": 0}, {"semana_min": 14, "valor": 0.5}, {"semana_min": 28, "valor": 1}],
                   "proximidade_dpp_dias": 84}}'),
  ('score_cortes', '{"quente": 70, "morno": 40}');
create temp table r2 on commit drop as select privado.recalculo_diario() as r;
select is((select r ->> 'erros' from r2), '0', 'recálculo com os parâmetros: nenhuma etapa com erro');
select ok((select (resultado ->> 'familias')::integer >= 1 from privado.recalculo_etapa
            where execucao_id = (select (r ->> 'execucao_id')::bigint from r2) and etapa = 'score'),
  'recálculo: a etapa de score recalcula as famílias com oportunidade aberta no pipeline 1');


-- =============================================================================
-- 4. Privilégios
-- =============================================================================

select ok((select 'security_invoker=true' = any (c.reloptions) from pg_class c where c.oid = 'public.ocupacao_projetada'::regclass),
  'ocupacao_projetada é security_invoker (PRD 6.9)');
select ok(
  not has_table_privilege('authenticated', 'public.ocupacao_projetada', 'select')
  and not has_table_privilege('anon', 'public.ocupacao_projetada', 'select')
  and not has_table_privilege('authenticated', 'privado.recalculo_execucao', 'select')
  and not has_table_privilege('service_role', 'privado.recalculo_etapa', 'select'),
  'ocupação e registro do recálculo sem select direto para os papéis da aplicação');
select ok(
  not has_function_privilege('authenticated', 'privado.disponibilidade(date, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'privado.recalculo_diario()', 'execute')
  and not has_function_privilege('service_role', 'privado.recalculo_diario()', 'execute'),
  'disponibilidade e recálculo sem execute para os papéis da aplicação (o agente chega pelo schema agente, P21)');

select * from finish();

rollback;
