-- =============================================================================
-- 0004_operacao_agente.sql
--
-- P04 (PROMPTS.md) · PRD 6.5 a 6.9
--
-- Terceira e última migration do modelo de dados: operação e assistencial
-- (6.5), alertas/ocorrências/pós-venda (6.6), automações/mensagens/
-- auditoria/sincronização (6.7), schema do agente (6.8) e a view
-- familia_elegivel_marketing (6.9, a ocupacao_projetada fica para o P19).
--
-- Ordem das tabelas: a que resolve as referências (profissional antes de
-- tudo que o cita; mensagem_modelo antes de regua_faixa e termo_alerta,
-- que a referenciam por chave).
--
-- Fora de escopo (fica para o P05): a coluna e o gatilho de auditoria
-- genérico (privado.auditar()), e a imutabilidade de log_auditoria (update/
-- delete/truncate revogados e recusados por gatilho, igual ao que esta
-- migration já faz em registro_atendimento e registro_adendo aqui,
-- reaproveitando privado.recusar_update_delete() e privado.recusar_truncate()
-- criadas no P03). Grants e políticas para o papel n8n_agente ficam para o
-- P21; políticas de RLS de qualquer tabela ficam para o P07.
-- =============================================================================


-- =============================================================================
-- 1. PRD 6.5 · Operação e assistencial
-- =============================================================================

create table profissional (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  usuario_id uuid references perfil(id),
  nome text not null,
  funcao text not null,                        -- 'enfermeira_obstetrica', 'enfermeira_neonatal', 'coordenacao'
  conselho text,                               -- 'COREN'
  conselho_uf char(2),
  conselho_numero text,
  telefone_e164 text,
  regioes uuid[] not null default '{}',
  vinculo vinculo_profissional not null default 'a_definir',
  valor_hora_centavos integer,                 -- [v4.1] R$ 100/h hoje, parâmetro por pessoa
  adicional_deslocamento_centavos integer not null default 0,
  ativa boolean not null default true
);
comment on table profissional is 'Enfermeira ou coordenação que atende famílias (PRD 6.5). Status calculado (em_visita, em_atendimento, ...) nunca é coluna aqui: vem de privado.status_profissional (fora do escopo desta migration).';
comment on column profissional.funcao is 'enfermeira_obstetrica, enfermeira_neonatal, coordenacao';
comment on column profissional.conselho is 'COREN';
comment on column profissional.valor_hora_centavos is '[v4.1] R$ 100/h hoje, parâmetro por pessoa';

create index on profissional (usuario_id);
create index on profissional (criado_por);

create trigger tocar_atualizado_em before update on profissional
  for each row execute function privado.tocar_atualizado_em();

alter table profissional enable row level security;


create table documento_profissional (           -- [v4.1] documentos com validade
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  profissional_id uuid not null references profissional(id),
  tipo text not null,                          -- lista pendente com o cliente
  numero text,
  validade date,
  arquivo_path text
);
comment on table documento_profissional is '[v4.1] Documentos com validade da profissional (PRD 6.5, O-02): alimenta a automação documento_vencendo (PRD 10.1) e o estado "folga" de privado.status_profissional.';
comment on column documento_profissional.tipo is 'lista pendente com o cliente';

create index on documento_profissional (profissional_id);
create index on documento_profissional (criado_por);

create trigger tocar_atualizado_em before update on documento_profissional
  for each row execute function privado.tocar_atualizado_em();

alter table documento_profissional enable row level security;


create table bloqueio_agenda (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  profissional_id uuid not null references profissional(id),
  inicio date not null,
  fim date not null,
  motivo text not null
);
comment on table bloqueio_agenda is 'Folga, férias ou impedimento da profissional (PRD 6.5): cobre o dia no cálculo de privado.status_profissional (estado "folga").';

create index on bloqueio_agenda (profissional_id);
create index on bloqueio_agenda (criado_por);

create trigger tocar_atualizado_em before update on bloqueio_agenda
  for each row execute function privado.tocar_atualizado_em();

alter table bloqueio_agenda enable row level security;


create table instrumento (                      -- [v4.1] instrumentos clínicos versionados
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  codigo text not null,                        -- 'DOC1_ENTREVISTA', 'DOC2_CHECKLIST', 'DOC3_ALERTAS', 'DOC4_MAMADA'
  versao text not null,                        -- 'v1-2026-09'
  definicao jsonb not null,                    -- blocos, campos, tipos, opções, obrigatoriedade
  aprovado_por uuid references perfil(id),     -- sempre coordenação
  aprovado_em timestamptz,
  vigente boolean not null default false,
  unique (codigo, versao)
);
comment on table instrumento is '[v4.1] Instrumentos clínicos versionados (PRD 6.5, 9): DOC 1 a DOC 4, aprovados pela coordenação antes de valer.';
comment on column instrumento.codigo is 'DOC1_ENTREVISTA, DOC2_CHECKLIST, DOC3_ALERTAS, DOC4_MAMADA';
comment on column instrumento.versao is 'v1-2026-09';
comment on column instrumento.definicao is 'blocos, campos, tipos, opções, obrigatoriedade';
comment on column instrumento.aprovado_por is 'sempre coordenação';

create index on instrumento (aprovado_por);
create index on instrumento (criado_por);

create trigger tocar_atualizado_em before update on instrumento
  for each row execute function privado.tocar_atualizado_em();

alter table instrumento enable row level security;


create table consulta_prenatal (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid not null references familia(id),
  agendada_para timestamptz,
  realizada_em timestamptz,
  conduzida_por uuid references perfil(id),
  instrumento_versao text not null,
  ficha jsonb not null default '{}',           -- DOC 1, salvo campo a campo
  plano_cuidado text,
  periodo_preferido periodo_visita[],          -- ordem de preferência
  urgente boolean not null default false,      -- contratação acima de 34 semanas
  status status_consulta not null default 'pendente',
  versao integer not null default 1            -- [v4.1] PRD 6.10 regra 13: sincronização offline
);
comment on table consulta_prenatal is 'Consulta pré-natal online, DOC 1 (PRD 6.5, 9.1). Tabela da regra 13 do PRD 6.10: editada no celular sem conexão, versao detecta conflito de sincronização.';
comment on column consulta_prenatal.ficha is 'DOC 1, salvo campo a campo';
comment on column consulta_prenatal.periodo_preferido is 'ordem de preferência';
comment on column consulta_prenatal.urgente is 'contratação acima de 34 semanas';
comment on column consulta_prenatal.versao is '[v4.1] PRD 6.10 regra 13: incrementada por gatilho a cada update, usada pela sincronização (15) para detectar conflito.';

create index on consulta_prenatal (familia_id);
create index on consulta_prenatal (conduzida_por);
create index on consulta_prenatal (criado_por);

create trigger tocar_atualizado_em before update on consulta_prenatal
  for each row execute function privado.tocar_atualizado_em();

alter table consulta_prenatal enable row level security;


create table acompanhamento (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  contrato_id uuid not null references contrato(id),
  familia_id uuid not null references familia(id),
  dias_contratados integer not null,
  horas_por_visita numeric(3,1) not null,      -- copiado da versão do pacote
  periodo periodo_visita,
  inicio_efetivo date,
  encerramento date,
  estado estado_acompanhamento not null default 'aguardando'
);
comment on table acompanhamento is 'Acompanhamento domiciliar de uma família (PRD 6.5, 7.3): pipeline 3.';
comment on column acompanhamento.horas_por_visita is 'copiado da versão do pacote';

create index on acompanhamento (contrato_id);
create index on acompanhamento (familia_id);
create index on acompanhamento (criado_por);

create trigger tocar_atualizado_em before update on acompanhamento
  for each row execute function privado.tocar_atualizado_em();

alter table acompanhamento enable row level security;


create table designacao (                       -- [v4.1] oferta e aceite
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  acompanhamento_id uuid not null references acompanhamento(id),
  profissional_id uuid not null references profissional(id),
  papel papel_designacao not null,
  status status_designacao not null default 'oferecida',
  oferecida_em timestamptz not null default now(),
  respondida_em timestamptz,
  motivo_recusa text
);
comment on table designacao is '[v4.1] Oferta e aceite de atendimento por uma profissional (PRD 6.5, O-01): titular ou backup.';

create index on designacao (acompanhamento_id);
create index on designacao (profissional_id);
create index on designacao (criado_por);

create trigger tocar_atualizado_em before update on designacao
  for each row execute function privado.tocar_atualizado_em();

alter table designacao enable row level security;


create table visita (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  acompanhamento_id uuid not null references acompanhamento(id),
  profissional_id uuid not null references profissional(id),
  dia_numero integer not null,
  data date not null,
  hora_prevista time,
  checkin_em timestamptz,
  checkout_em timestamptz,
  estado estado_visita not null default 'agendada',
  versao integer not null default 1            -- [v4.1] PRD 6.10 regra 13: sincronização offline
);
comment on table visita is 'Visita domiciliar de um acompanhamento (PRD 6.5, 7.3). Tabela da regra 13 do PRD 6.10: editada no celular sem conexão.';
comment on column visita.versao is '[v4.1] PRD 6.10 regra 13: incrementada por gatilho a cada update, usada pela sincronização (15) para detectar conflito.';

create unique index on visita (acompanhamento_id, dia_numero);
create index on visita (profissional_id);
create index on visita (criado_por);

create trigger tocar_atualizado_em before update on visita
  for each row execute function privado.tocar_atualizado_em();

alter table visita enable row level security;


-- APPEND-ONLY. [v4.2] UPDATE, DELETE e TRUNCATE revogados e bloqueados por gatilho
-- (linha: update e delete; before truncate for each statement), aqui e em registro_adendo. Correção vira adendo.
create table registro_atendimento (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references visita(id),
  profissional_id uuid not null references profissional(id),
  instrumento_versao text not null,
  dados jsonb not null,                        -- blocos do DOC 2; bloco RN como lista, um item por bebê
  resumo_descritivo text not null,
  assinado_em timestamptz not null,
  assinatura text not null,                    -- hash(sha256) de dados + resumo + profissional + assinado_em
  sincronizado_de uuid,                        -- id do item da fila offline
  criado_em timestamptz not null default now()
);
comment on table registro_atendimento is 'Registro assistencial (DOC 2) de uma visita, append-only (PRD 6.5, 6.10 regra 4): sem UPDATE nem DELETE, correção vira registro_adendo. Exceção às colunas padrão (PRD 5.2): sem atualizado_em, sem criado_por.';
comment on column registro_atendimento.dados is 'blocos do DOC 2; bloco RN como lista, um item por bebê';
comment on column registro_atendimento.assinatura is 'hash(sha256) de dados + resumo + profissional + assinado_em';
comment on column registro_atendimento.sincronizado_de is 'id do item da fila offline';

create index on registro_atendimento (visita_id);
create index on registro_atendimento (profissional_id);

alter table registro_atendimento enable row level security;

revoke update, delete, truncate on registro_atendimento from anon, authenticated, service_role;

create trigger recusar_update_delete
  before update or delete on registro_atendimento
  for each row execute function privado.recusar_update_delete();

create trigger recusar_truncate
  before truncate on registro_atendimento
  for each statement execute function privado.recusar_truncate();


create table registro_adendo (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references registro_atendimento(id),
  autor_id uuid not null references perfil(id),
  motivo text not null,
  conteudo text not null,
  criado_em timestamptz not null default now()
);
comment on table registro_adendo is 'Correção de um registro_atendimento, append-only (PRD 6.5, 6.10 regra 4): o registro original nunca muda, o adendo é que registra a correção. Exceção às colunas padrão: sem atualizado_em, sem criado_por (usa autor_id).';

create index on registro_adendo (registro_id);
create index on registro_adendo (autor_id);

alter table registro_adendo enable row level security;

revoke update, delete, truncate on registro_adendo from anon, authenticated, service_role;

create trigger recusar_update_delete
  before update or delete on registro_adendo
  for each row execute function privado.recusar_update_delete();

create trigger recusar_truncate
  before truncate on registro_adendo
  for each statement execute function privado.recusar_truncate();


create table anexo_audio (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  visita_id uuid not null references visita(id),
  arquivo_path text not null,
  duracao_seg integer,
  transcricao text,
  retencao_ate date,                           -- política definida na Fase 0 [confirmar]
  status status_audio not null default 'pendente',
  versao integer not null default 1            -- [v4.1] PRD 6.10 regra 13: sincronização offline
);
comment on table anexo_audio is 'Áudio gravado numa visita, com transcrição (PRD 6.5). Tabela da regra 13 do PRD 6.10: editada no celular sem conexão.';
comment on column anexo_audio.retencao_ate is 'política definida na Fase 0 [confirmar] (PRD 22.4 O-03: proposta 90 dias após o envio da evolução)';
comment on column anexo_audio.versao is '[v4.1] PRD 6.10 regra 13: incrementada por gatilho a cada update, usada pela sincronização (15) para detectar conflito.';

create index on anexo_audio (visita_id);
create index on anexo_audio (criado_por);

create trigger tocar_atualizado_em before update on anexo_audio
  for each row execute function privado.tocar_atualizado_em();

alter table anexo_audio enable row level security;


create table relatorio_medico (                 -- evolução de enfermagem
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  acompanhamento_id uuid not null references acompanhamento(id),
  tipo tipo_relatorio not null,
  bebe_id uuid references bebe(id),            -- [v4.1] neonatal é por bebê
  conteudo jsonb not null,                     -- seções calculadas + textos editáveis
  pdf_path text,
  profissional_id uuid not null references profissional(id),
  aprovado_por uuid references perfil(id),
  aprovado_em timestamptz,
  enviado_em timestamptz,
  destinatarios jsonb,
  status status_relatorio not null default 'rascunho'
);
comment on table relatorio_medico is 'Evolução de enfermagem enviada aos médicos (PRD 6.5, 9.5): puerperal ou neonatal.';
comment on column relatorio_medico.bebe_id is '[v4.1] neonatal é por bebê';
comment on column relatorio_medico.conteudo is 'seções calculadas + textos editáveis';

create index on relatorio_medico (acompanhamento_id);
create index on relatorio_medico (bebe_id);
create index on relatorio_medico (profissional_id);
create index on relatorio_medico (aprovado_por);
create index on relatorio_medico (criado_por);

create trigger tocar_atualizado_em before update on relatorio_medico
  for each row execute function privado.tocar_atualizado_em();

alter table relatorio_medico enable row level security;


-- =============================================================================
-- 2. PRD 6.6 · Alertas, ocorrências, pós-venda
-- =============================================================================

create table regra_alerta (                     -- [v4.1] DOC 3 como dado, versionado com o instrumento
  id text not null,                            -- 'PU-01' ... 'AM-06'
  grupo text not null,                         -- puerpera, saude_mental, recem_nascido, amamentacao
  descricao text not null,
  severidade severidade not null,
  conduta text not null,
  campo text,                                  -- caminho no checklist; null = sinal registrado manualmente
  condicao jsonb,                              -- expressão avaliada no aparelho e no servidor
  instrumento_versao text not null,
  ativa boolean not null default true,
  primary key (id, instrumento_versao)
);
comment on table regra_alerta is '[v4.1] DOC 3 como dado, versionado com o instrumento (PRD 6.6, 9.3, Apêndice B). Exceção às colunas padrão (PRD 5.2): id em texto, chave composta com instrumento_versao.';
comment on column regra_alerta.id is 'PU-01 ... AM-06';
comment on column regra_alerta.grupo is 'puerpera, saude_mental, recem_nascido, amamentacao';
comment on column regra_alerta.campo is 'caminho no checklist; null = sinal registrado manualmente';
comment on column regra_alerta.condicao is 'expressão avaliada no aparelho e no servidor';

alter table regra_alerta enable row level security;


create table alerta_clinico (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid not null references familia(id),
  visita_id uuid references visita(id),
  bebe_id uuid references bebe(id),
  regra_id text not null,
  instrumento_versao text not null,
  severidade severidade not null,
  campo text,
  valor_observado text,
  conduta text not null,
  reconhecido_por uuid references perfil(id),
  reconhecido_em timestamptz,
  sinal_identificado text,                     -- registro obrigatório para fechar (9.3)
  acionado_em timestamptz,
  orientacao_medica text,
  conduta_adotada text,
  fechado_em timestamptz,
  fechado_por uuid references perfil(id),
  versao integer not null default 1,           -- [v4.1] PRD 6.10 regra 13: sincronização offline
  foreign key (regra_id, instrumento_versao) references regra_alerta(id, instrumento_versao)
);
comment on table alerta_clinico is 'Alerta clínico disparado por regra_alerta (PRD 6.6, 9.3). Tabela da regra 13 do PRD 6.10: editada no celular sem conexão.';
comment on column alerta_clinico.sinal_identificado is 'registro obrigatório para fechar (9.3)';
comment on column alerta_clinico.versao is '[v4.1] PRD 6.10 regra 13: incrementada por gatilho a cada update, usada pela sincronização (15) para detectar conflito.';

create index on alerta_clinico (familia_id);
create index on alerta_clinico (visita_id);
create index on alerta_clinico (bebe_id);
create index on alerta_clinico (regra_id, instrumento_versao);
create index on alerta_clinico (reconhecido_por);
create index on alerta_clinico (fechado_por);
create index on alerta_clinico (criado_por);

create trigger tocar_atualizado_em before update on alerta_clinico
  for each row execute function privado.tocar_atualizado_em();

alter table alerta_clinico enable row level security;


create table ocorrencia (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid references familia(id),
  profissional_id uuid references profissional(id),
  tipo tipo_ocorrencia not null,
  prioridade prioridade not null,
  privada boolean not null default false,
  titulo text not null,
  descricao text not null,
  responsavel_id uuid references perfil(id),
  sla_vence_em timestamptz,
  status status_ocorrencia not null default 'aberta',
  historico jsonb not null default '[]'
);
comment on table ocorrencia is 'Ocorrência interna (PRD 6.6): intercorrência, contato perdido, reclamação, detrator. privada = só coordenação e diretoria (PRD 13).';

create index on ocorrencia (familia_id);
create index on ocorrencia (profissional_id);
create index on ocorrencia (responsavel_id);
create index on ocorrencia (criado_por);

create trigger tocar_atualizado_em before update on ocorrencia
  for each row execute function privado.tocar_atualizado_em();

alter table ocorrencia enable row level security;


create table pos_venda (                        -- [v4.1] pipeline 4
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  acompanhamento_id uuid not null unique references acompanhamento(id),
  estagio estagio_p4 not null default 'protocolo_ultimo_dia_concluido',
  pesquisa_token_hash text,
  pesquisa_enviada_em timestamptz,
  pesquisa_respondida_em timestamptz,
  respostas jsonb,
  nps integer check (nps between 0 and 10),
  classificacao classificacao_nps,
  depoimento_autorizado boolean,
  autorizacao_imagem boolean,
  acao_executada_em timestamptz
);
comment on table pos_venda is '[v4.1] Pipeline 4, pós-venda (PRD 6.6, 7.4): pesquisa de satisfação e classificação NPS.';

create index on pos_venda (criado_por);
-- índice de acompanhamento_id dispensável: já é UNIQUE (cria índice próprio) e cobre a FK.

create trigger tocar_atualizado_em before update on pos_venda
  for each row execute function privado.tocar_atualizado_em();

alter table pos_venda enable row level security;


-- =============================================================================
-- 3. PRD 6.7 · Automações, mensagens, auditoria e sincronização
--
-- mensagem_modelo entra antes de regua_faixa e termo_alerta, que a
-- referenciam por chave (PROMPTS.md P04 item 1).
-- =============================================================================

create table automacao (
  id text primary key,                         -- 'regua_nutricao', 'followup_d1', 'alerta_34s', ...
  nome text not null,
  categoria categoria_automacao not null,      -- [v4.1] decide o que o freio deixa passar
  executor executor_automacao not null,        -- [v4.1]
  gatilho jsonb not null,
  condicoes jsonb not null default '[]',
  acoes jsonb not null,
  ativa boolean not null default true,
  descricao text
);
comment on table automacao is 'Catálogo de automações do motor (PRD 6.7, 10.1): gatilho, condições e ações editáveis pela Kraamzorg sem deploy. Exceção às colunas padrão (PRD 5.2): id em texto.';
comment on column automacao.id is 'regua_nutricao, followup_d1, alerta_34s, ...';
comment on column automacao.categoria is '[v4.1] decide o que o freio (PRD 8) deixa passar';

alter table automacao enable row level security;


create table automacao_execucao (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  automacao_id text not null references automacao(id),
  familia_id uuid references familia(id),
  agendada_para timestamptz,
  executada_em timestamptz,
  status status_execucao not null default 'agendada',
  motivo_aborto text,
  payload jsonb,
  erro text
);
comment on table automacao_execucao is 'Execução (agendada ou concluída) de uma automação (PRD 6.7, 10). Aborto pelo freio grava status abortada_freio e motivo_aborto com o estado sensível.';

create index on automacao_execucao (automacao_id);
create index on automacao_execucao (familia_id);
create index on automacao_execucao (criado_por);

create trigger tocar_atualizado_em before update on automacao_execucao
  for each row execute function privado.tocar_atualizado_em();

alter table automacao_execucao enable row level security;


create table mensagem_modelo (                  -- [v4.1] textos editáveis, nunca no código
  chave text primary key,                      -- 'regua_28_34', 'lembrete_sessao', 'alerta_saude', ...
  canal canal_contato not null default 'whatsapp',
  destinatario text not null check (destinatario in ('familia','equipe','medico','agente')),
  texto text not null,                         -- com variáveis {nome}, {semanas}, {link}
  variaveis text[] not null default '{}',
  status status_conteudo not null default 'rascunho',
  aprovado_por uuid,
  aprovado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
comment on table mensagem_modelo is '[v4.1] Textos editáveis, nunca escritos no código (PRD 5.2, 6.7). As funções do agente só devolvem texto com status aprovado (PRD 6.8). Exceção às colunas padrão: chave em texto, sem id nem criado_em/criado_por.';
comment on column mensagem_modelo.chave is 'regua_28_34, lembrete_sessao, alerta_saude, ...';
comment on column mensagem_modelo.texto is 'com variáveis {nome}, {semanas}, {link}';

create trigger tocar_atualizado_em before update on mensagem_modelo
  for each row execute function privado.tocar_atualizado_em();

alter table mensagem_modelo enable row level security;


create table regua_faixa (                      -- [v4.1] faixas da régua gestacional
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  ordem integer not null,
  semana_min integer,
  semana_max integer,                          -- semana_min e semana_max nulos = "já nasceu"
  objetivo text not null,
  gatilho_comercial text not null,
  mensagem_chave text not null references mensagem_modelo(chave)
);
comment on table regua_faixa is '[v4.1] Faixas da régua de nutrição gestacional, editável (PRD 6.7, 10.3).';
comment on column regua_faixa.semana_max is 'semana_min e semana_max nulos = "já nasceu"';

create index on regua_faixa (mensagem_chave);
create index on regua_faixa (criado_por);

create trigger tocar_atualizado_em before update on regua_faixa
  for each row execute function privado.tocar_atualizado_em();

alter table regua_faixa enable row level security;


create table termo_alerta (                     -- [v4.1] lista da coordenação clínica
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  termo text not null,                         -- comparado sem acento e em minúsculas
  acao acao_termo_alerta not null default 'handoff_saude',
  mensagem_chave text not null default 'alerta_saude' references mensagem_modelo(chave),  -- 'alerta_internacao' para UTI
  ativo boolean not null default true
);
comment on table termo_alerta is '[v4.1] Lista de termos de alerta da coordenação clínica (PRD 6.7, 11.11): filtro que roda antes de qualquer decisão do agente.';
comment on column termo_alerta.termo is 'comparado sem acento e em minúsculas';
comment on column termo_alerta.mensagem_chave is 'alerta_internacao para UTI';

create index on termo_alerta (mensagem_chave);
create index on termo_alerta (criado_por);

create trigger tocar_atualizado_em before update on termo_alerta
  for each row execute function privado.tocar_atualizado_em();

alter table termo_alerta enable row level security;


create table notificacao (                      -- [v4.1] central interna
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  usuario_id uuid references perfil(id),
  papel papel_usuario,
  prioridade prioridade not null default 'normal',
  titulo text not null,
  corpo text,
  link text,
  canais text[] not null default '{app}',      -- app, push, whatsapp_interno, email
  lida_em timestamptz
);
comment on table notificacao is '[v4.1] Central de notificação interna (PRD 6.7): por usuário específico ou por papel inteiro.';
comment on column notificacao.canais is 'app, push, whatsapp_interno, email';

create index on notificacao (usuario_id);
create index on notificacao (criado_por);

create trigger tocar_atualizado_em before update on notificacao
  for each row execute function privado.tocar_atualizado_em();

alter table notificacao enable row level security;


-- NUNCA editável, NUNCA deletável. [v4.2] TRUNCATE também bloqueado por gatilho.
-- A imutabilidade de verdade (revoke + gatilho) e o gatilho de auditoria genérico
-- ficam para o P05 (PRD 21.2, PROMPTS.md P05); aqui só a tabela e RLS ligada,
-- como toda tabela desta migration.
create table log_auditoria (
  id bigserial primary key,
  usuario_id uuid,
  acao text not null,                          -- inclui 'leitura' de dado sensível
  entidade text not null,
  entidade_id text,                            -- texto: há tabelas com chave em texto (parametro, automacao, regra_alerta)
  valor_antes jsonb,
  valor_depois jsonb,
  origem text,                                 -- 'app', 'agente', 'cron', 'webhook', 'sync'
  ip inet,
  criado_em timestamptz not null default now()
);
comment on table log_auditoria is 'Log de auditoria (PRD 6.7, 21.2). Exceção às colunas padrão (PRD 5.2): id bigserial, sem atualizado_em nem criado_por. Imutabilidade (revoke + gatilho de update/delete/truncate) e o gatilho genérico privado.auditar() chegam no P05.';
comment on column log_auditoria.acao is 'inclui ''leitura'' de dado sensível';
comment on column log_auditoria.entidade_id is 'texto: há tabelas com chave em texto (parametro, automacao, regra_alerta)';
comment on column log_auditoria.origem is 'app, agente, cron, webhook, sync';

create index on log_auditoria (entidade, entidade_id);
create index on log_auditoria (usuario_id);

alter table log_auditoria enable row level security;


create table fila_sincronizacao (
  id uuid primary key,                         -- gerado no aparelho
  usuario_id uuid not null,
  entidade text not null,
  entidade_id uuid,
  campo text,
  payload jsonb not null,
  versao_base integer,
  criado_no_cliente_em timestamptz not null,
  recebido_em timestamptz not null default now(),
  tentativas integer not null default 0,
  status status_sync not null default 'pendente',
  conflito jsonb
);
comment on table fila_sincronizacao is 'Fila de sincronização offline do celular (PRD 6.7, 15). Exceção às colunas padrão (PRD 5.2): id gerado no aparelho, sem criado_por (usa usuario_id), sem atualizado_em.';
comment on column fila_sincronizacao.id is 'gerado no aparelho';

create index on fila_sincronizacao (usuario_id);
create index on fila_sincronizacao (entidade, entidade_id);

alter table fila_sincronizacao enable row level security;


-- =============================================================================
-- 4. PRD 6.8 · Schema do agente
-- =============================================================================

create table agente.base_conhecimento (         -- editado no CRM, só "aprovado" é indexado
  id uuid primary key default gen_random_uuid(),
  tipo tipo_conteudo not null,
  titulo text not null,
  texto text not null check (char_length(texto) <= 1500),   -- um assunto por item, sem fatiar
  fonte text,                                  -- 'Apresentação 2026 p.5', 'FAQ homologada'
  status status_conteudo not null default 'rascunho',
  aprovado_por uuid,
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table agente.base_conhecimento is 'Editado no CRM, só "aprovado" é indexado pelo fluxo 1 de ingestão RAG (PRD 6.8, 19.2). Exceção às colunas padrão (PRD 5.2): schema agente, sem criado_por.';
comment on column agente.base_conhecimento.fonte is 'Apresentação 2026 p.5, FAQ homologada';

create trigger tocar_atualizado_em before update on agente.base_conhecimento
  for each row execute function privado.tocar_atualizado_em();

alter table agente.base_conhecimento enable row level security;


-- As duas tabelas abaixo ficam no schema agente_n8n porque os nós LangChain do n8n (PGVector e
-- Postgres Chat Memory) executam "CREATE TABLE IF NOT EXISTS" a cada inicialização, e o Postgres
-- exige o privilégio CREATE no schema mesmo quando a tabela já existe. O papel n8n_agente recebe
-- CREATE só neste schema, que não aparece no search_path de nenhuma função security definer.
create table agente_n8n.documentos (            -- vector store (nó PGVector do n8n)
  id uuid primary key default gen_random_uuid(),
  text text not null,
  metadata jsonb not null,                     -- tipo, fonte_id, titulo, lote_id, pagina_pdf
  embedding extensions.vector(1536) not null
);
comment on table agente_n8n.documentos is 'Vector store do nó PGVector do n8n (PRD 6.8, 11.10). Exceção às colunas padrão (PRD 5.2): tabela do schema agente_n8n, sem timestamps nem criado_por.';
comment on column agente_n8n.documentos.metadata is 'tipo, fonte_id, titulo, lote_id, pagina_pdf';

create index on agente_n8n.documentos using hnsw (embedding extensions.vector_cosine_ops);

alter table agente_n8n.documentos enable row level security;


create table agente_n8n.chat_memoria (          -- nó Postgres Chat Memory do n8n
  id serial primary key,
  session_id text not null,                    -- [v4.2] conversa.id em texto, nunca o jid
  message jsonb not null,
  criado_em timestamptz not null default now()
);
comment on table agente_n8n.chat_memoria is 'Memória de conversa do nó Postgres Chat Memory do n8n (PRD 6.8, Apêndice A). Direito do titular: privado.eliminar_titular apaga linhas por session_id (PRD 21.3, fora do escopo desta migration).';
comment on column agente_n8n.chat_memoria.session_id is '[v4.2] conversa.id em texto, nunca o jid';

create index on agente_n8n.chat_memoria (session_id, id);

alter table agente_n8n.chat_memoria enable row level security;


create table agente.ingestao_execucao (
  id bigserial primary key,
  lote_id uuid not null,
  documentos integer not null,
  status status_ingestao not null,
  erro text,
  criado_em timestamptz not null default now()
);
comment on table agente.ingestao_execucao is 'Execução do fluxo 1 de ingestão RAG (PRD 6.8, 19.2): troca atômica da base vetorial por lote. Exceção às colunas padrão (PRD 5.2): schema agente, id bigserial, sem criado_por nem atualizado_em.';

create index on agente.ingestao_execucao (lote_id);

alter table agente.ingestao_execucao enable row level security;


-- =============================================================================
-- 5. PRD 6.10 regra 13 · coluna versao com gatilho de incremento
--
-- Tabelas editadas no celular sem conexão (consulta_prenatal, visita,
-- anexo_audio, alerta_clinico) já nasceram acima com "versao integer not
-- null default 1"; este gatilho garante que todo UPDATE a incrementa, para
-- a sincronização (15) detectar conflito comparando versao_base.
-- =============================================================================

create function privado.incrementar_versao() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  new.versao = old.versao + 1;
  return new;
end;
$$;
comment on function privado.incrementar_versao() is 'Gatilho BEFORE UPDATE: incrementa a coluna versao a cada update (PRD 6.10 regra 13), usada pela sincronização offline (15) para detectar conflito.';

create trigger incrementar_versao before update on consulta_prenatal
  for each row execute function privado.incrementar_versao();

create trigger incrementar_versao before update on visita
  for each row execute function privado.incrementar_versao();

create trigger incrementar_versao before update on anexo_audio
  for each row execute function privado.incrementar_versao();

create trigger incrementar_versao before update on alerta_clinico
  for each row execute function privado.incrementar_versao();


-- =============================================================================
-- 6. PRD 6.9 · Views
--
-- Só familia_elegivel_marketing: a ocupacao_projetada fica especificada no
-- P19 (PROMPTS.md P04 item 4).
-- =============================================================================

-- Toda exportação de marketing lê desta view, nunca da tabela.
-- [v4.2] Colunas explícitas, nunca select *: historico_sensivel, estado_sensivel_motivo, nao_contatar_motivo,
-- endereco_atendimento e bairro ficam fora (13).
create view familia_elegivel_marketing with (security_invoker = true) as
  select id, nome_exibicao, cidade_id, regiao_id, dpp, gemelar, primeira_gestacao, origem, codigo_origem, utm,
         indicacao_medico_id, indicacao_familia_id, criado_em
  from familia
  where estado_sensivel = 'normal' and nao_contatar = false and mesclada_em_id is null;
comment on view familia_elegivel_marketing is '[v4.2] Toda exportação de marketing lê desta view, nunca da tabela familia (PRD 6.9, 13). Colunas explícitas: historico_sensivel, estado_sensivel_motivo, nao_contatar_motivo, endereco_atendimento e bairro ficam de fora de propósito.';
