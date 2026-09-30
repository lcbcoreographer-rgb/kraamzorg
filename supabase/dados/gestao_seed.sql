-- =============================================================================
-- gestao_seed.sql
--
-- Fase 3 de gestão · P45, P46 e P52 (migration 0026_gestao.sql) · PRD 3.4,
-- 10.1, 10.2, 12, 13 e 16.2.
--
-- Parâmetros e a ligação da automação sobrevenda. Só dado sintético ou de
-- configuração; nada de família, pessoa ou valor real. Cada item que o PRD
-- marca como [confirmar] entra com o padrão mais seguro e a descrição diz quem
-- confirma.
-- =============================================================================

insert into parametro (chave, valor, descricao) values
  ('capacidade_modelo', '"probabilistico"',
   'P45, PRD 10.2: probabilistico usa a distribuição do nascimento em relação à DPP; uniforme volta à janela da Fase 1 (janela_dpp_dias). Trocar é decisão da diretoria.'),
  ('distribuicao_nascimento',
   ('{"versao":"referencia-2026-09",'
    '"descricao":"Distribuição de referência do nascimento em relação à DPP (dias antes ou depois de 40 semanas). Proposta do desenho do P45, sem fonte citada: concentra os nascimentos entre 38 e 40 semanas, com cauda de pré-termo tardio e de pós-data. Vale só até haver histórico próprio; a Edilaine e o Leonardo validam ou trocam os pesos [confirmar: Edilaine e Leonardo].",'
    '"historico_minimo":30,'
    '"deslocamento_inicio_dias":2,'
    '"intervalo_provavel_pct":95,'
    '"faixas":['
      '{"de":-56,"ate":-43,"peso":1.5},'
      '{"de":-42,"ate":-22,"peso":6.5},'
      '{"de":-21,"ate":-15,"peso":10},'
      '{"de":-14,"ate":-8,"peso":20},'
      '{"de":-7,"ate":-1,"peso":27},'
      '{"de":0,"ate":6,"peso":22},'
      '{"de":7,"ate":13,"peso":10},'
      '{"de":14,"ate":20,"peso":3}'
    ']}')::jsonb,
   'P45, PRD 10.2: faixas de dias do nascimento em relação à DPP com o peso de cada uma (soma 100), o mínimo de partos próprios para trocar a referência pelo histórico, os dias entre o nascimento e o início do atendimento (alta) e o intervalo provável usado na disponibilidade do agente.'),
  ('sobrevenda_prob_pct', '10',
   'P45, PRD 10.1: probabilidade (em %) de passar do limite de famílias por semana da região a partir da qual a semana é sobrevenda e a diretoria é avisada [confirmar: Leonardo].'),
  ('capacidade_semanas_painel', '8',
   'P45, PRD 16.2: quantas semanas a tela de capacidade e o painel mostram.'),
  ('backup_reserva_profissionais', '1',
   'P45, PRD 3.4: quantas profissionais livres precisam sobrar, além das famílias do pior caso razoável (P90), para a região ter cobertura de backup [confirmar: Edilaine].'),
  ('pagamento_equipe',
   '{"valor_hora_padrao_centavos":10000,"dias_por_ajuda":6}',
   'P46, PRD 3.4: valor da hora quando a profissional não tem valor próprio (R$ 100, igual para todas) e o bloco de dias do pacote que uma ajuda de deslocamento cobre (R$ 100 por pacote de 6 dias; 12 dias contam duas ajudas) [confirmar: Leonardo].'),
  ('financeiro',
   '{"janela_extrato_dias":3,"janela_sugestao_dias":30,"extrato_max_linhas":2000,"faixas_inadimplencia_dias":[7,30],"previsao_meses":3,"serie_meses":6,"despesa_max_centavos":100000000}',
   'P46: tolerância em dias para casar linha do extrato com cobrança paga ou despesa, dias depois do vencimento em que um crédito ainda sugere uma cobrança em aberto, máximo de linhas por arquivo, faixas de atraso da inadimplência, meses da previsão de recebimentos, meses da série do DRE e o teto de uma despesa lançada à mão.'),
  ('metas_kraamzorg',
   '{"contratos_mes":18,"familias_mes":18,"faturamento_mes_centavos":7560000,"nps":90}',
   'P52, PRD 16.2: metas da Kraamzorg por mês (18 contratos, 18 famílias, R$ 75.600 de faturamento, NPS 90).'),
  ('painel_executivo',
   '{"nps_amostra_minima":5}',
   'P52: menor número de respostas para o painel mostrar o NPS como número (com menos, mostra que ainda não há amostra).'),
  ('congelamento_desenvolvimento',
   '{"data":"2026-11-13","tag":"v1.0.0-rc.1"}',
   'P52, PROMPTS.md: congelamento do desenvolvimento em 13/11 com a tag da versão candidata. O painel mostra a contagem; scripts/congelar-desenvolvimento.sh cria a tag.')
on conflict (chave) do update set valor = excluded.valor, descricao = excluded.descricao;

-- Automação sobrevenda (PRD 10.1): interna, sem família, avisa a diretoria.
update automacao
   set ativa = true,
       acoes = '[{"tipo":"notificar","destino":"diretoria","prioridade":"alta"}]'::jsonb,
       descricao = 'PRD 10.1, 10.2, P45: o recálculo diário grava uma notificação à diretoria por região e semana com probabilidade de sobrevenda acima de parametro.sobrevenda_prob_pct.'
 where id = 'sobrevenda';
