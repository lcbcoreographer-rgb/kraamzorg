-- =============================================================================
-- supabase/tests/010_score_dedup.sql
--
-- Aceite do P17 (PROMPTS.md v2), parte de banco: "pgTAP da pontuação com
-- três perfis (quente, morno, frio)", mais a deduplicação do PRD 6.10
-- (regra 2), o vínculo de nova gestação (regra 12) e o recálculo a cada
-- dado novo.
--
--   1. Três perfis (quente, morno, frio) e o bebê já nascido, com a nota
--      conferida à mão contra os pesos do teste; o score chega à
--      oportunidade pelos gatilhos, sem chamar a função.
--   2. Cortes e pesos vêm do parâmetro; sem parâmetro a função recusa e a
--      escrita que alimenta a ficha não falha.
--   3. score e classificacao fora do alcance do app.
--   4. Telefone normalizado e buscar_duplicatas (certa, provável, nova
--      gestação, mesclada fora, parâmetro obrigatório).
--   5. vincular_nova_gestacao: papel, ciclo, ordem das datas, evento.
--   6. Privilégios.
--
-- Só dado sintético, criado aqui e desfeito no rollback. Não depende do seed.
-- =============================================================================

begin;

select plan(43);

-- -----------------------------------------------------------------------------
-- 0. Dados sintéticos
-- -----------------------------------------------------------------------------

-- Pesos do PRD 7.1 (40, 35, 25), componentes com peso 1, critérios do teste
insert into parametro (chave, valor) values
  ('score_pesos', '{
     "fit_operacional": {"peso": 40, "componentes": {"cidade_atendida": 1, "regiao_com_profissional": 1, "dpp_com_capacidade": 1}},
     "fit_comercial":   {"peso": 35, "componentes": {"interesse": 1, "engajamento": 1, "sessao_agendada": 1, "parceiro_envolvido": 1}},
     "momento":         {"peso": 25, "componentes": {"trimestre": 1, "proximidade_dpp": 1, "bebe_nasceu": 1}},
     "criterios": {"engajamento_mensagens": 3,
                   "trimestre": [{"semana_min": 0, "valor": 0}, {"semana_min": 14, "valor": 0.5}, {"semana_min": 28, "valor": 1}],
                   "proximidade_dpp_dias": 84}}'),
  ('score_cortes', '{"quente": 70, "morno": 40}'),
  ('deduplicacao', '{"limiar_nome": 0.6, "dpp_dias": 14, "nova_gestacao_dias": 180}'),
  ('janela_dpp_dias', '{"antes": 21, "depois": 14}'),
  ('capacidade_alerta_pct', '85')
on conflict (chave) do update set valor = excluded.valor;

create temp table d10 (nome text primary key, dia date not null) on commit drop;
insert into d10 values ('hoje', (clock_timestamp() at time zone 'America/Sao_Paulo')::date);

create function testes.hoje10() returns date language sql stable as $$ select dia from d10 where nome = 'hoje' $$;

-- JWT simulado sem trocar de papel (para chamar privado como o dono, mas com auth.uid())
create function testes.como10(p_sub uuid) returns void
  language sql
  as $$ select set_config('request.jwt.claims',
                          case when p_sub is null then '' else
                            json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text end, true) $$;

insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'comercial.p10@exemplo.invalid'),
  ('a1000000-0000-4000-8000-000000000002', 'marketing.p10@exemplo.invalid');
insert into perfil (id, nome, email) values
  ('a1000000-0000-4000-8000-000000000001', 'Perfil Teste P10 comercial', 'comercial.p10@exemplo.invalid'),
  ('a1000000-0000-4000-8000-000000000002', 'Perfil Teste P10 marketing', 'marketing.p10@exemplo.invalid');
insert into usuario_papel (usuario_id, papel) values
  ('a1000000-0000-4000-8000-000000000001', 'comercial'),
  ('a1000000-0000-4000-8000-000000000002', 'marketing');

insert into regiao (id, nome, praca, limite_familias_semana)
  values ('b1000000-0000-4000-8000-000000000001', 'Região Teste P10', 'Praça Teste', 5);
insert into cidade (id, nome, uf, regiao_id, atendida, requer_confirmacao) values
  ('b1000000-0000-4000-8000-000000000002', 'Cidade Teste Atendida P10', 'SP', 'b1000000-0000-4000-8000-000000000001', true, false),
  ('b1000000-0000-4000-8000-000000000003', 'Cidade Teste Confirmar P10', 'SP', null, true, true);
insert into profissional (nome, funcao, regioes)
  values ('Enfermeira Teste P10', 'enfermeira_obstetrica', array['b1000000-0000-4000-8000-000000000001'::uuid]);
insert into pacote (id, nome, dias) values ('b1000000-0000-4000-8000-000000000004', 'Pacote Teste P10', 6);


-- =============================================================================
-- 1. Três perfis e o bebê já nascido
--
-- Contas à mão (pesos 40, 35 e 25, componentes com peso 1):
--   QUENTE  cidade atendida, região com profissional, vaga (1+1+1)/3 × 40 = 40
--           interesse, 3 mensagens, sessão agendada, parceiro (4/4) × 35  = 35
--           DPP em 30 dias: 3º trimestre 1, proximidade 1, não nasceu
--           (1+1+0)/3 × 25 = 16,67                          total 91,67 → 92
--   MORNO   fit operacional 40; só interesse (1/4) × 35 = 8,75
--           DPP em 120 dias: 22 semanas, 2º trimestre 0,5; longe 0
--           (0,5+0+0)/3 × 25 = 4,17                         total 52,92 → 53
--   FRIO    cidade "confirmar" sem região: fit operacional 0
--           só parceiro (1/4) × 35 = 8,75
--           DPP em 230 dias: 7 semanas, 1º trimestre 0; longe 0  total 8,75 → 9
--   NASCEU  fit operacional 40; fit comercial 0; momento máximo 25  total 65
-- -----------------------------------------------------------------------------

insert into familia (id, nome_exibicao, cidade_id, dpp) values
  ('c1000000-0000-4000-8000-000000000001', 'Família Teste Quente P10', 'b1000000-0000-4000-8000-000000000002', testes.hoje10() + 30),
  ('c1000000-0000-4000-8000-000000000002', 'Família Teste Morna P10',  'b1000000-0000-4000-8000-000000000002', testes.hoje10() + 120),
  ('c1000000-0000-4000-8000-000000000003', 'Família Teste Fria P10',   'b1000000-0000-4000-8000-000000000003', testes.hoje10() + 230);
insert into familia (id, nome_exibicao, cidade_id, dpp, data_nascimento) values
  ('c1000000-0000-4000-8000-000000000004', 'Família Teste Nasceu P10', 'b1000000-0000-4000-8000-000000000002',
   testes.hoje10() + 5, testes.hoje10() - 2);

insert into oportunidade (id, familia_id, pipeline, estagio_p1, plano_interesse_pacote_id, qualificacao) values
  ('c1000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000001', 1, 'novo',
   'b1000000-0000-4000-8000-000000000004', '{"parceiro_participa": true}'),
  ('c1000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000002', 1, 'novo',
   'b1000000-0000-4000-8000-000000000004', '{}'),
  ('c1000000-0000-4000-8000-000000000013', 'c1000000-0000-4000-8000-000000000003', 1, 'novo',
   null, '{"parceiro_participa": true}'),
  ('c1000000-0000-4000-8000-000000000014', 'c1000000-0000-4000-8000-000000000004', 1, 'novo', null, '{}');

insert into conversa (id, familia_id, iniciada_por) values
  ('c1000000-0000-4000-8000-000000000021', 'c1000000-0000-4000-8000-000000000001', 'cliente'),
  ('c1000000-0000-4000-8000-000000000022', 'c1000000-0000-4000-8000-000000000002', 'cliente');
insert into mensagem (conversa_id, direcao, enviado_por, conteudo) values
  ('c1000000-0000-4000-8000-000000000021', 'entrada', 'cliente', 'Mensagem sintética 1'),
  ('c1000000-0000-4000-8000-000000000021', 'saida',   'ia',      'Resposta sintética'),
  ('c1000000-0000-4000-8000-000000000021', 'entrada', 'cliente', 'Mensagem sintética 2'),
  ('c1000000-0000-4000-8000-000000000022', 'entrada', 'cliente', 'Mensagem sintética única');
insert into sessao_venda (familia_id, status) values ('c1000000-0000-4000-8000-000000000001', 'agendada');

-- ainda com 2 mensagens, o quente não tem engajamento: 40 + 26,25 + 16,67 = 82,92 → 83
select is((select score from oportunidade where id = 'c1000000-0000-4000-8000-000000000011'), 83,
  'gatilho: com duas mensagens recebidas o engajamento ainda não conta (score 83)');

-- a terceira mensagem é dado novo: o gatilho recalcula sozinho
insert into mensagem (conversa_id, direcao, enviado_por, conteudo)
  values ('c1000000-0000-4000-8000-000000000021', 'entrada', 'cliente', 'Mensagem sintética 3');

select results_eq(
  $$ select id::text, score, classificacao::text from oportunidade
      where id in ('c1000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000012',
                   'c1000000-0000-4000-8000-000000000013', 'c1000000-0000-4000-8000-000000000014')
      order by id $$,
  $$ values ('c1000000-0000-4000-8000-000000000011', 92, 'quente'),
            ('c1000000-0000-4000-8000-000000000012', 53, 'morno'),
            ('c1000000-0000-4000-8000-000000000013', 9,  'frio'),
            ('c1000000-0000-4000-8000-000000000014', 65, 'morno') $$,
  'três perfis pelos gatilhos, sem chamar a função: quente 92, morno 53, frio 9; bebê nascido 65 (momento máximo)');

select is(privado.calcular_score('c1000000-0000-4000-8000-000000000001') -> 'eixos',
  '{"fit_operacional": 40, "fit_comercial": 35, "momento": 16.67}'::jsonb,
  'quente: nota por eixo 40, 35 e 16,67');
select is(privado.calcular_score('c1000000-0000-4000-8000-000000000001') -> 'componentes',
  '{"cidade_atendida": 1, "regiao_com_profissional": 1, "dpp_com_capacidade": 1, "interesse": 1, "engajamento": 1,
    "sessao_agendada": 1, "parceiro_envolvido": 1, "bebe_nasceu": 0, "trimestre": 1, "proximidade_dpp": 1}'::jsonb,
  'quente: todos os componentes, menos bebê nascido');
select is(privado.calcular_score('c1000000-0000-4000-8000-000000000002') -> 'componentes' -> 'trimestre',
  '0.5'::jsonb, 'morno: 22 semanas caem na faixa do 2º trimestre do parâmetro (0,5)');
select is((privado.calcular_score('c1000000-0000-4000-8000-000000000003') -> 'componentes') - 'parceiro_envolvido',
  '{"cidade_atendida": 0, "regiao_com_profissional": 0, "dpp_com_capacidade": 0, "interesse": 0, "engajamento": 0,
    "sessao_agendada": 0, "bebe_nasceu": 0, "trimestre": 0, "proximidade_dpp": 0}'::jsonb,
  'frio: cidade a confirmar, sem região, 1º trimestre e DPP longe: só o parceiro conta');
select is((privado.calcular_score('c1000000-0000-4000-8000-000000000004') -> 'eixos' ->> 'momento')::numeric, 25::numeric,
  'bebê já nascido: momento máximo');
select is((privado.calcular_score('c1000000-0000-4000-8000-000000000001') ->> 'oportunidades_atualizadas')::integer, 0,
  'recalcular sem dado novo não regrava a oportunidade');

-- dado novo na família (DPP): o gatilho de familia recalcula
update familia set dpp = testes.hoje10() + 200 where id = 'c1000000-0000-4000-8000-000000000001';
select is((select score from oportunidade where id = 'c1000000-0000-4000-8000-000000000011'), 75,
  'gatilho de familia: DPP nova (1º trimestre, longe) recalcula para 40 + 35 + 0 = 75');
update familia set dpp = testes.hoje10() + 30 where id = 'c1000000-0000-4000-8000-000000000001';

-- oportunidade perdida não recebe score novo
insert into familia (id, nome_exibicao, cidade_id, dpp)
  values ('c1000000-0000-4000-8000-000000000005', 'Família Teste Perdida P10', 'b1000000-0000-4000-8000-000000000002', testes.hoje10() + 30);
insert into oportunidade (id, familia_id, pipeline, estagio_p1, motivo_perda)   -- o dono cria já perdida, só para montar o caso
  values ('c1000000-0000-4000-8000-000000000015', 'c1000000-0000-4000-8000-000000000005', 1, 'perdido', 'sem_interesse');
select privado.calcular_score('c1000000-0000-4000-8000-000000000005');
select is((select score from oportunidade where id = 'c1000000-0000-4000-8000-000000000015'), null,
  'oportunidade perdida (fechada) não recebe score');


-- =============================================================================
-- 2. Cortes e pesos no parâmetro; sem parâmetro, recusa
-- =============================================================================

update parametro set valor = '{"quente": 50, "morno": 20}' where chave = 'score_cortes';
select is(privado.calcular_score('c1000000-0000-4000-8000-000000000002') ->> 'classificacao', 'quente',
  'cortes vêm do parâmetro: com quente em 50, o morno (53) vira quente');
update parametro set valor = '{"quente": 70, "morno": 40}' where chave = 'score_cortes';

update parametro set valor = jsonb_set(valor, '{fit_comercial,peso}', '0') where chave = 'score_pesos';
select is((privado.calcular_score('c1000000-0000-4000-8000-000000000001') ->> 'score')::integer, 57,
  'pesos vêm do parâmetro: sem o eixo comercial, o quente cai para 40 + 16,67 = 57');
update parametro set valor = jsonb_set(valor, '{fit_comercial,peso}', '35') where chave = 'score_pesos';

update parametro set valor = jsonb_set(valor, '{momento,componentes,sorte}', '1') where chave = 'score_pesos';
select throws_ok($$ select privado.calcular_score('c1000000-0000-4000-8000-000000000001') $$,
  '22023', null, 'componente desconhecido no parâmetro é recusado (erro de digitação não vira nota)');
update parametro set valor = valor #- '{momento,componentes,sorte}' where chave = 'score_pesos';

update parametro set valor = '{"quente": 30, "morno": 40}' where chave = 'score_cortes';
select throws_ok($$ select privado.calcular_score('c1000000-0000-4000-8000-000000000001') $$,
  '22023', null, 'cortes incoerentes (morno acima de quente) são recusados');
update parametro set valor = '{"quente": 70, "morno": 40}' where chave = 'score_cortes';

create temp table guarda_pesos on commit drop as select valor from parametro where chave = 'score_pesos';
delete from parametro where chave = 'score_pesos';
select throws_ok($$ select privado.calcular_score('c1000000-0000-4000-8000-000000000001') $$,
  '22023', null, 'sem parametro.score_pesos, a pontuação recusa (nenhum peso fixo no SQL)');
select lives_ok($$ insert into mensagem (conversa_id, direcao, enviado_por, conteudo)
                   values ('c1000000-0000-4000-8000-000000000022', 'entrada', 'cliente', 'Mensagem sintética sem parâmetro') $$,
  'sem parâmetro, a mensagem recebida é gravada do mesmo jeito (o gatilho não derruba a escrita)');
insert into parametro (chave, valor) select 'score_pesos', valor from guarda_pesos;

delete from parametro where chave = 'score_cortes';
select throws_ok($$ select privado.calcular_score('c1000000-0000-4000-8000-000000000001') $$,
  '22023', null, 'sem parametro.score_cortes, a classificação recusa');
insert into parametro (chave, valor) values ('score_cortes', '{"quente": 70, "morno": 40}');

select throws_ok($$ select privado.calcular_score('c1000000-0000-4000-8000-0000000000ff') $$,
  'P0002', null, 'família inexistente é recusada');


-- =============================================================================
-- 3. score e classificacao fora do alcance do app
-- =============================================================================

select testes.autenticar_authenticated('a1000000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ update oportunidade set score = 100 where id = 'c1000000-0000-4000-8000-000000000013' $$,
  '42501', null, 'comercial não digita score');
select throws_ok($$ update oportunidade set classificacao = 'quente' where id = 'c1000000-0000-4000-8000-000000000013' $$,
  '42501', null, 'comercial não digita classificação');
select throws_ok($$ insert into oportunidade (familia_id, pipeline, estagio_p1, score)
                    values ('c1000000-0000-4000-8000-000000000003', 1, 'novo', 100) $$,
  '42501', null, 'comercial não cria oportunidade com score');
select lives_ok($$ update oportunidade set qualificacao = '{}' where id = 'c1000000-0000-4000-8000-000000000013' $$,
  'comercial altera a qualificação (e o banco recalcula)');
select testes.encerrar();
select is((select score from oportunidade where id = 'c1000000-0000-4000-8000-000000000013'), 0,
  'qualificação alterada pelo comercial: sem parceiro, o frio vai a 0');


-- =============================================================================
-- 4. Deduplicação (PRD 6.10 regras 2 e 12)
-- =============================================================================

select is(privado.telefone_normalizado('+55 (11) 90000-1001'), '551100001001', 'telefone normalizado: celular com o nono dígito');
select is(privado.telefone_normalizado('+551100001001'), '551100001001', 'telefone normalizado: o mesmo celular sem o nono dígito');
select is(privado.telefone_normalizado('+551133334444'), '551133334444', 'telefone normalizado: fixo fica como está');
select is(privado.telefone_normalizado(' - '), null, 'telefone normalizado: sem dígito, nulo');

insert into familia (id, nome_exibicao, dpp) values
  ('c1000000-0000-4000-8000-000000000031', 'Família Teste Tanaka P10',  testes.hoje10() + 60),   -- a de referência
  ('c1000000-0000-4000-8000-000000000032', 'Família Teste Yamada P10',  testes.hoje10() + 65),   -- mesmo telefone, sem o 9
  ('c1000000-0000-4000-8000-000000000033', 'Família Teste Sato P10',    testes.hoje10() + 400),  -- mesmo telefone, gestação nova
  ('c1000000-0000-4000-8000-000000000034', 'Familia Teste Tanaka P10',  testes.hoje10() + 70),   -- nome parecido, DPP a 10 dias
  ('c1000000-0000-4000-8000-000000000035', 'Família Teste Tanaka P10',  testes.hoje10() + 100),  -- nome igual, DPP a 40 dias
  ('c1000000-0000-4000-8000-000000000036', 'Família Teste Oliveira Santos P10', testes.hoje10() + 60),  -- nada em comum
  ('c1000000-0000-4000-8000-000000000037', 'Família Teste Tanaka P10',  testes.hoje10() + 61);   -- vai ser mesclada
insert into pessoa (familia_id, papel, nome, telefone_e164) values
  ('c1000000-0000-4000-8000-000000000031', 'mae', 'Ana Teste Tanaka', '+5511900001001'),
  ('c1000000-0000-4000-8000-000000000032', 'mae', 'Beatriz Teste Yamada', '+551100001001'),
  ('c1000000-0000-4000-8000-000000000034', 'mae', 'Ana Teste Tanaka', '+5511900001004'),
  ('c1000000-0000-4000-8000-000000000037', 'mae', 'Ana Teste Tanaka', '+5511900001001');
insert into conversa (familia_id, telefone_e164, iniciada_por)
  values ('c1000000-0000-4000-8000-000000000033', '+5511900001001', 'cliente');
update familia set mesclada_em_id = 'c1000000-0000-4000-8000-000000000031' where id = 'c1000000-0000-4000-8000-000000000037';

select results_eq(
  $$ select outra_familia_id::text, tipo::text, telefone_em_comum from privado.buscar_duplicatas('c1000000-0000-4000-8000-000000000031')
      where outra_familia_id::text like 'c1000000-%' $$,
  $$ values ('c1000000-0000-4000-8000-000000000032', 'duplicata_certa', true),
            ('c1000000-0000-4000-8000-000000000033', 'nova_gestacao', true),
            ('c1000000-0000-4000-8000-000000000034', 'duplicata_provavel', false) $$,
  'duplicatas: certa pelo telefone (com e sem o nono dígito, pessoa ou conversa), nova gestação pela data distante, provável pelo nome e DPP a até 14 dias; DPP a 40 dias, nome diferente e família mesclada ficam fora');
select ok((select similaridade_nome >= 0.6 and diferenca_dias = 10
             from privado.buscar_duplicatas('c1000000-0000-4000-8000-000000000031')
            where outra_familia_id = 'c1000000-0000-4000-8000-000000000034'),
  'duplicata provável: similaridade acima do limiar e diferença de DPP de 10 dias');

update parametro set valor = jsonb_set(valor, '{dpp_dias}', '45') where chave = 'deduplicacao';
select ok(exists (select 1 from privado.buscar_duplicatas('c1000000-0000-4000-8000-000000000031')
                   where outra_familia_id = 'c1000000-0000-4000-8000-000000000035' and tipo = 'duplicata_provavel'),
  'a janela de DPP vem do parâmetro: com 45 dias, a família a 40 dias entra como provável');
update parametro set valor = jsonb_set(valor, '{dpp_dias}', '14') where chave = 'deduplicacao';

delete from parametro where chave = 'deduplicacao';
select throws_ok($$ select * from privado.buscar_duplicatas('c1000000-0000-4000-8000-000000000031') $$,
  '22023', null, 'sem parametro.deduplicacao, a deduplicação recusa');
insert into parametro (chave, valor) values ('deduplicacao', '{"limiar_nome": 0.6, "dpp_dias": 14, "nova_gestacao_dias": 180}');


-- =============================================================================
-- 5. Vínculo de nova gestação (PRD 6.10 regra 12)
-- =============================================================================

select testes.como10('a1000000-0000-4000-8000-000000000002');
select throws_ok($$ select privado.vincular_nova_gestacao('c1000000-0000-4000-8000-000000000033', 'c1000000-0000-4000-8000-000000000031') $$,
  '42501', null, 'marketing não liga gestação');
select testes.como10('a1000000-0000-4000-8000-000000000001');
select is(privado.vincular_nova_gestacao('c1000000-0000-4000-8000-000000000033', 'c1000000-0000-4000-8000-000000000031') ->> 'alterado',
  'true', 'comercial liga a nova gestação à família anterior');
select is(privado.vincular_nova_gestacao('c1000000-0000-4000-8000-000000000033', 'c1000000-0000-4000-8000-000000000031') ->> 'alterado',
  'false', 'repetir o mesmo vínculo não muda nada');
select throws_ok($$ select privado.vincular_nova_gestacao('c1000000-0000-4000-8000-000000000031', 'c1000000-0000-4000-8000-000000000033') $$,
  '22023', null, 'vínculo que fecharia ciclo é recusado');
select throws_ok($$ select privado.vincular_nova_gestacao('c1000000-0000-4000-8000-000000000036', 'c1000000-0000-4000-8000-000000000033') $$,
  '22023', null, 'a gestação anterior precisa ter data anterior à nova');
select throws_ok($$ select privado.vincular_nova_gestacao('c1000000-0000-4000-8000-000000000036', 'c1000000-0000-4000-8000-000000000037') $$,
  '22023', null, 'família mesclada não recebe vínculo');
select testes.como10(null);

select results_eq(
  $$ select familia_anterior_id::text from familia where id = 'c1000000-0000-4000-8000-000000000033' $$,
  $$ values ('c1000000-0000-4000-8000-000000000031') $$,
  'familia_anterior_id gravado na nova gestação');
select is((select count(*)::integer from evento_familia
            where familia_id = 'c1000000-0000-4000-8000-000000000033' and tipo = 'nova_gestacao' and not restrito), 1,
  'o vínculo vira evento (não restrito) na linha do tempo da nova gestação');
select ok(not exists (select 1 from privado.buscar_duplicatas('c1000000-0000-4000-8000-000000000031')
                       where outra_familia_id = 'c1000000-0000-4000-8000-000000000033'),
  'depois do vínculo, a nova gestação não volta como sugestão de duplicata');
select is(privado.vincular_nova_gestacao('c1000000-0000-4000-8000-000000000035', 'c1000000-0000-4000-8000-000000000031') ->> 'alterado',
  'true', 'o sistema (agente, sem usuário) também liga');


-- =============================================================================
-- 6. Privilégios
-- =============================================================================

select ok(
  not has_function_privilege('authenticated', 'privado.calcular_score(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'privado.buscar_duplicatas(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'privado.vincular_nova_gestacao(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'privado.telefone_normalizado(text)', 'execute')
  and not has_function_privilege('service_role', 'privado.calcular_score(uuid)', 'execute'),
  'funções de pontuação e deduplicação sem execute para anon, authenticated e service_role');
select ok(
  not has_column_privilege('authenticated', 'public.oportunidade', 'score', 'update')
  and not has_column_privilege('authenticated', 'public.oportunidade', 'classificacao', 'insert')
  and has_column_privilege('authenticated', 'public.oportunidade', 'score', 'select'),
  'score e classificacao: leitura sim, escrita não');

select * from finish();

rollback;
