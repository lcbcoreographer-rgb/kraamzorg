-- =============================================================================
-- supabase/tests/008_seed.sql
--
-- Aceite do P08 (PROMPTS.md v2): "supabase db reset popula tudo (ou
-- supabase/sem-docker/scripts/resetar.sh); pgTAP confere uma versão vigente
-- por pacote e que toda mensagem_chave de regua_faixa e termo_alerta existe;
-- seed:check verde." seed:check é node supabase/checar-seed.mjs, fora de
-- pgTAP (comando no relatório da sessão).
--
-- Este arquivo confere o CONTEÚDO do seed (supabase/seed.sql), já aplicado
-- pelo resetar.sh antes de qualquer teste rodar (pg_prove abre uma conexão
-- por arquivo, todas contra o mesmo banco já semeado). Roda como o dono
-- (postgres), que ignora RLS por ser dono das tabelas: não precisa simular
-- papel nem AAL para ler os dados sintéticos.
--
-- Seções:
--   1. Regiões, cidades e municípios (3.3)
--   2. Pacotes, versões e condições comerciais (3.2, 22.2)
--   3. Parâmetros (6.8, 22.4, e os exigidos pelas migrations 0009 a 0011)
--   4. mensagem_modelo (capítulo 23 e evoluções)
--   5. regua_faixa e termo_alerta
--   6. automacao (10.1) e regra_alerta (DOC 3)
--   7. Perfis de teste e profissionais fictícias
--   8. Famílias, pipelines, acompanhamento completo e alerta fechado (16.3)
--   9. Conversas por modo do agente
-- =============================================================================

begin;

select plan(79);


-- =============================================================================
-- 1. Regiões, cidades e municípios
-- =============================================================================

select is(
  (select count(*)::integer from regiao where nome in ('São Paulo', 'Londrina') and ativa),
  2, 'duas regiões ativas: São Paulo e Londrina');
select is((select count(*)::integer from regiao where nome = 'Futuro' and not ativa), 1,
  'uma região "Futuro" inativa (Campinas e Sorocaba, sem data)');

select is((select count(*)::integer from cidade), 14, 'catorze cidades semeadas (PRD 3.3)');
select is(
  (select taxa_deslocamento_centavos from cidade where nome = 'Alphaville'), 0,
  'Alphaville sem taxa');
select is((select taxa_deslocamento_centavos from cidade where nome = 'Granja Viana'), 35000,
  'Granja Viana R$ 350 (C-02)');
select is((select requer_confirmacao from cidade where nome = 'Granja Viana'), false,
  'Granja Viana sem confirmar (C-02)');
select is(
  (select count(*)::integer from cidade
     where nome in ('Santo André', 'São Bernardo do Campo', 'São Caetano do Sul')
       and taxa_deslocamento_centavos = 35000 and requer_confirmacao),
  3, 'ABC: as três cidades com R$ 350 e requer_confirmacao (C-01)');
select is((select taxa_deslocamento_centavos from cidade where nome = 'Apucarana'), 100000, 'Apucarana R$ 1.000');
select is((select taxa_deslocamento_centavos from cidade where nome = 'Arapongas'), 60000, 'Arapongas R$ 600');
select is(
  (select bool_and(not atendida) from cidade where nome in ('Campinas', 'Sorocaba')), true,
  'Campinas e Sorocaba não atendidas');
select is(
  (select bool_and(requer_confirmacao) from cidade where nome in ('Barueri', 'Santana de Parnaíba', 'Cotia')), true,
  'Barueri, Santana de Parnaíba e Cotia fora das localidades próprias ficam com requer_confirmacao');

select ok((select count(*)::integer from municipio) > 0, 'tabela municipio populada');
select is(
  (select count(*)::integer from municipio where regiao_intermediaria not in ('São Paulo', 'Londrina')), 0,
  'todo município semeado é da região intermediária de São Paulo ou de Londrina');


-- =============================================================================
-- 2. Pacotes, versões e condições comerciais
-- =============================================================================

select is((select count(*)::integer from pacote), 5, 'cinco pacotes reais (PRD 3.2)');
select is(
  (select count(*)::integer from pacote p
     where (select count(*) from pacote_versao pv where pv.pacote_id = p.id and pv.vigencia_fim is null) <> 1),
  0, 'todo pacote tem exatamente uma versão vigente (vigencia_fim nulo)');
select is(
  (select count(*)::integer from pacote p
     where (select count(*) from pacote_versao pv where pv.pacote_id = p.id and pv.vigencia_fim is not null) <> 1),
  0, 'todo pacote tem exatamente uma versão anterior encerrada');
select is(
  (select count(*)::integer from pacote_versao where destaque is not null), 0,
  'destaque nulo nos cinco pacotes até a confirmação visual do PDF (PRD 3.2)');
select is(
  (select valor_centavos from pacote_versao pv join pacote p on p.id = pv.pacote_id
     where p.nome = 'Essencial' and pv.vigencia_fim is null),
  420000, 'Essencial vigente: R$ 4.200,00');
select is(
  (select valor_centavos from pacote_versao pv join pacote p on p.id = pv.pacote_id
     where p.nome = 'Gemelar Continuado' and pv.vigencia_fim is null),
  1030000, 'Gemelar Continuado vigente: R$ 10.300,00');
select ok(
  (select bool_and(valor_centavos <> 420000 and valor_centavos <> 780000 and valor_centavos <> 810000
                    and valor_centavos <> 540000 and valor_centavos <> 1030000)
     from pacote_versao where vigencia_fim is not null),
  'as cinco versões anteriores têm valor claramente fictício, nunca igual ao preço real de 2026');

select is((select count(*)::integer from condicao_comercial), 2, 'duas condições comerciais (3x sem juros e Pix)');
select is(
  (select requer_aprovacao from condicao_comercial where nome = 'Pix à vista'), true,
  'Pix exige aprovação registrada (C-04)');


-- =============================================================================
-- 3. Parâmetros
-- =============================================================================

select is_empty(
  $$ select unnest(array['agente_modo','agente_whitelist','agente_pausa_handoff_horas','agente_pausa_humano_horas',
       'agente_debounce_segundos','agente_janela_envio','grupo_whatsapp_por_destino','plantao_telefones',
       'pdf_apresentacao','horarios_edilaine','pdf_reenvio_janela_horas','taxa_visivel_agente',
       'alerta_internacao_ativo','alerta_emocional_ativo','alerta_saude_sensivel_ativo','validador_listas',
       'score_pesos','score_cortes','deduplicacao','capacidade_alerta_pct','janela_dpp_dias','handoff_matriz',
       'expediente_comercial','retencao_audio_dias','prazos_relatorio','agente_followup_horas',
       'acesso_enfermeira_pos_encerramento_dias','retencao','freio_desfazer_segundos','comercial_resposta_no_app'])
     except select chave from parametro $$,
  'todos os parâmetros do PRD (6.8 e os quatro novos do v4.2) estão semeados');

select is((select (valor #>> '{}')::integer from parametro where chave = 'agente_followup_horas'), 48,
  'agente_followup_horas: padrão 48 (D-18)');
select ok((select (valor #>> '{}')::integer from parametro where chave = 'agente_followup_horas') >= 24,
  'agente_followup_horas: nunca abaixo do mínimo de 24');
select is((select (valor #>> '{}')::integer from parametro where chave = 'acesso_enfermeira_pos_encerramento_dias'), 7,
  'acesso_enfermeira_pos_encerramento_dias: padrão 7');
select is((select (valor #>> '{}')::integer from parametro where chave = 'freio_desfazer_segundos'), 10,
  'freio_desfazer_segundos: padrão 10 (O-07)');
select is((select (valor #>> '{}')::boolean from parametro where chave = 'comercial_resposta_no_app'), false,
  'comercial_resposta_no_app: padrão falso (C-19)');
select is(
  (select valor from parametro where chave = 'retencao'),
  '{"chat_memoria_dias":180,"conversa_nao_cliente_meses":24,"log_ip_meses":12}'::jsonb,
  'retencao: prazos do O-06');
select is(
  (select valor from parametro where chave = 'janela_dpp_dias'), '{"antes":21,"depois":14}'::jsonb,
  'janela_dpp_dias: -21 a +14 (10.2)');
select is((select (valor #>> '{}')::integer from parametro where chave = 'capacidade_alerta_pct'), 85,
  'capacidade_alerta_pct: 85% (3.4)');
select is(
  (select valor -> 'fit_operacional' ->> 'peso' from parametro where chave = 'score_pesos')::integer, 40,
  'score_pesos: eixo fit_operacional com peso 40 (formato exigido por privado.calcular_score, migration 0010)');
select lives_ok(
  $$ select privado.calcular_score(id) from familia limit 1 $$,
  'score_pesos no formato que privado.calcular_score aceita, sem lançar 22023');
select is((select valor from parametro where chave = 'score_cortes'), '{"quente":70,"morno":40}'::jsonb,
  'score_cortes: 70 e 40 (C-14)');
select ok((select valor from parametro where chave = 'deduplicacao') ?& array['limiar_nome', 'dpp_dias', 'nova_gestacao_dias'],
  'deduplicacao no formato exigido por privado.buscar_duplicatas (migration 0010)');


-- =============================================================================
-- 4. mensagem_modelo (capítulo 23 e evoluções)
-- =============================================================================

select ok((select count(*)::integer from mensagem_modelo) >= 80,
  'mensagem_modelo cobre o capítulo 23 inteiro e os textos padrão da evolução');
select is(
  (select count(*)::integer from mensagem_modelo where status = 'aprovado'), 3,
  'só alerta_saude, perda e fallback_confirmar vêm aprovados no prompt v4.0 (PRD 6.8)');
select is_empty(
  $$ select chave from mensagem_modelo where status = 'aprovado'
       except select unnest(array['alerta_saude','perda','fallback_confirmar']) $$,
  'os três aprovados são exatamente os do prompt v4.0');
select ok((select count(*)::integer from mensagem_modelo where chave like 'evo\_%') >= 25,
  'textos padrão da evolução com prefixo evo_ (docs/analise-evolucoes.md seção 3)');
select is_empty(
  $$ select distinct destinatario from mensagem_modelo where destinatario not in ('familia','equipe','medico','agente') $$,
  'destinatario sempre um dos quatro valores do PRD 6.7');


-- =============================================================================
-- 5. regua_faixa e termo_alerta
-- =============================================================================

select is((select count(*)::integer from regua_faixa), 5, 'cinco faixas da régua (PRD 10.3)');
select is_empty(
  $$ select mensagem_chave from regua_faixa except select chave from mensagem_modelo $$,
  'aceite do P08: toda mensagem_chave de regua_faixa existe em mensagem_modelo');
select is_empty(
  $$ select mensagem_chave from termo_alerta except select chave from mensagem_modelo $$,
  'aceite do P08: toda mensagem_chave de termo_alerta existe em mensagem_modelo');

select is((select count(*)::integer from termo_alerta where ativo), 11,
  'dez termos aprovados no onboarding mais "perdi um bebê" (v4.2, K-21), todos ativos');
select is((select count(*)::integer from termo_alerta where not ativo), 9,
  'nove sinônimos propostos, inativos até a Edilaine aprovar');
select is(
  (select array_agg(distinct acao order by acao) from termo_alerta where termo in ('perdi o bebê', 'perdi um bebê')),
  array['bloqueio_total']::acao_termo_alerta[],
  '"perdi o bebê" e "perdi um bebê" sobem o freio para bloqueio_total');
select is(
  (select mensagem_chave from termo_alerta where termo = 'uti'), 'alerta_internacao',
  'UTI aponta para o texto alerta_internacao (11.11 item 2a)');


-- =============================================================================
-- 6. automacao (10.1) e regra_alerta (DOC 3)
-- =============================================================================

select is((select count(*)::integer from automacao), 29, 'catálogo completo do PRD 10.1');
select ok((select count(*)::integer from automacao where ativa) >= 12,
  'automações de Fase 1 (comercial e réguas como tarefa humana) ativas');
select is((select count(*)::integer from automacao where id = 'retencao_diaria' and ativa), 1,
  'retencao_diaria ativa (proteção de LGPD, O-06, independente de fase)');
select is((select count(*)::integer from automacao where id in
    ('alerta_34s','alerta_clinico','nascimento','alta','pesquisa','sobrevenda') and not ativa), 6,
  'automações de Fase 2 e 3 (pré-natal, alertas clínicos, capacidade) inativas até o prompt correspondente');

select is((select count(*)::integer from regra_alerta), 38, 'DOC 3 inteiro: PU-01 a AM-06 (12+7+13+6)');
select is((select count(*)::integer from regra_alerta where condicao is not null), 7,
  'condição preenchida só nas sete regras que o Apêndice B credita como "Fonte: DOC 3"');
select is(
  (select count(*)::integer from regra_alerta where condicao is not null and not ativa), 0,
  'toda regra com condição do DOC 3 está ativa');
select is(
  (select count(*)::integer from regra_alerta where condicao is null and ativa), 0,
  'toda regra sem condição fica inativa até a Edilaine aprovar (fora do DOC 3 direto)');
select is((select count(*)::integer from instrumento where vigente), 4,
  'DOC 1 a DOC 4 com uma versão vigente cada (definição completa fica para o P34)');


-- =============================================================================
-- 7. Perfis de teste e profissionais fictícias
-- =============================================================================

select is(
  (select array_agg(papel::text order by papel::text) from usuario_papel up
     join perfil pf on pf.id = up.usuario_id where pf.email like '%.teste@kraamzorgbrasil.test'),
  array['comercial','coordenacao','diretoria','enfermeira','financeiro','marketing'],
  'um usuário de teste por papel (PROMPTS.md P07 item 8)');
select is((select count(*)::integer from profissional), 6, 'cinco profissionais fictícias mais a coordenação (PRD 3.4)');
select is((select count(*)::integer from profissional where ativa), 5,
  'cinco profissionais ativas (a sexta, em contratação, começa inativa)');
select is(
  (select profissional_id from perfil where email = 'enfermeira.teste@kraamzorgbrasil.test'),
  (select id from profissional where nome = 'Profissional Teste Sul 2'),
  'perfil.profissional_id do login de teste da enfermeira aponta para o cadastro dela');


-- =============================================================================
-- 8. Famílias, pipelines, acompanhamento completo e alerta fechado (16.3)
-- =============================================================================

select is((select count(*)::integer from familia where nome_exibicao like 'Família Teste%'), 12,
  'doze famílias sintéticas (PRD 16.3)');
select is((select count(*)::integer from familia where gemelar), 1, 'uma família gemelar');
select is((select count(*)::integer from familia where estado_sensivel = 'bloqueio_total'), 1,
  'uma família em bloqueio_total');
select is((select count(*)::integer from familia where estado_sensivel = 'atencao'), 1,
  'uma família em atenção');
select is(
  (select count(*)::integer from oportunidade o join familia f on f.id = o.familia_id
     where f.nome_exibicao like 'Família Teste%' and o.pipeline = 1),
  6, 'seis famílias no pipeline 1 (entrada e qualificação)');
select is(
  (select count(*)::integer from oportunidade o join familia f on f.id = o.familia_id
     where f.nome_exibicao like 'Família Teste%' and o.pipeline = 2),
  6, 'seis famílias no pipeline 2 (venda e pré-atendimento, incluindo as já em acompanhamento e pós-venda)');

select is(
  (select count(*)::integer from visita v join acompanhamento a on a.id = v.acompanhamento_id
     join familia f on f.id = a.familia_id where f.nome_exibicao = 'Família Teste Jade'),
  6, 'acompanhamento completo: seis visitas (PRD 16.3)');
select is(
  (select count(*)::integer from visita v join acompanhamento a on a.id = v.acompanhamento_id
     join familia f on f.id = a.familia_id
     where f.nome_exibicao = 'Família Teste Jade' and v.estado = 'concluida'),
  6, 'as seis visitas de Jade estão concluídas');
select is(
  (select count(*)::integer from registro_atendimento r join visita v on v.id = r.visita_id
     join acompanhamento a on a.id = v.acompanhamento_id join familia f on f.id = a.familia_id
     where f.nome_exibicao = 'Família Teste Jade'),
  6, 'seis registros de atendimento, um por visita');
select is(
  (select estado from acompanhamento a join familia f on f.id = a.familia_id where f.nome_exibicao = 'Família Teste Jade'),
  'encerrado'::estado_acompanhamento, 'acompanhamento de Jade encerrado');

select is(
  (select count(*)::integer from alerta_clinico al join familia f on f.id = al.familia_id
     where f.nome_exibicao = 'Família Teste Jade'),
  1, 'um alerta clínico para Jade');
select is(
  (select severidade from alerta_clinico al join familia f on f.id = al.familia_id where f.nome_exibicao = 'Família Teste Jade'),
  'imediato'::severidade, 'o alerta de Jade é imediato (PRD 9.3)');
select ok(
  (select fechado_em is not null and conduta_adotada is not null and sinal_identificado is not null
     from alerta_clinico al join familia f on f.id = al.familia_id where f.nome_exibicao = 'Família Teste Jade'),
  'o alerta está fechado, com sinal identificado e conduta adotada (16.3)');


-- =============================================================================
-- 9. Conversas por modo do agente (PRD 11.7)
-- =============================================================================

select is((select count(*)::integer from conversa where wa_jid like '%-teste@%'), 7,
  'sete conversas fictícias, uma por modo do agente que depende da conversa (o oitavo, teste/desligado, é o parametro.agente_modo global)');
select is(
  (select count(*)::integer from conversa where familia_id is not null
     and familia_id in (select id from familia where estado_sensivel = 'bloqueio_total')),
  1, 'a conversa da família em bloqueio_total representa o modo humano_nominal');
select is(
  (select count(*)::integer from conversa where agente_pausado_ate is not null), 1,
  'uma conversa representa o modo pausado');
select is(
  (select count(*)::integer from conversa where agente_encerrado_em is not null), 1,
  'uma conversa representa o modo humano_comercial');
select is(
  (select count(*)::integer from conversa where familia_id is null and classificacao = 'candidata'), 1,
  'uma conversa sem família representa o modo nao_lead');
select ok((select count(*)::integer from mensagem where wa_message_id is null
             and conversa_id in (select id from conversa where wa_jid like '%-teste@%')) >= 13,
  'ao menos duas mensagens por conversa fictícia');


select * from finish();

rollback;
