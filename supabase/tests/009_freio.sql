-- =============================================================================
-- supabase/tests/009_freio.sql
--
-- Aceite do P09 (PROMPTS.md v2), invariante 3 do PRD 16.1: "pgTAP do
-- invariante 3 cobre as 16 combinações de categoria e estado, a execução
-- agendada abortada quando o estado muda antes do envio e a reversão
-- recusada sem papel".
--
--   1. Matriz do 8.2: privado.freio_permite e privado.pode_executar nas 16
--      combinações, com o registro do aborto (status e estado no motivo).
--   2. Execução agendada: reavaliada na hora em que o estado sobe, recusada
--      no instante do envio e nunca "desabortada".
--   3. privado.pode_enviar_mensagem: freio, interna, nao_contatar, conversa
--      iniciada pela família, uma mensagem de conteúdo por dia e janela.
--   4. Acionar: quem tem acesso à família, AAL, só sobe, idempotente,
--      sistema sem usuário, família mesclada.
--   5. Tarefa de justificativa, evento restrito e log (sem o motivo em claro).
--   6. "Desfazer" (8.3 [v4.2]): só quem acionou, só no prazo, só o último.
--   7. Reversão: recusada sem papel, sem AAL2, sem justificativa e para cima.
--   8. Colunas do freio protegidas contra quem não é o dono (service_role).
--   9. familia_elegivel_marketing sem estado sensível, nao_contatar e mesclada.
--  10. Privilégios das funções novas.
--
-- Só dado sintético ("Família Teste ..."), criado aqui e desfeito no
-- rollback. Não depende do seed.
-- =============================================================================

begin;

select plan(152);

-- -----------------------------------------------------------------------------
-- 0. Dados sintéticos
-- -----------------------------------------------------------------------------

create temp table u9 (papel text primary key, id uuid not null) on commit drop;
insert into u9 values
  ('comercial',   'a9000000-0000-4000-8000-000000000001'),
  ('enfermeira',  'a9000000-0000-4000-8000-000000000002'),
  ('financeiro',  'a9000000-0000-4000-8000-000000000003'),
  ('marketing',   'a9000000-0000-4000-8000-000000000004'),
  ('coordenacao', 'a9000000-0000-4000-8000-000000000005'),
  ('diretoria',   'a9000000-0000-4000-8000-000000000006'),
  ('enfermeira2', 'a9000000-0000-4000-8000-000000000007'),
  ('comercial2',  'a9000000-0000-4000-8000-000000000008'),
  ('sem_papel',   'a9000000-0000-4000-8000-000000000009');

insert into auth.users (id, email) select id, papel || '.p09@exemplo.invalid' from u9;
insert into perfil (id, nome, email) select id, 'Perfil Teste P09 ' || papel, papel || '.p09@exemplo.invalid' from u9;
insert into usuario_papel (usuario_id, papel)
  select id, (case papel when 'enfermeira2' then 'enfermeira' when 'comercial2' then 'comercial' else papel end)::papel_usuario
  from u9 where papel <> 'sem_papel';

create function testes.p09(p_papel text) returns uuid
  language sql stable
  as $$ select id from u9 where papel = p_papel $$;

-- Parâmetros lidos pelo freio (P08 semeia os oficiais; aqui, valores do teste)
insert into parametro (chave, valor) values
  ('freio_desfazer_segundos', '10'),
  ('acesso_enfermeira_pos_encerramento_dias', '7'),
  ('agente_janela_envio', jsonb_build_object(
     'inicio', to_char((clock_timestamp() at time zone 'America/Sao_Paulo') - interval '1 hour', 'HH24:MI'),
     'fim',    to_char((clock_timestamp() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI')))
on conflict (chave) do update set valor = excluded.valor;

-- Automações de teste, uma por categoria, mais uma de conteúdo por tarefa humana
insert into automacao (id, nome, categoria, executor, gatilho, acoes) values
  ('teste_p09_interna',     'Teste P09 interna',     'interna',     'sistema',       '{}', '[]'),
  ('teste_p09_operacional', 'Teste P09 operacional', 'operacional', 'sistema',       '{}', '[]'),
  ('teste_p09_conteudo',    'Teste P09 conteúdo',    'conteudo',    'sistema',       '{}', '[]'),
  ('teste_p09_marketing',   'Teste P09 marketing',   'marketing',   'sistema',       '{}', '[]'),
  ('teste_p09_regua',       'Teste P09 régua',       'conteudo',    'humano_tarefa', '{}', '[]');

-- Uma família por estado (criadas pelo dono, que pode nascer em qualquer estado)
insert into familia (id, nome_exibicao, estado_sensivel) values
  ('c9000000-0000-4000-8000-000000000001', 'Família Teste Normal P09',    'normal'),
  ('c9000000-0000-4000-8000-000000000002', 'Família Teste Atenção P09',   'atencao'),
  ('c9000000-0000-4000-8000-000000000003', 'Família Teste Bloqueio P09',  'bloqueio_total'),
  ('c9000000-0000-4000-8000-000000000004', 'Família Teste Encerrado P09', 'encerrado_sensivel');

create temp table estados (estado estado_sensivel primary key, familia uuid not null) on commit drop;
insert into estados values
  ('normal',             'c9000000-0000-4000-8000-000000000001'),
  ('atencao',            'c9000000-0000-4000-8000-000000000002'),
  ('bloqueio_total',     'c9000000-0000-4000-8000-000000000003'),
  ('encerrado_sensivel', 'c9000000-0000-4000-8000-000000000004');

-- Matriz do PRD 8.2, escrita à mão (não copiada da função)
create temp table matriz9 (categoria categoria_automacao, estado estado_sensivel, executa boolean,
                          primary key (categoria, estado)) on commit drop;
insert into matriz9 values
  ('interna', 'normal', true),  ('interna', 'atencao', true),  ('interna', 'bloqueio_total', true),  ('interna', 'encerrado_sensivel', true),
  ('operacional', 'normal', true), ('operacional', 'atencao', true), ('operacional', 'bloqueio_total', false), ('operacional', 'encerrado_sensivel', false),
  ('conteudo', 'normal', true), ('conteudo', 'atencao', false), ('conteudo', 'bloqueio_total', false), ('conteudo', 'encerrado_sensivel', false),
  ('marketing', 'normal', true), ('marketing', 'atencao', false), ('marketing', 'bloqueio_total', false), ('marketing', 'encerrado_sensivel', false);

-- Família do dia a dia dos testes de acionamento, com contrato e atribuída à
-- enfermeira (e a de outra família, sem contrato)
insert into regiao (id, nome, praca, limite_familias_semana)
  values ('b9000000-0000-4000-8000-000000000001', 'Região Teste P09', 'Praça Teste', 5);
insert into pacote (id, nome, dias) values ('b9000000-0000-4000-8000-000000000002', 'Pacote Teste P09', 6);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b9000000-0000-4000-8000-000000000003', 'b9000000-0000-4000-8000-000000000002', 100, 6, '2020-01-01');

insert into familia (id, nome_exibicao, regiao_id) values
  ('c9000000-0000-4000-8000-000000000011', 'Família Teste Aurora P09', 'b9000000-0000-4000-8000-000000000001'),
  ('c9000000-0000-4000-8000-000000000012', 'Família Teste Brisa P09',  'b9000000-0000-4000-8000-000000000001');
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao)
  values ('c9000000-0000-4000-8000-000000000021', 'c9000000-0000-4000-8000-000000000011', 'b9000000-0000-4000-8000-000000000003', 100, 'teste');
insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita)
  values ('c9000000-0000-4000-8000-000000000031', 'c9000000-0000-4000-8000-000000000021', 'c9000000-0000-4000-8000-000000000011', 6, 6);
insert into profissional (id, usuario_id, nome, funcao) values
  ('c9000000-0000-4000-8000-000000000041', 'a9000000-0000-4000-8000-000000000002', 'Enfermeira Teste P09', 'enfermeira_obstetrica'),
  ('c9000000-0000-4000-8000-000000000042', 'a9000000-0000-4000-8000-000000000007', 'Enfermeira Teste Dois P09', 'enfermeira_neonatal');
insert into designacao (acompanhamento_id, profissional_id, papel, status)
  values ('c9000000-0000-4000-8000-000000000031', 'c9000000-0000-4000-8000-000000000041', 'titular', 'aceita');

-- Conversas iniciadas pela família (D-08) para as famílias de mensagem
insert into conversa (familia_id, iniciada_por)
  select familia, 'cliente' from estados;
insert into conversa (familia_id, iniciada_por) values ('c9000000-0000-4000-8000-000000000011', 'cliente');


-- =============================================================================
-- 1. As 16 combinações (PRD 8.2)
-- =============================================================================

select is(privado.freio_permite(m.categoria, m.estado), m.executa,
          format('freio_permite: %s em %s = %s', m.categoria, m.estado, case when m.executa then 'executa' else 'aborta' end))
from matriz9 m
order by m.categoria, m.estado;

select is(privado.pode_executar(e.familia, 'teste_p09_' || m.categoria::text), m.executa,
          format('pode_executar: %s em %s = %s', m.categoria, m.estado, case when m.executa then 'executa' else 'aborta' end))
from matriz9 m
join estados e on e.estado = m.estado
order by m.categoria, m.estado;

select is(
  (select count(*)::integer from automacao_execucao x
    where x.familia_id = e.familia and x.automacao_id = 'teste_p09_' || m.categoria::text
      and x.status = 'abortada_freio' and x.motivo_aborto = m.estado::text),
  case when m.executa then 0 else 1 end,
  format('aborto registrado: %s em %s tem %s linha abortada_freio com o estado no motivo',
         m.categoria, m.estado, case when m.executa then 'nenhuma' else 'uma' end))
from matriz9 m
join estados e on e.estado = m.estado
order by m.categoria, m.estado;

select ok(privado.freio_permite(null, 'normal') = false and privado.freio_permite('interna', null) = true
          and privado.freio_permite('conteudo', null) = false,
          'freio_permite: categoria nula aborta; estado nulo só deixa passar interna');
select ok(privado.pode_executar(null, 'teste_p09_conteudo'), 'pode_executar: automação sem família não tem o que frear');
select throws_ok($$ select privado.pode_executar('c9000000-0000-4000-8000-000000000001', 'nao_existe_p09') $$,
  'P0002', null, 'pode_executar: automação inexistente é recusada');


-- =============================================================================
-- 2. Execução agendada abortada quando o estado muda (PRD 8.2)
-- =============================================================================

insert into familia (id, nome_exibicao) values ('c9000000-0000-4000-8000-000000000013', 'Família Teste Céu P09');
insert into automacao_execucao (id, automacao_id, familia_id, agendada_para) values
  ('c9000000-0000-4000-8000-000000000051', 'teste_p09_conteudo',    'c9000000-0000-4000-8000-000000000013', now() + interval '1 day'),
  ('c9000000-0000-4000-8000-000000000052', 'teste_p09_marketing',   'c9000000-0000-4000-8000-000000000013', now() + interval '1 day'),
  ('c9000000-0000-4000-8000-000000000053', 'teste_p09_operacional', 'c9000000-0000-4000-8000-000000000013', now() + interval '1 day'),
  ('c9000000-0000-4000-8000-000000000054', 'teste_p09_interna',     'c9000000-0000-4000-8000-000000000013', now() + interval '1 day');

-- comercial sobe para atencao pelo app
select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select is((api.acionar_freio('c9000000-0000-4000-8000-000000000013', 'atencao', 'Motivo sintético P09') ->> 'execucoes_abortadas')::integer, 2,
  'acionar atencao: devolve duas execuções abortadas (conteúdo e marketing)');
select testes.encerrar();

select results_eq(
  $$ select id::text, status::text, coalesce(motivo_aborto, '') from automacao_execucao
      where familia_id = 'c9000000-0000-4000-8000-000000000013' order by id $$,
  $$ values ('c9000000-0000-4000-8000-000000000051', 'abortada_freio', 'atencao'),
            ('c9000000-0000-4000-8000-000000000052', 'abortada_freio', 'atencao'),
            ('c9000000-0000-4000-8000-000000000053', 'agendada', ''),
            ('c9000000-0000-4000-8000-000000000054', 'agendada', '') $$,
  'atencao: conteúdo e marketing agendados abortam na hora; operacional e interna seguem agendados');

-- o sistema (agente, termo de alerta) sobe para bloqueio_total, sem usuário
select is(privado.acionar_freio('c9000000-0000-4000-8000-000000000013', 'bloqueio_total', 'Perda sintética P09') ->> 'para',
  'bloqueio_total', 'sistema sem usuário sobe o freio para bloqueio_total');
select results_eq(
  $$ select status::text, coalesce(motivo_aborto, '') from automacao_execucao
      where id in ('c9000000-0000-4000-8000-000000000053', 'c9000000-0000-4000-8000-000000000054') order by id $$,
  $$ values ('abortada_freio', 'bloqueio_total'), ('agendada', '') $$,
  'bloqueio_total: operacional aborta na hora; interna continua (alerta chega à coordenação)');

-- no instante do envio: a execução já abortada não sai, e a materializada
-- depois da mudança (antes da reavaliação) é recusada e marcada
select is(privado.pode_executar('c9000000-0000-4000-8000-000000000013', 'teste_p09_operacional', 'c9000000-0000-4000-8000-000000000053'),
  false, 'no envio: execução que já foi abortada não executa');
insert into automacao_execucao (id, automacao_id, familia_id, agendada_para)
  values ('c9000000-0000-4000-8000-000000000055', 'teste_p09_conteudo', 'c9000000-0000-4000-8000-000000000013', now());
select is(privado.pode_executar('c9000000-0000-4000-8000-000000000013', 'teste_p09_conteudo', 'c9000000-0000-4000-8000-000000000055'),
  false, 'no envio: execução agendada de conteúdo em bloqueio_total é recusada ao reconsultar o freio');
select results_eq(
  $$ select status::text, motivo_aborto from automacao_execucao where id = 'c9000000-0000-4000-8000-000000000055' $$,
  $$ values ('abortada_freio', 'bloqueio_total') $$,
  'no envio: a própria execução vira abortada_freio com o estado no motivo (sem linha duplicada)');
select is((select count(*)::integer from automacao_execucao where familia_id = 'c9000000-0000-4000-8000-000000000013'), 5,
  'no envio com execucao_id: nenhuma execução nova criada');
select is(privado.pode_executar('c9000000-0000-4000-8000-000000000013', 'teste_p09_interna', 'c9000000-0000-4000-8000-000000000054'),
  true, 'no envio: interna agendada executa mesmo em bloqueio_total');
select throws_ok($$ select privado.pode_executar('c9000000-0000-4000-8000-000000000001', 'teste_p09_interna', 'c9000000-0000-4000-8000-000000000054') $$,
  '22023', null, 'pode_executar: execução de outra família é recusada');

-- a reversão não "desaborta" nada
select testes.autenticar_authenticated(testes.p09('coordenacao'), 'aal2');
select is(api.reverter_freio('c9000000-0000-4000-8000-000000000013', 'normal', 'Justificativa sintética P09') ->> 'para',
  'normal', 'coordenação reverte para normal');
select testes.encerrar();
select is((select count(*)::integer from automacao_execucao
            where familia_id = 'c9000000-0000-4000-8000-000000000013' and status = 'abortada_freio'), 4,
  'depois da reversão as execuções abortadas continuam abortadas (8.3)');

-- família mesclada: vale o estado mais restritivo entre ela e a que ficou
insert into familia (id, nome_exibicao, mesclada_em_id)
  values ('c9000000-0000-4000-8000-000000000014', 'Família Teste Mesclada P09', 'c9000000-0000-4000-8000-000000000003');
select is(privado.pode_executar('c9000000-0000-4000-8000-000000000014', 'teste_p09_operacional'), false,
  'família mesclada em outra com bloqueio_total: operacional aborta');


-- =============================================================================
-- 3. privado.pode_enviar_mensagem (PRD 8.2)
-- =============================================================================

select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000001', 'conteudo'),
  '{"pode": true, "motivo": null}'::jsonb, 'mensagem: conteúdo para família normal, que escreveu, dentro da janela, pode');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000001', 'interna') ->> 'motivo',
  'categoria_interna', 'mensagem: interna nunca fala com a família');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000002', 'conteudo') ->> 'motivo',
  'freio_atencao', 'mensagem: conteúdo em atencao, recusado pelo freio');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000002', 'operacional') ->> 'pode',
  'true', 'mensagem: operacional em atencao sai (comunicação operacional mantida, 8.1)');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000003', 'operacional') ->> 'motivo',
  'freio_bloqueio_total', 'mensagem: operacional em bloqueio_total, recusado');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000004', 'marketing') ->> 'motivo',
  'freio_encerrado_sensivel', 'mensagem: marketing em encerrado_sensivel, recusado');

insert into familia (id, nome_exibicao, nao_contatar) values
  ('c9000000-0000-4000-8000-000000000015', 'Família Teste Não Contatar P09', true);
insert into conversa (familia_id, iniciada_por) values ('c9000000-0000-4000-8000-000000000015', 'cliente');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000015', 'operacional') ->> 'motivo',
  'nao_contatar', 'mensagem: nao_contatar bloqueia contato ativo');

insert into familia (id, nome_exibicao) values ('c9000000-0000-4000-8000-000000000016', 'Família Teste Indicação P09');
insert into conversa (familia_id, iniciada_por) values ('c9000000-0000-4000-8000-000000000016', 'ia');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000016', 'conteudo') ->> 'motivo',
  'conversa_nao_iniciada_pela_familia', 'mensagem: família que nunca escreveu não recebe mensagem ativa (D-08)');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000016', 'conteudo', 'uazapi') ->> 'motivo',
  'conversa_nao_iniciada_pela_familia', 'mensagem: pela uazapi, também não');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000016', 'conteudo', 'cloud_api') ->> 'pode',
  'true', 'mensagem: pela cloud_api a exigência de conversa iniciada não se aplica');

select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000014', 'interna') ->> 'motivo',
  'familia_mesclada', 'mensagem: família mesclada é recusada');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-0000000000ff', 'conteudo') ->> 'motivo',
  'familia_inexistente', 'mensagem: família inexistente é recusada');
select is(privado.pode_enviar_mensagem(null, 'conteudo') ->> 'motivo',
  'familia_obrigatoria', 'mensagem: sem família, recusado');

-- uma mensagem de conteúdo por dia: execução do sistema já executada hoje
insert into automacao_execucao (automacao_id, familia_id, status, executada_em)
  values ('teste_p09_conteudo', 'c9000000-0000-4000-8000-000000000001', 'executada', now());
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000001', 'conteudo') ->> 'motivo',
  'conteudo_ja_enviado_hoje', 'mensagem: segunda mensagem de conteúdo no mesmo dia é recusada');
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000001', 'operacional') ->> 'pode',
  'true', 'mensagem: o limite diário é só de conteúdo');

-- ... e tarefa de régua concluída hoje ("Enviei", 10.3)
insert into tarefa (tipo, familia_id, titulo, origem_automacao_id, status, concluida_em)
  values ('nutricao_contato', 'c9000000-0000-4000-8000-000000000011', 'Tarefa teste P09', 'teste_p09_regua', 'concluida', now());
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000011', 'conteudo') ->> 'motivo',
  'conteudo_ja_enviado_hoje', 'mensagem: tarefa de régua concluída hoje conta como a mensagem de conteúdo do dia');

-- janela de horário
update parametro set valor = jsonb_build_object(
  'inicio', to_char((clock_timestamp() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI'),
  'fim',    to_char((clock_timestamp() at time zone 'America/Sao_Paulo') + interval '2 hours', 'HH24:MI'))
where chave = 'agente_janela_envio';
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000002', 'operacional') ->> 'motivo',
  'fora_da_janela', 'mensagem: fora da janela de horário, recusado');
update parametro set valor = jsonb_build_object(
  'inicio', to_char((clock_timestamp() at time zone 'America/Sao_Paulo') + interval '2 hours', 'HH24:MI'),
  'fim',    to_char((clock_timestamp() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI'))
where chave = 'agente_janela_envio';
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000002', 'operacional') ->> 'pode',
  'true', 'mensagem: janela que atravessa a meia-noite (início depois do fim) vale do início até o fim do dia seguinte');
delete from parametro where chave = 'agente_janela_envio';
select is(privado.pode_enviar_mensagem('c9000000-0000-4000-8000-000000000002', 'operacional') ->> 'motivo',
  'janela_nao_configurada', 'mensagem: sem o parâmetro da janela, recusado (nenhum horário fixo no SQL)');
insert into parametro (chave, valor) values ('agente_janela_envio', jsonb_build_object(
  'inicio', to_char((clock_timestamp() at time zone 'America/Sao_Paulo') - interval '1 hour', 'HH24:MI'),
  'fim',    to_char((clock_timestamp() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI')));


-- =============================================================================
-- 4. Acionar: quem, AAL e direção (PRD 8.3, 13)
-- =============================================================================

select testes.autenticar_anon();
select throws_ok($$ select api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'atencao') $$,
  '42501', null, 'anon não aciona o freio');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('marketing'), 'aal2');
select throws_ok($$ select api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'atencao') $$,
  '42501', null, 'marketing não tem acesso à família e não aciona');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('sem_papel'), 'aal2');
select throws_ok($$ select api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'atencao') $$,
  '42501', null, 'usuário sem papel não aciona');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('enfermeira'), 'aal1');
select throws_ok($$ select api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'atencao') $$,
  '42501', null, 'enfermeira em aal1 não aciona (perfil com MFA)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('enfermeira2'), 'aal2');
select throws_ok($$ select api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'atencao') $$,
  '42501', null, 'enfermeira de outra família não aciona');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('financeiro'), 'aal2');
select throws_ok($$ select api.acionar_freio('c9000000-0000-4000-8000-000000000012', 'atencao') $$,
  '42501', null, 'financeiro não aciona em família sem contrato (não vê a família)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('enfermeira'), 'aal2');
select is(api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'atencao') ->> 'para', 'atencao',
  'enfermeira atribuída em aal2 aciona o freio, sem motivo');
select throws_ok($$ select api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'normal') $$,
  '22023', null, 'normal não é acionamento');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('financeiro'), 'aal2');
select is(api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'bloqueio_total', 'Motivo sintético do financeiro') ->> 'para',
  'bloqueio_total', 'financeiro aciona em família com contrato');
select throws_ok($$ select api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'atencao') $$,
  '42501', null, 'acionar não desce o freio (bloqueio_total para atencao é reversão)');
select is(api.acionar_freio('c9000000-0000-4000-8000-000000000011', 'bloqueio_total') ->> 'alterado', 'false',
  'acionar no mesmo estado não muda nada');
select testes.encerrar();

select is((select estado_sensivel::text || '|' || estado_sensivel_por::text from familia where id = 'c9000000-0000-4000-8000-000000000011'),
  'bloqueio_total|' || testes.p09('financeiro')::text, 'estado e autor do freio gravados na família');

-- o agente (sistema) nunca baixa o freio
select throws_ok($$ select privado.acionar_freio('c9000000-0000-4000-8000-000000000003', 'atencao', 'agente') $$,
  '42501', null, 'sistema (agente) não desce o freio pelo acionar');

-- família mesclada: o freio vai para a família que ficou
insert into familia (id, nome_exibicao) values ('c9000000-0000-4000-8000-000000000017', 'Família Teste Que Ficou P09');
insert into familia (id, nome_exibicao, mesclada_em_id)
  values ('c9000000-0000-4000-8000-000000000018', 'Família Teste Antiga P09', 'c9000000-0000-4000-8000-000000000017');
select is(privado.acionar_freio('c9000000-0000-4000-8000-000000000018', 'bloqueio_total', 'Perda sintética') ->> 'familia_id',
  'c9000000-0000-4000-8000-000000000017', 'acionar numa família mesclada sobe o freio da família que ficou');
select is((select estado_sensivel::text from familia where id = 'c9000000-0000-4000-8000-000000000017'), 'bloqueio_total',
  'a família que ficou está em bloqueio_total');


-- =============================================================================
-- 5. Tarefa de justificativa, evento restrito e log
-- =============================================================================

select results_eq(
  $$ select responsavel_id, titulo, status::text, prioridade::text from tarefa
      where familia_id = 'c9000000-0000-4000-8000-000000000011' and payload ->> 'acao' = 'justificar_freio' $$,
  $$ values ('a9000000-0000-4000-8000-000000000002'::uuid, 'justificar_freio'::text, 'aberta'::text, 'alta'::text) $$,
  'acionamento sem motivo cria uma tarefa de justificativa para quem acionou; com motivo, nenhuma');
select is((select count(*)::integer from tarefa
            where familia_id = 'c9000000-0000-4000-8000-000000000013' and payload ->> 'acao' = 'justificar_freio'), 0,
  'acionamento com motivo e acionamento do sistema não criam tarefa de justificativa');

select is((select count(*)::integer from evento_familia
            where familia_id = 'c9000000-0000-4000-8000-000000000011' and tipo = 'freio' and restrito), 2,
  'cada acionamento grava evento restrito na linha do tempo');
select ok((select bool_and(dados ? 'de' and dados ? 'para' and dados ? 'por' and not (dados::text like '%Motivo sintético%'))
            from evento_familia where familia_id = 'c9000000-0000-4000-8000-000000000011' and tipo = 'freio'),
  'evento do acionamento traz de, para e quem, sem o texto do motivo novo');

select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select is((select count(*)::integer from evento_familia where tipo = 'freio'), 0,
  'comercial não lê o evento restrito do freio');
select testes.encerrar();

select is((select count(*)::integer from log_auditoria
            where entidade = 'familia' and entidade_id = 'c9000000-0000-4000-8000-000000000011' and acao = 'freio_acionar'), 2,
  'log grava cada acionamento (freio_acionar)');
select ok(not exists (select 1 from log_auditoria
                       where entidade = 'familia' and entidade_id = 'c9000000-0000-4000-8000-000000000013'
                         and coalesce(valor_antes::text, '') || coalesce(valor_depois::text, '') like '%Motivo sintético%'),
  'o motivo do freio não aparece em claro no log (só "[oculto]" e HMAC)');

-- justificar depois
select testes.autenticar_authenticated(testes.p09('comercial2'), 'aal1');
select throws_ok($$ select api.justificar_freio('c9000000-0000-4000-8000-000000000011', 'Justificativa de terceiro') $$,
  '42501', null, 'justificar: quem não acionou (e não é coordenação nem diretoria) não justifica');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('financeiro'), 'aal2');
select throws_ok($$ select api.justificar_freio('c9000000-0000-4000-8000-000000000011', '  ') $$,
  '22023', null, 'justificar: motivo vazio é recusado');
select is((api.justificar_freio('c9000000-0000-4000-8000-000000000011', 'Justificativa sintética P09') ->> 'tarefas_concluidas')::integer, 1,
  'justificar: quem acionou por último grava o motivo e conclui a tarefa de justificativa aberta');
select testes.encerrar();
select results_eq(
  $$ select status::text, concluida_por from tarefa
      where familia_id = 'c9000000-0000-4000-8000-000000000011' and payload ->> 'acao' = 'justificar_freio' $$,
  $$ values ('concluida'::text, 'a9000000-0000-4000-8000-000000000003'::uuid) $$,
  'justificar: a tarefa fica concluída por quem justificou');
select is((select estado_sensivel_motivo from familia where id = 'c9000000-0000-4000-8000-000000000011'),
  'Justificativa sintética P09', 'justificar: motivo gravado na família');


-- =============================================================================
-- 6. "Desfazer" (PRD 8.3 [v4.2], O-07)
-- =============================================================================

insert into familia (id, nome_exibicao) values ('c9000000-0000-4000-8000-000000000019', 'Família Teste Toque P09');
insert into conversa (familia_id, iniciada_por) values ('c9000000-0000-4000-8000-000000000019', 'cliente');
insert into automacao_execucao (id, automacao_id, familia_id, agendada_para)
  values ('c9000000-0000-4000-8000-000000000056', 'teste_p09_conteudo', 'c9000000-0000-4000-8000-000000000019', now() + interval '2 days');

select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select ok(api.acionar_freio('c9000000-0000-4000-8000-000000000019', 'bloqueio_total') ->> 'desfazer_ate' is not null,
  'acionamento do usuário abre o prazo do Desfazer');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('coordenacao'), 'aal2');
select throws_ok($$ select api.desfazer_freio('c9000000-0000-4000-8000-000000000019') $$,
  '42501', null, 'desfazer: só quem acionou (a coordenação usa a reversão)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select is(api.desfazer_freio('c9000000-0000-4000-8000-000000000019') ->> 'para', 'normal',
  'desfazer: quem acionou volta ao estado anterior dentro do prazo, sem coordenação');
select testes.encerrar();

select results_eq(
  $$ select estado_sensivel::text, estado_sensivel_motivo is null, estado_sensivel_em is null, estado_sensivel_por is null
       from familia where id = 'c9000000-0000-4000-8000-000000000019' $$,
  $$ values ('normal'::text, true, true, true) $$,
  'desfazer: estado, motivo, data e autor voltam ao que eram');
select is((select status::text from tarefa
            where familia_id = 'c9000000-0000-4000-8000-000000000019' and payload ->> 'acao' = 'justificar_freio'),
  'cancelada', 'desfazer: a tarefa de justificativa é cancelada');
select is((select status::text from automacao_execucao where id = 'c9000000-0000-4000-8000-000000000056'),
  'abortada_freio', 'desfazer: a execução abortada nesses segundos continua abortada');
select is((select count(*)::integer from log_auditoria
            where entidade_id = 'c9000000-0000-4000-8000-000000000019' and acao in ('freio_acionar', 'freio_desfazer')), 2,
  'desfazer: o log grava o acionamento e o desfazer');
select is((select count(*)::integer from evento_familia
            where familia_id = 'c9000000-0000-4000-8000-000000000019' and tipo = 'freio' and restrito and dados ->> 'acao' = 'desfazer'), 1,
  'desfazer: evento restrito na linha do tempo');

select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select throws_ok($$ select api.desfazer_freio('c9000000-0000-4000-8000-000000000019') $$,
  '42501', null, 'desfazer: não desfaz duas vezes (o último evento já não é o acionamento)');
select testes.encerrar();

-- prazo vencido
update parametro set valor = '1' where chave = 'freio_desfazer_segundos';
select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select is(api.acionar_freio('c9000000-0000-4000-8000-000000000019', 'atencao') ->> 'para', 'atencao',
  'acionamento com prazo de 1 segundo');
select pg_sleep(1.2);
select throws_ok($$ select api.desfazer_freio('c9000000-0000-4000-8000-000000000019') $$,
  '42501', null, 'desfazer: depois do prazo, recusado (vale a reversão da coordenação)');
select testes.encerrar();

-- outra pessoa subiu depois: o desfazer do primeiro acionamento não vale
update parametro set valor = '10' where chave = 'freio_desfazer_segundos';
select testes.autenticar_authenticated(testes.p09('comercial2'), 'aal1');
select is(api.acionar_freio('c9000000-0000-4000-8000-000000000019', 'bloqueio_total') ->> 'para', 'bloqueio_total',
  'outro usuário sobe o freio');
select testes.encerrar();
select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select throws_ok($$ select api.desfazer_freio('c9000000-0000-4000-8000-000000000019') $$,
  '42501', null, 'desfazer: quem acionou antes não desfaz o acionamento de outra pessoa');
select testes.encerrar();

-- sem prazo configurado (0) e freio do sistema: sem Desfazer
update parametro set valor = '0' where chave = 'freio_desfazer_segundos';
select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select is(api.acionar_freio('c9000000-0000-4000-8000-000000000012', 'atencao', 'Motivo sintético') -> 'desfazer_ate',
  'null'::jsonb, 'freio_desfazer_segundos = 0: não há Desfazer');
select throws_ok($$ select api.desfazer_freio('c9000000-0000-4000-8000-000000000012') $$,
  '42501', null, 'desfazer com prazo 0 é recusado');
select testes.encerrar();
update parametro set valor = '10' where chave = 'freio_desfazer_segundos';

select is(privado.acionar_freio('c9000000-0000-4000-8000-000000000016', 'bloqueio_total', 'Termo de alerta sintético') -> 'desfazer_ate',
  'null'::jsonb, 'freio subido pelo sistema (agente ou termo de alerta) não tem Desfazer');
select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select throws_ok($$ select api.desfazer_freio('c9000000-0000-4000-8000-000000000016') $$,
  '42501', null, 'ninguém desfaz o freio do agente: só a reversão da coordenação');
select testes.encerrar();


-- =============================================================================
-- 7. Reversão recusada sem papel (PRD 8.3, invariante 3)
-- =============================================================================

select testes.autenticar_authenticated(testes.p09('comercial'), 'aal2');
select throws_ok($$ select api.reverter_freio('c9000000-0000-4000-8000-000000000003', 'normal', 'Justificativa') $$,
  '42501', null, 'reversão recusada: comercial');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('enfermeira'), 'aal2');
select throws_ok($$ select api.reverter_freio('c9000000-0000-4000-8000-000000000011', 'normal', 'Justificativa') $$,
  '42501', null, 'reversão recusada: enfermeira');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('financeiro'), 'aal2');
select throws_ok($$ select api.reverter_freio('c9000000-0000-4000-8000-000000000011', 'normal', 'Justificativa') $$,
  '42501', null, 'reversão recusada: financeiro');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('sem_papel'), 'aal2');
select throws_ok($$ select api.reverter_freio('c9000000-0000-4000-8000-000000000003', 'normal', 'Justificativa') $$,
  '42501', null, 'reversão recusada: usuário sem papel');
select testes.encerrar();

select throws_ok($$ select privado.reverter_freio('c9000000-0000-4000-8000-000000000003', 'normal', 'Justificativa') $$,
  '42501', null, 'reversão recusada: sistema sem usuário (o agente nunca baixa o freio)');

select testes.autenticar_authenticated(testes.p09('coordenacao'), 'aal1');
select throws_ok($$ select api.reverter_freio('c9000000-0000-4000-8000-000000000003', 'normal', 'Justificativa') $$,
  '42501', null, 'reversão recusada: coordenação sem MFA (aal1)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('coordenacao'), 'aal2');
select throws_ok($$ select api.reverter_freio('c9000000-0000-4000-8000-000000000003', 'normal', '   ') $$,
  '22023', null, 'reversão recusada: sem justificativa');
select throws_ok($$ select api.reverter_freio('c9000000-0000-4000-8000-000000000002', 'bloqueio_total', 'Justificativa') $$,
  '22023', null, 'reversão só desce (subir é acionar)');
select is(api.reverter_freio('c9000000-0000-4000-8000-000000000003', 'atencao', 'Justificativa sintética da coordenação') ->> 'para',
  'atencao', 'coordenação em aal2, com justificativa, desce de bloqueio_total para atencao');
select testes.encerrar();

select results_eq(
  $$ select estado_sensivel::text, estado_sensivel_motivo, estado_sensivel_por from familia where id = 'c9000000-0000-4000-8000-000000000003' $$,
  $$ values ('atencao'::text, 'Justificativa sintética da coordenação'::text, 'a9000000-0000-4000-8000-000000000005'::uuid) $$,
  'reversão para estado intermediário: a justificativa vira o motivo');
select is((select count(*)::integer from log_auditoria
            where entidade_id = 'c9000000-0000-4000-8000-000000000003' and acao = 'freio_reverter'
              and not (valor_depois::text like '%Justificativa sintética%')), 1,
  'reversão grava log freio_reverter, sem a justificativa em claro');

select testes.autenticar_authenticated(testes.p09('diretoria'), 'aal2');
select is(api.reverter_freio('c9000000-0000-4000-8000-000000000003', 'normal', 'Justificativa sintética da diretoria') ->> 'para',
  'normal', 'diretoria em aal2 reverte para normal');
select testes.encerrar();
select results_eq(
  $$ select estado_sensivel::text, estado_sensivel_motivo is null, estado_sensivel_por is null
       from familia where id = 'c9000000-0000-4000-8000-000000000003' $$,
  $$ values ('normal'::text, true, true) $$,
  'reversão para normal limpa motivo e autor');


-- =============================================================================
-- 8. Colunas do freio protegidas
-- =============================================================================

select testes.autenticar_service_role();
select throws_ok($$ update familia set estado_sensivel = 'normal' where id = 'c9000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'service_role não baixa o freio por update direto');
select throws_ok($$ update familia set estado_sensivel_motivo = 'x' where id = 'c9000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'service_role não troca o motivo do freio por update direto');
select throws_ok($$ insert into familia (nome_exibicao, estado_sensivel) values ('Família Teste Forjada P09', 'atencao') $$,
  '42501', null, 'service_role não cria família já com freio');
select lives_ok($$ insert into familia (nome_exibicao) values ('Família Teste Nova P09') $$,
  'service_role cria família em normal');
select lives_ok($$ update familia set bairro = 'Bairro Teste' where id = 'c9000000-0000-4000-8000-000000000004' $$,
  'service_role altera coluna que não é do freio');
select testes.encerrar();

select testes.autenticar_authenticated(testes.p09('comercial'), 'aal1');
select throws_ok($$ update familia set estado_sensivel = 'normal' where id = 'c9000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'comercial não baixa o freio por update direto');
select testes.encerrar();


-- =============================================================================
-- 9. familia_elegivel_marketing (P09 item 4, PRD 6.9)
-- =============================================================================

select set_eq(
  $$ select id from familia_elegivel_marketing
      where id in ('c9000000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000002',
                   'c9000000-0000-4000-8000-000000000004', 'c9000000-0000-4000-8000-000000000014',
                   'c9000000-0000-4000-8000-000000000015', 'c9000000-0000-4000-8000-000000000018') $$,
  $$ values ('c9000000-0000-4000-8000-000000000001'::uuid) $$,
  'familia_elegivel_marketing: só a família normal; atencao, bloqueio_total, encerrado_sensivel, nao_contatar e mescladas ficam fora');
select ok(not exists (select 1 from familia_elegivel_marketing where id = 'c9000000-0000-4000-8000-000000000017'),
  'familia_elegivel_marketing: família sai da view no instante em que o freio sobe');


-- =============================================================================
-- 10. Privilégios das funções novas
-- =============================================================================

select ok(
  not has_function_privilege('authenticated', 'privado.acionar_freio(uuid, estado_sensivel, text)', 'execute')
  and not has_function_privilege('authenticated', 'privado.reverter_freio(uuid, estado_sensivel, text)', 'execute')
  and not has_function_privilege('authenticated', 'privado.desfazer_freio(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'privado.justificar_freio(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'privado.pode_executar(uuid, text, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'privado.pode_enviar_mensagem(uuid, categoria_automacao, modo_mensageria)', 'execute')
  and not has_function_privilege('authenticated', 'privado.tem_acesso_familia(uuid)', 'execute'),
  'authenticated não executa as funções do freio em privado (só pelos wrappers de api)');
select ok(
  not has_function_privilege('service_role', 'privado.pode_executar(uuid, text, uuid)', 'execute')
  and not has_function_privilege('anon', 'api.acionar_freio(uuid, estado_sensivel, text)', 'execute')
  and not has_function_privilege('service_role', 'api.reverter_freio(uuid, estado_sensivel, text)', 'execute'),
  'anon e service_role não executam as funções do freio');
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('privado', 'api')
        and p.proname in ('freio_permite', 'tem_acesso_familia', 'familia_vigente', 'pode_executar', 'pode_enviar_mensagem',
                          'proteger_freio', 'freio_reavaliar_execucoes', 'acionar_freio', 'desfazer_freio',
                          'justificar_freio', 'reverter_freio')
        and not coalesce(p.proconfig, '{}') @> array['search_path=""'] $$,
  'toda função do freio fixa search_path vazio');
select ok(
  (select bool_and(p.provolatile = 'v') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'privado' and p.proname in ('pode_executar', 'pode_enviar_mensagem', 'acionar_freio',
                                                  'desfazer_freio', 'justificar_freio', 'reverter_freio')),
  'funções do freio que gravam ou leem o relógio do envio são volatile');

select * from finish();

rollback;
