-- =============================================================================
-- supabase/tests/027_p51_talentos_manuais.sql
--
-- Aceite do P51 (PROMPTS.md v2): "página pública desligada por padrão;
-- avaliação com os critérios registrada."
--   1. Tarefas por equipe (contagens, papéis).
--   2. Manuais: versão, confirmação de leitura, público-alvo, versão
--      imutável; trilhas de treinamento e o andamento de cada pessoa.
--   3. Banco de talentos: roteiro de 26 perguntas e 10 critérios do seed,
--      cadastro, avaliação (nota de 1 a 5 por critério), estado, papéis, log.
--   4. Página pública de candidatura: desligada por padrão; ligada, com
--      validação, consentimento, limite de envios e sem duplicar.
--
-- Só dado sintético, criado aqui e desfeito no rollback.
-- =============================================================================

begin;

select plan(82);

insert into auth.users (id, email) values
  ('a3100000-0000-4000-8000-000000000001', 'coordenacao.p51@exemplo.invalid'),
  ('a3100000-0000-4000-8000-000000000002', 'diretoria.p51@exemplo.invalid'),
  ('a3100000-0000-4000-8000-000000000003', 'comercial.p51@exemplo.invalid'),
  ('a3100000-0000-4000-8000-000000000004', 'enfermeira.a.p51@exemplo.invalid'),
  ('a3100000-0000-4000-8000-000000000005', 'enfermeira.b.p51@exemplo.invalid'),
  ('a3100000-0000-4000-8000-000000000006', 'marketing.p51@exemplo.invalid');
insert into perfil (id, nome, email, ativo) values
  ('a3100000-0000-4000-8000-000000000001', 'Perfil Teste Coordenação P51', 'coordenacao.p51@exemplo.invalid', true),
  ('a3100000-0000-4000-8000-000000000002', 'Perfil Teste Diretoria P51', 'diretoria.p51@exemplo.invalid', true),
  ('a3100000-0000-4000-8000-000000000003', 'Perfil Teste Comercial P51', 'comercial.p51@exemplo.invalid', true),
  ('a3100000-0000-4000-8000-000000000004', 'Perfil Teste Enfermeira A P51', 'enfermeira.a.p51@exemplo.invalid', true),
  ('a3100000-0000-4000-8000-000000000005', 'Perfil Teste Enfermeira B P51', 'enfermeira.b.p51@exemplo.invalid', true),
  ('a3100000-0000-4000-8000-000000000006', 'Perfil Teste Marketing P51', 'marketing.p51@exemplo.invalid', true);
insert into usuario_papel (usuario_id, papel) values
  ('a3100000-0000-4000-8000-000000000001', 'coordenacao'),
  ('a3100000-0000-4000-8000-000000000002', 'diretoria'),
  ('a3100000-0000-4000-8000-000000000003', 'comercial'),
  ('a3100000-0000-4000-8000-000000000004', 'enfermeira'),
  ('a3100000-0000-4000-8000-000000000005', 'enfermeira'),
  ('a3100000-0000-4000-8000-000000000006', 'marketing');

create temp table t_r (chave text primary key, j jsonb);
grant all on t_r to public;

-- -----------------------------------------------------------------------------
-- 1. Tarefas por equipe
-- -----------------------------------------------------------------------------

insert into tarefa (tipo, papel_responsavel, prioridade, titulo, vence_em, status, concluida_em) values
  ('outro', 'marketing', 'normal', 'Tarefa P51 vencida', now() - interval '2 days', 'aberta', null),
  ('outro', 'marketing', 'alta', 'Tarefa P51 no prazo', now() + interval '2 days', 'aberta', null),
  ('outro', 'marketing', 'normal', 'Tarefa P51 feita', now() - interval '1 day', 'concluida', now() - interval '1 day'),
  ('outro', 'marketing', 'normal', 'Tarefa P51 feita há muito', now() - interval '30 days', 'concluida', now() - interval '20 days');
insert into tarefa (tipo, responsavel_id, prioridade, titulo, vence_em, status) values
  ('outro', 'a3100000-0000-4000-8000-000000000003', 'normal', 'Tarefa P51 do comercial', now() + interval '1 day', 'em_andamento');

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000003', 'aal1');
select throws_ok($s$ select api.tarefas_por_equipe() $s$, '42501', null, 'comercial não abre a visão de tarefas por equipe');
select testes.encerrar();
select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.tarefas_por_equipe() $s$, '42501', null, 'sem MFA, nem a coordenação abre');
select testes.encerrar();
select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'eq', api.tarefas_por_equipe();
select testes.encerrar();
select is((select x ->> 'abertas' from t_r, jsonb_array_elements(j -> 'equipes') x where chave = 'eq' and x ->> 'equipe' = 'marketing'), '2', 'equipe marketing: 2 abertas');
select is((select x ->> 'vencidas' from t_r, jsonb_array_elements(j -> 'equipes') x where chave = 'eq' and x ->> 'equipe' = 'marketing'), '1', 'equipe marketing: 1 vencida');
select is((select x ->> 'concluidas_7d' from t_r, jsonb_array_elements(j -> 'equipes') x where chave = 'eq' and x ->> 'equipe' = 'marketing'), '1', 'equipe marketing: só a concluída dos últimos 7 dias conta');
select is((select x ->> 'sem_responsavel' from t_r, jsonb_array_elements(j -> 'equipes') x where chave = 'eq' and x ->> 'equipe' = 'marketing'), '2', 'equipe marketing: 2 sem responsável');
select is((select x ->> 'em_andamento' from t_r, jsonb_array_elements(j -> 'equipes') x where chave = 'eq' and x ->> 'equipe' = 'comercial'), '1', 'a tarefa da pessoa vai para a equipe do papel dela');
select is((select x ->> 'abertas' from t_r, jsonb_array_elements(j -> 'pessoas') x where chave = 'eq' and x ->> 'nome' = 'Perfil Teste Comercial P51'), '1', 'a carga por pessoa traz o comercial');
select is((select x ->> 'titulo' from t_r, jsonb_array_elements(j -> 'tarefas') x where chave = 'eq' and x ->> 'titulo' like 'Tarefa P51%' order by (x ->> 'vencida') desc, x ->> 'titulo' limit 1),
  'Tarefa P51 vencida', 'a lista põe a vencida primeiro');

-- -----------------------------------------------------------------------------
-- 2. Manuais e treinamentos
-- -----------------------------------------------------------------------------

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($s$ select api.manual_salvar(null, 'Manual X', 'manual', '{}', 'Texto') $s$, '42501', null, 'enfermeira não cria manual');
select testes.encerrar();

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'm1', api.manual_salvar(null, 'Manual de teste para todos', 'manual', '{}', 'Primeira versão do texto de teste.');
insert into t_r select 'm2', api.manual_salvar(null, 'Protocolo de teste das enfermeiras', 'protocolo', '{enfermeira}', 'Texto do protocolo de teste.');
insert into t_r select 'm3', api.manual_salvar(null, 'Manual só do comercial', 'manual', '{comercial}', 'Texto só do comercial.');
select is((select j ->> 'versao' from t_r where chave = 'm1'), '1', 'manual novo nasce na versão 1');
select throws_ok($s$ select api.manual_salvar(null, 'Curto', 'manual', '{}', '') $s$, 'P0001', null, 'manual sem texto é recusado');
select throws_ok($s$ select api.manual_salvar(null, 'Categoria ruim', 'livro', '{}', 'Texto') $s$, 'P0001', null, 'categoria que não existe é recusada');
select testes.encerrar();
insert into t_r select 'v1', pg_catalog.jsonb_build_object('id', v.id)
from privado.manual_versao v where v.versao = 1 and v.manual_id = (select (j ->> 'manual_id')::uuid from t_r where chave = 'm1');

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000004', 'aal2');
select is((select count(*)::integer from jsonb_array_elements(api.manuais_listar()) x where x ->> 'titulo' like '%de teste%' or x ->> 'titulo' like '%só do comercial%'), 2,
  'a enfermeira vê o manual de todos e o do público dela, e não o do comercial');
select is((select x ->> 'lido' from jsonb_array_elements(api.manuais_listar()) x where x ->> 'titulo' = 'Manual de teste para todos'), 'false', 'ainda não confirmou a leitura');
select throws_ok($s$ select api.manual_obter((select (j ->> 'manual_id')::uuid from t_r where chave = 'm3')) $s$, 'P0001', null, 'e não abre o manual do comercial pelo id');
select is(api.manual_confirmar_leitura((select (api.manual_obter((select (j ->> 'manual_id')::uuid from t_r where chave = 'm1')) ->> 'versao_id')::uuid)) ->> 'ok', 'true', 'confirma a leitura da versão 1');
select is((select x ->> 'lido' from jsonb_array_elements(api.manuais_listar()) x where x ->> 'titulo' = 'Manual de teste para todos'), 'true', 'a leitura aparece confirmada');
select is(api.manual_confirmar_leitura((select (api.manual_obter((select (j ->> 'manual_id')::uuid from t_r where chave = 'm1')) ->> 'versao_id')::uuid)) ->> 'ok', 'true', 'confirmar de novo não muda nada');
select testes.encerrar();
select is((select count(*)::integer from privado.manual_leitura ml join privado.manual_versao v on v.id = ml.versao_id join privado.manual m on m.id = v.manual_id where m.titulo = 'Manual de teste para todos'), 1,
  'a confirmação ficou uma só vez');

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select api.manual_salvar((select (j ->> 'manual_id')::uuid from t_r where chave = 'm1'), 'Manual de teste para todos', 'manual', '{}', 'Segunda versão do texto de teste.') $s$, 'P0001', null,
  'mudar o texto sem dizer o que mudou é recusado');
select is(api.manual_salvar((select (j ->> 'manual_id')::uuid from t_r where chave = 'm1'), 'Manual de teste para todos', 'manual', '{}', 'Segunda versão do texto de teste.', 'Trocamos o segundo parágrafo.') ->> 'versao', '2',
  'mudar o texto publica a versão 2');
select is(api.manual_salvar((select (j ->> 'manual_id')::uuid from t_r where chave = 'm1'), 'Manual de teste para todos (título novo)', 'manual', '{}', 'Segunda versão do texto de teste.') ->> 'nova_versao', 'false',
  'mudar só o título não publica versão');
select testes.encerrar();

select throws_ok($s$ update privado.manual_versao set conteudo = 'x' $s$, '42501', null, 'versão publicada não se altera');

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000004', 'aal2');
select is((select x ->> 'lido' from jsonb_array_elements(api.manuais_listar()) x where x ->> 'titulo' like 'Manual de teste para todos%'), 'false', 'versão nova não herda a confirmação');
select throws_ok($s$ select api.manual_confirmar_leitura((select (j ->> 'id')::uuid from t_r where chave = 'v1')) $s$, 'P0001', null,
  'e a versão antiga não se confirma mais');
select testes.encerrar();

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal2');
select is(pg_catalog.jsonb_array_length(api.manual_obter((select (j ->> 'manual_id')::uuid from t_r where chave = 'm1')) -> 'historico'), 2, 'o histórico tem as duas versões');
insert into t_r select 'leit', api.manual_leituras((select (j ->> 'manual_id')::uuid from t_r where chave = 'm1'));
select is((select x ->> 'confirmou' from t_r, jsonb_array_elements(j -> 'pessoas') x where chave = 'leit' and x ->> 'nome' = 'Perfil Teste Enfermeira A P51'), 'false', 'quem ainda não confirmou a versão atual aparece pendente');
select testes.encerrar();

-- trilha das enfermeiras: dois manuais na ordem; a A confirma um
select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'tr', api.trilha_salvar(null, 'Trilha de teste das enfermeiras', 'enfermeira', true,
  array[(select (j ->> 'manual_id')::uuid from t_r where chave = 'm2'), (select (j ->> 'manual_id')::uuid from t_r where chave = 'm1')]);
select throws_ok($s$ select api.trilha_salvar(null, 'Trilha repetida', 'enfermeira', true, array[(select (j ->> 'manual_id')::uuid from t_r where chave = 'm1'), (select (j ->> 'manual_id')::uuid from t_r where chave = 'm1')]) $s$, 'P0001', null,
  'manual repetido na trilha é recusado');
select testes.encerrar();
select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000004', 'aal2');
select api.manual_confirmar_leitura((select (api.manual_obter((select (j ->> 'manual_id')::uuid from t_r where chave = 'm2')) ->> 'versao_id')::uuid));
select is((select x #>> '{itens,0,titulo}' from jsonb_array_elements(api.trilhas_listar()) x where x ->> 'nome' = 'Trilha de teste das enfermeiras'), 'Protocolo de teste das enfermeiras', 'a trilha respeita a ordem');
select is((select x #>> '{itens,0,lido}' from jsonb_array_elements(api.trilhas_listar()) x where x ->> 'nome' = 'Trilha de teste das enfermeiras'), 'true', 'o primeiro item da trilha está lido');
select is((select x #>> '{itens,1,lido}' from jsonb_array_elements(api.trilhas_listar()) x where x ->> 'nome' = 'Trilha de teste das enfermeiras'), 'false', 'o segundo não');
select testes.encerrar();
select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000003', 'aal1');
select is((select count(*)::integer from jsonb_array_elements(api.trilhas_listar()) x where x ->> 'nome' = 'Trilha de teste das enfermeiras'), 0, 'a trilha das enfermeiras não aparece para o comercial');
select testes.encerrar();
select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal2');
select is((select (x -> 'equipe' -> 0 ->> 'total') from jsonb_array_elements(api.trilhas_listar()) x where x ->> 'nome' = 'Trilha de teste das enfermeiras'), '2',
  'a coordenação vê o andamento de cada enfermeira (total de itens)');
select is((select y ->> 'feitos' from jsonb_array_elements(api.trilhas_listar()) x, jsonb_array_elements(x -> 'equipe') y
           where x ->> 'nome' = 'Trilha de teste das enfermeiras' and y ->> 'nome' = 'Perfil Teste Enfermeira A P51'), '1', 'a enfermeira A fez 1 de 2');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 3. Banco de talentos
-- -----------------------------------------------------------------------------

select is((select count(*)::integer from parametro p, jsonb_array_elements(p.valor -> 'blocos') b, jsonb_array_elements(b -> 'perguntas') q where p.chave = 'talentos_roteiro'), 26,
  'o roteiro do seed tem 26 perguntas');
select is((select jsonb_array_length(p.valor -> 'blocos') from parametro p where p.chave = 'talentos_roteiro'), 5, 'em 5 blocos');
select is((select jsonb_array_length(p.valor -> 'criterios') from parametro p where p.chave = 'talentos_roteiro'), 10, 'e 10 critérios');
select is((select (p.valor #>> '{escala,max}')::integer from parametro p where p.chave = 'talentos_roteiro'), 5, 'de 1 a 5');

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000003', 'aal1');
select throws_ok($s$ select api.talentos_listar() $s$, '42501', null, 'comercial não vê candidaturas (PRD 13)');
select testes.encerrar();
select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000004', 'aal2');
select throws_ok($s$ select api.talentos_listar() $s$, '42501', null, 'enfermeira não vê candidaturas');
select testes.encerrar();
select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.talentos_listar() $s$, '42501', null, 'sem MFA, nem a coordenação abre as candidaturas');
select testes.encerrar();

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal2');
insert into t_r select 'c1', api.talento_salvar(null, 'Candidata Teste P51', '(11) 90000-5101', 'candidata.p51@exemplo.invalid', 'São Paulo', 'COREN-SP 000000', 'Enfermeira de teste.', null);
select throws_ok($s$ select api.talento_salvar(null, 'Sem contato P51') $s$, 'P0001', null, 'candidata sem telefone nem e-mail é recusada');
select is(api.talentos_listar() ->> 'pagina_publica_ativa', 'false', 'a página pública está desligada por padrão');

-- avaliação: nota de 1 a 5 em cada critério
select throws_ok($s$ select api.talento_avaliar((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'), '{}', '{"c01": 6}') $s$, 'P0001', null, 'nota 6 é recusada');
select throws_ok($s$ select api.talento_avaliar((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'), '{}', '{"c01": 0}') $s$, 'P0001', null, 'nota 0 é recusada');
select throws_ok($s$ select api.talento_avaliar((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'), '{}', '{"c01": 3.5}') $s$, 'P0001', null, 'nota quebrada é recusada');
select throws_ok($s$ select api.talento_avaliar((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'), '{}', '{"c99": 3}') $s$, 'P0001', null, 'critério que não existe é recusado');
select throws_ok($s$ select api.talento_avaliar((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'), '{"p99": "x"}', '{}') $s$, 'P0001', null, 'pergunta que não existe é recusada');
insert into t_r select 'av1', api.talento_avaliar((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'),
  '{"p01": "Dez anos de neonatologia.", "p12": "Observo a pega e a deglutição."}',
  '{"c01": 5, "c02": 4, "c03": 4, "c04": 5, "c05": 3}', 'Boa entrevista.');
select is((select j ->> 'criterios_avaliados' from t_r where chave = 'av1'), '5', 'avaliação parcial: 5 critérios avaliados');
select is((select j ->> 'completa' from t_r where chave = 'av1'), 'false', 'e ainda não está completa');
select is((select j ->> 'media' from t_r where chave = 'av1'), '4.20', 'média dos cinco critérios: 4,2');
insert into t_r select 'av2', api.talento_avaliar((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'),
  '{"p01": "Dez anos de neonatologia."}',
  '{"c01": 5, "c02": 4, "c03": 4, "c04": 5, "c05": 3, "c06": 5, "c07": 5, "c08": 4, "c09": 5, "c10": 4}', null);
select is((select j ->> 'completa' from t_r where chave = 'av2'), 'true', 'com os 10 critérios a avaliação está completa');
select is((select j ->> 'media' from t_r where chave = 'av2'), '4.40', 'média dos dez critérios: 4,4');
select is(api.talento_estado((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'), 'entrevistada') ->> 'estado', 'entrevistada', 'muda o estado da candidata');
select throws_ok($s$ select api.talento_estado((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'), 'contratada') $s$, 'P0001', null, 'estado que não existe é recusado');
insert into t_r select 'obt', api.talento_obter((select (j ->> 'candidata_id')::uuid from t_r where chave = 'c1'));
select is(pg_catalog.jsonb_array_length((select j -> 'avaliacoes' from t_r where chave = 'obt')), 1, 'salvar de novo a avaliação atualiza a mesma (uma por avaliadora)');
select is((select j #>> '{avaliacoes,0,notas,c10}' from t_r where chave = 'obt'), '4', 'a nota de cada critério ficou registrada');
select is((select j #>> '{roteiro,versao}' from t_r where chave = 'obt'), 'R-1 provisório', 'e a versão do roteiro usada');
select is((api.talentos_listar('entrevistada') -> 'candidatas' -> 0 ->> 'media_geral'), '4.40', 'a lista traz a média e filtra por estado');
select testes.encerrar();

select is((select valor_depois ->> 'nome' from log_auditoria where entidade = 'privado.candidata' and acao = 'insert' order by id desc limit 1), '[oculto]',
  'o log de auditoria oculta o nome da candidata');
select ok(exists (select 1 from log_auditoria where entidade = 'privado.candidata' and acao = 'leitura'), 'abrir a candidata grava a leitura no log');

-- -----------------------------------------------------------------------------
-- 4. Página pública de candidatura
-- -----------------------------------------------------------------------------

select is((select (valor ->> 'ativa')::boolean from parametro where chave = 'talentos_pagina_publica'), false, 'o seed deixa a página pública desligada');

select testes.autenticar_authenticated('a3100000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($s$ select public.candidatura_abrir() $s$, '42501', null, 'a equipe não chama a função aberta direto');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select public.candidatura_enviar('{}', 'x') $s$, '42501', null, 'anônimo não chama a função aberta direto');
select testes.encerrar();

select testes.autenticar_service_role();
select is(public.candidatura_abrir() ->> 'situacao', 'desligada', 'desligada: a página avisa que não recebe candidaturas');
select is(public.candidatura_enviar('{"nome":"Fulana Teste P51","email":"fulana.p51@exemplo.invalid","consentimento":{"aceito":true,"versao":"T-1 provisório"}}', '203.0.113.51') ->> 'situacao', 'desligada',
  'desligada: o envio é recusado');
select testes.encerrar();
select is((select count(*)::integer from privado.candidata where nome = 'Fulana Teste P51'), 0, 'desligada: nada foi gravado');

update parametro set valor = '{"ativa": true, "termo_versao": "T-1 provisório", "tentativas_max": 4, "janela_minutos": 60}' where chave = 'talentos_pagina_publica';
select testes.autenticar_service_role();
select is(public.candidatura_abrir() ->> 'situacao', 'ok', 'ligada: a página abre');
select is(public.candidatura_enviar('{"nome":"Fulana Teste P51","telefone":"(11) 90000-5102","email":"fulana.p51@exemplo.invalid","cidade":"Londrina","consentimento":{"aceito":true,"versao":"T-1 provisório"}}', '203.0.113.52') ->> 'situacao', 'recebido',
  'ligada: candidatura recebida');
select is(public.candidatura_enviar('{"nome":"Fulana Teste P51","telefone":"(11) 90000-5102","consentimento":{"aceito":true,"versao":"T-1 provisório"}}', '203.0.113.53') ->> 'situacao', 'recebido',
  'a mesma pessoa de novo: recebido, sem duplicar');
select is(public.candidatura_enviar('{"nome":"Sem Aceite P51","email":"sem.aceite.p51@exemplo.invalid"}', '203.0.113.54') #>> '{erros,consentimento}', 'obrigatorio', 'sem o aceite do termo: corrigir');
select is(public.candidatura_enviar('{"nome":"Termo Velho P51","email":"velho.p51@exemplo.invalid","consentimento":{"aceito":true,"versao":"T-0"}}', '203.0.113.55') #>> '{erros,consentimento}', 'obrigatorio', 'com o termo de outra versão: corrigir');
select is(public.candidatura_enviar('{"nome":"X","email":"nao-e-email","consentimento":{"aceito":true,"versao":"T-1 provisório"}}', '203.0.113.56') #>> '{erros,email}', 'invalido', 'e-mail inválido: corrigir');
select is(public.candidatura_enviar('{"nome":"Sem Contato P51","consentimento":{"aceito":true,"versao":"T-1 provisório"}}', '203.0.113.57') #>> '{erros,contato}', 'obrigatorio', 'sem telefone nem e-mail: corrigir');
select is(public.candidatura_enviar('{"nome":"Limite P51","email":"limite.p51@exemplo.invalid","consentimento":{"aceito":true,"versao":"T-1 provisório"}}', '203.0.113.58') ->> 'situacao', 'recebido', 'limite: quarta chamada da janela ainda passa (a primeira foi de outra origem)');
select testes.encerrar();
select is((select count(*)::integer from privado.candidata where nome = 'Fulana Teste P51'), 1, 'ligada: uma candidata só');
select is((select origem from privado.candidata where nome = 'Fulana Teste P51'), 'pagina_publica', 'a origem é a página pública');
select is((select consentimento #>> '{lgpd_talentos,versao}' from privado.candidata where nome = 'Fulana Teste P51'), 'T-1 provisório', 'o aceite do termo fica registrado com a versão');
select ok(exists (select 1 from notificacao where papel = 'coordenacao' and titulo = 'Nova candidatura no banco de talentos'), 'a coordenação recebe o aviso, sem nome');

update parametro set valor = valor || '{"tentativas_max": 1}' where chave = 'talentos_pagina_publica';
select testes.autenticar_service_role();
select is(public.candidatura_enviar('{"nome":"Uma P51","email":"uma.p51@exemplo.invalid","consentimento":{"aceito":true,"versao":"T-1 provisório"}}', '203.0.113.60') ->> 'situacao', 'recebido', 'limite de envios: o primeiro passa');
select is(public.candidatura_enviar('{"nome":"Duas P51","email":"duas.p51@exemplo.invalid","consentimento":{"aceito":true,"versao":"T-1 provisório"}}', '203.0.113.60') ->> 'situacao', 'limite', 'limite de envios: o segundo da mesma origem é recusado');
select testes.encerrar();

select * from finish();
rollback;
