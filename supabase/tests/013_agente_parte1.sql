-- =============================================================================
-- supabase/tests/013_agente_parte1.sql
--
-- Aceite do P21 (PROMPTS.md v2), fronteira do agente, parte 1:
--   1. Papel n8n_agente e privilégios exatamente como o PRD 11.10: não lê
--      nenhuma tabela de public, privado ou assistencial, não executa função
--      fora do Apêndice A, lê e grava só as duas tabelas de agente_n8n.
--   2. Não baixa freio (nem direto, nem por nenhuma função do agente).
--   3. Nenhuma função devolve campo assistencial (código e resultado).
--   4. Cada função da parte 1 com as conversas do seed: registrar_mensagem
--      (troca de jid @s.whatsapp.net para @lid com o mesmo LID, máscara,
--      deduplicação, nome salvo, equipe e plantão), registrar_transcricao,
--      pode_responder (os modos do 11.7), pode_enviar (resposta depois de
--      transferência com reuniao passa, às 22h passa, segundo follow-up de
--      conteúdo no mesmo dia é recusado), mensagem_sistema,
--      sincronizar_memoria (ida e volta no formato LangChain), pausar,
--      contexto_conversa, checar_termos_alerta, mensagem_alerta
--      (alerta_emocional com o parâmetro desligado devolve alerta_saude),
--      ficha_para_agente, planos_vigentes, verificar_cobertura,
--      verificar_disponibilidade, atualizar_lead (inclusive regra 12) e
--      registrar_marco.
--
-- Só dado sintético, criado aqui e desfeito no rollback. "Às 22h" é
-- simulado com uma janela de envio que não contém a hora atual (o relógio
-- do banco não é trocado no teste).
-- =============================================================================

begin;

select plan(202);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

update parametro set valor = '"producao"' where chave = 'agente_modo';
update parametro set valor = pg_catalog.jsonb_build_object(
    'inicio', to_char((now() at time zone 'America/Sao_Paulo') - interval '1 hour', 'HH24:MI'),
    'fim', to_char((now() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI'))
  where chave = 'agente_janela_envio';

create temp table t_id (chave text primary key, id uuid) on commit drop;
grant all on t_id to public;

insert into t_id (chave, id)
select 'conv_' || case c.telefone_e164
                    when '+5511900000301' then 'vendas'
                    when '+5511900000302' then 'humano_nominal'
                    when '+5511900000303' then 'pausado'
                    when '+5511900000310' then 'humano_comercial'
                    when '+5511900000312' then 'cliente'
                    when '+5511900000501' then 'nao_lead'
                    when '+5511900000050' then 'silencio'
                  end, c.id
from conversa c
where c.telefone_e164 in ('+5511900000301', '+5511900000302', '+5511900000303', '+5511900000310',
                          '+5511900000312', '+5511900000501', '+5511900000050');
insert into t_id select 'fam_jade', f.id from familia f where f.nome_exibicao = 'Família Teste Jade';


-- =============================================================================
-- 1. Papel n8n_agente e privilégios (PRD 11.10)
-- =============================================================================

select ok(exists (select 1 from pg_roles where rolname = 'n8n_agente'), 'papel n8n_agente existe');
select ok(
  (select rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit and not rolcreaterole and not rolcreatedb
   from pg_roles where rolname = 'n8n_agente'),
  'n8n_agente: login, sem superuser, sem bypassrls, noinherit, sem createrole nem createdb');
select ok(
  exists (select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
          where r.rolname = 'n8n_agente' and 'search_path=agente_n8n, extensions' = any (s.setconfig)),
  'n8n_agente: search_path = agente_n8n, extensions');

select is_empty(
  $$ select n.nspname || '.' || c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'api', 'auth', 'vault', 'net')
       and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
       and case when c.relkind = 'S' then has_sequence_privilege('n8n_agente', c.oid, 'usage, select, update')
                else has_table_privilege('n8n_agente', c.oid, 'select, insert, update, delete, truncate, references, trigger') end $$,
  'n8n_agente não tem privilégio em nenhuma tabela, view ou sequência de public, privado, assistencial, agente, api, auth, vault e net (cron: sem usage no schema, abaixo)');

select ok(
  has_table_privilege('n8n_agente', 'agente_n8n.documentos', 'select')
  and has_table_privilege('n8n_agente', 'agente_n8n.documentos', 'insert')
  and has_table_privilege('n8n_agente', 'agente_n8n.documentos', 'delete')
  and has_table_privilege('n8n_agente', 'agente_n8n.chat_memoria', 'select')
  and has_table_privilege('n8n_agente', 'agente_n8n.chat_memoria', 'insert')
  and has_table_privilege('n8n_agente', 'agente_n8n.chat_memoria', 'delete')
  and has_sequence_privilege('n8n_agente', 'agente_n8n.chat_memoria_id_seq', 'usage'),
  'n8n_agente: select, insert e delete nas duas tabelas de agente_n8n e usage na sequência');
select ok(
  not has_table_privilege('n8n_agente', 'agente_n8n.documentos', 'update')
  and not has_table_privilege('n8n_agente', 'agente_n8n.chat_memoria', 'update')
  and not has_table_privilege('n8n_agente', 'agente_n8n.chat_memoria', 'truncate'),
  'n8n_agente: sem update nem truncate em agente_n8n (11.10: select, insert, delete)');
select ok(
  has_schema_privilege('n8n_agente', 'extensions', 'usage')
  and has_schema_privilege('n8n_agente', 'agente', 'usage')
  and has_schema_privilege('n8n_agente', 'agente_n8n', 'usage')
  and has_schema_privilege('n8n_agente', 'agente_n8n', 'create'),
  'n8n_agente: usage em extensions e agente; usage e create em agente_n8n');
select ok(
  not has_schema_privilege('n8n_agente', 'privado', 'usage')
  and not has_schema_privilege('n8n_agente', 'assistencial', 'usage')
  and not has_schema_privilege('n8n_agente', 'api', 'usage')
  and not has_schema_privilege('n8n_agente', 'agente', 'create')
  and not has_schema_privilege('n8n_agente', 'public', 'create')
  and not has_schema_privilege('n8n_agente', 'vault', 'usage')
  and not has_schema_privilege('n8n_agente', 'net', 'usage')
  and not has_schema_privilege('n8n_agente', 'cron', 'usage'),
  'n8n_agente: sem usage em privado, assistencial, api, vault, net e cron; sem create em agente e public');

select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'api')
       and has_function_privilege('n8n_agente', p.oid, 'execute') $$,
  $$ values ('registrar_mensagem'), ('registrar_transcricao'), ('pode_responder'), ('pode_enviar'),
            ('mensagem_sistema'), ('sincronizar_memoria'), ('pausar'), ('contexto_conversa'),
            ('checar_termos_alerta'), ('mensagem_alerta'), ('ficha_para_agente'), ('planos_vigentes'),
            ('verificar_cobertura'), ('verificar_disponibilidade'), ('atualizar_lead'), ('registrar_marco'),
            ('registrar_handoff'), ('registrar_notificacao_handoff'), ('marcar_nao_lead'), ('followups_devidos'),
            ('registrar_followup'), ('base_para_indexar'), ('promover_lote'), ('descartar_lote'),
            ('registrar_ingestao') $$,
  'n8n_agente executa exatamente as funções do Apêndice A');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'agente'
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'funções de agente: nem anon, nem authenticated, nem service_role executam');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'agente' and not (p.prosecdef and coalesce(p.proconfig, '{}') @> array['search_path=""']) $$,
  'toda função de agente é security definer com search_path vazio');

select set_eq(
  $$ select tablename::text || ':' || cmd || ':' || array_to_string(roles, ',') from pg_policies where schemaname = 'agente_n8n' $$,
  $$ values ('documentos:ALL:n8n_agente'), ('chat_memoria:ALL:n8n_agente') $$,
  'agente_n8n: uma política "for all to n8n_agente" em cada tabela');

-- --- Na prática, como n8n_agente ------------------------------------------------
set local role n8n_agente;
select throws_ok('select count(*) from public.familia', '42501', null, 'n8n_agente não lê public.familia');
select throws_ok('select count(*) from public.conversa', '42501', null, 'n8n_agente não lê public.conversa');
select throws_ok('select count(*) from public.registro_atendimento', '42501', null, 'n8n_agente não lê public.registro_atendimento');
select throws_ok('select count(*) from public.parametro', '42501', null, 'n8n_agente não lê public.parametro');
select throws_ok('select count(*) from agente.base_conhecimento', '42501', null, 'n8n_agente não lê agente.base_conhecimento direto (só base_para_indexar)');
select throws_ok($$ update public.familia set estado_sensivel = 'normal' $$, '42501', null, 'n8n_agente não baixa o freio direto');
select throws_ok($$ select privado.reverter_freio(gen_random_uuid(), 'normal', 'x') $$, '42501', null, 'n8n_agente não chama privado.reverter_freio');
select throws_ok($$ select privado.pode_enviar_mensagem(gen_random_uuid(), 'conteudo') $$, '42501', null, 'n8n_agente não chama função de privado');
select throws_ok($$ select * from assistencial.ler_acompanhamento(gen_random_uuid()) $$, '42501', null, 'n8n_agente não chama função de assistencial');
select throws_ok($$ select api.transicionar('p1', gen_random_uuid(), 'qualificado') $$, '42501', null, 'n8n_agente não chama função de api');
select lives_ok(
  $$ insert into agente_n8n.chat_memoria (session_id, message) values ('teste-p21', '{"type":"human","content":"oi"}') $$,
  'n8n_agente grava em agente_n8n.chat_memoria (política for all)');
select is((select count(*)::integer from agente_n8n.chat_memoria where session_id = 'teste-p21'), 1,
  'n8n_agente lê agente_n8n.chat_memoria (política for all)');
select lives_ok($$ delete from agente_n8n.chat_memoria where session_id = 'teste-p21' $$, 'n8n_agente apaga de agente_n8n.chat_memoria');
select is((agente.planos_vigentes() ->> 'ok')::boolean, true, 'n8n_agente executa uma função do Apêndice A');
reset role;


-- =============================================================================
-- 2. Nenhuma função devolve campo assistencial (PRD 11.10, Apêndice A)
-- =============================================================================

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'agente'
       and p.prosrc ~* '\m(registro_atendimento|registro_adendo|alerta_clinico|consulta_prenatal|relatorio_medico|anexo_audio|regra_alerta)\M|public\.visita\M|\massistencial\.' $$,
  'nenhuma função do schema agente cita tabela ou função assistencial');
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'privado' and p.proname like 'agente\_%'
       and p.prosrc ~* '\m(registro_atendimento|registro_adendo|alerta_clinico|consulta_prenatal|relatorio_medico|anexo_audio|regra_alerta)\M|public\.visita\M|\massistencial\.' $$,
  'nenhuma auxiliar privado.agente_* cita tabela ou função assistencial');

-- família com registro assistencial e alerta clínico no seed (Jade): uma
-- conversa dela e tudo o que o agente consegue pedir sobre ela
insert into conversa (id, wa_jid, telefone_e164, familia_id, classificacao, iniciada_por, ultima_entrada_em, ultima_saida_em)
select 'e1300000-0000-4000-8000-000000000001', '5511900000313-teste@s.whatsapp.net', '+5511900000313', f.id, 'cliente',
       'cliente', now() - interval '1 hour', now() - interval '50 minutes'
from familia f where f.nome_exibicao = 'Família Teste Jade';
insert into t_id values ('conv_jade', 'e1300000-0000-4000-8000-000000000001');

create temp table t_saida_jade on commit drop as
select agente.ficha_para_agente('e1300000-0000-4000-8000-000000000001')::text
       || agente.pode_responder('e1300000-0000-4000-8000-000000000001')::text
       || agente.contexto_conversa('e1300000-0000-4000-8000-000000000001', 50)::text
       || agente.mensagem_alerta('e1300000-0000-4000-8000-000000000001', 'alerta_saude', 'alerta_saude')::text
       || agente.planos_vigentes()::text
       || agente.pode_enviar('e1300000-0000-4000-8000-000000000001', 'resposta', null)::text as saida;

select ok(
  (select saida from t_saida_jade) !~* '(resumo_descritivo|registro_atendimento|alerta_clinico|conduta|sinal_identificado|valor_observado|plano_cuidado|laserterapia|relatorio)',
  'o que o agente recebe sobre uma família em atendimento não tem nenhum campo assistencial');
select ok(
  not exists (select 1 from registro_atendimento r, t_saida_jade t where strpos(t.saida, r.resumo_descritivo) > 0)
  and not exists (select 1 from alerta_clinico a, t_saida_jade t where strpos(t.saida, a.valor_observado) > 0
                                                                      or strpos(t.saida, a.conduta) > 0),
  'nenhum texto do registro assistencial nem do alerta clínico da família aparece no que o agente recebe');


-- =============================================================================
-- 3. agente.registrar_mensagem (Apêndice A [v4.2])
-- =============================================================================

create temp table t_r on commit drop as
select agente.registrar_mensagem('5511900000901@s.whatsapp.net', 'entrada', 'cliente', 'Oi! Meu CPF é 111.444.777-35',
                                 'texto', 'P21-MSG-1', 'Joana Teste', '5511900000901', '900000901000001@lid', null) as r;
select is((select (r ->> 'ok')::boolean from t_r), true, 'registrar_mensagem: primeira mensagem de um contato novo');
insert into t_id select 'conv_nova', (r ->> 'conversa_id')::uuid from t_r;
select is((select (r ->> 'primeira_mensagem')::boolean from t_r), true, 'registrar_mensagem: primeira_mensagem verdadeira');
select is((select (r ->> 'agrupamento_segundos')::integer from t_r), 20,
  'registrar_mensagem: agrupamento_segundos vem de parametro.agente_debounce_segundos');
select results_eq(
  $$ select wa_jid, wa_lid, telefone_e164, iniciada_por::text, nome_whatsapp from conversa where id = (select id from t_id where chave = 'conv_nova') $$,
  $$ values ('5511900000901@s.whatsapp.net', '900000901000001@lid', '+5511900000901', 'cliente', 'Joana Teste') $$,
  'registrar_mensagem: conversa nova com jid, LID, E.164, quem iniciou e nome do WhatsApp');
select is((select conteudo from mensagem where wa_message_id = 'P21-MSG-1'), 'Oi! Meu CPF é [CPF ocultado]',
  'registrar_mensagem: CPF mascarado antes de gravar (11.11 item 6)');

-- a UAZAPI passa a mandar o mesmo contato com jid @lid e o mesmo LID
create temp table t_r2 on commit drop as
select agente.registrar_mensagem('900000901000001@lid', 'entrada', 'cliente', 'estou com 30 semanas',
                                 'texto', 'P21-MSG-2', 'Joana Teste', null, '900000901000001@lid', null) as r;
select is((select (r ->> 'conversa_id')::uuid from t_r2), (select id from t_id where chave = 'conv_nova'),
  'troca de jid: a mensagem com jid @lid e o mesmo LID cai na mesma conversa');
select is((select wa_jid from conversa where id = (select id from t_id where chave = 'conv_nova')), '900000901000001@lid',
  'troca de jid: wa_jid passa a ser o chatid mais recente');
select is((agente.pode_responder((select id from t_id where chave = 'conv_nova')) ->> 'ok')::boolean, true,
  'troca de jid: pode_responder(conversa_id) responde');
select is((agente.pode_responder((select id from t_id where chave = 'conv_nova')) ->> 'modo'), 'vendas',
  'troca de jid: contato novo em produção fica em modo vendas');

-- deduplicação pelo wa_message_id
select is((agente.registrar_mensagem('900000901000001@lid', 'entrada', 'cliente', 'estou com 30 semanas',
                                      'texto', 'P21-MSG-2', null, null, '900000901000001@lid', null) ->> 'duplicada')::boolean,
  true, 'registrar_mensagem: mesmo wa_message_id volta como duplicada');
select is((select count(*)::integer from mensagem where wa_message_id = 'P21-MSG-2'), 1,
  'registrar_mensagem: nenhuma mensagem duplicada gravada');

-- resolução pelo telefone quando não vem LID
select is((agente.registrar_mensagem('5511900000901-outro@s.whatsapp.net', 'entrada', 'cliente', 'oi de novo',
                                      'texto', 'P21-MSG-3', null, '+55 11 90000-0901', null, null) ->> 'conversa_id')::uuid,
  (select id from t_id where chave = 'conv_nova'),
  'registrar_mensagem: sem LID, resolve pelo telefone');

-- nome salvo "paciente fechada" e "paciente potencial" (PRD 11.5)
select is((agente.registrar_mensagem('5511900000902@s.whatsapp.net', 'entrada', 'cliente', 'oi', 'texto', 'P21-MSG-4',
                                      null, '5511900000902', null, 'Clara Teste paciente fechada') ->> 'classificacao'),
  'cliente', 'nome salvo "paciente fechada" marca a conversa como cliente');
select is((agente.registrar_mensagem('5511900000903@s.whatsapp.net', 'entrada', 'cliente', 'oi', 'texto', 'P21-MSG-5',
                                      null, '5511900000903', null, 'Rita Teste Paciente Potencial') ->> 'classificacao'),
  'lead', 'nome salvo "paciente potencial" marca a conversa como lead');

-- equipe e plantão
select is((agente.registrar_mensagem('5511900000050@s.whatsapp.net', 'entrada', 'cliente', 'ok', 'texto', 'P21-MSG-6',
                                      null, '5511900000050', null, null) ->> 'numero_equipe')::boolean,
  true, 'número de perfil ativo da equipe volta como numero_equipe');
select is((agente.registrar_mensagem('5511900000003@s.whatsapp.net', 'entrada', 'cliente', 'ok', 'texto', 'P21-MSG-7',
                                      null, '5511900000003', null, null) ->> 'numero_plantao')::boolean,
  true, 'número de parametro.plantao_telefones volta como numero_plantao');

-- família em bloqueio_total escrevendo por outro jid: cai na conversa dela
select is((agente.registrar_mensagem('5511900000302-novo@s.whatsapp.net', 'entrada', 'cliente', 'oi', 'texto', 'P21-MSG-8',
                                      null, '5511900000302', null, null) ->> 'conversa_id')::uuid,
  (select id from t_id where chave = 'conv_humano_nominal'),
  'família em bloqueio_total que escreve por outro jid cai na conversa dela (pelo telefone)');

-- conversa nova de telefone de uma pessoa já cadastrada é ligada à família
insert into pessoa (familia_id, papel, nome, telefone_e164)
select f.id, 'parceiro', 'Otávio Teste Aurora', '+5511900000904' from familia f where f.nome_exibicao = 'Família Teste Aurora';
insert into t_id
select 'conv_otavio', (agente.registrar_mensagem('5511900000904@s.whatsapp.net', 'entrada', 'cliente', 'oi',
                                                 'texto', 'P21-MSG-9', null, '5511900000904', null, null) ->> 'conversa_id')::uuid;
select is(
  (select familia_id from conversa where id = (select id from t_id where chave = 'conv_otavio')),
  (select id from familia where nome_exibicao = 'Família Teste Aurora'),
  'conversa nova de um telefone já cadastrado nasce ligada à família dessa pessoa');

-- saída digitada pela equipe no celular
select is((agente.registrar_mensagem('900000901000001@lid', 'saida', 'humano', 'Oi Joana, aqui é a equipe', 'texto', 'P21-MSG-10',
                                      null, null, '900000901000001@lid', null) ->> 'conversa_id')::uuid,
  (select id from t_id where chave = 'conv_nova'), 'mensagem da equipe digitada no celular cai na mesma conversa');

-- validações
select is((agente.registrar_mensagem('x@s.whatsapp.net', 'lateral', 'cliente', 'oi', 'texto', null, null, null, null, null) ->> 'ok')::boolean,
  false, 'registrar_mensagem: direção inválida volta ok falso, sem exceção');
select is((agente.registrar_mensagem('x@s.whatsapp.net', 'entrada', 'ia', 'oi', 'texto', null, null, null, null, null) ->> 'ok')::boolean,
  false, 'registrar_mensagem: entrada que não é da família volta ok falso');
select is((agente.registrar_mensagem(null, 'entrada', 'cliente', 'oi', 'texto', null, null, null, null, null) ->> 'ok')::boolean,
  false, 'registrar_mensagem: sem jid, LID nem telefone volta ok falso');


-- =============================================================================
-- 4. agente.registrar_transcricao
-- =============================================================================

select is((agente.registrar_transcricao('P21-MSG-3', 'meu cartão é 4111 1111 1111 1111') ->> 'ok')::boolean, true,
  'registrar_transcricao grava a transcrição');
select ok((select transcricao from mensagem where wa_message_id = 'P21-MSG-3') like '%[cartão ocultado]%',
  'registrar_transcricao mascara o cartão');
select is((select conteudo from mensagem where wa_message_id = 'P21-MSG-3'), 'oi de novo',
  'registrar_transcricao não muda nenhuma outra coluna');
select is((agente.registrar_transcricao('P21-NAO-EXISTE', 'x') ->> 'erro'), 'mensagem_nao_encontrada',
  'registrar_transcricao: wa_message_id desconhecido volta ok falso');


-- =============================================================================
-- 5. agente.pode_responder: os modos do 11.7 (conversas do seed)
-- =============================================================================

select results_eq(
  $$ select t.chave, agente.pode_responder(t.id) ->> 'modo'
     from t_id t
     where t.chave in ('conv_vendas', 'conv_cliente', 'conv_humano_nominal', 'conv_nao_lead', 'conv_pausado',
                       'conv_silencio', 'conv_humano_comercial')
     order by t.chave $$,
  $$ values ('conv_cliente', 'cliente'), ('conv_humano_comercial', 'humano_comercial'),
            ('conv_humano_nominal', 'humano_nominal'), ('conv_nao_lead', 'nao_lead'),
            ('conv_pausado', 'pausado'), ('conv_silencio', 'silencio'), ('conv_vendas', 'vendas') $$,
  'pode_responder: cada conversa do seed no seu modo (11.7)');
select is(agente.pode_responder((select id from t_id where chave = 'conv_humano_comercial')) ->> 'agente_encerrado_motivo',
  'contratar', 'pode_responder: humano_comercial devolve agente_encerrado_motivo');
select is((agente.pode_responder((select id from t_id where chave = 'conv_humano_comercial')) ->> 'humano_comercial')::boolean,
  true, 'pode_responder: humano_comercial verdadeiro');
select is(agente.pode_responder((select id from t_id where chave = 'conv_jade')) ->> 'modo', 'cliente',
  'pode_responder: família com atendimento concluído fica em cliente');
select ok(
  (select r ? 'alerta_internacao_ativo' and r ? 'alerta_emocional_ativo' and r ? 'alerta_saude_sensivel_ativo'
   from (select agente.pode_responder((select id from t_id where chave = 'conv_vendas')) as r) x),
  'pode_responder devolve os três parâmetros de ativação dos textos clínicos');
select is((agente.pode_responder(gen_random_uuid()) ->> 'ok')::boolean, false,
  'pode_responder: conversa desconhecida volta ok falso');

update parametro set valor = '"teste"' where chave = 'agente_modo';
select is(agente.pode_responder((select id from t_id where chave = 'conv_vendas')) ->> 'modo', 'teste',
  'modo teste: número fora da lista volta teste');
insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por)
values ('e1300000-0000-4000-8000-000000000002', '5511900000001-teste@s.whatsapp.net', '+5511900000001', 'nao_classificado', 'cliente');
select is(agente.pode_responder('e1300000-0000-4000-8000-000000000002') ->> 'modo', 'vendas',
  'modo teste: número da lista responde normalmente');
update parametro set valor = '"desligado"' where chave = 'agente_modo';
select is(agente.pode_responder((select id from t_id where chave = 'conv_vendas')) ->> 'modo', 'desligado',
  'agente_modo desligado: modo desligado');
update parametro set valor = '"producao"' where chave = 'agente_modo';


-- =============================================================================
-- 6. agente.pode_enviar (PRD 8.2 [v4.2])
-- =============================================================================

select is((agente.pode_enviar((select id from t_id where chave = 'conv_vendas'), 'resposta', null) ->> 'pode')::boolean, true,
  'pode_enviar resposta: conversa em vendas passa');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_humano_nominal'), 'resposta', null) ->> 'pode')::boolean, false,
  'pode_enviar resposta: família em bloqueio_total é bloqueada');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_humano_comercial'), 'resposta', null) ->> 'motivo'), 'humano_comercial',
  'pode_enviar resposta: humano_comercial de outra origem é bloqueado');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_pausado'), 'resposta', null) ->> 'motivo'), 'pausado',
  'pode_enviar resposta: pausa de outra origem é bloqueada');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_silencio'), 'resposta', null) ->> 'pode')::boolean, false,
  'pode_enviar resposta: número da equipe nunca recebe resposta');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_nova'), 'resposta', null) ->> 'pode')::boolean, true,
  'pode_enviar resposta: vale para conversa sem família');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_nova'), 'conteudo', null) ->> 'motivo'), 'familia_obrigatoria',
  'pode_enviar conteudo: exige família');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_vendas'), 'conversa', null) ->> 'ok')::boolean, false,
  'pode_enviar: tipo fora da lista (a categoria "conversa" da v4.1 não existe) volta ok falso');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_vendas'), 'conversa', null) ->> 'pode')::boolean, false,
  'pode_enviar: tipo inválido nunca libera');

-- resposta depois de transferência com reuniao (humano_comercial criado por
-- este handoff): passa
create temp table t_h on commit drop as
select agente.registrar_handoff((select id from t_id where chave = 'conv_vendas'), 'reuniao', 'quer a conversa com a Edilaine',
                                'quinta ou sexta às 10h', '{"opcoes":["quinta 10h","sexta 10h"]}', 'agente', 'pode ser quinta?') as r;
select is((select (r ->> 'humano_comercial')::boolean from t_h), true, 'transferência com reuniao põe a conversa em humano_comercial');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_vendas'), 'resposta', (select (r ->> 'handoff_id')::uuid from t_h)) ->> 'pode')::boolean,
  true, 'pode_enviar resposta depois de transferência com reuniao, com o handoff_id desta execução: passa');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_vendas'), 'resposta', null) ->> 'pode')::boolean,
  false, 'a mesma resposta sem o handoff_id desta execução: bloqueada (humano_comercial)');
select is(agente.pode_responder((select id from t_id where chave = 'conv_vendas')) ->> 'modo', 'humano_comercial',
  'a mensagem seguinte encontra humano_comercial');

-- às 22h: janela de envio que não contém a hora atual
update parametro set valor = pg_catalog.jsonb_build_object(
    'inicio', to_char((now() at time zone 'America/Sao_Paulo') + interval '2 hours', 'HH24:MI'),
    'fim', to_char((now() at time zone 'America/Sao_Paulo') + interval '3 hours', 'HH24:MI'))
  where chave = 'agente_janela_envio';
select is((agente.pode_enviar((select id from t_id where chave = 'conv_vendas'), 'resposta', (select (r ->> 'handoff_id')::uuid from t_h)) ->> 'pode')::boolean,
  true, 'pode_enviar resposta fora da janela (22h): passa (nunca aplica janela)');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_cliente'), 'resposta', null) ->> 'pode')::boolean,
  true, 'pode_enviar resposta fora da janela para cliente: passa');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_cliente'), 'operacional', null) ->> 'motivo'),
  'fora_da_janela', 'pode_enviar operacional fora da janela: recusado');
update parametro set valor = pg_catalog.jsonb_build_object(
    'inicio', to_char((now() at time zone 'America/Sao_Paulo') - interval '1 hour', 'HH24:MI'),
    'fim', to_char((now() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI'))
  where chave = 'agente_janela_envio';

-- nao_contatar não bloqueia resposta, bloqueia conteúdo
update familia set nao_contatar = true where nome_exibicao = 'Família Teste Íris';
select is((agente.pode_enviar((select id from t_id where chave = 'conv_cliente'), 'resposta', null) ->> 'pode')::boolean,
  true, 'pode_enviar resposta: nao_contatar não bloqueia (a família voltou a escrever)');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_cliente'), 'conteudo', null) ->> 'motivo'),
  'nao_contatar', 'pode_enviar conteudo: nao_contatar bloqueia');
update familia set nao_contatar = false where nome_exibicao = 'Família Teste Íris';

-- segundo follow-up de conteúdo no mesmo dia: recusado
insert into familia (id, nome_exibicao, dpp) values ('e1300000-0000-4000-8000-000000000101', 'Família Teste P21 Conteúdo', current_date + 90);
insert into conversa (id, wa_jid, telefone_e164, familia_id, classificacao, iniciada_por, ultima_entrada_em, ultima_saida_em)
values ('e1300000-0000-4000-8000-000000000003', '5511900000905-teste@s.whatsapp.net', '+5511900000905',
        'e1300000-0000-4000-8000-000000000101', 'lead', 'cliente', now() - interval '3 days', now() - interval '3 days' + interval '1 minute');
select is((agente.pode_enviar('e1300000-0000-4000-8000-000000000003', 'conteudo', null) ->> 'pode')::boolean, true,
  'primeiro follow-up de conteúdo do dia: passa');
insert into automacao_execucao (automacao_id, familia_id, agendada_para, executada_em, status, payload)
values ('followup_d1', 'e1300000-0000-4000-8000-000000000101', now(), now(), 'executada',
        '{"conversa_id":"e1300000-0000-4000-8000-000000000003"}');
select is(agente.pode_enviar('e1300000-0000-4000-8000-000000000003', 'conteudo', null) ->> 'motivo', 'conteudo_ja_enviado_hoje',
  'segundo follow-up de conteúdo no mesmo dia: recusado');
select is((agente.pode_enviar('e1300000-0000-4000-8000-000000000003', 'resposta', null) ->> 'pode')::boolean, true,
  'resposta depois do follow-up do dia: passa (o limite diário não vale para resposta)');


-- =============================================================================
-- 7. agente.mensagem_sistema
-- =============================================================================

select is((agente.mensagem_sistema((select id from t_id where chave = 'conv_vendas'), 'alerta_saude') ->> 'erro'), 'chave_nao_permitida',
  'mensagem_sistema não devolve texto de alerta (só mensagem_alerta)');
select is((agente.mensagem_sistema((select id from t_id where chave = 'conv_vendas'), 'grupo_saude') ->> 'erro'), 'chave_nao_permitida',
  'mensagem_sistema não devolve texto de grupo');
select is((agente.mensagem_sistema((select id from t_id where chave = 'conv_vendas'), 'midia_recebida') ->> 'erro'), 'texto_nao_aprovado',
  'mensagem_sistema: texto em rascunho não sai (6.8)');
select is(agente.mensagem_sistema((select id from t_id where chave = 'conv_vendas'), 'midia_recebida') -> 'texto', 'null'::jsonb,
  'mensagem_sistema: texto em rascunho volta nulo');
update mensagem_modelo set status = 'aprovado'
 where chave in ('midia_recebida', 'instrucao_sem_aviso', 'audio_nao_transcrito');
select is(agente.mensagem_sistema((select id from t_id where chave = 'conv_vendas'), 'midia_recebida') ->> 'texto',
  (select texto from mensagem_modelo where chave = 'midia_recebida'), 'mensagem_sistema: texto aprovado de midia_recebida');
select is(agente.mensagem_sistema((select id from t_id where chave = 'conv_vendas'), 'instrucao_sem_aviso') ->> 'destinatario', 'agente',
  'mensagem_sistema aceita instrucao_sem_aviso (fluxo 2, nó 11)');
select is((agente.mensagem_sistema((select id from t_id where chave = 'conv_vendas'), 'audio_nao_transcrito') ->> 'ok')::boolean, true,
  'mensagem_sistema aceita audio_nao_transcrito');
select is((agente.mensagem_sistema(gen_random_uuid(), 'midia_recebida') ->> 'erro'), 'conversa_nao_encontrada',
  'mensagem_sistema: conversa desconhecida volta ok falso');


-- =============================================================================
-- 8. agente.sincronizar_memoria: ida e volta no formato LangChain
-- =============================================================================

-- o nó Postgres Chat Memory grava a troca (human e ai) na sessão = conversa.id
set local role n8n_agente;
insert into agente_n8n.chat_memoria (session_id, message) values
  ('e1300000-0000-4000-8000-000000000003', '{"type":"human","content":"quanto custa?","additional_kwargs":{},"response_metadata":{}}'),
  ('e1300000-0000-4000-8000-000000000003', '{"type":"ai","content":"texto gerado pelo modelo","additional_kwargs":{},"response_metadata":{}}');
reset role;

select is((agente.sincronizar_memoria('e1300000-0000-4000-8000-000000000003', 'ia', 'texto que de fato saiu') ->> 'acao'), 'trocada',
  'sincronizar_memoria ia: troca a última fala da IA');
select is((select message ->> 'content' from agente_n8n.chat_memoria where session_id = 'e1300000-0000-4000-8000-000000000003' order by id desc limit 1),
  'texto que de fato saiu', 'a memória guarda o texto que de fato saiu');
select is((select count(*)::integer from agente_n8n.chat_memoria where session_id = 'e1300000-0000-4000-8000-000000000003'), 2,
  'trocar não cria linha nova');
select is((agente.sincronizar_memoria('e1300000-0000-4000-8000-000000000003', 'equipe', 'Oi, aqui é a Edilaine') ->> 'acao'), 'inserida',
  'sincronizar_memoria equipe: insere a fala da equipe');
select is((select message from agente_n8n.chat_memoria where session_id = 'e1300000-0000-4000-8000-000000000003' order by id desc limit 1),
  pg_catalog.jsonb_build_object('type', 'ai', 'content', (select texto from mensagem_modelo where chave = 'memoria_prefixo_equipe') || 'Oi, aqui é a Edilaine',
                                'additional_kwargs', '{}'::jsonb, 'response_metadata', '{}'::jsonb),
  'fala da equipe no formato do Apêndice A: type ai, prefixo, additional_kwargs e response_metadata');
select is((agente.sincronizar_memoria('e1300000-0000-4000-8000-000000000003', 'sistema', 'Família enviou uma foto') ->> 'ok')::boolean, true,
  'sincronizar_memoria sistema: insere');
select is((select message ->> 'type' from agente_n8n.chat_memoria where session_id = 'e1300000-0000-4000-8000-000000000003' order by id desc limit 1),
  'system', 'texto do sistema entra com type system');
select is((agente.sincronizar_memoria('e1300000-0000-4000-8000-000000000003', 'followup', 'Oi! Conseguiu ver a apresentação?') ->> 'acao'), 'inserida',
  'sincronizar_memoria followup: insere a fala do follow-up (extensão do P25)');

-- nova troca em que nada saiu para a família: a fala da IA é apagada
insert into mensagem (conversa_id, direcao, enviado_por, conteudo) values ('e1300000-0000-4000-8000-000000000003', 'entrada', 'cliente', 'estou sangrando');
insert into agente_n8n.chat_memoria (session_id, message) values
  ('e1300000-0000-4000-8000-000000000003', '{"type":"human","content":"estou sangrando","additional_kwargs":{},"response_metadata":{}}'),
  ('e1300000-0000-4000-8000-000000000003', '{"type":"ai","content":"texto que nunca saiu","additional_kwargs":{},"response_metadata":{}}');
select is((agente.sincronizar_memoria('e1300000-0000-4000-8000-000000000003', 'descartado', null) ->> 'acao'), 'apagada',
  'sincronizar_memoria descartado: apaga a última fala da IA da vez');
select is((select count(*)::integer from agente_n8n.chat_memoria
           where session_id = 'e1300000-0000-4000-8000-000000000003' and message ->> 'content' = 'texto que nunca saiu'), 0,
  'a Isadora nunca "lembra" do que a família não leu');
select is((agente.sincronizar_memoria('e1300000-0000-4000-8000-000000000003', 'descartado', null) ->> 'acao'), 'nada_a_apagar',
  'descartado sem fala da IA da vez: não apaga a fala de uma resposta anterior');
select is_empty(
  $$ select 1 from agente_n8n.chat_memoria
     where session_id = 'e1300000-0000-4000-8000-000000000003'
       and (message ->> 'type' not in ('human', 'ai', 'system')
            or not (message ? 'content' and message ? 'additional_kwargs' and message ? 'response_metadata')) $$,
  'ida e volta: toda linha da sessão está no formato que o nó relê (type human, ai ou system, com content, additional_kwargs e response_metadata)');
select is((agente.sincronizar_memoria('e1300000-0000-4000-8000-000000000003', 'humano', 'x') ->> 'ok')::boolean, false,
  'sincronizar_memoria: papel fora da lista volta ok falso');
select is((agente.sincronizar_memoria('e1300000-0000-4000-8000-000000000003', 'ia', null) ->> 'ok')::boolean, false,
  'sincronizar_memoria ia sem texto volta ok falso');


-- =============================================================================
-- 9. agente.pausar e agente.contexto_conversa
-- =============================================================================

select is((agente.pausar((select id from t_id where chave = 'conv_nova'), null, 'humano_digitou') ->> 'horas')::numeric, 48::numeric,
  'pausar com horas nulo usa parametro.agente_pausa_humano_horas');
select is(agente.pode_responder((select id from t_id where chave = 'conv_nova')) ->> 'modo', 'pausado',
  'depois de pausar, o modo é pausado');
select is((agente.pausar((select id from t_id where chave = 'conv_nova'), 1, 'curta') ->> 'pausado_ate')::timestamptz,
  (select agente_pausado_ate from conversa where id = (select id from t_id where chave = 'conv_nova')),
  'pausar nunca encurta uma pausa maior');
select ok((select agente_pausado_ate > now() + interval '47 hours' from conversa where id = (select id from t_id where chave = 'conv_nova')),
  'a pausa maior continua valendo');
select is((agente.pausar((select id from t_id where chave = 'conv_nova'), -1, 'x') ->> 'ok')::boolean, false,
  'pausar com horas negativas volta ok falso');

insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por)
values ('e1300000-0000-4000-8000-000000000004', '5511900000906-teste@s.whatsapp.net', '+5511900000906', 'lead', 'cliente');
insert into mensagem (conversa_id, direcao, enviado_por, conteudo, enviada_em) values
  ('e1300000-0000-4000-8000-000000000004', 'entrada', 'cliente', 'oi', now() - interval '10 minutes'),
  ('e1300000-0000-4000-8000-000000000004', 'saida', 'ia', 'Oi! Eu sou a Isadora', now() - interval '9 minutes'),
  ('e1300000-0000-4000-8000-000000000004', 'saida', 'humano', 'aqui é a equipe', now() - interval '8 minutes'),
  ('e1300000-0000-4000-8000-000000000004', 'entrada', 'cliente', 'quero contratar', now() - interval '7 minutes'),
  ('e1300000-0000-4000-8000-000000000004', 'entrada', 'cliente', 'no cartão', now() - interval '6 minutes');
select results_eq(
  $$ select m ->> 'de', m ->> 'texto'
     from jsonb_array_elements(agente.contexto_conversa('e1300000-0000-4000-8000-000000000004', 50) -> 'mensagens') m $$,
  $$ values ('familia', 'oi'), ('isadora', 'Oi! Eu sou a Isadora'), ('equipe', 'aqui é a equipe'),
            ('familia', 'quero contratar'), ('familia', 'no cartão') $$,
  'contexto_conversa: {de, texto} da mais antiga para a mais nova');
select is((agente.contexto_conversa('e1300000-0000-4000-8000-000000000004', 50) ->> 'posicao_ultima_resposta')::integer, 2,
  'contexto_conversa marca onde começa o pedido atual (depois da última resposta)');
select is(jsonb_array_length(agente.contexto_conversa('e1300000-0000-4000-8000-000000000004', 2) -> 'mensagens'), 2,
  'contexto_conversa respeita o limite (as últimas)');
select is(agente.contexto_conversa('e1300000-0000-4000-8000-000000000004', 2) ->> 'iniciada_por', 'cliente',
  'contexto_conversa devolve quem iniciou');


-- =============================================================================
-- 10. agente.checar_termos_alerta (11.11 item 1)
-- =============================================================================

select is((agente.checar_termos_alerta('Estou com SANGRAMENTO desde ontem') ->> 'alerta')::boolean, true,
  'termo encontrado sem diferença de maiúscula');
select is(agente.checar_termos_alerta('não sinto o bebê mexer desde cedo') ->> 'termo', 'não sinto o bebê mexer',
  'expressão inteira, comparada sem acento');
select is((agente.checar_termos_alerta('Nao sinto o bebe mexer') ->> 'alerta')::boolean, true,
  'texto sem acento pega o termo com acento');
select is((agente.checar_termos_alerta('estou febril') ->> 'alerta')::boolean, false,
  'por palavra inteira: "febril" não pega "febre"');
select is((agente.checar_termos_alerta('vocês atendem se tiver febre?') ->> 'alerta')::boolean, true,
  'pergunta geral com termo também dispara (falso positivo aceito, 11.11)');
select results_eq(
  $$ select r ->> 'acao', r ->> 'mensagem_chave' from (select agente.checar_termos_alerta('já perdi um bebê antes e agora estou com febre') r) x $$,
  $$ values ('bloqueio_total', 'perda') $$,
  'perda tem precedência: "perdi um bebê" com bloqueio_total e chave perda (K-21)');
select is(agente.checar_termos_alerta('o bebê foi para a UTI') ->> 'mensagem_chave', 'alerta_internacao',
  'UTI devolve a chave alerta_internacao');
select is(agente.checar_termos_alerta('o bebê foi para a UTI e estou com sangramento') ->> 'mensagem_chave', 'alerta_saude',
  'com internação e sintoma juntos vale alerta_saude (manda procurar urgência)');
select is((agente.checar_termos_alerta('meu marido desmaiou de cansaço') ->> 'alerta')::boolean, false,
  'termo inativo (sinônimo aguardando a Edilaine) não dispara');


-- =============================================================================
-- 11. agente.mensagem_alerta (Apêndice A [v4.2])
-- =============================================================================

select is(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'alerta_saude', 'alerta_emocional') ->> 'chave', 'alerta_saude',
  'alerta_emocional com o parâmetro desligado devolve alerta_saude');
update parametro set valor = 'true' where chave = 'alerta_emocional_ativo';
select is(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'alerta_saude', 'alerta_emocional') ->> 'chave', 'alerta_saude',
  'alerta_emocional ligado mas em rascunho: devolve alerta_saude');
update mensagem_modelo set status = 'aprovado' where chave = 'alerta_emocional';
select is(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'alerta_saude', 'alerta_emocional') ->> 'chave', 'alerta_emocional',
  'alerta_emocional ligado e aprovado: sai o texto próprio');
select ok(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'alerta_saude', 'alerta_emocional') ->> 'texto' like '%188%',
  'o texto emocional cita o CVV');
update parametro set valor = 'false' where chave = 'alerta_emocional_ativo';
select is(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'perda', 'alerta_saude') ->> 'chave', 'perda',
  'ação perda devolve sempre perda');
select is(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'alerta_saude', 'qualquer_coisa') ->> 'chave', 'alerta_saude',
  'chave desconhecida devolve alerta_saude');
select is(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'alerta_saude', 'alerta_internacao') ->> 'chave', 'alerta_saude',
  'alerta_internacao com o parâmetro desligado devolve alerta_saude');
select is(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'alerta_saude', 'alerta_saude_sensivel') ->> 'chave', 'alerta_saude',
  'alerta_saude_sensivel com o parâmetro desligado devolve alerta_saude');
select ok(agente.mensagem_alerta((select id from t_id where chave = 'conv_vendas'), 'alerta_saude', 'alerta_saude') ->> 'texto' like 'Marina, pelo que você%',
  'alerta_saude com o nome da família');
select ok(agente.mensagem_alerta('e1300000-0000-4000-8000-000000000004', 'alerta_saude', 'alerta_saude') ->> 'texto' like 'Pelo que você está me contando%',
  'alerta_saude sem nome: tira a variável e a vírgula e acerta a maiúscula (23)');
select is((agente.mensagem_alerta(null, null, null) ->> 'ok')::boolean, true,
  'mensagem_alerta nunca devolve erro, nem com tudo nulo');
select is(agente.mensagem_alerta(null, null, null) ->> 'chave', 'alerta_saude',
  'mensagem_alerta com tudo nulo devolve alerta_saude');


-- =============================================================================
-- 12. agente.planos_vigentes, verificar_cobertura, verificar_disponibilidade
-- =============================================================================

select is(jsonb_array_length(agente.planos_vigentes() -> 'planos'), 5, 'planos_vigentes: os cinco planos com versão vigente');
select ok(position('111100' in agente.planos_vigentes()::text) = 0, 'planos_vigentes não traz o valor da versão encerrada');
select results_eq(
  $$ select p ->> 'nome', p ->> 'valor', p ->> 'parcela_texto'
     from jsonb_array_elements(agente.planos_vigentes() -> 'planos') p where p ->> 'nome' = 'Continuado' $$,
  $$ values ('Continuado', 'R$ 8.100', '3x de R$ 2.700') $$,
  'planos_vigentes: valor e parcela formatados');

select is(agente.verificar_cobertura('Barueri', 'Alphaville', 'SP') ->> 'status', 'atendida',
  'cobertura: localidade Alphaville (pelo bairro) atendida');
select is(agente.verificar_cobertura('Sampa', null, null) ->> 'status', 'atendida', 'cobertura: alias "Sampa"');
select is(agente.verificar_cobertura('São Bernardo do Campo', null, 'SP') ->> 'status', 'confirmar',
  'cobertura: ABC com requer_confirmacao volta confirmar');
select is(agente.verificar_cobertura('Osasco', null, null) ->> 'status', 'confirmar',
  'cobertura: município da mesma região intermediária de uma praça volta confirmar');
select is(agente.verificar_cobertura('Campinas', null, null) ->> 'status', 'nao_atendida', 'cobertura: praça futura volta nao_atendida');
select is(agente.verificar_cobertura('Cidade Inventada', null, null) ->> 'status', 'desconhecida', 'cobertura: nome não reconhecido volta desconhecida');
select results_eq(
  $$ select (r ->> 'tem_taxa')::boolean, r ? 'taxa' from (select agente.verificar_cobertura('Cotia', 'Granja Viana', null) r) x $$,
  $$ values (true, false) $$,
  'cobertura com taxa: tem_taxa sem o valor enquanto taxa_visivel_agente for falso (C-17)');
update parametro set valor = 'true' where chave = 'taxa_visivel_agente';
select is(agente.verificar_cobertura('Cotia', 'Granja Viana', null) ->> 'taxa', 'R$ 350', 'com taxa_visivel_agente ligado, o valor aparece');
update parametro set valor = 'false' where chave = 'taxa_visivel_agente';

select is((agente.verificar_disponibilidade('31/02/2027', 'São Paulo') ->> 'ok')::boolean, false,
  'disponibilidade: DPP inválida volta ok falso');
select ok(agente.verificar_disponibilidade(to_char(current_date + 100, 'DD/MM/YYYY'), 'São Paulo') ->> 'status' in ('disponivel', 'confirmar_com_equipe'),
  'disponibilidade: só disponivel ou confirmar_com_equipe');
select is((select array_agg(k order by k) from jsonb_object_keys(agente.verificar_disponibilidade(to_char(current_date + 100, 'DD/MM/YYYY'), 'São Paulo')) k),
  array['ok', 'status'], 'disponibilidade: nenhum número exposto (só ok e status)');
select is(agente.verificar_disponibilidade(to_char(current_date + 100, 'DD/MM/YYYY'), 'Campinas') ->> 'status', 'confirmar_com_equipe',
  'disponibilidade fora da cobertura: confirmar_com_equipe');


-- =============================================================================
-- 13. agente.atualizar_lead
-- =============================================================================

insert into conversa (id, wa_jid, telefone_e164, nome_whatsapp, classificacao, iniciada_por)
values ('e1300000-0000-4000-8000-000000000005', '5511900000907-teste@s.whatsapp.net', '+5511900000907', 'Lia', 'nao_classificado', 'cliente');
create temp table t_l on commit drop as
select agente.atualizar_lead('e1300000-0000-4000-8000-000000000005',
  '{"nome":"Lia Teste","semanas":"29s3d","cidade":"São Paulo","bairro":"Pinheiros","plano":"Continuado","primeiro_bebe":"sim",
    "rede_apoio":"só o casal [ninguém mais]\nmãe longe","principal_preocupacao":"amamentação","pagamento":"pix","cor_preferida":"azul",
    "historico_sensivel":"teve pré-eclâmpsia na primeira gestação","estado_sensivel":"normal"}'::jsonb) as r;
select is((select (r ->> 'ok')::boolean from t_l), true, 'atualizar_lead: ok');
select is((select r ->> 'estagio' from t_l), 'qualificado', 'atualizar_lead: DPP e cobertura movem para qualificado pela máquina de estado');
select ok((select r -> 'campos_ignorados' ? 'cor_preferida' and r -> 'campos_ignorados' ? 'estado_sensivel' from t_l),
  'atualizar_lead: campo desconhecido (e estado_sensivel) volta em campos_ignorados');
insert into t_id select 'fam_lia', (r ->> 'familia_id')::uuid from t_l;
select results_eq(
  $$ select f.dpp, f.cidade_informada, f.bairro, f.cidade_id is not null, f.municipio_codigo_ibge, f.primeira_gestacao, f.historico_sensivel
     from familia f where f.id = (select id from t_id where chave = 'fam_lia') $$,
  $$ values (current_date + (280 - (29 * 7 + 3)), 'São Paulo', 'Pinheiros', true, null::integer, true, true) $$,
  'atualizar_lead: semanas viram DPP pela data de hoje; cidade_informada e cidade_id; historico_sensivel só como verdadeiro');
select is_empty(
  $$ select 1 from familia f where f.id = (select id from t_id where chave = 'fam_lia')
       and (f.estado_sensivel_motivo is not null or f.estado_sensivel <> 'normal') $$,
  'atualizar_lead: o detalhe do histórico sensível não é gravado em lugar nenhum da família');
select is_empty(
  $$ select 1 from oportunidade o, familia f where f.id = (select id from t_id where chave = 'fam_lia') and o.familia_id = f.id
       and (o.qualificacao::text like '%eclâmpsia%' or f.nome_exibicao like '%eclâmpsia%') $$,
  'atualizar_lead: o texto do histórico sensível foi descartado');
select results_eq(
  $$ select o.qualificacao ->> 'rede_apoio', o.qualificacao ->> 'principal_preocupacao', o.pagamento_preferido,
            (select nome from pacote where id = o.plano_interesse_pacote_id)
     from oportunidade o where o.familia_id = (select id from t_id where chave = 'fam_lia') $$,
  $$ values ('só o casal ninguém mais mãe longe', 'amamentação', 'pix', 'Continuado') $$,
  'atualizar_lead: campo livre sem colchetes nem quebra; plano de interesse e pagamento');
select results_eq(
  $$ select c.familia_id = (select id from t_id where chave = 'fam_lia'), c.classificacao::text, p.nome, p.telefone_e164
     from conversa c join pessoa p on p.id = c.pessoa_id where c.id = 'e1300000-0000-4000-8000-000000000005' $$,
  $$ values (true, 'lead', 'Lia Teste', '+5511900000907') $$,
  'atualizar_lead: cria família e pessoa, liga a conversa e marca lead');
select ok((select score is not null from oportunidade where familia_id = (select id from t_id where chave = 'fam_lia')),
  'atualizar_lead: score recalculado');
select ok(exists (select 1 from evento_familia e where e.familia_id = (select id from t_id where chave = 'fam_lia')
                  and e.tipo = 'estagio' and e.dados ->> 'para' = 'qualificado' and (e.dados ->> 'sistema')::boolean),
  'atualizar_lead: o estágio andou por privado.transicionar (evento de sistema)');

-- ficha do lead: formato do prompt
create temp table t_f on commit drop as select agente.ficha_para_agente('e1300000-0000-4000-8000-000000000005') as r;
select ok((select r ->> 'ficha' like 'Nome: Lia Teste%' from t_f), 'ficha: primeira linha é o nome');
select ok((select r ->> 'ficha' like '%Semanas hoje: 29s3d · DPP%' from t_f), 'ficha: semanas calculadas e DPP');
select ok((select r ->> 'ficha' like '%Histórico sensível informado: sim%' from t_f), 'ficha: histórico sensível só como sim ou não');
select ok((select r ->> 'ficha' not like '%eclâmpsia%' and r ->> 'ficha' not like '%[%' from t_f), 'ficha: sem detalhe e sem colchetes');
select ok((select r ->> 'ficha' like '%cobertura: atendida, sem taxa%' from t_f), 'ficha: cobertura');
select results_eq(
  $$ select r -> 'valor' ->> 'essencial', r -> 'valor' ->> 'minimo', r -> 'parcela' ->> 'continuado',
            (r -> 'pagina' ->> 'filho_unico')::integer, (r -> 'pagina' ->> 'gemelar')::integer from t_f $$,
  $$ values ('R$ 4.200', 'R$ 4.200', '3x de R$ 2.700', 11, 12) $$,
  'ficha: valor.*, parcela.* e pagina.* do prompt');
select is((select r -> 'validador' -> 'listas' from t_f), (select valor from parametro where chave = 'validador_listas'),
  'ficha: listas do validador de parametro.validador_listas');
select is((select r -> 'validador' -> 'taxas_centavos' from t_f), '[]'::jsonb,
  'ficha: sem taxas enquanto taxa_visivel_agente for falso');
select ok((select r ? 'data_hora' and r ? 'planos' and r ? 'valores_permitidos' and r ? 'pdf_status' and r ? 'horarios_edilaine' from t_f),
  'ficha: data e hora, planos, valores permitidos, situação da apresentação e horários da Edilaine');

-- deduplica pelo telefone: conversa nova do mesmo número cai na mesma família
insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por)
values ('e1300000-0000-4000-8000-000000000006', '5511900000907-outro@s.whatsapp.net', '+55119000000907', 'nao_classificado', 'cliente');
update conversa set telefone_e164 = '+5511900000907' where id = 'e1300000-0000-4000-8000-000000000006';
select is((agente.atualizar_lead('e1300000-0000-4000-8000-000000000006', '{"bairro":"Vila Madalena"}') ->> 'familia_id')::uuid,
  (select id from t_id where chave = 'fam_lia'), 'atualizar_lead deduplica pelo telefone');

-- fora de cobertura
insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por)
values ('e1300000-0000-4000-8000-000000000007', '5511900000908-teste@s.whatsapp.net', '+5511900000908', 'nao_classificado', 'cliente');
select is(agente.atualizar_lead('e1300000-0000-4000-8000-000000000007', '{"dpp":"20/01/2027","cidade":"Campinas"}') ->> 'estagio',
  'fora_de_cobertura', 'atualizar_lead: cidade fora da cobertura move para fora_de_cobertura');
select results_eq(
  $$ select f.cidade_informada, f.cidade_id is not null from familia f join conversa c on c.familia_id = f.id
     where c.id = 'e1300000-0000-4000-8000-000000000007' $$,
  $$ values ('Campinas', true) $$,
  'atualizar_lead: grava o texto da cidade sempre');
select is(agente.atualizar_lead('e1300000-0000-4000-8000-000000000007', '{"cidade":"Osasco"}') ->> 'estagio',
  'qualificado', 'atualizar_lead: família que muda para cidade coberta reabre (em_conversa_ia) e qualifica');
select ok((select f.municipio_codigo_ibge is not null and f.cidade_id is null from familia f join conversa c on c.familia_id = f.id
           where c.id = 'e1300000-0000-4000-8000-000000000007'),
  'atualizar_lead: município reconhecido fora de cidade vai para municipio_codigo_ibge');

-- regra 12: família que já terminou um atendimento fala de uma gestação nova
select is((agente.atualizar_lead('e1300000-0000-4000-8000-000000000001', pg_catalog.jsonb_build_object('dpp', to_char(current_date + 200, 'DD/MM/YYYY'))) ->> 'nova_familia')::boolean,
  true, 'regra 12: gestação nova de família atendida vira família nova');
select results_eq(
  $$ select nf.familia_anterior_id = (select id from t_id where chave = 'fam_jade'), nf.dpp = current_date + 200
     from conversa c join familia nf on nf.id = c.familia_id where c.id = 'e1300000-0000-4000-8000-000000000001' $$,
  $$ values (true, true) $$,
  'regra 12: família nova ligada por familia_anterior_id, com a DPP nova; a conversa passa para ela');
select is((select dpp from familia where id = (select id from t_id where chave = 'fam_jade')), current_date - 45,
  'regra 12: a DPP da gestação anterior não é sobrescrita');

-- conversa que não é de lead
select is(agente.atualizar_lead((select id from t_id where chave = 'conv_nao_lead'), '{"nome":"x"}') ->> 'erro', 'conversa_nao_e_lead',
  'atualizar_lead: conversa de candidata volta ok falso');
select is(agente.atualizar_lead((select id from t_id where chave = 'conv_vendas'), '"texto solto"') ->> 'ok', 'false',
  'atualizar_lead: dados que não são objeto volta ok falso');

-- atualizar_lead não baixa o freio
select is((select estado_sensivel::text from familia where nome_exibicao = 'Família Teste Bruma'), 'bloqueio_total',
  'família do seed em bloqueio_total');
select is((agente.atualizar_lead((select id from t_id where chave = 'conv_humano_nominal'), '{"estado_sensivel":"normal","nome":"Camila"}') ->> 'ok')::boolean,
  true, 'atualizar_lead numa família em bloqueio_total grava o que é comercial');
select is((select estado_sensivel::text from familia where nome_exibicao = 'Família Teste Bruma'), 'bloqueio_total',
  'o agente nunca baixa o freio (estado_sensivel ignorado)');


-- =============================================================================
-- 14. agente.registrar_marco
-- =============================================================================

select is((agente.registrar_marco('e1300000-0000-4000-8000-000000000005', 'pdf_enviado', null) ->> 'ok')::boolean, true,
  'registrar_marco pdf_enviado');
select ok((select pdf_enviado_em is not null from oportunidade where familia_id = (select id from t_id where chave = 'fam_lia')),
  'pdf_enviado grava oportunidade.pdf_enviado_em');
select ok((agente.ficha_para_agente('e1300000-0000-4000-8000-000000000005') ->> 'pdf_status') like 'enviado em %',
  'a ficha passa a dizer que a apresentação foi enviada');
select is((agente.registrar_marco('e1300000-0000-4000-8000-000000000005', 'proximo_contato', '32') ->> 'data')::date,
  (select dpp - 280 + 32 * 7 from familia where id = (select id from t_id where chave = 'fam_lia')),
  'proximo_contato por semanas-alvo: o banco calcula a data pela DPP');
select is(agente.registrar_marco('e1300000-0000-4000-8000-000000000005', 'proximo_contato', to_char(current_date - 3, 'DD/MM/YYYY')) ->> 'erro',
  'data_no_passado', 'proximo_contato no passado volta ok falso');
select is((agente.registrar_marco('e1300000-0000-4000-8000-000000000005', 'quer_contratar', null) ->> 'ok')::boolean, true,
  'registrar_marco quer_contratar');
select ok((select qualificacao ? 'quer_contratar_em' from oportunidade where familia_id = (select id from t_id where chave = 'fam_lia')),
  'quer_contratar fica em oportunidade.qualificacao.quer_contratar_em');
select is((agente.ficha_para_agente('e1300000-0000-4000-8000-000000000005') -> 'validador' ->> 'quer_contratar')::boolean, true,
  'a ficha passa quer_contratar ao validador');
select is((agente.registrar_marco('e1300000-0000-4000-8000-000000000005', 'sessao_interesse', null) ->> 'ok')::boolean, true,
  'registrar_marco sessao_interesse');
select ok((select sessao_interesse_em is not null from oportunidade where familia_id = (select id from t_id where chave = 'fam_lia')),
  'sessao_interesse grava oportunidade.sessao_interesse_em');

insert into automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
values ('followup_d1', (select id from t_id where chave = 'fam_lia'), now(), 'agendada',
        '{"conversa_id":"e1300000-0000-4000-8000-000000000005"}');
select is(agente.registrar_marco('e1300000-0000-4000-8000-000000000005', 'sem_interesse', null) ->> 'estagio', 'perdido',
  'sem_interesse move o P1 para perdido');
select results_eq(
  $$ select motivo_perda::text, proximo_contato_em from oportunidade where familia_id = (select id from t_id where chave = 'fam_lia') $$,
  $$ values ('sem_interesse', null::date) $$,
  'sem_interesse: motivo sem_interesse e retorno combinado cancelado');
select is((select status::text from automacao_execucao where familia_id = (select id from t_id where chave = 'fam_lia') and automacao_id = 'followup_d1'),
  'cancelada', 'sem_interesse cancela o follow-up agendado');

select is((agente.registrar_marco('e1300000-0000-4000-8000-000000000005', 'nao_contatar', null) ->> 'ok')::boolean, true,
  'registrar_marco nao_contatar');
select is((select nao_contatar from familia where id = (select id from t_id where chave = 'fam_lia')), true,
  'nao_contatar marca familia.nao_contatar');
select is(agente.registrar_marco('e1300000-0000-4000-8000-000000000005', 'desconto', null) ->> 'erro', 'marco_desconhecido',
  'marco fora da lista volta ok falso');

insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por)
values ('e1300000-0000-4000-8000-000000000008', '5511900000909-teste@s.whatsapp.net', '+5511900000909', 'nao_classificado', 'cliente');
select is(agente.registrar_marco('e1300000-0000-4000-8000-000000000008', 'nutricao', null) ->> 'estagio', 'nutricao',
  'registrar_marco nutricao move o P1 para nutricao (e cria a família do lead)');


select * from finish();

rollback;
