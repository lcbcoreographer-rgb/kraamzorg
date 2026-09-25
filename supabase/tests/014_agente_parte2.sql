-- =============================================================================
-- supabase/tests/014_agente_parte2.sql
--
-- Aceite do P22 (PROMPTS.md v2), fronteira do agente, parte 2:
--   1. registrar_handoff: perda sobe o freio e pausa, inclusive numa
--      conversa sem família; saúde sobe para atencao e nunca baixa um freio
--      mais alto; dois alertas de saúde da mesma conversa em 5 minutos geram
--      dois avisos ao grupo e ao plantão (o segundo com ATUALIZAÇÃO);
--      pedido comercial repetido em 10 minutos não duplica; matriz, SLA,
--      variantes de mídia, dados._fluxo2 (prioridade_minima,
--      manter_opcoes, mensagem_enviada) e dados._fluxo3
--      (acrescentar_ao_aberto).
--   2. Conversa transferida com reuniao continua em humano_comercial
--      depois de o handoff ser fechado, e só privado.retomar_agente a
--      devolve, com linha no log.
--   3. registrar_notificacao_handoff e marcar_nao_lead.
--   4. followups_devidos sem família em atencao, com transferência aberta,
--      fora da janela ou que já recebeu mensagem de conteúdo no dia;
--      reserva; registrar_followup (sai, volta uma vez, vira tarefa).
--   5. base_para_indexar sem nada clínico nem em rascunho; promover_lote,
--      descartar_lote e registrar_ingestao.
--   6. eliminar_titular apaga memória, mensagens, handoffs e conversas e
--      preserva o registro assistencial (PRD 21.3 [v4.2]).
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(146);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

update parametro set valor = '"producao"' where chave = 'agente_modo';
update parametro set valor = pg_catalog.jsonb_build_object(
    'inicio', to_char((now() at time zone 'America/Sao_Paulo') - interval '1 hour', 'HH24:MI'),
    'fim', to_char((now() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI'))
  where chave = 'agente_janela_envio';

create temp table t_id (chave text primary key, id uuid) on commit drop;
insert into t_id (chave, id)
select case c.telefone_e164
         when '+5511900000301' then 'conv_vendas'
         when '+5511900000302' then 'conv_bruma'
         when '+5511900000303' then 'conv_cedro'
         when '+5511900000312' then 'conv_iris'
         when '+5511900000501' then 'conv_candidata'
       end, c.id
from conversa c
where c.telefone_e164 in ('+5511900000301', '+5511900000302', '+5511900000303', '+5511900000312', '+5511900000501');
insert into t_id
select 'perfil_' || split_part(email, '.', 1), id from perfil where email like '%.teste@kraamzorgbrasil.test';
insert into t_id
select 'fam_' || lower(split_part(nome_exibicao, ' ', 3)), id
from familia where nome_exibicao like 'Família Teste %';

create temp table t_r (chave text primary key, r jsonb) on commit drop;
grant all on t_id, t_r to public;

-- =============================================================================
-- 1. registrar_handoff: perda numa conversa sem família (19.3 nó 12)
-- =============================================================================

insert into conversa (id, wa_jid, telefone_e164, nome_whatsapp, classificacao, iniciada_por)
values ('e1400000-0000-4000-8000-000000000001', '5511900000921-teste@s.whatsapp.net', '+5511900000921', 'Paula', 'nao_classificado', 'cliente');
insert into t_r
select 'perda', agente.registrar_handoff('e1400000-0000-4000-8000-000000000001', 'perda', 'relatou perda', null,
  '{"perda_temporalidade":"atual","_fluxo2":{"mensagem_enviada":"Sinto muito, de coração."}}', 'filtro_termos', 'perdi o bebê ontem');

select is((select (r ->> 'ok')::boolean from t_r where chave = 'perda'), true, 'perda numa conversa sem família: registrado');
select ok((select familia_id is not null from conversa where id = 'e1400000-0000-4000-8000-000000000001'),
  'perda: família mínima criada para o freio ter onde ficar');
select is((select f.estado_sensivel::text from familia f join conversa c on c.familia_id = f.id where c.id = 'e1400000-0000-4000-8000-000000000001'),
  'bloqueio_total', 'perda sobe o freio para bloqueio_total');
select ok((select agente_pausado_ate > now() from conversa where id = 'e1400000-0000-4000-8000-000000000001'),
  'perda pausa o agente');
select is(agente.pode_responder('e1400000-0000-4000-8000-000000000001') ->> 'modo', 'humano_nominal',
  'depois da perda, a conversa fica em humano_nominal');
select results_eq(
  $$ select h.motivo::text, h.destino::text, h.prioridade::text, h.sla_vence_em = h.criado_em, h.familia_id is not null
     from handoff h where h.id = (select (r ->> 'handoff_id')::uuid from t_r where chave = 'perda') $$,
  $$ values ('perda', 'coordenacao_clinica', 'maxima', true, true) $$,
  'perda: coordenação clínica, prioridade máxima, SLA imediato (matriz 11.4)');
select is((select r -> 'plantao' from t_r where chave = 'perda'), '["5511900000003"]'::jsonb,
  'prioridade máxima devolve a lista de plantão');
select is((select r ->> 'grupo_jid' from t_r where chave = 'perda'),
  (select valor ->> 'coordenacao_clinica' from parametro where chave = 'grupo_whatsapp_por_destino'),
  'grupo_jid do destino (grupo_whatsapp_por_destino)');
select ok((select r ->> 'mensagem_grupo' like '[SENSÍVEL] Notícia de perda%' and r ->> 'mensagem_grupo' like '%perdi o bebê ontem%'
           from t_r where chave = 'perda'),
  'mensagem ao grupo montada de grupo_perda com o texto da família');
select ok((select strpos(r ->> 'mensagem_grupo', E'\n') > 0 and strpos(r ->> 'mensagem_grupo', ' / ') = 0 from t_r where chave = 'perda'),
  'a barra do modelo vira quebra de linha (23.3)');
select ok((select r ->> 'mensagem_grupo' like '%IA pausada por 48 h nesta conversa.' from t_r where chave = 'perda'),
  'todo aviso termina com a pausa em horas (23.3)');
select is((select (r ->> 'mensagem_grupo_aprovada')::boolean from t_r where chave = 'perda'), false,
  'modelo do grupo em rascunho sai marcado como não aprovado (nunca silencia o aviso)');
select is((select r ->> 'instrucao_chave' from t_r where chave = 'perda'), 'instrucao_saude', 'perda devolve a chave instrucao_saude');
select is((select r -> 'instrucao_agente' from t_r where chave = 'perda'), 'null'::jsonb,
  'instrução ao agente em rascunho não sai (6.8)');
select ok(exists (select 1 from evento_familia e join conversa c on c.familia_id = e.familia_id
                  where c.id = 'e1400000-0000-4000-8000-000000000001' and e.tipo = 'handoff' and e.restrito),
  'perda gera evento restrito na linha do tempo');
select is((agente.pode_enviar('e1400000-0000-4000-8000-000000000001', 'resposta', (select (r ->> 'handoff_id')::uuid from t_r where chave = 'perda')) ->> 'pode')::boolean,
  false, 'depois da perda nenhuma resposta do modelo sai, nem com o handoff desta execução');

-- observação de perda anterior (K-21)
insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por)
values ('e1400000-0000-4000-8000-000000000002', '5511900000922-teste@s.whatsapp.net', '+5511900000922', 'lead', 'cliente');
select ok(agente.registrar_handoff('e1400000-0000-4000-8000-000000000002', 'perda', 'perda anterior', null,
            '{"perda_temporalidade":"anterior"}', 'classificador', 'já perdi um bebê antes') ->> 'mensagem_grupo'
          like '%Pode ser perda de gestação anterior%',
  'perda anterior: o aviso leva a observação de gestação anterior (K-21)');


-- =============================================================================
-- 2. Saúde: atencao, nunca baixa, dois alertas em 5 minutos (P22 v2)
-- =============================================================================

insert into t_r
select 'saude1', agente.registrar_handoff((select id from t_id where chave = 'conv_cedro'), 'saude', 'sangramento', null,
  '{"_fluxo2":{"mensagem_enviada":"Beatriz, pelo que você está me contando..."}}', 'filtro_termos', 'estou com sangramento');
select is((select estado_sensivel::text from familia where id = (select id from t_id where chave = 'fam_cedro')), 'atencao',
  'saúde sobe o freio para atencao');
select ok((select r ->> 'mensagem_grupo' like '🚨 SAÚDE · PRIORIDADE MÁXIMA%' from t_r where chave = 'saude1'),
  'primeiro alerta de saúde: aviso completo ao grupo');
select ok((select r ->> 'mensagem_grupo' like '%A família recebeu: "Beatriz, pelo que você está me contando..."%' from t_r where chave = 'saude1'),
  '{mensagem_enviada} com o texto que saiu no nó 4 do fluxo 2');
select is((select jsonb_array_length(r -> 'plantao') from t_r where chave = 'saude1'), 1, 'primeiro alerta de saúde: plantão avisado');

insert into t_r
select 'saude2', agente.registrar_handoff((select id from t_id where chave = 'conv_cedro'), 'saude', 'piorou', null,
  '{}', 'classificador', 'agora estou com febre também');
select is((select (r ->> 'handoff_id') from t_r where chave = 'saude2'), (select (r ->> 'handoff_id') from t_r where chave = 'saude1'),
  'segundo alerta de saúde em 5 minutos reaproveita a transferência aberta');
select is((select (r ->> 'duplicado')::boolean from t_r where chave = 'saude2'), false,
  'segundo alerta de saúde nunca é deduplicado');
select is((select (r ->> 'atualizacao')::boolean from t_r where chave = 'saude2'), true, 'segundo alerta marcado como atualização');
select ok((select r ->> 'mensagem_grupo' like 'ATUALIZAÇÃO · 🚨 SAÚDE%' and r ->> 'mensagem_grupo' like '%agora estou com febre também%'
           from t_r where chave = 'saude2'),
  'segundo aviso ao grupo com o prefixo ATUALIZAÇÃO e o texto novo');
select ok((select r ->> 'mensagem_grupo' like '%nenhuma mensagem saiu, responder agora%' from t_r where chave = 'saude2'),
  'sem mensagem_enviada: "nenhuma mensagem saiu, responder agora" (23.3)');
select is((select jsonb_array_length(r -> 'plantao') from t_r where chave = 'saude2'), 1,
  'segundo alerta de saúde: plantão avisado de novo');
select is((select jsonb_array_length(dados -> 'textos_familia') from handoff where id = (select (r ->> 'handoff_id')::uuid from t_r where chave = 'saude1')), 2,
  'a transferência aberta acumula os dois textos da família');
select is((select count(*)::integer from handoff where conversa_id = (select id from t_id where chave = 'conv_cedro') and motivo = 'saude'), 1,
  'dois alertas, uma transferência só');

-- perda depois de saúde, na mesma janela: a transferência passa a perda
select is(agente.registrar_handoff((select id from t_id where chave = 'conv_cedro'), 'perda', 'perda', null, '{}', 'filtro_termos', 'perdi o bebê') ->> 'motivo',
  'perda', 'perda depois de saúde reaproveita e sobe o motivo para perda');
select is((select estado_sensivel::text from familia where id = (select id from t_id where chave = 'fam_cedro')), 'bloqueio_total',
  'e o freio sobe de atencao para bloqueio_total');

-- saúde numa família em bloqueio_total: o agente nunca baixa o freio
select is((agente.registrar_handoff((select id from t_id where chave = 'conv_bruma'), 'saude', 'sintoma', null, '{}', 'filtro_termos', 'estou com febre') ->> 'ok')::boolean,
  true, 'saúde numa família em bloqueio_total é registrada');
select is((select estado_sensivel::text from familia where id = (select id from t_id where chave = 'fam_bruma')), 'bloqueio_total',
  'o agente nunca baixa o freio (continua bloqueio_total)');

-- estado_sensivel_escreveu: nunca deduplicado
insert into t_r select 'sens1', agente.registrar_handoff((select id from t_id where chave = 'conv_bruma'), 'estado_sensivel_escreveu', 'escreveu', null, '{}', 'sistema', 'oi');
select is((agente.registrar_handoff((select id from t_id where chave = 'conv_bruma'), 'estado_sensivel_escreveu', 'escreveu de novo', null, '{}', 'sistema', 'oi de novo') ->> 'atualizacao')::boolean,
  true, 'estado_sensivel_escreveu repetido: reavisa com ATUALIZAÇÃO, nunca deduplicado');


-- =============================================================================
-- 3. Pedido comercial repetido em 10 minutos não duplica
-- =============================================================================

insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por, ultima_entrada_em)
values ('e1400000-0000-4000-8000-000000000003', '5511900000923-teste@s.whatsapp.net', '+5511900000923', 'lead', 'cliente', now());
insert into t_r
select 'cob1', agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'cobertura_taxa', 'pergunta da taxa', 'Tem taxa para Cotia?', '{}', 'agente', 'tem taxa?');
insert into t_r
select 'cob2', agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'cobertura_taxa', 'pergunta da taxa', 'tem   TAXA para cotia?', '{}', 'agente', 'tem taxa?');
select is((select (r ->> 'duplicado')::boolean from t_r where chave = 'cob2'), true, 'pedido comercial igual em 10 minutos: duplicado');
select is((select r ->> 'handoff_id' from t_r where chave = 'cob2'), (select r ->> 'handoff_id' from t_r where chave = 'cob1'),
  'pedido comercial igual devolve a mesma transferência');
select is((select r -> 'mensagem_grupo' from t_r where chave = 'cob2'), 'null'::jsonb, 'pedido comercial igual: nenhum aviso novo ao grupo');
select is((select count(*)::integer from handoff where conversa_id = 'e1400000-0000-4000-8000-000000000003'), 1,
  'pedido comercial igual: nenhuma transferência nova');
select is((agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'cobertura_taxa', 'outra pergunta', 'Atendem em Osasco?', '{}', 'agente', 'e Osasco?') ->> 'duplicado')::boolean,
  false, 'pedido comercial diferente: nova transferência');
select ok((select (r ->> 'sla_vence_em')::timestamptz > now() from t_r where chave = 'cob1'),
  'cobertura_taxa: SLA em horas úteis calculado pelo expediente comercial');
select results_eq(
  $$ select r ->> 'destino', r ->> 'prioridade', (r ->> 'humano_comercial')::boolean, (r ->> 'pausa_horas')::numeric from t_r where chave = 'cob1' $$,
  $$ values ('comercial', 'normal', false, 48::numeric) $$,
  'lead ainda não qualificado: comercial, normal e pausa de 48 h (sem humano_comercial)');
select ok((select r ->> 'mensagem_grupo' like '💬 DÚVIDA DE ÁREA OU TAXA%' from t_r where chave = 'cob1'),
  'grupo_generico com o motivo legível de parametro.handoff_motivos_legiveis');

-- prioridade_minima só sobe
select is(agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'duvida_sem_resposta', 'IA fora do ar', 'x1', '{"_fluxo2":{"prioridade_minima":"alta"}}', 'sistema', 'oi') ->> 'prioridade',
  'alta', 'dados._fluxo2.prioridade_minima sobe a prioridade da matriz');
select is(agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'pediu_humano', 'quer falar com alguém', 'x2', '{"_fluxo2":{"prioridade_minima":"normal"}}', 'agente', 'quero uma pessoa') ->> 'prioridade',
  'alta', 'dados._fluxo2.prioridade_minima nunca desce a prioridade');
select is(agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'inventado', 'x', 'x3', '{}', 'agente', 'x') ->> 'motivo',
  'outro', 'motivo fora do enum vira outro');

-- candidata pedindo transferência comercial: não vira família
select is((agente.registrar_handoff((select id from t_id where chave = 'conv_candidata'), 'outro', 'candidata', null, '{}', 'agente', 'x') ->> 'familia_id'),
  null, 'conversa de candidata não ganha família numa transferência comercial');


-- =============================================================================
-- 4. humano_comercial: reuniao, handoff fechado, só retomar_agente devolve
-- =============================================================================

insert into t_r
select 'reuniao', agente.registrar_handoff((select id from t_id where chave = 'conv_vendas'), 'reuniao', 'quer a conversa',
  'quinta ou sexta às 10h', '{"opcoes":["quinta 10h","sexta 10h"]}', 'agente', 'pode ser quinta?');
select results_eq(
  $$ select (r ->> 'humano_comercial')::boolean, r -> 'pausa_horas', r ->> 'instrucao_chave' from t_r where chave = 'reuniao' $$,
  $$ values (true, 'null'::jsonb, 'instrucao_reuniao') $$,
  'reuniao: humano_comercial, sem pausa com prazo, instrução de reunião');
select results_eq(
  $$ select agente_encerrado_em is not null, agente_encerrado_motivo from conversa where id = (select id from t_id where chave = 'conv_vendas') $$,
  $$ values (true, 'reuniao') $$,
  'reuniao grava agente_encerrado_em e agente_encerrado_motivo');
select ok((select r ->> 'mensagem_grupo' like '%quinta 10h ou sexta 10h%'
                  and r ->> 'mensagem_grupo' like '%A Isadora não volta a esta conversa. Para devolver, use Devolver à Isadora na ficha.'
           from t_r where chave = 'reuniao'),
  'aviso de reunião com as opções e a linha final de humano_comercial (23.3)');
select is((agente.pode_enviar((select id from t_id where chave = 'conv_vendas'), 'resposta', (select (r ->> 'handoff_id')::uuid from t_r where chave = 'reuniao')) ->> 'pode')::boolean,
  true, 'a resposta da própria transferência sai (tipo resposta com o handoff_id)');

-- o comercial fecha a transferência pelo app
select testes.autenticar_authenticated((select id from t_id where chave = 'perfil_comercial'), 'aal1');
update handoff set status = 'resolvido', resolvido_em = now()
 where id = (select (r ->> 'handoff_id')::uuid from t_r where chave = 'reuniao');
select testes.encerrar();
select is((select status::text from handoff where id = (select (r ->> 'handoff_id')::uuid from t_r where chave = 'reuniao')), 'resolvido',
  'o comercial resolveu a transferência');
select is(agente.pode_responder((select id from t_id where chave = 'conv_vendas')) ->> 'modo', 'humano_comercial',
  'transferência fechada: a conversa continua em humano_comercial');
select ok((select agente_pausado_ate is null or agente_pausado_ate < now() + interval '1 second' from conversa where id = (select id from t_id where chave = 'conv_vendas'))
          and (select agente_encerrado_em is not null from conversa where id = (select id from t_id where chave = 'conv_vendas')),
  'humano_comercial não vence por prazo (não é pausa)');

-- só retomar_agente devolve; marketing e enfermeira não podem
select testes.autenticar_authenticated((select id from t_id where chave = 'perfil_marketing'), 'aal1');
select throws_ok(format('select api.retomar_agente(%L)', (select id from t_id where chave = 'conv_vendas')), '42501', null,
  'marketing não devolve a conversa à Isadora');
select testes.encerrar();
select testes.autenticar_authenticated((select id from t_id where chave = 'perfil_comercial'), 'aal1');
select is((api.retomar_agente((select id from t_id where chave = 'conv_vendas')) ->> 'estava_em'), 'humano_comercial',
  'comercial devolve a conversa pelo botão Devolver à Isadora');
select testes.encerrar();
select is(agente.pode_responder((select id from t_id where chave = 'conv_vendas')) ->> 'modo', 'vendas',
  'depois de retomar_agente a Isadora volta (modo vendas)');
select is((select count(*)::integer from log_auditoria where acao = 'agente_retomado' and entidade_id = (select id from t_id where chave = 'conv_vendas')::text), 1,
  'retomar_agente grava linha no log');
select ok(exists (select 1 from evento_familia where familia_id = (select id from t_id where chave = 'fam_aurora') and tipo = 'agente_retomado'),
  'retomar_agente grava evento na ficha');
select testes.autenticar_authenticated((select id from t_id where chave = 'perfil_comercial'), 'aal1');
select throws_ok(format('select api.retomar_agente(%L)', (select id from t_id where chave = 'conv_vendas')), '22023', null,
  'retomar_agente numa conversa que já está com a Isadora é recusado');
select testes.encerrar();
select throws_ok(format('select privado.retomar_agente(%L)', (select id from t_id where chave = 'conv_vendas')), '42501', null,
  'retomar_agente sem usuário (sistema, agente) é recusado');

-- comercial ao lead qualificado (qualquer motivo comercial) também encerra
insert into conversa (id, wa_jid, telefone_e164, familia_id, classificacao, iniciada_por)
select 'e1400000-0000-4000-8000-000000000004', '5511900000308-novo@s.whatsapp.net', '+5511900000308', f.id, 'lead', 'cliente'
from familia f where f.id = (select id from t_id where chave = 'fam_gruta');
select is((agente.registrar_handoff('e1400000-0000-4000-8000-000000000004', 'duvida_sem_resposta', 'dúvida', 'tem nota?', '{}', 'agente', 'tem nota?') ->> 'humano_comercial')::boolean,
  true, 'transferência ao comercial com a oportunidade qualificada ou adiante: humano_comercial');
select is((select agente_encerrado_motivo from conversa where id = 'e1400000-0000-4000-8000-000000000004'), 'qualificado',
  'motivo gravado: qualificado');

-- humano_comercial: o texto novo vai para a transferência aberta, sem aviso
insert into t_r select 'contratar', agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'contratar', 'quer contratar', 'fechado, Continuado no Pix', '{}', 'agente', 'fechado!');
select is((select (r ->> 'humano_comercial')::boolean from t_r where chave = 'contratar'), true, 'contratar: humano_comercial');
insert into t_r select 'acresc', agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'contratar', '', 'e o contrato?', '{"_fluxo3":{"acrescentar_ao_aberto":true}}', 'sistema', 'e o contrato?');
select results_eq(
  $$ select (r ->> 'duplicado')::boolean, (r ->> 'acrescentado')::boolean, r -> 'mensagem_grupo' from t_r where chave = 'acresc' $$,
  $$ values (true, true, 'null'::jsonb) $$,
  'acrescentar_ao_aberto: sem aviso novo, texto acrescentado');
select ok(exists (select 1 from handoff
                  where conversa_id = 'e1400000-0000-4000-8000-000000000003' and status = 'aberto'
                    and dados -> 'acrescimos' -> 0 ->> 'texto' = 'e o contrato?'),
  'o texto novo fica na transferência aberta');

-- manter_opcoes na troca de motivo comercial
select ok(agente.registrar_handoff('e1400000-0000-4000-8000-000000000004', 'condicao_comercial', 'desconto', 'tem desconto no pix?',
            '{"opcoes":["terça 14h","quarta 9h"],"_fluxo2":{"manter_opcoes":true}}', 'agente', 'tem desconto?') ->> 'mensagem_grupo'
          like '%terça 14h ou quarta 9h%',
  'manter_opcoes mantém dados.opcoes no texto do grupo quando o modelo não tem {opcoes}');


-- =============================================================================
-- 5. Variantes da matriz: mídia (11.4 [v4.2]) e áudio
-- =============================================================================

insert into conversa (id, wa_jid, telefone_e164, familia_id, classificacao, iniciada_por) values
  ('e1400000-0000-4000-8000-000000000005', '5511900000315-novo@s.whatsapp.net', '+5511900000315', (select id from t_id where chave = 'fam_lua'), 'cliente', 'cliente');
select results_eq(
  $$ select r ->> 'destino', r ->> 'prioridade'
     from (select agente.registrar_handoff('e1400000-0000-4000-8000-000000000005', 'midia_recebida', 'foto', null, '{}', 'sistema', '') r) x $$,
  $$ values ('coordenacao_clinica', 'alta') $$,
  'mídia de cliente em atendimento (pipeline 3): coordenação clínica, alta');
select results_eq(
  $$ select r ->> 'destino', r ->> 'prioridade'
     from (select agente.registrar_handoff((select id from t_id where chave = 'conv_iris'), 'midia_recebida', 'foto', null, '{}', 'sistema', '') r) x $$,
  $$ values ('operacao', 'alta') $$,
  'mídia de cliente que ainda não começou o atendimento: operação, alta');
select results_eq(
  $$ select r ->> 'destino', r ->> 'prioridade'
     from (select agente.registrar_handoff('e1400000-0000-4000-8000-000000000002', 'midia_recebida', 'foto', null, '{}', 'sistema', '') r) x $$,
  $$ values ('comercial', 'normal') $$,
  'mídia de lead: comercial, normal');
select results_eq(
  $$ select r ->> 'destino', r ->> 'prioridade'
     from (select agente.registrar_handoff('e1400000-0000-4000-8000-000000000003', 'audio_nao_transcrito', 'áudio', null, '{}', 'sistema', '') r) x $$,
  $$ values ('comercial', 'alta') $$,
  'áudio não transcrito de lead: comercial, alta');
select results_eq(
  $$ select r ->> 'destino', r ->> 'prioridade'
     from (select agente.registrar_handoff((select id from t_id where chave = 'conv_iris'), 'audio_nao_transcrito', 'áudio', null, '{}', 'sistema', '') r) x $$,
  $$ values ('coordenacao_clinica', 'alta') $$,
  'áudio não transcrito de cliente: coordenação clínica, alta');

-- textos aprovados passam a sair aprovados
update mensagem_modelo set status = 'aprovado' where chave in ('grupo_saude', 'instrucao_saude', 'instrucao_generica');
insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por)
values ('e1400000-0000-4000-8000-000000000006', '5511900000924-teste@s.whatsapp.net', '+5511900000924', 'lead', 'cliente');
insert into t_r select 'aprov', agente.registrar_handoff('e1400000-0000-4000-8000-000000000006', 'saude', 'febre', null, '{}', 'classificador', 'febre alta');
select results_eq(
  $$ select (r ->> 'mensagem_grupo_aprovada')::boolean, r ->> 'instrucao_agente' from t_r where chave = 'aprov' $$,
  $$ select true, texto from mensagem_modelo where chave = 'instrucao_saude' $$,
  'com os textos aprovados: aviso aprovado e instrução ao agente');


-- =============================================================================
-- 6. registrar_notificacao_handoff e marcar_nao_lead
-- =============================================================================

select is((agente.registrar_notificacao_handoff((select (r ->> 'handoff_id')::uuid from t_r where chave = 'cob1'), true, null) ->> 'ok')::boolean, true,
  'registrar_notificacao_handoff ok');
select is((select notificacao_ok from handoff where id = (select (r ->> 'handoff_id')::uuid from t_r where chave = 'cob1')), true,
  'notificação que saiu: notificacao_ok verdadeiro');
select is((agente.registrar_notificacao_handoff((select (r ->> 'handoff_id')::uuid from t_r where chave = 'aprov'), false, 'UAZAPI 500') ->> 'ok')::boolean, true,
  'registrar_notificacao_handoff com falha');
select is((select notificacao_ok from handoff where id = (select (r ->> 'handoff_id')::uuid from t_r where chave = 'aprov')), false,
  'falha deixa notificacao_ok falso (faixa vermelha no CRM)');
select set_eq(
  $$ select papel::text from notificacao where titulo = 'handoff_notificacao_falhou' and 'email' = any (canais) $$,
  $$ values ('coordenacao'), ('diretoria') $$,
  'falha aciona notificação com e-mail para o destino e, em prioridade máxima, para a diretoria');
select is((agente.registrar_notificacao_handoff(gen_random_uuid(), true, null) ->> 'ok')::boolean, false,
  'registrar_notificacao_handoff: handoff desconhecido volta ok falso');

insert into conversa (id, wa_jid, telefone_e164, classificacao, iniciada_por)
values ('e1400000-0000-4000-8000-000000000007', '5511900000925-teste@s.whatsapp.net', '+5511900000925', 'nao_classificado', 'cliente');
update mensagem_modelo set status = 'aprovado' where chave in ('nao_lead_candidata', 'instrucao_nao_lead');
insert into t_r select 'naolead', agente.marcar_nao_lead('e1400000-0000-4000-8000-000000000007', 'candidata');
select is((select classificacao::text from conversa where id = 'e1400000-0000-4000-8000-000000000007'), 'candidata',
  'marcar_nao_lead classifica a conversa');
select is((select r ->> 'texto_encaminhamento' from t_r where chave = 'naolead'), (select texto from mensagem_modelo where chave = 'nao_lead_candidata'),
  'marcar_nao_lead devolve o texto de encaminhamento aprovado');
select ok((select strpos(r ->> 'instrucao_agente', r ->> 'texto_encaminhamento') > 0 from t_r where chave = 'naolead'),
  'marcar_nao_lead devolve a instrução com o encaminhamento dentro');
select is(agente.pode_responder('e1400000-0000-4000-8000-000000000007') ->> 'modo', 'nao_lead', 'depois: modo nao_lead');
select is(agente.marcar_nao_lead((select id from t_id where chave = 'conv_iris'), 'fornecedor') ->> 'erro', 'conversa_com_dados_de_lead',
  'marcar_nao_lead nunca rebaixa conversa de cliente');
select is(agente.marcar_nao_lead((select id from t_id where chave = 'conv_vendas'), 'fornecedor') ->> 'erro', 'conversa_com_dados_de_lead',
  'marcar_nao_lead nunca rebaixa conversa com DPP na ficha');
select is((agente.marcar_nao_lead('e1400000-0000-4000-8000-000000000007', 'vendedor') ->> 'ok')::boolean, false,
  'marcar_nao_lead: tipo fora da lista volta ok falso');


-- =============================================================================
-- 7. followups_devidos e registrar_followup (19.4 entrada B)
-- =============================================================================

update mensagem_modelo set status = 'aprovado' where chave in ('followup_d1_pos_pdf', 'followup_d1_pos_abertura');

-- seis leads fictícios sem resposta há mais de agente_followup_horas, cada
-- um com a última fala da Kraamzorg
insert into familia (id, nome_exibicao, dpp, estado_sensivel) values
  ('e1400000-0000-4000-8000-000000000101', 'Família Teste P22 Devido',      current_date + 100, 'normal'),
  ('e1400000-0000-4000-8000-000000000102', 'Família Teste P22 Atenção',     current_date + 100, 'atencao'),
  ('e1400000-0000-4000-8000-000000000103', 'Família Teste P22 Transferida', current_date + 100, 'normal'),
  ('e1400000-0000-4000-8000-000000000104', 'Família Teste P22 Conteúdo',    current_date + 100, 'normal'),
  ('e1400000-0000-4000-8000-000000000105', 'Família Teste P22 Comercial',   current_date + 100, 'normal'),
  ('e1400000-0000-4000-8000-000000000106', 'Família Teste P22 Não Contatar', current_date + 100, 'normal');
update familia set nao_contatar = true where id = 'e1400000-0000-4000-8000-000000000106';
insert into pessoa (familia_id, papel, nome, telefone_e164)
values ('e1400000-0000-4000-8000-000000000101', 'mae', 'Helena Teste P22', '+5511900000931');
insert into conversa (id, wa_jid, telefone_e164, familia_id, pessoa_id, classificacao, iniciada_por, ultima_entrada_em, ultima_saida_em, agente_encerrado_em)
select ('e1400000-0000-4000-8000-00000000021' || n)::uuid, '55119000009' || (30 + n) || '-teste@s.whatsapp.net', '+55119000009' || (30 + n),
       ('e1400000-0000-4000-8000-00000000010' || n)::uuid,
       case when n = 1 then (select id from pessoa where telefone_e164 = '+5511900000931') end,
       'lead', 'cliente', now() - interval '50 hours', now() - interval '49 hours',
       case when n = 5 then now() - interval '49 hours' end
from generate_series(1, 6) n;
insert into oportunidade (familia_id, pipeline, estagio_p1, pdf_enviado_em)
select ('e1400000-0000-4000-8000-00000000010' || n)::uuid, 1, 'em_conversa_ia', case when n = 1 then now() - interval '49 hours' end
from generate_series(1, 6) n;
insert into handoff (conversa_id, familia_id, motivo, destino, prioridade, resumo)
values ('e1400000-0000-4000-8000-000000000213', 'e1400000-0000-4000-8000-000000000103', 'duvida_sem_resposta', 'comercial', 'normal', 'x');
-- a família 4 já recebeu a mensagem de conteúdo do dia (outro follow-up)
insert into automacao_execucao (automacao_id, familia_id, agendada_para, executada_em, status, payload)
values ('followup_d1', 'e1400000-0000-4000-8000-000000000104', now() - interval '3 days', now(), 'executada',
        '{"conversa_id":"e1400000-0000-4000-8000-000000000214","ultima_entrada_em":"2000-01-01T00:00:00Z"}');
-- os agendamentos do motor (a família 3 tem transferência aberta e a 5 está
-- em humano_comercial: o motor já não agenda; entram à mão para provar que
-- followups_devidos também exclui)
select cmp_ok(privado.agendar_followup_d1(), '>=', 3, 'o motor agenda os follow-ups devidos');
insert into automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
select 'followup_d1', c.familia_id, now(), 'agendada',
       jsonb_build_object('conversa_id', c.id, 'ultima_entrada_em', c.ultima_entrada_em)
from conversa c
where c.id in ('e1400000-0000-4000-8000-000000000213', 'e1400000-0000-4000-8000-000000000215');

-- fora da janela: nada sai, e nada é cancelado
update parametro set valor = pg_catalog.jsonb_build_object(
    'inicio', to_char((now() at time zone 'America/Sao_Paulo') + interval '2 hours', 'HH24:MI'),
    'fim', to_char((now() at time zone 'America/Sao_Paulo') + interval '3 hours', 'HH24:MI'))
  where chave = 'agente_janela_envio';
insert into t_r select 'fora', agente.followups_devidos();
select is(jsonb_array_length((select r -> 'itens' from t_r where chave = 'fora')), 0, 'fora da janela: nenhum follow-up devido');
select is((select status::text from automacao_execucao where familia_id = 'e1400000-0000-4000-8000-000000000101' and automacao_id = 'followup_d1'),
  'agendada', 'fora da janela: o follow-up continua agendado para a próxima rodada');
update parametro set valor = pg_catalog.jsonb_build_object(
    'inicio', to_char((now() at time zone 'America/Sao_Paulo') - interval '1 hour', 'HH24:MI'),
    'fim', to_char((now() at time zone 'America/Sao_Paulo') + interval '1 hour', 'HH24:MI'))
  where chave = 'agente_janela_envio';

insert into t_r select 'devidos', agente.followups_devidos();
select set_eq(
  $$ select i ->> 'conversa_id' from t_r, jsonb_array_elements(r -> 'itens') i where chave = 'devidos'
       and (i ->> 'conversa_id') like 'e1400000-%' $$,
  $$ values ('e1400000-0000-4000-8000-000000000211') $$,
  'followups_devidos: só a família elegível (sem atencao, sem transferência aberta, sem conteúdo no dia, fora de humano_comercial e de nao_contatar)');
select results_eq(
  $$ select status::text, motivo_aborto from automacao_execucao where familia_id = 'e1400000-0000-4000-8000-000000000102' and automacao_id = 'followup_d1' $$,
  $$ values ('abortada_freio', 'atencao') $$,
  'família em atencao: abortada pelo freio');
select results_eq(
  $$ select status::text, motivo_aborto from automacao_execucao where familia_id = 'e1400000-0000-4000-8000-000000000103' and automacao_id = 'followup_d1' $$,
  $$ values ('cancelada', 'transferencia_aberta') $$,
  'família com transferência aberta: cancelada');
select results_eq(
  $$ select status::text from automacao_execucao where familia_id = 'e1400000-0000-4000-8000-000000000104' and automacao_id = 'followup_d1' order by criado_em $$,
  $$ values ('executada'), ('agendada') $$,
  'família que já recebeu conteúdo no dia: continua agendada, nada sai hoje');
select results_eq(
  $$ select status::text, motivo_aborto from automacao_execucao where familia_id = 'e1400000-0000-4000-8000-000000000105' and automacao_id = 'followup_d1' $$,
  $$ values ('cancelada', 'humano_comercial') $$,
  'conversa em humano_comercial: cancelada (nunca follow-up depois da passagem ao comercial)');
select results_eq(
  $$ select status::text, motivo_aborto from automacao_execucao where familia_id = 'e1400000-0000-4000-8000-000000000106' and automacao_id = 'followup_d1' $$,
  $$ values ('cancelada', 'nao_contatar') $$,
  'família nao_contatar: cancelada');

create temp table t_item on commit drop as
select i from t_r, jsonb_array_elements(r -> 'itens') i
where chave = 'devidos' and i ->> 'conversa_id' = 'e1400000-0000-4000-8000-000000000211';
select results_eq(
  $$ select i ->> 'wa_jid', i ->> 'nome', i ->> 'tempo_sem_resposta' from t_item $$,
  $$ values ('5511900000931-teste@s.whatsapp.net', 'Helena', '2 dias') $$,
  'item: jid para enviar, nome e tempo sem resposta calculado pelo banco');
select is((select i ->> 'texto_base' from t_item),
  replace((select texto from mensagem_modelo where chave = 'followup_d1_pos_pdf'), '{nome}', 'Helena'),
  'item: texto base aprovado depois do PDF, com o nome');
select ok((select jsonb_typeof(i -> 'ultimas_mensagens') = 'array' and i ? 'data_hora' and i ? 'execucao_id' from t_item),
  'item: últimas mensagens, data e hora e execução');
select ok((select r -> 'validador' ? 'listas' and r ? 'enviados_hoje' and r ? 'limite_similaridade' from t_r where chave = 'devidos'),
  'followups_devidos devolve validador, enviados_hoje e limite_similaridade');
select is(jsonb_array_length(agente.followups_devidos() -> 'itens'), 0,
  'reserva: a mesma execução nunca volta numa segunda chamada');

-- registrar_followup: saiu
select is(agente.registrar_followup((select (i ->> 'execucao_id')::uuid from t_item), 'Oi, Helena! Conseguiu ver a apresentação?', true) ->> 'status',
  'executada', 'registrar_followup: saiu, execução executada');
select ok(exists (select 1 from mensagem where conversa_id = 'e1400000-0000-4000-8000-000000000211'
                  and enviado_por = 'ia' and conteudo = 'Oi, Helena! Conseguiu ver a apresentação?'),
  'registrar_followup grava a mensagem da Isadora');
select is((select cadencia_etapa from oportunidade where familia_id = 'e1400000-0000-4000-8000-000000000101'), 1,
  'registrar_followup marca o primeiro retorno na cadência');
select is(agente.pode_enviar('e1400000-0000-4000-8000-000000000211', 'conteudo', null) ->> 'motivo', 'conteudo_ja_enviado_hoje',
  'depois do follow-up, um segundo conteúdo no mesmo dia é recusado');
select ok((select r -> 'enviados_hoje' ? 'Oi, Helena! Conseguiu ver a apresentação?' from (select agente.followups_devidos() r) x),
  'o texto enviado entra em enviados_hoje (comparação no código, 11.11 item 7)');
select is(privado.agendar_followup_d1(), 0,
  'o motor não reagenda o mesmo silêncio (dedup por qualquer status)');

-- registrar_followup: não saiu duas vezes vira tarefa
update conversa set ultima_saida_em = now() - interval '49 hours' where id = 'e1400000-0000-4000-8000-000000000211';
insert into automacao_execucao (id, automacao_id, familia_id, agendada_para, status, payload)
values ('e1400000-0000-4000-8000-000000000301', 'followup_d1', 'e1400000-0000-4000-8000-000000000101', now(), 'agendada',
        '{"conversa_id":"e1400000-0000-4000-8000-000000000211","ultima_entrada_em":"2000-01-01T00:00:00Z","reservada_em":"2026-01-01T00:00:00Z","chave_texto":"followup_d1_pos_pdf"}');
select is(agente.registrar_followup('e1400000-0000-4000-8000-000000000301', null, false) ->> 'status', 'agendada',
  'primeira falha: volta para a próxima janela');
select ok((select not (payload ? 'reservada_em') from automacao_execucao where id = 'e1400000-0000-4000-8000-000000000301'),
  'primeira falha: a reserva é desfeita');
update automacao_execucao set payload = payload || '{"reservada_em":"2026-01-01T00:00:00Z"}' where id = 'e1400000-0000-4000-8000-000000000301';
select is(agente.registrar_followup('e1400000-0000-4000-8000-000000000301', null, false) ->> 'status', 'falhou',
  'segunda falha: execução falhou');
select ok(exists (select 1 from tarefa where tipo = 'followup_comercial' and familia_id = 'e1400000-0000-4000-8000-000000000101'
                  and payload ->> 'texto_sugerido' like 'Oi, Helena%'),
  'segunda falha: vira tarefa do comercial com o texto aprovado sugerido');
select is(agente.registrar_followup('e1400000-0000-4000-8000-000000000301', 'x', true) ->> 'erro', 'execucao_nao_reservada',
  'registrar_followup numa execução já fechada volta ok falso');


-- =============================================================================
-- 8. Base de conhecimento do fluxo 1 (19.2)
-- =============================================================================

insert into agente.base_conhecimento (tipo, titulo, texto, fonte, status) values
  ('faq', 'P22 aprovado', 'Como funciona o cuidado nos primeiros dias em casa.', 'FAQ homologada', 'aprovado'),
  ('faq', 'P22 rascunho', 'Texto ainda em rascunho.', 'FAQ', 'rascunho'),
  ('depoimento', 'P22 arquivado', 'Depoimento arquivado.', 'Depoimento', 'arquivado');
create temp table t_base on commit drop as select * from agente.base_para_indexar();
select ok(exists (select 1 from t_base where titulo = 'P22 aprovado'), 'base_para_indexar traz o item aprovado');
select ok(not exists (select 1 from t_base where titulo in ('P22 rascunho', 'P22 arquivado')), 'base_para_indexar nunca traz rascunho nem arquivado');
select is((select count(*)::integer from t_base where tipo = 'plano'), 5, 'um documento por plano vigente');
select ok(not exists (select 1 from t_base where tipo = 'plano' and (texto like '%R$%' or texto ~ '[0-9]\.[0-9]{3}')),
  'documentos de plano sem valor (o valor vem da ficha)');
select ok(exists (select 1 from t_base where tipo = 'cobertura' and titulo = 'São Paulo' and texto like '%Alphaville%'),
  'um documento por praça com as localidades atendidas');
select ok(not exists (select 1 from t_base where tipo = 'cobertura' and texto like '%R$%'), 'documento de praça sem valor de taxa (C-17)');
select is_empty(
  $$ select tipo from t_base where tipo not in ('institucional', 'faq', 'objecao', 'politica', 'depoimento', 'equipe', 'cobertura', 'plano') $$,
  'base_para_indexar: nenhum tipo fora do tipo_conteudo (nada clínico)');
select is_empty(
  $$ select 1 from t_base where texto ~* '(sangramento|febre|conduta|alerta cl[ií]nico|dose)' $$,
  'base_para_indexar: nada clínico no conteúdo gerado');

-- troca atômica do lote
insert into agente_n8n.documentos (text, metadata, embedding) values
  ('antigo', '{"lote_id":"e1400000-0000-4000-8000-00000000a001"}', array_fill(0.1, array[1536])::extensions.vector),
  ('novo 1', '{"lote_id":"e1400000-0000-4000-8000-00000000b001"}', array_fill(0.2, array[1536])::extensions.vector),
  ('novo 2', '{"lote_id":"e1400000-0000-4000-8000-00000000b001"}', array_fill(0.3, array[1536])::extensions.vector);
select is(agente.promover_lote('e1400000-0000-4000-8000-00000000c001') ->> 'erro', 'lote_vazio', 'promover lote vazio: ok falso');
select is((select count(*)::integer from agente_n8n.documentos), 3, 'lote vazio nunca apaga a base que está valendo');
set local role n8n_agente;
select is((agente.promover_lote('e1400000-0000-4000-8000-00000000b001') ->> 'removidos')::integer, 1,
  'promover_lote (como n8n_agente) apaga só os lotes anteriores');
reset role;
select set_eq($$ select text from agente_n8n.documentos $$, $$ values ('novo 1'), ('novo 2') $$, 'depois de promover, só o lote novo');
select is((agente.descartar_lote('e1400000-0000-4000-8000-00000000b001') ->> 'removidos')::integer, 2, 'descartar_lote remove o lote');
select is((agente.registrar_ingestao('e1400000-0000-4000-8000-00000000b001', 2, 'ok', null) ->> 'ok')::boolean, true, 'registrar_ingestao ok');
select is((agente.registrar_ingestao('e1400000-0000-4000-8000-00000000b001', 0, 'falhou', 'OpenAI fora do ar') ->> 'ok')::boolean, true, 'registrar_ingestao falhou');
select set_eq($$ select status::text from agente.ingestao_execucao where lote_id = 'e1400000-0000-4000-8000-00000000b001' $$,
  $$ values ('ok'), ('falhou') $$, 'registrar_ingestao grava as duas execuções');
select is((agente.registrar_ingestao('e1400000-0000-4000-8000-00000000b001', 0, 'talvez', null) ->> 'ok')::boolean, false,
  'registrar_ingestao: status fora do enum volta ok falso');


-- =============================================================================
-- 9. eliminar_titular (PRD 21.3 [v4.2])
-- =============================================================================

-- a família Jade (com registro assistencial e alerta clínico no seed) ganha
-- conversa, mensagens, memória, transferência e tarefa
insert into conversa (id, wa_jid, telefone_e164, familia_id, classificacao, iniciada_por)
values ('e1400000-0000-4000-8000-000000000008', '5511900000313-teste@s.whatsapp.net', '+5511900000313', (select id from t_id where chave = 'fam_jade'), 'cliente', 'cliente');
insert into mensagem (conversa_id, direcao, enviado_por, conteudo) values
  ('e1400000-0000-4000-8000-000000000008', 'entrada', 'cliente', 'Oi, aqui é a Camila'),
  ('e1400000-0000-4000-8000-000000000008', 'saida', 'ia', 'Oi, Camila!');
insert into agente_n8n.chat_memoria (session_id, message) values
  ('e1400000-0000-4000-8000-000000000008', '{"type":"human","content":"Oi, aqui é a Camila"}'),
  ('e1400000-0000-4000-8000-000000000008', '{"type":"ai","content":"Oi, Camila!"}');
select is((agente.registrar_handoff('e1400000-0000-4000-8000-000000000008', 'pos_venda_operacao', 'dúvida', 'horário', '{}', 'agente', 'que horas?') ->> 'ok')::boolean,
  true, 'família com transferência antes da eliminação');
insert into tarefa (tipo, familia_id, titulo) values ('outro', (select id from t_id where chave = 'fam_jade'), 'tarefa da Jade');
create temp table t_antes on commit drop as
select (select count(*) from registro_atendimento) as registros,
       (select count(*) from alerta_clinico where familia_id = (select id from t_id where chave = 'fam_jade')) as alertas,
       (select count(*) from contrato where familia_id = (select id from t_id where chave = 'fam_jade')) as contratos;

-- só a diretoria com AAL2
select testes.autenticar_authenticated((select id from t_id where chave = 'perfil_comercial'), 'aal2');
select throws_ok(format('select api.eliminar_titular(%L, %L)', (select id from t_id where chave = 'fam_jade'), 'pedido do titular'), '42501', null,
  'eliminar_titular: comercial não elimina');
select testes.encerrar();
select testes.autenticar_authenticated((select id from t_id where chave = 'perfil_diretoria'), 'aal1');
select throws_ok(format('select api.eliminar_titular(%L, %L)', (select id from t_id where chave = 'fam_jade'), 'pedido do titular'), '42501', null,
  'eliminar_titular: diretoria sem MFA (aal1) não elimina');
select testes.encerrar();
set local role n8n_agente;
select throws_ok(format('select privado.eliminar_titular(%L, %L)', (select id from t_id where chave = 'fam_jade'), 'x'), '42501', null,
  'eliminar_titular: n8n_agente não chama');
reset role;

select testes.autenticar_authenticated((select id from t_id where chave = 'perfil_diretoria'), 'aal2');
select throws_ok(format('select api.eliminar_titular(%L, %L)', (select id from t_id where chave = 'fam_jade'), ''), '22023', null,
  'eliminar_titular exige motivo');
insert into t_r select 'elim', api.eliminar_titular((select id from t_id where chave = 'fam_jade'), 'pedido do titular por e-mail');
select testes.encerrar();

select is((select (r ->> 'ok')::boolean from t_r where chave = 'elim'), true, 'diretoria com AAL2 elimina');
select is((select count(*)::integer from agente_n8n.chat_memoria where session_id = 'e1400000-0000-4000-8000-000000000008'), 0,
  'eliminar_titular apaga a memória do agente');
select is((select count(*)::integer from mensagem where conversa_id = 'e1400000-0000-4000-8000-000000000008'), 0,
  'eliminar_titular apaga as mensagens');
select is((select count(*)::integer from handoff where familia_id = (select id from t_id where chave = 'fam_jade')), 0,
  'eliminar_titular apaga as transferências');
select is((select count(*)::integer from conversa where familia_id = (select id from t_id where chave = 'fam_jade')), 0,
  'eliminar_titular apaga as conversas');
select is((select count(*)::integer from tarefa where familia_id = (select id from t_id where chave = 'fam_jade')), 0,
  'eliminar_titular apaga as tarefas');
select results_eq(
  $$ select (select count(*) from registro_atendimento),
            (select count(*) from alerta_clinico where familia_id = (select id from t_id where chave = 'fam_jade')),
            (select count(*) from contrato where familia_id = (select id from t_id where chave = 'fam_jade')) $$,
  $$ select registros, alertas, contratos from t_antes $$,
  'eliminar_titular preserva o registro assistencial, o alerta clínico e o contrato');
select results_eq(
  $$ select f.nome_exibicao, f.dpp, f.data_nascimento, f.endereco_atendimento from familia f where f.id = (select id from t_id where chave = 'fam_jade') $$,
  $$ values ('Titular eliminado', null::date, null::date, null::jsonb) $$,
  'eliminar_titular anonimiza a família (nome, datas, endereço)');
select is_empty(
  $$ select 1 from pessoa where familia_id = (select id from t_id where chave = 'fam_jade')
       and (nome <> 'Titular eliminado' or telefone_e164 is not null or email is not null) $$,
  'eliminar_titular anonimiza as pessoas');
select is_empty(
  $$ select 1 from pessoa_dados_contrato d join pessoa p on p.id = d.pessoa_id
     where p.familia_id = (select id from t_id where chave = 'fam_jade') and (d.cpf is not null or d.endereco_residencial is not null) $$,
  'eliminar_titular apaga CPF e endereço de contrato');
select is_empty(
  $$ select 1 from evento_familia where familia_id = (select id from t_id where chave = 'fam_jade')
       and (titulo <> '[eliminado]' or dados <> to_jsonb('[eliminado]'::text)) $$,
  'eliminar_titular troca título e dados da linha do tempo por [eliminado]');
select results_eq(
  $$ select valor_depois from log_auditoria where acao = 'eliminacao_titular' and entidade_id = (select id from t_id where chave = 'fam_jade')::text $$,
  $$ values ('{"motivo":"pedido do titular por e-mail"}'::jsonb) $$,
  'eliminar_titular grava no log só o id e o motivo');

-- a exceção do gatilho vale só dentro da função
select throws_ok(
  format('update evento_familia set titulo = %L where familia_id = %L', 'x', (select id from t_id where chave = 'fam_aurora')),
  '42501', null, 'evento_familia continua append-only fora da eliminação');
select testes.autenticar_service_role();
do $$ begin perform set_config('app.eliminacao', (select id from t_id where chave = 'fam_aurora')::text, true); end $$;
select throws_ok(
  format('update evento_familia set titulo = %L, dados = %L where familia_id = %L', '[eliminado]', '"[eliminado]"', (select id from t_id where chave = 'fam_aurora')),
  '42501', null, 'service_role com app.eliminacao forjada continua recusado (só o dono, dentro da função)');
do $$ begin perform set_config('app.eliminacao', '', true); end $$;
select testes.encerrar();

select * from finish();

rollback;
