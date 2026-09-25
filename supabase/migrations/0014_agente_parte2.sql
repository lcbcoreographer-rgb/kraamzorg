-- =============================================================================
-- 0014_agente_parte2.sql
--
-- P22 (PROMPTS.md v2) · PRD 11.4, 11.7 [v4.2], 19.2, 19.3 [v4.2], 19.4
-- (entrada B), 21.3 [v4.2], 23.3, 23.4, 6.8 e Apêndice A [v4.2]
--
-- Fronteira do agente, parte 2: transferência para a equipe, não lead,
-- follow-up, base de conhecimento do fluxo 1, e as duas funções do app que
-- fecham o ciclo do agente (Devolver à Isadora e eliminação a pedido do
-- titular).
--
-- O que esta migration faz:
--   1. Auxiliares: horas úteis do expediente comercial, SLA pela matriz,
--      resumo interno (23.3) e nome da enfermeira designada.
--   2. agente.registrar_handoff (sete parâmetros, Apêndice A [v4.2]):
--      matriz de parametro.handoff_matriz, família mínima, freio (perda para
--      bloqueio_total, saúde para atencao), pausa ou humano_comercial,
--      deduplicação só de motivos comerciais, reaproveitamento com
--      "ATUALIZAÇÃO" para saúde, perda e estado sensível, leitura de
--      dados._fluxo2 e dados._fluxo3, textos do grupo e da instrução.
--   3. agente.registrar_notificacao_handoff, agente.marcar_nao_lead.
--   4. agente.followups_devidos (reserva a execução) e
--      agente.registrar_followup; privado.agendar_followup_d1 (0012) passa
--      a deduplicar por qualquer status (ver seção 5).
--   5. agente.base_para_indexar, agente.promover_lote,
--      agente.descartar_lote, agente.registrar_ingestao (fluxo 1, 19.2).
--   6. privado.retomar_agente e api.retomar_agente (botão "Devolver à
--      Isadora", P27).
--   7. privado.eliminar_titular e api.eliminar_titular (PRD 21.3 [v4.2]),
--      com a exceção do gatilho de evento_familia liberada só por
--      app.eliminacao, dentro da própria função.
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura, registradas no
-- relatório da sessão e no ADR 0003):
--   * Texto ao grupo interno (destinatário equipe) sai mesmo em rascunho,
--     marcado mensagem_grupo_aprovada = false. O 6.8 manda devolver só texto
--     aprovado, mas o 11.4 e o 8.2 mandam que alerta de saúde e perda
--     sempre cheguem à coordenação; um aviso interno em rascunho não chega à
--     família, e silenciar o grupo por falta de aprovação seria o erro caro.
--     Texto para a família e instrução ao agente: só aprovados, sempre.
--   * "Transferência aberta" = status aberto ou assumido (assumido ainda não
--     foi resolvido).
--   * Janela de deduplicação e de reaproveitamento em parametro
--     (handoff_dedup_minutos, 10 no seed, PRD 11.4 e 19.3). Sem o parâmetro,
--     nada é deduplicado: todo pedido gera aviso (falha para o lado de
--     avisar).
--   * Família mínima só para conversa de lead, cliente ou ainda não
--     classificada, e sempre para saúde, perda, estado sensível e áudio não
--     transcrito (o freio precisa de onde ficar). Candidata, fornecedor e
--     consultório pedindo transferência comercial não viram família.
--   * humano_comercial segue o texto do PRD 11.4 e 11.7 ao pé da letra:
--     reuniao, contratar e condicao_comercial sempre; qualquer outra
--     transferência ao comercial com a oportunidade em qualificado ou
--     adiante também (inclusive midia_recebida e validacao_resposta)
--     [confirmar: Leonardo, lista exata de motivos].
--   * eliminar_titular também apaga as famílias mescladas na eliminada,
--     esvazia o texto livre da qualificação comercial e das opções da
--     sessão de venda, marca nao_contatar e cancela as execuções agendadas.
-- =============================================================================


-- =============================================================================
-- 1. Auxiliares
-- =============================================================================

-- --- 1.1 Horas úteis (PRD 11.4: "SLA em horas úteis usa o expediente do
--     suporte comercial") ----------------------------------------------------
-- parametro.expediente_comercial = {"dias":["seg",...], "inicio":"09:00",
-- "fim":"18:00", "fuso":"America/Sao_Paulo"}. Sem parâmetro válido, conta
-- em horas corridas (prazo mais curto, falha para o lado de responder cedo).
create function privado.somar_horas_uteis(inicio timestamptz, horas numeric) returns timestamptz
  language plpgsql
  stable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_exp      jsonb := privado.agente_parametro('expediente_comercial');
  v_fuso     text;
  v_ini      time;
  v_fim      time;
  v_dias     text[];
  v_codigos  constant text[] := array['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  v_local    timestamp;
  v_resto    interval := pg_catalog.make_interval(secs => (coalesce(somar_horas_uteis.horas, 0) * 3600)::double precision);
  v_abre     timestamp;
  v_fecha    timestamp;
  v_voltas   integer := 0;
begin
  begin
    v_fuso := coalesce(v_exp ->> 'fuso', 'America/Sao_Paulo');
    v_ini := (v_exp ->> 'inicio')::time;
    v_fim := (v_exp ->> 'fim')::time;
    select pg_catalog.array_agg(d) into v_dias from pg_catalog.jsonb_array_elements_text(v_exp -> 'dias') d;
  exception
    when others then
      v_ini := null;
  end;
  if v_ini is null or v_fim is null or v_ini >= v_fim or v_dias is null then
    return somar_horas_uteis.inicio + v_resto;
  end if;

  v_local := somar_horas_uteis.inicio at time zone v_fuso;
  loop
    v_voltas := v_voltas + 1;
    if v_voltas > 400 then
      return somar_horas_uteis.inicio + v_resto;   -- expediente sem nenhum dia útil válido
    end if;
    if v_codigos[pg_catalog.date_part('dow', v_local)::integer + 1] = any (v_dias) then
      v_abre := v_local::date + v_ini;
      v_fecha := v_local::date + v_fim;
      if v_local < v_abre then
        v_local := v_abre;
      end if;
      if v_local < v_fecha then
        if v_local + v_resto <= v_fecha then
          return (v_local + v_resto) at time zone v_fuso;
        end if;
        v_resto := v_resto - (v_fecha - v_local);
      end if;
    end if;
    v_local := v_local::date + 1;
  end loop;
end;
$$;
comment on function privado.somar_horas_uteis(timestamptz, numeric) is 'Soma horas úteis pelo parametro.expediente_comercial (dias, início, fim, fuso), PRD 11.4. Parâmetro ausente ou inválido: horas corridas. Sem grant.';

-- --- 1.2 SLA de uma entrada da matriz ---------------------------------------
create function privado.agente_sla(entrada jsonb, prioridade public.prioridade, inicio timestamptz) returns timestamptz
  language plpgsql
  stable
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  if agente_sla.prioridade = 'maxima' or agente_sla.entrada ->> 'sla' = 'imediato' then
    return agente_sla.inicio;   -- prioridade máxima é sempre imediata, a qualquer hora (11.4)
  elsif pg_catalog.jsonb_typeof(agente_sla.entrada -> 'sla_horas_uteis') = 'number' then
    return privado.somar_horas_uteis(agente_sla.inicio, (agente_sla.entrada ->> 'sla_horas_uteis')::numeric);
  elsif pg_catalog.jsonb_typeof(agente_sla.entrada -> 'sla_horas') = 'number' then
    return agente_sla.inicio + pg_catalog.make_interval(secs => ((agente_sla.entrada ->> 'sla_horas')::numeric * 3600)::double precision);
  elsif pg_catalog.jsonb_typeof(agente_sla.entrada -> 'sla_horas_corridas') = 'number' then
    return agente_sla.inicio + pg_catalog.make_interval(secs => ((agente_sla.entrada ->> 'sla_horas_corridas')::numeric * 3600)::double precision);
  elsif pg_catalog.jsonb_typeof(agente_sla.entrada -> 'sla_dias') = 'number' then
    return agente_sla.inicio + pg_catalog.make_interval(days => (agente_sla.entrada ->> 'sla_dias')::integer);
  end if;
  return null;
end;
$$;
comment on function privado.agente_sla(jsonb, public.prioridade, timestamptz) is 'Prazo de um handoff pela entrada de parametro.handoff_matriz (sla imediato, sla_horas_uteis, sla_horas, sla_horas_corridas, sla_dias); prioridade máxima é sempre imediata (PRD 11.4). Sem grant.';

-- --- 1.3 Resumo interno (PRD 23.3) -------------------------------------------------
-- "Nome · Para quem · Semanas · DPP / Cidade e bairro · Área confirmada /
-- Primeiro bebê · Gemelar · Rede de apoio / Principal preocupação / PDF
-- enviado · Conversa com a Edilaine / Plano de interesse · Pagamento
-- preferido / Objeções ditas · Origem / Próximo passo". A barra vira quebra
-- de linha na mensagem do grupo. Só dado comercial.
create function privado.agente_resumo_interno(conversa_id uuid, resumo text, dados jsonb) returns text
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
      'conversa com a Edilaine: ' || case when v_o.sessao_interesse_em is not null then 'interesse registrado' else 'não' end),
    pg_catalog.concat_ws(' · ',
      'plano: ' || coalesce(v_plano, v_ni),
      'pagamento: ' || coalesce(privado.campo_livre(v_o.pagamento_preferido), v_ni)),
    pg_catalog.concat_ws(' · ',
      'objeções: ' || coalesce(privado.campo_livre(v_obj), v_ni),
      'origem: ' || coalesce(v_f.origem::text, v_ni)),
    'próximo passo: ' || coalesce(privado.campo_livre(agente_resumo_interno.resumo), v_ni));
end;
$$;
comment on function privado.agente_resumo_interno(uuid, text, jsonb) is 'Resumo interno padrão do aviso ao grupo (PRD 23.3), montado pelo banco só com dado comercial; " / " vira quebra de linha. Sem grant.';

-- --- 1.4 Enfermeira titular aceita (grupo_bebe_nasceu, 23.3) ------------------
create function privado.agente_enfermeira(familia_id uuid) returns text
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select pr.nome
  from public.acompanhamento a
  join public.designacao d on d.acompanhamento_id = a.id and d.status = 'aceita' and d.papel = 'titular'
  join public.profissional pr on pr.id = d.profissional_id
  where a.familia_id = agente_enfermeira.familia_id
  order by a.criado_em desc, d.criado_em desc
  limit 1
$$;
comment on function privado.agente_enfermeira(uuid) is 'Nome da profissional titular com designação aceita (só o nome, para o aviso ao grupo, PRD 23.3). Sem grant.';


-- =============================================================================
-- 2. agente.registrar_handoff (Apêndice A [v4.2], PRD 11.4, 19.3 nó 12)
--
-- Parâmetros: conversa_id, motivo, resumo, solicitacao, dados, origem,
-- texto_familia. Lê de dados:
--   _fluxo2.prioridade_minima  só sobe a prioridade da matriz
--   _fluxo2.manter_opcoes      mantém dados.opcoes no texto do grupo
--   _fluxo2.mensagem_enviada   texto que já saiu à família ({mensagem_enviada})
--   _fluxo3.acrescentar_ao_aberto  humano_comercial: o texto novo vai para a
--                              transferência aberta, sem novo aviso
--   perda_temporalidade        "anterior": observação do grupo_perda (K-21)
--   opcoes, objecoes           texto do grupo
-- Devolve {ok, handoff_id, duplicado, atualizacao, mensagem_grupo,
-- mensagem_grupo_aprovada, grupo_jid, plantao, instrucao_agente,
-- instrucao_chave, pausa_horas, humano_comercial, destino, prioridade,
-- sla_vence_em, familia_id, freio, avisos}.
-- =============================================================================

create function agente.registrar_handoff(
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
  v_qualificado boolean := false;
  v_humano_comercial boolean := false;
  v_encerrado_em timestamptz;
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
                              'parceiro_medico', 'duvida_sem_resposta', 'outro');

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
    return pg_catalog.jsonb_build_object(
      'ok', true, 'handoff_id', v_h.id, 'duplicado', true, 'acrescentado', v_h.id is not null,
      'atualizacao', false, 'mensagem_grupo', null, 'grupo_jid', null, 'plantao', '[]'::jsonb,
      'instrucao_agente', null, 'instrucao_chave', null, 'pausa_horas', null,
      'humano_comercial', v_c.agente_encerrado_em is not null);
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

  -- 6. pausa com prazo, ou humano_comercial (11.7 [v4.2], D-17)
  if v_fam is not null then
    v_o := privado.agente_oportunidade_aberta(v_fam);
    v_qualificado := v_o.id is not null
                     and (v_o.estagio_p2 is not null
                          or v_o.estagio_p1 in ('qualificado', 'sessao_venda_agendada', 'sessao_venda_realizada'));
  end if;
  if not v_alerta
     and (v_motivo in ('reuniao', 'contratar', 'condicao_comercial') or (v_destino = 'comercial' and v_qualificado)) then
    v_humano_comercial := true;
    if v_c.agente_encerrado_em is null then
      v_encerrado_em := pg_catalog.clock_timestamp();
      update public.conversa c
         set agente_encerrado_em = v_encerrado_em,
             agente_encerrado_motivo = case when v_motivo in ('reuniao', 'contratar', 'condicao_comercial')
                                            then v_motivo::text else 'qualificado' end
       where c.id = v_c.id;
    end if;
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
comment on function agente.registrar_handoff(uuid, text, text, text, jsonb, text, text) is 'Apêndice A [v4.2] e PRD 19.3 nó 12: matriz de parametro.handoff_matriz (destino, prioridade, SLA em horas úteis; prioridade_minima de dados._fluxo2 só sobe), família mínima, freio (perda bloqueio_total, saúde atencao; só sobe), pausa com prazo ou humano_comercial (reuniao, contratar, condicao_comercial, ou comercial com oportunidade qualificada), deduplicação só de motivos comerciais (mesma conversa, motivo e hash da solicitação na janela de parametro.handoff_dedup_minutos); saúde, perda e estado sensível reaproveitam a transferência aberta e sempre reavisam com o prefixo de ATUALIZAÇÃO. Devolve handoff_id, mensagem_grupo, grupo_jid, plantao (só máxima), instrucao_agente e pausa_horas.';
grant execute on function agente.registrar_handoff(uuid, text, text, text, jsonb, text, text) to n8n_agente;


-- =============================================================================
-- 3. Notificação, não lead
-- =============================================================================

-- --- 3.1 agente.registrar_notificacao_handoff --------------------------------------
-- Falha deixa a faixa vermelha no CRM (handoff.notificacao_ok = false) e
-- aciona o e-mail pela central de notificação (canal email, o app envia).
create function agente.registrar_notificacao_handoff(handoff_id uuid, ok boolean, erro text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_h     public.handoff;
  v_papel public.papel_usuario;
  v_link  text;
begin
  perform privado.agente_contexto();
  select h.* into v_h from public.handoff h where h.id = registrar_notificacao_handoff.handoff_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'handoff_nao_encontrado');
  end if;

  update public.handoff h
     set notificado_em = pg_catalog.now(),
         notificacao_ok = coalesce(registrar_notificacao_handoff.ok, false)
   where h.id = v_h.id;

  if not coalesce(registrar_notificacao_handoff.ok, false) then
    v_papel := case v_h.destino when 'comercial' then 'comercial'::public.papel_usuario else 'coordenacao'::public.papel_usuario end;
    v_link := case when v_h.familia_id is not null
                   then nullif(pg_catalog.replace(coalesce(privado.agente_parametro('link_ficha_modelo') #>> '{}', ''),
                                                  '{familia_id}', v_h.familia_id::text), '') end;
    insert into public.notificacao (papel, prioridade, titulo, corpo, link, canais)
    values (v_papel, greatest(v_h.prioridade, 'alta'::public.prioridade), 'handoff_notificacao_falhou',
            pg_catalog.left(coalesce(registrar_notificacao_handoff.erro, ''), 500), v_link, array['app', 'email']);
    if v_h.prioridade = 'maxima' then
      insert into public.notificacao (papel, prioridade, titulo, corpo, link, canais)
      values ('diretoria', 'maxima', 'handoff_notificacao_falhou',
              pg_catalog.left(coalesce(registrar_notificacao_handoff.erro, ''), 500), v_link, array['app', 'email']);
    end if;
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'handoff_id', v_h.id, 'notificacao_ok', coalesce(registrar_notificacao_handoff.ok, false));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_notificacao_handoff(uuid, boolean, text) is 'Apêndice A: marca notificado_em e notificacao_ok; falha gera notificação alta (máxima também à diretoria) com canal email, que o app envia (faixa vermelha no CRM).';
grant execute on function agente.registrar_notificacao_handoff(uuid, boolean, text) to n8n_agente;

-- --- 3.2 agente.marcar_nao_lead ------------------------------------------------------
-- Classifica a conversa (candidata, fornecedor, consultorio, parceiro_medico,
-- outro) e devolve o texto de encaminhamento aprovado e a instrução
-- instrucao_nao_lead já com ele. Nunca rebaixa uma conversa de cliente nem
-- uma conversa que já tem família com DPP (19.3: perder um lead é o erro
-- caro).
create function agente.marcar_nao_lead(conversa_id uuid, tipo text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c      public.conversa;
  v_tipo   public.classificacao_contato;
  v_texto  text;
  v_instr  text;
begin
  perform privado.agente_contexto();
  if marcar_nao_lead.tipo is null
     or marcar_nao_lead.tipo not in ('candidata', 'fornecedor', 'consultorio', 'parceiro_medico', 'outro') then
    raise exception 'marcar_nao_lead: tipo deve ser candidata, fornecedor, consultorio, parceiro_medico ou outro' using errcode = '22023';
  end if;
  v_tipo := marcar_nao_lead.tipo::public.classificacao_contato;

  select c.* into v_c from public.conversa c where c.id = marcar_nao_lead.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if v_c.classificacao = 'cliente'
     or exists (select 1 from public.familia f
                where f.id = privado.familia_vigente(v_c.familia_id) and (f.dpp is not null or f.data_nascimento is not null)) then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_com_dados_de_lead');
  end if;

  update public.conversa c set classificacao = v_tipo where c.id = v_c.id;
  update public.automacao_execucao e
     set status = 'cancelada', motivo_aborto = 'nao_lead'
   where e.automacao_id = 'followup_d1' and e.status = 'agendada'
     and e.payload ->> 'conversa_id' = v_c.id::text;

  if marcar_nao_lead.tipo in ('candidata', 'fornecedor', 'consultorio') then
    v_texto := privado.agente_texto('nao_lead_' || marcar_nao_lead.tipo, true);
  end if;
  if v_texto is not null then
    v_instr := privado.aplicar_texto(privado.agente_texto('instrucao_nao_lead', true), null,
                                     pg_catalog.jsonb_build_object('texto_encaminhamento', v_texto));
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'classificacao', v_tipo,
    'texto_encaminhamento', v_texto,
    'instrucao_agente', v_instr);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.marcar_nao_lead(uuid, text) is 'Apêndice A [v4.2]: classifica a conversa como candidata, fornecedor, consultorio, parceiro_medico ou outro, cancela o follow-up agendado e devolve o texto de encaminhamento aprovado e a instrução instrucao_nao_lead com ele. Nunca rebaixa conversa de cliente nem com DPP na ficha.';
grant execute on function agente.marcar_nao_lead(uuid, text) to n8n_agente;


-- =============================================================================
-- 4. Follow-up (PRD 19.4 entrada B, 10.1 followup_d1, 11.11 itens 7 e 8)
-- =============================================================================

-- --- 4.1 agente.followups_devidos ------------------------------------------------------
-- Consome as execuções followup_d1 que o motor agendou (0012) e reserva as
-- que podem sair agora (payload.reservada_em): nunca devolve a mesma duas
-- vezes. Aplica: freio (privado.pode_executar, que registra o aborto),
-- nao_contatar, pausa, transferência aberta, modo (nunca humano_comercial,
-- humano_nominal, nao_lead nem cliente), lista de teste, conversa iniciada
-- pela família, janela e uma mensagem de conteúdo por dia
-- (privado.pode_enviar_mensagem) e agente_followup_horas sem resposta da
-- família, com a última fala da Kraamzorg.
-- Fora da janela ou com conteúdo já enviado hoje: fica agendada para a
-- próxima rodada. O resto que não pode sair: cancelada, com o motivo.
create function agente.followups_devidos() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_horas     numeric := privado.agente_parametro_numero('agente_followup_horas');
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
  v_itens     jsonb := '[]'::jsonb;
  v_ctx       jsonb;
  v_reservadas integer := 0;
  v_canceladas integer := 0;
  v_abortadas  integer := 0;
  v_aguardando integer := 0;
  v_enviados   jsonb;
begin
  perform privado.agente_contexto();
  if v_horas is null or v_horas <= 0 then
    return pg_catalog.jsonb_build_object('ok', true, 'itens', '[]'::jsonb, 'aviso', 'parametro_agente_followup_horas_ausente',
                                         'validador', pg_catalog.jsonb_build_object('listas', privado.agente_parametro('validador_listas')),
                                         'enviados_hoje', '[]'::jsonb, 'limite_similaridade', v_lim);
  end if;

  for v_rec in
    select e.*
    from public.automacao_execucao e
    where e.automacao_id = 'followup_d1'
      and e.status = 'agendada'
      and e.agendada_para <= pg_catalog.clock_timestamp()
      and not (coalesce(e.payload, '{}'::jsonb) ? 'reservada_em')
    order by e.agendada_para
    for update of e skip locked
  loop
    v_cancelar := null;
    v_conv := null;
    select c.* into v_conv from public.conversa c where c.id = (v_rec.payload ->> 'conversa_id')::uuid;

    if v_conv.id is null then
      v_cancelar := 'conversa_inexistente';
    else
      -- freio primeiro: pode_executar grava abortada_freio com o estado
      if v_rec.familia_id is not null and not privado.pode_executar(v_rec.familia_id, 'followup_d1', v_rec.id) then
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
        when (v_estado ->> 'handoff_aberto')::boolean then 'transferencia_aberta'
        when (v_estado ->> 'pausa')::boolean then 'pausado'
        when (v_estado ->> 'nao_contatar')::boolean then 'nao_contatar'
        when v_conv.wa_jid is null then 'sem_jid'
        when v_conv.ultima_entrada_em is null
             or v_conv.ultima_entrada_em is distinct from (v_rec.payload ->> 'ultima_entrada_em')::timestamptz
             or v_conv.ultima_entrada_em > pg_catalog.now() - pg_catalog.make_interval(secs => (v_horas * 3600)::double precision)
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
        v_chave := case when v_o.pdf_enviado_em is not null then 'followup_d1_pos_pdf' else 'followup_d1_pos_abertura' end;
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
      'texto_base', privado.aplicar_texto(v_texto, v_nome, '{}'::jsonb),
      'tempo_sem_resposta', case when v_horas_sem >= 24
                                 then (v_horas_sem / 24)::text || case when v_horas_sem / 24 = 1 then ' dia' else ' dias' end
                                 else v_horas_sem::text || case when v_horas_sem = 1 then ' hora' else ' horas' end end,
      'data_hora', privado.formatar_data_hora(pg_catalog.now()),
      'ultimas_mensagens', v_ctx));
  end loop;

  -- follow-ups que saíram hoje, para a comparação por hash e semelhança no
  -- código (11.11 item 7); nunca vão para o modelo
  select coalesce(pg_catalog.jsonb_agg(m.conteudo), '[]'::jsonb) into v_enviados
  from public.automacao_execucao e
  join public.mensagem m on m.id = (e.payload ->> 'mensagem_id')::uuid
  where e.automacao_id = 'followup_d1'
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
comment on function agente.followups_devidos() is 'Apêndice A [v4.2] e PRD 19.4 nó 37: lista reservada de follow-ups devidos (followup_d1 agendado pelo motor), com freio, nao_contatar, pausa, transferência aberta, modo (nunca humano_comercial), lista de teste, conversa iniciada pela família, janela, uma mensagem de conteúdo por dia e agente_followup_horas sem resposta. Devolve {ok, itens: [{execucao_id, conversa_id, wa_jid, nome, texto_base, tempo_sem_resposta, data_hora, ultimas_mensagens}], validador, enviados_hoje, limite_similaridade}.';
grant execute on function agente.followups_devidos() to n8n_agente;

-- --- 4.2 agente.registrar_followup -----------------------------------------------------
-- ok: fecha a execução (executada, que conta como a mensagem de conteúdo do
-- dia), grava a mensagem da Isadora e marca a cadência (primeiro retorno).
-- Não saiu: a primeira falha devolve a execução para a próxima janela; a
-- segunda vira tarefa do comercial com o texto aprovado sugerido (19.4 nó 41).
create function agente.registrar_followup(execucao_id uuid, texto text, ok boolean) returns jsonb
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
    insert into public.mensagem (conversa_id, direcao, enviado_por, tipo, conteudo)
    values (v_conversa, 'saida', 'ia', 'texto', v_texto)
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
comment on function agente.registrar_followup(uuid, text, boolean) is 'Apêndice A e PRD 19.4 nó 41: fecha a execução reservada. Saiu: executada (conta como a mensagem de conteúdo do dia), grava a mensagem da Isadora, cadencia_etapa 1. Não saiu: volta uma vez na próxima janela; na segunda, falhou e vira tarefa do comercial com o texto aprovado sugerido.';
grant execute on function agente.registrar_followup(uuid, text, boolean) to n8n_agente;


-- =============================================================================
-- 5. privado.agendar_followup_d1 (0012) deduplica por qualquer status
--
-- Na 0012 a deduplicação olhava só execuções 'agendada' e 'executada'. Com
-- o consumo do P22, uma execução cancelada (família respondeu? não: essa
-- tem ultima_entrada_em mais velha) ou abortada pelo freio voltaria a ser
-- criada a cada 5 minutos para o mesmo silêncio da família. Agora qualquer
-- execução para o mesmo ultima_entrada_em consome o fato; resposta nova da
-- família (ultima_entrada_em mais novo) abre um agendamento novo, como
-- antes. Mesmo corpo da 0012 fora isso.
-- =============================================================================

create or replace function privado.agendar_followup_d1() returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
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
        and (e.payload ->> 'ultima_entrada_em')::timestamptz >= c.ultima_entrada_em
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.agendar_followup_d1() is 'Só agenda followup_d1 (PROMPTS.md P20, Apêndice A): conversa lead sem resposta há parametro.agente_followup_horas, sem handoff aberto, fora de humano_comercial (agente_encerrado_em). Nunca executa: agente.followups_devidos (P22) consome. Deduplica por qualquer status para o mesmo ultima_entrada_em (0014); resposta nova da família cancela o agendamento velho. Sem grant.';


-- =============================================================================
-- 6. Base de conhecimento do fluxo 1 (PRD 19.2, 6.8)
-- =============================================================================

-- --- 6.1 agente.base_para_indexar ----------------------------------------------------
-- Uma linha por documento (esta devolve linhas, não jsonb): itens aprovados
-- de agente.base_conhecimento (nada em rascunho ou arquivado; o schema não
-- tem tipo clínico, e o conteúdo é aprovado pela diretoria), um documento
-- por plano vigente SEM valor (o valor vem da ficha a cada mensagem e
-- envelheceria no vetor) e um por praça ativa com as localidades atendidas
-- (sem taxa, C-17).
create function agente.base_para_indexar()
  returns table (tipo text, fonte_id text, titulo text, texto text, pagina_pdf integer)
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.agente_contexto();

  return query
  select b.tipo::text, 'base:' || b.id::text, b.titulo, b.texto, null::integer
  from agente.base_conhecimento b
  where b.status = 'aprovado'
  order by b.tipo, b.titulo;

  return query
  select 'plano'::text,
         'plano:' || (p ->> 'pacote_id'),
         p ->> 'nome',
         (p ->> 'nome') || coalesce(' (' || (p ->> 'linha') || ')', '') || ': ' || (p ->> 'dias') || ' dias de acompanhamento, '
           || pg_catalog.replace(p ->> 'horas_por_visita', '.', ',') || ' h por visita, '
           || pg_catalog.replace(p ->> 'horas_totais', '.', ',') || ' h no total'
           || case when (p ->> 'gemelar')::boolean then ', para gêmeos' else '' end
           || coalesce('. Detalhes na página ' || (p ->> 'pagina') || ' da apresentação', '') || '.',
         (p ->> 'pagina')::integer
  from pg_catalog.jsonb_array_elements(privado.agente_planos()) p;

  return query
  select 'cobertura'::text,
         'praca:' || r.id::text,
         r.praca,
         r.praca || '. Localidades atendidas: '
           || coalesce((select pg_catalog.string_agg(c.nome || case when pg_catalog.cardinality(c.aliases) > 0
                                                                     then ' (' || pg_catalog.array_to_string(c.aliases, ', ') || ')' else '' end,
                                                      ', ' order by c.nome)
                        from public.cidade c where c.regiao_id = r.id and c.atendida and not c.requer_confirmacao), '')
           || coalesce('. A confirmar com a equipe: '
                       || (select pg_catalog.string_agg(c.nome, ', ' order by c.nome)
                           from public.cidade c where c.regiao_id = r.id and c.atendida and c.requer_confirmacao), '')
           || '.',
         null::integer
  from public.regiao r
  where r.ativa
    and exists (select 1 from public.cidade c where c.regiao_id = r.id and c.atendida)
  order by r.praca;
end;
$$;
comment on function agente.base_para_indexar() is 'Apêndice A e PRD 19.2 nó 5: documentos do fluxo 1, um por linha (tipo, fonte_id, titulo, texto, pagina_pdf): itens aprovados da base de conhecimento, um por plano vigente sem valor e um por praça ativa com as localidades atendidas (sem taxa).';
grant execute on function agente.base_para_indexar() to n8n_agente;

-- --- 6.2 Troca atômica do lote (19.2 nós 9 a 11) --------------------------------
create function agente.promover_lote(lote_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_novos     integer;
  v_removidos integer;
begin
  perform privado.agente_contexto();
  if promover_lote.lote_id is null then
    raise exception 'promover_lote: lote_id é obrigatório' using errcode = '22023';
  end if;
  select count(*) into v_novos from agente_n8n.documentos d where d.metadata ->> 'lote_id' = promover_lote.lote_id::text;
  if v_novos = 0 then
    -- lote vazio nunca apaga a base que está valendo
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'lote_vazio', 'documentos', 0);
  end if;
  delete from agente_n8n.documentos d
   where d.metadata ->> 'lote_id' is distinct from promover_lote.lote_id::text;
  get diagnostics v_removidos = row_count;
  return pg_catalog.jsonb_build_object('ok', true, 'documentos', v_novos, 'removidos', v_removidos);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.promover_lote(uuid) is 'Apêndice A e PRD 19.2 nó 9: apaga os documentos de lotes anteriores só se o lote novo tem documento (lote vazio: ok falso, base anterior intacta). Numa transação só.';
grant execute on function agente.promover_lote(uuid) to n8n_agente;

create function agente.descartar_lote(lote_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_removidos integer;
begin
  perform privado.agente_contexto();
  if descartar_lote.lote_id is null then
    raise exception 'descartar_lote: lote_id é obrigatório' using errcode = '22023';
  end if;
  delete from agente_n8n.documentos d where d.metadata ->> 'lote_id' = descartar_lote.lote_id::text;
  get diagnostics v_removidos = row_count;
  return pg_catalog.jsonb_build_object('ok', true, 'removidos', v_removidos);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.descartar_lote(uuid) is 'Apêndice A e PRD 19.2 nó 11: remove o lote parcial; a base anterior continua valendo.';
grant execute on function agente.descartar_lote(uuid) to n8n_agente;

create function agente.registrar_ingestao(lote_id uuid, documentos integer, status text, erro text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_id bigint;
begin
  perform privado.agente_contexto();
  if registrar_ingestao.lote_id is null then
    raise exception 'registrar_ingestao: lote_id é obrigatório' using errcode = '22023';
  end if;
  insert into agente.ingestao_execucao (lote_id, documentos, status, erro)
  values (registrar_ingestao.lote_id, greatest(coalesce(registrar_ingestao.documentos, 0), 0),
          registrar_ingestao.status::public.status_ingestao, nullif(pg_catalog.btrim(registrar_ingestao.erro), ''))
  returning id into v_id;
  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_ingestao(uuid, integer, text, text) is 'Apêndice A e PRD 19.2 nós 10 e 11: registra a execução da ingestão (ok ou falhou) em agente.ingestao_execucao.';
grant execute on function agente.registrar_ingestao(uuid, integer, text, text) to n8n_agente;


-- =============================================================================
-- 7. Devolver à Isadora (P22 item 4 [v4.2], PRD 11.7, D-17)
--
-- Só pelo botão "Devolver à Isadora" (P27), para comercial, coordenação ou
-- diretoria. Limpa agente_pausado_ate, agente_encerrado_em e
-- agente_encerrado_motivo e grava no log. "Resolver" a transferência nunca
-- chama esta função: fecha o handoff e mantém o modo da conversa.
-- =============================================================================

create function privado.retomar_agente(conversa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c public.conversa;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);

  select c.* into v_c from public.conversa c where c.id = retomar_agente.conversa_id for update;
  if not found then
    raise exception 'retomar_agente: conversa % não existe', retomar_agente.conversa_id using errcode = 'P0002';
  end if;
  if v_c.agente_encerrado_em is null
     and (v_c.agente_pausado_ate is null or v_c.agente_pausado_ate <= pg_catalog.now()) then
    raise exception 'retomar_agente: a conversa já está com a Isadora (nem humano_comercial nem pausada)' using errcode = '22023';
  end if;

  update public.conversa c
     set agente_pausado_ate = null,
         agente_pausa_motivo = null,
         agente_encerrado_em = null,
         agente_encerrado_motivo = null
   where c.id = v_c.id;

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), 'agente_retomado', 'conversa', v_c.id::text,
          pg_catalog.jsonb_build_object('agente_encerrado_em', v_c.agente_encerrado_em,
                                        'agente_encerrado_motivo', v_c.agente_encerrado_motivo,
                                        'agente_pausado_ate', v_c.agente_pausado_ate),
          pg_catalog.jsonb_build_object('agente_encerrado_em', null, 'agente_pausado_ate', null),
          privado.origem_atual(), privado.ip_requisicao());

  if v_c.familia_id is not null then
    insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
    values (privado.familia_vigente(v_c.familia_id), 'agente_retomado', 'agente_retomado',
            pg_catalog.jsonb_build_object('conversa_id', v_c.id, 'estava_em', case when v_c.agente_encerrado_em is not null
                                                                               then 'humano_comercial' else 'pausado' end),
            false, auth.uid());
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'conversa_id', v_c.id,
                                       'estava_em', case when v_c.agente_encerrado_em is not null then 'humano_comercial' else 'pausado' end);
end;
$$;
comment on function privado.retomar_agente(uuid) is 'Botão "Devolver à Isadora" (P22 item 4, PRD 11.7 [v4.2], D-17): comercial, coordenação ou diretoria (privado.autorizar). Limpa agente_pausado_ate, agente_encerrado_em e agente_encerrado_motivo, grava log_auditoria (agente_retomado) e evento na ficha. Única saída de humano_comercial. Sem grant: o app chega por api.retomar_agente.';

create function api.retomar_agente(conversa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.retomar_agente(retomar_agente.conversa_id);
end;
$$;
comment on function api.retomar_agente(uuid) is 'Wrapper do app para privado.retomar_agente ("Devolver à Isadora", P27): a checagem de papel e AAL fica na função privada.';
grant execute on function api.retomar_agente(uuid) to authenticated;


-- =============================================================================
-- 8. Eliminação a pedido do titular (PRD 21.3 [v4.2], L-05)
-- =============================================================================

-- --- 8.1 Exceção do gatilho de evento_familia -----------------------------------------
-- evento_familia continua append-only para todo mundo, inclusive o dono.
-- Única exceção: dentro de privado.eliminar_titular, que liga
-- app.eliminacao com o id da família, o dono pode trocar titulo e dados por
-- '[eliminado]', e nada além disso. Mesma mensagem de recusa de
-- privado.recusar_update_delete (P03).
create function privado.proteger_evento_familia() returns trigger
  language plpgsql
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_dono boolean;
begin
  if tg_op = 'UPDATE'
     and coalesce(pg_catalog.current_setting('app.eliminacao', true), '') = old.familia_id::text then
    select pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER') into v_dono
    from pg_catalog.pg_class c
    where c.oid = tg_relid;
    if v_dono
       and new.id = old.id
       and new.familia_id = old.familia_id
       and new.tipo = old.tipo
       and new.restrito = old.restrito
       and new.criado_em = old.criado_em
       and new.criado_por is not distinct from old.criado_por
       and new.titulo = '[eliminado]'
       and new.dados = pg_catalog.to_jsonb('[eliminado]'::text) then
      return new;
    end if;
  end if;
  raise exception 'tabela % é append-only: % direto não é permitido (PRD 6.10 regra 4)', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;
comment on function privado.proteger_evento_familia() is 'Gatilho BEFORE UPDATE OR DELETE de evento_familia: recusa sempre, para qualquer papel (PRD 6.10 regra 4), salvo a troca de titulo e dados por [eliminado] pelo dono com app.eliminacao igual ao id da família, ligada só por privado.eliminar_titular (PRD 21.3 [v4.2]).';

drop trigger recusar_update_delete on public.evento_familia;
create trigger recusar_update_delete
  before update or delete on public.evento_familia
  for each row execute function privado.proteger_evento_familia();

-- --- 8.2 privado.eliminar_titular -----------------------------------------------------------
-- Só a diretoria com AAL2, numa transação:
--   1. apaga agente_n8n.chat_memoria das conversas da família;
--   2. apaga mensagem, handoff, tarefa, notificacao (as que citam a família
--      no link ou no corpo), sessao_venda_gravacao e as conversas;
--   3. anonimiza familia, pessoa, pessoa_dados_contrato e bebe ('Titular
--      eliminado'; telefone, e-mail, CPF, endereços e datas nulos);
--   4. preserva registro_atendimento, registro_adendo, alerta_clinico,
--      relatorio_medico, contrato e nota fiscal;
--   5. troca titulo e dados de evento_familia por '[eliminado]';
--   6. grava em log_auditoria só o id e o motivo.
-- Também (leitura mais segura, cabeçalho): famílias mescladas nesta,
-- qualificação comercial e opções da sessão de venda esvaziadas,
-- nao_contatar ligado e execuções agendadas canceladas. Fora do banco
-- (runbook): chaves do Redis das conversas e erros guardados do n8n.
create function privado.eliminar_titular(familia_id uuid, motivo text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_motivo     text := nullif(pg_catalog.btrim(eliminar_titular.motivo), '');
  v_familias   uuid[];
  v_conversas  uuid[];
  v_f          uuid;
  v_memoria    integer := 0;
  v_mensagens  integer := 0;
  v_handoffs   integer := 0;
  v_tarefas    integer := 0;
  v_notif      integer := 0;
  v_gravacoes  integer := 0;
  v_conv_n     integer := 0;
  v_eventos    integer := 0;
begin
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);

  if eliminar_titular.familia_id is null or v_motivo is null then
    raise exception 'eliminar_titular: familia_id e motivo são obrigatórios' using errcode = '22023';
  end if;
  if not exists (select 1 from public.familia f where f.id = eliminar_titular.familia_id) then
    raise exception 'eliminar_titular: família % não existe', eliminar_titular.familia_id using errcode = 'P0002';
  end if;

  -- a família e todas as que foram mescladas nela (mesma titular)
  with recursive arvore(id) as (
    select eliminar_titular.familia_id
    union
    select f.id from public.familia f join arvore a on f.mesclada_em_id = a.id
  )
  select pg_catalog.array_agg(a.id) into v_familias from arvore a;

  select coalesce(pg_catalog.array_agg(c.id), '{}') into v_conversas
  from public.conversa c where c.familia_id = any (v_familias);

  -- 1. memória do agente
  delete from agente_n8n.chat_memoria cm
   where cm.session_id in (select pg_catalog.unnest(v_conversas)::text);
  get diagnostics v_memoria = row_count;

  -- 2. conversa e o que depende dela, tarefas, notificações e gravação
  delete from public.mensagem m where m.conversa_id = any (v_conversas);
  get diagnostics v_mensagens = row_count;
  delete from public.handoff h where h.familia_id = any (v_familias) or h.conversa_id = any (v_conversas);
  get diagnostics v_handoffs = row_count;
  delete from public.tarefa t where t.familia_id = any (v_familias);
  get diagnostics v_tarefas = row_count;
  delete from public.notificacao n
   where exists (select 1 from pg_catalog.unnest(v_familias) f(id)
                 where pg_catalog.strpos(coalesce(n.link, '') || ' ' || coalesce(n.corpo, ''), f.id::text) > 0);
  get diagnostics v_notif = row_count;
  delete from public.sessao_venda_gravacao g
   where g.sessao_id in (select s.id from public.sessao_venda s where s.familia_id = any (v_familias));
  get diagnostics v_gravacoes = row_count;
  update public.sessao_venda s set opcoes_informadas = null, link_reuniao = null where s.familia_id = any (v_familias);
  delete from public.conversa c where c.id = any (v_conversas);
  get diagnostics v_conv_n = row_count;

  -- 3. anonimização do cadastro (o registro assistencial, o contrato e a
  --    nota fiscal continuam ligados ao mesmo id)
  update public.familia f
     set nome_exibicao = 'Titular eliminado',
         bairro = null,
         endereco_atendimento = null,
         cidade_informada = null,
         dpp = null,
         data_nascimento = null,
         data_alta = null,
         data_inicio_efetivo = null,
         estado_sensivel_motivo = null,
         nao_contatar = true,
         nao_contatar_em = coalesce(f.nao_contatar_em, pg_catalog.now()),
         nao_contatar_motivo = null,
         historico_sensivel = false,
         codigo_origem = null,
         utm = null
   where f.id = any (v_familias);
  update public.pessoa p
     set nome = 'Titular eliminado', telefone_e164 = null, email = null, idade = null, ocupacao = null
   where p.familia_id = any (v_familias);
  update public.pessoa_dados_contrato d
     set cpf = null, data_nascimento = null, endereco_residencial = null
   where d.pessoa_id in (select p.id from public.pessoa p where p.familia_id = any (v_familias));
  update public.bebe b set nome = null, data_nascimento = null where b.familia_id = any (v_familias);
  update public.oportunidade o
     set qualificacao = '{}'::jsonb, motivo_perda_detalhe = null, desconto_motivo = null, pagamento_preferido = null
   where o.familia_id = any (v_familias);
  update public.automacao_execucao e
     set status = 'cancelada', motivo_aborto = 'eliminacao_titular'
   where e.familia_id = any (v_familias) and e.status = 'agendada';

  -- 5. linha do tempo: '[eliminado]' pela exceção do gatilho
  foreach v_f in array v_familias loop
    perform pg_catalog.set_config('app.eliminacao', v_f::text, true);
    update public.evento_familia e
       set titulo = '[eliminado]', dados = pg_catalog.to_jsonb('[eliminado]'::text)
     where e.familia_id = v_f
       and (e.titulo <> '[eliminado]' or e.dados <> pg_catalog.to_jsonb('[eliminado]'::text));
    get diagnostics v_eventos = row_count;
  end loop;
  perform pg_catalog.set_config('app.eliminacao', '', true);

  -- 6. log: só o id e o motivo
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), 'eliminacao_titular', 'familia', eliminar_titular.familia_id::text, null,
          pg_catalog.jsonb_build_object('motivo', v_motivo),
          privado.origem_atual(), privado.ip_requisicao());

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'familias', pg_catalog.to_jsonb(v_familias),
    'chat_memoria_apagada', v_memoria,
    'mensagens_apagadas', v_mensagens,
    'handoffs_apagados', v_handoffs,
    'tarefas_apagadas', v_tarefas,
    'notificacoes_apagadas', v_notif,
    'gravacoes_apagadas', v_gravacoes,
    'conversas_apagadas', v_conv_n);
end;
$$;
comment on function privado.eliminar_titular(uuid, text) is 'Eliminação a pedido do titular (PRD 21.3 [v4.2], L-05): só diretoria com AAL2. Apaga memória do agente, mensagem, handoff, tarefa, notificação, gravação da sessão e conversas; anonimiza familia, pessoa, pessoa_dados_contrato e bebe; preserva registro assistencial, alertas, relatório médico, contrato e nota fiscal; troca titulo e dados de evento_familia por [eliminado] (app.eliminacao); log só com id e motivo. Inclui famílias mescladas nesta. Sem grant: o app chega por api.eliminar_titular.';

create function api.eliminar_titular(familia_id uuid, motivo text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.eliminar_titular(eliminar_titular.familia_id, eliminar_titular.motivo);
end;
$$;
comment on function api.eliminar_titular(uuid, text) is 'Wrapper do app para privado.eliminar_titular (PRD 21.3): diretoria com AAL2, conferido na função privada.';
grant execute on function api.eliminar_titular(uuid, text) to authenticated;


-- =============================================================================
-- 9. Execute
-- =============================================================================

revoke execute on function privado.somar_horas_uteis(timestamptz, numeric) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_sla(jsonb, public.prioridade, timestamptz) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_resumo_interno(uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_enfermeira(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.retomar_agente(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.eliminar_titular(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function privado.proteger_evento_familia() from public, anon, authenticated, service_role;
revoke execute on function privado.agendar_followup_d1() from public, anon, authenticated, service_role;
revoke execute on function api.retomar_agente(uuid) from public, anon, service_role;
revoke execute on function api.eliminar_titular(uuid, text) from public, anon, service_role;

-- As funções do schema agente: só n8n_agente (concedido acima, uma a uma).
revoke execute on all functions in schema agente from public, anon, authenticated, service_role;


-- =============================================================================
-- 10. Trava de revisão: n8n_agente executa exatamente o Apêndice A
-- =============================================================================

do $$
declare
  v_lista text;
begin
  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'api')
    and has_function_privilege('n8n_agente', p.oid, 'execute')
    and not (n.nspname = 'agente' and p.proname in (
      'registrar_mensagem', 'registrar_transcricao', 'pode_responder', 'pode_enviar', 'mensagem_sistema',
      'sincronizar_memoria', 'pausar', 'contexto_conversa', 'checar_termos_alerta', 'mensagem_alerta',
      'ficha_para_agente', 'planos_vigentes', 'verificar_cobertura', 'verificar_disponibilidade',
      'atualizar_lead', 'registrar_marco', 'registrar_handoff', 'registrar_notificacao_handoff',
      'marcar_nao_lead', 'followups_devidos', 'registrar_followup', 'base_para_indexar', 'promover_lote',
      'descartar_lote', 'registrar_ingestao'));
  if v_lista is not null then
    raise exception 'n8n_agente executa função fora do Apêndice A: %', v_lista;
  end if;
end $$;
