-- =============================================================================
-- 0015_crm_apoio.sql
--
-- Integração da trilha de banco com o CRM · PRD 5.2, 7, 8.3, 13, 21.2 ·
-- ADR docs/adr/0002-permissoes.md (seções 5 e 6) · pendências de banco de
-- docs/sessoes/P07-app.md e docs/sessoes/CRM-integracao.md
--
-- Três funções que as telas do CRM já chamam (hoje por rpcPendente, que
-- devolve "funcao_pendente" enquanto a função não existe):
--
--   1. api.revogar_sessoes(usuario_id): tela de sessões da diretoria (P07
--      item 7, PRD 13 "a diretoria pode revogar sessões de um usuário" e
--      21.2 "controle de sessão e revogação remota"). Apaga as linhas de
--      auth.sessions do usuário, o que derruba o refresh token de todos os
--      aparelhos (auth.refresh_tokens cai em cascata). Só diretoria, sempre
--      em AAL2, e grava log_auditoria.
--   2. api.transicoes_permitidas(maquina, de): menu "Mover para" do
--      pipeline (P15, PRD 7 "só aparecem as transições permitidas"). Lê
--      privado.transicao_permitida, que o app não enxerga, e diz para cada
--      destino se o papel de quem pede passaria na conferência de
--      privado.transicionar. Não substitui a conferência: quem barra de
--      verdade continua sendo privado.transicionar (invariante 1).
--   3. api.parametros_da_tela(chaves): leitura de parâmetros operacionais
--      que telas do comercial e da coordenação mostram, por uma lista
--      fechada de chaves com os papéis de cada uma. A tabela parametro
--      continua só da diretoria (PRD 13, "Parâmetros e configurações").
--
-- Leitura mais segura adotada onde o PRD deixa margem (registrada no
-- relatório da sessão e no ADR 0002):
--   * A lista de chaves legíveis mora nesta função, não em parametro: ela é
--     uma fronteira de permissão, e mudar fronteira de permissão é
--     migration nova revisada por humano (mesma regra de
--     privado.transicao_permitida), não um valor que a tela de
--     configurações altera.
--   * plantao_telefones (telefone pessoal de quem está de plantão),
--     agente_whitelist (telefones de teste), agente_modo e qualquer chave
--     com texto, preço ou lista de termos ficam fora da lista.
--   * Chave pedida fora da lista, ou fora dos papéis de quem pede, é
--     recusada com 42501, em vez de sumir em silêncio: a tela sabe que
--     pediu o que não podia.
--   * transicoes_permitidas exige os mesmos papéis e o mesmo AAL que
--     api.transicionar exige para aquela máquina: quem não pode mover não
--     precisa do mapa.
--   * revogar_sessoes exige AAL2 mesmo que o perfil não exigisse, e não
--     aceita usuário inexistente (P0002), para o log nunca registrar uma
--     revogação que não aconteceu.
--
-- Nada de assistencial, de contrato ou de agente passa por aqui. Execute só
-- para authenticated; anon e service_role sem nada.
-- =============================================================================


-- =============================================================================
-- 1. api.revogar_sessoes(usuario_id)
--
-- Por que no banco: o supabase-js não tem método de administração que
-- encerre as sessões de outra pessoa pelo id (auth.admin.signOut pede o JWT
-- da própria pessoa). Apagar auth.sessions é o que o próprio GoTrue faz no
-- logout global. O access token já emitido continua válido até expirar
-- (jwt_expiry do Supabase Auth), o que fica escrito na tela e no LIGAR.md.
--
-- No Supabase real, auth.sessions pertence a supabase_auth_admin e o papel
-- postgres (dono desta função) tem delete nela. Se um projeto novo mudar
-- esse privilégio, a função falha com 42501 e a tela mostra o erro, sem
-- revogar pela metade (tudo numa transação). Conferência em
-- supabase/LIGAR.md.
-- =============================================================================

create function api.revogar_sessoes(usuario_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_sessoes integer := 0;
  v_tokens  integer := 0;
begin
  -- só diretoria, e sempre em AAL2 (segundo parâmetro true)
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);

  if revogar_sessoes.usuario_id is null then
    raise exception 'api.revogar_sessoes: usuario_id é obrigatório'
      using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = revogar_sessoes.usuario_id) then
    raise exception 'api.revogar_sessoes: usuário % não existe', revogar_sessoes.usuario_id
      using errcode = 'P0002';
  end if;

  -- refresh tokens de sessões antigas sem session_id (formato anterior do
  -- GoTrue) não caem pela cascata: apaga pelo user_id, que ali é texto.
  delete from auth.refresh_tokens r
   where r.user_id = revogar_sessoes.usuario_id::text
     and r.session_id is null;
  get diagnostics v_tokens = row_count;

  -- apagar a sessão derruba os refresh tokens dela (on delete cascade)
  delete from auth.sessions s
   where s.user_id = revogar_sessoes.usuario_id;
  get diagnostics v_sessoes = row_count;

  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  -- log: só ids e contagens, nada pessoal
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (auth.uid(), 'revogar_sessoes', 'perfil', revogar_sessoes.usuario_id::text, null,
          pg_catalog.jsonb_build_object('sessoes_revogadas', v_sessoes,
                                        'refresh_tokens_avulsos', v_tokens),
          privado.origem_atual(), privado.ip_requisicao());

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'usuario_id', revogar_sessoes.usuario_id,
    'sessoes_revogadas', v_sessoes
  );
end;
$$;
comment on function api.revogar_sessoes(uuid) is 'Tela de sessões da diretoria (PRD 13, 21.2; P07 item 7): apaga auth.sessions do usuário (refresh tokens caem em cascata) e grava log_auditoria (acao revogar_sessoes, só contagens). Só diretoria em AAL2. Usuário inexistente: P0002. O access token já emitido vale até expirar.';


-- =============================================================================
-- 2. api.transicoes_permitidas(maquina, de)
--
-- Devolve as linhas de privado.transicao_permitida da máquina (e do estado
-- de origem, quando informado) como origem, destino, automatica e
-- papel_minimo (as colunas de saída não repetem os nomes dos parâmetros
-- maquina e de, o que o Postgres recusa), com a coluna "pode": verdadeiro quando o
-- papel de quem pede passaria na conferência de papel de
-- privado.transicionar (0006, passo 3):
--   papel_minimo nulo: qualquer perfil ativo com papel (já garantido por
--     privado.autorizar);
--   senão: o próprio papel, ou diretoria (menos saindo de intercorrencia,
--     PRD 7.2), ou coordenação quando o mínimo é enfermeira (PRD 13).
-- As conferências que dependem da entidade (a pausa só volta para o estado
-- anterior; a enfermeira só move a própria visita) continuam só em
-- privado.transicionar e api.transicionar, na hora de mover.
--
-- Papéis e AAL por máquina: os mesmos de api.transicionar (0007).
-- =============================================================================

create function api.transicoes_permitidas(maquina text, de text default null)
  returns table (
    origem       text,
    destino      text,
    automatica   boolean,
    papel_minimo public.papel_usuario,
    pode         boolean
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_maquina privado.maquina_estado;
begin
  begin
    v_maquina := transicoes_permitidas.maquina::privado.maquina_estado;
  exception
    when invalid_text_representation then
      raise exception 'api.transicoes_permitidas: máquina desconhecida: %', transicoes_permitidas.maquina
        using errcode = '22023';
  end;
  if v_maquina is null then
    raise exception 'api.transicoes_permitidas: maquina é obrigatória'
      using errcode = '22023';
  end if;

  -- mesma regra de api.transicionar para a máquina
  case v_maquina
    when 'p1' then
      perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);
    when 'p2' then
      perform privado.autorizar(array['comercial', 'financeiro', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
    when 'p4' then
      perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
    else
      perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  end case;

  return query
    select t.de,
           t.para,
           t.automatica,
           t.papel_minimo,
           case
             when t.papel_minimo is null then true
             else privado.tem_papel(t.papel_minimo)
                  or (t.de <> 'intercorrencia' and privado.tem_papel('diretoria'))
                  or (t.papel_minimo = 'enfermeira' and privado.tem_papel('coordenacao'))
           end
      from privado.transicao_permitida t
     where t.maquina = v_maquina
       and (transicoes_permitidas.de is null or t.de = transicoes_permitidas.de)
     order by t.de, t.para;
end;
$$;
comment on function api.transicoes_permitidas(text, text) is 'Menu "Mover para" (P15, PRD 7): transições previstas da máquina (e do estado de origem, se informado), em origem, destino, automatica e papel_minimo, com "pode" = o papel de quem pede passaria na conferência de papel de privado.transicionar. Mesmos papéis e AAL de api.transicionar. Não substitui a conferência na hora de mover.';


-- =============================================================================
-- 3. api.parametros_da_tela(chaves)
--
-- Lista fechada: cada chave com os papéis que a leem. Só valores
-- operacionais (tempo e interruptor) que a própria tela precisa para
-- funcionar; nenhum preço, texto, telefone ou lista de termos.
--   freio_desfazer_segundos   prazo do "Desfazer" do freio (PRD 8.3): todo
--                             papel que aciona o freio (privado.
--                             tem_acesso_familia: comercial, enfermeira,
--                             financeiro, coordenação, diretoria)
--   comercial_resposta_no_app se a conversa mostra "Enviar pelo app" (P27):
--                             comercial, coordenação, diretoria (conversas,
--                             PRD 13)
--   agente_pausa_humano_horas horas de pausa ao assumir (PRD 11.3): idem
--   agente_followup_horas     janela de retomada da Isadora (PRD 11.3): idem
--
-- chaves nulo: todas as chaves da lista que o papel de quem pede lê.
-- Chave fora da lista ou fora do papel: 42501. Chave da lista que ainda não
-- existe em parametro: não volta linha (a tela trata como "sem valor", sem
-- inventar número).
-- =============================================================================

create function api.parametros_da_tela(chaves text[] default null)
  returns table (
    chave         text,
    valor         jsonb,
    atualizado_em timestamptz
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_permitidas text[];
  v_recusadas  text;
begin
  -- perfil ativo com algum papel (e AAL2 quando o perfil exige MFA)
  perform privado.autorizar(
    array['comercial', 'enfermeira', 'financeiro', 'marketing', 'coordenacao', 'diretoria']::public.papel_usuario[],
    false);

  select coalesce(pg_catalog.array_agg(l.chave), array[]::text[])
    into v_permitidas
  from (values
          ('freio_desfazer_segundos',
           array['comercial', 'enfermeira', 'financeiro', 'coordenacao', 'diretoria']::public.papel_usuario[]),
          ('comercial_resposta_no_app',
           array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[]),
          ('agente_pausa_humano_horas',
           array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[]),
          ('agente_followup_horas',
           array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[])
       ) as l(chave, papeis)
  where exists (select 1 from pg_catalog.unnest(l.papeis) as p(papel) where privado.tem_papel(p.papel));

  if parametros_da_tela.chaves is not null then
    select pg_catalog.string_agg(coalesce(c.chave, 'nulo'), ', ')
      into v_recusadas
    from pg_catalog.unnest(parametros_da_tela.chaves) as c(chave)
    where c.chave is null or not (c.chave = any (v_permitidas));

    if v_recusadas is not null then
      raise exception 'api.parametros_da_tela: chave fora da lista do papel: % (PRD 13)', v_recusadas
        using errcode = '42501';
    end if;
  end if;

  return query
    select p.chave, p.valor, p.atualizado_em
      from public.parametro p
     where p.chave = any (v_permitidas)
       and (parametros_da_tela.chaves is null or p.chave = any (parametros_da_tela.chaves))
     order by p.chave;
end;
$$;
comment on function api.parametros_da_tela(text[]) is 'Parâmetros operacionais que as telas do comercial e da coordenação mostram (freio_desfazer_segundos, comercial_resposta_no_app, agente_pausa_humano_horas, agente_followup_horas), por lista fechada com papéis por chave. Chave fora da lista ou do papel: 42501. A tabela parametro continua só da diretoria (PRD 13).';


-- =============================================================================
-- 4. Execute: só authenticated (ADR 0002 seção 6)
-- =============================================================================

revoke execute on function api.revogar_sessoes(uuid)             from public, anon, service_role;
revoke execute on function api.transicoes_permitidas(text, text) from public, anon, service_role;
revoke execute on function api.parametros_da_tela(text[])        from public, anon, service_role;

grant execute on function api.revogar_sessoes(uuid)             to authenticated;
grant execute on function api.transicoes_permitidas(text, text) to authenticated;
grant execute on function api.parametros_da_tela(text[])        to authenticated;


-- =============================================================================
-- 5. Trava de integração da trilha de banco (falha a migration se quebrar)
--
-- Repete, sobre o banco inteiro depois da última migration da trilha, as
-- regras que valem para todo arquivo: RLS em toda tabela, security definer
-- sempre com search_path vazio, nenhum execute para PUBLIC nem para anon
-- nos schemas do projeto, nenhum privilégio de anon em tabela, e nenhuma
-- função do schema agente ao alcance de authenticated ou service_role.
-- =============================================================================

do $$
declare
  v_lista text;
begin
  select string_agg(n.nspname || '.' || c.relname, ', ')
    into v_lista
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
    and not c.relrowsecurity;
  if v_lista is not null then
    raise exception 'tabela sem RLS: %', v_lista;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
    and p.prosecdef
    and not coalesce(p.proconfig @> array['search_path=""'], false);
  if v_lista is not null then
    raise exception 'security definer sem search_path vazio: %', v_lista;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
    and (p.proacl is null
         or exists (select 1 from pg_catalog.aclexplode(p.proacl) a
                    where a.grantee = 0 and a.privilege_type = 'EXECUTE')
         or has_function_privilege('anon', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função executável por PUBLIC ou anon: %', v_lista;
  end if;

  select string_agg(n.nspname || '.' || c.relname, ', ')
    into v_lista
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm', 'S')
    and n.nspname in ('public', 'privado', 'assistencial', 'agente', 'agente_n8n', 'api')
    and case
          when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'usage, select, update')
          else has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
        end;
  if v_lista is not null then
    raise exception 'anon tem privilégio em: %', v_lista;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'agente'
    and (has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('service_role', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função de agente ao alcance de authenticated ou service_role: %', v_lista;
  end if;

  if has_schema_privilege('authenticated', 'agente', 'usage')
     or has_schema_privilege('authenticated', 'agente_n8n', 'usage')
     or has_schema_privilege('authenticated', 'assistencial', 'usage') then
    raise exception 'authenticated com usage em agente, agente_n8n ou assistencial';
  end if;
end $$;
