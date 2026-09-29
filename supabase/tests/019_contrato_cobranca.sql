-- =============================================================================
-- supabase/tests/019_contrato_cobranca.sql
--
-- Migration 0019_contrato_cobranca (P31 contrato e assinatura eletrônica,
-- P32 cobrança pela InfinitePay):
--   1. Escrita direta fechada em contrato e cobranca; api.transicionar recusa
--      os cinco estágios do fluxo de contrato e pagamento.
--   2. Situação do contrato, dados para o PDF (CPF completo, leitura no log),
--      contrato gerado, envio em três passos (dois cliques nunca criam dois
--      documentos).
--   3. Webhook da Autentique: só service_role, forjado não muda nada,
--      duplicado não repete, pos_assinatura cria uma cobrança (P2 avança).
--   4. Cobrança: link (só https, um por cobrança, tarefa com o texto
--      link_pagamento), parcelamento acima do limite sem link.
--   5. Webhook da InfinitePay: valor abaixo não baixa, duplicado não repete,
--      P2 pagamento_confirmado, nota fiscal pendente, tarefa de mensagem,
--      prenatal_urgente com 34 semanas ou mais.
--   6. Baixa manual: comprovante, motivo e valor.
--   7. Freio: contrato assinado de família em bloqueio_total não gera cobrança
--      sozinho; pagamento em cobrança cancelada não baixa.
--   8. Privilégios e log de auditoria sem CPF.
--
-- Só dado sintético, criado aqui e desfeito no rollback. DPPs em 2033 (menos
-- a da família urgente) e telefones próprios, para não cruzar com o seed.
-- =============================================================================

begin;

select plan(186);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a1900000-0000-4000-8000-000000000001', 'comercial.p31@exemplo.invalid'),
  ('a1900000-0000-4000-8000-000000000002', 'financeiro.p31@exemplo.invalid'),
  ('a1900000-0000-4000-8000-000000000003', 'diretoria.p31@exemplo.invalid'),
  ('a1900000-0000-4000-8000-000000000004', 'coordenacao.p31@exemplo.invalid'),
  ('a1900000-0000-4000-8000-000000000005', 'enfermeira.p31@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a1900000-0000-4000-8000-000000000001', 'Otávio Teste Comercial P31',  'comercial.p31@exemplo.invalid',   true),
  ('a1900000-0000-4000-8000-000000000002', 'Perfil Teste Financeiro P31', 'financeiro.p31@exemplo.invalid',  true),
  ('a1900000-0000-4000-8000-000000000003', 'Perfil Teste Diretoria P31',  'diretoria.p31@exemplo.invalid',   true),
  ('a1900000-0000-4000-8000-000000000004', 'Perfil Teste Coordenação P31', 'coordenacao.p31@exemplo.invalid', true),
  ('a1900000-0000-4000-8000-000000000005', 'Perfil Teste Enfermeira P31', 'enfermeira.p31@exemplo.invalid',  true);

insert into usuario_papel (usuario_id, papel) values
  ('a1900000-0000-4000-8000-000000000001', 'comercial'),
  ('a1900000-0000-4000-8000-000000000002', 'financeiro'),
  ('a1900000-0000-4000-8000-000000000003', 'diretoria'),
  ('a1900000-0000-4000-8000-000000000004', 'coordenacao'),
  ('a1900000-0000-4000-8000-000000000005', 'enfermeira');

-- parâmetros do teste (não dependem do seed)
insert into parametro (chave, valor) values
  ('contrato_modelo', '{"versao":"C-11 teste","aprovado":false,"clausulas":[{"titulo":"1. Objeto","texto":"Texto de teste."}]}'),
  ('contrato_kraamzorg', '{"signatario_nome":"Representante Teste","signatario_email":"assina.p31@exemplo.invalid"}'),
  ('cobranca', '{"vencimento_dias":3,"descricao_item":"Cuidado domiciliar pós-parto","prenatal_urgente_semanas":34}')
on conflict (chave) do update set valor = excluded.valor;
update automacao set ativa = true where id in ('pos_assinatura', 'pagamento_confirmado', 'prenatal_urgente');

-- textos do seed usados pelas tarefas (garante que existem no teste)
insert into mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  ('link_pagamento', 'whatsapp', 'familia', 'Contrato assinado, obrigado! Aqui está o link de pagamento: {link}. Dá para pagar no cartão em até 3x sem juros ou no Pix.', array['link'], 'rascunho'),
  ('pagamento_confirmado', 'whatsapp', 'familia', 'Pagamento confirmado, {nome}. Obrigado pela confiança.', array['nome'], 'rascunho'),
  ('pagamento_confirmado_34s', 'whatsapp', 'familia', 'Pagamento confirmado, {nome}. Como você já está com {semanas} semanas, a Edilaine vai te chamar nos próximos dias.', array['nome','semanas'], 'rascunho')
on conflict (chave) do update set texto = excluded.texto;

create temp table t_r (chave text primary key, r jsonb) on commit drop;
grant all on t_r to public;

insert into familia (id, nome_exibicao, dpp, estado_sensivel) values
  ('c1900000-0000-4000-8000-000000000001', 'Família Teste Fluxo',    '2033-06-10', 'normal'),
  ('c1900000-0000-4000-8000-000000000002', 'Família Teste Urgente',  current_date + 40, 'normal'),
  ('c1900000-0000-4000-8000-000000000003', 'Família Teste Presente P31', '2033-06-14', 'normal'),
  ('c1900000-0000-4000-8000-000000000004', 'Família Teste Freio P31', '2033-06-16', 'bloqueio_total'),
  ('c1900000-0000-4000-8000-000000000005', 'Família Teste Limite',   '2033-06-18', 'normal'),
  ('c1900000-0000-4000-8000-000000000006', 'Família Teste Manual',   '2033-06-20', 'normal'),
  ('c1900000-0000-4000-8000-000000000007', 'Família Teste Cancelada', '2033-06-22', 'normal'),
  ('c1900000-0000-4000-8000-000000000008', 'Família Teste Sem Contrato P31', '2033-06-24', 'normal'),
  ('c1900000-0000-4000-8000-000000000009', 'Família Teste Pendente P31', '2033-06-26', 'normal');

insert into pessoa (id, familia_id, papel, nome, telefone_e164, email, contato_principal) values
  ('d1900000-0000-4000-8000-000000000001', 'c1900000-0000-4000-8000-000000000001', 'mae',      'Marina Teste Fluxo',    '+5511900001901', 'marina.fluxo@exemplo.invalid', true),
  ('d1900000-0000-4000-8000-000000000011', 'c1900000-0000-4000-8000-000000000001', 'parceiro', 'Rafael Teste Fluxo',    '+5511900001911', 'rafael.fluxo@exemplo.invalid', false),
  ('d1900000-0000-4000-8000-000000000002', 'c1900000-0000-4000-8000-000000000002', 'mae',      'Paula Teste Urgente',   '+5511900001902', 'paula.urgente@exemplo.invalid', true),
  ('d1900000-0000-4000-8000-000000000003', 'c1900000-0000-4000-8000-000000000003', 'mae',      'Joana Teste Presente P31', '+5511900001903', 'joana.presente@exemplo.invalid', true),
  ('d1900000-0000-4000-8000-000000000013', 'c1900000-0000-4000-8000-000000000003', 'presenteador', 'Carla Teste Presenteadora', '+5511900001913', 'carla.presente@exemplo.invalid', false),
  ('d1900000-0000-4000-8000-000000000004', 'c1900000-0000-4000-8000-000000000004', 'mae',      'Alice Teste Freio P31', '+5511900001904', 'alice.freio@exemplo.invalid', true),
  ('d1900000-0000-4000-8000-000000000005', 'c1900000-0000-4000-8000-000000000005', 'mae',      'Bianca Teste Limite',   '+5511900001905', 'bianca.limite@exemplo.invalid', true),
  ('d1900000-0000-4000-8000-000000000006', 'c1900000-0000-4000-8000-000000000006', 'mae',      'Clara Teste Manual',    '+5511900001906', 'clara.manual@exemplo.invalid', true),
  ('d1900000-0000-4000-8000-000000000007', 'c1900000-0000-4000-8000-000000000007', 'mae',      'Diana Teste Cancelada', '+5511900001907', 'diana.cancelada@exemplo.invalid', true),
  ('d1900000-0000-4000-8000-000000000009', 'c1900000-0000-4000-8000-000000000009', 'mae',      'Elisa Teste Pendente P31', '+5511900001909', 'elisa.pendente@exemplo.invalid', true);

insert into pessoa_dados_contrato (pessoa_id, cpf, data_nascimento, endereco_residencial) values
  ('d1900000-0000-4000-8000-000000000001', '11144477735', '1992-03-04',
   '{"cep":"01310-100","logradouro":"Rua de Teste","numero":"100","bairro":"Bairro de Teste","cidade":"São Paulo","uf":"SP"}'),
  ('d1900000-0000-4000-8000-000000000003', '52998224725', '1993-04-05',
   '{"cep":"01310-100","logradouro":"Rua de Teste","numero":"200","bairro":"Bairro de Teste","cidade":"São Paulo","uf":"SP"}'),
  ('d1900000-0000-4000-8000-000000000013', '39053344705', null,
   '{"cep":"01310-100","logradouro":"Rua de Teste","numero":"300","bairro":"Bairro de Teste","cidade":"São Paulo","uf":"SP"}');

insert into t_r select 'essencial', to_jsonb(pv.id) from pacote_versao pv join pacote p on p.id = pv.pacote_id
  where p.nome = 'Essencial' and pv.vigencia_fim is null;

insert into oportunidade (id, familia_id, pipeline, estagio_p1, estagio_p2, para_quem, responsavel_id) values
  ('e1900000-0000-4000-8000-000000000001', 'c1900000-0000-4000-8000-000000000001', 2, 'qualificado', 'ganho',                 'propria', 'a1900000-0000-4000-8000-000000000001'),
  ('e1900000-0000-4000-8000-000000000002', 'c1900000-0000-4000-8000-000000000002', 2, 'qualificado', 'aguardando_assinatura', 'propria', 'a1900000-0000-4000-8000-000000000001'),
  ('e1900000-0000-4000-8000-000000000003', 'c1900000-0000-4000-8000-000000000003', 2, 'qualificado', 'ganho',                 'presente', 'a1900000-0000-4000-8000-000000000001'),
  ('e1900000-0000-4000-8000-000000000004', 'c1900000-0000-4000-8000-000000000004', 2, 'qualificado', 'aguardando_assinatura', 'propria', null),
  ('e1900000-0000-4000-8000-000000000005', 'c1900000-0000-4000-8000-000000000005', 2, 'qualificado', 'aguardando_assinatura', 'propria', 'a1900000-0000-4000-8000-000000000001'),
  ('e1900000-0000-4000-8000-000000000006', 'c1900000-0000-4000-8000-000000000006', 2, 'qualificado', 'cobranca_gerada',      'propria', 'a1900000-0000-4000-8000-000000000001'),
  ('e1900000-0000-4000-8000-000000000007', 'c1900000-0000-4000-8000-000000000007', 2, 'qualificado', 'cobranca_gerada',      'propria', null),
  ('e1900000-0000-4000-8000-000000000008', 'c1900000-0000-4000-8000-000000000008', 1, 'qualificado', null,                   'propria', null),
  ('e1900000-0000-4000-8000-000000000009', 'c1900000-0000-4000-8000-000000000009', 2, 'qualificado', 'ganho',                 'propria', null);

-- A: formulário recebido, pronto para gerar (Essencial, 3x, taxa R$ 350)
-- C: presente, formulário recebido; I: formulário ainda não recebido
insert into contrato (id, familia_id, pacote_versao_id, contratante_pessoa_id, pagador_pessoa_id, testemunha_pessoa_id,
                      valor_centavos, taxa_deslocamento_centavos, desconto_centavos, parcelas, template_versao, status,
                      formulario_token_hash, formulario_expira_em, autentique_doc_id, enviado_em, assinado_em, pdf_path) values
  ('b1900000-0000-4000-8000-000000000001', 'c1900000-0000-4000-8000-000000000001', (select (r #>> '{}')::uuid from t_r where chave = 'essencial'),
   'd1900000-0000-4000-8000-000000000001', null, 'd1900000-0000-4000-8000-000000000011',
   420000, 35000, 0, 3, 'C-11 antigo', 'aguardando_dados', null, now() - interval '1 hour', null, null, null, null),
  ('b1900000-0000-4000-8000-000000000002', 'c1900000-0000-4000-8000-000000000002', (select (r #>> '{}')::uuid from t_r where chave = 'essencial'),
   'd1900000-0000-4000-8000-000000000002', null, null,
   420000, 0, 0, 3, 'C-11 teste', 'enviado', null, now() - interval '3 hours', 'doc-urgente-0001', now() - interval '2 hours', null, 'contratos/b1900000-0000-4000-8000-000000000002.pdf'),
  ('b1900000-0000-4000-8000-000000000003', 'c1900000-0000-4000-8000-000000000003', (select (r #>> '{}')::uuid from t_r where chave = 'essencial'),
   'd1900000-0000-4000-8000-000000000003', 'd1900000-0000-4000-8000-000000000013', null,
   420000, 0, 0, 1, 'C-11 antigo', 'aguardando_dados', null, now() - interval '1 hour', null, null, null, null),
  ('b1900000-0000-4000-8000-000000000004', 'c1900000-0000-4000-8000-000000000004', (select (r #>> '{}')::uuid from t_r where chave = 'essencial'),
   'd1900000-0000-4000-8000-000000000004', null, null,
   420000, 0, 0, 3, 'C-11 teste', 'enviado', null, now() - interval '3 hours', 'doc-freio-00001', now() - interval '2 hours', null, 'contratos/b1900000-0000-4000-8000-000000000004.pdf'),
  ('b1900000-0000-4000-8000-000000000005', 'c1900000-0000-4000-8000-000000000005', (select (r #>> '{}')::uuid from t_r where chave = 'essencial'),
   'd1900000-0000-4000-8000-000000000005', null, null,
   420000, 0, 0, 5, 'C-11 teste', 'enviado', null, now() - interval '3 hours', 'doc-limite-0001', now() - interval '2 hours', null, 'contratos/b1900000-0000-4000-8000-000000000005.pdf'),
  ('b1900000-0000-4000-8000-000000000006', 'c1900000-0000-4000-8000-000000000006', (select (r #>> '{}')::uuid from t_r where chave = 'essencial'),
   'd1900000-0000-4000-8000-000000000006', null, null,
   420000, 0, 0, 1, 'C-11 teste', 'assinado', null, now() - interval '3 hours', 'doc-manual-0001', now() - interval '2 hours', now() - interval '1 hour', 'contratos/b1900000-0000-4000-8000-000000000006-assinado.pdf'),
  ('b1900000-0000-4000-8000-000000000007', 'c1900000-0000-4000-8000-000000000007', (select (r #>> '{}')::uuid from t_r where chave = 'essencial'),
   'd1900000-0000-4000-8000-000000000007', null, null,
   420000, 0, 0, 1, 'C-11 teste', 'assinado', null, now() - interval '3 hours', 'doc-cancel-0001', now() - interval '2 hours', now() - interval '1 hour', 'contratos/b1900000-0000-4000-8000-000000000007-assinado.pdf'),
  ('b1900000-0000-4000-8000-000000000009', 'c1900000-0000-4000-8000-000000000009', (select (r #>> '{}')::uuid from t_r where chave = 'essencial'),
   'd1900000-0000-4000-8000-000000000009', null, null,
   420000, 0, 0, 1, 'C-11 teste', 'aguardando_dados',
   encode(extensions.digest('token-pendente-p31', 'sha256'), 'hex'), now() + interval '1 hour', null, null, null, null);

insert into cobranca (id, contrato_id, parcela, valor_centavos, vencimento, external_id, status) values
  ('ca900000-0000-4000-8000-000000000006', 'b1900000-0000-4000-8000-000000000006', 1, 420000, current_date + 3, 'ca900000-0000-4000-8000-000000000006', 'aberta'),
  ('ca900000-0000-4000-8000-000000000007', 'b1900000-0000-4000-8000-000000000007', 1, 420000, current_date + 3, 'ca900000-0000-4000-8000-000000000007', 'cancelada');

create function testes.p31_leituras(p_entidade text, p_entidade_id text) returns bigint language sql as $$
  select count(*) from public.log_auditoria where acao = 'leitura' and entidade = p_entidade and entidade_id = p_entidade_id
$$;


-- -----------------------------------------------------------------------------
-- 1. Escrita direta fechada
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(
  $s$ update contrato set status = 'assinado' where id = 'b1900000-0000-4000-8000-000000000001' $s$,
  '42501', null, 'comercial não muda o status do contrato direto');
select throws_ok(
  $s$ update contrato set valor_centavos = 1 where id = 'b1900000-0000-4000-8000-000000000001' $s$,
  '42501', null, 'comercial não muda o valor do contrato direto (a proposta é função)');
select throws_ok(
  $s$ insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao, status)
      values ('c1900000-0000-4000-8000-000000000008', (select pacote_versao_id from contrato limit 1), 1, 'x', 'assinado') $s$,
  '42501', null, 'comercial não inclui contrato já assinado');
select throws_ok(
  $s$ insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao, autentique_doc_id)
      values ('c1900000-0000-4000-8000-000000000008', (select pacote_versao_id from contrato limit 1), 1, 'x', 'doc-forjado-0001') $s$,
  '42501', null, 'comercial não inclui contrato com documento da Autentique inventado');
select throws_ok(
  $s$ update cobranca set status = 'paga' where id = 'ca900000-0000-4000-8000-000000000006' $s$,
  '42501', null, 'comercial não baixa cobrança direto');
select throws_like(
  $s$ select api.transicionar('p2', 'e1900000-0000-4000-8000-000000000009', 'contrato_gerado') $s$,
  '%venda:estagio_so_pelo_fluxo%', 'api.transicionar recusa contrato_gerado');
select throws_like(
  $s$ select api.transicionar('p2', 'e1900000-0000-4000-8000-000000000002', 'assinado') $s$,
  '%venda:estagio_so_pelo_fluxo%', 'api.transicionar recusa assinado (aguardando_assinatura não assina por clique)');
select throws_like(
  $s$ select api.transicionar('p2', 'e1900000-0000-4000-8000-000000000006', 'pagamento_confirmado') $s$,
  '%venda:estagio_so_pelo_fluxo%', 'api.transicionar recusa pagamento_confirmado');
select testes.encerrar();
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal2');
select throws_ok(
  $s$ update cobranca set status = 'paga' where id = 'ca900000-0000-4000-8000-000000000006' $s$,
  '42501', null, 'financeiro também não baixa cobrança direto');
select testes.encerrar();
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000006'),
  'cobranca_gerada', 'os cliques recusados não mudaram o estágio');


-- -----------------------------------------------------------------------------
-- 2. Situação do contrato
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.contrato_situacao('c1900000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'situação do contrato exige AAL2');
select testes.encerrar();
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.contrato_situacao('c1900000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'enfermeira não vê o contrato');
select testes.encerrar();
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($s$ select api.contrato_situacao('c1900000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'coordenação não vê o contrato');
select testes.encerrar();

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'sit0', api.contrato_situacao('c1900000-0000-4000-8000-000000000001');
select is((select r #>> '{contrato,etapa}' from t_r where chave = 'sit0'), 'pronto_para_gerar', 'situação: formulário recebido, pronto para gerar');
select is((select r #>> '{contrato,variante}' from t_r where chave = 'sit0'), 'completa', 'situação: variante completa');
select is((select r -> 'pode_gerar' from t_r where chave = 'sit0'), 'true'::jsonb, 'situação: o comercial pode gerar');
select is((select jsonb_array_length(r -> 'assinantes') from t_r where chave = 'sit0'), 3, 'situação: gestante, Kraamzorg e testemunha');
select is((select r #>> '{assinantes,0,email}' from t_r where chave = 'sit0'), 'm***@exemplo.invalid', 'situação: e-mail da gestante mascarado');
select is((select r #>> '{modelo,aprovado}' from t_r where chave = 'sit0'), 'false', 'situação: modelo ainda não aprovado');
select is((select r #>> '{contrato,conta,total_centavos}' from t_r where chave = 'sit0'), '455000', 'situação: total com a taxa');
insert into t_r select 'sit_pend', api.contrato_situacao('c1900000-0000-4000-8000-000000000009');
select is((select r #>> '{contrato,etapa}' from t_r where chave = 'sit_pend'), 'aguardando_dados', 'situação: link enviado, dados ainda não chegaram');
select is((select r -> 'pode_gerar' from t_r where chave = 'sit_pend'), 'false'::jsonb, 'situação: sem formulário não gera');
select is((api.contrato_situacao('c1900000-0000-4000-8000-000000000008') -> 'contrato'), 'null'::jsonb, 'situação: sem contrato devolve contrato nulo');
select testes.encerrar();

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($s$ select api.contrato_situacao('c1900000-0000-4000-8000-000000000008') $s$,
  '42501', null, 'financeiro não abre família sem contrato (PRD 13)');
insert into t_r select 'sit_fin', api.contrato_situacao('c1900000-0000-4000-8000-000000000006');
select is((select r #>> '{cobrancas,0,status}' from t_r where chave = 'sit_fin'), 'aberta', 'situação: financeiro vê a cobrança');
select is((select r #>> '{cobrancas,0,valor_centavos}' from t_r where chave = 'sit_fin'), '420000', 'situação: financeiro vê o valor da cobrança');
select is((select r -> 'pode_gerar' from t_r where chave = 'sit_fin'), 'false'::jsonb, 'situação: financeiro não gera contrato');
select testes.encerrar();

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
select is((api.contrato_situacao('c1900000-0000-4000-8000-000000000006') #> '{cobrancas,0}') ? 'valor_centavos', false,
  'situação: o comercial vê só o status da cobrança, sem valor (PRD 13)');
select testes.encerrar();


-- -----------------------------------------------------------------------------
-- 3. Dados para o PDF e contrato gerado
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($s$ select api.dados_para_contrato('b1900000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'financeiro não lê os dados do contrato para gerar o PDF');
select testes.encerrar();
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.dados_para_contrato('b1900000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'dados do contrato exigem AAL2');
select testes.encerrar();

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
select throws_like($s$ select api.dados_para_contrato('b1900000-0000-4000-8000-000000000009') $s$,
  '%venda:formulario_pendente%', 'sem o formulário recebido, não há dado para o PDF');
select throws_like($s$ select api.dados_para_contrato('b1900000-0000-4000-8000-000000000004') $s$,
  '%venda:formulario_pendente%', 'contrato já enviado não reabre os dados');
insert into t_r select 'dados1', api.dados_para_contrato('b1900000-0000-4000-8000-000000000001');
select is((select r #>> '{contratante,cpf}' from t_r where chave = 'dados1'), '11144477735', 'dados: CPF completo para o PDF');
select is((select r #>> '{pacote,dias}' from t_r where chave = 'dados1'), '6', 'dados: dias do pacote');
select is((select r #>> '{testemunha,nome}' from t_r where chave = 'dados1'), 'Rafael Teste Fluxo', 'dados: testemunha');
select is((select r #>> '{contrato,variante}' from t_r where chave = 'dados1'), 'completa', 'dados: variante completa');
select is((select r #>> '{contrato,conta,total_centavos}' from t_r where chave = 'dados1'), '455000', 'dados: total em centavos');
insert into t_r select 'dados3', api.dados_para_contrato('b1900000-0000-4000-8000-000000000003');
select is((select r #>> '{contrato,variante}' from t_r where chave = 'dados3'), 'presente', 'dados: variante de presente');
select is((select r #>> '{pagador,nome}' from t_r where chave = 'dados3'), 'Carla Teste Presenteadora', 'dados: pagador do presente');
select is((select r #>> '{pagador,cpf}' from t_r where chave = 'dados3'), '39053344705', 'dados: CPF do pagador');
select testes.encerrar();
select ok(testes.p31_leituras('pessoa_dados_contrato', 'd1900000-0000-4000-8000-000000000001') >= 1,
  'dados: a leitura do CPF fica no log de auditoria');

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
select throws_like(
  $s$ select api.registrar_contrato_gerado('b1900000-0000-4000-8000-000000000001', 'contratos/Marina-Teste-Fluxo.pdf', repeat('a', 64)) $s$,
  '%venda:caminho_pdf_invalido%', 'nome de paciente no caminho do PDF é recusado');
select throws_like(
  $s$ select api.registrar_contrato_gerado('b1900000-0000-4000-8000-000000000001', 'contratos/b1900000-0000-4000-8000-000000000001.pdf', 'zzz') $s$,
  '%venda:pdf_sem_resumo%', 'PDF sem resumo sha256 é recusado');
select throws_like(
  $s$ select api.registrar_contrato_gerado('b1900000-0000-4000-8000-000000000009', 'contratos/b1900000-0000-4000-8000-000000000009.pdf', repeat('a', 64)) $s$,
  '%venda:formulario_pendente%', 'não gera contrato sem o formulário');
select is(
  api.registrar_contrato_gerado('b1900000-0000-4000-8000-000000000001', 'contratos/b1900000-0000-4000-8000-000000000001.pdf', repeat('a', 64)) ->> 'status',
  'gerado', 'contrato gerado');
select testes.encerrar();
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000001'), 'contrato_gerado',
  'gerar move o P2 de ganho para contrato_gerado');
select is((select status::text from contrato where id = 'b1900000-0000-4000-8000-000000000001'), 'gerado', 'contrato em gerado');
select is((select template_versao from contrato where id = 'b1900000-0000-4000-8000-000000000001'), 'C-11 teste',
  'o contrato grava a versão do modelo usada');
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
select is(
  api.registrar_contrato_gerado('b1900000-0000-4000-8000-000000000001', 'contratos/b1900000-0000-4000-8000-000000000001.pdf', repeat('b', 64)) ->> 'status',
  'gerado', 'gerar de novo antes do envio é permitido');
select testes.encerrar();
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000001'), 'contrato_gerado',
  'gerar de novo não mexe no P2');


-- -----------------------------------------------------------------------------
-- 4. Envio à Autentique em três passos
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($s$ select api.reservar_envio_contrato('b1900000-0000-4000-8000-000000000001') $s$,
  '42501', null, 'financeiro não envia o contrato');
select testes.encerrar();

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
select throws_like($s$ select api.reservar_envio_contrato('b1900000-0000-4000-8000-000000000009') $s$,
  '%venda:contrato_nao_gerado%', 'não envia contrato que não foi gerado');
select throws_like($s$ select api.concluir_envio_contrato('b1900000-0000-4000-8000-000000000001', 'doc-sem-reserva-1') $s$,
  '%venda:envio_nao_reservado%', 'concluir sem reservar é recusado');
insert into t_r select 'reserva', api.reservar_envio_contrato('b1900000-0000-4000-8000-000000000001');
select is((select r ->> 'pdf_path' from t_r where chave = 'reserva'), 'contratos/b1900000-0000-4000-8000-000000000001.pdf', 'reserva devolve o caminho do PDF');
select is((select r #>> '{kraamzorg,email}' from t_r where chave = 'reserva'), 'assina.p31@exemplo.invalid', 'reserva devolve quem assina pela Kraamzorg');
select is((select r #>> '{testemunha,nome}' from t_r where chave = 'reserva'), 'Rafael Teste Fluxo', 'reserva devolve a testemunha');
select ok((select r ->> 'nome_documento' from t_r where chave = 'reserva') not like '%Marina%', 'o nome do documento não leva nome de paciente');
select throws_like($s$ select api.reservar_envio_contrato('b1900000-0000-4000-8000-000000000001') $s$,
  '%venda:envio_em_andamento%', 'segundo clique: envio já em andamento (nunca dois documentos)');
select is(api.liberar_envio_contrato('b1900000-0000-4000-8000-000000000001') ->> 'ok', 'true', 'liberar a reserva quando a Autentique recusou');
select is(api.reservar_envio_contrato('b1900000-0000-4000-8000-000000000001') ->> 'ok', 'true', 'reservar de novo depois de liberar');
select throws_like($s$ select api.concluir_envio_contrato('b1900000-0000-4000-8000-000000000001', 'x') $s$,
  '%venda:documento_invalido%', 'id de documento inválido é recusado');
select is(api.concluir_envio_contrato('b1900000-0000-4000-8000-000000000001', 'doc-fluxo-00001') ->> 'status', 'enviado', 'envio concluído');
select throws_like($s$ select api.concluir_envio_contrato('b1900000-0000-4000-8000-000000000001', 'doc-fluxo-00002') $s$,
  '%venda:envio_nao_reservado%', 'concluir duas vezes é recusado');
select throws_like($s$ select api.reservar_envio_contrato('b1900000-0000-4000-8000-000000000001') $s$,
  '%venda:contrato_nao_gerado%', 'contrato enviado não reserva de novo');
select throws_like($s$ select api.dados_para_contrato('b1900000-0000-4000-8000-000000000001') $s$,
  '%venda:formulario_pendente%', 'contrato enviado não reabre os dados');
select testes.encerrar();
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000001'), 'aguardando_assinatura',
  'enviar move o P2 para aguardando_assinatura');
select is((select status::text from contrato where id = 'b1900000-0000-4000-8000-000000000001'), 'enviado', 'contrato em enviado');


-- -----------------------------------------------------------------------------
-- 5. Webhook da Autentique
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ select public.contrato_registrar_assinatura('doc-fluxo-00001', 'contratos/b1900000-0000-4000-8000-000000000001-assinado.pdf') $s$,
  '42501', null, 'segurança: usuário do app não executa a assinatura do webhook');
select throws_ok($s$ select public.contrato_do_documento('doc-fluxo-00001') $s$,
  '42501', null, 'segurança: usuário do app não consulta contrato pelo documento');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select public.contrato_registrar_assinatura('doc-fluxo-00001', 'x') $s$,
  '42501', null, 'segurança: anon não executa a assinatura do webhook');
select testes.encerrar();

select testes.autenticar_service_role();
select is(public.contrato_registrar_assinatura('doc-que-nao-existe', 'contratos/x-assinado.pdf') ->> 'motivo',
  'contrato_nao_encontrado', 'webhook forjado: documento desconhecido não muda nada');
select is(public.contrato_do_documento('doc-fluxo-00001') ->> 'status', 'enviado', 'webhook: contrato achado pelo documento');
select throws_like(
  $s$ select public.contrato_registrar_assinatura('doc-fluxo-00001', 'contratos/Marina-Teste-Fluxo.pdf') $s$,
  '%venda:caminho_pdf_invalido%', 'webhook: PDF assinado com nome de paciente no caminho é recusado');
select is(public.contrato_registrar_assinatura('doc-fluxo-00001', 'contratos/b1900000-0000-4000-8000-000000000001-assinado.pdf') ->> 'mudou',
  'true', 'webhook: contrato assinado');
select is(public.contrato_registrar_assinatura('doc-fluxo-00001', 'contratos/b1900000-0000-4000-8000-000000000001-assinado.pdf') ->> 'motivo',
  'ja_assinado', 'webhook duplicado: já assinado, nada repete');
select testes.encerrar();

select is((select status::text from contrato where id = 'b1900000-0000-4000-8000-000000000001'), 'assinado', 'contrato em assinado');
select is((select pdf_path from contrato where id = 'b1900000-0000-4000-8000-000000000001'),
  'contratos/b1900000-0000-4000-8000-000000000001-assinado.pdf', 'o PDF assinado é guardado com nome pelo id');
select isnt((select assinado_em from contrato where id = 'b1900000-0000-4000-8000-000000000001'), null, 'assinado_em gravado');
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000001'), 'cobranca_gerada',
  'pos_assinatura: P2 assinado e depois cobranca_gerada');
select is((select count(*)::integer from cobranca where contrato_id = 'b1900000-0000-4000-8000-000000000001'), 1,
  'pos_assinatura: uma cobrança, mesmo com o webhook duplicado');
select is((select valor_centavos from cobranca where contrato_id = 'b1900000-0000-4000-8000-000000000001'), 455000,
  'a cobrança tem o total: valor menos desconto mais taxa, em centavos');
select is((select external_id from cobranca where contrato_id = 'b1900000-0000-4000-8000-000000000001'),
  (select id::text from cobranca where contrato_id = 'b1900000-0000-4000-8000-000000000001'),
  'external_id (order_nsu) é o id da cobrança');
select is((select vencimento from cobranca where contrato_id = 'b1900000-0000-4000-8000-000000000001'), current_date + 3,
  'vencimento vem de parametro.cobranca');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'pos_assinatura' and familia_id = 'c1900000-0000-4000-8000-000000000001' and status = 'executada'), 1,
  'pos_assinatura registrada como executada uma vez');
select is((select count(*)::integer from evento_familia where familia_id = 'c1900000-0000-4000-8000-000000000001' and tipo = 'contrato' and titulo = 'Contrato assinado por todos'), 1,
  'evento de assinatura uma vez só');

-- freio: contrato assinado de família em bloqueio_total não gera cobrança sozinho
select testes.autenticar_service_role();
select is(public.contrato_registrar_assinatura('doc-freio-00001', 'contratos/b1900000-0000-4000-8000-000000000004-assinado.pdf') ->> 'mudou',
  'true', 'freio: o contrato assina (fato já ocorrido)');
select testes.encerrar();
select is((select count(*)::integer from cobranca where contrato_id = 'b1900000-0000-4000-8000-000000000004'), 0,
  'freio: bloqueio_total não gera cobrança sozinho (PRD 8.2)');
select is((select status::text from automacao_execucao where automacao_id = 'pos_assinatura' and familia_id = 'c1900000-0000-4000-8000-000000000004'),
  'abortada_freio', 'freio: pos_assinatura abortada e registrada');
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000004'), 'assinado',
  'freio: o P2 fica em assinado');
select ok(exists (select 1 from notificacao where papel = 'financeiro' and titulo like 'Contrato assinado, mas a cobrança não foi gerada sozinha%'),
  'freio: o financeiro é avisado');


-- -----------------------------------------------------------------------------
-- 6. Cobrança: link
-- -----------------------------------------------------------------------------

select testes.autenticar_service_role();
insert into t_r select 'semlink', public.cobrancas_sem_link('b1900000-0000-4000-8000-000000000001');
select is((select jsonb_array_length(r) from t_r where chave = 'semlink'), 1, 'cobrancas_sem_link devolve a cobrança');
select is((select r #>> '{0,parcelas}' from t_r where chave = 'semlink'), '3', 'link: parcelas do cartão são as do contrato');
select is((select r #>> '{0,parcelas_max}' from t_r where chave = 'semlink'), '3', 'link: limite do pacote (3x sem juros)');
select is((select r #>> '{0,acima_do_limite}' from t_r where chave = 'semlink'), 'false', 'link: dentro do limite');
select is((select r #>> '{0,descricao}' from t_r where chave = 'semlink'), 'Cuidado domiciliar pós-parto', 'link: descrição do item vem de parametro (C-16)');
select is((select r #>> '{0,cliente,nome}' from t_r where chave = 'semlink'), 'Marina Teste Fluxo', 'link: cliente é quem paga');
select ok(not ((select r::text from t_r where chave = 'semlink') like '%11144477735%'), 'link: nenhum CPF sai para o servidor pedir o link');
insert into t_r select 'cobranca_a', to_jsonb(c.id) from cobranca c where c.contrato_id = 'b1900000-0000-4000-8000-000000000001';
select throws_like(
  format($s$ select public.cobranca_registrar_link(%L, 'http://pay.exemplo.invalid/x', null) $s$, (select r #>> '{}' from t_r where chave = 'cobranca_a')),
  '%venda:link_invalido%', 'link sem https é recusado');
select throws_like(
  format($s$ select public.cobranca_registrar_link(%L, 'javascript:alert(1)', null) $s$, (select r #>> '{}' from t_r where chave = 'cobranca_a')),
  '%venda:link_invalido%', 'link com esquema perigoso é recusado');
select is(public.cobranca_registrar_link((select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a'), 'https://pay.exemplo.invalid/fluxo', 'slug-fluxo') ->> 'ok',
  'true', 'link registrado');
select is(public.cobranca_registrar_link((select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a'), 'https://pay.exemplo.invalid/fluxo', 'slug-fluxo') ->> 'repetido',
  'true', 'o mesmo link de novo é idempotente');
select throws_like(
  format($s$ select public.cobranca_registrar_link(%L, 'https://pay.exemplo.invalid/outro', null) $s$, (select r #>> '{}' from t_r where chave = 'cobranca_a')),
  '%venda:link_ja_gerado%', 'um link só por cobrança');
select is(jsonb_array_length(public.cobrancas_sem_link('b1900000-0000-4000-8000-000000000001')), 0, 'sem link pendente depois de registrar');
select testes.encerrar();

select is((select count(*)::integer from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000001' and payload ->> 'acao' = 'link_pagamento'), 1,
  'uma tarefa de link de pagamento');
select alike((select payload ->> 'textoSugerido' from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000001' and payload ->> 'acao' = 'link_pagamento'),
  '%https://pay.exemplo.invalid/fluxo%', 'a tarefa leva o texto link_pagamento com o link');
select is((select payload ->> 'telefoneE164' from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000001' and payload ->> 'acao' = 'link_pagamento'),
  '+5511900001901', 'a tarefa leva o telefone do contato principal');
select is((select responsavel_id from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000001' and payload ->> 'acao' = 'link_pagamento'),
  'a1900000-0000-4000-8000-000000000001'::uuid, 'a tarefa vai para quem cuida da oportunidade');

-- parcelamento acima do limite (exceção aprovada, C-05): cobrança sem link
select testes.autenticar_service_role();
select is(public.contrato_registrar_assinatura('doc-limite-0001', 'contratos/b1900000-0000-4000-8000-000000000005-assinado.pdf') ->> 'mudou',
  'true', 'limite: contrato assinado');
select testes.encerrar();
insert into t_r select 'cobranca_l', to_jsonb(c.id) from cobranca c where c.contrato_id = 'b1900000-0000-4000-8000-000000000005';
select testes.autenticar_service_role();
insert into t_r select 'limite', public.cobrancas_sem_link('b1900000-0000-4000-8000-000000000005');
select is((select r #>> '{0,acima_do_limite}' from t_r where chave = 'limite'), 'true', 'limite: parcelamento acima do limite do pacote é marcado');
select is((select r #>> '{0,parcelas}' from t_r where chave = 'limite'), '5', 'limite: parcelas do contrato');
select testes.encerrar();
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal2');
select throws_like(
  format($s$ select api.dados_link_pagamento(%L) $s$, (select r #>> '{}' from t_r where chave = 'cobranca_l')),
  '%venda:parcelas_acima_do_limite%', 'limite: o servidor não recebe dados para gerar link acima do limite');
select is((api.cobranca((select (r #>> '{}')::uuid from t_r where chave = 'cobranca_l')) -> 'pode_gerar_link'), 'false'::jsonb,
  'limite: a tela não oferece gerar o link');
select is((api.cobranca((select (r #>> '{}')::uuid from t_r where chave = 'cobranca_l')) -> 'acima_do_limite'), 'true'::jsonb,
  'limite: a tela sabe que está acima do limite');
select testes.encerrar();
select testes.autenticar_service_role();
select lives_ok(
  format($s$ select public.cobranca_avisar_falha_link(%L, 'acima_do_limite') $s$, (select r #>> '{}' from t_r where chave = 'cobranca_l')),
  'limite: o aviso ao financeiro sai');
select testes.encerrar();
select ok(exists (select 1 from notificacao where papel = 'financeiro' and titulo like 'Parcelamento acima do limite%'), 'limite: o financeiro foi avisado');
select ok(not exists (select 1 from notificacao where titulo like '%Família Teste%'), 'os avisos não levam nome de família no título');


-- -----------------------------------------------------------------------------
-- 7. Webhook da InfinitePay
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal2');
select throws_ok(
  format($s$ select public.cobranca_baixar(%L, 455000, 3, 'credit_card', 'tx1', 'inv1', 'https://recibo.exemplo.invalid/1') $s$, (select r #>> '{}' from t_r where chave = 'cobranca_a')),
  '42501', null, 'segurança: usuário do app não executa a baixa do webhook');
select testes.encerrar();

select testes.autenticar_service_role();
select is(public.cobranca_baixar('order-que-nao-existe', 455000, 1, 'pix', null, null, null) ->> 'motivo',
  'cobranca_nao_encontrada', 'webhook forjado: pedido desconhecido não baixa nada');
select is(public.cobranca_do_pedido((select r #>> '{}' from t_r where chave = 'cobranca_a')) ->> 'status', 'aberta', 'webhook: cobrança achada pelo order_nsu');
select is(public.cobranca_baixar((select r #>> '{}' from t_r where chave = 'cobranca_a'), 100, 3, 'credit_card', 'tx1', 'inv1', null) ->> 'motivo',
  'valor_divergente', 'valor abaixo do da cobrança não baixa');
select is(public.cobranca_baixar((select r #>> '{}' from t_r where chave = 'cobranca_a'), null, 3, 'credit_card', 'tx1', 'inv1', null) ->> 'motivo',
  'valor_divergente', 'valor ausente não baixa');
select is((select status::text from cobranca where id = (select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a')), 'aberta', 'a cobrança continua aberta');
select is(public.cobranca_baixar((select r #>> '{}' from t_r where chave = 'cobranca_a'), 455000, 3, 'credit_card', 'tx1', 'inv1', 'https://recibo.exemplo.invalid/1') ->> 'mudou',
  'true', 'baixa confirmada');
select is(public.cobranca_baixar((select r #>> '{}' from t_r where chave = 'cobranca_a'), 455000, 3, 'credit_card', 'tx1', 'inv1', 'https://recibo.exemplo.invalid/1') ->> 'motivo',
  'ja_paga', 'webhook duplicado: já paga, nada repete');
select testes.encerrar();

select is((select status::text from cobranca where id = (select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a')), 'paga', 'cobrança paga');
select is((select parcelas_cartao from cobranca where id = (select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a')), 3, 'parcelas do cartão gravadas');
select is((select capture_method from cobranca where id = (select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a')), 'credit_card', 'método gravado');
select is((select comprovante_url from cobranca where id = (select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a')), 'https://recibo.exemplo.invalid/1', 'recibo gravado');
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000001'), 'pagamento_confirmado', 'baixa move o P2 para pagamento_confirmado');
select is((select count(*)::integer from nota_fiscal where cobranca_id = (select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a') and status = 'pendente'), 1,
  'nota fiscal pendente para o P43, uma só');
select is((select count(*)::integer from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000001' and payload ->> 'acao' = 'pagamento_confirmado'), 1,
  'uma tarefa de mensagem de pagamento confirmado');
select alike((select payload ->> 'textoSugerido' from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000001' and payload ->> 'acao' = 'pagamento_confirmado'),
  'Pagamento confirmado, Marina.%', 'a mensagem usa o texto pagamento_confirmado com o nome');
select is((select count(*)::integer from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000001' and tipo = 'agendar_prenatal'), 0,
  'gestação longe das 34 semanas: sem pré-natal urgente');

-- 34 semanas ou mais: prenatal_urgente
select testes.autenticar_service_role();
select is(public.contrato_registrar_assinatura('doc-urgente-0001', null) ->> 'mudou', 'true', 'urgente: contrato assinado, mesmo sem o PDF assinado');
select testes.encerrar();
select is((select pdf_path from contrato where id = 'b1900000-0000-4000-8000-000000000002'), 'contratos/b1900000-0000-4000-8000-000000000002.pdf',
  'sem o PDF assinado, o caminho do original continua');
select ok(exists (select 1 from notificacao where papel = 'comercial' and titulo like 'Contrato assinado, mas o PDF assinado não foi guardado%'),
  'sem o PDF assinado, o comercial é avisado');
insert into t_r select 'cobranca_u', to_jsonb(c.id) from cobranca c where c.contrato_id = 'b1900000-0000-4000-8000-000000000002';
select testes.autenticar_service_role();
select is(public.cobranca_baixar((select r #>> '{}' from t_r where chave = 'cobranca_u'), 420000, 1, 'pix', 'tx2', 'inv2', null) ->> 'prenatal_urgente',
  'true', 'urgente: pagamento com 34 semanas ou mais');
select testes.encerrar();
select is((select prioridade::text from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000002' and tipo = 'agendar_prenatal'), 'maxima',
  'urgente: tarefa de prioridade máxima');
select is((select papel_responsavel::text from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000002' and tipo = 'agendar_prenatal'), 'coordenacao',
  'urgente: a tarefa é da coordenação');
select ok(exists (select 1 from notificacao where papel = 'coordenacao' and prioridade = 'maxima' and titulo like 'Pagamento confirmado com 3_ semanas%'),
  'urgente: aviso imediato à coordenação');
select alike((select payload ->> 'textoSugerido' from tarefa where familia_id = 'c1900000-0000-4000-8000-000000000002' and payload ->> 'acao' = 'pagamento_confirmado'),
  '%Como você já está com 34 semanas%', 'urgente: a mensagem é a pagamento_confirmado_34s com as semanas');
select is((select count(*)::integer from automacao_execucao where automacao_id = 'prenatal_urgente' and familia_id = 'c1900000-0000-4000-8000-000000000002' and status = 'executada'), 1,
  'urgente: prenatal_urgente registrada como executada');

-- pagamento em cobrança cancelada: não baixa, avisa
select testes.autenticar_service_role();
select is(public.cobranca_baixar('ca900000-0000-4000-8000-000000000007', 420000, 1, 'pix', 'tx3', 'inv3', null) ->> 'motivo',
  'cobranca_encerrada', 'pagamento em cobrança cancelada não baixa');
select testes.encerrar();
select is((select status::text from cobranca where id = 'ca900000-0000-4000-8000-000000000007'), 'cancelada', 'a cobrança cancelada continua cancelada');
select ok(exists (select 1 from notificacao where papel = 'financeiro' and titulo like 'Chegou um pagamento em cobrança cancelada%'),
  'o financeiro é avisado do pagamento em cobrança cancelada');


-- -----------------------------------------------------------------------------
-- 8. Cobranças para o financeiro e baixa manual
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.cobrancas() $s$, '42501', null, 'comercial não lista cobranças (só o status, pela situação do contrato)');
select throws_ok($s$ select api.cobranca('ca900000-0000-4000-8000-000000000006') $s$, '42501', null, 'comercial não abre a cobrança');
select testes.encerrar();
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal1');
select throws_ok($s$ select api.cobrancas() $s$, '42501', null, 'cobranças exigem AAL2');
select testes.encerrar();

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal2');
insert into t_r select 'lista', api.cobrancas();
select ok(jsonb_array_length((select r -> 'cobrancas' from t_r where chave = 'lista')) >= 6, 'lista: cobranças de todas as famílias com contrato');
select is((select r #>> '{cobrancas,0,situacao}' from t_r where chave = 'lista') <> 'paga', true, 'lista: abertas antes das pagas');
select ok((select (r #>> '{resumo,recebido_centavos}')::bigint from t_r where chave = 'lista') >= 875000, 'resumo: recebido soma as pagas');
select is(jsonb_array_length((api.cobrancas('paga')) -> 'cobrancas') >= 2, true, 'filtro por situação paga');
select throws_like($s$ select api.cobrancas('qualquer') $s$, '%venda:situacao_invalida%', 'situação desconhecida é recusada');
insert into t_r select 'det', api.cobranca((select (r #>> '{}')::uuid from t_r where chave = 'cobranca_a'));
select is((select r ->> 'situacao' from t_r where chave = 'det'), 'paga', 'detalhe: paga');
select is((select r #>> '{nota,status}' from t_r where chave = 'det'), 'pendente', 'detalhe: nota fiscal pendente');
select is((select r ->> 'recibo_url' from t_r where chave = 'det'), 'https://recibo.exemplo.invalid/1', 'detalhe: recibo da InfinitePay');
select is((select r ->> 'pagador_nome' from t_r where chave = 'det'), 'Marina Teste Fluxo', 'detalhe: quem paga');
select is((select r ->> 'pode_baixar_manual' from t_r where chave = 'det'), 'false', 'detalhe: paga não baixa de novo');

select throws_like(
  $s$ select api.baixar_cobranca_manual('ca900000-0000-4000-8000-000000000006', 420000, 'comprovantes/ca900000-0000-4000-8000-000000000006-abc12345.png', 'curto') $s$,
  '%venda:motivo_obrigatorio%', 'baixa manual: motivo curto é recusado');
select throws_like(
  $s$ select api.baixar_cobranca_manual('ca900000-0000-4000-8000-000000000006', 420000, 'comprovantes/Clara-Teste.png', 'Pix recebido no extrato de 29/09') $s$,
  '%venda:comprovante_obrigatorio%', 'baixa manual: comprovante com nome de paciente ou fora do padrão é recusado');
select throws_like(
  $s$ select api.baixar_cobranca_manual('ca900000-0000-4000-8000-000000000006', 420000, null, 'Pix recebido no extrato de 29/09') $s$,
  '%venda:comprovante_obrigatorio%', 'baixa manual: sem comprovante é recusado');
select throws_like(
  $s$ select api.baixar_cobranca_manual('ca900000-0000-4000-8000-000000000006', 1000, 'comprovantes/ca900000-0000-4000-8000-000000000006-abc12345.png', 'Pix recebido no extrato de 29/09') $s$,
  '%venda:valor_menor_que_a_cobranca%', 'baixa manual: valor menor que o da cobrança é recusado');
select throws_like(
  $s$ select api.baixar_cobranca_manual('ca900000-0000-4000-8000-000000000007', 420000, 'comprovantes/ca900000-0000-4000-8000-000000000007-abc12345.png', 'Pix recebido no extrato de 29/09') $s$,
  '%venda:cobranca_nao_aberta%', 'baixa manual: cobrança cancelada não baixa');
select is(api.baixar_cobranca_manual('ca900000-0000-4000-8000-000000000006', 420000, 'comprovantes/ca900000-0000-4000-8000-000000000006-abc12345.png',
  'Pix recebido no extrato de 29/09') ->> 'mudou', 'true', 'baixa manual feita');
select throws_like(
  $s$ select api.baixar_cobranca_manual('ca900000-0000-4000-8000-000000000006', 420000, 'comprovantes/ca900000-0000-4000-8000-000000000006-abc12345.png', 'Pix recebido no extrato de 29/09') $s$,
  '%venda:cobranca_nao_aberta%', 'baixa manual repetida é recusada');
select testes.encerrar();

select is((select status::text from cobranca where id = 'ca900000-0000-4000-8000-000000000006'), 'paga', 'manual: cobrança paga');
select is((select capture_method from cobranca where id = 'ca900000-0000-4000-8000-000000000006'), 'pix', 'manual: método pix');
select is((select comprovante_url from cobranca where id = 'ca900000-0000-4000-8000-000000000006'),
  'comprovantes/ca900000-0000-4000-8000-000000000006-abc12345.png', 'manual: comprovante guardado');
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000006'), 'pagamento_confirmado', 'manual: P2 pagamento_confirmado');
select is((select count(*)::integer from nota_fiscal where cobranca_id = 'ca900000-0000-4000-8000-000000000006'), 1, 'manual: nota fiscal pendente');
select is((select count(*)::integer from log_auditoria where acao = 'cobranca_baixa_manual' and entidade_id = 'ca900000-0000-4000-8000-000000000006'
           and valor_depois ->> 'motivo' = 'Pix recebido no extrato de 29/09'), 1, 'manual: motivo e comprovante no log de auditoria');
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.baixar_cobranca_manual('ca900000-0000-4000-8000-000000000006', 420000, 'x', 'Pix recebido no extrato') $s$,
  '42501', null, 'comercial não baixa cobrança à mão');
select testes.encerrar();

select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000002', 'aal2');
select is(api.gerar_cobranca('b1900000-0000-4000-8000-000000000006') ->> 'ok', 'true', 'gerar cobrança à mão é idempotente (devolve a que existe)');
select throws_like($s$ select api.gerar_cobranca('b1900000-0000-4000-8000-000000000009') $s$, '%venda:contrato_nao_assinado%',
  'só se gera cobrança de contrato assinado');
select testes.encerrar();
select is((select count(*)::integer from cobranca where contrato_id = 'b1900000-0000-4000-8000-000000000006'), 1, 'gerar à mão não duplica a cobrança');

-- o freio deixou o contrato assinado sem cobrança: a pessoa do financeiro gera à mão
select testes.autenticar_authenticated('a1900000-0000-4000-8000-000000000003', 'aal2');
select is(api.gerar_cobranca('b1900000-0000-4000-8000-000000000004') ->> 'ok', 'true', 'a diretoria gera a cobrança que o freio segurou');
select testes.encerrar();
select is((select count(*)::integer from cobranca where contrato_id = 'b1900000-0000-4000-8000-000000000004'), 1, 'cobrança gerada à mão');
select is((select estagio_p2::text from oportunidade where id = 'e1900000-0000-4000-8000-000000000004'), 'cobranca_gerada', 'e o P2 anda');


-- -----------------------------------------------------------------------------
-- 9. Privilégios e log sem CPF
-- -----------------------------------------------------------------------------

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'api'
       and p.proname in ('contrato_situacao', 'dados_para_contrato', 'registrar_contrato_gerado', 'reservar_envio_contrato',
                         'concluir_envio_contrato', 'liberar_envio_contrato', 'gerar_cobranca', 'cobrancas', 'cobranca',
                         'dados_link_pagamento', 'registrar_link_pagamento', 'baixar_cobranca_manual')
       and (not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)
            or not has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'as doze funções api de contrato e cobrança: security definer, search_path vazio, só authenticated');
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'api'
     and p.proname in ('contrato_situacao', 'dados_para_contrato', 'registrar_contrato_gerado', 'reservar_envio_contrato',
                       'concluir_envio_contrato', 'liberar_envio_contrato', 'gerar_cobranca', 'cobrancas', 'cobranca',
                       'dados_link_pagamento', 'registrar_link_pagamento', 'baixar_cobranca_manual')),
  12, 'as doze funções api existem');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('contrato_do_documento', 'contrato_registrar_assinatura', 'cobrancas_sem_link',
                         'cobranca_registrar_link', 'cobranca_avisar_falha_link', 'cobranca_do_pedido', 'cobranca_baixar')
       and (not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)
            or has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute')
            or not has_function_privilege('service_role', p.oid, 'execute')) $$,
  'as sete funções de servidor: security definer, search_path vazio, só service_role');
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'privado' and (p.proname like 'contrato\_%' or p.proname like 'cobranca\_%' or p.proname like 'venda\_%')
       and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('service_role', p.oid, 'execute')) $$,
  'auxiliares privado de contrato e cobrança sem execute para o app');
select is_empty(
  $$ select l.id from log_auditoria l
     where l.valor_antes::text ~ '(11144477735|52998224725|39053344705)'
        or l.valor_depois::text ~ '(11144477735|52998224725|39053344705)' $$,
  'log de auditoria sem nenhum CPF do teste');
select is_empty(
  $$ select e.id from evento_familia e
     where e.dados::text ~ '(11144477735|52998224725|39053344705)' or e.titulo ~ '(11144477735|52998224725|39053344705)' $$,
  'linha do tempo sem nenhum CPF do teste');
select is_empty(
  $$ select t.id from tarefa t
     where t.payload::text ~ '(11144477735|52998224725|39053344705)' or t.titulo ~ '(11144477735|52998224725|39053344705)' $$,
  'tarefas sem nenhum CPF do teste');
select is((select ativa from automacao where id = 'prenatal_urgente'), true, 'prenatal_urgente ligada (P32 item 3)');

select * from finish();
rollback;
