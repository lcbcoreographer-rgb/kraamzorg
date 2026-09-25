-- =============================================================================
-- 0017_api_crm.sql
--
-- Funções do schema api que o CRM já chama (hoje por rpcPendente, que devolve
-- "funcao_pendente" enquanto a função não existe) · PRD 5.2, 6.4, 6.10
-- (regras 2, 12 e 14), 7.1, 8.2, 11.3, 11.4, 11.7, 11.12, 13 e 21.2 ·
-- PROMPTS.md P17, P18 e P27 · ADR 0002 (seções 5 e 6) e ADR 0003
-- (pendências do P27).
--
-- Deduplicação e mesclagem (P17):
--   1. api.buscar_duplicatas_pipeline(): todos os pares de duplicata entre
--      famílias não mescladas, com a mesma regra de privado.buscar_duplicatas
--      (0010), numa consulta só (sem chamar a função uma vez por família).
--   2. api.mesclar_familias(familia_fica_id, familia_perde_id,
--      oportunidade_fica_id): move conversas (e com elas as mensagens),
--      transferências, tarefas, sessões de venda e oportunidades, marca
--      mesclada_em_id e grava auditoria e evento. Com oportunidade aberta nas
--      duas, pede qual fica; a outra passa para perdido (motivo outro,
--      detalhe "mesclada em <id>") por privado.transicionar antes de mover.
--   3. api.vincular_nova_gestacao(familia_id, familia_anterior_id): wrapper
--      de privado.vincular_nova_gestacao (0010).
--
-- Mensageria e tarefas (P18):
--   4. api.pode_enviar_mensagem(familia_id, categoria, canal): wrapper de
--      privado.pode_enviar_mensagem (0009), só para quem vê a família.
--   5. api.registrar_envio_tarefa(tarefa_id, texto): o "Enviei" numa
--      transação só (reconsulta o freio, mascara o texto, grava a mensagem
--      humana na conversa da família e conclui a tarefa).
--
-- Tela do agente (P27):
--   6. api.pausar_conversa(conversa_id, motivo) e
--      api.retomar_pausa_conversa(conversa_id): pausa manual da Isadora, com
--      a duração de parametro.agente_pausa_humano_horas. Nenhuma das duas
--      mexe no humano_comercial (agente_encerrado_em): a única saída dele
--      continua sendo api.retomar_agente (0014).
--   7. api.resolver_transferencia(handoff_id, desfecho): fecha a
--      transferência com o desfecho e nunca devolve a conversa à Isadora
--      (nem limpa a pausa, nem o humano_comercial).
--   8. api.reenviar_notificacao_handoff(handoff_id): "Reenviar aviso" da
--      faixa vermelha.
--   9. api.base_conhecimento_listar(), api.base_conhecimento_salvar(...),
--      api.base_conhecimento_aprovar(id) e api.ultima_ingestao_base():
--      agente.base_conhecimento e agente.ingestao_execucao, schema que o
--      PostgREST nunca expõe.
--  10. api.metricas_agente(desde, ate): os indicadores do PRD 11.12, só
--      agregados.
--
-- Papéis e AAL (ADR 0002, seção 5, linhas acrescentadas nesta sessão):
--   buscar_duplicatas_pipeline   comercial, coordenação, diretoria (quem lê
--                                família inteira); regra do perfil
--   mesclar_familias             comercial, diretoria (quem altera família e
--                                move o P1; o app também deixava a
--                                coordenação, que na matriz só lê família);
--                                regra do perfil
--   vincular_nova_gestacao       comercial, diretoria; regra do perfil
--   pode_enviar_mensagem         comercial, enfermeira, financeiro,
--                                coordenação, diretoria, e só família que o
--                                usuário vê (privado.tem_acesso_familia);
--                                regra do perfil
--   registrar_envio_tarefa       quem é responsável pela tarefa (mesma regra
--                                da RLS de tarefa) e vê a família; regra do
--                                perfil
--   pausar_conversa, retomar_pausa_conversa, resolver_transferencia,
--   reenviar_notificacao_handoff comercial, coordenação, diretoria
--                                ("Conversas do WhatsApp e handoffs", 13);
--                                regra do perfil
--   base_conhecimento_listar,
--   base_conhecimento_salvar,
--   ultima_ingestao_base         comercial, coordenação, diretoria (13:
--                                leitura do comercial e da coordenação;
--                                edição de rascunho pelos dois); regra do
--                                perfil
--   base_conhecimento_aprovar    só diretoria (o Leonardo aprova pelo papel
--                                de diretoria), sempre em AAL2
--   metricas_agente              comercial, coordenação, diretoria (tela do
--                                agente); só números
-- "Regra do perfil" = privado.autorizar(..., false): AAL2 para quem tem
-- papel com MFA obrigatório (enfermeira, financeiro, coordenação, diretoria),
-- AAL1 para comercial puro. Toda função confere papel e AAL por dentro,
-- porque a RLS não vale dentro de security definer.
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura; registradas no
-- ADR 0002 e no relatório da sessão):
--   * Mesclagem e o índice de oportunidade aberta (0003): o índice único
--     conta como aberta toda oportunidade sem estagio_p2 fora de perdido,
--     cancelado e distrato, e isso inclui perdido no pipeline 1 (estado que
--     reabre quando a família volta a escrever, 0006). Uma perdedora que
--     termina em perdido no P1 não pode morar ao lado da que fica: ela
--     continua na família que sai (ligada por mesclada_em_id, a linha do
--     tempo junta as duas). Se essa perdedora estiver na família que fica,
--     a mesclagem é recusada antes de mudar qualquer coisa: basta inverter
--     qual família fica. Perdedora no P2 (proposta_enviada ou
--     em_negociacao) vai para perdido e é movida. Perdedora depois do
--     ganho é recusada: ela precisa ser a que fica.
--   * Não se mescla a família que sai quando ela já tem contrato,
--     acompanhamento ou consulta pré-natal (dado de cliente ou
--     assistencial não muda de família por deduplicação), nem duas
--     famílias ligadas como gestações (regra 12).
--   * Pessoas, bebês e médicos não se movem (o P17 lista conversas,
--     mensagens, tarefas e oportunidades; o índice único de pessoa por
--     telefone recusaria a duplicata certa). A conversa movida passa a
--     apontar para a pessoa da família que fica com o mesmo telefone, se
--     houver. Transferências e sessões de venda acompanham a conversa e a
--     oportunidade. Execuções agendadas da família que sai são canceladas.
--   * Freio, histórico sensível e não contatar nunca se perdem na
--     mesclagem: se a família que sai está com freio mais alto, ele sobe na
--     que fica por privado.acionar_freio (com o motivo que já estava
--     gravado) e guarda a data e o autor do freio original, para quem
--     mesclou não ganhar o "Desfazer" de um freio que não acionou; se ela
--     pediu para não ser contatada, a que fica também fica em não contatar;
--     historico_sensivel verdadeiro passa para a que fica.
--   * registrar_envio_tarefa: categoria do freio pela automação que criou a
--     tarefa; sem automação, a do payload; sem nenhuma, conteudo (a mais
--     restrita das que falam com a família, a mesma do app). O canal é
--     sempre manual. Recusa do freio vira erro P0001 com o código do
--     motivo, e nada é gravado.
--   * Edição de item da base de conhecimento sempre volta para rascunho e
--     limpa a aprovação: texto que ninguém aprovou nunca é indexado.
--   * Desfecho da transferência fica em handoff.dados.desfecho (sem coluna
--     nova no modelo do PRD 6.4), com a lista fechada da tela do P27.
--   * "Reenviar aviso" grava uma notificação para o papel do destino, nos
--     canais app, whatsapp_interno e email, e volta notificacao_ok para
--     nulo ("aguardando"): a faixa vermelha sai e a central (P18) entrega.
--     Quem entrega de novo e confirma é a central, não esta função.
--
-- Nenhum texto de família, preço ou limite no SQL: duração da pausa,
-- janela de silêncio das métricas e cortes da deduplicação vêm de
-- parametro. Execute só para authenticated; anon e service_role sem nada.
-- =============================================================================


-- =============================================================================
-- 1. api.buscar_duplicatas_pipeline()
--
-- Mesma regra de privado.buscar_duplicatas (0010), para todos os pares de
-- uma vez, entre famílias não mescladas:
--   certas          telefone normalizado em comum (pessoa ou conversa) e
--                   datas próximas ou desconhecidas;
--   novasGestacoes  telefone em comum, mas a data de referência
--                   (nascimento, ou DPP) difere mais que nova_gestacao_dias:
--                   sugere o vínculo da regra 12, nunca a mesclagem. "a" é
--                   a mais recente e "b" a anterior (a ordem que
--                   api.vincular_nova_gestacao pede);
--   provaveis       sem telefone em comum, as duas DPPs a até dpp_dias dias
--                   e nome parecido (maior similaridade entre os nomes de
--                   família e entre os nomes das pessoas) acima do limiar.
-- Famílias já ligadas pela regra 12 não voltam como sugestão. As chaves do
-- jsonb seguem o tipo ResultadoDuplicatas da tela
-- (src/modules/crm/deduplicacao/tipos.ts). Devolve só o que a tela de
-- duplicatas mostra: id, nome, bairro, cidade e DPP.
-- =============================================================================

create function api.buscar_duplicatas_pipeline() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_cfg       record;
  v_resultado jsonb;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);

  select * into v_cfg from privado.config_deduplicacao();

  with fam as (
    select f.id,
           f.nome_exibicao,
           f.bairro,
           c.nome as cidade,
           f.dpp,
           coalesce(f.data_nascimento, f.dpp) as referencia,
           f.familia_anterior_id,
           pg_catalog.lower(privado.sem_acento(f.nome_exibicao)) as nome_normal
    from public.familia f
    left join public.cidade c on c.id = f.cidade_id
    where f.mesclada_em_id is null
  ),
  json_fam as (
    select fam.id,
           pg_catalog.jsonb_build_object('id', fam.id, 'nome', fam.nome_exibicao, 'bairro', fam.bairro,
                                         'cidade', fam.cidade, 'dpp', fam.dpp) as j
    from fam
  ),
  tel as (
    select p.familia_id as fid, privado.telefone_normalizado(p.telefone_e164) as t, p.telefone_e164 as e164
    from public.pessoa p
    join fam on fam.id = p.familia_id
    where p.telefone_e164 is not null
    union
    select c.familia_id, privado.telefone_normalizado(c.telefone_e164), c.telefone_e164
    from public.conversa c
    join fam on fam.id = c.familia_id
    where c.telefone_e164 is not null
  ),
  por_telefone as (
    select ta.fid as a_id, tb.fid as b_id, min(ta.e164) as telefone
    from tel ta
    join tel tb on tb.t = ta.t and ta.fid < tb.fid
    where ta.t is not null
    group by ta.fid, tb.fid
  ),
  pares_telefone as (
    select pt.a_id, pt.b_id, pt.telefone,
           fa.referencia as ref_a, fb.referencia as ref_b,
           (fa.referencia is not null and fb.referencia is not null
            and abs(fa.referencia - fb.referencia) > v_cfg.nova_gestacao_dias) as nova
    from por_telefone pt
    join fam fa on fa.id = pt.a_id
    join fam fb on fb.id = pt.b_id
    where fa.id is distinct from fb.familia_anterior_id
      and fb.id is distinct from fa.familia_anterior_id
  ),
  pessoas_nome as (
    select p.familia_id as fid, pg_catalog.lower(privado.sem_acento(p.nome)) as n
    from public.pessoa p
    join fam on fam.id = p.familia_id
  ),
  candidatas as (
    select fa.id as a_id, fb.id as b_id, abs(fa.dpp - fb.dpp) as dias,
           greatest(
             extensions.similarity(fa.nome_normal, fb.nome_normal),
             (select max(extensions.similarity(pa.n, pb.n))
                from pessoas_nome pa
                join pessoas_nome pb on pb.fid = fb.id
               where pa.fid = fa.id)
           )::numeric as sim
    from fam fa
    join fam fb on fa.id < fb.id
               and fa.dpp is not null and fb.dpp is not null
               and abs(fa.dpp - fb.dpp) <= v_cfg.dpp_dias
    where fa.id is distinct from fb.familia_anterior_id
      and fb.id is distinct from fa.familia_anterior_id
      and not exists (select 1 from por_telefone pt where pt.a_id = fa.id and pt.b_id = fb.id)
  )
  select pg_catalog.jsonb_build_object(
    'certas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('tipo', 'certa', 'a', ja.j, 'b', jb.j, 'telefone', pt.telefone)
                                  order by pt.a_id, pt.b_id)
      from pares_telefone pt
      join json_fam ja on ja.id = pt.a_id
      join json_fam jb on jb.id = pt.b_id
      where not pt.nova), '[]'::jsonb),
    'novasGestacoes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'tipo', 'certa',
               'a', case when pt.ref_a >= pt.ref_b then ja.j else jb.j end,
               'b', case when pt.ref_a >= pt.ref_b then jb.j else ja.j end,
               'telefone', pt.telefone,
               'diasEntreDatas', abs(pt.ref_a - pt.ref_b))
             order by pt.a_id, pt.b_id)
      from pares_telefone pt
      join json_fam ja on ja.id = pt.a_id
      join json_fam jb on jb.id = pt.b_id
      where pt.nova), '[]'::jsonb),
    'provaveis', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'tipo', 'provavel', 'a', ja.j, 'b', jb.j,
               'similaridade', pg_catalog.round(k.sim, 3),
               'diasEntreDpp', k.dias)
             order by k.sim desc, k.a_id, k.b_id)
      from candidatas k
      join json_fam ja on ja.id = k.a_id
      join json_fam jb on jb.id = k.b_id
      where k.sim >= v_cfg.limiar_nome), '[]'::jsonb),
    'indisponivelNoBanco', false)
  into v_resultado;

  return v_resultado;
end;
$$;
comment on function api.buscar_duplicatas_pipeline() is 'Tela de duplicatas (P17 item 1, PRD 6.10 regras 2 e 12): todos os pares entre famílias não mescladas, pela regra de privado.buscar_duplicatas (0010) e parametro.deduplicacao. {certas, novasGestacoes (a = mais recente, b = anterior), provaveis, indisponivelNoBanco: false}, cada família com id, nome, bairro, cidade e dpp. Comercial, coordenação e diretoria, AAL pela regra do perfil.';


-- =============================================================================
-- 2. api.mesclar_familias(familia_fica_id, familia_perde_id, oportunidade_fica_id)
--
-- Ordem (tudo numa transação; qualquer recusa desfaz tudo):
--   1. papel, famílias diferentes, travadas em ordem de id, existentes, não
--      mescladas, não ligadas como gestações, e a que sai sem contrato,
--      acompanhamento nem consulta pré-natal;
--   2. oportunidades abertas pela regra do índice (0003). Com as duas
--      abertas, oportunidade_fica_id é obrigatória e precisa ser uma delas;
--      a outra vai para perdido por privado.transicionar (P1 a partir de
--      novo, em_conversa_ia ou qualificado; P2 a partir de proposta_enviada
--      ou em_negociacao), com motivo_perda outro e detalhe
--      "mesclada em <id>". As recusas acontecem antes de qualquer escrita;
--   3. freio (sem "Desfazer" para quem mesclou), histórico sensível e não
--      contatar herdados pela família que fica;
--   4. move oportunidades (menos a que continua aberta pelo índice quando a
--      que fica já tem uma), conversas, transferências, tarefas e sessões
--      de venda; ajusta a pessoa das conversas movidas; cancela execuções
--      agendadas da que sai; religa gestações posteriores à que fica;
--   5. marca mesclada_em_id, grava evento na ficha que fica e
--      log_auditoria (acao mesclagem, só ids e contagens).
-- Os eventos não se movem (evento_familia é append-only): a linha do tempo
-- junta os da família mesclada por mesclada_em_id (P16).
-- =============================================================================

create function api.mesclar_familias(familia_fica_id uuid, familia_perde_id uuid, oportunidade_fica_id uuid default null)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_fica        public.familia;
  v_perde       public.familia;
  v_op_fica     public.oportunidade;
  v_op_perde    public.oportunidade;
  v_perdedora   public.oportunidade;
  v_mantida     uuid;
  v_perdida     uuid;
  v_detalhe     text;
  v_freio       jsonb;
  v_oport       integer := 0;
  v_conversas   integer := 0;
  v_handoffs    integer := 0;
  v_tarefas     integer := 0;
  v_sessoes     integer := 0;
  v_execucoes   integer := 0;
begin
  -- 1. quem pede e as duas famílias
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if mesclar_familias.familia_fica_id is null or mesclar_familias.familia_perde_id is null
     or mesclar_familias.familia_fica_id = mesclar_familias.familia_perde_id then
    raise exception 'api.mesclar_familias: informe duas famílias diferentes'
      using errcode = '22023';
  end if;

  perform 1 from public.familia f
   where f.id in (mesclar_familias.familia_fica_id, mesclar_familias.familia_perde_id)
   order by f.id
   for update;

  select f.* into v_fica  from public.familia f where f.id = mesclar_familias.familia_fica_id;
  select f.* into v_perde from public.familia f where f.id = mesclar_familias.familia_perde_id;
  if v_fica.id is null or v_perde.id is null then
    raise exception 'api.mesclar_familias: família não existe'
      using errcode = 'P0002';
  end if;
  if v_fica.mesclada_em_id is not null or v_perde.mesclada_em_id is not null then
    raise exception 'api.mesclar_familias: uma das famílias já foi mesclada; use a família que ficou'
      using errcode = '22023';
  end if;
  if v_fica.familia_anterior_id is not distinct from v_perde.id
     or v_perde.familia_anterior_id is not distinct from v_fica.id then
    raise exception 'api.mesclar_familias: as duas famílias estão ligadas como gestações diferentes (PRD 6.10 regra 12); não se mesclam'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.contrato k where k.familia_id = v_perde.id)
     or exists (select 1 from public.acompanhamento a where a.familia_id = v_perde.id)
     or exists (select 1 from public.consulta_prenatal cp where cp.familia_id = v_perde.id) then
    raise exception 'api.mesclar_familias: a família que sai já tem contrato ou atendimento; escolha essa família para ficar'
      using errcode = '22023';
  end if;

  -- 2. oportunidades abertas pela regra do índice único (0003)
  select o.* into v_op_fica
    from public.oportunidade o
   where o.familia_id = v_fica.id
     and (o.estagio_p2 is null or o.estagio_p2 not in ('perdido', 'cancelado', 'distrato'))
   for update;
  select o.* into v_op_perde
    from public.oportunidade o
   where o.familia_id = v_perde.id
     and (o.estagio_p2 is null or o.estagio_p2 not in ('perdido', 'cancelado', 'distrato'))
   for update;

  if mesclar_familias.oportunidade_fica_id is not null
     and not exists (select 1 from public.oportunidade o
                     where o.id = mesclar_familias.oportunidade_fica_id
                       and o.familia_id in (v_fica.id, v_perde.id)) then
    raise exception 'api.mesclar_familias: a oportunidade escolhida não é de nenhuma das duas famílias'
      using errcode = '22023';
  end if;

  if v_op_fica.id is not null and v_op_perde.id is not null then
    if mesclar_familias.oportunidade_fica_id is null then
      raise exception 'api.mesclar_familias: as duas famílias têm oportunidade aberta; informe qual oportunidade fica (P17 item 2)'
        using errcode = '22023';
    end if;
    if mesclar_familias.oportunidade_fica_id not in (v_op_fica.id, v_op_perde.id) then
      raise exception 'api.mesclar_familias: a oportunidade que fica precisa ser uma das duas oportunidades abertas'
        using errcode = '22023';
    end if;

    v_mantida := mesclar_familias.oportunidade_fica_id;
    if v_mantida = v_op_fica.id then
      v_perdedora := v_op_perde;
    else
      v_perdedora := v_op_fica;
    end if;
    v_perdida := v_perdedora.id;

    -- recusas antes de qualquer escrita
    if v_perdedora.estagio_p2 is not null
       and v_perdedora.estagio_p2 not in ('proposta_enviada', 'em_negociacao') then
      raise exception 'api.mesclar_familias: a oportunidade que sai já passou do ganho (%); ela precisa ser a que fica', v_perdedora.estagio_p2
        using errcode = '22023';
    end if;
    if v_perdedora.estagio_p2 is null and v_perdedora.familia_id = v_fica.id then
      -- perdido no P1 ainda conta como aberta no índice: não cabe ao lado da
      -- que fica. Invertendo a família que fica, ela continua na que sai.
      raise exception 'api.mesclar_familias: a oportunidade que sai está no pipeline 1 da família que fica; escolha a outra família para ficar'
        using errcode = '22023';
    end if;

    v_detalhe := 'mesclada em ' || v_fica.id::text;
    if v_perdedora.estagio_p2 is not null then
      perform privado.transicionar('p2', v_perdedora.id, 'perdido', v_detalhe);
      update public.oportunidade o
         set motivo_perda = 'outro', motivo_perda_detalhe = v_detalhe
       where o.id = v_perdedora.id;
    elsif v_perdedora.estagio_p1 is distinct from 'perdido' then
      perform privado.transicionar('p1', v_perdedora.id, 'perdido', v_detalhe);
      update public.oportunidade o
         set motivo_perda = 'outro', motivo_perda_detalhe = v_detalhe
       where o.id = v_perdedora.id;
    end if;
  elsif v_op_fica.id is not null then
    v_mantida := v_op_fica.id;
  else
    v_mantida := v_op_perde.id;
  end if;

  -- 3. freio, histórico sensível e não contatar nunca se perdem
  if v_perde.estado_sensivel > v_fica.estado_sensivel then
    v_freio := privado.acionar_freio(v_fica.id, v_perde.estado_sensivel, v_perde.estado_sensivel_motivo);
    -- O freio herdado não é um acionamento de quem mesclou: fica com a data
    -- e o autor do freio original. Isso também fecha o "Desfazer" e a
    -- justificativa de quem mesclou (privado.desfazer_freio e
    -- privado.justificar_freio conferem o autor e a data do último
    -- acionamento); sem isso, o comercial baixava para normal, pelo
    -- "Desfazer", um bloqueio_total que só a coordenação ou a diretoria
    -- revertem (PRD 8.3). A tarefa de justificativa aberta para quem mesclou
    -- é cancelada pelo mesmo motivo.
    update public.familia f
       set estado_sensivel_em = v_perde.estado_sensivel_em,
           estado_sensivel_por = v_perde.estado_sensivel_por
     where f.id = v_fica.id;
    if v_freio ->> 'tarefa_justificativa_id' is not null then
      update public.tarefa t
         set status = 'cancelada'
       where t.id = (v_freio ->> 'tarefa_justificativa_id')::uuid;
    end if;
  end if;
  -- complicação em gestação anterior (PRD 6.2): o agente recebe o booleano
  -- para não perguntar de novo
  if v_perde.historico_sensivel and not v_fica.historico_sensivel then
    update public.familia f set historico_sensivel = true where f.id = v_fica.id;
  end if;
  if v_perde.nao_contatar and not v_fica.nao_contatar then
    update public.familia f
       set nao_contatar = true,
           nao_contatar_em = coalesce(v_perde.nao_contatar_em, pg_catalog.now()),
           nao_contatar_motivo = v_perde.nao_contatar_motivo
     where f.id = v_fica.id;
  end if;

  -- 4. mover (a oportunidade que continua aberta pelo índice fica na que sai
  --    quando a que fica já tem uma)
  update public.oportunidade o
     set familia_id = v_fica.id
   where o.familia_id = v_perde.id
     and not ((o.estagio_p2 is null or o.estagio_p2 not in ('perdido', 'cancelado', 'distrato'))
              and exists (select 1 from public.oportunidade x
                          where x.familia_id = v_fica.id
                            and (x.estagio_p2 is null or x.estagio_p2 not in ('perdido', 'cancelado', 'distrato'))));
  get diagnostics v_oport = row_count;

  update public.conversa c set familia_id = v_fica.id where c.familia_id = v_perde.id;
  get diagnostics v_conversas = row_count;

  update public.conversa c
     set pessoa_id = (select pf.id from public.pessoa pf
                       where pf.familia_id = v_fica.id
                         and privado.telefone_normalizado(pf.telefone_e164) = privado.telefone_normalizado(pp.telefone_e164)
                       order by pf.contato_principal desc, pf.criado_em
                       limit 1)
    from public.pessoa pp
   where c.familia_id = v_fica.id
     and c.pessoa_id = pp.id
     and pp.familia_id = v_perde.id
     and exists (select 1 from public.pessoa pf
                  where pf.familia_id = v_fica.id
                    and privado.telefone_normalizado(pf.telefone_e164) = privado.telefone_normalizado(pp.telefone_e164));

  update public.handoff h set familia_id = v_fica.id where h.familia_id = v_perde.id;
  get diagnostics v_handoffs = row_count;

  update public.tarefa t set familia_id = v_fica.id where t.familia_id = v_perde.id;
  get diagnostics v_tarefas = row_count;

  update public.sessao_venda s set familia_id = v_fica.id where s.familia_id = v_perde.id;
  get diagnostics v_sessoes = row_count;

  update public.automacao_execucao e
     set status = 'cancelada', motivo_aborto = 'familia_mesclada'
   where e.familia_id = v_perde.id and e.status = 'agendada';
  get diagnostics v_execucoes = row_count;

  update public.familia f set familia_anterior_id = v_fica.id
   where f.familia_anterior_id = v_perde.id and f.id <> v_fica.id;

  -- 5. marca, evento e log
  update public.familia f set mesclada_em_id = v_fica.id where f.id = v_perde.id;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (v_fica.id, 'mesclagem', 'familia_mesclada',
          pg_catalog.jsonb_build_object('familia_perde_id', v_perde.id,
                                        'oportunidade_fica_id', v_mantida,
                                        'oportunidade_perdida_id', v_perdida),
          false, auth.uid());

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), 'mesclagem', 'familia', v_perde.id::text,
          pg_catalog.jsonb_build_object('mesclada_em_id', null),
          pg_catalog.jsonb_build_object(
            'mesclada_em_id', v_fica.id,
            'oportunidade_fica_id', v_mantida,
            'oportunidade_perdida_id', v_perdida,
            'freio_herdado', v_freio is not null,
            'movidos', pg_catalog.jsonb_build_object('oportunidades', v_oport, 'conversas', v_conversas,
                                                     'transferencias', v_handoffs, 'tarefas', v_tarefas,
                                                     'sessoes_venda', v_sessoes),
            'execucoes_canceladas', v_execucoes),
          privado.origem_atual(), privado.ip_requisicao());

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'familia_fica_id', v_fica.id,
    'familia_perde_id', v_perde.id,
    'oportunidade_fica_id', v_mantida,
    'oportunidade_perdida_id', v_perdida,
    'freio_herdado', v_freio is not null,
    'movidos', pg_catalog.jsonb_build_object('oportunidades', v_oport, 'conversas', v_conversas,
                                             'transferencias', v_handoffs, 'tarefas', v_tarefas,
                                             'sessoes_venda', v_sessoes),
    'execucoes_canceladas', v_execucoes);
end;
$$;
comment on function api.mesclar_familias(uuid, uuid, uuid) is 'Mesclagem (P17 item 2, PRD 6.10 regras 2 e 14): comercial ou diretoria, AAL pela regra do perfil. Com oportunidade aberta nas duas, oportunidade_fica_id obrigatória; a outra vai para perdido (outro, "mesclada em <id>") por privado.transicionar antes de mover (perdida no P1 continua na família que sai, pelo índice de oportunidade aberta). Move oportunidades, conversas, transferências, tarefas e sessões de venda; herda freio (com data e autor originais, sem "Desfazer" para quem mesclou), historico_sensivel e não contatar; cancela execuções agendadas; marca mesclada_em_id; evento mesclagem e log_auditoria. Recusa família com contrato, acompanhamento ou consulta pré-natal saindo, e gestações ligadas.';


-- =============================================================================
-- 3. api.vincular_nova_gestacao(familia_id, familia_anterior_id)
-- =============================================================================

create function api.vincular_nova_gestacao(familia_id uuid, familia_anterior_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.vincular_nova_gestacao(vincular_nova_gestacao.familia_id, vincular_nova_gestacao.familia_anterior_id);
end;
$$;
comment on function api.vincular_nova_gestacao(uuid, uuid) is 'Vínculo de nova gestação (P17, PRD 6.10 regra 12): comercial ou diretoria, AAL pela regra do perfil; chama privado.vincular_nova_gestacao (0010), que confere ciclo, mesclagem, vínculo prévio e ordem das datas e grava o evento nova_gestacao.';


-- =============================================================================
-- 4. api.pode_enviar_mensagem(familia_id, categoria, canal)
--
-- Porta de saída do adaptador de mensageria do app (P18, PRD 8.2):
-- devolve o {pode, motivo} de privado.pode_enviar_mensagem sem mudança.
-- Quem não vê a família (privado.tem_acesso_familia, a regra de linha da
-- RLS de familia) é recusado com 42501: o freio de uma família alheia não
-- é consultável.
-- =============================================================================

create function api.pode_enviar_mensagem(
  familia_id uuid,
  categoria  public.categoria_automacao,
  canal      public.modo_mensageria default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if pode_enviar_mensagem.familia_id is not null and not privado.tem_acesso_familia(pode_enviar_mensagem.familia_id)
     and exists (select 1 from public.familia f where f.id = pode_enviar_mensagem.familia_id) then
    raise exception 'api.pode_enviar_mensagem: só quem vê a família consulta o envio (PRD 13)'
      using errcode = '42501';
  end if;
  return privado.pode_enviar_mensagem(pode_enviar_mensagem.familia_id, pode_enviar_mensagem.categoria,
                                      pode_enviar_mensagem.canal);
end;
$$;
comment on function api.pode_enviar_mensagem(uuid, public.categoria_automacao, public.modo_mensageria) is 'Wrapper do app para privado.pode_enviar_mensagem (P18, PRD 8.2): {pode, motivo}. Comercial, enfermeira, financeiro, coordenação e diretoria, só em família que o usuário vê (privado.tem_acesso_familia); AAL pela regra do perfil.';


-- =============================================================================
-- 5. api.registrar_envio_tarefa(tarefa_id, texto)
--
-- O "Enviei" (P18 item 2, PRD 23.2), numa transação só: nunca mensagem
-- gravada com a tarefa aberta, nem o contrário.
--   1. tarefa aberta ou em andamento, de quem chama (mesma regra da RLS de
--      tarefa: responsável, papel responsável sem pessoa, ou diretoria), de
--      uma família que quem chama vê;
--   2. reconsulta privado.pode_enviar_mensagem(família, categoria,
--      'manual') no instante da gravação; recusa vira P0001 com o código;
--   3. grava a mensagem (saida, humano, texto mascarado por
--      privado.mascarar_documentos) na conversa da família iniciada por
--      ela, a mais recente;
--   4. conclui a tarefa. Se o payload traz cadencia_etapa (tarefa da
--      cadência de follow-up), a oportunidade aberta avança até essa etapa
--      (nunca volta). A régua segue sozinha: a tarefa concluída de
--      categoria conteudo conta como a mensagem de conteúdo do dia.
-- =============================================================================

create function api.registrar_envio_tarefa(tarefa_id uuid, texto text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_t         public.tarefa;
  v_texto     text := nullif(pg_catalog.btrim(registrar_envio_tarefa.texto), '');
  v_categoria public.categoria_automacao;
  v_pode      jsonb;
  v_conversa  uuid;
  v_mensagem  uuid;
  v_etapa     integer;
  v_telefone  text;
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if registrar_envio_tarefa.tarefa_id is null then
    raise exception 'api.registrar_envio_tarefa: tarefa_id é obrigatório'
      using errcode = '22023';
  end if;

  select t.* into v_t from public.tarefa t where t.id = registrar_envio_tarefa.tarefa_id for update;
  if not found then
    raise exception 'api.registrar_envio_tarefa: tarefa % não existe', registrar_envio_tarefa.tarefa_id
      using errcode = 'P0002';
  end if;

  -- mesma regra de linha da RLS de tarefa (0007)
  if not (coalesce(v_t.responsavel_id = v_uid, false)
          or (v_t.responsavel_id is null and v_t.papel_responsavel is not null and privado.tem_papel(v_t.papel_responsavel))
          or privado.tem_papel('diretoria')) then
    raise exception 'api.registrar_envio_tarefa: a tarefa não é de quem pediu (PRD 13)'
      using errcode = '42501';
  end if;

  if v_t.status not in ('aberta', 'em_andamento') then
    raise exception 'api.registrar_envio_tarefa: a tarefa já está %', v_t.status
      using errcode = '22023';
  end if;
  if v_t.familia_id is null then
    raise exception 'api.registrar_envio_tarefa: familia_obrigatoria'
      using errcode = '22023';
  end if;
  if not privado.tem_acesso_familia(v_t.familia_id) then
    raise exception 'api.registrar_envio_tarefa: só quem vê a família registra o envio (PRD 13)'
      using errcode = '42501';
  end if;
  if v_texto is null then
    raise exception 'api.registrar_envio_tarefa: o texto enviado é obrigatório'
      using errcode = '22023';
  end if;

  -- categoria: automação que criou a tarefa, senão o payload, senão conteudo
  select a.categoria into v_categoria from public.automacao a where a.id = v_t.origem_automacao_id;
  if v_categoria is null and (v_t.payload ->> 'categoria') in ('interna', 'operacional', 'conteudo', 'marketing') then
    v_categoria := (v_t.payload ->> 'categoria')::public.categoria_automacao;
  end if;
  v_categoria := coalesce(v_categoria, 'conteudo');

  v_pode := privado.pode_enviar_mensagem(v_t.familia_id, v_categoria, 'manual');
  if not coalesce((v_pode ->> 'pode')::boolean, false) then
    raise exception 'api.registrar_envio_tarefa: envio recusado: %', coalesce(v_pode ->> 'motivo', 'desconhecido')
      using errcode = 'P0001';
  end if;

  -- conversa da família iniciada por ela (a que privado.pode_enviar_mensagem
  -- exige no canal manual); com telefone no payload, a desse telefone primeiro
  v_telefone := coalesce(v_t.payload ->> 'telefoneE164', v_t.payload ->> 'telefone_e164');
  select c.id into v_conversa
    from public.conversa c
   where c.familia_id = v_t.familia_id
     and c.iniciada_por = 'cliente'
   order by (v_telefone is not null
             and privado.telefone_normalizado(c.telefone_e164) = privado.telefone_normalizado(v_telefone)) desc,
            coalesce(c.ultima_entrada_em, c.primeira_msg_em, c.criado_em) desc
   limit 1
   for update;
  if v_conversa is null then
    raise exception 'api.registrar_envio_tarefa: envio recusado: conversa_nao_iniciada_pela_familia'
      using errcode = 'P0001';
  end if;

  insert into public.mensagem (conversa_id, direcao, enviado_por, tipo, conteudo, criado_por)
  values (v_conversa, 'saida', 'humano', 'texto', privado.mascarar_documentos(v_texto), v_uid)
  returning id into v_mensagem;

  update public.conversa c set ultima_saida_em = pg_catalog.now() where c.id = v_conversa;

  update public.tarefa t
     set status = 'concluida', concluida_em = pg_catalog.now(), concluida_por = v_uid
   where t.id = v_t.id;

  if pg_catalog.jsonb_typeof(v_t.payload -> 'cadencia_etapa') = 'number' then
    v_etapa := (v_t.payload ->> 'cadencia_etapa')::numeric::integer;
    update public.oportunidade o
       set cadencia_etapa = greatest(o.cadencia_etapa, v_etapa)
     where o.familia_id = v_t.familia_id
       and (o.estagio_p2 is null or o.estagio_p2 not in ('perdido', 'cancelado', 'distrato'));
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'tarefa_id', v_t.id,
    'mensagem_id', v_mensagem,
    'conversa_id', v_conversa,
    'categoria', v_categoria);
end;
$$;
comment on function api.registrar_envio_tarefa(uuid, text) is '"Enviei" (P18 item 2, PRD 23.2): quem responde pela tarefa e vê a família; reconsulta privado.pode_enviar_mensagem (categoria da automação, do payload ou conteudo; canal manual), grava a mensagem humana mascarada na conversa iniciada pela família e conclui a tarefa, tudo numa transação. Recusa do freio: P0001 com o código do motivo. payload.cadencia_etapa avança a cadência da oportunidade aberta.';


-- =============================================================================
-- 6. Pausa manual da Isadora (P27 item 1, PRD 11.3 e 11.7)
--
-- pausar_conversa: agente_pausado_ate = agora + agente_pausa_humano_horas
-- (parâmetro ausente: recusa, nunca um número do código), sem nunca
-- encurtar uma pausa maior que já vale; o motivo vira campo livre (sem
-- colchetes, sem quebra, até 200 caracteres).
-- retomar_pausa_conversa: limpa só a pausa. Conversa em humano_comercial
-- continua nele (a Isadora não volta): só api.retomar_agente devolve.
-- =============================================================================

create function api.pausar_conversa(conversa_id uuid, motivo text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_horas numeric;
  v_c     public.conversa;
  v_ate   timestamptz;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  v_horas := privado.agente_parametro_numero('agente_pausa_humano_horas');
  if v_horas is null or v_horas <= 0 then
    raise exception 'api.pausar_conversa: parametro agente_pausa_humano_horas ausente ou inválido (PRD 11.3)'
      using errcode = '22023';
  end if;

  select c.* into v_c from public.conversa c where c.id = pausar_conversa.conversa_id for update;
  if not found then
    raise exception 'api.pausar_conversa: conversa % não existe', pausar_conversa.conversa_id
      using errcode = 'P0002';
  end if;

  v_ate := pg_catalog.now() + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision);
  if v_c.agente_pausado_ate is not null and v_c.agente_pausado_ate > v_ate then
    v_ate := v_c.agente_pausado_ate;
  end if;

  update public.conversa c
     set agente_pausado_ate = v_ate,
         agente_pausa_motivo = coalesce(privado.campo_livre(pausar_conversa.motivo), c.agente_pausa_motivo)
   where c.id = v_c.id;

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), 'agente_pausado', 'conversa', v_c.id::text,
          pg_catalog.jsonb_build_object('agente_pausado_ate', v_c.agente_pausado_ate),
          pg_catalog.jsonb_build_object('agente_pausado_ate', v_ate),
          privado.origem_atual(), privado.ip_requisicao());

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'conversa_id', v_c.id,
    'horas', v_horas,
    'pausado_ate', v_ate,
    'humano_comercial', v_c.agente_encerrado_em is not null);
end;
$$;
comment on function api.pausar_conversa(uuid, text) is 'Pausa manual da Isadora (P27, PRD 11.3 e 11.7): comercial, coordenação ou diretoria, AAL pela regra do perfil. agente_pausado_ate = agora + parametro.agente_pausa_humano_horas (sem o parâmetro, recusa), nunca encurta pausa maior; motivo como campo livre. log_auditoria agente_pausado. Não mexe no humano_comercial.';

create function api.retomar_pausa_conversa(conversa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c       public.conversa;
  v_alterou boolean;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select c.* into v_c from public.conversa c where c.id = retomar_pausa_conversa.conversa_id for update;
  if not found then
    raise exception 'api.retomar_pausa_conversa: conversa % não existe', retomar_pausa_conversa.conversa_id
      using errcode = 'P0002';
  end if;

  v_alterou := v_c.agente_pausado_ate is not null or v_c.agente_pausa_motivo is not null;
  if v_alterou then
    update public.conversa c
       set agente_pausado_ate = null,
           agente_pausa_motivo = null
     where c.id = v_c.id;

    insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
    values (auth.uid(), 'agente_pausa_retomada', 'conversa', v_c.id::text,
            pg_catalog.jsonb_build_object('agente_pausado_ate', v_c.agente_pausado_ate),
            pg_catalog.jsonb_build_object('agente_pausado_ate', null),
            privado.origem_atual(), privado.ip_requisicao());
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'conversa_id', v_c.id,
    'alterado', v_alterou,
    'humano_comercial', v_c.agente_encerrado_em is not null);
end;
$$;
comment on function api.retomar_pausa_conversa(uuid) is '"Devolver agora" de uma pausa (P27): comercial, coordenação ou diretoria, AAL pela regra do perfil. Limpa só agente_pausado_ate e agente_pausa_motivo, com log agente_pausa_retomada. Conversa em humano_comercial continua nele: só api.retomar_agente devolve à Isadora.';


-- =============================================================================
-- 7. api.resolver_transferencia(handoff_id, desfecho)
--
-- "Marcar como resolvida" (P27 item 1, fluxos.md fluxo E): desfecho na
-- lista fechada da tela (formulario_enviado, sessao_marcada,
-- condicao_negociada, sem_retorno), gravado em handoff.dados.desfecho.
-- Nunca devolve a conversa à Isadora: não toca em conversa (nem pausa, nem
-- agente_encerrado_em). PRD 11.4 e 11.7 [v4.2], D-17.
-- =============================================================================

create function api.resolver_transferencia(handoff_id uuid, desfecho text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_h public.handoff;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  if resolver_transferencia.desfecho is null
     or resolver_transferencia.desfecho not in ('formulario_enviado', 'sessao_marcada', 'condicao_negociada', 'sem_retorno') then
    raise exception 'api.resolver_transferencia: desfecho deve ser formulario_enviado, sessao_marcada, condicao_negociada ou sem_retorno'
      using errcode = '22023';
  end if;

  select h.* into v_h from public.handoff h where h.id = resolver_transferencia.handoff_id for update;
  if not found then
    raise exception 'api.resolver_transferencia: transferência % não existe', resolver_transferencia.handoff_id
      using errcode = 'P0002';
  end if;
  if v_h.status not in ('aberto', 'assumido') then
    raise exception 'api.resolver_transferencia: a transferência já está %', v_h.status
      using errcode = '22023';
  end if;

  update public.handoff h
     set status = 'resolvido',
         resolvido_em = pg_catalog.now(),
         dados = h.dados || pg_catalog.jsonb_build_object('desfecho', resolver_transferencia.desfecho)
   where h.id = v_h.id;

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), 'transferencia_resolvida', 'handoff', v_h.id::text,
          pg_catalog.jsonb_build_object('status', v_h.status),
          pg_catalog.jsonb_build_object('status', 'resolvido', 'desfecho', resolver_transferencia.desfecho),
          privado.origem_atual(), privado.ip_requisicao());

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'handoff_id', v_h.id,
    'desfecho', resolver_transferencia.desfecho,
    'conversa_id', v_h.conversa_id);
end;
$$;
comment on function api.resolver_transferencia(uuid, text) is '"Marcar como resolvida" (P27, PRD 11.4 e 11.7 [v4.2]): comercial, coordenação ou diretoria, AAL pela regra do perfil. Transferência aberta ou assumida vira resolvida, com o desfecho (formulario_enviado, sessao_marcada, condicao_negociada, sem_retorno) em handoff.dados.desfecho e log transferencia_resolvida. Nunca devolve a conversa à Isadora: não toca na pausa nem no humano_comercial (só api.retomar_agente).';


-- =============================================================================
-- 8. api.reenviar_notificacao_handoff(handoff_id)
--
-- "Reenviar aviso" da faixa vermelha (PRD 19.3 nó 18, 22.2): grava uma
-- notificação para o papel do destino (comercial, ou coordenação para a
-- coordenação clínica e a operação, como agente.registrar_notificacao_handoff),
-- com a prioridade da transferência, o link da ficha
-- (parametro.link_ficha_modelo) e os canais app, whatsapp_interno e email,
-- e volta notificacao_ok para nulo ("aguardando"). Sem texto da família nem
-- resumo no corpo. Transferência já resolvida ou cancelada: recusa. Aviso
-- que já saiu (notificacao_ok verdadeiro): nada muda.
-- =============================================================================

create function api.reenviar_notificacao_handoff(handoff_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_h      public.handoff;
  v_papel  public.papel_usuario;
  v_link   text;
  v_notif  uuid;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select h.* into v_h from public.handoff h where h.id = reenviar_notificacao_handoff.handoff_id for update;
  if not found then
    raise exception 'api.reenviar_notificacao_handoff: transferência % não existe', reenviar_notificacao_handoff.handoff_id
      using errcode = 'P0002';
  end if;
  if v_h.status not in ('aberto', 'assumido') then
    raise exception 'api.reenviar_notificacao_handoff: a transferência já está %', v_h.status
      using errcode = '22023';
  end if;
  if v_h.notificacao_ok then
    return pg_catalog.jsonb_build_object('ok', true, 'handoff_id', v_h.id, 'alterado', false);
  end if;

  v_papel := case v_h.destino when 'comercial' then 'comercial'::public.papel_usuario
                               else 'coordenacao'::public.papel_usuario end;
  v_link := case when v_h.familia_id is not null
                 then nullif(pg_catalog.replace(coalesce(privado.agente_parametro('link_ficha_modelo') #>> '{}', ''),
                                                '{familia_id}', v_h.familia_id::text), '') end;

  insert into public.notificacao (papel, prioridade, titulo, corpo, link, canais, criado_por)
  values (v_papel, v_h.prioridade, 'handoff_aviso_reenviado', null, v_link,
          array['app', 'whatsapp_interno', 'email'], auth.uid())
  returning id into v_notif;

  update public.handoff h
     set notificacao_ok = null,
         notificado_em = pg_catalog.now()
   where h.id = v_h.id;

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), 'handoff_aviso_reenviado', 'handoff', v_h.id::text,
          pg_catalog.jsonb_build_object('notificacao_ok', v_h.notificacao_ok),
          pg_catalog.jsonb_build_object('notificacao_ok', null, 'notificacao_id', v_notif),
          privado.origem_atual(), privado.ip_requisicao());

  return pg_catalog.jsonb_build_object('ok', true, 'handoff_id', v_h.id, 'alterado', true, 'notificacao_id', v_notif);
end;
$$;
comment on function api.reenviar_notificacao_handoff(uuid) is '"Reenviar aviso" (P27, PRD 19.3 nó 18): comercial, coordenação ou diretoria, AAL pela regra do perfil. Transferência aberta ou assumida: notificação ao papel do destino (app, whatsapp_interno, email), sem texto da família, e notificacao_ok nulo (aguardando). Log handoff_aviso_reenviado. Aviso já confirmado: nada muda.';


-- =============================================================================
-- 9. Base de conhecimento (P27 item 4, PRD 6.8, 13)
--
-- Item no formato ItemBaseConhecimento da tela (src/modules/agente/tipos.ts):
-- id, tipo, titulo, texto, fonte, status, aprovadoPor (nome do perfil),
-- aprovadoEm, atualizadoEm. A auditoria das escritas vem do gatilho
-- privado.auditar em agente.base_conhecimento.
-- =============================================================================

create function privado.item_base_conhecimento(id uuid) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select pg_catalog.jsonb_build_object(
           'id', b.id,
           'tipo', b.tipo,
           'titulo', b.titulo,
           'texto', b.texto,
           'fonte', b.fonte,
           'status', b.status,
           'aprovadoPor', p.nome,
           'aprovadoEm', b.aprovado_em,
           'atualizadoEm', b.atualizado_em)
  from agente.base_conhecimento b
  left join public.perfil p on p.id = b.aprovado_por
  where b.id = item_base_conhecimento.id
$$;
comment on function privado.item_base_conhecimento(uuid) is 'Um item de agente.base_conhecimento no formato da tela do P27 (aprovadoPor = nome do perfil). Usada pelas funções api.base_conhecimento_*. Sem grant.';

create function api.base_conhecimento_listar() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  return coalesce((
    select pg_catalog.jsonb_agg(privado.item_base_conhecimento(b.id) order by b.atualizado_em desc, b.id)
    from agente.base_conhecimento b), '[]'::jsonb);
end;
$$;
comment on function api.base_conhecimento_listar() is 'Base de conhecimento da Isadora (P27 item 4, PRD 13): comercial, coordenação e diretoria, AAL pela regra do perfil. Lista de itens (id, tipo, titulo, texto, fonte, status, aprovadoPor, aprovadoEm, atualizadoEm), mais recentes primeiro.';

create function api.base_conhecimento_salvar(id uuid, tipo text, titulo text, texto text, fonte text default null)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_tipo   public.tipo_conteudo;
  v_titulo text := nullif(pg_catalog.btrim(base_conhecimento_salvar.titulo), '');
  v_texto  text := nullif(pg_catalog.btrim(base_conhecimento_salvar.texto), '');
  v_fonte  text := nullif(pg_catalog.btrim(base_conhecimento_salvar.fonte), '');
  v_id     uuid;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  begin
    v_tipo := base_conhecimento_salvar.tipo::public.tipo_conteudo;
  exception
    when invalid_text_representation then
      v_tipo := null;
  end;
  if v_tipo is null then
    raise exception 'api.base_conhecimento_salvar: tipo inválido'
      using errcode = '22023';
  end if;
  if v_titulo is null or v_texto is null then
    raise exception 'api.base_conhecimento_salvar: título e texto são obrigatórios'
      using errcode = '22023';
  end if;

  if base_conhecimento_salvar.id is null then
    insert into agente.base_conhecimento (tipo, titulo, texto, fonte, status)
    values (v_tipo, v_titulo, v_texto, v_fonte, 'rascunho')
    returning id into v_id;
  else
    -- toda edição volta para rascunho: texto sem aprovação nunca é indexado
    update agente.base_conhecimento b
       set tipo = v_tipo,
           titulo = v_titulo,
           texto = v_texto,
           fonte = v_fonte,
           status = 'rascunho',
           aprovado_por = null,
           aprovado_em = null
     where b.id = base_conhecimento_salvar.id
    returning b.id into v_id;
    if v_id is null then
      raise exception 'api.base_conhecimento_salvar: item % não existe', base_conhecimento_salvar.id
        using errcode = 'P0002';
    end if;
  end if;

  return privado.item_base_conhecimento(v_id);
end;
$$;
comment on function api.base_conhecimento_salvar(uuid, text, text, text, text) is 'Cadastro e edição de item da base de conhecimento (P27 item 4, PRD 13): comercial, coordenação e diretoria, AAL pela regra do perfil. id nulo cria em rascunho; com id, edita e volta para rascunho, limpando a aprovação (texto sem aprovação nunca é indexado). texto até 1500 caracteres (restrição da tabela). Devolve o item no formato da tela.';

create function api.base_conhecimento_aprovar(id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_b agente.base_conhecimento;
begin
  -- só diretoria (o Leonardo aprova pelo papel de diretoria), sempre em AAL2
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select b.* into v_b from agente.base_conhecimento b where b.id = base_conhecimento_aprovar.id for update;
  if not found then
    raise exception 'api.base_conhecimento_aprovar: item % não existe', base_conhecimento_aprovar.id
      using errcode = 'P0002';
  end if;

  if v_b.status is distinct from 'aprovado' then
    update agente.base_conhecimento b
       set status = 'aprovado',
           aprovado_por = auth.uid(),
           aprovado_em = pg_catalog.now()
     where b.id = v_b.id;
  end if;

  return privado.item_base_conhecimento(v_b.id);
end;
$$;
comment on function api.base_conhecimento_aprovar(uuid) is 'Aprovação de item da base de conhecimento (P27 item 4, PRD 13 "aprovação pelo Leonardo"): só diretoria, AAL2. Grava status aprovado, aprovado_por e aprovado_em (item já aprovado não muda). A próxima ingestão (fluxo 1) indexa só aprovados.';

-- Última execução da ingestão do fluxo 1 (PRD 19.2 nós 10 e 11), no formato
-- UltimaIngestao da tela: {em, ok, itens, erro}; nulo antes da primeira.
-- O erro é o texto técnico que o fluxo 1 grava (nada de família: a base só
-- tem conteúdo institucional aprovado).
create function api.ultima_ingestao_base() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  return (
    select pg_catalog.jsonb_build_object(
             'em', i.criado_em,
             'ok', i.status = 'ok',
             'itens', i.documentos,
             'erro', i.erro)
    from agente.ingestao_execucao i
    order by i.criado_em desc, i.id desc
    limit 1);
end;
$$;
comment on function api.ultima_ingestao_base() is 'Última ingestão da base de conhecimento (P27 item 4, PRD 19.2): comercial, coordenação e diretoria, AAL pela regra do perfil. {em, ok, itens, erro} da execução mais recente de agente.ingestao_execucao; nulo antes da primeira.';


-- =============================================================================
-- 10. api.metricas_agente(desde, ate) (PRD 11.12)
--
-- Só agregados, do período [desde, ate] em dias de Brasília (criação da
-- conversa ou da oportunidade). Percentuais com uma casa; nulo quando a
-- base do indicador é zero.
--   tempoPrimeiraRespostaMinutos      média, por conversa de lead, da primeira
--                                     entrada da família até a primeira saída
--                                     depois dela
--   leadsQueRespondemPct              conversas de lead com saída em que a
--                                     família escreveu depois da primeira saída
--   qualificadosComValorEPdfPct       oportunidades qualificadas (ou já no P2)
--                                     com pdf_enviado_em
--   conversasComEdilaineRegistradasPct as mesmas, com sessão de venda com data
--   followupAposPdfPct                oportunidades com PDF em que a família
--                                     ficou em silêncio por
--                                     agente_followup_horas depois dele: com
--                                     saída depois desse silêncio ou tarefa
--                                     followup_comercial concluída depois do
--                                     PDF (sem o parâmetro: nulo)
--   conversaoLeadsPct                 oportunidades do período em ganho ou
--                                     adiante no P2 (fora perdido, cancelado,
--                                     distrato)
--   condicoesForaDaTabela             oportunidades com desconto sem
--                                     desconto_aprovado_por
--   leadsTotal                        conversas de lead do período
-- "Conversa de lead" = classificação lead, cliente ou nao_classificado.
-- =============================================================================

create function api.metricas_agente(desde date, ate date) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_horas     numeric;
  v_tempo     numeric;
  v_leads     integer;
  v_resp_base integer;
  v_resp      integer;
  v_qual      integer;
  v_qual_pdf  integer;
  v_qual_ses  integer;
  v_fu_base   integer;
  v_fu        integer;
  v_oport     integer;
  v_ganhos    integer;
  v_fora      integer;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);

  if metricas_agente.desde is null or metricas_agente.ate is null or metricas_agente.desde > metricas_agente.ate then
    raise exception 'api.metricas_agente: informe desde e ate, com desde até ate'
      using errcode = '22023';
  end if;

  v_horas := privado.agente_parametro_numero('agente_followup_horas');

  -- conversas de lead do período
  with conv as (
    select c.id
    from public.conversa c
    where c.classificacao in ('lead', 'cliente', 'nao_classificado')
      and (c.criado_em at time zone 'America/Sao_Paulo')::date between metricas_agente.desde and metricas_agente.ate
  ),
  marcos as (
    select cv.id,
           (select min(m.enviada_em) from public.mensagem m where m.conversa_id = cv.id and m.direcao = 'entrada') as prim_entrada,
           (select min(m.enviada_em) from public.mensagem m where m.conversa_id = cv.id and m.direcao = 'saida') as prim_saida
    from conv cv
  ),
  respostas as (
    select mc.id,
           mc.prim_saida,
           (select min(m.enviada_em) from public.mensagem m
             where m.conversa_id = mc.id and m.direcao = 'saida' and m.enviada_em > mc.prim_entrada) as saida_apos_entrada,
           exists (select 1 from public.mensagem m
                    where m.conversa_id = mc.id and m.direcao = 'entrada' and m.enviada_em > mc.prim_saida) as respondeu
    from marcos mc
  )
  select (select count(*) from conv),
         (select avg(extract(epoch from (r.saida_apos_entrada - mc.prim_entrada)) / 60)
            from respostas r join marcos mc on mc.id = r.id
           where r.saida_apos_entrada is not null),
         (select count(*) from respostas r where r.prim_saida is not null),
         (select count(*) from respostas r where r.prim_saida is not null and r.respondeu)
    into v_leads, v_tempo, v_resp_base, v_resp;

  -- oportunidades do período
  with op as (
    select o.*
    from public.oportunidade o
    where (o.criado_em at time zone 'America/Sao_Paulo')::date between metricas_agente.desde and metricas_agente.ate
  ),
  qualificadas as (
    select op.* from op
    where op.pipeline = 2 or op.estagio_p1 in ('qualificado', 'sessao_venda_agendada', 'sessao_venda_realizada')
  ),
  com_pdf as (
    select op.id, op.familia_id, op.pdf_enviado_em
    from op
    where op.pdf_enviado_em is not null
      and v_horas is not null
      and op.pdf_enviado_em + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision) <= pg_catalog.now()
      and not exists (
        select 1 from public.mensagem m join public.conversa c on c.id = m.conversa_id
         where c.familia_id = op.familia_id and m.direcao = 'entrada'
           and m.enviada_em > op.pdf_enviado_em
           and m.enviada_em <= op.pdf_enviado_em + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision))
  )
  select (select count(*) from qualificadas),
         (select count(*) from qualificadas q where q.pdf_enviado_em is not null),
         (select count(*) from qualificadas q
           where exists (select 1 from public.sessao_venda s
                          where s.familia_id = q.familia_id
                            and coalesce(s.realizada_em, s.agendada_para) is not null)),
         (select count(*) from com_pdf),
         (select count(*) from com_pdf cp
           where exists (select 1 from public.mensagem m join public.conversa c on c.id = m.conversa_id
                          where c.familia_id = cp.familia_id and m.direcao = 'saida'
                            and m.enviada_em >= cp.pdf_enviado_em + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision))
              or exists (select 1 from public.tarefa t
                          where t.familia_id = cp.familia_id and t.tipo = 'followup_comercial'
                            and t.status = 'concluida' and t.concluida_em > cp.pdf_enviado_em)),
         (select count(*) from op),
         (select count(*) from op
           where op.pipeline = 2
             and op.estagio_p2 not in ('proposta_enviada', 'em_negociacao', 'perdido', 'cancelado', 'distrato')),
         (select count(*) from op where op.desconto_pct > 0 and op.desconto_aprovado_por is null)
    into v_qual, v_qual_pdf, v_qual_ses, v_fu_base, v_fu, v_oport, v_ganhos, v_fora;

  return pg_catalog.jsonb_build_object(
    'periodoDesde', metricas_agente.desde,
    'periodoAte', metricas_agente.ate,
    'tempoPrimeiraRespostaMinutos', pg_catalog.round(v_tempo, 1),
    'leadsQueRespondemPct', case when v_resp_base = 0 then null else pg_catalog.round(v_resp * 100.0 / v_resp_base, 1) end,
    'qualificadosComValorEPdfPct', case when v_qual = 0 then null else pg_catalog.round(v_qual_pdf * 100.0 / v_qual, 1) end,
    'conversasComEdilaineRegistradasPct', case when v_qual = 0 then null else pg_catalog.round(v_qual_ses * 100.0 / v_qual, 1) end,
    'followupAposPdfPct', case when v_horas is null or v_fu_base = 0 then null else pg_catalog.round(v_fu * 100.0 / v_fu_base, 1) end,
    'conversaoLeadsPct', case when v_oport = 0 then null else pg_catalog.round(v_ganhos * 100.0 / v_oport, 1) end,
    'condicoesForaDaTabela', v_fora,
    'leadsTotal', v_leads);
end;
$$;
comment on function api.metricas_agente(date, date) is 'Métricas do agente (P27 item 5, PRD 11.12): comercial, coordenação e diretoria, AAL pela regra do perfil. Só agregados do período (dias de Brasília): tempo da primeira resposta, leads que respondem, qualificados com PDF, conversas com a Edilaine registradas, follow-up após o PDF (silêncio de parametro.agente_followup_horas), conversão e condições sem aprovação. Chaves no formato MetricasAgente da tela.';


-- =============================================================================
-- 11. Execute: só authenticated nas funções api; nada em privado
--     (ADR 0002 seção 6, conferido pelos testes 007 e 017)
-- =============================================================================

revoke execute on function privado.item_base_conhecimento(uuid) from public, anon, authenticated, service_role;

revoke execute on function api.buscar_duplicatas_pipeline()                                                        from public, anon, service_role;
revoke execute on function api.mesclar_familias(uuid, uuid, uuid)                                                  from public, anon, service_role;
revoke execute on function api.vincular_nova_gestacao(uuid, uuid)                                                  from public, anon, service_role;
revoke execute on function api.pode_enviar_mensagem(uuid, public.categoria_automacao, public.modo_mensageria)      from public, anon, service_role;
revoke execute on function api.registrar_envio_tarefa(uuid, text)                                                  from public, anon, service_role;
revoke execute on function api.pausar_conversa(uuid, text)                                                         from public, anon, service_role;
revoke execute on function api.retomar_pausa_conversa(uuid)                                                        from public, anon, service_role;
revoke execute on function api.resolver_transferencia(uuid, text)                                                  from public, anon, service_role;
revoke execute on function api.reenviar_notificacao_handoff(uuid)                                                  from public, anon, service_role;
revoke execute on function api.base_conhecimento_listar()                                                          from public, anon, service_role;
revoke execute on function api.base_conhecimento_salvar(uuid, text, text, text, text)                              from public, anon, service_role;
revoke execute on function api.base_conhecimento_aprovar(uuid)                                                     from public, anon, service_role;
revoke execute on function api.ultima_ingestao_base()                                                              from public, anon, service_role;
revoke execute on function api.metricas_agente(date, date)                                                         from public, anon, service_role;

grant execute on function api.buscar_duplicatas_pipeline()                                                   to authenticated;
grant execute on function api.mesclar_familias(uuid, uuid, uuid)                                             to authenticated;
grant execute on function api.vincular_nova_gestacao(uuid, uuid)                                             to authenticated;
grant execute on function api.pode_enviar_mensagem(uuid, public.categoria_automacao, public.modo_mensageria) to authenticated;
grant execute on function api.registrar_envio_tarefa(uuid, text)                                             to authenticated;
grant execute on function api.pausar_conversa(uuid, text)                                                    to authenticated;
grant execute on function api.retomar_pausa_conversa(uuid)                                                   to authenticated;
grant execute on function api.resolver_transferencia(uuid, text)                                             to authenticated;
grant execute on function api.reenviar_notificacao_handoff(uuid)                                             to authenticated;
grant execute on function api.base_conhecimento_listar()                                                     to authenticated;
grant execute on function api.base_conhecimento_salvar(uuid, text, text, text, text)                         to authenticated;
grant execute on function api.base_conhecimento_aprovar(uuid)                                                to authenticated;
grant execute on function api.ultima_ingestao_base()                                                         to authenticated;
grant execute on function api.metricas_agente(date, date)                                                    to authenticated;


-- =============================================================================
-- 12. Trava (falha a migration se quebrar): toda função de api é security
--     definer com search_path vazio e nenhuma é executável por PUBLIC, anon
--     ou service_role; privado continua com as quatro do PRD 11.10 para
--     authenticated.
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
