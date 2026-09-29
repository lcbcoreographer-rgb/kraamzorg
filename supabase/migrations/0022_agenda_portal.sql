-- =============================================================================
-- 0022_agenda_portal.sql
--
-- P37 (agenda, escalas e equipe) e P38 (portal da enfermeira) · PROMPTS.md v2
-- · PRD 3.4 (duas visitas por dia, mesmo período), 6.5 (profissional,
-- documento_profissional, bloqueio_agenda, designacao, visita), 7.3 (estado
-- da visita), 10.1 (documento_vencendo), 13 (famílias atribuídas), 15
-- (operação offline), 20.4 e 20.6 (navegação e estado das enfermeiras),
-- docs/design/fluxos.md (fluxo C).
--
-- Esta migration NÃO foi aplicada em ambiente nenhum: escrita, testada no
-- banco local (supabase/sem-docker) e parada para revisão humana do SQL
-- (CLAUDE.md). Nenhum dado aqui: parâmetros novos ficam no seed.sql.
--
-- Agenda, escalas e equipe (P37), só coordenação e diretoria, AAL2:
--   1. api.equipe(): as profissionais com o estado de hoje e da semana
--      (privado.status_profissional, sempre calculado, nunca digitado), as
--      famílias em curso, os documentos com validade e os bloqueios, mais o
--      resumo de "3 em visita agora, 1 livre, 2 reservadas...".
--   2. api.escala_semanal(): sete dias por dois turnos por profissional
--      (visita, folga, reservada, backup, oferta ou livre), com conflito e
--      sobrecarga marcados. A enfermeira vê só a própria linha.
--   3. api.agenda(): as visitas do período, por profissional ou de todas,
--      com os conflitos de cada uma.
--   4. Conflitos (privado.conflitos_visita): mais de duas visitas no dia
--      (parametro.agenda_visitas_por_dia), período diferente do D1,
--      bloqueio de agenda, sobreposição de horário e profissional inativa.
--   5. api.reagendar_visita() e api.reagendar_cascata(): mostram os
--      conflitos antes de salvar (simular), recusam conflito sem
--      confirmação e motivo, mantêm o horário (logo o período) e passam pela
--      máquina de estados da visita (agendada, reagendada, agendada).
--   6. api.salvar_profissional(), api.salvar_documento_profissional(),
--      api.salvar_bloqueio_agenda() e api.remover_bloqueio_agenda().
--   7. privado.recalculo_documentos_vencendo(): etapa do recálculo diário
--      (0011) que agenda a automação documento_vencendo 30 dias antes.
--
-- Portal da enfermeira (P38), só a enfermeira com profissional ativa, AAL2:
--   8. api.portal_hoje(): as visitas do dia (endereço, período, chegada e
--      saída) e as fichas pendentes, sem dado comercial. Registra a leitura.
--   9. api.portal_familias(): só as famílias atribuídas (privado.
--      familias_atribuidas), lidas por assistencial.ler_acompanhamento, que
--      grava o log antes de devolver.
--  10. api.portal_perfil(): cadastro da própria enfermeira, documentos e
--      bloqueios.
--  11. api.registrar_chegada() e api.registrar_saida(): gravam a hora e
--      andam pela máquina de estados da visita. Idempotentes (o aparelho
--      reenvia sem medo). A hora vem do aparelho quando não há sinal.
--
-- Versão de sincronização (regra 13 do PRD 6.10):
--  12. api.sincronizacao_item() e api.sincronizacao_registrar(): o servidor
--      de sincronização (POST /api/sync) guarda os itens da fila do
--      aparelho que já processou, para reenviar o mesmo id nunca reaplicar.
--  13. privado.incrementar_versao() passa a subir a versão uma vez por
--      transação e por linha. Uma gravação lógica que passa por vários
--      updates (chegada: três transições de estado e a hora) é uma só
--      mudança para quem sincroniza; sem isto, a fila offline do aparelho
--      (chegada e depois saída, encadeadas por versao_base + 1) geraria
--      conflito com ela mesma.
--
-- Recusa de negócio: erro P0001 com a mensagem "equipe:<código> <detalhe>",
-- que o app troca por uma frase. O detalhe nunca leva dado pessoal.
-- =============================================================================


-- =============================================================================
-- 1. Versão de sincronização: uma vez por transação e por linha
-- =============================================================================

create or replace function privado.incrementar_versao() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_chave text := tg_table_name || ':' || old.id::text || ':' || pg_catalog.txid_current()::text;
  v_vistos text := coalesce(pg_catalog.current_setting('app.versao_incrementada', true), '');
begin
  if pg_catalog.strpos(v_vistos, '|' || v_chave || '|') > 0 then
    -- a linha já subiu de versão nesta transação: é a mesma gravação lógica
    new.versao = old.versao;
  else
    new.versao = old.versao + 1;
    perform pg_catalog.set_config('app.versao_incrementada', v_vistos || '|' || v_chave || '|', true);
  end if;
  return new;
end;
$$;
comment on function privado.incrementar_versao() is 'Gatilho BEFORE UPDATE: incrementa a coluna versao uma vez por transação e por linha (PRD 6.10 regra 13). Uma gravação lógica que passa por vários updates (a chegada da enfermeira: três transições de estado e a hora) é uma só mudança para a sincronização offline (15), que encadeia versao_base + 1 por item da fila. A versão enviada pelo cliente é sempre ignorada.';


-- =============================================================================
-- 2. Auxiliares (sem grant: só rodam dentro de função security definer)
-- =============================================================================

create function privado.equipe_recusar(codigo text, detalhe text default null) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
begin
  raise exception 'equipe:% %', equipe_recusar.codigo, coalesce(equipe_recusar.detalhe, '')
    using errcode = 'P0001';
end;
$$;
comment on function privado.equipe_recusar(text, text) is '[P37/P38] Recusa de negócio: erro P0001 com a mensagem "equipe:<código> <detalhe>", que a tela troca por uma frase. O detalhe nunca leva dado pessoal. Sem grant.';

create function privado.equipe_log(acao text, entidade text, entidade_id text, antes jsonb, depois jsonb) returns void
  language sql
  volatile
  security definer
  set search_path = ''
  as $$
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), equipe_log.acao, equipe_log.entidade, equipe_log.entidade_id, equipe_log.antes, equipe_log.depois,
          coalesce(privado.origem_atual(), 'app'), privado.ip_requisicao())
$$;
comment on function privado.equipe_log(text, text, text, jsonb, jsonb) is '[P37/P38] Linha de log_auditoria de uma ação da agenda ou do portal. Só ids, estados, datas e horas; nunca motivo livre, endereço nem nome. Sem grant.';

-- Estados da visita em que o horário ainda pode mudar.
create function privado.visita_movivel(estado public.estado_visita) returns boolean
  language sql
  immutable
  set search_path = ''
  as $$
  select visita_movivel.estado in ('agendada', 'confirmada', 'a_caminho', 'reagendada',
                                    'nao_realizada_familia', 'nao_realizada_profissional')
$$;
comment on function privado.visita_movivel(public.estado_visita) is '[P37] Estados da visita que a coordenação ainda pode reagendar (antes de a visita começar). Sem grant.';

-- Estados em que a visita ocupa a agenda da profissional.
create function privado.visita_ocupa_agenda(estado public.estado_visita) returns boolean
  language sql
  immutable
  set search_path = ''
  as $$
  select visita_ocupa_agenda.estado not in ('reagendada', 'cancelada', 'nao_realizada_familia',
                                             'nao_realizada_profissional')
$$;
comment on function privado.visita_ocupa_agenda(public.estado_visita) is '[P37] Visita que conta na carga e nos conflitos da profissional: fora as reagendadas, canceladas e não realizadas. Sem grant.';

-- Turno (manha, tarde) de uma visita: pela hora prevista quando há, senão
-- pelo período do acompanhamento. As faixas de hora ficam em parametro.
create function privado.turno_da_visita(hora time, periodo public.periodo_visita) returns text
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_faixas jsonb;
  v_turno  text;
begin
  if turno_da_visita.hora is null then
    return case turno_da_visita.periodo when 'manha' then 'manha' when 'tarde' then 'tarde' else null end;
  end if;

  select p.valor into v_faixas from public.parametro p where p.chave = 'periodos_visita';
  if v_faixas is null then
    raise exception 'parametro periodos_visita ausente: sem as faixas de hora não há como saber o período da visita (PRD 3.4)'
      using errcode = '22023';
  end if;

  for v_turno in select k from pg_catalog.jsonb_object_keys(v_faixas) as k order by k loop
    if turno_da_visita.hora >= (v_faixas -> v_turno ->> 'inicio')::time
       and turno_da_visita.hora < (v_faixas -> v_turno ->> 'fim')::time then
      return v_turno;
    end if;
  end loop;
  return null;
end;
$$;
comment on function privado.turno_da_visita(time, public.periodo_visita) is '[P37] Turno da visita: pela hora prevista contra parametro.periodos_visita, senão pelo período do acompanhamento (manha ou tarde; noite_avaliar não tem turno). Sem o parâmetro, recusa. Sem grant.';

-- Limite de visitas por profissional por dia (PRD 3.4). Sem o parâmetro,
-- recusa: não há número padrão no código.
create function privado.limite_visitas_dia() returns integer
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_limite integer;
begin
  select case when pg_catalog.jsonb_typeof(p.valor) = 'number' then (p.valor #>> '{}')::numeric::integer end
    into v_limite
  from public.parametro p
  where p.chave = 'agenda_visitas_por_dia';
  if v_limite is null or v_limite < 1 then
    raise exception 'parametro agenda_visitas_por_dia ausente ou inválido (PRD 3.4)'
      using errcode = '22023';
  end if;
  return v_limite;
end;
$$;
comment on function privado.limite_visitas_dia() is '[P37] Visitas por profissional por dia (PRD 3.4), de parametro.agenda_visitas_por_dia. Sem o parâmetro, recusa. Sem grant.';

-- Dias antes do vencimento em que o documento passa a "vencendo" (PRD 10.1):
-- a mesma fonte da automação documento_vencendo.
create function privado.documento_aviso_dias() returns integer
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_dias integer;
begin
  select (a.gatilho ->> 'dias')::integer into v_dias
  from public.automacao a
  where a.id = 'documento_vencendo';
  if v_dias is null or v_dias < 0 then
    raise exception 'automação documento_vencendo sem o número de dias no gatilho (PRD 10.1)'
      using errcode = '22023';
  end if;
  return v_dias;
end;
$$;
comment on function privado.documento_aviso_dias() is '[P37] Dias de aviso antes do vencimento de um documento, de automacao.gatilho.dias de documento_vencendo (PRD 10.1: 30). Sem grant.';

-- "D3 de 6": número do último dia do acompanhamento que já aconteceu ou está
-- em curso até o dia dado. Nulo quando ainda não começou.
create function privado.dia_do_acompanhamento(acompanhamento_id uuid, dia date) returns integer
  language sql
  stable
  set search_path = ''
  as $$
  select max(v.dia_numero)
  from public.visita v
  where v.acompanhamento_id = dia_do_acompanhamento.acompanhamento_id
    and v.data <= dia_do_acompanhamento.dia
    and v.estado in ('iniciada', 'concluida', 'ficha_pendente', 'ficha_entregue', 'encerrada')
$$;
comment on function privado.dia_do_acompanhamento(uuid, date) is '[P37] Maior dia_numero de visita já iniciada ou feita até o dia dado (D3 de 6). Nulo antes da primeira. Sem grant.';

-- Conflitos de uma visita (existente ou proposta) na agenda da profissional.
-- p_visita é a própria visita quando ela já existe (não conta contra si) e
-- p_acompanhamento é a família (as visitas dela não contam como conflito
-- entre si). Devolve um array jsonb de {codigo, ...}; vazio = sem conflito.
--   profissional_inativa   a profissional está inativa
--   bloqueio               bloqueio de agenda cobre o dia
--   limite_visitas_dia     passa do limite de visitas por dia
--   periodo_diferente_do_d1 o turno é diferente do período da família
--   sobreposicao           outra visita da profissional no mesmo horário
create function privado.conflitos_visita(
  profissional_id uuid,
  data            date,
  hora_prevista   time,
  acompanhamento_id uuid,
  visita_id       uuid default null
) returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_conflitos jsonb := '[]'::jsonb;
  v_limite    integer := privado.limite_visitas_dia();
  v_quantas   integer;
  v_turno     text;
  v_referencia text;
  v_horas     numeric;
  v_ativa     boolean;
  v_outra     record;
begin
  select pr.ativa into v_ativa from public.profissional pr where pr.id = conflitos_visita.profissional_id;
  if not found or not v_ativa then
    v_conflitos := v_conflitos || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('codigo', 'profissional_inativa'));
  end if;

  if exists (select 1 from public.bloqueio_agenda b
             where b.profissional_id = conflitos_visita.profissional_id
               and conflitos_visita.data between b.inicio and b.fim) then
    v_conflitos := v_conflitos || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('codigo', 'bloqueio'));
  end if;

  select count(*)::integer into v_quantas
  from public.visita v
  where v.profissional_id = conflitos_visita.profissional_id
    and v.data = conflitos_visita.data
    and privado.visita_ocupa_agenda(v.estado)
    and v.id is distinct from conflitos_visita.visita_id
    and v.acompanhamento_id is distinct from conflitos_visita.acompanhamento_id;
  if v_quantas + 1 > v_limite then
    v_conflitos := v_conflitos || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'codigo', 'limite_visitas_dia', 'limite', v_limite, 'quantas', v_quantas + 1));
  end if;

  -- período: o da família (acompanhamento.periodo) ou, sem ele, o do D1
  v_turno := privado.turno_da_visita(conflitos_visita.hora_prevista, null);
  select privado.turno_da_visita(null, a.periodo), a.horas_por_visita
    into v_referencia, v_horas
  from public.acompanhamento a
  where a.id = conflitos_visita.acompanhamento_id;
  if v_referencia is null then
    select privado.turno_da_visita(d1.hora_prevista, null) into v_referencia
    from public.visita d1
    where d1.acompanhamento_id = conflitos_visita.acompanhamento_id
      and d1.dia_numero = 1
      and d1.id is distinct from conflitos_visita.visita_id
      and privado.visita_ocupa_agenda(d1.estado);
  end if;
  if v_turno is not null and v_referencia is not null and v_turno <> v_referencia then
    v_conflitos := v_conflitos || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'codigo', 'periodo_diferente_do_d1', 'turno', v_turno, 'referencia', v_referencia));
  end if;

  -- sobreposição: horário contra horário quando os dois têm hora; senão, o
  -- mesmo turno conta como sobreposto
  for v_outra in
    select v.id, v.hora_prevista as hora, a.horas_por_visita as horas, a.periodo
    from public.visita v
    join public.acompanhamento a on a.id = v.acompanhamento_id
    where v.profissional_id = conflitos_visita.profissional_id
      and v.data = conflitos_visita.data
      and privado.visita_ocupa_agenda(v.estado)
      and v.id is distinct from conflitos_visita.visita_id
      and v.acompanhamento_id is distinct from conflitos_visita.acompanhamento_id
  loop
    if conflitos_visita.hora_prevista is not null and v_outra.hora is not null then
      if conflitos_visita.hora_prevista < v_outra.hora + pg_catalog.make_interval(mins => (v_outra.horas * 60)::integer)
         and v_outra.hora < conflitos_visita.hora_prevista + pg_catalog.make_interval(mins => (coalesce(v_horas, 0) * 60)::integer) then
        v_conflitos := v_conflitos || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'codigo', 'sobreposicao', 'visita_id', v_outra.id));
      end if;
    elsif v_turno is not null and v_turno = privado.turno_da_visita(v_outra.hora, v_outra.periodo) then
      v_conflitos := v_conflitos || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'codigo', 'sobreposicao', 'visita_id', v_outra.id));
    end if;
  end loop;

  return v_conflitos;
end;
$$;
comment on function privado.conflitos_visita(uuid, date, time, uuid, uuid) is '[P37 item 3] Conflitos de uma visita, existente ou proposta, na agenda da profissional: profissional_inativa, bloqueio, limite_visitas_dia (parametro agenda_visitas_por_dia), periodo_diferente_do_d1 e sobreposicao. As visitas da mesma família não contam entre si. Array jsonb; vazio quando não há conflito. Sem grant.';

-- Move uma visita: passa pela máquina de estados (reagendada e de volta a
-- agendada), com o horário e a profissional novos. Quem chama já conferiu
-- papel, conflito e designação.
create function privado.mover_visita(
  visita_id       uuid,
  data            date,
  hora_prevista   time,
  profissional_id uuid,
  motivo          text default null
) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_estado public.estado_visita;
begin
  select v.estado into v_estado from public.visita v where v.id = mover_visita.visita_id for update;
  if not found then
    perform privado.equipe_recusar('visita_inexistente');
  end if;
  if not privado.visita_movivel(v_estado) then
    perform privado.equipe_recusar('visita_nao_movivel', v_estado::text);
  end if;

  if v_estado <> 'reagendada' then
    perform privado.transicionar('visita', mover_visita.visita_id, 'reagendada', mover_visita.motivo);
  end if;

  update public.visita v
     set data = mover_visita.data,
         hora_prevista = mover_visita.hora_prevista,
         profissional_id = mover_visita.profissional_id
   where v.id = mover_visita.visita_id;

  perform privado.transicionar('visita', mover_visita.visita_id, 'agendada', mover_visita.motivo);
end;
$$;
comment on function privado.mover_visita(uuid, date, time, uuid, text) is '[P37] Muda data, hora e profissional de uma visita ainda não começada, passando pela máquina de estados (reagendada e de volta a agendada). Quem chama confere papel, conflito e designação. Sem grant.';


-- =============================================================================
-- 3. api.equipe (P37 itens 1 e 6, fluxo C)
--
-- As profissionais com o estado de hoje e da semana (calculado, nunca
-- digitado), famílias em curso, documentos com validade e bloqueios, e o
-- resumo para o início da coordenação e da diretoria.
-- =============================================================================

create function api.equipe(
  regiao_id         uuid default null,
  dia               date default null,
  incluir_inativas  boolean default false
) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_hoje    date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  v_dia     date := coalesce(equipe.dia, (pg_catalog.now() at time zone 'America/Sao_Paulo')::date);
  v_inicio  date;
  v_aviso   integer;
  v_lista   jsonb;
  v_resumo  jsonb;
  v_antiga  integer;
  v_tipos   jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  v_inicio := pg_catalog.date_trunc('week', v_dia)::date;
  v_aviso := privado.documento_aviso_dias();
  select p.valor into v_tipos from public.parametro p where p.chave = 'documento_profissional_tipos';

  select pg_catalog.jsonb_agg(t.item order by t.ordem_nome, t.id)
    into v_lista
  from (
    select pr.id,
           pg_catalog.lower(pr.nome) as ordem_nome,
           pg_catalog.jsonb_build_object(
             'id', pr.id,
             'nome', pr.nome,
             'funcao', pr.funcao,
             'atende_visitas', pr.funcao <> 'coordenacao',
             'conselho', pr.conselho,
             'conselho_uf', pr.conselho_uf,
             'conselho_numero', pr.conselho_numero,
             'telefone_e164', pr.telefone_e164,
             'regioes', pg_catalog.to_jsonb(pr.regioes),
             'vinculo', pr.vinculo,
             'valor_hora_centavos', pr.valor_hora_centavos,
             'adicional_deslocamento_centavos', pr.adicional_deslocamento_centavos,
             'ativa', pr.ativa,
             'tem_usuario', pr.usuario_id is not null,
             'usuario_id', pr.usuario_id,
             'status', case when pr.ativa then privado.status_profissional(pr.id, v_dia)::text end,
             'visitas_no_dia', (select count(*)::integer from public.visita v
                                where v.profissional_id = pr.id and v.data = v_dia
                                  and privado.visita_ocupa_agenda(v.estado)),
             'semana', case when pr.ativa then (
                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                          'dia', d.dia, 'status', privado.status_profissional(pr.id, d.dia)::text) order by d.dia)
                 from (select (v_inicio + g.n)::date as dia from pg_catalog.generate_series(0, 6) as g(n)) d
               ) end,
             'familias', coalesce((
                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                          'familia_id', f.id,
                          'nome_exibicao', f.nome_exibicao,
                          'papel', d.papel,
                          'acompanhamento_id', a.id,
                          'estado', a.estado,
                          'dias_contratados', a.dias_contratados,
                          'dia_atual', privado.dia_do_acompanhamento(a.id, v_dia),
                          'dpp', f.dpp,
                          'data_nascimento', f.data_nascimento) order by f.nome_exibicao, f.id)
                 from public.designacao d
                 join public.acompanhamento a on a.id = d.acompanhamento_id
                 join public.familia f on f.id = a.familia_id
                 where d.profissional_id = pr.id and d.status = 'aceita'
                   and a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico')), '[]'::jsonb),
             'ofertas_pendentes', (select count(*)::integer from public.designacao d
                                   where d.profissional_id = pr.id and d.status = 'oferecida'),
             'documentos', coalesce((
                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                          'id', dp.id,
                          'tipo', dp.tipo,
                          'numero', dp.numero,
                          'validade', dp.validade,
                          'situacao', case when dp.validade is null then 'sem_validade'
                                           when dp.validade < v_hoje then 'vencido'
                                           when dp.validade <= v_hoje + v_aviso then 'vencendo'
                                           else 'em_dia' end) order by dp.validade nulls last, dp.tipo, dp.id)
                 from public.documento_profissional dp
                 where dp.profissional_id = pr.id), '[]'::jsonb),
             'bloqueios', coalesce((
                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                          'id', b.id, 'inicio', b.inicio, 'fim', b.fim, 'motivo', b.motivo) order by b.inicio, b.id)
                 from public.bloqueio_agenda b
                 where b.profissional_id = pr.id and b.fim >= v_hoje), '[]'::jsonb)
           ) as item
    from public.profissional pr
    where (pr.ativa or coalesce(equipe.incluir_inativas, false))
      and (equipe.regiao_id is null or equipe.regiao_id = any (pr.regioes))
  ) t;

  v_lista := coalesce(v_lista, '[]'::jsonb);

  select pg_catalog.floor(extract(epoch from (pg_catalog.now() - min(d.oferecida_em))) / 3600)::integer
    into v_antiga
  from public.designacao d
  join public.profissional pr on pr.id = d.profissional_id
  where d.status = 'oferecida' and pr.ativa
    and (equipe.regiao_id is null or equipe.regiao_id = any (pr.regioes));

  select pg_catalog.jsonb_build_object(
           'em_visita',       count(*) filter (where e ->> 'status' = 'em_visita'),
           'em_atendimento',  count(*) filter (where e ->> 'status' = 'em_atendimento'),
           'reservada',       count(*) filter (where e ->> 'status' = 'reservada'),
           'backup',          count(*) filter (where e ->> 'status' = 'backup'),
           'oferta_pendente', count(*) filter (where e ->> 'status' = 'oferta_pendente'),
           'folga',           count(*) filter (where e ->> 'status' = 'folga'),
           'livre',           count(*) filter (where e ->> 'status' = 'livre'),
           'oferta_mais_antiga_horas', v_antiga)
    into v_resumo
  from pg_catalog.jsonb_array_elements(v_lista) as e
  where (e ->> 'ativa')::boolean and (e ->> 'atende_visitas')::boolean;

  return pg_catalog.jsonb_build_object(
    'dia', v_dia,
    'hoje', v_hoje,
    'semana_inicio', v_inicio,
    'documento_aviso_dias', v_aviso,
    'limite_visitas_dia', privado.limite_visitas_dia(),
    'documento_tipos', case when pg_catalog.jsonb_typeof(v_tipos) = 'array' then v_tipos else '[]'::jsonb end,
    'resumo', v_resumo,
    'profissionais', v_lista);
end;
$$;
comment on function api.equipe(uuid, date, boolean) is '[P37 itens 1 e 6] Equipe para a coordenação e a diretoria (AAL2): cada profissional com o estado do dia e da semana (privado.status_profissional, sempre calculado), famílias em curso, ofertas sem resposta, documentos com situação (vencido, vencendo, em_dia, sem_validade) e bloqueios; mais o resumo do início. Filtro por região e por ativas.';


-- =============================================================================
-- 4. api.escala_semanal (P37 item 5)
--
-- Sete dias por dois turnos por profissional. Estado da célula, em ordem de
-- precedência: visita, folga, reservada, backup, oferta, livre. A célula
-- fica em conflito com mais de uma visita no turno ou visita em dia de
-- bloqueio; o dia fica em sobrecarga acima do limite de visitas.
-- =============================================================================

create function api.escala_semanal(
  semana     date default null,
  regiao_id  uuid default null
) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_hoje    date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  v_inicio  date;
  v_todas   boolean;
  v_limite  integer := privado.limite_visitas_dia();
  v_antes   integer;
  v_depois  integer;
  v_turnos  text[] := array['manha', 'tarde'];
  v_pr      record;
  v_dia     date;
  v_turno   text;
  v_estado  text;
  v_visitas integer;
  v_total   integer;
  v_sem_turno integer;
  v_folga   boolean;
  v_dias    jsonb;
  v_celulas jsonb;
  v_lista   jsonb := '[]'::jsonb;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  v_todas := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');
  v_inicio := pg_catalog.date_trunc('week', coalesce(escala_semanal.semana, v_hoje))::date;

  select (p.valor ->> 'antes')::integer, (p.valor ->> 'depois')::integer
    into v_antes, v_depois
  from public.parametro p
  where p.chave = 'janela_dpp_dias';
  if v_antes is null or v_depois is null then
    raise exception 'parametro janela_dpp_dias ausente ou incompleto: a escala não é calculada sem a janela da DPP (PRD 6.5, 10.2)'
      using errcode = '22023';
  end if;

  for v_pr in
    select pr.id, pr.nome
    from public.profissional pr
    where pr.ativa and pr.funcao <> 'coordenacao'
      and (case when v_todas then escala_semanal.regiao_id is null or escala_semanal.regiao_id = any (pr.regioes)
                else pr.usuario_id = auth.uid() end)
    order by pg_catalog.lower(pr.nome), pr.id
  loop
    v_dias := '[]'::jsonb;
    for i in 0..6 loop
      v_dia := v_inicio + i;
      v_folga := exists (select 1 from public.bloqueio_agenda b
                         where b.profissional_id = v_pr.id and v_dia between b.inicio and b.fim);
      select count(*)::integer into v_total
      from public.visita v
      where v.profissional_id = v_pr.id and v.data = v_dia and privado.visita_ocupa_agenda(v.estado);

      v_celulas := '{}'::jsonb;
      v_sem_turno := v_total;
      foreach v_turno in array v_turnos loop
        select count(*)::integer into v_visitas
        from public.visita v
        join public.acompanhamento a on a.id = v.acompanhamento_id
        where v.profissional_id = v_pr.id and v.data = v_dia and privado.visita_ocupa_agenda(v.estado)
          and privado.turno_da_visita(v.hora_prevista, a.periodo) = v_turno;
        v_sem_turno := v_sem_turno - v_visitas;

        if v_visitas > 0 then
          v_estado := 'visita';
        elsif v_folga then
          v_estado := 'folga';
        elsif exists (
          select 1
          from public.designacao d
          join public.acompanhamento a on a.id = d.acompanhamento_id
          join public.familia f on f.id = a.familia_id
          where d.profissional_id = v_pr.id and d.papel = 'titular' and d.status = 'aceita'
            and a.estado = 'aguardando' and f.data_nascimento is null and f.dpp is not null
            and v_dia between f.dpp - v_antes and f.dpp + v_depois
            and coalesce(privado.turno_da_visita(null, a.periodo), v_turno) = v_turno) then
          v_estado := 'reservada';
        elsif exists (
          select 1
          from public.designacao d
          join public.acompanhamento a on a.id = d.acompanhamento_id
          join public.familia f on f.id = a.familia_id
          where d.profissional_id = v_pr.id and d.papel = 'backup' and d.status = 'aceita'
            and a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico')
            and f.dpp is not null
            and v_dia between f.dpp - v_antes and f.dpp + v_depois
            and coalesce(privado.turno_da_visita(null, a.periodo), v_turno) = v_turno) then
          v_estado := 'backup';
        elsif exists (
          select 1
          from public.designacao d
          join public.acompanhamento a on a.id = d.acompanhamento_id
          join public.familia f on f.id = a.familia_id
          where d.profissional_id = v_pr.id and d.status = 'oferecida'
            and f.dpp is not null
            and v_dia between f.dpp - v_antes and f.dpp + v_depois
            and coalesce(privado.turno_da_visita(null, a.periodo), v_turno) = v_turno) then
          v_estado := 'oferta';
        else
          v_estado := 'livre';
        end if;

        v_celulas := v_celulas || pg_catalog.jsonb_build_object(
          v_turno, pg_catalog.jsonb_build_object(
            'estado', v_estado,
            'visitas', v_visitas,
            'conflito', v_visitas > 1 or (v_visitas > 0 and v_folga)));
      end loop;

      v_dias := v_dias || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'dia', v_dia,
        'turnos', v_celulas,
        'visitas', v_total,
        'sem_turno', v_sem_turno,
        'sobrecarga', v_total > v_limite,
        'folga', v_folga));
    end loop;

    v_lista := v_lista || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'profissional_id', v_pr.id, 'nome', v_pr.nome, 'dias', v_dias));
  end loop;

  return pg_catalog.jsonb_build_object(
    'semana_inicio', v_inicio,
    'limite_visitas_dia', v_limite,
    'profissionais', v_lista);
end;
$$;
comment on function api.escala_semanal(date, uuid) is '[P37 item 5] Escala da semana (segunda a domingo): por profissional ativa que faz visita, sete dias por dois turnos (manha, tarde), com o estado de cada célula (visita, folga, reservada, backup, oferta, livre), conflito e sobrecarga. Coordenação e diretoria veem todas (filtro por região); a enfermeira só a própria. AAL2.';


-- =============================================================================
-- 5. api.agenda (P37 item 2)
-- =============================================================================

create function api.agenda(
  desde            date,
  ate              date,
  profissional_id  uuid default null
) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_lista jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);

  if agenda.desde is null or agenda.ate is null or agenda.ate < agenda.desde then
    perform privado.equipe_recusar('periodo_invalido');
  end if;
  if agenda.ate - agenda.desde > 62 then
    perform privado.equipe_recusar('periodo_longo');
  end if;

  select pg_catalog.jsonb_agg(t.item order by t.data, t.hora nulls last, t.nome, t.id)
    into v_lista
  from (
    select v.id, v.data, v.hora_prevista as hora, pr.nome,
           pg_catalog.jsonb_build_object(
             'visita_id', v.id,
             'acompanhamento_id', a.id,
             'familia_id', f.id,
             'nome_exibicao', f.nome_exibicao,
             'bairro', f.bairro,
             'cidade', c.nome,
             'dia_numero', v.dia_numero,
             'dias_contratados', a.dias_contratados,
             'data', v.data,
             'hora_prevista', v.hora_prevista,
             'horas_por_visita', a.horas_por_visita,
             'turno', privado.turno_da_visita(v.hora_prevista, a.periodo),
             'estado', v.estado,
             'profissional_id', pr.id,
             'profissional_nome', pr.nome,
             'movivel', privado.visita_movivel(v.estado),
             'conflitos', case when privado.visita_ocupa_agenda(v.estado)
                               then privado.conflitos_visita(pr.id, v.data, v.hora_prevista, a.id, v.id)
                               else '[]'::jsonb end) as item
    from public.visita v
    join public.acompanhamento a on a.id = v.acompanhamento_id
    join public.familia f on f.id = a.familia_id
    join public.profissional pr on pr.id = v.profissional_id
    left join public.cidade c on c.id = f.cidade_id
    where v.data between agenda.desde and agenda.ate
      and (agenda.profissional_id is null or v.profissional_id = agenda.profissional_id)
  ) t;

  return pg_catalog.jsonb_build_object(
    'desde', agenda.desde,
    'ate', agenda.ate,
    'limite_visitas_dia', privado.limite_visitas_dia(),
    'visitas', coalesce(v_lista, '[]'::jsonb));
end;
$$;
comment on function api.agenda(date, date, uuid) is '[P37 item 2] Visitas do período (até 62 dias), de todas as profissionais ou de uma, com dia, hora, turno, estado e os conflitos de cada uma. Coordenação e diretoria, AAL2.';


-- =============================================================================
-- 6. api.reagendar_visita e api.reagendar_cascata (P37 itens 3 e 4)
-- =============================================================================

create function api.reagendar_visita(
  visita_id        uuid,
  data             date,
  hora_prevista    time default null,
  profissional_id  uuid default null,
  motivo           text default null,
  simular          boolean default false,
  forcar           boolean default false
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_visita    public.visita;
  v_a         public.acompanhamento;
  v_hora      time;
  v_prof      uuid;
  v_conflitos jsonb;
  v_motivo    text := nullif(pg_catalog.btrim(reagendar_visita.motivo), '');
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if reagendar_visita.visita_id is null or reagendar_visita.data is null then
    perform privado.equipe_recusar('dados_obrigatorios', 'visita_id e data');
  end if;

  select v.* into v_visita from public.visita v where v.id = reagendar_visita.visita_id for update;
  if not found then
    perform privado.equipe_recusar('visita_inexistente');
  end if;
  if not privado.visita_movivel(v_visita.estado) then
    perform privado.equipe_recusar('visita_nao_movivel', v_visita.estado::text);
  end if;
  select a.* into v_a from public.acompanhamento a where a.id = v_visita.acompanhamento_id;

  v_hora := coalesce(reagendar_visita.hora_prevista, v_visita.hora_prevista);
  v_prof := coalesce(reagendar_visita.profissional_id, v_visita.profissional_id);

  if v_prof <> v_visita.profissional_id and not exists (
       select 1 from public.designacao d
       where d.acompanhamento_id = v_a.id and d.profissional_id = v_prof and d.status = 'aceita') then
    perform privado.equipe_recusar('sem_designacao');
  end if;

  v_conflitos := privado.conflitos_visita(v_prof, reagendar_visita.data, v_hora, v_a.id, v_visita.id);

  if coalesce(reagendar_visita.simular, false) then
    return pg_catalog.jsonb_build_object('ok', true, 'simulado', true, 'conflitos', v_conflitos);
  end if;

  if pg_catalog.jsonb_array_length(v_conflitos) > 0 then
    if not coalesce(reagendar_visita.forcar, false) then
      perform privado.equipe_recusar('conflito', (
        select pg_catalog.string_agg(c ->> 'codigo', ',') from pg_catalog.jsonb_array_elements(v_conflitos) c));
    end if;
    if v_motivo is null then
      perform privado.equipe_recusar('motivo_obrigatorio');
    end if;
  end if;

  perform privado.mover_visita(v_visita.id, reagendar_visita.data, v_hora, v_prof, v_motivo);

  insert into public.notificacao (usuario_id, prioridade, titulo, link)
  select distinct pr.usuario_id, 'normal'::public.prioridade, 'visita_reagendada', '/hoje'
  from public.profissional pr
  where pr.id in (v_prof, v_visita.profissional_id) and pr.usuario_id is not null;

  perform privado.equipe_log('visita_reagendada', 'visita', v_visita.id::text,
    pg_catalog.jsonb_build_object('data', v_visita.data, 'hora_prevista', v_visita.hora_prevista,
                                  'profissional_id', v_visita.profissional_id),
    pg_catalog.jsonb_build_object('data', reagendar_visita.data, 'hora_prevista', v_hora,
                                  'profissional_id', v_prof,
                                  'com_conflito', pg_catalog.jsonb_array_length(v_conflitos) > 0));

  return pg_catalog.jsonb_build_object('ok', true, 'simulado', false, 'conflitos', v_conflitos, 'por', v_uid);
end;
$$;
comment on function api.reagendar_visita(uuid, date, time, uuid, text, boolean, boolean) is '[P37 itens 3 e 4] Muda dia, hora e profissional de uma visita ainda não começada. simular = true só devolve os conflitos (a tela mostra antes de salvar). Com conflito, só grava com forcar e motivo. Hora nula mantém a hora (logo o período). Outra profissional precisa ter designação aceita na família. Passa pela máquina de estados (reagendada e de volta a agendada), avisa a profissional e grava log. Coordenação e diretoria, AAL2.';

create function api.reagendar_cascata(
  acompanhamento_id  uuid,
  nova_data_inicio   date,
  motivo             text default null,
  simular            boolean default false,
  forcar             boolean default false
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_a         public.acompanhamento;
  v_primeira  date;
  v_delta     integer;
  v_motivo    text := nullif(pg_catalog.btrim(reagendar_cascata.motivo), '');
  v_visita    record;
  v_conflitos jsonb;
  v_todos     jsonb := '[]'::jsonb;
  v_movidas   jsonb := '[]'::jsonb;
  v_nova      date;
  v_total     integer := 0;
  v_profs     uuid[] := '{}';
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if reagendar_cascata.acompanhamento_id is null or reagendar_cascata.nova_data_inicio is null then
    perform privado.equipe_recusar('dados_obrigatorios', 'acompanhamento_id e nova_data_inicio');
  end if;

  select a.* into v_a from public.acompanhamento a
  where a.id = reagendar_cascata.acompanhamento_id for update;
  if not found then
    perform privado.equipe_recusar('acompanhamento_inexistente');
  end if;

  select min(v.data) into v_primeira
  from public.visita v
  where v.acompanhamento_id = v_a.id and privado.visita_movivel(v.estado);
  if v_primeira is null then
    perform privado.equipe_recusar('nada_a_reagendar');
  end if;
  v_delta := reagendar_cascata.nova_data_inicio - v_primeira;

  -- Aplica na ordem do sentido do deslocamento (para frente, da última para
  -- a primeira), para nunca haver duas visitas da família no mesmo dia no
  -- meio do caminho. As visitas da mesma família não contam como conflito
  -- entre si, então a simulação lê o estado de agora sem gravar nada.
  for v_visita in
    select v.id, v.dia_numero, v.data, v.hora_prevista, v.profissional_id
    from public.visita v
    where v.acompanhamento_id = v_a.id and privado.visita_movivel(v.estado)
    order by case when v_delta >= 0 then -v.dia_numero else v.dia_numero end
  loop
    v_nova := v_visita.data + v_delta;
    v_conflitos := privado.conflitos_visita(v_visita.profissional_id, v_nova, v_visita.hora_prevista, v_a.id, v_visita.id);
    v_total := v_total + pg_catalog.jsonb_array_length(v_conflitos);
    v_movidas := v_movidas || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'visita_id', v_visita.id, 'dia_numero', v_visita.dia_numero,
      'de', v_visita.data, 'para', v_nova, 'hora_prevista', v_visita.hora_prevista,
      'profissional_id', v_visita.profissional_id, 'conflitos', v_conflitos));
    if not (v_visita.profissional_id = any (v_profs)) then
      v_profs := v_profs || v_visita.profissional_id;
    end if;

    if not coalesce(reagendar_cascata.simular, false) and v_delta <> 0 then
      if pg_catalog.jsonb_array_length(v_conflitos) > 0 then
        if not coalesce(reagendar_cascata.forcar, false) then
          perform privado.equipe_recusar('conflito', 'dia ' || v_visita.dia_numero::text);
        end if;
        if v_motivo is null then
          perform privado.equipe_recusar('motivo_obrigatorio');
        end if;
      end if;
      perform privado.mover_visita(v_visita.id, v_nova, v_visita.hora_prevista, v_visita.profissional_id, v_motivo);
    end if;
  end loop;

  -- ordena por dia para a resposta
  select coalesce(pg_catalog.jsonb_agg(m order by (m ->> 'dia_numero')::integer), '[]'::jsonb)
    into v_movidas
  from pg_catalog.jsonb_array_elements(v_movidas) m;

  if not coalesce(reagendar_cascata.simular, false) and v_delta <> 0 then
    insert into public.notificacao (usuario_id, prioridade, titulo, link)
    select pr.usuario_id, 'normal'::public.prioridade, 'visita_reagendada', '/hoje'
    from public.profissional pr
    where pr.id = any (v_profs) and pr.usuario_id is not null;

    perform privado.equipe_log('visitas_reagendadas_em_cascata', 'acompanhamento', v_a.id::text,
      pg_catalog.jsonb_build_object('primeira_visita', v_primeira),
      pg_catalog.jsonb_build_object('primeira_visita', reagendar_cascata.nova_data_inicio,
                                    'visitas', pg_catalog.jsonb_array_length(v_movidas),
                                    'com_conflito', v_total > 0));
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'simulado', coalesce(reagendar_cascata.simular, false),
    'deslocamento_dias', v_delta,
    'conflitos_total', v_total,
    'visitas', v_movidas);
end;
$$;
comment on function api.reagendar_cascata(uuid, date, text, boolean, boolean) is '[P37 item 4] Reagendamento em cascata quando o nascimento ou a alta mudam: a primeira visita ainda não começada vai para nova_data_inicio e as outras andam o mesmo número de dias, com o mesmo horário (logo o mesmo período) e a mesma profissional. simular = true mostra o resultado e os conflitos sem gravar. Conflito só grava com forcar e motivo. Cada visita passa pela máquina de estados. Coordenação e diretoria, AAL2.';


-- =============================================================================
-- 7. Cadastro: profissional, documento e bloqueio (P37 item 1)
-- =============================================================================

create function api.salvar_profissional(
  id                               uuid,
  nome                             text,
  funcao                           text,
  conselho_uf                      text,
  conselho_numero                  text,
  telefone_e164                    text,
  regioes                          uuid[],
  vinculo                          public.vinculo_profissional,
  valor_hora_centavos              integer,
  adicional_deslocamento_centavos  integer,
  ativa                            boolean,
  usuario_id                       uuid default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_id      uuid := salvar_profissional.id;
  v_nome    text := nullif(pg_catalog.btrim(salvar_profissional.nome), '');
  v_numero  text := nullif(pg_catalog.btrim(salvar_profissional.conselho_numero), '');
  v_uf      text := nullif(pg_catalog.upper(pg_catalog.btrim(salvar_profissional.conselho_uf)), '');
  v_tel     text := nullif(pg_catalog.btrim(salvar_profissional.telefone_e164), '');
  v_regioes uuid[] := coalesce(salvar_profissional.regioes, '{}');
  v_antes   public.profissional;
  v_novo    boolean;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if v_nome is null or pg_catalog.length(v_nome) > 120 then
    perform privado.equipe_recusar('nome_obrigatorio');
  end if;
  if salvar_profissional.funcao is null
     or salvar_profissional.funcao not in ('enfermeira_obstetrica', 'enfermeira_neonatal', 'coordenacao') then
    perform privado.equipe_recusar('funcao_invalida');
  end if;
  if v_tel is not null and v_tel !~ '^\+[1-9][0-9]{7,14}$' then
    perform privado.equipe_recusar('telefone_invalido');
  end if;
  if (v_numero is null) <> (v_uf is null) then
    perform privado.equipe_recusar('conselho_incompleto');
  end if;
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then
    perform privado.equipe_recusar('conselho_incompleto', 'uf');
  end if;
  if exists (select 1 from pg_catalog.unnest(v_regioes) r(id)
             where not exists (select 1 from public.regiao rg where rg.id = r.id)) then
    perform privado.equipe_recusar('regiao_inexistente');
  end if;
  if salvar_profissional.valor_hora_centavos < 0 or salvar_profissional.adicional_deslocamento_centavos < 0 then
    perform privado.equipe_recusar('valor_invalido');
  end if;
  if salvar_profissional.vinculo is null then
    perform privado.equipe_recusar('vinculo_obrigatorio');
  end if;
  if salvar_profissional.usuario_id is not null
     and not exists (select 1 from public.perfil p where p.id = salvar_profissional.usuario_id) then
    perform privado.equipe_recusar('usuario_inexistente');
  end if;
  if salvar_profissional.usuario_id is not null and exists (
       select 1 from public.profissional o
       where o.usuario_id = salvar_profissional.usuario_id and o.id is distinct from v_id) then
    perform privado.equipe_recusar('usuario_ja_vinculado');
  end if;

  v_novo := v_id is null or not exists (select 1 from public.profissional p where p.id = v_id);
  if v_id is null then
    v_id := pg_catalog.gen_random_uuid();
  end if;

  if v_novo then
    insert into public.profissional (id, criado_por, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero,
                                     telefone_e164, regioes, vinculo, valor_hora_centavos,
                                     adicional_deslocamento_centavos, ativa)
    values (v_id, auth.uid(), salvar_profissional.usuario_id, v_nome, salvar_profissional.funcao,
            case when v_numero is not null then 'COREN' end, v_uf, v_numero,
            v_tel, v_regioes, salvar_profissional.vinculo, salvar_profissional.valor_hora_centavos,
            coalesce(salvar_profissional.adicional_deslocamento_centavos, 0), coalesce(salvar_profissional.ativa, true));
  else
    select p.* into v_antes from public.profissional p where p.id = v_id for update;
    update public.profissional p
       set usuario_id = salvar_profissional.usuario_id,
           nome = v_nome,
           funcao = salvar_profissional.funcao,
           conselho = case when v_numero is not null then 'COREN' end,
           conselho_uf = v_uf,
           conselho_numero = v_numero,
           telefone_e164 = v_tel,
           regioes = v_regioes,
           vinculo = salvar_profissional.vinculo,
           valor_hora_centavos = salvar_profissional.valor_hora_centavos,
           adicional_deslocamento_centavos = coalesce(salvar_profissional.adicional_deslocamento_centavos, 0),
           ativa = coalesce(salvar_profissional.ativa, p.ativa)
     where p.id = v_id;
  end if;

  -- perfil.profissional_id "se for enfermeira" acompanha o vínculo
  if v_antes.usuario_id is not null and v_antes.usuario_id is distinct from salvar_profissional.usuario_id then
    update public.perfil pf set profissional_id = null
     where pf.id = v_antes.usuario_id and pf.profissional_id = v_id;
  end if;
  if salvar_profissional.usuario_id is not null then
    update public.perfil pf set profissional_id = v_id where pf.id = salvar_profissional.usuario_id;
  end if;

  perform privado.equipe_log(case when v_novo then 'profissional_criada' else 'profissional_alterada' end,
    'profissional', v_id::text, null,
    pg_catalog.jsonb_build_object('ativa', coalesce(salvar_profissional.ativa, true), 'funcao', salvar_profissional.funcao));

  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id, 'nova', v_novo);
end;
$$;
comment on function api.salvar_profissional(uuid, text, text, text, text, text, uuid[], public.vinculo_profissional, integer, integer, boolean, uuid) is '[P37 item 1] Cadastra ou altera uma profissional (conselho e UF, regiões, vínculo, valor da hora e ajuda de deslocamento em centavos, ativa) e liga ao usuário. Valida função, telefone E.164, regiões e valores; mantém perfil.profissional_id. Desativar corta o acesso da enfermeira na hora (privado.familias_atribuidas). Coordenação e diretoria, AAL2.';

create function api.salvar_documento_profissional(
  id               uuid,
  profissional_id  uuid,
  tipo             text,
  numero           text,
  validade         date
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_id   uuid := salvar_documento_profissional.id;
  v_tipo text := nullif(pg_catalog.btrim(salvar_documento_profissional.tipo), '');
  v_novo boolean;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if v_tipo is null or pg_catalog.length(v_tipo) > 80 then
    perform privado.equipe_recusar('tipo_obrigatorio');
  end if;
  if not exists (select 1 from public.profissional p where p.id = salvar_documento_profissional.profissional_id) then
    perform privado.equipe_recusar('profissional_inexistente');
  end if;

  v_novo := v_id is null or not exists (select 1 from public.documento_profissional d where d.id = v_id);
  if v_id is null then
    v_id := pg_catalog.gen_random_uuid();
  end if;

  if v_novo then
    insert into public.documento_profissional (id, criado_por, profissional_id, tipo, numero, validade)
    values (v_id, auth.uid(), salvar_documento_profissional.profissional_id, v_tipo,
            nullif(pg_catalog.btrim(salvar_documento_profissional.numero), ''),
            salvar_documento_profissional.validade);
  else
    update public.documento_profissional d
       set tipo = v_tipo,
           numero = nullif(pg_catalog.btrim(salvar_documento_profissional.numero), ''),
           validade = salvar_documento_profissional.validade
     where d.id = v_id and d.profissional_id = salvar_documento_profissional.profissional_id;
    if not found then
      perform privado.equipe_recusar('documento_inexistente');
    end if;
  end if;

  perform privado.equipe_log(case when v_novo then 'documento_profissional_criado' else 'documento_profissional_alterado' end,
    'documento_profissional', v_id::text, null,
    pg_catalog.jsonb_build_object('profissional_id', salvar_documento_profissional.profissional_id,
                                  'validade', salvar_documento_profissional.validade));

  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
comment on function api.salvar_documento_profissional(uuid, uuid, text, text, date) is '[P37 item 1] Cadastra ou altera um documento com validade da profissional (PRD 6.5, O-02). O aviso 30 dias antes vem de automacao documento_vencendo. Coordenação e diretoria, AAL2.';

create function api.salvar_bloqueio_agenda(
  id               uuid,
  profissional_id  uuid,
  inicio           date,
  fim              date,
  motivo           text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_id     uuid := salvar_bloqueio_agenda.id;
  v_motivo text := nullif(pg_catalog.btrim(salvar_bloqueio_agenda.motivo), '');
  v_novo   boolean;
  v_afetadas jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if salvar_bloqueio_agenda.inicio is null or salvar_bloqueio_agenda.fim is null
     or salvar_bloqueio_agenda.fim < salvar_bloqueio_agenda.inicio then
    perform privado.equipe_recusar('periodo_invalido');
  end if;
  if v_motivo is null or pg_catalog.length(v_motivo) > 200 then
    perform privado.equipe_recusar('motivo_obrigatorio');
  end if;
  if not exists (select 1 from public.profissional p where p.id = salvar_bloqueio_agenda.profissional_id) then
    perform privado.equipe_recusar('profissional_inexistente');
  end if;

  v_novo := v_id is null or not exists (select 1 from public.bloqueio_agenda b where b.id = v_id);
  if v_id is null then
    v_id := pg_catalog.gen_random_uuid();
  end if;

  if v_novo then
    insert into public.bloqueio_agenda (id, criado_por, profissional_id, inicio, fim, motivo)
    values (v_id, auth.uid(), salvar_bloqueio_agenda.profissional_id, salvar_bloqueio_agenda.inicio,
            salvar_bloqueio_agenda.fim, v_motivo);
  else
    update public.bloqueio_agenda b
       set inicio = salvar_bloqueio_agenda.inicio, fim = salvar_bloqueio_agenda.fim, motivo = v_motivo
     where b.id = v_id and b.profissional_id = salvar_bloqueio_agenda.profissional_id;
    if not found then
      perform privado.equipe_recusar('bloqueio_inexistente');
    end if;
  end if;

  -- visitas já marcadas nesses dias: a tela pede o reagendamento
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'visita_id', v.id, 'data', v.data, 'dia_numero', v.dia_numero) order by v.data, v.id), '[]'::jsonb)
    into v_afetadas
  from public.visita v
  where v.profissional_id = salvar_bloqueio_agenda.profissional_id
    and v.data between salvar_bloqueio_agenda.inicio and salvar_bloqueio_agenda.fim
    and privado.visita_ocupa_agenda(v.estado)
    and privado.visita_movivel(v.estado);

  perform privado.equipe_log(case when v_novo then 'bloqueio_agenda_criado' else 'bloqueio_agenda_alterado' end,
    'bloqueio_agenda', v_id::text, null,
    pg_catalog.jsonb_build_object('profissional_id', salvar_bloqueio_agenda.profissional_id,
                                  'inicio', salvar_bloqueio_agenda.inicio, 'fim', salvar_bloqueio_agenda.fim));

  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id, 'visitas_afetadas', v_afetadas);
end;
$$;
comment on function api.salvar_bloqueio_agenda(uuid, uuid, date, date, text) is '[P37 item 1] Cadastra ou altera um bloqueio de agenda (folga, férias, impedimento). Devolve as visitas ainda não começadas que caem nos dias bloqueados, para a tela pedir o reagendamento. Coordenação e diretoria, AAL2.';

create function api.remover_bloqueio_agenda(id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_b public.bloqueio_agenda;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  delete from public.bloqueio_agenda b where b.id = remover_bloqueio_agenda.id returning b.* into v_b;
  if not found then
    perform privado.equipe_recusar('bloqueio_inexistente');
  end if;

  perform privado.equipe_log('bloqueio_agenda_removido', 'bloqueio_agenda', v_b.id::text,
    pg_catalog.jsonb_build_object('profissional_id', v_b.profissional_id, 'inicio', v_b.inicio, 'fim', v_b.fim), null);
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;
comment on function api.remover_bloqueio_agenda(uuid) is '[P37 item 1] Remove um bloqueio de agenda. Coordenação e diretoria, AAL2.';


-- =============================================================================
-- 8. Etapa documentos_vencendo do recálculo diário (P37 item 1, PRD 10.1)
--
-- 0011 procura privado.recalculo_<etapa>() pelo nome a cada rodada (7h em
-- Brasília). Agenda uma automacao_execucao de documento_vencendo por
-- documento (e por validade) que entrou nos dias de aviso ou já venceu; o
-- motor (0012, privado.processar_automacoes) chama pode_executar e aplica a
-- ação (notificar a coordenação). Sem família, não há o que frear.
-- =============================================================================

create function privado.recalculo_documentos_vencendo() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_hoje  date := (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_aviso integer;
  v_novas integer := 0;
  v_doc   record;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'documento_vencendo'), false) then
    return pg_catalog.jsonb_build_object('ativa', false);
  end if;
  v_aviso := privado.documento_aviso_dias();

  for v_doc in
    select d.id, d.validade, d.profissional_id
    from public.documento_profissional d
    join public.profissional pr on pr.id = d.profissional_id
    where pr.ativa
      and d.validade is not null
      and d.validade <= v_hoje + v_aviso
      and not exists (
        select 1 from public.automacao_execucao e
        where e.automacao_id = 'documento_vencendo'
          and e.payload ->> 'documento_id' = d.id::text
          and e.payload ->> 'validade' = d.validade::text)
    order by d.validade, d.id
  loop
    insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
    values ('documento_vencendo', null, pg_catalog.clock_timestamp(), 'agendada',
            pg_catalog.jsonb_build_object('documento_id', v_doc.id, 'validade', v_doc.validade,
                                          'profissional_id', v_doc.profissional_id));
    v_novas := v_novas + 1;
  end loop;

  return pg_catalog.jsonb_build_object('ativa', true, 'materializadas', v_novas);
end;
$$;
comment on function privado.recalculo_documentos_vencendo() is 'Etapa documentos_vencendo do recálculo diário (PRD 10.1, 10.2): agenda uma execução de documento_vencendo por documento e validade que entrou nos dias de aviso (automacao.gatilho.dias) ou já venceu, de profissional ativa. O motor de automações notifica a coordenação. Sem grant.';


-- =============================================================================
-- 9. Portal da enfermeira (P38)
--
-- Só a enfermeira com profissional ativa e só as famílias atribuídas
-- (privado.familias_atribuidas). Sem dado comercial. Cada família lida grava
-- 'leitura' no log antes de devolver; os acompanhamentos vêm de
-- assistencial.ler_acompanhamento, que grava a sua.
-- =============================================================================

-- A profissional da enfermeira logada, ou recusa.
create function privado.portal_profissional() returns public.profissional
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_pr public.profissional;
begin
  select pr.* into v_pr
  from public.profissional pr
  where pr.usuario_id = auth.uid() and pr.ativa;
  if not found then
    perform privado.equipe_recusar('sem_profissional');
  end if;
  return v_pr;
end;
$$;
comment on function privado.portal_profissional() is '[P38] Profissional ativa ligada ao usuário logado; recusa (equipe:sem_profissional) quando não há. Sem grant.';

create function api.portal_hoje(dia date default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_dia     date := coalesce(portal_hoje.dia, (pg_catalog.now() at time zone 'America/Sao_Paulo')::date);
  v_pr      public.profissional;
  v_visitas jsonb := '[]'::jsonb;
  v_fichas  jsonb;
  r         record;
begin
  perform privado.autorizar(array['enfermeira']::public.papel_usuario[], true);
  v_pr := privado.portal_profissional();

  for r in
    select v.id as v_id, v.dia_numero, v.data, v.hora_prevista, v.estado, v.checkin_em, v.checkout_em, v.versao,
           a.id as a_id, a.dias_contratados, a.horas_por_visita, a.periodo,
           f.id as f_id, f.nome_exibicao, f.bairro, f.endereco_atendimento, f.estado_sensivel, f.gemelar,
           c.nome as cidade, c.uf::text as uf,
           d.papel,
           ct.nome as contato_nome, ct.telefone_e164 as contato_telefone
    from public.visita v
    join public.acompanhamento a on a.id = v.acompanhamento_id
    join public.familia f on f.id = a.familia_id
    left join public.cidade c on c.id = f.cidade_id
    left join lateral (
      select d2.papel from public.designacao d2
      where d2.acompanhamento_id = a.id and d2.profissional_id = v_pr.id and d2.status = 'aceita'
      order by (d2.papel = 'titular') desc limit 1
    ) d on true
    left join lateral (
      select p.nome, p.telefone_e164
      from public.pessoa p
      where p.familia_id = f.id
      order by p.contato_principal desc, (p.papel = 'mae') desc, p.criado_em, p.id
      limit 1
    ) ct on true
    where v.profissional_id = v_pr.id
      and v.data = v_dia
      and privado.visita_ocupa_agenda(v.estado)
      and a.familia_id in (select fa.id from privado.familias_atribuidas() as fa(id))
    order by v.hora_prevista nulls last, f.nome_exibicao, v.id
  loop
    perform privado.registrar_leitura('familia', r.f_id::text,
      pg_catalog.jsonb_build_object('funcao', 'api.portal_hoje', 'dia', v_dia, 'visita_id', r.v_id));
    perform 1 from assistencial.ler_acompanhamento(r.f_id);

    v_visitas := v_visitas || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'visita_id', r.v_id,
      'acompanhamento_id', r.a_id,
      'familia_id', r.f_id,
      'nome_exibicao', r.nome_exibicao,
      'bairro', r.bairro,
      'endereco_atendimento', r.endereco_atendimento,
      'cidade', r.cidade,
      'uf', r.uf,
      'dia_numero', r.dia_numero,
      'dias_contratados', r.dias_contratados,
      'data', r.data,
      'hora_prevista', r.hora_prevista,
      'horas_por_visita', r.horas_por_visita,
      'turno', privado.turno_da_visita(r.hora_prevista, r.periodo),
      'estado', r.estado,
      'checkin_em', r.checkin_em,
      'checkout_em', r.checkout_em,
      'versao', r.versao,
      'papel', r.papel,
      'estado_sensivel', r.estado_sensivel,
      'gemelar', r.gemelar,
      'contato_nome', r.contato_nome,
      'contato_telefone', r.contato_telefone));
  end loop;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'visita_id', v.id, 'familia_id', f.id, 'nome_exibicao', f.nome_exibicao,
           'dia_numero', v.dia_numero, 'dias_contratados', a.dias_contratados,
           'data', v.data, 'estado', v.estado) order by v.data, v.id), '[]'::jsonb)
    into v_fichas
  from public.visita v
  join public.acompanhamento a on a.id = v.acompanhamento_id
  join public.familia f on f.id = a.familia_id
  where v.profissional_id = v_pr.id
    and v.estado in ('concluida', 'ficha_pendente')
    and a.familia_id in (select fa.id from privado.familias_atribuidas() as fa(id));

  return pg_catalog.jsonb_build_object(
    'dia', v_dia,
    'profissional', pg_catalog.jsonb_build_object('id', v_pr.id, 'nome', v_pr.nome),
    'status', privado.status_profissional(v_pr.id, v_dia)::text,
    'visitas', v_visitas,
    'fichas_pendentes', v_fichas);
end;
$$;
comment on function api.portal_hoje(date) is '[P38 item 1] Visitas do dia da enfermeira logada, só de famílias atribuídas, com endereço, período, contato, chegada e saída, mais as fichas pendentes (visita concluída sem ficha). Sem dado comercial. Grava a leitura de cada família no log e lê os acompanhamentos por assistencial.ler_acompanhamento. AAL2.';

create function api.portal_familias() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_pr    public.profissional;
  v_lista jsonb := '[]'::jsonb;
  r       record;
  v_acomp public.acompanhamento;
begin
  perform privado.autorizar(array['enfermeira']::public.papel_usuario[], true);
  v_pr := privado.portal_profissional();

  for r in
    select f.id as f_id, f.nome_exibicao, f.bairro, f.dpp, f.data_nascimento, f.data_alta, f.data_inicio_efetivo,
           f.gemelar, f.estado_sensivel, c.nome as cidade, c.uf::text as uf,
           d.papel
    from public.familia f
    left join public.cidade c on c.id = f.cidade_id
    join lateral (
      select d2.papel
      from public.designacao d2
      join public.acompanhamento a2 on a2.id = d2.acompanhamento_id
      where a2.familia_id = f.id and d2.profissional_id = v_pr.id and d2.status = 'aceita'
      order by (d2.papel = 'titular') desc, d2.criado_em desc
      limit 1
    ) d on true
    where f.id in (select fa.id from privado.familias_atribuidas() as fa(id))
    order by f.nome_exibicao, f.id
  loop
    perform privado.registrar_leitura('familia', r.f_id::text,
      pg_catalog.jsonb_build_object('funcao', 'api.portal_familias'));

    -- leitura auditada do acompanhamento mais recente da família
    select a.* into v_acomp
    from assistencial.ler_acompanhamento(r.f_id) a
    order by a.criado_em desc, a.id
    limit 1;

    v_lista := v_lista || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'familia_id', r.f_id,
      'nome_exibicao', r.nome_exibicao,
      'bairro', r.bairro,
      'cidade', r.cidade,
      'uf', r.uf,
      'dpp', r.dpp,
      'data_nascimento', r.data_nascimento,
      'data_alta', r.data_alta,
      'data_inicio_efetivo', r.data_inicio_efetivo,
      'gemelar', r.gemelar,
      'estado_sensivel', r.estado_sensivel,
      'papel', r.papel,
      'acompanhamento', case when v_acomp.id is null then null else pg_catalog.jsonb_build_object(
        'id', v_acomp.id, 'estado', v_acomp.estado, 'dias_contratados', v_acomp.dias_contratados,
        'periodo', v_acomp.periodo, 'inicio_efetivo', v_acomp.inicio_efetivo, 'encerramento', v_acomp.encerramento) end,
      'visitas', case when v_acomp.id is null then '[]'::jsonb else coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'visita_id', v.id, 'dia_numero', v.dia_numero, 'data', v.data, 'hora_prevista', v.hora_prevista,
                 'estado', v.estado, 'checkin_em', v.checkin_em, 'checkout_em', v.checkout_em,
                 'profissional_id', v.profissional_id) order by v.dia_numero, v.id)
        from public.visita v where v.acompanhamento_id = v_acomp.id), '[]'::jsonb) end));
  end loop;

  return v_lista;
end;
$$;
comment on function api.portal_familias() is '[P38 item 1] Famílias atribuídas à enfermeira logada (privado.familias_atribuidas), sem dado comercial, com o acompanhamento mais recente (lido por assistencial.ler_acompanhamento, que grava o log) e as visitas dele. Grava a leitura de cada família. AAL2.';

create function api.portal_perfil() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_pr    public.profissional;
  v_hoje  date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  v_aviso integer;
begin
  perform privado.autorizar(array['enfermeira']::public.papel_usuario[], true);
  v_pr := privado.portal_profissional();
  v_aviso := privado.documento_aviso_dias();

  return pg_catalog.jsonb_build_object(
    'profissional', pg_catalog.jsonb_build_object(
      'id', v_pr.id, 'nome', v_pr.nome, 'funcao', v_pr.funcao,
      'conselho', v_pr.conselho, 'conselho_uf', v_pr.conselho_uf, 'conselho_numero', v_pr.conselho_numero,
      'telefone_e164', v_pr.telefone_e164, 'regioes', pg_catalog.to_jsonb(v_pr.regioes)),
    'status', privado.status_profissional(v_pr.id, v_hoje)::text,
    'documentos', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', d.id, 'tipo', d.tipo, 'numero', d.numero, 'validade', d.validade,
               'situacao', case when d.validade is null then 'sem_validade'
                                when d.validade < v_hoje then 'vencido'
                                when d.validade <= v_hoje + v_aviso then 'vencendo'
                                else 'em_dia' end) order by d.validade nulls last, d.tipo, d.id)
      from public.documento_profissional d where d.profissional_id = v_pr.id), '[]'::jsonb),
    'bloqueios', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', b.id, 'inicio', b.inicio, 'fim', b.fim) order by b.inicio, b.id)
      from public.bloqueio_agenda b where b.profissional_id = v_pr.id and b.fim >= v_hoje), '[]'::jsonb));
end;
$$;
comment on function api.portal_perfil() is '[P38 item 1] Perfil da enfermeira logada: cadastro, estado de hoje (calculado), documentos com situação e bloqueios que ainda valem. Sem valor da hora nem dado financeiro. AAL2.';


-- =============================================================================
-- 10. Chegada e saída (P38 item 1, acompanha PRD 15)
--
-- A hora é a do aparelho quando a enfermeira estava sem sinal (quando). Vale
-- o dia da visita, no fuso da operação, nunca no futuro (tolerância em
-- parametro.visita_registro_horario). Idempotente: registrar de novo devolve
-- o que já está gravado, sem mexer (o aparelho reenvia sem medo). O estado
-- da visita anda pela máquina do PRD 7.3, passo a passo, numa transação só.
-- =============================================================================

create function privado.visita_do_portal(visita_id uuid) returns public.visita
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_pr public.profissional;
  v_v  public.visita;
begin
  v_pr := privado.portal_profissional();
  select v.* into v_v from public.visita v where v.id = visita_do_portal.visita_id for update;
  if not found or v_v.profissional_id <> v_pr.id
     or not exists (select 1 from public.acompanhamento a
                    where a.id = v_v.acompanhamento_id
                      and a.familia_id in (select fa.id from privado.familias_atribuidas() as fa(id))) then
    raise exception 'visita não atribuída a esta profissional (PRD 13)'
      using errcode = '42501';
  end if;
  return v_v;
end;
$$;
comment on function privado.visita_do_portal(uuid) is '[P38] Visita da enfermeira logada, de família atribuída, travada para atualização; recusa com 42501 caso contrário. Sem grant.';

create function privado.horario_do_registro(quando timestamptz, data_visita date) returns timestamptz
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_cfg     jsonb;
  v_tol     integer;
  v_max     integer;
  v_quando  timestamptz := coalesce(horario_do_registro.quando, pg_catalog.now());
begin
  select p.valor into v_cfg from public.parametro p where p.chave = 'visita_registro_horario';
  v_tol := (v_cfg ->> 'tolerancia_futuro_minutos')::integer;
  v_max := (v_cfg ->> 'max_atraso_horas')::integer;
  if v_tol is null or v_max is null then
    raise exception 'parametro visita_registro_horario ausente ou incompleto (P38)'
      using errcode = '22023';
  end if;

  if v_quando > pg_catalog.now() + pg_catalog.make_interval(mins => v_tol) then
    perform privado.equipe_recusar('hora_no_futuro');
  end if;
  if v_quando < pg_catalog.now() - pg_catalog.make_interval(hours => v_max) then
    perform privado.equipe_recusar('hora_muito_antiga');
  end if;
  if (v_quando at time zone 'America/Sao_Paulo')::date <> horario_do_registro.data_visita then
    perform privado.equipe_recusar('fora_do_dia_da_visita');
  end if;
  return v_quando;
end;
$$;
comment on function privado.horario_do_registro(timestamptz, date) is '[P38] Confere a hora de chegada ou saída: não no futuro (mais a tolerância), não mais velha que o máximo e no dia da visita, no fuso da operação. Limites em parametro.visita_registro_horario. Sem grant.';

create function api.registrar_chegada(
  visita_id           uuid,
  quando              timestamptz default null,
  via_sincronizacao   boolean default false
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_v       public.visita;
  v_quando  timestamptz;
  v_versao  integer;
begin
  perform privado.autorizar(array['enfermeira']::public.papel_usuario[], true);
  perform pg_catalog.set_config('app.origem',
    case when coalesce(registrar_chegada.via_sincronizacao, false) then 'sync' else 'app' end, true);

  v_v := privado.visita_do_portal(registrar_chegada.visita_id);

  if v_v.checkin_em is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'ja_registrada', true,
      'checkin_em', v_v.checkin_em, 'estado', v_v.estado, 'versao', v_v.versao);
  end if;
  if v_v.estado not in ('agendada', 'confirmada', 'a_caminho') then
    perform privado.equipe_recusar('estado_nao_permite_chegada', v_v.estado::text);
  end if;

  v_quando := privado.horario_do_registro(registrar_chegada.quando, v_v.data);

  if v_v.estado = 'agendada' then
    perform privado.transicionar('visita', v_v.id, 'confirmada');
  end if;
  if v_v.estado in ('agendada', 'confirmada') then
    perform privado.transicionar('visita', v_v.id, 'a_caminho');
  end if;
  perform privado.transicionar('visita', v_v.id, 'iniciada');

  update public.visita v set checkin_em = v_quando where v.id = v_v.id;

  select v.versao into v_versao from public.visita v where v.id = v_v.id;
  perform privado.equipe_log('visita_chegada', 'visita', v_v.id::text, null,
    pg_catalog.jsonb_build_object('checkin_em', v_quando));

  return pg_catalog.jsonb_build_object('ok', true, 'ja_registrada', false,
    'checkin_em', v_quando, 'estado', 'iniciada', 'versao', v_versao);
end;
$$;
comment on function api.registrar_chegada(uuid, timestamptz, boolean) is '[P38 item 1] Grava a chegada da enfermeira na visita (hora do aparelho quando sem sinal) e leva o estado a iniciada, passo a passo pela máquina do PRD 7.3. Só a própria visita de família atribuída, no dia dela. Idempotente. O estado calculado da profissional passa a em_visita. AAL2.';

create function api.registrar_saida(
  visita_id           uuid,
  quando              timestamptz default null,
  via_sincronizacao   boolean default false
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_v       public.visita;
  v_quando  timestamptz;
  v_versao  integer;
begin
  perform privado.autorizar(array['enfermeira']::public.papel_usuario[], true);
  perform pg_catalog.set_config('app.origem',
    case when coalesce(registrar_saida.via_sincronizacao, false) then 'sync' else 'app' end, true);

  v_v := privado.visita_do_portal(registrar_saida.visita_id);

  if v_v.checkout_em is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'ja_registrada', true,
      'checkout_em', v_v.checkout_em, 'estado', v_v.estado, 'versao', v_v.versao);
  end if;
  if v_v.checkin_em is null or v_v.estado <> 'iniciada' then
    perform privado.equipe_recusar('saida_sem_chegada', v_v.estado::text);
  end if;

  v_quando := privado.horario_do_registro(registrar_saida.quando, v_v.data);
  if v_quando < v_v.checkin_em then
    perform privado.equipe_recusar('saida_antes_da_chegada');
  end if;

  perform privado.transicionar('visita', v_v.id, 'concluida');
  perform privado.transicionar('visita', v_v.id, 'ficha_pendente');

  update public.visita v set checkout_em = v_quando where v.id = v_v.id;

  select v.versao into v_versao from public.visita v where v.id = v_v.id;
  perform privado.equipe_log('visita_saida', 'visita', v_v.id::text, null,
    pg_catalog.jsonb_build_object('checkout_em', v_quando));

  return pg_catalog.jsonb_build_object('ok', true, 'ja_registrada', false,
    'checkout_em', v_quando, 'estado', 'ficha_pendente', 'versao', v_versao);
end;
$$;
comment on function api.registrar_saida(uuid, timestamptz, boolean) is '[P38 item 1] Grava a saída da enfermeira (hora do aparelho quando sem sinal) e leva o estado a ficha_pendente (concluída, com a ficha por assinar), pela máquina do PRD 7.3. Exige a chegada, não aceita saída antes dela. Idempotente. O estado calculado da profissional volta ao de antes. AAL2.';


-- =============================================================================
-- 10b. Itens já processados da fila do aparelho (P12 + P38)
--
-- POST /api/sync é idempotente pelo id do item (gerado no aparelho): se a
-- resposta se perde, o aparelho reenvia o mesmo item, e reaplicar daria
-- conflito de versão com o próprio efeito. fila_sincronizacao guarda o
-- item, mas o app não tem grant em status nem em conflito (o servidor
-- processa a fila); estas duas funções são a porta do servidor de
-- sincronização, com a sessão da própria pessoa, sem chave de serviço.
-- =============================================================================

create function api.sincronizacao_item(item_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_r public.fila_sincronizacao;
begin
  perform privado.autorizar(
    array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], true);

  select f.* into v_r
  from public.fila_sincronizacao f
  where f.id = sincronizacao_item.item_id and f.usuario_id = auth.uid();
  if not found then
    return null;
  end if;

  return pg_catalog.jsonb_build_object(
    'status', v_r.status, 'conflito', v_r.conflito, 'entidade', v_r.entidade, 'entidade_id', v_r.entidade_id);
end;
$$;
comment on function api.sincronizacao_item(uuid) is '[P12/P38] Item da fila do aparelho que o servidor já processou (só o do próprio usuário): status (processado ou conflito) e o conflito guardado. Nulo quando não foi processado. AAL2.';

create function api.sincronizacao_registrar(
  item_id               uuid,
  entidade              text,
  entidade_id           uuid,
  campo                 text,
  payload               jsonb,
  versao_base           integer,
  criado_no_cliente_em  timestamptz,
  status                public.status_sync,
  conflito              jsonb default null
) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(
    array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], true);

  if sincronizacao_registrar.status not in ('processado', 'conflito') then
    perform privado.equipe_recusar('status_invalido');
  end if;
  if sincronizacao_registrar.entidade not in
       ('consulta_prenatal', 'visita', 'anexo_audio', 'alerta_clinico', 'registro_atendimento') then
    perform privado.equipe_recusar('entidade_invalida');
  end if;

  insert into public.fila_sincronizacao (id, usuario_id, entidade, entidade_id, campo, payload, versao_base,
                                         criado_no_cliente_em, status, conflito)
  values (sincronizacao_registrar.item_id, auth.uid(), sincronizacao_registrar.entidade,
          sincronizacao_registrar.entidade_id, sincronizacao_registrar.campo,
          coalesce(sincronizacao_registrar.payload, 'null'::jsonb), sincronizacao_registrar.versao_base,
          sincronizacao_registrar.criado_no_cliente_em, sincronizacao_registrar.status,
          sincronizacao_registrar.conflito)
  on conflict (id) do nothing;
end;
$$;
comment on function api.sincronizacao_registrar(uuid, text, uuid, text, jsonb, integer, timestamptz, public.status_sync, jsonb) is '[P12/P38] Guarda um item da fila do aparelho já processado pelo servidor (processado ou conflito), para reenviar o mesmo id nunca reaplicar. Grava em nome do próprio usuário; item repetido é ignorado. AAL2.';


-- =============================================================================
-- 11. Privilégios
-- =============================================================================

revoke execute on function privado.equipe_recusar(text, text)                                 from public, anon, authenticated, service_role;
revoke execute on function privado.equipe_log(text, text, text, jsonb, jsonb)                 from public, anon, authenticated, service_role;
revoke execute on function privado.visita_movivel(public.estado_visita)                       from public, anon, authenticated, service_role;
revoke execute on function privado.visita_ocupa_agenda(public.estado_visita)                  from public, anon, authenticated, service_role;
revoke execute on function privado.turno_da_visita(time, public.periodo_visita)               from public, anon, authenticated, service_role;
revoke execute on function privado.limite_visitas_dia()                                       from public, anon, authenticated, service_role;
revoke execute on function privado.documento_aviso_dias()                                     from public, anon, authenticated, service_role;
revoke execute on function privado.dia_do_acompanhamento(uuid, date)                          from public, anon, authenticated, service_role;
revoke execute on function privado.conflitos_visita(uuid, date, time, uuid, uuid)             from public, anon, authenticated, service_role;
revoke execute on function privado.mover_visita(uuid, date, time, uuid, text)                 from public, anon, authenticated, service_role;
revoke execute on function privado.recalculo_documentos_vencendo()                            from public, anon, authenticated, service_role;
revoke execute on function privado.portal_profissional()                                      from public, anon, authenticated, service_role;
revoke execute on function privado.visita_do_portal(uuid)                                     from public, anon, authenticated, service_role;
revoke execute on function privado.horario_do_registro(timestamptz, date)                     from public, anon, authenticated, service_role;

revoke execute on function api.equipe(uuid, date, boolean)                                    from public, anon, service_role;
revoke execute on function api.escala_semanal(date, uuid)                                     from public, anon, service_role;
revoke execute on function api.agenda(date, date, uuid)                                       from public, anon, service_role;
revoke execute on function api.reagendar_visita(uuid, date, time, uuid, text, boolean, boolean) from public, anon, service_role;
revoke execute on function api.reagendar_cascata(uuid, date, text, boolean, boolean)          from public, anon, service_role;
revoke execute on function api.salvar_profissional(uuid, text, text, text, text, text, uuid[], public.vinculo_profissional, integer, integer, boolean, uuid)
                                                                                              from public, anon, service_role;
revoke execute on function api.salvar_documento_profissional(uuid, uuid, text, text, date)    from public, anon, service_role;
revoke execute on function api.salvar_bloqueio_agenda(uuid, uuid, date, date, text)           from public, anon, service_role;
revoke execute on function api.remover_bloqueio_agenda(uuid)                                  from public, anon, service_role;
revoke execute on function api.portal_hoje(date)                                              from public, anon, service_role;
revoke execute on function api.portal_familias()                                              from public, anon, service_role;
revoke execute on function api.portal_perfil()                                                from public, anon, service_role;
revoke execute on function api.registrar_chegada(uuid, timestamptz, boolean)                  from public, anon, service_role;
revoke execute on function api.registrar_saida(uuid, timestamptz, boolean)                    from public, anon, service_role;
revoke execute on function api.sincronizacao_item(uuid)                                       from public, anon, service_role;
revoke execute on function api.sincronizacao_registrar(uuid, text, uuid, text, jsonb, integer, timestamptz, public.status_sync, jsonb)
                                                                                              from public, anon, service_role;

grant execute on function api.equipe(uuid, date, boolean)                                     to authenticated;
grant execute on function api.escala_semanal(date, uuid)                                      to authenticated;
grant execute on function api.agenda(date, date, uuid)                                        to authenticated;
grant execute on function api.reagendar_visita(uuid, date, time, uuid, text, boolean, boolean) to authenticated;
grant execute on function api.reagendar_cascata(uuid, date, text, boolean, boolean)           to authenticated;
grant execute on function api.salvar_profissional(uuid, text, text, text, text, text, uuid[], public.vinculo_profissional, integer, integer, boolean, uuid)
                                                                                              to authenticated;
grant execute on function api.salvar_documento_profissional(uuid, uuid, text, text, date)     to authenticated;
grant execute on function api.salvar_bloqueio_agenda(uuid, uuid, date, date, text)            to authenticated;
grant execute on function api.remover_bloqueio_agenda(uuid)                                   to authenticated;
grant execute on function api.portal_hoje(date)                                               to authenticated;
grant execute on function api.portal_familias()                                               to authenticated;
grant execute on function api.portal_perfil()                                                 to authenticated;
grant execute on function api.registrar_chegada(uuid, timestamptz, boolean)                   to authenticated;
grant execute on function api.registrar_saida(uuid, timestamptz, boolean)                     to authenticated;
grant execute on function api.sincronizacao_item(uuid)                                        to authenticated;
grant execute on function api.sincronizacao_registrar(uuid, text, uuid, text, jsonb, integer, timestamptz, public.status_sync, jsonb)
                                                                                              to authenticated;


-- =============================================================================
-- 12. Trava (falha a migration se quebrar): mesma regra de 0017 e 0018 para
--     api; em privado, só as quatro do PRD 11.10 são executáveis pelo app.
-- =============================================================================

do $$
declare
  v_lista text;
begin
  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api'
    and (not p.prosecdef
         or not coalesce(p.proconfig @> array['search_path=""'], false)
         or p.proacl is null
         or exists (select 1 from pg_catalog.aclexplode(p.proacl) a
                    where a.grantee = 0 and a.privilege_type = 'EXECUTE')
         or has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('service_role', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função de api fora da regra (security definer, search_path vazio, só authenticated): %', v_lista;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'privado'
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname not in ('tem_papel', 'familias_atribuidas', 'aal2', 'sem_acento');
  if v_lista is not null then
    raise exception 'função de privado executável por authenticated fora da lista do PRD 11.10: %', v_lista;
  end if;
end $$;
