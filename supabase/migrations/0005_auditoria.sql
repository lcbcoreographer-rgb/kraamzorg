-- =============================================================================
-- 0005_auditoria.sql
--
-- P05 (PROMPTS.md v2) · PRD 5.2, 6.7, 6.10 (regras 4 e 6), 13 (regras de
-- implementação), 21.2, 21.3 e 22.4 (O-06)
--
-- Auditoria imutável, leitura auditada e máscara de documentos. Esta
-- migration não cria tabela de negócio: fecha as regras de banco que as
-- tabelas das migrations 0002 a 0004 ainda não tinham.
--
-- O que esta migration faz:
--   1. Chave do HMAC da auditoria no Vault (gerada dentro do banco, nunca
--      escrita em arquivo).
--   2. Lista das colunas pessoais ou sensíveis por tabela (PRD 13 [v4.2]),
--      numa tabela interna de privado.
--   3. Funções auxiliares: HMAC-SHA256 com a chave do Vault, recorte do
--      registro para o log, origem e ip da requisição.
--   4. privado.auditar(): gatilho genérico de auditoria em toda tabela de
--      negócio de public e agente (menos as exceções do P05).
--   5. log_auditoria imutável: UPDATE, DELETE e TRUNCATE revogados de todos
--      os papéis da aplicação e recusados por gatilho, com a única exceção
--      da anonimização do ip pela retenção (PRD 6.7 [v4.2], 22.4 O-06).
--   6. Leitura do log só pela diretoria, por função.
--   7. Leitura auditada no schema assistencial: privado.registrar_leitura()
--      e o exemplo assistencial.ler_acompanhamento(familia_id).
--   8. privado.mascarar_documentos(texto): CPF e cartão (P05 item 5 [v4.2]).
--
-- registro_atendimento e registro_adendo (P05 item 3) já nasceram sem
-- UPDATE, DELETE e TRUNCATE na 0004 (privilégio revogado mais os gatilhos
-- privado.recusar_update_delete e privado.recusar_truncate). Esta migration
-- não repete isso; o teste 005 prova o aceite do P05 para as duas tabelas.
--
-- Nenhuma função daqui recebe grant: o execute padrão de public foi revogado
-- na 0001 e os grants de cada papel chegam com as funções do schema api
-- (P07) e com a automação retencao_diaria (P20). Toda função é
-- "set search_path = ''" e qualifica tudo, inclusive funções de extensão
-- (extensions.hmac, extensions.gen_random_bytes), como manda o PRD 6.10
-- regra 11.
-- =============================================================================


-- =============================================================================
-- 1. Chave do HMAC no Vault (PRD 13 [v4.2], CLAUDE.md "Banco e dados")
--
-- O log de auditoria nunca guarda o valor de uma coluna sensível: guarda
-- "[oculto]" e um HMAC-SHA256 do valor com uma chave secreta. Hash puro
-- (sha256 do CPF, por exemplo) não serve, porque o espaço de CPFs é pequeno
-- e o hash se reverte em segundos por força bruta; sem a chave, o HMAC não.
--
-- A chave é gerada aqui, dentro do banco, com 32 bytes aleatórios do
-- pgcrypto, e guardada no Vault com o nome 'auditoria_hmac'. O valor nunca
-- passa por arquivo, migration, teste ou variável de ambiente. Idempotente:
-- se a chave já existir (reaplicação, projeto que já tinha a chave criada à
-- mão pelo runbook), não é trocada. Trocar a chave é decisão de runbook,
-- porque os HMACs antigos deixam de ser comparáveis com os novos.
--
-- sem-docker: o Vault local é stub e guarda o segredo em texto puro
-- (supabase/sem-docker/README.md). No Supabase real ele fica cifrado.
-- =============================================================================

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'auditoria_hmac') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'auditoria_hmac',
      'Chave do HMAC-SHA256 das colunas sensíveis em log_auditoria (PRD 13). Gerada pela migration 0005, nunca sai do banco.'
    );
  end if;
end $$;


-- =============================================================================
-- 2. Colunas pessoais ou sensíveis por tabela (PRD 13 [v4.2], ADR 0002)
--
-- Lista usada por privado.auditar(): o valor dessas colunas entra no log
-- como "[oculto]" mais o HMAC. A coluna "fonte" separa o que é a lista
-- mínima do PRD 13 do que esta sessão acrescentou pela leitura mais segura
-- (dado pessoal que o PRD não citou, texto livre que pode carregar nome de
-- paciente e hash de token de uso único). O ADR 0002 (P07) registra a lista
-- final; mudar a lista é migration nova, nunca edição de dado pela tela.
--
-- "entidade" usa o mesmo nome que privado.auditar() grava em
-- log_auditoria.entidade: o nome da tabela para public, "schema.tabela"
-- para os demais schemas.
-- =============================================================================

create table privado.auditoria_coluna_sensivel (
  entidade text not null,
  coluna   text not null,
  fonte    text not null check (fonte in ('prd_13', 'sessao_p05')),
  primary key (entidade, coluna)
);
comment on table privado.auditoria_coluna_sensivel is 'Colunas pessoais ou sensíveis que privado.auditar() grava como "[oculto]" mais HMAC-SHA256 (PRD 13 [v4.2]). fonte = prd_13 (lista mínima do PRD) ou sessao_p05 (acréscimo da sessão P05, leitura mais segura). Mudança só por migration.';

alter table privado.auditoria_coluna_sensivel enable row level security;

insert into privado.auditoria_coluna_sensivel (entidade, coluna, fonte) values
  -- pessoa (nome, telefone_e164, email, idade, ocupacao, consentimentos)
  ('pessoa', 'nome', 'prd_13'),
  ('pessoa', 'telefone_e164', 'prd_13'),
  ('pessoa', 'email', 'prd_13'),
  ('pessoa', 'idade', 'prd_13'),
  ('pessoa', 'ocupacao', 'prd_13'),
  ('pessoa', 'consentimentos', 'prd_13'),
  -- pessoa_dados_contrato (todas as colunas de dado; pessoa_id e as colunas
  -- padrão são chave e carimbo, não dado pessoal)
  ('pessoa_dados_contrato', 'cpf', 'prd_13'),
  ('pessoa_dados_contrato', 'data_nascimento', 'prd_13'),
  ('pessoa_dados_contrato', 'endereco_residencial', 'prd_13'),
  ('pessoa_dados_contrato', 'preenchido_via', 'prd_13'),
  -- familia (nome_exibicao, endereco_atendimento, bairro, datas,
  -- estado_sensivel_motivo, nao_contatar_motivo, historico_sensivel,
  -- cidade_informada); "datas" = as quatro datas do PRD 6.10 regra 3
  ('familia', 'nome_exibicao', 'prd_13'),
  ('familia', 'endereco_atendimento', 'prd_13'),
  ('familia', 'bairro', 'prd_13'),
  ('familia', 'dpp', 'prd_13'),
  ('familia', 'data_nascimento', 'prd_13'),
  ('familia', 'data_alta', 'prd_13'),
  ('familia', 'data_inicio_efetivo', 'prd_13'),
  ('familia', 'estado_sensivel_motivo', 'prd_13'),
  ('familia', 'nao_contatar_motivo', 'prd_13'),
  ('familia', 'historico_sensivel', 'prd_13'),
  ('familia', 'cidade_informada', 'prd_13'),
  -- bebe (nome, data_nascimento, pesos, tipo_parto)
  ('bebe', 'nome', 'prd_13'),
  ('bebe', 'data_nascimento', 'prd_13'),
  ('bebe', 'peso_nascimento_g', 'prd_13'),
  ('bebe', 'peso_alta_g', 'prd_13'),
  ('bebe', 'tipo_parto', 'prd_13'),
  ('bebe', 'sexo', 'sessao_p05'),
  -- medico (nome, telefone_e164, email)
  ('medico', 'nome', 'prd_13'),
  ('medico', 'telefone_e164', 'prd_13'),
  ('medico', 'email', 'prd_13'),
  -- oportunidade (qualificacao, desconto_motivo); o detalhe do motivo de
  -- perda é texto livre e pode citar perda gestacional
  ('oportunidade', 'qualificacao', 'prd_13'),
  ('oportunidade', 'desconto_motivo', 'prd_13'),
  ('oportunidade', 'motivo_perda_detalhe', 'sessao_p05'),
  -- handoff (resumo, solicitacao, dados)
  ('handoff', 'resumo', 'prd_13'),
  ('handoff', 'solicitacao', 'prd_13'),
  ('handoff', 'dados', 'prd_13'),
  -- alerta_clinico (valor_observado, sinal_identificado, orientacao_medica, conduta_adotada)
  ('alerta_clinico', 'valor_observado', 'prd_13'),
  ('alerta_clinico', 'sinal_identificado', 'prd_13'),
  ('alerta_clinico', 'orientacao_medica', 'prd_13'),
  ('alerta_clinico', 'conduta_adotada', 'prd_13'),
  -- ocorrencia (descricao, historico); o título também é texto livre
  ('ocorrencia', 'descricao', 'prd_13'),
  ('ocorrencia', 'historico', 'prd_13'),
  ('ocorrencia', 'titulo', 'sessao_p05'),
  -- consulta_prenatal (todas as colunas clínicas)
  ('consulta_prenatal', 'ficha', 'prd_13'),
  ('consulta_prenatal', 'plano_cuidado', 'prd_13'),
  ('consulta_prenatal', 'periodo_preferido', 'prd_13'),
  ('consulta_prenatal', 'urgente', 'prd_13'),
  -- registro_atendimento (dados, resumo_descritivo)
  ('registro_atendimento', 'dados', 'prd_13'),
  ('registro_atendimento', 'resumo_descritivo', 'prd_13'),
  -- registro_adendo (motivo, conteudo)
  ('registro_adendo', 'motivo', 'prd_13'),
  ('registro_adendo', 'conteudo', 'prd_13'),
  -- relatorio_medico (conteudo); destinatarios carrega e-mail de médico
  ('relatorio_medico', 'conteudo', 'prd_13'),
  ('relatorio_medico', 'destinatarios', 'sessao_p05'),
  -- pos_venda (respostas); hash do token da pesquisa não vai para o log
  ('pos_venda', 'respostas', 'prd_13'),
  ('pos_venda', 'pesquisa_token_hash', 'sessao_p05'),
  -- sessao_venda_gravacao (transcricao, resumo)
  ('sessao_venda_gravacao', 'transcricao', 'prd_13'),
  ('sessao_venda_gravacao', 'resumo', 'prd_13'),
  -- anexo_audio (transcricao)
  ('anexo_audio', 'transcricao', 'prd_13'),
  -- mensagem (conteudo, transcricao)
  ('mensagem', 'conteudo', 'prd_13'),
  ('mensagem', 'transcricao', 'prd_13'),
  -- conversa (nome_whatsapp, nome_contato_salvo, telefone_e164); wa_jid e
  -- wa_lid carregam o número de telefone da família
  ('conversa', 'nome_whatsapp', 'prd_13'),
  ('conversa', 'nome_contato_salvo', 'prd_13'),
  ('conversa', 'telefone_e164', 'prd_13'),
  ('conversa', 'wa_jid', 'sessao_p05'),
  ('conversa', 'wa_lid', 'sessao_p05'),
  -- dado pessoal da equipe
  ('perfil', 'nome', 'sessao_p05'),
  ('perfil', 'email', 'sessao_p05'),
  ('perfil', 'telefone_e164', 'sessao_p05'),
  ('profissional', 'nome', 'sessao_p05'),
  ('profissional', 'telefone_e164', 'sessao_p05'),
  -- texto livre que pode carregar nome de paciente ou texto de mensagem
  ('tarefa', 'titulo', 'sessao_p05'),
  ('tarefa', 'payload', 'sessao_p05'),
  ('notificacao', 'titulo', 'sessao_p05'),
  ('notificacao', 'corpo', 'sessao_p05'),
  ('automacao_execucao', 'payload', 'sessao_p05'),
  -- hash de token de uso único do formulário seguro
  ('contrato', 'formulario_token_hash', 'sessao_p05');

-- Trava de revisão: toda linha da lista precisa apontar para uma coluna que
-- existe. Um nome errado aqui deixaria a coluna real sair em claro no log.
do $$
declare
  v_faltando text;
begin
  select string_agg(s.entidade || '.' || s.coluna, ', ')
    into v_faltando
  from privado.auditoria_coluna_sensivel s
  where not exists (
    select 1
    from pg_attribute a
    where a.attrelid = to_regclass(case when s.entidade like '%.%' then s.entidade else 'public.' || s.entidade end)
      and a.attname = s.coluna
      and a.attnum > 0
      and not a.attisdropped
  );
  if v_faltando is not null then
    raise exception 'auditoria_coluna_sensivel aponta para coluna inexistente: %', v_faltando;
  end if;
end $$;


-- =============================================================================
-- 3. Funções auxiliares da auditoria
-- =============================================================================

-- --- HMAC-SHA256 com a chave do Vault ---------------------------------------
-- security definer porque lê vault.decrypted_secrets. Sem grant nenhum: um
-- papel que pudesse chamar esta função teria um oráculo para testar palpites
-- de CPF contra o log. Se a chave sumir, a função recusa (e com ela toda
-- escrita auditada): sem auditoria, sem escrita.
create function privado.hmac_auditoria(valor text) returns text
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
declare
  v_chave text;
begin
  if valor is null then
    return null;
  end if;

  select s.decrypted_secret
    into v_chave
  from vault.decrypted_secrets s
  where s.name = 'auditoria_hmac';

  if v_chave is null or v_chave = '' then
    raise exception 'chave auditoria_hmac ausente no Vault: escrita auditada recusada (PRD 13)'
      using errcode = '55000';
  end if;

  return pg_catalog.encode(extensions.hmac(valor, v_chave, 'sha256'), 'hex');
end;
$$;
comment on function privado.hmac_auditoria(text) is 'HMAC-SHA256 (hex) do valor com a chave auditoria_hmac do Vault (PRD 13 [v4.2]). Nunca hash puro. Sem grant: só as funções de auditoria chamam. Sem chave, recusa (erro 55000).';

-- --- Recorte de um registro para o log --------------------------------------
-- Recebe a linha em jsonb, as colunas que entram no log e as colunas
-- sensíveis. Devolve só as colunas pedidas; as sensíveis com valor viram
-- "[oculto]" e o HMAC delas vai numa chave "_hmac" à parte. Valor nulo fica
-- nulo (a ausência de dado não é dado pessoal).
create function privado.auditoria_recortar(registro jsonb, colunas text[], sensiveis text[]) returns jsonb
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_resultado jsonb;
  v_hmacs     jsonb;
begin
  if registro is null then
    return null;
  end if;

  select pg_catalog.jsonb_object_agg(
           k,
           case
             when k = any (sensiveis) and pg_catalog.jsonb_typeof(registro -> k) <> 'null'
               then pg_catalog.to_jsonb('[oculto]'::text)
             else registro -> k
           end)
    into v_resultado
  from pg_catalog.unnest(colunas) as k;

  select pg_catalog.jsonb_object_agg(k, privado.hmac_auditoria(registro ->> k))
    into v_hmacs
  from pg_catalog.unnest(colunas) as k
  where k = any (sensiveis)
    and pg_catalog.jsonb_typeof(registro -> k) <> 'null';

  if v_hmacs is not null then
    v_resultado := coalesce(v_resultado, '{}'::jsonb) || pg_catalog.jsonb_build_object('_hmac', v_hmacs);
  end if;

  return v_resultado;
end;
$$;
comment on function privado.auditoria_recortar(jsonb, text[], text[]) is 'Recorta um registro (jsonb) para o log de auditoria: só as colunas pedidas, sensíveis como "[oculto]" e HMAC em "_hmac" (PRD 13 [v4.2]).';

-- --- ip da requisição --------------------------------------------------------
-- O PostgREST grava os cabeçalhos HTTP em request.headers. O primeiro
-- endereço de x-forwarded-for é o do cliente. Fora de requisição (cron,
-- migration, teste) ou com cabeçalho inválido, devolve nulo.
create function privado.ip_requisicao() returns inet
  language plpgsql
  stable
  set search_path = ''
  as $$
declare
  v_cabecalhos text := pg_catalog.current_setting('request.headers', true);
  v_ip         text;
begin
  if v_cabecalhos is null or v_cabecalhos = '' then
    return null;
  end if;
  v_ip := pg_catalog.btrim(pg_catalog.split_part(v_cabecalhos::jsonb ->> 'x-forwarded-for', ',', 1));
  if v_ip is null or v_ip = '' then
    return null;
  end if;
  return v_ip::inet;
exception
  when others then
    return null;
end;
$$;
comment on function privado.ip_requisicao() is 'ip do cliente lido de request.headers (x-forwarded-for, primeiro endereço), gravado em log_auditoria.ip. Nulo fora de requisição HTTP ou com cabeçalho inválido.';

-- --- origem da escrita -------------------------------------------------------
-- 'app', 'agente', 'cron', 'webhook', 'sync' (PRD 6.7). Quem escreve define
-- app.origem na transação (set_config(..., true)); sem isso, fica nulo.
create function privado.origem_atual() returns text
  language sql
  stable
  set search_path = ''
  as $$ select nullif(pg_catalog.current_setting('app.origem', true), '') $$;
comment on function privado.origem_atual() is 'Origem da escrita para log_auditoria.origem, lida da variável de sessão app.origem (PRD 6.7, P05 item 2). Nula se não definida.';


-- =============================================================================
-- 4. privado.auditar(): gatilho genérico de auditoria (P05 item 2 [v4.2])
--
-- AFTER INSERT OR UPDATE OR DELETE, por linha. Grava em log_auditoria:
--   usuario_id   auth.uid() (nulo em cron, migration e chamadas de sistema)
--   acao         insert, update ou delete
--   entidade     nome da tabela (schema.tabela fora de public)
--   entidade_id  valor da chave primária em texto (chave composta separada
--                por "/"); as colunas da chave chegam como argumentos do
--                gatilho, calculadas do catálogo na criação
--   valor_antes  e valor_depois: no update, só as colunas que mudaram (fora
--                atualizado_em e versao, que mudam em todo update); no insert
--                e no delete, a linha inteira. Colunas sensíveis como
--                "[oculto]" mais HMAC em "_hmac".
--   origem       app.origem
--   ip           x-forwarded-for da requisição
--
-- Update que não muda nada além de atualizado_em e versao não gera linha.
-- security definer porque grava em log_auditoria, que nenhum papel da
-- aplicação consegue escrever direto (seção 5), e lê a chave do Vault.
-- =============================================================================

create function privado.auditar() returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $$
declare
  v_entidade  text := case when tg_table_schema = 'public' then tg_table_name
                           else tg_table_schema || '.' || tg_table_name end;
  v_antes     jsonb;
  v_depois    jsonb;
  v_registro  jsonb;
  v_colunas   text[];
  v_sensiveis text[];
  v_id        text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := pg_catalog.to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_depois := pg_catalog.to_jsonb(new);
  end if;
  v_registro := coalesce(v_depois, v_antes);

  if tg_op = 'UPDATE' then
    select pg_catalog.array_agg(k order by k)
      into v_colunas
    from pg_catalog.jsonb_object_keys(v_depois) as k
    where k not in ('atualizado_em', 'versao')
      and (v_antes -> k) is distinct from (v_depois -> k);

    if v_colunas is null then
      return null;   -- nada relevante mudou
    end if;
  else
    select pg_catalog.array_agg(k order by k)
      into v_colunas
    from pg_catalog.jsonb_object_keys(v_registro) as k;
  end if;

  select coalesce(pg_catalog.array_agg(s.coluna), '{}')
    into v_sensiveis
  from privado.auditoria_coluna_sensivel s
  where s.entidade = v_entidade;

  select pg_catalog.string_agg(coalesce(v_registro ->> a.chave, ''), '/' order by a.ordem)
    into v_id
  from pg_catalog.unnest(tg_argv) with ordinality as a(chave, ordem);

  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (
    auth.uid(),
    pg_catalog.lower(tg_op),
    v_entidade,
    v_id,
    privado.auditoria_recortar(v_antes, v_colunas, v_sensiveis),
    privado.auditoria_recortar(v_depois, v_colunas, v_sensiveis),
    privado.origem_atual(),
    privado.ip_requisicao()
  );

  return null;
end;
$$;
comment on function privado.auditar() is 'Gatilho genérico de auditoria (PRD 5.2, 13 [v4.2], P05 item 2): grava em log_auditoria as colunas alteradas, auth.uid(), app.origem e o ip, com as colunas de privado.auditoria_coluna_sensivel como "[oculto]" mais HMAC-SHA256 com chave do Vault. Argumentos do gatilho: as colunas da chave primária.';

-- --- Liga o gatilho em toda tabela de negócio --------------------------------
-- Todas as tabelas de public e agente, menos as exceções do P05 item 2:
--   log_auditoria       o próprio log
--   fila_sincronizacao  fila técnica do celular; a escrita que ela aplica nas
--                       tabelas de verdade é que é auditada
--   evento_familia      linha do tempo append-only, já é um registro
--   schema agente_n8n   tabelas dos nós LangChain do n8n (não entra no laço)
-- mensagem ENTRA: o PRD 13 [v4.2] lista mensagem (conteudo, transcricao)
-- entre as colunas do gatilho, e o PRD prevalece sobre a lista de exceções
-- do P05 (divergência registrada no relatório da sessão).
-- Tabela nova de public ou agente criada em migration futura precisa do
-- mesmo gatilho: o teste 005 falha se alguma ficar sem ele.

do $$
declare
  v_tabela record;
  v_chave  text;
begin
  for v_tabela in
    select c.oid, n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and n.nspname in ('public', 'agente')
      and not (n.nspname = 'public' and c.relname in ('log_auditoria', 'fila_sincronizacao', 'evento_familia'))
    order by n.nspname, c.relname
  loop
    select string_agg(format('%L', a.attname), ', ' order by k.ordem)
      into v_chave
    from pg_constraint p
    cross join unnest(p.conkey) with ordinality as k(attnum, ordem)
    join pg_attribute a on a.attrelid = p.conrelid and a.attnum = k.attnum
    where p.conrelid = v_tabela.oid and p.contype = 'p';

    if v_chave is null then
      raise exception 'tabela %.% sem chave primária: não dá para auditar', v_tabela.nspname, v_tabela.relname;
    end if;

    execute format(
      'create trigger auditar after insert or update or delete on %I.%I '
      'for each row execute function privado.auditar(%s)',
      v_tabela.nspname, v_tabela.relname, v_chave
    );
  end loop;
end $$;


-- =============================================================================
-- 5. log_auditoria imutável (P05 item 1 [v4.2], PRD 6.7, 6.10 regra 4, 21.2)
--
-- Primeira barreira, privilégio: nenhum papel da aplicação lê, grava, muda
-- ou apaga o log direto. Quem grava são as funções security definer desta
-- migration (dono postgres); quem lê é a diretoria, pela função da seção 6.
--
-- Segunda barreira, gatilho, que vale até para o dono: DELETE sempre
-- recusado; UPDATE recusado, com uma única exceção, a anonimização do ip
-- pela automação retencao_diaria (PRD 22.4 O-06). Essa exceção só passa
-- quando as quatro condições valem ao mesmo tempo:
--   a) a variável app.retencao_log_ip foi ligada por
--      privado.anonimizar_ip_log_auditoria() nesta transação;
--   b) nenhuma coluna além de ip muda;
--   c) o novo ip é nulo (anonimizar é apagar, nunca trocar por outro);
--   d) a linha é mais velha que parametro.retencao.log_ip_meses.
-- Mesmo quem forjar a variável só consegue fazer exatamente o que a
-- retenção faria. TRUNCATE recusado por gatilho de instrução.
-- =============================================================================

revoke all on table public.log_auditoria from anon, authenticated, service_role;
revoke all on sequence public.log_auditoria_id_seq from anon, authenticated, service_role;

create function privado.proteger_log_auditoria() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_meses integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'log_auditoria é imutável: DELETE não é permitido (PRD 6.7)'
      using errcode = '42501';
  end if;

  if coalesce(pg_catalog.current_setting('app.retencao_log_ip', true), '') <> 'on' then
    raise exception 'log_auditoria é imutável: UPDATE não é permitido (PRD 6.7)'
      using errcode = '42501';
  end if;

  if (pg_catalog.to_jsonb(new) - 'ip') is distinct from (pg_catalog.to_jsonb(old) - 'ip')
     or new.ip is not null then
    raise exception 'log_auditoria: a retenção só anonimiza a coluna ip, apagando o valor (PRD 22.4 O-06)'
      using errcode = '42501';
  end if;

  select (p.valor ->> 'log_ip_meses')::integer
    into v_meses
  from public.parametro p
  where p.chave = 'retencao';

  if v_meses is null or old.criado_em >= pg_catalog.now() - pg_catalog.make_interval(months => v_meses) then
    raise exception 'log_auditoria: ip ainda dentro do prazo de parametro.retencao.log_ip_meses'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
comment on function privado.proteger_log_auditoria() is 'Gatilho BEFORE UPDATE OR DELETE de log_auditoria: recusa sempre, para qualquer papel, salvo a anonimização do ip (só ip, só para nulo, só linha fora do prazo de parametro.retencao.log_ip_meses, só com app.retencao_log_ip ligada por privado.anonimizar_ip_log_auditoria). PRD 6.7 [v4.2] e 22.4 O-06.';

create trigger proteger_log_auditoria
  before update or delete on public.log_auditoria
  for each row execute function privado.proteger_log_auditoria();

create trigger recusar_truncate
  before truncate on public.log_auditoria
  for each statement execute function privado.recusar_truncate();

-- --- Anonimização do ip pela retenção (PRD 10.1 retencao_diaria, 22.4 O-06)
-- Chamada pela automação retencao_diaria (P20). O prazo vem de
-- parametro.retencao.log_ip_meses; sem o parâmetro, recusa (nenhum prazo
-- fixo no código). Devolve quantas linhas anonimizou, para o log da
-- automação gravar só contagens.
create function privado.anonimizar_ip_log_auditoria() returns integer
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_meses integer;
  v_total integer;
begin
  select (p.valor ->> 'log_ip_meses')::integer
    into v_meses
  from public.parametro p
  where p.chave = 'retencao';

  if v_meses is null then
    raise exception 'parametro retencao.log_ip_meses ausente: anonimização do ip não roda sem prazo definido (PRD 6.8, O-06)'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('app.retencao_log_ip', 'on', true);

  update public.log_auditoria l
     set ip = null
   where l.ip is not null
     and l.criado_em < pg_catalog.now() - pg_catalog.make_interval(months => v_meses);
  get diagnostics v_total = row_count;

  perform pg_catalog.set_config('app.retencao_log_ip', '', true);

  return v_total;
end;
$$;
comment on function privado.anonimizar_ip_log_auditoria() is 'Única escrita permitida em log_auditoria depois do insert: apaga o ip das linhas mais velhas que parametro.retencao.log_ip_meses (PRD 22.4 O-06). Chamada pela automação retencao_diaria (P20). Devolve a contagem.';

comment on table public.log_auditoria is 'Log de auditoria (PRD 6.7, 21.2). NUNCA editável, NUNCA deletável: UPDATE, DELETE, TRUNCATE (e também SELECT e INSERT diretos) revogados dos papéis da aplicação e recusados por gatilho, salvo a anonimização do ip pela retenção (O-06). Escrita só por privado.auditar(), privado.registrar_leitura() e demais funções security definer; leitura só pela diretoria, por privado.ler_log_auditoria(). Colunas sensíveis entram como "[oculto]" mais HMAC-SHA256 com chave do Vault (PRD 13). Exceção às colunas padrão (PRD 5.2): id bigserial.';


-- =============================================================================
-- 6. Leitura do log só pela diretoria, por função (P05 item 2, PRD 13)
--
-- Exige usuário identificado, perfil ativo, papel diretoria e sessão AAL2
-- (o log mostra quem leu dado assistencial). A própria leitura do log vira
-- linha 'leitura' no log. Sem grant: o P07 publica o wrapper em api.
-- O papel é conferido direto em usuario_papel, sem depender de
-- privado.tem_papel (que nasce na 0006); a regra é a mesma.
-- =============================================================================

create function privado.ler_log_auditoria(
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
  if auth.uid() is null
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     or not exists (
       select 1
       from public.usuario_papel up
       join public.perfil p on p.id = up.usuario_id
       where up.usuario_id = auth.uid()
         and up.papel = 'diretoria'
         and p.ativo
     ) then
    raise exception 'log de auditoria: leitura só pela diretoria com MFA (AAL2) (PRD 13)'
      using errcode = '42501';
  end if;

  perform privado.registrar_leitura(
    'log_auditoria',
    ler_log_auditoria.entidade_id,
    pg_catalog.jsonb_build_object(
      'entidade', ler_log_auditoria.entidade,
      'desde', ler_log_auditoria.desde,
      'ate', ler_log_auditoria.ate,
      'limite', ler_log_auditoria.limite
    )
  );

  return query
    select l.*
    from public.log_auditoria l
    where (ler_log_auditoria.entidade is null or l.entidade = ler_log_auditoria.entidade)
      and (ler_log_auditoria.entidade_id is null or l.entidade_id = ler_log_auditoria.entidade_id)
      and (ler_log_auditoria.desde is null or l.criado_em >= ler_log_auditoria.desde)
      and (ler_log_auditoria.ate is null or l.criado_em < ler_log_auditoria.ate)
    order by l.id desc
    limit ler_log_auditoria.limite;
end;
$$;
comment on function privado.ler_log_auditoria(text, text, timestamptz, timestamptz, integer) is 'Única leitura de log_auditoria (PRD 13): diretoria, perfil ativo, AAL2. Filtros opcionais; limite nulo = sem limite. Grava a própria leitura no log antes de devolver.';


-- =============================================================================
-- 7. Leitura auditada (P05 item 4, PRD 13 e 5.2)
--
-- Tabela assistencial não tem select direto: leitura só por
-- assistencial.ler_*, que grava 'leitura' em log_auditoria ANTES de
-- devolver. Essas funções são volatile (o PostgREST roda função stable em
-- transação só de leitura, e o insert no log falharia) e security definer
-- (leem a tabela sem que o papel da aplicação tenha select nela). A
-- checagem de papel, AAL e família atribuída fica no wrapper do schema api
-- (P07), que é o único que recebe execute; aqui nenhuma recebe grant.
-- =============================================================================

create function privado.registrar_leitura(entidade text, entidade_id text, escopo jsonb default null) returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (
    auth.uid(),
    'leitura',
    registrar_leitura.entidade,
    registrar_leitura.entidade_id,
    null,
    registrar_leitura.escopo,
    privado.origem_atual(),
    privado.ip_requisicao()
  );
end;
$$;
comment on function privado.registrar_leitura(text, text, jsonb) is 'Grava uma linha ''leitura'' em log_auditoria (PRD 5.2 e 13). Usada por toda função assistencial.ler_* antes de devolver dado, e pela leitura do próprio log.';

-- Exemplo do padrão (P05 item 4): as demais assistencial.ler_* nascem com
-- cada módulo, do mesmo jeito.
create function assistencial.ler_acompanhamento(familia_id uuid) returns setof public.acompanhamento
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  if ler_acompanhamento.familia_id is null then
    raise exception 'ler_acompanhamento: familia_id é obrigatório'
      using errcode = '22023';
  end if;

  -- 1. registra a leitura (se o insert falhar, nada é devolvido)
  perform privado.registrar_leitura(
    'acompanhamento',
    ler_acompanhamento.familia_id::text,
    pg_catalog.jsonb_build_object('familia_id', ler_acompanhamento.familia_id)
  );

  -- 2. só depois devolve
  return query
    select a.*
    from public.acompanhamento a
    where a.familia_id = ler_acompanhamento.familia_id
    order by a.criado_em, a.id;
end;
$$;
comment on function assistencial.ler_acompanhamento(uuid) is 'Leitura auditada dos acompanhamentos de uma família (P05 item 4, PRD 13): grava ''leitura'' em log_auditoria antes de devolver. volatile e security definer. Sem grant: o app chega aqui pelo wrapper do schema api (P07), que confere papel, AAL e família atribuída.';


-- =============================================================================
-- 8. privado.mascarar_documentos(texto) (P05 item 5 [v4.2], PRD 11.11, 19.5)
--
-- Definição de referência que o n8n copia (n8n/src/code/mascarar-documentos.js).
-- Aplicada ao texto de mensagem antes de gravar (agente.registrar_mensagem e
-- registrar_transcricao, P21). Regras, na ordem:
--
--   1. CPF formatado (ddd.ddd.ddd-dd) cujos dígitos verificadores batem
--      vira "[CPF ocultado]".
--   2. CPF corrido: sequência de exatamente 11 dígitos (sem dígito colado
--      antes ou depois) cujos verificadores batem vira "[CPF ocultado]".
--   3. Cartão: cada trecho de dígitos, com grupos separados por um espaço,
--      ponto, hífen ou barra, tem os grupos juntados antes do teste. Com 13
--      a 19 dígitos, passando no Luhn e sem formato de telefone (+55 com DDD
--      e 9 dígitos: trecho logo depois de "+", 13 dígitos começando por 55),
--      o trecho inteiro vira "[cartão ocultado]". Se o trecho inteiro não
--      for cartão mas tiver grupos (cartão digitado colado à validade ou a
--      outro número), procura, da esquerda para a direita, a menor sequência
--      de grupos inteiros que seja cartão, e mascara só ela.
--   4. Na mesma mensagem em que um cartão foi ocultado: validade MM/AA ou
--      MM/AAAA e os 3 ou 4 dígitos logo depois de "cvv", "cvc" ou "código de
--      segurança" viram "[dado de cartão ocultado]".
--
-- Os rótulos "[CPF ocultado]", "[cartão ocultado]" e "[dado de cartão
-- ocultado]" são parte da definição de referência (P05), iguais aos do n8n,
-- não texto de interface.
-- =============================================================================

create function privado.cpf_valido(texto text) returns boolean
  language plpgsql
  immutable
  parallel safe
  strict
  set search_path = ''
  as $$
declare
  v_digitos text := pg_catalog.regexp_replace(texto, '[^0-9]', '', 'g');
  v_soma    integer;
  v_dv1     integer;
  v_dv2     integer;
  i         integer;
begin
  if pg_catalog.length(v_digitos) <> 11 then
    return false;
  end if;

  v_soma := 0;
  for i in 1..9 loop
    v_soma := v_soma + pg_catalog.substr(v_digitos, i, 1)::integer * (11 - i);
  end loop;
  v_dv1 := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;

  v_soma := 0;
  for i in 1..10 loop
    v_soma := v_soma + pg_catalog.substr(v_digitos, i, 1)::integer * (12 - i);
  end loop;
  v_dv2 := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;

  return pg_catalog.substr(v_digitos, 10, 1)::integer = v_dv1
     and pg_catalog.substr(v_digitos, 11, 1)::integer = v_dv2;
end;
$$;
comment on function privado.cpf_valido(text) is 'Verdadeiro se o texto, só com os dígitos, tem 11 dígitos e os dois verificadores do CPF batem (P05 item 5).';

create function privado.luhn_valido(texto text) returns boolean
  language plpgsql
  immutable
  parallel safe
  strict
  set search_path = ''
  as $$
declare
  v_digitos text := pg_catalog.regexp_replace(texto, '[^0-9]', '', 'g');
  v_soma    integer := 0;
  v_dobrar  boolean := false;
  v_valor   integer;
  i         integer;
begin
  if pg_catalog.length(v_digitos) = 0 then
    return false;
  end if;
  for i in reverse pg_catalog.length(v_digitos)..1 loop
    v_valor := pg_catalog.substr(v_digitos, i, 1)::integer;
    if v_dobrar then
      v_valor := v_valor * 2;
      if v_valor > 9 then
        v_valor := v_valor - 9;
      end if;
    end if;
    v_soma := v_soma + v_valor;
    v_dobrar := not v_dobrar;
  end loop;
  return v_soma % 10 = 0;
end;
$$;
comment on function privado.luhn_valido(text) is 'Verdadeiro se os dígitos do texto passam no algoritmo de Luhn (P05 item 5).';

-- Número de cartão: 13 a 19 dígitos, Luhn válido e sem formato de telefone
-- E.164 brasileiro (precedido de "+", 13 dígitos começando por 55).
create function privado.cartao_valido(digitos text, anterior text) returns boolean
  language sql
  immutable
  parallel safe
  set search_path = ''
  as $$
  select pg_catalog.length(digitos) between 13 and 19
     and not (coalesce(anterior, '') = '+' and pg_catalog.length(digitos) = 13 and pg_catalog.left(digitos, 2) = '55')
     and privado.luhn_valido(digitos)
$$;
comment on function privado.cartao_valido(text, text) is 'Verdadeiro se os dígitos formam um cartão (13 a 19 dígitos, Luhn) e não um telefone +55 com DDD e 9 dígitos. anterior = caractere logo antes do trecho no texto (P05 item 5).';

-- Mascara um trecho de dígitos em grupos (separador de um caractere entre
-- eles). Primeiro o trecho inteiro; se ele não for cartão, a menor sequência
-- de grupos inteiros que seja, da esquerda para a direita.
create function privado.mascarar_trecho_cartao(trecho text, anterior text) returns text
  language plpgsql
  immutable
  parallel safe
  set search_path = ''
  as $$
declare
  v_grupos  text[];
  v_inicios integer[] := '{}';
  v_n       integer;
  v_pos     integer := 1;
  v_saida   text := '';
  v_achou   boolean;
  i         integer;
  j         integer;
begin
  if privado.cartao_valido(pg_catalog.regexp_replace(trecho, '[^0-9]', '', 'g'), anterior) then
    return '[cartão ocultado]';
  end if;

  v_grupos := pg_catalog.regexp_split_to_array(trecho, '[^0-9]');
  v_n := pg_catalog.array_length(v_grupos, 1);
  if v_n < 2 then
    return trecho;
  end if;

  -- posição (1-based) de cada grupo no trecho: um caractere de separador
  -- entre grupos
  for i in 1..v_n loop
    v_inicios := v_inicios || v_pos;
    v_pos := v_pos + pg_catalog.length(v_grupos[i]) + 1;
  end loop;

  i := 1;
  while i <= v_n loop
    v_achou := false;
    for j in i..v_n loop
      if privado.cartao_valido(
           pg_catalog.array_to_string(v_grupos[i:j], ''),
           case when i = 1 then anterior else pg_catalog.substr(trecho, v_inicios[i] - 1, 1) end
         ) then
        v_saida := v_saida || '[cartão ocultado]';
        v_achou := true;
        i := j + 1;
        exit;
      end if;
    end loop;
    if not v_achou then
      v_saida := v_saida || v_grupos[i];
      i := i + 1;
    end if;
    if i <= v_n then
      v_saida := v_saida || pg_catalog.substr(trecho, v_inicios[i] - 1, 1);   -- separador original
    end if;
  end loop;

  return v_saida;
end;
$$;
comment on function privado.mascarar_trecho_cartao(text, text) is 'Mascara cartão dentro de um trecho de grupos de dígitos (P05 item 5): trecho inteiro, ou a menor sequência de grupos que seja cartão. anterior = caractere antes do trecho.';

create function privado.mascarar_documentos(texto text) returns text
  language plpgsql
  immutable
  parallel safe
  set search_path = ''
  as $$
declare
  c_cpf_formatado constant text := '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}';
  c_digitos       constant text := '[0-9]+';
  c_trecho_cartao constant text := '[0-9](?:[ ./-]?[0-9])*';
  v_texto        text := texto;
  v_saida        text;
  v_pos          integer;
  v_inicio       integer;
  v_trecho       text;
  v_troca        text;
  v_houve_cartao boolean := false;
begin
  if texto is null or texto = '' then
    return texto;
  end if;

  -- 1. CPF formatado
  v_saida := '';
  v_pos := 1;
  loop
    v_inicio := pg_catalog.regexp_instr(v_texto, c_cpf_formatado, v_pos);
    exit when v_inicio = 0;
    v_trecho := pg_catalog.regexp_substr(v_texto, c_cpf_formatado, v_pos);
    v_saida := v_saida || pg_catalog.substr(v_texto, v_pos, v_inicio - v_pos)
               || case when privado.cpf_valido(v_trecho) then '[CPF ocultado]' else v_trecho end;
    v_pos := v_inicio + pg_catalog.length(v_trecho);
  end loop;
  v_texto := v_saida || pg_catalog.substr(v_texto, v_pos);

  -- 2. CPF corrido: sequência inteira de dígitos com exatamente 11
  v_saida := '';
  v_pos := 1;
  loop
    v_inicio := pg_catalog.regexp_instr(v_texto, c_digitos, v_pos);
    exit when v_inicio = 0;
    v_trecho := pg_catalog.regexp_substr(v_texto, c_digitos, v_pos);
    v_saida := v_saida || pg_catalog.substr(v_texto, v_pos, v_inicio - v_pos)
               || case when pg_catalog.length(v_trecho) = 11 and privado.cpf_valido(v_trecho)
                       then '[CPF ocultado]' else v_trecho end;
    v_pos := v_inicio + pg_catalog.length(v_trecho);
  end loop;
  v_texto := v_saida || pg_catalog.substr(v_texto, v_pos);

  -- 3. Cartão, com os grupos juntados antes do Luhn
  v_saida := '';
  v_pos := 1;
  loop
    v_inicio := pg_catalog.regexp_instr(v_texto, c_trecho_cartao, v_pos);
    exit when v_inicio = 0;
    v_trecho := pg_catalog.regexp_substr(v_texto, c_trecho_cartao, v_pos);
    v_troca := privado.mascarar_trecho_cartao(
                 v_trecho,
                 case when v_inicio > 1 then pg_catalog.substr(v_texto, v_inicio - 1, 1) else '' end
               );
    if v_troca <> v_trecho then
      v_houve_cartao := true;
    end if;
    v_saida := v_saida || pg_catalog.substr(v_texto, v_pos, v_inicio - v_pos) || v_troca;
    v_pos := v_inicio + pg_catalog.length(v_trecho);
  end loop;
  v_texto := v_saida || pg_catalog.substr(v_texto, v_pos);

  -- 4. Validade e CVV, só na mensagem que teve cartão ocultado
  if v_houve_cartao then
    v_texto := pg_catalog.regexp_replace(
                 v_texto,
                 '\y(0[1-9]|1[0-2])/([0-9]{4}|[0-9]{2})\y',
                 '[dado de cartão ocultado]',
                 'g');
    v_texto := pg_catalog.regexp_replace(
                 v_texto,
                 '(cvv|cvc|c[oó]digo de seguran[çc]a)([[:space:]]*:?[[:space:]]*)([0-9]{3,4})\y',
                 '\1\2[dado de cartão ocultado]',
                 'gi');
  end if;

  return v_texto;
end;
$$;
comment on function privado.mascarar_documentos(text) is 'Mascara CPF (formatado ou corrido, verificadores válidos) e cartão (13 a 19 dígitos em grupos separados por espaço, ponto, hífen ou barra, Luhn, fora do formato de telefone +55), e na mesma mensagem validade MM/AA ou MM/AAAA e CVV (P05 item 5 [v4.2]). Definição de referência que o n8n copia (PRD 19.5).';


-- =============================================================================
-- 9. Execute explícito revogado (redundante com o alter default privileges
--    da 0001, deixado por escrito para a revisão do SQL: nenhuma função desta
--    migration é chamável por papel da aplicação até o P07/P20/P21 concederem)
-- =============================================================================

revoke execute on function privado.hmac_auditoria(text) from public, anon, authenticated, service_role;
revoke execute on function privado.auditoria_recortar(jsonb, text[], text[]) from public, anon, authenticated, service_role;
revoke execute on function privado.ip_requisicao() from public, anon, authenticated, service_role;
revoke execute on function privado.origem_atual() from public, anon, authenticated, service_role;
revoke execute on function privado.auditar() from public, anon, authenticated, service_role;
revoke execute on function privado.proteger_log_auditoria() from public, anon, authenticated, service_role;
revoke execute on function privado.anonimizar_ip_log_auditoria() from public, anon, authenticated, service_role;
revoke execute on function privado.ler_log_auditoria(text, text, timestamptz, timestamptz, integer) from public, anon, authenticated, service_role;
revoke execute on function privado.registrar_leitura(text, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function assistencial.ler_acompanhamento(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.cpf_valido(text) from public, anon, authenticated, service_role;
revoke execute on function privado.luhn_valido(text) from public, anon, authenticated, service_role;
revoke execute on function privado.cartao_valido(text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.mascarar_trecho_cartao(text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.mascarar_documentos(text) from public, anon, authenticated, service_role;
