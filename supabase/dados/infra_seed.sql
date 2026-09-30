-- =============================================================================
-- supabase/dados/infra_seed.sql · P14 e P18b
--
-- Só dado sintético de desenvolvimento e homologação. Roda depois de seed.sql
-- (mensagem_modelo precisa existir). Em produção, os parâmetros e os modelos
-- reais entram por migration de dados separada e revisada (P14 item 2).
--
-- Modelos da Cloud API: todos em rascunho. Nenhum foi submetido à Meta. O texto
-- abaixo é proposta a partir do rascunho aprovado em mensagem_modelo, sem
-- variável no começo nem no fim (regra da Meta), para o Leonardo aprovar antes
-- de submeter. Quando a Meta aprovar, o status muda pelo cadastro.
-- =============================================================================

insert into parametro (chave, valor, descricao) values
  ('whatsapp_janela_horas', '24',
   'P18b, PRD 4.1 D-08: horas, desde a última mensagem da família, em que a Cloud API oficial do WhatsApp aceita texto livre. Depois disso só sai modelo aprovado pela Meta. Regra da plataforma; sem o valor, o sistema trata tudo como fora da janela.'),
  ('saude_recalculo_tolerancia_horas', '26',
   'P14 item 7: horas sem o recálculo diário das 7h concluir antes de /api/saude apontar atraso.'),
  ('saude_janela_falhas_horas', '24',
   'P14 item 7: janela, em horas, das falhas de webhook, automação e sincronização que /api/saude conta.')
on conflict (chave) do update set valor = excluded.valor, descricao = excluded.descricao;

insert into privado.modelo_whatsapp (mensagem_chave, nome_meta, idioma, categoria, variaveis, valores_padrao, texto) values
  ('followup_d1_pos_pdf', 'kz_retorno_apresentacao', 'pt_BR', 'utilidade', array['nome'], '{"nome":"tudo bem"}',
   'Oi, {{1}} 😊 Conseguiu ver a apresentação com calma? Se ficou alguma dúvida sobre os formatos, me conta por aqui.'),
  ('followup_d1_pos_abertura', 'kz_retorno_conversa', 'pt_BR', 'utilidade', array[]::text[], '{}',
   'Oi! Vi que você entrou em contato com a Kraamzorg Brasil 🤍 Se ainda fizer sentido conhecer o nosso cuidado pós-parto, me conta de quantas semanas você está.'),
  ('regua_ate_20', 'kz_regua_inicio', 'pt_BR', 'marketing', array['nome'], '{"nome":"tudo bem"}',
   'Oi, {{1}}, aqui é da Kraamzorg Brasil 🤍 Como está a gestação? Quando quiser entender como funciona o cuidado nos primeiros dias em casa, é só me chamar por aqui.'),
  ('regua_28_34', 'kz_regua_janela', 'pt_BR', 'marketing', array['nome'], '{"nome":"tudo bem"}',
   'Oi, {{1}}! Você está entrando na janela ideal para reservar o pós-parto, entre 28 e 36 semanas. Se fizer sentido, a Edilaine conversa com vocês uns 15 minutos, sem compromisso. Me passa dois dias e horários que ficam bons para vocês?'),
  ('regua_35_mais', 'kz_regua_reta_final', 'pt_BR', 'marketing', array['nome'], '{"nome":"tudo bem"}',
   'Oi, {{1}}! A chegada do bebê está pertinho 🤍 Se vocês ainda estiverem pensando no cuidado para os primeiros dias em casa, me conta a DPP e a cidade que eu vejo agora com a equipe como fica para vocês.'),
  ('regua_nasceu', 'kz_regua_nascimento', 'pt_BR', 'marketing', array[]::text[], '{}',
   'Parabéns pela chegada do bebê! 👶 Como vocês estão, já em casa com o bebê? Vou ver com a equipe a possibilidade de começar o acompanhamento com vocês.')
on conflict (nome_meta, idioma) do nothing;
