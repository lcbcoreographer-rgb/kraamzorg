-- =============================================================================
-- 0023_checklist_alertas.sql
--
-- P39 · Checklist diário (DOC 2), registro append-only e adendos
-- P40 · Alertas clínicos (DOC 3) e apoio do DOC 4, o lado do banco
--
-- O que esta migration faz, na ordem:
--   1. Parâmetros novos (limite, prazo e interruptor em parametro, nunca no
--      código): áudio da visita, transcrição desligada até a aprovação do
--      L-04, seletor dos sinais do DOC 3 desligado até a validação clínica
--      (K-07), telefone da supervisão médica, prazo da tarefa de contato médico.
--   2. Restrições de integridade: um registro por visita; alerta só fecha com
--      os quatro campos do DOC 3; um alerta por regra, visita e bebê.
--   3. Assinatura: json canônico, hash sha256 de dados, resumo, profissional e
--      hora, calculado no aparelho e conferido aqui.
--   4. Obrigatórios do PRD 9.2 lidos da definição do instrumento aprovado
--      (nenhuma lista de campos no código).
--   5. Schema assistencial: registrar_atendimento (append-only), adendo,
--      leituras auditadas (assistencial.ler_*), criação de alerta clínico com
--      aviso à coordenação e ocorrência privada de saúde mental imediata.
--   6. Funções do schema api (security definer, search_path vazio, papel e AAL
--      conferidos dentro, execute só para authenticated).
--   7. Alinha as regras ativas do DOC 3 aos caminhos do DOC 2 aprovado (P34).
--   8. Trava de segurança sobre o que esta migration criou.
--
-- O registro assistencial nunca recebe UPDATE nem DELETE (0004: revoke e
-- gatilho). Correção é registro_adendo. Leitura só por assistencial.ler_*,
-- que grava 'leitura' em log_auditoria antes de devolver.
--
-- Chave reservada em registro_atendimento.dados: "_alertas". Guarda, por
-- alerta, os quatro campos do registro obrigatório do DOC 3 (sinal
-- identificado, hora do acionamento, orientação médica recebida, conduta
-- adotada) feitos durante a visita, mesmo sem sinal. Não é campo do
-- instrumento: o DOC 3 manda que "o registro e a comunicação ficam no
-- checklist diário" (PRD 9.3). Entra na assinatura como o resto de dados.
-- =============================================================================


-- =============================================================================
-- 1. Parâmetros
-- =============================================================================

insert into public.parametro (chave, valor, descricao) values
  ('transcricao_audio_ativa', 'false',
   'PRD 9.5 e L-04: transcrição do áudio da visita. Desligada até a aprovação; sem ela o áudio é só anexado e ouvido.'),
  ('audio_url_assinada_segundos', '60',
   'PRD 9.2 e P39 item 6: validade da URL assinada do áudio da visita no storage privado.'),
  ('audio_visita', '{"duracao_max_seg":1800,"tamanho_max_bytes":26214400,"tipos":["audio/webm","audio/ogg","audio/mp4","audio/mpeg"]}',
   'P39 item 6: limites do áudio anexado à visita (duração, tamanho e tipos aceitos).'),
  ('retencao_audio_dias', '90',
   'PRD 22.4 O-03: retenção de áudio, 90 dias após o envio da evolução (proposta, confirmar).'),
  ('seletor_sinais_doc3_ativo', 'false',
   'PRD 9.3 e K-07 [clínico]: seletor dos sinais do DOC 3 que não têm campo no checklist. Desligado até a Edilaine validar a lista.'),
  ('supervisao_medica_telefone', '""',
   'PRD 9.3: telefone da supervisão médica para "Ligar para a supervisão" (E.164). Vazio até a Kraamzorg informar.'),
  ('contato_medico_tarefa', '{"prazo_horas":24}',
   'PRD 7.3 e P39 item 4: prazo da tarefa obter_contato_medico aberta para a coordenação quando o último dia fecha sem contato do médico [confirmar].')
on conflict (chave) do nothing;


-- =============================================================================
-- 2. Restrições de integridade
-- =============================================================================

-- Uma visita tem no máximo um registro (chave natural do protocolo de
-- sincronização, src/lib/sync/protocolo.ts). Segundo envio diferente vira adendo.
create unique index registro_atendimento_visita_unica
  on public.registro_atendimento (visita_id);

-- PRD 9.3: "Registro obrigatório antes de fechar qualquer alerta: sinal
-- identificado, horário do acionamento, orientação médica recebida, conduta
-- adotada." O banco recusa o fechamento sem os quatro.
alter table public.alerta_clinico
  add constraint alerta_fechado_exige_registro check (
    fechado_em is null
    or (
      fechado_por is not null
      and nullif(pg_catalog.btrim(sinal_identificado), '') is not null
      and acionado_em is not null
      and nullif(pg_catalog.btrim(orientacao_medica), '') is not null
      and nullif(pg_catalog.btrim(conduta_adotada), '') is not null
    )
  );

-- Uma linha por regra, visita e bebê: o alerta criado no aparelho e a
-- reavaliação do servidor (PRD 9.3) chegam ao mesmo alerta.
create unique index alerta_clinico_regra_visita_bebe_unica
  on public.alerta_clinico (visita_id, regra_id, (coalesce(bebe_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  where visita_id is not null;

create index alerta_clinico_abertos on public.alerta_clinico (familia_id) where fechado_em is null;


-- =============================================================================
-- 3. Assinatura: json canônico e hash
--
-- Contrato com src/lib/checklist/assinatura.ts (o mesmo cálculo no aparelho):
--   * objeto com as chaves em ordem crescente de byte, sem espaço;
--   * lista na ordem;
--   * string, número, verdadeiro, falso e nulo como o JSON os escreve;
--   * o que é assinado é o objeto
--       {"assinado_em_ms":<ms desde 1970>,"dados":<dados>,
--        "profissional_id":"<uuid>","resumo":"<resumo>"}
--   * assinatura = sha256 em hexadecimal do texto canônico em UTF-8.
-- O hash não depende de como o banco imprime o jsonb: é recalculado aqui a
-- partir dos campos recebidos, então também dá para conferir o registro
-- gravado a qualquer momento (privado.registro_confere).
-- =============================================================================

create function privado.json_canonico(j jsonb) returns text
  language plpgsql
  immutable
  set search_path = ''
  as $$
declare
  v_saida text;
begin
  if j is null then
    return 'null';
  end if;
  case pg_catalog.jsonb_typeof(j)
    when 'object' then
      select '{' || coalesce(pg_catalog.string_agg(
                        pg_catalog.to_jsonb(e.key)::text || ':' || privado.json_canonico(e.value),
                        ',' order by e.key collate "C"), '') || '}'
        into v_saida
      from pg_catalog.jsonb_each(j) as e(key, value);
    when 'array' then
      select '[' || coalesce(pg_catalog.string_agg(privado.json_canonico(e.value), ',' order by e.ord), '') || ']'
        into v_saida
      from pg_catalog.jsonb_array_elements(j) with ordinality as e(value, ord);
    else
      v_saida := j::text;
  end case;
  return v_saida;
end;
$$;
comment on function privado.json_canonico(jsonb) is 'Texto canônico de um jsonb (chaves em ordem de byte, sem espaço), igual ao de src/lib/checklist/assinatura.ts. Base do hash da assinatura do registro (P39). Sem grant.';

create function privado.hash_registro(
  dados           jsonb,
  resumo          text,
  profissional_id uuid,
  assinado_em     timestamptz
) returns text
  language sql
  immutable
  set search_path = ''
  as $$
  select pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               privado.json_canonico(pg_catalog.jsonb_build_object(
                 'assinado_em_ms', pg_catalog.round(extract(epoch from hash_registro.assinado_em) * 1000)::bigint,
                 'dados', hash_registro.dados,
                 'profissional_id', hash_registro.profissional_id::text,
                 'resumo', hash_registro.resumo)),
               'UTF8')),
           'hex')
$$;
comment on function privado.hash_registro(jsonb, text, uuid, timestamptz) is 'sha256 (hex) do json canônico de dados, resumo, profissional e hora de assinatura (PRD 6.5, P39 item 3). Sem grant.';

create function privado.registro_confere(registro_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select r.assinatura = privado.hash_registro(r.dados, r.resumo_descritivo, r.profissional_id, r.assinado_em)
  from public.registro_atendimento r
  where r.id = registro_confere.registro_id
$$;
comment on function privado.registro_confere(uuid) is 'Recalcula a assinatura de um registro gravado e compara com a guardada. Serve à auditoria e ao pgTAP. Sem grant.';


-- =============================================================================
-- 4. Obrigatórios lidos da definição do instrumento (PRD 9.2 v4.2)
--
-- Mesmas regras de src/lib/instrumentos/respostas.ts (pendenciasParaConcluir):
-- campo obrigatório, não automático, visível pela condição do bloco e do
-- campo; bloco repetido conta uma vez por bebê da família. Condição que a
-- função não sabe avaliar conta como visível (na dúvida, cobra o campo).
-- =============================================================================

create function privado.campo_respondido(valor jsonb, campo jsonb) returns boolean
  language plpgsql
  immutable
  set search_path = ''
  as $$
declare
  v_ok boolean;
begin
  if valor is null or pg_catalog.jsonb_typeof(valor) = 'null' then
    return false;
  end if;
  case pg_catalog.jsonb_typeof(valor)
    when 'string' then
      return pg_catalog.btrim(valor #>> '{}') <> '';
    when 'number' then
      return true;
    when 'boolean' then
      return true;
    when 'array' then
      return pg_catalog.jsonb_array_length(valor) > 0;
    else
      null;
  end case;

  if valor ? 'ausente' then
    return pg_catalog.jsonb_typeof(valor -> 'justificativa') = 'string'
       and pg_catalog.btrim(valor ->> 'justificativa') <> '';
  end if;
  if valor ? 'partes' then
    if pg_catalog.jsonb_typeof(campo -> 'partes') <> 'array' or pg_catalog.jsonb_array_length(campo -> 'partes') = 0 then
      return false;
    end if;
    select pg_catalog.bool_and(coalesce(pg_catalog.jsonb_typeof(valor -> 'partes' -> (p ->> 'id')) = 'number', false))
      into v_ok
    from pg_catalog.jsonb_array_elements(campo -> 'partes') as p;
    return coalesce(v_ok, false);
  end if;
  if valor ? 'resposta' then
    return pg_catalog.jsonb_typeof(valor -> 'resposta') = 'boolean';
  end if;
  if valor ? 'valor' then
    if pg_catalog.jsonb_typeof(valor -> 'valor') <> 'number' then
      return false;
    end if;
    if campo ->> 'tipo' = 'escala' and campo -> 'complemento' is not null
       and pg_catalog.jsonb_typeof(campo -> 'complemento') = 'object' then
      return pg_catalog.jsonb_typeof(valor -> 'complemento') = 'string' and (valor ->> 'complemento') <> '';
    end if;
    return true;
  end if;
  return false;
end;
$$;
comment on function privado.campo_respondido(jsonb, jsonb) is 'Espelho SQL de estaRespondido (src/lib/instrumentos/respostas.ts): o campo tem resposta que conta para concluir a visita. Sem grant.';

create function privado.condicao_visivel(
  cond        jsonb,
  dados       jsonb,
  ultimo_dia  boolean,
  item_bebe   jsonb default null
) returns boolean
  language plpgsql
  immutable
  set search_path = ''
  as $$
declare
  v_c       jsonb;
  v_campo   text;
  v_bloco   text;
  v_nome    text;
  v_bruto   jsonb;
  v_valor   jsonb;
  v_resp    boolean;
  v_op      text;
begin
  if cond is null or pg_catalog.jsonb_typeof(cond) <> 'object' then
    return true;
  end if;

  if cond ? 'todas' then
    for v_c in select e from pg_catalog.jsonb_array_elements(cond -> 'todas') as e loop
      if not privado.condicao_visivel(v_c, dados, ultimo_dia, item_bebe) then
        return false;
      end if;
    end loop;
    return true;
  end if;
  if cond ? 'alguma' then
    for v_c in select e from pg_catalog.jsonb_array_elements(cond -> 'alguma') as e loop
      if privado.condicao_visivel(v_c, dados, ultimo_dia, item_bebe) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  v_op := cond ->> 'operador';

  if cond ? 'contexto' then
    if cond ->> 'contexto' <> 'ultimo_dia' then
      return true;
    end if;
    v_valor := pg_catalog.to_jsonb(coalesce(ultimo_dia, false));
    v_resp := true;
  else
    v_campo := cond ->> 'campo';
    if v_campo is null or pg_catalog.strpos(v_campo, '.') = 0 then
      return true;
    end if;
    v_nome := pg_catalog.regexp_replace(v_campo, '^.*\.', '');
    v_bloco := pg_catalog.regexp_replace(v_campo, '\.[^.]*$', '');
    if pg_catalog.jsonb_typeof(dados -> v_bloco) = 'array' then
      v_bruto := item_bebe -> v_nome;
    else
      v_bruto := dados -> v_bloco -> v_nome;
    end if;
    v_valor := case when pg_catalog.jsonb_typeof(v_bruto) = 'object'
                    then coalesce(v_bruto -> 'resposta', v_bruto -> 'valor')
                    else v_bruto end;
    v_resp := v_bruto is not null and pg_catalog.jsonb_typeof(v_bruto) <> 'null'
              and not (pg_catalog.jsonb_typeof(v_bruto) = 'string' and pg_catalog.btrim(v_bruto #>> '{}') = '');
  end if;

  case v_op
    when 'respondido' then return v_resp;
    when 'sem_resposta' then return not v_resp;
    when '=' then return v_resp and v_valor = (cond -> 'valor');
    when '!=' then return v_resp and v_valor <> (cond -> 'valor');
    else return true;
  end case;
end;
$$;
comment on function privado.condicao_visivel(jsonb, jsonb, boolean, jsonb) is 'Avalia o aparece_se de um bloco ou campo do instrumento sobre os dados do registro (contexto ultimo_dia, igual, diferente, respondido, sem_resposta, todas, alguma). Forma que não conhece conta como visível. Sem grant.';

create function privado.pendencias_registro(
  dados       jsonb,
  definicao   jsonb,
  ultimo_dia  boolean,
  bebes       uuid[]
) returns text[]
  language plpgsql
  immutable
  set search_path = ''
  as $$
declare
  v_saida  text[] := array[]::text[];
  v_bloco  jsonb;
  v_campo  jsonb;
  v_lista  jsonb;
  v_item   jsonb;
  v_bebe   uuid;
  v_repete boolean;
begin
  for v_bloco in select b from pg_catalog.jsonb_array_elements(coalesce(definicao -> 'blocos', '[]'::jsonb)) as b loop
    if not privado.condicao_visivel(v_bloco -> 'aparece_se', dados, ultimo_dia, null) then
      continue;
    end if;
    v_repete := coalesce((v_bloco ->> 'repete_por_bebe')::boolean, false);

    if v_repete then
      if pg_catalog.cardinality(coalesce(bebes, array[]::uuid[])) = 0 then
        if exists (select 1 from pg_catalog.jsonb_array_elements(v_bloco -> 'campos') c
                    where coalesce((c ->> 'obrigatorio')::boolean, false)) then
          v_saida := v_saida || 'sem_bebe_cadastrado'::text;
        end if;
        continue;
      end if;
      v_lista := dados -> (v_bloco ->> 'id');
      foreach v_bebe in array bebes loop
        v_item := null;
        if pg_catalog.jsonb_typeof(v_lista) = 'array' then
          select e into v_item from pg_catalog.jsonb_array_elements(v_lista) as e
           where e ->> 'bebe_id' = v_bebe::text limit 1;
        end if;
        for v_campo in select c from pg_catalog.jsonb_array_elements(v_bloco -> 'campos') as c loop
          if coalesce((v_campo ->> 'obrigatorio')::boolean, false)
             and v_campo ->> 'tipo' <> 'automatico'
             and privado.condicao_visivel(v_campo -> 'aparece_se', dados, ultimo_dia, v_item)
             and not privado.campo_respondido(v_item -> (v_campo ->> 'id'), v_campo) then
            v_saida := v_saida || ((v_bloco ->> 'id') || '.' || (v_campo ->> 'id') || '#' || v_bebe::text);
          end if;
        end loop;
      end loop;
    else
      v_item := dados -> (v_bloco ->> 'id');
      for v_campo in select c from pg_catalog.jsonb_array_elements(v_bloco -> 'campos') as c loop
        if coalesce((v_campo ->> 'obrigatorio')::boolean, false)
           and v_campo ->> 'tipo' <> 'automatico'
           and privado.condicao_visivel(v_campo -> 'aparece_se', dados, ultimo_dia, null)
           and not privado.campo_respondido(
                     case when pg_catalog.jsonb_typeof(v_item) = 'object' then v_item -> (v_campo ->> 'id') end,
                     v_campo) then
          v_saida := v_saida || ((v_bloco ->> 'id') || '.' || (v_campo ->> 'id'));
        end if;
      end loop;
    end if;
  end loop;
  return v_saida;
end;
$$;
comment on function privado.pendencias_registro(jsonb, jsonb, boolean, uuid[]) is 'Campos obrigatórios sem resposta, lidos da definição do instrumento (PRD 9.2 v4.2): "bloco.campo" e, em bloco por bebê, "bloco.campo#bebe_id". Espelho SQL de pendenciasParaConcluir. Sem grant.';


-- =============================================================================
-- 5. Schema assistencial
-- =============================================================================

-- --- Leituras auditadas (PRD 5.2 e 13): 'leitura' no log antes de devolver ----------

create function assistencial.ler_registro_atendimento(p_visita_id uuid) returns setof public.registro_atendimento
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  if p_visita_id is null then
    raise exception 'ler_registro_atendimento: visita_id é obrigatório' using errcode = '22023';
  end if;
  perform privado.registrar_leitura('registro_atendimento', p_visita_id::text,
    pg_catalog.jsonb_build_object('visita_id', p_visita_id));
  return query
    select r.* from public.registro_atendimento r where r.visita_id = p_visita_id;
end;
$$;
comment on function assistencial.ler_registro_atendimento(uuid) is 'Leitura auditada do registro assistencial de uma visita (P39, PRD 13): grava ''leitura'' antes de devolver. Sem grant: o app chega pelo wrapper da api.';

create function assistencial.ler_adendos(p_registro_id uuid) returns setof public.registro_adendo
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  if p_registro_id is null then
    raise exception 'ler_adendos: registro_id é obrigatório' using errcode = '22023';
  end if;
  perform privado.registrar_leitura('registro_adendo', p_registro_id::text,
    pg_catalog.jsonb_build_object('registro_id', p_registro_id));
  return query
    select a.* from public.registro_adendo a where a.registro_id = p_registro_id order by a.criado_em, a.id;
end;
$$;
comment on function assistencial.ler_adendos(uuid) is 'Leitura auditada dos adendos de um registro (P39, PRD 13). Sem grant.';

-- Registros dos dias anteriores do mesmo acompanhamento: valor de referência
-- do dia anterior e série de pesos e temperaturas (P39 item 1 e 5, P40).
create function assistencial.ler_registros_anteriores(p_visita_id uuid)
  returns table (
    visita_id         uuid,
    dia_numero        integer,
    data              date,
    dados             jsonb,
    resumo_descritivo text
  )
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_acomp uuid;
  v_dia   integer;
begin
  select v.acompanhamento_id, v.dia_numero into v_acomp, v_dia
  from public.visita v where v.id = p_visita_id;
  if not found then
    raise exception 'ler_registros_anteriores: visita % não existe', p_visita_id using errcode = 'P0002';
  end if;
  perform privado.registrar_leitura('registro_atendimento', p_visita_id::text,
    pg_catalog.jsonb_build_object('visita_id', p_visita_id, 'escopo', 'dias_anteriores'));
  return query
    select v.id, v.dia_numero, v.data, r.dados, r.resumo_descritivo
    from public.visita v
    join public.registro_atendimento r on r.visita_id = v.id
    where v.acompanhamento_id = v_acomp and v.dia_numero < v_dia
    order by v.dia_numero desc;
end;
$$;
comment on function assistencial.ler_registros_anteriores(uuid) is 'Leitura auditada dos registros dos dias anteriores do acompanhamento, do mais recente ao mais antigo (referência do dia anterior e séries, P39 e P40). Sem grant.';

create function assistencial.ler_alertas_visita(p_visita_id uuid) returns setof public.alerta_clinico
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.registrar_leitura('alerta_clinico', p_visita_id::text,
    pg_catalog.jsonb_build_object('visita_id', p_visita_id));
  return query
    select a.* from public.alerta_clinico a where a.visita_id = p_visita_id order by a.criado_em, a.id;
end;
$$;
comment on function assistencial.ler_alertas_visita(uuid) is 'Leitura auditada dos alertas clínicos de uma visita (P40). Sem grant.';

create function assistencial.ler_anexos_audio(p_visita_id uuid) returns setof public.anexo_audio
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
begin
  perform privado.registrar_leitura('anexo_audio', p_visita_id::text,
    pg_catalog.jsonb_build_object('visita_id', p_visita_id));
  return query
    select x.* from public.anexo_audio x where x.visita_id = p_visita_id order by x.criado_em, x.id;
end;
$$;
comment on function assistencial.ler_anexos_audio(uuid) is 'Leitura auditada dos áudios anexados a uma visita (P39 item 6). Sem grant.';

-- Alertas de uma ou de várias famílias, com o recorte do papel: enfermeira,
-- as atribuídas; coordenação e diretoria, todas. Uma 'leitura' por família.
create function assistencial.ler_alertas_clinicos(p_situacao text, p_familia_id uuid default null)
  returns table (
    id                 uuid,
    familia_id         uuid,
    nome_exibicao      text,
    estado_sensivel    public.estado_sensivel,
    visita_id          uuid,
    dia_numero         integer,
    bebe_id            uuid,
    regra_id           text,
    grupo              text,
    descricao          text,
    severidade         public.severidade,
    campo              text,
    valor_observado    text,
    conduta            text,
    criado_em          timestamptz,
    reconhecido_em     timestamptz,
    sinal_identificado text,
    acionado_em        timestamptz,
    orientacao_medica  text,
    conduta_adotada    text,
    fechado_em         timestamptz,
    versao             integer
  )
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_todas boolean := privado.tem_papel('coordenacao') or privado.tem_papel('diretoria');
  v_fam   uuid;
begin
  for v_fam in
    select distinct a.familia_id
    from public.alerta_clinico a
    where (p_familia_id is null or a.familia_id = p_familia_id)
      and (v_todas or a.familia_id in (select fa.id from privado.familias_atribuidas() as fa(id)))
      and (p_situacao = 'todos'
           or (p_situacao = 'abertos' and a.fechado_em is null)
           or (p_situacao = 'fechados' and a.fechado_em is not null))
  loop
    perform privado.registrar_leitura('alerta_clinico', v_fam::text,
      pg_catalog.jsonb_build_object('funcao', 'assistencial.ler_alertas_clinicos', 'situacao', p_situacao));
  end loop;

  return query
    select a.id, a.familia_id, f.nome_exibicao, f.estado_sensivel, a.visita_id, vi.dia_numero, a.bebe_id,
           a.regra_id, r.grupo, r.descricao, a.severidade, a.campo, a.valor_observado, a.conduta,
           a.criado_em, a.reconhecido_em, a.sinal_identificado, a.acionado_em, a.orientacao_medica,
           a.conduta_adotada, a.fechado_em, a.versao
    from public.alerta_clinico a
    join public.familia f on f.id = a.familia_id
    join public.regra_alerta r on r.id = a.regra_id and r.instrumento_versao = a.instrumento_versao
    left join public.visita vi on vi.id = a.visita_id
    where (p_familia_id is null or a.familia_id = p_familia_id)
      and (v_todas or a.familia_id in (select fa.id from privado.familias_atribuidas() as fa(id)))
      and (p_situacao = 'todos'
           or (p_situacao = 'abertos' and a.fechado_em is null)
           or (p_situacao = 'fechados' and a.fechado_em is not null))
    order by (a.severidade = 'imediato') desc, a.fechado_em is not null, a.criado_em desc, a.id;
end;
$$;
comment on function assistencial.ler_alertas_clinicos(text, uuid) is 'Leitura auditada dos alertas clínicos (abertos, fechados ou todos) com o recorte do papel: enfermeira nas famílias atribuídas, coordenação e diretoria em todas. Uma ''leitura'' por família. Sem grant.';

-- --- Criação de alerta clínico ---------------------------------------------------------
--
-- Uma linha por regra, visita e bebê. Regra automática precisa estar ativa;
-- sinal registrado pela enfermeira (manual) vale para regra que existe, e o
-- interruptor seletor_sinais_doc3_ativo é conferido pelo wrapper. Severidade
-- e conduta vêm sempre de regra_alerta, nunca do chamador. Ao nascer:
--   * aviso à coordenação pela central (app, push, whatsapp_interno), sem
--     nome da paciente (PRD 9.3, 15.1: o WhatsApp interno é o canal redundante);
--   * saúde mental imediata cria ocorrência privada de prioridade máxima.
-- Não passa pelo freio: alerta clínico e aviso interno são caminho à parte
-- (CLAUDE.md), e privado.pode_executar devolve verdadeiro para a categoria
-- interna em qualquer estado.

create function assistencial.criar_alerta_clinico(
  p_visita_id       uuid,
  p_regra_id        text,
  p_instrumento_ver text,
  p_bebe_id         uuid,
  p_campo           text,
  p_valor_observado text,
  p_manual          boolean,
  p_criado_por      uuid
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_visita  public.visita;
  v_familia uuid;
  v_regra   public.regra_alerta;
  v_id      uuid;
  v_existe  uuid;
  v_prof    uuid;
begin
  select v.* into v_visita from public.visita v where v.id = p_visita_id;
  if not found then
    raise exception 'checklist:visita_inexistente' using errcode = 'P0002';
  end if;
  select a.familia_id into v_familia from public.acompanhamento a where a.id = v_visita.acompanhamento_id;

  select r.* into v_regra from public.regra_alerta r
   where r.id = p_regra_id and r.instrumento_versao = p_instrumento_ver;
  if not found then
    raise exception 'checklist:regra_inexistente regra % na versão %', p_regra_id, p_instrumento_ver
      using errcode = '22023';
  end if;
  if not p_manual and not v_regra.ativa then
    raise exception 'checklist:regra_inativa regra % está desligada', p_regra_id
      using errcode = '22023';
  end if;
  if p_bebe_id is not null
     and not exists (select 1 from public.bebe b where b.id = p_bebe_id and b.familia_id = v_familia) then
    raise exception 'checklist:bebe_de_outra_familia' using errcode = '22023';
  end if;

  select a.id into v_existe from public.alerta_clinico a
   where a.visita_id = p_visita_id and a.regra_id = p_regra_id
     and coalesce(a.bebe_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_bebe_id, '00000000-0000-0000-0000-000000000000'::uuid);
  if found then
    return pg_catalog.jsonb_build_object('id', v_existe, 'criado', false);
  end if;

  insert into public.alerta_clinico (familia_id, visita_id, bebe_id, regra_id, instrumento_versao,
                                     severidade, campo, valor_observado, conduta, criado_por)
  values (v_familia, p_visita_id, p_bebe_id, v_regra.id, v_regra.instrumento_versao,
          v_regra.severidade, coalesce(p_campo, v_regra.campo), nullif(pg_catalog.btrim(p_valor_observado), ''),
          v_regra.conduta, p_criado_por)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select a.id into v_existe from public.alerta_clinico a
     where a.visita_id = p_visita_id and a.regra_id = p_regra_id
       and coalesce(a.bebe_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = coalesce(p_bebe_id, '00000000-0000-0000-0000-000000000000'::uuid);
    return pg_catalog.jsonb_build_object('id', v_existe, 'criado', false);
  end if;

  if exists (select 1 from public.automacao au where au.id = 'alerta_clinico') then
    perform privado.pode_executar(v_familia, 'alerta_clinico');
  end if;

  if v_regra.severidade in ('imediato', 'prioritario') then
    insert into public.notificacao (papel, prioridade, titulo, corpo, link, canais, criado_por)
    values ('coordenacao',
            case when v_regra.grupo = 'saude_mental' and v_regra.severidade = 'imediato' then 'maxima'::public.prioridade
                 when v_regra.severidade = 'imediato' then 'alta'::public.prioridade
                 else 'normal'::public.prioridade end,
            'alerta_clinico_' || v_regra.severidade::text,
            v_regra.id,
            '/alertas-clinicos',
            array['app', 'push', 'whatsapp_interno'],
            p_criado_por);
  end if;

  if v_regra.grupo = 'saude_mental' and v_regra.severidade = 'imediato' then
    select v.profissional_id into v_prof from public.visita v where v.id = p_visita_id;
    insert into public.ocorrencia (familia_id, profissional_id, tipo, prioridade, privada, titulo, descricao, criado_por)
    values (v_familia, v_prof, 'intercorrencia', 'maxima', true, v_regra.id, v_regra.conduta, p_criado_por);
  end if;

  return pg_catalog.jsonb_build_object('id', v_id, 'criado', true);
end;
$$;
comment on function assistencial.criar_alerta_clinico(uuid, text, text, uuid, text, text, boolean, uuid) is 'Cria o alerta clínico de uma regra numa visita (uma linha por regra, visita e bebê; idempotente). Severidade e conduta vêm de regra_alerta. Imediato e prioritário avisam a coordenação (app, push e whatsapp_interno, sem nome da paciente); saúde mental imediata abre ocorrência privada de prioridade máxima (PRD 9.3). Sem grant.';

-- --- Registro assistencial (append-only) -------------------------------------------------------

create function assistencial.registrar_atendimento(
  p_visita_id         uuid,
  p_dados             jsonb,
  p_resumo            text,
  p_assinado_em_ms    bigint,
  p_assinatura        text,
  p_instrumento_ver   text,
  p_sincronizado_de   uuid default null,
  p_alertas           jsonb default '[]'::jsonb
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_visita     public.visita;
  v_acomp      public.acompanhamento;
  v_prof       public.profissional;
  v_def        jsonb;
  v_bebes      uuid[];
  v_ultimo     boolean;
  v_assinado   timestamptz;
  v_dados_pend jsonb;
  v_pend       text[];
  v_existente  public.registro_atendimento;
  v_id         uuid;
  v_alerta     jsonb;
  v_criado     jsonb;
  v_bebe       uuid;
  v_ids        uuid[] := array[]::uuid[];
  v_novos      integer := 0;
  v_ac         jsonb;
  v_alerta_id  uuid;
  v_estado     text;
begin
  if p_dados is null or pg_catalog.jsonb_typeof(p_dados) <> 'object' then
    raise exception 'checklist:dados_invalidos os dados do registro precisam ser um objeto' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(p_resumo), '') is null then
    raise exception 'checklist:resumo_obrigatorio o resumo descritivo é obrigatório' using errcode = '22023';
  end if;
  if p_assinado_em_ms is null or p_assinatura is null then
    raise exception 'checklist:assinatura_obrigatoria' using errcode = '22023';
  end if;

  select v.* into v_visita from public.visita v where v.id = p_visita_id for update;
  if not found then
    raise exception 'checklist:visita_inexistente' using errcode = 'P0002';
  end if;
  select a.* into v_acomp from public.acompanhamento a where a.id = v_visita.acompanhamento_id;
  select pr.* into v_prof from public.profissional pr where pr.id = v_visita.profissional_id;

  -- quem assina é a profissional da visita (PRD 9.2: "assinado pela profissional")
  if v_prof.usuario_id is distinct from auth.uid() or not v_prof.ativa then
    raise exception 'checklist:nao_e_a_profissional_da_visita só a profissional da visita assina o registro'
      using errcode = '42501';
  end if;
  if privado.tem_papel('enfermeira') and not privado.tem_papel('coordenacao')
     and v_acomp.familia_id not in (select fa.id from privado.familias_atribuidas() as fa(id)) then
    raise exception 'checklist:familia_nao_atribuida' using errcode = '42501';
  end if;

  v_assinado := pg_catalog.to_timestamp(0) + p_assinado_em_ms * interval '1 millisecond';

  -- a assinatura é recalculada aqui a partir do que chegou
  if privado.hash_registro(p_dados, p_resumo, v_prof.id, v_assinado) <> p_assinatura then
    raise exception 'checklist:assinatura_invalida a assinatura não confere com o conteúdo recebido'
      using errcode = '22023';
  end if;

  -- já existe registro desta visita
  select r.* into v_existente from public.registro_atendimento r where r.visita_id = p_visita_id;
  if found then
    if v_existente.assinatura = p_assinatura then
      return pg_catalog.jsonb_build_object('id', v_existente.id, 'ja_registrado', true, 'alertas_criados', 0);
    end if;
    raise exception 'checklist:registro_divergente a visita já tem registro assinado com outro conteúdo; a correção é por adendo'
      using errcode = '23505';
  end if;

  -- o estado da visita: registrar exige visita iniciada ou já concluída
  v_estado := v_visita.estado::text;
  if v_estado not in ('iniciada', 'concluida', 'ficha_pendente', 'ficha_entregue', 'encerrada') then
    raise exception 'checklist:visita_nao_iniciada a visita está % e ainda não foi iniciada', v_estado
      using errcode = '55000';
  end if;

  -- instrumento aprovado e obrigatórios (PRD 9.2 v4.2)
  select i.definicao into v_def
  from public.instrumento i
  where i.codigo = 'DOC2_CHECKLIST' and i.versao = p_instrumento_ver and (i.vigente or i.aprovado_em is not null);
  if v_def is null then
    raise exception 'checklist:instrumento_indisponivel a versão % do checklist não está aprovada', p_instrumento_ver
      using errcode = '22023';
  end if;
  select coalesce(pg_catalog.array_agg(b.id order by b.ordem, b.id), array[]::uuid[]) into v_bebes
  from public.bebe b where b.familia_id = v_acomp.familia_id;
  v_ultimo := v_visita.dia_numero = v_acomp.dias_contratados;

  v_dados_pend := p_dados || pg_catalog.jsonb_build_object(
    'resumo', coalesce(p_dados -> 'resumo', '{}'::jsonb) || pg_catalog.jsonb_build_object('resumo_descritivo', p_resumo));
  v_pend := privado.pendencias_registro(v_dados_pend, v_def, v_ultimo, v_bebes);
  if pg_catalog.cardinality(v_pend) > 0 then
    raise exception 'checklist:obrigatorios_pendentes %', pg_catalog.array_to_string(v_pend, ',')
      using errcode = '22023';
  end if;

  insert into public.registro_atendimento (visita_id, profissional_id, instrumento_versao, dados,
                                           resumo_descritivo, assinado_em, assinatura, sincronizado_de)
  values (p_visita_id, v_prof.id, p_instrumento_ver, p_dados, p_resumo, v_assinado, p_assinatura, p_sincronizado_de)
  returning id into v_id;

  -- estado da visita: iniciada > concluida > ficha_pendente > ficha_entregue
  -- (a ficha entregue é o servidor ter recebido o registro assinado)
  if v_estado = 'iniciada' then
    perform privado.transicionar('visita', p_visita_id, 'concluida');
    v_estado := 'concluida';
  end if;
  if v_estado = 'concluida' then
    perform privado.transicionar('visita', p_visita_id, 'ficha_pendente');
    v_estado := 'ficha_pendente';
  end if;
  if v_estado = 'ficha_pendente' then
    perform privado.transicionar('visita', p_visita_id, 'ficha_entregue');
  end if;

  -- alertas reavaliados pelo servidor (o mesmo motor do aparelho, PRD 9.3)
  for v_alerta in select e from pg_catalog.jsonb_array_elements(coalesce(p_alertas, '[]'::jsonb)) as e loop
    v_bebe := nullif(v_alerta ->> 'bebe_id', '')::uuid;
    v_criado := assistencial.criar_alerta_clinico(
      p_visita_id, v_alerta ->> 'regra_id', p_instrumento_ver, v_bebe,
      v_alerta ->> 'campo', v_alerta ->> 'valor_observado', false, auth.uid());
    if (v_criado ->> 'criado')::boolean then
      v_novos := v_novos + 1;
    end if;
    v_ids := v_ids || (v_criado ->> 'id')::uuid;
  end loop;

  -- os quatro campos do DOC 3 feitos durante a visita (chave reservada _alertas)
  for v_ac in select e from pg_catalog.jsonb_array_elements(
                case when pg_catalog.jsonb_typeof(p_dados -> '_alertas') = 'array' then p_dados -> '_alertas' else '[]'::jsonb end) as e loop
    if nullif(v_ac ->> 'acionado_em', '')::timestamptz > pg_catalog.now() + interval '5 minutes' then
      raise exception 'checklist:acionamento_no_futuro a hora do acionamento não pode estar no futuro'
        using errcode = '22023';
    end if;
    select a.id into v_alerta_id from public.alerta_clinico a
     where a.visita_id = p_visita_id and a.regra_id = v_ac ->> 'regra_id'
       and coalesce(a.bebe_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = coalesce(nullif(v_ac ->> 'bebe_id', '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
       and a.fechado_em is null;
    if found then
      update public.alerta_clinico a
         set reconhecido_por = coalesce(a.reconhecido_por, auth.uid()),
             reconhecido_em = coalesce(a.reconhecido_em, pg_catalog.now()),
             sinal_identificado = coalesce(nullif(pg_catalog.btrim(v_ac ->> 'sinal_identificado'), ''), a.sinal_identificado),
             acionado_em = coalesce(nullif(v_ac ->> 'acionado_em', '')::timestamptz, a.acionado_em),
             orientacao_medica = coalesce(nullif(pg_catalog.btrim(v_ac ->> 'orientacao_medica'), ''), a.orientacao_medica),
             conduta_adotada = coalesce(nullif(pg_catalog.btrim(v_ac ->> 'conduta_adotada'), ''), a.conduta_adotada)
       where a.id = v_alerta_id;
    end if;
  end loop;

  -- último dia: contato do obstetra e do pediatra (PRD 7.3, P39 item 4)
  if v_ultimo then
    perform assistencial.registrar_contatos_ultimo_dia(v_acomp.familia_id, p_dados -> 'ultimo_dia', auth.uid());
  end if;

  return pg_catalog.jsonb_build_object('id', v_id, 'ja_registrado', false, 'alertas_criados', v_novos,
                                       'alertas', pg_catalog.to_jsonb(v_ids));
end;
$$;
comment on function assistencial.registrar_atendimento(uuid, jsonb, text, bigint, text, text, uuid, jsonb) is 'Único caminho de escrita de registro_atendimento (append-only, P39 item 3): confere quem assina (a profissional da visita), recalcula a assinatura sha256, exige os obrigatórios do instrumento aprovado (PRD 9.2 v4.2), grava, leva a visita a ficha_entregue, cria os alertas reavaliados pelo servidor e aplica o registro do DOC 3 feito na visita. Segundo envio igual não faz nada; diferente é recusado (23505) e a correção é por adendo. Sem grant.';

-- Contatos do obstetra e do pediatra no último dia (PRD 7.3): contato com
-- telefone ou e-mail vira linha em medico; ausência justificada abre a tarefa
-- obter_contato_medico para a coordenação, e a evolução fica bloqueada.
create function assistencial.registrar_contatos_ultimo_dia(p_familia_id uuid, p_bloco jsonb, p_usuario uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_espec    text;
  v_chave    text;
  v_valor    jsonb;
  v_texto    text;
  v_email    text;
  v_digitos  text;
  v_tel      text;
  v_faltam   text[] := array[]::text[];
  v_prazo    numeric;
  v_just     text[] := array[]::text[];
begin
  if p_bloco is null or pg_catalog.jsonb_typeof(p_bloco) <> 'object' then
    return;
  end if;

  foreach v_espec in array array['obstetra', 'pediatra'] loop
    v_chave := 'contato_' || v_espec;
    v_valor := p_bloco -> v_chave;
    v_texto := null;
    if pg_catalog.jsonb_typeof(v_valor) = 'string' then
      v_texto := nullif(pg_catalog.btrim(v_valor #>> '{}'), '');
    end if;

    if v_texto is not null then
      v_email := (pg_catalog.regexp_match(v_texto, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'))[1];
      v_digitos := pg_catalog.regexp_replace(pg_catalog.regexp_replace(v_texto, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '', 'g'), '\D', '', 'g');
      v_tel := null;
      if v_digitos ~ '^55[1-9][0-9]{9,10}$' then
        v_tel := '+' || v_digitos;
      elsif v_digitos ~ '^[1-9][0-9]{9,10}$' then
        v_tel := '+55' || v_digitos;
      end if;

      if v_email is not null or v_tel is not null then
        if not exists (select 1 from public.medico m
                        where m.familia_id = p_familia_id and m.especialidade = v_espec::public.especialidade_medico
                          and coalesce(m.telefone_e164, m.email) is not null) then
          insert into public.medico (familia_id, especialidade, nome, telefone_e164, email, origem_cadastro, capturado_em, criado_por)
          values (p_familia_id, v_espec::public.especialidade_medico, v_texto, v_tel, v_email, 'ultimo_dia',
                  pg_catalog.now(), p_usuario);
        end if;
        continue;
      end if;
    end if;

    -- sem contato utilizável: só conta como obtido o que a família já tem
    if not exists (select 1 from public.medico m
                    where m.familia_id = p_familia_id and m.especialidade = v_espec::public.especialidade_medico
                      and coalesce(m.telefone_e164, m.email) is not null) then
      v_faltam := v_faltam || v_espec;
      if pg_catalog.jsonb_typeof(v_valor) = 'object' and pg_catalog.btrim(coalesce(v_valor ->> 'justificativa', '')) <> '' then
        v_just := v_just || (v_espec || ': ' || pg_catalog.btrim(v_valor ->> 'justificativa'));
      end if;
    end if;
  end loop;

  if pg_catalog.cardinality(v_faltam) > 0
     and not exists (select 1 from public.tarefa t
                      where t.familia_id = p_familia_id and t.tipo = 'obter_contato_medico'
                        and t.status in ('aberta', 'em_andamento')) then
    select case when pg_catalog.jsonb_typeof(p.valor) = 'object' then (p.valor ->> 'prazo_horas')::numeric end
      into v_prazo from public.parametro p where p.chave = 'contato_medico_tarefa';
    insert into public.tarefa (tipo, familia_id, papel_responsavel, prioridade, titulo, payload, vence_em, criado_por)
    values ('obter_contato_medico', p_familia_id, 'coordenacao', 'alta',
            'Obter o contato do ' || pg_catalog.array_to_string(v_faltam, ' e do '),
            pg_catalog.jsonb_build_object('especialidades', pg_catalog.to_jsonb(v_faltam),
                                          'justificativas', pg_catalog.to_jsonb(v_just),
                                          'bloqueia', 'relatorio_medico'),
            case when v_prazo is not null then pg_catalog.now() + pg_catalog.make_interval(hours => v_prazo::integer) end,
            p_usuario);
  end if;
end;
$$;
comment on function assistencial.registrar_contatos_ultimo_dia(uuid, jsonb, uuid) is 'Último dia (PRD 7.3): contato com telefone ou e-mail vira linha em medico (origem ultimo_dia); sem contato utilizável abre a tarefa obter_contato_medico para a coordenação, com o prazo de parametro contato_medico_tarefa. Sem grant.';

-- --- Adendo -------------------------------------------------------------------------------------

create function assistencial.registrar_adendo(p_registro_id uuid, p_motivo text, p_conteudo text, p_autor uuid)
  returns uuid
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_id uuid;
begin
  if nullif(pg_catalog.btrim(p_motivo), '') is null then
    raise exception 'checklist:adendo_sem_motivo o adendo precisa de um motivo' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(p_conteudo), '') is null then
    raise exception 'checklist:adendo_sem_conteudo o adendo precisa de um texto' using errcode = '22023';
  end if;
  if not exists (select 1 from public.registro_atendimento r where r.id = p_registro_id) then
    raise exception 'checklist:registro_inexistente' using errcode = 'P0002';
  end if;
  -- reenvio do mesmo adendo pela fila offline (id do aparelho) não duplica
  select a.id into v_id from public.registro_adendo a
   where a.registro_id = p_registro_id and a.autor_id = p_autor
     and a.motivo = pg_catalog.btrim(p_motivo) and a.conteudo = pg_catalog.btrim(p_conteudo);
  if found then
    return v_id;
  end if;
  insert into public.registro_adendo (registro_id, autor_id, motivo, conteudo)
  values (p_registro_id, p_autor, pg_catalog.btrim(p_motivo), pg_catalog.btrim(p_conteudo))
  returning id into v_id;
  return v_id;
end;
$$;
comment on function assistencial.registrar_adendo(uuid, text, text, uuid) is 'Correção de um registro assinado (P39 item 3, PRD 6.10 regra 4): o original nunca muda, o adendo registra motivo e texto. O mesmo adendo do mesmo autor reenviado pela fila não duplica. Sem grant.';


-- =============================================================================
-- 6. Funções do schema api
-- =============================================================================

-- --- api.checklist_visita ---------------------------------------------------------------
create function api.checklist_visita(visita_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_v        public.visita;
  v_a        public.acompanhamento;
  v_f        public.familia;
  v_pr       public.profissional;
  v_def      jsonb;
  v_ver      text;
  v_def4     jsonb;
  v_reg      public.registro_atendimento;
  v_reg_json jsonb := null;
  v_bebes    jsonb;
  v_medicos  jsonb;
  v_regras   jsonb;
  v_ant      jsonb;
  v_alertas  jsonb;
  v_audios   jsonb;
  v_params   jsonb;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select v.* into v_v from public.visita v where v.id = checklist_visita.visita_id;
  if not found then
    raise exception 'api.checklist_visita: visita % não existe', checklist_visita.visita_id using errcode = 'P0002';
  end if;
  select a.* into v_a from public.acompanhamento a where a.id = v_v.acompanhamento_id;
  select f.* into v_f from public.familia f where f.id = v_a.familia_id;
  select pr.* into v_pr from public.profissional pr where pr.id = v_v.profissional_id;

  if not (privado.tem_papel('coordenacao') or privado.tem_papel('diretoria')) then
    if v_pr.usuario_id is distinct from auth.uid() or not v_pr.ativa
       or v_a.familia_id not in (select fa.id from privado.familias_atribuidas() as fa(id)) then
      raise exception 'api.checklist_visita: visita de outra profissional ou família não atribuída (PRD 13)'
        using errcode = '42501';
    end if;
  end if;

  perform privado.registrar_leitura('familia', v_f.id::text,
    pg_catalog.jsonb_build_object('funcao', 'api.checklist_visita', 'visita_id', v_v.id));

  select i.definicao, i.versao into v_def, v_ver
  from public.instrumento i
  where i.codigo = 'DOC2_CHECKLIST' and i.vigente
  order by i.aprovado_em desc nulls last, i.criado_em desc limit 1;
  select i.definicao into v_def4
  from public.instrumento i
  where i.codigo = 'DOC4_MAMADA' and i.vigente
  order by i.aprovado_em desc nulls last, i.criado_em desc limit 1;

  select * into v_reg from assistencial.ler_registro_atendimento(v_v.id);
  if v_reg.id is not null then
    v_ver := coalesce(v_ver, v_reg.instrumento_versao);
    v_reg_json := pg_catalog.jsonb_build_object(
      'id', v_reg.id, 'profissional_id', v_reg.profissional_id, 'instrumento_versao', v_reg.instrumento_versao,
      'dados', v_reg.dados, 'resumo_descritivo', v_reg.resumo_descritivo, 'assinado_em', v_reg.assinado_em,
      'assinatura', v_reg.assinatura,
      'adendos', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'id', ad.id, 'motivo', ad.motivo, 'conteudo', ad.conteudo, 'criado_em', ad.criado_em,
                 'autor', p.nome) order by ad.criado_em, ad.id)
        from assistencial.ler_adendos(v_reg.id) ad
        left join public.perfil p on p.id = ad.autor_id), '[]'::jsonb));
    -- registro já assinado com versão que não é a vigente: mostra a definição daquela versão
    if not exists (select 1 from public.instrumento i where i.codigo = 'DOC2_CHECKLIST' and i.versao = v_reg.instrumento_versao and i.vigente) then
      select i.definicao into v_def from public.instrumento i
       where i.codigo = 'DOC2_CHECKLIST' and i.versao = v_reg.instrumento_versao;
      v_ver := v_reg.instrumento_versao;
    end if;
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', b.id, 'ordem', b.ordem, 'nome', b.nome, 'data_nascimento', b.data_nascimento,
           'peso_nascimento_g', b.peso_nascimento_g, 'peso_alta_g', b.peso_alta_g) order by b.ordem, b.id), '[]'::jsonb)
    into v_bebes from public.bebe b where b.familia_id = v_f.id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', m.id, 'especialidade', m.especialidade, 'nome', m.nome,
           'telefone_e164', m.telefone_e164, 'email', m.email) order by m.especialidade, m.criado_em), '[]'::jsonb)
    into v_medicos from public.medico m where m.familia_id = v_f.id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', r.id, 'grupo', r.grupo, 'descricao', r.descricao, 'severidade', r.severidade,
           'conduta', r.conduta, 'campo', r.campo, 'condicao', r.condicao,
           'instrumento_versao', r.instrumento_versao, 'ativa', r.ativa) order by r.id), '[]'::jsonb)
    into v_regras from public.regra_alerta r where r.instrumento_versao = v_ver;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'visita_id', x.visita_id, 'dia_numero', x.dia_numero, 'data', x.data,
           'dados', x.dados, 'resumo_descritivo', x.resumo_descritivo) order by x.dia_numero desc), '[]'::jsonb)
    into v_ant from assistencial.ler_registros_anteriores(v_v.id) x;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', al.id, 'regra_id', al.regra_id, 'bebe_id', al.bebe_id, 'severidade', al.severidade,
           'campo', al.campo, 'valor_observado', al.valor_observado, 'conduta', al.conduta,
           'reconhecido_em', al.reconhecido_em, 'sinal_identificado', al.sinal_identificado,
           'acionado_em', al.acionado_em, 'orientacao_medica', al.orientacao_medica,
           'conduta_adotada', al.conduta_adotada, 'fechado_em', al.fechado_em, 'versao', al.versao)
           order by al.criado_em, al.id), '[]'::jsonb)
    into v_alertas from assistencial.ler_alertas_visita(v_v.id) al;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', au.id, 'duracao_seg', au.duracao_seg, 'status', au.status, 'criado_em', au.criado_em,
           'transcricao', au.transcricao) order by au.criado_em, au.id), '[]'::jsonb)
    into v_audios from assistencial.ler_anexos_audio(v_v.id) au;

  select coalesce(pg_catalog.jsonb_object_agg(p.chave, p.valor), '{}'::jsonb)
    into v_params
  from public.parametro p
  where p.chave in ('transcricao_audio_ativa', 'audio_url_assinada_segundos', 'audio_visita',
                    'seletor_sinais_doc3_ativo', 'supervisao_medica_telefone');

  return pg_catalog.jsonb_build_object(
    'visita', pg_catalog.jsonb_build_object(
      'id', v_v.id, 'acompanhamento_id', v_v.acompanhamento_id, 'profissional_id', v_v.profissional_id,
      'dia_numero', v_v.dia_numero, 'data', v_v.data, 'hora_prevista', v_v.hora_prevista,
      'estado', v_v.estado, 'checkin_em', v_v.checkin_em, 'checkout_em', v_v.checkout_em, 'versao', v_v.versao),
    'familia', pg_catalog.jsonb_build_object(
      'id', v_f.id, 'nome_exibicao', v_f.nome_exibicao, 'bairro', v_f.bairro, 'estado_sensivel', v_f.estado_sensivel,
      'dpp', v_f.dpp, 'data_nascimento', v_f.data_nascimento, 'data_alta', v_f.data_alta,
      'data_inicio_efetivo', v_f.data_inicio_efetivo, 'gemelar', v_f.gemelar),
    'acompanhamento', pg_catalog.jsonb_build_object(
      'id', v_a.id, 'dias_contratados', v_a.dias_contratados, 'ultimo_dia', v_v.dia_numero = v_a.dias_contratados),
    'profissional', pg_catalog.jsonb_build_object(
      'id', v_pr.id, 'nome', v_pr.nome, 'conselho', v_pr.conselho, 'conselho_uf', v_pr.conselho_uf,
      'conselho_numero', v_pr.conselho_numero),
    'instrumento', case when v_def is null then null else pg_catalog.jsonb_build_object(
      'codigo', 'DOC2_CHECKLIST', 'versao', v_ver, 'definicao', v_def) end,
    'instrumento_doc4', v_def4,
    'bebes', v_bebes,
    'medicos', v_medicos,
    'regras', v_regras,
    'registro', v_reg_json,
    'anteriores', v_ant,
    'alertas', v_alertas,
    'audios', v_audios,
    'parametros', v_params);
end;
$$;
comment on function api.checklist_visita(uuid) is 'Tudo que a tela do checklist precisa (P39): visita, família, bebês, médicos, definição aprovada do DOC 2 e do DOC 4, regras de alerta para o cache do aparelho, registro assinado com adendos, dias anteriores, alertas e áudios da visita. Enfermeira só na própria visita de família atribuída; coordenação e diretoria leem. AAL2. Toda leitura assistencial grava ''leitura'' no log (assistencial.ler_*).';

-- --- api.registrar_atendimento ---------------------------------------------------------------
create function api.registrar_atendimento(
  visita_id          uuid,
  dados              jsonb,
  resumo             text,
  assinado_em_ms     bigint,
  assinatura         text,
  instrumento_versao text,
  sincronizado_de    uuid default null,
  alertas            jsonb default '[]'::jsonb
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  return assistencial.registrar_atendimento(
    registrar_atendimento.visita_id, registrar_atendimento.dados, registrar_atendimento.resumo,
    registrar_atendimento.assinado_em_ms, registrar_atendimento.assinatura,
    registrar_atendimento.instrumento_versao, registrar_atendimento.sincronizado_de,
    registrar_atendimento.alertas);
end;
$$;
comment on function api.registrar_atendimento(uuid, jsonb, text, bigint, text, text, uuid, jsonb) is 'Grava o registro assinado da visita (P39): enfermeira ou coordenação que é a profissional da visita, AAL2. A assinatura é recalculada e os obrigatórios conferidos em assistencial.registrar_atendimento. Append-only.';

-- --- api.registrar_adendo ---------------------------------------------------------------------
create function api.registrar_adendo(registro_id uuid, motivo text, conteudo text) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_reg public.registro_atendimento;
  v_pr  public.profissional;
  v_id  uuid;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select r.* into v_reg from public.registro_atendimento r where r.id = registrar_adendo.registro_id;
  if not found then
    raise exception 'checklist:registro_inexistente' using errcode = 'P0002';
  end if;
  if not privado.tem_papel('coordenacao') then
    select pr.* into v_pr from public.profissional pr where pr.id = v_reg.profissional_id;
    if v_pr.usuario_id is distinct from auth.uid() then
      raise exception 'checklist:adendo_de_outra_profissional só quem assinou o registro faz o adendo'
        using errcode = '42501';
    end if;
  end if;

  v_id := assistencial.registrar_adendo(registrar_adendo.registro_id, registrar_adendo.motivo,
                                        registrar_adendo.conteudo, auth.uid());
  return pg_catalog.jsonb_build_object('id', v_id, 'registro_id', registrar_adendo.registro_id);
end;
$$;
comment on function api.registrar_adendo(uuid, text, text) is 'Correção do registro assinado por adendo com motivo (P39 item 3): quem assinou o registro ou a coordenação, AAL2. O registro original não muda.';

-- --- api.registrar_alerta_clinico (alerta criado no aparelho, ou sinal do seletor) -------------
create function api.registrar_alerta_clinico(
  visita_id          uuid,
  regra_id           text,
  instrumento_versao text,
  bebe_id            uuid default null,
  campo              text default null,
  valor_observado    text default null,
  manual             boolean default false
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_v  public.visita;
  v_a  public.acompanhamento;
  v_pr public.profissional;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select v.* into v_v from public.visita v where v.id = registrar_alerta_clinico.visita_id;
  if not found then
    raise exception 'checklist:visita_inexistente' using errcode = 'P0002';
  end if;
  select a.* into v_a from public.acompanhamento a where a.id = v_v.acompanhamento_id;
  select pr.* into v_pr from public.profissional pr where pr.id = v_v.profissional_id;
  if not privado.tem_papel('coordenacao') then
    if v_pr.usuario_id is distinct from auth.uid()
       or v_a.familia_id not in (select fa.id from privado.familias_atribuidas() as fa(id)) then
      raise exception 'checklist:visita_de_outra_profissional' using errcode = '42501';
    end if;
  end if;

  if registrar_alerta_clinico.manual and not coalesce((
       select (p.valor #>> '{}')::boolean from public.parametro p
        where p.chave = 'seletor_sinais_doc3_ativo' and pg_catalog.jsonb_typeof(p.valor) = 'boolean'), false) then
    raise exception 'checklist:seletor_desligado a lista de sinais do DOC 3 ainda aguarda a validação clínica'
      using errcode = '22023';
  end if;

  return assistencial.criar_alerta_clinico(
    registrar_alerta_clinico.visita_id, registrar_alerta_clinico.regra_id,
    registrar_alerta_clinico.instrumento_versao, registrar_alerta_clinico.bebe_id,
    registrar_alerta_clinico.campo, registrar_alerta_clinico.valor_observado,
    registrar_alerta_clinico.manual, auth.uid());
end;
$$;
comment on function api.registrar_alerta_clinico(uuid, text, text, uuid, text, text, boolean) is 'Cria o alerta clínico que o aparelho avaliou no momento do campo (regra ativa) ou o sinal escolhido no seletor do DOC 3 (manual, só com seletor_sinais_doc3_ativo). Severidade e conduta vêm de regra_alerta. Idempotente por regra, visita e bebê. Imediato e prioritário avisam a coordenação; saúde mental imediata abre ocorrência privada. Enfermeira na própria visita, coordenação em qualquer. AAL2.';

-- --- api.alertas_clinicos ---------------------------------------------------------------------
create function api.alertas_clinicos(situacao text default 'abertos', familia_id uuid default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  if alertas_clinicos.situacao is null or alertas_clinicos.situacao not in ('abertos', 'fechados', 'todos') then
    raise exception 'api.alertas_clinicos: situacao deve ser abertos, fechados ou todos' using errcode = '22023';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a))
    from assistencial.ler_alertas_clinicos(alertas_clinicos.situacao, alertas_clinicos.familia_id) a), '[]'::jsonb);
end;
$$;
comment on function api.alertas_clinicos(text, uuid) is 'Lista de alertas clínicos com a regra e a família (P40): enfermeira nas famílias atribuídas, coordenação e diretoria em todas. Imediatos primeiro, abertos antes de fechados. AAL2. Grava uma ''leitura'' por família.';

-- --- api.registrar_acionamento_alerta ---------------------------------------------------------
create function api.registrar_acionamento_alerta(
  alerta_id          uuid,
  versao_base        integer,
  sinal_identificado text,
  acionado_em        timestamptz,
  orientacao_medica  text,
  conduta_adotada    text
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_al public.alerta_clinico;
  v_ok boolean;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  if privado.tem_papel('diretoria') and not (privado.tem_papel('coordenacao') or privado.tem_papel('enfermeira')) then
    raise exception 'api.registrar_acionamento_alerta: a diretoria só lê alertas' using errcode = '42501';
  end if;

  select a.* into v_al from public.alerta_clinico a where a.id = registrar_acionamento_alerta.alerta_id for update;
  if not found then
    raise exception 'checklist:alerta_inexistente' using errcode = 'P0002';
  end if;
  if not (privado.tem_papel('coordenacao')
          or v_al.familia_id in (select fa.id from privado.familias_atribuidas() as fa(id))) then
    raise exception 'checklist:familia_nao_atribuida' using errcode = '42501';
  end if;
  if v_al.fechado_em is not null then
    raise exception 'checklist:alerta_fechado o alerta já foi fechado' using errcode = '22023';
  end if;
  if registrar_acionamento_alerta.versao_base is not null and v_al.versao <> registrar_acionamento_alerta.versao_base then
    raise exception 'checklist:versao_desatualizada o alerta mudou (versão % e não %)', v_al.versao, registrar_acionamento_alerta.versao_base
      using errcode = '40001';
  end if;
  if registrar_acionamento_alerta.acionado_em is not null and registrar_acionamento_alerta.acionado_em > pg_catalog.now() + interval '5 minutes' then
    raise exception 'checklist:acionamento_no_futuro a hora do acionamento não pode estar no futuro' using errcode = '22023';
  end if;

  update public.alerta_clinico a
     set reconhecido_por = coalesce(a.reconhecido_por, auth.uid()),
         reconhecido_em = coalesce(a.reconhecido_em, pg_catalog.now()),
         sinal_identificado = coalesce(nullif(pg_catalog.btrim(registrar_acionamento_alerta.sinal_identificado), ''), a.sinal_identificado),
         acionado_em = coalesce(registrar_acionamento_alerta.acionado_em, a.acionado_em),
         orientacao_medica = coalesce(nullif(pg_catalog.btrim(registrar_acionamento_alerta.orientacao_medica), ''), a.orientacao_medica),
         conduta_adotada = coalesce(nullif(pg_catalog.btrim(registrar_acionamento_alerta.conduta_adotada), ''), a.conduta_adotada)
   where a.id = v_al.id
   returning (a.sinal_identificado is not null and a.acionado_em is not null
              and a.orientacao_medica is not null and a.conduta_adotada is not null)
        into v_ok;

  return pg_catalog.jsonb_build_object('id', v_al.id, 'registro_completo', v_ok, 'versao', v_al.versao + 1);
end;
$$;
comment on function api.registrar_acionamento_alerta(uuid, integer, text, timestamptz, text, text) is 'Registra os campos do DOC 3 de um alerta aberto (sinal identificado, hora do acionamento, orientação médica, conduta adotada), sem fechar. Enfermeira nas famílias atribuídas e coordenação. Conflito de versão: 40001. AAL2.';

-- --- api.fechar_alerta_clinico --------------------------------------------------------------------
create function api.fechar_alerta_clinico(alerta_id uuid, versao_base integer default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_al public.alerta_clinico;
  v_faltam text[] := array[]::text[];
begin
  perform privado.autorizar(array['coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select a.* into v_al from public.alerta_clinico a where a.id = fechar_alerta_clinico.alerta_id for update;
  if not found then
    raise exception 'checklist:alerta_inexistente' using errcode = 'P0002';
  end if;
  if v_al.fechado_em is not null then
    return pg_catalog.jsonb_build_object('id', v_al.id, 'fechado', true, 'alterado', false);
  end if;
  if fechar_alerta_clinico.versao_base is not null and v_al.versao <> fechar_alerta_clinico.versao_base then
    raise exception 'checklist:versao_desatualizada o alerta mudou (versão % e não %)', v_al.versao, fechar_alerta_clinico.versao_base
      using errcode = '40001';
  end if;

  if nullif(pg_catalog.btrim(v_al.sinal_identificado), '') is null then v_faltam := v_faltam || 'sinal_identificado'::text; end if;
  if v_al.acionado_em is null then v_faltam := v_faltam || 'acionado_em'::text; end if;
  if nullif(pg_catalog.btrim(v_al.orientacao_medica), '') is null then v_faltam := v_faltam || 'orientacao_medica'::text; end if;
  if nullif(pg_catalog.btrim(v_al.conduta_adotada), '') is null then v_faltam := v_faltam || 'conduta_adotada'::text; end if;
  if pg_catalog.cardinality(v_faltam) > 0 then
    raise exception 'checklist:fechamento_incompleto falta registrar: %', pg_catalog.array_to_string(v_faltam, ', ')
      using errcode = '22023';
  end if;

  update public.alerta_clinico a
     set fechado_em = pg_catalog.now(), fechado_por = auth.uid()
   where a.id = v_al.id;
  return pg_catalog.jsonb_build_object('id', v_al.id, 'fechado', true, 'alterado', true);
end;
$$;
comment on function api.fechar_alerta_clinico(uuid, integer) is 'Fecha um alerta clínico (P40 item 4, PRD 9.3): só a coordenação, AAL2, e só com sinal identificado, hora do acionamento, orientação médica e conduta adotada já registrados (o banco também recusa por restrição). Conflito de versão: 40001.';

-- --- api.registrar_anexo_audio -----------------------------------------------------------------------
create function api.registrar_anexo_audio(visita_id uuid, arquivo_path text, duracao_seg integer default null) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_v      public.visita;
  v_a      public.acompanhamento;
  v_pr     public.profissional;
  v_limite jsonb;
  v_ret    integer;
  v_id     uuid;
  v_ate    date;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;

  select v.* into v_v from public.visita v where v.id = registrar_anexo_audio.visita_id;
  if not found then
    raise exception 'checklist:visita_inexistente' using errcode = 'P0002';
  end if;
  select a.* into v_a from public.acompanhamento a where a.id = v_v.acompanhamento_id;
  select pr.* into v_pr from public.profissional pr where pr.id = v_v.profissional_id;
  if not privado.tem_papel('coordenacao') then
    if v_pr.usuario_id is distinct from auth.uid()
       or v_a.familia_id not in (select fa.id from privado.familias_atribuidas() as fa(id)) then
      raise exception 'checklist:visita_de_outra_profissional' using errcode = '42501';
    end if;
  end if;

  -- caminho no storage privado: sempre pelo id da visita, nunca por nome de paciente
  if registrar_anexo_audio.arquivo_path !~ ('^visitas/' || registrar_anexo_audio.visita_id::text || '/[0-9a-f-]{36}\.[a-z0-9]{2,5}$') then
    raise exception 'checklist:caminho_invalido o áudio fica em visitas/<id da visita>/<id do arquivo>' using errcode = '22023';
  end if;

  select p.valor into v_limite from public.parametro p where p.chave = 'audio_visita';
  if registrar_anexo_audio.duracao_seg is not null
     and pg_catalog.jsonb_typeof(v_limite -> 'duracao_max_seg') = 'number'
     and registrar_anexo_audio.duracao_seg > (v_limite ->> 'duracao_max_seg')::integer then
    raise exception 'checklist:audio_longo o áudio passa do limite de duração' using errcode = '22023';
  end if;

  select case when pg_catalog.jsonb_typeof(p.valor) = 'number' then (p.valor #>> '{}')::integer end
    into v_ret from public.parametro p where p.chave = 'retencao_audio_dias';
  v_ate := case when v_ret is not null
                then (pg_catalog.now() at time zone 'America/Sao_Paulo')::date + v_ret end;

  -- transcrição fica desligada (L-04): o áudio entra pendente, sem texto
  insert into public.anexo_audio (visita_id, arquivo_path, duracao_seg, retencao_ate, status, criado_por)
  values (registrar_anexo_audio.visita_id, registrar_anexo_audio.arquivo_path, registrar_anexo_audio.duracao_seg,
          v_ate, 'pendente', auth.uid())
  returning id into v_id;

  return pg_catalog.jsonb_build_object('id', v_id, 'retencao_ate', v_ate);
end;
$$;
comment on function api.registrar_anexo_audio(uuid, text, integer) is 'Anexa um áudio à visita (P39 item 6): caminho visitas/<visita>/<arquivo> no storage privado, duração limitada por parametro audio_visita, retenção por parametro retencao_audio_dias, transcrição desligada (parametro transcricao_audio_ativa). Enfermeira na própria visita, coordenação em qualquer. AAL2.';

-- --- api.audio_da_visita_para_ouvir ------------------------------------------------------------------
create function api.audio_da_visita_para_ouvir(audio_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_au public.anexo_audio;
  v_v  public.visita;
  v_a  public.acompanhamento;
  v_pr public.profissional;
  v_seg integer;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  if privado.origem_atual() is null then
    perform pg_catalog.set_config('app.origem', 'app', true);
  end if;
  select x.* into v_au from public.anexo_audio x where x.id = audio_da_visita_para_ouvir.audio_id;
  if not found then
    raise exception 'checklist:audio_inexistente' using errcode = 'P0002';
  end if;
  select v.* into v_v from public.visita v where v.id = v_au.visita_id;
  select a.* into v_a from public.acompanhamento a where a.id = v_v.acompanhamento_id;
  select pr.* into v_pr from public.profissional pr where pr.id = v_v.profissional_id;
  if not (privado.tem_papel('coordenacao') or privado.tem_papel('diretoria')) then
    if v_pr.usuario_id is distinct from auth.uid()
       or v_a.familia_id not in (select fa.id from privado.familias_atribuidas() as fa(id)) then
      raise exception 'checklist:visita_de_outra_profissional' using errcode = '42501';
    end if;
  end if;
  perform privado.registrar_leitura('anexo_audio', v_au.id::text,
    pg_catalog.jsonb_build_object('funcao', 'api.audio_da_visita_para_ouvir', 'visita_id', v_au.visita_id));
  select case when pg_catalog.jsonb_typeof(p.valor) = 'number' then (p.valor #>> '{}')::integer end
    into v_seg from public.parametro p where p.chave = 'audio_url_assinada_segundos';
  return pg_catalog.jsonb_build_object('arquivo_path', v_au.arquivo_path, 'validade_seg', v_seg);
end;
$$;
comment on function api.audio_da_visita_para_ouvir(uuid) is 'Autoriza ouvir um áudio da visita (P39 item 6): confere papel e família, grava a leitura e devolve o caminho no storage e a validade da URL assinada (parametro audio_url_assinada_segundos, 60 s). Quem assina a URL é o servidor do app. AAL2.';

-- --- api.contato_medico_situacao ------------------------------------------------------------------------
create function api.contato_medico_situacao(familia_id uuid) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
#variable_conflict use_column
declare
  v_obs boolean;
  v_ped boolean;
  v_tarefa boolean;
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  if not privado.tem_acesso_familia(contato_medico_situacao.familia_id) then
    raise exception 'api.contato_medico_situacao: família % fora do seu acesso (PRD 13)', contato_medico_situacao.familia_id
      using errcode = '42501';
  end if;
  select exists (select 1 from public.medico m where m.familia_id = contato_medico_situacao.familia_id
                  and m.especialidade = 'obstetra' and coalesce(m.telefone_e164, m.email) is not null) into v_obs;
  select exists (select 1 from public.medico m where m.familia_id = contato_medico_situacao.familia_id
                  and m.especialidade = 'pediatra' and coalesce(m.telefone_e164, m.email) is not null) into v_ped;
  select exists (select 1 from public.tarefa t where t.familia_id = contato_medico_situacao.familia_id
                  and t.tipo = 'obter_contato_medico' and t.status in ('aberta', 'em_andamento')) into v_tarefa;
  -- PRD 7.3: o relatório médico fica bloqueado até existir pelo menos um contato
  return pg_catalog.jsonb_build_object(
    'obstetra', v_obs, 'pediatra', v_ped, 'tarefa_aberta', v_tarefa,
    'evolucao_bloqueada', not (v_obs or v_ped));
end;
$$;
comment on function api.contato_medico_situacao(uuid) is 'Situação dos contatos do obstetra e do pediatra (PRD 7.3): com telefone ou e-mail, tarefa obter_contato_medico aberta e se a evolução fica bloqueada (nenhum contato). Quem tem acesso à família, AAL2.';


-- =============================================================================
-- 7. Alinha as regras ativas do DOC 3 aos caminhos do DOC 2 aprovado (P34)
--
-- O seed do P08 usava nomes provisórios que o instrumento não tem; o P34
-- deixou o alinhamento para o P40. Só as linhas ativas com campo no DOC 2
-- mudam de caminho; ativação, severidade e conduta não mudam.
--   PU-04  2.2.cesarea_sem_sinais_infeccao = não
--   RN-01  3.respiracao_sem_sinais_esforco = não   (polaridade do PRD 9.2)
--   RN-03  3.atividade_responsividade_preservadas = não
-- RN-04 e RN-07 continuam sem campo avaliável no DOC 2 v1 (o campo do PRD é
-- sim ou não com texto): ficam ativas e entram no seletor de sinais.
-- =============================================================================

update public.regra_alerta
   set campo = '2.2.cesarea_sem_sinais_infeccao',
       condicao = '{"campo":"2.2.cesarea_sem_sinais_infeccao","operador":"=","valor":false}'::jsonb
 where id = 'PU-04' and instrumento_versao = 'v1-2026-09' and ativa;

update public.regra_alerta
   set campo = '3.respiracao_sem_sinais_esforco',
       condicao = '{"campo":"3.respiracao_sem_sinais_esforco","operador":"=","valor":false}'::jsonb
 where id = 'RN-01' and instrumento_versao = 'v1-2026-09' and ativa;

update public.regra_alerta
   set campo = '3.atividade_responsividade_preservadas',
       condicao = '{"campo":"3.atividade_responsividade_preservadas","operador":"=","valor":false}'::jsonb
 where id = 'RN-03' and instrumento_versao = 'v1-2026-09' and ativa;

-- Telefone da supervisão médica para a lista de alertas (P40). O parâmetro é
-- lido só pela diretoria (RLS de parametro); a enfermeira e a coordenação
-- precisam dele para o botão "Ligar para a supervisão". Devolve só este
-- valor, nunca a tabela de parâmetros.
create function api.supervisao_medica_telefone() returns text
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
begin
  perform privado.autorizar(array['enfermeira', 'coordenacao', 'diretoria']::public.papel_usuario[], true);
  return coalesce((select p.valor #>> '{}'
                     from public.parametro p where p.chave = 'supervisao_medica_telefone'), '');
end;
$$;
comment on function api.supervisao_medica_telefone() is 'Telefone da supervisão médica (parâmetro supervisao_medica_telefone, E.164) para o botão Ligar da lista de alertas (P40). Enfermeira, coordenação e diretoria, AAL2. Vazio até a Kraamzorg informar.';

-- =============================================================================
-- 8. Execute e trava de segurança
-- =============================================================================

revoke execute on function privado.json_canonico(jsonb)                                   from public, anon, authenticated, service_role;
revoke execute on function privado.hash_registro(jsonb, text, uuid, timestamptz)          from public, anon, authenticated, service_role;
revoke execute on function privado.registro_confere(uuid)                                 from public, anon, authenticated, service_role;
revoke execute on function privado.campo_respondido(jsonb, jsonb)                         from public, anon, authenticated, service_role;
revoke execute on function privado.condicao_visivel(jsonb, jsonb, boolean, jsonb)         from public, anon, authenticated, service_role;
revoke execute on function privado.pendencias_registro(jsonb, jsonb, boolean, uuid[])     from public, anon, authenticated, service_role;

revoke execute on function assistencial.ler_registro_atendimento(uuid)                    from public, anon, authenticated, service_role;
revoke execute on function assistencial.ler_adendos(uuid)                                 from public, anon, authenticated, service_role;
revoke execute on function assistencial.ler_registros_anteriores(uuid)                    from public, anon, authenticated, service_role;
revoke execute on function assistencial.ler_alertas_visita(uuid)                          from public, anon, authenticated, service_role;
revoke execute on function assistencial.ler_anexos_audio(uuid)                            from public, anon, authenticated, service_role;
revoke execute on function assistencial.ler_alertas_clinicos(text, uuid)                  from public, anon, authenticated, service_role;
revoke execute on function assistencial.criar_alerta_clinico(uuid, text, text, uuid, text, text, boolean, uuid) from public, anon, authenticated, service_role;
revoke execute on function assistencial.registrar_atendimento(uuid, jsonb, text, bigint, text, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke execute on function assistencial.registrar_contatos_ultimo_dia(uuid, jsonb, uuid)  from public, anon, authenticated, service_role;
revoke execute on function assistencial.registrar_adendo(uuid, text, text, uuid)          from public, anon, authenticated, service_role;

revoke execute on function api.checklist_visita(uuid)                                     from public, anon, service_role;
revoke execute on function api.registrar_atendimento(uuid, jsonb, text, bigint, text, text, uuid, jsonb) from public, anon, service_role;
revoke execute on function api.registrar_adendo(uuid, text, text)                         from public, anon, service_role;
revoke execute on function api.registrar_alerta_clinico(uuid, text, text, uuid, text, text, boolean) from public, anon, service_role;
revoke execute on function api.alertas_clinicos(text, uuid)                               from public, anon, service_role;
revoke execute on function api.registrar_acionamento_alerta(uuid, integer, text, timestamptz, text, text) from public, anon, service_role;
revoke execute on function api.fechar_alerta_clinico(uuid, integer)                       from public, anon, service_role;
revoke execute on function api.registrar_anexo_audio(uuid, text, integer)                 from public, anon, service_role;
revoke execute on function api.audio_da_visita_para_ouvir(uuid)                           from public, anon, service_role;
revoke execute on function api.contato_medico_situacao(uuid)                              from public, anon, service_role;
revoke execute on function api.supervisao_medica_telefone()                                 from public, anon, service_role;

grant execute on function api.checklist_visita(uuid)                                      to authenticated;
grant execute on function api.registrar_atendimento(uuid, jsonb, text, bigint, text, text, uuid, jsonb) to authenticated;
grant execute on function api.registrar_adendo(uuid, text, text)                          to authenticated;
grant execute on function api.registrar_alerta_clinico(uuid, text, text, uuid, text, text, boolean) to authenticated;
grant execute on function api.alertas_clinicos(text, uuid)                                to authenticated;
grant execute on function api.registrar_acionamento_alerta(uuid, integer, text, timestamptz, text, text) to authenticated;
grant execute on function api.fechar_alerta_clinico(uuid, integer)                        to authenticated;
grant execute on function api.registrar_anexo_audio(uuid, text, integer)                  to authenticated;
grant execute on function api.audio_da_visita_para_ouvir(uuid)                            to authenticated;
grant execute on function api.contato_medico_situacao(uuid)                               to authenticated;
grant execute on function api.supervisao_medica_telefone()                                  to authenticated;

do $$
declare
  v_lista text;
begin
  -- função de api fora da regra (security definer, search_path vazio, só authenticated)
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

  -- assistencial: nenhuma função executável por papel da aplicação
  select string_agg(p.oid::regprocedure::text, ', ')
    into v_lista
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'assistencial'
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
         or has_function_privilege('service_role', p.oid, 'execute'));
  if v_lista is not null then
    raise exception 'função de assistencial executável por papel da aplicação: %', v_lista;
  end if;

  -- privado: só as quatro do PRD 11.10 para authenticated
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
