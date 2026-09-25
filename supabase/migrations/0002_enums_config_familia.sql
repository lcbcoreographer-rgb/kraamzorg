-- =============================================================================
-- 0002_enums_config_familia.sql
--
-- P02 (PROMPTS.md) · PRD 5.2, 6.0 a 6.2 e 6.10
--
-- Primeira metade do modelo de dados: todos os enums do capítulo 6.0, a
-- configuração e geografia do 6.1 (perfil e usuario_papel primeiro, porque
-- as colunas padrão de toda tabela seguinte referenciam perfil) e família e
-- pessoas do 6.2.
--
-- Fora de escopo desta migration (PROMPTS.md P02): políticas de RLS (só
-- "enable row level security", sem "create policy" -- fica tudo negado até
-- o P07) e dados. `log_auditoria` e o gatilho de auditoria genérico
-- (`privado.auditar()`) chegam no P05; `privado.transicionar()` no P06.
--
-- Onde o comentário "-- padrão" aparece no PRD, entram as quatro colunas
-- padrão (PRD 6.0, intro do capítulo): id, criado_em, atualizado_em e
-- criado_por, exatamente como o P02 define:
--   id uuid primary key default gen_random_uuid()
--   criado_em timestamptz not null default now()
--   atualizado_em timestamptz not null default now()
--   criado_por uuid references perfil(id)
-- Exceções (PRD 5.2): parametro, perfil, usuario_papel e municipio, cada
-- uma com sua própria chave/colunas, sem esse padrão.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Enums (PRD 6.0)
--
-- Todo estado do sistema é um destes tipos: nunca texto livre (PRD 5.2,
-- "Todo estado é enum no banco"). Alguns enums só são usados por tabelas das
-- migrations seguintes (0003 e 0004); todos entram juntos aqui porque o
-- tipo precisa existir antes de qualquer coluna que o use, e o PRD pede
-- "todos os enums do 6.0 numa migration só" (PROMPTS.md P02).
-- -----------------------------------------------------------------------------

create type papel_usuario        as enum ('comercial','enfermeira','financeiro','marketing','coordenacao','diretoria');
create type estado_sensivel      as enum ('normal','atencao','bloqueio_total','encerrado_sensivel');
create type papel_pessoa         as enum ('mae','parceiro','acompanhante','responsavel','presenteador');
create type especialidade_medico as enum ('obstetra','pediatra','outro');
create type origem_lead          as enum ('instagram_organico','meta_ads','google','site','indicacao_medica',
                                          'indicacao_cliente','indicacao_amigo','presente','evento','outro','desconhecida');
create type classificacao_lead   as enum ('quente','morno','frio');
create type motivo_perda         as enum ('fora_de_cobertura','preco','sem_disponibilidade','achou_que_nao_precisaria',
                                          'optou_outro_servico','parceiro_nao_aprovou','sem_resposta','familia_assumiu',
                                          'perda_gestacional','nao_contatar','sem_interesse','outro');
create type estagio_p1 as enum ('novo','em_conversa_ia','qualificado','sessao_venda_agendada','sessao_venda_realizada',
                                'nutricao','nao_qualificado','fora_de_cobertura','perdido');
create type estagio_p2 as enum ('proposta_enviada','em_negociacao','ganho','contrato_gerado','aguardando_assinatura',
                                'assinado','cobranca_gerada','pagamento_confirmado','nota_fiscal_emitida',
                                'consulta_prenatal_agendada','consulta_realizada','enfermeira_designada',
                                'aguardando_nascimento','bebe_nasceu','aguardando_alta','atendimento_liberado',
                                'perdido','cancelado','distrato','intercorrencia');
create type estado_acompanhamento as enum ('aguardando','ativo','em_execucao','ultima_visita_realizada','pendencias',
                                           'encerrado','suspenso','interrompido_familia','interrompido_clinico','intercorrencia');
create type estado_visita as enum ('agendada','confirmada','a_caminho','iniciada','concluida','ficha_pendente',
                                   'ficha_entregue','encerrada','reagendada','cancelada','nao_realizada_familia',
                                   'nao_realizada_profissional');
create type estagio_p4 as enum ('protocolo_ultimo_dia_concluido','pesquisa_enviada','pesquisa_respondida',
                                'classificado','acao_executada','arquivado');
create type classificacao_nps    as enum ('promotor','neutro','detrator');
create type status_sessao        as enum ('agendada','realizada','nao_compareceu','remarcada','cancelada');
create type status_contrato      as enum ('rascunho','aguardando_dados','gerado','enviado','assinado','cancelado','distrato');
create type status_cobranca      as enum ('aberta','paga','vencida','cancelada','estornada');
create type status_nota          as enum ('pendente','processando','emitida','erro','cancelada');
create type status_consulta      as enum ('pendente','agendada','realizada','nao_realizada','cancelada');
create type vinculo_profissional as enum ('clt','pj','mei','autonoma','socia','a_definir');
create type status_designacao    as enum ('oferecida','aceita','recusada','expirada','cancelada');
create type papel_designacao     as enum ('titular','backup');
create type periodo_visita       as enum ('manha','tarde','noite_avaliar');
create type status_audio         as enum ('pendente','transcrevendo','transcrito','erro');
create type tipo_relatorio       as enum ('puerperal','neonatal');
create type status_relatorio     as enum ('rascunho','em_revisao','aprovado','enviado','erro_envio');
create type severidade           as enum ('imediato','prioritario','atencao','informativo');
create type tipo_ocorrencia      as enum ('intercorrencia','contato_perdido','registro_atrasado','capacidade',
                                          'experiencia','reclamacao','detrator','outro');
create type status_ocorrencia    as enum ('aberta','triagem','responsavel_definido','em_acompanhamento','resolvida','encerrada');
create type prioridade           as enum ('normal','alta','maxima');
create type categoria_automacao  as enum ('interna','operacional','conteudo','marketing');
create type executor_automacao   as enum ('sistema','agente','humano_tarefa');
create type status_execucao      as enum ('agendada','executada','abortada_freio','falhou','cancelada');
create type status_sync          as enum ('pendente','processado','conflito','erro');
create type canal_contato        as enum ('whatsapp','site','email','telefone','presencial','outro');
create type enviado_por          as enum ('cliente','ia','humano','sistema');
create type direcao_mensagem     as enum ('entrada','saida');
create type classificacao_contato as enum ('nao_classificado','lead','cliente','candidata','parceiro_medico',
                                           'fornecedor','consultorio','outro');
create type handoff_motivo as enum ('contratar','reuniao','condicao_comercial','cobertura_taxa','reembolso_fiscal',
                                    'bebe_nasceu','pos_venda_operacao','duvida_sem_resposta','saude','perda',
                                    'reclamacao','pediu_humano','parceiro_medico','midia_recebida',
                                    'validacao_resposta','estado_sensivel_escreveu','outro',
                                    'audio_nao_transcrito');           -- [v4.2] transcrição do áudio falhou (19.4)
create type handoff_destino      as enum ('comercial','coordenacao_clinica','operacao');
create type status_handoff       as enum ('aberto','assumido','resolvido','cancelado');
create type tipo_tarefa as enum ('nutricao_contato','followup_comercial','agendar_sessao','enviar_formulario_contrato',
                                 'checkin_dpp','agendar_prenatal','designar_profissional','obter_contato_medico',
                                 'emitir_evolucao','escuta_neutro','enviar_pesquisa','enviar_guia','cobranca_atraso',
                                 'documento_vencendo','outro');
create type status_tarefa        as enum ('aberta','em_andamento','concluida','cancelada');
create type status_conteudo      as enum ('rascunho','aprovado','arquivado');
create type tipo_conteudo        as enum ('institucional','faq','objecao','politica','depoimento','equipe','cobertura','plano');
create type modo_agente          as enum ('desligado','teste','producao');
create type modo_mensageria      as enum ('manual','uazapi','cloud_api');
create type acao_termo_alerta    as enum ('handoff_saude','bloqueio_total');
create type status_ingestao       as enum ('ok','falhou');
-- [v4.2] estado calculado da profissional (6.5, 20.6). Nunca é coluna nem é marcado à mão:
-- só existe como retorno de privado.status_profissional. Ordem de precedência = ordem do enum.
create type status_profissional  as enum ('em_visita','em_atendimento','reservada','backup',
                                          'oferta_pendente','folga','livre');


-- -----------------------------------------------------------------------------
-- 2. privado.tocar_atualizado_em() (PRD 6.10 / P02 item 3)
--
-- Gatilho genérico: toda tabela com coluna atualizado_em recebe este
-- BEFORE UPDATE, que sempre sobrescreve atualizado_em com now(), mesmo que
-- o UPDATE não a tenha citado. Simples função de linguagem sql/plpgsql, não
-- security definer (não lê tabela nenhuma), search_path fixo por hábito.
-- -----------------------------------------------------------------------------

create function privado.tocar_atualizado_em() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
comment on function privado.tocar_atualizado_em() is 'Gatilho BEFORE UPDATE: sobrescreve atualizado_em com now() em toda tabela que o usa (PRD 6.10, P02 item 3).';


-- =============================================================================
-- 3. PRD 6.1 · Configuração, geografia e usuários
-- =============================================================================

-- --- perfil e usuario_papel primeiro: criado_por de toda tabela seguinte
--     referencia perfil (PROMPTS.md P02 item 2) -----------------------------

create table perfil (                                   -- [v4.1] 1:1 com auth.users
  id uuid primary key references auth.users(id),
  nome text not null,
  email text not null,
  telefone_e164 text,
  profissional_id uuid,                                 -- se for enfermeira
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table perfil is '1:1 com auth.users (PRD 6.1). Exceção às colunas padrão (PRD 5.2): id referencia auth.users, sem criado_por.';
comment on column perfil.profissional_id is 'se for enfermeira';

create index on perfil (profissional_id);

create trigger tocar_atualizado_em before update on perfil
  for each row execute function privado.tocar_atualizado_em();

alter table perfil enable row level security;


create table usuario_papel (                            -- [v4.1] uma pessoa pode ter vários papéis
  usuario_id uuid not null references perfil(id),
  papel papel_usuario not null,
  primary key (usuario_id, papel)
);
comment on table usuario_papel is 'Uma pessoa pode ter vários papéis (PRD 6.1). Exceção às colunas padrão: chave composta, sem id nem timestamps.';

alter table usuario_papel enable row level security;


-- --- Geografia e configuração ------------------------------------------------

create table regiao (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  nome text not null,                      -- 'São Paulo', 'Londrina'
  praca text not null,
  taxa_deslocamento_centavos integer not null default 0,
  limite_familias_semana integer not null, -- 5 SP, 3 Londrina
  ativa boolean not null default true
);
comment on table regiao is 'Região comercial e operacional (PRD 6.1): agrupa cidades sob um mesmo limite de capacidade semanal.';
comment on column regiao.nome is 'São Paulo, Londrina';
comment on column regiao.limite_familias_semana is '5 SP, 3 Londrina';

create index on regiao (criado_por);

create trigger tocar_atualizado_em before update on regiao
  for each row execute function privado.tocar_atualizado_em();

alter table regiao enable row level security;


create table cidade (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  nome text not null,
  uf char(2) not null,
  regiao_id uuid references regiao(id),
  atendida boolean not null default true,
  requer_confirmacao boolean not null default false,   -- [v4.1] ABC e casos a confirmar
  taxa_deslocamento_centavos integer not null default 0,
  aliases text[] not null default '{}',                -- [v4.1] 'Sampa', 'SP capital', 'SBC'
  observacao text
);
comment on table cidade is 'Cidade dentro (ou fora) da cobertura comercial (PRD 6.1).';
comment on column cidade.requer_confirmacao is '[v4.1] ABC e casos a confirmar';
comment on column cidade.aliases is '[v4.1] Sampa, SP capital, SBC';

create unique index on cidade (lower(privado.sem_acento(nome)), uf);
create index on cidade (regiao_id);
create index on cidade (criado_por);

create trigger tocar_atualizado_em before update on cidade
  for each row execute function privado.tocar_atualizado_em();

alter table cidade enable row level security;


create table municipio (                        -- [v4.1] lista do IBGE, carregada no seed de dados
  codigo_ibge integer primary key,
  nome text not null,
  uf char(2) not null,
  regiao_intermediaria text not null           -- usada pela cobertura: mesma região de uma praça atendida = "confirmar"
);
comment on table municipio is '[v4.1] Lista do IBGE, carregada no seed de dados. Exceção às colunas padrão: chave é o código do IBGE.';
comment on column municipio.regiao_intermediaria is 'usada pela cobertura: mesma região de uma praça atendida = "confirmar"';

create index on municipio (lower(privado.sem_acento(nome)), uf);

alter table municipio enable row level security;


create table parametro (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
comment on table parametro is 'Parâmetros editáveis sem deploy (PRD 5.2): nenhum preço, prazo, texto ou limite fica fixo no código. Exceção às colunas padrão: chave em texto, sem id nem criado_em/criado_por.';

create trigger tocar_atualizado_em before update on parametro
  for each row execute function privado.tocar_atualizado_em();

alter table parametro enable row level security;


-- =============================================================================
-- 4. PRD 6.2 · Família e pessoas
-- =============================================================================

create table familia (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  nome_exibicao text not null,                 -- "Família Tanaka"
  cidade_id uuid references cidade(id),
  regiao_id uuid references regiao(id),
  bairro text,
  endereco_atendimento jsonb,                  -- pode ser diferente da residência (casa dos avós)
  dpp date,                                    -- ESTIMATIVA
  data_nascimento date,                        -- FATO
  data_alta date,                              -- FATO, gatilho real
  data_inicio_efetivo date,                    -- FATO
  gemelar boolean not null default false,      -- [v4.1]
  primeira_gestacao boolean,                   -- [v4.1] qualificação
  estado_sensivel estado_sensivel not null default 'normal',
  estado_sensivel_motivo text,
  estado_sensivel_em timestamptz,
  estado_sensivel_por uuid,
  nao_contatar boolean not null default false, -- [v4.1] bloqueia contato ativo
  nao_contatar_em timestamptz,
  nao_contatar_motivo text,
  origem origem_lead not null default 'desconhecida',
  codigo_origem text,                          -- [v4.1] código do link wa.me ou da página de captação
  utm jsonb,
  indicacao_medico_id uuid,
  indicacao_familia_id uuid references familia(id),
  mesclada_em_id uuid references familia(id),  -- [v4.1] deduplicação
  familia_anterior_id uuid references familia(id),  -- [v4.1] nova gestação de família já atendida (regra 12)
  historico_sensivel boolean not null default false, -- [v4.2] complicação em gestação anterior, sem detalhe (perda, atual ou anterior, segue a 11.11, não este campo); só coordenação e diretoria veem na ficha; o agente recebe só o booleano para não perguntar de novo [confirmar: Edilaine, quem vê]
  cidade_informada text,                         -- [v4.2] como a família escreveu
  municipio_codigo_ibge integer references municipio(codigo_ibge)  -- [v4.2] quando reconhecido e fora de `cidade`
);
comment on table familia is 'Entidade raiz do sistema (PRD 6.10 regra 1): nunca modele a mãe como entidade principal, no pós-parto o parceiro assume a comunicação com frequência.';
comment on column familia.nome_exibicao is 'Família Tanaka';
comment on column familia.endereco_atendimento is 'pode ser diferente da residência (casa dos avós)';
comment on column familia.dpp is 'ESTIMATIVA. Nenhuma automação de operação dispara pela DPP (PRD 6.10 regra 3).';
comment on column familia.data_nascimento is 'FATO';
comment on column familia.data_alta is 'FATO, gatilho real. O atendimento começa na alta, não no nascimento (PRD 6.10 regra 3).';
comment on column familia.data_inicio_efetivo is 'FATO';
comment on column familia.nao_contatar is '[v4.1] bloqueia contato ativo';
comment on column familia.codigo_origem is '[v4.1] código do link wa.me ou da página de captação';
comment on column familia.mesclada_em_id is '[v4.1] deduplicação';
comment on column familia.familia_anterior_id is '[v4.1] nova gestação de família já atendida (regra 12)';
comment on column familia.historico_sensivel is '[v4.2] complicação em gestação anterior, sem detalhe (perda, atual ou anterior, segue a 11.11, não este campo); só coordenação e diretoria veem na ficha; o agente recebe só o booleano para não perguntar de novo';
comment on column familia.cidade_informada is '[v4.2] como a família escreveu';
comment on column familia.municipio_codigo_ibge is '[v4.2] quando reconhecido e fora de cidade';

create index on familia (dpp);
create index on familia (estado_sensivel);
create index familia_nome_trgm on familia using gin (nome_exibicao extensions.gin_trgm_ops);
create index on familia (cidade_id);
create index on familia (regiao_id);
create index on familia (indicacao_familia_id);
create index on familia (mesclada_em_id);
create index on familia (familia_anterior_id);
create index on familia (municipio_codigo_ibge);
create index on familia (criado_por);

create trigger tocar_atualizado_em before update on familia
  for each row execute function privado.tocar_atualizado_em();

alter table familia enable row level security;


create table pessoa (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid not null references familia(id) on delete cascade,
  papel papel_pessoa not null,
  nome text not null,
  telefone_e164 text,
  email text,
  idade integer,
  ocupacao text,
  contato_principal boolean not null default false,
  consentimentos jsonb not null default '{}'   -- {"lgpd_dados_saude":{"aceito":true,"versao":"1","em":"...","canal":"formulario"}, ...}
);
comment on table pessoa is 'Pessoas ligadas a uma família (PRD 6.2): mãe, parceiro, acompanhante, responsável, presenteador.';
comment on column pessoa.consentimentos is '{"lgpd_dados_saude":{"aceito":true,"versao":"1","em":"...","canal":"formulario"}, ...} (PRD 21.1)';

create unique index on pessoa (familia_id, telefone_e164) where telefone_e164 is not null;
create index on pessoa (telefone_e164);          -- deduplicação entre famílias é consulta, não restrição (regra 12)
create index on pessoa (familia_id);
create index on pessoa (criado_por);

create trigger tocar_atualizado_em before update on pessoa
  for each row execute function privado.tocar_atualizado_em();

alter table pessoa enable row level security;


create table pessoa_dados_contrato (           -- [v4.1] dado cadastral sensível separado, RLS restrita
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  pessoa_id uuid not null unique references pessoa(id) on delete cascade,
  cpf text,                                    -- armazenado, nunca exibido inteiro fora do contrato
  data_nascimento date,
  endereco_residencial jsonb,
  preenchido_via text not null default 'formulario_seguro'
);
comment on table pessoa_dados_contrato is '[v4.1] Dado cadastral sensível separado de pessoa, RLS restrita (PRD 13): leitura só por api.dados_contrato, nunca select direto.';
comment on column pessoa_dados_contrato.cpf is 'armazenado, nunca exibido inteiro fora do contrato';

create index on pessoa_dados_contrato (criado_por);
-- índice de pessoa_id dispensável: já é UNIQUE (cria índice próprio) e cobre a FK.

create trigger tocar_atualizado_em before update on pessoa_dados_contrato
  for each row execute function privado.tocar_atualizado_em();

alter table pessoa_dados_contrato enable row level security;


create table bebe (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid not null references familia(id) on delete cascade,
  ordem integer not null default 1,            -- [v4.1] gemelares: 1 e 2
  nome text,
  sexo text check (sexo in ('feminino','masculino','nao_informado')),
  data_nascimento date,
  peso_nascimento_g integer,
  peso_alta_g integer,
  tipo_parto text check (tipo_parto in ('vaginal','cesarea','nao_informado'))
);
comment on table bebe is 'Bebê da família (PRD 6.2). Gemelar: tudo que é do bebê referencia bebe_id (PRD 6.10 regra 8).';
comment on column bebe.ordem is '[v4.1] gemelares: 1 e 2';

create index on bebe (familia_id);
create index on bebe (criado_por);

create trigger tocar_atualizado_em before update on bebe
  for each row execute function privado.tocar_atualizado_em();

alter table bebe enable row level security;


create table medico (
  -- padrão
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfil(id),
  familia_id uuid references familia(id) on delete cascade,  -- null = parceiro médico do mini-CRM (fase 3)
  especialidade especialidade_medico not null,
  nome text not null,
  telefone_e164 text,
  email text,
  hospital text,
  origem_cadastro text,                        -- 'prenatal' | 'ultimo_dia' | 'coordenacao'
  capturado_em timestamptz
);
comment on table medico is 'Médico da família (obstetra, pediatra) ou parceiro médico do mini-CRM (PRD 6.2).';
comment on column medico.familia_id is 'null = parceiro médico do mini-CRM (fase 3)';
comment on column medico.origem_cadastro is 'prenatal | ultimo_dia | coordenacao';

create index on medico (familia_id);
create index on medico (criado_por);

create trigger tocar_atualizado_em before update on medico
  for each row execute function privado.tocar_atualizado_em();

alter table medico enable row level security;


-- =============================================================================
-- 5. public.ig(dpp, data) (PRD 6.10 regra 7)
--
-- Idade gestacional NUNCA é armazenada (PRD 5.2 e 6.10 regra 7): sempre
-- calculada por esta função a partir da DPP (estimativa) e de uma data
-- qualquer (hoje, a data de uma visita, etc). Fórmula do PRD:
-- ig(dpp, data) = (data − (dpp − 280 dias)), convertido em semanas e dias.
-- Imutável (mesma entrada sempre devolve a mesma saída, sem tocar em
-- tabela): pode ser usada em índice, em política de RLS e em relatório.
-- =============================================================================

create function public.ig(dpp date, data date, out semanas integer, out dias integer, out texto text)
  returns record
  language plpgsql
  immutable
  parallel safe
  set search_path = ''   -- mesma regra das demais funções do projeto (PRD 6.10 regra 11); só usa pg_catalog
  as $$
declare
  total_dias integer;
begin
  if dpp is null or data is null then
    semanas := null;
    dias := null;
    texto := null;
    return;
  end if;

  -- concepção estimada = dpp menos 280 dias (40 semanas); ig = dias corridos
  -- entre a concepção estimada e a data pedida.
  total_dias := data - (dpp - 280);
  semanas := total_dias / 7;
  dias := total_dias % 7;
  texto := semanas::text || 's' || dias::text || 'd';
end;
$$;
comment on function public.ig(date, date) is 'Idade gestacional calculada, nunca armazenada (PRD 6.10 regra 7). ig(dpp, data) = (data - (dpp - 280 dias)) em semanas e dias, mais o texto no formato 38s2d. Nulo se dpp ou data forem nulos.';
