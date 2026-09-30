-- =============================================================================
-- supabase/tests/028_agenda_isadora.sql
--
-- Migration 0028_agenda_isadora (P25b: a Isadora agenda a reunião inicial de
-- 30 minutos com a Edilaine no Google Calendar; PRD 11.14, D-19 a D-21):
--   1. Opções de horário: valem só no dia, uma vez, dentro da antecedência;
--      consulta velha recusada; conferência na escolha.
--   2. agente.registrar_reuniao: só depois de conferida, idempotente por
--      evento, move o P1, grava o e-mail, cria o lembrete, avisa o grupo e
--      não pausa a Isadora.
--   3. Remarcação, cancelamento e sincronização com o calendário.
--   4. Consulta à equipe sem transferir: sem pausa, sem handoff, sem mudar o
--      modo; a devolutiva sai pela Entrada B.
--   5. Desfecho pelo CRM: só a Edilaine, a coordenação e a diretoria
--      registram realizada e falta; realizada põe a conversa em
--      humano_comercial, abre reuniao_realizada, cria a tarefa do Leonardo e
--      "resolver" o handoff não devolve a Isadora; reunião da Isadora não se
--      remarca nem se cancela pelo CRM.
--   6. Cadência de 1, 3 e 14 dias, motivo novo a cada etapa, nunca com
--      reunião agendada ou realizada.
--   7. proativos_agenda_devidos: lembrete, falta e consultas, com freio, não
--      contatar, pausa e janela.
--   8. Privilégios: n8n_agente só pelas funções, o id do evento fora do app.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(193);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2800000-0000-4000-8000-000000000001', 'leonardo.p25b@exemplo.invalid'),
  ('a2800000-0000-4000-8000-000000000002', 'edilaine.p25b@exemplo.invalid'),
  ('a2800000-0000-4000-8000-000000000003', 'diretoria.p25b@exemplo.invalid'),
  ('a2800000-0000-4000-8000-000000000004', 'marketing.p25b@exemplo.invalid');
insert into perfil (id, nome, email, ativo) values
  ('a2800000-0000-4000-8000-000000000001', 'Perfil Teste Leonardo P25b', 'leonardo.p25b@exemplo.invalid', true),
  ('a2800000-0000-4000-8000-000000000002', 'Perfil Teste Edilaine P25b', 'edilaine.p25b@exemplo.invalid', true),
  ('a2800000-0000-4000-8000-000000000003', 'Perfil Teste Diretoria P25b', 'diretoria.p25b@exemplo.invalid', true),
  ('a2800000-0000-4000-8000-000000000004', 'Perfil Teste Marketing P25b', 'marketing.p25b@exemplo.invalid', true);
insert into usuario_papel (usuario_id, papel) values
  ('a2800000-0000-4000-8000-000000000001', 'comercial'),
  ('a2800000-0000-4000-8000-000000000002', 'coordenacao'),
  ('a2800000-0000-4000-8000-000000000003', 'diretoria'),
  ('a2800000-0000-4000-8000-000000000004', 'marketing');

-- parâmetros com os valores do seed (o teste não depende do seed ter rodado)
insert into parametro (chave, valor) values
  ('agente_modo', '"producao"'),
  ('agente_janela_envio', '{"inicio":"00:00","fim":"23:59"}'),
  ('agente_cadencia_dias', '[1,3,14]'),
  ('agenda_bloco_minutos', '30'),
  ('agenda_faixas', '{"seg":[["09:00","12:00"]],"ter":[["09:00","12:00"]],"qua":[["09:00","12:00"]],"qui":[["09:00","12:00"]],"sex":[["09:00","12:00"]]}'),
  ('agenda_antecedencia_horas', '24'),
  ('agenda_intervalo_minutos', '0'),
  ('agenda_janela_dias', '14'),
  ('agenda_titulo_evento', '"Reunião inicial Kraamzorg"'),
  ('agenda_descricao_evento', '"Reunião online sem compromisso."'),
  ('agenda_convidar_leonardo', 'false'),
  ('agenda_condutora_perfil_id', '"a2800000-0000-4000-8000-000000000002"'),
  ('agenda_lembrete_hora', '"10:00"'),
  ('agenda_remarcar_apos_falta_horas', '2'),
  ('agenda_desfecho_pendente_horas', '24'),
  ('agenda_consulta_horario_dias', '3'),
  ('sessao_venda_retorno_horas', '48'),
  ('link_ficha_modelo', '"http://localhost:3000/familias/{familia_id}"')
on conflict (chave) do update set valor = excluded.valor;

update automacao set ativa = true
 where id in ('lembrete_sessao', 'reuniao_falta_remarcar', 'consulta_horario_retomada', 'desfecho_sessao_pendente',
              'followup_d1', 'followup_d3_d14');
update mensagem_modelo set status = 'aprovado'
 where chave in ('lembrete_sessao', 'nao_compareceu', 'followup_d1_pos_pdf', 'followup_d1_pos_abertura', 'followup_d3',
                 'followup_d14', 'sem_resposta_abertura_2', 'horario_liberado', 'instrucao_consulta', 'opcoes_vencidas');

create temp table t_r (chave text primary key, r jsonb) on commit drop;
grant all on t_r to public;

-- Famílias A a J, cada uma com uma pessoa, uma conversa de lead e a oportunidade
insert into familia (id, nome_exibicao, dpp, estado_sensivel) values
  ('c2800000-0000-4000-8000-000000000001', 'Família Teste Agenda A', '2033-01-10', 'normal'),
  ('c2800000-0000-4000-8000-000000000002', 'Família Teste Agenda B', '2033-01-11', 'normal'),
  ('c2800000-0000-4000-8000-000000000003', 'Família Teste Agenda C', '2033-01-12', 'normal'),
  ('c2800000-0000-4000-8000-000000000004', 'Família Teste Agenda D', '2033-01-13', 'normal'),
  ('c2800000-0000-4000-8000-000000000005', 'Família Teste Agenda E', '2033-01-14', 'normal'),
  ('c2800000-0000-4000-8000-000000000006', 'Família Teste Agenda F', '2033-01-15', 'normal'),
  ('c2800000-0000-4000-8000-000000000007', 'Família Teste Agenda G', '2033-01-16', 'normal'),
  ('c2800000-0000-4000-8000-000000000008', 'Família Teste Agenda H', '2033-01-17', 'normal'),
  ('c2800000-0000-4000-8000-000000000009', 'Família Teste Agenda I', '2033-01-18', 'atencao'),
  ('c2800000-0000-4000-8000-000000000010', 'Família Teste Agenda J', '2033-01-19', 'normal');
insert into pessoa (id, familia_id, papel, nome, telefone_e164, contato_principal)
select ('d2800000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       ('c2800000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'mae', 'Mãe Teste Agenda ' || n, '+55119000008' || lpad(n::text, 2, '0'), true
from generate_series(1, 10) n;
insert into conversa (id, wa_jid, telefone_e164, familia_id, pessoa_id, classificacao, iniciada_por, ultima_entrada_em, ultima_saida_em)
select ('f2800000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       '55119000008' || lpad(n::text, 2, '0') || '-teste@s.whatsapp.net', '+55119000008' || lpad(n::text, 2, '0'),
       ('c2800000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       ('d2800000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       'lead', 'cliente', now() - interval '10 minutes', now() - interval '9 minutes'
from generate_series(1, 10) n;
-- E, F e G nascem com a reunião marcada (o estágio só muda por privado.transicionar)
insert into oportunidade (familia_id, pipeline, estagio_p1, pdf_enviado_em, responsavel_id)
select ('c2800000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 1,
       case when n in (5, 6, 7) then 'sessao_venda_agendada' else 'qualificado' end::estagio_p1, now() - interval '1 hour',
       'a2800000-0000-4000-8000-000000000001'
from generate_series(1, 10) n;

-- auxiliares (no schema testes, desfeitos no rollback)
create function testes.p25b_em(dias integer, hora integer) returns timestamptz language sql stable as $$
  select ((((now() at time zone 'America/Sao_Paulo')::date + dias) + make_time(hora, 0, 0))::timestamp) at time zone 'America/Sao_Paulo'
$$;
create function testes.p25b_conv(n integer) returns uuid language sql immutable as $$
  select ('f2800000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function testes.p25b_fam(n integer) returns uuid language sql immutable as $$
  select ('c2800000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
create function testes.p25b_opcoes(n integer, inicios timestamptz[]) returns jsonb language sql as $$
  select agente.registrar_opcoes_horario(testes.p25b_conv(n), to_jsonb(inicios), now())
$$;


-- -----------------------------------------------------------------------------
-- 1. Configuração e opções de horário
-- -----------------------------------------------------------------------------

select is(agente.parametros_agenda() ->> 'configurada', 'true', 'parametros_agenda: agenda configurada (bloco, janela e faixas)');
select is((agente.parametros_agenda() ->> 'bloco_minutos')::integer, 30, 'parametros_agenda: bloco de 30 minutos');
select is(agente.parametros_agenda() ->> 'titulo_evento', 'Reunião inicial Kraamzorg', 'parametros_agenda: título do evento sem o nome da família');
select is(agente.parametros_agenda() -> 'cadencia_dias', '[1,3,14]'::jsonb, 'parametros_agenda: cadência de 1, 3 e 14 dias');
select is(agente.parametros_agenda() ->> 'leonardo_email', null, 'parametros_agenda: sem convidar o Leonardo, nenhum e-mail dele sai');

-- A: duas opções em dias diferentes, daqui a 3 e 4 dias
insert into t_r select 'opcoes_a', testes.p25b_opcoes(1, array[testes.p25b_em(3, 10), testes.p25b_em(4, 15)]);
select is((select (r ->> 'ok')::boolean from t_r where chave = 'opcoes_a'), true, 'registrar_opcoes_horario: duas opções gravadas');
select is(jsonb_array_length((select r -> 'opcoes' from t_r where chave = 'opcoes_a')), 2, 'registrar_opcoes_horario: devolve as duas com id e texto');
select is((select r #>> '{opcoes,0,texto}' from t_r where chave = 'opcoes_a'), privado.agenda_texto(testes.p25b_em(3, 10)),
  'registrar_opcoes_horario: texto no formato "quinta, 02/10, às 10h"');
select is((select valida_ate from sessao_venda_opcao where conversa_id = testes.p25b_conv(1) order by inicio limit 1),
  privado.agenda_fim_do_dia(now()), 'a opção vale até o fim do dia da consulta (America/Sao_Paulo)');
select is(privado.agenda_estado(testes.p25b_conv(1)) ->> 'estado', 'horarios_enviados', 'agenda_estado: horários enviados');
select ok((select oportunidade.sessao_interesse_em is not null from oportunidade where familia_id = testes.p25b_fam(1)),
  'registrar_opcoes_horario marca o interesse na reunião (sessao_interesse_em)');

select is(testes.p25b_opcoes(1, array[testes.p25b_em(0, 23)]) ->> 'erro', 'antecedencia',
  'opção dentro da antecedência mínima (24 horas) é recusada');
select is(agente.registrar_opcoes_horario(testes.p25b_conv(1), to_jsonb(array[testes.p25b_em(3, 10)]), now() - interval '1 hour') ->> 'erro',
  'consulta_antiga', 'consulta com mais de 15 minutos é recusada (nunca se oferece horário de outra consulta)');
select is(agente.registrar_opcoes_horario(testes.p25b_conv(1), '[]'::jsonb, now()) ->> 'erro', 'opcoes_invalidas', 'lista vazia é recusada');
select is(testes.p25b_opcoes(1, array[testes.p25b_em(3, 10), testes.p25b_em(3, 10)]) ->> 'erro', 'opcoes_repetidas', 'opções repetidas são recusadas');
select is((select count(*)::integer from sessao_venda_opcao where conversa_id = testes.p25b_conv(1) and descartada_em is null and escolhida_em is null), 2,
  'as recusas não descartam as opções vigentes');

-- opção oferecida ontem: valida_ate no passado
insert into sessao_venda_opcao (id, conversa_id, inicio, fim, consultada_em, valida_ate)
values ('e2800000-0000-4000-8000-000000000001', testes.p25b_conv(2), testes.p25b_em(3, 10), testes.p25b_em(3, 10) + interval '30 minutes',
        now() - interval '1 day', now() - interval '1 hour');
select is(agente.validar_opcao_horario(testes.p25b_conv(2), 'e2800000-0000-4000-8000-000000000001') ->> 'erro', 'expirada',
  'opção oferecida ontem: expirada (valem só no dia)');
select is(agente.registrar_conferencia_horario(testes.p25b_conv(2), 'e2800000-0000-4000-8000-000000000001', true) ->> 'erro', 'expirada',
  'opção oferecida ontem: a conferência é recusada');
select is(agente.registrar_reuniao(testes.p25b_conv(2), 'e2800000-0000-4000-8000-000000000001', 'evtexpirada1', 'https://meet.exemplo.invalid/a', 'b@exemplo.invalid') ->> 'erro',
  'expirada', 'opção oferecida ontem: não vira reunião');
select is((select count(*)::integer from sessao_venda where familia_id = testes.p25b_fam(2)), 0, 'opção expirada: nenhuma sessão criada');

-- opção dentro da antecedência (criada direto para provar a segunda barreira)
insert into sessao_venda_opcao (id, conversa_id, inicio, fim, consultada_em, valida_ate)
values ('e2800000-0000-4000-8000-000000000002', testes.p25b_conv(2), now() + interval '2 hours', now() + interval '150 minutes', now(), now() + interval '1 day');
select is(agente.validar_opcao_horario(testes.p25b_conv(2), 'e2800000-0000-4000-8000-000000000002') ->> 'erro', 'antecedencia',
  'validar_opcao_horario: antecedência mínima respeitada');
-- a opção mais cedo fica no limite da antecedência: horas depois da oferta, no mesmo dia, ela continua valendo
insert into sessao_venda_opcao (id, conversa_id, inicio, fim, consultada_em, valida_ate)
values ('e2800000-0000-4000-8000-000000000003', testes.p25b_conv(4), now() + interval '21 hours', now() + interval '21 hours 30 minutes',
        now() - interval '3 hours', now() + interval '1 hour');
select is((agente.validar_opcao_horario(testes.p25b_conv(4), 'e2800000-0000-4000-8000-000000000003') ->> 'ok')::boolean, true,
  'antecedência medida na oferta: a opção do limite não vence horas depois de oferecida');
insert into sessao_venda_opcao (id, conversa_id, inicio, fim, consultada_em, valida_ate)
values ('e2800000-0000-4000-8000-000000000004', testes.p25b_conv(4), now() - interval '1 minute', now() + interval '29 minutes',
        now() - interval '1 day', now() + interval '1 hour');
select is(agente.validar_opcao_horario(testes.p25b_conv(4), 'e2800000-0000-4000-8000-000000000004') ->> 'erro', 'expirada',
  'horário que já começou nunca vale');
delete from sessao_venda_opcao where id in ('e2800000-0000-4000-8000-000000000003', 'e2800000-0000-4000-8000-000000000004');
select is(agente.validar_opcao_horario(testes.p25b_conv(3), 'e2800000-0000-4000-8000-000000000002') ->> 'erro', 'inexistente',
  'opção de outra conversa: inexistente (a chave é o conversa_id)');

-- conferência na escolha: A escolhe a primeira opção
select is((agente.validar_opcao_horario(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a')) ->> 'ok')::boolean,
  true, 'validar_opcao_horario: opção de hoje, livre e dentro da antecedência');
select is(agente.registrar_reuniao(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'),
  'evtagendaum1', 'https://meet.google.com/aaa-bbbb-ccc', 'mae.a@exemplo.invalid') ->> 'erro', 'nao_conferida',
  'registrar_reuniao sem a segunda consulta (conferência) é recusado');
select is(agente.registrar_conferencia_horario(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'), true) ->> 'estado',
  'livre', 'conferência: horário continua livre');
select is(privado.agenda_estado(testes.p25b_conv(1)) ->> 'estado', 'aguardando_email', 'agenda_estado: aguardando o e-mail do convite');
select is(agente.ficha_para_agente(testes.p25b_conv(1)) ->> 'agenda_estado', 'aguardando_email', 'ficha: agenda_estado aguardando_email');
select ok((agente.ficha_para_agente(testes.p25b_conv(1)) ->> 'ficha') like '%Situação da reunião: aguardando e-mail%'
          and (agente.ficha_para_agente(testes.p25b_conv(1)) ->> 'ficha') like '%Horários oferecidos hoje: %(id_opcao %',
  'ficha: as linhas da agenda dizem que aguarda o e-mail e trazem o id da opção');

-- horário ocupado na conferência: a opção é descartada
select is(agente.registrar_conferencia_horario(testes.p25b_conv(1), (select (r #>> '{opcoes,1,id_opcao}')::uuid from t_r where chave = 'opcoes_a'), false) ->> 'estado',
  'ocupado', 'conferência: horário ocupado');
select ok((select descartada_em is not null from sessao_venda_opcao where id = (select (r #>> '{opcoes,1,id_opcao}')::uuid from t_r where chave = 'opcoes_a')),
  'horário ocupado: a opção é descartada');

-- e-mail inválido e evento inválido
select is(agente.registrar_reuniao(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'),
  'evtagendaum1', 'https://meet.google.com/aaa-bbbb-ccc', 'isto-nao-e-email') ->> 'erro', 'email_invalido', 'e-mail inválido é recusado');
select is(agente.registrar_reuniao(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'),
  'x', 'https://meet.google.com/aaa-bbbb-ccc', 'mae.a@exemplo.invalid') ->> 'erro', 'evento_invalido', 'id de evento fora do formato é recusado');
select is(agente.registrar_reuniao(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'),
  'evtagendaum1', 'http://meet.exemplo.invalid/a', 'mae.a@exemplo.invalid') ->> 'erro', 'link_invalido', 'link sem https é recusado');


-- -----------------------------------------------------------------------------
-- 2. registrar_reuniao
-- -----------------------------------------------------------------------------

insert into t_r select 'reuniao_a', agente.registrar_reuniao(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'),
  'evtagendaum1', 'https://meet.google.com/aaa-bbbb-ccc', 'mae.a@exemplo.invalid', 'parceiro.a@exemplo.invalid');
select is((select (r ->> 'ok')::boolean from t_r where chave = 'reuniao_a'), true, 'registrar_reuniao: reunião registrada');
select results_eq(
  $$ select agendada_por::text, status::text, evento_calendar_id, link_reuniao, conduzida_por, agendada_para = testes.p25b_em(3, 10)
     from sessao_venda where familia_id = testes.p25b_fam(1) $$,
  $$ values ('isadora', 'agendada', 'evtagendaum1', 'https://meet.google.com/aaa-bbbb-ccc', 'a2800000-0000-4000-8000-000000000002'::uuid, true) $$,
  'a sessão nasce agendada pela Isadora, com o evento, o Meet e a Edilaine como condutora');
select is((select estagio_p1::text from oportunidade where familia_id = testes.p25b_fam(1)), 'sessao_venda_agendada',
  'registrar_reuniao move o P1 para sessao_venda_agendada (privado.transicionar)');
select is((select email from pessoa where id = 'd2800000-0000-4000-8000-000000000001'), 'mae.a@exemplo.invalid', 'o e-mail da pessoa é gravado');
select is((select count(*)::integer from pessoa where email = 'parceiro.a@exemplo.invalid'), 0, 'o e-mail do parceiro nunca é gravado (entra só no convite)');
select ok((select escolhida_em is not null from sessao_venda_opcao where id = (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a')),
  'a opção escolhida fica marcada');
select is((select count(*)::integer from sessao_venda_opcao where conversa_id = testes.p25b_conv(1) and escolhida_em is null and descartada_em is null), 0,
  'as demais opções da conversa deixam de valer');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1) and status = 'agendada'), 1,
  'nasce a execução do lembrete da véspera (executor agente)');
select ok((select agendada_para = testes.p25b_em(2, 10) from automacao_execucao where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1)),
  'o lembrete é da véspera, na hora de agenda_lembrete_hora');
select is((select count(*)::integer from tarefa where familia_id = testes.p25b_fam(1) and payload ->> 'mensagemChave' = 'lembrete_sessao'), 0,
  'reunião da Isadora não cria a tarefa humana de lembrete');
select ok((select r ->> 'mensagem_grupo' like '%REUNIÃO AGENDADA PELA ISADORA%' and r ->> 'mensagem_grupo' like '%A Isadora segue atendendo esta conversa.'
           from t_r where chave = 'reuniao_a'), 'aviso ao grupo da Edilaine, sem pausar a Isadora');
select is((select r ->> 'grupo_jid' from t_r where chave = 'reuniao_a'),
  (select valor ->> 'coordenacao_clinica' from parametro where chave = 'grupo_whatsapp_por_destino'), 'o aviso vai ao grupo da coordenação clínica');
select is(agente.pode_responder(testes.p25b_conv(1)) ->> 'modo', 'vendas', 'a Isadora não é pausada: modo vendas');
select is((select count(*)::integer from handoff where conversa_id = testes.p25b_conv(1)), 0, 'agendar não abre transferência');
select is(privado.agenda_estado(testes.p25b_conv(1)) ->> 'estado', 'agendada', 'agenda_estado: agendada');
select ok((agente.ficha_para_agente(testes.p25b_conv(1)) ->> 'ficha') like '%Situação da reunião: agendada%Reunião marcada: %agendada em %'
          and position('evtagendaum1' in agente.ficha_para_agente(testes.p25b_conv(1))::text) = 0,
  'a ficha mostra a reunião e nunca o id do evento');

-- idempotência por evento
insert into t_r select 'reuniao_a2', agente.registrar_reuniao(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'),
  'evtagendaum1', 'https://meet.google.com/aaa-bbbb-ccc', 'mae.a@exemplo.invalid');
select is((select (r ->> 'duplicado')::boolean from t_r where chave = 'reuniao_a2'), true, 'registrar_reuniao é idempotente por evento_id');
select is((select count(*)::integer from sessao_venda where familia_id = testes.p25b_fam(1)), 1, 'idempotência: uma sessão só');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1)), 1,
  'idempotência: um lembrete só');
select is(agente.registrar_reuniao(testes.p25b_conv(3), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'),
  'evtagendaum1', 'https://meet.google.com/aaa-bbbb-ccc', 'outra@exemplo.invalid') ->> 'erro', 'evento_de_outra_familia',
  'o mesmo evento em outra família é recusado');
select is(agente.registrar_reuniao(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a'),
  'evtagendadois', 'https://meet.google.com/aaa-bbbb-ddd', 'mae.a@exemplo.invalid') ->> 'erro', 'usada',
  'opção já usada não vira uma segunda reunião');

-- reuniao_da_conversa: a única fonte do id do evento
select results_eq(
  $$ select r ->> 'evento_id', r ->> 'agendada_por', r ->> 'link', (r ->> 'existe')::boolean
     from (select agente.reuniao_da_conversa(testes.p25b_conv(1)) r) x $$,
  $$ values ('evtagendaum1', 'isadora', 'https://meet.google.com/aaa-bbbb-ccc', true) $$,
  'reuniao_da_conversa devolve o id do evento da reunião da Isadora');
select is((agente.reuniao_da_conversa(testes.p25b_conv(3)) ->> 'existe')::boolean, false, 'reuniao_da_conversa: sem reunião, existe falso');


-- -----------------------------------------------------------------------------
-- 3. Remarcação, cancelamento e sincronização com o calendário
-- -----------------------------------------------------------------------------

select is(agente.registrar_remarcacao(testes.p25b_conv(3), '{}'::jsonb) ->> 'erro', 'sem_reuniao_da_isadora', 'remarcar sem reunião da Isadora é recusado');
insert into t_r select 'opcoes_a2', testes.p25b_opcoes(1, array[testes.p25b_em(5, 11), testes.p25b_em(6, 14)]);
select is(agente.registrar_remarcacao(testes.p25b_conv(1), jsonb_build_object('id_opcao', (select r #>> '{opcoes,0,id_opcao}' from t_r where chave = 'opcoes_a2'))) ->> 'erro',
  'nao_conferida', 'remarcar exige a conferência da nova opção');
select is(agente.registrar_conferencia_horario(testes.p25b_conv(1), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_a2'), true) ->> 'estado', 'livre',
  'conferência da nova opção');
select is(agente.registrar_remarcacao(testes.p25b_conv(1), jsonb_build_object('id_opcao', (select r #>> '{opcoes,0,id_opcao}' from t_r where chave = 'opcoes_a2'), 'evento_id', 'outroevento1')) ->> 'erro',
  'evento_diferente', 'remarcar só com o evento da própria sessão');
insert into t_r select 'remarcar_a', agente.registrar_remarcacao(testes.p25b_conv(1),
  jsonb_build_object('id_opcao', (select r #>> '{opcoes,0,id_opcao}' from t_r where chave = 'opcoes_a2')));
select is((select (r ->> 'ok')::boolean from t_r where chave = 'remarcar_a'), true, 'registrar_remarcacao: ok');
select results_eq(
  $$ select status::text, evento_calendar_id from sessao_venda where familia_id = testes.p25b_fam(1) order by criado_em $$,
  $$ values ('remarcada', 'evtagendaum1'), ('agendada', 'evtagendaum1') $$,
  'a sessão antiga vira remarcada e nasce a nova, com o mesmo evento');
select is((select agendada_para from sessao_venda where familia_id = testes.p25b_fam(1) and status = 'agendada'), testes.p25b_em(5, 11), 'a nova sessão está no horário novo');
select results_eq(
  $$ select status::text from automacao_execucao where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1) order by criado_em $$,
  $$ values ('cancelada'), ('agendada') $$, 'o lembrete antigo é cancelado e nasce o novo');
select is((select estagio_p1::text from oportunidade where familia_id = testes.p25b_fam(1)), 'sessao_venda_agendada', 'remarcar mantém o P1');
select is((select (agente.registrar_remarcacao(testes.p25b_conv(1), jsonb_build_object('id_opcao', (select r #>> '{opcoes,0,id_opcao}' from t_r where chave = 'opcoes_a2'))) ->> 'duplicado')::boolean),
  true, 'repetir a remarcação devolve duplicado');

-- sincronização: o evento foi movido / apagado no calendário
select is(jsonb_array_length(agente.sessoes_para_sincronizar() -> 'itens') >= 1, true, 'sessoes_para_sincronizar lista a reunião da Isadora dos próximos dias');
select is((select i ->> 'evento_id' from jsonb_array_elements(agente.sessoes_para_sincronizar() -> 'itens') i
           where i ->> 'sessao_id' = (select id::text from sessao_venda where familia_id = testes.p25b_fam(1) and status = 'agendada')),
  'evtagendaum1', 'o id do evento sai do banco, só por esta função');
select is(agente.sincronizar_reuniao((select id from sessao_venda where familia_id = testes.p25b_fam(1) and status = 'agendada'),
  testes.p25b_em(7, 9), testes.p25b_em(7, 9) + interval '30 minutes', 'movida') ->> 'status', 'movida', 'sincronizar: evento movido');
select is((select agendada_para from sessao_venda where familia_id = testes.p25b_fam(1) and status = 'agendada'), testes.p25b_em(7, 9), 'evento movido atualiza o início da sessão');
select ok((select agendada_para = testes.p25b_em(6, 10) from automacao_execucao
           where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1) and status = 'agendada'), 'evento movido refaz o lembrete da véspera');
select is(agente.sincronizar_reuniao((select id from sessao_venda where familia_id = testes.p25b_fam(1) and status = 'agendada'),
  testes.p25b_em(7, 9), testes.p25b_em(7, 9) + interval '30 minutes', 'movida') ->> 'alterada', 'false', 'sincronizar sem mudança não altera nada');

-- cancelamento a pedido da família: B agenda e cancela
insert into t_r select 'opcoes_b', testes.p25b_opcoes(2, array[testes.p25b_em(3, 11), testes.p25b_em(4, 11)]);
insert into t_r select 'passo' || 1, agente.registrar_conferencia_horario(testes.p25b_conv(2), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_b'), true);
insert into t_r select 'passo' || 2, agente.registrar_reuniao(testes.p25b_conv(2), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_b'), 'evtagendabb1', 'https://meet.google.com/bbb-bbbb-bbb', 'b@exemplo.invalid');
insert into t_r select 'cancelar_b', agente.registrar_cancelamento(testes.p25b_conv(2), '{"motivo":"vai viajar"}');
select is((select (r ->> 'ok')::boolean from t_r where chave = 'cancelar_b'), true, 'registrar_cancelamento: ok');
select is((select status::text from sessao_venda where familia_id = testes.p25b_fam(2)), 'cancelada', 'a sessão fica cancelada');
select is((select estagio_p1::text from oportunidade where familia_id = testes.p25b_fam(2)), 'qualificado', 'cancelar devolve o P1 a qualificado');
select is((select status::text from automacao_execucao where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(2)), 'cancelada', 'cancelar cancela o lembrete');
select is(agente.registrar_cancelamento(testes.p25b_conv(2), '{}'::jsonb) ->> 'erro', 'sem_reuniao_da_isadora', 'cancelar sem reunião vigente é recusado');
-- evento apagado no calendário
insert into t_r select 'opcoes_j', testes.p25b_opcoes(10, array[testes.p25b_em(3, 9), testes.p25b_em(4, 9)]);
insert into t_r select 'passo' || 3, agente.registrar_conferencia_horario(testes.p25b_conv(10), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_j'), true);
insert into t_r select 'passo' || 4, agente.registrar_reuniao(testes.p25b_conv(10), (select (r #>> '{opcoes,0,id_opcao}')::uuid from t_r where chave = 'opcoes_j'), 'evtagendajj1', 'https://meet.google.com/jjj-jjjj-jjj', 'j@exemplo.invalid');
select is(agente.sincronizar_reuniao((select id from sessao_venda where familia_id = testes.p25b_fam(10) and status = 'agendada'), null, null, 'apagada') ->> 'status',
  'cancelada', 'evento apagado no calendário: a sessão é cancelada');
select is((select estagio_p1::text from oportunidade where familia_id = testes.p25b_fam(10)), 'qualificado', 'evento apagado: o P1 volta a qualificado');
select is((select count(*)::integer from tarefa where familia_id = testes.p25b_fam(10) and tipo = 'responder_consulta_isadora' and prioridade = 'alta'), 1,
  'evento apagado: tarefa de prioridade alta para a coordenação');


-- -----------------------------------------------------------------------------
-- 4. Consulta à equipe, sem transferir
-- -----------------------------------------------------------------------------

insert into t_r select 'consulta_area', agente.registrar_consulta_equipe(testes.p25b_conv(3), 'area', 'Santo André, Centro: a Kraamzorg atende?');
select is((select (r ->> 'ok')::boolean from t_r where chave = 'consulta_area'), true, 'registrar_consulta_equipe: consulta aberta');
select is(agente.pode_responder(testes.p25b_conv(3)) ->> 'modo', 'vendas', 'a consulta não muda o modo da conversa');
select ok((select agente_pausado_ate is null and agente_encerrado_em is null from conversa where id = testes.p25b_conv(3)), 'a consulta não pausa a Isadora');
select is((select count(*)::integer from handoff where conversa_id = testes.p25b_conv(3)), 0, 'a consulta não abre transferência');
select is((select destino::text from consulta_equipe where id = (select (r ->> 'consulta_id')::uuid from t_r where chave = 'consulta_area')), 'comercial', 'área vai ao comercial');
select ok((select r ->> 'mensagem_grupo' like '%A ISADORA PERGUNTA%' and r ->> 'mensagem_grupo' like '%Santo André%'
           and r ->> 'mensagem_grupo' like '%A Isadora segue atendendo esta conversa.' from t_r where chave = 'consulta_area'),
  'aviso ao grupo com a pergunta e o rodapé "A Isadora segue atendendo"');
select is((select count(*)::integer from tarefa where tipo = 'responder_consulta_isadora' and payload ->> 'consulta_id' = (select r ->> 'consulta_id' from t_r where chave = 'consulta_area')), 1,
  'nasce a tarefa responder_consulta_isadora');
select is((agente.registrar_consulta_equipe(testes.p25b_conv(3), 'area', 'Santo André, Centro: a Kraamzorg atende?') ->> 'duplicado')::boolean, true,
  'consulta aberta igual não reavisa');
select is(agente.registrar_consulta_equipe(testes.p25b_conv(3), 'fofoca', 'x') ->> 'erro', 'tipo_invalido', 'tipo fora da lista é recusado');
select is(agente.registrar_consulta_equipe(testes.p25b_conv(3), 'duvida', '   ') ->> 'erro', 'pergunta_obrigatoria', 'pergunta vazia é recusada');
insert into t_r select 'consulta_horario', agente.registrar_consulta_equipe(testes.p25b_conv(4), 'horario_edilaine', 'Só depois das 20h', '{"periodos":"noite","dias":"terça"}');
select results_eq(
  $$ select destino::text, expira_em is not null, preferencia ->> 'periodos' from consulta_equipe where id = (select (r ->> 'consulta_id')::uuid from t_r where chave = 'consulta_horario') $$,
  $$ values ('coordenacao_clinica', true, 'noite') $$, 'horário vai à Edilaine, com prazo e a preferência da família');
select ok((select r ->> 'mensagem_grupo' like '%SEM HORÁRIO COMPATÍVEL%' and r ->> 'mensagem_grupo' like '%terça, noite%' from t_r where chave = 'consulta_horario'),
  'aviso de horário com a preferência da família');
select is(agente.registrar_consulta_equipe(testes.p25b_conv(4), 'horario_edilaine', 'Sábado de manhã', '{"periodos":"manhã"}') ->> 'duplicado', 'true',
  'segunda consulta de horário na mesma conversa só acrescenta a preferência');
select is((select preferencia ->> 'periodos' from consulta_equipe where conversa_id = testes.p25b_conv(4)), 'manhã', 'a preferência nova vale');

-- a equipe responde no CRM; a devolutiva sai pela Entrada B
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.responder_consulta_equipe('e2800000-0000-4000-8000-0000000000ff', 'x') $s$, 'P0002', null, 'responder consulta que não existe');
select throws_ok(format($s$ select api.responder_consulta_equipe(%L, null) $s$, (select r ->> 'consulta_id' from t_r where chave = 'consulta_area')),
  '22023', null, 'responder área ou dúvida sem texto é recusado');
select is((select (api.responder_consulta_equipe((select (r ->> 'consulta_id')::uuid from t_r where chave = 'consulta_area'),
  'Atendemos Santo André, sem taxa.') ->> 'ok')::boolean), true, 'api.responder_consulta_equipe: comercial responde');
select is(jsonb_array_length((select coalesce(jsonb_agg(x), '[]'::jsonb) from api.consultas_equipe('respondida') x where x.id = (select (r ->> 'consulta_id')::uuid from t_r where chave = 'consulta_area'))),
  1, 'api.consultas_equipe lista a consulta respondida com o nome da família');
select testes.encerrar();
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000004', 'aal1');
select throws_ok($s$ select * from api.consultas_equipe() $s$, '42501', null, 'marketing não lê as perguntas da Isadora');
select testes.encerrar();
select is((select status::text from tarefa where tipo = 'responder_consulta_isadora' and payload ->> 'consulta_id' = (select r ->> 'consulta_id' from t_r where chave = 'consulta_area')),
  'concluida', 'responder conclui a tarefa');

insert into t_r select 'proativos_1', agente.proativos_agenda_devidos();
select ok((select exists (select 1 from jsonb_array_elements(r -> 'itens') i
                          where i ->> 'tipo' = 'devolutiva' and i ->> 'conversa_id' = testes.p25b_conv(3)::text
                            and i ->> 'resposta' = 'Atendemos Santo André, sem taxa.' and i ->> 'wa_jid' is not null)
           from t_r where chave = 'proativos_1'), 'proativos_agenda_devidos: devolutiva da consulta respondida');
select ok((select exists (select 1 from jsonb_array_elements(r -> 'itens') i
                          where i ->> 'tipo' = 'horario' and i ->> 'conversa_id' = testes.p25b_conv(4)::text and i ->> 'texto_base' like 'Oi, %A Edilaine abriu um horário%')
           from t_r where chave = 'proativos_1'), 'proativos_agenda_devidos: consulta de horário aberta, com o texto de horário liberado');
select ok((select not exists (select 1 from jsonb_array_elements(agente.proativos_agenda_devidos() -> 'itens') i where i ->> 'conversa_id' = testes.p25b_conv(3)::text)),
  'a mesma consulta não volta duas vezes na mesma rodada (reservada)');
select is(agente.fechar_consulta((select (r ->> 'consulta_id')::uuid from t_r where chave = 'consulta_area'), 'devolvida', 'Oi! Atendemos Santo André, sem taxa.') ->> 'ok', 'true',
  'fechar_consulta devolvida');
select ok((select devolvida_em is not null and status = 'respondida' from consulta_equipe where id = (select (r ->> 'consulta_id')::uuid from t_r where chave = 'consulta_area')),
  'a consulta devolvida guarda devolvida_em e continua respondida');
select is((select count(*)::integer from mensagem where conversa_id = testes.p25b_conv(3) and enviado_por = 'ia' and conteudo like 'Oi! Atendemos Santo André%'), 1,
  'a devolutiva fica na conversa como fala da Isadora');


-- -----------------------------------------------------------------------------
-- 5. Desfecho pelo CRM
-- -----------------------------------------------------------------------------

-- sessão da Isadora no passado (criada pelo dono), conversa com follow-up agendado
insert into sessao_venda (id, familia_id, agendada_para, conduzida_por, link_reuniao, evento_calendar_id, agendada_por, status)
values ('b2800000-0000-4000-8000-000000000005', testes.p25b_fam(5), now() - interval '2 hours', 'a2800000-0000-4000-8000-000000000002',
        'https://meet.google.com/eee-eeee-eee', 'evtagendaee1', 'isadora', 'agendada'),
       ('b2800000-0000-4000-8000-000000000006', testes.p25b_fam(6), now() - interval '3 hours', 'a2800000-0000-4000-8000-000000000002',
        'https://meet.google.com/fff-ffff-fff', 'evtagendaff1', 'isadora', 'agendada'),
       ('b2800000-0000-4000-8000-000000000007', testes.p25b_fam(7), now() - interval '3 hours', 'a2800000-0000-4000-8000-000000000002',
        'https://meet.exemplo.invalid/humana', null, 'humano', 'agendada');
insert into automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
values ('followup_d1', testes.p25b_fam(5), now(), 'agendada', jsonb_build_object('conversa_id', testes.p25b_conv(5), 'ultima_entrada_em', now(), 'etapa', 1));
insert into conversa (id, wa_jid, telefone_e164, familia_id, classificacao, iniciada_por, ultima_entrada_em)
values ('f2800000-0000-4000-8000-000000000105', '5511900000895-teste@s.whatsapp.net', '+5511900000895', testes.p25b_fam(5), 'lead', 'cliente', now() - interval '3 hours');

-- comercial não registra realizada; a página do CRM traz a origem e o resumo
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000001', 'aal1');
select throws_like($s$ select api.registrar_desfecho_sessao_venda('b2800000-0000-4000-8000-000000000005', 'realizada') $s$, '%venda:so_edilaine%',
  'comercial não registra realizada (só a Edilaine, a coordenação e a diretoria)');
select throws_like($s$ select api.registrar_desfecho_sessao_venda('b2800000-0000-4000-8000-000000000006', 'nao_compareceu') $s$, '%venda:so_edilaine%',
  'comercial não registra falta');
select throws_like($s$ select api.registrar_desfecho_sessao_venda('b2800000-0000-4000-8000-000000000005', 'cancelada') $s$, '%venda:sessao_da_isadora%',
  'cancelar pelo CRM a reunião da Isadora é recusado');
select throws_like($s$ select api.remarcar_sessao_venda('b2800000-0000-4000-8000-000000000005', now() + interval '5 days') $s$, '%venda:sessao_da_isadora%',
  'remarcar pelo CRM a reunião da Isadora é recusado');
select throws_like($s$ update sessao_venda set link_reuniao = 'https://meet.exemplo.invalid/outro' where id = 'b2800000-0000-4000-8000-000000000005' $s$, '%venda:sessao_da_isadora%',
  'trocar o link direto da reunião da Isadora é recusado');
select testes.encerrar();

select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000002', 'aal2');
select is((select agendada_por::text from api.sessoes_venda(null, null, null, 'b2800000-0000-4000-8000-000000000005')), 'isadora', 'api.sessoes_venda traz a origem da reunião');
select is((select conversa_com from api.sessoes_venda(null, null, null, 'b2800000-0000-4000-8000-000000000005')), 'isadora', 'quem conduz a conversa hoje: a Isadora');
select ok((select resumo_isadora like '%reunião com a Edilaine: agendada para %' from api.sessoes_venda(null, null, null, 'b2800000-0000-4000-8000-000000000005')),
  'o detalhe da sessão traz o resumo da Isadora com a reunião');
select throws_ok($s$ select evento_calendar_id from sessao_venda $s$, '42501', null, 'o app não lê evento_calendar_id (PRD 13)');
select throws_ok($s$ select * from sessao_venda $s$, '42501', null, 'select * de sessao_venda falha para o app (o id do evento está fora do grant)');
select throws_ok($s$ select * from sessao_venda_opcao $s$, '42501', null, 'o app não lê sessao_venda_opcao');

-- a Isadora anota o pedido de condição antes da reunião (não transfere)
select testes.encerrar();
insert into t_r select 'marco', agente.registrar_marco(testes.p25b_conv(5), 'anotacao_comercial', 'Pediu desconto no Pix e perguntou do contrato');
select is((select (r ->> 'ok')::boolean from t_r where chave = 'marco'), true, 'registrar_marco anotacao_comercial: ok');
select is((select count(*)::integer from handoff where familia_id = testes.p25b_fam(5)), 0, 'a anotação não abre transferência');
select ok((select privado.agente_resumo_interno(testes.p25b_conv(5), null, '{}'::jsonb)
                  like '%pedidos de condição ou dúvidas de contrato anotados: Pediu desconto no Pix e perguntou do contrato%'), 'a anotação entra no resumo interno para o Leonardo');
select is(agente.registrar_marco(testes.p25b_conv(5), 'anotacao_comercial', '   ') ->> 'erro', 'valor_invalido', 'anotação vazia é recusada');

-- realizada pela Edilaine
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000002', 'aal2');
insert into t_r select 'realizada', api.registrar_desfecho_sessao_venda('b2800000-0000-4000-8000-000000000005', 'realizada', true, 'Interesse no Continuado, pediu a proposta.');
select testes.encerrar();
select is((select (r ->> 'ok')::boolean from t_r where chave = 'realizada'), true, 'realizada pela Edilaine: ok');
select is((select estagio_p1::text from oportunidade where familia_id = testes.p25b_fam(5)), 'sessao_venda_realizada', 'realizada: P1 para sessao_venda_realizada');
select results_eq(
  $$ select agente_encerrado_em is not null, agente_encerrado_motivo from conversa where id = testes.p25b_conv(5) $$,
  $$ values (true, 'reuniao_realizada') $$, 'realizada: a conversa vai a humano_comercial (reuniao_realizada)');
select is(agente.pode_responder(testes.p25b_conv(5)) ->> 'modo', 'humano_comercial', 'realizada: pode_responder devolve humano_comercial');
select is(agente.pode_enviar(testes.p25b_conv(5), 'resposta') ->> 'motivo', 'humano_comercial', 'realizada: a Isadora não envia mais resposta');
select results_eq(
  $$ select motivo::text, destino::text, prioridade::text, status::text, dados ->> 'resultado' from handoff where familia_id = testes.p25b_fam(5) $$,
  $$ values ('reuniao_realizada', 'comercial', 'normal', 'aberto', 'Interesse no Continuado, pediu a proposta.') $$,
  'realizada: transferência reuniao_realizada para o comercial, com o resultado');
select ok((select resumo like '%Interesse%' or resumo like '%reunião com a Edilaine%' from handoff where familia_id = testes.p25b_fam(5)), 'o handoff leva o resumo interno');
select is((select count(*)::integer from tarefa where familia_id = testes.p25b_fam(5) and payload ->> 'mensagemChave' = 'pos_sessao_48h' and papel_responsavel is not null or responsavel_id = 'a2800000-0000-4000-8000-000000000001'), 1,
  'realizada: tarefa pos_sessao_48h para o Leonardo (responsável da oportunidade)');
select is((select status::text from automacao_execucao where automacao_id = 'followup_d1' and familia_id = testes.p25b_fam(5)), 'cancelada', 'realizada: a cadência pendente é cancelada');
select ok(exists (select 1 from notificacao where titulo = 'reuniao_realizada' and papel = 'comercial' and 'whatsapp_interno' = any (canais)
                  and corpo like '%REUNIÃO REALIZADA%' and corpo like '%A Isadora não volta a esta conversa.%'),
  'realizada: aviso ao grupo por notificação interna (whatsapp_interno)');
select ok((select realizada_em is not null and resultado = 'Interesse no Continuado, pediu a proposta.' and parceiro_presente from sessao_venda where id = 'b2800000-0000-4000-8000-000000000005'),
  'realizada: horário, resultado e parceiro presente gravados');
select is((select count(*)::integer from conversa where familia_id = testes.p25b_fam(5) and agente_encerrado_em is not null), 2,
  'realizada: todas as conversas de lead da família passam a humano_comercial');

-- "resolver" a transferência não devolve a Isadora; só "Devolver à Isadora"
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000001', 'aal1');
select is((api.resolver_transferencia((select (r ->> 'handoff_id')::uuid from t_r where chave = 'realizada'), 'formulario_enviado') ->> 'ok')::boolean, true,
  'o comercial resolve a transferência reuniao_realizada');
select testes.encerrar();
select is(agente.pode_responder(testes.p25b_conv(5)) ->> 'modo', 'humano_comercial', 'resolver a transferência não devolve a conversa à Isadora');
select is(agente.pode_enviar(testes.p25b_conv(5), 'conteudo') ->> 'pode', 'false', 'depois de resolver, nenhuma mensagem proativa da Isadora sai');
-- mensagem da família depois da reunião: abre uma nova reuniao_realizada (nó 21), sem pausa nova
insert into t_r select 'depois', agente.registrar_handoff(testes.p25b_conv(5), 'reuniao_realizada', 'A família escreveu depois da reunião', 'Posso pagar no Pix?', '{"_fluxo3":{"acrescentar_ao_aberto":true}}', 'sistema', 'Posso pagar no Pix?');
select results_eq(
  $$ select (r ->> 'humano_comercial')::boolean, r -> 'pausa_horas' from t_r where chave = 'depois' $$,
  $$ values (true, 'null'::jsonb) $$, 'mensagem depois da reunião realizada: humano_comercial, sem pausa nova');
select ok((select r ->> 'mensagem_grupo' like '%REUNIÃO REALIZADA%' from t_r where chave = 'depois'), 'o aviso usa o modelo de reunião realizada');
select ok((select (r ->> 'handoff_id') is not null and (r ->> 'acrescentado') is distinct from 'true' from t_r where chave = 'depois'),
  'humano_comercial sem transferência aberta: a mensagem abre uma reuniao_realizada nova');
insert into t_r select 'depois2', agente.registrar_handoff(testes.p25b_conv(5), 'reuniao_realizada', '', 'E no cartão?', '{"_fluxo3":{"acrescentar_ao_aberto":true}}', 'sistema', 'E no cartão?');
select ok((select (r ->> 'acrescentado')::boolean and r ->> 'mensagem_grupo' is null and (r ->> 'handoff_id') = (select r2 ->> 'handoff_id' from t_r t2, lateral (select t2.r as r2) x where t2.chave = 'depois')
           from t_r where chave = 'depois2'),
  'humano_comercial com transferência aberta: acrescenta o texto, sem novo aviso');
-- devolução pela equipe: a Isadora volta, mas a cadência antes da reunião não roda depois de realizada
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000001', 'aal1');
select is((api.retomar_agente(testes.p25b_conv(5)) ->> 'estava_em'), 'humano_comercial', 'Devolver à Isadora reabre a conversa');
select testes.encerrar();
update conversa set ultima_entrada_em = now() - interval '5 days', ultima_saida_em = now() - interval '5 days' + interval '1 minute' where familia_id = testes.p25b_fam(5);
select is(privado.agendar_followup_d1() >= 0, true, 'o motor roda');
select is((select count(*)::integer from automacao_execucao where familia_id = testes.p25b_fam(5) and status = 'agendada'), 0,
  'depois da reunião realizada a cadência não roda, mesmo com a conversa devolvida à Isadora');

-- não compareceu: a Isadora remarca; a da equipe segue com a tarefa humana
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000002', 'aal2');
insert into t_r select 'faltou_i', api.registrar_desfecho_sessao_venda('b2800000-0000-4000-8000-000000000006', 'nao_compareceu');
insert into t_r select 'faltou_h', api.registrar_desfecho_sessao_venda('b2800000-0000-4000-8000-000000000007', 'nao_compareceu');
select testes.encerrar();
select is((select estagio_p1::text from oportunidade where familia_id = testes.p25b_fam(6)), 'qualificado', 'não compareceu: P1 volta a qualificado');
select is((select count(*)::integer from tarefa where familia_id = testes.p25b_fam(6) and tipo in ('agendar_sessao', 'followup_comercial')), 0,
  'falta em reunião da Isadora: nenhuma tarefa humana de remarcação');
select ok((select r ->> 'remarcacao_da_isadora' = 'true' from t_r where chave = 'faltou_i'), 'falta em reunião da Isadora: libera a remarcação dela');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'reuniao_falta_remarcar' and familia_id = testes.p25b_fam(6) and status = 'agendada'), 1,
  'nasce a execução reuniao_falta_remarcar');
select ok((select agendada_para > now() + interval '110 minutes' from automacao_execucao where automacao_id = 'reuniao_falta_remarcar' and familia_id = testes.p25b_fam(6)),
  'a remarcação espera agenda_remarcar_apos_falta_horas');
select is((select count(*)::integer from tarefa where familia_id = testes.p25b_fam(7) and payload ->> 'mensagemChave' = 'nao_compareceu'), 1,
  'falta em reunião da equipe: segue a tarefa nao_compareceu do P29');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'reuniao_falta_remarcar' and familia_id = testes.p25b_fam(7)), 0,
  'falta em reunião da equipe: a Isadora não escreve');
-- a espera passou: proativos devolve a mensagem de remarcação
update automacao_execucao set agendada_para = now() - interval '1 minute' where automacao_id = 'reuniao_falta_remarcar' and familia_id = testes.p25b_fam(6);
insert into t_r select 'proativos_falta', agente.proativos_agenda_devidos();
select ok((select exists (select 1 from jsonb_array_elements(r -> 'itens') i where i ->> 'tipo' = 'falta' and i ->> 'conversa_id' = testes.p25b_conv(6)::text
                          and i ->> 'texto_base' like '%Quer que eu veja um novo horário com a Edilaine?')
           from t_r where chave = 'proativos_falta'), 'proativos_agenda_devidos: remarcação depois da falta, sem constranger');
select is(agente.registrar_followup((select (i ->> 'execucao_id')::uuid from t_r, jsonb_array_elements(r -> 'itens') i
                                     where chave = 'proativos_falta' and i ->> 'tipo' = 'falta' and i ->> 'conversa_id' = testes.p25b_conv(6)::text),
  'Imagino que tenha surgido algum imprevisto, acontece. Quer que eu veja um novo horário com a Edilaine?', true) ->> 'status', 'executada',
  'registrar_followup fecha a remarcação depois da falta');

-- desfecho pendente e consulta de horário vencida (motor)
insert into sessao_venda (id, familia_id, agendada_para, conduzida_por, link_reuniao, status)
values ('b2800000-0000-4000-8000-000000000008', testes.p25b_fam(8), now() - interval '2 days', 'a2800000-0000-4000-8000-000000000002', 'https://meet.exemplo.invalid/pendente', 'agendada');
select is(privado.materializar_desfecho_sessao_pendente() >= 1, true, 'desfecho_sessao_pendente: nasce a tarefa da Edilaine');
select is(privado.materializar_desfecho_sessao_pendente(), 0, 'desfecho_sessao_pendente: uma tarefa por sessão');
select ok(exists (select 1 from tarefa where tipo = 'registrar_desfecho_sessao' and payload ->> 'sessao_venda_id' = 'b2800000-0000-4000-8000-000000000008'
                  and responsavel_id = 'a2800000-0000-4000-8000-000000000002'), 'a tarefa é de quem conduz');
update consulta_equipe set expira_em = now() - interval '1 minute' where id = (select (r ->> 'consulta_id')::uuid from t_r where chave = 'consulta_horario');
select is(privado.materializar_consultas_expiradas(), 1, 'consulta de horário sem abertura no prazo: sobe para a Edilaine');
select is((select status::text from consulta_equipe where id = (select (r ->> 'consulta_id')::uuid from t_r where chave = 'consulta_horario')), 'expirada', 'a consulta vencida fica expirada');


-- -----------------------------------------------------------------------------
-- 6. Cadência de 1, 3 e 14 dias
-- -----------------------------------------------------------------------------

-- G: 25 horas sem resposta, PDF enviado: etapa 1
update conversa set ultima_entrada_em = now() - interval '25 hours', ultima_saida_em = now() - interval '24 hours' where id = testes.p25b_conv(9);
update familia set estado_sensivel = 'normal' where id = testes.p25b_fam(9);
insert into mensagem (conversa_id, direcao, enviado_por, conteudo) values
  (testes.p25b_conv(9), 'entrada', 'cliente', 'Oi'), (testes.p25b_conv(9), 'entrada', 'cliente', 'Tenho 30 semanas');
select is(privado.agendar_followup_d1() >= 1, true, 'a cadência agenda o primeiro retorno depois de 1 dia');
select results_eq(
  $$ select automacao_id, (payload ->> 'etapa')::integer from automacao_execucao where familia_id = testes.p25b_fam(9) and status = 'agendada' $$,
  $$ values ('followup_d1', 1) $$, 'etapa 1 em followup_d1');
insert into t_r select 'fu1', agente.followups_devidos();
select results_eq(
  $$ select i ->> 'etapa', i ->> 'motivo', i ->> 'texto_base' from jsonb_array_elements((select r -> 'itens' from t_r where chave = 'fu1')) i
     where i ->> 'conversa_id' = testes.p25b_conv(9)::text $$,
  $$ values ('1', 'esclarecer_apresentacao', 'Oi, ' || (select split_part(nome, ' ', 1) from pessoa where id = 'd2800000-0000-4000-8000-000000000009')
             || ' 😊 Conseguiu ver a apresentação com calma? Se ficou alguma dúvida sobre os formatos, me conta.') $$,
  'etapa 1: motivo é a apresentação');
select is(agente.registrar_followup((select (i ->> 'execucao_id')::uuid from jsonb_array_elements((select r -> 'itens' from t_r where chave = 'fu1')) i
                                     where i ->> 'conversa_id' = testes.p25b_conv(9)::text), 'Oi! Conseguiu ver a apresentação?', true) ->> 'status', 'executada',
  'registrar_followup fecha a etapa 1');
select is((select cadencia_etapa from oportunidade where familia_id = testes.p25b_fam(9)), 1, 'cadencia_etapa = 1');

-- três dias sem resposta: etapa 2 (motivo novo: a reunião de 30 minutos)
update conversa set ultima_entrada_em = now() - interval '73 hours', ultima_saida_em = now() - interval '1 hour' where id = testes.p25b_conv(9);
update automacao_execucao set payload = payload || jsonb_build_object('ultima_entrada_em', (select ultima_entrada_em from conversa where id = testes.p25b_conv(9)))
 where automacao_id = 'followup_d1' and familia_id = testes.p25b_fam(9);
update automacao_execucao set executada_em = now() - interval '2 days' where automacao_id = 'followup_d1' and familia_id = testes.p25b_fam(9);
insert into t_r select 'passo' || 5, to_jsonb(privado.agendar_followup_d1());
select results_eq(
  $$ select automacao_id, (payload ->> 'etapa')::integer from automacao_execucao where familia_id = testes.p25b_fam(9) and status = 'agendada' $$,
  $$ values ('followup_d3_d14', 2) $$, 'etapa 2 em followup_d3_d14 aos 3 dias');
insert into t_r select 'fu2', agente.followups_devidos();
select results_eq(
  $$ select i ->> 'etapa', i ->> 'motivo', i ->> 'texto_base' like '%reunião online de 30 minutos%' from jsonb_array_elements((select r -> 'itens' from t_r where chave = 'fu2')) i
     where i ->> 'conversa_id' = testes.p25b_conv(9)::text $$,
  $$ values ('2', 'oferecer_reuniao', true) $$, 'etapa 2: motivo é a reunião de 30 minutos');
insert into t_r select 'passo' || 6, agente.registrar_followup((select (i ->> 'execucao_id')::uuid from jsonb_array_elements((select r -> 'itens' from t_r where chave = 'fu2')) i
                                  where i ->> 'conversa_id' = testes.p25b_conv(9)::text), 'Oi! A Edilaine faz uma reunião online de 30 minutos.', true);
update automacao_execucao set executada_em = now() - interval '11 days' where familia_id = testes.p25b_fam(9) and status = 'executada';

-- 14 dias: etapa 3 (respeitar o tempo)
update conversa set ultima_entrada_em = now() - interval '15 days', ultima_saida_em = now() - interval '1 day' where id = testes.p25b_conv(9);
update automacao_execucao set payload = payload || jsonb_build_object('ultima_entrada_em', (select ultima_entrada_em from conversa where id = testes.p25b_conv(9)))
 where automacao_id in ('followup_d1', 'followup_d3_d14') and familia_id = testes.p25b_fam(9);
insert into t_r select 'passo' || 7, to_jsonb(privado.agendar_followup_d1());
insert into t_r select 'fu3', agente.followups_devidos();
select results_eq(
  $$ select i ->> 'etapa', i ->> 'motivo', i ->> 'texto_base' like '%Quero respeitar o tempo de vocês%' from jsonb_array_elements((select r -> 'itens' from t_r where chave = 'fu3')) i
     where i ->> 'conversa_id' = testes.p25b_conv(9)::text $$,
  $$ values ('3', 'respeitar_o_tempo', true) $$, 'etapa 3: motivo é respeitar o tempo da família');
insert into t_r select 'passo' || 8, agente.registrar_followup((select (i ->> 'execucao_id')::uuid from jsonb_array_elements((select r -> 'itens' from t_r where chave = 'fu3')) i
                                  where i ->> 'conversa_id' = testes.p25b_conv(9)::text), 'Oi! Quero respeitar o tempo de vocês.', true);
select is((select cadencia_etapa from oportunidade where familia_id = testes.p25b_fam(9)), 3, 'cadencia_etapa = 3 depois do terceiro retorno');
select is(privado.agendar_followup_d1() >= 0 and (select count(*)::integer from automacao_execucao where familia_id = testes.p25b_fam(9) and status = 'agendada') = 0, true,
  'depois da etapa 3 nada mais é agendado');

-- quem nunca respondeu à abertura: no máximo dois contatos
update conversa set ultima_entrada_em = now() - interval '20 days', ultima_saida_em = now() - interval '19 days' where id = testes.p25b_conv(8);
insert into mensagem (conversa_id, direcao, enviado_por, conteudo) values (testes.p25b_conv(8), 'entrada', 'cliente', 'Olá! Quero informações.');
insert into automacao_execucao (automacao_id, familia_id, agendada_para, executada_em, status, payload) values
  ('followup_d1', testes.p25b_fam(8), now() - interval '18 days', now() - interval '18 days', 'executada',
   jsonb_build_object('conversa_id', testes.p25b_conv(8), 'ultima_entrada_em', (select ultima_entrada_em from conversa where id = testes.p25b_conv(8)), 'etapa', 1)),
  ('followup_d3_d14', testes.p25b_fam(8), now() - interval '15 days', now() - interval '15 days', 'executada',
   jsonb_build_object('conversa_id', testes.p25b_conv(8), 'ultima_entrada_em', (select ultima_entrada_em from conversa where id = testes.p25b_conv(8)), 'etapa', 2));
update sessao_venda set status = 'nao_compareceu' where id = 'b2800000-0000-4000-8000-000000000008';
insert into t_r select 'passo' || 9, to_jsonb(privado.agendar_followup_d1());
select is((select count(*)::integer from automacao_execucao where familia_id = testes.p25b_fam(8) and status = 'agendada'), 0,
  'quem nunca respondeu à abertura recebe no máximo 2 contatos');

-- reunião agendada: nenhum follow-up
update conversa set ultima_entrada_em = now() - interval '30 hours', ultima_saida_em = now() - interval '29 hours' where id = testes.p25b_conv(1);
insert into automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
values ('followup_d1', testes.p25b_fam(1), now(), 'agendada', jsonb_build_object('conversa_id', testes.p25b_conv(1), 'ultima_entrada_em', (select ultima_entrada_em from conversa where id = testes.p25b_conv(1)), 'etapa', 1));
insert into t_r select 'passo' || 10, to_jsonb(privado.agendar_followup_d1());
select is((select count(*)::integer from automacao_execucao where familia_id = testes.p25b_fam(1) and status = 'agendada' and automacao_id like 'followup%'), 1,
  'o motor não agenda cadência para quem tem reunião marcada (só a execução inserida à mão)');
insert into t_r select 'fu_a', agente.followups_devidos();
select is((select count(*)::integer from jsonb_array_elements((select r -> 'itens' from t_r where chave = 'fu_a')) i where i ->> 'conversa_id' = testes.p25b_conv(1)::text), 0,
  'followups_devidos não devolve conversa com reunião agendada');
select results_eq(
  $$ select status::text, motivo_aborto from automacao_execucao where familia_id = testes.p25b_fam(1) and automacao_id = 'followup_d1' $$,
  $$ values ('cancelada', 'reuniao_agendada_ou_realizada') $$, 'a execução é cancelada com o motivo da reunião');

-- opções oferecidas ontem e sem escolha: a etapa 1 retoma com opções atualizadas (fluxo 4)
update conversa set ultima_entrada_em = now() - interval '30 hours', ultima_saida_em = now() - interval '29 hours' where id = testes.p25b_conv(4);
insert into sessao_venda_opcao (conversa_id, inicio, fim, consultada_em, valida_ate)
values (testes.p25b_conv(4), now() + interval '3 days', now() + interval '3 days 30 minutes', now() - interval '30 hours', now() - interval '6 hours');
insert into automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
values ('followup_d1', testes.p25b_fam(4), now(), 'agendada',
        jsonb_build_object('conversa_id', testes.p25b_conv(4), 'ultima_entrada_em', (select ultima_entrada_em from conversa where id = testes.p25b_conv(4)), 'etapa', 1));
insert into t_r select 'fu_venceu', agente.followups_devidos();
select results_eq(
  $$ select i ->> 'etapa', i ->> 'motivo', (i ->> 'precisa_agenda')::boolean, i ->> 'texto_base' like '%{opcao_1}%{opcao_2}%'
     from jsonb_array_elements((select r -> 'itens' from t_r where chave = 'fu_venceu')) i
     where i ->> 'conversa_id' = testes.p25b_conv(4)::text $$,
  $$ values ('1', 'opcoes_vencidas', true, true) $$,
  'opções vencidas sem escolha: o retorno da etapa 1 é opcoes_vencidas e pede a agenda (opcao_1 e opcao_2 ficam para o fluxo 4)');

-- -----------------------------------------------------------------------------
-- 7. Lembrete da véspera: freio, não contatar, pausa e janela
-- -----------------------------------------------------------------------------

-- A tem reunião daqui a 7 dias; o lembrete está agendado para a véspera. Adianta para agora.
update automacao_execucao set agendada_para = now() - interval '1 minute' where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1) and status = 'agendada';
-- pausa: espera (fica agendado)
update conversa set agente_pausado_ate = now() + interval '1 hour', agente_pausa_motivo = 'handoff:outro' where id = testes.p25b_conv(1);
select ok((select not exists (select 1 from jsonb_array_elements(agente.proativos_agenda_devidos() -> 'itens') i where i ->> 'tipo' = 'lembrete')),
  'lembrete: conversa pausada espera a pausa acabar');
select is((select status::text from automacao_execucao where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1) and status <> 'cancelada'), 'agendada',
  'lembrete: a execução continua agendada durante a pausa');
update conversa set agente_pausado_ate = null, agente_pausa_motivo = null where id = testes.p25b_conv(1);
-- janela fechada: espera
update parametro set valor = jsonb_build_object('inicio', to_char((now() at time zone 'America/Sao_Paulo') + interval '2 hours', 'HH24:MI'),
                                                'fim', to_char((now() at time zone 'America/Sao_Paulo') + interval '3 hours', 'HH24:MI'))
 where chave = 'agente_janela_envio';
select ok((select not exists (select 1 from jsonb_array_elements(agente.proativos_agenda_devidos() -> 'itens') i where i ->> 'tipo' = 'lembrete')),
  'lembrete: fora da janela de envio espera');
update parametro set valor = '{"inicio":"00:00","fim":"23:59"}' where chave = 'agente_janela_envio';
-- dentro da janela: sai, com o link do Meet e a hora
insert into t_r select 'lembrete', agente.proativos_agenda_devidos();
select ok((select exists (select 1 from jsonb_array_elements(r -> 'itens') i
                          where i ->> 'tipo' = 'lembrete' and i ->> 'conversa_id' = testes.p25b_conv(1)::text
                            and i ->> 'link' = 'https://meet.google.com/aaa-bbbb-ccc'
                            and i ->> 'texto_base' like '%é a sua reunião com a Edilaine%' and i ->> 'texto_base' like '%https://meet.google.com/aaa-bbbb-ccc%'
                            and i ->> 'hora' = privado.agenda_hora(testes.p25b_em(7, 9)))
           from t_r where chave = 'lembrete'), 'lembrete: dentro da janela sai, com a hora e o link do Meet');
select ok((select not exists (select 1 from jsonb_array_elements(r -> 'itens') i where i::text like '%evtagendaum1%') from t_r where chave = 'lembrete'),
  'o item do lembrete nunca leva o id do evento (o fluxo 4 o lê de reuniao_da_conversa)');
select is(agente.registrar_lembrete((select id from sessao_venda where familia_id = testes.p25b_fam(1) and status = 'agendada'), true,
  'Oi! Amanhã, às 9h, é a sua reunião com a Edilaine.') ->> 'status', 'executada', 'registrar_lembrete: saiu');
select ok((select lembrete_enviado_em is not null from sessao_venda where familia_id = testes.p25b_fam(1) and status = 'agendada'), 'o lembrete enviado fica na sessão');
select is((select count(*)::integer from mensagem where conversa_id = testes.p25b_conv(1) and conteudo like 'Oi! Amanhã, às 9h%'), 1, 'o lembrete fica na conversa como fala da Isadora');
select ok((select not exists (select 1 from jsonb_array_elements(agente.proativos_agenda_devidos() -> 'itens') i where i ->> 'tipo' = 'lembrete')),
  'o lembrete sai uma vez só');

-- freio e não contatar: cancela
update sessao_venda set agendada_para = testes.p25b_em(8, 9) where familia_id = testes.p25b_fam(1) and status = 'agendada';
update automacao_execucao set status = 'agendada', payload = payload - 'reservada_em', agendada_para = now() - interval '1 minute'
 where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1) and status = 'executada';
update sessao_venda set lembrete_enviado_em = null where familia_id = testes.p25b_fam(1) and status = 'agendada';
update familia set nao_contatar = true where id = testes.p25b_fam(1);
select ok((select not exists (select 1 from jsonb_array_elements(agente.proativos_agenda_devidos() -> 'itens') i where i ->> 'tipo' = 'lembrete')),
  'lembrete: família em não contatar não recebe');
select ok(exists (select 1 from automacao_execucao where automacao_id = 'lembrete_sessao' and familia_id = testes.p25b_fam(1) and status = 'cancelada' and motivo_aborto = 'nao_contatar'),
  'lembrete: cancelado com o motivo não contatar');


-- -----------------------------------------------------------------------------
-- 8. Privilégios e o que o n8n_agente enxerga
-- -----------------------------------------------------------------------------

set local role n8n_agente;
select throws_ok('select count(*) from public.sessao_venda_opcao', '42501', null, 'n8n_agente não lê sessao_venda_opcao');
select throws_ok('select count(*) from public.consulta_equipe', '42501', null, 'n8n_agente não lê consulta_equipe');
select throws_ok('select evento_calendar_id from public.sessao_venda', '42501', null, 'n8n_agente não lê sessao_venda nem o id do evento fora das funções');
select lives_ok($s$ select agente.reuniao_da_conversa('f2800000-0000-4000-8000-000000000001') $s$, 'n8n_agente lê a reunião pela função');
select throws_ok($s$ select api.consultas_equipe() $s$, '42501', null, 'n8n_agente não chama as funções de api');
reset role;
select testes.autenticar_authenticated('a2800000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select agente.parametros_agenda() $s$, '42501', null, 'o app não chama as funções do schema agente');
select testes.encerrar();
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'agente' and p.proname in ('parametros_agenda', 'registrar_opcoes_horario', 'validar_opcao_horario',
              'registrar_conferencia_horario', 'reuniao_da_conversa', 'registrar_reuniao', 'registrar_remarcacao', 'registrar_cancelamento',
              'registrar_consulta_equipe', 'proativos_agenda_devidos', 'registrar_lembrete', 'fechar_consulta', 'sessoes_para_sincronizar',
              'sincronizar_reuniao') and p.prosecdef and p.proconfig @> array['search_path=""']), 14,
  'as 14 funções de agenda são security definer com search_path vazio');
select ok(exists (select 1 from log_auditoria where entidade = 'consulta_equipe' and acao = 'insert')
          and not exists (select 1 from log_auditoria where entidade = 'consulta_equipe' and valor_depois::text like '%Santo André, Centro%'),
  'o log de consulta_equipe guarda a mudança sem o texto da pergunta em claro');

select * from finish();

rollback;
