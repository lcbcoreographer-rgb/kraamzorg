-- =============================================================================
-- 0009_freio.sql
--
-- P09 (PROMPTS.md v2) · PRD 8 inteiro (8.1, 8.2 e 8.3 [v4.2]), 6.8
-- (freio_desfazer_segundos, agente_janela_envio), 6.9, 10 (introdução), 13,
-- 16.1 (invariante 3), 22.4 (O-07)
--
-- Freio global: o protocolo de intercorrência mora no banco, não em cada
-- régua (PRD 8.2). "Implementar antes de qualquer automação. Nenhuma régua
-- vai ao ar sem isso" (PRD 8).
--
-- O que esta migration faz:
--   1. privado.freio_permite(categoria, estado): a matriz do 8.2, escrita
--      uma vez só. Todas as outras funções perguntam a ela.
--   2. privado.tem_acesso_familia(familia_id): "qualquer usuário com acesso
--      à família pode acionar" (8.3), com a mesma regra de linha da RLS de
--      familia (0007) e das famílias atribuídas da enfermeira.
--   3. privado.pode_executar(familia_id, automacao_id [, execucao_id]):
--      aplica a matriz; no aborto grava automacao_execucao com
--      'abortada_freio' e o estado no motivo.
--   4. privado.pode_enviar_mensagem(familia_id, categoria [, canal]):
--      {pode, motivo}; soma ao freio nao_contatar, conversa iniciada pela
--      família, uma mensagem de conteúdo por dia e a janela de horário.
--   5. Gatilhos em familia: as colunas do freio só mudam pelo dono (funções
--      deste arquivo, migrations e seed), e toda mudança de estado reavalia
--      na hora as execuções agendadas (8.2, "Mensagens já agendadas").
--   6. privado.acionar_freio, privado.desfazer_freio (o "Desfazer" do 8.3
--      [v4.2], freio_desfazer_segundos), privado.justificar_freio ("o motivo
--      pode vir depois") e privado.reverter_freio (só coordenação ou
--      diretoria, com justificativa). Todas gravam evento restrito na linha
--      do tempo e linha própria em log_auditoria.
--   7. Wrappers do app em api (PRD 5.2): api.acionar_freio,
--      api.desfazer_freio, api.justificar_freio e api.reverter_freio.
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura, registradas no
-- relatório da sessão e no ADR 0002):
--   * acionar_freio só SOBE o freio (ordem do enum estado_sensivel: normal,
--     atencao, bloqueio_total, encerrado_sensivel). Descer é reverter_freio
--     (coordenação ou diretoria) ou o "Desfazer" de quem acionou, dentro do
--     prazo. Vale para todo chamador, não só para o agente (8.3).
--   * Família mesclada: acionar_freio aplica o freio na família que ficou
--     (segue mesclada_em_id), para um aviso de perda nunca se perder; as
--     demais funções recusam família mesclada.
--   * pode_executar numa família mesclada usa o estado mais restritivo entre
--     ela e a família que ficou.
--   * pode_enviar_mensagem com categoria 'interna' devolve pode = falso:
--     'interna' "só avisa a equipe, nunca fala com a família" (8.2), e aviso
--     interno não passa por esta função (CLAUDE.md).
--   * A exigência de conversa iniciada pela família vale para todo canal
--     menos cloud_api (o PRD cita uazapi; manual segue a regra da régua, "só
--     entra quem já escreveu", 10.3). Canal omitido: a regra vale.
--   * Janela de horário vale para todas as categorias que falam com a
--     família. Parâmetro ausente ou inválido: pode = falso.
--   * "Uma mensagem de conteúdo por dia por família" é regra do 8.2, não
--     número ajustável: conta como já enviada no dia (fuso da operação) a
--     execução 'executada' de automação de conteúdo com executor sistema ou
--     agente, e a tarefa de automação de conteúdo concluída ("Enviei", 10.3).
--   * freio_desfazer_segundos ausente, inválido ou 0: não há "Desfazer".
--
-- Nenhuma tabela nova. Nenhum texto de interface: títulos de evento e de
-- tarefa são códigos (o app traduz), como em privado.transicionar (P06).
-- =============================================================================


-- =============================================================================
-- 1. A matriz do 8.2
--
-- | Categoria   | normal  | atencao | bloqueio_total | encerrado_sensivel |
-- | interna     | executa | executa | executa        | executa            |
-- | operacional | executa | executa | aborta         | aborta             |
-- | conteudo    | executa | aborta  | aborta         | aborta             |
-- | marketing   | executa | aborta  | aborta         | aborta             |
--
-- Categoria ou estado nulo: aborta (na dúvida, o freio vale).
-- =============================================================================

create function privado.freio_permite(categoria public.categoria_automacao, estado public.estado_sensivel)
  returns boolean
  language sql
  immutable
  parallel safe
  set search_path = ''
  as $$
  select coalesce(
    case freio_permite.categoria
      when 'interna'     then true
      when 'operacional' then freio_permite.estado in ('normal', 'atencao')
      when 'conteudo'    then freio_permite.estado = 'normal'
      when 'marketing'   then freio_permite.estado = 'normal'
    end,
    false)
$$;
comment on function privado.freio_permite(public.categoria_automacao, public.estado_sensivel) is 'Matriz do freio (PRD 8.2): interna executa sempre; operacional aborta em bloqueio_total e encerrado_sensivel; conteudo e marketing só executam em normal. Nulo aborta. Invariante 3 (PRD 16.1).';


-- =============================================================================
-- 2. Quem tem acesso à família (PRD 8.3, 13)
--
-- Mesma regra de linha da política "ler" de familia (0007): comercial,
-- coordenação e diretoria veem todas; financeiro, só família com contrato;
-- enfermeira, as famílias atribuídas (privado.familias_atribuidas). Marketing
-- não lê família. Perfil inativo ou sem papel: sem acesso (tem_papel já
-- confere perfil ativo). security definer: lê contrato sem a RLS dele.
-- =============================================================================

create function privado.tem_acesso_familia(familia_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select auth.uid() is not null
     and exists (select 1 from public.familia f where f.id = tem_acesso_familia.familia_id)
     and (
          privado.tem_papel('comercial')
       or privado.tem_papel('coordenacao')
       or privado.tem_papel('diretoria')
       or (privado.tem_papel('financeiro')
           and exists (select 1 from public.contrato k where k.familia_id = tem_acesso_familia.familia_id))
       or (privado.tem_papel('enfermeira')
           and exists (select 1 from privado.familias_atribuidas() as a(id) where a.id = tem_acesso_familia.familia_id))
     )
$$;
comment on function privado.tem_acesso_familia(uuid) is 'Verdadeiro se auth.uid() pode ver a família pela matriz do PRD 13 (mesma regra de linha da RLS de familia; enfermeira pelas famílias atribuídas). Usada pelo freio (8.3: qualquer usuário com acesso à família aciona). Sem grant.';


-- --- Família que ficou depois de mesclagens (PRD 6.10 regra 2) ----------------
-- Segue mesclada_em_id até a família que não foi mesclada. Um ciclo (que a
-- mesclagem do P17 nunca deve criar) é recusado em vez de rodar para sempre.
create function privado.familia_vigente(familia_id uuid) returns uuid
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_atual    uuid := familia_vigente.familia_id;
  v_proxima  uuid;
  v_visitadas uuid[] := array[]::uuid[];
begin
  loop
    select f.mesclada_em_id into v_proxima from public.familia f where f.id = v_atual;
    if not found then
      return null;
    end if;
    if v_proxima is null then
      return v_atual;
    end if;
    v_visitadas := v_visitadas || v_atual;
    if v_proxima = any (v_visitadas) then
      raise exception 'familia_vigente: ciclo em mesclada_em_id a partir de %', familia_vigente.familia_id
        using errcode = '22023';
    end if;
    v_atual := v_proxima;
  end loop;
end;
$$;
comment on function privado.familia_vigente(uuid) is 'Família que ficou depois de mesclagens (segue mesclada_em_id). Nula se a família não existe; recusa ciclo. Sem grant.';


-- =============================================================================
-- 3. privado.pode_executar (PRD 8.2)
--
-- Chamada pelo motor (P20) antes de toda ação, e de novo no instante do
-- envio. Lê o estado com "for share": se um acionamento do freio estiver em
-- andamento na mesma família, espera ele terminar e lê o estado novo.
--
-- execucao_id (opcional, acréscimo compatível com a assinatura do PRD):
-- quando o motor já materializou a execução, o aborto marca essa linha em
-- vez de criar outra. Execução que não está mais 'agendada' não executa
-- (devolve falso sem mexer nela: não é aborto pelo freio).
-- Automação sem família (documento_vencendo, sobrevenda): nada a frear.
-- =============================================================================

create function privado.pode_executar(familia_id uuid, automacao_id text, execucao_id uuid default null)
  returns boolean
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_categoria public.categoria_automacao;
  v_estado    public.estado_sensivel;
  v_vigente   uuid;
  v_exec      public.automacao_execucao;
begin
  if pode_executar.automacao_id is null then
    raise exception 'pode_executar: automacao_id é obrigatório'
      using errcode = '22023';
  end if;

  select a.categoria into v_categoria
  from public.automacao a
  where a.id = pode_executar.automacao_id;
  if not found then
    raise exception 'pode_executar: automação % não existe', pode_executar.automacao_id
      using errcode = 'P0002';
  end if;

  if pode_executar.execucao_id is not null then
    select e.* into v_exec
    from public.automacao_execucao e
    where e.id = pode_executar.execucao_id
    for update;
    if not found then
      raise exception 'pode_executar: execução % não existe', pode_executar.execucao_id
        using errcode = 'P0002';
    end if;
    if v_exec.automacao_id <> pode_executar.automacao_id
       or v_exec.familia_id is distinct from pode_executar.familia_id then
      raise exception 'pode_executar: a execução % não é desta automação e família', pode_executar.execucao_id
        using errcode = '22023';
    end if;
    if v_exec.status <> 'agendada' then
      return false;
    end if;
  end if;

  if pode_executar.familia_id is null then
    return true;
  end if;

  select f.estado_sensivel into v_estado
  from public.familia f
  where f.id = pode_executar.familia_id
  for share;
  if not found then
    raise exception 'pode_executar: família % não existe', pode_executar.familia_id
      using errcode = 'P0002';
  end if;

  -- família mesclada: vale o estado mais restritivo entre ela e a que ficou
  v_vigente := privado.familia_vigente(pode_executar.familia_id);
  if v_vigente is distinct from pode_executar.familia_id then
    select greatest(v_estado, f.estado_sensivel) into v_estado
    from public.familia f
    where f.id = v_vigente
    for share;
  end if;

  if privado.freio_permite(v_categoria, v_estado) then
    return true;
  end if;

  -- aborto pelo freio: fica registrado, com o estado no motivo (PRD 8.2)
  if pode_executar.execucao_id is not null then
    update public.automacao_execucao e
       set status = 'abortada_freio',
           motivo_aborto = v_estado::text
     where e.id = pode_executar.execucao_id;
  else
    insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status, motivo_aborto)
    values (pode_executar.automacao_id, pode_executar.familia_id, pg_catalog.clock_timestamp(),
            'abortada_freio', v_estado::text);
  end if;

  return false;
end;
$$;
comment on function privado.pode_executar(uuid, text, uuid) is 'Freio do motor (PRD 8.2, invariante 3): aplica privado.freio_permite à categoria da automação e ao estado da família (família mesclada: o mais restritivo entre ela e a que ficou). No aborto grava automacao_execucao com status abortada_freio e o estado em motivo_aborto (marca a execução passada em execucao_id, ou cria uma). Sem família: executa. Sem grant.';


-- =============================================================================
-- 4. privado.pode_enviar_mensagem (PRD 8.2)
--
-- A única porta de saída do adaptador de mensageria (P18) para mensagem à
-- família. Devolve {"pode": boolean, "motivo": text}; motivo nulo quando
-- pode. Ordem das checagens (o primeiro bloqueio é o motivo devolvido):
--   familia_obrigatoria, familia_inexistente, familia_mesclada,
--   categoria_interna, freio_<estado>, nao_contatar,
--   conversa_nao_iniciada_pela_familia, conteudo_ja_enviado_hoje,
--   janela_nao_configurada, fora_da_janela.
-- canal (opcional, acréscimo compatível): a exigência de conversa iniciada
-- pela família vale para todo canal menos cloud_api (ver cabeçalho).
-- Relógio: clock_timestamp() no fuso America/Sao_Paulo ("no instante do
-- envio", 8.2), não o início da transação.
-- =============================================================================

create function privado.pode_enviar_mensagem(
  familia_id uuid,
  categoria  public.categoria_automacao,
  canal      public.modo_mensageria default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_f       public.familia;
  v_agora   timestamp := pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo';
  v_hoje    date;
  v_janela  jsonb;
  v_inicio  time;
  v_fim     time;
  v_hora    time;
  v_dentro  boolean;
begin
  v_hoje := v_agora::date;
  v_hora := v_agora::time;

  if pode_enviar_mensagem.familia_id is null or pode_enviar_mensagem.categoria is null then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'familia_obrigatoria');
  end if;

  select f.* into v_f
  from public.familia f
  where f.id = pode_enviar_mensagem.familia_id
  for share;
  if not found then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'familia_inexistente');
  end if;

  if v_f.mesclada_em_id is not null then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'familia_mesclada');
  end if;

  if pode_enviar_mensagem.categoria = 'interna' then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'categoria_interna');
  end if;

  if not privado.freio_permite(pode_enviar_mensagem.categoria, v_f.estado_sensivel) then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'freio_' || v_f.estado_sensivel::text);
  end if;

  if v_f.nao_contatar then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'nao_contatar');
  end if;

  if pode_enviar_mensagem.canal is distinct from 'cloud_api'
     and not exists (select 1 from public.conversa c
                     where c.familia_id = v_f.id and c.iniciada_por = 'cliente') then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'conversa_nao_iniciada_pela_familia');
  end if;

  if pode_enviar_mensagem.categoria = 'conteudo' and (
       exists (select 1
               from public.automacao_execucao e
               join public.automacao a on a.id = e.automacao_id
               where e.familia_id = v_f.id
                 and a.categoria = 'conteudo'
                 and a.executor <> 'humano_tarefa'
                 and e.status = 'executada'
                 and (e.executada_em at time zone 'America/Sao_Paulo')::date = v_hoje)
    or exists (select 1
               from public.tarefa t
               join public.automacao a on a.id = t.origem_automacao_id
               where t.familia_id = v_f.id
                 and a.categoria = 'conteudo'
                 and t.status = 'concluida'
                 and (t.concluida_em at time zone 'America/Sao_Paulo')::date = v_hoje)) then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'conteudo_ja_enviado_hoje');
  end if;

  select p.valor into v_janela from public.parametro p where p.chave = 'agente_janela_envio';
  begin
    v_inicio := (v_janela ->> 'inicio')::time;
    v_fim    := (v_janela ->> 'fim')::time;
  exception
    when others then
      v_inicio := null;
      v_fim := null;
  end;
  if v_inicio is null or v_fim is null or v_inicio = v_fim then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'janela_nao_configurada');
  end if;

  -- janela [inicio, fim); se inicio > fim, a janela atravessa a meia-noite
  v_dentro := case
                when v_inicio < v_fim then v_hora >= v_inicio and v_hora < v_fim
                else v_hora >= v_inicio or v_hora < v_fim
              end;
  if not v_dentro then
    return pg_catalog.jsonb_build_object('pode', false, 'motivo', 'fora_da_janela');
  end if;

  return pg_catalog.jsonb_build_object('pode', true, 'motivo', null);
end;
$$;
comment on function privado.pode_enviar_mensagem(uuid, public.categoria_automacao, public.modo_mensageria) is 'Porta de saída de mensagem à família (PRD 8.2): {pode, motivo}. Freio (matriz 8.2; interna nunca fala com a família), nao_contatar, conversa iniciada pela família (todo canal menos cloud_api), uma mensagem de conteúdo por dia (fuso America/Sao_Paulo) e janela de parametro.agente_janela_envio no instante da chamada. Sem grant.';


-- =============================================================================
-- 5. Gatilhos do freio em familia
-- =============================================================================

-- --- 5.1 Colunas do freio só mudam pelo dono ----------------------------------
-- estado_sensivel, estado_sensivel_motivo, estado_sensivel_em e
-- estado_sensivel_por já estão fora de todo grant de authenticated (0007).
-- Este gatilho fecha o mesmo caminho para os demais papéis que passam por
-- cima de grant de coluna ou de RLS (service_role): quem não é o dono da
-- tabela só cria família em 'normal', sem motivo, e não altera essas
-- colunas. O dono (as funções security definer deste arquivo, migrations e
-- seed sintético) grava. Security invoker de propósito, para enxergar quem
-- fez o insert ou update, como privado.proteger_estado (P06).
create function privado.proteger_freio() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_dono boolean;
begin
  select pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER')
    into v_dono
  from pg_catalog.pg_class c
  where c.oid = tg_relid;

  if v_dono then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.estado_sensivel is distinct from 'normal'
       or new.estado_sensivel_motivo is not null
       or new.estado_sensivel_em is not null
       or new.estado_sensivel_por is not null then
      raise exception 'familia: nasce com o freio em normal; o freio só muda por privado.acionar_freio e privado.reverter_freio (PRD 8)'
        using errcode = '42501';
    end if;
  elsif new.estado_sensivel is distinct from old.estado_sensivel
     or new.estado_sensivel_motivo is distinct from old.estado_sensivel_motivo
     or new.estado_sensivel_em is distinct from old.estado_sensivel_em
     or new.estado_sensivel_por is distinct from old.estado_sensivel_por then
    raise exception 'familia: o freio só muda por privado.acionar_freio, privado.desfazer_freio, privado.justificar_freio e privado.reverter_freio (PRD 8)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
comment on function privado.proteger_freio() is 'Gatilho BEFORE INSERT OR UPDATE das colunas do freio em familia: papel que não é o dono (service_role, authenticated) só cria família em normal e nunca altera estado_sensivel, estado_sensivel_motivo, estado_sensivel_em ou estado_sensivel_por. O freio muda só pelas funções do P09 (PRD 8).';

create trigger proteger_freio
  before insert or update of estado_sensivel, estado_sensivel_motivo, estado_sensivel_em, estado_sensivel_por
  on public.familia
  for each row execute function privado.proteger_freio();

-- --- 5.2 Reavaliação das execuções agendadas -----------------------------------
-- "Quando o estado sai de normal, as execuções pendentes são reavaliadas na
-- hora e abortadas conforme a matriz" (8.2). Gatilho, e não passo dentro de
-- acionar_freio, para valer em qualquer caminho que mude o estado (inclusive
-- a eliminação do titular e o seed). Só aborta: subir de novo não
-- "desaborta" nada ("execuções abortadas não voltam sozinhas", 8.3).
-- A quantidade abortada fica em app.freio_abortadas nesta transação, para
-- acionar_freio devolver e registrar no evento.
create function privado.freio_reavaliar_execucoes() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_n integer;
begin
  with abortadas as (
    update public.automacao_execucao e
       set status = 'abortada_freio',
           motivo_aborto = new.estado_sensivel::text
      from public.automacao a
     where a.id = e.automacao_id
       and e.familia_id = new.id
       and e.status = 'agendada'
       and not privado.freio_permite(a.categoria, new.estado_sensivel)
    returning e.id
  )
  select count(*)::integer into v_n from abortadas;

  perform pg_catalog.set_config('app.freio_abortadas', v_n::text, true);
  return null;
end;
$$;
comment on function privado.freio_reavaliar_execucoes() is 'Gatilho AFTER UPDATE OF estado_sensivel em familia: aborta na hora as execuções agendadas da família que a matriz do freio não deixa mais passar (PRD 8.2), com o estado em motivo_aborto. Guarda a contagem em app.freio_abortadas.';

create trigger freio_reavaliar_execucoes
  after update of estado_sensivel on public.familia
  for each row
  when (new.estado_sensivel is distinct from old.estado_sensivel)
  execute function privado.freio_reavaliar_execucoes();


-- =============================================================================
-- 6. Acionar, desfazer, justificar e reverter (PRD 8.3)
-- =============================================================================

-- --- 6.1 privado.acionar_freio -------------------------------------------------
-- Quem chama:
--   * usuário do app (auth.uid() presente): precisa ter acesso à família
--     (privado.tem_acesso_familia). Motivo opcional; sem motivo, nasce uma
--     tarefa de justificativa para quem acionou. Pode desfazer durante
--     parametro.freio_desfazer_segundos.
--   * sistema (sem auth.uid(): agente, termo de alerta, automação): só um
--     papel de servidor (nunca anon nem authenticated sem usuário). Sem
--     "Desfazer" e sem tarefa de justificativa (8.3).
-- Só sobe o freio. Mesmo estado: nada muda (idempotente, o agente pode
-- repetir o aviso de perda). Estado 'normal' nunca é acionamento.
-- Família mesclada: o freio vai para a família que ficou.
create function privado.acionar_freio(
  familia_id uuid,
  estado     public.estado_sensivel,
  motivo     text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid         uuid := auth.uid();
  v_familia     uuid;
  v_f           public.familia;
  v_motivo      text := nullif(pg_catalog.btrim(acionar_freio.motivo), '');
  v_em          timestamptz := pg_catalog.clock_timestamp();
  v_param       jsonb;
  v_segundos    integer := 0;
  v_desfazer    timestamptz;
  v_abortadas   integer;
  v_evento      bigint;
  v_tarefa      uuid;
begin
  if acionar_freio.familia_id is null or acionar_freio.estado is null then
    raise exception 'acionar_freio: familia_id e estado são obrigatórios'
      using errcode = '22023';
  end if;
  if acionar_freio.estado = 'normal' then
    raise exception 'acionar_freio: normal não é acionamento; baixar o freio é privado.reverter_freio (PRD 8.3)'
      using errcode = '22023';
  end if;

  -- 1. quem pede pode?
  if v_uid is null then
    if coalesce(auth.role(), '') in ('anon', 'authenticated') then
      raise exception 'acionar_freio: requisição sem usuário identificado'
        using errcode = '42501';
    end if;
  elsif not privado.tem_acesso_familia(acionar_freio.familia_id) then
    raise exception 'acionar_freio: só quem tem acesso à família aciona o freio (PRD 8.3)'
      using errcode = '42501';
  end if;

  -- 2. família (a que ficou, se foi mesclada), travada até o fim
  v_familia := privado.familia_vigente(acionar_freio.familia_id);
  if v_familia is null then
    raise exception 'acionar_freio: família % não existe', acionar_freio.familia_id
      using errcode = 'P0002';
  end if;

  select f.* into v_f from public.familia f where f.id = v_familia for update;

  -- 3. só sobe
  if acionar_freio.estado = v_f.estado_sensivel then
    return pg_catalog.jsonb_build_object(
      'ok', true, 'familia_id', v_familia, 'de', v_f.estado_sensivel, 'para', acionar_freio.estado,
      'alterado', false);
  end if;
  if acionar_freio.estado < v_f.estado_sensivel then
    raise exception 'acionar_freio: o freio só sobe (% para % é descer); baixar é privado.reverter_freio, com coordenação ou diretoria (PRD 8.3)',
      v_f.estado_sensivel, acionar_freio.estado
      using errcode = '42501';
  end if;

  -- 4. prazo do "Desfazer": só para usuário do app (8.3 [v4.2])
  if v_uid is not null then
    select p.valor into v_param from public.parametro p where p.chave = 'freio_desfazer_segundos';
    if pg_catalog.jsonb_typeof(v_param) = 'number' then
      v_segundos := greatest(0, pg_catalog.floor((v_param #>> '{}')::numeric))::integer;
    end if;
    if v_segundos > 0 then
      v_desfazer := v_em + pg_catalog.make_interval(secs => v_segundos);
    end if;
  end if;

  -- 5. grava o estado (o gatilho reavalia as execuções agendadas)
  perform pg_catalog.set_config('app.freio_abortadas', '0', true);

  update public.familia f
     set estado_sensivel = acionar_freio.estado,
         estado_sensivel_motivo = v_motivo,
         estado_sensivel_em = v_em,
         estado_sensivel_por = v_uid
   where f.id = v_familia;

  v_abortadas := coalesce(nullif(pg_catalog.current_setting('app.freio_abortadas', true), '')::integer, 0);

  -- 6. linha do tempo: evento restrito (PRD 13). "anterior" guarda o que o
  --    "Desfazer" devolve.
  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (
    v_familia,
    'freio',
    v_f.estado_sensivel::text || ' → ' || acionar_freio.estado::text,
    pg_catalog.jsonb_build_object(
      'acao', 'acionar',
      'de', v_f.estado_sensivel,
      'para', acionar_freio.estado,
      'em', v_em,
      'por', v_uid,
      'sistema', v_uid is null,
      'origem', privado.origem_atual(),
      'tem_motivo', v_motivo is not null,
      'desfazer_ate', v_desfazer,
      'execucoes_abortadas', v_abortadas,
      'familia_pedida', acionar_freio.familia_id,
      'anterior', pg_catalog.jsonb_build_object(
        'motivo', v_f.estado_sensivel_motivo,
        'em', v_f.estado_sensivel_em,
        'por', v_f.estado_sensivel_por)
    ),
    true,
    v_uid
  )
  returning id into v_evento;

  -- 7. tarefa de justificativa para quem acionou sem motivo (8.3)
  if v_uid is not null and v_motivo is null then
    insert into public.tarefa (tipo, familia_id, responsavel_id, prioridade, titulo, payload)
    values (
      'outro', v_familia, v_uid, 'alta', 'justificar_freio',
      pg_catalog.jsonb_build_object('acao', 'justificar_freio', 'evento_id', v_evento, 'estado', acionar_freio.estado)
    )
    returning id into v_tarefa;
  end if;

  -- 8. log do acionamento (8.3 [v4.2]); o motivo vai como "[oculto]" + HMAC
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (
    v_uid,
    'freio_acionar',
    'familia',
    v_familia::text,
    pg_catalog.jsonb_build_object('estado_sensivel', v_f.estado_sensivel),
    privado.auditoria_recortar(
      pg_catalog.jsonb_build_object('estado_sensivel', acionar_freio.estado, 'motivo', v_motivo,
                                    'desfazer_ate', v_desfazer, 'execucoes_abortadas', v_abortadas),
      array['estado_sensivel', 'motivo', 'desfazer_ate', 'execucoes_abortadas'],
      array['motivo']),
    privado.origem_atual(),
    privado.ip_requisicao()
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'familia_id', v_familia,
    'de', v_f.estado_sensivel,
    'para', acionar_freio.estado,
    'alterado', true,
    'desfazer_ate', v_desfazer,
    'execucoes_abortadas', v_abortadas,
    'tarefa_justificativa_id', v_tarefa,
    'evento_id', v_evento);
end;
$$;
comment on function privado.acionar_freio(uuid, public.estado_sensivel, text) is 'Sobe o freio (PRD 8.3): usuário com acesso à família (privado.tem_acesso_familia) ou sistema sem usuário (agente, termo de alerta). Só sobe; mesmo estado não muda nada; família mesclada: vale a que ficou. Reavalia as execuções agendadas (gatilho), grava evento restrito e log freio_acionar, cria tarefa de justificativa quando o usuário não deu motivo e abre o "Desfazer" por parametro.freio_desfazer_segundos (só usuário). Sem grant: o app chega por api.acionar_freio.';


-- --- 6.2 privado.desfazer_freio (8.3 [v4.2], 20.6 decisão 1, O-07) -------------
-- Só quem acionou, só até desfazer_ate gravado no acionamento, e só se esse
-- acionamento ainda é a última mudança do freio da família. Volta ao estado,
-- motivo, data e autor anteriores, cancela a tarefa de justificativa e grava
-- evento e log. As execuções abortadas nesse intervalo continuam abortadas
-- (aparecem na ficha para a coordenação). Freio do agente ou do termo de
-- alerta nunca tem desfazer_ate.
create function privado.desfazer_freio(familia_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid     uuid := auth.uid();
  v_f       public.familia;
  v_ev      public.evento_familia;
  v_de      public.estado_sensivel;
  v_evento  bigint;
begin
  if v_uid is null then
    raise exception 'desfazer_freio: só quem acionou o freio desfaz (PRD 8.3)'
      using errcode = '42501';
  end if;
  if desfazer_freio.familia_id is null then
    raise exception 'desfazer_freio: familia_id é obrigatório'
      using errcode = '22023';
  end if;

  select f.* into v_f from public.familia f where f.id = desfazer_freio.familia_id for update;
  if not found then
    raise exception 'desfazer_freio: família % não existe', desfazer_freio.familia_id
      using errcode = 'P0002';
  end if;

  select e.* into v_ev
  from public.evento_familia e
  where e.familia_id = v_f.id and e.tipo = 'freio'
  order by e.id desc
  limit 1;

  if v_ev.id is null
     or v_ev.dados ->> 'acao' is distinct from 'acionar'
     or v_ev.dados ->> 'por' is distinct from v_uid::text
     or v_ev.dados ->> 'desfazer_ate' is null
     or v_f.estado_sensivel::text is distinct from v_ev.dados ->> 'para'
     or v_f.estado_sensivel_em is distinct from (v_ev.dados ->> 'em')::timestamptz
     or pg_catalog.clock_timestamp() > (v_ev.dados ->> 'desfazer_ate')::timestamptz then
    raise exception 'desfazer_freio: o "Desfazer" vale só para quem acionou, só dentro do prazo e só enquanto ninguém mudou o freio depois; agora a reversão é da coordenação ou da diretoria (PRD 8.3)'
      using errcode = '42501';
  end if;

  v_de := (v_ev.dados ->> 'de')::public.estado_sensivel;

  update public.familia f
     set estado_sensivel = v_de,
         estado_sensivel_motivo = v_ev.dados -> 'anterior' ->> 'motivo',
         estado_sensivel_em = (v_ev.dados -> 'anterior' ->> 'em')::timestamptz,
         estado_sensivel_por = (v_ev.dados -> 'anterior' ->> 'por')::uuid
   where f.id = v_f.id;

  update public.tarefa t
     set status = 'cancelada'
   where t.familia_id = v_f.id
     and t.payload ->> 'acao' = 'justificar_freio'
     and t.payload ->> 'evento_id' = v_ev.id::text
     and t.status in ('aberta', 'em_andamento');

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (
    v_f.id,
    'freio',
    v_f.estado_sensivel::text || ' → ' || v_de::text,
    pg_catalog.jsonb_build_object(
      'acao', 'desfazer',
      'de', v_f.estado_sensivel,
      'para', v_de,
      'em', pg_catalog.clock_timestamp(),
      'por', v_uid,
      'sistema', false,
      'origem', privado.origem_atual(),
      'evento_acionamento', v_ev.id,
      'execucoes_abortadas_mantidas', v_ev.dados -> 'execucoes_abortadas'),
    true,
    v_uid
  )
  returning id into v_evento;

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (
    v_uid, 'freio_desfazer', 'familia', v_f.id::text,
    pg_catalog.jsonb_build_object('estado_sensivel', v_f.estado_sensivel),
    pg_catalog.jsonb_build_object('estado_sensivel', v_de, 'evento_acionamento', v_ev.id),
    privado.origem_atual(),
    privado.ip_requisicao()
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'familia_id', v_f.id, 'de', v_f.estado_sensivel, 'para', v_de,
    'execucoes_abortadas_mantidas', v_ev.dados -> 'execucoes_abortadas', 'evento_id', v_evento);
end;
$$;
comment on function privado.desfazer_freio(uuid) is '"Desfazer" do freio (PRD 8.3 [v4.2], O-07): só quem acionou, até o desfazer_ate gravado no acionamento (parametro.freio_desfazer_segundos), e só se o acionamento ainda é a última mudança do freio. Volta ao estado anterior, cancela a tarefa de justificativa, grava evento restrito e log freio_desfazer. Execuções abortadas não voltam. Sem grant.';


-- --- 6.3 privado.justificar_freio ("o motivo pode vir depois", 8.3) ------------
-- Quem acionou, ou coordenação ou diretoria, grava o motivo e conclui a
-- tarefa de justificativa aberta da família.
create function privado.justificar_freio(familia_id uuid, motivo text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid     uuid := auth.uid();
  v_motivo  text := nullif(pg_catalog.btrim(justificar_freio.motivo), '');
  v_f       public.familia;
  v_n       integer;
begin
  if v_uid is null then
    raise exception 'justificar_freio: requisição sem usuário identificado'
      using errcode = '42501';
  end if;
  if justificar_freio.familia_id is null or v_motivo is null then
    raise exception 'justificar_freio: familia_id e motivo são obrigatórios'
      using errcode = '22023';
  end if;

  select f.* into v_f from public.familia f where f.id = justificar_freio.familia_id for update;
  if not found then
    raise exception 'justificar_freio: família % não existe', justificar_freio.familia_id
      using errcode = 'P0002';
  end if;
  if v_f.mesclada_em_id is not null then
    raise exception 'justificar_freio: família mesclada em %; justifique na família que ficou', v_f.mesclada_em_id
      using errcode = '22023';
  end if;
  if v_f.estado_sensivel = 'normal' then
    raise exception 'justificar_freio: a família está sem freio'
      using errcode = '22023';
  end if;
  if not (v_f.estado_sensivel_por is not distinct from v_uid
          or privado.tem_papel('coordenacao') or privado.tem_papel('diretoria')) then
    raise exception 'justificar_freio: só quem acionou, a coordenação ou a diretoria justificam (PRD 8.3)'
      using errcode = '42501';
  end if;

  update public.familia f set estado_sensivel_motivo = v_motivo where f.id = v_f.id;

  with concluidas as (
    update public.tarefa t
       set status = 'concluida',
           concluida_em = pg_catalog.clock_timestamp(),
           concluida_por = v_uid
     where t.familia_id = v_f.id
       and t.payload ->> 'acao' = 'justificar_freio'
       and t.status in ('aberta', 'em_andamento')
    returning t.id
  )
  select count(*)::integer into v_n from concluidas;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (
    v_f.id, 'freio', 'justificativa',
    pg_catalog.jsonb_build_object('acao', 'justificar', 'estado', v_f.estado_sensivel, 'em', pg_catalog.clock_timestamp(),
                                  'por', v_uid, 'origem', privado.origem_atual(), 'tarefas_concluidas', v_n),
    true, v_uid);

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (
    v_uid, 'freio_justificar', 'familia', v_f.id::text,
    null,
    privado.auditoria_recortar(pg_catalog.jsonb_build_object('motivo', v_motivo), array['motivo'], array['motivo']),
    privado.origem_atual(),
    privado.ip_requisicao()
  );

  return pg_catalog.jsonb_build_object('ok', true, 'familia_id', v_f.id, 'tarefas_concluidas', v_n);
end;
$$;
comment on function privado.justificar_freio(uuid, text) is 'Grava o motivo do freio depois do acionamento (PRD 8.3: justificar depois é aceitável): quem acionou, coordenação ou diretoria. Conclui a tarefa de justificativa, grava evento restrito e log freio_justificar (motivo como "[oculto]" + HMAC). Sem grant.';


-- --- 6.4 privado.reverter_freio (8.3) -----------------------------------------------
-- Só coordenação ou diretoria, com AAL2 e justificativa. Só desce. O agente
-- e o sistema nunca revertem (sem auth.uid(): recusado). Voltando a
-- 'normal', motivo, data e autor ficam nulos; para um estado intermediário,
-- a justificativa vira o motivo do novo estado. Execuções abortadas não
-- voltam.
create function privado.reverter_freio(familia_id uuid, estado public.estado_sensivel, justificativa text)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid     uuid := auth.uid();
  v_just    text := nullif(pg_catalog.btrim(reverter_freio.justificativa), '');
  v_f       public.familia;
  v_evento  bigint;
begin
  if v_uid is null
     or not (privado.tem_papel('coordenacao') or privado.tem_papel('diretoria')) then
    raise exception 'reverter_freio: a reversão exige perfil de coordenação ou diretoria (PRD 8.3)'
      using errcode = '42501';
  end if;
  if not privado.aal2() then
    raise exception 'reverter_freio: a reversão exige MFA (AAL2) (PRD 13)'
      using errcode = '42501';
  end if;
  if reverter_freio.familia_id is null or reverter_freio.estado is null then
    raise exception 'reverter_freio: familia_id e estado são obrigatórios'
      using errcode = '22023';
  end if;
  if v_just is null then
    raise exception 'reverter_freio: a reversão exige justificativa (PRD 8.3)'
      using errcode = '22023';
  end if;

  select f.* into v_f from public.familia f where f.id = reverter_freio.familia_id for update;
  if not found then
    raise exception 'reverter_freio: família % não existe', reverter_freio.familia_id
      using errcode = 'P0002';
  end if;
  if v_f.mesclada_em_id is not null then
    raise exception 'reverter_freio: família mesclada em %; o freio vale na família que ficou', v_f.mesclada_em_id
      using errcode = '22023';
  end if;
  if reverter_freio.estado >= v_f.estado_sensivel then
    raise exception 'reverter_freio: reverter só desce o freio (% para %); subir é privado.acionar_freio',
      v_f.estado_sensivel, reverter_freio.estado
      using errcode = '22023';
  end if;

  update public.familia f
     set estado_sensivel = reverter_freio.estado,
         estado_sensivel_motivo = case when reverter_freio.estado = 'normal' then null else v_just end,
         estado_sensivel_em = case when reverter_freio.estado = 'normal' then null else pg_catalog.clock_timestamp() end,
         estado_sensivel_por = case when reverter_freio.estado = 'normal' then null else v_uid end
   where f.id = v_f.id;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (
    v_f.id,
    'freio',
    v_f.estado_sensivel::text || ' → ' || reverter_freio.estado::text,
    pg_catalog.jsonb_build_object(
      'acao', 'reverter',
      'de', v_f.estado_sensivel,
      'para', reverter_freio.estado,
      'em', pg_catalog.clock_timestamp(),
      'por', v_uid,
      'sistema', false,
      'origem', privado.origem_atual(),
      'justificativa', v_just),
    true,
    v_uid
  )
  returning id into v_evento;

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (
    v_uid, 'freio_reverter', 'familia', v_f.id::text,
    pg_catalog.jsonb_build_object('estado_sensivel', v_f.estado_sensivel),
    privado.auditoria_recortar(
      pg_catalog.jsonb_build_object('estado_sensivel', reverter_freio.estado, 'justificativa', v_just),
      array['estado_sensivel', 'justificativa'],
      array['justificativa']),
    privado.origem_atual(),
    privado.ip_requisicao()
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'familia_id', v_f.id, 'de', v_f.estado_sensivel, 'para', reverter_freio.estado, 'evento_id', v_evento);
end;
$$;
comment on function privado.reverter_freio(uuid, public.estado_sensivel, text) is 'Baixa o freio (PRD 8.3): só coordenação ou diretoria, com AAL2 e justificativa; só desce; sistema e agente nunca revertem. Grava evento restrito e log freio_reverter (justificativa como "[oculto]" + HMAC). Execuções abortadas não voltam. Sem grant: o app chega por api.reverter_freio.';


-- =============================================================================
-- 7. Wrappers do app (PRD 5.2, ADR 0002 seções 5 e 6)
--
-- Acionar, desfazer e justificar: comercial, enfermeira, financeiro,
-- coordenação e diretoria (marketing não lê família), AAL pela regra do
-- perfil (enfermeira, financeiro, coordenação e diretoria em AAL2; comercial
-- puro em AAL1, para o botão de um toque no celular). O acesso à família e
-- quem acionou são conferidos pela função de privado. Reverter: coordenação
-- e diretoria, AAL2.
-- =============================================================================

create function api.acionar_freio(familia_id uuid, estado public.estado_sensivel, motivo text default null)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.acionar_freio(acionar_freio.familia_id, acionar_freio.estado, acionar_freio.motivo);
end;
$$;
comment on function api.acionar_freio(uuid, public.estado_sensivel, text) is 'Botão de freio do app (PRD 8.3): papel com acesso a família, AAL pela regra do perfil; chama privado.acionar_freio. ADR 0002 seção 5.';

create function api.desfazer_freio(familia_id uuid)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.desfazer_freio(desfazer_freio.familia_id);
end;
$$;
comment on function api.desfazer_freio(uuid) is '"Desfazer" do aviso efêmero (PRD 8.3 [v4.2]): chama privado.desfazer_freio, que confere quem acionou e o prazo. ADR 0002 seção 5.';

create function api.justificar_freio(familia_id uuid, motivo text)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.justificar_freio(justificar_freio.familia_id, justificar_freio.motivo);
end;
$$;
comment on function api.justificar_freio(uuid, text) is 'Motivo do freio depois do acionamento (PRD 8.3): chama privado.justificar_freio (quem acionou, coordenação ou diretoria). ADR 0002 seção 5.';

create function api.reverter_freio(familia_id uuid, estado public.estado_sensivel, justificativa text)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.reverter_freio(reverter_freio.familia_id, reverter_freio.estado, reverter_freio.justificativa);
end;
$$;
comment on function api.reverter_freio(uuid, public.estado_sensivel, text) is 'Reversão do freio (PRD 8.3): coordenação ou diretoria, AAL2, com justificativa; chama privado.reverter_freio. ADR 0002 seção 5.';


-- =============================================================================
-- 8. Execute
--
-- privado: nenhuma função nova para authenticated (a lista do PRD 11.10
-- continua com quatro). api: as quatro para authenticated, nada para anon
-- nem service_role (ADR 0002 seção 6, conferido pelo teste 007).
-- =============================================================================

revoke execute on function privado.freio_permite(public.categoria_automacao, public.estado_sensivel) from public, anon, authenticated, service_role;
revoke execute on function privado.tem_acesso_familia(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.familia_vigente(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.pode_executar(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.pode_enviar_mensagem(uuid, public.categoria_automacao, public.modo_mensageria) from public, anon, authenticated, service_role;
revoke execute on function privado.proteger_freio() from public, anon, authenticated, service_role;
revoke execute on function privado.freio_reavaliar_execucoes() from public, anon, authenticated, service_role;
revoke execute on function privado.acionar_freio(uuid, public.estado_sensivel, text) from public, anon, authenticated, service_role;
revoke execute on function privado.desfazer_freio(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.justificar_freio(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function privado.reverter_freio(uuid, public.estado_sensivel, text) from public, anon, authenticated, service_role;

revoke execute on function api.acionar_freio(uuid, public.estado_sensivel, text) from public, anon, service_role;
revoke execute on function api.desfazer_freio(uuid) from public, anon, service_role;
revoke execute on function api.justificar_freio(uuid, text) from public, anon, service_role;
revoke execute on function api.reverter_freio(uuid, public.estado_sensivel, text) from public, anon, service_role;

grant execute on function api.acionar_freio(uuid, public.estado_sensivel, text)  to authenticated;
grant execute on function api.desfazer_freio(uuid)                               to authenticated;
grant execute on function api.justificar_freio(uuid, text)                       to authenticated;
grant execute on function api.reverter_freio(uuid, public.estado_sensivel, text) to authenticated;
