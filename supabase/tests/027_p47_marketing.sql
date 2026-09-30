-- =============================================================================
-- supabase/tests/027_p47_marketing.sql
--
-- Aceite do P47 (PROMPTS.md v2): "lead que chega com código cai com a origem
-- certa; relatório de receita por origem confere com os dados sintéticos."
--   1. Canais de captação: criar, editar, código imutável depois de usado,
--      papéis.
--   2. Leitura do código na primeira mensagem (agente.registrar_mensagem) e
--      origem na família: família nova, família que já existia pelo telefone,
--      código desconhecido, primeiro contato vale, só a primeira mensagem.
--   3. Páginas abertas (public.captacao_*): só service_role, UTM limpos,
--      texto pré-preenchido com o código, limite de taxa.
--   4. Relatório de receita, custo e leads por origem e canal contra dados
--      sintéticos com totais conhecidos, e o que cada papel vê.
--   5. Exportação só de familia_elegivel_marketing.
--
-- Só dado sintético, criado aqui e desfeito no rollback. Os dados de relatório
-- usam datas em 2040 e o período do relatório, para não misturar com o seed.
-- =============================================================================

begin;

select plan(70);

-- -----------------------------------------------------------------------------
-- 0. Preparação
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('a2700000-0000-4000-8000-000000000001', 'marketing.p47@exemplo.invalid'),
  ('a2700000-0000-4000-8000-000000000002', 'diretoria.p47@exemplo.invalid'),
  ('a2700000-0000-4000-8000-000000000003', 'financeiro.p47@exemplo.invalid'),
  ('a2700000-0000-4000-8000-000000000004', 'comercial.p47@exemplo.invalid'),
  ('a2700000-0000-4000-8000-000000000005', 'enfermeira.p47@exemplo.invalid');
insert into perfil (id, nome, email, ativo) values
  ('a2700000-0000-4000-8000-000000000001', 'Perfil Teste Marketing P47', 'marketing.p47@exemplo.invalid', true),
  ('a2700000-0000-4000-8000-000000000002', 'Perfil Teste Diretoria P47', 'diretoria.p47@exemplo.invalid', true),
  ('a2700000-0000-4000-8000-000000000003', 'Perfil Teste Financeiro P47', 'financeiro.p47@exemplo.invalid', true),
  ('a2700000-0000-4000-8000-000000000004', 'Perfil Teste Comercial P47', 'comercial.p47@exemplo.invalid', true),
  ('a2700000-0000-4000-8000-000000000005', 'Perfil Teste Enfermeira P47', 'enfermeira.p47@exemplo.invalid', true);
insert into usuario_papel (usuario_id, papel) values
  ('a2700000-0000-4000-8000-000000000001', 'marketing'),
  ('a2700000-0000-4000-8000-000000000002', 'diretoria'),
  ('a2700000-0000-4000-8000-000000000003', 'financeiro'),
  ('a2700000-0000-4000-8000-000000000004', 'comercial'),
  ('a2700000-0000-4000-8000-000000000005', 'enfermeira');

create temp table t_r (chave text primary key, j jsonb);
grant all on t_r to public;
create temp table t_canal (codigo text primary key, id uuid);
grant all on t_canal to public;

-- -----------------------------------------------------------------------------
-- 1. Canais de captação
-- -----------------------------------------------------------------------------

select is((select count(*)::integer from privado.canal_captacao where codigo in ('SITE', 'IGBIO', 'META', 'GOOGLE')), 4,
  'o seed traz os quatro canais de exemplo');

select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000001', 'aal1');
select is(pg_catalog.jsonb_array_length(api.marketing_canais() -> 'canais'), 4, 'marketing lista os canais (sem MFA)');
select is(api.marketing_canais() #>> '{whatsapp,prefixo}', 'KZ', 'a lista traz o prefixo do código de origem');
select ok((api.marketing_canais() #>> '{whatsapp,texto_modelo}') like '%{codigo}%', 'a lista traz o texto-modelo com {codigo}');

insert into t_r select 'canal_novo', api.marketing_canal_salvar(null, ' igtest ', 'Instagram, história de teste', 'instagram_organico');
select is((select j ->> 'codigo' from t_r where chave = 'canal_novo'), 'IGTEST', 'canal novo: o código vai para maiúsculas e sem espaço');
select throws_ok($s$ select api.marketing_canal_salvar(null, 'IGTEST', 'Outro', 'site') $s$, 'P0001', null,
  'canal com código repetido é recusado');
select throws_ok($s$ select api.marketing_canal_salvar(null, 'x', 'Curto', 'site') $s$, 'P0001', null, 'código curto demais é recusado');
select throws_ok($s$ select api.marketing_canal_salvar(null, 'ABC-DEF', 'Hífen', 'site') $s$, 'P0001', null, 'código com hífen é recusado');
select throws_ok($s$ select api.marketing_canal_salvar(null, 'SEMORI', 'Sem origem', 'desconhecida') $s$, 'P0001', null,
  'a origem desconhecida não é origem de canal');
select is((api.marketing_canal_salvar((select (j ->> 'id')::uuid from t_r where chave = 'canal_novo'), 'IGTEST', 'Instagram, nome novo', 'instagram_organico', false) ->> 'ativo')::boolean,
  false, 'o canal pode ser desativado e renomeado antes de uso');
select testes.encerrar();

select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000004', 'aal1');
select throws_ok($s$ select api.marketing_canais() $s$, '42501', null, 'comercial não abre os canais');
select throws_ok($s$ select api.marketing_relatorio() $s$, '42501', null, 'comercial não abre o relatório de marketing');
select testes.encerrar();
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000005', 'aal2');
select throws_ok($s$ select api.marketing_canais() $s$, '42501', null, 'enfermeira não abre os canais');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select api.marketing_canais() $s$, '42501', null, 'anônimo não executa as funções de marketing');
select testes.encerrar();

-- -----------------------------------------------------------------------------
-- 2. Código na primeira mensagem e origem na família
-- -----------------------------------------------------------------------------

select is((select codigo from privado.captacao_ler_codigo('Olá, quero saber mais (KZ-IGBIO-7F3K2A)')), 'IGBIO', 'lê o código do canal');
select is((select token from privado.captacao_ler_codigo('Olá, quero saber mais (KZ-IGBIO-7F3K2A)')), '7F3K2A', 'lê o código da visita');
select is((select codigo from privado.captacao_ler_codigo('kz-meta oi')), 'META', 'lê sem diferenciar maiúscula, sem visita');
select is((select token from privado.captacao_ler_codigo('kz-meta oi')), null, 'sem visita, o token é nulo');
select is((select codigo from privado.captacao_ler_codigo('XKZ-IGBIO oi')), null, 'prefixo colado em outra palavra não vale');
select is((select codigo from privado.captacao_ler_codigo('Oi, tudo bem?')), null, 'sem código, nada');

-- visita da página e mensagem com o código: origem certa na família nova
select testes.autenticar_service_role();
insert into t_r select 'visita', public.captacao_iniciar('igbio', '{"utm_source":"instagram","utm_campaign":"lancamento_p47","x":"1","utm_medium":"<script>"}', '203.0.113.7');
select testes.encerrar();
select is((select j ->> 'situacao' from t_r where chave = 'visita'), 'ok', 'a página abre a visita do canal ativo');
select matches((select j ->> 'codigo' from t_r where chave = 'visita'), '^KZ-IGBIO-[A-Z0-9]{6}$', 'o código tem prefixo, canal e visita');
select ok((select j ->> 'texto' from t_r where chave = 'visita') like '%' || (select j ->> 'codigo' from t_r where chave = 'visita') || '%',
  'o texto pré-preenchido leva o código');
select is((select utm from privado.captacao_visita where token = right((select j ->> 'codigo' from t_r where chave = 'visita'), 6)),
  '{"utm_source":"instagram","utm_campaign":"lancamento_p47"}'::jsonb,
  'os UTM ficam só nas cinco chaves permitidas e sem caracteres estranhos');

insert into t_r select 'msg1', agente.registrar_mensagem('5511900047001@s.whatsapp.net', 'entrada', 'cliente',
  (select j ->> 'texto' from t_r where chave = 'visita'), 'texto', 'P47-MSG-1', 'Lead Teste P47', '5511900047001', null, null);
select is((select j ->> 'ok' from t_r where chave = 'msg1'), 'true', 'a primeira mensagem é registrada');
select is((select codigo from privado.conversa_origem where conversa_id = (select (j ->> 'conversa_id')::uuid from t_r where chave = 'msg1')),
  'IGBIO', 'a conversa guarda o código do canal');
select isnt((select usada_em from privado.captacao_visita where token = right((select j ->> 'codigo' from t_r where chave = 'visita'), 6)),
  null, 'a visita fica marcada como usada');
insert into t_r select 'lead1', agente.atualizar_lead((select (j ->> 'conversa_id')::uuid from t_r where chave = 'msg1'), '{"bairro":"Vila Madalena"}');
select is((select origem::text from familia where id = (select (j ->> 'familia_id')::uuid from t_r where chave = 'lead1')),
  'instagram_organico', 'lead que chega com código cai com a origem certa');
select is((select codigo_origem from familia where id = (select (j ->> 'familia_id')::uuid from t_r where chave = 'lead1')),
  'IGBIO', 'a família guarda o código do canal');
select is((select utm ->> 'utm_campaign' from familia where id = (select (j ->> 'familia_id')::uuid from t_r where chave = 'lead1')),
  'lancamento_p47', 'e os UTM da visita');
select ok(exists (select 1 from evento_familia where familia_id = (select (j ->> 'familia_id')::uuid from t_r where chave = 'lead1') and tipo = 'origem'),
  'a linha do tempo registra a origem');

-- só a primeira mensagem vale: outro código depois não muda nada
select agente.registrar_mensagem('5511900047001@s.whatsapp.net', 'entrada', 'cliente', 'Oi de novo (KZ-META)', 'texto', 'P47-MSG-2', 'Lead Teste P47', '5511900047001', null, null);
select is((select codigo_origem from familia where id = (select (j ->> 'familia_id')::uuid from t_r where chave = 'lead1')),
  'IGBIO', 'só a primeira mensagem vale: o código da segunda é ignorado');

-- família que já existia pelo telefone: a origem entra na hora, se ainda for desconhecida
insert into familia (id, nome_exibicao) values ('c2700000-0000-4000-8000-000000000001', 'Família Teste Existente P47');
insert into pessoa (familia_id, papel, nome, telefone_e164, contato_principal)
  values ('c2700000-0000-4000-8000-000000000001', 'mae', 'Mãe Existente P47', '+5511900047002', true);
select agente.registrar_mensagem('5511900047002@s.whatsapp.net', 'entrada', 'cliente', 'Oi (KZ-META)', 'texto', 'P47-MSG-3', 'Existente', '5511900047002', null, null);
select is((select origem::text from familia where id = 'c2700000-0000-4000-8000-000000000001'), 'meta_ads',
  'família que já existia pelo telefone recebe a origem na primeira mensagem');

-- primeiro contato vale: família com código já gravado não muda
insert into familia (id, nome_exibicao, origem, codigo_origem) values
  ('c2700000-0000-4000-8000-000000000002', 'Família Teste Antiga P47', 'google', 'GOOGLE');
insert into pessoa (familia_id, papel, nome, telefone_e164, contato_principal)
  values ('c2700000-0000-4000-8000-000000000002', 'mae', 'Mãe Antiga P47', '+5511900047003', true);
select agente.registrar_mensagem('5511900047003@s.whatsapp.net', 'entrada', 'cliente', 'Oi (KZ-META)', 'texto', 'P47-MSG-4', 'Antiga', '5511900047003', null, null);
select is((select origem::text from familia where id = 'c2700000-0000-4000-8000-000000000002'), 'google',
  'primeiro contato vale: a origem já gravada não muda');

-- código desconhecido e mensagem sem código: nada
select agente.registrar_mensagem('5511900047004@s.whatsapp.net', 'entrada', 'cliente', 'Oi (KZ-NAOEXISTE)', 'texto', 'P47-MSG-5', 'Sem canal', '5511900047004', null, null);
select is((select count(*)::integer from privado.conversa_origem o join conversa c on c.id = o.conversa_id where c.telefone_e164 = '+5511900047004'), 0,
  'código de canal desconhecido é ignorado');
select is((select (r ->> 'ok')::boolean from (select agente.registrar_mensagem('5511900047005@s.whatsapp.net', 'entrada', 'cliente', 'Oi, tudo bem?', 'texto', 'P47-MSG-6', 'Sem código', '5511900047005', null, null) as r) x),
  true, 'mensagem sem código segue normal');

-- -----------------------------------------------------------------------------
-- 3. Páginas abertas
-- -----------------------------------------------------------------------------

select testes.autenticar_service_role();
select is(public.captacao_pagina('igbio') ->> 'situacao', 'ok', 'a página do canal ativo abre');
select is(public.captacao_pagina('naoexiste') ->> 'situacao', 'indisponivel', 'canal que não existe: indisponível');
select is(public.captacao_pagina('igtest') ->> 'situacao', 'indisponivel', 'canal desativado: indisponível');
select ok(public.captacao_pagina('igbio') #>> '{textos,abertura}' is not null, 'a página traz os textos de mensagem_modelo');
select ok(public.captacao_pagina('igbio')::text !~* 'instagram|Instagram|custo|origem', 'a página não devolve nome, origem nem custo do canal');
select testes.encerrar();

select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000002', 'aal2');
select throws_ok($s$ select public.captacao_iniciar('igbio', '{}', 'x') $s$, '42501', null, 'usuário logado não chama a página aberta direto');
select testes.encerrar();
select testes.autenticar_anon();
select throws_ok($s$ select public.captacao_pagina('igbio') $s$, '42501', null, 'anônimo não chama a página aberta direto');
select testes.encerrar();

update parametro set valor = valor || '{"tentativas_max": 2, "janela_minutos": 10}' where chave = 'captacao';
select testes.autenticar_service_role();
select is(public.captacao_iniciar('igbio', '{}', '198.51.100.1') ->> 'situacao', 'ok', 'limite: primeira chamada passa');
select is(public.captacao_iniciar('igbio', '{}', '198.51.100.1') ->> 'situacao', 'ok', 'limite: segunda passa');
select is(public.captacao_iniciar('igbio', '{}', '198.51.100.1') ->> 'situacao', 'limite', 'limite: a terceira da mesma origem é recusada');
select is(public.captacao_iniciar('igbio', '{}', '198.51.100.2') ->> 'situacao', 'ok', 'limite: outra origem passa');
select testes.encerrar();
select ok(not exists (select 1 from privado.limite_publico where chave_hmac like '%198.51.100%'), 'a origem só fica em HMAC, nunca o IP');

-- -----------------------------------------------------------------------------
-- 4. Receita, custo e leads por origem e canal (2040, dados conhecidos)
--
--   A (meta, canal META, pago 3000 + 1000)        -> lead, ganho, receita 4000
--   B (meta, canal META, pago 2000)               -> lead, ganho, receita 2000
--   C (google, canal GOOGLE, pago 5000)           -> lead, ganho, receita 5000
--   D (site, canal SITE, sem pagamento)           -> lead, qualificada
--   E (indicacao_medica, sem canal, pago 7000)    -> lead, ganho, receita 7000
--   F (meta, canal META, bloqueio_total, pago 900)-> só diretoria e financeiro contam
--   custos de 2040-03: META 1500, GOOGLE 800; de 2040-04: META 500
-- -----------------------------------------------------------------------------

insert into pacote (id, nome, dias) values ('b2700000-0000-4000-8000-000000000001', 'Pacote Teste P47', 3);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b2700000-0000-4000-8000-000000000002', 'b2700000-0000-4000-8000-000000000001', 100, 6, '2020-01-01');

insert into familia (id, nome_exibicao, origem, codigo_origem, criado_em, estado_sensivel) values
  ('c2700000-0000-4000-8000-0000000000a1', 'Família Teste A P47', 'meta_ads', 'META', '2040-03-10 12:00-03', 'normal'),
  ('c2700000-0000-4000-8000-0000000000a2', 'Família Teste B P47', 'meta_ads', 'META', '2040-03-11 12:00-03', 'normal'),
  ('c2700000-0000-4000-8000-0000000000a3', 'Família Teste C P47', 'google', 'GOOGLE', '2040-03-12 12:00-03', 'normal'),
  ('c2700000-0000-4000-8000-0000000000a4', 'Família Teste D P47', 'site', 'SITE', '2040-03-13 12:00-03', 'normal'),
  ('c2700000-0000-4000-8000-0000000000a5', 'Família Teste E P47', 'indicacao_medica', null, '2040-03-14 12:00-03', 'normal'),
  ('c2700000-0000-4000-8000-0000000000a6', 'Família Teste F P47', 'meta_ads', 'META', '2040-03-15 12:00-03', 'bloqueio_total');

insert into oportunidade (id, familia_id, pipeline, estagio_p1, estagio_p2) values
  ('d2700000-0000-4000-8000-0000000000a1', 'c2700000-0000-4000-8000-0000000000a1', 2, null, 'pagamento_confirmado'),
  ('d2700000-0000-4000-8000-0000000000a2', 'c2700000-0000-4000-8000-0000000000a2', 2, null, 'pagamento_confirmado'),
  ('d2700000-0000-4000-8000-0000000000a3', 'c2700000-0000-4000-8000-0000000000a3', 2, null, 'pagamento_confirmado'),
  ('d2700000-0000-4000-8000-0000000000a4', 'c2700000-0000-4000-8000-0000000000a4', 1, 'qualificado', null),
  ('d2700000-0000-4000-8000-0000000000a5', 'c2700000-0000-4000-8000-0000000000a5', 2, null, 'pagamento_confirmado'),
  ('d2700000-0000-4000-8000-0000000000a6', 'c2700000-0000-4000-8000-0000000000a6', 2, null, 'pagamento_confirmado');

insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao, status)
select ('e2700000-0000-4000-8000-0000000000' || right(f.id::text, 2))::uuid, f.id, 'b2700000-0000-4000-8000-000000000002', 100, 'teste', 'assinado'
from familia f where f.id::text like 'c2700000-0000-4000-8000-0000000000a%' and f.id::text not like '%a4';

insert into cobranca (contrato_id, parcela, valor_centavos, vencimento, external_id, status, valor_pago_centavos, pago_em) values
  ('e2700000-0000-4000-8000-0000000000a1', 1, 3000, '2040-03-20', 'p47-a1', 'paga', 3000, '2040-03-20 10:00-03'),
  ('e2700000-0000-4000-8000-0000000000a1', 2, 1000, '2040-04-20', 'p47-a2', 'paga', 1000, '2040-04-20 10:00-03'),
  ('e2700000-0000-4000-8000-0000000000a2', 1, 2000, '2040-03-21', 'p47-b1', 'paga', 2000, '2040-03-21 10:00-03'),
  ('e2700000-0000-4000-8000-0000000000a3', 1, 5000, '2040-03-22', 'p47-c1', 'paga', 5000, '2040-03-22 10:00-03'),
  ('e2700000-0000-4000-8000-0000000000a5', 1, 7000, '2040-03-23', 'p47-e1', 'paga', 7000, '2040-03-23 10:00-03'),
  ('e2700000-0000-4000-8000-0000000000a6', 1, 900, '2040-03-24', 'p47-f1', 'paga', 900, '2040-03-24 10:00-03'),
  ('e2700000-0000-4000-8000-0000000000a3', 2, 400, '2040-05-01', 'p47-c2', 'aberta', null, null);

insert into t_canal select codigo, id from privado.canal_captacao;
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000003', 'aal2');
select api.marketing_custo_salvar(id, '2040-03-17', 1500) from t_canal where codigo = 'META';
select api.marketing_custo_salvar(id, '2040-03-01', 800) from t_canal where codigo = 'GOOGLE';
select api.marketing_custo_salvar(id, '2040-04-30', 500) from t_canal where codigo = 'META';
select throws_ok($s$ select api.marketing_custo_salvar((select id from t_canal where codigo = 'META'), '2040-03-05', -1) $s$, 'P0001', null,
  'custo negativo é recusado');
select testes.encerrar();
select is((select valor_centavos from privado.custo_canal cc join privado.canal_captacao k on k.id = cc.canal_id where k.codigo = 'META' and cc.mes = '2040-03-01'), 1500,
  'o custo do mês fica no primeiro dia do mês');
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000003', 'aal2');
select api.marketing_custo_salvar((select id from t_canal where codigo = 'META'), '2040-03-05', 1600);
select testes.encerrar();
select is((select valor_centavos from privado.custo_canal cc join privado.canal_captacao k on k.id = cc.canal_id where k.codigo = 'META' and cc.mes = '2040-03-01'), 1600,
  'salvar de novo o mesmo mês troca o valor');
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000003', 'aal2');
select api.marketing_custo_salvar((select id from t_canal where codigo = 'META'), '2040-03-05', 1500);
select testes.encerrar();

select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000001', 'aal1');
select throws_ok($s$ select api.marketing_custo_salvar((select id from t_canal where codigo = 'META'), '2040-03-05', 1) $s$, '42501', null,
  'marketing não lança custo (vem do financeiro)');
select testes.encerrar();

-- diretoria: tudo, inclusive a família em bloqueio_total
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000002', 'aal2');
insert into t_r select 'rel_dir', api.marketing_relatorio('2040-03-01', '2040-04-30');
select testes.encerrar();
select is((select j #>> '{total,leads}' from t_r where chave = 'rel_dir'), '6', 'diretoria: 6 leads no período');
select is((select j #>> '{total,receita_centavos}' from t_r where chave = 'rel_dir'), '18900', 'diretoria: a receita do período é a soma dos pagamentos confirmados');
select is((select j #>> '{total,custo_centavos}' from t_r where chave = 'rel_dir'), '2800', 'diretoria: o custo do período é a soma dos meses');
select is((select x ->> 'receita_centavos' from t_r, jsonb_array_elements(j -> 'por_origem') x where chave = 'rel_dir' and x ->> 'origem' = 'meta_ads'), '6900',
  'receita por origem: meta 3000 + 1000 + 2000 + 900');
select is((select x ->> 'receita_centavos' from t_r, jsonb_array_elements(j -> 'por_origem') x where chave = 'rel_dir' and x ->> 'origem' = 'indicacao_medica'), '7000',
  'a indicação médica aparece no relatório por origem');
select is((select x ->> 'leads' from t_r, jsonb_array_elements(j -> 'por_origem') x where chave = 'rel_dir' and x ->> 'origem' = 'meta_ads'), '3', 'meta_ads: 3 leads');
select is((select x ->> 'custo_centavos' from t_r, jsonb_array_elements(j -> 'por_canal') x where chave = 'rel_dir' and x ->> 'codigo' = 'META'), '2000', 'custo por canal: META 1500 + 500');
select is((select x ->> 'contratos_pagos' from t_r, jsonb_array_elements(j -> 'por_canal') x where chave = 'rel_dir' and x ->> 'codigo' = 'META'), '3', 'contratos pagos por canal: META 3');

-- recorte por período: só abril
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000003', 'aal2');
select is((api.marketing_relatorio('2040-04-01', '2040-04-30') #>> '{total,receita_centavos}'), '1000', 'o período limita a receita aos pagamentos daquelas datas');
select testes.encerrar();

-- marketing: contagens só de família elegível, sem valores
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000001', 'aal1');
insert into t_r select 'rel_mkt', api.marketing_relatorio('2040-03-01', '2040-04-30');
select testes.encerrar();
select is((select j #>> '{total,leads}' from t_r where chave = 'rel_mkt'), '5', 'marketing: a família em bloqueio_total fica de fora');
select is((select j ->> 'so_elegiveis' from t_r where chave = 'rel_mkt'), 'true', 'marketing: o relatório avisa que só conta família elegível');
select is((select j #>> '{total,receita_centavos}' from t_r where chave = 'rel_mkt'), null, 'marketing: sem valores por padrão (matriz do PRD 13)');
update parametro set valor = '{"ve_receita": true}' where chave = 'marketing';
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000001', 'aal1');
select is((api.marketing_relatorio('2040-03-01', '2040-04-30') #>> '{total,receita_centavos}'), '18000',
  'marketing com ve_receita ligado vê a receita, ainda sem a família em bloqueio_total');
select testes.encerrar();
update parametro set valor = '{"ve_receita": false}' where chave = 'marketing';

-- -----------------------------------------------------------------------------
-- 5. Exportação só de família elegível
-- -----------------------------------------------------------------------------

update familia set nao_contatar = true where id = 'c2700000-0000-4000-8000-0000000000a4';
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000001', 'aal1');
insert into t_r select 'exp', api.marketing_exportar('2040-03-01', '2040-04-30');
select testes.encerrar();
select is(pg_catalog.jsonb_array_length((select j -> 'linhas' from t_r where chave = 'exp')), 4,
  'exportação: 6 famílias, menos a de bloqueio_total e a que pediu para não ser contatada');
select ok(not exists (select 1 from t_r, jsonb_array_elements(j -> 'linhas') x where chave = 'exp' and x ->> 'nome_exibicao' in ('Família Teste F P47', 'Família Teste D P47')),
  'exportação: as duas não aparecem');
select ok(not exists (select 1 from t_r, jsonb_array_elements(j -> 'linhas') x, jsonb_object_keys(x) k
                      where chave = 'exp' and k in ('endereco_atendimento', 'bairro', 'historico_sensivel', 'estado_sensivel_motivo', 'nao_contatar_motivo')),
  'exportação: nunca endereço, bairro nem histórico sensível');
select ok(exists (select 1 from log_auditoria where acao = 'exportacao' and entidade = 'familia_elegivel_marketing' and (valor_depois ->> 'linhas')::integer = 4),
  'a exportação fica no log, com a contagem e sem o conteúdo');
select testes.autenticar_authenticated('a2700000-0000-4000-8000-000000000004', 'aal1');
select throws_ok($s$ select api.marketing_exportar() $s$, '42501', null, 'comercial não exporta');
select testes.encerrar();

select * from finish();
rollback;
