-- =============================================================================
-- supabase/tests/026_seguranca_p41_p52.sql
--
-- Segurança das funções e das tabelas das migrations 0024, 0025 e 0026 (evolução,
-- ocorrências, pesquisa e nota fiscal; instalação, push e Cloud API; capacidade,
-- financeiro e painel), tentada de fora, como em 024_seguranca_onda.sql e
-- 027_seguranca_relacao.sql:
--   1. Matriz papel x AAL: cada função de api recusa (42501) o anônimo, quem não
--      tem papel nenhum, quem tem outro papel e quem tem o papel certo em AAL1
--      (onde a função pede AAL2). As funções são chamadas com argumentos nulos:
--      a checagem de papel vem antes de tudo, então uma recusa de negócio ou de
--      dado (qualquer coisa que não seja 42501) prova que passou pela porta.
--   2. Concessões: api só para authenticated; as de servidor de public só para
--      service_role; nenhuma função nova de privado é executável pelo app.
--   3. Escrita direta que só as funções deviam permitir: ocorrencia, pos_venda e
--      nota_fiscal (o histórico e o SLA da ocorrência, o NPS e a nota emitida).
--      Falhava antes da correção na 0024.
--   4. IDOR: enfermeira de outra família, só com oferta e desativada contra a
--      evolução; enfermeira que não é a responsável contra a ocorrência; pagamento
--      e inscrição de push de outra pessoa.
--   5. Tabelas novas: RLS ligada e nenhuma concessão.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(65);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2601000-0000-4000-8000-000000000001', 'comercial.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-000000000002', 'enfermeira.a.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-000000000003', 'financeiro.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-000000000004', 'marketing.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-000000000005', 'coordenacao.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-000000000006', 'diretoria.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-000000000007', 'sem.papel.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-000000000008', 'enfermeira.b.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-000000000009', 'enfermeira.c.seg26@exemplo.invalid'),
  ('a2601000-0000-4000-8000-00000000000a', 'enfermeira.inativa.seg26@exemplo.invalid');
insert into perfil (id, nome, email, ativo) values
  ('a2601000-0000-4000-8000-000000000001', 'Perfil Teste Comercial Seg26', 'comercial.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-000000000002', 'Perfil Teste Enfermeira A Seg26', 'enfermeira.a.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-000000000003', 'Perfil Teste Financeiro Seg26', 'financeiro.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-000000000004', 'Perfil Teste Marketing Seg26', 'marketing.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-000000000005', 'Perfil Teste Coordenação Seg26', 'coordenacao.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-000000000006', 'Perfil Teste Diretoria Seg26', 'diretoria.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-000000000007', 'Perfil Teste Sem Papel Seg26', 'sem.papel.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-000000000008', 'Perfil Teste Enfermeira B Seg26', 'enfermeira.b.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-000000000009', 'Perfil Teste Enfermeira C Seg26', 'enfermeira.c.seg26@exemplo.invalid', true),
  ('a2601000-0000-4000-8000-00000000000a', 'Perfil Teste Enfermeira Inativa Seg26', 'enfermeira.inativa.seg26@exemplo.invalid', false);
insert into usuario_papel (usuario_id, papel) values
  ('a2601000-0000-4000-8000-000000000001', 'comercial'),
  ('a2601000-0000-4000-8000-000000000002', 'enfermeira'),
  ('a2601000-0000-4000-8000-000000000003', 'financeiro'),
  ('a2601000-0000-4000-8000-000000000004', 'marketing'),
  ('a2601000-0000-4000-8000-000000000005', 'coordenacao'),
  ('a2601000-0000-4000-8000-000000000006', 'diretoria'),
  ('a2601000-0000-4000-8000-000000000008', 'enfermeira'),
  ('a2601000-0000-4000-8000-000000000009', 'enfermeira'),
  ('a2601000-0000-4000-8000-00000000000a', 'enfermeira');

insert into pacote (id, nome, dias) values ('b2601000-0000-4000-8000-000000000003', 'Pacote Teste Seg26', 3);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2601000-0000-4000-8000-000000000004', 'b2601000-0000-4000-8000-000000000003', 100, 6, '2020-01-01');
insert into profissional (id, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero) values
  ('d2601000-0000-4000-8000-000000000001', 'a2601000-0000-4000-8000-000000000002', 'Enfermeira A Seg26', 'enfermeira_obstetrica', 'COREN', 'SP', 'SEG26-01'),
  ('d2601000-0000-4000-8000-000000000002', 'a2601000-0000-4000-8000-000000000008', 'Enfermeira B Seg26', 'enfermeira_neonatal', 'COREN', 'SP', 'SEG26-02'),
  ('d2601000-0000-4000-8000-000000000003', 'a2601000-0000-4000-8000-000000000009', 'Enfermeira C Seg26', 'enfermeira_neonatal', 'COREN', 'SP', 'SEG26-03'),
  ('d2601000-0000-4000-8000-000000000004', 'a2601000-0000-4000-8000-00000000000a', 'Enfermeira Inativa Seg26', 'enfermeira_neonatal', 'COREN', 'SP', 'SEG26-04');
insert into familia (id, nome_exibicao, dpp, data_nascimento, data_alta) values
  ('c2601000-0000-4000-8000-000000000001', 'Família Teste Aurora Seg26', '2033-01-10', '2033-01-05', '2033-01-07'),
  ('c2601000-0000-4000-8000-000000000002', 'Família Teste Brisa Seg26',  '2033-01-12', '2033-01-06', '2033-01-08');
insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status) values
  ('c2601000-0000-4000-8000-000000000041', 'c2601000-0000-4000-8000-000000000001', 'b2601000-0000-4000-8000-000000000004', 100, 'teste', 'assinado'),
  ('c2601000-0000-4000-8000-000000000042', 'c2601000-0000-4000-8000-000000000002', 'b2601000-0000-4000-8000-000000000004', 100, 'teste', 'assinado');
insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, estado) values
  ('d2601000-0000-4000-8000-000000000011', 'c2601000-0000-4000-8000-000000000041', 'c2601000-0000-4000-8000-000000000001', 3, 6, 'em_execucao'),
  ('d2601000-0000-4000-8000-000000000012', 'c2601000-0000-4000-8000-000000000042', 'c2601000-0000-4000-8000-000000000002', 3, 6, 'em_execucao');
-- A é titular da Aurora, B da Brisa; C só recebeu a oferta de backup da Aurora (não aceitou);
-- a desativada é backup aceita da Brisa (o perfil dela está inativo).
insert into designacao (acompanhamento_id, profissional_id, papel, status) values
  ('d2601000-0000-4000-8000-000000000011', 'd2601000-0000-4000-8000-000000000001', 'titular', 'aceita'),
  ('d2601000-0000-4000-8000-000000000012', 'd2601000-0000-4000-8000-000000000002', 'titular', 'aceita'),
  ('d2601000-0000-4000-8000-000000000012', 'd2601000-0000-4000-8000-000000000004', 'backup', 'aceita');
insert into designacao (acompanhamento_id, profissional_id, papel, status, prazo_resposta_em) values
  ('d2601000-0000-4000-8000-000000000011', 'd2601000-0000-4000-8000-000000000003', 'backup', 'oferecida', now() + interval '20 hours');

-- Um documento de evolução em rascunho por família
insert into relatorio_medico (id, acompanhamento_id, tipo, conteudo, profissional_id) values
  ('e2601000-0000-4000-8000-000000000001', 'd2601000-0000-4000-8000-000000000011', 'puerperal', '{"dados":{},"conteudo":{}}', 'd2601000-0000-4000-8000-000000000001'),
  ('e2601000-0000-4000-8000-000000000002', 'd2601000-0000-4000-8000-000000000012', 'puerperal', '{"dados":{},"conteudo":{}}', 'd2601000-0000-4000-8000-000000000002');

-- Ocorrências: 1 aberta e não privada com a A como responsável; 2 privada com a A;
-- 3 não privada com a B como responsável.
insert into ocorrencia (id, familia_id, tipo, prioridade, privada, titulo, descricao, responsavel_id, sla_vence_em, status) values
  ('e2601000-0000-4000-8000-0000000000a1', 'c2601000-0000-4000-8000-000000000001', 'experiencia', 'normal', false, 'Ocorrência sintética 1', 'Descrição sintética 1',
   'a2601000-0000-4000-8000-000000000002', now() + interval '2 days', 'responsavel_definido'),
  ('e2601000-0000-4000-8000-0000000000a2', 'c2601000-0000-4000-8000-000000000001', 'reclamacao', 'alta', true, 'Ocorrência sintética 2', 'Descrição sintética 2',
   'a2601000-0000-4000-8000-000000000002', now() + interval '2 days', 'responsavel_definido'),
  ('e2601000-0000-4000-8000-0000000000a3', 'c2601000-0000-4000-8000-000000000002', 'experiencia', 'normal', false, 'Ocorrência sintética 3', 'Descrição sintética 3',
   'a2601000-0000-4000-8000-000000000008', now() + interval '2 days', 'responsavel_definido');

-- Pagamentos da equipe: um por enfermeira
insert into privado.pagamento_equipe (id, acompanhamento_id, profissional_id, visitas, horas, valor_hora_centavos, valor_horas_centavos, total_centavos, status, liberado_em) values
  ('e2601000-0000-4000-8000-0000000000b1', 'd2601000-0000-4000-8000-000000000011', 'd2601000-0000-4000-8000-000000000001', 2, 12.0, 10000, 120000, 120000, 'liberado', now()),
  ('e2601000-0000-4000-8000-0000000000b2', 'd2601000-0000-4000-8000-000000000012', 'd2601000-0000-4000-8000-000000000002', 2, 12.0, 10000, 120000, 120000, 'liberado', now());

-- -----------------------------------------------------------------------------
-- 1. Matriz papel x AAL
-- -----------------------------------------------------------------------------

create temp table esperado_fn (fn text primary key, papeis text[] not null, exige_aal2 boolean not null);
insert into esperado_fn values
  ('registrar_inscricao_push',      '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', false),
  ('remover_inscricao_push',        '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', false),
  ('modelo_whatsapp_aprovado',      '{comercial,coordenacao,diretoria}', true),
  ('modelos_whatsapp',              '{comercial,coordenacao,diretoria}', true),
  ('status_entrega_conversa',       '{comercial,coordenacao,diretoria}', true),
  ('whatsapp_janela_horas',         '{comercial,coordenacao,diretoria}', true),
  ('atualizar_ocorrencia',          '{coordenacao,diretoria,enfermeira}', true),
  ('ocorrencia',                    '{coordenacao,diretoria,enfermeira}', true),
  ('ocorrencias',                   '{coordenacao,diretoria,enfermeira}', true),
  ('avancar_pos_venda',             '{coordenacao,diretoria}', true),
  ('capacidade',                    '{coordenacao,diretoria}', true),
  ('gerar_link_pesquisa',           '{coordenacao,diretoria}', true),
  ('marcar_pesquisa_enviada',       '{coordenacao,diretoria}', true),
  ('pos_vendas',                    '{coordenacao,diretoria}', true),
  ('registrar_ocorrencia',          '{coordenacao,diretoria}', true),
  ('responsaveis_ocorrencia',       '{coordenacao,diretoria}', true),
  ('aprovar_evolucao',              '{coordenacao}', true),
  ('dados_envio_evolucao',          '{coordenacao}', true),
  ('devolver_evolucao',             '{coordenacao}', true),
  ('registrar_envio_evolucao',      '{coordenacao}', true),
  ('atualizar_status_modelo_whatsapp', '{diretoria}', true),
  ('painel_executivo',              '{diretoria}', true),
  ('salvar_modelo_whatsapp',        '{diretoria}', true),
  ('base_evolucao',                 '{enfermeira,coordenacao,diretoria}', true),
  ('evolucao',                      '{enfermeira,coordenacao,diretoria}', true),
  ('evolucoes',                     '{enfermeira,coordenacao,diretoria}', true),
  ('pdf_evolucao',                  '{enfermeira,coordenacao,diretoria}', true),
  ('enviar_evolucao_para_revisao',  '{enfermeira,coordenacao}', true),
  ('salvar_evolucao',               '{enfermeira,coordenacao}', true),
  ('meus_pagamentos',               '{enfermeira}', true),
  ('arquivo_da_nota',               '{financeiro,diretoria}', true),
  ('dados_emissao_nota',            '{financeiro,diretoria}', true),
  ('despesas',                      '{financeiro,diretoria}', true),
  ('dre',                           '{financeiro,diretoria}', true),
  ('extrato',                       '{financeiro,diretoria}', true),
  ('importar_extrato',              '{financeiro,diretoria}', true),
  ('inadimplencia',                 '{financeiro,diretoria}', true),
  ('iniciar_emissao_nota',          '{financeiro,diretoria}', true),
  ('lancamentos',                   '{financeiro,diretoria}', true),
  ('nota_fiscal',                   '{financeiro,diretoria}', true),
  ('notas_fiscais',                 '{financeiro,diretoria}', true),
  ('pagamentos_equipe',             '{financeiro,diretoria}', true),
  ('pagar_equipe',                  '{financeiro,diretoria}', true),
  ('previsao_recebimentos',         '{financeiro,diretoria}', true),
  ('reconciliar_extrato',           '{financeiro,diretoria}', true),
  ('registrar_nota_manual',         '{financeiro,diretoria}', true),
  ('registrar_resultado_nota',      '{financeiro,diretoria}', true),
  ('remover_despesa',               '{financeiro,diretoria}', true),
  ('salvar_despesa',                '{financeiro,diretoria}', true);
grant all on esperado_fn to public;

create temp table observado (fn text, papel text, aal text, resultado text);
grant all on observado to public;

-- Cada chamada roda numa subtransação. Recusa 42501 = negado; qualquer outro
-- desfecho (sucesso ou recusa de negócio) = a porta abriu.
do $$
declare
  v_fn    record;
  v_papel record;
  v_aal   text;
  v_res   text;
  v_args  text;
begin
  for v_fn in select e.fn, p.oid from esperado_fn e join pg_proc p on p.proname = e.fn and p.pronamespace = 'api'::regnamespace loop
    select coalesce(string_agg('null::' || format_type(t, null), ', '), '')
      into v_args
    from unnest((select proargtypes::oid[] from pg_proc where oid = v_fn.oid)) t;
    for v_papel in select * from (values
        ('a2601000-0000-4000-8000-000000000001', 'comercial'), ('a2601000-0000-4000-8000-000000000002', 'enfermeira'),
        ('a2601000-0000-4000-8000-000000000003', 'financeiro'), ('a2601000-0000-4000-8000-000000000004', 'marketing'),
        ('a2601000-0000-4000-8000-000000000005', 'coordenacao'), ('a2601000-0000-4000-8000-000000000006', 'diretoria'),
        ('a2601000-0000-4000-8000-000000000007', 'sem_papel')) x(id, papel) loop
      foreach v_aal in array array['aal1', 'aal2'] loop
        perform testes.autenticar_authenticated(v_papel.id::uuid, v_aal);
        begin
          execute 'select api.' || v_fn.fn || '(' || v_args || ')';
          v_res := 'aberta';
        exception when insufficient_privilege then
          v_res := 'negada';
        when others then
          v_res := 'aberta';
        end;
        perform testes.encerrar();
        insert into observado values (v_fn.fn, v_papel.papel, v_aal, v_res);
      end loop;
    end loop;
    perform testes.autenticar_anon();
    begin
      execute 'select api.' || v_fn.fn || '(' || v_args || ')';
      v_res := 'aberta';
    exception when insufficient_privilege then
      v_res := 'negada';
    when others then
      v_res := 'aberta';
    end;
    perform testes.encerrar();
    insert into observado values (v_fn.fn, 'anon', 'sem_sessao', v_res);
  end loop;
end $$;

select is((select count(*)::integer from observado), 49 * 15,
  'a matriz chamou as 49 funções, em 7 papéis (um sem papel) e 2 níveis de AAL, mais o anônimo');

select is_empty(
  $$ select o.fn, o.papel, o.aal, o.resultado
     from observado o join esperado_fn e on e.fn = o.fn
     where o.papel <> 'anon'
       and o.resultado <> case
         when o.papel = any (e.papeis)
              and (o.aal = 'aal2' or (not e.exige_aal2 and o.papel in ('comercial', 'marketing')))
         then 'aberta' else 'negada' end $$,
  'cada função abre só para o papel certo, e pede o AAL2 de quem tem MFA ou da função que o exige');

select is_empty(
  $$ select o.fn from observado o where o.papel = 'anon' and o.resultado <> 'negada' $$,
  'o anônimo não executa nenhuma função de api desta onda');

select is_empty(
  $$ select o.fn, o.papel from observado o where o.papel = 'sem_papel' and o.resultado <> 'negada' $$,
  'quem tem perfil mas nenhum papel não abre nenhuma função de api desta onda');

-- -----------------------------------------------------------------------------
-- 2. Concessões
-- -----------------------------------------------------------------------------

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join esperado_fn e on e.fn = p.proname
     where p.pronamespace = 'api'::regnamespace
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute')
            or not has_function_privilege('authenticated', p.oid, 'execute')
            or not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)) $$,
  'as 49 funções de api: authenticated executa; anon e service_role não; security definer com search_path vazio');

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('pesquisa_abrir', 'pesquisa_enviar', 'nota_para_emissao_automatica', 'nota_registrar_resultado',
                         'inscricoes_push', 'inscricao_push_expirada', 'mensagem_registrar_status',
                         'saude_registrar_webhook', 'saude_sistema')
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
            or not has_function_privilege('service_role', p.oid, 'execute')
            or not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)) $$,
  'as nove funções de servidor de public: só service_role executa, security definer e search_path vazio');

select is((select count(*)::integer from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('pesquisa_abrir', 'pesquisa_enviar', 'nota_para_emissao_automatica', 'nota_registrar_resultado',
                                'inscricoes_push', 'inscricao_push_expirada', 'mensagem_registrar_status',
                                'saude_registrar_webhook', 'saude_sistema')), 9,
  'as nove funções de servidor existem');

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace in ('privado'::regnamespace, 'assistencial'::regnamespace)
       and p.proname ~ '^(recusar|hoje_sp|dias_uteis_apos|evolucao_|evolucoes_faltando|data_conclusao_atendimento|ler_base_evolucao|ler_evolucoes|ler_relatorio_medico|salvar_relatorio_medico|ocorrencia_|avisar_ocorrencias|pesquisa_|nota_|modelo_whatsapp|mensagem_status|gestao_|capacidade_|dre_|pagamento_equipe|despesa_|extrato_|painel_|inicio_do_mes)'
       and p.proname not in ('tem_papel', 'familias_atribuidas')
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'as funções internas de privado e assistencial desta onda não são executáveis por nenhum papel do app');

-- -----------------------------------------------------------------------------
-- 3. Escrita direta que só as funções deviam permitir
-- -----------------------------------------------------------------------------

-- ocorrencia: o histórico, o SLA e a prioridade mudam por api.atualizar_ocorrencia
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($s$ update ocorrencia set historico = '[]'::jsonb where id = 'e2601000-0000-4000-8000-0000000000a1' $s$, '42501', null,
  'a enfermeira responsável não apaga o histórico da ocorrência pela tabela');
select throws_ok($s$ update ocorrencia set sla_vence_em = now() + interval '90 days' where id = 'e2601000-0000-4000-8000-0000000000a1' $s$, '42501', null,
  'a enfermeira responsável não estica o SLA pela tabela');
select throws_ok($s$ update ocorrencia set prioridade = 'normal', responsavel_id = null where id = 'e2601000-0000-4000-8000-0000000000a1' $s$, '42501', null,
  'a enfermeira responsável não muda prioridade nem responsável pela tabela (a API só deixa o status e o histórico)');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ update ocorrencia set status = 'encerrada', historico = '[]'::jsonb where id = 'e2601000-0000-4000-8000-0000000000a1' $s$, '42501', null,
  'a coordenação não muda a ocorrência pela tabela: as regras de andamento moram na função');
select throws_ok($s$ insert into ocorrencia (tipo, prioridade, titulo, descricao) values ('outro', 'normal', 'Direta', 'Direta sem SLA') $s$, '42501', null,
  'a coordenação não abre ocorrência pela tabela: o SLA e o aviso nascem em api.registrar_ocorrencia');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ update ocorrencia set privada = false where id = 'e2601000-0000-4000-8000-0000000000a2' $s$, '42501', null,
  'a diretoria não abre uma ocorrência privada pela tabela');

-- pos_venda: NPS, classificação e respostas só entram por public.pesquisa_enviar
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ update pos_venda set nps = 10, classificacao = 'promotor' $s$, '42501', null,
  'a coordenação não escreve NPS nem classificação pela tabela');
select throws_ok($s$ update pos_venda set respostas = '{"nps":10}'::jsonb, depoimento_autorizado = true, autorizacao_imagem = true $s$, '42501', null,
  'a coordenação não forja resposta nem autorização de depoimento e de imagem pela tabela');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ update pos_venda set pesquisa_enviada_em = now() $s$, '42501', null,
  'a diretoria não marca pesquisa como enviada pela tabela: o link nasce em api.gerar_link_pesquisa');

-- nota_fiscal: a nota emitida vem do provedor (ou do registro manual conferido pela função)
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ update nota_fiscal set status = 'emitida', numero = '999' $s$, '42501', null,
  'o financeiro não dá uma nota por emitida pela tabela');
select throws_ok($s$ update nota_fiscal set pdf_path = 'notas/x.pdf', xml_path = 'notas/x.xml', provider_ref = 'x' $s$, '42501', null,
  'o financeiro não troca o arquivo nem a referência da nota pela tabela');
select throws_ok($s$ insert into nota_fiscal (cobranca_id, status) values ('e2601000-0000-4000-8000-0000000000ff', 'emitida') $s$, '42501', null,
  'o financeiro não inclui nota pela tabela');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ update nota_fiscal set status = 'emitida' $s$, '42501', null,
  'a diretoria também não muda a nota pela tabela');
select testes.encerrar();

-- e o que as funções fazem continua funcionando
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000002', 'aal2');
select lives_ok($s$ select api.atualizar_ocorrencia('e2601000-0000-4000-8000-0000000000a1', 'em_acompanhamento', null, null, null, 'Nota sintética', null) $s$,
  'a enfermeira responsável ainda muda o andamento da própria ocorrência pela função');
select testes.encerrar();
select is((select status::text from ocorrencia where id = 'e2601000-0000-4000-8000-0000000000a1'), 'em_acompanhamento',
  'a mudança pela função ficou gravada');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000005', 'aal2');
select lives_ok($s$ select api.atualizar_ocorrencia('e2601000-0000-4000-8000-0000000000a1', null, null, 'maxima', null, null, null) $s$,
  'a coordenação ainda muda a prioridade pela função');
select testes.encerrar();

-- Tabela assistencial: nenhum select direto
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select conteudo from relatorio_medico $s$, '42501', null,
  'a coordenação não lê a evolução pela tabela (só por assistencial.ler_*, com auditoria)');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($s$ select * from relatorio_medico $s$, '42501', null,
  'a enfermeira também não lê a evolução pela tabela');
select throws_ok($s$ insert into relatorio_medico (acompanhamento_id, tipo, conteudo, profissional_id)
                     values ('d2601000-0000-4000-8000-000000000011', 'neonatal', '{"dados":{},"conteudo":{}}', 'd2601000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'a enfermeira não grava a evolução pela tabela');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 4. IDOR
-- -----------------------------------------------------------------------------

-- Evolução: só quem atende a família (ou a coordenação e a diretoria) abre
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000002', 'aal2');
select lives_ok($s$ select api.base_evolucao('d2601000-0000-4000-8000-000000000011') $s$, 'a enfermeira A abre a base da evolução da Aurora');
select lives_ok($s$ select api.evolucao('e2601000-0000-4000-8000-000000000001') $s$, 'a enfermeira A abre o documento da Aurora');
select throws_ok($s$ select api.base_evolucao('d2601000-0000-4000-8000-000000000012') $s$, '42501', null,
  'a enfermeira A não abre a base da evolução da Brisa');
select throws_ok($s$ select api.evolucao('e2601000-0000-4000-8000-000000000002') $s$, '42501', null,
  'a enfermeira A não abre o documento da Brisa');
select throws_ok($s$ select api.pdf_evolucao('e2601000-0000-4000-8000-000000000002') $s$, '42501', null,
  'a enfermeira A não pede o PDF da Brisa');
select throws_ok($s$ select api.enviar_evolucao_para_revisao('e2601000-0000-4000-8000-000000000002') $s$, '42501', null,
  'a enfermeira A não entrega para revisão o documento da Brisa');
select throws_ok($s$ select api.salvar_evolucao('d2601000-0000-4000-8000-000000000012', 'puerperal', null,
                       '{"dados":{},"conteudo":{}}'::jsonb, '[]'::jsonb) $s$, '42501', null,
  'a enfermeira A não grava evolução na Brisa');
select is(position('e2601000-0000-4000-8000-000000000002' in api.evolucoes('todas')::text) + position('c2601000-0000-4000-8000-000000000002' in api.evolucoes('todas')::text), 0,
  'a lista de evoluções da enfermeira A não traz a Brisa');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($s$ select api.base_evolucao('d2601000-0000-4000-8000-000000000011') $s$, '42501', null,
  'a enfermeira C, que só recebeu a oferta de backup, não abre a base da Aurora');
select throws_ok($s$ select api.evolucao('e2601000-0000-4000-8000-000000000001') $s$, '42501', null,
  'a enfermeira C não abre o documento da Aurora');
select throws_ok($s$ select api.salvar_evolucao('d2601000-0000-4000-8000-000000000011', 'puerperal', null,
                       '{"dados":{},"conteudo":{"texto":"x"}}'::jsonb, '[]'::jsonb) $s$, '42501', null,
  'a enfermeira C não grava evolução na Aurora');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-00000000000a', 'aal2');
select throws_ok($s$ select api.base_evolucao('d2601000-0000-4000-8000-000000000012') $s$, '42501', null,
  'a enfermeira desativada, ainda com designação aceita, não abre a base da Brisa');
select throws_ok($s$ select api.evolucao('e2601000-0000-4000-8000-000000000002') $s$, '42501', null,
  'a enfermeira desativada não abre o documento da Brisa');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000006', 'aal2');
select lives_ok($s$ select api.evolucao('e2601000-0000-4000-8000-000000000001') $s$, 'a diretoria lê a evolução');
select testes.encerrar();

-- Ocorrência: a responsável vê e mexe só na não privada que é dela
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000002', 'aal2');
select lives_ok($s$ select api.ocorrencia('e2601000-0000-4000-8000-0000000000a1') $s$, 'a responsável lê a ocorrência não privada dela');
select throws_like($s$ select api.ocorrencia('e2601000-0000-4000-8000-0000000000a2') $s$, '%ocorrencia:inexistente%',
  'a responsável não lê a ocorrência privada, mesmo sendo a responsável');
select throws_like($s$ select api.ocorrencia('e2601000-0000-4000-8000-0000000000a3') $s$, '%ocorrencia:inexistente%',
  'a enfermeira A não lê a ocorrência de que é a B a responsável');
select is(position('e2601000-0000-4000-8000-0000000000a2' in api.ocorrencias('todas', null)::text)
          + position('e2601000-0000-4000-8000-0000000000a3' in api.ocorrencias('todas', null)::text), 0,
  'a lista da responsável não traz a privada nem a de outra pessoa');
select is(position('e2601000-0000-4000-8000-0000000000a3' in api.ocorrencias('todas', 'c2601000-0000-4000-8000-000000000002')::text), 0,
  'filtrar pela família de outra pessoa não abre a ocorrência dela');
select throws_like($s$ select api.atualizar_ocorrencia('e2601000-0000-4000-8000-0000000000a3', 'em_acompanhamento', null, null, null, 'x', null) $s$,
  '%ocorrencia:inexistente%', 'a enfermeira A não mexe na ocorrência da B');
select throws_like($s$ select api.atualizar_ocorrencia('e2601000-0000-4000-8000-0000000000a2', 'em_acompanhamento', null, null, null, 'x', null) $s$,
  '%ocorrencia:inexistente%', 'a responsável não mexe na ocorrência privada');
select throws_ok($s$ select api.atualizar_ocorrencia('e2601000-0000-4000-8000-0000000000a1', null, 'a2601000-0000-4000-8000-000000000008', null, null, null, null) $s$,
  '42501', null, 'a responsável não passa a ocorrência a outra pessoa');
select throws_ok($s$ select api.atualizar_ocorrencia('e2601000-0000-4000-8000-0000000000a1', null, null, null, true, null, null) $s$,
  '42501', null, 'a responsável não torna a ocorrência privada');
select throws_ok($s$ select api.registrar_ocorrencia(null, null, 'outro', 'normal', false, 'Título', 'Descrição', null) $s$,
  '42501', null, 'a enfermeira não abre ocorrência');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000005', 'aal2');
select lives_ok($s$ select api.ocorrencia('e2601000-0000-4000-8000-0000000000a2') $s$, 'a coordenação lê a ocorrência privada');
select testes.encerrar();

-- Pagamento: a enfermeira lê só o dela
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000002', 'aal2');
select is(jsonb_array_length(api.meus_pagamentos() -> 'pagamentos'), 1, 'a enfermeira A vê um pagamento');
select is(position('e2601000-0000-4000-8000-0000000000b2' in api.meus_pagamentos()::text), 0, 'a enfermeira A não vê o pagamento da B');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000009', 'aal2');
select is(jsonb_array_length(api.meus_pagamentos() -> 'pagamentos'), 0, 'a enfermeira C, sem pagamento, não vê o de ninguém');
select throws_ok($s$ select api.pagar_equipe('e2601000-0000-4000-8000-0000000000b2', current_date) $s$, '42501', null,
  'a enfermeira não paga a equipe');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.pagar_equipe('e2601000-0000-4000-8000-0000000000b2', current_date) $s$, '42501', null,
  'nem a coordenação paga a equipe (financeiro e diretoria)');
select testes.encerrar();

-- Push: a inscrição é do aparelho da pessoa logada
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000002', 'aal2');
select lives_ok($s$ select api.registrar_inscricao_push('https://push.exemplo.invalid/seg26-a', '{"p256dh":"x","auth":"y"}'::jsonb) $s$,
  'a enfermeira A inscreve o aparelho dela');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000008', 'aal2');
select lives_ok($s$ select api.remover_inscricao_push('https://push.exemplo.invalid/seg26-a') $s$,
  'a enfermeira B tenta remover a inscrição da A (a função aceita e não apaga nada)');
select testes.encerrar();
select is((select count(*)::integer from privado.inscricao_push where endpoint = 'https://push.exemplo.invalid/seg26-a'
            and usuario_id = 'a2601000-0000-4000-8000-000000000002'), 1,
  'a inscrição da A continua lá: ninguém remove a inscrição de outra pessoa');

-- Cloud API: o cadastro dos modelos é da diretoria, a leitura é do comercial em diante
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.salvar_modelo_whatsapp(null, 'lembrete_sessao', 'kz_x', 'utilidade', 'pt_BR', array['a'], 'Oi {{1}}', '{}'::jsonb) $s$,
  '42501', null, 'a coordenação não cadastra modelo da Cloud API');
select testes.autenticar_authenticated('a2601000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.atualizar_status_modelo_whatsapp(null, 'aprovado', null) $s$, '42501', null,
  'o comercial não aprova modelo da Cloud API');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 5. Tabelas novas de privado
-- -----------------------------------------------------------------------------

select is_empty(
  $$ select c.oid::regclass::text from pg_class c
     where c.relnamespace = 'privado'::regnamespace and c.relkind in ('r', 'v')
       and c.relname in ('pesquisa_tentativa', 'modelo_whatsapp', 'mensagem_status', 'inscricao_push', 'saude_webhook',
                         'capacidade_contratos', 'despesa', 'pagamento_equipe', 'extrato_importacao', 'extrato_linha')
       and ((c.relkind = 'r' and not c.relrowsecurity)
            or has_table_privilege('anon', c.oid, 'select,insert,update,delete')
            or has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')
            or has_table_privilege('service_role', c.oid, 'select,insert,update,delete')) $$,
  'as tabelas novas de privado: RLS ligada e nenhuma concessão a anon, authenticated nem service_role');

select is((select count(*)::integer from pg_class c where c.relnamespace = 'privado'::regnamespace and c.relkind in ('r', 'v')
            and c.relname in ('pesquisa_tentativa', 'modelo_whatsapp', 'mensagem_status', 'inscricao_push', 'saude_webhook',
                              'capacidade_contratos', 'despesa', 'pagamento_equipe', 'extrato_importacao', 'extrato_linha')), 10,
  'as dez tabelas e views novas de privado existem');

select is_empty(
  $$ select t.tabela from (values ('modelo_whatsapp'), ('inscricao_push'), ('despesa'), ('pagamento_equipe'),
                                  ('extrato_importacao'), ('extrato_linha')) t(tabela)
     where not exists (select 1 from pg_trigger g where g.tgrelid = ('privado.' || t.tabela)::regclass and g.tgname = 'auditar') $$,
  'as tabelas que guardam alteração têm o gatilho de auditoria');

select * from finish();
rollback;
