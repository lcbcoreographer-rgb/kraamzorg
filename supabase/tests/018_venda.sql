-- =============================================================================
-- supabase/tests/018_venda.sql
--
-- Migration 0018_venda (P29 sessão de venda, P30 proposta e formulário
-- seguro):
--   1. sessao_venda sem insert nem mudança de estado direto do app.
--   2. api.condutores_sessao_venda e api.sessoes_venda (agenda).
--   3. api.agendar_sessao_venda: P1, lembrete da véspera sem duplicar o
--      motor, transferência reuniao fechada sem devolver à Isadora, recusas.
--   4. api.remarcar_sessao_venda e api.registrar_desfecho_sessao_venda:
--      P1, tarefas nao_compareceu e pos_sessao_48h, freio.
--   5. Gravação: só quem conduziu e a diretoria, AAL2, consentimento com a
--      versão do termo, transcrição, resumo, retirada do consentimento.
--   6. Proposta: conta no banco, condição, aprovação da diretoria, presente,
--      P1 para P2.
--   7. Link do formulário: token de uso único (só o hash guardado), P2 até
--      ganho, tarefa sem o link.
--   8. Formulário público: só service_role, abrir, corrigir, receber, uso
--      único, vencido, limite de tentativas, CPF fora do log.
--   9. Privilégios.
--
-- Só dado sintético, criado aqui e desfeito no rollback. DPPs em 2033 e
-- telefones próprios, para não cruzar com o seed.
-- =============================================================================

begin;

select plan(144);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a1800000-0000-4000-8000-000000000001', 'comercial.p29@exemplo.invalid'),
  ('a1800000-0000-4000-8000-000000000002', 'comercial2.p29@exemplo.invalid'),
  ('a1800000-0000-4000-8000-000000000003', 'coordenacao.p29@exemplo.invalid'),
  ('a1800000-0000-4000-8000-000000000004', 'diretoria.p29@exemplo.invalid'),
  ('a1800000-0000-4000-8000-000000000005', 'financeiro.p29@exemplo.invalid'),
  ('a1800000-0000-4000-8000-000000000006', 'enfermeira.p29@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a1800000-0000-4000-8000-000000000001', 'Otávio Teste Comercial',  'comercial.p29@exemplo.invalid',   true),
  ('a1800000-0000-4000-8000-000000000002', 'Perfil Teste Comercial 2', 'comercial2.p29@exemplo.invalid', true),
  ('a1800000-0000-4000-8000-000000000003', 'Beatriz Teste Coordenação', 'coordenacao.p29@exemplo.invalid', true),
  ('a1800000-0000-4000-8000-000000000004', 'Perfil Teste Diretoria P29', 'diretoria.p29@exemplo.invalid', true),
  ('a1800000-0000-4000-8000-000000000005', 'Perfil Teste Financeiro P29', 'financeiro.p29@exemplo.invalid', true),
  ('a1800000-0000-4000-8000-000000000006', 'Perfil Teste Enfermeira P29', 'enfermeira.p29@exemplo.invalid', true);

insert into usuario_papel (usuario_id, papel) values
  ('a1800000-0000-4000-8000-000000000001', 'comercial'),
  ('a1800000-0000-4000-8000-000000000002', 'comercial'),
  ('a1800000-0000-4000-8000-000000000003', 'coordenacao'),
  ('a1800000-0000-4000-8000-000000000004', 'diretoria'),
  ('a1800000-0000-4000-8000-000000000005', 'financeiro'),
  ('a1800000-0000-4000-8000-000000000006', 'enfermeira');

-- parâmetros com os valores do seed (o teste não depende do seed ter rodado)
insert into parametro (chave, valor) values
  ('sessao_venda_retorno_horas', '48'),
  ('sessao_gravacao', '{"termo_versao":"1-teste","transcricao_max_caracteres":5000}'),
  ('formulario_contrato', '{"validade_horas":72,"duracao_minutos":3,"tentativas_max":10,"tentativas_janela_minutos":15}'),
  ('termo_lgpd_contrato_versao', '"lgpd-teste-1"'),
  ('contrato_template_versao', '"C-11 teste"')
on conflict (chave) do update set valor = excluded.valor;
update automacao set ativa = true where id = 'lembrete_sessao';

create temp table t_r (chave text primary key, r jsonb) on commit drop;
grant all on t_r to public;

-- cidade com taxa a confirmar (a do seed, Santo André, ou uma sintética)
insert into cidade (id, nome, uf, atendida, requer_confirmacao, taxa_deslocamento_centavos)
values ('c1890000-0000-4000-8000-000000000001', 'Cidade Teste P30', 'SP', true, true, 35000);

insert into familia (id, nome_exibicao, dpp, estado_sensivel, cidade_id) values
  ('c1800000-0000-4000-8000-000000000001', 'Família Teste Agenda Um',     '2033-01-10', 'normal', null),
  ('c1800000-0000-4000-8000-000000000002', 'Família Teste Agenda Dois',   '2033-01-12', 'normal', null),
  ('c1800000-0000-4000-8000-000000000003', 'Família Teste Agenda Novo',   '2033-01-14', 'normal', null),
  ('c1800000-0000-4000-8000-000000000004', 'Família Teste Agenda Freio',  '2033-01-16', 'bloqueio_total', null),
  ('c1800000-0000-4000-8000-000000000005', 'Família Teste Desfecho',      '2033-02-10', 'normal', null),
  ('c1800000-0000-4000-8000-000000000006', 'Família Teste Faltou',        '2033-02-12', 'normal', null),
  ('c1800000-0000-4000-8000-000000000007', 'Família Teste Atencao',       '2033-02-14', 'atencao', null),
  ('c1800000-0000-4000-8000-000000000011', 'Família Teste Proposta',      '2033-03-10', 'normal', 'c1890000-0000-4000-8000-000000000001'),
  ('c1800000-0000-4000-8000-000000000012', 'Família Teste Presente',      '2033-03-12', 'normal', null),
  ('c1800000-0000-4000-8000-000000000013', 'Família Teste Vence',         '2033-03-14', 'normal', null);

insert into pessoa (id, familia_id, papel, nome, telefone_e164, contato_principal) values
  ('d1800000-0000-4000-8000-000000000001', 'c1800000-0000-4000-8000-000000000001', 'mae', 'Helena Teste Agenda',     '+5511900000801', true),
  ('d1800000-0000-4000-8000-000000000002', 'c1800000-0000-4000-8000-000000000002', 'mae', 'Clara Teste Agenda',      '+5511900000802', true),
  ('d1800000-0000-4000-8000-000000000005', 'c1800000-0000-4000-8000-000000000005', 'mae', 'Luiza Teste Desfecho',    '+5511900000805', true),
  ('d1800000-0000-4000-8000-000000000006', 'c1800000-0000-4000-8000-000000000006', 'mae', 'Sofia Teste Faltou',      '+5511900000806', true),
  ('d1800000-0000-4000-8000-000000000007', 'c1800000-0000-4000-8000-000000000007', 'mae', 'Alice Teste Atencao',     '+5511900000807', true),
  ('d1800000-0000-4000-8000-000000000011', 'c1800000-0000-4000-8000-000000000011', 'mae', 'Marina Teste Proposta',   '+5511900000811', true),
  ('d1800000-0000-4000-8000-000000000012', 'c1800000-0000-4000-8000-000000000011', 'parceiro', 'Rafael Teste Proposta', '+5511900000812', false),
  ('d1800000-0000-4000-8000-000000000013', 'c1800000-0000-4000-8000-000000000012', 'mae', 'Joana Teste Presente',    '+5511900000813', true),
  ('d1800000-0000-4000-8000-000000000014', 'c1800000-0000-4000-8000-000000000013', 'mae', 'Tereza Teste Vence',      '+5511900000814', true);

insert into oportunidade (id, familia_id, pipeline, estagio_p1, estagio_p2, desconto_pct, responsavel_id) values
  ('e1800000-0000-4000-8000-000000000001', 'c1800000-0000-4000-8000-000000000001', 1, 'qualificado',            null, 0, 'a1800000-0000-4000-8000-000000000001'),
  ('e1800000-0000-4000-8000-000000000002', 'c1800000-0000-4000-8000-000000000002', 1, 'em_conversa_ia',         null, 0, null),
  ('e1800000-0000-4000-8000-000000000003', 'c1800000-0000-4000-8000-000000000003', 1, 'novo',                   null, 0, null),
  ('e1800000-0000-4000-8000-000000000004', 'c1800000-0000-4000-8000-000000000004', 1, 'qualificado',            null, 0, null),
  ('e1800000-0000-4000-8000-000000000005', 'c1800000-0000-4000-8000-000000000005', 1, 'sessao_venda_agendada',  null, 0, 'a1800000-0000-4000-8000-000000000001'),
  ('e1800000-0000-4000-8000-000000000006', 'c1800000-0000-4000-8000-000000000006', 1, 'sessao_venda_agendada',  null, 0, 'a1800000-0000-4000-8000-000000000001'),
  ('e1800000-0000-4000-8000-000000000007', 'c1800000-0000-4000-8000-000000000007', 1, 'sessao_venda_agendada',  null, 0, 'a1800000-0000-4000-8000-000000000001'),
  ('e1800000-0000-4000-8000-000000000011', 'c1800000-0000-4000-8000-000000000011', 1, 'sessao_venda_realizada', null, 0, 'a1800000-0000-4000-8000-000000000001'),
  ('e1800000-0000-4000-8000-000000000012', 'c1800000-0000-4000-8000-000000000012', 1, 'qualificado',            null, 0, 'a1800000-0000-4000-8000-000000000001'),
  ('e1800000-0000-4000-8000-000000000013', 'c1800000-0000-4000-8000-000000000013', 1, 'qualificado',            null, 0, 'a1800000-0000-4000-8000-000000000001');

-- conversa em humano_comercial e transferência reuniao com as duas opções
insert into conversa (id, wa_jid, telefone_e164, familia_id, classificacao, iniciada_por, agente_encerrado_em, agente_encerrado_motivo) values
  ('f1800000-0000-4000-8000-000000000001', '5511900000801@s.whatsapp.net', '+5511900000801',
   'c1800000-0000-4000-8000-000000000001', 'lead', 'cliente', now() - interval '1 hour', 'reuniao');
insert into handoff (id, conversa_id, familia_id, motivo, destino, prioridade, resumo, dados, status) values
  ('f1810000-0000-4000-8000-000000000001', 'f1800000-0000-4000-8000-000000000001', 'c1800000-0000-4000-8000-000000000001',
   'reuniao', 'comercial', 'alta', 'Quer a conversa com a coordenação.',
   '{"opcoes":["quinta à noite","sábado de manhã"]}', 'aberto');

-- sessões no passado (desfecho) e uma futura (atenção), criadas pelo dono
insert into sessao_venda (id, familia_id, agendada_para, conduzida_por, link_reuniao, status) values
  ('b1800000-0000-4000-8000-000000000005', 'c1800000-0000-4000-8000-000000000005', now() - interval '2 hours',
   'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/desfecho', 'agendada'),
  ('b1800000-0000-4000-8000-000000000006', 'c1800000-0000-4000-8000-000000000006', now() - interval '3 hours',
   'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/faltou', 'agendada'),
  ('b1800000-0000-4000-8000-000000000007', 'c1800000-0000-4000-8000-000000000007', now() - interval '1 hours',
   'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/atencao', 'agendada');

-- auxiliares do teste (no schema testes, que os papéis simulados executam;
-- desfeitas no rollback)
create function testes.venda_amanha_as(hora text) returns timestamptz language sql stable as $$
  select (((now() at time zone 'America/Sao_Paulo')::date + 1) + hora::time) at time zone 'America/Sao_Paulo'
$$;
create function testes.venda_afetadas(p_sql text) returns integer language plpgsql as $$
declare
  v_n integer;
begin
  execute p_sql;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
create function testes.venda_leituras(p_entidade text, p_entidade_id text) returns bigint language sql as $$
  select count(*) from public.log_auditoria where acao = 'leitura' and entidade = p_entidade and entidade_id = p_entidade_id
$$;


-- -----------------------------------------------------------------------------
-- 1. sessao_venda sem escrita direta de estado
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(
  $s$ insert into sessao_venda (familia_id, status) values ('c1800000-0000-4000-8000-000000000001', 'agendada') $s$,
  '42501', null, 'comercial não inclui sessão direto (agendar é função, P29)');
select throws_ok(
  $s$ update sessao_venda set status = 'realizada' where id = 'b1800000-0000-4000-8000-000000000005' $s$,
  '42501', null, 'comercial não muda o estado da sessão direto');
select is(
  testes.venda_afetadas($s$ update sessao_venda set link_reuniao = 'https://meet.exemplo.invalid/novo' where id = 'b1800000-0000-4000-8000-000000000005' $s$),
  1, 'comercial ainda edita o link da reunião direto');
select testes.encerrar();
update sessao_venda set link_reuniao = 'https://meet.exemplo.invalid/desfecho' where id = 'b1800000-0000-4000-8000-000000000005';


-- -----------------------------------------------------------------------------
-- 2. condutores e agenda
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal1');
select ok(
  exists (select 1 from api.condutores_sessao_venda() where id = 'a1800000-0000-4000-8000-000000000003'),
  'condutores: a coordenação aparece');
select ok(
  not exists (select 1 from api.condutores_sessao_venda() where id = 'a1800000-0000-4000-8000-000000000001'),
  'condutores: o comercial não conduz');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ select * from api.sessoes_venda() $s$, '42501', null, 'agenda: enfermeira é recusada');
select testes.encerrar();
select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select * from api.sessoes_venda() $s$, '42501', null, 'agenda: financeiro é recusado');
select testes.encerrar();


-- -----------------------------------------------------------------------------
-- 3. agendar
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal1');
select throws_like(
  $s$ select api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000001', now() - interval '1 hour',
        'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/um') $s$,
  '%venda:data_no_passado%', 'agendar: data no passado é recusada');
select throws_like(
  $s$ select api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000001', testes.venda_amanha_as('20:00'),
        'a1800000-0000-4000-8000-000000000003', null) $s$,
  '%venda:link_obrigatorio%', 'agendar: sem link é recusado (o lembrete leva o acesso)');
select throws_like(
  $s$ select api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000001', testes.venda_amanha_as('20:00'),
        'a1800000-0000-4000-8000-000000000003', 'http://meet.exemplo.invalid/um') $s$,
  '%venda:link_invalido%', 'agendar: link sem https é recusado');
select throws_like(
  $s$ select api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000001', testes.venda_amanha_as('20:00'),
        'a1800000-0000-4000-8000-000000000002', 'https://meet.exemplo.invalid/um') $s$,
  '%venda:condutor_invalido%', 'agendar: comercial não conduz');
select throws_like(
  $s$ select api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000004', testes.venda_amanha_as('20:00'),
        'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/freio') $s$,
  '%venda:familia_em_estado_sensivel%', 'agendar: família em bloqueio total é recusada');
select throws_like(
  $s$ select api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000003', testes.venda_amanha_as('20:00'),
        'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/novo') $s$,
  '%venda:estagio_nao_permite_sessao%', 'agendar: lead ainda novo não tem sessão');

insert into t_r values ('agendar', api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000001', testes.venda_amanha_as('20:00'),
  'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/um', null, 'f1810000-0000-4000-8000-000000000001'));
select is((select r ->> 'estagio_p1' from t_r where chave = 'agendar'), 'sessao_venda_agendada',
  'agendar: P1 qualificado para sessao_venda_agendada');
select throws_like(
  $s$ select api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000001', testes.venda_amanha_as('21:00'),
        'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/um') $s$,
  '%venda:sessao_ja_agendada%', 'agendar: segunda sessão agendada é recusada (remarcar é outra função)');
insert into t_r values ('agendar2', api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000002', now() + interval '10 days',
  'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/dois'));
select is((select r ->> 'estagio_p1' from t_r where chave = 'agendar2'), 'sessao_venda_agendada',
  'agendar: em conversa com a IA passa por qualificado e chega a sessao_venda_agendada');
select is((select count(*)::integer from api.sessoes_venda(null, null, 'c1800000-0000-4000-8000-000000000001')), 1,
  'agenda: o comercial vê a sessão marcada');
select is((select conduzida_por_nome from api.sessoes_venda(null, null, 'c1800000-0000-4000-8000-000000000001')),
  'Beatriz Teste Coordenação', 'agenda: nome de quem conduz vem junto (perfil não tem leitura cruzada)');
select is((select pode_ver_gravacao from api.sessoes_venda(null, null, 'c1800000-0000-4000-8000-000000000001')), false,
  'agenda: o comercial que não conduz não pode ver a gravação');
select is((select gravacao_registrada from api.sessoes_venda(null, null, 'c1800000-0000-4000-8000-000000000001')), null,
  'agenda: nem sabe se há gravação');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000003', 'aal1');
select throws_ok(
  $s$ select api.agendar_sessao_venda('c1800000-0000-4000-8000-000000000013', testes.venda_amanha_as('20:00'),
        'a1800000-0000-4000-8000-000000000003', 'https://meet.exemplo.invalid/x') $s$,
  '42501', null, 'agendar: coordenação conduz, mas não move o P1 (agendar é do comercial e da diretoria)');
select testes.encerrar();

select is((select status::text from handoff where id = 'f1810000-0000-4000-8000-000000000001'), 'resolvido',
  'agendar: a transferência reuniao fecha');
select is((select dados ->> 'desfecho' from handoff where id = 'f1810000-0000-4000-8000-000000000001'), 'sessao_marcada',
  'agendar: com o desfecho sessao_marcada');
select ok((select agente_encerrado_em is not null from conversa where id = 'f1800000-0000-4000-8000-000000000001'),
  'agendar: a conversa continua em humano_comercial (a Isadora não volta)');
select is((select opcoes_informadas from sessao_venda where familia_id = 'c1800000-0000-4000-8000-000000000001'),
  'quinta à noite ou sábado de manhã', 'agendar: as opções que a família passou vêm da transferência');

select is((select count(*)::integer from tarefa
           where familia_id = 'c1800000-0000-4000-8000-000000000001' and payload ->> 'mensagemChave' = 'lembrete_sessao'), 1,
  'lembrete: uma tarefa na véspera');
select ok((select payload ->> 'textoSugerido' like 'Oi, Helena! Amanhã, às 20:00,%' from tarefa
           where familia_id = 'c1800000-0000-4000-8000-000000000001' and payload ->> 'mensagemChave' = 'lembrete_sessao'),
  'lembrete: texto do 23.2 com o primeiro nome e a hora');
select ok((select payload ->> 'textoSugerido' like '%https://meet.exemplo.invalid/um%' from tarefa
           where familia_id = 'c1800000-0000-4000-8000-000000000001' and payload ->> 'mensagemChave' = 'lembrete_sessao'),
  'lembrete: com o link da reunião');
select is((select vence_em from tarefa
           where familia_id = 'c1800000-0000-4000-8000-000000000001' and payload ->> 'mensagemChave' = 'lembrete_sessao'),
  testes.venda_amanha_as('20:00') - interval '1 day', 'lembrete: vence 24 horas antes');
select is((select payload ->> 'telefoneE164' from tarefa
           where familia_id = 'c1800000-0000-4000-8000-000000000001' and payload ->> 'mensagemChave' = 'lembrete_sessao'),
  '+5511900000801', 'lembrete: telefone do contato principal para o link do WhatsApp');
select is(privado.materializar_lembrete_sessao(), 0,
  'lembrete: o motor (0012) não cria um segundo lembrete na véspera');
select is((select count(*)::integer from tarefa
           where familia_id = 'c1800000-0000-4000-8000-000000000002' and payload ->> 'mensagemChave' = 'lembrete_sessao'), 1,
  'lembrete: sessão daqui a dez dias também ganha o seu');
select ok(exists (select 1 from evento_familia where familia_id = 'c1800000-0000-4000-8000-000000000001' and tipo = 'sessao'),
  'agendar: evento na linha do tempo');
select ok(exists (select 1 from log_auditoria where acao = 'sessao_venda_agendada'
                  and valor_depois ->> 'familia_id' = 'c1800000-0000-4000-8000-000000000001'),
  'agendar: log de auditoria');


-- -----------------------------------------------------------------------------
-- 4. remarcar e desfecho
-- -----------------------------------------------------------------------------

insert into t_r select 'sessao_um', to_jsonb(s.id) from sessao_venda s
  where s.familia_id = 'c1800000-0000-4000-8000-000000000001' and s.status = 'agendada';

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal1');
select throws_like(
  format($s$ select api.registrar_desfecho_sessao_venda(%L, 'realizada') $s$, (select r #>> '{}' from t_r where chave = 'sessao_um')),
  '%venda:sessao_ainda_nao_aconteceu%', 'desfecho: realizada antes do horário é recusada');
insert into t_r values ('remarcar', api.remarcar_sessao_venda((select (r #>> '{}')::uuid from t_r where chave = 'sessao_um'),
  now() + interval '5 days'));
select testes.encerrar();

select is((select status::text from sessao_venda where id = (select (r #>> '{}')::uuid from t_r where chave = 'sessao_um')),
  'remarcada', 'remarcar: a sessão antiga vira remarcada');
select is((select status::text from sessao_venda where id = (select (r ->> 'sessao_id')::uuid from t_r where chave = 'remarcar')),
  'agendada', 'remarcar: nasce outra agendada');
select is((select link_reuniao from sessao_venda where id = (select (r ->> 'sessao_id')::uuid from t_r where chave = 'remarcar')),
  'https://meet.exemplo.invalid/um', 'remarcar: o link continua');
select is((select status::text from tarefa where payload ->> 'sessao_venda_id' = (select r #>> '{}' from t_r where chave = 'sessao_um')),
  'cancelada', 'remarcar: o lembrete antigo é cancelado');
select is((select count(*)::integer from tarefa where payload ->> 'sessao_venda_id' = (select r ->> 'sessao_id' from t_r where chave = 'remarcar')
             and status = 'aberta'), 1, 'remarcar: o lembrete novo nasce');
select is((select estagio_p1::text from oportunidade where id = 'e1800000-0000-4000-8000-000000000001'),
  'sessao_venda_agendada', 'remarcar: o P1 continua em sessao_venda_agendada');

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal1');
insert into t_r values ('realizada', api.registrar_desfecho_sessao_venda('b1800000-0000-4000-8000-000000000005', 'realizada', true));
insert into t_r values ('faltou', api.registrar_desfecho_sessao_venda('b1800000-0000-4000-8000-000000000006', 'nao_compareceu'));
insert into t_r values ('atencao', api.registrar_desfecho_sessao_venda('b1800000-0000-4000-8000-000000000007', 'realizada'));
insert into t_r values ('cancelar', api.registrar_desfecho_sessao_venda((select (r ->> 'sessao_id')::uuid from t_r where chave = 'agendar2'), 'cancelada'));
select throws_like(
  $s$ select api.registrar_desfecho_sessao_venda('b1800000-0000-4000-8000-000000000005', 'nao_compareceu') $s$,
  '%venda:sessao_nao_agendada%', 'desfecho: sessão já registrada não muda de novo');
select testes.encerrar();

select is((select estagio_p1::text from oportunidade where id = 'e1800000-0000-4000-8000-000000000005'),
  'sessao_venda_realizada', 'realizada: P1 para sessao_venda_realizada');
select is((select realizada_em from sessao_venda where id = 'b1800000-0000-4000-8000-000000000005'),
  (select agendada_para from sessao_venda where id = 'b1800000-0000-4000-8000-000000000005'), 'realizada: realizada_em é o horário marcado');
select is((select parceiro_presente from sessao_venda where id = 'b1800000-0000-4000-8000-000000000005'), true,
  'realizada: parceiro presente registrado');
select is((select vence_em from tarefa where familia_id = 'c1800000-0000-4000-8000-000000000005' and payload ->> 'mensagemChave' = 'pos_sessao_48h'),
  (select agendada_para + interval '48 hours' from sessao_venda where id = 'b1800000-0000-4000-8000-000000000005'),
  'realizada: tarefa pos_sessao_48h vence 48 horas depois (parâmetro)');
select ok((select payload ->> 'textoSugerido' like 'Oi, Luiza!%' from tarefa
           where familia_id = 'c1800000-0000-4000-8000-000000000005' and payload ->> 'mensagemChave' = 'pos_sessao_48h'),
  'realizada: texto pos_sessao_48h com o primeiro nome');
select is((select estagio_p1::text from oportunidade where id = 'e1800000-0000-4000-8000-000000000006'),
  'qualificado', 'não compareceu: P1 volta para qualificado');
select is((select count(*)::integer from tarefa where familia_id = 'c1800000-0000-4000-8000-000000000006' and payload ->> 'mensagemChave' = 'nao_compareceu'),
  1, 'não compareceu: tarefa com o texto nao_compareceu');
select is((select count(*)::integer from tarefa where familia_id = 'c1800000-0000-4000-8000-000000000007' and payload ->> 'mensagemChave' = 'pos_sessao_48h'),
  0, 'família em atenção: sem tarefa de conteúdo depois da conversa (freio)');
select is((select estagio_p1::text from oportunidade where id = 'e1800000-0000-4000-8000-000000000002'),
  'qualificado', 'cancelada: P1 volta para qualificado');
select is((select status::text from tarefa where payload ->> 'sessao_venda_id' = (select r ->> 'sessao_id' from t_r where chave = 'agendar2')),
  'cancelada', 'cancelada: o lembrete é cancelado');


-- -----------------------------------------------------------------------------
-- 5. gravação, consentimento, transcrição e resumo
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(
  $s$ select api.registrar_gravacao_sessao_venda('b1800000-0000-4000-8000-000000000005', true, 'Texto de teste.') $s$,
  '42501', null, 'gravação: comercial que não conduziu não grava, nem em aal2');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000003', 'aal1');
select throws_ok(
  $s$ select api.registrar_gravacao_sessao_venda('b1800000-0000-4000-8000-000000000005', true, 'Texto de teste.') $s$,
  '42501', null, 'gravação: quem conduziu em aal1 é recusada (AAL2)');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000003', 'aal2');
select throws_like(
  $s$ select api.registrar_gravacao_sessao_venda('b1800000-0000-4000-8000-000000000005', false, 'Texto de teste.') $s$,
  '%venda:sem_consentimento%', 'gravação: transcrição sem consentimento é recusada');
select throws_like(
  format($s$ select api.registrar_gravacao_sessao_venda('b1800000-0000-4000-8000-000000000005', true, %L) $s$, repeat('a', 5001)),
  '%venda:transcricao_longa%', 'gravação: transcrição acima do limite do parâmetro é recusada');
insert into t_r values ('gravar', api.registrar_gravacao_sessao_venda('b1800000-0000-4000-8000-000000000005', true,
  'Coordenação: como vocês imaginam os primeiros dias? Família: a gente tem medo da amamentação e acha o valor alto.'));
select is((select r ->> 'termo_versao' from t_r where chave = 'gravar'), '1-teste', 'gravação: consentimento com a versão do termo');
select is(api.sessao_venda_gravacao('b1800000-0000-4000-8000-000000000005') ->> 'consentimento_versao', '1-teste',
  'gravação: quem conduziu lê a própria sessão');
select lives_ok(
  $s$ select api.salvar_resumo_sessao_venda('b1800000-0000-4000-8000-000000000005',
        '{"duvidas":["Como é a amamentação nos primeiros dias?"],"objecoes":["Achou o valor alto."],"plano_interesse":"Imersão","proximos_passos":["Mandar a proposta."],"origem":"ia","modelo":"modelo-teste"}') $s$,
  'resumo: quem conduziu salva o resumo revisado');
select throws_like(
  $s$ select api.salvar_resumo_sessao_venda('b1800000-0000-4000-8000-000000000005', '{"duvidas":"texto solto"}') $s$,
  '%venda:resumo_invalido%', 'resumo: fora do formato é recusado');
select is(api.sessao_venda_gravacao('b1800000-0000-4000-8000-000000000005') #>> '{resumo,objecoes,0}', 'Achou o valor alto.',
  'resumo: gravado no formato da tela');
select is((select gravacao_registrada from api.sessoes_venda(null, null, null, 'b1800000-0000-4000-8000-000000000005')), true,
  'agenda: quem conduziu em aal2 vê que há gravação');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000004', 'aal2');
select is(api.sessao_venda_gravacao('b1800000-0000-4000-8000-000000000005') #>> '{resumo,plano_interesse}', 'Imersão',
  'gravação: a diretoria lê');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.sessao_venda_gravacao('b1800000-0000-4000-8000-000000000005') $s$, '42501', null,
  'aceite P29: comercial que não conduziu não vê a gravação');
select testes.encerrar();

select ok(testes.venda_leituras('sessao_venda_gravacao', (select id::text from sessao_venda_gravacao where sessao_id = 'b1800000-0000-4000-8000-000000000005')) >= 2,
  'gravação: cada leitura fica registrada no log');
select ok(not exists (select 1 from log_auditoria where coalesce(valor_depois::text, '') || coalesce(valor_antes::text, '') ~ 'medo da amamentação|Achou o valor alto'),
  'gravação: o log não guarda a transcrição nem o resumo');

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000003', 'aal2');
select lives_ok($s$ select api.registrar_gravacao_sessao_venda('b1800000-0000-4000-8000-000000000005', true, 'Transcrição nova de teste.') $s$,
  'gravação: transcrição nova');
select is(api.sessao_venda_gravacao('b1800000-0000-4000-8000-000000000005') -> 'resumo', 'null'::jsonb,
  'gravação: transcrição nova apaga o resumo antigo');
select lives_ok($s$ select api.registrar_gravacao_sessao_venda('b1800000-0000-4000-8000-000000000005', false) $s$,
  'gravação: a família retira o consentimento');
select is(api.sessao_venda_gravacao('b1800000-0000-4000-8000-000000000005') ->> 'transcricao', null,
  'gravação: retirar o consentimento apaga a transcrição');
select testes.encerrar();


-- -----------------------------------------------------------------------------
-- 6. proposta
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.proposta('e1800000-0000-4000-8000-000000000011') $s$, '42501', null,
  'proposta: comercial em aal1 é recusado (contrato é financeiro, AAL2)');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
insert into t_r values ('proposta0', api.proposta('e1800000-0000-4000-8000-000000000011'));
select is((select jsonb_array_length(r -> 'pacotes') from t_r where chave = 'proposta0'), 5, 'proposta: cinco pacotes vigentes');
select is((select (r #>> '{familia,cidade,taxa_centavos}')::integer from t_r where chave = 'proposta0'), 35000,
  'proposta: taxa da cidade');
select is((select (r #>> '{familia,cidade,requer_confirmacao}')::boolean from t_r where chave = 'proposta0'), true,
  'proposta: taxa a confirmar marcada');
select is((select r -> 'contrato' from t_r where chave = 'proposta0'), 'null'::jsonb, 'proposta: ainda sem contrato');

insert into t_r select 'imersao', to_jsonb(pv.id) from pacote_versao pv join pacote p on p.id = pv.pacote_id
  where p.nome = 'Imersão' and pv.vigencia_fim is null;
insert into t_r select 'essencial', to_jsonb(pv.id) from pacote_versao pv join pacote p on p.id = pv.pacote_id
  where p.nome = 'Essencial' and pv.vigencia_fim is null;
insert into t_r select 'pix', to_jsonb(c.id) from condicao_comercial c where c.nome = 'Pix à vista';

select throws_like(
  format($s$ select api.salvar_proposta('e1800000-0000-4000-8000-000000000011', %L, 4) $s$, (select r #>> '{}' from t_r where chave = 'imersao')),
  '%venda:parcelas_fora_da_condicao%', 'proposta: 4 parcelas sem condição de parcelamento é recusada');
select throws_like(
  format($s$ select api.salvar_proposta('e1800000-0000-4000-8000-000000000011', %L, 3, null, 'propria', null, null, 10) $s$, (select r #>> '{}' from t_r where chave = 'imersao')),
  '%venda:desconto_sem_motivo%', 'proposta: desconto manual sem motivo é recusado');
insert into t_r values ('salvar', api.salvar_proposta('e1800000-0000-4000-8000-000000000011', (select (r #>> '{}')::uuid from t_r where chave = 'imersao'), 3));
select is((select r #> '{conta}' from t_r where chave = 'salvar'),
  '{"valor_centavos":780000,"taxa_centavos":35000,"desconto_centavos":0,"total_centavos":815000,"parcelas":3,"parcela_centavos":271666,"primeira_parcela_centavos":271668}'::jsonb,
  'proposta: conta no banco (Imersão R$ 7.800 mais taxa R$ 350, 3x; o resto na primeira)');
select is((select r ->> 'precisa_aprovacao' from t_r where chave = 'salvar'), 'false', 'proposta: sem condição especial, sem aprovação');
select testes.encerrar();

select is((select estagio_p2::text || '/' || pipeline from oportunidade where id = 'e1800000-0000-4000-8000-000000000011'),
  'proposta_enviada/2', 'proposta: P1 sessao_venda_realizada para P2 proposta_enviada');
select is((select status::text from contrato where familia_id = 'c1800000-0000-4000-8000-000000000011'), 'rascunho',
  'proposta: contrato em rascunho');
select is((select testemunha_pessoa_id from contrato where familia_id = 'c1800000-0000-4000-8000-000000000011'),
  'd1800000-0000-4000-8000-000000000012'::uuid, 'proposta: parceiro como testemunha (prática atual)');
select is((select template_versao from contrato where familia_id = 'c1800000-0000-4000-8000-000000000011'), 'C-11 teste',
  'proposta: versão do modelo de contrato do parâmetro');

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
insert into t_r values ('pix_salvo', api.salvar_proposta('e1800000-0000-4000-8000-000000000011',
  (select (r #>> '{}')::uuid from t_r where chave = 'imersao'), 1, (select (r #>> '{}')::uuid from t_r where chave = 'pix')));
select is((select (r #>> '{conta,desconto_centavos}')::integer from t_r where chave = 'pix_salvo'), 39000,
  'proposta: Pix 5% sobre o pacote (a taxa fica fora do desconto)');
select is((select r ->> 'precisa_aprovacao' from t_r where chave = 'pix_salvo'), 'true', 'proposta: Pix exige aprovação (C-04)');
select throws_like($s$ select api.gerar_link_formulario_contrato('e1800000-0000-4000-8000-000000000011') $s$,
  '%venda:desconto_sem_aprovacao%', 'formulário: condição sem aprovação da diretoria não segue');
select throws_ok($s$ select api.aprovar_desconto('e1800000-0000-4000-8000-000000000011') $s$, '42501', null,
  'aprovação: comercial não aprova o próprio desconto');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000004', 'aal2');
select lives_ok($s$ select api.aprovar_desconto('e1800000-0000-4000-8000-000000000011') $s$, 'aprovação: a diretoria aprova');
select testes.encerrar();
select is((select desconto_aprovado_por from oportunidade where id = 'e1800000-0000-4000-8000-000000000011'),
  'a1800000-0000-4000-8000-000000000004'::uuid, 'aprovação: registrada com quem aprovou');

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
insert into t_r values ('troca', api.salvar_proposta('e1800000-0000-4000-8000-000000000011',
  (select (r #>> '{}')::uuid from t_r where chave = 'essencial'), 1, (select (r #>> '{}')::uuid from t_r where chave = 'pix')));
select is((select r ->> 'desconto_aprovado' from t_r where chave = 'troca'), 'false',
  'aprovação: trocar o pacote depois de aprovado apaga a aprovação');
select testes.encerrar();
select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000004', 'aal2');
select lives_ok($s$ select api.aprovar_desconto('e1800000-0000-4000-8000-000000000011') $s$, 'aprovação: a diretoria aprova de novo');
select testes.encerrar();

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  format($s$ select api.salvar_proposta('e1800000-0000-4000-8000-000000000012', %L, 3, null, 'presente') $s$, (select r #>> '{}' from t_r where chave = 'imersao')),
  '%venda:presente_sem_pagador%', 'presente: sem quem paga é recusado');
insert into t_r values ('presente', api.salvar_proposta('e1800000-0000-4000-8000-000000000012',
  (select (r #>> '{}')::uuid from t_r where chave = 'imersao'), 3, null, 'presente', null, 'Ana Teste Presenteadora'));
select testes.encerrar();
select is((select p.papel::text from contrato k join pessoa p on p.id = k.pagador_pessoa_id
           where k.familia_id = 'c1800000-0000-4000-8000-000000000012'), 'presenteador',
  'presente: quem paga nasce como presenteador e vai no contrato (C-10)');
select is((select contratante_pessoa_id from contrato where familia_id = 'c1800000-0000-4000-8000-000000000012'),
  'd1800000-0000-4000-8000-000000000013'::uuid, 'presente: o contrato continua no nome da gestante');

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000005', 'aal2');
select is((api.proposta('e1800000-0000-4000-8000-000000000011') #>> '{contrato,conta,total_centavos}')::integer, 434000,
  'proposta: o financeiro lê a proposta da família com contrato');
select throws_ok(
  format($s$ select api.salvar_proposta('e1800000-0000-4000-8000-000000000011', %L, 1) $s$, (select r #>> '{}' from t_r where chave = 'essencial')),
  '42501', null, 'proposta: o financeiro não grava');
select testes.encerrar();


-- -----------------------------------------------------------------------------
-- 7. link do formulário
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
insert into t_r values ('link', api.gerar_link_formulario_contrato('e1800000-0000-4000-8000-000000000011'));
select ok((select length(r ->> 'token') >= 40 from t_r where chave = 'link'), 'link: token com 32 bytes aleatórios');
select is((select r ->> 'estagio_p2' from t_r where chave = 'link'), 'ganho', 'link: a família aceitou, P2 até ganho');
insert into t_r values ('link_presente', api.salvar_proposta('e1800000-0000-4000-8000-000000000012',
  (select (r #>> '{}')::uuid from t_r where chave = 'imersao'), 3, null, 'presente',
  (select pagador_pessoa_id from oportunidade where id = 'e1800000-0000-4000-8000-000000000012')));
insert into t_r values ('link2', api.gerar_link_formulario_contrato('e1800000-0000-4000-8000-000000000012'));
insert into t_r values ('vence', api.salvar_proposta('e1800000-0000-4000-8000-000000000013',
  (select (r #>> '{}')::uuid from t_r where chave = 'essencial'), 3));
insert into t_r values ('link3', api.gerar_link_formulario_contrato('e1800000-0000-4000-8000-000000000013'));
select testes.encerrar();

select is((select formulario_token_hash from contrato where familia_id = 'c1800000-0000-4000-8000-000000000011'),
  encode(extensions.digest((select r ->> 'token' from t_r where chave = 'link'), 'sha256'), 'hex'),
  'link: só o sha256 do token fica no contrato');
select is((select status::text from contrato where familia_id = 'c1800000-0000-4000-8000-000000000011'), 'aguardando_dados',
  'link: contrato aguardando os dados');
select ok((select formulario_expira_em between now() + interval '71 hours' and now() + interval '73 hours'
           from contrato where familia_id = 'c1800000-0000-4000-8000-000000000011'), 'link: validade do parâmetro (72 horas)');
select ok((select payload ->> 'acao' = 'formulario_contrato' and not (payload::text like '%' || (select r ->> 'token' from t_r where chave = 'link') || '%')
           from tarefa where familia_id = 'c1800000-0000-4000-8000-000000000011' and tipo = 'enviar_formulario_contrato'),
  'link: tarefa enviar_formulario_contrato sem o link');
select ok(not exists (select 1 from log_auditoria where valor_depois::text like '%' || (select r ->> 'token' from t_r where chave = 'link') || '%'),
  'link: o token não vai para o log');
update contrato set formulario_expira_em = now() - interval '1 minute' where familia_id = 'c1800000-0000-4000-8000-000000000013';


-- -----------------------------------------------------------------------------
-- 8. formulário público
-- -----------------------------------------------------------------------------

select testes.autenticar_anon();
select throws_ok(format($s$ select public.formulario_contrato_abrir(%L) $s$, (select r ->> 'token' from t_r where chave = 'link')),
  '42501', null, 'formulário: anon não chama a função direto (só o servidor)');
select testes.encerrar();
select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(format($s$ select public.formulario_contrato_abrir(%L) $s$, (select r ->> 'token' from t_r where chave = 'link')),
  '42501', null, 'formulário: authenticated também não');
select testes.encerrar();

select testes.autenticar_service_role();
insert into t_r values ('abrir', public.formulario_contrato_abrir((select r ->> 'token' from t_r where chave = 'link'), '203.0.113.10'));
select is((select r ->> 'situacao' from t_r where chave = 'abrir'), 'valido', 'formulário: link válido abre');
select is((select r #>> '{textos,abertura}' from t_r where chave = 'abrir'),
  'Oi, Marina. Otávio pediu estes dados para preparar o contrato de vocês. Leva uns 3 minutos.',
  'formulário: abertura com o primeiro nome, quem pediu e os minutos do parâmetro');
select is((select r ->> 'termo_versao' from t_r where chave = 'abrir'), 'lgpd-teste-1', 'formulário: versão do consentimento');
select is((select r #>> '{testemunha,nome}' from t_r where chave = 'abrir'), 'Rafael Teste Proposta', 'formulário: testemunha sugerida');
select ok((select not (r -> 'gestante' ? 'cpf') and r::text !~ '[0-9]{3}\.[0-9]{3}\.[0-9]{3}' from t_r where chave = 'abrir'),
  'formulário: nada de CPF na abertura');
select is(public.formulario_contrato_abrir('token-que-nao-existe-de-jeito-nenhum', '203.0.113.10') ->> 'situacao', 'invalido',
  'formulário: token inexistente é inválido');
select is(public.formulario_contrato_abrir((select r ->> 'token' from t_r where chave = 'link3'), '203.0.113.10') ->> 'situacao', 'invalido',
  'aceite P30: link vencido é inválido');

insert into t_r values ('corrigir', public.formulario_contrato_enviar((select r ->> 'token' from t_r where chave = 'link'),
  '{"gestante":{"nome_completo":"Marina","cpf":"123.456.789-00","data_nascimento":"2090-01-01","email":"sem-arroba",
    "endereco":{"cep":"123","logradouro":"R","numero":"","bairro":"","cidade":"","uf":"S"}},
    "consentimento":{"aceito":false,"versao":"lgpd-teste-1"}}', '203.0.113.10'));
select is((select r ->> 'situacao' from t_r where chave = 'corrigir'), 'corrigir', 'formulário: dados errados voltam para corrigir');
select ok((select r -> 'erros' ?& array['gestante.nome_completo', 'gestante.cpf', 'gestante.data_nascimento', 'gestante.email',
                                       'gestante.endereco', 'consentimento'] from t_r where chave = 'corrigir'),
  'formulário: cada campo errado vem marcado (CPF com dígito verificador inválido)');
select ok((select r::text not like '%123.456.789%' from t_r where chave = 'corrigir'), 'formulário: o erro nunca devolve o valor digitado');

insert into t_r values ('enviar', public.formulario_contrato_enviar((select r ->> 'token' from t_r where chave = 'link'),
  '{"gestante":{"nome_completo":"Marina Teste Proposta Completa","cpf":"111.444.777-35","data_nascimento":"1994-05-17","email":"Marina.Teste@exemplo.invalid",
    "endereco":{"cep":"04567-000","logradouro":"Rua Teste das Flores","numero":"120","complemento":"apto 31","bairro":"Moema","cidade":"São Paulo","uf":"sp"}},
    "atendimento_no_mesmo_endereco":false,
    "endereco_atendimento":{"cep":"04100-000","logradouro":"Rua Teste dos Avós","numero":"45","bairro":"Vila Mariana","cidade":"São Paulo","uf":"SP"},
    "testemunha":{"nome_completo":"Rafael Teste Proposta","email":"rafael@exemplo.invalid"},
    "consentimento":{"aceito":true,"versao":"lgpd-teste-1"}}', '203.0.113.10'));
select is((select r ->> 'situacao' from t_r where chave = 'enviar'), 'recebido', 'formulário: dados recebidos');
select is(public.formulario_contrato_enviar((select r ->> 'token' from t_r where chave = 'link'), '{}', '203.0.113.11') ->> 'situacao', 'invalido',
  'aceite P30: o token funciona uma vez (segundo envio é inválido)');
select is(public.formulario_contrato_abrir((select r ->> 'token' from t_r where chave = 'link'), '203.0.113.11') ->> 'situacao', 'invalido',
  'aceite P30: e o link não abre mais');
select testes.encerrar();

select is((select cpf from pessoa_dados_contrato where pessoa_id = 'd1800000-0000-4000-8000-000000000011'), '11144477735',
  'formulário: CPF guardado em pessoa_dados_contrato (só dígitos)');
select is((select endereco_residencial ->> 'uf' from pessoa_dados_contrato where pessoa_id = 'd1800000-0000-4000-8000-000000000011'), 'SP',
  'formulário: endereço residencial limpo');
select is((select endereco_atendimento ->> 'logradouro' from familia where id = 'c1800000-0000-4000-8000-000000000011'), 'Rua Teste dos Avós',
  'formulário: endereço de atendimento diferente da residência');
select is((select consentimentos #>> '{lgpd_contrato,versao}' from pessoa where id = 'd1800000-0000-4000-8000-000000000011'), 'lgpd-teste-1',
  'formulário: consentimento LGPD com a versão do termo');
select is((select nome from pessoa where id = 'd1800000-0000-4000-8000-000000000011'), 'Marina Teste Proposta Completa',
  'formulário: nome completo da gestante');
select ok((select formulario_token_hash is null and formulario_expira_em <= now() from contrato where familia_id = 'c1800000-0000-4000-8000-000000000011'),
  'formulário: o hash some e a data vira a do envio');
select is((select status::text from tarefa where familia_id = 'c1800000-0000-4000-8000-000000000011' and tipo = 'enviar_formulario_contrato'),
  'concluida', 'formulário: a tarefa do envio fecha');
select ok(exists (select 1 from notificacao where usuario_id = 'a1800000-0000-4000-8000-000000000001'
                  and titulo = 'Dados do contrato recebidos pelo formulário seguro'),
  'formulário: quem pediu é avisado, sem nome de família no título');
select ok(not exists (select 1 from log_auditoria
                      where coalesce(valor_antes::text, '') || coalesce(valor_depois::text, '') ~ '11144477735|111\.444\.777-35'),
  'aceite P30: o CPF nunca aparece em log_auditoria');
select ok(exists (select 1 from log_auditoria where entidade = 'pessoa_dados_contrato' and valor_depois ->> 'cpf' = '[oculto]'),
  'formulário: a gravação do CPF é auditada como [oculto]');

select testes.autenticar_authenticated('a1800000-0000-4000-8000-000000000001', 'aal2');
select is(api.dados_contrato('d1800000-0000-4000-8000-000000000011', false) ->> 'cpf', '***.444.777-**',
  'formulário: o comercial vê o CPF mascarado');
select is(api.proposta('e1800000-0000-4000-8000-000000000011') #>> '{contrato,formulario,situacao}', 'recebido',
  'proposta: situação do formulário recebido');
select throws_like($s$ select api.gerar_link_formulario_contrato('e1800000-0000-4000-8000-000000000011') $s$,
  '%venda:formulario_ja_recebido%', 'link: depois de recebido, não gera outro');
select testes.encerrar();

-- presente: o formulário pede os dados de quem paga
select testes.autenticar_service_role();
select is(public.formulario_contrato_abrir((select r ->> 'token' from t_r where chave = 'link2'), '203.0.113.20') ->> 'pede_pagador', 'true',
  'presente: o formulário pede quem paga');
select ok(public.formulario_contrato_enviar((select r ->> 'token' from t_r where chave = 'link2'),
  '{"gestante":{"nome_completo":"Joana Teste Presente","cpf":"111.444.777-35","data_nascimento":"1990-01-01","email":"joana@exemplo.invalid",
    "endereco":{"cep":"01000-000","logradouro":"Rua Teste","numero":"1","bairro":"Centro","cidade":"São Paulo","uf":"SP"}},
    "pagador":{"nome_completo":"Ana Teste Presenteadora","cpf":"111.444.777-35","email":"ana@exemplo.invalid",
    "endereco":{"cep":"01000-000","logradouro":"Rua Teste","numero":"2","bairro":"Centro","cidade":"São Paulo","uf":"SP"}},
    "consentimento":{"aceito":true,"versao":"lgpd-teste-1"}}', '203.0.113.20') -> 'erros' ? 'pagador.cpf',
  'presente: CPF de quem paga igual ao da gestante é recusado');

-- limite de tentativas por origem
update parametro set valor = '{"validade_horas":72,"duracao_minutos":3,"tentativas_max":3,"tentativas_janela_minutos":15}'
  where chave = 'formulario_contrato';
select is(public.formulario_contrato_abrir('outro-token-que-nao-existe-aaaaa', '198.51.100.7') ->> 'situacao', 'invalido', 'limite: primeira recusa');
select is(public.formulario_contrato_abrir('outro-token-que-nao-existe-bbbbb', '198.51.100.7') ->> 'situacao', 'invalido', 'limite: segunda recusa');
select is(public.formulario_contrato_abrir('outro-token-que-nao-existe-ccccc', '198.51.100.7') ->> 'situacao', 'invalido', 'limite: terceira recusa');
select is(public.formulario_contrato_abrir((select r ->> 'token' from t_r where chave = 'link2'), '198.51.100.7') ->> 'situacao', 'limite',
  'aceite P30: passou do limite, nem o link certo abre dessa origem');
select is(public.formulario_contrato_abrir((select r ->> 'token' from t_r where chave = 'link2'), '198.51.100.8') ->> 'situacao', 'valido',
  'limite: outra origem continua abrindo');
select testes.encerrar();
select ok(not exists (select 1 from privado.formulario_tentativa where origem_hmac like '%198.51.100%'),
  'limite: o IP nunca é gravado (só o HMAC)');


-- -----------------------------------------------------------------------------
-- 9. privilégios
-- -----------------------------------------------------------------------------

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'api'
       and p.proname in ('condutores_sessao_venda', 'sessoes_venda', 'agendar_sessao_venda', 'remarcar_sessao_venda',
                         'registrar_desfecho_sessao_venda', 'registrar_gravacao_sessao_venda', 'salvar_resumo_sessao_venda',
                         'proposta', 'salvar_proposta', 'aprovar_desconto', 'gerar_link_formulario_contrato')
       and (not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)
            or not has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'as onze funções api da venda: security definer, search_path vazio, só authenticated');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'api'
     and p.proname in ('condutores_sessao_venda', 'sessoes_venda', 'agendar_sessao_venda', 'remarcar_sessao_venda',
                       'registrar_desfecho_sessao_venda', 'registrar_gravacao_sessao_venda', 'salvar_resumo_sessao_venda',
                       'proposta', 'salvar_proposta', 'aprovar_desconto', 'gerar_link_formulario_contrato')),
  11, 'as onze funções api da venda existem');
select ok(
  has_function_privilege('service_role', 'public.formulario_contrato_abrir(text, text)', 'execute')
  and has_function_privilege('service_role', 'public.formulario_contrato_enviar(text, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.formulario_contrato_enviar(text, jsonb, text)', 'execute')
  and not has_function_privilege('anon', 'public.formulario_contrato_enviar(text, jsonb, text)', 'execute'),
  'formulário público: só service_role executa');
select ok(
  not has_table_privilege('authenticated', 'privado.formulario_tentativa', 'select')
  and not has_table_privilege('service_role', 'privado.formulario_tentativa', 'select'),
  'privado.formulario_tentativa sem privilégio nenhum para o app');
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'privado' and (p.proname like 'venda\_%' or p.proname like 'formulario\_%')
       and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'auxiliares privado.venda_* e privado.formulario_* sem execute para o app');

select * from finish();
rollback;
