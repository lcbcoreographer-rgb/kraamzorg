-- =============================================================================
-- 0029_parametros_agente.sql
--
-- PRD 6.8, 13 e 22.4 O-16 [v4.5] · pedido do dono do projeto (teste em modo
-- demonstração, 30/09/2026): "nas configurações eles não devem ter acesso aos
-- parâmetros do agente".
--
-- Os parâmetros que só a Isadora e o n8n leem passam a ser mantidos pela
-- equipe de implantação, fora do app. Esta migration NÃO foi aplicada em
-- ambiente nenhum: escrita, testada no banco local (supabase/sem-docker) e
-- parada para revisão humana do SQL (CLAUDE.md).
--
-- O que ela faz:
--   1. public.parametro ganha a coluna restrito (boolean, padrão falso).
--   2. privado.chave_parametro_restrita(chave): a regra das chaves do agente
--      (prefixos agente_ e agenda_, mais a lista do PRD 6.8). Um gatilho marca
--      restrito = true na gravação, inclusive para chave nova (o seed roda
--      depois das migrations) e nunca deixa alguém desmarcar uma chave da regra.
--   3. As políticas de select, insert e update de parametro passam a exigir
--      restrito = false: nenhum papel do app lê, cria ou altera parâmetro do
--      agente, nem a diretoria. service_role (servidor) e postgres seguem como
--      estavam; as funções agente.* do n8n são security definer e não
--      dependem da política.
--   4. api.parametros_da_tela deixa de listar agente_pausa_humano_horas e
--      agente_followup_horas e nunca devolve linha restrita.
--   5. api.log_auditoria omite as linhas de auditoria de parâmetro restrito
--      (o histórico guardaria o valor antes e depois). Sem este passo, a
--      diretoria leria o valor por outro caminho.
--
-- Nenhuma regra de negócio muda: o agente continua lendo os mesmos valores
-- pelas mesmas funções. Só o app deixa de alcançá-los.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coluna
-- -----------------------------------------------------------------------------

alter table public.parametro
  add column restrito boolean not null default false;

comment on column public.parametro.restrito is 'PRD 6.8 [v4.5]: parâmetro do agente. Verdadeiro = nenhum papel do app lê, cria ou altera (nem a diretoria), e api.log_auditoria omite o histórico. Mantido pela equipe de implantação, fora do app. Marcado pelo gatilho marcar_parametro_restrito nas chaves agente_*, agenda_* e na lista de privado.chave_parametro_restrita.';

-- -----------------------------------------------------------------------------
-- 2. A regra das chaves e o gatilho
-- -----------------------------------------------------------------------------

create function privado.chave_parametro_restrita(chave text) returns boolean
  language sql
  immutable
  set search_path = ''
  as $$
  select chave_parametro_restrita.chave is not null
     and (   chave_parametro_restrita.chave like 'agente\_%' escape '\'
          or chave_parametro_restrita.chave like 'agenda\_%' escape '\'
          or chave_parametro_restrita.chave = any (array[
               'alerta_internacao_ativo',
               'alerta_emocional_ativo',
               'alerta_saude_sensivel_ativo',
               'taxa_visivel_agente',
               'validador_listas',
               'horarios_edilaine',
               'pdf_apresentacao',
               'pdf_reenvio_janela_horas',
               'grupo_whatsapp_por_destino',
               'plantao_telefones',
               'handoff_matriz',
               'handoff_dedup_minutos',
               'handoff_motivos_legiveis',
               'expediente_comercial',
               'link_ficha_modelo'
             ]::text[]))
$$;
comment on function privado.chave_parametro_restrita(text) is 'PRD 6.8 [v4.5]: a chave é de parâmetro do agente? Prefixos agente_ e agenda_ mais a lista das que só o agente e o n8n leem. Sem grant: usada pelo gatilho e por privado.parametro_restrito.';

create function privado.marcar_parametro_restrito() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  if privado.chave_parametro_restrita(new.chave) then
    new.restrito := true;
  end if;
  return new;
end;
$$;
comment on function privado.marcar_parametro_restrito() is 'Gatilho de public.parametro (PRD 6.8 [v4.5]): chave do agente nasce e continua com restrito = true, não importa o valor pedido. Sem grant.';

-- Linhas que já existem (a regra vale também para o que o seed cria depois).
-- atualizado_em não muda: o valor não foi alterado, só passou a ser restrito.
alter table public.parametro disable trigger tocar_atualizado_em;
update public.parametro
   set restrito = true
 where privado.chave_parametro_restrita(chave)
   and not restrito;
alter table public.parametro enable trigger tocar_atualizado_em;

create trigger marcar_restrito
  before insert or update on public.parametro
  for each row execute function privado.marcar_parametro_restrito();

-- -----------------------------------------------------------------------------
-- 3. Políticas: o app só enxerga e grava o que não é restrito
-- -----------------------------------------------------------------------------

drop policy ler on public.parametro;
drop policy incluir on public.parametro;
drop policy alterar on public.parametro;

create policy ler on public.parametro for select to authenticated
  using ((select privado.tem_papel('diretoria')) and not restrito);
create policy incluir on public.parametro for insert to authenticated
  with check ((select privado.tem_papel('diretoria')) and not restrito);
create policy alterar on public.parametro for update to authenticated
  using ((select privado.tem_papel('diretoria')) and not restrito)
  with check ((select privado.tem_papel('diretoria')) and not restrito);

-- -----------------------------------------------------------------------------
-- 4. api.parametros_da_tela: só o que a tela precisa e nada restrito
-- -----------------------------------------------------------------------------

create or replace function api.parametros_da_tela(chaves text[] default null)
  returns table (
    chave         text,
    valor         jsonb,
    atualizado_em timestamptz
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_permitidas text[];
  v_recusadas  text;
begin
  -- perfil ativo com algum papel (e AAL2 quando o perfil exige MFA)
  perform privado.autorizar(
    array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[],
    false);

  -- Lista fechada e só de valores operacionais que a própria tela precisa.
  -- [v4.5] Nenhum parâmetro do agente: pausa e retomada são ajustes da
  -- implantação e a tela fala delas sem citar horas.
  select coalesce(pg_catalog.array_agg(l.chave), array[]::text[])
    into v_permitidas
  from (values
          ('freio_desfazer_segundos',
           array['comercial', 'enfermeira', 'financeiro', 'coordenacao', 'diretoria']::public.papel_usuario[]),
          ('comercial_resposta_no_app',
           array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[])
       ) as l(chave, papeis)
  where exists (select 1 from pg_catalog.unnest(l.papeis) as p(papel) where privado.tem_papel(p.papel));

  if parametros_da_tela.chaves is not null then
    select pg_catalog.string_agg(coalesce(c.chave, 'nulo'), ', ')
      into v_recusadas
    from pg_catalog.unnest(parametros_da_tela.chaves) as c(chave)
    where c.chave is null or not (c.chave = any (v_permitidas));

    if v_recusadas is not null then
      raise exception 'api.parametros_da_tela: chave fora da lista do papel: % (PRD 13)', v_recusadas
        using errcode = '42501';
    end if;
  end if;

  return query
    select p.chave, p.valor, p.atualizado_em
      from public.parametro p
     where p.chave = any (v_permitidas)
       and not p.restrito
       and (parametros_da_tela.chaves is null or p.chave = any (parametros_da_tela.chaves))
     order by p.chave;
end;
$$;
comment on function api.parametros_da_tela(text[]) is 'Parâmetros operacionais que as telas mostram (freio_desfazer_segundos, comercial_resposta_no_app), por lista fechada com papéis por chave. [v4.5] Sem parâmetro do agente: chave restrita ou fora da lista ou do papel dá 42501, e linha restrita nunca volta. A tabela parametro continua só da diretoria (PRD 13).';

-- -----------------------------------------------------------------------------
-- 5. api.log_auditoria: sem o histórico de parâmetro restrito
-- -----------------------------------------------------------------------------

create function privado.parametro_restrito(chave text) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select privado.chave_parametro_restrita(parametro_restrito.chave)
      or exists (select 1 from public.parametro p where p.chave = parametro_restrito.chave and p.restrito)
$$;
comment on function privado.parametro_restrito(text) is 'PRD 6.8 [v4.5]: a chave é restrita pela regra ou por estar marcada em parametro.restrito? Usada por api.log_auditoria para não devolver o valor antes e depois de parâmetro do agente. Sem grant.';

create or replace function api.log_auditoria(
  entidade    text default null,
  entidade_id text default null,
  desde       timestamptz default null,
  ate         timestamptz default null,
  limite      integer default null
) returns setof public.log_auditoria
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);
  return query
    select l.*
      from privado.ler_log_auditoria(
             log_auditoria.entidade, log_auditoria.entidade_id, log_auditoria.desde, log_auditoria.ate, log_auditoria.limite) l
     where not (l.entidade = 'parametro' and privado.parametro_restrito(l.entidade_id));
end;
$$;
comment on function api.log_auditoria(text, text, timestamptz, timestamptz, integer) is 'Leitura do log de auditoria pela diretoria com AAL2 (PRD 13), por privado.ler_log_auditoria, que grava a própria leitura. ADR 0002 seção 5. [v4.5] Omite as linhas de parâmetro restrito (parâmetros do agente), cujo valor antes e depois não sai pelo app.';

-- -----------------------------------------------------------------------------
-- 6. Execute: auxiliares sem grant; as funções api mantêm o que tinham
-- -----------------------------------------------------------------------------

revoke execute on function privado.chave_parametro_restrita(text)   from public, anon, authenticated, service_role;
revoke execute on function privado.marcar_parametro_restrito()      from public, anon, authenticated, service_role;
revoke execute on function privado.parametro_restrito(text)         from public, anon, authenticated, service_role;

-- create or replace preserva os grants das duas funções api; confere.
do $$
begin
  if not has_function_privilege('authenticated', 'api.parametros_da_tela(text[])', 'execute')
     or not has_function_privilege('authenticated', 'api.log_auditoria(text, text, timestamptz, timestamptz, integer)', 'execute')
     or has_function_privilege('anon', 'api.parametros_da_tela(text[])', 'execute')
     or has_function_privilege('anon', 'api.log_auditoria(text, text, timestamptz, timestamptz, integer)', 'execute') then
    raise exception '0029: grants das funções api mudaram';
  end if;

  -- Nenhuma chave da regra ficou sem a marca (vale para o que já existia).
  if exists (select 1 from public.parametro p where privado.chave_parametro_restrita(p.chave) and not p.restrito) then
    raise exception '0029: parâmetro do agente sem restrito = true';
  end if;
end $$;
