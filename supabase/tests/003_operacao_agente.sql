-- =============================================================================
-- supabase/tests/003_operacao_agente.sql
--
-- Aceite do P04 (PROMPTS.md): "supabase db reset limpo; pgTAP confirma que
-- todas as tabelas do PRD existem com RLS ligada."
--
-- Cobertura: as 53 tabelas de negócio do PRD 6.1 a 6.8 inteiro (não só as
-- que esta migration cria), porque este é o aceite final da trilha de
-- tabelas (P01 a P04) desta sessão.
-- =============================================================================

begin;

select plan(4);

-- Lista completa das tabelas do PRD 6.1 a 6.8 (49 em public, 2 em agente,
-- 2 em agente_n8n = 53). agente_n8n.documentos e agente_n8n.chat_memoria
-- entram aqui porque também são tabela; log_auditoria e fila_sincronizacao
-- entram porque existem desde esta migration, mesmo sem a imutabilidade
-- completa (que chega no P05).
create temp table prd_tabelas (schema_nome name, tabela_nome name) on commit drop;
insert into prd_tabelas (schema_nome, tabela_nome) values
  -- 6.1
  ('public','regiao'), ('public','cidade'), ('public','municipio'), ('public','parametro'),
  ('public','perfil'), ('public','usuario_papel'),
  -- 6.2
  ('public','familia'), ('public','pessoa'), ('public','pessoa_dados_contrato'),
  ('public','bebe'), ('public','medico'),
  -- 6.3
  ('public','pacote'), ('public','pacote_versao'), ('public','condicao_comercial'),
  ('public','oportunidade'), ('public','sessao_venda'), ('public','sessao_venda_gravacao'),
  ('public','contrato'), ('public','cobranca'), ('public','nota_fiscal'),
  -- 6.4
  ('public','conversa'), ('public','mensagem'), ('public','handoff'),
  ('public','tarefa'), ('public','evento_familia'),
  -- 6.5
  ('public','profissional'), ('public','documento_profissional'), ('public','bloqueio_agenda'),
  ('public','instrumento'), ('public','consulta_prenatal'), ('public','acompanhamento'),
  ('public','designacao'), ('public','visita'), ('public','registro_atendimento'),
  ('public','registro_adendo'), ('public','anexo_audio'), ('public','relatorio_medico'),
  -- 6.6
  ('public','regra_alerta'), ('public','alerta_clinico'), ('public','ocorrencia'), ('public','pos_venda'),
  -- 6.7
  ('public','automacao'), ('public','automacao_execucao'), ('public','mensagem_modelo'),
  ('public','regua_faixa'), ('public','termo_alerta'), ('public','notificacao'),
  ('public','log_auditoria'), ('public','fila_sincronizacao'),
  -- 6.8
  ('agente','base_conhecimento'), ('agente_n8n','documentos'), ('agente_n8n','chat_memoria'),
  ('agente','ingestao_execucao');

select is(
  (select count(*) from prd_tabelas)::integer, 53,
  'a lista de conferência tem as 53 tabelas do PRD 6.1 a 6.8 (49 em public, 2 em agente, 2 em agente_n8n)'
);

-- --- Nenhuma tabela do PRD está faltando -------------------------------------

select is_empty(
  $$
  select pt.schema_nome, pt.tabela_nome
  from prd_tabelas pt
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = pt.tabela_nome
      and n.nspname = pt.schema_nome
      and c.relkind = 'r'            -- tabela de verdade, não view, índice nem sequência
  )
  $$,
  'todas as 53 tabelas do PRD (6.1 a 6.8) existem no banco'
);

-- --- Todas com RLS ligada -----------------------------------------------------

select is_empty(
  $$
  select pt.schema_nome, pt.tabela_nome
  from prd_tabelas pt
  join pg_namespace n on n.nspname = pt.schema_nome
  join pg_class c on c.relname = pt.tabela_nome and c.relnamespace = n.oid and c.relkind = 'r'
  where not c.relrowsecurity
  $$,
  'todas as 53 tabelas do PRD têm RLS ligada'
);

-- --- Nenhuma tabela extra escapou da lista (garante que a lista de
--     conferência acima não ficou desatualizada) ----------------------------

select is_empty(
  $$
  select n.nspname, c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in ('public', 'agente', 'agente_n8n')
    and not exists (
      select 1 from prd_tabelas pt where pt.schema_nome = n.nspname and pt.tabela_nome = c.relname
    )
  $$,
  'nenhuma tabela de public/agente/agente_n8n ficou fora da lista de conferência do PRD'
);

select * from finish();

rollback;
