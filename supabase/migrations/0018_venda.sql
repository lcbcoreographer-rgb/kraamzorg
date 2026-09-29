-- =============================================================================
-- 0018_venda.sql
--
-- P29 (sessão de venda) e P30 (proposta, condições comerciais e formulário
-- seguro) · PROMPTS.md v2 · PRD 4 (D-04, D-15, D-16), 6.2
-- (pessoa_dados_contrato), 6.3 (sessao_venda, sessao_venda_gravacao,
-- condicao_comercial, contrato), 7.1 e 7.2, 8.2, 10.1 (lembrete_sessao,
-- contrato_fechado), 13, 14 (transcrição), 21.3 (formulários públicos),
-- 22.2 (C-04, C-05, C-10, C-13) e 23.2 (textos das tarefas).
--
-- Esta migration NÃO foi aplicada em ambiente nenhum: escrita, testada no
-- banco local (supabase/sem-docker) e parada para revisão humana do SQL
-- (CLAUDE.md). Nenhum dado aqui: parâmetros e textos novos ficam no
-- seed.sql, em rascunho.
--
-- Sessão de venda (P29):
--   1. sessao_venda deixa de aceitar insert e mudança de agenda e estado
--      direto do app: agendar, remarcar e registrar o desfecho andam junto
--      com o P1, as tarefas e a transferência, numa transação só. O que o
--      app ainda edita direto: link, opções informadas e parceiro presente.
--   2. api.condutores_sessao_venda(): quem pode conduzir (coordenação e
--      diretoria ativas), com o nome, para a tela de agendar.
--   3. api.sessoes_venda(desde, ate, familia_id, sessao_id): a agenda, com o
--      nome da família e de quem conduz (perfil não tem leitura cruzada
--      pela RLS) e, por linha, se quem pede pode ver a gravação.
--   4. api.agendar_sessao_venda(...): cria a sessão, move o P1 para
--      sessao_venda_agendada, cria a tarefa do lembrete da véspera (texto
--      lembrete_sessao, 23.2) e fecha a transferência "reuniao" de onde veio
--      com o desfecho sessao_marcada, sem devolver a conversa à Isadora.
--   5. api.remarcar_sessao_venda(...): a sessão antiga vira remarcada, nasce
--      outra agendada, o lembrete antigo é cancelado e nasce o novo.
--   6. api.registrar_desfecho_sessao_venda(...): realizada (P1 para
--      sessao_venda_realizada e tarefa pos_sessao_48h depois de
--      parametro.sessao_venda_retorno_horas), não compareceu (P1 volta para
--      qualificado e tarefa nao_compareceu) ou cancelada (P1 volta para
--      qualificado).
--   7. api.registrar_gravacao_sessao_venda(...) e
--      api.salvar_resumo_sessao_venda(...): consentimento com a versão do
--      termo (parametro.sessao_gravacao), transcrição colada e resumo
--      estruturado. Só quem conduziu e a diretoria, em AAL2, com log.
--
-- Proposta e formulário seguro (P30):
--   8. api.proposta(oportunidade_id): pacotes vigentes, condições ativas,
--      taxa da cidade, pessoas da família e o contrato em rascunho, com a
--      situação do formulário (nunca o token nem o hash).
--   9. api.salvar_proposta(...): calcula no banco (valor da versão vigente,
--      taxa da cidade, desconto da condição ou manual, parcelas dentro do
--      limite) e grava o contrato em rascunho; a primeira proposta passa a
--      oportunidade para o P2 (proposta_enviada). Desconto e condição com
--      requer_aprovacao ficam pendentes até a diretoria aprovar.
--  10. api.aprovar_desconto(oportunidade_id): só diretoria, AAL2, com log.
--  11. api.gerar_link_formulario_contrato(oportunidade_id): leva o P2 até
--      ganho, gera um token de uso único (32 bytes aleatórios), guarda só o
--      sha256 dele em contrato.formulario_token_hash, a validade em
--      parametro.formulario_contrato, e cria a tarefa
--      enviar_formulario_contrato (texto formulario_contrato, 23.2). O
--      token volta uma vez, para a tela montar o link; nunca é gravado.
--  12. public.formulario_contrato_abrir(token, origem) e
--      public.formulario_contrato_enviar(token, dados, origem): a rota
--      pública /formulario/[token] não tem usuário. O servidor do app
--      confere o Turnstile e chama estas duas pelo cliente de serviço
--      (motivo formulario_contrato), único papel com execute. Limite de
--      tentativas por origem (HMAC do IP com a chave do Vault) e por
--      contrato em privado.formulario_tentativa. CPF validado de novo aqui
--      (privado.cpf_valido); nada de CPF sai destas funções, nem no erro.
--
-- Papéis e AAL (ADR 0002, seções 5 e 6, linhas acrescentadas):
--   condutores_sessao_venda, sessoes_venda    comercial, coordenação,
--                                             diretoria; regra do perfil
--   agendar, remarcar, registrar_desfecho     comercial, diretoria (donos do
--                                             P1); regra do perfil
--   registrar_gravacao, salvar_resumo         quem conduziu (comercial ou
--                                             coordenação) e diretoria; AAL2
--   proposta                                  comercial, financeiro,
--                                             diretoria; AAL2 (contrato é
--                                             tabela financeira, PRD 13)
--   salvar_proposta, gerar_link_formulario    comercial, diretoria; AAL2
--   aprovar_desconto                          diretoria; AAL2
--   public.formulario_contrato_*              só service_role (servidor)
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura; registradas no
-- relatório docs/sessoes/P29-P30.md):
--   * O link da reunião é obrigatório para agendar: o lembrete da véspera
--     leva o acesso, e um lembrete com "{link}" vazio não serve.
--   * "Véspera" continua regra estrutural (0012): o lembrete vence 24 horas
--     antes da conversa. Conversa marcada para hoje não ganha lembrete. A
--     tarefa nasce no agendamento, com o texto já preenchido (nome, hora,
--     link), e a execução de lembrete_sessao é registrada como executada
--     para o motor (0012) não criar uma segunda tarefa na véspera. Com a
--     automação desligada, nada de lembrete.
--   * Tarefa com texto para a família só nasce se o freio deixa a
--     categoria passar (lembrete e não compareceu: operacional; retorno
--     depois da conversa: conteudo) e a família não pediu para não ser
--     contatada. Sessão não se marca para família em bloqueio_total ou
--     encerrado_sensivel.
--   * Desfecho (realizada, não compareceu, cancelada) é do comercial e da
--     diretoria, que respondem pelo P1 (0006: papel_minimo comercial). A
--     coordenação conduz, lê a agenda e cuida da gravação.
--   * Retirar o consentimento apaga transcrição e resumo na hora.
--   * Proposta: o desconto incide sobre o valor do pacote, não sobre a
--     taxa de deslocamento [confirmar: Leonardo]. Parcelas acima de
--     pacote_versao.parcelas_max_sem_juros só por condição de parcelamento
--     cadastrada; condição ou desconto manual com aprovação só seguem para
--     o formulário depois da aprovação da diretoria. Mudar pacote,
--     condição, desconto ou parcelas depois da aprovação apaga a aprovação.
--   * Presente (C-10): quem paga é outra pessoa da família (ou nasce aqui,
--     papel presenteador); o contrato continua no nome da gestante.
--   * Formulário: o token consumido some (hash nulo) e formulario_expira_em
--     passa a guardar o instante do envio; assim "recebido", "aguardando",
--     "vencido" e "não enviado" saem das duas colunas do PRD, sem coluna
--     nova. contrato.status fica em aguardando_dados até o P31 gerar o PDF.
--   * Link vencido, usado ou inexistente recebem a mesma resposta
--     ("invalido"): quem não tem o link certo não descobre nada.
--   * Família em bloqueio_total ou encerrado_sensivel: o link não abre nem
--     recebe (a mesma resposta "invalido", sem contar tentativa). O freio
--     só deixa contato humano e nominal (PRD 8.1) [confirmar: Leonardo].
--
-- Nenhum preço, prazo, texto ou limite no SQL: valores vêm de
-- pacote_versao, condicao_comercial e cidade; prazos e limites de
-- parametro; textos de mensagem_modelo. Títulos de tarefa e evento são
-- texto interno da equipe, como os do freio (0009).
-- =============================================================================


-- =============================================================================
-- 1. sessao_venda: agenda e estado só por função (P29 itens 1 e 2)
-- =============================================================================

revoke insert on public.sessao_venda from authenticated;
revoke update on public.sessao_venda from authenticated;
grant update (opcoes_informadas, link_reuniao, parceiro_presente) on public.sessao_venda to authenticated;

-- O link e as opções continuam editáveis direto (grant acima), então a
-- regra das funções mora também na tabela: link só https, sem espaço, até
-- 500 caracteres (um "javascript:" gravado direto viraria link clicável na
-- tela da sessão), e as opções no tamanho de privado.campo_livre.
alter table public.sessao_venda
  add constraint sessao_venda_link_reuniao_https
    check (link_reuniao is null
           or (link_reuniao ~ '^https://[^[:space:]]+$' and pg_catalog.length(link_reuniao) <= 500)),
  add constraint sessao_venda_opcoes_informadas_tamanho
    check (opcoes_informadas is null or pg_catalog.length(opcoes_informadas) <= 200);

comment on table public.sessao_venda is 'Conversa de orientação com a Edilaine (PRD 6.3): agenda e desfecho. A gravação e a transcrição ficam em sessao_venda_gravacao, tabela separada, com RLS mais restrita. [P29] Agendar, remarcar e registrar o desfecho só pelas funções api.*_sessao_venda (0018), que movem o P1 e criam as tarefas na mesma transação.';


-- =============================================================================
-- 2. privado.formulario_tentativa: limite de tentativas do formulário
--    público (PRD 21.3). Técnica, sem grant, lida e escrita só pelas funções
--    do formulário. A origem é o HMAC do IP (chave do Vault), nunca o IP.
-- =============================================================================

create table privado.formulario_tentativa (
  id          bigserial primary key,
  criado_em   timestamptz not null default now(),
  origem_hmac text not null,
  contrato_id uuid references public.contrato(id) on delete cascade,
  motivo      text not null check (motivo in ('link_invalido', 'dados_invalidos'))
);
comment on table privado.formulario_tentativa is '[P30] Tentativas recusadas do formulário seguro (PRD 21.3, limite de taxa): origem em HMAC-SHA256 do IP com a chave auditoria_hmac do Vault, contrato quando o link era válido. Janela e máximo em parametro.formulario_contrato. Linhas mais velhas que duas janelas são apagadas pela própria função. Sem grant.';

create index on privado.formulario_tentativa (origem_hmac, criado_em);
create index on privado.formulario_tentativa (contrato_id, criado_em);

alter table privado.formulario_tentativa enable row level security;
revoke all on privado.formulario_tentativa from public, anon, authenticated, service_role;


-- =============================================================================
-- 3. Auxiliares (privado, sem grant)
-- =============================================================================

-- --- parâmetros ------------------------------------------------------------------
create function privado.venda_parametro(chave text) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$ select p.valor from public.parametro p where p.chave = venda_parametro.chave $$;
comment on function privado.venda_parametro(text) is '[P29/P30] Valor de um parâmetro (jsonb), nulo se não existe. Sem grant.';

-- Número de um parâmetro: a raiz (campo nulo) ou um campo do objeto.
create function privado.venda_numero(chave text, campo text default null) returns numeric
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v jsonb := privado.venda_parametro(venda_numero.chave);
begin
  if venda_numero.campo is not null then
    v := v -> venda_numero.campo;
  end if;
  if v is null or pg_catalog.jsonb_typeof(v) <> 'number' then
    return null;
  end if;
  return (v #>> '{}')::numeric;
end;
$$;
comment on function privado.venda_numero(text, text) is '[P29/P30] Número de parametro.valor (ou de um campo dele); nulo se ausente ou se não for número. Sem grant.';

-- Erro de negócio com um código que a tela traduz em frase (venda:<código>).
create function privado.venda_recusar(codigo text, detalhe text default null) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
begin
  raise exception 'venda:% %', venda_recusar.codigo, coalesce(venda_recusar.detalhe, '')
    using errcode = 'P0001';
end;
$$;
comment on function privado.venda_recusar(text, text) is '[P29/P30] Recusa de negócio: erro P0001 com a mensagem "venda:<código> <detalhe>", que a tela troca por uma frase. O detalhe nunca leva dado pessoal. Sem grant.';

-- --- pessoas ---------------------------------------------------------------------
-- A gestante da família: papel mae, contato principal primeiro.
create function privado.venda_gestante(familia_id uuid) returns public.pessoa
  language sql
  stable
  set search_path = ''
  as $$
  select p.*
  from public.pessoa p
  where p.familia_id = venda_gestante.familia_id and p.papel = 'mae'
  order by p.contato_principal desc, p.criado_em, p.id
  limit 1
$$;
comment on function privado.venda_gestante(uuid) is '[P30] Pessoa que recebe o cuidado (papel mae), contato principal primeiro. Sem grant.';

-- Contato principal (para o telefone da tarefa e o primeiro nome do texto).
create function privado.venda_contato(familia_id uuid) returns public.pessoa
  language sql
  stable
  set search_path = ''
  as $$
  select p.*
  from public.pessoa p
  where p.familia_id = venda_contato.familia_id
  order by p.contato_principal desc, (p.papel = 'mae') desc, p.criado_em, p.id
  limit 1
$$;
comment on function privado.venda_contato(uuid) is '[P29/P30] Contato principal da família (mae antes das outras). Sem grant.';

create function privado.venda_primeiro_nome(nome text) returns text
  language plpgsql
  immutable
  set search_path = ''
  as $$
declare
  v text := pg_catalog.split_part(pg_catalog.btrim(coalesce(venda_primeiro_nome.nome, '')), ' ', 1);
begin
  if v ~ '^[[:alpha:]]' then
    return pg_catalog.regexp_replace(v, '[^[:alpha:]''-]+$', '');
  end if;
  return null;
end;
$$;
comment on function privado.venda_primeiro_nome(text) is '[P29/P30] Primeira palavra do nome, só se começar por letra (mesma regra de privado.agente_primeiro_nome). Sem grant.';

create function privado.venda_nome_perfil(perfil_id uuid) returns text
  language sql
  stable
  security definer
  set search_path = ''
  as $$ select p.nome from public.perfil p where p.id = venda_nome_perfil.perfil_id $$;
comment on function privado.venda_nome_perfil(uuid) is '[P29/P30] Nome do perfil (a RLS de perfil só deixa ler o próprio). Sem grant.';

-- --- tarefas ---------------------------------------------------------------------
-- Tarefa com texto sugerido para a família (PRD 23.2). Devolve nulo, sem
-- criar nada, quando o freio não deixa a categoria passar ou a família
-- pediu para não ser contatada: a tarefa é de mensagem, e sem mensagem ela
-- não tem o que fazer. O texto vem de mensagem_modelo com as variáveis
-- preenchidas (privado.aplicar_texto); sem o modelo, a tarefa nasce sem
-- texto.
create function privado.venda_criar_tarefa(
  familia_id     uuid,
  tipo           public.tipo_tarefa,
  titulo         text,
  responsavel_id uuid,
  prioridade     public.prioridade,
  vence_em       timestamptz,
  chave_mensagem text,
  variaveis      jsonb,
  categoria      public.categoria_automacao,
  extra          jsonb default '{}'
) returns uuid
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_f       public.familia;
  v_contato public.pessoa;
  v_texto   text;
  v_id      uuid;
begin
  select f.* into v_f from public.familia f where f.id = venda_criar_tarefa.familia_id;
  if not found then
    return null;
  end if;
  if v_f.nao_contatar or not privado.freio_permite(venda_criar_tarefa.categoria, v_f.estado_sensivel) then
    return null;
  end if;

  v_contato := privado.venda_contato(v_f.id);

  if venda_criar_tarefa.chave_mensagem is not null then
    select privado.aplicar_texto(m.texto, privado.venda_primeiro_nome(v_contato.nome), venda_criar_tarefa.variaveis)
      into v_texto
    from public.mensagem_modelo m
    where m.chave = venda_criar_tarefa.chave_mensagem;
  end if;

  insert into public.tarefa (tipo, familia_id, responsavel_id, prioridade, titulo, payload, vence_em)
  values (
    venda_criar_tarefa.tipo,
    v_f.id,
    venda_criar_tarefa.responsavel_id,
    venda_criar_tarefa.prioridade,
    venda_criar_tarefa.titulo,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'mensagemChave', venda_criar_tarefa.chave_mensagem,
      'textoSugerido', v_texto,
      'telefoneE164', v_contato.telefone_e164,
      'categoria', venda_criar_tarefa.categoria)) || coalesce(venda_criar_tarefa.extra, '{}'),
    venda_criar_tarefa.vence_em
  )
  returning id into v_id;
  return v_id;
end;
$$;
comment on function privado.venda_criar_tarefa(uuid, public.tipo_tarefa, text, uuid, public.prioridade, timestamptz, text, jsonb, public.categoria_automacao, jsonb) is '[P29/P30] Cria tarefa com texto sugerido de mensagem_modelo (PRD 23.2) e o telefone do contato principal. Nulo sem criar nada quando o freio não deixa a categoria passar ou a família está em não contatar. Sem grant.';

create function privado.venda_cancelar_tarefas_sessao(sessao_id uuid) returns integer
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_n integer;
begin
  update public.tarefa t
     set status = 'cancelada'
   where t.payload ->> 'sessao_venda_id' = venda_cancelar_tarefas_sessao.sessao_id::text
     and t.payload ->> 'mensagemChave' = 'lembrete_sessao'
     and t.status in ('aberta', 'em_andamento');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
comment on function privado.venda_cancelar_tarefas_sessao(uuid) is '[P29] Cancela o lembrete ainda aberto de uma sessão (remarcada, cancelada, realizada ou não compareceu). Sem grant.';

-- Lembrete da véspera (PRD 10.1, 23.2): vence 24 horas antes; conversa de
-- hoje não tem véspera. Registra a execução de lembrete_sessao como
-- executada, para privado.materializar_lembrete_sessao (0012) não duplicar.
create function privado.venda_criar_lembrete(sessao_id uuid, responsavel_id uuid) returns uuid
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_s     public.sessao_venda;
  v_nome  text;
  v_id    uuid;
begin
  select s.* into v_s from public.sessao_venda s where s.id = venda_criar_lembrete.sessao_id;
  if not found or v_s.status <> 'agendada' or v_s.agendada_para is null then
    return null;
  end if;
  if not coalesce((select a.ativa from public.automacao a where a.id = 'lembrete_sessao'), false) then
    return null;
  end if;
  if (v_s.agendada_para at time zone 'America/Sao_Paulo')::date
     <= (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date then
    return null;
  end if;

  select f.nome_exibicao into v_nome from public.familia f where f.id = v_s.familia_id;

  v_id := privado.venda_criar_tarefa(
    v_s.familia_id,
    'agendar_sessao',
    'Lembrar a ' || v_nome || ' da conversa de amanhã',
    venda_criar_lembrete.responsavel_id,
    'normal',
    v_s.agendada_para - interval '1 day',
    'lembrete_sessao',
    pg_catalog.jsonb_build_object(
      'hora', pg_catalog.to_char(v_s.agendada_para at time zone 'America/Sao_Paulo', 'HH24:MI'),
      'link', v_s.link_reuniao),
    'operacional',
    pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id));

  if v_id is not null then
    insert into public.automacao_execucao (automacao_id, familia_id, agendada_para, executada_em, status, payload)
    values ('lembrete_sessao', v_s.familia_id, v_s.agendada_para - interval '1 day', pg_catalog.now(), 'executada',
            pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'agendada_para', v_s.agendada_para,
                                          'tarefa_id', v_id, 'origem', 'api.agendar_sessao_venda'));
  end if;
  return v_id;
end;
$$;
comment on function privado.venda_criar_lembrete(uuid, uuid) is '[P29] Tarefa do lembrete da véspera (texto lembrete_sessao com nome, hora e link), vencendo 24 h antes; nada para conversa de hoje ou com a automação lembrete_sessao desligada. Grava a execução como executada para o motor (0012) não duplicar. Sem grant.';

create function privado.venda_evento(familia_id uuid, tipo text, titulo text, dados jsonb) returns void
  language sql
  volatile
  set search_path = ''
  as $$
  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (venda_evento.familia_id, venda_evento.tipo, venda_evento.titulo, coalesce(venda_evento.dados, '{}'), false, auth.uid())
$$;
comment on function privado.venda_evento(uuid, text, text, jsonb) is '[P29/P30] Evento da linha do tempo (não restrito). Nunca leva CPF, endereço nem transcrição. Sem grant.';

create function privado.venda_log(acao text, entidade text, entidade_id text, antes jsonb, depois jsonb) returns void
  language sql
  volatile
  security definer
  set search_path = ''
  as $$
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), venda_log.acao, venda_log.entidade, venda_log.entidade_id, venda_log.antes, venda_log.depois,
          coalesce(privado.origem_atual(), 'app'), privado.ip_requisicao())
$$;
comment on function privado.venda_log(text, text, text, jsonb, jsonb) is '[P29/P30] Linha de log_auditoria de uma ação de venda. Só ids, estados e valores em centavos; nunca CPF, endereço, token ou transcrição. Sem grant.';

-- --- oportunidade aberta ---------------------------------------------------------
create function privado.venda_oportunidade(familia_id uuid) returns public.oportunidade
  language sql
  stable
  set search_path = ''
  as $$
  select o.*
  from public.oportunidade o
  where o.familia_id = venda_oportunidade.familia_id
    and (o.estagio_p2 is null or o.estagio_p2 not in ('perdido', 'cancelado', 'distrato'))
  order by o.criado_em desc, o.id
  limit 1
$$;
comment on function privado.venda_oportunidade(uuid) is '[P29/P30] Oportunidade aberta da família (a mesma regra do índice único de 0003). Sem grant.';

-- --- proposta --------------------------------------------------------------------
-- Conta da proposta em centavos. O desconto incide sobre o valor do pacote;
-- a taxa entra depois. A parcela é o total dividido pelas parcelas, para
-- baixo; o resto (centavos) vai na primeira. Espelhada em
-- src/modules/crm/proposta/calculo.ts (os dois testes conferem os mesmos
-- números).
create function privado.venda_conta(
  valor_centavos    integer,
  taxa_centavos     integer,
  desconto_centavos integer,
  parcelas          integer
) returns jsonb
  language plpgsql
  immutable
  set search_path = ''
  as $$
declare
  v_total    integer := coalesce(venda_conta.valor_centavos, 0) - coalesce(venda_conta.desconto_centavos, 0)
                        + coalesce(venda_conta.taxa_centavos, 0);
  v_parcelas integer := greatest(coalesce(venda_conta.parcelas, 1), 1);
  v_parcela  integer := v_total / v_parcelas;
begin
  return pg_catalog.jsonb_build_object(
    'valor_centavos', coalesce(venda_conta.valor_centavos, 0),
    'taxa_centavos', coalesce(venda_conta.taxa_centavos, 0),
    'desconto_centavos', coalesce(venda_conta.desconto_centavos, 0),
    'total_centavos', v_total,
    'parcelas', v_parcelas,
    'parcela_centavos', v_parcela,
    'primeira_parcela_centavos', v_parcela + (v_total - v_parcela * v_parcelas));
end;
$$;
comment on function privado.venda_conta(integer, integer, integer, integer) is '[P30] Conta em centavos a partir do desconto já calculado: total = valor menos desconto mais taxa; parcela para baixo e o resto na primeira. Sem grant.';

create function privado.venda_calcular(
  valor_centavos integer,
  taxa_centavos  integer,
  desconto_pct   numeric,
  parcelas       integer
) returns jsonb
  language sql
  immutable
  set search_path = ''
  as $$
  select privado.venda_conta(
    venda_calcular.valor_centavos,
    venda_calcular.taxa_centavos,
    pg_catalog.round(coalesce(venda_calcular.valor_centavos, 0) * coalesce(venda_calcular.desconto_pct, 0) / 100.0)::integer,
    venda_calcular.parcelas)
$$;
comment on function privado.venda_calcular(integer, integer, numeric, integer) is '[P30] Conta da proposta em centavos: desconto (percentual, arredondado ao centavo) sobre o pacote, taxa somada depois, parcela para baixo e o resto na primeira. Espelhada em src/modules/crm/proposta/calculo.ts (os dois testes conferem os mesmos números). Sem grant.';

-- --- formulário ------------------------------------------------------------------
create function privado.formulario_hash(token text) returns text
  language sql
  immutable
  set search_path = ''
  as $$ select pg_catalog.encode(extensions.digest(coalesce(formulario_hash.token, ''), 'sha256'), 'hex') $$;
comment on function privado.formulario_hash(text) is '[P30] sha256 (hex) do token do formulário. O token tem 32 bytes aleatórios (não é dado pessoal, então hash puro basta; a regra do HMAC do ADR 0002 é para dado de baixa entropia como CPF). Sem grant.';

create function privado.formulario_situacao(hash text, expira_em timestamptz) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select case
           when formulario_situacao.hash is null and formulario_situacao.expira_em is null then 'nao_enviado'
           when formulario_situacao.hash is null then 'recebido'
           when formulario_situacao.expira_em > pg_catalog.now() then 'aguardando'
           else 'vencido'
         end
$$;
comment on function privado.formulario_situacao(text, timestamptz) is '[P30] nao_enviado, aguardando, vencido ou recebido, a partir de formulario_token_hash e formulario_expira_em (hash nulo com data = recebido nessa data). Sem grant.';


-- =============================================================================
-- 4. Sessão de venda (P29)
-- =============================================================================

-- --- 4.1 quem conduz -----------------------------------------------------------------
create function api.condutores_sessao_venda()
  returns table (id uuid, nome text)
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  return query
    select p.id, p.nome
    from public.perfil p
    where p.ativo
      and exists (select 1 from public.usuario_papel up
                  where up.usuario_id = p.id and up.papel in ('coordenacao', 'diretoria'))
    order by (exists (select 1 from public.usuario_papel up
                      where up.usuario_id = p.id and up.papel = 'coordenacao')) desc, p.nome;
end;
$$;
comment on function api.condutores_sessao_venda() is '[P29] Quem pode conduzir a sessão de venda (perfil ativo com coordenação ou diretoria), coordenação primeiro. Comercial, coordenação e diretoria, AAL pela regra do perfil.';

-- --- 4.2 agenda ------------------------------------------------------------------------
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
    gravacao_registrada boolean
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
           end
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
comment on function api.sessoes_venda(timestamptz, timestamptz, uuid, uuid) is '[P29 item 4] Agenda das sessões de venda para comercial, coordenação e diretoria (AAL pela regra do perfil), com o nome da família e de quem conduz. pode_ver_gravacao diz se quem pede é quem conduziu ou a diretoria; gravacao_registrada só vem para quem pode ver e está em AAL2. Nunca devolve transcrição nem resumo (isso é api.sessao_venda_gravacao, com log).';

-- --- 4.3 agendar -------------------------------------------------------------------------
create function api.agendar_sessao_venda(
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

  insert into public.sessao_venda (familia_id, agendada_para, opcoes_informadas, conduzida_por, link_reuniao, status, criado_por)
  values (v_f.id, agendar_sessao_venda.agendada_para, v_opcoes, agendar_sessao_venda.conduzida_por, v_link, 'agendada', v_uid)
  returning id into v_id;

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
comment on function api.agendar_sessao_venda(uuid, timestamptz, uuid, text, text, uuid) is '[P29 item 1] Agenda a sessão de venda (D-15: agendamento humano): comercial ou diretoria, AAL pela regra do perfil. Data futura, link https obrigatório, condutor com coordenação ou diretoria, família fora de freio de bloqueio e de não contatar, uma sessão agendada por vez. P1 qualificado ou nutrição (em conversa com a IA passando por qualificado) para sessao_venda_agendada; lembrete da véspera (lembrete_sessao, 23.2); transferência reuniao fechada com o desfecho sessao_marcada, sem devolver a conversa à Isadora. Evento e log. Recusa: erro P0001 "venda:<código>".';

-- --- 4.4 remarcar ------------------------------------------------------------------------
create function api.remarcar_sessao_venda(
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

  insert into public.sessao_venda (familia_id, agendada_para, opcoes_informadas, conduzida_por, link_reuniao, status, criado_por)
  values (v_s.familia_id, remarcar_sessao_venda.agendada_para, v_s.opcoes_informadas, v_condutor, v_link, 'agendada', v_uid)
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
comment on function api.remarcar_sessao_venda(uuid, timestamptz, text, uuid) is '[P29 item 2] Remarca: a sessão agendada vira remarcada (histórico), nasce outra agendada com a data nova (link e condutor mantidos se não vierem), o lembrete antigo é cancelado e nasce o novo. P1 continua em sessao_venda_agendada. Comercial ou diretoria, AAL pela regra do perfil. Evento e log.';

-- --- 4.5 desfecho ------------------------------------------------------------------------
create function api.registrar_desfecho_sessao_venda(
  sessao_id         uuid,
  desfecho          public.status_sessao,
  parceiro_presente boolean default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid     uuid := auth.uid();
  v_s       public.sessao_venda;
  v_f       public.familia;
  v_o       public.oportunidade;
  v_horas   numeric;
  v_tarefa  uuid;
  v_estagio text;
  v_titulo  text;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
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

  select f.* into v_f from public.familia f where f.id = v_s.familia_id;
  v_o := privado.venda_oportunidade(v_s.familia_id);

  update public.sessao_venda s
     set status = registrar_desfecho_sessao_venda.desfecho,
         realizada_em = case when registrar_desfecho_sessao_venda.desfecho = 'realizada' then v_s.agendada_para else s.realizada_em end,
         parceiro_presente = coalesce(registrar_desfecho_sessao_venda.parceiro_presente, s.parceiro_presente)
   where s.id = v_s.id;
  perform privado.venda_cancelar_tarefas_sessao(v_s.id);

  if v_o.id is not null and v_o.estagio_p2 is null and v_o.estagio_p1 = 'sessao_venda_agendada' then
    if registrar_desfecho_sessao_venda.desfecho = 'realizada' then
      perform privado.transicionar('p1', v_o.id, 'sessao_venda_realizada', 'Conversa de orientação realizada');
    elsif not exists (select 1 from public.sessao_venda s2
                      where s2.familia_id = v_s.familia_id and s2.status = 'agendada' and s2.id <> v_s.id) then
      perform privado.transicionar('p1', v_o.id, 'qualificado',
        case registrar_desfecho_sessao_venda.desfecho when 'nao_compareceu' then 'Família não compareceu à conversa'
                                                      else 'Conversa de orientação cancelada' end);
    end if;
  end if;

  if registrar_desfecho_sessao_venda.desfecho = 'realizada' then
    v_horas := privado.venda_numero('sessao_venda_retorno_horas');
    if v_horas is not null then
      v_tarefa := privado.venda_criar_tarefa(
        v_s.familia_id, 'followup_comercial',
        'Perguntar à ' || v_f.nome_exibicao || ' como foi a conversa',
        coalesce(v_o.responsavel_id, v_uid), 'normal',
        v_s.agendada_para + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision),
        'pos_sessao_48h', '{}'::jsonb, 'conteudo',
        pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id));
    end if;
    v_titulo := 'Conversa de orientação realizada';
  elsif registrar_desfecho_sessao_venda.desfecho = 'nao_compareceu' then
    v_tarefa := privado.venda_criar_tarefa(
      v_s.familia_id, 'agendar_sessao',
      'Oferecer outro horário à ' || v_f.nome_exibicao,
      coalesce(v_o.responsavel_id, v_uid), 'normal', pg_catalog.now(),
      'nao_compareceu', '{}'::jsonb, 'operacional',
      pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id));
    v_titulo := 'A família não compareceu à conversa de orientação';
  else
    v_titulo := 'Conversa de orientação cancelada';
  end if;

  perform privado.venda_evento(v_s.familia_id, 'sessao', v_titulo,
    pg_catalog.jsonb_build_object('sessao_venda_id', v_s.id, 'status', registrar_desfecho_sessao_venda.desfecho));
  perform privado.venda_log('sessao_venda_desfecho', 'sessao_venda', v_s.id::text,
    pg_catalog.jsonb_build_object('status', 'agendada'),
    pg_catalog.jsonb_build_object('status', registrar_desfecho_sessao_venda.desfecho,
                                  'parceiro_presente', registrar_desfecho_sessao_venda.parceiro_presente));

  select o.estagio_p1::text into v_estagio from public.oportunidade o where o.id = v_o.id;
  return pg_catalog.jsonb_build_object('ok', true, 'sessao_id', v_s.id,
                                       'status', registrar_desfecho_sessao_venda.desfecho,
                                       'tarefa_id', v_tarefa, 'estagio_p1', v_estagio);
end;
$$;
comment on function api.registrar_desfecho_sessao_venda(uuid, public.status_sessao, boolean) is '[P29 item 2] Desfecho da sessão agendada: realizada (só depois do horário; P1 para sessao_venda_realizada; tarefa pos_sessao_48h depois de parametro.sessao_venda_retorno_horas), nao_compareceu (só depois do horário; P1 volta para qualificado; tarefa nao_compareceu) ou cancelada (P1 volta para qualificado). Cancela o lembrete aberto. Comercial ou diretoria, AAL pela regra do perfil. Evento e log.';

-- --- 4.6 gravação, consentimento e transcrição -------------------------------------------
create function privado.venda_pode_gravacao(sessao_id uuid) returns public.sessao_venda
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_s public.sessao_venda;
begin
  select s.* into v_s from public.sessao_venda s where s.id = venda_pode_gravacao.sessao_id;
  if not found then
    perform privado.venda_recusar('sessao_inexistente');
  end if;
  if not privado.tem_papel('diretoria') and v_s.conduzida_por is distinct from auth.uid() then
    raise exception 'venda:so_quem_conduziu só quem conduziu a sessão e a diretoria (PRD 13)'
      using errcode = '42501';
  end if;
  return v_s;
end;
$$;
comment on function privado.venda_pode_gravacao(uuid) is '[P29 item 4] Confere que quem pede conduziu a sessão ou é diretoria (PRD 13, sessão gravada); recusa com 42501. Sem grant.';

create function api.registrar_gravacao_sessao_venda(
  sessao_id      uuid,
  consentimento  boolean,
  transcricao    text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_s       public.sessao_venda;
  v_g       public.sessao_venda_gravacao;
  v_versao  text;
  v_max     numeric;
  v_texto   text := nullif(pg_catalog.btrim(registrar_gravacao_sessao_venda.transcricao), '');
  v_existia boolean;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  v_s := privado.venda_pode_gravacao(registrar_gravacao_sessao_venda.sessao_id);
  if v_s.status not in ('agendada', 'realizada') then
    perform privado.venda_recusar('sessao_sem_gravacao', v_s.status::text);
  end if;
  if registrar_gravacao_sessao_venda.consentimento is null then
    perform privado.venda_recusar('consentimento_obrigatorio');
  end if;

  v_versao := privado.venda_parametro('sessao_gravacao') ->> 'termo_versao';
  v_max := privado.venda_numero('sessao_gravacao', 'transcricao_max_caracteres');
  if registrar_gravacao_sessao_venda.consentimento and v_versao is null then
    perform privado.venda_recusar('termo_sem_versao');
  end if;
  if v_texto is not null and not registrar_gravacao_sessao_venda.consentimento then
    perform privado.venda_recusar('sem_consentimento');
  end if;
  if v_texto is not null and v_max is not null and pg_catalog.length(v_texto) > v_max then
    perform privado.venda_recusar('transcricao_longa');
  end if;

  select g.* into v_g from public.sessao_venda_gravacao g where g.sessao_id = v_s.id for update;
  v_existia := found;

  if not registrar_gravacao_sessao_venda.consentimento then
    -- sem consentimento (ou retirado): nada fica guardado.
    if v_existia then
      update public.sessao_venda_gravacao g
         set consentimento_gravacao = false, consentimento_versao = null, consentimento_em = null,
             transcricao = null, resumo = null, gravacao_path = null
       where g.id = v_g.id;
    else
      insert into public.sessao_venda_gravacao (sessao_id, consentimento_gravacao)
      values (v_s.id, false);
    end if;
  elsif v_existia then
    update public.sessao_venda_gravacao g
       set consentimento_gravacao = true,
           consentimento_versao = case when g.consentimento_gravacao then g.consentimento_versao else v_versao end,
           consentimento_em = case when g.consentimento_gravacao then g.consentimento_em else pg_catalog.now() end,
           transcricao = coalesce(v_texto, g.transcricao),
           resumo = case when v_texto is not null and v_texto is distinct from g.transcricao then null else g.resumo end
     where g.id = v_g.id;
  else
    insert into public.sessao_venda_gravacao (sessao_id, consentimento_gravacao, consentimento_versao, consentimento_em, transcricao)
    values (v_s.id, true, v_versao, pg_catalog.now(), v_texto);
  end if;

  perform privado.venda_log('sessao_venda_gravacao', 'sessao_venda', v_s.id::text, null,
    pg_catalog.jsonb_build_object('consentimento', registrar_gravacao_sessao_venda.consentimento,
                                  'termo_versao', case when registrar_gravacao_sessao_venda.consentimento then v_versao end,
                                  'transcricao', v_texto is not null));

  return pg_catalog.jsonb_build_object('ok', true, 'sessao_id', v_s.id,
    'consentimento', registrar_gravacao_sessao_venda.consentimento,
    'termo_versao', case when registrar_gravacao_sessao_venda.consentimento then v_versao end);
end;
$$;
comment on function api.registrar_gravacao_sessao_venda(uuid, boolean, text) is '[P29 item 3] Consentimento de gravação com a versão do termo (parametro.sessao_gravacao.termo_versao) e transcrição colada, em sessao_venda_gravacao. Só quem conduziu e a diretoria, AAL2. Transcrição exige consentimento; consentimento negado ou retirado apaga transcrição, resumo e gravação. Transcrição nova apaga o resumo antigo. Log sem o texto.';

create function api.salvar_resumo_sessao_venda(sessao_id uuid, resumo jsonb) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_s     public.sessao_venda;
  v_g     public.sessao_venda_gravacao;
  v_lista text;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  v_s := privado.venda_pode_gravacao(salvar_resumo_sessao_venda.sessao_id);
  select g.* into v_g from public.sessao_venda_gravacao g where g.sessao_id = v_s.id for update;
  if not found or not v_g.consentimento_gravacao or v_g.transcricao is null then
    perform privado.venda_recusar('sem_transcricao');
  end if;

  if salvar_resumo_sessao_venda.resumo is null or pg_catalog.jsonb_typeof(salvar_resumo_sessao_venda.resumo) <> 'object' then
    perform privado.venda_recusar('resumo_invalido');
  end if;
  foreach v_lista in array array['duvidas', 'objecoes', 'proximos_passos'] loop
    if pg_catalog.jsonb_typeof(salvar_resumo_sessao_venda.resumo -> v_lista) is distinct from 'array'
       or exists (select 1 from pg_catalog.jsonb_array_elements(salvar_resumo_sessao_venda.resumo -> v_lista) e
                  where pg_catalog.jsonb_typeof(e) <> 'string') then
      perform privado.venda_recusar('resumo_invalido', v_lista);
    end if;
  end loop;
  if pg_catalog.jsonb_typeof(salvar_resumo_sessao_venda.resumo -> 'plano_interesse') not in ('string', 'null') then
    perform privado.venda_recusar('resumo_invalido', 'plano_interesse');
  end if;

  update public.sessao_venda_gravacao g
     set resumo = pg_catalog.jsonb_build_object(
                    'duvidas', salvar_resumo_sessao_venda.resumo -> 'duvidas',
                    'objecoes', salvar_resumo_sessao_venda.resumo -> 'objecoes',
                    'plano_interesse', salvar_resumo_sessao_venda.resumo -> 'plano_interesse',
                    'proximos_passos', salvar_resumo_sessao_venda.resumo -> 'proximos_passos',
                    'origem', coalesce(salvar_resumo_sessao_venda.resumo ->> 'origem', 'pessoa'),
                    'modelo', salvar_resumo_sessao_venda.resumo ->> 'modelo',
                    'salvo_por', auth.uid(),
                    'salvo_em', pg_catalog.now())
   where g.id = v_g.id;

  perform privado.venda_log('sessao_venda_resumo', 'sessao_venda', v_s.id::text, null,
    pg_catalog.jsonb_build_object('origem', coalesce(salvar_resumo_sessao_venda.resumo ->> 'origem', 'pessoa')));

  return pg_catalog.jsonb_build_object('ok', true, 'sessao_id', v_s.id);
end;
$$;
comment on function api.salvar_resumo_sessao_venda(uuid, jsonb) is '[P29 item 3] Grava o resumo estruturado revisado (duvidas, objecoes, proximos_passos como listas de texto; plano_interesse texto ou nulo; origem ia ou pessoa; modelo). Só quem conduziu e a diretoria, AAL2, com transcrição consentida. Log sem o conteúdo.';


-- =============================================================================
-- 5. Proposta (P30 item 1)
-- =============================================================================

create function api.proposta(oportunidade_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_o        public.oportunidade;
  v_f        public.familia;
  v_k        public.contrato;
  v_cidade   jsonb;
  v_contrato jsonb;
  v_hoje     date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  v_cond     public.condicao_comercial;
begin
  perform privado.autorizar(array['comercial', 'financeiro', 'diretoria']::public.papel_usuario[], true);

  select o.* into v_o from public.oportunidade o where o.id = proposta.oportunidade_id;
  if not found then
    perform privado.venda_recusar('oportunidade_inexistente');
  end if;
  if privado.tem_papel('financeiro') and not privado.tem_papel('comercial') and not privado.tem_papel('diretoria')
     and not exists (select 1 from public.contrato k where k.familia_id = v_o.familia_id) then
    raise exception 'venda:sem_permissao financeiro só vê família com contrato (PRD 13)' using errcode = '42501';
  end if;
  select f.* into v_f from public.familia f where f.id = v_o.familia_id;

  select pg_catalog.jsonb_build_object('nome', c.nome, 'uf', c.uf, 'atendida', c.atendida,
           'requer_confirmacao', c.requer_confirmacao, 'taxa_centavos', c.taxa_deslocamento_centavos)
    into v_cidade
  from public.cidade c where c.id = v_f.cidade_id;

  select k.* into v_k
  from public.contrato k
  where k.familia_id = v_f.id and k.status not in ('cancelado', 'distrato')
  order by k.criado_em desc, k.id
  limit 1;

  if v_k.id is not null then
    select c.* into v_cond from public.condicao_comercial c where c.id = v_o.condicao_id;
    v_contrato := pg_catalog.jsonb_build_object(
      'id', v_k.id,
      'status', v_k.status,
      'pacote_versao_id', v_k.pacote_versao_id,
      'contratante_pessoa_id', v_k.contratante_pessoa_id,
      'pagador_pessoa_id', v_k.pagador_pessoa_id,
      'testemunha_pessoa_id', v_k.testemunha_pessoa_id,
      'template_versao', v_k.template_versao,
      'conta', privado.venda_conta(v_k.valor_centavos, v_k.taxa_deslocamento_centavos, v_k.desconto_centavos, v_k.parcelas),
      'formulario', pg_catalog.jsonb_build_object(
        'situacao', privado.formulario_situacao(v_k.formulario_token_hash, v_k.formulario_expira_em),
        'expira_em', case when v_k.formulario_token_hash is not null then v_k.formulario_expira_em end,
        'recebido_em', case when v_k.formulario_token_hash is null then v_k.formulario_expira_em end));
  end if;

  return pg_catalog.jsonb_build_object(
    'oportunidade', pg_catalog.jsonb_build_object(
      'id', v_o.id, 'familia_id', v_o.familia_id, 'pipeline', v_o.pipeline,
      'estagio_p1', v_o.estagio_p1, 'estagio_p2', v_o.estagio_p2,
      'para_quem', v_o.para_quem, 'pagador_pessoa_id', v_o.pagador_pessoa_id,
      'condicao_id', v_o.condicao_id, 'desconto_pct', v_o.desconto_pct,
      'plano_interesse_pacote_id', v_o.plano_interesse_pacote_id,
      'pagamento_preferido', v_o.pagamento_preferido,
      'precisa_aprovacao', (v_o.desconto_pct > 0 or coalesce(v_cond.requer_aprovacao, false)),
      'desconto_aprovado', v_o.desconto_aprovado_por is not null,
      'desconto_aprovado_por_nome', privado.venda_nome_perfil(v_o.desconto_aprovado_por)),
    'familia', pg_catalog.jsonb_build_object(
      'id', v_f.id, 'nome', v_f.nome_exibicao, 'dpp', v_f.dpp, 'data_nascimento', v_f.data_nascimento,
      'gemelar', v_f.gemelar, 'estado_sensivel', v_f.estado_sensivel, 'nao_contatar', v_f.nao_contatar,
      'cidade', v_cidade),
    'pessoas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', p.id, 'nome', p.nome, 'papel', p.papel, 'contato_principal', p.contato_principal)
             order by p.contato_principal desc, p.criado_em, p.id)
      from public.pessoa p where p.familia_id = v_f.id), '[]'::jsonb),
    'pacotes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'pacote_versao_id', pv.id, 'pacote_id', pa.id, 'nome', pa.nome, 'linha', pa.linha,
               'dias', pa.dias, 'gemelar', pa.gemelar, 'horas_por_visita', pv.horas_por_visita,
               'valor_centavos', pv.valor_centavos, 'parcelas_max_sem_juros', pv.parcelas_max_sem_juros)
             order by pa.ordem, pa.nome)
      from public.pacote pa
      join public.pacote_versao pv on pv.pacote_id = pa.id
      where pa.ativo and pv.vigencia_inicio <= v_hoje and (pv.vigencia_fim is null or pv.vigencia_fim >= v_hoje)), '[]'::jsonb),
    'condicoes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'tipo', c.tipo, 'valor', c.valor, 'requer_aprovacao', c.requer_aprovacao)
             order by c.nome)
      from public.condicao_comercial c where c.ativa), '[]'::jsonb),
    'contrato', v_contrato,
    'formulario_validade_horas', privado.venda_numero('formulario_contrato', 'validade_horas'),
    'pode_editar', privado.tem_papel('comercial') or privado.tem_papel('diretoria'),
    'pode_aprovar', privado.tem_papel('diretoria'));
end;
$$;
comment on function api.proposta(uuid) is '[P30 item 1] Tudo o que a tela da proposta precisa, calculado no banco: pacotes vigentes hoje, condições ativas, cidade e taxa, pessoas da família, o contrato aberto com a conta e a situação do formulário (nunca token nem hash), se precisa e se tem aprovação da diretoria. Comercial, financeiro (só família com contrato) e diretoria, AAL2.';

create function api.salvar_proposta(
  oportunidade_id   uuid,
  pacote_versao_id  uuid,
  parcelas          integer,
  condicao_id       uuid default null,
  para_quem         text default 'propria',
  pagador_pessoa_id uuid default null,
  pagador_nome      text default null,
  desconto_pct      numeric default 0,
  desconto_motivo   text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid       uuid := auth.uid();
  v_o         public.oportunidade;
  v_f         public.familia;
  v_pv        public.pacote_versao;
  v_cond      public.condicao_comercial;
  v_k         public.contrato;
  v_gestante  public.pessoa;
  v_pagador   uuid;
  v_testemunha uuid;
  v_hoje      date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  v_pct       numeric := coalesce(salvar_proposta.desconto_pct, 0);
  v_motivo    text := privado.campo_livre(salvar_proposta.desconto_motivo);
  v_max       integer;
  v_taxa      integer := 0;
  v_conta     jsonb;
  v_template  text;
  v_mudou     boolean;
  v_precisa   boolean;
  v_nome_pag  text := privado.campo_livre(salvar_proposta.pagador_nome);
  v_pacote    text;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select o.* into v_o from public.oportunidade o where o.id = salvar_proposta.oportunidade_id for update;
  if not found then
    perform privado.venda_recusar('oportunidade_inexistente');
  end if;
  if v_o.estagio_p2 is not null and v_o.estagio_p2 not in ('proposta_enviada', 'em_negociacao') then
    perform privado.venda_recusar('proposta_fechada', v_o.estagio_p2::text);
  end if;
  if v_o.estagio_p2 is null and v_o.estagio_p1 not in ('qualificado', 'nutricao', 'sessao_venda_realizada') then
    perform privado.venda_recusar('estagio_nao_permite_proposta', v_o.estagio_p1::text);
  end if;

  select f.* into v_f from public.familia f where f.id = v_o.familia_id;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    perform privado.venda_recusar('familia_em_estado_sensivel');
  end if;

  v_gestante := privado.venda_gestante(v_f.id);
  if v_gestante.id is null then
    perform privado.venda_recusar('sem_gestante');
  end if;

  select pv.* into v_pv
  from public.pacote_versao pv
  join public.pacote pa on pa.id = pv.pacote_id
  where pv.id = salvar_proposta.pacote_versao_id and pa.ativo
    and pv.vigencia_inicio <= v_hoje and (pv.vigencia_fim is null or pv.vigencia_fim >= v_hoje);
  if not found then
    perform privado.venda_recusar('pacote_fora_de_vigencia');
  end if;
  select pa.nome into v_pacote from public.pacote pa where pa.id = v_pv.pacote_id;

  v_max := v_pv.parcelas_max_sem_juros;
  if salvar_proposta.condicao_id is not null then
    select c.* into v_cond from public.condicao_comercial c where c.id = salvar_proposta.condicao_id and c.ativa;
    if not found then
      perform privado.venda_recusar('condicao_inativa');
    end if;
    if v_cond.tipo = 'desconto_pct' then
      if v_pct > 0 then
        perform privado.venda_recusar('desconto_duplo');
      end if;
      v_pct := v_cond.valor;
    elsif v_cond.tipo = 'parcelamento' then
      v_max := greatest(v_max, v_cond.valor::integer);
    end if;
  end if;

  if v_pct < 0 or v_pct > 100 then
    perform privado.venda_recusar('desconto_invalido');
  end if;
  if (salvar_proposta.condicao_id is null or v_cond.tipo <> 'desconto_pct') and v_pct > 0 and v_motivo is null then
    perform privado.venda_recusar('desconto_sem_motivo');
  end if;
  if salvar_proposta.parcelas is null or salvar_proposta.parcelas < 1 or salvar_proposta.parcelas > v_max then
    perform privado.venda_recusar('parcelas_fora_da_condicao', v_max::text);
  end if;

  if salvar_proposta.para_quem is null or salvar_proposta.para_quem not in ('propria', 'presente', 'outro') then
    perform privado.venda_recusar('para_quem_invalido');
  end if;
  if salvar_proposta.para_quem = 'presente' then
    if salvar_proposta.pagador_pessoa_id is not null then
      if not exists (select 1 from public.pessoa p
                     where p.id = salvar_proposta.pagador_pessoa_id and p.familia_id = v_f.id) then
        perform privado.venda_recusar('pagador_invalido');
      end if;
      if salvar_proposta.pagador_pessoa_id = v_gestante.id then
        perform privado.venda_recusar('pagador_igual_gestante');
      end if;
      v_pagador := salvar_proposta.pagador_pessoa_id;
    elsif v_nome_pag is not null then
      insert into public.pessoa (familia_id, papel, nome, criado_por)
      values (v_f.id, 'presenteador', v_nome_pag, v_uid)
      returning id into v_pagador;
    else
      perform privado.venda_recusar('presente_sem_pagador');
    end if;
  end if;

  select c.taxa_deslocamento_centavos into v_taxa from public.cidade c where c.id = v_f.cidade_id;
  v_taxa := coalesce(v_taxa, 0);
  v_conta := privado.venda_calcular(v_pv.valor_centavos, v_taxa, v_pct, salvar_proposta.parcelas);

  -- parceiro como testemunha, prática atual (PRD 6.3) [confirmar]
  select p.id into v_testemunha from public.pessoa p
  where p.familia_id = v_f.id and p.papel = 'parceiro'
  order by p.criado_em, p.id limit 1;

  v_precisa := v_pct > 0 or coalesce(v_cond.requer_aprovacao, false);
  v_mudou := v_o.condicao_id is distinct from salvar_proposta.condicao_id
          or v_o.desconto_pct is distinct from (case when v_cond.tipo = 'desconto_pct' then 0 else v_pct end)
          or v_o.plano_interesse_pacote_id is distinct from v_pv.pacote_id;

  select k.* into v_k from public.contrato k
  where k.familia_id = v_f.id and k.status in ('rascunho', 'aguardando_dados')
  order by k.criado_em desc, k.id limit 1
  for update;
  if found and (v_k.parcelas is distinct from salvar_proposta.parcelas or v_k.pacote_versao_id is distinct from v_pv.id) then
    v_mudou := true;
  end if;

  update public.oportunidade o
     set plano_interesse_pacote_id = v_pv.pacote_id,
         condicao_id = salvar_proposta.condicao_id,
         desconto_pct = case when v_cond.tipo = 'desconto_pct' then 0 else v_pct end,
         desconto_motivo = case when v_pct > 0 then coalesce(v_motivo, v_cond.nome) else null end,
         desconto_aprovado_por = case when not v_precisa then null
                                      when v_mudou then null
                                      else o.desconto_aprovado_por end,
         para_quem = salvar_proposta.para_quem,
         pagador_pessoa_id = v_pagador
   where o.id = v_o.id;

  if v_k.id is null then
    v_template := privado.venda_parametro('contrato_template_versao') #>> '{}';
    if v_template is null then
      perform privado.venda_recusar('template_sem_versao');
    end if;
    insert into public.contrato (familia_id, pacote_versao_id, contratante_pessoa_id, pagador_pessoa_id, testemunha_pessoa_id,
                                 valor_centavos, taxa_deslocamento_centavos, desconto_centavos, parcelas, template_versao,
                                 status, criado_por)
    values (v_f.id, v_pv.id, v_gestante.id, v_pagador, v_testemunha,
            v_pv.valor_centavos, v_taxa, (v_conta ->> 'desconto_centavos')::integer, salvar_proposta.parcelas, v_template,
            'rascunho', v_uid)
    returning * into v_k;
  else
    update public.contrato k
       set pacote_versao_id = v_pv.id,
           contratante_pessoa_id = v_gestante.id,
           pagador_pessoa_id = v_pagador,
           testemunha_pessoa_id = coalesce(k.testemunha_pessoa_id, v_testemunha),
           valor_centavos = v_pv.valor_centavos,
           taxa_deslocamento_centavos = v_taxa,
           desconto_centavos = (v_conta ->> 'desconto_centavos')::integer,
           parcelas = salvar_proposta.parcelas
     where k.id = v_k.id
    returning * into v_k;
  end if;

  if v_o.estagio_p2 is null then
    perform privado.transicionar('p2', v_o.id, 'proposta_enviada', 'Proposta registrada');
  end if;

  perform privado.venda_evento(v_f.id, 'proposta',
    'Proposta registrada: ' || v_pacote || ', ' || privado.formatar_reais((v_conta ->> 'total_centavos')::bigint)
      || ' em ' || salvar_proposta.parcelas || 'x',
    pg_catalog.jsonb_build_object('contrato_id', v_k.id, 'pacote_versao_id', v_pv.id,
                                  'total_centavos', (v_conta ->> 'total_centavos')::integer,
                                  'parcelas', salvar_proposta.parcelas));
  perform privado.venda_log('proposta_salva', 'contrato', v_k.id::text, null,
    pg_catalog.jsonb_build_object('oportunidade_id', v_o.id, 'pacote_versao_id', v_pv.id,
                                  'condicao_id', salvar_proposta.condicao_id, 'desconto_pct', v_pct,
                                  'parcelas', salvar_proposta.parcelas, 'para_quem', salvar_proposta.para_quem,
                                  'total_centavos', (v_conta ->> 'total_centavos')::integer,
                                  'precisa_aprovacao', v_precisa));

  return pg_catalog.jsonb_build_object('ok', true, 'contrato_id', v_k.id, 'conta', v_conta,
                                       'precisa_aprovacao', v_precisa,
                                       'desconto_aprovado', (select o.desconto_aprovado_por is not null
                                                             from public.oportunidade o where o.id = v_o.id));
end;
$$;
comment on function api.salvar_proposta(uuid, uuid, integer, uuid, text, uuid, text, numeric, text) is '[P30 item 1] Proposta calculada no banco: versão vigente do pacote, taxa da cidade, desconto da condição (desconto_pct) ou manual (com motivo), parcelas até parcelas_max_sem_juros ou até a condição de parcelamento; presente com pagador da família ou criado aqui (papel presenteador). Contrato em rascunho (ou aguardando_dados) com contratante = gestante e testemunha = parceiro; primeira proposta passa a oportunidade para o P2 proposta_enviada. Mudança em pacote, condição, desconto ou parcelas apaga a aprovação. Comercial ou diretoria, AAL2. Evento e log.';

create function api.aprovar_desconto(oportunidade_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_o    public.oportunidade;
  v_cond public.condicao_comercial;
begin
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select o.* into v_o from public.oportunidade o where o.id = aprovar_desconto.oportunidade_id for update;
  if not found then
    perform privado.venda_recusar('oportunidade_inexistente');
  end if;
  select c.* into v_cond from public.condicao_comercial c where c.id = v_o.condicao_id;
  if not (v_o.desconto_pct > 0 or coalesce(v_cond.requer_aprovacao, false)) then
    perform privado.venda_recusar('nada_a_aprovar');
  end if;
  if v_o.desconto_aprovado_por is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'oportunidade_id', v_o.id, 'ja_aprovado', true);
  end if;

  update public.oportunidade o set desconto_aprovado_por = auth.uid() where o.id = v_o.id;

  perform privado.venda_evento(v_o.familia_id, 'proposta', 'Condição da proposta aprovada pela diretoria',
    pg_catalog.jsonb_build_object('oportunidade_id', v_o.id, 'condicao_id', v_o.condicao_id));
  perform privado.venda_log('desconto_aprovado', 'oportunidade', v_o.id::text,
    pg_catalog.jsonb_build_object('desconto_aprovado_por', null),
    pg_catalog.jsonb_build_object('desconto_aprovado_por', auth.uid(), 'condicao_id', v_o.condicao_id,
                                  'desconto_pct', v_o.desconto_pct));

  return pg_catalog.jsonb_build_object('ok', true, 'oportunidade_id', v_o.id, 'ja_aprovado', false);
end;
$$;
comment on function api.aprovar_desconto(uuid) is '[P30 item 1, C-04 e C-05] Aprovação registrada da diretoria para desconto manual ou condição com requer_aprovacao (oportunidade.desconto_aprovado_por). Só diretoria, AAL2. Evento e log. Idempotente.';


-- =============================================================================
-- 6. Formulário seguro (P30 itens 2 e 3)
-- =============================================================================

create function api.gerar_link_formulario_contrato(oportunidade_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid     uuid := auth.uid();
  v_o       public.oportunidade;
  v_f       public.familia;
  v_k       public.contrato;
  v_cond    public.condicao_comercial;
  v_horas   numeric;
  v_token   text;
  v_expira  timestamptz;
  v_tarefa  uuid;
  v_estagio text;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select o.* into v_o from public.oportunidade o where o.id = gerar_link_formulario_contrato.oportunidade_id for update;
  if not found then
    perform privado.venda_recusar('oportunidade_inexistente');
  end if;
  if v_o.estagio_p2 is null or v_o.estagio_p2 not in ('proposta_enviada', 'em_negociacao', 'ganho') then
    perform privado.venda_recusar('estagio_nao_permite_formulario', coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text));
  end if;

  select f.* into v_f from public.familia f where f.id = v_o.familia_id;
  if v_f.nao_contatar or not privado.freio_permite('operacional', v_f.estado_sensivel) then
    perform privado.venda_recusar('familia_em_estado_sensivel');
  end if;

  select k.* into v_k from public.contrato k
  where k.familia_id = v_f.id and k.status in ('rascunho', 'aguardando_dados')
  order by k.criado_em desc, k.id limit 1
  for update;
  if not found then
    perform privado.venda_recusar('sem_proposta');
  end if;
  if v_k.formulario_token_hash is null and v_k.formulario_expira_em is not null then
    perform privado.venda_recusar('formulario_ja_recebido');
  end if;

  select c.* into v_cond from public.condicao_comercial c where c.id = v_o.condicao_id;
  if (v_o.desconto_pct > 0 or coalesce(v_cond.requer_aprovacao, false)) and v_o.desconto_aprovado_por is null then
    perform privado.venda_recusar('desconto_sem_aprovacao');
  end if;

  v_horas := privado.venda_numero('formulario_contrato', 'validade_horas');
  if v_horas is null or v_horas <= 0 then
    perform privado.venda_recusar('validade_sem_parametro');
  end if;

  -- a família aceitou: o P2 anda até ganho (PRD 7.2 e 10.1 contrato_fechado)
  if v_o.estagio_p2 = 'proposta_enviada' then
    perform privado.transicionar('p2', v_o.id, 'em_negociacao', 'Família aceitou a proposta');
  end if;
  if v_o.estagio_p2 in ('proposta_enviada', 'em_negociacao') then
    perform privado.transicionar('p2', v_o.id, 'ganho', 'Família aceitou a proposta');
  end if;

  v_token := pg_catalog.rtrim(pg_catalog.translate(
               pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_expira := pg_catalog.now() + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision);

  update public.contrato k
     set formulario_token_hash = privado.formulario_hash(v_token),
         formulario_expira_em = v_expira,
         status = 'aguardando_dados'
   where k.id = v_k.id;

  -- a tarefa do envio: uma aberta por contrato; o link não fica nela.
  select t.id into v_tarefa from public.tarefa t
  where t.familia_id = v_f.id and t.tipo = 'enviar_formulario_contrato'
    and t.status in ('aberta', 'em_andamento') and t.payload ->> 'contrato_id' = v_k.id::text
  limit 1;
  if v_tarefa is null then
    insert into public.tarefa (tipo, familia_id, responsavel_id, prioridade, titulo, payload, vence_em)
    values ('enviar_formulario_contrato', v_f.id, v_uid, 'alta',
            'Enviar o formulário do contrato para a ' || v_f.nome_exibicao,
            pg_catalog.jsonb_build_object('acao', 'formulario_contrato', 'contrato_id', v_k.id,
                                          'oportunidade_id', v_o.id, 'mensagemChave', 'formulario_contrato',
                                          'categoria', 'operacional',
                                          'telefoneE164', (privado.venda_contato(v_f.id)).telefone_e164),
            pg_catalog.now())
    returning id into v_tarefa;
  end if;

  perform privado.venda_evento(v_f.id, 'formulario',
    'Link do formulário do contrato gerado, válido até ' || privado.formatar_data_hora(v_expira),
    pg_catalog.jsonb_build_object('contrato_id', v_k.id, 'expira_em', v_expira));
  perform privado.venda_log('formulario_link_gerado', 'contrato', v_k.id::text, null,
    pg_catalog.jsonb_build_object('expira_em', v_expira, 'tarefa_id', v_tarefa));

  select o.estagio_p2::text into v_estagio from public.oportunidade o where o.id = v_o.id;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'token', v_token,
    'expira_em', v_expira,
    'contrato_id', v_k.id,
    'tarefa_id', v_tarefa,
    'estagio_p2', v_estagio);
end;
$$;
comment on function api.gerar_link_formulario_contrato(uuid) is '[P30 itens 2 e 3] A família aceitou: P2 até ganho, token de uso único (32 bytes aleatórios, só o sha256 em contrato.formulario_token_hash), validade de parametro.formulario_contrato.validade_horas, contrato em aguardando_dados e tarefa enviar_formulario_contrato (sem o link). Gerar de novo invalida o link anterior. Recusa freio de bloqueio, não contatar, condição sem aprovação e formulário já recebido. Comercial ou diretoria, AAL2. O token volta uma vez e nunca é gravado nem logado.';

-- --- 6.2 limite de tentativas ----------------------------------------------------------
create function privado.formulario_origem(origem text) returns text
  language sql
  stable
  set search_path = ''
  as $$ select privado.hmac_auditoria('formulario:' || coalesce(nullif(pg_catalog.btrim(formulario_origem.origem), ''), 'sem-origem')) $$;
comment on function privado.formulario_origem(text) is '[P30] HMAC da origem (IP) do formulário público com a chave do Vault; o IP nunca é gravado. Sem grant.';

-- 'limite' quando a origem ou o contrato passou do máximo na janela.
create function privado.formulario_limite(origem_hmac text, contrato_id uuid) returns boolean
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_max    numeric := privado.venda_numero('formulario_contrato', 'tentativas_max');
  v_janela numeric := privado.venda_numero('formulario_contrato', 'tentativas_janela_minutos');
  v_desde  timestamptz;
begin
  if v_max is null or v_janela is null then
    return false;
  end if;
  v_desde := pg_catalog.now() - pg_catalog.make_interval(mins => v_janela::integer);
  delete from privado.formulario_tentativa t
   where t.criado_em < pg_catalog.now() - pg_catalog.make_interval(mins => (v_janela * 2)::integer);
  return (select count(*) from privado.formulario_tentativa t
          where t.origem_hmac = formulario_limite.origem_hmac and t.criado_em >= v_desde) >= v_max
      or (formulario_limite.contrato_id is not null
          and (select count(*) from privado.formulario_tentativa t
               where t.contrato_id = formulario_limite.contrato_id and t.criado_em >= v_desde) >= v_max);
end;
$$;
comment on function privado.formulario_limite(text, uuid) is '[P30] Verdadeiro quando a origem, ou o contrato, já tem parametro.formulario_contrato.tentativas_max recusas nos últimos tentativas_janela_minutos. Sem parâmetro, sem limite. Apaga tentativas mais velhas que duas janelas. Sem grant.';

-- Textos do formulário (mensagem_modelo formulario_*), com nome, quem pediu
-- e minutos preenchidos.
create function privado.formulario_textos(nome text, variaveis jsonb) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.substr(m.chave, 12),
                    privado.aplicar_texto(m.texto, formulario_textos.nome, formulario_textos.variaveis)), '{}'::jsonb)
  from public.mensagem_modelo m
  where m.chave like 'formulario\_%' and m.destinatario = 'familia' and m.canal = 'site'
$$;
comment on function privado.formulario_textos(text, jsonb) is '[P30] Textos do formulário público (mensagem_modelo com chave formulario_*, canal site), sem o prefixo na chave e com as variáveis preenchidas. Sem grant.';

-- --- 6.3 abrir -------------------------------------------------------------------------
create function public.formulario_contrato_abrir(token text, origem text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_origem   text := privado.formulario_origem(formulario_contrato_abrir.origem);
  v_k        public.contrato;
  v_o        public.oportunidade;
  v_gestante public.pessoa;
  v_quem     text;
  v_pagador  public.pessoa;
  v_testemunha public.pessoa;
  v_minutos  numeric;
begin
  if privado.formulario_limite(v_origem, null) then
    return pg_catalog.jsonb_build_object('situacao', 'limite',
      'minutos', privado.venda_numero('formulario_contrato', 'tentativas_janela_minutos'),
      'textos', privado.formulario_textos(null, pg_catalog.jsonb_build_object(
                  'minutos', privado.venda_numero('formulario_contrato', 'tentativas_janela_minutos'))));
  end if;

  select k.* into v_k from public.contrato k
  where formulario_contrato_abrir.token is not null
    and pg_catalog.length(formulario_contrato_abrir.token) between 20 and 100
    and k.formulario_token_hash = privado.formulario_hash(formulario_contrato_abrir.token)
    and k.formulario_expira_em > pg_catalog.now()
    and k.status = 'aguardando_dados';
  if not found then
    insert into privado.formulario_tentativa (origem_hmac, motivo) values (v_origem, 'link_invalido');
    return pg_catalog.jsonb_build_object('situacao', 'invalido',
      'textos', privado.formulario_textos(null, '{}'::jsonb));
  end if;
  -- Freio (PRD 8.1): em bloqueio_total ou encerrado_sensivel só há contato
  -- humano e nominal. O link deixa de abrir, com a mesma resposta de link
  -- inválido (quem tem o link não descobre o estado da família) e sem contar
  -- como tentativa recusada.
  if exists (select 1 from public.familia f
             where f.id = v_k.familia_id and f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel')) then
    return pg_catalog.jsonb_build_object('situacao', 'invalido',
      'textos', privado.formulario_textos(null, '{}'::jsonb));
  end if;

  v_o := privado.venda_oportunidade(v_k.familia_id);
  select p.* into v_gestante from public.pessoa p where p.id = v_k.contratante_pessoa_id;
  select p.* into v_pagador from public.pessoa p where p.id = v_k.pagador_pessoa_id;
  select p.* into v_testemunha from public.pessoa p where p.id = v_k.testemunha_pessoa_id;
  select privado.venda_primeiro_nome(pr.nome) into v_quem
  from public.tarefa t join public.perfil pr on pr.id = t.responsavel_id
  where t.familia_id = v_k.familia_id and t.tipo = 'enviar_formulario_contrato'
    and t.payload ->> 'contrato_id' = v_k.id::text
  order by t.criado_em desc limit 1;
  v_minutos := privado.venda_numero('formulario_contrato', 'duracao_minutos');

  return pg_catalog.jsonb_build_object(
    'situacao', 'valido',
    'expira_em', v_k.formulario_expira_em,
    'para_quem', coalesce(v_o.para_quem, 'propria'),
    'pede_pagador', v_k.pagador_pessoa_id is not null,
    'gestante', pg_catalog.jsonb_build_object('nome', v_gestante.nome),
    'pagador', case when v_pagador.id is not null then pg_catalog.jsonb_build_object('nome', v_pagador.nome) end,
    'testemunha', case when v_testemunha.id is not null then pg_catalog.jsonb_build_object('nome', v_testemunha.nome) end,
    'termo_versao', privado.venda_parametro('termo_lgpd_contrato_versao') #>> '{}',
    'textos', privado.formulario_textos(privado.venda_primeiro_nome(v_gestante.nome),
                pg_catalog.jsonb_build_object('quem_pediu', coalesce(v_quem, 'A equipe da Kraamzorg'),
                                              'minutos', v_minutos,
                                              'pagador', privado.venda_primeiro_nome(v_pagador.nome))));
end;
$$;
comment on function public.formulario_contrato_abrir(text, text) is '[P30 item 2] Abre o formulário seguro pelo token: sem usuário, chamada só pelo servidor do app com o cliente de serviço. Devolve limite, invalido (vencido, usado ou inexistente, sem distinguir) ou valido com o primeiro nome, quem pediu, se pede pagador, a testemunha sugerida, a versão do termo LGPD e os textos formulario_*. Nunca devolve CPF, e-mail ou endereço. Link inválido conta como tentativa recusada da origem (HMAC do IP).';

-- --- 6.4 enviar ------------------------------------------------------------------------
-- dados: {
--   gestante:   {nome_completo, cpf, data_nascimento (aaaa-mm-dd), email,
--                endereco: {cep, logradouro, numero, complemento, bairro, cidade, uf}},
--   atendimento_no_mesmo_endereco: boolean,
--   endereco_atendimento: {...mesmo formato, quando não é o mesmo},
--   pagador:    {nome_completo, cpf, email, endereco} (só quando o contrato tem pagador),
--   testemunha: {nome_completo, email} (opcional),
--   consentimento: {aceito: true, versao}
-- }
create function privado.formulario_endereco_valido(e jsonb) returns boolean
  language sql
  immutable
  set search_path = ''
  as $$
  select pg_catalog.jsonb_typeof(formulario_endereco_valido.e) = 'object'
     and coalesce(pg_catalog.regexp_replace(formulario_endereco_valido.e ->> 'cep', '[^0-9]', '', 'g'), '') ~ '^[0-9]{8}$'
     and pg_catalog.length(pg_catalog.btrim(coalesce(formulario_endereco_valido.e ->> 'logradouro', ''))) between 2 and 200
     and pg_catalog.length(pg_catalog.btrim(coalesce(formulario_endereco_valido.e ->> 'numero', ''))) between 1 and 20
     and pg_catalog.length(pg_catalog.btrim(coalesce(formulario_endereco_valido.e ->> 'bairro', ''))) between 2 and 120
     and pg_catalog.length(pg_catalog.btrim(coalesce(formulario_endereco_valido.e ->> 'cidade', ''))) between 2 and 120
     and pg_catalog.upper(coalesce(formulario_endereco_valido.e ->> 'uf', '')) ~ '^[A-Z]{2}$'
     and pg_catalog.length(coalesce(formulario_endereco_valido.e ->> 'complemento', '')) <= 120
$$;
comment on function privado.formulario_endereco_valido(jsonb) is '[P30] Endereço com CEP de 8 dígitos, logradouro, número, bairro, cidade e UF. Sem grant.';

create function privado.formulario_endereco_limpo(e jsonb) returns jsonb
  language sql
  immutable
  set search_path = ''
  as $$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'cep', pg_catalog.regexp_replace(formulario_endereco_limpo.e ->> 'cep', '[^0-9]', '', 'g'),
    'logradouro', pg_catalog.btrim(formulario_endereco_limpo.e ->> 'logradouro'),
    'numero', pg_catalog.btrim(formulario_endereco_limpo.e ->> 'numero'),
    'complemento', nullif(pg_catalog.btrim(coalesce(formulario_endereco_limpo.e ->> 'complemento', '')), ''),
    'bairro', pg_catalog.btrim(formulario_endereco_limpo.e ->> 'bairro'),
    'cidade', pg_catalog.btrim(formulario_endereco_limpo.e ->> 'cidade'),
    'uf', pg_catalog.upper(pg_catalog.btrim(formulario_endereco_limpo.e ->> 'uf'))))
$$;
comment on function privado.formulario_endereco_limpo(jsonb) is '[P30] Endereço só com as chaves conhecidas, CEP em dígitos e UF maiúscula. Sem grant.';

create function privado.formulario_nome_valido(nome text) returns boolean
  language sql
  immutable
  set search_path = ''
  as $$
  select pg_catalog.btrim(coalesce(formulario_nome_valido.nome, '')) ~ '^[[:alpha:]''.-]+( [[:alpha:]''.-]+)+$'
     and pg_catalog.length(pg_catalog.btrim(formulario_nome_valido.nome)) <= 160
$$;
comment on function privado.formulario_nome_valido(text) is '[P30] Nome completo: duas palavras ou mais, só letras, apóstrofo, ponto e hífen, até 160 caracteres. Sem grant.';

create function privado.formulario_email_valido(email text) returns boolean
  language sql
  immutable
  set search_path = ''
  as $$
  select coalesce(pg_catalog.btrim(formulario_email_valido.email), '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
     and pg_catalog.length(pg_catalog.btrim(formulario_email_valido.email)) <= 200
$$;
comment on function privado.formulario_email_valido(text) is '[P30] E-mail com uma arroba e domínio com ponto, até 200 caracteres. Sem grant.';

create function public.formulario_contrato_enviar(token text, dados jsonb, origem text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_origem    text := privado.formulario_origem(formulario_contrato_enviar.origem);
  v_k         public.contrato;
  v_g         jsonb := formulario_contrato_enviar.dados -> 'gestante';
  v_p         jsonb := formulario_contrato_enviar.dados -> 'pagador';
  v_t         jsonb := formulario_contrato_enviar.dados -> 'testemunha';
  v_mesmo     boolean := case when pg_catalog.jsonb_typeof(formulario_contrato_enviar.dados -> 'atendimento_no_mesmo_endereco') = 'boolean'
                                then (formulario_contrato_enviar.dados ->> 'atendimento_no_mesmo_endereco')::boolean
                                else true end;
  v_atend     jsonb := formulario_contrato_enviar.dados -> 'endereco_atendimento';
  v_versao    text := privado.venda_parametro('termo_lgpd_contrato_versao') #>> '{}';
  v_erros     jsonb := '{}'::jsonb;
  v_nasc      date;
  v_testemunha uuid;
  v_nome      text;
  v_quem      uuid;
begin
  if privado.formulario_limite(v_origem, null) then
    return pg_catalog.jsonb_build_object('situacao', 'limite',
      'minutos', privado.venda_numero('formulario_contrato', 'tentativas_janela_minutos'));
  end if;

  select k.* into v_k from public.contrato k
  where formulario_contrato_enviar.token is not null
    and pg_catalog.length(formulario_contrato_enviar.token) between 20 and 100
    and k.formulario_token_hash = privado.formulario_hash(formulario_contrato_enviar.token)
    and k.formulario_expira_em > pg_catalog.now()
    and k.status = 'aguardando_dados'
  for update;
  if not found then
    insert into privado.formulario_tentativa (origem_hmac, motivo) values (v_origem, 'link_invalido');
    return pg_catalog.jsonb_build_object('situacao', 'invalido');
  end if;
  if exists (select 1 from public.familia f
             where f.id = v_k.familia_id and f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel')) then
    return pg_catalog.jsonb_build_object('situacao', 'invalido');
  end if;
  if privado.formulario_limite(v_origem, v_k.id) then
    return pg_catalog.jsonb_build_object('situacao', 'limite',
      'minutos', privado.venda_numero('formulario_contrato', 'tentativas_janela_minutos'));
  end if;

  -- validação (a mesma do app, de novo aqui: o banco não confia no navegador)
  if pg_catalog.jsonb_typeof(v_g) is distinct from 'object' then
    v_erros := v_erros || '{"gestante":"obrigatorio"}';
  else
    if not privado.formulario_nome_valido(v_g ->> 'nome_completo') then
      v_erros := v_erros || '{"gestante.nome_completo":"invalido"}';
    end if;
    if not coalesce(privado.cpf_valido(v_g ->> 'cpf'), false) then
      v_erros := v_erros || '{"gestante.cpf":"invalido"}';
    end if;
    begin
      v_nasc := (v_g ->> 'data_nascimento')::date;
    exception when others then
      v_nasc := null;
    end;
    if v_nasc is null or v_nasc >= (pg_catalog.now() at time zone 'America/Sao_Paulo')::date or v_nasc < date '1900-01-01' then
      v_erros := v_erros || '{"gestante.data_nascimento":"invalido"}';
    end if;
    if not privado.formulario_email_valido(v_g ->> 'email') then
      v_erros := v_erros || '{"gestante.email":"invalido"}';
    end if;
    if not privado.formulario_endereco_valido(v_g -> 'endereco') then
      v_erros := v_erros || '{"gestante.endereco":"invalido"}';
    end if;
  end if;
  if not v_mesmo and not privado.formulario_endereco_valido(v_atend) then
    v_erros := v_erros || '{"endereco_atendimento":"invalido"}';
  end if;
  if v_k.pagador_pessoa_id is not null then
    if pg_catalog.jsonb_typeof(v_p) is distinct from 'object' then
      v_erros := v_erros || '{"pagador":"obrigatorio"}';
    else
      if not privado.formulario_nome_valido(v_p ->> 'nome_completo') then
        v_erros := v_erros || '{"pagador.nome_completo":"invalido"}';
      end if;
      if not coalesce(privado.cpf_valido(v_p ->> 'cpf'), false) then
        v_erros := v_erros || '{"pagador.cpf":"invalido"}';
      elsif pg_catalog.regexp_replace(v_p ->> 'cpf', '[^0-9]', '', 'g')
            = pg_catalog.regexp_replace(coalesce(v_g ->> 'cpf', ''), '[^0-9]', '', 'g') then
        v_erros := v_erros || '{"pagador.cpf":"igual_gestante"}';
      end if;
      if not privado.formulario_email_valido(v_p ->> 'email') then
        v_erros := v_erros || '{"pagador.email":"invalido"}';
      end if;
      if not privado.formulario_endereco_valido(v_p -> 'endereco') then
        v_erros := v_erros || '{"pagador.endereco":"invalido"}';
      end if;
    end if;
  end if;
  if pg_catalog.jsonb_typeof(v_t) = 'object'
     and coalesce(pg_catalog.btrim(v_t ->> 'nome_completo'), '') <> '' then
    if not privado.formulario_nome_valido(v_t ->> 'nome_completo') then
      v_erros := v_erros || '{"testemunha.nome_completo":"invalido"}';
    end if;
    if not privado.formulario_email_valido(v_t ->> 'email') then
      v_erros := v_erros || '{"testemunha.email":"invalido"}';
    end if;
  end if;
  if v_versao is null
     or (formulario_contrato_enviar.dados #> '{consentimento,aceito}') is distinct from 'true'::jsonb
     or (formulario_contrato_enviar.dados #>> '{consentimento,versao}') is distinct from v_versao then
    v_erros := v_erros || '{"consentimento":"obrigatorio"}';
  end if;

  if v_erros <> '{}'::jsonb then
    insert into privado.formulario_tentativa (origem_hmac, contrato_id, motivo)
    values (v_origem, v_k.id, 'dados_invalidos');
    return pg_catalog.jsonb_build_object('situacao', 'corrigir', 'erros', v_erros);
  end if;

  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'formulario', true);
  end if;

  -- gestante: nome completo, e-mail, consentimento e dados de contrato
  update public.pessoa p
     set nome = pg_catalog.btrim(v_g ->> 'nome_completo'),
         email = pg_catalog.lower(pg_catalog.btrim(v_g ->> 'email')),
         consentimentos = p.consentimentos || pg_catalog.jsonb_build_object('lgpd_contrato', pg_catalog.jsonb_build_object(
                            'aceito', true, 'versao', v_versao, 'em', pg_catalog.now(), 'canal', 'formulario'))
   where p.id = v_k.contratante_pessoa_id;

  insert into public.pessoa_dados_contrato (pessoa_id, cpf, data_nascimento, endereco_residencial, preenchido_via)
  values (v_k.contratante_pessoa_id, pg_catalog.regexp_replace(v_g ->> 'cpf', '[^0-9]', '', 'g'), v_nasc,
          privado.formulario_endereco_limpo(v_g -> 'endereco'), 'formulario_seguro')
  on conflict (pessoa_id) do update
    set cpf = excluded.cpf, data_nascimento = excluded.data_nascimento,
        endereco_residencial = excluded.endereco_residencial, preenchido_via = excluded.preenchido_via;

  update public.familia f
     set endereco_atendimento = case when v_mesmo then privado.formulario_endereco_limpo(v_g -> 'endereco')
                                     else privado.formulario_endereco_limpo(v_atend) end
   where f.id = v_k.familia_id;

  -- pagador (presente, C-10)
  if v_k.pagador_pessoa_id is not null then
    update public.pessoa p
       set nome = pg_catalog.btrim(v_p ->> 'nome_completo'),
           email = pg_catalog.lower(pg_catalog.btrim(v_p ->> 'email')),
           consentimentos = p.consentimentos || pg_catalog.jsonb_build_object('lgpd_contrato', pg_catalog.jsonb_build_object(
                              'aceito', true, 'versao', v_versao, 'em', pg_catalog.now(), 'canal', 'formulario'))
     where p.id = v_k.pagador_pessoa_id;
    insert into public.pessoa_dados_contrato (pessoa_id, cpf, endereco_residencial, preenchido_via)
    values (v_k.pagador_pessoa_id, pg_catalog.regexp_replace(v_p ->> 'cpf', '[^0-9]', '', 'g'),
            privado.formulario_endereco_limpo(v_p -> 'endereco'), 'formulario_seguro')
    on conflict (pessoa_id) do update
      set cpf = excluded.cpf, endereco_residencial = excluded.endereco_residencial,
          preenchido_via = excluded.preenchido_via;
  end if;

  -- testemunha (parceiro, prática atual) [confirmar]
  v_testemunha := v_k.testemunha_pessoa_id;
  if pg_catalog.jsonb_typeof(v_t) = 'object' and coalesce(pg_catalog.btrim(v_t ->> 'nome_completo'), '') <> '' then
    v_nome := pg_catalog.btrim(v_t ->> 'nome_completo');
    if v_testemunha is null then
      insert into public.pessoa (familia_id, papel, nome, email)
      values (v_k.familia_id, 'acompanhante', v_nome, pg_catalog.lower(pg_catalog.btrim(v_t ->> 'email')))
      returning id into v_testemunha;
    else
      update public.pessoa p set nome = v_nome, email = pg_catalog.lower(pg_catalog.btrim(v_t ->> 'email'))
       where p.id = v_testemunha;
    end if;
  end if;

  -- o link morre aqui: hash some, e a data passa a ser a do envio
  update public.contrato k
     set formulario_token_hash = null,
         formulario_expira_em = pg_catalog.now(),
         testemunha_pessoa_id = v_testemunha
   where k.id = v_k.id;

  -- a tarefa do envio perde o sentido; avisa quem pediu, sem nome de família
  select t.responsavel_id into v_quem from public.tarefa t
  where t.familia_id = v_k.familia_id and t.tipo = 'enviar_formulario_contrato'
    and t.payload ->> 'contrato_id' = v_k.id::text
  order by t.criado_em desc limit 1;
  update public.tarefa t
     set status = 'concluida', concluida_em = pg_catalog.now()
   where t.familia_id = v_k.familia_id and t.tipo = 'enviar_formulario_contrato'
     and t.payload ->> 'contrato_id' = v_k.id::text and t.status in ('aberta', 'em_andamento');
  insert into public.notificacao (usuario_id, papel, prioridade, titulo, link, canais)
  values (v_quem, case when v_quem is null then 'comercial'::public.papel_usuario end, 'alta',
          'Dados do contrato recebidos pelo formulário seguro',
          '/familias/' || v_k.familia_id::text || '/proposta', '{app}');

  perform privado.venda_evento(v_k.familia_id, 'formulario', 'Dados do contrato recebidos pelo formulário seguro',
    pg_catalog.jsonb_build_object('contrato_id', v_k.id));
  perform privado.venda_log('formulario_contrato_recebido', 'contrato', v_k.id::text, null,
    pg_catalog.jsonb_build_object('pagador', v_k.pagador_pessoa_id is not null,
                                  'testemunha', v_testemunha is not null, 'termo_versao', v_versao));

  return pg_catalog.jsonb_build_object('situacao', 'recebido');
end;
$$;
comment on function public.formulario_contrato_enviar(text, jsonb, text) is '[P30 item 2] Recebe o formulário seguro: sem usuário, chamada só pelo servidor do app (cliente de serviço) depois do Turnstile. Limite de tentativas por origem e por contrato; token válido e não vencido; validação completa de novo (nome, CPF com dígitos verificadores, nascimento, e-mail, endereços, pagador quando há, testemunha opcional, consentimento LGPD na versão vigente). Grava pessoa, pessoa_dados_contrato (auditada com HMAC), endereço de atendimento e consentimento; o token morre (hash nulo, data do envio). Devolve limite, invalido, corrigir (com os campos, nunca os valores) ou recebido.';


-- =============================================================================
-- 7. Execute (ADR 0002 seção 6): api só para authenticated; as duas do
--    formulário público só para service_role; privado sem grant.
-- =============================================================================

revoke execute on function privado.venda_parametro(text)                                         from public, anon, authenticated, service_role;
revoke execute on function privado.venda_numero(text, text)                                      from public, anon, authenticated, service_role;
revoke execute on function privado.venda_recusar(text, text)                                     from public, anon, authenticated, service_role;
revoke execute on function privado.venda_gestante(uuid)                                          from public, anon, authenticated, service_role;
revoke execute on function privado.venda_contato(uuid)                                           from public, anon, authenticated, service_role;
revoke execute on function privado.venda_primeiro_nome(text)                                     from public, anon, authenticated, service_role;
revoke execute on function privado.venda_nome_perfil(uuid)                                       from public, anon, authenticated, service_role;
revoke execute on function privado.venda_criar_tarefa(uuid, public.tipo_tarefa, text, uuid, public.prioridade, timestamptz, text, jsonb, public.categoria_automacao, jsonb)
                                                                                                 from public, anon, authenticated, service_role;
revoke execute on function privado.venda_cancelar_tarefas_sessao(uuid)                           from public, anon, authenticated, service_role;
revoke execute on function privado.venda_criar_lembrete(uuid, uuid)                              from public, anon, authenticated, service_role;
revoke execute on function privado.venda_evento(uuid, text, text, jsonb)                         from public, anon, authenticated, service_role;
revoke execute on function privado.venda_log(text, text, text, jsonb, jsonb)                     from public, anon, authenticated, service_role;
revoke execute on function privado.venda_oportunidade(uuid)                                      from public, anon, authenticated, service_role;
revoke execute on function privado.venda_conta(integer, integer, integer, integer)               from public, anon, authenticated, service_role;
revoke execute on function privado.venda_calcular(integer, integer, numeric, integer)            from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_hash(text)                                         from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_situacao(text, timestamptz)                        from public, anon, authenticated, service_role;
revoke execute on function privado.venda_pode_gravacao(uuid)                                     from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_origem(text)                                       from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_limite(text, uuid)                                 from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_textos(text, jsonb)                                from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_endereco_valido(jsonb)                             from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_endereco_limpo(jsonb)                              from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_nome_valido(text)                                  from public, anon, authenticated, service_role;
revoke execute on function privado.formulario_email_valido(text)                                 from public, anon, authenticated, service_role;

revoke execute on function api.condutores_sessao_venda()                                          from public, anon, service_role;
revoke execute on function api.sessoes_venda(timestamptz, timestamptz, uuid, uuid)                from public, anon, service_role;
revoke execute on function api.agendar_sessao_venda(uuid, timestamptz, uuid, text, text, uuid)    from public, anon, service_role;
revoke execute on function api.remarcar_sessao_venda(uuid, timestamptz, text, uuid)               from public, anon, service_role;
revoke execute on function api.registrar_desfecho_sessao_venda(uuid, public.status_sessao, boolean) from public, anon, service_role;
revoke execute on function api.registrar_gravacao_sessao_venda(uuid, boolean, text)               from public, anon, service_role;
revoke execute on function api.salvar_resumo_sessao_venda(uuid, jsonb)                            from public, anon, service_role;
revoke execute on function api.proposta(uuid)                                                     from public, anon, service_role;
revoke execute on function api.salvar_proposta(uuid, uuid, integer, uuid, text, uuid, text, numeric, text) from public, anon, service_role;
revoke execute on function api.aprovar_desconto(uuid)                                             from public, anon, service_role;
revoke execute on function api.gerar_link_formulario_contrato(uuid)                               from public, anon, service_role;

grant execute on function api.condutores_sessao_venda()                                          to authenticated;
grant execute on function api.sessoes_venda(timestamptz, timestamptz, uuid, uuid)                to authenticated;
grant execute on function api.agendar_sessao_venda(uuid, timestamptz, uuid, text, text, uuid)    to authenticated;
grant execute on function api.remarcar_sessao_venda(uuid, timestamptz, text, uuid)               to authenticated;
grant execute on function api.registrar_desfecho_sessao_venda(uuid, public.status_sessao, boolean) to authenticated;
grant execute on function api.registrar_gravacao_sessao_venda(uuid, boolean, text)               to authenticated;
grant execute on function api.salvar_resumo_sessao_venda(uuid, jsonb)                            to authenticated;
grant execute on function api.proposta(uuid)                                                     to authenticated;
grant execute on function api.salvar_proposta(uuid, uuid, integer, uuid, text, uuid, text, numeric, text) to authenticated;
grant execute on function api.aprovar_desconto(uuid)                                             to authenticated;
grant execute on function api.gerar_link_formulario_contrato(uuid)                               to authenticated;

revoke execute on function public.formulario_contrato_abrir(text, text)         from public, anon, authenticated;
revoke execute on function public.formulario_contrato_enviar(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.formulario_contrato_abrir(text, text)         to service_role;
grant execute on function public.formulario_contrato_enviar(text, jsonb, text) to service_role;


-- =============================================================================
-- 8. Trava (falha a migration se quebrar): mesma regra de 0017 para api;
--    em public, só public.ig (sem execute do app) e as duas do formulário
--    (só service_role).
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
    and p.proname like 'formulario\_contrato\_%'
    and (not p.prosecdef
         or not coalesce(p.proconfig @> array['search_path=""'], false)
         or has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
         or not has_function_privilege('service_role', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função do formulário público fora da regra (security definer, search_path vazio, só service_role): %', v_lista;
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
