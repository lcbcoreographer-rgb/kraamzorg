-- =============================================================================
-- 0012_automacoes.sql
--
-- P20 (PROMPTS.md v2) · PRD 10 inteiro, 8.2, 4.1, 6.7, 6.8 (parametro
-- retencao, agente_followup_horas), 13, 21.3, 22.4 (O-06)
--
-- Motor de automações: pg_cron chama privado.processar_automacoes() a cada
-- 5 minutos (PRD 10). Ela materializa as execuções devidas por tempo,
-- evento e data em automacao_execucao, chama privado.pode_executar (P09)
-- para cada uma, aplica as ações de banco (tarefa, notificação) e manda as
-- que precisam de serviço externo por net.http_post para
-- /api/interno/automacao, com o segredo lido do Supabase Vault. A régua de
-- nutrição e o alerta de 34 semanas são "diário, 7h" (PRD 10.1, 10.2): em
-- vez de reimplementar um segundo agendamento, esta migration só cria
-- privado.recalculo_regua_nutricao() e privado.recalculo_alerta_34s();
-- privado.recalculo_diario() (0011, P19) já procura essas duas funções pelo
-- nome a cada rodada (to_regprocedure), então elas entram na rodada das
-- 10:00 UTC sem tocar em 0011.sql. A retenção (retencao_diaria, O-06) tem
-- cron próprio, porque não é "recálculo do dia" nem "execução com freio":
-- é manutenção de LGPD independente de família.
--
-- O que esta migration faz:
--   1. Segredo automacao_interno_token no Vault (idempotente, mesmo
--      desenho de auditoria_hmac, 0005).
--   2. privado.chamar_rota_automacao: único ponto que chama net.http_post
--      para a rota interna (PRD 10, 22.1).
--   3. Materialização por automação (uma função por gatilho de tempo,
--      evento ou data): retorno_combinado, lembrete_sessao,
--      pagamento_atrasado, sessao_sem_agenda e o agendamento (sem
--      execução) de followup_d1.
--   4. privado.aplicar_acao_automacao: aplica uma ação do jsonb `acoes` de
--      automacao (criar_tarefa, notificar*, chamar_rota_interna); ação não
--      reconhecida é gancho vazio (contrato_fechado, pos_assinatura,
--      pagamento_confirmado: P30 a P32), nunca erro.
--   5. privado.processar_automacoes: materializa, processa as execuções
--      'agendada' devidas (chama pode_executar, aplica ações, marca
--      executada), cron a cada 5 minutos.
--   6. privado.recalculo_regua_nutricao e privado.recalculo_alerta_34s:
--      etapas do recálculo diário (0011).
--   7. privado.retencao_diaria (PRD 22.4 O-06): chat_memoria vencida,
--      mensagem/handoff/conversa de família que nunca contratou 24 meses
--      depois de perdido ou nao_qualificado, ip do log pela função que o
--      P05 já deixou pronta (privado.anonimizar_ip_log_auditoria). Cron
--      diário próprio.
--
-- Leituras adotadas onde o PRD ou o PROMPTS.md deixam margem (a mais
-- segura, registradas no relatório da sessão):
--   * "Automações da Fase 1" do P20 v2 cobertas de verdade nesta migration:
--     regua_nutricao, retorno_combinado, lembrete_sessao,
--     pagamento_atrasado, sessao_sem_agenda, followup_d1 (só agenda) e
--     retencao_diaria. qualificacao já é acionada direto por gatilho do
--     P17 (0010), fora do motor. boas_vindas é resposta do agente à
--     primeira mensagem (P21/P25), não cadência de cron.
--   * followup_d3_d14, contratar_sem_transferencia, alerta_34s e
--     prenatal_urgente ficam como gancho vazio, comentado no lugar exato:
--     as três primeiras precisam de um dado que o schema ainda não grava
--     de forma inequívoca (o instante do primeiro retorno da Isadora para
--     contar D+3/D+14; o marco "quer_contratar" do agente, Apêndice A,
--     ainda não construído; a matriz de handoff, PRD 11.4, é do P22).
--     Inventar um relógio para elas agora arriscaria SLA fantasma ou
--     handoff fora da matriz que o P22 vai definir. alerta_34s e
--     prenatal_urgente têm a função pronta (chamável assim que a Kraamzorg
--     ligar `automacao.ativa`), mas continuam com `ativa = false` no seed,
--     como a sessão do P19/P08 já registrou ("Fase 2, pré-natal online"):
--     o texto do P20 as lista, mas a decisão de dado já tomada (seed.sql,
--     revisada) é mais segura que reabrir sem o módulo de pré-natal.
--   * "Véspera da sessão" (lembrete_sessao) é regra estrutural do PRD
--     ("amanhã, às {hora}", capítulo 23.2), não um prazo ajustável: tratado
--     como código, no mesmo espírito do "10:00 UTC" de recalculo_diario
--     (0011), não como parametro.
--   * "Marco sessao_interesse sem handoff em 24 h" É um limite ajustável
--     (mesma natureza de freio_desfazer_segundos, 6.8): parametro
--     `sessao_sem_agenda_horas` (seed.sql), nunca fixo no código.
--   * Dedup: cada materializador nunca cria uma segunda `automacao_execucao`
--     'agendada' ou 'executada' para o mesmo fato (mesma data de
--     proximo_contato_em, mesma sessao_venda, mesma cobrança, mesma faixa
--     da régua): tentativa registrada (mesmo abortada pelo freio) consome
--     o fato, para não reencher a fila a cada 5 minutos.
--   * followup_d1: o motor só agenda (PROMPTS.md P20: "o motor só agenda, e
--     o n8n consome por agente.followups_devidos()", P22). Uma resposta
--     nova da família cancela a execução 'agendada' que ficou desatualizada
--     (marca 'cancelada'), para o P22 nunca consumir um agendamento velho.
--   * Ação externa: nenhuma automação da Fase 1 chama serviço externo de
--     verdade ainda (contrato_fechado, pos_assinatura e pagamento_confirmado
--     são gancho vazio, P30 a P32). privado.chamar_rota_automacao e o tipo
--     de ação "chamar_rota_interna" ficam prontos e testados com automação
--     sintética (mesmo padrão do teste 009 para o freio), para a primeira
--     automação real só precisar da linha de dado.
--   * Ordem de FK na retenção: chat_memoria, depois mensagem, depois
--     handoff, depois conversa (filhos antes do pai).
-- =============================================================================


-- =============================================================================
-- 1. Segredo automacao_interno_token no Vault (PRD 10, 22.1)
--
-- Mesmo desenho de auditoria_hmac (0005): gerado uma vez, dentro do banco,
-- nunca passa por arquivo nem variável de ambiente. sem-docker: Vault é
-- stub, texto puro (supabase/sem-docker/README.md). No Supabase real, a
-- rota /api/interno/automacao valida este token no cabeçalho Authorization.
-- =============================================================================

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'automacao_interno_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'automacao_interno_token',
      'Token que privado.chamar_rota_automacao manda no cabeçalho Authorization de /api/interno/automacao (PRD 10). Gerado pela migration 0012, nunca sai do banco.'
    );
  end if;
end $$;


-- =============================================================================
-- 2. privado.chamar_rota_automacao (PRD 10, 22.1)
--
-- Único ponto do motor que chama net.http_post. Lê a base da rota em
-- parametro.automacao_rota_interna (nenhuma URL fixa no código, PRD 5.2) e
-- o segredo no Vault; sem um dos dois, recusa (sem automação externa
-- silenciosa). Devolve o id da chamada do pg_net (bigint), como
-- net.http_post real.
-- =============================================================================

create function privado.chamar_rota_automacao(execucao_id uuid, rota text, corpo jsonb)
  returns bigint
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_base  text;
  v_token text;
  v_id    bigint;
begin
  select p.valor #>> '{}' into v_base from public.parametro p where p.chave = 'automacao_rota_interna';
  select s.decrypted_secret into v_token from vault.decrypted_secrets s where s.name = 'automacao_interno_token';

  if v_base is null or v_base = '' then
    raise exception 'automação: parametro automacao_rota_interna ausente (PRD 10)'
      using errcode = '22023';
  end if;
  if v_token is null or v_token = '' then
    raise exception 'automação: segredo automacao_interno_token ausente no Vault (PRD 10)'
      using errcode = '55000';
  end if;

  select net.http_post(
           url     := v_base || coalesce(chamar_rota_automacao.rota, ''),
           body    := corpo,
           headers := pg_catalog.jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_token,
                        'X-Automacao-Execucao-Id', chamar_rota_automacao.execucao_id::text)
         )
    into v_id;

  return v_id;
end;
$$;
comment on function privado.chamar_rota_automacao(uuid, text, jsonb) is 'Único ponto do motor que chama net.http_post (PRD 10, 22.1): rota em parametro.automacao_rota_interna, segredo em Vault (automacao_interno_token), sem os dois recusa. Chamada por privado.aplicar_acao_automacao na ação "chamar_rota_interna". Sem grant.';


-- =============================================================================
-- 3. Materialização por automação (gatilho de tempo, evento ou data)
--
-- Cada função devolve quantas linhas materializou (para
-- privado.processar_automacoes somar no resultado). Todas respeitam
-- automacao.ativa (trocar o executor ou desligar uma automação é edição de
-- dado, PRD 10.1, nunca deploy) e família mesclada (mesclada_em_id is null:
-- quem fala pela família é a que ficou, 0009).
-- =============================================================================

-- --- 3.1 retorno_combinado (PRD 10.1: data de proximo_contato_em atingida) ---
-- Dedup pela própria data: se proximo_contato_em mudar de novo no futuro
-- (novo "me liga em tal data"), o valor novo materializa de novo.
create function privado.materializar_retorno_combinado() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_n integer;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'retorno_combinado'), false) then
    return 0;
  end if;

  insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, payload, status)
  select 'retorno_combinado', o.familia_id, pg_catalog.clock_timestamp(),
         pg_catalog.jsonb_build_object('oportunidade_id', o.id, 'proximo_contato_em', o.proximo_contato_em),
         'agendada'
  from public.oportunidade o
  join public.familia f on f.id = o.familia_id
  where o.proximo_contato_em is not null
    and o.proximo_contato_em <= (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date
    and f.mesclada_em_id is null
    and not exists (
      select 1 from public.automacao_execucao e
      where e.automacao_id = 'retorno_combinado'
        and e.familia_id = o.familia_id
        and e.status in ('agendada', 'executada')
        and e.payload ->> 'proximo_contato_em' = o.proximo_contato_em::text
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.materializar_retorno_combinado() is 'Materializa retorno_combinado (PRD 10.1) quando oportunidade.proximo_contato_em chega: uma execução por data (dedup pelo próprio valor). Chamada por privado.processar_automacoes. Sem grant.';

-- --- 3.2 lembrete_sessao (PRD 10.1, 23.2: véspera da sessão) ------------------
-- "Véspera" é regra estrutural do PRD (capítulo 23.2), não prazo ajustável
-- (ver cabeçalho): dia calendário de sessao_venda.agendada_para menos um,
-- no fuso da operação. Dedup por sessao_venda.id.
create function privado.materializar_lembrete_sessao() returns integer
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

-- --- 3.3 pagamento_atrasado (PRD 10.1: vencimento ultrapassado) ---------------
-- Só cobrança em aberto (status = 'aberta') de contrato que não foi
-- cancelado nem distratado. Dedup por cobranca.id: uma tentativa por
-- cobrança, até ela ser paga (o InfinitePay, P31/32, muda o status).
create function privado.materializar_pagamento_atrasado() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_n integer;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'pagamento_atrasado'), false) then
    return 0;
  end if;

  insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, payload, status)
  select 'pagamento_atrasado', c.familia_id, pg_catalog.clock_timestamp(),
         pg_catalog.jsonb_build_object('cobranca_id', b.id, 'contrato_id', c.id, 'vencimento', b.vencimento),
         'agendada'
  from public.cobranca b
  join public.contrato c on c.id = b.contrato_id
  join public.familia f on f.id = c.familia_id
  where b.status = 'aberta'
    and b.vencimento < (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date
    and c.status not in ('cancelado', 'distrato')
    and f.mesclada_em_id is null
    and not exists (
      select 1 from public.automacao_execucao e
      where e.automacao_id = 'pagamento_atrasado'
        and e.status in ('agendada', 'executada')
        and e.payload ->> 'cobranca_id' = b.id::text
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.materializar_pagamento_atrasado() is 'Materializa pagamento_atrasado (PRD 10.1) para cobrança aberta vencida de contrato não cancelado. Dedup por cobranca.id, uma tentativa até o pagamento mudar o status (P31/32). Sem grant.';

-- --- 3.4 sessao_sem_agenda (PRD 10.1: marco sessao_interesse sem handoff) -----
-- Prazo ajustável (parametro.sessao_sem_agenda_horas, seed.sql; ausente:
-- não materializa, a leitura mais conservadora, como privado.disponibilidade
-- sem parâmetro). Dedup pelo próprio instante de sessao_interesse_em.
create function privado.materializar_sessao_sem_agenda() returns integer
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

-- --- 3.5 followup_d1: o motor só agenda (PROMPTS.md P20, Apêndice A) ---------
-- executor = 'agente': quem envia é o n8n, por agente.followups_devidos()
-- (P22), nunca esta migration (CLAUDE.md: "a única exceção [às regras de
-- mensageria] é o n8n"). Esta função só cria a linha 'agendada', com
-- agente_followup_horas (padrão 48, PRD 6.8) e a exclusão de
-- humano_comercial (conversa.agente_encerrado_em is null). Uma resposta
-- nova da família cancela o agendamento velho antes de materializar de
-- novo, para o P22 nunca consumir um agendamento desatualizado.
create function privado.agendar_followup_d1() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_horas integer;
  v_n     integer;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'followup_d1'), false) then
    return 0;
  end if;

  select (p.valor #>> '{}')::integer into v_horas from public.parametro p where p.chave = 'agente_followup_horas';
  if v_horas is null then
    return 0;
  end if;

  -- família respondeu de novo depois do agendamento: o followup_d1 velho
  -- não faz mais sentido (não é aborto pelo freio, é fato novo).
  update public.automacao_execucao e
     set status = 'cancelada'
    from public.conversa c
   where e.automacao_id = 'followup_d1'
     and e.status = 'agendada'
     and c.id = (e.payload ->> 'conversa_id')::uuid
     and c.ultima_entrada_em > (e.payload ->> 'ultima_entrada_em')::timestamptz;

  insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, payload, status)
  select 'followup_d1', c.familia_id, pg_catalog.clock_timestamp(),
         pg_catalog.jsonb_build_object('conversa_id', c.id, 'ultima_entrada_em', c.ultima_entrada_em),
         'agendada'
  from public.conversa c
  join public.familia f on f.id = c.familia_id
  where c.familia_id is not null
    and c.classificacao = 'lead'
    and c.agente_encerrado_em is null
    and c.ultima_entrada_em is not null
    and c.ultima_entrada_em <= pg_catalog.clock_timestamp() - pg_catalog.make_interval(hours => v_horas)
    and f.mesclada_em_id is null
    and not exists (select 1 from public.handoff h where h.conversa_id = c.id and h.status = 'aberto')
    and not exists (
      select 1 from public.automacao_execucao e
      where e.automacao_id = 'followup_d1'
        and e.familia_id = c.familia_id
        and e.status in ('agendada', 'executada')
        and (e.payload ->> 'ultima_entrada_em')::timestamptz >= c.ultima_entrada_em
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.agendar_followup_d1() is 'Só agenda followup_d1 (PROMPTS.md P20, Apêndice A): conversa lead sem resposta há parametro.agente_followup_horas, sem handoff aberto, fora de humano_comercial (agente_encerrado_em). Nunca executa: agente.followups_devidos (P22) consome. Cancela agendamento velho quando a família responde de novo. Sem grant.';


-- =============================================================================
-- 4. privado.aplicar_acao_automacao (PRD 10)
--
-- Aplica uma ação do jsonb automacao.acoes (PRD 6.7). Tipos reconhecidos:
--   criar_tarefa            insere tarefa (papel_responsavel por tipo_tarefa)
--   notificar, notificar_financeiro   insere notificacao
--   chamar_rota_interna      privado.chamar_rota_automacao (devolve true)
-- Ação de tipo desconhecido (gerar_contrato, enviar_autentique,
-- baixar_cobranca, disparar_nfse, mover_pipeline, ...) é gancho vazio: não
-- falha, só não faz nada aqui (P30 a P32 preenchem). Devolve verdadeiro só
-- quando a ação foi externa (para processar_automacoes contar).
-- =============================================================================

create function privado.aplicar_acao_automacao(
  execucao_id  uuid,
  automacao_id text,
  familia_id   uuid,
  acao         jsonb
) returns boolean
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_tipo        text := acao ->> 'tipo';
  v_tipo_tarefa text := acao ->> 'tipo_tarefa';
  v_papel       public.papel_usuario;
  v_prioridade  public.prioridade := coalesce(acao ->> 'prioridade', 'normal')::public.prioridade;
  v_texto       text;
begin
  if v_tipo = 'criar_tarefa' and v_tipo_tarefa is not null then
    v_papel := case v_tipo_tarefa
                 when 'cobranca_atraso' then 'financeiro'::public.papel_usuario
                 else 'comercial'::public.papel_usuario
               end;

    v_texto := null;
    if acao ? 'chave_mensagem' then
      select m.texto into v_texto from public.mensagem_modelo m where m.chave = acao ->> 'chave_mensagem';
    end if;

    insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload, origem_automacao_id)
    values (
      v_tipo_tarefa::public.tipo_tarefa,
      aplicar_acao_automacao.familia_id,
      v_papel,
      v_prioridade,
      aplicar_acao_automacao.automacao_id,
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'execucao_id', aplicar_acao_automacao.execucao_id, 'texto_sugerido', v_texto)),
      aplicar_acao_automacao.automacao_id
    );
    return false;
  end if;

  if v_tipo = 'notificar_financeiro' then
    insert into public.notificacao (papel, prioridade, titulo)
    values ('financeiro', v_prioridade, aplicar_acao_automacao.automacao_id);
    return false;
  end if;

  if v_tipo = 'notificar' and acao ? 'destino' then
    v_papel := (acao ->> 'destino')::public.papel_usuario;
    insert into public.notificacao (papel, prioridade, titulo)
    values (v_papel, v_prioridade, aplicar_acao_automacao.automacao_id);
    return false;
  end if;

  if v_tipo = 'chamar_rota_interna' then
    perform privado.chamar_rota_automacao(
      aplicar_acao_automacao.execucao_id,
      coalesce(acao ->> 'rota', ''),
      pg_catalog.jsonb_build_object(
        'execucao_id', aplicar_acao_automacao.execucao_id,
        'automacao_id', aplicar_acao_automacao.automacao_id,
        'familia_id', aplicar_acao_automacao.familia_id)
    );
    return true;
  end if;

  -- gancho vazio (P30 a P32) ou tipo ainda não coberto: nada a fazer.
  return false;
end;
$$;
comment on function privado.aplicar_acao_automacao(uuid, text, uuid, jsonb) is 'Aplica uma ação de automacao.acoes (PRD 6.7, 10): criar_tarefa, notificar/notificar_financeiro (banco) e chamar_rota_interna (externa, via privado.chamar_rota_automacao). Ação não reconhecida é gancho vazio (contrato_fechado, pos_assinatura, pagamento_confirmado: P30 a P32), nunca erro. Devolve verdadeiro só para ação externa. Chamada por privado.processar_automacoes. Sem grant.';


-- =============================================================================
-- 5. privado.processar_automacoes (PRD 10, invariante 3)
--
-- Materializa, depois processa toda automacao_execucao 'agendada' cujo
-- agendada_para já chegou, exceto as de executor 'agente' (followup_d1:
-- fica agendada para o n8n consumir, P22). Para cada uma, reconsulta o
-- freio agora (privado.pode_executar, que já registra o aborto quando
-- muda de estado desde o agendamento) e só aplica as ações quando ele
-- deixa passar. "for update ... skip locked": duas rodadas de cron que se
-- sobrepõem não processam a mesma execução duas vezes.
-- =============================================================================

create function privado.processar_automacoes() returns jsonb
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
    + privado.agendar_followup_d1();

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


-- =============================================================================
-- 6. Etapas do recálculo diário (0011, PRD 10.1, 10.2)
--
-- privado.recalculo_diario() já existe (0011, P19) e procura
-- privado.recalculo_<etapa>() pelo nome a cada rodada
-- (to_regprocedure), sem precisar ser editada: as duas funções abaixo
-- passam a entrar na rodada das 10:00 UTC (7h em Brasília) assim que esta
-- migration aplica. "Diário, 7h" (PRD 10.1) é o mesmo relógio do resto do
-- recálculo, não um cron à parte.
-- =============================================================================

-- --- 6.1 regua_nutricao (PRD 10.1, 10.3) --------------------------------------
-- "Uma tarefa por família por mudança de faixa, nunca semanal repetida"
-- (10.3): compara a faixa de hoje com a última automacao_execucao de
-- regua_nutricao da família (qualquer status: uma tentativa, mesmo
-- abortada pelo freio, consome a faixa, para não tentar de novo todo dia
-- enquanto o freio estiver puxado). "Só quem já escreveu" (D-08): exige
-- conversa com iniciada_por = 'cliente'. "Respeita freio e nao_contatar"
-- (10.3): nao_contatar filtra aqui (fora da matriz do freio, PRD 8.2);
-- o freio em si é privado.pode_executar, categoria 'conteudo' (8.2: aborta
-- fora de 'normal', a família em atenção não recebe a tarefa).
create function privado.recalculo_regua_nutricao() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_hoje       date := (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_rec        record;
  v_faixa      uuid;
  v_ultima     text;
  v_exec       uuid;
  v_avaliadas  integer := 0;
  v_mudou      integer := 0;
  v_criadas    integer := 0;
  v_abortadas  integer := 0;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'regua_nutricao'), false) then
    return pg_catalog.jsonb_build_object('ativa', false);
  end if;

  for v_rec in
    select f.id as familia_id, f.dpp, f.data_nascimento, ig.semanas
    from public.familia f
    left join lateral public.ig(f.dpp, v_hoje) as ig on true
    where f.mesclada_em_id is null
      and f.nao_contatar = false
      and (f.dpp is not null or f.data_nascimento is not null)
      and exists (select 1 from public.conversa c where c.familia_id = f.id and c.iniciada_por = 'cliente')
  loop
    v_avaliadas := v_avaliadas + 1;
    v_faixa := null;

    if v_rec.data_nascimento is not null then
      select rf.id into v_faixa
        from public.regua_faixa rf
       where rf.semana_min is null and rf.semana_max is null
       order by rf.ordem
       limit 1;
    else
      select rf.id into v_faixa
        from public.regua_faixa rf
       where not (rf.semana_min is null and rf.semana_max is null)
         and (rf.semana_min is null or v_rec.semanas >= rf.semana_min)
         and (rf.semana_max is null or v_rec.semanas <= rf.semana_max)
       order by rf.ordem
       limit 1;
    end if;

    if v_faixa is null then
      continue;
    end if;

    select e.payload ->> 'faixa_id' into v_ultima
      from public.automacao_execucao e
     where e.automacao_id = 'regua_nutricao' and e.familia_id = v_rec.familia_id
     order by e.criado_em desc
     limit 1;

    if v_ultima is not distinct from v_faixa::text then
      continue;
    end if;
    v_mudou := v_mudou + 1;

    insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, payload, status)
    values ('regua_nutricao', v_rec.familia_id, pg_catalog.clock_timestamp(),
            pg_catalog.jsonb_build_object('faixa_id', v_faixa), 'agendada')
    returning id into v_exec;

    if privado.pode_executar(v_rec.familia_id, 'regua_nutricao', v_exec) then
      insert into public.tarefa (tipo, familia_id, papel_responsavel, titulo, payload, origem_automacao_id)
      select 'nutricao_contato'::public.tipo_tarefa, v_rec.familia_id, 'comercial'::public.papel_usuario,
             'regua_nutricao',
             pg_catalog.jsonb_build_object('faixa_id', v_faixa, 'ordem', rf.ordem,
                                            'chave_mensagem', rf.mensagem_chave, 'texto_sugerido', m.texto),
             'regua_nutricao'
        from public.regua_faixa rf
        left join public.mensagem_modelo m on m.chave = rf.mensagem_chave
       where rf.id = v_faixa;

      update public.automacao_execucao set status = 'executada', executada_em = pg_catalog.clock_timestamp()
       where id = v_exec;
      v_criadas := v_criadas + 1;
    else
      v_abortadas := v_abortadas + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'ativa', true, 'familias_avaliadas', v_avaliadas, 'mudou_faixa', v_mudou,
    'tarefas_criadas', v_criadas, 'abortadas_freio', v_abortadas
  );
end;
$$;
comment on function privado.recalculo_regua_nutricao() is 'Etapa regua_nutricao do recálculo diário (0011, PRD 10.1, 10.3): uma tarefa por família por mudança de faixa (dedup pela última automacao_execucao, qualquer status), só quem já escreveu (D-08), respeita nao_contatar e o freio (privado.pode_executar, categoria conteudo). ativa = false na automação: não roda. Sem grant.';

-- --- 6.2 alerta_34s (PRD 10.1: interno, nada à família) -----------------------
-- categoria 'interna' (8.2): sempre executa, mas passa por pode_executar do
-- mesmo jeito (registro e simetria com as demais etapas). Dispara uma vez
-- por família (not exists qualquer execução anterior, não só do dia: ao
-- cruzar 34 semanas o alerta já foi dado). ativa = false no seed (Fase 2,
-- pré-natal online, ver cabeçalho): função pronta, dado adotado é o mais
-- seguro.
create function privado.recalculo_alerta_34s() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_hoje        date := (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_rec         record;
  v_exec        uuid;
  v_avaliadas   integer := 0;
  v_notificadas integer := 0;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'alerta_34s'), false) then
    return pg_catalog.jsonb_build_object('ativa', false);
  end if;

  for v_rec in
    select f.id as familia_id
    from public.familia f
    left join lateral public.ig(f.dpp, v_hoje) as ig on true
    where f.mesclada_em_id is null
      and f.dpp is not null
      and f.data_nascimento is null
      and ig.semanas >= 34
      and not exists (select 1 from public.automacao_execucao e
                        where e.automacao_id = 'alerta_34s' and e.familia_id = f.id)
  loop
    v_avaliadas := v_avaliadas + 1;

    insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status)
    values ('alerta_34s', v_rec.familia_id, pg_catalog.clock_timestamp(), 'agendada')
    returning id into v_exec;

    if privado.pode_executar(v_rec.familia_id, 'alerta_34s', v_exec) then
      insert into public.notificacao (papel, prioridade, titulo)
      values ('coordenacao', 'normal', 'alerta_34s');
      update public.automacao_execucao set status = 'executada', executada_em = pg_catalog.clock_timestamp()
       where id = v_exec;
      v_notificadas := v_notificadas + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('ativa', true, 'familias_avaliadas', v_avaliadas, 'notificadas', v_notificadas);
end;
$$;
comment on function privado.recalculo_alerta_34s() is 'Etapa alerta_34s do recálculo diário (0011, PRD 10.1, D-10): notifica a coordenação uma vez por família ao cruzar 34 semanas (interna: nada à família). ativa = false no seed (Fase 2, pré-natal online): função pronta, não dispara até a Kraamzorg ligar. Sem grant.';


-- =============================================================================
-- 7. privado.retencao_diaria (PRD 10.1, 22.4 O-06)
--
-- Três prazos de parametro.retencao (6.8), nenhum fixo no código:
--   chat_memoria_dias           chat_memoria apagada X dias depois da
--                                última mensagem da conversa
--   conversa_nao_cliente_meses  mensagem, handoff e conversa de família sem
--                                contrato, X meses depois de perdido ou
--                                nao_qualificado (marco: evento_familia,
--                                tipo estagio, máquina p1, para em
--                                perdido/nao_qualificado; PRD 6.10 regra 3
--                                não se aplica aqui, é estágio comercial,
--                                não data clínica)
--   log_ip_meses                já resolvido: privado.anonimizar_ip_log_auditoria
--                                (0005, P05), só chamada aqui.
-- Sem o parâmetro (qualquer um deles ausente), a etapa correspondente não
-- roda; sem parametro.retencao inteiro, a função recusa (nenhum prazo
-- fixo, mesma leitura de privado.hmac_auditoria sem a chave do Vault).
-- Apaga, não anonimiza, mensagem/handoff/conversa: família que nunca
-- contratou não tem contrato para justificar retenção fiscal, e apagar é
-- mais seguro que reter texto (LGPD, minimização). Grava no log só
-- contagens (PRD 10.1); os gatilhos de auditoria (0005) já registram cada
-- DELETE como sempre (colunas sensíveis viram "[oculto]" mais HMAC).
-- =============================================================================

create function privado.retencao_diaria() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_ret               jsonb;
  v_dias_memoria      integer;
  v_meses_conversa    integer;
  v_memoria_apagada   integer := 0;
  v_mensagens         integer := 0;
  v_handoffs          integer := 0;
  v_conversas         integer := 0;
  v_familias          uuid[];
  v_ip_anonimizado    integer := 0;
begin
  select p.valor into v_ret from public.parametro p where p.chave = 'retencao';
  if v_ret is null then
    raise exception 'parametro retencao ausente: retencao_diaria não roda sem prazos definidos (PRD 6.8, 22.4 O-06)'
      using errcode = '22023';
  end if;

  v_dias_memoria   := nullif(v_ret ->> 'chat_memoria_dias', '')::integer;
  v_meses_conversa := nullif(v_ret ->> 'conversa_nao_cliente_meses', '')::integer;

  -- 1. chat_memoria vencida: X dias depois da última mensagem da conversa
  --    (sem mensagem: primeira_msg_em, depois criado_em da conversa).
  if v_dias_memoria is not null then
    with vencidas as (
      select c.id
      from public.conversa c
      where coalesce(
              (select pg_catalog.max(m.enviada_em) from public.mensagem m where m.conversa_id = c.id),
              c.primeira_msg_em, c.criado_em
            ) < pg_catalog.clock_timestamp() - pg_catalog.make_interval(days => v_dias_memoria)
    )
    delete from agente_n8n.chat_memoria cm
     where cm.session_id in (select id::text from vencidas);
    get diagnostics v_memoria_apagada = row_count;
  end if;

  -- 2. família sem contrato, X meses depois de perdido ou nao_qualificado:
  --    apaga mensagem, handoff e conversa (ordem: filhos antes do pai).
  if v_meses_conversa is not null then
    with marcos as (
      select e.familia_id, pg_catalog.max(e.criado_em) as marco_em
      from public.evento_familia e
      where e.tipo = 'estagio'
        and e.dados ->> 'maquina' = 'p1'
        and e.dados ->> 'para' in ('perdido', 'nao_qualificado')
      group by e.familia_id
    )
    select pg_catalog.array_agg(m.familia_id) into v_familias
    from marcos m
    where m.marco_em < pg_catalog.clock_timestamp() - pg_catalog.make_interval(months => v_meses_conversa)
      and not exists (select 1 from public.contrato k where k.familia_id = m.familia_id);

    if v_familias is not null then
      delete from agente_n8n.chat_memoria cm
       where cm.session_id in (select c.id::text from public.conversa c where c.familia_id = any (v_familias));

      delete from public.mensagem me
       where me.conversa_id in (select c.id from public.conversa c where c.familia_id = any (v_familias));
      get diagnostics v_mensagens = row_count;

      delete from public.handoff h where h.familia_id = any (v_familias);
      get diagnostics v_handoffs = row_count;

      delete from public.conversa c where c.familia_id = any (v_familias);
      get diagnostics v_conversas = row_count;
    end if;
  end if;

  -- 3. ip do log_auditoria: função pronta desde o P05 (0005).
  v_ip_anonimizado := privado.anonimizar_ip_log_auditoria();

  insert into public.log_auditoria (acao, entidade, valor_depois, origem)
  values (
    'retencao', 'retencao_diaria',
    pg_catalog.jsonb_build_object(
      'chat_memoria_apagada', v_memoria_apagada,
      'familias_candidatas', coalesce(pg_catalog.array_length(v_familias, 1), 0),
      'mensagens_apagadas', v_mensagens,
      'handoffs_apagados', v_handoffs,
      'conversas_apagadas', v_conversas,
      'ip_anonimizado', v_ip_anonimizado
    ),
    'cron'
  );

  return pg_catalog.jsonb_build_object(
    'chat_memoria_apagada', v_memoria_apagada,
    'familias_candidatas', coalesce(pg_catalog.array_length(v_familias, 1), 0),
    'mensagens_apagadas', v_mensagens,
    'handoffs_apagados', v_handoffs,
    'conversas_apagadas', v_conversas,
    'ip_anonimizado', v_ip_anonimizado
  );
end;
$$;
comment on function privado.retencao_diaria() is 'Automação retencao_diaria (PRD 10.1, 22.4 O-06), pg_cron diário: apaga chat_memoria vencida (parametro.retencao.chat_memoria_dias), apaga mensagem/handoff/conversa de família sem contrato X meses depois de perdido ou nao_qualificado (parametro.retencao.conversa_nao_cliente_meses), anonimiza o ip do log (privado.anonimizar_ip_log_auditoria, P05). Sem parametro.retencao, recusa. Grava no log só contagens. Sem grant: só o cron (postgres) chama.';


-- =============================================================================
-- 8. Agendamento no pg_cron
--
-- cron.schedule com nome atualiza o job se ele já existir (idempotente,
-- mesmo padrão de recalculo_diario, 0011). processar_automacoes a cada 5
-- minutos (PRD 10); retencao_diaria uma vez por dia, depois do recálculo
-- das 10:00 UTC, para não competir por lock de familia/oportunidade.
-- =============================================================================

select cron.schedule('processar_automacoes', '*/5 * * * *', 'select privado.processar_automacoes()');
select cron.schedule('retencao_diaria', '30 10 * * *', 'select privado.retencao_diaria()');


-- =============================================================================
-- 9. Execute
--
-- Tudo aqui é cron-only (postgres): nenhuma função nova para authenticated,
-- anon nem service_role, mesmo padrão de privado.recalculo_diario (0011).
-- =============================================================================

revoke execute on function privado.chamar_rota_automacao(uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function privado.materializar_retorno_combinado() from public, anon, authenticated, service_role;
revoke execute on function privado.materializar_lembrete_sessao() from public, anon, authenticated, service_role;
revoke execute on function privado.materializar_pagamento_atrasado() from public, anon, authenticated, service_role;
revoke execute on function privado.materializar_sessao_sem_agenda() from public, anon, authenticated, service_role;
revoke execute on function privado.agendar_followup_d1() from public, anon, authenticated, service_role;
revoke execute on function privado.aplicar_acao_automacao(uuid, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke execute on function privado.processar_automacoes() from public, anon, authenticated, service_role;
revoke execute on function privado.recalculo_regua_nutricao() from public, anon, authenticated, service_role;
revoke execute on function privado.recalculo_alerta_34s() from public, anon, authenticated, service_role;
revoke execute on function privado.retencao_diaria() from public, anon, authenticated, service_role;
