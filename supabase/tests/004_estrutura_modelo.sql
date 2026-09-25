-- =============================================================================
-- supabase/tests/004_estrutura_modelo.sql
--
-- Conferência cruzada da trilha de tabelas (P01 a P04), feita na verificação
-- independente do grupo. Complementa os aceites de 000 a 003 com o que eles
-- não cobriam:
--
--   1. colunas padrão (tipo, nulidade, default, chave primária e FK para
--      perfil) em TODA tabela de public que não está nas exceções do PRD 5.2
--      (o 001 só olhava as tabelas do P02, e só o nome da coluna);
--   2. gatilho de atualizado_em em toda tabela que tem a coluna, e que ele
--      funciona;
--   3. índice em toda chave estrangeira (P02 item 4, P03 item 3, P04 item 5);
--   4. coluna versao e gatilho de incremento da regra 13 do PRD 6.10;
--   5. append-only (PRD 6.10 regra 4) também para service_role, e
--      registro_atendimento/registro_adendo, que já nascem append-only no P04;
--   6. mensagem: UPDATE só em transcricao (PRD 5.2 [v4.2]);
--   7. checks do DDL do PRD com casos negativos;
--   8. view familia_elegivel_marketing (PRD 6.9 [v4.2]): colunas explícitas e
--      filtro do freio;
--   9. RLS ligada sem política nega tudo a anon e authenticated (até o P07);
--  10. fronteira de privilégio das funções (PRD 5.2, 6.10 regra 11, 11.10):
--      nenhuma função do projeto executável por PUBLIC, search_path vazio em
--      toda função do projeto, nenhum acesso de anon/authenticated às tabelas
--      do agente;
--  11. enums: os 49 do PRD 6.0, com as mudanças [v4.2];
--  12. ig(): DPP já passada na data pedida e entrada nula.
--
-- Só dado sintético, criado e desfeito dentro da transação do teste.
-- =============================================================================

begin;

select plan(58);


-- -----------------------------------------------------------------------------
-- Dados sintéticos do teste (como postgres). Os ids ficam em variáveis de
-- sessão "testes.*" (set_config com true = só nesta transação), porque as
-- asserções que trocam de papel não enxergariam uma tabela temporária do dono.
-- -----------------------------------------------------------------------------

do $$
declare
  v_usuario   uuid := '22222222-2222-2222-2222-222222222222';
  v_familia   uuid;
  v_pessoa    uuid;
  v_pacote    uuid;
  v_versao    uuid;
  v_contrato  uuid;
  v_acomp     uuid;
  v_prof      uuid;
  v_visita    uuid;
  v_registro  uuid;
  v_conversa  uuid;
  v_mensagem  uuid;
  v_evento    bigint;
begin
  insert into auth.users (id, email) values (v_usuario, 'teste.verificacao@exemplo.invalid');
  insert into perfil (id, nome, email) values (v_usuario, 'Perfil Teste Verificação', 'teste.verificacao@exemplo.invalid');

  insert into familia (nome_exibicao, dpp) values ('Família Teste Verificação', '2026-12-01') returning id into v_familia;
  insert into pessoa (familia_id, papel, nome, telefone_e164) values (v_familia, 'mae', 'Pessoa Teste', '+5511900000001')
    returning id into v_pessoa;

  insert into pacote (nome, dias) values ('Pacote Teste Verificação', 6) returning id into v_pacote;
  insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, vigencia_inicio, vigencia_fim)
    values (v_pacote, 100, 6, '2026-01-01', '2026-06-30') returning id into v_versao;

  insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao)
    values (v_familia, v_versao, 100, 'teste') returning id into v_contrato;
  insert into acompanhamento (contrato_id, familia_id, dias_contratados, horas_por_visita)
    values (v_contrato, v_familia, 6, 6) returning id into v_acomp;
  insert into profissional (nome, funcao) values ('Profissional Teste', 'enfermeira_obstetrica') returning id into v_prof;
  insert into visita (acompanhamento_id, profissional_id, dia_numero, data)
    values (v_acomp, v_prof, 1, '2026-12-10') returning id into v_visita;

  insert into registro_atendimento (visita_id, profissional_id, instrumento_versao, dados, resumo_descritivo, assinado_em, assinatura)
    values (v_visita, v_prof, 'v-teste', '{}', 'resumo sintético', now(), 'hash-sintetico') returning id into v_registro;
  insert into registro_adendo (registro_id, autor_id, motivo, conteudo)
    values (v_registro, v_usuario, 'motivo sintético', 'conteúdo sintético');

  insert into conversa (wa_jid, telefone_e164, familia_id) values ('5511900000001@s.whatsapp.net', '+5511900000001', v_familia)
    returning id into v_conversa;
  insert into mensagem (conversa_id, direcao, enviado_por, tipo, conteudo, wa_message_id)
    values (v_conversa, 'entrada', 'cliente', 'audio', 'conteúdo sintético', 'wamid-teste-1') returning id into v_mensagem;

  insert into evento_familia (familia_id, tipo, titulo) values (v_familia, 'lead_entrou', 'evento sintético')
    returning id into v_evento;

  perform set_config('testes.usuario',  v_usuario::text,  true);
  perform set_config('testes.familia',  v_familia::text,  true);
  perform set_config('testes.pacote',   v_pacote::text,   true);
  perform set_config('testes.acomp',    v_acomp::text,    true);
  perform set_config('testes.visita',   v_visita::text,   true);
  perform set_config('testes.registro', v_registro::text, true);
  perform set_config('testes.mensagem', v_mensagem::text, true);
  perform set_config('testes.evento',   v_evento::text,   true);
end $$;


-- =============================================================================
-- 1. Colunas padrão (PRD 5.2 e P02 item 2) em toda tabela de public fora das
--    exceções. Exceções do PRD 5.2: parametro, perfil, usuario_papel,
--    municipio, log_auditoria, evento_familia, registro_atendimento,
--    registro_adendo, fila_sincronizacao, regra_alerta, automacao e as
--    tabelas de agente/agente_n8n (outro schema). mensagem entra, mas sem
--    atualizado_em. mensagem_modelo também fica de fora: o PRD 5.2 não a
--    lista, mas o DDL do 6.7 a define com chave em texto e sem "-- padrão"
--    (divergência interna do PRD, vale o DDL, que é a especificação da
--    tabela; registrado no relatório da verificação).
-- =============================================================================

create temp table excecoes_padrao (tabela name) on commit drop;
insert into excecoes_padrao values
  ('parametro'), ('perfil'), ('usuario_papel'), ('municipio'), ('log_auditoria'), ('evento_familia'),
  ('registro_atendimento'), ('registro_adendo'), ('fila_sincronizacao'), ('regra_alerta'), ('automacao'),
  ('mensagem_modelo');

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in (select tabela from excecoes_padrao)),
  37,
  'public tem 37 tabelas com colunas padrão (49 do PRD menos as 12 exceções)'
);

select is_empty(
  $$
  with tabelas as (
    select c.oid, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in (select tabela from excecoes_padrao)
  ),
  esperado as (
    select t.oid, t.relname, e.coluna, e.tipo, e.nao_nulo, e.padrao
    from tabelas t
    cross join (values
      ('id',            'uuid',                     true,  'gen_random_uuid()'),
      ('criado_em',     'timestamp with time zone', true,  'now()'),
      ('atualizado_em', 'timestamp with time zone', true,  'now()'),
      ('criado_por',    'uuid',                     false, '')
    ) as e(coluna, tipo, nao_nulo, padrao)
    where not (t.relname = 'mensagem' and e.coluna = 'atualizado_em')
  )
  select es.relname, es.coluna
  from esperado es
  left join pg_attribute a on a.attrelid = es.oid and a.attname = es.coluna and not a.attisdropped
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attname is null
     or format_type(a.atttypid, a.atttypmod) <> es.tipo
     or a.attnotnull <> es.nao_nulo
     or coalesce(pg_get_expr(d.adbin, d.adrelid), '') <> es.padrao
  $$,
  'as 37 tabelas têm id uuid default gen_random_uuid(), criado_em e atualizado_em timestamptz not null default now() e criado_por uuid'
);

select is_empty(
  $$
  select c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname not in (select tabela from excecoes_padrao)
    and not exists (
      select 1 from pg_constraint k
      join pg_attribute a on a.attrelid = k.conrelid and a.attname = 'id'
      where k.conrelid = c.oid and k.contype = 'p' and k.conkey = array[a.attnum]
    )
  $$,
  'nas 37 tabelas a chave primária é id'
);

select is_empty(
  $$
  select c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname not in (select tabela from excecoes_padrao)
    and not exists (
      select 1 from pg_constraint k
      join pg_attribute a on a.attrelid = k.conrelid and a.attname = 'criado_por'
      where k.conrelid = c.oid and k.contype = 'f'
        and k.confrelid = 'public.perfil'::regclass and k.conkey = array[a.attnum]
    )
  $$,
  'nas 37 tabelas criado_por referencia perfil(id) (P02 item 2)'
);

select hasnt_column('public', 'mensagem', 'atualizado_em', 'mensagem não tem atualizado_em (exceção [v4.2] do PRD 5.2)');


-- =============================================================================
-- 2. Gatilho de atualizado_em (P02 item 3)
-- =============================================================================

select is_empty(
  $$
  select n.nspname, c.relname
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where a.attname = 'atualizado_em' and not a.attisdropped and c.relkind = 'r'
    and n.nspname in ('public', 'agente', 'agente_n8n')
    and not exists (
      select 1 from pg_trigger g
      where g.tgrelid = c.oid and not g.tgisinternal
        and g.tgfoid = 'privado.tocar_atualizado_em()'::regprocedure
    )
  $$,
  'toda tabela com atualizado_em tem o gatilho privado.tocar_atualizado_em'
);

insert into regiao (nome, praca, limite_familias_semana, atualizado_em)
  values ('Região Teste', 'Praça Teste', 1, '2000-01-01');
update regiao set nome = 'Região Teste 2' where nome = 'Região Teste';
select is(
  (select atualizado_em from regiao where nome = 'Região Teste 2'), now(),
  'UPDATE em regiao regrava atualizado_em com now(), mesmo sem citar a coluna'
);


-- =============================================================================
-- 3. Índice em toda chave estrangeira (P02 item 4)
--    As colunas da FK precisam ser as primeiras colunas de algum índice.
-- =============================================================================

select is_empty(
  $$
  select k.conrelid::regclass::text as tabela, k.conname
  from pg_constraint k
  join pg_namespace n on n.oid = k.connamespace
  where k.contype = 'f' and n.nspname in ('public', 'agente', 'agente_n8n')
    and not exists (
      select 1 from pg_index i
      where i.indrelid = k.conrelid
        and i.indnkeyatts >= cardinality(k.conkey)
        and (select array_agg(x order by x) from unnest((i.indkey::int2[])[0:cardinality(k.conkey) - 1]) x)
          = (select array_agg(x order by x) from unnest(k.conkey) x)
    )
  $$,
  'toda chave estrangeira de public, agente e agente_n8n tem índice que começa pelas colunas dela'
);


-- =============================================================================
-- 4. Coluna versao e gatilho de incremento (PRD 6.10 regra 13)
-- =============================================================================

select is_empty(
  $$
  select t.tabela
  from (values ('consulta_prenatal'), ('visita'), ('anexo_audio'), ('alerta_clinico')) as t(tabela)
  left join pg_attribute a on a.attrelid = ('public.' || t.tabela)::regclass and a.attname = 'versao'
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attname is null or a.atttypid <> 'integer'::regtype or not a.attnotnull
     or pg_get_expr(d.adbin, d.adrelid) <> '1'
     or not exists (
       select 1 from pg_trigger g
       where g.tgrelid = ('public.' || t.tabela)::regclass and not g.tgisinternal
         and g.tgfoid = 'privado.incrementar_versao()'::regprocedure
     )
  $$,
  'consulta_prenatal, visita, anexo_audio e alerta_clinico têm versao integer not null default 1 e o gatilho de incremento'
);

select is_empty(
  $$
  select c.relname from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  where a.attname = 'versao' and a.atttypid = 'integer'::regtype  -- instrumento.versao é texto ('v1-2026-09'), outra coisa
    and c.relkind = 'r' and n.nspname = 'public'
    and c.relname not in ('consulta_prenatal', 'visita', 'anexo_audio', 'alerta_clinico')
  $$,
  'só as quatro tabelas da regra 13 têm a coluna versao de sincronização (integer)'
);

update visita set hora_prevista = '09:00' where id = current_setting('testes.visita')::uuid;
select is((select versao from visita where id = current_setting('testes.visita')::uuid), 2,
  'visita: primeiro UPDATE leva versao de 1 para 2');

update visita set versao = 99, hora_prevista = '10:00' where id = current_setting('testes.visita')::uuid;
select is((select versao from visita where id = current_setting('testes.visita')::uuid), 3,
  'visita: versao enviada pelo cliente é ignorada, o gatilho sempre grava a anterior + 1');


-- =============================================================================
-- 5. Append-only (PRD 6.10 regra 4): evento_familia para os papéis da
--    aplicação, registro_atendimento e registro_adendo para todos.
-- =============================================================================

select testes.autenticar_service_role();
select throws_ok(
  format('update evento_familia set titulo = %L where id = %s', 'x', current_setting('testes.evento')),
  '42501', null, 'evento_familia: UPDATE como service_role é recusado (privilégio revogado)');
select throws_ok(
  format('delete from evento_familia where id = %s', current_setting('testes.evento')),
  '42501', null, 'evento_familia: DELETE como service_role é recusado (privilégio revogado)');
select throws_ok('truncate evento_familia', '42501', null,
  'evento_familia: TRUNCATE como service_role é recusado (privilégio revogado)');
select throws_ok(
  format('update registro_atendimento set resumo_descritivo = %L where id = %L', 'x', current_setting('testes.registro')),
  '42501', null, 'registro_atendimento: UPDATE como service_role é recusado');
select throws_ok('truncate registro_adendo', '42501', null,
  'registro_adendo: TRUNCATE como service_role é recusado');
select testes.encerrar();

select testes.autenticar_authenticated(current_setting('testes.usuario')::uuid, 'aal2');
select throws_ok(
  format('update evento_familia set titulo = %L where id = %s', 'x', current_setting('testes.evento')),
  '42501', null, 'evento_familia: UPDATE como authenticated em aal2 é recusado');
select testes.encerrar();

select throws_ok(
  format('update registro_atendimento set resumo_descritivo = %L where id = %L', 'x', current_setting('testes.registro')),
  '42501', null, 'registro_atendimento: UPDATE como postgres (dono) é recusado pelo gatilho');
select throws_ok(
  format('delete from registro_atendimento where id = %L', current_setting('testes.registro')),
  '42501', null, 'registro_atendimento: DELETE como postgres (dono) é recusado pelo gatilho');
select throws_ok('truncate registro_atendimento cascade', '42501', null,
  'registro_atendimento: TRUNCATE ... CASCADE como postgres é recusado pelo gatilho');
select throws_ok(
  format('update registro_adendo set conteudo = %L where registro_id = %L', 'x', current_setting('testes.registro')),
  '42501', null, 'registro_adendo: UPDATE como postgres (dono) é recusado pelo gatilho');
select throws_ok('truncate visita cascade', '42501', null,
  'truncate visita cascade também é recusado (o cascade alcança registro_atendimento e registro_adendo)');


-- =============================================================================
-- 6. mensagem: UPDATE só em transcricao (PRD 5.2 [v4.2], Apêndice A)
-- =============================================================================

select lives_ok(
  format('update mensagem set transcricao = %L where id = %L', 'transcrição sintética', current_setting('testes.mensagem')),
  'mensagem: UPDATE só da transcricao é aceito (caminho de agente.registrar_transcricao)');
select throws_ok(
  format('update mensagem set conteudo = %L where id = %L', 'alterado', current_setting('testes.mensagem')),
  '42501', null, 'mensagem: UPDATE de conteudo é recusado pelo gatilho, mesmo como postgres');

select testes.autenticar_service_role();
select throws_ok(
  format('update mensagem set transcricao = %L where id = %L', 'x', current_setting('testes.mensagem')),
  '42501', null, 'mensagem: UPDATE direto como service_role é recusado (só pela função do agente)');
select throws_ok(
  format('delete from mensagem where id = %L', current_setting('testes.mensagem')),
  '42501', null, 'mensagem: DELETE direto como service_role é recusado (só por eliminar_titular e retencao_diaria)');
select testes.encerrar();


-- =============================================================================
-- 7. Checks do DDL do PRD (casos negativos) e vigência de pacote_versao
-- =============================================================================

select throws_ok(
  format($s$ insert into bebe (familia_id, sexo) values (%L, 'x') $s$, current_setting('testes.familia')),
  '23514', null, 'bebe: sexo fora da lista é recusado');
select throws_ok(
  format($s$ insert into bebe (familia_id, tipo_parto) values (%L, 'forceps') $s$, current_setting('testes.familia')),
  '23514', null, 'bebe: tipo_parto fora da lista é recusado');
select throws_ok(
  format($s$ insert into oportunidade (familia_id, pipeline) values (%L, 3) $s$, current_setting('testes.familia')),
  '23514', null, 'oportunidade: pipeline diferente de 1 e 2 é recusado');
select throws_ok(
  format($s$ insert into oportunidade (familia_id, pipeline, para_quem) values (%L, 1, 'x') $s$, current_setting('testes.familia')),
  '23514', null, 'oportunidade: para_quem fora da lista é recusado');
select throws_ok(
  $s$ insert into condicao_comercial (nome, tipo, valor) values ('Teste', 'cashback', 1) $s$,
  '23514', null, 'condicao_comercial: tipo fora da lista é recusado');
select throws_ok(
  $s$ insert into mensagem_modelo (chave, destinatario, texto) values ('teste_x', 'fornecedor', 'x') $s$,
  '23514', null, 'mensagem_modelo: destinatario fora da lista é recusado');
select throws_ok(
  format($s$ insert into pos_venda (acompanhamento_id, nps) values (%L, 11) $s$, current_setting('testes.acomp')),
  '23514', null, 'pos_venda: nps acima de 10 é recusado');
select throws_ok(
  $s$ insert into agente.base_conhecimento (tipo, titulo, texto) values ('faq', 'Teste', repeat('a', 1501)) $s$,
  '23514', null, 'agente.base_conhecimento: texto acima de 1500 caracteres é recusado');
select throws_ok(
  $s$ insert into oportunidade (familia_id, pipeline) values ('00000000-0000-0000-0000-000000000000', 1) $s$,
  '23503', null, 'oportunidade: família inexistente é recusada (FK)');
select throws_ok(
  $s$ insert into familia (nome_exibicao, estado_sensivel) values ('Teste', 'luto') $s$,
  '22P02', null, 'familia: estado_sensivel fora do enum é recusado (todo estado é enum)');

select throws_ok(
  format($s$ insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
             values (%L, 200, 6, '2026-06-30') $s$, current_setting('testes.pacote')),
  '23P01', null, 'pacote_versao: nova versão começando no último dia da anterior é recusada (vigência inclusiva)');
select lives_ok(
  format($s$ insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
             values (%L, 200, 6, '2026-07-01') $s$, current_setting('testes.pacote')),
  'pacote_versao: nova versão começando no dia seguinte ao fim da anterior é aceita');


-- =============================================================================
-- 8. View familia_elegivel_marketing (PRD 6.9 [v4.2] e 13)
-- =============================================================================

select columns_are(
  'public', 'familia_elegivel_marketing',
  array['id','nome_exibicao','cidade_id','regiao_id','dpp','gemelar','primeira_gestacao','origem','codigo_origem',
        'utm','indicacao_medico_id','indicacao_familia_id','criado_em'],
  'familia_elegivel_marketing: só as colunas explícitas do PRD 6.9 (sem historico_sensivel, motivos, endereço e bairro)'
);

select ok(
  (select 'security_invoker=true' = any(c.reloptions) from pg_class c where c.oid = 'public.familia_elegivel_marketing'::regclass),
  'familia_elegivel_marketing é security_invoker (a RLS de familia vale para quem lê a view)'
);

insert into familia (nome_exibicao, estado_sensivel) values ('Família Teste Freio Atenção', 'atencao');
insert into familia (nome_exibicao, nao_contatar) values ('Família Teste Não Contatar', true);
insert into familia (nome_exibicao, mesclada_em_id) values ('Família Teste Mesclada', current_setting('testes.familia')::uuid);

-- criado_em >= transaction_timestamp() restringe às linhas desta transação
-- (now() é estável dentro da transação): sem isso, "like 'Família Teste%'"
-- também pegaria família sintética do seed.sql (P08), que usa o mesmo
-- prefixo de nome (CLAUDE.md, "Família Teste ..."), e o teste pegaria linha
-- a mais que não veio deste bloco.
select results_eq(
  $$ select nome_exibicao from familia_elegivel_marketing
     where nome_exibicao like 'Família Teste%' and criado_em >= transaction_timestamp() order by 1 $$,
  $$ values ('Família Teste Verificação'::text) $$,
  'familia_elegivel_marketing: família em atenção, com nao_contatar ou mesclada fica de fora'
);


-- =============================================================================
-- 9. RLS: sem política nega tudo
--
-- Até o P07 nenhuma tabela tinha política. Depois do P07 (0007_permissoes.sql,
-- ADR 0002) as políticas existem só para authenticated e só em public.
-- Desde o P21 (0013, ADR 0003) agente_n8n tem exatamente uma política por
-- tabela, "for all to n8n_agente", e agente continua sem política. Um
-- usuário sem papel continua sem ver nem gravar nada (abaixo).
-- =============================================================================

select is_empty(
  $$ select schemaname || '.' || tablename || '.' || policyname from pg_policies
     where schemaname = 'agente'
        or (schemaname = 'agente_n8n' and (roles <> array['n8n_agente']::name[] or cmd <> 'ALL'))
        or (schemaname = 'public' and roles <> array['authenticated']::name[]) $$,
  'políticas só para authenticated em public; agente sem política; agente_n8n só "for all to n8n_agente" (P21)'
);

select testes.autenticar_authenticated(current_setting('testes.usuario')::uuid, 'aal2');
select is((select count(*)::integer from familia), 0,
  'authenticated em aal2 não enxerga nenhuma família (RLS sem política)');
select throws_ok(
  $s$ insert into familia (nome_exibicao) values ('Família Teste RLS') $s$,
  '42501', null, 'authenticated não insere família (RLS sem política)');
select testes.encerrar();

-- P07: a view perdeu o grant de anon e authenticated (só api.marketing_*).
select testes.autenticar_anon();
select throws_ok(
  $s$ select count(*) from familia_elegivel_marketing $s$,
  '42501', null, 'anon não lê a view de marketing (P07: sem grant, só api.marketing_*)');
select testes.encerrar();


-- =============================================================================
-- 10. Fronteira de privilégio (PRD 5.2, 6.10 regra 11 e 11.10)
-- =============================================================================

select is_empty(
  $$
  select n.nspname || '.' || p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and exists (
      select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    )
  $$,
  'nenhuma função do projeto é executável pelo pseudo-papel PUBLIC (inclusive privado.sem_acento, criada antes do alter default privileges)'
);

select is_empty(
  $$
  select n.nspname || '.' || p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and not (p.oid = 'public.ig(date, date)'::regprocedure)
    and has_function_privilege('anon', p.oid, 'execute')
  $$,
  'anon não executa nenhuma função do projeto além, no máximo, de public.ig (PRD 11.10)'
);

select is_empty(
  $$
  select n.nspname || '.' || p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and not coalesce(p.proconfig, '{}') @> array['search_path=""']
  $$,
  'toda função do projeto fixa search_path vazio (PRD 6.10 regra 11)'
);

select is_empty(
  $$
  select n.nspname || '.' || p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef
    and n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
    and not coalesce(p.proconfig, '{}') @> array['search_path=""']
  $$,
  'nenhuma função security definer sem search_path vazio'
);

select is_empty(
  $$
  select r.rolname from pg_roles r
  where has_schema_privilege(r.oid, 'public', 'create')
    and not r.rolsuper and r.rolname <> 'pg_database_owner'
  $$,
  'nenhum papel além do dono (pg_database_owner) e de superusuário tem create em public'
);

select is_empty(
  $$
  select papel, n.nspname || '.' || c.relname
  from (values ('anon'), ('authenticated')) as r(papel)
  cross join pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('agente', 'agente_n8n') and c.relkind in ('r', 'v')
    and (has_table_privilege(r.papel, c.oid, 'select') or has_table_privilege(r.papel, c.oid, 'insert')
         or has_table_privilege(r.papel, c.oid, 'update') or has_table_privilege(r.papel, c.oid, 'delete'))
  $$,
  'anon e authenticated não têm privilégio em nenhuma tabela de agente e agente_n8n (D-14, PRD 11.10)'
);

select ok(
  not has_schema_privilege('anon', 'privado', 'usage') and not has_schema_privilege('anon', 'assistencial', 'usage')
  and not has_schema_privilege('anon', 'agente', 'usage') and not has_schema_privilege('anon', 'agente_n8n', 'usage'),
  'anon não tem usage em privado, assistencial, agente e agente_n8n'
);


-- =============================================================================
-- 11. Enums (PRD 6.0)
-- =============================================================================

select is(
  (select count(*)::integer from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'),
  49,
  'public tem os 49 enums do PRD 6.0'
);

select enum_has_labels('public', 'handoff_motivo',
  array['contratar','reuniao','condicao_comercial','cobertura_taxa','reembolso_fiscal','bebe_nasceu',
        'pos_venda_operacao','duvida_sem_resposta','saude','perda','reclamacao','pediu_humano',
        'parceiro_medico','midia_recebida','validacao_resposta','estado_sensivel_escreveu','outro',
        'audio_nao_transcrito'],
  'handoff_motivo tem os rótulos do PRD, com audio_nao_transcrito [v4.2] no fim');

select enum_has_labels('public', 'status_profissional',
  array['em_visita','em_atendimento','reservada','backup','oferta_pendente','folga','livre'],
  'status_profissional [v4.2] na ordem de precedência do PRD 6.0');


-- =============================================================================
-- 12. ig(): casos extras (PRD 6.10 regra 7)
-- =============================================================================

select results_eq(
  $$ select semanas, dias, texto from public.ig('2026-01-10'::date, '2026-01-20'::date) $$,
  $$ values (41, 3, '41s3d') $$,
  'ig(): data 10 dias depois da DPP = 41s3d');

select results_eq(
  $$ select semanas, dias, texto from public.ig(null, '2026-01-20'::date) $$,
  $$ values (null::integer, null::integer, null::text) $$,
  'ig(): sem DPP devolve nulo (nunca inventa idade gestacional)');


select * from finish();

rollback;
