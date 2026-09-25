-- =============================================================================
-- 0016_seguranca.sql
--
-- Correções da revisão de segurança de 25/09/2026
-- (docs/seguranca/revisao-2026-09-25.md) · PRD 11.10, 11.11 item 6, 19.4
-- nó 3, 21.3 · P05 item 5 [v4.2]
--
-- Nenhuma migration anterior é editada: tudo aqui é "create or replace" ou
-- "alter role", aplicado por cima da 0005 e da 0013.
--
-- O que esta migration faz:
--   1. SEG-BANCO-01: privado.mascarar_trecho_cartao e
--      privado.mascarar_documentos passam a custar tempo linear no tamanho
--      do texto. A versão da 0005 testava toda subsequência de grupos de
--      dígitos (custo cúbico) e percorria o texto com regexp_instr e
--      regexp_substr a partir de cada posição (custo quadrático): uma
--      mensagem de WhatsApp com dois mil caracteres como "1 1 1 ..."
--      prendia um núcleo do banco por mais de 15 segundos, e uma de 16 mil
--      por horas. A regra de máscara não muda (mesmas saídas, conferidas
--      contra a versão antiga em 3 mil textos sorteados e nos casos do
--      supabase/tests/005_auditoria.sql):
--        * mascarar_documentos faz cada passo numa passada só
--          (regexp_split_to_array e regexp_matches com a flag g,
--          intercalando partes e achados);
--        * mascarar_trecho_cartao para de estender a sequência de grupos
--          quando ela passa de 19 dígitos (nenhum cartão tem mais), sai
--          cedo quando o trecho inteiro tem menos de 13 dígitos e calcula o
--          Luhn de forma incremental, grupo a grupo, sem copiar fatias.
--   2. SEG-BANCO-01: agente.registrar_mensagem e agente.registrar_transcricao
--      gravam no máximo 20 mil caracteres (teto técnico de segurança, não
--      regra de negócio: o mesmo valor de LIMITE_TEXTO_MENSAGEM em
--      n8n/src/code/mascarar-documentos.js, que corta o texto no nó Extrair
--      Dados antes de qualquer outra coisa). O texto maior é cortado, não
--      recusado: recusar faria a mensagem sumir do CRM e pular o filtro de
--      saúde.
--   3. SEG-BANCO-01: o papel n8n_agente ganha statement_timeout de 10 s e
--      idle_in_transaction_session_timeout de 30 s. O "exception when
--      others" das funções do agente não pega cancelamento, então a
--      consulta que passar do teto é derrubada de verdade.
--   4. N8N-01: agente.registrar_mensagem, na direção saída (mensagem da
--      equipe digitada no celular), resolve a conversa pelo jid e pelo
--      telefone antes do LID, usa o LID só quando o próprio chat é o LID (ou
--      não veio jid) e nunca troca um LID que a conversa já tem. Em evento
--      fromMe o LID do remetente é o do próprio número da Kraamzorg; a
--      versão da 0013 resolvia por ele primeiro e juntava conversas de
--      famílias diferentes.
--   5. LGPD-01: as falas da família já gravadas em agente_n8n.chat_memoria
--      pelo nó de memória do n8n (que não passa por privado.mascarar_documentos)
--      são mascaradas de novo. Hoje nenhum projeto tem essa migration
--      aplicada, então não há linha a mudar; o passo fica para o caso de a
--      0016 chegar a um banco que já recebeu mensagens.
-- =============================================================================


-- =============================================================================
-- 1. Máscara de CPF e cartão em tempo linear (SEG-BANCO-01)
-- =============================================================================

-- Mascara um trecho de dígitos em grupos (um caractere de separador entre
-- eles). Primeiro o trecho inteiro; se ele não for cartão, a menor sequência
-- de grupos inteiros que seja, da esquerda para a direita. Mesma regra da
-- 0005; muda só o custo.
--
-- Luhn incremental: para uma sequência de dígitos de tamanho L, o Luhn dobra
-- os dígitos cuja posição a partir da esquerda tem paridade diferente da de
-- L. Guardamos duas somas: v_sa (dobrando as posições ímpares) e v_sb
-- (dobrando as pares). Cada grupo traz as suas duas somas prontas (v_a e
-- v_b, com a posição dentro do grupo); ao juntar o grupo a uma sequência de
-- tamanho par, as posições dele mantêm a paridade, e de tamanho ímpar,
-- trocam. O Luhn da sequência é v_sa quando L é par e v_sb quando é ímpar.
-- privado.cartao_valido continua sendo a conferência final (tamanho, Luhn e
-- a exceção do telefone +55), chamada só quando a soma já fecha em 10.
create or replace function privado.mascarar_trecho_cartao(trecho text, anterior text) returns text
  language plpgsql
  immutable
  parallel safe
  set search_path = ''
  as $$
declare
  v_digitos text;
  v_grupos  text[];
  v_seps    text[];
  v_tam_g   integer[];
  v_a       integer[];
  v_b       integer[];
  v_pedacos text[] := '{}';
  v_n       integer;
  v_k       integer := 0;
  v_tam     integer;
  v_sa      integer;
  v_sb      integer;
  v_achou   boolean;
  i         integer;
  j         integer;
begin
  if trecho is null then
    return trecho;
  end if;

  v_digitos := pg_catalog.regexp_replace(trecho, '[^0-9]', '', 'g');
  -- menos de 13 dígitos no trecho inteiro: nenhuma sequência dele é cartão
  if pg_catalog.length(v_digitos) < 13 then
    return trecho;
  end if;
  if pg_catalog.length(v_digitos) <= 19 and privado.cartao_valido(v_digitos, anterior) then
    return '[cartão ocultado]';
  end if;

  v_grupos := pg_catalog.regexp_split_to_array(trecho, '[^0-9]');
  v_n := pg_catalog.array_length(v_grupos, 1);
  if v_n < 2 then
    return trecho;
  end if;
  -- v_seps[k] é o separador original entre o grupo k e o k + 1
  v_seps := array(select r.m[1]
                  from pg_catalog.regexp_matches(trecho, '([^0-9])', 'g') with ordinality r(m, o)
                  order by r.o);

  -- tamanho e as duas somas de Luhn de cada grupo, numa consulta só
  -- (grupo com mais de 19 dígitos nunca entra num cartão: somas zeradas, e
  -- o tamanho dele já encerra a busca que o alcançar)
  select pg_catalog.array_agg(pg_catalog.length(g.t) order by g.o),
         pg_catalog.array_agg(s.a order by g.o),
         pg_catalog.array_agg(s.b order by g.o)
    into v_tam_g, v_a, v_b
  from pg_catalog.unnest(v_grupos) with ordinality g(t, o)
  cross join lateral (
    select coalesce(pg_catalog.sum(case when d.k % 2 = 1 then d.dobro else d.valor end), 0)::integer as a,
           coalesce(pg_catalog.sum(case when d.k % 2 = 0 then d.dobro else d.valor end), 0)::integer as b
    from (select c.c::integer as valor,
                 c.c::integer * 2 - case when c.c::integer > 4 then 9 else 0 end as dobro,
                 c.k
          from pg_catalog.string_to_table(case when pg_catalog.length(g.t) <= 19 then g.t else '' end, null)
               with ordinality c(c, k)) d
  ) s;

  i := 1;
  while i <= v_n loop
    v_achou := false;
    v_tam := 0;
    v_sa := 0;
    v_sb := 0;
    for j in i..v_n loop
      if v_tam % 2 = 0 then
        v_sa := v_sa + v_a[j];
        v_sb := v_sb + v_b[j];
      else
        v_sa := v_sa + v_b[j];
        v_sb := v_sb + v_a[j];
      end if;
      v_tam := v_tam + v_tam_g[j];
      -- mais de 19 dígitos: nenhuma sequência que comece em i é cartão
      exit when v_tam > 19;
      if v_tam >= 13
         and (case when v_tam % 2 = 0 then v_sa else v_sb end) % 10 = 0
         and privado.cartao_valido(pg_catalog.array_to_string(v_grupos[i:j], ''),
                                   case when i = 1 then anterior else v_seps[i - 1] end) then
        v_k := v_k + 1;
        v_pedacos[v_k] := '[cartão ocultado]';
        v_achou := true;
        i := j + 1;
        exit;
      end if;
    end loop;
    if not v_achou then
      v_k := v_k + 1;
      v_pedacos[v_k] := v_grupos[i];
      i := i + 1;
    end if;
    if i <= v_n then
      v_k := v_k + 1;
      v_pedacos[v_k] := v_seps[i - 1];   -- separador original
    end if;
  end loop;

  return pg_catalog.array_to_string(v_pedacos, '');
end;
$$;
comment on function privado.mascarar_trecho_cartao(text, text) is 'Mascara cartão dentro de um trecho de grupos de dígitos (P05 item 5): trecho inteiro, ou a menor sequência de grupos que seja cartão. anterior = caractere antes do trecho. Tempo linear no tamanho do trecho (0016, SEG-BANCO-01): a busca que começa num grupo para ao passar de 19 dígitos, e o Luhn é somado grupo a grupo.';
revoke execute on function privado.mascarar_trecho_cartao(text, text) from public, anon, authenticated, service_role;

create or replace function privado.mascarar_documentos(texto text) returns text
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
  v_houve_cartao boolean := false;
begin
  if texto is null or texto = '' then
    return texto;
  end if;

  -- Cada passo numa passada só: regexp_split_to_array devolve as partes
  -- entre os achados (sempre uma a mais que os achados) e regexp_matches
  -- com a flag g devolve os achados na ordem; a saída intercala parte 1,
  -- troca do achado 1, parte 2, e assim por diante. Nenhum padrão casa com
  -- texto vazio, então as duas funções enxergam os mesmos achados.

  -- 1. CPF formatado
  select pg_catalog.string_agg(x.pedaco, '' order by x.ordem) into v_texto
  from (
    select 2 * p.o - 1 as ordem, p.t as pedaco
    from pg_catalog.unnest(pg_catalog.regexp_split_to_array(v_texto, c_cpf_formatado)) with ordinality p(t, o)
    union all
    select 2 * a.o, case when privado.cpf_valido(a.m[1]) then '[CPF ocultado]' else a.m[1] end
    from pg_catalog.regexp_matches(v_texto, '(' || c_cpf_formatado || ')', 'g') with ordinality a(m, o)
  ) x;

  -- 2. CPF corrido: sequência inteira de dígitos com exatamente 11
  select pg_catalog.string_agg(x.pedaco, '' order by x.ordem) into v_texto
  from (
    select 2 * p.o - 1 as ordem, p.t as pedaco
    from pg_catalog.unnest(pg_catalog.regexp_split_to_array(v_texto, c_digitos)) with ordinality p(t, o)
    union all
    select 2 * a.o,
           case when pg_catalog.length(a.m[1]) = 11 and privado.cpf_valido(a.m[1]) then '[CPF ocultado]' else a.m[1] end
    from pg_catalog.regexp_matches(v_texto, '(' || c_digitos || ')', 'g') with ordinality a(m, o)
  ) x;

  -- 3. Cartão, com os grupos juntados antes do Luhn. O caractere anterior
  --    de cada trecho é o último da parte que vem antes dele (ou o último
  --    do trecho anterior, se a parte for vazia; vazio no começo do texto).
  --    "materialized" para mascarar_trecho_cartao rodar uma vez por trecho.
  with partes as (
    select p.o, p.t
    from pg_catalog.unnest(pg_catalog.regexp_split_to_array(v_texto, c_trecho_cartao)) with ordinality p(t, o)
  ), achados as (
    select a.o, a.m[1] as trecho, pg_catalog.lag(a.m[1]) over (order by a.o) as trecho_antes
    from pg_catalog.regexp_matches(v_texto, '(' || c_trecho_cartao || ')', 'g') with ordinality a(m, o)
  ), trocas as materialized (
    select a.o, a.trecho,
           privado.mascarar_trecho_cartao(
             a.trecho,
             case when pg_catalog.length(p.t) > 0 then pg_catalog.right(p.t, 1)
                  when a.o = 1 then ''
                  else pg_catalog.right(a.trecho_antes, 1) end) as troca
    from achados a
    join partes p on p.o = a.o
  )
  select pg_catalog.string_agg(x.pedaco, '' order by x.ordem), coalesce(pg_catalog.bool_or(x.mudou), false)
    into v_texto, v_houve_cartao
  from (
    select 2 * p.o - 1 as ordem, p.t as pedaco, false as mudou from partes p
    union all
    select 2 * t.o, t.troca, t.troca <> t.trecho from trocas t
  ) x;

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
comment on function privado.mascarar_documentos(text) is 'Mascara CPF (formatado ou corrido, verificadores válidos) e cartão (13 a 19 dígitos em grupos separados por espaço, ponto, hífen ou barra, Luhn, fora do formato de telefone +55), e na mesma mensagem validade MM/AA ou MM/AAAA e CVV (P05 item 5 [v4.2]). Definição de referência que o n8n copia (PRD 19.5). Tempo linear no tamanho do texto (0016, SEG-BANCO-01).';


-- =============================================================================
-- 2. agente.registrar_mensagem: teto de tamanho (SEG-BANCO-01) e resolução
--    da mensagem da equipe pelo jid antes do LID (N8N-01)
-- =============================================================================

-- Resolve a conversa. Entrada (família): LID, telefone e jid, nessa ordem,
-- como na 0013. Saída (equipe no celular, eco do app): jid e telefone
-- primeiro; o LID só quando o próprio chat é o LID ou não veio jid, porque
-- em evento fromMe o LID do remetente é o do número da Kraamzorg, igual em
-- todas as conversas. Na saída, um LID que a conversa já tem nunca é
-- trocado. Cria ou atualiza (E.164, LID, nome salvo, quem iniciou, wa_jid
-- com o chatid mais recente); corta o conteúdo em 20 mil caracteres e
-- mascara CPF e cartão; deduplica pelo wa_message_id; lê "paciente
-- potencial" e "paciente fechada" no nome salvo (PRD 11.5). Única função
-- que recebe o jid (Apêndice A [v4.2]).
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
comment on function agente.registrar_mensagem(text, text, text, text, text, text, text, text, text, text) is 'Apêndice A [v4.2]: resolve a conversa (entrada: LID, telefone e jid; saída: jid, telefone e o LID só quando o chat é o próprio LID, 0016 N8N-01), cria ou atualiza (wa_jid sempre com o chatid mais recente; na saída o LID só preenche o que falta), liga à família pelo telefone, lê "paciente fechada"/"paciente potencial" do nome salvo, grava a mensagem cortada em 20 mil caracteres e mascarada sem duplicar pelo wa_message_id. Devolve {ok, conversa_id, primeira_mensagem, conteudo_cortado, classificacao, numero_equipe, numero_plantao, agrupamento_segundos, duplicada}.';
revoke execute on function agente.registrar_mensagem(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function agente.registrar_mensagem(text, text, text, text, text, text, text, text, text, text) to n8n_agente;

-- --- agente.registrar_transcricao: mesmo teto de 20 mil caracteres ----------------
create or replace function agente.registrar_transcricao(wa_message_id text, texto text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  -- teto técnico de segurança, o mesmo de agente.registrar_mensagem
  c_limite_texto constant integer := 20000;
  v_conversa uuid;
begin
  perform privado.agente_contexto();
  if nullif(pg_catalog.btrim(registrar_transcricao.wa_message_id), '') is null then
    raise exception 'registrar_transcricao: wa_message_id é obrigatório' using errcode = '22023';
  end if;
  update public.mensagem m
     set transcricao = privado.mascarar_documentos(pg_catalog.left(registrar_transcricao.texto, c_limite_texto))
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
comment on function agente.registrar_transcricao(text, text) is 'Apêndice A [v4.2]: grava a transcrição do áudio cortada em 20 mil caracteres (0016) e mascarada na coluna transcricao da mensagem, único UPDATE permitido em mensagem (PRD 5.2).';
revoke execute on function agente.registrar_transcricao(text, text) from public, anon, authenticated, service_role;
grant execute on function agente.registrar_transcricao(text, text) to n8n_agente;


-- =============================================================================
-- 3. Tetos de tempo do papel n8n_agente (SEG-BANCO-01)
--
-- Valem a partir da próxima conexão do n8n (o pooler em modo sessão abre
-- conexões novas). 10 s cobre com folga a função mais lenta do agente, que
-- roda em milissegundos; 30 s parado dentro de transação aberta derruba a
-- conexão, para uma trava de linha (for update) nunca ficar presa.
-- =============================================================================

alter role n8n_agente set statement_timeout = '10s';
alter role n8n_agente set idle_in_transaction_session_timeout = '30s';


-- =============================================================================
-- 4. Falas da família já gravadas em claro na memória do agente (LGPD-01)
--
-- O nó Postgres Chat Memory do n8n grava a fala da família (type human)
-- direto em agente_n8n.chat_memoria, com a máscara do n8n, que até esta
-- revisão deixava passar cartão seguido de validade na mesma linha. Aqui a
-- máscara de referência roda de novo sobre essas linhas. Só muda a linha
-- cujo texto mascarado é diferente do gravado.
-- =============================================================================

update agente_n8n.chat_memoria cm
   set message = pg_catalog.jsonb_set(cm.message, '{content}',
                                      pg_catalog.to_jsonb(privado.mascarar_documentos(cm.message ->> 'content')))
 where cm.message ->> 'type' = 'human'
   and pg_catalog.jsonb_typeof(cm.message -> 'content') = 'string'
   and privado.mascarar_documentos(cm.message ->> 'content') is distinct from cm.message ->> 'content';
