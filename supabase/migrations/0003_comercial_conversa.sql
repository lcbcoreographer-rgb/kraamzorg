-- =============================================================================
-- 0003_comercial_conversa.sql
--
-- P03 (PROMPTS.md) · PRD 6.3 e 6.4
--
-- Segunda metade comercial do modelo de dados: pacotes, oportunidade,
-- venda, contrato, cobrança e nota fiscal (6.3); conversa, mensagem,
-- handoff, tarefa e a linha do tempo append-only da ficha 360º (6.4).
--
-- Fora de escopo: políticas de RLS (só "enable row level security"), dados,
-- gatilho de auditoria genérico (P05), máquina de estado (P06).
-- =============================================================================


-- =============================================================================
-- 1. PRD 6.3 · Comercial
-- =============================================================================

create table pacote (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  nome text not null,                          -- 'Essencial', 'Imersão', 'Continuado', 'Gemelar Essencial', 'Gemelar Continuado'
  linha text,                                  -- 'Acompanhamento diário'
  dias integer not null,
  gemelar boolean not null default false,
  pagina_pdf integer,                          -- 11 ou 12
  ordem integer not null default 0,
  ativo boolean not null default true
);
comment on table pacote is 'Pacote comercial de acompanhamento (PRD 6.3). Preço e vigência ficam em pacote_versao, nunca aqui: nenhum valor fixo no código (PRD 5.2).';
comment on column pacote.nome is 'Essencial, Imersão, Continuado, Gemelar Essencial, Gemelar Continuado';
comment on column pacote.linha is 'Acompanhamento diário';
comment on column pacote.pagina_pdf is '11 ou 12';

create index on pacote (criado_por);

create trigger tocar_atualizado_em before update on pacote
  for each row execute function privado.tocar_atualizado_em();

alter table pacote enable row level security;


create table pacote_versao (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  pacote_id uuid not null references pacote(id),
  valor_centavos integer not null,
  horas_por_visita numeric(3,1) not null,      -- [v4.1] 3, 4 ou 6
  parcelas_max_sem_juros integer not null default 3,
  destaque text,                               -- 'mais escolhido', 'recomendado'
  vigencia_inicio date not null,
  vigencia_fim date,
  inclui text[],
  nao_inclui text[]
);
comment on table pacote_versao is 'Versão vigente de um pacote (PRD 6.3): preço e condições mudam sem editar código, só abrindo nova versão.';
comment on column pacote_versao.horas_por_visita is '[v4.1] 3, 4 ou 6';
comment on column pacote_versao.destaque is 'mais escolhido, recomendado';

-- regra: no máximo uma versão vigente por pacote em qualquer data
alter table pacote_versao add constraint pacote_versao_sem_sobreposicao
  exclude using gist (pacote_id with =, daterange(vigencia_inicio, vigencia_fim, '[]') with &&);
comment on constraint pacote_versao_sem_sobreposicao on pacote_versao is 'PRD 6.3: no máximo uma versão vigente por pacote em qualquer data. Exclusão por gist (btree_gist), não check: duas vigências não podem se sobrepor, nem parcialmente.';

create index on pacote_versao (pacote_id);
create index on pacote_versao (criado_por);

create trigger tocar_atualizado_em before update on pacote_versao
  for each row execute function privado.tocar_atualizado_em();

alter table pacote_versao enable row level security;


create table condicao_comercial (               -- [v4.1] "tabela única de condições"
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  nome text not null,                          -- 'Pix à vista'
  tipo text not null check (tipo in ('desconto_pct','parcelamento','bonificacao')),
  valor numeric(6,2) not null,                 -- 5.00 (%) ou 3 (parcelas)
  requer_aprovacao boolean not null default true,
  ativa boolean not null default true,
  observacao text
);
comment on table condicao_comercial is '[v4.1] "Tabela única de condições" (PRD 6.3): todo desconto, parcelamento ou bonificação cadastrado aqui, nunca escrito solto no código ou em conversa.';
comment on column condicao_comercial.nome is 'Pix à vista';
comment on column condicao_comercial.valor is '5.00 (%) ou 3 (parcelas)';

create index on condicao_comercial (criado_por);

create trigger tocar_atualizado_em before update on condicao_comercial
  for each row execute function privado.tocar_atualizado_em();

alter table condicao_comercial enable row level security;


create table oportunidade (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid not null references familia(id),
  pipeline integer not null check (pipeline in (1,2)),
  estagio_p1 estagio_p1,
  estagio_p2 estagio_p2,
  score integer,
  classificacao classificacao_lead,
  motivo_perda motivo_perda,
  motivo_perda_detalhe text,
  responsavel_id uuid references perfil(id),
  plano_interesse_pacote_id uuid references pacote(id),   -- [v4.1]
  pagamento_preferido text,                               -- 'cartao_3x', 'pix'
  para_quem text check (para_quem in ('propria','presente','outro')),
  pagador_pessoa_id uuid references pessoa(id),           -- [v4.1] presente: quem paga não é a gestante
  qualificacao jsonb not null default '{}',               -- rede_apoio, principal_preocupacao, parceiro_participa, disponibilidade_sessao
  pdf_enviado_em timestamptz,                             -- [v4.1] regra "valor sempre com PDF"
  sessao_interesse_em timestamptz,
  proximo_contato_em date,                                -- retorno combinado ("me chama com 30 semanas")
  cadencia_etapa integer not null default 0,              -- 0 nada, 1 primeiro retorno da Isadora (agente_followup_horas, [v4.2]), 2 D+3, 3 D+14
  condicao_id uuid references condicao_comercial(id),
  desconto_pct numeric(5,2) not null default 0,
  desconto_motivo text,
  desconto_aprovado_por uuid references perfil(id)
);
comment on table oportunidade is 'Pipeline 1 (entrada e qualificação) ou 2 (venda e pré-atendimento) de uma família (PRD 6.3, 7.1, 7.2). No máximo uma aberta por família (PRD 6.10 regra 14).';
comment on column oportunidade.plano_interesse_pacote_id is '[v4.1]';
comment on column oportunidade.pagamento_preferido is 'cartao_3x, pix';
comment on column oportunidade.pagador_pessoa_id is '[v4.1] presente: quem paga não é a gestante';
comment on column oportunidade.qualificacao is 'rede_apoio, principal_preocupacao, parceiro_participa, disponibilidade_sessao';
comment on column oportunidade.pdf_enviado_em is '[v4.1] regra "valor sempre com PDF"';
comment on column oportunidade.proximo_contato_em is 'retorno combinado ("me chama com 30 semanas")';
comment on column oportunidade.cadencia_etapa is '0 nada, 1 primeiro retorno da Isadora (agente_followup_horas, [v4.2]), 2 D+3, 3 D+14';

-- uma oportunidade aberta por família; "aberta" = fora de perdido, cancelado e distrato
create unique index on oportunidade (familia_id)
  where estagio_p2 is null or estagio_p2 not in ('perdido','cancelado','distrato');
create index on oportunidade (responsavel_id);
create index on oportunidade (plano_interesse_pacote_id);
create index on oportunidade (pagador_pessoa_id);
create index on oportunidade (condicao_id);
create index on oportunidade (desconto_aprovado_por);
create index on oportunidade (criado_por);

create trigger tocar_atualizado_em before update on oportunidade
  for each row execute function privado.tocar_atualizado_em();

alter table oportunidade enable row level security;


create table sessao_venda (                     -- conversa de orientação com a Edilaine
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid not null references familia(id),
  agendada_para timestamptz,
  opcoes_informadas text,                      -- as duas opções de dia e horário que a família passou
  realizada_em timestamptz,
  conduzida_por uuid references perfil(id),
  link_reuniao text,
  parceiro_presente boolean,
  status status_sessao not null default 'agendada'
);
comment on table sessao_venda is 'Conversa de orientação com a Edilaine (PRD 6.3): agenda e desfecho. A gravação e a transcrição ficam em sessao_venda_gravacao, tabela separada, com RLS mais restrita.';
comment on column sessao_venda.opcoes_informadas is 'as duas opções de dia e horário que a família passou';

create index on sessao_venda (familia_id);
create index on sessao_venda (conduzida_por);
create index on sessao_venda (criado_por);

create trigger tocar_atualizado_em before update on sessao_venda
  for each row execute function privado.tocar_atualizado_em();

alter table sessao_venda enable row level security;


create table sessao_venda_gravacao (            -- [v4.1] separada da agenda: RLS "quem conduziu e diretoria" (13)
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  sessao_id uuid not null unique references sessao_venda(id) on delete cascade,
  consentimento_gravacao boolean not null default false,
  consentimento_versao text,
  consentimento_em timestamptz,
  gravacao_path text,
  transcricao text,
  resumo jsonb                                 -- resumo estruturado gerado por IA
);
comment on table sessao_venda_gravacao is '[v4.1] Gravação e transcrição da sessão de venda, separada de sessao_venda de propósito (PRD 6.3): RLS restrita a quem conduziu e à diretoria (PRD 13), sem select direto (PRD 6.10 regra 6).';
comment on column sessao_venda_gravacao.resumo is 'resumo estruturado gerado por IA';

create index on sessao_venda_gravacao (criado_por);
-- índice de sessao_id dispensável: já é UNIQUE (cria índice próprio) e cobre a FK.

create trigger tocar_atualizado_em before update on sessao_venda_gravacao
  for each row execute function privado.tocar_atualizado_em();

alter table sessao_venda_gravacao enable row level security;


create table contrato (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid not null references familia(id),
  pacote_versao_id uuid not null references pacote_versao(id),
  contratante_pessoa_id uuid references pessoa(id),   -- gestante, quem recebe o cuidado
  pagador_pessoa_id uuid references pessoa(id),
  testemunha_pessoa_id uuid references pessoa(id),    -- parceiro como testemunha, prática atual
  valor_centavos integer not null,
  taxa_deslocamento_centavos integer not null default 0,
  desconto_centavos integer not null default 0,
  parcelas integer not null default 1,
  template_versao text not null,
  formulario_token_hash text,                  -- link de uso único do formulário seguro
  formulario_expira_em timestamptz,
  autentique_doc_id text,
  pdf_path text,
  enviado_em timestamptz,
  assinado_em timestamptz,
  status status_contrato not null default 'rascunho'
);
comment on table contrato is 'Contrato gerado a partir de uma oportunidade ganha (PRD 6.3, 7.2). Valor em centavos (PRD 6.10 regra 5).';
comment on column contrato.contratante_pessoa_id is 'gestante, quem recebe o cuidado';
comment on column contrato.testemunha_pessoa_id is 'parceiro como testemunha, prática atual';
comment on column contrato.formulario_token_hash is 'link de uso único do formulário seguro';

create index on contrato (familia_id);
create index on contrato (pacote_versao_id);
create index on contrato (contratante_pessoa_id);
create index on contrato (pagador_pessoa_id);
create index on contrato (testemunha_pessoa_id);
create index on contrato (criado_por);

create trigger tocar_atualizado_em before update on contrato
  for each row execute function privado.tocar_atualizado_em();

alter table contrato enable row level security;


create table cobranca (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  contrato_id uuid not null references contrato(id),
  parcela integer not null default 1,
  valor_centavos integer not null,
  vencimento date not null,
  external_id text unique not null,            -- order_nsu enviado à InfinitePay = id da cobrança
  provider text not null default 'infinitepay',
  link_pagamento text,
  invoice_slug text,
  transaction_nsu text,
  capture_method text,                         -- 'pix' | 'credit_card'
  parcelas_cartao integer,
  valor_pago_centavos integer,
  comprovante_url text,
  pago_em timestamptz,
  status status_cobranca not null default 'aberta'
);
comment on table cobranca is 'Parcela de cobrança de um contrato (PRD 6.3), integrada com a InfinitePay.';
comment on column cobranca.external_id is 'order_nsu enviado à InfinitePay = id da cobrança';
comment on column cobranca.capture_method is 'pix | credit_card';

create index on cobranca (contrato_id);
create index on cobranca (criado_por);

create trigger tocar_atualizado_em before update on cobranca
  for each row execute function privado.tocar_atualizado_em();

alter table cobranca enable row level security;


create table nota_fiscal (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  cobranca_id uuid not null references cobranca(id),
  provider text not null,
  provider_ref text,
  numero text,
  status status_nota not null default 'pendente',
  pdf_path text,
  xml_path text,
  emitida_em timestamptz,
  erro text
);
comment on table nota_fiscal is 'Nota fiscal de serviço emitida a partir de uma cobrança paga (PRD 6.3).';

create index on nota_fiscal (cobranca_id);
create index on nota_fiscal (criado_por);

create trigger tocar_atualizado_em before update on nota_fiscal
  for each row execute function privado.tocar_atualizado_em();

alter table nota_fiscal enable row level security;


-- =============================================================================
-- 2. PRD 6.4 · Conversa, atendimento humano e tarefas
-- =============================================================================

create table conversa (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  canal canal_contato not null default 'whatsapp',
  wa_jid text unique,                          -- chatid da UAZAPI (@s.whatsapp.net ou @lid); a conversa é resolvida por wa_lid, telefone e jid, nessa ordem
  wa_lid text,
  telefone_e164 text,
  familia_id uuid references familia(id),
  pessoa_id uuid references pessoa(id),
  classificacao classificacao_contato not null default 'nao_classificado',
  nome_whatsapp text,                          -- pushName
  nome_contato_salvo text,                     -- "Fulana paciente potencial" / "paciente fechada"
  iniciada_por enviado_por,                    -- quem mandou a primeira mensagem
  primeira_msg_em timestamptz,
  ultima_entrada_em timestamptz,
  ultima_saida_em timestamptz,
  agente_pausado_ate timestamptz,
  agente_pausa_motivo text,
  agente_encerrado_em timestamptz,             -- [v4.2] modo humano_comercial (11.7, D2): lead qualificado passou ao comercial e a Isadora não volta sozinha
  agente_encerrado_motivo text                 -- [v4.2] motivo da transferência que encerrou (reuniao, contratar, condicao_comercial) ou 'qualificado'; limpo só pelo botão "Devolver à Isadora"
);
comment on table conversa is 'Conversa (hoje sempre WhatsApp) com ou sem família ligada (PRD 6.10 regra 9): fornecedor e candidata são conversa sem família, normal.';
comment on column conversa.wa_jid is 'chatid da UAZAPI (@s.whatsapp.net ou @lid); a conversa é resolvida por wa_lid, telefone e jid, nessa ordem';
comment on column conversa.nome_whatsapp is 'pushName';
comment on column conversa.nome_contato_salvo is '"Fulana paciente potencial" / "paciente fechada"';
comment on column conversa.iniciada_por is 'quem mandou a primeira mensagem';
comment on column conversa.agente_encerrado_em is '[v4.2] modo humano_comercial (11.7, D2): lead qualificado passou ao comercial e a Isadora não volta sozinha';
comment on column conversa.agente_encerrado_motivo is '[v4.2] motivo da transferência que encerrou (reuniao, contratar, condicao_comercial) ou ''qualificado''; limpo só pelo botão "Devolver à Isadora"';

create index on conversa (familia_id);
create index on conversa (pessoa_id);
create index on conversa (telefone_e164);
create index on conversa (wa_lid);
create index on conversa (criado_por);

create trigger tocar_atualizado_em before update on conversa
  for each row execute function privado.tocar_atualizado_em();

alter table conversa enable row level security;


create table mensagem (
  -- padrão, sem atualizado_em
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  conversa_id uuid not null references conversa(id),
  direcao direcao_mensagem not null,
  enviado_por enviado_por not null,
  tipo text not null default 'texto',          -- texto, audio, imagem, documento, figurinha, sistema
  conteudo text,                               -- CPF e cartão mascarados antes de gravar
  midia_path text,                             -- cópia no storage privado, nunca o link público da UAZAPI
  transcricao text,                            -- [v4.2] única coluna com UPDATE, por agente.registrar_transcricao (5.2)
  wa_message_id text unique,
  enviada_em timestamptz not null default now()
);
comment on table mensagem is 'Mensagem de uma conversa (PRD 6.4). Exceção às colunas padrão (PRD 5.2): sem atualizado_em. UPDATE só na coluna transcricao (por agente.registrar_transcricao); DELETE só por privado.eliminar_titular e pela automação retencao_diaria (fora do escopo desta migration).';
comment on column mensagem.tipo is 'texto, audio, imagem, documento, figurinha, sistema';
comment on column mensagem.conteudo is 'CPF e cartão mascarados antes de gravar';
comment on column mensagem.midia_path is 'cópia no storage privado, nunca o link público da UAZAPI';
comment on column mensagem.transcricao is '[v4.2] única coluna com UPDATE, por agente.registrar_transcricao (PRD 5.2)';

create index on mensagem (conversa_id, enviada_em);
create index on mensagem (criado_por);

alter table mensagem enable row level security;

-- --- mensagem: UPDATE só na coluna transcricao (PRD 5.2 [v4.2], Apêndice A)
--
-- mensagem não é append-only, mas quase: o único UPDATE previsto é a
-- transcrição do áudio, gravada por agente.registrar_transcricao (P21), e o
-- único DELETE é o de privado.eliminar_titular (P16) e o da automação
-- retencao_diaria (P20). Todos esses caminhos são funções security definer
-- do dono (postgres), então os papéis da aplicação não precisam de UPDATE,
-- DELETE nem TRUNCATE direto: ficam revogados aqui (SELECT e INSERT seguem
-- com a RLS, P07). O gatilho abaixo é a segunda barreira, que vale também
-- para o dono: um UPDATE que mude qualquer coluna além de transcricao é
-- recusado. DELETE não é bloqueado por gatilho, porque os dois caminhos de
-- eliminação acima precisam dele.
-- -----------------------------------------------------------------------------

revoke update, delete, truncate on mensagem from anon, authenticated, service_role;

create function privado.mensagem_so_transcricao() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  if (pg_catalog.to_jsonb(new) operator(pg_catalog.-) 'transcricao'::text)
     is distinct from (pg_catalog.to_jsonb(old) operator(pg_catalog.-) 'transcricao'::text) then
    raise exception 'mensagem: só a coluna transcricao pode mudar depois de gravada (PRD 5.2)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function privado.mensagem_so_transcricao() is 'Gatilho BEFORE UPDATE de mensagem: recusa, para qualquer papel, inclusive o dono, um UPDATE que mude alguma coluna além de transcricao (PRD 5.2 [v4.2], Apêndice A: agente.registrar_transcricao é o único UPDATE permitido).';

create trigger mensagem_so_transcricao
  before update on mensagem
  for each row execute function privado.mensagem_so_transcricao();


create table handoff (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  conversa_id uuid references conversa(id),
  familia_id uuid references familia(id),
  motivo handoff_motivo not null,
  destino handoff_destino not null,
  prioridade prioridade not null,
  resumo text not null,                        -- resumo interno, nunca vai à família
  solicitacao text,
  dados jsonb not null default '{}',           -- ficha interna: semanas, DPP, cidade, plano, pagamento preferido
  sla_vence_em timestamptz,
  notificado_em timestamptz,
  notificacao_ok boolean,
  assumido_por uuid references perfil(id),
  assumido_em timestamptz,
  resolvido_em timestamptz,
  status status_handoff not null default 'aberto'
);
comment on table handoff is 'Transferência de conversa para atendimento humano (PRD 6.4, 11.4).';
comment on column handoff.resumo is 'resumo interno, nunca vai à família';
comment on column handoff.dados is 'ficha interna: semanas, DPP, cidade, plano, pagamento preferido';

create index on handoff (conversa_id);
create index on handoff (familia_id);
create index on handoff (assumido_por);
create index on handoff (criado_por);

create trigger tocar_atualizado_em before update on handoff
  for each row execute function privado.tocar_atualizado_em();

alter table handoff enable row level security;


create table tarefa (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  tipo tipo_tarefa not null,
  familia_id uuid references familia(id),
  responsavel_id uuid references perfil(id),
  papel_responsavel papel_usuario,             -- quando ainda não há pessoa definida
  prioridade prioridade not null default 'normal',
  titulo text not null,
  payload jsonb not null default '{}',         -- texto sugerido, link wa.me, contexto
  vence_em timestamptz,
  origem_automacao_id text,
  concluida_em timestamptz,
  concluida_por uuid references perfil(id),
  status status_tarefa not null default 'aberta'
);
comment on table tarefa is 'Fila de trabalho humano (PRD 6.4): réguas, cadência de follow-up, ações do freio e das automações humano_tarefa (PRD 10).';
comment on column tarefa.papel_responsavel is 'quando ainda não há pessoa definida';
comment on column tarefa.payload is 'texto sugerido, link wa.me, contexto';

create index on tarefa (familia_id);
create index on tarefa (responsavel_id);
create index on tarefa (concluida_por);
create index on tarefa (criado_por);

create trigger tocar_atualizado_em before update on tarefa
  for each row execute function privado.tocar_atualizado_em();

alter table tarefa enable row level security;


create table evento_familia (                   -- linha do tempo da ficha 360º, append-only; [v4.2] UPDATE, DELETE e TRUNCATE bloqueados por gatilho, salvo a exceção de privado.eliminar_titular (21.3)
  id bigserial primary key,
  familia_id uuid not null references familia(id),
  tipo text not null,                          -- 'lead_entrou', 'estagio', 'pdf_enviado', 'sessao', 'contrato', ...
  titulo text not null,
  dados jsonb not null default '{}',
  restrito boolean not null default false,     -- evento assistencial ou sensível
  criado_em timestamptz not null default now(),
  criado_por uuid
);
comment on table evento_familia is 'Linha do tempo append-only da ficha 360º (PRD 6.4, 6.10 regra 4). Exceção às colunas padrão (PRD 5.2): id bigserial, sem atualizado_em. UPDATE, DELETE e TRUNCATE bloqueados por privilégio e por gatilho, salvo a exceção de privado.eliminar_titular (PRD 21.3, fora do escopo desta migration).';
comment on column evento_familia.tipo is 'lead_entrou, estagio, pdf_enviado, sessao, contrato, ...';
comment on column evento_familia.restrito is 'evento assistencial ou sensível';

create index on evento_familia (familia_id);

alter table evento_familia enable row level security;

-- --- Append-only: UPDATE, DELETE e TRUNCATE revogados e recusados por
--     gatilho (PRD 6.10 regra 4, PROMPTS.md P03 item 2) ----------------------
--
-- Privilégio revogado de quem normalmente teria (anon, authenticated,
-- service_role recebem "all" em toda tabela nova de public por default
-- privilege, seção 3 de camada-supabase.sql). SELECT e INSERT continuam
-- liberados aqui; RLS (P07) decide quem lê e quem insere de fato.
--
-- O gatilho é a segunda barreira, e a que vale de verdade contra
-- "postgres"/superusuário: privilégio de tabela não freia o dono nem
-- superusuário, mas um gatilho BEFORE dispara para qualquer papel que
-- execute o UPDATE/DELETE/TRUNCATE, inclusive o dono. É por isso que o
-- aceite do P03 testa também como o papel "postgres".
-- -----------------------------------------------------------------------------

revoke update, delete, truncate on evento_familia from anon, authenticated, service_role;

create function privado.recusar_update_delete() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  raise exception 'tabela % é append-only: % direto não é permitido (PRD 6.10 regra 4)', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;
comment on function privado.recusar_update_delete() is 'Gatilho BEFORE UPDATE OR DELETE genérico para tabela append-only (PRD 6.10 regra 4): sempre recusa, para qualquer papel, inclusive postgres/dono. Reaproveitado por registro_atendimento, registro_adendo e log_auditoria a partir do P05.';

create trigger recusar_update_delete
  before update or delete on evento_familia
  for each row execute function privado.recusar_update_delete();

create function privado.recusar_truncate() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  raise exception 'tabela % é append-only: TRUNCATE não é permitido (PRD 6.10 regra 4)', tg_table_name
    using errcode = '42501';
end;
$$;
comment on function privado.recusar_truncate() is 'Gatilho BEFORE TRUNCATE FOR EACH STATEMENT genérico para tabela append-only (PRD 6.10 regra 4): sempre recusa, inclusive "truncate familia cascade" (o cascade tenta truncar evento_familia também, o gatilho recusa e desfaz a operação inteira). Reaproveitado por registro_atendimento, registro_adendo e log_auditoria a partir do P05.';

create trigger recusar_truncate
  before truncate on evento_familia
  for each statement execute function privado.recusar_truncate();
