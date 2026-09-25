-- =============================================================================
-- supabase/tests/005_auditoria.sql
--
-- Aceite do P05 (PROMPTS.md v2): auditoria imutável, leitura auditada e
-- máscara de documentos.
--
--   1. log_auditoria: UPDATE, DELETE e TRUNCATE recusados para
--      authenticated, service_role e o dono; SELECT e INSERT diretos também
--      fora; a única exceção é a anonimização do ip pela retenção (O-06).
--   2. privado.auditar(): em toda tabela de negócio, fora as exceções; o log
--      de uma mudança de pessoa.nome, handoff.resumo e
--      familia.estado_sensivel_motivo não contém o texto original; o HMAC do
--      CPF não bate com sha256(cpf) e bate com o HMAC da chave do Vault.
--   3. registro_atendimento e registro_adendo: UPDATE, DELETE e TRUNCATE
--      recusados para authenticated e service_role.
--   4. assistencial.ler_acompanhamento: grava a leitura no log antes de
--      devolver; leitura do log só pela diretoria em AAL2.
--   5. privado.mascarar_documentos: os 16 casos do P05 v2 e casos extras.
--   6. Sem a chave do Vault, a escrita auditada é recusada.
--
-- Só dado sintético, criado e desfeito dentro da transação do teste. O JWT
-- simulado é gravado em request.jwt.claims sem trocar de papel quando o que
-- se testa é a função (security definer), e com testes.autenticar_* quando
-- o que se testa é o privilégio do papel.
-- =============================================================================

begin;

select plan(89);


-- -----------------------------------------------------------------------------
-- Dados sintéticos
-- -----------------------------------------------------------------------------

create function pg_temp.como(sub uuid, aal text default 'aal2') returns void
  language sql
  as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', sub, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

create function pg_temp.definir(chave text, valor text) returns void
  language sql
  as $$ select set_config(chave, valor, true); $$;

create function pg_temp.sem_usuario() returns void
  language sql
  as $$ select set_config('request.jwt.claims', '', true); $$;

do $$
declare
  v_diretoria  uuid := 'd0000000-0000-0000-0000-000000000005';
  v_comercial  uuid := 'c0000000-0000-0000-0000-000000000005';
  v_familia    uuid;
  v_pacote     uuid;
  v_versao     uuid;
  v_contrato   uuid;
  v_acomp      uuid;
  v_prof       uuid;
  v_visita     uuid;
  v_registro   uuid;
begin
  insert into auth.users (id, email) values
    (v_diretoria, 'diretoria.p05@exemplo.invalid'),
    (v_comercial, 'comercial.p05@exemplo.invalid');
  insert into perfil (id, nome, email) values
    (v_diretoria, 'Diretoria Sintética P05', 'diretoria.p05@exemplo.invalid'),
    (v_comercial, 'Comercial Sintético P05', 'comercial.p05@exemplo.invalid');
  insert into usuario_papel (usuario_id, papel) values
    (v_diretoria, 'diretoria'),
    (v_comercial, 'comercial');

  insert into familia (nome_exibicao, dpp) values ('Família Sintética P05', '2026-12-01') returning id into v_familia;
  insert into pacote (nome, dias) values ('Pacote Sintético P05', 6) returning id into v_pacote;
  insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
    values (v_pacote, 100, 6, '2026-01-01') returning id into v_versao;
  insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao)
    values (v_familia, v_versao, 100, 'teste') returning id into v_contrato;
  insert into acompanhamento (contrato_id, familia_id, dias_contratados, horas_por_visita)
    values (v_contrato, v_familia, 6, 6) returning id into v_acomp;
  insert into profissional (nome, funcao) values ('Profissional Sintética P05', 'enfermeira_obstetrica') returning id into v_prof;
  insert into visita (acompanhamento_id, profissional_id, dia_numero, data)
    values (v_acomp, v_prof, 1, '2026-12-10') returning id into v_visita;
  insert into registro_atendimento (visita_id, profissional_id, instrumento_versao, dados, resumo_descritivo, assinado_em, assinatura)
    values (v_visita, v_prof, 'v-teste', '{}', 'resumo sintético', now(), 'hash-sintetico') returning id into v_registro;
  insert into registro_adendo (registro_id, autor_id, motivo, conteudo)
    values (v_registro, v_diretoria, 'motivo sintético', 'conteúdo sintético');

  perform set_config('testes.diretoria', v_diretoria::text, true);
  perform set_config('testes.comercial', v_comercial::text, true);
  perform set_config('testes.familia',   v_familia::text,   true);
  perform set_config('testes.registro',  v_registro::text,  true);
  perform set_config('testes.log_id',    (select max(id) from log_auditoria)::text, true);
end $$;


-- =============================================================================
-- 1. log_auditoria imutável (P05 item 1 [v4.2])
-- =============================================================================

select ok(
  not has_table_privilege('authenticated', 'public.log_auditoria', 'select, insert, update, delete, truncate'),
  'authenticated não tem nenhum privilégio direto em log_auditoria');
select ok(
  not has_table_privilege('service_role', 'public.log_auditoria', 'select, insert, update, delete, truncate'),
  'service_role não tem nenhum privilégio direto em log_auditoria');
select ok(
  not has_table_privilege('anon', 'public.log_auditoria', 'select, insert, update, delete, truncate'),
  'anon não tem nenhum privilégio direto em log_auditoria');

select testes.autenticar_authenticated(current_setting('testes.diretoria')::uuid, 'aal2');
select throws_ok(format('update log_auditoria set acao = %L where id = %s', 'x', current_setting('testes.log_id')),
  '42501', null, 'log_auditoria: UPDATE como authenticated (diretoria, aal2) é recusado');
select throws_ok(format('delete from log_auditoria where id = %s', current_setting('testes.log_id')),
  '42501', null, 'log_auditoria: DELETE como authenticated é recusado');
select throws_ok('truncate log_auditoria', '42501', null, 'log_auditoria: TRUNCATE como authenticated é recusado');
select throws_ok('select count(*) from log_auditoria', '42501', null,
  'log_auditoria: SELECT direto como authenticated é recusado (leitura só por função)');
select testes.encerrar();

select testes.autenticar_service_role();
select throws_ok(format('update log_auditoria set acao = %L where id = %s', 'x', current_setting('testes.log_id')),
  '42501', null, 'log_auditoria: UPDATE como service_role é recusado');
select throws_ok(format('delete from log_auditoria where id = %s', current_setting('testes.log_id')),
  '42501', null, 'log_auditoria: DELETE como service_role é recusado');
select throws_ok('truncate log_auditoria', '42501', null, 'log_auditoria: TRUNCATE como service_role é recusado');
select throws_ok($s$ insert into log_auditoria (acao, entidade) values ('forjada', 'familia') $s$,
  '42501', null, 'log_auditoria: INSERT direto como service_role é recusado (ninguém forja linha de log)');
select testes.encerrar();

select throws_ok(format('update log_auditoria set acao = %L where id = %s', 'x', current_setting('testes.log_id')),
  '42501', null, 'log_auditoria: UPDATE como postgres (dono) é recusado pelo gatilho');
select throws_ok(format('delete from log_auditoria where id = %s', current_setting('testes.log_id')),
  '42501', null, 'log_auditoria: DELETE como postgres (dono) é recusado pelo gatilho');
select throws_ok('truncate log_auditoria', '42501', null,
  'log_auditoria: TRUNCATE como postgres (dono) é recusado pelo gatilho before truncate');

-- --- Única exceção: anonimização do ip pela retenção (PRD 22.4 O-06) ---------

-- on conflict: P08 semeia esta chave com os valores oficiais (retencao,
-- PRD 6.8/22.4 O-06); este teste sobrescreve com o próprio valor sintético
-- só dentro da transação (rollback no fim), sem depender de o seed existir.
insert into parametro (chave, valor) values ('retencao', '{"chat_memoria_dias":180,"conversa_nao_cliente_meses":24,"log_ip_meses":12}')
  on conflict (chave) do update set valor = excluded.valor;

do $$
declare
  v_antiga  bigint;
  v_antiga2 bigint;
  v_recente bigint;
begin
  insert into log_auditoria (acao, entidade, ip, criado_em) values ('teste', 'familia', '203.0.113.7', now() - interval '13 months')
    returning id into v_antiga;
  insert into log_auditoria (acao, entidade, ip, criado_em) values ('teste', 'familia', '203.0.113.9', now() - interval '14 months')
    returning id into v_antiga2;
  insert into log_auditoria (acao, entidade, ip, criado_em) values ('teste', 'familia', '203.0.113.8', now() - interval '1 month')
    returning id into v_recente;
  perform set_config('testes.log_antiga',  v_antiga::text,  true);
  perform set_config('testes.log_antiga2', v_antiga2::text, true);
  perform set_config('testes.log_recente', v_recente::text, true);
end $$;

-- com a variável ligada à mão, ainda assim só passa o que a retenção faria
select pg_temp.definir('app.retencao_log_ip', 'on');
select throws_ok(format('update log_auditoria set ip = null where id = %s', current_setting('testes.log_recente')),
  '42501', null, 'retenção: ip dentro do prazo não é anonimizado, mesmo com a variável ligada');
select throws_ok(format('update log_auditoria set ip = null, acao = %L where id = %s', 'x', current_setting('testes.log_antiga')),
  '42501', null, 'retenção: mudar outra coluna além de ip é recusado');
select throws_ok(format('update log_auditoria set ip = %L where id = %s', '192.0.2.1', current_setting('testes.log_antiga')),
  '42501', null, 'retenção: trocar o ip por outro valor é recusado (anonimizar é apagar)');
select pg_temp.definir('app.retencao_log_ip', '');

select throws_ok(format('update log_auditoria set ip = null where id = %s', current_setting('testes.log_antiga')),
  '42501', null, 'retenção: sem a função de retenção, apagar o ip também é recusado');

select is(privado.anonimizar_ip_log_auditoria(), 2,
  'privado.anonimizar_ip_log_auditoria() anonimiza as duas linhas fora do prazo e devolve a contagem');
select ok(
  (select ip is null from log_auditoria where id = current_setting('testes.log_antiga')::bigint)
  and (select acao = 'teste' and entidade = 'familia' from log_auditoria where id = current_setting('testes.log_antiga')::bigint),
  'linha fora do prazo: ip apagado, demais colunas intactas');
select is((select host(ip) from log_auditoria where id = current_setting('testes.log_recente')::bigint), '203.0.113.8',
  'linha dentro do prazo mantém o ip');
select is(current_setting('app.retencao_log_ip', true), '',
  'a variável da retenção fica desligada depois da função');

delete from parametro where chave = 'retencao';
select throws_ok('select privado.anonimizar_ip_log_auditoria()', '22023', null,
  'sem parametro.retencao, a anonimização recusa (nenhum prazo fixo no código)');


-- =============================================================================
-- 2. privado.auditar() (P05 item 2 [v4.2], PRD 13)
-- =============================================================================

select is_empty(
  $$
  select n.nspname || '.' || c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in ('public', 'agente')
    and not (n.nspname = 'public' and c.relname in ('log_auditoria', 'fila_sincronizacao', 'evento_familia'))
    and not exists (
      select 1 from pg_trigger g
      where g.tgrelid = c.oid and not g.tgisinternal and g.tgname = 'auditar'
        and g.tgfoid = 'privado.auditar()'::regprocedure
        and (g.tgtype & 1) = 1                  -- por linha
        and (g.tgtype & 2) = 0                  -- after
        and (g.tgtype & 28) = 28                -- insert, delete e update
    )
  $$,
  'toda tabela de negócio de public e agente tem o gatilho privado.auditar (after insert, update e delete, por linha)');

select is_empty(
  $$
  select c.relname from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where g.tgfoid = 'privado.auditar()'::regprocedure
    and ((n.nspname = 'public' and c.relname in ('log_auditoria', 'fila_sincronizacao', 'evento_familia'))
         or n.nspname = 'agente_n8n')
  $$,
  'log_auditoria, fila_sincronizacao, evento_familia e agente_n8n ficam fora da auditoria genérica (P05)');

select is_empty(
  $$
  select s.entidade, s.coluna from privado.auditoria_coluna_sensivel s
  where not exists (
    select 1 from pg_attribute a
    where a.attrelid = to_regclass(case when s.entidade like '%.%' then s.entidade else 'public.' || s.entidade end)
      and a.attname = s.coluna and a.attnum > 0 and not a.attisdropped)
  $$,
  'toda coluna da lista de sensíveis existe (nome errado deixaria o dado real sair em claro no log)');

select is_empty(
  $$
  select a.attname from pg_attribute a
  where a.attrelid = 'public.pessoa_dados_contrato'::regclass and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('id', 'criado_em', 'atualizado_em', 'criado_por', 'pessoa_id')
    and not exists (select 1 from privado.auditoria_coluna_sensivel s
                    where s.entidade = 'pessoa_dados_contrato' and s.coluna = a.attname)
  $$,
  'pessoa_dados_contrato: toda coluna de dado está na lista de sensíveis (PRD 13: todas)');

select is_empty(
  $$
  select e.entidade, e.coluna
  from (values
    ('pessoa','nome'), ('pessoa','telefone_e164'), ('pessoa','email'), ('pessoa','idade'), ('pessoa','ocupacao'),
    ('pessoa','consentimentos'), ('familia','nome_exibicao'), ('familia','endereco_atendimento'), ('familia','bairro'),
    ('familia','dpp'), ('familia','data_nascimento'), ('familia','data_alta'), ('familia','data_inicio_efetivo'),
    ('familia','estado_sensivel_motivo'), ('familia','nao_contatar_motivo'), ('familia','historico_sensivel'),
    ('familia','cidade_informada'), ('bebe','nome'), ('bebe','data_nascimento'), ('bebe','peso_nascimento_g'),
    ('bebe','peso_alta_g'), ('bebe','tipo_parto'), ('medico','nome'), ('medico','telefone_e164'), ('medico','email'),
    ('oportunidade','qualificacao'), ('oportunidade','desconto_motivo'), ('handoff','resumo'), ('handoff','solicitacao'),
    ('handoff','dados'), ('alerta_clinico','valor_observado'), ('alerta_clinico','sinal_identificado'),
    ('alerta_clinico','orientacao_medica'), ('alerta_clinico','conduta_adotada'), ('ocorrencia','descricao'),
    ('ocorrencia','historico'), ('consulta_prenatal','ficha'), ('consulta_prenatal','plano_cuidado'),
    ('registro_atendimento','dados'), ('registro_atendimento','resumo_descritivo'), ('registro_adendo','motivo'),
    ('registro_adendo','conteudo'), ('relatorio_medico','conteudo'), ('pos_venda','respostas'),
    ('sessao_venda_gravacao','transcricao'), ('sessao_venda_gravacao','resumo'), ('anexo_audio','transcricao'),
    ('mensagem','conteudo'), ('mensagem','transcricao'), ('conversa','nome_whatsapp'),
    ('conversa','nome_contato_salvo'), ('conversa','telefone_e164')
  ) as e(entidade, coluna)
  where not exists (select 1 from privado.auditoria_coluna_sensivel s where s.entidade = e.entidade and s.coluna = e.coluna)
  $$,
  'a lista mínima do PRD 13 [v4.2] inteira está na lista de sensíveis');

-- --- pessoa.nome: o log não contém o texto original -------------------------

do $$
declare
  v_pessoa uuid;
begin
  insert into pessoa (familia_id, papel, nome, telefone_e164)
    values (current_setting('testes.familia')::uuid, 'mae', 'Nomeoriginal Sintética', '+5511900000055')
    returning id into v_pessoa;
  perform set_config('testes.pessoa', v_pessoa::text, true);
end $$;

select pg_temp.como(current_setting('testes.comercial')::uuid);
select pg_temp.definir('app.origem', 'app');
select pg_temp.definir('request.headers', '{"x-forwarded-for":"198.51.100.23, 10.0.0.1"}');
update pessoa set nome = 'Nomenovo Sintética' where id = current_setting('testes.pessoa')::uuid;
select pg_temp.sem_usuario();
select pg_temp.definir('app.origem', '');
select pg_temp.definir('request.headers', '');

select ok(
  (select bool_and(coalesce(valor_antes::text, '') not like '%Nomeoriginal%' and coalesce(valor_depois::text, '') not like '%Nomeoriginal%'
                   and coalesce(valor_antes::text, '') not like '%Nomenovo%' and coalesce(valor_depois::text, '') not like '%Nomenovo%')
     from log_auditoria where entidade = 'pessoa' and entidade_id = current_setting('testes.pessoa')),
  'pessoa.nome: nenhuma linha do log (insert e update) contém o nome antigo nem o novo');

select is(
  (select jsonb_build_object('antes', valor_antes ->> 'nome', 'depois', valor_depois ->> 'nome',
                             'hmac', length(valor_depois -> '_hmac' ->> 'nome'),
                             'chaves', (select array_agg(k order by k) from jsonb_object_keys(valor_depois) k))
     from log_auditoria where entidade = 'pessoa' and entidade_id = current_setting('testes.pessoa') and acao = 'update'),
  jsonb_build_object('antes', '[oculto]', 'depois', '[oculto]', 'hmac', 64, 'chaves', array['_hmac', 'nome']),
  'pessoa.nome: o update grava só a coluna que mudou, como "[oculto]" e HMAC-SHA256 (64 hex)');

select is(
  (select jsonb_build_object('usuario', usuario_id, 'origem', origem, 'ip', host(ip))
     from log_auditoria where entidade = 'pessoa' and entidade_id = current_setting('testes.pessoa') and acao = 'update'),
  jsonb_build_object('usuario', current_setting('testes.comercial')::uuid, 'origem', 'app', 'ip', '198.51.100.23'),
  'o log grava auth.uid(), a origem de app.origem e o ip do x-forwarded-for');

select isnt(
  (select valor_antes -> '_hmac' ->> 'nome' from log_auditoria
    where entidade = 'pessoa' and entidade_id = current_setting('testes.pessoa') and acao = 'update'),
  (select valor_depois -> '_hmac' ->> 'nome' from log_auditoria
    where entidade = 'pessoa' and entidade_id = current_setting('testes.pessoa') and acao = 'update'),
  'o HMAC do valor antigo difere do novo (o log prova que houve mudança)');

-- --- handoff.resumo ------------------------------------------------------------

do $$
declare
  v_handoff uuid;
begin
  insert into handoff (familia_id, motivo, destino, prioridade, resumo)
    values (current_setting('testes.familia')::uuid, 'saude', 'coordenacao_clinica', 'alta', 'Resumooriginal com sintoma sintético')
    returning id into v_handoff;
  update handoff set resumo = 'Resumonovo com sintoma sintético', status = 'assumido' where id = v_handoff;
  perform set_config('testes.handoff', v_handoff::text, true);
end $$;

select ok(
  (select bool_and(coalesce(valor_antes::text, '') || coalesce(valor_depois::text, '') not like '%Resumooriginal%'
                   and coalesce(valor_antes::text, '') || coalesce(valor_depois::text, '') not like '%Resumonovo%')
     from log_auditoria where entidade = 'handoff' and entidade_id = current_setting('testes.handoff')),
  'handoff.resumo: o log não contém o texto original nem o novo');
select is(
  (select valor_depois ->> 'status' from log_auditoria
    where entidade = 'handoff' and entidade_id = current_setting('testes.handoff') and acao = 'update'),
  'assumido',
  'handoff: coluna não sensível alterada no mesmo update entra com o valor (status)');

-- --- familia.estado_sensivel_motivo ------------------------------------------

update familia
   set estado_sensivel = 'bloqueio_total', estado_sensivel_motivo = 'Motivooriginal sensível sintético'
 where id = current_setting('testes.familia')::uuid;
update familia
   set estado_sensivel_motivo = 'Motivonovo sensível sintético'
 where id = current_setting('testes.familia')::uuid;

select ok(
  (select bool_and(coalesce(valor_antes::text, '') || coalesce(valor_depois::text, '') not like '%Motivooriginal%'
                   and coalesce(valor_antes::text, '') || coalesce(valor_depois::text, '') not like '%Motivonovo%')
     from log_auditoria where entidade = 'familia' and entidade_id = current_setting('testes.familia')),
  'familia.estado_sensivel_motivo: o log não contém o texto original nem o novo');
select ok(
  exists (select 1 from log_auditoria
           where entidade = 'familia' and entidade_id = current_setting('testes.familia') and acao = 'update'
             and valor_antes ->> 'estado_sensivel' = 'normal' and valor_depois ->> 'estado_sensivel' = 'bloqueio_total'),
  'familia: a mudança do freio (estado_sensivel) fica no log com os valores');

-- --- CPF: HMAC com chave do Vault, nunca sha256 puro --------------------------

insert into pessoa_dados_contrato (pessoa_id, cpf) values (current_setting('testes.pessoa')::uuid, '111.444.777-35');

-- "order by criado_em desc limit 1": o P08 semeia pessoa_dados_contrato
-- também (famílias com contrato), e cada insert daquele seed já passou pelo
-- gatilho privado.auditar; sem essa ordem, a subconsulta escalar pegaria
-- mais de uma linha de log_auditoria pela mesma entidade/ação e falharia com
-- "more than one row returned". Filtra pela linha mais recente, que é
-- sempre a que este insert acabou de gravar.
select ok(
  (select valor_depois::text not like '%111.444.777-35%' and valor_depois::text not like '%11144477735%'
     from log_auditoria where entidade = 'pessoa_dados_contrato' and acao = 'insert'
     order by criado_em desc limit 1),
  'pessoa_dados_contrato: o CPF não aparece no log, nem formatado nem corrido');
select ok(
  (select valor_depois -> '_hmac' ->> 'cpf' not in (encode(extensions.digest('111.444.777-35', 'sha256'), 'hex'),
                                                    encode(extensions.digest('11144477735', 'sha256'), 'hex'))
     from log_auditoria where entidade = 'pessoa_dados_contrato' and acao = 'insert'
     order by criado_em desc limit 1),
  'o HMAC do CPF não bate com sha256(cpf), formatado ou corrido');
select is(
  (select valor_depois -> '_hmac' ->> 'cpf' from log_auditoria where entidade = 'pessoa_dados_contrato' and acao = 'insert'
     order by criado_em desc limit 1),
  (select encode(extensions.hmac('111.444.777-35', decrypted_secret, 'sha256'), 'hex')
     from vault.decrypted_secrets where name = 'auditoria_hmac'),
  'o HMAC do CPF é HMAC-SHA256 com a chave auditoria_hmac do Vault');

-- --- Outras regras do gatilho --------------------------------------------------

do $$
declare
  v_antes integer;
begin
  select count(*) into v_antes from log_auditoria where entidade = 'familia' and entidade_id = current_setting('testes.familia');
  update familia set gemelar = gemelar where id = current_setting('testes.familia')::uuid;
  perform set_config('testes.log_familia_antes', v_antes::text, true);
end $$;
select is(
  (select count(*)::integer from log_auditoria where entidade = 'familia' and entidade_id = current_setting('testes.familia')),
  current_setting('testes.log_familia_antes')::integer,
  'update que só mexe em atualizado_em (nenhum valor muda) não gera linha no log');

insert into bebe (familia_id, nome, sexo) values (current_setting('testes.familia')::uuid, 'Bebê Sintético', 'feminino');
delete from bebe where familia_id = current_setting('testes.familia')::uuid;
select ok(
  (select valor_depois is null and valor_antes ->> 'nome' = '[oculto]' and valor_antes ->> 'ordem' = '1'
     from log_auditoria where entidade = 'bebe' and acao = 'delete'),
  'delete grava a linha antiga em valor_antes, com as sensíveis ocultas');

select is(
  (select entidade_id from log_auditoria where entidade = 'usuario_papel' and acao = 'insert'
     and entidade_id like current_setting('testes.comercial') || '%'),
  current_setting('testes.comercial') || '/comercial',
  'chave composta (usuario_papel) vira entidade_id "usuario_id/papel"');

do $$
declare
  v_conversa uuid;
begin
  insert into conversa (wa_jid, telefone_e164, nome_whatsapp) values ('5511900000055@s.whatsapp.net', '+5511900000055', 'Contato Sintético')
    returning id into v_conversa;
  perform set_config('testes.conversa_p05', v_conversa::text, true);
  insert into mensagem (conversa_id, direcao, enviado_por, conteudo, wa_message_id)
    values (v_conversa, 'entrada', 'cliente', 'Conteúdo sintético da mensagem', 'wamid-p05-1');
end $$;
-- entidade_id = a própria conversa criada acima (id, capturado por
-- set_config): sem isso, o filtro por wa_jid ou nome_whatsapp mascarados
-- pegaria também as conversas sintéticas do seed.sql (P08), que têm as
-- mesmas colunas ocultadas no log.
select ok(
  (select valor_depois ->> 'conteudo' = '[oculto]' and valor_depois::text not like '%Conteúdo sintético%'
     from log_auditoria where entidade = 'mensagem' and acao = 'insert' and valor_depois ->> 'wa_message_id' = 'wamid-p05-1')
  and (select valor_depois::text not like '%5511900000055%'
     from log_auditoria where entidade = 'conversa' and acao = 'insert'
       and entidade_id = current_setting('testes.conversa_p05')),
  'mensagem.conteudo e o telefone da conversa (telefone_e164, wa_jid) entram ocultos no log (PRD 13)');


-- =============================================================================
-- 3. registro_atendimento e registro_adendo sem UPDATE, DELETE e TRUNCATE
--    para authenticated e service_role (P05 item 3 [v4.2])
-- =============================================================================

select testes.autenticar_authenticated(current_setting('testes.diretoria')::uuid, 'aal2');
select throws_ok(format('update registro_atendimento set resumo_descritivo = %L where id = %L', 'x', current_setting('testes.registro')),
  '42501', null, 'registro_atendimento: UPDATE como authenticated é recusado');
select throws_ok(format('delete from registro_atendimento where id = %L', current_setting('testes.registro')),
  '42501', null, 'registro_atendimento: DELETE como authenticated é recusado');
select throws_ok('truncate registro_atendimento cascade', '42501', null,
  'registro_atendimento: TRUNCATE como authenticated é recusado');
select throws_ok(format('update registro_adendo set conteudo = %L where registro_id = %L', 'x', current_setting('testes.registro')),
  '42501', null, 'registro_adendo: UPDATE como authenticated é recusado');
select throws_ok(format('delete from registro_adendo where registro_id = %L', current_setting('testes.registro')),
  '42501', null, 'registro_adendo: DELETE como authenticated é recusado');
select throws_ok('truncate registro_adendo', '42501', null,
  'registro_adendo: TRUNCATE como authenticated é recusado');
select testes.encerrar();

select testes.autenticar_service_role();
select throws_ok(format('update registro_atendimento set resumo_descritivo = %L where id = %L', 'x', current_setting('testes.registro')),
  '42501', null, 'registro_atendimento: UPDATE como service_role é recusado');
select throws_ok(format('delete from registro_atendimento where id = %L', current_setting('testes.registro')),
  '42501', null, 'registro_atendimento: DELETE como service_role é recusado');
select throws_ok('truncate registro_atendimento cascade', '42501', null,
  'registro_atendimento: TRUNCATE como service_role é recusado');
select throws_ok(format('update registro_adendo set conteudo = %L where registro_id = %L', 'x', current_setting('testes.registro')),
  '42501', null, 'registro_adendo: UPDATE como service_role é recusado');
select throws_ok(format('delete from registro_adendo where registro_id = %L', current_setting('testes.registro')),
  '42501', null, 'registro_adendo: DELETE como service_role é recusado');
select throws_ok('truncate registro_adendo', '42501', null,
  'registro_adendo: TRUNCATE como service_role é recusado');
select testes.encerrar();

select throws_ok(format('delete from registro_adendo where registro_id = %L', current_setting('testes.registro')),
  '42501', null, 'registro_adendo: DELETE como postgres (dono) é recusado pelo gatilho');


-- =============================================================================
-- 4. Leitura auditada (P05 item 4) e leitura do log (P05 item 2)
-- =============================================================================

select ok(
  (select p.provolatile = 'v' and p.prosecdef from pg_proc p
    where p.oid = 'assistencial.ler_acompanhamento(uuid)'::regprocedure),
  'assistencial.ler_acompanhamento é volatile e security definer (grava log; o PostgREST roda stable em transação só de leitura)');

select ok(
  not has_function_privilege('anon', 'assistencial.ler_acompanhamento(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'assistencial.ler_acompanhamento(uuid)', 'execute')
  and not has_function_privilege('service_role', 'assistencial.ler_acompanhamento(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'privado.ler_log_auditoria(text, text, timestamptz, timestamptz, integer)', 'execute')
  and not has_function_privilege('authenticated', 'privado.hmac_auditoria(text)', 'execute')
  and not has_function_privilege('service_role', 'privado.hmac_auditoria(text)', 'execute'),
  'nenhum papel da aplicação executa as funções de leitura auditada nem o HMAC direto (grants só nos wrappers do P07)');

do $$
begin
  perform set_config('testes.leituras_antes',
    (select count(*) from log_auditoria where acao = 'leitura' and entidade = 'acompanhamento')::text, true);
end $$;

select pg_temp.como(current_setting('testes.diretoria')::uuid);
select is(
  (select count(*)::integer from assistencial.ler_acompanhamento(current_setting('testes.familia')::uuid)),
  1,
  'ler_acompanhamento devolve os acompanhamentos da família');
select pg_temp.sem_usuario();

select is(
  (select count(*)::integer from log_auditoria
    where acao = 'leitura' and entidade = 'acompanhamento'
      and entidade_id = current_setting('testes.familia')
      and usuario_id = current_setting('testes.diretoria')::uuid),
  current_setting('testes.leituras_antes')::integer + 1,
  'a leitura pela função gera uma linha ''leitura'' no log, com a família e o usuário');

select throws_ok('select * from assistencial.ler_acompanhamento(null)', '22023', null,
  'ler_acompanhamento sem família é recusado');

select pg_temp.como(current_setting('testes.diretoria')::uuid, 'aal2');
select ok(
  (select count(*) > 0 from privado.ler_log_auditoria('familia', current_setting('testes.familia'))),
  'diretoria em AAL2 lê o log pela função');
select pg_temp.sem_usuario();

select ok(
  exists (select 1 from log_auditoria where acao = 'leitura' and entidade = 'log_auditoria'
            and usuario_id = current_setting('testes.diretoria')::uuid),
  'a leitura do log também fica registrada no log');

select pg_temp.como(current_setting('testes.diretoria')::uuid, 'aal1');
select throws_ok('select * from privado.ler_log_auditoria()', '42501', null,
  'diretoria em AAL1 (sem MFA) não lê o log');
select pg_temp.como(current_setting('testes.comercial')::uuid, 'aal2');
select throws_ok('select * from privado.ler_log_auditoria()', '42501', null,
  'comercial em AAL2 não lê o log (só diretoria)');
select pg_temp.sem_usuario();
select throws_ok('select * from privado.ler_log_auditoria()', '42501', null,
  'sem usuário identificado, a leitura do log é recusada');


-- =============================================================================
-- 5. privado.mascarar_documentos (P05 item 5 [v4.2]): os 16 casos do P05 v2
--    (os mesmos de n8n/build.test.mjs) com a saída exata, mais extras.
-- =============================================================================

select is(privado.mascarar_documentos('Meu CPF é 111.444.777-35, pode confirmar?'),
  'Meu CPF é [CPF ocultado], pode confirmar?', 'máscara 1: CPF formatado');
select is(privado.mascarar_documentos('cpf 11144477735 aqui'),
  'cpf [CPF ocultado] aqui', 'máscara 2: CPF corrido válido');
select is(privado.mascarar_documentos('numero 11144477736 aqui'),
  'numero 11144477736 aqui', 'máscara 3: 11 dígitos com verificador errado ficam');
select is(privado.mascarar_documentos('meu numero é (11) 98765-4321, pode me chamar'),
  'meu numero é (11) 98765-4321, pode me chamar', 'máscara 4: celular com DDD fica');
select is(privado.mascarar_documentos('meu whats é +5511987654321'),
  'meu whats é +5511987654321', 'máscara 5: telefone E.164 fica');
select is(privado.mascarar_documentos('meu cartao é 4532015112830366 pode usar'),
  'meu cartao é [cartão ocultado] pode usar', 'máscara 6: cartão válido (Luhn)');
select is(privado.mascarar_documentos('numero de protocolo 1234567812345678'),
  'numero de protocolo 1234567812345678', 'máscara 7: 16 dígitos que não passam no Luhn ficam');
select is(privado.mascarar_documentos('cartao 4111 1111 1111 1111 por favor'),
  'cartao [cartão ocultado] por favor', 'máscara 8: "4111 1111 1111 1111" (grupos com espaço)');
select is(privado.mascarar_documentos('cartao 4111-1111-1111-1111 por favor'),
  'cartao [cartão ocultado] por favor', 'máscara 9: "4111-1111-1111-1111" (grupos com hífen)');
select is(privado.mascarar_documentos('amex 378282 246310005 aqui'),
  'amex [cartão ocultado] aqui', 'máscara 10: "378282 246310005" (Amex em dois grupos)');
select is(privado.mascarar_documentos('cartao 4532015112830366 validade 08/29 cvv 123'),
  'cartao [cartão ocultado] validade [dado de cartão ocultado] cvv [dado de cartão ocultado]',
  'máscara 11: cartão seguido de "validade 08/29 cvv 123"');
select is(privado.mascarar_documentos('cartao 4532015112830366 validade 08/2029'),
  'cartao [cartão ocultado] validade [dado de cartão ocultado]', 'máscara 12: validade MM/AAAA junto com cartão');
select is(privado.mascarar_documentos('cartao 4532015112830366 cvc 456'),
  'cartao [cartão ocultado] cvc [dado de cartão ocultado]', 'máscara 13: CVC junto com cartão');
select is(privado.mascarar_documentos('cartao 4532015112830366 código de segurança 789'),
  'cartao [cartão ocultado] código de segurança [dado de cartão ocultado]', 'máscara 14: "código de segurança" junto com cartão');
select is(privado.mascarar_documentos('minha assinatura vence em 08/29'),
  'minha assinatura vence em 08/29', 'máscara 15: validade sem cartão na mensagem fica');
select is(privado.mascarar_documentos('oi, tudo bem? sou a Marina, estou com 32 semanas'),
  'oi, tudo bem? sou a Marina, estou com 32 semanas', 'máscara 16: texto sem documento passa direto');

-- extras
select is(privado.mascarar_documentos('whats +5511987654309 ok'), 'whats +5511987654309 ok',
  'extra: telefone +55 com DDD e 9 dígitos que passa no Luhn continua fora (formato de telefone)');
select is(privado.mascarar_documentos('cartao 4532 0151 1283 0366 08/29 123'),
  'cartao [cartão ocultado] [dado de cartão ocultado] 123',
  'extra: cartão em grupos colado à validade no mesmo trecho de dígitos ainda é ocultado');
select is(privado.mascarar_documentos('amex 3782 822463 10005 e CVV: 1234'),
  'amex [cartão ocultado] e CVV: [dado de cartão ocultado]', 'extra: Amex 4-6-5 e CVV em maiúsculas com dois-pontos');
select is(privado.mascarar_documentos('cpf 111.111.111-11'), 'cpf [CPF ocultado]',
  'extra: CPF de dígitos repetidos tem verificadores que batem e é ocultado (leitura literal do P05)');
select ok(privado.mascarar_documentos(null) is null and privado.mascarar_documentos('') = '',
  'extra: nulo devolve nulo e texto vazio devolve vazio');
select ok(
  (select p.provolatile = 'i' and not p.prosecdef from pg_proc p where p.oid = 'privado.mascarar_documentos(text)'::regprocedure),
  'mascarar_documentos é imutável e não é security definer (não lê tabela)');


-- =============================================================================
-- 6. Sem a chave do Vault, nenhuma escrita auditada passa (falha fechada)
-- =============================================================================

delete from vault.secrets where name = 'auditoria_hmac';
select throws_ok(
  format($s$ update pessoa set nome = 'Outro Nome Sintético' where id = %L $s$, current_setting('testes.pessoa')),
  '55000', null,
  'sem a chave auditoria_hmac no Vault, a escrita de coluna sensível é recusada (nunca grava sem HMAC)');


select * from finish();

rollback;
