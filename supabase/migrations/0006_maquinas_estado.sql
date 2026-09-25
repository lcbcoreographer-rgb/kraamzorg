-- =============================================================================
-- 0006_maquinas_estado.sql
--
-- P06 (PROMPTS.md v2) · PRD 7 inteiro, 6.10 (regra 14), 13, 16.1 (invariante 1)
--
-- Máquinas de estado dos quatro pipelines. "O sistema recusa transição não
-- prevista. Estado livre em campo de texto é proibido" (PRD 7).
--
-- O que esta migration faz:
--   1. privado.maquina_estado (enum) e privado.transicao_permitida, a tabela
--      de transições do capítulo 7 para p1, p2, acompanhamento, visita e p4,
--      com as regras especiais.
--   2. privado.tem_papel(papel), security definer (senão a política de
--      usuario_papel entra em recursão no P07).
--   3. privado.transicionar(maquina, entidade_id, para, motivo): valida a
--      transição e o papel, liga app.transicao só naquela transação, grava o
--      novo estado, registra evento_familia e log_auditoria.
--   4. Gatilho que recusa mudança direta de oportunidade.estagio_p1,
--      oportunidade.estagio_p2 (e pipeline), acompanhamento.estado,
--      visita.estado e pos_venda.estagio fora de privado.transicionar, e
--      recusa que um papel da aplicação crie a linha já num estado adiantado.
--
-- Nenhuma função recebe grant aqui. O P07 concede execute de
-- privado.tem_papel a authenticated (PRD 11.10) e publica os wrappers de
-- transição em api.
-- =============================================================================


-- =============================================================================
-- 1. Tabela de transições (PRD 7, P06 item 1)
-- =============================================================================

-- As cinco máquinas do capítulo 7. Fica em privado (não em public) porque é
-- um tipo interno desta tabela, não um estado de negócio de coluna.
create type privado.maquina_estado as enum ('p1', 'p2', 'acompanhamento', 'visita', 'p4');
comment on type privado.maquina_estado is 'Máquinas de estado do PRD 7: p1 (oportunidade.estagio_p1), p2 (oportunidade.estagio_p2), acompanhamento (acompanhamento.estado), visita (visita.estado), p4 (pos_venda.estagio).';

create table privado.transicao_permitida (
  maquina      privado.maquina_estado not null,
  de           text not null,
  para         text not null,
  automatica   boolean not null default false,
  papel_minimo public.papel_usuario,
  primary key (maquina, de, para),
  check (de <> para)
);
comment on table privado.transicao_permitida is 'Transições permitidas de cada máquina de estado (PRD 7). Carregada nesta migration; mudança só por migration nova. de e para são rótulos do enum da máquina, conferidos por gatilho. Na p2, as linhas de entrada vindas do P1 têm em "de" um rótulo de estagio_p1.';
comment on column privado.transicao_permitida.automatica is 'Verdadeiro: a transição pode ser feita pelo sistema (automação, webhook, agente), sem usuário identificado. Falso: só por usuário com o papel exigido.';
comment on column privado.transicao_permitida.papel_minimo is 'Papel exigido de quem pede a transição. Nulo = qualquer usuário com perfil ativo e algum papel. diretoria cobre qualquer papel, salvo na saída de intercorrencia (PRD 7.2: só coordenação); coordenacao cobre enfermeira (PRD 13: agenda e registro Total).';

alter table privado.transicao_permitida enable row level security;

-- --- Conferência de rótulos -------------------------------------------------
-- "Todo estado é enum": de e para ficam em texto porque cada máquina usa um
-- enum diferente, mas este gatilho recusa qualquer rótulo que não seja do
-- enum da máquina. Na p2, "de" pode ser um rótulo de estagio_p1 (passagem
-- do P1 para o P2), desde que não exista também em estagio_p2 (senão a
-- origem ficaria ambígua; hoje só "perdido" está nos dois, e P1 perdido não
-- passa para o P2).

create function privado.rotulo_existe(tipo regtype, rotulo text) returns boolean
  language sql
  stable
  set search_path = ''
  as $$
  select exists (
    select 1 from pg_catalog.pg_enum e
    where e.enumtypid = tipo and e.enumlabel = rotulo
  )
$$;
comment on function privado.rotulo_existe(regtype, text) is 'Verdadeiro se rotulo é um valor do enum tipo.';

create function privado.conferir_transicao_permitida() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_tipo regtype;
begin
  v_tipo := case new.maquina
              when 'p1' then 'public.estagio_p1'::regtype
              when 'p2' then 'public.estagio_p2'::regtype
              when 'acompanhamento' then 'public.estado_acompanhamento'::regtype
              when 'visita' then 'public.estado_visita'::regtype
              when 'p4' then 'public.estagio_p4'::regtype
            end;

  if not privado.rotulo_existe(v_tipo, new.para) then
    raise exception 'transicao_permitida: "%" não é estado de %', new.para, new.maquina
      using errcode = '22023';
  end if;

  if new.maquina = 'p2' and not privado.rotulo_existe(v_tipo, new.de) then
    if not privado.rotulo_existe('public.estagio_p1'::regtype, new.de) then
      raise exception 'transicao_permitida: "%" não é estado de p2 nem de p1', new.de
        using errcode = '22023';
    end if;
  elsif new.maquina = 'p2' and privado.rotulo_existe('public.estagio_p1'::regtype, new.de) then
    raise exception 'transicao_permitida: "%" existe em p1 e em p2, origem ambígua na máquina p2', new.de
      using errcode = '22023';
  elsif new.maquina <> 'p2' and not privado.rotulo_existe(v_tipo, new.de) then
    raise exception 'transicao_permitida: "%" não é estado de %', new.de, new.maquina
      using errcode = '22023';
  end if;

  return new;
end;
$$;
comment on function privado.conferir_transicao_permitida() is 'Gatilho BEFORE INSERT OR UPDATE de privado.transicao_permitida: de e para precisam ser rótulos do enum da máquina (na p2, de pode ser rótulo exclusivo de estagio_p1: passagem do P1 para o P2).';

create trigger conferir_transicao_permitida
  before insert or update on privado.transicao_permitida
  for each row execute function privado.conferir_transicao_permitida();


-- --- Pipeline 1: entrada e qualificação (PRD 7.1) ---------------------------
-- Linha principal: novo → em_conversa_ia → qualificado →
-- sessao_venda_agendada → sessao_venda_realizada → [Pipeline 2].
-- Automáticas: as que o agente e as automações fazem (atualizar_lead,
-- registrar_marco, reabertura quando a família volta a escrever, reentrada
-- da nutrição quando a semana avança). Agendar e realizar a sessão e a
-- volta de sessao_venda_agendada para qualificado são do comercial.

insert into privado.transicao_permitida (maquina, de, para, automatica, papel_minimo) values
  -- linha principal
  ('p1', 'novo',                  'em_conversa_ia',         true,  'comercial'),
  ('p1', 'em_conversa_ia',        'qualificado',            true,  'comercial'),
  ('p1', 'qualificado',           'sessao_venda_agendada',  false, 'comercial'),
  ('p1', 'sessao_venda_agendada', 'sessao_venda_realizada', false, 'comercial'),
  -- novo e em_conversa_ia para qualquer desvio
  ('p1', 'novo',           'nao_qualificado',    true, 'comercial'),
  ('p1', 'novo',           'fora_de_cobertura',  true, 'comercial'),
  ('p1', 'novo',           'nutricao',           true, 'comercial'),
  ('p1', 'novo',           'perdido',            true, 'comercial'),
  ('p1', 'em_conversa_ia', 'nao_qualificado',    true, 'comercial'),
  ('p1', 'em_conversa_ia', 'fora_de_cobertura',  true, 'comercial'),
  ('p1', 'em_conversa_ia', 'nutricao',           true, 'comercial'),
  ('p1', 'em_conversa_ia', 'perdido',            true, 'comercial'),
  -- qualificado para nutricao, perdido e fora_de_cobertura (o direto para
  -- P2 proposta_enviada está na máquina p2)
  ('p1', 'qualificado', 'nutricao',          true, 'comercial'),
  ('p1', 'qualificado', 'perdido',           true, 'comercial'),
  ('p1', 'qualificado', 'fora_de_cobertura', true, 'comercial'),
  -- sessao_venda_agendada volta para qualificado (remarcação ou não compareceu)
  ('p1', 'sessao_venda_agendada', 'qualificado', false, 'comercial'),
  -- nutricao reentra em em_conversa_ia, qualificado ou sessao_venda_agendada
  ('p1', 'nutricao', 'em_conversa_ia',        true,  'comercial'),
  ('p1', 'nutricao', 'qualificado',           true,  'comercial'),
  ('p1', 'nutricao', 'sessao_venda_agendada', false, 'comercial'),
  -- reabertura quando a família volta a escrever
  ('p1', 'perdido',           'em_conversa_ia', true, 'comercial'),
  ('p1', 'nao_qualificado',   'em_conversa_ia', true, 'comercial'),
  ('p1', 'fora_de_cobertura', 'em_conversa_ia', true, 'comercial');


-- --- Pipeline 2: venda e pré-atendimento (PRD 7.2) --------------------------
-- Linha principal: proposta_enviada → em_negociacao → ganho →
-- contrato_gerado → aguardando_assinatura → assinado → cobranca_gerada →
-- pagamento_confirmado → nota_fiscal_emitida → consulta_prenatal_agendada →
-- consulta_realizada → enfermeira_designada → aguardando_nascimento →
-- bebe_nasceu → aguardando_alta → atendimento_liberado → [Pipeline 3].
-- Regras especiais:
--   - entrada vinda do P1: sessao_venda_realizada (linha principal) e, direto,
--     qualificado e nutricao (família que quer fechar sem a conversa);
--   - a nota fiscal corre em paralelo: pagamento_confirmado também vai
--     direto para consulta_prenatal_agendada;
--   - bebe_nasceu a partir de pagamento_confirmado e de todo estágio depois
--     dele até aguardando_nascimento;
--   - desvios: perdido antes do ganho, cancelado entre o ganho e a
--     assinatura, distrato depois da assinatura (decisão da diretoria,
--     PRD 8.3), intercorrencia de qualquer estágio ativo;
--   - intercorrencia só volta ao estágio anterior, só com coordenação e com
--     motivo (privado.transicionar confere o anterior na linha do tempo).
-- perdido, cancelado, distrato e atendimento_liberado não têm saída no P2.

insert into privado.transicao_permitida (maquina, de, para, automatica, papel_minimo) values
  -- entrada vinda do P1
  ('p2', 'sessao_venda_realizada', 'proposta_enviada', false, 'comercial'),
  ('p2', 'qualificado',            'proposta_enviada', false, 'comercial'),
  ('p2', 'nutricao',               'proposta_enviada', false, 'comercial'),
  -- linha principal
  ('p2', 'proposta_enviada',           'em_negociacao',              false, 'comercial'),
  ('p2', 'em_negociacao',              'ganho',                      false, 'comercial'),
  ('p2', 'ganho',                      'contrato_gerado',            true,  'comercial'),
  ('p2', 'contrato_gerado',            'aguardando_assinatura',      true,  'comercial'),
  ('p2', 'aguardando_assinatura',      'assinado',                   true,  'comercial'),
  ('p2', 'assinado',                   'cobranca_gerada',            true,  'financeiro'),
  ('p2', 'cobranca_gerada',            'pagamento_confirmado',       true,  'financeiro'),
  ('p2', 'pagamento_confirmado',       'nota_fiscal_emitida',        true,  'financeiro'),
  ('p2', 'nota_fiscal_emitida',        'consulta_prenatal_agendada', false, 'coordenacao'),
  ('p2', 'consulta_prenatal_agendada', 'consulta_realizada',         true,  'coordenacao'),
  ('p2', 'consulta_realizada',         'enfermeira_designada',       true,  'coordenacao'),
  ('p2', 'enfermeira_designada',       'aguardando_nascimento',      true,  'coordenacao'),
  ('p2', 'aguardando_nascimento',      'bebe_nasceu',                true,  'coordenacao'),
  ('p2', 'bebe_nasceu',                'aguardando_alta',            true,  'coordenacao'),
  ('p2', 'aguardando_alta',            'atendimento_liberado',       true,  'coordenacao'),
  -- nota fiscal em paralelo
  ('p2', 'pagamento_confirmado', 'consulta_prenatal_agendada', false, 'coordenacao'),
  -- bebe_nasceu a partir de qualquer estágio depois do pagamento
  ('p2', 'pagamento_confirmado',       'bebe_nasceu', true, 'coordenacao'),
  ('p2', 'nota_fiscal_emitida',        'bebe_nasceu', true, 'coordenacao'),
  ('p2', 'consulta_prenatal_agendada', 'bebe_nasceu', true, 'coordenacao'),
  ('p2', 'consulta_realizada',         'bebe_nasceu', true, 'coordenacao'),
  ('p2', 'enfermeira_designada',       'bebe_nasceu', true, 'coordenacao'),
  -- desvio perdido: venda perdida antes do ganho
  ('p2', 'proposta_enviada', 'perdido', false, 'comercial'),
  ('p2', 'em_negociacao',    'perdido', false, 'comercial'),
  -- desvio cancelado: fechamento desfeito antes da assinatura
  ('p2', 'ganho',                 'cancelado', false, 'comercial'),
  ('p2', 'contrato_gerado',       'cancelado', false, 'comercial'),
  ('p2', 'aguardando_assinatura', 'cancelado', false, 'comercial'),
  -- desvio distrato: contrato assinado desfeito, decisão da diretoria
  ('p2', 'assinado',                   'distrato', false, 'diretoria'),
  ('p2', 'cobranca_gerada',            'distrato', false, 'diretoria'),
  ('p2', 'pagamento_confirmado',       'distrato', false, 'diretoria'),
  ('p2', 'nota_fiscal_emitida',        'distrato', false, 'diretoria'),
  ('p2', 'consulta_prenatal_agendada', 'distrato', false, 'diretoria'),
  ('p2', 'consulta_realizada',         'distrato', false, 'diretoria'),
  ('p2', 'enfermeira_designada',       'distrato', false, 'diretoria'),
  ('p2', 'aguardando_nascimento',      'distrato', false, 'diretoria'),
  ('p2', 'bebe_nasceu',                'distrato', false, 'diretoria'),
  ('p2', 'aguardando_alta',            'distrato', false, 'diretoria');

-- desvio intercorrencia: entra de qualquer estágio ativo (qualquer pessoa com
-- papel, ou o sistema) e sai só para o mesmo estágio, só com coordenação
insert into privado.transicao_permitida (maquina, de, para, automatica, papel_minimo)
select 'p2'::privado.maquina_estado, e.estado, 'intercorrencia', true, null::public.papel_usuario
from unnest(array[
  'proposta_enviada', 'em_negociacao', 'ganho', 'contrato_gerado', 'aguardando_assinatura', 'assinado',
  'cobranca_gerada', 'pagamento_confirmado', 'nota_fiscal_emitida', 'consulta_prenatal_agendada',
  'consulta_realizada', 'enfermeira_designada', 'aguardando_nascimento', 'bebe_nasceu', 'aguardando_alta'
]) as e(estado)
union all
select 'p2'::privado.maquina_estado, 'intercorrencia', e.estado, false, 'coordenacao'::public.papel_usuario
from unnest(array[
  'proposta_enviada', 'em_negociacao', 'ganho', 'contrato_gerado', 'aguardando_assinatura', 'assinado',
  'cobranca_gerada', 'pagamento_confirmado', 'nota_fiscal_emitida', 'consulta_prenatal_agendada',
  'consulta_realizada', 'enfermeira_designada', 'aguardando_nascimento', 'bebe_nasceu', 'aguardando_alta'
]) as e(estado);


-- --- Pipeline 3: acompanhamento (PRD 7.3) -----------------------------------
-- Linha principal: aguardando → ativo → em_execucao →
-- ultima_visita_realizada → pendencias → encerrado → [Pipeline 4].
-- A linha principal anda pelos eventos das visitas e da alta (automática).
-- Desvios (suspenso, interrompido_familia, interrompido_clinico,
-- intercorrencia) a partir de aguardando, ativo e em_execucao. suspenso e
-- intercorrencia são pausas: voltam só para o estado anterior (conferido
-- em privado.transicionar) ou terminam em interrupção. Saída de
-- intercorrencia só com coordenação. encerrado, interrompido_familia e
-- interrompido_clinico não têm saída.

insert into privado.transicao_permitida (maquina, de, para, automatica, papel_minimo) values
  -- linha principal
  ('acompanhamento', 'aguardando',              'ativo',                   true, 'coordenacao'),
  ('acompanhamento', 'ativo',                   'em_execucao',             true, 'coordenacao'),
  ('acompanhamento', 'em_execucao',             'ultima_visita_realizada', true, 'coordenacao'),
  ('acompanhamento', 'ultima_visita_realizada', 'pendencias',              true, 'coordenacao'),
  ('acompanhamento', 'pendencias',              'encerrado',               true, 'coordenacao'),
  -- desvios a partir de aguardando, ativo e em_execucao
  ('acompanhamento', 'aguardando',  'suspenso',             false, 'coordenacao'),
  ('acompanhamento', 'ativo',       'suspenso',             false, 'coordenacao'),
  ('acompanhamento', 'em_execucao', 'suspenso',             false, 'coordenacao'),
  ('acompanhamento', 'aguardando',  'interrompido_familia', false, 'coordenacao'),
  ('acompanhamento', 'ativo',       'interrompido_familia', false, 'coordenacao'),
  ('acompanhamento', 'em_execucao', 'interrompido_familia', false, 'coordenacao'),
  ('acompanhamento', 'aguardando',  'interrompido_clinico', false, 'coordenacao'),
  ('acompanhamento', 'ativo',       'interrompido_clinico', false, 'coordenacao'),
  ('acompanhamento', 'em_execucao', 'interrompido_clinico', false, 'coordenacao'),
  ('acompanhamento', 'aguardando',  'intercorrencia',       true,  null),
  ('acompanhamento', 'ativo',       'intercorrencia',       true,  null),
  ('acompanhamento', 'em_execucao', 'intercorrencia',       true,  null),
  -- suspenso: retomada (só para o estado anterior), interrupção ou intercorrência
  ('acompanhamento', 'suspenso', 'aguardando',           false, 'coordenacao'),
  ('acompanhamento', 'suspenso', 'ativo',                false, 'coordenacao'),
  ('acompanhamento', 'suspenso', 'em_execucao',          false, 'coordenacao'),
  ('acompanhamento', 'suspenso', 'interrompido_familia', false, 'coordenacao'),
  ('acompanhamento', 'suspenso', 'interrompido_clinico', false, 'coordenacao'),
  ('acompanhamento', 'suspenso', 'intercorrencia',       true,  null),
  -- intercorrencia: só coordenação; volta ao estado anterior ou interrompe
  ('acompanhamento', 'intercorrencia', 'aguardando',           false, 'coordenacao'),
  ('acompanhamento', 'intercorrencia', 'ativo',                false, 'coordenacao'),
  ('acompanhamento', 'intercorrencia', 'em_execucao',          false, 'coordenacao'),
  ('acompanhamento', 'intercorrencia', 'suspenso',             false, 'coordenacao'),
  ('acompanhamento', 'intercorrencia', 'interrompido_familia', false, 'coordenacao'),
  ('acompanhamento', 'intercorrencia', 'interrompido_clinico', false, 'coordenacao');


-- --- Estado por visita (PRD 7.3) --------------------------------------------
-- Linha principal: agendada → confirmada → a_caminho → iniciada →
-- concluida → ficha_pendente → ficha_entregue → encerrada.
-- A enfermeira conduz a visita (coordenação também pode); ficha_pendente e
-- ficha_entregue andam pelo registro assistencial (automática); encerrar é
-- da coordenação ou do sistema. Desvios antes de a visita começar:
-- reagendada e cancelada (coordenação), nao_realizada_familia e
-- nao_realizada_profissional (enfermeira). reagendada volta a agendada; uma
-- visita não realizada pode ser reagendada. cancelada e encerrada não têm
-- saída.

insert into privado.transicao_permitida (maquina, de, para, automatica, papel_minimo) values
  -- linha principal
  ('visita', 'agendada',       'confirmada',     false, 'enfermeira'),
  ('visita', 'confirmada',     'a_caminho',      false, 'enfermeira'),
  ('visita', 'a_caminho',      'iniciada',       false, 'enfermeira'),
  ('visita', 'iniciada',       'concluida',      false, 'enfermeira'),
  ('visita', 'concluida',      'ficha_pendente', true,  'enfermeira'),
  ('visita', 'ficha_pendente', 'ficha_entregue', true,  'enfermeira'),
  ('visita', 'ficha_entregue', 'encerrada',      true,  'coordenacao'),
  -- desvios antes de a visita começar
  ('visita', 'agendada',   'reagendada',                 false, 'coordenacao'),
  ('visita', 'confirmada', 'reagendada',                 false, 'coordenacao'),
  ('visita', 'a_caminho',  'reagendada',                 false, 'coordenacao'),
  ('visita', 'agendada',   'cancelada',                  false, 'coordenacao'),
  ('visita', 'confirmada', 'cancelada',                  false, 'coordenacao'),
  ('visita', 'a_caminho',  'cancelada',                  false, 'coordenacao'),
  ('visita', 'agendada',   'nao_realizada_familia',      false, 'enfermeira'),
  ('visita', 'confirmada', 'nao_realizada_familia',      false, 'enfermeira'),
  ('visita', 'a_caminho',  'nao_realizada_familia',      false, 'enfermeira'),
  ('visita', 'agendada',   'nao_realizada_profissional', false, 'enfermeira'),
  ('visita', 'confirmada', 'nao_realizada_profissional', false, 'enfermeira'),
  ('visita', 'a_caminho',  'nao_realizada_profissional', false, 'enfermeira'),
  -- nova data
  ('visita', 'reagendada',                 'agendada',   false, 'coordenacao'),
  ('visita', 'nao_realizada_familia',      'reagendada', false, 'coordenacao'),
  ('visita', 'nao_realizada_profissional', 'reagendada', false, 'coordenacao');


-- --- Pipeline 4: pós-venda (PRD 7.4) ----------------------------------------
-- Linear: protocolo_ultimo_dia_concluido → pesquisa_enviada →
-- pesquisa_respondida → classificado → acao_executada → arquivado.
-- A resposta chega pelo formulário e a classificação é automática
-- (classificacao_nps, PRD 10.1); enviar a pesquisa e executar a ação é de
-- quem recebeu a tarefa (papel nulo: qualquer papel ativo).

insert into privado.transicao_permitida (maquina, de, para, automatica, papel_minimo) values
  ('p4', 'protocolo_ultimo_dia_concluido', 'pesquisa_enviada',    false, null),
  ('p4', 'pesquisa_enviada',               'pesquisa_respondida', true,  'coordenacao'),
  ('p4', 'pesquisa_respondida',            'classificado',        true,  'coordenacao'),
  ('p4', 'classificado',                   'acao_executada',      false, null),
  ('p4', 'acao_executada',                 'arquivado',           true,  'coordenacao');


-- =============================================================================
-- 2. privado.tem_papel(papel) (P06 item 2, PRD 13)
--
-- Verdadeiro se o usuário logado (auth.uid()) tem o papel e o perfil está
-- ativo (perfil desativado perde todos os papéis na hora). security definer:
-- a política de RLS de usuario_papel (P07) vai chamar esta função, e sem
-- security definer a leitura de usuario_papel dispararia a mesma política
-- de novo, em recursão. stable: mesma resposta dentro de uma consulta.
-- =============================================================================

create function privado.tem_papel(papel public.papel_usuario) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
  as $$
  select exists (
    select 1
    from public.usuario_papel up
    join public.perfil p on p.id = up.usuario_id
    where up.usuario_id = auth.uid()
      and up.papel = tem_papel.papel
      and p.ativo
  )
$$;
comment on function privado.tem_papel(public.papel_usuario) is 'Verdadeiro se auth.uid() tem o papel em usuario_papel e o perfil está ativo (PRD 13). security definer para a política de usuario_papel não entrar em recursão. O P07 concede execute a authenticated.';


-- =============================================================================
-- 3. privado.transicionar(maquina, entidade_id, para, motivo) (P06 item 3)
-- =============================================================================

create function privado.transicionar(
  maquina     privado.maquina_estado,
  entidade_id uuid,
  para        text,
  motivo      text default null
) returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
  as $$
declare
  v_uid         uuid := auth.uid();
  v_familia     uuid;
  v_de          text;
  v_p2_atual    text;
  v_regra       privado.transicao_permitida;
  v_pode        boolean;
  v_anterior    text;
  v_motivo      text := nullif(pg_catalog.btrim(transicionar.motivo), '');
  v_tabela      text;
  v_restrito    boolean;
begin
  if transicionar.maquina is null or transicionar.entidade_id is null or transicionar.para is null then
    raise exception 'transicionar: maquina, entidade_id e para são obrigatórios'
      using errcode = '22023';
  end if;

  -- 1. estado atual e família, com a linha travada até o fim da transação
  case transicionar.maquina
    when 'p1', 'p2' then
      v_tabela := 'oportunidade';
      select o.familia_id, o.estagio_p1::text, o.estagio_p2::text
        into v_familia, v_de, v_p2_atual
      from public.oportunidade o
      where o.id = transicionar.entidade_id
      for update;
      if not found then
        raise exception 'transicionar: oportunidade % não existe', transicionar.entidade_id
          using errcode = 'P0002';
      end if;
      if transicionar.maquina = 'p1' and v_p2_atual is not null then
        raise exception 'transicionar: a oportunidade já está no pipeline 2 (estágio %), o pipeline 1 não anda mais', v_p2_atual
          using errcode = '22023';
      end if;
      -- no P2 a origem é o estagio_p2; sem ele, a passagem vem do estagio_p1
      if transicionar.maquina = 'p2' and v_p2_atual is not null then
        v_de := v_p2_atual;
      end if;

    when 'acompanhamento' then
      v_tabela := 'acompanhamento';
      select a.familia_id, a.estado::text
        into v_familia, v_de
      from public.acompanhamento a
      where a.id = transicionar.entidade_id
      for update;
      if not found then
        raise exception 'transicionar: acompanhamento % não existe', transicionar.entidade_id
          using errcode = 'P0002';
      end if;

    when 'visita' then
      v_tabela := 'visita';
      select a.familia_id, v.estado::text
        into v_familia, v_de
      from public.visita v
      join public.acompanhamento a on a.id = v.acompanhamento_id
      where v.id = transicionar.entidade_id
      for update of v;
      if not found then
        raise exception 'transicionar: visita % não existe', transicionar.entidade_id
          using errcode = 'P0002';
      end if;

    when 'p4' then
      v_tabela := 'pos_venda';
      select a.familia_id, pv.estagio::text
        into v_familia, v_de
      from public.pos_venda pv
      join public.acompanhamento a on a.id = pv.acompanhamento_id
      where pv.id = transicionar.entidade_id
      for update of pv;
      if not found then
        raise exception 'transicionar: pos_venda % não existe', transicionar.entidade_id
          using errcode = 'P0002';
      end if;
  end case;

  -- 2. a transição está prevista?
  select t.*
    into v_regra
  from privado.transicao_permitida t
  where t.maquina = transicionar.maquina
    and t.de = v_de
    and t.para = transicionar.para;

  if not found then
    raise exception 'transição não prevista na máquina %: % para % (PRD 7)', transicionar.maquina, coalesce(v_de, 'nulo'), transicionar.para
      using errcode = '22023';
  end if;

  -- 3. quem pede pode?
  if v_uid is null then
    -- chamada de sistema (automação, webhook, agente): só transição automática.
    -- Requisição anônima nunca conta como sistema.
    if coalesce(auth.role(), '') in ('anon', 'authenticated') then
      raise exception 'transicionar: requisição sem usuário identificado'
        using errcode = '42501';
    end if;
    if not v_regra.automatica then
      raise exception 'transicionar: % para % na máquina % exige usuário com papel (não é automática)', v_de, transicionar.para, transicionar.maquina
        using errcode = '42501';
    end if;
  else
    if v_regra.papel_minimo is null then
      v_pode := exists (
        select 1
        from public.usuario_papel up
        join public.perfil p on p.id = up.usuario_id
        where up.usuario_id = v_uid and p.ativo
      );
    else
      v_pode := privado.tem_papel(v_regra.papel_minimo)
             or (v_de <> 'intercorrencia' and privado.tem_papel('diretoria'))
             or (v_regra.papel_minimo = 'enfermeira' and privado.tem_papel('coordenacao'));
    end if;
    if not v_pode then
      raise exception 'transicionar: % para % na máquina % exige o papel %', v_de, transicionar.para, transicionar.maquina, coalesce(v_regra.papel_minimo::text, 'qualquer papel ativo')
        using errcode = '42501';
    end if;
  end if;

  -- 4. pausas (intercorrencia, suspenso) só voltam para o estado anterior,
  --    e a saída de intercorrencia exige motivo (decisão da coordenação,
  --    PRD 7.2 e 8.3).
  --    "Voltar" = sair da pausa para um estado comum de onde se entra nela
  --    (existe a transição inversa). Ir de uma pausa para a outra, ou da
  --    pausa para uma interrupção, não é voltar e não passa por esta conferência.
  --    O estado anterior é o "de" da última vez que a entidade entrou numa
  --    pausa vindo de um estado comum (ativo → suspenso → intercorrencia →
  --    suspenso só volta para ativo), lido da linha do tempo.
  if v_de = 'intercorrencia' and v_motivo is null then
    raise exception 'transicionar: sair de intercorrencia exige motivo (decisão da coordenação)'
      using errcode = '22023';
  end if;

  if v_de in ('intercorrencia', 'suspenso')
     and transicionar.para not in ('intercorrencia', 'suspenso')
     and exists (
       select 1 from privado.transicao_permitida t
       where t.maquina = transicionar.maquina and t.de = transicionar.para and t.para = v_de
     ) then
    select e.dados ->> 'de'
      into v_anterior
    from public.evento_familia e
    where e.familia_id = v_familia
      and e.tipo = 'estagio'
      and e.dados ->> 'maquina' = transicionar.maquina::text
      and e.dados ->> 'entidade_id' = transicionar.entidade_id::text
      and e.dados ->> 'para' in ('intercorrencia', 'suspenso')
      and e.dados ->> 'de' not in ('intercorrencia', 'suspenso')
    order by e.id desc
    limit 1;

    if v_anterior is distinct from transicionar.para then
      raise exception 'transicionar: de % só volta para o estado anterior (%), não para %', v_de, coalesce(v_anterior, 'desconhecido'), transicionar.para
        using errcode = '22023';
    end if;
  end if;

  -- 5. grava o novo estado. app.transicao marca esta transição exata
  --    (máquina, entidade e destino) só durante o update; o gatilho de
  --    proteção confere a marca e que o update vem da função (dono).
  perform pg_catalog.set_config(
    'app.transicao',
    transicionar.maquina::text || ':' || transicionar.entidade_id::text || ':' || transicionar.para,
    true);

  case transicionar.maquina
    when 'p1' then
      update public.oportunidade
         set estagio_p1 = transicionar.para::public.estagio_p1
       where id = transicionar.entidade_id;
    when 'p2' then
      update public.oportunidade
         set estagio_p2 = transicionar.para::public.estagio_p2,
             pipeline = 2
       where id = transicionar.entidade_id;
    when 'acompanhamento' then
      update public.acompanhamento
         set estado = transicionar.para::public.estado_acompanhamento
       where id = transicionar.entidade_id;
    when 'visita' then
      update public.visita
         set estado = transicionar.para::public.estado_visita
       where id = transicionar.entidade_id;
    when 'p4' then
      update public.pos_venda
         set estagio = transicionar.para::public.estagio_p4
       where id = transicionar.entidade_id;
  end case;

  perform pg_catalog.set_config('app.transicao', '', true);

  -- 6. linha do tempo da ficha 360º. Assistencial e intercorrência são
  --    eventos restritos (PRD 13: evento_familia restrito segue o registro
  --    assistencial). O título é código de estado, não texto de interface.
  v_restrito := transicionar.maquina in ('acompanhamento', 'visita')
             or 'intercorrencia' in (v_de, transicionar.para);

  insert into public.evento_familia (familia_id, tipo, titulo, dados, restrito, criado_por)
  values (
    v_familia,
    'estagio',
    v_de || ' → ' || transicionar.para,
    pg_catalog.jsonb_build_object(
      'maquina', transicionar.maquina,
      'entidade_id', transicionar.entidade_id,
      'de', v_de,
      'para', transicionar.para,
      'motivo', v_motivo,
      'sistema', v_uid is null
    ),
    v_restrito,
    v_uid
  );

  -- 7. auditoria da transição (o gatilho privado.auditar também grava o
  --    update da tabela). O motivo é texto livre: vai como "[oculto]" + HMAC.
  insert into public.log_auditoria (usuario_id, acao, entidade, entidade_id, valor_antes, valor_depois, origem, ip)
  values (
    v_uid,
    'transicao',
    v_tabela,
    transicionar.entidade_id::text,
    pg_catalog.jsonb_build_object('maquina', transicionar.maquina, 'estado', v_de),
    privado.auditoria_recortar(
      pg_catalog.jsonb_build_object('maquina', transicionar.maquina, 'estado', transicionar.para, 'motivo', v_motivo),
      array['maquina', 'estado', 'motivo'],
      array['motivo']),
    privado.origem_atual(),
    privado.ip_requisicao()
  );

  return pg_catalog.jsonb_build_object(
    'maquina', transicionar.maquina,
    'entidade_id', transicionar.entidade_id,
    'de', v_de,
    'para', transicionar.para
  );
end;
$$;

-- P06 item 5: a tabela do PRD 7.1 (status do prompt da Isadora e onde vivem
-- no banco) vai no comentário da função.
comment on function privado.transicionar(privado.maquina_estado, uuid, text, text) is
'Única porta de mudança de estágio (PRD 7, invariante 1). Valida a transição em privado.transicao_permitida e o papel de quem pede (sem usuário: só transição automática), faz pausas (intercorrencia, suspenso) voltarem só ao estado anterior, exige motivo na saída de intercorrencia, liga app.transicao só durante o update, grava o novo estado, registra evento_familia (tipo estagio) e log_auditoria (acao transicao). Devolve {maquina, entidade_id, de, para}.

Status do agente e onde vivem no banco (PRD 7.1):
| Status do prompt                          | No sistema                                                         |
| Novo, Em qualificação, Qualificado        | estagio_p1 = novo, em_conversa_ia, qualificado                     |
| Apresentação enviada                      | marco oportunidade.pdf_enviado_em (estágio continua qualificado)   |
| Orientação agendada, Orientação realizada | sessao_venda_agendada, sessao_venda_realizada                      |
| Encaminhado para Leonardo                 | handoff aberto com destino comercial                               |
| Aguardando retorno                        | oportunidade.cadencia_etapa e proximo_contato_em                   |
| Nutrição, Fora da área, Perdido           | nutricao, fora_de_cobertura, perdido com motivo_perda              |
| Fechado                                   | Pipeline 2 a partir de ganho                                       |
| Não contatar                              | familia.nao_contatar = true                                        |
| Não é lead                                | conversa.classificacao diferente de lead e cliente                 |';


-- =============================================================================
-- 4. Gatilho de proteção dos estágios (P06 item 4, PRD 7)
--
-- UPDATE: se a coluna de estágio mudar (em oportunidade, também pipeline),
-- só passa quando app.transicao traz exatamente a marca desta transição
-- (máquina:entidade:destino) E o update roda como dono da tabela, que é o
-- caso de dentro de privado.transicionar (security definer). Um papel da
-- aplicação que forje a variável continua recusado, porque não é o dono; e
-- o próprio dono, sem a marca, também é recusado.
--
-- INSERT: um papel da aplicação só cria a linha no estado inicial
-- (oportunidade em pipeline 1, estagio_p1 novo e sem estagio_p2;
-- acompanhamento aguardando; visita agendada; pos_venda
-- protocolo_ultimo_dia_concluido). O dono (migrations, seed sintético,
-- funções security definer do projeto) pode criar em outro estado.
--
-- security invoker de propósito: precisa enxergar o current_user de quem
-- fez o update (dentro de função security definer, é o dono).
-- =============================================================================

create function privado.proteger_estado() returns trigger
  language plpgsql
  set search_path = ''
  as $$
declare
  v_dono  boolean;
  v_marca text := coalesce(pg_catalog.current_setting('app.transicao', true), '');
begin
  select pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER')
    into v_dono
  from pg_catalog.pg_class c
  where c.oid = tg_relid;

  if tg_op = 'INSERT' then
    if v_dono then
      return new;
    end if;
    -- um "if" por tabela: cada ramo só cita colunas que existem naquela tabela
    if tg_table_name = 'oportunidade' then
      if new.pipeline is distinct from 1 or new.estagio_p1 is distinct from 'novo' or new.estagio_p2 is not null then
        raise exception 'oportunidade: nasce em pipeline 1, estagio_p1 novo e sem estagio_p2; o resto do caminho é por privado.transicionar (PRD 7)'
          using errcode = '42501';
      end if;
    elsif tg_table_name = 'acompanhamento' then
      if new.estado is distinct from 'aguardando' then
        raise exception 'acompanhamento: nasce aguardando; o resto do caminho é por privado.transicionar (PRD 7)'
          using errcode = '42501';
      end if;
    elsif tg_table_name = 'visita' then
      if new.estado is distinct from 'agendada' then
        raise exception 'visita: nasce agendada; o resto do caminho é por privado.transicionar (PRD 7)'
          using errcode = '42501';
      end if;
    elsif tg_table_name = 'pos_venda' then
      if new.estagio is distinct from 'protocolo_ultimo_dia_concluido' then
        raise exception 'pos_venda: nasce em protocolo_ultimo_dia_concluido; o resto do caminho é por privado.transicionar (PRD 7)'
          using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if tg_table_name = 'oportunidade' then
    if new.estagio_p1 is distinct from old.estagio_p1 and new.estagio_p2 is distinct from old.estagio_p2 then
      raise exception 'oportunidade: estagio_p1 e estagio_p2 não mudam juntos (PRD 7)'
        using errcode = '42501';
    elsif new.estagio_p1 is distinct from old.estagio_p1 then
      if not v_dono or v_marca <> 'p1:' || new.id::text || ':' || coalesce(new.estagio_p1::text, '')
         or new.pipeline is distinct from old.pipeline then
        raise exception 'oportunidade.estagio_p1 só muda por privado.transicionar (PRD 7, invariante 1)'
          using errcode = '42501';
      end if;
    elsif new.estagio_p2 is distinct from old.estagio_p2 then
      if not v_dono or v_marca <> 'p2:' || new.id::text || ':' || coalesce(new.estagio_p2::text, '') then
        raise exception 'oportunidade.estagio_p2 só muda por privado.transicionar (PRD 7, invariante 1)'
          using errcode = '42501';
      end if;
    elsif new.pipeline is distinct from old.pipeline then
      raise exception 'oportunidade.pipeline só muda por privado.transicionar, junto com estagio_p2 (PRD 7)'
        using errcode = '42501';
    end if;

  elsif tg_table_name = 'acompanhamento' then
    if new.estado is distinct from old.estado
       and (not v_dono or v_marca <> 'acompanhamento:' || new.id::text || ':' || coalesce(new.estado::text, '')) then
      raise exception 'acompanhamento.estado só muda por privado.transicionar (PRD 7, invariante 1)'
        using errcode = '42501';
    end if;

  elsif tg_table_name = 'visita' then
    if new.estado is distinct from old.estado
       and (not v_dono or v_marca <> 'visita:' || new.id::text || ':' || coalesce(new.estado::text, '')) then
      raise exception 'visita.estado só muda por privado.transicionar (PRD 7, invariante 1)'
        using errcode = '42501';
    end if;

  elsif tg_table_name = 'pos_venda' then
    if new.estagio is distinct from old.estagio
       and (not v_dono or v_marca <> 'p4:' || new.id::text || ':' || coalesce(new.estagio::text, '')) then
      raise exception 'pos_venda.estagio só muda por privado.transicionar (PRD 7, invariante 1)'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
comment on function privado.proteger_estado() is 'Gatilho BEFORE INSERT OR UPDATE de oportunidade, acompanhamento, visita e pos_venda (PRD 7, invariante 1): recusa mudança de estágio fora de privado.transicionar (marca app.transicao desta transição e update como dono) e recusa que papel da aplicação crie a linha fora do estado inicial.';

create trigger proteger_estado
  before insert or update of estagio_p1, estagio_p2, pipeline on public.oportunidade
  for each row execute function privado.proteger_estado();

create trigger proteger_estado
  before insert or update of estado on public.acompanhamento
  for each row execute function privado.proteger_estado();

create trigger proteger_estado
  before insert or update of estado on public.visita
  for each row execute function privado.proteger_estado();

create trigger proteger_estado
  before insert or update of estagio on public.pos_venda
  for each row execute function privado.proteger_estado();


-- =============================================================================
-- 5. Execute explícito revogado (redundante com a 0001, deixado por escrito:
--    nada daqui é chamável por papel da aplicação até o P07)
-- =============================================================================

revoke execute on function privado.rotulo_existe(regtype, text) from public, anon, authenticated, service_role;
revoke execute on function privado.conferir_transicao_permitida() from public, anon, authenticated, service_role;
revoke execute on function privado.tem_papel(public.papel_usuario) from public, anon, authenticated, service_role;
revoke execute on function privado.transicionar(privado.maquina_estado, uuid, text, text) from public, anon, authenticated, service_role;
revoke execute on function privado.proteger_estado() from public, anon, authenticated, service_role;
