-- =============================================================================
-- 0010_score_dedup.sql
--
-- P17 (PROMPTS.md v2), parte de banco · PRD 6.10 (regras 2, 11, 12 e 14),
-- 7.1 (pontuação), 22.2 (C-14), Apêndice A (atualizar_lead: "recalcula
-- score; deduplica pelo telefone e aplica a regra 12")
--
-- O que esta migration faz:
--   1. privado.telefone_normalizado(telefone): chave de comparação de
--      telefone (só dígitos; celular brasileiro com e sem o nono dígito
--      viram a mesma chave, porque o WhatsApp entrega os dois formatos).
--   2. privado.buscar_duplicatas(familia_id): duplicata certa por telefone
--      normalizado; duplicata provável por similaridade de nome (pg_trgm,
--      limiar em parâmetro) somada a DPP a até N dias (parâmetro); mesmo
--      telefone com data muito distante vira sugestão de vínculo de nova
--      gestação (regra 12), nunca de mesclagem.
--   3. privado.vincular_nova_gestacao(familia_id, familia_anterior_id): o
--      vínculo da regra 12, com as checagens de ciclo e de ordem das datas.
--   4. privado.calcular_score(familia_id): pesos de parametro.score_pesos e
--      cortes de parametro.score_cortes; grava score e classificacao na
--      oportunidade aberta da família.
--   5. Recálculo "a cada dado novo" (P17 item 3): gatilhos nas tabelas que
--      alimentam a pontuação. O recálculo diário entra como etapa do
--      privado.recalculo_diario (0011) por privado.recalculo_score().
--   6. score e classificacao saem dos grants de insert e update de
--      authenticated: a pontuação é calculada, nunca digitada (pendência
--      deixada pelo P07 no ADR 0002).
--
-- Parâmetros lidos (o P08 semeia; nenhum número de negócio fica no SQL):
--   deduplicacao  {"limiar_nome": 0.6, "dpp_dias": 14, "nova_gestacao_dias": 180}
--                 limiar_nome: similaridade mínima (0 a 1) do pg_trgm;
--                 dpp_dias: diferença máxima de DPP da duplicata provável
--                 (PRD 6.10 regra 2: 14); nova_gestacao_dias: acima disso,
--                 mesmo telefone sugere nova gestação, não mesclagem
--                 [confirmar: Leonardo, valores de limiar_nome e nova_gestacao_dias].
--   score_pesos   {"fit_operacional": {"peso": 40, "componentes": {"cidade_atendida": 1,
--                    "regiao_com_profissional": 1, "dpp_com_capacidade": 1}},
--                  "fit_comercial": {"peso": 35, "componentes": {"interesse": 1,
--                    "engajamento": 1, "sessao_agendada": 1, "parceiro_envolvido": 1}},
--                  "momento": {"peso": 25, "componentes": {"trimestre": 1,
--                    "proximidade_dpp": 1, "bebe_nasceu": 1}},
--                  "criterios": {"engajamento_mensagens": 3,
--                    "trimestre": [{"semana_min": 0, "valor": 0}, {"semana_min": 14, "valor": 0.5},
--                                  {"semana_min": 28, "valor": 1}],
--                    "proximidade_dpp_dias": 84}}
--                 Eixos e pesos do PRD 7.1 (40, 35, 25). Dentro do eixo,
--                 cada componente vale de 0 a 1 e entra com o peso relativo
--                 dele; nota do eixo = peso do eixo × média ponderada.
--                 Critérios de cada componente também em parâmetro
--                 [confirmar: Leonardo, pesos internos e critérios].
--   score_cortes  {"quente": 70, "morno": 40} (PRD 7.1, C-14: quente ≥ 70,
--                 morno 40 a 69, frio < 40) [confirmar: Leonardo].
-- Parâmetro ausente ou inválido: a função recusa (22023) em vez de chutar
-- número. O gatilho de recálculo engole essa recusa (a escrita de quem
-- alimentou a ficha nunca falha por causa da pontuação) e o recálculo
-- diário registra a etapa como erro.
--
-- Mesclagem (P17 item 2) fica para a sessão de tela do P17: aqui só a
-- detecção e o vínculo de nova gestação, que o agente usa (P21).
-- =============================================================================


-- =============================================================================
-- 1. Telefone normalizado
--
-- Só dígitos. Celular brasileiro no formato de 13 dígitos (55, DDD, 9 e oito
-- dígitos) perde o nono dígito na chave: o mesmo número chega como
-- +55 11 9xxxx-xxxx pelo cadastro e como +55 11 xxxx-xxxx por alguns JIDs
-- antigos do WhatsApp. É chave de comparação, nunca o telefone gravado
-- (que continua em E.164, PRD 5.2).
-- =============================================================================

create function privado.telefone_normalizado(telefone text) returns text
  language sql
  immutable
  strict
  parallel safe
  set search_path = ''
  as $$
  select case
           when x.d = '' then null
           when pg_catalog.length(x.d) = 13 and pg_catalog.left(x.d, 2) = '55' and pg_catalog.substr(x.d, 5, 1) = '9'
             then pg_catalog.left(x.d, 4) || pg_catalog.substr(x.d, 6)
           else x.d
         end
  from (select pg_catalog.regexp_replace(telefone_normalizado.telefone, '[^0-9]', '', 'g') as d) as x
$$;
comment on function privado.telefone_normalizado(text) is 'Chave de comparação de telefone para deduplicação (PRD 6.10 regra 2): só dígitos, e celular brasileiro de 13 dígitos sem o nono dígito (mesma chave com e sem o 9). Nunca é o valor gravado.';


-- =============================================================================
-- 2. Duplicatas (PRD 6.10 regras 2 e 12)
-- =============================================================================

create type privado.tipo_duplicata as enum ('duplicata_certa', 'nova_gestacao', 'duplicata_provavel');
comment on type privado.tipo_duplicata is 'Resultado da deduplicação (PRD 6.10 regras 2 e 12): duplicata_certa (mesmo telefone), nova_gestacao (mesmo telefone, datas muito distantes: vínculo por familia_anterior_id, nunca mesclagem), duplicata_provavel (nome parecido e DPP próxima).';

-- Lê e valida parametro.deduplicacao. Recusa em vez de adivinhar número.
create function privado.config_deduplicacao(out limiar_nome numeric, out dpp_dias integer, out nova_gestacao_dias integer)
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v jsonb;
begin
  select p.valor into v from public.parametro p where p.chave = 'deduplicacao';
  if pg_catalog.jsonb_typeof(v -> 'limiar_nome') is distinct from 'number'
     or pg_catalog.jsonb_typeof(v -> 'dpp_dias') is distinct from 'number'
     or pg_catalog.jsonb_typeof(v -> 'nova_gestacao_dias') is distinct from 'number' then
    raise exception 'parametro deduplicacao ausente ou incompleto (limiar_nome, dpp_dias, nova_gestacao_dias): deduplicação não roda sem ele (PRD 6.10 regra 2)'
      using errcode = '22023';
  end if;
  limiar_nome := (v ->> 'limiar_nome')::numeric;
  dpp_dias := (v ->> 'dpp_dias')::numeric::integer;
  nova_gestacao_dias := (v ->> 'nova_gestacao_dias')::numeric::integer;
  if limiar_nome <= 0 or limiar_nome > 1 or dpp_dias < 0 or nova_gestacao_dias <= dpp_dias then
    raise exception 'parametro deduplicacao inválido: limiar_nome entre 0 e 1, dpp_dias >= 0 e nova_gestacao_dias > dpp_dias'
      using errcode = '22023';
  end if;
end;
$$;
comment on function privado.config_deduplicacao() is 'Lê parametro.deduplicacao (limiar_nome, dpp_dias, nova_gestacao_dias) e recusa (22023) se faltar ou estiver incoerente. Sem grant.';

-- Duplicatas de uma família, entre as famílias não mescladas:
--   duplicata_certa     telefone normalizado em comum (pessoa ou conversa) e
--                       datas próximas ou desconhecidas;
--   nova_gestacao       telefone em comum, mas a data de referência
--                       (nascimento, ou DPP se não nasceu) das duas difere
--                       mais que nova_gestacao_dias: regra 12, sugere o
--                       vínculo, nunca a mesclagem;
--   duplicata_provavel  sem telefone em comum, nome parecido (maior
--                       similaridade entre os nomes de família e entre os
--                       nomes das pessoas, sem acento e em minúsculas) acima
--                       do limiar, e as duas DPPs a até dpp_dias dias.
-- Famílias já ligadas pela regra 12 (uma é a anterior da outra) não voltam
-- como sugestão. security definer: lê pessoa e conversa de todas as
-- famílias para comparar; só devolve ids e números, nenhum dado pessoal.
create function privado.buscar_duplicatas(familia_id uuid)
  returns table (
    outra_familia_id   uuid,
    tipo               privado.tipo_duplicata,
    similaridade_nome  numeric,
    diferenca_dias     integer,
    telefone_em_comum  boolean
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_cfg record;
  v_f   public.familia;
begin
  select * into v_cfg from privado.config_deduplicacao();

  select f.* into v_f from public.familia f where f.id = buscar_duplicatas.familia_id;
  if not found then
    raise exception 'buscar_duplicatas: família % não existe', buscar_duplicatas.familia_id
      using errcode = 'P0002';
  end if;

  return query
  with telefones_f as (
    select privado.telefone_normalizado(p.telefone_e164) as t
    from public.pessoa p where p.familia_id = v_f.id
    union
    select privado.telefone_normalizado(c.telefone_e164)
    from public.conversa c where c.familia_id = v_f.id
  ),
  telefones_o as (
    select p.familia_id as fid, privado.telefone_normalizado(p.telefone_e164) as t
    from public.pessoa p where p.familia_id <> v_f.id
    union
    select c.familia_id, privado.telefone_normalizado(c.telefone_e164)
    from public.conversa c where c.familia_id is not null and c.familia_id <> v_f.id
  ),
  por_telefone as (
    select distinct o.fid
    from telefones_o o
    join telefones_f f on f.t = o.t
    where f.t is not null
  ),
  pessoas_f as (
    select pg_catalog.lower(privado.sem_acento(p.nome)) as n
    from public.pessoa p where p.familia_id = v_f.id
  ),
  candidatas as (
    select o.id,
           o.dpp,
           coalesce(o.data_nascimento, o.dpp) as referencia,
           exists (select 1 from por_telefone t where t.fid = o.id) as tel,
           greatest(
             extensions.similarity(pg_catalog.lower(privado.sem_acento(v_f.nome_exibicao)),
                                   pg_catalog.lower(privado.sem_acento(o.nome_exibicao))),
             (select max(extensions.similarity(pf.n, pg_catalog.lower(privado.sem_acento(p.nome))))
                from public.pessoa p cross join pessoas_f pf
               where p.familia_id = o.id)
           )::numeric as sim
    from public.familia o
    where o.id <> v_f.id
      and o.mesclada_em_id is null
      and o.id is distinct from v_f.familia_anterior_id
      and o.familia_anterior_id is distinct from v_f.id
  ),
  classificadas as (
    select c.id,
           case
             when c.tel and c.referencia is not null and coalesce(v_f.data_nascimento, v_f.dpp) is not null
                  and abs(c.referencia - coalesce(v_f.data_nascimento, v_f.dpp)) > v_cfg.nova_gestacao_dias
               then 'nova_gestacao'::privado.tipo_duplicata
             when c.tel
               then 'duplicata_certa'::privado.tipo_duplicata
             when c.sim >= v_cfg.limiar_nome and c.dpp is not null and v_f.dpp is not null
                  and abs(c.dpp - v_f.dpp) <= v_cfg.dpp_dias
               then 'duplicata_provavel'::privado.tipo_duplicata
           end as tipo,
           pg_catalog.round(c.sim, 3) as sim,
           case
             when c.tel then abs(c.referencia - coalesce(v_f.data_nascimento, v_f.dpp))
             else abs(c.dpp - v_f.dpp)
           end as dif,
           c.tel
    from candidatas c
  )
  select k.id, k.tipo, k.sim, k.dif, k.tel
  from classificadas k
  where k.tipo is not null
  order by k.tipo, k.sim desc nulls last, k.id;
end;
$$;
comment on function privado.buscar_duplicatas(uuid) is 'Duplicatas de uma família (PRD 6.10 regras 2 e 12): duplicata_certa por telefone normalizado; nova_gestacao quando o telefone bate mas as datas distam mais que parametro.deduplicacao.nova_gestacao_dias (sugere vínculo, nunca mesclagem); duplicata_provavel por similaridade de nome (pg_trgm, limiar_nome) com DPP a até dpp_dias. Devolve só ids e números. Sem grant: usada pelo agente (P21) e pela tela de mesclagem (P17).';


-- =============================================================================
-- 3. Vínculo de nova gestação (PRD 6.10 regra 12)
--
-- "Nova gestação de uma família já atendida vira um registro novo de
-- familia, ligado ao anterior por familia_anterior_id." Checagens: as duas
-- existem, são diferentes e não foram mescladas; a nova ainda não tem outro
-- vínculo; o vínculo não fecha ciclo; e, quando as duas datas de
-- referência existem, a anterior vem antes. Quem pede: comercial ou
-- diretoria (quem altera familia pela RLS), ou o sistema sem usuário (o
-- agente, P21). A auditoria do update vem do gatilho privado.auditar; a
-- linha do tempo ganha um evento não restrito.
-- =============================================================================

create function privado.vincular_nova_gestacao(familia_id uuid, familia_anterior_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid   uuid := auth.uid();
  v_nova  public.familia;
  v_ant   public.familia;
  v_passo uuid;
  v_visitadas uuid[] := array[]::uuid[];
begin
  if v_uid is null then
    if coalesce(auth.role(), '') in ('anon', 'authenticated') then
      raise exception 'vincular_nova_gestacao: requisição sem usuário identificado'
        using errcode = '42501';
    end if;
  elsif not (privado.tem_papel('comercial') or privado.tem_papel('diretoria')) then
    raise exception 'vincular_nova_gestacao: só comercial ou diretoria ligam uma nova gestação (PRD 13)'
      using errcode = '42501';
  end if;

  if vincular_nova_gestacao.familia_id is null or vincular_nova_gestacao.familia_anterior_id is null
     or vincular_nova_gestacao.familia_id = vincular_nova_gestacao.familia_anterior_id then
    raise exception 'vincular_nova_gestacao: informe duas famílias diferentes'
      using errcode = '22023';
  end if;

  select f.* into v_nova from public.familia f where f.id = vincular_nova_gestacao.familia_id for update;
  select f.* into v_ant  from public.familia f where f.id = vincular_nova_gestacao.familia_anterior_id;
  if v_nova.id is null or v_ant.id is null then
    raise exception 'vincular_nova_gestacao: família não existe'
      using errcode = 'P0002';
  end if;
  if v_nova.mesclada_em_id is not null or v_ant.mesclada_em_id is not null then
    raise exception 'vincular_nova_gestacao: família mesclada não recebe vínculo; use a família que ficou'
      using errcode = '22023';
  end if;
  if v_nova.familia_anterior_id is not null then
    if v_nova.familia_anterior_id = v_ant.id then
      return pg_catalog.jsonb_build_object('ok', true, 'familia_id', v_nova.id, 'familia_anterior_id', v_ant.id, 'alterado', false);
    end if;
    raise exception 'vincular_nova_gestacao: a família já está ligada a outra gestação anterior'
      using errcode = '22023';
  end if;

  -- sem ciclo: subindo a partir da anterior, nunca se chega à nova
  v_passo := v_ant.id;
  while v_passo is not null loop
    if v_passo = v_nova.id or v_passo = any (v_visitadas) then
      raise exception 'vincular_nova_gestacao: o vínculo fecharia um ciclo de gestações'
        using errcode = '22023';
    end if;
    v_visitadas := v_visitadas || v_passo;
    select f.familia_anterior_id into v_passo from public.familia f where f.id = v_passo;
  end loop;

  if coalesce(v_ant.data_nascimento, v_ant.dpp) is not null
     and coalesce(v_nova.data_nascimento, v_nova.dpp) is not null
     and coalesce(v_ant.data_nascimento, v_ant.dpp) >= coalesce(v_nova.data_nascimento, v_nova.dpp) then
    raise exception 'vincular_nova_gestacao: a gestação anterior precisa ter data anterior à nova'
      using errcode = '22023';
  end if;

  update public.familia f set familia_anterior_id = v_ant.id where f.id = v_nova.id;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (v_nova.id, 'nova_gestacao', 'vinculo_nova_gestacao',
          pg_catalog.jsonb_build_object('familia_anterior_id', v_ant.id, 'sistema', v_uid is null,
                                        'origem', privado.origem_atual()),
          false, v_uid);

  return pg_catalog.jsonb_build_object('ok', true, 'familia_id', v_nova.id, 'familia_anterior_id', v_ant.id, 'alterado', true);
end;
$$;
comment on function privado.vincular_nova_gestacao(uuid, uuid) is 'Liga a nova gestação à família anterior por familia_anterior_id (PRD 6.10 regra 12): famílias diferentes e não mescladas, sem vínculo prévio, sem ciclo, anterior com data anterior. Comercial, diretoria ou sistema sem usuário. Grava evento nova_gestacao. Sem grant.';


-- =============================================================================
-- 4. privado.calcular_score (PRD 7.1)
--
-- Componentes (cada um de 0 a 1), todos calculados no banco a partir de
-- fatos gravados, nunca digitados:
--   fit_operacional
--     cidade_atendida          cidade da família atendida e sem "confirmar"
--     regiao_com_profissional  a região (da família, ou da cidade) está ativa
--                              e tem profissional ativa
--     dpp_com_capacidade       privado.disponibilidade(dpp, região) =
--                              'disponivel' (0011; sem DPP ou sem região, 0)
--   fit_comercial
--     interesse                oportunidade aberta com plano de interesse ou
--                              interesse na sessão registrado
--     engajamento              mensagens recebidas da família >=
--                              criterios.engajamento_mensagens
--     sessao_agendada          sessão de venda agendada ou realizada (ou
--                              estágio do P1 nesses pontos)
--     parceiro_envolvido       qualificacao.parceiro_participa = true ou
--                              parceiro presente na sessão
--   momento
--     trimestre                valor da faixa de criterios.trimestre pela
--                              idade gestacional de hoje (public.ig)
--     proximidade_dpp          DPP a até criterios.proximidade_dpp_dias
--                              (inclusive DPP passada)
--     bebe_nasceu              nascimento registrado (família ou bebê)
--   Bebê já nascido: trimestre e proximidade_dpp valem 1 (momento máximo).
-- Oportunidade aberta (6.10 regra 14): fora de perdido, cancelado e
-- distrato. Só grava quando o valor muda.
-- =============================================================================

create function privado.calcular_score(familia_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  c_eixos  constant text[] := array['fit_operacional', 'fit_comercial', 'momento'];
  c_comps  constant jsonb := '{"fit_operacional": ["cidade_atendida", "regiao_com_profissional", "dpp_com_capacidade"],
                               "fit_comercial": ["interesse", "engajamento", "sessao_agendada", "parceiro_envolvido"],
                               "momento": ["trimestre", "proximidade_dpp", "bebe_nasceu"]}';
  v_pesos   jsonb;
  v_cortes  jsonb;
  v_crit    jsonb;
  v_quente  numeric;
  v_morno   numeric;
  v_f       public.familia;
  v_regiao  uuid;
  v_hoje    date := (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_nasceu  boolean;
  v_semanas integer;
  v_val     jsonb := '{}'::jsonb;
  v_eixo    text;
  v_comp    text;
  v_w       numeric;
  v_soma_w  numeric;
  v_soma    numeric;
  v_nota    numeric;
  v_total   numeric := 0;
  v_notas   jsonb := '{}'::jsonb;
  v_score   integer;
  v_class   public.classificacao_lead;
  v_n       integer;
begin
  -- 1. parâmetros: recusa em vez de adivinhar
  select p.valor into v_pesos  from public.parametro p where p.chave = 'score_pesos';
  select p.valor into v_cortes from public.parametro p where p.chave = 'score_cortes';

  if pg_catalog.jsonb_typeof(v_pesos) is distinct from 'object' then
    raise exception 'parametro score_pesos ausente: a pontuação não é calculada sem os pesos (PRD 7.1)'
      using errcode = '22023';
  end if;
  foreach v_eixo in array c_eixos loop
    if pg_catalog.jsonb_typeof(v_pesos -> v_eixo -> 'peso') is distinct from 'number'
       or (v_pesos -> v_eixo ->> 'peso')::numeric < 0
       or pg_catalog.jsonb_typeof(v_pesos -> v_eixo -> 'componentes') is distinct from 'object' then
      raise exception 'parametro score_pesos: eixo % sem peso numérico ou sem componentes', v_eixo
        using errcode = '22023';
    end if;
    for v_comp in select k from pg_catalog.jsonb_object_keys(v_pesos -> v_eixo -> 'componentes') as k loop
      if not (c_comps -> v_eixo) ? v_comp
         or pg_catalog.jsonb_typeof(v_pesos -> v_eixo -> 'componentes' -> v_comp) is distinct from 'number'
         or (v_pesos -> v_eixo -> 'componentes' ->> v_comp)::numeric < 0 then
        raise exception 'parametro score_pesos: componente % do eixo % desconhecido ou sem peso numérico', v_comp, v_eixo
          using errcode = '22023';
      end if;
    end loop;
  end loop;

  v_crit := v_pesos -> 'criterios';
  if pg_catalog.jsonb_typeof(v_crit -> 'engajamento_mensagens') is distinct from 'number'
     or pg_catalog.jsonb_typeof(v_crit -> 'proximidade_dpp_dias') is distinct from 'number'
     or pg_catalog.jsonb_typeof(v_crit -> 'trimestre') is distinct from 'array'
     or exists (select 1 from pg_catalog.jsonb_array_elements(v_crit -> 'trimestre') as e
                where pg_catalog.jsonb_typeof(e -> 'semana_min') is distinct from 'number'
                   or pg_catalog.jsonb_typeof(e -> 'valor') is distinct from 'number'
                   or (e ->> 'valor')::numeric not between 0 and 1) then
    raise exception 'parametro score_pesos.criterios incompleto (engajamento_mensagens, proximidade_dpp_dias, trimestre com semana_min e valor de 0 a 1)'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(v_cortes -> 'quente') is distinct from 'number'
     or pg_catalog.jsonb_typeof(v_cortes -> 'morno') is distinct from 'number' then
    raise exception 'parametro score_cortes ausente ou incompleto (quente, morno): a classificação não sai sem os cortes (PRD 7.1, C-14)'
      using errcode = '22023';
  end if;
  v_quente := (v_cortes ->> 'quente')::numeric;
  v_morno  := (v_cortes ->> 'morno')::numeric;
  if v_morno < 0 or v_morno > v_quente or v_quente > 100 then
    raise exception 'parametro score_cortes inválido: 0 <= morno <= quente <= 100'
      using errcode = '22023';
  end if;

  -- 2. família
  select f.* into v_f from public.familia f where f.id = calcular_score.familia_id;
  if not found then
    raise exception 'calcular_score: família % não existe', calcular_score.familia_id
      using errcode = 'P0002';
  end if;
  v_regiao := coalesce(v_f.regiao_id, (select c.regiao_id from public.cidade c where c.id = v_f.cidade_id));
  v_nasceu := v_f.data_nascimento is not null
           or exists (select 1 from public.bebe b where b.familia_id = v_f.id and b.data_nascimento is not null);

  -- 3. componentes
  v_val := pg_catalog.jsonb_build_object(
    'cidade_atendida',
      exists (select 1 from public.cidade c
              where c.id = v_f.cidade_id and c.atendida and not c.requer_confirmacao),
    'regiao_com_profissional',
      v_regiao is not null
      and exists (select 1 from public.regiao r where r.id = v_regiao and r.ativa)
      and exists (select 1 from public.profissional p where p.ativa and v_regiao = any (p.regioes)),
    'dpp_com_capacidade',
      v_f.dpp is not null and v_regiao is not null
      and privado.disponibilidade(v_f.dpp, v_regiao) = 'disponivel',
    'interesse',
      exists (select 1 from public.oportunidade o
              where o.familia_id = v_f.id
                and coalesce(o.estagio_p2::text, o.estagio_p1::text, '') not in ('perdido', 'cancelado', 'distrato')
                and (o.plano_interesse_pacote_id is not null or o.sessao_interesse_em is not null)),
    'engajamento',
      (select count(*) from public.mensagem m join public.conversa c on c.id = m.conversa_id
        where c.familia_id = v_f.id and m.direcao = 'entrada' and m.enviado_por = 'cliente')
      >= (v_crit ->> 'engajamento_mensagens')::numeric,
    'sessao_agendada',
      exists (select 1 from public.sessao_venda s
              where s.familia_id = v_f.id and s.status in ('agendada', 'realizada'))
      or exists (select 1 from public.oportunidade o
                 where o.familia_id = v_f.id and o.estagio_p1 in ('sessao_venda_agendada', 'sessao_venda_realizada')),
    'parceiro_envolvido',
      exists (select 1 from public.oportunidade o
              where o.familia_id = v_f.id and o.qualificacao -> 'parceiro_participa' = 'true'::jsonb)
      or exists (select 1 from public.sessao_venda s where s.familia_id = v_f.id and s.parceiro_presente),
    'bebe_nasceu', v_nasceu
  );
  -- booleanos viram 0 ou 1
  select pg_catalog.jsonb_object_agg(k, case when v = 'true'::jsonb then 1 else 0 end)
    into v_val
  from pg_catalog.jsonb_each(v_val) as e(k, v);

  if v_nasceu then
    v_val := v_val || '{"trimestre": 1, "proximidade_dpp": 1}'::jsonb;
  elsif v_f.dpp is not null then
    v_semanas := (public.ig(v_f.dpp, v_hoje)).semanas;
    v_val := v_val || pg_catalog.jsonb_build_object(
      'trimestre',
        coalesce((select (e ->> 'valor')::numeric
                    from pg_catalog.jsonb_array_elements(v_crit -> 'trimestre') as e
                   where (e ->> 'semana_min')::numeric <= v_semanas
                   order by (e ->> 'semana_min')::numeric desc
                   limit 1), 0),
      'proximidade_dpp',
        case when v_f.dpp - v_hoje <= (v_crit ->> 'proximidade_dpp_dias')::numeric then 1 else 0 end);
  else
    v_val := v_val || '{"trimestre": 0, "proximidade_dpp": 0}'::jsonb;
  end if;

  -- 4. nota por eixo e total
  foreach v_eixo in array c_eixos loop
    v_soma_w := 0;
    v_soma := 0;
    for v_comp, v_w in
      select e.k, (e.v #>> '{}')::numeric
      from pg_catalog.jsonb_each(v_pesos -> v_eixo -> 'componentes') as e(k, v)
    loop
      v_soma_w := v_soma_w + v_w;
      v_soma := v_soma + v_w * (v_val ->> v_comp)::numeric;
    end loop;
    v_nota := case when v_soma_w > 0
                   then (v_pesos -> v_eixo ->> 'peso')::numeric * v_soma / v_soma_w
                   else 0 end;
    v_total := v_total + v_nota;
    v_notas := v_notas || pg_catalog.jsonb_build_object(v_eixo, pg_catalog.round(v_nota, 2));
  end loop;

  v_score := least(100, greatest(0, pg_catalog.round(v_total)))::integer;
  v_class := case
               when v_score >= v_quente then 'quente'
               when v_score >= v_morno  then 'morno'
               else 'frio'
             end;

  -- 5. grava na oportunidade aberta, só se mudou
  with alteradas as (
    update public.oportunidade o
       set score = v_score,
           classificacao = v_class
     where o.familia_id = v_f.id
       and coalesce(o.estagio_p2::text, o.estagio_p1::text, '') not in ('perdido', 'cancelado', 'distrato')
       and (o.score is distinct from v_score or o.classificacao is distinct from v_class)
    returning o.id
  )
  select count(*)::integer into v_n from alteradas;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'familia_id', v_f.id,
    'score', v_score,
    'classificacao', v_class,
    'eixos', v_notas,
    'componentes', v_val,
    'oportunidades_atualizadas', v_n);
end;
$$;
comment on function privado.calcular_score(uuid) is 'Pontuação do lead (PRD 7.1): três eixos com pesos de parametro.score_pesos (componentes de 0 a 1, critérios em score_pesos.criterios) e classificação pelos cortes de parametro.score_cortes. Grava score e classificacao na oportunidade aberta quando mudam e devolve o detalhe. Parâmetro ausente ou inválido: recusa (22023). Sem grant.';


-- =============================================================================
-- 5. Recálculo a cada dado novo (P17 item 3)
--
-- Gatilhos AFTER nas tabelas que alimentam os componentes. Só recalcula
-- família com oportunidade aberta. A recusa de calcular_score (parâmetro
-- ausente, por exemplo) vira aviso no log do servidor e nunca derruba a
-- escrita de quem alimentou a ficha (inclusive a mensagem recebida pelo
-- agente). As colunas score e classificacao não disparam nada, então o
-- update feito pela própria calcular_score não entra em laço.
-- =============================================================================

create function privado.recalcular_score() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_familia uuid;
begin
  if tg_table_name = 'familia' then
    v_familia := new.id;
  elsif tg_table_name = 'mensagem' then
    if new.direcao <> 'entrada' then
      return null;
    end if;
    select c.familia_id into v_familia from public.conversa c where c.id = new.conversa_id;
  else
    v_familia := new.familia_id;
  end if;

  if v_familia is null
     or not exists (select 1 from public.oportunidade o
                    where o.familia_id = v_familia
                      and coalesce(o.estagio_p2::text, o.estagio_p1::text, '') not in ('perdido', 'cancelado', 'distrato')) then
    return null;
  end if;

  begin
    perform privado.calcular_score(v_familia);
  exception
    when others then
      raise warning 'recalcular_score: pontuação da família % não recalculada (%): %', v_familia, sqlstate, sqlerrm;
  end;
  return null;
end;
$$;
comment on function privado.recalcular_score() is 'Gatilho AFTER: recalcula a pontuação (privado.calcular_score) quando chega dado novo da família (P17 item 3). Falha da pontuação vira aviso e não derruba a escrita.';

create trigger recalcular_score after insert on public.familia
  for each row execute function privado.recalcular_score();
create trigger recalcular_score_update after update of dpp, data_nascimento, cidade_id, regiao_id on public.familia
  for each row
  when (new.dpp is distinct from old.dpp or new.data_nascimento is distinct from old.data_nascimento
        or new.cidade_id is distinct from old.cidade_id or new.regiao_id is distinct from old.regiao_id)
  execute function privado.recalcular_score();

create trigger recalcular_score after insert on public.oportunidade
  for each row execute function privado.recalcular_score();
create trigger recalcular_score_update
  after update of estagio_p1, estagio_p2, plano_interesse_pacote_id, sessao_interesse_em, qualificacao on public.oportunidade
  for each row execute function privado.recalcular_score();

create trigger recalcular_score after insert or update of status, parceiro_presente on public.sessao_venda
  for each row execute function privado.recalcular_score();

create trigger recalcular_score after insert or update of data_nascimento on public.bebe
  for each row execute function privado.recalcular_score();

create trigger recalcular_score after insert on public.mensagem
  for each row execute function privado.recalcular_score();

create trigger recalcular_score after update of familia_id on public.conversa
  for each row
  when (new.familia_id is distinct from old.familia_id)
  execute function privado.recalcular_score();


-- --- Etapa do recálculo diário (privado.recalculo_diario, 0011) -----------------
-- Recalcula as famílias não mescladas com oportunidade aberta no pipeline 1
-- (fora dos desvios que encerram: perdido, nao_qualificado,
-- fora_de_cobertura). Parâmetro ausente: a primeira chamada recusa e a
-- etapa inteira fica como erro no registro do recálculo.
create function privado.recalculo_score() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_familia uuid;
  v_r       jsonb;
  v_n       integer := 0;
  v_alt     integer := 0;
  v_quente  integer := 0;
  v_morno   integer := 0;
  v_frio    integer := 0;
begin
  for v_familia in
    select distinct o.familia_id
    from public.oportunidade o
    join public.familia f on f.id = o.familia_id
    where f.mesclada_em_id is null
      and o.estagio_p2 is null
      and o.estagio_p1 not in ('perdido', 'nao_qualificado', 'fora_de_cobertura')
    order by o.familia_id
  loop
    v_r := privado.calcular_score(v_familia);
    v_n := v_n + 1;
    v_alt := v_alt + (v_r ->> 'oportunidades_atualizadas')::integer;
    case v_r ->> 'classificacao'
      when 'quente' then v_quente := v_quente + 1;
      when 'morno'  then v_morno := v_morno + 1;
      else v_frio := v_frio + 1;
    end case;
  end loop;

  return pg_catalog.jsonb_build_object('familias', v_n, 'oportunidades_atualizadas', v_alt,
                                       'quente', v_quente, 'morno', v_morno, 'frio', v_frio);
end;
$$;
comment on function privado.recalculo_score() is 'Etapa score do recálculo diário (PRD 10.2, P17 item 3): recalcula a pontuação de toda família não mesclada com oportunidade aberta no pipeline 1 e devolve só contagens. Sem grant.';


-- =============================================================================
-- 6. score e classificacao fora do alcance do app
--
-- O P07 deixou os dois nos grants de insert e update de authenticated e
-- registrou a pendência no ADR 0002 ("o score é calculado no P17"). Leitura
-- mais segura: a pontuação é do banco. O comercial continua lendo as duas
-- colunas (grant de select da tabela inteira).
-- =============================================================================

revoke insert (score, classificacao) on public.oportunidade from authenticated;
revoke update (score, classificacao) on public.oportunidade from authenticated;


-- =============================================================================
-- 7. Execute: nada para anon nem authenticated
-- =============================================================================

revoke execute on function privado.telefone_normalizado(text) from public, anon, authenticated, service_role;
revoke execute on function privado.config_deduplicacao() from public, anon, authenticated, service_role;
revoke execute on function privado.buscar_duplicatas(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.vincular_nova_gestacao(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.calcular_score(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.recalcular_score() from public, anon, authenticated, service_role;
revoke execute on function privado.recalculo_score() from public, anon, authenticated, service_role;
