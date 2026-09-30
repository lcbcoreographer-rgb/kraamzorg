-- =============================================================================
-- 0027_relacao.sql
--
-- Fase 3 de relacionamento: P47 (marketing, atribuição e página de captação),
-- P48 (copiloto interno), P49 (portal da família), P50 (indicações e parceiros
-- médicos) e P51 (tarefas por equipe, manuais, treinamentos e banco de
-- talentos) · PROMPTS.md v2 · PRD 6.2 (origem, codigo_origem, utm, medico sem
-- família), 8 (freio), 12 (módulos da fase 3), 13 (permissões), 14 (captação),
-- 20.3 (tom), 21.3 (formulários públicos) e 22.1 (T-02).
--
-- Esta migration NÃO foi aplicada em ambiente nenhum: escrita, testada no
-- banco local (supabase/sem-docker) e parada para revisão humana do SQL
-- (CLAUDE.md). Nenhum dado aqui: parâmetros, textos e o roteiro de seleção
-- ficam em supabase/dados/relacao_seed.sql.
--
-- Todas as tabelas novas ficam em `privado` (RLS ligada, nenhum grant): o app
-- só chega a elas pelas funções do schema `api`, que conferem papel e AAL
-- dentro (security definer, search_path vazio, execute só para authenticated).
-- As páginas públicas (captação, candidatura, link do portal) chamam funções
-- de `public` que só o service_role executa, como o formulário do contrato
-- (0018); nenhuma delas devolve dado pessoal.
--
-- O que esta migration faz, na ordem:
--   1. Auxiliares: recusa de negócio ("relacao:<código>"), linha de log e
--      limite de tentativas das páginas públicas (origem em HMAC, nunca o IP).
--   2. P47: canais de captação, visitas da página, origem da conversa, custo
--      por canal; agente.registrar_mensagem passa a ler o código de origem na
--      primeira mensagem; relatório de receita e custo por origem e canal;
--      exportação só a partir de familia_elegivel_marketing.
--   3. P48: perguntas do copiloto, custo do mês e o conjunto fechado de
--      funções de leitura que o modelo pode escolher.
--   4. P49: acesso da família ao portal (link mágico), autorização da
--      enfermeira para nome e foto, e o portal (api.portal_familia).
--   5. P50: parceiros médicos sem contrapartida financeira e indicações.
--   6. P51: tarefas por equipe, manuais com versão e confirmação de leitura,
--      trilhas de treinamento e banco de talentos com a página pública
--      desligada por parâmetro.
--   7. Trava (falha a migration se quebrar): mesma regra de 0022 para api.
--
-- Recusa de negócio: erro P0001 com a mensagem "relacao:<código> <detalhe>",
-- que o app troca por uma frase. O detalhe nunca leva dado pessoal.
-- =============================================================================


-- =============================================================================
-- 1. Auxiliares
-- =============================================================================

create function privado.relacao_recusar(codigo text, detalhe text default null) returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
begin
  raise exception 'relacao:% %', relacao_recusar.codigo, coalesce(relacao_recusar.detalhe, '')
    using errcode = 'P0001';
end;
$$;
comment on function privado.relacao_recusar(text, text) is '[P47 a P51] Recusa de negócio: erro P0001 com a mensagem "relacao:<código> <detalhe>", que a tela troca por uma frase. O detalhe nunca leva dado pessoal. Sem grant.';

create function privado.relacao_log(acao text, entidade text, entidade_id text, antes jsonb, depois jsonb) returns void
  language sql
  volatile
  security definer
  set search_path = ''
  as $$
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), relacao_log.acao, relacao_log.entidade, relacao_log.entidade_id, relacao_log.antes, relacao_log.depois,
          coalesce(privado.origem_atual(), 'app'), privado.ip_requisicao())
$$;
comment on function privado.relacao_log(text, text, text, jsonb, jsonb) is '[P47 a P51] Linha de log_auditoria de uma ação de relacionamento. Só ids, contagens, estados e filtros; nunca nome, e-mail, telefone, pergunta ou texto livre. Sem grant.';

-- Limite de tentativas das páginas públicas (captação, link do portal,
-- candidatura). Cada chamada conta; a chave é o HMAC da origem (IP) ou do
-- e-mail com a chave do Vault, nunca o valor. Janela e máximo em parametro.
create table privado.limite_publico (
  id         bigserial primary key,
  criado_em  timestamptz not null default now(),
  escopo     text not null check (escopo in ('captacao', 'portal_link', 'candidatura')),
  chave_hmac text not null
);
comment on table privado.limite_publico is '[P47/P49/P51] Chamadas das páginas públicas para o limite de taxa (PRD 21.3): escopo e HMAC-SHA256 da origem ou do e-mail (chave auditoria_hmac do Vault). Linhas mais velhas que duas janelas são apagadas pela própria função. Sem grant.';
create index on privado.limite_publico (escopo, chave_hmac, criado_em);
alter table privado.limite_publico enable row level security;
revoke all on privado.limite_publico from public, anon, authenticated, service_role;
revoke all on sequence privado.limite_publico_id_seq from public, anon, authenticated, service_role;

-- Verdadeiro quando a chave já passou do máximo na janela. Quando não passou
-- e `registrar` é verdadeiro, conta esta chamada. Sem parâmetro, sem limite.
create function privado.relacao_limite(escopo text, chave text, maximo integer, janela_minutos integer, registrar boolean default true)
  returns boolean
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  v_hmac  text;
  v_desde timestamptz;
begin
  if relacao_limite.maximo is null or relacao_limite.janela_minutos is null then
    return false;
  end if;
  v_hmac := privado.hmac_auditoria('publico:' || relacao_limite.escopo || ':'
              || coalesce(nullif(pg_catalog.btrim(relacao_limite.chave), ''), 'sem-origem'));
  v_desde := pg_catalog.now() - pg_catalog.make_interval(mins => relacao_limite.janela_minutos);
  delete from privado.limite_publico l
   where l.escopo = relacao_limite.escopo
     and l.criado_em < pg_catalog.now() - pg_catalog.make_interval(mins => relacao_limite.janela_minutos * 2);
  if (select pg_catalog.count(*) from privado.limite_publico l
      where l.escopo = relacao_limite.escopo and l.chave_hmac = v_hmac and l.criado_em >= v_desde) >= relacao_limite.maximo then
    return true;
  end if;
  if relacao_limite.registrar then
    insert into privado.limite_publico (escopo, chave_hmac) values (relacao_limite.escopo, v_hmac);
  end if;
  return false;
end;
$$;
comment on function privado.relacao_limite(text, text, integer, integer, boolean) is '[P47/P49/P51] Verdadeiro quando a chave (origem ou e-mail, em HMAC) já fez o máximo de chamadas na janela; senão conta esta chamada. Sem grant.';

-- Telefone em E.164 (PRD 5.2). Número com 10 ou 11 dígitos, sem código do
-- país, é brasileiro: entra com +55. Nulo fora de 8 a 15 dígitos.
create function privado.relacao_telefone(telefone text) returns text
  language sql
  immutable
  set search_path = ''
  as $$
  select case
    when pg_catalog.length(pg_catalog.regexp_replace(coalesce(relacao_telefone.telefone, ''), '\D', '', 'g')) in (10, 11)
         and pg_catalog.btrim(relacao_telefone.telefone) !~ '^\+'
      then '+55' || pg_catalog.regexp_replace(relacao_telefone.telefone, '\D', '', 'g')
    else privado.telefone_e164(relacao_telefone.telefone)
  end
$$;
comment on function privado.relacao_telefone(text) is '[P50/P51] Telefone em E.164; 10 ou 11 dígitos sem código do país ganham +55. Nulo se não for telefone. Sem grant.';

-- Primeiro nome, para os textos que chamam a pessoa pelo nome.
create function privado.relacao_primeiro_nome(nome text) returns text
  language sql
  immutable
  set search_path = ''
  as $$ select nullif(pg_catalog.split_part(pg_catalog.btrim(relacao_primeiro_nome.nome), ' ', 1), '') $$;
comment on function privado.relacao_primeiro_nome(text) is '[P49] Primeiro nome de um nome completo. Sem grant.';

-- Colunas com texto livre ou dado pessoal das tabelas novas: o log grava
-- "[oculto]" e o HMAC (PRD 13 [v4.2]). A fonte 'sessao_p05' é a única que a
-- restrição da 0005 aceita além de prd_13 e sessao_p36; nomear outra exigiria
-- mexer numa restrição que outras migrations também alteram.
insert into privado.auditoria_coluna_sensivel (entidade, coluna, fonte) values
  ('privado.copiloto_pergunta', 'pergunta', 'sessao_p05'),
  ('privado.copiloto_pergunta', 'parametros', 'sessao_p05'),
  ('privado.parceiro_medico', 'observacao', 'sessao_p05'),
  ('privado.indicacao', 'observacao', 'sessao_p05'),
  ('privado.manual_versao', 'conteudo', 'sessao_p05'),
  ('privado.candidata', 'nome', 'sessao_p05'),
  ('privado.candidata', 'telefone_e164', 'sessao_p05'),
  ('privado.candidata', 'email', 'sessao_p05'),
  ('privado.candidata', 'cidade', 'sessao_p05'),
  ('privado.candidata', 'conselho', 'sessao_p05'),
  ('privado.candidata', 'apresentacao', 'sessao_p05'),
  ('privado.candidata', 'observacoes', 'sessao_p05'),
  ('privado.candidata', 'consentimento', 'sessao_p05'),
  ('privado.candidata_avaliacao', 'respostas', 'sessao_p05'),
  ('privado.candidata_avaliacao', 'observacoes', 'sessao_p05');


-- =============================================================================
-- 2. P47 · Marketing, atribuição e página de captação
--
-- Cada canal (bio do Instagram, anúncio, site...) tem um código curto. O link
-- wa.me leva o código no texto pré-preenchido ("KZ-IGBIO"); a página /c/<canal>
-- soma a ele um código de visita ("KZ-IGBIO-7F3K2A") que guarda os UTM sem
-- pedir nada à pessoa. agente.registrar_mensagem lê o código na primeira
-- mensagem da conversa e grava a origem: na família, assim que a conversa
-- estiver ligada a uma (regra do primeiro contato, só onde a origem ainda é
-- "desconhecida" e sem código).
-- =============================================================================

create table privado.canal_captacao (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por    uuid references public.perfil(id),
  codigo        text not null unique check (codigo ~ '^[A-Z0-9]{3,12}$'),
  nome          text not null check (pg_catalog.char_length(pg_catalog.btrim(nome)) between 2 and 80),
  origem        public.origem_lead not null check (origem <> 'desconhecida'),
  ativo         boolean not null default true
);
comment on table privado.canal_captacao is '[P47] Canal de captação (PRD 14, T-02): código curto do link wa.me e da página /c/<código>, a origem_lead que ele grava na família e se está ativo. Canal desativado continua valendo para link antigo que ainda circula. Editado por api.marketing_canal_salvar.';
comment on column privado.canal_captacao.codigo is 'Maiúsculas e dígitos, de 3 a 12; entra no texto pré-preenchido depois do prefixo de parametro.captacao.';
create index on privado.canal_captacao (criado_por);
create trigger tocar_atualizado_em before update on privado.canal_captacao
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.canal_captacao
  for each row execute function privado.auditar('id');
alter table privado.canal_captacao enable row level security;
revoke all on privado.canal_captacao from public, anon, authenticated, service_role;

create table privado.captacao_visita (
  id        uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  canal_id  uuid not null references privado.canal_captacao(id),
  token     text not null unique check (token ~ '^[A-Z0-9]{6}$'),
  utm       jsonb not null default '{}',
  usada_em  timestamptz
);
comment on table privado.captacao_visita is '[P47] Visita à página de captação que chegou ao botão do WhatsApp: código de seis caracteres que vai no texto da mensagem e os UTM limpos (só as cinco chaves utm_*). Nenhum dado da pessoa, nem IP. Usada uma vez, na primeira mensagem da conversa.';
create index on privado.captacao_visita (canal_id);
alter table privado.captacao_visita enable row level security;
revoke all on privado.captacao_visita from public, anon, authenticated, service_role;

create table privado.conversa_origem (
  conversa_id uuid primary key references public.conversa(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  canal_id    uuid not null references privado.canal_captacao(id),
  codigo      text not null,
  visita_id   uuid references privado.captacao_visita(id),
  utm         jsonb not null default '{}',
  familia_id  uuid references public.familia(id) on delete set null
);
comment on table privado.conversa_origem is '[P47] Origem lida da primeira mensagem da conversa (agente.registrar_mensagem). A família recebe origem, codigo_origem e utm quando a conversa é ligada a ela (gatilho em conversa.familia_id); familia_id daqui é a que recebeu.';
create index on privado.conversa_origem (canal_id);
create index on privado.conversa_origem (visita_id);
create index on privado.conversa_origem (familia_id);
alter table privado.conversa_origem enable row level security;
revoke all on privado.conversa_origem from public, anon, authenticated, service_role;

create table privado.custo_canal (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  criado_por     uuid references public.perfil(id),
  canal_id       uuid not null references privado.canal_captacao(id),
  mes            date not null check (mes = pg_catalog.date_trunc('month', mes)::date),
  valor_centavos integer not null check (valor_centavos >= 0),
  fonte          text not null default 'manual' check (fonte in ('manual', 'lancamento')),
  unique (canal_id, mes)
);
comment on table privado.custo_canal is '[P47] Custo do mês por canal, em centavos (PRD 5.2). Vem do financeiro: digitado por financeiro ou diretoria (fonte manual) ou, quando o P46 existir, importado dos lançamentos (fonte lancamento). Nunca gatilho de nada.';
create index on privado.custo_canal (criado_por);
create trigger tocar_atualizado_em before update on privado.custo_canal
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.custo_canal
  for each row execute function privado.auditar('id');
alter table privado.custo_canal enable row level security;
revoke all on privado.custo_canal from public, anon, authenticated, service_role;


-- --- Código de origem no texto da mensagem ------------------------------------

-- Lê "<prefixo>-<CANAL>" ou "<prefixo>-<CANAL>-<VISITA>" de qualquer ponto do
-- texto (sem caixa). O prefixo mora em parametro.captacao. Sem prefixo ou sem
-- código, devolve nulos.
create function privado.captacao_ler_codigo(texto text, out codigo text, out token text)
  returns record
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_prefixo text := pg_catalog.regexp_replace(pg_catalog.upper(coalesce(privado.venda_parametro('captacao') ->> 'prefixo', '')), '[^A-Z0-9]', '', 'g');
  v_m       text[];
begin
  if captacao_ler_codigo.texto is null or v_prefixo = '' then
    return;
  end if;
  v_m := pg_catalog.regexp_match(pg_catalog.upper(captacao_ler_codigo.texto),
           '(?:^|[^A-Z0-9])' || v_prefixo || '-([A-Z0-9]{3,12})(?:-([A-Z0-9]{6}))?(?![A-Z0-9])');
  if v_m is null then
    return;
  end if;
  codigo := v_m[1];
  token := v_m[2];
end;
$$;
comment on function privado.captacao_ler_codigo(text) is '[P47] Código de canal (e de visita, se houver) escrito no texto da primeira mensagem: "<prefixo>-<CANAL>[-<VISITA>]". Nulos se não houver. Sem grant.';

-- Aplica a origem guardada na conversa à família ligada a ela. Primeiro
-- contato vale: só onde a origem ainda é desconhecida e não tem código.
create function privado.captacao_aplicar(conversa_id uuid) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_o       privado.conversa_origem;
  v_canal   privado.canal_captacao;
  v_familia uuid;
begin
  select o.* into v_o from privado.conversa_origem o where o.conversa_id = captacao_aplicar.conversa_id;
  if not found or v_o.familia_id is not null then
    return;
  end if;
  select c.familia_id into v_familia from public.conversa c where c.id = captacao_aplicar.conversa_id;
  if v_familia is null then
    return;
  end if;
  select k.* into v_canal from privado.canal_captacao k where k.id = v_o.canal_id;

  update public.familia f
     set origem = v_canal.origem,
         codigo_origem = v_o.codigo,
         utm = case when v_o.utm = '{}'::jsonb then f.utm else v_o.utm end
   where f.id = v_familia
     and f.mesclada_em_id is null
     and f.codigo_origem is null
     and f.origem = 'desconhecida';
  if found then
    update privado.conversa_origem o set familia_id = v_familia where o.conversa_id = captacao_aplicar.conversa_id;
    perform privado.venda_evento(v_familia, 'origem', 'Origem registrada pelo link do canal',
      pg_catalog.jsonb_build_object('canal', v_canal.codigo, 'origem', v_canal.origem));
  end if;
end;
$$;
comment on function privado.captacao_aplicar(uuid) is '[P47] Grava origem, codigo_origem e utm na família ligada à conversa, uma vez (primeiro contato vale: só onde origem = desconhecida e sem código). Registra o evento na linha do tempo. Sem grant.';

create function privado.captacao_registrar_na_conversa(conversa_id uuid, texto text) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_l      record;
  v_canal  privado.canal_captacao;
  v_visita privado.captacao_visita;
begin
  if exists (select 1 from privado.conversa_origem o where o.conversa_id = captacao_registrar_na_conversa.conversa_id) then
    return;
  end if;
  select * into v_l from privado.captacao_ler_codigo(captacao_registrar_na_conversa.texto);
  if v_l.codigo is null then
    return;
  end if;
  select k.* into v_canal from privado.canal_captacao k where k.codigo = v_l.codigo;
  if not found then
    return;
  end if;
  if v_l.token is not null then
    update privado.captacao_visita v
       set usada_em = pg_catalog.now()
     where v.token = v_l.token and v.canal_id = v_canal.id and v.usada_em is null
    returning v.* into v_visita;
  end if;
  insert into privado.conversa_origem (conversa_id, canal_id, codigo, visita_id, utm)
  values (captacao_registrar_na_conversa.conversa_id, v_canal.id, v_canal.codigo, v_visita.id,
          coalesce(v_visita.utm, '{}'::jsonb));
  perform privado.captacao_aplicar(captacao_registrar_na_conversa.conversa_id);
end;
$$;
comment on function privado.captacao_registrar_na_conversa(uuid, text) is '[P47] Lê o código de origem da primeira mensagem da conversa e grava privado.conversa_origem (uma por conversa); código de canal desconhecido é ignorado. Chamada por agente.registrar_mensagem. Sem grant.';

create function privado.captacao_gatilho_conversa() returns trigger
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.captacao_aplicar(new.id);
  return null;
end;
$$;
comment on function privado.captacao_gatilho_conversa() is '[P47] Gatilho AFTER UPDATE OF familia_id em conversa: quando a conversa passa a ter família, aplica a origem lida da primeira mensagem. Sem grant.';
create trigger captacao_origem after update of familia_id on public.conversa
  for each row when (new.familia_id is not null and new.familia_id is distinct from old.familia_id)
  execute function privado.captacao_gatilho_conversa();


-- --- Textos do site e UTM ------------------------------------------------------

-- Textos de mensagem_modelo com o prefixo (canal site, para a família), sem o
-- prefixo na chave e com as variáveis preenchidas. Rascunho também vale: o
-- texto é o que o Leonardo vai aprovar, como o do formulário do contrato.
create function privado.textos_site(prefixo text, nome text default null, variaveis jsonb default '{}') returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.substr(m.chave, pg_catalog.char_length(textos_site.prefixo) + 1),
                    privado.aplicar_texto(m.texto, textos_site.nome, textos_site.variaveis)), '{}'::jsonb)
  from public.mensagem_modelo m
  where pg_catalog.left(m.chave, pg_catalog.char_length(textos_site.prefixo)) = textos_site.prefixo
    and m.destinatario = 'familia' and m.canal = 'site'
$$;
comment on function privado.textos_site(text, text, jsonb) is '[P47/P49/P51] Textos de mensagem_modelo (canal site, para a família) cuja chave começa com o prefixo, sem o prefixo na chave e com nome e variáveis preenchidos. Sem grant.';

-- Só as cinco chaves utm_*, cada uma texto curto sem caracteres estranhos.
create function privado.captacao_utm(utm jsonb) returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_max   integer := coalesce(privado.venda_numero('captacao', 'utm_tamanho_max'), 80)::integer;
  v_chave text;
  v_saida jsonb := '{}'::jsonb;
  v_valor text;
begin
  if captacao_utm.utm is null or pg_catalog.jsonb_typeof(captacao_utm.utm) <> 'object' then
    return v_saida;
  end if;
  foreach v_chave in array array['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] loop
    v_valor := captacao_utm.utm ->> v_chave;
    if v_valor is not null
       and pg_catalog.char_length(v_valor) between 1 and v_max
       and v_valor ~ '^[A-Za-z0-9 _.,:+~%/-]+$' then
      v_saida := v_saida || pg_catalog.jsonb_build_object(v_chave, v_valor);
    end if;
  end loop;
  return v_saida;
end;
$$;
comment on function privado.captacao_utm(jsonb) is '[P47] Limpa os UTM da página de captação: só utm_source, utm_medium, utm_campaign, utm_content e utm_term, texto curto (parametro.captacao.utm_tamanho_max) e sem caracteres fora de letras, números e pontuação simples. Sem grant.';

create function privado.captacao_token() returns text
  language plpgsql
  volatile
  set search_path = ''
  as $$
declare
  c_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes    bytea := extensions.gen_random_bytes(6);
  v_saida    text := '';
  i          integer;
begin
  for i in 0..5 loop
    v_saida := v_saida || pg_catalog.substr(c_alfabeto, (pg_catalog.get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return v_saida;
end;
$$;
comment on function privado.captacao_token() is '[P47] Código de visita de seis caracteres, sem I, L, O, 0 e 1. Sem grant.';


-- --- Páginas públicas (só o servidor, com o cliente de serviço) -----------------

create function public.captacao_pagina(canal text) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_ativo boolean;
begin
  select k.ativo into v_ativo from privado.canal_captacao k
  where k.codigo = pg_catalog.upper(pg_catalog.btrim(captacao_pagina.canal));
  if not found or not v_ativo then
    return pg_catalog.jsonb_build_object('situacao', 'indisponivel', 'textos', privado.textos_site('captacao_'));
  end if;
  return pg_catalog.jsonb_build_object('situacao', 'ok', 'textos', privado.textos_site('captacao_'));
end;
$$;
comment on function public.captacao_pagina(text) is '[P47] Textos da página /c/<canal> e se o canal existe e está ativo. Só o servidor do app (service_role). Não devolve nome, origem nem custo do canal.';

create function public.captacao_iniciar(canal text, utm jsonb default '{}', origem text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_cfg     jsonb := privado.venda_parametro('captacao');
  v_canal   privado.canal_captacao;
  v_utm     jsonb := privado.captacao_utm(captacao_iniciar.utm);
  v_token   text;
  v_codigo  text;
  v_texto   text;
  v_tentou  integer := 0;
begin
  if privado.relacao_limite('captacao', captacao_iniciar.origem,
       (v_cfg ->> 'tentativas_max')::integer, (v_cfg ->> 'janela_minutos')::integer, true) then
    return pg_catalog.jsonb_build_object('situacao', 'limite', 'minutos', (v_cfg ->> 'janela_minutos')::integer,
                                         'textos', privado.textos_site('captacao_'));
  end if;
  select k.* into v_canal from privado.canal_captacao k
  where k.codigo = pg_catalog.upper(pg_catalog.btrim(captacao_iniciar.canal)) and k.ativo;
  if not found or v_cfg is null or nullif(v_cfg ->> 'numero_whatsapp_e164', '') is null then
    return pg_catalog.jsonb_build_object('situacao', 'indisponivel', 'textos', privado.textos_site('captacao_'));
  end if;

  loop
    v_token := privado.captacao_token();
    begin
      insert into privado.captacao_visita (canal_id, token, utm) values (v_canal.id, v_token, v_utm);
      exit;
    exception when unique_violation then
      v_tentou := v_tentou + 1;
      if v_tentou > 8 then
        return pg_catalog.jsonb_build_object('situacao', 'indisponivel', 'textos', privado.textos_site('captacao_'));
      end if;
    end;
  end loop;

  v_codigo := (v_cfg ->> 'prefixo') || '-' || v_canal.codigo || '-' || v_token;
  select privado.aplicar_texto(m.texto, null, pg_catalog.jsonb_build_object('codigo', v_codigo)) into v_texto
  from public.mensagem_modelo m where m.chave = 'captacao_whatsapp';
  return pg_catalog.jsonb_build_object(
    'situacao', 'ok',
    'numero_e164', v_cfg ->> 'numero_whatsapp_e164',
    'codigo', v_codigo,
    'texto', v_texto,
    'textos', privado.textos_site('captacao_'));
end;
$$;
comment on function public.captacao_iniciar(text, jsonb, text) is '[P47] Chamada depois do Turnstile: limite por origem (HMAC do IP, parametro.captacao), cria a visita com os UTM limpos e devolve número, código e texto pré-preenchido do WhatsApp. Só o servidor do app (service_role). Nada da pessoa é pedido nem gravado.';


-- --- api: canais, custo, relatório e exportação ----------------------------------

create function api.marketing_canais() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_cfg jsonb := privado.venda_parametro('captacao');
begin
  perform privado.autorizar(array['marketing', 'diretoria']::public.papel_usuario[], false);
  return pg_catalog.jsonb_build_object(
    'whatsapp', pg_catalog.jsonb_build_object(
      'numero_e164', v_cfg ->> 'numero_whatsapp_e164',
      'prefixo', v_cfg ->> 'prefixo',
      'texto_modelo', (select m.texto from public.mensagem_modelo m where m.chave = 'captacao_whatsapp')),
    'canais', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', c.id, 'codigo', c.codigo, 'nome', c.nome, 'origem', c.origem::text, 'ativo', c.ativo,
               'visitas', (select pg_catalog.count(*) from privado.captacao_visita v where v.canal_id = c.id),
               'conversas', (select pg_catalog.count(*) from privado.conversa_origem o where o.canal_id = c.id))
             order by c.ativo desc, c.nome, c.id)
      from privado.canal_captacao c), '[]'::jsonb));
end;
$$;
comment on function api.marketing_canais() is '[P47 item 1] Canais de captação com o número do WhatsApp, o prefixo e o texto-modelo para o gerador de links wa.me, e quantas visitas e conversas cada um trouxe. Marketing e diretoria.';

create function api.marketing_canal_salvar(id uuid, codigo text, nome text, origem public.origem_lead, ativo boolean default true)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_codigo text := pg_catalog.upper(pg_catalog.btrim(marketing_canal_salvar.codigo));
  v_nome   text := pg_catalog.btrim(marketing_canal_salvar.nome);
  v_antes  privado.canal_captacao;
  v_canal  privado.canal_captacao;
begin
  perform privado.autorizar(array['marketing', 'diretoria']::public.papel_usuario[], false);
  if v_codigo is null or v_codigo !~ '^[A-Z0-9]{3,12}$' then
    perform privado.relacao_recusar('codigo_invalido', 'de 3 a 12 letras maiúsculas ou números');
  end if;
  if v_nome is null or pg_catalog.char_length(v_nome) not between 2 and 80 then
    perform privado.relacao_recusar('nome_invalido');
  end if;
  if marketing_canal_salvar.origem is null or marketing_canal_salvar.origem = 'desconhecida' then
    perform privado.relacao_recusar('origem_invalida');
  end if;

  if marketing_canal_salvar.id is null then
    begin
      insert into privado.canal_captacao (codigo, nome, origem, ativo)
      values (v_codigo, v_nome, marketing_canal_salvar.origem, coalesce(marketing_canal_salvar.ativo, true))
      returning * into v_canal;
    exception when unique_violation then
      perform privado.relacao_recusar('codigo_em_uso');
    end;
  else
    select k.* into v_antes from privado.canal_captacao k where k.id = marketing_canal_salvar.id for update;
    if not found then
      perform privado.relacao_recusar('canal_inexistente');
    end if;
    if v_antes.codigo <> v_codigo
       and (exists (select 1 from privado.captacao_visita v where v.canal_id = v_antes.id)
            or exists (select 1 from privado.conversa_origem o where o.canal_id = v_antes.id)) then
      perform privado.relacao_recusar('codigo_ja_usado', 'o código já saiu em links e conversas; crie outro canal');
    end if;
    begin
      update privado.canal_captacao k
         set codigo = v_codigo, nome = v_nome, origem = marketing_canal_salvar.origem,
             ativo = coalesce(marketing_canal_salvar.ativo, k.ativo)
       where k.id = v_antes.id
      returning k.* into v_canal;
    exception when unique_violation then
      perform privado.relacao_recusar('codigo_em_uso');
    end;
  end if;
  return pg_catalog.jsonb_build_object('id', v_canal.id, 'codigo', v_canal.codigo, 'nome', v_canal.nome,
                                       'origem', v_canal.origem::text, 'ativo', v_canal.ativo);
end;
$$;
comment on function api.marketing_canal_salvar(uuid, text, text, public.origem_lead, boolean) is '[P47 item 1] Cria ou edita um canal de captação. O código não muda depois de sair em link ou conversa (a atribuição histórica ficaria órfã). Marketing e diretoria. Auditado pelo gatilho da tabela.';

create function api.marketing_custo_salvar(canal_id uuid, mes date, valor_centavos integer) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_mes date := pg_catalog.date_trunc('month', marketing_custo_salvar.mes)::date;
  v_id  uuid;
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  if marketing_custo_salvar.mes is null then
    perform privado.relacao_recusar('mes_invalido');
  end if;
  if marketing_custo_salvar.valor_centavos is null or marketing_custo_salvar.valor_centavos < 0 then
    perform privado.relacao_recusar('valor_invalido', 'centavos, zero ou mais');
  end if;
  if not exists (select 1 from privado.canal_captacao k where k.id = marketing_custo_salvar.canal_id) then
    perform privado.relacao_recusar('canal_inexistente');
  end if;
  insert into privado.custo_canal (canal_id, mes, valor_centavos, fonte, criado_por)
  values (marketing_custo_salvar.canal_id, v_mes, marketing_custo_salvar.valor_centavos, 'manual', auth.uid())
  on conflict (canal_id, mes) do update
    set valor_centavos = excluded.valor_centavos, fonte = 'manual'
  returning id into v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'canal_id', marketing_custo_salvar.canal_id, 'mes', v_mes,
                                       'valor_centavos', marketing_custo_salvar.valor_centavos);
end;
$$;
comment on function api.marketing_custo_salvar(uuid, date, integer) is '[P47 item 3] Custo do mês de um canal, em centavos (um por canal e mês; salvar de novo troca o valor). Financeiro e diretoria, AAL2. Auditado pelo gatilho da tabela.';

-- Leads, qualificados, contratos, receita e custo por origem e por canal.
-- Leads: famílias que entraram no período. Receita: pagamentos confirmados no
-- período, atribuídos à origem da família. Custo: meses do período. Quem é
-- marketing (sem receita liberada) vê só contagens, e só de família elegível
-- (familia_elegivel_marketing: sem estado sensível, sem "não contatar").
create function api.marketing_relatorio(desde date default null, ate date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_ve     boolean := privado.tem_papel('diretoria') or privado.tem_papel('financeiro');
  v_todas  boolean := privado.tem_papel('diretoria') or privado.tem_papel('financeiro') or privado.tem_papel('comercial');
  v_mes_a  date := pg_catalog.date_trunc('month', marketing_relatorio.desde)::date;
  v_mes_b  date := pg_catalog.date_trunc('month', marketing_relatorio.ate)::date;
  v_res    jsonb;
begin
  perform privado.autorizar(array['marketing', 'diretoria', 'financeiro']::public.papel_usuario[], false);
  if not v_ve and privado.tem_papel('marketing') then
    v_ve := coalesce((privado.venda_parametro('marketing') ->> 've_receita')::boolean, false);
  end if;

  with lead as (
    select f.id, f.origem, f.codigo_origem as codigo,
           coalesce(o.qualificado, false) as qualificado, coalesce(o.ganho, false) as ganho
    from public.familia f
    left join lateral (
      select pg_catalog.bool_or(op.estagio_p2 is not null
                                or op.estagio_p1 in ('qualificado', 'sessao_venda_agendada', 'sessao_venda_realizada')) as qualificado,
             pg_catalog.bool_or(op.estagio_p2 is not null
                                and op.estagio_p2 not in ('proposta_enviada', 'em_negociacao', 'perdido', 'cancelado', 'distrato')) as ganho
      from public.oportunidade op where op.familia_id = f.id
    ) o on true
    where f.mesclada_em_id is null
      and (v_todas or (f.estado_sensivel = 'normal' and not f.nao_contatar))
      and (marketing_relatorio.desde is null or (f.criado_em at time zone 'America/Sao_Paulo')::date >= marketing_relatorio.desde)
      and (marketing_relatorio.ate is null or (f.criado_em at time zone 'America/Sao_Paulo')::date <= marketing_relatorio.ate)
  ),
  pago as (
    select f.origem, f.codigo_origem as codigo, k.id as contrato_id, c.valor_pago_centavos as valor
    from public.cobranca c
    join public.contrato k on k.id = c.contrato_id
    join public.familia f on f.id = k.familia_id
    where c.status = 'paga' and c.valor_pago_centavos is not null and c.pago_em is not null
      and f.mesclada_em_id is null
      and (v_todas or (f.estado_sensivel = 'normal' and not f.nao_contatar))
      and (marketing_relatorio.desde is null or (c.pago_em at time zone 'America/Sao_Paulo')::date >= marketing_relatorio.desde)
      and (marketing_relatorio.ate is null or (c.pago_em at time zone 'America/Sao_Paulo')::date <= marketing_relatorio.ate)
  ),
  custo as (
    select k.id as canal_id, k.origem, k.codigo, pg_catalog.sum(cc.valor_centavos)::bigint as valor
    from privado.custo_canal cc
    join privado.canal_captacao k on k.id = cc.canal_id
    where (v_mes_a is null or cc.mes >= v_mes_a) and (v_mes_b is null or cc.mes <= v_mes_b)
    group by k.id, k.origem, k.codigo
  ),
  origens as (
    select l.origem from lead l union select p.origem from pago p union select c.origem from custo c
  ),
  por_origem as (
    select coalesce(pg_catalog.jsonb_agg(x.j order by x.ordem), '[]'::jsonb) as j
    from (
      select o.origem::text as ordem,
             pg_catalog.jsonb_build_object(
               'origem', o.origem::text,
               'leads', (select pg_catalog.count(*) from lead l where l.origem = o.origem),
               'qualificados', (select pg_catalog.count(*) from lead l where l.origem = o.origem and l.qualificado),
               'ganhos', (select pg_catalog.count(*) from lead l where l.origem = o.origem and l.ganho),
               'contratos_pagos', case when v_ve then (select pg_catalog.count(distinct p.contrato_id) from pago p where p.origem = o.origem) end,
               'receita_centavos', case when v_ve then (select coalesce(pg_catalog.sum(p.valor), 0) from pago p where p.origem = o.origem) end,
               'custo_centavos', case when v_ve then (select coalesce(pg_catalog.sum(c.valor), 0) from custo c where c.origem = o.origem) end
             ) as j
      from origens o
    ) x
  ),
  por_canal as (
    select coalesce(pg_catalog.jsonb_agg(x.j order by x.ordem), '[]'::jsonb) as j
    from (
      select k.nome || k.codigo as ordem,
             pg_catalog.jsonb_build_object(
               'canal_id', k.id, 'codigo', k.codigo, 'nome', k.nome, 'origem', k.origem::text, 'ativo', k.ativo,
               'leads', (select pg_catalog.count(*) from lead l where l.codigo = k.codigo),
               'qualificados', (select pg_catalog.count(*) from lead l where l.codigo = k.codigo and l.qualificado),
               'ganhos', (select pg_catalog.count(*) from lead l where l.codigo = k.codigo and l.ganho),
               'contratos_pagos', case when v_ve then (select pg_catalog.count(distinct p.contrato_id) from pago p where p.codigo = k.codigo) end,
               'receita_centavos', case when v_ve then (select coalesce(pg_catalog.sum(p.valor), 0) from pago p where p.codigo = k.codigo) end,
               'custo_centavos', case when v_ve then (select coalesce(pg_catalog.sum(c.valor), 0) from custo c where c.canal_id = k.id) end
             ) as j
      from privado.canal_captacao k
    ) x
  ),
  total as (
    select pg_catalog.jsonb_build_object(
      'leads', (select pg_catalog.count(*) from lead),
      'qualificados', (select pg_catalog.count(*) from lead l where l.qualificado),
      'ganhos', (select pg_catalog.count(*) from lead l where l.ganho),
      'contratos_pagos', case when v_ve then (select pg_catalog.count(distinct p.contrato_id) from pago p) end,
      'receita_centavos', case when v_ve then (select coalesce(pg_catalog.sum(p.valor), 0) from pago p) end,
      'custo_centavos', case when v_ve then (select coalesce(pg_catalog.sum(c.valor), 0) from custo c) end) as j
  )
  select pg_catalog.jsonb_build_object(
           'desde', marketing_relatorio.desde, 'ate', marketing_relatorio.ate,
           've_valores', v_ve, 'so_elegiveis', not v_todas,
           'por_origem', po.j, 'por_canal', pc.j, 'total', t.j)
    into v_res
  from por_origem po, por_canal pc, total t;
  return v_res;
end;
$$;
comment on function api.marketing_relatorio(date, date) is '[P47 item 3] Leads, qualificados, ganhos, contratos pagos, receita e custo por origem e por canal. Receita = pagamentos confirmados no período, na origem da família; custo = meses do período (privado.custo_canal). Valores em centavos só para diretoria e financeiro (ou marketing, se parametro.marketing.ve_receita); marketing puro vê contagens de famílias elegíveis. Marketing, diretoria e financeiro.';

create function api.marketing_exportar(desde date default null, ate date default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_max  integer := coalesce(privado.venda_numero('captacao', 'exportar_max'), 5000)::integer;
  v_rows jsonb;
begin
  perform privado.autorizar(array['marketing', 'diretoria']::public.papel_usuario[], false);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'nome_exibicao', e.nome_exibicao, 'dpp', e.dpp, 'gemelar', e.gemelar,
           'primeira_gestacao', e.primeira_gestacao, 'origem', e.origem::text,
           'codigo_origem', e.codigo_origem, 'utm', e.utm, 'criado_em', e.criado_em) order by e.criado_em desc, e.id), '[]'::jsonb)
    into v_rows
  from (select * from public.familia_elegivel_marketing m
        where (marketing_exportar.desde is null or (m.criado_em at time zone 'America/Sao_Paulo')::date >= marketing_exportar.desde)
          and (marketing_exportar.ate is null or (m.criado_em at time zone 'America/Sao_Paulo')::date <= marketing_exportar.ate)
        order by m.criado_em desc, m.id
        limit v_max) e;
  perform privado.relacao_log('exportacao', 'familia_elegivel_marketing', null, null,
    pg_catalog.jsonb_build_object('linhas', pg_catalog.jsonb_array_length(v_rows),
                                  'desde', marketing_exportar.desde, 'ate', marketing_exportar.ate));
  return pg_catalog.jsonb_build_object('linhas', v_rows, 'limite', v_max);
end;
$$;
comment on function api.marketing_exportar(date, date) is '[P47 item 3] Exportação de marketing: só colunas de familia_elegivel_marketing (sem estado sensível, sem "não contatar", sem mescladas; nunca endereço, bairro nem histórico sensível), até parametro.captacao.exportar_max linhas. Grava a exportação no log (filtro e contagem, nunca o conteúdo). Marketing e diretoria.';


-- =============================================================================
-- 2b. P47 item 1 · agente.registrar_mensagem lê o código de origem
--
-- Mesma função da 0016_seguranca.sql (a definição vigente; a 0013 tem a
-- primeira), com um passo a mais no fim (6): na primeira mensagem da família,
-- procura "<prefixo>-<CANAL>[-<VISITA>]" no texto e grava a origem
-- (privado.captacao_registrar_na_conversa). Assinatura, retorno, comentário e
-- concessão a n8n_agente não mudam, então o fluxo 3 do n8n não precisa de
-- novo build. Antes de aplicar, conferir que nenhuma migration posterior à
-- 0016 redefine a função.
-- =============================================================================

create or replace function agente.registrar_mensagem(
  jid           text,
  direcao       text,
  enviado_por   text,
  conteudo      text,
  tipo          text,
  wa_message_id text,
  nome_whatsapp text,
  telefone      text,
  lid           text,
  nome_contato  text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  -- teto técnico de segurança (não é regra de negócio): o mesmo de
  -- LIMITE_TEXTO_MENSAGEM em n8n/src/code/mascarar-documentos.js
  c_limite_texto constant integer := 20000;
  v_jid        text := nullif(pg_catalog.btrim(registrar_mensagem.jid), '');
  v_lid        text := nullif(pg_catalog.btrim(registrar_mensagem.lid), '');
  v_msg_id     text := nullif(pg_catalog.btrim(registrar_mensagem.wa_message_id), '');
  v_tipo       text := coalesce(nullif(pg_catalog.btrim(registrar_mensagem.tipo), ''), 'texto');
  v_nome_wa    text := privado.campo_livre(registrar_mensagem.nome_whatsapp);
  v_contato    text := privado.campo_livre(registrar_mensagem.nome_contato);
  v_cortado    boolean := coalesce(pg_catalog.length(registrar_mensagem.conteudo) > c_limite_texto, false);
  v_direcao    public.direcao_mensagem;
  v_por        public.enviado_por;
  v_tel        text;
  v_c          public.conversa;
  v_existente  uuid;
  v_primeira   boolean;
  v_mensagem   uuid;
  v_fam        uuid;
  v_pessoa     uuid;
  v_norm       text;
  v_estado     jsonb;
begin
  perform privado.agente_contexto();

  if v_jid is null and v_lid is null and nullif(pg_catalog.btrim(registrar_mensagem.telefone), '') is null then
    raise exception 'registrar_mensagem: informe jid, lid ou telefone' using errcode = '22023';
  end if;
  v_direcao := registrar_mensagem.direcao::public.direcao_mensagem;
  v_por := registrar_mensagem.enviado_por::public.enviado_por;
  if (v_direcao = 'entrada') <> (v_por = 'cliente') then
    raise exception 'registrar_mensagem: entrada é sempre da família (cliente) e saída nunca é' using errcode = '22023';
  end if;

  v_tel := privado.telefone_e164(registrar_mensagem.telefone);
  if v_tel is null and v_jid like '%@s.whatsapp.net' then
    v_tel := privado.telefone_e164(pg_catalog.split_part(v_jid, '@', 1));
  end if;

  -- mensagem já registrada (a UAZAPI reenvia o evento): nada muda
  if v_msg_id is not null then
    select m.conversa_id into v_existente from public.mensagem m where m.wa_message_id = v_msg_id;
    if found then
      v_estado := privado.agente_estado_conversa(v_existente);
      return pg_catalog.jsonb_build_object(
        'ok', true, 'conversa_id', v_existente, 'duplicada', true, 'primeira_mensagem', false,
        'classificacao', v_estado ->> 'classificacao',
        'numero_equipe', (v_estado ->> 'numero_equipe')::boolean,
        'numero_plantao', (v_estado ->> 'numero_plantao')::boolean,
        'agrupamento_segundos', privado.agente_parametro_numero('agente_debounce_segundos'));
    end if;
  end if;

  if v_direcao = 'entrada' then
    -- 1. entrada: LID, telefone, jid
    if v_lid is not null then
      select c.* into v_c from public.conversa c
      where c.wa_lid = v_lid
      order by c.ultima_entrada_em desc nulls last, c.criado_em desc
      limit 1 for update;
    end if;
    if v_c.id is null and v_tel is not null then
      select c.* into v_c from public.conversa c
      where privado.telefone_normalizado(c.telefone_e164) = privado.telefone_normalizado(v_tel)
      order by c.ultima_entrada_em desc nulls last, c.criado_em desc
      limit 1 for update;
    end if;
    if v_c.id is null and v_jid is not null then
      select c.* into v_c from public.conversa c where c.wa_jid = v_jid for update;
    end if;
  else
    -- 1. saída: jid, telefone e, só quando o chat é o próprio LID (ou não
    --    veio jid), o LID
    if v_jid is not null then
      select c.* into v_c from public.conversa c where c.wa_jid = v_jid for update;
    end if;
    if v_c.id is null and v_tel is not null then
      select c.* into v_c from public.conversa c
      where privado.telefone_normalizado(c.telefone_e164) = privado.telefone_normalizado(v_tel)
      order by c.ultima_entrada_em desc nulls last, c.criado_em desc
      limit 1 for update;
    end if;
    if v_c.id is null and v_lid is not null and (v_jid is null or v_jid = v_lid) then
      select c.* into v_c from public.conversa c
      where c.wa_lid = v_lid
      order by c.ultima_entrada_em desc nulls last, c.criado_em desc
      limit 1 for update;
    end if;
  end if;

  if v_c.id is null then
    -- 2a. conversa nova (on conflict: duas mensagens do mesmo contato
    --     chegando juntas não criam duas conversas)
    insert into public.conversa (canal, wa_jid, wa_lid, telefone_e164, nome_whatsapp, nome_contato_salvo,
                                 iniciada_por, primeira_msg_em)
    values ('whatsapp', v_jid, v_lid, v_tel, case when v_direcao = 'entrada' then v_nome_wa end, v_contato,
            v_por, pg_catalog.now())
    on conflict (wa_jid) do nothing
    returning * into v_c;
    if v_c.id is null then
      select c.* into v_c from public.conversa c where c.wa_jid = v_jid for update;
    end if;
  else
    -- 2b. o mesmo contato pode trocar de @s.whatsapp.net para @lid: o jid
    --     mais recente fica nesta conversa (wa_jid é único; uma conversa
    --     antiga com o mesmo jid perde o jid, que não é mais dela). O LID da
    --     entrada é o da família e substitui o guardado; o da saída só
    --     preenche o que falta.
    if v_jid is not null and v_c.wa_jid is distinct from v_jid then
      update public.conversa c set wa_jid = null where c.wa_jid = v_jid and c.id <> v_c.id;
    end if;
    update public.conversa c
       set wa_jid = coalesce(v_jid, c.wa_jid),
           wa_lid = case when v_direcao = 'entrada' then coalesce(v_lid, c.wa_lid) else coalesce(c.wa_lid, v_lid) end,
           telefone_e164 = coalesce(c.telefone_e164, v_tel),
           nome_whatsapp = case when v_direcao = 'entrada' and v_nome_wa is not null then v_nome_wa else c.nome_whatsapp end,
           nome_contato_salvo = coalesce(v_contato, c.nome_contato_salvo),
           iniciada_por = coalesce(c.iniciada_por, v_por),
           primeira_msg_em = coalesce(c.primeira_msg_em, pg_catalog.now())
     where c.id = v_c.id
    returning * into v_c;
  end if;

  -- 3. conversa sem família: liga à família de quem tem o mesmo telefone
  if v_c.familia_id is null and v_c.telefone_e164 is not null then
    select privado.familia_vigente(p.familia_id), p.id
      into v_fam, v_pessoa
    from public.pessoa p
    join public.familia f on f.id = p.familia_id
    where privado.telefone_normalizado(p.telefone_e164) = privado.telefone_normalizado(v_c.telefone_e164)
    order by (f.mesclada_em_id is null) desc, f.criado_em desc
    limit 1;
    if v_fam is not null then
      update public.conversa c
         set familia_id = v_fam,
             pessoa_id = case when exists (select 1 from public.pessoa p where p.id = v_pessoa and p.familia_id = v_fam)
                              then v_pessoa else c.pessoa_id end
       where c.id = v_c.id
      returning * into v_c;
    end if;
  end if;

  -- 4. convenção do nome salvo (PRD 11.5)
  v_norm := privado.normalizar_local(v_c.nome_contato_salvo);
  if v_norm like '%paciente fechada%' and v_c.classificacao in ('nao_classificado', 'lead') then
    update public.conversa c set classificacao = 'cliente' where c.id = v_c.id returning * into v_c;
  elsif v_norm like '%paciente potencial%' and v_c.classificacao = 'nao_classificado' then
    update public.conversa c set classificacao = 'lead' where c.id = v_c.id returning * into v_c;
  end if;

  -- 5. mensagem, cortada no teto e mascarada, sem duplicar pelo wa_message_id
  v_primeira := not exists (select 1 from public.mensagem m where m.conversa_id = v_c.id);
  insert into public.mensagem (conversa_id, direcao, enviado_por, tipo, conteudo, wa_message_id)
  values (v_c.id, v_direcao, v_por, v_tipo,
          privado.mascarar_documentos(pg_catalog.left(registrar_mensagem.conteudo, c_limite_texto)), v_msg_id)
  on conflict (wa_message_id) do nothing
  returning id into v_mensagem;

  if v_mensagem is not null then
    if v_direcao = 'entrada' then
      update public.conversa c set ultima_entrada_em = pg_catalog.now() where c.id = v_c.id;
    else
      update public.conversa c set ultima_saida_em = pg_catalog.now() where c.id = v_c.id;
    end if;
  end if;

  -- 6. [P47] código de origem do link wa.me, só na primeira mensagem da
  --    conversa (texto já cortado no teto e sem mascarar: o código não é
  --    documento). Falha na atribuição nunca impede o registro da mensagem.
  if v_mensagem is not null and v_primeira and v_direcao = 'entrada' then
    begin
      perform privado.captacao_registrar_na_conversa(v_c.id, pg_catalog.left(registrar_mensagem.conteudo, c_limite_texto));
    exception when others then
      null;
    end;
  end if;

  v_estado := privado.agente_estado_conversa(v_c.id);
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'conversa_id', v_c.id,
    'mensagem_id', v_mensagem,
    'duplicada', v_mensagem is null,
    'primeira_mensagem', v_primeira and v_mensagem is not null,
    'conteudo_cortado', v_cortado,
    'classificacao', v_estado ->> 'classificacao',
    'numero_equipe', (v_estado ->> 'numero_equipe')::boolean,
    'numero_plantao', (v_estado ->> 'numero_plantao')::boolean,
    'agrupamento_segundos', privado.agente_parametro_numero('agente_debounce_segundos'));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;


-- =============================================================================
-- 3. P48 · Copiloto interno
--
-- O modelo nunca escreve SQL: o servidor do app escolhe entre as cinco
-- funções de leitura abaixo (api.copiloto_*), com os parâmetros que o modelo
-- devolve depois de validados. Cada uma confere o papel de quem pergunta
-- dentro do banco, então o copiloto nunca vê mais do que a pessoa veria. Nenhuma
-- lê tabela assistencial. A pergunta e a ferramenta escolhida ficam em
-- privado.copiloto_pergunta (com o gatilho de auditoria) e o custo do mês sai
-- da soma dos tokens.
-- =============================================================================

create table privado.copiloto_pergunta (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  usuario_id     uuid references public.perfil(id) on delete set null,
  pergunta       text not null check (pg_catalog.char_length(pergunta) between 1 and 1000),
  ferramenta     text check (ferramenta in ('copiloto_pipeline', 'copiloto_conversao', 'copiloto_receita', 'copiloto_ocupacao', 'copiloto_leads_origem')),
  parametros     jsonb not null default '{}',
  situacao       text not null check (situacao in ('respondida', 'recusada', 'desligado', 'orcamento', 'erro')),
  motivo         text check (motivo is null or pg_catalog.char_length(motivo) <= 80),
  tokens_entrada integer not null default 0 check (tokens_entrada >= 0),
  tokens_saida   integer not null default 0 check (tokens_saida >= 0)
);
comment on table privado.copiloto_pergunta is '[P48] Pergunta feita ao copiloto: quem, o texto (oculto no log de auditoria), a função de leitura escolhida e os parâmetros, se foi respondida ou recusada e os tokens gastos (o custo do mês sai daqui e de parametro.copiloto). Sem dado assistencial: o copiloto não tem função que leia registro clínico.';
create index on privado.copiloto_pergunta (usuario_id, criado_em);
create index on privado.copiloto_pergunta (criado_em);
create trigger auditar after insert or update or delete on privado.copiloto_pergunta
  for each row execute function privado.auditar('id');
alter table privado.copiloto_pergunta enable row level security;
revoke all on privado.copiloto_pergunta from public, anon, authenticated, service_role;

-- Configuração e custo do mês (o servidor decide desligar, recusar ou
-- consultar com isto).
create function api.copiloto_config() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_cfg     jsonb := coalesce(privado.venda_parametro('copiloto'), '{}'::jsonb);
  v_inicio  timestamptz := pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_entrada bigint;
  v_saida   bigint;
  v_perg    bigint;
  v_preco_e numeric := coalesce((v_cfg ->> 'preco_entrada_centavos_por_milhao')::numeric, 0);
  v_preco_s numeric := coalesce((v_cfg ->> 'preco_saida_centavos_por_milhao')::numeric, 0);
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  select coalesce(pg_catalog.sum(p.tokens_entrada), 0), coalesce(pg_catalog.sum(p.tokens_saida), 0), pg_catalog.count(*)
    into v_entrada, v_saida, v_perg
  from privado.copiloto_pergunta p where p.criado_em >= v_inicio;
  return pg_catalog.jsonb_build_object(
    'ativo', coalesce((v_cfg ->> 'ativo')::boolean, false),
    'termos_assistenciais', coalesce(v_cfg -> 'termos_assistenciais', '[]'::jsonb),
    'pergunta_max_caracteres', coalesce((v_cfg ->> 'pergunta_max_caracteres')::integer, 500),
    'orcamento_mensal_centavos', (v_cfg ->> 'orcamento_mensal_centavos')::integer,
    'mes', pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'America/Sao_Paulo')::date,
    'perguntas_mes', v_perg,
    'tokens_entrada_mes', v_entrada,
    'tokens_saida_mes', v_saida,
    'custo_mes_centavos', pg_catalog.ceil((v_entrada * v_preco_e + v_saida * v_preco_s) / 1000000.0)::integer);
end;
$$;
comment on function api.copiloto_config() is '[P48] Interruptor, termos que o copiloto recusa, limite da pergunta, orçamento do mês e o custo do mês até agora (tokens gastos por todos vezes o preço de parametro.copiloto, em centavos). Comercial e diretoria.';

create function api.copiloto_registrar(
  pergunta       text,
  ferramenta     text,
  parametros     jsonb,
  situacao       text,
  motivo         text default null,
  tokens_entrada integer default 0,
  tokens_saida   integer default 0
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_id uuid;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  if copiloto_registrar.pergunta is null or pg_catalog.btrim(copiloto_registrar.pergunta) = '' then
    perform privado.relacao_recusar('pergunta_vazia');
  end if;
  insert into privado.copiloto_pergunta (usuario_id, pergunta, ferramenta, parametros, situacao, motivo, tokens_entrada, tokens_saida)
  values (auth.uid(), pg_catalog.left(pg_catalog.btrim(copiloto_registrar.pergunta), 1000),
          copiloto_registrar.ferramenta, coalesce(copiloto_registrar.parametros, '{}'::jsonb),
          copiloto_registrar.situacao, pg_catalog.left(copiloto_registrar.motivo, 80),
          greatest(coalesce(copiloto_registrar.tokens_entrada, 0), 0), greatest(coalesce(copiloto_registrar.tokens_saida, 0), 0))
  returning id into v_id;
  return pg_catalog.jsonb_build_object('id', v_id);
end;
$$;
comment on function api.copiloto_registrar(text, text, jsonb, text, text, integer, integer) is '[P48] Registra a pergunta do copiloto, a função escolhida, a situação e os tokens. O gatilho de auditoria grava o insert com o texto oculto (HMAC). Comercial e diretoria.';

create function api.copiloto_historico(limite integer default 20) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_diretoria boolean;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  v_diretoria := privado.tem_papel('diretoria');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', x.id, 'em', x.criado_em, 'pergunta', x.pergunta, 'ferramenta', x.ferramenta, 'situacao', x.situacao,
             'motivo', x.motivo, 'quem', case when v_diretoria then x.nome end) order by x.criado_em desc, x.id)
    from (select p.*, u.nome
          from privado.copiloto_pergunta p
          left join public.perfil u on u.id = p.usuario_id
          where v_diretoria or p.usuario_id = auth.uid()
          order by p.criado_em desc, p.id
          limit least(greatest(coalesce(copiloto_historico.limite, 20), 1), 100)) x), '[]'::jsonb);
end;
$$;
comment on function api.copiloto_historico(integer) is '[P48] Últimas perguntas: as da própria pessoa; a diretoria vê as de todos, com o nome. Comercial e diretoria.';

-- --- As cinco funções de leitura que o modelo pode escolher --------------------

create function api.copiloto_pipeline(pipeline integer default 1) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  if copiloto_pipeline.pipeline is null or copiloto_pipeline.pipeline not in (1, 2) then
    perform privado.relacao_recusar('pipeline_invalido', 'use 1 (entrada e qualificação) ou 2 (venda e pré-atendimento)');
  end if;
  return (
    select pg_catalog.jsonb_build_object(
             'pipeline', copiloto_pipeline.pipeline,
             'total', coalesce(pg_catalog.sum(x.n), 0),
             'estagios', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('estagio', x.estagio, 'oportunidades', x.n) order by x.estagio), '[]'::jsonb))
    from (select case when copiloto_pipeline.pipeline = 1 then op.estagio_p1::text else op.estagio_p2::text end as estagio,
                 pg_catalog.count(*) as n
          from public.oportunidade op
          join public.familia f on f.id = op.familia_id and f.mesclada_em_id is null
          where op.pipeline = copiloto_pipeline.pipeline
          group by 1) x
    where x.estagio is not null);
end;
$$;
comment on function api.copiloto_pipeline(integer) is '[P48] Oportunidades por estágio de um pipeline (1 ou 2), sem famílias mescladas. Só contagens. Comercial e diretoria.';

create function api.copiloto_conversao(desde date default null, ate date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_leads bigint;
  v_qual  bigint;
  v_sess  bigint;
  v_ganho bigint;
  v_perd  bigint;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  select pg_catalog.count(*),
         pg_catalog.count(*) filter (where o.qualificado),
         pg_catalog.count(*) filter (where exists (select 1 from public.sessao_venda s where s.familia_id = f.id and s.status = 'realizada')),
         pg_catalog.count(*) filter (where o.ganho),
         pg_catalog.count(*) filter (where o.perdido)
    into v_leads, v_qual, v_sess, v_ganho, v_perd
  from public.familia f
  left join lateral (
    select pg_catalog.bool_or(op.estagio_p2 is not null
                              or op.estagio_p1 in ('qualificado', 'sessao_venda_agendada', 'sessao_venda_realizada')) as qualificado,
           pg_catalog.bool_or(op.estagio_p2 is not null
                              and op.estagio_p2 not in ('proposta_enviada', 'em_negociacao', 'perdido', 'cancelado', 'distrato')) as ganho,
           pg_catalog.bool_or(op.estagio_p1 = 'perdido' or op.estagio_p2 in ('perdido', 'cancelado', 'distrato')) as perdido
    from public.oportunidade op where op.familia_id = f.id
  ) o on true
  where f.mesclada_em_id is null
    and (copiloto_conversao.desde is null or (f.criado_em at time zone 'America/Sao_Paulo')::date >= copiloto_conversao.desde)
    and (copiloto_conversao.ate is null or (f.criado_em at time zone 'America/Sao_Paulo')::date <= copiloto_conversao.ate);
  return pg_catalog.jsonb_build_object(
    'desde', copiloto_conversao.desde, 'ate', copiloto_conversao.ate,
    'leads', v_leads, 'qualificados', v_qual, 'sessoes_realizadas', v_sess, 'ganhos', v_ganho, 'perdidos', v_perd,
    'taxa_qualificacao_pct', case when v_leads > 0 then pg_catalog.round(100.0 * v_qual / v_leads, 1) end,
    'taxa_ganho_pct', case when v_leads > 0 then pg_catalog.round(100.0 * v_ganho / v_leads, 1) end);
end;
$$;
comment on function api.copiloto_conversao(date, date) is '[P48] Funil do período (famílias que entraram): leads, qualificados, sessões de venda realizadas, ganhos, perdidos e as taxas. Só contagens. Comercial e diretoria.';

create function api.copiloto_receita(desde date default null, ate date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['financeiro', 'diretoria']::public.papel_usuario[], true);
  return (
    with pago as (
      select c.valor_pago_centavos as valor, c.contrato_id,
             pg_catalog.date_trunc('month', c.pago_em at time zone 'America/Sao_Paulo')::date as mes
      from public.cobranca c
      where c.status = 'paga' and c.valor_pago_centavos is not null and c.pago_em is not null
        and (copiloto_receita.desde is null or (c.pago_em at time zone 'America/Sao_Paulo')::date >= copiloto_receita.desde)
        and (copiloto_receita.ate is null or (c.pago_em at time zone 'America/Sao_Paulo')::date <= copiloto_receita.ate)
    )
    select pg_catalog.jsonb_build_object(
             'desde', copiloto_receita.desde, 'ate', copiloto_receita.ate,
             'pago_centavos', coalesce((select pg_catalog.sum(valor) from pago), 0),
             'contratos_pagos', (select pg_catalog.count(distinct contrato_id) from pago),
             'em_aberto_centavos', coalesce((select pg_catalog.sum(c.valor_centavos) from public.cobranca c where c.status = 'aberta'), 0),
             'vencido_centavos', coalesce((select pg_catalog.sum(c.valor_centavos) from public.cobranca c where c.status = 'vencida'), 0),
             'por_mes', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('mes', m.mes, 'pago_centavos', m.total) order by m.mes)
                                  from (select mes, pg_catalog.sum(valor) as total from pago group by mes) m), '[]'::jsonb)));
end;
$$;
comment on function api.copiloto_receita(date, date) is '[P48] Receita paga no período (pagamentos confirmados), por mês, com o que segue em aberto e vencido. Só somas. Financeiro e diretoria, AAL2: o comercial não vê cobrança (PRD 13).';

create function api.copiloto_ocupacao(semana_desde date default null, semanas integer default 8) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_ini date := coalesce(copiloto_ocupacao.semana_desde,
                         (pg_catalog.now() at time zone 'America/Sao_Paulo')::date
                         - ((extract(isodow from pg_catalog.now() at time zone 'America/Sao_Paulo'))::integer - 1));
  v_n   integer := least(greatest(coalesce(copiloto_ocupacao.semanas, 8), 1), 26);
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  return pg_catalog.jsonb_build_object(
    'de', v_ini, 'semanas', v_n,
    'alerta_pct', privado.venda_numero('capacidade_alerta_pct'),
    'itens', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'regiao', o.regiao, 'semana', o.semana, 'ocupacao_pct', o.ocupacao_pct,
               'familias', o.familias, 'capacidade_dias', o.capacidade_dias) order by o.semana, o.regiao)
      from public.ocupacao_projetada o
      where o.semana >= v_ini and o.semana < v_ini + (v_n * 7)), '[]'::jsonb));
end;
$$;
comment on function api.copiloto_ocupacao(date, integer) is '[P48] Ocupação projetada por praça e semana (view ocupacao_projetada), a partir da semana pedida (padrão a atual) por até 26 semanas, com o limite de alerta. Só números por praça, nenhuma família. Comercial, coordenação e diretoria.';

create function api.copiloto_leads_origem(desde date default null, ate date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  return pg_catalog.jsonb_build_object(
    'desde', copiloto_leads_origem.desde, 'ate', copiloto_leads_origem.ate,
    'itens', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'origem', x.origem::text, 'leads', x.leads, 'qualificados', x.qualificados, 'ganhos', x.ganhos) order by x.origem)
      from (select f.origem,
                   pg_catalog.count(*) as leads,
                   pg_catalog.count(*) filter (where o.qualificado) as qualificados,
                   pg_catalog.count(*) filter (where o.ganho) as ganhos
            from public.familia f
            left join lateral (
              select pg_catalog.bool_or(op.estagio_p2 is not null
                                        or op.estagio_p1 in ('qualificado', 'sessao_venda_agendada', 'sessao_venda_realizada')) as qualificado,
                     pg_catalog.bool_or(op.estagio_p2 is not null
                                        and op.estagio_p2 not in ('proposta_enviada', 'em_negociacao', 'perdido', 'cancelado', 'distrato')) as ganho
              from public.oportunidade op where op.familia_id = f.id
            ) o on true
            where f.mesclada_em_id is null
              and (copiloto_leads_origem.desde is null or (f.criado_em at time zone 'America/Sao_Paulo')::date >= copiloto_leads_origem.desde)
              and (copiloto_leads_origem.ate is null or (f.criado_em at time zone 'America/Sao_Paulo')::date <= copiloto_leads_origem.ate)
            group by f.origem) x), '[]'::jsonb));
end;
$$;
comment on function api.copiloto_leads_origem(date, date) is '[P48] Leads, qualificados e ganhos por origem no período. Só contagens. Comercial e diretoria (lead e origem, PRD 13).';


-- =============================================================================
-- 4. P49 · Portal da família
--
-- A família entra por link mágico no e-mail. A conta é um usuário do Supabase
-- Auth sem perfil e sem papel (então nenhuma função de equipe abre para ela);
-- privado.acesso_familia liga esse usuário a uma pessoa e a uma família, e é o
-- que api.portal_familia confere. Cada função devolve só a família da pessoa
-- logada, sem dado comercial, sem valor e sem conteúdo clínico. Em
-- bloqueio_total ou encerrado_sensivel devolve só o contato de uma pessoa da
-- equipe (PRD 8). O portal nunca lê endereço, CPF, conversa nem registro.
-- =============================================================================

create table privado.acesso_familia (
  id               uuid primary key default gen_random_uuid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  criado_por       uuid references public.perfil(id),
  familia_id       uuid not null references public.familia(id) on delete cascade,
  pessoa_id        uuid not null unique references public.pessoa(id) on delete cascade,
  usuario_id       uuid references auth.users(id) on delete set null,
  ativo            boolean not null default true,
  suspenso_em      timestamptz,
  ultimo_acesso_em timestamptz
);
comment on table privado.acesso_familia is '[P49] Quem da família pode entrar no portal: a pessoa (com e-mail no cadastro), a família, e o usuário do Supabase Auth criado no primeiro link (usuario_id). Liberado e suspenso pela equipe (api.portal_familia_liberar e _suspender). Sem grant: a família chega aqui só por api.portal_familia.';
comment on column privado.acesso_familia.usuario_id is 'auth.users.id do link mágico; preenchido pelo servidor (public.portal_familia_vincular). Quem tiver só o mesmo e-mail em outra conta não entra: vale o id.';
create unique index on privado.acesso_familia (usuario_id) where usuario_id is not null;
create index on privado.acesso_familia (familia_id);
create index on privado.acesso_familia (criado_por);
create trigger tocar_atualizado_em before update on privado.acesso_familia
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.acesso_familia
  for each row execute function privado.auditar('id');
alter table privado.acesso_familia enable row level security;
revoke all on privado.acesso_familia from public, anon, authenticated, service_role;

create table privado.profissional_portal (
  profissional_id uuid primary key references public.profissional(id) on delete cascade,
  atualizado_em   timestamptz not null default now(),
  autoriza_nome   boolean not null default false,
  autoriza_foto   boolean not null default false,
  foto_path       text check (foto_path is null or foto_path ~ '^profissionais/[0-9a-f-]{36}/foto\.(jpg|jpeg|png|webp)$'),
  registrado_por  uuid references public.perfil(id)
);
comment on table privado.profissional_portal is '[P49] Autorização da enfermeira para a família ver o nome e a foto dela no portal (PRD 12: só com autorização). Sem registro, ou com falso, o portal mostra "uma enfermeira da equipe". foto_path é caminho de storage privado sem nome de ninguém; a URL assinada é curta e sai do servidor.';
create index on privado.profissional_portal (registrado_por);
create trigger tocar_atualizado_em before update on privado.profissional_portal
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.profissional_portal
  for each row execute function privado.auditar('profissional_id');
alter table privado.profissional_portal enable row level security;
revoke all on privado.profissional_portal from public, anon, authenticated, service_role;

-- A linha de acesso do usuário logado, ativa, de família que não foi mesclada.
-- 42501 para quem não é da família de ninguém (inclusive a equipe).
create function privado.portal_acesso() returns privado.acesso_familia
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_a privado.acesso_familia;
begin
  select a.* into v_a
  from privado.acesso_familia a
  join public.familia f on f.id = a.familia_id
  where auth.uid() is not null and a.usuario_id = auth.uid() and a.ativo and f.mesclada_em_id is null;
  if not found then
    raise exception 'acesso negado: esta conta não tem acesso ao portal da família'
      using errcode = '42501';
  end if;
  return v_a;
end;
$$;
comment on function privado.portal_acesso() is '[P49] Acesso ativo do usuário logado ao portal da família; 42501 se não houver. Sem grant.';

create function api.portal_familia() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_a       privado.acesso_familia := privado.portal_acesso();
  v_f       public.familia;
  v_p       public.pessoa;
  v_cfg     jsonb := coalesce(privado.venda_parametro('portal_familia'), '{}'::jsonb);
  v_nome    text;
  v_k       public.contrato;
  v_pago    timestamptz;
  v_ac      public.acompanhamento;
  v_cp      public.consulta_prenatal;
  v_pr      public.profissional;
  v_pp      privado.profissional_portal;
  v_evol    jsonb := '[]'::jsonb;
  v_evol_on boolean := coalesce((v_cfg ->> 'evolucoes_ativo')::boolean, false);
  v_visitas jsonb := '[]'::jsonb;
  v_pesq    jsonb := null;
begin
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;
  select p.* into v_p from public.pessoa p where p.id = v_a.pessoa_id;
  v_nome := privado.relacao_primeiro_nome(v_p.nome);
  update privado.acesso_familia a set ultimo_acesso_em = pg_catalog.now() where a.id = v_a.id;

  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    return pg_catalog.jsonb_build_object(
      'situacao', 'contato',
      'pessoa', pg_catalog.jsonb_build_object('primeiro_nome', v_nome),
      'contato', coalesce(v_cfg -> 'contato_sensivel', '{}'::jsonb),
      'textos', privado.textos_site('portal_sensivel_', v_nome));
  end if;

  select k.* into v_k from public.contrato k
  where k.familia_id = v_f.id and k.status not in ('rascunho', 'aguardando_dados', 'cancelado', 'distrato')
  order by k.criado_em desc, k.id limit 1;
  if v_k.id is not null then
    select pg_catalog.max(c.pago_em) into v_pago from public.cobranca c where c.contrato_id = v_k.id and c.status = 'paga';
    select a.* into v_ac from public.acompanhamento a where a.contrato_id = v_k.id order by a.criado_em desc, a.id limit 1;
  end if;
  select c.* into v_cp from public.consulta_prenatal c
  where c.familia_id = v_f.id and c.status in ('agendada', 'realizada')
  order by (c.status = 'agendada') desc, c.agendada_para desc nulls last, c.id limit 1;

  if v_ac.id is not null then
    select pr.* into v_pr
    from public.designacao d join public.profissional pr on pr.id = d.profissional_id
    where d.acompanhamento_id = v_ac.id and d.papel = 'titular' and d.status = 'aceita'
    order by d.criado_em desc limit 1;
    if v_pr.id is not null then
      select pp.* into v_pp from privado.profissional_portal pp where pp.profissional_id = v_pr.id;
    end if;
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'dia', v.dia_numero, 'data', v.data, 'hora', v.hora_prevista,
             'feita', v.estado in ('concluida', 'ficha_pendente', 'ficha_entregue', 'encerrada')) order by v.dia_numero), '[]'::jsonb)
      into v_visitas
    from public.visita v
    where v.acompanhamento_id = v_ac.id and v.estado not in ('cancelada', 'reagendada');
    select pg_catalog.jsonb_build_object('enviada', pv.pesquisa_enviada_em is not null,
                                         'respondida', pv.pesquisa_respondida_em is not null)
      into v_pesq
    from public.pos_venda pv where pv.acompanhamento_id = v_ac.id;
    if v_evol_on then
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', r.id, 'tipo', r.tipo::text, 'enviado_em', r.enviado_em)
                        order by r.enviado_em desc, r.id), '[]'::jsonb)
        into v_evol
      from public.relatorio_medico r where r.acompanhamento_id = v_ac.id and r.status = 'enviado';
      perform privado.relacao_log('leitura', 'portal_familia', v_f.id::text, null,
        pg_catalog.jsonb_build_object('evolucoes', pg_catalog.jsonb_array_length(v_evol)));
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'situacao', 'ok',
    'pessoa', pg_catalog.jsonb_build_object('primeiro_nome', v_nome),
    'familia', pg_catalog.jsonb_build_object('nome_exibicao', v_f.nome_exibicao, 'gemelar', v_f.gemelar),
    'datas', pg_catalog.jsonb_build_object(
      'dpp', v_f.dpp, 'data_nascimento', v_f.data_nascimento, 'data_alta', v_f.data_alta,
      'data_inicio_efetivo', v_f.data_inicio_efetivo),
    'contrato_assinado_em', v_k.assinado_em,
    'pagamento_confirmado_em', v_pago,
    'prenatal', case when v_cp.id is not null then
      pg_catalog.jsonb_build_object('estado', v_cp.status::text, 'agendada_para', v_cp.agendada_para, 'realizada_em', v_cp.realizada_em) end,
    'acompanhamento', case when v_ac.id is not null then
      pg_catalog.jsonb_build_object('estado', v_ac.estado::text, 'dias_contratados', v_ac.dias_contratados,
                                    'inicio_efetivo', v_ac.inicio_efetivo, 'encerramento', v_ac.encerramento,
                                    'periodo', v_ac.periodo::text) end,
    'enfermeira', case when v_pr.id is not null then
      pg_catalog.jsonb_build_object(
        'nome', case when coalesce(v_pp.autoriza_nome, false) then v_pr.nome end,
        'foto_path', case when coalesce(v_pp.autoriza_foto, false) then v_pp.foto_path end) end,
    'visitas', v_visitas,
    'pesquisa', v_pesq,
    'evolucoes', pg_catalog.jsonb_build_object('ativo', v_evol_on, 'itens', v_evol),
    'contato', coalesce(v_cfg -> 'contato_equipe', '{}'::jsonb),
    'textos', privado.textos_site('portal_', v_nome));
end;
$$;
comment on function api.portal_familia() is '[P49] O portal da família logada: datas (dpp é estimativa; nascimento, alta e início são fatos), contrato e pagamento (só se foram, sem valor), pré-natal, acompanhamento, visitas (dia, data, hora), enfermeira (nome e foto só com autorização), pesquisa, evoluções (só se parametro.portal_familia.evolucoes_ativo), contato da equipe e os textos portal_*. Em bloqueio_total ou encerrado_sensivel, só o contato de uma pessoa. Conta sem acesso ao portal recebe 42501. Grava o último acesso.';

-- --- Equipe: liberar, suspender e listar --------------------------------------

create function api.portal_familia_acessos(familia_id uuid default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'familia_id', f.id, 'nome_exibicao', f.nome_exibicao, 'estado_sensivel', f.estado_sensivel::text,
             'pessoas', (
               select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'pessoa_id', p.id, 'papel', p.papel::text, 'primeiro_nome', privado.relacao_primeiro_nome(p.nome),
                        'tem_email', nullif(pg_catalog.btrim(p.email), '') is not null,
                        'situacao', case when a.id is null then 'sem_acesso' when a.ativo then 'liberado' else 'suspenso' end,
                        'entrou', a.ultimo_acesso_em is not null, 'ultimo_acesso_em', a.ultimo_acesso_em)
                        order by p.contato_principal desc, p.criado_em, p.id), '[]'::jsonb)
               from public.pessoa p left join privado.acesso_familia a on a.pessoa_id = p.id
               where p.familia_id = f.id and p.papel in ('mae', 'parceiro', 'acompanhante', 'responsavel')))
           order by f.nome_exibicao, f.id)
    from public.familia f
    where f.mesclada_em_id is null
      and (portal_familia_acessos.familia_id is null or f.id = portal_familia_acessos.familia_id)
      and exists (select 1 from public.contrato k where k.familia_id = f.id and k.status = 'assinado')), '[]'::jsonb);
end;
$$;
comment on function api.portal_familia_acessos(uuid) is '[P49] Famílias com contrato assinado e, para cada pessoa, se tem e-mail e se o acesso ao portal está liberado, suspenso ou ainda não foi dado. Nunca devolve o e-mail. Comercial, coordenação e diretoria.';

create function api.portal_familia_liberar(pessoa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_p      public.pessoa;
  v_f      public.familia;
  v_a      privado.acesso_familia;
  v_tarefa uuid;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  select p.* into v_p from public.pessoa p where p.id = portal_familia_liberar.pessoa_id;
  if not found then
    perform privado.relacao_recusar('pessoa_inexistente');
  end if;
  select f.* into v_f from public.familia f where f.id = v_p.familia_id;
  if v_f.mesclada_em_id is not null then
    perform privado.relacao_recusar('familia_mesclada');
  end if;
  if v_f.estado_sensivel in ('bloqueio_total', 'encerrado_sensivel') then
    perform privado.relacao_recusar('freio', 'nenhum convite sai para uma família em estado sensível');
  end if;
  if v_p.papel not in ('mae', 'parceiro', 'acompanhante', 'responsavel') then
    perform privado.relacao_recusar('papel_sem_portal');
  end if;
  if nullif(pg_catalog.btrim(v_p.email), '') is null or v_p.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform privado.relacao_recusar('sem_email', 'a pessoa não tem e-mail válido no cadastro');
  end if;
  if not exists (select 1 from public.contrato k where k.familia_id = v_f.id and k.status = 'assinado') then
    perform privado.relacao_recusar('sem_contrato_assinado');
  end if;

  select a.* into v_a from privado.acesso_familia a where a.pessoa_id = v_p.id;
  if found and v_a.ativo then
    return pg_catalog.jsonb_build_object('ok', true, 'acesso_id', v_a.id, 'ja_liberado', true, 'tarefa_id', null);
  end if;
  if found then
    update privado.acesso_familia a set ativo = true, suspenso_em = null where a.id = v_a.id returning * into v_a;
  else
    insert into privado.acesso_familia (familia_id, pessoa_id, criado_por)
    values (v_f.id, v_p.id, auth.uid()) returning * into v_a;
  end if;

  -- O convite sai por uma pessoa da equipe, pela tarefa com texto sugerido, que
  -- passa pelo freio (nada sai para família em estado sensível).
  v_tarefa := privado.venda_criar_tarefa(
    v_f.id, 'enviar_guia', 'Enviar à ' || coalesce(privado.relacao_primeiro_nome(v_p.nome), 'família') || ' o acesso ao portal',
    auth.uid(), 'normal', pg_catalog.now() + interval '1 day', 'portal_convite',
    pg_catalog.jsonb_build_object('endereco', privado.venda_parametro('portal_familia') ->> 'endereco'),
    'operacional', pg_catalog.jsonb_build_object('acao', 'portal_familia', 'pessoaId', v_p.id));
  perform privado.relacao_log('portal_liberar', 'acesso_familia', v_a.id::text, null,
    pg_catalog.jsonb_build_object('familia_id', v_f.id, 'pessoa_id', v_p.id));
  return pg_catalog.jsonb_build_object('ok', true, 'acesso_id', v_a.id, 'ja_liberado', false, 'tarefa_id', v_tarefa);
end;
$$;
comment on function api.portal_familia_liberar(uuid) is '[P49] Libera o portal para uma pessoa da família: precisa de contrato assinado, e-mail no cadastro e família fora do estado sensível. Cria a tarefa de envio do convite com texto de mensagem_modelo (portal_convite), que segue o freio. Comercial, coordenação e diretoria.';

create function api.portal_familia_suspender(pessoa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_a privado.acesso_familia;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  update privado.acesso_familia a set ativo = false, suspenso_em = pg_catalog.now()
   where a.pessoa_id = portal_familia_suspender.pessoa_id and a.ativo
  returning a.* into v_a;
  if not found then
    perform privado.relacao_recusar('sem_acesso_ativo');
  end if;
  perform privado.relacao_log('portal_suspender', 'acesso_familia', v_a.id::text, null,
    pg_catalog.jsonb_build_object('familia_id', v_a.familia_id, 'pessoa_id', v_a.pessoa_id));
  return pg_catalog.jsonb_build_object('ok', true, 'acesso_id', v_a.id);
end;
$$;
comment on function api.portal_familia_suspender(uuid) is '[P49] Suspende o acesso ao portal (vale na hora: api.portal_familia confere ativo a cada chamada). Comercial, coordenação e diretoria.';

-- --- Autorização da enfermeira ---------------------------------------------------

create function api.profissionais_portal() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], false);
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'profissional_id', pr.id, 'nome', pr.nome,
             'autoriza_nome', coalesce(pp.autoriza_nome, false), 'autoriza_foto', coalesce(pp.autoriza_foto, false),
             'tem_foto', pp.foto_path is not null) order by pr.nome, pr.id)
    from public.profissional pr
    left join privado.profissional_portal pp on pp.profissional_id = pr.id
    where pr.ativa), '[]'::jsonb);
end;
$$;
comment on function api.profissionais_portal() is '[P49] Enfermeiras ativas e o que cada uma autorizou a família ver no portal. Coordenação e diretoria.';

create function api.profissional_portal_salvar(
  profissional_id uuid,
  autoriza_nome   boolean,
  autoriza_foto   boolean,
  foto_path       text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_pr public.profissional;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  select pr.* into v_pr from public.profissional pr where pr.id = profissional_portal_salvar.profissional_id;
  if not found then
    perform privado.relacao_recusar('profissional_inexistente');
  end if;
  -- A enfermeira registra a autorização dela mesma; a coordenação registra o
  -- que a enfermeira autorizou.
  if not (privado.tem_papel('coordenacao') or privado.tem_papel('diretoria')) and v_pr.usuario_id is distinct from auth.uid() then
    raise exception 'acesso negado: só a própria enfermeira, a coordenação ou a diretoria' using errcode = '42501';
  end if;
  if profissional_portal_salvar.foto_path is not null
     and profissional_portal_salvar.foto_path !~ ('^profissionais/' || v_pr.id::text || '/foto\.(jpg|jpeg|png|webp)$') then
    perform privado.relacao_recusar('foto_invalida', 'o caminho da foto usa o id da profissional, nunca o nome');
  end if;
  insert into privado.profissional_portal (profissional_id, autoriza_nome, autoriza_foto, foto_path, registrado_por)
  values (v_pr.id, coalesce(profissional_portal_salvar.autoriza_nome, false), coalesce(profissional_portal_salvar.autoriza_foto, false),
          profissional_portal_salvar.foto_path, auth.uid())
  on conflict (profissional_id) do update
    set autoriza_nome = excluded.autoriza_nome, autoriza_foto = excluded.autoriza_foto,
        foto_path = coalesce(excluded.foto_path, privado.profissional_portal.foto_path),
        registrado_por = excluded.registrado_por;
  return pg_catalog.jsonb_build_object('ok', true, 'profissional_id', v_pr.id);
end;
$$;
comment on function api.profissional_portal_salvar(uuid, boolean, boolean, text) is '[P49] Registra se a enfermeira autoriza a família a ver o nome e a foto dela no portal, e o caminho da foto (profissionais/<id>/foto.<ext>). Ela mesma, a coordenação ou a diretoria.';

-- --- Link mágico: o servidor, com o cliente de serviço ---------------------------

create function public.portal_familia_localizar(email text, origem text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_cfg   jsonb := coalesce(privado.venda_parametro('portal_familia'), '{}'::jsonb);
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(portal_familia_localizar.email, '')));
  v_janela integer := (v_cfg ->> 'link_janela_minutos')::integer;
  v_a     privado.acesso_familia;
  v_f     public.familia;
begin
  if privado.relacao_limite('portal_link', portal_familia_localizar.origem, (v_cfg ->> 'link_max_por_origem')::integer, v_janela, true)
     or (v_email <> '' and privado.relacao_limite('portal_link', v_email, (v_cfg ->> 'link_max_por_email')::integer, v_janela, true)) then
    return pg_catalog.jsonb_build_object('situacao', 'limite', 'minutos', v_janela);
  end if;
  if v_email = '' or pg_catalog.char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return pg_catalog.jsonb_build_object('situacao', 'nao_encontrado');
  end if;

  select a.* into v_a
  from privado.acesso_familia a
  join public.pessoa p on p.id = a.pessoa_id
  where a.ativo and pg_catalog.lower(pg_catalog.btrim(p.email)) = v_email
  order by a.criado_em, a.id limit 1;
  if not found then
    return pg_catalog.jsonb_build_object('situacao', 'nao_encontrado');
  end if;
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;
  -- Família em estado sensível não recebe e-mail do sistema (freio, PRD 8.2);
  -- a resposta é a mesma de e-mail desconhecido.
  if v_f.mesclada_em_id is not null or not privado.freio_permite('operacional', v_f.estado_sensivel) then
    return pg_catalog.jsonb_build_object('situacao', 'nao_encontrado');
  end if;
  return pg_catalog.jsonb_build_object('situacao', 'ok', 'acesso_id', v_a.id);
end;
$$;
comment on function public.portal_familia_localizar(text, text) is '[P49] Passo 1 do link mágico: limite por origem e por e-mail (HMAC) e confere que há acesso ativo para o e-mail do cadastro. Só com resposta ok o servidor pede ao Supabase Auth que envie o link (o e-mail é do Supabase Auth, com o texto de mensagem_modelo portal_email_*; o app não envia e-mail direto). E-mail desconhecido, família em estado sensível e família mesclada respondem igual (nao_encontrado). Só o servidor (service_role). Não devolve o e-mail.';

-- Textos das páginas de entrada e de link vencido do portal (mensagem_modelo,
-- canal site). Sem dado nenhum; só o servidor chama.
create function public.portal_familia_pagina() returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select pg_catalog.jsonb_build_object(
    'entrar', privado.textos_site('portal_entrar_'),
    'link', privado.textos_site('portal_link_'))
$$;
comment on function public.portal_familia_pagina() is '[P49] Textos da página de entrada do portal e do aviso de link vencido (mensagem_modelo portal_entrar_* e portal_link_*). Sem dado de ninguém. Só o servidor (service_role).';

-- Depois que o Supabase Auth confirmou o link (o e-mail é da pessoa), liga a
-- conta ao acesso liberado para aquele e-mail.
create function public.portal_familia_vincular(email text, usuario_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(portal_familia_vincular.email, '')));
  v_id    uuid;
begin
  select a.id into v_id
  from privado.acesso_familia a
  join public.pessoa p on p.id = a.pessoa_id
  join public.familia f on f.id = a.familia_id
  where a.ativo and f.mesclada_em_id is null and v_email <> ''
    and pg_catalog.lower(pg_catalog.btrim(p.email)) = v_email
  order by a.criado_em, a.id limit 1;
  if v_id is null then
    return pg_catalog.jsonb_build_object('situacao', 'nao_encontrado');
  end if;
  update privado.acesso_familia a set usuario_id = portal_familia_vincular.usuario_id where a.id = v_id;
  return pg_catalog.jsonb_build_object('situacao', 'ok');
exception when unique_violation then
  return pg_catalog.jsonb_build_object('situacao', 'conflito');
end;
$$;
comment on function public.portal_familia_vincular(text, uuid) is '[P49] Passo 2 do link mágico: com o link confirmado pelo Supabase Auth, guarda o usuário no acesso ativo do e-mail. Só o servidor (service_role).';


-- =============================================================================
-- 5. P50 · Indicações e parceiros médicos
--
-- Relacionamento institucional, nunca comissão (PRD 12): nenhuma tabela ou
-- função daqui tem valor, percentual, comissão ou contrapartida, e a tela
-- mostra o aviso sobre a vedação ética (texto em mensagem_modelo, para
-- validar com o jurídico da Kraamzorg). O parceiro é um `medico` sem família
-- (PRD 6.2); a indicação de família promotora fica registrada com a origem
-- indicacao_cliente, e a do médico com indicacao_medica.
-- =============================================================================

create type privado.estado_parceiro as enum ('prospeccao', 'ativo', 'pausado', 'encerrado');

create table privado.parceiro_medico (
  medico_id           uuid primary key references public.medico(id) on delete cascade,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  criado_por          uuid references public.perfil(id),
  estado              privado.estado_parceiro not null default 'prospeccao',
  observacao          text check (observacao is null or pg_catalog.char_length(observacao) <= 1000),
  ultimo_contato_em   timestamptz,
  proximo_contato_em  date
);
comment on table privado.parceiro_medico is '[P50] Relação da Kraamzorg com um médico parceiro (medico sem família): estado, observação, último e próximo contato. Sem nenhum campo de valor: contrapartida financeira por indicação de paciente esbarra em vedação ética médica (PRD 12). O teste 027 confere que a tabela e a de indicação não têm coluna de dinheiro.';
create index on privado.parceiro_medico (criado_por);
create trigger tocar_atualizado_em before update on privado.parceiro_medico
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.parceiro_medico
  for each row execute function privado.auditar('medico_id');
alter table privado.parceiro_medico enable row level security;
revoke all on privado.parceiro_medico from public, anon, authenticated, service_role;

create function privado.parceiro_so_sem_familia() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
begin
  if exists (select 1 from public.medico m where m.id = new.medico_id and m.familia_id is not null) then
    raise exception 'o parceiro médico não pode ser o médico de uma família (medico.familia_id deve ser nulo)'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
comment on function privado.parceiro_so_sem_familia() is '[P50] Gatilho: parceiro médico é medico com familia_id nulo (PRD 6.2). Sem grant.';
create trigger so_sem_familia before insert or update of medico_id on privado.parceiro_medico
  for each row execute function privado.parceiro_so_sem_familia();

create table privado.indicacao (
  id                  uuid primary key default gen_random_uuid(),
  criado_em           timestamptz not null default now(),
  criado_por          uuid references public.perfil(id),
  familia_id          uuid not null unique references public.familia(id) on delete cascade,
  medico_id           uuid references public.medico(id) on delete set null,
  familia_promotora_id uuid references public.familia(id) on delete set null,
  observacao          text check (observacao is null or pg_catalog.char_length(observacao) <= 500)
);
comment on table privado.indicacao is '[P50] Indicação recebida: a família indicada (uma só vez), e o médico parceiro ou a família promotora que indicou. A família ganha origem indicacao_medica ou indicacao_cliente e o vínculo (indicacao_medico_id, indicacao_familia_id). Sem valor nenhum. Se o médico ou a promotora forem eliminados, a indicação continua, sem o vínculo.';
create index on privado.indicacao (medico_id);
create index on privado.indicacao (familia_promotora_id);
create index on privado.indicacao (criado_por);
create trigger auditar after insert or update or delete on privado.indicacao
  for each row execute function privado.auditar('id');
alter table privado.indicacao enable row level security;
revoke all on privado.indicacao from public, anon, authenticated, service_role;

create function api.parceiros_listar() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_hoje date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  v_cfg  jsonb := coalesce(privado.venda_parametro('indicacoes'), '{}'::jsonb);
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  return pg_catalog.jsonb_build_object(
    'aviso', (select m.texto from public.mensagem_modelo m where m.chave = 'parceiros_aviso_vedacao'),
    'relacionamento_dias', (v_cfg ->> 'relacionamento_dias')::integer,
    'parceiros', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'medico_id', m.id, 'nome', m.nome, 'especialidade', m.especialidade::text, 'hospital', m.hospital,
               'telefone_e164', m.telefone_e164, 'email', m.email, 'estado', pm.estado::text, 'observacao', pm.observacao,
               'ultimo_contato_em', pm.ultimo_contato_em, 'proximo_contato_em', pm.proximo_contato_em,
               'dias_sem_contato', case when pm.ultimo_contato_em is not null
                                        then v_hoje - (pm.ultimo_contato_em at time zone 'America/Sao_Paulo')::date end,
               'precisa_contato', pm.estado in ('prospeccao', 'ativo') and pm.proximo_contato_em is not null and pm.proximo_contato_em <= v_hoje,
               'indicacoes', (select pg_catalog.count(*) from privado.indicacao i where i.medico_id = m.id),
               'contratos', (select pg_catalog.count(*) from privado.indicacao i
                             where i.medico_id = m.id
                               and exists (select 1 from public.oportunidade op
                                           where op.familia_id = i.familia_id and op.estagio_p2 is not null
                                             and op.estagio_p2 not in ('proposta_enviada', 'em_negociacao', 'perdido', 'cancelado', 'distrato'))),
               'tarefas_abertas', (select pg_catalog.count(*) from public.tarefa t
                                   where t.status in ('aberta', 'em_andamento') and t.payload ->> 'acao' = 'relacionamento_medico'
                                     and t.payload ->> 'medico_id' = m.id::text))
             order by pm.estado, m.nome, m.id)
      from privado.parceiro_medico pm join public.medico m on m.id = pm.medico_id), '[]'::jsonb));
end;
$$;
comment on function api.parceiros_listar() is '[P50] Médicos parceiros com estado, último e próximo contato, indicações recebidas, contratos que viraram e tarefas de relacionamento abertas, mais o aviso sobre a vedação de contrapartida financeira. Comercial e diretoria.';

create function api.parceiro_salvar(
  medico_id          uuid,
  nome               text,
  especialidade      public.especialidade_medico,
  telefone           text default null,
  email              text default null,
  hospital           text default null,
  estado             text default 'prospeccao',
  observacao         text default null,
  proximo_contato_em date default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_nome  text := pg_catalog.btrim(parceiro_salvar.nome);
  v_tel   text := privado.relacao_telefone(parceiro_salvar.telefone);
  v_email text := nullif(pg_catalog.btrim(parceiro_salvar.email), '');
  v_id    uuid := parceiro_salvar.medico_id;
  v_estado privado.estado_parceiro;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  begin
    v_estado := coalesce(nullif(parceiro_salvar.estado, ''), 'prospeccao')::privado.estado_parceiro;
  exception when invalid_text_representation then
    perform privado.relacao_recusar('estado_invalido');
  end;
  if v_nome is null or pg_catalog.char_length(v_nome) not between 2 and 120 then
    perform privado.relacao_recusar('nome_invalido');
  end if;
  if parceiro_salvar.especialidade is null then
    perform privado.relacao_recusar('especialidade_invalida');
  end if;
  if nullif(pg_catalog.btrim(parceiro_salvar.telefone), '') is not null and v_tel is null then
    perform privado.relacao_recusar('telefone_invalido');
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform privado.relacao_recusar('email_invalido');
  end if;

  if v_id is null then
    insert into public.medico (familia_id, especialidade, nome, telefone_e164, email, hospital, origem_cadastro, capturado_em, criado_por)
    values (null, parceiro_salvar.especialidade, v_nome, v_tel, v_email,
            nullif(pg_catalog.btrim(parceiro_salvar.hospital), ''), 'parceria', pg_catalog.now(), auth.uid())
    returning id into v_id;
    insert into privado.parceiro_medico (medico_id, criado_por, estado, observacao, proximo_contato_em)
    values (v_id, auth.uid(), v_estado,
            nullif(pg_catalog.btrim(parceiro_salvar.observacao), ''), parceiro_salvar.proximo_contato_em);
  else
    if not exists (select 1 from privado.parceiro_medico pm where pm.medico_id = v_id) then
      perform privado.relacao_recusar('parceiro_inexistente');
    end if;
    update public.medico m
       set nome = v_nome, especialidade = parceiro_salvar.especialidade, telefone_e164 = v_tel, email = v_email,
           hospital = nullif(pg_catalog.btrim(parceiro_salvar.hospital), '')
     where m.id = v_id;
    update privado.parceiro_medico pm
       set estado = v_estado,
           observacao = nullif(pg_catalog.btrim(parceiro_salvar.observacao), ''),
           proximo_contato_em = parceiro_salvar.proximo_contato_em
     where pm.medico_id = v_id;
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'medico_id', v_id);
end;
$$;
comment on function api.parceiro_salvar(uuid, text, public.especialidade_medico, text, text, text, text, text, date) is '[P50] Cadastra ou edita um médico parceiro (medico sem família mais a relação). Sem campo de valor. Comercial e diretoria. Nome, telefone e e-mail do médico ficam ocultos no log (gatilho de medico).';

create function api.parceiro_contato_registrar(medico_id uuid, observacao text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_dias integer := coalesce(privado.venda_numero('indicacoes', 'relacionamento_dias'), 60)::integer;
  v_hoje date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  update privado.parceiro_medico pm
     set ultimo_contato_em = pg_catalog.now(),
         proximo_contato_em = v_hoje + v_dias,
         estado = case when pm.estado = 'prospeccao' then 'ativo'::privado.estado_parceiro else pm.estado end,
         observacao = coalesce(nullif(pg_catalog.btrim(parceiro_contato_registrar.observacao), ''), pm.observacao)
   where pm.medico_id = parceiro_contato_registrar.medico_id;
  if not found then
    perform privado.relacao_recusar('parceiro_inexistente');
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'proximo_contato_em', v_hoje + v_dias);
end;
$$;
comment on function api.parceiro_contato_registrar(uuid, text) is '[P50] Registra o contato de hoje com o médico e marca o próximo daqui a parametro.indicacoes.relacionamento_dias. Prospecção vira ativo no primeiro contato. Comercial e diretoria.';

create function api.parceiro_tarefa_criar(medico_id uuid, titulo text, vence_em date default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_titulo text := pg_catalog.btrim(parceiro_tarefa_criar.titulo);
  v_id     uuid;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  if not exists (select 1 from privado.parceiro_medico pm where pm.medico_id = parceiro_tarefa_criar.medico_id) then
    perform privado.relacao_recusar('parceiro_inexistente');
  end if;
  if v_titulo is null or pg_catalog.char_length(v_titulo) not between 3 and 120 then
    perform privado.relacao_recusar('titulo_invalido');
  end if;
  insert into public.tarefa (tipo, familia_id, responsavel_id, prioridade, titulo, payload, vence_em, criado_por)
  values ('outro', null, auth.uid(), 'normal', v_titulo,
          pg_catalog.jsonb_build_object('acao', 'relacionamento_medico', 'medico_id', parceiro_tarefa_criar.medico_id),
          case when parceiro_tarefa_criar.vence_em is not null
               then (parceiro_tarefa_criar.vence_em::timestamp at time zone 'America/Sao_Paulo') end,
          auth.uid())
  returning id into v_id;
  return pg_catalog.jsonb_build_object('ok', true, 'tarefa_id', v_id);
end;
$$;
comment on function api.parceiro_tarefa_criar(uuid, text, date) is '[P50] Tarefa de relacionamento com um médico parceiro (tipo outro, payload acao = relacionamento_medico), do usuário que criou. Comercial e diretoria.';

create function api.indicacao_registrar(
  familia_id           uuid,
  medico_id            uuid default null,
  familia_promotora_id uuid default null,
  observacao           text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_f  public.familia;
  v_id uuid;
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  if (indicacao_registrar.medico_id is null) = (indicacao_registrar.familia_promotora_id is null) then
    perform privado.relacao_recusar('indicacao_invalida', 'informe o médico parceiro ou a família promotora, só um');
  end if;
  select f.* into v_f from public.familia f where f.id = indicacao_registrar.familia_id for update;
  if not found or v_f.mesclada_em_id is not null then
    perform privado.relacao_recusar('familia_inexistente');
  end if;
  if exists (select 1 from privado.indicacao i where i.familia_id = v_f.id) then
    perform privado.relacao_recusar('indicacao_ja_registrada');
  end if;
  if indicacao_registrar.medico_id is not null
     and not exists (select 1 from privado.parceiro_medico pm where pm.medico_id = indicacao_registrar.medico_id) then
    perform privado.relacao_recusar('parceiro_inexistente');
  end if;
  if indicacao_registrar.familia_promotora_id is not null then
    if indicacao_registrar.familia_promotora_id = v_f.id then
      perform privado.relacao_recusar('promotora_e_indicada', 'a família não indica a si mesma');
    end if;
    if not exists (select 1 from public.familia p where p.id = indicacao_registrar.familia_promotora_id and p.mesclada_em_id is null) then
      perform privado.relacao_recusar('promotora_inexistente');
    end if;
  end if;

  insert into privado.indicacao (familia_id, medico_id, familia_promotora_id, observacao, criado_por)
  values (v_f.id, indicacao_registrar.medico_id, indicacao_registrar.familia_promotora_id,
          nullif(pg_catalog.btrim(indicacao_registrar.observacao), ''), auth.uid())
  returning id into v_id;

  update public.familia f
     set origem = case when indicacao_registrar.medico_id is not null then 'indicacao_medica'::public.origem_lead
                       else 'indicacao_cliente'::public.origem_lead end,
         indicacao_medico_id = coalesce(indicacao_registrar.medico_id, f.indicacao_medico_id),
         indicacao_familia_id = coalesce(indicacao_registrar.familia_promotora_id, f.indicacao_familia_id)
   where f.id = v_f.id;
  perform privado.venda_evento(v_f.id, 'indicacao', 'Indicação registrada',
    pg_catalog.jsonb_build_object('tipo', case when indicacao_registrar.medico_id is not null then 'medico' else 'familia' end));
  return pg_catalog.jsonb_build_object('ok', true, 'indicacao_id', v_id,
    'origem', case when indicacao_registrar.medico_id is not null then 'indicacao_medica' else 'indicacao_cliente' end);
end;
$$;
comment on function api.indicacao_registrar(uuid, uuid, uuid, text) is '[P50] Registra quem indicou a família: um médico parceiro (origem indicacao_medica) ou uma família promotora (origem indicacao_cliente). Uma indicação por família. Grava o vínculo na família, o evento na linha do tempo (sem nome) e entra no relatório de origem do marketing. Sem valor de contrapartida. Comercial e diretoria.';

create function api.indicacoes_relatorio(desde date default null, ate date default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
  return (
    with ind as (
      select i.*,
             exists (select 1 from public.oportunidade op where op.familia_id = i.familia_id
                     and (op.estagio_p2 is not null or op.estagio_p1 in ('qualificado', 'sessao_venda_agendada', 'sessao_venda_realizada'))) as qualificada,
             exists (select 1 from public.oportunidade op where op.familia_id = i.familia_id and op.estagio_p2 is not null
                     and op.estagio_p2 not in ('proposta_enviada', 'em_negociacao', 'perdido', 'cancelado', 'distrato')) as contrato
      from privado.indicacao i
      where (indicacoes_relatorio.desde is null or (i.criado_em at time zone 'America/Sao_Paulo')::date >= indicacoes_relatorio.desde)
        and (indicacoes_relatorio.ate is null or (i.criado_em at time zone 'America/Sao_Paulo')::date <= indicacoes_relatorio.ate)
    )
    select pg_catalog.jsonb_build_object(
      'desde', indicacoes_relatorio.desde, 'ate', indicacoes_relatorio.ate,
      'total', (select pg_catalog.count(*) from ind),
      'por_medico', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'medico_id', m.id, 'nome', m.nome, 'especialidade', m.especialidade::text,
                 'indicacoes', x.n, 'qualificadas', x.q, 'contratos', x.k) order by x.n desc, m.nome, m.id)
        from (select medico_id, pg_catalog.count(*) as n, pg_catalog.count(*) filter (where qualificada) as q,
                     pg_catalog.count(*) filter (where contrato) as k
              from ind where medico_id is not null group by medico_id) x
        join public.medico m on m.id = x.medico_id), '[]'::jsonb),
      'por_promotora', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'familia_id', f.id, 'nome_exibicao', f.nome_exibicao,
                 'indicacoes', x.n, 'qualificadas', x.q, 'contratos', x.k) order by x.n desc, f.nome_exibicao, f.id)
        from (select familia_promotora_id, pg_catalog.count(*) as n, pg_catalog.count(*) filter (where qualificada) as q,
                     pg_catalog.count(*) filter (where contrato) as k
              from ind where familia_promotora_id is not null group by familia_promotora_id) x
        join public.familia f on f.id = x.familia_promotora_id), '[]'::jsonb),
      'sem_vinculo', (select pg_catalog.count(*) from ind where medico_id is null and familia_promotora_id is null)));
end;
$$;
comment on function api.indicacoes_relatorio(date, date) is '[P50] Indicações do período por médico parceiro e por família promotora: recebidas, qualificadas e que viraram contrato. Só contagens. O relatório de origem do marketing (api.marketing_relatorio) também as mostra, em indicacao_medica e indicacao_cliente. Comercial e diretoria.';


-- =============================================================================
-- 6. P51 · Tarefas por equipe, manuais, treinamentos e banco de talentos
-- =============================================================================

-- --- Tarefas por equipe ----------------------------------------------------------

create function api.tarefas_por_equipe() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_agora timestamptz := pg_catalog.now();
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  return (
    with t as (
      select k.id, k.titulo, k.tipo::text as tipo, k.prioridade::text as prioridade, k.status::text as status,
             k.vence_em, k.concluida_em, k.responsavel_id, k.familia_id,
             coalesce(k.papel_responsavel::text,
                      (select up.papel::text from public.usuario_papel up
                       where up.usuario_id = k.responsavel_id
                       order by pg_catalog.array_position(array['diretoria', 'coordenacao', 'comercial', 'financeiro', 'marketing', 'enfermeira'], up.papel::text)
                       limit 1),
                      'sem_equipe') as equipe,
             k.status in ('aberta', 'em_andamento') as aberta,
             (k.status in ('aberta', 'em_andamento') and k.vence_em is not null and k.vence_em < v_agora) as vencida
      from public.tarefa k
      where k.status in ('aberta', 'em_andamento') or k.concluida_em >= v_agora - interval '7 days'
    )
    select pg_catalog.jsonb_build_object(
      'em', v_agora,
      'equipes', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'equipe', e.equipe, 'abertas', e.abertas, 'em_andamento', e.em_andamento, 'vencidas', e.vencidas,
                 'sem_responsavel', e.sem_responsavel, 'concluidas_7d', e.concluidas) order by e.equipe)
        from (select equipe,
                     pg_catalog.count(*) filter (where aberta) as abertas,
                     pg_catalog.count(*) filter (where status = 'em_andamento') as em_andamento,
                     pg_catalog.count(*) filter (where vencida) as vencidas,
                     pg_catalog.count(*) filter (where aberta and responsavel_id is null) as sem_responsavel,
                     pg_catalog.count(*) filter (where not aberta) as concluidas
              from t group by equipe) e), '[]'::jsonb),
      'pessoas', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'usuario_id', p.id, 'nome', p.nome, 'equipe', x.equipe, 'abertas', x.abertas, 'vencidas', x.vencidas)
                 order by x.vencidas desc, x.abertas desc, p.nome)
        from (select responsavel_id, equipe, pg_catalog.count(*) filter (where aberta) as abertas,
                     pg_catalog.count(*) filter (where vencida) as vencidas
              from t where responsavel_id is not null group by responsavel_id, equipe) x
        join public.perfil p on p.id = x.responsavel_id where x.abertas > 0), '[]'::jsonb),
      'tarefas', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'id', y.id, 'titulo', y.titulo, 'tipo', y.tipo, 'prioridade', y.prioridade, 'status', y.status,
                 'vence_em', y.vence_em, 'vencida', y.vencida, 'equipe', y.equipe,
                 'responsavel', y.responsavel, 'familia', y.familia) order by y.vencida desc, y.ordem_prio desc, y.vence_em nulls last, y.id)
        from (select t.*, u.nome as responsavel, f.nome_exibicao as familia,
                     case t.prioridade when 'maxima' then 2 when 'alta' then 1 else 0 end as ordem_prio
              from t
              left join public.perfil u on u.id = t.responsavel_id
              left join public.familia f on f.id = t.familia_id
              where t.aberta
              order by t.vencida desc, case t.prioridade when 'maxima' then 2 when 'alta' then 1 else 0 end desc, t.vence_em nulls last, t.id
              limit 200) y), '[]'::jsonb)));
end;
$$;
comment on function api.tarefas_por_equipe() is '[P51 item 1] Tarefas por equipe (papel responsável, ou o principal papel de quem é o responsável): abertas, em andamento, vencidas, sem responsável e concluídas nos últimos 7 dias; carga por pessoa; e as 200 tarefas abertas mais urgentes. Coordenação e diretoria, AAL2.';

-- --- Manuais e protocolos --------------------------------------------------------

create type privado.categoria_manual as enum ('manual', 'protocolo');

create table privado.manual (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por    uuid references public.perfil(id),
  titulo        text not null check (pg_catalog.char_length(pg_catalog.btrim(titulo)) between 3 and 120),
  categoria     privado.categoria_manual not null default 'manual',
  papeis_alvo   public.papel_usuario[] not null default '{}',
  ativo         boolean not null default true
);
comment on table privado.manual is '[P51 item 2] Manual ou protocolo interno. papeis_alvo vazio = todos os papéis; senão só quem tem um deles lê e confirma. O texto vive nas versões (manual_versao); mudar o texto publica uma versão nova e zera as confirmações.';
create index on privado.manual (criado_por);
create trigger tocar_atualizado_em before update on privado.manual
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.manual
  for each row execute function privado.auditar('id');
alter table privado.manual enable row level security;
revoke all on privado.manual from public, anon, authenticated, service_role;

create table privado.manual_versao (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  manual_id      uuid not null references privado.manual(id) on delete cascade,
  versao         integer not null check (versao >= 1),
  conteudo       text not null check (pg_catalog.char_length(conteudo) between 1 and 50000),
  resumo_mudanca text check (resumo_mudanca is null or pg_catalog.char_length(resumo_mudanca) <= 300),
  publicada_por  uuid references public.perfil(id),
  unique (manual_id, versao)
);
comment on table privado.manual_versao is '[P51 item 2] Versão publicada de um manual: numerada, com o que mudou e quem publicou. Nunca editada depois de publicada (a versão nova é outra linha). O conteúdo é texto de orientação interna escrito pela coordenação; o sistema não cria nem altera protocolo clínico.';
create index on privado.manual_versao (publicada_por);
create trigger auditar after insert or update or delete on privado.manual_versao
  for each row execute function privado.auditar('id');
alter table privado.manual_versao enable row level security;
revoke all on privado.manual_versao from public, anon, authenticated, service_role;

create function privado.manual_versao_imutavel() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  raise exception 'versão de manual já publicada não se altera nem se apaga: publique uma versão nova' using errcode = '42501';
end;
$$;
comment on function privado.manual_versao_imutavel() is '[P51] Gatilho: manual_versao é append-only (UPDATE recusado; a linha só some se o manual for apagado, em cascata). Sem grant.';
create trigger imutavel before update on privado.manual_versao
  for each row execute function privado.manual_versao_imutavel();

create table privado.manual_leitura (
  versao_id    uuid not null references privado.manual_versao(id) on delete cascade,
  usuario_id   uuid not null references public.perfil(id) on delete cascade,
  confirmada_em timestamptz not null default now(),
  primary key (versao_id, usuario_id)
);
comment on table privado.manual_leitura is '[P51 item 2] Confirmação de leitura: quem confirmou que leu qual versão e quando. Versão nova de um manual não herda confirmação.';
create index on privado.manual_leitura (usuario_id);
create trigger auditar after insert or update or delete on privado.manual_leitura
  for each row execute function privado.auditar('versao_id', 'usuario_id');
alter table privado.manual_leitura enable row level security;
revoke all on privado.manual_leitura from public, anon, authenticated, service_role;

create table privado.trilha (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por    uuid references public.perfil(id),
  nome          text not null check (pg_catalog.char_length(pg_catalog.btrim(nome)) between 3 and 120),
  papel_alvo    public.papel_usuario not null default 'enfermeira',
  ativa         boolean not null default true
);
comment on table privado.trilha is '[P51 item 2] Trilha de treinamento: uma sequência de manuais para um papel (padrão, enfermeira). O andamento de cada pessoa é a confirmação de leitura da versão atual de cada manual.';
create index on privado.trilha (criado_por);
create trigger tocar_atualizado_em before update on privado.trilha
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.trilha
  for each row execute function privado.auditar('id');
alter table privado.trilha enable row level security;
revoke all on privado.trilha from public, anon, authenticated, service_role;

create table privado.trilha_item (
  trilha_id uuid not null references privado.trilha(id) on delete cascade,
  manual_id uuid not null references privado.manual(id) on delete cascade,
  ordem     integer not null check (ordem >= 1),
  primary key (trilha_id, manual_id),
  unique (trilha_id, ordem) deferrable initially deferred
);
comment on table privado.trilha_item is '[P51 item 2] Manuais de uma trilha, na ordem.';
create index on privado.trilha_item (manual_id);
alter table privado.trilha_item enable row level security;
revoke all on privado.trilha_item from public, anon, authenticated, service_role;

-- O manual serve a quem tem um dos papéis de alvo (vazio = todos); coordenação
-- e diretoria veem todos.
create function privado.manual_visivel(alvo public.papel_usuario[]) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select privado.tem_papel('coordenacao') or privado.tem_papel('diretoria')
      or pg_catalog.cardinality(manual_visivel.alvo) = 0
      or exists (select 1 from public.usuario_papel up
                 where up.usuario_id = auth.uid() and up.papel = any (manual_visivel.alvo))
$$;
comment on function privado.manual_visivel(public.papel_usuario[]) is '[P51] O usuário logado pode ler o manual com estes papéis de alvo? Sem grant.';

create function api.manuais_listar() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_gestao boolean;
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  v_gestao := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', m.id, 'titulo', m.titulo, 'categoria', m.categoria::text, 'papeis_alvo', pg_catalog.to_jsonb(m.papeis_alvo),
             'ativo', m.ativo, 'versao', v.versao, 'versao_id', v.id, 'publicada_em', v.criado_em,
             'lido', exists (select 1 from privado.manual_leitura l where l.versao_id = v.id and l.usuario_id = auth.uid()),
             'confirmacoes', case when v_gestao then (select pg_catalog.count(*) from privado.manual_leitura l where l.versao_id = v.id) end)
           order by m.categoria, m.titulo, m.id)
    from privado.manual m
    join lateral (select mv.* from privado.manual_versao mv where mv.manual_id = m.id order by mv.versao desc limit 1) v on true
    where (m.ativo or v_gestao) and privado.manual_visivel(m.papeis_alvo)), '[]'::jsonb);
end;
$$;
comment on function api.manuais_listar() is '[P51 item 2] Manuais e protocolos que o usuário pode ler, com a versão atual e se ele já confirmou a leitura dela. Coordenação e diretoria veem também os inativos e quantas confirmações cada versão tem. Qualquer papel.';

create function api.manual_obter(manual_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_m privado.manual;
  v_v privado.manual_versao;
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  select m.* into v_m from privado.manual m where m.id = manual_obter.manual_id;
  if not found or not privado.manual_visivel(v_m.papeis_alvo)
     or (not v_m.ativo and not (privado.tem_papel('coordenacao') or privado.tem_papel('diretoria'))) then
    perform privado.relacao_recusar('manual_inexistente');
  end if;
  select mv.* into v_v from privado.manual_versao mv where mv.manual_id = v_m.id order by mv.versao desc limit 1;
  return pg_catalog.jsonb_build_object(
    'id', v_m.id, 'titulo', v_m.titulo, 'categoria', v_m.categoria::text, 'papeis_alvo', pg_catalog.to_jsonb(v_m.papeis_alvo),
    'ativo', v_m.ativo, 'versao', v_v.versao, 'versao_id', v_v.id, 'conteudo', v_v.conteudo, 'publicada_em', v_v.criado_em,
    'lido', exists (select 1 from privado.manual_leitura l where l.versao_id = v_v.id and l.usuario_id = auth.uid()),
    'historico', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                    'versao', h.versao, 'publicada_em', h.criado_em, 'resumo_mudanca', h.resumo_mudanca) order by h.versao desc), '[]'::jsonb)
                  from privado.manual_versao h where h.manual_id = v_m.id));
end;
$$;
comment on function api.manual_obter(uuid) is '[P51 item 2] O manual na versão atual, com o histórico de versões e se o usuário já confirmou a leitura. Qualquer papel do público-alvo.';

create function api.manual_salvar(
  manual_id      uuid,
  titulo         text,
  categoria      text,
  papeis_alvo    public.papel_usuario[],
  conteudo       text,
  resumo_mudanca text default null,
  ativo          boolean default true
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_titulo   text := pg_catalog.btrim(manual_salvar.titulo);
  v_conteudo text := pg_catalog.btrim(manual_salvar.conteudo);
  v_resumo   text := nullif(pg_catalog.btrim(manual_salvar.resumo_mudanca), '');
  v_cat      privado.categoria_manual;
  v_m        privado.manual;
  v_atual    privado.manual_versao;
  v_nova     integer;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  begin
    v_cat := coalesce(nullif(manual_salvar.categoria, ''), 'manual')::privado.categoria_manual;
  exception when invalid_text_representation then
    perform privado.relacao_recusar('categoria_invalida');
  end;
  if v_titulo is null or pg_catalog.char_length(v_titulo) not between 3 and 120 then
    perform privado.relacao_recusar('titulo_invalido');
  end if;
  if v_conteudo is null or v_conteudo = '' or pg_catalog.char_length(v_conteudo) > 50000 then
    perform privado.relacao_recusar('conteudo_invalido');
  end if;

  if manual_salvar.manual_id is null then
    insert into privado.manual (titulo, categoria, papeis_alvo, ativo, criado_por)
    values (v_titulo, v_cat, coalesce(manual_salvar.papeis_alvo, '{}'), coalesce(manual_salvar.ativo, true), auth.uid())
    returning * into v_m;
    v_nova := 1;
  else
    select m.* into v_m from privado.manual m where m.id = manual_salvar.manual_id for update;
    if not found then
      perform privado.relacao_recusar('manual_inexistente');
    end if;
    update privado.manual m
       set titulo = v_titulo, categoria = v_cat, papeis_alvo = coalesce(manual_salvar.papeis_alvo, m.papeis_alvo),
           ativo = coalesce(manual_salvar.ativo, m.ativo)
     where m.id = v_m.id returning * into v_m;
    select mv.* into v_atual from privado.manual_versao mv where mv.manual_id = v_m.id order by mv.versao desc limit 1;
    if v_atual.conteudo is distinct from v_conteudo then
      v_nova := v_atual.versao + 1;
    end if;
  end if;

  if v_nova is not null then
    if v_nova > 1 and v_resumo is null then
      perform privado.relacao_recusar('resumo_obrigatorio', 'diga em uma frase o que mudou nesta versão');
    end if;
    insert into privado.manual_versao (manual_id, versao, conteudo, resumo_mudanca, publicada_por)
    values (v_m.id, v_nova, v_conteudo, v_resumo, auth.uid());
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'manual_id', v_m.id, 'versao', coalesce(v_nova, v_atual.versao),
                                       'nova_versao', v_nova is not null);
end;
$$;
comment on function api.manual_salvar(uuid, text, text, public.papel_usuario[], text, text, boolean) is '[P51 item 2] Cria ou edita um manual. Mudou o texto: publica versão nova (exige o que mudou) e ninguém herda confirmação. Só o título, a categoria, o público ou o interruptor: sem versão nova. Coordenação e diretoria, AAL2.';

create function api.manual_confirmar_leitura(versao_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_v privado.manual_versao;
  v_m privado.manual;
  v_atual integer;
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  select mv.* into v_v from privado.manual_versao mv where mv.id = manual_confirmar_leitura.versao_id;
  if not found then
    perform privado.relacao_recusar('versao_inexistente');
  end if;
  select m.* into v_m from privado.manual m where m.id = v_v.manual_id;
  if not v_m.ativo or not privado.manual_visivel(v_m.papeis_alvo) then
    perform privado.relacao_recusar('manual_inexistente');
  end if;
  select pg_catalog.max(mv.versao) into v_atual from privado.manual_versao mv where mv.manual_id = v_m.id;
  if v_v.versao <> v_atual then
    perform privado.relacao_recusar('versao_antiga', 'há uma versão mais nova; leia e confirme a atual');
  end if;
  insert into privado.manual_leitura (versao_id, usuario_id) values (v_v.id, auth.uid())
  on conflict (versao_id, usuario_id) do nothing;
  return pg_catalog.jsonb_build_object('ok', true, 'versao', v_v.versao);
end;
$$;
comment on function api.manual_confirmar_leitura(uuid) is '[P51 item 2] Confirma que leu a versão atual do manual (só a atual; repetir não muda nada). Qualquer papel do público-alvo.';

create function api.manual_leituras(manual_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_m privado.manual;
  v_v privado.manual_versao;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  select m.* into v_m from privado.manual m where m.id = manual_leituras.manual_id;
  if not found then
    perform privado.relacao_recusar('manual_inexistente');
  end if;
  select mv.* into v_v from privado.manual_versao mv where mv.manual_id = v_m.id order by mv.versao desc limit 1;
  return pg_catalog.jsonb_build_object(
    'manual_id', v_m.id, 'versao', v_v.versao,
    'pessoas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'usuario_id', p.id, 'nome', p.nome, 'confirmou', l.usuario_id is not null, 'confirmada_em', l.confirmada_em)
               order by (l.usuario_id is not null), p.nome, p.id)
      from public.perfil p
      left join privado.manual_leitura l on l.versao_id = v_v.id and l.usuario_id = p.id
      where p.ativo
        and exists (select 1 from public.usuario_papel up
                    where up.usuario_id = p.id
                      and (pg_catalog.cardinality(v_m.papeis_alvo) = 0 or up.papel = any (v_m.papeis_alvo)))), '[]'::jsonb));
end;
$$;
comment on function api.manual_leituras(uuid) is '[P51 item 2] Quem do público-alvo confirmou a leitura da versão atual do manual e quem ainda não. Coordenação e diretoria, AAL2.';

create function api.trilhas_listar() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_gestao boolean;
begin
  perform privado.autorizar(array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[], false);
  v_gestao := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', t.id, 'nome', t.nome, 'papel_alvo', t.papel_alvo::text, 'ativa', t.ativa,
             'itens', (
               select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'ordem', ti.ordem, 'manual_id', m.id, 'titulo', m.titulo, 'versao', v.versao, 'versao_id', v.id,
                        'lido', exists (select 1 from privado.manual_leitura l where l.versao_id = v.id and l.usuario_id = auth.uid()))
                        order by ti.ordem), '[]'::jsonb)
               from privado.trilha_item ti
               join privado.manual m on m.id = ti.manual_id and m.ativo
               join lateral (select mv.* from privado.manual_versao mv where mv.manual_id = m.id order by mv.versao desc limit 1) v on true
               where ti.trilha_id = t.id),
             'equipe', case when v_gestao then (
               select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                        'usuario_id', p.id, 'nome', p.nome,
                        'feitos', (select pg_catalog.count(*) from privado.trilha_item ti
                                   join privado.manual m on m.id = ti.manual_id and m.ativo
                                   join lateral (select mv.id from privado.manual_versao mv where mv.manual_id = m.id order by mv.versao desc limit 1) v on true
                                   where ti.trilha_id = t.id
                                     and exists (select 1 from privado.manual_leitura l where l.versao_id = v.id and l.usuario_id = p.id)),
                        'total', (select pg_catalog.count(*) from privado.trilha_item ti
                                  join privado.manual m on m.id = ti.manual_id and m.ativo where ti.trilha_id = t.id)) order by p.nome, p.id), '[]'::jsonb)
               from public.perfil p
               where p.ativo and exists (select 1 from public.usuario_papel up where up.usuario_id = p.id and up.papel = t.papel_alvo)) end)
           order by t.nome, t.id)
    from privado.trilha t
    where (t.ativa or v_gestao)
      and (v_gestao or exists (select 1 from public.usuario_papel up where up.usuario_id = auth.uid() and up.papel = t.papel_alvo))), '[]'::jsonb);
end;
$$;
comment on function api.trilhas_listar() is '[P51 item 2] Trilhas de treinamento do papel do usuário, com os manuais na ordem e o que ele já leu na versão atual. Coordenação e diretoria veem todas, com o andamento de cada pessoa do papel-alvo. Qualquer papel.';

create function api.trilha_salvar(trilha_id uuid, nome text, papel_alvo public.papel_usuario, ativa boolean, manual_ids uuid[])
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_nome text := pg_catalog.btrim(trilha_salvar.nome);
  v_id   uuid := trilha_salvar.trilha_id;
  v_ids  uuid[] := coalesce(trilha_salvar.manual_ids, '{}');
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if v_nome is null or pg_catalog.char_length(v_nome) not between 3 and 120 then
    perform privado.relacao_recusar('nome_invalido');
  end if;
  if trilha_salvar.papel_alvo is null then
    perform privado.relacao_recusar('papel_invalido');
  end if;
  if pg_catalog.cardinality(v_ids) <> (select pg_catalog.count(distinct x) from pg_catalog.unnest(v_ids) x)
     or (select pg_catalog.count(*) from privado.manual m where m.id = any (v_ids)) <> pg_catalog.cardinality(v_ids) then
    perform privado.relacao_recusar('manuais_invalidos', 'lista com manual repetido ou inexistente');
  end if;
  if v_id is null then
    insert into privado.trilha (nome, papel_alvo, ativa, criado_por)
    values (v_nome, trilha_salvar.papel_alvo, coalesce(trilha_salvar.ativa, true), auth.uid()) returning id into v_id;
  else
    update privado.trilha t set nome = v_nome, papel_alvo = trilha_salvar.papel_alvo, ativa = coalesce(trilha_salvar.ativa, t.ativa)
     where t.id = v_id;
    if not found then
      perform privado.relacao_recusar('trilha_inexistente');
    end if;
    delete from privado.trilha_item ti where ti.trilha_id = v_id;
  end if;
  insert into privado.trilha_item (trilha_id, manual_id, ordem)
  select v_id, x.manual, x.ordem from pg_catalog.unnest(v_ids) with ordinality as x(manual, ordem);
  return pg_catalog.jsonb_build_object('ok', true, 'trilha_id', v_id);
end;
$$;
comment on function api.trilha_salvar(uuid, text, public.papel_usuario, boolean, uuid[]) is '[P51 item 2] Cria ou edita uma trilha de treinamento (nome, papel-alvo, ativa) e a ordem dos manuais. Coordenação e diretoria, AAL2.';

-- --- Banco de talentos -----------------------------------------------------------

create type privado.estado_candidata as enum
  ('nova', 'em_triagem', 'entrevista_agendada', 'entrevistada', 'aprovada', 'banco_reserva', 'nao_seguiu', 'desistiu');

create table privado.candidata (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por    uuid references public.perfil(id),
  nome          text not null check (pg_catalog.char_length(nome) between 3 and 120),
  telefone_e164 text,
  email         text,
  cidade        text check (cidade is null or pg_catalog.char_length(cidade) <= 80),
  conselho      text check (conselho is null or pg_catalog.char_length(conselho) <= 60),
  apresentacao  text check (apresentacao is null or pg_catalog.char_length(apresentacao) <= 1500),
  origem        text not null default 'coordenacao' check (origem in ('coordenacao', 'pagina_publica', 'indicacao', 'outro')),
  estado        privado.estado_candidata not null default 'nova',
  observacoes   text check (observacoes is null or pg_catalog.char_length(observacoes) <= 2000),
  consentimento jsonb not null default '{}',
  check (telefone_e164 is not null or email is not null)
);
comment on table privado.candidata is '[P51 item 3] Candidata do banco de talentos (PRD 12): cadastro, origem, estado e observações. Só coordenação e diretoria, por api.talento_* (PRD 13: candidaturas). Nome, telefone, e-mail, cidade, conselho, apresentação e observações ficam ocultos no log. Eliminação a pedido: apagar a linha.';
create index on privado.candidata (estado, criado_em);
create index on privado.candidata (criado_por);
create trigger tocar_atualizado_em before update on privado.candidata
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.candidata
  for each row execute function privado.auditar('id');
alter table privado.candidata enable row level security;
revoke all on privado.candidata from public, anon, authenticated, service_role;

create table privado.candidata_avaliacao (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  candidata_id   uuid not null references privado.candidata(id) on delete cascade,
  avaliador_id   uuid not null references public.perfil(id),
  roteiro_versao text not null,
  respostas      jsonb not null default '{}',
  notas          jsonb not null default '{}',
  observacoes    text check (observacoes is null or pg_catalog.char_length(observacoes) <= 2000),
  criterios_avaliados integer not null default 0,
  media_notas    numeric(3,2),
  unique (candidata_id, avaliador_id)
);
comment on table privado.candidata_avaliacao is '[P51 item 3] Avaliação de uma candidata por uma avaliadora: respostas do roteiro de 26 perguntas, nota de 1 a 5 em cada um dos 10 critérios, observações e a média. Roteiro e escala vêm de parametro.talentos_roteiro, com a versão gravada aqui. Uma por candidata e avaliadora (salvar de novo atualiza).';
create index on privado.candidata_avaliacao (avaliador_id);
create trigger tocar_atualizado_em before update on privado.candidata_avaliacao
  for each row execute function privado.tocar_atualizado_em();
create trigger auditar after insert or update or delete on privado.candidata_avaliacao
  for each row execute function privado.auditar('id');
alter table privado.candidata_avaliacao enable row level security;
revoke all on privado.candidata_avaliacao from public, anon, authenticated, service_role;

create function api.talentos_roteiro() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  return coalesce(privado.venda_parametro('talentos_roteiro'), '{}'::jsonb);
end;
$$;
comment on function api.talentos_roteiro() is '[P51 item 3] Roteiro de seleção (perguntas em blocos, critérios e escala) de parametro.talentos_roteiro. Coordenação e diretoria, AAL2.';

create function api.talentos_listar(estado text default null) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_estado privado.estado_candidata;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if nullif(talentos_listar.estado, '') is not null then
    begin
      v_estado := talentos_listar.estado::privado.estado_candidata;
    exception when invalid_text_representation then
      perform privado.relacao_recusar('estado_invalido');
    end;
  end if;
  return pg_catalog.jsonb_build_object(
    'pagina_publica_ativa', coalesce((privado.venda_parametro('talentos_pagina_publica') ->> 'ativa')::boolean, false),
    'candidatas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'origem', c.origem, 'estado', c.estado::text, 'criado_em', c.criado_em,
               'avaliacoes', (select pg_catalog.count(*) from privado.candidata_avaliacao a where a.candidata_id = c.id),
               'media_geral', (select pg_catalog.round(pg_catalog.avg(a.media_notas), 2) from privado.candidata_avaliacao a where a.candidata_id = c.id))
             order by c.criado_em desc, c.id)
      from privado.candidata c where v_estado is null or c.estado = v_estado), '[]'::jsonb));
end;
$$;
comment on function api.talentos_listar(text) is '[P51 item 3] Candidatas (nome, cidade, origem, estado, avaliações e média) e se a página pública de candidatura está ligada. Coordenação e diretoria, AAL2.';

create function api.talento_obter(candidata_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c privado.candidata;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  select c.* into v_c from privado.candidata c where c.id = talento_obter.candidata_id;
  if not found then
    perform privado.relacao_recusar('candidata_inexistente');
  end if;
  perform privado.relacao_log('leitura', 'privado.candidata', v_c.id::text, null, null);
  return pg_catalog.jsonb_build_object(
    'id', v_c.id, 'nome', v_c.nome, 'telefone_e164', v_c.telefone_e164, 'email', v_c.email, 'cidade', v_c.cidade,
    'conselho', v_c.conselho, 'apresentacao', v_c.apresentacao, 'origem', v_c.origem, 'estado', v_c.estado::text,
    'observacoes', v_c.observacoes, 'criado_em', v_c.criado_em,
    'roteiro', coalesce(privado.venda_parametro('talentos_roteiro'), '{}'::jsonb),
    'avaliacoes', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', a.id, 'avaliador_id', a.avaliador_id, 'avaliador', p.nome, 'em', a.atualizado_em,
               'roteiro_versao', a.roteiro_versao, 'respostas', a.respostas, 'notas', a.notas, 'observacoes', a.observacoes,
               'criterios_avaliados', a.criterios_avaliados, 'media', a.media_notas) order by a.atualizado_em desc, a.id), '[]'::jsonb)
      from privado.candidata_avaliacao a left join public.perfil p on p.id = a.avaliador_id
      where a.candidata_id = v_c.id));
end;
$$;
comment on function api.talento_obter(uuid) is '[P51 item 3] Uma candidata com contato, observações, o roteiro e as avaliações. Grava a leitura no log. Coordenação e diretoria, AAL2.';

create function api.talento_salvar(
  candidata_id uuid,
  nome         text,
  telefone     text default null,
  email        text default null,
  cidade       text default null,
  conselho     text default null,
  apresentacao text default null,
  observacoes  text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_nome  text := pg_catalog.btrim(talento_salvar.nome);
  v_tel   text := privado.relacao_telefone(talento_salvar.telefone);
  v_email text := nullif(pg_catalog.btrim(talento_salvar.email), '');
  v_id    uuid := talento_salvar.candidata_id;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if v_nome is null or pg_catalog.char_length(v_nome) not between 3 and 120 then
    perform privado.relacao_recusar('nome_invalido');
  end if;
  if nullif(pg_catalog.btrim(talento_salvar.telefone), '') is not null and v_tel is null then
    perform privado.relacao_recusar('telefone_invalido');
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform privado.relacao_recusar('email_invalido');
  end if;
  if v_tel is null and v_email is null then
    perform privado.relacao_recusar('sem_contato', 'informe telefone ou e-mail');
  end if;
  if v_id is null then
    insert into privado.candidata (nome, telefone_e164, email, cidade, conselho, apresentacao, observacoes, origem, criado_por)
    values (v_nome, v_tel, v_email, nullif(pg_catalog.btrim(talento_salvar.cidade), ''), nullif(pg_catalog.btrim(talento_salvar.conselho), ''),
            nullif(pg_catalog.btrim(talento_salvar.apresentacao), ''), nullif(pg_catalog.btrim(talento_salvar.observacoes), ''),
            'coordenacao', auth.uid())
    returning id into v_id;
  else
    update privado.candidata c
       set nome = v_nome, telefone_e164 = v_tel, email = v_email, cidade = nullif(pg_catalog.btrim(talento_salvar.cidade), ''),
           conselho = nullif(pg_catalog.btrim(talento_salvar.conselho), ''),
           apresentacao = nullif(pg_catalog.btrim(talento_salvar.apresentacao), ''),
           observacoes = nullif(pg_catalog.btrim(talento_salvar.observacoes), '')
     where c.id = v_id;
    if not found then
      perform privado.relacao_recusar('candidata_inexistente');
    end if;
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'candidata_id', v_id);
end;
$$;
comment on function api.talento_salvar(uuid, text, text, text, text, text, text, text) is '[P51 item 3] Cadastra ou edita uma candidata (origem coordenação). Coordenação e diretoria, AAL2.';

create function api.talento_estado(candidata_id uuid, estado text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_novo privado.estado_candidata;
  v_c    privado.candidata;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  begin
    v_novo := talento_estado.estado::privado.estado_candidata;
  exception when invalid_text_representation then
    perform privado.relacao_recusar('estado_invalido');
  end;
  update privado.candidata c set estado = v_novo where c.id = talento_estado.candidata_id returning c.* into v_c;
  if not found then
    perform privado.relacao_recusar('candidata_inexistente');
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'estado', v_c.estado::text);
end;
$$;
comment on function api.talento_estado(uuid, text) is '[P51 item 3] Muda o estado da candidata (nova, em triagem, entrevista agendada, entrevistada, aprovada, banco de reserva, não seguiu, desistiu). Coordenação e diretoria, AAL2.';

create function api.talento_avaliar(candidata_id uuid, respostas jsonb, notas jsonb, observacoes text default null)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_roteiro   jsonb := coalesce(privado.venda_parametro('talentos_roteiro'), '{}'::jsonb);
  v_min       integer := coalesce((v_roteiro #>> '{escala,min}')::integer, 1);
  v_max       integer := coalesce((v_roteiro #>> '{escala,max}')::integer, 5);
  v_crit_ids  text[];
  v_perg_ids  text[];
  v_resp      jsonb := coalesce(talento_avaliar.respostas, '{}'::jsonb);
  v_notas     jsonb := coalesce(talento_avaliar.notas, '{}'::jsonb);
  v_chave     text;
  v_valor     jsonb;
  v_n         integer;
  v_soma      numeric := 0;
  v_qtd       integer := 0;
  v_id        uuid;
begin
  perform privado.autorizar(array['coordenacao', 'diretoria']::public.papel_usuario[], true);
  if not exists (select 1 from privado.candidata c where c.id = talento_avaliar.candidata_id) then
    perform privado.relacao_recusar('candidata_inexistente');
  end if;
  select pg_catalog.array_agg(c ->> 'id') into v_crit_ids from pg_catalog.jsonb_array_elements(coalesce(v_roteiro -> 'criterios', '[]'::jsonb)) c;
  select pg_catalog.array_agg(p ->> 'id') into v_perg_ids
  from pg_catalog.jsonb_array_elements(coalesce(v_roteiro -> 'blocos', '[]'::jsonb)) b,
       pg_catalog.jsonb_array_elements(coalesce(b -> 'perguntas', '[]'::jsonb)) p;
  if v_crit_ids is null or v_perg_ids is null then
    perform privado.relacao_recusar('roteiro_ausente', 'o roteiro de seleção não está configurado');
  end if;
  if pg_catalog.jsonb_typeof(v_resp) <> 'object' or pg_catalog.jsonb_typeof(v_notas) <> 'object' then
    perform privado.relacao_recusar('avaliacao_invalida');
  end if;

  for v_chave, v_valor in select * from pg_catalog.jsonb_each(v_notas) loop
    if not (v_chave = any (v_crit_ids)) then
      perform privado.relacao_recusar('criterio_invalido');
    end if;
    if pg_catalog.jsonb_typeof(v_valor) <> 'number' or (v_valor #>> '{}') !~ '^[0-9]+$' then
      perform privado.relacao_recusar('nota_invalida', 'a nota é um número inteiro dentro da escala');
    end if;
    v_n := (v_valor #>> '{}')::integer;
    if v_n < v_min or v_n > v_max then
      perform privado.relacao_recusar('nota_invalida', 'a nota fica entre ' || v_min || ' e ' || v_max);
    end if;
    v_soma := v_soma + v_n;
    v_qtd := v_qtd + 1;
  end loop;
  for v_chave, v_valor in select * from pg_catalog.jsonb_each(v_resp) loop
    if not (v_chave = any (v_perg_ids)) then
      perform privado.relacao_recusar('pergunta_invalida');
    end if;
    if pg_catalog.jsonb_typeof(v_valor) <> 'string' or pg_catalog.char_length(v_valor #>> '{}') > 2000 then
      perform privado.relacao_recusar('resposta_invalida', 'texto de até 2000 caracteres');
    end if;
  end loop;

  insert into privado.candidata_avaliacao (candidata_id, avaliador_id, roteiro_versao, respostas, notas, observacoes, criterios_avaliados, media_notas)
  values (talento_avaliar.candidata_id, auth.uid(), coalesce(v_roteiro ->> 'versao', 'sem versão'), v_resp, v_notas,
          nullif(pg_catalog.btrim(talento_avaliar.observacoes), ''), v_qtd,
          case when v_qtd > 0 then pg_catalog.round(v_soma / v_qtd, 2) end)
  on conflict (candidata_id, avaliador_id) do update
    set roteiro_versao = excluded.roteiro_versao, respostas = excluded.respostas, notas = excluded.notas,
        observacoes = excluded.observacoes, criterios_avaliados = excluded.criterios_avaliados, media_notas = excluded.media_notas
  returning id into v_id;
  return pg_catalog.jsonb_build_object('ok', true, 'avaliacao_id', v_id, 'criterios_avaliados', v_qtd,
    'criterios_total', pg_catalog.cardinality(v_crit_ids), 'completa', v_qtd = pg_catalog.cardinality(v_crit_ids),
    'media', case when v_qtd > 0 then pg_catalog.round(v_soma / v_qtd, 2) end);
end;
$$;
comment on function api.talento_avaliar(uuid, jsonb, jsonb, text) is '[P51 item 3] Registra a avaliação de uma candidata: respostas às perguntas do roteiro (por id), nota inteira de 1 a 5 em cada critério (por id; a escala e os ids vêm de parametro.talentos_roteiro) e observações. Calcula a média. Uma avaliação por avaliadora e candidata. Coordenação e diretoria, AAL2.';

-- Página pública de candidatura: existe, mas nasce desligada (o onboarding
-- pediu para não abrir agora; PRD 12). Ligar é mudar parametro.talentos_pagina_publica.
create function public.candidatura_abrir() returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_ativa boolean := coalesce((privado.venda_parametro('talentos_pagina_publica') ->> 'ativa')::boolean, false);
begin
  return pg_catalog.jsonb_build_object(
    'situacao', case when v_ativa then 'ok' else 'desligada' end,
    'termo_versao', privado.venda_parametro('talentos_pagina_publica') ->> 'termo_versao',
    'textos', privado.textos_site('candidatura_'));
end;
$$;
comment on function public.candidatura_abrir() is '[P51 item 3] Estado da página pública de candidatura: desligada (padrão) ou ok, com os textos candidatura_*. Só o servidor do app (service_role).';

create function public.candidatura_enviar(dados jsonb, origem text default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_cfg    jsonb := coalesce(privado.venda_parametro('talentos_pagina_publica'), '{}'::jsonb);
  v_nome   text := pg_catalog.btrim(candidatura_enviar.dados ->> 'nome');
  v_tel    text := privado.relacao_telefone(candidatura_enviar.dados ->> 'telefone');
  v_email  text := nullif(pg_catalog.btrim(candidatura_enviar.dados ->> 'email'), '');
  v_cidade text := nullif(pg_catalog.btrim(candidatura_enviar.dados ->> 'cidade'), '');
  v_cons   text := nullif(pg_catalog.btrim(candidatura_enviar.dados ->> 'conselho'), '');
  v_apres  text := nullif(pg_catalog.btrim(candidatura_enviar.dados ->> 'apresentacao'), '');
  v_erros  jsonb := '{}'::jsonb;
begin
  if not coalesce((v_cfg ->> 'ativa')::boolean, false) then
    return pg_catalog.jsonb_build_object('situacao', 'desligada');
  end if;
  if privado.relacao_limite('candidatura', candidatura_enviar.origem,
       (v_cfg ->> 'tentativas_max')::integer, (v_cfg ->> 'janela_minutos')::integer, true) then
    return pg_catalog.jsonb_build_object('situacao', 'limite', 'minutos', (v_cfg ->> 'janela_minutos')::integer);
  end if;
  if candidatura_enviar.dados is null or pg_catalog.jsonb_typeof(candidatura_enviar.dados) <> 'object' then
    return pg_catalog.jsonb_build_object('situacao', 'corrigir', 'erros', '{"nome":"obrigatorio"}'::jsonb);
  end if;

  if v_nome is null or pg_catalog.char_length(v_nome) not between 3 and 120 then
    v_erros := v_erros || '{"nome":"invalido"}'::jsonb;
  end if;
  if nullif(pg_catalog.btrim(candidatura_enviar.dados ->> 'telefone'), '') is not null and v_tel is null then
    v_erros := v_erros || '{"telefone":"invalido"}'::jsonb;
  end if;
  if v_email is not null and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or pg_catalog.char_length(v_email) > 200) then
    v_erros := v_erros || '{"email":"invalido"}'::jsonb;
  end if;
  if v_tel is null and v_email is null then
    v_erros := v_erros || '{"contato":"obrigatorio"}'::jsonb;
  end if;
  if v_cidade is not null and pg_catalog.char_length(v_cidade) > 80 then
    v_erros := v_erros || '{"cidade":"muito_longo"}'::jsonb;
  end if;
  if v_cons is not null and pg_catalog.char_length(v_cons) > 60 then
    v_erros := v_erros || '{"conselho":"muito_longo"}'::jsonb;
  end if;
  if v_apres is not null and pg_catalog.char_length(v_apres) > 1500 then
    v_erros := v_erros || '{"apresentacao":"muito_longo"}'::jsonb;
  end if;
  if (candidatura_enviar.dados #>> '{consentimento,aceito}') is distinct from 'true'
     or (candidatura_enviar.dados #>> '{consentimento,versao}') is distinct from (v_cfg ->> 'termo_versao') then
    v_erros := v_erros || '{"consentimento":"obrigatorio"}'::jsonb;
  end if;
  if v_erros <> '{}'::jsonb then
    return pg_catalog.jsonb_build_object('situacao', 'corrigir', 'erros', v_erros);
  end if;

  -- Mesma pessoa enviando de novo: recebido, sem duplicar (a resposta é a mesma).
  if not exists (select 1 from privado.candidata c
                 where (v_tel is not null and c.telefone_e164 = v_tel) or (v_email is not null and pg_catalog.lower(c.email) = pg_catalog.lower(v_email))) then
    insert into privado.candidata (nome, telefone_e164, email, cidade, conselho, apresentacao, origem, consentimento)
    values (v_nome, v_tel, v_email, v_cidade, v_cons, v_apres, 'pagina_publica',
            pg_catalog.jsonb_build_object('lgpd_talentos', pg_catalog.jsonb_build_object(
              'aceito', true, 'versao', v_cfg ->> 'termo_versao', 'em', pg_catalog.now(), 'canal', 'pagina_publica')));
    insert into public.notificacao (papel, prioridade, titulo, link)
    values ('coordenacao', 'normal', 'Nova candidatura no banco de talentos', '/talentos');
  end if;
  return pg_catalog.jsonb_build_object('situacao', 'recebido');
end;
$$;
comment on function public.candidatura_enviar(jsonb, text) is '[P51 item 3] Recebe a candidatura da página pública: só com a página ligada (parametro.talentos_pagina_publica.ativa, desligada por padrão), com limite por origem, validação e consentimento na versão do termo. Repetida (mesmo telefone ou e-mail) responde recebido sem duplicar. Avisa a coordenação sem nome. Só o servidor do app (service_role).';


-- =============================================================================
-- 7. Concessões e trava
--
-- api: execute só para authenticated (nunca public, anon nem service_role).
-- public (páginas abertas): execute só para service_role (o servidor do app,
-- depois do Turnstile). privado: nenhuma concessão. As tabelas novas não têm
-- concessão nenhuma.
-- =============================================================================

do $$
declare
  v_f record;
begin
  for v_f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api'
      and p.proname = any (array[
        'marketing_canais', 'marketing_canal_salvar', 'marketing_custo_salvar', 'marketing_relatorio', 'marketing_exportar',
        'copiloto_config', 'copiloto_registrar', 'copiloto_historico', 'copiloto_pipeline', 'copiloto_conversao',
        'copiloto_receita', 'copiloto_ocupacao', 'copiloto_leads_origem',
        'portal_familia', 'portal_familia_acessos', 'portal_familia_liberar', 'portal_familia_suspender',
        'profissionais_portal', 'profissional_portal_salvar',
        'parceiros_listar', 'parceiro_salvar', 'parceiro_contato_registrar', 'parceiro_tarefa_criar',
        'indicacao_registrar', 'indicacoes_relatorio',
        'tarefas_por_equipe', 'manuais_listar', 'manual_obter', 'manual_salvar', 'manual_confirmar_leitura',
        'manual_leituras', 'trilhas_listar', 'trilha_salvar',
        'talentos_roteiro', 'talentos_listar', 'talento_obter', 'talento_salvar', 'talento_estado', 'talento_avaliar'])
  loop
    execute format('revoke execute on function %s from public, anon, service_role', v_f.assinatura);
    execute format('grant execute on function %s to authenticated', v_f.assinatura);
  end loop;

  for v_f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'captacao_pagina', 'captacao_iniciar', 'portal_familia_localizar', 'portal_familia_vincular',
        'portal_familia_pagina', 'candidatura_abrir', 'candidatura_enviar'])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_f.assinatura);
    execute format('grant execute on function %s to service_role', v_f.assinatura);
  end loop;

  for v_f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'privado'
      and p.proname = any (array[
        'relacao_recusar', 'relacao_log', 'relacao_limite', 'relacao_primeiro_nome', 'relacao_telefone',
        'captacao_ler_codigo', 'captacao_aplicar', 'captacao_registrar_na_conversa', 'captacao_gatilho_conversa',
        'captacao_utm', 'captacao_token', 'textos_site', 'portal_acesso',
        'parceiro_so_sem_familia', 'manual_versao_imutavel', 'manual_visivel'])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', v_f.assinatura);
  end loop;
end $$;


-- =============================================================================
-- 8. Trava (falha a migration se quebrar): mesma regra de 0022 para api; em
--    privado, só as quatro do PRD 11.10 são executáveis pelo app; as páginas
--    abertas só pelo service_role; nenhuma tabela nova com concessão.
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

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('captacao_pagina', 'captacao_iniciar', 'portal_familia_localizar', 'portal_familia_vincular',
                      'portal_familia_pagina', 'candidatura_abrir', 'candidatura_enviar')
    and (not p.prosecdef
         or not coalesce(p.proconfig @> array['search_path=""'], false)
         or not has_function_privilege('service_role', p.oid, 'execute')
         or has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função pública de página aberta fora da regra (security definer, search_path vazio, só service_role): %', v_lista;
  end if;

  select string_agg(c.oid::regclass::text, ', ')
    into v_lista
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'privado' and c.relkind = 'r'
    and c.relname in ('limite_publico', 'canal_captacao', 'captacao_visita', 'conversa_origem', 'custo_canal',
                      'copiloto_pergunta', 'acesso_familia', 'profissional_portal', 'parceiro_medico', 'indicacao',
                      'manual', 'manual_versao', 'manual_leitura', 'trilha', 'trilha_item', 'candidata', 'candidata_avaliacao')
    and (not c.relrowsecurity
         or has_table_privilege('anon', c.oid, 'select,insert,update,delete')
         or has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')
         or has_table_privilege('service_role', c.oid, 'select,insert,update,delete'));
  if v_lista is not null then
    raise exception 'tabela nova de privado sem RLS ou com concessão: %', v_lista;
  end if;
end $$;
