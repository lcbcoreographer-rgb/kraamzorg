-- =============================================================================
-- supabase/tests/002_comercial_conversa.sql
--
-- Aceite do P03 (PROMPTS.md): "pgTAP recusa duas versões vigentes do mesmo
-- pacote na mesma data, duas oportunidades abertas para a mesma família,
-- qualquer update em evento_familia e [v4.2] truncate em evento_familia
-- (inclusive truncate familia cascade, rodando como o papel postgres)."
-- =============================================================================

begin;

select plan(10);

-- --- RLS ligada em toda tabela do P03 (PRD 6.10 regra 6) --------------------

select is_empty(
  $$
  select t.tabela
  from (values
    ('pacote'), ('pacote_versao'), ('condicao_comercial'), ('oportunidade'),
    ('sessao_venda'), ('sessao_venda_gravacao'), ('contrato'), ('cobranca'), ('nota_fiscal'),
    ('conversa'), ('mensagem'), ('handoff'), ('tarefa'), ('evento_familia')
  ) as t(tabela)
  join pg_class c on c.relname = t.tabela
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not c.relrowsecurity
  $$,
  'as quatorze tabelas do P03 (6.3 e 6.4) têm RLS ligada'
);

-- --- pacote_versao: exclusão de vigência sobreposta -------------------------

do $$
declare
  id_pacote uuid;
begin
  insert into pacote (nome, dias) values ('Pacote de teste P03', 6) returning id into id_pacote;
  insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, vigencia_inicio, vigencia_fim)
    values (id_pacote, 500000, 6, '2026-01-01', '2026-12-31');
  perform set_config('testes.pacote_id', id_pacote::text, true);
end $$;

select throws_ok(
  format(
    $sql$ insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, vigencia_inicio, vigencia_fim)
          values ('%s'::uuid, 600000, 6, '2026-06-01', '2026-08-31') $sql$,
    current_setting('testes.pacote_id')
  ),
  '23P01',
  null,
  'pacote_versao: duas vigências sobrepostas do mesmo pacote são recusadas (exclusão gist)'
);

select lives_ok(
  format(
    $sql$ insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, vigencia_inicio, vigencia_fim)
          values ('%s'::uuid, 600000, 6, '2027-01-01', null) $sql$,
    current_setting('testes.pacote_id')
  ),
  'pacote_versao: uma vigência que NÃO se sobrepõe (aberta, a partir de 2027) é aceita normalmente'
);

-- --- oportunidade: no máximo uma aberta por família --------------------------

do $$
declare
  id_familia uuid;
begin
  insert into familia (nome_exibicao) values ('Família teste P03 - oportunidade') returning id into id_familia;
  insert into oportunidade (familia_id, pipeline, estagio_p1) values (id_familia, 1, 'novo');
  perform set_config('testes.familia_id', id_familia::text, true);
end $$;

select throws_ok(
  format(
    $sql$ insert into oportunidade (familia_id, pipeline, estagio_p1) values ('%s'::uuid, 1, 'qualificado') $sql$,
    current_setting('testes.familia_id')
  ),
  '23505',
  null,
  'oportunidade: uma segunda oportunidade aberta para a mesma família é recusada (índice único parcial)'
);

select lives_ok(
  format(
    $sql$ insert into oportunidade (familia_id, pipeline, estagio_p1, estagio_p2)
          values ('%s'::uuid, 1, null, 'perdido') $sql$,
    current_setting('testes.familia_id')
  ),
  'oportunidade: uma segunda linha para a mesma família é aceita quando fechada (perdido, fora do índice parcial)'
);

-- --- evento_familia: append-only ---------------------------------------------

do $$
declare
  id_familia uuid;
  id_evento bigint;
begin
  insert into familia (nome_exibicao) values ('Família teste P03 - evento') returning id into id_familia;
  insert into evento_familia (familia_id, tipo, titulo) values (id_familia, 'lead_entrou', 'teste P03')
    returning id into id_evento;
  perform set_config('testes.evento_id', id_evento::text, true);
  perform set_config('testes.familia_evento_id', id_familia::text, true);
end $$;

select throws_ok(
  format('update evento_familia set titulo = %L where id = %s', 'alterado', current_setting('testes.evento_id')),
  '42501',
  'tabela evento_familia é append-only: UPDATE direto não é permitido (PRD 6.10 regra 4)',
  'evento_familia: UPDATE direto é recusado (rodando como postgres, dono da tabela)'
);

select throws_ok(
  format('delete from evento_familia where id = %s', current_setting('testes.evento_id')),
  '42501',
  null,
  'evento_familia: DELETE direto é recusado (rodando como postgres, dono da tabela)'
);

-- [v4.2] TRUNCATE recusado, inclusive "truncate familia cascade" (que tenta
-- truncar evento_familia por causa da FK): o gatilho recusa e desfaz a
-- operação inteira, então nem familia é truncada. throws_ok isola cada
-- tentativa num savepoint interno (do jeito que o pgTAP sempre testa erro),
-- então a transação externa do arquivo continua viva depois de cada uma.
select throws_ok(
  'truncate evento_familia',
  '42501',
  'tabela evento_familia é append-only: TRUNCATE não é permitido (PRD 6.10 regra 4)',
  'evento_familia: TRUNCATE direto é recusado (rodando como postgres, dono da tabela)'
);

select throws_ok(
  'truncate familia cascade',
  '42501',
  null,
  'evento_familia: truncate familia cascade também é recusado (o cascade tenta truncar evento_familia)'
);

select ok(
  exists(select 1 from familia where id::text = current_setting('testes.familia_evento_id')),
  'depois do truncate familia cascade recusado, a família de teste continua existindo (nada foi truncado)'
);

select * from finish();

rollback;
