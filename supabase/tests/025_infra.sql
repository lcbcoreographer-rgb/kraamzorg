-- =============================================================================
-- supabase/tests/025_infra.sql
--
-- P11 (Web Push), P14 (saúde) e P18b (Cloud API), migration 0025_infra.sql.
--   1. modelo_whatsapp: ciclo de vida, texto submetido que não muda, placeholders.
--   2. api dos modelos: papel e AAL.
--   3. agente.janela_followup: dentro e fora da janela de 24 horas, modelo
--      aprovado certo, e nunca texto livre fora da janela.
--   4. status de entrega: webhook idempotente, append-only, leitura por papel.
--   5. inscricao_push: só pelas funções, dono da inscrição.
--   6. saúde do sistema: só service_role, só datas e números.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(82);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2500000-0000-4000-8000-000000000001', 'comercial.infra@exemplo.invalid'),
  ('a2500000-0000-4000-8000-000000000002', 'coordenacao.infra@exemplo.invalid'),
  ('a2500000-0000-4000-8000-000000000003', 'diretoria.infra@exemplo.invalid'),
  ('a2500000-0000-4000-8000-000000000004', 'enfermeira.infra@exemplo.invalid'),
  ('a2500000-0000-4000-8000-000000000005', 'financeiro.infra@exemplo.invalid'),
  ('a2500000-0000-4000-8000-000000000006', 'sem.papel.infra@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a2500000-0000-4000-8000-000000000001', 'Perfil Teste Comercial Infra', 'comercial.infra@exemplo.invalid', true),
  ('a2500000-0000-4000-8000-000000000002', 'Perfil Teste Coordenação Infra', 'coordenacao.infra@exemplo.invalid', true),
  ('a2500000-0000-4000-8000-000000000003', 'Perfil Teste Diretoria Infra', 'diretoria.infra@exemplo.invalid', true),
  ('a2500000-0000-4000-8000-000000000004', 'Perfil Teste Enfermeira Infra', 'enfermeira.infra@exemplo.invalid', true),
  ('a2500000-0000-4000-8000-000000000005', 'Perfil Teste Financeiro Infra', 'financeiro.infra@exemplo.invalid', true),
  ('a2500000-0000-4000-8000-000000000006', 'Perfil Teste Sem Papel Infra', 'sem.papel.infra@exemplo.invalid', true);

insert into usuario_papel (usuario_id, papel) values
  ('a2500000-0000-4000-8000-000000000001', 'comercial'),
  ('a2500000-0000-4000-8000-000000000002', 'coordenacao'),
  ('a2500000-0000-4000-8000-000000000003', 'diretoria'),
  ('a2500000-0000-4000-8000-000000000004', 'enfermeira'),
  ('a2500000-0000-4000-8000-000000000005', 'financeiro');

-- -----------------------------------------------------------------------------
-- 1. Estrutura
-- -----------------------------------------------------------------------------

select has_table('privado', 'modelo_whatsapp', 'modelo_whatsapp existe');
select has_table('privado', 'inscricao_push', 'inscricao_push existe');
select has_table('privado', 'mensagem_status', 'privado.mensagem_status existe');
select has_table('privado', 'saude_webhook', 'privado.saude_webhook existe');
select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relname in ('modelo_whatsapp', 'inscricao_push', 'mensagem_status', 'saude_webhook') and c.relrowsecurity),
  4, 'RLS ligada nas quatro tabelas novas');
select is(
  (select count(*)::integer from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'),
  49, 'os enums novos ficam em privado: public segue com 49');
select is(
  (select count(*)::integer from privado.modelo_whatsapp where status <> 'rascunho'),
  0, 'o seed traz todos os modelos em rascunho: nenhum foi submetido à Meta');
select cmp_ok(
  (select count(*)::integer from privado.modelo_whatsapp where mensagem_chave in ('followup_d1_pos_pdf', 'followup_d1_pos_abertura')),
  '=', 2, 'o seed cadastra os dois modelos do follow-up');
select is((select valor #>> '{}' from parametro where chave = 'whatsapp_janela_horas'), '24',
  'a janela de 24 horas mora em parametro');

-- -----------------------------------------------------------------------------
-- 2. modelo_whatsapp: ciclo de vida
-- -----------------------------------------------------------------------------

select throws_ok(
  $s$ insert into privado.modelo_whatsapp (mensagem_chave, nome_meta, categoria, variaveis, texto)
      values ('regua_ate_20', 'kz_teste_placeholder', 'utilidade', array['nome'], 'Oi, sem variável nenhuma.') $s$,
  '23514', null, 'o texto precisa usar {{1}} a {{n}} igual à lista de variáveis');
select throws_ok(
  $s$ insert into privado.modelo_whatsapp (mensagem_chave, nome_meta, categoria, variaveis, texto)
      values ('regua_ate_20', 'kz_teste_buraco', 'utilidade', array['nome', 'hora'], 'Oi, {{1}} e {{3}}.') $s$,
  '23514', null, 'placeholder com buraco ({{1}} e {{3}}) é recusado');
select throws_ok(
  $s$ insert into privado.modelo_whatsapp (mensagem_chave, nome_meta, categoria, variaveis, texto)
      values ('regua_ate_20', 'Nome Com Maiúscula', 'utilidade', '{}', 'Oi.') $s$,
  '23514', null, 'nome_meta só aceita minúsculas, números e sublinhado (regra da Meta)');
select throws_ok(
  $s$ insert into privado.modelo_whatsapp (mensagem_chave, nome_meta, categoria, texto, status)
      values ('regua_ate_20', 'kz_teste_nasce_aprovado', 'utilidade', 'Oi.', 'aprovado') $s$,
  '22023', null, 'todo modelo nasce como rascunho');
select throws_ok(
  $s$ insert into privado.modelo_whatsapp (mensagem_chave, nome_meta, categoria, texto)
      values ('chave_que_nao_existe', 'kz_teste_fk', 'utilidade', 'Oi.') $s$,
  '23503', null, 'o modelo aponta para uma chave de mensagem_modelo que existe');

insert into privado.modelo_whatsapp (id, mensagem_chave, nome_meta, categoria, variaveis, valores_padrao, texto) values
  ('b2500000-0000-4000-8000-000000000001', 'regua_ate_20', 'kz_teste_ciclo', 'marketing', array['nome'], '{"nome":"tudo bem"}',
   'Oi, {{1}}! Texto de teste do ciclo de vida.');

select throws_ok(
  $s$ update privado.modelo_whatsapp set status = 'aprovado' where id = 'b2500000-0000-4000-8000-000000000001' $s$,
  '22023', null, 'rascunho não pula direto para aprovado');
update privado.modelo_whatsapp set status = 'submetido' where id = 'b2500000-0000-4000-8000-000000000001';
select throws_ok(
  $s$ update privado.modelo_whatsapp set texto = 'Oi, {{1}}! Outro texto.' where id = 'b2500000-0000-4000-8000-000000000001' $s$,
  '42501', null, 'depois de submetido, o texto não muda');
update privado.modelo_whatsapp set status = 'aprovado' where id = 'b2500000-0000-4000-8000-000000000001';
select isnt((select aprovado_em from privado.modelo_whatsapp where id = 'b2500000-0000-4000-8000-000000000001'), null,
  'a aprovação grava aprovado_em');
select throws_ok(
  $s$ update privado.modelo_whatsapp set nome_meta = 'kz_outro_nome' where id = 'b2500000-0000-4000-8000-000000000001' $s$,
  '42501', null, 'modelo aprovado não muda de nome');
select throws_ok(
  $s$ update privado.modelo_whatsapp set aprovado_em = now() - interval '1 year' where id = 'b2500000-0000-4000-8000-000000000001' $s$,
  '42501', null, 'aprovado_em não é editável à mão');
select throws_ok(
  $s$ delete from privado.modelo_whatsapp where id = 'b2500000-0000-4000-8000-000000000001' $s$,
  '42501', null, 'modelo aprovado não se apaga');
update privado.modelo_whatsapp set status = 'pausado' where id = 'b2500000-0000-4000-8000-000000000001';
update privado.modelo_whatsapp set status = 'aprovado' where id = 'b2500000-0000-4000-8000-000000000001';
select is((select status::text from privado.modelo_whatsapp where id = 'b2500000-0000-4000-8000-000000000001'), 'aprovado',
  'pausado volta a aprovado sem passar pela Meta de novo');
select throws_ok(
  $s$ update privado.modelo_whatsapp set status = 'rascunho' where id = 'b2500000-0000-4000-8000-000000000001' $s$,
  '22023', null, 'aprovado não volta a rascunho');

-- -----------------------------------------------------------------------------
-- 3. api dos modelos: papel e AAL
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000001', 'aal2');
select ok(jsonb_array_length(api.modelos_whatsapp()) >= 7, 'comercial em AAL2 lê o cadastro dos modelos');
select is(api.modelo_whatsapp_aprovado('regua_ate_20') ->> 'nome_meta', 'kz_teste_ciclo',
  'o modelo aprovado de uma chave é o que a Meta aprovou');
select is(api.modelo_whatsapp_aprovado('followup_d1_pos_pdf'), null,
  'modelo em rascunho nunca é devolvido como aprovado');
select is(api.whatsapp_janela_horas(), 24::numeric, 'o adaptador do app lê a janela de parametro por api, mesmo sem ler a tabela');
select throws_ok($s$ select api.salvar_modelo_whatsapp(null, 'regua_ate_20', 'kz_x', 'pt_BR', 'marketing', '{}', 'Oi.', '{}') $s$,
  '42501', null, 'comercial não cadastra modelo (só a diretoria)');
select testes.encerrar();

select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.modelos_whatsapp() $s$, '42501', null, 'comercial em AAL1 não lê o cadastro');
select testes.encerrar();

select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($s$ select api.modelos_whatsapp() $s$, '42501', null, 'enfermeira não lê o cadastro dos modelos');
select throws_ok($s$ select api.modelo_whatsapp_aprovado('regua_ate_20') $s$, '42501', null, 'enfermeira não lê o modelo aprovado');
select throws_ok($s$ select api.whatsapp_janela_horas() $s$, '42501', null, 'enfermeira não lê a janela');
select testes.encerrar();

select testes.autenticar_anon();
select throws_ok($s$ select api.modelos_whatsapp() $s$, '42501', null, 'anônimo não executa api.modelos_whatsapp');
select testes.encerrar();

create temp table t_id (id uuid);
grant all on t_id to public;
select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000003', 'aal2');
select lives_ok(
  $s$ insert into t_id select api.salvar_modelo_whatsapp(null, 'regua_nasceu', 'kz_teste_diretoria', 'pt_BR', 'marketing', '{}',
        'Parabéns pela chegada do bebê, texto de teste.', '{}') $s$,
  'a diretoria cadastra um modelo em rascunho');
select lives_ok(
  $s$ select api.atualizar_status_modelo_whatsapp((select id from t_id), 'submetido', null) $s$,
  'a diretoria marca o modelo como submetido');
select throws_ok(
  $s$ select api.salvar_modelo_whatsapp((select id from t_id),
        'regua_nasceu', 'kz_teste_diretoria', 'pt_BR', 'marketing', '{}', 'Outro texto.', '{}') $s$,
  '42501', null, 'editar o texto de um modelo submetido é recusado');
select throws_ok($s$ select * from privado.modelo_whatsapp $s$, '42501', null,
  'a tabela não tem select direto para authenticated');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 4. agente.janela_followup
-- -----------------------------------------------------------------------------

-- aprova o modelo do follow-up depois do PDF (rascunho -> submetido -> aprovado)
update privado.modelo_whatsapp set status = 'submetido' where mensagem_chave = 'followup_d1_pos_pdf';
update privado.modelo_whatsapp set status = 'aprovado' where mensagem_chave = 'followup_d1_pos_pdf';

insert into familia (id, nome_exibicao, dpp) values
  ('c2500000-0000-4000-8000-000000000001', 'Família Teste Janela Fora', current_date + 100),
  ('c2500000-0000-4000-8000-000000000002', 'Família Teste Janela Dentro', current_date + 100),
  ('c2500000-0000-4000-8000-000000000003', 'Família Teste Janela Sem Modelo', current_date + 100);
insert into pessoa (id, familia_id, papel, nome, telefone_e164) values
  ('d2500000-0000-4000-8000-000000000001', 'c2500000-0000-4000-8000-000000000001', 'mae', 'Helena Sobrenome Teste', '+5511900000951');
insert into conversa (id, wa_jid, telefone_e164, familia_id, pessoa_id, classificacao, iniciada_por, ultima_entrada_em, ultima_saida_em) values
  ('e2500000-0000-4000-8000-000000000001', '5511900000951-teste@s.whatsapp.net', '+5511900000951', 'c2500000-0000-4000-8000-000000000001',
   'd2500000-0000-4000-8000-000000000001', 'lead', 'cliente', now() - interval '50 hours', now() - interval '49 hours'),
  ('e2500000-0000-4000-8000-000000000002', '5511900000952-teste@s.whatsapp.net', '+5511900000952', 'c2500000-0000-4000-8000-000000000002',
   null, 'lead', 'cliente', now() - interval '2 hours', now() - interval '1 hours'),
  ('e2500000-0000-4000-8000-000000000003', '5511900000953-teste@s.whatsapp.net', '+5511900000953', 'c2500000-0000-4000-8000-000000000003',
   null, 'lead', 'cliente', now() - interval '60 hours', now() - interval '59 hours');

insert into automacao_execucao (id, automacao_id, familia_id, agendada_para, status, payload) values
  ('f2500000-0000-4000-8000-000000000001', 'followup_d1', 'c2500000-0000-4000-8000-000000000001', now(), 'agendada',
   jsonb_build_object('conversa_id', 'e2500000-0000-4000-8000-000000000001', 'reservada_em', now(), 'chave_texto', 'followup_d1_pos_pdf')),
  ('f2500000-0000-4000-8000-000000000002', 'followup_d1', 'c2500000-0000-4000-8000-000000000002', now(), 'agendada',
   jsonb_build_object('conversa_id', 'e2500000-0000-4000-8000-000000000002', 'reservada_em', now(), 'chave_texto', 'followup_d1_pos_pdf')),
  ('f2500000-0000-4000-8000-000000000003', 'followup_d1', 'c2500000-0000-4000-8000-000000000003', now(), 'agendada',
   jsonb_build_object('conversa_id', 'e2500000-0000-4000-8000-000000000003', 'reservada_em', now(), 'chave_texto', 'followup_d1_pos_abertura')),
  ('f2500000-0000-4000-8000-000000000004', 'followup_d1', 'c2500000-0000-4000-8000-000000000001', now(), 'agendada',
   jsonb_build_object('conversa_id', 'e2500000-0000-4000-8000-000000000001', 'chave_texto', 'followup_d1_pos_pdf'));

create temp table t_j (chave text primary key, r jsonb);
grant all on t_j to public;

select testes.autenticar('n8n_agente');
insert into t_j select 'fora', agente.janela_followup('f2500000-0000-4000-8000-000000000001');
insert into t_j select 'dentro', agente.janela_followup('f2500000-0000-4000-8000-000000000002');
insert into t_j select 'sem_modelo', agente.janela_followup('f2500000-0000-4000-8000-000000000003');
insert into t_j select 'nao_reservada', agente.janela_followup('f2500000-0000-4000-8000-000000000004');
reset role;
select set_config('request.jwt.claims', '', true);

select is((select r ->> 'dentro_janela' from t_j where chave = 'fora'), 'false', 'última mensagem há 50 horas: fora da janela');
select is((select r #>> '{modelo,nome}' from t_j where chave = 'fora'), 'kz_retorno_apresentacao',
  'fora da janela: o modelo aprovado certo para followup_d1_pos_pdf');
select is((select r #>> '{modelo,parametros,0}' from t_j where chave = 'fora'), 'Helena',
  'o parâmetro {{1}} é só o primeiro nome da família');
select ok((select r #>> '{modelo,texto}' from t_j where chave = 'fora') like 'Oi, Helena 😊 %'
  and (select r #>> '{modelo,texto}' from t_j where chave = 'fora') not like '%{{%',
  'o texto renderizado troca as variáveis e não deixa {{n}}');
select is((select r ->> 'telefone' from t_j where chave = 'fora'), '5511900000951',
  'fora da janela o telefone vai só com dígitos, para a Cloud API (que não usa jid)');
select is((select r ->> 'dentro_janela' from t_j where chave = 'dentro'), 'true', 'última mensagem há 2 horas: dentro da janela');
select is((select r -> 'modelo' from t_j where chave = 'dentro'), 'null'::jsonb, 'dentro da janela não devolve modelo');
select is((select r ->> 'dentro_janela' from t_j where chave = 'sem_modelo'), 'false', 'sem modelo: fora da janela');
select is((select r ->> 'motivo' from t_j where chave = 'sem_modelo'), 'sem_modelo_aprovado',
  'follow-up sem modelo aprovado não sai: motivo sem_modelo_aprovado');
select is((select r -> 'modelo' from t_j where chave = 'sem_modelo'), 'null'::jsonb,
  'fora da janela e sem modelo aprovado, não há texto nenhum para enviar');
select is((select r ->> 'erro' from t_j where chave = 'nao_reservada'), 'execucao_invalida',
  'execução que o motor não reservou é recusada');

-- sem o parâmetro, tudo conta como fora da janela (o caminho seguro)
delete from parametro where chave = 'whatsapp_janela_horas';
select testes.autenticar('n8n_agente');
select is(agente.janela_followup('f2500000-0000-4000-8000-000000000002') ->> 'dentro_janela', 'false',
  'sem parametro.whatsapp_janela_horas, nem a conversa de 2 horas conta como dentro da janela');
reset role;
select set_config('request.jwt.claims', '', true);

-- parâmetro sem valor: o modelo não sai com parâmetro vazio
update privado.modelo_whatsapp set status = 'submetido' where mensagem_chave = 'followup_d1_pos_abertura';
update privado.modelo_whatsapp set status = 'aprovado' where mensagem_chave = 'followup_d1_pos_abertura';
insert into privado.modelo_whatsapp (id, mensagem_chave, nome_meta, categoria, variaveis, texto) values
  ('b2500000-0000-4000-8000-000000000009', 'lembrete_sessao', 'kz_teste_sem_valor', 'utilidade', array['hora'], 'Sua conversa é às {{1}}, combinado?');
update privado.modelo_whatsapp set status = 'submetido' where id = 'b2500000-0000-4000-8000-000000000009';
update privado.modelo_whatsapp set status = 'aprovado' where id = 'b2500000-0000-4000-8000-000000000009';
update automacao_execucao set payload = payload || '{"chave_texto":"lembrete_sessao"}'::jsonb where id = 'f2500000-0000-4000-8000-000000000001';
select testes.autenticar('n8n_agente');
select is(agente.janela_followup('f2500000-0000-4000-8000-000000000001') ->> 'motivo', 'parametro_sem_valor',
  'parâmetro sem valor e sem padrão: nada sai');
reset role;
select set_config('request.jwt.claims', '', true);

select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ select agente.janela_followup('f2500000-0000-4000-8000-000000000001') $s$, '42501', null,
  'authenticated não executa a função do agente');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select agente.janela_followup('f2500000-0000-4000-8000-000000000001') $s$, '42501', null,
  'anônimo não executa a função do agente');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 5. Status de entrega
-- -----------------------------------------------------------------------------

insert into mensagem (id, conversa_id, direcao, enviado_por, tipo, conteudo, wa_message_id) values
  ('a3500000-0000-4000-8000-000000000001', 'e2500000-0000-4000-8000-000000000001', 'saida', 'ia', 'texto', 'Texto sintético', 'wamid.TESTE001');

select testes.autenticar_service_role();
select is(public.mensagem_registrar_status('wamid.TESTE001', 'sent', now() - interval '2 minutes', null) ->> 'registrado', 'true',
  'webhook: enviada é registrada');
select is(public.mensagem_registrar_status('wamid.TESTE001', 'delivered', now() - interval '1 minutes', null) ->> 'registrado', 'true',
  'webhook: entregue é registrada');
select is(public.mensagem_registrar_status('wamid.TESTE001', 'delivered', now(), null) ->> 'motivo', 'ja_registrado',
  'webhook repetido é idempotente');
select is(public.mensagem_registrar_status('wamid.TESTE001', 'failed', now(), '131047; drop table') ->> 'registrado', 'true',
  'falha é registrada');
select is(public.mensagem_registrar_status('wamid.NAO_EXISTE', 'read', now(), null) ->> 'motivo', 'mensagem_nao_encontrada',
  'mensagem que não é nossa não grava nada');
select is(public.mensagem_registrar_status('wamid.TESTE001', 'deleted', now(), null) ->> 'motivo', 'status_desconhecido',
  'status que não é entrega é ignorado');
select testes.encerrar();

select is((select codigo_erro from privado.mensagem_status where status = 'falhou'), null,
  'código de erro que não é número é descartado (nunca texto livre)');
select throws_ok($s$ update privado.mensagem_status set status = 'lida' $s$, '42501', null, 'o status de entrega é só de inclusão (update)');
select throws_ok($s$ delete from privado.mensagem_status $s$, '42501', null, 'o status de entrega é só de inclusão (delete)');
select throws_ok($s$ truncate privado.mensagem_status $s$, '42501', null, 'o status de entrega é só de inclusão (truncate)');

select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000001', 'aal2');
select is(jsonb_array_length((api.status_entrega_conversa('e2500000-0000-4000-8000-000000000001') -> 0 -> 'estados')), 3,
  'o comercial lê os três estados da mensagem');
select throws_ok($s$ select public.mensagem_registrar_status('wamid.TESTE001', 'read', now(), null) $s$, '42501', null,
  'authenticated não executa o registro do webhook');
select testes.encerrar();
select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.status_entrega_conversa('e2500000-0000-4000-8000-000000000001') $s$, '42501', null,
  'financeiro não lê o estado de entrega da conversa');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 6. inscricao_push
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000004', 'aal2');
select lives_ok(
  $s$ select api.registrar_inscricao_push('https://push.exemplo.invalid/abc123', '{"p256dh":"chave-publica-teste","auth":"segredo-teste"}') $s$,
  'a enfermeira registra a inscrição do aparelho');
select throws_ok(
  $s$ select api.registrar_inscricao_push('http://push.exemplo.invalid/inseguro', '{"p256dh":"a","auth":"b"}') $s$,
  '23514', null, 'endpoint que não é https é recusado');
select throws_ok(
  $s$ select api.registrar_inscricao_push('https://push.exemplo.invalid/sem-chaves', '{"p256dh":"a"}') $s$,
  '23514', null, 'inscrição sem a chave auth é recusada');
select throws_ok($s$ select * from privado.inscricao_push $s$, '42501', null, 'a tabela de inscrições não tem select direto');
select testes.encerrar();

select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000001', 'aal2');
select lives_ok($s$ select api.remover_inscricao_push('https://push.exemplo.invalid/abc123') $s$, 'remover inscrição de outra pessoa não dá erro');
select testes.encerrar();
select is((select count(*)::integer from privado.inscricao_push where endpoint = 'https://push.exemplo.invalid/abc123'), 1,
  'mas a inscrição de outra pessoa continua lá');

select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ select api.registrar_inscricao_push('https://push.exemplo.invalid/xyz', '{"p256dh":"a","auth":"b"}') $s$, '42501', null,
  'perfil sem papel não registra inscrição');
select testes.encerrar();

select testes.autenticar_service_role();
select is(jsonb_array_length(public.inscricoes_push(array['a2500000-0000-4000-8000-000000000004']::uuid[])), 1,
  'o servidor de push lê a inscrição da pessoa');
select lives_ok($s$ select public.inscricao_push_expirada('https://push.exemplo.invalid/abc123') $s$, 'inscrição expirada é apagada');
select testes.encerrar();
select is((select count(*)::integer from privado.inscricao_push), 0, 'depois de expirada, não sobra inscrição');

select is((select count(*)::integer from privado.auditoria_coluna_sensivel where entidade = 'privado.inscricao_push'), 2,
  'endpoint e chaves da inscrição entram no log como [oculto]');

-- -----------------------------------------------------------------------------
-- 7. Saúde do sistema
-- -----------------------------------------------------------------------------

select testes.autenticar_service_role();
select lives_ok($s$ select public.saude_registrar_webhook('infinitepay', false) $s$, 'a rota registra a falha do webhook');
create temp table t_s (r jsonb);
grant all on t_s to public;
insert into t_s select public.saude_sistema();
select testes.encerrar();

select ok((select r ? 'recalculo_diario' and r ? 'cron' and r ? 'webhooks' and r ? 'falhas' from t_s),
  'a saúde traz recálculo, cron, webhooks e falhas');
select is((select w ->> 'falha_recente' from t_s, jsonb_array_elements(r -> 'webhooks') w where w ->> 'origem' = 'infinitepay'),
  'true', 'webhook com falha depois do último acerto aparece como falha recente');
select is((select r #>> '{recalculo_diario,atrasado}' from t_s), 'true',
  'sem rodada concluída do recálculo, a saúde marca atraso');
select testes.autenticar_authenticated('a2500000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ select public.saude_sistema() $s$, '42501', null, 'authenticated não executa saude_sistema');
select throws_ok($s$ select public.saude_registrar_webhook('whatsapp', true) $s$, '42501', null,
  'authenticated não registra saúde de webhook');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select public.saude_sistema() $s$, '42501', null, 'anônimo não executa saude_sistema');
select testes.encerrar();

select * from finish();
rollback;
