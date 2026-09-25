-- =============================================================================
-- 0011_ocupacao.sql
--
-- P19 (PROMPTS.md v2), parte de banco · PRD 3.4, 6.9, 10.2, 11.9
-- (verificar_disponibilidade), 22.2 (C-03)
--
-- O que esta migration faz:
--   1. View public.ocupacao_projetada (security_invoker, PRD 6.9): para
--      cada contrato ativo, o início do atendimento distribuído de forma
--      uniforme na janela da DPP (parametro.janela_dpp_dias), os dias de
--      atendimento somados por semana (segunda-feira) e região e divididos
--      pela capacidade (limite de famílias da região vezes os sete dias da
--      semana). Saída: região, semana, ocupação em %, famílias.
--   2. privado.disponibilidade(dpp, regiao_id): 'disponivel' quando todas
--      as semanas prováveis estão abaixo do limite de alerta
--      (parametro.capacidade_alerta_pct) e 'confirmar_com_equipe' no
--      resto. É a base de agente.verificar_disponibilidade (P21) e do
--      componente dpp_com_capacidade da pontuação (0010).
--   3. privado.recalculo_diario(): o recálculo do PRD 10.2, agendado no
--      pg_cron às 10:00 UTC (7h em Brasília). Cada módulo registra a
--      própria etapa numa função privado.recalculo_<etapa>(); a que ainda
--      não existe fica registrada como etapa vazia. O resultado de cada
--      rodada fica em privado.recalculo_execucao e privado.recalculo_etapa.
--
-- Leituras adotadas (a mais segura, registradas no relatório da sessão):
--   * "Contrato ativo" = contrato fora de cancelado e distrato, de família
--     não mesclada, cujo acompanhamento (se já existe) não terminou
--     (encerrado ou interrompido). Rascunho e contrato enviado contam: para
--     a capacidade, na dúvida a vaga está ocupada (o erro caro é a
--     sobrevenda).
--   * Fato vence estimativa: com início conhecido (acompanhamento.
--     inicio_efetivo, familia.data_inicio_efetivo ou familia.data_alta, que
--     é quando o atendimento começa, PRD 6.10 regra 3), o início é esse, com
--     peso 1. Sem ele, uniforme na janela da DPP; com o nascimento já
--     registrado, a janela começa no nascimento (o atendimento não começa
--     antes dele).
--   * Os dias contratados são corridos a partir do início (atendimento
--     diário) e vêm de acompanhamento.dias_contratados, ou do pacote do
--     contrato enquanto o acompanhamento não existe.
--   * Capacidade = limite_familias_semana × 7 (dias da semana, calendário).
--   * Semanas prováveis de uma DPP nova (disponibilidade): da semana de
--     (dpp − antes) até a semana de (dpp + depois + dias do maior pacote
--     ativo − 1). Disponível só se TODAS estão abaixo do limite de alerta.
--     Sem DPP, sem região, região inativa ou sem limite, ou parâmetro
--     ausente: confirmar_com_equipe (o agente nunca promete vaga sem dado).
--
-- Parâmetros lidos (o P08 semeia):
--   janela_dpp_dias             {"antes": 21, "depois": 14} (PRD 10.2; o
--                               mesmo parâmetro de privado.status_profissional, 0007)
--   capacidade_alerta_pct       85 (PRD 3.4, "limite de alerta de ocupação"; mesmo nome do seed do P08)
-- =============================================================================


-- =============================================================================
-- 1. public.ocupacao_projetada (PRD 6.9 e 10.2)
--
-- security_invoker: quem consulta a view passa pela RLS de contrato,
-- familia, acompanhamento e parametro. Sem grant para anon nem para
-- authenticated (default privileges da 0007): quem lê são as funções
-- security definer (disponibilidade, recálculo, e o radar da tela do P19,
-- que publica o recorte por api).
--
-- Colunas: regiao_id, regiao (nome), semana (segunda-feira),
-- ocupacao_pct (1 casa decimal; nula se a região não tem limite),
-- familias (famílias com chance de atendimento na semana),
-- dias_atendimento (soma esperada de dias de atendimento na semana) e
-- capacidade_dias (limite × 7).
-- =============================================================================

create view public.ocupacao_projetada with (security_invoker = true) as
with janela as (
  select (p.valor ->> 'antes')::numeric::integer  as antes,
         (p.valor ->> 'depois')::numeric::integer as depois
  from public.parametro p
  where p.chave = 'janela_dpp_dias'
    and pg_catalog.jsonb_typeof(p.valor -> 'antes') = 'number'
    and pg_catalog.jsonb_typeof(p.valor -> 'depois') = 'number'
),
contratos as (
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
    and (a.estado is null or a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico'))
),
inicios as (
  -- início conhecido (fato): um só, com peso 1
  select ct.familia_id, ct.regiao_id, ct.dias, ct.inicio_fato as inicio, 1::numeric as peso
  from contratos ct
  where ct.inicio_fato is not null
  union all
  -- estimativa: uniforme na janela da DPP (a partir do nascimento, se já nasceu)
  select ct.familia_id, ct.regiao_id, ct.dias, (jn.ini + s.n)::date as inicio,
         1::numeric / (jn.fim - jn.ini + 1) as peso
  from contratos ct
  cross join janela j
  cross join lateral (
    select greatest(ct.dpp - j.antes, coalesce(ct.data_nascimento, ct.dpp - j.antes))  as ini,
           greatest(ct.dpp + j.depois, coalesce(ct.data_nascimento, ct.dpp + j.depois)) as fim
  ) jn
  cross join lateral pg_catalog.generate_series(0, jn.fim - jn.ini) as s(n)
  where ct.inicio_fato is null
    and ct.dpp is not null
),
dias as (
  select i.familia_id, i.regiao_id, (i.inicio + d.n)::date as dia, i.peso
  from inicios i
  cross join lateral pg_catalog.generate_series(0, i.dias - 1) as d(n)
  where i.regiao_id is not null
)
select r.id                                                   as regiao_id,
       r.nome                                                 as regiao,
       pg_catalog.date_trunc('week', dd.dia)::date            as semana,
       pg_catalog.round(100 * sum(dd.peso) / nullif(r.limite_familias_semana * 7, 0), 1) as ocupacao_pct,
       count(distinct dd.familia_id)::integer                 as familias,
       pg_catalog.round(sum(dd.peso), 2)                      as dias_atendimento,
       r.limite_familias_semana * 7                           as capacidade_dias
from dias dd
join public.regiao r on r.id = dd.regiao_id
group by r.id, r.nome, r.limite_familias_semana, pg_catalog.date_trunc('week', dd.dia)::date;

comment on view public.ocupacao_projetada is 'Ocupação projetada por região e semana (PRD 6.9, 10.2, versão da Fase 1): contratos fora de cancelado e distrato, início conhecido (inicio_efetivo, data_alta) ou uniforme na janela de parametro.janela_dpp_dias (a partir do nascimento, se já nasceu), dias corridos do acompanhamento ou do pacote, somados por semana (segunda-feira) e divididos por limite_familias_semana × 7. security_invoker; sem grant: lida por funções security definer.';

revoke all on public.ocupacao_projetada from anon, authenticated;


-- =============================================================================
-- 2. privado.disponibilidade(dpp, regiao_id) (PRD 10.2, 11.9)
--
-- Nunca expõe números: devolve só 'disponivel' ou 'confirmar_com_equipe'.
-- =============================================================================

create function privado.disponibilidade(dpp date, regiao_id uuid) returns text
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
comment on function privado.disponibilidade(date, uuid) is 'Disponibilidade para uma DPP numa região (PRD 10.2, 11.9): disponivel quando todas as semanas prováveis (janela de parametro.janela_dpp_dias mais os dias do maior pacote ativo) estão abaixo de parametro.capacidade_alerta_pct em public.ocupacao_projetada; confirmar_com_equipe no resto, inclusive sem DPP, sem região ou sem parâmetro. Nunca devolve números. Sem grant: base de agente.verificar_disponibilidade (P21).';


-- =============================================================================
-- 3. Recálculo diário (PRD 10.2)
-- =============================================================================

-- --- 3.1 Registro de cada rodada -------------------------------------------------
-- Tabelas internas (schema privado, sem grant, RLS ligada e sem política):
-- a leitura para /api/saude e para a tela da diretoria vem por função, na
-- sessão que fizer a tela (P14, P19).
create type privado.status_recalculo as enum ('em_andamento', 'concluido', 'concluido_com_erro');
create type privado.status_etapa_recalculo as enum ('ok', 'vazia', 'erro');

create table privado.recalculo_execucao (
  id            bigserial primary key,
  iniciado_em   timestamptz not null default pg_catalog.clock_timestamp(),
  concluido_em  timestamptz,
  origem        text,                                    -- 'cron' ou quem chamou (app.origem)
  status        privado.status_recalculo not null default 'em_andamento'
);
comment on table privado.recalculo_execucao is 'Uma linha por rodada do recálculo diário (PRD 10.2): início, fim, origem e status. Etapas em privado.recalculo_etapa.';

create table privado.recalculo_etapa (
  id            bigserial primary key,
  execucao_id   bigint not null references privado.recalculo_execucao(id),
  ordem         integer not null,
  etapa         text not null,
  status        privado.status_etapa_recalculo not null,
  iniciado_em   timestamptz not null,
  concluido_em  timestamptz not null,
  resultado     jsonb not null default '{}'::jsonb,        -- só contagens e números, nunca dado pessoal
  erro          text,
  unique (execucao_id, etapa)
);
comment on table privado.recalculo_etapa is 'Resultado de cada etapa do recálculo diário (PRD 10.2): ok, vazia (módulo ainda não existe) ou erro, com o resultado em jsonb (só contagens e números).';

create index on privado.recalculo_etapa (execucao_id);

alter table privado.recalculo_execucao enable row level security;
alter table privado.recalculo_etapa enable row level security;
revoke all on privado.recalculo_execucao, privado.recalculo_etapa from public, anon, authenticated, service_role;
revoke all on sequence privado.recalculo_execucao_id_seq, privado.recalculo_etapa_id_seq from public, anon, authenticated, service_role;

-- --- 3.2 Etapas deste arquivo --------------------------------------------------------

-- Idade gestacional de toda família com DPP (10.2). A IG nunca é gravada
-- (6.10 regra 7): a etapa só conta as famílias por faixa de semanas, para o
-- registro mostrar que o cálculo rodou.
create function privado.recalculo_idade_gestacional() returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  with hoje as (select (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date as dia)
  select pg_catalog.jsonb_build_object(
           'familias_com_dpp', count(*),
           'sem_nascimento', count(*) filter (where f.data_nascimento is null),
           'dpp_passada_sem_nascimento', count(*) filter (where f.data_nascimento is null and f.dpp < hoje.dia))
  from public.familia f
  cross join hoje
  where f.dpp is not null and f.mesclada_em_id is null
$$;
comment on function privado.recalculo_idade_gestacional() is 'Etapa idade_gestacional do recálculo diário (PRD 10.2): a IG é calculada, nunca gravada; devolve só contagens. Sem grant.';

-- Ocupação projetada por região e semana (10.2): grava a foto das semanas
-- de hoje em diante e as que passam do limite de alerta. O alerta à
-- diretoria (automação sobrevenda, 10.1) é ação do motor (P20), que lê
-- esta etapa.
create function privado.recalculo_ocupacao() returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_hoje    date := (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_limite  jsonb;
  v_pct     numeric;
  v_semanas jsonb;
  v_acima   jsonb;
begin
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
end;
$$;
comment on function privado.recalculo_ocupacao() is 'Etapa ocupacao do recálculo diário (PRD 10.2): foto de public.ocupacao_projetada de hoje em diante e semanas acima de parametro.capacidade_alerta_pct (nulo se o parâmetro faltar). Sem grant.';

-- --- 3.3 privado.recalculo_diario() ------------------------------------------------------
-- Etapas na ordem do PRD 10.2. Cada uma é a função privado.recalculo_<etapa>()
-- do módulo que a implementa; se ela ainda não existe, a etapa fica
-- registrada como 'vazia'. Cada etapa roda num bloco próprio: um erro vira
-- 'erro' com o código e a mensagem, desfaz só o que aquela etapa gravou, e
-- as seguintes rodam do mesmo jeito.
--   idade_gestacional   esta migration
--   ocupacao            esta migration
--   score               0010 (P17)
--   regua_nutricao      P20
--   alertas_dpp         P20 (checkin_dpp, dpp_sem_confirmacao, dpp_sem_contato)
--   ficha_pendente      P20 e P39
--   prazo_relatorio     P20 e P41
--   documentos_vencendo P20
--   alerta_34s          P20
create function privado.recalculo_diario() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  c_etapas constant text[] := array['idade_gestacional', 'ocupacao', 'score', 'regua_nutricao', 'alertas_dpp',
                                    'ficha_pendente', 'prazo_relatorio', 'documentos_vencendo', 'alerta_34s'];
  v_execucao bigint;
  v_etapa    text;
  v_ordem    integer := 0;
  v_ini      timestamptz;
  v_res      jsonb;
  v_estado   text;
  v_msg      text;
  v_erros    integer := 0;
  v_resumo   jsonb := '{}'::jsonb;
begin
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'cron', true);
  end if;

  insert into privado.recalculo_execucao (origem) values (privado.origem_atual())
  returning id into v_execucao;

  foreach v_etapa in array c_etapas loop
    v_ordem := v_ordem + 1;
    v_ini := pg_catalog.clock_timestamp();

    if pg_catalog.to_regprocedure('privado.recalculo_' || v_etapa || '()') is null then
      insert into privado.recalculo_etapa (execucao_id, ordem, etapa, status, iniciado_em, concluido_em)
      values (v_execucao, v_ordem, v_etapa, 'vazia', v_ini, pg_catalog.clock_timestamp());
      v_resumo := v_resumo || pg_catalog.jsonb_build_object(v_etapa, 'vazia');
      continue;
    end if;

    begin
      execute pg_catalog.format('select privado.%I()', 'recalculo_' || v_etapa) into v_res;
      insert into privado.recalculo_etapa (execucao_id, ordem, etapa, status, iniciado_em, concluido_em, resultado)
      values (v_execucao, v_ordem, v_etapa, 'ok', v_ini, pg_catalog.clock_timestamp(), coalesce(v_res, '{}'::jsonb));
      v_resumo := v_resumo || pg_catalog.jsonb_build_object(v_etapa, 'ok');
    exception
      when others then
        get stacked diagnostics v_estado = returned_sqlstate, v_msg = message_text;
        insert into privado.recalculo_etapa (execucao_id, ordem, etapa, status, iniciado_em, concluido_em, erro)
        values (v_execucao, v_ordem, v_etapa, 'erro', v_ini, pg_catalog.clock_timestamp(), v_estado || ': ' || v_msg);
        v_resumo := v_resumo || pg_catalog.jsonb_build_object(v_etapa, 'erro');
        v_erros := v_erros + 1;
    end;
  end loop;

  update privado.recalculo_execucao e
     set concluido_em = pg_catalog.clock_timestamp(),
         status = case when v_erros > 0 then 'concluido_com_erro'::privado.status_recalculo
                       else 'concluido'::privado.status_recalculo end
   where e.id = v_execucao;

  return pg_catalog.jsonb_build_object('execucao_id', v_execucao, 'erros', v_erros, 'etapas', v_resumo);
end;
$$;
comment on function privado.recalculo_diario() is 'Recálculo diário (PRD 10.2), no pg_cron às 10:00 UTC (7h em Brasília): roda as etapas privado.recalculo_<etapa>() na ordem do PRD; etapa sem função fica vazia; erro de uma etapa é registrado e não para as outras. Resultado em privado.recalculo_execucao e privado.recalculo_etapa. Sem grant: só o cron (postgres) chama.';

revoke execute on function privado.disponibilidade(date, uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.recalculo_idade_gestacional() from public, anon, authenticated, service_role;
revoke execute on function privado.recalculo_ocupacao() from public, anon, authenticated, service_role;
revoke execute on function privado.recalculo_diario() from public, anon, authenticated, service_role;

-- --- 3.4 Agendamento no pg_cron ------------------------------------------------------------
-- 10:00 UTC = 7h em Brasília (PRD 10.2; o pg_cron do Supabase roda em UTC).
-- cron.schedule com nome atualiza o job se ele já existir (idempotente).
select cron.schedule('recalculo_diario', '0 10 * * *', 'select privado.recalculo_diario()');
