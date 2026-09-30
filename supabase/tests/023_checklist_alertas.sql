-- =============================================================================
-- supabase/tests/023_checklist_alertas.sql
--
-- Migration 0023_checklist_alertas (P39 checklist diário e registro
-- append-only, P40 alertas clínicos):
--   1. Assinatura: json canônico e hash iguais aos do aparelho (vetor de
--      referência calculado em TypeScript, src/lib/checklist/assinatura.test.ts).
--   2. registro_atendimento: um por visita, sem update nem delete, nem para o
--      dono; sem select direto para o app.
--   3. api.registrar_atendimento: quem assina, assinatura conferida, obrigatórios
--      do instrumento aprovado (PRD 9.2 v4.2), visita a ficha_entregue, reenvio
--      idêntico e divergente.
--   4. Alertas reavaliados pelo servidor, aviso à coordenação, ocorrência
--      privada de saúde mental imediata, registro do DOC 3 feito na visita.
--   5. Último dia: contatos dos médicos, tarefa obter_contato_medico, evolução
--      bloqueada.
--   6. Adendo com motivo; o original não muda.
--   7. api.checklist_visita: recortes por papel e leitura auditada.
--   8. Alerta clínico: registrar, acionamento, fechar só com os quatro campos.
--   9. Áudio da visita: caminho, limites, retenção, URL de 60 s, transcrição
--      desligada.
--  10. Regras alinhadas ao DOC 2, parâmetros e privilégios.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(140);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2300000-0000-4000-8000-000000000001', 'enfermeira.p39@exemplo.invalid'),
  ('a2300000-0000-4000-8000-000000000002', 'enfermeira2.p39@exemplo.invalid'),
  ('a2300000-0000-4000-8000-000000000003', 'coordenacao.p39@exemplo.invalid'),
  ('a2300000-0000-4000-8000-000000000004', 'diretoria.p39@exemplo.invalid'),
  ('a2300000-0000-4000-8000-000000000005', 'comercial.p39@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a2300000-0000-4000-8000-000000000001', 'Enfermeira Teste P39',   'enfermeira.p39@exemplo.invalid', true),
  ('a2300000-0000-4000-8000-000000000002', 'Enfermeira Dois P39',    'enfermeira2.p39@exemplo.invalid', true),
  ('a2300000-0000-4000-8000-000000000003', 'Coordenação Teste P39',  'coordenacao.p39@exemplo.invalid', true),
  ('a2300000-0000-4000-8000-000000000004', 'Diretoria Teste P39',    'diretoria.p39@exemplo.invalid', true),
  ('a2300000-0000-4000-8000-000000000005', 'Comercial Teste P39',    'comercial.p39@exemplo.invalid', true);

insert into usuario_papel (usuario_id, papel) values
  ('a2300000-0000-4000-8000-000000000001', 'enfermeira'),
  ('a2300000-0000-4000-8000-000000000002', 'enfermeira'),
  ('a2300000-0000-4000-8000-000000000003', 'coordenacao'),
  ('a2300000-0000-4000-8000-000000000004', 'diretoria'),
  ('a2300000-0000-4000-8000-000000000005', 'comercial');

insert into parametro (chave, valor) values
  ('acesso_enfermeira_pos_encerramento_dias', '7'),
  ('seletor_sinais_doc3_ativo', 'false'),
  ('retencao_audio_dias', '90'),
  ('audio_visita', '{"duracao_max_seg":600,"tamanho_max_bytes":1000,"tipos":["audio/webm"]}'),
  ('audio_url_assinada_segundos', '60'),
  ('contato_medico_tarefa', '{"prazo_horas":24}')
on conflict (chave) do update set valor = excluded.valor;

insert into pacote (id, nome, dias) values ('b2300000-0000-4000-8000-000000000003', 'Pacote Teste P39', 3);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2300000-0000-4000-8000-000000000004', 'b2300000-0000-4000-8000-000000000003', 100, 6, '2020-01-01');

insert into profissional (id, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero) values
  ('d2300000-0000-4000-8000-000000000001', 'a2300000-0000-4000-8000-000000000001', 'Enfermeira Teste P39', 'enfermeira_obstetrica', 'COREN', 'SP', '000123'),
  ('d2300000-0000-4000-8000-000000000002', 'a2300000-0000-4000-8000-000000000002', 'Enfermeira Dois P39',  'enfermeira_neonatal', 'COREN', 'SP', '000456');

insert into familia (id, nome_exibicao, dpp, data_nascimento, data_alta) values
  ('c2300000-0000-4000-8000-000000000001', 'Família Teste Aurora P39', '2033-01-10', '2033-01-05', '2033-01-07'),
  ('c2300000-0000-4000-8000-000000000002', 'Família Teste Brisa P39',  '2033-01-12', '2033-01-06', '2033-01-08'),
  ('c2300000-0000-4000-8000-000000000003', 'Família Teste Céu P39',    '2033-01-14', '2033-01-07', '2033-01-09');

insert into bebe (id, familia_id, ordem, nome, peso_nascimento_g) values
  ('e2300000-0000-4000-8000-000000000001', 'c2300000-0000-4000-8000-000000000001', 1, 'Bebê Um P39', 3300),
  ('e2300000-0000-4000-8000-000000000002', 'c2300000-0000-4000-8000-000000000002', 1, 'Bebê Dois P39', 3100),
  ('e2300000-0000-4000-8000-000000000003', 'c2300000-0000-4000-8000-000000000003', 1, 'Bebê Três P39', 3000);

insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao) values
  ('c2300000-0000-4000-8000-000000000041', 'c2300000-0000-4000-8000-000000000001', 'b2300000-0000-4000-8000-000000000004', 100, 'teste'),
  ('c2300000-0000-4000-8000-000000000042', 'c2300000-0000-4000-8000-000000000002', 'b2300000-0000-4000-8000-000000000004', 100, 'teste'),
  ('c2300000-0000-4000-8000-000000000043', 'c2300000-0000-4000-8000-000000000003', 'b2300000-0000-4000-8000-000000000004', 100, 'teste');

insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, estado) values
  ('d2300000-0000-4000-8000-000000000011', 'c2300000-0000-4000-8000-000000000041', 'c2300000-0000-4000-8000-000000000001', 3, 6, 'em_execucao'),
  ('d2300000-0000-4000-8000-000000000012', 'c2300000-0000-4000-8000-000000000042', 'c2300000-0000-4000-8000-000000000002', 3, 6, 'em_execucao'),
  ('d2300000-0000-4000-8000-000000000013', 'c2300000-0000-4000-8000-000000000043', 'c2300000-0000-4000-8000-000000000003', 3, 6, 'em_execucao');

insert into designacao (acompanhamento_id, profissional_id, papel, status) values
  ('d2300000-0000-4000-8000-000000000011', 'd2300000-0000-4000-8000-000000000001', 'titular', 'aceita'),
  ('d2300000-0000-4000-8000-000000000012', 'd2300000-0000-4000-8000-000000000001', 'titular', 'aceita'),
  ('d2300000-0000-4000-8000-000000000013', 'd2300000-0000-4000-8000-000000000002', 'titular', 'aceita');

-- Aurora: D1 concluída com registro, D2 iniciada, D3 (último dia) iniciada.
-- Brisa: D3 iniciada (último dia, sem médico). Céu: da outra enfermeira.
-- Visita agendada de Aurora para o teste de estado.
insert into visita (id, acompanhamento_id, profissional_id, dia_numero, data, estado, checkin_em) values
  ('f2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000011', 'd2300000-0000-4000-8000-000000000001', 1, '2033-01-08', 'ficha_entregue', now() - interval '3 days'),
  ('f2300000-0000-4000-8000-000000000002', 'd2300000-0000-4000-8000-000000000011', 'd2300000-0000-4000-8000-000000000001', 2, '2033-01-09', 'iniciada', now() - interval '2 hours'),
  ('f2300000-0000-4000-8000-000000000003', 'd2300000-0000-4000-8000-000000000011', 'd2300000-0000-4000-8000-000000000001', 3, '2033-01-10', 'iniciada', now() - interval '1 hours'),
  ('f2300000-0000-4000-8000-000000000004', 'd2300000-0000-4000-8000-000000000012', 'd2300000-0000-4000-8000-000000000001', 3, '2033-01-10', 'iniciada', now() - interval '1 hours'),
  ('f2300000-0000-4000-8000-000000000005', 'd2300000-0000-4000-8000-000000000013', 'd2300000-0000-4000-8000-000000000002', 1, '2033-01-10', 'iniciada', now() - interval '1 hours'),
  ('f2300000-0000-4000-8000-000000000006', 'd2300000-0000-4000-8000-000000000011', 'd2300000-0000-4000-8000-000000000001', 4, '2033-01-11', 'agendada', null);

-- Auxiliares do teste (schema testes; desfeitas no rollback).
-- Registro completo (todos os obrigatórios do DOC 2 v1 para um bebê).
create function testes.dados_completos(p_bebe uuid, p_temp numeric default 36.6, p_ultimo boolean default false,
                                       p_extra jsonb default '{}'::jsonb)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    '1', jsonb_build_object('data', '2033-01-09', 'horario', '09:30'),
    '2.1', jsonb_build_object('pressao_arterial', jsonb_build_object('partes', jsonb_build_object('sistolica', 120, 'diastolica', 80)),
                              'temperatura', p_temp, 'frequencia_cardiaca', 78),
    '2.5', jsonb_build_object('turgidas_ou_secretantes', true, 'flacidas', false, 'ingurgitadas', false),
    '2.6', jsonb_build_object('dor_mamilos_amamentar', false, 'evn', 0, 'intervencoes_para_dor', 'Nenhuma'),
    '2.7', jsonb_build_object('lesao_mamilar', 'nao', 'nts', 0, 'interrupcao_adequada_succao', true),
    '2.8', jsonb_build_object('latch', jsonb_build_object('valor', 9, 'complemento', 'otimo'), 'teste_da_linguinha', 'normal'),
    '2.9', jsonb_build_object('fbm_aplicada', jsonb_build_array('nao_aplicada')),
    '2.10', jsonb_build_object('bicos_artificiais', false, 'forros_e_conchas', false, 'bomba_de_extracao', false),
    '2.11', jsonb_build_object('succoes_por_dia', 'mais_de_8'),
    '2.12', jsonb_build_object('producao_de_leite', 'normal'),
    '2.13', jsonb_build_object('sente_se_apoiada', 8, 'quem_mais_apoia', 'Parceiro'),
    '3.1', jsonb_build_array(jsonb_build_object('bebe_id', p_bebe, 'temperatura', 36.8, 'frequencia_cardiaca', 130,
                                               'frequencia_respiratoria', 40, 'peso', 3240))
  ) || case when p_ultimo then jsonb_build_object('ultimo_dia', jsonb_build_object(
                'contato_obstetra', 'Dra. Teste (11) 91234-5678',
                'contato_pediatra', jsonb_build_object('ausente', true, 'justificativa', 'A família não tinha o número'),
                'resumo_encerramento', 'Encerramento sintético.')) else '{}'::jsonb end
    || p_extra
$$;

create temp table t_r (chave text primary key, r jsonb) on commit drop;
grant all on t_r to public;

create function testes.ms() returns bigint language sql immutable as $$ select 1790000000123::bigint $$;

create function testes.assinatura(p_dados jsonb, p_resumo text, p_prof uuid) returns text
  language sql stable security definer set search_path = '' as $$
  select privado.hash_registro(p_dados, p_resumo, p_prof, pg_catalog.to_timestamp(0) + testes.ms() * interval '1 millisecond')
$$;

create function testes.registrar(p_visita uuid, p_dados jsonb, p_resumo text, p_prof uuid, p_alertas jsonb default '[]'::jsonb)
returns jsonb language sql volatile as $$
  select api.registrar_atendimento(p_visita, p_dados, p_resumo, testes.ms(),
                                   testes.assinatura(p_dados, p_resumo, p_prof), 'v1-2026-09', null, p_alertas)
$$;

create function testes.leituras(p_entidade text) returns bigint language sql stable as $$
  select count(*) from public.log_auditoria where acao = 'leitura' and entidade = p_entidade
$$;

-- -----------------------------------------------------------------------------
-- 1. Assinatura: json canônico e hash
-- -----------------------------------------------------------------------------

select is(
  privado.json_canonico('{"b":1,"a":{"z":[1,2],"c":"x"}}'::jsonb),
  '{"a":{"c":"x","z":[1,2]},"b":1}',
  'json canônico: chaves em ordem, sem espaço');

select is(
  privado.hash_registro(
    '{"1":{"data":"2026-09-29","horario":"09:30"},"b":"ação \"x\"\n","a":[1,2.5,null,true],"2.1":{"temperatura":38.2,"pressao_arterial":{"partes":{"sistolica":120,"diastolica":80}}}}'::jsonb,
    'Resumo de teste', 'd2300000-0000-4000-8000-000000000001', to_timestamp(0) + 1790000000123 * interval '1 millisecond'),
  'b21e5941d4eacc3b6c9c3b768ee1631267a08a6b6e405f8b7a7e64a3f04a7064',
  'hash: igual ao vetor calculado em TypeScript no aparelho (assinatura.test.ts)');

select isnt(
  privado.hash_registro('{"a":1}'::jsonb, 'r', 'd2300000-0000-4000-8000-000000000001', to_timestamp(0)),
  privado.hash_registro('{"a":2}'::jsonb, 'r', 'd2300000-0000-4000-8000-000000000001', to_timestamp(0)),
  'hash: mudar um dado muda a assinatura');

-- -----------------------------------------------------------------------------
-- 2. Sem select direto e sem update nem delete
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select count(*) from registro_atendimento $s$, '42501', null,
  'enfermeira não tem select direto em registro_atendimento (leitura só por assistencial.ler_*)');
select throws_ok($s$ select count(*) from registro_adendo $s$, '42501', null,
  'enfermeira não tem select direto em registro_adendo');
select throws_ok($s$ select count(*) from alerta_clinico $s$, '42501', null,
  'enfermeira não tem select direto em alerta_clinico');
select throws_ok($s$ select * from assistencial.ler_registro_atendimento('f2300000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'o app não chama assistencial.* direto (só os wrappers de api)');
select throws_ok($s$ select privado.hash_registro('{}'::jsonb, 'r', 'd2300000-0000-4000-8000-000000000001', now()) $s$,
  '42501', null, 'o app não chama privado.hash_registro');
select testes.encerrar();

select testes.autenticar_anon();
select throws_ok($s$ select api.checklist_visita('f2300000-0000-4000-8000-000000000002') $s$, '42501', null,
  'anon não chama api.checklist_visita');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 3. api.registrar_atendimento
-- -----------------------------------------------------------------------------

-- quem pode
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal1');
select throws_ok(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L), 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '42501', null, 'sem AAL2 a enfermeira não registra');
select testes.encerrar();

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000005', 'aal2');
select throws_ok(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L), 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '42501', null, 'o comercial não registra atendimento');
select testes.encerrar();

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000002', 'aal2');
select throws_like(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L), 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%nao_e_a_profissional_da_visita%', 'outra enfermeira não assina a visita alheia');
select testes.encerrar();

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000003', 'aal2');
select throws_like(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L), 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%nao_e_a_profissional_da_visita%', 'a coordenação também só assina o que é dela');
select testes.encerrar();

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');

-- assinatura que não confere
select throws_like(
  format($s$ select api.registrar_atendimento(%L, testes.dados_completos(%L), 'Resumo', testes.ms(), %L, 'v1-2026-09') $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'aaaa'),
  '%assinatura_invalida%', 'assinatura errada é recusada');
select throws_like(
  format($s$ select api.registrar_atendimento(%L, testes.dados_completos(%L, 37.0), 'Resumo', testes.ms(), testes.assinatura(testes.dados_completos(%L, 36.6), 'Resumo', %L), 'v1-2026-09') $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001',
         'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%assinatura_invalida%', 'dado mudado depois de assinar é recusado');
select throws_like(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L), '   ', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%resumo_obrigatorio%', 'resumo vazio é recusado');

-- obrigatórios
select throws_like(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L) #- '{2.1,temperatura}', 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%obrigatorios_pendentes 2.1.temperatura%', 'visita sem a temperatura da puérpera não conclui');
select throws_like(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L) #- '{2.9}', 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%2.9.fbm_aplicada%', 'o bloco de amamentação inteiro é obrigatório (K-09)');
select throws_like(
  format($s$ select testes.registrar(%L, jsonb_set(testes.dados_completos(%L), '{3.1}', '[]'::jsonb), 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%3.1.peso#e2300000-0000-4000-8000-000000000001%', 'sem sinais vitais e peso do bebê não conclui (por bebê)');
select throws_like(
  format($s$ select testes.registrar(%L, jsonb_set(testes.dados_completos(%L), '{2.1,pressao_arterial}', '{"partes":{"sistolica":120}}'::jsonb), 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%2.1.pressao_arterial%', 'pressão arterial com uma parte só não conta como respondida');
select throws_like(
  format($s$ select testes.registrar(%L, jsonb_set(testes.dados_completos(%L), '{2.1,temperatura}', '""'::jsonb), 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%2.1.temperatura%', 'valor vazio não conta como respondido');

-- visita ainda não iniciada
select throws_like(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L), 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000006', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%visita_nao_iniciada%', 'visita agendada não recebe registro');

-- caminho feliz, com um alerta reavaliado pelo servidor (PU-01 a 38,2 °C)
insert into t_r select 'reg_d2', testes.registrar(
  'f2300000-0000-4000-8000-000000000002',
  testes.dados_completos('e2300000-0000-4000-8000-000000000001', 38.2, false,
    '{"_alertas":[{"regra_id":"PU-01","sinal_identificado":"Febre de 38,2 °C","acionado_em":"2026-01-09T12:40:00-03:00","orientacao_medica":"Observação e antitérmico.","conduta_adotada":"Antitérmico e reavaliação em 2 horas."}]}'::jsonb),
  'Resumo do D2 sintético.', 'd2300000-0000-4000-8000-000000000001',
  '[{"regra_id":"PU-01","campo":"2.1.temperatura","valor_observado":"38,2"}]'::jsonb);
select is((select (r ->> 'alertas_criados')::integer from t_r where chave = 'reg_d2'), 1,
  'registro gravado e um alerta criado pelo servidor');
select testes.encerrar();

select is((select count(*)::integer from registro_atendimento where visita_id = 'f2300000-0000-4000-8000-000000000002'), 1,
  'o registro do D2 está gravado');
select is((select estado::text from visita where id = 'f2300000-0000-4000-8000-000000000002'), 'ficha_entregue',
  'assinar leva a visita a ficha_entregue (o servidor recebeu a ficha)');
select is((select count(*)::integer from evento_familia
            where familia_id = 'c2300000-0000-4000-8000-000000000001' and tipo = 'estagio'
              and dados ->> 'entidade_id' = 'f2300000-0000-4000-8000-000000000002'), 3,
  'as três transições da visita ficam na linha do tempo (concluida, ficha_pendente, ficha_entregue)');
select ok(privado.registro_confere((select id from registro_atendimento where visita_id = 'f2300000-0000-4000-8000-000000000002')),
  'a assinatura gravada confere com o conteúdo');
select is((select sincronizado_de is null from registro_atendimento where visita_id = 'f2300000-0000-4000-8000-000000000002'), true,
  'sem item de fila informado, sincronizado_de fica vazio');

-- append-only, inclusive para o dono e para service_role
select throws_ok(
  $s$ update registro_atendimento set resumo_descritivo = 'mudou' where visita_id = 'f2300000-0000-4000-8000-000000000002' $s$,
  null, null, 'update no registro é recusado, mesmo para o dono do banco');
select throws_ok(
  $s$ delete from registro_atendimento where visita_id = 'f2300000-0000-4000-8000-000000000002' $s$,
  null, null, 'delete no registro é recusado');
select throws_ok(
  $s$ truncate registro_atendimento $s$, null, null, 'truncate no registro é recusado');
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(
  $s$ update registro_atendimento set resumo_descritivo = 'mudou' $s$, '42501', null,
  'a enfermeira não tem update no registro');
select throws_ok($s$ delete from registro_atendimento $s$, '42501', null, 'a enfermeira não tem delete no registro');
select testes.encerrar();
select testes.autenticar_service_role();
select throws_ok($s$ update registro_atendimento set resumo_descritivo = 'mudou' $s$, '42501', null,
  'nem o service_role atualiza o registro');
select testes.encerrar();

-- uma visita, um registro
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select is(
  (testes.registrar('f2300000-0000-4000-8000-000000000002',
     testes.dados_completos('e2300000-0000-4000-8000-000000000001', 38.2, false,
       '{"_alertas":[{"regra_id":"PU-01","sinal_identificado":"Febre de 38,2 °C","acionado_em":"2026-01-09T12:40:00-03:00","orientacao_medica":"Observação e antitérmico.","conduta_adotada":"Antitérmico e reavaliação em 2 horas."}]}'::jsonb),
     'Resumo do D2 sintético.', 'd2300000-0000-4000-8000-000000000001') ->> 'ja_registrado')::boolean,
  true, 'reenviar o mesmo registro é idempotente (não duplica)');
select throws_ok(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L, 36.0), 'Outro resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000002', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '23505', null, 'registro diferente para a mesma visita é recusado: a correção é por adendo');
select testes.encerrar();
select is((select count(*)::integer from registro_atendimento where visita_id = 'f2300000-0000-4000-8000-000000000002'), 1,
  'continua um registro só');

-- -----------------------------------------------------------------------------
-- 4. Alerta criado pelo servidor
-- -----------------------------------------------------------------------------

select is((select count(*)::integer from alerta_clinico where visita_id = 'f2300000-0000-4000-8000-000000000002'), 1,
  'um alerta clínico do D2');
select is((select severidade::text || '/' || regra_id || '/' || campo from alerta_clinico where visita_id = 'f2300000-0000-4000-8000-000000000002'),
  'imediato/PU-01/2.1.temperatura', 'PU-01 imediato no campo da temperatura');
select is((select conduta from alerta_clinico where visita_id = 'f2300000-0000-4000-8000-000000000002'),
  (select conduta from regra_alerta where id = 'PU-01'), 'a conduta vem de regra_alerta, não do chamador');
select is((select acionado_em is not null and sinal_identificado is not null and orientacao_medica is not null and conduta_adotada is not null
             and fechado_em is null
             from alerta_clinico where visita_id = 'f2300000-0000-4000-8000-000000000002'),
  true, 'os quatro campos do DOC 3 feitos na visita entram no alerta, que continua aberto para a coordenação');
select is((select count(*)::integer from notificacao where titulo = 'alerta_clinico_imediato' and corpo = 'PU-01' and papel = 'coordenacao'
                and 'whatsapp_interno' = any (canais) and 'push' = any (canais)), 1,
  'a coordenação é avisada (app, push e grupo clínico)');
select is((select count(*)::integer from notificacao where titulo like 'alerta_clinico%' and (corpo ~ 'Aurora' or titulo ~ 'Aurora')), 0,
  'o aviso não leva o nome da família');
select is((select count(*)::integer from ocorrencia where familia_id = 'c2300000-0000-4000-8000-000000000001'), 0,
  'febre não abre ocorrência privada (só saúde mental imediata abre)');

-- -----------------------------------------------------------------------------
-- 5. Último dia: contatos dos médicos
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L) #- '{ultimo_dia,resumo_encerramento}', 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000003', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%obrigatorios_pendentes%', 'no último dia o registro sem os campos do último dia não conclui');
select throws_like(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L, 36.6, true) #- '{ultimo_dia,resumo_encerramento}', 'Resumo', %L) $s$,
         'f2300000-0000-4000-8000-000000000003', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  '%ultimo_dia.resumo_encerramento%', 'falta o resumo de encerramento do último dia');
select lives_ok(
  format($s$ select testes.registrar(%L, testes.dados_completos(%L, 36.6, true), 'Resumo do D3.', %L) $s$,
         'f2300000-0000-4000-8000-000000000003', 'e2300000-0000-4000-8000-000000000001', 'd2300000-0000-4000-8000-000000000001'),
  'último dia com contato do obstetra e ausência justificada do pediatra encerra a visita');
select testes.encerrar();
select is((select telefone_e164 from medico where familia_id = 'c2300000-0000-4000-8000-000000000001' and especialidade = 'obstetra'),
  '+5511912345678', 'o contato do obstetra vira linha em medico, com o telefone em E.164');
select is((select origem_cadastro from medico where familia_id = 'c2300000-0000-4000-8000-000000000001' and especialidade = 'obstetra'),
  'ultimo_dia', 'origem do cadastro: ultimo_dia');
select is((select count(*)::integer from medico where familia_id = 'c2300000-0000-4000-8000-000000000001' and especialidade = 'pediatra'), 0,
  'sem contato do pediatra não nasce linha de médico');
select is((select count(*)::integer from tarefa where familia_id = 'c2300000-0000-4000-8000-000000000001' and tipo = 'obter_contato_medico'
                and papel_responsavel = 'coordenacao' and payload -> 'especialidades' = '["pediatra"]'::jsonb and vence_em is not null), 1,
  'falta o pediatra: tarefa obter_contato_medico para a coordenação, com prazo do parâmetro');
select is((select estado::text from visita where id = 'f2300000-0000-4000-8000-000000000003'), 'ficha_entregue',
  'a visita encerra mesmo sem o contato do pediatra');
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select is((api.contato_medico_situacao('c2300000-0000-4000-8000-000000000001') ->> 'evolucao_bloqueada')::boolean, false,
  'com o contato de um médico a evolução não fica bloqueada');
select is((api.contato_medico_situacao('c2300000-0000-4000-8000-000000000001') ->> 'tarefa_aberta')::boolean, true,
  'a tarefa de contato segue aberta');

-- Brisa: último dia sem nenhum contato
select lives_ok(
  format($s$ select testes.registrar(%L,
              testes.dados_completos(%L, 36.6, true, '{"ultimo_dia":{"contato_obstetra":{"ausente":true,"justificativa":"Sem número"},"contato_pediatra":{"ausente":true,"justificativa":"Sem número"},"resumo_encerramento":"Fim."}}'::jsonb),
              'Resumo do D3 de Brisa.', %L) $s$,
         'f2300000-0000-4000-8000-000000000004', 'e2300000-0000-4000-8000-000000000002', 'd2300000-0000-4000-8000-000000000001'),
  'último dia sem nenhum contato também encerra a visita');
select is((api.contato_medico_situacao('c2300000-0000-4000-8000-000000000002') ->> 'evolucao_bloqueada')::boolean, true,
  'sem nenhum contato a evolução fica bloqueada (PRD 7.3)');
select testes.encerrar();
select is((select payload -> 'especialidades' from tarefa where familia_id = 'c2300000-0000-4000-8000-000000000002' and tipo = 'obter_contato_medico'),
  '["obstetra", "pediatra"]'::jsonb, 'uma tarefa só, pedindo os dois contatos');

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.contato_medico_situacao('c2300000-0000-4000-8000-000000000001') $s$, '42501', null,
  'o comercial não consulta a situação dos contatos médicos');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 6. Adendo
-- -----------------------------------------------------------------------------


create temp table t_reg (id uuid) on commit drop;
grant all on t_reg to public;
insert into t_reg select id from registro_atendimento where visita_id = 'f2300000-0000-4000-8000-000000000002';

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000002', 'aal2');
select throws_like(
  $s$ select api.registrar_adendo((select id from t_reg), 'Correção', 'Texto') $s$,
  '%adendo_de_outra_profissional%', 'só quem assinou faz o adendo (ou a coordenação)');
select testes.encerrar();

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select throws_like($s$ select api.registrar_adendo((select id from t_reg), '  ', 'Texto') $s$,
  '%adendo_sem_motivo%', 'adendo sem motivo é recusado');
select throws_like($s$ select api.registrar_adendo((select id from t_reg), 'Correção', '') $s$,
  '%adendo_sem_conteudo%', 'adendo sem texto é recusado');
select lives_ok($s$ select api.registrar_adendo((select id from t_reg), 'Correção da temperatura do bebê', 'A temperatura do bebê era 36,9 °C.') $s$,
  'a profissional que assinou faz o adendo com motivo');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000003', 'aal2');
select lives_ok($s$ select api.registrar_adendo((select id from t_reg), 'Revisão da coordenação', 'Conferido.') $s$,
  'a coordenação também faz adendo');
select testes.encerrar();
select is((select count(*)::integer from registro_adendo where registro_id = (select id from t_reg)), 2, 'dois adendos gravados');
select ok(privado.registro_confere((select id from t_reg)), 'o registro original continua igual depois dos adendos');
select throws_ok($s$ update registro_adendo set motivo = 'x' $s$, null, null, 'adendo também é append-only');
select throws_ok($s$ delete from registro_adendo $s$, null, null, 'adendo não se apaga');

-- -----------------------------------------------------------------------------
-- 7. api.checklist_visita
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'd3', api.checklist_visita('f2300000-0000-4000-8000-000000000002');
select is((select r #>> '{familia,nome_exibicao}' from t_r where chave = 'd3'), 'Família Teste Aurora P39', 'checklist: a família');
select is((select r #>> '{acompanhamento,ultimo_dia}' from t_r where chave = 'd3'), 'false', 'checklist: D2 de 3 não é o último dia');
select is((select r #>> '{instrumento,versao}' from t_r where chave = 'd3'), 'v1-2026-09', 'checklist: definição aprovada do DOC 2');
select ok((select r #> '{instrumento,definicao,blocos}' is not null from t_r where chave = 'd3'), 'checklist: traz os blocos do instrumento');
select ok((select r -> 'instrumento_doc4' is not null from t_r where chave = 'd3'), 'checklist: traz o DOC 4 (LATCH e NTS)');
select is((select jsonb_array_length(r -> 'regras') from t_r where chave = 'd3'), 38, 'checklist: as 38 regras de alerta para o cache do aparelho');
select is((select jsonb_array_length(r -> 'bebes') from t_r where chave = 'd3'), 1, 'checklist: o bebê');
select is((select r #>> '{registro,profissional_id}' from t_r where chave = 'd3'), 'd2300000-0000-4000-8000-000000000001', 'checklist: registro assinado da visita');
select is((select jsonb_array_length(r #> '{registro,adendos}') from t_r where chave = 'd3'), 2, 'checklist: os adendos do registro');
select is((select jsonb_array_length(r -> 'anteriores') from t_r where chave = 'd3'), 0, 'checklist: D2 sem registro do D1 no banco de teste');
select is((select jsonb_array_length(r -> 'alertas') from t_r where chave = 'd3'), 1, 'checklist: alerta da visita');
select is((select r #>> '{parametros,transcricao_audio_ativa}' from t_r where chave = 'd3'), 'false', 'checklist: transcrição do áudio desligada');
select is((select r #>> '{parametros,seletor_sinais_doc3_ativo}' from t_r where chave = 'd3'), 'false', 'checklist: seletor do DOC 3 desligado até a validação clínica');

insert into t_r select 'd3b', api.checklist_visita('f2300000-0000-4000-8000-000000000003');
select is((select jsonb_array_length(r -> 'anteriores') from t_r where chave = 'd3b'), 1, 'D3 traz o registro do D2 como dia anterior (referência)');
select is((select r #>> '{anteriores,0,dados,2.1,temperatura}' from t_r where chave = 'd3b'), '38.2', 'a referência do dia anterior chega com o valor do D2');
select is((select r #>> '{acompanhamento,ultimo_dia}' from t_r where chave = 'd3b'), 'true', 'checklist: o D3 de 3 é o último dia');
select throws_like($s$ select api.checklist_visita('f2300000-0000-4000-8000-000000000005') $s$, '%visita de outra profissional%',
  'enfermeira não abre o checklist da visita de outra');
select testes.encerrar();

select is(testes.leituras('registro_atendimento') > 0, true, 'a leitura do registro fica no log de auditoria');

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.checklist_visita('f2300000-0000-4000-8000-000000000002') $s$, '42501', null, 'sem AAL2 não abre o checklist');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000003', 'aal2');
select lives_ok($s$ select api.checklist_visita('f2300000-0000-4000-8000-000000000005') $s$, 'a coordenação abre qualquer checklist');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.checklist_visita('f2300000-0000-4000-8000-000000000002') $s$, '42501', null, 'o comercial não abre o checklist');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 8. Alerta clínico: registrar, acionamento e fechamento
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  $s$ select api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000005', 'RN-08', 'v1-2026-09') $s$,
  '%visita_de_outra_profissional%', 'enfermeira não cria alerta na visita de outra');
select throws_like(
  $s$ select api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000003', 'PU-08', 'v1-2026-09') $s$,
  '%regra_inativa%', 'regra desligada (clínico) não dispara sozinha');
select throws_like(
  $s$ select api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000003', 'ZZ-99', 'v1-2026-09') $s$,
  '%regra_inexistente%', 'regra que não existe é recusada');
select throws_like(
  $s$ select api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000003', 'PU-05', 'v1-2026-09', null, null, null, true) $s$,
  '%seletor_desligado%', 'seletor do DOC 3 desligado: sinal manual recusado');
select throws_like(
  $s$ select api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000003', 'RN-08', 'v1-2026-09', 'e2300000-0000-4000-8000-000000000002') $s$,
  '%bebe_de_outra_familia%', 'bebê de outra família é recusado');
select testes.encerrar();

update parametro set valor = 'true' where chave = 'seletor_sinais_doc3_ativo';

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select is(
  (api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000003', 'RN-08', 'v1-2026-09',
      'e2300000-0000-4000-8000-000000000001', '3.1.temperatura', '38,6') ->> 'criado')::boolean,
  true, 'alerta do aparelho (RN-08, febre do bebê) é criado');
select is(
  (api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000003', 'RN-08', 'v1-2026-09',
      'e2300000-0000-4000-8000-000000000001', '3.1.temperatura', '38,6') ->> 'criado')::boolean,
  false, 'o mesmo alerta chegando de novo (reavaliação do servidor) não duplica');
select is(
  (api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000003', 'PU-05', 'v1-2026-09', null, null, null, true) ->> 'criado')::boolean,
  true, 'com o seletor ligado, o sinal manual (cefaleia com alteração visual) é registrado');
select is(
  (api.registrar_alerta_clinico('f2300000-0000-4000-8000-000000000003', 'SM-01', 'v1-2026-09', null, null, null, true) ->> 'criado')::boolean,
  true, 'sinal de saúde mental imediato é registrado');
select testes.encerrar();

select is((select count(*)::integer from ocorrencia where familia_id = 'c2300000-0000-4000-8000-000000000001'
                and privada and prioridade = 'maxima' and tipo = 'intercorrencia' and titulo = 'SM-01'), 1,
  'saúde mental imediata cria ocorrência privada de prioridade máxima');
select is((select descricao from ocorrencia where titulo = 'SM-01' and familia_id = 'c2300000-0000-4000-8000-000000000001'),
  (select conduta from regra_alerta where id = 'SM-01'), 'a ocorrência traz a conduta aprovada, sem paráfrase');
select is((select prioridade::text from notificacao where corpo = 'SM-01' and titulo = 'alerta_clinico_imediato'), 'maxima',
  'o aviso da saúde mental imediata tem prioridade máxima');

-- listas por papel
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select ok((select jsonb_array_length(api.alertas_clinicos('abertos')) >= 4), 'a enfermeira vê os alertas abertos das famílias atribuídas');
select is((select count(*)::integer from jsonb_array_elements(api.alertas_clinicos('abertos')) e where e ->> 'nome_exibicao' like '%Céu%'), 0,
  'a enfermeira não vê alerta de família que não é dela');
select is((api.alertas_clinicos('abertos') -> 0 ->> 'severidade'), 'imediato', 'imediatos vêm primeiro');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000003', 'aal2');
select ok((select jsonb_array_length(api.alertas_clinicos('todos')) >= 4), 'a coordenação vê os alertas');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.alertas_clinicos('abertos') $s$, '42501', null, 'o comercial não vê alertas clínicos');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select is(api.supervisao_medica_telefone(), '+5511900000099', 'a enfermeira lê o telefone da supervisão (parâmetro)');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000003', 'aal2');
select is(api.supervisao_medica_telefone(), '+5511900000099', 'a coordenação lê o telefone da supervisão');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.supervisao_medica_telefone() $s$, '42501', null, 'o comercial não lê o telefone da supervisão');
select testes.encerrar();
select is(testes.leituras('alerta_clinico') > 0, true, 'a leitura de alertas fica no log');

create temp table t_al (id uuid, versao integer) on commit drop;
grant all on t_al to public;
insert into t_al select id, versao from alerta_clinico where visita_id = 'f2300000-0000-4000-8000-000000000003' and regra_id = 'RN-08';

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.fechar_alerta_clinico((select id from t_al)) $s$, '42501', null,
  'a enfermeira registra o acionamento, mas quem fecha é a coordenação');
select lives_ok(
  $s$ select api.registrar_acionamento_alerta((select id from t_al), (select versao from t_al), 'Febre do bebê de 38,6 °C',
        now() - interval '30 minutes', null, null) $s$,
  'registra sinal e hora do acionamento, sem fechar');
select throws_like(
  $s$ select api.registrar_acionamento_alerta((select id from t_al), 1, 'x', null, null, null) $s$,
  '%versao_desatualizada%', 'versão desatualizada do alerta dá conflito (40001)');
select throws_like(
  $s$ select api.registrar_acionamento_alerta((select id from t_al), null, null, '2999-01-01T00:00:00Z', null, null) $s$,
  '%acionamento_no_futuro%', 'a hora do acionamento não pode estar no futuro');
select testes.encerrar();

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000003', 'aal2');
select throws_like($s$ select api.fechar_alerta_clinico((select id from t_al)) $s$, '%fechamento_incompleto%orientacao_medica%',
  'alerta não fecha sem os quatro campos (faltam orientação e conduta)');
select testes.encerrar();
select is((select fechado_em is null from alerta_clinico where id = (select id from t_al)), true, 'continua aberto');
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000003', 'aal2');
select lives_ok(
  $s$ select api.registrar_acionamento_alerta((select id from t_al), null, null, null,
        'Levar o bebê à emergência pediátrica.', 'A família foi orientada e a coordenação acompanha.') $s$,
  'a coordenação completa orientação médica e conduta');
select is((api.fechar_alerta_clinico((select id from t_al)) ->> 'alterado')::boolean, true, 'com os quatro campos o alerta fecha');
select testes.encerrar();
select is((select fechado_por from alerta_clinico where id = (select id from t_al)), 'a2300000-0000-4000-8000-000000000003'::uuid,
  'quem fechou fica registrado');
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000003', 'aal2');
select is((api.fechar_alerta_clinico((select id from t_al)) ->> 'alterado')::boolean, false, 'fechar de novo não muda nada');
select throws_like($s$ select api.registrar_acionamento_alerta((select id from t_al), null, 'x', null, null, null) $s$,
  '%alerta_fechado%', 'alerta fechado não recebe novo registro');
select testes.encerrar();

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000004', 'aal2');
select ok((select jsonb_array_length(api.alertas_clinicos('fechados')) >= 1), 'a diretoria lê os alertas fechados');
select throws_ok($s$ select api.fechar_alerta_clinico('00000000-0000-4000-8000-000000000000') $s$, '42501', null,
  'a diretoria só lê: não fecha alerta');
select testes.encerrar();

-- a restrição do banco vale até para o dono
select throws_ok(
  $s$ update alerta_clinico set fechado_em = now(), fechado_por = 'a2300000-0000-4000-8000-000000000003'
       where visita_id = 'f2300000-0000-4000-8000-000000000003' and regra_id = 'PU-05' $s$,
  '23514', null, 'o banco recusa fechar alerta sem os quatro campos, mesmo por update direto do dono');

-- -----------------------------------------------------------------------------
-- 9. Áudio da visita
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  $s$ select api.registrar_anexo_audio('f2300000-0000-4000-8000-000000000003', 'audios/Maria Silva/gravacao.webm', 30) $s$,
  '%caminho_invalido%', 'o caminho do áudio nunca leva nome: só visitas/<id da visita>/<arquivo>');
select throws_like(
  $s$ select api.registrar_anexo_audio('f2300000-0000-4000-8000-000000000003', 'visitas/f2300000-0000-4000-8000-000000000002/a1b2c3d4-0000-4000-8000-000000000001.webm', 30) $s$,
  '%caminho_invalido%', 'o caminho precisa ser o da própria visita');
select throws_like(
  $s$ select api.registrar_anexo_audio('f2300000-0000-4000-8000-000000000003', 'visitas/f2300000-0000-4000-8000-000000000003/a1b2c3d4-0000-4000-8000-000000000001.webm', 601) $s$,
  '%audio_longo%', 'áudio acima do limite do parâmetro é recusado');
insert into t_r select 'audio', api.registrar_anexo_audio('f2300000-0000-4000-8000-000000000003',
  'visitas/f2300000-0000-4000-8000-000000000003/a1b2c3d4-0000-4000-8000-000000000001.webm', 45);
select testes.encerrar();
select is((select r ->> 'retencao_ate' from t_r where chave = 'audio')::date,
  ((now() at time zone 'America/Sao_Paulo')::date + 90), 'a retenção vem do parâmetro (90 dias)');
select is((select status::text || '/' || coalesce(transcricao, 'sem texto') from anexo_audio where visita_id = 'f2300000-0000-4000-8000-000000000003'),
  'pendente/sem texto', 'com a transcrição desligada, o áudio entra pendente e sem texto');
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000001', 'aal2');
select is((api.audio_da_visita_para_ouvir((select (r ->> 'id')::uuid from t_r where chave = 'audio')) ->> 'validade_seg')::integer, 60,
  'a URL assinada do áudio vale 60 segundos (parâmetro)');
select testes.encerrar();
select testes.autenticar_authenticated('a2300000-0000-4000-8000-000000000002', 'aal2');
select throws_like($s$ select api.audio_da_visita_para_ouvir((select (r ->> 'id')::uuid from t_r where chave = 'audio')) $s$,
  '%visita_de_outra_profissional%', 'outra enfermeira não ouve o áudio');
select testes.encerrar();
select is(testes.leituras('anexo_audio') > 0, true, 'ouvir o áudio fica no log de leitura');

-- -----------------------------------------------------------------------------
-- 10. Regras alinhadas ao DOC 2, parâmetros e privilégios
-- -----------------------------------------------------------------------------

select is((select campo from regra_alerta where id = 'PU-04' and instrumento_versao = 'v1-2026-09'), '2.2.cesarea_sem_sinais_infeccao',
  'PU-04 aponta para o campo do DOC 2 aprovado');
select is((select condicao from regra_alerta where id = 'RN-01' and instrumento_versao = 'v1-2026-09'),
  '{"campo":"3.respiracao_sem_sinais_esforco","operador":"=","valor":false}'::jsonb,
  'RN-01 com a polaridade do PRD 9.2 (respiração sem sinais de esforço = não)');
select is((select campo from regra_alerta where id = 'RN-03' and instrumento_versao = 'v1-2026-09'), '3.atividade_responsividade_preservadas',
  'RN-03 aponta para o campo do DOC 2 aprovado');
select is((select count(*)::integer from regra_alerta where instrumento_versao = 'v1-2026-09' and ativa), 7,
  'só as sete regras do DOC 3 seguem ativas');

select ok((select valor from parametro where chave = 'audio_url_assinada_segundos') = '60'::jsonb, 'parâmetro: URL do áudio de 60 segundos');
select ok(exists (select 1 from parametro where chave = 'transcricao_audio_ativa'), 'parâmetro da transcrição existe');
select ok(exists (select 1 from parametro where chave = 'supervisao_medica_telefone'), 'parâmetro do telefone da supervisão existe');

select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'assistencial' and has_function_privilege('authenticated', p.oid, 'execute')), 0,
  'nenhuma função de assistencial é executável pelo app');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'api' and p.proname in ('checklist_visita', 'registrar_atendimento', 'registrar_adendo',
              'registrar_alerta_clinico', 'alertas_clinicos', 'registrar_acionamento_alerta', 'fechar_alerta_clinico',
              'registrar_anexo_audio', 'audio_da_visita_para_ouvir', 'contato_medico_situacao',
              'supervisao_medica_telefone')
              and p.prosecdef and p.proconfig @> array['search_path=""']
              and has_function_privilege('authenticated', p.oid, 'execute')
              and not has_function_privilege('anon', p.oid, 'execute')
              and not has_function_privilege('service_role', p.oid, 'execute')), 11,
  'as onze funções de api: security definer, search_path vazio, só authenticated');

select * from finish();

rollback;
