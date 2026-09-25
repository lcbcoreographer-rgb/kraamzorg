-- =============================================================================
-- supabase/tests/006_maquinas_estado.sql
--
-- Aceite do P06 (PROMPTS.md v2), invariante 1 do PRD 16.1: "pgTAP passa por
-- todas as transições permitidas, recusa uma amostra das proibidas, recusa
-- update direto e só deixa sair de intercorrencia com papel de coordenação".
--
--   1. privado.transicao_permitida: contagem por máquina e conferência dos
--      rótulos.
--   2. Todas as transições permitidas, uma a uma, com o papel exigido; as
--      automáticas também sem usuário (sistema); as manuais recusadas sem
--      usuário.
--   3. Regras especiais do capítulo 7: passagem do P1 para o P2, bebe_nasceu
--      depois do pagamento, reabertura, pausas que voltam só ao estado
--      anterior.
--   4. Amostra de transições proibidas.
--   5. Papel: saída de intercorrencia só com coordenação; demais papéis.
--   6. privado.tem_papel.
--   7. Update e insert diretos recusados fora de privado.transicionar.
--   8. evento_familia e log_auditoria de cada transição.
--
-- O JWT simulado vai em request.jwt.claims sem trocar de papel: o que se
-- testa é a função security definer (o P07 é que concede execute a
-- authenticated pelos wrappers de api). Só dado sintético, desfeito no fim.
-- =============================================================================

begin;

select plan(76);


-- -----------------------------------------------------------------------------
-- Dados sintéticos e funções auxiliares do teste (pg_temp, somem no fim)
-- -----------------------------------------------------------------------------

create temp table usuarios_p06 (papel text primary key, id uuid not null) on commit drop;
create temp table fixos_p06 (chave text primary key, id uuid not null) on commit drop;

do $$
declare
  v_papel     text;
  v_id        uuid;
  v_n         integer := 0;
  v_familia   uuid;
  v_pacote    uuid;
  v_versao    uuid;
  v_contrato  uuid;
  v_prof      uuid;
begin
  -- um usuário por papel, mais um com todos, um desativado e um sem papel
  foreach v_papel in array array['comercial','enfermeira','financeiro','marketing','coordenacao','diretoria',
                                 'todos','inativo','sem_papel'] loop
    v_n := v_n + 1;
    v_id := ('00000000-0000-0000-0006-' || lpad(v_n::text, 12, '0'))::uuid;
    insert into auth.users (id, email) values (v_id, v_papel || '.p06@exemplo.invalid');
    insert into perfil (id, nome, email, ativo)
      values (v_id, 'Perfil Sintético P06 ' || v_papel, v_papel || '.p06@exemplo.invalid', v_papel <> 'inativo');
    if v_papel = 'todos' then
      insert into usuario_papel (usuario_id, papel) select v_id, p from unnest(enum_range(null::papel_usuario)) p;
    elsif v_papel = 'inativo' then
      insert into usuario_papel (usuario_id, papel) values (v_id, 'coordenacao');
    elsif v_papel <> 'sem_papel' then
      insert into usuario_papel (usuario_id, papel) values (v_id, v_papel::papel_usuario);
    end if;
    insert into usuarios_p06 values (v_papel, v_id);
  end loop;

  insert into familia (nome_exibicao) values ('Família Sintética P06 base') returning id into v_familia;
  insert into pacote (nome, dias) values ('Pacote Sintético P06', 6) returning id into v_pacote;
  insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
    values (v_pacote, 100, 6, '2026-01-01') returning id into v_versao;
  insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao)
    values (v_familia, v_versao, 100, 'teste') returning id into v_contrato;
  insert into profissional (nome, funcao) values ('Profissional Sintética P06', 'enfermeira_obstetrica') returning id into v_prof;

  insert into fixos_p06 values ('familia', v_familia), ('contrato', v_contrato), ('profissional', v_prof);
end $$;

create function pg_temp.usuario(papel text) returns uuid
  language sql stable
  as $$ select id from usuarios_p06 where usuarios_p06.papel = usuario.papel $$;

create function pg_temp.fixo(chave text) returns uuid
  language sql stable
  as $$ select id from fixos_p06 where fixos_p06.chave = fixo.chave $$;

-- JWT simulado de um usuário (sem trocar de papel)
create function pg_temp.como(papel text, aal text default 'aal2') returns void
  language sql
  as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', pg_temp.usuario(papel), 'role', 'authenticated', 'aal', aal)::text, true);
$$;

-- sem JWT: chamada de sistema (cron, webhook, agente)
create function pg_temp.sistema() returns void
  language sql
  as $$ select set_config('request.jwt.claims', '', true); $$;

create function pg_temp.definir(chave text, valor text) returns void
  language sql
  as $$ select set_config(chave, valor, true); $$;

-- Cria, como dono (postgres), uma entidade já no estado pedido.
create function pg_temp.criar(maquina text, estado text) returns uuid
  language plpgsql
  as $$
declare
  v_familia uuid;
  v_acomp   uuid;
  v_id      uuid;
begin
  if maquina in ('p1', 'p2') then
    insert into familia (nome_exibicao) values ('Família Sintética P06') returning id into v_familia;
    if maquina = 'p2' and privado.rotulo_existe('public.estagio_p2'::regtype, estado) then
      insert into oportunidade (familia_id, pipeline, estagio_p1, estagio_p2)
        values (v_familia, 2, 'qualificado', estado::estagio_p2) returning id into v_id;
    else
      insert into oportunidade (familia_id, pipeline, estagio_p1)
        values (v_familia, 1, estado::estagio_p1) returning id into v_id;
    end if;
    return v_id;
  end if;

  insert into acompanhamento (contrato_id, familia_id, dias_contratados, horas_por_visita, estado)
    values (pg_temp.fixo('contrato'), pg_temp.fixo('familia'), 6, 6,
            case when maquina = 'acompanhamento' then estado else 'ativo' end::estado_acompanhamento)
    returning id into v_acomp;
  if maquina = 'acompanhamento' then
    return v_acomp;
  elsif maquina = 'visita' then
    insert into visita (acompanhamento_id, profissional_id, dia_numero, data, estado)
      values (v_acomp, pg_temp.fixo('profissional'), 1, '2026-12-10', estado::estado_visita) returning id into v_id;
  else
    insert into pos_venda (acompanhamento_id, estagio) values (v_acomp, estado::estagio_p4) returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function pg_temp.estado(maquina text, entidade uuid) returns text
  language sql stable
  as $$
  select case maquina
    when 'p1' then (select estagio_p1::text from oportunidade where id = entidade)
    when 'p2' then (select estagio_p2::text from oportunidade where id = entidade)
    when 'acompanhamento' then (select estado::text from acompanhamento where id = entidade)
    when 'visita' then (select estado::text from visita where id = entidade)
    when 'p4' then (select estagio::text from pos_venda where id = entidade)
  end
$$;

-- Leva uma entidade nova ao estado "de" e pede a transição para "para".
-- quem = papel do usuário (null = sistema). Nas saídas de pausa que voltam
-- ao estado anterior, a entidade nasce em "para" e entra na pausa pela
-- própria função (com o usuário "todos"), para a linha do tempo ter o
-- estado anterior. Devolve null se deu certo, ou o erro.
create function pg_temp.testar(maquina text, de text, para text, quem text) returns text
  language plpgsql
  as $$
declare
  v_id uuid;
begin
  if de in ('intercorrencia', 'suspenso') and para not in ('intercorrencia', 'suspenso')
     and exists (select 1 from privado.transicao_permitida x
                 where x.maquina::text = testar.maquina and x.de = testar.para and x.para = testar.de) then
    v_id := pg_temp.criar(maquina, para);
    perform pg_temp.como('todos');
    perform privado.transicionar(maquina::privado.maquina_estado, v_id, de, 'preparo sintético');
  else
    v_id := pg_temp.criar(maquina, de);
  end if;

  if quem is null then
    perform pg_temp.sistema();
  else
    perform pg_temp.como(quem);
  end if;
  perform privado.transicionar(maquina::privado.maquina_estado, v_id, para, 'motivo sintético');
  perform pg_temp.sistema();

  if pg_temp.estado(maquina, v_id) is distinct from para then
    return format('%s %s -> %s: estado ficou %s', maquina, de, para, pg_temp.estado(maquina, v_id));
  end if;
  if not exists (select 1 from evento_familia e
                  where e.tipo = 'estagio' and e.dados ->> 'entidade_id' = v_id::text
                    and e.dados ->> 'de' = de and e.dados ->> 'para' = para) then
    return format('%s %s -> %s: sem evento_familia', maquina, de, para);
  end if;
  if not exists (select 1 from log_auditoria l
                  where l.acao = 'transicao' and l.entidade_id = v_id::text
                    and l.valor_antes ->> 'estado' = de and l.valor_depois ->> 'estado' = para) then
    return format('%s %s -> %s: sem log_auditoria', maquina, de, para);
  end if;
  return null;
exception
  when others then
    return format('%s %s -> %s: %s', maquina, de, para, sqlerrm);
end;
$$;

-- Cria uma entidade em "de" e tenta ir para "para" com o usuário "quem"
-- (padrão: todos os papéis), deixando o erro subir (para throws_ok).
create function pg_temp.tentar(maquina text, de text, para text, quem text default 'todos', motivo text default 'motivo sintético')
  returns void
  language plpgsql
  as $$
declare
  v_id uuid := pg_temp.criar(maquina, de);
begin
  perform pg_temp.como(quem);
  perform privado.transicionar(maquina::privado.maquina_estado, v_id, para, motivo);
end;
$$;


-- =============================================================================
-- 1. Tabela de transições
-- =============================================================================

select results_eq(
  $$ select maquina::text, count(*)::integer from privado.transicao_permitida group by maquina order by 1 $$,
  $$ values ('acompanhamento', 29), ('p1', 22), ('p2', 69), ('p4', 5), ('visita', 22) $$,
  'transicao_permitida: 22 transições no p1, 69 no p2, 29 no acompanhamento, 22 na visita e 5 no p4');

select ok(
  (select relrowsecurity from pg_class where oid = 'privado.transicao_permitida'::regclass)
  and not has_table_privilege('authenticated', 'privado.transicao_permitida', 'select, insert, update, delete')
  and not has_table_privilege('service_role', 'privado.transicao_permitida', 'select, insert, update, delete'),
  'transicao_permitida tem RLS ligada e nenhum papel da aplicação lê ou muda a tabela');

select throws_ok($s$ insert into privado.transicao_permitida (maquina, de, para) values ('p1', 'novo', 'ganho') $s$,
  '22023', null, 'transicao_permitida recusa rótulo que não é do enum da máquina (ganho não é estado do p1)');
select throws_ok($s$ insert into privado.transicao_permitida (maquina, de, para) values ('p2', 'perdido', 'proposta_enviada') $s$,
  '22023', null, 'transicao_permitida recusa origem ambígua na p2 (perdido existe no p1 e no p2)');


-- =============================================================================
-- 2. Todas as transições permitidas (invariante 1)
-- =============================================================================

select is_empty(
  $$ select r from (select pg_temp.testar(maquina::text, de, para, coalesce(papel_minimo::text, 'marketing')) r
     from privado.transicao_permitida where maquina = 'p1') s where r is not null $$,
  'p1: todas as transições permitidas passam com o papel exigido, gravando estado, evento e log');
select is_empty(
  $$ select r from (select pg_temp.testar(maquina::text, de, para, coalesce(papel_minimo::text, 'marketing')) r
     from privado.transicao_permitida where maquina = 'p2') s where r is not null $$,
  'p2: todas as transições permitidas passam com o papel exigido (papel nulo: basta ter um papel, aqui marketing)');
select is_empty(
  $$ select r from (select pg_temp.testar(maquina::text, de, para, coalesce(papel_minimo::text, 'marketing')) r
     from privado.transicao_permitida where maquina = 'acompanhamento') s where r is not null $$,
  'acompanhamento: todas as transições permitidas passam com o papel exigido');
select is_empty(
  $$ select r from (select pg_temp.testar(maquina::text, de, para, coalesce(papel_minimo::text, 'marketing')) r
     from privado.transicao_permitida where maquina = 'visita') s where r is not null $$,
  'visita: todas as transições permitidas passam com o papel exigido');
select is_empty(
  $$ select r from (select pg_temp.testar(maquina::text, de, para, coalesce(papel_minimo::text, 'marketing')) r
     from privado.transicao_permitida where maquina = 'p4') s where r is not null $$,
  'p4: todas as transições permitidas passam com o papel exigido');

select is_empty(
  $$ select r from (select pg_temp.testar(maquina::text, de, para, null) r
     from privado.transicao_permitida where automatica) s where r is not null $$,
  'toda transição automática passa sem usuário (sistema: automação, webhook, agente)');
select is_empty(
  $$ select r from (select pg_temp.testar(maquina::text, de, para, null) r
     from privado.transicao_permitida where not automatica) s
     where r is null or r not like '%não é automática%' $$,
  'toda transição manual é recusada sem usuário identificado');


-- =============================================================================
-- 3. Regras especiais do capítulo 7
-- =============================================================================

-- passagem de qualificado e nutricao direto para proposta_enviada (P2)
do $$
declare
  v_q uuid := pg_temp.criar('p1', 'qualificado');
  v_n uuid := pg_temp.criar('p1', 'nutricao');
begin
  perform pg_temp.como('comercial');
  perform privado.transicionar('p2', v_q, 'proposta_enviada', null);
  perform privado.transicionar('p2', v_n, 'proposta_enviada', null);
  perform pg_temp.sistema();
  insert into fixos_p06 values ('op_qualificado', v_q), ('op_nutricao', v_n);
end $$;
select results_eq(
  $$ select pipeline, estagio_p1::text, estagio_p2::text from oportunidade
     where id in (pg_temp.fixo('op_qualificado'), pg_temp.fixo('op_nutricao')) order by estagio_p1 $$,
  $$ values (2, 'nutricao', 'proposta_enviada'), (2, 'qualificado', 'proposta_enviada') $$,
  'qualificado e nutricao passam direto para P2 proposta_enviada: pipeline 2, estagio_p1 preservado');

select results_eq(
  $$ select de from privado.transicao_permitida
     where maquina = 'p2' and para = 'bebe_nasceu' and de <> 'intercorrencia' order by de $$,
  $$ values ('aguardando_nascimento'), ('consulta_prenatal_agendada'), ('consulta_realizada'),
            ('enfermeira_designada'), ('nota_fiscal_emitida'), ('pagamento_confirmado') $$,
  'bebe_nasceu vem de pagamento_confirmado e de todo estágio depois dele até aguardando_nascimento (fora a volta de intercorrencia)');

select results_eq(
  $$ select de from privado.transicao_permitida where maquina = 'p1' and para = 'em_conversa_ia' and automatica order by de $$,
  $$ values ('fora_de_cobertura'), ('nao_qualificado'), ('novo'), ('nutricao'), ('perdido') $$,
  'perdido, nao_qualificado e fora_de_cobertura reabrem em em_conversa_ia de forma automática (família volta a escrever)');

select is_empty(
  $$ select maquina, de, para from privado.transicao_permitida
     where de = 'intercorrencia' and (papel_minimo is distinct from 'coordenacao' or automatica) $$,
  'toda saída de intercorrencia exige coordenação e nunca é automática');

-- pausas encadeadas: ativo → suspenso → intercorrencia → suspenso → ativo
do $$
declare
  v_a uuid := pg_temp.criar('acompanhamento', 'ativo');
begin
  perform pg_temp.como('coordenacao');
  perform privado.transicionar('acompanhamento', v_a, 'suspenso', 'pausa sintética');
  perform privado.transicionar('acompanhamento', v_a, 'intercorrencia', 'intercorrência sintética');
  perform privado.transicionar('acompanhamento', v_a, 'suspenso', 'coordenação decidiu manter suspenso');
  perform pg_temp.sistema();
  insert into fixos_p06 values ('acomp_pausas', v_a);
end $$;
select pg_temp.como('coordenacao');
select throws_ok(
  $$ select privado.transicionar('acompanhamento', pg_temp.fixo('acomp_pausas'), 'em_execucao', 'retomada sintética') $$,
  '22023', null, 'pausas encadeadas: suspenso não volta para em_execucao se o estado antes das pausas era ativo');
select lives_ok(
  $$ select privado.transicionar('acompanhamento', pg_temp.fixo('acomp_pausas'), 'ativo', 'retomada sintética') $$,
  'pausas encadeadas: suspenso volta para ativo, o estado antes de entrar nas pausas');
select pg_temp.sistema();


-- =============================================================================
-- 4. Amostra de transições proibidas (22023: transição não prevista)
-- =============================================================================

select throws_ok($$ select pg_temp.tentar('p1', 'novo', 'qualificado') $$, '22023', null,
  'proibida: p1 novo → qualificado (pula em_conversa_ia)');
select throws_ok($$ select pg_temp.tentar('p1', 'novo', 'sessao_venda_realizada') $$, '22023', null,
  'proibida: p1 novo → sessao_venda_realizada');
select throws_ok($$ select pg_temp.tentar('p1', 'sessao_venda_realizada', 'perdido') $$, '22023', null,
  'proibida: p1 sessao_venda_realizada → perdido (depois da sessão o caminho é o P2)');
select throws_ok($$ select pg_temp.tentar('p1', 'nao_qualificado', 'qualificado') $$, '22023', null,
  'proibida: p1 nao_qualificado → qualificado (reabre só em em_conversa_ia)');
select throws_ok($$ select pg_temp.tentar('p2', 'em_conversa_ia', 'proposta_enviada') $$, '22023', null,
  'proibida: P1 em_conversa_ia → P2 proposta_enviada (só qualificado, nutricao ou sessao_venda_realizada passam)');
select throws_ok($$ select pg_temp.tentar('p2', 'proposta_enviada', 'ganho') $$, '22023', null,
  'proibida: p2 proposta_enviada → ganho (pula em_negociacao)');
select throws_ok($$ select pg_temp.tentar('p2', 'perdido', 'proposta_enviada') $$, '22023', null,
  'proibida: p2 perdido → proposta_enviada (perdido não reabre no P2)');
select throws_ok($$ select pg_temp.tentar('p2', 'em_negociacao', 'bebe_nasceu') $$, '22023', null,
  'proibida: p2 em_negociacao → bebe_nasceu (antes do pagamento)');
select throws_ok($$ select pg_temp.tentar('p2', 'aguardando_alta', 'bebe_nasceu') $$, '22023', null,
  'proibida: p2 aguardando_alta → bebe_nasceu (volta)');
select throws_ok($$ select pg_temp.tentar('p2', 'atendimento_liberado', 'intercorrencia') $$, '22023', null,
  'proibida: p2 atendimento_liberado → intercorrencia (o P3 assume)');
select throws_ok($$ select pg_temp.tentar('acompanhamento', 'encerrado', 'ativo') $$, '22023', null,
  'proibida: acompanhamento encerrado → ativo');
select throws_ok($$ select pg_temp.tentar('acompanhamento', 'ativo', 'encerrado') $$, '22023', null,
  'proibida: acompanhamento ativo → encerrado (pula execução e pendências)');
select throws_ok($$ select pg_temp.tentar('visita', 'concluida', 'agendada') $$, '22023', null,
  'proibida: visita concluida → agendada');
select throws_ok($$ select pg_temp.tentar('visita', 'cancelada', 'agendada') $$, '22023', null,
  'proibida: visita cancelada → agendada');
select throws_ok($$ select pg_temp.tentar('p4', 'pesquisa_enviada', 'classificado') $$, '22023', null,
  'proibida: p4 pesquisa_enviada → classificado (pula a resposta)');
select throws_ok($$ select pg_temp.tentar('p4', 'arquivado', 'pesquisa_enviada') $$, '22023', null,
  'proibida: p4 arquivado → pesquisa_enviada');
select throws_ok($$ select pg_temp.tentar('p1', 'novo', 'xyz') $$, '22023', null,
  'proibida: destino que não é estado da máquina');

select pg_temp.como('todos');
select throws_ok(
  $$ select privado.transicionar('p1', pg_temp.fixo('op_qualificado'), 'nutricao', null) $$, '22023', null,
  'oportunidade que já está no P2 não anda mais no P1');
select pg_temp.sistema();


-- =============================================================================
-- 5. Papel (PRD 7.2 e 13)
-- =============================================================================

do $$
declare
  v_op uuid := pg_temp.criar('p2', 'aguardando_nascimento');
  v_ac uuid := pg_temp.criar('acompanhamento', 'em_execucao');
begin
  perform pg_temp.como('enfermeira');   -- papel nulo: qualquer papel ativo entra em intercorrencia
  perform privado.transicionar('p2', v_op, 'intercorrencia', 'intercorrência sintética');
  perform privado.transicionar('acompanhamento', v_ac, 'intercorrencia', 'intercorrência sintética');
  perform pg_temp.sistema();
  insert into fixos_p06 values ('op_intercorrencia', v_op), ('acomp_intercorrencia', v_ac);
end $$;

select pg_temp.como('comercial');
select throws_ok(
  $$ select privado.transicionar('p2', pg_temp.fixo('op_intercorrencia'), 'aguardando_nascimento', 'decisão sintética') $$,
  '42501', null, 'intercorrencia: comercial não tira a oportunidade de intercorrencia');
select pg_temp.como('diretoria');
select throws_ok(
  $$ select privado.transicionar('p2', pg_temp.fixo('op_intercorrencia'), 'aguardando_nascimento', 'decisão sintética') $$,
  '42501', null, 'intercorrencia: diretoria sem papel de coordenação também não tira (só coordenação, PRD 7.2)');
select throws_ok(
  $$ select privado.transicionar('acompanhamento', pg_temp.fixo('acomp_intercorrencia'), 'em_execucao', 'decisão sintética') $$,
  '42501', null, 'intercorrencia: diretoria sem coordenação não tira o acompanhamento de intercorrencia');
select pg_temp.como('coordenacao');
select throws_ok(
  $$ select privado.transicionar('p2', pg_temp.fixo('op_intercorrencia'), 'aguardando_nascimento', null) $$,
  '22023', null, 'intercorrencia: coordenação precisa informar o motivo para sair');
select throws_ok(
  $$ select privado.transicionar('p2', pg_temp.fixo('op_intercorrencia'), 'enfermeira_designada', 'decisão sintética') $$,
  '22023', null, 'intercorrencia: coordenação só volta ao estágio anterior (aguardando_nascimento), não a outro');
select lives_ok(
  $$ select privado.transicionar('p2', pg_temp.fixo('op_intercorrencia'), 'aguardando_nascimento', 'decisão sintética') $$,
  'intercorrencia: coordenação volta ao estágio anterior com motivo');
select pg_temp.sistema();
select is(pg_temp.estado('p2', pg_temp.fixo('op_intercorrencia')), 'aguardando_nascimento',
  'intercorrencia: a oportunidade volta para aguardando_nascimento');

select pg_temp.como('inativo');
select throws_ok(
  $$ select privado.transicionar('acompanhamento', pg_temp.fixo('acomp_intercorrencia'), 'em_execucao', 'decisão sintética') $$,
  '42501', null, 'perfil desativado com papel de coordenação não transiciona');
select pg_temp.como('sem_papel');
select throws_ok($$ select pg_temp.tentar('acompanhamento', 'ativo', 'intercorrencia', 'sem_papel') $$,
  '42501', null, 'usuário sem nenhum papel não entra em intercorrencia (papel nulo exige algum papel ativo)');
select throws_ok($$ select pg_temp.tentar('p1', 'novo', 'em_conversa_ia', 'enfermeira') $$,
  '42501', null, 'enfermeira não move o pipeline 1');
select throws_ok($$ select pg_temp.tentar('p2', 'assinado', 'distrato', 'comercial') $$,
  '42501', null, 'comercial não faz distrato (diretoria)');
select lives_ok($$ select pg_temp.tentar('visita', 'agendada', 'confirmada', 'coordenacao') $$,
  'coordenação faz a transição de visita que exige enfermeira (coordenação cobre enfermeira)');
select lives_ok($$ select pg_temp.tentar('p2', 'proposta_enviada', 'em_negociacao', 'diretoria') $$,
  'diretoria faz a transição comercial (diretoria cobre os papéis, menos a saída de intercorrencia)');
select pg_temp.sistema();

select pg_temp.definir('request.jwt.claims', '{"role":"anon"}');
select throws_ok($$ select privado.transicionar('p1', pg_temp.criar('p1', 'novo'), 'em_conversa_ia', null) $$,
  '42501', null, 'requisição anônima nunca conta como sistema, nem para transição automática');
select pg_temp.sistema();

select ok(
  not has_function_privilege('anon', 'privado.transicionar(privado.maquina_estado, uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'privado.transicionar(privado.maquina_estado, uuid, text, text)', 'execute')
  and not has_function_privilege('service_role', 'privado.transicionar(privado.maquina_estado, uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'privado.tem_papel(papel_usuario)', 'execute'),
  'nenhum papel da aplicação executa transicionar direto; anon não executa tem_papel (grants no P07)');


-- =============================================================================
-- 6. privado.tem_papel
-- =============================================================================

select ok(
  (select p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=""']
     from pg_proc p where p.oid = 'privado.tem_papel(papel_usuario)'::regprocedure),
  'tem_papel é security definer, stable e com search_path vazio');

select pg_temp.como('comercial');
select results_eq(
  $$ select privado.tem_papel('comercial'), privado.tem_papel('diretoria') $$,
  $$ values (true, false) $$,
  'tem_papel: verdadeiro para o papel do usuário, falso para outro');
select pg_temp.como('inativo');
select is(privado.tem_papel('coordenacao'), false, 'tem_papel: perfil desativado perde o papel na hora');
select pg_temp.sistema();
select is(privado.tem_papel('diretoria'), false, 'tem_papel: sem usuário identificado é falso');


-- =============================================================================
-- 7. Update e insert diretos recusados (P06 item 4)
-- =============================================================================

do $$
begin
  insert into fixos_p06 values
    ('op_direto', pg_temp.criar('p1', 'novo')),
    ('op_direto_p2', pg_temp.criar('p2', 'proposta_enviada')),
    ('acomp_direto', pg_temp.criar('acompanhamento', 'ativo')),
    ('visita_direto', pg_temp.criar('visita', 'agendada')),
    ('posvenda_direto', pg_temp.criar('p4', 'protocolo_ultimo_dia_concluido'));
end $$;

select throws_ok($$ update oportunidade set estagio_p1 = 'qualificado' where id = pg_temp.fixo('op_direto') $$,
  '42501', null, 'update direto de oportunidade.estagio_p1 é recusado, mesmo como postgres');
select throws_ok($$ update oportunidade set estagio_p2 = 'ganho' where id = pg_temp.fixo('op_direto_p2') $$,
  '42501', null, 'update direto de oportunidade.estagio_p2 é recusado');
select throws_ok($$ update oportunidade set pipeline = 2 where id = pg_temp.fixo('op_direto') $$,
  '42501', null, 'update direto de oportunidade.pipeline é recusado');
select throws_ok($$ update acompanhamento set estado = 'em_execucao' where id = pg_temp.fixo('acomp_direto') $$,
  '42501', null, 'update direto de acompanhamento.estado é recusado');
select throws_ok($$ update visita set estado = 'confirmada' where id = pg_temp.fixo('visita_direto') $$,
  '42501', null, 'update direto de visita.estado é recusado');
select throws_ok($$ update pos_venda set estagio = 'pesquisa_enviada' where id = pg_temp.fixo('posvenda_direto') $$,
  '42501', null, 'update direto de pos_venda.estagio é recusado');

select pg_temp.definir('app.transicao', 'p1:' || pg_temp.fixo('op_direto_p2') || ':em_conversa_ia');
select throws_ok($$ update oportunidade set estagio_p1 = 'em_conversa_ia' where id = pg_temp.fixo('op_direto') $$,
  '42501', null, 'app.transicao com a marca de outra entidade não libera o update');
select pg_temp.definir('app.transicao', 'p1:' || pg_temp.fixo('op_direto') || ':em_conversa_ia');
-- como service_role, o id vem de variável de sessão: o papel não lê a tabela
-- temporária nem executa as funções pg_temp do dono (o erro seria outro)
select pg_temp.definir('testes.op_direto', pg_temp.fixo('op_direto')::text);
select testes.autenticar_service_role();
select throws_ok(
  format($s$ update oportunidade set estagio_p1 = 'em_conversa_ia' where id = %L $s$, current_setting('testes.op_direto')),
  '42501', 'oportunidade.estagio_p1 só muda por privado.transicionar (PRD 7, invariante 1)',
  'service_role com a marca certa forjada em app.transicao continua recusado (não é a função)');
select testes.encerrar();
select pg_temp.definir('app.transicao', '');

select pg_temp.como('comercial');
select lives_ok($$ select privado.transicionar('p1', pg_temp.fixo('op_direto'), 'em_conversa_ia', null) $$,
  'a mesma mudança pela função passa');
select pg_temp.sistema();
select is(current_setting('app.transicao', true), '', 'app.transicao fica desligada depois da função');
select throws_ok($$ update oportunidade set estagio_p1 = 'qualificado' where id = pg_temp.fixo('op_direto') $$,
  '42501', null, 'na mesma transação, depois da função, o update direto continua recusado');
select lives_ok($$ update oportunidade set score = 55 where id = pg_temp.fixo('op_direto') $$,
  'update de coluna que não é estágio segue normal');

select pg_temp.definir('testes.familia', pg_temp.fixo('familia')::text);
select pg_temp.definir('testes.contrato', pg_temp.fixo('contrato')::text);
select pg_temp.definir('testes.profissional', pg_temp.fixo('profissional')::text);
select pg_temp.definir('testes.acomp_direto', pg_temp.fixo('acomp_direto')::text);
select testes.autenticar_service_role();
select throws_ok(
  format($s$ insert into oportunidade (familia_id, pipeline, estagio_p1, estagio_p2) values (%L, 2, 'qualificado', 'ganho') $s$,
         current_setting('testes.familia')),
  '42501', 'oportunidade: nasce em pipeline 1, estagio_p1 novo e sem estagio_p2; o resto do caminho é por privado.transicionar (PRD 7)',
  'service_role não cria oportunidade já no P2');
select throws_ok(
  format($s$ insert into oportunidade (familia_id, pipeline, estagio_p1) values (%L, 1, 'qualificado') $s$,
         current_setting('testes.familia')),
  '42501', null, 'service_role não cria oportunidade já qualificada');
select lives_ok(
  format($s$ insert into oportunidade (familia_id, pipeline, estagio_p1) values (%L, 1, 'novo') $s$,
         current_setting('testes.familia')),
  'service_role cria oportunidade no estado inicial (novo)');
select throws_ok(
  format($s$ insert into acompanhamento (contrato_id, familia_id, dias_contratados, horas_por_visita, estado)
             values (%L, %L, 6, 6, 'ativo') $s$, current_setting('testes.contrato'), current_setting('testes.familia')),
  '42501', null, 'service_role não cria acompanhamento já ativo');
select throws_ok(
  format($s$ insert into visita (acompanhamento_id, profissional_id, dia_numero, data, estado)
             values (%L, %L, 9, '2026-12-10', 'concluida') $s$,
         current_setting('testes.acomp_direto'), current_setting('testes.profissional')),
  '42501', null, 'service_role não cria visita já concluída');
select throws_ok(
  format($s$ insert into pos_venda (acompanhamento_id, estagio) values (%L, 'arquivado') $s$,
         current_setting('testes.acomp_direto')),
  '42501', null, 'service_role não cria pós-venda já arquivado');
select testes.encerrar();


-- =============================================================================
-- 8. evento_familia e log_auditoria da transição
-- =============================================================================

select is(
  (select jsonb_build_object('titulo', e.titulo, 'restrito', e.restrito, 'motivo', e.dados ->> 'motivo',
                             'usuario', e.criado_por, 'sistema', e.dados ->> 'sistema')
     from evento_familia e
    where e.tipo = 'estagio' and e.dados ->> 'entidade_id' = pg_temp.fixo('op_intercorrencia')::text
      and e.dados ->> 'de' = 'intercorrencia'),
  jsonb_build_object('titulo', 'intercorrencia → aguardando_nascimento', 'restrito', true, 'motivo', 'decisão sintética',
                     'usuario', pg_temp.usuario('coordenacao'), 'sistema', 'false'),
  'evento_familia da saída de intercorrencia: título com os estados, restrito, motivo e quem decidiu');

select is(
  (select jsonb_build_object('motivo', l.valor_depois ->> 'motivo', 'hmac', length(l.valor_depois -> '_hmac' ->> 'motivo'),
                             'usuario', l.usuario_id)
     from log_auditoria l
    where l.acao = 'transicao' and l.entidade_id = pg_temp.fixo('op_intercorrencia')::text
      and l.valor_antes ->> 'estado' = 'intercorrencia'),
  jsonb_build_object('motivo', '[oculto]', 'hmac', 64, 'usuario', pg_temp.usuario('coordenacao')),
  'log_auditoria da transição: motivo oculto com HMAC e o usuário que decidiu');

select ok(
  (select not e.restrito from evento_familia e
    where e.tipo = 'estagio' and e.dados ->> 'entidade_id' = pg_temp.fixo('op_direto')::text),
  'evento de estágio comercial (p1) não é restrito');

select ok(
  obj_description('privado.transicionar(privado.maquina_estado, uuid, text, text)'::regprocedure, 'pg_proc')
    like '%Apresentação enviada%pdf_enviado_em%Não é lead%',
  'o comentário de transicionar traz a tabela de status do PRD 7.1 (P06 item 5)');


select * from finish();

rollback;
