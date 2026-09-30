-- =============================================================================
-- 0026_gestao.sql
--
-- Fase 3 de gestão · P45 (capacidade probabilística e sobrevenda), P46
-- (financeiro, DRE e pagamento da equipe) e P52 (painel executivo) ·
-- PROMPTS.md v2 · PRD 3.4, 6.5, 10.1 (sobrevenda), 10.2, 12, 13 e 16.2.
--
-- Esta migration NÃO foi aplicada em ambiente nenhum: escrita, testada no
-- banco local (supabase/sem-docker) e parada para revisão humana do SQL
-- (CLAUDE.md). Parâmetros e a ligação da automação sobrevenda ficam em
-- supabase/dados/gestao_seed.sql; nenhum preço, limite ou prazo mora aqui.
--
-- P45 · Capacidade probabilística (PRD 10.2, Fase 3)
--   1. privado.distribuicao_nascimento(): a distribuição do nascimento em
--      relação à DPP. Modelo 'probabilistico' (parametro.capacidade_modelo):
--      histórico próprio da Kraamzorg quando há partos suficientes
--      (parametro.distribuicao_nascimento.historico_minimo), senão a
--      distribuição de referência do parâmetro. Modelo 'uniforme': a janela
--      da Fase 1 (janela_dpp_dias), para poder voltar atrás.
--   2. privado.capacidade_cenarios(): para cada contrato ativo, os inícios
--      possíveis do atendimento com o peso de cada um. Fato vence estimativa
--      (mesma regra da 0011); nascimento já registrado vale como fato; DPP já
--      passada sem nascimento condiciona a distribuição ao que ainda pode
--      acontecer (nascimentos de hoje em diante).
--   3. privado.capacidade_semanal(): por região e semana, famílias
--      esperadas, o pior caso razoável (P90), a ocupação, a probabilidade de
--      passar do limite de famílias por semana (soma de Bernoullis
--      independentes, exata), a cobertura de backup (equipe livre na semana
--      contra o P90 mais a reserva) e o nível: folga, atencao ou sobrevenda.
--   4. privado.disponibilidade() passa a usar o modelo novo; o agente continua
--      recebendo só 'disponivel' ou 'confirmar_com_equipe'.
--   5. privado.recalculo_ocupacao() acrescenta o alerta de sobrevenda à
--      diretoria (automação sobrevenda, PRD 10.1), uma vez por região e semana.
--   6. api.capacidade(): as próximas semanas (8 no padrão) para a tela.
--   public.ocupacao_projetada (0011) continua como está: é a referência da
--   Fase 1, usada pelo modelo 'uniforme'.
--
-- P46 · Financeiro (PRD 3.4, 12, 13)
--   7. Tabelas privado.despesa, privado.pagamento_equipe,
--      privado.extrato_importacao e privado.extrato_linha, com os tipos de
--      estado (fora do PRD 6, por isso no schema privado), sem nenhum grant:
--      tudo pelas funções api.
--   8. DRE gerencial mensal em regime de caixa, lançamentos, inadimplência e
--      previsão de recebimentos (financeiro e diretoria, AAL2).
--   9. Pagamento da equipe: visitas realizadas × horas por visita × valor da
--      hora, mais a ajuda de deslocamento; liberado só depois de todas as
--      evoluções do acompanhamento enviadas. Pagar cria a despesa.
--  10. Conferência com o extrato: importa as linhas (o arquivo é lido no
--      servidor) e sugere o par. Nunca baixa cobrança (D-07).
--
-- P52 · Painel executivo (PRD 16.2, Fase 3)
--  11. api.painel_executivo(): as cinco perguntas da diretoria com as metas.
--      Cada número usa a mesma regra da tela de origem e está documentado em
--      docs/painel/consultas.md.
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura; registradas em
-- docs/sessoes/P45-P46-P52.md):
--   * Os pesos da distribuição de referência são uma proposta do desenho, sem
--     fonte citada, e ficam em parametro para a diretoria e a Edilaine
--     validarem. O deslocamento entre o nascimento e o início do atendimento
--     (alta) também é parâmetro.
--   * Sobrevenda = probabilidade de passar o limite de famílias da região
--     acima de parametro.sobrevenda_prob_pct. Ocupação acima do alerta ou
--     cobertura de backup sem reserva é 'atencao', não alerta a diretoria.
--   * Receita do DRE = cobranças pagas no mês (regime de caixa). Estornada não
--     conta. Taxa do meio de pagamento ainda não é registrada.
--   * A ajuda de deslocamento vale por bloco de dias do pacote
--     (parametro.pagamento_equipe.dias_por_ajuda) [confirmar: Leonardo].
-- =============================================================================


-- =============================================================================
-- 1. P45 · Distribuição do nascimento
-- =============================================================================

-- Modelo em uso. Sem o parâmetro, vale a Fase 1 (uniforme).
create function privado.capacidade_modelo() returns text
  language sql
  stable
  set search_path = ''
  as $$
  select case
           when (select p.valor #>> '{}' from public.parametro p where p.chave = 'capacidade_modelo') = 'probabilistico'
             then 'probabilistico'
           else 'uniforme'
         end
$$;
comment on function privado.capacidade_modelo() is '[P45] Modelo de capacidade em uso: probabilistico (Fase 3) ou uniforme (Fase 1, o padrão quando o parâmetro capacidade_modelo falta). Sem grant.';

-- Distribuição do nascimento em relação à DPP, em dias (0 = a própria DPP).
create function privado.distribuicao_nascimento() returns table (deslocamento integer, peso numeric)
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_cfg     jsonb;
  v_janela  jsonb;
  v_antes   integer;
  v_depois  integer;
  v_min     integer;
  v_hist    integer;
  v_usa     boolean := false;
begin
  if privado.capacidade_modelo() = 'uniforme' then
    select p.valor into v_janela from public.parametro p where p.chave = 'janela_dpp_dias';
    if pg_catalog.jsonb_typeof(v_janela -> 'antes') is distinct from 'number'
       or pg_catalog.jsonb_typeof(v_janela -> 'depois') is distinct from 'number' then
      return;
    end if;
    v_antes := (v_janela ->> 'antes')::numeric::integer;
    v_depois := (v_janela ->> 'depois')::numeric::integer;
    if v_antes < 0 or v_depois < 0 then
      return;
    end if;
    return query
      select g, 1::numeric / (v_antes + v_depois + 1)
      from pg_catalog.generate_series(-v_antes, v_depois) as g;
    return;
  end if;

  select p.valor into v_cfg from public.parametro p where p.chave = 'distribuicao_nascimento';
  if pg_catalog.jsonb_typeof(v_cfg -> 'faixas') is distinct from 'array' then
    return;
  end if;
  v_min := coalesce((v_cfg ->> 'historico_minimo')::integer, 0);

  -- partos da própria Kraamzorg dentro das faixas (fato: data_nascimento)
  select count(*)::integer
    into v_hist
  from public.familia f
  where f.mesclada_em_id is null
    and f.dpp is not null
    and f.data_nascimento is not null
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_cfg -> 'faixas') x
      where (f.data_nascimento - f.dpp) between (x ->> 'de')::integer and (x ->> 'ate')::integer);
  v_usa := v_min > 0 and v_hist >= v_min;

  return query
    with faixas as (
      select (x ->> 'de')::integer as de, (x ->> 'ate')::integer as ate, (x ->> 'peso')::numeric as peso_ref
      from pg_catalog.jsonb_array_elements(v_cfg -> 'faixas') x
    ),
    hist as (
      select fx.de, fx.ate, fx.peso_ref,
             (select count(*) from public.familia f
               where f.mesclada_em_id is null and f.dpp is not null and f.data_nascimento is not null
                 and (f.data_nascimento - f.dpp) between fx.de and fx.ate)::numeric as n
      from faixas fx
    ),
    dias as (
      select g as deslocamento,
             (case when v_usa then h.n else h.peso_ref end) / (h.ate - h.de + 1) as bruto
      from hist h
      cross join lateral pg_catalog.generate_series(h.de, h.ate) as g
    )
    select d.deslocamento, d.bruto / nullif(sum(d.bruto) over (), 0)
    from dias d
    where d.bruto > 0;
end;
$$;
comment on function privado.distribuicao_nascimento() is '[P45] Distribuição do nascimento em relação à DPP, por dia, somando 1. Modelo uniforme: a janela janela_dpp_dias. Modelo probabilistico: o histórico próprio (famílias com DPP e data_nascimento nas faixas) quando há pelo menos distribuicao_nascimento.historico_minimo partos, senão as faixas de referência do parâmetro, cada faixa espalhada por igual entre os seus dias. Sem linhas se o parâmetro faltar. Sem grant.';

create function privado.distribuicao_nascimento_info() returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_cfg  jsonb;
  v_min  integer;
  v_hist integer;
  v_modelo text := privado.capacidade_modelo();
begin
  if v_modelo = 'uniforme' then
    return pg_catalog.jsonb_build_object('modelo', v_modelo, 'fonte', 'uniforme', 'versao', null,
                                         'historico_n', 0, 'historico_minimo', null);
  end if;
  select p.valor into v_cfg from public.parametro p where p.chave = 'distribuicao_nascimento';
  v_min := coalesce((v_cfg ->> 'historico_minimo')::integer, 0);
  select count(*)::integer into v_hist
  from public.familia f
  where f.mesclada_em_id is null and f.dpp is not null and f.data_nascimento is not null
    and exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(v_cfg -> 'faixas', '[]'::jsonb)) x
      where (f.data_nascimento - f.dpp) between (x ->> 'de')::integer and (x ->> 'ate')::integer);
  return pg_catalog.jsonb_build_object(
    'modelo', v_modelo,
    'fonte', case when v_min > 0 and v_hist >= v_min then 'historico' else 'referencia' end,
    'versao', v_cfg ->> 'versao',
    'descricao', v_cfg ->> 'descricao',
    'historico_n', v_hist,
    'historico_minimo', v_min,
    'faixas', coalesce(v_cfg -> 'faixas', '[]'::jsonb));
end;
$$;
comment on function privado.distribuicao_nascimento_info() is '[P45] De onde vem a distribuição em uso: modelo, fonte (uniforme, referencia ou historico), versão, quantos partos próprios existem e o mínimo para trocar a referência pelo histórico. Sem grant.';


-- =============================================================================
-- 2. P45 · Contratos e cenários de início
-- =============================================================================

-- Mesmas regras da 0011: contrato ativo, região da família (ou da cidade),
-- dias do acompanhamento ou do pacote, início conhecido.
create view privado.capacidade_contratos as
select k.id                                                        as contrato_id,
       f.id                                                        as familia_id,
       coalesce(f.regiao_id, c.regiao_id)                          as regiao_id,
       coalesce(a.dias_contratados, pc.dias)                       as dias,
       coalesce(a.inicio_efetivo, f.data_inicio_efetivo, f.data_alta) as inicio_fato,
       f.dpp,
       f.data_nascimento
from public.contrato k
join public.familia f        on f.id = k.familia_id
join public.pacote_versao pv on pv.id = k.pacote_versao_id
join public.pacote pc        on pc.id = pv.pacote_id
left join public.cidade c    on c.id = f.cidade_id
left join lateral (
  select a1.dias_contratados, a1.inicio_efetivo, a1.estado
  from public.acompanhamento a1
  where a1.contrato_id = k.id
  order by a1.criado_em desc, a1.id
  limit 1
) a on true
where k.status not in ('cancelado', 'distrato')
  and f.mesclada_em_id is null
  and (a.estado is null or a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico'));
comment on view privado.capacidade_contratos is '[P45] Contratos que ocupam vaga (mesma regra da 0011): fora de cancelado e distrato, família não mesclada, acompanhamento não terminado. Região, dias e início conhecido já resolvidos. Sem grant.';

create function privado.capacidade_cenarios()
  returns table (familia_id uuid, regiao_id uuid, dias integer, inicio date, peso numeric)
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_hoje    date := (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_modelo  text := privado.capacidade_modelo();
  v_cfg     jsonb;
  v_desloc  integer := 0;
  v_janela  jsonb;
  v_antes   integer;
  v_depois  integer;
begin
  if v_modelo = 'uniforme' then
    -- Fase 1 (0011): janela uniforme; nascimento já registrado corta a janela.
    select p.valor into v_janela from public.parametro p where p.chave = 'janela_dpp_dias';
    if pg_catalog.jsonb_typeof(v_janela -> 'antes') is distinct from 'number'
       or pg_catalog.jsonb_typeof(v_janela -> 'depois') is distinct from 'number' then
      return query
        select ct.familia_id, ct.regiao_id, ct.dias, ct.inicio_fato, 1::numeric
        from privado.capacidade_contratos ct
        where ct.inicio_fato is not null and ct.regiao_id is not null;
      return;
    end if;
    v_antes := (v_janela ->> 'antes')::numeric::integer;
    v_depois := (v_janela ->> 'depois')::numeric::integer;
    return query
      select ct.familia_id, ct.regiao_id, ct.dias, ct.inicio_fato, 1::numeric
      from privado.capacidade_contratos ct
      where ct.inicio_fato is not null and ct.regiao_id is not null
      union all
      select ct.familia_id, ct.regiao_id, ct.dias, (jn.ini + s.n)::date,
             1::numeric / (jn.fim - jn.ini + 1)
      from privado.capacidade_contratos ct
      cross join lateral (
        select greatest(ct.dpp - v_antes, coalesce(ct.data_nascimento, ct.dpp - v_antes))   as ini,
               greatest(ct.dpp + v_depois, coalesce(ct.data_nascimento, ct.dpp + v_depois)) as fim
      ) jn
      cross join lateral pg_catalog.generate_series(0, jn.fim - jn.ini) as s(n)
      where ct.inicio_fato is null and ct.dpp is not null and ct.regiao_id is not null;
    return;
  end if;

  select p.valor into v_cfg from public.parametro p where p.chave = 'distribuicao_nascimento';
  v_desloc := coalesce((v_cfg ->> 'deslocamento_inicio_dias')::integer, 0);

  return query
    -- 1. início conhecido (fato): um só, com peso 1
    select ct.familia_id, ct.regiao_id, ct.dias, ct.inicio_fato, 1::numeric
    from privado.capacidade_contratos ct
    where ct.inicio_fato is not null and ct.regiao_id is not null
    union all
    -- 2. nascimento registrado, ainda sem alta: o início é o nascimento mais o deslocamento
    select ct.familia_id, ct.regiao_id, ct.dias, ct.data_nascimento + v_desloc, 1::numeric
    from privado.capacidade_contratos ct
    where ct.inicio_fato is null and ct.data_nascimento is not null and ct.regiao_id is not null
    union all
    -- 3. só a DPP: a distribuição do nascimento, condicionada a ele ainda não ter acontecido
    select c3.familia_id, c3.regiao_id, c3.dias, c3.inicio,
           c3.bruto / nullif(sum(c3.bruto) over (partition by c3.familia_id), 0)
    from (
      select ct.familia_id, ct.regiao_id, ct.dias, (ct.dpp + d.deslocamento + v_desloc) as inicio, d.peso as bruto
      from privado.capacidade_contratos ct
      cross join privado.distribuicao_nascimento() d
      where ct.inicio_fato is null and ct.data_nascimento is null and ct.dpp is not null
        and ct.regiao_id is not null
        and ct.dpp + d.deslocamento >= v_hoje
    ) c3
    union all
    -- 3b. a DPP passou e a distribuição inteira ficou para trás: o nascimento é hoje
    select ct.familia_id, ct.regiao_id, ct.dias, v_hoje + v_desloc, 1::numeric
    from privado.capacidade_contratos ct
    where ct.inicio_fato is null and ct.data_nascimento is null and ct.dpp is not null
      and ct.regiao_id is not null
      and not exists (select 1 from privado.distribuicao_nascimento() d where ct.dpp + d.deslocamento >= v_hoje)
      and exists (select 1 from privado.distribuicao_nascimento() d2);
end;
$$;
comment on function privado.capacidade_cenarios() is '[P45] Inícios possíveis do atendimento de cada contrato ativo, com o peso de cada um (soma 1 por família). Fato vence estimativa: início conhecido (peso 1); nascimento registrado (nascimento mais o deslocamento); DPP (distribuição do nascimento condicionada a ainda não ter nascido). Modelo uniforme: a lógica da 0011. Sem grant.';


-- =============================================================================
-- 3. P45 · Soma de Bernoullis e capacidade por semana
-- =============================================================================

-- Distribuição do número de sucessos entre eventos independentes com
-- probabilidades p[i]. Devolve pmf[k + 1] = P(N = k), k de 0 a n.
create function privado.poisson_binomial(p numeric[]) returns numeric[]
  language plpgsql
  immutable
  set search_path = ''
  as $$
declare
  v_pmf numeric[] := array[1::numeric];
  v_novo numeric[];
  v_n integer;
  v_q numeric;
  i integer;
  k integer;
begin
  if poisson_binomial.p is null then
    return v_pmf;
  end if;
  for i in 1 .. coalesce(pg_catalog.array_length(poisson_binomial.p, 1), 0) loop
    v_q := least(greatest(poisson_binomial.p[i], 0), 1);
    v_n := pg_catalog.array_length(v_pmf, 1);
    v_novo := pg_catalog.array_fill(0::numeric, array[v_n + 1]);
    for k in 1 .. v_n loop
      v_novo[k] := v_novo[k] + v_pmf[k] * (1 - v_q);
      v_novo[k + 1] := v_novo[k + 1] + v_pmf[k] * v_q;
    end loop;
    v_pmf := v_novo;
  end loop;
  return v_pmf;
end;
$$;
comment on function privado.poisson_binomial(numeric[]) is '[P45] Distribuição exata do número de famílias em atendimento numa semana: soma de Bernoullis independentes com as probabilidades dadas. pmf[k + 1] = P(N = k). Sem grant.';

create function privado.parametro_numero(chave text) returns numeric
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_valor jsonb;
begin
  select p.valor into v_valor from public.parametro p where p.chave = parametro_numero.chave;
  if pg_catalog.jsonb_typeof(v_valor) is distinct from 'number' then
    raise exception 'capacidade:parametro_ausente %', parametro_numero.chave using errcode = 'P0001';
  end if;
  return (v_valor #>> '{}')::numeric;
end;
$$;
comment on function privado.parametro_numero(text) is '[P45] Lê um parametro numérico; falta ou tipo errado é erro capacidade:parametro_ausente (nada de valor inventado no código). Sem grant.';

create function privado.capacidade_semanal(p_de date, p_ate date, p_regiao uuid default null)
  returns table (
    regiao_id          uuid,
    regiao             text,
    semana             date,
    limite_familias    integer,
    familias_esperadas numeric,
    familias_p90       integer,
    dias_atendimento   numeric,
    capacidade_dias    integer,
    ocupacao_pct       numeric,
    prob_excesso_pct   numeric,
    profissionais_ativas integer,
    capacidade_equipe  integer,
    cobertura          text,
    nivel              text
  )
  language plpgsql
  stable
  set search_path = ''
  set jit = off
  as $$
declare
  v_alerta   numeric := privado.parametro_numero('capacidade_alerta_pct');
  v_sobre    numeric := privado.parametro_numero('sobrevenda_prob_pct');
  v_visitas  numeric := privado.parametro_numero('agenda_visitas_por_dia');
  v_reserva  numeric := privado.parametro_numero('backup_reserva_profissionais');
  r          record;
  v_pmf      numeric[];
  v_acum     numeric;
  v_exc      numeric;
  v_p90      integer;
  v_cap      integer;
  v_cob      text;
  v_ocup     numeric;
  k          integer;
begin
  for r in
    with semanas as (
      select pg_catalog.generate_series(pg_catalog.date_trunc('week', capacidade_semanal.p_de)::date,
                                        pg_catalog.date_trunc('week', capacidade_semanal.p_ate)::date,
                                        interval '7 days')::date as s
    ),
    regioes as (
      select rg.* from public.regiao rg
      where rg.ativa and rg.limite_familias_semana > 0
        and (capacidade_semanal.p_regiao is null or rg.id = capacidade_semanal.p_regiao)
    ),
    por_cenario as (
      -- semanas tocadas por cada início possível, com os dias que caem em cada uma
      select cn.familia_id, cn.regiao_id, cn.inicio, cn.peso,
             pg_catalog.date_trunc('week', (cn.inicio + d.n))::date as semana,
             count(*) as dias_na_semana
      from privado.capacidade_cenarios() cn
      cross join lateral pg_catalog.generate_series(0, cn.dias - 1) as d(n)
      group by cn.familia_id, cn.regiao_id, cn.inicio, cn.peso, pg_catalog.date_trunc('week', (cn.inicio + d.n))::date
    ),
    por_familia as (
      select pc.familia_id, pc.regiao_id, pc.semana,
             least(sum(pc.peso), 1::numeric) as p,
             sum(pc.peso * pc.dias_na_semana) as dias_esp
      from por_cenario pc
      group by pc.familia_id, pc.regiao_id, pc.semana
    ),
    agg as (
      select pf.regiao_id, pf.semana,
             pg_catalog.array_agg(pf.p order by pf.familia_id) as ps,
             sum(pf.p) as fam, sum(pf.dias_esp) as dias
      from por_familia pf
      group by pf.regiao_id, pf.semana
    ),
    equipe as (
      select rg.id as regiao_id, s.s as semana,
             count(pr.id)::integer as n,
             coalesce(sum(7 - (
               select count(*) from pg_catalog.generate_series(0, 6) as gs(dia_n)
               where exists (select 1 from public.bloqueio_agenda b
                             where b.profissional_id = pr.id and (s.s + gs.dia_n) between b.inicio and b.fim)
             )), 0)::integer as dias_livres
      from regioes rg
      cross join semanas s
      join public.profissional pr on pr.ativa and rg.id = any (pr.regioes)
      group by rg.id, s.s
    )
    select rg.id as rid, rg.nome as rnome, s.s as sem, rg.limite_familias_semana as lim,
           coalesce(a.ps, '{}'::numeric[]) as ps, coalesce(a.fam, 0) as fam, coalesce(a.dias, 0) as dias,
           coalesce(e.n, 0) as nprof, coalesce(e.dias_livres, 0) as livres
    from regioes rg
    cross join semanas s
    left join agg a on a.regiao_id = rg.id and a.semana = s.s
    left join equipe e on e.regiao_id = rg.id and e.semana = s.s
    order by rg.nome, s.s
  loop
    v_pmf := privado.poisson_binomial(r.ps);
    v_exc := 0;
    v_acum := 0;
    v_p90 := null;
    for k in 0 .. pg_catalog.array_length(v_pmf, 1) - 1 loop
      v_acum := v_acum + v_pmf[k + 1];
      if v_p90 is null and v_acum >= 0.9 - 0.000000001 then
        v_p90 := k;
      end if;
      if k > r.lim then
        v_exc := v_exc + v_pmf[k + 1];
      end if;
    end loop;
    v_p90 := coalesce(v_p90, pg_catalog.array_length(v_pmf, 1) - 1);
    v_cap := floor(r.livres * v_visitas / 7)::integer;
    v_cob := case
               when v_cap < v_p90 then 'insuficiente'
               when v_cap < v_p90 + v_reserva * v_visitas then 'sem_reserva'
               else 'ok'
             end;
    v_ocup := pg_catalog.round(100 * r.dias / (r.lim * 7), 1);

    regiao_id := r.rid;
    regiao := r.rnome;
    semana := r.sem;
    limite_familias := r.lim;
    familias_esperadas := pg_catalog.round(r.fam, 2);
    familias_p90 := v_p90;
    dias_atendimento := pg_catalog.round(r.dias, 2);
    capacidade_dias := r.lim * 7;
    ocupacao_pct := v_ocup;
    prob_excesso_pct := pg_catalog.round(100 * v_exc, 1);
    profissionais_ativas := r.nprof;
    capacidade_equipe := v_cap;
    cobertura := v_cob;
    nivel := case
               when 100 * v_exc >= v_sobre then 'sobrevenda'
               when v_ocup >= v_alerta or v_cob <> 'ok' then 'atencao'
               else 'folga'
             end;
    return next;
  end loop;
end;
$$;
comment on function privado.capacidade_semanal(date, date, uuid) is '[P45] Capacidade por região ativa e semana (segunda-feira) entre duas datas. familias_esperadas: soma das probabilidades de cada família estar em atendimento na semana; familias_p90: o menor número de famílias simultâneas que cobre 90% dos casos (soma exata de Bernoullis); ocupacao_pct: dias esperados sobre limite × 7; prob_excesso_pct: chance de passar o limite de famílias; capacidade_equipe: famílias que a equipe livre na semana atende (dias livres × visitas por dia / 7); cobertura: ok, sem_reserva (falta a reserva de backup) ou insuficiente (menos que o P90); nivel: sobrevenda (probabilidade ≥ sobrevenda_prob_pct), atencao (ocupação ≥ capacidade_alerta_pct ou cobertura sem reserva) ou folga. Erro capacidade:parametro_ausente se faltar parâmetro. Sem grant.';


-- =============================================================================
-- 4. P45 · Disponibilidade para o agente (continua devolvendo só o texto)
--    Modelo uniforme: o corpo da 0011, sem mudança. Modelo probabilistico: todas
--    as semanas prováveis do nascimento estão em folga (ocupação, probabilidade
--    de sobrevenda e cobertura de backup).
-- =============================================================================

create or replace function privado.disponibilidade(dpp date, regiao_id uuid) returns text
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_janela  jsonb;
  v_limite  jsonb;
  v_antes   integer;
  v_depois  integer;
  v_pct     numeric;
  v_r       public.regiao;
  v_dias    integer;
  v_ini     date;
  v_fim     date;
  v_cfg     jsonb;
  v_desloc  integer;
  v_intervalo numeric;
  v_de      integer;
  v_ate     integer;
begin
  if disponibilidade.dpp is null or disponibilidade.regiao_id is null then
    return 'confirmar_com_equipe';
  end if;

  select p.valor into v_janela from public.parametro p where p.chave = 'janela_dpp_dias';
  select p.valor into v_limite from public.parametro p where p.chave = 'capacidade_alerta_pct';
  if pg_catalog.jsonb_typeof(v_janela -> 'antes') is distinct from 'number'
     or pg_catalog.jsonb_typeof(v_janela -> 'depois') is distinct from 'number'
     or pg_catalog.jsonb_typeof(v_limite) is distinct from 'number' then
    return 'confirmar_com_equipe';
  end if;
  v_antes  := (v_janela ->> 'antes')::numeric::integer;
  v_depois := (v_janela ->> 'depois')::numeric::integer;
  v_pct    := (v_limite #>> '{}')::numeric;
  if v_antes < 0 or v_depois < 0 or v_pct <= 0 then
    return 'confirmar_com_equipe';
  end if;

  select r.* into v_r from public.regiao r where r.id = disponibilidade.regiao_id;
  if not found or not v_r.ativa or v_r.limite_familias_semana <= 0 then
    return 'confirmar_com_equipe';
  end if;

  select greatest(coalesce(max(pc.dias), 1), 1) into v_dias from public.pacote pc where pc.ativo;

  if privado.capacidade_modelo() = 'probabilistico' then
    select p.valor into v_cfg from public.parametro p where p.chave = 'distribuicao_nascimento';
    if pg_catalog.jsonb_typeof(v_cfg -> 'intervalo_provavel_pct') is distinct from 'number'
       or not exists (select 1 from privado.distribuicao_nascimento()) then
      return 'confirmar_com_equipe';
    end if;
    v_intervalo := (v_cfg ->> 'intervalo_provavel_pct')::numeric;
    v_desloc := coalesce((v_cfg ->> 'deslocamento_inicio_dias')::integer, 0);
    if v_intervalo <= 0 or v_intervalo > 100 then
      return 'confirmar_com_equipe';
    end if;

    -- os dias do nascimento que cobrem o intervalo provável (centrado na distribuição)
    select min(t.deslocamento) filter (where t.acum >= (1 - v_intervalo / 100) / 2 - 0.000000001),
           max(t.deslocamento) filter (where t.acum - t.peso <= 1 - (1 - v_intervalo / 100) / 2 + 0.000000001)
      into v_de, v_ate
    from (
      select d.deslocamento, d.peso, sum(d.peso) over (order by d.deslocamento) as acum
      from privado.distribuicao_nascimento() d
    ) t;
    if v_de is null then
      return 'confirmar_com_equipe';
    end if;

    v_ini := disponibilidade.dpp + v_de + v_desloc;
    v_fim := disponibilidade.dpp + v_ate + v_desloc + v_dias - 1;

    begin
      if exists (select 1
                 from privado.capacidade_semanal(v_ini, v_fim, v_r.id) c
                 where c.nivel <> 'folga') then
        return 'confirmar_com_equipe';
      end if;
    exception
      when sqlstate 'P0001' then
        -- parâmetro de capacidade ausente: nunca promete vaga sem dado
        return 'confirmar_com_equipe';
    end;
    return 'disponivel';
  end if;

  v_ini := pg_catalog.date_trunc('week', disponibilidade.dpp - v_antes)::date;
  v_fim := disponibilidade.dpp + v_depois + v_dias - 1;

  if exists (select 1
             from public.ocupacao_projetada o
             where o.regiao_id = v_r.id
               and o.semana between v_ini and v_fim
               and (o.ocupacao_pct is null or o.ocupacao_pct >= v_pct)) then
    return 'confirmar_com_equipe';
  end if;

  return 'disponivel';
end;
$$;
comment on function privado.disponibilidade(date, uuid) is 'Disponibilidade para uma DPP numa região (PRD 10.2, 11.9). Modelo uniforme (Fase 1): todas as semanas prováveis abaixo de parametro.capacidade_alerta_pct em public.ocupacao_projetada. Modelo probabilistico (P45): todas as semanas do intervalo provável do nascimento em folga em privado.capacidade_semanal (ocupação, probabilidade de sobrevenda e cobertura de backup). Devolve só disponivel ou confirmar_com_equipe, inclusive sem DPP, sem região ou sem parâmetro. Nunca devolve números. Sem grant: base de agente.verificar_disponibilidade (P21).';

revoke execute on function privado.disponibilidade(date, uuid) from public, anon, authenticated, service_role;


-- =============================================================================
-- 5. P45 · Recálculo diário: foto das semanas e alerta de sobrevenda
-- =============================================================================

create or replace function privado.recalculo_ocupacao() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_hoje    date := (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_limite  jsonb;
  v_pct     numeric;
  v_semanas jsonb;
  v_acima   jsonb;
  v_n       integer;
  v_ativa   boolean;
  v_alertas integer := 0;
  v_regiao  record;
  v_nova    record;
begin
  if privado.capacidade_modelo() = 'uniforme' then
    select p.valor into v_limite from public.parametro p where p.chave = 'capacidade_alerta_pct';
    if pg_catalog.jsonb_typeof(v_limite) = 'number' then
      v_pct := (v_limite #>> '{}')::numeric;
    end if;

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'regiao_id', o.regiao_id, 'semana', o.semana, 'ocupacao_pct', o.ocupacao_pct,
                      'familias', o.familias) order by o.regiao, o.semana), '[]'::jsonb),
           coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'regiao_id', o.regiao_id, 'semana', o.semana, 'ocupacao_pct', o.ocupacao_pct)
                      order by o.regiao, o.semana)
                    filter (where v_pct is not null and o.ocupacao_pct >= v_pct), '[]'::jsonb)
      into v_semanas, v_acima
    from public.ocupacao_projetada o
    where o.semana >= pg_catalog.date_trunc('week', v_hoje)::date;

    return pg_catalog.jsonb_build_object(
      'limite_alerta_pct', v_pct,
      'semanas', v_semanas,
      'acima_do_limite', v_acima);
  end if;

  -- modelo probabilístico: as próximas semanas do painel (parametro.capacidade_semanas_painel)
  v_n := privado.parametro_numero('capacidade_semanas_painel')::integer;
  v_pct := privado.parametro_numero('capacidade_alerta_pct');

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                    'regiao_id', c.regiao_id, 'semana', c.semana, 'ocupacao_pct', c.ocupacao_pct,
                    'familias', c.familias_esperadas, 'prob_excesso_pct', c.prob_excesso_pct,
                    'cobertura', c.cobertura, 'nivel', c.nivel) order by c.regiao, c.semana), '[]'::jsonb),
         coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                    'regiao_id', c.regiao_id, 'semana', c.semana, 'ocupacao_pct', c.ocupacao_pct)
                    order by c.regiao, c.semana) filter (where c.ocupacao_pct >= v_pct), '[]'::jsonb)
    into v_semanas, v_acima
  from privado.capacidade_semanal(pg_catalog.date_trunc('week', v_hoje)::date, pg_catalog.date_trunc('week', v_hoje)::date + (v_n * 7 - 1)) c;

  -- alerta à diretoria: uma notificação por região com semanas de sobrevenda ainda não avisadas
  select coalesce((select a.ativa from public.automacao a where a.id = 'sobrevenda'), false) into v_ativa;
  if v_ativa and privado.pode_executar(null, 'sobrevenda') then
    for v_regiao in
      select c.regiao_id, c.regiao
      from privado.capacidade_semanal(pg_catalog.date_trunc('week', v_hoje)::date, pg_catalog.date_trunc('week', v_hoje)::date + (v_n * 7 - 1)) c
      where c.nivel = 'sobrevenda'
      group by c.regiao_id, c.regiao
      order by c.regiao
    loop
      select pg_catalog.count(*)::integer as qtd, min(t.semana) as primeira, max(t.prob) as maior
        into v_nova
      from (
        select c.semana, c.prob_excesso_pct as prob
        from privado.capacidade_semanal(pg_catalog.date_trunc('week', v_hoje)::date, pg_catalog.date_trunc('week', v_hoje)::date + (v_n * 7 - 1), v_regiao.regiao_id) c
        where c.nivel = 'sobrevenda'
          and not exists (
            select 1 from public.automacao_execucao e
            where e.automacao_id = 'sobrevenda'
              and e.payload ->> 'regiao_id' = v_regiao.regiao_id::text
              and e.payload ->> 'semana' = c.semana::text)
      ) t;
      if v_nova.qtd > 0 then
        insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, executada_em, status, payload)
        select 'sobrevenda', null, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp(), 'executada',
               pg_catalog.jsonb_build_object('regiao_id', v_regiao.regiao_id, 'semana', c.semana,
                                             'prob_excesso_pct', c.prob_excesso_pct)
        from privado.capacidade_semanal(pg_catalog.date_trunc('week', v_hoje)::date, pg_catalog.date_trunc('week', v_hoje)::date + (v_n * 7 - 1), v_regiao.regiao_id) c
        where c.nivel = 'sobrevenda'
          and not exists (
            select 1 from public.automacao_execucao e
            where e.automacao_id = 'sobrevenda'
              and e.payload ->> 'regiao_id' = v_regiao.regiao_id::text
              and e.payload ->> 'semana' = c.semana::text);
        insert into public.notificacao (papel, prioridade, titulo, corpo, link)
        values ('diretoria', 'alta',
                'Sobrevenda provável em ' || v_regiao.regiao,
                pg_catalog.format(
                  'A chance de passar do limite de famílias por semana em %s está acima do limite de alerta em %s %s, a partir da semana de %s. Veja a capacidade das próximas semanas antes de fechar novos contratos na região.',
                  v_regiao.regiao, v_nova.qtd, case when v_nova.qtd = 1 then 'semana' else 'semanas' end,
                  pg_catalog.to_char(v_nova.primeira, 'DD/MM/YYYY')),
                '/capacidade');
        v_alertas := v_alertas + 1;
      end if;
    end loop;
  end if;

  return pg_catalog.jsonb_build_object(
    'modelo', 'probabilistico',
    'limite_alerta_pct', v_pct,
    'semanas', v_semanas,
    'acima_do_limite', v_acima,
    'alertas_sobrevenda', v_alertas);
end;
$$;
comment on function privado.recalculo_ocupacao() is 'Etapa ocupacao do recálculo diário (PRD 10.2). Modelo uniforme: foto de public.ocupacao_projetada (0011). Modelo probabilistico (P45): foto das próximas parametro.capacidade_semanas_painel semanas de privado.capacidade_semanal e, com a automação sobrevenda ligada e liberada, uma notificação à diretoria por região com semanas de sobrevenda ainda não avisadas (uma execução por região e semana). Sem grant.';

revoke execute on function privado.recalculo_ocupacao() from public, anon, authenticated, service_role;


-- =============================================================================
-- 6. P45 · api.capacidade (coordenação e diretoria, AAL2)
--    Só números de capacidade e nomes de região: nenhum dado de família.
-- =============================================================================

create function privado.gestao_recusar(codigo text, detalhe text default null) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
begin
  raise exception 'gestao:% %', gestao_recusar.codigo, coalesce(gestao_recusar.detalhe, '')
    using errcode = 'P0001';
end;
$$;
comment on function privado.gestao_recusar(text, text) is '[P45 a P52] Recusa de negócio da gestão: erro P0001 com a mensagem "gestao:<código> <detalhe>", que a tela troca por uma frase. O detalhe nunca leva dado pessoal. Sem grant.';

create function privado.hoje_sp() returns date
  language sql
  stable
  set search_path = ''
  as $$ select (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date $$;
comment on function privado.hoje_sp() is 'Hoje no fuso America/Sao_Paulo. Sem grant.';

create function privado.inicio_do_mes(dia date) returns date
  language sql
  immutable
  set search_path = ''
  as $$ select inicio_do_mes.dia - (pg_catalog.date_part('day', inicio_do_mes.dia)::integer - 1) $$;
comment on function privado.inicio_do_mes(date) is 'Primeiro dia do mês da data. Sem grant.';

create function api.capacidade(semanas integer default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_hoje    date := privado.hoje_sp();
  v_n       integer;
  v_regioes jsonb;
  v_alertas jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  v_n := coalesce(capacidade.semanas, privado.parametro_numero('capacidade_semanas_painel')::integer);
  if v_n < 1 or v_n > 26 then
    perform privado.gestao_recusar('semanas_invalidas');
  end if;

  with c as (
    select * from privado.capacidade_semanal(pg_catalog.date_trunc('week', v_hoje)::date, pg_catalog.date_trunc('week', v_hoje)::date + (v_n * 7 - 1))
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'regiao_id', r.regiao_id, 'regiao', r.regiao, 'limite_familias', r.limite_familias,
           'semanas', r.semanas) order by r.regiao), '[]'::jsonb)
    into v_regioes
  from (
    select c.regiao_id, c.regiao, c.limite_familias,
           pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'semana', c.semana, 'ocupacao_pct', c.ocupacao_pct, 'familias_esperadas', c.familias_esperadas,
             'familias_p90', c.familias_p90, 'prob_excesso_pct', c.prob_excesso_pct,
             'profissionais_ativas', c.profissionais_ativas, 'capacidade_equipe', c.capacidade_equipe,
             'cobertura', c.cobertura, 'nivel', c.nivel) order by c.semana) as semanas
    from c
    group by c.regiao_id, c.regiao, c.limite_familias
  ) r;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'regiao_id', c.regiao_id, 'regiao', c.regiao, 'semana', c.semana, 'nivel', c.nivel,
           'prob_excesso_pct', c.prob_excesso_pct, 'ocupacao_pct', c.ocupacao_pct, 'cobertura', c.cobertura)
           order by (c.nivel = 'sobrevenda') desc, c.semana, c.regiao), '[]'::jsonb)
    into v_alertas
  from privado.capacidade_semanal(pg_catalog.date_trunc('week', v_hoje)::date, pg_catalog.date_trunc('week', v_hoje)::date + (v_n * 7 - 1)) c
  where c.nivel <> 'folga';

  return pg_catalog.jsonb_build_object(
    'gerado_em', pg_catalog.clock_timestamp(),
    'semanas', v_n,
    'distribuicao', privado.distribuicao_nascimento_info(),
    'limites', pg_catalog.jsonb_build_object(
      'alerta_pct', privado.parametro_numero('capacidade_alerta_pct'),
      'sobrevenda_prob_pct', privado.parametro_numero('sobrevenda_prob_pct')),
    'regioes', v_regioes,
    'alertas', v_alertas);
end;
$$;
comment on function api.capacidade(integer) is '[P45] Capacidade das próximas semanas (padrão parametro.capacidade_semanas_painel = 8) por região: ocupação, famílias esperadas e no pior caso razoável (P90), probabilidade de passar do limite, equipe livre e cobertura de backup, nível (folga, atencao, sobrevenda), a lista de alertas e a origem da distribuição do nascimento. Coordenação e diretoria, AAL2. Sem dado de família.';


-- =============================================================================
-- 7. P46 · Tabelas do financeiro
--    No schema privado (não são tabelas do PRD 6 e o PostgREST não as expõe),
--    com RLS e sem nenhum grant, nem para o service_role: financeiro e
--    diretoria chegam pelas funções api, que checam papel e AAL2.
-- =============================================================================

create type privado.categoria_despesa as enum (
  'equipe_assistencial', 'marketing_anuncios', 'deslocamento', 'contabilidade', 'tecnologia', 'pro_labore', 'outros');
create type privado.status_pagamento_equipe as enum ('bloqueado', 'liberado', 'pago');
create type privado.motivo_bloqueio_pagamento as enum ('evolucao_nao_enviada', 'sem_valor_hora');
create type privado.situacao_extrato as enum ('conferida', 'sugerida', 'sem_correspondencia');

create table privado.pagamento_equipe (
  id                          uuid primary key default gen_random_uuid(),
  criado_em                   timestamptz not null default now(),
  atualizado_em               timestamptz not null default now(),
  criado_por                  uuid references public.perfil(id),
  acompanhamento_id           uuid not null references public.acompanhamento(id),
  profissional_id             uuid not null references public.profissional(id),
  visitas                     integer not null check (visitas > 0),
  horas                       numeric(7,1) not null,
  valor_hora_centavos         integer,
  valor_horas_centavos        integer not null default 0,
  ajuda_deslocamento_centavos integer not null default 0,
  total_centavos              integer not null default 0,
  status                      privado.status_pagamento_equipe not null default 'bloqueado',
  motivo_bloqueio             privado.motivo_bloqueio_pagamento,
  liberado_em                 timestamptz,
  pago_em                     date,
  pago_por                    uuid references public.perfil(id),
  unique (acompanhamento_id, profissional_id),
  check ((status = 'bloqueado') = (motivo_bloqueio is not null)),
  check ((status = 'pago') = (pago_em is not null))
);
comment on table privado.pagamento_equipe is '[P46] Pagamento de uma profissional por acompanhamento: visitas realizadas × horas por visita × valor da hora, mais a ajuda de deslocamento (PRD 3.4). Nasce bloqueado e só é liberado depois de todas as evoluções do acompanhamento enviadas. Nunca editado à mão: privado.pagamento_equipe_sincronizar e api.pagar_equipe.';
comment on column privado.pagamento_equipe.motivo_bloqueio is 'Código do bloqueio: evolucao_nao_enviada ou sem_valor_hora (nem a profissional nem o parâmetro têm valor da hora).';
create index on privado.pagamento_equipe (profissional_id);
create index on privado.pagamento_equipe (criado_por);
create index on privado.pagamento_equipe (pago_por);

create table privado.despesa (
  id                   uuid primary key default gen_random_uuid(),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  criado_por           uuid references public.perfil(id),
  data                 date not null,
  competencia          date generated always as (data - (extract(day from data)::integer - 1)) stored,
  categoria            privado.categoria_despesa not null,
  descricao            text not null check (pg_catalog.btrim(descricao) <> '' and pg_catalog.char_length(descricao) <= 200),
  fornecedor           text check (fornecedor is null or pg_catalog.char_length(fornecedor) <= 120),
  valor_centavos       integer not null check (valor_centavos > 0),
  canal                public.origem_lead,
  pagamento_equipe_id  uuid unique references privado.pagamento_equipe(id),
  removida_em          timestamptz,
  removida_por         uuid references public.perfil(id),
  removida_motivo      text,
  check (canal is null or categoria = 'marketing_anuncios'),
  check ((removida_em is null) = (removida_motivo is null))
);
comment on table privado.despesa is '[P46] Despesa paga, por categoria (PRD 12, financeiro). Dinheiro em centavos, mês pela data (regime de caixa). canal: a origem do lead a que uma despesa de marketing se refere (custo por canal, P47 e P52). Despesa de pagamento da equipe nasce em api.pagar_equipe. Removida é registrada com motivo, nunca apagada.';
comment on column privado.despesa.competencia is 'Primeiro dia do mês da data (calculado).';
create index on privado.despesa (competencia);
create index on privado.despesa (criado_por);
create index on privado.despesa (removida_por);

create table privado.extrato_importacao (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  criado_por     uuid references public.perfil(id),
  arquivo_hash   text not null unique check (arquivo_hash ~ '^[0-9a-f]{64}$'),
  formato        text not null check (formato in ('ofx', 'csv')),
  linhas         integer not null default 0,
  linhas_novas   integer not null default 0,
  periodo_inicio date,
  periodo_fim    date
);
comment on table privado.extrato_importacao is '[P46] Um arquivo de extrato importado (OFX ou CSV, lido no servidor). Guarda só o sha256 do conteúdo (idempotência) e a contagem: nome do arquivo e conteúdo bruto não ficam.';
create index on privado.extrato_importacao (criado_por);

create table privado.extrato_linha (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  criado_por     uuid references public.perfil(id),
  importacao_id  uuid not null references privado.extrato_importacao(id),
  chave          text not null unique,
  data           date not null,
  valor_centavos integer not null check (valor_centavos <> 0),
  descricao      text not null check (pg_catalog.char_length(descricao) <= 200),
  documento      text check (documento is null or pg_catalog.char_length(documento) <= 80),
  situacao       privado.situacao_extrato not null default 'sem_correspondencia',
  cobranca_id    uuid references public.cobranca(id),
  despesa_id     uuid references privado.despesa(id),
  conferida_em   timestamptz,
  check (not (cobranca_id is not null and despesa_id is not null)),
  check ((situacao = 'sem_correspondencia') = (cobranca_id is null and despesa_id is null))
);
comment on table privado.extrato_linha is '[P46] Linha do extrato do banco. Positivo é crédito, negativo é débito. A conferência sugere o par (cobrança ou despesa) e nunca dá baixa: baixa é só pelo webhook ou pela baixa manual com comprovante (D-07). descricao e documento podem trazer nome de quem pagou: ocultos no log de auditoria.';
create index on privado.extrato_linha (importacao_id);
create index on privado.extrato_linha (cobranca_id);
create index on privado.extrato_linha (despesa_id);
create index on privado.extrato_linha (criado_por);
create index on privado.extrato_linha (data);

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['pagamento_equipe', 'despesa', 'extrato_importacao', 'extrato_linha'] loop
    execute pg_catalog.format('alter table privado.%I enable row level security', v_tabela);
    execute pg_catalog.format('revoke all on table privado.%I from public, anon, authenticated, service_role', v_tabela);
    execute pg_catalog.format(
      'create trigger tocar_atualizado_em before update on privado.%I for each row execute function privado.tocar_atualizado_em()',
      v_tabela);
    execute pg_catalog.format(
      'create trigger auditar after insert or update or delete on privado.%I for each row execute function privado.auditar(''id'')',
      v_tabela);
  end loop;
end $$;

-- Texto livre e identificadores de banco: "[oculto]" mais HMAC no log (mesma
-- lista de origem 'sessao_p05' para não mexer na restrição de fonte).
insert into privado.auditoria_coluna_sensivel (entidade, coluna, fonte) values
  ('privado.despesa', 'descricao', 'sessao_p05'),
  ('privado.despesa', 'fornecedor', 'sessao_p05'),
  ('privado.despesa', 'removida_motivo', 'sessao_p05'),
  ('privado.extrato_linha', 'descricao', 'sessao_p05'),
  ('privado.extrato_linha', 'documento', 'sessao_p05');


-- =============================================================================
-- 8. P46 · Pagamento da equipe
-- =============================================================================

-- Todas as evoluções do acompanhamento enviadas: a puerperal e uma neonatal
-- por bebê da família (PRD 6.5, 9.5).
create function privado.evolucoes_enviadas(acompanhamento_id uuid) returns boolean
  language sql
  stable
  set search_path = ''
  as $$
  select exists (
           select 1 from public.relatorio_medico r
           where r.acompanhamento_id = evolucoes_enviadas.acompanhamento_id
             and r.tipo = 'puerperal' and r.status = 'enviado' and r.enviado_em is not null)
     and not exists (
           select 1
           from public.acompanhamento a
           join public.bebe b on b.familia_id = a.familia_id
           where a.id = evolucoes_enviadas.acompanhamento_id
             and not exists (
               select 1 from public.relatorio_medico r
               where r.acompanhamento_id = a.id and r.tipo = 'neonatal' and r.bebe_id = b.id
                 and r.status = 'enviado' and r.enviado_em is not null))
$$;
comment on function privado.evolucoes_enviadas(uuid) is '[P46] Verdadeiro quando a evolução puerperal e a neonatal de cada bebê da família do acompanhamento estão com status enviado (PRD 3.4: o pagamento da equipe só é liberado depois do envio dos relatórios aos médicos). Sem grant.';

-- Cria e atualiza os pagamentos do que já foi realizado. Pago não muda mais.
create function privado.pagamento_equipe_sincronizar() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_cfg     jsonb;
  v_padrao  integer;
  v_dias    numeric;
  v_mudou   integer := 0;
  r         record;
  v_valor_h integer;
  v_horas   numeric;
  v_valor   integer;
  v_ajuda   integer;
  v_status  privado.status_pagamento_equipe;
  v_motivo  privado.motivo_bloqueio_pagamento;
  v_atual   privado.pagamento_equipe;
begin
  select p.valor into v_cfg from public.parametro p where p.chave = 'pagamento_equipe';
  if pg_catalog.jsonb_typeof(v_cfg -> 'valor_hora_padrao_centavos') = 'number' then
    v_padrao := (v_cfg ->> 'valor_hora_padrao_centavos')::numeric::integer;
  end if;
  if pg_catalog.jsonb_typeof(v_cfg -> 'dias_por_ajuda') = 'number' then
    v_dias := (v_cfg ->> 'dias_por_ajuda')::numeric;
  end if;

  for r in
    select v.acompanhamento_id, v.profissional_id, count(*)::integer as visitas,
           a.horas_por_visita, pr.valor_hora_centavos, pr.adicional_deslocamento_centavos
    from public.visita v
    join public.acompanhamento a on a.id = v.acompanhamento_id
    join public.profissional pr on pr.id = v.profissional_id
    where v.estado in ('concluida', 'ficha_pendente', 'ficha_entregue', 'encerrada')
    group by v.acompanhamento_id, v.profissional_id, a.horas_por_visita, pr.valor_hora_centavos,
             pr.adicional_deslocamento_centavos
  loop
    select pe.* into v_atual
    from privado.pagamento_equipe pe
    where pe.acompanhamento_id = r.acompanhamento_id and pe.profissional_id = r.profissional_id;
    if found and v_atual.status = 'pago' then
      continue;
    end if;

    v_valor_h := coalesce(r.valor_hora_centavos, v_padrao);
    v_horas := r.visitas * r.horas_por_visita;
    v_valor := case when v_valor_h is null then 0 else pg_catalog.round(v_horas * v_valor_h)::integer end;
    v_ajuda := case
                 when coalesce(r.adicional_deslocamento_centavos, 0) > 0 and coalesce(v_dias, 0) > 0
                   then pg_catalog.round(r.adicional_deslocamento_centavos * r.visitas / v_dias)::integer
                 else 0
               end;
    if v_valor_h is null then
      v_status := 'bloqueado'; v_motivo := 'sem_valor_hora';
    elsif not privado.evolucoes_enviadas(r.acompanhamento_id) then
      v_status := 'bloqueado'; v_motivo := 'evolucao_nao_enviada';
    else
      v_status := 'liberado'; v_motivo := null;
    end if;

    insert into privado.pagamento_equipe
      (acompanhamento_id, profissional_id, visitas, horas, valor_hora_centavos, valor_horas_centavos,
       ajuda_deslocamento_centavos, total_centavos, status, motivo_bloqueio, liberado_em)
    values
      (r.acompanhamento_id, r.profissional_id, r.visitas, v_horas, v_valor_h, v_valor, v_ajuda, v_valor + v_ajuda,
       v_status, v_motivo, case when v_status = 'liberado' then pg_catalog.clock_timestamp() end)
    on conflict (acompanhamento_id, profissional_id) do update
      set visitas = excluded.visitas,
          horas = excluded.horas,
          valor_hora_centavos = excluded.valor_hora_centavos,
          valor_horas_centavos = excluded.valor_horas_centavos,
          ajuda_deslocamento_centavos = excluded.ajuda_deslocamento_centavos,
          total_centavos = excluded.total_centavos,
          status = excluded.status,
          motivo_bloqueio = excluded.motivo_bloqueio,
          liberado_em = case
                          when excluded.status = 'liberado' then coalesce(privado.pagamento_equipe.liberado_em, excluded.liberado_em)
                          else null
                        end
      where (privado.pagamento_equipe.visitas, privado.pagamento_equipe.horas, privado.pagamento_equipe.valor_hora_centavos,
             privado.pagamento_equipe.total_centavos, privado.pagamento_equipe.status, privado.pagamento_equipe.motivo_bloqueio)
            is distinct from
            (excluded.visitas, excluded.horas, excluded.valor_hora_centavos, excluded.total_centavos,
             excluded.status, excluded.motivo_bloqueio);
    if found then
      v_mudou := v_mudou + 1;
    end if;
  end loop;
  return v_mudou;
end;
$$;
comment on function privado.pagamento_equipe_sincronizar() is '[P46] Cria e atualiza privado.pagamento_equipe a partir das visitas realizadas (concluida, ficha_pendente, ficha_entregue, encerrada): horas = visitas × horas_por_visita; valor = horas × valor da hora (da profissional ou parametro.pagamento_equipe); ajuda de deslocamento = adicional da profissional × visitas / dias_por_ajuda. Liberado só com as evoluções do acompanhamento enviadas; pago não muda mais. Devolve quantas linhas mudaram. Sem grant.';

create function privado.pagamento_equipe_json(p privado.pagamento_equipe, com_familia boolean) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', p.id,
    'acompanhamento_id', p.acompanhamento_id,
    'profissional_id', p.profissional_id,
    'profissional_nome', pr.nome,
    'familia_nome', case when pagamento_equipe_json.com_familia then f.nome_exibicao end,
    'visitas', p.visitas,
    'horas', p.horas,
    'valor_hora_centavos', p.valor_hora_centavos,
    'valor_horas_centavos', p.valor_horas_centavos,
    'ajuda_deslocamento_centavos', p.ajuda_deslocamento_centavos,
    'total_centavos', p.total_centavos,
    'status', p.status,
    'motivo_bloqueio', p.motivo_bloqueio,
    'pago_em', p.pago_em,
    'estado_acompanhamento', a.estado))
  from public.profissional pr, public.acompanhamento a, public.familia f
  where pr.id = p.profissional_id and a.id = p.acompanhamento_id and f.id = a.familia_id
$$;
comment on function privado.pagamento_equipe_json(privado.pagamento_equipe, boolean) is '[P46] Uma linha de pagamento da equipe em json; o nome da família só sai para o financeiro (com_familia). Sem grant.';

create function api.pagamentos_equipe(mes date default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_mes  date;
  v_fim  date;
  v_itens jsonb;
  v_resumo jsonb;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  v_mes := privado.inicio_do_mes(coalesce(pagamentos_equipe.mes, privado.hoje_sp()));
  v_fim := (v_mes + interval '1 month')::date;
  perform privado.pagamento_equipe_sincronizar();

  select coalesce(pg_catalog.jsonb_agg(privado.pagamento_equipe_json(p, true)
           order by (p.status = 'pago'), p.status, p.criado_em, p.id), '[]'::jsonb)
    into v_itens
  from privado.pagamento_equipe p
  where p.status <> 'pago' or (p.pago_em >= v_mes and p.pago_em < v_fim);

  select pg_catalog.jsonb_build_object(
           'mes', v_mes,
           'bloqueado_centavos', coalesce(sum(p.total_centavos) filter (where p.status = 'bloqueado'), 0),
           'bloqueado_qtd', count(*) filter (where p.status = 'bloqueado'),
           'liberado_centavos', coalesce(sum(p.total_centavos) filter (where p.status = 'liberado'), 0),
           'liberado_qtd', count(*) filter (where p.status = 'liberado'),
           'pago_no_mes_centavos', coalesce(sum(p.total_centavos) filter (where p.status = 'pago' and p.pago_em >= v_mes and p.pago_em < v_fim), 0),
           'pago_no_mes_qtd', count(*) filter (where p.status = 'pago' and p.pago_em >= v_mes and p.pago_em < v_fim))
    into v_resumo
  from privado.pagamento_equipe p;

  return pg_catalog.jsonb_build_object('resumo', v_resumo, 'pagamentos', v_itens);
end;
$$;
comment on function api.pagamentos_equipe(date) is '[P46] Pagamento da equipe: atualiza os cálculos a partir das visitas e das evoluções enviadas e lista o que está bloqueado, liberado e o que foi pago no mês (padrão o mês atual), com o resumo em centavos. Financeiro e diretoria, AAL2.';

create function api.pagar_equipe(pagamento_id uuid, data date default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_p    privado.pagamento_equipe;
  v_dia  date := coalesce(pagar_equipe.data, privado.hoje_sp());
  v_desp uuid;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  select p.* into v_p from privado.pagamento_equipe p where p.id = pagar_equipe.pagamento_id for update;
  if not found then
    perform privado.gestao_recusar('pagamento_inexistente');
  end if;
  if v_p.status = 'pago' then
    perform privado.gestao_recusar('pagamento_ja_pago');
  end if;
  if v_dia > privado.hoje_sp() then
    perform privado.gestao_recusar('data_futura');
  end if;

  -- reavalia na hora: a liberação vale no instante do pagamento
  perform privado.pagamento_equipe_sincronizar();
  select p.* into v_p from privado.pagamento_equipe p where p.id = pagar_equipe.pagamento_id;
  if v_p.status <> 'liberado' then
    perform privado.gestao_recusar('pagamento_bloqueado', v_p.motivo_bloqueio::text);
  end if;

  update privado.pagamento_equipe
     set status = 'pago', motivo_bloqueio = null, pago_em = v_dia, pago_por = auth.uid()
   where id = v_p.id;
  insert into privado.despesa (data, categoria, descricao, valor_centavos, pagamento_equipe_id, criado_por)
  values (v_dia, 'equipe_assistencial', 'Pagamento da equipe assistencial', v_p.total_centavos, v_p.id, auth.uid())
  returning id into v_desp;

  return pg_catalog.jsonb_build_object('pagamento_id', v_p.id, 'despesa_id', v_desp, 'total_centavos', v_p.total_centavos,
                                       'pago_em', v_dia);
end;
$$;
comment on function api.pagar_equipe(uuid, date) is '[P46] Registra o pagamento de uma profissional: só se estiver liberado (todas as evoluções do acompanhamento enviadas), reavaliado na hora. Bloqueado recusa com gestao:pagamento_bloqueado e o motivo. Cria a despesa equipe_assistencial do valor. Financeiro e diretoria, AAL2.';

create function api.meus_pagamentos() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_prof uuid;
begin
  perform privado.autorizar(array['enfermeira']::public.papel_usuario[], true);
  select pr.id into v_prof
  from public.profissional pr
  where pr.usuario_id = auth.uid() and pr.ativa
  limit 1;
  if v_prof is null then
    return pg_catalog.jsonb_build_object('pagamentos', '[]'::jsonb);
  end if;
  return pg_catalog.jsonb_build_object('pagamentos', coalesce((
    select pg_catalog.jsonb_agg(privado.pagamento_equipe_json(p, false) order by p.criado_em, p.id)
    from privado.pagamento_equipe p
    where p.profissional_id = v_prof), '[]'::jsonb));
end;
$$;
comment on function api.meus_pagamentos() is '[P46] A enfermeira lê só os próprios pagamentos (PRD 13, financeiro: "Próprios"), sem o nome da família. Enfermeira, AAL2.';


-- =============================================================================
-- 9. P46 · Receita, despesas, DRE, inadimplência e previsão
-- =============================================================================

-- Recebimentos do período: cobranças pagas (regime de caixa). Estornada não conta.
create function privado.receita_periodo(de date, ate_exclusivo date) returns bigint
  language sql
  stable
  set search_path = ''
  as $$
  select coalesce(sum(coalesce(c.valor_pago_centavos, c.valor_centavos)), 0)::bigint
  from public.cobranca c
  where c.status = 'paga'
    and (c.pago_em at time zone 'America/Sao_Paulo')::date >= receita_periodo.de
    and (c.pago_em at time zone 'America/Sao_Paulo')::date < receita_periodo.ate_exclusivo
$$;
comment on function privado.receita_periodo(date, date) is '[P46] Soma das cobranças pagas no período (data do pagamento em America/Sao_Paulo; valor pago, ou o valor da cobrança se o valor pago faltar). Fonte única da receita do DRE e do painel. Sem grant.';

create function privado.dre_mes(mes date) returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_mes   date := privado.inicio_do_mes(dre_mes.mes);
  v_fim   date := (privado.inicio_do_mes(dre_mes.mes) + interval '1 month')::date;
  v_rec   bigint;
  v_desp  bigint;
  v_cats  jsonb;
begin
  v_rec := privado.receita_periodo(v_mes, v_fim);
  select coalesce(sum(d.valor_centavos), 0)::bigint into v_desp
  from privado.despesa d
  where d.removida_em is null and d.data >= v_mes and d.data < v_fim;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'categoria', e.categoria,
           'centavos', coalesce((select sum(d.valor_centavos) from privado.despesa d
                                 where d.removida_em is null and d.data >= v_mes and d.data < v_fim
                                   and d.categoria = e.categoria), 0)) order by e.ordem)
    into v_cats
  from (select x.categoria, x.ordem
        from unnest(enum_range(null::privado.categoria_despesa)) with ordinality as x(categoria, ordem)) e;

  return pg_catalog.jsonb_build_object(
    'mes', v_mes,
    'regime', 'caixa',
    'receita_centavos', v_rec,
    'despesas_centavos', v_desp,
    'despesas_por_categoria', v_cats,
    'resultado_centavos', v_rec - v_desp,
    'margem_pct', case when v_rec > 0 then pg_catalog.round(100.0 * (v_rec - v_desp) / v_rec, 1) end);
end;
$$;
comment on function privado.dre_mes(date) is '[P46] DRE gerencial do mês em regime de caixa: receita (cobranças pagas), despesas por categoria (todas as categorias, mesmo com zero), resultado e margem (nula sem receita). Fonte única do DRE e do painel. Sem grant.';

create function api.dre(mes date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_mes   date;
  v_n     integer;
  v_serie jsonb;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  v_mes := privado.inicio_do_mes(coalesce(dre.mes, privado.hoje_sp()));
  v_n := ((select p.valor -> 'serie_meses' from public.parametro p where p.chave = 'financeiro') #>> '{}')::integer;
  if v_n is null or v_n < 1 then
    perform privado.gestao_recusar('parametro_ausente', 'financeiro.serie_meses');
  end if;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'mes', m.mes,
           'receita_centavos', (privado.dre_mes(m.mes) ->> 'receita_centavos')::bigint,
           'despesas_centavos', (privado.dre_mes(m.mes) ->> 'despesas_centavos')::bigint,
           'resultado_centavos', (privado.dre_mes(m.mes) ->> 'resultado_centavos')::bigint) order by m.mes)
    into v_serie
  from (select (v_mes - (g || ' months')::interval)::date as mes
        from pg_catalog.generate_series(0, v_n - 1) g) m;

  return privado.dre_mes(v_mes) || pg_catalog.jsonb_build_object('serie', v_serie);
end;
$$;
comment on function api.dre(date) is '[P46] DRE gerencial mensal (padrão o mês atual) mais a série dos últimos parametro.financeiro.serie_meses meses. Financeiro e diretoria, AAL2.';

create function api.lancamentos(mes date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_mes date;
  v_fim date;
  v_itens jsonb;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  v_mes := privado.inicio_do_mes(coalesce(lancamentos.mes, privado.hoje_sp()));
  v_fim := (v_mes + interval '1 month')::date;

  with l as (
    select 'receita'::text as tipo, c.id, (c.pago_em at time zone 'America/Sao_Paulo')::date as data,
           'cobranca'::text as categoria, f.nome_exibicao as descricao,
           coalesce(c.valor_pago_centavos, c.valor_centavos) as valor_centavos
    from public.cobranca c
    join public.contrato k on k.id = c.contrato_id
    join public.familia f on f.id = k.familia_id
    where c.status = 'paga'
      and (c.pago_em at time zone 'America/Sao_Paulo')::date >= v_mes
      and (c.pago_em at time zone 'America/Sao_Paulo')::date < v_fim
    union all
    select 'despesa', d.id, d.data, d.categoria::text, d.descricao, d.valor_centavos
    from privado.despesa d
    where d.removida_em is null and d.data >= v_mes and d.data < v_fim
  )
  select pg_catalog.jsonb_build_object(
           'mes', v_mes,
           'lancamentos', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'tipo', l.tipo, 'id', l.id, 'data', l.data, 'categoria', l.categoria, 'descricao', l.descricao,
             'valor_centavos', l.valor_centavos) order by l.data, l.tipo, l.id), '[]'::jsonb),
           'receitas_centavos', coalesce(sum(l.valor_centavos) filter (where l.tipo = 'receita'), 0),
           'despesas_centavos', coalesce(sum(l.valor_centavos) filter (where l.tipo = 'despesa'), 0),
           'saldo_centavos', coalesce(sum(case when l.tipo = 'receita' then l.valor_centavos else -l.valor_centavos end), 0))
    into v_itens
  from l;
  return v_itens;
end;
$$;
comment on function api.lancamentos(date) is '[P46] Os lançamentos do mês que compõem o DRE: cobranças pagas (receita, com o nome da família) e despesas (categoria e descrição), com os totais e o saldo somados linha a linha. Financeiro e diretoria, AAL2.';

create function api.despesas(mes date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_mes date;
  v_fim date;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  v_mes := privado.inicio_do_mes(coalesce(despesas.mes, privado.hoje_sp()));
  v_fim := (v_mes + interval '1 month')::date;
  return pg_catalog.jsonb_build_object(
    'mes', v_mes,
    'categorias', (select pg_catalog.jsonb_agg(x.categoria order by x.ordem)
                   from unnest(enum_range(null::privado.categoria_despesa)) with ordinality as x(categoria, ordem)),
    'despesas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', d.id, 'data', d.data, 'categoria', d.categoria, 'descricao', d.descricao,
               'fornecedor', d.fornecedor, 'valor_centavos', d.valor_centavos, 'canal', d.canal,
               'da_equipe', d.pagamento_equipe_id is not null) order by d.data desc, d.criado_em desc, d.id)
      from privado.despesa d
      where d.removida_em is null and d.data >= v_mes and d.data < v_fim), '[]'::jsonb),
    'total_centavos', coalesce((select sum(d.valor_centavos) from privado.despesa d
                                where d.removida_em is null and d.data >= v_mes and d.data < v_fim), 0));
end;
$$;
comment on function api.despesas(date) is '[P46] Despesas do mês (padrão o mês atual), com as categorias válidas e o total. Financeiro e diretoria, AAL2.';

create function api.salvar_despesa(
  despesa_id uuid,
  data date,
  categoria privado.categoria_despesa,
  descricao text,
  fornecedor text,
  valor_centavos integer,
  canal public.origem_lead default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_max  bigint;
  v_id   uuid;
  v_desc text := pg_catalog.btrim(coalesce(salvar_despesa.descricao, ''));
  v_forn text := nullif(pg_catalog.btrim(coalesce(salvar_despesa.fornecedor, '')), '');
  v_atual privado.despesa;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  v_max := ((select p.valor -> 'despesa_max_centavos' from public.parametro p where p.chave = 'financeiro') #>> '{}')::bigint;
  if v_max is null then
    perform privado.gestao_recusar('parametro_ausente', 'financeiro.despesa_max_centavos');
  end if;

  if salvar_despesa.data is null or salvar_despesa.categoria is null then
    perform privado.gestao_recusar('dados_incompletos');
  end if;
  if salvar_despesa.data > privado.hoje_sp() then
    perform privado.gestao_recusar('data_futura');
  end if;
  if v_desc = '' or pg_catalog.char_length(v_desc) > 200 then
    perform privado.gestao_recusar('descricao_invalida');
  end if;
  if salvar_despesa.valor_centavos is null or salvar_despesa.valor_centavos <= 0 or salvar_despesa.valor_centavos > v_max then
    perform privado.gestao_recusar('valor_invalido');
  end if;
  if salvar_despesa.canal is not null and salvar_despesa.categoria <> 'marketing_anuncios' then
    perform privado.gestao_recusar('canal_so_no_marketing');
  end if;

  if salvar_despesa.despesa_id is null then
    insert into privado.despesa (data, categoria, descricao, fornecedor, valor_centavos, canal, criado_por)
    values (salvar_despesa.data, salvar_despesa.categoria, v_desc, v_forn, salvar_despesa.valor_centavos,
            salvar_despesa.canal, auth.uid())
    returning id into v_id;
  else
    select d.* into v_atual from privado.despesa d where d.id = salvar_despesa.despesa_id for update;
    if not found then
      perform privado.gestao_recusar('despesa_inexistente');
    end if;
    if v_atual.removida_em is not null then
      perform privado.gestao_recusar('despesa_removida');
    end if;
    if v_atual.pagamento_equipe_id is not null then
      perform privado.gestao_recusar('despesa_da_equipe');
    end if;
    update privado.despesa
       set data = salvar_despesa.data, categoria = salvar_despesa.categoria, descricao = v_desc,
           fornecedor = v_forn, valor_centavos = salvar_despesa.valor_centavos, canal = salvar_despesa.canal
     where id = v_atual.id
    returning id into v_id;
  end if;
  return pg_catalog.jsonb_build_object('id', v_id);
end;
$$;
comment on function api.salvar_despesa(uuid, date, privado.categoria_despesa, text, text, integer, public.origem_lead) is '[P46] Lança (despesa_id nulo) ou corrige uma despesa paga: data até hoje, categoria do enum, descrição, valor em centavos até parametro.financeiro.despesa_max_centavos e, só no marketing, o canal. Despesa do pagamento da equipe não se edita. Financeiro e diretoria, AAL2.';

create function api.remover_despesa(despesa_id uuid, motivo text) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_atual  privado.despesa;
  v_motivo text := pg_catalog.btrim(coalesce(remover_despesa.motivo, ''));
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if pg_catalog.char_length(v_motivo) < 10 or pg_catalog.char_length(v_motivo) > 300 then
    perform privado.gestao_recusar('motivo_invalido');
  end if;
  select d.* into v_atual from privado.despesa d where d.id = remover_despesa.despesa_id for update;
  if not found then
    perform privado.gestao_recusar('despesa_inexistente');
  end if;
  if v_atual.removida_em is not null then
    perform privado.gestao_recusar('despesa_removida');
  end if;
  if v_atual.pagamento_equipe_id is not null then
    perform privado.gestao_recusar('despesa_da_equipe');
  end if;
  update privado.despesa
     set removida_em = pg_catalog.clock_timestamp(), removida_por = auth.uid(), removida_motivo = v_motivo
   where id = v_atual.id;
end;
$$;
comment on function api.remover_despesa(uuid, text) is '[P46] Tira uma despesa do DRE com o motivo (10 a 300 letras) e quem tirou; a linha continua no banco. Despesa do pagamento da equipe não se remove. Financeiro e diretoria, AAL2.';

create function api.inadimplencia() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_hoje    date := privado.hoje_sp();
  v_faixas  jsonb;
  v_lim     integer[];
  v_vencido bigint;
  v_qtd     integer;
  v_emitido bigint;
  v_itens   jsonb;
  v_buckets jsonb;
  v_resumo  jsonb;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  select p.valor -> 'faixas_inadimplencia_dias' into v_faixas from public.parametro p where p.chave = 'financeiro';
  if pg_catalog.jsonb_typeof(v_faixas) is distinct from 'array' or pg_catalog.jsonb_array_length(v_faixas) = 0 then
    perform privado.gestao_recusar('parametro_ausente', 'financeiro.faixas_inadimplencia_dias');
  end if;
  select pg_catalog.array_agg(x::integer order by x::integer)
    into v_lim
  from pg_catalog.jsonb_array_elements_text(v_faixas) x;

  v_resumo := privado.inadimplencia_resumo();
  v_vencido := (v_resumo ->> 'vencido_centavos')::bigint;
  v_qtd := (v_resumo ->> 'vencidas_qtd')::integer;
  v_emitido := (v_resumo ->> 'emitido_ate_hoje_centavos')::bigint;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', c.id, 'contrato_id', c.contrato_id, 'familia_id', k.familia_id, 'familia_nome', f.nome_exibicao,
           'parcela', c.parcela, 'valor_centavos', c.valor_centavos, 'vencimento', c.vencimento,
           'dias_atraso', v_hoje - c.vencimento) order by c.vencimento, c.id), '[]'::jsonb)
    into v_itens
  from public.cobranca c
  join public.contrato k on k.id = c.contrato_id
  join public.familia f on f.id = k.familia_id
  where c.status in ('aberta', 'vencida') and c.vencimento < v_hoje;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'de_dias', b.de, 'ate_dias', b.ate,
           'qtd', (select count(*) from public.cobranca c where c.status in ('aberta', 'vencida') and c.vencimento < v_hoje
                     and v_hoje - c.vencimento >= b.de and (b.ate is null or v_hoje - c.vencimento <= b.ate)),
           'centavos', coalesce((select sum(c.valor_centavos) from public.cobranca c
                                 where c.status in ('aberta', 'vencida') and c.vencimento < v_hoje
                                   and v_hoje - c.vencimento >= b.de and (b.ate is null or v_hoje - c.vencimento <= b.ate)), 0))
           order by b.de)
    into v_buckets
  from (
    select 1 as de, v_lim[1] as ate
    union all
    select v_lim[i - 1] + 1, v_lim[i] from pg_catalog.generate_series(2, coalesce(pg_catalog.array_length(v_lim, 1), 0)) i
    union all
    select v_lim[pg_catalog.array_length(v_lim, 1)] + 1, null
  ) b;

  return pg_catalog.jsonb_build_object(
    'em', v_hoje,
    'vencido_centavos', v_vencido,
    'vencidas_qtd', v_qtd,
    'emitido_ate_hoje_centavos', v_emitido,
    'taxa_pct', v_resumo -> 'taxa_pct',
    'faixas', v_buckets,
    'itens', v_itens);
end;
$$;
comment on function api.inadimplencia() is '[P46] Inadimplência de hoje: cobranças em aberto com vencimento passado (valor, quantidade, faixas de atraso de parametro.financeiro.faixas_inadimplencia_dias e a lista), e a taxa sobre o que já venceu ou foi pago (pagas mais em aberto com vencimento até hoje). Financeiro e diretoria, AAL2.';

create function privado.previsao_recebimentos() returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_hoje  date := privado.hoje_sp();
  v_mes   date := privado.inicio_do_mes(privado.hoje_sp());
  v_n     integer;
  v_meses jsonb;
  v_atras bigint;
begin
  v_n := ((select p.valor -> 'previsao_meses' from public.parametro p where p.chave = 'financeiro') #>> '{}')::integer;
  if v_n is null or v_n < 1 then
    perform privado.gestao_recusar('parametro_ausente', 'financeiro.previsao_meses');
  end if;
  select coalesce(sum(c.valor_centavos), 0)::bigint into v_atras
  from public.cobranca c where c.status in ('aberta', 'vencida') and c.vencimento < v_hoje;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'mes', m.mes,
           'qtd', (select count(*) from public.cobranca c
                    where c.status in ('aberta', 'vencida') and c.vencimento >= v_hoje
                      and c.vencimento >= m.mes and c.vencimento < (m.mes + interval '1 month')::date),
           'centavos', coalesce((select sum(c.valor_centavos) from public.cobranca c
                                  where c.status in ('aberta', 'vencida') and c.vencimento >= v_hoje
                                    and c.vencimento >= m.mes and c.vencimento < (m.mes + interval '1 month')::date), 0))
           order by m.mes)
    into v_meses
  from (select (v_mes + (g || ' months')::interval)::date as mes from pg_catalog.generate_series(0, v_n - 1) g) m;

  return pg_catalog.jsonb_build_object(
    'atrasadas_centavos', v_atras,
    'meses', v_meses,
    'a_vencer_centavos', (select coalesce(sum((x ->> 'centavos')::bigint), 0) from pg_catalog.jsonb_array_elements(v_meses) x));
end;
$$;
comment on function privado.previsao_recebimentos() is '[P46] Previsão de recebimentos: cobranças em aberto que vencem de hoje em diante, por mês, nos próximos parametro.financeiro.previsao_meses meses, mais o que já venceu e segue em aberto. Só cobrança existente: contrato assinado sem cobrança não entra. Fonte única da tela e do painel. Sem grant.';

create function api.previsao_recebimentos() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  return privado.previsao_recebimentos();
end;
$$;
comment on function api.previsao_recebimentos() is '[P46] Previsão de recebimentos por mês (cobranças em aberto) e o que já está atrasado. Financeiro e diretoria, AAL2.';


-- =============================================================================
-- 10. P46 · Conferência com o extrato do banco (nunca dá baixa)
-- =============================================================================

create function privado.extrato_conciliar(importacao_id uuid default null) returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_cfg      jsonb;
  v_janela   integer;
  v_sugestao integer;
  l          record;
  v_alvo     uuid;
  v_conf     integer := 0;
  v_sug      integer := 0;
  v_sem      integer := 0;
begin
  select p.valor into v_cfg from public.parametro p where p.chave = 'financeiro';
  v_janela := (v_cfg ->> 'janela_extrato_dias')::integer;
  v_sugestao := (v_cfg ->> 'janela_sugestao_dias')::integer;
  if v_janela is null or v_sugestao is null then
    perform privado.gestao_recusar('parametro_ausente', 'financeiro.janela_extrato_dias e janela_sugestao_dias');
  end if;

  for l in
    select x.* from privado.extrato_linha x
    where x.situacao <> 'conferida'
      and (extrato_conciliar.importacao_id is null or x.importacao_id = extrato_conciliar.importacao_id)
    order by x.data, x.criado_em, x.id
    for update
  loop
    v_alvo := null;
    if l.valor_centavos > 0 then
      -- 1. cobrança já paga com o mesmo valor, perto da data
      select c.id into v_alvo
      from public.cobranca c
      where c.status = 'paga'
        and coalesce(c.valor_pago_centavos, c.valor_centavos) = l.valor_centavos
        and abs(((c.pago_em at time zone 'America/Sao_Paulo')::date) - l.data) <= v_janela
        and not exists (select 1 from privado.extrato_linha o where o.cobranca_id = c.id and o.id <> l.id and o.situacao = 'conferida')
      order by abs(((c.pago_em at time zone 'America/Sao_Paulo')::date) - l.data), c.id
      limit 1;
      if v_alvo is not null then
        update privado.extrato_linha set situacao = 'conferida', cobranca_id = v_alvo, despesa_id = null,
               conferida_em = pg_catalog.clock_timestamp() where id = l.id;
        v_conf := v_conf + 1;
        continue;
      end if;
      -- 2. cobrança ainda em aberto com o mesmo valor: só sugere; a baixa é pelo webhook ou baixa manual
      select c.id into v_alvo
      from public.cobranca c
      where c.status in ('aberta', 'vencida')
        and c.valor_centavos = l.valor_centavos
        and l.data between c.vencimento - v_janela and c.vencimento + v_sugestao
        and not exists (select 1 from privado.extrato_linha o where o.cobranca_id = c.id and o.id <> l.id)
      order by abs(c.vencimento - l.data), c.id
      limit 1;
      if v_alvo is not null then
        update privado.extrato_linha set situacao = 'sugerida', cobranca_id = v_alvo, despesa_id = null,
               conferida_em = null where id = l.id;
        v_sug := v_sug + 1;
        continue;
      end if;
    else
      select d.id into v_alvo
      from privado.despesa d
      where d.removida_em is null
        and d.valor_centavos = -l.valor_centavos
        and abs(d.data - l.data) <= v_janela
        and not exists (select 1 from privado.extrato_linha o where o.despesa_id = d.id and o.id <> l.id)
      order by abs(d.data - l.data), d.id
      limit 1;
      if v_alvo is not null then
        update privado.extrato_linha set situacao = 'conferida', despesa_id = v_alvo, cobranca_id = null,
               conferida_em = pg_catalog.clock_timestamp() where id = l.id;
        v_conf := v_conf + 1;
        continue;
      end if;
    end if;
    update privado.extrato_linha set situacao = 'sem_correspondencia', cobranca_id = null, despesa_id = null,
           conferida_em = null where id = l.id;
    v_sem := v_sem + 1;
  end loop;
  return pg_catalog.jsonb_build_object('conferidas', v_conf, 'sugeridas', v_sug, 'sem_correspondencia', v_sem);
end;
$$;
comment on function privado.extrato_conciliar(uuid) is '[P46] Procura o par de cada linha do extrato ainda não conferida. Crédito: cobrança paga com o mesmo valor até janela_extrato_dias da data do pagamento (conferida); ou cobrança em aberto com o mesmo valor (sugerida, nunca baixada). Débito: despesa com o mesmo valor perto da data (conferida). Cada cobrança e cada despesa casa com uma linha só. Não altera cobrança nem despesa: baixa é só pelo webhook do meio de pagamento ou pela baixa manual com comprovante (D-07). Sem grant.';

create function api.importar_extrato(arquivo_hash text, formato text, linhas jsonb) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_max    integer;
  v_imp    privado.extrato_importacao;
  v_novas  integer := 0;
  v_total  integer;
  v_item   jsonb;
  v_ord    integer := 0;
  v_data   date;
  v_valor  integer;
  v_desc   text;
  v_doc    text;
  v_chave  text;
  v_ja     boolean := false;
  v_conf   jsonb;
  v_ini    date;
  v_fim    date;
  v_visto  jsonb := '{}'::jsonb;
  v_base   text;
  v_n      integer;
  v_ins    integer;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  v_max := ((select p.valor -> 'extrato_max_linhas' from public.parametro p where p.chave = 'financeiro') #>> '{}')::integer;
  if v_max is null then
    perform privado.gestao_recusar('parametro_ausente', 'financeiro.extrato_max_linhas');
  end if;
  if importar_extrato.arquivo_hash is null or importar_extrato.arquivo_hash !~ '^[0-9a-f]{64}$' then
    perform privado.gestao_recusar('arquivo_invalido');
  end if;
  if importar_extrato.formato is null or importar_extrato.formato not in ('ofx', 'csv') then
    perform privado.gestao_recusar('formato_invalido');
  end if;
  if pg_catalog.jsonb_typeof(importar_extrato.linhas) is distinct from 'array' then
    perform privado.gestao_recusar('linhas_invalidas');
  end if;
  v_total := pg_catalog.jsonb_array_length(importar_extrato.linhas);
  if v_total = 0 then
    perform privado.gestao_recusar('extrato_vazio');
  end if;
  if v_total > v_max then
    perform privado.gestao_recusar('extrato_grande_demais', v_max::text);
  end if;

  select i.* into v_imp from privado.extrato_importacao i where i.arquivo_hash = importar_extrato.arquivo_hash;
  if found then
    v_ja := true;
  else
    insert into privado.extrato_importacao (arquivo_hash, formato, linhas, criado_por)
    values (importar_extrato.arquivo_hash, importar_extrato.formato, v_total, auth.uid())
    returning * into v_imp;

    for v_item in select x from pg_catalog.jsonb_array_elements(importar_extrato.linhas) x loop
      begin
        v_data := (v_item ->> 'data')::date;
        v_valor := (v_item ->> 'valor_centavos')::integer;
      exception when others then
        perform privado.gestao_recusar('linha_invalida', (v_ord + 1)::text);
      end;
      v_desc := pg_catalog.left(pg_catalog.btrim(coalesce(v_item ->> 'descricao', '')), 200);
      v_doc := nullif(pg_catalog.left(pg_catalog.btrim(coalesce(v_item ->> 'documento', '')), 80), '');
      if v_data is null or v_valor is null or v_valor = 0 then
        perform privado.gestao_recusar('linha_invalida', (v_ord + 1)::text);
      end if;
      v_ord := v_ord + 1;
      -- linhas idênticas no mesmo arquivo continuam distintas (numeradas); em outro arquivo, repetem a chave
      v_base := pg_catalog.md5(v_data::text || '|' || v_valor::text || '|' || v_desc || '|' || coalesce(v_doc, ''));
      v_n := coalesce((v_visto ->> v_base)::integer, 0) + 1;
      v_visto := v_visto || pg_catalog.jsonb_build_object(v_base, v_n);
      v_chave := v_base || ':' || v_n::text;
      insert into privado.extrato_linha (importacao_id, chave, data, valor_centavos, descricao, documento, criado_por)
      values (v_imp.id, v_chave, v_data, v_valor, v_desc, v_doc, auth.uid())
      on conflict (chave) do nothing;
      get diagnostics v_ins = row_count;
      v_novas := v_novas + v_ins;
      v_ini := least(v_ini, v_data);
      v_fim := greatest(v_fim, v_data);
    end loop;
    update privado.extrato_importacao
       set linhas_novas = v_novas, periodo_inicio = v_ini, periodo_fim = v_fim
     where id = v_imp.id;
  end if;

  v_conf := privado.extrato_conciliar(v_imp.id);
  return pg_catalog.jsonb_build_object(
    'importacao_id', v_imp.id, 'ja_importado', v_ja,
    'linhas', v_imp.linhas, 'linhas_novas', case when v_ja then v_imp.linhas_novas else v_novas end,
    'conferencia', v_conf);
end;
$$;
comment on function api.importar_extrato(text, text, jsonb) is '[P46] Importa as linhas de um extrato já lido no servidor (data, valor em centavos com sinal, descrição, documento). Idempotente pelo sha256 do arquivo; linha que já veio em outro arquivo não duplica. Roda a conferência e devolve as contagens. Nunca dá baixa em cobrança. Financeiro e diretoria, AAL2.';

create function api.reconciliar_extrato(importacao_id uuid default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  return privado.extrato_conciliar(reconciliar_extrato.importacao_id);
end;
$$;
comment on function api.reconciliar_extrato(uuid) is '[P46] Refaz a conferência das linhas ainda não conferidas (por exemplo depois de uma baixa manual). Não altera cobrança nem despesa. Financeiro e diretoria, AAL2.';

create function api.extrato(importacao_id uuid default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  return pg_catalog.jsonb_build_object(
    'importacoes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', i.id, 'formato', i.formato, 'linhas', i.linhas, 'linhas_novas', i.linhas_novas,
               'periodo_inicio', i.periodo_inicio, 'periodo_fim', i.periodo_fim, 'importado_em', i.criado_em,
               'conferidas', (select count(*) from privado.extrato_linha x where x.importacao_id = i.id and x.situacao = 'conferida'),
               'sugeridas', (select count(*) from privado.extrato_linha x where x.importacao_id = i.id and x.situacao = 'sugerida'),
               'sem_correspondencia', (select count(*) from privado.extrato_linha x where x.importacao_id = i.id and x.situacao = 'sem_correspondencia'))
             order by i.criado_em desc, i.id)
      from privado.extrato_importacao i), '[]'::jsonb),
    'linhas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', x.id, 'importacao_id', x.importacao_id, 'data', x.data, 'valor_centavos', x.valor_centavos,
               'descricao', x.descricao, 'situacao', x.situacao,
               'cobranca_id', x.cobranca_id, 'cobranca_parcela', c.parcela, 'cobranca_situacao', c.status,
               'familia_nome', f.nome_exibicao,
               'despesa_id', x.despesa_id, 'despesa_descricao', d.descricao)
             order by x.data desc, x.id)
      from privado.extrato_linha x
      left join public.cobranca c on c.id = x.cobranca_id
      left join public.contrato k on k.id = c.contrato_id
      left join public.familia f on f.id = k.familia_id
      left join privado.despesa d on d.id = x.despesa_id
      where extrato.importacao_id is not null and x.importacao_id = extrato.importacao_id), '[]'::jsonb));
end;
$$;
comment on function api.extrato(uuid) is '[P46] Importações de extrato com as contagens por situação e, informada a importação, as linhas com o par sugerido ou conferido (cobrança com o nome da família, ou despesa). Financeiro e diretoria, AAL2.';


-- =============================================================================
-- 11. P52 · Painel executivo (diretoria, AAL2)
--
-- Cada número vem de uma função privado.painel_* que usa a mesma regra da
-- tela de origem (DRE, inadimplência, previsão e capacidade têm a função
-- própria acima; comercial, marketing, operação e experiência leem as tabelas
-- das telas de pipeline, sessões, contratos, agenda e pós-venda). A consulta
-- de cada número está em docs/painel/consultas.md e o teste 026 confere um a
-- um contra a tabela de origem.
-- =============================================================================

create function privado.inadimplencia_resumo() returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  with h as (select privado.hoje_sp() as dia),
  v as (
    select coalesce(sum(c.valor_centavos), 0)::bigint as vencido, count(*)::integer as qtd
    from public.cobranca c, h
    where c.status in ('aberta', 'vencida') and c.vencimento < h.dia
  ),
  e as (
    select (coalesce(sum(coalesce(c.valor_pago_centavos, c.valor_centavos)) filter (where c.status = 'paga'), 0)
            + coalesce(sum(c.valor_centavos) filter (where c.status in ('aberta', 'vencida')), 0))::bigint as emitido
    from public.cobranca c, h
    where c.vencimento <= h.dia and c.status in ('aberta', 'vencida', 'paga')
  )
  select pg_catalog.jsonb_build_object(
           'vencido_centavos', v.vencido,
           'vencidas_qtd', v.qtd,
           'emitido_ate_hoje_centavos', e.emitido,
           'taxa_pct', case when e.emitido > 0 then pg_catalog.round(100.0 * v.vencido / e.emitido, 1) end)
  from v, e
$$;
comment on function privado.inadimplencia_resumo() is '[P46, P52] Vencido em aberto, quantidade, emitido até hoje (pagas e em aberto com vencimento até hoje) e a taxa. Fonte única de api.inadimplencia e do painel. Sem grant.';

create function privado.painel_comercial(de date, ate_exclusivo date) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  with l as (
    select count(*)::integer as n
    from public.familia f
    where f.mesclada_em_id is null
      and (f.criado_em at time zone 'America/Sao_Paulo')::date >= painel_comercial.de
      and (f.criado_em at time zone 'America/Sao_Paulo')::date < painel_comercial.ate_exclusivo
  ),
  s as (
    select count(*)::integer as n
    from public.sessao_venda sv
    where sv.status = 'realizada'
      and (sv.realizada_em at time zone 'America/Sao_Paulo')::date >= painel_comercial.de
      and (sv.realizada_em at time zone 'America/Sao_Paulo')::date < painel_comercial.ate_exclusivo
  ),
  k as (
    select count(*)::integer as n,
           coalesce(sum(k.valor_centavos - k.desconto_centavos + k.taxa_deslocamento_centavos), 0)::bigint as total
    from public.contrato k
    where k.status = 'assinado'
      and (k.assinado_em at time zone 'America/Sao_Paulo')::date >= painel_comercial.de
      and (k.assinado_em at time zone 'America/Sao_Paulo')::date < painel_comercial.ate_exclusivo
  )
  select pg_catalog.jsonb_build_object(
           'leads', l.n,
           'sessoes_realizadas', s.n,
           'contratos_assinados', k.n,
           'conversao_pct', case when l.n > 0 then pg_catalog.round(100.0 * k.n / l.n, 1) end,
           'faturamento_centavos', k.total,
           'ticket_medio_centavos', case when k.n > 0 then pg_catalog.round(k.total::numeric / k.n)::bigint end)
  from l, s, k
$$;
comment on function privado.painel_comercial(date, date) is '[P52] Comercial do período: leads (famílias criadas, não mescladas), sessões de venda realizadas, contratos assinados, conversão (contratos sobre leads), faturamento (valor menos desconto mais taxa dos contratos assinados) e ticket médio. Sem grant.';

create function privado.painel_marketing(de date, ate_exclusivo date) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select pg_catalog.jsonb_build_object(
    'leads_por_origem', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('origem', t.origem, 'leads', t.n) order by t.n desc, t.origem::text)
      from (select f.origem, count(*)::integer as n
            from public.familia f
            where f.mesclada_em_id is null
              and (f.criado_em at time zone 'America/Sao_Paulo')::date >= painel_marketing.de
              and (f.criado_em at time zone 'America/Sao_Paulo')::date < painel_marketing.ate_exclusivo
            group by f.origem) t), '[]'::jsonb),
    'custo_por_canal', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('canal', t.canal, 'centavos', t.total) order by t.total desc, t.canal::text)
      from (select d.canal, sum(d.valor_centavos)::bigint as total
            from privado.despesa d
            where d.removida_em is null and d.categoria = 'marketing_anuncios'
              and d.data >= painel_marketing.de and d.data < painel_marketing.ate_exclusivo
            group by d.canal) t), '[]'::jsonb),
    'custo_total_centavos', coalesce((
      select sum(d.valor_centavos) from privado.despesa d
      where d.removida_em is null and d.categoria = 'marketing_anuncios'
        and d.data >= painel_marketing.de and d.data < painel_marketing.ate_exclusivo), 0)::bigint,
    'receita_por_origem', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('origem', t.origem, 'centavos', t.total) order by t.total desc, t.origem::text)
      from (select f.origem, sum(coalesce(c.valor_pago_centavos, c.valor_centavos))::bigint as total
            from public.cobranca c
            join public.contrato k on k.id = c.contrato_id
            join public.familia f on f.id = k.familia_id
            where c.status = 'paga'
              and (c.pago_em at time zone 'America/Sao_Paulo')::date >= painel_marketing.de
              and (c.pago_em at time zone 'America/Sao_Paulo')::date < painel_marketing.ate_exclusivo
            group by f.origem) t), '[]'::jsonb),
    'receita_por_campanha', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('campanha', t.campanha, 'centavos', t.total) order by t.total desc, t.campanha)
      from (select f.codigo_origem as campanha, sum(coalesce(c.valor_pago_centavos, c.valor_centavos))::bigint as total
            from public.cobranca c
            join public.contrato k on k.id = c.contrato_id
            join public.familia f on f.id = k.familia_id
            where c.status = 'paga' and f.codigo_origem is not null
              and (c.pago_em at time zone 'America/Sao_Paulo')::date >= painel_marketing.de
              and (c.pago_em at time zone 'America/Sao_Paulo')::date < painel_marketing.ate_exclusivo
            group by f.codigo_origem) t), '[]'::jsonb))
$$;
comment on function privado.painel_marketing(date, date) is '[P52] Marketing do período: leads por origem, custo por canal (despesas de marketing e anúncios com canal), receita por origem e por campanha (código de origem do link) das cobranças pagas. Só agregados, nenhum dado de família. Sem grant.';

create function privado.painel_operacao(de date, ate_exclusivo date) returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_hoje  date := privado.hoje_sp();
  v_n     integer := privado.parametro_numero('capacidade_semanas_painel')::integer;
  v_cap   jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'regiao', c.regiao, 'semana', c.semana, 'ocupacao_pct', c.ocupacao_pct,
           'prob_excesso_pct', c.prob_excesso_pct, 'cobertura', c.cobertura, 'nivel', c.nivel)
           order by c.regiao, c.semana), '[]'::jsonb)
    into v_cap
  from privado.capacidade_semanal(pg_catalog.date_trunc('week', v_hoje)::date, pg_catalog.date_trunc('week', v_hoje)::date + (v_n * 7 - 1)) c;

  return pg_catalog.jsonb_build_object(
    'familias_ativas', (select count(distinct a.familia_id)::integer from public.acompanhamento a
                        where a.estado in ('ativo', 'em_execucao', 'ultima_visita_realizada', 'pendencias')),
    'familias_iniciadas', (select count(distinct a.familia_id)::integer from public.acompanhamento a
                           where a.inicio_efetivo >= painel_operacao.de and a.inicio_efetivo < painel_operacao.ate_exclusivo),
    'visitas_realizadas', (select count(*)::integer from public.visita v
                           where v.estado in ('concluida', 'ficha_pendente', 'ficha_entregue', 'encerrada')
                             and v.data >= painel_operacao.de and v.data < painel_operacao.ate_exclusivo),
    'ocorrencias_abertas', (select count(*)::integer from public.ocorrencia o
                            where o.status not in ('resolvida', 'encerrada')),
    'capacidade_semanas', v_n,
    'capacidade', v_cap,
    'semanas_em_sobrevenda', (select count(*)::integer from pg_catalog.jsonb_array_elements(v_cap) x where x ->> 'nivel' = 'sobrevenda'),
    'semanas_em_atencao', (select count(*)::integer from pg_catalog.jsonb_array_elements(v_cap) x where x ->> 'nivel' = 'atencao'));
end;
$$;
comment on function privado.painel_operacao(date, date) is '[P52] Operação: famílias em atendimento agora, famílias que iniciaram no período (inicio_efetivo), visitas realizadas no período, ocorrências abertas e a capacidade das próximas semanas (privado.capacidade_semanal). Sem grant.';

create function privado.painel_experiencia(de date, ate_exclusivo date) returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_min   integer := ((select p.valor -> 'nps_amostra_minima' from public.parametro p where p.chave = 'painel_executivo') #>> '{}')::integer;
  v_resp  integer;
  v_prom  integer;
  v_detr  integer;
begin
  if v_min is null then
    perform privado.gestao_recusar('parametro_ausente', 'painel_executivo.nps_amostra_minima');
  end if;
  select count(*)::integer,
         count(*) filter (where pv.classificacao = 'promotor')::integer,
         count(*) filter (where pv.classificacao = 'detrator')::integer
    into v_resp, v_prom, v_detr
  from public.pos_venda pv
  where pv.nps is not null and pv.classificacao is not null
    and (pv.pesquisa_respondida_em at time zone 'America/Sao_Paulo')::date >= painel_experiencia.de
    and (pv.pesquisa_respondida_em at time zone 'America/Sao_Paulo')::date < painel_experiencia.ate_exclusivo;

  return pg_catalog.jsonb_build_object(
    'respostas', v_resp,
    'promotores', v_prom,
    'detratores', v_detr,
    'amostra_minima', v_min,
    'nps', case when v_resp >= v_min and v_resp > 0 then pg_catalog.round(100.0 * (v_prom - v_detr) / v_resp)::integer end,
    'indicacoes', (select count(*)::integer from public.familia f
                   where f.mesclada_em_id is null
                     and f.origem in ('indicacao_medica', 'indicacao_cliente', 'indicacao_amigo')
                     and (f.criado_em at time zone 'America/Sao_Paulo')::date >= painel_experiencia.de
                     and (f.criado_em at time zone 'America/Sao_Paulo')::date < painel_experiencia.ate_exclusivo),
    'depoimentos', (select count(*)::integer from public.pos_venda pv
                    where pv.depoimento_autorizado is true
                      and (pv.pesquisa_respondida_em at time zone 'America/Sao_Paulo')::date >= painel_experiencia.de
                      and (pv.pesquisa_respondida_em at time zone 'America/Sao_Paulo')::date < painel_experiencia.ate_exclusivo));
end;
$$;
comment on function privado.painel_experiencia(date, date) is '[P52] Experiência do período: respostas da pesquisa com NPS e classificação, promotores, detratores, NPS (promotores menos detratores sobre as respostas, só com o mínimo de painel_executivo.nps_amostra_minima), indicações (famílias com origem de indicação) e depoimentos autorizados. Sem grant.';

create function privado.painel_financeiro(mes date) returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_dre  jsonb := privado.dre_mes(painel_financeiro.mes);
  v_inad jsonb := privado.inadimplencia_resumo();
  v_prev jsonb := privado.previsao_recebimentos();
begin
  return pg_catalog.jsonb_build_object(
    'recebimentos_centavos', v_dre -> 'receita_centavos',
    'custos_centavos', v_dre -> 'despesas_centavos',
    'resultado_centavos', v_dre -> 'resultado_centavos',
    'margem_pct', v_dre -> 'margem_pct',
    'inadimplencia_pct', v_inad -> 'taxa_pct',
    'vencido_centavos', v_inad -> 'vencido_centavos',
    'previsao_a_vencer_centavos', v_prev -> 'a_vencer_centavos',
    'previsao_atrasadas_centavos', v_prev -> 'atrasadas_centavos');
end;
$$;
comment on function privado.painel_financeiro(date) is '[P52] Financeiro do mês: recebimentos, custos, resultado e margem do DRE (privado.dre_mes), inadimplência (privado.inadimplencia_resumo) e previsão de recebimentos (privado.previsao_recebimentos). Sem grant.';

create function api.painel_executivo(mes date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_hoje  date := privado.hoje_sp();
  v_mes   date;
  v_fim   date;
  v_metas jsonb;
  v_cong  jsonb;
  v_com   jsonb;
  v_ope   jsonb;
  v_exp   jsonb;
  v_fin   jsonb;
begin
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);
  v_mes := privado.inicio_do_mes(coalesce(painel_executivo.mes, v_hoje));
  v_fim := (v_mes + interval '1 month')::date;

  select p.valor into v_metas from public.parametro p where p.chave = 'metas_kraamzorg';
  if v_metas is null then
    perform privado.gestao_recusar('parametro_ausente', 'metas_kraamzorg');
  end if;
  select p.valor into v_cong from public.parametro p where p.chave = 'congelamento_desenvolvimento';

  v_com := privado.painel_comercial(v_mes, v_fim);
  v_ope := privado.painel_operacao(v_mes, v_fim);
  v_exp := privado.painel_experiencia(v_mes, v_fim);
  v_fin := privado.painel_financeiro(v_mes) || pg_catalog.jsonb_build_object('faturamento_centavos', v_com -> 'faturamento_centavos');

  return pg_catalog.jsonb_build_object(
    'gerado_em', pg_catalog.clock_timestamp(),
    'mes', v_mes,
    'metas', v_metas,
    'progresso', pg_catalog.jsonb_build_object(
      'contratos', v_com -> 'contratos_assinados',
      'familias', v_ope -> 'familias_iniciadas',
      'faturamento_centavos', v_com -> 'faturamento_centavos',
      'nps', v_exp -> 'nps'),
    'congelamento', case when v_cong is null then null
                         else v_cong || pg_catalog.jsonb_build_object(
                           'dias_restantes', ((v_cong ->> 'data')::date - v_hoje)) end,
    'comercial', v_com,
    'marketing', privado.painel_marketing(v_mes, v_fim),
    'operacao', v_ope,
    'experiencia', v_exp,
    'financeiro', v_fin);
end;
$$;
comment on function api.painel_executivo(date) is '[P52] Painel da diretoria para o mês (padrão o atual): as cinco perguntas executivas (comercial, marketing, operação, experiência e financeiro), as metas da Kraamzorg (parametro.metas_kraamzorg) com o progresso e a contagem do congelamento. Cada número usa a regra da tela de origem (docs/painel/consultas.md). Só diretoria, AAL2; nenhum dado assistencial.';


-- =============================================================================
-- 12. Execute: internas sem grant, api só para authenticated (a função confere
--     o papel e o AAL por dentro)
-- =============================================================================

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'privado.capacidade_modelo()',
    'privado.distribuicao_nascimento()',
    'privado.distribuicao_nascimento_info()',
    'privado.capacidade_cenarios()',
    'privado.poisson_binomial(numeric[])',
    'privado.parametro_numero(text)',
    'privado.capacidade_semanal(date, date, uuid)',
    'privado.gestao_recusar(text, text)',
    'privado.hoje_sp()',
    'privado.inicio_do_mes(date)',
    'privado.evolucoes_enviadas(uuid)',
    'privado.pagamento_equipe_sincronizar()',
    'privado.pagamento_equipe_json(privado.pagamento_equipe, boolean)',
    'privado.receita_periodo(date, date)',
    'privado.dre_mes(date)',
    'privado.previsao_recebimentos()',
    'privado.extrato_conciliar(uuid)',
    'privado.inadimplencia_resumo()',
    'privado.painel_comercial(date, date)',
    'privado.painel_marketing(date, date)',
    'privado.painel_operacao(date, date)',
    'privado.painel_experiencia(date, date)',
    'privado.painel_financeiro(date)'
  ] loop
    execute pg_catalog.format('revoke execute on function %s from public, anon, authenticated, service_role', v_fn);
  end loop;

  foreach v_fn in array array[
    'api.capacidade(integer)',
    'api.pagamentos_equipe(date)',
    'api.pagar_equipe(uuid, date)',
    'api.meus_pagamentos()',
    'api.dre(date)',
    'api.lancamentos(date)',
    'api.despesas(date)',
    'api.salvar_despesa(uuid, date, privado.categoria_despesa, text, text, integer, public.origem_lead)',
    'api.remover_despesa(uuid, text)',
    'api.inadimplencia()',
    'api.previsao_recebimentos()',
    'api.importar_extrato(text, text, jsonb)',
    'api.reconciliar_extrato(uuid)',
    'api.extrato(uuid)',
    'api.painel_executivo(date)'
  ] loop
    execute pg_catalog.format('revoke execute on function %s from public, anon, service_role', v_fn);
    execute pg_catalog.format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;
