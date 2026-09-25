-- =============================================================================
-- supabase/tests/016_seguranca.sql
--
-- Migration 0016_seguranca (revisão de segurança de 25/09/2026,
-- docs/seguranca/revisao-2026-09-25.md). Cada bloco prova um ataque
-- bloqueado:
--   1. SEG-BANCO-01: privado.mascarar_documentos com 60 mil caracteres nos
--      formatos que derrubavam o banco ("1 1 1 ...", "1a1a...",
--      "1.1a1.1a...", "1-1-1...") termina em menos de 2 s cada (a versão da
--      0005 levava 15 s com 2 mil caracteres e horas com 16 mil), e a regra
--      da máscara continua a mesma.
--   2. SEG-BANCO-01: agente.registrar_mensagem, chamada como n8n_agente com
--      uma mensagem de 60 mil caracteres, responde rápido, grava no máximo
--      20 mil e avisa que cortou; o papel n8n_agente tem statement_timeout e
--      idle_in_transaction_session_timeout.
--   3. N8N-01: mensagens da equipe digitadas no celular para duas famílias,
--      com o LID do próprio número da Kraamzorg no evento, caem cada uma na
--      conversa da sua família, sem trocar jid, nome salvo nem LID.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(27);

create temp table t_tempo (caso text primary key, ms numeric, tamanho integer) on commit drop;
grant all on t_tempo to public;

create function pg_temp.medir(caso text, entrada text) returns void
  language plpgsql
  as $$
declare
  v_inicio timestamptz := clock_timestamp();
  v_saida  text;
begin
  v_saida := privado.mascarar_documentos(entrada);
  insert into t_tempo (caso, ms, tamanho)
  values (caso, extract(epoch from clock_timestamp() - v_inicio) * 1000, length(v_saida));
end;
$$;


-- =============================================================================
-- 1. Máscara em tempo linear (SEG-BANCO-01)
-- =============================================================================

select pg_temp.medir('espaco', repeat('1 ', 30000));
select pg_temp.medir('letra', repeat('1a', 30000));
select pg_temp.medir('ponto_letra', repeat('1.1a', 15000));
select pg_temp.medir('hifen', repeat('1-', 30000));
select pg_temp.medir('zeros', repeat('0 ', 30000));
select pg_temp.medir('cartoes', repeat('4111 1111 1111 1111 ', 3000));

select cmp_ok((select ms from t_tempo where caso = 'espaco'), '<', 2000::numeric,
  'SEG-BANCO-01: 60 mil caracteres "1 1 1 ..." mascarados em menos de 2 s');
select cmp_ok((select ms from t_tempo where caso = 'letra'), '<', 2000::numeric,
  'SEG-BANCO-01: 60 mil caracteres "1a1a..." mascarados em menos de 2 s');
select cmp_ok((select ms from t_tempo where caso = 'ponto_letra'), '<', 2000::numeric,
  'SEG-BANCO-01: 60 mil caracteres "1.1a1.1a..." mascarados em menos de 2 s');
select cmp_ok((select ms from t_tempo where caso = 'hifen'), '<', 2000::numeric,
  'SEG-BANCO-01: 60 mil caracteres "1-1-1..." mascarados em menos de 2 s');
select cmp_ok((select ms from t_tempo where caso = 'zeros'), '<', 2000::numeric,
  'SEG-BANCO-01: 60 mil caracteres "0 0 0 ..." (sequências que passam no Luhn) mascarados em menos de 2 s');
select cmp_ok((select ms from t_tempo where caso = 'cartoes'), '<', 2000::numeric,
  'SEG-BANCO-01: 3 mil cartões em grupos seguidos mascarados em menos de 2 s');
select is((select tamanho from t_tempo where caso = 'espaco'), 60000,
  'SEG-BANCO-01: texto sem cartão sai do mesmo tamanho (nada trocado)');
select is((select tamanho from t_tempo where caso = 'cartoes'), 3000 * length('[cartão ocultado] '),
  'SEG-BANCO-01: cada um dos 3 mil cartões vira "[cartão ocultado]"');

-- a regra continua a mesma da 0005
select is(privado.mascarar_documentos('pode passar no cartão 4111 1111 1111 1111 12/28 123'),
  'pode passar no cartão [cartão ocultado] [dado de cartão ocultado] 123',
  'regra: cartão em grupos seguido de validade no mesmo trecho continua ocultado');
select is(privado.mascarar_documentos('cartão 4111111111111111 12/28 cvv 123'),
  'cartão [cartão ocultado] [dado de cartão ocultado] cvv [dado de cartão ocultado]',
  'regra: cartão corrido seguido de validade e CVV');
select is(privado.mascarar_documentos('lista 1 2 4111 1111 1111 1111 3 e fim'),
  'lista 1 2 [cartão ocultado] 3 e fim',
  'regra: cartão no meio de outros grupos de dígitos é achado e só ele sai');
select is(privado.mascarar_documentos('whats +5511987654309 e cpf 111.444.777-35 e 11144477735'),
  'whats +5511987654309 e cpf [CPF ocultado] e [CPF ocultado]',
  'regra: telefone +55 fica; CPF formatado e corrido saem');
select is(privado.mascarar_documentos('1111111111111111111111 4111 1111 1111 1111'),
  '1111111111111111111111 [cartão ocultado]',
  'regra: grupo com mais de 19 dígitos fica e o cartão depois dele sai');
select is(privado.mascarar_trecho_cartao('11 98765-4321', ' '), '11 98765-4321',
  'regra: mascarar_trecho_cartao com menos de 13 dígitos devolve o trecho');
select is(privado.mascarar_trecho_cartao('5511987654309', '+'), '5511987654309',
  'regra: 13 dígitos começando por 55 depois de "+" é telefone, não cartão');


-- =============================================================================
-- 2. Teto de tamanho e de tempo no caminho do n8n (SEG-BANCO-01)
-- =============================================================================

update parametro set valor = '"producao"' where chave = 'agente_modo';

create temp table t_seg (chave text primary key, r jsonb, ms numeric) on commit drop;
grant all on t_seg to public;

set local role n8n_agente;
do $$
declare
  v_inicio timestamptz := clock_timestamp();
  v_r      jsonb;
begin
  v_r := agente.registrar_mensagem('5511900001690@s.whatsapp.net', 'entrada', 'cliente',
                                   repeat('1 ', 30000), 'texto', 'SEG-16-LONGA', null, '5511900001690', null, null);
  insert into t_seg values ('longa', v_r, extract(epoch from clock_timestamp() - v_inicio) * 1000);
end $$;
reset role;

select is((select (r ->> 'ok')::boolean from t_seg where chave = 'longa'), true,
  'SEG-BANCO-01: mensagem de 60 mil caracteres "1 1 1 ..." registrada como n8n_agente');
select cmp_ok((select ms from t_seg where chave = 'longa'), '<', 3000::numeric,
  'SEG-BANCO-01: registrar_mensagem com 60 mil caracteres responde em menos de 3 s (antes: horas)');
select is((select (r ->> 'conteudo_cortado')::boolean from t_seg where chave = 'longa'), true,
  'SEG-BANCO-01: registrar_mensagem avisa que cortou o conteúdo');
select is((select length(conteudo) from mensagem where wa_message_id = 'SEG-16-LONGA'), 20000,
  'SEG-BANCO-01: conteúdo gravado com no máximo 20 mil caracteres');
select ok(
  exists (select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
          where r.rolname = 'n8n_agente' and 'statement_timeout=10s' = any (s.setconfig))
  and exists (select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
              where r.rolname = 'n8n_agente' and 'idle_in_transaction_session_timeout=30s' = any (s.setconfig)),
  'SEG-BANCO-01: n8n_agente com statement_timeout 10s e idle_in_transaction_session_timeout 30s');


-- =============================================================================
-- 3. Mensagem da equipe com o LID do próprio número (N8N-01)
--
-- Dono da instância: LID sintético 999000000016000@lid. As famílias A e B
-- escrevem primeiro; depois a equipe digita no celular para A e para B, e o
-- evento fromMe chega só com o LID do dono (sem chatlid).
-- =============================================================================

set local role n8n_agente;
insert into t_seg (chave, r)
values ('ent_a', agente.registrar_mensagem('5511900001601@s.whatsapp.net', 'entrada', 'cliente', 'oi, sou a família A',
                                           'texto', 'SEG-16-A1', 'Familia A', '5511900001601', null, 'Teste A paciente potencial')),
       ('ent_b', agente.registrar_mensagem('5511900001602@s.whatsapp.net', 'entrada', 'cliente', 'oi, sou a família B',
                                           'texto', 'SEG-16-B1', 'Familia B', '5511900001602', null, 'Teste B paciente fechada'));
insert into t_seg (chave, r)
values ('sai_a', agente.registrar_mensagem('5511900001601@s.whatsapp.net', 'saida', 'humano', 'Mensagem da equipe para A',
                                           'texto', 'SEG-16-A2', null, '5511900001601', '999000000016000@lid', 'Teste A paciente potencial'));
insert into t_seg (chave, r)
values ('sai_b', agente.registrar_mensagem('5511900001602@s.whatsapp.net', 'saida', 'humano', 'Mensagem da equipe para B',
                                           'texto', 'SEG-16-B2', null, '5511900001602', '999000000016000@lid', 'Teste B paciente fechada'));
insert into t_seg (chave, r)
values ('sai_d', agente.registrar_mensagem('5511900001604@s.whatsapp.net', 'saida', 'humano', 'Primeira mensagem para D',
                                           'texto', 'SEG-16-D1', null, '5511900001604', '999000000016000@lid', null));
reset role;

select is((select (r ->> 'conversa_id')::uuid from t_seg where chave = 'sai_a'),
          (select (r ->> 'conversa_id')::uuid from t_seg where chave = 'ent_a'),
  'N8N-01: mensagem da equipe para A cai na conversa de A');
select is((select (r ->> 'conversa_id')::uuid from t_seg where chave = 'sai_b'),
          (select (r ->> 'conversa_id')::uuid from t_seg where chave = 'ent_b'),
  'N8N-01: mensagem da equipe para B cai na conversa de B, mesmo com o LID do dono igual ao da mensagem para A');
select is(
  (select conversa_id from mensagem where wa_message_id = 'SEG-16-B2'),
  (select (r ->> 'conversa_id')::uuid from t_seg where chave = 'ent_b'),
  'N8N-01: o texto para B não fica no histórico de A');
select results_eq(
  $$ select wa_jid, nome_contato_salvo, classificacao::text from conversa
     where id = (select (r ->> 'conversa_id')::uuid from t_seg where chave = 'ent_a') $$,
  $$ values ('5511900001601@s.whatsapp.net', 'Teste A paciente potencial', 'lead') $$,
  'N8N-01: A continua com o próprio jid, nome salvo e classificação');
select is(
  (select wa_jid from conversa where id = (select (r ->> 'conversa_id')::uuid from t_seg where chave = 'ent_b')),
  '5511900001602@s.whatsapp.net',
  'N8N-01: B não perde o jid para a conversa de A');
select ok(
  (select (r ->> 'conversa_id')::uuid from t_seg where chave = 'sai_d')
    not in ((select (r ->> 'conversa_id')::uuid from t_seg where chave = 'ent_a'),
            (select (r ->> 'conversa_id')::uuid from t_seg where chave = 'ent_b')),
  'N8N-01: primeira mensagem da equipe para uma família nova abre conversa própria, sem cair em A pelo LID do dono');

-- a família A escreve de novo com o LID dela: o LID da família substitui o
-- que a mensagem da equipe tinha deixado
set local role n8n_agente;
insert into t_seg (chave, r)
values ('ent_a2', agente.registrar_mensagem('5511900001601@s.whatsapp.net', 'entrada', 'cliente', 'obrigada',
                                            'texto', 'SEG-16-A3', 'Familia A', '5511900001601', '900000001601000@lid', null));
reset role;
select is(
  (select wa_lid from conversa where id = (select (r ->> 'conversa_id')::uuid from t_seg where chave = 'ent_a')),
  '900000001601000@lid',
  'N8N-01: na entrada, o LID da própria família substitui o que estava guardado');

select * from finish();

rollback;
