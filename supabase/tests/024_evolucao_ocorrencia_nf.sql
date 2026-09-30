-- =============================================================================
-- supabase/tests/024_evolucao_ocorrencia_nf.sql
--
-- Migration 0024_evolucao_ocorrencia_nf (P41 evoluções em PDF, P42 ocorrências,
-- pesquisa e NPS, P43 nota fiscal de serviço):
--   1. Dias úteis e prazo D+1 e D+2 da evolução (etapa do recálculo diário).
--   2. Fim do atendimento: tarefa da evolução, pós-venda, tarefa da pesquisa
--      (o freio decide), tudo por gatilho no registro do último dia.
--   3. Evolução: base lida com log, rascunho, revisão, devolução, aprovação
--      (só sem erro e com e-mail do médico), dados do envio, registro do envio,
--      arquivo pelo id, imutável depois de aprovada; sem select direto.
--   4. Ocorrências: SLA por prioridade, privada, detrator sempre privada,
--      responsável só muda status e histórico, versão, aviso de SLA vencido.
--   5. Pesquisa: link de uso único (só o hash), freio no link e no envio,
--      limite de tentativas, validação, classificação e ações do PRD 7.4
--      (promotor, neutro, detrator), pipeline 4 até arquivado.
--   6. Nota fiscal: tomador é quem paga, estados, tentativas, arquivos pelo id,
--      emissão manual assistida, emissão automática pelo servidor, permissões.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(191);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2400000-0000-4000-8000-000000000001', 'enfermeira.a.p41@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000002', 'enfermeira.b.p41@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000003', 'coordenacao.p41@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000004', 'diretoria.p41@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000005', 'financeiro.p41@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000006', 'comercial.p41@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a2400000-0000-4000-8000-000000000001', 'Enfermeira A Teste P41', 'enfermeira.a.p41@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000002', 'Enfermeira B Teste P41', 'enfermeira.b.p41@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000003', 'Coordenação Teste P41',  'coordenacao.p41@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000004', 'Diretoria Teste P41',    'diretoria.p41@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000005', 'Financeiro Teste P41',   'financeiro.p41@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000006', 'Comercial Teste P41',    'comercial.p41@exemplo.invalid', true);

insert into usuario_papel (usuario_id, papel) values
  ('a2400000-0000-4000-8000-000000000001', 'enfermeira'),
  ('a2400000-0000-4000-8000-000000000002', 'enfermeira'),
  ('a2400000-0000-4000-8000-000000000003', 'coordenacao'),
  ('a2400000-0000-4000-8000-000000000004', 'diretoria'),
  ('a2400000-0000-4000-8000-000000000005', 'financeiro'),
  ('a2400000-0000-4000-8000-000000000006', 'comercial');

insert into parametro (chave, valor) values
  ('acesso_enfermeira_pos_encerramento_dias', '7')
on conflict (chave) do update set valor = excluded.valor;

insert into pacote (id, nome, dias) values ('b2400000-0000-4000-8000-000000000003', 'Pacote Teste P41', 2);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2400000-0000-4000-8000-000000000004', 'b2400000-0000-4000-8000-000000000003', 100, 6, '2020-01-01');

insert into profissional (id, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero) values
  ('d2400000-0000-4000-8000-000000000001', 'a2400000-0000-4000-8000-000000000001', 'Enfermeira A Teste P41', 'enfermeira_obstetrica', 'COREN', 'SP', 'TESTE-0001'),
  ('d2400000-0000-4000-8000-000000000002', 'a2400000-0000-4000-8000-000000000002', 'Enfermeira B Teste P41', 'enfermeira_neonatal', 'COREN', 'SP', 'TESTE-0002');

insert into municipio (codigo_ibge, nome, uf, regiao_intermediaria) values (3550308, 'São Paulo', 'SP', 'São Paulo')
on conflict (codigo_ibge) do nothing;

-- Um caso: família, mãe, bebê, contrato, acompanhamento de 2 dias, designação da
-- enfermeira A, D1 com registro. O D2 (último dia) só ganha registro quando o teste
-- manda, para o gatilho disparar na hora certa.
create function testes.caso(p_n integer, p_estado text default 'normal', p_prof uuid default 'd2400000-0000-4000-8000-000000000001',
                            p_bebes integer default 1)
returns void language plpgsql as $$
declare
  v_sufixo text := lpad(p_n::text, 2, '0');
  v_fam uuid := ('c2400000-0000-4000-8000-0000000001' || v_sufixo)::uuid;
  v_ac  uuid := ('d2400000-0000-4000-8000-0000000001' || v_sufixo)::uuid;
begin
  insert into familia (id, nome_exibicao, dpp, data_nascimento, data_alta, estado_sensivel)
    values (v_fam, 'Família Teste Caso ' || v_sufixo, current_date - 30, current_date - 12, current_date - 10, p_estado::estado_sensivel);
  insert into pessoa (id, familia_id, papel, nome, telefone_e164, email, idade, contato_principal)
    values (('92400000-0000-4000-8000-0000000001' || v_sufixo)::uuid, v_fam, 'mae', 'Marina Teste Caso ' || v_sufixo,
            '+551190002' || lpad(p_n::text, 4, '0'), 'marina.caso' || v_sufixo || '@exemplo.invalid', 29, true);
  for i in 1..p_bebes loop
    insert into bebe (id, familia_id, ordem, nome, sexo, tipo_parto, data_nascimento, peso_nascimento_g)
      values (('e2400000-0000-4000-8000-' || lpad(i::text || v_sufixo, 12, '0'))::uuid, v_fam, i, 'Bebê Teste ' || i::text || ' ' || v_sufixo,
              'feminino', 'cesarea', current_date - 12, 3300);
  end loop;
  insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status)
    values (('b2400000-0000-4000-8000-0000000001' || v_sufixo)::uuid, v_fam, 'b2400000-0000-4000-8000-000000000004', 100, 'teste', 'assinado');
  insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, estado, inicio_efetivo)
    values (v_ac, ('b2400000-0000-4000-8000-0000000001' || v_sufixo)::uuid, v_fam, 2, 6, 'em_execucao', current_date - 5);
  insert into designacao (acompanhamento_id, profissional_id, papel, status) values (v_ac, p_prof, 'titular', 'aceita');
  insert into visita (id, acompanhamento_id, profissional_id, dia_numero, data, estado) values
    (('f2400000-0000-4000-8000-0000000001' || v_sufixo)::uuid, v_ac, p_prof, 1, current_date - 5, 'ficha_entregue'),
    (('f2400000-0000-4000-8000-0000000002' || v_sufixo)::uuid, v_ac, p_prof, 2, current_date - 4, 'iniciada');
  insert into registro_atendimento (visita_id, profissional_id, instrumento_versao, dados, resumo_descritivo, assinado_em, assinatura)
    values (('f2400000-0000-4000-8000-0000000001' || v_sufixo)::uuid, p_prof, 'v1-2026-09',
            '{"2.1":{"temperatura":36.6,"frequencia_cardiaca":78}}', 'Dia 1 sintético', now() - interval '5 days', 'a1');
end $$;

-- Registro do último dia (D2): dispara o gatilho de fim do atendimento.
create function testes.ultimo_dia(p_n integer, p_prof uuid default 'd2400000-0000-4000-8000-000000000001', p_data date default null)
returns void language plpgsql as $$
declare
  v_sufixo text := lpad(p_n::text, 2, '0');
begin
  if p_data is not null then
    update visita set data = p_data where id = ('f2400000-0000-4000-8000-0000000002' || v_sufixo)::uuid;
  end if;
  insert into registro_atendimento (visita_id, profissional_id, instrumento_versao, dados, resumo_descritivo, assinado_em, assinatura)
    values (('f2400000-0000-4000-8000-0000000002' || v_sufixo)::uuid, p_prof, 'v1-2026-09',
            '{"2.1":{"temperatura":36.7,"frequencia_cardiaca":80}}', 'Dia 2 sintético', now() - interval '4 days', 'a2');
end $$;

create temp table t_r (chave text primary key, r jsonb) on commit drop;
grant all on t_r to public;

-- Casos: 01 evolução (normal), 02 pesquisa promotor, 03 pesquisa detrator, 04 pesquisa neutro,
-- 05 encerrado sensível, 06 freio depois do link, 07 outra enfermeira, 08 prazo vencido.
select testes.caso(1);
select testes.caso(2);
select testes.caso(3);
select testes.caso(4);
select testes.caso(5, 'encerrado_sensivel');
select testes.caso(6);
select testes.caso(7, 'normal', 'd2400000-0000-4000-8000-000000000002');
select testes.caso(8);

-- -----------------------------------------------------------------------------
-- 1. Dias úteis
-- -----------------------------------------------------------------------------

select is(privado.dias_uteis_apos(date '2033-01-14', 1), date '2033-01-17',
  'dias úteis: sexta mais um dia útil é segunda');
select is(privado.dias_uteis_apos(date '2033-01-14', 2), date '2033-01-18', 'dias úteis: sexta mais dois é terça');
update parametro set valor = '["2033-01-17"]' where chave = 'feriados';
select is(privado.dias_uteis_apos(date '2033-01-14', 1), date '2033-01-18',
  'dias úteis: o feriado de parametro.feriados não conta');
update parametro set valor = '[]' where chave = 'feriados';

-- -----------------------------------------------------------------------------
-- 2. Fim do atendimento (gatilho no registro do último dia)
-- -----------------------------------------------------------------------------

select is((select count(*)::integer from pos_venda where acompanhamento_id::text like 'd2400000-%'), 0,
  'antes do último dia não há pós-venda');
select testes.ultimo_dia(1);
select testes.ultimo_dia(2);
select testes.ultimo_dia(3);
select testes.ultimo_dia(4);
select testes.ultimo_dia(5);
select testes.ultimo_dia(6);
select testes.ultimo_dia(7, 'd2400000-0000-4000-8000-000000000002');
select testes.ultimo_dia(8, 'd2400000-0000-4000-8000-000000000001', current_date - 15);

select is((select count(*)::integer from pos_venda where acompanhamento_id::text like 'd2400000-%'), 8,
  'o registro do último dia abre o pós-venda de cada acompanhamento, uma linha só');
select is((select estagio::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000101'),
  'protocolo_ultimo_dia_concluido', 'o pós-venda nasce em protocolo_ultimo_dia_concluido');
select is((select count(*)::integer from tarefa where tipo = 'emitir_evolucao' and payload ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000101'),
  1, 'o último dia abre a tarefa de emitir a evolução');
select is((select responsavel_id::text from tarefa where tipo = 'emitir_evolucao' and payload ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000101'),
  'a2400000-0000-4000-8000-000000000001', 'a tarefa da evolução é da enfermeira que atendeu');
select is((select count(*)::integer from tarefa where tipo = 'enviar_pesquisa' and payload ->> 'pos_venda_id' =
  (select id::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000101') and papel_responsavel = 'coordenacao'),
  1, 'família em normal ganha a tarefa de envio da pesquisa, da coordenação');
select is((select count(*)::integer from tarefa where tipo = 'enviar_pesquisa' and payload ->> 'pos_venda_id' =
  (select id::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000105')),
  0, 'família em encerrado_sensivel não recebe a tarefa da pesquisa');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'pesquisa' and status = 'abortada_freio'
  and payload ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000105'), 1,
  'o aborto da tarefa da pesquisa pelo freio fica registrado');
select is((select vence_em from tarefa where tipo = 'emitir_evolucao' and payload ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000101'),
  (privado.dias_uteis_apos(current_date - 4, 1) + time '23:59') at time zone 'America/Sao_Paulo',
  'a tarefa da evolução vence no fim do dia útil seguinte ao atendimento (PRD 9.5)');

-- -----------------------------------------------------------------------------
-- 3. Evolução (P41)
-- -----------------------------------------------------------------------------

-- 3.1 leitura da base: papel, família e log
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'base1', api.base_evolucao('d2400000-0000-4000-8000-000000000101');
select testes.encerrar();
select is((select r #>> '{paciente,nome}' from t_r where chave = 'base1'), 'Marina Teste Caso 01',
  'base da evolução: paciente e idade do cadastro');
select is((select jsonb_array_length(r -> 'bebes')::integer from t_r where chave = 'base1'), 1, 'base da evolução: um bebê');
select is((select r #>> '{profissional,conselho_numero}' from t_r where chave = 'base1'), 'TESTE-0001',
  'base da evolução: conselho e número vêm do cadastro da profissional');
select ok((select count(*) from log_auditoria where acao = 'leitura' and entidade = 'registro_atendimento'
  and entidade_id = 'd2400000-0000-4000-8000-000000000101') >= 1, 'a leitura da base grava log de auditoria');
select ok((select r -> 'textos' ? 'evo_pue_abertura' from t_r where chave = 'base1'),
  'base da evolução: textos padrão evo_* de mensagem_modelo');

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($s$ select api.base_evolucao('d2400000-0000-4000-8000-000000000101') $s$, '42501', null,
  'a outra enfermeira não lê a base de um acompanhamento que não é dela');
select testes.encerrar();
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ select api.base_evolucao('d2400000-0000-4000-8000-000000000101') $s$, '42501', null,
  'o comercial não lê a base da evolução (O-05)');
select testes.encerrar();
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.base_evolucao('d2400000-0000-4000-8000-000000000101') $s$, '42501', null,
  'sem MFA (AAL1) a base da evolução não abre');
select throws_ok($s$ select count(*) from relatorio_medico $s$, '42501', null,
  'relatorio_medico não tem select direto para o app');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select api.evolucoes('abertas') $s$, '42501', null, 'anon não chama api.evolucoes');
select testes.encerrar();

-- 3.2 rascunho: sem contato do médico, nada
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  $s$ select api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'puerperal', null,
        '{"dados":{},"conteudo":{}}'::jsonb, '[]'::jsonb) $s$,
  'evolucao:contato_medico_pendente%', 'sem contato do médico a evolução fica bloqueada (PRD 7.3)');
select testes.encerrar();

insert into medico (id, familia_id, especialidade, nome, telefone_e164, email) values
  ('12400000-0000-4000-8000-000000000001', 'c2400000-0000-4000-8000-000000000101', 'obstetra', 'Dra. Helena Teste Obstetra', null, 'helena.obstetra@exemplo.invalid'),
  ('12400000-0000-4000-8000-000000000002', 'c2400000-0000-4000-8000-000000000101', 'pediatra', 'Dr. Rodrigo Teste Pediatra', '+5511900002222', null);

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'base1b', api.base_evolucao('d2400000-0000-4000-8000-000000000101');
select testes.encerrar();
select ok(not ((select r from t_r where chave = 'base1b')::text like '%helena.obstetra@exemplo.invalid%')
  and (select r::text like '%h***@exemplo.invalid%' from t_r where chave = 'base1b'),
  'base da evolução: o e-mail do médico só vai mascarado');
select is((select r #>> '{acompanhamento,data_alta}' from t_r where chave = 'base1b'), (current_date - 10)::text,
  'base da evolução: a data de alta é a do cadastro da família');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  $s$ select api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'neonatal', null,
        '{"dados":{},"conteudo":{}}'::jsonb, '[]'::jsonb) $s$,
  'evolucao:bebe_por_tipo%', 'neonatal exige o bebê; puerperal não tem bebê');
select throws_like(
  $s$ select api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'puerperal', null, '{"x":1}'::jsonb, '[]'::jsonb) $s$,
  'evolucao:conteudo_invalido%', 'o conteúdo precisa ter dados e conteudo');
select throws_like(
  $s$ select api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'puerperal', null,
        '{"dados":{},"conteudo":{}}'::jsonb, '[1]'::jsonb) $s$,
  'evolucao:erros_invalidos%', 'os erros são uma lista de textos');
insert into t_r select 'rascunho1', api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'puerperal', null,
  '{"dados":{"id":"x"},"conteudo":{"secoes":[]}}'::jsonb, '["A conclusão não combina com os achados."]'::jsonb);
select testes.encerrar();
select is((select r ->> 'status' from t_r where chave = 'rascunho1'), 'rascunho', 'o rascunho nasce em rascunho');
select is((select r ->> 'criado' from t_r where chave = 'rascunho1'), 'true', 'primeiro salvamento cria o documento');

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  format($s$ select api.enviar_evolucao_para_revisao(%L) $s$, (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  'evolucao:com_erros%', 'rascunho com erro de validação não vai para revisão');
select throws_ok(
  $s$ select api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'puerperal', null,
        '{"dados":{},"conteudo":{}}'::jsonb, '[]'::jsonb, 99) $s$,
  '40001', null, 'versão desatualizada é recusada');
insert into t_r select 'rascunho1b', api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'puerperal', null,
  '{"dados":{"id":"x"},"conteudo":{"secoes":[]}}'::jsonb, '[]'::jsonb, 1);
select testes.encerrar();
select is((select r ->> 'criado' from t_r where chave = 'rascunho1b'), 'false', 'salvar de novo atualiza o mesmo documento');
select is((select (r ->> 'versao')::integer from t_r where chave = 'rascunho1b'), 2, 'cada gravação sobe a versão');
select is((select count(*)::integer from relatorio_medico where acompanhamento_id = 'd2400000-0000-4000-8000-000000000101'), 1,
  'um documento só por acompanhamento, tipo e bebê');

-- 3.3 revisão, devolução e aprovação
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select is((select api.enviar_evolucao_para_revisao((select (r ->> 'id')::uuid from t_r where chave = 'rascunho1'), 2) ->> 'status'), 'em_revisao',
  'sem erro de validação o rascunho vai para a revisão');
select throws_like(
  $s$ select api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'puerperal', null,
        '{"dados":{},"conteudo":{}}'::jsonb, '[]'::jsonb) $s$,
  'evolucao:em_revisao%', 'a enfermeira não edita o que está em revisão');
select throws_ok(
  format($s$ select api.aprovar_evolucao(%L) $s$, (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  '42501', null, 'a enfermeira não aprova a própria evolução');
select testes.encerrar();
select is((select count(*)::integer from notificacao where papel = 'coordenacao' and titulo = 'Evolução de enfermagem aguardando aprovação'), 1,
  'a coordenação é avisada, sem nome de paciente no título');

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
select throws_like(
  format($s$ select api.devolver_evolucao(%L, 'ok') $s$, (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  'evolucao:motivo_curto%', 'devolver pede um recado de pelo menos 5 letras');
select is((select api.devolver_evolucao((select (r ->> 'id')::uuid from t_r where chave = 'rascunho1'), 'Confira a conclusão de amamentação.') ->> 'status'),
  'rascunho', 'a coordenação devolve o documento para o rascunho');
select testes.encerrar();
select is((select nota_revisao from relatorio_medico where id = (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  'Confira a conclusão de amamentação.', 'o recado da coordenação fica no documento');
select is((select count(*)::integer from notificacao where usuario_id = 'a2400000-0000-4000-8000-000000000001'
  and titulo = 'A coordenação devolveu uma evolução com um recado'), 1, 'a enfermeira é avisada da devolução');

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
select throws_like(
  format($s$ select api.aprovar_evolucao(%L) $s$, (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  'evolucao:fora_da_revisao%', 'só o que está em revisão é aprovado');
insert into t_r select 'rev1', api.enviar_evolucao_para_revisao((select (r ->> 'id')::uuid from t_r where chave = 'rascunho1'));
select is((select api.aprovar_evolucao((select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')) ->> 'status'), 'aprovado',
  'a coordenação aprova o documento em revisão');
select testes.encerrar();
select is((select destinatarios -> 0 ->> 'especialidade' from relatorio_medico where id = (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  'obstetra', 'a evolução puerperal vai ao obstetra');
select ok((select aprovado_por = 'a2400000-0000-4000-8000-000000000003' and aprovado_em is not null from relatorio_medico
  where id = (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')), 'quem aprovou e quando ficam guardados');

-- neonatal: o pediatra tem telefone mas não e-mail, então não há para onde enviar por e-mail
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'neo1', api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'neonatal', 'e2400000-0000-4000-8000-000000000101',
  '{"dados":{},"conteudo":{}}'::jsonb, '[]'::jsonb);
insert into t_r select 'rev2', api.enviar_evolucao_para_revisao((select (r ->> 'id')::uuid from t_r where chave = 'neo1'));
select testes.encerrar();
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
select throws_like(
  format($s$ select api.aprovar_evolucao(%L) $s$, (select (r ->> 'id')::uuid from t_r where chave = 'neo1')),
  'evolucao:sem_email_do_medico%', 'sem e-mail do pediatra a evolução neonatal não é aprovada');
select testes.encerrar();

-- 3.4 dados do envio e registro do envio
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(
  format($s$ select api.dados_envio_evolucao(%L) $s$, (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  '42501', null, 'a enfermeira não pega os dados do envio');
select testes.encerrar();
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
insert into t_r select 'envio1', api.dados_envio_evolucao((select (r ->> 'id')::uuid from t_r where chave = 'rascunho1'));
select is((select r #>> '{destinatarios,0,email}' from t_r where chave = 'envio1'), 'helena.obstetra@exemplo.invalid',
  'os dados do envio trazem o e-mail do obstetra');
select ok((select r -> 'nomes_proibidos' from t_r where chave = 'envio1') @> '"Marina Teste Caso 01"'::jsonb,
  'os nomes que o assunto e o anexo não podem ter incluem a paciente');
select ok((select r -> 'textos' ? 'email_evolucao_assunto' from t_r where chave = 'envio1'), 'o assunto vem de mensagem_modelo');
select ok(not ((select r #>> '{textos,email_evolucao_assunto}' from t_r where chave = 'envio1') ~* 'marina|teste caso'),
  'o assunto do e-mail não leva nome de paciente');
select throws_like(
  format($s$ select api.registrar_envio_evolucao(%L, 'evolucoes/marina-teste.pdf', '[{"a":1}]'::jsonb) $s$,
         (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  'evolucao:caminho_invalido%', 'o PDF é arquivado pelo id do documento, nunca por nome');
select is((select api.registrar_envio_evolucao((select (r ->> 'id')::uuid from t_r where chave = 'rascunho1'), null, '[]'::jsonb,
  'O provedor de e-mail não respondeu.') ->> 'status'), 'erro_envio', 'falha de envio deixa o documento em erro_envio');
select is((select api.registrar_envio_evolucao((select (r ->> 'id')::uuid from t_r where chave = 'rascunho1'),
  'evolucoes/' || (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1') || '.pdf',
  '[{"especialidade":"obstetra","medico_id":"12400000-0000-4000-8000-000000000001"}]'::jsonb) ->> 'status'), 'enviado',
  'depois do erro o envio pode ser refeito e o documento vai para enviado');
select testes.encerrar();
select ok((select pdf_path = 'evolucoes/' || id::text || '.pdf' and enviado_em is not null and erro_envio is null
  from relatorio_medico where id = (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')),
  'o envio guarda o PDF pelo id e a hora, e limpa o erro');
select is((select count(*)::integer from evento_familia where familia_id = 'c2400000-0000-4000-8000-000000000101' and tipo = 'evolucao' and restrito),
  1, 'o envio entra na linha do tempo como evento restrito');
select is((select count(*)::integer from tarefa where familia_id = 'c2400000-0000-4000-8000-000000000101'
  and payload ->> 'acao' = 'evolucao_familia' and papel_responsavel = 'coordenacao'), 1,
  'K-10: a evolução ganha a tarefa de envio manual à família');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  $s$ select api.salvar_evolucao('d2400000-0000-4000-8000-000000000101', 'puerperal', null,
        '{"dados":{},"conteudo":{}}'::jsonb, '[]'::jsonb) $s$,
  'evolucao:ja_aprovada%', 'documento aprovado ou enviado não se edita');
select is((select api.pdf_evolucao((select (r ->> 'id')::uuid from t_r where chave = 'rascunho1')) ->> 'pdf_path')::text,
  'evolucoes/' || (select (r ->> 'id')::uuid from t_r where chave = 'rascunho1') || '.pdf', 'a enfermeira do caso abre o PDF arquivado');
select testes.encerrar();
select throws_ok(
  $s$ update relatorio_medico set pdf_path = 'evolucoes/nome-da-paciente.pdf' $s$,
  '23514', null, 'o banco recusa caminho de PDF fora do padrão pelo id');
select throws_ok(
  format($s$ update relatorio_medico set status = 'aprovado', aprovado_por = null where id = %L $s$, (select (r ->> 'id')::uuid from t_r where chave = 'neo1')),
  '23514', null, 'o banco recusa aprovado sem quem aprovou');

-- 3.5 lista e prazos
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'lista_a', api.evolucoes('abertas');
select testes.encerrar();
select ok((select r::text like '%d2400000-0000-4000-8000-000000000101%' from t_r where chave = 'lista_a'),
  'a enfermeira vê na lista o acompanhamento dela');
select ok(not (select r::text like '%d2400000-0000-4000-8000-000000000107%' from t_r where chave = 'lista_a'),
  'a enfermeira não vê o acompanhamento da outra');
select is((select a ->> 'prazo_aviso' from t_r, jsonb_array_elements(r -> 'acompanhamentos') a
  where chave = 'lista_a' and a ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000108'),
  privado.dias_uteis_apos(current_date - 15, 1)::text, 'o aviso vem um dia útil depois do atendimento (D+1)');
select is((select a ->> 'situacao' from t_r, jsonb_array_elements(r -> 'acompanhamentos') a
  where chave = 'lista_a' and a ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000108'),
  'escalada', 'passados dois dias úteis a situação é escalada');

insert into t_r select 'rec1', privado.recalculo_prazo_relatorio();
select is((select count(*)::integer from automacao_execucao where automacao_id = 'prazo_relatorio'
  and payload ->> 'etapa' = 'aviso' and payload ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000108'), 1,
  'o recálculo diário avisa a enfermeira do atendimento vencido (D+1), uma vez');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'prazo_relatorio'
  and payload ->> 'etapa' = 'escala' and payload ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000108'), 1,
  'e escala para a coordenação em D+2, uma vez');
select ok((select count(*) from notificacao where usuario_id = 'a2400000-0000-4000-8000-000000000001'
  and titulo = 'A evolução de enfermagem já está no prazo de emissão') >= 1, 'o aviso vai para a enfermeira do atendimento');
select ok((select count(*) from notificacao where papel = 'coordenacao'
  and titulo = 'Evolução de enfermagem em atraso: chegou à coordenação') >= 1, 'D+2 avisa a coordenação, sem nome de paciente');
insert into t_r select 'antes_recalculo', to_jsonb((select count(*) from automacao_execucao where automacao_id = 'prazo_relatorio'));
insert into t_r select 'rec2', privado.recalculo_prazo_relatorio();
select is((select count(*) from automacao_execucao where automacao_id = 'prazo_relatorio')::integer,
  (select (r #>> '{}')::integer from t_r where chave = 'antes_recalculo'), 'rodar de novo não repete o aviso nem a escalada');
select is((select prioridade::text from tarefa where tipo = 'emitir_evolucao' and payload ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000108'),
  'alta', 'a escalada sobe a prioridade da tarefa');

-- -----------------------------------------------------------------------------
-- 4. Ocorrências (P42)
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(
  $s$ select api.registrar_ocorrencia('c2400000-0000-4000-8000-000000000101', null, 'reclamacao', 'normal', false, 'Título', 'Descrição', null) $s$,
  '42501', null, 'a enfermeira não abre ocorrência');
select testes.encerrar();

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
insert into t_r select 'oc1', api.registrar_ocorrencia('c2400000-0000-4000-8000-000000000101', null, 'reclamacao', 'alta', false,
  'Horário da visita mudou', 'A família contou que o horário mudou duas vezes.', 'a2400000-0000-4000-8000-000000000001');
insert into t_r select 'oc2', api.registrar_ocorrencia('c2400000-0000-4000-8000-000000000102', null, 'experiencia', 'normal', true,
  'Conversa reservada', 'Assunto só da coordenação.', 'a2400000-0000-4000-8000-000000000001');
insert into t_r select 'oc3', api.registrar_ocorrencia('c2400000-0000-4000-8000-000000000103', null, 'detrator', 'maxima', false,
  'Nota baixa', 'A família não gostou.', null);
select throws_like(
  $s$ select api.registrar_ocorrencia(null, null, 'nao_existe', 'normal', false, 'Título', 'Descrição', null) $s$,
  'ocorrencia:tipo_invalido%', 'tipo fora da lista é recusado');
select throws_like(
  $s$ select api.registrar_ocorrencia(null, null, 'outro', 'normal', false, 'Oi', 'Descrição', null) $s$,
  'ocorrencia:titulo_invalido%', 'título curto demais é recusado');
select testes.encerrar();
select is((select privada from ocorrencia where id = (select (r ->> 'id')::uuid from t_r where chave = 'oc3')), true,
  'ocorrência de detrator é sempre privada');
select is((select status::text from ocorrencia where id = (select (r ->> 'id')::uuid from t_r where chave = 'oc1')),
  'responsavel_definido', 'com responsável a ocorrência nasce com responsável definido');
select ok((select extract(epoch from sla_vence_em - criado_em) / 3600 between 23.9 and 24.1 from ocorrencia
  where id = (select (r ->> 'id')::uuid from t_r where chave = 'oc1')), 'prioridade alta vence em 24 horas (parametro.ocorrencia_sla)');
select ok((select extract(epoch from sla_vence_em - criado_em) / 3600 between 71.9 and 72.1 from ocorrencia
  where id = (select (r ->> 'id')::uuid from t_r where chave = 'oc2')), 'prioridade normal vence em 72 horas');
select is((select jsonb_array_length(historico)::integer from ocorrencia where id = (select (r ->> 'id')::uuid from t_r where chave = 'oc1')),
  1, 'o histórico já nasce com a abertura');
select throws_ok(
  format($s$ update ocorrencia set privada = false where id = %L $s$, (select (r ->> 'id')::uuid from t_r where chave = 'oc3')),
  '23514', null, 'o banco recusa detrator não privado');

-- a enfermeira responsável vê a não privada, nunca a privada
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'lista_oc', api.ocorrencias('abertas');
select is((select jsonb_array_length(r -> 'ocorrencias')::integer from t_r where chave = 'lista_oc'), 1,
  'a enfermeira responsável vê só a ocorrência não privada dela');
select throws_like(
  format($s$ select api.ocorrencia(%L) $s$, (select (r ->> 'id')::uuid from t_r where chave = 'oc2')),
  'ocorrencia:inexistente%', 'a ocorrência privada não aparece para quem é só responsável');
select throws_ok(
  format($s$ select api.atualizar_ocorrencia(%L, null, null, 'maxima') $s$, (select (r ->> 'id')::uuid from t_r where chave = 'oc1')),
  '42501', null, 'o responsável não muda a prioridade');
select is((select api.atualizar_ocorrencia((select (r ->> 'id')::uuid from t_r where chave = 'oc1'), 'em_acompanhamento', null, null, null,
  'Liguei para a família.') ->> 'status'), 'em_acompanhamento', 'o responsável muda o andamento');
select throws_like(
  format($s$ select api.atualizar_ocorrencia(%L, 'resolvida', null, null, null, 'curta') $s$, (select (r ->> 'id')::uuid from t_r where chave = 'oc1')),
  'ocorrencia:resolucao_sem_nota%', 'resolver pede uma nota de pelo menos 10 letras');
select throws_like(
  format($s$ select api.atualizar_ocorrencia(%L, 'triagem', null, null, null, 'Voltando um passo.') $s$, (select (r ->> 'id')::uuid from t_r where chave = 'oc1')),
  'ocorrencia:status_para_tras%', 'o andamento só vai para frente');
select throws_ok(
  format($s$ select api.atualizar_ocorrencia(%L, 'resolvida', null, null, null, 'Resolvido com a família.', 1) $s$, (select (r ->> 'id')::uuid from t_r where chave = 'oc1')),
  '40001', null, 'versão desatualizada é recusada');
select is((select api.atualizar_ocorrencia((select (r ->> 'id')::uuid from t_r where chave = 'oc1'), 'resolvida', null, null, null,
  'Resolvido com a família por telefone.') ->> 'status'), 'resolvida', 'resolvida com nota');
select testes.encerrar();
select ok((select resolvida_em is not null and jsonb_array_length(historico) = 3 from ocorrencia
  where id = (select (r ->> 'id')::uuid from t_r where chave = 'oc1')), 'o histórico tem uma linha por mudança e a resolução tem hora');

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000004', 'aal2');
select is((select jsonb_array_length(api.ocorrencias('todas') -> 'ocorrencias')::integer >= 3), true, 'a diretoria vê todas, inclusive as privadas');
select testes.encerrar();
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ select api.ocorrencias('abertas') $s$, '42501', null, 'o comercial não vê ocorrências');
select testes.encerrar();

update ocorrencia set sla_vence_em = now() - interval '1 hour' where id = (select (r ->> 'id')::uuid from t_r where chave = 'oc2');
select is(privado.avisar_ocorrencias_vencidas(), 1, 'SLA vencido: um aviso para a ocorrência aberta');
select is(privado.avisar_ocorrencias_vencidas(), 0, 'o aviso de SLA não se repete');
select is((select count(*)::integer from notificacao where papel = 'coordenacao' and titulo = 'Uma ocorrência passou do prazo'), 1,
  'a coordenação é avisada do SLA vencido, sem nome de família');

-- -----------------------------------------------------------------------------
-- 5. Pesquisa e pós-venda (P42)
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ select api.pos_vendas() $s$, '42501', null, 'o comercial não vê o pós-venda');
select testes.encerrar();

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
select is((api.gerar_link_pesquisa((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000105')) ->> 'motivo'),
  'familia_em_estado_sensivel', 'família em encerrado_sensivel não recebe o link da pesquisa');
select throws_like(
  format($s$ select api.marcar_pesquisa_enviada(%L) $s$, (select id::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102')),
  'pesquisa:sem_link%', 'sem link gerado não dá para marcar como enviada');
insert into t_r select 'link2', api.gerar_link_pesquisa((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'));
insert into t_r select 'link3', api.gerar_link_pesquisa((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000103'));
insert into t_r select 'link4', api.gerar_link_pesquisa((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000104'));
insert into t_r select 'link6', api.gerar_link_pesquisa((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000106'));
insert into t_r select 'env102', api.marcar_pesquisa_enviada((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'));
insert into t_r select 'env103', api.marcar_pesquisa_enviada((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000103'));
insert into t_r select 'env104', api.marcar_pesquisa_enviada((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000104'));
insert into t_r select 'env106', api.marcar_pesquisa_enviada((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000106'));
select testes.encerrar();

select ok((select r ->> 'texto' like '%@@LINK@@%' from t_r where chave = 'link2'), 'o texto do convite sai com o marcador do link');
select ok((select r ->> 'texto' not like '%Marina Teste%' from t_r where chave = 'link2'), 'o convite usa só o primeiro nome');
select is((select pesquisa_token_hash from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'),
  encode(extensions.digest((select r ->> 'token' from t_r where chave = 'link2'), 'sha256'), 'hex'),
  'no banco fica só o sha256 do token');
select isnt((select pesquisa_token_hash from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'),
  (select r ->> 'token' from t_r where chave = 'link2'), 'o token em si nunca é gravado');
select is((select estagio::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'),
  'pesquisa_enviada', 'marcar como enviada anda o pipeline 4');
select is((select status::text from tarefa where tipo = 'enviar_pesquisa' and payload ->> 'pos_venda_id' =
  (select id::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102')), 'concluida',
  'a tarefa de envio é concluída');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'pesquisa' and status = 'abortada_freio'
  and payload ->> 'etapa' = 'link' and payload ->> 'pos_venda_id' = (select id::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000105')), 1,
  'o aborto do link pelo freio também fica registrado');

-- 5.1 acesso público (service_role)
select testes.autenticar_anon();
select throws_ok($s$ select public.pesquisa_abrir('qualquer-coisa-com-mais-de-vinte-letras') $s$, '42501', null,
  'anon não abre a pesquisa direto no banco');
select testes.encerrar();
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ select public.pesquisa_enviar('qualquer-coisa-com-mais-de-vinte-letras', '{}'::jsonb) $s$, '42501', null,
  'usuário logado também não chama a função do servidor');
select testes.encerrar();

select testes.autenticar_service_role();
insert into t_r select 'abre2', public.pesquisa_abrir((select r ->> 'token' from t_r where chave = 'link2'), '203.0.113.7');
select is((select r ->> 'situacao' from t_r where chave = 'abre2'), 'valido', 'o link gerado abre a pesquisa');
select is((select r ->> 'nome' from t_r where chave = 'abre2'), 'Marina', 'a pesquisa abre só com o primeiro nome');
select ok((select jsonb_array_length(r -> 'perguntas') >= 3 from t_r where chave = 'abre2'), 'as perguntas vêm de parametro.pesquisa_perguntas');
select ok((select r -> 'perguntas' @> '[{"id":"nps","tipo":"escala_0_10"}]'::jsonb from t_r where chave = 'abre2'),
  'a pesquisa tem a pergunta NPS de 0 a 10 (K-12)');
select is((public.pesquisa_abrir('token-que-nao-existe-de-jeito-nenhum', '203.0.113.7') ->> 'situacao'), 'invalido',
  'token desconhecido volta como inválido');
select is((public.pesquisa_enviar((select r ->> 'token' from t_r where chave = 'link2'),
  '{"depoimento_autorizado":true}'::jsonb, '203.0.113.7') ->> 'situacao'), 'corrigir', 'sem a nota o envio pede correção');
select is((public.pesquisa_enviar((select r ->> 'token' from t_r where chave = 'link2'),
  '{"nps":11,"depoimento_autorizado":true,"autorizacao_imagem":false}'::jsonb, '203.0.113.7') -> 'erros' ->> 'nps'), 'invalido',
  'nota fora de 0 a 10 é recusada, sem devolver o valor');
select is((public.pesquisa_enviar((select r ->> 'token' from t_r where chave = 'link2'),
  '{"nps":10,"recomendaria":"com_certeza","destaque":"A presença todos os dias.","depoimento_autorizado":true,"autorizacao_imagem":false,"intruso":"x"}'::jsonb,
  '203.0.113.7') ->> 'situacao'), 'recebido', 'resposta completa é recebida');
select is((public.pesquisa_enviar((select r ->> 'token' from t_r where chave = 'link2'),
  '{"nps":10,"depoimento_autorizado":true,"autorizacao_imagem":true}'::jsonb, '203.0.113.7') ->> 'situacao'), 'invalido',
  'o link vale uma vez: a segunda tentativa é inválida');
select testes.encerrar();

select is((select classificacao::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'), 'promotor',
  'nota 10 é promotor');
select is((select estagio::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'), 'classificado',
  'a resposta anda o pipeline 4 até classificado');
select ok((select pesquisa_token_hash is null and pesquisa_respondida_em is not null and depoimento_autorizado and not autorizacao_imagem
  from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'), 'a resposta apaga o hash do token e guarda as autorizações');
select ok((select not (respostas ? 'intruso') and respostas ->> 'destaque' = 'A presença todos os dias.'
  from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'), 'só as perguntas cadastradas entram nas respostas');
select is((select count(*)::integer from tarefa where familia_id = 'c2400000-0000-4000-8000-000000000102'
  and payload ->> 'acao' in ('depoimento', 'indicacao') and papel_responsavel = 'coordenacao'), 2,
  'promotor: uma tarefa de depoimento e uma de indicação');
select ok((select max(vence_em) - min(vence_em) >= interval '5 days' from tarefa where familia_id = 'c2400000-0000-4000-8000-000000000102'
  and payload ->> 'acao' in ('depoimento', 'indicacao')), 'depoimento e indicação caem em dias diferentes');

-- detrator
select testes.autenticar_service_role();
select is((public.pesquisa_enviar((select r ->> 'token' from t_r where chave = 'link3'),
  '{"nps":3,"depoimento_autorizado":true,"autorizacao_imagem":true}'::jsonb) ->> 'situacao'), 'recebido', 'detrator responde');
-- neutro
select is((public.pesquisa_enviar((select r ->> 'token' from t_r where chave = 'link4'),
  '{"nps":8,"depoimento_autorizado":false,"autorizacao_imagem":false}'::jsonb) ->> 'situacao'), 'recebido', 'neutro responde');
select testes.encerrar();
select is((select classificacao::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000103'), 'detrator',
  'nota 3 é detrator');
select is((select count(*)::integer from ocorrencia where familia_id = 'c2400000-0000-4000-8000-000000000103'
  and tipo = 'detrator' and privada and titulo = 'Pesquisa de satisfação com nota baixa'), 1,
  'detrator vira ocorrência privada');
select is((select count(*)::integer from tarefa where familia_id = 'c2400000-0000-4000-8000-000000000103'
  and payload ->> 'acao' in ('depoimento', 'indicacao')), 0, 'detrator nunca recebe pedido de depoimento nem de indicação');
select is((select count(*)::integer from notificacao where papel = 'coordenacao'
  and titulo like 'Uma família respondeu a pesquisa com nota baixa%'), 1, 'a coordenação é avisada do detrator');
select is((select classificacao::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000104'), 'neutro',
  'nota 8 é neutro');
select is((select count(*)::integer from tarefa where familia_id = 'c2400000-0000-4000-8000-000000000104' and tipo = 'escuta_neutro'), 1,
  'neutro recebe a tarefa de escuta');

-- o freio entre o link e o envio
update familia set estado_sensivel = 'atencao' where id = 'c2400000-0000-4000-8000-000000000106';
select testes.autenticar_service_role();
select is((public.pesquisa_abrir((select r ->> 'token' from t_r where chave = 'link6')) ->> 'situacao'), 'invalido',
  'família que entrou em estado sensível depois do link: a pesquisa não abre');
select is((public.pesquisa_enviar((select r ->> 'token' from t_r where chave = 'link6'),
  '{"nps":10,"depoimento_autorizado":true,"autorizacao_imagem":true}'::jsonb) ->> 'situacao'), 'invalido',
  'e não recebe a resposta');
-- limite de tentativas por origem (parametro.pesquisa.tentativas_max = 5)
insert into t_r select 'inv' || g::text, public.pesquisa_abrir('token-invalido-numero-' || g::text || '-mais-vinte', '198.51.100.9') from generate_series(1, 5) g;
select is((public.pesquisa_abrir('token-invalido-numero-9-mais-vinte', '198.51.100.9') ->> 'situacao'), 'limite',
  'depois de cinco links inválidos a origem fica no limite');
select is((public.pesquisa_abrir('token-invalido-numero-9-mais-vinte', '198.51.100.10') ->> 'situacao'), 'invalido',
  'o limite é por origem');
select testes.encerrar();
select is((select count(*)::integer from privado.pesquisa_tentativa where origem_hmac like '%198.51.100.9%'), 0,
  'a origem não é gravada em claro (só o HMAC)');

-- lista, resumo e fim do pipeline
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
insert into t_r select 'pv', api.pos_vendas('abertos');
select ok((select (r #>> '{resumo,promotores}')::integer >= 1 and (r #>> '{resumo,detratores}')::integer >= 1
  and (r #>> '{resumo,neutros}')::integer >= 1 from t_r where chave = 'pv'), 'o resumo conta promotor, neutro e detrator');
select is((select i ->> 'bloqueio' from t_r, jsonb_array_elements(r -> 'itens') i
  where chave = 'pv' and i ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000105'), 'freio',
  'a lista mostra que o freio segura a família em encerrado_sensivel');
select is((select i ->> 'pode_gerar_link' from t_r, jsonb_array_elements(r -> 'itens') i
  where chave = 'pv' and i ->> 'acompanhamento_id' = 'd2400000-0000-4000-8000-000000000105'), 'false',
  'e que não dá para gerar o link');
select is((api.avancar_pos_venda((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102')) ->> 'estagio'),
  'acao_executada', 'a coordenação registra que a ação foi feita');
select is((api.avancar_pos_venda((select id from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102')) ->> 'estagio'),
  'arquivado', 'e arquiva');
select throws_like(
  format($s$ select api.avancar_pos_venda(%L) $s$, (select id::text from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102')),
  'pesquisa:sem_proximo_passo%', 'depois de arquivado não há próximo passo');
select testes.encerrar();
select ok((select acao_executada_em is not null from pos_venda where acompanhamento_id = 'd2400000-0000-4000-8000-000000000102'),
  'a hora da ação executada fica guardada');
select throws_ok(
  $s$ update pos_venda set estagio = 'arquivado' where acompanhamento_id = 'd2400000-0000-4000-8000-000000000103' $s$,
  '42501', null, 'o estágio do pipeline 4 só muda por privado.transicionar');

-- -----------------------------------------------------------------------------
-- 6. Nota fiscal (P43)
-- -----------------------------------------------------------------------------

insert into pessoa (id, familia_id, papel, nome, telefone_e164, email) values
  ('92400000-0000-4000-8000-000000000201', 'c2400000-0000-4000-8000-000000000101', 'presenteador', 'Carla Teste Pagadora', '+5511900029999', 'carla.pagadora@exemplo.invalid');
insert into pessoa_dados_contrato (pessoa_id, cpf, endereco_residencial) values
  ('92400000-0000-4000-8000-000000000201', '52998224725',
   '{"cep":"01310100","logradouro":"Rua de Teste","numero":"200","bairro":"Bairro de Teste","cidade":"São Paulo","uf":"SP"}');
update contrato set pagador_pessoa_id = '92400000-0000-4000-8000-000000000201', contratante_pessoa_id = '92400000-0000-4000-8000-000000000101'
  where id = 'b2400000-0000-4000-8000-000000000101';
insert into oportunidade (id, familia_id, pipeline, estagio_p1, estagio_p2, para_quem)
  values ('e2400000-0000-4000-8000-000000000301', 'c2400000-0000-4000-8000-000000000101', 2, 'qualificado', 'pagamento_confirmado', 'presente');
insert into cobranca (id, contrato_id, parcela, valor_centavos, vencimento, external_id, status, valor_pago_centavos, pago_em) values
  ('ca400000-0000-4000-8000-000000000001', 'b2400000-0000-4000-8000-000000000101', 1, 420000, current_date - 3, 'ca400000-0000-4000-8000-000000000001', 'paga', 420000, now() - interval '2 days'),
  ('ca400000-0000-4000-8000-000000000002', 'b2400000-0000-4000-8000-000000000102', 1, 100000, current_date + 3, 'ca400000-0000-4000-8000-000000000002', 'aberta', null, null),
  ('ca400000-0000-4000-8000-000000000003', 'b2400000-0000-4000-8000-000000000103', 1, 200000, current_date - 3, 'ca400000-0000-4000-8000-000000000003', 'paga', 200000, now() - interval '2 days');
insert into nota_fiscal (id, cobranca_id, provider, status) values
  ('1a400000-0000-4000-8000-000000000001', 'ca400000-0000-4000-8000-000000000001', 'a_definir', 'pendente'),
  ('1a400000-0000-4000-8000-000000000002', 'ca400000-0000-4000-8000-000000000002', 'a_definir', 'pendente'),
  ('1a400000-0000-4000-8000-000000000003', 'ca400000-0000-4000-8000-000000000003', 'a_definir', 'pendente');

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.notas_fiscais() $s$, '42501', null, 'a enfermeira não vê notas fiscais');
select testes.encerrar();
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ select api.dados_emissao_nota('1a400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'o comercial não pega os dados de emissão (CPF)');
select testes.encerrar();
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal1');
select throws_ok($s$ select api.notas_fiscais() $s$, '42501', null, 'o financeiro sem MFA não abre as notas');
select testes.encerrar();

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
insert into t_r select 'notas', api.notas_fiscais();
select ok((select (r #>> '{resumo,pendentes}')::integer >= 3 from t_r where chave = 'notas'), 'a lista conta as notas pendentes');
select is((select n ->> 'tomador_nome' from t_r, jsonb_array_elements(r -> 'notas') n
  where chave = 'notas' and n ->> 'id' = '1a400000-0000-4000-8000-000000000001'), 'Carla Teste Pagadora',
  'o tomador da nota é quem paga (C-10), não a gestante');
select is((select r ->> 'emissao_automatica' from t_r where chave = 'notas'), 'false', 'a emissão automática nasce desligada (T-05)');
insert into t_r select 'dados1', api.dados_emissao_nota('1a400000-0000-4000-8000-000000000001');
select is((select r #>> '{tomador,cpf}' from t_r where chave = 'dados1'), '52998224725', 'a emissão recebe o CPF completo de quem paga');
select is((select r ->> 'codigo_servico' from t_r where chave = 'dados1'), '05266', 'o código do serviço vem do cadastro');
select is((select r ->> 'descricao_servico' from t_r where chave = 'dados1'), 'Cuidado domiciliar pós-parto', 'a descrição do serviço vem do cadastro');
select is((select r #>> '{tomador,endereco,municipio_codigo_ibge}' from t_r where chave = 'dados1'), '3550308', 'o município do tomador vira código IBGE');
select is((select r ->> 'valor_centavos' from t_r where chave = 'dados1'), '420000', 'o valor da nota é o da cobrança, em centavos');
select throws_like($s$ select api.dados_emissao_nota('1a400000-0000-4000-8000-000000000002') $s$, 'nota:cobranca_nao_paga%',
  'nota de cobrança não paga não emite');
select throws_like($s$ select api.dados_emissao_nota('1a400000-0000-4000-8000-000000000003') $s$, 'nota:tomador_sem_cpf%',
  'tomador sem CPF não emite');
select testes.encerrar();
select ok((select count(*) from log_auditoria where acao = 'leitura' and entidade = 'pessoa_dados_contrato'
  and entidade_id = '92400000-0000-4000-8000-000000000201') >= 1, 'ler o CPF do tomador grava log de auditoria');

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
select is((select api.iniciar_emissao_nota('1a400000-0000-4000-8000-000000000001') ->> 'status'), 'processando', 'a emissão começa como processando');
select throws_like($s$ select api.iniciar_emissao_nota('1a400000-0000-4000-8000-000000000001') $s$, 'nota:ja_processando%',
  'duas emissões ao mesmo tempo são recusadas');
select is((select api.registrar_resultado_nota('1a400000-0000-4000-8000-000000000001', 'erro', null, null, null, null,
  'CPF do tomador rejeitado pelo provedor.') ->> 'status'), 'erro', 'o provedor recusou: a nota fica com erro');
select testes.encerrar();
select is((select erro from nota_fiscal where id = '1a400000-0000-4000-8000-000000000001'), 'CPF do tomador rejeitado pelo provedor.',
  'o motivo do erro fica na nota');
select is((select count(*)::integer from notificacao where papel = 'financeiro' and titulo = 'Uma nota fiscal voltou com erro'), 1,
  'o financeiro é avisado do erro');

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
select is((select api.iniciar_emissao_nota('1a400000-0000-4000-8000-000000000001') ->> 'status'), 'processando', 'da nota com erro dá para reenviar');
select is((select tentativas from nota_fiscal where id = '1a400000-0000-4000-8000-000000000001'), 2, 'cada tentativa é contada');
select throws_like($s$ select api.registrar_resultado_nota('1a400000-0000-4000-8000-000000000001', 'emitida') $s$, 'nota:sem_numero%',
  'nota emitida exige o número');
select is((select api.registrar_resultado_nota('1a400000-0000-4000-8000-000000000001', 'emitida', 'prov-1', '1234',
  'notas/1a400000-0000-4000-8000-000000000001.pdf', 'notas/1a400000-0000-4000-8000-000000000001.xml') ->> 'status'), 'emitida',
  'nota emitida com número, PDF e XML');
select is((select api.registrar_resultado_nota('1a400000-0000-4000-8000-000000000001', 'emitida', null, '9999') ->> 'mudou'), 'false',
  'repetir o resultado de nota emitida não muda nada');
select is((select api.arquivo_da_nota('1a400000-0000-4000-8000-000000000001', 'xml') ->> 'caminho'),
  'notas/1a400000-0000-4000-8000-000000000001.xml', 'o XML está no storage privado, pelo id');
select throws_like($s$ select api.iniciar_emissao_nota('1a400000-0000-4000-8000-000000000001') $s$, 'nota:ja_emitida%',
  'nota emitida não emite de novo');
select testes.encerrar();
select is((select estagio_p2::text from oportunidade where id = 'e2400000-0000-4000-8000-000000000301'), 'nota_fiscal_emitida',
  'a nota emitida anda o pipeline 2 de pagamento_confirmado para nota_fiscal_emitida');
select throws_ok(
  $s$ update nota_fiscal set pdf_path = 'notas/nome-da-paciente.pdf' where id = '1a400000-0000-4000-8000-000000000003' $s$,
  '23514', null, 'o banco recusa arquivo da nota fora do padrão pelo id');
select throws_ok(
  $s$ update nota_fiscal set status = 'emitida' where id = '1a400000-0000-4000-8000-000000000003' $s$,
  '23514', null, 'o banco recusa nota emitida sem número');

-- emissão manual assistida
update contrato set pagador_pessoa_id = null where id = 'b2400000-0000-4000-8000-000000000103';
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
select throws_like($s$ select api.registrar_nota_manual('1a400000-0000-4000-8000-000000000003', '77', current_date + 3) $s$,
  'nota:data_invalida%', 'a data da nota emitida à mão não pode ser futura');
select throws_like($s$ select api.registrar_nota_manual('1a400000-0000-4000-8000-000000000003', '', current_date) $s$,
  'nota:sem_numero%', 'a nota emitida à mão exige o número');
select throws_like($s$ select api.registrar_nota_manual('1a400000-0000-4000-8000-000000000002', '77', (now() at time zone 'America/Sao_Paulo')::date) $s$,
  'nota:cobranca_nao_paga%', 'nota de cobrança não paga não se registra');
select is((select api.registrar_nota_manual('1a400000-0000-4000-8000-000000000003', '77', current_date - 1, 'Portal do provedor',
  'notas/1a400000-0000-4000-8000-000000000003.pdf') ->> 'status'), 'emitida', 'emissão manual assistida: a nota vira emitida');
select throws_like($s$ select api.registrar_nota_manual('1a400000-0000-4000-8000-000000000003', '78', current_date) $s$,
  'nota:emitida_nao_aceita_manual%', 'nota já emitida não aceita registro manual');
select testes.encerrar();
select ok((select manual and numero = '77' and provider = 'Portal do provedor' and emitida_em is not null
  from nota_fiscal where id = '1a400000-0000-4000-8000-000000000003'), 'a nota manual guarda que foi manual, o número e o provedor');

-- emissão automática pelo servidor
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select public.nota_para_emissao_automatica('ca400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'usuário logado não chama a função do servidor da nota');
select testes.encerrar();
select testes.autenticar_service_role();
select is((public.nota_para_emissao_automatica('ca400000-0000-4000-8000-000000000001') ->> 'motivo'), 'manual',
  'com a emissão automática desligada o servidor não emite');
select testes.encerrar();
update parametro set valor = '{"automatica":true,"tentativas":3}' where chave = 'nfse_emissao';
insert into nota_fiscal (id, cobranca_id, provider, status)
  values ('1a400000-0000-4000-8000-000000000004', 'ca400000-0000-4000-8000-000000000001', 'a_definir', 'pendente');
select testes.autenticar_service_role();
insert into t_r select 'auto1', public.nota_para_emissao_automatica('ca400000-0000-4000-8000-000000000001');
select is((select r ->> 'emitir' from t_r where chave = 'auto1'), 'true', 'com a emissão automática ligada o servidor recebe os dados da nota');
select is((select r #>> '{tomador,nome}' from t_r where chave = 'auto1'), 'Carla Teste Pagadora', 'e o tomador é quem paga');
select is((public.nota_para_emissao_automatica('ca400000-0000-4000-8000-000000000001') ->> 'motivo'), 'sem_nota_pendente',
  'chamada repetida não devolve a nota em processamento');
select is((public.nota_registrar_resultado('1a400000-0000-4000-8000-000000000004', 'erro', null, null, null, null,
  'Provedor fora do ar.') ->> 'status'), 'erro', 'o servidor registra o erro do provedor');
select testes.encerrar();
select is((select status::text from nota_fiscal where id = '1a400000-0000-4000-8000-000000000004'), 'erro', 'a nota fica com erro visível para o financeiro');

-- privilégios
select ok(has_function_privilege('authenticated', 'api.notas_fiscais(text)', 'execute'), 'authenticated executa api.notas_fiscais');
select ok(not has_function_privilege('service_role', 'api.notas_fiscais(text)', 'execute'), 'service_role não executa api.*');
select ok(not has_function_privilege('anon', 'api.aprovar_evolucao(uuid,integer)', 'execute'), 'anon não executa api.aprovar_evolucao');
select ok(not has_function_privilege('authenticated', 'assistencial.ler_base_evolucao(uuid)', 'execute'),
  'o app não executa assistencial.* direto');
select ok(has_function_privilege('service_role', 'public.pesquisa_enviar(text,jsonb,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.pesquisa_enviar(text,jsonb,text)', 'execute'),
  'a função pública da pesquisa é só do servidor');

select * from finish();
rollback;
