-- =============================================================================
-- supabase/tests/007_permissoes.sql
--
-- Aceite do P07 (PROMPTS.md v2), parte de banco, invariante 2 do PRD 16.1:
-- "pgTAP do invariante 2 cobre cada linha do ADR com JWT simulado por papel,
-- em aal1 e aal2, inclusive a enfermeira sem acesso a coluna comercial e o
-- marketing sem acesso à tabela familia; comercial e financeiro em aal2
-- recebem permissão negada num select direto em pessoa_dados_contrato;
-- enfermeira perde o acesso 8 dias depois do encerramento do acompanhamento
-- e na hora em que a profissional é desativada; pgTAP lista as funções
-- executáveis por anon (esperado: nenhuma além de public.ig) e por
-- authenticated (esperado: a lista do ADR 0002)".
--
--   1. Matriz do ADR 0002 seção 4: cada tabela, cada papel, em aal1 e aal2,
--      com o resultado esperado de um select direto: 've' (vê linhas), 'zero'
--      (grant existe, nenhuma política deixa ver) ou 'nega' (permissão
--      negada). Anon: 'nega' em tudo.
--   2. Colunas: historico_sensivel fora do alcance de todos; select direto
--      em pessoa_dados_contrato negado para comercial, financeiro e
--      diretoria em aal2.
--   3. Escritas de cada linha que tem I ou A (amostra por papel).
--   4. Funções api: papel, AAL, recorte de colunas e log de leitura.
--   5. privado.familias_atribuidas: prazo depois do encerramento,
--      profissional e perfil desativados.
--   6. Funções executáveis por anon e por authenticated; default
--      privileges; perfil criado pelo convite.
--
-- Só dado sintético ("Família Teste ..."), tudo desfeito no rollback.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Dados sintéticos
--
-- Usuários (uuid fixo, só deste teste):
--   ...0001 comercial   ...0002 enfermeira   ...0003 financeiro
--   ...0004 marketing   ...0005 coordenacao  ...0006 diretoria
--   ...0007 enfermeira 2 (outra profissional)
--   ...0008 comercial + diretoria + financeiro (perfil do Leonardo)
--   ...0009 sem papel
-- -----------------------------------------------------------------------------

create temp table u (papel text primary key, id uuid not null) on commit drop;
insert into u values
  ('comercial',   'a7000000-0000-4000-8000-000000000001'),
  ('enfermeira',  'a7000000-0000-4000-8000-000000000002'),
  ('financeiro',  'a7000000-0000-4000-8000-000000000003'),
  ('marketing',   'a7000000-0000-4000-8000-000000000004'),
  ('coordenacao', 'a7000000-0000-4000-8000-000000000005'),
  ('diretoria',   'a7000000-0000-4000-8000-000000000006'),
  ('enfermeira2', 'a7000000-0000-4000-8000-000000000007'),
  ('leonardo',    'a7000000-0000-4000-8000-000000000008'),
  ('sem_papel',   'a7000000-0000-4000-8000-000000000009');

insert into auth.users (id, email) select id, papel || '.p07@exemplo.invalid' from u;
insert into perfil (id, nome, email) select id, 'Perfil Teste P07 ' || papel, papel || '.p07@exemplo.invalid' from u;
insert into usuario_papel (usuario_id, papel)
  select id, papel::papel_usuario from u where papel in ('comercial','enfermeira','financeiro','marketing','coordenacao','diretoria');
insert into usuario_papel (usuario_id, papel) values
  ('a7000000-0000-4000-8000-000000000007', 'enfermeira'),
  ('a7000000-0000-4000-8000-000000000008', 'comercial'),
  ('a7000000-0000-4000-8000-000000000008', 'diretoria'),
  ('a7000000-0000-4000-8000-000000000008', 'financeiro');

-- Parâmetros que as funções leem (P08 semeia os valores oficiais)
insert into parametro (chave, valor) values
  ('acesso_enfermeira_pos_encerramento_dias', '7'),
  ('janela_dpp_dias', '{"antes": 21, "depois": 14}')
on conflict (chave) do update set valor = excluded.valor;

-- Configuração
insert into regiao (id, nome, praca, limite_familias_semana)
  values ('b7000000-0000-4000-8000-000000000001', 'Região Teste P07', 'Praça Teste', 5);
insert into cidade (id, nome, uf, regiao_id)
  values ('b7000000-0000-4000-8000-000000000002', 'Cidade Teste P07', 'SP', 'b7000000-0000-4000-8000-000000000001');
insert into municipio (codigo_ibge, nome, uf, regiao_intermediaria) values (9999907, 'Município Teste P07', 'SP', 'Teste');
insert into automacao (id, nome, categoria, executor, gatilho, acoes)
  values ('teste_p07', 'Automação Teste P07', 'interna', 'sistema', '{}', '[]');
insert into automacao_execucao (automacao_id) values ('teste_p07');
insert into mensagem_modelo (chave, destinatario, texto) values
  ('alerta_saude', 'familia', 'Texto sintético de teste.'),
  ('teste_p07_medico', 'medico', 'Texto sintético para médico.')
on conflict (chave) do nothing;
insert into regua_faixa (ordem, objetivo, gatilho_comercial, mensagem_chave) values (1, 'Teste', 'Nenhum', 'alerta_saude');
insert into termo_alerta (termo) values ('termo teste p07');
insert into instrumento (codigo, versao, definicao) values ('DOC_TESTE', 'v-teste-p07', '{}');
insert into regra_alerta (id, grupo, descricao, severidade, conduta, instrumento_versao)
  values ('TS-01', 'puerpera', 'Regra sintética', 'atencao', 'Conduta sintética', 'v-teste-p07');
insert into pacote (id, nome, dias) values ('b7000000-0000-4000-8000-000000000003', 'Pacote Teste P07', 6);
insert into pacote_versao (id, pacote_id, valor_centavos, horas_por_visita, vigencia_inicio)
  values ('b7000000-0000-4000-8000-000000000004', 'b7000000-0000-4000-8000-000000000003', 100, 6, '2020-01-01');
insert into condicao_comercial (nome, tipo, valor) values ('Condição Teste P07', 'parcelamento', 3);

-- Famílias: F1 atribuída à enfermeira, F2 à enfermeira 2, F3 atribuída à
-- enfermeira (para o teste de desativação)
insert into familia (id, nome_exibicao, cidade_id, bairro, endereco_atendimento, dpp, origem, utm,
                     codigo_origem, historico_sensivel, primeira_gestacao)
values
  ('c7000000-0000-4000-8000-000000000001', 'Família Teste Aurora P07', 'b7000000-0000-4000-8000-000000000002',
   'Bairro Teste', '{"rua": "Rua Teste", "numero": "1"}', current_date + 10, 'instagram_organico',
   '{"utm_source": "teste"}', 'TESTE01', true, true),
  ('c7000000-0000-4000-8000-000000000002', 'Família Teste Brisa P07', null, null, null, null, 'site', null,
   null, false, null),
  ('c7000000-0000-4000-8000-000000000003', 'Família Teste Céu P07', null, null, null, current_date + 5, 'google',
   null, null, false, null);

-- F4: lead sem contrato (financeiro não vê; PRD 13, "Lead e origem")
insert into familia (id, nome_exibicao, origem)
  values ('c7000000-0000-4000-8000-000000000004', 'Família Teste Duna P07', 'site');
insert into oportunidade (familia_id, pipeline, estagio_p1)
  values ('c7000000-0000-4000-8000-000000000004', 1, 'novo');

insert into pessoa (id, familia_id, papel, nome, telefone_e164, contato_principal) values
  ('c7000000-0000-4000-8000-000000000011', 'c7000000-0000-4000-8000-000000000001', 'mae', 'Mãe Teste P07', '+5511900000701', true);
insert into pessoa_dados_contrato (pessoa_id, cpf, data_nascimento, endereco_residencial) values
  ('c7000000-0000-4000-8000-000000000011', '123.456.789-09', '1990-01-01',
   '{"rua": "Rua Contrato Teste", "numero": "42", "complemento": "ap 1", "cidade": "Cidade Teste P07"}');
insert into bebe (familia_id, nome) values ('c7000000-0000-4000-8000-000000000001', 'Bebê Teste P07');
insert into medico (familia_id, especialidade, nome) values ('c7000000-0000-4000-8000-000000000001', 'obstetra', 'Médica Teste P07');
insert into oportunidade (id, familia_id, pipeline, estagio_p1)
  values ('c7000000-0000-4000-8000-000000000021', 'c7000000-0000-4000-8000-000000000001', 1, 'novo');

insert into sessao_venda (id, familia_id, conduzida_por) values
  ('c7000000-0000-4000-8000-000000000031', 'c7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001');
insert into sessao_venda_gravacao (sessao_id, consentimento_gravacao, transcricao)
  values ('c7000000-0000-4000-8000-000000000031', true, 'Transcrição sintética de teste.');

insert into contrato (id, familia_id, pacote_versao_id, valor_centavos, template_versao) values
  ('c7000000-0000-4000-8000-000000000041', 'c7000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000004', 100, 'teste'),
  ('c7000000-0000-4000-8000-000000000042', 'c7000000-0000-4000-8000-000000000002', 'b7000000-0000-4000-8000-000000000004', 100, 'teste'),
  ('c7000000-0000-4000-8000-000000000043', 'c7000000-0000-4000-8000-000000000003', 'b7000000-0000-4000-8000-000000000004', 100, 'teste');
insert into cobranca (id, contrato_id, valor_centavos, vencimento, external_id, link_pagamento)
  values ('c7000000-0000-4000-8000-000000000051', 'c7000000-0000-4000-8000-000000000041', 100, current_date, 'teste-p07-1',
          'https://exemplo.invalid/link');
insert into nota_fiscal (cobranca_id, provider, status) values ('c7000000-0000-4000-8000-000000000051', 'teste', 'emitida');

insert into conversa (id, familia_id) values ('c7000000-0000-4000-8000-000000000061', 'c7000000-0000-4000-8000-000000000001');
insert into mensagem (conversa_id, direcao, enviado_por, conteudo)
  values ('c7000000-0000-4000-8000-000000000061', 'entrada', 'cliente', 'Mensagem sintética.');
insert into handoff (conversa_id, familia_id, motivo, destino, prioridade, resumo)
  values ('c7000000-0000-4000-8000-000000000061', 'c7000000-0000-4000-8000-000000000001', 'reuniao', 'comercial', 'normal', 'Resumo sintético.');

-- Uma tarefa, uma notificação e um item de fila para cada usuário; uma
-- tarefa de papel (coordenação) sem pessoa.
insert into tarefa (tipo, titulo, responsavel_id) select 'outro', 'Tarefa teste ' || papel, id from u;
insert into tarefa (id, tipo, titulo, papel_responsavel)
  values ('c7000000-0000-4000-8000-000000000071', 'outro', 'Tarefa teste do papel coordenação', 'coordenacao');
insert into notificacao (titulo, usuario_id) select 'Notificação teste ' || papel, id from u;
insert into fila_sincronizacao (id, usuario_id, entidade, payload, criado_no_cliente_em)
  select extensions.gen_random_uuid(), id, 'visita', '{}', now() from u;

insert into evento_familia (familia_id, tipo, titulo, restrito) values
  ('c7000000-0000-4000-8000-000000000001', 'lead_entrou', 'Evento teste', false),
  ('c7000000-0000-4000-8000-000000000001', 'teste', 'Evento restrito teste', true);

-- Profissionais, agenda e atribuição
insert into profissional (id, usuario_id, nome, funcao, regioes) values
  ('d7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 'Enfermeira Teste P07',
   'enfermeira_obstetrica', array['b7000000-0000-4000-8000-000000000001'::uuid]),
  ('d7000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000007', 'Enfermeira Teste Dois P07',
   'enfermeira_neonatal', array['b7000000-0000-4000-8000-000000000001'::uuid]);
insert into documento_profissional (profissional_id, tipo) values ('d7000000-0000-4000-8000-000000000001', 'teste');
insert into bloqueio_agenda (profissional_id, inicio, fim, motivo)
  values ('d7000000-0000-4000-8000-000000000001', current_date + 60, current_date + 61, 'folga teste');

insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita) values
  ('d7000000-0000-4000-8000-000000000011', 'c7000000-0000-4000-8000-000000000041', 'c7000000-0000-4000-8000-000000000001', 6, 6),
  ('d7000000-0000-4000-8000-000000000012', 'c7000000-0000-4000-8000-000000000042', 'c7000000-0000-4000-8000-000000000002', 6, 6),
  ('d7000000-0000-4000-8000-000000000013', 'c7000000-0000-4000-8000-000000000043', 'c7000000-0000-4000-8000-000000000003', 6, 6);
insert into designacao (acompanhamento_id, profissional_id, papel, status) values
  ('d7000000-0000-4000-8000-000000000011', 'd7000000-0000-4000-8000-000000000001', 'titular', 'aceita'),
  ('d7000000-0000-4000-8000-000000000013', 'd7000000-0000-4000-8000-000000000001', 'titular', 'aceita'),
  ('d7000000-0000-4000-8000-000000000012', 'd7000000-0000-4000-8000-000000000002', 'titular', 'aceita'),
  ('d7000000-0000-4000-8000-000000000013', 'd7000000-0000-4000-8000-000000000002', 'backup', 'oferecida');
insert into visita (id, acompanhamento_id, profissional_id, dia_numero, data) values
  ('d7000000-0000-4000-8000-000000000021', 'd7000000-0000-4000-8000-000000000011', 'd7000000-0000-4000-8000-000000000001', 1,
   (now() at time zone 'America/Sao_Paulo')::date),
  ('d7000000-0000-4000-8000-000000000022', 'd7000000-0000-4000-8000-000000000012', 'd7000000-0000-4000-8000-000000000002', 1,
   (now() at time zone 'America/Sao_Paulo')::date);

insert into ocorrencia (id, tipo, prioridade, privada, titulo, descricao, responsavel_id) values
  ('d7000000-0000-4000-8000-000000000031', 'reclamacao', 'normal', false, 'Ocorrência teste', 'Descrição sintética.',
   'a7000000-0000-4000-8000-000000000001'),
  ('d7000000-0000-4000-8000-000000000032', 'detrator', 'alta', true, 'Ocorrência privada teste', 'Descrição sintética.',
   'a7000000-0000-4000-8000-000000000001');
insert into pos_venda (acompanhamento_id) values ('d7000000-0000-4000-8000-000000000011');


-- -----------------------------------------------------------------------------
-- Funções auxiliares do teste (no schema testes, desfeitas no rollback)
-- -----------------------------------------------------------------------------

-- Resultado de um select direto como o papel pedido: 've', 'zero' ou 'nega'.
create function testes.visibilidade(p_sub uuid, p_aal text, p_tabela text) returns text
  language plpgsql
  as $$
declare
  v_n bigint;
begin
  if p_sub is null then
    perform testes.autenticar_anon();
  else
    perform testes.autenticar_authenticated(p_sub, p_aal);
  end if;
  begin
    execute format('select count(*) from %s', p_tabela) into v_n;
  exception
    when insufficient_privilege then
      perform testes.encerrar();
      return 'nega';
  end;
  perform testes.encerrar();
  return case when v_n > 0 then 've' else 'zero' end;
end;
$$;

create function testes.uid(p_papel text) returns uuid
  language sql stable
  as $$ select ('a7000000-0000-4000-8000-00000000000' || case p_papel
                  when 'comercial' then '1' when 'enfermeira' then '2' when 'financeiro' then '3'
                  when 'marketing' then '4' when 'coordenacao' then '5' when 'diretoria' then '6'
                  when 'enfermeira2' then '7' when 'leonardo' then '8' when 'sem_papel' then '9' end)::uuid $$;

-- Linhas afetadas por um comando, rodado com o papel corrente.
create function testes.afetadas(p_sql text) returns integer
  language plpgsql
  as $$
declare
  v_n integer;
begin
  execute p_sql;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Contagem de linhas 'leitura' no log, para provar que a função gravou.
create function testes.leituras(p_entidade text, p_entidade_id text) returns bigint
  language sql
  as $$ select count(*) from public.log_auditoria
        where acao = 'leitura' and entidade = p_entidade and entidade_id = p_entidade_id $$;


-- -----------------------------------------------------------------------------
-- 1. Matriz do ADR 0002 seção 4
--
-- quem: papéis que veem linhas com a sessão certa.
-- tipo:
--   perfil   regra do perfil com MFA: comercial e marketing em aal1 ou aal2;
--            enfermeira, financeiro, coordenação e diretoria só em aal2
--   aal2     AAL2 para todos (financeiras e fila)
--   propria  a própria linha é visível em aal1 e aal2 (perfil, usuario_papel)
--   nega     sem grant: permissão negada para todos
-- -----------------------------------------------------------------------------

create temp table matriz (tabela text primary key, quem text[] not null, tipo text not null) on commit drop;
insert into matriz values
  -- configuração e usuários
  ('public.perfil',                  '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', 'propria'),
  ('public.usuario_papel',           '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', 'propria'),
  ('public.regiao',                  '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.cidade',                  '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.municipio',               '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.parametro',               '{diretoria}', 'perfil'),
  ('public.automacao',               '{diretoria}', 'perfil'),
  ('public.automacao_execucao',      '{coordenacao,diretoria}', 'perfil'),
  ('public.mensagem_modelo',         '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', 'perfil'),
  ('public.regua_faixa',             '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.termo_alerta',            '{coordenacao,diretoria}', 'perfil'),
  ('public.instrumento',             '{enfermeira,coordenacao,diretoria}', 'perfil'),
  ('public.regra_alerta',            '{enfermeira,coordenacao,diretoria}', 'perfil'),
  -- família, comercial e conversa
  ('public.familia',                 '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.familia_elegivel_marketing', '{}', 'nega'),
  ('public.pessoa',                  '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.pessoa_dados_contrato',   '{}', 'nega'),
  ('public.bebe',                    '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.medico',                  '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.pacote',                  '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.pacote_versao',           '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.condicao_comercial',      '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.oportunidade',            '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.sessao_venda',            '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.sessao_venda_gravacao',   '{}', 'nega'),
  ('public.contrato',                '{comercial,financeiro,diretoria}', 'aal2'),
  ('public.cobranca',                '{financeiro,diretoria}', 'aal2'),
  ('public.nota_fiscal',             '{financeiro,diretoria}', 'aal2'),
  ('public.conversa',                '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.mensagem',                '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.handoff',                 '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.tarefa',                  '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', 'perfil'),
  ('public.notificacao',             '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', 'perfil'),
  ('public.evento_familia',          '{comercial,financeiro,coordenacao,diretoria}', 'perfil'),
  -- operação e assistencial
  ('public.profissional',            '{enfermeira,financeiro,coordenacao,diretoria}', 'perfil'),
  ('public.documento_profissional',  '{enfermeira,coordenacao,diretoria}', 'perfil'),
  ('public.bloqueio_agenda',         '{comercial,enfermeira,coordenacao,diretoria}', 'perfil'),
  ('public.acompanhamento',          '{comercial,enfermeira,coordenacao,diretoria}', 'perfil'),
  ('public.designacao',              '{comercial,enfermeira,coordenacao,diretoria}', 'perfil'),
  ('public.visita',                  '{comercial,enfermeira,coordenacao,diretoria}', 'perfil'),
  ('public.consulta_prenatal',       '{}', 'nega'),
  ('public.registro_atendimento',    '{}', 'nega'),
  ('public.registro_adendo',         '{}', 'nega'),
  ('public.anexo_audio',             '{}', 'nega'),
  ('public.relatorio_medico',        '{}', 'nega'),
  ('public.alerta_clinico',          '{}', 'nega'),
  ('public.ocorrencia',              '{comercial,coordenacao,diretoria}', 'perfil'),
  ('public.pos_venda',               '{coordenacao,diretoria}', 'perfil'),
  ('public.log_auditoria',           '{}', 'nega'),
  ('public.fila_sincronizacao',      '{comercial,enfermeira,financeiro,marketing,coordenacao,diretoria}', 'aal2'),
  -- schemas internos
  ('agente.base_conhecimento',       '{}', 'nega'),
  ('agente.ingestao_execucao',       '{}', 'nega'),
  ('agente_n8n.documentos',          '{}', 'nega'),
  ('agente_n8n.chat_memoria',        '{}', 'nega'),
  ('privado.transicao_permitida',    '{}', 'nega'),
  ('privado.auditoria_coluna_sensivel', '{}', 'nega'),
  -- P19 (0011): view de ocupação e registro do recálculo diário, lidos só
  -- por funções security definer
  ('public.ocupacao_projetada',      '{}', 'nega'),
  ('privado.recalculo_execucao',     '{}', 'nega'),
  ('privado.recalculo_etapa',        '{}', 'nega');

create temp table esperado on commit drop as
  select m.tabela, p.papel, a.aal,
         case
           when m.tipo = 'nega' then 'nega'
           when m.tipo = 'propria' then 've'
           when not (p.papel = any (m.quem)) then 'zero'
           when m.tipo = 'aal2' then case when a.aal = 'aal2' then 've' else 'zero' end
           when p.papel in ('comercial', 'marketing') or a.aal = 'aal2' then 've'
           else 'zero'
         end as resultado
  from matriz m
  cross join (values ('comercial'), ('enfermeira'), ('financeiro'), ('marketing'), ('coordenacao'), ('diretoria')) as p(papel)
  cross join (values ('aal1'), ('aal2')) as a(aal);

select plan(
  (select count(*)::integer from esperado)   -- matriz por papel e AAL
  + (select count(*)::integer from matriz)   -- anon em cada tabela
  + 1                                        -- a matriz cobre toda tabela do projeto
  + 139                                      -- testes das seções 2 a 6
);

select is(
  testes.visibilidade(testes.uid(e.papel), e.aal, e.tabela),
  e.resultado,
  format('matriz ADR 0002: %s em %s, select direto em %s = %s', e.papel, e.aal, e.tabela, e.resultado))
from esperado e
order by e.tabela, e.papel, e.aal;

select is(
  testes.visibilidade(null, null, m.tabela),
  'nega',
  format('anon sem nada: select direto em %s é negado', m.tabela))
from matriz m
order by m.tabela;

select is_empty(
  $$ select n.nspname || '.' || c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'v')
       and n.nspname in ('public', 'agente', 'agente_n8n', 'privado')
       and n.nspname || '.' || c.relname not in (select tabela from matriz) $$,
  'a matriz do teste cobre toda tabela e view dos schemas do projeto (tabela nova precisa de linha no ADR e aqui)');


-- -----------------------------------------------------------------------------
-- 2. Colunas e select direto (PRD 13 [v4.2])
-- -----------------------------------------------------------------------------

-- historico_sensivel fora de todo grant (comercial e financeiro nunca veem;
-- coordenação e diretoria só por api.ficha_assistencial)
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal2');
select throws_ok($s$ select historico_sensivel from familia $s$, '42501', null,
  'comercial em aal2 não lê familia.historico_sensivel direto');
select lives_ok($s$ select id, nome_exibicao, bairro, dpp from familia $s$,
  'comercial lê as demais colunas da família');
select throws_ok($s$ select origem, utm from familia $s$, '42501', null,
  'origem e UTM saem do grant de familia (financeiro e coordenação leem a linha); o comercial lê por api.lead_origem');
select throws_ok($s$ update familia set historico_sensivel = false $s$, '42501', null,
  'comercial não grava familia.historico_sensivel');
select throws_ok($s$ update familia set estado_sensivel = 'normal' $s$, '42501', null,
  'comercial não muda estado_sensivel direto (freio é função, P09)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('financeiro'), 'aal2');
select throws_ok($s$ select historico_sensivel from familia $s$, '42501', null,
  'financeiro em aal2 não lê familia.historico_sensivel');
select throws_ok($s$ select origem, codigo_origem, utm, indicacao_medico_id from familia $s$, '42501', null,
  'financeiro em aal2 não lê a origem do lead (PRD 13, "Lead e origem" sem acesso)');
select throws_ok($s$ select * from api.lead_origem() $s$, '42501', null,
  'financeiro não usa api.lead_origem');
select is((select count(*)::integer from familia where id = 'c7000000-0000-4000-8000-000000000004'), 0,
  'financeiro não vê lead sem contrato (família)');
select is((select count(*)::integer from oportunidade where familia_id = 'c7000000-0000-4000-8000-000000000004'), 0,
  'financeiro não vê lead sem contrato (oportunidade)');
select is((select count(*)::integer from familia where id = 'c7000000-0000-4000-8000-000000000001'), 1,
  'financeiro vê a família com contrato (ficha comercial: leitura)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select throws_ok($s$ select origem from familia $s$, '42501', null,
  'coordenação em aal2 não lê a origem do lead (PRD 13, "Lead e origem" sem acesso)');
select throws_ok($s$ select * from api.lead_origem() $s$, '42501', null,
  'coordenação não usa api.lead_origem');
select is((select count(*)::integer from familia where id = 'c7000000-0000-4000-8000-000000000004'), 1,
  'coordenação vê o lead sem contrato (conduz a sessão de venda no pipeline 1)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select results_eq(
  $s$ select origem::text, codigo_origem from api.lead_origem(array['c7000000-0000-4000-8000-000000000001'::uuid]) $s$,
  $s$ values ('instagram_organico', 'TESTE01') $s$,
  'api.lead_origem: comercial em aal1 lê a origem do lead');
select is((select count(*)::integer from api.lead_origem()), (select count(*)::integer from familia),
  'api.lead_origem sem filtro: todas as famílias que o comercial vê');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('marketing'), 'aal2');
select throws_ok($s$ select * from api.lead_origem() $s$, '42501', null,
  'marketing não usa api.lead_origem (só agregados)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('diretoria'), 'aal2');
select throws_ok($s$ select historico_sensivel from familia $s$, '42501', null,
  'nem a diretoria lê historico_sensivel direto (só pela ficha)');
select testes.encerrar();

-- pessoa_dados_contrato: permissão negada num select direto, em aal2
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal2');
select throws_ok($s$ select cpf from pessoa_dados_contrato $s$, '42501', null,
  'comercial em aal2: select direto em pessoa_dados_contrato negado');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('financeiro'), 'aal2');
select throws_ok($s$ select cpf from pessoa_dados_contrato $s$, '42501', null,
  'financeiro em aal2: select direto em pessoa_dados_contrato negado');
select testes.encerrar();

-- enfermeira sem coluna comercial e marketing sem a tabela família
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select is((select count(*)::integer from oportunidade), 0, 'enfermeira em aal2 não vê oportunidade');
select is((select count(*)::integer from familia), 0, 'enfermeira em aal2 não lê a tabela familia (origem, UTM, indicação)');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('marketing'), 'aal2');
select is((select count(*)::integer from familia), 0, 'marketing em aal2 não vê nenhuma linha de familia');
select is((select count(*)::integer from pessoa), 0, 'marketing em aal2 não vê nenhuma pessoa');
select testes.encerrar();

-- perfil com MFA (ADR 0002 seção 2): o Leonardo (comercial, diretoria e
-- financeiro) em aal1 não vê nem o que um comercial puro veria
select testes.autenticar_authenticated(testes.uid('leonardo'), 'aal1');
select is((select count(*)::integer from familia), 0, 'perfil com diretoria e financeiro em aal1 não vê família, nem como comercial');
select is((select count(*)::integer from perfil), 1, 'mas em aal1 lê o próprio perfil (middleware pede o MFA)');
select is((select count(*)::integer from usuario_papel), 3, 'e os próprios papéis, em aal1');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('leonardo'), 'aal2');
select ok((select count(*) from familia) > 0, 'o mesmo perfil em aal2 vê as famílias');
select testes.encerrar();

-- usuário sem papel não vê nada além do próprio perfil
select testes.autenticar_authenticated(testes.uid('sem_papel'), 'aal2');
select is((select count(*)::integer from familia) + (select count(*)::integer from mensagem_modelo), 0,
  'usuário sem papel em aal2 não vê família nem textos');
select testes.encerrar();

-- evento restrito não sai no select direto de ninguém
select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select is((select count(*)::integer from evento_familia where restrito), 0,
  'evento_familia restrito não sai no select direto, nem para a coordenação');
select testes.encerrar();


-- -----------------------------------------------------------------------------
-- 3. Escritas (linhas do ADR com I, A ou X)
-- -----------------------------------------------------------------------------

-- usuario_papel: só a diretoria, em aal2
select testes.autenticar_authenticated(testes.uid('diretoria'), 'aal2');
select lives_ok(
  format($s$ insert into usuario_papel (usuario_id, papel) values (%L, 'marketing') $s$, testes.uid('sem_papel')),
  'diretoria em aal2 dá papel a um usuário');
select lives_ok(
  format($s$ delete from usuario_papel where usuario_id = %L and papel = 'marketing' $s$, testes.uid('sem_papel')),
  'diretoria em aal2 tira papel de um usuário');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('diretoria'), 'aal1');
select throws_ok(
  format($s$ insert into usuario_papel (usuario_id, papel) values (%L, 'marketing') $s$, testes.uid('sem_papel')),
  '42501', null, 'diretoria em aal1 não dá papel');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select throws_ok(
  format($s$ insert into usuario_papel (usuario_id, papel) values (%L, 'diretoria') $s$, testes.uid('comercial')),
  '42501', null, 'comercial não se dá o papel de diretoria');
select is(
  testes.afetadas($s$ delete from usuario_papel $s$), 0,
  'comercial não apaga papel nenhum, nem o próprio');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select throws_ok(
  format($s$ insert into usuario_papel (usuario_id, papel) values (%L, 'coordenacao') $s$, testes.uid('sem_papel')),
  '42501', null, 'coordenação não dá papel');
select testes.encerrar();

-- perfil: só a diretoria altera
select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select is(
  testes.afetadas($s$ update perfil set ativo = false where id = testes.uid('comercial') $s$), 0,
  'coordenação não desativa perfil');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('diretoria'), 'aal2');
select is(
  testes.afetadas($s$ update perfil set nome = 'Perfil Teste P07 renomeado' where id = testes.uid('sem_papel') $s$), 1,
  'diretoria em aal2 altera perfil');
select testes.encerrar();

-- familia: comercial inclui em aal1; marketing e financeiro não
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select lives_ok($s$ insert into familia (nome_exibicao, origem) values ('Família Teste Inclusão P07', 'site') $s$,
  'comercial em aal1 inclui família');
select lives_ok(
  $s$ insert into oportunidade (familia_id, pipeline, estagio_p1)
      select id, 1, 'novo' from familia where nome_exibicao = 'Família Teste Inclusão P07' $s$,
  'comercial em aal1 inclui oportunidade no estado inicial');
select throws_ok(
  $s$ update oportunidade set estagio_p1 = 'qualificado' $s$, '42501', null,
  'comercial não muda estágio direto (só api.transicionar)');
select throws_ok(
  $s$ update oportunidade set desconto_aprovado_por = auth.uid() $s$, '42501', null,
  'comercial não aprova o próprio desconto');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('marketing'), 'aal2');
select throws_ok($s$ insert into familia (nome_exibicao) values ('Família Teste Marketing P07') $s$, '42501', null,
  'marketing não inclui família');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('financeiro'), 'aal2');
select throws_ok($s$ insert into familia (nome_exibicao) values ('Família Teste Financeiro P07') $s$, '42501', null,
  'financeiro não inclui família (ficha comercial: leitura)');
select testes.encerrar();

-- configuração: só a diretoria grava; coordenação só termos, instrumentos e
-- textos para médico
select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select throws_ok($s$ insert into parametro (chave, valor) values ('teste_p07', '1') $s$, '42501', null,
  'coordenação não grava parametro');
select lives_ok($s$ insert into termo_alerta (termo) values ('outro termo teste p07') $s$,
  'coordenação inclui termo de alerta');
select is(
  testes.afetadas($s$ update mensagem_modelo set texto = 'Texto sintético alterado.' where destinatario = 'medico' $s$), 1,
  'coordenação altera texto para médico');
select is(
  testes.afetadas($s$ update mensagem_modelo set texto = 'Texto sintético alterado.' where destinatario = 'familia' $s$), 0,
  'coordenação não altera texto para a família');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('diretoria'), 'aal2');
select lives_ok($s$ insert into parametro (chave, valor) values ('teste_p07', '1') $s$,
  'diretoria em aal2 grava parametro');
select lives_ok($s$ insert into cidade (nome, uf) values ('Cidade Teste Inclusão P07', 'SP') $s$,
  'diretoria em aal2 inclui cidade (o índice único calcula privado.sem_acento com o papel do usuário)');
select testes.encerrar();

-- mensagem: ninguém grava direto (texto passa pela máscara, P18)
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select throws_ok(
  $s$ insert into mensagem (conversa_id, direcao, enviado_por, conteudo)
      values ('c7000000-0000-4000-8000-000000000061', 'saida', 'humano', 'CPF 123.456.789-09') $s$,
  '42501', null, 'comercial não grava mensagem direto (a máscara de CPF é obrigatória)');
select is(
  testes.afetadas($s$ update handoff set status = 'assumido', assumido_por = auth.uid() $s$), 1,
  'comercial assume handoff');
select throws_ok($s$ update handoff set resumo = 'outro' $s$, '42501', null, 'comercial não reescreve o resumo do handoff');
select throws_ok($s$ update conversa set agente_encerrado_em = null $s$, '42501', null,
  'comercial não devolve a conversa à Isadora direto (só privado.retomar_agente)');
select testes.encerrar();

-- financeiras: AAL2 para todos
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select throws_ok(
  $s$ insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao)
      values ('c7000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000004', 1, 'teste') $s$,
  '42501', null, 'comercial em aal1 não inclui contrato (financeira, AAL2)');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal2');
select lives_ok(
  $s$ insert into contrato (familia_id, pacote_versao_id, valor_centavos, template_versao)
      values ('c7000000-0000-4000-8000-000000000001', 'b7000000-0000-4000-8000-000000000004', 1, 'teste') $s$,
  'comercial em aal2 inclui contrato');
select is((select count(*)::integer from cobranca), 0, 'comercial em aal2 não vê a cobrança direto (só o status, pela função)');
select testes.encerrar();

-- tarefa e notificação: responsável e papel responsável
select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select ok(exists (select 1 from tarefa where id = 'c7000000-0000-4000-8000-000000000071'),
  'coordenação vê a tarefa sem pessoa do papel coordenação');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select is((select count(*)::integer from tarefa), 1, 'comercial vê só a própria tarefa');
select is((select count(*)::integer from notificacao), 1, 'comercial vê só a própria notificação');
select throws_ok($s$ update notificacao set titulo = 'outro' $s$, '42501', null, 'notificação: só lida_em muda');
select testes.encerrar();

-- fila de sincronização: só a própria, AAL2
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select lives_ok(
  format($s$ insert into fila_sincronizacao (id, usuario_id, entidade, payload, criado_no_cliente_em)
             values (extensions.gen_random_uuid(), %L, 'visita', '{}', now()) $s$, testes.uid('enfermeira')),
  'enfermeira em aal2 grava na própria fila');
select throws_ok(
  format($s$ insert into fila_sincronizacao (id, usuario_id, entidade, payload, criado_no_cliente_em)
             values (extensions.gen_random_uuid(), %L, 'visita', '{}', now()) $s$, testes.uid('enfermeira2')),
  '42501', null, 'enfermeira não grava na fila de outra pessoa');
select is((select count(*)::integer from fila_sincronizacao), 2, 'enfermeira vê só a própria fila');
select testes.encerrar();

-- usuário sem papel (cadastro sem convite com MFA) não grava na fila
select testes.autenticar_authenticated(testes.uid('sem_papel'), 'aal2');
select throws_ok(
  format($s$ insert into fila_sincronizacao (id, usuario_id, entidade, payload, criado_no_cliente_em)
             values (extensions.gen_random_uuid(), %L, 'visita', '{}', now()) $s$, testes.uid('sem_papel')),
  '42501', null, 'usuário sem papel em aal2 não grava na fila, nem a própria');
select is((select count(*)::integer from fila_sincronizacao), 0, 'usuário sem papel não lê a fila');
select testes.encerrar();

-- criado_por: o banco carimba auth.uid() para o usuário do app
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select lives_ok(
  format($s$ insert into familia (nome_exibicao, origem, criado_por) values ('Família Teste Autoria P07', 'site', %L) $s$,
         testes.uid('diretoria')),
  'comercial inclui família informando criado_por de outra pessoa');
select is(
  (select criado_por from familia where nome_exibicao = 'Família Teste Autoria P07'), testes.uid('comercial'),
  'criado_por gravado é o do usuário logado, não o informado');
select is(
  testes.afetadas(format($s$ update familia set bairro = 'Bairro Teste' where nome_exibicao = 'Família Teste Autoria P07' $s$)), 1,
  'comercial altera a família que criou');
select is(
  (select criado_por from familia where nome_exibicao = 'Família Teste Autoria P07'), testes.uid('comercial'),
  'criado_por não muda no update');
select testes.encerrar();

-- sessão gravada: quem conduziu não muda pelo app (decide quem lê a gravação)
insert into sessao_venda (id, familia_id, conduzida_por) values
  ('c7000000-0000-4000-8000-000000000032', 'c7000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000005'),
  ('c7000000-0000-4000-8000-000000000033', 'c7000000-0000-4000-8000-000000000002', null);
insert into sessao_venda_gravacao (sessao_id, consentimento_gravacao, transcricao)
  values ('c7000000-0000-4000-8000-000000000032', true, 'Transcrição sintética da coordenação.');
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal2');
select throws_ok(
  $s$ update sessao_venda set conduzida_por = auth.uid() where id = 'c7000000-0000-4000-8000-000000000032' $s$,
  '42501', null, 'comercial não se põe como condutor de sessão gravada (leria a transcrição de outra pessoa)');
select throws_ok($s$ select api.sessao_venda_gravacao('c7000000-0000-4000-8000-000000000032') $s$, '42501', null,
  'comercial não lê a gravação conduzida pela coordenação');
select throws_ok(
  $s$ update sessao_venda set conduzida_por = auth.uid() where id = 'c7000000-0000-4000-8000-000000000033' $s$,
  '42501', null, 'condutor fora do grant de alteração também em sessão sem gravação (só por função, P29)');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('diretoria'), 'aal2');
select throws_ok(
  $s$ update sessao_venda set conduzida_por = null where id = 'c7000000-0000-4000-8000-000000000032' $s$,
  '42501', null, 'nem a diretoria troca pelo app o condutor da sessão (correção por função, P29)');
select testes.encerrar();

-- ocorrência: privada só coordenação e diretoria; responsável muda só status
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select is((select count(*)::integer from ocorrencia), 1, 'responsável comercial vê só a ocorrência não privada');
select is(
  testes.afetadas($s$ update ocorrencia set status = 'em_acompanhamento' $s$), 1,
  'responsável atualiza o status da ocorrência');
select throws_ok($s$ update ocorrencia set titulo = 'outro' $s$, '42501', null,
  'responsável não reescreve a ocorrência (só status e histórico)');
select testes.encerrar();

-- agenda: enfermeira vê só a própria; não grava direto
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select results_eq($s$ select id from visita $s$, $s$ values ('d7000000-0000-4000-8000-000000000021'::uuid) $s$,
  'enfermeira vê só a própria visita, da família atribuída');
select is((select count(*)::integer from designacao), 2, 'enfermeira vê só as próprias designações');
select is((select count(*)::integer from profissional), 1, 'enfermeira lê só o próprio cadastro de profissional');
select is(
  testes.afetadas($s$ update visita set hora_prevista = '10:00' $s$), 0,
  'enfermeira não altera visita direto (check-in é função, P38)');
select testes.encerrar();


-- -----------------------------------------------------------------------------
-- 4. Funções do schema api (ADR 0002 seção 5)
-- -----------------------------------------------------------------------------

-- api.dados_contrato
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select is(
  api.dados_contrato('c7000000-0000-4000-8000-000000000011', false) ->> 'cpf', '***.456.789-**',
  'dados_contrato mascarado: CPF ***.456.789-** para o comercial em aal1');
select is(
  (api.dados_contrato('c7000000-0000-4000-8000-000000000011', false) -> 'endereco_residencial') ?| array['numero', 'complemento'], false,
  'dados_contrato mascarado: endereço sem número nem complemento');
select throws_ok($s$ select api.dados_contrato('c7000000-0000-4000-8000-000000000011', true) $s$, '42501', null,
  'dados_contrato completo exige AAL2');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('comercial'), 'aal2');
select is(
  api.dados_contrato('c7000000-0000-4000-8000-000000000011', true) ->> 'cpf', '123.456.789-09',
  'dados_contrato completo em aal2 devolve o CPF');
select testes.encerrar();
select ok(testes.leituras('pessoa_dados_contrato', 'c7000000-0000-4000-8000-000000000011') >= 3,
  'dados_contrato grava leitura no log');

select testes.autenticar_authenticated(testes.uid('financeiro'), 'aal1');
select throws_ok($s$ select api.dados_contrato('c7000000-0000-4000-8000-000000000011', false) $s$, '42501', null,
  'financeiro em aal1 não lê nem o mascarado (perfil com MFA)');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select throws_ok($s$ select api.dados_contrato('c7000000-0000-4000-8000-000000000011', false) $s$, '42501', null,
  'enfermeira não lê dados de contrato');
select testes.encerrar();

-- api.familias_do_dia e api.ficha_assistencial (enfermeira)
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select results_eq($s$ select familia_id from api.familias_do_dia() $s$,
  $s$ values ('c7000000-0000-4000-8000-000000000001'::uuid) $s$,
  'familias_do_dia: a enfermeira recebe só a família da própria visita');
select is(
  (api.ficha_assistencial('c7000000-0000-4000-8000-000000000001') -> 'familia') ?| array['origem', 'utm', 'codigo_origem',
     'indicacao_medico_id', 'indicacao_familia_id', 'historico_sensivel', 'estado_sensivel_motivo',
     'nao_contatar_motivo', 'primeira_gestacao'],
  false, 'ficha_assistencial: nenhuma coluna comercial nem historico_sensivel para a enfermeira');
select ok(
  (api.ficha_assistencial('c7000000-0000-4000-8000-000000000001') -> 'familia') ?& array['endereco_atendimento', 'dpp',
     'data_nascimento', 'data_alta', 'estado_sensivel'],
  'ficha_assistencial: endereço de atendimento, datas e estado sensível');
select throws_ok($s$ select api.ficha_assistencial('c7000000-0000-4000-8000-000000000002') $s$, '42501', null,
  'ficha_assistencial: família de outra profissional é negada');
select testes.encerrar();

select is_empty(
  $$ select a.nome from unnest((select proargnames from pg_proc where oid = 'api.familias_do_dia(date)'::regprocedure)) a(nome)
     where a.nome in ('origem', 'utm', 'codigo_origem', 'historico_sensivel', 'score', 'valor_centavos') $$,
  'familias_do_dia não devolve coluna comercial');
select ok(testes.leituras('familia', 'c7000000-0000-4000-8000-000000000001') >= 3,
  'familias_do_dia e ficha_assistencial gravam leitura no log');

select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal1');
select throws_ok($s$ select * from api.familias_do_dia() $s$, '42501', null, 'familias_do_dia exige AAL2');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select is(
  (api.ficha_assistencial('c7000000-0000-4000-8000-000000000001') -> 'familia' ->> 'historico_sensivel'), 'true',
  'ficha_assistencial: coordenação vê historico_sensivel');
select is((select count(*)::integer from api.familias_do_dia()), 2, 'familias_do_dia: coordenação vê todas as visitas do dia');
select testes.encerrar();

select testes.autenticar_authenticated(testes.uid('comercial'), 'aal2');
select throws_ok($s$ select api.ficha_assistencial('c7000000-0000-4000-8000-000000000001') $s$, '42501', null,
  'comercial não abre a ficha assistencial (O-05)');
select testes.encerrar();

-- api.marketing_*: agregados, nunca a tabela
select testes.autenticar_authenticated(testes.uid('marketing'), 'aal1');
select ok((select sum(leads) from api.marketing_leads_por_origem()) >= 3, 'marketing lê o agregado por origem');
select ok((select count(*) from api.marketing_funil()) >= 1, 'marketing lê o funil agregado');
select throws_ok($s$ select api.ficha_assistencial('c7000000-0000-4000-8000-000000000001') $s$, '42501', null,
  'marketing não abre ficha de família');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select throws_ok($s$ select * from api.marketing_funil() $s$, '42501', null, 'comercial não usa as funções de marketing');
select testes.encerrar();

-- api.status_cobranca
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal2');
select results_eq($s$ select status::text, nota_status::text from api.status_cobranca('c7000000-0000-4000-8000-000000000001') $s$,
  $s$ values ('aberta', 'emitida') $s$, 'status_cobranca: comercial em aal2 vê só o status');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select throws_ok($s$ select * from api.status_cobranca('c7000000-0000-4000-8000-000000000001') $s$, '42501', null,
  'status_cobranca exige AAL2');
select testes.encerrar();

-- api.sessao_venda_gravacao: quem conduziu e diretoria
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal2');
select is(api.sessao_venda_gravacao('c7000000-0000-4000-8000-000000000031') ->> 'transcricao', 'Transcrição sintética de teste.',
  'sessão gravada: quem conduziu lê');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select throws_ok($s$ select api.sessao_venda_gravacao('c7000000-0000-4000-8000-000000000031') $s$, '42501', null,
  'sessão gravada: coordenação que não conduziu não lê');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('diretoria'), 'aal2');
select lives_ok($s$ select api.sessao_venda_gravacao('c7000000-0000-4000-8000-000000000031') $s$, 'sessão gravada: diretoria lê');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select throws_ok($s$ select api.sessao_venda_gravacao('c7000000-0000-4000-8000-000000000031') $s$, '42501', null,
  'sessão gravada exige AAL2');
select testes.encerrar();

-- api.log_auditoria: só diretoria em aal2
select testes.autenticar_authenticated(testes.uid('diretoria'), 'aal2');
select ok((select count(*) from api.log_auditoria('familia', 'c7000000-0000-4000-8000-000000000001')) > 0,
  'log_auditoria: diretoria em aal2 lê');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select throws_ok($s$ select * from api.log_auditoria() $s$, '42501', null, 'log_auditoria: coordenação não lê');
select testes.encerrar();

-- api.status_equipe
select testes.autenticar_authenticated(testes.uid('coordenacao'), 'aal2');
select is((select count(*)::integer from api.status_equipe('b7000000-0000-4000-8000-000000000001')), 14,
  'status_equipe: coordenação vê as duas profissionais da região, 7 dias cada');
select is(
  (select status::text from api.status_equipe('b7000000-0000-4000-8000-000000000001')
    where profissional_id = 'd7000000-0000-4000-8000-000000000001' limit 1), 'reservada',
  'status_equipe: titular aceita de família aguardando nascimento na janela da DPP = reservada');
select is(
  (select status::text from api.status_equipe('b7000000-0000-4000-8000-000000000001')
    where profissional_id = 'd7000000-0000-4000-8000-000000000002' limit 1), 'oferta_pendente',
  'status_equipe: designação oferecida sem resposta = oferta_pendente');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select is((select count(distinct profissional_id)::integer from api.status_equipe(null)), 1,
  'status_equipe: a enfermeira vê só o próprio estado');
select testes.encerrar();

-- api.transicionar
select testes.autenticar_authenticated(testes.uid('comercial'), 'aal1');
select is(api.transicionar('p1', 'c7000000-0000-4000-8000-000000000021', 'em_conversa_ia') ->> 'para', 'em_conversa_ia',
  'transicionar: comercial em aal1 anda o pipeline 1');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('marketing'), 'aal2');
select throws_ok($s$ select api.transicionar('p1', 'c7000000-0000-4000-8000-000000000021', 'qualificado') $s$, '42501', null,
  'transicionar: marketing não muda estágio');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select is(api.transicionar('visita', 'd7000000-0000-4000-8000-000000000021', 'confirmada') ->> 'para', 'confirmada',
  'transicionar: enfermeira confirma a própria visita');
select throws_ok($s$ select api.transicionar('visita', 'd7000000-0000-4000-8000-000000000022', 'confirmada') $s$, '42501', null,
  'transicionar: enfermeira não mexe na visita de outra profissional');
select testes.encerrar();
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal1');
select throws_ok($s$ select api.transicionar('visita', 'd7000000-0000-4000-8000-000000000021', 'a_caminho') $s$, '42501', null,
  'transicionar: enfermeira em aal1 é recusada');
select testes.encerrar();


-- -----------------------------------------------------------------------------
-- 5. privado.familias_atribuidas: prazo e desativação (PRD 13 [v4.2])
-- -----------------------------------------------------------------------------

-- A1 (família F1) até encerrado, pelo caminho das transições automáticas
do $$
declare
  v_estado text;
begin
  foreach v_estado in array array['ativo', 'em_execucao', 'ultima_visita_realizada', 'pendencias', 'encerrado'] loop
    perform privado.transicionar('acompanhamento', 'd7000000-0000-4000-8000-000000000011', v_estado);
  end loop;
end $$;

-- sem data de encerramento: vale a data da transição (hoje)
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select ok('c7000000-0000-4000-8000-000000000001'::uuid in (select privado.familias_atribuidas()),
  'encerrado hoje, sem data de encerramento: vale a data da transição, acesso mantido');
select testes.encerrar();

update acompanhamento set encerramento = (now() at time zone 'America/Sao_Paulo')::date - 7
 where id = 'd7000000-0000-4000-8000-000000000011';
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select ok('c7000000-0000-4000-8000-000000000001'::uuid in (select privado.familias_atribuidas()),
  'encerrado há 7 dias: a enfermeira ainda lê (fechar a evolução)');
select lives_ok($s$ select api.ficha_assistencial('c7000000-0000-4000-8000-000000000001') $s$,
  'encerrado há 7 dias: a ficha ainda abre');
select testes.encerrar();

update acompanhamento set encerramento = (now() at time zone 'America/Sao_Paulo')::date - 8
 where id = 'd7000000-0000-4000-8000-000000000011';
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select ok('c7000000-0000-4000-8000-000000000001'::uuid not in (select privado.familias_atribuidas()),
  'encerrado há 8 dias: a enfermeira perde o acesso');
select throws_ok($s$ select api.ficha_assistencial('c7000000-0000-4000-8000-000000000001') $s$, '42501', null,
  'encerrado há 8 dias: a ficha é negada');
select is((select count(*)::integer from acompanhamento where familia_id = 'c7000000-0000-4000-8000-000000000001'), 0,
  'encerrado há 8 dias: o acompanhamento some do select direto');
select is((select count(*)::integer from visita), 0, 'encerrado há 8 dias: a visita some também');
select testes.encerrar();

-- parâmetro ausente vale 0
delete from parametro where chave = 'acesso_enfermeira_pos_encerramento_dias';
update acompanhamento set encerramento = (now() at time zone 'America/Sao_Paulo')::date - 1
 where id = 'd7000000-0000-4000-8000-000000000011';
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select ok('c7000000-0000-4000-8000-000000000001'::uuid not in (select privado.familias_atribuidas()),
  'sem o parâmetro, o prazo é zero: encerrado ontem já não dá acesso');
select ok('c7000000-0000-4000-8000-000000000003'::uuid in (select privado.familias_atribuidas()),
  'acompanhamento em andamento (F3) continua atribuído');
select testes.encerrar();

-- profissional desativada perde tudo na hora
update profissional set ativa = false where id = 'd7000000-0000-4000-8000-000000000001';
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select is((select count(*)::integer from privado.familias_atribuidas()), 0,
  'profissional desativada: nenhuma família atribuída, na hora');
select throws_ok($s$ select api.ficha_assistencial('c7000000-0000-4000-8000-000000000003') $s$, '42501', null,
  'profissional desativada: a ficha é negada');
select testes.encerrar();
update profissional set ativa = true where id = 'd7000000-0000-4000-8000-000000000001';

-- perfil desativado também
update perfil set ativo = false where id = testes.uid('enfermeira');
select testes.autenticar_authenticated(testes.uid('enfermeira'), 'aal2');
select is((select count(*)::integer from privado.familias_atribuidas()), 0, 'perfil desativado: nenhuma família atribuída');
select is((select count(*)::integer from instrumento), 0, 'perfil desativado: perde todos os papéis (tem_papel)');
select testes.encerrar();
update perfil set ativo = true where id = testes.uid('enfermeira');


-- -----------------------------------------------------------------------------
-- 6. Funções executáveis, default privileges e perfil do convite
-- -----------------------------------------------------------------------------

select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'api')
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon não executa nenhuma função do projeto (nem public.ig; PRD 11.10 aceita no máximo public.ig)');

select set_eq(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'privado', 'assistencial', 'agente', 'api')
       and has_function_privilege('authenticated', p.oid, 'execute') $$,
  $$ values ('privado.tem_papel'), ('privado.familias_atribuidas'), ('privado.aal2'), ('privado.sem_acento'),
            ('api.transicionar'), ('api.familias_do_dia'), ('api.ficha_assistencial'), ('api.dados_contrato'),
            ('api.status_cobranca'), ('api.sessao_venda_gravacao'), ('api.status_equipe'),
            ('api.marketing_leads_por_origem'), ('api.marketing_funil'), ('api.lead_origem'),
            ('api.log_auditoria'),
            ('api.acionar_freio'), ('api.desfazer_freio'), ('api.justificar_freio'), ('api.reverter_freio') $$,
  'authenticated executa exatamente a lista do ADR 0002 seção 6');

select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'api' and not (p.prosecdef and coalesce(p.proconfig, '{}') @> array['search_path=""']) $$,
  'toda função de api é security definer com search_path vazio');

select ok(
  has_schema_privilege('authenticated', 'api', 'usage') and has_schema_privilege('authenticated', 'privado', 'usage')
  and not has_schema_privilege('authenticated', 'assistencial', 'usage')
  and not has_schema_privilege('authenticated', 'agente', 'usage')
  and not has_schema_privilege('anon', 'api', 'usage'),
  'usage: authenticated em api e privado, não em assistencial nem agente; anon em nenhum');

create table public.teste_padrao_p07 (id integer primary key);
select ok(
  not has_table_privilege('anon', 'public.teste_padrao_p07', 'select')
  and not has_table_privilege('authenticated', 'public.teste_padrao_p07', 'select')
  and not has_table_privilege('authenticated', 'public.teste_padrao_p07', 'insert'),
  'tabela nova de public nasce fechada para anon e authenticated (default privileges revogados)');

insert into auth.users (id, email, raw_app_meta_data)
  values ('a7000000-0000-4000-8000-000000000101', 'convite.p07@exemplo.invalid', '{"nome": "Pessoa Teste Convidada"}');
insert into auth.users (id, email)
  values ('a7000000-0000-4000-8000-000000000102', 'cadastro.p07@exemplo.invalid');
select results_eq(
  $$ select nome, (select count(*)::integer from usuario_papel where usuario_id = perfil.id)
     from perfil where id = 'a7000000-0000-4000-8000-000000000101' $$,
  $$ values ('Pessoa Teste Convidada'::text, 0) $$,
  'convite da diretoria (nome em raw_app_meta_data) cria o perfil, sem papel');
select is_empty(
  $$ select 1 from perfil where id = 'a7000000-0000-4000-8000-000000000102' $$,
  'cadastro sem convite não vira perfil');

select * from finish();

rollback;
