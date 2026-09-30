-- =============================================================================
-- supabase/tests/024_seguranca_onda.sql
--
-- Segurança das funções e das tabelas das migrations 0019, 0021, 0022 e 0023
-- (contrato e cobrança, pré-natal e designação, agenda e portal, checklist e
-- alertas), tentada de fora:
--   1. Escrita e leitura direta na tabela que só as funções deviam tocar:
--      contrato (preço e desconto), designacao (motivos em texto livre),
--      bloqueio_agenda (motivo, dado pessoal da profissional).
--   2. Estado ficha_entregue da visita só com o registro assinado.
--   3. IDOR: enfermeira de outra família, enfermeira só com oferta (ainda não
--      aceita) e enfermeira desativada, contra o que é de outra pessoa.
--   4. Matriz de papel e AAL: toda função api da onda recusa (42501) quem não
--      tem o papel e quem tem o papel em AAL1. O anônimo não executa nenhuma.
--
-- Só dado sintético, criado aqui e desfeito no rollback. Os itens 1 e 2
-- falhavam antes da correção nas migrations 0019, 0021, 0022 e 0023 (o insert
-- direto de contrato, a leitura dos motivos, o motivo do bloqueio e a ficha
-- entregue sem registro); os itens 3 e 4 registram o que já estava fechado.
-- =============================================================================

begin;

select plan(51);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2400000-0000-4000-8000-000000000001', 'comercial.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000002', 'financeiro.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000003', 'coordenacao.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000004', 'diretoria.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000005', 'enfermeira.a.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000006', 'enfermeira.b.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000007', 'enfermeira.c.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000008', 'sem.papel.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-000000000009', 'inativa.p40@exemplo.invalid'),
  ('a2400000-0000-4000-8000-00000000000a', 'marketing.p40@exemplo.invalid');

insert into perfil (id, nome, email, ativo) values
  ('a2400000-0000-4000-8000-000000000001', 'Perfil Teste Comercial P40', 'comercial.p40@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000002', 'Perfil Teste Financeiro P40', 'financeiro.p40@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000003', 'Perfil Teste Coordenação P40', 'coordenacao.p40@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000004', 'Perfil Teste Diretoria P40', 'diretoria.p40@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000005', 'Perfil Teste Enfermeira A P40', 'enfermeira.a.p40@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000006', 'Perfil Teste Enfermeira B P40', 'enfermeira.b.p40@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000007', 'Perfil Teste Enfermeira C P40', 'enfermeira.c.p40@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000008', 'Perfil Teste Sem Papel P40', 'sem.papel.p40@exemplo.invalid', true),
  ('a2400000-0000-4000-8000-000000000009', 'Perfil Teste Inativa P40', 'inativa.p40@exemplo.invalid', false),
  ('a2400000-0000-4000-8000-00000000000a', 'Perfil Teste Marketing P40', 'marketing.p40@exemplo.invalid', true);

insert into usuario_papel (usuario_id, papel) values
  ('a2400000-0000-4000-8000-000000000001', 'comercial'),
  ('a2400000-0000-4000-8000-000000000002', 'financeiro'),
  ('a2400000-0000-4000-8000-000000000003', 'coordenacao'),
  ('a2400000-0000-4000-8000-000000000004', 'diretoria'),
  ('a2400000-0000-4000-8000-000000000005', 'enfermeira'),
  ('a2400000-0000-4000-8000-000000000006', 'enfermeira'),
  ('a2400000-0000-4000-8000-000000000007', 'enfermeira'),
  ('a2400000-0000-4000-8000-000000000009', 'enfermeira'),
  ('a2400000-0000-4000-8000-00000000000a', 'marketing');

insert into parametro (chave, valor) values
  ('acesso_enfermeira_pos_encerramento_dias', '7'),
  ('seletor_sinais_doc3_ativo', 'false')
on conflict (chave) do update set valor = excluded.valor;

insert into pacote (id, nome, dias) values ('b2400000-0000-4000-8000-000000000003', 'Pacote Teste P40', 3);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2400000-0000-4000-8000-000000000004', 'b2400000-0000-4000-8000-000000000003', 100, 6, '2020-01-01');

insert into profissional (id, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero) values
  ('d2400000-0000-4000-8000-000000000001', 'a2400000-0000-4000-8000-000000000005', 'Enfermeira A P40', 'enfermeira_obstetrica', 'COREN', 'SP', '000701'),
  ('d2400000-0000-4000-8000-000000000002', 'a2400000-0000-4000-8000-000000000006', 'Enfermeira B P40', 'enfermeira_neonatal', 'COREN', 'SP', '000702'),
  ('d2400000-0000-4000-8000-000000000003', 'a2400000-0000-4000-8000-000000000007', 'Enfermeira C P40', 'enfermeira_neonatal', 'COREN', 'SP', '000703'),
  ('d2400000-0000-4000-8000-000000000004', 'a2400000-0000-4000-8000-000000000009', 'Enfermeira Inativa P40', 'enfermeira_neonatal', 'COREN', 'SP', '000704');

insert into familia (id, nome_exibicao, dpp, data_nascimento, data_alta) values
  ('c2400000-0000-4000-8000-000000000001', 'Família Teste Aurora P40', '2033-01-10', '2033-01-05', '2033-01-07'),
  ('c2400000-0000-4000-8000-000000000002', 'Família Teste Brisa P40',  '2033-01-12', '2033-01-06', '2033-01-08');

insert into bebe (id, familia_id, ordem, nome, peso_nascimento_g) values
  ('e2400000-0000-4000-8000-000000000001', 'c2400000-0000-4000-8000-000000000001', 1, 'Bebê Um P40', 3300),
  ('e2400000-0000-4000-8000-000000000002', 'c2400000-0000-4000-8000-000000000002', 1, 'Bebê Dois P40', 3100);

insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao) values
  ('c2400000-0000-4000-8000-000000000041', 'c2400000-0000-4000-8000-000000000001', 'b2400000-0000-4000-8000-000000000004', 100, 'teste'),
  ('c2400000-0000-4000-8000-000000000042', 'c2400000-0000-4000-8000-000000000002', 'b2400000-0000-4000-8000-000000000004', 100, 'teste');

insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, estado) values
  ('d2400000-0000-4000-8000-000000000011', 'c2400000-0000-4000-8000-000000000041', 'c2400000-0000-4000-8000-000000000001', 3, 6, 'em_execucao'),
  ('d2400000-0000-4000-8000-000000000012', 'c2400000-0000-4000-8000-000000000042', 'c2400000-0000-4000-8000-000000000002', 3, 6, 'em_execucao');

-- A é titular da Aurora, B da Brisa; C só recebeu a oferta de backup da Aurora
-- (ainda não aceitou); a desativada é backup aceita da Brisa.
insert into designacao (id, acompanhamento_id, profissional_id, papel, status, motivo_direta) values
  ('a2400000-0000-4000-8000-0000000000d1', 'd2400000-0000-4000-8000-000000000011', 'd2400000-0000-4000-8000-000000000001', 'titular', 'aceita', 'Urgência sintética da coordenação'),
  ('a2400000-0000-4000-8000-0000000000d2', 'd2400000-0000-4000-8000-000000000012', 'd2400000-0000-4000-8000-000000000002', 'titular', 'aceita', null);
insert into designacao (id, acompanhamento_id, profissional_id, papel, status, prazo_resposta_em) values
  ('a2400000-0000-4000-8000-0000000000d3', 'd2400000-0000-4000-8000-000000000011', 'd2400000-0000-4000-8000-000000000003', 'backup', 'oferecida', now() + interval '20 hours');
insert into designacao (id, acompanhamento_id, profissional_id, papel, status) values
  ('a2400000-0000-4000-8000-0000000000d4', 'd2400000-0000-4000-8000-000000000012', 'd2400000-0000-4000-8000-000000000004', 'backup', 'aceita');
update designacao set motivo_recusa = 'Motivo sintético de recusa' where id = 'a2400000-0000-4000-8000-0000000000d3';

-- Aurora: v1 iniciada (com registro, alerta e áudio), vC concluída sem registro,
-- vD ficha pendente com registro. Brisa: v2 iniciada.
insert into visita (id, acompanhamento_id, profissional_id, dia_numero, data, estado, checkin_em) values
  ('f2400000-0000-4000-8000-000000000001', 'd2400000-0000-4000-8000-000000000011', 'd2400000-0000-4000-8000-000000000001', 1, '2033-01-08', 'iniciada', now() - interval '3 hours'),
  ('f2400000-0000-4000-8000-000000000002', 'd2400000-0000-4000-8000-000000000012', 'd2400000-0000-4000-8000-000000000002', 1, '2033-01-08', 'iniciada', now() - interval '3 hours'),
  ('f2400000-0000-4000-8000-000000000003', 'd2400000-0000-4000-8000-000000000011', 'd2400000-0000-4000-8000-000000000001', 2, '2033-01-09', 'concluida', now() - interval '2 days'),
  ('f2400000-0000-4000-8000-000000000004', 'd2400000-0000-4000-8000-000000000011', 'd2400000-0000-4000-8000-000000000001', 3, '2033-01-10', 'ficha_pendente', now() - interval '1 days');

insert into registro_atendimento (id, visita_id, profissional_id, instrumento_versao, dados, resumo_descritivo, assinado_em, assinatura) values
  ('e3400000-0000-4000-8000-000000000001', 'f2400000-0000-4000-8000-000000000001', 'd2400000-0000-4000-8000-000000000001', 'v1-2026-09', '{}', 'Resumo sintético', now(), repeat('a', 64)),
  ('e3400000-0000-4000-8000-000000000004', 'f2400000-0000-4000-8000-000000000004', 'd2400000-0000-4000-8000-000000000001', 'v1-2026-09', '{}', 'Resumo sintético', now(), repeat('b', 64));

insert into alerta_clinico (id, familia_id, visita_id, regra_id, instrumento_versao, severidade, conduta)
  select 'e4400000-0000-4000-8000-000000000001', 'c2400000-0000-4000-8000-000000000001', 'f2400000-0000-4000-8000-000000000001',
         r.id, r.instrumento_versao, r.severidade, 'Conduta sintética'
  from regra_alerta r order by r.id limit 1;

insert into anexo_audio (id, visita_id, arquivo_path, duracao_seg) values
  ('e5400000-0000-4000-8000-000000000001', 'f2400000-0000-4000-8000-000000000001',
   'visitas/f2400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-000000000001', 30);

insert into bloqueio_agenda (id, profissional_id, inicio, fim, motivo) values
  ('e6400000-0000-4000-8000-000000000001', 'd2400000-0000-4000-8000-000000000001', '2033-02-01', '2033-02-03', 'Licença médica sintética');

-- -----------------------------------------------------------------------------
-- 1. Escrita e leitura direta que só as funções deviam permitir
-- -----------------------------------------------------------------------------

-- contrato: o preço e o desconto nascem em api.salvar_proposta, nunca do cliente
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_ok(
  $s$ insert into contrato (familia_id, pacote_versao_id, valor_centavos, desconto_centavos, parcelas, template_versao)
      values ('c2400000-0000-4000-8000-000000000001', 'b2400000-0000-4000-8000-000000000004', 100, 5000000, 1, 'x') $s$,
  '42501', null, 'comercial não inclui contrato direto (preço e desconto a critério de quem chama)');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000002', 'aal2');
select throws_ok(
  $s$ insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao)
      values ('c2400000-0000-4000-8000-000000000001', 'b2400000-0000-4000-8000-000000000004', 100, 'x') $s$,
  '42501', null, 'financeiro não inclui contrato direto');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000004', 'aal2');
select throws_ok(
  $s$ insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao)
      values ('c2400000-0000-4000-8000-000000000001', 'b2400000-0000-4000-8000-000000000004', 100, 'x') $s$,
  '42501', null, 'diretoria não inclui contrato direto');
select testes.encerrar();
select is((select count(*)::integer from information_schema.column_privileges
            where grantee = 'authenticated' and table_schema = 'public' and table_name = 'contrato'
              and privilege_type in ('INSERT', 'UPDATE')), 0,
  'nenhuma coluna de contrato aceita insert ou update do app');

-- designacao: as linhas continuam legíveis, os motivos em texto livre não
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select motivo_recusa from designacao $s$, '42501', null,
  'comercial não lê o motivo da recusa da enfermeira');
select throws_ok($s$ select motivo_direta from designacao $s$, '42501', null,
  'comercial não lê o motivo da atribuição direta');
select throws_ok($s$ select * from designacao $s$, '42501', null,
  'select * em designacao pede as colunas que o app pode ler');
select ok((select count(*) from designacao where id = 'a2400000-0000-4000-8000-0000000000d1') = 1,
  'comercial continua vendo quem atende a família (linha, papel e estado)');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select motivo_direta from designacao $s$, '42501', null,
  'a enfermeira também não lê o motivo da atribuição direta pela tabela');
select ok((select count(*) from designacao where profissional_id = 'd2400000-0000-4000-8000-000000000001') = 1,
  'a enfermeira continua vendo a própria designação e só ela');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
select throws_ok($s$ select motivo_recusa from designacao $s$, '42501', null,
  'a coordenação lê os motivos pelas funções de api, não pela tabela');
select testes.encerrar();

-- bloqueio_agenda: o motivo é dado pessoal da profissional
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select motivo from bloqueio_agenda $s$, '42501', null,
  'comercial não lê o motivo do bloqueio de agenda da enfermeira');
select ok((select count(*) from bloqueio_agenda where id = 'e6400000-0000-4000-8000-000000000001') = 1,
  'comercial continua vendo quando a enfermeira não atende (início e fim)');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
select ok((select (api.equipe(null, '2033-02-02', false)) is not null),
  'a coordenação continua enxergando a equipe pela função de api');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 2. ficha_entregue só com o registro assinado
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
select lives_ok(
  $s$ select api.transicionar('visita', 'f2400000-0000-4000-8000-000000000003', 'ficha_pendente', 'sintético') $s$,
  'a enfermeira da visita passa a visita concluída para ficha pendente');
select throws_like(
  $s$ select api.transicionar('visita', 'f2400000-0000-4000-8000-000000000003', 'ficha_entregue', 'sintético') $s$,
  '%checklist:ficha_sem_registro%', 'a enfermeira não dá a ficha por entregue sem registro assinado');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000003', 'aal2');
select throws_like(
  $s$ select api.transicionar('visita', 'f2400000-0000-4000-8000-000000000003', 'ficha_entregue', 'sintético') $s$,
  '%checklist:ficha_sem_registro%', 'nem a coordenação dá a ficha por entregue sem registro assinado');
select testes.encerrar();
select is((select estado::text from visita where id = 'f2400000-0000-4000-8000-000000000003'), 'ficha_pendente',
  'a visita sem registro fica em ficha pendente');
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
select lives_ok(
  $s$ select api.transicionar('visita', 'f2400000-0000-4000-8000-000000000004', 'ficha_entregue', 'sintético') $s$,
  'com o registro assinado gravado, a ficha fica entregue');
select testes.encerrar();
select is((select estado::text from visita where id = 'f2400000-0000-4000-8000-000000000004'), 'ficha_entregue',
  'a visita com registro chegou a ficha entregue');

-- -----------------------------------------------------------------------------
-- 3. IDOR: quem não é da família não lê nem grava nada dela
-- -----------------------------------------------------------------------------

-- B é titular da Brisa e tenta a Aurora (de A)
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000006', 'aal2');
select throws_ok($s$ select api.checklist_visita('f2400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'B não abre o checklist de uma visita da Aurora');
select throws_ok($s$ select api.registrar_chegada('f2400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'B não registra a chegada numa visita da Aurora');
select throws_ok($s$ select api.registrar_saida('f2400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'B não registra a saída numa visita da Aurora');
select throws_ok($s$ select api.contato_medico_situacao('c2400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'B não vê o contato médico da Aurora');
select throws_ok($s$ select api.audio_da_visita_para_ouvir('e5400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'B não ouve o áudio de uma visita da Aurora');
select throws_ok(
  $s$ select api.registrar_adendo('e3400000-0000-4000-8000-000000000001', 'motivo sintético', 'conteúdo sintético') $s$,
  '42501', null, 'B não faz adendo no registro da Aurora');
select throws_ok(
  $s$ select api.registrar_acionamento_alerta('e4400000-0000-4000-8000-000000000001', 1, 'sinal', now(), 'orientação', 'conduta') $s$,
  '42501', null, 'B não registra o acionamento de um alerta da Aurora');
select throws_ok(
  $s$ select api.registrar_alerta_clinico('f2400000-0000-4000-8000-000000000001', 'PU-01', 'v1-2026-09') $s$,
  '42501', null, 'B não cria alerta numa visita da Aurora');
select throws_ok(
  $s$ select api.registrar_anexo_audio('f2400000-0000-4000-8000-000000000001',
        'visitas/f2400000-0000-4000-8000-000000000001/e5400000-0000-4000-8000-0000000000ff', 10) $s$,
  '42501', null, 'B não anexa áudio numa visita da Aurora');
select throws_ok($s$ select api.transicionar('visita', 'f2400000-0000-4000-8000-000000000001', 'concluida') $s$, '42501', null,
  'B não muda o estado de uma visita da Aurora');
select throws_like($s$ select api.responder_designacao('a2400000-0000-4000-8000-0000000000d3', true) $s$,
  '%operacao:oferta_inexistente%', 'B não responde a oferta de C: para ela a oferta não existe');
select is(api.alertas_clinicos('todos', 'c2400000-0000-4000-8000-000000000001'), '[]'::jsonb,
  'B pedindo os alertas da Aurora recebe lista vazia');
select is((select count(*)::integer from jsonb_array_elements(api.alertas_clinicos('todos', null)) e
            where e ->> 'familia_id' = 'c2400000-0000-4000-8000-000000000001'), 0,
  'B pedindo todos os alertas não recebe os da Aurora');
select is((select count(*)::integer from jsonb_array_elements(api.portal_familias()) e
            where e ->> 'familia_id' = 'c2400000-0000-4000-8000-000000000001'), 0,
  'a lista de famílias de B não traz a Aurora');
select is((select count(*)::integer from jsonb_array_elements(api.portal_familias()) e
            where e ->> 'familia_id' = 'c2400000-0000-4000-8000-000000000002'), 1,
  'a lista de famílias de B traz a Brisa');
select ok((select count(*) from visita) = 1 and not exists (select 1 from visita where id = 'f2400000-0000-4000-8000-000000000001'),
  'pela tabela, B enxerga só a visita da Brisa');
select testes.encerrar();

-- C só recebeu a oferta de backup (não aceitou): ainda não é da família
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000007', 'aal2');
select throws_ok($s$ select api.checklist_visita('f2400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'C, só com a oferta, não abre o checklist da Aurora');
select throws_ok($s$ select api.contato_medico_situacao('c2400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'C, só com a oferta, não vê o contato médico da Aurora');
select throws_ok($s$ select api.registrar_chegada('f2400000-0000-4000-8000-000000000001') $s$, '42501', null,
  'C, só com a oferta, não registra chegada na Aurora');
select is(api.portal_familias(), '[]'::jsonb, 'C, só com a oferta, não tem família na lista');
select is(api.alertas_clinicos('todos', null), '[]'::jsonb, 'C, só com a oferta, não vê alerta de ninguém');
select is(jsonb_array_length(api.minhas_ofertas()), 1, 'C vê a própria oferta');
select ok(not ((api.minhas_ofertas() -> 0) ?| array['familia_id', 'endereco', 'telefone', 'email', 'contrato']),
  'a oferta de C não entrega id, endereço, telefone nem contrato antes do aceite');
select testes.encerrar();

-- a desativada (backup aceita da Brisa) perde tudo
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000009', 'aal2');
select throws_ok($s$ select api.checklist_visita('f2400000-0000-4000-8000-000000000002') $s$, '42501', null,
  'a enfermeira desativada não abre o checklist da Brisa');
select throws_ok($s$ select api.portal_familias() $s$, '42501', null,
  'a enfermeira desativada não abre a lista de famílias');
select testes.encerrar();

-- A vê o que é dela (a prova de que os 42501 acima são de acesso, não de defeito)
select testes.autenticar_authenticated('a2400000-0000-4000-8000-000000000005', 'aal2');
select lives_ok($s$ select api.checklist_visita('f2400000-0000-4000-8000-000000000001') $s$,
  'A abre o checklist da própria visita');
select lives_ok($s$ select api.contato_medico_situacao('c2400000-0000-4000-8000-000000000001') $s$,
  'A vê o contato médico da própria família');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 4. Matriz de papel e AAL de toda função api da onda
-- -----------------------------------------------------------------------------

create temp table t_matriz (funcao text, persona text, aal text, resultado text, msg text);
grant all on t_matriz to public;

do $matriz$
declare
  f        record;
  ps       record;
  aal      text;
  args     text;
  i        integer;
  ty       text;
  v        text;
  res      text;
  msg      text;
  papeis   text[];
  exige    text;
  ok_papel boolean;
begin
  for f in
    select p.oid, p.proname, p.proargnames as nomes, p.proargtypes::oid[] as tipos, p.pronargs, p.prosrc
    from pg_proc p
    where p.pronamespace = 'api'::regnamespace
      and p.proname = any (array[
        'baixar_cobranca_manual', 'cobranca', 'cobrancas', 'concluir_envio_contrato', 'contrato_situacao',
        'dados_link_pagamento', 'dados_para_contrato', 'gerar_cobranca', 'liberar_envio_contrato',
        'registrar_contrato_gerado', 'registrar_link_pagamento', 'reservar_envio_contrato',
        'agendar_consulta_prenatal', 'alocacao_familia', 'atribuir_designacao', 'minhas_ofertas',
        'oferecer_designacao', 'prenatal_abrir', 'prenatal_concluir', 'prenatal_consultas',
        'prenatal_salvar_campo', 'radar_nascimentos', 'registrar_alta', 'registrar_nascimento',
        'registrar_previsao_alta', 'responder_designacao',
        'agenda', 'equipe', 'escala_semanal', 'portal_familias', 'portal_hoje', 'portal_perfil',
        'reagendar_cascata', 'reagendar_visita', 'registrar_chegada', 'registrar_saida',
        'remover_bloqueio_agenda', 'salvar_bloqueio_agenda', 'salvar_documento_profissional',
        'salvar_profissional', 'sincronizacao_item', 'sincronizacao_registrar',
        'alertas_clinicos', 'audio_da_visita_para_ouvir', 'checklist_visita', 'contato_medico_situacao',
        'fechar_alerta_clinico', 'registrar_acionamento_alerta', 'registrar_adendo',
        'registrar_alerta_clinico', 'registrar_anexo_audio', 'registrar_atendimento',
        'supervisao_medica_telefone'])
    order by p.proname
  loop
    -- papéis e AAL que a própria função declara em privado.autorizar
    papeis := string_to_array(regexp_replace(
                (regexp_match(f.prosrc, 'autorizar\(\s*array\[([^\]]*)\]::public\.papel_usuario\[\],\s*(true|false)'))[1],
                '[\s'']', '', 'g'), ',');
    exige := (regexp_match(f.prosrc, 'autorizar\(\s*array\[([^\]]*)\]::public\.papel_usuario\[\],\s*(true|false)'))[2];

    for ps in
      select * from (values
        ('anonimo',     null::uuid,                                         'anon',          'papel_nenhum'),
        ('sem_papel',   'a2400000-0000-4000-8000-000000000008'::uuid,        'authenticated', 'sem_papel'),
        ('desativada',  'a2400000-0000-4000-8000-000000000009'::uuid,        'authenticated', 'enfermeira'),
        ('marketing',   'a2400000-0000-4000-8000-00000000000a'::uuid,        'authenticated', 'marketing'),
        ('comercial',   'a2400000-0000-4000-8000-000000000001'::uuid,        'authenticated', 'comercial'),
        ('financeiro',  'a2400000-0000-4000-8000-000000000002'::uuid,        'authenticated', 'financeiro'),
        ('coordenacao', 'a2400000-0000-4000-8000-000000000003'::uuid,        'authenticated', 'coordenacao'),
        ('diretoria',   'a2400000-0000-4000-8000-000000000004'::uuid,        'authenticated', 'diretoria'),
        ('enfermeira',  'a2400000-0000-4000-8000-000000000005'::uuid,        'authenticated', 'enfermeira')
      ) as x(persona, sub, papel_banco, papel)
    loop
      foreach aal in array array['aal1', 'aal2'] loop
        -- argumentos: ids sorteados (a checagem de papel vem antes de qualquer busca)
        args := '';
        for i in 1 .. f.pronargs loop
          ty := format_type(f.tipos[i - 1], null);
          v := case ty
            when 'uuid' then quote_literal(gen_random_uuid())
            when 'text' then '''x'''
            when 'integer' then '1'
            when 'bigint' then '1'
            when 'date' then 'current_date'
            when 'timestamp with time zone' then 'now()'
            when 'jsonb' then '''{}''::jsonb'
            when 'boolean' then 'false'
            when 'uuid[]' then '''{}''::uuid[]'
            when 'time without time zone' then '''10:00''::time'
            else quote_literal((select e.enumlabel from pg_enum e where e.enumtypid = f.tipos[i - 1]
                                order by e.enumsortorder limit 1)) || '::' || ty end;
          args := args || case when i > 1 then ',' else '' end || v || '::' || ty;
        end loop;

        -- o papel "desativada" tem o papel no banco, mas o perfil está inativo:
        -- para a matriz vale como sem papel
        ok_papel := ps.persona <> 'desativada' and ps.papel = any (papeis);
        if ps.persona = 'anonimo' then
          ok_papel := false;
        end if;

        begin
          if ps.papel_banco = 'anon' then
            perform set_config('role', 'anon', true);
            perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          else
            perform set_config('role', 'authenticated', true);
            perform set_config('request.jwt.claims',
              json_build_object('sub', ps.sub, 'role', 'authenticated', 'aal', aal)::text, true);
          end if;
          execute format('select api.%I(%s)', f.proname, args);
          res := 'ok';
          msg := '';
          raise exception using errcode = 'XR001', message = 'desfaz';
        exception
          when sqlstate 'XR001' then null;
          when others then res := 'erro ' || sqlstate; msg := left(sqlerrm, 100);
        end;

        insert into t_matriz values (f.proname, ps.persona, aal, res, msg);
        -- só interessa o que devia ser recusado: sem papel (qualquer AAL) e
        -- com papel em AAL1 (todas as funções da onda exigem AAL2)
        if not (ok_papel and aal = 'aal2') and exige = 'true' and res <> 'erro 42501' then
          insert into t_matriz values (f.proname, ps.persona, aal, 'VIOLACAO', res || ' ' || msg);
        end if;
      end loop;
    end loop;
  end loop;
end
$matriz$;

select is((select count(distinct funcao)::integer from t_matriz), 53,
  'a matriz cobre as 53 funções de api da onda que checam papel por privado.autorizar');
select is((select count(*)::integer from t_matriz where resultado = 'VIOLACAO'), 0,
  'nenhuma função da onda deixa passar quem não tem o papel ou está em AAL1');
select is((select count(*)::integer from t_matriz where persona = 'anonimo' and resultado <> 'erro 42501'), 0,
  'o anônimo não executa nenhuma função de api da onda');
select is((select count(*)::integer from t_matriz where persona = 'desativada' and aal = 'aal2' and resultado <> 'erro 42501'), 0,
  'a enfermeira com perfil desativado não executa nenhuma função de api da onda');

select * from finish();

rollback;
