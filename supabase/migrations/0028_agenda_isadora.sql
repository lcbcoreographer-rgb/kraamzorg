-- =============================================================================
-- 0028_agenda_isadora.sql
--
-- P25b (PROMPTS.md v3) · PRD 2.1 [v4.3], 4 (D-17, D-19, D-20, D-21), 6.3,
-- 6.4, 6.8, 7.1, 10.1, 11.3, 11.4, 11.7, 11.14, 13, 19.4 (nós 37 e 42 a 47),
-- 19.6, 21.3, 22.2 (C-20 a C-28), 23 e Apêndice A [v4.3]
--
-- A Isadora agenda a reunião online inicial de 30 minutos com a Edilaine no
-- Google Calendar, lembra na véspera, remarca e, se a família faltar,
-- remarca sem constranger. O Leonardo só entra na conversa depois que a
-- Edilaine (ou a coordenação, ou a diretoria) registra "reunião realizada".
-- Substitui o agendamento só humano da D-15.
--
-- Esta migration NÃO foi aplicada em ambiente nenhum: escrita, testada no
-- banco local (supabase/sem-docker) e parada para revisão humana do SQL
-- (CLAUDE.md). É a única migration desta frente; as 0019 a 0027 são de
-- outra. Nenhum dado aqui: parâmetros, textos e automações novos ficam no
-- seed.sql, em rascunho, como na 0018.
--
-- O que ela faz:
--   1. Enums novos (motivo de handoff reuniao_realizada, dois tipos de
--      tarefa, origem do agendamento, tipo e status da consulta à equipe).
--      Nenhum dos valores novos de enum é usado em SQL estático desta
--      migration (só dentro de corpos de função em plpgsql), porque um valor
--      acrescentado por ALTER TYPE só vale depois do commit.
--   2. sessao_venda ganha evento_calendar_id, agendada_por,
--      lembrete_enviado_em e resultado. O id do evento nunca sai para o app:
--      o select do authenticated passa a ser por coluna, sem ele (PRD 13).
--   3. Tabelas novas com RLS: sessao_venda_opcao (sem select direto, só
--      funções do agente) e consulta_equipe (leitura de comercial,
--      coordenação e diretoria; escrita só por função).
--   4. Máquina de estado do P1: a Isadora faz qualificado para
--      sessao_venda_agendada (e a volta), e a coordenação passa a poder
--      registrar realizada e não compareceu.
--   5. Auxiliares privado.agenda_* (texto de dia e hora, estado da agenda,
--      quem pode falar, resumo para o Leonardo).
--   6. Funções do schema agente para o n8n, todas com conversa_id como chave
--      (nunca parâmetro que o modelo preenche): parametros_agenda,
--      registrar_opcoes_horario, validar_opcao_horario,
--      registrar_conferencia_horario, reuniao_da_conversa, registrar_reuniao,
--      registrar_remarcacao, registrar_cancelamento, registrar_consulta_equipe,
--      proativos_agenda_devidos, registrar_lembrete, fechar_consulta,
--      sessoes_para_sincronizar e sincronizar_reuniao.
--   7. Funções do schema agente que mudam de comportamento (create or
--      replace): registrar_handoff (transferência comercial não põe mais a
--      conversa em humano_comercial), ficha_para_agente (agenda_estado),
--      registrar_marco (anotacao_comercial), followups_devidos e
--      registrar_followup (cadência de 1, 3 e 14 dias), mais o motor
--      (agendar_followup_d1, materializar_lembrete_sessao,
--      materializar_sessao_sem_agenda, processar_automacoes) e o resumo
--      interno.
--   8. Funções de api: registrar_desfecho_sessao_venda (realizada leva a
--      conversa a humano_comercial, abre o handoff reuniao_realizada, cria a
--      tarefa do Leonardo, avisa o grupo e cancela follow-ups e lembretes),
--      agendar e remarcar (marcam agendada_por = humano e recusam sessão da
--      Isadora), sessoes_venda (origem, resumo e lembrete), e as duas da
--      tela "Perguntas da Isadora" (consultas_equipe e
--      responder_consulta_equipe).
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura; registradas em
-- docs/sessoes/P25b.md):
--   * A opção só é aceita por registrar_reuniao depois de conferida
--     (registrar_conferencia_horario), para que a segunda consulta à agenda
--     (na escolha) fique registrada no banco e não só no prompt.
--   * Reunião realizada e não compareceu: coordenação e diretoria (a
--     Edilaine). Cancelar segue com comercial, coordenação e diretoria. Antes
--     (0018) eram comercial e diretoria.
--   * A tarefa pos_sessao_48h vai para o responsável da oportunidade e, sem
--     ele, para o papel comercial (o Leonardo), nunca para quem registrou.
--   * O aviso ao grupo "reunião realizada" sai como notificação interna com
--     canal whatsapp_interno (o app despacha), como o reenvio de aviso da 0017.
--   * Consulta à equipe do tipo horario_edilaine vai para a coordenação
--     clínica (a Edilaine); area e duvida vão para o comercial.
--   * O e-mail do parceiro nunca é gravado: entra só no convite (PRD 11.14).
--   * Sessão da Isadora não tem tarefa humana de lembrete: a execução de
--     lembrete_sessao (executor agente) nasce em registrar_reuniao.
-- =============================================================================


-- =============================================================================
-- 1. Enums
-- =============================================================================

alter type public.handoff_motivo add value if not exists 'reuniao_realizada';
alter type public.tipo_tarefa add value if not exists 'registrar_desfecho_sessao';
alter type public.tipo_tarefa add value if not exists 'responder_consulta_isadora';

create type public.origem_agendamento_sessao as enum ('isadora', 'humano');
create type public.tipo_consulta_equipe as enum ('area', 'duvida', 'horario_edilaine');
create type public.status_consulta_equipe as enum ('aberta', 'respondida', 'expirada', 'cancelada');


-- =============================================================================
-- 2. sessao_venda: evento do calendário, origem, lembrete e resultado
-- =============================================================================

alter table public.sessao_venda
  add column evento_calendar_id text,
  add column agendada_por public.origem_agendamento_sessao not null default 'humano',
  add column lembrete_enviado_em timestamptz,
  add column resultado text;

alter table public.sessao_venda
  add constraint sessao_venda_evento_id_formato
    check (evento_calendar_id is null or evento_calendar_id ~ '^[A-Za-z0-9_-]{5,255}$'),
  add constraint sessao_venda_da_isadora_tem_evento
    check (agendada_por <> 'isadora' or evento_calendar_id is not null),
  add constraint sessao_venda_resultado_tamanho
    check (resultado is null or pg_catalog.length(resultado) <= 300);

-- um evento do Google, uma reunião agendada (a regra de uma reunião agendada por
-- família é das funções, que travam a família antes de gravar)
create unique index sessao_venda_evento_agendada
  on public.sessao_venda (evento_calendar_id)
  where status = 'agendada' and evento_calendar_id is not null;

comment on column public.sessao_venda.evento_calendar_id is '[v4.3] Id do evento no Google Calendar. Só o fluxo 4 e as funções de agenda leem (agente.reuniao_da_conversa, agente.sessoes_para_sincronizar); fora do select do app e de toda função de api (PRD 13). É o único evento que a Isadora move ou apaga.';
comment on column public.sessao_venda.agendada_por is '[v4.3] isadora (agente.registrar_reuniao, PRD 11.14) ou humano (api.agendar_sessao_venda, P29).';
comment on column public.sessao_venda.lembrete_enviado_em is '[v4.3] Lembrete da véspera enviado pela Isadora (agente.registrar_lembrete).';
comment on column public.sessao_venda.resultado is '[v4.3] Resultado da reunião escrito pela Edilaine ao registrar o desfecho: campo curto, sem dado clínico. Entra no resumo para o Leonardo.';

-- O id do evento não sai para o app: select por coluna, sem evento_calendar_id.
-- (Um select * do authenticated passa a falhar de propósito.)
revoke select on public.sessao_venda from authenticated;
grant select (id, criado_em, atualizado_em, criado_por, familia_id, agendada_para, opcoes_informadas,
              realizada_em, conduzida_por, link_reuniao, parceiro_presente, status, agendada_por,
              lembrete_enviado_em, resultado)
  on public.sessao_venda to authenticated;

-- Sessão da Isadora: o link é o do Meet do evento. Mudá-lo direto pelo app
-- desalinharia o CRM do calendário.
create function privado.proteger_sessao_da_isadora() returns trigger
  language plpgsql
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  if current_user = 'authenticated'
     and old.agendada_por = 'isadora'
     and new.link_reuniao is distinct from old.link_reuniao then
    raise exception 'venda:sessao_da_isadora O link desta reunião é o do Google Meet do evento. Para mudar, mova o evento no calendário ou peça à Isadora.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
comment on function privado.proteger_sessao_da_isadora() is '[v4.3] Gatilho BEFORE UPDATE de sessao_venda: o app não troca o link de uma reunião marcada pela Isadora (é o Meet do evento). Sem grant.';

create trigger proteger_sessao_da_isadora before update on public.sessao_venda
  for each row execute function privado.proteger_sessao_da_isadora();


-- =============================================================================
-- 3. Tabelas novas
-- =============================================================================

-- --- 3.1 sessao_venda_opcao -------------------------------------------------------
-- Horários que a Isadora ofereceu. Valem só no dia (PRD 11.14): valida_ate é
-- o fim do dia da consulta em America/Sao_Paulo. Sem select direto: só as
-- funções do agente leem e gravam (o app não precisa desta tabela).
create table public.sessao_venda_opcao (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfil(id),
  conversa_id uuid not null references public.conversa(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,                    -- inicio + parametro.agenda_bloco_minutos
  consultada_em timestamptz not null,          -- momento da consulta ao Google Calendar que gerou a opção
  valida_ate timestamptz not null,             -- fim do dia da consulta em America/Sao_Paulo
  conferida_em timestamptz,                    -- segunda consulta (na escolha): o horário continuava livre
  escolhida_em timestamptz,                    -- virou reunião (agente.registrar_reuniao)
  descartada_em timestamptz,                   -- trocada por opções novas, ocupada na conferência ou vencida
  constraint sessao_venda_opcao_fim_depois_do_inicio check (fim > inicio),
  constraint sessao_venda_opcao_valida_depois_da_consulta check (valida_ate >= consultada_em)
);
comment on table public.sessao_venda_opcao is '[v4.3] Horários da reunião inicial que a Isadora ofereceu (PRD 6.4, 11.14). Valem só no dia em que foram oferecidos. Sem select direto: só as funções do schema agente (D-14).';
create index on public.sessao_venda_opcao (conversa_id, valida_ate);
create index on public.sessao_venda_opcao (criado_por);

create trigger tocar_atualizado_em before update on public.sessao_venda_opcao
  for each row execute function privado.tocar_atualizado_em();
create trigger carimbar_criado_por before insert or update on public.sessao_venda_opcao
  for each row execute function privado.carimbar_criado_por();
create trigger auditar after insert or update or delete on public.sessao_venda_opcao
  for each row execute function privado.auditar('id');

alter table public.sessao_venda_opcao enable row level security;
revoke all on public.sessao_venda_opcao from public, anon, authenticated;

-- --- 3.2 consulta_equipe -----------------------------------------------------------
-- Pergunta da Isadora à equipe sem transferir a conversa (PRD 11.14): área
-- não confirmada, dúvida fora da base e horário que a agenda não tem.
create table public.consulta_equipe (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfil(id),
  conversa_id uuid not null references public.conversa(id) on delete cascade,
  familia_id uuid references public.familia(id),
  tipo public.tipo_consulta_equipe not null,
  pergunta text not null,                      -- curta, sem dado clínico
  preferencia jsonb not null default '{}',     -- horario_edilaine: dias e períodos que a família disse
  destino public.handoff_destino not null default 'comercial',
  resposta text,                               -- texto da equipe; a Isadora escreve com as próprias palavras a partir dele
  respondida_por uuid references public.perfil(id),
  respondida_em timestamptz,
  notificada_em timestamptz,
  expira_em timestamptz,
  reservada_em timestamptz,                    -- a Entrada B do fluxo 3 já pegou esta consulta (evita envio duplo)
  devolvida_em timestamptz,                    -- a Isadora já devolveu a resposta à família
  status public.status_consulta_equipe not null default 'aberta',
  constraint consulta_equipe_pergunta_tamanho check (pg_catalog.length(pergunta) between 1 and 300),
  constraint consulta_equipe_resposta_tamanho check (resposta is null or pg_catalog.length(resposta) <= 1000)
);
comment on table public.consulta_equipe is '[v4.3] Consulta da Isadora à equipe sem transferir a conversa (PRD 6.4, 11.14). Não pausa a Isadora, não muda o modo e não abre handoff. Leitura de comercial, coordenação e diretoria; escrita só por função (agente.registrar_consulta_equipe e api.responder_consulta_equipe).';
create index on public.consulta_equipe (conversa_id);
create index on public.consulta_equipe (familia_id);
create index on public.consulta_equipe (respondida_por);
create index on public.consulta_equipe (criado_por);
create index on public.consulta_equipe (status, tipo);

create trigger tocar_atualizado_em before update on public.consulta_equipe
  for each row execute function privado.tocar_atualizado_em();
create trigger carimbar_criado_por before insert or update on public.consulta_equipe
  for each row execute function privado.carimbar_criado_por();
create trigger auditar after insert or update or delete on public.consulta_equipe
  for each row execute function privado.auditar('id');

alter table public.consulta_equipe enable row level security;
revoke all on public.consulta_equipe from public, anon, authenticated;
grant select on public.consulta_equipe to authenticated;

create policy ler on public.consulta_equipe for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy exige_mfa_do_perfil on public.consulta_equipe as restrictive for all to authenticated
  using ((select privado.aal2()) or not (
           (select privado.tem_papel('enfermeira')) or (select privado.tem_papel('financeiro'))
           or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))))
  with check ((select privado.aal2()) or not (
           (select privado.tem_papel('enfermeira')) or (select privado.tem_papel('financeiro'))
           or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))));

-- texto livre que pode carregar nome de paciente: fora do log em claro
alter table privado.auditoria_coluna_sensivel drop constraint auditoria_coluna_sensivel_fonte_check;
alter table privado.auditoria_coluna_sensivel
  add constraint auditoria_coluna_sensivel_fonte_check check (fonte in ('prd_13', 'sessao_p05', 'sessao_p25b'));
insert into privado.auditoria_coluna_sensivel (entidade, coluna, fonte) values
  ('consulta_equipe', 'pergunta', 'sessao_p25b'),
  ('consulta_equipe', 'resposta', 'sessao_p25b'),
  ('consulta_equipe', 'preferencia', 'sessao_p25b'),
  ('sessao_venda', 'resultado', 'sessao_p25b');


-- =============================================================================
-- 4. Máquina de estado do P1 (PRD 7.1 [v4.3])
--
-- qualificado para sessao_venda_agendada passa a ser automática: quem faz é
-- agente.registrar_reuniao (a Isadora, sistema sem usuário). A volta para
-- qualificado (cancelamento e reunião apagada no calendário) e a entrada da
-- nutrição em sessao_venda_agendada também. Realizada e a volta por falta
-- deixam de exigir papel_minimo comercial: a Edilaine, com papel de
-- coordenação, registra o desfecho. Quem pode chamar continua sendo decidido
-- pelas funções de api (api.transicionar só abre o P1 a comercial e
-- diretoria).
-- =============================================================================

update privado.transicao_permitida
   set automatica = true
 where maquina = 'p1'
   and ((de = 'qualificado' and para = 'sessao_venda_agendada')
     or (de = 'sessao_venda_agendada' and para = 'qualificado')
     or (de = 'nutricao' and para = 'sessao_venda_agendada'));

update privado.transicao_permitida
   set papel_minimo = null
 where maquina = 'p1'
   and de = 'sessao_venda_agendada'
   and para in ('sessao_venda_realizada', 'qualificado');


-- =============================================================================
-- 5. Auxiliares internos (privado.agenda_*). Nenhum recebe grant: só as
--    funções security definer do schema agente e de api (dono postgres).
-- =============================================================================

-- --- 5.1 Texto de dia e hora ("quinta, 02/10, às 19h") --------------------------
-- É o formato do treinamento v3. Sai do banco, para o validador comparar o
-- que o modelo escreveu com o que a ferramenta devolveu (PRD 11.11 item 9).
create function privado.agenda_dia_semana(instante timestamptz) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select (array['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'])
           [pg_catalog.date_part('dow', agenda_dia_semana.instante at time zone 'America/Sao_Paulo')::integer + 1]
$$;
comment on function privado.agenda_dia_semana(timestamptz) is '[v4.3] Dia da semana em Brasília, sem "-feira" ("quinta"). Sem grant.';

create function privado.agenda_data(instante timestamptz) returns text
  language sql
  stable
  set search_path = ''
  as $$ select pg_catalog.to_char(agenda_data.instante at time zone 'America/Sao_Paulo', 'DD/MM') $$;
comment on function privado.agenda_data(timestamptz) is '[v4.3] Dia e mês em Brasília ("02/10"). Sem grant.';

create function privado.agenda_hora(instante timestamptz) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select pg_catalog.to_char(agenda_hora.instante at time zone 'America/Sao_Paulo', 'FMHH24') || 'h'
         || case when pg_catalog.date_part('minute', agenda_hora.instante at time zone 'America/Sao_Paulo') <> 0
                 then pg_catalog.to_char(agenda_hora.instante at time zone 'America/Sao_Paulo', 'MI') else '' end
$$;
comment on function privado.agenda_hora(timestamptz) is '[v4.3] Hora em Brasília ("19h" ou "9h30"). Sem grant.';

create function privado.agenda_texto(instante timestamptz) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select privado.agenda_dia_semana(agenda_texto.instante) || ', ' || privado.agenda_data(agenda_texto.instante)
         || ', às ' || privado.agenda_hora(agenda_texto.instante)
$$;
comment on function privado.agenda_texto(timestamptz) is '[v4.3] "quinta, 02/10, às 19h": o texto que a Isadora usa para oferecer e confirmar o horário. Sem grant.';

create function privado.agenda_fim_do_dia(instante timestamptz) returns timestamptz
  language sql
  stable
  set search_path = ''
  as $$
  select (((agenda_fim_do_dia.instante at time zone 'America/Sao_Paulo')::date + 1)::timestamp) at time zone 'America/Sao_Paulo'
$$;
comment on function privado.agenda_fim_do_dia(timestamptz) is '[v4.3] Meia-noite que fecha o dia do instante em America/Sao_Paulo: até aí a opção de horário vale (PRD 11.14). Sem grant.';

-- --- 5.2 Parâmetros --------------------------------------------------------------
create function privado.agenda_bloco() returns integer
  language sql
  stable
  set search_path = ''
  as $$ select nullif(pg_catalog.floor(privado.agente_parametro_numero('agenda_bloco_minutos')), 0)::integer $$;
comment on function privado.agenda_bloco() is '[v4.3] parametro.agenda_bloco_minutos (duração da reunião e de cada opção). Nulo se ausente: sem bloco a agenda não oferece horário. Sem grant.';

create function privado.agenda_antecedencia() returns interval
  language sql
  stable
  set search_path = ''
  as $$ select pg_catalog.make_interval(secs => (coalesce(privado.agente_parametro_numero('agenda_antecedencia_horas'), 0) * 3600)::double precision) $$;
comment on function privado.agenda_antecedencia() is '[v4.3] parametro.agenda_antecedencia_horas como intervalo (ausente: sem antecedência mínima). Sem grant.';

-- --- 5.3 Hora do lembrete: a véspera da reunião, na hora de agenda_lembrete_hora ----
-- Nulo quando a reunião é hoje ou a véspera já passou (o lembrete só vale para
-- reunião marcada com mais de um dia de antecedência, PRD 10.1).
create function privado.agenda_lembrete_em(inicio timestamptz) returns timestamptz
  language plpgsql
  stable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_hora  time;
  v_dia   date := (agenda_lembrete_em.inicio at time zone 'America/Sao_Paulo')::date - 1;
  v_em    timestamptz;
begin
  begin
    v_hora := (privado.agente_parametro('agenda_lembrete_hora') #>> '{}')::time;
  exception
    when others then
      v_hora := null;
  end;
  if v_hora is null then
    return null;
  end if;
  v_em := ((v_dia + v_hora)::timestamp) at time zone 'America/Sao_Paulo';
  if v_em <= pg_catalog.now() or v_em >= agenda_lembrete_em.inicio then
    return null;
  end if;
  return v_em;
end;
$$;
comment on function privado.agenda_lembrete_em(timestamptz) is '[v4.3] Instante do lembrete da véspera (dia anterior, na hora de parametro.agenda_lembrete_hora, fuso America/Sao_Paulo). Nulo se o parâmetro falta ou se a véspera já passou (reunião de hoje ou de amanhã cedo demais). Sem grant.';

-- --- 5.4 Sessão vigente da família -----------------------------------------------
create function privado.agenda_sessao_vigente(familia_id uuid) returns public.sessao_venda
  language sql
  stable
  set search_path = ''
  as $$
  select s.*
  from public.sessao_venda s
  where s.familia_id = privado.familia_vigente(agenda_sessao_vigente.familia_id)
    and s.status = 'agendada'
  order by s.criado_em desc
  limit 1
$$;
comment on function privado.agenda_sessao_vigente(uuid) is '[v4.3] Reunião agendada (status agendada) da família vigente; nula se não há. Sem grant.';

-- --- 5.5 Estado da agenda de uma conversa (ficha do agente, PRD 19.4 nó 25) ----------
-- sem_reuniao, horarios_enviados (opções vigentes do dia), aguardando_email
-- (uma opção conferida e ainda não usada), agendada ou faltou. "remarcada"
-- não é estado: a reunião remarcada continua agendada, com remarcada = true.
create function privado.agenda_estado(conversa_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c       public.conversa;
  v_fam     uuid;
  v_s       public.sessao_venda;
  v_ultima  public.status_sessao;
  v_opcoes  jsonb := '[]'::jsonb;
  v_estado  text := 'sem_reuniao';
  v_conf    boolean;
begin
  select c.* into v_c from public.conversa c where c.id = agenda_estado.conversa_id;
  if not found then
    return pg_catalog.jsonb_build_object('estado', 'sem_reuniao', 'opcoes', '[]'::jsonb, 'remarcada', false);
  end if;
  if v_c.familia_id is not null then
    v_fam := privado.familia_vigente(v_c.familia_id);
    select s.* into v_s from public.sessao_venda s
     where s.familia_id = v_fam and s.status = 'agendada' order by s.criado_em desc limit 1;
    select s.status into v_ultima from public.sessao_venda s
     where s.familia_id = v_fam order by s.criado_em desc limit 1;
  end if;

  if v_s.id is not null then
    return pg_catalog.jsonb_build_object(
      'estado', 'agendada',
      'remarcada', exists (select 1 from public.sessao_venda r where r.familia_id = v_fam and r.status = 'remarcada'),
      'agendada_por', v_s.agendada_por,
      'opcoes', '[]'::jsonb,
      'reuniao', pg_catalog.jsonb_build_object(
                   'dia_semana', privado.agenda_dia_semana(v_s.agendada_para),
                   'data', privado.agenda_data(v_s.agendada_para),
                   'hora', privado.agenda_hora(v_s.agendada_para),
                   'texto', privado.agenda_texto(v_s.agendada_para),
                   'agendada_em', pg_catalog.to_char(v_s.criado_em at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
                   'lembrete_enviado', v_s.lembrete_enviado_em is not null,
                   'lembrete_em', case when v_s.lembrete_enviado_em is not null
                                       then privado.agenda_data(v_s.lembrete_enviado_em) end));
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                    'id_opcao', o.id, 'texto', privado.agenda_texto(o.inicio), 'conferida', o.conferida_em is not null)
                  order by o.inicio), '[]'::jsonb),
         coalesce(pg_catalog.bool_or(o.conferida_em is not null), false)
    into v_opcoes, v_conf
  from public.sessao_venda_opcao o
  where o.conversa_id = agenda_estado.conversa_id
    and o.valida_ate > pg_catalog.now()
    and o.escolhida_em is null
    and o.descartada_em is null;

  if pg_catalog.jsonb_array_length(v_opcoes) > 0 then
    v_estado := case when v_conf then 'aguardando_email' else 'horarios_enviados' end;
  elsif v_ultima = 'nao_compareceu' then
    v_estado := 'faltou';
  end if;

  return pg_catalog.jsonb_build_object('estado', v_estado, 'remarcada', false, 'opcoes', v_opcoes);
end;
$$;
comment on function privado.agenda_estado(uuid) is '[v4.3] Situação da agenda da conversa para a ficha do agente: sem_reuniao, horarios_enviados, aguardando_email, agendada ou faltou, com as opções vigentes do dia (id e texto) e a reunião agendada (dia, data e hora; nunca o id do evento). Sem grant.';

-- --- 5.6 Quem pode falar agora (lembrete, falta, devolutiva, retomada) ----------------
-- Mesmos filtros de agente.followups_devidos. definitivo = o motivo não passa
-- com o tempo (cancela a execução); não definitivo = espera a próxima rodada.
create function privado.agenda_pode_falar(conversa_id uuid, categoria text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_estado jsonb := privado.agente_estado_conversa(agenda_pode_falar.conversa_id);
  v_c      public.conversa;
  v_pode   jsonb;
begin
  if v_estado is null then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'conversa_inexistente');
  end if;
  select c.* into v_c from public.conversa c where c.id = agenda_pode_falar.conversa_id;

  if v_estado ->> 'modo' = 'silencio' then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'numero_equipe');
  elsif v_estado ->> 'agente_modo' = 'desligado' then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'agente_desligado');
  elsif v_estado ->> 'agente_modo' = 'teste' and not (v_estado ->> 'na_whitelist')::boolean then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'fora_da_lista_de_teste');
  elsif (v_estado ->> 'humano_comercial')::boolean then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'humano_comercial');
  elsif v_estado ->> 'modo' = 'humano_nominal' then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'humano_nominal');
  elsif (v_estado ->> 'nao_lead')::boolean or v_c.classificacao <> 'lead' then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'nao_e_lead');
  elsif (v_estado ->> 'cliente')::boolean then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'cliente');
  elsif (v_estado ->> 'nao_contatar')::boolean then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'nao_contatar');
  elsif v_c.wa_jid is null then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'sem_jid');
  elsif (v_estado ->> 'handoff_aberto')::boolean then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', false, 'motivo', 'transferencia_aberta');
  elsif (v_estado ->> 'pausa')::boolean then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', false, 'motivo', 'pausado');
  elsif (v_estado ->> 'familia_id') is null then
    return pg_catalog.jsonb_build_object('pode', false, 'definitivo', true, 'motivo', 'familia_obrigatoria');
  end if;

  v_pode := privado.pode_enviar_mensagem((v_estado ->> 'familia_id')::uuid, agenda_pode_falar.categoria::public.categoria_automacao);
  if coalesce((v_pode ->> 'pode')::boolean, false) then
    return pg_catalog.jsonb_build_object('pode', true, 'definitivo', false, 'motivo', null);
  end if;
  return pg_catalog.jsonb_build_object(
    'pode', false,
    'definitivo', coalesce(v_pode ->> 'motivo', '') not in ('fora_da_janela', 'janela_nao_configurada', 'conteudo_ja_enviado_hoje'),
    'motivo', coalesce(v_pode ->> 'motivo', 'pode_enviar_recusou'));
end;
$$;
comment on function privado.agenda_pode_falar(uuid, text) is '[v4.3] Se a Isadora pode escrever agora numa conversa para lembrete (operacional) ou falta, devolutiva e retomada (conteudo): mesmos filtros de agente.followups_devidos. definitivo verdadeiro cancela a execução; falso espera a próxima rodada (janela, pausa, transferência aberta, conteúdo já enviado hoje). Sem grant.';

-- --- 5.7 Cancela execuções agendadas de uma família ------------------------------------
create function privado.agenda_cancelar_execucoes(familia_id uuid, automacoes text[], motivo text) returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_n integer;
begin
  update public.automacao_execucao e
     set status = 'cancelada', motivo_aborto = agenda_cancelar_execucoes.motivo
   where e.familia_id = agenda_cancelar_execucoes.familia_id
     and e.status = 'agendada'
     and e.automacao_id = any (agenda_cancelar_execucoes.automacoes);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.agenda_cancelar_execucoes(uuid, text[], text) is '[v4.3] Cancela as execuções agendadas das automações pedidas para a família (follow-ups e lembretes quando a reunião é marcada, cancelada ou realizada). Sem grant.';

-- --- 5.8 P1 até sessao_venda_agendada, sem derrubar a chamada --------------------------
-- Percorre o caminho do estágio atual até sessao_venda_agendada por
-- privado.transicionar (só transições automáticas: quem chama é o agente).
-- Devolve o estágio final. Reunião já realizada, P2 aberto e estágios que não
-- levam à agenda (nao_qualificado, fora_de_cobertura) recusam.
create function privado.agenda_p1_ate_agendada(oportunidade_id uuid, motivo text) returns text
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_o public.oportunidade;
begin
  select o.* into v_o from public.oportunidade o where o.id = agenda_p1_ate_agendada.oportunidade_id;
  if not found then
    return null;
  end if;
  if v_o.estagio_p2 is not null then
    return v_o.estagio_p1::text;          -- já no P2: o P1 não anda mais, a agenda é só agenda
  end if;
  if v_o.estagio_p1 = 'sessao_venda_realizada' then
    raise exception 'reuniao_ja_realizada' using errcode = 'P0001';
  end if;
  if v_o.estagio_p1 in ('nao_qualificado', 'fora_de_cobertura') then
    raise exception 'estagio_nao_permite_reuniao' using errcode = 'P0001';
  end if;

  if v_o.estagio_p1 in ('perdido') then
    perform privado.transicionar('p1', v_o.id, 'em_conversa_ia', agenda_p1_ate_agendada.motivo);
    v_o.estagio_p1 := 'em_conversa_ia';
  end if;
  if v_o.estagio_p1 = 'novo' then
    perform privado.transicionar('p1', v_o.id, 'em_conversa_ia', agenda_p1_ate_agendada.motivo);
    v_o.estagio_p1 := 'em_conversa_ia';
  end if;
  if v_o.estagio_p1 = 'em_conversa_ia' then
    perform privado.transicionar('p1', v_o.id, 'qualificado', agenda_p1_ate_agendada.motivo);
    v_o.estagio_p1 := 'qualificado';
  end if;
  if v_o.estagio_p1 in ('qualificado', 'nutricao') then
    perform privado.transicionar('p1', v_o.id, 'sessao_venda_agendada', agenda_p1_ate_agendada.motivo);
  end if;
  return 'sessao_venda_agendada';
end;
$$;
comment on function privado.agenda_p1_ate_agendada(uuid, text) is '[v4.3] Leva o P1 da oportunidade até sessao_venda_agendada por privado.transicionar (só transições automáticas). Reunião já realizada e estágios sem caminho (nao_qualificado, fora_de_cobertura) recusam com P0001. Oportunidade no P2 fica como está. Sem grant.';

-- --- 5.9 Resumo interno da reunião, para o Leonardo (nunca vai à família) ------------------
-- Prompt v6, seção 21: o resumo interno preenchido no agendamento e completado
-- pela Edilaine. O texto-base é o resumo padrão do grupo (23.3); aqui entram
-- só os campos da agenda: reunião agendada, lembrete, anotações comerciais e
-- o resultado registrado.
create function privado.agenda_resumo_reuniao(sessao_id uuid) returns text
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_s     public.sessao_venda;
  v_conv  uuid;
  v_base  text;
begin
  select s.* into v_s from public.sessao_venda s where s.id = agenda_resumo_reuniao.sessao_id;
  if not found then
    return null;
  end if;
  select c.id into v_conv
  from public.conversa c
  where c.familia_id in (select f.id from public.familia f
                         where f.id = v_s.familia_id or privado.familia_vigente(f.id) = v_s.familia_id)
  order by c.ultima_entrada_em desc nulls last, c.criado_em desc
  limit 1;
  if v_conv is null then
    return null;
  end if;
  v_base := privado.agente_resumo_interno(v_conv, null, '{}'::jsonb);
  return v_base;
end;
$$;
comment on function privado.agenda_resumo_reuniao(uuid) is '[v4.3] Resumo interno (PRD 23.3) da conversa mais recente da família da sessão, com a reunião agendada, o lembrete, as anotações comerciais e o resultado. Só dado comercial; nunca vai à família. Sem grant.';


-- =============================================================================
-- 6. Auxiliares que leem e gravam a agenda
-- =============================================================================

-- --- 6.1 Opção de horário: existe, é desta conversa, vale hoje --------------------------
-- Devolve {ok, opcao: {...}} ou {ok: false, erro}. erro: inexistente,
-- descartada, usada (já virou reunião), expirada (valia só no dia em que foi
-- oferecida), antecedencia (dentro da antecedência mínima) ou nao_conferida
-- (só com exigir_conferida: a segunda consulta à agenda, na escolha, ainda
-- não foi registrada).
create function privado.agenda_opcao(conversa_id uuid, id_opcao uuid, exigir_conferida boolean) returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_o public.sessao_venda_opcao;
begin
  select o.* into v_o
  from public.sessao_venda_opcao o
  where o.id = agenda_opcao.id_opcao and o.conversa_id = agenda_opcao.conversa_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'inexistente');
  end if;
  if v_o.escolhida_em is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'usada');
  end if;
  if v_o.descartada_em is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'descartada');
  end if;
  if v_o.valida_ate <= pg_catalog.now() then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'expirada');
  end if;
  if v_o.inicio < pg_catalog.now() + privado.agenda_antecedencia() then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'antecedencia');
  end if;
  if agenda_opcao.exigir_conferida and v_o.conferida_em is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'nao_conferida');
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'opcao', pg_catalog.jsonb_build_object(
      'id_opcao', v_o.id, 'inicio', v_o.inicio, 'fim', v_o.fim,
      'dia_semana', privado.agenda_dia_semana(v_o.inicio), 'data', privado.agenda_data(v_o.inicio),
      'hora', privado.agenda_hora(v_o.inicio), 'texto', privado.agenda_texto(v_o.inicio),
      'consultada_em', v_o.consultada_em, 'conferida_em', v_o.conferida_em));
end;
$$;
comment on function privado.agenda_opcao(uuid, uuid, boolean) is '[v4.3] Confere uma opção de horário: da conversa, não usada, não descartada, oferecida hoje (valida_ate) e fora da antecedência mínima; com exigir_conferida, também conferida na escolha. Devolve {ok, opcao} ou {ok: false, erro}. Sem grant.';

-- --- 6.2 Aviso ao grupo interno (texto do banco) -------------------------------------------
-- Texto de mensagem_modelo (destinatário equipe; rascunho sai marcado, como
-- na 0014), variáveis trocadas, resumo interno e rodapé "A Isadora segue
-- atendendo esta conversa." O " / " do modelo vira quebra de linha.
create function privado.agenda_mensagem_grupo(
  chave       text,
  conversa_id uuid,
  destino     public.handoff_destino,
  variaveis   jsonb,
  rodape      text default 'grupo_rodape_isadora_segue'
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c        public.conversa;
  v_fam      uuid;
  v_modelo   text := privado.agente_texto(agenda_mensagem_grupo.chave, true);
  v_aprovado boolean;
  v_nome     text;
  v_link     text;
  v_rodape   text;
  v_msg      text;
begin
  v_aprovado := v_modelo is not null;
  if v_modelo is null then
    v_modelo := privado.agente_texto(agenda_mensagem_grupo.chave, false);
  end if;
  select c.* into v_c from public.conversa c where c.id = agenda_mensagem_grupo.conversa_id;
  if v_c.familia_id is not null then
    v_fam := privado.familia_vigente(v_c.familia_id);
  end if;
  if v_modelo is null then
    return pg_catalog.jsonb_build_object('mensagem', null, 'aprovada', false,
      'grupo_jid', privado.agente_parametro('grupo_whatsapp_por_destino') ->> agenda_mensagem_grupo.destino::text);
  end if;

  select coalesce(privado.campo_livre(p.nome), privado.campo_livre(v_c.nome_whatsapp)) into v_nome
  from (select 1) x left join public.pessoa p on p.id = v_c.pessoa_id;
  v_link := case when v_fam is not null
                 then pg_catalog.replace(coalesce(privado.agente_parametro('link_ficha_modelo') #>> '{}', ''), '{familia_id}', v_fam::text)
                 else '' end;
  v_rodape := privado.agente_texto(agenda_mensagem_grupo.rodape, false);

  v_msg := privado.aplicar_texto(v_modelo, v_nome, coalesce(agenda_mensagem_grupo.variaveis, '{}'::jsonb)
             || pg_catalog.jsonb_build_object(
                  'telefone', coalesce(v_c.telefone_e164, ''),
                  'resumo_interno', coalesce(privado.agente_resumo_interno(v_c.id, null, '{}'::jsonb), ''),
                  'link_ficha', v_link));
  if v_rodape is not null then
    v_msg := v_msg || ' / ' || v_rodape;
  end if;
  v_msg := pg_catalog.replace(v_msg, ' / ', E'\n');

  return pg_catalog.jsonb_build_object(
    'mensagem', v_msg,
    'aprovada', v_aprovado,
    'grupo_jid', privado.agente_parametro('grupo_whatsapp_por_destino') ->> agenda_mensagem_grupo.destino::text);
end;
$$;
comment on function privado.agenda_mensagem_grupo(text, uuid, public.handoff_destino, jsonb, text) is '[v4.3] Monta o aviso ao grupo interno (grupo_reuniao_agendada, grupo_consulta, grupo_consulta_horario, grupo_reuniao_realizada) com o resumo interno, o link da ficha e o rodapé pedido (por padrão "A Isadora segue atendendo esta conversa."; a reunião realizada usa o de humano_comercial). Devolve {mensagem, aprovada, grupo_jid}. Texto em rascunho sai marcado, como na 0014. Sem grant.';


-- =============================================================================
-- 7. Funções do schema agente (Apêndice A [v4.3]). Todas security definer, com
--    search_path vazio, primeira linha privado.agente_contexto() e erro
--    devolvido como {ok: false, erro}. execute só para n8n_agente (seção 12).
-- =============================================================================

-- --- 7.1 agente.parametros_agenda --------------------------------------------------------
create function agente.parametros_agenda() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_bloco   integer := privado.agenda_bloco();
  v_faixas  jsonb := privado.agente_parametro('agenda_faixas');
  v_janela  numeric := coalesce(privado.agente_parametro_numero('agenda_janela_dias'), 0);
  v_leo     boolean := privado.agente_parametro_ligado('agenda_convidar_leonardo');
begin
  perform privado.agente_contexto();
  if v_faixas is null or pg_catalog.jsonb_typeof(v_faixas) <> 'object' then
    v_faixas := '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'configurada', v_bloco is not null and v_janela > 0 and v_faixas <> '{}'::jsonb,
    'fuso', 'America/Sao_Paulo',
    'bloco_minutos', v_bloco,
    'faixas', v_faixas,
    'periodos', coalesce(privado.agente_parametro('agenda_periodos'), '{}'::jsonb),
    'antecedencia_horas', coalesce(privado.agente_parametro_numero('agenda_antecedencia_horas'), 0),
    'intervalo_minutos', coalesce(privado.agente_parametro_numero('agenda_intervalo_minutos'), 0),
    'janela_dias', v_janela,
    'titulo_evento', privado.agente_parametro('agenda_titulo_evento') #>> '{}',
    'descricao_evento', privado.agente_parametro('agenda_descricao_evento') #>> '{}',
    'convidar_leonardo', v_leo,
    'leonardo_email', case when v_leo then privado.agente_parametro('agenda_leonardo_email') #>> '{}' end,
    'condutora_perfil_id', privado.agente_parametro('agenda_condutora_perfil_id') #>> '{}',
    'lembrete_hora', privado.agente_parametro('agenda_lembrete_hora') #>> '{}',
    'janela_envio', privado.agente_parametro('agente_janela_envio'),
    'cadencia_dias', privado.agente_parametro('agente_cadencia_dias'));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.parametros_agenda() is '[v4.3] Apêndice A: configuração da agenda da reunião inicial (parametro.agenda_*): faixas por dia da semana, períodos do dia (manhã, tarde, noite), bloco, antecedência, intervalo, janela em dias, título e descrição do evento, se o Leonardo é convidado, quem conduz, hora do lembrete e janela de envio. configurada falso (sem bloco, janela ou faixa) faz o fluxo 4 devolver sem_horario e abrir a consulta horario_edilaine. Nenhum id de calendário nem credencial: isso é config do build (PRD 19.5).';

-- --- 7.2 agente.registrar_opcoes_horario -----------------------------------------------------
create function agente.registrar_opcoes_horario(conversa_id uuid, opcoes jsonb, consultada_em timestamptz) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c        public.conversa;
  v_bloco    integer := privado.agenda_bloco();
  v_consulta timestamptz := coalesce(registrar_opcoes_horario.consultada_em, pg_catalog.now());
  v_ate      timestamptz;
  v_item     jsonb;
  v_inicio   timestamptz;
  v_inicios  timestamptz[] := '{}';
  v_out      jsonb := '[]'::jsonb;
  v_id       uuid;
  v_fam      uuid;
  v_o        public.oportunidade;
begin
  perform privado.agente_contexto();
  if v_bloco is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'agenda_nao_configurada');
  end if;
  select c.* into v_c from public.conversa c where c.id = registrar_opcoes_horario.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if pg_catalog.jsonb_typeof(registrar_opcoes_horario.opcoes) <> 'array'
     or pg_catalog.jsonb_array_length(registrar_opcoes_horario.opcoes) not between 1 and 3 then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'opcoes_invalidas');
  end if;
  -- a consulta que gerou as opções é de agora: uma consulta velha ou do futuro
  -- não vale (nunca se confirma horário com base em consulta de outro momento)
  if v_consulta < pg_catalog.now() - interval '15 minutes' or v_consulta > pg_catalog.now() + interval '1 minute' then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'consulta_antiga');
  end if;
  v_ate := privado.agenda_fim_do_dia(v_consulta);

  for v_item in select e.value from pg_catalog.jsonb_array_elements(registrar_opcoes_horario.opcoes) e loop
    v_inicio := (case pg_catalog.jsonb_typeof(v_item) when 'string' then v_item #>> '{}' else v_item ->> 'inicio' end)::timestamptz;
    if v_inicio is null then
      return pg_catalog.jsonb_build_object('ok', false, 'erro', 'opcoes_invalidas');
    end if;
    if v_inicio < pg_catalog.now() + privado.agenda_antecedencia() then
      return pg_catalog.jsonb_build_object('ok', false, 'erro', 'antecedencia');
    end if;
    if v_inicio = any (v_inicios) then
      return pg_catalog.jsonb_build_object('ok', false, 'erro', 'opcoes_repetidas');
    end if;
    v_inicios := v_inicios || v_inicio;
  end loop;

  -- as opções anteriores da conversa deixam de valer
  update public.sessao_venda_opcao o
     set descartada_em = pg_catalog.now()
   where o.conversa_id = v_c.id and o.escolhida_em is null and o.descartada_em is null;

  foreach v_inicio in array v_inicios loop
    insert into public.sessao_venda_opcao (conversa_id, inicio, fim, consultada_em, valida_ate)
    values (v_c.id, v_inicio, v_inicio + pg_catalog.make_interval(mins => v_bloco), v_consulta, v_ate)
    returning id into v_id;
    v_out := v_out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id_opcao', v_id, 'inicio', v_inicio, 'fim', v_inicio + pg_catalog.make_interval(mins => v_bloco),
      'dia_semana', privado.agenda_dia_semana(v_inicio), 'data', privado.agenda_data(v_inicio),
      'hora', privado.agenda_hora(v_inicio), 'texto', privado.agenda_texto(v_inicio)));
  end loop;

  -- interesse na reunião: o relógio da contingência sessao_sem_agenda
  if v_c.classificacao in ('nao_classificado', 'lead', 'cliente') then
    v_fam := privado.agente_garantir_familia(v_c.id, true, null);
    v_o := privado.agente_oportunidade_aberta(v_fam);
    update public.oportunidade o set sessao_interesse_em = coalesce(o.sessao_interesse_em, pg_catalog.now())
     where o.id = v_o.id;
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'opcoes', v_out, 'valida_ate', v_ate, 'consultada_em', v_consulta);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_opcoes_horario(uuid, jsonb, timestamptz) is '[v4.3] Apêndice A: grava as opções que a Isadora vai oferecer (até 3, cada uma de agora mais a antecedência em diante), com valida_ate no fim do dia da consulta em America/Sao_Paulo, descarta as anteriores da conversa e devolve o id_opcao e o texto de cada uma. Recusa consulta com mais de 15 minutos (consulta_antiga). Marca o interesse na reunião (sessao_interesse_em).';

-- --- 7.3 agente.validar_opcao_horario ----------------------------------------------------------
create function agente.validar_opcao_horario(conversa_id uuid, id_opcao uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v jsonb;
begin
  perform privado.agente_contexto();
  v := privado.agenda_opcao(validar_opcao_horario.conversa_id, validar_opcao_horario.id_opcao, false);
  if not (v ->> 'ok')::boolean then
    return v;
  end if;
  return pg_catalog.jsonb_build_object('ok', true) || (v -> 'opcao');
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.validar_opcao_horario(uuid, uuid) is '[v4.3] Apêndice A: a opção foi oferecida hoje nesta conversa, não foi usada e respeita a antecedência? ok com início, fim e texto; senão erro expirada, usada, antecedencia, descartada ou inexistente. Só lê: a conferência na escolha é registrar_conferencia_horario.';

-- --- 7.4 agente.registrar_conferencia_horario ----------------------------------------------------
-- Segunda consulta à agenda, na escolha da família. livre: a opção fica
-- conferida (a ficha passa a aguardando_email). Ocupada: a opção é descartada
-- e a Isadora oferece duas novas, consultadas naquele momento.
create function agente.registrar_conferencia_horario(conversa_id uuid, id_opcao uuid, livre boolean) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v jsonb;
begin
  perform privado.agente_contexto();
  v := privado.agenda_opcao(registrar_conferencia_horario.conversa_id, registrar_conferencia_horario.id_opcao, false);
  if not (v ->> 'ok')::boolean then
    return v;
  end if;
  if coalesce(registrar_conferencia_horario.livre, false) then
    update public.sessao_venda_opcao o set conferida_em = pg_catalog.now() where o.id = registrar_conferencia_horario.id_opcao;
    return pg_catalog.jsonb_build_object('ok', true, 'estado', 'livre') || (v -> 'opcao');
  end if;
  update public.sessao_venda_opcao o set descartada_em = pg_catalog.now() where o.id = registrar_conferencia_horario.id_opcao;
  return pg_catalog.jsonb_build_object('ok', true, 'estado', 'ocupado');
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_conferencia_horario(uuid, uuid, boolean) is '[v4.3] Registra a segunda consulta à agenda, feita na escolha da família (PRD 11.14). Livre: conferida_em e a ficha passa a aguardando_email. Ocupada: a opção é descartada. Recusa opção de outro dia, já usada ou dentro da antecedência. registrar_reuniao só aceita opção conferida.';

-- --- 7.5 agente.reuniao_da_conversa ------------------------------------------------------------------
-- Única fonte do id do evento para as ferramentas de agenda (PRD 11.9). Só a
-- reunião marcada pela Isadora traz o id: a marcada pela equipe não tem
-- evento no Google e a Isadora não a move nem a apaga.
create function agente.reuniao_da_conversa(conversa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c     public.conversa;
  v_s     public.sessao_venda;
  v_bloco integer := privado.agenda_bloco();
begin
  perform privado.agente_contexto();
  select c.* into v_c from public.conversa c where c.id = reuniao_da_conversa.conversa_id;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if v_c.familia_id is not null then
    v_s := privado.agenda_sessao_vigente(v_c.familia_id);
  end if;
  if v_s.id is null then
    return pg_catalog.jsonb_build_object('ok', true, 'existe', false);
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'existe', true,
    'sessao_id', v_s.id,
    'agendada_por', v_s.agendada_por,
    'evento_id', case when v_s.agendada_por = 'isadora' then v_s.evento_calendar_id end,
    'status', v_s.status,
    'inicio', v_s.agendada_para,
    'fim', v_s.agendada_para + pg_catalog.make_interval(mins => coalesce(v_bloco, 0)),
    'dia_semana', privado.agenda_dia_semana(v_s.agendada_para),
    'data', privado.agenda_data(v_s.agendada_para),
    'hora', privado.agenda_hora(v_s.agendada_para),
    'texto', privado.agenda_texto(v_s.agendada_para),
    'link', v_s.link_reuniao,
    'lembrete_enviado_em', v_s.lembrete_enviado_em);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.reuniao_da_conversa(uuid) is '[v4.3] Apêndice A: a reunião agendada da família da conversa (início, fim, link, quem marcou) e, só se foi a Isadora, o id do evento no Google Calendar. É a única fonte do id do evento para as ferramentas de agenda; o modelo nunca o preenche.';

-- --- 7.6 agente.registrar_reuniao -----------------------------------------------------------------------
-- Cria a sessao_venda da Isadora depois que o evento existe no calendário.
-- Idempotente por evento_id: repetir a chamada com o mesmo evento devolve a
-- mesma sessão, sem duplicar o P1, o lembrete nem o aviso.
create function agente.registrar_reuniao(
  conversa_id   uuid,
  id_opcao      uuid,
  evento_id     text,
  link          text,
  email         text,
  email_parceiro text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c        public.conversa;
  v_fam      uuid;
  v_f        public.familia;
  v_evento   text := pg_catalog.btrim(registrar_reuniao.evento_id);
  v_link     text := pg_catalog.btrim(registrar_reuniao.link);
  v_email    text := pg_catalog.btrim(registrar_reuniao.email);
  v_dup      public.sessao_venda;
  v_op       jsonb;
  v_inicio   timestamptz;
  v_o        public.oportunidade;
  v_condutor uuid;
  v_id       uuid;
  v_estagio  text;
  v_lembrete timestamptz;
  v_pessoa   uuid;
  v_grupo    jsonb;
  v_avisos   text[] := '{}';
begin
  perform privado.agente_contexto();

  if v_evento is null or v_evento !~ '^[A-Za-z0-9_-]{5,255}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'evento_invalido');
  end if;
  if v_link is null or v_link !~ '^https://[^[:space:]]+$' or pg_catalog.length(v_link) > 500 then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'link_invalido');
  end if;
  if not privado.formulario_email_valido(v_email) then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'email_invalido');
  end if;

  select c.* into v_c from public.conversa c where c.id = registrar_reuniao.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;

  -- idempotência por evento
  select s.* into v_dup from public.sessao_venda s where s.evento_calendar_id = v_evento;
  if found then
    if v_c.familia_id is null or v_dup.familia_id <> privado.familia_vigente(v_c.familia_id) then
      return pg_catalog.jsonb_build_object('ok', false, 'erro', 'evento_de_outra_familia');
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'duplicado', true, 'sessao_id', v_dup.id, 'status', v_dup.status,
      'inicio', v_dup.agendada_para, 'texto', privado.agenda_texto(v_dup.agendada_para),
      'dia_semana', privado.agenda_dia_semana(v_dup.agendada_para), 'data', privado.agenda_data(v_dup.agendada_para),
      'hora', privado.agenda_hora(v_dup.agendada_para), 'link', v_dup.link_reuniao);
  end if;

  v_op := privado.agenda_opcao(v_c.id, registrar_reuniao.id_opcao, true);
  if not (v_op ->> 'ok')::boolean then
    return v_op;
  end if;
  v_inicio := (v_op #>> '{opcao,inicio}')::timestamptz;

  v_fam := privado.agente_garantir_familia(v_c.id, true, null);
  select f.* into v_f from public.familia f where f.id = v_fam for update;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'familia_em_estado_sensivel');
  end if;
  if v_f.nao_contatar then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'familia_nao_contatar');
  end if;
  if exists (select 1 from public.sessao_venda s where s.familia_id = v_fam and s.status = 'agendada') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'sessao_ja_agendada');
  end if;
  if exists (select 1 from public.sessao_venda s where s.familia_id = v_fam and s.status = 'realizada') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'reuniao_ja_realizada');
  end if;

  -- quem conduz: o perfil da Edilaine, se o parâmetro aponta para um perfil ativo
  begin
    v_condutor := (privado.agente_parametro('agenda_condutora_perfil_id') #>> '{}')::uuid;
  exception
    when others then
      v_condutor := null;
  end;
  if v_condutor is not null and not exists (select 1 from public.perfil p where p.id = v_condutor and p.ativo) then
    v_condutor := null;
    v_avisos := v_avisos || 'condutora_inativa'::text;
  end if;

  -- P1 até sessao_venda_agendada (recusa reunião já realizada e estágio sem caminho)
  v_o := privado.agente_oportunidade_aberta(v_fam);
  v_estagio := privado.agenda_p1_ate_agendada(v_o.id, 'agente: reunião inicial agendada');

  insert into public.sessao_venda (familia_id, agendada_para, conduzida_por, link_reuniao, evento_calendar_id, agendada_por, status)
  values (v_fam, v_inicio, v_condutor, v_link, v_evento, 'isadora', 'agendada')
  returning id into v_id;

  update public.sessao_venda_opcao o set escolhida_em = pg_catalog.now() where o.id = registrar_reuniao.id_opcao;
  update public.sessao_venda_opcao o set descartada_em = pg_catalog.now()
   where o.conversa_id = v_c.id and o.escolhida_em is null and o.descartada_em is null;

  -- e-mail da pessoa (o do parceiro nunca é gravado: entra só no convite)
  select p.id into v_pessoa from public.pessoa p
   where p.id = v_c.pessoa_id and p.familia_id = v_fam;
  if v_pessoa is null then
    select p.id into v_pessoa from public.pessoa p where p.familia_id = v_fam
     order by p.contato_principal desc, (p.papel = 'mae') desc, p.criado_em limit 1;
  end if;
  if v_pessoa is not null then
    update public.pessoa p set email = v_email where p.id = v_pessoa;
  else
    v_avisos := v_avisos || 'email_nao_gravado'::text;
  end if;

  -- cadência e retomadas de horário deixam de valer: a reunião está marcada
  perform privado.agenda_cancelar_execucoes(v_fam,
    array['followup_d1', 'followup_d3_d14', 'reuniao_falta_remarcar', 'consulta_horario_retomada'], 'reuniao_agendada');
  update public.consulta_equipe q set status = 'cancelada'
   where q.conversa_id = v_c.id and q.tipo = 'horario_edilaine' and q.status = 'aberta';

  -- lembrete da véspera, só para reunião marcada com mais de um dia de antecedência
  v_lembrete := privado.agenda_lembrete_em(v_inicio);
  if v_lembrete is not null and coalesce((select a.ativa from public.automacao a where a.id = 'lembrete_sessao'), false) then
    insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
    values ('lembrete_sessao', v_fam, v_lembrete, 'agendada',
            pg_catalog.jsonb_build_object('sessao_venda_id', v_id, 'conversa_id', v_c.id, 'origem', 'isadora'));
  else
    v_lembrete := null;
  end if;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
  values (v_fam, 'sessao', 'Reunião inicial agendada pela Isadora para ' || privado.formatar_data_hora(v_inicio),
          pg_catalog.jsonb_build_object('sessao_venda_id', v_id, 'agendada_para', v_inicio, 'origem', 'isadora'), false);

  v_grupo := privado.agenda_mensagem_grupo('grupo_reuniao_agendada', v_c.id, 'coordenacao_clinica',
    pg_catalog.jsonb_build_object('dia', privado.agenda_dia_semana(v_inicio), 'data', privado.agenda_data(v_inicio),
                                  'hora', privado.agenda_hora(v_inicio)));

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'duplicado', false,
    'sessao_id', v_id,
    'familia_id', v_fam,
    'estagio_p1', v_estagio,
    'inicio', v_inicio,
    'dia_semana', privado.agenda_dia_semana(v_inicio),
    'data', privado.agenda_data(v_inicio),
    'hora', privado.agenda_hora(v_inicio),
    'texto', privado.agenda_texto(v_inicio),
    'link', v_link,
    'lembrete_em', v_lembrete,
    'mensagem_grupo', v_grupo -> 'mensagem',
    'mensagem_grupo_aprovada', v_grupo -> 'aprovada',
    'grupo_jid', v_grupo -> 'grupo_jid',
    'avisos', pg_catalog.to_jsonb(v_avisos));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_reuniao(uuid, uuid, text, text, text, text) is '[v4.3] Apêndice A: chamada só depois de o evento existir no calendário. Cria a sessao_venda (agendada_por isadora, evento, Meet, condutora do parâmetro), move o P1 por privado.transicionar, marca a opção como escolhida e descarta as outras, grava o e-mail da pessoa (o do parceiro não), cancela cadência e retomadas, cria a execução do lembrete da véspera e devolve o aviso ao grupo da Edilaine. Não pausa a Isadora. Idempotente por evento_id. Recusa opção não conferida, de outro dia ou usada, família em freio de bloqueio ou em não contatar, e reunião já realizada.';

-- --- 7.7 agente.registrar_remarcacao ---------------------------------------------------------------------
create function agente.registrar_remarcacao(conversa_id uuid, dados jsonb) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c       public.conversa;
  v_s       public.sessao_venda;
  v_id_op   uuid;
  v_op      jsonb;
  v_inicio  timestamptz;
  v_link    text;
  v_evento  text;
  v_id      uuid;
  v_lembrete timestamptz;
begin
  perform privado.agente_contexto();
  select c.* into v_c from public.conversa c where c.id = registrar_remarcacao.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if v_c.familia_id is not null then
    v_s := privado.agenda_sessao_vigente(v_c.familia_id);
  end if;
  if v_s.id is null or v_s.agendada_por <> 'isadora' then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_reuniao_da_isadora');
  end if;

  begin
    v_id_op := (registrar_remarcacao.dados ->> 'id_opcao')::uuid;
  exception
    when others then
      v_id_op := null;
  end;
  if v_id_op is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'opcao_obrigatoria');
  end if;
  v_evento := coalesce(nullif(pg_catalog.btrim(registrar_remarcacao.dados ->> 'evento_id'), ''), v_s.evento_calendar_id);
  if v_evento is distinct from v_s.evento_calendar_id then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'evento_diferente');
  end if;
  v_link := coalesce(nullif(pg_catalog.btrim(registrar_remarcacao.dados ->> 'link'), ''), v_s.link_reuniao);
  if v_link !~ '^https://[^[:space:]]+$' or pg_catalog.length(v_link) > 500 then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'link_invalido');
  end if;

  v_op := privado.agenda_opcao(v_c.id, v_id_op, true);
  if not (v_op ->> 'ok')::boolean then
    -- repetição da mesma chamada: a reunião já está no horário pedido
    if v_op ->> 'erro' = 'usada' and exists (
         select 1 from public.sessao_venda_opcao o where o.id = v_id_op and o.inicio = v_s.agendada_para) then
      return pg_catalog.jsonb_build_object('ok', true, 'duplicado', true, 'sessao_id', v_s.id,
        'inicio', v_s.agendada_para, 'texto', privado.agenda_texto(v_s.agendada_para),
        'dia_semana', privado.agenda_dia_semana(v_s.agendada_para), 'data', privado.agenda_data(v_s.agendada_para),
        'hora', privado.agenda_hora(v_s.agendada_para), 'link', v_s.link_reuniao);
    end if;
    return v_op;
  end if;
  v_inicio := (v_op #>> '{opcao,inicio}')::timestamptz;

  update public.sessao_venda s set status = 'remarcada' where s.id = v_s.id;
  insert into public.sessao_venda (familia_id, agendada_para, conduzida_por, link_reuniao, evento_calendar_id, agendada_por, status)
  values (v_s.familia_id, v_inicio, v_s.conduzida_por, v_link, v_evento, 'isadora', 'agendada')
  returning id into v_id;

  update public.sessao_venda_opcao o set escolhida_em = pg_catalog.now() where o.id = v_id_op;
  update public.sessao_venda_opcao o set descartada_em = pg_catalog.now()
   where o.conversa_id = v_c.id and o.escolhida_em is null and o.descartada_em is null;

  perform privado.agenda_cancelar_execucoes(v_s.familia_id, array['lembrete_sessao'], 'reuniao_remarcada');
  v_lembrete := privado.agenda_lembrete_em(v_inicio);
  if v_lembrete is not null and coalesce((select a.ativa from public.automacao a where a.id = 'lembrete_sessao'), false) then
    insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
    values ('lembrete_sessao', v_s.familia_id, v_lembrete, 'agendada',
            pg_catalog.jsonb_build_object('sessao_venda_id', v_id, 'conversa_id', v_c.id, 'origem', 'isadora'));
  else
    v_lembrete := null;
  end if;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
  values (v_s.familia_id, 'sessao', 'Reunião inicial remarcada para ' || privado.formatar_data_hora(v_inicio),
          pg_catalog.jsonb_build_object('sessao_venda_id', v_id, 'anterior_id', v_s.id, 'agendada_para', v_inicio,
                                        'origem', 'isadora'), false);

  return pg_catalog.jsonb_build_object(
    'ok', true, 'duplicado', false, 'sessao_id', v_id, 'anterior_id', v_s.id,
    'inicio', v_inicio, 'dia_semana', privado.agenda_dia_semana(v_inicio), 'data', privado.agenda_data(v_inicio),
    'hora', privado.agenda_hora(v_inicio), 'texto', privado.agenda_texto(v_inicio), 'link', v_link,
    'lembrete_em', v_lembrete);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_remarcacao(uuid, jsonb) is '[v4.3] Apêndice A: depois de o evento ser movido no calendário, a sessão antiga vira remarcada e nasce a nova agendada (mesmo evento, mesma condutora), com o lembrete da véspera refeito. dados: id_opcao (obrigatório, conferida), evento_id (opcional, tem de ser o da sessão) e link. Só a reunião marcada pela Isadora. Repetir a chamada devolve duplicado.';

-- --- 7.8 agente.registrar_cancelamento --------------------------------------------------------------------
create function agente.registrar_cancelamento(conversa_id uuid, dados jsonb) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c      public.conversa;
  v_s      public.sessao_venda;
  v_o      public.oportunidade;
  v_motivo text := privado.campo_livre(privado.mascarar_documentos(registrar_cancelamento.dados ->> 'motivo'));
  v_estagio text;
begin
  perform privado.agente_contexto();
  select c.* into v_c from public.conversa c where c.id = registrar_cancelamento.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if v_c.familia_id is not null then
    v_s := privado.agenda_sessao_vigente(v_c.familia_id);
  end if;
  if v_s.id is null or v_s.agendada_por <> 'isadora' then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'sem_reuniao_da_isadora');
  end if;

  update public.sessao_venda s set status = 'cancelada' where s.id = v_s.id;
  perform privado.agenda_cancelar_execucoes(v_s.familia_id, array['lembrete_sessao'], 'reuniao_cancelada');

  v_o := privado.agente_oportunidade_aberta(v_s.familia_id);
  if v_o.id is not null and v_o.estagio_p2 is null and v_o.estagio_p1 = 'sessao_venda_agendada' then
    perform privado.transicionar('p1', v_o.id, 'qualificado', 'agente: reunião inicial cancelada a pedido da família');
  end if;
  select o.estagio_p1::text into v_estagio from public.oportunidade o where o.id = v_o.id;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
  values (v_s.familia_id, 'sessao', 'Reunião inicial cancelada a pedido da família',
          pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'origem', 'isadora',
                                                                     'motivo', v_motivo)), false);

  return pg_catalog.jsonb_build_object('ok', true, 'sessao_id', v_s.id, 'estagio_p1', v_estagio);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_cancelamento(uuid, jsonb) is '[v4.3] Apêndice A: depois de o evento ser apagado no calendário a pedido da família, a sessão da Isadora vira cancelada, o P1 volta a qualificado e o lembrete pendente é cancelado. dados: motivo (curto, mascarado, 200 caracteres). Só a reunião marcada pela Isadora.';


-- --- 7.9 agente.registrar_consulta_equipe ---------------------------------------------------------------------
-- Pergunta da Isadora à equipe SEM transferir a conversa (PRD 11.14). Não
-- pausa a Isadora, não abre handoff e não muda o modo. Área e dúvida vão ao
-- comercial; horário que a agenda não tem vai à Edilaine (coordenação
-- clínica). Uma consulta aberta igual na mesma conversa não gera aviso novo.
create function agente.registrar_consulta_equipe(
  conversa_id uuid,
  tipo        text,
  pergunta    text,
  preferencia jsonb default '{}'::jsonb
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c        public.conversa;
  v_tipo     public.tipo_consulta_equipe;
  v_pergunta text := privado.campo_livre(privado.mascarar_documentos(registrar_consulta_equipe.pergunta));
  v_pref     jsonb := coalesce(registrar_consulta_equipe.preferencia, '{}'::jsonb);
  v_fam      uuid;
  v_dest     public.handoff_destino;
  v_prior    public.prioridade := 'normal';
  v_dias     numeric;
  v_q        public.consulta_equipe;
  v_tarefa   uuid;
  v_grupo    jsonb;
  v_chave    text;
  v_legivel  text;
  v_pref_txt text;
begin
  perform privado.agente_contexto();
  if registrar_consulta_equipe.tipo is null or registrar_consulta_equipe.tipo not in ('area', 'duvida', 'horario_edilaine') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'tipo_invalido');
  end if;
  v_tipo := registrar_consulta_equipe.tipo::public.tipo_consulta_equipe;
  if v_pergunta is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'pergunta_obrigatoria');
  end if;
  if pg_catalog.jsonb_typeof(v_pref) <> 'object' then
    v_pref := '{}'::jsonb;
  end if;
  -- preferência de horário: só texto curto (dias e períodos que a família disse)
  v_pref := (select coalesce(pg_catalog.jsonb_object_agg(k.key, pg_catalog.to_jsonb(privado.campo_livre(privado.mascarar_documentos(k.value #>> '{}')))), '{}'::jsonb)
             from pg_catalog.jsonb_each(v_pref) k
             where k.key in ('dias', 'periodos', 'observacao', 'motivo', 'prioridade')
               and pg_catalog.jsonb_typeof(k.value) = 'string');
  if v_pref ->> 'prioridade' = 'alta' then
    v_prior := 'alta';
  end if;
  v_pref := v_pref - 'prioridade';

  select c.* into v_c from public.conversa c where c.id = registrar_consulta_equipe.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if v_c.classificacao in ('nao_classificado', 'lead', 'cliente') then
    v_fam := privado.agente_garantir_familia(v_c.id, true, null);
  elsif v_c.familia_id is not null then
    v_fam := privado.familia_vigente(v_c.familia_id);
  end if;

  v_dest := case when v_tipo = 'horario_edilaine' then 'coordenacao_clinica' else 'comercial' end;

  -- consulta aberta igual: não avisa de novo (horário: só acrescenta a preferência)
  select q.* into v_q
  from public.consulta_equipe q
  where q.conversa_id = v_c.id and q.tipo = v_tipo and q.status = 'aberta'
    and (v_tipo = 'horario_edilaine'
         or privado.normalizar_local(q.pergunta) = privado.normalizar_local(v_pergunta))
  order by q.criado_em desc
  limit 1
  for update;
  if found then
    if v_tipo = 'horario_edilaine' then
      update public.consulta_equipe q
         set preferencia = q.preferencia || v_pref, pergunta = v_pergunta
       where q.id = v_q.id;
    end if;
    return pg_catalog.jsonb_build_object('ok', true, 'duplicado', true, 'consulta_id', v_q.id, 'destino', v_q.destino,
                                         'mensagem_grupo', null, 'grupo_jid', null);
  end if;

  v_dias := privado.agente_parametro_numero('agenda_consulta_horario_dias');
  insert into public.consulta_equipe (conversa_id, familia_id, tipo, pergunta, preferencia, destino, expira_em)
  values (v_c.id, v_fam, v_tipo, v_pergunta, v_pref, v_dest,
          case when v_tipo = 'horario_edilaine' and v_dias > 0
               then pg_catalog.now() + pg_catalog.make_interval(days => v_dias::integer) end)
  returning * into v_q;

  insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
  values ('responder_consulta_isadora', v_fam,
          case when v_dest = 'comercial' then 'comercial'::public.papel_usuario else 'coordenacao'::public.papel_usuario end,
          v_prior, 'Responder consulta da Isadora',
          pg_catalog.jsonb_build_object('consulta_id', v_q.id, 'tipo', v_tipo))
  returning id into v_tarefa;

  v_chave := case when v_tipo = 'horario_edilaine' then 'grupo_consulta_horario' else 'grupo_consulta' end;
  v_legivel := case v_tipo when 'area' then 'Área de atendimento' else 'Dúvida' end;
  v_pref_txt := nullif(pg_catalog.concat_ws(', ', v_pref ->> 'dias', v_pref ->> 'periodos'), '');
  v_grupo := privado.agenda_mensagem_grupo(v_chave, v_c.id, v_dest,
    pg_catalog.jsonb_build_object('tipo_legivel', v_legivel, 'pergunta', v_pergunta,
                                  'preferencia', coalesce(v_pref_txt, 'outro horário')));

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'duplicado', false,
    'consulta_id', v_q.id,
    'tarefa_id', v_tarefa,
    'destino', v_dest,
    'mensagem_grupo', v_grupo -> 'mensagem',
    'mensagem_grupo_aprovada', v_grupo -> 'aprovada',
    'grupo_jid', v_grupo -> 'grupo_jid',
    -- instrução para o modelo (não vai à família): vale o texto aprovado ou, enquanto for rascunho, o rascunho
    'instrucao_agente', coalesce(
      privado.agente_texto(case when v_pref ->> 'motivo' = 'indisponivel' then 'instrucao_agenda_indisponivel' else 'instrucao_consulta' end, true),
      privado.agente_texto(case when v_pref ->> 'motivo' = 'indisponivel' then 'instrucao_agenda_indisponivel' else 'instrucao_consulta' end, false)));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_consulta_equipe(uuid, text, text, jsonb) is '[v4.3] Apêndice A: grava a consulta à equipe (area, duvida ou horario_edilaine), cria a tarefa responder_consulta_isadora e devolve o texto do grupo e o JID do destino. Não pausa a Isadora, não abre handoff e não muda o modo. Consulta aberta igual na mesma conversa não reavisa. Pergunta e preferência passam pela máscara de documentos e por 200 caracteres.';

-- --- 7.10 agente.proativos_agenda_devidos ----------------------------------------------------------------------
-- Entrada B do fluxo 3, nós 42 a 47 (PRD 19.4): o que a Isadora escreve por
-- iniciativa própria em torno da agenda. Reserva o que devolve, como
-- agente.followups_devidos (nunca devolve o mesmo item duas vezes na janela).
--   lembrete    véspera da reunião marcada pela Isadora (operacional)
--   falta       remarcação depois de uma falta registrada no CRM (conteúdo)
--   devolutiva  resposta da equipe a uma consulta area ou duvida (conteúdo)
--   horario     consulta horario_edilaine aberta: consultar a agenda de novo
--               e oferecer (conteúdo)
-- Os mesmos filtros de followups_devidos (freio, não contatar, pausa,
-- transferência aberta, modo, lista de teste, janela, um conteúdo por dia).
-- Motivo definitivo cancela a execução; motivo passageiro espera a próxima
-- rodada.
create function agente.proativos_agenda_devidos() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_itens     jsonb := '[]'::jsonb;
  v_rec       public.automacao_execucao;
  v_q         public.consulta_equipe;
  v_s         public.sessao_venda;
  v_conv      public.conversa;
  v_conv_id   uuid;
  v_pode      jsonb;
  v_texto     text;
  v_nome      text;
  v_cancelar  text;
  v_reservadas integer := 0;
  v_canceladas integer := 0;
  v_aguardando integer := 0;
  v_espera_min constant integer := 20;   -- a mesma consulta só volta depois disto (a rodada é de 30 min)
begin
  perform privado.agente_contexto();

  -- 1. lembretes da véspera -------------------------------------------------------------------
  for v_rec in
    select e.* from public.automacao_execucao e
    where e.automacao_id = 'lembrete_sessao' and e.status = 'agendada'
      and e.agendada_para <= pg_catalog.clock_timestamp()
      and e.payload ->> 'origem' = 'isadora'
      and not (coalesce(e.payload, '{}'::jsonb) ? 'reservada_em')
    order by e.agendada_para
    for update of e skip locked
  loop
    v_cancelar := null;
    select s.* into v_s from public.sessao_venda s where s.id = (v_rec.payload ->> 'sessao_venda_id')::uuid;
    select c.* into v_conv from public.conversa c where c.id = (v_rec.payload ->> 'conversa_id')::uuid;
    if v_s.id is null or v_s.status <> 'agendada' or v_s.agendada_por <> 'isadora' or v_s.lembrete_enviado_em is not null then
      v_cancelar := 'sessao_mudou';
    elsif v_s.agendada_para <= pg_catalog.now() then
      v_cancelar := 'reuniao_passou';
    elsif v_conv.id is null then
      v_cancelar := 'conversa_inexistente';
    elsif not privado.pode_executar(v_rec.familia_id, 'lembrete_sessao', v_rec.id) then
      v_canceladas := v_canceladas + 1;   -- pode_executar já gravou abortada_freio
      continue;
    else
      v_pode := privado.agenda_pode_falar(v_conv.id, 'operacional');
      if not (v_pode ->> 'pode')::boolean then
        if (v_pode ->> 'definitivo')::boolean then
          v_cancelar := v_pode ->> 'motivo';
        else
          v_aguardando := v_aguardando + 1;
          continue;
        end if;
      end if;
    end if;
    if v_cancelar is null then
      v_texto := privado.agente_texto('lembrete_sessao', true);
      if v_texto is null then
        v_cancelar := 'texto_nao_aprovado';
      end if;
    end if;
    if v_cancelar is not null then
      update public.automacao_execucao e set status = 'cancelada', motivo_aborto = v_cancelar where e.id = v_rec.id;
      v_canceladas := v_canceladas + 1;
      continue;
    end if;

    update public.automacao_execucao e
       set payload = coalesce(e.payload, '{}'::jsonb) || pg_catalog.jsonb_build_object('reservada_em', pg_catalog.now())
     where e.id = v_rec.id;
    v_reservadas := v_reservadas + 1;
    v_nome := privado.agente_primeiro_nome(v_conv.id);
    v_itens := v_itens || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'tipo', 'lembrete',
      'execucao_id', v_rec.id,
      'sessao_id', v_s.id,
      'conversa_id', v_conv.id,
      'wa_jid', v_conv.wa_jid,
      'nome', coalesce(v_nome, ''),
      'inicio', v_s.agendada_para,
      'dia_semana', privado.agenda_dia_semana(v_s.agendada_para),
      'data', privado.agenda_data(v_s.agendada_para),
      'hora', privado.agenda_hora(v_s.agendada_para),
      'texto_horario', privado.agenda_texto(v_s.agendada_para),
      'link', v_s.link_reuniao,
      'texto_base', privado.aplicar_texto(v_texto, v_nome,
                      pg_catalog.jsonb_build_object('hora', privado.agenda_hora(v_s.agendada_para), 'link', v_s.link_reuniao)),
      'data_hora', privado.formatar_data_hora(pg_catalog.now())));
  end loop;

  -- 2. remarcação depois de uma falta ---------------------------------------------------------
  for v_rec in
    select e.* from public.automacao_execucao e
    where e.automacao_id = 'reuniao_falta_remarcar' and e.status = 'agendada'
      and e.agendada_para <= pg_catalog.clock_timestamp()
      and not (coalesce(e.payload, '{}'::jsonb) ? 'reservada_em')
    order by e.agendada_para
    for update of e skip locked
  loop
    v_cancelar := null;
    select c.* into v_conv from public.conversa c where c.id = (v_rec.payload ->> 'conversa_id')::uuid;
    if v_conv.id is null then
      v_cancelar := 'conversa_inexistente';
    elsif exists (select 1 from public.sessao_venda s
                  where s.familia_id = privado.familia_vigente(v_rec.familia_id) and s.status in ('agendada', 'realizada')) then
      v_cancelar := 'ja_remarcada_ou_realizada';
    elsif not privado.pode_executar(v_rec.familia_id, 'reuniao_falta_remarcar', v_rec.id) then
      v_canceladas := v_canceladas + 1;
      continue;
    else
      v_pode := privado.agenda_pode_falar(v_conv.id, 'conteudo');
      if not (v_pode ->> 'pode')::boolean then
        if (v_pode ->> 'definitivo')::boolean then
          v_cancelar := v_pode ->> 'motivo';
        else
          v_aguardando := v_aguardando + 1;
          continue;
        end if;
      end if;
    end if;
    if v_cancelar is null then
      v_texto := privado.agente_texto('nao_compareceu', true);
      if v_texto is null then
        v_cancelar := 'texto_nao_aprovado';
      end if;
    end if;
    if v_cancelar is not null then
      update public.automacao_execucao e set status = 'cancelada', motivo_aborto = v_cancelar where e.id = v_rec.id;
      v_canceladas := v_canceladas + 1;
      continue;
    end if;

    update public.automacao_execucao e
       set payload = coalesce(e.payload, '{}'::jsonb) || pg_catalog.jsonb_build_object('reservada_em', pg_catalog.now())
     where e.id = v_rec.id;
    v_reservadas := v_reservadas + 1;
    v_nome := privado.agente_primeiro_nome(v_conv.id);
    v_itens := v_itens || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'tipo', 'falta',
      'execucao_id', v_rec.id,
      'conversa_id', v_conv.id,
      'wa_jid', v_conv.wa_jid,
      'nome', coalesce(v_nome, ''),
      'texto_base', privado.aplicar_texto(v_texto, v_nome, '{}'::jsonb),
      'data_hora', privado.formatar_data_hora(pg_catalog.now())));
  end loop;

  -- 3. consultas respondidas pela equipe e horários à espera de uma abertura ----------------------
  for v_q in
    select q.* from public.consulta_equipe q
    where ((q.status = 'respondida' and q.devolvida_em is null and q.resposta is not null)
           or (q.status = 'aberta' and q.tipo = 'horario_edilaine'
               and (q.expira_em is null or q.expira_em > pg_catalog.now())))
      and (q.reservada_em is null or q.reservada_em < pg_catalog.now() - pg_catalog.make_interval(mins => v_espera_min))
    order by q.criado_em
    for update of q skip locked
  loop
    v_cancelar := null;
    select c.* into v_conv from public.conversa c where c.id = v_q.conversa_id;
    if v_conv.id is null then
      v_cancelar := 'conversa_inexistente';
    else
      v_pode := privado.agenda_pode_falar(v_conv.id, 'conteudo');
      if not (v_pode ->> 'pode')::boolean then
        if (v_pode ->> 'definitivo')::boolean then
          v_cancelar := v_pode ->> 'motivo';
        else
          v_aguardando := v_aguardando + 1;
          continue;
        end if;
      end if;
    end if;
    -- reunião já marcada: a consulta de horário não tem mais o que oferecer
    if v_cancelar is null and v_q.tipo = 'horario_edilaine' and v_conv.familia_id is not null
       and privado.agenda_sessao_vigente(v_conv.familia_id) is not null then
      v_cancelar := 'reuniao_agendada';
    end if;
    if v_cancelar is not null then
      update public.consulta_equipe q set status = 'cancelada' where q.id = v_q.id;
      update public.tarefa t set status = 'cancelada'
       where t.tipo = 'responder_consulta_isadora' and t.payload ->> 'consulta_id' = v_q.id::text
         and t.status in ('aberta', 'em_andamento');
      v_canceladas := v_canceladas + 1;
      continue;
    end if;

    update public.consulta_equipe q set reservada_em = pg_catalog.now() where q.id = v_q.id;
    v_reservadas := v_reservadas + 1;
    v_nome := privado.agente_primeiro_nome(v_conv.id);
    v_itens := v_itens || pg_catalog.jsonb_build_array(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'tipo', case when v_q.status = 'respondida' and v_q.tipo <> 'horario_edilaine' then 'devolutiva' else 'horario' end,
      'consulta_id', v_q.id,
      'consulta_tipo', v_q.tipo,
      'conversa_id', v_conv.id,
      'wa_jid', v_conv.wa_jid,
      'nome', coalesce(v_nome, ''),
      'pergunta', v_q.pergunta,
      'resposta', v_q.resposta,
      'preferencia', case when v_q.tipo = 'horario_edilaine' then v_q.preferencia end,
      'texto_base', case when v_q.tipo = 'horario_edilaine'
                         then privado.aplicar_texto(privado.agente_texto('horario_liberado', true), v_nome, '{}'::jsonb) end,
      'data_hora', privado.formatar_data_hora(pg_catalog.now()))));
  end loop;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'itens', v_itens,
    'validador', pg_catalog.jsonb_build_object('listas', privado.agente_parametro('validador_listas')),
    'reservadas', v_reservadas, 'canceladas', v_canceladas, 'aguardando', v_aguardando);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.proativos_agenda_devidos() is '[v4.3] Apêndice A e PRD 19.4 nós 42 a 47: o que a Isadora escreve por iniciativa própria em torno da agenda: lembrete da véspera (operacional), remarcação depois de falta (conteúdo), devolutiva de consulta respondida pela equipe e consulta horario_edilaine à espera de horário (conteúdo). Reserva o que devolve; motivo definitivo (humano_comercial, cliente, não contatar, freio, teste fora da lista...) cancela, motivo passageiro (janela, pausa, transferência aberta, conteúdo já enviado hoje) espera. Devolve itens {tipo, execucao_id ou consulta_id, conversa_id, wa_jid, nome, texto_base, ...}; nunca o id do evento.';

-- --- 7.11 agente.registrar_lembrete ------------------------------------------------------------------------------
-- Fecha o lembrete da véspera. ok: registra que saiu (sessao_venda.lembrete_enviado_em),
-- grava a mensagem da Isadora e conta como executada. Não saiu: volta uma vez
-- na próxima rodada; na segunda vira tarefa do comercial.
create function agente.registrar_lembrete(sessao_id uuid, ok boolean, texto text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_s         public.sessao_venda;
  v_e         public.automacao_execucao;
  v_texto     text := nullif(pg_catalog.btrim(privado.mascarar_documentos(registrar_lembrete.texto)), '');
  v_conversa  uuid;
  v_mensagem  uuid;
  v_tentativas integer;
begin
  perform privado.agente_contexto();
  select s.* into v_s from public.sessao_venda s where s.id = registrar_lembrete.sessao_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'sessao_nao_encontrada');
  end if;
  select e.* into v_e from public.automacao_execucao e
  where e.automacao_id = 'lembrete_sessao' and e.payload ->> 'sessao_venda_id' = v_s.id::text
    and e.status = 'agendada' and (e.payload ? 'reservada_em')
  order by e.criado_em desc limit 1
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'execucao_nao_reservada');
  end if;
  v_conversa := (v_e.payload ->> 'conversa_id')::uuid;

  if coalesce(registrar_lembrete.ok, false) and v_texto is not null then
    insert into public.mensagem (conversa_id, direcao, enviado_por, tipo, conteudo)
    values (v_conversa, 'saida', 'ia', 'texto', v_texto)
    returning id into v_mensagem;
    update public.conversa c set ultima_saida_em = pg_catalog.now() where c.id = v_conversa;
    update public.sessao_venda s set lembrete_enviado_em = pg_catalog.now() where s.id = v_s.id;
    update public.automacao_execucao e
       set status = 'executada', executada_em = pg_catalog.clock_timestamp(),
           payload = e.payload || pg_catalog.jsonb_build_object('mensagem_id', v_mensagem)
     where e.id = v_e.id;
    insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
    values (v_s.familia_id, 'sessao', 'Lembrete da reunião enviado pela Isadora',
            pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'execucao_id', v_e.id), false);
    return pg_catalog.jsonb_build_object('ok', true, 'status', 'executada', 'mensagem_id', v_mensagem);
  end if;

  v_tentativas := coalesce((v_e.payload ->> 'tentativas')::integer, 0) + 1;
  if v_tentativas < 2 then
    update public.automacao_execucao e
       set payload = (e.payload - 'reservada_em') || pg_catalog.jsonb_build_object('tentativas', v_tentativas)
     where e.id = v_e.id;
    return pg_catalog.jsonb_build_object('ok', true, 'status', 'agendada', 'tentativas', v_tentativas);
  end if;
  update public.automacao_execucao e
     set status = 'falhou', erro = 'lembrete_nao_saiu_duas_vezes',
         payload = e.payload || pg_catalog.jsonb_build_object('tentativas', v_tentativas)
   where e.id = v_e.id;
  insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload, origem_automacao_id)
  values ('agendar_sessao', v_s.familia_id, 'comercial', 'alta', 'lembrete_reuniao_nao_saiu',
          pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'execucao_id', v_e.id), 'lembrete_sessao');
  return pg_catalog.jsonb_build_object('ok', true, 'status', 'falhou', 'tentativas', v_tentativas, 'tarefa_criada', true);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_lembrete(uuid, boolean, text) is '[v4.3] Apêndice A: fecha o lembrete da véspera reservado por proativos_agenda_devidos. Saiu: grava a mensagem da Isadora, sessao_venda.lembrete_enviado_em e a execução como executada. Não saiu: volta uma vez na próxima rodada; na segunda, falhou e vira tarefa do comercial.';

-- --- 7.12 agente.fechar_consulta ---------------------------------------------------------------------------------------
-- notificada: o aviso ao grupo saiu. devolvida: a Isadora respondeu à família
-- (grava a mensagem, se vier o texto). expirada e cancelada encerram a consulta.
create function agente.fechar_consulta(consulta_id uuid, status text, texto text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_q      public.consulta_equipe;
  v_texto  text := nullif(pg_catalog.btrim(privado.mascarar_documentos(fechar_consulta.texto)), '');
  v_msg    uuid;
begin
  perform privado.agente_contexto();
  if fechar_consulta.status is null or fechar_consulta.status not in ('notificada', 'devolvida', 'expirada', 'cancelada') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido');
  end if;
  select q.* into v_q from public.consulta_equipe q where q.id = fechar_consulta.consulta_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'consulta_nao_encontrada');
  end if;

  if fechar_consulta.status = 'notificada' then
    update public.consulta_equipe q set notificada_em = pg_catalog.now() where q.id = v_q.id;
  elsif fechar_consulta.status = 'devolvida' then
    if v_texto is not null then
      insert into public.mensagem (conversa_id, direcao, enviado_por, tipo, conteudo)
      values (v_q.conversa_id, 'saida', 'ia', 'texto', v_texto)
      returning id into v_msg;
      update public.conversa c set ultima_saida_em = pg_catalog.now() where c.id = v_q.conversa_id;
    end if;
    -- consulta de horário resolvida pela abertura de um horário: fecha como respondida
    update public.consulta_equipe q
       set devolvida_em = pg_catalog.now(),
           status = case when q.status = 'aberta' then 'respondida'::public.status_consulta_equipe else q.status end,
           respondida_em = coalesce(q.respondida_em, pg_catalog.now())
     where q.id = v_q.id;
    update public.tarefa t set status = 'concluida', concluida_em = pg_catalog.now()
     where t.tipo = 'responder_consulta_isadora' and t.payload ->> 'consulta_id' = v_q.id::text
       and t.status in ('aberta', 'em_andamento');
  else
    update public.consulta_equipe q set status = fechar_consulta.status::public.status_consulta_equipe where q.id = v_q.id;
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'consulta_id', v_q.id, 'status', fechar_consulta.status, 'mensagem_id', v_msg);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.fechar_consulta(uuid, text, text) is '[v4.3] Apêndice A: notificada (aviso ao grupo enviado), devolvida (a Isadora respondeu à família; grava a mensagem e conclui a tarefa; consulta de horário aberta fecha como respondida), expirada ou cancelada.';

-- --- 7.13 agente.sessoes_para_sincronizar e agente.sincronizar_reuniao ------------------------------------------------
-- Entrada B do fluxo 4 (PRD 19.6): compara as reuniões da Isadora dos próximos
-- dias com o calendário. Único ponto em que o id do evento sai em lote.
create function agente.sessoes_para_sincronizar() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_janela numeric := coalesce(privado.agente_parametro_numero('agenda_janela_dias'), 0);
  v_bloco  integer := privado.agenda_bloco();
begin
  perform privado.agente_contexto();
  return pg_catalog.jsonb_build_object('ok', true, 'itens',
    (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
              'sessao_id', s.id, 'evento_id', s.evento_calendar_id, 'inicio', s.agendada_para,
              'fim', s.agendada_para + pg_catalog.make_interval(mins => coalesce(v_bloco, 0)),
              'link', s.link_reuniao) order by s.agendada_para), '[]'::jsonb)
     from public.sessao_venda s
     where s.status = 'agendada' and s.agendada_por = 'isadora' and s.evento_calendar_id is not null
       and s.agendada_para > pg_catalog.now()
       and s.agendada_para <= pg_catalog.now() + pg_catalog.make_interval(days => v_janela::integer)));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.sessoes_para_sincronizar() is '[v4.3] Apêndice A e PRD 19.6 nó 19: as reuniões agendadas pela Isadora nos próximos agenda_janela_dias, com o id do evento vindo do banco, para o fluxo 4 comparar com o Google Calendar.';

create function agente.sincronizar_reuniao(
  sessao_id uuid,
  inicio    timestamptz,
  fim       timestamptz,
  status    text,
  link      text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_s        public.sessao_venda;
  v_o        public.oportunidade;
  v_link     text := nullif(pg_catalog.btrim(sincronizar_reuniao.link), '');
  v_lembrete timestamptz;
  v_conversa uuid;
begin
  perform privado.agente_contexto();
  if sincronizar_reuniao.status is null or sincronizar_reuniao.status not in ('movida', 'apagada') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'status_invalido');
  end if;
  select s.* into v_s from public.sessao_venda s where s.id = sincronizar_reuniao.sessao_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'sessao_nao_encontrada');
  end if;
  if v_s.status <> 'agendada' or v_s.agendada_por <> 'isadora' then
    return pg_catalog.jsonb_build_object('ok', true, 'alterada', false);
  end if;

  if sincronizar_reuniao.status = 'movida' then
    if sincronizar_reuniao.inicio is null then
      return pg_catalog.jsonb_build_object('ok', false, 'erro', 'inicio_obrigatorio');
    end if;
    if v_link is not null and (v_link !~ '^https://[^[:space:]]+$' or pg_catalog.length(v_link) > 500) then
      return pg_catalog.jsonb_build_object('ok', false, 'erro', 'link_invalido');
    end if;
    if sincronizar_reuniao.inicio = v_s.agendada_para and v_link is not distinct from null then
      return pg_catalog.jsonb_build_object('ok', true, 'alterada', false);
    end if;
    update public.sessao_venda s
       set agendada_para = sincronizar_reuniao.inicio, link_reuniao = coalesce(v_link, s.link_reuniao)
     where s.id = v_s.id;
    -- o lembrete acompanha o horário novo
    select (e.payload ->> 'conversa_id')::uuid into v_conversa from public.automacao_execucao e
     where e.automacao_id = 'lembrete_sessao' and e.payload ->> 'sessao_venda_id' = v_s.id::text
     order by e.criado_em desc limit 1;
    perform privado.agenda_cancelar_execucoes(v_s.familia_id, array['lembrete_sessao'], 'evento_movido');
    v_lembrete := privado.agenda_lembrete_em(sincronizar_reuniao.inicio);
    if v_lembrete is not null and v_conversa is not null and v_s.lembrete_enviado_em is null
       and coalesce((select a.ativa from public.automacao a where a.id = 'lembrete_sessao'), false) then
      insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
      values ('lembrete_sessao', v_s.familia_id, v_lembrete, 'agendada',
              pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'conversa_id', v_conversa, 'origem', 'isadora'));
    end if;
    insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
    values (v_s.familia_id, 'sessao', 'Reunião inicial movida no calendário para ' || privado.formatar_data_hora(sincronizar_reuniao.inicio),
            pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'agendada_para', sincronizar_reuniao.inicio, 'origem', 'calendario'), false);
    return pg_catalog.jsonb_build_object('ok', true, 'alterada', true, 'status', 'movida');
  end if;

  -- apagada no calendário: a sessão é cancelada, o P1 volta e a Edilaine é avisada por tarefa
  update public.sessao_venda s set status = 'cancelada' where s.id = v_s.id;
  perform privado.agenda_cancelar_execucoes(v_s.familia_id, array['lembrete_sessao'], 'evento_apagado');
  v_o := privado.agente_oportunidade_aberta(v_s.familia_id);
  if v_o.id is not null and v_o.estagio_p2 is null and v_o.estagio_p1 = 'sessao_venda_agendada' then
    perform privado.transicionar('p1', v_o.id, 'qualificado', 'agente: evento apagado no calendário');
  end if;
  insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
  values ('responder_consulta_isadora', v_s.familia_id, 'coordenacao', 'alta', 'reuniao_apagada_no_calendario',
          pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'motivo', 'evento_apagado'));
  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
  values (v_s.familia_id, 'sessao', 'Reunião inicial apagada no calendário',
          pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'origem', 'calendario'), false);
  return pg_catalog.jsonb_build_object('ok', true, 'alterada', true, 'status', 'cancelada');
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.sincronizar_reuniao(uuid, timestamptz, timestamptz, text, text) is '[v4.3] Apêndice A e PRD 19.6 nó 21: evento movido (status movida) atualiza o início, o link e refaz o lembrete; evento apagado (status apagada) cancela a sessão, devolve o P1 a qualificado e cria a tarefa responder_consulta_isadora para a coordenação. Nenhuma mensagem à família: o próprio Google avisa quem foi convidado. Só a reunião marcada pela Isadora.';


-- =============================================================================
-- 8. Funções existentes que mudam de comportamento na v4.3 (create or replace,
--    mesma assinatura: os privilégios continuam os mesmos)
-- =============================================================================

-- --- 8.1 agente.registrar_handoff ([v4.3]: sem humano_comercial por transferência) -------
create or replace function agente.registrar_handoff(
  conversa_id   uuid,
  motivo        text,
  resumo        text,
  solicitacao   text,
  dados         jsonb,
  origem        text,
  texto_familia text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c           public.conversa;
  v_motivo      public.handoff_motivo;
  v_motivo_final public.handoff_motivo;
  v_avisos      text[] := '{}';
  v_dados       jsonb := registrar_handoff.dados;
  v_fluxo2      jsonb;
  v_fluxo3      jsonb;
  v_resumo      text := coalesce(nullif(pg_catalog.btrim(privado.mascarar_documentos(registrar_handoff.resumo)), ''), '');
  v_solic       text := nullif(pg_catalog.btrim(privado.mascarar_documentos(registrar_handoff.solicitacao)), '');
  v_texto       text := nullif(pg_catalog.btrim(privado.mascarar_documentos(registrar_handoff.texto_familia)), '');
  v_origem      text := coalesce(nullif(pg_catalog.btrim(registrar_handoff.origem), ''), 'agente');
  v_alerta      boolean;
  v_comercial   boolean;
  v_estado      jsonb;
  v_fam         uuid;
  v_matriz      jsonb;
  v_entrada     jsonb;
  v_em_curso    boolean := false;
  v_contratou   boolean;
  v_destino     public.handoff_destino;
  v_prioridade  public.prioridade;
  v_sla         timestamptz;
  v_janela      numeric;
  v_hash        text;
  v_h           public.handoff;
  v_reuso       boolean := false;
  v_atual       public.estado_sensivel;
  v_alvo        public.estado_sensivel;
  v_freio       text;
  v_o           public.oportunidade;
  v_humano_comercial boolean := false;
  v_encerrado_em timestamptz;   -- [v4.3] sempre nulo: quem grava agente_encerrado_em é a api de desfecho
  v_pausa_horas numeric;
  v_pausa_ate   timestamptz;
  v_nova_pausa  timestamptz;
  v_textos      jsonb;
  v_chave_grupo text;
  v_modelo      text;
  v_aprovado    boolean;
  v_opcoes      text;
  v_nome        text;
  v_resumo_int  text;
  v_link        text;
  v_rodape      text;
  v_prefixo     text;
  v_mensagem    text;
  v_grupo_jid   text;
  v_plantao     jsonb := '[]'::jsonb;
  v_instr_chave text;
  v_instr       text;
  v_legivel     text;
  v_nao_enviada text;
begin
  perform privado.agente_contexto();

  select c.* into v_c from public.conversa c where c.id = registrar_handoff.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;

  -- 0. entrada normalizada. Motivo fora do enum vira outro (19.3 nó 2).
  begin
    v_motivo := coalesce(nullif(pg_catalog.btrim(registrar_handoff.motivo), ''), 'outro')::public.handoff_motivo;
  exception
    when invalid_text_representation then
      v_motivo := 'outro';
      v_avisos := v_avisos || 'motivo_desconhecido'::text;
  end;
  if pg_catalog.jsonb_typeof(v_dados) = 'string' then
    begin
      v_dados := (v_dados #>> '{}')::jsonb;
    exception
      when others then
        v_dados := null;
    end;
  end if;
  if v_dados is null or pg_catalog.jsonb_typeof(v_dados) <> 'object' then
    v_dados := '{}'::jsonb;
  end if;
  v_fluxo2 := case when pg_catalog.jsonb_typeof(v_dados -> '_fluxo2') = 'object' then v_dados -> '_fluxo2' else '{}'::jsonb end;
  v_fluxo3 := case when pg_catalog.jsonb_typeof(v_dados -> '_fluxo3') = 'object' then v_dados -> '_fluxo3' else '{}'::jsonb end;
  v_dados := v_dados - '_fluxo3';

  v_alerta := v_motivo in ('saude', 'perda', 'estado_sensivel_escreveu');
  v_comercial := v_motivo in ('contratar', 'reuniao', 'condicao_comercial', 'cobertura_taxa', 'reembolso_fiscal',
                              'parceiro_medico', 'duvida_sem_resposta', 'outro', 'reuniao_realizada');

  -- 1. humano_comercial (11.7): o texto novo vai para a transferência
  --    aberta, sem novo aviso ao grupo
  if coalesce(privado.agente_booleano(v_fluxo3 -> 'acrescentar_ao_aberto'), false) and not v_alerta then
    select h.* into v_h
    from public.handoff h
    where h.conversa_id = v_c.id and h.status in ('aberto', 'assumido')
    order by h.criado_em desc
    limit 1
    for update;
    if v_h.id is not null then
      update public.handoff h
         set dados = h.dados || pg_catalog.jsonb_build_object(
               'acrescimos', coalesce(h.dados -> 'acrescimos', '[]'::jsonb)
                             || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
                                  'em', pg_catalog.now(), 'texto', coalesce(v_solic, v_texto))))
       where h.id = v_h.id;
    end if;
    -- [v4.3] humano_comercial sem transferência aberta (a equipe já resolveu a anterior): a
    -- mensagem nova abre uma transferência reuniao_realizada, para o Leonardo ver que a
    -- família escreveu, e segue o caminho normal abaixo. Fora do humano_comercial não abre nada.
    if v_h.id is not null or v_c.agente_encerrado_em is null then
      return pg_catalog.jsonb_build_object(
        'ok', true, 'handoff_id', v_h.id, 'duplicado', true, 'acrescentado', v_h.id is not null,
        'atualizacao', false, 'mensagem_grupo', null, 'grupo_jid', null, 'plantao', '[]'::jsonb,
        'instrucao_agente', null, 'instrucao_chave', null, 'pausa_horas', null,
        'humano_comercial', v_c.agente_encerrado_em is not null);
    end if;
    v_motivo := 'reuniao_realizada';
  end if;

  -- 2. família mínima (o freio precisa de onde ficar, 19.3 nó 12)
  v_estado := privado.agente_estado_conversa(v_c.id);
  v_fam := (v_estado ->> 'familia_id')::uuid;
  if v_fam is null
     and (v_alerta or v_motivo = 'audio_nao_transcrito'
          or v_c.classificacao in ('nao_classificado', 'lead', 'cliente')) then
    -- falha aqui nunca impede o registro da transferência (um alerta sem
    -- família ainda chega ao grupo); vira aviso
    begin
      v_fam := privado.agente_garantir_familia(
                 v_c.id,
                 v_comercial and v_motivo <> 'parceiro_medico' and v_c.classificacao in ('nao_classificado', 'lead'),
                 null);
    exception
      when others then
        v_fam := null;
        v_avisos := v_avisos || 'familia_minima_nao_criada'::text;
    end;
    v_estado := privado.agente_estado_conversa(v_c.id);
  end if;

  -- 3. matriz (parametro.handoff_matriz, PRD 11.4)
  v_matriz := privado.agente_parametro('handoff_matriz');
  if pg_catalog.jsonb_typeof(v_matriz) = 'array' then
    select e into v_entrada
    from pg_catalog.jsonb_array_elements(v_matriz) e
    where e ->> 'motivo' = v_motivo::text
    limit 1;
  end if;
  if v_entrada is null then
    if v_motivo in ('saude', 'perda') then
      -- saúde e perda nunca ficam sem registro: máxima, imediato,
      -- coordenação clínica (PRD 11.4, regra de segurança, não ajuste)
      v_entrada := pg_catalog.jsonb_build_object('motivo', v_motivo, 'destino', 'coordenacao_clinica',
                                                 'prioridade', 'maxima', 'sla', 'imediato');
      v_avisos := v_avisos || 'matriz_sem_motivo'::text;
    else
      raise exception 'registrar_handoff: parametro handoff_matriz sem o motivo %', v_motivo using errcode = '22023';
    end if;
  end if;

  -- variantes da 11.4 (midia_recebida, audio_nao_transcrito)
  if v_fam is not null then
    v_em_curso := exists (select 1 from public.acompanhamento a
                          where a.familia_id = v_fam
                            and a.estado in ('ativo', 'em_execucao', 'ultima_visita_realizada', 'pendencias',
                                             'suspenso', 'intercorrencia'));
  end if;
  v_contratou := coalesce((v_estado ->> 'contratou')::boolean, false);
  if v_em_curso and pg_catalog.jsonb_typeof(v_entrada -> 'se_atendimento') = 'object' then
    v_entrada := v_entrada || (v_entrada -> 'se_atendimento');
  elsif v_contratou and pg_catalog.jsonb_typeof(v_entrada -> 'se_cliente') = 'object' then
    v_entrada := v_entrada || (v_entrada -> 'se_cliente');
  elsif not v_contratou and pg_catalog.jsonb_typeof(v_entrada -> 'se_nao_cliente') = 'object' then
    v_entrada := v_entrada || (v_entrada -> 'se_nao_cliente');
  end if;

  v_destino := (v_entrada ->> 'destino')::public.handoff_destino;
  v_prioridade := (v_entrada ->> 'prioridade')::public.prioridade;
  if v_fluxo2 ->> 'prioridade_minima' in ('normal', 'alta', 'maxima') then
    v_prioridade := greatest(v_prioridade, (v_fluxo2 ->> 'prioridade_minima')::public.prioridade);
  end if;
  v_sla := privado.agente_sla(v_entrada, v_prioridade, pg_catalog.now());

  v_instr_chave := case v_motivo
                     when 'reuniao' then 'instrucao_reuniao'
                     when 'contratar' then 'instrucao_contratar'
                     when 'condicao_comercial' then 'instrucao_condicao'
                     when 'bebe_nasceu' then 'instrucao_bebe_nasceu'
                     when 'saude' then 'instrucao_saude'
                     when 'perda' then 'instrucao_saude'
                     else 'instrucao_generica'
                   end;

  -- 4. deduplicação (só comercial) e reaproveitamento (saúde, perda, estado
  --    sensível: nunca deduplicados, sempre reavisados)
  v_janela := privado.agente_parametro_numero('handoff_dedup_minutos');
  v_hash := pg_catalog.md5(coalesce(privado.normalizar_local(v_solic), ''));
  if v_janela > 0 then
    if v_comercial then
      select h.* into v_h
      from public.handoff h
      where h.conversa_id = v_c.id
        and h.motivo = v_motivo
        and h.status in ('aberto', 'assumido')
        and h.dados ->> '_hash_solicitacao' = v_hash
        and h.criado_em >= pg_catalog.now() - pg_catalog.make_interval(secs => (v_janela * 60)::double precision)
      order by h.criado_em desc
      limit 1;
      if v_h.id is not null then
        return pg_catalog.jsonb_build_object(
          'ok', true, 'handoff_id', v_h.id, 'duplicado', true, 'atualizacao', false,
          'mensagem_grupo', null, 'mensagem_grupo_aprovada', null, 'grupo_jid', null, 'plantao', '[]'::jsonb,
          'instrucao_agente', privado.agente_texto(v_instr_chave, true), 'instrucao_chave', v_instr_chave,
          'pausa_horas', null, 'humano_comercial', v_c.agente_encerrado_em is not null,
          'destino', v_h.destino, 'prioridade', v_h.prioridade, 'sla_vence_em', v_h.sla_vence_em,
          'familia_id', v_h.familia_id, 'avisos', pg_catalog.to_jsonb(v_avisos));
      end if;
    elsif v_alerta then
      select h.* into v_h
      from public.handoff h
      where h.conversa_id = v_c.id
        and h.motivo in ('saude', 'perda', 'estado_sensivel_escreveu')
        and h.status in ('aberto', 'assumido')
        and h.atualizado_em >= pg_catalog.now() - pg_catalog.make_interval(secs => (v_janela * 60)::double precision)
      order by h.atualizado_em desc
      limit 1
      for update;
      v_reuso := v_h.id is not null;
    end if;
  end if;

  -- motivo final: no reaproveitamento vale o mais urgente (perda, saúde,
  -- estado sensível), com o destino e a prioridade mais altos
  v_motivo_final := v_motivo;
  if v_reuso then
    v_motivo_final := case
                        when 'perda' in (v_motivo, v_h.motivo) then 'perda'
                        when 'saude' in (v_motivo, v_h.motivo) then 'saude'
                        else v_motivo
                      end;
    v_prioridade := greatest(v_prioridade, v_h.prioridade);
    if v_motivo_final <> v_motivo then
      v_destino := v_h.destino;
    end if;
    v_sla := least(v_sla, v_h.sla_vence_em);
  end if;

  -- 5. freio: o agente só sobe (8.3). Perda para bloqueio_total, saúde para
  --    atencao (19.3 nó 12, K-13).
  if v_fam is not null and v_motivo in ('saude', 'perda') then
    v_alvo := case v_motivo when 'perda' then 'bloqueio_total'::public.estado_sensivel else 'atencao'::public.estado_sensivel end;
    select f.estado_sensivel into v_atual from public.familia f where f.id = privado.familia_vigente(v_fam);
    if v_alvo > v_atual then
      -- falha do freio nunca impede o registro nem o aviso (vira aviso no
      -- retorno e na transferência, para a coordenação acionar à mão)
      begin
        perform privado.acionar_freio(v_fam, v_alvo, 'agente_handoff_' || v_motivo::text);
        v_freio := v_alvo::text;
      exception
        when others then
          v_freio := 'falhou';
          v_avisos := v_avisos || 'freio_nao_acionado'::text;
      end;
      perform privado.agente_contexto();
    end if;
  end if;

  -- 6. pausa com prazo. [v4.3] A transferência comercial já não põe a conversa
  --    em humano_comercial (D-20): só a reunião realizada faz isso, por
  --    api.registrar_desfecho_sessao_venda. Conversa que já está nesse modo
  --    (a família escreveu depois da reunião) não ganha pausa nova: o modo a
  --    segura, e o texto vai para a transferência aberta ou abre uma
  --    reuniao_realizada.
  if v_fam is not null then
    v_o := privado.agente_oportunidade_aberta(v_fam);
  end if;
  if not v_alerta and v_c.agente_encerrado_em is not null then
    v_humano_comercial := true;
  else
    v_pausa_horas := privado.agente_parametro_numero('agente_pausa_handoff_horas');
    if v_pausa_horas > 0 then
      v_nova_pausa := pg_catalog.now() + pg_catalog.make_interval(secs => (v_pausa_horas * 3600)::double precision);
      if v_c.agente_pausado_ate is null or v_nova_pausa > v_c.agente_pausado_ate then
        update public.conversa c
           set agente_pausado_ate = v_nova_pausa,
               agente_pausa_motivo = 'handoff:' || v_motivo_final::text
         where c.id = v_c.id;
        v_pausa_ate := v_nova_pausa;
      end if;
    else
      v_pausa_horas := null;
      v_avisos := v_avisos || 'pausa_sem_parametro'::text;
    end if;
  end if;

  -- 7. texto do grupo (template pelo motivo final; equipe: rascunho sai
  --    marcado, ver cabeçalho)
  v_chave_grupo := case v_motivo_final
                     when 'saude' then 'grupo_saude'
                     when 'perda' then 'grupo_perda'
                     when 'contratar' then 'grupo_contratar'
                     when 'reuniao' then 'grupo_reuniao'
                     when 'condicao_comercial' then 'grupo_condicao'
                     when 'reuniao_realizada' then 'grupo_reuniao_realizada'
                     when 'bebe_nasceu' then 'grupo_bebe_nasceu'
                     when 'estado_sensivel_escreveu' then 'grupo_estado_sensivel'
                     else 'grupo_generico'
                   end;
  v_modelo := privado.agente_texto(v_chave_grupo, true);
  v_aprovado := v_modelo is not null;
  if v_modelo is null then
    v_modelo := privado.agente_texto(v_chave_grupo, false);
  end if;

  -- 8. grava a transferência
  v_textos := case when v_texto is null then '[]'::jsonb
                   else pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('em', pg_catalog.now(), 'texto', v_texto)) end;
  if v_reuso then
    update public.handoff h
       set motivo = v_motivo_final,
           destino = v_destino,
           prioridade = v_prioridade,
           sla_vence_em = v_sla,
           resumo = case when v_resumo <> '' and pg_catalog.strpos(h.resumo, v_resumo) = 0
                         then pg_catalog.concat_ws(E'\n', nullif(h.resumo, ''), v_resumo) else h.resumo end,
           dados = h.dados || (v_dados - '_fluxo2' - 'textos_familia' - '_agente' - '_hash_solicitacao')
                   || pg_catalog.jsonb_build_object(
                        '_fluxo2', v_fluxo2,
                        'textos_familia', coalesce(h.dados -> 'textos_familia', '[]'::jsonb) || v_textos,
                        'atualizacoes', coalesce((h.dados ->> 'atualizacoes')::integer, 0) + 1,
                        '_agente', coalesce(h.dados -> '_agente', '{}'::jsonb)
                                   || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
                                        'origem', v_origem, 'pausa_ate', v_pausa_ate, 'freio', v_freio,
                                        'texto_grupo_aprovado', v_aprovado)))
     where h.id = v_h.id
    returning * into v_h;
  else
    insert into public.handoff (conversa_id, familia_id, motivo, destino, prioridade, resumo, solicitacao, dados, sla_vence_em)
    values (v_c.id, v_fam, v_motivo_final, v_destino, v_prioridade, v_resumo, v_solic,
            (v_dados - 'textos_familia' - '_agente' - '_hash_solicitacao')
            || pg_catalog.jsonb_build_object(
                 '_hash_solicitacao', v_hash,
                 'textos_familia', v_textos,
                 '_agente', pg_catalog.jsonb_build_object(
                              'origem', v_origem, 'pausa_ate', v_pausa_ate, 'encerrado_em', v_encerrado_em,
                              'freio', v_freio, 'texto_grupo_aprovado', v_aprovado)),
            v_sla)
    returning * into v_h;
  end if;

  if v_fam is not null then
    insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
    values (v_fam, 'handoff', v_motivo_final::text,
            pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
              'handoff_id', v_h.id, 'motivo', v_motivo_final, 'destino', v_destino, 'prioridade', v_prioridade,
              'atualizacao', v_reuso, 'humano_comercial', v_humano_comercial, 'freio', v_freio, 'origem', v_origem)),
            v_alerta);
  end if;

  -- 9. mensagem ao grupo (23.3)
  if v_modelo is not null then
    v_opcoes := case pg_catalog.jsonb_typeof(v_dados -> 'opcoes')
                  when 'array' then (select pg_catalog.string_agg(o, ' ou ') from pg_catalog.jsonb_array_elements_text(v_dados -> 'opcoes') o)
                  when 'string' then v_dados ->> 'opcoes'
                end;
    v_opcoes := privado.campo_livre(v_opcoes);
    v_resumo_int := privado.agente_resumo_interno(v_c.id, v_h.resumo, v_h.dados);
    if coalesce(privado.agente_booleano(v_fluxo2 -> 'manter_opcoes'), false)
       and v_opcoes is not null and pg_catalog.strpos(v_modelo, '{opcoes}') = 0 then
      v_resumo_int := v_resumo_int || ' / opções que a família passou: ' || v_opcoes;
    end if;
    v_link := case when v_fam is not null
                   then pg_catalog.replace(coalesce(privado.agente_parametro('link_ficha_modelo') #>> '{}', ''), '{familia_id}', v_fam::text)
                   else '' end;
    v_nao_enviada := privado.agente_texto('grupo_mensagem_nao_enviada', false);
    v_legivel := coalesce(privado.agente_parametro('handoff_motivos_legiveis') ->> v_motivo_final::text,
                          pg_catalog.upper(pg_catalog.replace(v_motivo_final::text, '_', ' ')));
    select coalesce(privado.campo_livre(p.nome), privado.campo_livre(v_c.nome_whatsapp)) into v_nome
    from (select 1) x left join public.pessoa p on p.id = v_c.pessoa_id;

    v_mensagem := privado.aplicar_texto(v_modelo, v_nome, pg_catalog.jsonb_build_object(
      'telefone', coalesce(v_c.telefone_e164, ''),
      'texto_familia', coalesce(v_texto, ''),
      'estagio', coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text, ''),
      'semanas', coalesce((public.ig((select f.dpp from public.familia f where f.id = v_fam), privado.agente_hoje())).texto, ''),
      'mensagem_enviada', coalesce(nullif(pg_catalog.btrim(v_fluxo2 ->> 'mensagem_enviada'), ''), v_nao_enviada, ''),
      'observacao', case when coalesce(v_dados ->> 'perda_temporalidade', v_fluxo2 ->> 'perda_temporalidade') = 'anterior'
                         then coalesce(privado.agente_texto('grupo_observacao_perda_anterior', false), '') else '' end,
      'resumo_interno', v_resumo_int,
      'opcoes', coalesce(v_opcoes, ''),
      'solicitacao', coalesce(v_solic, ''),
      'enfermeira', coalesce(privado.agente_enfermeira(v_fam), ''),
      'motivo_legivel', v_legivel,
      'link_ficha', v_link));

    if v_humano_comercial then
      v_rodape := privado.agente_texto('grupo_rodape_humano_comercial', false);
    elsif v_pausa_horas is not null then
      v_rodape := privado.aplicar_texto(privado.agente_texto('grupo_rodape_pausa', false), null,
                                        pg_catalog.jsonb_build_object('pausa_horas',
                                          pg_catalog.replace(pg_catalog.trim_scale(v_pausa_horas)::text, '.', ',')));
    end if;
    if v_rodape is not null then
      v_mensagem := v_mensagem || ' / ' || v_rodape;
    end if;
    if v_reuso then
      v_prefixo := privado.agente_texto('grupo_prefixo_atualizacao', false);
      v_mensagem := coalesce(v_prefixo, '') || v_mensagem;
    end if;
    v_mensagem := pg_catalog.replace(v_mensagem, ' / ', E'\n');
  end if;

  v_grupo_jid := privado.agente_parametro('grupo_whatsapp_por_destino') ->> v_destino::text;
  if v_prioridade = 'maxima' and pg_catalog.jsonb_typeof(privado.agente_parametro('plantao_telefones')) = 'array' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.regexp_replace(t, '[^0-9]', '', 'g')), '[]'::jsonb) into v_plantao
    from pg_catalog.jsonb_array_elements_text(privado.agente_parametro('plantao_telefones')) t
    where pg_catalog.regexp_replace(t, '[^0-9]', '', 'g') <> '';
  end if;

  v_instr_chave := case v_motivo_final
                     when 'saude' then 'instrucao_saude'
                     when 'perda' then 'instrucao_saude'
                     else v_instr_chave
                   end;
  v_instr := privado.agente_texto(v_instr_chave, true);

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'handoff_id', v_h.id,
    'duplicado', false,
    'atualizacao', v_reuso,
    'mensagem_grupo', v_mensagem,
    'mensagem_grupo_aprovada', v_aprovado,
    'grupo_jid', v_grupo_jid,
    'plantao', v_plantao,
    'instrucao_agente', v_instr,
    'instrucao_chave', v_instr_chave,
    'pausa_horas', case when v_humano_comercial then null else v_pausa_horas end,
    'humano_comercial', v_humano_comercial,
    'motivo', v_motivo_final,
    'destino', v_destino,
    'prioridade', v_prioridade,
    'sla_vence_em', v_sla,
    'familia_id', v_fam,
    'freio', v_freio,
    'avisos', pg_catalog.to_jsonb(v_avisos));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_handoff(uuid, text, text, text, jsonb, text, text) is 'Apêndice A [v4.3] e PRD 19.3 nó 12: matriz de parametro.handoff_matriz (destino, prioridade, SLA em horas úteis; prioridade_minima de dados._fluxo2 só sobe), família mínima, freio (perda bloqueio_total, saúde atencao; só sobe) e pausa com prazo. [v4.3] Já não põe a conversa em humano_comercial: a transferência comercial é exceção (11.4) e a passagem ao Leonardo é a reunião realizada (api.registrar_desfecho_sessao_venda). Conversa já em humano_comercial não ganha pausa nova. Deduplicação só de motivos comerciais; saúde, perda e estado sensível reaproveitam a transferência aberta e sempre reavisam com o prefixo de ATUALIZAÇÃO. Devolve handoff_id, mensagem_grupo, grupo_jid, plantao (só máxima), instrucao_agente e pausa_horas.';
grant execute on function agente.registrar_handoff(uuid, text, text, text, jsonb, text, text) to n8n_agente;

-- --- 8.2 agente.ficha_para_agente ([v4.3]: agenda_estado no lugar dos horários) ----------
create or replace function agente.ficha_para_agente(conversa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_estado   jsonb;
  v_c        public.conversa;
  v_f        public.familia;
  v_o        public.oportunidade;
  v_p        public.pessoa;
  v_planos   jsonb := privado.agente_planos();
  v_hoje     date := privado.agente_hoje();
  v_ni       constant text := 'não informado';
  v_cob      jsonb;
  v_taxa_vis boolean := privado.agente_parametro_ligado('taxa_visivel_agente');
  v_pdf      jsonb := privado.agente_parametro('pdf_apresentacao');
  v_linhas   text[] := '{}';
  v_sessao   text;
  v_handoff  public.handoff;
  v_plano_nome text;
  v_quer     boolean := false;
  v_taxas    jsonb := '[]'::jsonb;
  v_agenda   jsonb;
  v_sit      text;
  v_ofertas  text;
  v_notas    text;
  v_bloco    integer;
  v_valores  text;
  v_semanas  text;
begin
  perform privado.agente_contexto();
  v_estado := privado.agente_estado_conversa(ficha_para_agente.conversa_id);
  if v_estado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  select c.* into v_c from public.conversa c where c.id = ficha_para_agente.conversa_id;
  if (v_estado ->> 'familia_id') is not null then
    select f.* into v_f from public.familia f where f.id = (v_estado ->> 'familia_id')::uuid;
    v_o := privado.agente_oportunidade_aberta(v_f.id);
  end if;
  select p.* into v_p from public.pessoa p where p.id = v_c.pessoa_id;
  select h.* into v_handoff from public.handoff h
  where h.conversa_id = v_c.id and h.status in ('aberto', 'assumido')
  order by h.criado_em desc limit 1;

  if v_f.id is not null and (v_f.cidade_informada is not null or v_f.bairro is not null) then
    v_cob := privado.agente_cobertura(v_f.cidade_informada, v_f.bairro, null);
  end if;
  if v_f.dpp is not null then
    v_semanas := (public.ig(v_f.dpp, v_hoje)).texto;
  end if;
  select pc.nome into v_plano_nome from public.pacote pc where pc.id = v_o.plano_interesse_pacote_id;
  v_quer := v_o.qualificacao ? 'quer_contratar_em';

  -- [v4.3] situação da agenda (PRD 19.4 nó 25): o que a Isadora pode dizer sobre a reunião
  v_agenda := privado.agenda_estado(v_c.id);
  v_sit := case v_agenda ->> 'estado'
             when 'agendada' then case when (v_agenda ->> 'remarcada')::boolean then 'remarcada' else 'agendada' end
             when 'aguardando_email' then 'aguardando e-mail'
             when 'horarios_enviados' then 'horários enviados'
             when 'faltou' then 'faltou'
             else 'sem reunião'
           end;
  v_ofertas := coalesce((select pg_catalog.string_agg((o ->> 'texto') || ' (id_opcao ' || (o ->> 'id_opcao') || ')', ' · ' order by ord)
                         from pg_catalog.jsonb_array_elements(coalesce(v_agenda -> 'opcoes', '[]'::jsonb)) with ordinality as x(o, ord)),
                        'nenhum');
  v_sessao := case when v_agenda ->> 'estado' = 'agendada'
                   then (v_agenda #>> '{reuniao,texto}') || ' · agendada em ' || (v_agenda #>> '{reuniao,agendada_em}')
                        || case when (v_agenda #>> '{reuniao,lembrete_enviado}')::boolean
                                then ' · lembrete enviado em ' || (v_agenda #>> '{reuniao,lembrete_em}') else '' end
                   else 'nenhuma'
              end;
  v_notas := (select pg_catalog.string_agg(n ->> 'texto', '; ' order by i)
              from pg_catalog.jsonb_array_elements(coalesce(v_o.qualificacao -> 'anotacoes_comerciais', '[]'::jsonb))
                     with ordinality as e(n, i));
  v_bloco := privado.agenda_bloco();

  v_linhas := array[
    'Nome: ' || coalesce(privado.campo_livre(v_p.nome), privado.campo_livre(v_c.nome_whatsapp), v_ni),
    'Para quem é o cuidado: ' || coalesce(case v_o.para_quem when 'propria' then 'ela mesma'
                                                             when 'presente' then 'presente para outra pessoa'
                                                             when 'outro' then 'outra pessoa' end, v_ni),
    'Semanas hoje: ' || case when v_f.data_nascimento is not null then 'bebê já nasceu'
                             when v_semanas is not null then v_semanas || ' · DPP ' || privado.formatar_data(v_f.dpp)
                                                              || ' (estimativa informada pela família)'
                             else v_ni end,
    'Bebê já nasceu: ' || case when v_f.data_nascimento is not null then 'sim' else 'não' end,
    'Cidade e bairro: ' || coalesce(nullif(pg_catalog.concat_ws(', ', privado.campo_livre(v_f.cidade_informada),
                                                                 privado.campo_livre(v_f.bairro)), ''), v_ni)
      || ' · cobertura: ' || coalesce(v_cob ->> 'status', v_ni)
      || case when v_cob is null then ''
              when coalesce((v_cob ->> 'tem_taxa')::boolean, false)
                then ', com taxa' || case when v_taxa_vis then ' de ' || privado.formatar_reais((v_cob ->> 'taxa_centavos')::bigint) else '' end
              else ', sem taxa' end,
    'Primeiro bebê: ' || case v_f.primeira_gestacao when true then 'sim' when false then 'não' else v_ni end
      || ' · Gemelar: ' || case when v_f.id is null then v_ni when v_f.gemelar then 'sim' else 'não' end,
    'Rede de apoio: ' || coalesce(privado.campo_livre(v_o.qualificacao ->> 'rede_apoio'), v_ni),
    'Principal preocupação: ' || coalesce(privado.campo_livre(v_o.qualificacao ->> 'principal_preocupacao'), v_ni),
    'Histórico sensível informado: ' || case when coalesce(v_f.historico_sensivel, false) then 'sim' else 'não' end,
    'Etapa: ' || coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text, 'novo')
      || ' · apresentação: ' || case when v_o.pdf_enviado_em is not null
                                      then 'enviada em ' || pg_catalog.to_char(v_o.pdf_enviado_em at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
                                      else 'ainda não enviada' end,
    'Plano de interesse: ' || coalesce(v_plano_nome, v_ni)
      || ' · pagamento preferido: ' || coalesce(privado.campo_livre(v_o.pagamento_preferido), v_ni),
    'Anotações para o Leonardo: ' || coalesce(v_notas, 'nenhuma'),
    'Retorno combinado: ' || coalesce(privado.formatar_data(v_o.proximo_contato_em), 'nenhum'),
    'Transferência aberta: ' || case when v_handoff.id is not null then 'sim (' || v_handoff.motivo::text || ')' else 'não' end,
    -- [v4.3] as quatro linhas da agenda (formato do prompt, PRD 19.4 nó 25)
    'Reunião inicial: online, com a Edilaine' || coalesce(', ' || v_bloco::text || ' minutos', '') || ', sem compromisso',
    'Situação da reunião: ' || v_sit,
    'Horários oferecidos hoje: ' || v_ofertas,
    'Reunião marcada: ' || v_sessao
  ];

  if v_taxa_vis then
    select coalesce(pg_catalog.jsonb_agg(distinct t.taxa), '[]'::jsonb) into v_taxas
    from (select coalesce(nullif(c.taxa_deslocamento_centavos, 0), r.taxa_deslocamento_centavos) as taxa
          from public.cidade c left join public.regiao r on r.id = c.regiao_id
          where c.atendida) t
    where t.taxa > 0;
  end if;

  select pg_catalog.string_agg(x.p ->> 'nome' || ': ' || (x.p ->> 'valor') || ' ou ' || (x.p ->> 'parcela_texto'), E'\n'
                               order by x.i)
    into v_valores
  from pg_catalog.jsonb_array_elements(v_planos) with ordinality as x(p, i);
  if v_taxa_vis and pg_catalog.jsonb_array_length(v_taxas) > 0 then
    select v_valores || E'\n' || pg_catalog.string_agg('Taxa de deslocamento: ' || privado.formatar_reais(t::bigint), E'\n')
      into v_valores
    from pg_catalog.jsonb_array_elements_text(v_taxas) t;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'ficha', pg_catalog.array_to_string(v_linhas, E'\n'),
    'modo', v_estado ->> 'modo',
    'data_hora', privado.formatar_data_hora(pg_catalog.now()),
    'semanas', v_semanas,
    'historico_sensivel', coalesce(v_f.historico_sensivel, false),
    'cobertura', v_cob ->> 'status',
    'estagio', coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text),
    'planos', (select pg_catalog.string_agg(
                        (p ->> 'nome') || ' · ' || coalesce(p ->> 'linha', '') || ' · ' || (p ->> 'dias') || ' dias · '
                        || pg_catalog.replace(p ->> 'horas_por_visita', '.', ',') || ' h por visita · '
                        || pg_catalog.replace(p ->> 'horas_totais', '.', ',') || ' h no total · '
                        || (p ->> 'valor') || ' · ' || (p ->> 'parcela_texto')
                        || coalesce(' · ' || (p ->> 'destaque'), '')
                        || coalesce(' · página ' || (p ->> 'pagina'), ''),
                        E'\n' order by x.i)
               from pg_catalog.jsonb_array_elements(v_planos) with ordinality as x(p, i)),
    'valores_permitidos', v_valores,
    'pdf_status', case when v_o.pdf_enviado_em is not null
                       then 'enviado em ' || pg_catalog.to_char(v_o.pdf_enviado_em at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
                       else 'ainda não enviado' end,
    'agenda_estado', v_agenda ->> 'estado',
    'agenda_opcoes', v_agenda -> 'opcoes',
    'agenda_reuniao', v_agenda -> 'reuniao',
    'agenda_remarcada', coalesce((v_agenda ->> 'remarcada')::boolean, false),
    'valor', (select coalesce(pg_catalog.jsonb_object_agg(p ->> 'chave', p ->> 'valor'), '{}'::jsonb)
              from pg_catalog.jsonb_array_elements(v_planos) p)
             || pg_catalog.jsonb_build_object('minimo',
                  (select privado.formatar_reais(min((p ->> 'valor_centavos')::bigint))
                   from pg_catalog.jsonb_array_elements(v_planos) p where not (p ->> 'gemelar')::boolean)),
    'parcela', (select coalesce(pg_catalog.jsonb_object_agg(p ->> 'chave', p ->> 'parcela_texto'), '{}'::jsonb)
                from pg_catalog.jsonb_array_elements(v_planos) p),
    'pagina', pg_catalog.jsonb_build_object(
                'filho_unico', (select min((p ->> 'pagina')::integer) from pg_catalog.jsonb_array_elements(v_planos) p
                                where not (p ->> 'gemelar')::boolean),
                'gemelar', (select min((p ->> 'pagina')::integer) from pg_catalog.jsonb_array_elements(v_planos) p
                            where (p ->> 'gemelar')::boolean)),
    'validador', pg_catalog.jsonb_build_object(
                   'planos', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'nome', p ->> 'nome', 'apelidos', '[]'::jsonb,
                                       'valor_centavos', (p ->> 'valor_centavos')::bigint,
                                       'parcelas', (p ->> 'parcelas')::integer,
                                       'parcela_centavos', (p ->> 'valor_parcela_centavos')::bigint)), '[]'::jsonb)
                              from pg_catalog.jsonb_array_elements(v_planos) p),
                   'taxas_centavos', v_taxas,
                   'valor_minimo_centavos', (select min((p ->> 'valor_centavos')::bigint)
                                             from pg_catalog.jsonb_array_elements(v_planos) p
                                             where not (p ->> 'gemelar')::boolean),
                   'listas', privado.agente_parametro('validador_listas'),
                   'motivo_em_curso', v_handoff.motivo,
                   'quer_contratar', v_quer),
    'pdf', pg_catalog.jsonb_build_object(
             'url', coalesce(v_pdf ->> 'url', v_pdf ->> 'path'),
             'nome_arquivo', v_pdf ->> 'nome',
             'reenvio_janela_horas', coalesce(privado.agente_parametro_numero('pdf_reenvio_janela_horas'), 0),
             'enviado_em', v_o.pdf_enviado_em));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.ficha_para_agente(uuid) is 'Apêndice A [v4.3]: ficha comercial em texto no formato do prompt (campos livres até 200 caracteres, sem colchetes nem quebras; historico_sensivel só sim ou não), modo, data e hora de Brasília, planos em texto, valores permitidos, situação da apresentação, [v4.3] situação da agenda (agenda_estado: sem_reuniao, horarios_enviados, aguardando_email, agendada ou faltou; opções vigentes do dia com id e texto; reunião agendada com dia, data e hora, nunca o id do evento), valor.*, parcela.*, pagina.*, contexto do validador (planos, taxas só com taxa_visivel_agente, listas, motivo em curso, quer_contratar) e pdf. Nada assistencial.';
grant execute on function agente.ficha_para_agente(uuid) to n8n_agente;

-- --- 8.3 agente.registrar_marco ([v4.3]: anotacao_comercial) ------------------------------
create or replace function agente.registrar_marco(conversa_id uuid, marco text, valor text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c       public.conversa;
  v_fam     uuid;
  v_f       public.familia;
  v_o       public.oportunidade;
  v_data    date;
  v_semanas integer;
  v_aviso   text;
  v_hoje    date := privado.agente_hoje();
  v_canceladas integer := 0;
  v_texto   text;
begin
  perform privado.agente_contexto();
  if registrar_marco.marco is null
     or registrar_marco.marco not in ('pdf_enviado', 'sessao_interesse', 'quer_contratar', 'proximo_contato',
                                      'nao_contatar', 'sem_interesse', 'nutricao', 'anotacao_comercial') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'marco_desconhecido');
  end if;

  select c.* into v_c from public.conversa c where c.id = registrar_marco.conversa_id;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if v_c.classificacao not in ('nao_classificado', 'lead', 'cliente') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_e_lead');
  end if;

  v_fam := privado.agente_garantir_familia(v_c.id, true, null);
  select f.* into v_f from public.familia f where f.id = v_fam;
  v_o := privado.agente_oportunidade_aberta(v_fam);

  case registrar_marco.marco
    when 'pdf_enviado' then
      update public.oportunidade o set pdf_enviado_em = pg_catalog.now() where o.id = v_o.id;

    when 'sessao_interesse' then
      update public.oportunidade o set sessao_interesse_em = coalesce(o.sessao_interesse_em, pg_catalog.now())
       where o.id = v_o.id;

    when 'quer_contratar' then
      update public.oportunidade o
         set qualificacao = o.qualificacao || pg_catalog.jsonb_build_object('quer_contratar_em', pg_catalog.now())
       where o.id = v_o.id and not (o.qualificacao ? 'quer_contratar_em');

    when 'proximo_contato' then
      v_data := privado.agente_data(registrar_marco.valor);
      if v_data is null then
        v_semanas := nullif(pg_catalog.substring(coalesce(registrar_marco.valor, ''), '([0-9]+)'), '')::integer;
        if v_semanas is null then
          return pg_catalog.jsonb_build_object('ok', false, 'erro', 'valor_invalido');
        end if;
        if v_f.dpp is null then
          return pg_catalog.jsonb_build_object('ok', false, 'erro', 'dpp_necessaria');
        end if;
        -- data em que a gestação chega às semanas pedidas (ig, PRD 6.10 regra 7)
        v_data := v_f.dpp - 280 + v_semanas * 7;
      end if;
      if v_data <= v_hoje then
        return pg_catalog.jsonb_build_object('ok', false, 'erro', 'data_no_passado');
      end if;
      update public.oportunidade o set proximo_contato_em = v_data where o.id = v_o.id;

    when 'nao_contatar' then
      update public.familia f
         set nao_contatar = true,
             nao_contatar_em = coalesce(f.nao_contatar_em, pg_catalog.now()),
             nao_contatar_motivo = coalesce(privado.campo_livre(registrar_marco.valor), f.nao_contatar_motivo)
       where f.id = v_fam;
      update public.automacao_execucao e
         set status = 'cancelada', motivo_aborto = 'nao_contatar'
        from public.automacao a
       where a.id = e.automacao_id and e.familia_id = v_fam and e.status = 'agendada'
         and a.categoria in ('conteudo', 'marketing');
      get diagnostics v_canceladas = row_count;

    when 'sem_interesse' then
      if v_o.pipeline = 1 and v_o.estagio_p2 is null and v_o.estagio_p1 <> 'perdido' then
        v_aviso := privado.agente_transicionar(v_o.id, 'perdido', 'agente: sem_interesse');
        if v_aviso is null then
          update public.oportunidade o set motivo_perda = 'sem_interesse', proximo_contato_em = null where o.id = v_o.id;
        end if;
      end if;
      update public.automacao_execucao e
         set status = 'cancelada', motivo_aborto = 'sem_interesse'
       where e.familia_id = v_fam and e.status = 'agendada'
         and e.automacao_id in ('followup_d1', 'followup_d3_d14', 'retorno_combinado', 'regua_nutricao');
      get diagnostics v_canceladas = row_count;

    when 'anotacao_comercial' then
      -- [v4.3] pedido de desconto, parcelamento, condição, indicação ou dúvida de
      -- contrato antes da reunião: não transfere, anota para o resumo do Leonardo
      v_texto := privado.campo_livre(privado.mascarar_documentos(registrar_marco.valor));
      if v_texto is null then
        return pg_catalog.jsonb_build_object('ok', false, 'erro', 'valor_invalido');
      end if;
      update public.oportunidade o
         set qualificacao = o.qualificacao || pg_catalog.jsonb_build_object(
               'anotacoes_comerciais',
               (select coalesce(pg_catalog.jsonb_agg(x.a order by x.i), '[]'::jsonb)
                from (select a, i from pg_catalog.jsonb_array_elements(
                              coalesce(o.qualificacao -> 'anotacoes_comerciais', '[]'::jsonb)
                              || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('em', pg_catalog.now(), 'texto', v_texto)))
                              with ordinality as e(a, i)
                      order by i desc limit 10) x))
       where o.id = v_o.id;

    when 'nutricao' then
      if v_o.pipeline = 1 and v_o.estagio_p2 is null and v_o.estagio_p1 <> 'nutricao' then
        v_aviso := privado.agente_transicionar(v_o.id, 'nutricao', 'agente: nutricao');
      end if;
  end case;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
  values (v_fam, case when registrar_marco.marco = 'pdf_enviado' then 'pdf_enviado' else 'marco' end,
          registrar_marco.marco,
          pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
            'marco', registrar_marco.marco, 'origem', 'agente', 'conversa_id', v_c.id,
            'data', v_data, 'aviso', v_aviso)),
          false);

  v_o := privado.agente_oportunidade_aberta(v_fam);
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'marco', registrar_marco.marco,
    'familia_id', v_fam,
    'estagio', coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text),
    'data', v_data,
    'execucoes_canceladas', v_canceladas,
    'aviso', v_aviso);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_marco(uuid, text, text) is 'Apêndice A [v4.3]: pdf_enviado, sessao_interesse, quer_contratar (qualificacao.quer_contratar_em), proximo_contato (data ou semanas-alvo pela DPP), nao_contatar (cancela conteúdo e marketing agendados), sem_interesse (P1 para perdido com motivo sem_interesse, cancela follow-ups e retorno), nutricao e, [v4.3], anotacao_comercial (texto curto, mascarado, até 200 caracteres, guardado em qualificacao.anotacoes_comerciais, as 10 últimas, para o resumo do Leonardo). Grava evento na linha do tempo.';
grant execute on function agente.registrar_marco(uuid, text, text) to n8n_agente;

-- --- 8.4 privado.agente_resumo_interno ([v4.3]: reunião, lembrete, anotações, resultado) ---
create or replace function privado.agente_resumo_interno(conversa_id uuid, resumo text, dados jsonb) returns text
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c     public.conversa;
  v_f     public.familia;
  v_o     public.oportunidade;
  v_p     public.pessoa;
  v_cob   jsonb;
  v_plano text;
  v_ni    constant text := 'não informado';
  v_obj   text;
  v_s     public.sessao_venda;
  v_notas text;
begin
  select c.* into v_c from public.conversa c where c.id = agente_resumo_interno.conversa_id;
  if v_c.familia_id is not null then
    select f.* into v_f from public.familia f where f.id = privado.familia_vigente(v_c.familia_id);
    v_o := privado.agente_oportunidade_aberta(v_f.id);
    if v_f.cidade_informada is not null or v_f.bairro is not null then
      v_cob := privado.agente_cobertura(v_f.cidade_informada, v_f.bairro, null);
    end if;
  end if;
  select p.* into v_p from public.pessoa p where p.id = v_c.pessoa_id;
  -- [v4.3] a reunião mais recente (agendada, ou o último desfecho) e as anotações comerciais
  if v_f.id is not null then
    select s.* into v_s from public.sessao_venda s
     where s.familia_id = v_f.id and s.status <> 'remarcada'
     order by (s.status = 'agendada') desc, s.criado_em desc limit 1;
  end if;
  select pg_catalog.string_agg(n ->> 'texto', '; ' order by i)
    into v_notas
  from pg_catalog.jsonb_array_elements(coalesce(v_o.qualificacao -> 'anotacoes_comerciais', '[]'::jsonb))
         with ordinality as e(n, i);
  select pc.nome into v_plano from public.pacote pc where pc.id = v_o.plano_interesse_pacote_id;
  v_obj := case pg_catalog.jsonb_typeof(agente_resumo_interno.dados -> 'objecoes')
             when 'array' then (select pg_catalog.string_agg(o, ', ') from pg_catalog.jsonb_array_elements_text(agente_resumo_interno.dados -> 'objecoes') o)
             when 'string' then agente_resumo_interno.dados ->> 'objecoes'
           end;

  return pg_catalog.concat_ws(' / ',
    pg_catalog.concat_ws(' · ',
      coalesce(privado.campo_livre(v_p.nome), privado.campo_livre(v_c.nome_whatsapp), v_ni),
      'para ' || coalesce(v_o.para_quem, v_ni),
      coalesce((public.ig(v_f.dpp, privado.agente_hoje())).texto, v_ni),
      'DPP ' || coalesce(privado.formatar_data(v_f.dpp), v_ni)),
    pg_catalog.concat_ws(' · ',
      coalesce(nullif(pg_catalog.concat_ws(', ', privado.campo_livre(v_f.cidade_informada), privado.campo_livre(v_f.bairro)), ''), v_ni),
      'área ' || coalesce(v_cob ->> 'status', v_ni)),
    pg_catalog.concat_ws(' · ',
      'primeiro bebê: ' || case v_f.primeira_gestacao when true then 'sim' when false then 'não' else v_ni end,
      'gemelar: ' || case when v_f.id is null then v_ni when v_f.gemelar then 'sim' else 'não' end,
      'rede de apoio: ' || coalesce(privado.campo_livre(v_o.qualificacao ->> 'rede_apoio'), v_ni)),
    'principal preocupação: ' || coalesce(privado.campo_livre(v_o.qualificacao ->> 'principal_preocupacao'), v_ni),
    pg_catalog.concat_ws(' · ',
      'PDF: ' || coalesce(pg_catalog.to_char(v_o.pdf_enviado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'não enviado'),
      'reunião com a Edilaine: ' || case
        when v_s.id is null then case when v_o.sessao_interesse_em is not null then 'interesse registrado' else 'não' end
        when v_s.status = 'agendada' then 'agendada para ' || privado.agenda_texto(v_s.agendada_para)
             || ' (marcada em ' || pg_catalog.to_char(v_s.criado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
             || ', por ' || case v_s.agendada_por when 'isadora' then 'a Isadora' else 'a equipe' end || ')'
        else v_s.status::text end,
      'lembrete: ' || case when v_s.lembrete_enviado_em is not null
                           then 'enviado em ' || pg_catalog.to_char(v_s.lembrete_enviado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
                           else 'não enviado' end),
    pg_catalog.concat_ws(' · ',
      'plano: ' || coalesce(v_plano, v_ni),
      'pagamento: ' || coalesce(privado.campo_livre(v_o.pagamento_preferido), v_ni)),
    pg_catalog.concat_ws(' · ',
      'objeções: ' || coalesce(privado.campo_livre(v_obj), v_ni),
      'pedidos de condição ou dúvidas de contrato anotados: ' || coalesce(privado.campo_livre(v_notas), 'nenhum'),
      'origem: ' || coalesce(v_f.origem::text, v_ni)),
    case when v_s.resultado is not null then 'resultado da reunião (Edilaine): ' || v_s.resultado end,
    'próximo passo: ' || coalesce(privado.campo_livre(agente_resumo_interno.resumo), v_ni));
end;
$$;
comment on function privado.agente_resumo_interno(uuid, text, jsonb) is 'Resumo interno padrão do aviso ao grupo (PRD 23.3), montado pelo banco só com dado comercial; " / " vira quebra de linha. Sem grant.';
comment on function privado.agente_resumo_interno(uuid, text, jsonb) is 'Resumo interno padrão do aviso ao grupo e do handoff (PRD 23.3), montado pelo banco só com dado comercial; " / " vira quebra de linha. [v4.3] Traz a reunião com a Edilaine (agendada para, marcada em, por quem), o lembrete, os pedidos de condição ou dúvidas de contrato anotados pela Isadora e o resultado registrado pela Edilaine. Nunca vai à família. Sem grant.';

-- --- 8.5 privado.materializar_lembrete_sessao (só sessão marcada pela equipe) ---------------
create or replace function privado.materializar_lembrete_sessao() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_n integer;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'lembrete_sessao'), false) then
    return 0;
  end if;

  insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, payload, status)
  select 'lembrete_sessao', s.familia_id, pg_catalog.clock_timestamp(),
         pg_catalog.jsonb_build_object('sessao_venda_id', s.id, 'agendada_para', s.agendada_para),
         'agendada'
  from public.sessao_venda s
  join public.familia f on f.id = s.familia_id
  where s.status = 'agendada'
    and s.agendada_por = 'humano'
    and s.agendada_para is not null
    and (s.agendada_para at time zone 'America/Sao_Paulo')::date
        = ((pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date + 1)
    and f.mesclada_em_id is null
    and not exists (
      select 1 from public.automacao_execucao e
      where e.automacao_id = 'lembrete_sessao'
        and e.status in ('agendada', 'executada')
        and e.payload ->> 'sessao_venda_id' = s.id::text
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.materializar_lembrete_sessao() is 'Materializa lembrete_sessao (PRD 10.1, 23.2) na véspera de sessao_venda.agendada_para (fuso America/Sao_Paulo). Dedup por sessao_venda.id. Sem grant.';
comment on function privado.materializar_lembrete_sessao() is 'Materializa lembrete_sessao (PRD 10.1, 23.2) na véspera de sessao_venda.agendada_para (fuso America/Sao_Paulo) só para sessão marcada pela equipe (agendada_por humano). [v4.3] A da Isadora nasce com a execução própria em agente.registrar_reuniao e é enviada por ela (proativos_agenda_devidos). Dedup por sessao_venda.id. Sem grant.';

-- --- 8.6 privado.materializar_sessao_sem_agenda (contingência da v4.3) ---------------------
create or replace function privado.materializar_sessao_sem_agenda() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_horas integer;
  v_n     integer;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'sessao_sem_agenda'), false) then
    return 0;
  end if;

  select (p.valor #>> '{}')::integer into v_horas from public.parametro p where p.chave = 'sessao_sem_agenda_horas';
  if v_horas is null then
    return 0;
  end if;

  insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, payload, status)
  select 'sessao_sem_agenda', o.familia_id, pg_catalog.clock_timestamp(),
         pg_catalog.jsonb_build_object('oportunidade_id', o.id, 'sessao_interesse_em', o.sessao_interesse_em),
         'agendada'
  from public.oportunidade o
  join public.familia f on f.id = o.familia_id
  where o.sessao_interesse_em is not null
    and o.sessao_interesse_em <= pg_catalog.clock_timestamp() - pg_catalog.make_interval(hours => v_horas)
    and f.mesclada_em_id is null
    and not exists (select 1 from public.handoff h where h.familia_id = o.familia_id and h.status = 'aberto')
    -- [v4.3] contingência: só quando a Isadora não conseguiu agendar nem tem horário do dia à espera
    and not exists (select 1 from public.sessao_venda s where s.familia_id = o.familia_id and s.status in ('agendada', 'realizada'))
    and not exists (select 1 from public.sessao_venda_opcao op
                    join public.conversa cv on cv.id = op.conversa_id
                    where cv.familia_id = o.familia_id and op.valida_ate > pg_catalog.now()
                      and op.escolhida_em is null and op.descartada_em is null)
    and not exists (
      select 1 from public.automacao_execucao e
      where e.automacao_id = 'sessao_sem_agenda'
        and e.status in ('agendada', 'executada')
        and (e.payload ->> 'sessao_interesse_em')::timestamptz = o.sessao_interesse_em
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.materializar_sessao_sem_agenda() is 'Materializa sessao_sem_agenda (PRD 10.1) quando parametro.sessao_sem_agenda_horas passa desde oportunidade.sessao_interesse_em sem handoff aberto (parâmetro ausente: não materializa). Dedup pelo instante de sessao_interesse_em. Sem grant.';
comment on function privado.materializar_sessao_sem_agenda() is 'Materializa sessao_sem_agenda (PRD 10.1) quando parametro.sessao_sem_agenda_horas passa desde oportunidade.sessao_interesse_em sem handoff aberto (parâmetro ausente: não materializa). [v4.3] Contingência: não materializa com reunião agendada ou realizada nem com opção de horário vigente do dia. Dedup pelo instante de sessao_interesse_em. Sem grant.';

-- --- 8.7 privado.processar_automacoes (com as duas materializações da agenda) -------------
create or replace function privado.processar_automacoes() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_materializadas integer := 0;
  v_processadas    integer := 0;
  v_executadas     integer := 0;
  v_abortadas      integer := 0;
  v_externas       integer := 0;
  v_rec  record;
  v_acao jsonb;
begin
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'cron', true);
  end if;

  v_materializadas := v_materializadas
    + privado.materializar_retorno_combinado()
    + privado.materializar_lembrete_sessao()
    + privado.materializar_pagamento_atrasado()
    + privado.materializar_sessao_sem_agenda()
    + privado.agendar_followup_d1()
    + privado.materializar_desfecho_sessao_pendente()
    + privado.materializar_consultas_expiradas();

  for v_rec in
    select e.id, e.automacao_id, e.familia_id
    from public.automacao_execucao e
    join public.automacao a on a.id = e.automacao_id
    where e.status = 'agendada'
      and e.agendada_para <= pg_catalog.clock_timestamp()
      and a.executor <> 'agente'
    order by e.agendada_para
    for update of e skip locked
  loop
    v_processadas := v_processadas + 1;

    if not privado.pode_executar(v_rec.familia_id, v_rec.automacao_id, v_rec.id) then
      v_abortadas := v_abortadas + 1;
      continue;
    end if;

    for v_acao in
      select value
      from pg_catalog.jsonb_array_elements(
        coalesce((select a.acoes from public.automacao a where a.id = v_rec.automacao_id), '[]'::jsonb)
      )
    loop
      if privado.aplicar_acao_automacao(v_rec.id, v_rec.automacao_id, v_rec.familia_id, v_acao) then
        v_externas := v_externas + 1;
      end if;
    end loop;

    update public.automacao_execucao
       set status = 'executada', executada_em = pg_catalog.clock_timestamp()
     where id = v_rec.id;
    v_executadas := v_executadas + 1;
  end loop;

  return pg_catalog.jsonb_build_object(
    'materializadas', v_materializadas,
    'processadas', v_processadas,
    'executadas', v_executadas,
    'abortadas_freio', v_abortadas,
    'externas', v_externas
  );
end;
$$;
comment on function privado.processar_automacoes() is 'Motor de automações (PRD 10, invariante 3), pg_cron a cada 5 minutos: materializa execuções devidas por tempo, evento e data, chama privado.pode_executar para cada uma (reconsulta o freio no instante do envio), aplica as ações de banco e manda as externas por net.http_post (privado.chamar_rota_automacao). Executor agente (followup_d1) fica agendada para o n8n consumir. Sem grant: só o cron (postgres) chama.';
comment on function privado.processar_automacoes() is 'Motor de automações (PRD 10, invariante 3), pg_cron a cada 5 minutos: materializa execuções devidas por tempo, evento e data ([v4.3] inclui a cadência de 1, 3 e 14 dias, o desfecho da reunião pendente e as consultas de horário vencidas), chama privado.pode_executar para cada uma (reconsulta o freio no instante do envio), aplica as ações de banco e manda as externas por net.http_post (privado.chamar_rota_automacao). Executor agente (followups, lembrete_sessao da Isadora, reuniao_falta_remarcar) fica agendada para o n8n consumir. Sem grant: só o cron (postgres) chama.';


-- =============================================================================
-- 9. Cadência de follow-up antes da reunião: 1, 3 e 14 dias (D-21, PRD 10.1,
--    11.3, 19.4 nós 36 a 41)
--
-- Os três retornos são da Isadora, contados da última mensagem da família
-- (da abertura, se ela nunca respondeu). O ID followup_d1 fica para o
-- primeiro retorno e followup_d3_d14 para o segundo e o terceiro, os dois
-- com executor agente. Cada etapa tem motivo novo e texto próprio:
--   1  a apresentação (followup_d1_pos_pdf ou followup_d1_pos_abertura)
--   2  a reunião de 30 minutos (followup_d3) ou, para quem nunca respondeu à
--      abertura, sem_resposta_abertura_2
--   3  respeitar o tempo e combinar o retorno (followup_d14)
-- Quem nunca respondeu à abertura recebe no máximo 2 contatos. Nunca com
-- reunião agendada ou realizada, em humano_comercial ou com transferência
-- aberta. A chave antiga agente_followup_horas continua valendo como reserva:
-- sem agente_cadencia_dias, é o primeiro retorno (e o único).
-- =============================================================================

-- Dias de cada retorno: agente_cadencia_dias, ou a chave antiga como reserva.
-- O primeiro nunca é menor que um dia (24 horas, D-18 e D-21).
create function privado.agente_cadencia() returns numeric[]
  language plpgsql
  stable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_cad  jsonb := privado.agente_parametro('agente_cadencia_dias');
  v_dias numeric[];
  v_horas numeric;
begin
  if pg_catalog.jsonb_typeof(v_cad) = 'array'
     and pg_catalog.jsonb_array_length(v_cad) between 1 and 3
     and not exists (select 1 from pg_catalog.jsonb_array_elements(v_cad) e where pg_catalog.jsonb_typeof(e) <> 'number') then
    select pg_catalog.array_agg((e #>> '{}')::numeric order by i) into v_dias
    from pg_catalog.jsonb_array_elements(v_cad) with ordinality as x(e, i);
  else
    v_horas := privado.agente_parametro_numero('agente_followup_horas');
    if v_horas > 0 then
      v_dias := array[v_horas / 24.0];
    end if;
  end if;
  if v_dias is null then
    return '{}'::numeric[];
  end if;
  if v_dias[1] < 1 then
    v_dias[1] := 1;
  end if;
  return v_dias;
end;
$$;
comment on function privado.agente_cadencia() is '[v4.3] Dias sem resposta da família até cada retorno da Isadora antes da reunião (parametro.agente_cadencia_dias, 1 a 3 valores; reserva: agente_followup_horas como único retorno). O primeiro nunca é menor que 1 dia. Vazio se nenhum dos dois existe. Sem grant.';

-- --- 9.1 O motor agenda as etapas (privado.agendar_followup_d1 mantém o nome) ------------------
create or replace function privado.agendar_followup_d1() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_cad   numeric[] := privado.agente_cadencia();
  v_etapa integer;
  v_auto  text;
  v_n     integer := 0;
  v_i     integer;
begin
  if pg_catalog.cardinality(v_cad) = 0 then
    return 0;
  end if;

  -- família respondeu de novo depois do agendamento: a execução velha (baseada
  -- na resposta anterior) deixa de valer e a cadência recomeça
  update public.automacao_execucao e
     set status = 'cancelada'
    from public.conversa c
   where e.automacao_id in ('followup_d1', 'followup_d3_d14')
     and e.status = 'agendada'
     and c.id = (e.payload ->> 'conversa_id')::uuid
     and c.ultima_entrada_em > (e.payload ->> 'ultima_entrada_em')::timestamptz;

  for v_etapa in 1 .. pg_catalog.cardinality(v_cad) loop
    v_auto := case when v_etapa = 1 then 'followup_d1' else 'followup_d3_d14' end;
    if not coalesce((select a.ativa from public.automacao a where a.id = v_auto), false) then
      continue;
    end if;

    insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, payload, status)
    select v_auto, c.familia_id, pg_catalog.clock_timestamp(),
           pg_catalog.jsonb_build_object('conversa_id', c.id, 'ultima_entrada_em', c.ultima_entrada_em, 'etapa', v_etapa),
           'agendada'
    from public.conversa c
    join public.familia f on f.id = c.familia_id
    where c.familia_id is not null
      and c.classificacao = 'lead'
      and c.agente_encerrado_em is null
      and c.ultima_entrada_em is not null
      and c.ultima_entrada_em <= pg_catalog.clock_timestamp() - pg_catalog.make_interval(secs => (v_cad[v_etapa] * 86400)::double precision)
      and f.mesclada_em_id is null
      and not exists (select 1 from public.handoff h where h.conversa_id = c.id and h.status in ('aberto', 'assumido'))
      -- reunião marcada ou feita: a cadência antes da reunião acabou
      and not exists (select 1 from public.sessao_venda s
                      where s.familia_id = privado.familia_vigente(c.familia_id) and s.status in ('agendada', 'realizada'))
      -- só a etapa seguinte à última enviada neste silêncio
      and (select pg_catalog.count(*) from public.automacao_execucao e
           where e.automacao_id in ('followup_d1', 'followup_d3_d14') and e.status = 'executada'
             and e.payload ->> 'conversa_id' = c.id::text
             and (e.payload ->> 'ultima_entrada_em')::timestamptz = c.ultima_entrada_em) = v_etapa - 1
      -- quem nunca respondeu à abertura recebe no máximo dois contatos
      and (v_etapa <= 2 or (select pg_catalog.count(*) from public.mensagem m
                            where m.conversa_id = c.id and m.direcao = 'entrada') > 1)
      and not exists (
        select 1 from public.automacao_execucao e
        where e.automacao_id in ('followup_d1', 'followup_d3_d14')
          and e.payload ->> 'conversa_id' = c.id::text
          and (e.payload ->> 'ultima_entrada_em')::timestamptz >= c.ultima_entrada_em
          and coalesce((e.payload ->> 'etapa')::integer, 1) = v_etapa
      );
    get diagnostics v_i = row_count;
    v_n := v_n + v_i;
  end loop;
  return v_n;
end;
$$;
comment on function privado.agendar_followup_d1() is 'Agenda a cadência da Isadora antes da reunião (PRD 10.1, D-21): uma execução por etapa (1 em followup_d1; 2 e 3 em followup_d3_d14) para a conversa de lead sem resposta há os dias de agente_cadencia_dias, sem transferência aberta, sem reunião agendada ou realizada, fora de humano_comercial, só a etapa seguinte à última enviada neste silêncio e no máximo 2 etapas para quem nunca respondeu à abertura. Nunca executa: agente.followups_devidos consome. O nome ficou por compatibilidade. Resposta nova da família cancela o agendamento velho. Sem grant.';

-- --- 9.2 agente.followups_devidos --------------------------------------------------------------------
create or replace function agente.followups_devidos() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_cad       numeric[] := privado.agente_cadencia();
  v_n_ctx     integer := coalesce(privado.agente_parametro_numero('agente_followup_contexto_mensagens'), 0)::integer;
  v_lim       numeric := privado.agente_parametro_numero('agente_followup_similaridade');
  v_rec       public.automacao_execucao;
  v_conv      public.conversa;
  v_estado    jsonb;
  v_pode      jsonb;
  v_cancelar  text;
  v_o         public.oportunidade;
  v_chave     text;
  v_texto     text;
  v_nome      text;
  v_horas_sem integer;
  v_etapa     integer;
  v_dias      numeric;
  v_motivo    text;
  v_nunca     boolean;
  v_reoferecer boolean := false;
  v_itens     jsonb := '[]'::jsonb;
  v_ctx       jsonb;
  v_reservadas integer := 0;
  v_canceladas integer := 0;
  v_abortadas  integer := 0;
  v_aguardando integer := 0;
  v_enviados   jsonb;
begin
  perform privado.agente_contexto();
  if pg_catalog.cardinality(v_cad) = 0 then
    return pg_catalog.jsonb_build_object('ok', true, 'itens', '[]'::jsonb, 'aviso', 'parametro_agente_cadencia_dias_ausente',
                                         'validador', pg_catalog.jsonb_build_object('listas', privado.agente_parametro('validador_listas')),
                                         'enviados_hoje', '[]'::jsonb, 'limite_similaridade', v_lim);
  end if;

  for v_rec in
    select e.*
    from public.automacao_execucao e
    where e.automacao_id in ('followup_d1', 'followup_d3_d14')
      and e.status = 'agendada'
      and e.agendada_para <= pg_catalog.clock_timestamp()
      and not (coalesce(e.payload, '{}'::jsonb) ? 'reservada_em')
    order by e.agendada_para
    for update of e skip locked
  loop
    v_cancelar := null;
    v_conv := null;
    v_etapa := coalesce((v_rec.payload ->> 'etapa')::integer, 1);
    v_dias := v_cad[least(v_etapa, pg_catalog.cardinality(v_cad))];
    select c.* into v_conv from public.conversa c where c.id = (v_rec.payload ->> 'conversa_id')::uuid;

    if v_conv.id is null then
      v_cancelar := 'conversa_inexistente';
    else
      -- freio primeiro: pode_executar grava abortada_freio com o estado
      if v_rec.familia_id is not null and not privado.pode_executar(v_rec.familia_id, v_rec.automacao_id, v_rec.id) then
        v_abortadas := v_abortadas + 1;
        continue;
      end if;

      v_estado := privado.agente_estado_conversa(v_conv.id);
      v_cancelar := case
        when v_estado ->> 'modo' = 'silencio' then 'numero_equipe'
        when v_estado ->> 'agente_modo' = 'desligado' then 'agente_desligado'
        when v_estado ->> 'agente_modo' = 'teste' and not (v_estado ->> 'na_whitelist')::boolean then 'fora_da_lista_de_teste'
        when (v_estado ->> 'humano_comercial')::boolean then 'humano_comercial'
        when v_estado ->> 'modo' = 'humano_nominal' then 'humano_nominal'
        when (v_estado ->> 'nao_lead')::boolean or v_conv.classificacao <> 'lead' then 'nao_e_lead'
        when (v_estado ->> 'cliente')::boolean then 'cliente'
        -- [v4.3] reunião marcada ou feita: a cadência antes da reunião acabou
        when exists (select 1 from public.sessao_venda s
                     where s.familia_id = privado.familia_vigente(v_rec.familia_id) and s.status in ('agendada', 'realizada'))
          then 'reuniao_agendada_ou_realizada'
        when (v_estado ->> 'handoff_aberto')::boolean then 'transferencia_aberta'
        when (v_estado ->> 'pausa')::boolean then 'pausado'
        when (v_estado ->> 'nao_contatar')::boolean then 'nao_contatar'
        when v_conv.wa_jid is null then 'sem_jid'
        when v_conv.ultima_entrada_em is null
             or v_conv.ultima_entrada_em is distinct from (v_rec.payload ->> 'ultima_entrada_em')::timestamptz
             or v_conv.ultima_entrada_em > pg_catalog.now() - pg_catalog.make_interval(secs => (v_dias * 86400)::double precision)
          then 'familia_respondeu'
        when v_conv.ultima_saida_em is null or v_conv.ultima_saida_em < v_conv.ultima_entrada_em
          then 'sem_resposta_da_kraamzorg'
      end;

      if v_cancelar is null then
        v_pode := privado.pode_enviar_mensagem(v_rec.familia_id, 'conteudo');
        if not coalesce((v_pode ->> 'pode')::boolean, false) then
          if v_pode ->> 'motivo' in ('fora_da_janela', 'janela_nao_configurada', 'conteudo_ja_enviado_hoje') then
            v_aguardando := v_aguardando + 1;
            continue;
          end if;
          v_cancelar := coalesce(v_pode ->> 'motivo', 'pode_enviar_recusou');
        end if;
      end if;

      if v_cancelar is null then
        v_o := privado.agente_oportunidade_aberta(v_rec.familia_id);
        v_nunca := (select pg_catalog.count(*) from public.mensagem m
                    where m.conversa_id = v_conv.id and m.direcao = 'entrada') <= 1;
        -- motivo novo a cada etapa (PRD 11.14): apresentação, reunião, respeitar o tempo
        v_chave := case v_etapa
                     when 1 then case when v_o.pdf_enviado_em is not null then 'followup_d1_pos_pdf' else 'followup_d1_pos_abertura' end
                     when 2 then case when v_nunca then 'sem_resposta_abertura_2' else 'followup_d3' end
                     else 'followup_d14'
                   end;
        v_motivo := case v_etapa
                      when 1 then case when v_o.pdf_enviado_em is not null then 'esclarecer_apresentacao' else 'retomar_abertura' end
                      when 2 then case when v_nunca then 'retomar_abertura' else 'oferecer_reuniao' end
                      else 'respeitar_o_tempo'
                    end;
        -- opções de horário oferecidas e vencidas sem escolha: nas etapas 1 e 2 o retorno retoma
        -- com opções atualizadas (o fluxo 3 consulta a agenda pelo fluxo 4 e preenche as
        -- variáveis opcao_1 e opcao_2; a etapa 3 só respeita o tempo da família)
        v_reoferecer := v_etapa < 3
          and exists (select 1 from public.sessao_venda_opcao op
                      where op.conversa_id = v_conv.id and op.escolhida_em is null and op.descartada_em is null
                        and op.valida_ate <= pg_catalog.now())
          and not exists (select 1 from public.sessao_venda_opcao op
                          where op.conversa_id = v_conv.id and op.escolhida_em is null and op.descartada_em is null
                            and op.valida_ate > pg_catalog.now());
        if v_reoferecer then
          v_chave := 'opcoes_vencidas';
          v_motivo := 'opcoes_vencidas';
        end if;
        v_texto := privado.agente_texto(v_chave, true);
        if v_texto is null then
          v_cancelar := 'texto_nao_aprovado';
        end if;
      end if;
    end if;

    if v_cancelar is not null then
      update public.automacao_execucao e
         set status = 'cancelada', motivo_aborto = v_cancelar
       where e.id = v_rec.id;
      v_canceladas := v_canceladas + 1;
      continue;
    end if;

    -- reserva: a próxima chamada não devolve esta execução de novo
    update public.automacao_execucao e
       set payload = coalesce(e.payload, '{}'::jsonb)
                     || pg_catalog.jsonb_build_object('reservada_em', pg_catalog.now(), 'chave_texto', v_chave)
     where e.id = v_rec.id;
    v_reservadas := v_reservadas + 1;

    v_nome := privado.agente_primeiro_nome(v_conv.id);
    v_horas_sem := pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.now() - v_conv.ultima_entrada_em) / 3600)::integer;

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('de', u.de, 'texto', u.texto) order by u.enviada_em, u.criado_em), '[]'::jsonb)
      into v_ctx
    from (
      select case when m.direcao = 'entrada' then 'familia'
                  when m.enviado_por = 'ia' then 'isadora'
                  when m.enviado_por = 'humano' then 'equipe'
                  else 'sistema' end as de,
             coalesce(nullif(pg_catalog.btrim(m.conteudo), ''), m.transcricao) as texto,
             m.enviada_em, m.criado_em
      from public.mensagem m
      where m.conversa_id = v_conv.id
      order by m.enviada_em desc, m.criado_em desc
      limit v_n_ctx
    ) u;

    v_itens := v_itens || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'execucao_id', v_rec.id,
      'conversa_id', v_conv.id,
      'wa_jid', v_conv.wa_jid,
      'nome', coalesce(v_nome, ''),
      'etapa', v_etapa,
      'motivo', v_motivo,
      'precisa_agenda', v_chave = 'opcoes_vencidas',
      'texto_base', privado.aplicar_texto(v_texto, v_nome, '{}'::jsonb),
      'tempo_sem_resposta', case when v_horas_sem >= 24
                                 then (v_horas_sem / 24)::text || case when v_horas_sem / 24 = 1 then ' dia' else ' dias' end
                                 else v_horas_sem::text || case when v_horas_sem = 1 then ' hora' else ' horas' end end,
      'data_hora', privado.formatar_data_hora(pg_catalog.now()),
      'ultimas_mensagens', v_ctx));
  end loop;

  -- mensagens proativas que saíram hoje, para a comparação por hash e semelhança
  -- no código (11.11 item 7); nunca vão para o modelo
  select coalesce(pg_catalog.jsonb_agg(m.conteudo), '[]'::jsonb) into v_enviados
  from public.automacao_execucao e
  join public.mensagem m on m.id = (e.payload ->> 'mensagem_id')::uuid
  where e.automacao_id in ('followup_d1', 'followup_d3_d14', 'reuniao_falta_remarcar', 'lembrete_sessao')
    and e.status = 'executada'
    and (e.executada_em at time zone 'America/Sao_Paulo')::date = privado.agente_hoje();

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'itens', v_itens,
    'validador', pg_catalog.jsonb_build_object('listas', privado.agente_parametro('validador_listas')),
    'enviados_hoje', v_enviados,
    'limite_similaridade', v_lim,
    'reservadas', v_reservadas,
    'canceladas', v_canceladas,
    'abortadas_freio', v_abortadas,
    'aguardando', v_aguardando);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.followups_devidos() is 'Apêndice A [v4.3] e PRD 19.4 nó 37: lista reservada dos retornos devidos da cadência de 1, 3 e 14 dias (followup_d1 e followup_d3_d14 agendados pelo motor), com freio, nao_contatar, pausa, transferência aberta, modo (nunca humano_comercial), reunião agendada ou realizada, lista de teste, conversa iniciada pela família, janela, uma mensagem de conteúdo por dia e os dias da etapa sem resposta. Nas etapas 1 e 2, com opções de horário vencidas sem escolha, o motivo é opcoes_vencidas e precisa_agenda vem verdadeiro (o fluxo 3 consulta a agenda pelo fluxo 4 e preenche opcao_1 e opcao_2). Devolve {ok, itens: [{execucao_id, conversa_id, wa_jid, nome, etapa, motivo, precisa_agenda, texto_base, tempo_sem_resposta, data_hora, ultimas_mensagens}], validador, enviados_hoje, limite_similaridade}.';

-- --- 9.3 agente.registrar_followup -----------------------------------------------------------------------
-- Vale para a cadência (followup_d1 e followup_d3_d14) e para a remarcação
-- depois de uma falta (reuniao_falta_remarcar), que o n8n fecha do mesmo jeito.
create or replace function agente.registrar_followup(execucao_id uuid, texto text, ok boolean) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_e          public.automacao_execucao;
  v_conversa   uuid;
  v_texto      text := nullif(pg_catalog.btrim(privado.mascarar_documentos(registrar_followup.texto)), '');
  v_mensagem   uuid;
  v_tentativas integer;
  v_sugerido   text;
  v_etapa      integer;
begin
  perform privado.agente_contexto();
  select e.* into v_e from public.automacao_execucao e
  where e.id = registrar_followup.execucao_id
    and e.automacao_id in ('followup_d1', 'followup_d3_d14', 'reuniao_falta_remarcar')
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'execucao_nao_encontrada');
  end if;
  if v_e.status <> 'agendada' or not (coalesce(v_e.payload, '{}'::jsonb) ? 'reservada_em') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'execucao_nao_reservada');
  end if;
  v_conversa := (v_e.payload ->> 'conversa_id')::uuid;
  v_etapa := coalesce((v_e.payload ->> 'etapa')::integer, 1);

  if coalesce(registrar_followup.ok, false) and v_texto is not null then
    insert into public.mensagem (conversa_id, direcao, enviado_por, tipo, conteudo)
    values (v_conversa, 'saida', 'ia', 'texto', v_texto)
    returning id into v_mensagem;
    update public.conversa c set ultima_saida_em = pg_catalog.now() where c.id = v_conversa;
    update public.automacao_execucao e
       set status = 'executada',
           executada_em = pg_catalog.clock_timestamp(),
           payload = e.payload || pg_catalog.jsonb_build_object('mensagem_id', v_mensagem)
     where e.id = v_e.id;
    if v_e.automacao_id in ('followup_d1', 'followup_d3_d14') then
      update public.oportunidade o
         set cadencia_etapa = v_etapa
       where o.id = (privado.agente_oportunidade_aberta(v_e.familia_id)).id;
    end if;
    if v_e.familia_id is not null then
      insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
      values (v_e.familia_id, 'followup', v_e.automacao_id,
              pg_catalog.jsonb_build_object('execucao_id', v_e.id, 'conversa_id', v_conversa, 'etapa', v_etapa), false);
    end if;
    return pg_catalog.jsonb_build_object('ok', true, 'status', 'executada', 'mensagem_id', v_mensagem);
  end if;

  v_tentativas := coalesce((v_e.payload ->> 'tentativas')::integer, 0) + 1;
  if v_tentativas < 2 then
    update public.automacao_execucao e
       set payload = (e.payload - 'reservada_em') || pg_catalog.jsonb_build_object('tentativas', v_tentativas)
     where e.id = v_e.id;
    return pg_catalog.jsonb_build_object('ok', true, 'status', 'agendada', 'tentativas', v_tentativas);
  end if;

  update public.automacao_execucao e
     set status = 'falhou',
         erro = 'followup_nao_saiu_duas_vezes',
         payload = e.payload || pg_catalog.jsonb_build_object('tentativas', v_tentativas)
   where e.id = v_e.id;
  v_sugerido := privado.aplicar_texto(
    privado.agente_texto(coalesce(v_e.payload ->> 'chave_texto',
                                  case v_e.automacao_id when 'reuniao_falta_remarcar' then 'nao_compareceu'
                                                        else 'followup_d1_pos_abertura' end), true),
    privado.agente_primeiro_nome(v_conversa), '{}'::jsonb);
  insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload, origem_automacao_id)
  values ('followup_comercial', v_e.familia_id, 'comercial', 'normal', v_e.automacao_id || '_nao_saiu',
          pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
            'execucao_id', v_e.id, 'conversa_id', v_conversa, 'texto_sugerido', v_sugerido)),
          v_e.automacao_id);
  return pg_catalog.jsonb_build_object('ok', true, 'status', 'falhou', 'tentativas', v_tentativas, 'tarefa_criada', true);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_followup(uuid, text, boolean) is 'Apêndice A [v4.3] e PRD 19.4 nós 41 e 47: fecha a execução reservada da cadência (followup_d1, followup_d3_d14) ou da remarcação depois de falta (reuniao_falta_remarcar). Saiu: executada (conta como a mensagem de conteúdo do dia), grava a mensagem da Isadora e, na cadência, cadencia_etapa = etapa. Não saiu: volta uma vez na próxima janela; na segunda, falhou e vira tarefa do comercial com o texto aprovado sugerido.';


-- =============================================================================
-- 10. Materializações do motor da agenda (chamadas por processar_automacoes)
-- =============================================================================

-- --- 10.1 desfecho_sessao_pendente: a Edilaine ainda não registrou o resultado -------------
create function privado.materializar_desfecho_sessao_pendente() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_horas numeric := privado.agente_parametro_numero('agenda_desfecho_pendente_horas');
  v_bloco integer := coalesce(privado.agenda_bloco(), 0);
  v_n     integer := 0;
  v_s     public.sessao_venda;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'desfecho_sessao_pendente'), false) then
    return 0;
  end if;
  if v_horas is null or v_horas <= 0 then
    return 0;
  end if;
  for v_s in
    select s.* from public.sessao_venda s
    where s.status = 'agendada' and s.agendada_para is not null
      and s.agendada_para + pg_catalog.make_interval(mins => v_bloco) + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision)
          <= pg_catalog.clock_timestamp()
      and not exists (select 1 from public.tarefa t
                      where t.tipo = 'registrar_desfecho_sessao' and t.payload ->> 'sessao_venda_id' = s.id::text)
  loop
    insert into public.tarefa (tipo, familia_id, responsavel_id, papel_responsavel, prioridade, titulo, payload, origem_automacao_id)
    values ('registrar_desfecho_sessao', v_s.familia_id, v_s.conduzida_por, 'coordenacao', 'alta',
            'Registrar como foi a reunião inicial',
            pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id), 'desfecho_sessao_pendente');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
comment on function privado.materializar_desfecho_sessao_pendente() is '[v4.3] desfecho_sessao_pendente (PRD 10.1): passado agenda_desfecho_pendente_horas do fim da reunião sem desfecho, nasce uma tarefa registrar_desfecho_sessao para quem conduz (a Edilaine). A Isadora não escreve nada. Uma tarefa por sessão. Sem grant.';

-- --- 10.2 consulta horario_edilaine sem resposta: sobe para a Edilaine -------------------------
create function privado.materializar_consultas_expiradas() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_n integer := 0;
  v_q public.consulta_equipe;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'consulta_horario_retomada'), false) then
    return 0;
  end if;
  for v_q in
    select q.* from public.consulta_equipe q
    where q.tipo = 'horario_edilaine' and q.status = 'aberta' and q.expira_em is not null
      and q.expira_em <= pg_catalog.clock_timestamp()
    for update of q skip locked
  loop
    update public.consulta_equipe q set status = 'expirada' where q.id = v_q.id;
    insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload, origem_automacao_id)
    values ('responder_consulta_isadora', v_q.familia_id, 'coordenacao', 'alta',
            'Horário para a família ainda sem abertura na agenda',
            pg_catalog.jsonb_build_object('consulta_id', v_q.id, 'tipo', v_q.tipo, 'motivo', 'sem_horario_no_prazo'),
            'consulta_horario_retomada');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
comment on function privado.materializar_consultas_expiradas() is '[v4.3] consulta_horario_retomada (PRD 10.1): a consulta horario_edilaine que passou agenda_consulta_horario_dias sem horário compatível vira expirada e sobe como tarefa de prioridade alta para a Edilaine; a cadência de follow-up segue. Sem grant.';


-- =============================================================================
-- 11. api de venda que muda na v4.3
-- =============================================================================

-- --- 11.1 api.agendar_sessao_venda (agendada_por = humano) ---------------------------------
create or replace function api.agendar_sessao_venda(
  familia_id        uuid,
  agendada_para     timestamptz,
  conduzida_por     uuid,
  link_reuniao      text,
  opcoes_informadas text default null,
  handoff_id        uuid default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid     uuid := auth.uid();
  v_f       public.familia;
  v_o       public.oportunidade;
  v_h       public.handoff;
  v_link    text := nullif(pg_catalog.btrim(agendar_sessao_venda.link_reuniao), '');
  v_opcoes  text := privado.campo_livre(agendar_sessao_venda.opcoes_informadas);
  v_id      uuid;
  v_lembrete uuid;
  v_estagio text;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if agendar_sessao_venda.familia_id is null or agendar_sessao_venda.agendada_para is null then
    perform privado.venda_recusar('dados_obrigatorios', 'familia_id e agendada_para');
  end if;
  if agendar_sessao_venda.agendada_para <= pg_catalog.now() then
    perform privado.venda_recusar('data_no_passado');
  end if;
  if v_link is null then
    perform privado.venda_recusar('link_obrigatorio');
  end if;
  if v_link !~ '^https://[^[:space:]]+$' or pg_catalog.length(v_link) > 500 then
    perform privado.venda_recusar('link_invalido');
  end if;
  if agendar_sessao_venda.conduzida_por is null
     or not exists (select 1 from public.perfil p
                    join public.usuario_papel up on up.usuario_id = p.id
                    where p.id = agendar_sessao_venda.conduzida_por and p.ativo
                      and up.papel in ('coordenacao', 'diretoria')) then
    perform privado.venda_recusar('condutor_invalido');
  end if;

  select f.* into v_f from public.familia f where f.id = agendar_sessao_venda.familia_id for update;
  if not found or v_f.mesclada_em_id is not null then
    perform privado.venda_recusar('familia_inexistente');
  end if;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    perform privado.venda_recusar('familia_em_estado_sensivel');
  end if;
  if v_f.nao_contatar then
    perform privado.venda_recusar('familia_nao_contatar');
  end if;
  if exists (select 1 from public.sessao_venda s where s.familia_id = v_f.id and s.status = 'agendada') then
    perform privado.venda_recusar('sessao_ja_agendada');
  end if;

  -- P1 (PRD 7.1): qualificado e nutrição vão direto; em conversa com a IA
  -- passa por qualificado; já agendada (dado herdado) fica. No P2, a sessão
  -- é só agenda: o P1 não anda mais.
  v_o := privado.venda_oportunidade(v_f.id);
  if v_o.id is not null and v_o.estagio_p2 is null then
    case v_o.estagio_p1
      when 'qualificado', 'nutricao' then
        perform privado.transicionar('p1', v_o.id, 'sessao_venda_agendada', 'Conversa de orientação marcada');
      when 'em_conversa_ia' then
        perform privado.transicionar('p1', v_o.id, 'qualificado', 'Qualificada ao marcar a conversa de orientação');
        perform privado.transicionar('p1', v_o.id, 'sessao_venda_agendada', 'Conversa de orientação marcada');
      when 'sessao_venda_agendada' then
        null;
      else
        perform privado.venda_recusar('estagio_nao_permite_sessao', v_o.estagio_p1::text);
    end case;
  end if;

  -- transferência "reuniao" de onde a tela veio: fecha com o desfecho
  -- sessao_marcada, sem tocar na conversa (humano_comercial continua).
  if agendar_sessao_venda.handoff_id is not null then
    select h.* into v_h from public.handoff h where h.id = agendar_sessao_venda.handoff_id for update;
    if not found or v_h.familia_id is distinct from v_f.id or v_h.motivo <> 'reuniao' then
      perform privado.venda_recusar('transferencia_invalida');
    end if;
    if v_opcoes is null then
      v_opcoes := privado.campo_livre(case pg_catalog.jsonb_typeof(v_h.dados -> 'opcoes')
                    when 'array' then (select pg_catalog.string_agg(o, ' ou ')
                                       from pg_catalog.jsonb_array_elements_text(v_h.dados -> 'opcoes') o)
                    when 'string' then v_h.dados ->> 'opcoes'
                  end);
    end if;
    if v_h.status in ('aberto', 'assumido') then
      update public.handoff h
         set status = 'resolvido',
             resolvido_em = pg_catalog.now(),
             assumido_por = coalesce(h.assumido_por, v_uid),
             assumido_em = coalesce(h.assumido_em, pg_catalog.now()),
             dados = h.dados || pg_catalog.jsonb_build_object('desfecho', 'sessao_marcada')
       where h.id = v_h.id;
      perform privado.venda_log('transferencia_resolvida', 'handoff', v_h.id::text,
        pg_catalog.jsonb_build_object('status', v_h.status),
        pg_catalog.jsonb_build_object('status', 'resolvido', 'desfecho', 'sessao_marcada'));
    end if;
  end if;

  insert into public.sessao_venda (familia_id, agendada_para, opcoes_informadas, conduzida_por, link_reuniao, agendada_por, status, criado_por)
  values (v_f.id, agendar_sessao_venda.agendada_para, v_opcoes, agendar_sessao_venda.conduzida_por, v_link, 'humano', 'agendada', v_uid)
  returning id into v_id;

  -- [v4.3] reunião marcada pela equipe: a cadência da Isadora e as opções de horário do dia deixam de valer
  perform privado.agenda_cancelar_execucoes(v_f.id, array['followup_d1', 'followup_d3_d14', 'reuniao_falta_remarcar', 'consulta_horario_retomada'],
                                            'reuniao_marcada_pela_equipe');
  update public.sessao_venda_opcao op set descartada_em = pg_catalog.now()
   where op.conversa_id in (select c.id from public.conversa c where c.familia_id = v_f.id)
     and op.escolhida_em is null and op.descartada_em is null;

  v_lembrete := privado.venda_criar_lembrete(v_id, coalesce(v_o.responsavel_id, v_uid));

  perform privado.venda_evento(v_f.id, 'sessao',
    'Conversa de orientação marcada para ' || privado.formatar_data_hora(agendar_sessao_venda.agendada_para),
    pg_catalog.jsonb_build_object('sessao_venda_id', v_id, 'agendada_para', agendar_sessao_venda.agendada_para));
  perform privado.venda_log('sessao_venda_agendada', 'sessao_venda', v_id::text, null,
    pg_catalog.jsonb_build_object('familia_id', v_f.id, 'agendada_para', agendar_sessao_venda.agendada_para,
                                  'conduzida_por', agendar_sessao_venda.conduzida_por, 'handoff_id', agendar_sessao_venda.handoff_id));

  select o.estagio_p1::text into v_estagio from public.oportunidade o where o.id = v_o.id;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'sessao_id', v_id,
    'tarefa_lembrete_id', v_lembrete,
    'estagio_p1', v_estagio);
end;
$$;
comment on function api.agendar_sessao_venda(uuid, timestamptz, uuid, text, text, uuid) is '[P29 item 1, v4.3] Agenda a sessão de venda pela equipe (contingência da D-19 e pedidos que chegam por outro canal; a Isadora agenda sozinha pelo Google Calendar): comercial ou diretoria, AAL pela regra do perfil. Grava agendada_por = humano. Data futura, link https obrigatório, condutor com coordenação ou diretoria, família fora de freio de bloqueio e de não contatar, uma sessão agendada por vez. P1 qualificado ou nutrição (em conversa com a IA passando por qualificado) para sessao_venda_agendada; lembrete da véspera como tarefa (lembrete_sessao, 23.2); transferência reuniao fechada com o desfecho sessao_marcada, sem devolver a conversa à Isadora; cancela a cadência e as opções de horário do dia. Evento e log. Recusa: erro P0001 venda:<código>.';

-- --- 11.2 api.remarcar_sessao_venda (recusa a sessão da Isadora) ----------------------------
create or replace function api.remarcar_sessao_venda(
  sessao_id     uuid,
  agendada_para timestamptz,
  link_reuniao  text default null,
  conduzida_por uuid default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid      uuid := auth.uid();
  v_s        public.sessao_venda;
  v_f        public.familia;
  v_o        public.oportunidade;
  v_link     text := coalesce(nullif(pg_catalog.btrim(remarcar_sessao_venda.link_reuniao), ''), null);
  v_condutor uuid;
  v_id       uuid;
  v_lembrete uuid;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select s.* into v_s from public.sessao_venda s where s.id = remarcar_sessao_venda.sessao_id for update;
  if not found then
    perform privado.venda_recusar('sessao_inexistente');
  end if;
  if v_s.status <> 'agendada' then
    perform privado.venda_recusar('sessao_nao_agendada', v_s.status::text);
  end if;
  -- [v4.3] a reunião marcada pela Isadora vive no Google Calendar: mudar é mover o evento
  if v_s.agendada_por = 'isadora' then
    perform privado.venda_recusar('sessao_da_isadora');
  end if;
  if remarcar_sessao_venda.agendada_para is null or remarcar_sessao_venda.agendada_para <= pg_catalog.now() then
    perform privado.venda_recusar('data_no_passado');
  end if;

  v_link := coalesce(v_link, v_s.link_reuniao);
  if v_link is null or v_link !~ '^https://[^[:space:]]+$' or pg_catalog.length(v_link) > 500 then
    perform privado.venda_recusar('link_invalido');
  end if;

  v_condutor := coalesce(remarcar_sessao_venda.conduzida_por, v_s.conduzida_por);
  if v_condutor is null
     or not exists (select 1 from public.perfil p
                    join public.usuario_papel up on up.usuario_id = p.id
                    where p.id = v_condutor and p.ativo and up.papel in ('coordenacao', 'diretoria')) then
    perform privado.venda_recusar('condutor_invalido');
  end if;

  select f.* into v_f from public.familia f where f.id = v_s.familia_id;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    perform privado.venda_recusar('familia_em_estado_sensivel');
  end if;

  update public.sessao_venda s set status = 'remarcada' where s.id = v_s.id;
  perform privado.venda_cancelar_tarefas_sessao(v_s.id);

  insert into public.sessao_venda (familia_id, agendada_para, opcoes_informadas, conduzida_por, link_reuniao, agendada_por, status, criado_por)
  values (v_s.familia_id, remarcar_sessao_venda.agendada_para, v_s.opcoes_informadas, v_condutor, v_link, 'humano', 'agendada', v_uid)
  returning id into v_id;

  v_o := privado.venda_oportunidade(v_s.familia_id);
  v_lembrete := privado.venda_criar_lembrete(v_id, coalesce(v_o.responsavel_id, v_uid));

  perform privado.venda_evento(v_s.familia_id, 'sessao',
    'Conversa de orientação remarcada para ' || privado.formatar_data_hora(remarcar_sessao_venda.agendada_para),
    pg_catalog.jsonb_build_object('sessao_venda_id', v_id, 'anterior_id', v_s.id,
                                  'agendada_para', remarcar_sessao_venda.agendada_para));
  perform privado.venda_log('sessao_venda_remarcada', 'sessao_venda', v_s.id::text,
    pg_catalog.jsonb_build_object('status', 'agendada', 'agendada_para', v_s.agendada_para),
    pg_catalog.jsonb_build_object('status', 'remarcada', 'nova_sessao_id', v_id,
                                  'agendada_para', remarcar_sessao_venda.agendada_para));

  return pg_catalog.jsonb_build_object('ok', true, 'sessao_id', v_id, 'anterior_id', v_s.id,
                                       'tarefa_lembrete_id', v_lembrete);
end;
$$;
comment on function api.remarcar_sessao_venda(uuid, timestamptz, text, uuid) is '[P29 item 2, v4.3] Remarca: a sessão agendada vira remarcada (histórico), nasce outra agendada com a data nova (link e condutor mantidos se não vierem), o lembrete antigo é cancelado e nasce o novo. P1 continua em sessao_venda_agendada. Comercial ou diretoria, AAL pela regra do perfil. [v4.3] Recusa a sessão marcada pela Isadora (venda:sessao_da_isadora): o evento vive no Google Calendar e o CRM se atualiza sozinho em até 30 minutos. Evento e log.';


-- --- 11.3 api.registrar_desfecho_sessao_venda: reunião realizada passa a conversa ao Leonardo --------
-- Mesma função da 0018 com um parâmetro a mais (resultado), por isso a antiga
-- sai e a nova entra. Quem registra:
--   realizada e não compareceu   coordenação e diretoria (a Edilaine)
--   cancelada                    comercial, coordenação e diretoria, só para
--                                sessão marcada pela equipe (a da Isadora vive
--                                no Google Calendar)
-- Realizada (PRD 11.14, D-20): P1 para sessao_venda_realizada; a conversa vai
-- para humano_comercial (agente_encerrado_motivo = reuniao_realizada); abre o
-- handoff reuniao_realizada para o comercial com o resumo interno e o
-- resultado; cria a tarefa pos_sessao_48h do Leonardo; cancela a cadência, os
-- lembretes e as consultas de horário; avisa o grupo. "Resolver" o handoff
-- depois não devolve a Isadora: só o botão "Devolver à Isadora".
-- Não compareceu: P1 volta a qualificado; a sessão da Isadora libera a
-- mensagem de remarcação dela (reuniao_falta_remarcar), sem tarefa humana; a
-- da equipe segue com a tarefa nao_compareceu do P29.
drop function api.registrar_desfecho_sessao_venda(uuid, public.status_sessao, boolean);

create function api.registrar_desfecho_sessao_venda(
  sessao_id         uuid,
  desfecho          public.status_sessao,
  parceiro_presente boolean default null,
  resultado         text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_s         public.sessao_venda;
  v_f         public.familia;
  v_o         public.oportunidade;
  v_resultado text := privado.campo_livre(privado.mascarar_documentos(registrar_desfecho_sessao_venda.resultado));
  v_horas     numeric;
  v_tarefa    uuid;
  v_estagio   text;
  v_titulo    text;
  v_conv      public.conversa;
  v_matriz    jsonb;
  v_entrada   jsonb;
  v_prior     public.prioridade;
  v_h         uuid;
  v_grupo     jsonb;
  v_link      text;
  v_conversas integer := 0;
  v_falta_em  timestamptz;
  v_nova_ex   uuid;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if registrar_desfecho_sessao_venda.desfecho in ('realizada', 'nao_compareceu')
     and not (privado.tem_papel('coordenacao') or privado.tem_papel('diretoria')) then
    raise exception 'venda:so_edilaine Só a Edilaine, a coordenação e a diretoria registram como foi a reunião'
      using errcode = '42501';
  end if;
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if registrar_desfecho_sessao_venda.desfecho is null
     or registrar_desfecho_sessao_venda.desfecho not in ('realizada', 'nao_compareceu', 'cancelada') then
    perform privado.venda_recusar('desfecho_invalido');
  end if;

  select s.* into v_s from public.sessao_venda s where s.id = registrar_desfecho_sessao_venda.sessao_id for update;
  if not found then
    perform privado.venda_recusar('sessao_inexistente');
  end if;
  if v_s.status <> 'agendada' then
    perform privado.venda_recusar('sessao_nao_agendada', v_s.status::text);
  end if;
  if registrar_desfecho_sessao_venda.desfecho in ('realizada', 'nao_compareceu')
     and v_s.agendada_para > pg_catalog.now() then
    perform privado.venda_recusar('sessao_ainda_nao_aconteceu');
  end if;
  if registrar_desfecho_sessao_venda.desfecho = 'cancelada' and v_s.agendada_por = 'isadora' then
    perform privado.venda_recusar('sessao_da_isadora');
  end if;

  select f.* into v_f from public.familia f where f.id = v_s.familia_id;
  v_o := privado.venda_oportunidade(v_s.familia_id);

  update public.sessao_venda s
     set status = registrar_desfecho_sessao_venda.desfecho,
         realizada_em = case when registrar_desfecho_sessao_venda.desfecho = 'realizada' then v_s.agendada_para else s.realizada_em end,
         parceiro_presente = coalesce(registrar_desfecho_sessao_venda.parceiro_presente, s.parceiro_presente),
         resultado = coalesce(v_resultado, s.resultado)
   where s.id = v_s.id;
  perform privado.venda_cancelar_tarefas_sessao(v_s.id);
  perform privado.agenda_cancelar_execucoes(v_s.familia_id, array['lembrete_sessao'], 'desfecho_registrado');

  if v_o.id is not null and v_o.estagio_p2 is null and v_o.estagio_p1 = 'sessao_venda_agendada' then
    if registrar_desfecho_sessao_venda.desfecho = 'realizada' then
      perform privado.transicionar('p1', v_o.id, 'sessao_venda_realizada', 'Reunião inicial realizada');
    elsif not exists (select 1 from public.sessao_venda s2
                      where s2.familia_id = v_s.familia_id and s2.status = 'agendada' and s2.id <> v_s.id) then
      perform privado.transicionar('p1', v_o.id, 'qualificado',
        case registrar_desfecho_sessao_venda.desfecho when 'nao_compareceu' then 'Família não compareceu à reunião inicial'
                                                      else 'Reunião inicial cancelada' end);
    end if;
  end if;

  if registrar_desfecho_sessao_venda.desfecho = 'realizada' then
    -- 1. tarefa do Leonardo: o responsável da oportunidade ou, sem ele, o papel comercial
    v_horas := privado.venda_numero('sessao_venda_retorno_horas');
    if v_horas is not null then
      v_tarefa := privado.venda_criar_tarefa(
        v_s.familia_id, 'followup_comercial',
        'Perguntar à ' || v_f.nome_exibicao || ' como foi a conversa',
        v_o.responsavel_id, 'normal',
        v_s.agendada_para + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision),
        'pos_sessao_48h', '{}'::jsonb, 'conteudo',
        pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id));
      if v_tarefa is not null then
        update public.tarefa t set papel_responsavel = 'comercial' where t.id = v_tarefa and t.responsavel_id is null;
      end if;
    end if;

    -- 2. a Isadora sai: cadência, remarcação e retomada de horário deixam de valer
    perform privado.agenda_cancelar_execucoes(v_s.familia_id,
      array['followup_d1', 'followup_d3_d14', 'reuniao_falta_remarcar', 'consulta_horario_retomada'], 'reuniao_realizada');
    update public.consulta_equipe q set status = 'cancelada'
     where q.status = 'aberta'
       and q.conversa_id in (select c.id from public.conversa c where c.familia_id = v_s.familia_id);

    -- 3. a conversa passa ao Leonardo: humano_comercial, sem prazo
    update public.conversa c
       set agente_encerrado_em = pg_catalog.clock_timestamp(),
           agente_encerrado_motivo = 'reuniao_realizada'
     where c.familia_id = v_s.familia_id
       and c.classificacao in ('nao_classificado', 'lead')
       and c.agente_encerrado_em is null;
    get diagnostics v_conversas = row_count;
    select c.* into v_conv from public.conversa c
     where c.familia_id = v_s.familia_id and c.classificacao in ('nao_classificado', 'lead')
     order by c.ultima_entrada_em desc nulls last, c.criado_em desc limit 1;

    -- 4. transferência reuniao_realizada para o comercial, com o resumo interno e o resultado
    v_matriz := privado.venda_parametro('handoff_matriz');
    if pg_catalog.jsonb_typeof(v_matriz) = 'array' then
      select e into v_entrada from pg_catalog.jsonb_array_elements(v_matriz) e where e ->> 'motivo' = 'reuniao_realizada' limit 1;
    end if;
    v_prior := coalesce(v_entrada ->> 'prioridade', 'normal')::public.prioridade;
    if not exists (select 1 from public.handoff h
                   where h.familia_id = v_s.familia_id and h.motivo = 'reuniao_realizada' and h.status in ('aberto', 'assumido')) then
      insert into public.handoff (conversa_id, familia_id, motivo, destino, prioridade, resumo, solicitacao, dados, sla_vence_em)
      values (v_conv.id, v_s.familia_id, 'reuniao_realizada', 'comercial', v_prior,
              coalesce(privado.agenda_resumo_reuniao(v_s.id), 'Reunião inicial realizada.'),
              v_resultado,
              pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
                'sessao_venda_id', v_s.id, 'resultado', v_resultado, 'origem', 'api.registrar_desfecho_sessao_venda',
                'agendada_por', v_s.agendada_por)),
              case when v_entrada is not null then privado.agente_sla(v_entrada, v_prior, pg_catalog.now()) end)
      returning id into v_h;
    end if;

    -- 5. aviso ao grupo (o app despacha o canal whatsapp_interno)
    v_link := pg_catalog.replace(coalesce(privado.venda_parametro('link_ficha_modelo') #>> '{}', ''), '{familia_id}', v_s.familia_id::text);
    if v_conv.id is not null then
      v_grupo := privado.agenda_mensagem_grupo('grupo_reuniao_realizada', v_conv.id, 'comercial',
                   pg_catalog.jsonb_build_object('resultado', coalesce(v_resultado, 'não informado')), 'grupo_rodape_humano_comercial');
    end if;
    insert into public.notificacao (papel, prioridade, titulo, corpo, link, canais, criado_por)
    values ('comercial', v_prior, 'reuniao_realizada',
            coalesce(v_grupo ->> 'mensagem', 'Reunião inicial realizada. Agora a conversa é do Leonardo.'),
            nullif(v_link, ''), array['app', 'whatsapp_interno'], v_uid);

    v_titulo := 'Reunião inicial realizada';
  elsif registrar_desfecho_sessao_venda.desfecho = 'nao_compareceu' then
    if v_s.agendada_por = 'isadora' then
      -- a Isadora remarca sem constranger; a conversa continua com ela
      select c.* into v_conv from public.conversa c
       where c.familia_id = v_s.familia_id and c.classificacao in ('nao_classificado', 'lead')
       order by c.ultima_entrada_em desc nulls last, c.criado_em desc limit 1;
      if v_conv.id is not null and coalesce((select a.ativa from public.automacao a where a.id = 'reuniao_falta_remarcar'), false) then
        v_falta_em := pg_catalog.now() + pg_catalog.make_interval(
                        secs => (coalesce(privado.venda_numero('agenda_remarcar_apos_falta_horas'), 0) * 3600)::double precision);
        insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
        values ('reuniao_falta_remarcar', v_s.familia_id, v_falta_em, 'agendada',
                pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'conversa_id', v_conv.id))
        returning id into v_nova_ex;
      end if;
    else
      v_tarefa := privado.venda_criar_tarefa(
        v_s.familia_id, 'agendar_sessao',
        'Oferecer outro horário à ' || v_f.nome_exibicao,
        coalesce(v_o.responsavel_id, v_uid), 'normal', pg_catalog.now(),
        'nao_compareceu', '{}'::jsonb, 'operacional',
        pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id));
    end if;
    v_titulo := 'A família não compareceu à reunião inicial';
  else
    v_titulo := 'Reunião inicial cancelada';
  end if;

  perform privado.venda_evento(v_s.familia_id, 'sessao', v_titulo,
    pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'status', registrar_desfecho_sessao_venda.desfecho));
  perform privado.venda_log('sessao_venda_desfecho', 'sessao_venda', v_s.id::text,
    pg_catalog.jsonb_build_object('status', 'agendada'),
    pg_catalog.jsonb_build_object('status', registrar_desfecho_sessao_venda.desfecho,
                                  'parceiro_presente', registrar_desfecho_sessao_venda.parceiro_presente,
                                  'humano_comercial', registrar_desfecho_sessao_venda.desfecho = 'realizada' and v_conversas > 0));

  select o.estagio_p1::text into v_estagio from public.oportunidade o where o.id = v_o.id;
  return pg_catalog.jsonb_build_object('ok', true, 'sessao_id', v_s.id,
                                       'status', registrar_desfecho_sessao_venda.desfecho,
                                       'tarefa_id', v_tarefa, 'estagio_p1', v_estagio,
                                       'handoff_id', v_h, 'conversa_id', v_conv.id,
                                       'humano_comercial', registrar_desfecho_sessao_venda.desfecho = 'realizada' and v_conv.id is not null,
                                       'remarcacao_da_isadora', v_nova_ex is not null);
end;
$$;
comment on function api.registrar_desfecho_sessao_venda(uuid, public.status_sessao, boolean, text) is '[P29 item 2, v4.3, D-20] Desfecho da sessão agendada. Realizada e não compareceu: coordenação e diretoria (a Edilaine), só depois do horário. Cancelada: comercial, coordenação e diretoria, só para sessão marcada pela equipe. Realizada: P1 para sessao_venda_realizada, conversa em humano_comercial (reuniao_realizada), handoff reuniao_realizada para o comercial com o resumo interno e o resultado (campo curto, sem dado clínico), tarefa pos_sessao_48h do Leonardo, cadência, lembretes e consultas de horário cancelados, aviso ao grupo por notificação interna. Não compareceu: P1 volta a qualificado; sessão da Isadora libera a remarcação dela (reuniao_falta_remarcar, sem tarefa humana), sessão da equipe segue com a tarefa nao_compareceu. Evento e log. Recusa: venda:<código>.';

-- --- 11.4 api.sessoes_venda: origem, lembrete, resultado e resumo da Isadora ------------------------
drop function api.sessoes_venda(timestamptz, timestamptz, uuid, uuid);

create function api.sessoes_venda(
  desde      timestamptz default null,
  ate        timestamptz default null,
  da_familia uuid default null,
  da_sessao  uuid default null
)
  returns table (
    id                  uuid,
    familia_id          uuid,
    familia_nome        text,
    estado_sensivel     public.estado_sensivel,
    dpp                 date,
    data_nascimento     date,
    agendada_para       timestamptz,
    status              public.status_sessao,
    realizada_em        timestamptz,
    link_reuniao        text,
    opcoes_informadas   text,
    parceiro_presente   boolean,
    conduzida_por       uuid,
    conduzida_por_nome  text,
    criado_em           timestamptz,
    pode_ver_gravacao   boolean,
    gravacao_registrada boolean,
    agendada_por        public.origem_agendamento_sessao,
    lembrete_enviado_em timestamptz,
    resultado           text,
    resumo_isadora      text,
    conversa_com        text
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_diretoria boolean;
  v_aal2      boolean;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  v_diretoria := privado.tem_papel('diretoria');
  v_aal2 := privado.aal2();

  return query
    select s.id, s.familia_id, f.nome_exibicao, f.estado_sensivel, f.dpp, f.data_nascimento,
           s.agendada_para, s.status, s.realizada_em, s.link_reuniao, s.opcoes_informadas,
           s.parceiro_presente, s.conduzida_por, pr.nome, s.criado_em,
           (v_diretoria or s.conduzida_por = v_uid),
           case when (v_diretoria or s.conduzida_por = v_uid) and v_aal2
                then exists (select 1 from public.sessao_venda_gravacao g
                             where g.sessao_id = s.id and (g.transcricao is not null or g.gravacao_path is not null))
           end,
           s.agendada_por, s.lembrete_enviado_em, s.resultado,
           -- o resumo interno só sai no detalhe de uma sessão (é montado por conversa)
           case when sessoes_venda.da_sessao is not null
                then pg_catalog.replace(privado.agenda_resumo_reuniao(s.id), ' / próximo passo: não informado', '') end,
           -- quem conduz a conversa hoje: a Isadora, ou o Leonardo depois da reunião realizada
           case when exists (select 1 from public.conversa c
                             where c.familia_id = s.familia_id and c.agente_encerrado_em is not null) then 'leonardo'
                else 'isadora' end
    from public.sessao_venda s
    join public.familia f on f.id = s.familia_id
    left join public.perfil pr on pr.id = s.conduzida_por
    where f.mesclada_em_id is null
      and (sessoes_venda.desde is null or s.agendada_para >= sessoes_venda.desde)
      and (sessoes_venda.ate is null or s.agendada_para < sessoes_venda.ate)
      and (sessoes_venda.da_familia is null or s.familia_id = sessoes_venda.da_familia)
      and (sessoes_venda.da_sessao is null or s.id = sessoes_venda.da_sessao)
    order by s.agendada_para nulls last, s.criado_em, s.id;
end;
$$;
comment on function api.sessoes_venda(timestamptz, timestamptz, uuid, uuid) is '[P29 item 4, v4.3] Agenda das sessões de venda para comercial, coordenação e diretoria (AAL pela regra do perfil), com o nome da família e de quem conduz. pode_ver_gravacao diz se quem pede é quem conduziu ou a diretoria; gravacao_registrada só vem para quem pode ver e está em AAL2. [v4.3] Traz a origem (agendada_por: isadora ou humano), o lembrete da véspera, o resultado, quem conduz a conversa hoje (conversa_com: isadora ou leonardo) e, no detalhe de uma sessão, o resumo da Isadora com as anotações para o Leonardo. Nunca devolve o id do evento do Google, transcrição nem resumo da gravação (isso é api.sessao_venda_gravacao, com log).';

-- --- 11.5 Perguntas da Isadora: consultas à equipe -------------------------------------------------------
create function api.consultas_equipe(situacao text default null)
  returns table (
    id             uuid,
    criado_em      timestamptz,
    conversa_id    uuid,
    familia_id     uuid,
    familia_nome   text,
    tipo           public.tipo_consulta_equipe,
    pergunta       text,
    preferencia    jsonb,
    destino        public.handoff_destino,
    resposta       text,
    respondida_em  timestamptz,
    respondida_por_nome text,
    expira_em      timestamptz,
    devolvida_em   timestamptz,
    status         public.status_consulta_equipe
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if consultas_equipe.situacao is not null and consultas_equipe.situacao not in ('aberta', 'respondida', 'expirada', 'cancelada') then
    raise exception 'consultas_equipe: situação inválida' using errcode = '22023';
  end if;
  return query
    select q.id, q.criado_em, q.conversa_id, q.familia_id, f.nome_exibicao, q.tipo, q.pergunta, q.preferencia, q.destino,
           q.resposta, q.respondida_em, pr.nome, q.expira_em, q.devolvida_em, q.status
    from public.consulta_equipe q
    left join public.familia f on f.id = q.familia_id
    left join public.perfil pr on pr.id = q.respondida_por
    where consultas_equipe.situacao is null or q.status = consultas_equipe.situacao::public.status_consulta_equipe
    order by (q.status = 'aberta') desc, q.criado_em desc, q.id;
end;
$$;
comment on function api.consultas_equipe(text) is '[v4.3] Tela "Perguntas da Isadora" (PRD 11.14): as consultas à equipe, abertas primeiro, com o nome da família e o texto da resposta. Comercial, coordenação e diretoria, AAL pela regra do perfil.';

create function api.responder_consulta_equipe(consulta_id uuid, resposta text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_q        public.consulta_equipe;
  v_resposta text := nullif(pg_catalog.btrim(privado.mascarar_documentos(responder_consulta_equipe.resposta)), '');
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select q.* into v_q from public.consulta_equipe q where q.id = responder_consulta_equipe.consulta_id for update;
  if not found then
    raise exception 'responder_consulta_equipe: consulta não existe' using errcode = 'P0002';
  end if;
  if v_q.status <> 'aberta' then
    raise exception 'responder_consulta_equipe: a consulta já está %', v_q.status using errcode = '22023';
  end if;
  if v_resposta is null and v_q.tipo <> 'horario_edilaine' then
    raise exception 'responder_consulta_equipe: escreva a resposta para a Isadora' using errcode = '22023';
  end if;
  if pg_catalog.length(coalesce(v_resposta, '')) > 1000 then
    raise exception 'responder_consulta_equipe: a resposta passa de 1.000 caracteres' using errcode = '22023';
  end if;

  update public.consulta_equipe q
     set resposta = v_resposta, respondida_por = auth.uid(), respondida_em = pg_catalog.now(),
         status = 'respondida', reservada_em = null
   where q.id = v_q.id;
  update public.tarefa t set status = 'concluida', concluida_em = pg_catalog.now()
   where t.tipo = 'responder_consulta_isadora' and t.payload ->> 'consulta_id' = v_q.id::text
     and t.status in ('aberta', 'em_andamento');
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), 'consulta_equipe_respondida', 'consulta_equipe', v_q.id::text,
          pg_catalog.jsonb_build_object('status', v_q.status),
          pg_catalog.jsonb_build_object('status', 'respondida'), privado.origem_atual(), privado.ip_requisicao());
  return pg_catalog.jsonb_build_object('ok', true, 'consulta_id', v_q.id, 'status', 'respondida');
end;
$$;
comment on function api.responder_consulta_equipe(uuid, text) is '[v4.3] "Perguntas da Isadora" (PRD 11.14): a equipe responde a uma consulta aberta; a Isadora devolve a resposta à família, com as próprias palavras, na próxima rodada da Entrada B (agente.proativos_agenda_devidos). Consulta de horário pode ser respondida sem texto ("abri um horário"). Comercial, coordenação e diretoria. Log.';


-- =============================================================================
-- 12. Execute
-- =============================================================================

-- agente: só n8n_agente (as funções novas; as substituídas mantêm o que já tinham)
grant execute on function agente.parametros_agenda()                                               to n8n_agente;
grant execute on function agente.registrar_opcoes_horario(uuid, jsonb, timestamptz)                to n8n_agente;
grant execute on function agente.validar_opcao_horario(uuid, uuid)                                 to n8n_agente;
grant execute on function agente.registrar_conferencia_horario(uuid, uuid, boolean)                to n8n_agente;
grant execute on function agente.reuniao_da_conversa(uuid)                                         to n8n_agente;
grant execute on function agente.registrar_reuniao(uuid, uuid, text, text, text, text)             to n8n_agente;
grant execute on function agente.registrar_remarcacao(uuid, jsonb)                                 to n8n_agente;
grant execute on function agente.registrar_cancelamento(uuid, jsonb)                               to n8n_agente;
grant execute on function agente.registrar_consulta_equipe(uuid, text, text, jsonb)                to n8n_agente;
grant execute on function agente.proativos_agenda_devidos()                                        to n8n_agente;
grant execute on function agente.registrar_lembrete(uuid, boolean, text)                           to n8n_agente;
grant execute on function agente.fechar_consulta(uuid, text, text)                                 to n8n_agente;
grant execute on function agente.sessoes_para_sincronizar()                                        to n8n_agente;
grant execute on function agente.sincronizar_reuniao(uuid, timestamptz, timestamptz, text, text)   to n8n_agente;

-- privado: sem grant para ninguém (só as funções security definer chamam)
revoke execute on function privado.proteger_sessao_da_isadora()                                    from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_dia_semana(timestamptz)                                  from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_data(timestamptz)                                        from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_hora(timestamptz)                                        from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_texto(timestamptz)                                       from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_fim_do_dia(timestamptz)                                  from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_bloco()                                                  from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_antecedencia()                                           from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_lembrete_em(timestamptz)                                 from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_sessao_vigente(uuid)                                     from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_estado(uuid)                                             from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_pode_falar(uuid, text)                                   from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_cancelar_execucoes(uuid, text[], text)                   from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_p1_ate_agendada(uuid, text)                              from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_resumo_reuniao(uuid)                                     from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_opcao(uuid, uuid, boolean)                               from public, anon, authenticated, service_role;
revoke execute on function privado.agenda_mensagem_grupo(text, uuid, public.handoff_destino, jsonb, text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_cadencia()                                               from public, anon, authenticated, service_role;
revoke execute on function privado.materializar_desfecho_sessao_pendente()                         from public, anon, authenticated, service_role;
revoke execute on function privado.materializar_consultas_expiradas()                              from public, anon, authenticated, service_role;

-- api: só authenticated
revoke execute on function api.registrar_desfecho_sessao_venda(uuid, public.status_sessao, boolean, text) from public, anon, service_role;
revoke execute on function api.sessoes_venda(timestamptz, timestamptz, uuid, uuid)                 from public, anon, service_role;
revoke execute on function api.consultas_equipe(text)                                              from public, anon, service_role;
revoke execute on function api.responder_consulta_equipe(uuid, text)                               from public, anon, service_role;
grant execute on function api.registrar_desfecho_sessao_venda(uuid, public.status_sessao, boolean, text) to authenticated;
grant execute on function api.sessoes_venda(timestamptz, timestamptz, uuid, uuid)                  to authenticated;
grant execute on function api.consultas_equipe(text)                                               to authenticated;
grant execute on function api.responder_consulta_equipe(uuid, text)                                to authenticated;


-- =============================================================================
-- 13. Trava (falha a migration se quebrar): toda função de api segue a regra;
--     toda função de agente é security definer, com search_path vazio, e só
--     n8n_agente executa; nada de privado é executável por authenticated além
--     da lista do PRD 11.10.
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
  where n.nspname = 'agente'
    and (not p.prosecdef
         or not coalesce(p.proconfig @> array['search_path=""'], false)
         or has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('service_role', p.oid, 'execute')
         or not has_function_privilege('n8n_agente', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função de agente fora da regra (security definer, search_path vazio, só n8n_agente): %', v_lista;
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
