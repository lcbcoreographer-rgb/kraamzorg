-- =============================================================================
-- supabase/tests/017_api_crm.sql
--
-- Migration 0017_api_crm (funções do schema api que o CRM já chama):
--   1. api.buscar_duplicatas_pipeline: certas, prováveis e novas gestações,
--      iguais a privado.buscar_duplicatas família por família; mesclada e
--      gestação já ligada não voltam; papéis.
--   2. api.mesclar_familias: pede qual oportunidade fica; a outra vai para
--      perdido (outro, "mesclada em <id>") pela máquina de estado; move
--      conversas, mensagens, tarefas, transferências, sessões e
--      oportunidades pela regra do índice de oportunidade aberta; herda
--      freio e não contatar; evento e log; recusas antes de qualquer escrita.
--   3. api.vincular_nova_gestacao.
--   4. api.pode_enviar_mensagem e api.registrar_envio_tarefa (P18).
--   5. api.pausar_conversa, api.retomar_pausa_conversa,
--      api.resolver_transferencia (nunca devolve à Isadora em
--      humano_comercial) e api.reenviar_notificacao_handoff (P27).
--   6. api.base_conhecimento_listar, _salvar e _aprovar.
--   7. api.metricas_agente: só agregados, com números conferidos.
--   7b. Verificação do fechamento: freio herdado sem "Desfazer" para quem
--      mesclou (F1), historico_sensivel herdado (F2) e
--      api.ultima_ingestao_base (F4).
--   8. Privilégios: security definer, search_path vazio, execute só para
--      authenticated.
-- Em cada função: caminho feliz, papel sem permissão recusado, aal1
-- recusado onde exige aal2, e os efeitos no banco.
--
-- Só dado sintético, criado aqui e desfeito no rollback. DPPs em 2031 e
-- telefones próprios, para não cruzar com o seed.
-- =============================================================================

begin;

select plan(167);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a1700000-0000-4000-8000-000000000001', 'comercial.p17@exemplo.invalid'),
  ('a1700000-0000-4000-8000-000000000002', 'enfermeira.p17@exemplo.invalid'),
  ('a1700000-0000-4000-8000-000000000003', 'financeiro.p17@exemplo.invalid'),
  ('a1700000-0000-4000-8000-000000000004', 'marketing.p17@exemplo.invalid'),
  ('a1700000-0000-4000-8000-000000000005', 'coordenacao.p17@exemplo.invalid'),
  ('a1700000-0000-4000-8000-000000000006', 'diretoria.p17@exemplo.invalid'),
  ('a1700000-0000-4000-8000-000000000007', 'sempapel.p17@exemplo.invalid'),
  ('a1700000-0000-4000-8000-000000000008', 'comercial2.p17@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a1700000-0000-4000-8000-000000000001', 'Perfil Teste P17 comercial',   'comercial.p17@exemplo.invalid',   true),
  ('a1700000-0000-4000-8000-000000000002', 'Perfil Teste P17 enfermeira',  'enfermeira.p17@exemplo.invalid',  true),
  ('a1700000-0000-4000-8000-000000000003', 'Perfil Teste P17 financeiro',  'financeiro.p17@exemplo.invalid',  true),
  ('a1700000-0000-4000-8000-000000000004', 'Perfil Teste P17 marketing',   'marketing.p17@exemplo.invalid',   true),
  ('a1700000-0000-4000-8000-000000000005', 'Perfil Teste P17 coordenacao', 'coordenacao.p17@exemplo.invalid', true),
  ('a1700000-0000-4000-8000-000000000006', 'Perfil Teste P17 diretoria',   'diretoria.p17@exemplo.invalid',   true),
  ('a1700000-0000-4000-8000-000000000007', 'Perfil Teste P17 sem papel',   'sempapel.p17@exemplo.invalid',    true),
  ('a1700000-0000-4000-8000-000000000008', 'Perfil Teste P17 comercial 2', 'comercial2.p17@exemplo.invalid',  true);

insert into usuario_papel (usuario_id, papel) values
  ('a1700000-0000-4000-8000-000000000001', 'comercial'),
  ('a1700000-0000-4000-8000-000000000002', 'enfermeira'),
  ('a1700000-0000-4000-8000-000000000003', 'financeiro'),
  ('a1700000-0000-4000-8000-000000000004', 'marketing'),
  ('a1700000-0000-4000-8000-000000000005', 'coordenacao'),
  ('a1700000-0000-4000-8000-000000000006', 'diretoria'),
  ('a1700000-0000-4000-8000-000000000008', 'comercial');

insert into parametro (chave, valor) values
  ('deduplicacao',              '{"limiar_nome":0.6,"dpp_dias":14,"nova_gestacao_dias":180}'),
  ('agente_pausa_humano_horas', '48'),
  ('agente_followup_horas',     '48'),
  ('link_ficha_modelo',         '"http://localhost:3000/familias/{familia_id}"')
on conflict (chave) do update set valor = excluded.valor;
insert into parametro (chave, valor) values
  ('agente_janela_envio', pg_catalog.jsonb_build_object(
      'inicio', to_char((now() at time zone 'America/Sao_Paulo') - interval '1 hour', 'HH24:MI'),
      'fim',    to_char((now() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI')))
on conflict (chave) do update set valor = excluded.valor;

-- resultados guardados enquanto o teste está como authenticated
create temp table t_r (chave text primary key, r jsonb) on commit drop;
grant all on t_r to public;

-- --- famílias --------------------------------------------------------------------
insert into familia (id, nome_exibicao, dpp, data_nascimento, estado_sensivel, nao_contatar, familia_anterior_id) values
  -- deduplicação
  ('c1700000-0000-4000-8000-000000000001', 'Família Teste Dedup Alfa',      '2031-06-01', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000002', 'Família Teste Outra Beta',      '2031-06-05', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000003', 'Família Teste Gama Duplicada',  '2031-09-01', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000004', 'Família Teste Gama Duplicado',  '2031-09-06', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000005', 'Família Teste Antiga Delta',    '2024-01-10', '2024-01-05', 'normal', false, null),
  ('c1700000-0000-4000-8000-000000000006', 'Família Teste Nova Epsilon',    '2031-12-20', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000007', 'Família Teste Mesclada Zeta',   '2031-06-02', null,         'normal', false, null),
  -- mesclagem
  ('c1700000-0000-4000-8000-000000000011', 'Família Teste Fica Um',         '2032-01-10', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000012', 'Família Teste Sai Um',          '2032-01-12', null,         'atencao', true, null),
  ('c1700000-0000-4000-8000-000000000013', 'Família Teste Fica Dois',       '2032-02-10', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000014', 'Família Teste Sai Dois',        '2032-02-12', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000015', 'Família Teste Fica Tres',       '2032-03-10', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000016', 'Família Teste Sai Tres',        '2032-03-12', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000017', 'Família Teste Fica Quatro',     '2032-04-10', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000018', 'Família Teste Sai Quatro',      '2032-04-12', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000019', 'Família Teste Fica Cinco',      '2032-05-10', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000020', 'Família Teste Sai Cinco',       '2032-05-12', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000021', 'Família Teste Gestacao Antes',  '2025-06-10', '2025-06-08', 'normal', false, null),
  -- mensageria
  ('c1700000-0000-4000-8000-000000000031', 'Família Teste Envio Normal',    '2032-07-10', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000032', 'Família Teste Envio Freio',     '2032-07-12', null,         'bloqueio_total', false, null),
  -- métricas
  ('c1700000-0000-4000-8000-000000000041', 'Família Teste Metrica A',       '2032-09-01', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000042', 'Família Teste Metrica B',       '2032-09-02', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000043', 'Família Teste Metrica C',       '2032-09-03', null,         'normal', false, null),
  ('c1700000-0000-4000-8000-000000000044', 'Família Teste Metrica D',       '2032-09-04', null,         'normal', false, null);

insert into familia (id, nome_exibicao, dpp, familia_anterior_id) values
  ('c1700000-0000-4000-8000-000000000022', 'Família Teste Gestacao Depois', '2032-06-10', 'c1700000-0000-4000-8000-000000000021');
update familia set mesclada_em_id = 'c1700000-0000-4000-8000-000000000001' where id = 'c1700000-0000-4000-8000-000000000007';

insert into pessoa (id, familia_id, papel, nome, telefone_e164) values
  ('c1710000-0000-4000-8000-000000000001', 'c1700000-0000-4000-8000-000000000001', 'mae', 'Pessoa Teste Alfa',     '+5511987650001'),
  ('c1710000-0000-4000-8000-000000000002', 'c1700000-0000-4000-8000-000000000002', 'mae', 'Pessoa Teste Beta',     '+551187650001'),
  ('c1710000-0000-4000-8000-000000000003', 'c1700000-0000-4000-8000-000000000003', 'mae', 'Pessoa Teste Gamaduplicada', null),
  ('c1710000-0000-4000-8000-000000000005', 'c1700000-0000-4000-8000-000000000005', 'mae', 'Pessoa Teste Delta',    '+5511987650005'),
  ('c1710000-0000-4000-8000-000000000006', 'c1700000-0000-4000-8000-000000000006', 'mae', 'Pessoa Teste Epsilon',  '+5511987650005'),
  ('c1710000-0000-4000-8000-000000000007', 'c1700000-0000-4000-8000-000000000007', 'mae', 'Pessoa Teste Zeta',     '+5511987650001'),
  ('c1710000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000011', 'mae', 'Pessoa Teste Fica Um',  '+5511987651112'),
  ('c1710000-0000-4000-8000-000000000012', 'c1700000-0000-4000-8000-000000000012', 'mae', 'Pessoa Teste Sai Um',   '+5511987651112'),
  ('c1710000-0000-4000-8000-000000000021', 'c1700000-0000-4000-8000-000000000021', 'mae', 'Pessoa Teste Antes',    '+5511987652121'),
  ('c1710000-0000-4000-8000-000000000022', 'c1700000-0000-4000-8000-000000000022', 'mae', 'Pessoa Teste Depois',   '+5511987652121');

-- --- oportunidades (o dono cria em qualquer estágio) --------------------------------
insert into oportunidade (id, familia_id, pipeline, estagio_p1, estagio_p2, criado_em, pdf_enviado_em, desconto_pct) values
  ('e1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000011', 1, 'em_conversa_ia', null, now(), null, 0),
  ('e1700000-0000-4000-8000-000000000012', 'c1700000-0000-4000-8000-000000000012', 1, 'qualificado',    null, now(), null, 0),
  ('e1700000-0000-4000-8000-000000000013', 'c1700000-0000-4000-8000-000000000013', 1, 'novo',           null, now(), null, 0),
  ('e1700000-0000-4000-8000-000000000014', 'c1700000-0000-4000-8000-000000000014', 2, 'sessao_venda_realizada', 'em_negociacao', now(), null, 0),
  ('e1700000-0000-4000-8000-000000000015', 'c1700000-0000-4000-8000-000000000015', 1, 'em_conversa_ia', null, now(), null, 0),
  ('e1700000-0000-4000-8000-000000000016', 'c1700000-0000-4000-8000-000000000016', 1, 'novo',           null, now(), null, 0),
  ('e1700000-0000-4000-8000-000000000017', 'c1700000-0000-4000-8000-000000000017', 1, 'novo',           null, now(), null, 0),
  ('e1700000-0000-4000-8000-000000000018', 'c1700000-0000-4000-8000-000000000018', 2, 'sessao_venda_realizada', 'ganho', now(), null, 0),
  ('e1700000-0000-4000-8000-000000000031', 'c1700000-0000-4000-8000-000000000031', 1, 'em_conversa_ia', null, now(), null, 0),
  -- métricas (março de 2020)
  ('e1700000-0000-4000-8000-000000000041', 'c1700000-0000-4000-8000-000000000041', 1, 'qualificado',            null,    '2020-03-05 09:00-03', '2020-03-05 11:00-03', 0),
  ('e1700000-0000-4000-8000-000000000042', 'c1700000-0000-4000-8000-000000000042', 1, 'sessao_venda_agendada',  null,    '2020-03-06 09:00-03', null,                  0),
  ('e1700000-0000-4000-8000-000000000043', 'c1700000-0000-4000-8000-000000000043', 2, 'sessao_venda_realizada', 'ganho', '2020-03-07 09:00-03', '2020-03-10 09:00-03', 10),
  ('e1700000-0000-4000-8000-000000000044', 'c1700000-0000-4000-8000-000000000044', 1, 'novo',                   null,    '2020-03-08 09:00-03', null,                  0);

-- contrato na família que sai do cenário 5 (a mesclagem é recusada)
insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao)
select 'c1700000-0000-4000-8000-000000000020', (select id from pacote_versao order by id limit 1), 100, 'teste';

-- --- conversas, mensagens, transferências, tarefas ----------------------------------
insert into conversa (id, familia_id, pessoa_id, telefone_e164, classificacao, iniciada_por, criado_em,
                      agente_pausado_ate, agente_pausa_motivo, agente_encerrado_em, agente_encerrado_motivo, ultima_entrada_em) values
  -- mesclagem: conversa da família que sai
  ('d1700000-0000-4000-8000-000000000012', 'c1700000-0000-4000-8000-000000000012', 'c1710000-0000-4000-8000-000000000012',
   '+5511987651112', 'lead', 'cliente', now(), null, null, null, null, now()),
  -- mensageria
  ('d1700000-0000-4000-8000-000000000031', 'c1700000-0000-4000-8000-000000000031', null, '+5511987653131', 'lead', 'cliente', now(), null, null, null, null, now()),
  ('d1700000-0000-4000-8000-000000000032', 'c1700000-0000-4000-8000-000000000032', null, '+5511987653232', 'lead', 'cliente', now(), null, null, null, null, now()),
  -- agente: K1 sem pausa; K2 em humano_comercial com pausa
  ('d1700000-0000-4000-8000-000000000051', null, null, '+5511987655151', 'lead', 'cliente', now(), null, null, null, null, now()),
  ('d1700000-0000-4000-8000-000000000052', null, null, '+5511987655252', 'lead', 'cliente', now(),
   now() + interval '10 hours', 'Pausa de teste', now(), 'reuniao', now()),
  -- métricas
  ('d1700000-0000-4000-8000-000000000041', 'c1700000-0000-4000-8000-000000000041', null, '+5511987654141', 'lead', 'cliente', '2020-03-05 09:59-03', null, null, null, null, null),
  ('d1700000-0000-4000-8000-000000000042', 'c1700000-0000-4000-8000-000000000042', null, '+5511987654242', 'lead', 'ia',      '2020-03-06 08:59-03', null, null, null, null, null),
  ('d1700000-0000-4000-8000-000000000043', 'c1700000-0000-4000-8000-000000000043', null, '+5511987654343', 'nao_classificado', 'cliente', '2020-03-07 11:59-03', null, null, null, null, null),
  ('d1700000-0000-4000-8000-000000000044', null, null, '+5511987654444', 'fornecedor', 'cliente', '2020-03-08 09:00-03', null, null, null, null, null);

insert into mensagem (conversa_id, direcao, enviado_por, conteudo, enviada_em) values
  ('d1700000-0000-4000-8000-000000000012', 'entrada', 'cliente', 'Mensagem sintética da família que sai', now()),
  -- L1: entrada 10:00, saída 10:06, entrada 10:30 (respondeu), saída depois do silêncio do PDF
  ('d1700000-0000-4000-8000-000000000041', 'entrada', 'cliente', 'oi', '2020-03-05 10:00-03'),
  ('d1700000-0000-4000-8000-000000000041', 'saida',   'ia',      'olá', '2020-03-05 10:06-03'),
  ('d1700000-0000-4000-8000-000000000041', 'entrada', 'cliente', 'quero saber mais', '2020-03-05 10:30-03'),
  ('d1700000-0000-4000-8000-000000000041', 'saida',   'ia',      'retomada', '2020-03-08 12:00-03'),
  -- L2: só a abertura nossa, sem resposta
  ('d1700000-0000-4000-8000-000000000042', 'saida',   'humano',  'abertura', '2020-03-06 09:00-03'),
  -- L3: entrada 12:00, saída 12:10, sem resposta depois
  ('d1700000-0000-4000-8000-000000000043', 'entrada', 'cliente', 'oi', '2020-03-07 12:00-03'),
  ('d1700000-0000-4000-8000-000000000043', 'saida',   'ia',      'olá', '2020-03-07 12:10-03'),
  -- fornecedor: fora das métricas
  ('d1700000-0000-4000-8000-000000000044', 'entrada', 'cliente', 'proposta', '2020-03-08 09:00-03');

insert into sessao_venda (familia_id, agendada_para, status) values
  ('c1700000-0000-4000-8000-000000000012', now() + interval '3 days', 'agendada'),
  ('c1700000-0000-4000-8000-000000000041', '2020-03-12 10:00-03', 'agendada');

insert into handoff (id, conversa_id, familia_id, motivo, destino, prioridade, resumo, status, notificacao_ok, assumido_por, assumido_em) values
  ('b1700000-0000-4000-8000-000000000012', 'd1700000-0000-4000-8000-000000000012', 'c1700000-0000-4000-8000-000000000012',
   'pediu_humano', 'comercial', 'alta', 'Resumo sintético', 'aberto', true, null, null),
  ('b1700000-0000-4000-8000-000000000052', 'd1700000-0000-4000-8000-000000000052', null,
   'reuniao', 'comercial', 'alta', 'Resumo sintético', 'assumido', true, 'a1700000-0000-4000-8000-000000000001', now()),
  ('b1700000-0000-4000-8000-000000000051', 'd1700000-0000-4000-8000-000000000051', 'c1700000-0000-4000-8000-000000000031',
   'duvida_sem_resposta', 'comercial', 'normal', 'Resumo sintético', 'aberto', false, null, null),
  ('b1700000-0000-4000-8000-000000000053', 'd1700000-0000-4000-8000-000000000051', null,
   'outro', 'coordenacao_clinica', 'normal', 'Resumo sintético', 'resolvido', false, null, null);

insert into tarefa (id, tipo, familia_id, responsavel_id, papel_responsavel, titulo, payload, status, origem_automacao_id, criado_em, concluida_em) values
  ('f1700000-0000-4000-8000-000000000012', 'outro', 'c1700000-0000-4000-8000-000000000012', null, 'comercial', 'tarefa_teste', '{}', 'aberta', null, now(), null),
  ('f1700000-0000-4000-8000-000000000001', 'followup_comercial', 'c1700000-0000-4000-8000-000000000031', null, 'comercial', 'tarefa_teste',
   '{"textoSugerido":"Oi, tudo bem?","categoria":"operacional","cadencia_etapa":2,"telefoneE164":"+5511987653131"}', 'aberta', null, now(), null),
  ('f1700000-0000-4000-8000-000000000002', 'followup_comercial', 'c1700000-0000-4000-8000-000000000031', 'a1700000-0000-4000-8000-000000000008', null, 'tarefa_teste',
   '{"textoSugerido":"Oi"}', 'aberta', null, now(), null),
  ('f1700000-0000-4000-8000-000000000003', 'followup_comercial', 'c1700000-0000-4000-8000-000000000032', null, 'comercial', 'tarefa_teste',
   '{"textoSugerido":"Oi","categoria":"operacional"}', 'aberta', null, now(), null),
  ('f1700000-0000-4000-8000-000000000004', 'outro', 'c1700000-0000-4000-8000-000000000031', null, 'enfermeira', 'tarefa_teste',
   '{"textoSugerido":"Oi","categoria":"operacional"}', 'aberta', null, now(), null),
  ('f1700000-0000-4000-8000-000000000005', 'nutricao_contato', 'c1700000-0000-4000-8000-000000000031', null, 'comercial', 'tarefa_teste',
   '{"textoSugerido":"Oi","categoria":"operacional"}', 'aberta', 'regua_nutricao', now(), null),
  -- métricas: follow-up humano concluído de família sem PDF (não entra na base do indicador)
  ('f1700000-0000-4000-8000-000000000041', 'followup_comercial', 'c1700000-0000-4000-8000-000000000042', null, 'comercial', 'tarefa_teste',
   '{}', 'concluida', null, '2020-03-06 09:00-03', '2020-03-09 09:00-03');

insert into automacao_execucao (automacao_id, familia_id, agendada_para, status)
values ('regua_nutricao', 'c1700000-0000-4000-8000-000000000012', now() + interval '1 day', 'agendada');


-- =============================================================================
-- 1. api.buscar_duplicatas_pipeline
-- =============================================================================

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
insert into t_r values ('dup', api.buscar_duplicatas_pipeline());
select testes.encerrar();

select ok((select r from t_r where chave = 'dup') ?& array['certas', 'provaveis', 'novasGestacoes', 'indisponivelNoBanco'],
  'duplicatas: comercial em aal1 lê o resultado com as chaves da tela');
select ok(exists (
    select 1 from jsonb_array_elements((select r -> 'certas' from t_r where chave = 'dup')) e
    where e -> 'a' ->> 'id' = 'c1700000-0000-4000-8000-000000000001'
      and e -> 'b' ->> 'id' = 'c1700000-0000-4000-8000-000000000002'
      and e ->> 'tipo' = 'certa' and e ->> 'telefone' is not null),
  'duplicata certa pelo telefone normalizado (com e sem o nono dígito)');
select ok(exists (
    select 1 from jsonb_array_elements((select r -> 'provaveis' from t_r where chave = 'dup')) e
    where e -> 'a' ->> 'id' = 'c1700000-0000-4000-8000-000000000003'
      and e -> 'b' ->> 'id' = 'c1700000-0000-4000-8000-000000000004'
      and (e ->> 'similaridade')::numeric >= 0.6 and (e ->> 'diasEntreDpp')::integer = 5),
  'duplicata provável por nome parecido e DPP a 5 dias');
select ok(exists (
    select 1 from jsonb_array_elements((select r -> 'novasGestacoes' from t_r where chave = 'dup')) e
    where e -> 'a' ->> 'id' = 'c1700000-0000-4000-8000-000000000006'
      and e -> 'b' ->> 'id' = 'c1700000-0000-4000-8000-000000000005'),
  'mesmo telefone com datas distantes vira nova gestação (a = mais recente, b = anterior), não duplicata');
select ok(not exists (
    select 1 from t_r, jsonb_array_elements(r -> 'certas') e
    where chave = 'dup' and 'c1700000-0000-4000-8000-000000000005' in (e -> 'a' ->> 'id', e -> 'b' ->> 'id')),
  'o par de nova gestação não aparece como duplicata certa');
select ok(not exists (
    select 1 from t_r,
      lateral (select jsonb_array_elements(r -> 'certas') e
               union all select jsonb_array_elements(r -> 'provaveis')
               union all select jsonb_array_elements(r -> 'novasGestacoes')) x
    where chave = 'dup' and 'c1700000-0000-4000-8000-000000000007' in (x.e -> 'a' ->> 'id', x.e -> 'b' ->> 'id')),
  'família já mesclada não aparece em nenhum par');
select ok(not exists (
    select 1 from t_r,
      lateral (select jsonb_array_elements(r -> 'certas') e
               union all select jsonb_array_elements(r -> 'provaveis')
               union all select jsonb_array_elements(r -> 'novasGestacoes')) x
    where chave = 'dup'
      and array[x.e -> 'a' ->> 'id', x.e -> 'b' ->> 'id'] @> array['c1700000-0000-4000-8000-000000000021', 'c1700000-0000-4000-8000-000000000022']),
  'gestações já ligadas pela regra 12 não voltam como sugestão');
select ok(not exists (
    select 1 from t_r, jsonb_array_elements(r -> 'certas') e
    where chave = 'dup' and e -> 'a' ? 'origem'),
  'o par não carrega origem do lead nem nada além de id, nome, bairro, cidade e DPP');

-- mesma regra de privado.buscar_duplicatas, família por família
create temp table t_pares on commit drop as
  select least((e -> 'a' ->> 'id')::uuid, (e -> 'b' ->> 'id')::uuid) as x,
         greatest((e -> 'a' ->> 'id')::uuid, (e -> 'b' ->> 'id')::uuid) as y, k.tipo
  from t_r,
  lateral (select 'duplicata_certa' as tipo, jsonb_array_elements(r -> 'certas') as e
           union all select 'duplicata_provavel', jsonb_array_elements(r -> 'provaveis')
           union all select 'nova_gestacao', jsonb_array_elements(r -> 'novasGestacoes')) k(tipo, e)
  where chave = 'dup';
select set_eq(
  $$ select least(f.id, d.outra_familia_id), greatest(f.id, d.outra_familia_id), d.tipo::text
     from familia f cross join lateral privado.buscar_duplicatas(f.id) d
     where f.id::text like 'c1700000-%' and f.mesclada_em_id is null $$,
  $$ select x, y, tipo from t_pares where x::text like 'c1700000-%' or y::text like 'c1700000-%' $$,
  'duplicatas: os pares das famílias do teste são exatamente os de privado.buscar_duplicatas');

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal2');
select lives_ok($$ select api.buscar_duplicatas_pipeline() $$, 'duplicatas: coordenação em aal2 lê');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($$ select api.buscar_duplicatas_pipeline() $$, '42501', null,
  'duplicatas: coordenação em aal1 é recusada (perfil com MFA)');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.buscar_duplicatas_pipeline() $$, '42501', null, 'duplicatas: enfermeira é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$ select api.buscar_duplicatas_pipeline() $$, '42501', null, 'duplicatas: financeiro é recusado');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$ select api.buscar_duplicatas_pipeline() $$, '42501', null, 'duplicatas: marketing é recusado');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000007', 'aal2');
select throws_ok($$ select api.buscar_duplicatas_pipeline() $$, '42501', null, 'duplicatas: perfil sem papel é recusado');
select testes.autenticar_anon();
select throws_ok($$ select api.buscar_duplicatas_pipeline() $$, '42501', null, 'duplicatas: anon é recusado');
select testes.encerrar();


-- =============================================================================
-- 2. api.mesclar_familias
-- =============================================================================

-- recusas de papel e AAL
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000012', 'e1700000-0000-4000-8000-000000000011') $$,
  '42501', null, 'mesclagem: coordenação é recusada (só lê família, ADR 0002)');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000012', 'e1700000-0000-4000-8000-000000000011') $$,
  '42501', null, 'mesclagem: enfermeira é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000012', 'e1700000-0000-4000-8000-000000000011') $$,
  '42501', null, 'mesclagem: diretoria em aal1 é recusada (perfil com MFA)');

-- recusas de regra, antes de qualquer escrita
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000011') $$,
  '22023', null, 'mesclagem: a mesma família dos dois lados é recusada');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000012') $$,
  '22023', null, 'mesclagem: com oportunidade aberta nas duas, sem dizer qual fica, é recusada');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000012', 'e1700000-0000-4000-8000-000000000031') $$,
  '22023', null, 'mesclagem: oportunidade de outra família é recusada');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000015', 'c1700000-0000-4000-8000-000000000016', 'e1700000-0000-4000-8000-000000000016') $$,
  '22023', null, 'mesclagem: perdedora no pipeline 1 da família que fica é recusada (o índice não cabe duas)');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000017', 'c1700000-0000-4000-8000-000000000018', 'e1700000-0000-4000-8000-000000000017') $$,
  '22023', null, 'mesclagem: perdedora depois do ganho é recusada');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000019', 'c1700000-0000-4000-8000-000000000020') $$,
  '22023', null, 'mesclagem: família que sai com contrato é recusada');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000021', 'c1700000-0000-4000-8000-000000000022') $$,
  '22023', null, 'mesclagem: gestações ligadas pela regra 12 não se mesclam');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000001', 'c1700000-0000-4000-8000-000000000007') $$,
  '22023', null, 'mesclagem: família já mesclada é recusada');
select throws_ok($$ select api.mesclar_familias('c1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-0000000000ff', null) $$,
  'P0002', null, 'mesclagem: família inexistente é recusada');
select testes.encerrar();

select is((select estagio_p1::text from oportunidade where id = 'e1700000-0000-4000-8000-000000000016'), 'novo',
  'a recusa não mexeu na oportunidade (a transição não chegou a acontecer)');
select is((select estagio_p2::text from oportunidade where id = 'e1700000-0000-4000-8000-000000000018'), 'ganho',
  'a recusa depois do ganho não mexeu na oportunidade');

-- caminho feliz 1: as duas abertas no P1; a que sai perde e fica na família que sai
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
insert into t_r values ('m1', api.mesclar_familias('c1700000-0000-4000-8000-000000000011', 'c1700000-0000-4000-8000-000000000012',
                                                   'e1700000-0000-4000-8000-000000000011'));
select testes.encerrar();

select is((select r ->> 'oportunidade_perdida_id' from t_r where chave = 'm1'), 'e1700000-0000-4000-8000-000000000012',
  'mesclagem: devolve a oportunidade que perdeu');
select results_eq(
  $$ select estagio_p1::text, motivo_perda::text, motivo_perda_detalhe from oportunidade where id = 'e1700000-0000-4000-8000-000000000012' $$,
  $$ values ('perdido', 'outro', 'mesclada em c1700000-0000-4000-8000-000000000011') $$,
  'mesclagem: a outra oportunidade vai para perdido, motivo outro e detalhe "mesclada em <id>"');
select ok(exists (select 1 from evento_familia e
                  where e.tipo = 'estagio' and e.dados ->> 'entidade_id' = 'e1700000-0000-4000-8000-000000000012'
                    and e.dados ->> 'para' = 'perdido'),
  'mesclagem: a perda passou pela máquina de estado (evento de estágio)');
select is((select familia_id from oportunidade where id = 'e1700000-0000-4000-8000-000000000012'), 'c1700000-0000-4000-8000-000000000012'::uuid,
  'mesclagem: perdida no P1 continua na família que sai (o índice conta perdido no P1 como aberta)');
select is((select count(*)::integer from oportunidade o
           where o.familia_id = 'c1700000-0000-4000-8000-000000000011'
             and (o.estagio_p2 is null or o.estagio_p2 not in ('perdido', 'cancelado', 'distrato'))), 1,
  'mesclagem: a família que fica termina com uma oportunidade aberta');
select is((select mesclada_em_id from familia where id = 'c1700000-0000-4000-8000-000000000012'), 'c1700000-0000-4000-8000-000000000011'::uuid,
  'mesclagem: marca mesclada_em_id');
select is((select familia_id from conversa where id = 'd1700000-0000-4000-8000-000000000012'), 'c1700000-0000-4000-8000-000000000011'::uuid,
  'mesclagem: a conversa vai para a família que fica');
select is((select pessoa_id from conversa where id = 'd1700000-0000-4000-8000-000000000012'), 'c1710000-0000-4000-8000-000000000011'::uuid,
  'mesclagem: a conversa passa a apontar para a pessoa da família que fica com o mesmo telefone');
select is((select count(*)::integer from mensagem m join conversa c on c.id = m.conversa_id
           where c.familia_id = 'c1700000-0000-4000-8000-000000000011'), 1,
  'mesclagem: as mensagens acompanham a conversa');
select is((select familia_id from tarefa where id = 'f1700000-0000-4000-8000-000000000012'), 'c1700000-0000-4000-8000-000000000011'::uuid,
  'mesclagem: a tarefa vai para a família que fica');
select is((select familia_id from handoff where id = 'b1700000-0000-4000-8000-000000000012'), 'c1700000-0000-4000-8000-000000000011'::uuid,
  'mesclagem: a transferência vai para a família que fica');
select is((select count(*)::integer from sessao_venda where familia_id = 'c1700000-0000-4000-8000-000000000011'), 1,
  'mesclagem: a sessão de venda vai para a família que fica');
select is((select status::text from automacao_execucao where familia_id = 'c1700000-0000-4000-8000-000000000012' and automacao_id = 'regua_nutricao'), 'cancelada',
  'mesclagem: execução agendada da família que sai é cancelada');
select is((select estado_sensivel::text from familia where id = 'c1700000-0000-4000-8000-000000000011'), 'atencao',
  'mesclagem: o freio mais alto da família que sai sobe na que fica');
select ok((select nao_contatar from familia where id = 'c1700000-0000-4000-8000-000000000011'),
  'mesclagem: não contatar da família que sai passa para a que fica');
select ok(exists (select 1 from evento_familia e where e.familia_id = 'c1700000-0000-4000-8000-000000000011'
                    and e.tipo = 'mesclagem' and e.dados ->> 'familia_perde_id' = 'c1700000-0000-4000-8000-000000000012'),
  'mesclagem: evento na ficha da família que fica');
select ok(exists (select 1 from log_auditoria l where l.acao = 'mesclagem' and l.entidade = 'familia'
                    and l.entidade_id = 'c1700000-0000-4000-8000-000000000012'
                    and l.usuario_id = 'a1700000-0000-4000-8000-000000000001'
                    and l.valor_depois ->> 'mesclada_em_id' = 'c1700000-0000-4000-8000-000000000011'),
  'mesclagem: log_auditoria com quem mesclou e o vínculo');
select ok(not exists (select 1 from log_auditoria l where l.acao = 'mesclagem'
                        and l.valor_depois::text like '%Sai Um%'),
  'mesclagem: o log não copia nome de família');
select is((select count(*)::integer from evento_familia where familia_id = 'c1700000-0000-4000-8000-000000000012' and tipo = 'mesclagem'), 0,
  'mesclagem: os eventos da família que sai não se movem nem se duplicam');

-- caminho feliz 2: a que sai está no P2; vai para perdido e é movida
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal2');
insert into t_r values ('m2', api.mesclar_familias('c1700000-0000-4000-8000-000000000013', 'c1700000-0000-4000-8000-000000000014',
                                                   'e1700000-0000-4000-8000-000000000013'));
select testes.encerrar();
select results_eq(
  $$ select estagio_p2::text, motivo_perda::text, familia_id from oportunidade where id = 'e1700000-0000-4000-8000-000000000014' $$,
  $$ values ('perdido', 'outro', 'c1700000-0000-4000-8000-000000000013'::uuid) $$,
  'mesclagem (diretoria em aal2): perdedora no P2 vai para perdido e depois é movida para a família que fica');
select is((select (r -> 'movidos' ->> 'oportunidades')::integer from t_r where chave = 'm2'), 1,
  'mesclagem: devolve a contagem do que moveu');


-- =============================================================================
-- 3. api.vincular_nova_gestacao
-- =============================================================================

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($$ select api.vincular_nova_gestacao('c1700000-0000-4000-8000-000000000006', 'c1700000-0000-4000-8000-000000000005') $$,
  '42501', null, 'nova gestação: coordenação é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$ select api.vincular_nova_gestacao('c1700000-0000-4000-8000-000000000006', 'c1700000-0000-4000-8000-000000000005') $$,
  '42501', null, 'nova gestação: diretoria em aal1 é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.vincular_nova_gestacao('c1700000-0000-4000-8000-000000000005', 'c1700000-0000-4000-8000-000000000006') $$,
  '22023', null, 'nova gestação: a anterior precisa ter data anterior (regra de privado.vincular_nova_gestacao)');
select is(api.vincular_nova_gestacao('c1700000-0000-4000-8000-000000000006', 'c1700000-0000-4000-8000-000000000005') ->> 'alterado', 'true',
  'nova gestação: comercial em aal1 liga a gestação nova à anterior');
insert into t_r values ('dup2', api.buscar_duplicatas_pipeline());
select testes.encerrar();
select is((select familia_anterior_id from familia where id = 'c1700000-0000-4000-8000-000000000006'), 'c1700000-0000-4000-8000-000000000005'::uuid,
  'nova gestação: grava familia_anterior_id');
select ok(exists (select 1 from evento_familia where familia_id = 'c1700000-0000-4000-8000-000000000006' and tipo = 'nova_gestacao'),
  'nova gestação: evento na ficha');
select ok(not exists (
    select 1 from jsonb_array_elements((select r -> 'novasGestacoes' from t_r where chave = 'dup2')) e
    where e -> 'a' ->> 'id' = 'c1700000-0000-4000-8000-000000000006'),
  'nova gestação: depois do vínculo o par não é mais sugerido');


-- =============================================================================
-- 4. api.pode_enviar_mensagem
-- =============================================================================

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select is(api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'operacional', 'manual'),
          '{"pode": true, "motivo": null}'::jsonb,
  'pode_enviar_mensagem: comercial em aal1, família normal que escreveu, dentro da janela: pode');
select is(api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000032', 'operacional', 'manual') ->> 'motivo', 'freio_bloqueio_total',
  'pode_enviar_mensagem: bloqueio_total devolve o motivo do freio');
select is(api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'interna', 'manual') ->> 'motivo', 'categoria_interna',
  'pode_enviar_mensagem: interna nunca fala com a família');
select is(api.pode_enviar_mensagem('c1700000-0000-4000-8000-0000000000ff', 'operacional', 'manual') ->> 'motivo', 'familia_inexistente',
  'pode_enviar_mensagem: família inexistente devolve o motivo, sem erro');
insert into t_r values ('pode_conteudo', api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'conteudo', 'cloud_api'));
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'operacional', 'manual') $$,
  '42501', null, 'pode_enviar_mensagem: enfermeira sem a família atribuída é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$ select api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'operacional', 'manual') $$,
  '42501', null, 'pode_enviar_mensagem: financeiro sem contrato da família é recusado');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$ select api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'operacional', 'manual') $$,
  '42501', null, 'pode_enviar_mensagem: marketing é recusado');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($$ select api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'operacional', 'manual') $$,
  '42501', null, 'pode_enviar_mensagem: coordenação em aal1 é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal2');
select is(api.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'operacional', 'manual') ->> 'pode', 'true',
  'pode_enviar_mensagem: coordenação em aal2 consulta');
select testes.encerrar();
select is((select r from t_r where chave = 'pode_conteudo'),
          privado.pode_enviar_mensagem('c1700000-0000-4000-8000-000000000031', 'conteudo', 'cloud_api'),
  'pode_enviar_mensagem: devolve exatamente o de privado.pode_enviar_mensagem (categoria e canal repassados)');


-- =============================================================================
-- 5. api.registrar_envio_tarefa
-- =============================================================================

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000002', 'Oi') $$,
  '42501', null, 'enviei: tarefa de outra pessoa é recusada');
select throws_ok($$ select api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000004', 'Oi') $$,
  '42501', null, 'enviei: tarefa do papel enfermeira não é do comercial');
select throws_ok($$ select api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000003', 'Oi') $$,
  'P0001', 'api.registrar_envio_tarefa: envio recusado: freio_bloqueio_total',
  'enviei: família em bloqueio_total recusa com o código do freio');
select throws_ok($$ select api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000001', '   ') $$,
  '22023', null, 'enviei: texto vazio é recusado');
insert into t_r values ('env', api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000001',
                                                          'Oi, tudo bem? Meu CPF é 123.456.789-09'));
select throws_ok($$ select api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000001', 'Oi de novo') $$,
  '22023', null, 'enviei: tarefa já concluída é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000004', 'Oi') $$,
  '42501', null, 'enviei: enfermeira responsável, mas sem a família atribuída, é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$ select api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000005', 'Oi') $$,
  '42501', null, 'enviei: diretoria em aal1 é recusada (perfil com MFA)');
select testes.encerrar();

select is((select status::text from tarefa where id = 'f1700000-0000-4000-8000-000000000003'), 'aberta',
  'enviei: a recusa do freio deixa a tarefa aberta');
select is((select count(*)::integer from mensagem where conversa_id = 'd1700000-0000-4000-8000-000000000032'), 0,
  'enviei: a recusa do freio não grava mensagem');
select results_eq(
  $$ select status::text, concluida_por from tarefa where id = 'f1700000-0000-4000-8000-000000000001' $$,
  $$ values ('concluida', 'a1700000-0000-4000-8000-000000000001'::uuid) $$,
  'enviei: conclui a tarefa com quem enviou');
select results_eq(
  $$ select direcao::text, enviado_por::text, conteudo, criado_por from mensagem
     where id = (select (r ->> 'mensagem_id')::uuid from t_r where chave = 'env') $$,
  $$ values ('saida', 'humano', 'Oi, tudo bem? Meu CPF é [CPF ocultado]', 'a1700000-0000-4000-8000-000000000001'::uuid) $$,
  'enviei: grava a mensagem humana de saída, com o CPF mascarado');
select is((select (r ->> 'conversa_id')::uuid from t_r where chave = 'env'), 'd1700000-0000-4000-8000-000000000031'::uuid,
  'enviei: na conversa iniciada pela família');
select is((select r ->> 'categoria' from t_r where chave = 'env'), 'operacional',
  'enviei: categoria do payload quando a tarefa não veio de automação');
select is((select cadencia_etapa from oportunidade where id = 'e1700000-0000-4000-8000-000000000031'), 2,
  'enviei: cadencia_etapa do payload avança a cadência da oportunidade aberta');
select ok((select ultima_saida_em is not null from conversa where id = 'd1700000-0000-4000-8000-000000000031'),
  'enviei: marca a última saída da conversa');
select ok(exists (select 1 from log_auditoria l where l.entidade = 'mensagem' and l.acao = 'insert'
                    and l.entidade_id = (select r ->> 'mensagem_id' from t_r where chave = 'env')
                    and l.valor_depois ->> 'conteudo' = '[oculto]'),
  'enviei: a mensagem entra na auditoria com o conteúdo oculto');

-- categoria da automação vale mais que o payload: regua_nutricao é conteudo;
-- depois da primeira mensagem de conteúdo do dia, a segunda é recusada
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select is(api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000005', 'Oi') ->> 'categoria', 'conteudo',
  'enviei: categoria da automação que criou a tarefa vale mais que o payload');
select testes.encerrar();
insert into tarefa (id, tipo, familia_id, papel_responsavel, titulo, payload, origem_automacao_id)
values ('f1700000-0000-4000-8000-000000000006', 'nutricao_contato', 'c1700000-0000-4000-8000-000000000031', 'comercial', 'tarefa_teste', '{}', 'regua_nutricao');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.registrar_envio_tarefa('f1700000-0000-4000-8000-000000000006', 'Outra') $$,
  'P0001', 'api.registrar_envio_tarefa: envio recusado: conteudo_ja_enviado_hoje',
  'enviei: segunda mensagem de conteúdo no dia é recusada (reconsulta o freio no instante)');
select testes.encerrar();


-- =============================================================================
-- 6. Pausa, retomada, resolver e reenviar (P27)
-- =============================================================================

-- pausar
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.pausar_conversa('d1700000-0000-4000-8000-000000000051', 'x') $$,
  '42501', null, 'pausar: enfermeira é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$ select api.pausar_conversa('d1700000-0000-4000-8000-000000000051', 'x') $$,
  '42501', null, 'pausar: marketing é recusado');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($$ select api.pausar_conversa('d1700000-0000-4000-8000-000000000051', 'x') $$,
  '42501', null, 'pausar: coordenação em aal1 é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.pausar_conversa('d1700000-0000-4000-8000-0000000000ff', 'x') $$,
  'P0002', null, 'pausar: conversa inexistente');
insert into t_r values ('pausa', api.pausar_conversa('d1700000-0000-4000-8000-000000000051', 'Pausada por [Perfil] de teste.'));
select testes.encerrar();

select ok((select agente_pausado_ate between now() + interval '47 hours 59 minutes' and now() + interval '48 hours 1 minute'
           from conversa where id = 'd1700000-0000-4000-8000-000000000051'),
  'pausar: comercial em aal1 pausa por agente_pausa_humano_horas (48 h)');
select is((select agente_pausa_motivo from conversa where id = 'd1700000-0000-4000-8000-000000000051'), 'Pausada por Perfil de teste.',
  'pausar: motivo gravado como campo livre (sem colchetes)');
select ok(exists (select 1 from log_auditoria where acao = 'agente_pausado' and entidade_id = 'd1700000-0000-4000-8000-000000000051'
                    and usuario_id = 'a1700000-0000-4000-8000-000000000001'),
  'pausar: log agente_pausado');

update conversa set agente_pausado_ate = now() + interval '100 hours' where id = 'd1700000-0000-4000-8000-000000000051';
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal2');
select lives_ok($$ select api.pausar_conversa('d1700000-0000-4000-8000-000000000051', null) $$, 'pausar: coordenação em aal2 pausa');
select testes.encerrar();
select ok((select agente_pausado_ate > now() + interval '99 hours' from conversa where id = 'd1700000-0000-4000-8000-000000000051'),
  'pausar: nunca encurta uma pausa maior que já vale');
select is((select agente_pausa_motivo from conversa where id = 'd1700000-0000-4000-8000-000000000051'), 'Pausada por Perfil de teste.',
  'pausar: sem motivo novo, mantém o anterior');

delete from parametro where chave = 'agente_pausa_humano_horas';
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.pausar_conversa('d1700000-0000-4000-8000-000000000051', 'x') $$,
  '22023', null, 'pausar: sem o parâmetro de duração, recusa (nenhum número do código)');
select testes.encerrar();
insert into parametro (chave, valor) values ('agente_pausa_humano_horas', '48');

-- retomar pausa
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.retomar_pausa_conversa('d1700000-0000-4000-8000-000000000051') $$,
  '42501', null, 'retomar pausa: enfermeira é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$ select api.retomar_pausa_conversa('d1700000-0000-4000-8000-000000000051') $$,
  '42501', null, 'retomar pausa: diretoria em aal1 é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select is(api.retomar_pausa_conversa('d1700000-0000-4000-8000-000000000051') ->> 'alterado', 'true',
  'retomar pausa: comercial em aal1 devolve agora');
select is(api.retomar_pausa_conversa('d1700000-0000-4000-8000-000000000051') ->> 'alterado', 'false',
  'retomar pausa: sem pausa, nada muda');
insert into t_r values ('ret_hc', api.retomar_pausa_conversa('d1700000-0000-4000-8000-000000000052'));
select testes.encerrar();
select results_eq(
  $$ select agente_pausado_ate, agente_pausa_motivo from conversa where id = 'd1700000-0000-4000-8000-000000000051' $$,
  $$ values (null::timestamptz, null::text) $$,
  'retomar pausa: limpa agente_pausado_ate e o motivo');
select ok(exists (select 1 from log_auditoria where acao = 'agente_pausa_retomada' and entidade_id = 'd1700000-0000-4000-8000-000000000051'),
  'retomar pausa: log agente_pausa_retomada');
select results_eq(
  $$ select agente_pausado_ate is null, agente_encerrado_em is not null, agente_encerrado_motivo
     from conversa where id = 'd1700000-0000-4000-8000-000000000052' $$,
  $$ values (true, true, 'reuniao') $$,
  'retomar pausa: em humano_comercial limpa só a pausa; a Isadora não volta');
select is((select r ->> 'humano_comercial' from t_r where chave = 'ret_hc'), 'true',
  'retomar pausa: avisa que a conversa continua em humano_comercial');

-- resolver transferência
update conversa set agente_pausado_ate = now() + interval '5 hours' where id = 'd1700000-0000-4000-8000-000000000052';
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.resolver_transferencia('b1700000-0000-4000-8000-000000000052', 'sessao_marcada') $$,
  '42501', null, 'resolver: enfermeira é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($$ select api.resolver_transferencia('b1700000-0000-4000-8000-000000000052', 'sessao_marcada') $$,
  '42501', null, 'resolver: financeiro é recusado');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($$ select api.resolver_transferencia('b1700000-0000-4000-8000-000000000052', 'sessao_marcada') $$,
  '42501', null, 'resolver: coordenação em aal1 é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.resolver_transferencia('b1700000-0000-4000-8000-000000000052', 'devolver_isadora') $$,
  '22023', null, 'resolver: desfecho fora da lista é recusado');
select is(api.resolver_transferencia('b1700000-0000-4000-8000-000000000052', 'sessao_marcada') ->> 'desfecho', 'sessao_marcada',
  'resolver: comercial em aal1 resolve com o desfecho');
select throws_ok($$ select api.resolver_transferencia('b1700000-0000-4000-8000-000000000052', 'sem_retorno') $$,
  '22023', null, 'resolver: transferência já resolvida é recusada');
select testes.encerrar();
select results_eq(
  $$ select status::text, resolvido_em is not null, dados ->> 'desfecho' from handoff where id = 'b1700000-0000-4000-8000-000000000052' $$,
  $$ values ('resolvido', true, 'sessao_marcada') $$,
  'resolver: status resolvido, resolvido_em e desfecho em dados');
select results_eq(
  $$ select agente_encerrado_em is not null, agente_encerrado_motivo, agente_pausado_ate > now() + interval '4 hours'
     from conversa where id = 'd1700000-0000-4000-8000-000000000052' $$,
  $$ values (true, 'reuniao', true) $$,
  'resolver: nunca devolve à Isadora (humano_comercial e pausa continuam)');
select ok(exists (select 1 from log_auditoria where acao = 'transferencia_resolvida'
                    and entidade_id = 'b1700000-0000-4000-8000-000000000052'
                    and valor_depois ->> 'desfecho' = 'sessao_marcada'),
  'resolver: log transferencia_resolvida');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select is(api.retomar_agente('d1700000-0000-4000-8000-000000000052') ->> 'estava_em', 'humano_comercial',
  'resolver: depois de resolvida, só api.retomar_agente devolve a conversa à Isadora');
select testes.encerrar();

-- reenviar aviso
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$ select api.reenviar_notificacao_handoff('b1700000-0000-4000-8000-000000000051') $$,
  '42501', null, 'reenviar: marketing é recusado');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.reenviar_notificacao_handoff('b1700000-0000-4000-8000-000000000051') $$,
  '42501', null, 'reenviar: enfermeira é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$ select api.reenviar_notificacao_handoff('b1700000-0000-4000-8000-000000000051') $$,
  '42501', null, 'reenviar: diretoria em aal1 é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.reenviar_notificacao_handoff('b1700000-0000-4000-8000-000000000053') $$,
  '22023', null, 'reenviar: transferência resolvida é recusada');
insert into t_r values ('reenv', api.reenviar_notificacao_handoff('b1700000-0000-4000-8000-000000000051'));
select is(api.reenviar_notificacao_handoff('b1700000-0000-4000-8000-000000000012') ->> 'alterado', 'false',
  'reenviar: aviso já confirmado não muda nada');
select testes.encerrar();
select is((select notificacao_ok from handoff where id = 'b1700000-0000-4000-8000-000000000051'), null::boolean,
  'reenviar: notificacao_ok volta a nulo (aguardando), a faixa vermelha sai');
select results_eq(
  $$ select papel::text, prioridade::text, canais, link, corpo from notificacao
     where id = (select (r ->> 'notificacao_id')::uuid from t_r where chave = 'reenv') $$,
  $$ values ('comercial', 'normal', array['app', 'whatsapp_interno', 'email'],
             'http://localhost:3000/familias/c1700000-0000-4000-8000-000000000031', null::text) $$,
  'reenviar: notificação ao papel do destino, com a prioridade, o link da ficha e os três canais, sem texto da família');
select ok(exists (select 1 from log_auditoria where acao = 'handoff_aviso_reenviado' and entidade_id = 'b1700000-0000-4000-8000-000000000051'),
  'reenviar: log handoff_aviso_reenviado');


-- =============================================================================
-- 7. Base de conhecimento
-- =============================================================================

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.base_conhecimento_listar() $$, '42501', null, 'base: enfermeira não lista');
select throws_ok($$ select api.base_conhecimento_salvar(null, 'faq', 'T', 'X', null) $$, '42501', null, 'base: enfermeira não salva');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$ select api.base_conhecimento_listar() $$, '42501', null, 'base: marketing não lista');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($$ select api.base_conhecimento_listar() $$, '42501', null, 'base: coordenação em aal1 é recusada');

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
insert into t_r values ('bc', api.base_conhecimento_salvar(null, 'faq', 'Pergunta sintética de teste', 'Resposta sintética de teste.', 'FAQ de teste'));
select throws_ok($$ select api.base_conhecimento_salvar(null, 'receita', 'T', 'X', null) $$, '22023', null, 'base: tipo inválido é recusado');
select throws_ok($$ select api.base_conhecimento_salvar(null, 'faq', '  ', 'X', null) $$, '22023', null, 'base: título vazio é recusado');
select throws_ok(format('select api.base_conhecimento_salvar(null, %L, %L, %L, null)', 'faq', 'T', repeat('x', 1501)),
  '23514', null, 'base: texto acima de 1500 caracteres é recusado pela tabela');
select ok(exists (select 1 from jsonb_array_elements(api.base_conhecimento_listar()) e
                  where e ->> 'id' = (select r ->> 'id' from t_r where chave = 'bc')),
  'base: comercial em aal1 lista o item novo');
select throws_ok(format('select api.base_conhecimento_aprovar(%L)', (select r ->> 'id' from t_r where chave = 'bc')),
  '42501', null, 'base: comercial não aprova');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal2');
select throws_ok(format('select api.base_conhecimento_aprovar(%L)', (select r ->> 'id' from t_r where chave = 'bc')),
  '42501', null, 'base: coordenação não aprova');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal1');
select throws_ok(format('select api.base_conhecimento_aprovar(%L)', (select r ->> 'id' from t_r where chave = 'bc')),
  '42501', null, 'base: diretoria em aal1 não aprova (exige AAL2)');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal2');
insert into t_r values ('bc_apr', api.base_conhecimento_aprovar((select (r ->> 'id')::uuid from t_r where chave = 'bc')));
select testes.encerrar();

select is((select r ->> 'status' from t_r where chave = 'bc'), 'rascunho', 'base: item novo nasce em rascunho');
select ok((select r ?& array['id', 'tipo', 'titulo', 'texto', 'fonte', 'status', 'aprovadoPor', 'aprovadoEm', 'atualizadoEm'] from t_r where chave = 'bc'),
  'base: item no formato da tela (ItemBaseConhecimento)');
select results_eq(
  $$ select status::text, aprovado_por, aprovado_em is not null from agente.base_conhecimento
     where id = (select (r ->> 'id')::uuid from t_r where chave = 'bc') $$,
  $$ values ('aprovado', 'a1700000-0000-4000-8000-000000000006'::uuid, true) $$,
  'base: diretoria em aal2 aprova, com aprovado_por e aprovado_em');
select is((select r ->> 'aprovadoPor' from t_r where chave = 'bc_apr'), 'Perfil Teste P17 diretoria',
  'base: aprovadoPor devolve o nome de quem aprovou');
select ok(exists (select 1 from log_auditoria where entidade = 'agente.base_conhecimento'
                    and entidade_id = (select r ->> 'id' from t_r where chave = 'bc') and acao = 'update'
                    and usuario_id = 'a1700000-0000-4000-8000-000000000006'),
  'base: a aprovação entra na auditoria');

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal2');
insert into t_r values ('bc_ed', api.base_conhecimento_salvar((select (r ->> 'id')::uuid from t_r where chave = 'bc'),
                                                              'faq', 'Pergunta sintética editada', 'Resposta editada.', null));
select throws_ok($$ select api.base_conhecimento_salvar('c1700000-0000-4000-8000-0000000000ff', 'faq', 'T', 'X', null) $$,
  'P0002', null, 'base: editar item inexistente é recusado');
select testes.encerrar();
select results_eq(
  $$ select status::text, aprovado_por, aprovado_em, titulo from agente.base_conhecimento
     where id = (select (r ->> 'id')::uuid from t_r where chave = 'bc') $$,
  $$ values ('rascunho', null::uuid, null::timestamptz, 'Pergunta sintética editada') $$,
  'base: coordenação em aal2 edita, e a edição volta para rascunho sem aprovação');


-- =============================================================================
-- 8. api.metricas_agente
-- =============================================================================

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$ select api.metricas_agente('2020-03-01', '2020-03-31') $$, '42501', null, 'métricas: marketing é recusado');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.metricas_agente('2020-03-01', '2020-03-31') $$, '42501', null, 'métricas: enfermeira é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000006', 'aal1');
select throws_ok($$ select api.metricas_agente('2020-03-01', '2020-03-31') $$, '42501', null, 'métricas: diretoria em aal1 é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($$ select api.metricas_agente('2020-03-31', '2020-03-01') $$, '22023', null, 'métricas: período invertido é recusado');
insert into t_r values ('met', api.metricas_agente('2020-03-01', '2020-03-31'));
select testes.encerrar();

select set_eq(
  $$ select jsonb_object_keys(r) from t_r where chave = 'met' $$,
  $$ values ('periodoDesde'), ('periodoAte'), ('tempoPrimeiraRespostaMinutos'), ('leadsQueRespondemPct'),
            ('qualificadosComValorEPdfPct'), ('conversasComEdilaineRegistradasPct'), ('followupAposPdfPct'),
            ('conversaoLeadsPct'), ('condicoesForaDaTabela'), ('leadsTotal') $$,
  'métricas: exatamente as chaves de MetricasAgente, só agregados');
select is((select r from t_r where chave = 'met') - 'periodoDesde' - 'periodoAte',
  '{"leadsTotal": 3, "conversaoLeadsPct": 25.0, "followupAposPdfPct": 50.0, "leadsQueRespondemPct": 33.3,
    "condicoesForaDaTabela": 1, "qualificadosComValorEPdfPct": 66.7, "tempoPrimeiraRespostaMinutos": 8.0,
    "conversasComEdilaineRegistradasPct": 33.3}'::jsonb,
  'métricas: os sete indicadores e o total de leads batem com o cenário sintético');
select is((select r ->> 'periodoDesde' from t_r where chave = 'met'), '2020-03-01', 'métricas: devolve o período');


-- =============================================================================
-- 8b. Verificação do fechamento: achados e correções
-- =============================================================================

-- F1: o freio herdado na mesclagem não abre o "Desfazer" para quem mesclou.
-- Antes da correção, o comercial mesclava uma família normal com uma em
-- bloqueio_total e, pelo "Desfazer" do freio herdado, baixava a que ficou
-- para normal (só coordenação ou diretoria revertem, PRD 8.3).
-- F2: historico_sensivel da família que sai passa para a que fica.
insert into parametro (chave, valor) values ('freio_desfazer_segundos', '10')
on conflict (chave) do update set valor = excluded.valor;
insert into familia (id, nome_exibicao, dpp, historico_sensivel) values
  ('c1700000-0000-4000-8000-000000000061', 'Família Teste Fica Seis', '2032-10-10', false),
  ('c1700000-0000-4000-8000-000000000062', 'Família Teste Sai Seis',  '2032-10-12', true);
update familia
   set estado_sensivel = 'bloqueio_total', estado_sensivel_motivo = null,
       estado_sensivel_em = '2031-01-02 10:00-03', estado_sensivel_por = 'a1700000-0000-4000-8000-000000000005'
 where id = 'c1700000-0000-4000-8000-000000000062';

select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
insert into t_r values ('m6', api.mesclar_familias('c1700000-0000-4000-8000-000000000061', 'c1700000-0000-4000-8000-000000000062', null));
select throws_ok($$ select api.desfazer_freio('c1700000-0000-4000-8000-000000000061') $$, '42501', null,
  'F1: quem mesclou não desfaz o freio herdado (não foi um acionamento dele)');
select throws_ok($$ select api.justificar_freio('c1700000-0000-4000-8000-000000000061', 'motivo sintético') $$, '42501', null,
  'F1: quem mesclou não reescreve o motivo do freio herdado');
select testes.encerrar();

select is((select r ->> 'freio_herdado' from t_r where chave = 'm6'), 'true', 'F1: a mesclagem herdou o freio');
select results_eq(
  $$ select estado_sensivel::text, estado_sensivel_em, estado_sensivel_por from familia where id = 'c1700000-0000-4000-8000-000000000061' $$,
  $$ values ('bloqueio_total', '2031-01-02 10:00-03'::timestamptz, 'a1700000-0000-4000-8000-000000000005'::uuid) $$,
  'F1: a família que fica continua em bloqueio_total, com a data e o autor do freio original');
select is((select count(*)::integer from tarefa
            where familia_id = 'c1700000-0000-4000-8000-000000000061'
              and payload ->> 'acao' = 'justificar_freio' and status in ('aberta', 'em_andamento')), 0,
  'F1: nenhuma tarefa de justificativa aberta para quem mesclou');
select ok((select historico_sensivel from familia where id = 'c1700000-0000-4000-8000-000000000061'),
  'F2: historico_sensivel da família que sai passa para a que fica');

-- F4: api.ultima_ingestao_base (a tela do P27 chamava e recebia funcao_pendente)
delete from agente.ingestao_execucao;
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000001', 'aal1');
select is(api.ultima_ingestao_base(), null::jsonb, 'F4: sem nenhuma ingestão, devolve nulo');
select testes.encerrar();
insert into agente.ingestao_execucao (lote_id, documentos, status, erro, criado_em) values
  ('c1790000-0000-4000-8000-000000000001', 12, 'ok',     null,                   '2031-05-01 08:00-03'),
  ('c1790000-0000-4000-8000-000000000002',  0, 'falhou', 'erro sintético de teste', '2031-05-02 08:00-03');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal2');
insert into t_r values ('ing', api.ultima_ingestao_base());
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($$ select api.ultima_ingestao_base() $$, '42501', null, 'F4: coordenação em aal1 é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($$ select api.ultima_ingestao_base() $$, '42501', null, 'F4: enfermeira é recusada');
select testes.autenticar_authenticated('a1700000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($$ select api.ultima_ingestao_base() $$, '42501', null, 'F4: marketing é recusado');
select testes.autenticar_anon();
select throws_ok($$ select api.ultima_ingestao_base() $$, '42501', null, 'F4: anon é recusado');
select testes.encerrar();
select is((select r from t_r where chave = 'ing'),
  jsonb_build_object('em', '2031-05-02 08:00-03'::timestamptz, 'ok', false, 'itens', 0, 'erro', 'erro sintético de teste'),
  'F4: coordenação em aal2 lê a ingestão mais recente no formato UltimaIngestao');


-- =============================================================================
-- 9. Privilégios
-- =============================================================================

create temp table t_fn (assinatura text) on commit drop;
insert into t_fn values
  ('api.buscar_duplicatas_pipeline()'),
  ('api.mesclar_familias(uuid,uuid,uuid)'),
  ('api.vincular_nova_gestacao(uuid,uuid)'),
  ('api.pode_enviar_mensagem(uuid,public.categoria_automacao,public.modo_mensageria)'),
  ('api.registrar_envio_tarefa(uuid,text)'),
  ('api.pausar_conversa(uuid,text)'),
  ('api.retomar_pausa_conversa(uuid)'),
  ('api.resolver_transferencia(uuid,text)'),
  ('api.reenviar_notificacao_handoff(uuid)'),
  ('api.base_conhecimento_listar()'),
  ('api.base_conhecimento_salvar(uuid,text,text,text,text)'),
  ('api.base_conhecimento_aprovar(uuid)'),
  ('api.metricas_agente(date,date)'),
  ('api.ultima_ingestao_base()');

select is((select count(*)::integer from t_fn where to_regprocedure(assinatura) is not null), 14,
  'as catorze funções existem com a assinatura que o CRM chama');
select is_empty(
  $$ select assinatura from t_fn f join pg_proc p on p.oid = to_regprocedure(f.assinatura)
     where not (p.prosecdef and coalesce(p.proconfig, '{}') @> array['search_path=""']) $$,
  'todas security definer com search_path vazio');
select is_empty(
  $$ select assinatura from t_fn where not has_function_privilege('authenticated', to_regprocedure(assinatura), 'execute') $$,
  'authenticated executa todas');
select is_empty(
  $$ select assinatura from t_fn
     where has_function_privilege('anon', to_regprocedure(assinatura), 'execute')
        or has_function_privilege('service_role', to_regprocedure(assinatura), 'execute') $$,
  'anon e service_role não executam nenhuma');
select is_empty(
  $$ select assinatura from t_fn f join pg_proc p on p.oid = to_regprocedure(f.assinatura)
     where exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0) $$,
  'nenhuma executável por PUBLIC');
select ok(not has_function_privilege('authenticated', 'privado.item_base_conhecimento(uuid)', 'execute'),
  'a auxiliar privado.item_base_conhecimento não é executável pelo app');
select is(
  (select array_agg(a.nome order by a.nome) from unnest((select proargnames from pg_proc where oid = 'api.mesclar_familias(uuid,uuid,uuid)'::regprocedure)) a(nome)),
  array['familia_fica_id', 'familia_perde_id', 'oportunidade_fica_id'],
  'mesclar_familias: nomes dos parâmetros iguais aos que o CRM manda');

select * from finish();
rollback;
