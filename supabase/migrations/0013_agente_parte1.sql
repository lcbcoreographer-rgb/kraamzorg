-- =============================================================================
-- 0013_agente_parte1.sql
--
-- P21 (PROMPTS.md v2) · PRD 11.7, 11.9, 11.10, 11.11, 6.8, 6.10 (regras 11 e
-- 12), 8.2 [v4.2], 19.1, 19.4, 23.1 e Apêndice A [v4.2]
--
-- Fronteira do agente, parte 1. O n8n chega ao banco só pelo papel
-- n8n_agente, que executa só as funções do schema agente listadas no
-- Apêndice A e lê e grava só as duas tabelas de agente_n8n que os nós
-- LangChain usam (D-14). Nenhuma função daqui devolve dado assistencial.
--
-- O que esta migration faz:
--   1. Papel n8n_agente, idempotente, sem senha e sem bypassrls, com
--      search_path = agente_n8n, extensions (PRD 11.10 [v4.2]). A senha é
--      definida à mão a partir do cofre, por runbook (ADR 0003).
--   2. Privilégios exatamente como o 11.10: usage em extensions; usage e
--      create em agente_n8n; select, insert e delete nas duas tabelas dele,
--      usage nas sequências, e as políticas "for all to n8n_agente"; usage no
--      schema agente e execute só nas funções do Apêndice A (concedido função
--      a função, aqui e na 0014).
--   3. Auxiliares internas (privado.agente_*): contexto de segurança de toda
--      chamada, estado e modo da conversa (11.7), textos aprovados com a
--      regra do nome vazio (23), formatação brasileira, cobertura, planos,
--      família garantida para o lead e regra 12 (nova gestação).
--   4. Funções do Apêndice A, parte 1: registrar_mensagem,
--      registrar_transcricao, pode_responder, pode_enviar, mensagem_sistema,
--      sincronizar_memoria, pausar, contexto_conversa, checar_termos_alerta,
--      mensagem_alerta, ficha_para_agente, planos_vigentes,
--      verificar_cobertura, verificar_disponibilidade, atualizar_lead e
--      registrar_marco. A chave de todas, menos registrar_mensagem e
--      registrar_transcricao, é o conversa_id (Apêndice A [v4.2]).
--   5. privado.conferir_agente_n8n(): job diário do pg_cron que confere que
--      agente_n8n tem exatamente as duas tabelas (11.10 [v4.2]).
--
-- Contrato comum das funções do schema agente (Apêndice A):
--   * security definer, set search_path = '', nomes qualificados;
--   * devolvem jsonb com "ok" e, em erro, "erro" (código curto, sem dado
--     pessoal); o erro nunca vaza como exceção para o n8n: o bloco
--     "exception" desfaz tudo o que a chamada gravou (subtransação) e
--     devolve {ok: false, erro};
--   * a primeira linha de toda função é privado.agente_contexto(), que apaga
--     qualquer JWT simulado e as marcas app.* da transação. Um n8n
--     comprometido que tentasse forjar request.jwt.claims para se passar
--     por um usuário do app (e fazer uma transição manual, por exemplo)
--     continua sendo "sistema sem usuário": só transição automática, só
--     sobe o freio, nunca baixa (PRD 8.3).
--
-- Leituras adotadas onde o PRD deixa margem (a mais segura, registradas no
-- relatório da sessão e no ADR 0003):
--   * Número da equipe = telefone de perfil ativo OU de profissional ativa
--     (a enfermeira que escreve do próprio celular não vira lead).
--   * registrar_mensagem liga a conversa nova à família que já tem uma
--     pessoa com o mesmo telefone (a mais recente, não mesclada): uma
--     família em bloqueio_total que escreve de uma conversa nova cai em
--     humano_nominal na hora, em vez de ser tratada como lead novo.
--   * Modo cliente também vale para conversa com classificação "cliente"
--     (nome salvo "paciente fechada") e para oportunidade em distrato ou
--     intercorrência depois da assinatura: a Isadora não vende a quem já
--     contratou.
--   * agente_modo ausente ou inválido vale "desligado".
--   * Textos para a família e para o agente só saem aprovados (6.8). A
--     única exceção é mensagem_alerta, que nunca devolve erro: sem texto
--     aprovado, cai no alerta_saude (ou perda) e, em último caso, usa esse
--     mesmo texto ainda que não aprovado, marcado "aprovado": false, para a
--     família nunca ficar sem resposta num alerta.
--   * O limite de 200 caracteres dos campos livres da ficha e as legendas
--     da ficha ("Nome:", "Semanas hoje:"...) são o formato que o prompt
--     isadora-system.md lê (Apêndice A), não regra de negócio ajustável,
--     como a "véspera" do P20.
-- =============================================================================


-- =============================================================================
-- 1. Papel n8n_agente (PRD 11.10 [v4.2])
--
-- Criado sem senha e de forma idempotente. O alter role logo abaixo reafirma
-- os atributos a cada aplicação, para um papel criado à mão com outro
-- atributo (superuser, bypassrls) nunca passar despercebido.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'n8n_agente') then
    create role n8n_agente login noinherit nobypassrls;
  end if;
end $$;

alter role n8n_agente nosuperuser nocreatedb nocreaterole noinherit nobypassrls noreplication;
alter role n8n_agente set search_path = agente_n8n, extensions;

comment on role n8n_agente is 'Papel do n8n (PRD 11.10, D-14): executa só as funções do Apêndice A no schema agente e lê/grava só agente_n8n.documentos e agente_n8n.chat_memoria. Sem senha na migration (definida à mão a partir do cofre, ADR 0003). Conexão pelo pooler em modo sessão, usuário n8n_agente.<ref>.';


-- =============================================================================
-- 2. Privilégios (PRD 11.10, exatamente)
-- =============================================================================

-- extensions: os operadores do pgvector moram lá, e uuid_generate_v4 dos
-- nós LangChain também.
grant usage on schema extensions to n8n_agente;

-- agente_n8n: create porque os nós PGVector e Postgres Chat Memory rodam
-- "create table if not exists" ao iniciar (o Postgres confere o privilégio
-- antes de ver que a tabela existe).
grant usage, create on schema agente_n8n to n8n_agente;
grant select, insert, delete on agente_n8n.documentos, agente_n8n.chat_memoria to n8n_agente;
grant usage on all sequences in schema agente_n8n to n8n_agente;

-- Sem estas políticas o PGVector lê zero linhas e a memória falha no insert
-- (RLS ligada na 0004). using (true): o nó de memória precisa ler a tabela
-- inteira pelo session_id; o controle de qual sessão ele lê está no build
-- (query literal, conversa_id nunca vindo do modelo, 19.5 e ADR 0003).
create policy n8n_agente on agente_n8n.documentos for all to n8n_agente using (true) with check (true);
create policy n8n_agente on agente_n8n.chat_memoria for all to n8n_agente using (true) with check (true);

-- agente: usage; o execute de cada função é concedido logo depois dela.
grant usage on schema agente to n8n_agente;


-- =============================================================================
-- 3. Auxiliares internas (privado.agente_*). Nenhuma recebe grant: só as
--    funções security definer do schema agente (dono postgres) chamam.
-- =============================================================================

-- --- 3.1 Contexto de segurança de toda chamada do agente -----------------------
create function privado.agente_contexto() returns void
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform pg_catalog.set_config('request.jwt.claims', '', true);
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
  perform pg_catalog.set_config('request.jwt.claim', '', true);
  perform pg_catalog.set_config('app.transicao', '', true);
  perform pg_catalog.set_config('app.eliminacao', '', true);
  perform pg_catalog.set_config('app.retencao_log_ip', '', true);
  perform pg_catalog.set_config('app.origem', 'agente', true);
end;
$$;
comment on function privado.agente_contexto() is 'Primeira linha de toda função do schema agente: apaga JWT simulado (auth.uid() nulo, sistema sem usuário) e as marcas app.transicao, app.eliminacao e app.retencao_log_ip da transação, e grava app.origem = agente para o log (PRD 11.10, 6.7). Sem grant.';

-- --- 3.2 Erro devolvido ao n8n --------------------------------------------------
-- Só as mensagens das validações do projeto (22023, P0002, 42501, P0001) e
-- de conversão de tipo vão ao n8n; o resto vira "erro_interno", para uma
-- mensagem do Postgres com valor de chave única (telefone, por exemplo)
-- nunca sair do banco.
create function privado.agente_erro(codigo text, mensagem text) returns jsonb
  language sql
  immutable
  set search_path = ''
  as $$
  select pg_catalog.jsonb_build_object(
    'ok', false,
    'erro', case when agente_erro.codigo in ('22023', 'P0002', '42501', 'P0001', '22P02', '22007', '22008')
                 then agente_erro.mensagem else 'erro_interno' end,
    'codigo', agente_erro.codigo)
$$;
comment on function privado.agente_erro(text, text) is 'Resposta de erro das funções do agente: {ok: false, erro, codigo}. Mensagem só das validações do projeto; o resto vira erro_interno (nenhum valor de chave sai do banco). Sem grant.';

-- --- 3.3 Parâmetros e textos ------------------------------------------------------
create function privado.agente_parametro(chave text) returns jsonb
  language sql
  stable
  set search_path = ''
  as $$ select p.valor from public.parametro p where p.chave = agente_parametro.chave $$;
comment on function privado.agente_parametro(text) is 'Valor de parametro.chave (nulo se não existir). Sem grant.';

create function privado.agente_parametro_ligado(chave text) returns boolean
  language sql
  stable
  set search_path = ''
  as $$ select coalesce(privado.agente_parametro(agente_parametro_ligado.chave) = 'true'::jsonb, false) $$;
comment on function privado.agente_parametro_ligado(text) is 'Verdadeiro só se parametro.chave for o jsonb true (ausente ou outro valor: falso, o desligado é o padrão seguro). Sem grant.';

create function privado.agente_parametro_numero(chave text) returns numeric
  language plpgsql
  stable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v jsonb := privado.agente_parametro(agente_parametro_numero.chave);
begin
  if pg_catalog.jsonb_typeof(v) = 'number' then
    return (v #>> '{}')::numeric;
  end if;
  return null;
end;
$$;
comment on function privado.agente_parametro_numero(text) is 'parametro.chave como número, ou nulo se ausente ou não numérico. Sem grant.';

-- Texto de mensagem_modelo. somente_aprovado: o que vai para a família e
-- para o agente (6.8). Falso só onde o texto nunca chega à família (aviso
-- interno ao grupo, prefixo da memória).
create function privado.agente_texto(chave text, somente_aprovado boolean) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select m.texto
  from public.mensagem_modelo m
  where m.chave = agente_texto.chave
    and (not agente_texto.somente_aprovado or m.status = 'aprovado')
$$;
comment on function privado.agente_texto(text, boolean) is 'Texto de mensagem_modelo.chave; com somente_aprovado, só status aprovado (PRD 6.8). Sem grant.';

-- Regra do nome vazio (PRD 23): sem nome, tira a variável com a vírgula e o
-- espaço vizinhos e acerta a maiúscula.
create function privado.aplicar_nome(texto text, nome text) returns text
  language plpgsql
  immutable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_texto text := aplicar_nome.texto;
  v_nome  text := nullif(pg_catalog.btrim(aplicar_nome.nome), '');
begin
  if v_texto is null or pg_catalog.strpos(v_texto, '{nome}') = 0 then
    return v_texto;
  end if;
  if v_nome is not null then
    return pg_catalog.replace(v_texto, '{nome}', v_nome);
  end if;
  v_texto := pg_catalog.regexp_replace(v_texto, ',[[:space:]]*\{nome\}', '', 'g');
  v_texto := pg_catalog.regexp_replace(v_texto, '\{nome\},?[[:space:]]*', '', 'g');
  v_texto := pg_catalog.btrim(v_texto);
  return pg_catalog.upper(pg_catalog.left(v_texto, 1)) || pg_catalog.substr(v_texto, 2);
end;
$$;
comment on function privado.aplicar_nome(text, text) is 'Troca {nome}; com nome vazio, tira a variável junto com a vírgula e o espaço vizinhos e acerta a maiúscula (PRD 23, abertura). Sem grant.';

-- Troca as variáveis {chave} numa passada só: o valor trocado nunca é
-- relido (um "{link_ficha}" escrito pela família no texto dela não vira o
-- link). Variável sem valor vira vazio. {nome} passa antes por aplicar_nome.
create function privado.aplicar_texto(texto text, nome text, variaveis jsonb) returns text
  language plpgsql
  immutable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_resto text := privado.aplicar_nome(aplicar_texto.texto, aplicar_texto.nome);
  v_saida text := '';
  v_pos   integer;
  v_fim   integer;
  v_chave text;
begin
  if v_resto is null then
    return null;
  end if;
  loop
    v_pos := pg_catalog.strpos(v_resto, '{');
    exit when v_pos = 0;
    v_fim := pg_catalog.strpos(pg_catalog.substr(v_resto, v_pos), '}');
    exit when v_fim = 0;
    v_chave := pg_catalog.substr(v_resto, v_pos + 1, v_fim - 2);
    if v_chave ~ '^[a-z_]+$' then
      v_saida := v_saida || pg_catalog.left(v_resto, v_pos - 1)
                 || coalesce(aplicar_texto.variaveis ->> v_chave, '');
    else
      v_saida := v_saida || pg_catalog.left(v_resto, v_pos - 1 + v_fim);
    end if;
    v_resto := pg_catalog.substr(v_resto, v_pos + v_fim);
  end loop;
  return v_saida || v_resto;
end;
$$;
comment on function privado.aplicar_texto(text, text, jsonb) is 'Monta um texto de mensagem_modelo: regra do nome vazio e troca das variáveis {chave} numa passada só (valor trocado nunca é relido). Sem grant.';

-- --- 3.4 Campo livre, telefone e formatação brasileira ------------------------
-- Campo livre da ficha: sem colchetes, sem quebra, até 200 caracteres
-- (formato do prompt, Apêndice A).
create function privado.campo_livre(texto text) returns text
  language sql
  immutable
  set search_path = ''
  as $$
  select nullif(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(
           pg_catalog.regexp_replace(campo_livre.texto, '[][{}]', '', 'g'),
           '[[:space:]]+', ' ', 'g')), 200), '')
$$;
comment on function privado.campo_livre(text) is 'Campo livre da ficha do agente: sem colchetes nem chaves, sem quebra de linha, até 200 caracteres (formato do prompt isadora-system.md, Apêndice A). Sem grant.';

-- E.164 a partir do que a UAZAPI manda (sender_pn, chat.phone ou a parte do
-- jid antes do @): só dígitos, com "+". Fora de 8 a 15 dígitos, nulo.
create function privado.telefone_e164(telefone text) returns text
  language plpgsql
  immutable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v text := pg_catalog.regexp_replace(coalesce(telefone_e164.telefone, ''), '[^0-9]', '', 'g');
begin
  if pg_catalog.length(v) between 8 and 15 then
    return '+' || v;
  end if;
  return null;
end;
$$;
comment on function privado.telefone_e164(text) is 'Telefone em E.164 (PRD 5.2): só dígitos com "+", nulo fora de 8 a 15 dígitos. Sem grant.';

create function privado.formatar_reais(centavos bigint) returns text
  language sql
  immutable
  set search_path = ''
  as $$
  select case when formatar_reais.centavos is null then null else
    'R$ ' || pg_catalog.regexp_replace((formatar_reais.centavos / 100)::text, '([0-9])(?=([0-9]{3})+$)', '\1.', 'g')
    || case when formatar_reais.centavos % 100 <> 0
            then ',' || pg_catalog.lpad((formatar_reais.centavos % 100)::text, 2, '0') else '' end
  end
$$;
comment on function privado.formatar_reais(bigint) is 'Centavos em reais no formato brasileiro ("R$ 4.200", "R$ 3.433,33"), CLAUDE.md. Sem grant.';

create function privado.formatar_data(dia date) returns text
  language sql
  immutable
  set search_path = ''
  as $$ select pg_catalog.to_char(formatar_data.dia, 'DD/MM/YYYY') $$;
comment on function privado.formatar_data(date) is 'Data no formato brasileiro (24/09/2026). Sem grant.';

create function privado.agente_hoje() returns date
  language sql
  stable
  set search_path = ''
  as $$ select (pg_catalog.now() at time zone 'America/Sao_Paulo')::date $$;
comment on function privado.agente_hoje() is 'Hoje no fuso da operação (America/Sao_Paulo). Sem grant.';

-- "quinta-feira, 24/09/2026, 19:40" (cabeçalho do prompt da Isadora).
create function privado.formatar_data_hora(instante timestamptz) returns text
  language sql
  stable
  set search_path = ''
  as $$
  select (array['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'])
           [pg_catalog.date_part('dow', formatar_data_hora.instante at time zone 'America/Sao_Paulo')::integer + 1]
         || ', ' || pg_catalog.to_char(formatar_data_hora.instante at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI')
$$;
comment on function privado.formatar_data_hora(timestamptz) is 'Dia da semana, data e hora em Brasília, no formato do cabeçalho do prompt ("quinta-feira, 24/09/2026, 19:40"). Sem grant.';

-- Nome de lugar normalizado para comparar (minúsculo, sem acento, só letras
-- e números separados por um espaço).
create function privado.normalizar_local(texto text) returns text
  language sql
  immutable
  set search_path = ''
  as $$
  select nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
           pg_catalog.lower(privado.sem_acento(coalesce(normalizar_local.texto, ''))),
           '[^a-z0-9]+', ' ', 'g')), '')
$$;
comment on function privado.normalizar_local(text) is 'Texto minúsculo, sem acento, só letras e números separados por espaço: chave de comparação de cidade, bairro, termo de alerta e plano. Sem grant.';

-- Data escrita pela família ou pelo modelo: dd/mm/aaaa, dd/mm/aa ou
-- aaaa-mm-dd. Qualquer outra forma: nulo.
create function privado.agente_data(texto text) returns date
  language plpgsql
  stable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v text := pg_catalog.btrim(coalesce(agente_data.texto, ''));
begin
  if v ~ '^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$' then
    return pg_catalog.to_date(v, 'YYYY-MM-DD');
  elsif v ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' then
    return pg_catalog.to_date(v, 'DD/MM/YYYY');
  elsif v ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}$' then
    return pg_catalog.to_date(v, 'DD/MM/YY');
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;
comment on function privado.agente_data(text) is 'Data em dd/mm/aaaa, dd/mm/aa ou aaaa-mm-dd; outra forma ou data inválida: nulo. Sem grant.';

-- Booleano vindo do modelo: true/false em json ou "sim"/"não" em texto.
create function privado.agente_booleano(valor jsonb) returns boolean
  language plpgsql
  immutable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v text;
begin
  if pg_catalog.jsonb_typeof(agente_booleano.valor) = 'boolean' then
    return (agente_booleano.valor #>> '{}')::boolean;
  end if;
  v := privado.normalizar_local(agente_booleano.valor #>> '{}');
  if v in ('sim', 's', 'true', 'verdadeiro') then
    return true;
  elsif v in ('nao', 'n', 'false', 'falso') then
    return false;
  end if;
  return null;
end;
$$;
comment on function privado.agente_booleano(jsonb) is 'Booleano do jsonb do agente: true/false ou "sim"/"não"; outro valor, nulo. Sem grant.';

-- Telefones de uma lista em parametro (agente_whitelist, plantao_telefones),
-- já na chave de comparação de privado.telefone_normalizado.
create function privado.agente_lista_telefones(chave text) returns setof text
  language plpgsql
  stable
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v jsonb := privado.agente_parametro(agente_lista_telefones.chave);
begin
  if pg_catalog.jsonb_typeof(v) <> 'array' then
    return;
  end if;
  return query
    select privado.telefone_normalizado(t.valor)
    from pg_catalog.jsonb_array_elements_text(v) as t(valor)
    where privado.telefone_normalizado(t.valor) is not null;
end;
$$;
comment on function privado.agente_lista_telefones(text) is 'Telefones de uma lista de parametro, normalizados por privado.telefone_normalizado. Lista ausente ou inválida: nenhum. Sem grant.';

-- --- 3.5 Estado e modo da conversa (PRD 11.7 [v4.2]) --------------------------
-- Precedência: silêncio (equipe ou plantão), desligado, teste fora da
-- lista, humano_nominal, humano_comercial, nao_lead, pausado, cliente,
-- vendas. desligado e teste vêm antes do resto porque valem para o ambiente
-- inteiro (o fluxo 3 para em desligado e, em teste fora da lista, só avisa a
-- equipe).
create function privado.agente_estado_conversa(conversa_id uuid) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c           public.conversa;
  v_tel         text;
  v_equipe      boolean := false;
  v_plantao     boolean := false;
  v_whitelist   boolean := false;
  v_agente_modo text;
  v_familia     uuid;
  v_estado      public.estado_sensivel;
  v_nao_contatar boolean := false;
  v_cliente     boolean := false;
  v_contratou   boolean := false;
  v_atendimento boolean := false;
  v_nao_lead    boolean;
  v_pausa       boolean;
  v_modo        text;
  v_motivo      text;
  v_handoff     boolean;
begin
  select c.* into v_c from public.conversa c where c.id = agente_estado_conversa.conversa_id;
  if not found then
    return null;
  end if;

  v_tel := privado.telefone_normalizado(v_c.telefone_e164);
  if v_tel is not null then
    v_equipe := exists (select 1 from public.perfil p
                        where p.ativo and privado.telefone_normalizado(p.telefone_e164) = v_tel)
             or exists (select 1 from public.profissional pr
                        where pr.ativa and privado.telefone_normalizado(pr.telefone_e164) = v_tel);
    v_plantao := exists (select 1 from privado.agente_lista_telefones('plantao_telefones') t(n) where t.n = v_tel);
    v_whitelist := exists (select 1 from privado.agente_lista_telefones('agente_whitelist') t(n) where t.n = v_tel);
  end if;

  v_agente_modo := privado.agente_parametro('agente_modo') #>> '{}';
  if v_agente_modo is null or v_agente_modo not in ('desligado', 'teste', 'producao') then
    v_agente_modo := 'desligado';
  end if;

  if v_c.familia_id is not null then
    v_familia := privado.familia_vigente(v_c.familia_id);
    select greatest(f.estado_sensivel, fv.estado_sensivel), f.nao_contatar or fv.nao_contatar
      into v_estado, v_nao_contatar
    from public.familia f
    join public.familia fv on fv.id = v_familia
    where f.id = v_c.familia_id;

    v_atendimento := exists (
      select 1 from public.acompanhamento a
      where a.familia_id in (v_c.familia_id, v_familia));
    v_cliente := v_atendimento
      or exists (
        select 1 from public.oportunidade o
        where o.familia_id in (v_c.familia_id, v_familia)
          and o.estagio_p2 in ('assinado', 'cobranca_gerada', 'pagamento_confirmado', 'nota_fiscal_emitida',
                               'consulta_prenatal_agendada', 'consulta_realizada', 'enfermeira_designada',
                               'aguardando_nascimento', 'bebe_nasceu', 'aguardando_alta', 'atendimento_liberado',
                               'intercorrencia', 'distrato'));
  end if;
  v_cliente := v_cliente or v_c.classificacao = 'cliente';
  v_contratou := v_cliente;
  v_cliente := v_cliente or v_estado = 'atencao';

  v_nao_lead := v_c.classificacao in ('candidata', 'fornecedor', 'consultorio', 'parceiro_medico', 'outro');
  v_pausa := v_c.agente_pausado_ate is not null and v_c.agente_pausado_ate > pg_catalog.now();
  v_handoff := exists (select 1 from public.handoff h
                       where h.conversa_id = v_c.id and h.status in ('aberto', 'assumido'));

  if v_equipe or v_plantao then
    v_modo := 'silencio';
    v_motivo := case when v_equipe then 'numero_equipe' else 'numero_plantao' end;
  elsif v_agente_modo = 'desligado' then
    v_modo := 'desligado';
    v_motivo := 'agente_desligado';
  elsif v_agente_modo = 'teste' and not v_whitelist then
    v_modo := 'teste';
    v_motivo := 'fora_da_lista_de_teste';
  elsif v_estado in ('bloqueio_total', 'encerrado_sensivel') then
    v_modo := 'humano_nominal';
    v_motivo := 'freio_' || v_estado::text;
  elsif v_c.agente_encerrado_em is not null then
    v_modo := 'humano_comercial';
    v_motivo := v_c.agente_encerrado_motivo;
  elsif v_nao_lead then
    v_modo := 'nao_lead';
    v_motivo := v_c.classificacao::text;
  elsif v_pausa then
    v_modo := 'pausado';
    v_motivo := v_c.agente_pausa_motivo;
  elsif v_cliente then
    v_modo := 'cliente';
    v_motivo := case when v_estado = 'atencao' then 'freio_atencao' else 'cliente' end;
  else
    v_modo := 'vendas';
    v_motivo := null;
  end if;

  return pg_catalog.jsonb_build_object(
    'conversa_id', v_c.id,
    'familia_id', v_familia,
    'familia_conversa_id', v_c.familia_id,
    'pessoa_id', v_c.pessoa_id,
    'modo', v_modo,
    'motivo', v_motivo,
    'agente_modo', v_agente_modo,
    'na_whitelist', v_whitelist,
    'numero_equipe', v_equipe,
    'numero_plantao', v_plantao,
    'pausa', v_pausa,
    'pausado_ate', v_c.agente_pausado_ate,
    'agente_pausa_motivo', v_c.agente_pausa_motivo,
    'humano_comercial', v_c.agente_encerrado_em is not null,
    'agente_encerrado_em', v_c.agente_encerrado_em,
    'agente_encerrado_motivo', v_c.agente_encerrado_motivo,
    'estado_sensivel', v_estado,
    'nao_contatar', coalesce(v_nao_contatar, false),
    'cliente', v_cliente,
    'contratou', v_contratou,
    'atendimento', v_atendimento,
    'nao_lead', v_nao_lead,
    'classificacao', v_c.classificacao,
    'iniciada_por', v_c.iniciada_por,
    'handoff_aberto', v_handoff,
    'telefone_e164', v_c.telefone_e164
  );
end;
$$;
comment on function privado.agente_estado_conversa(uuid) is 'Estado da conversa para o agente (PRD 11.7 [v4.2]): modo na precedência silêncio, desligado, teste fora da lista, humano_nominal, humano_comercial, nao_lead, pausado, cliente, vendas; mais família vigente, freio, pausa, lista de teste e transferência aberta. Nulo se a conversa não existe. Uso interno: pode_responder e pode_enviar escolhem o que devolver. Sem grant.';

-- Primeiro nome para {nome}: pessoa da conversa, senão o nome do WhatsApp.
-- Só a primeira palavra, e só se começar por letra.
create function privado.agente_primeiro_nome(conversa_id uuid) returns text
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v text;
begin
  select coalesce(nullif(pg_catalog.btrim(p.nome), ''), nullif(pg_catalog.btrim(c.nome_whatsapp), ''))
    into v
  from public.conversa c
  left join public.pessoa p on p.id = c.pessoa_id
  where c.id = agente_primeiro_nome.conversa_id;
  v := pg_catalog.split_part(coalesce(v, ''), ' ', 1);
  if v ~ '^[[:alpha:]]' then
    return pg_catalog.regexp_replace(v, '[^[:alpha:]''-]+$', '');
  end if;
  return null;
end;
$$;
comment on function privado.agente_primeiro_nome(uuid) is 'Primeiro nome para {nome} (PRD 23): pessoa da conversa ou nome do WhatsApp, primeira palavra, só se começar por letra. Sem grant.';

-- --- 3.6 Planos vigentes e cobertura --------------------------------------------
create function privado.agente_chave_plano(nome text) returns text
  language sql
  immutable
  set search_path = ''
  as $$ select pg_catalog.replace(privado.normalizar_local(agente_chave_plano.nome), ' ', '_') $$;
comment on function privado.agente_chave_plano(text) is 'Chave do plano nas variáveis do prompt (valor.essencial, parcela.continuado): nome sem acento, minúsculo, com "_". Sem grant.';

create function privado.agente_planos() returns jsonb
  language sql
  stable
  set search_path = ''
  as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'pacote_id', p.id,
           'chave', privado.agente_chave_plano(p.nome),
           'nome', p.nome,
           'linha', p.linha,
           'dias', p.dias,
           'horas_por_visita', pg_catalog.trim_scale(v.horas_por_visita),
           'horas_totais', pg_catalog.trim_scale(p.dias * v.horas_por_visita),
           'valor_centavos', v.valor_centavos,
           'valor', privado.formatar_reais(v.valor_centavos),
           'parcelas', v.parcelas_max_sem_juros,
           'valor_parcela_centavos', pg_catalog.round(v.valor_centavos::numeric / greatest(v.parcelas_max_sem_juros, 1))::bigint,
           'valor_parcela', privado.formatar_reais(pg_catalog.round(v.valor_centavos::numeric / greatest(v.parcelas_max_sem_juros, 1))::bigint),
           'parcela_texto', v.parcelas_max_sem_juros::text || 'x de '
                            || privado.formatar_reais(pg_catalog.round(v.valor_centavos::numeric / greatest(v.parcelas_max_sem_juros, 1))::bigint),
           'destaque', v.destaque,
           'pagina', p.pagina_pdf,
           'gemelar', p.gemelar)
         order by p.ordem, p.nome), '[]'::jsonb)
  from public.pacote p
  join public.pacote_versao v on v.pacote_id = p.id
  where p.ativo
    and v.vigencia_inicio <= privado.agente_hoje()
    and (v.vigencia_fim is null or v.vigencia_fim >= privado.agente_hoje())
$$;
comment on function privado.agente_planos() is 'Planos com versão vigente hoje (PRD 6.3, 11.9): nome, linha, dias, horas por visita e no total, valor, parcelas e valor da parcela (centavos e formatados), destaque, página do PDF, gemelar. Sem grant.';

-- Cobertura (PRD 11.9): localidade e alias (o bairro primeiro, porque
-- "Alphaville" é localidade dentro de Barueri), depois a cidade, depois o
-- município do IBGE pela região intermediária de uma praça. Nunca usa DDD.
create function privado.agente_cobertura(cidade text, bairro text, uf text) returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_uf         text := case when pg_catalog.btrim(coalesce(agente_cobertura.uf, '')) ~ '^[A-Za-z]{2}$'
                            then pg_catalog.upper(pg_catalog.btrim(agente_cobertura.uf)) end;
  v_candidatos text[];
  v_cand       text;
  v_c          public.cidade;
  v_r          public.regiao;
  v_m          public.municipio;
  v_status     text;
  v_taxa       integer;
begin
  v_candidatos := array_remove(array[
    privado.normalizar_local(agente_cobertura.bairro),
    privado.normalizar_local(agente_cobertura.cidade),
    -- "São Paulo - SP", "Londrina/PR": tira a sigla do fim
    pg_catalog.regexp_replace(privado.normalizar_local(agente_cobertura.cidade), ' [a-z]{2}$', '')
  ], null);

  -- 1 e 2. localidade/alias do bairro, depois da cidade
  foreach v_cand in array v_candidatos loop
    select c.* into v_c
    from public.cidade c
    where (v_uf is null or c.uf = v_uf)
      and (privado.normalizar_local(c.nome) = v_cand
           or exists (select 1 from pg_catalog.unnest(c.aliases) a(nome) where privado.normalizar_local(a.nome) = v_cand))
    order by c.atendida desc, c.requer_confirmacao
    limit 1;
    exit when found;
  end loop;

  if v_c.id is not null then
    select r.* into v_r from public.regiao r where r.id = v_c.regiao_id;
    v_status := case
                  when not v_c.atendida or v_r.id is null or not v_r.ativa then 'nao_atendida'
                  when v_c.requer_confirmacao then 'confirmar'
                  else 'atendida'
                end;
    v_taxa := coalesce(nullif(v_c.taxa_deslocamento_centavos, 0), v_r.taxa_deslocamento_centavos, 0);
    return pg_catalog.jsonb_build_object(
      'status', v_status,
      'praca', case when v_status <> 'nao_atendida' then v_r.praca end,
      'regiao_id', case when v_status <> 'nao_atendida' then v_r.id end,
      'cidade_id', v_c.id,
      'municipio_codigo_ibge', null,
      'localidade', v_c.nome,
      'tem_taxa', v_status <> 'nao_atendida' and v_taxa > 0,
      'taxa_centavos', case when v_status <> 'nao_atendida' then v_taxa end);
  end if;

  -- 3. município do IBGE: mesma região intermediária de uma praça atendida
  foreach v_cand in array v_candidatos[2:] loop
    select m.* into v_m
    from public.municipio m
    where (v_uf is null or m.uf = v_uf)
      and privado.normalizar_local(m.nome) = v_cand
    limit 1;
    exit when found;
  end loop;

  if v_m.codigo_ibge is not null then
    select r.* into v_r
    from public.regiao r
    where r.ativa
      and (privado.normalizar_local(r.nome) = privado.normalizar_local(v_m.regiao_intermediaria)
           or privado.normalizar_local(r.praca) = privado.normalizar_local(v_m.regiao_intermediaria)
           or exists (select 1
                      from public.cidade c
                      join public.municipio m2 on privado.normalizar_local(m2.nome) = privado.normalizar_local(c.nome)
                                              and m2.uf = c.uf
                      where c.regiao_id = r.id and c.atendida
                        and m2.regiao_intermediaria = v_m.regiao_intermediaria))
    order by r.nome
    limit 1;
    return pg_catalog.jsonb_build_object(
      'status', case when v_r.id is not null then 'confirmar' else 'nao_atendida' end,
      'praca', v_r.praca,
      'regiao_id', v_r.id,
      'cidade_id', null,
      'municipio_codigo_ibge', v_m.codigo_ibge,
      'localidade', v_m.nome,
      'tem_taxa', false,
      'taxa_centavos', null);
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'desconhecida', 'praca', null, 'regiao_id', null, 'cidade_id', null,
    'municipio_codigo_ibge', null, 'localidade', null, 'tem_taxa', false, 'taxa_centavos', null);
end;
$$;
comment on function privado.agente_cobertura(text, text, text) is 'Cobertura (PRD 11.9): localidade e alias (bairro, depois cidade), depois município do IBGE na mesma região intermediária de uma praça ativa (confirmar) ou fora (nao_atendida); nome não reconhecido: desconhecida. Nunca usa DDD. Devolve ids para gravar na ficha; agente.verificar_cobertura escolhe o que mostrar. Sem grant.';

-- --- 3.7 Oportunidade aberta e família garantida -----------------------------
create function privado.agente_oportunidade_aberta(familia_id uuid) returns public.oportunidade
  language sql
  stable
  set search_path = ''
  as $$
  select o.*
  from public.oportunidade o
  where o.familia_id = agente_oportunidade_aberta.familia_id
    and (o.estagio_p2 is null or o.estagio_p2 not in ('perdido', 'cancelado', 'distrato'))
  order by o.criado_em desc
  limit 1
$$;
comment on function privado.agente_oportunidade_aberta(uuid) is 'Oportunidade aberta da família (PRD 6.10 regra 14: fora de perdido, cancelado e distrato no P2). Sem grant.';

-- Transição feita pelo agente: nunca derruba a chamada inteira. Devolve nulo
-- quando deu certo, ou o código do aviso quando a máquina recusou.
create function privado.agente_transicionar(oportunidade_id uuid, para text, motivo text) returns text
  language plpgsql
  volatile
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.transicionar('p1', agente_transicionar.oportunidade_id, agente_transicionar.para, agente_transicionar.motivo);
  return null;
exception
  when others then
    return 'transicao_recusada:' || agente_transicionar.para;
end;
$$;
comment on function privado.agente_transicionar(uuid, text, text) is 'Transição do pipeline 1 pedida pelo agente, por privado.transicionar (só as automáticas, porque o agente é sistema sem usuário). Recusa vira aviso, nunca erro da chamada. Sem grant.';

-- Garante família (e, com com_oportunidade, oportunidade aberta no pipeline
-- 1) para a conversa: a família da conversa; senão a família de uma pessoa
-- com o mesmo telefone (deduplicação, PRD 6.10 regra 2); senão uma nova.
-- Liga a conversa à família e à pessoa. Classificação nao_classificado
-- vira lead quando nasce oportunidade.
create function privado.agente_garantir_familia(conversa_id uuid, com_oportunidade boolean, nome text default null)
  returns uuid
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c       public.conversa;
  v_fam     uuid;
  v_pessoa  uuid;
  v_nome    text := privado.campo_livre(agente_garantir_familia.nome);
  v_o       public.oportunidade;
  v_tel     text;
begin
  select c.* into v_c from public.conversa c where c.id = agente_garantir_familia.conversa_id for update;
  if not found then
    raise exception 'conversa_nao_encontrada' using errcode = 'P0002';
  end if;
  v_tel := privado.telefone_normalizado(v_c.telefone_e164);

  if v_c.familia_id is not null then
    v_fam := privado.familia_vigente(v_c.familia_id);
  end if;

  if v_fam is null and v_tel is not null then
    select privado.familia_vigente(p.familia_id), p.id
      into v_fam, v_pessoa
    from public.pessoa p
    join public.familia f on f.id = p.familia_id
    where privado.telefone_normalizado(p.telefone_e164) = v_tel
    order by (f.mesclada_em_id is null) desc, f.criado_em desc
    limit 1;
    if v_pessoa is not null and not exists (select 1 from public.pessoa p where p.id = v_pessoa and p.familia_id = v_fam) then
      v_pessoa := null;
    end if;
  end if;

  if v_fam is null then
    insert into public.familia (nome_exibicao)
    values (coalesce(v_nome, privado.campo_livre(v_c.nome_whatsapp), v_c.telefone_e164, v_c.id::text))
    returning id into v_fam;

    insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
    values (v_fam, 'lead_entrou', 'lead_entrou',
            pg_catalog.jsonb_build_object('origem', 'agente', 'conversa_id', v_c.id), false);
  end if;

  -- pessoa: a da conversa; senão a da família com o mesmo telefone; senão
  -- nasce uma com o nome que houver (sem nome, fica para quando chegar)
  v_pessoa := coalesce(
    (select p.id from public.pessoa p where p.id = v_c.pessoa_id and p.familia_id = v_fam),
    v_pessoa,
    (select p.id from public.pessoa p
      where p.familia_id = v_fam and v_tel is not null and privado.telefone_normalizado(p.telefone_e164) = v_tel
      limit 1));
  if v_pessoa is null and coalesce(v_nome, privado.campo_livre(v_c.nome_whatsapp)) is not null then
    insert into public.pessoa (familia_id, papel, nome, telefone_e164, contato_principal)
    values (v_fam, 'responsavel', coalesce(v_nome, privado.campo_livre(v_c.nome_whatsapp)), v_c.telefone_e164,
            not exists (select 1 from public.pessoa p where p.familia_id = v_fam and p.contato_principal))
    returning id into v_pessoa;
  end if;

  update public.conversa c
     set familia_id = v_fam,
         pessoa_id = coalesce(v_pessoa, c.pessoa_id),
         classificacao = case when agente_garantir_familia.com_oportunidade and c.classificacao = 'nao_classificado'
                              then 'lead'::public.classificacao_contato else c.classificacao end
   where c.id = v_c.id;

  if agente_garantir_familia.com_oportunidade then
    v_o := privado.agente_oportunidade_aberta(v_fam);
    if v_o.id is null then
      insert into public.oportunidade (familia_id, pipeline, estagio_p1)
      values (v_fam, 1, 'novo')
      returning * into v_o;
    end if;
    if v_o.pipeline = 1 and v_o.estagio_p2 is null and v_o.estagio_p1 = 'novo' then
      perform privado.agente_transicionar(v_o.id, 'em_conversa_ia', 'agente');
    end if;
  end if;

  return v_fam;
end;
$$;
comment on function privado.agente_garantir_familia(uuid, boolean, text) is 'Família da conversa, criada quando falta (PRD 11.9, Apêndice A atualizar_lead): deduplica pelo telefone da pessoa (regra 2), liga conversa e pessoa, e com com_oportunidade garante oportunidade aberta no pipeline 1 (novo → em_conversa_ia pela máquina de estado). Sem grant.';


-- =============================================================================
-- 4. Funções do Apêndice A, parte 1
-- =============================================================================

-- --- 4.1 agente.registrar_mensagem ------------------------------------------------
-- Resolve a conversa por LID, telefone e jid, nessa ordem; cria ou atualiza
-- (E.164, LID, nome salvo, quem iniciou, wa_jid com o chatid mais recente);
-- mascara CPF e cartão; deduplica pelo wa_message_id; lê "paciente
-- potencial" e "paciente fechada" no nome salvo (convenção da Kraamzorg,
-- PRD 11.5). Única função que recebe o jid (Apêndice A [v4.2]).
create function agente.registrar_mensagem(
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
  v_jid        text := nullif(pg_catalog.btrim(registrar_mensagem.jid), '');
  v_lid        text := nullif(pg_catalog.btrim(registrar_mensagem.lid), '');
  v_msg_id     text := nullif(pg_catalog.btrim(registrar_mensagem.wa_message_id), '');
  v_tipo       text := coalesce(nullif(pg_catalog.btrim(registrar_mensagem.tipo), ''), 'texto');
  v_nome_wa    text := privado.campo_livre(registrar_mensagem.nome_whatsapp);
  v_contato    text := privado.campo_livre(registrar_mensagem.nome_contato);
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

  -- 1. resolve: LID, telefone, jid
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
    --     antiga com o mesmo jid perde o jid, que não é mais dela).
    if v_jid is not null and v_c.wa_jid is distinct from v_jid then
      update public.conversa c set wa_jid = null where c.wa_jid = v_jid and c.id <> v_c.id;
    end if;
    update public.conversa c
       set wa_jid = coalesce(v_jid, c.wa_jid),
           wa_lid = coalesce(v_lid, c.wa_lid),
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

  -- 5. mensagem, mascarada, sem duplicar pelo wa_message_id
  v_primeira := not exists (select 1 from public.mensagem m where m.conversa_id = v_c.id);
  insert into public.mensagem (conversa_id, direcao, enviado_por, tipo, conteudo, wa_message_id)
  values (v_c.id, v_direcao, v_por, v_tipo, privado.mascarar_documentos(registrar_mensagem.conteudo), v_msg_id)
  on conflict (wa_message_id) do nothing
  returning id into v_mensagem;

  if v_mensagem is not null then
    if v_direcao = 'entrada' then
      update public.conversa c set ultima_entrada_em = pg_catalog.now() where c.id = v_c.id;
    else
      update public.conversa c set ultima_saida_em = pg_catalog.now() where c.id = v_c.id;
    end if;
  end if;

  v_estado := privado.agente_estado_conversa(v_c.id);
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'conversa_id', v_c.id,
    'mensagem_id', v_mensagem,
    'duplicada', v_mensagem is null,
    'primeira_mensagem', v_primeira and v_mensagem is not null,
    'classificacao', v_estado ->> 'classificacao',
    'numero_equipe', (v_estado ->> 'numero_equipe')::boolean,
    'numero_plantao', (v_estado ->> 'numero_plantao')::boolean,
    'agrupamento_segundos', privado.agente_parametro_numero('agente_debounce_segundos'));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_mensagem(text, text, text, text, text, text, text, text, text, text) is 'Apêndice A [v4.2]: resolve a conversa por LID, telefone e jid (nessa ordem), cria ou atualiza (wa_jid sempre com o chatid mais recente), liga à família pelo telefone, lê "paciente fechada"/"paciente potencial" do nome salvo, grava a mensagem mascarada sem duplicar pelo wa_message_id. Devolve {ok, conversa_id, primeira_mensagem, classificacao, numero_equipe, numero_plantao, agrupamento_segundos, duplicada}.';
grant execute on function agente.registrar_mensagem(text, text, text, text, text, text, text, text, text, text) to n8n_agente;

-- --- 4.2 agente.registrar_transcricao -------------------------------------------
create function agente.registrar_transcricao(wa_message_id text, texto text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_conversa uuid;
begin
  perform privado.agente_contexto();
  if nullif(pg_catalog.btrim(registrar_transcricao.wa_message_id), '') is null then
    raise exception 'registrar_transcricao: wa_message_id é obrigatório' using errcode = '22023';
  end if;
  update public.mensagem m
     set transcricao = privado.mascarar_documentos(registrar_transcricao.texto)
   where m.wa_message_id = pg_catalog.btrim(registrar_transcricao.wa_message_id)
  returning m.conversa_id into v_conversa;
  if v_conversa is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'mensagem_nao_encontrada');
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'conversa_id', v_conversa);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_transcricao(text, text) is 'Apêndice A [v4.2]: grava a transcrição do áudio já mascarada na coluna transcricao da mensagem, único UPDATE permitido em mensagem (PRD 5.2).';
grant execute on function agente.registrar_transcricao(text, text) to n8n_agente;

-- --- 4.3 agente.pode_responder ----------------------------------------------------
create function agente.pode_responder(conversa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v jsonb;
begin
  perform privado.agente_contexto();
  v := privado.agente_estado_conversa(pode_responder.conversa_id);
  if v is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'modo', v ->> 'modo',
    'motivo', v ->> 'motivo',
    'agente_modo', v ->> 'agente_modo',
    'na_whitelist', (v ->> 'na_whitelist')::boolean,
    'pausa', (v ->> 'pausa')::boolean,
    'pausado_ate', v -> 'pausado_ate',
    'humano_comercial', (v ->> 'humano_comercial')::boolean,
    'agente_encerrado_motivo', v -> 'agente_encerrado_motivo',
    'transferencia_aberta', (v ->> 'handoff_aberto')::boolean,
    'alerta_internacao_ativo', privado.agente_parametro_ligado('alerta_internacao_ativo'),
    'alerta_emocional_ativo', privado.agente_parametro_ligado('alerta_emocional_ativo'),
    'alerta_saude_sensivel_ativo', privado.agente_parametro_ligado('alerta_saude_sensivel_ativo'));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.pode_responder(uuid) is 'Apêndice A [v4.2]: modo da conversa (11.7: silencio, desligado, teste, humano_nominal, humano_comercial, nao_lead, pausado, cliente, vendas), pausa, motivo, agente_modo, na_whitelist, humano_comercial com agente_encerrado_motivo e os parâmetros de ativação dos textos clínicos. Chave: conversa_id.';
grant execute on function agente.pode_responder(uuid) to n8n_agente;

-- --- 4.4 agente.pode_enviar (PRD 8.2 [v4.2]) -------------------------------------
-- 'resposta': ignora a pausa e o humano_comercial criados pelo handoff_id
-- desta execução (conferido pelo que registrar_handoff gravou em
-- handoff.dados._agente); bloqueia freio bloqueio_total/encerrado_sensivel,
-- humano_comercial e pausa de outra origem; aplica a lista de teste; nunca
-- aplica janela, nao_contatar nem limite diário; vale sem família.
-- Demais tipos: privado.pode_enviar_mensagem (exige família), mais pausa e
-- modo, no instante da chamada.
create function agente.pode_enviar(conversa_id uuid, tipo text, handoff_id uuid default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v        jsonb;
  v_agente jsonb;
  v_c      public.conversa;
  v_pausa_desta      boolean := false;
  v_encerrado_desta  boolean := false;
  v_res    jsonb;
begin
  perform privado.agente_contexto();

  if pode_enviar.tipo is null or pode_enviar.tipo not in ('resposta', 'conteudo', 'operacional', 'marketing') then
    return pg_catalog.jsonb_build_object('ok', false, 'pode', false, 'motivo', 'tipo_invalido', 'erro', 'tipo_invalido');
  end if;

  v := privado.agente_estado_conversa(pode_enviar.conversa_id);
  if v is null then
    return pg_catalog.jsonb_build_object('ok', false, 'pode', false, 'motivo', 'conversa_nao_encontrada', 'erro', 'conversa_nao_encontrada');
  end if;

  if v ->> 'modo' = 'silencio' then
    return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', v ->> 'motivo');
  end if;
  if v ->> 'agente_modo' = 'desligado' then
    return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'agente_desligado');
  end if;
  if v ->> 'agente_modo' = 'teste' and not (v ->> 'na_whitelist')::boolean then
    return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'fora_da_lista_de_teste');
  end if;
  if v ->> 'estado_sensivel' in ('bloqueio_total', 'encerrado_sensivel') then
    return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'freio_' || (v ->> 'estado_sensivel'));
  end if;

  select c.* into v_c from public.conversa c where c.id = pode_enviar.conversa_id;

  if pode_enviar.tipo = 'resposta' then
    if pode_enviar.handoff_id is not null then
      select h.dados -> '_agente' into v_agente
      from public.handoff h
      where h.id = pode_enviar.handoff_id and h.conversa_id = pode_enviar.conversa_id;
      v_pausa_desta := v_agente is not null
                       and v_c.agente_pausado_ate is not null
                       and (v_agente ->> 'pausa_ate')::timestamptz = v_c.agente_pausado_ate;
      v_encerrado_desta := v_agente is not null
                           and v_c.agente_encerrado_em is not null
                           and (v_agente ->> 'encerrado_em')::timestamptz = v_c.agente_encerrado_em;
    end if;
    if (v ->> 'humano_comercial')::boolean and not v_encerrado_desta then
      return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'humano_comercial');
    end if;
    if (v ->> 'pausa')::boolean and not v_pausa_desta then
      return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'pausado');
    end if;
    return pg_catalog.jsonb_build_object('ok', true, 'pode', true, 'motivo', null);
  end if;

  -- conteudo, operacional, marketing
  if (v ->> 'familia_id') is null then
    return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'familia_obrigatoria');
  end if;
  if (v ->> 'humano_comercial')::boolean then
    return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'humano_comercial');
  end if;
  if (v ->> 'nao_lead')::boolean then
    return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'nao_lead');
  end if;
  if (v ->> 'pausa')::boolean then
    return pg_catalog.jsonb_build_object('ok', true, 'pode', false, 'motivo', 'pausado');
  end if;

  v_res := privado.pode_enviar_mensagem((v ->> 'familia_id')::uuid, pode_enviar.tipo::public.categoria_automacao);
  return pg_catalog.jsonb_build_object('ok', true, 'pode', coalesce((v_res ->> 'pode')::boolean, false),
                                       'motivo', v_res -> 'motivo');
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm) || pg_catalog.jsonb_build_object('pode', false);
end;
$$;
comment on function agente.pode_enviar(uuid, text, uuid) is 'Apêndice A e PRD 8.2 [v4.2]: {ok, pode, motivo}. tipo resposta ignora a pausa e o humano_comercial criados pelo handoff_id desta execução, bloqueia freio bloqueio_total/encerrado_sensivel, humano_comercial e pausa de outra origem, aplica a lista de teste e nunca a janela, nao_contatar nem o limite diário; vale sem família. conteudo, operacional e marketing seguem privado.pode_enviar_mensagem (exige família) mais pausa e modo. Falha nunca libera o envio.';
grant execute on function agente.pode_enviar(uuid, text, uuid) to n8n_agente;

-- --- 4.5 agente.mensagem_sistema ----------------------------------------------------
-- Só textos aprovados de uma lista fechada: para a família (midia_recebida,
-- fallback_confirmar, encaminhamentos de não lead, audio_nao_transcrito) e,
-- [v4.2], para o agente, instrucao_sem_aviso (fluxo 2, nó 11, 23.4).
-- Textos de alerta só por agente.mensagem_alerta.
create function agente.mensagem_sistema(conversa_id uuid, chave text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_texto text;
  v_destinatario text;
begin
  perform privado.agente_contexto();
  if mensagem_sistema.chave is null
     or mensagem_sistema.chave not in ('midia_recebida', 'fallback_confirmar', 'nao_lead_candidata',
                                       'nao_lead_fornecedor', 'nao_lead_consultorio', 'audio_nao_transcrito',
                                       'instrucao_sem_aviso') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'chave_nao_permitida', 'texto', null);
  end if;
  if not exists (select 1 from public.conversa c where c.id = mensagem_sistema.conversa_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada', 'texto', null);
  end if;

  select m.destinatario into v_destinatario from public.mensagem_modelo m where m.chave = mensagem_sistema.chave;
  v_texto := privado.agente_texto(mensagem_sistema.chave, true);
  if v_texto is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'texto_nao_aprovado', 'texto', null,
                                         'chave', mensagem_sistema.chave);
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'chave', mensagem_sistema.chave,
    'destinatario', v_destinatario,
    'texto', privado.aplicar_texto(v_texto, privado.agente_primeiro_nome(mensagem_sistema.conversa_id), '{}'::jsonb));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.mensagem_sistema(uuid, text) is 'Apêndice A [v4.2]: texto aprovado de mensagem_modelo, com o nome quando houver, só para midia_recebida, fallback_confirmar, nao_lead_candidata/fornecedor/consultorio, audio_nao_transcrito e instrucao_sem_aviso (para o agente). Chave fora da lista ou texto não aprovado: {ok: false, texto: null}.';
grant execute on function agente.mensagem_sistema(uuid, text) to n8n_agente;

-- --- 4.6 agente.sincronizar_memoria (Apêndice A [v4.2]) --------------------------
-- Formato do Postgres Chat Memory (LangChain): message = {type, content,
-- additional_kwargs, response_metadata}, session_id = conversa.id::text.
-- Papéis:
--   ia         troca o content da última fala 'ai' da vez (gravada pelo nó
--              26b depois da última mensagem da família); sem ela, insere
--   equipe     insere 'ai' com o prefixo de mensagem_modelo
--              memoria_prefixo_equipe (texto do Apêndice A)
--   sistema    insere 'system'
--   followup   insere 'ai' (o follow-up é gerado fora do nó de memória; P25,
--              extensão registrada no ADR 0003)
--   descartado apaga a última fala 'ai' da vez, quando nada do que a IA
--              gerou chegou à família (texto sempre nulo)
-- "Da vez": a linha 'ai' é a última da sessão e foi gravada depois da última
-- mensagem da família; senão pertence a uma resposta anterior e nunca é
-- trocada nem apagada.
create function agente.sincronizar_memoria(conversa_id uuid, papel text, texto text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_sessao    text := sincronizar_memoria.conversa_id::text;
  v_texto     text := nullif(pg_catalog.btrim(privado.mascarar_documentos(sincronizar_memoria.texto)), '');
  v_ult_id    integer;
  v_ult_tipo  text;
  v_ult_em    timestamptz;
  v_da_vez    boolean := false;
  v_prefixo   text;
  v_acao      text;
begin
  perform privado.agente_contexto();

  if sincronizar_memoria.papel is null
     or sincronizar_memoria.papel not in ('ia', 'equipe', 'sistema', 'followup', 'descartado') then
    raise exception 'sincronizar_memoria: papel deve ser ia, equipe, sistema, followup ou descartado' using errcode = '22023';
  end if;
  if not exists (select 1 from public.conversa c where c.id = sincronizar_memoria.conversa_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if sincronizar_memoria.papel <> 'descartado' and v_texto is null then
    raise exception 'sincronizar_memoria: texto é obrigatório para o papel %', sincronizar_memoria.papel using errcode = '22023';
  end if;

  select cm.id, cm.message ->> 'type', cm.criado_em
    into v_ult_id, v_ult_tipo, v_ult_em
  from agente_n8n.chat_memoria cm
  where cm.session_id = v_sessao
  order by cm.id desc
  limit 1
  for update;

  v_da_vez := v_ult_tipo = 'ai'
              and v_ult_em >= coalesce((select pg_catalog.max(m.enviada_em) from public.mensagem m
                                        where m.conversa_id = sincronizar_memoria.conversa_id
                                          and m.direcao = 'entrada'), '-infinity'::timestamptz);

  case sincronizar_memoria.papel
    when 'ia' then
      if v_da_vez then
        update agente_n8n.chat_memoria cm
           set message = pg_catalog.jsonb_set(cm.message, '{content}', pg_catalog.to_jsonb(v_texto))
         where cm.id = v_ult_id;
        v_acao := 'trocada';
      else
        insert into agente_n8n.chat_memoria (session_id, message)
        values (v_sessao, pg_catalog.jsonb_build_object('type', 'ai', 'content', v_texto,
                                                        'additional_kwargs', '{}'::jsonb, 'response_metadata', '{}'::jsonb));
        v_acao := 'inserida';
      end if;
    when 'equipe' then
      v_prefixo := privado.agente_texto('memoria_prefixo_equipe', false);
      if v_prefixo is null then
        return pg_catalog.jsonb_build_object('ok', false, 'erro', 'prefixo_equipe_ausente');
      end if;
      insert into agente_n8n.chat_memoria (session_id, message)
      values (v_sessao, pg_catalog.jsonb_build_object('type', 'ai', 'content', v_prefixo || v_texto,
                                                      'additional_kwargs', '{}'::jsonb, 'response_metadata', '{}'::jsonb));
      v_acao := 'inserida';
    when 'sistema' then
      insert into agente_n8n.chat_memoria (session_id, message)
      values (v_sessao, pg_catalog.jsonb_build_object('type', 'system', 'content', v_texto,
                                                      'additional_kwargs', '{}'::jsonb, 'response_metadata', '{}'::jsonb));
      v_acao := 'inserida';
    when 'followup' then
      insert into agente_n8n.chat_memoria (session_id, message)
      values (v_sessao, pg_catalog.jsonb_build_object('type', 'ai', 'content', v_texto,
                                                      'additional_kwargs', '{}'::jsonb, 'response_metadata', '{}'::jsonb));
      v_acao := 'inserida';
    when 'descartado' then
      if v_da_vez then
        delete from agente_n8n.chat_memoria cm where cm.id = v_ult_id;
        v_acao := 'apagada';
      else
        v_acao := 'nada_a_apagar';
      end if;
  end case;

  return pg_catalog.jsonb_build_object('ok', true, 'acao', v_acao, 'session_id', v_sessao);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.sincronizar_memoria(uuid, text, text) is 'Apêndice A [v4.2]: memória do Postgres Chat Memory (LangChain, session_id = conversa.id). ia troca o content da última fala ai da vez (ou insere); equipe insere ai com o prefixo memoria_prefixo_equipe; sistema insere system; followup insere ai; descartado apaga a última fala ai da vez. Nenhum outro type.';
grant execute on function agente.sincronizar_memoria(uuid, text, text) to n8n_agente;

-- --- 4.7 agente.pausar ----------------------------------------------------------------
-- horas nulo: parametro agente_pausa_humano_horas (fluxo 3, nó 8). Nunca
-- encurta uma pausa maior que já está valendo.
create function agente.pausar(conversa_id uuid, horas numeric, motivo text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_horas numeric := coalesce(pausar.horas, privado.agente_parametro_numero('agente_pausa_humano_horas'));
  v_ate   timestamptz;
  v_c     public.conversa;
begin
  perform privado.agente_contexto();
  if v_horas is null or v_horas <= 0 then
    raise exception 'pausar: horas precisa ser positiva (ou parametro agente_pausa_humano_horas definido)' using errcode = '22023';
  end if;
  select c.* into v_c from public.conversa c where c.id = pausar.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;

  v_ate := pg_catalog.now() + pg_catalog.make_interval(secs => (v_horas * 3600)::double precision);
  if v_c.agente_pausado_ate is null or v_ate > v_c.agente_pausado_ate then
    update public.conversa c
       set agente_pausado_ate = v_ate,
           agente_pausa_motivo = coalesce(privado.campo_livre(pausar.motivo), c.agente_pausa_motivo)
     where c.id = v_c.id;
  else
    v_ate := v_c.agente_pausado_ate;
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'horas', v_horas, 'pausado_ate', v_ate);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.pausar(uuid, numeric, text) is 'Apêndice A [v4.2]: atualiza agente_pausado_ate (horas nulo usa parametro agente_pausa_humano_horas; nunca encurta pausa maior). Devolve {ok, horas, pausado_ate}.';
grant execute on function agente.pausar(uuid, numeric, text) to n8n_agente;

-- --- 4.8 agente.contexto_conversa -------------------------------------------------
-- Mensagens {de, texto, em} da mais antiga para a mais nova, com "de" em
-- familia, isadora, equipe ou sistema, e a posição da última resposta
-- (índice 0 da lista; -1 sem resposta): o pedido atual começa depois dela.
create function agente.contexto_conversa(conversa_id uuid, limite integer) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c         public.conversa;
  v_mensagens jsonb;
  v_posicao   integer;
begin
  perform privado.agente_contexto();
  if contexto_conversa.limite is null or contexto_conversa.limite < 1 then
    raise exception 'contexto_conversa: limite precisa ser positivo' using errcode = '22023';
  end if;
  select c.* into v_c from public.conversa c where c.id = contexto_conversa.conversa_id;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;

  with ultimas as (
    select m.direcao, m.enviado_por, m.tipo, m.conteudo, m.transcricao, m.enviada_em, m.criado_em
    from public.mensagem m
    where m.conversa_id = v_c.id
    order by m.enviada_em desc, m.criado_em desc
    limit contexto_conversa.limite
  ),
  ordenadas as (
    select u.*, pg_catalog.row_number() over (order by u.enviada_em, u.criado_em) - 1 as posicao
    from ultimas u
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'de', case when o.direcao = 'entrada' then 'familia'
                      when o.enviado_por = 'ia' then 'isadora'
                      when o.enviado_por = 'humano' then 'equipe'
                      else 'sistema' end,
           'texto', coalesce(nullif(pg_catalog.btrim(o.conteudo), ''), o.transcricao),
           'tipo', o.tipo,
           'em', o.enviada_em) order by o.posicao), '[]'::jsonb),
         coalesce(max(o.posicao) filter (where o.direcao = 'saida'), -1)
    into v_mensagens, v_posicao
  from ordenadas o;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'mensagens', v_mensagens,
    'iniciada_por', v_c.iniciada_por,
    'classificacao', v_c.classificacao,
    'posicao_ultima_resposta', v_posicao);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.contexto_conversa(uuid, integer) is 'Apêndice A [v4.2]: últimas mensagens {de, texto, tipo, em} (de em familia, isadora, equipe, sistema), da mais antiga para a mais nova, quem iniciou, classificação e posicao_ultima_resposta (onde começa o pedido atual).';
grant execute on function agente.contexto_conversa(uuid, integer) to n8n_agente;

-- --- 4.9 agente.checar_termos_alerta (PRD 11.11 item 1) --------------------------
-- Sem acento, minúsculo, por palavra ou expressão inteira: termo e texto
-- viram sequências de palavras separadas por um espaço e a comparação é de
-- " termo " dentro de " texto " (assim "cura" não pega "curativo").
-- Vários termos: bloqueio_total antes de handoff_saude; entre os de saúde,
-- alerta_saude (que manda procurar urgência) antes de outra chave.
create function agente.checar_termos_alerta(texto text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_texto  text := ' ' || coalesce(privado.normalizar_local(checar_termos_alerta.texto), '') || ' ';
  v_termos jsonb;
  v_prim   record;
begin
  perform privado.agente_contexto();

  with achados as (
    select t.termo, t.acao, t.mensagem_chave
    from public.termo_alerta t
    where t.ativo
      and privado.normalizar_local(t.termo) is not null
      and pg_catalog.strpos(v_texto, ' ' || privado.normalizar_local(t.termo) || ' ') > 0
  )
  select a.termo, a.acao, a.mensagem_chave into v_prim
  from achados a
  order by (a.acao = 'bloqueio_total') desc, (a.mensagem_chave = 'alerta_saude') desc,
           pg_catalog.length(a.termo) desc, a.termo
  limit 1;

  select coalesce(pg_catalog.jsonb_agg(t.termo order by t.termo), '[]'::jsonb) into v_termos
  from public.termo_alerta t
  where t.ativo
    and privado.normalizar_local(t.termo) is not null
    and pg_catalog.strpos(v_texto, ' ' || privado.normalizar_local(t.termo) || ' ') > 0;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'alerta', v_prim.termo is not null,
    'acao', v_prim.acao,
    'termo', v_prim.termo,
    'mensagem_chave', v_prim.mensagem_chave,
    'termos', v_termos);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.checar_termos_alerta(text) is 'Apêndice A e PRD 11.11 item 1: {ok, alerta, acao, termo, mensagem_chave, termos}. Comparação sem acento, minúscula, por palavra ou expressão inteira contra termo_alerta ativo; bloqueio_total tem precedência.';
grant execute on function agente.checar_termos_alerta(text) to n8n_agente;

-- --- 4.10 agente.mensagem_alerta (Apêndice A [v4.2]) -----------------------------
-- Nunca devolve erro. Chaves aceitas: alerta_saude, alerta_internacao,
-- alerta_emocional e alerta_saude_sensivel (ação alerta_saude; as três
-- últimas só com o parâmetro de ativação ligado) e perda (ação perda).
-- Chave desconhecida, parâmetro desligado ou texto não aprovado: alerta_saude
-- (ou perda, quando a ação é perda).
create function agente.mensagem_alerta(conversa_id uuid, acao text, chave text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_acao     text;
  v_padrao   text;
  v_chave    text;
  v_texto    text;
  v_aprovado boolean := true;
  v_nome     text;
begin
  begin
    perform privado.agente_contexto();
    v_acao := case
                when pg_catalog.lower(pg_catalog.btrim(coalesce(mensagem_alerta.acao, ''))) = 'perda' then 'perda'
                when nullif(pg_catalog.btrim(coalesce(mensagem_alerta.acao, '')), '') is null
                     and mensagem_alerta.chave = 'perda' then 'perda'
                else 'alerta_saude'
              end;
    v_padrao := case when v_acao = 'perda' then 'perda' else 'alerta_saude' end;

    if v_acao = 'perda' then
      v_chave := 'perda';
    else
      v_chave := case mensagem_alerta.chave
                   when 'alerta_saude' then 'alerta_saude'
                   when 'alerta_internacao' then
                     case when privado.agente_parametro_ligado('alerta_internacao_ativo') then 'alerta_internacao' end
                   when 'alerta_emocional' then
                     case when privado.agente_parametro_ligado('alerta_emocional_ativo') then 'alerta_emocional' end
                   when 'alerta_saude_sensivel' then
                     case when privado.agente_parametro_ligado('alerta_saude_sensivel_ativo') then 'alerta_saude_sensivel' end
                 end;
      v_chave := coalesce(v_chave, v_padrao);
    end if;

    v_texto := privado.agente_texto(v_chave, true);
    if v_texto is null and v_chave <> v_padrao then
      v_chave := v_padrao;
      v_texto := privado.agente_texto(v_chave, true);
    end if;
    if v_texto is null then
      -- último recurso: o texto do padrão, mesmo sem aprovação registrada
      v_texto := privado.agente_texto(v_padrao, false);
      v_aprovado := false;
    end if;

    v_nome := privado.agente_primeiro_nome(mensagem_alerta.conversa_id);
    return pg_catalog.jsonb_build_object(
      'ok', v_texto is not null,
      'texto', privado.aplicar_texto(v_texto, v_nome, '{}'::jsonb),
      'chave', v_chave,
      'chave_pedida', mensagem_alerta.chave,
      'acao', v_acao,
      'aprovado', v_aprovado and v_texto is not null);
  exception
    when others then
      -- nunca devolve erro: o texto do padrão, sem nome
      v_padrao := case when pg_catalog.lower(coalesce(mensagem_alerta.acao, '')) = 'perda' then 'perda' else 'alerta_saude' end;
      select m.texto into v_texto from public.mensagem_modelo m where m.chave = v_padrao;
      return pg_catalog.jsonb_build_object(
        'ok', v_texto is not null,
        'texto', privado.aplicar_nome(v_texto, null),
        'chave', v_padrao,
        'chave_pedida', mensagem_alerta.chave,
        'acao', v_padrao,
        'aprovado', false);
  end;
end;
$$;
comment on function agente.mensagem_alerta(uuid, text, text) is 'Apêndice A [v4.2]: texto de alerta com o nome quando houver. Aceita alerta_saude, alerta_internacao, alerta_emocional, alerta_saude_sensivel (as três com o parâmetro de ativação ligado) e perda; chave desconhecida, parâmetro desligado ou texto não aprovado devolvem alerta_saude (ou perda, com ação perda). Nunca devolve erro.';
grant execute on function agente.mensagem_alerta(uuid, text, text) to n8n_agente;

-- --- 4.11 agente.planos_vigentes -----------------------------------------------------
create function agente.planos_vigentes() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.agente_contexto();
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'planos', (select coalesce(pg_catalog.jsonb_agg(p - 'pacote_id' - 'chave'), '[]'::jsonb)
               from pg_catalog.jsonb_array_elements(privado.agente_planos()) as p));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.planos_vigentes() is 'Apêndice A: pacotes com versão vigente (nome, linha, dias, horas por visita, horas totais, valor, parcelas, valor da parcela, destaque, página, gemelar).';
grant execute on function agente.planos_vigentes() to n8n_agente;

-- --- 4.12 agente.verificar_cobertura ---------------------------------------------------
create function agente.verificar_cobertura(cidade text, bairro text, uf text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v       jsonb;
  v_taxa  boolean := privado.agente_parametro_ligado('taxa_visivel_agente');
  v_saida jsonb;
begin
  perform privado.agente_contexto();
  if privado.normalizar_local(verificar_cobertura.cidade) is null
     and privado.normalizar_local(verificar_cobertura.bairro) is null then
    raise exception 'verificar_cobertura: informe a cidade ou o bairro' using errcode = '22023';
  end if;
  v := privado.agente_cobertura(verificar_cobertura.cidade, verificar_cobertura.bairro, verificar_cobertura.uf);
  v_saida := pg_catalog.jsonb_build_object(
    'ok', true,
    'status', v ->> 'status',
    'praca', v -> 'praca',
    'localidade', v -> 'localidade',
    'tem_taxa', coalesce((v ->> 'tem_taxa')::boolean, false));
  if v_taxa and coalesce((v ->> 'tem_taxa')::boolean, false) then
    v_saida := v_saida || pg_catalog.jsonb_build_object(
      'taxa_centavos', (v ->> 'taxa_centavos')::integer,
      'taxa', privado.formatar_reais((v ->> 'taxa_centavos')::bigint));
  end if;
  return v_saida;
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.verificar_cobertura(text, text, text) is 'Apêndice A: {ok, status (atendida, confirmar, nao_atendida, desconhecida), praca, localidade, tem_taxa}; o valor da taxa só com parametro taxa_visivel_agente ligado. Localidade e alias, depois cidade, depois município pela região intermediária. Nunca usa DDD.';
grant execute on function agente.verificar_cobertura(text, text, text) to n8n_agente;

-- --- 4.13 agente.verificar_disponibilidade ------------------------------------------
create function agente.verificar_disponibilidade(dpp text, cidade text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_dpp    date := privado.agente_data(verificar_disponibilidade.dpp);
  v_cob    jsonb;
  v_status text := 'confirmar_com_equipe';
begin
  perform privado.agente_contexto();
  if v_dpp is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'dpp_invalida', 'status', 'confirmar_com_equipe');
  end if;
  v_cob := privado.agente_cobertura(verificar_disponibilidade.cidade, null, null);
  if v_cob ->> 'status' = 'atendida' and (v_cob ->> 'regiao_id') is not null then
    v_status := privado.disponibilidade(v_dpp, (v_cob ->> 'regiao_id')::uuid);
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'status', v_status);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm) || pg_catalog.jsonb_build_object('status', 'confirmar_com_equipe');
end;
$$;
comment on function agente.verificar_disponibilidade(text, text) is 'Apêndice A e PRD 11.2: {ok, status} com disponivel ou confirmar_com_equipe (privado.disponibilidade), nunca números. Cidade fora da cobertura confirmada ou DPP inválida: confirmar_com_equipe.';
grant execute on function agente.verificar_disponibilidade(text, text) to n8n_agente;

-- --- 4.14 agente.ficha_para_agente (Apêndice A [v4.2]) ----------------------------
-- Só dado comercial. O texto da ficha segue o formato do cabeçalho de
-- n8n/prompts/isadora-system.md; campos livres com até 200 caracteres, sem
-- colchetes nem quebra; historico_sensivel só como sim ou não.
create function agente.ficha_para_agente(conversa_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_estado   jsonb;
  v_c        public.conversa;
  v_f        public.familia;
  v_o        public.oportunidade;
  v_p        public.pessoa;
  v_planos   jsonb := privado.agente_planos();
  v_hoje     date := privado.agente_hoje();
  v_ni       constant text := 'não informado';
  v_cob      jsonb;
  v_taxa_vis boolean := privado.agente_parametro_ligado('taxa_visivel_agente');
  v_pdf      jsonb := privado.agente_parametro('pdf_apresentacao');
  v_linhas   text[] := '{}';
  v_sessao   text;
  v_handoff  public.handoff;
  v_plano_nome text;
  v_quer     boolean := false;
  v_taxas    jsonb := '[]'::jsonb;
  v_horarios jsonb := privado.agente_parametro('horarios_edilaine');
  v_valores  text;
  v_semanas  text;
begin
  perform privado.agente_contexto();
  v_estado := privado.agente_estado_conversa(ficha_para_agente.conversa_id);
  if v_estado is null then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  select c.* into v_c from public.conversa c where c.id = ficha_para_agente.conversa_id;
  if (v_estado ->> 'familia_id') is not null then
    select f.* into v_f from public.familia f where f.id = (v_estado ->> 'familia_id')::uuid;
    v_o := privado.agente_oportunidade_aberta(v_f.id);
  end if;
  select p.* into v_p from public.pessoa p where p.id = v_c.pessoa_id;
  select h.* into v_handoff from public.handoff h
  where h.conversa_id = v_c.id and h.status in ('aberto', 'assumido')
  order by h.criado_em desc limit 1;

  if v_f.id is not null and (v_f.cidade_informada is not null or v_f.bairro is not null) then
    v_cob := privado.agente_cobertura(v_f.cidade_informada, v_f.bairro, null);
  end if;
  if v_f.dpp is not null then
    v_semanas := (public.ig(v_f.dpp, v_hoje)).texto;
  end if;
  select pc.nome into v_plano_nome from public.pacote pc where pc.id = v_o.plano_interesse_pacote_id;
  v_quer := v_o.qualificacao ? 'quer_contratar_em';

  v_sessao := case
                when exists (select 1 from public.sessao_venda s where s.familia_id = v_f.id and s.status = 'realizada')
                  then 'realizada'
                when exists (select 1 from public.sessao_venda s where s.familia_id = v_f.id and s.status = 'agendada')
                  then 'agendada, a equipe confirma o horário'
                when v_o.sessao_interesse_em is not null then 'interesse registrado, aguardando a equipe'
                else 'nenhuma'
              end;

  v_linhas := array[
    'Nome: ' || coalesce(privado.campo_livre(v_p.nome), privado.campo_livre(v_c.nome_whatsapp), v_ni),
    'Para quem é o cuidado: ' || coalesce(case v_o.para_quem when 'propria' then 'ela mesma'
                                                             when 'presente' then 'presente para outra pessoa'
                                                             when 'outro' then 'outra pessoa' end, v_ni),
    'Semanas hoje: ' || case when v_f.data_nascimento is not null then 'bebê já nasceu'
                             when v_semanas is not null then v_semanas || ' · DPP ' || privado.formatar_data(v_f.dpp)
                                                              || ' (estimativa informada pela família)'
                             else v_ni end,
    'Bebê já nasceu: ' || case when v_f.data_nascimento is not null then 'sim' else 'não' end,
    'Cidade e bairro: ' || coalesce(nullif(pg_catalog.concat_ws(', ', privado.campo_livre(v_f.cidade_informada),
                                                                 privado.campo_livre(v_f.bairro)), ''), v_ni)
      || ' · cobertura: ' || coalesce(v_cob ->> 'status', v_ni)
      || case when v_cob is null then ''
              when coalesce((v_cob ->> 'tem_taxa')::boolean, false)
                then ', com taxa' || case when v_taxa_vis then ' de ' || privado.formatar_reais((v_cob ->> 'taxa_centavos')::bigint) else '' end
              else ', sem taxa' end,
    'Primeiro bebê: ' || case v_f.primeira_gestacao when true then 'sim' when false then 'não' else v_ni end
      || ' · Gemelar: ' || case when v_f.id is null then v_ni when v_f.gemelar then 'sim' else 'não' end,
    'Rede de apoio: ' || coalesce(privado.campo_livre(v_o.qualificacao ->> 'rede_apoio'), v_ni),
    'Principal preocupação: ' || coalesce(privado.campo_livre(v_o.qualificacao ->> 'principal_preocupacao'), v_ni),
    'Histórico sensível informado: ' || case when coalesce(v_f.historico_sensivel, false) then 'sim' else 'não' end,
    'Etapa: ' || coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text, 'novo')
      || ' · apresentação: ' || case when v_o.pdf_enviado_em is not null
                                      then 'enviada em ' || pg_catalog.to_char(v_o.pdf_enviado_em at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
                                      else 'ainda não enviada' end,
    'Conversa com a Edilaine: ' || v_sessao,
    'Plano de interesse: ' || coalesce(v_plano_nome, v_ni)
      || ' · pagamento preferido: ' || coalesce(privado.campo_livre(v_o.pagamento_preferido), v_ni),
    'Retorno combinado: ' || coalesce(privado.formatar_data(v_o.proximo_contato_em), 'nenhum'),
    'Transferência aberta: ' || case when v_handoff.id is not null then 'sim (' || v_handoff.motivo::text || ')' else 'não' end
  ];

  if v_taxa_vis then
    select coalesce(pg_catalog.jsonb_agg(distinct t.taxa), '[]'::jsonb) into v_taxas
    from (select coalesce(nullif(c.taxa_deslocamento_centavos, 0), r.taxa_deslocamento_centavos) as taxa
          from public.cidade c left join public.regiao r on r.id = c.regiao_id
          where c.atendida) t
    where t.taxa > 0;
  end if;

  select pg_catalog.string_agg(x.p ->> 'nome' || ': ' || (x.p ->> 'valor') || ' ou ' || (x.p ->> 'parcela_texto'), E'\n'
                               order by x.i)
    into v_valores
  from pg_catalog.jsonb_array_elements(v_planos) with ordinality as x(p, i);
  if v_taxa_vis and pg_catalog.jsonb_array_length(v_taxas) > 0 then
    select v_valores || E'\n' || pg_catalog.string_agg('Taxa de deslocamento: ' || privado.formatar_reais(t::bigint), E'\n')
      into v_valores
    from pg_catalog.jsonb_array_elements_text(v_taxas) t;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'ficha', pg_catalog.array_to_string(v_linhas, E'\n'),
    'modo', v_estado ->> 'modo',
    'data_hora', privado.formatar_data_hora(pg_catalog.now()),
    'semanas', v_semanas,
    'historico_sensivel', coalesce(v_f.historico_sensivel, false),
    'cobertura', v_cob ->> 'status',
    'estagio', coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text),
    'planos', (select pg_catalog.string_agg(
                        (p ->> 'nome') || ' · ' || coalesce(p ->> 'linha', '') || ' · ' || (p ->> 'dias') || ' dias · '
                        || pg_catalog.replace(p ->> 'horas_por_visita', '.', ',') || ' h por visita · '
                        || pg_catalog.replace(p ->> 'horas_totais', '.', ',') || ' h no total · '
                        || (p ->> 'valor') || ' · ' || (p ->> 'parcela_texto')
                        || coalesce(' · ' || (p ->> 'destaque'), '')
                        || coalesce(' · página ' || (p ->> 'pagina'), ''),
                        E'\n' order by x.i)
               from pg_catalog.jsonb_array_elements(v_planos) with ordinality as x(p, i)),
    'valores_permitidos', v_valores,
    'pdf_status', case when v_o.pdf_enviado_em is not null
                       then 'enviado em ' || pg_catalog.to_char(v_o.pdf_enviado_em at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
                       else 'ainda não enviado' end,
    'horarios_edilaine', case when v_horarios is null or v_horarios = 'null'::jsonb then 'sem horários cadastrados'
                              when pg_catalog.jsonb_typeof(v_horarios) = 'string' then v_horarios #>> '{}'
                              else v_horarios::text end,
    'valor', (select coalesce(pg_catalog.jsonb_object_agg(p ->> 'chave', p ->> 'valor'), '{}'::jsonb)
              from pg_catalog.jsonb_array_elements(v_planos) p)
             || pg_catalog.jsonb_build_object('minimo',
                  (select privado.formatar_reais(min((p ->> 'valor_centavos')::bigint))
                   from pg_catalog.jsonb_array_elements(v_planos) p where not (p ->> 'gemelar')::boolean)),
    'parcela', (select coalesce(pg_catalog.jsonb_object_agg(p ->> 'chave', p ->> 'parcela_texto'), '{}'::jsonb)
                from pg_catalog.jsonb_array_elements(v_planos) p),
    'pagina', pg_catalog.jsonb_build_object(
                'filho_unico', (select min((p ->> 'pagina')::integer) from pg_catalog.jsonb_array_elements(v_planos) p
                                where not (p ->> 'gemelar')::boolean),
                'gemelar', (select min((p ->> 'pagina')::integer) from pg_catalog.jsonb_array_elements(v_planos) p
                            where (p ->> 'gemelar')::boolean)),
    'validador', pg_catalog.jsonb_build_object(
                   'planos', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'nome', p ->> 'nome', 'apelidos', '[]'::jsonb,
                                       'valor_centavos', (p ->> 'valor_centavos')::bigint,
                                       'parcelas', (p ->> 'parcelas')::integer,
                                       'parcela_centavos', (p ->> 'valor_parcela_centavos')::bigint)), '[]'::jsonb)
                              from pg_catalog.jsonb_array_elements(v_planos) p),
                   'taxas_centavos', v_taxas,
                   'valor_minimo_centavos', (select min((p ->> 'valor_centavos')::bigint)
                                             from pg_catalog.jsonb_array_elements(v_planos) p
                                             where not (p ->> 'gemelar')::boolean),
                   'listas', privado.agente_parametro('validador_listas'),
                   'motivo_em_curso', v_handoff.motivo,
                   'quer_contratar', v_quer),
    'pdf', pg_catalog.jsonb_build_object(
             'url', coalesce(v_pdf ->> 'url', v_pdf ->> 'path'),
             'nome_arquivo', v_pdf ->> 'nome',
             'reenvio_janela_horas', coalesce(privado.agente_parametro_numero('pdf_reenvio_janela_horas'), 0),
             'enviado_em', v_o.pdf_enviado_em));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.ficha_para_agente(uuid) is 'Apêndice A [v4.2]: ficha comercial em texto no formato do prompt (campos livres até 200 caracteres, sem colchetes nem quebras; historico_sensivel só sim ou não), modo, data e hora de Brasília, planos em texto, valores permitidos, situação da apresentação, horários da Edilaine, valor.*, parcela.*, pagina.*, contexto do validador (planos, taxas só com taxa_visivel_agente, listas, motivo em curso, quer_contratar) e pdf. Nada assistencial.';
grant execute on function agente.ficha_para_agente(uuid) to n8n_agente;

-- --- 4.15 agente.atualizar_lead (Apêndice A [v4.2]) --------------------------------
-- Chaves aceitas em dados (as demais voltam em campos_ignorados; perda nunca
-- é registrada aqui, segue a 11.11):
--   nome, para_quem (propria, presente, outro), dpp (dd/mm/aaaa), semanas
--   ("29", "29s3d"), cidade, bairro, uf, primeira_gestacao (ou
--   primeiro_bebe), gemelar (ou gemeos), rede_apoio, principal_preocupacao
--   (só o tema), parceiro_participa, plano_interesse (ou plano),
--   pagamento_preferido (ou pagamento), origem (rótulo do enum origem_lead),
--   historico_sensivel (só verdadeiro ou falso), quer_contratar e
--   sem_interesse (viram marcos).
-- Cria família, pessoa e oportunidade quando faltam, deduplica pelo
-- telefone, aplica a regra 12 do 6.10 (gestação nova de família que já
-- terminou um atendimento vira família nova ligada por familia_anterior_id),
-- move o pipeline pela máquina de estado e recalcula o score (gatilhos do
-- P17 e chamada direta).
create function agente.atualizar_lead(conversa_id uuid, dados jsonb) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_dados       jsonb := atualizar_lead.dados;
  v_c           public.conversa;
  v_fam         uuid;
  v_f           public.familia;
  v_o           public.oportunidade;
  v_p           public.pessoa;
  v_gravados    text[] := '{}';
  v_ignorados   text[] := '{}';
  v_avisos      text[] := '{}';
  v_chave       text;
  v_valor       jsonb;
  v_texto       text;
  v_nome        text;
  v_dpp         date;
  v_semanas     integer;
  v_dias        integer;
  v_bool        boolean;
  v_cob         jsonb;
  v_cidade      text;
  v_bairro      text;
  v_uf          text;
  v_plano       uuid;
  v_origem      public.origem_lead;
  v_qualif      jsonb := '{}'::jsonb;
  v_terminou    boolean;
  v_limiar      integer;
  v_ref_antiga  date;
  v_nova        uuid;
  v_pessoa_nova uuid;
  v_nova_familia boolean := false;
  v_aviso       text;
  v_hoje        date := privado.agente_hoje();
  v_aceitas     constant text[] := array['nome', 'para_quem', 'dpp', 'semanas', 'cidade', 'bairro', 'uf',
                                         'primeira_gestacao', 'primeiro_bebe', 'gemelar', 'gemeos', 'rede_apoio',
                                         'principal_preocupacao', 'parceiro_participa', 'plano_interesse', 'plano',
                                         'pagamento_preferido', 'pagamento', 'origem', 'historico_sensivel',
                                         'quer_contratar', 'sem_interesse'];
begin
  perform privado.agente_contexto();

  -- 0. dados: objeto jsonb (um texto JSON com o objeto dentro também vale)
  if pg_catalog.jsonb_typeof(v_dados) = 'string' then
    begin
      v_dados := (v_dados #>> '{}')::jsonb;
    exception
      when others then
        v_dados := null;
    end;
  end if;
  if v_dados is null or pg_catalog.jsonb_typeof(v_dados) <> 'object' then
    raise exception 'atualizar_lead: dados precisa ser um objeto' using errcode = '22023';
  end if;

  select c.* into v_c from public.conversa c where c.id = atualizar_lead.conversa_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if v_c.classificacao not in ('nao_classificado', 'lead', 'cliente') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_e_lead');
  end if;

  select pg_catalog.array_agg(k) into v_ignorados
  from pg_catalog.jsonb_object_keys(v_dados) k
  where k <> all (v_aceitas);
  v_ignorados := coalesce(v_ignorados, '{}');

  -- 1. família, pessoa e oportunidade
  v_nome := privado.campo_livre(v_dados ->> 'nome');
  v_fam := privado.agente_garantir_familia(v_c.id, true, v_nome);
  select c.* into v_c from public.conversa c where c.id = v_c.id;

  -- 2. DPP (a DPP escrita vale mais que as semanas)
  if v_dados ? 'dpp' then
    v_dpp := privado.agente_data(v_dados ->> 'dpp');
    if v_dpp is null then
      v_avisos := v_avisos || 'dpp_invalida'::text;
    end if;
  end if;
  if v_dpp is null and v_dados ? 'semanas' then
    v_texto := v_dados ->> 'semanas';
    v_semanas := nullif(pg_catalog.substring(v_texto, '([0-9]+)'), '')::integer;
    v_dias := coalesce(nullif(pg_catalog.substring(v_texto, '[0-9]+[^0-9]+([0-9]+)'), '')::integer, 0);
    if v_semanas is null or v_dias > 6 then
      v_avisos := v_avisos || 'semanas_invalidas'::text;
    else
      -- ig(dpp, data) = data − (dpp − 280 dias) (PRD 6.10 regra 7)
      v_dpp := v_hoje + (280 - (v_semanas * 7 + v_dias));
    end if;
  end if;

  -- 3. regra 12: gestação nova de família que já terminou um atendimento
  select f.* into v_f from public.familia f where f.id = v_fam;
  if v_dpp is not null and v_dpp > v_hoje then
    v_terminou := v_f.data_nascimento is not null
               or exists (select 1 from public.acompanhamento a
                          where a.familia_id = v_fam
                            and a.estado in ('encerrado', 'interrompido_familia', 'interrompido_clinico'));
    v_ref_antiga := coalesce(v_f.data_nascimento, v_f.dpp);
    begin
      select d.nova_gestacao_dias into v_limiar from privado.config_deduplicacao() d;
    exception
      when others then
        v_limiar := 0;
    end;
    if v_terminou and (v_ref_antiga is null or v_dpp - v_ref_antiga > coalesce(v_limiar, 0)) then
      insert into public.familia (nome_exibicao, cidade_id, regiao_id, bairro, cidade_informada, municipio_codigo_ibge, origem)
      values (v_f.nome_exibicao, v_f.cidade_id, v_f.regiao_id, v_f.bairro, v_f.cidade_informada, v_f.municipio_codigo_ibge,
              v_f.origem)
      returning id into v_nova;
      insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
      values (v_nova, 'lead_entrou', 'lead_entrou',
              pg_catalog.jsonb_build_object('origem', 'agente', 'conversa_id', v_c.id, 'nova_gestacao', true), false);
      select p.* into v_p from public.pessoa p where p.id = v_c.pessoa_id;
      if v_p.id is not null then
        insert into public.pessoa (familia_id, papel, nome, telefone_e164, email, contato_principal)
        values (v_nova, v_p.papel, v_p.nome, v_p.telefone_e164, v_p.email, true)
        returning id into v_pessoa_nova;
      end if;
      update public.conversa c set familia_id = v_nova, pessoa_id = v_pessoa_nova where c.id = v_c.id;
      perform privado.agente_garantir_familia(v_c.id, true, v_nome);
      update public.familia f set dpp = v_dpp where f.id = v_nova;
      perform privado.vincular_nova_gestacao(v_nova, v_fam);
      v_fam := v_nova;
      v_nova_familia := true;
    end if;
  end if;

  select f.* into v_f from public.familia f where f.id = v_fam;
  select c.* into v_c from public.conversa c where c.id = v_c.id;
  v_o := privado.agente_oportunidade_aberta(v_fam);

  -- 4. campos da família
  if v_dpp is not null then
    update public.familia f set dpp = v_dpp where f.id = v_fam and f.dpp is distinct from v_dpp;
    v_gravados := v_gravados || 'dpp'::text;
  end if;

  v_bool := privado.agente_booleano(coalesce(v_dados -> 'primeira_gestacao', v_dados -> 'primeiro_bebe'));
  if v_bool is not null then
    update public.familia f set primeira_gestacao = v_bool where f.id = v_fam;
    v_gravados := v_gravados || 'primeira_gestacao'::text;
  end if;

  v_bool := privado.agente_booleano(coalesce(v_dados -> 'gemelar', v_dados -> 'gemeos'));
  if v_bool is not null then
    update public.familia f set gemelar = v_bool where f.id = v_fam;
    v_gravados := v_gravados || 'gemelar'::text;
  end if;

  -- historico_sensivel: só verdadeiro ou falso, nunca detalhe (11.11, K-21)
  if v_dados ? 'historico_sensivel' then
    v_bool := privado.agente_booleano(v_dados -> 'historico_sensivel');
    if v_bool is null and pg_catalog.jsonb_typeof(v_dados -> 'historico_sensivel') = 'string'
       and privado.normalizar_local(v_dados ->> 'historico_sensivel') is not null then
      v_bool := true;   -- veio texto: marca só o sim, o detalhe é descartado
    end if;
    if v_bool is not null then
      update public.familia f set historico_sensivel = v_bool where f.id = v_fam;
      v_gravados := v_gravados || 'historico_sensivel'::text;
    end if;
  end if;

  if v_dados ? 'cidade' or v_dados ? 'bairro' then
    v_cidade := coalesce(privado.campo_livre(v_dados ->> 'cidade'), v_f.cidade_informada);
    v_bairro := coalesce(privado.campo_livre(v_dados ->> 'bairro'), v_f.bairro);
    v_uf := v_dados ->> 'uf';
    v_cob := privado.agente_cobertura(v_cidade, v_bairro, v_uf);
    update public.familia f
       set cidade_informada = v_cidade,
           bairro = v_bairro,
           cidade_id = (v_cob ->> 'cidade_id')::uuid,
           municipio_codigo_ibge = (v_cob ->> 'municipio_codigo_ibge')::integer,
           regiao_id = (v_cob ->> 'regiao_id')::uuid
     where f.id = v_fam;
    v_gravados := v_gravados || 'cidade'::text;
  end if;

  if v_dados ? 'origem' then
    begin
      v_origem := pg_catalog.replace(privado.normalizar_local(v_dados ->> 'origem'), ' ', '_')::public.origem_lead;
      update public.familia f set origem = v_origem where f.id = v_fam and f.origem = 'desconhecida';
      v_gravados := v_gravados || 'origem'::text;
    exception
      when invalid_text_representation then
        v_avisos := v_avisos || 'origem_desconhecida'::text;
    end;
  end if;

  -- 5. pessoa e nome de exibição
  if v_nome is not null then
    if v_c.pessoa_id is not null then
      update public.pessoa p set nome = v_nome where p.id = v_c.pessoa_id;
    end if;
    update public.familia f
       set nome_exibicao = v_nome
     where f.id = v_fam
       and f.nome_exibicao in (coalesce(privado.campo_livre(v_c.nome_whatsapp), ''), coalesce(v_c.telefone_e164, ''), v_c.id::text);
    v_gravados := v_gravados || 'nome'::text;
  end if;

  -- 6. oportunidade
  if v_o.id is not null then
    if v_dados ? 'para_quem' then
      v_texto := privado.normalizar_local(v_dados ->> 'para_quem');
      v_texto := case
                   when v_texto in ('propria', 'ela mesma', 'eu', 'para mim', 'mim') then 'propria'
                   when v_texto like '%presente%' then 'presente'
                   when v_texto is not null then 'outro'
                 end;
      if v_texto is not null then
        update public.oportunidade o set para_quem = v_texto where o.id = v_o.id;
        if v_texto = 'propria' and v_c.pessoa_id is not null then
          update public.pessoa p set papel = 'mae' where p.id = v_c.pessoa_id and p.papel = 'responsavel';
        elsif v_texto = 'presente' and v_c.pessoa_id is not null then
          update public.pessoa p set papel = 'presenteador' where p.id = v_c.pessoa_id and p.papel = 'responsavel';
        end if;
        v_gravados := v_gravados || 'para_quem'::text;
      end if;
    end if;

    if v_dados ? 'plano_interesse' or v_dados ? 'plano' then
      v_texto := privado.normalizar_local(coalesce(v_dados ->> 'plano_interesse', v_dados ->> 'plano'));
      select pc.id into v_plano from public.pacote pc
      where pc.ativo and privado.normalizar_local(pc.nome) = v_texto
      limit 1;
      if v_plano is not null then
        update public.oportunidade o set plano_interesse_pacote_id = v_plano where o.id = v_o.id;
        v_gravados := v_gravados || 'plano_interesse'::text;
      else
        v_avisos := v_avisos || 'plano_desconhecido'::text;
      end if;
    end if;

    v_texto := privado.campo_livre(coalesce(v_dados ->> 'pagamento_preferido', v_dados ->> 'pagamento'));
    if v_texto is not null then
      update public.oportunidade o set pagamento_preferido = v_texto where o.id = v_o.id;
      v_gravados := v_gravados || 'pagamento_preferido'::text;
    end if;

    -- qualificacao: rede_apoio, principal_preocupacao (só o tema),
    -- parceiro_participa
    if privado.campo_livre(v_dados ->> 'rede_apoio') is not null then
      v_qualif := v_qualif || pg_catalog.jsonb_build_object('rede_apoio', privado.campo_livre(v_dados ->> 'rede_apoio'));
    end if;
    if privado.campo_livre(v_dados ->> 'principal_preocupacao') is not null then
      v_qualif := v_qualif || pg_catalog.jsonb_build_object('principal_preocupacao',
                                                           privado.campo_livre(v_dados ->> 'principal_preocupacao'));
    end if;
    v_bool := privado.agente_booleano(v_dados -> 'parceiro_participa');
    if v_bool is not null then
      v_qualif := v_qualif || pg_catalog.jsonb_build_object('parceiro_participa', v_bool);
    end if;
    if v_qualif <> '{}'::jsonb then
      update public.oportunidade o set qualificacao = o.qualificacao || v_qualif where o.id = v_o.id;
      v_gravados := v_gravados || array(select pg_catalog.jsonb_object_keys(v_qualif));
    end if;

    -- 7. pipeline pela máquina de estado (só o pipeline 1)
    v_o := privado.agente_oportunidade_aberta(v_fam);
    select f.* into v_f from public.familia f where f.id = v_fam;
    if v_o.pipeline = 1 and v_o.estagio_p2 is null then
      if v_o.estagio_p1 in ('perdido', 'nao_qualificado', 'fora_de_cobertura')
         and (v_dpp is not null or v_dados ? 'cidade' or v_dados ? 'bairro')
         and not coalesce(privado.agente_booleano(v_dados -> 'sem_interesse'), false) then
        v_aviso := privado.agente_transicionar(v_o.id, 'em_conversa_ia', 'agente: família voltou a escrever');
        if v_aviso is not null then v_avisos := v_avisos || v_aviso; end if;
        v_o := privado.agente_oportunidade_aberta(v_fam);
      end if;
      if v_f.cidade_informada is not null or v_f.bairro is not null then
        v_cob := privado.agente_cobertura(v_f.cidade_informada, v_f.bairro, null);
      end if;
      if v_cob ->> 'status' = 'nao_atendida' and v_o.estagio_p1 in ('em_conversa_ia', 'qualificado') then
        v_aviso := privado.agente_transicionar(v_o.id, 'fora_de_cobertura', 'agente: cidade fora da cobertura');
        if v_aviso is not null then v_avisos := v_avisos || v_aviso; end if;
      elsif v_o.estagio_p1 = 'em_conversa_ia'
            and (v_f.dpp is not null or v_f.data_nascimento is not null)
            and v_cob ->> 'status' in ('atendida', 'confirmar') then
        v_aviso := privado.agente_transicionar(v_o.id, 'qualificado', 'agente: DPP e cobertura informadas');
        if v_aviso is not null then v_avisos := v_avisos || v_aviso; end if;
      end if;
    end if;
  end if;

  -- 8. marcos
  if coalesce(privado.agente_booleano(v_dados -> 'quer_contratar'), false) then
    perform agente.registrar_marco(v_c.id, 'quer_contratar', null);
    v_gravados := v_gravados || 'quer_contratar'::text;
  end if;
  if coalesce(privado.agente_booleano(v_dados -> 'sem_interesse'), false) then
    v_texto := (agente.registrar_marco(v_c.id, 'sem_interesse', null)) ->> 'erro';
    if v_texto is not null then v_avisos := v_avisos || v_texto; end if;
    v_gravados := v_gravados || 'sem_interesse'::text;
  end if;

  -- 9. score (os gatilhos do P17 já recalculam; a chamada direta deixa o
  --    resultado pronto nesta mesma resposta e nunca derruba a gravação)
  begin
    perform privado.calcular_score(v_fam);
  exception
    when others then
      v_avisos := v_avisos || 'score_nao_calculado'::text;
  end;
  perform privado.agente_contexto();

  v_o := privado.agente_oportunidade_aberta(v_fam);
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'familia_id', v_fam,
    'nova_familia', v_nova_familia,
    'estagio', coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text),
    'cobertura', v_cob ->> 'status',
    'campos_gravados', pg_catalog.to_jsonb(v_gravados),
    'campos_ignorados', pg_catalog.to_jsonb(v_ignorados),
    'avisos', pg_catalog.to_jsonb(v_avisos));
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.atualizar_lead(uuid, jsonb) is 'Apêndice A [v4.2]: cria família, pessoa e oportunidade quando faltam (deduplica pelo telefone), grava nome, para quem, DPP ou semanas (converte em DPP pela data de hoje), cidade e bairro (texto sempre em cidade_informada; cidade_id ou municipio_codigo_ibge conforme a cobertura), historico_sensivel só como verdadeiro ou falso, primeiro bebê, gemelar, rede de apoio, principal preocupação (só o tema), parceiro, plano de interesse, pagamento preferido, origem; quer_contratar e sem_interesse viram marcos; regra 12 do 6.10; move o pipeline 1 pela máquina de estado; recalcula o score. Devolve campos gravados, ignorados e avisos.';
grant execute on function agente.atualizar_lead(uuid, jsonb) to n8n_agente;

-- --- 4.16 agente.registrar_marco (Apêndice A [v4.2]) ------------------------------
-- pdf_enviado, sessao_interesse, quer_contratar, proximo_contato (data ou
-- semanas-alvo; o banco calcula a data pela DPP), nao_contatar,
-- sem_interesse (P1 para perdido com motivo sem_interesse e cancelamento
-- dos follow-ups) e nutricao. O marco quer_contratar fica em
-- oportunidade.qualificacao.quer_contratar_em (o DDL do 6.3 não tem coluna
-- própria) e na linha do tempo; é o relógio de contratar_sem_transferencia.
create function agente.registrar_marco(conversa_id uuid, marco text, valor text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_c       public.conversa;
  v_fam     uuid;
  v_f       public.familia;
  v_o       public.oportunidade;
  v_data    date;
  v_semanas integer;
  v_aviso   text;
  v_hoje    date := privado.agente_hoje();
  v_canceladas integer := 0;
begin
  perform privado.agente_contexto();
  if registrar_marco.marco is null
     or registrar_marco.marco not in ('pdf_enviado', 'sessao_interesse', 'quer_contratar', 'proximo_contato',
                                      'nao_contatar', 'sem_interesse', 'nutricao') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'marco_desconhecido');
  end if;

  select c.* into v_c from public.conversa c where c.id = registrar_marco.conversa_id;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_encontrada');
  end if;
  if v_c.classificacao not in ('nao_classificado', 'lead', 'cliente') then
    return pg_catalog.jsonb_build_object('ok', false, 'erro', 'conversa_nao_e_lead');
  end if;

  v_fam := privado.agente_garantir_familia(v_c.id, true, null);
  select f.* into v_f from public.familia f where f.id = v_fam;
  v_o := privado.agente_oportunidade_aberta(v_fam);

  case registrar_marco.marco
    when 'pdf_enviado' then
      update public.oportunidade o set pdf_enviado_em = pg_catalog.now() where o.id = v_o.id;

    when 'sessao_interesse' then
      update public.oportunidade o set sessao_interesse_em = coalesce(o.sessao_interesse_em, pg_catalog.now())
       where o.id = v_o.id;

    when 'quer_contratar' then
      update public.oportunidade o
         set qualificacao = o.qualificacao || pg_catalog.jsonb_build_object('quer_contratar_em', pg_catalog.now())
       where o.id = v_o.id and not (o.qualificacao ? 'quer_contratar_em');

    when 'proximo_contato' then
      v_data := privado.agente_data(registrar_marco.valor);
      if v_data is null then
        v_semanas := nullif(pg_catalog.substring(coalesce(registrar_marco.valor, ''), '([0-9]+)'), '')::integer;
        if v_semanas is null then
          return pg_catalog.jsonb_build_object('ok', false, 'erro', 'valor_invalido');
        end if;
        if v_f.dpp is null then
          return pg_catalog.jsonb_build_object('ok', false, 'erro', 'dpp_necessaria');
        end if;
        -- data em que a gestação chega às semanas pedidas (ig, PRD 6.10 regra 7)
        v_data := v_f.dpp - 280 + v_semanas * 7;
      end if;
      if v_data <= v_hoje then
        return pg_catalog.jsonb_build_object('ok', false, 'erro', 'data_no_passado');
      end if;
      update public.oportunidade o set proximo_contato_em = v_data where o.id = v_o.id;

    when 'nao_contatar' then
      update public.familia f
         set nao_contatar = true,
             nao_contatar_em = coalesce(f.nao_contatar_em, pg_catalog.now()),
             nao_contatar_motivo = coalesce(privado.campo_livre(registrar_marco.valor), f.nao_contatar_motivo)
       where f.id = v_fam;
      update public.automacao_execucao e
         set status = 'cancelada', motivo_aborto = 'nao_contatar'
        from public.automacao a
       where a.id = e.automacao_id and e.familia_id = v_fam and e.status = 'agendada'
         and a.categoria in ('conteudo', 'marketing');
      get diagnostics v_canceladas = row_count;

    when 'sem_interesse' then
      if v_o.pipeline = 1 and v_o.estagio_p2 is null and v_o.estagio_p1 <> 'perdido' then
        v_aviso := privado.agente_transicionar(v_o.id, 'perdido', 'agente: sem_interesse');
        if v_aviso is null then
          update public.oportunidade o set motivo_perda = 'sem_interesse', proximo_contato_em = null where o.id = v_o.id;
        end if;
      end if;
      update public.automacao_execucao e
         set status = 'cancelada', motivo_aborto = 'sem_interesse'
       where e.familia_id = v_fam and e.status = 'agendada'
         and e.automacao_id in ('followup_d1', 'followup_d3_d14', 'retorno_combinado', 'regua_nutricao');
      get diagnostics v_canceladas = row_count;

    when 'nutricao' then
      if v_o.pipeline = 1 and v_o.estagio_p2 is null and v_o.estagio_p1 <> 'nutricao' then
        v_aviso := privado.agente_transicionar(v_o.id, 'nutricao', 'agente: nutricao');
      end if;
  end case;

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito)
  values (v_fam, case when registrar_marco.marco = 'pdf_enviado' then 'pdf_enviado' else 'marco' end,
          registrar_marco.marco,
          pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
            'marco', registrar_marco.marco, 'origem', 'agente', 'conversa_id', v_c.id,
            'data', v_data, 'aviso', v_aviso)),
          false);

  v_o := privado.agente_oportunidade_aberta(v_fam);
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'marco', registrar_marco.marco,
    'familia_id', v_fam,
    'estagio', coalesce(v_o.estagio_p2::text, v_o.estagio_p1::text),
    'data', v_data,
    'execucoes_canceladas', v_canceladas,
    'aviso', v_aviso);
exception
  when others then
    return privado.agente_erro(sqlstate, sqlerrm);
end;
$$;
comment on function agente.registrar_marco(uuid, text, text) is 'Apêndice A [v4.2]: pdf_enviado, sessao_interesse, quer_contratar (qualificacao.quer_contratar_em), proximo_contato (data ou semanas-alvo pela DPP), nao_contatar (cancela conteúdo e marketing agendados), sem_interesse (P1 para perdido com motivo sem_interesse, cancela follow-ups e retorno) e nutricao. Grava evento na linha do tempo.';
grant execute on function agente.registrar_marco(uuid, text, text) to n8n_agente;


-- =============================================================================
-- 5. Trava diária de agente_n8n (PRD 11.10 [v4.2])
--
-- O create em agente_n8n existe só para os nós LangChain. Um tableName
-- errado criaria em silêncio uma tabela nova, sem RLS e fora da eliminação
-- do titular. O job confere que o schema tem exatamente documentos e
-- chat_memoria; qualquer outra tabela gera notificação de prioridade alta à
-- diretoria (o e-mail do canal alcança a Drop pela lista da diretoria).
-- =============================================================================

create function privado.conferir_agente_n8n() returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_extras text[];
begin
  select pg_catalog.array_agg(c.relname::text order by c.relname) into v_extras
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'agente_n8n'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and c.relname not in ('documentos', 'chat_memoria');

  if v_extras is not null then
    insert into public.notificacao (papel, prioridade, titulo, corpo, canais)
    values ('diretoria', 'alta', 'agente_n8n_tabela_inesperada', pg_catalog.array_to_string(v_extras, ', '),
            array['app', 'email']);
  end if;

  return pg_catalog.jsonb_build_object('ok', v_extras is null, 'tabelas_inesperadas', pg_catalog.to_jsonb(coalesce(v_extras, '{}')));
end;
$$;
comment on function privado.conferir_agente_n8n() is 'Job diário (PRD 11.10 [v4.2]): agente_n8n precisa ter exatamente documentos e chat_memoria; qualquer outra tabela gera notificação alta à diretoria. Sem grant: só o cron (postgres) chama.';

select cron.schedule('conferir_agente_n8n', '45 10 * * *', 'select privado.conferir_agente_n8n()');


-- =============================================================================
-- 6. Execute explícito revogado das auxiliares (redundante com o alter
--    default privileges da 0001, deixado por escrito para a revisão)
-- =============================================================================

revoke execute on function privado.agente_contexto() from public, anon, authenticated, service_role;
revoke execute on function privado.agente_erro(text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_parametro(text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_parametro_ligado(text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_parametro_numero(text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_texto(text, boolean) from public, anon, authenticated, service_role;
revoke execute on function privado.aplicar_nome(text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.aplicar_texto(text, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function privado.campo_livre(text) from public, anon, authenticated, service_role;
revoke execute on function privado.telefone_e164(text) from public, anon, authenticated, service_role;
revoke execute on function privado.formatar_reais(bigint) from public, anon, authenticated, service_role;
revoke execute on function privado.formatar_data(date) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_hoje() from public, anon, authenticated, service_role;
revoke execute on function privado.formatar_data_hora(timestamptz) from public, anon, authenticated, service_role;
revoke execute on function privado.normalizar_local(text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_data(text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_booleano(jsonb) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_lista_telefones(text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_estado_conversa(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_primeiro_nome(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_chave_plano(text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_planos() from public, anon, authenticated, service_role;
revoke execute on function privado.agente_cobertura(text, text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_oportunidade_aberta(uuid) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_transicionar(uuid, text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.agente_garantir_familia(uuid, boolean, text) from public, anon, authenticated, service_role;
revoke execute on function privado.conferir_agente_n8n() from public, anon, authenticated, service_role;

-- As funções do schema agente: só n8n_agente (concedido acima, uma a uma).
revoke execute on all functions in schema agente from public, anon, authenticated, service_role;
