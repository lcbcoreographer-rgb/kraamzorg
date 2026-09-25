-- =============================================================================
-- supabase/tests/045_instrumentos_v1.sql
--
-- P34 (PROMPTS.md v2) · PRD 6.5 (instrumento) e 9.1 a 9.4
--
--   1. A migration 0045 carregou a definição v1 completa dos quatro
--      instrumentos (blocos presentes, nenhuma definição provisória).
--   2. Estrutura mínima de cada definição: código e versão batem com a
--      linha, blocos do PRD 9.2 no DOC 2, bloco do recém-nascido repetido
--      por bebê, o bloco de amamentação 2.5 a 2.13 inteiro obrigatório e os
--      38 sinais do DOC 3 no catálogo.
--   3. Nenhuma versão foi aprovada pela migration (aprovado_por e
--      aprovado_em nulos). A migration grava vigente = false; o seed.sql
--      sintético marca como vigente depois (008_seed confere isso).
--   4. O conflito com uma linha já aprovada não troca a definição: a
--      cláusula "on conflict" da 0045 só substitui definição provisória.
-- =============================================================================

begin;

select plan(13);

select is(
  (select count(*)::integer from public.instrumento where versao = 'v1-2026-09'),
  4, 'uma linha v1-2026-09 por instrumento (DOC 1 a DOC 4)');

select is(
  (select count(*)::integer from public.instrumento
    where versao = 'v1-2026-09' and jsonb_array_length(definicao -> 'blocos') > 0),
  4, 'as quatro definições têm blocos (nenhuma ficou provisória)');

select is(
  (select count(*)::integer from public.instrumento
    where versao = 'v1-2026-09'
      and definicao ->> 'codigo' = codigo and definicao ->> 'versao' = versao),
  4, 'código e versão dentro da definição batem com a linha');

select is(
  (select count(*)::integer from public.instrumento
    where versao = 'v1-2026-09' and (aprovado_por is not null or aprovado_em is not null)),
  0, 'a migration não aprova nenhuma versão');

select is(
  (select array_agg(b ->> 'id' order by ord)
     from public.instrumento i,
          jsonb_array_elements(i.definicao -> 'blocos') with ordinality as t(b, ord)
    where i.codigo = 'DOC2_CHECKLIST' and i.versao = 'v1-2026-09'),
  array['1','2','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8','2.9','2.10','2.11','2.12','2.13',
        '3','3.1','3.2','4','5','6','7','8','9','ultimo_dia','assinatura','resumo'],
  'DOC 2 tem os blocos do PRD 9.2, na ordem');

select is(
  (select array_agg(b ->> 'id' order by b ->> 'id')
     from public.instrumento i, jsonb_array_elements(i.definicao -> 'blocos') b
    where i.codigo = 'DOC2_CHECKLIST' and i.versao = 'v1-2026-09'
      and (b ->> 'repete_por_bebe')::boolean),
  array['3','3.1','3.2'],
  'blocos 3, 3.1 e 3.2 repetem por bebê');

select is(
  (select count(*)::integer
     from public.instrumento i,
          jsonb_array_elements(i.definicao -> 'blocos') b,
          jsonb_array_elements(b -> 'campos') c
    where i.codigo = 'DOC2_CHECKLIST' and i.versao = 'v1-2026-09'
      and b ->> 'id' in ('2.5','2.6','2.7','2.8','2.9','2.10','2.11','2.12','2.13')
      and coalesce((c ->> 'obrigatorio')::boolean, false) = false),
  0, 'bloco de amamentação 2.5 a 2.13 inteiro obrigatório (PRD 9.2 v4.2)');

select is(
  (select count(*)::integer
     from public.instrumento i,
          jsonb_array_elements(i.definicao -> 'catalogo_alertas' -> 'grupos') g,
          jsonb_array_elements(g -> 'sinais') s
    where i.codigo = 'DOC3_ALERTAS' and i.versao = 'v1-2026-09'),
  38, 'DOC 3 com os 38 sinais (12 + 7 + 13 + 6)');

select is(
  (select count(*)::integer
     from public.instrumento i,
          jsonb_array_elements(i.definicao -> 'catalogo_alertas' -> 'grupos') g,
          jsonb_array_elements(g -> 'sinais') s
     join public.regra_alerta r on r.id = s ->> 'codigo' and r.instrumento_versao = 'v1-2026-09'
    where i.codigo = 'DOC3_ALERTAS' and i.versao = 'v1-2026-09'),
  38, 'cada sinal do catálogo do DOC 3 tem a regra correspondente em regra_alerta');

select is(
  (select array_agg(b ->> 'id' order by ord)
     from public.instrumento i,
          jsonb_array_elements(i.definicao -> 'blocos') with ordinality as t(b, ord)
    where i.codigo = 'DOC1_ENTREVISTA' and i.versao = 'v1-2026-09'),
  array['A','B','C','D','E','F','G','H'],
  'DOC 1 tem os blocos A a H do PRD 9.1');

select is(
  (select array_agg(b ->> 'id' order by ord)
     from public.instrumento i,
          jsonb_array_elements(i.definicao -> 'blocos') with ordinality as t(b, ord)
    where i.codigo = 'DOC4_MAMADA' and i.versao = 'v1-2026-09'),
  array['latch','nts','laserterapia'],
  'DOC 4 tem LATCH, NTS e laserterapia (PRD 9.4)');

-- 4. Reaplicar o insert da 0045 sobre uma versão aprovada não troca nada.
update public.instrumento
   set aprovado_em = now(), definicao = jsonb_set(definicao, '{titulo}', '"aprovada"')
 where codigo = 'DOC4_MAMADA' and versao = 'v1-2026-09';

insert into public.instrumento (codigo, versao, definicao, vigente)
values ('DOC4_MAMADA', 'v1-2026-09', '{"blocos":[{"id":"x"}]}'::jsonb, false)
on conflict (codigo, versao) do update
  set definicao = excluded.definicao,
      vigente = false
  where public.instrumento.aprovado_em is null
    and coalesce(jsonb_array_length(public.instrumento.definicao -> 'blocos'), 0) = 0;

select is(
  (select definicao ->> 'titulo' from public.instrumento
    where codigo = 'DOC4_MAMADA' and versao = 'v1-2026-09'),
  'aprovada', 'versão aprovada não é sobrescrita pela carga de dados');

-- E sobre uma definição provisória (sem blocos, nunca aprovada), substitui.
insert into public.instrumento (codigo, versao, definicao, vigente)
values ('DOC4_MAMADA', 'v0-2000-01', '{"blocos":[]}'::jsonb, true);

insert into public.instrumento (codigo, versao, definicao, vigente)
values ('DOC4_MAMADA', 'v0-2000-01', '{"blocos":[{"id":"x"}]}'::jsonb, false)
on conflict (codigo, versao) do update
  set definicao = excluded.definicao,
      vigente = false
  where public.instrumento.aprovado_em is null
    and coalesce(jsonb_array_length(public.instrumento.definicao -> 'blocos'), 0) = 0;

select is(
  (select jsonb_array_length(definicao -> 'blocos')::text || ' ' || vigente::text
     from public.instrumento where codigo = 'DOC4_MAMADA' and versao = 'v0-2000-01'),
  '1 false', 'definição provisória é substituída e volta a vigente = false');

select * from finish();

rollback;
