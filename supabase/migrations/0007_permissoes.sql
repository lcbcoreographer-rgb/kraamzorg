-- =============================================================================
-- 0007_permissoes.sql
--
-- P07 (PROMPTS.md v2), parte só de banco · PRD 5.2, 6.9, 6.10 (regras 6 e
-- 11), 11.10, 13, 21.2, 22.4 (O-05, O-08) · ADR docs/adr/0002-permissoes.md
--
-- Permissões por RLS (invariante 2). A matriz tabela por tabela, a regra de
-- MFA e a lista de funções executáveis moram no ADR 0002; este arquivo é a
-- tradução dele em SQL, na mesma ordem. Mudança de regra: ADR primeiro,
-- migration nova depois.
--
-- O que esta migration faz:
--   1. Revoga os grants padrão do Supabase para anon e authenticated em
--      public (tabelas, sequências, views e funções, inclusive os default
--      privileges de objetos futuros) e fecha os demais schemas (PRD 11.10).
--   2. Schemas: authenticated recebe usage em privado (funções das
--      políticas) e em api (a única porta de RPC do app, PRD 5.2).
--   3. privado.aal2() e privado.familias_atribuidas(); execute para
--      authenticated só nas quatro funções de privado do PRD 11.10.
--   4. perfil criado a partir de auth.users (convite da diretoria).
--   5. Grants e políticas de RLS de cada tabela, conforme o ADR 0002, com
--      duas políticas restritivas de MFA (perfil com MFA e AAL2 para todos),
--      e o gatilho que carimba criado_por com o usuário logado.
--   6. privado.status_profissional (PRD 6.5, O-08).
--   7. Schema api: os wrappers security definer que conferem papel e AAL.
--   8. Travas de revisão: RLS ligada em toda tabela e nenhuma função
--      executável por anon.
--
-- Fora de escopo (PROMPTS.md P07, parte de interface): telas de login, MFA,
-- convite e sessões, middleware de AAL2 e usuários de teste do seed (P08).
--
-- Convenção das políticas: todas "to authenticated"; anon não tem política
-- nenhuma (e nenhum grant). Chamadas a funções dentro de política vão entre
-- parênteses com select, "(select privado.tem_papel('comercial'))", para o
-- Postgres calcular uma vez por consulta e não uma vez por linha.
-- =============================================================================


-- =============================================================================
-- 1. Revogação dos grants padrão do Supabase (PRD 11.10 [v4.2], P07 item 9)
--
-- Um projeto Supabase novo dá "all" em toda tabela, sequência e função de
-- public para anon e authenticated, inclusive por default privileges para
-- objetos futuros (supabase/sem-docker/camada-supabase.sql, seção 3). Com
-- isso, a RLS é a única barreira. Aqui o padrão vira o contrário: nada para
-- anon, e para authenticated só o que a seção 5 concede, tabela por tabela.
-- service_role mantém o padrão do Supabase: roda só no servidor (CLAUDE.md)
-- e os gatilhos de append-only, auditoria e estágio valem para ele também.
-- Tudo idempotente (revoke de algo que não existe não falha).
-- =============================================================================

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Objetos futuros de public nascem fechados para os dois papéis. A linha de
-- functions repete a da 0001 de propósito: o P07 item 9 pede a migration
-- idempotente com ela escrita.
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- Demais schemas do projeto: nenhum grant existe hoje; as linhas abaixo são
-- defensivas e deixam a regra escrita para a revisão.
revoke all on all tables    in schema agente, agente_n8n, privado from anon, authenticated;
revoke all on all sequences in schema agente, agente_n8n, privado from anon, authenticated;
revoke all on all functions in schema privado, assistencial, agente, api from public, anon, authenticated;
revoke all on schema privado, assistencial, agente, agente_n8n, api from anon;
revoke all on schema assistencial, agente, agente_n8n from authenticated;


-- =============================================================================
-- 2. Schemas que authenticated usa
--
-- privado: as políticas chamam privado.tem_papel, privado.aal2 e
--   privado.familias_atribuidas, e o índice único de cidade calcula
--   privado.sem_acento no insert (PRD 11.10). usage em schema não dá acesso
--   a tabela nenhuma: as tabelas de privado continuam sem grant.
-- api: única porta de RPC do app além de public (PRD 5.2).
-- assistencial, agente e agente_n8n ficam sem usage: o app chega ao dado
-- assistencial só pelos wrappers de api (security definer).
-- =============================================================================

grant usage on schema privado to authenticated;
grant usage on schema api     to authenticated;


-- =============================================================================
-- 3. Funções auxiliares das políticas (PRD 13 [v4.2], P07 item 2)
-- =============================================================================

-- --- privado.aal2() -----------------------------------------------------------
-- Verdadeiro quando a sessão passou pelo desafio do MFA. O nível vive só no
-- claim "aal" do JWT, nunca numa tabela (PRD 13: "(auth.jwt() ->> 'aal') =
-- 'aal2'"). Não precisa de security definer: só lê o JWT.
create function privado.aal2() returns boolean
  language sql
  stable
  set search_path = ''
  as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;
comment on function privado.aal2() is 'Verdadeiro se o JWT da sessão traz aal = aal2 (MFA feito). PRD 13, ADR 0002 seção 2.';

-- --- privado.familias_atribuidas() ----------------------------------------------
-- Famílias que a profissional logada pode ler (PRD 13 [v4.2]):
--   * designação com status 'aceita' (titular ou backup) da profissional cujo
--     usuario_id é auth.uid();
--   * profissional.ativa e perfil.ativo (desativar corta o acesso na hora);
--   * acompanhamento ainda não terminado, ou terminado há no máximo
--     parametro.acesso_enfermeira_pos_encerramento_dias dias, contados em
--     dias corridos no fuso da operação.
-- "Terminado" inclui as duas interrupções, não só 'encerrado' (leitura mais
-- restritiva, ADR 0002). A data do término é acompanhamento.encerramento;
-- sem ela, a data da transição para o estado final na linha do tempo. Sem
-- nenhuma das duas, não há acesso depois do término.
-- Parâmetro ausente, não numérico ou negativo vale 0: nenhum prazo fixo no
-- SQL, e na dúvida o acesso fecha.
-- security definer: lê designacao, acompanhamento, profissional e perfil
-- sem passar pela RLS delas, que por sua vez chamam esta função (recursão).
create function privado.familias_atribuidas() returns setof uuid
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  with prazo as (
    select coalesce(
             (select case when pg_catalog.jsonb_typeof(p.valor) = 'number'
                          then greatest(0, pg_catalog.floor((p.valor #>> '{}')::numeric))::integer
                     end
                from public.parametro p
               where p.chave = 'acesso_enfermeira_pos_encerramento_dias'),
             0) as dias
  ),
  hoje as (
    select (pg_catalog.now() at time zone 'America/Sao_Paulo')::date as dia
  )
  select distinct a.familia_id
  from public.profissional pr
  join public.perfil pf       on pf.id = pr.usuario_id and pf.ativo
  join public.designacao d    on d.profissional_id = pr.id and d.status = 'aceita'
  join public.acompanhamento a on a.id = d.acompanhamento_id
  cross join prazo
  cross join hoje
  where pr.usuario_id = auth.uid()
    and pr.ativa
    and (
      a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico')
      or coalesce(
           a.encerramento,
           (select max((e.criado_em at time zone 'America/Sao_Paulo')::date)
              from public.evento_familia e
             where e.familia_id = a.familia_id
               and e.tipo = 'estagio'
               and e.dados ->> 'maquina' = 'acompanhamento'
               and e.dados ->> 'entidade_id' = a.id::text
               and e.dados ->> 'para' = a.estado::text)
         ) >= hoje.dia - prazo.dias
    )
$$;
comment on function privado.familias_atribuidas() is 'Famílias com designação aceita da profissional logada (profissional ativa, perfil ativo), com acompanhamento não terminado ou terminado há no máximo parametro.acesso_enfermeira_pos_encerramento_dias dias (ausente = 0). security definer para as políticas não entrarem em recursão. PRD 13 [v4.2], ADR 0002 seção 3.';

-- --- Auxiliares dos wrappers de api (sem grant: só rodam dentro de função
--     security definer) -------------------------------------------------------

-- Verdadeiro se o usuário tem algum papel com acesso a dado assistencial ou
-- financeiro, que exige sessão AAL2 em tudo (PRD 13, ADR 0002 seção 2).
create function privado.perfil_exige_mfa() returns boolean
  language sql
  stable
  set search_path = ''
  as $$
  select privado.tem_papel('enfermeira')
      or privado.tem_papel('financeiro')
      or privado.tem_papel('coordenacao')
      or privado.tem_papel('diretoria')
$$;
comment on function privado.perfil_exige_mfa() is 'Verdadeiro se auth.uid() tem papel enfermeira, financeiro, coordenacao ou diretoria (perfis com MFA obrigatório, PRD 13). Sem grant: usada pelos wrappers de api.';

-- Porta de entrada de todo wrapper de api: usuário identificado, perfil ativo
-- com um dos papéis pedidos, e AAL2 quando a operação ou o perfil exigem.
-- Recusa com 42501 (insufficient_privilege).
create function privado.autorizar(papeis public.papel_usuario[], exige_aal2 boolean) returns void
  language plpgsql
  stable
  set search_path = ''
  as $$
begin
  if auth.uid() is null then
    raise exception 'acesso negado: usuário não identificado'
      using errcode = '42501';
  end if;

  if not exists (select 1 from pg_catalog.unnest(autorizar.papeis) as p(papel) where privado.tem_papel(p.papel)) then
    raise exception 'acesso negado: o papel do usuário não permite esta operação (PRD 13)'
      using errcode = '42501';
  end if;

  if not privado.aal2() and (coalesce(autorizar.exige_aal2, true) or privado.perfil_exige_mfa()) then
    raise exception 'acesso negado: esta operação exige MFA (AAL2) (PRD 13)'
      using errcode = '42501';
  end if;
end;
$$;
comment on function privado.autorizar(public.papel_usuario[], boolean) is 'Confere, para um wrapper de api: usuário identificado, perfil ativo com um dos papéis, AAL2 quando exige_aal2 ou quando o perfil tem papel com MFA obrigatório. Recusa com 42501. Sem grant.';

-- --- Execute para authenticated: só as quatro do PRD 11.10 --------------------
grant execute on function privado.tem_papel(public.papel_usuario) to authenticated;
grant execute on function privado.familias_atribuidas()           to authenticated;
grant execute on function privado.aal2()                          to authenticated;
grant execute on function privado.sem_acento(text)                to authenticated;


-- =============================================================================
-- 4. perfil criado a partir de auth.users (P07 item 1)
--
-- O convite da diretoria (tela do P07, rota de servidor com service_role)
-- grava o nome em raw_app_meta_data, campo que só o servidor escreve (o
-- usuário edita raw_user_meta_data, nunca raw_app_meta_data). Só nesse caso
-- o perfil nasce; um cadastro sem convite não vira perfil e, sem perfil,
-- não tem papel nem acesso a nada. O perfil nasce sem papel: papel só a
-- diretoria dá, em usuario_papel.
-- =============================================================================

create function privado.criar_perfil_do_convite() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_nome text := nullif(pg_catalog.btrim(new.raw_app_meta_data ->> 'nome'), '');
begin
  if v_nome is not null then
    insert into public.perfil (id, nome, email)
    values (new.id, v_nome, coalesce(new.email, ''))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
comment on function privado.criar_perfil_do_convite() is 'Gatilho AFTER INSERT em auth.users: cria o perfil (sem papel) quando o convite do servidor traz nome em raw_app_meta_data. Cadastro sem convite não vira perfil (P07 item 1, ADR 0002).';

create trigger criar_perfil_do_convite
  after insert on auth.users
  for each row execute function privado.criar_perfil_do_convite();

revoke execute on function privado.criar_perfil_do_convite() from public, anon, authenticated, service_role;


-- =============================================================================
-- 5. Grants e políticas por tabela (ADR 0002 seção 4)
--
-- 5.0 Políticas restritivas de MFA (ADR 0002 seção 2). Restritiva = somada
-- com "e" a toda política permissiva da tabela, em qualquer operação.
--
--   exige_mfa_do_perfil: quem tem papel enfermeira, financeiro, coordenacao
--     ou diretoria só vê e só grava com AAL2. Comercial e marketing puros
--     trabalham em AAL1. Vai em toda tabela com grant para authenticated.
--   exige_aal2: AAL2 para qualquer papel. Tabelas financeiras e a fila de
--     sincronização (payload assistencial).
--
-- perfil e usuario_papel ganham a mesma regra com uma exceção (seções 5.1):
-- a própria linha é legível em AAL1, para o middleware saber que precisa
-- pedir o MFA.
-- =============================================================================

do $$
declare
  v_tabela text;
  c_mfa constant text :=
    '(select privado.aal2()) or not ('
    || '(select privado.tem_papel(''enfermeira'')) or (select privado.tem_papel(''financeiro'')) '
    || 'or (select privado.tem_papel(''coordenacao'')) or (select privado.tem_papel(''diretoria'')))';
begin
  foreach v_tabela in array array[
    'regiao', 'cidade', 'municipio', 'parametro', 'automacao', 'automacao_execucao',
    'mensagem_modelo', 'regua_faixa', 'termo_alerta', 'instrumento', 'regra_alerta',
    'familia', 'pessoa', 'bebe', 'medico', 'pacote', 'pacote_versao', 'condicao_comercial',
    'oportunidade', 'sessao_venda', 'contrato', 'cobranca', 'nota_fiscal',
    'conversa', 'mensagem', 'handoff', 'tarefa', 'notificacao', 'evento_familia',
    'profissional', 'documento_profissional', 'bloqueio_agenda', 'acompanhamento',
    'designacao', 'visita', 'ocorrencia', 'pos_venda', 'fila_sincronizacao'
  ]
  loop
    execute format(
      'create policy exige_mfa_do_perfil on public.%I as restrictive for all to authenticated using (%s) with check (%s)',
      v_tabela, c_mfa, c_mfa);
  end loop;

  foreach v_tabela in array array['contrato', 'cobranca', 'nota_fiscal', 'fila_sincronizacao']
  loop
    execute format(
      'create policy exige_aal2 on public.%I as restrictive for all to authenticated '
      'using ((select privado.aal2())) with check ((select privado.aal2()))',
      v_tabela);
  end loop;
end $$;


-- =============================================================================
-- 5.0.1 criado_por carimbado pelo banco
--
-- As tabelas têm criado_por (PRD 5.2) e vários grants de insert incluem a
-- coluna. Sem esta trava, um usuário do app gravaria uma linha em nome de
-- outra pessoa (criado_por de outro perfil). Para o usuário do app
-- (authenticated), o banco escreve auth.uid() no insert e mantém o valor
-- antigo no update; migrations, seed, funções security definer e o
-- service_role gravam o que informarem.
-- =============================================================================

create function privado.carimbar_criado_por() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.criado_por := auth.uid();
    else
      new.criado_por := old.criado_por;
    end if;
  end if;
  return new;
end;
$$;
comment on function privado.carimbar_criado_por() is 'Gatilho BEFORE INSERT OR UPDATE das tabelas de public com criado_por: para o usuário do app (authenticated), criado_por = auth.uid() no insert e inalterado no update. Impede gravar em nome de outra pessoa (ADR 0002).';

revoke execute on function privado.carimbar_criado_por() from public, anon, authenticated, service_role;

do $$
declare
  v_tabela text;
begin
  for v_tabela in
    select c.relname
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and a.attname = 'criado_por' and a.attnum > 0 and not a.attisdropped
    order by c.relname
  loop
    execute format(
      'create trigger carimbar_criado_por before insert or update on public.%I '
      'for each row execute function privado.carimbar_criado_por()',
      v_tabela);
  end loop;
end $$;


-- =============================================================================
-- 5.1 Configuração e usuários
-- =============================================================================

-- --- perfil -------------------------------------------------------------------
-- L própria (em AAL1 também); coordenação e diretoria L todas; diretoria A.
-- Sem I (nasce pelo gatilho da seção 4) e sem X (desativar = ativo false).
grant select on public.perfil to authenticated;
grant update (nome, email, telefone_e164, profissional_id, ativo) on public.perfil to authenticated;

create policy exige_mfa_do_perfil on public.perfil as restrictive for all to authenticated
  using (
    id = (select auth.uid())
    or (select privado.aal2())
    or not ((select privado.tem_papel('enfermeira')) or (select privado.tem_papel('financeiro'))
            or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))))
  with check (
    (select privado.aal2())
    or not ((select privado.tem_papel('enfermeira')) or (select privado.tem_papel('financeiro'))
            or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))));

create policy ler on public.perfil for select to authenticated
  using (id = (select auth.uid())
         or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));

create policy alterar on public.perfil for update to authenticated
  using ((select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('diretoria')));

-- --- usuario_papel ------------------------------------------------------------
-- L próprias (em AAL1 também); só a diretoria vê todas, inclui e exclui
-- (P07 item 1). Sem A: a chave é o próprio dado (troca = exclui e inclui).
-- privado.tem_papel é security definer: a política não entra em recursão.
grant select, insert, delete on public.usuario_papel to authenticated;

create policy exige_mfa_do_perfil on public.usuario_papel as restrictive for all to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select privado.aal2())
    or not ((select privado.tem_papel('enfermeira')) or (select privado.tem_papel('financeiro'))
            or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))))
  with check (
    (select privado.aal2())
    or not ((select privado.tem_papel('enfermeira')) or (select privado.tem_papel('financeiro'))
            or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))));

create policy ler on public.usuario_papel for select to authenticated
  using (usuario_id = (select auth.uid()) or (select privado.tem_papel('diretoria')));

create policy incluir on public.usuario_papel for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));

create policy excluir on public.usuario_papel for delete to authenticated
  using ((select privado.tem_papel('diretoria')));

-- --- regiao, cidade -------------------------------------------------------------
-- L comercial, financeiro, coordenação, diretoria; I e A só a diretoria
-- ("Parâmetros e configurações", PRD 13).
grant select, insert, update on public.regiao to authenticated;
grant select, insert, update on public.cidade to authenticated;

create policy ler on public.regiao for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
         or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.regiao for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));
create policy alterar on public.regiao for update to authenticated
  using ((select privado.tem_papel('diretoria'))) with check ((select privado.tem_papel('diretoria')));

create policy ler on public.cidade for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
         or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.cidade for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));
create policy alterar on public.cidade for update to authenticated
  using ((select privado.tem_papel('diretoria'))) with check ((select privado.tem_papel('diretoria')));

-- --- municipio ----------------------------------------------------------------
-- Lista do IBGE, carregada pelo seed. L comercial, coordenação, diretoria.
grant select on public.municipio to authenticated;

create policy ler on public.municipio for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));

-- --- parametro ----------------------------------------------------------------
-- Só a diretoria (PRD 13, "Parâmetros e configurações").
grant select, insert, update on public.parametro to authenticated;

create policy ler on public.parametro for select to authenticated
  using ((select privado.tem_papel('diretoria')));
create policy incluir on public.parametro for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));
create policy alterar on public.parametro for update to authenticated
  using ((select privado.tem_papel('diretoria'))) with check ((select privado.tem_papel('diretoria')));

-- --- automacao ------------------------------------------------------------------
grant select, insert, update on public.automacao to authenticated;

create policy ler on public.automacao for select to authenticated
  using ((select privado.tem_papel('diretoria')));
create policy incluir on public.automacao for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));
create policy alterar on public.automacao for update to authenticated
  using ((select privado.tem_papel('diretoria'))) with check ((select privado.tem_papel('diretoria')));

-- --- automacao_execucao ---------------------------------------------------------
-- L coordenação (vê as abortadas pelo freio, PRD 8.3) e diretoria. Escrita
-- só pelo motor (security definer).
grant select on public.automacao_execucao to authenticated;

create policy ler on public.automacao_execucao for select to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

-- --- mensagem_modelo --------------------------------------------------------------
-- Leitura geral; escrita da diretoria e da coordenação só com destinatário
-- 'medico' (PRD 13).
grant select, insert, update on public.mensagem_modelo to authenticated;

create policy ler on public.mensagem_modelo for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('enfermeira'))
         or (select privado.tem_papel('financeiro')) or (select privado.tem_papel('marketing'))
         or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.mensagem_modelo for insert to authenticated
  with check ((select privado.tem_papel('diretoria'))
              or ((select privado.tem_papel('coordenacao')) and destinatario = 'medico'));
create policy alterar on public.mensagem_modelo for update to authenticated
  using ((select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('coordenacao')) and destinatario = 'medico'))
  with check ((select privado.tem_papel('diretoria'))
              or ((select privado.tem_papel('coordenacao')) and destinatario = 'medico'));

-- --- regua_faixa ------------------------------------------------------------------
grant select, insert, update on public.regua_faixa to authenticated;

create policy ler on public.regua_faixa for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy incluir on public.regua_faixa for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));
create policy alterar on public.regua_faixa for update to authenticated
  using ((select privado.tem_papel('diretoria'))) with check ((select privado.tem_papel('diretoria')));

-- --- termo_alerta, instrumento, regra_alerta ------------------------------------
-- "Termos de alerta e instrumentos" para a coordenação (PRD 13). A
-- enfermeira lê instrumento e regra_alerta: o formulário e a avaliação do
-- alerta rodam no aparelho (PRD 9, 15).
grant select, insert, update on public.termo_alerta to authenticated;
grant select, insert, update on public.instrumento  to authenticated;
grant select, insert, update on public.regra_alerta to authenticated;

create policy ler on public.termo_alerta for select to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.termo_alerta for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.termo_alerta for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

create policy ler on public.instrumento for select to authenticated
  using ((select privado.tem_papel('enfermeira')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy incluir on public.instrumento for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.instrumento for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

create policy ler on public.regra_alerta for select to authenticated
  using ((select privado.tem_papel('enfermeira')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy incluir on public.regra_alerta for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.regra_alerta for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));


-- =============================================================================
-- 5.2 Família, comercial e conversa
-- =============================================================================

-- --- familia --------------------------------------------------------------------
-- L comercial, financeiro, coordenação, diretoria; I e A comercial e
-- diretoria. Marketing sem acesso nenhum à tabela (só api.marketing_*); a
-- enfermeira lê pelos recortes api.familias_do_dia e api.ficha_assistencial.
--
-- historico_sensivel fica fora de todo grant: RLS não filtra coluna, e o
-- comercial e o financeiro não podem ver (PRD 13 [v4.2]). Coordenação e
-- diretoria veem em api.ficha_assistencial; o agente grava por
-- agente.atualizar_lead (P21). Também ficam fora de I e A: estado_sensivel e
-- as colunas do freio (P09, por função), mesclada_em_id (deduplicação, P17),
-- a chave e os carimbos.
--
-- As colunas de origem do lead (origem, codigo_origem, utm, indicacao_medico_id
-- e indicacao_familia_id) também saem do grant de select: a linha "Lead e
-- origem" do PRD 13 é "sem acesso" para o financeiro e para a coordenação,
-- que leem a ficha comercial. Comercial e diretoria leem a origem por
-- api.lead_origem (seção 7); o marketing só pelos agregados. Inclusão e
-- alteração dessas colunas continuam com o comercial e a diretoria.
--
-- Linha: o financeiro lê só família que já tem contrato (PRD 13, "Lead e
-- origem" sem acesso; "Ficha comercial" leitura para cobrar). Coordenação
-- lê todas: conduz a sessão de venda ainda no pipeline 1.
grant select (id, criado_em, atualizado_em, criado_por, nome_exibicao, cidade_id, regiao_id, bairro,
              endereco_atendimento, dpp, data_nascimento, data_alta, data_inicio_efetivo, gemelar,
              primeira_gestacao, estado_sensivel, estado_sensivel_motivo, estado_sensivel_em,
              estado_sensivel_por, nao_contatar, nao_contatar_em, nao_contatar_motivo, mesclada_em_id,
              familia_anterior_id, cidade_informada, municipio_codigo_ibge)
  on public.familia to authenticated;
grant insert (id, criado_por, nome_exibicao, cidade_id, regiao_id, bairro, endereco_atendimento, dpp,
              data_nascimento, data_alta, data_inicio_efetivo, gemelar, primeira_gestacao,
              nao_contatar, nao_contatar_em, nao_contatar_motivo, origem, codigo_origem, utm,
              indicacao_medico_id, indicacao_familia_id, familia_anterior_id, cidade_informada,
              municipio_codigo_ibge)
  on public.familia to authenticated;
grant update (nome_exibicao, cidade_id, regiao_id, bairro, endereco_atendimento, dpp, data_nascimento,
              data_alta, data_inicio_efetivo, gemelar, primeira_gestacao, nao_contatar, nao_contatar_em,
              nao_contatar_motivo, origem, codigo_origem, utm, indicacao_medico_id, indicacao_familia_id,
              familia_anterior_id, cidade_informada, municipio_codigo_ibge)
  on public.familia to authenticated;

create policy ler on public.familia for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('financeiro'))
             and id in (select k.familia_id from public.contrato k)));
create policy incluir on public.familia for insert to authenticated
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.familia for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')));

-- --- familia_elegivel_marketing (view, PRD 6.9) ---------------------------------
-- Sem grant (a seção 1 já revogou): lida só pelas funções api.marketing_*.
-- É security_invoker, então nem serviria ao marketing, que não lê familia.

-- --- pessoa ---------------------------------------------------------------------
-- Mesma regra da família (financeiro: só família com contrato). Sem X: remoção é privado.eliminar_titular (21.3).
grant select on public.pessoa to authenticated;
grant insert (id, criado_por, familia_id, papel, nome, telefone_e164, email, idade, ocupacao,
              contato_principal, consentimentos)
  on public.pessoa to authenticated;
grant update (papel, nome, telefone_e164, email, idade, ocupacao, contato_principal, consentimentos)
  on public.pessoa to authenticated;

create policy ler on public.pessoa for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('financeiro'))
             and familia_id in (select k.familia_id from public.contrato k)));
create policy incluir on public.pessoa for insert to authenticated
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.pessoa for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')));

-- --- pessoa_dados_contrato --------------------------------------------------------
-- SEM grant e SEM política (PRD 6.10 regra 6, 13 [v4.2]): nenhum select
-- direto, nem para comercial, financeiro ou diretoria em AAL2. Leitura só
-- por api.dados_contrato (seção 7), com log; escrita pela função do
-- formulário seguro (P30). A seção 1 já revogou tudo.

-- --- bebe, medico -----------------------------------------------------------------
grant select on public.bebe to authenticated;
grant insert (id, criado_por, familia_id, ordem, nome, sexo, data_nascimento, peso_nascimento_g,
              peso_alta_g, tipo_parto)
  on public.bebe to authenticated;
grant update (ordem, nome, sexo, data_nascimento, peso_nascimento_g, peso_alta_g, tipo_parto)
  on public.bebe to authenticated;

create policy ler on public.bebe for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy incluir on public.bebe for insert to authenticated
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));
create policy alterar on public.bebe for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));

grant select on public.medico to authenticated;
grant insert (id, criado_por, familia_id, especialidade, nome, telefone_e164, email, hospital,
              origem_cadastro, capturado_em)
  on public.medico to authenticated;
grant update (especialidade, nome, telefone_e164, email, hospital, origem_cadastro, capturado_em)
  on public.medico to authenticated;

create policy ler on public.medico for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy incluir on public.medico for insert to authenticated
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));
create policy alterar on public.medico for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));

-- --- pacote, pacote_versao, condicao_comercial -------------------------------------
-- Preço é configuração: L comercial, financeiro, coordenação, diretoria; I e
-- A só a diretoria.
grant select, insert, update on public.pacote             to authenticated;
grant select, insert, update on public.pacote_versao      to authenticated;
grant select, insert, update on public.condicao_comercial to authenticated;

create policy ler on public.pacote for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
         or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.pacote for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));
create policy alterar on public.pacote for update to authenticated
  using ((select privado.tem_papel('diretoria'))) with check ((select privado.tem_papel('diretoria')));

create policy ler on public.pacote_versao for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
         or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.pacote_versao for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));
create policy alterar on public.pacote_versao for update to authenticated
  using ((select privado.tem_papel('diretoria'))) with check ((select privado.tem_papel('diretoria')));

create policy ler on public.condicao_comercial for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
         or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.condicao_comercial for insert to authenticated
  with check ((select privado.tem_papel('diretoria')));
create policy alterar on public.condicao_comercial for update to authenticated
  using ((select privado.tem_papel('diretoria'))) with check ((select privado.tem_papel('diretoria')));

-- --- oportunidade -----------------------------------------------------------------
-- L comercial, coordenação, diretoria e financeiro (só família com
-- contrato, como em familia); I e A comercial e diretoria. Estágio e pipeline fora do grant de A (só api.transicionar; o
-- gatilho privado.proteger_estado recusa de novo e obriga o insert no estado
-- inicial). desconto_aprovado_por fora de I e A: aprovação de desconto é
-- função própria (P30), nunca o próprio comercial marcando.
grant select on public.oportunidade to authenticated;
grant insert (id, criado_por, familia_id, pipeline, estagio_p1, score, classificacao, motivo_perda,
              motivo_perda_detalhe, responsavel_id, plano_interesse_pacote_id, pagamento_preferido,
              para_quem, pagador_pessoa_id, qualificacao, pdf_enviado_em, sessao_interesse_em,
              proximo_contato_em, cadencia_etapa, condicao_id, desconto_pct, desconto_motivo)
  on public.oportunidade to authenticated;
grant update (score, classificacao, motivo_perda, motivo_perda_detalhe, responsavel_id,
              plano_interesse_pacote_id, pagamento_preferido, para_quem, pagador_pessoa_id, qualificacao,
              pdf_enviado_em, sessao_interesse_em, proximo_contato_em, cadencia_etapa, condicao_id,
              desconto_pct, desconto_motivo)
  on public.oportunidade to authenticated;

create policy ler on public.oportunidade for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('financeiro'))
             and familia_id in (select k.familia_id from public.contrato k)));
create policy incluir on public.oportunidade for insert to authenticated
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.oportunidade for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('diretoria')));

-- --- sessao_venda -------------------------------------------------------------------
-- Agenda da conversa com a Edilaine: comercial, coordenação, diretoria.
grant select on public.sessao_venda to authenticated;
grant insert (id, criado_por, familia_id, agendada_para, opcoes_informadas, realizada_em, conduzida_por,
              link_reuniao, parceiro_presente, status)
  on public.sessao_venda to authenticated;
-- conduzida_por fica fora do grant de A: é ela que decide quem lê a
-- gravação (api.sessao_venda_gravacao, "quem conduziu", PRD 13). Com a
-- coluna editável, um comercial se poria como condutor de uma sessão
-- conduzida por outra pessoa e leria a transcrição. Nasce na inclusão
-- (agendamento) e muda só por função (P29), com log.
grant update (agendada_para, opcoes_informadas, realizada_em, link_reuniao, parceiro_presente, status)
  on public.sessao_venda to authenticated;

create policy ler on public.sessao_venda for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy incluir on public.sessao_venda for insert to authenticated
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));
create policy alterar on public.sessao_venda for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));

-- --- sessao_venda_gravacao ------------------------------------------------------------
-- SEM grant e SEM política (PRD 6.10 regra 6): leitura só por
-- api.sessao_venda_gravacao, com log, para quem conduziu e para a diretoria
-- (PRD 13, o mais restritivo do onboarding). Escrita pelo servidor e por
-- função do P29.

-- --- contrato, cobranca, nota_fiscal (financeiras, AAL2 para todos) -----------------
-- contrato: comercial, financeiro, diretoria. cobranca e nota_fiscal:
-- financeiro e diretoria; o comercial vê só o status, por api.status_cobranca
-- ("Parcial (status)", PRD 13: RLS não recorta coluna).
grant select on public.contrato to authenticated;
grant insert (id, criado_por, familia_id, pacote_versao_id, contratante_pessoa_id, pagador_pessoa_id,
              testemunha_pessoa_id, valor_centavos, taxa_deslocamento_centavos, desconto_centavos, parcelas,
              template_versao, formulario_token_hash, formulario_expira_em, autentique_doc_id, pdf_path,
              enviado_em, assinado_em, status)
  on public.contrato to authenticated;
grant update (pacote_versao_id, contratante_pessoa_id, pagador_pessoa_id, testemunha_pessoa_id,
              valor_centavos, taxa_deslocamento_centavos, desconto_centavos, parcelas, template_versao,
              formulario_token_hash, formulario_expira_em, autentique_doc_id, pdf_path, enviado_em,
              assinado_em, status)
  on public.contrato to authenticated;

create policy ler on public.contrato for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
         or (select privado.tem_papel('diretoria')));
create policy incluir on public.contrato for insert to authenticated
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
              or (select privado.tem_papel('diretoria')));
create policy alterar on public.contrato for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
         or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('financeiro'))
              or (select privado.tem_papel('diretoria')));

grant select on public.cobranca to authenticated;
grant insert (id, criado_por, contrato_id, parcela, valor_centavos, vencimento, external_id, provider,
              link_pagamento, invoice_slug, transaction_nsu, capture_method, parcelas_cartao,
              valor_pago_centavos, comprovante_url, pago_em, status)
  on public.cobranca to authenticated;
grant update (parcela, valor_centavos, vencimento, link_pagamento, invoice_slug, transaction_nsu,
              capture_method, parcelas_cartao, valor_pago_centavos, comprovante_url, pago_em, status)
  on public.cobranca to authenticated;

create policy ler on public.cobranca for select to authenticated
  using ((select privado.tem_papel('financeiro')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.cobranca for insert to authenticated
  with check ((select privado.tem_papel('financeiro')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.cobranca for update to authenticated
  using ((select privado.tem_papel('financeiro')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('financeiro')) or (select privado.tem_papel('diretoria')));

grant select on public.nota_fiscal to authenticated;
grant insert (id, criado_por, cobranca_id, provider, provider_ref, numero, status, pdf_path, xml_path,
              emitida_em, erro)
  on public.nota_fiscal to authenticated;
grant update (provider, provider_ref, numero, status, pdf_path, xml_path, emitida_em, erro)
  on public.nota_fiscal to authenticated;

create policy ler on public.nota_fiscal for select to authenticated
  using ((select privado.tem_papel('financeiro')) or (select privado.tem_papel('diretoria')));
create policy incluir on public.nota_fiscal for insert to authenticated
  with check ((select privado.tem_papel('financeiro')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.nota_fiscal for update to authenticated
  using ((select privado.tem_papel('financeiro')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('financeiro')) or (select privado.tem_papel('diretoria')));

-- --- conversa, mensagem, handoff ---------------------------------------------------------
-- "Conversas do WhatsApp e handoffs": comercial, coordenação e diretoria
-- (PRD 13). conversa: I só com as colunas de contato manual e A só no
-- vínculo com a família e na classificação; a
-- pausa e o modo do agente mudam só por função (privado.retomar_agente,
-- P22). mensagem: só L; o texto passa por privado.mascarar_documentos antes
-- de gravar, então o registro do "enviei" é função (P18); UPDATE, DELETE e
-- TRUNCATE já estavam revogados (P03). handoff: A só para assumir e
-- resolver; quem abre é o agente ou o sistema.
grant select on public.conversa to authenticated;
-- I só com as colunas de um contato registrado à mão (telefone, presencial);
-- wa_jid, wa_lid, marcos de mensagem e pausa/modo do agente são do agente.
grant insert (id, criado_por, canal, telefone_e164, familia_id, pessoa_id, classificacao, nome_contato_salvo)
  on public.conversa to authenticated;
grant update (familia_id, pessoa_id, classificacao) on public.conversa to authenticated;

create policy ler on public.conversa for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy incluir on public.conversa for insert to authenticated
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));
create policy alterar on public.conversa for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));

grant select on public.mensagem to authenticated;

create policy ler on public.mensagem for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));

grant select on public.handoff to authenticated;
grant update (assumido_por, assumido_em, resolvido_em, status) on public.handoff to authenticated;

create policy ler on public.handoff for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')));
create policy alterar on public.handoff for update to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria')));

-- --- tarefa, notificacao --------------------------------------------------------------
-- "Para o responsável, o papel responsável e a diretoria" (PRD 13).
-- Responsável = responsavel_id do usuário, ou tarefa ainda sem pessoa cujo
-- papel_responsavel o usuário tem. Quem cria é o sistema (automações).
grant select on public.tarefa to authenticated;
grant update (status, concluida_em, concluida_por, responsavel_id) on public.tarefa to authenticated;

create policy ler on public.tarefa for select to authenticated
  using (responsavel_id = (select auth.uid())
         or (responsavel_id is null and papel_responsavel is not null and privado.tem_papel(papel_responsavel))
         or (select privado.tem_papel('diretoria')));
create policy alterar on public.tarefa for update to authenticated
  using (responsavel_id = (select auth.uid())
         or (responsavel_id is null and papel_responsavel is not null and privado.tem_papel(papel_responsavel))
         or (select privado.tem_papel('diretoria')))
  with check (responsavel_id = (select auth.uid())
              or (responsavel_id is null and papel_responsavel is not null and privado.tem_papel(papel_responsavel))
              or (select privado.tem_papel('diretoria')));

grant select on public.notificacao to authenticated;
grant update (lida_em) on public.notificacao to authenticated;

create policy ler on public.notificacao for select to authenticated
  using (usuario_id = (select auth.uid())
         or (usuario_id is null and papel is not null and privado.tem_papel(papel))
         or (select privado.tem_papel('diretoria')));
create policy alterar on public.notificacao for update to authenticated
  using (usuario_id = (select auth.uid())
         or (usuario_id is null and papel is not null and privado.tem_papel(papel))
         or (select privado.tem_papel('diretoria')))
  with check (usuario_id = (select auth.uid())
              or (usuario_id is null and papel is not null and privado.tem_papel(papel))
              or (select privado.tem_papel('diretoria')));

-- --- evento_familia ---------------------------------------------------------------------
-- Linha do tempo da ficha: quem lê a ficha comercial lê os eventos não
-- restritos (financeiro: só família com contrato). Evento restrito segue o registro assistencial (PRD 13): sem
-- leitura direta, só por função com log (P16). Sem I direto: a linha do
-- tempo é escrita pelas funções (transicionar, freio, agente).
grant select on public.evento_familia to authenticated;

create policy ler on public.evento_familia for select to authenticated
  using (not restrito
         and ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
              or (select privado.tem_papel('diretoria'))
              or ((select privado.tem_papel('financeiro'))
                  and familia_id in (select k.familia_id from public.contrato k))));


-- =============================================================================
-- 5.3 Operação e assistencial
-- =============================================================================

-- --- profissional, documento_profissional -------------------------------------------
-- Coordenação e diretoria; cada enfermeira lê o seu (PRD 13). O financeiro
-- lê profissional para o pagamento da equipe ("Financeiro" Total).
grant select on public.profissional to authenticated;
grant insert (id, criado_por, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero,
              telefone_e164, regioes, vinculo, valor_hora_centavos, adicional_deslocamento_centavos, ativa)
  on public.profissional to authenticated;
grant update (usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero, telefone_e164, regioes,
              vinculo, valor_hora_centavos, adicional_deslocamento_centavos, ativa)
  on public.profissional to authenticated;

create policy ler on public.profissional for select to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))
         or (select privado.tem_papel('financeiro'))
         or ((select privado.tem_papel('enfermeira')) and usuario_id = (select auth.uid())));
create policy incluir on public.profissional for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.profissional for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

grant select on public.documento_profissional to authenticated;
grant insert (id, criado_por, profissional_id, tipo, numero, validade, arquivo_path)
  on public.documento_profissional to authenticated;
grant update (tipo, numero, validade, arquivo_path) on public.documento_profissional to authenticated;

create policy ler on public.documento_profissional for select to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('enfermeira'))
             and profissional_id in (select pr.id from public.profissional pr where pr.usuario_id = (select auth.uid()))));
create policy incluir on public.documento_profissional for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.documento_profissional for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

-- --- bloqueio_agenda ------------------------------------------------------------------
-- Agenda: comercial leitura, enfermeira a própria, coordenação e diretoria
-- total (PRD 13).
grant select, delete on public.bloqueio_agenda to authenticated;
grant insert (id, criado_por, profissional_id, inicio, fim, motivo) on public.bloqueio_agenda to authenticated;
grant update (inicio, fim, motivo) on public.bloqueio_agenda to authenticated;

create policy ler on public.bloqueio_agenda for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('enfermeira'))
             and profissional_id in (select pr.id from public.profissional pr where pr.usuario_id = (select auth.uid()))));
create policy incluir on public.bloqueio_agenda for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.bloqueio_agenda for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy excluir on public.bloqueio_agenda for delete to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

-- --- acompanhamento, designacao, visita (Agenda) -------------------------------------------
-- Comercial leitura, enfermeira a própria, coordenação e diretoria total
-- (PRD 13). "Própria" da enfermeira:
--   acompanhamento  família em privado.familias_atribuidas() (prazo e
--                   profissional ativa inclusos);
--   designacao      as próprias designações, inclusive ofertas ainda não
--                   respondidas (aceitar e recusar é função do P36);
--   visita          as próprias visitas, de família atribuída.
-- Estado de acompanhamento e visita fora do grant de A (api.transicionar;
-- o gatilho privado.proteger_estado recusa de novo). Check-in e check-out
-- da visita são função do P38.
grant select on public.acompanhamento to authenticated;
grant insert (id, criado_por, contrato_id, familia_id, dias_contratados, horas_por_visita, periodo,
              inicio_efetivo, encerramento, estado)
  on public.acompanhamento to authenticated;
grant update (dias_contratados, horas_por_visita, periodo, inicio_efetivo, encerramento)
  on public.acompanhamento to authenticated;

create policy ler on public.acompanhamento for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('enfermeira')) and familia_id in (select privado.familias_atribuidas())));
create policy incluir on public.acompanhamento for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.acompanhamento for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

grant select on public.designacao to authenticated;
grant insert (id, criado_por, acompanhamento_id, profissional_id, papel, status, oferecida_em,
              respondida_em, motivo_recusa)
  on public.designacao to authenticated;
grant update (profissional_id, papel, status, respondida_em, motivo_recusa) on public.designacao to authenticated;

create policy ler on public.designacao for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('enfermeira'))
             and profissional_id in (select pr.id from public.profissional pr
                                      where pr.usuario_id = (select auth.uid()) and pr.ativa)));
create policy incluir on public.designacao for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.designacao for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

grant select on public.visita to authenticated;
grant insert (id, criado_por, acompanhamento_id, profissional_id, dia_numero, data, hora_prevista, estado)
  on public.visita to authenticated;
grant update (profissional_id, dia_numero, data, hora_prevista) on public.visita to authenticated;

create policy ler on public.visita for select to authenticated
  using ((select privado.tem_papel('comercial')) or (select privado.tem_papel('coordenacao'))
         or (select privado.tem_papel('diretoria'))
         or ((select privado.tem_papel('enfermeira'))
             and profissional_id in (select pr.id from public.profissional pr
                                      where pr.usuario_id = (select auth.uid()) and pr.ativa)
             and acompanhamento_id in (select a.id from public.acompanhamento a
                                        where a.familia_id in (select privado.familias_atribuidas()))));
create policy incluir on public.visita for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.visita for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

-- --- Tabelas assistenciais -----------------------------------------------------------------
-- consulta_prenatal, registro_atendimento, registro_adendo, anexo_audio,
-- relatorio_medico e alerta_clinico: SEM grant e SEM política (PRD 6.10
-- regra 6, 13). Leitura só por assistencial.ler_*, que grava 'leitura' no
-- log antes de devolver, alcançada pelos wrappers de api com AAL2
-- (enfermeira nas famílias atribuídas, coordenação, diretoria só leitura).
-- Escrita por funções de cada módulo (P35, P39, P40, P41). O comercial não
-- tem acesso (O-05, ADR 0002). A seção 1 já revogou tudo.

-- --- ocorrencia ---------------------------------------------------------------------------
-- Coordenação e diretoria total; ocorrência privada só elas (PRD 13). O
-- responsável definido lê e atualiza a não privada (só status e histórico).
grant select on public.ocorrencia to authenticated;
grant insert (id, criado_por, familia_id, profissional_id, tipo, prioridade, privada, titulo, descricao,
              responsavel_id, sla_vence_em, status, historico)
  on public.ocorrencia to authenticated;
grant update (tipo, prioridade, privada, titulo, descricao, responsavel_id, sla_vence_em, status, historico)
  on public.ocorrencia to authenticated;

create policy ler on public.ocorrencia for select to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))
         or (not privada and responsavel_id = (select auth.uid())));
create policy incluir on public.ocorrencia for insert to authenticated
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar_coordenacao on public.ocorrencia for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
-- O responsável não coordenador: a política permissiva deixa a linha, e o
-- gatilho abaixo limita as colunas (RLS não recorta coluna).
create policy alterar_responsavel on public.ocorrencia for update to authenticated
  using (not privada and responsavel_id = (select auth.uid()))
  with check (not privada and responsavel_id = (select auth.uid()));

create function privado.ocorrencia_responsavel_so_status() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  -- dono (migrations, funções security definer) e service_role passam; a
  -- regra é para o usuário do app que não é coordenação nem diretoria.
  if current_user <> 'authenticated'
     or privado.tem_papel('coordenacao') or privado.tem_papel('diretoria') then
    return new;
  end if;
  if (pg_catalog.to_jsonb(new) - array['status', 'historico', 'atualizado_em'])
     is distinct from (pg_catalog.to_jsonb(old) - array['status', 'historico', 'atualizado_em']) then
    raise exception 'ocorrencia: o responsável altera só status e historico (ADR 0002)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function privado.ocorrencia_responsavel_so_status() is 'Gatilho BEFORE UPDATE de ocorrencia: usuário do app que não é coordenação nem diretoria (o responsável) só muda status e historico (ADR 0002).';

create trigger ocorrencia_responsavel_so_status
  before update on public.ocorrencia
  for each row execute function privado.ocorrencia_responsavel_so_status();

revoke execute on function privado.ocorrencia_responsavel_so_status() from public, anon, authenticated, service_role;

-- --- pos_venda ------------------------------------------------------------------------------
-- Coordenação e diretoria. Estágio só por api.transicionar; linha criada pelo
-- sistema (7.4); hash do token da pesquisa só pelo sistema.
grant select on public.pos_venda to authenticated;
grant update (pesquisa_enviada_em, pesquisa_respondida_em, respostas, nps, classificacao,
              depoimento_autorizado, autorizacao_imagem, acao_executada_em)
  on public.pos_venda to authenticated;

create policy ler on public.pos_venda for select to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));
create policy alterar on public.pos_venda for update to authenticated
  using ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')))
  with check ((select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria')));

-- --- log_auditoria ---------------------------------------------------------------------------
-- Sem grant (P05). Leitura só pela diretoria, por api.log_auditoria.

-- --- fila_sincronizacao -----------------------------------------------------------------------
-- Só o próprio usuário, AAL2 para todos (o payload carrega dado
-- assistencial). O servidor processa a fila.
grant select on public.fila_sincronizacao to authenticated;
grant insert (id, usuario_id, entidade, entidade_id, campo, payload, versao_base, criado_no_cliente_em)
  on public.fila_sincronizacao to authenticated;

-- "Próprio usuário" = usuário do app com perfil ativo e algum papel: um
-- cadastro sem convite (sem perfil) ou um perfil desativado não grava nem
-- lê a fila, mesmo em AAL2.
create policy ler on public.fila_sincronizacao for select to authenticated
  using (usuario_id = (select auth.uid())
         and ((select privado.tem_papel('comercial')) or (select privado.tem_papel('enfermeira'))
              or (select privado.tem_papel('financeiro')) or (select privado.tem_papel('marketing'))
              or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))));
create policy incluir on public.fila_sincronizacao for insert to authenticated
  with check (usuario_id = (select auth.uid())
              and ((select privado.tem_papel('comercial')) or (select privado.tem_papel('enfermeira'))
                   or (select privado.tem_papel('financeiro')) or (select privado.tem_papel('marketing'))
                   or (select privado.tem_papel('coordenacao')) or (select privado.tem_papel('diretoria'))));

-- --- Schemas agente e agente_n8n -------------------------------------------------------------
-- authenticated sem usage (seção 1). agente.base_conhecimento e
-- agente.ingestao_execucao chegam ao app pelas funções api da tela do agente
-- (P27), com a regra do ADR 0002; agente_n8n é só do n8n_agente (P21).


-- =============================================================================
-- 6. privado.status_profissional (PRD 6.5 [v4.2], 20.6, O-08)
--
-- Estado calculado da profissional num dia, nunca coluna e nunca marcado à
-- mão. Precedência = ordem do enum status_profissional:
--   em_visita        hoje, visita com check-in e sem check-out
--   em_atendimento   designação titular aceita em acompanhamento ativo ou
--                    em_execucao, com visita na semana do dia
--   reservada        designação titular aceita de família que aguarda o
--                    nascimento (acompanhamento aguardando, bebê não nasceu),
--                    com a janela da DPP cruzando a semana
--   backup           designação backup aceita de família na janela, com
--                    acompanhamento ainda não terminado
--   oferta_pendente  designação oferecida sem resposta
--   folga            bloqueio de agenda cobrindo o dia
--   livre            nenhum dos anteriores
-- A janela da DPP vem de parametro.janela_dpp_dias ({"antes": 21, "depois":
-- 14}, a semear no P08). Sem o parâmetro, recusa: mostrar como livre uma
-- enfermeira reservada é o erro mais caro aqui (sobrevenda).
-- [confirmar: Edilaine, regra exata de "em atendimento" fora da visita]
-- Sem grant: exposta ao app só por api.status_equipe.
-- =============================================================================

create function privado.status_profissional(profissional_id uuid, dia date default null)
  returns public.status_profissional
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_hoje   date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
  v_dia    date := coalesce(status_profissional.dia, v_hoje);
  v_inicio date := pg_catalog.date_trunc('week', v_dia)::date;
  v_fim    date := pg_catalog.date_trunc('week', v_dia)::date + 6;
  v_antes  integer;
  v_depois integer;
begin
  select (p.valor ->> 'antes')::integer, (p.valor ->> 'depois')::integer
    into v_antes, v_depois
  from public.parametro p
  where p.chave = 'janela_dpp_dias';

  if v_antes is null or v_depois is null then
    raise exception 'parametro janela_dpp_dias ausente ou incompleto: status da equipe não é calculado sem a janela da DPP (PRD 6.5, 10.2)'
      using errcode = '22023';
  end if;

  if v_dia = v_hoje and exists (
       select 1 from public.visita v
       where v.profissional_id = status_profissional.profissional_id
         and v.checkin_em is not null and v.checkout_em is null) then
    return 'em_visita';
  end if;

  if exists (
       select 1
       from public.designacao d
       join public.acompanhamento a on a.id = d.acompanhamento_id
       where d.profissional_id = status_profissional.profissional_id
         and d.papel = 'titular' and d.status = 'aceita'
         and a.estado in ('ativo', 'em_execucao')
         and exists (select 1 from public.visita v
                     where v.acompanhamento_id = a.id and v.data between v_inicio and v_fim)) then
    return 'em_atendimento';
  end if;

  if exists (
       select 1
       from public.designacao d
       join public.acompanhamento a on a.id = d.acompanhamento_id
       join public.familia f on f.id = a.familia_id
       where d.profissional_id = status_profissional.profissional_id
         and d.papel = 'titular' and d.status = 'aceita'
         and a.estado = 'aguardando'
         and f.data_nascimento is null
         and f.dpp is not null
         and f.dpp - v_antes <= v_fim and f.dpp + v_depois >= v_inicio) then
    return 'reservada';
  end if;

  if exists (
       select 1
       from public.designacao d
       join public.acompanhamento a on a.id = d.acompanhamento_id
       join public.familia f on f.id = a.familia_id
       where d.profissional_id = status_profissional.profissional_id
         and d.papel = 'backup' and d.status = 'aceita'
         and a.estado not in ('encerrado', 'interrompido_familia', 'interrompido_clinico')
         and f.dpp is not null
         and f.dpp - v_antes <= v_fim and f.dpp + v_depois >= v_inicio) then
    return 'backup';
  end if;

  if exists (
       select 1 from public.designacao d
       where d.profissional_id = status_profissional.profissional_id
         and d.status = 'oferecida') then
    return 'oferta_pendente';
  end if;

  if exists (
       select 1 from public.bloqueio_agenda b
       where b.profissional_id = status_profissional.profissional_id
         and v_dia between b.inicio and b.fim) then
    return 'folga';
  end if;

  return 'livre';
end;
$$;
comment on function privado.status_profissional(uuid, date) is 'Estado calculado da profissional num dia (PRD 6.5 [v4.2], O-08), pela precedência do enum status_profissional. Janela da DPP em parametro.janela_dpp_dias; sem ele, recusa. Sem grant: exposta por api.status_equipe.';


-- =============================================================================
-- 7. Schema api (PRD 5.2, 13; P07 item 5; ADR 0002 seção 5)
--
-- Todas security definer com search_path vazio. Cada uma começa por
-- privado.autorizar (usuário, perfil ativo, papel, AAL) e só depois lê.
-- Leitura de dado assistencial ou de contrato grava 'leitura' no log antes
-- de devolver (privado.registrar_leitura). Quando a escrita vem do app, a
-- origem do log é 'app' (app.origem), se ninguém a definiu antes.
-- =============================================================================

-- --- api.transicionar ------------------------------------------------------------------
-- Porta do app para privado.transicionar (PRD 7). Aqui: quem pode ver a
-- entidade e o AAL; lá: se a transição existe e o papel_minimo.
--   p1           comercial, diretoria (AAL1 permitido ao comercial puro)
--   p2           comercial, financeiro, coordenação, diretoria, AAL2
--   acompanhamento, visita
--                coordenação, diretoria, e a enfermeira só em família
--                atribuída (visita: só a própria), AAL2
--   p4           comercial, coordenação, diretoria, AAL2
create function api.transicionar(maquina text, entidade_id uuid, para text, motivo text default null)
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
comment on function api.transicionar(text, uuid, text, text) is 'Wrapper do app para privado.transicionar (PRD 7): confere papel, AAL e, para a enfermeira, família atribuída e visita própria; a transição e o papel_minimo são conferidos por privado.transicionar. ADR 0002 seção 5.';

-- --- api.familias_do_dia -----------------------------------------------------------------
-- Recorte da enfermeira (PRD 13): as visitas do dia com endereço de
-- atendimento, nomes, contatos e datas, sem nada comercial. Enfermeira: só
-- as próprias visitas de famílias atribuídas. Coordenação e diretoria:
-- todas. Uma linha 'leitura' no log por família devolvida.
create function api.familias_do_dia(dia date default null)
  returns table (
    familia_id           uuid,
    nome_exibicao        text,
    bairro               text,
    endereco_atendimento jsonb,
    cidade               text,
    uf                   text,
    dpp                  date,
    data_nascimento      date,
    data_alta            date,
    data_inicio_efetivo  date,
    gemelar              boolean,
    estado_sensivel      public.estado_sensivel,
    visita_id            uuid,
    dia_numero           integer,
    data                 date,
    hora_prevista        time,
    visita_estado        public.estado_visita,
    profissional_id      uuid,
    contato_nome         text,
    contato_telefone     text
  )
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_dia    date := coalesce(familias_do_dia.dia, (pg_catalog.now() at time zone 'America/Sao_Paulo')::date);
  v_todas  boolean;
  r        record;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  v_todas := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');

  for r in
    select f.id as f_id, f.nome_exibicao as f_nome, f.bairro as f_bairro,
           f.endereco_atendimento as f_endereco, c.nome as c_nome, c.uf::text as c_uf,
           f.dpp as f_dpp, f.data_nascimento as f_nascimento, f.data_alta as f_alta,
           f.data_inicio_efetivo as f_inicio, f.gemelar as f_gemelar, f.estado_sensivel as f_estado,
           v.id as v_id, v.dia_numero as v_dia_numero, v.data as v_data, v.hora_prevista as v_hora,
           v.estado as v_estado, v.profissional_id as v_profissional,
           ct.nome as ct_nome, ct.telefone_e164 as ct_telefone
    from public.visita v
    join public.acompanhamento a on a.id = v.acompanhamento_id
    join public.familia f on f.id = a.familia_id
    left join public.cidade c on c.id = f.cidade_id
    left join lateral (
      select p.nome, p.telefone_e164
      from public.pessoa p
      where p.familia_id = f.id
      order by p.contato_principal desc, (p.papel = 'mae') desc, p.criado_em, p.id
      limit 1
    ) ct on true
    where v.data = v_dia
      and (v_todas
           or (v.profissional_id in (select pr.id from public.profissional pr
                                      where pr.usuario_id = auth.uid() and pr.ativa)
               and a.familia_id in (select fa.id from privado.familias_atribuidas() as fa(id))))
    order by v.hora_prevista nulls last, f.nome_exibicao, v.id
  loop
    perform privado.registrar_leitura(
      'familia',
      r.f_id::text,
      pg_catalog.jsonb_build_object('funcao', 'api.familias_do_dia', 'dia', v_dia, 'visita_id', r.v_id));

    familia_id := r.f_id;             nome_exibicao := r.f_nome;       bairro := r.f_bairro;
    endereco_atendimento := r.f_endereco; cidade := r.c_nome;         uf := r.c_uf;
    dpp := r.f_dpp;                   data_nascimento := r.f_nascimento; data_alta := r.f_alta;
    data_inicio_efetivo := r.f_inicio; gemelar := r.f_gemelar;         estado_sensivel := r.f_estado;
    visita_id := r.v_id;              dia_numero := r.v_dia_numero;    data := r.v_data;
    hora_prevista := r.v_hora;        visita_estado := r.v_estado;     profissional_id := r.v_profissional;
    contato_nome := r.ct_nome;        contato_telefone := r.ct_telefone;
    return next;
  end loop;
end;
$$;
comment on function api.familias_do_dia(date) is 'Visitas do dia com endereço de atendimento, nomes, contatos e datas, sem nada comercial (PRD 13). Enfermeira: próprias visitas de famílias atribuídas; coordenação e diretoria: todas. AAL2. Grava uma leitura por família no log. ADR 0002 seção 5.';

-- --- api.ficha_assistencial ----------------------------------------------------------------
-- Ficha da família para a enfermeira (atribuída), a coordenação e a
-- diretoria (PRD 13): endereço de atendimento, nomes, contatos, datas,
-- bebês, médicos e acompanhamentos. Nada comercial (sem origem, UTM, código
-- de origem, indicação, oportunidade, preço, primeira_gestacao nem motivos de
-- estado). historico_sensivel só para coordenação e diretoria (PRD 13
-- [v4.2]). Grava a leitura no log antes de devolver; os acompanhamentos vêm
-- de assistencial.ler_acompanhamento, que grava a sua.
create function api.ficha_assistencial(familia_id uuid)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_coord    boolean;
  v_familia  public.familia;
  v_cidade   public.cidade;
  v_ficha    jsonb;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  v_coord := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');

  if ficha_assistencial.familia_id is null then
    raise exception 'api.ficha_assistencial: familia_id é obrigatório'
      using errcode = '22023';
  end if;

  if not v_coord
     and not exists (select 1 from privado.familias_atribuidas() as f(id) where f.id = ficha_assistencial.familia_id) then
    raise exception 'api.ficha_assistencial: família não atribuída a esta profissional (PRD 13)'
      using errcode = '42501';
  end if;

  select f.* into v_familia from public.familia f where f.id = ficha_assistencial.familia_id;
  if not found then
    raise exception 'api.ficha_assistencial: família % não existe', ficha_assistencial.familia_id
      using errcode = 'P0002';
  end if;
  select c.* into v_cidade from public.cidade c where c.id = v_familia.cidade_id;

  perform privado.registrar_leitura(
    'familia',
    ficha_assistencial.familia_id::text,
    pg_catalog.jsonb_build_object('funcao', 'api.ficha_assistencial'));

  v_ficha := pg_catalog.jsonb_build_object(
    'familia', pg_catalog.jsonb_build_object(
      'id', v_familia.id,
      'nome_exibicao', v_familia.nome_exibicao,
      'bairro', v_familia.bairro,
      'endereco_atendimento', v_familia.endereco_atendimento,
      'cidade', v_cidade.nome,
      'uf', v_cidade.uf,
      'dpp', v_familia.dpp,
      'idade_gestacional', (public.ig(v_familia.dpp, (pg_catalog.now() at time zone 'America/Sao_Paulo')::date)).texto,
      'data_nascimento', v_familia.data_nascimento,
      'data_alta', v_familia.data_alta,
      'data_inicio_efetivo', v_familia.data_inicio_efetivo,
      'gemelar', v_familia.gemelar,
      'estado_sensivel', v_familia.estado_sensivel
    ),
    'pessoas', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', p.id, 'papel', p.papel, 'nome', p.nome, 'telefone_e164', p.telefone_e164,
               'email', p.email, 'contato_principal', p.contato_principal)
             order by p.contato_principal desc, p.criado_em, p.id)
      from public.pessoa p where p.familia_id = v_familia.id), '[]'::jsonb),
    'bebes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', b.id, 'ordem', b.ordem, 'nome', b.nome, 'sexo', b.sexo,
               'data_nascimento', b.data_nascimento, 'peso_nascimento_g', b.peso_nascimento_g,
               'peso_alta_g', b.peso_alta_g, 'tipo_parto', b.tipo_parto)
             order by b.ordem, b.id)
      from public.bebe b where b.familia_id = v_familia.id), '[]'::jsonb),
    'medicos', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', m.id, 'especialidade', m.especialidade, 'nome', m.nome,
               'telefone_e164', m.telefone_e164, 'email', m.email, 'hospital', m.hospital)
             order by m.especialidade, m.nome, m.id)
      from public.medico m where m.familia_id = v_familia.id), '[]'::jsonb),
    'acompanhamentos', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', a.id, 'dias_contratados', a.dias_contratados, 'horas_por_visita', a.horas_por_visita,
               'periodo', a.periodo, 'inicio_efetivo', a.inicio_efetivo, 'encerramento', a.encerramento,
               'estado', a.estado))
      from assistencial.ler_acompanhamento(v_familia.id) a), '[]'::jsonb)
  );

  if v_coord then
    v_ficha := pg_catalog.jsonb_set(v_ficha, '{familia,historico_sensivel}', pg_catalog.to_jsonb(v_familia.historico_sensivel));
  end if;

  return v_ficha;
end;
$$;
comment on function api.ficha_assistencial(uuid) is 'Ficha assistencial da família (PRD 13): endereço de atendimento, nomes, contatos, datas, bebês, médicos e acompanhamentos, sem nada comercial; historico_sensivel só para coordenação e diretoria. Enfermeira só em família atribuída. AAL2. Grava a leitura no log antes de devolver. ADR 0002 seção 5.';

-- --- api.dados_contrato ----------------------------------------------------------------------
-- Única leitura de pessoa_dados_contrato (PRD 13 [v4.2]). Comercial,
-- financeiro e diretoria.
--   completo = false: CPF mascarado (***.456.789-**), endereço sem numero e
--     sem complemento, sem data de nascimento. AAL2 só pela regra do perfil.
--   completo = true: tudo, com AAL2 obrigatório.
-- Nos dois modos grava 'leitura' no log (o PRD exige no completo; no
-- mascarado é a leitura mais restritiva, ADR 0002).
create function api.dados_contrato(pessoa_id uuid, completo boolean default false)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_completo boolean := coalesce(dados_contrato.completo, false);
  v_dados    public.pessoa_dados_contrato;
  v_digitos  text;
  v_endereco jsonb;
begin
  perform privado.autorizar(array['comercial', 'financeiro', 'diretoria']::public.papel_usuario[], v_completo);

  select d.* into v_dados from public.pessoa_dados_contrato d where d.pessoa_id = dados_contrato.pessoa_id;
  if not found then
    return null;
  end if;

  perform privado.registrar_leitura(
    'pessoa_dados_contrato',
    dados_contrato.pessoa_id::text,
    pg_catalog.jsonb_build_object('funcao', 'api.dados_contrato', 'completo', v_completo));

  if v_completo then
    return pg_catalog.jsonb_build_object(
      'pessoa_id', v_dados.pessoa_id,
      'completo', true,
      'cpf', v_dados.cpf,
      'data_nascimento', v_dados.data_nascimento,
      'endereco_residencial', v_dados.endereco_residencial,
      'preenchido_via', v_dados.preenchido_via);
  end if;

  v_digitos := pg_catalog.regexp_replace(coalesce(v_dados.cpf, ''), '[^0-9]', '', 'g');
  if pg_catalog.jsonb_typeof(v_dados.endereco_residencial) = 'object' then
    v_endereco := v_dados.endereco_residencial - 'numero' - 'complemento';
  end if;

  return pg_catalog.jsonb_build_object(
    'pessoa_id', v_dados.pessoa_id,
    'completo', false,
    'cpf', case
             when v_dados.cpf is null then null
             when pg_catalog.length(v_digitos) = 11
               then '***.' || pg_catalog.substr(v_digitos, 4, 3) || '.' || pg_catalog.substr(v_digitos, 7, 3) || '-**'
             else '***.***.***-**'
           end,
    'data_nascimento', null,
    'endereco_residencial', v_endereco,
    'preenchido_via', v_dados.preenchido_via);
end;
$$;
comment on function api.dados_contrato(uuid, boolean) is 'Única leitura de pessoa_dados_contrato (PRD 13 [v4.2]): comercial, financeiro e diretoria. completo = false devolve CPF ***.456.789-** e endereço sem número; true exige AAL2 e devolve tudo. Grava leitura no log nos dois modos. ADR 0002 seção 5.';

-- --- api.status_cobranca --------------------------------------------------------------------
-- "Cobrança e NFS-e: comercial Parcial (status)" (PRD 13). Só status,
-- parcela, vencimento e data de pagamento, e o status da nota mais recente
-- de cada cobrança. Comercial, financeiro e diretoria, AAL2 (financeiro).
create function api.status_cobranca(familia_id uuid)
  returns table (
    cobranca_id uuid,
    contrato_id uuid,
    parcela     integer,
    vencimento  date,
    status      public.status_cobranca,
    pago_em     timestamptz,
    nota_status public.status_nota
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'financeiro', 'diretoria']::public.papel_usuario[], true);

  return query
    select c.id, c.contrato_id, c.parcela, c.vencimento, c.status, c.pago_em, n.status
    from public.cobranca c
    join public.contrato k on k.id = c.contrato_id
    left join lateral (
      select nf.status from public.nota_fiscal nf
      where nf.cobranca_id = c.id
      order by nf.criado_em desc, nf.id desc
      limit 1
    ) n on true
    where k.familia_id = status_cobranca.familia_id
    order by c.vencimento, c.parcela, c.id;
end;
$$;
comment on function api.status_cobranca(uuid) is 'Status das cobranças e notas de uma família, sem valores nem links (PRD 13, comercial "Parcial (status)"). Comercial, financeiro e diretoria, AAL2. ADR 0002 seção 5.';

-- --- api.sessao_venda_gravacao ---------------------------------------------------------------
-- Única leitura da sessão gravada (PRD 6.10 regra 6, 13): quem conduziu a
-- sessão (comercial ou coordenação) e a diretoria, AAL2, com log.
create function api.sessao_venda_gravacao(sessao_id uuid)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_conduzida_por uuid;
  v_gravacao      public.sessao_venda_gravacao;
begin
  perform privado.autorizar(array['comercial', 'coordenacao', 'diretoria']::public.papel_usuario[], true);

  select s.conduzida_por into v_conduzida_por
  from public.sessao_venda s where s.id = sessao_venda_gravacao.sessao_id;
  if not found then
    raise exception 'api.sessao_venda_gravacao: sessão % não existe', sessao_venda_gravacao.sessao_id
      using errcode = 'P0002';
  end if;

  if not privado.tem_papel('diretoria') and v_conduzida_por is distinct from auth.uid() then
    raise exception 'api.sessao_venda_gravacao: só quem conduziu a sessão e a diretoria (PRD 13)'
      using errcode = '42501';
  end if;

  select g.* into v_gravacao from public.sessao_venda_gravacao g where g.sessao_id = sessao_venda_gravacao.sessao_id;
  if not found then
    return null;
  end if;

  perform privado.registrar_leitura(
    'sessao_venda_gravacao',
    v_gravacao.id::text,
    pg_catalog.jsonb_build_object('funcao', 'api.sessao_venda_gravacao', 'sessao_id', sessao_venda_gravacao.sessao_id));

  return pg_catalog.jsonb_build_object(
    'id', v_gravacao.id,
    'sessao_id', v_gravacao.sessao_id,
    'consentimento_gravacao', v_gravacao.consentimento_gravacao,
    'consentimento_versao', v_gravacao.consentimento_versao,
    'consentimento_em', v_gravacao.consentimento_em,
    'gravacao_path', v_gravacao.gravacao_path,
    'transcricao', v_gravacao.transcricao,
    'resumo', v_gravacao.resumo);
end;
$$;
comment on function api.sessao_venda_gravacao(uuid) is 'Única leitura de sessao_venda_gravacao (PRD 6.10 regra 6, 13): quem conduziu e a diretoria, AAL2, grava leitura no log. ADR 0002 seção 5.';

-- --- api.status_equipe -----------------------------------------------------------------------
-- Semana da equipe (PRD 6.5, 20.6): estado calculado de cada profissional em
-- cada dia da semana (segunda a domingo) que contém "semana". Coordenação e
-- diretoria: as profissionais ativas da região (todas, com regiao_id nulo).
-- Enfermeira: só a própria (20.6: "a enfermeira vê só o próprio estado").
create function api.status_equipe(regiao_id uuid default null, semana date default null)
  returns table (
    profissional_id uuid,
    nome            text,
    dia             date,
    status          public.status_profissional
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_inicio date := pg_catalog.date_trunc(
                     'week',
                     coalesce(status_equipe.semana, (pg_catalog.now() at time zone 'America/Sao_Paulo')::date))::date;
  v_todas  boolean;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  v_todas := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');

  return query
    select pr.id, pr.nome, d.dia, privado.status_profissional(pr.id, d.dia)
    from public.profissional pr
    cross join lateral (
      select (v_inicio + g.n)::date as dia from pg_catalog.generate_series(0, 6) as g(n)
    ) d
    where pr.ativa
      and (case
             when v_todas then status_equipe.regiao_id is null or status_equipe.regiao_id = any (pr.regioes)
             else pr.usuario_id = auth.uid()
           end)
    order by pr.nome, pr.id, d.dia;
end;
$$;
comment on function api.status_equipe(uuid, date) is 'Estado calculado de cada profissional nos 7 dias da semana (PRD 6.5, 20.6, O-08), por privado.status_profissional. Coordenação e diretoria: profissionais ativas da região; enfermeira: só a própria. AAL2. ADR 0002 seção 5.';

-- --- api.marketing_* -------------------------------------------------------------------------
-- Agregados para o marketing (PRD 13): nunca a tabela familia, só a view
-- familia_elegivel_marketing (6.9), que já tira estado sensível,
-- nao_contatar e famílias mescladas. Só contagens, nenhum dado pessoal.
-- Marketing e diretoria; período pela data de entrada do lead (fuso da
-- operação), limites nulos = sem limite.
create function api.marketing_leads_por_origem(desde date default null, ate date default null)
  returns table (
    origem       public.origem_lead,
    leads        bigint,
    qualificados bigint,
    ganhos       bigint
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['marketing', 'diretoria']::public.papel_usuario[], false);

  return query
    select f.origem,
           pg_catalog.count(*),
           pg_catalog.count(*) filter (where o.qualificado),
           pg_catalog.count(*) filter (where o.ganho)
    from public.familia_elegivel_marketing f
    left join lateral (
      select pg_catalog.bool_or(op.estagio_p2 is not null
                                or op.estagio_p1 in ('qualificado', 'sessao_venda_agendada', 'sessao_venda_realizada')) as qualificado,
             pg_catalog.bool_or(op.estagio_p2 is not null
                                and op.estagio_p2 not in ('proposta_enviada', 'em_negociacao', 'perdido', 'cancelado', 'distrato')) as ganho
      from public.oportunidade op
      where op.familia_id = f.id
    ) o on true
    where (marketing_leads_por_origem.desde is null
           or (f.criado_em at time zone 'America/Sao_Paulo')::date >= marketing_leads_por_origem.desde)
      and (marketing_leads_por_origem.ate is null
           or (f.criado_em at time zone 'America/Sao_Paulo')::date <= marketing_leads_por_origem.ate)
    group by f.origem
    order by f.origem;
end;
$$;
comment on function api.marketing_leads_por_origem(date, date) is 'Agregado de marketing (PRD 13): por origem, leads, qualificados e ganhos. Lê só familia_elegivel_marketing (6.9). Marketing e diretoria. ADR 0002 seção 5.';

create function api.marketing_funil(desde date default null, ate date default null)
  returns table (
    pipeline      integer,
    estagio       text,
    oportunidades bigint
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['marketing', 'diretoria']::public.papel_usuario[], false);

  return query
    select op.pipeline,
           coalesce(op.estagio_p2::text, op.estagio_p1::text),
           pg_catalog.count(*)
    from public.familia_elegivel_marketing f
    join public.oportunidade op on op.familia_id = f.id
    where (marketing_funil.desde is null
           or (f.criado_em at time zone 'America/Sao_Paulo')::date >= marketing_funil.desde)
      and (marketing_funil.ate is null
           or (f.criado_em at time zone 'America/Sao_Paulo')::date <= marketing_funil.ate)
    group by op.pipeline, coalesce(op.estagio_p2::text, op.estagio_p1::text)
    order by op.pipeline, 2;
end;
$$;
comment on function api.marketing_funil(date, date) is 'Agregado de marketing (PRD 13): oportunidades por pipeline e estágio. Lê só familia_elegivel_marketing (6.9). Marketing e diretoria. ADR 0002 seção 5.';

-- --- api.lead_origem --------------------------------------------------------------------------
-- "Lead e origem" (PRD 13): Total só para o comercial e a diretoria. As
-- colunas de origem saíram do grant de familia (seção 5.2), porque o
-- financeiro e a coordenação leem a mesma linha. familias nulo = todas (lista
-- de leads do comercial). Sem log: não é dado assistencial nem de contrato.
create function api.lead_origem(familias uuid[] default null)
  returns table (
    familia_id           uuid,
    origem               public.origem_lead,
    codigo_origem        text,
    utm                  jsonb,
    indicacao_medico_id  uuid,
    indicacao_familia_id uuid
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['comercial', 'diretoria']::public.papel_usuario[], false);

  return query
    select f.id, f.origem, f.codigo_origem, f.utm, f.indicacao_medico_id, f.indicacao_familia_id
    from public.familia f
    where lead_origem.familias is null or f.id = any (lead_origem.familias)
    order by f.criado_em, f.id;
end;
$$;
comment on function api.lead_origem(uuid[]) is 'Origem do lead (origem, código, UTM e indicação) para o comercial e a diretoria (PRD 13, "Lead e origem"): as colunas ficam fora do grant de familia porque financeiro e coordenação leem a linha. familias nulo = todas. ADR 0002 seção 5.';

-- --- api.log_auditoria ------------------------------------------------------------------------
-- Wrapper de privado.ler_log_auditoria (P05): diretoria, AAL2, a leitura do
-- log vira linha de log.
create function api.log_auditoria(
  entidade    text default null,
  entidade_id text default null,
  desde       timestamptz default null,
  ate         timestamptz default null,
  limite      integer default null
) returns setof public.log_auditoria
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['diretoria']::public.papel_usuario[], true);
  return query
    select * from privado.ler_log_auditoria(
      log_auditoria.entidade, log_auditoria.entidade_id, log_auditoria.desde, log_auditoria.ate, log_auditoria.limite);
end;
$$;
comment on function api.log_auditoria(text, text, timestamptz, timestamptz, integer) is 'Leitura do log de auditoria pela diretoria com AAL2 (PRD 13), por privado.ler_log_auditoria, que grava a própria leitura. ADR 0002 seção 5.';


-- =============================================================================
-- 7.1 Execute das funções novas
--
-- Auxiliares de privado desta migration: nenhum grant (só rodam dentro de
-- função security definer). api: só authenticated, e só a lista do ADR 0002
-- seção 6.
-- =============================================================================

revoke execute on function privado.perfil_exige_mfa() from public, anon, authenticated, service_role;
revoke execute on function privado.autorizar(public.papel_usuario[], boolean) from public, anon, authenticated, service_role;
revoke execute on function privado.status_profissional(uuid, date) from public, anon, authenticated, service_role;

revoke execute on all functions in schema api from public, anon, service_role;

grant execute on function api.transicionar(text, uuid, text, text)                              to authenticated;
grant execute on function api.familias_do_dia(date)                                             to authenticated;
grant execute on function api.ficha_assistencial(uuid)                                          to authenticated;
grant execute on function api.dados_contrato(uuid, boolean)                                     to authenticated;
grant execute on function api.status_cobranca(uuid)                                             to authenticated;
grant execute on function api.sessao_venda_gravacao(uuid)                                       to authenticated;
grant execute on function api.status_equipe(uuid, date)                                         to authenticated;
grant execute on function api.marketing_leads_por_origem(date, date)                            to authenticated;
grant execute on function api.marketing_funil(date, date)                                       to authenticated;
grant execute on function api.lead_origem(uuid[])                                               to authenticated;
grant execute on function api.log_auditoria(text, text, timestamptz, timestamptz, integer)      to authenticated;


-- =============================================================================
-- 8. Travas de revisão (falham a migration se a regra quebrar)
-- =============================================================================

do $$
declare
  v_lista text;
begin
  -- RLS ligada em toda tabela dos schemas do projeto (PRD 6.10 regra 6).
  select string_agg(n.nspname || '.' || c.relname, ', ')
    into v_lista
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname in ('public', 'agente', 'agente_n8n', 'privado')
    and not c.relrowsecurity;
  if v_lista is not null then
    raise exception 'tabela sem RLS: %', v_lista;
  end if;

  -- anon não executa nenhuma função dos schemas do projeto (PRD 11.10).
  select string_agg(n.nspname || '.' || p.proname, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'api')
    and has_function_privilege('anon', p.oid, 'execute');
  if v_lista is not null then
    raise exception 'anon executa função do projeto: %', v_lista;
  end if;

  -- anon não tem privilégio em tabela, view ou sequência do projeto.
  select string_agg(n.nspname || '.' || c.relname, ', ')
    into v_lista
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm', 'S')
    and n.nspname in ('public', 'agente', 'agente_n8n', 'privado')
    and case
          when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'usage, select, update')
          else has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
        end;
  if v_lista is not null then
    raise exception 'anon tem privilégio em: %', v_lista;
  end if;
end $$;
