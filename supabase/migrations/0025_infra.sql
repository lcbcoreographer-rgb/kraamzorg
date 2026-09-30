-- =============================================================================
-- 0025_infra.sql · P11 (Web Push), P14 (saúde do sistema) e P18b (Cloud API)
--
-- Migration nova, para revisão humana do SQL antes de `supabase db push`
-- (CLAUDE.md). Nada aqui muda estágio, dado clínico ou dado de família.
--
-- P18b · Cloud API oficial do WhatsApp (PRD 4.1 D-08, 14, 22.1 T-01)
--   1. privado.modelo_whatsapp: cadastro dos modelos de mensagem aprovados
--      pela Meta (nome, idioma, categoria, variáveis, texto exato submetido e
--      status). O texto de um modelo submetido ou aprovado não muda mais: a
--      correção é um modelo novo. Cada modelo aponta para a chave de
--      mensagem_modelo que ele substitui fora da janela de 24 horas.
--   2. agente.registrar_followup ganha o wamid; agente.janela_followup(execucao_id): para o fluxo 3 (entrada B) dizer
--      se a família está dentro da janela e, fora dela, devolver o modelo
--      aprovado e os parâmetros já resolvidos. Fora da janela nunca devolve
--      texto livre.
--   3. privado.mensagem_status + public.mensagem_registrar_status (só
--      service_role, webhook da Cloud API): entregue, lida ou falhou, uma
--      linha por estado, append-only. api.status_entrega_conversa lê.
--   4. api.modelos_whatsapp, api.modelo_whatsapp_aprovado,
--      api.whatsapp_janela_horas, api.salvar_modelo_whatsapp e
--      api.atualizar_status_modelo_whatsapp.
--
-- P11 · Web Push
--   5. privado.inscricao_push (o PRD 6.7 ainda não lista a tabela; em privado
--      ela não mexe na lista fechada de 53 tabelas de public, ver docs/sessoes/P11.md),
--      api.registrar_inscricao_push / api.remover_inscricao_push (a própria
--      pessoa) e public.inscricoes_push / public.inscricao_push_expirada (só
--      service_role, o servidor que envia o push).
--
-- P14 · Observabilidade
--   6. privado.saude_webhook + public.saude_registrar_webhook e
--      public.saude_sistema (só service_role): o que /api/saude confere.
--      Só datas e contagens, nenhum dado de pessoa.
--
-- Enums e tabelas novos ficam em privado (os testes 003 e 004 fecham a lista das
-- 53 tabelas e dos 49 enums de public, e a convenção da 0010, da 0011 e da 0018
-- é a mesma). Nada disto é exposto pelo PostgREST: o app usa só as funções. Fonte das colunas sensíveis do log:
-- 'sessao_p05', a fonte genérica de acréscimo por leitura mais segura, para
-- esta migration não reescrever a constraint que outras trilhas também usam.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Enums
-- -----------------------------------------------------------------------------

create type privado.status_modelo_whatsapp as enum
  ('rascunho', 'submetido', 'aprovado', 'rejeitado', 'pausado', 'desativado');
create type privado.categoria_modelo_whatsapp as enum
  ('utilidade', 'marketing', 'autenticacao');
create type privado.status_entrega as enum
  ('enviada', 'entregue', 'lida', 'falhou');


-- =============================================================================
-- 1. P18b · privado.modelo_whatsapp
-- =============================================================================

-- {{1}} a {{n}} no texto, sem buraco e sem repetir posição, batendo com a
-- lista de variáveis (a Meta numera as variáveis do corpo assim).
create function privado.modelo_whatsapp_placeholders_conferem(texto text, variaveis text[]) returns boolean
  language plpgsql
  immutable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_n    integer := coalesce(pg_catalog.cardinality(variaveis), 0);
  v_max  integer;
  v_dist integer;
begin
  select coalesce(max(m.g[1]::integer), 0), count(distinct m.g[1])
    into v_max, v_dist
  from pg_catalog.regexp_matches(texto, '\{\{([1-9][0-9]*)\}\}', 'g') as m(g);
  return v_dist = v_n and v_max = v_n;
end;
$$;
comment on function privado.modelo_whatsapp_placeholders_conferem(text, text[]) is '[P18b] Verdadeiro se o texto usa exatamente {{1}} a {{n}}, sem repetir posição nem pular número, e n é o tamanho da lista de variáveis. Usada na constraint de modelo_whatsapp. Sem grant.';

create table privado.modelo_whatsapp (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfil(id),
  mensagem_chave text not null references public.mensagem_modelo(chave),   -- o texto de família que este modelo substitui fora da janela
  nome_meta text not null check (nome_meta ~ '^[a-z0-9_]{1,255}$'),
  idioma text not null default 'pt_BR' check (idioma ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  categoria privado.categoria_modelo_whatsapp not null,
  variaveis text[] not null default '{}',       -- nomes das variáveis em ordem: {{1}} é a primeira
  valores_padrao jsonb not null default '{}'::jsonb,  -- valor usado quando a família não tem o dado (a Meta não aceita parâmetro vazio)
  texto text not null,                          -- o texto exato submetido à Meta, com {{1}}, {{2}}
  status privado.status_modelo_whatsapp not null default 'rascunho',
  aprovado_em timestamptz,
  motivo_rejeicao text,
  unique (nome_meta, idioma),
  check (pg_catalog.btrim(texto) <> ''),
  check (privado.modelo_whatsapp_placeholders_conferem(texto, variaveis)),
  check (pg_catalog.jsonb_typeof(valores_padrao) = 'object')
);
comment on table privado.modelo_whatsapp is '[P18b] Cadastro dos modelos de mensagem da Cloud API do WhatsApp (PRD 4.1 D-08, 14). Fora da janela de 24 horas só sai modelo com status aprovado. O texto de modelo submetido ou aprovado não muda (gatilho): correção é modelo novo. Escrita só pelas funções api.*.';
comment on column privado.modelo_whatsapp.mensagem_chave is 'Chave de mensagem_modelo que este modelo substitui fora da janela (followup_d1_pos_pdf, regua_28_34, ...).';
comment on column privado.modelo_whatsapp.variaveis is 'Nomes das variáveis na ordem dos parâmetros: a primeira é {{1}}. Nomes conhecidos pelo banco: nome. Os demais precisam de valor em valores_padrao.';
comment on column privado.modelo_whatsapp.valores_padrao is 'Valor usado quando a família não tem o dado (por exemplo, nome sem cadastro). A Meta recusa parâmetro vazio.';
comment on column privado.modelo_whatsapp.texto is 'Texto exato submetido à Meta, com {{1}}, {{2}}. Nenhum texto de modelo aprovado é editado fora deste cadastro.';

create index on privado.modelo_whatsapp (mensagem_chave, status);
create index on privado.modelo_whatsapp (criado_por);

create trigger tocar_atualizado_em before update on privado.modelo_whatsapp
  for each row execute function privado.tocar_atualizado_em();

alter table privado.modelo_whatsapp enable row level security;
revoke all on table privado.modelo_whatsapp from anon, authenticated, service_role;

-- Regras do ciclo de vida: o texto submetido não muda, modelo aprovado não se
-- apaga, e o status só anda pelas transições da Meta.
create function privado.modelo_whatsapp_guardar() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_ok boolean;
begin
  if tg_op = 'DELETE' then
    if old.aprovado_em is not null or old.status <> 'rascunho' then
      raise exception 'modelo_whatsapp: modelo submetido ou aprovado não se apaga; desative-o'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'rascunho' or new.aprovado_em is not null then
      raise exception 'modelo_whatsapp: todo modelo nasce como rascunho'
        using errcode = '22023';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status in ('submetido', 'aprovado', 'pausado', 'desativado')
     and (new.texto is distinct from old.texto
          or new.nome_meta is distinct from old.nome_meta
          or new.idioma is distinct from old.idioma
          or new.categoria is distinct from old.categoria
          or new.variaveis is distinct from old.variaveis
          or new.mensagem_chave is distinct from old.mensagem_chave) then
    raise exception 'modelo_whatsapp: o texto submetido à Meta não muda; crie outro modelo'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    v_ok := case old.status
      when 'rascunho'   then new.status = 'submetido'
      when 'submetido'  then new.status in ('aprovado', 'rejeitado')
      when 'rejeitado'  then new.status = 'rascunho'
      when 'aprovado'   then new.status in ('pausado', 'desativado')
      when 'pausado'    then new.status in ('aprovado', 'desativado')
      else false
    end;
    if not v_ok then
      raise exception 'modelo_whatsapp: transição % para % não existe', old.status, new.status
        using errcode = '22023';
    end if;
    if new.status = 'aprovado' then
      new.aprovado_em := coalesce(old.aprovado_em, pg_catalog.now());
      new.motivo_rejeicao := null;
    end if;
  elsif new.aprovado_em is distinct from old.aprovado_em then
    raise exception 'modelo_whatsapp: aprovado_em só muda com a aprovação'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function privado.modelo_whatsapp_guardar() is '[P18b] Gatilho de modelo_whatsapp: nasce rascunho; texto, nome, idioma, categoria, variáveis e chave param de mudar ao submeter; aprovado nunca se apaga; status só anda por rascunho, submetido, aprovado ou rejeitado, pausado, desativado. Sem grant.';

create trigger guardar before insert or update or delete on privado.modelo_whatsapp
  for each row execute function privado.modelo_whatsapp_guardar();

create trigger auditar after insert or update or delete on privado.modelo_whatsapp
  for each row execute function privado.auditar('id');


-- Renderiza o texto do modelo com os parâmetros na ordem.
create function privado.modelo_whatsapp_renderizar(texto text, valores text[]) returns text
  language plpgsql
  immutable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_texto text := texto;
  i       integer;
begin
  for i in 1 .. coalesce(pg_catalog.cardinality(valores), 0) loop
    v_texto := pg_catalog.replace(v_texto, '{{' || i::text || '}}', valores[i]);
  end loop;
  return v_texto;
end;
$$;
comment on function privado.modelo_whatsapp_renderizar(text, text[]) is '[P18b] Troca {{1}}, {{2}} pelos valores, na ordem. Sem grant.';

-- Valores dos parâmetros de um modelo para uma conversa. Devolve nulo se algum
-- parâmetro não tem valor (o modelo não pode sair com parâmetro vazio).
create function privado.modelo_whatsapp_valores(p_modelo privado.modelo_whatsapp, p_conversa_id uuid) returns text[]
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_nome    text;
  v_valores text[] := '{}';
  v_valor   text;
begin
  foreach v_nome in array p_modelo.variaveis loop
    v_valor := case when v_nome = 'nome' then privado.agente_primeiro_nome(p_conversa_id) end;
    v_valor := coalesce(v_valor, p_modelo.valores_padrao ->> v_nome);
    v_valor := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(v_valor, ''), '[\r\n\t]+', ' ', 'g')), '');
    if v_valor is null then
      return null;
    end if;
    v_valores := v_valores || v_valor;
  end loop;
  return v_valores;
end;
$$;
comment on function privado.modelo_whatsapp_valores(privado.modelo_whatsapp, uuid) is '[P18b] Parâmetros do modelo na ordem: nome vem da conversa (primeiro nome), o resto de valores_padrao; sem quebra de linha nem tabulação. Nulo se algum parâmetro ficaria vazio. Sem grant.';


-- =============================================================================
-- 2. P18b · agente.janela_followup (fluxo 3, entrada B)
-- =============================================================================

create function agente.janela_followup(execucao_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_rec     public.automacao_execucao;
  v_conv    public.conversa;
  v_horas   numeric := privado.agente_parametro_numero('whatsapp_janela_horas');
  v_chave   text;
  v_dentro  boolean;
  v_modelo  privado.modelo_whatsapp;
  v_valores text[];
begin
  perform privado.agente_contexto();

  select e.* into v_rec
  from public.automacao_execucao e
  where e.id = janela_followup.execucao_id
    and e.automacao_id = 'followup_d1'
    and e.status = 'agendada'
    and coalesce(e.payload, '{}'::jsonb) ? 'reservada_em';
  if v_rec.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'execucao_invalida');
  end if;

  select c.* into v_conv from public.conversa c where c.id = (v_rec.payload ->> 'conversa_id')::uuid;
  if v_conv.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_inexistente');
  end if;

  -- Sem o parâmetro ou sem mensagem da família, conta como fora da janela: o
  -- caminho seguro é o modelo aprovado, nunca o texto livre.
  v_dentro := v_horas is not null and v_horas > 0
              and v_conv.ultima_entrada_em is not null
              and v_conv.ultima_entrada_em >= pg_catalog.now() - pg_catalog.make_interval(secs => (v_horas * 3600)::double precision);

  if v_dentro then
    return pg_catalog.jsonb_build_object('ok', true, 'dentro_janela', true, 'modelo', null);
  end if;

  v_chave := v_rec.payload ->> 'chave_texto';
  select m.* into v_modelo
  from privado.modelo_whatsapp m
  where m.mensagem_chave = v_chave and m.status = 'aprovado' and m.idioma = 'pt_BR'
  order by m.aprovado_em desc, m.id
  limit 1;
  if v_modelo.id is null then
    return pg_catalog.jsonb_build_object('ok', true, 'dentro_janela', false, 'modelo', null, 'motivo', 'sem_modelo_aprovado');
  end if;

  v_valores := privado.modelo_whatsapp_valores(v_modelo, v_conv.id);
  if v_valores is null then
    return pg_catalog.jsonb_build_object('ok', true, 'dentro_janela', false, 'modelo', null, 'motivo', 'parametro_sem_valor');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'dentro_janela', false,
    'telefone', pg_catalog.regexp_replace(coalesce(v_conv.telefone_e164, ''), '[^0-9]', '', 'g'),
    'modelo', pg_catalog.jsonb_build_object(
      'nome', v_modelo.nome_meta,
      'idioma', v_modelo.idioma,
      'categoria', v_modelo.categoria::text,
      'parametros', pg_catalog.to_jsonb(v_valores),
      'texto', privado.modelo_whatsapp_renderizar(v_modelo.texto, v_valores)));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.janela_followup(uuid) is '[P18b] Fluxo 3, entrada B: para uma execução de followup_d1 já reservada, diz se a última mensagem da família está dentro da janela de parametro.whatsapp_janela_horas. Dentro: {ok, dentro_janela: true}. Fora: devolve o telefone (só dígitos, a Cloud API não usa jid) e o modelo aprovado (modelo_whatsapp da chave_texto da execução) com os parâmetros resolvidos e o texto renderizado; sem modelo aprovado ou com parâmetro sem valor, devolve modelo nulo e o motivo, e nada de texto livre sai. Chave é a execução reservada, não parâmetro do modelo.';

revoke execute on function agente.janela_followup(uuid) from public, anon, authenticated, service_role;
grant execute on function agente.janela_followup(uuid) to n8n_agente;


-- registrar_followup ganha o id da mensagem na Meta (wamid), para o webhook de
-- status de entrega achar a mensagem. A função de três argumentos (0014) vira
-- um invólucro da de quatro, que guarda o corpo inteiro: uma implementação só.
-- Só a Cloud API passa o id (a UAZAPI segue como antes).
create function agente.registrar_followup(execucao_id uuid, texto text, ok boolean, wa_message_id text) returns jsonb
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
  v_wamid      text := nullif(pg_catalog.btrim(registrar_followup.wa_message_id), '');
  v_mensagem   uuid;
  v_tentativas integer;
  v_sugerido   text;
begin
  perform privado.agente_contexto();
  select e.* into v_e from public.automacao_execucao e
  where e.id = registrar_followup.execucao_id and e.automacao_id = 'followup_d1'
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'execucao_nao_encontrada');
  end if;
  if v_e.status <> 'agendada' or not (coalesce(v_e.payload, '{}'::jsonb) ? 'reservada_em') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'execucao_nao_reservada');
  end if;
  v_conversa := (v_e.payload ->> 'conversa_id')::uuid;

  if coalesce(registrar_followup.ok, false) and v_texto is not null then
    insert into public.mensagem (conversa_id, direcao, enviado_por, tipo, conteudo, wa_message_id)
    values (v_conversa, 'saida', 'ia', 'texto', v_texto, v_wamid)
    returning id into v_mensagem;
    update public.conversa c set ultima_saida_em = pg_catalog.now() where c.id = v_conversa;
    update public.automacao_execucao e
       set status = 'executada',
           executada_em = pg_catalog.clock_timestamp(),
           payload = e.payload || pg_catalog.jsonb_build_object('mensagem_id', v_mensagem)
     where e.id = v_e.id;
    update public.oportunidade o
       set cadencia_etapa = greatest(o.cadencia_etapa, 1)
     where o.id = (privado.agente_oportunidade_aberta(v_e.familia_id)).id;
    if v_e.familia_id is not null then
      insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
      values (v_e.familia_id, 'followup', 'followup_d1',
              pg_catalog.jsonb_build_object('execucao_id', v_e.id, 'conversa_id', v_conversa), false);
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
  v_sugerido := privado.aplicar_texto(privado.agente_texto(coalesce(v_e.payload ->> 'chave_texto', 'followup_d1_pos_abertura'), true),
                                      privado.agente_primeiro_nome(v_conversa), '{}'::jsonb);
  insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload, origem_automacao_id)
  values ('followup_comercial', v_e.familia_id, 'comercial', 'normal', 'followup_d1_nao_saiu',
          pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
            'execucao_id', v_e.id, 'conversa_id', v_conversa, 'texto_sugerido', v_sugerido)),
          'followup_d1');
  return pg_catalog.jsonb_build_object('ok', true, 'status', 'falhou', 'tentativas', v_tentativas, 'tarefa_criada', true);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_followup(uuid, text, boolean, text) is '[P18b] Mesmo corpo de registrar_followup (Apêndice A, PRD 19.4 nó 41) com o id da mensagem na Meta (wamid) gravado em mensagem.wa_message_id quando o follow-up saiu pela Cloud API, para o webhook de status de entrega achar a mensagem. Sem o id (UAZAPI), nulo.';

create or replace function agente.registrar_followup(execucao_id uuid, texto text, ok boolean) returns jsonb
  language sql
  volatile
  security definer
  set search_path = ''
  as $$ select agente.registrar_followup(registrar_followup.execucao_id, registrar_followup.texto, registrar_followup.ok, null::text) $$;
comment on function agente.registrar_followup(uuid, text, boolean) is 'Apêndice A e PRD 19.4 nó 41: fecha a execução reservada. Desde a 0025 é invólucro da versão de quatro argumentos (wa_message_id nulo); o corpo mora lá.';

revoke execute on function agente.registrar_followup(uuid, text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function agente.registrar_followup(uuid, text, boolean, text) to n8n_agente;


-- =============================================================================
-- 3. P18b · status de entrega (webhook da Cloud API)
-- =============================================================================

create table privado.mensagem_status (
  id bigserial primary key,
  criado_em timestamptz not null default pg_catalog.now(),
  mensagem_id uuid not null references public.mensagem(id),
  status privado.status_entrega not null,
  ocorrido_em timestamptz not null,
  codigo_erro text check (codigo_erro is null or codigo_erro ~ '^[0-9]{1,10}$'),
  unique (mensagem_id, status)
);
comment on table privado.mensagem_status is '[P18b] Estado de entrega de cada mensagem enviada pela Cloud API (enviada, entregue, lida, falhou), uma linha por estado, append-only. Só o número do erro da Meta, nunca o texto. Escrita por public.mensagem_registrar_status; leitura por api.status_entrega_conversa.';
alter table privado.mensagem_status enable row level security;
revoke all on table privado.mensagem_status from anon, authenticated, service_role;

create function privado.mensagem_status_somente_insercao() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  raise exception 'mensagem_status é só de inclusão (P18b)' using errcode = '42501';
end;
$$;
comment on function privado.mensagem_status_somente_insercao() is '[P18b] Gatilho: recusa UPDATE, DELETE e TRUNCATE em privado.mensagem_status. Sem grant.';
create trigger somente_insercao before update or delete on privado.mensagem_status
  for each row execute function privado.mensagem_status_somente_insercao();
create trigger somente_insercao_truncate before truncate on privado.mensagem_status
  for each statement execute function privado.mensagem_status_somente_insercao();

create function public.mensagem_registrar_status(
  p_wa_message_id text, p_status text, p_ocorrido_em timestamptz, p_codigo_erro text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_msg    uuid;
  v_status privado.status_entrega;
  v_quando timestamptz := coalesce(p_ocorrido_em, pg_catalog.now());
  v_id     bigint;
begin
  v_status := case p_status
    when 'sent' then 'enviada'
    when 'delivered' then 'entregue'
    when 'read' then 'lida'
    when 'failed' then 'falhou'
  end;
  if v_status is null then
    return pg_catalog.jsonb_build_object('registrado', false, 'motivo', 'status_desconhecido');
  end if;

  select m.id into v_msg from public.mensagem m
  where p_wa_message_id is not null and m.wa_message_id = p_wa_message_id;
  if v_msg is null then
    return pg_catalog.jsonb_build_object('registrado', false, 'motivo', 'mensagem_nao_encontrada');
  end if;

  if v_quando > pg_catalog.now() + interval '5 minutes' then
    v_quando := pg_catalog.now();
  end if;

  insert into privado.mensagem_status (mensagem_id, status, ocorrido_em, codigo_erro)
  values (v_msg, v_status, v_quando,
          case when p_codigo_erro ~ '^[0-9]{1,10}$' then p_codigo_erro end)
  on conflict (mensagem_id, status) do nothing
  returning id into v_id;

  return pg_catalog.jsonb_build_object('registrado', v_id is not null,
                                       'motivo', case when v_id is null then 'ja_registrado' end);
end;
$$;
comment on function public.mensagem_registrar_status(text, text, timestamptz, text) is '[P18b item 4] Webhook da Cloud API (só service_role, depois da assinatura X-Hub-Signature-256): grava sent, delivered, read ou failed da mensagem pelo wa_message_id. Idempotente. Só o número do erro.';

revoke execute on function public.mensagem_registrar_status(text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.mensagem_registrar_status(text, text, timestamptz, text) to service_role;

create function api.status_entrega_conversa(p_conversa_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'mensagem_id', m.id,
             'estados', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'status', s.status::text, 'ocorrido_em', s.ocorrido_em, 'codigo_erro', s.codigo_erro)
                         order by s.ocorrido_em)
                         from privado.mensagem_status s where s.mensagem_id = m.id))
           order by m.enviada_em)
    from public.mensagem m
    where m.conversa_id = p_conversa_id
      and exists (select 1 from privado.mensagem_status s where s.mensagem_id = m.id)
  ), '[]'::jsonb);
end;
$$;
comment on function api.status_entrega_conversa(uuid) is '[P18b item 4] Estados de entrega (enviada, entregue, lida, falhou) das mensagens de uma conversa. Comercial, coordenação e diretoria, AAL2.';


-- =============================================================================
-- 4. P18b · api dos modelos
-- =============================================================================

create function api.modelos_whatsapp() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', m.id, 'mensagem_chave', m.mensagem_chave, 'nome_meta', m.nome_meta, 'idioma', m.idioma,
             'categoria', m.categoria::text, 'variaveis', m.variaveis, 'valores_padrao', m.valores_padrao,
             'texto', m.texto, 'status', m.status::text, 'aprovado_em', m.aprovado_em,
             'motivo_rejeicao', m.motivo_rejeicao)
           order by m.mensagem_chave, m.nome_meta, m.idioma)
    from privado.modelo_whatsapp m
  ), '[]'::jsonb);
end;
$$;
comment on function api.modelos_whatsapp() is '[P18b item 2] Cadastro dos modelos da Cloud API com texto exato e status. Comercial, coordenação e diretoria, AAL2.';

create function api.modelo_whatsapp_aprovado(p_mensagem_chave text, p_idioma text default 'pt_BR') returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_m privado.modelo_whatsapp;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  select m.* into v_m
  from privado.modelo_whatsapp m
  where m.mensagem_chave = p_mensagem_chave and m.idioma = p_idioma and m.status = 'aprovado'
  order by m.aprovado_em desc, m.id
  limit 1;
  if v_m.id is null then
    return null;
  end if;
  return pg_catalog.jsonb_build_object(
    'id', v_m.id, 'mensagem_chave', v_m.mensagem_chave, 'nome_meta', v_m.nome_meta, 'idioma', v_m.idioma,
    'categoria', v_m.categoria::text, 'variaveis', v_m.variaveis, 'valores_padrao', v_m.valores_padrao,
    'texto', v_m.texto);
end;
$$;
comment on function api.modelo_whatsapp_aprovado(text, text) is '[P18b item 1] O modelo com status aprovado para uma chave de mensagem_modelo, ou nulo. É o que o adaptador cloud_api usa fora da janela de 24 horas; modelo em outro status nunca é devolvido. Comercial, coordenação e diretoria, AAL2.';

create function api.whatsapp_janela_horas() returns numeric
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  return privado.agente_parametro_numero('whatsapp_janela_horas');
end;
$$;
comment on function api.whatsapp_janela_horas() is '[P18b item 1] parametro.whatsapp_janela_horas para o adaptador cloud_api do app decidir entre texto livre e modelo. Nulo se o parâmetro não existe (o adaptador então trata tudo como fora da janela). Comercial, coordenação e diretoria, AAL2; a tabela parametro só a diretoria lê.';

create function api.salvar_modelo_whatsapp(
  p_id uuid, p_mensagem_chave text, p_nome_meta text, p_idioma text, p_categoria text,
  p_variaveis text[], p_texto text, p_valores_padrao jsonb default '{}'::jsonb
) returns uuid
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_id uuid;
begin
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);
  if p_id is null then
    insert into privado.modelo_whatsapp (criado_por, mensagem_chave, nome_meta, idioma, categoria, variaveis, valores_padrao, texto)
    values (auth.uid(), p_mensagem_chave, p_nome_meta, coalesce(p_idioma, 'pt_BR'), p_categoria::privado.categoria_modelo_whatsapp,
            coalesce(p_variaveis, '{}'), coalesce(p_valores_padrao, '{}'::jsonb), p_texto)
    returning id into v_id;
  else
    update privado.modelo_whatsapp m
       set mensagem_chave = p_mensagem_chave, nome_meta = p_nome_meta, idioma = coalesce(p_idioma, m.idioma),
           categoria = p_categoria::privado.categoria_modelo_whatsapp, variaveis = coalesce(p_variaveis, '{}'),
           valores_padrao = coalesce(p_valores_padrao, '{}'::jsonb), texto = p_texto
     where m.id = p_id
    returning m.id into v_id;
    if v_id is null then
      raise exception 'modelo_whatsapp: modelo não encontrado' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;
comment on function api.salvar_modelo_whatsapp(uuid, text, text, text, text, text[], text, jsonb) is '[P18b item 2] Cria ou edita um rascunho de modelo da Cloud API. Modelo submetido ou aprovado não muda (gatilho). Diretoria, AAL2.';

create function api.atualizar_status_modelo_whatsapp(p_id uuid, p_status text, p_motivo text default null) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);
  update privado.modelo_whatsapp m
     set status = p_status::privado.status_modelo_whatsapp,
         motivo_rejeicao = case when p_status = 'rejeitado' then nullif(pg_catalog.btrim(p_motivo), '') else m.motivo_rejeicao end
   where m.id = p_id;
  if not found then
    raise exception 'modelo_whatsapp: modelo não encontrado' using errcode = 'P0002';
  end if;
end;
$$;
comment on function api.atualizar_status_modelo_whatsapp(uuid, text, text) is '[P18b item 2] Anda o status do modelo (submetido, aprovado, rejeitado, pausado, desativado) conforme a resposta da Meta. As transições válidas ficam no gatilho. Diretoria, AAL2.';


-- =============================================================================
-- 5. P11 · Web Push
-- =============================================================================

create table privado.inscricao_push (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  usuario_id uuid not null references public.perfil(id),
  endpoint text not null unique check (endpoint ~ '^https://' and pg_catalog.length(endpoint) <= 2048),
  chaves jsonb not null check (pg_catalog.jsonb_typeof(chaves) = 'object' and chaves ? 'p256dh' and chaves ? 'auth')
);
comment on table privado.inscricao_push is '[P11 item 4] Inscrição de Web Push (VAPID) por aparelho: PRD 6.7 ganha (usuario_id, endpoint, chaves, criado_em). Exceção às colunas padrão: sem atualizado_em nem criado_por (usuario_id é o dono). endpoint e chaves são segredo do aparelho e entram no log como "[oculto]". Escrita e leitura só pelas funções.';

create index on privado.inscricao_push (usuario_id);

alter table privado.inscricao_push enable row level security;
revoke all on table privado.inscricao_push from anon, authenticated, service_role;

insert into privado.auditoria_coluna_sensivel (entidade, coluna, fonte) values
  ('privado.inscricao_push', 'endpoint', 'sessao_p05'),
  ('privado.inscricao_push', 'chaves', 'sessao_p05');

create trigger auditar after insert or update or delete on privado.inscricao_push
  for each row execute function privado.auditar('id');

create function api.registrar_inscricao_push(p_endpoint text, p_chaves jsonb) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(
    array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  -- o mesmo aparelho reaparece com outra pessoa (troca de conta): passa a ser dela
  insert into privado.inscricao_push (usuario_id, endpoint, chaves)
  values (auth.uid(), p_endpoint, p_chaves)
  on conflict (endpoint) do update set usuario_id = excluded.usuario_id, chaves = excluded.chaves;
end;
$$;
comment on function api.registrar_inscricao_push(text, jsonb) is '[P11 item 4] Guarda a inscrição de push do aparelho da pessoa logada (endpoint https e chaves p256dh e auth). Reinscrever o mesmo endpoint atualiza. Qualquer papel; AAL2 quando o perfil exige MFA.';

create function api.remover_inscricao_push(p_endpoint text) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(
    array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  delete from privado.inscricao_push i where i.endpoint = p_endpoint and i.usuario_id = auth.uid();
end;
$$;
comment on function api.remover_inscricao_push(text) is '[P11 item 4] Remove a inscrição de push da própria pessoa (sair do app ou desligar o aviso). Nunca a de outra pessoa.';

create function public.inscricoes_push(p_usuario_ids uuid[]) returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('endpoint', i.endpoint, 'chaves', i.chaves)), '[]'::jsonb)
  from privado.inscricao_push i
  where i.usuario_id = any (p_usuario_ids)
$$;
comment on function public.inscricoes_push(uuid[]) is '[P11 item 4] Só service_role (rota interna que envia push): endpoints e chaves das pessoas pedidas.';

create function public.inscricao_push_expirada(p_endpoint text) returns void
  language sql
  volatile
  security definer
  set search_path = ''
  as $$
  delete from privado.inscricao_push i where i.endpoint = p_endpoint
$$;
comment on function public.inscricao_push_expirada(text) is '[P11 item 4] Só service_role: apaga a inscrição que o serviço de push devolveu como expirada (404 ou 410).';

revoke execute on function public.inscricoes_push(uuid[]) from public, anon, authenticated;
revoke execute on function public.inscricao_push_expirada(text) from public, anon, authenticated;
grant execute on function public.inscricoes_push(uuid[]) to service_role;
grant execute on function public.inscricao_push_expirada(text) to service_role;


-- =============================================================================
-- 6. P14 · saúde do sistema
-- =============================================================================

create table privado.saude_webhook (
  origem text primary key check (origem in ('autentique', 'infinitepay', 'whatsapp')),
  ultimo_recebido_em timestamptz,
  ultimo_ok_em timestamptz,
  ultima_falha_em timestamptz
);
comment on table privado.saude_webhook is '[P14 item 7] Último webhook recebido, último que deu certo e última falha, por origem. Só datas. Lido por public.saude_sistema.';
alter table privado.saude_webhook enable row level security;
revoke all on table privado.saude_webhook from anon, authenticated, service_role;

create function public.saude_registrar_webhook(p_origem text, p_ok boolean) returns void
  language sql
  volatile
  security definer
  set search_path = ''
  as $$
  insert into privado.saude_webhook (origem, ultimo_recebido_em, ultimo_ok_em, ultima_falha_em)
  values (p_origem, pg_catalog.now(),
          case when p_ok then pg_catalog.now() end,
          case when not p_ok then pg_catalog.now() end)
  on conflict (origem) do update
    set ultimo_recebido_em = excluded.ultimo_recebido_em,
        ultimo_ok_em = coalesce(excluded.ultimo_ok_em, privado.saude_webhook.ultimo_ok_em),
        ultima_falha_em = coalesce(excluded.ultima_falha_em, privado.saude_webhook.ultima_falha_em)
$$;
comment on function public.saude_registrar_webhook(text, boolean) is '[P14 item 7] Só service_role: cada rota de webhook diz se a chamada deu certo. Só datas, nenhum corpo.';

create function public.saude_sistema() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_toler   numeric := privado.agente_parametro_numero('saude_recalculo_tolerancia_horas');
  v_janela  numeric := privado.agente_parametro_numero('saude_janela_falhas_horas');
  v_desde   timestamptz;
  v_rec     record;
  v_recalc  jsonb;
  v_cron    jsonb := '[]'::jsonb;
  v_web     jsonb;
  v_falhas  jsonb;
  v_horas   numeric;
begin
  -- o recálculo diário das 7h (10:00 UTC): a última rodada concluída
  select r.status::text as status, r.concluido_em into v_rec
  from privado.recalculo_execucao r
  where r.concluido_em is not null
  order by r.concluido_em desc
  limit 1;
  v_horas := case when v_rec.concluido_em is null then null
             else pg_catalog.round((pg_catalog.date_part('epoch', pg_catalog.now() - v_rec.concluido_em) / 3600)::numeric, 1) end;
  v_recalc := pg_catalog.jsonb_build_object(
    'ultimo_concluido_em', v_rec.concluido_em,
    'status', v_rec.status,
    'horas_desde', v_horas,
    'tolerancia_horas', v_toler,
    'atrasado', coalesce(v_horas > v_toler, true),
    'com_erro', coalesce(v_rec.status = 'concluido_com_erro', false));

  -- os jobs do pg_cron e o resultado da última execução de cada um
  begin
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'job', j.jobname, 'ultimo_em', d.start_time, 'status', d.status) order by j.jobname), '[]'::jsonb)
      into v_cron
    from cron.job j
    left join lateral (
      select x.start_time, x.status from cron.job_run_details x
      where x.jobid = j.jobid order by x.start_time desc limit 1
    ) d on true;
  exception when others then
    v_cron := '[]'::jsonb;
  end;

  v_desde := pg_catalog.now() - pg_catalog.make_interval(secs => (coalesce(v_janela, 24) * 3600)::double precision);

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'origem', w.origem,
           'ultimo_recebido_em', w.ultimo_recebido_em,
           'ultimo_ok_em', w.ultimo_ok_em,
           'ultima_falha_em', w.ultima_falha_em,
           'falha_recente', w.ultima_falha_em is not null and w.ultima_falha_em >= v_desde
                            and (w.ultimo_ok_em is null or w.ultima_falha_em > w.ultimo_ok_em)) order by w.origem), '[]'::jsonb)
    into v_web
  from privado.saude_webhook w;

  v_falhas := pg_catalog.jsonb_build_object(
    'janela_horas', v_janela,
    'automacoes_com_falha', (select pg_catalog.count(*) from public.automacao_execucao e
                             where e.status = 'falhou' and e.atualizado_em >= v_desde),
    'sincronizacao_com_erro', (select pg_catalog.count(*) from public.fila_sincronizacao f
                               where f.status = 'erro' and f.recebido_em >= v_desde));

  return pg_catalog.jsonb_build_object(
    'recalculo_diario', v_recalc, 'cron', v_cron, 'webhooks', v_web, 'falhas', v_falhas);
end;
$$;
comment on function public.saude_sistema() is '[P14 item 7] Só service_role (rota /api/saude): recálculo diário das 7h (última rodada e atraso contra parametro.saude_recalculo_tolerancia_horas), último resultado de cada job do pg_cron, webhooks por origem e contagem de falhas de automação e de sincronização na janela de parametro.saude_janela_falhas_horas. Só datas e números, nenhum dado de pessoa.';

revoke execute on function public.saude_registrar_webhook(text, boolean) from public, anon, authenticated;
revoke execute on function public.saude_sistema() from public, anon, authenticated;
grant execute on function public.saude_registrar_webhook(text, boolean) to service_role;
grant execute on function public.saude_sistema() to service_role;


-- =============================================================================
-- 7. Fechamento de execute (mesmo padrão das migrations anteriores)
-- =============================================================================

revoke execute on function privado.modelo_whatsapp_placeholders_conferem(text, text[]) from public, anon, authenticated, service_role;
revoke execute on function privado.modelo_whatsapp_guardar() from public, anon, authenticated, service_role;
revoke execute on function privado.modelo_whatsapp_renderizar(text, text[]) from public, anon, authenticated, service_role;
revoke execute on function privado.modelo_whatsapp_valores(privado.modelo_whatsapp, uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.mensagem_status_somente_insercao() from public, anon, authenticated, service_role;

revoke execute on function api.status_entrega_conversa(uuid) from public, anon, service_role;
revoke execute on function api.modelos_whatsapp() from public, anon, service_role;
revoke execute on function api.modelo_whatsapp_aprovado(text, text) from public, anon, service_role;
revoke execute on function api.whatsapp_janela_horas() from public, anon, service_role;
revoke execute on function api.salvar_modelo_whatsapp(uuid, text, text, text, text, text[], text, jsonb) from public, anon, service_role;
revoke execute on function api.atualizar_status_modelo_whatsapp(uuid, text, text) from public, anon, service_role;
revoke execute on function api.registrar_inscricao_push(text, jsonb) from public, anon, service_role;
revoke execute on function api.remover_inscricao_push(text) from public, anon, service_role;

grant execute on function api.status_entrega_conversa(uuid) to authenticated;
grant execute on function api.modelos_whatsapp() to authenticated;
grant execute on function api.modelo_whatsapp_aprovado(text, text) to authenticated;
grant execute on function api.whatsapp_janela_horas() to authenticated;
grant execute on function api.salvar_modelo_whatsapp(uuid, text, text, text, text, text[], text, jsonb) to authenticated;
grant execute on function api.atualizar_status_modelo_whatsapp(uuid, text, text) to authenticated;
grant execute on function api.registrar_inscricao_push(text, jsonb) to authenticated;
grant execute on function api.remover_inscricao_push(text) to authenticated;
