-- =============================================================================
-- supabase/tests/001_enums_config_familia.sql
--
-- Aceite do P02 (PROMPTS.md): "pgTAP confere RLS ligada em toda tabela e
-- colunas padrão em todas menos as exceções do PRD 5.2, e testa ig() com
-- três casos, um deles com a DPP no passado."
--
-- Escopo: só as tabelas que a migration 0002 cria (PRD 6.1 e 6.2). A
-- cobertura de "todas as tabelas do PRD" é o aceite do P04 (arquivo 003).
-- =============================================================================

begin;

select plan(10);

-- --- RLS ligada em toda tabela do P02 (PRD 6.10 regra 6) --------------------

select is_empty(
  $$
  select t.tabela
  from (values
    ('perfil'), ('usuario_papel'), ('regiao'), ('cidade'), ('municipio'), ('parametro'),
    ('familia'), ('pessoa'), ('pessoa_dados_contrato'), ('bebe'), ('medico')
  ) as t(tabela)
  join pg_class c on c.relname = t.tabela
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not c.relrowsecurity
  $$,
  'as onze tabelas do P02 (6.1 e 6.2) têm RLS ligada'
);

-- P02 ligou a RLS sem política (tudo negado até o P07). Depois do P07
-- (0007_permissoes.sql, ADR 0002) as políticas existem, mas só para
-- authenticated (anon não tem política nenhuma) e pessoa_dados_contrato
-- continua sem política (leitura só por api.dados_contrato). O detalhe da
-- matriz é conferido no teste 007.
select is_empty(
  $$
  select tablename || '.' || policyname from pg_policies
  where schemaname = 'public'
    and tablename in ('perfil','usuario_papel','regiao','cidade','municipio','parametro',
                       'familia','pessoa','pessoa_dados_contrato','bebe','medico')
    and (tablename = 'pessoa_dados_contrato' or roles <> array['authenticated']::name[])
  $$,
  'políticas das tabelas do P02 só para authenticated, e nenhuma em pessoa_dados_contrato (P07, ADR 0002)'
);

-- --- Colunas padrão em todas menos as exceções do PRD 5.2 -------------------
-- Exceções desta migration: parametro (chave em texto), perfil e
-- usuario_papel (ligadas ao Auth) e município (código do IBGE).

select is_empty(
  $$
  select tb.tabela, col.coluna
  from (values
    ('regiao'), ('cidade'), ('familia'), ('pessoa'), ('pessoa_dados_contrato'), ('bebe'), ('medico')
  ) as tb(tabela)
  cross join (values ('id'), ('criado_em'), ('atualizado_em'), ('criado_por')) as col(coluna)
  left join information_schema.columns ic
    on ic.table_schema = 'public' and ic.table_name = tb.tabela and ic.column_name = col.coluna
  where ic.column_name is null
  $$,
  'regiao, cidade, familia, pessoa, pessoa_dados_contrato, bebe e medico têm as quatro colunas padrão'
);

select has_pk('public', 'parametro', 'parametro: chave própria (texto), exceção do PRD 5.2');
select has_pk('public', 'perfil', 'perfil: chave própria (1:1 com auth.users), exceção do PRD 5.2');
select has_pk('public', 'municipio', 'municipio: chave própria (código do IBGE), exceção do PRD 5.2');
select col_is_pk('public', 'usuario_papel', array['usuario_id','papel'], 'usuario_papel: chave composta, exceção do PRD 5.2');

-- --- public.ig(dpp, data) (PRD 6.10 regra 7) --------------------------------
-- Três casos, um deles com a DPP no passado.

select results_eq(
  $$ select semanas, dias, texto from public.ig('2020-01-10'::date, '2020-01-10'::date) $$,
  $$ values (40, 0, '40s0d') $$,
  'ig(): DPP no passado (2020), calculada exatamente no dia da DPP = 40s0d'
);

select results_eq(
  $$ select semanas, dias, texto from public.ig('2026-12-01'::date, '2026-11-19'::date) $$,
  $$ values (38, 2, '38s2d') $$,
  'ig(): 12 dias antes da DPP = 38s2d (formato do PRD, CLAUDE.md "Formatação brasileira")'
);

select results_eq(
  $$ select semanas, dias, texto from public.ig('2027-01-01'::date, '2026-10-13'::date) $$,
  $$ values (28, 4, '28s4d') $$,
  'ig(): 80 dias antes da DPP = 28s4d'
);

select * from finish();

rollback;
