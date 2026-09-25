-- =============================================================================
-- supabase/tests/012_automacoes.sql
--
-- Aceite do P20 (PROMPTS.md v2): "pgTAP mostra família em atencao sem
-- tarefa de régua, uma tarefa só por mudança de faixa e execução externa
-- abortada quando o estado muda entre o agendamento e o envio; pgTAP com um
-- lead fictício vencido confirma que retencao_diaria apaga ou anonimiza o
-- que passou do prazo e preserva o que não passou".
--
--   1. privado.recalculo_regua_nutricao: família em atencao sem tarefa,
--      dedup por mudança de faixa (mesma faixa não repete), texto sugerido
--      vem de mensagem_modelo, só quem já escreveu (D-08).
--   2. Materialização por gatilho: retorno_combinado, lembrete_sessao
--      (véspera), pagamento_atrasado, sessao_sem_agenda, cada uma com
--      dedup (rodar duas vezes não duplica).
--   3. privado.processar_automacoes: execução externa registrada em
--      net._chamadas; execução abortada pelo freio (acionado entre o
--      agendamento e o processamento) nunca chama net.http_post.
--   4. followup_d1: só agenda (nunca cria tarefa nem chama rota), usa
--      parametro.agente_followup_horas, exclui humano_comercial
--      (agente_encerrado_em) e handoff aberto, cancela agendamento velho
--      quando a família responde de novo.
--   5. privado.retencao_diaria: lead fictício vencido (perdido há mais de
--      parametro.retencao.conversa_nao_cliente_meses, sem contrato) tem
--      mensagem, handoff e conversa apagados e chat_memoria removida;
--      família recente é preservada; sem parametro.retencao, recusa.
--   6. Agendamento no pg_cron (processar_automacoes a cada 5 minutos,
--      retencao_diaria diário) e privilégios (sem execute para anon,
--      authenticated e service_role).
--
-- Só dado sintético ("Família Teste P20 ..."), criado aqui e desfeito no
-- rollback. Depende do seed só para regua_faixa, mensagem_modelo e o
-- catálogo automacao (regua_nutricao, followup_d1, sessao_sem_agenda,
-- pagamento_atrasado, retorno_combinado, lembrete_sessao, ativos no seed).
-- =============================================================================

begin;

select plan(54);

-- -----------------------------------------------------------------------------
-- 0. Dados sintéticos
-- -----------------------------------------------------------------------------

insert into parametro (chave, valor) values
  ('sessao_sem_agenda_horas', '24'),
  ('agente_followup_horas', '48'),
  ('retencao', '{"chat_memoria_dias":180,"conversa_nao_cliente_meses":24,"log_ip_meses":12}'),
  ('automacao_rota_interna', '"http://localhost:3000/api/interno/automacao"')
on conflict (chave) do update set valor = excluded.valor;

-- Automação sintética com ação externa, para testar o motor sem depender
-- de nenhuma automação real do catálogo (nenhuma da Fase 1 chama rota
-- externa ainda: contrato_fechado, pos_assinatura e pagamento_confirmado
-- são gancho vazio, P30 a P32). Mesmo padrão do teste 009 para o freio
-- (automação "teste_p09_*" sintética).
insert into automacao (id, nome, categoria, executor, gatilho, acoes) values
  ('teste_p20_externa', 'Teste P20 ação externa', 'operacional', 'sistema', '{}',
   '[{"tipo":"chamar_rota_interna","rota":"/teste"}]');

insert into familia (id, nome_exibicao, estado_sensivel, dpp) values
  ('d2000000-0000-4000-8000-000000000001', 'Família Teste P20 Normal',        'normal',         current_date + 100),
  ('d2000000-0000-4000-8000-000000000002', 'Família Teste P20 Atenção',       'atencao',        current_date + 100),
  ('d2000000-0000-4000-8000-000000000003', 'Família Teste P20 Muda Estado',   'normal',         current_date + 100),
  ('d2000000-0000-4000-8000-000000000004', 'Família Teste P20 Já Nasceu',     'normal',         null),
  ('d2000000-0000-4000-8000-000000000005', 'Família Teste P20 Não Escreveu',  'normal',         current_date + 100),
  ('d2000000-0000-4000-8000-000000000006', 'Família Teste P20 Retorno',       'normal',         null),
  ('d2000000-0000-4000-8000-000000000007', 'Família Teste P20 Sessão',        'normal',         null),
  ('d2000000-0000-4000-8000-000000000008', 'Família Teste P20 Cobrança',      'normal',         null),
  ('d2000000-0000-4000-8000-000000000009', 'Família Teste P20 Interesse',     'normal',         null),
  ('d2000000-0000-4000-8000-000000000010', 'Família Teste P20 Lead Vencido',  'normal',         null),
  ('d2000000-0000-4000-8000-000000000011', 'Família Teste P20 Lead Recente',  'normal',         null);

update familia set data_nascimento = current_date - 3 where id = 'd2000000-0000-4000-8000-000000000004';

insert into conversa (id, familia_id, iniciada_por, classificacao, primeira_msg_em, ultima_entrada_em) values
  ('d2000000-0000-4000-8000-000000000101', 'd2000000-0000-4000-8000-000000000001', 'cliente', 'lead', now() - interval '5 days', now() - interval '3 hours'),
  ('d2000000-0000-4000-8000-000000000102', 'd2000000-0000-4000-8000-000000000002', 'cliente', 'lead', now() - interval '5 days', now() - interval '3 hours'),
  ('d2000000-0000-4000-8000-000000000103', 'd2000000-0000-4000-8000-000000000003', 'cliente', 'lead', now() - interval '5 days', now() - interval '3 hours'),
  ('d2000000-0000-4000-8000-000000000104', 'd2000000-0000-4000-8000-000000000004', 'cliente', 'lead', now() - interval '5 days', now() - interval '3 hours');
-- d2...05 (Não Escreveu) fica sem conversa de propósito (D-08).


-- =============================================================================
-- 1. privado.recalculo_regua_nutricao (PRD 10.1, 10.3)
-- =============================================================================

select is(
  (privado.recalculo_regua_nutricao() ->> 'ativa')::boolean, true,
  'regua_nutricao: etapa ativa (automacao.ativa = true no seed)');

select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000001' and tipo = 'nutricao_contato'),
  1, 'família normal, com conversa: recebe uma tarefa de régua');

select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000002' and tipo = 'nutricao_contato'),
  0, 'família em atenção: nenhuma tarefa de régua (freio, categoria conteudo)');
select is(
  (select status::text from automacao_execucao where familia_id = 'd2000000-0000-4000-8000-000000000002' and automacao_id = 'regua_nutricao'),
  'abortada_freio', 'família em atenção: execução da régua fica abortada_freio');
select is(
  (select motivo_aborto from automacao_execucao where familia_id = 'd2000000-0000-4000-8000-000000000002' and automacao_id = 'regua_nutricao'),
  'atencao', 'família em atenção: motivo do aborto é o próprio estado');

select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000004' and tipo = 'nutricao_contato'),
  1, 'família já nascida, com conversa: recebe a tarefa da faixa "já nasceu"');
select is(
  (select payload ->> 'faixa_id' from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000004' and tipo = 'nutricao_contato'),
  (select id::text from regua_faixa where semana_min is null and semana_max is null),
  'família já nascida cai na faixa sem semana_min nem semana_max (regua_nasceu)');

select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000005'),
  0, 'família sem conversa iniciada pela família: régua não entra (D-08)');

select ok(
  (select payload ->> 'texto_sugerido' from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000001' and tipo = 'nutricao_contato') is not null,
  'a tarefa de régua carrega o texto sugerido de mensagem_modelo (PRD 10.3)');

-- dedup: rodar de novo não duplica (mesma faixa)
do $$ begin perform privado.recalculo_regua_nutricao(); end $$;
select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000001' and tipo = 'nutricao_contato'),
  1, 'régua: uma segunda rodada não cria segunda tarefa para a mesma faixa (10.3, nunca repetida)');
select is(
  (select count(*)::integer from automacao_execucao where familia_id = 'd2000000-0000-4000-8000-000000000002' and automacao_id = 'regua_nutricao'),
  1, 'régua: a tentativa abortada também não se repete (consome a faixa)');


-- =============================================================================
-- 2. Materialização por gatilho (PRD 10.1), cada uma com dedup
-- =============================================================================

-- --- retorno_combinado ---------------------------------------------------
insert into oportunidade (familia_id, pipeline, estagio_p1, proximo_contato_em)
  values ('d2000000-0000-4000-8000-000000000006', 1, 'qualificado', current_date - 1);

select is(privado.materializar_retorno_combinado(), 1, 'retorno_combinado: uma execução materializada para proximo_contato_em vencido');
select is(privado.materializar_retorno_combinado(), 0, 'retorno_combinado: segunda chamada não duplica (dedup pela data)');
select is(
  (select count(*)::integer from automacao_execucao where automacao_id = 'retorno_combinado' and familia_id = 'd2000000-0000-4000-8000-000000000006'),
  1, 'retorno_combinado: uma única linha na fila');

-- --- lembrete_sessao (véspera) --------------------------------------------
insert into sessao_venda (familia_id, agendada_para, status)
  values ('d2000000-0000-4000-8000-000000000007', (now() at time zone 'America/Sao_Paulo')::date + 1 + time '10:00', 'agendada');
insert into sessao_venda (familia_id, agendada_para, status)
  values ('d2000000-0000-4000-8000-000000000007', (now() at time zone 'America/Sao_Paulo')::date + 5 + time '10:00', 'agendada');

select is(privado.materializar_lembrete_sessao(), 1, 'lembrete_sessao: só a sessão de amanhã materializa (véspera, PRD 23.2)');
select is(privado.materializar_lembrete_sessao(), 0, 'lembrete_sessao: segunda chamada não duplica (dedup por sessao_venda.id)');

-- --- pagamento_atrasado ----------------------------------------------------
insert into regiao (id, nome, praca, limite_familias_semana) values
  ('d2100000-0000-4000-8000-000000000001', 'Região Teste P20', 'Praça Teste P20', 5);
insert into pacote (id, nome, dias) values ('d2100000-0000-4000-8000-000000000002', 'Pacote Teste P20', 6);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('d2100000-0000-4000-8000-000000000003', 'd2100000-0000-4000-8000-000000000002', 100, 6, '2020-01-01');
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao)
  values ('d2100000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000008', 'd2100000-0000-4000-8000-000000000003', 100, 'teste');
insert into cobranca (contrato_id, parcela, valor_centavos, vencimento, external_id, status)
  values ('d2100000-0000-4000-8000-000000000004', 1, 100, current_date - 5, 'teste-p20-cobranca-001', 'aberta');

select is(privado.materializar_pagamento_atrasado(), 1, 'pagamento_atrasado: uma execução para cobrança vencida em aberto');
select is(privado.materializar_pagamento_atrasado(), 0, 'pagamento_atrasado: segunda chamada não duplica (dedup por cobranca.id)');

-- --- sessao_sem_agenda -------------------------------------------------------
-- O seed já tem oportunidades com sessao_interesse_em antigo (cenários do
-- P17/0010): a asserção conta a linha da família de teste, não o total
-- devolvido pela função (que também materializa as do seed).
insert into oportunidade (familia_id, pipeline, estagio_p1, sessao_interesse_em)
  values ('d2000000-0000-4000-8000-000000000009', 1, 'qualificado', now() - interval '30 hours');

do $$ begin perform privado.materializar_sessao_sem_agenda(); end $$;
select is(
  (select count(*)::integer from automacao_execucao where automacao_id = 'sessao_sem_agenda' and familia_id = 'd2000000-0000-4000-8000-000000000009'),
  1, 'sessao_sem_agenda: interesse há mais de 24h sem handoff materializa (família de teste)');
select is(privado.materializar_sessao_sem_agenda(), 0, 'sessao_sem_agenda: segunda chamada não duplica (dedup pelo instante do interesse)');


-- =============================================================================
-- 3. privado.processar_automacoes: execução externa e aborto pelo freio
-- =============================================================================

insert into automacao_execucao (automacao_id, familia_id, agendada_para, status)
  values ('teste_p20_externa', 'd2000000-0000-4000-8000-000000000001', clock_timestamp(), 'agendada');

-- agendada e depois abortada pelo freio (estado muda ANTES do processar_automacoes)
insert into automacao_execucao (automacao_id, familia_id, agendada_para, status)
  values ('teste_p20_externa', 'd2000000-0000-4000-8000-000000000003', clock_timestamp(), 'agendada');
do $$ begin perform privado.acionar_freio('d2000000-0000-4000-8000-000000000003', 'bloqueio_total', 'teste p20'); end $$;
select is(
  (select status::text from automacao_execucao where automacao_id = 'teste_p20_externa' and familia_id = 'd2000000-0000-4000-8000-000000000003'),
  'abortada_freio', 'execução externa: já fica abortada_freio assim que o estado muda (gatilho do freio, 0009), antes de qualquer processamento');

create temp table r12 on commit drop as select privado.processar_automacoes() as r;

select ok(
  (select count(*)::integer from net._chamadas where url = 'http://localhost:3000/api/interno/automacao/teste'
     and corpo ->> 'familia_id' = 'd2000000-0000-4000-8000-000000000001') = 1,
  'processar_automacoes: execução externa da família normal chega em net._chamadas, com a rota e o corpo certos');
select ok(
  (select count(*)::integer from net._chamadas where corpo ->> 'familia_id' = 'd2000000-0000-4000-8000-000000000003') = 0,
  'processar_automacoes: execução abortada pelo freio nunca chega a chamar net.http_post (net._chamadas sem ela)');
select is(
  (select status::text from automacao_execucao where automacao_id = 'teste_p20_externa' and familia_id = 'd2000000-0000-4000-8000-000000000001'),
  'executada', 'processar_automacoes: execução externa bem-sucedida marcada executada');
select ok(
  (select cabecalhos ->> 'Authorization' from net._chamadas where corpo ->> 'familia_id' = 'd2000000-0000-4000-8000-000000000001') like 'Bearer %',
  'processar_automacoes: a chamada externa leva o segredo do Vault no cabeçalho Authorization');

-- as materializações do passo 2 foram processadas nesta mesma rodada
select is(
  (select status::text from automacao_execucao where automacao_id = 'retorno_combinado' and familia_id = 'd2000000-0000-4000-8000-000000000006'),
  'executada', 'processar_automacoes: retorno_combinado processado e executado (categoria operacional, estado normal)');
select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000006' and tipo = 'followup_comercial'),
  1, 'processar_automacoes: retorno_combinado cria a tarefa followup_comercial');
select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000008' and tipo = 'cobranca_atraso'),
  1, 'processar_automacoes: pagamento_atrasado cria a tarefa cobranca_atraso');
select is(
  (select count(*)::integer from notificacao where papel = 'financeiro' and titulo = 'pagamento_atrasado'),
  1, 'processar_automacoes: pagamento_atrasado notifica o financeiro');
select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000009' and tipo = 'agendar_sessao'),
  1, 'processar_automacoes: sessao_sem_agenda cria a tarefa agendar_sessao (categoria interna, sempre executa)');

-- segunda rodada: nada novo materializado nem processado de novo
create temp table r13 on commit drop as select privado.processar_automacoes() as r;
select is((select (r ->> 'materializadas')::integer from r13), 0, 'processar_automacoes: segunda rodada não materializa nada novo (tudo já dedupado)');
select is((select (r ->> 'processadas')::integer from r13), 0, 'processar_automacoes: segunda rodada não reprocessa execução já executada ou abortada');


-- =============================================================================
-- 4. followup_d1: só agenda (PROMPTS.md P20, Apêndice A)
-- =============================================================================

insert into conversa (id, familia_id, iniciada_por, classificacao, ultima_entrada_em, agente_encerrado_em) values
  ('d2000000-0000-4000-8000-000000000201', null, 'cliente', 'lead', now() - interval '50 hours', null);
update conversa set familia_id = null where id = 'd2000000-0000-4000-8000-000000000201'; -- garante: sem família, não entra
insert into familia (id, nome_exibicao, estado_sensivel) values ('d2000000-0000-4000-8000-000000000012', 'Família Teste P20 Followup', 'normal');
update conversa set familia_id = 'd2000000-0000-4000-8000-000000000012' where id = 'd2000000-0000-4000-8000-000000000201';

insert into familia (id, nome_exibicao, estado_sensivel) values ('d2000000-0000-4000-8000-000000000013', 'Família Teste P20 Comercial', 'normal');
insert into conversa (id, familia_id, iniciada_por, classificacao, ultima_entrada_em, agente_encerrado_em, agente_encerrado_motivo) values
  ('d2000000-0000-4000-8000-000000000202', 'd2000000-0000-4000-8000-000000000013', 'cliente', 'lead', now() - interval '50 hours', now() - interval '1 hour', 'reuniao');

select is(privado.agendar_followup_d1(), 1, 'followup_d1: agenda para a conversa sem resposta há mais de agente_followup_horas');
select is(
  (select status::text from automacao_execucao where automacao_id = 'followup_d1' and familia_id = 'd2000000-0000-4000-8000-000000000012'),
  'agendada', 'followup_d1: fica agendada, nunca executada por este motor (o n8n consome, P22)');
select is(
  (select count(*)::integer from tarefa where familia_id = 'd2000000-0000-4000-8000-000000000012'),
  0, 'followup_d1: nenhuma tarefa criada aqui (o motor só agenda)');
select is(
  (select count(*)::integer from automacao_execucao where automacao_id = 'followup_d1' and familia_id = 'd2000000-0000-4000-8000-000000000013'),
  0, 'followup_d1: conversa em humano_comercial (agente_encerrado_em) nunca agenda');

select is(privado.agendar_followup_d1(), 0, 'followup_d1: segunda chamada não duplica (dedup pela conversa)');

-- família responde de novo: o agendamento velho é cancelado, não fica pendurado
update conversa set ultima_entrada_em = now() where id = 'd2000000-0000-4000-8000-000000000201';
do $$ begin perform privado.agendar_followup_d1(); end $$;
select is(
  (select status::text from automacao_execucao where automacao_id = 'followup_d1' and familia_id = 'd2000000-0000-4000-8000-000000000012'
     order by criado_em desc limit 1),
  'cancelada', 'followup_d1: a família respondeu de novo, o agendamento antigo (baseado na resposta anterior) é cancelado');


-- =============================================================================
-- 5. privado.retencao_diaria (PRD 22.4 O-06)
-- =============================================================================

insert into conversa (id, familia_id, iniciada_por, primeira_msg_em, ultima_entrada_em) values
  ('d2000000-0000-4000-8000-000000000301', 'd2000000-0000-4000-8000-000000000010', 'cliente', now() - interval '900 days', now() - interval '900 days'),
  ('d2000000-0000-4000-8000-000000000302', 'd2000000-0000-4000-8000-000000000011', 'cliente', now() - interval '10 days', now() - interval '10 days');

insert into mensagem (conversa_id, direcao, enviado_por, conteudo, enviada_em) values
  ('d2000000-0000-4000-8000-000000000301', 'entrada', 'cliente', 'Teste P20 mensagem vencida', now() - interval '900 days'),
  ('d2000000-0000-4000-8000-000000000302', 'entrada', 'cliente', 'Teste P20 mensagem recente', now() - interval '10 days');

insert into handoff (conversa_id, familia_id, motivo, destino, prioridade, resumo, status) values
  ('d2000000-0000-4000-8000-000000000301', 'd2000000-0000-4000-8000-000000000010', 'outro', 'comercial', 'normal', 'Teste P20', 'resolvido');

insert into agente_n8n.chat_memoria (session_id, message) values
  ('d2000000-0000-4000-8000-000000000301', '{"type":"human","content":"teste p20 vencida"}'),
  ('d2000000-0000-4000-8000-000000000302', '{"type":"human","content":"teste p20 recente"}');

insert into evento_familia (familia_id, tipo, titulo, dados, criado_em) values
  ('d2000000-0000-4000-8000-000000000010', 'estagio', 'novo → perdido', jsonb_build_object('maquina', 'p1', 'para', 'perdido'), now() - interval '900 days'),
  ('d2000000-0000-4000-8000-000000000011', 'estagio', 'novo → perdido', jsonb_build_object('maquina', 'p1', 'para', 'perdido'), now() - interval '5 days');

select is((privado.retencao_diaria() ->> 'familias_candidatas')::integer, 1, 'retencao_diaria: uma família candidata (vencida, sem contrato, perdida há mais de 24 meses)');

select is(
  (select count(*)::integer from conversa where id = 'd2000000-0000-4000-8000-000000000301'),
  0, 'retencao_diaria: conversa do lead vencido foi apagada');
select is(
  (select count(*)::integer from mensagem where conversa_id = 'd2000000-0000-4000-8000-000000000301'),
  0, 'retencao_diaria: mensagem do lead vencido foi apagada');
select is(
  (select count(*)::integer from handoff where familia_id = 'd2000000-0000-4000-8000-000000000010'),
  0, 'retencao_diaria: handoff do lead vencido foi apagado');
select is(
  (select count(*)::integer from agente_n8n.chat_memoria where session_id = 'd2000000-0000-4000-8000-000000000301'),
  0, 'retencao_diaria: chat_memoria do lead vencido foi apagada');

select is(
  (select count(*)::integer from conversa where id = 'd2000000-0000-4000-8000-000000000302'),
  1, 'retencao_diaria: conversa do lead recente (perdido há 5 dias) é preservada');
select is(
  (select count(*)::integer from mensagem where conversa_id = 'd2000000-0000-4000-8000-000000000302'),
  1, 'retencao_diaria: mensagem do lead recente é preservada');
select is(
  (select count(*)::integer from agente_n8n.chat_memoria where session_id = 'd2000000-0000-4000-8000-000000000302'),
  1, 'retencao_diaria: chat_memoria do lead recente é preservada');

select is(
  (select acao from log_auditoria where entidade = 'retencao_diaria' order by criado_em desc limit 1),
  'retencao', 'retencao_diaria: grava um resumo em log_auditoria com ação retencao');
select ok(
  (select (valor_depois ->> 'conversas_apagadas')::integer from log_auditoria where entidade = 'retencao_diaria' order by criado_em desc limit 1) >= 1,
  'retencao_diaria: o resumo no log traz só contagens (PRD 10.1)');

-- sem parametro.retencao, recusa (nenhum prazo fixo no código)
delete from parametro where chave = 'retencao';
select throws_ok(
  'select privado.retencao_diaria()', '22023',
  'parametro retencao ausente: retencao_diaria não roda sem prazos definidos (PRD 6.8, 22.4 O-06)',
  'retencao_diaria: sem parametro.retencao, recusa (nenhum prazo fixo no código)');
insert into parametro (chave, valor) values
  ('retencao', '{"chat_memoria_dias":180,"conversa_nao_cliente_meses":24,"log_ip_meses":12}');


-- =============================================================================
-- 6. pg_cron e privilégios
-- =============================================================================

select results_eq(
  $$ select schedule, command from cron.job where jobname = 'processar_automacoes' $$,
  $$ values ('*/5 * * * *'::text, 'select privado.processar_automacoes()'::text) $$,
  'pg_cron: processar_automacoes registrado a cada 5 minutos (PRD 10)');
select results_eq(
  $$ select schedule, command from cron.job where jobname = 'retencao_diaria' $$,
  $$ values ('30 10 * * *'::text, 'select privado.retencao_diaria()'::text) $$,
  'pg_cron: retencao_diaria registrado, diário (PRD 22.4 O-06)');

select ok(
  not has_function_privilege('authenticated', 'privado.processar_automacoes()', 'execute')
  and not has_function_privilege('service_role', 'privado.processar_automacoes()', 'execute')
  and not has_function_privilege('anon', 'privado.processar_automacoes()', 'execute'),
  'processar_automacoes: sem execute para anon, authenticated e service_role (só o cron chama)');
select ok(
  not has_function_privilege('authenticated', 'privado.retencao_diaria()', 'execute')
  and not has_function_privilege('service_role', 'privado.retencao_diaria()', 'execute'),
  'retencao_diaria: sem execute para authenticated e service_role');
select ok(
  not has_function_privilege('authenticated', 'privado.recalculo_regua_nutricao()', 'execute')
  and not has_function_privilege('authenticated', 'privado.recalculo_alerta_34s()', 'execute')
  and not has_function_privilege('authenticated', 'privado.chamar_rota_automacao(uuid, text, jsonb)', 'execute'),
  'etapas do recálculo e chamar_rota_automacao: sem execute para authenticated');

select * from finish();

rollback;
