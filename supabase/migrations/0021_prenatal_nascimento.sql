-- =============================================================================
-- 0021_prenatal_nascimento.sql
--
-- P35 (consulta pré-natal, DOC 1, e alerta de 34 semanas) e P36 (designação,
-- radar de nascimentos, nascimento e alta) · PROMPTS.md v2 · PRD 3.4, 4 (D-04,
-- D-10), 6.5, 6.10 (regras 3, 7, 8, 13), 7.2, 7.3, 8.2, 9.1, 10.1
-- (prenatal_urgente, alerta_34s, checkin_dpp, dpp_sem_confirmacao,
-- dpp_sem_contato, nascimento, alta), 10.2, 13, 22.4 (O-01), 23.2 e o ADR 0002.
--
-- Esta migration NÃO foi aplicada em ambiente nenhum: escrita, testada no
-- banco local (supabase/sem-docker) e parada para revisão humana do SQL
-- (CLAUDE.md). Nenhum dado aqui: parâmetros, textos e a ativação das
-- automações ficam no seed.sql.
--
-- Consulta pré-natal (P35):
--   1. Pagamento confirmado (cobranca passa a 'paga') abre a consulta
--      pré-natal e a tarefa agendar_prenatal para a coordenação. Acima do
--      limite de semanas (parametro.prenatal_semanas_alerta, 34) a consulta
--      nasce urgente, a tarefa com prioridade máxima e a coordenação é
--      avisada no mesmo instante (prenatal_urgente). O acompanhamento nasce
--      junto, em 'aguardando' (a reserva da titular precisa dele).
--   2. api.agendar_consulta_prenatal: agenda, move o P2 para
--      consulta_prenatal_agendada e fecha a tarefa.
--   3. api.prenatal_abrir: abre a entrevista em branco (nunca copia outra
--      família), devolve a definição aprovada do DOC 1 e a leitura vai para
--      o log (assistencial.ler_consulta_prenatal).
--   4. api.prenatal_salvar_campo: um campo por vez (a sincronização offline
--      do P12 chama por aqui), com conflito por versao, retomada (etapa e
--      campo onde parou) e os destinos do bloco H: médicos em `medico`,
--      plano de cuidado e período preferido em consulta_prenatal.
--   5. api.prenatal_concluir: fecha a entrevista, move o P2 para
--      consulta_realizada e, se já há titular, para enfermeira_designada.
--   6. api.prenatal_consultas e api.prenatal_estado: a lista da coordenação
--      e o estado (sem conteúdo) que o comercial vê.
--   7. alerta_34s diário, só interno: privado.recalculo_alerta_34s ganha o
--      limite em parametro, o recorte das famílias com contrato e o link da
--      ficha. Nada sai para a família.
--
-- Designação, nascimento e alta (P36):
--   8. designacao ganha prazo de resposta e o marcador de atribuição direta;
--      insert e update direto saem do grant (oferta, resposta e atribuição
--      só pelas funções abaixo). Uma titular e um backup ativos por
--      acompanhamento, e a mesma profissional nunca nos dois papéis.
--   9. api.alocacao_familia (com as candidatas), api.oferecer_designacao,
--      api.atribuir_designacao (direta, só em urgência, com motivo),
--      api.minhas_ofertas e api.responder_designacao. Recusa ou vencimento
--      do prazo da titular promove o backup e avisa a coordenação.
--  10. api.radar_nascimentos: famílias com contrato pela janela da DPP, com
--      titular, backup, contato e a ocupação por praça.
--  11. api.registrar_nascimento e api.registrar_alta: gravam o fato, o P2, o
--      acompanhamento, as visitas de D1 a D6 ou D12 no mesmo período, a
--      tarefa do guia e os avisos. A data também pode chegar pela ficha
--      (P16): um gatilho enfileira o fato e o cron processa como sistema.
--  12. Etapa alertas_dpp do recálculo diário: checkin_dpp (tarefa),
--      dpp_sem_confirmacao (aviso alto) e dpp_sem_contato (ocorrência). São
--      automações internas: só preparam a equipe. A DPP nunca move estágio,
--      agenda nem visita (PRD 6.10 regra 3).
--  13. privado.processar_designacoes (cron a cada 5 minutos): vence oferta
--      sem resposta, processa os fatos enfileirados, avança o P2 para
--      enfermeira_designada e gera as visitas quando a titular aceita depois
--      da alta.
--
-- Papéis e AAL (ADR 0002, seções 5 e 6, linhas acrescentadas):
--   prenatal_consultas, prenatal_abrir, prenatal_salvar_campo,
--   prenatal_concluir, agendar_consulta_prenatal
--                           coordenação, diretoria; AAL2 (dado assistencial)
--   prenatal_estado         comercial, coordenação, diretoria; só o estado
--   alocacao_familia, oferecer_designacao, atribuir_designacao,
--   radar_nascimentos, registrar_nascimento, registrar_alta,
--   registrar_previsao_alta coordenação, diretoria; AAL2
--   minhas_ofertas, responder_designacao
--                           enfermeira (só as próprias ofertas); AAL2
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura; registradas em
-- docs/sessoes/P35-P36.md):
--   * "IG > 34 semanas" (prenatal_urgente) é estritamente mais que 34s0d; o
--     alerta_34s diário dispara ao chegar a 34s0d.
--   * O limite (34) e os prazos ficam em parametro; sem o parâmetro, a função
--     que precisa dele recusa ou não dispara (nunca inventa valor).
--   * Só o comercial que já tem contrato vê "estado" do pré-natal; o
--     conteúdo da entrevista é só da coordenação e da diretoria (fluxos.md B).
--   * A entrevista só abre com versão aprovada do DOC 1 (instrumento.vigente
--     ou aprovado_em): campo clínico só vem de instrumento aprovado.
--   * O P2 avança para enfermeira_designada quando existem as duas coisas:
--     consulta realizada e titular aceita. Quem aceita é a enfermeira, que
--     não tem papel mínimo no P2; o avanço fica com o cron (sistema) ou com
--     a próxima ação da coordenação.
--   * Backup aceito vira titular quando a titular recusa ou deixa vencer o
--     prazo; backup ainda em oferta recebe a oferta como titular, com novo
--     prazo. A coordenação é avisada nos dois casos.
--   * Dia 1 do acompanhamento: parametro.alta_primeira_visita_dias depois da
--     alta, salvo se quem registra informar outra data. Dias contratados em
--     dias corridos seguidos (a mesma conta de public.ocupacao_projetada).
-- =============================================================================


-- =============================================================================
-- 1. Colunas novas e regras de tabela
-- =============================================================================

alter table public.consulta_prenatal
  add column progresso   jsonb not null default '{}',
  add column iniciada_em timestamptz;
comment on column public.consulta_prenatal.progresso is '[P35] Onde a entrevista parou: {"etapa": n, "campo": "B.percentil", "em": instante}. Só ids da definição, nunca resposta. Serve para "Retomar da etapa 4" e reabrir no campo.';
comment on column public.consulta_prenatal.iniciada_em is '[P35] Instante do primeiro campo gravado (entrevista em andamento).';

alter table public.designacao
  add column prazo_resposta_em timestamptz,
  add column direta            boolean not null default false,
  add column motivo_direta     text;
comment on column public.designacao.prazo_resposta_em is '[P36] Até quando a profissional responde a oferta (parametro.designacao_prazo_resposta_horas). Vencido, privado.processar_designacoes marca expirada.';
comment on column public.designacao.direta is '[P36] Atribuição direta da coordenação em urgência (O-01): nasce aceita, com motivo.';
comment on column public.designacao.motivo_direta is '[P36] Motivo da atribuição direta. Texto livre, oculto no log de auditoria.';

alter table public.acompanhamento
  add column previsao_alta date;
comment on column public.acompanhamento.previsao_alta is '[P36] Previsão de alta informada pela família ou pela maternidade. ESTIMATIVA, não é a data_alta (fato, PRD 6.10 regra 3).';

-- motivo_direta é texto livre da coordenação: "[oculto]" mais HMAC no log
alter table privado.auditoria_coluna_sensivel
  drop constraint auditoria_coluna_sensivel_fonte_check;
alter table privado.auditoria_coluna_sensivel
  add constraint auditoria_coluna_sensivel_fonte_check
  check (fonte in ('prd_13', 'sessao_p05', 'sessao_p36'));
insert into privado.auditoria_coluna_sensivel (entidade, coluna, fonte) values
  ('designacao', 'motivo_direta', 'sessao_p36'),
  ('designacao', 'motivo_recusa', 'sessao_p36');

-- Oferta, resposta e atribuição só pelas funções (prazo, papel, backup e
-- aviso andam juntos).
revoke insert on public.designacao from authenticated;
revoke update on public.designacao from authenticated;

-- A leitura das linhas continua como estava (política `ler`), mas sem as duas
-- colunas de texto livre: o motivo da recusa e o motivo da atribuição direta
-- são da coordenação e da própria profissional (chegam pelas funções de api,
-- que checam o papel). Com a leitura da tabela inteira, o comercial, que vê as
-- designações para saber quem atende a família, leria o que a enfermeira
-- escreveu ao recusar e o que a coordenação registrou numa urgência.
revoke select on public.designacao from authenticated;
grant select (id, criado_em, atualizado_em, criado_por, acompanhamento_id, profissional_id, papel, status,
              oferecida_em, respondida_em, prazo_resposta_em, direta)
  on public.designacao to authenticated;

-- Uma titular e um backup ativos por acompanhamento; a mesma profissional
-- nunca em dois papéis ativos do mesmo acompanhamento.
create unique index designacao_papel_ativo
  on public.designacao (acompanhamento_id, papel)
  where status in ('oferecida', 'aceita');
create unique index designacao_profissional_ativa
  on public.designacao (acompanhamento_id, profissional_id)
  where status in ('oferecida', 'aceita');
create index designacao_oferta_pendente
  on public.designacao (prazo_resposta_em)
  where status = 'oferecida';

-- Uma consulta pré-natal viva por família (cancelada e nao_realizada saem).
create unique index consulta_prenatal_viva
  on public.consulta_prenatal (familia_id)
  where status in ('pendente', 'agendada', 'realizada');

-- Fila dos fatos "nascimento" e "alta": a data pode chegar pela ficha (P16),
-- por qualquer papel, e a automação roda como sistema (PRD 10.1). Técnica,
-- sem grant, lida e escrita só pelas funções.
create table privado.fato_operacao (
  id            bigserial primary key,
  criado_em     timestamptz not null default now(),
  familia_id    uuid not null references public.familia(id) on delete cascade,
  tipo          text not null check (tipo in ('nascimento', 'alta')),
  data          date not null,
  processado_em timestamptz,
  tentativas    integer not null default 0,
  erro          text
);
comment on table privado.fato_operacao is '[P36] Fila dos fatos data_nascimento e data_alta preenchidos (PRD 10.1: gatilho "data preenchida"). Um gatilho em familia enfileira; api.registrar_* processa na hora; privado.processar_designacoes (cron) processa o que veio pela ficha. Sem grant.';
create index on privado.fato_operacao (familia_id);
create index fato_operacao_pendente on privado.fato_operacao (id) where processado_em is null;
alter table privado.fato_operacao enable row level security;
revoke all on privado.fato_operacao from public, anon, authenticated, service_role;
revoke all on sequence privado.fato_operacao_id_seq from public, anon, authenticated, service_role;


-- Idempotência da sincronização offline (PRD 15, "id gerado no aparelho"): o
-- resultado de cada item já aplicado, para reenviar o mesmo item nunca
-- reaplicar nem virar conflito de versão. Técnica, sem grant. Guarda só
-- versão e estado, nunca o valor da resposta.
create table privado.sync_item (
  item_id     uuid primary key,
  criado_em   timestamptz not null default now(),
  entidade    text not null,
  entidade_id uuid not null,
  resultado   jsonb not null
);
comment on table privado.sync_item is '[P35] Resultado de cada item da fila offline já aplicado (id gerado no aparelho): reenviar o mesmo item devolve o mesmo resultado, sem reaplicar. Só versão e estado, nunca o valor da resposta. Sem grant.';
alter table privado.sync_item enable row level security;
revoke all on privado.sync_item from public, anon, authenticated, service_role;


-- =============================================================================
-- 2. Auxiliares (privado, sem grant)
-- =============================================================================

create function privado.operacao_recusar(codigo text, detalhe text default null) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
begin
  raise exception 'operacao:% %', operacao_recusar.codigo, coalesce(operacao_recusar.detalhe, '')
    using errcode = 'P0001';
end;
$$;
comment on function privado.operacao_recusar(text, text) is '[P35/P36] Recusa de negócio: erro P0001 com a mensagem "operacao:<código> <detalhe>", que a tela troca por uma frase. O detalhe nunca leva dado pessoal. Sem grant.';

create function privado.op_hoje() returns date
  language sql
  stable
  set search_path = ''
  as $$ select (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date $$;
comment on function privado.op_hoje() is '[P35/P36] Hoje em America/Sao_Paulo. Sem grant.';

-- Posição do estágio do P2 na linha principal (nota fiscal corre em paralelo
-- e conta como pagamento_confirmado); nulo antes do pagamento e nos desvios.
create function privado.op_posicao_p2(estagio text) returns integer
  language sql
  immutable
  set search_path = ''
  as $$
  select case op_posicao_p2.estagio
    when 'pagamento_confirmado'       then 1
    when 'nota_fiscal_emitida'        then 1
    when 'consulta_prenatal_agendada' then 2
    when 'consulta_realizada'         then 3
    when 'enfermeira_designada'       then 4
    when 'aguardando_nascimento'      then 5
    when 'bebe_nasceu'                then 6
    when 'aguardando_alta'            then 7
    when 'atendimento_liberado'       then 8
  end
$$;
comment on function privado.op_posicao_p2(text) is '[P35/P36] Ordem do estágio do P2 depois do pagamento (1 a 8); nulo fora da linha principal. Sem grant.';

-- Anda o P2 até o alvo, pela linha principal, só por privado.transicionar.
-- Para bebe_nasceu vai direto (PRD 7.2: vale de qualquer estágio depois do
-- pagamento), sem fingir que o pré-natal aconteceu. Estágio já no alvo ou
-- adiante: nada. Devolve o estágio final.
create function privado.op_avancar_p2(oportunidade_id uuid, alvo text, motivo text default null) returns text
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  c_linha constant text[] := array['pagamento_confirmado', 'consulta_prenatal_agendada', 'consulta_realizada',
                                   'enfermeira_designada', 'aguardando_nascimento', 'bebe_nasceu',
                                   'aguardando_alta', 'atendimento_liberado'];
  v_atual text;
  v_pos   integer;
  v_alvo  integer := privado.op_posicao_p2(op_avancar_p2.alvo);
  v_prox  text;
begin
  if v_alvo is null then
    raise exception 'op_avancar_p2: alvo % não está na linha principal', op_avancar_p2.alvo
      using errcode = '22023';
  end if;

  loop
    select o.estagio_p2::text into v_atual from public.oportunidade o where o.id = op_avancar_p2.oportunidade_id;
    v_pos := privado.op_posicao_p2(v_atual);
    exit when v_pos is null or v_pos >= v_alvo;

    if op_avancar_p2.alvo = 'bebe_nasceu' then
      v_prox := 'bebe_nasceu';
    else
      v_prox := c_linha[v_pos + 1];
    end if;

    perform privado.transicionar('p2', op_avancar_p2.oportunidade_id, v_prox, op_avancar_p2.motivo);
  end loop;

  return v_atual;
end;
$$;
comment on function privado.op_avancar_p2(uuid, text, text) is '[P35/P36] Anda o P2 até o alvo pela linha principal (PRD 7.2), sempre por privado.transicionar; bebe_nasceu vai direto. Já no alvo ou adiante: nada. Sem grant.';

create function privado.op_notificar(
  papel      public.papel_usuario,
  usuario_id uuid,
  prioridade public.prioridade,
  titulo     text,
  corpo      text default null,
  link       text default null
) returns void
  language sql
  volatile
  set search_path = ''
  as $$
  insert into public.notificacao (papel, usuario_id, prioridade, titulo, corpo, link)
  values (op_notificar.papel, op_notificar.usuario_id, op_notificar.prioridade, op_notificar.titulo,
          op_notificar.corpo, op_notificar.link)
$$;
comment on function privado.op_notificar(public.papel_usuario, uuid, public.prioridade, text, text, text) is '[P35/P36] Aviso interno (central de notificação): por papel inteiro ou por pessoa. O título nunca leva nome de família (a notificação por push mostra só o título). Sem grant.';

create function privado.op_evento(familia_id uuid, tipo text, titulo text, dados jsonb, restrito boolean) returns void
  language sql
  volatile
  set search_path = ''
  as $$
  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (op_evento.familia_id, op_evento.tipo, op_evento.titulo, coalesce(op_evento.dados, '{}'),
          op_evento.restrito, auth.uid())
$$;
comment on function privado.op_evento(uuid, text, text, jsonb, boolean) is '[P35/P36] Evento da linha do tempo. restrito = true para o que é assistencial (conteúdo da entrevista, alta). Nunca leva resposta da ficha. Sem grant.';

-- Automação interna ou operacional: dedup por família, ativa no catálogo e
-- freio reconsultado na hora. Devolve o id da execução (já executada) ou
-- nulo se a automação está desligada, se já rodou (quando unica) ou se o
-- freio a barrou.
create function privado.op_iniciar_automacao(
  automacao_id text,
  familia_id   uuid,
  unica        boolean,
  payload      jsonb default null
) returns uuid
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_exec uuid;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = op_iniciar_automacao.automacao_id), false) then
    return null;
  end if;
  if op_iniciar_automacao.unica and exists (
       select 1 from public.automacao_execucao e
       where e.automacao_id = op_iniciar_automacao.automacao_id
         and e.familia_id = op_iniciar_automacao.familia_id
         and e.status in ('agendada', 'executada')) then
    return null;
  end if;

  insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
  values (op_iniciar_automacao.automacao_id, op_iniciar_automacao.familia_id, pg_catalog.clock_timestamp(),
          'agendada', op_iniciar_automacao.payload)
  returning id into v_exec;

  if not privado.pode_executar(op_iniciar_automacao.familia_id, op_iniciar_automacao.automacao_id, v_exec) then
    return null;
  end if;

  update public.automacao_execucao set status = 'executada', executada_em = pg_catalog.clock_timestamp()
   where id = v_exec;
  return v_exec;
end;
$$;
comment on function privado.op_iniciar_automacao(text, uuid, boolean, jsonb) is '[P35/P36] Abre e conclui a execução de uma automação do catálogo: desligada ou já executada (quando unica) devolve nulo; o freio é reconsultado por privado.pode_executar (invariante 3) e o aborto fica registrado. Sem grant.';

-- Acompanhamento vivo da família (o mais recente que não terminou).
create function privado.op_acompanhamento(familia_id uuid) returns public.acompanhamento
  language sql
  stable
  set search_path = ''
  as $$
  select a.*
  from public.acompanhamento a
  where a.familia_id = op_acompanhamento.familia_id
    and a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico')
  order by a.criado_em desc, a.id
  limit 1
$$;
comment on function privado.op_acompanhamento(uuid) is '[P35/P36] Acompanhamento da família que ainda não terminou (o mais recente). Sem grant.';

-- Cria o acompanhamento (em aguardando) a partir do contrato mais recente.
create function privado.garantir_acompanhamento(familia_id uuid) returns uuid
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_a public.acompanhamento;
  v_k record;
  v_id uuid;
begin
  v_a := privado.op_acompanhamento(garantir_acompanhamento.familia_id);
  if v_a.id is not null then
    return v_a.id;
  end if;

  select k.id as contrato_id, pc.dias, pv.horas_por_visita
    into v_k
  from public.contrato k
  join public.pacote_versao pv on pv.id = k.pacote_versao_id
  join public.pacote pc on pc.id = pv.pacote_id
  where k.familia_id = garantir_acompanhamento.familia_id
    and k.status not in ('cancelado', 'distrato')
  order by k.criado_em desc, k.id
  limit 1;
  if not found then
    return null;
  end if;

  insert into public.acompanhamento (contrato_id, familia_id, dias_contratados, horas_por_visita, estado)
  values (v_k.contrato_id, garantir_acompanhamento.familia_id, v_k.dias, v_k.horas_por_visita, 'aguardando')
  returning id into v_id;
  return v_id;
end;
$$;
comment on function privado.garantir_acompanhamento(uuid) is '[P36] Acompanhamento em aguardando a partir do contrato mais recente (dias e horas da versão do pacote). Idempotente. Sem grant.';

-- Profissional titular ou backup ativa (aceita) do acompanhamento vivo.
create function privado.op_designada(familia_id uuid, papel public.papel_designacao) returns public.designacao
  language sql
  stable
  set search_path = ''
  as $$
  select d.*
  from public.designacao d
  join public.acompanhamento a on a.id = d.acompanhamento_id
  where a.familia_id = op_designada.familia_id
    and a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico')
    and d.papel = op_designada.papel
    and d.status = 'aceita'
  order by d.criado_em desc, d.id
  limit 1
$$;
comment on function privado.op_designada(uuid, public.papel_designacao) is '[P36] Designação aceita (titular ou backup) do acompanhamento vivo da família. Sem grant.';

create function privado.op_nome_profissional(profissional_id uuid) returns text
  language sql
  stable
  set search_path = ''
  as $$ select p.nome from public.profissional p where p.id = op_nome_profissional.profissional_id $$;
comment on function privado.op_nome_profissional(uuid) is '[P36] Nome da profissional (a RLS de profissional não vale dentro das funções). Sem grant.';

-- Usuário (perfil) ligado à profissional, para o aviso individual.
create function privado.op_usuario_profissional(profissional_id uuid) returns uuid
  language sql
  stable
  set search_path = ''
  as $$ select p.usuario_id from public.profissional p where p.id = op_usuario_profissional.profissional_id $$;
comment on function privado.op_usuario_profissional(uuid) is '[P36] perfil.id da profissional (nulo se ainda não tem login). Sem grant.';

-- Dias sem contato: o último instante em que a família escreveu ou uma
-- pessoa da equipe respondeu, ou em que o check-in de DPP foi concluído.
-- Nulo se nunca houve.
create function privado.op_ultimo_contato(familia_id uuid) returns timestamptz
  language sql
  stable
  set search_path = ''
  as $$
  select greatest(
    (select max(m.enviada_em)
       from public.mensagem m
       join public.conversa c on c.id = m.conversa_id
      where c.familia_id = op_ultimo_contato.familia_id
        and (m.direcao = 'entrada' or m.enviado_por = 'humano')),
    (select max(t.concluida_em)
       from public.tarefa t
      where t.familia_id = op_ultimo_contato.familia_id and t.tipo = 'checkin_dpp' and t.status = 'concluida'))
$$;
comment on function privado.op_ultimo_contato(uuid) is '[P36] Último contato com a família: mensagem dela ou de uma pessoa da equipe, ou check-in de DPP concluído. Mensagem da Isadora não conta. Sem grant.';


-- =============================================================================
-- 3. P35 · Pagamento confirmado abre a consulta pré-natal (PRD 7.2, 10.1)
-- =============================================================================

-- Abre a consulta pré-natal e a tarefa agendar_prenatal. Idempotente: uma
-- consulta viva por família. Acima do limite de semanas
-- (parametro.prenatal_semanas_alerta) a consulta nasce urgente, a tarefa com
-- prioridade máxima e a coordenação é avisada (prenatal_urgente, interna).
-- Família que já teve o parto não ganha consulta: a entrevista de
-- pré-natal depois do nascimento é proposta da versão 2 do DOC 1.
create function privado.abrir_prenatal(familia_id uuid) returns uuid
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_f       public.familia;
  v_c       uuid;
  v_limite  numeric := privado.venda_numero('prenatal_semanas_alerta');
  v_dias    integer;
  v_urgente boolean := false;
  v_versao  text;
  v_vence   timestamptz;
  v_exec    uuid;
  v_ig      text;
begin
  select f.* into v_f from public.familia f where f.id = abrir_prenatal.familia_id;
  if not found or v_f.mesclada_em_id is not null or v_f.data_nascimento is not null then
    return null;
  end if;

  select cp.id into v_c
  from public.consulta_prenatal cp
  where cp.familia_id = v_f.id and cp.status in ('pendente', 'agendada', 'realizada');
  if found then
    return v_c;
  end if;

  if v_f.dpp is not null then
    v_dias := privado.op_hoje() - (v_f.dpp - 280);
    if v_limite is not null then
      v_urgente := v_dias > v_limite::integer * 7;
      v_vence := ((v_f.dpp - 280 + v_limite::integer * 7) + time '09:00') at time zone 'America/Sao_Paulo';
    end if;
    v_ig := (public.ig(v_f.dpp, privado.op_hoje())).texto;
  end if;

  -- a versão mais nova do DOC 1, aprovada de preferência; a entrevista só
  -- abre com versão aprovada (api.prenatal_abrir)
  select i.versao into v_versao
  from public.instrumento i
  where i.codigo = 'DOC1_ENTREVISTA'
  order by i.vigente desc, i.criado_em desc, i.id
  limit 1;

  insert into public.consulta_prenatal (familia_id, instrumento_versao, urgente, status)
  values (v_f.id, coalesce(v_versao, 'pendente'), v_urgente, 'pendente')
  returning id into v_c;

  insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload, vence_em, origem_automacao_id)
  values (
    'agendar_prenatal', v_f.id, 'coordenacao',
    case when v_urgente then 'maxima'::public.prioridade else 'normal'::public.prioridade end,
    case when v_urgente then 'Agendar a consulta pré-natal com urgência' else 'Agendar a consulta pré-natal' end,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'consulta_prenatal_id', v_c, 'urgente', v_urgente, 'ig', v_ig)),
    case when v_urgente then pg_catalog.clock_timestamp() else v_vence end,
    case when v_urgente then 'prenatal_urgente' end);

  if v_urgente then
    v_exec := privado.op_iniciar_automacao('prenatal_urgente', v_f.id, true,
                pg_catalog.jsonb_build_object('consulta_prenatal_id', v_c));
    if v_exec is not null then
      perform privado.op_notificar('coordenacao', null, 'maxima',
        'Pré-natal urgente: pagamento com mais de 34 semanas',
        'Marque a consulta pré-natal o quanto antes. Família: ' || v_f.nome_exibicao || ', ' || coalesce(v_ig, 'IG sem DPP') || '.',
        '/prenatal/' || v_f.id::text);
    end if;
  end if;

  perform privado.op_evento(v_f.id, 'prenatal',
    case when v_urgente then 'Consulta pré-natal urgente a agendar' else 'Consulta pré-natal a agendar' end,
    pg_catalog.jsonb_build_object('consulta_prenatal_id', v_c, 'urgente', v_urgente), false);
  return v_c;
end;
$$;
comment on function privado.abrir_prenatal(uuid) is '[P35 item 1] Abre a consulta pré-natal (uma viva por família) e a tarefa agendar_prenatal para a coordenação; acima de parametro.prenatal_semanas_alerta a consulta é urgente, a tarefa tem prioridade máxima e a coordenação é avisada (prenatal_urgente, interna). Família que já teve o parto não ganha consulta. Sem grant.';

create function privado.ao_pagar_cobranca() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_familia uuid;
  v_o       public.oportunidade;
begin
  select k.familia_id into v_familia from public.contrato k where k.id = new.contrato_id;
  if v_familia is null then
    return null;
  end if;

  -- O pagamento é a verdade que chegou: se o que vem depois falhar, a baixa
  -- da cobrança não pode voltar atrás. A falha vira tarefa para a coordenação.
  begin
    v_o := privado.venda_oportunidade(v_familia);
    if v_o.id is not null and v_o.estagio_p2 = 'cobranca_gerada' then
      perform privado.transicionar('p2', v_o.id, 'pagamento_confirmado', 'Pagamento confirmado');
    end if;
    perform privado.garantir_acompanhamento(v_familia);
    perform privado.abrir_prenatal(v_familia);
  exception
    when others then
      insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
      values ('outro', v_familia, 'coordenacao', 'alta',
              'Conferir o pré-natal: o sistema não conseguiu abrir a consulta depois do pagamento',
              pg_catalog.jsonb_build_object('cobranca_id', new.id, 'codigo', sqlstate));
  end;
  return null;
end;
$$;
comment on function privado.ao_pagar_cobranca() is '[P35 item 1] Gatilho AFTER UPDATE de cobranca quando passa a paga: leva o P2 a pagamento_confirmado (se ainda em cobranca_gerada), cria o acompanhamento em aguardando e abre a consulta pré-natal. Falha depois da baixa vira tarefa para a coordenação e nunca desfaz o pagamento.';

create trigger ao_pagar_cobranca
  after update of status on public.cobranca
  for each row
  when (new.status = 'paga' and old.status is distinct from 'paga')
  execute function privado.ao_pagar_cobranca();


-- =============================================================================
-- 4. P35 · Alerta de 34 semanas (PRD 10.1, D-10): diário, só interno
--
-- Substitui privado.recalculo_alerta_34s da 0012: o limite vem de
-- parametro.prenatal_semanas_alerta (sem ele a etapa não dispara), só entram
-- famílias com contrato (pagamento confirmado e antes do nascimento), e o
-- aviso leva o link da ficha e o que ainda falta. Uma vez por família. A
-- notificação vai para a coordenação e nunca para a família.
-- =============================================================================

create or replace function privado.recalculo_alerta_34s() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_hoje        date := privado.op_hoje();
  v_limite      numeric := privado.venda_numero('prenatal_semanas_alerta');
  v_rec         record;
  v_exec        uuid;
  v_avaliadas   integer := 0;
  v_notificadas integer := 0;
  v_falta       text;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = 'alerta_34s'), false) then
    return pg_catalog.jsonb_build_object('ativa', false);
  end if;
  if v_limite is null then
    return pg_catalog.jsonb_build_object('ativa', true, 'parametro_ausente', 'prenatal_semanas_alerta');
  end if;

  for v_rec in
    select f.id as familia_id, f.nome_exibicao, f.dpp,
           (select cp.status::text from public.consulta_prenatal cp
             where cp.familia_id = f.id and cp.status in ('pendente', 'agendada', 'realizada')) as prenatal,
           (privado.op_designada(f.id, 'titular')).id as titular_id
    from public.familia f
    join public.oportunidade o on o.familia_id = f.id
    where f.mesclada_em_id is null
      and f.dpp is not null
      and f.data_nascimento is null
      and o.estagio_p2 in ('pagamento_confirmado', 'nota_fiscal_emitida', 'consulta_prenatal_agendada',
                           'consulta_realizada', 'enfermeira_designada', 'aguardando_nascimento')
      and (v_hoje - (f.dpp - 280)) >= v_limite::integer * 7
      and not exists (select 1 from public.automacao_execucao e
                        where e.automacao_id = 'alerta_34s' and e.familia_id = f.id)
  loop
    v_avaliadas := v_avaliadas + 1;
    v_exec := privado.op_iniciar_automacao('alerta_34s', v_rec.familia_id, true);
    if v_exec is null then
      continue;
    end if;

    v_falta := concat_ws(' ',
      case when v_rec.prenatal is distinct from 'realizada' then 'A consulta pré-natal ainda não foi feita.' end,
      case when v_rec.titular_id is null then 'Falta a titular.' end);
    perform privado.op_notificar('coordenacao', null, 'normal',
      'Uma família chegou às 34 semanas',
      v_rec.nome_exibicao || ', ' || (public.ig(v_rec.dpp, v_hoje)).texto || '. '
        || coalesce(nullif(v_falta, ''), 'Pré-natal feito e titular definida.'),
      '/familias/' || v_rec.familia_id::text);
    v_notificadas := v_notificadas + 1;
  end loop;

  return pg_catalog.jsonb_build_object('ativa', true, 'familias_avaliadas', v_avaliadas, 'notificadas', v_notificadas);
end;
$$;
comment on function privado.recalculo_alerta_34s() is 'Etapa alerta_34s do recálculo diário (0011, PRD 10.1, D-10, P35 item 4): notifica só a coordenação, uma vez por família com contrato, ao chegar a parametro.prenatal_semanas_alerta (34) semanas; o aviso diz o que falta (consulta, titular) e leva o link da ficha. Nada à família. Sem o parâmetro, não dispara. Sem grant.';


-- =============================================================================
-- 5. P35 · Leitura auditada da consulta pré-natal
-- =============================================================================

create function assistencial.ler_consulta_prenatal(familia_id uuid) returns setof public.consulta_prenatal
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  if ler_consulta_prenatal.familia_id is null then
    raise exception 'ler_consulta_prenatal: familia_id é obrigatório'
      using errcode = '22023';
  end if;

  -- 1. registra a leitura (se o insert falhar, nada é devolvido)
  perform privado.registrar_leitura(
    'consulta_prenatal',
    ler_consulta_prenatal.familia_id::text,
    pg_catalog.jsonb_build_object('familia_id', ler_consulta_prenatal.familia_id)
  );

  -- 2. só depois devolve
  return query
    select cp.*
    from public.consulta_prenatal cp
    where cp.familia_id = ler_consulta_prenatal.familia_id
    order by (cp.status in ('pendente', 'agendada', 'realizada')) desc, cp.criado_em desc, cp.id;
end;
$$;
comment on function assistencial.ler_consulta_prenatal(uuid) is '[P35] Leitura auditada da consulta pré-natal de uma família (ficha do DOC 1, plano de cuidado, período): grava ''leitura'' em log_auditoria antes de devolver. volatile e security definer. Sem grant: o app chega aqui por api.prenatal_abrir, que confere papel e AAL2.';


-- =============================================================================
-- 6. P35 · Funções da consulta pré-natal (schema api)
-- =============================================================================

-- Tarefa aberta de um tipo para a família, sem duplicar.
create function privado.op_tarefa_aberta(familia_id uuid, tipo public.tipo_tarefa) returns uuid
  language sql
  stable
  set search_path = ''
  as $$
  select t.id
  from public.tarefa t
  where t.familia_id = op_tarefa_aberta.familia_id and t.tipo = op_tarefa_aberta.tipo
    and t.status in ('aberta', 'em_andamento')
  order by t.criado_em desc, t.id
  limit 1
$$;
comment on function privado.op_tarefa_aberta(uuid, public.tipo_tarefa) is '[P35/P36] Tarefa aberta (ou em andamento) de um tipo para a família, nula se não há. Sem grant.';

create function privado.op_fechar_tarefas(familia_id uuid, tipo public.tipo_tarefa) returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_n integer;
begin
  update public.tarefa t
     set status = 'concluida', concluida_em = pg_catalog.now(), concluida_por = auth.uid()
   where t.familia_id = op_fechar_tarefas.familia_id and t.tipo = op_fechar_tarefas.tipo
     and t.status in ('aberta', 'em_andamento');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.op_fechar_tarefas(uuid, public.tipo_tarefa) is '[P35/P36] Conclui as tarefas abertas de um tipo para a família (a ação que elas pediam foi feita). Sem grant.';

-- Definição aprovada do DOC 1 de uma versão (vigente ou já aprovada).
create function privado.prenatal_definicao(versao text) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select i.definicao
  from public.instrumento i
  where i.codigo = 'DOC1_ENTREVISTA' and i.versao = prenatal_definicao.versao
    and (i.vigente or i.aprovado_em is not null)
$$;
comment on function privado.prenatal_definicao(text) is '[P35] Definição do DOC 1 de uma versão, só se aprovada (vigente ou com aprovado_em): campo clínico só vem de instrumento aprovado (CLAUDE.md). Sem grant.';

-- O campo (objeto da definição) de um bloco; nulo se não existe.
create function privado.prenatal_campo(definicao jsonb, bloco text, campo text) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select c.valor
  from pg_catalog.jsonb_array_elements(prenatal_campo.definicao -> 'blocos') as b(valor),
       pg_catalog.jsonb_array_elements(b.valor -> 'campos') as c(valor)
  where b.valor ->> 'id' = prenatal_campo.bloco and c.valor ->> 'id' = prenatal_campo.campo
  limit 1
$$;
comment on function privado.prenatal_campo(jsonb, text, text) is '[P35] Campo de um bloco da definição do instrumento (jsonb), nulo se não existe. Sem grant.';

-- Quantas respostas a ficha tem (folhas dos blocos).
create function privado.prenatal_respondidos(ficha jsonb) returns integer
  language sql
  immutable
  set search_path = ''
  as $$
  select coalesce(sum(case when pg_catalog.jsonb_typeof(b.valor) = 'object'
                           then (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(b.valor)) else 0 end), 0)::integer
  from pg_catalog.jsonb_each(coalesce(prenatal_respondidos.ficha, '{}'::jsonb)) as b(chave, valor)
$$;
comment on function privado.prenatal_respondidos(jsonb) is '[P35] Quantos campos a ficha do DOC 1 tem respondidos. Sem grant.';

-- --- 6.1 api.prenatal_consultas --------------------------------------------------------
create function api.prenatal_consultas() returns jsonb
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

  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'consulta_id', cp.id,
             'familia_id', f.id,
             'nome', f.nome_exibicao,
             'status', cp.status,
             'urgente', cp.urgente,
             'agendada_para', cp.agendada_para,
             'realizada_em', cp.realizada_em,
             'iniciada_em', cp.iniciada_em,
             'etapa', case when pg_catalog.jsonb_typeof(cp.progresso -> 'etapa') = 'number'
                           then (cp.progresso ->> 'etapa')::integer end,
             'parou_em', cp.progresso ->> 'em',
             'respondidos', privado.prenatal_respondidos(cp.ficha),
             'dpp', f.dpp,
             'ig', case when f.dpp is not null then (public.ig(f.dpp, privado.op_hoje())).texto end,
             'ig_semanas', case when f.dpp is not null then (public.ig(f.dpp, privado.op_hoje())).semanas end,
             'chegou_alerta', f.dpp is not null and f.data_nascimento is null
                              and privado.venda_numero('prenatal_semanas_alerta') is not null
                              and (privado.op_hoje() - (f.dpp - 280)) >= privado.venda_numero('prenatal_semanas_alerta')::integer * 7,
             'cidade', c.nome,
             'uf', c.uf,
             'estagio_p2', o.estagio_p2)
           order by cp.urgente desc, (cp.status = 'realizada'), cp.agendada_para nulls last, cp.criado_em, cp.id)
    from public.consulta_prenatal cp
    join public.familia f on f.id = cp.familia_id
    left join public.cidade c on c.id = f.cidade_id
    left join lateral privado.venda_oportunidade(f.id) o on true
    where cp.status in ('pendente', 'agendada', 'realizada')
      and f.mesclada_em_id is null
  ), '[]'::jsonb);
end;
$$;
comment on function api.prenatal_consultas() is '[P35] Lista da coordenação: consultas pré-natais vivas (pendente, agendada, realizada) com estado, urgência, agenda, etapa onde parou e quantos campos foram respondidos. Sem o conteúdo da ficha (isso é api.prenatal_abrir, com log). Coordenação e diretoria, AAL2.';

-- --- 6.2 api.prenatal_estado ----------------------------------------------------------------
create function api.prenatal_estado(familia_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_cp public.consulta_prenatal;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if prenatal_estado.familia_id is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'familia_id');
  end if;

  select cp.* into v_cp
  from public.consulta_prenatal cp
  where cp.familia_id = prenatal_estado.familia_id and cp.status in ('pendente', 'agendada', 'realizada');
  if not found then
    return pg_catalog.jsonb_build_object('existe', false);
  end if;

  -- só o estado: nenhuma resposta, nenhum plano, nenhum período
  return pg_catalog.jsonb_build_object(
    'existe', true,
    'status', v_cp.status,
    'agendada_para', v_cp.agendada_para,
    'realizada_em', v_cp.realizada_em,
    'em_andamento', v_cp.iniciada_em is not null and v_cp.status <> 'realizada');
end;
$$;
comment on function api.prenatal_estado(uuid) is '[P35] Estado da consulta pré-natal de uma família (existe, status, agenda, realizada em, em andamento) para comercial, coordenação e diretoria. Nunca devolve resposta, plano de cuidado nem período: o conteúdo é só da coordenação e da diretoria (fluxos.md B).';

-- --- 6.3 api.agendar_consulta_prenatal ------------------------------------------------------
create function api.agendar_consulta_prenatal(
  familia_id    uuid,
  agendada_para timestamptz,
  conduzida_por uuid default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid   uuid := auth.uid();
  v_f     public.familia;
  v_cp    public.consulta_prenatal;
  v_o     public.oportunidade;
  v_cond  uuid := coalesce(agendar_consulta_prenatal.conduzida_por, auth.uid());
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if agendar_consulta_prenatal.familia_id is null or agendar_consulta_prenatal.agendada_para is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'familia_id e agendada_para');
  end if;
  if agendar_consulta_prenatal.agendada_para <= pg_catalog.now() then
    perform privado.operacao_recusar('data_no_passado');
  end if;
  if not exists (select 1 from public.perfil p
                 join public.usuario_papel up on up.usuario_id = p.id
                 where p.id = v_cond and p.ativo and up.papel in ('coordenacao', 'diretoria')) then
    perform privado.operacao_recusar('condutor_invalido');
  end if;

  select f.* into v_f from public.familia f where f.id = agendar_consulta_prenatal.familia_id for update;
  if not found or v_f.mesclada_em_id is not null then
    perform privado.operacao_recusar('familia_inexistente');
  end if;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    perform privado.operacao_recusar('familia_em_estado_sensivel');
  end if;

  select cp.* into v_cp
  from public.consulta_prenatal cp
  where cp.familia_id = v_f.id and cp.status in ('pendente', 'agendada', 'realizada')
  for update;
  if not found then
    perform privado.operacao_recusar('sem_consulta');
  end if;
  if v_cp.status = 'realizada' then
    perform privado.operacao_recusar('consulta_ja_realizada');
  end if;

  update public.consulta_prenatal cp
     set agendada_para = agendar_consulta_prenatal.agendada_para, conduzida_por = v_cond, status = 'agendada'
   where cp.id = v_cp.id;

  -- P2: só sai de pagamento_confirmado (ou nota_fiscal_emitida) na primeira vez
  v_o := privado.venda_oportunidade(v_f.id);
  if v_o.id is not null and privado.op_posicao_p2(v_o.estagio_p2::text) = 1 then
    perform privado.transicionar('p2', v_o.id, 'consulta_prenatal_agendada', 'Consulta pré-natal marcada');
  end if;

  perform privado.op_fechar_tarefas(v_f.id, 'agendar_prenatal');
  perform privado.op_evento(v_f.id, 'prenatal',
    'Consulta pré-natal marcada para ' || privado.formatar_data_hora(agendar_consulta_prenatal.agendada_para),
    pg_catalog.jsonb_build_object('consulta_prenatal_id', v_cp.id, 'agendada_para', agendar_consulta_prenatal.agendada_para),
    false);
  perform privado.venda_log('consulta_prenatal_agendada', 'consulta_prenatal', v_cp.id::text, null,
    pg_catalog.jsonb_build_object('familia_id', v_f.id, 'agendada_para', agendar_consulta_prenatal.agendada_para,
                                  'conduzida_por', v_cond));

  return pg_catalog.jsonb_build_object('ok', true, 'consulta_id', v_cp.id, 'agendada_para', agendar_consulta_prenatal.agendada_para);
end;
$$;
comment on function api.agendar_consulta_prenatal(uuid, timestamptz, uuid) is '[P35 itens 1 e 5] Marca ou remarca a consulta pré-natal: coordenação ou diretoria, AAL2, data futura, condutor com papel de coordenação ou diretoria, família fora de bloqueio total e de encerramento sensível. Na primeira vez o P2 sai de pagamento_confirmado para consulta_prenatal_agendada (privado.transicionar) e a tarefa agendar_prenatal é concluída. Evento e log. Recusa: erro P0001 "operacao:<código>".';

-- --- 6.4 api.prenatal_abrir ------------------------------------------------------------------
create function api.prenatal_abrir(familia_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_f       public.familia;
  v_cp      public.consulta_prenatal;
  v_def     jsonb;
  v_vigente text;
  v_tel     text;
  v_cidade  record;
  v_nome    text;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  if prenatal_abrir.familia_id is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'familia_id');
  end if;

  select f.* into v_f from public.familia f where f.id = prenatal_abrir.familia_id and f.mesclada_em_id is null;
  if not found then
    perform privado.operacao_recusar('familia_inexistente');
  end if;

  -- leitura auditada (grava no log antes de devolver); a viva vem primeiro
  select cp.* into v_cp from assistencial.ler_consulta_prenatal(v_f.id) cp limit 1;
  if not found or v_cp.status not in ('pendente', 'agendada', 'realizada') then
    perform privado.operacao_recusar('sem_consulta');
  end if;

  -- toda entrevista nasce em branco: sem resposta nenhuma, vale a versão
  -- aprovada mais nova; com resposta, a versão em que foi respondida
  if privado.prenatal_respondidos(v_cp.ficha) = 0 and v_cp.status <> 'realizada' then
    select i.versao into v_vigente
    from public.instrumento i
    where i.codigo = 'DOC1_ENTREVISTA' and i.vigente
    order by i.criado_em desc, i.id
    limit 1;
    if v_vigente is not null and v_vigente is distinct from v_cp.instrumento_versao then
      update public.consulta_prenatal cp set instrumento_versao = v_vigente where cp.id = v_cp.id
      returning cp.* into v_cp;
    end if;
  end if;

  v_def := privado.prenatal_definicao(v_cp.instrumento_versao);
  if v_def is null then
    perform privado.operacao_recusar('instrumento_nao_aprovado');
  end if;

  select p.telefone_e164 into v_tel from privado.venda_gestante(v_f.id) p;
  select c.nome, c.uf into v_cidade from public.cidade c where c.id = v_f.cidade_id;
  select p.nome into v_nome from public.perfil p where p.id = auth.uid();

  return pg_catalog.jsonb_build_object(
    'consulta', pg_catalog.jsonb_build_object(
      'id', v_cp.id, 'status', v_cp.status, 'urgente', v_cp.urgente, 'agendada_para', v_cp.agendada_para,
      'realizada_em', v_cp.realizada_em, 'iniciada_em', v_cp.iniciada_em,
      'instrumento_versao', v_cp.instrumento_versao, 'versao', v_cp.versao, 'progresso', v_cp.progresso),
    'definicao', v_def,
    'respostas', v_cp.ficha,
    'familia', pg_catalog.jsonb_build_object(
      'id', v_f.id, 'nome', v_f.nome_exibicao, 'dpp', v_f.dpp, 'gemelar', v_f.gemelar,
      'cidade', v_cidade.nome, 'uf', v_cidade.uf,
      'ig', case when v_f.dpp is not null then (public.ig(v_f.dpp, privado.op_hoje())).texto end,
      'ig_semanas', case when v_f.dpp is not null then (public.ig(v_f.dpp, privado.op_hoje())).semanas end),
    -- Dados que já estão na ficha desta mesma família, para confirmar. A
    -- origem do lead fica de fora: "Lead e origem" é sem acesso para a
    -- coordenação (PRD 13).
    'sugestoes', pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'B.data_provavel_do_parto', v_f.dpp,
      'C.telefone_da_gestante', v_tel)),
    'coletador', v_nome);
end;
$$;
comment on function api.prenatal_abrir(uuid) is '[P35 itens 2 e 3] Abre a entrevista do DOC 1: coordenação ou diretoria, AAL2. A leitura vai para o log (assistencial.ler_consulta_prenatal). Sem resposta, a versão passa a ser a aprovada mais nova (toda entrevista nasce em branco, nunca copia outra família); só abre com versão aprovada (instrumento_nao_aprovado). Devolve consulta (com versao e onde parou), definição, respostas, contexto da família e as sugestões do cadastro da mesma família (DPP, telefone da gestante).';

-- --- 6.5 api.prenatal_salvar_campo ------------------------------------------------------------
-- Um campo por vez, na ordem em que o motor offline (P12) sobe. Sem bloco,
-- só grava onde a pessoa parou. Conflito de versão devolve ok = false sem
-- gravar (o original fica intacto). Depois de concluída, alterar exige
-- motivo e deixa evento com autor.
create function api.prenatal_salvar_campo(
  consulta_id uuid,
  bloco       text,
  campo       text,
  valor       jsonb,
  versao_base integer default null,
  progresso   jsonb default null,
  motivo      text default null,
  item_id     uuid default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid     uuid := auth.uid();
  v_cp      public.consulta_prenatal;
  v_def     jsonb;
  v_campo   jsonb;
  v_bloco   jsonb;
  v_ficha   jsonb;
  v_valor   jsonb := coalesce(prenatal_salvar_campo.valor, 'null'::jsonb);
  v_destino text;
  v_plano   text;
  v_periodo public.periodo_visita[];
  v_prog    jsonb;
  v_motivo  text := nullif(pg_catalog.btrim(prenatal_salvar_campo.motivo), '');
  v_especialidade public.especialidade_medico;
  v_nome    text;
  v_tel     text;
  v_novo    integer;
  v_repetido jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select cp.* into v_cp from public.consulta_prenatal cp where cp.id = prenatal_salvar_campo.consulta_id for update;
  if not found then
    perform privado.operacao_recusar('sem_consulta');
  end if;
  if v_cp.status not in ('pendente', 'agendada', 'realizada') then
    perform privado.operacao_recusar('consulta_encerrada');
  end if;
  -- item já aplicado (reenvio depois de queda de rede antes do ack): o mesmo resultado
  if prenatal_salvar_campo.item_id is not null then
    select si.resultado into v_repetido from privado.sync_item si
    where si.item_id = prenatal_salvar_campo.item_id and si.entidade_id = v_cp.id;
    if found then
      return v_repetido || pg_catalog.jsonb_build_object('repetido', true);
    end if;
  end if;
  if prenatal_salvar_campo.versao_base is not null and prenatal_salvar_campo.versao_base <> v_cp.versao then
    return pg_catalog.jsonb_build_object('ok', false, 'conflito', true, 'versao', v_cp.versao,
             'original', case when prenatal_salvar_campo.bloco is null then null
                              else v_cp.ficha -> prenatal_salvar_campo.bloco -> prenatal_salvar_campo.campo end);
  end if;

  -- onde a pessoa parou
  if prenatal_salvar_campo.progresso is not null then
    if pg_catalog.jsonb_typeof(prenatal_salvar_campo.progresso) <> 'object'
       or pg_catalog.jsonb_typeof(prenatal_salvar_campo.progresso -> 'etapa') is distinct from 'number' then
      perform privado.operacao_recusar('progresso_invalido');
    end if;
    v_prog := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'etapa', (prenatal_salvar_campo.progresso ->> 'etapa')::integer,
      'campo', case when pg_catalog.jsonb_typeof(prenatal_salvar_campo.progresso -> 'campo') = 'string'
                    then pg_catalog.left(prenatal_salvar_campo.progresso ->> 'campo', 120) end,
      'em', pg_catalog.clock_timestamp()));
  end if;

  if prenatal_salvar_campo.bloco is null then
    if v_prog is null then
      perform privado.operacao_recusar('dados_obrigatorios', 'bloco ou progresso');
    end if;
    update public.consulta_prenatal cp set progresso = v_prog where cp.id = v_cp.id
    returning cp.versao into v_novo;
    if prenatal_salvar_campo.item_id is not null then
      insert into privado.sync_item (item_id, entidade, entidade_id, resultado)
      values (prenatal_salvar_campo.item_id, 'consulta_prenatal', v_cp.id,
              pg_catalog.jsonb_build_object('ok', true, 'versao', v_novo));
    end if;
    return pg_catalog.jsonb_build_object('ok', true, 'versao', v_novo);
  end if;

  v_def := privado.prenatal_definicao(v_cp.instrumento_versao);
  if v_def is null then
    perform privado.operacao_recusar('instrumento_nao_aprovado');
  end if;
  v_campo := privado.prenatal_campo(v_def, prenatal_salvar_campo.bloco, prenatal_salvar_campo.campo);
  if v_campo is null then
    perform privado.operacao_recusar('campo_inexistente');
  end if;
  if v_campo ->> 'tipo' = 'automatico' then
    perform privado.operacao_recusar('campo_automatico');
  end if;
  select b.valor into v_bloco
  from pg_catalog.jsonb_array_elements(v_def -> 'blocos') as b(valor)
  where b.valor ->> 'id' = prenatal_salvar_campo.bloco;
  if coalesce((v_bloco ->> 'repete_por_bebe')::boolean, false) then
    perform privado.operacao_recusar('campo_por_bebe');
  end if;
  if pg_catalog.length(v_valor::text) > 20000 then
    perform privado.operacao_recusar('valor_grande_demais');
  end if;

  if v_cp.status = 'realizada' and v_motivo is null then
    perform privado.operacao_recusar('motivo_obrigatorio');
  end if;

  -- a ficha: um campo trocado ou apagado (null), sem bloco vazio sobrando
  v_ficha := coalesce(v_cp.ficha, '{}'::jsonb);
  if pg_catalog.jsonb_typeof(v_valor) = 'null' then
    v_ficha := pg_catalog.jsonb_set(v_ficha, array[prenatal_salvar_campo.bloco],
                 coalesce(v_ficha -> prenatal_salvar_campo.bloco, '{}'::jsonb) - prenatal_salvar_campo.campo, true);
    if v_ficha -> prenatal_salvar_campo.bloco = '{}'::jsonb then
      v_ficha := v_ficha - prenatal_salvar_campo.bloco;
    end if;
  else
    v_ficha := pg_catalog.jsonb_set(v_ficha, array[prenatal_salvar_campo.bloco],
                 coalesce(v_ficha -> prenatal_salvar_campo.bloco, '{}'::jsonb)
                 || pg_catalog.jsonb_build_object(prenatal_salvar_campo.campo, v_valor), true);
  end if;

  -- destinos do bloco H (PRD 9.1): plano de cuidado, período, médicos
  v_plano := v_cp.plano_cuidado;
  v_periodo := v_cp.periodo_preferido;
  v_destino := v_campo ->> 'destino';
  if v_destino = 'consulta_prenatal.plano_cuidado' then
    v_plano := case when pg_catalog.jsonb_typeof(v_valor) = 'string' then nullif(v_valor #>> '{}', '') end;
  elsif v_destino = 'consulta_prenatal.periodo_preferido' then
    if pg_catalog.jsonb_typeof(v_valor) = 'null' or v_valor = '[]'::jsonb then
      v_periodo := null;
    elsif pg_catalog.jsonb_typeof(v_valor) = 'array' then
      begin
        select pg_catalog.array_agg(x.v::public.periodo_visita order by x.n)
          into v_periodo
        from pg_catalog.jsonb_array_elements_text(v_valor) with ordinality as x(v, n);
      exception
        when invalid_text_representation then
          perform privado.operacao_recusar('periodo_invalido');
      end;
    else
      perform privado.operacao_recusar('periodo_invalido');
    end if;
  end if;

  update public.consulta_prenatal cp
     set ficha = v_ficha,
         plano_cuidado = v_plano,
         periodo_preferido = v_periodo,
         iniciada_em = coalesce(cp.iniciada_em, pg_catalog.clock_timestamp()),
         progresso = coalesce(v_prog, cp.progresso)
   where cp.id = v_cp.id
  returning cp.versao into v_novo;

  if v_destino like 'medico.%' then
    v_especialidade := pg_catalog.split_part(v_destino, '.', 2)::public.especialidade_medico;
    -- nome e telefone do mesmo médico moram em campos irmãos (mesmo destino);
    -- o campo de teclado "telefone" é o telefone, o outro é o nome
    select nullif(pg_catalog.btrim(v_ficha -> (b.valor ->> 'id') ->> (c.valor ->> 'id')), '')
      into v_nome
    from pg_catalog.jsonb_array_elements(v_def -> 'blocos') as b(valor),
         pg_catalog.jsonb_array_elements(b.valor -> 'campos') as c(valor)
    where c.valor ->> 'destino' = v_destino and c.valor ->> 'teclado' is distinct from 'telefone'
    limit 1;
    select privado.telefone_e164(v_ficha -> (b.valor ->> 'id') ->> (c.valor ->> 'id'))
      into v_tel
    from pg_catalog.jsonb_array_elements(v_def -> 'blocos') as b(valor),
         pg_catalog.jsonb_array_elements(b.valor -> 'campos') as c(valor)
    where c.valor ->> 'destino' = v_destino and c.valor ->> 'teclado' = 'telefone'
    limit 1;

    if v_nome is null then
      delete from public.medico m
       where m.familia_id = v_cp.familia_id and m.especialidade = v_especialidade and m.origem_cadastro = 'prenatal';
    elsif exists (select 1 from public.medico m
                  where m.familia_id = v_cp.familia_id and m.especialidade = v_especialidade
                    and m.origem_cadastro = 'prenatal') then
      update public.medico m set nome = v_nome, telefone_e164 = v_tel
       where m.familia_id = v_cp.familia_id and m.especialidade = v_especialidade and m.origem_cadastro = 'prenatal';
    else
      insert into public.medico (familia_id, especialidade, nome, telefone_e164, origem_cadastro, capturado_em, criado_por)
      values (v_cp.familia_id, v_especialidade, v_nome, v_tel, 'prenatal', pg_catalog.now(), v_uid);
    end if;
  end if;

  if v_cp.status = 'realizada' then
    perform privado.op_evento(v_cp.familia_id, 'prenatal', 'Entrevista pré-natal alterada depois de concluída',
      pg_catalog.jsonb_build_object('consulta_prenatal_id', v_cp.id, 'bloco', prenatal_salvar_campo.bloco,
                                    'campo', prenatal_salvar_campo.campo, 'motivo', v_motivo), true);
  end if;

  if prenatal_salvar_campo.item_id is not null then
    insert into privado.sync_item (item_id, entidade, entidade_id, resultado)
    values (prenatal_salvar_campo.item_id, 'consulta_prenatal', v_cp.id,
            pg_catalog.jsonb_build_object('ok', true, 'versao', v_novo));
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'versao', v_novo);
end;
$$;
comment on function api.prenatal_salvar_campo(uuid, text, text, jsonb, integer, jsonb, text, uuid) is '[P35 itens 2 e 3] Grava um campo do DOC 1 (o motor offline do P12 sobe um por vez): coordenação ou diretoria, AAL2. Valida bloco e campo na definição aprovada, recusa campo automático e bloco por bebê, troca ou apaga só aquele campo, guarda onde a pessoa parou (progresso) e leva os destinos do bloco H (médicos em medico, plano de cuidado, período preferido). versao_base diferente da atual devolve conflito sem gravar. Concluída, só com motivo, e deixa evento restrito com autor. item_id (o id do item da fila do aparelho) torna o reenvio idempotente: o mesmo item devolve o mesmo resultado, sem reaplicar. O log de auditoria oculta a ficha (HMAC).';


-- --- 6.6 api.prenatal_concluir ----------------------------------------------------------------
create function api.prenatal_concluir(consulta_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid       uuid := auth.uid();
  v_cp        public.consulta_prenatal;
  v_f         public.familia;
  v_def       jsonb;
  v_faltam    text;
  v_o         public.oportunidade;
  v_titular   public.designacao;
  v_estagio   text;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select cp.* into v_cp from public.consulta_prenatal cp where cp.id = prenatal_concluir.consulta_id for update;
  if not found or v_cp.status not in ('pendente', 'agendada', 'realizada') then
    perform privado.operacao_recusar('sem_consulta');
  end if;
  if v_cp.status = 'realizada' then
    perform privado.operacao_recusar('consulta_ja_realizada');
  end if;
  select f.* into v_f from public.familia f where f.id = v_cp.familia_id for update;

  v_def := privado.prenatal_definicao(v_cp.instrumento_versao);
  if v_def is null then
    perform privado.operacao_recusar('instrumento_nao_aprovado');
  end if;

  -- obrigatórios sem condição para aparecer (a tela confere os condicionais)
  select pg_catalog.string_agg((b.valor ->> 'id') || '.' || (c.valor ->> 'id'), ', ' order by b.n, c.n)
    into v_faltam
  from pg_catalog.jsonb_array_elements(v_def -> 'blocos') with ordinality as b(valor, n),
       pg_catalog.jsonb_array_elements(b.valor -> 'campos') with ordinality as c(valor, n)
  where coalesce((c.valor ->> 'obrigatorio')::boolean, false)
    and c.valor ->> 'tipo' <> 'automatico'
    and not (b.valor ? 'aparece_se') and not (c.valor ? 'aparece_se')
    and not coalesce((b.valor ->> 'repete_por_bebe')::boolean, false)
    and (v_cp.ficha -> (b.valor ->> 'id') -> (c.valor ->> 'id')) is null;
  if v_faltam is not null then
    perform privado.operacao_recusar('obrigatorios_faltando', v_faltam);
  end if;

  update public.consulta_prenatal cp
     set status = 'realizada',
         realizada_em = pg_catalog.clock_timestamp(),
         agendada_para = coalesce(cp.agendada_para, pg_catalog.clock_timestamp()),
         conduzida_por = coalesce(cp.conduzida_por, v_uid)
   where cp.id = v_cp.id;

  perform privado.op_fechar_tarefas(v_f.id, 'agendar_prenatal');

  v_o := privado.venda_oportunidade(v_f.id);
  if v_o.id is not null and v_f.data_nascimento is null then
    perform privado.op_avancar_p2(v_o.id, 'consulta_realizada', 'Consulta pré-natal realizada');
    v_titular := privado.op_designada(v_f.id, 'titular');
    if v_titular.id is not null then
      perform privado.op_avancar_p2(v_o.id, 'aguardando_nascimento', 'Titular já designada');
    elsif privado.op_tarefa_aberta(v_f.id, 'designar_profissional') is null then
      insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
      values ('designar_profissional', v_f.id, 'coordenacao',
              case when v_cp.urgente then 'alta'::public.prioridade else 'normal'::public.prioridade end,
              'Designar a titular e o backup',
              pg_catalog.jsonb_build_object('motivo', 'consulta_realizada'));
    end if;
  end if;

  select o.estagio_p2::text into v_estagio from public.oportunidade o where o.id = v_o.id;
  perform privado.op_evento(v_f.id, 'prenatal', 'Entrevista pré-natal concluída',
    pg_catalog.jsonb_build_object('consulta_prenatal_id', v_cp.id), true);
  perform privado.venda_log('consulta_prenatal_concluida', 'consulta_prenatal', v_cp.id::text, null,
    pg_catalog.jsonb_build_object('familia_id', v_f.id));

  return pg_catalog.jsonb_build_object('ok', true, 'consulta_id', v_cp.id, 'estagio_p2', v_estagio);
end;
$$;
comment on function api.prenatal_concluir(uuid) is '[P35 itens 2 e 5] Conclui a entrevista do DOC 1: coordenação ou diretoria, AAL2. Confere os obrigatórios sem condição da definição, marca realizada, conclui a tarefa agendar_prenatal e leva o P2 a consulta_realizada (passando por consulta_prenatal_agendada se nunca foi marcada) e, havendo titular aceita, a aguardando_nascimento; sem titular, abre a tarefa designar_profissional. Família que já teve o parto não anda no P2.';


-- =============================================================================
-- 7. P36 · Designação: oferta e aceite, titular e backup (PRD 3.4, O-01)
-- =============================================================================

-- Avança o que depende da titular aceita: o P2 (consulta realizada e titular
-- aceita levam a enfermeira_designada e a aguardando_nascimento) e as
-- visitas, se a alta já foi registrada. Quem chama sem papel de coordenação
-- (a enfermeira que aceita) tem a transição recusada por
-- privado.transicionar; o cron faz depois (privado.processar_designacoes).
create function privado.avancar_designacao(familia_id uuid) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_f  public.familia;
  v_o  public.oportunidade;
  v_cp public.consulta_prenatal;
begin
  select f.* into v_f from public.familia f where f.id = avancar_designacao.familia_id;
  if not found or (privado.op_designada(v_f.id, 'titular')).id is null then
    return;
  end if;

  v_o := privado.venda_oportunidade(v_f.id);
  if v_o.id is not null and privado.op_posicao_p2(v_o.estagio_p2::text) = 3 and v_f.data_nascimento is null then
    select cp.* into v_cp from public.consulta_prenatal cp
    where cp.familia_id = v_f.id and cp.status = 'realizada';
    if found then
      perform privado.op_avancar_p2(v_o.id, 'aguardando_nascimento', 'Titular aceitou');
    end if;
  end if;

  if v_f.data_alta is not null then
    perform privado.gerar_visitas(v_f.id);
  end if;
end;
$$;
comment on function privado.avancar_designacao(uuid) is '[P36] Depois que a titular aceita: consulta realizada mais titular aceita levam o P2 a aguardando_nascimento (por privado.transicionar), e alta já registrada gera as visitas. Sem grant.';

-- Recusa ou prazo vencido: a coordenação é avisada e, se era a titular, o
-- backup assume (aceito vira titular; em oferta recebe a oferta como titular).
create function privado.tratar_recusa(designacao_id uuid, motivo text) returns text
  language plpgsql
  volatile
  set search_path = ''
as $$
declare
  v_d       public.designacao;
  v_a       public.acompanhamento;
  v_f       public.familia;
  v_b       public.designacao;
  v_horas   numeric := privado.venda_numero('designacao_prazo_resposta_horas');
  v_desfecho text;
  v_titulo  text;
begin
  select d.* into v_d from public.designacao d where d.id = tratar_recusa.designacao_id;
  select a.* into v_a from public.acompanhamento a where a.id = v_d.acompanhamento_id;
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;

  v_titulo := case when tratar_recusa.motivo = 'expirada' then 'O prazo de uma oferta venceu sem resposta'
                   when v_d.papel = 'titular' then 'A titular recusou a oferta'
                   else 'O backup recusou a oferta' end;

  if v_d.papel = 'titular' then
    select b.* into v_b
    from public.designacao b
    where b.acompanhamento_id = v_a.id and b.papel = 'backup' and b.status in ('aceita', 'oferecida')
    for update;
    if found and v_b.status = 'aceita' then
      update public.designacao b set papel = 'titular' where b.id = v_b.id;
      v_desfecho := 'backup_assumiu';
      perform privado.op_notificar('enfermeira', privado.op_usuario_profissional(v_b.profissional_id), 'alta',
        'Você passou a ser a titular de um acompanhamento',
        'A titular anterior não vai atender. Confira em Minhas famílias.', '/minhas-familias');
    elsif found then
      update public.designacao b
         set papel = 'titular', oferecida_em = pg_catalog.clock_timestamp(),
             prazo_resposta_em = case when v_horas is not null
                                      then pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision) end
       where b.id = v_b.id;
      v_desfecho := 'oferta_passou_ao_backup';
      perform privado.op_notificar('enfermeira', privado.op_usuario_profissional(v_b.profissional_id), 'alta',
        'Sua oferta agora é como titular',
        'A titular anterior não vai atender. Responda a nova oferta.', '/ofertas');
    else
      v_desfecho := 'sem_backup';
    end if;
  else
    v_desfecho := 'backup_recusou';
  end if;

  if v_desfecho in ('sem_backup', 'backup_recusou', 'backup_assumiu')
     and privado.op_tarefa_aberta(v_f.id, 'designar_profissional') is null then
    insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
    values ('designar_profissional', v_f.id, 'coordenacao',
            case when v_desfecho = 'sem_backup' then 'alta'::public.prioridade else 'normal'::public.prioridade end,
            case when v_desfecho = 'backup_assumiu' then 'Designar um novo backup'
                 when v_desfecho = 'backup_recusou' then 'Designar outro backup'
                 else 'Oferecer a outra enfermeira' end,
            pg_catalog.jsonb_build_object('desfecho', v_desfecho, 'designacao_id', v_d.id));
  end if;

  perform privado.op_notificar('coordenacao', null,
    'alta',
    v_titulo,
    v_f.nome_exibicao || ': ' || case v_desfecho
      when 'backup_assumiu' then 'o backup assumiu como titular. Falta designar um novo backup.'
      when 'oferta_passou_ao_backup' then 'a oferta seguiu para o backup.'
      when 'sem_backup' then 'não há backup. Ofereça a outra enfermeira.'
      else 'designe outro backup.' end,
    '/radar/' || v_f.id::text);

  perform privado.op_evento(v_f.id, 'designacao',
    case v_desfecho
      when 'backup_assumiu' then 'A titular não vai atender; o backup assumiu'
      when 'oferta_passou_ao_backup' then 'A titular não vai atender; a oferta seguiu para o backup'
      when 'sem_backup' then 'A titular não vai atender e não há backup'
      else 'O backup não vai atender' end,
    pg_catalog.jsonb_build_object('designacao_id', v_d.id, 'desfecho', v_desfecho), false);
  return v_desfecho;
end;
$$;
comment on function privado.tratar_recusa(uuid, text) is '[P36 item 1] Depois de recusa ou de prazo vencido: avisa a coordenação e, se era a titular, o backup assume (aceito vira titular; em oferta recebe a oferta como titular com novo prazo). Sem backup ou depois de o backup assumir, abre a tarefa designar_profissional. Devolve o desfecho. Sem grant.';

-- Vence as ofertas sem resposta no prazo.
create function privado.expirar_ofertas() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_id uuid;
  v_n  integer := 0;
begin
  for v_id in
    select d.id from public.designacao d
    where d.status = 'oferecida' and d.prazo_resposta_em is not null and d.prazo_resposta_em <= pg_catalog.clock_timestamp()
    order by d.prazo_resposta_em, d.id
    for update skip locked
  loop
    update public.designacao d set status = 'expirada' where d.id = v_id;
    perform privado.tratar_recusa(v_id, 'expirada');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
comment on function privado.expirar_ofertas() is '[P36] Marca expirada a oferta sem resposta depois de prazo_resposta_em e trata como recusa (backup assume, coordenação avisada). Sem grant.';

-- --- 7.1 api.alocacao_familia -----------------------------------------------------------------
create function privado.op_status_seguro(profissional_id uuid) returns text
  language plpgsql
  stable
  set search_path = ''
  as $$
begin
  return privado.status_profissional(op_status_seguro.profissional_id)::text;
exception
  when others then
    return null;
end;
$$;
comment on function privado.op_status_seguro(uuid) is '[P36] Estado de hoje da profissional; nulo se parametro.janela_dpp_dias faltar (a tela mostra sem o selo em vez de cair). Sem grant.';

create function api.alocacao_familia(familia_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_f       public.familia;
  v_o       public.oportunidade;
  v_a       public.acompanhamento;
  v_cp      public.consulta_prenatal;
  v_antes   integer := privado.venda_numero('janela_dpp_dias', 'antes')::integer;
  v_depois  integer := privado.venda_numero('janela_dpp_dias', 'depois')::integer;
  v_ini     date;
  v_fim     date;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select f.* into v_f from public.familia f where f.id = alocacao_familia.familia_id and f.mesclada_em_id is null;
  if not found then
    perform privado.operacao_recusar('familia_inexistente');
  end if;
  v_o := privado.venda_oportunidade(v_f.id);
  v_a := privado.op_acompanhamento(v_f.id);

  -- o período preferido é dado da entrevista: leitura auditada
  select cp.* into v_cp from assistencial.ler_consulta_prenatal(v_f.id) cp
  where cp.status in ('pendente', 'agendada', 'realizada') limit 1;

  if v_f.dpp is not null and v_antes is not null and v_depois is not null then
    v_ini := v_f.dpp - v_antes;
    v_fim := v_f.dpp + v_depois;
  end if;

  return pg_catalog.jsonb_build_object(
    'familia', pg_catalog.jsonb_build_object(
      'id', v_f.id, 'nome', v_f.nome_exibicao, 'dpp', v_f.dpp, 'data_nascimento', v_f.data_nascimento,
      'data_alta', v_f.data_alta, 'data_inicio_efetivo', v_f.data_inicio_efetivo, 'gemelar', v_f.gemelar,
      'estado_sensivel', v_f.estado_sensivel,
      'ig', case when v_f.dpp is not null then (public.ig(v_f.dpp, privado.op_hoje())).texto end,
      'estagio_p2', v_o.estagio_p2,
      'cidade', (select c.nome from public.cidade c where c.id = v_f.cidade_id),
      'uf', (select c.uf from public.cidade c where c.id = v_f.cidade_id),
      'regiao_id', v_f.regiao_id,
      'janela_inicio', v_ini, 'janela_fim', v_fim,
      'periodo_preferido', case when v_cp.id is not null then pg_catalog.to_jsonb(v_cp.periodo_preferido) end,
      'consulta_status', v_cp.status),
    'acompanhamento', case when v_a.id is null then null else pg_catalog.jsonb_build_object(
      'id', v_a.id, 'estado', v_a.estado, 'dias', v_a.dias_contratados, 'horas_por_visita', v_a.horas_por_visita,
      'periodo', v_a.periodo, 'inicio_efetivo', v_a.inicio_efetivo, 'previsao_alta', v_a.previsao_alta,
      'visitas', (select pg_catalog.count(*) from public.visita v where v.acompanhamento_id = v_a.id),
      'lista_visitas', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'dia_numero', v.dia_numero, 'data', v.data, 'hora_prevista', v.hora_prevista,
                 'estado', v.estado, 'profissional_id', v.profissional_id,
                 'profissional', privado.op_nome_profissional(v.profissional_id))
               order by v.dia_numero)
        from public.visita v where v.acompanhamento_id = v_a.id), '[]'::jsonb)) end,
    'tarefas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'tipo', t.tipo, 'titulo', t.titulo, 'prioridade', t.prioridade, 'vence_em', t.vence_em)
             order by t.prioridade desc, t.criado_em, t.id)
      from public.tarefa t
      where t.familia_id = v_f.id and t.status in ('aberta', 'em_andamento')
        and t.tipo in ('agendar_prenatal', 'designar_profissional', 'checkin_dpp', 'enviar_guia', 'outro')), '[]'::jsonb),
    'designacoes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', d.id, 'papel', d.papel, 'status', d.status, 'profissional_id', d.profissional_id,
               'profissional', pr.nome, 'oferecida_em', d.oferecida_em, 'respondida_em', d.respondida_em,
               'prazo_resposta_em', d.prazo_resposta_em, 'direta', d.direta, 'motivo_recusa', d.motivo_recusa)
             order by d.criado_em desc, d.id)
      from public.designacao d
      join public.profissional pr on pr.id = d.profissional_id
      where d.acompanhamento_id = v_a.id), '[]'::jsonb),
    'candidatas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'profissional_id', pr.id, 'nome', pr.nome, 'funcao', pr.funcao,
               'estado_hoje', privado.op_status_seguro(pr.id),
               'na_regiao', v_f.regiao_id is null or v_f.regiao_id = any (pr.regioes),
               'titulares_na_janela', (
                 select pg_catalog.count(*) from public.designacao d2
                 join public.acompanhamento a2 on a2.id = d2.acompanhamento_id
                 join public.familia f2 on f2.id = a2.familia_id
                 where d2.profissional_id = pr.id and d2.papel = 'titular' and d2.status = 'aceita'
                   and a2.familia_id <> v_f.id and a2.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico')
                   and v_ini is not null and f2.dpp is not null and f2.data_nascimento is null
                   and f2.dpp - v_antes <= v_fim and f2.dpp + v_depois >= v_ini),
               'bloqueio_na_janela', v_ini is not null and exists (
                 select 1 from public.bloqueio_agenda b
                 where b.profissional_id = pr.id and b.inicio <= v_fim and b.fim >= v_ini),
               'oferta_pendente', exists (select 1 from public.designacao d3 where d3.profissional_id = pr.id and d3.status = 'oferecida'),
               'ja_nesta_familia', exists (select 1 from public.designacao d4 where d4.acompanhamento_id = v_a.id
                                           and d4.profissional_id = pr.id and d4.status in ('oferecida', 'aceita')))
             order by (v_f.regiao_id is not null and not (v_f.regiao_id = any (pr.regioes))), pr.nome, pr.id)
      from public.profissional pr
      where pr.ativa and pr.funcao <> 'coordenacao'), '[]'::jsonb));
end;
$$;
comment on function api.alocacao_familia(uuid) is '[P36 item 1] Tudo da tela Designar de uma família: contexto (datas, janela da DPP, período preferido da entrevista com leitura auditada), acompanhamento, designações e candidatas com o estado de hoje, titulares na janela e bloqueio de agenda. Coordenação e diretoria, AAL2.';

-- --- 7.2 api.oferecer_designacao ----------------------------------------------------------------
create function api.oferecer_designacao(
  familia_id      uuid,
  profissional_id uuid,
  papel           public.papel_designacao
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_f     public.familia;
  v_o     public.oportunidade;
  v_p     public.profissional;
  v_a     uuid;
  v_ativa public.designacao;
  v_horas numeric := privado.venda_numero('designacao_prazo_resposta_horas');
  v_prazo timestamptz;
  v_id    uuid;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if oferecer_designacao.familia_id is null or oferecer_designacao.profissional_id is null
     or oferecer_designacao.papel is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'familia_id, profissional_id e papel');
  end if;
  if v_horas is null or v_horas <= 0 then
    perform privado.operacao_recusar('parametro_ausente', 'designacao_prazo_resposta_horas');
  end if;

  select f.* into v_f from public.familia f where f.id = oferecer_designacao.familia_id and f.mesclada_em_id is null for update;
  if not found then
    perform privado.operacao_recusar('familia_inexistente');
  end if;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    perform privado.operacao_recusar('familia_em_estado_sensivel');
  end if;
  v_o := privado.venda_oportunidade(v_f.id);
  if v_o.id is null or privado.op_posicao_p2(v_o.estagio_p2::text) is null then
    perform privado.operacao_recusar('sem_contrato', 'só se designa depois do pagamento');
  end if;

  select p.* into v_p from public.profissional p where p.id = oferecer_designacao.profissional_id;
  if not found or not v_p.ativa or v_p.funcao = 'coordenacao' then
    perform privado.operacao_recusar('profissional_invalida');
  end if;

  v_a := privado.garantir_acompanhamento(v_f.id);
  if v_a is null then
    perform privado.operacao_recusar('sem_acompanhamento');
  end if;

  select d.* into v_ativa from public.designacao d
  where d.acompanhamento_id = v_a and d.papel = oferecer_designacao.papel and d.status in ('oferecida', 'aceita');
  if found then
    perform privado.operacao_recusar('papel_ocupado', v_ativa.status::text);
  end if;
  if exists (select 1 from public.designacao d where d.acompanhamento_id = v_a
             and d.profissional_id = v_p.id and d.status in ('oferecida', 'aceita')) then
    perform privado.operacao_recusar('mesma_profissional');
  end if;

  v_prazo := pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision);
  insert into public.designacao (acompanhamento_id, profissional_id, papel, status, oferecida_em, prazo_resposta_em, criado_por)
  values (v_a, v_p.id, oferecer_designacao.papel, 'oferecida', pg_catalog.clock_timestamp(), v_prazo, auth.uid())
  returning id into v_id;

  perform privado.op_notificar('enfermeira', v_p.usuario_id, 'alta',
    'Você recebeu uma oferta de acompanhamento',
    'Responda até ' || privado.formatar_data_hora(v_prazo) || '.', '/ofertas');
  perform privado.op_evento(v_f.id, 'designacao',
    case oferecer_designacao.papel when 'titular' then 'Oferta de titular enviada' else 'Oferta de backup enviada' end,
    pg_catalog.jsonb_build_object('designacao_id', v_id, 'papel', oferecer_designacao.papel), false);
  perform privado.venda_log('designacao_oferecida', 'designacao', v_id::text, null,
    pg_catalog.jsonb_build_object('familia_id', v_f.id, 'profissional_id', v_p.id, 'papel', oferecer_designacao.papel,
                                  'prazo_resposta_em', v_prazo));
  return pg_catalog.jsonb_build_object('ok', true, 'designacao_id', v_id, 'prazo_resposta_em', v_prazo);
end;
$$;
comment on function api.oferecer_designacao(uuid, uuid, public.papel_designacao) is '[P36 item 1] Oferta de titular ou de backup: coordenação ou diretoria, AAL2, família com pagamento confirmado e fora de bloqueio total, profissional ativa (não a coordenação), uma titular e um backup ativos por acompanhamento, a mesma pessoa nunca nos dois papéis. Prazo de resposta em parametro.designacao_prazo_resposta_horas. Avisa a profissional (título sem nome de família). Evento e log.';

-- --- 7.3 api.atribuir_designacao ----------------------------------------------------------------
create function api.atribuir_designacao(
  familia_id      uuid,
  profissional_id uuid,
  papel           public.papel_designacao,
  motivo          text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_f      public.familia;
  v_o      public.oportunidade;
  v_p      public.profissional;
  v_a      uuid;
  v_motivo text := nullif(pg_catalog.left(pg_catalog.btrim(atribuir_designacao.motivo), 300), '');
  v_id     uuid;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if atribuir_designacao.familia_id is null or atribuir_designacao.profissional_id is null
     or atribuir_designacao.papel is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'familia_id, profissional_id e papel');
  end if;
  if v_motivo is null then
    perform privado.operacao_recusar('motivo_obrigatorio');
  end if;

  select f.* into v_f from public.familia f where f.id = atribuir_designacao.familia_id and f.mesclada_em_id is null for update;
  if not found then
    perform privado.operacao_recusar('familia_inexistente');
  end if;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    perform privado.operacao_recusar('familia_em_estado_sensivel');
  end if;
  v_o := privado.venda_oportunidade(v_f.id);
  if v_o.id is null or privado.op_posicao_p2(v_o.estagio_p2::text) is null then
    perform privado.operacao_recusar('sem_contrato', 'só se designa depois do pagamento');
  end if;
  select p.* into v_p from public.profissional p where p.id = atribuir_designacao.profissional_id;
  if not found or not v_p.ativa or v_p.funcao = 'coordenacao' then
    perform privado.operacao_recusar('profissional_invalida');
  end if;
  v_a := privado.garantir_acompanhamento(v_f.id);
  if v_a is null then
    perform privado.operacao_recusar('sem_acompanhamento');
  end if;

  -- a atribuição direta substitui quem ocupava o papel e tira a própria
  -- profissional de outro papel ativo neste acompanhamento
  update public.designacao d
     set status = 'cancelada', respondida_em = coalesce(d.respondida_em, pg_catalog.clock_timestamp())
   where d.acompanhamento_id = v_a and d.status in ('oferecida', 'aceita')
     and (d.papel = atribuir_designacao.papel or d.profissional_id = v_p.id);

  insert into public.designacao (acompanhamento_id, profissional_id, papel, status, oferecida_em, respondida_em,
                                 direta, motivo_direta, criado_por)
  values (v_a, v_p.id, atribuir_designacao.papel, 'aceita', pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp(),
          true, v_motivo, auth.uid())
  returning id into v_id;

  perform privado.op_notificar('enfermeira', v_p.usuario_id, 'alta',
    case atribuir_designacao.papel when 'titular' then 'Você foi designada como titular de um acompanhamento'
                                   else 'Você foi designada como backup de um acompanhamento' end,
    'Atribuição direta da coordenação. Confira em Minhas famílias.', '/minhas-familias');
  perform privado.op_evento(v_f.id, 'designacao',
    case atribuir_designacao.papel when 'titular' then 'Titular atribuída direto pela coordenação'
                                   else 'Backup atribuída direto pela coordenação' end,
    pg_catalog.jsonb_build_object('designacao_id', v_id, 'papel', atribuir_designacao.papel), false);
  perform privado.venda_log('designacao_atribuida', 'designacao', v_id::text, null,
    pg_catalog.jsonb_build_object('familia_id', v_f.id, 'profissional_id', v_p.id, 'papel', atribuir_designacao.papel));

  if atribuir_designacao.papel = 'titular' then
    perform privado.op_fechar_tarefas(v_f.id, 'designar_profissional');
  end if;
  perform privado.avancar_designacao(v_f.id);
  return pg_catalog.jsonb_build_object('ok', true, 'designacao_id', v_id);
end;
$$;
comment on function api.atribuir_designacao(uuid, uuid, public.papel_designacao, text) is '[P36 item 1, O-01] Atribuição direta em urgência: coordenação ou diretoria, AAL2, com motivo. Nasce aceita e marcada como direta, substitui quem ocupava o papel, avisa a profissional e avança o que dependia da titular (P2, visitas). Log com motivo oculto (HMAC).';

-- --- 7.4 api.minhas_ofertas ---------------------------------------------------------------------
create function api.minhas_ofertas() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_prof uuid;
begin
  perform privado.autorizar(array['enfermeira']::public.papel_usuario[], true);

  select p.id into v_prof from public.profissional p where p.usuario_id = auth.uid() and p.ativa;
  if v_prof is null then
    return '[]'::jsonb;
  end if;

  -- só o que ela precisa para decidir: nada de endereço, telefone ou contrato
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'designacao_id', d.id, 'papel', d.papel, 'oferecida_em', d.oferecida_em,
             'prazo_resposta_em', d.prazo_resposta_em,
             'vencida', d.prazo_resposta_em is not null and d.prazo_resposta_em <= pg_catalog.clock_timestamp(),
             'familia', f.nome_exibicao, 'bairro', f.bairro, 'cidade', c.nome, 'uf', c.uf, 'dpp', f.dpp,
             'gemelar', f.gemelar, 'dias', a.dias_contratados, 'horas_por_visita', a.horas_por_visita,
             'periodo', a.periodo)
           order by d.prazo_resposta_em nulls last, d.id)
    from public.designacao d
    join public.acompanhamento a on a.id = d.acompanhamento_id
    join public.familia f on f.id = a.familia_id
    left join public.cidade c on c.id = f.cidade_id
    where d.profissional_id = v_prof and d.status = 'oferecida'), '[]'::jsonb);
end;
$$;
comment on function api.minhas_ofertas() is '[P36 item 1] As ofertas de designação sem resposta da enfermeira logada (papel enfermeira, AAL2): família, bairro, cidade, DPP, dias, horas, período e prazo. Sem endereço, telefone nem contrato. Mostrar a oferta não dá acesso à família: o acesso vem com o aceite (privado.familias_atribuidas).';

-- --- 7.5 api.responder_designacao ------------------------------------------------------------------
create function api.responder_designacao(
  designacao_id uuid,
  aceita        boolean,
  motivo        text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_d      public.designacao;
  v_a      public.acompanhamento;
  v_f      public.familia;
  v_prof   uuid;
  v_motivo text := privado.campo_livre(responder_designacao.motivo);
  v_desfecho text;
begin
  perform privado.autorizar(array['enfermeira']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  if responder_designacao.designacao_id is null or responder_designacao.aceita is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'designacao_id e aceita');
  end if;

  select p.id into v_prof from public.profissional p where p.usuario_id = auth.uid() and p.ativa;
  select d.* into v_d from public.designacao d
  where d.id = responder_designacao.designacao_id and d.profissional_id = v_prof
  for update;
  if not found or v_prof is null then
    -- a oferta de outra pessoa não existe para quem pergunta
    perform privado.operacao_recusar('oferta_inexistente');
  end if;
  if v_d.status <> 'oferecida' then
    perform privado.operacao_recusar('oferta_ja_respondida', v_d.status::text);
  end if;

  select a.* into v_a from public.acompanhamento a where a.id = v_d.acompanhamento_id;
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;

  if v_d.prazo_resposta_em is not null and v_d.prazo_resposta_em <= pg_catalog.clock_timestamp() then
    update public.designacao d set status = 'expirada' where d.id = v_d.id;
    v_desfecho := privado.tratar_recusa(v_d.id, 'expirada');
    return pg_catalog.jsonb_build_object('ok', false, 'expirada', true, 'desfecho', v_desfecho);
  end if;

  if responder_designacao.aceita then
    update public.designacao d set status = 'aceita', respondida_em = pg_catalog.clock_timestamp() where d.id = v_d.id;
    perform privado.op_notificar('coordenacao', null, 'normal',
      case v_d.papel when 'titular' then 'Uma titular aceitou a oferta' else 'Uma backup aceitou a oferta' end,
      v_f.nome_exibicao || '.', '/radar/' || v_f.id::text);
    perform privado.op_evento(v_f.id, 'designacao',
      case v_d.papel when 'titular' then 'Titular aceitou a oferta' else 'Backup aceitou a oferta' end,
      pg_catalog.jsonb_build_object('designacao_id', v_d.id, 'papel', v_d.papel), false);
    if v_d.papel = 'titular' then
      perform privado.op_fechar_tarefas(v_f.id, 'designar_profissional');
    end if;
    -- o P2 e as visitas pedem papel de coordenação: se a enfermeira não tem,
    -- o cron faz na sequência (privado.processar_designacoes)
    begin
      perform privado.avancar_designacao(v_f.id);
    exception
      when insufficient_privilege then
        null;
    end;
    return pg_catalog.jsonb_build_object('ok', true, 'aceita', true);
  end if;

  if v_motivo is null then
    perform privado.operacao_recusar('motivo_obrigatorio');
  end if;
  update public.designacao d
     set status = 'recusada', respondida_em = pg_catalog.clock_timestamp(), motivo_recusa = v_motivo
   where d.id = v_d.id;
  v_desfecho := privado.tratar_recusa(v_d.id, v_motivo);
  return pg_catalog.jsonb_build_object('ok', true, 'aceita', false, 'desfecho', v_desfecho);
end;
$$;
comment on function api.responder_designacao(uuid, boolean, text) is '[P36 item 1] A enfermeira aceita ou recusa a própria oferta (AAL2). Oferta de outra pessoa não existe para ela. Vencida, vira expirada e é tratada como recusa. Recusar exige motivo. Recusa da titular promove o backup e avisa a coordenação (privado.tratar_recusa). O aceite abre o acesso à família (privado.familias_atribuidas) e avança o P2 e as visitas quando a sessão puder; senão, o cron.';


-- =============================================================================
-- 8. P36 · Nascimento e alta (PRD 6.10 regra 3, 7.2, 7.3, 10.1)
--
-- As quatro datas nunca se confundem: dpp é estimativa e não move nada;
-- data_nascimento e data_alta são fatos, registrados por pessoa (nunca
-- calculados); data_inicio_efetivo é o D1 do acompanhamento, contado da alta
-- e não do nascimento. Toda mudança de estágio passa por privado.transicionar.
-- =============================================================================

create function privado.op_dia_da_semana(dia date) returns text
  language sql
  immutable
  set search_path = ''
  as $$
  select (array['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'])
           [pg_catalog.date_part('dow', op_dia_da_semana.dia)::integer + 1]
$$;
comment on function privado.op_dia_da_semana(date) is '[P36] Dia da semana por extenso (quinta-feira), para os textos sugeridos. Sem grant.';

-- Gera as visitas de D1 a Dn do acompanhamento, uma por dia corrido, no
-- mesmo período e com a titular aceita (PRD 3.4, 7.3), ativa o
-- acompanhamento, cria a tarefa do guia e avisa a profissional (automação
-- alta, PRD 10.1). Devolve quantas visitas criou; 0 se já existiam; nulo se
-- falta algo (alta, titular, período ou D1) ou se a automação está desligada
-- ou barrada pelo freio. Idempotente.
create function privado.gerar_visitas(familia_id uuid) returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_f       public.familia;
  v_a       public.acompanhamento;
  v_t       public.designacao;
  v_exec    uuid;
  v_hora    time;
  v_txt     text;
  v_max     numeric := privado.venda_numero('visitas_maximo_por_dia');
  v_dia     date;
  v_n       integer;
  v_sobre   text := '';
  v_prim    text;
  v_id      uuid;
  v_enf     text;
begin
  select f.* into v_f from public.familia f where f.id = gerar_visitas.familia_id;
  if not found or v_f.data_alta is null or v_f.data_nascimento is null then
    return null;
  end if;
  v_a := privado.op_acompanhamento(v_f.id);
  if v_a.id is null then
    return null;
  end if;
  if exists (select 1 from public.visita v where v.acompanhamento_id = v_a.id) then
    return 0;
  end if;
  v_t := privado.op_designada(v_f.id, 'titular');
  if v_t.id is null or v_a.inicio_efetivo is null or v_a.periodo is null or v_a.periodo = 'noite_avaliar' then
    return null;
  end if;

  v_exec := privado.op_iniciar_automacao('alta', v_f.id, true,
              pg_catalog.jsonb_build_object('acompanhamento_id', v_a.id));
  if v_exec is null then
    return null;
  end if;

  v_txt := privado.venda_parametro('visita_hora_por_periodo') ->> v_a.periodo::text;
  if v_txt ~ '^[0-2][0-9]:[0-5][0-9]$' then
    v_hora := v_txt::time;
  end if;

  for v_n in 1 .. v_a.dias_contratados loop
    v_dia := v_a.inicio_efetivo + (v_n - 1);
    insert into public.visita (acompanhamento_id, profissional_id, dia_numero, data, hora_prevista, estado, criado_por)
    values (v_a.id, v_t.profissional_id, v_n, v_dia, v_hora, 'agendada', auth.uid());

    -- no máximo N visitas da mesma profissional por dia (PRD 3.4): aviso, não trava
    if v_max is not null and (
         select pg_catalog.count(*) from public.visita v
         where v.profissional_id = v_t.profissional_id and v.data = v_dia and v.acompanhamento_id <> v_a.id
           and v.estado not in ('cancelada', 'reagendada', 'nao_realizada_familia', 'nao_realizada_profissional')
       ) >= v_max then
      v_sobre := v_sobre || case when v_sobre = '' then '' else ', ' end || privado.formatar_data(v_dia);
    end if;
  end loop;

  if v_a.estado = 'aguardando' then
    perform privado.transicionar('acompanhamento', v_a.id, 'ativo', 'Alta registrada');
  end if;

  v_enf := privado.venda_primeiro_nome(privado.op_nome_profissional(v_t.profissional_id));
  v_prim := privado.op_dia_da_semana(v_a.inicio_efetivo) || ', ' || pg_catalog.to_char(v_a.inicio_efetivo, 'DD/MM');

  -- tarefa do guia (texto alta_boas_vindas, 23.2); sem texto se o freio ou
  -- "não contatar" barram a mensagem, e então a tarefa nem nasce
  v_id := privado.venda_criar_tarefa(v_f.id, 'enviar_guia', 'Enviar o guia de início do acompanhamento', null, 'alta',
            ((v_a.inicio_efetivo - 1) + time '09:00') at time zone 'America/Sao_Paulo',
            'alta_boas_vindas',
            pg_catalog.jsonb_build_object('enfermeira', v_enf, 'dia', v_prim, 'hora', coalesce(v_txt, '')),
            'operacional',
            pg_catalog.jsonb_build_object('acompanhamento_id', v_a.id));
  if v_id is not null then
    update public.tarefa t set papel_responsavel = 'coordenacao', origem_automacao_id = 'alta' where t.id = v_id;
  end if;

  perform privado.op_notificar('enfermeira', privado.op_usuario_profissional(v_t.profissional_id), 'alta',
    'Um acompanhamento seu foi liberado',
    'As visitas de ' || v_a.dias_contratados::text || ' dias foram marcadas a partir de '
      || privado.formatar_data(v_a.inicio_efetivo) || ', ' || (case v_a.periodo when 'manha' then 'de manhã' else 'à tarde' end) || '.',
    '/minhas-familias');

  if v_sobre <> '' then
    perform privado.op_notificar('coordenacao', null, 'alta',
      'A agenda de uma titular passa do limite de visitas por dia',
      v_f.nome_exibicao || ': conferir ' || v_sobre || '.', '/radar/' || v_f.id::text);
  end if;

  perform privado.op_evento(v_f.id, 'acompanhamento',
    'Visitas de D1 a D' || v_a.dias_contratados::text || ' marcadas',
    pg_catalog.jsonb_build_object('acompanhamento_id', v_a.id, 'inicio_efetivo', v_a.inicio_efetivo,
                                  'periodo', v_a.periodo), true);
  return v_a.dias_contratados;
end;
$$;
comment on function privado.gerar_visitas(uuid) is '[P36 item 4] Gera as visitas de D1 a D6 ou D12 do acompanhamento (uma por dia corrido a partir de inicio_efetivo, mesmo período, titular aceita), ativa o acompanhamento por privado.transicionar, cria a tarefa enviar_guia (texto alta_boas_vindas) e avisa a titular; sobrecarga acima de parametro.visitas_maximo_por_dia vira aviso à coordenação. Automação alta: desligada ou barrada pelo freio, não gera. Devolve o número de visitas, 0 se já existiam, nulo se falta alta, titular, período ou D1. Sem grant.';

-- --- Nascimento ------------------------------------------------------------------------------
create function privado.aplicar_nascimento(familia_id uuid) returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_f       public.familia;
  v_o       public.oportunidade;
  v_a       public.acompanhamento;
  v_t       public.designacao;
  v_cp      public.consulta_prenatal;
  v_exec    uuid;
  v_id      uuid;
  v_nomes   text;
  v_enf     text;
  v_tarefa  uuid;
begin
  select f.* into v_f from public.familia f where f.id = aplicar_nascimento.familia_id;
  v_o := privado.venda_oportunidade(aplicar_nascimento.familia_id);
  -- lead que ainda não contratou: o nascimento é fato de venda (P1), não de operação
  if v_f.id is null or v_f.data_nascimento is null or v_o.id is null
     or privado.op_posicao_p2(v_o.estagio_p2::text) is null then
    return pg_catalog.jsonb_build_object('aplicado', false);
  end if;

  if privado.op_posicao_p2(v_o.estagio_p2::text) < privado.op_posicao_p2('bebe_nasceu') then
    perform privado.op_avancar_p2(v_o.id, 'bebe_nasceu', 'Nascimento registrado');
  end if;

  v_a := privado.op_acompanhamento(v_f.id);
  if v_a.id is not null and v_a.previsao_alta is not null then
    perform privado.op_avancar_p2(v_o.id, 'aguardando_alta', 'Previsão de alta informada');
  end if;

  -- o que ficou para trás (PRD 7.2): pré-natal não realizado e designação
  select cp.* into v_cp from public.consulta_prenatal cp
  where cp.familia_id = v_f.id and cp.status in ('pendente', 'agendada');
  if found then
    update public.consulta_prenatal cp set urgente = true where cp.id = v_cp.id and not cp.urgente;
    v_tarefa := privado.op_tarefa_aberta(v_f.id, 'agendar_prenatal');
    if v_tarefa is null then
      insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
      values ('agendar_prenatal', v_f.id, 'coordenacao', 'maxima',
              'O bebê nasceu e o pré-natal não foi feito: decidir o que fazer',
              pg_catalog.jsonb_build_object('consulta_prenatal_id', v_cp.id, 'motivo', 'nascimento'));
    else
      update public.tarefa t set prioridade = 'maxima' where t.id = v_tarefa;
    end if;
  end if;

  v_t := privado.op_designada(v_f.id, 'titular');
  if v_t.id is null then
    v_tarefa := privado.op_tarefa_aberta(v_f.id, 'designar_profissional');
    if v_tarefa is null then
      insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
      values ('designar_profissional', v_f.id, 'coordenacao', 'maxima',
              'O bebê nasceu: designar a titular com urgência',
              pg_catalog.jsonb_build_object('motivo', 'nascimento'));
    else
      update public.tarefa t set prioridade = 'maxima' where t.id = v_tarefa;
    end if;
  end if;

  v_exec := privado.op_iniciar_automacao('nascimento', v_f.id, true);
  if v_exec is not null then
    -- avisa a operação e a titular (título sem nome de família)
    perform privado.op_notificar('coordenacao', null, 'alta',
      'Um bebê nasceu', v_f.nome_exibicao || ': nascimento em ' || privado.formatar_data(v_f.data_nascimento) || '.',
      '/radar/' || v_f.id::text);
    if v_t.id is not null then
      perform privado.op_notificar('enfermeira', privado.op_usuario_profissional(v_t.profissional_id), 'alta',
        'O bebê de uma das suas famílias nasceu', 'Confira em Minhas famílias.', '/minhas-familias');
    end if;

    -- pede a previsão de alta: tarefa com o texto parabens_nascimento (23.2)
    select pg_catalog.string_agg(coalesce(nullif(pg_catalog.btrim(b.nome), ''), 'seu bebê'), ' e ' order by b.ordem)
      into v_nomes
    from public.bebe b where b.familia_id = v_f.id;
    v_enf := coalesce(privado.venda_primeiro_nome(privado.op_nome_profissional(v_t.profissional_id)), 'equipe');
    v_id := privado.venda_criar_tarefa(v_f.id, 'outro', 'Dar os parabéns e pedir a previsão de alta', null, 'alta',
              pg_catalog.clock_timestamp() + interval '2 hours',
              'parabens_nascimento',
              pg_catalog.jsonb_build_object('bebe', coalesce(v_nomes, 'seu bebê'), 'enfermeira', v_enf),
              'operacional', pg_catalog.jsonb_build_object('pedir_previsao_alta', true));
    if v_id is not null then
      update public.tarefa t set papel_responsavel = 'coordenacao', origem_automacao_id = 'nascimento' where t.id = v_id;
    end if;
  end if;

  perform privado.op_evento(v_f.id, 'nascimento', 'Nascimento registrado em ' || privado.formatar_data(v_f.data_nascimento),
    pg_catalog.jsonb_build_object('data_nascimento', v_f.data_nascimento), false);
  return pg_catalog.jsonb_build_object('aplicado', true, 'estagio_p2',
    (select o.estagio_p2 from public.oportunidade o where o.id = v_o.id));
end;
$$;
comment on function privado.aplicar_nascimento(uuid) is '[P36 item 4] Efeitos do nascimento de uma família com contrato: P2 para bebe_nasceu (e aguardando_alta se a previsão veio), tarefas para o que ficou para trás (pré-natal não feito, designação urgente), aviso à operação e à titular e a tarefa com o texto parabens_nascimento pedindo a previsão de alta. A agenda se recalcula sozinha: public.ocupacao_projetada passa a usar a data do nascimento. Lead sem contrato: nada. Sem grant.';

-- --- Alta ------------------------------------------------------------------------------------
create function privado.aplicar_alta(familia_id uuid) returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_f      public.familia;
  v_o      public.oportunidade;
  v_a      public.acompanhamento;
  v_dias   numeric := privado.venda_numero('alta_primeira_visita_dias');
  v_inicio date;
  v_cp     public.consulta_prenatal;
  v_per    public.periodo_visita;
  v_visitas integer;
begin
  select f.* into v_f from public.familia f where f.id = aplicar_alta.familia_id;
  v_o := privado.venda_oportunidade(aplicar_alta.familia_id);
  if v_f.id is null or v_f.data_alta is null or v_o.id is null
     or privado.op_posicao_p2(v_o.estagio_p2::text) is null then
    return pg_catalog.jsonb_build_object('aplicado', false);
  end if;
  if v_f.data_nascimento is null then
    perform privado.op_notificar('coordenacao', null, 'alta',
      'Uma alta foi registrada sem a data do nascimento',
      v_f.nome_exibicao || ': registre o nascimento antes da alta.', '/radar/' || v_f.id::text);
    return pg_catalog.jsonb_build_object('aplicado', false, 'motivo', 'sem_nascimento');
  end if;

  -- a alta libera o atendimento; o nascimento vem antes
  if privado.op_posicao_p2(v_o.estagio_p2::text) < privado.op_posicao_p2('bebe_nasceu') then
    perform privado.op_avancar_p2(v_o.id, 'bebe_nasceu', 'Nascimento registrado');
  end if;
  perform privado.op_avancar_p2(v_o.id, 'atendimento_liberado', 'Alta registrada');

  v_a := privado.op_acompanhamento(v_f.id);
  if v_a.id is null then
    perform privado.garantir_acompanhamento(v_f.id);
    v_a := privado.op_acompanhamento(v_f.id);
  end if;
  if v_a.id is null then
    return pg_catalog.jsonb_build_object('aplicado', false, 'motivo', 'sem_acompanhamento');
  end if;

  -- D1: a data combinada, ou a alta mais parametro.alta_primeira_visita_dias
  v_inicio := coalesce(v_f.data_inicio_efetivo,
                       case when v_dias is not null then v_f.data_alta + v_dias::integer end);
  -- período: o combinado, ou o primeiro de manhã ou tarde da entrevista
  v_per := v_a.periodo;
  if v_per is null then
    select cp.* into v_cp from public.consulta_prenatal cp
    where cp.familia_id = v_f.id and cp.status in ('pendente', 'agendada', 'realizada');
    select x.p into v_per
    from pg_catalog.unnest(v_cp.periodo_preferido) with ordinality as x(p, n)
    where x.p in ('manha', 'tarde')
    order by x.n
    limit 1;
  end if;

  update public.acompanhamento a
     set inicio_efetivo = coalesce(a.inicio_efetivo, v_inicio), periodo = coalesce(a.periodo, v_per)
   where a.id = v_a.id;
  if v_f.data_inicio_efetivo is null and v_inicio is not null then
    update public.familia f set data_inicio_efetivo = v_inicio where f.id = v_f.id;
  end if;

  v_visitas := privado.gerar_visitas(v_f.id);

  if v_visitas is null then
    -- falta a titular, o período ou o D1: a alta não pode esperar em silêncio
    if (privado.op_designada(v_f.id, 'titular')).id is null then
      if privado.op_tarefa_aberta(v_f.id, 'designar_profissional') is null then
        insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
        values ('designar_profissional', v_f.id, 'coordenacao', 'maxima',
                'A alta foi registrada e não há titular: designar agora',
                pg_catalog.jsonb_build_object('motivo', 'alta'));
      else
        update public.tarefa t set prioridade = 'maxima'
         where t.id = privado.op_tarefa_aberta(v_f.id, 'designar_profissional');
      end if;
    elsif exists (select 1 from public.acompanhamento a
                  where a.id = v_a.id and (a.periodo is null or a.inicio_efetivo is null)) then
      insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
      values ('outro', v_f.id, 'coordenacao', 'alta',
              'A alta foi registrada: definir o período e o primeiro dia das visitas',
              pg_catalog.jsonb_build_object('motivo', 'alta_sem_periodo'));
    end if;
    -- titular, período e D1 conhecidos e sem visitas: a automação alta está
    -- desligada ou o freio a barrou (execução abortada_freio no registro)
  end if;

  perform privado.op_evento(v_f.id, 'alta', 'Alta registrada em ' || privado.formatar_data(v_f.data_alta),
    pg_catalog.jsonb_build_object('data_alta', v_f.data_alta, 'inicio_efetivo', v_inicio), true);
  return pg_catalog.jsonb_build_object('aplicado', true, 'visitas', v_visitas);
end;
$$;
comment on function privado.aplicar_alta(uuid) is '[P36 item 4] Efeitos da alta de uma família com contrato: P2 para atendimento_liberado (passando por aguardando_alta), D1 (parametro.alta_primeira_visita_dias depois da alta, ou a data combinada) e período no acompanhamento, visitas de D1 a Dn (privado.gerar_visitas). Sem titular ou sem período, abre a tarefa certa em vez de esperar em silêncio. Sem grant.';

-- --- Fila dos fatos -------------------------------------------------------------------------
create function privado.enfileirar_fato_operacao() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  if new.data_nascimento is not null and old.data_nascimento is distinct from new.data_nascimento then
    insert into privado.fato_operacao (familia_id, tipo, data) values (new.id, 'nascimento', new.data_nascimento);
  end if;
  if new.data_alta is not null and old.data_alta is distinct from new.data_alta then
    insert into privado.fato_operacao (familia_id, tipo, data) values (new.id, 'alta', new.data_alta);
  end if;
  return null;
end;
$$;
comment on function privado.enfileirar_fato_operacao() is '[P36] Gatilho AFTER UPDATE de familia: data_nascimento ou data_alta preenchida (por qualquer tela) entra na fila privado.fato_operacao; a automação roda em privado.processar_fatos_operacao. Só as duas datas de fato; a DPP nunca entra (PRD 6.10 regra 3).';

create trigger enfileirar_fato_operacao
  after update of data_nascimento, data_alta on public.familia
  for each row execute function privado.enfileirar_fato_operacao();

-- Processa os fatos pendentes (de uma família ou de todas). Com
-- `tolerante`, erro de um fato não para os outros: depois de três
-- tentativas o fato sai da fila e vira tarefa para a coordenação.
create function privado.processar_fatos_operacao(familia_id uuid default null, tolerante boolean default false)
  returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_fato record;
  v_n    integer := 0;
begin
  for v_fato in
    select fo.id, fo.familia_id, fo.tipo, fo.tentativas
    from privado.fato_operacao fo
    where fo.processado_em is null
      and (processar_fatos_operacao.familia_id is null or fo.familia_id = processar_fatos_operacao.familia_id)
    order by fo.id
    for update skip locked
  loop
    begin
      if v_fato.tipo = 'nascimento' then
        perform privado.aplicar_nascimento(v_fato.familia_id);
      else
        perform privado.aplicar_alta(v_fato.familia_id);
      end if;
      update privado.fato_operacao fo set processado_em = pg_catalog.clock_timestamp() where fo.id = v_fato.id;
      v_n := v_n + 1;
    exception
      when others then
        if not processar_fatos_operacao.tolerante then
          raise;
        end if;
        update privado.fato_operacao fo
           set tentativas = fo.tentativas + 1, erro = sqlstate,
               processado_em = case when fo.tentativas + 1 >= 3 then pg_catalog.clock_timestamp() end
         where fo.id = v_fato.id;
        if v_fato.tentativas + 1 >= 3 then
          insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload)
          values ('outro', v_fato.familia_id, 'coordenacao', 'alta',
                  case v_fato.tipo when 'nascimento' then 'Conferir o nascimento: o sistema não conseguiu aplicar'
                                   else 'Conferir a alta: o sistema não conseguiu aplicar' end,
                  pg_catalog.jsonb_build_object('fato_id', v_fato.id, 'codigo', sqlstate));
        end if;
    end;
  end loop;
  return v_n;
end;
$$;
comment on function privado.processar_fatos_operacao(uuid, boolean) is '[P36] Processa os fatos nascimento e alta pendentes, na ordem: api.registrar_* chama para a família na hora; o cron chama para todas em modo tolerante (erro conta tentativa; a terceira vira tarefa para a coordenação). Sem grant.';

-- =============================================================================
-- 9. P36 · api.registrar_nascimento, api.registrar_previsao_alta, api.registrar_alta
-- =============================================================================

create function api.registrar_nascimento(
  familia_id      uuid,
  data_nascimento date,
  bebes           jsonb,
  previsao_alta   date default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_f      public.familia;
  v_o      public.oportunidade;
  v_a      uuid;
  v_b      jsonb;
  v_n      integer;
  v_i      integer := 0;
  v_peso   integer;
  v_sexo   text;
  v_parto  text;
  v_nome   text;
  v_bebe   uuid;
  v_estagio text;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if registrar_nascimento.familia_id is null or registrar_nascimento.data_nascimento is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'familia_id e data_nascimento');
  end if;
  if pg_catalog.jsonb_typeof(registrar_nascimento.bebes) is distinct from 'array' then
    perform privado.operacao_recusar('bebes_invalidos');
  end if;
  v_n := pg_catalog.jsonb_array_length(registrar_nascimento.bebes);
  if v_n < 1 or v_n > 2 then
    perform privado.operacao_recusar('bebes_invalidos', 'um bebê ou gêmeos');
  end if;
  if registrar_nascimento.data_nascimento > privado.op_hoje() then
    perform privado.operacao_recusar('data_no_futuro', 'nascimento é fato: não fica no futuro');
  end if;
  if registrar_nascimento.previsao_alta is not null
     and registrar_nascimento.previsao_alta < registrar_nascimento.data_nascimento then
    perform privado.operacao_recusar('previsao_antes_do_nascimento');
  end if;

  select f.* into v_f from public.familia f where f.id = registrar_nascimento.familia_id and f.mesclada_em_id is null for update;
  if not found then
    perform privado.operacao_recusar('familia_inexistente');
  end if;
  v_o := privado.venda_oportunidade(v_f.id);
  if v_o.id is null or privado.op_posicao_p2(v_o.estagio_p2::text) is null then
    perform privado.operacao_recusar('sem_contrato', 'o nascimento de operação é registrado depois do pagamento');
  end if;
  if v_f.data_nascimento is not null and v_f.data_nascimento <> registrar_nascimento.data_nascimento then
    perform privado.operacao_recusar('nascimento_ja_registrado');
  end if;

  -- os bebês (ordem 1 e 2), sem inventar limite de peso: só maior que zero
  for v_b in select e.valor from pg_catalog.jsonb_array_elements(registrar_nascimento.bebes) as e(valor) loop
    v_i := v_i + 1;
    if pg_catalog.jsonb_typeof(v_b) <> 'object' then
      perform privado.operacao_recusar('bebes_invalidos');
    end if;
    v_nome := nullif(pg_catalog.btrim(v_b ->> 'nome'), '');
    v_sexo := coalesce(v_b ->> 'sexo', 'nao_informado');
    v_parto := coalesce(v_b ->> 'tipo_parto', 'nao_informado');
    if v_sexo not in ('feminino', 'masculino', 'nao_informado') then
      perform privado.operacao_recusar('bebes_invalidos', 'sexo');
    end if;
    if v_parto not in ('vaginal', 'cesarea', 'nao_informado') then
      perform privado.operacao_recusar('bebes_invalidos', 'tipo_parto');
    end if;
    v_peso := null;
    if v_b ? 'peso_nascimento_g' and pg_catalog.jsonb_typeof(v_b -> 'peso_nascimento_g') <> 'null' then
      if pg_catalog.jsonb_typeof(v_b -> 'peso_nascimento_g') <> 'number'
         or (v_b ->> 'peso_nascimento_g')::numeric <> pg_catalog.trunc((v_b ->> 'peso_nascimento_g')::numeric)
         or (v_b ->> 'peso_nascimento_g')::numeric <= 0 then
        perform privado.operacao_recusar('bebes_invalidos', 'peso');
      end if;
      v_peso := (v_b ->> 'peso_nascimento_g')::integer;
    end if;

    select b.id into v_bebe from public.bebe b where b.familia_id = v_f.id and b.ordem = v_i;
    if found then
      update public.bebe b
         set nome = coalesce(v_nome, b.nome), sexo = v_sexo, data_nascimento = registrar_nascimento.data_nascimento,
             peso_nascimento_g = v_peso, tipo_parto = v_parto
       where b.id = v_bebe;
    else
      insert into public.bebe (familia_id, ordem, nome, sexo, data_nascimento, peso_nascimento_g, tipo_parto, criado_por)
      values (v_f.id, v_i, v_nome, v_sexo, registrar_nascimento.data_nascimento, v_peso, v_parto, auth.uid());
    end if;
  end loop;

  v_a := privado.garantir_acompanhamento(v_f.id);
  if v_a is not null and registrar_nascimento.previsao_alta is not null then
    update public.acompanhamento a set previsao_alta = registrar_nascimento.previsao_alta where a.id = v_a;
  end if;

  update public.familia f
     set data_nascimento = registrar_nascimento.data_nascimento, gemelar = (f.gemelar or v_n = 2)
   where f.id = v_f.id;

  -- o gatilho enfileirou o fato; aplica na hora, com o papel de quem registrou
  perform privado.processar_fatos_operacao(v_f.id);

  select o.estagio_p2::text into v_estagio from public.oportunidade o where o.id = v_o.id;
  perform privado.venda_log('nascimento_registrado', 'familia', v_f.id::text, null,
    pg_catalog.jsonb_build_object('bebes', v_n, 'previsao_alta_informada', registrar_nascimento.previsao_alta is not null));
  return pg_catalog.jsonb_build_object('ok', true, 'estagio_p2', v_estagio);
end;
$$;
comment on function api.registrar_nascimento(uuid, date, jsonb, date) is '[P36 item 4] Registra o nascimento (fato): coordenação ou diretoria, AAL2, família com contrato, data que não fica no futuro, um bebê ou gêmeos com nome, sexo, peso em gramas (maior que zero) e tipo de parto. Grava data_nascimento e os bebês, leva o P2 a bebe_nasceu (aguardando_alta se a previsão veio), abre tarefas para o que ficou para trás, avisa a operação e a titular e cria a tarefa com o texto parabens_nascimento. Nunca depende da DPP.';

create function api.registrar_previsao_alta(familia_id uuid, previsao_alta date) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_f public.familia;
  v_o public.oportunidade;
  v_a public.acompanhamento;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  if registrar_previsao_alta.familia_id is null or registrar_previsao_alta.previsao_alta is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'familia_id e previsao_alta');
  end if;

  select f.* into v_f from public.familia f where f.id = registrar_previsao_alta.familia_id and f.mesclada_em_id is null for update;
  if not found then
    perform privado.operacao_recusar('familia_inexistente');
  end if;
  if v_f.data_nascimento is null then
    perform privado.operacao_recusar('sem_nascimento');
  end if;
  if v_f.data_alta is not null then
    perform privado.operacao_recusar('alta_ja_registrada');
  end if;
  if registrar_previsao_alta.previsao_alta < v_f.data_nascimento then
    perform privado.operacao_recusar('previsao_antes_do_nascimento');
  end if;
  v_o := privado.venda_oportunidade(v_f.id);
  v_a := privado.op_acompanhamento(v_f.id);
  if v_o.id is null or v_a.id is null then
    perform privado.operacao_recusar('sem_contrato');
  end if;

  update public.acompanhamento a set previsao_alta = registrar_previsao_alta.previsao_alta where a.id = v_a.id;
  perform privado.op_avancar_p2(v_o.id, 'aguardando_alta', 'Previsão de alta informada');
  update public.tarefa t
     set status = 'concluida', concluida_em = pg_catalog.now(), concluida_por = auth.uid()
   where t.familia_id = v_f.id and t.status in ('aberta', 'em_andamento')
     and t.payload ->> 'mensagemChave' = 'parabens_nascimento';
  perform privado.op_evento(v_f.id, 'nascimento', 'Previsão de alta: ' || privado.formatar_data(registrar_previsao_alta.previsao_alta),
    pg_catalog.jsonb_build_object('previsao_alta', registrar_previsao_alta.previsao_alta), false);
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;
comment on function api.registrar_previsao_alta(uuid, date) is '[P36 item 4] Previsão de alta (estimativa, guardada em acompanhamento.previsao_alta): depois do nascimento e antes da alta, leva o P2 a aguardando_alta e conclui a tarefa que pedia a previsão. Coordenação e diretoria, AAL2. Não é a data_alta.';

create function api.registrar_alta(
  familia_id     uuid,
  data_alta      date,
  primeira_visita date default null,
  periodo        public.periodo_visita default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_f      public.familia;
  v_o      public.oportunidade;
  v_a      uuid;
  v_dias   numeric := privado.venda_numero('alta_primeira_visita_dias');
  v_res    public.acompanhamento;
  v_visitas integer;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if registrar_alta.familia_id is null or registrar_alta.data_alta is null then
    perform privado.operacao_recusar('dados_obrigatorios', 'familia_id e data_alta');
  end if;
  if registrar_alta.data_alta > privado.op_hoje() then
    perform privado.operacao_recusar('data_no_futuro', 'alta é fato: não fica no futuro');
  end if;
  if registrar_alta.periodo is not null and registrar_alta.periodo not in ('manha', 'tarde') then
    perform privado.operacao_recusar('periodo_invalido', 'visita só de manhã ou à tarde');
  end if;
  if registrar_alta.primeira_visita is null and v_dias is null then
    perform privado.operacao_recusar('parametro_ausente', 'alta_primeira_visita_dias');
  end if;
  if registrar_alta.primeira_visita is not null and registrar_alta.primeira_visita < registrar_alta.data_alta then
    perform privado.operacao_recusar('primeira_visita_antes_da_alta');
  end if;

  select f.* into v_f from public.familia f where f.id = registrar_alta.familia_id and f.mesclada_em_id is null for update;
  if not found then
    perform privado.operacao_recusar('familia_inexistente');
  end if;
  if v_f.data_nascimento is null then
    perform privado.operacao_recusar('sem_nascimento', 'registre o nascimento antes da alta');
  end if;
  if registrar_alta.data_alta < v_f.data_nascimento then
    perform privado.operacao_recusar('alta_antes_do_nascimento');
  end if;
  v_o := privado.venda_oportunidade(v_f.id);
  if v_o.id is null or privado.op_posicao_p2(v_o.estagio_p2::text) is null then
    perform privado.operacao_recusar('sem_contrato');
  end if;
  if v_f.data_alta is not null and v_f.data_alta <> registrar_alta.data_alta then
    perform privado.operacao_recusar('alta_ja_registrada');
  end if;

  v_a := privado.garantir_acompanhamento(v_f.id);
  if v_a is null then
    perform privado.operacao_recusar('sem_acompanhamento');
  end if;
  if registrar_alta.periodo is not null then
    update public.acompanhamento a set periodo = registrar_alta.periodo where a.id = v_a;
  end if;

  update public.familia f
     set data_alta = registrar_alta.data_alta,
         data_inicio_efetivo = coalesce(registrar_alta.primeira_visita, f.data_inicio_efetivo)
   where f.id = v_f.id;
  perform privado.processar_fatos_operacao(v_f.id);
  -- alta repetida (mesma data) ou titular que chegou depois: tenta de novo
  perform privado.avancar_designacao(v_f.id);

  select a.* into v_res from public.acompanhamento a where a.id = v_a;
  select pg_catalog.count(*)::integer into v_visitas from public.visita v where v.acompanhamento_id = v_a;
  perform privado.venda_log('alta_registrada', 'familia', v_f.id::text, null,
    pg_catalog.jsonb_build_object('visitas', v_visitas));
  return pg_catalog.jsonb_build_object(
    'ok', true, 'visitas', v_visitas, 'acompanhamento_estado', v_res.estado,
    'inicio_efetivo', v_res.inicio_efetivo, 'periodo', v_res.periodo,
    'estagio_p2', (select o.estagio_p2 from public.oportunidade o where o.id = v_o.id));
end;
$$;
comment on function api.registrar_alta(uuid, date, date, public.periodo_visita) is '[P36 item 4] Registra a alta (fato): coordenação ou diretoria, AAL2, nascimento antes, data que não fica no futuro e não antes do nascimento. Grava data_alta e o D1 (a data combinada ou parametro.alta_primeira_visita_dias depois da alta), o período (manhã ou tarde) e leva o P2 a atendimento_liberado; ativa o acompanhamento, gera as visitas de D1 a D6 ou D12 com a titular aceita, cria a tarefa enviar_guia e avisa a profissional. Sem titular, abre a designação urgente. Repetir a mesma alta é seguro.';


-- =============================================================================
-- 10. P36 · Radar de nascimentos (PRD 3.4, 10.2, 20.6)
-- =============================================================================

-- A designação ativa do papel (aceita antes de oferecida) do acompanhamento vivo.
create function privado.op_designacao_ativa(familia_id uuid, papel public.papel_designacao) returns public.designacao
  language sql
  stable
  set search_path = ''
  as $$
  select d.*
  from public.designacao d
  join public.acompanhamento a on a.id = d.acompanhamento_id
  where a.familia_id = op_designacao_ativa.familia_id
    and a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico')
    and d.papel = op_designacao_ativa.papel
    and d.status in ('aceita', 'oferecida')
  order by (d.status = 'aceita') desc, d.criado_em desc, d.id
  limit 1
$$;
comment on function privado.op_designacao_ativa(uuid, public.papel_designacao) is '[P36] Designação ativa do papel no acompanhamento vivo: aceita antes de oferecida. Sem grant.';

create function api.radar_nascimentos(regiao_id uuid default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_hoje      date := privado.op_hoje();
  v_antes     integer := privado.venda_numero('janela_dpp_dias', 'antes')::integer;
  v_depois    integer := privado.venda_numero('janela_dpp_dias', 'depois')::integer;
  v_horizonte integer := coalesce(privado.venda_numero('radar_horizonte_dias')::integer, v_antes);
  v_sem       integer := privado.venda_numero('radar_sem_contato_dias')::integer;
  v_alerta    numeric := privado.venda_numero('capacidade_alerta_pct');
  v_familias  jsonb;
  v_nasceram  jsonb;
  v_ocupacao  jsonb;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  if v_antes is null or v_depois is null then
    perform privado.operacao_recusar('parametro_ausente', 'janela_dpp_dias');
  end if;

  select coalesce(pg_catalog.jsonb_agg(r.linha order by r.dpp, r.nome, r.id), '[]'::jsonb)
    into v_familias
  from (
    select f.id, f.nome_exibicao as nome, f.dpp,
           pg_catalog.jsonb_build_object(
             'familia_id', f.id,
             'nome', f.nome_exibicao,
             'cidade', c.nome, 'uf', c.uf,
             'regiao_id', f.regiao_id, 'regiao', rg.nome,
             'gemelar', f.gemelar,
             'dpp', f.dpp,
             'ig', (public.ig(f.dpp, v_hoje)).texto,
             'ig_semanas', (public.ig(f.dpp, v_hoje)).semanas,
             'dias_para_dpp', f.dpp - v_hoje,
             'na_janela', v_hoje between f.dpp - v_antes and f.dpp + v_depois,
             'passou_da_janela', v_hoje > f.dpp + v_depois,
             'estagio_p2', o.estagio_p2,
             'confirmada', true,
             'consulta_status', (select cp.status from public.consulta_prenatal cp
                                  where cp.familia_id = f.id and cp.status in ('pendente', 'agendada', 'realizada')),
             'titular', (select pg_catalog.jsonb_build_object('designacao_id', d.id, 'profissional_id', d.profissional_id,
                                                              'nome', privado.op_nome_profissional(d.profissional_id),
                                                              'status', d.status, 'prazo_resposta_em', d.prazo_resposta_em)
                           from privado.op_designacao_ativa(f.id, 'titular') d where d.id is not null),
             'backup', (select pg_catalog.jsonb_build_object('designacao_id', d.id, 'profissional_id', d.profissional_id,
                                                             'nome', privado.op_nome_profissional(d.profissional_id),
                                                             'status', d.status, 'prazo_resposta_em', d.prazo_resposta_em)
                          from privado.op_designacao_ativa(f.id, 'backup') d where d.id is not null),
             'ultimo_contato', privado.op_ultimo_contato(f.id),
             'dias_sem_contato', case when privado.op_ultimo_contato(f.id) is null then null
                                      else v_hoje - (privado.op_ultimo_contato(f.id) at time zone 'America/Sao_Paulo')::date end,
             'sem_contato', case when v_sem is null then false
                                 else coalesce(v_hoje - (privado.op_ultimo_contato(f.id) at time zone 'America/Sao_Paulo')::date >= v_sem, true) end,
             'checkin_pendente', privado.op_tarefa_aberta(f.id, 'checkin_dpp') is not null,
             'dpp_sem_confirmacao', exists (select 1 from public.automacao_execucao e
                                             where e.automacao_id = 'dpp_sem_confirmacao' and e.familia_id = f.id
                                               and e.status = 'executada'),
             'dpp_sem_contato', exists (select 1 from public.automacao_execucao e
                                         where e.automacao_id = 'dpp_sem_contato' and e.familia_id = f.id
                                           and e.status = 'executada'),
             'estado_sensivel', f.estado_sensivel) as linha
    from public.familia f
    join public.oportunidade o on o.familia_id = f.id
    left join public.cidade c on c.id = f.cidade_id
    left join public.regiao rg on rg.id = f.regiao_id
    where f.mesclada_em_id is null
      and f.dpp is not null
      and f.data_nascimento is null
      and o.estagio_p2 in ('pagamento_confirmado', 'nota_fiscal_emitida', 'consulta_prenatal_agendada',
                           'consulta_realizada', 'enfermeira_designada', 'aguardando_nascimento')
      and f.dpp <= v_hoje + v_horizonte + v_depois
      and (radar_nascimentos.regiao_id is null or f.regiao_id = radar_nascimentos.regiao_id)
  ) r;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'familia_id', f.id, 'nome', f.nome_exibicao, 'regiao_id', f.regiao_id,
           'data_nascimento', f.data_nascimento, 'estagio_p2', o.estagio_p2,
           'previsao_alta', (privado.op_acompanhamento(f.id)).previsao_alta,
           'titular', (select privado.op_nome_profissional(d.profissional_id)
                         from privado.op_designacao_ativa(f.id, 'titular') d where d.id is not null))
         order by f.data_nascimento, f.nome_exibicao, f.id), '[]'::jsonb)
    into v_nasceram
  from public.familia f
  join public.oportunidade o on o.familia_id = f.id
  where f.mesclada_em_id is null
    and f.data_nascimento is not null
    and o.estagio_p2 in ('bebe_nasceu', 'aguardando_alta')
    and (radar_nascimentos.regiao_id is null or f.regiao_id = radar_nascimentos.regiao_id);

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'regiao_id', op.regiao_id, 'regiao', op.regiao, 'semana', op.semana,
           'ocupacao_pct', op.ocupacao_pct, 'familias', op.familias,
           'acima_do_limite', v_alerta is not null and op.ocupacao_pct >= v_alerta)
         order by op.regiao, op.semana), '[]'::jsonb)
    into v_ocupacao
  from public.ocupacao_projetada op
  where op.semana >= pg_catalog.date_trunc('week', v_hoje)::date
    and op.semana <= v_hoje + v_horizonte + v_depois
    and (radar_nascimentos.regiao_id is null or op.regiao_id = radar_nascimentos.regiao_id);

  return pg_catalog.jsonb_build_object(
    'hoje', v_hoje,
    'janela', pg_catalog.jsonb_build_object('antes', v_antes, 'depois', v_depois),
    'limite_alerta_pct', v_alerta,
    'familias', v_familias,
    'nasceram', v_nasceram,
    'ocupacao', v_ocupacao);
end;
$$;
comment on function api.radar_nascimentos(uuid) is '[P36 item 2] Radar de nascimentos: famílias com pagamento confirmado que ainda não tiveram o bebê, pela DPP (estimativa, só para enxergar), com IG calculada, se estão na janela de parametro.janela_dpp_dias, titular e backup (aceita ou em oferta), consulta pré-natal, último contato e dias sem contato, check-in pendente e os alertas de DPP; as que já nasceram e esperam a alta; e a ocupação projetada por praça e semana. Coordenação e diretoria, AAL2.';


-- =============================================================================
-- 11. P36 · Etapa alertas_dpp do recálculo diário (PRD 10.1, 10.2)
--
-- checkin_dpp (DPP menos N dias), dpp_sem_confirmacao (mais N) e
-- dpp_sem_contato (mais N): os N vêm de automacao.gatilho. São automações
-- internas: só preparam e avisam a equipe. A DPP nunca move estágio, agenda
-- nem visita (PRD 6.10 regra 3); o nascimento continua sendo fato
-- registrado por uma pessoa.
-- =============================================================================

create function privado.recalculo_alertas_dpp() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_hoje    date := privado.op_hoje();
  v_d_check integer;
  v_d_conf  integer;
  v_d_cont  integer;
  v_rec     record;
  v_exec    uuid;
  v_id      uuid;
  v_titular public.designacao;
  v_checkins integer := 0;
  v_conf     integer := 0;
  v_contato  integer := 0;
begin
  select (a.gatilho ->> 'dias')::integer into v_d_check from public.automacao a
   where a.id = 'checkin_dpp' and pg_catalog.jsonb_typeof(a.gatilho -> 'dias') = 'number';
  select (a.gatilho ->> 'dias')::integer into v_d_conf from public.automacao a
   where a.id = 'dpp_sem_confirmacao' and pg_catalog.jsonb_typeof(a.gatilho -> 'dias') = 'number';
  select (a.gatilho ->> 'dias')::integer into v_d_cont from public.automacao a
   where a.id = 'dpp_sem_contato' and pg_catalog.jsonb_typeof(a.gatilho -> 'dias') = 'number';

  for v_rec in
    select f.id as familia_id, f.nome_exibicao, f.dpp, f.estado_sensivel
    from public.familia f
    join public.oportunidade o on o.familia_id = f.id
    where f.mesclada_em_id is null
      and f.dpp is not null
      and f.data_nascimento is null
      and o.estagio_p2 in ('pagamento_confirmado', 'nota_fiscal_emitida', 'consulta_prenatal_agendada',
                           'consulta_realizada', 'enfermeira_designada', 'aguardando_nascimento')
    order by f.dpp, f.id
  loop
    -- check-in de DPP: tarefa que sinaliza no radar e pede para confirmar
    -- alocação e backup; o texto para a família é de uma pessoa (23.2)
    if v_d_check is not null and v_hoje >= v_rec.dpp - v_d_check then
      v_exec := privado.op_iniciar_automacao('checkin_dpp', v_rec.familia_id, true);
      if v_exec is not null then
        v_id := privado.venda_criar_tarefa(v_rec.familia_id, 'checkin_dpp', 'Check-in de DPP: confirmar alocação e backup',
                  null, 'normal', pg_catalog.clock_timestamp(), 'checkin_dpp', '{}'::jsonb, 'operacional',
                  pg_catalog.jsonb_build_object('confirmar', pg_catalog.jsonb_build_array('alocacao', 'backup')));
        if v_id is null then
          -- freio ou "não contatar" barram o texto: a tarefa interna nasce
          -- sem ele e com o estado sensível à vista
          insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload, origem_automacao_id)
          values ('checkin_dpp', v_rec.familia_id, 'coordenacao', 'normal', 'Check-in de DPP: confirmar alocação e backup',
                  pg_catalog.jsonb_build_object('confirmar', pg_catalog.jsonb_build_array('alocacao', 'backup'),
                                                'estado_sensivel', v_rec.estado_sensivel, 'sem_texto', true),
                  'checkin_dpp');
        else
          update public.tarefa t set papel_responsavel = 'coordenacao', origem_automacao_id = 'checkin_dpp' where t.id = v_id;
        end if;
        v_checkins := v_checkins + 1;
      end if;
    end if;

    if v_d_conf is not null and v_hoje >= v_rec.dpp + v_d_conf then
      v_exec := privado.op_iniciar_automacao('dpp_sem_confirmacao', v_rec.familia_id, true);
      if v_exec is not null then
        perform privado.op_notificar('coordenacao', null, 'alta',
          'A data provável do parto passou e o nascimento não foi confirmado',
          v_rec.nome_exibicao || ': confirme com a família e registre o nascimento.', '/radar/' || v_rec.familia_id::text);
        v_conf := v_conf + 1;
      end if;
    end if;

    if v_d_cont is not null and v_hoje >= v_rec.dpp + v_d_cont
       and coalesce((privado.op_ultimo_contato(v_rec.familia_id) at time zone 'America/Sao_Paulo')::date, date '0001-01-01') < v_rec.dpp then
      v_exec := privado.op_iniciar_automacao('dpp_sem_contato', v_rec.familia_id, true);
      if v_exec is not null then
        v_titular := privado.op_designada(v_rec.familia_id, 'titular');
        insert into public.ocorrencia (familia_id, profissional_id, tipo, prioridade, titulo, descricao, responsavel_id, status)
        values (v_rec.familia_id, v_titular.profissional_id, 'contato_perdido', 'alta',
                'Sem contato depois da data provável do parto',
                'A data provável do parto passou há mais de ' || v_d_cont::text
                  || ' dias, o nascimento não foi registrado e a família não deu notícias desde então.',
                privado.op_usuario_profissional(v_titular.profissional_id),
                case when privado.op_usuario_profissional(v_titular.profissional_id) is null
                     then 'aberta'::public.status_ocorrencia else 'responsavel_definido'::public.status_ocorrencia end);
        v_contato := v_contato + 1;
      end if;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('checkins', v_checkins, 'sem_confirmacao', v_conf, 'sem_contato', v_contato);
end;
$$;
comment on function privado.recalculo_alertas_dpp() is 'Etapa alertas_dpp do recálculo diário (0011, PRD 10.1, P36 item 3): checkin_dpp (tarefa, uma por família, com o texto de 23.2 se o freio deixa), dpp_sem_confirmacao (aviso alto à coordenação) e dpp_sem_contato (ocorrência contato_perdido, com a titular como responsável quando há). Os prazos vêm de automacao.gatilho. Automações internas: só preparam a equipe; a DPP nunca move estágio, agenda nem visita. Sem grant.';


-- =============================================================================
-- 12. P36 · Cron a cada 5 minutos: ofertas vencidas, fatos e o que depende da titular
-- =============================================================================

create function privado.processar_designacoes() returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_expiradas integer := 0;
  v_fatos     integer := 0;
  v_avancos   integer := 0;
  v_f         record;
begin
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'cron', true);
  end if;

  begin
    v_expiradas := privado.expirar_ofertas();
  exception
    when others then
      v_expiradas := -1;
  end;

  v_fatos := privado.processar_fatos_operacao(null, true);

  -- consulta realizada e titular aceita depois: o P2 ainda espera; alta
  -- registrada e titular aceita depois: as visitas ainda não existem
  for v_f in
    select f.id
    from public.familia f
    join public.oportunidade o on o.familia_id = f.id
    where f.mesclada_em_id is null
      and (
        (o.estagio_p2 = 'consulta_realizada' and f.data_nascimento is null)
        or (f.data_alta is not null and f.data_nascimento is not null
            and not exists (select 1 from public.automacao_execucao e
                             where e.automacao_id = 'alta' and e.familia_id = f.id))
      )
      and (privado.op_designada(f.id, 'titular')).id is not null
    order by f.id
  loop
    begin
      perform privado.avancar_designacao(v_f.id);
      v_avancos := v_avancos + 1;
    exception
      when others then
        null;
    end;
  end loop;

  return pg_catalog.jsonb_build_object('expiradas', v_expiradas, 'fatos', v_fatos, 'avancos', v_avancos);
end;
$$;
comment on function privado.processar_designacoes() is '[P36] Rodada do cron (a cada 5 minutos, como sistema): vence oferta sem resposta (backup assume, coordenação avisada), processa nascimento e alta que chegaram pela ficha e avança o que dependia da titular aceita depois (P2 para aguardando_nascimento, visitas depois da alta). Erro de uma família não para as outras. Sem grant.';

select cron.schedule('processar_designacoes', '*/5 * * * *', 'select privado.processar_designacoes()');


-- =============================================================================
-- 13. Privilégios
--
-- privado e assistencial: nenhuma função nova é executável pelos papéis do
-- app. api: só authenticated (a checagem de papel e AAL está dentro).
-- =============================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'privado' and p.proname in (
             'operacao_recusar', 'op_hoje', 'op_posicao_p2', 'op_avancar_p2', 'op_notificar', 'op_evento',
             'op_iniciar_automacao', 'op_acompanhamento', 'garantir_acompanhamento', 'op_designada',
             'op_nome_profissional', 'op_usuario_profissional', 'op_ultimo_contato', 'abrir_prenatal',
             'ao_pagar_cobranca', 'op_tarefa_aberta', 'op_fechar_tarefas', 'prenatal_definicao', 'prenatal_campo',
             'prenatal_respondidos', 'avancar_designacao', 'tratar_recusa', 'expirar_ofertas', 'op_status_seguro',
             'op_dia_da_semana', 'gerar_visitas', 'aplicar_nascimento', 'aplicar_alta', 'enfileirar_fato_operacao',
             'processar_fatos_operacao', 'op_designacao_ativa', 'recalculo_alertas_dpp', 'processar_designacoes',
             'recalculo_alerta_34s'))
       or (n.nspname = 'assistencial' and p.proname = 'ler_consulta_prenatal')
  loop
    execute pg_catalog.format('revoke execute on function %s from public, anon, authenticated, service_role', r.assinatura);
  end loop;

  for r in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api' and p.proname in (
            'prenatal_consultas', 'prenatal_estado', 'agendar_consulta_prenatal', 'prenatal_abrir',
            'prenatal_salvar_campo', 'prenatal_concluir', 'alocacao_familia', 'oferecer_designacao',
            'atribuir_designacao', 'minhas_ofertas', 'responder_designacao', 'radar_nascimentos',
            'registrar_nascimento', 'registrar_previsao_alta', 'registrar_alta')
  loop
    execute pg_catalog.format('revoke execute on function %s from public, anon, service_role', r.assinatura);
    execute pg_catalog.format('grant execute on function %s to authenticated', r.assinatura);
  end loop;
end $$;


-- =============================================================================
-- 14. Trava (falha a migration se a regra quebrar): as mesmas de 0017 e 0018
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
  where n.nspname in ('privado', 'assistencial')
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname not in ('tem_papel', 'familias_atribuidas', 'aal2', 'sem_acento');
  if v_lista is not null then
    raise exception 'função de privado ou assistencial executável por authenticated fora da lista do PRD 11.10: %', v_lista;
  end if;

  -- security definer sem search_path vazio nas funções novas de privado
  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('privado', 'assistencial') and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false);
  if v_lista is not null then
    raise exception 'função security definer sem search_path vazio: %', v_lista;
  end if;
end $$;
