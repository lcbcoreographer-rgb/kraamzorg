-- =============================================================================
-- 0019_contrato_cobranca.sql
--
-- P31 (contrato e assinatura eletrônica) e P32 (cobrança pela InfinitePay) ·
-- PROMPTS.md v2 · PRD 4 (D-16), 6.3 (contrato, cobranca, nota_fiscal), 7.2,
-- 8.2, 10.1 (contrato_fechado, pos_assinatura, pagamento_confirmado,
-- prenatal_urgente), 13, 14 (Autentique, InfinitePay) e 22.2 (C-05, C-10,
-- C-11, C-16).
--
-- Esta migration NÃO foi aplicada em ambiente nenhum: escrita, testada no
-- banco local (supabase/sem-docker) e parada para revisão humana do SQL
-- (CLAUDE.md). Nenhum dado aqui além de uma linha de configuração da
-- automação prenatal_urgente (ver seção 2); parâmetros e textos novos ficam
-- no seed.sql, em rascunho.
--
-- Contrato (P31):
--   1. api.contrato_situacao(familia_id): o contrato da família, em que
--      etapa está, quem assina e (só o status, para o comercial) a cobrança.
--   2. api.dados_para_contrato(contrato_id): tudo o que o PDF precisa,
--      inclusive CPF e endereço completos, com a leitura gravada no log de
--      auditoria. Só depois do formulário seguro recebido.
--   3. api.registrar_contrato_gerado(...): guarda o caminho do PDF (nome pelo
--      id, nunca por nome de paciente), passa o contrato a "gerado" e o P2
--      a contrato_gerado.
--   4. api.reservar_envio_contrato / concluir_envio_contrato /
--      liberar_envio_contrato: o envio à Autentique em três passos, para uma
--      falha no meio nunca criar dois documentos (o plano gratuito tem 20 por
--      mês). Concluir passa o contrato a "enviado" e o P2 a
--      aguardando_assinatura.
--   5. public.contrato_do_documento e public.contrato_registrar_assinatura
--      (só service_role, chamadas pelo webhook depois de reconsultar a
--      Autentique): contrato assinado, P2 assinado e a automação
--      pos_assinatura (cobrança criada, P2 cobranca_gerada).
--
-- Cobrança (P32):
--   6. api.gerar_cobranca(contrato_id): cobrança do contrato assinado, para o
--      caso de a automação ter sido freada ou estar desligada.
--   7. api.cobrancas / api.cobranca: lista e detalhe para o financeiro.
--   8. api.dados_link_pagamento / api.registrar_link_pagamento e as versões
--      de servidor public.cobrancas_sem_link / public.cobranca_registrar_link:
--      o link sai da InfinitePay pelo servidor do app, o banco só guarda e
--      cria a tarefa link_pagamento.
--   9. public.cobranca_do_pedido e public.cobranca_baixar (só service_role,
--      webhook depois do payment_check): baixa idempotente, P2
--      pagamento_confirmado, nota fiscal pendente para o P43 e, acima de
--      34 semanas, a tarefa e o aviso de prenatal_urgente.
--  10. api.baixar_cobranca_manual: Pix recebido fora do sistema, com
--      comprovante e motivo (financeiro e diretoria).
--
-- Fechamento de escrita direta (mesma ideia da 0018 para sessao_venda):
--   * contrato: sem update direto para authenticated e sem status, token,
--     Autentique nem PDF no insert. Estado e datas mudam só pelas funções.
--   * cobranca: sem insert nem update direto. Baixa, link e vencimento só
--     pelas funções, que movem o P2 e criam as tarefas na mesma transação.
--   * api.transicionar recusa mover o P2 para contrato_gerado,
--     aguardando_assinatura, assinado, cobranca_gerada ou pagamento_confirmado:
--     esses estágios só andam junto com o documento e o pagamento de verdade.
--
-- Papéis e AAL (ADR 0002, seções 5 e 6, linhas acrescentadas):
--   contrato_situacao        comercial, financeiro (só com contrato), diretoria; AAL2
--   dados_para_contrato,
--   registrar_contrato_gerado,
--   reservar/concluir/liberar_envio_contrato
--                            comercial e diretoria; AAL2
--   gerar_cobranca, cobrancas, cobranca, dados_link_pagamento,
--   registrar_link_pagamento, baixar_cobranca_manual
--                            financeiro e diretoria; AAL2
--   public.contrato_* e public.cobranca* de servidor: só service_role
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura; registradas em
-- docs/sessoes/P31-P32.md):
--   * Uma cobrança por contrato, com o total (valor menos desconto mais taxa).
--     As parcelas do contrato são as parcelas do cartão no link de
--     pagamento; nunca passam de pacote_versao.parcelas_max_sem_juros. Acima
--     disso (exceção aprovada, C-05) a cobrança nasce sem link e o financeiro
--     é avisado: parcelamento maior é combinado à mão [confirmar: Leonardo].
--   * "Mais de 34 semanas" lido como 34 semanas ou mais, a mesma régua do
--     alerta_34s (0012); o número mora em parametro.cobranca.
--   * O pagamento é confirmado pela primeira cobrança paga do contrato.
--   * Pagamento que chega em cobrança cancelada ou estornada, ou abaixo do
--     valor, não baixa: fica o aviso ao financeiro, que decide.
--   * Freio (PRD 8.2): pos_assinatura passa por privado.pode_executar. Com a
--     família em bloqueio_total ou encerrado_sensivel a cobrança não nasce
--     sozinha e o financeiro é avisado. A baixa de um pagamento que já
--     aconteceu sempre grava; só as mensagens à família respeitam o freio.
--   * O PDF assinado substitui contrato.pdf_path (nome pelo id); o
--     original continua no storage.
-- Nenhum preço, prazo, texto ou limite no SQL: valores vêm de pacote_versao e
-- parametro; textos de mensagem_modelo. Títulos de tarefa, evento e aviso são
-- texto interno da equipe, como os da 0018.
-- =============================================================================


-- =============================================================================
-- 1. Escrita direta fechada
-- =============================================================================

-- Nem update nem insert: o contrato nasce em api.salvar_proposta (o banco lê
-- o preço, a taxa e a condição, faz a conta e exige a aprovação do desconto).
-- Um insert direto com valor_centavos e desconto_centavos a critério de quem
-- chama contornaria as duas coisas. O revoke no nível da tabela não tira os
-- privilégios por coluna dados antes, por isso as colunas vão explícitas.
revoke insert on public.contrato from authenticated;
revoke update on public.contrato from authenticated;
revoke insert (id, criado_por, familia_id, pacote_versao_id, contratante_pessoa_id, pagador_pessoa_id,
               testemunha_pessoa_id, valor_centavos, taxa_deslocamento_centavos, desconto_centavos, parcelas,
               template_versao)
  on public.contrato from authenticated;

revoke insert on public.cobranca from authenticated;
revoke update on public.cobranca from authenticated;

create unique index contrato_autentique_doc_id_unico
  on public.contrato (autentique_doc_id)
  where autentique_doc_id is not null;

comment on table public.contrato is 'Contrato gerado a partir de uma oportunidade ganha (PRD 6.3, 7.2). Valor em centavos (PRD 6.10 regra 5). [P31] Estado, datas, Autentique e PDF só mudam pelas funções api.*_contrato_* e public.contrato_* (0019).';
comment on table public.cobranca is 'Parcela de cobrança de um contrato (PRD 6.3), integrada com a InfinitePay. [P32] Link, baixa e vencimento só mudam pelas funções api.*cobranca* e public.cobranca* (0019).';


-- =============================================================================
-- 2. Automação prenatal_urgente (PRD 10.1, P32 item 3)
--
-- A 0012 deixou prenatal_urgente desligada ("Fase 2, pré-natal online"). O
-- P32 pede a tarefa máxima e o aviso imediato à coordenação na Fase 1, e a
-- automação é interna (nada vai à família), então liga aqui. A diretoria
-- desliga em Configurações se preferir.
-- =============================================================================

update public.automacao set ativa = true where id = 'prenatal_urgente';


-- =============================================================================
-- 3. api.transicionar: estágios que só andam pelo fluxo de contrato e pagamento
--    (corpo igual ao da 0007, mais a recusa no início)
-- =============================================================================

create or replace function api.transicionar(maquina text, entidade_id uuid, para text, motivo text default null)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_maquina privado.maquina_estado;
  v_familia uuid;
  v_propria boolean;
begin
  begin
    v_maquina := transicionar.maquina::privado.maquina_estado;
  exception
    when invalid_text_representation then
      raise exception 'api.transicionar: máquina desconhecida: %', transicionar.maquina
        using errcode = '22023';
  end;

  if v_maquina = 'p2' and transicionar.para in ('contrato_gerado', 'aguardando_assinatura', 'assinado',
                                                 'cobranca_gerada', 'pagamento_confirmado') then
    -- [0019] esses estágios andam junto com o documento e o pagamento de
    -- verdade (funções de contrato e cobrança), nunca por clique.
    raise exception 'venda:estagio_so_pelo_fluxo o estágio % só muda junto com o contrato e o pagamento', transicionar.para
      using errcode = '42501';
  end if;

  case v_maquina
    when 'p1' then
      perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
    when 'p2' then
      perform privado.autorizar(array['comercial', 'financeiro', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
    when 'p4' then
      perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
    else
      perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
      if not (privado.tem_papel('coordenacao') or privado.tem_papel('diretoria')) then
        if v_maquina = 'acompanhamento' then
          select a.familia_id, true
            into v_familia, v_propria
          from public.acompanhamento a
          where a.id = transicionar.entidade_id;
        else
          select a.familia_id,
                 exists (select 1 from public.profissional pr
                         where pr.id = v.profissional_id and pr.usuario_id = auth.uid() and pr.ativa)
            into v_familia, v_propria
          from public.visita v
          join public.acompanhamento a on a.id = v.acompanhamento_id
          where v.id = transicionar.entidade_id;
        end if;

        if v_familia is null
           or not coalesce(v_propria, false)
           or not exists (select 1 from privado.familias_atribuidas() as f(id) where f.id = v_familia) then
          raise exception 'api.transicionar: família ou visita não atribuída a esta profissional (PRD 13)'
            using errcode = '42501';
        end if;
      end if;
  end case;

  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  return privado.transicionar(v_maquina, transicionar.entidade_id, transicionar.para, transicionar.motivo);
end;
$$;
comment on function api.transicionar(text, uuid, text, text) is 'Wrapper do app para privado.transicionar (PRD 7): confere papel, AAL e, para a enfermeira, família atribuída e visita própria; a transição e o papel_minimo são conferidos por privado.transicionar. [0019] Recusa mover o P2 para contrato_gerado, aguardando_assinatura, assinado, cobranca_gerada e pagamento_confirmado: esses estágios só andam pelas funções de contrato e cobrança. ADR 0002 seção 5.';


-- =============================================================================
-- 4. Auxiliares (privado, sem grant)
-- =============================================================================

-- Abre a execução de uma automação de sistema e passa pelo freio (PRD 8.2).
-- Devolve o id da execução se pode seguir; nulo se a automação está desligada
-- ou se o freio abortou (a execução fica registrada como abortada_freio).
create function privado.venda_automacao_iniciar(p_familia_id uuid, p_automacao_id text, p_dados jsonb)
  returns uuid
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_exec uuid;
begin
  if not coalesce((select a.ativa from public.automacao a where a.id = p_automacao_id), false) then
    return null;
  end if;
  insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, status, payload)
  values (p_automacao_id, p_familia_id, pg_catalog.clock_timestamp(), 'agendada', p_dados)
  returning id into v_exec;
  if privado.pode_executar(p_familia_id, p_automacao_id, v_exec) then
    return v_exec;
  end if;
  return null;
end;
$$;
comment on function privado.venda_automacao_iniciar(uuid, text, jsonb) is '[P31/P32] Abre a execução de uma automação de sistema e passa por privado.pode_executar. Nulo se desligada ou freada (a execução fica abortada_freio). Sem grant.';

create function privado.venda_automacao_concluir(p_execucao_id uuid) returns void
  language sql
  volatile
  set search_path = ''
  as $$
  update public.automacao_execucao e
     set status = 'executada', executada_em = pg_catalog.clock_timestamp()
   where e.id = p_execucao_id and e.status = 'agendada'
$$;
comment on function privado.venda_automacao_concluir(uuid) is '[P31/P32] Marca a execução aberta por venda_automacao_iniciar como executada. Sem grant.';

-- Aviso interno (central de notificação) para um papel. Nunca leva nome de
-- paciente no título; o link leva à tela.
create function privado.venda_avisar(p_papel public.papel_usuario, p_prioridade public.prioridade, p_titulo text, p_link text)
  returns void
  language sql
  volatile
  set search_path = ''
  as $$
  insert into public.notificacao (papel, prioridade, titulo, link, canais)
  values (p_papel, p_prioridade, p_titulo, p_link, '{app}')
$$;
comment on function privado.venda_avisar(public.papel_usuario, public.prioridade, text, text) is '[P31/P32] Notificação interna para um papel inteiro. O título nunca leva nome de paciente. Sem grant.';

create function privado.venda_email_mascarado(p_email text) returns text
  language sql
  immutable
  set search_path = ''
  as $$
  select case when p_email is null or p_email !~ '^[^@]+@[^@]+$' then null
              else pg_catalog.regexp_replace(p_email, '^(.).*(@.*)$', '\1***\2') end
$$;
comment on function privado.venda_email_mascarado(text) is '[P31] E-mail com a primeira letra e o domínio ("m***@exemplo.com"), para a tela conferir o destino sem mostrar o endereço inteiro. Sem grant.';

-- Estágio do P2 da família (nulo se não há oportunidade aberta no P2).
create function privado.venda_estagio_p2(p_familia_id uuid) returns text
  language sql
  stable
  set search_path = ''
  as $$ select (privado.venda_oportunidade(p_familia_id)).estagio_p2::text $$;
comment on function privado.venda_estagio_p2(uuid) is '[P31/P32] estagio_p2 da oportunidade aberta da família, em texto. Sem grant.';

-- Anda o P2 só se a oportunidade está exatamente em "de".
create function privado.venda_andar_p2(p_familia_id uuid, p_de text, p_para text, p_motivo text) returns boolean
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_o public.oportunidade := privado.venda_oportunidade(p_familia_id);
begin
  if v_o.id is null or v_o.estagio_p2::text is distinct from p_de then
    return false;
  end if;
  perform privado.transicionar('p2', v_o.id, p_para, p_motivo);
  return true;
end;
$$;
comment on function privado.venda_andar_p2(uuid, text, text, text) is '[P31/P32] Move o P2 de "de" para "para" por privado.transicionar, só se a oportunidade aberta está em "de". Falso, sem erro, se não está (repetição idempotente). Sem grant.';

-- O contrato "vivo" da família: o mais recente que não foi cancelado nem desfeito.
create function privado.contrato_vivo(p_familia_id uuid) returns public.contrato
  language sql
  stable
  set search_path = ''
  as $$
  select k.*
  from public.contrato k
  where k.familia_id = p_familia_id and k.status not in ('cancelado', 'distrato')
  order by k.criado_em desc, k.id
  limit 1
$$;
comment on function privado.contrato_vivo(uuid) is '[P31/P32] Contrato mais recente da família que não está cancelado nem em distrato. Sem grant.';

-- Formulário recebido: hash apagado e data do envio guardada (0018).
create function privado.contrato_formulario_recebido(p_k public.contrato) returns boolean
  language sql
  immutable
  set search_path = ''
  as $$ select p_k.formulario_token_hash is null and p_k.formulario_expira_em is not null $$;
comment on function privado.contrato_formulario_recebido(public.contrato) is '[P31] Verdadeiro se a família já mandou o formulário seguro (token consumido, data do envio guardada). Sem grant.';

create function privado.contrato_etapa(p_k public.contrato) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select case
           when p_k.id is null then 'sem_proposta'
           when p_k.status = 'rascunho' then 'sem_formulario'
           when p_k.status = 'aguardando_dados' and p_k.formulario_token_hash is not null
                and p_k.formulario_expira_em > pg_catalog.now() then 'aguardando_dados'
           when p_k.status = 'aguardando_dados' and p_k.formulario_token_hash is not null then 'formulario_vencido'
           when p_k.status = 'aguardando_dados' then 'pronto_para_gerar'
           when p_k.status = 'gerado' and p_k.enviado_em is not null and p_k.autentique_doc_id is null then 'envio_em_andamento'
           when p_k.status = 'gerado' then 'gerado'
           when p_k.status = 'enviado' then 'aguardando_assinatura'
           when p_k.status = 'assinado' then 'assinado'
           else p_k.status::text
         end
$$;
comment on function privado.contrato_etapa(public.contrato) is '[P31] Etapa do contrato para a tela: sem_proposta, sem_formulario, aguardando_dados, formulario_vencido, pronto_para_gerar, gerado, envio_em_andamento, aguardando_assinatura, assinado. Sem grant.';

create function privado.contrato_caminho_pdf(p_contrato_id uuid, p_assinado boolean) returns text
  language sql
  immutable
  set search_path = ''
  as $$ select 'contratos/' || p_contrato_id::text || case when p_assinado then '-assinado' else '' end || '.pdf' $$;
comment on function privado.contrato_caminho_pdf(uuid, boolean) is '[P31] Caminho do PDF no storage privado: sempre o id do contrato, nunca nome de paciente (CLAUDE.md). Sem grant.';

-- Cria a cobrança do contrato assinado (idempotente) e anda o P2 para
-- cobranca_gerada. Uma cobrança com o total; external_id = id da cobrança
-- (o order_nsu da InfinitePay).
create function privado.cobranca_gerar(p_contrato_id uuid) returns uuid
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_k      public.contrato;
  v_id     uuid;
  v_conta  jsonb;
  v_dias   numeric;
  v_hoje   date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
begin
  select k.* into v_k from public.contrato k where k.id = p_contrato_id for update;
  if not found or v_k.status <> 'assinado' then
    perform privado.venda_recusar('contrato_nao_assinado');
  end if;

  select c.id into v_id from public.cobranca c
  where c.contrato_id = v_k.id and c.status in ('aberta', 'vencida', 'paga')
  order by c.parcela, c.criado_em limit 1;
  if v_id is not null then
    return v_id;
  end if;

  v_dias := privado.venda_numero('cobranca', 'vencimento_dias');
  if v_dias is null or v_dias < 0 then
    perform privado.venda_recusar('cobranca_sem_parametro');
  end if;

  v_conta := privado.venda_conta(v_k.valor_centavos, v_k.taxa_deslocamento_centavos, v_k.desconto_centavos, 1);
  v_id := extensions.gen_random_uuid();
  insert into public.cobranca (id, criado_por, contrato_id, parcela, valor_centavos, vencimento, external_id, provider, status)
  values (v_id, auth.uid(), v_k.id, 1, (v_conta ->> 'total_centavos')::integer, v_hoje + v_dias::integer,
          v_id::text, 'infinitepay', 'aberta');

  perform privado.venda_andar_p2(v_k.familia_id, 'assinado', 'cobranca_gerada', 'Cobrança gerada');
  perform privado.venda_evento(v_k.familia_id, 'cobranca',
    'Cobrança gerada: ' || privado.formatar_reais((v_conta ->> 'total_centavos')::bigint),
    pg_catalog.jsonb_build_object('contrato_id', v_k.id, 'cobranca_id', v_id,
                                  'valor_centavos', (v_conta ->> 'total_centavos')::integer));
  perform privado.venda_log('cobranca_gerada', 'cobranca', v_id::text, null,
    pg_catalog.jsonb_build_object('contrato_id', v_k.id, 'valor_centavos', (v_conta ->> 'total_centavos')::integer,
                                  'vencimento', v_hoje + v_dias::integer));
  return v_id;
end;
$$;
comment on function privado.cobranca_gerar(uuid) is '[P32 item 1] Cobrança do contrato assinado, com o total em centavos e external_id igual ao id (order_nsu da InfinitePay); vencimento em parametro.cobranca.vencimento_dias. Idempotente. Anda o P2 para cobranca_gerada. Sem grant.';

-- Guarda o link da cobrança e cria a tarefa com o texto link_pagamento.
create function privado.cobranca_gravar_link(p_cobranca_id uuid, p_url text, p_slug text) returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_c     public.cobranca;
  v_k     public.contrato;
  v_f     public.familia;
  v_o     public.oportunidade;
  v_tarefa uuid;
begin
  if p_url is null or p_url !~ '^https://[^[:space:]]+$' or pg_catalog.length(p_url) > 500 then
    perform privado.venda_recusar('link_invalido');
  end if;
  select c.* into v_c from public.cobranca c where c.id = p_cobranca_id for update;
  if not found then
    perform privado.venda_recusar('cobranca_inexistente');
  end if;
  if v_c.status not in ('aberta', 'vencida') then
    perform privado.venda_recusar('cobranca_nao_aberta');
  end if;
  if v_c.link_pagamento is not null then
    if v_c.link_pagamento = p_url then
      return pg_catalog.jsonb_build_object('ok', true, 'repetido', true);
    end if;
    perform privado.venda_recusar('link_ja_gerado');
  end if;

  select k.* into v_k from public.contrato k where k.id = v_c.contrato_id;
  select f.* into v_f from public.familia f where f.id = v_k.familia_id;
  v_o := privado.venda_oportunidade(v_f.id);

  update public.cobranca c
     set link_pagamento = p_url,
         invoice_slug = coalesce(pg_catalog.left(pg_catalog.btrim(p_slug), 200), c.invoice_slug)
   where c.id = v_c.id;

  v_tarefa := privado.venda_criar_tarefa(
    v_f.id, 'outro',
    'Enviar o link de pagamento para a ' || v_f.nome_exibicao,
    v_o.responsavel_id, 'alta', pg_catalog.now(),
    'link_pagamento', pg_catalog.jsonb_build_object('link', p_url),
    'operacional',
    pg_catalog.jsonb_build_object('acao', 'link_pagamento', 'cobranca_id', v_c.id, 'contrato_id', v_k.id));
  if v_tarefa is not null and v_o.responsavel_id is null then
    update public.tarefa t set papel_responsavel = 'comercial' where t.id = v_tarefa;
  end if;

  perform privado.venda_evento(v_f.id, 'cobranca', 'Link de pagamento gerado',
    pg_catalog.jsonb_build_object('cobranca_id', v_c.id, 'tarefa_id', v_tarefa));
  perform privado.venda_log('cobranca_link_gerado', 'cobranca', v_c.id::text, null,
    pg_catalog.jsonb_build_object('tarefa_id', v_tarefa));
  return pg_catalog.jsonb_build_object('ok', true, 'tarefa_id', v_tarefa);
end;
$$;
comment on function privado.cobranca_gravar_link(uuid, text, text) is '[P32 item 1] Guarda o link de pagamento (só https, até 500 caracteres) e cria a tarefa com o texto link_pagamento (23.2), passando pelo freio (sem tarefa de texto em bloqueio_total ou não contatar). Um link só por cobrança. Sem grant.';

-- Dados que o servidor precisa para pedir o link à InfinitePay. Nunca leva CPF.
create function privado.cobranca_dados_link(p_cobranca_id uuid) returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_c   public.cobranca;
  v_k   public.contrato;
  v_max integer;
  v_p   public.pessoa;
begin
  select c.* into v_c from public.cobranca c where c.id = p_cobranca_id;
  if not found then
    return null;
  end if;
  select k.* into v_k from public.contrato k where k.id = v_c.contrato_id;
  select pv.parcelas_max_sem_juros into v_max from public.pacote_versao pv where pv.id = v_k.pacote_versao_id;
  select p.* into v_p from public.pessoa p where p.id = coalesce(v_k.pagador_pessoa_id, v_k.contratante_pessoa_id);
  return pg_catalog.jsonb_build_object(
    'cobranca_id', v_c.id,
    'contrato_id', v_k.id,
    'familia_id', v_k.familia_id,
    'status', v_c.status,
    'valor_centavos', v_c.valor_centavos,
    'parcelas', v_k.parcelas,
    'parcelas_max', v_max,
    'acima_do_limite', v_k.parcelas > v_max,
    'tem_link', v_c.link_pagamento is not null,
    'descricao', privado.venda_parametro('cobranca') ->> 'descricao_item',
    'cliente', pg_catalog.jsonb_build_object('nome', v_p.nome, 'email', v_p.email, 'telefone', v_p.telefone_e164));
end;
$$;
comment on function privado.cobranca_dados_link(uuid) is '[P32 item 1] O que o servidor precisa para pedir o link: valor em centavos, parcelas do cartão (do contrato), limite do pacote, descrição do item (parametro.cobranca) e o cliente (quem paga: pagador ou gestante). Nunca leva CPF. Sem grant.';

-- Confirma o pagamento de uma cobrança. Único caminho de baixa (webhook depois
-- do payment_check, ou baixa manual do financeiro).
create function privado.cobranca_confirmar(
  p_cobranca_id     uuid,
  p_valor_pago      integer,
  p_parcelas        integer,
  p_metodo          text,
  p_transaction_nsu text,
  p_invoice_slug    text,
  p_recibo          text,
  p_via             text
) returns jsonb
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_c       public.cobranca;
  v_k       public.contrato;
  v_f       public.familia;
  v_o       public.oportunidade;
  v_estagio public.estagio_p2;
  v_exec    uuid;
  v_semanas integer;
  v_urgente boolean := false;
  v_tarefa  uuid;
  v_chave   text;
  v_hoje    date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
begin
  select c.* into v_c from public.cobranca c where c.id = p_cobranca_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('mudou', false, 'motivo', 'cobranca_nao_encontrada');
  end if;
  select k.* into v_k from public.contrato k where k.id = v_c.contrato_id;
  select f.* into v_f from public.familia f where f.id = v_k.familia_id;

  if v_c.status = 'paga' then
    return pg_catalog.jsonb_build_object('mudou', false, 'motivo', 'ja_paga', 'cobranca_id', v_c.id);
  end if;
  if v_c.status in ('cancelada', 'estornada') then
    perform privado.venda_avisar('financeiro', 'alta',
      'Chegou um pagamento em cobrança ' || case v_c.status when 'cancelada' then 'cancelada' else 'estornada' end || ': confira antes de baixar',
      '/cobrancas/' || v_c.id::text);
    return pg_catalog.jsonb_build_object('mudou', false, 'motivo', 'cobranca_encerrada', 'cobranca_id', v_c.id);
  end if;
  if p_valor_pago is null or p_valor_pago < v_c.valor_centavos then
    perform privado.venda_avisar('financeiro', 'alta',
      'Chegou um pagamento abaixo do valor da cobrança: confira antes de baixar',
      '/cobrancas/' || v_c.id::text);
    return pg_catalog.jsonb_build_object('mudou', false, 'motivo', 'valor_divergente', 'cobranca_id', v_c.id);
  end if;

  -- O estágio do P2 é lido antes do update: o gatilho ao_pagar_cobranca (0021,
  -- P35) roda dentro dele, já leva o P2 a pagamento_confirmado, cria o
  -- acompanhamento e abre a consulta pré-natal. Sem esta leitura, o passo do
  -- P2 daqui deixaria de "andar" e a mensagem à família nunca sairia.
  v_o := privado.venda_oportunidade(v_f.id);
  v_estagio := v_o.estagio_p2;

  update public.cobranca c
     set status = 'paga',
         valor_pago_centavos = p_valor_pago,
         parcelas_cartao = p_parcelas,
         capture_method = p_metodo,
         transaction_nsu = coalesce(pg_catalog.left(p_transaction_nsu, 200), c.transaction_nsu),
         invoice_slug = coalesce(pg_catalog.left(p_invoice_slug, 200), c.invoice_slug),
         comprovante_url = p_recibo,
         pago_em = pg_catalog.now()
   where c.id = v_c.id;

  -- nota fiscal pendente para o P43 (uma por cobrança)
  if not exists (select 1 from public.nota_fiscal n where n.cobranca_id = v_c.id) then
    insert into public.nota_fiscal (cobranca_id, provider, status)
    values (v_c.id, coalesce(privado.venda_parametro('nfse_provedor') #>> '{}', 'a_definir'), 'pendente');
  end if;

  perform privado.venda_evento(v_f.id, 'cobranca',
    'Pagamento confirmado: ' || privado.formatar_reais(p_valor_pago::bigint),
    pg_catalog.jsonb_build_object('cobranca_id', v_c.id, 'valor_pago_centavos', p_valor_pago,
                                  'metodo', p_metodo, 'via', p_via));
  perform privado.venda_log('cobranca_baixada', 'cobranca', v_c.id::text, null,
    pg_catalog.jsonb_build_object('via', p_via, 'valor_pago_centavos', p_valor_pago, 'metodo', p_metodo,
                                  'parcelas_cartao', p_parcelas));

  perform privado.venda_andar_p2(v_f.id, 'cobranca_gerada', 'pagamento_confirmado', 'Pagamento confirmado');
  if v_estagio is distinct from 'cobranca_gerada' then
    return pg_catalog.jsonb_build_object('mudou', true, 'cobranca_id', v_c.id, 'prenatal_urgente', false);
  end if;

  -- automação pagamento_confirmado: a mensagem à família passa pelo freio
  v_o := privado.venda_oportunidade(v_f.id);
  v_exec := privado.venda_automacao_iniciar(v_f.id, 'pagamento_confirmado',
    pg_catalog.jsonb_build_object('cobranca_id', v_c.id, 'via', p_via));

  -- Urgência: quem decide é a consulta pré-natal que o gatilho ao_pagar_cobranca
  -- (0021, P35) abriu neste mesmo pagamento, pelo limite de
  -- parametro.prenatal_semanas_alerta (mais de 34 semanas, PRD 7.2 e 10.1). É
  -- ele que cria a tarefa de prioridade máxima e avisa a coordenação
  -- (prenatal_urgente); aqui só escolhe o texto da mensagem à família.
  if v_f.dpp is not null and v_f.data_nascimento is null then
    select i.semanas into v_semanas from public.ig(v_f.dpp, v_hoje) as i;
    v_urgente := coalesce((select cp.urgente from public.consulta_prenatal cp
                            where cp.familia_id = v_f.id and cp.status in ('pendente', 'agendada', 'realizada')), false);
  end if;

  if v_exec is not null then
    v_chave := case when v_urgente then 'pagamento_confirmado_34s' else 'pagamento_confirmado' end;
    v_tarefa := privado.venda_criar_tarefa(
      v_f.id, 'outro',
      'Avisar a ' || v_f.nome_exibicao || ' que o pagamento foi confirmado',
      v_o.responsavel_id, case when v_urgente then 'alta' else 'normal' end::public.prioridade, pg_catalog.now(),
      v_chave, pg_catalog.jsonb_build_object('semanas', v_semanas),
      'operacional',
      pg_catalog.jsonb_build_object('acao', 'pagamento_confirmado', 'cobranca_id', v_c.id));
    if v_tarefa is not null and v_o.responsavel_id is null then
      update public.tarefa t set papel_responsavel = 'comercial' where t.id = v_tarefa;
    end if;
    perform privado.venda_automacao_concluir(v_exec);
  end if;

  return pg_catalog.jsonb_build_object('mudou', true, 'cobranca_id', v_c.id, 'prenatal_urgente', v_urgente,
                                       'semanas', v_semanas);
end;
$$;
comment on function privado.cobranca_confirmar(uuid, integer, integer, text, text, text, text, text) is '[P32 itens 2 a 4] Único caminho de baixa. Idempotente (cobrança já paga não muda). Recusa, com aviso ao financeiro, pagamento em cobrança cancelada ou estornada e valor abaixo do da cobrança. Grava a baixa, deixa a nota fiscal pendente (P43), anda o P2 para pagamento_confirmado e, na primeira baixa do contrato, cria a tarefa com o texto pagamento_confirmado ou pagamento_confirmado_34s (freio). A consulta pré-natal, o acompanhamento e o pré-natal urgente (tarefa de prioridade máxima e aviso à coordenação) vêm do gatilho ao_pagar_cobranca (0021, P35). Sem grant.';


-- =============================================================================
-- 5. Contrato (P31): funções api
-- =============================================================================

create function api.contrato_situacao(familia_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_f          public.familia;
  v_k          public.contrato;
  v_o          public.oportunidade;
  v_etapa      text;
  v_comercial  boolean := privado.tem_papel('comercial') or privado.tem_papel('diretoria');
  v_financeiro boolean := privado.tem_papel('financeiro') or privado.tem_papel('diretoria');
  v_sensivel   boolean;
  v_gestante   public.pessoa;
  v_test       public.pessoa;
  v_kz         jsonb := privado.venda_parametro('contrato_kraamzorg');
  v_modelo     jsonb := privado.venda_parametro('contrato_modelo');
  v_cobrancas  jsonb;
begin
  perform privado.autorizar(array['comercial', 'financeiro', 'diretoria']::public.papel_usuario[], true);

  select f.* into v_f from public.familia f where f.id = contrato_situacao.familia_id;
  if not found then
    perform privado.venda_recusar('familia_inexistente');
  end if;
  v_k := privado.contrato_vivo(v_f.id);
  if not v_comercial and v_k.id is null then
    raise exception 'venda:sem_permissao financeiro só vê família com contrato (PRD 13)' using errcode = '42501';
  end if;
  v_o := privado.venda_oportunidade(v_f.id);
  v_etapa := privado.contrato_etapa(v_k);
  v_sensivel := v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') or v_f.nao_contatar;

  if v_k.id is not null then
    select p.* into v_gestante from public.pessoa p where p.id = v_k.contratante_pessoa_id;
    select p.* into v_test from public.pessoa p where p.id = v_k.testemunha_pessoa_id;
    select coalesce(pg_catalog.jsonb_agg(
             case when v_financeiro then
               pg_catalog.jsonb_build_object('id', c.id, 'parcela', c.parcela, 'vencimento', c.vencimento,
                 'status', c.status, 'pago_em', c.pago_em, 'valor_centavos', c.valor_centavos,
                 'tem_link', c.link_pagamento is not null)
             else
               pg_catalog.jsonb_build_object('parcela', c.parcela, 'vencimento', c.vencimento,
                 'status', c.status, 'pago_em', c.pago_em)
             end order by c.parcela, c.criado_em), '[]'::jsonb)
      into v_cobrancas
    from public.cobranca c where c.contrato_id = v_k.id;
  end if;

  return pg_catalog.jsonb_build_object(
    'familia', pg_catalog.jsonb_build_object('id', v_f.id, 'nome', v_f.nome_exibicao,
      'estado_sensivel', v_f.estado_sensivel, 'nao_contatar', v_f.nao_contatar),
    'oportunidade', case when v_o.id is not null then pg_catalog.jsonb_build_object(
      'id', v_o.id, 'estagio_p2', v_o.estagio_p2, 'para_quem', v_o.para_quem) end,
    'contrato', case when v_k.id is not null then pg_catalog.jsonb_build_object(
      'id', v_k.id,
      'status', v_k.status,
      'etapa', v_etapa,
      'template_versao', v_k.template_versao,
      'variante', case when v_o.para_quem = 'presente' then 'presente' else 'completa' end,
      'conta', case when v_comercial or v_financeiro then
                 privado.venda_conta(v_k.valor_centavos, v_k.taxa_deslocamento_centavos, v_k.desconto_centavos, v_k.parcelas) end,
      'pdf_gerado', v_k.pdf_path is not null,
      'formulario_recebido_em', case when privado.contrato_formulario_recebido(v_k) then v_k.formulario_expira_em end,
      'enviado_em', v_k.enviado_em,
      'assinado_em', v_k.assinado_em) end,
    'assinantes', case when v_k.id is not null then pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('papel', 'gestante', 'nome', v_gestante.nome,
        'email', privado.venda_email_mascarado(v_gestante.email), 'tem_contato', v_gestante.email is not null or v_gestante.telefone_e164 is not null),
      pg_catalog.jsonb_build_object('papel', 'kraamzorg', 'nome', v_kz ->> 'signatario_nome',
        'email', privado.venda_email_mascarado(v_kz ->> 'signatario_email'), 'tem_contato', coalesce(v_kz ->> 'signatario_email', '') <> ''))
      || case when v_test.id is not null then pg_catalog.jsonb_build_array(
           pg_catalog.jsonb_build_object('papel', 'testemunha', 'nome', v_test.nome,
             'email', privado.venda_email_mascarado(v_test.email), 'tem_contato', v_test.email is not null or v_test.telefone_e164 is not null))
         else '[]'::jsonb end
      else '[]'::jsonb end,
    'modelo', pg_catalog.jsonb_build_object(
      'versao', v_modelo ->> 'versao', 'aprovado', coalesce((v_modelo ->> 'aprovado')::boolean, false)),
    'cobrancas', coalesce(v_cobrancas, '[]'::jsonb),
    'pode_gerar', v_comercial and not v_sensivel and v_etapa in ('pronto_para_gerar', 'gerado'),
    'pode_enviar', v_comercial and not v_sensivel and v_etapa = 'gerado',
    'pode_ver_cobranca', v_financeiro,
    'sensivel', v_sensivel);
end;
$$;
comment on function api.contrato_situacao(uuid) is '[P31] O contrato da família para a tela: etapa (sem_proposta a assinado), quem assina (e-mail mascarado), versão e aprovação do modelo, variante presente e, para o comercial, só o status das cobranças (PRD 13, parcial). Comercial, financeiro (só com contrato) e diretoria, AAL2.';

create function api.dados_para_contrato(contrato_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_k       public.contrato;
  v_f       public.familia;
  v_o       public.oportunidade;
  v_pv      public.pacote_versao;
  v_pa      public.pacote;
  v_g       public.pessoa;
  v_gd      public.pessoa_dados_contrato;
  v_p       public.pessoa;
  v_pd      public.pessoa_dados_contrato;
  v_t       public.pessoa;
  v_modelo  jsonb := privado.venda_parametro('contrato_modelo');
  v_kz      jsonb := privado.venda_parametro('contrato_kraamzorg');
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], true);

  select k.* into v_k from public.contrato k where k.id = dados_para_contrato.contrato_id;
  if not found then
    perform privado.venda_recusar('contrato_inexistente');
  end if;
  if v_k.status not in ('aguardando_dados', 'gerado') or not privado.contrato_formulario_recebido(v_k) then
    perform privado.venda_recusar('formulario_pendente');
  end if;
  if v_k.enviado_em is not null then
    perform privado.venda_recusar('contrato_ja_enviado');
  end if;
  select f.* into v_f from public.familia f where f.id = v_k.familia_id;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') or v_f.nao_contatar then
    perform privado.venda_recusar('familia_em_estado_sensivel');
  end if;
  if v_modelo is null or pg_catalog.jsonb_typeof(v_modelo -> 'clausulas') <> 'array' then
    perform privado.venda_recusar('modelo_sem_cadastro');
  end if;

  v_o := privado.venda_oportunidade(v_f.id);
  select pv.* into v_pv from public.pacote_versao pv where pv.id = v_k.pacote_versao_id;
  select pa.* into v_pa from public.pacote pa where pa.id = v_pv.pacote_id;

  select p.* into v_g from public.pessoa p where p.id = v_k.contratante_pessoa_id;
  select d.* into v_gd from public.pessoa_dados_contrato d where d.pessoa_id = v_g.id;
  if v_g.id is null or v_gd.cpf is null or v_gd.data_nascimento is null or v_gd.endereco_residencial is null
     or v_g.email is null then
    perform privado.venda_recusar('dados_incompletos');
  end if;
  if v_k.pagador_pessoa_id is not null then
    select p.* into v_p from public.pessoa p where p.id = v_k.pagador_pessoa_id;
    select d.* into v_pd from public.pessoa_dados_contrato d where d.pessoa_id = v_p.id;
    if v_pd.cpf is null or v_pd.endereco_residencial is null then
      perform privado.venda_recusar('dados_incompletos');
    end if;
  end if;
  if v_k.testemunha_pessoa_id is not null then
    select p.* into v_t from public.pessoa p where p.id = v_k.testemunha_pessoa_id;
  end if;

  perform privado.registrar_leitura('pessoa_dados_contrato', v_g.id::text,
    pg_catalog.jsonb_build_object('funcao', 'api.dados_para_contrato', 'completo', true));
  if v_p.id is not null then
    perform privado.registrar_leitura('pessoa_dados_contrato', v_p.id::text,
      pg_catalog.jsonb_build_object('funcao', 'api.dados_para_contrato', 'completo', true));
  end if;

  return pg_catalog.jsonb_build_object(
    'contrato', pg_catalog.jsonb_build_object(
      'id', v_k.id,
      'variante', case when v_o.para_quem = 'presente' then 'presente' else 'completa' end,
      'valor_centavos', v_k.valor_centavos,
      'taxa_centavos', v_k.taxa_deslocamento_centavos,
      'desconto_centavos', v_k.desconto_centavos,
      'parcelas', v_k.parcelas,
      'conta', privado.venda_conta(v_k.valor_centavos, v_k.taxa_deslocamento_centavos, v_k.desconto_centavos, v_k.parcelas),
      'parcelas_max_sem_juros', v_pv.parcelas_max_sem_juros),
    'pacote', pg_catalog.jsonb_build_object('nome', v_pa.nome, 'linha', v_pa.linha, 'dias', v_pa.dias,
      'gemelar', v_pa.gemelar, 'horas_por_visita', v_pv.horas_por_visita),
    'familia', pg_catalog.jsonb_build_object('id', v_f.id, 'endereco_atendimento', v_f.endereco_atendimento),
    'contratante', pg_catalog.jsonb_build_object('nome', v_g.nome, 'email', v_g.email, 'cpf', v_gd.cpf,
      'data_nascimento', v_gd.data_nascimento, 'endereco', v_gd.endereco_residencial),
    'pagador', case when v_p.id is not null then pg_catalog.jsonb_build_object('nome', v_p.nome, 'email', v_p.email,
      'cpf', v_pd.cpf, 'endereco', v_pd.endereco_residencial) end,
    'testemunha', case when v_t.id is not null then pg_catalog.jsonb_build_object('nome', v_t.nome, 'email', v_t.email) end,
    'modelo', v_modelo,
    'kraamzorg', v_kz,
    'template_versao_atual', v_modelo ->> 'versao');
end;
$$;
comment on function api.dados_para_contrato(uuid) is '[P31 item 1] Tudo o que o PDF do contrato imprime, com CPF e endereço completos: só depois do formulário seguro recebido, antes do envio, em família sem freio. Grava a leitura de pessoa_dados_contrato no log de auditoria (uma linha por pessoa). Comercial e diretoria, AAL2.';

create function api.registrar_contrato_gerado(contrato_id uuid, pdf_path text, pdf_sha256 text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_k      public.contrato;
  v_modelo jsonb := privado.venda_parametro('contrato_modelo');
  v_primeira boolean;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select k.* into v_k from public.contrato k where k.id = registrar_contrato_gerado.contrato_id for update;
  if not found then
    perform privado.venda_recusar('contrato_inexistente');
  end if;
  if v_k.status not in ('aguardando_dados', 'gerado') or not privado.contrato_formulario_recebido(v_k) then
    perform privado.venda_recusar('formulario_pendente');
  end if;
  if v_k.enviado_em is not null then
    perform privado.venda_recusar('contrato_ja_enviado');
  end if;
  if registrar_contrato_gerado.pdf_path is distinct from privado.contrato_caminho_pdf(v_k.id, false) then
    perform privado.venda_recusar('caminho_pdf_invalido');
  end if;
  if registrar_contrato_gerado.pdf_sha256 is null or registrar_contrato_gerado.pdf_sha256 !~ '^[0-9a-f]{64}$' then
    perform privado.venda_recusar('pdf_sem_resumo');
  end if;
  if v_modelo ->> 'versao' is null then
    perform privado.venda_recusar('modelo_sem_cadastro');
  end if;

  v_primeira := v_k.status = 'aguardando_dados';
  update public.contrato k
     set status = 'gerado',
         pdf_path = registrar_contrato_gerado.pdf_path,
         template_versao = v_modelo ->> 'versao'
   where k.id = v_k.id;

  perform privado.venda_andar_p2(v_k.familia_id, 'ganho', 'contrato_gerado', 'Contrato gerado');

  perform privado.venda_evento(v_k.familia_id, 'contrato',
    case when v_primeira then 'Contrato gerado' else 'Contrato gerado de novo' end || ' (modelo ' || (v_modelo ->> 'versao') || ')',
    pg_catalog.jsonb_build_object('contrato_id', v_k.id, 'template_versao', v_modelo ->> 'versao'));
  perform privado.venda_log('contrato_gerado', 'contrato', v_k.id::text, null,
    pg_catalog.jsonb_build_object('template_versao', v_modelo ->> 'versao', 'pdf_sha256', registrar_contrato_gerado.pdf_sha256,
                                  'primeira_vez', v_primeira));
  return pg_catalog.jsonb_build_object('ok', true, 'contrato_id', v_k.id, 'status', 'gerado');
end;
$$;
comment on function api.registrar_contrato_gerado(uuid, text, text) is '[P31 itens 1 e 4] Guarda o caminho do PDF (contratos/<id>.pdf, nunca nome de paciente) e o resumo sha256 no log, grava a versão do modelo no contrato, passa o contrato a gerado e o P2 de ganho a contrato_gerado. Pode gerar de novo até o envio. Comercial e diretoria, AAL2.';

create function api.reservar_envio_contrato(contrato_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_k      public.contrato;
  v_f      public.familia;
  v_g      public.pessoa;
  v_t      public.pessoa;
  v_kz     jsonb := privado.venda_parametro('contrato_kraamzorg');
  v_modelo jsonb := privado.venda_parametro('contrato_modelo');
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], true);

  select k.* into v_k from public.contrato k where k.id = reservar_envio_contrato.contrato_id for update;
  if not found then
    perform privado.venda_recusar('contrato_inexistente');
  end if;
  if v_k.status <> 'gerado' or v_k.pdf_path is null then
    perform privado.venda_recusar('contrato_nao_gerado');
  end if;
  if v_k.autentique_doc_id is not null then
    perform privado.venda_recusar('contrato_ja_enviado');
  end if;
  if v_k.enviado_em is not null then
    perform privado.venda_recusar('envio_em_andamento');
  end if;
  select f.* into v_f from public.familia f where f.id = v_k.familia_id;
  if v_f.nao_contatar or not privado.freio_permite('operacional', v_f.estado_sensivel) then
    perform privado.venda_recusar('familia_em_estado_sensivel');
  end if;
  if coalesce(v_kz ->> 'signatario_nome', '') = '' or coalesce(v_kz ->> 'signatario_email', '') = '' then
    perform privado.venda_recusar('signatario_kraamzorg_sem_cadastro');
  end if;
  select p.* into v_g from public.pessoa p where p.id = v_k.contratante_pessoa_id;
  if v_g.email is null and v_g.telefone_e164 is null then
    perform privado.venda_recusar('gestante_sem_contato');
  end if;
  select p.* into v_t from public.pessoa p where p.id = v_k.testemunha_pessoa_id;

  update public.contrato k set enviado_em = pg_catalog.now() where k.id = v_k.id;

  perform privado.venda_log('contrato_envio_reservado', 'contrato', v_k.id::text, null, '{}'::jsonb);
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'contrato_id', v_k.id,
    'pdf_path', v_k.pdf_path,
    'nome_documento', 'Contrato de cuidado domiciliar ' || pg_catalog.left(v_k.id::text, 8),
    'modelo_versao', v_modelo ->> 'versao',
    'modelo_aprovado', coalesce((v_modelo ->> 'aprovado')::boolean, false),
    'gestante', pg_catalog.jsonb_build_object('nome', v_g.nome, 'email', v_g.email, 'telefone', v_g.telefone_e164),
    'testemunha', case when v_t.id is not null then
      pg_catalog.jsonb_build_object('nome', v_t.nome, 'email', v_t.email, 'telefone', v_t.telefone_e164) end,
    'kraamzorg', pg_catalog.jsonb_build_object('nome', v_kz ->> 'signatario_nome', 'email', v_kz ->> 'signatario_email'));
end;
$$;
comment on function api.reservar_envio_contrato(uuid) is '[P31 item 2] Primeiro passo do envio à Autentique: marca o contrato como em envio (enviado_em) para dois cliques ou duas abas nunca criarem dois documentos, e devolve o caminho do PDF, quem assina (gestante, Kraamzorg, testemunha) e se o modelo está aprovado. Recusa freio, não contatar, contrato não gerado, já enviado ou já em envio. Comercial e diretoria, AAL2.';

create function api.concluir_envio_contrato(contrato_id uuid, autentique_doc_id text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_k public.contrato;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select k.* into v_k from public.contrato k where k.id = concluir_envio_contrato.contrato_id for update;
  if not found then
    perform privado.venda_recusar('contrato_inexistente');
  end if;
  if v_k.status <> 'gerado' or v_k.enviado_em is null or v_k.autentique_doc_id is not null then
    perform privado.venda_recusar('envio_nao_reservado');
  end if;
  if concluir_envio_contrato.autentique_doc_id is null
     or concluir_envio_contrato.autentique_doc_id !~ '^[A-Za-z0-9_-]{8,100}$' then
    perform privado.venda_recusar('documento_invalido');
  end if;

  update public.contrato k
     set status = 'enviado', autentique_doc_id = concluir_envio_contrato.autentique_doc_id, enviado_em = pg_catalog.now()
   where k.id = v_k.id;
  perform privado.venda_andar_p2(v_k.familia_id, 'contrato_gerado', 'aguardando_assinatura', 'Contrato enviado para assinatura');

  perform privado.venda_evento(v_k.familia_id, 'contrato', 'Contrato enviado para assinatura pela Autentique',
    pg_catalog.jsonb_build_object('contrato_id', v_k.id));
  perform privado.venda_log('contrato_enviado', 'contrato', v_k.id::text, null,
    pg_catalog.jsonb_build_object('autentique_doc_id', concluir_envio_contrato.autentique_doc_id));
  return pg_catalog.jsonb_build_object('ok', true, 'contrato_id', v_k.id, 'status', 'enviado');
end;
$$;
comment on function api.concluir_envio_contrato(uuid, text) is '[P31 itens 2 e 4] Segundo passo: a Autentique criou o documento. Guarda o id, passa o contrato a enviado e o P2 a aguardando_assinatura. Comercial e diretoria, AAL2.';

create function api.liberar_envio_contrato(contrato_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_k public.contrato;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], true);
  select k.* into v_k from public.contrato k where k.id = liberar_envio_contrato.contrato_id for update;
  if not found then
    perform privado.venda_recusar('contrato_inexistente');
  end if;
  if v_k.status <> 'gerado' or v_k.enviado_em is null or v_k.autentique_doc_id is not null then
    perform privado.venda_recusar('envio_nao_reservado');
  end if;
  update public.contrato k set enviado_em = null where k.id = v_k.id;
  perform privado.venda_log('contrato_envio_liberado', 'contrato', v_k.id::text, null, '{}'::jsonb);
  return pg_catalog.jsonb_build_object('ok', true, 'contrato_id', v_k.id);
end;
$$;
comment on function api.liberar_envio_contrato(uuid) is '[P31 item 2] Desfaz a reserva do envio quando a Autentique recusou o documento (ou quando quem enviou confirmou no painel da Autentique que nada foi criado). Comercial e diretoria, AAL2.';


-- --- 5.1 Servidor: webhook da Autentique (só service_role) ---------------------------

create function public.contrato_do_documento(p_documento_id text) returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select pg_catalog.jsonb_build_object('id', k.id, 'status', k.status, 'familia_id', k.familia_id)
  from public.contrato k
  where p_documento_id is not null and k.autentique_doc_id = p_documento_id
$$;
comment on function public.contrato_do_documento(text) is '[P31 item 3] Acha o contrato pelo id do documento da Autentique. Só service_role (webhook, depois do segredo no caminho).';

create function public.contrato_registrar_assinatura(p_documento_id text, p_pdf_path text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_k    public.contrato;
  v_exec uuid;
  v_id   uuid;
begin
  select k.* into v_k from public.contrato k
  where p_documento_id is not null and k.autentique_doc_id = p_documento_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('mudou', false, 'motivo', 'contrato_nao_encontrado');
  end if;
  if v_k.status = 'assinado' then
    return pg_catalog.jsonb_build_object('mudou', false, 'motivo', 'ja_assinado', 'contrato_id', v_k.id);
  end if;
  if v_k.status <> 'enviado' then
    return pg_catalog.jsonb_build_object('mudou', false, 'motivo', 'estado_inesperado', 'contrato_id', v_k.id);
  end if;
  if p_pdf_path is not null and p_pdf_path is distinct from privado.contrato_caminho_pdf(v_k.id, true) then
    perform privado.venda_recusar('caminho_pdf_invalido');
  end if;
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'webhook', true);
  end if;

  update public.contrato k
     set status = 'assinado', assinado_em = pg_catalog.now(), pdf_path = coalesce(p_pdf_path, k.pdf_path)
   where k.id = v_k.id;
  -- a assinatura é o fato; se o PDF assinado não pôde ser guardado, o
  -- contrato assina do mesmo jeito e a equipe é avisada para guardar à mão
  if p_pdf_path is null then
    perform privado.venda_avisar('comercial', 'alta',
      'Contrato assinado, mas o PDF assinado não foi guardado: baixe na Autentique',
      '/familias/' || v_k.familia_id::text || '/contrato');
  end if;
  perform privado.venda_andar_p2(v_k.familia_id, 'aguardando_assinatura', 'assinado', 'Contrato assinado (Autentique)');
  perform privado.venda_evento(v_k.familia_id, 'contrato', 'Contrato assinado por todos',
    pg_catalog.jsonb_build_object('contrato_id', v_k.id));
  perform privado.venda_log('contrato_assinado', 'contrato', v_k.id::text, null,
    pg_catalog.jsonb_build_object('autentique_doc_id', p_documento_id));

  -- pos_assinatura (PRD 10.1): a cobrança nasce, sob o freio
  v_exec := privado.venda_automacao_iniciar(v_k.familia_id, 'pos_assinatura',
    pg_catalog.jsonb_build_object('contrato_id', v_k.id));
  if v_exec is not null then
    v_id := privado.cobranca_gerar(v_k.id);
    perform privado.venda_automacao_concluir(v_exec);
  else
    perform privado.venda_avisar('financeiro', 'alta',
      'Contrato assinado, mas a cobrança não foi gerada sozinha: confira com a coordenação antes de cobrar',
      '/familias/' || v_k.familia_id::text || '/contrato');
  end if;
  return pg_catalog.jsonb_build_object('mudou', true, 'contrato_id', v_k.id, 'cobranca_id', v_id);
end;
$$;
comment on function public.contrato_registrar_assinatura(text, text) is '[P31 itens 3 e 4, P32 item 1] Chamada pelo webhook da Autentique depois de reconsultar o documento pela API: contrato assinado (PDF assinado em contratos/<id>-assinado.pdf), P2 assinado, evento, e a automação pos_assinatura, que passa pelo freio e cria a cobrança (P2 cobranca_gerada). Sem o PDF assinado (nulo), o contrato assina do mesmo jeito e o comercial é avisado. Idempotente: contrato já assinado não muda. Só service_role.';


-- =============================================================================
-- 6. Cobrança (P32): funções api
-- =============================================================================

create function api.gerar_cobranca(contrato_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_k  public.contrato;
  v_id uuid;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select k.* into v_k from public.contrato k where k.id = gerar_cobranca.contrato_id for update;
  if not found then
    perform privado.venda_recusar('contrato_inexistente');
  end if;
  if v_k.status <> 'assinado' then
    perform privado.venda_recusar('contrato_nao_assinado');
  end if;
  v_id := privado.cobranca_gerar(v_k.id);
  return pg_catalog.jsonb_build_object('ok', true, 'cobranca_id', v_id);
end;
$$;
comment on function api.gerar_cobranca(uuid) is '[P32 item 1] Cobrança do contrato assinado feita por uma pessoa do financeiro, para quando a automação pos_assinatura foi freada ou está desligada. Idempotente. Financeiro e diretoria, AAL2.';

create function privado.cobranca_situacao(c public.cobranca) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select case
           when c.status = 'aberta' and c.vencimento < (pg_catalog.now() at time zone 'America/Sao_Paulo')::date then 'vencida'
           else c.status::text
         end
$$;
comment on function privado.cobranca_situacao(public.cobranca) is '[P32] Situação para a tela: aberta com vencimento passado aparece como vencida. Sem grant.';

create function api.cobrancas(situacao text default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_itens jsonb;
  v_resumo jsonb;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if cobrancas.situacao is not null and cobrancas.situacao not in ('aberta', 'vencida', 'paga', 'cancelada', 'estornada') then
    perform privado.venda_recusar('situacao_invalida');
  end if;

  with base as (
    select c.*, privado.cobranca_situacao(c) as sit, k.familia_id, f.nome_exibicao,
           (select n.status from public.nota_fiscal n where n.cobranca_id = c.id order by n.criado_em desc limit 1) as nota_status
    from public.cobranca c
    join public.contrato k on k.id = c.contrato_id
    join public.familia f on f.id = k.familia_id
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', b.id, 'contrato_id', b.contrato_id, 'familia_id', b.familia_id, 'familia_nome', b.nome_exibicao,
           'parcela', b.parcela, 'valor_centavos', b.valor_centavos, 'vencimento', b.vencimento,
           'situacao', b.sit, 'pago_em', b.pago_em, 'valor_pago_centavos', b.valor_pago_centavos,
           'capture_method', b.capture_method, 'parcelas_cartao', b.parcelas_cartao,
           'tem_link', b.link_pagamento is not null, 'nota_status', b.nota_status)
         order by (b.sit = 'paga'), b.vencimento, b.criado_em), '[]'::jsonb)
    into v_itens
  from (select * from base where cobrancas.situacao is null or base.sit = cobrancas.situacao limit 300) b;

  select pg_catalog.jsonb_build_object(
           'abertas', count(*) filter (where privado.cobranca_situacao(c) = 'aberta'),
           'vencidas', count(*) filter (where privado.cobranca_situacao(c) = 'vencida'),
           'pagas', count(*) filter (where c.status = 'paga'),
           'a_receber_centavos', coalesce(sum(c.valor_centavos) filter (where c.status in ('aberta', 'vencida')), 0),
           'recebido_centavos', coalesce(sum(c.valor_pago_centavos) filter (where c.status = 'paga'), 0))
    into v_resumo
  from public.cobranca c;

  return pg_catalog.jsonb_build_object('resumo', v_resumo, 'cobrancas', v_itens);
end;
$$;
comment on function api.cobrancas(text) is '[P32] Lista para o financeiro: cobranças com o nome da família, valor, vencimento, situação (aberta com vencimento passado vira vencida), método, parcelas do cartão, se tem link e o status da nota; mais o resumo (abertas, vencidas, pagas, a receber e recebido, em centavos). Filtro opcional por situação, no máximo 300 linhas. Financeiro e diretoria, AAL2.';

create function api.cobranca(cobranca_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_c   public.cobranca;
  v_k   public.contrato;
  v_f   public.familia;
  v_dados jsonb;
  v_nota  public.nota_fiscal;
  v_pag public.pessoa;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  select c.* into v_c from public.cobranca c where c.id = cobranca.cobranca_id;
  if not found then
    perform privado.venda_recusar('cobranca_inexistente');
  end if;
  select k.* into v_k from public.contrato k where k.id = v_c.contrato_id;
  select f.* into v_f from public.familia f where f.id = v_k.familia_id;
  select p.* into v_pag from public.pessoa p where p.id = coalesce(v_k.pagador_pessoa_id, v_k.contratante_pessoa_id);
  select n.* into v_nota from public.nota_fiscal n where n.cobranca_id = v_c.id order by n.criado_em desc limit 1;
  v_dados := privado.cobranca_dados_link(v_c.id);

  return pg_catalog.jsonb_build_object(
    'id', v_c.id,
    'contrato_id', v_k.id,
    'contrato_status', v_k.status,
    'familia_id', v_f.id,
    'familia_nome', v_f.nome_exibicao,
    'pagador_nome', v_pag.nome,
    'parcela', v_c.parcela,
    'valor_centavos', v_c.valor_centavos,
    'vencimento', v_c.vencimento,
    'situacao', privado.cobranca_situacao(v_c),
    'pago_em', v_c.pago_em,
    'valor_pago_centavos', v_c.valor_pago_centavos,
    'capture_method', v_c.capture_method,
    'parcelas_cartao', v_c.parcelas_cartao,
    'parcelas_contrato', v_k.parcelas,
    'parcelas_max', (v_dados ->> 'parcelas_max')::integer,
    'acima_do_limite', (v_dados ->> 'acima_do_limite')::boolean,
    'link_pagamento', v_c.link_pagamento,
    'comprovante', case when v_c.comprovante_url is null then null
                        when v_c.comprovante_url like 'comprovantes/%' then 'arquivo' else 'recibo' end,
    'recibo_url', case when v_c.comprovante_url like 'https://%' then v_c.comprovante_url end,
    'comprovante_path', case when v_c.comprovante_url like 'comprovantes/%' then v_c.comprovante_url end,
    'nota', case when v_nota.id is not null then pg_catalog.jsonb_build_object('status', v_nota.status, 'numero', v_nota.numero) end,
    'pode_gerar_link', v_c.status in ('aberta', 'vencida') and v_c.link_pagamento is null
                       and v_k.status = 'assinado' and not coalesce((v_dados ->> 'acima_do_limite')::boolean, false),
    'pode_baixar_manual', v_c.status in ('aberta', 'vencida') and v_k.status = 'assinado',
    'comprovante_max_bytes', privado.venda_numero('cobranca', 'comprovante_max_bytes'));
end;
$$;
comment on function api.cobranca(uuid) is '[P32] Detalhe da cobrança para o financeiro: situação, valores em centavos, link, método, parcelas do cartão, recibo, nota fiscal (status e número), e se dá para gerar o link ou baixar à mão. Financeiro e diretoria, AAL2.';

create function api.dados_link_pagamento(cobranca_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_d jsonb;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  v_d := privado.cobranca_dados_link(dados_link_pagamento.cobranca_id);
  if v_d is null then
    perform privado.venda_recusar('cobranca_inexistente');
  end if;
  if v_d ->> 'status' not in ('aberta', 'vencida') then
    perform privado.venda_recusar('cobranca_nao_aberta');
  end if;
  if (v_d ->> 'tem_link')::boolean then
    perform privado.venda_recusar('link_ja_gerado');
  end if;
  if (v_d ->> 'acima_do_limite')::boolean then
    perform privado.venda_recusar('parcelas_acima_do_limite', v_d ->> 'parcelas_max');
  end if;
  if not exists (select 1 from public.cobranca c join public.contrato k on k.id = c.contrato_id
                 where c.id = dados_link_pagamento.cobranca_id and k.status = 'assinado') then
    perform privado.venda_recusar('contrato_nao_assinado');
  end if;
  return v_d;
end;
$$;
comment on function api.dados_link_pagamento(uuid) is '[P32 item 1] O que o servidor precisa para pedir o link de uma cobrança sem link: valor em centavos, parcelas do cartão (do contrato, nunca acima do limite do pacote), descrição do item e o cliente. Sem CPF. Recusa contrato não assinado, cobrança paga ou cancelada e parcelamento acima do limite. Financeiro e diretoria, AAL2.';

create function api.registrar_link_pagamento(cobranca_id uuid, url text, slug text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return privado.cobranca_gravar_link(registrar_link_pagamento.cobranca_id, registrar_link_pagamento.url,
                                      registrar_link_pagamento.slug);
end;
$$;
comment on function api.registrar_link_pagamento(uuid, text, text) is '[P32 item 1] Guarda o link que a InfinitePay devolveu e cria a tarefa com o texto link_pagamento. Financeiro e diretoria, AAL2.';

create function api.baixar_cobranca_manual(
  cobranca_id           uuid,
  valor_pago_centavos   integer,
  comprovante_path      text,
  motivo                text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_c      public.cobranca;
  v_motivo text := privado.campo_livre(baixar_cobranca_manual.motivo);
  v_r      jsonb;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select c.* into v_c from public.cobranca c where c.id = baixar_cobranca_manual.cobranca_id for update;
  if not found then
    perform privado.venda_recusar('cobranca_inexistente');
  end if;
  if v_c.status not in ('aberta', 'vencida') then
    perform privado.venda_recusar('cobranca_nao_aberta');
  end if;
  if not exists (select 1 from public.contrato k where k.id = v_c.contrato_id and k.status = 'assinado') then
    perform privado.venda_recusar('contrato_nao_assinado');
  end if;
  if v_motivo is null or pg_catalog.length(v_motivo) < 10 then
    perform privado.venda_recusar('motivo_obrigatorio');
  end if;
  if baixar_cobranca_manual.comprovante_path is null
     or baixar_cobranca_manual.comprovante_path !~ ('^comprovantes/' || v_c.id::text || '-[a-z0-9]{8,32}\.(pdf|png|jpg|jpeg)$') then
    perform privado.venda_recusar('comprovante_obrigatorio');
  end if;
  if baixar_cobranca_manual.valor_pago_centavos is null or baixar_cobranca_manual.valor_pago_centavos < v_c.valor_centavos then
    perform privado.venda_recusar('valor_menor_que_a_cobranca');
  end if;

  v_r := privado.cobranca_confirmar(v_c.id, baixar_cobranca_manual.valor_pago_centavos, null, 'pix', null, null,
                                    baixar_cobranca_manual.comprovante_path, 'manual');
  perform privado.venda_log('cobranca_baixa_manual', 'cobranca', v_c.id::text, null,
    pg_catalog.jsonb_build_object('motivo', v_motivo, 'valor_pago_centavos', baixar_cobranca_manual.valor_pago_centavos,
                                  'comprovante', baixar_cobranca_manual.comprovante_path));
  return v_r;
end;
$$;
comment on function api.baixar_cobranca_manual(uuid, integer, text, text) is '[P32 item 4] Baixa de Pix recebido fora do sistema: exige o comprovante (arquivo em comprovantes/<cobranca>-<código>.<pdf|png|jpg>), o motivo (10 caracteres ou mais, vai para o log de auditoria) e valor igual ou maior que o da cobrança. Faz o mesmo que o webhook (P2, nota fiscal pendente, tarefas). Financeiro e diretoria, AAL2.';


-- --- 6.1 Servidor: link e webhook da InfinitePay (só service_role) -------------------

create function public.cobrancas_sem_link(p_contrato_id uuid) returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select coalesce(pg_catalog.jsonb_agg(privado.cobranca_dados_link(c.id) order by c.parcela, c.criado_em), '[]'::jsonb)
  from public.cobranca c
  where c.contrato_id = p_contrato_id and c.status in ('aberta', 'vencida') and c.link_pagamento is null
$$;
comment on function public.cobrancas_sem_link(uuid) is '[P32 item 1] Cobranças abertas do contrato que ainda não têm link, com o que o servidor precisa para pedir à InfinitePay (sem CPF). Só service_role.';

create function public.cobranca_registrar_link(p_cobranca_id uuid, p_url text, p_slug text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'webhook', true);
  end if;
  return privado.cobranca_gravar_link(p_cobranca_id, p_url, p_slug);
end;
$$;
comment on function public.cobranca_registrar_link(uuid, text, text) is '[P32 item 1] Guarda o link de pagamento que o servidor pediu à InfinitePay e cria a tarefa link_pagamento. Só service_role.';

create function public.cobranca_avisar_falha_link(p_cobranca_id uuid, p_motivo text) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  if not exists (select 1 from public.cobranca c where c.id = p_cobranca_id) then
    return;
  end if;
  perform privado.venda_avisar('financeiro', 'alta',
    case when p_motivo = 'acima_do_limite'
         then 'Parcelamento acima do limite do link de pagamento: combine a cobrança à mão'
         else 'O link de pagamento não saiu: gere de novo na cobrança' end,
    '/cobrancas/' || p_cobranca_id::text);
end;
$$;
comment on function public.cobranca_avisar_falha_link(uuid, text) is '[P32] Avisa o financeiro quando o link não pôde ser gerado (falha da InfinitePay ou parcelamento acima do limite). O título nunca leva nome de paciente. Só service_role.';

create function public.cobranca_do_pedido(p_order_nsu text) returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select pg_catalog.jsonb_build_object('id', c.id, 'status', c.status, 'valor_centavos', c.valor_centavos)
  from public.cobranca c
  where p_order_nsu is not null and c.external_id = p_order_nsu
$$;
comment on function public.cobranca_do_pedido(text) is '[P32 item 2] Acha a cobrança pelo order_nsu (external_id). Só service_role.';

create function public.cobranca_baixar(
  p_order_nsu       text,
  p_valor_pago      integer,
  p_parcelas        integer,
  p_metodo          text,
  p_transaction_nsu text,
  p_invoice_slug    text,
  p_recibo_url      text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_id uuid;
begin
  select c.id into v_id from public.cobranca c where p_order_nsu is not null and c.external_id = p_order_nsu;
  if v_id is null then
    return pg_catalog.jsonb_build_object('mudou', false, 'motivo', 'cobranca_nao_encontrada');
  end if;
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'webhook', true);
  end if;
  return privado.cobranca_confirmar(v_id, p_valor_pago, p_parcelas, p_metodo, p_transaction_nsu, p_invoice_slug,
    case when p_recibo_url ~ '^https://[^[:space:]]+$' and pg_catalog.length(p_recibo_url) <= 500 then p_recibo_url end,
    'webhook');
end;
$$;
comment on function public.cobranca_baixar(text, integer, integer, text, text, text, text) is '[P32 itens 2 e 3] Baixa vinda do webhook da InfinitePay, chamada só depois do payment_check (valor pago e método vêm dele, nunca do corpo do POST). Idempotente. Só service_role.';


-- =============================================================================
-- 7. Execute (ADR 0002 seção 6): api só para authenticated; as de servidor só
--    para service_role; privado sem grant.
-- =============================================================================

revoke execute on function privado.venda_automacao_iniciar(uuid, text, jsonb)                 from public, anon, authenticated, service_role;
revoke execute on function privado.venda_automacao_concluir(uuid)                             from public, anon, authenticated, service_role;
revoke execute on function privado.venda_avisar(public.papel_usuario, public.prioridade, text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.venda_email_mascarado(text)                                from public, anon, authenticated, service_role;
revoke execute on function privado.venda_estagio_p2(uuid)                                     from public, anon, authenticated, service_role;
revoke execute on function privado.venda_andar_p2(uuid, text, text, text)                     from public, anon, authenticated, service_role;
revoke execute on function privado.contrato_vivo(uuid)                                        from public, anon, authenticated, service_role;
revoke execute on function privado.contrato_formulario_recebido(public.contrato)              from public, anon, authenticated, service_role;
revoke execute on function privado.contrato_etapa(public.contrato)                            from public, anon, authenticated, service_role;
revoke execute on function privado.contrato_caminho_pdf(uuid, boolean)                        from public, anon, authenticated, service_role;
revoke execute on function privado.cobranca_gerar(uuid)                                       from public, anon, authenticated, service_role;
revoke execute on function privado.cobranca_gravar_link(uuid, text, text)                     from public, anon, authenticated, service_role;
revoke execute on function privado.cobranca_dados_link(uuid)                                  from public, anon, authenticated, service_role;
revoke execute on function privado.cobranca_confirmar(uuid, integer, integer, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.cobranca_situacao(public.cobranca)                         from public, anon, authenticated, service_role;

revoke execute on function api.contrato_situacao(uuid)                                        from public, anon, service_role;
revoke execute on function api.dados_para_contrato(uuid)                                      from public, anon, service_role;
revoke execute on function api.registrar_contrato_gerado(uuid, text, text)                    from public, anon, service_role;
revoke execute on function api.reservar_envio_contrato(uuid)                                  from public, anon, service_role;
revoke execute on function api.concluir_envio_contrato(uuid, text)                            from public, anon, service_role;
revoke execute on function api.liberar_envio_contrato(uuid)                                   from public, anon, service_role;
revoke execute on function api.gerar_cobranca(uuid)                                           from public, anon, service_role;
revoke execute on function api.cobrancas(text)                                                from public, anon, service_role;
revoke execute on function api.cobranca(uuid)                                                 from public, anon, service_role;
revoke execute on function api.dados_link_pagamento(uuid)                                     from public, anon, service_role;
revoke execute on function api.registrar_link_pagamento(uuid, text, text)                     from public, anon, service_role;
revoke execute on function api.baixar_cobranca_manual(uuid, integer, text, text)              from public, anon, service_role;

grant execute on function api.contrato_situacao(uuid)                                         to authenticated;
grant execute on function api.dados_para_contrato(uuid)                                       to authenticated;
grant execute on function api.registrar_contrato_gerado(uuid, text, text)                     to authenticated;
grant execute on function api.reservar_envio_contrato(uuid)                                   to authenticated;
grant execute on function api.concluir_envio_contrato(uuid, text)                             to authenticated;
grant execute on function api.liberar_envio_contrato(uuid)                                    to authenticated;
grant execute on function api.gerar_cobranca(uuid)                                            to authenticated;
grant execute on function api.cobrancas(text)                                                 to authenticated;
grant execute on function api.cobranca(uuid)                                                  to authenticated;
grant execute on function api.dados_link_pagamento(uuid)                                      to authenticated;
grant execute on function api.registrar_link_pagamento(uuid, text, text)                      to authenticated;
grant execute on function api.baixar_cobranca_manual(uuid, integer, text, text)               to authenticated;

revoke execute on function public.contrato_do_documento(text)                                 from public, anon, authenticated;
revoke execute on function public.contrato_registrar_assinatura(text, text)                   from public, anon, authenticated;
revoke execute on function public.cobrancas_sem_link(uuid)                                    from public, anon, authenticated;
revoke execute on function public.cobranca_registrar_link(uuid, text, text)                   from public, anon, authenticated;
revoke execute on function public.cobranca_avisar_falha_link(uuid, text)                      from public, anon, authenticated;
revoke execute on function public.cobranca_do_pedido(text)                                    from public, anon, authenticated;
revoke execute on function public.cobranca_baixar(text, integer, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.contrato_do_documento(text)                                  to service_role;
grant execute on function public.contrato_registrar_assinatura(text, text)                    to service_role;
grant execute on function public.cobrancas_sem_link(uuid)                                     to service_role;
grant execute on function public.cobranca_registrar_link(uuid, text, text)                    to service_role;
grant execute on function public.cobranca_avisar_falha_link(uuid, text)                       to service_role;
grant execute on function public.cobranca_do_pedido(text)                                     to service_role;
grant execute on function public.cobranca_baixar(text, integer, integer, text, text, text, text) to service_role;


-- =============================================================================
-- 8. Trava (falha a migration se quebrar)
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
  where n.nspname = 'public'
    and (p.proname like 'contrato\_%' or p.proname like 'cobranca\_%' or p.proname like 'cobrancas\_%')
    and (not p.prosecdef
         or not coalesce(p.proconfig @> array['search_path=""'], false)
         or has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
         or not has_function_privilege('service_role', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função de servidor de contrato e cobrança fora da regra (security definer, search_path vazio, só service_role): %', v_lista;
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
