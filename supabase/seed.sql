-- =============================================================================
-- supabase/seed.sql
--
-- P08 (PROMPTS.md v2) · PRD 3, 9.3, 10.1, 10.3, 11.3, 11.4, 11.11, 16.3 e 23;
-- docs/analise-evolucoes.md (seção 3)
--
-- Dado exclusivamente sintético (CLAUDE.md, "Dado real nunca sai de
-- produção"). Nomes de família, pessoa, bebê, médico e profissional sempre
-- com a palavra "Teste"; telefones sempre no formato fictício
-- +5511900000XXX (PRD 16.3). Conferido por supabase/checar-seed.mjs
-- (comando no fim deste arquivo e no relatório da sessão).
--
-- Aplicado por scripts/resetar.sh (sem-docker) ou "supabase db reset" DEPOIS
-- de todas as migrations, como o dono da tabela ("postgres"): os gatilhos de
-- máquina de estado (privado.proteger_estado, P06) e de autoria
-- (privado.carimbar_criado_por, P07) tratam o dono como caso especial, então
-- este arquivo pode inserir uma oportunidade, um acompanhamento ou uma
-- visita já no estágio final da história (sem ter que repetir cada
-- transição por privado.transicionar), e pode gravar criado_por como quiser.
--
-- Convenção de chave: cada bloco cria uma tabela temporária "seed_<tabela>"
-- só para amarrar referência por um apelido legível (chave text -> id uuid
-- gerado por gen_random_uuid()), sem precisar inventar UUID fixo à mão. As
-- tabelas temporárias morem só durante esta sessão do psql.
--
-- Ordem das seções (PROMPTS.md P08, "Fazer"):
--   1. Regiões, cidades (com aliases e taxa) e municípios do IBGE
--   2. Pacotes (versão vigente e uma anterior fictícia) e condições comerciais
--   3. Parâmetros (todos, inclusive os do agente e os quatro novos do v4.2)
--   4. mensagem_modelo (capítulo 23 inteiro + textos padrão da evolução)
--   5. regua_faixa e termo_alerta
--   6. automacao (catálogo do 10.1)
--   7. regra_alerta (DOC 3, Apêndice B)
--   8. Perfis de teste por papel (P07 item 8) e profissionais fictícias
--   9. Famílias, pessoas, bebês, médicos, comercial e assistencial (16.3)
--  10. Conversas fictícias por modo do agente (11.7)
-- =============================================================================

begin;

set local search_path = public, extensions;


-- =============================================================================
-- 1. Regiões, cidades e municípios (PRD 3.3, 3.4)
-- =============================================================================

create temp table seed_regiao (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_regiao (chave) values ('sp'), ('londrina'), ('futuro');

insert into regiao (id, nome, praca, taxa_deslocamento_centavos, limite_familias_semana, ativa)
select r.id, v.nome, v.praca, 0, v.limite, v.ativa
from (values
  ('sp',       'São Paulo', 'São Paulo', 5, true),
  ('londrina', 'Londrina',  'Londrina',  3, true),
  ('futuro',   'Futuro',    'Futuro (Campinas e Sorocaba, sem data, PRD 3.3)', 0, false)
) as v(chave, nome, praca, limite, ativa)
join seed_regiao r on r.chave = v.chave;

create temp table seed_cidade (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_cidade (chave) values
  ('sp_capital'), ('alphaville'), ('granja_viana'), ('santo_andre'), ('sao_bernardo'), ('sao_caetano'),
  ('barueri'), ('santana_parnaiba'), ('cotia'), ('londrina'), ('apucarana'), ('arapongas'),
  ('campinas'), ('sorocaba');

-- taxa em centavos; requer_confirmacao conforme C-01/C-02 (PRD 22.2) e 3.3
insert into cidade (id, nome, uf, regiao_id, atendida, requer_confirmacao, taxa_deslocamento_centavos, aliases, observacao)
select c.id, v.nome, v.uf, r.id, v.atendida, v.requer_confirmacao, v.taxa, v.aliases, v.observacao
from (values
  ('sp_capital', 'São Paulo', 'SP', 'sp', true, false, 0,
    array['Sampa','SP capital','Capital'],
    'Todos os bairros (PRD 3.3)'),
  ('alphaville', 'Alphaville', 'SP', 'sp', true, false, 0,
    array['Alphaville Empresarial','Alphaville Residencial','Alphaville Industrial'],
    'Barueri e Santana de Parnaíba; há profissional na região e backup em Cotia (PRD 3.3)'),
  ('granja_viana', 'Granja Viana', 'SP', 'sp', true, false, 35000,
    array['Granja Vianna','Granja Viana (Cotia)'],
    'Dentro de Cotia. R$ 350, sem confirmar (C-02, PRD 22.2)'),
  ('santo_andre', 'Santo André', 'SP', 'sp', true, true, 35000,
    array[]::text[],
    'ABC: v4.0 diz sem taxa, onboarding diz R$ 350 (C-01, PRD 22.2, ainda [confirmar])'),
  ('sao_bernardo', 'São Bernardo do Campo', 'SP', 'sp', true, true, 35000,
    array['SBC','São Bernardo'],
    'ABC: v4.0 diz sem taxa, onboarding diz R$ 350 (C-01, PRD 22.2, ainda [confirmar])'),
  ('sao_caetano', 'São Caetano do Sul', 'SP', 'sp', true, true, 35000,
    array['São Caetano'],
    'ABC: v4.0 diz sem taxa, onboarding diz R$ 350 (C-01, PRD 22.2, ainda [confirmar])'),
  ('barueri', 'Barueri', 'SP', 'sp', true, true, 0,
    array[]::text[],
    'Fora da localidade Alphaville (PRD 3.3); taxa a confirmar caso a caso'),
  ('santana_parnaiba', 'Santana de Parnaíba', 'SP', 'sp', true, true, 0,
    array[]::text[],
    'Fora da localidade Alphaville (PRD 3.3); taxa a confirmar caso a caso'),
  ('cotia', 'Cotia', 'SP', 'sp', true, true, 0,
    array[]::text[],
    'Fora da localidade Granja Viana (PRD 3.3); taxa a confirmar caso a caso'),
  ('londrina', 'Londrina', 'PR', 'londrina', true, false, 0,
    array[]::text[],
    'Todos os bairros (PRD 3.3)'),
  ('apucarana', 'Apucarana', 'PR', 'londrina', true, false, 100000,
    array[]::text[],
    'Cerca de 110 km ida e volta (PRD 3.3)'),
  ('arapongas', 'Arapongas', 'PR', 'londrina', true, false, 60000,
    array[]::text[],
    'Cerca de 75 km (PRD 3.3)'),
  ('campinas', 'Campinas', 'SP', 'futuro', false, false, 0,
    array[]::text[],
    'Futuro, sem data (PRD 3.3)'),
  ('sorocaba', 'Sorocaba', 'SP', 'futuro', false, false, 0,
    array[]::text[],
    'Futuro, sem data (PRD 3.3)')
) as v(chave, nome, uf, regiao_chave, atendida, requer_confirmacao, taxa, aliases, observacao)
join seed_cidade c on c.chave = v.chave
join seed_regiao r on r.chave = v.regiao_chave;

-- Municípios do IBGE com a região geográfica intermediária, para a
-- resposta "confirmar" de cidade fora da tabela `cidade` na mesma região
-- intermediária de uma praça atendida (PRD 3.3). Gerado por
-- scripts/baixar-municipios.mjs; ver supabase/dados/municipios_ibge.csv
-- para a origem exata (a API do IBGE está bloqueada nesta rede, então o
-- CSV atual é um subconjunto compilado à mão, documentado no próprio
-- script e no relatório da sessão -- não é a lista completa do IBGE).
insert into municipio (codigo_ibge, nome, uf, regiao_intermediaria) values
  (3503208, 'Arujá', 'SP', 'São Paulo'),
  (3509007, 'Caieiras', 'SP', 'São Paulo'),
  (3509502, 'Cajamar', 'SP', 'São Paulo'),
  (3510609, 'Carapicuíba', 'SP', 'São Paulo'),
  (3513801, 'Diadema', 'SP', 'São Paulo'),
  (3515004, 'Embu das Artes', 'SP', 'São Paulo'),
  (3515103, 'Ferraz de Vasconcelos', 'SP', 'São Paulo'),
  (3516408, 'Francisco Morato', 'SP', 'São Paulo'),
  (3516309, 'Franco da Rocha', 'SP', 'São Paulo'),
  (3518800, 'Guarulhos', 'SP', 'São Paulo'),
  (3522208, 'Itapevi', 'SP', 'São Paulo'),
  (3523107, 'Itaquaquecetuba', 'SP', 'São Paulo'),
  (3524303, 'Jandira', 'SP', 'São Paulo'),
  (3527801, 'Mairiporã', 'SP', 'São Paulo'),
  (3529401, 'Mauá', 'SP', 'São Paulo'),
  (3530607, 'Mogi das Cruzes', 'SP', 'São Paulo'),
  (3534401, 'Osasco', 'SP', 'São Paulo'),
  (3538907, 'Poá', 'SP', 'São Paulo'),
  (3543303, 'Ribeirão Pires', 'SP', 'São Paulo'),
  (3543832, 'Rio Grande da Serra', 'SP', 'São Paulo'),
  (3552502, 'Suzano', 'SP', 'São Paulo'),
  (3552205, 'Taboão da Serra', 'SP', 'São Paulo'),
  (4101408, 'Assaí', 'PR', 'Londrina'),
  (4102554, 'Bela Vista do Paraíso', 'PR', 'Londrina'),
  (4104808, 'Cambé', 'PR', 'Londrina'),
  (4111506, 'Ibiporã', 'PR', 'Londrina'),
  (4112108, 'Jataizinho', 'PR', 'Londrina'),
  (4121901, 'Rolândia', 'PR', 'Londrina'),
  (4124400, 'Sertanópolis', 'PR', 'Londrina'),
  (4127882, 'Tamarana', 'PR', 'Londrina')
on conflict (codigo_ibge) do nothing;


-- =============================================================================
-- 2. Pacotes, versão vigente e uma versão anterior fictícia (PRD 3.2, 16.3)
-- =============================================================================

create temp table seed_pacote (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_pacote (chave) values
  ('essencial'), ('imersao'), ('continuado'), ('gemelar_essencial'), ('gemelar_continuado');

insert into pacote (id, nome, linha, dias, gemelar, pagina_pdf, ordem, ativo)
select p.id, v.nome, v.linha, v.dias, v.gemelar, v.pagina_pdf, v.ordem, true
from (values
  ('essencial',          'Essencial',          'Acompanhamento diário',  6, false, 11, 1),
  ('imersao',            'Imersão',            'Presença estendida',     6, false, 11, 2),
  ('continuado',         'Continuado',         'Cuidado prolongado',    12, false, 11, 3),
  ('gemelar_essencial',  'Gemelar Essencial',  'Primeira semana',        6, true,  12, 4),
  ('gemelar_continuado', 'Gemelar Continuado', 'Duas semanas',          12, true,  12, 5)
) as v(chave, nome, linha, dias, gemelar, pagina_pdf, ordem)
join seed_pacote p on p.chave = v.chave;

-- Versão vigente desde 01/03/2026 (PRD 3.2). destaque fica nulo nos cinco
-- pacotes: o texto extraído do PDF é ambíguo sobre qual cartão leva "mais
-- escolhido" ou "recomendado" (PRD 3.2, [confirmar: Leonardo ou Drop]) e o
-- padrão adotado até a confirmação é não citar selo nenhum.
insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, parcelas_max_sem_juros,
                           destaque, vigencia_inicio, vigencia_fim)
select p.id, v.valor, v.horas, 3, null, date '2026-03-01', null
from (values
  ('essencial',          420000, 3.0),
  ('imersao',             780000, 6.0),
  ('continuado',          810000, 3.0),
  ('gemelar_essencial',   540000, 4.0),
  ('gemelar_continuado', 1030000, 4.0)
) as v(chave, valor, horas)
join seed_pacote p on p.chave = v.chave;

-- Versão anterior fictícia, encerrada antes da vigente (valores claramente
-- fictícios, nunca os valores reais da tabela de 2026): só para provar que
-- "no máximo uma versão vigente por pacote" (pacote_versao_sem_sobreposicao)
-- convive numa mesma tabela com histórico encerrado.
insert into pacote_versao (pacote_id, valor_centavos, horas_por_visita, parcelas_max_sem_juros,
                           destaque, vigencia_inicio, vigencia_fim)
select p.id, 111100, v.horas, 2, null, date '2025-01-01', date '2026-02-28'
from (values
  ('essencial', 3.0), ('imersao', 6.0), ('continuado', 3.0),
  ('gemelar_essencial', 4.0), ('gemelar_continuado', 4.0)
) as v(chave, horas)
join seed_pacote p on p.chave = v.chave;

-- Condições comerciais: "tabela única de condições" (PRD 6.3, 22.2 C-04/C-05)
insert into condicao_comercial (nome, tipo, valor, requer_aprovacao, ativa, observacao) values
  ('3x sem juros no cartão', 'parcelamento', 3.00, false, true,
   'Padrão de todos os pacotes (PRD 3.2). Exceção acima de 3x só com aprovação registrada (C-05).'),
  ('Pix à vista', 'desconto_pct', 5.00, true, true,
   'Onboarding cita 5% automático; adotado com aprovação obrigatória até confirmar (C-04, PRD 22.2).');


-- =============================================================================
-- 3. Parâmetros (PRD 3.4, 6.8, 8, 9.5, 10.2, 11.3, 22.4)
-- =============================================================================

insert into parametro (chave, valor, descricao) values
  ('agente_modo', '"desligado"',
   'PRD 11.3, 22.1 T-01: desligado em produção até a conta do WhatsApp ser restaurada e o adaptador cloud_api estar pronto. Seed local usa teste (ver observação abaixo).'),
  ('agente_whitelist', '["+5511900000001","+5511900000002"]',
   'Números autorizados no modo teste (PRD 11.7). Só dado sintético.'),
  ('agente_pausa_handoff_horas', '48',
   'PRD 11.3: pausa depois de handoff (motivos não comerciais, antes da qualificação); [confirmar].'),
  ('agente_pausa_humano_horas', '48',
   'PRD 11.3: pausa quando alguém da equipe digita pelo celular; [confirmar].'),
  ('agente_debounce_segundos', '20',
   'PRD 11.3: agrupamento de mensagens, padrão Drop.'),
  ('agente_janela_envio', '{"inicio":"08:00","fim":"20:00"}',
   'PRD 11.3: janela de envio proativo, uma mensagem de conteúdo por dia por família; [confirmar].'),
  ('grupo_whatsapp_por_destino',
   '{"comercial":"000000000-teste-comercial@g.us","coordenacao_clinica":"000000000-teste-clinico@g.us","operacao":"000000000-teste-operacao@g.us"}',
   'PRD 6.8: JIDs dos grupos internos do WhatsApp. Placeholders sintéticos, nunca um JID real.'),
  ('plantao_telefones', '["+5511900000003"]',
   'PRD 6.8: números do plantão para prioridade máxima. Só dado sintético.'),
  ('pdf_apresentacao', '{"path":"apresentacao/kraamzorg-2026-leve.pdf","nome":"Apresentação Kraamzorg 2026 (leve)","versao":"2026-03","tamanho_mb":3}',
   'PRD 6.8, 22.1 T-04: caminho no storage, nome do arquivo e versão. Placeholder: o PDF real ainda não entra no repositório.'),
  ('horarios_edilaine', 'null',
   'PRD 6.8, 22.1 T-08: opcional, campo livre de link; sem ferramenta de vídeo definida ainda.'),
  ('pdf_reenvio_janela_horas', '0',
   'PRD 6.8, 11.11 item 3, 22.2 C-18: 0 = a apresentação sempre acompanha valor, sem pular reenvio, até o Leonardo decidir o item B dos ajustes.'),
  ('taxa_visivel_agente', 'false',
   'PRD 6.8, 22.2 C-17: a Isadora nunca confirma o valor da taxa de deslocamento, só avisa que existe e passa para o comercial.'),
  ('alerta_internacao_ativo', 'false',
   'PRD 6.8, 22.3 K-16: desligado até a Edilaine aprovar o texto alerta_internacao; enquanto isso vale alerta_saude.'),
  ('alerta_emocional_ativo', 'false',
   'PRD 6.8, 22.3 K-17: desligado até a Edilaine aprovar o texto alerta_emocional; enquanto isso vale alerta_saude.'),
  ('alerta_saude_sensivel_ativo', 'false',
   '[v4.2] PRD 6.8, 22.3 K-20: desligado até a Edilaine aprovar; enquanto isso só o aviso interno de prioridade máxima.'),
  ('validador_listas',
   '{"palavras_evitadas":["mãezinha","mamãe","papai","amiga","princesa","empoderamento","transformação","milagre","vibe","energia","cura","método infalível","garantimos","última vaga","imperdível"],'
   '"promessas":["garantimos","resultado garantido","com certeza vai","prometo que"],'
   '"escassez":["última vaga","corre que acaba","só hoje","imperdível","não perca essa chance"],'
   '"pedido_dado":["cpf","rg","documento","documentos","endereço","cep","data de nascimento","e-mail","email"],'
   '"pedido_verbos":["manda","mande","mandar","me manda","passa","passe","passar","me passa","envia","envie","enviar","informa","informe","informar","preciso do","preciso da","qual é o seu","qual o seu","qual é a sua","qual a sua"],'
   '"negar_assistente":["sou humana","sou um humano","sou uma pessoa de verdade","não sou um bot","não sou um robô","não sou robô","não sou uma assistente virtual","não sou assistente virtual","não sou uma ia","não sou inteligência artificial"],'
   '"palavras_condicao":["desconto","pix","à vista","cupom","parcela","parcelas","parcelamento","parcelado"]}',
   'PRD 6.8, 11.6, 11.11 item 5: listas lidas pelo validador do fluxo 3 (n8n/src/code/validar-resposta.js, LISTAS_VALIDADOR e pedido_verbos), nunca escritas no código. pedido_dado: CPF, RG, endereço, CEP, data de nascimento, e-mail e documento (11.11 item 5), só quando a oração é pedido (verbo de pedido_verbos ou pergunta) e sem negação logo antes; negar_assistente: frases que negam ser assistente virtual (11.6); palavras_condicao: percentual perto delas reprova (desconto, Pix, à vista, cupom, parcela) [confirmar: Leonardo, listas completas].'),
  ('score_pesos',
   '{"fit_operacional":{"peso":40,"componentes":{"cidade_atendida":1,"regiao_com_profissional":1,"dpp_com_capacidade":1}},'
   '"fit_comercial":{"peso":35,"componentes":{"interesse":1,"engajamento":1,"sessao_agendada":1,"parceiro_envolvido":1}},'
   '"momento":{"peso":25,"componentes":{"trimestre":1,"proximidade_dpp":1,"bebe_nasceu":1}},'
   '"criterios":{"engajamento_mensagens":3,"trimestre":[{"semana_min":0,"valor":0},{"semana_min":14,"valor":0.5},{"semana_min":28,"valor":1}],"proximidade_dpp_dias":84}}',
   'PRD 7.1, 22.2 C-14; formato exato exigido por privado.calcular_score (P17, migration 0010): três eixos com peso e componentes de 0 a 1, mais os critérios de cada componente [confirmar: Leonardo, pesos internos e critérios].'),
  ('score_cortes', '{"quente":70,"morno":40}',
   'PRD 7.1, 22.2 C-14: cortes de quente, morno e frio no score (quente >= 70, morno 40 a 69, frio < 40; decisão do Leonardo).'),
  ('deduplicacao', '{"limiar_nome":0.6,"dpp_dias":14,"nova_gestacao_dias":180}',
   'PRD 6.10 regra 2 e 12; formato exigido por privado.buscar_duplicatas (P17, migration 0010) [confirmar: Leonardo, limiar_nome e nova_gestacao_dias].'),
  ('capacidade_alerta_pct', '85',
   'PRD 3.4, 16.3: limite de alerta de ocupação, motor de capacidade.'),
  ('janela_dpp_dias', '{"antes":21,"depois":14}',
   'PRD 10.2, 16.3: janela em que a data de início é distribuída (DPP -21 a +14 dias), ocupação projetada da Fase 1.'),
  ('handoff_matriz',
   ('[' ||
   '{"motivo":"contratar","destino":"comercial","prioridade":"alta","sla_horas_uteis":2},' ||
   '{"motivo":"reuniao","destino":"comercial","prioridade":"alta","sla_horas_uteis":2},' ||
   '{"motivo":"condicao_comercial","destino":"comercial","prioridade":"normal","sla_horas_uteis":4},' ||
   '{"motivo":"cobertura_taxa","destino":"comercial","prioridade":"normal","sla_horas_uteis":4},' ||
   '{"motivo":"reembolso_fiscal","destino":"comercial","prioridade":"normal","sla_horas_uteis":4},' ||
   '{"motivo":"duvida_sem_resposta","destino":"comercial","prioridade":"normal","sla_horas_uteis":4},' ||
   '{"motivo":"pediu_humano","destino":"comercial","prioridade":"alta","sla_horas_uteis":1},' ||
   '{"motivo":"bebe_nasceu","destino":"operacao","prioridade":"alta","sla_horas":1},' ||
   '{"motivo":"pos_venda_operacao","destino":"operacao","prioridade":"normal","sla_horas":4},' ||
   '{"motivo":"saude","destino":"coordenacao_clinica","prioridade":"maxima","sla":"imediato"},' ||
   '{"motivo":"perda","destino":"coordenacao_clinica","prioridade":"maxima","sla":"imediato","freio":"bloqueio_total"},' ||
   '{"motivo":"reclamacao","destino":"coordenacao_clinica","prioridade":"alta","sla_horas":2},' ||
   '{"motivo":"parceiro_medico","destino":"comercial","prioridade":"normal","sla_dias":1},' ||
   '{"motivo":"estado_sensivel_escreveu","destino":"coordenacao_clinica","prioridade":"alta","sla_horas":1},' ||
   '{"motivo":"midia_recebida","destino":"comercial","prioridade":"normal","sla_horas_uteis":4,"se_cliente":{"destino":"operacao","prioridade":"alta","sla_horas":2},"se_atendimento":{"destino":"coordenacao_clinica","prioridade":"alta","sla_horas":2},"observacao":"operação se for cliente, alta, 2h; pipeline 3 vai para coordenação clínica [confirmar Edilaine]"},' ||
   '{"motivo":"validacao_resposta","destino":"comercial","prioridade":"alta","sla_horas_uteis":1},' ||
   '{"motivo":"audio_nao_transcrito","destino":"coordenacao_clinica","prioridade":"alta","sla_horas_corridas":1,"se_nao_cliente":{"destino":"comercial"},"observacao":"comercial nos demais casos [confirmar Edilaine]"},' ||
   '{"motivo":"outro","destino":"comercial","prioridade":"normal","sla_horas_uteis":4}' ||
   ']')::jsonb,
   'PRD 11.4: tabela de handoff (situação, motivo, destino, prioridade, SLA), editável sem deploy. [v4.2] se_cliente, se_atendimento (pipeline 3 em curso) e se_nao_cliente sobrepõem destino, prioridade e SLA da linha (agente.registrar_handoff, P22).'),
  ('expediente_comercial', '{"dias":["seg","ter","qua","qui","sex"],"inicio":"09:00","fim":"18:00","fuso":"America/Sao_Paulo"}',
   'PRD 11.4: SLA em horas úteis usa este expediente [confirmar].'),
  ('retencao_audio_dias', '90',
   'PRD 22.4 O-03: retenção de áudio, 90 dias após o envio da evolução.'),
  ('prazos_relatorio', '{"alerta_dias":1,"escala_coordenacao_dias":2}',
   'PRD 9.5: a enfermeira tem 1 dia útil após o encerramento para emitir a evolução; alerta em D+1, escala em D+2.'),
  ('agente_followup_horas', '48',
   '[v4.2] PRD 4.1 D-18, 11.3, 6.8: primeiro retorno da Isadora depois de tanto tempo sem resposta. Padrão 48, mínimo 24 (a função de gravação recusa valor menor) [confirmar: Leonardo, valor padrão].'),
  ('acesso_enfermeira_pos_encerramento_dias', '7',
   '[v4.2] PRD 13, 6.8: dias em que a enfermeira designada ainda lê a família depois do encerramento, para fechar a evolução [confirmar: Edilaine, prazo].'),
  ('retencao', '{"chat_memoria_dias":180,"conversa_nao_cliente_meses":24,"log_ip_meses":12}',
   '[v4.2] PRD 6.8, 10.1, 22.4 O-06: prazos da automação retencao_diaria [confirmar: Leonardo e jurídico].'),
  ('freio_desfazer_segundos', '10',
   '[v4.2] PRD 6.8, 8.3, 20.6, 22.4 O-07: janela do "Desfazer" do freio para quem acionou; 0 desliga [confirmar: Leonardo e Edilaine].'),
  ('comercial_resposta_no_app', 'false',
   '[v4.2] PRD 6.8, 20.6, 22.2 C-19: com falso, a conversa assumida é respondida no WhatsApp do aparelho [confirmar: Leonardo].'),
  ('sessao_sem_agenda_horas', '24',
   'PRD 10.1, P20: horas sem handoff depois do marco sessao_interesse até a automação sessao_sem_agenda materializar a tarefa agendar_sessao.'),
  ('automacao_rota_interna', '"http://localhost:3000/api/interno/automacao"',
   'PRD 10, 22.1, P20: base da rota que privado.chamar_rota_automacao chama por net.http_post para as ações externas do motor de automações. Placeholder local; a URL de homologação/produção é ambiente, nunca segredo real neste seed.'),
  ('handoff_dedup_minutos', '10',
   'PRD 11.4, 19.3 nó 12, Apêndice A (P22): janela em que um pedido comercial igual (mesma conversa, motivo e solicitação) não gera novo aviso, e em que saúde, perda e estado sensível reaproveitam a transferência aberta com ATUALIZAÇÃO. Ausente: nada é deduplicado.'),
  ('link_ficha_modelo', '"http://localhost:3000/familias/{familia_id}"',
   'PRD 23.3 {link_ficha} (P22): endereço da ficha da família no CRM, só com o id (nunca nome, PRD 5.2). Placeholder local; homologação e produção trocam a base.'),
  ('agente_followup_contexto_mensagens', '6',
   'PRD 19.4 nó 38 (P22): quantas mensagens recentes da própria conversa vão ao prompt do follow-up (isadora-followup.md). 0 = nenhuma.'),
  ('handoff_motivos_legiveis',
   '{"cobertura_taxa":"DÚVIDA DE ÁREA OU TAXA","reembolso_fiscal":"REEMBOLSO OU NOTA FISCAL","duvida_sem_resposta":"PERGUNTA SEM RESPOSTA NA BASE","pediu_humano":"PEDIU PARA FALAR COM UMA PESSOA","pos_venda_operacao":"HORÁRIO, VISITA OU ENFERMEIRA","reclamacao":"RECLAMAÇÃO","parceiro_medico":"MÉDICO, CLÍNICA OU PARCEIRO","midia_recebida":"FOTO, DOCUMENTO OU VÍDEO","validacao_resposta":"RESPOSTA BARRADA PELO VALIDADOR","audio_nao_transcrito":"ÁUDIO NÃO TRANSCRITO","outro":"OUTRO ASSUNTO PARA A EQUIPE"}',
   'PRD 23.3 {motivo_legivel} do grupo_generico (P22), a partir da coluna Situação da 11.4. Motivo sem rótulo aparece pelo código.')
on conflict (chave) do update set valor = excluded.valor, descricao = excluded.descricao;


-- =============================================================================
-- 4. mensagem_modelo (PRD capítulo 23 inteiro + textos padrão da evolução,
--    docs/analise-evolucoes.md seção 3)
--
-- Status conforme o PRD 6.8: alerta_saude, perda e fallback_confirmar vêm
-- aprovados no prompt v4.0; todo o resto nasce em rascunho, inclusive os
-- textos [clínico] e os da evolução (nenhum deles está listado como
-- aprovado no prompt), e só sobe para aprovado quando o Leonardo (comercial)
-- ou a Edilaine (clínico) aprovar pela tela do P27 (fora de escopo do P08).
-- Este é o seed de desenvolvimento, não o de homologação: no de homologação
-- (fora do escopo desta sessão) todos entram aprovados, para os testes de
-- ponta a ponta rodarem (PRD 6.8).
-- =============================================================================

-- --- 23.1 Para a família, enviadas pelo sistema ou pela Isadora -------------
insert into mensagem_modelo (chave, canal, destinatario, texto, variaveis, status, aprovado_por, aprovado_em) values
  ('alerta_saude', 'whatsapp', 'familia',
   '{nome}, pelo que você está me contando, isso precisa ser avaliado por um profissional de saúde agora. Entre em contato com seu médico ou pediatra, ou procure um serviço de urgência. Se for uma emergência, ligue para o SAMU pelo 192. Estou avisando a nossa equipe.',
   array['nome'], 'aprovado', null, now()),
  ('alerta_internacao', 'whatsapp', 'familia',
   'Sinto muito que vocês estejam passando por isso, {nome}. Estou avisando agora a nossa equipe, e a Edilaine ou o Leonardo vão falar com você por aqui.',
   array['nome'], 'rascunho', null, null),
  ('perda', 'whatsapp', 'familia',
   'Sinto muito, de coração. Se em algum momento precisar da gente, estamos aqui.',
   array[]::text[], 'aprovado', null, now()),
  ('fallback_confirmar', 'whatsapp', 'familia',
   'Essa informação eu vou confirmar com a equipe para te responder certinho, tá?',
   array[]::text[], 'aprovado', null, now()),
  ('alerta_emocional', 'whatsapp', 'familia',
   '{nome}, obrigada por me contar. O que você está sentindo merece cuidado agora, e você não precisa passar por isso sozinha. Se houver risco, ligue para o SAMU no 192 ou procure um serviço de urgência. Você também pode falar com o CVV pelo 188, a qualquer hora. Estou avisando a nossa equipe.',
   array['nome'], 'rascunho', null, null),
  ('midia_recebida', 'whatsapp', 'familia',
   'Recebi. Vou pedir para alguém da equipe olhar e te responder por aqui.',
   array[]::text[], 'rascunho', null, null),
  ('nao_lead_candidata', 'whatsapp', 'familia',
   'Que bom saber do seu interesse em fazer parte da equipe 🤍 As candidaturas chegam pelo e-mail contato@kraamzorgbrasil.com.br. Manda por lá o seu currículo e conta um pouco da sua experiência com mãe e bebê.',
   array[]::text[], 'rascunho', null, null),
  ('nao_lead_fornecedor', 'whatsapp', 'familia',
   'Obrigada pelo contato! Propostas de parceria e fornecimento são recebidas pelo e-mail contato@kraamzorgbrasil.com.br.',
   array[]::text[], 'rascunho', null, null),
  ('nao_lead_consultorio', 'whatsapp', 'familia',
   'Oi! Este número é só da Kraamzorg Brasil, o cuidado pós-parto em casa. Para assuntos do consultório, o caminho é o contato do próprio consultório.',
   array[]::text[], 'rascunho', null, null),
  ('followup_d1_pos_pdf', 'whatsapp', 'familia',
   'Oi, {nome} 😊 Conseguiu ver a apresentação com calma? Se ficou alguma dúvida sobre os formatos, me conta.',
   array['nome'], 'rascunho', null, null),
  ('followup_d1_pos_abertura', 'whatsapp', 'familia',
   'Oi! Vi que você entrou em contato com a Kraamzorg Brasil 🤍 Se ainda fizer sentido conhecer o nosso cuidado pós-parto, me conta de quantas semanas você está.',
   array[]::text[], 'rascunho', null, null),
  ('audio_nao_transcrito', 'whatsapp', 'familia',
   'Não consegui ouvir o seu áudio agora. Pode me escrever? Se for algo urgente com você ou com o bebê, procure um serviço de urgência ou ligue para o SAMU pelo 192.',
   array[]::text[], 'rascunho', null, null),
  ('alerta_saude_sensivel', 'whatsapp', 'familia',
   '{nome}, isso precisa ser avaliado agora. Procure um serviço de urgência ou ligue para o SAMU pelo 192. A equipe já está sabendo.',
   array['nome'], 'rascunho', null, null);

-- --- 23.2 Para a família, tarefas com texto sugerido enviadas por uma pessoa
insert into mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  ('followup_d3', 'whatsapp', 'familia',
   'Oi, {nome}! Se ajudar na decisão, a Edilaine pode conversar com vocês uns 15 minutos e mostrar como o cuidado funciona na rotina de vocês. Me passa dois dias e horários bons que eu vejo com ela?',
   array['nome'], 'rascunho'),
  ('followup_d14', 'whatsapp', 'familia',
   'Oi, {nome}! Quero respeitar o tempo de vocês 🤍 Prefere que eu te chame mais perto da sua DPP, ou que você fale com a gente quando sentir que é o momento?',
   array['nome'], 'rascunho'),
  ('sem_resposta_abertura_2', 'whatsapp', 'familia',
   'Oi! Se você ainda quiser saber como funciona a Kraamzorg, vai ser um prazer te explicar por aqui.',
   array[]::text[], 'rascunho'),
  ('lembrete_sessao', 'whatsapp', 'familia',
   'Oi, {nome}! Amanhã, às {hora}, é a sua conversa com a Edilaine 😊 O acesso é este: {link}. Se precisar mudar o horário, é só me avisar por aqui.',
   array['nome','hora','link'], 'rascunho'),
  ('nao_compareceu', 'whatsapp', 'familia',
   'Imagino que tenha surgido algum imprevisto, acontece. Se quiser, a gente remarca. Me passa dois dias e horários que ficam bons para vocês?',
   array[]::text[], 'rascunho'),
  ('pos_sessao_48h', 'whatsapp', 'familia',
   'Oi, {nome}! Que bom que vocês conversaram com a Edilaine. Ficou alguma dúvida?',
   array['nome'], 'rascunho'),
  ('formulario_contrato', 'whatsapp', 'familia',
   'Oi, {nome}, aqui é o Leonardo. Que bom ter vocês com a gente! Para eu preparar o contrato, preenche os dados neste formulário seguro, leva uns 3 minutos: {link}. Depois disso o contrato chega por e-mail pela Autentique, a plataforma de assinatura, e pode abrir com tranquilidade.',
   array['nome','link'], 'rascunho'),
  ('link_pagamento', 'whatsapp', 'familia',
   'Contrato assinado, obrigado! Aqui está o link de pagamento: {link}. Dá para pagar no cartão em até 3x sem juros ou no Pix.',
   array['link'], 'rascunho'),
  ('pagamento_confirmado', 'whatsapp', 'familia',
   'Pagamento confirmado, {nome}. Obrigado pela confiança. Por volta das 34 semanas a Edilaine vai te chamar para o pré-natal online, e é nesse encontro que vocês montam juntos o plano de cuidado.',
   array['nome'], 'rascunho'),
  ('pagamento_confirmado_34s', 'whatsapp', 'familia',
   'Pagamento confirmado, {nome}. Obrigado pela confiança. Como você já está com {semanas} semanas, a Edilaine vai te chamar nos próximos dias para marcar o pré-natal online.',
   array['nome','semanas'], 'rascunho'),
  ('regua_ate_20', 'whatsapp', 'familia',
   'Oi, {nome}, aqui é da Kraamzorg Brasil 🤍 Como está a gestação? Quando quiser entender como funciona o cuidado nos primeiros dias em casa, é só me chamar por aqui.',
   array['nome'], 'rascunho'),
  ('regua_21_27', 'whatsapp', 'familia',
   'Oi, {nome}! Com {semanas} semanas muita família começa a pensar em como vão ser os primeiros dias depois da alta. Se quiser, te mando a nossa apresentação para você conhecer o cuidado com calma.',
   array['nome','semanas'], 'rascunho'),
  ('regua_28_34', 'whatsapp', 'familia',
   'Oi, {nome}! Você está entrando na janela ideal para reservar o pós-parto, entre 28 e 36 semanas. Se fizer sentido, a Edilaine conversa com vocês uns 15 minutos, sem compromisso, e quem for estar com você nesses dias pode participar também. Me passa dois dias e horários que ficam bons para vocês?',
   array['nome'], 'rascunho'),
  ('regua_35_mais', 'whatsapp', 'familia',
   'Oi, {nome}! A chegada do bebê está pertinho 🤍 Se vocês ainda estiverem pensando no cuidado para os primeiros dias em casa, me conta a DPP e a cidade que eu vejo agora com a equipe como fica para vocês.',
   array['nome'], 'rascunho'),
  ('regua_nasceu', 'whatsapp', 'familia',
   'Parabéns pela chegada do bebê! 👶 Como vocês estão, já em casa com o bebê? Vou ver com a equipe a possibilidade de começar o acompanhamento com vocês.',
   array[]::text[], 'rascunho'),
  ('checkin_dpp', 'whatsapp', 'familia',
   'Oi, {nome}! A data prevista está chegando e a gente já está organizada para receber vocês 🤍 Quando o bebê nascer, avisa a gente por aqui? A primeira visita é marcada a partir da previsão de alta, então pode contar isso junto, se já souber.',
   array['nome'], 'rascunho'),
  ('parabens_nascimento', 'whatsapp', 'familia',
   'Que alegria, parabéns pela chegada de {bebe}! 🤍 Quando souberem a previsão de alta, me contam? A {enfermeira} já está avisada.',
   array['bebe','enfermeira'], 'rascunho'),
  ('alta_boas_vindas', 'whatsapp', 'familia',
   'Bem-vindos em casa! 🤍 A {enfermeira} chega {dia}, às {hora}. Te mandei o guia de início do acompanhamento para vocês olharem com calma.',
   array['enfermeira','dia','hora'], 'rascunho'),
  ('pesquisa_convite', 'whatsapp', 'familia',
   'Oi, {nome}! A gente gostou muito de acompanhar vocês nesses dias 🤍 Quer contar como foi? São poucas perguntas e a sua resposta ajuda a cuidar melhor das próximas famílias: {link}',
   array['nome','link'], 'rascunho'),
  ('promotor_depoimento', 'whatsapp', 'familia',
   'Que bom ler isso, {nome} 🤍 Se você topar, a gente gostaria de compartilhar o seu relato com outras famílias que estão esperando bebê. Você autoriza usar o seu depoimento com o seu primeiro nome?',
   array['nome'], 'rascunho'),
  ('promotor_indicacao', 'whatsapp', 'familia',
   'E se você conhecer alguém que está esperando bebê, pode passar o nosso contato. Vai ser um carinho enorme cuidar de mais uma família que chega por você.',
   array[]::text[], 'rascunho');

-- --- 23.3 Para a equipe (grupos internos do WhatsApp) -----------------------
insert into mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  ('grupo_saude', 'whatsapp', 'equipe',
   '🚨 SAÚDE · PRIORIDADE MÁXIMA / Família: {nome} · {telefone} / O que escreveu: "{texto_familia}" / Momento: {estagio} · {semanas} / A família recebeu: "{mensagem_enviada}" / A Isadora está pausada. / Assumir agora: {link_ficha}',
   array['nome','telefone','texto_familia','estagio','semanas','mensagem_enviada','link_ficha'], 'rascunho'),
  ('grupo_perda', 'whatsapp', 'equipe',
   '[SENSÍVEL] Notícia de perda / Família: {nome} · {telefone} / O que escreveu: "{texto_familia}" / {observacao} / Freio em bloqueio total, nenhuma automação sai para essa família. / Contato só nominal: {link_ficha}',
   array['nome','telefone','texto_familia','observacao','link_ficha'], 'rascunho'),
  ('grupo_contratar', 'whatsapp', 'equipe',
   '🤍 QUER CONTRATAR / {resumo_interno} / Próximo passo: formulário seguro, contrato e link. / {link_ficha}',
   array['resumo_interno','link_ficha'], 'rascunho'),
  ('grupo_reuniao', 'whatsapp', 'equipe',
   '📅 QUER A CONVERSA COM A EDILAINE / Opções que a família passou: {opcoes} / {resumo_interno} / {link_ficha}',
   array['opcoes','resumo_interno','link_ficha'], 'rascunho'),
  ('grupo_condicao', 'whatsapp', 'equipe',
   '💬 CONDIÇÃO COMERCIAL / Pedido: {solicitacao} / {resumo_interno} / {link_ficha}',
   array['solicitacao','resumo_interno','link_ficha'], 'rascunho'),
  ('grupo_bebe_nasceu', 'whatsapp', 'equipe',
   '👶 NASCIMENTO OU INTERNAÇÃO / {nome}: "{texto_familia}" / {estagio} · enfermeira: {enfermeira} / {link_ficha}',
   array['nome','texto_familia','estagio','enfermeira','link_ficha'], 'rascunho'),
  ('grupo_estado_sensivel', 'whatsapp', 'equipe',
   '[SENSÍVEL] Família em estado sensível escreveu / {nome}: "{texto_familia}" / Responder de forma nominal. / {link_ficha}',
   array['nome','texto_familia','link_ficha'], 'rascunho'),
  ('grupo_generico', 'whatsapp', 'equipe',
   '💬 {motivo_legivel} / {resumo_interno} / {link_ficha}',
   array['motivo_legivel','resumo_interno','link_ficha'], 'rascunho'),
  -- Complementos [v4.2] do 23.3, montados por agente.registrar_handoff (P22)
  ('grupo_rodape_pausa', 'whatsapp', 'equipe',
   'IA pausada por {pausa_horas} h nesta conversa.',
   array['pausa_horas'], 'rascunho'),
  ('grupo_rodape_humano_comercial', 'whatsapp', 'equipe',
   'A Isadora não volta a esta conversa. Para devolver, use Devolver à Isadora na ficha.',
   array[]::text[], 'rascunho'),
  ('grupo_prefixo_atualizacao', 'whatsapp', 'equipe',
   'ATUALIZAÇÃO · ',
   array[]::text[], 'rascunho'),
  ('grupo_mensagem_nao_enviada', 'whatsapp', 'equipe',
   'nenhuma mensagem saiu, responder agora',
   array[]::text[], 'rascunho'),
  ('grupo_observacao_perda_anterior', 'whatsapp', 'equipe',
   'Pode ser perda de gestação anterior: confira com a família e reverta o freio se for o caso.',
   array[]::text[], 'rascunho'),
  ('resumo_ia_fora_do_ar', 'whatsapp', 'equipe',
   'IA fora do ar, responder a família',
   array[]::text[], 'rascunho');

-- --- 23.4 Para o agente (instruções devolvidas pelo fluxo 2) ----------------
insert into mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  ('instrucao_reuniao', 'whatsapp', 'agente',
   'A equipe foi avisada. Diga com leveza que você vai conferir a agenda da Edilaine com a equipe e que a resposta vem por aqui. Não confirme dia nem horário.',
   array[]::text[], 'rascunho'),
  ('instrucao_contratar', 'whatsapp', 'agente',
   'A equipe foi avisada. Comemore a decisão e diga que o Leonardo vai seguir com eles, começando por um formulário seguro para os dados do contrato. Não peça nenhum dado.',
   array[]::text[], 'rascunho'),
  ('instrucao_condicao', 'whatsapp', 'agente',
   'Diga que essa condição quem confirma é o Leonardo e que ele vai falar com a família por aqui. Não mencione percentuais nem parcelas.',
   array[]::text[], 'rascunho'),
  ('instrucao_bebe_nasceu', 'whatsapp', 'agente',
   'Parabenize com carinho e diga que a equipe já foi avisada e vai falar com vocês por aqui. Não confirme início do atendimento nem prometa prazo.',
   array[]::text[], 'rascunho'),
  ('instrucao_generica', 'whatsapp', 'agente',
   'Diga de forma leve que vai pedir para a equipe confirmar isso e que a resposta vem por aqui. Não prometa prazo.',
   array[]::text[], 'rascunho'),
  ('instrucao_sem_aviso', 'whatsapp', 'agente',
   'Não é assunto para a equipe. Nada foi registrado. Continue a conversa normalmente e não diga que vai transferir.',
   array[]::text[], 'rascunho'),
  ('instrucao_nao_lead', 'whatsapp', 'agente',
   'Esta conversa não é de uma família interessada no cuidado. Responda só com este encaminhamento, sem mudar nada: {texto_encaminhamento}',
   array['texto_encaminhamento'], 'rascunho'),
  ('instrucao_erro', 'whatsapp', 'agente',
   'Não foi possível registrar agora. Diga que vai pedir para a equipe olhar e não prometa prazo.',
   array[]::text[], 'rascunho'),
  ('instrucao_saude', 'whatsapp', 'agente',
   'A mensagem aprovada já foi enviada pelo sistema e a equipe foi avisada. Responda só [SILENCIO].',
   array[]::text[], 'rascunho'),
  -- Apêndice A [v4.2], sincronizar_memoria papel equipe: prefixo da fala da
  -- equipe na memória do agente (nunca vai à família)
  ('memoria_prefixo_equipe', 'whatsapp', 'agente',
   'Mensagem enviada pela equipe: ',
   array[]::text[], 'rascunho');

-- --- 23.5 Para médicos -------------------------------------------------------
insert into mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  ('email_evolucao_assunto', 'email', 'medico',
   'Evolução de enfermagem · Kraamzorg Brasil',
   array[]::text[], 'rascunho'),
  ('email_evolucao_corpo', 'email', 'medico',
   'Olá, {tratamento} {medico}. Segue em anexo a evolução de enfermagem do acompanhamento domiciliar de {paciente}, realizado de {inicio} a {fim}, aprovada pela coordenação de enfermagem da Kraamzorg Brasil. Em caso de dúvida, fale com {coordenacao} pelo {contato}.',
   array['tratamento','medico','paciente','inicio','fim','coordenacao','contato'], 'rascunho');

-- --- Textos padrão da evolução (docs/analise-evolucoes.md seção 3) ----------
-- Chaves com prefixo evo_ (PROMPTS.md P08 item 5). Destinatário sempre
-- médico (vão para o corpo do PDF da evolução, capítulo 9.5). Todos em
-- rascunho: nenhum texto do capítulo 9.5 está na lista de "aprovado no
-- prompt v4.0" do PRD 6.8, então segue a regra geral (rascunho até
-- aprovação). Os 11 itens de orientação neonatal (seção 3 da análise)
-- entram como uma lista única (evo_neonatal_orientacoes), porque a fonte já
-- os lista como um checklist, não como parágrafos separados; os marcados
-- com * no documento de análise (os mais frequentes nos 5 casos reais)
-- ficam comentados dentro do próprio texto.
insert into mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  ('evo_puerperal_abertura', 'email', 'medico',
   'Paciente no {dia_puerperio}º dia de puerpério, apresenta-se em bom estado geral, {observacao_livre}.',
   array['dia_puerperio','observacao_livre'], 'rascunho'),
  ('evo_puerperal_estabilidade', 'email', 'medico',
   'Manteve estabilidade hemodinâmica com parâmetros dentro da normalidade durante todo o período assistencial.',
   array[]::text[], 'rascunho'),
  ('evo_puerperal_ferida_operatoria', 'email', 'medico',
   'Ferida operatória sem sinais flogísticos, em processo cicatricial, sem sangramentos nem secreção.',
   array[]::text[], 'rascunho'),
  ('evo_puerperal_edema', 'email', 'medico',
   'Apresentou melhora do edema em MMIIs ao longo da semana.',
   array[]::text[], 'rascunho'),
  ('evo_puerperal_mamas', 'email', 'medico',
   'Mamas túrgidas com produção láctea adequada para a demanda neonatal. Ausência de sinais flogísticos, calor local, endurecimento patológico ou secreções purulentas.',
   array[]::text[], 'rascunho'),
  ('evo_puerperal_lesao', 'email', 'medico',
   'A lesão de grau {grau} em {local_lesao} {lado}, identificada no início do acompanhamento, apresentou excelente resposta cicatricial após intervenções.',
   array['grau','local_lesao','lado'], 'rascunho'),
  ('evo_puerperal_dor', 'email', 'medico',
   'Paciente referiu dor inicial (escala {escala_inicial}), porém, após condutas terapêuticas, houve remissão total do quadro. Escala de dor mantida em 0 desde o {dia_remissao}º dia de acompanhamento até a presente data.',
   array['escala_inicial','dia_remissao'], 'rascunho'),
  ('evo_puerperal_eliminacoes', 'email', 'medico',
   'Sangramento vaginal (lóquios) em pequena quantidade, de aspecto acastanhado, compatível com o período fisiológico, sem odor fétido ou presença de coágulos volumosos.',
   array[]::text[], 'rascunho'),
  ('evo_puerperal_laser', 'email', 'medico',
   'Fotobiomodulação (Laserterapia): realizada aplicação para dor e reparação tecidual de lesão grau {grau} em mama {lado} no(s) dia(s) {dias} conforme protocolo.',
   array['grau','lado','dias'], 'rascunho'),
  ('evo_puerperal_ilib', 'email', 'medico',
   'Terapia ILIB: realizada nos dias {dias} para auxílio na recuperação sistêmica e controle inflamatório.',
   array['dias'], 'rascunho'),
  ('evo_puerperal_orientacoes_alta', 'email', 'medico',
   'Orientações de Alta e Conduta: foram reforçadas as orientações à paciente e ao acompanhante sobre sinais de alerta que exigem atenção ou busca por serviço médico: 1. Picos febris{item_ferida_operatoria}; 2. Aumento súbito de dor mamária ou edema/rubor localizado; 3. Aumento expressivo do sangramento vaginal ou odor forte; 4. Mal-estar generalizado ou tonturas.',
   array['item_ferida_operatoria'], 'rascunho'),
  ('evo_puerperal_encaminhamento', 'email', 'medico',
   'Encaminhada para retorno com equipe obstétrica para avaliação ({motivos}). Oriento manter medicações de uso contínuo; dieta saudável rica em fibras, ingesta hídrica abundante; programar retorno com equipe de {especialidade_retorno} que acompanha.',
   array['motivos','especialidade_retorno'], 'rascunho'),
  ('evo_puerperal_conclusao', 'email', 'medico',
   'Conclusão: atendimento finalizado nesta data conforme acordo prévio. A família evoluiu satisfatória e progressivamente na autonomia e segurança quanto aos cuidados de saúde da mulher e do bebê, incluindo a participação ativa e muito positiva d{artigo_parceiro} {parceiro} no cuidado de ambos. Lactante com {producao_lactea} produção láctea, bom manejo e segura quanto {tipo_amamentacao}. Paciente orientada a seguir o acompanhamento ambulatorial/médico conforme agendamento prévio.',
   array['artigo_parceiro','parceiro','producao_lactea','tipo_amamentacao'], 'rascunho'),
  ('evo_neonatal_titulo', 'email', 'medico',
   'Evolução de Enfermagem — RN {nome_bebe} — Data: {data}',
   array['nome_bebe','data'], 'rascunho'),
  ('evo_neonatal_periodo', 'email', 'medico',
   'Período de Acompanhamento: {inicio} a {fim} (Kraamzorg Brasil)',
   array['inicio','fim'], 'rascunho'),
  ('evo_neonatal_identificacao', 'email', 'medico',
   'Identificação: RN, sexo {sexo}, {dia_de_vida}º dia de vida; nascido por parto {tipo_parto}. Filiação: filho de {filiacao}.',
   array['sexo','dia_de_vida','tipo_parto','filiacao'], 'rascunho'),
  ('evo_neonatal_peso', 'email', 'medico',
   'Peso {data_pesagem}: {peso} g ({origem_pesagem})',
   array['data_pesagem','peso','origem_pesagem'], 'rascunho'),
  ('evo_neonatal_ganho', 'email', 'medico',
   'Ganho ponderal {classificacao_ganho}: {ganho_g} g em {dias} dias; ganho médio: {ganho_medio} g/dia',
   array['classificacao_ganho','ganho_g','dias','ganho_medio'], 'rascunho'),
  ('evo_neonatal_estado_geral', 'email', 'medico',
   'Estado geral: reativo aos estímulos, desperta facilmente ao manejo. Mucosas: úmidas e coradas. Normotérmico ({temp_min} a {temp_max}°C). Fontanela anterior: plana.',
   array['temp_min','temp_max'], 'rascunho'),
  ('evo_neonatal_ictericia', 'email', 'medico',
   'Icterícia: {intensidade}, em zona {zona_kramer} de Kramer.',
   array['intensidade','zona_kramer'], 'rascunho'),
  ('evo_neonatal_respiratorio', 'email', 'medico',
   'Sistema respiratório: eupneico, sem sinais de desconforto respiratório; FR {fr_min} a {fr_max} rpm.',
   array['fr_min','fr_max'], 'rascunho'),
  ('evo_neonatal_cardiovascular', 'email', 'medico',
   'Aparelho cardiovascular: FC {fc_min} a {fc_max} bpm. SpO2: {spo2_min} a {spo2_max}%.',
   array['fc_min','fc_max','spo2_min','spo2_max'], 'rascunho'),
  ('evo_neonatal_abdomen_coto', 'email', 'medico',
   'Abdômen: flácido, indolor à palpação. Coto umbilical: processo avançado de mumificação, seco, sem sinais flogísticos.',
   array[]::text[], 'rascunho'),
  ('evo_neonatal_alimentacao', 'email', 'medico',
   'Aleitamento {tipo_aleitamento} com sucção satisfatória.',
   array['tipo_aleitamento'], 'rascunho'),
  ('evo_neonatal_genitalia', 'email', 'medico',
   'Genitália: {descricao_genitalia}.',
   array['descricao_genitalia'], 'rascunho'),
  ('evo_neonatal_eliminacoes', 'email', 'medico',
   'Diurese e evacuações presentes (fezes em transição).',
   array[]::text[], 'rascunho'),
  ('evo_neonatal_orientacoes', 'email', 'medico',
   'Orientações e condutas: 1. Amamentação em livre demanda, com intervalos máximos de {intervalo_mamada} até segunda ordem; orientada sobre técnicas de estímulo e verificação da pega correta. 2. Orientados sinais de prontidão e saciedade para mamada.* 3. Manter cuidados com o coto umbilical (higiene a seco) até queda completa; orientados sinais de infecção.* 4. Orientado agendamento de retorno para avaliação pediátrica conforme solicitação da equipe médica. 5. Orientadas ações não farmacológicas para alívio de disquezia e acúmulo de gases. 6. Orientado Tummy Time em momento oportuno (queda do coto).* 7. Manobras de desengasgo.* 8. Rotinas e práticas para o sono seguro e higiene do sono. 9. Posturas de conforto e contenção para o bebê.* 10. Troca de fraldas e higiene do bebê, banho de imersão e no chuveiro. 11. Vestuário adequado ao clima.* (* presente nos 5 casos reais analisados; os demais variam conforme a orientação de cada dia.)',
   array['intervalo_mamada'], 'rascunho'),
  ('evo_neonatal_conclusao', 'email', 'medico',
   'Conclusão: RN estável, calmo, ativo e reativo, em evolução favorável, {tipo_aleitamento_conclusao}, apresentando {evolucao_peso}, {evolucao_ictericia}; condutas e orientações realizadas e registradas. Vínculo excelente dos pais com o bebê, com evolução progressiva da autonomia e segurança nos cuidados com {o_filho}.',
   array['tipo_aleitamento_conclusao','evolucao_peso','evolucao_ictericia','o_filho'], 'rascunho');


-- =============================================================================
-- 5. regua_faixa (PRD 10.3) e termo_alerta (PRD 11.11, 22.3 K-13)
-- =============================================================================

insert into regua_faixa (ordem, semana_min, semana_max, objetivo, gatilho_comercial, mensagem_chave) values
  (1, null, 20, 'Presença e conteúdo de valor, sem oferta', 'Nenhum', 'regua_ate_20'),
  (2, 21, 27, 'O que acontece nos primeiros dias em casa', 'Convite leve para conhecer a apresentação', 'regua_21_27'),
  (3, 28, 34, 'Janela ideal de reserva', 'Convite para a conversa com a Edilaine; disponibilidade só com dado real', 'regua_28_34'),
  (4, 35, null, 'Organização prática da chegada', 'Prioridade máxima na fila do comercial', 'regua_35_mais'),
  (5, null, null, 'Oferta adaptada, fluxo acelerado (já nasceu)', 'Encaminhamento imediato ao humano', 'regua_nasceu');

-- Dez termos aprovados no onboarding (9.6), ativos. "perdi o bebê" e
-- "perdi um bebê" com ação bloqueio_total e mensagem perda; "UTI" com
-- alerta_internacao; os demais com handoff_saude e alerta_saude. Sinônimos
-- propostos entram inativos, aguardando aprovação da Edilaine (PRD 11.11).
insert into termo_alerta (termo, acao, mensagem_chave, ativo) values
  ('sangramento', 'handoff_saude', 'alerta_saude', true),
  ('visão embaçada', 'handoff_saude', 'alerta_saude', true),
  ('dor forte', 'handoff_saude', 'alerta_saude', true),
  ('febre', 'handoff_saude', 'alerta_saude', true),
  ('falta de ar', 'handoff_saude', 'alerta_saude', true),
  ('não sinto o bebê mexer', 'handoff_saude', 'alerta_saude', true),
  ('perdi o bebê', 'bloqueio_total', 'perda', true),
  ('uti', 'handoff_saude', 'alerta_internacao', true),
  ('convulsão', 'handoff_saude', 'alerta_saude', true),
  ('pressão alta', 'handoff_saude', 'alerta_saude', true),
  -- [v4.2] 11.11 item 1 (K-21): "perdi um bebê" também bloqueia, para pegar
  -- "já perdi um bebê antes" (perda de gestação anterior), que "perdi o
  -- bebê" sozinho não cobre.
  ('perdi um bebê', 'bloqueio_total', 'perda', true),
  -- Sinônimos propostos [clínico], inativos até a Edilaine aprovar (PRD 11.11)
  ('óbito', 'bloqueio_total', 'perda', false),
  ('natimorto', 'bloqueio_total', 'perda', false),
  ('faleceu', 'bloqueio_total', 'perda', false),
  ('não resistiu', 'bloqueio_total', 'perda', false),
  ('sem batimento', 'bloqueio_total', 'perda', false),
  ('desmaiou', 'handoff_saude', 'alerta_saude', false),
  ('desmaio', 'handoff_saude', 'alerta_saude', false),
  ('ficou roxo', 'handoff_saude', 'alerta_saude', false),
  ('não respira', 'handoff_saude', 'alerta_saude', false);


-- =============================================================================
-- 6. automacao: catálogo do PRD 10.1. Fase 1 ativa (comercial, agente,
--    régua como tarefa humana, cobrança); Fase 2 e 3 inativas (só entram no
--    prompt correspondente). retencao_diaria ativa: é proteção de LGPD
--    (PRD 22.4 O-06), independente de fase.
-- =============================================================================

insert into automacao (id, nome, categoria, executor, gatilho, condicoes, acoes, ativa, descricao) values
  ('boas_vindas', 'Boas-vindas', 'conteudo', 'agente',
   '{"tipo":"mensagem_contato_desconhecido"}', '[]',
   '[{"tipo":"agente_assume"},{"tipo":"criar_conversa"},{"tipo":"criar_familia"},{"tipo":"criar_oportunidade"},{"tipo":"deduplicar"}]',
   true, 'PRD 10.1: primeira mensagem de um contato desconhecido.'),
  ('qualificacao', 'Qualificação', 'interna', 'sistema',
   '{"tipo":"dados_minimos_coletados"}', '[]',
   '[{"tipo":"calcular_score"},{"tipo":"classificar_lead"},{"tipo":"mover_pipeline"}]',
   true, 'PRD 10.1: calcula score, classifica quente/morno/frio, move o pipeline.'),
  ('followup_d1', '[v4.2] Primeiro retorno da Isadora (ID mantido por compatibilidade)', 'conteudo', 'agente',
   '{"tipo":"sem_resposta_horas","parametro":"agente_followup_horas"}',
   '[{"condicao":"conversa.agente_encerrado_em is null"},{"condicao":"nenhum handoff aberto"}]',
   '[{"tipo":"mensagem_agente","chaves":["followup_d1_pos_pdf","followup_d1_pos_abertura"]}]',
   true, 'PRD 10.1, 11.3, D-18: uma mensagem da Isadora, nunca em humano_comercial nem com handoff aberto.'),
  ('followup_d3_d14', 'Follow-up D+3 e D+14', 'conteudo', 'humano_tarefa',
   '{"tipo":"sem_resposta_dias","dias":[3,14],"contados_de":"primeiro_retorno"}', '[]',
   '[{"tipo":"criar_tarefa","tipo_tarefa":"followup_comercial","chaves":["followup_d3","followup_d14"]}]',
   true, 'PRD 10.1, 22.2 C-12: tarefa para o comercial com texto sugerido, contada do primeiro retorno da Isadora.'),
  ('lembrete_sessao', 'Lembrete da conversa com a Edilaine', 'operacional', 'humano_tarefa',
   '{"tipo":"vespera_sessao_venda"}', '[]',
   '[{"tipo":"criar_tarefa","tipo_tarefa":"agendar_sessao","chave_mensagem":"lembrete_sessao"}]',
   true, 'PRD 10.1: véspera da sessão de venda.'),
  ('regua_nutricao', 'Nutrição gestacional', 'conteudo', 'humano_tarefa',
   '{"tipo":"diario","hora_utc":"10:00","condicao":"mudou_faixa_regua"}', '[]',
   '[{"tipo":"criar_tarefa","tipo_tarefa":"nutricao_contato","payload":"lista_contatos_e_texto_sugerido"}]',
   true, 'PRD 10.1, 10.3: uma tarefa por família por mudança de faixa, nunca semanal repetida.'),
  ('retorno_combinado', 'Retorno combinado', 'conteudo', 'humano_tarefa',
   '{"tipo":"data_proximo_contato_em"}', '[]',
   '[{"tipo":"criar_tarefa","tipo_tarefa":"followup_comercial","payload":"retomada"}]',
   true, 'PRD 10.1: data de proximo_contato_em atingida.'),
  ('contrato_fechado', 'Contrato fechado', 'operacional', 'sistema',
   '{"tipo":"oportunidade_ganha"}', '[]',
   '[{"tipo":"gerar_link_formulario_seguro"},{"tipo":"gerar_contrato"},{"tipo":"enviar_autentique"},{"tipo":"aguardar_webhook"}]',
   true, 'PRD 10.1: oportunidade marcada como ganha.'),
  ('pos_assinatura', 'Pós-assinatura', 'operacional', 'sistema',
   '{"tipo":"webhook_autentique_confirmado"}', '[]',
   '[{"tipo":"gerar_cobranca"},{"tipo":"gerar_link_pagamento"}]',
   true, 'PRD 10.1: webhook do Autentique confirmado.'),
  ('pagamento_confirmado', 'Pagamento confirmado', 'operacional', 'sistema',
   '{"tipo":"webhook_infinitepay_confirmado"}', '[]',
   '[{"tipo":"baixar_cobranca"},{"tipo":"disparar_nfse"},{"tipo":"mover_pipeline"}]',
   true, 'PRD 10.1: webhook InfinitePay confirmado por consulta (payment_check).'),
  ('prenatal_urgente', 'Pré-natal urgente', 'interna', 'sistema',
   '{"tipo":"pagamento_confirmado_ig_maior_34s"}', '[]',
   '[{"tipo":"criar_tarefa","prioridade":"maxima"},{"tipo":"notificar","destino":"coordenacao"}]',
   false, 'PRD 10.1: Fase 2 (pré-natal online).'),
  ('alerta_34s', 'Alerta de 34 semanas', 'interna', 'sistema',
   '{"tipo":"diario","hora_utc":"10:00"}', '[]',
   '[{"tipo":"notificar","destino":"coordenacao"}]',
   false, 'PRD 10.1, D-10: interno, nada à família. Fase 2.'),
  ('checkin_dpp', 'Check-in de DPP', 'interna', 'humano_tarefa',
   '{"tipo":"dpp_menos_dias","dias":7}', '[]',
   '[{"tipo":"criar_tarefa"},{"tipo":"sinalizar_radar"},{"tipo":"confirmar_alocacao_backup"}]',
   false, 'PRD 10.1: sinaliza a equipe, confirma alocação e backup. Fase 2.'),
  ('dpp_sem_confirmacao', 'DPP sem confirmação', 'interna', 'sistema',
   '{"tipo":"dpp_mais_dias","dias":3}', '[]',
   '[{"tipo":"alerta_interno","prioridade":"alta"}]',
   false, 'PRD 10.1: Fase 2.'),
  ('dpp_sem_contato', 'DPP sem contato', 'interna', 'sistema',
   '{"tipo":"dpp_mais_dias","dias":10}', '[]',
   '[{"tipo":"criar_ocorrencia"}]',
   false, 'PRD 10.1: Fase 2.'),
  ('nascimento', 'Nascimento confirmado', 'operacional', 'sistema',
   '{"tipo":"data_nascimento_preenchida"}', '[]',
   '[{"tipo":"recalcular_agenda"},{"tipo":"notificar_operacao"},{"tipo":"pedir_previsao_alta"}]',
   false, 'PRD 10.1: Fase 2.'),
  ('alta', 'Alta confirmada', 'operacional', 'sistema',
   '{"tipo":"data_alta_preenchida"}', '[]',
   '[{"tipo":"ativar_acompanhamento"},{"tipo":"gerar_visitas"},{"tipo":"criar_tarefa","tipo_tarefa":"enviar_guia"},{"tipo":"notificar_profissional"}]',
   false, 'PRD 10.1: gatilho real do início do atendimento. Fase 2.'),
  ('ficha_pendente', 'Ficha pendente', 'interna', 'sistema',
   '{"tipo":"visita_concluida_sem_registro_horas","horas":6}', '[]',
   '[{"tipo":"notificar_profissional"},{"tipo":"escalar_coordenacao_horas","horas":6}]',
   false, 'PRD 10.1: Fase 2.'),
  ('alerta_clinico', 'Alerta clínico', 'interna', 'sistema',
   '{"tipo":"campo_checklist_dispara_regra"}', '[]',
   '[{"tipo":"criar_alerta"},{"tipo":"notificar_por_severidade"},{"tipo":"exigir_registro_conduta"}]',
   false, 'PRD 10.1, 9.3: DOC 3. Fase 2.'),
  ('contato_medico_pendente', 'Contato médico pendente', 'interna', 'sistema',
   '{"tipo":"ultimo_dia_concluido_sem_contato_medico"}', '[]',
   '[{"tipo":"criar_tarefa","destino":"coordenacao"},{"tipo":"bloquear_relatorio"}]',
   false, 'PRD 10.1: Fase 2.'),
  ('pesquisa', 'Pesquisa', 'marketing', 'humano_tarefa',
   '{"tipo":"protocolo_ultimo_dia_concluido"}', '[]',
   '[{"tipo":"criar_tarefa","payload":"link_pesquisa"}]',
   false, 'PRD 10.1, D-11: Fase 2.'),
  ('prazo_relatorio', 'Prazo do relatório', 'interna', 'sistema',
   '{"tipo":"encerramento_mais_dias","dias":1}', '[]',
   '[{"tipo":"alerta_enfermeira"},{"tipo":"escalar_mais_dias","dias":1}]',
   false, 'PRD 10.1, 9.5: Fase 2.'),
  ('classificacao_nps', 'Classificação NPS', 'interna', 'sistema',
   '{"tipo":"resposta_pesquisa_recebida"}', '[]',
   '[{"tipo":"classificar_nps"},{"tipo":"criar_tarefa_ou_ocorrencia"}]',
   false, 'PRD 10.1, 7.4: Fase 2.'),
  ('pagamento_atrasado', 'Pagamento atrasado', 'interna', 'sistema',
   '{"tipo":"vencimento_ultrapassado"}', '[]',
   '[{"tipo":"notificar_financeiro"},{"tipo":"criar_tarefa","tipo_tarefa":"cobranca_atraso"}]',
   true, 'PRD 10.1: parte da cobrança InfinitePay da Fase 1.'),
  ('documento_vencendo', 'Documento vencendo', 'interna', 'sistema',
   '{"tipo":"dias_do_vencimento","dias":30}', '[]',
   '[{"tipo":"notificar","destino":"coordenacao"}]',
   false, 'PRD 10.1, O-02: gestão de equipe e documentos, Fase 2.'),
  ('sobrevenda', 'Sobrevenda', 'interna', 'sistema',
   '{"tipo":"recalculo_diario_acima_limite"}', '[]',
   '[{"tipo":"alerta_diretoria"}]',
   false, 'PRD 10.1, 10.2: motor de capacidade probabilístico, Fase 3.'),
  ('contratar_sem_transferencia', 'Intenção de contratar parada', 'interna', 'sistema',
   '{"tipo":"marco_quer_contratar_sem_handoff_horas_uteis","horas":2}', '[]',
   '[{"tipo":"abrir_handoff","motivo":"contratar"}]',
   true, 'PRD 10.1, 11.8: abre o handoff com o que a ficha tiver.'),
  ('sessao_sem_agenda', 'Interesse na conversa parado', 'interna', 'sistema',
   '{"tipo":"marco_sessao_interesse_sem_handoff_horas","horas":24}', '[]',
   '[{"tipo":"criar_tarefa","tipo_tarefa":"agendar_sessao"}]',
   true, 'PRD 10.1: tarefa agendar_sessao para o comercial.'),
  ('retencao_diaria', 'Retenção de conversa e memória', 'interna', 'sistema',
   '{"tipo":"diario","executor":"pg_cron"}', '[]',
   '[{"tipo":"apagar_chat_memoria_vencida"},{"tipo":"apagar_ou_anonimizar_conversa_nao_cliente"},{"tipo":"anonimizar_ip_log_auditoria"},{"tipo":"gravar_contagens_no_log"}]',
   true, 'PRD 10.1, 22.4 O-06: aplica parametro.retencao, LGPD desde o primeiro dia.');


-- =============================================================================
-- 7. instrumento (DOC 1 a DOC 4) e regra_alerta (DOC 3, Apêndice B)
--
-- Definição JSON dos instrumentos fica para o P34 (fora de escopo do P08);
-- aqui só a versão vigente de cada um, para regra_alerta e as tabelas do
-- P34 terem o que referenciar. As sete regras que o Apêndice B credita a
-- "Fonte: DOC 3" ganham condicao preenchida; as demais ficam com condicao
-- nula e inativa até a Edilaine aprovar (PROMPTS.md P08 item 8).
-- =============================================================================

insert into instrumento (codigo, versao, definicao, vigente) values
  ('DOC1_ENTREVISTA', 'v1-2026-09', '{"blocos":[],"observacao":"definição completa fica para o P34"}', true),
  ('DOC2_CHECKLIST',  'v1-2026-09', '{"blocos":[],"observacao":"definição completa fica para o P34"}', true),
  ('DOC3_ALERTAS',    'v1-2026-09', '{"blocos":[],"observacao":"definição completa fica para o P34"}', true),
  ('DOC4_MAMADA',     'v1-2026-09', '{"blocos":[],"observacao":"definição completa fica para o P34"}', true)
-- [P34] A migration 0045_instrumentos_v1.sql já carrega a definição completa
-- da v1 com vigente = false. Aqui o seed só a marca como vigente no ambiente
-- sintético, sem trocar a definição pela provisória acima.
on conflict (codigo, versao) do update set vigente = excluded.vigente;

insert into regra_alerta (id, grupo, descricao, severidade, conduta, campo, condicao, instrumento_versao, ativa) values
  -- Puérpera (PRD 9.3)
  ('PU-01', 'puerpera', 'Febre ≥ 38 °C', 'imediato',
   'Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.',
   '2.1.temperatura', '{"campo":"2.1.temperatura","operador":">=","valor":38}', 'v1-2026-09', true),
  ('PU-02', 'puerpera', 'Sangramento vaginal intenso (encharcar 1 absorvente em menos de 1 hora)', 'imediato',
   'Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.',
   '2.loquios', null, 'v1-2026-09', false),
  ('PU-03', 'puerpera', 'Dor intensa, progressiva ou fora do esperado', 'imediato',
   'Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.',
   '2.dor', null, 'v1-2026-09', false),
  ('PU-04', 'puerpera', 'Sinais de infecção em ferida operatória (calor, vermelhidão, secreção purulenta)', 'imediato',
   'Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.',
   '2.2.ferida_operatoria', '{"campo":"2.2.sem_sinais_infeccao","operador":"=","valor":false}', 'v1-2026-09', true),
  ('PU-05', 'puerpera', 'Cefaleia intensa associada a alteração visual', 'imediato',
   'Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.',
   null, null, 'v1-2026-09', false),
  ('PU-06', 'puerpera', 'Falta de ar, dor torácica', 'imediato',
   'Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.',
   null, null, 'v1-2026-09', false),
  ('PU-07', 'puerpera', 'Mal-estar importante ou prostração', 'imediato',
   'Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.',
   null, null, 'v1-2026-09', false),
  ('PU-08', 'puerpera', 'Febre baixa persistente (< 38 °C)', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   '2.1.temperatura', null, 'v1-2026-09', false),
  ('PU-09', 'puerpera', 'Dor moderada não controlada', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   '2.dor', null, 'v1-2026-09', false),
  ('PU-10', 'puerpera', 'Aumento progressivo dos lóquios (1 absorvente saturado em 3 h de uso)', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   '2.loquios', null, 'v1-2026-09', false),
  ('PU-11', 'puerpera', 'Sinais de ingurgitamento mamário patológico sem melhora com o manejo', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   '2.5.ingurgitadas', null, 'v1-2026-09', false),
  ('PU-12', 'puerpera', 'Fissuras mamilares graves ou com sinais inflamatórios', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   '2.7.nts', null, 'v1-2026-09', false),
  -- Saúde mental materna (PRD 9.3)
  ('SM-01', 'saude_mental', 'Ideação suicida ou autoagressiva', 'imediato',
   'Não deixar a puérpera sozinha, acionar supervisão médica imediatamente e orientar busca de atendimento emergencial. Escala para a coordenação com prioridade máxima e cria ocorrência privada.',
   '7.sofrimento_emocional', null, 'v1-2026-09', false),
  ('SM-02', 'saude_mental', 'Comportamento desorganizado', 'imediato',
   'Não deixar a puérpera sozinha, acionar supervisão médica imediatamente e orientar busca de atendimento emergencial. Escala para a coordenação com prioridade máxima e cria ocorrência privada.',
   '7.sofrimento_emocional', null, 'v1-2026-09', false),
  ('SM-03', 'saude_mental', 'Desconexão importante com o bebê', 'imediato',
   'Não deixar a puérpera sozinha, acionar supervisão médica imediatamente e orientar busca de atendimento emergencial. Escala para a coordenação com prioridade máxima e cria ocorrência privada.',
   '7.sofrimento_emocional', null, 'v1-2026-09', false),
  ('SM-04', 'saude_mental', 'Tristeza intensa e persistente', 'prioritario',
   'Comunicar supervisão médica e registrar.',
   '7.sofrimento_emocional', null, 'v1-2026-09', false),
  ('SM-05', 'saude_mental', 'Ansiedade incapacitante', 'prioritario',
   'Comunicar supervisão médica e registrar.',
   '7.sofrimento_emocional', null, 'v1-2026-09', false),
  ('SM-06', 'saude_mental', 'Choro frequente sem alívio', 'prioritario',
   'Comunicar supervisão médica e registrar.',
   '7.sofrimento_emocional', null, 'v1-2026-09', false),
  ('SM-07', 'saude_mental', 'Relato de incapacidade de cuidar do bebê', 'prioritario',
   'Comunicar supervisão médica e registrar.',
   '7.sofrimento_emocional', null, 'v1-2026-09', false),
  -- Recém-nascido (PRD 9.3)
  ('RN-01', 'recem_nascido', 'Dificuldade respiratória', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   '3.respiracao', '{"campo":"3.respiracao_com_esforco","operador":"=","valor":true}', 'v1-2026-09', true),
  ('RN-02', 'recem_nascido', 'Cianose ou palidez acentuada', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   null, null, 'v1-2026-09', false),
  ('RN-03', 'recem_nascido', 'Letargia importante', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   '3.atividade', '{"campo":"3.atividade_preservada","operador":"=","valor":false}', 'v1-2026-09', true),
  ('RN-04', 'recem_nascido', 'Ausência de diurese por 4 horas ou mais', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   '3.2.diurese', '{"campo":"3.2.horas_sem_diurese","operador":">=","valor":4}', 'v1-2026-09', true),
  ('RN-05', 'recem_nascido', 'Sangue nas fezes', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   null, null, 'v1-2026-09', false),
  ('RN-06', 'recem_nascido', 'Convulsão', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   null, null, 'v1-2026-09', false),
  ('RN-07', 'recem_nascido', 'Um ou mais sinais flogísticos do coto umbilical (hiperemia, secreção purulenta ou odor fétido)', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   '3.2.coto', '{"campo":"3.2.coto_com_sinais_flogisticos","operador":"=","valor":true}', 'v1-2026-09', true),
  ('RN-08', 'recem_nascido', 'Febre (> 38 °C) ou hipotermia (< 36 °C)', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   '3.1.temperatura', '{"campo":"3.1.temperatura","operador":"fora_da_faixa","min":36,"max":38}', 'v1-2026-09', true),
  ('RN-09', 'recem_nascido', 'Recusa alimentar completa', 'imediato',
   'Acionar supervisão médica imediatamente e orientar a família a procurar emergência pediátrica.',
   null, null, 'v1-2026-09', false),
  ('RN-10', 'recem_nascido', 'Icterícia progressiva indicando fototerapia', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   '3.ictericia', null, 'v1-2026-09', false),
  ('RN-11', 'recem_nascido', 'Oligúria concentrada', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   '3.2.diurese', null, 'v1-2026-09', false),
  ('RN-12', 'recem_nascido', 'Vômitos frequentes', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   null, null, 'v1-2026-09', false),
  ('RN-13', 'recem_nascido', 'Ganho ponderal insatisfatório (quando conhecido)', 'prioritario',
   'Comunicar supervisão médica e seguir orientação.',
   '3.1.peso', null, 'v1-2026-09', false),
  -- Amamentação e mamas (PRD 9.3)
  ('AM-01', 'amamentacao', 'Mastite com sinais sistêmicos', 'imediato',
   'Suspender procedimentos eletivos (laser) e acionar supervisão médica.',
   null, null, 'v1-2026-09', false),
  ('AM-02', 'amamentacao', 'Dor intensa associada a febre', 'imediato',
   'Suspender procedimentos eletivos (laser) e acionar supervisão médica.',
   null, null, 'v1-2026-09', false),
  ('AM-03', 'amamentacao', 'Abscesso suspeito', 'imediato',
   'Suspender procedimentos eletivos (laser) e acionar supervisão médica.',
   null, null, 'v1-2026-09', false),
  ('AM-04', 'amamentacao', 'Fissuras profundas', 'prioritario',
   'Comunicar supervisão médica e avaliar consultoria especializada.',
   '2.7.nts', null, 'v1-2026-09', false),
  ('AM-05', 'amamentacao', 'Dor persistente à amamentação', 'prioritario',
   'Comunicar supervisão médica e avaliar consultoria especializada.',
   '2.6.evn', null, 'v1-2026-09', false),
  ('AM-06', 'amamentacao', 'Baixa produção percebida com impacto no RN', 'prioritario',
   'Comunicar supervisão médica e avaliar consultoria especializada.',
   '2.12.producao', null, 'v1-2026-09', false);


-- =============================================================================
-- 8. Perfis de teste por papel (PROMPTS.md P07 item 8: "um usuário de teste
--    por papel, só no seed local") e profissionais fictícias (PRD 3.4, 16.3)
-- =============================================================================

create temp table seed_perfil (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_perfil (chave) values
  ('comercial'), ('enfermeira'), ('financeiro'), ('marketing'), ('coordenacao'), ('diretoria');

insert into auth.users (id, email)
select id, chave || '.teste@kraamzorgbrasil.test' from seed_perfil;

insert into perfil (id, nome, email, telefone_e164, ativo)
select id,
       'Perfil Teste ' || initcap(chave),
       chave || '.teste@kraamzorgbrasil.test',
       case when chave = 'comercial' then '+5511900000050' else null end,
       true
from seed_perfil;

insert into usuario_papel (usuario_id, papel)
select id, chave::papel_usuario from seed_perfil;

create temp table seed_profissional (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_profissional (chave) values
  ('sul_1'), ('sul_2'), ('sul_3'), ('norte_1'), ('contratacao'), ('coordenacao');

insert into profissional (id, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero,
                          telefone_e164, regioes, vinculo, valor_hora_centavos,
                          adicional_deslocamento_centavos, ativa)
select p.id, v.usuario_id, v.nome, v.funcao, v.conselho, v.conselho_uf, v.conselho_numero,
       v.telefone, v.regioes, v.vinculo, v.valor_hora, v.adicional, v.ativa
from (
  select 'sul_1'::text as chave, null::uuid as usuario_id, 'Profissional Teste Sul 1' as nome,
         'enfermeira_obstetrica'::text as funcao, 'COREN'::text as conselho, 'SP'::char(2) as conselho_uf,
         'TESTE-SP-0001'::text as conselho_numero, '+5511900000201'::text as telefone,
         array[(select id from seed_regiao where chave = 'sp')] as regioes,
         'pj'::vinculo_profissional as vinculo, 10000 as valor_hora, 0 as adicional, true as ativa
  union all
  select 'sul_2', (select id from seed_perfil where chave = 'enfermeira'), 'Profissional Teste Sul 2',
         'enfermeira_neonatal', 'COREN', 'SP', 'TESTE-SP-0002', '+5511900000202',
         array[(select id from seed_regiao where chave = 'sp')],
         'mei', 10000, 0, true
  union all
  select 'sul_3', null, 'Profissional Teste Sul 3',
         'enfermeira_obstetrica', 'COREN', 'SP', 'TESTE-SP-0003', '+5511900000203',
         array[(select id from seed_regiao where chave = 'sp')],
         'clt', 10000, 0, true
  union all
  select 'norte_1', null, 'Profissional Teste Norte 1',
         'enfermeira_obstetrica', 'COREN', 'PR', 'TESTE-PR-0001', '+5511900000204',
         array[(select id from seed_regiao where chave = 'londrina')],
         'autonoma', 10000, 10000, true
  union all
  select 'contratacao', null, 'Profissional Teste Em Contratação',
         'enfermeira_neonatal', null, null, null, '+5511900000205',
         array[(select id from seed_regiao where chave = 'sp')],
         'a_definir', null, 0, false
  union all
  select 'coordenacao', (select id from seed_perfil where chave = 'coordenacao'), 'Profissional Teste Coordenação',
         'coordenacao', 'COREN', 'SP', 'TESTE-SP-0000',
         '+5511900000206',
         array[(select id from seed_regiao where chave = 'sp'), (select id from seed_regiao where chave = 'londrina')],
         'socia', null, 0, true
) as v(chave, usuario_id, nome, funcao, conselho, conselho_uf, conselho_numero, telefone, regioes, vinculo, valor_hora, adicional, ativa)
join seed_profissional p on p.chave = v.chave;

-- profissional_id "de enfermeira" no perfil (PRD 6.1, coluna perfil.profissional_id)
update perfil set profissional_id = (select id from seed_profissional where chave = 'sul_2')
  where id = (select id from seed_perfil where chave = 'enfermeira');


-- =============================================================================
-- 9. Doze famílias em todos os estágios dos quatro pipelines (PRD 16.3),
--    pessoas, bebês, médicos, comercial e assistencial.
--
--    Aurora     P1 novo
--    Bruma      P1 em_conversa_ia, estado_sensivel bloqueio_total
--    Cedro      P1 qualificado
--    Dália      P1 sessao_venda_agendada (com sessao_venda marcada)
--    Estrela    P1 nutricao, estado_sensivel atencao
--    Flor       P1 perdido (motivo_perda preco)
--    Gruta      P2 proposta_enviada
--    Horizonte  P2 assinado (contrato assinado, aguardando pagamento)
--    Íris       P2 pagamento_confirmado (contrato, cobrança paga, NFS-e)
--    Jade       Pipeline 3, acompanhamento ENCERRADO: 6 visitas e registros
--               completos + 1 alerta clínico imediato fechado com conduta
--    Lua        Pipeline 3, acompanhamento ATIVO, GEMELAR (2 bebês)
--    Maré       Pipeline 4, pós-venda com NPS promotor
-- =============================================================================

create temp table seed_familia (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_familia (chave) values
  ('aurora'), ('bruma'), ('cedro'), ('dalia'), ('estrela'), ('flor'),
  ('gruta'), ('horizonte'), ('iris'), ('jade'), ('lua'), ('mare');

insert into familia (id, nome_exibicao, cidade_id, regiao_id, bairro, endereco_atendimento,
                     dpp, data_nascimento, data_alta, data_inicio_efetivo, gemelar, primeira_gestacao,
                     estado_sensivel, estado_sensivel_motivo, estado_sensivel_em, estado_sensivel_por,
                     origem, codigo_origem, utm)
select f.id, v.nome, c.id, cd.regiao_id, v.bairro, v.endereco,
       v.dpp, v.data_nascimento, v.data_alta, v.data_inicio_efetivo, v.gemelar, v.primeira_gestacao,
       v.estado_sensivel, v.estado_sensivel_motivo,
       case when v.estado_sensivel <> 'normal' then now() - interval '2 days' else null end,
       case when v.estado_sensivel <> 'normal' then (select id from seed_perfil where chave = 'coordenacao') else null end,
       v.origem, v.codigo_origem, v.utm
from (values
  ('aurora',    'Família Teste Aurora',    'sp_capital',
     'Pinheiros', '{"rua":"Rua Teste das Oliveiras","numero":"120"}'::jsonb,
     current_date + 220, null::date, null::date, null::date, false, true,
     'normal'::estado_sensivel, null::text, 'instagram_organico'::origem_lead, 'IG-TESTE-01', '{"utm_source":"instagram","utm_campaign":"teste"}'::jsonb),
  ('bruma',     'Família Teste Bruma',     'sp_capital',
     'Vila Mariana', '{"rua":"Rua Teste Bruma","numero":"45"}'::jsonb,
     null, null, null, null, false, false,
     'bloqueio_total'::estado_sensivel, 'Relato de perda gestacional em conversa com a Isadora (11.11, termo de alerta).',
     'site'::origem_lead, null, null),
  ('cedro',     'Família Teste Cedro',     'alphaville',
     'Alphaville', '{"rua":"Alameda Teste Cedro","numero":"800"}'::jsonb,
     current_date + 140, null, null, null, false, true,
     'normal'::estado_sensivel, null, 'meta_ads'::origem_lead, 'META-TESTE-02', '{"utm_source":"meta","utm_campaign":"teste_cedro"}'::jsonb),
  ('dalia',     'Família Teste Dália',     'sp_capital',
     'Moema', '{"rua":"Rua Teste Dália","numero":"310"}'::jsonb,
     current_date + 120, null, null, null, false, false,
     'normal'::estado_sensivel, null, 'indicacao_cliente'::origem_lead, null, null),
  ('estrela',   'Família Teste Estrela',   'londrina',
     'Gleba Palhano', '{"rua":"Rua Teste Estrela","numero":"55"}'::jsonb,
     current_date + 200, null, null, null, false, true,
     'atencao'::estado_sensivel, 'Relato de ansiedade importante; em observação pela coordenação, sem sinal de risco imediato.',
     'google'::origem_lead, null, null),
  ('flor',      'Família Teste Flor',      'santo_andre',
     'Centro', '{"rua":"Rua Teste Flor","numero":"200"}'::jsonb,
     current_date + 90, null, null, null, false, false,
     'normal'::estado_sensivel, null, 'meta_ads'::origem_lead, 'META-TESTE-03', null),
  ('gruta',     'Família Teste Gruta',     'granja_viana',
     'Granja Viana', '{"rua":"Rua Teste Gruta","numero":"15"}'::jsonb,
     current_date + 80, null, null, null, false, true,
     'normal'::estado_sensivel, null, 'indicacao_medica'::origem_lead, null, null),
  ('horizonte', 'Família Teste Horizonte', 'sp_capital',
     'Itaim Bibi', '{"rua":"Rua Teste Horizonte","numero":"77"}'::jsonb,
     current_date + 60, null, null, null, false, false,
     'normal'::estado_sensivel, null, 'site'::origem_lead, null, null),
  ('iris',      'Família Teste Íris',      'sao_bernardo',
     'Jardim do Mar', '{"rua":"Rua Teste Íris","numero":"320"}'::jsonb,
     current_date + 55, null, null, null, false, true,
     'normal'::estado_sensivel, null, 'indicacao_cliente'::origem_lead, null, null),
  ('jade',      'Família Teste Jade',      'sp_capital',
     'Perdizes', '{"rua":"Rua Teste Jade","numero":"410"}'::jsonb,
     current_date - 45, current_date - 40, current_date - 38, current_date - 38, false, true,
     'normal'::estado_sensivel, null, 'instagram_organico'::origem_lead, 'IG-TESTE-04', null),
  ('lua',       'Família Teste Lua',       'londrina',
     'Centro', '{"rua":"Rua Teste Lua","numero":"9"}'::jsonb,
     current_date - 10, current_date - 8, current_date - 6, current_date - 6, true, false,
     'normal'::estado_sensivel, null, 'site'::origem_lead, null, null),
  ('mare',      'Família Teste Maré',      'sp_capital',
     'Santana', '{"rua":"Rua Teste Maré","numero":"600"}'::jsonb,
     current_date - 70, current_date - 70, current_date - 68, current_date - 68, false, false,
     'normal'::estado_sensivel, null, 'indicacao_medica'::origem_lead, null, null)
) as v(chave, nome, cidade_chave, bairro, endereco, dpp, data_nascimento, data_alta, data_inicio_efetivo,
       gemelar, primeira_gestacao, estado_sensivel, estado_sensivel_motivo, origem, codigo_origem, utm)
join seed_familia f on f.chave = v.chave
join seed_cidade c on c.chave = v.cidade_chave
join public.cidade cd on cd.id = c.id;

-- --- Pessoas (mãe e, quando houver, parceiro/testemunha) --------------------
insert into pessoa (id, familia_id, papel, nome, telefone_e164, email, idade, contato_principal, consentimentos)
select gen_random_uuid(), f.id, v.papel::papel_pessoa, v.nome, v.telefone, v.email, v.idade, v.principal,
       jsonb_build_object('lgpd_dados_saude', jsonb_build_object('aceito', true, 'versao', '1',
         'em', to_char(now() - interval '5 days', 'YYYY-MM-DD"T"HH24:MI:SS'), 'canal', 'formulario'))
from (values
  ('aurora',    'mae',      'Marina Teste Aurora',     '+5511900000301', 'marina.teste.aurora@exemplo.invalid', 29, true),
  ('bruma',     'mae',      'Camila Teste Bruma',      '+5511900000302', 'camila.teste.bruma@exemplo.invalid', 33, true),
  ('cedro',     'mae',      'Beatriz Teste Cedro',     '+5511900000303', 'beatriz.teste.cedro@exemplo.invalid', 31, true),
  ('cedro',     'parceiro', 'Rafael Teste Cedro',      '+5511900000304', 'rafael.teste.cedro@exemplo.invalid', 32, false),
  ('dalia',     'mae',      'Fernanda Teste Dália',    '+5511900000305', 'fernanda.teste.dalia@exemplo.invalid', 27, true),
  ('estrela',   'mae',      'Patrícia Teste Estrela',  '+5511900000306', 'patricia.teste.estrela@exemplo.invalid', 34, true),
  ('flor',      'mae',      'Aline Teste Flor',        '+5511900000307', 'aline.teste.flor@exemplo.invalid', 30, true),
  ('gruta',     'mae',      'Juliana Teste Gruta',     '+5511900000308', 'juliana.teste.gruta@exemplo.invalid', 28, true),
  ('gruta',     'parceiro', 'Diego Teste Gruta',       '+5511900000309', 'diego.teste.gruta@exemplo.invalid', 30, false),
  ('horizonte', 'mae',      'Vanessa Teste Horizonte', '+5511900000310', 'vanessa.teste.horizonte@exemplo.invalid', 35, true),
  ('horizonte', 'parceiro', 'Bruno Teste Horizonte',   '+5511900000311', 'bruno.teste.horizonte@exemplo.invalid', 36, false),
  ('iris',      'mae',      'Renata Teste Íris',       '+5511900000312', 'renata.teste.iris@exemplo.invalid', 26, true),
  ('jade',      'mae',      'Camila Teste Jade',       '+5511900000313', 'camila.teste.jade@exemplo.invalid', 32, true),
  ('jade',      'parceiro', 'Eduardo Teste Jade',      '+5511900000314', 'eduardo.teste.jade@exemplo.invalid', 33, false),
  ('lua',       'mae',      'Larissa Teste Lua',       '+5511900000315', 'larissa.teste.lua@exemplo.invalid', 29, true),
  ('lua',       'parceiro', 'Gustavo Teste Lua',       '+5511900000316', 'gustavo.teste.lua@exemplo.invalid', 31, false),
  ('mare',      'mae',      'Isabela Teste Maré',      '+5511900000317', 'isabela.teste.mare@exemplo.invalid', 30, true)
) as v(familia_chave, papel, nome, telefone, email, idade, principal)
join seed_familia f on f.chave = v.familia_chave;

create temp table seed_pessoa (chave text primary key, id uuid not null);
insert into seed_pessoa (chave, id)
select f.chave || ':' || p.papel::text, p.id
from pessoa p join seed_familia f on f.id = p.familia_id
where f.chave in ('horizonte', 'iris', 'jade', 'lua');

-- Dados de contrato (só quem tem contrato: Horizonte, Íris, Jade, Lua).
-- CPF fictício com dígitos verificadores válidos (algoritmo do PRD 6.10 /
-- privado.mascarar_documentos), nunca um CPF real.
insert into pessoa_dados_contrato (pessoa_id, cpf, data_nascimento, endereco_residencial, preenchido_via)
select sp.id, v.cpf, v.nascimento, v.endereco, 'formulario_seguro'
from (values
  ('horizonte:mae', '111.444.777-35', date '1991-02-14', '{"rua":"Rua Teste Horizonte","numero":"77","complemento":"apto 12","cidade":"São Paulo","uf":"SP","cep":"05000-000"}'::jsonb),
  ('iris:mae',       '529.982.247-25', date '1999-08-03', '{"rua":"Rua Teste Íris","numero":"320","cidade":"São Bernardo do Campo","uf":"SP","cep":"09700-000"}'::jsonb),
  ('jade:mae',       '390.533.447-05', date '1993-11-22', '{"rua":"Rua Teste Jade","numero":"410","cidade":"São Paulo","uf":"SP","cep":"05000-100"}'::jsonb),
  ('lua:mae',        '187.230.508-90', date '1996-05-30', '{"rua":"Rua Teste Lua","numero":"9","cidade":"Londrina","uf":"PR","cep":"86000-000"}'::jsonb)
) as v(pessoa_chave, cpf, nascimento, endereco)
join seed_pessoa sp on sp.chave = v.pessoa_chave;

-- --- Bebês (Jade, Lua gemelar e Maré já nasceram) ---------------------------
create temp table seed_bebe (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_bebe (chave) values ('jade:1'), ('lua:1'), ('lua:2'), ('mare:1');

insert into bebe (id, familia_id, ordem, nome, sexo, data_nascimento, peso_nascimento_g, peso_alta_g, tipo_parto)
select b.id, f.id, v.ordem, v.nome, v.sexo, v.data_nascimento, v.peso_nasc, v.peso_alta, v.tipo_parto
from (values
  ('jade:1', 'jade', 1, 'Bebê Teste Jade',   'feminino',  null::date, 3150, 3080, 'cesarea'),
  ('lua:1',  'lua',  1, 'Bebê Teste Lua 1',  'masculino', null::date, 2600, 2540, 'cesarea'),
  ('lua:2',  'lua',  2, 'Bebê Teste Lua 2',  'feminino',  null::date, 2450, 2400, 'cesarea'),
  ('mare:1', 'mare', 1, 'Bebê Teste Maré',   'masculino', null::date, 3400, 3320, 'vaginal')
) as v(chave, familia_chave, ordem, nome, sexo, data_nascimento, peso_nasc, peso_alta, tipo_parto)
join seed_bebe b on b.chave = v.chave
join seed_familia f on f.chave = v.familia_chave;

-- data_nascimento do bebê herda a da família (mesma data do parto)
update bebe set data_nascimento = (select data_nascimento from familia f join seed_familia sf on sf.id = f.id where sf.chave = 'jade')
  where id in (select id from seed_bebe where chave = 'jade:1');
update bebe set data_nascimento = (select data_nascimento from familia f join seed_familia sf on sf.id = f.id where sf.chave = 'lua')
  where id in (select id from seed_bebe where chave in ('lua:1', 'lua:2'));
update bebe set data_nascimento = (select data_nascimento from familia f join seed_familia sf on sf.id = f.id where sf.chave = 'mare')
  where id in (select id from seed_bebe where chave = 'mare:1');

-- --- Médicos (obstetra e pediatra fictícios, ligados à família Jade) -------
insert into medico (familia_id, especialidade, nome, telefone_e164, email, hospital, origem_cadastro, capturado_em)
select f.id, v.especialidade::especialidade_medico, v.nome, v.telefone, v.email, v.hospital, v.origem, now() - interval '30 days'
from (values
  ('jade', 'obstetra', 'Dra. Helena Teste Obstetra', '+5511900000401', 'helena.teste.obstetra@exemplo.invalid', 'Hospital Teste São Paulo', 'prenatal'),
  ('jade', 'pediatra',  'Dr. Otávio Teste Pediatra',  '+5511900000402', 'otavio.teste.pediatra@exemplo.invalid', 'Hospital Teste São Paulo', 'ultimo_dia')
) as v(familia_chave, especialidade, nome, telefone, email, hospital, origem)
join seed_familia f on f.chave = v.familia_chave;

-- --- Oportunidades: uma por família, já no estágio da história (dono do
--     banco pode inserir fora do estado inicial, privado.proteger_estado) --
insert into oportunidade (familia_id, pipeline, estagio_p1, estagio_p2, score, classificacao,
                          motivo_perda, motivo_perda_detalhe, responsavel_id,
                          plano_interesse_pacote_id, pagamento_preferido, condicao_id,
                          desconto_pct, qualificacao, pdf_enviado_em, sessao_interesse_em, cadencia_etapa)
select f.id, v.pipeline, v.estagio_p1, v.estagio_p2, v.score, v.classificacao,
       v.motivo_perda, v.motivo_perda_detalhe, (select id from seed_perfil where chave = 'comercial'),
       (select id from seed_pacote where chave = v.pacote_chave), v.pagamento_preferido,
       v.condicao_id, v.desconto_pct, v.qualificacao, v.pdf_enviado_em, v.sessao_interesse_em, v.cadencia_etapa
from (values
  ('aurora',    1, 'novo'::estagio_p1,                  null::estagio_p2, null::int, null::classificacao_lead,
     null::motivo_perda, null::text, null::text, null::text, null::uuid, 0::numeric, '{}'::jsonb, null::timestamptz, null::timestamptz, 0),
  ('bruma',     1, 'em_conversa_ia',                    null, 45, 'morno',
     null, null, null, null, null, 0, '{}', null, null, 0),
  ('cedro',     1, 'qualificado',                       null, 78, 'quente',
     null, null, null, null, null, 0,
     '{"rede_apoio":"parceiro e mãe por perto","principal_preocupacao":"amamentação","parceiro_participa":true,"disponibilidade_sessao":"noite"}',
     now() - interval '1 day', now() - interval '1 day', 0),
  ('dalia',     1, 'sessao_venda_agendada',              null, 82, 'quente',
     null, null, null, null, null, 0, '{}', now() - interval '3 days', now() - interval '2 days', 0),
  ('estrela',   1, 'nutricao',                          null, 25, 'frio',
     null, null, null, null, null, 0, '{}', null, null, 1),
  ('flor',      1, 'perdido',                           null, 30, 'frio',
     'preco', 'Achou o valor alto para o momento, sem condição aprovada na tabela.', null, null, null, 0, '{}', now() - interval '10 days', null, 2),
  ('gruta',     2, 'qualificado', 'proposta_enviada',    85, 'quente',
     null, null, 'imersao', 'cartao_3x', null, 0, '{}', now() - interval '2 days', now() - interval '4 days', 0),
  ('horizonte', 2, 'qualificado', 'assinado',            90, 'quente',
     null, null, 'continuado', 'pix', null, 5.00, '{}', now() - interval '6 days', now() - interval '8 days', 0),
  ('iris',      2, 'qualificado', 'pagamento_confirmado', 88, 'quente',
     null, null, 'essencial', 'cartao_3x', null, 0, '{}', now() - interval '9 days', now() - interval '11 days', 0),
  ('jade',      2, 'qualificado', 'atendimento_liberado', 95, 'quente',
     null, null, 'essencial', 'cartao_3x', null, 0, '{}', now() - interval '55 days', now() - interval '58 days', 0),
  ('lua',       2, 'qualificado', 'atendimento_liberado', 93, 'quente',
     null, null, 'gemelar_essencial', 'pix', null, 0, '{}', now() - interval '20 days', now() - interval '23 days', 0),
  ('mare',      2, 'qualificado', 'atendimento_liberado', 91, 'quente',
     null, null, 'essencial', 'cartao_3x', null, 0, '{}', now() - interval '85 days', now() - interval '88 days', 0)
) as v(familia_chave, pipeline, estagio_p1, estagio_p2, score, classificacao, motivo_perda, motivo_perda_detalhe,
       pacote_chave, pagamento_preferido, condicao_id, desconto_pct, qualificacao, pdf_enviado_em, sessao_interesse_em, cadencia_etapa)
join seed_familia f on f.chave = v.familia_chave;

-- Condição de pagamento à vista (Pix) para Horizonte, com aprovação já
-- registrada (o desconto acima do padrão exige aprovação, C-04).
update oportunidade set condicao_id = (select id from condicao_comercial where nome = 'Pix à vista'),
                        desconto_aprovado_por = (select id from seed_perfil where chave = 'diretoria'),
                        desconto_motivo = 'Pix à vista, condição aprovada pela diretoria.'
  where familia_id = (select id from seed_familia where chave = 'horizonte');

-- --- Sessão de venda agendada (Dália) ---------------------------------------
insert into sessao_venda (familia_id, agendada_para, opcoes_informadas, conduzida_por, link_reuniao, status)
select f.id, now() + interval '3 days', 'Terça às 10h ou quinta às 15h',
       (select id from seed_perfil where chave = 'coordenacao'),
       'https://meet.exemplo.invalid/teste-dalia', 'agendada'
from seed_familia f where f.chave = 'dalia';

-- --- Contratos, cobranças e nota fiscal (Horizonte, Íris, Jade, Lua) -------
create temp table seed_contrato (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_contrato (chave) values ('horizonte'), ('iris'), ('jade'), ('lua');

insert into contrato (id, familia_id, pacote_versao_id, contratante_pessoa_id, pagador_pessoa_id,
                      testemunha_pessoa_id, valor_centavos, taxa_deslocamento_centavos, desconto_centavos,
                      parcelas, template_versao, autentique_doc_id, pdf_path, enviado_em, assinado_em, status)
select sc.id, f.id,
       (select pv.id from pacote_versao pv join seed_pacote p on p.id = pv.pacote_id
          where p.chave = v.pacote_chave and pv.vigencia_fim is null),
       sp_mae.id, sp_mae.id,
       sp_par.id,
       v.valor_centavos, v.taxa, v.desconto, v.parcelas, 'padrao-provisorio-v1',
       v.autentique_doc, v.pdf_path, v.enviado_em, v.assinado_em, v.status::status_contrato
from (values
  ('horizonte', 'continuado',        780000 - 39000, 0, 39000, 1, 'teste-autentique-horizonte', 'contratos/teste-horizonte.pdf', now() - interval '5 days', now() - interval '4 days', 'assinado'),
  ('iris',      'essencial',         420000,         0, 0,     3, 'teste-autentique-iris',      'contratos/teste-iris.pdf',      now() - interval '10 days', now() - interval '9 days', 'assinado'),
  ('jade',      'essencial',         420000,         0, 0,     3, 'teste-autentique-jade',      'contratos/teste-jade.pdf',      now() - interval '57 days', now() - interval '56 days', 'assinado'),
  ('lua',       'gemelar_essencial', 540000,         0, 0,     1, 'teste-autentique-lua',       'contratos/teste-lua.pdf',       now() - interval '22 days', now() - interval '21 days', 'assinado')
) as v(familia_chave, pacote_chave, valor_centavos, taxa, desconto, parcelas, autentique_doc, pdf_path, enviado_em, assinado_em, status)
join seed_familia f on f.chave = v.familia_chave
join seed_contrato sc on sc.chave = v.familia_chave
join seed_pessoa sp_mae on sp_mae.chave = v.familia_chave || ':mae'
left join seed_pessoa sp_par on sp_par.chave = v.familia_chave || ':parceiro';

create temp table seed_cobranca (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_cobranca (chave) values ('horizonte'), ('iris'), ('jade'), ('lua');

insert into cobranca (id, contrato_id, parcela, valor_centavos, vencimento, external_id, provider,
                      link_pagamento, capture_method, parcelas_cartao, valor_pago_centavos, pago_em, status)
select sb.id, sc.id, 1, v.valor, v.vencimento, 'teste-cobranca-' || v.familia_chave, 'infinitepay',
       'https://pay.exemplo.invalid/teste-' || v.familia_chave, v.metodo, v.parcelas_cartao,
       v.pago, v.pago_em, v.status::status_cobranca
from (values
  ('horizonte', 741000, current_date + 5, null::int, null::int, null::timestamptz, 'aberta', 'pix'),
  ('iris',      420000, current_date - 8, 3, 420000, now() - interval '8 days', 'paga', 'credit_card'),
  ('jade',      420000, current_date - 56, 3, 420000, now() - interval '56 days', 'paga', 'credit_card'),
  ('lua',       540000, current_date - 21, 1, 540000, now() - interval '21 days', 'paga', 'pix')
) as v(familia_chave, valor, vencimento, parcelas_cartao, pago, pago_em, status, metodo)
join seed_contrato sc on sc.chave = v.familia_chave
join seed_cobranca sb on sb.chave = v.familia_chave;

insert into nota_fiscal (cobranca_id, provider, provider_ref, numero, status, emitida_em)
select sb.id, 'nfse-teste', 'ref-teste-' || sb.chave, '00' || row_number() over (), 'emitida', now() - interval '5 days'
from seed_cobranca sb where sb.chave in ('iris', 'jade', 'lua');

-- --- Acompanhamento, designação, visitas e registros (Jade e Lua) ----------
create temp table seed_acompanhamento (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_acompanhamento (chave) values ('jade'), ('lua');

insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, periodo,
                            inicio_efetivo, encerramento, estado)
select sa.id, sc.id, f.id, v.dias, v.horas, 'manha'::periodo_visita, v.inicio, v.fim, v.estado::estado_acompanhamento
from (values
  ('jade', 6, 3.0, null::date, null::date, 'encerrado'),
  ('lua',  6, 4.0, null::date, null::date, 'em_execucao')
) as v(familia_chave, dias, horas, inicio, fim, estado)
join seed_familia f on f.chave = v.familia_chave
join seed_acompanhamento sa on sa.chave = v.familia_chave
join seed_contrato sc on sc.chave = v.familia_chave;

update acompanhamento set inicio_efetivo = fam.data_inicio_efetivo
  from seed_acompanhamento sa join seed_familia sf on sf.chave = sa.chave join familia fam on fam.id = sf.id
  where acompanhamento.id = sa.id;
update acompanhamento set encerramento = current_date - 32
  where id = (select id from seed_acompanhamento where chave = 'jade');

-- Designação: Jade com a profissional ligada ao perfil de teste da
-- enfermeira (para o login de teste ver a família na demonstração); Lua com
-- a profissional de Londrina, coerente com a região da família.
insert into designacao (acompanhamento_id, profissional_id, papel, status, oferecida_em, respondida_em)
select sa.id, sp.id, 'titular'::papel_designacao, 'aceita'::status_designacao,
       v.oferecida, v.respondida
from (values
  ('jade', 'sul_2',   now() - interval '58 days', now() - interval '58 days' + interval '2 hours'),
  ('lua',  'norte_1', now() - interval '23 days', now() - interval '23 days' + interval '1 hours')
) as v(acomp_chave, prof_chave, oferecida, respondida)
join seed_acompanhamento sa on sa.chave = v.acomp_chave
join seed_profissional sp on sp.chave = v.prof_chave;

-- Seis visitas e seis registros de atendimento para Jade (acompanhamento
-- completo, PRD 16.3); duas visitas de Lua, já concluídas, e o resto da
-- semana ainda por vir (acompanhamento em execução).
create temp table seed_visita (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_visita (chave)
select 'jade:' || g from generate_series(1, 6) g
union all
select 'lua:' || g from generate_series(1, 6) g;

insert into visita (id, acompanhamento_id, profissional_id, dia_numero, data, hora_prevista,
                    checkin_em, checkout_em, estado)
select sv.id, sa.id, sp.id, v.dia, v.data, v.hora,
       v.checkin, v.checkout, v.estado::estado_visita
from (
  select g as dia, 'jade' as acomp_chave, 'sul_2' as prof_chave,
         (current_date - 39 + g) as data, time '09:00' as hora,
         (current_date - 39 + g)::timestamptz + time '09:05' as checkin,
         (current_date - 39 + g)::timestamptz + time '12:00' as checkout,
         'concluida' as estado
  from generate_series(1, 6) g
  union all
  select g, 'lua', 'norte_1',
         (current_date - 7 + g),
         time '08:00',
         case when g <= 2 then (current_date - 7 + g)::timestamptz + time '08:05' else null end,
         case when g <= 2 then (current_date - 7 + g)::timestamptz + time '12:00' else null end,
         case when g <= 2 then 'concluida' when g = 3 then 'confirmada' else 'agendada' end
  from generate_series(1, 6) g
) as v(dia, acomp_chave, prof_chave, data, hora, checkin, checkout, estado)
join seed_acompanhamento sa on sa.chave = v.acomp_chave
join seed_profissional sp on sp.chave = v.prof_chave
join seed_visita sv on sv.chave = v.acomp_chave || ':' || v.dia;

insert into registro_atendimento (visita_id, profissional_id, instrumento_versao, dados, resumo_descritivo,
                                  assinado_em, assinatura)
select sv.id, vi.profissional_id, 'v1-2026-09',
       jsonb_build_object('bloco_2', jsonb_build_object('temperatura', 36.5, 'dor_escala', 1, 'observacao', 'Sem intercorrências.')),
       'Visita do dia ' || vi.dia_numero || ' do acompanhamento sintético de teste, sem intercorrências relevantes.',
       vi.checkout_em,
       encode(extensions.digest('registro-teste:' || sv.chave || ':' || vi.checkout_em::text, 'sha256'), 'hex')
from seed_visita sv
join visita vi on vi.id = sv.id
where sv.chave like 'jade:%' and vi.checkout_em is not null;

-- Um registro do dia 2 de Jade com alerta clínico imediato: febre confirmada
-- (PU-01), reconhecido pela enfermeira e fechado pela coordenação com a
-- conduta registrada (PRD 9.3, 16.3).
insert into alerta_clinico (familia_id, visita_id, regra_id, instrumento_versao, severidade, campo,
                            valor_observado, conduta, reconhecido_por, reconhecido_em, sinal_identificado,
                            acionado_em, orientacao_medica, conduta_adotada, fechado_em, fechado_por)
select f.id, sv.id, 'PU-01', 'v1-2026-09', 'imediato', '2.1.temperatura', '38,4 °C',
       'Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.',
       (select id from seed_perfil where chave = 'enfermeira'),
       vi.checkin_em + interval '20 minutes',
       'Temperatura de 38,4 °C confirmada em reavaliação, sem outros sinais de alerta associados.',
       vi.checkin_em + interval '25 minutes',
       'Coordenação orientou observação domiciliar com antitérmico e reavaliação em 2 horas.',
       'Antitérmico administrado conforme orientação; reavaliação em 2 horas com melhora e temperatura normalizada.',
       vi.checkin_em + interval '3 hours',
       (select id from seed_perfil where chave = 'coordenacao')
from seed_familia f, seed_visita sv join visita vi on vi.id = sv.id
where f.chave = 'jade' and sv.chave = 'jade:2';

-- --- Pós-venda (Maré, pipeline 4, PRD 7.4, 16.3) ----------------------------
-- Contrato e cobrança próprios de Maré (acompanhamento já encerrado há mais
-- tempo que os outros, para caber antes do protocolo do último dia).
create temp table seed_contrato_mare (id uuid not null default gen_random_uuid());
insert into seed_contrato_mare default values;

insert into contrato (id, familia_id, pacote_versao_id, contratante_pessoa_id, pagador_pessoa_id,
                      valor_centavos, parcelas, template_versao, autentique_doc_id, pdf_path,
                      enviado_em, assinado_em, status)
select scm.id, f.id,
       (select pv.id from pacote_versao pv join seed_pacote p on p.id = pv.pacote_id
          where p.chave = 'essencial' and pv.vigencia_fim is null),
       sp.id, sp.id, 420000, 3, 'padrao-provisorio-v1', 'teste-autentique-mare', 'contratos/teste-mare.pdf',
       now() - interval '90 days', now() - interval '89 days', 'assinado'
from seed_familia f
join seed_contrato_mare scm on true
join pessoa sp on sp.familia_id = f.id and sp.papel = 'mae'
where f.chave = 'mare';

insert into cobranca (contrato_id, parcela, valor_centavos, vencimento, external_id, provider,
                      capture_method, parcelas_cartao, valor_pago_centavos, pago_em, status)
select scm.id, 1, 420000, current_date - 88, 'teste-cobranca-mare', 'infinitepay',
       'credit_card', 3, 420000, now() - interval '88 days', 'paga'
from seed_contrato_mare scm;

create temp table seed_acompanhamento_mare (id uuid not null default gen_random_uuid());
insert into seed_acompanhamento_mare default values;

insert into acompanhamento (id, contrato_id, familia_id, dias_contratados, horas_por_visita, periodo,
                            inicio_efetivo, encerramento, estado)
select sam.id, scm.id,
       fam.id, 6, 3.0, 'tarde'::periodo_visita, fam.data_inicio_efetivo, current_date - 62, 'encerrado'::estado_acompanhamento
from familia fam join seed_familia sf on sf.id = fam.id, seed_acompanhamento_mare sam, seed_contrato_mare scm
where sf.chave = 'mare';

insert into pos_venda (acompanhamento_id, estagio, pesquisa_token_hash, pesquisa_enviada_em,
                       pesquisa_respondida_em, respostas, nps, classificacao, depoimento_autorizado,
                       autorizacao_imagem, acao_executada_em)
select sam.id, 'classificado'::estagio_p4,
       encode(extensions.digest('pesquisa-teste-mare', 'sha256'), 'hex'),
       current_date - 61, current_date - 59,
       '{"recomendaria":"com certeza","destaque":"a presença diária da enfermeira","sugestao":"nenhuma"}'::jsonb,
       10, 'promotor'::classificacao_nps, true, true, null
from seed_acompanhamento_mare sam;


-- =============================================================================
-- 10. Conversas fictícias para cada modo do agente (PRD 11.7, 16.3)
--
-- Sete modos amarrados a uma conversa (o oitavo, desligado/teste, é
-- parametro.agente_modo = "desligado" já semeado na seção 3, ambiente
-- inteiro, sem precisar de uma conversa própria).
-- =============================================================================

create temp table seed_conversa (chave text primary key, id uuid not null default gen_random_uuid());
insert into seed_conversa (chave) values
  ('vendas'), ('cliente'), ('humano_nominal'), ('nao_lead'), ('pausado'), ('silencio'), ('humano_comercial');

insert into conversa (id, canal, wa_jid, telefone_e164, familia_id, pessoa_id, classificacao,
                      nome_whatsapp, nome_contato_salvo, iniciada_por, primeira_msg_em,
                      ultima_entrada_em, ultima_saida_em, agente_pausado_ate, agente_pausa_motivo,
                      agente_encerrado_em, agente_encerrado_motivo)
select sc.id, 'whatsapp'::canal_contato, v.wa_jid, v.telefone, v.familia_id, v.pessoa_id,
       v.classificacao::classificacao_contato, v.nome_whatsapp, v.nome_contato_salvo,
       v.iniciada_por::enviado_por, v.primeira_msg, v.ultima_entrada, v.ultima_saida,
       v.pausado_ate, v.pausa_motivo, v.encerrado_em, v.encerrado_motivo
from (
  select 'vendas' as chave, '5511900000301-teste@s.whatsapp.net' as wa_jid, '+5511900000301' as telefone,
         f.id as familia_id, (select id from pessoa where familia_id = f.id and papel = 'mae') as pessoa_id,
         'lead' as classificacao, 'Marina' as nome_whatsapp, 'Marina Teste Aurora' as nome_contato_salvo,
         'cliente' as iniciada_por, now() - interval '2 hours' as primeira_msg,
         now() - interval '10 minutes' as ultima_entrada, now() - interval '8 minutes' as ultima_saida,
         null::timestamptz as pausado_ate, null::text as pausa_motivo,
         null::timestamptz as encerrado_em, null::text as encerrado_motivo
  from seed_familia f where f.chave = 'aurora'
  union all
  select 'cliente', '5511900000312-teste@s.whatsapp.net', '+5511900000312',
         f.id, (select id from pessoa where familia_id = f.id and papel = 'mae'),
         'cliente', 'Renata', 'Renata Teste Íris (cliente)',
         'cliente', now() - interval '3 days',
         now() - interval '1 days', now() - interval '1 days' + interval '5 minutes',
         null, null, null, null
  from seed_familia f where f.chave = 'iris'
  union all
  select 'humano_nominal', '5511900000302-teste@s.whatsapp.net', '+5511900000302',
         f.id, (select id from pessoa where familia_id = f.id and papel = 'mae'),
         'lead', 'Camila', 'Camila Teste Bruma',
         'cliente', now() - interval '2 days',
         now() - interval '2 days', now() - interval '2 days' + interval '2 minutes',
         null, null, null, null
  from seed_familia f where f.chave = 'bruma'
  union all
  select 'nao_lead', '5511900000501-teste@s.whatsapp.net', '+5511900000501',
         null, null,
         'candidata', 'Sônia', 'Sônia Teste Candidata',
         'cliente', now() - interval '6 hours',
         now() - interval '6 hours', now() - interval '6 hours' + interval '3 minutes',
         null, null, null, null
  union all
  select 'pausado', '5511900000303-teste@s.whatsapp.net', '+5511900000303',
         f.id, (select id from pessoa where familia_id = f.id and papel = 'mae'),
         'lead', 'Beatriz', 'Beatriz Teste Cedro',
         'cliente', now() - interval '1 days',
         now() - interval '20 hours', now() - interval '20 hours' + interval '4 minutes',
         now() + interval '20 hours', 'Handoff aberto (condicao_comercial), aguardando o comercial responder.',
         null, null
  from seed_familia f where f.chave = 'cedro'
  union all
  select 'silencio', '5511900000050-teste@s.whatsapp.net', '+5511900000050',
         null, null,
         'nao_classificado', 'Equipe', 'Perfil Teste Comercial (número da equipe)',
         'humano', now() - interval '4 hours',
         now() - interval '4 hours', now() - interval '4 hours' + interval '1 minutes',
         null, null, null, null
  union all
  select 'humano_comercial', '5511900000310-teste@s.whatsapp.net', '+5511900000310',
         f.id, (select id from pessoa where familia_id = f.id and papel = 'mae'),
         'lead', 'Vanessa', 'Vanessa Teste Horizonte',
         'cliente', now() - interval '6 days',
         now() - interval '5 days', now() - interval '5 days' + interval '6 minutes',
         null, null, now() - interval '5 days' + interval '6 minutes', 'contratar'
  from seed_familia f where f.chave = 'horizonte'
) as v(chave, wa_jid, telefone, familia_id, pessoa_id, classificacao, nome_whatsapp, nome_contato_salvo,
       iniciada_por, primeira_msg, ultima_entrada, ultima_saida, pausado_ate, pausa_motivo,
       encerrado_em, encerrado_motivo)
join seed_conversa sc on sc.chave = v.chave;

-- Duas mensagens por conversa (entrada da família, saída da Isadora ou da
-- equipe), texto curto, coerente com o modo.
insert into mensagem (conversa_id, direcao, enviado_por, tipo, conteudo, enviada_em)
select sc.id, v.direcao::direcao_mensagem, v.enviado_por::enviado_por, 'texto', v.conteudo, v.quando
from (values
  ('vendas', 'entrada', 'cliente', 'Oi, gostaria de saber mais sobre o acompanhamento de vocês', now() - interval '2 hours'),
  ('vendas', 'saida', 'ia', 'Oi, Marina! Que alegria saber que você está esperando bebê 🤍 Me conta, de quantas semanas você está?', now() - interval '2 hours' + interval '2 minutes'),
  ('cliente', 'entrada', 'cliente', 'Oi! A enfermeira vem amanhã de manhã mesmo?', now() - interval '1 days'),
  ('cliente', 'saida', 'ia', 'Isso mesmo, Renata! Amanhã de manhã, no mesmo horário combinado. Qualquer coisa me avisa por aqui.', now() - interval '1 days' + interval '5 minutes'),
  ('humano_nominal', 'entrada', 'cliente', 'Infelizmente perdi o bebê essa semana', now() - interval '2 days'),
  ('humano_nominal', 'saida', 'sistema', 'Sinto muito, de coração. Se em algum momento precisar da gente, estamos aqui.', now() - interval '2 days' + interval '1 minutes'),
  ('nao_lead', 'entrada', 'cliente', 'Boa tarde, vi a vaga de enfermeira obstétrica, como faço para me candidatar?', now() - interval '6 hours'),
  ('nao_lead', 'saida', 'sistema', 'Que bom saber do seu interesse em fazer parte da equipe 🤍 As candidaturas chegam pelo e-mail contato@kraamzorgbrasil.com.br.', now() - interval '6 hours' + interval '3 minutes'),
  ('pausado', 'entrada', 'cliente', 'Vocês fazem algum desconto para pagamento à vista?', now() - interval '1 days'),
  ('pausado', 'saida', 'sistema', 'Essa informação eu vou confirmar com a equipe para te responder certinho, tá?', now() - interval '1 days' + interval '2 minutes'),
  ('silencio', 'saida', 'humano', 'Confirmado, já anotei aqui.', now() - interval '4 hours'),
  ('humano_comercial', 'entrada', 'cliente', 'Fechado, pode preparar o contrato', now() - interval '5 days'),
  ('humano_comercial', 'saida', 'humano', 'Que alegria, Vanessa! Vou te mandar o formulário seguro para os dados do contrato.', now() - interval '5 days' + interval '6 minutes')
) as v(chave, direcao, enviado_por, conteudo, quando)
join seed_conversa sc on sc.chave = v.chave;

commit;

-- =============================================================================
-- Conferência: node supabase/checar-seed.mjs (node puro, sem dependência),
-- falha se aparecer nome ou telefone fora do padrão fictício deste arquivo
-- ("... Teste ..." e "+5511900000XXX"). Comando completo no relatório da
-- sessão (CLAUDE.md não foi alterado por esta sessão: quem tiver alçada
-- para editá-lo pode acrescentar este comando à seção "Comandos").
-- =============================================================================
