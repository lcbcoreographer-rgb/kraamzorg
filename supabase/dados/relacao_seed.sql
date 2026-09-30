-- =============================================================================
-- supabase/dados/relacao_seed.sql
--
-- Dados de configuração da migration 0027_relacao.sql (P47 a P51): parâmetros,
-- textos em rascunho, canais de captação e o roteiro de seleção. Só dado
-- sintético e fictício (números de telefone e endereços de exemplo). Roda
-- depois de supabase/seed.sql, na ordem de [db.seed] em supabase/config.toml.
--
-- Todo texto para a família nasce em rascunho, para o Leonardo aprovar (e a
-- Edilaine no que tocar o clínico). Nenhum preço, prazo, limite ou lista de
-- termos fica no código: tudo isto é editável sem deploy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Parâmetros
-- -----------------------------------------------------------------------------

insert into parametro (chave, valor, descricao) values
  ('captacao',
   '{"prefixo": "KZ", "numero_whatsapp_e164": "+5511900000000", "tentativas_max": 20, "janela_minutos": 10, "utm_tamanho_max": 80, "exportar_max": 5000}',
   'P47, PRD 14 e T-02: prefixo do código de origem que vai no texto do link wa.me, número do WhatsApp que a página de captação abre (fictício no seed; o real depende da migração do canal, T-01 [confirmar: Leonardo e Drop]), limite de chamadas por origem na janela, tamanho máximo de cada UTM e teto de linhas da exportação de marketing.'),
  ('marketing',
   '{"ve_receita": false}',
   'P47, PRD 13: o marketing vê receita e custo por origem? Falso: o papel de marketing é só agregado de leads (matriz do PRD 13); diretoria e financeiro sempre veem. Mudar para verdadeiro é decisão do Leonardo [confirmar: Leonardo].'),
  ('copiloto',
   '{"ativo": true, "pergunta_max_caracteres": 500, "orcamento_mensal_centavos": 5000, "preco_entrada_centavos_por_milhao": 220, "preco_saida_centavos_por_milhao": 880, "termos_assistenciais": ["registro assistencial", "prontuario", "evolucao", "checklist", "peso do bebe", "alerta clinico", "ictericia", "amamentacao", "laserterapia", "sinais vitais", "pressao arterial", "temperatura", "saturacao", "loquios", "coto umbilical", "diagnostico", "medicacao", "sintoma", "adendo", "ficha de entrevista", "dados clinicos", "historico clinico", "intercorrencia", "ocorrencia clinica"]}',
   'P48, PRD 12 e 13: interruptor do copiloto interno (ele também só liga com a chave do modelo no servidor), tamanho máximo da pergunta, orçamento do mês e preço por milhão de tokens em centavos (valores de exemplo [confirmar: Leonardo, modelo e preço]) e os termos, sem acento e em minúsculas, que fazem o copiloto recusar a pergunta por ser assistencial. Lista provisória [confirmar: Edilaine].'),
  ('portal_familia',
   '{"endereco": "https://app.exemplo.invalid/familia", "evolucoes_ativo": false, "link_janela_minutos": 60, "link_max_por_origem": 10, "link_max_por_email": 3, "contato_equipe": {"nome": "Equipe de teste da Kraamzorg", "telefone_e164": "+5511900000001", "horario": "Segunda a sexta, das 9h às 18h"}, "contato_sensivel": {"nome": "Contato de teste da coordenação", "telefone_e164": "+5511900000002", "funcao": "Coordenação de enfermagem"}}',
   'P49, PRD 12 e 22.3 K-10: endereço do portal que o convite cita (fictício no seed), evoluções para a família desligadas até a Edilaine decidir o K-10, limite do pedido de link mágico (por origem e por e-mail, na janela), contato da equipe e a pessoa que a família em bloqueio_total ou encerrado_sensivel vê no lugar do portal [confirmar: Leonardo e Edilaine, quem].'),
  ('indicacoes',
   '{"relacionamento_dias": 60}',
   'P50, PRD 12: dias entre um contato de relacionamento com o médico parceiro e o próximo. Só relacionamento institucional, nunca comissão [confirmar: Leonardo].'),
  ('talentos_pagina_publica',
   '{"ativa": false, "termo_versao": "T-1 provisório", "tentativas_max": 5, "janela_minutos": 60}',
   'P51 item 3, PRD 12: a página pública de candidatura existe, mas nasce DESLIGADA (o onboarding pediu para não abrir canal público agora). Ligar é trocar ativa para verdadeiro. Versão do termo de consentimento e limite de envios por origem na janela [confirmar: jurídico, termo].'),
  ('talentos_roteiro',
   '{"versao": "R-1 provisório", "escala": {"min": 1, "max": 5},
     "blocos": [
       {"id": "b1", "nome": "Trajetória e perfil", "perguntas": [
         {"id": "p01", "texto": "Conte sobre a sua formação e a sua experiência profissional."},
         {"id": "p02", "texto": "Você tem especialização em saúde materno-infantil? Qual?"},
         {"id": "p03", "texto": "Há quanto tempo você atua na área?"},
         {"id": "p04", "texto": "Onde você já atuou: alojamento conjunto ou maternidade, unidade neonatal, banco de leite, como autônoma, em domicílio ou em centro de parto?"},
         {"id": "p05", "texto": "O que você pensa sobre a assistência domiciliar à mãe e ao bebê?"},
         {"id": "p06", "texto": "Como você se mantém atualizada?"},
         {"id": "p07", "texto": "Quais foram os últimos eventos científicos de que você participou?"},
         {"id": "p08", "texto": "Como você cuida do sigilo das informações das famílias?"},
         {"id": "p09", "texto": "Para você, o que é essencial num atendimento domiciliar de excelência?"}]},
       {"id": "b2", "nome": "Neonatologia", "perguntas": [
         {"id": "p10", "texto": "Como você faz a avaliação inicial de um recém-nascido em casa, no 3º ou 4º dia de vida?"},
         {"id": "p11", "texto": "Quais sinais de risco no recém-nascido pedem encaminhamento?"},
         {"id": "p12", "texto": "Como você avalia se a amamentação está sendo eficaz?"},
         {"id": "p13", "texto": "O que você orienta sobre engasgo e sono seguro?"},
         {"id": "p14", "texto": "Como você acompanha a evolução do peso do bebê nos primeiros 10 dias?"},
         {"id": "p15", "texto": "Como você reconhece os sinais precoces de icterícia, desidratação e infecção?"},
         {"id": "p16", "texto": "O que você orienta sobre higiene, banho e cuidado com o coto umbilical?"}]},
       {"id": "b3", "nome": "Puerpério", "perguntas": [
         {"id": "p17", "texto": "Como é a recuperação depois de um parto vaginal e depois de uma cesárea?"},
         {"id": "p18", "texto": "Quais sinais de alerta na mãe pedem encaminhamento médico?"},
         {"id": "p19", "texto": "Como você cuida de lesão mamilar, ingurgitamento e baixa produção de leite?"},
         {"id": "p20", "texto": "Como você identifica depressão ou sofrimento emocional no puerpério?"},
         {"id": "p21", "texto": "O que você faria diante de um bebê pouco ativo, mamando pouco e com fraldas quase secas?"}]},
       {"id": "b4", "nome": "Relacionamento interpessoal", "perguntas": [
         {"id": "p22", "texto": "Como você constrói vínculo com os pais sem ultrapassar os limites profissionais?"},
         {"id": "p23", "texto": "O que você faz quando a família insiste numa prática não recomendada, como chá, chupeta ou mamadeira na maternidade?"},
         {"id": "p24", "texto": "Como você organiza as orientações para que a família consiga segui-las?"}]},
       {"id": "b5", "nome": "Finalização", "perguntas": [
         {"id": "p25", "texto": "Quais são os seus maiores diferenciais?"},
         {"id": "p26", "texto": "Por que você deveria ser escolhida?"}]}],
     "criterios": [
       {"id": "c01", "nome": "Conhecimento técnico"},
       {"id": "c02", "nome": "Experiência prática (neonatal e domicílio)"},
       {"id": "c03", "nome": "Segurança na tomada de decisão"},
       {"id": "c04", "nome": "Desenvoltura, comunicação e empatia"},
       {"id": "c05", "nome": "Relacionamento com famílias"},
       {"id": "c06", "nome": "Raciocínio clínico"},
       {"id": "c07", "nome": "Disponibilidade e comprometimento"},
       {"id": "c08", "nome": "Apresentação e postura"},
       {"id": "c09", "nome": "Identificação de situações de risco"},
       {"id": "c10", "nome": "Autonomia no domicílio"}]}',
   'P51 item 3, PRD 12 e docs/referencia-materiais-clinicos.md seção 7: roteiro de seleção de enfermeiras com 26 perguntas em 5 blocos e 10 critérios de 1 a 5. A redação das perguntas é rascunho a partir do resumo do roteiro atual [confirmar: Edilaine]. O roteiro atual não tem peso por critério, nota de corte nem requisitos formais; se o cliente quiser, entram aqui.')
on conflict (chave) do update set valor = excluded.valor, descricao = excluded.descricao;

-- -----------------------------------------------------------------------------
-- 2. Textos (mensagem_modelo), todos em rascunho
--
-- canal site + destinatário familia: lidos pelas páginas abertas e pelo portal
-- (privado.textos_site). Rótulo curto de botão e nome de estado ("Feito",
-- "Agora") são microcopy da tela; frase que fala com a família mora aqui.
-- -----------------------------------------------------------------------------

insert into mensagem_modelo (chave, canal, destinatario, texto, variaveis, status) values
  -- P47 · página de captação /c/<canal>
  ('captacao_titulo', 'site', 'familia', 'Oi. Aqui é a Kraamzorg.', array[]::text[], 'rascunho'),
  ('captacao_abertura', 'site', 'familia',
   'Cuidamos de mãe e bebê em casa, nos primeiros dias depois do parto, com enfermeiras que acompanham a sua família com presença e orientação clara.',
   array[]::text[], 'rascunho'),
  ('captacao_como_funciona', 'site', 'familia',
   'Ao tocar no botão, o WhatsApp abre com uma mensagem pronta. É só enviar. A Isadora, assistente virtual da Kraamzorg, responde primeiro, e a nossa equipe entra na conversa quando for preciso.',
   array[]::text[], 'rascunho'),
  ('captacao_privacidade', 'site', 'familia',
   'Esta página não pede nenhum dado seu. Você conta o que quiser na conversa, no seu tempo.',
   array[]::text[], 'rascunho'),
  ('captacao_botao', 'site', 'familia', 'Conversar pelo WhatsApp', array[]::text[], 'rascunho'),
  ('captacao_verificando', 'site', 'familia',
   'Só um instante. Estamos confirmando que você é uma pessoa.', array[]::text[], 'rascunho'),
  ('captacao_verificacao_falhou', 'site', 'familia',
   'Não deu para confirmar que você é uma pessoa. Recarregue a página e tente de novo.', array[]::text[], 'rascunho'),
  ('captacao_indisponivel', 'site', 'familia',
   'Este link não está mais ativo. Se você chegou aqui por engano ou o link é antigo, fale com a nossa equipe pelo contato que você recebeu.',
   array[]::text[], 'rascunho'),
  ('captacao_limite', 'site', 'familia',
   'Recebemos muitos acessos deste aparelho em pouco tempo. Aguarde alguns minutos e toque no botão de novo.',
   array[]::text[], 'rascunho'),
  ('captacao_erro', 'site', 'familia',
   'Não conseguimos abrir o WhatsApp agora. Nada foi enviado. Tente de novo em instantes.', array[]::text[], 'rascunho'),
  -- texto pré-preenchido da mensagem no WhatsApp (canal whatsapp: não entra na página)
  ('captacao_whatsapp', 'whatsapp', 'familia',
   'Olá, gostaria de saber mais sobre o cuidado da Kraamzorg depois do parto. ({codigo})',
   array['codigo'], 'rascunho'),

  -- P49 · portal da família
  ('portal_entrar_titulo', 'site', 'familia', 'Entrar no portal da família', array[]::text[], 'rascunho'),
  ('portal_entrar_apoio', 'site', 'familia',
   'Digite o e-mail que você deu à Kraamzorg. Enviamos um link para você entrar, sem senha.',
   array[]::text[], 'rascunho'),
  ('portal_entrar_enviado', 'site', 'familia',
   'Se este e-mail estiver cadastrado, o link acabou de sair. Ele serve uma vez e vale por pouco tempo. Confira também a caixa de spam.',
   array[]::text[], 'rascunho'),
  ('portal_entrar_erro', 'site', 'familia',
   'Não conseguimos enviar o link agora. Nada foi alterado. Tente de novo em instantes.', array[]::text[], 'rascunho'),
  ('portal_entrar_limite', 'site', 'familia',
   'Recebemos muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.', array[]::text[], 'rascunho'),
  ('portal_link_invalido', 'site', 'familia',
   'Este link venceu ou já foi usado. Peça um novo com o seu e-mail.', array[]::text[], 'rascunho'),
  ('portal_titulo', 'site', 'familia', 'Oi, {nome}.', array['nome'], 'rascunho'),
  ('portal_boas_vindas', 'site', 'familia',
   'Este é o espaço da sua família na Kraamzorg. Aqui você acompanha os próximos passos e as datas, e encontra o contato da equipe.',
   array[]::text[], 'rascunho'),
  ('portal_passos_titulo', 'site', 'familia', 'Seus próximos passos', array[]::text[], 'rascunho'),
  ('portal_passo_contrato', 'site', 'familia', 'Contrato assinado', array[]::text[], 'rascunho'),
  ('portal_passo_pagamento', 'site', 'familia', 'Pagamento confirmado', array[]::text[], 'rascunho'),
  ('portal_passo_prenatal', 'site', 'familia', 'Consulta pré-natal online', array[]::text[], 'rascunho'),
  ('portal_passo_enfermeira', 'site', 'familia', 'Enfermeira que vai acompanhar vocês', array[]::text[], 'rascunho'),
  ('portal_passo_nascimento', 'site', 'familia', 'Nascimento do bebê', array[]::text[], 'rascunho'),
  ('portal_passo_alta', 'site', 'familia', 'Alta da maternidade', array[]::text[], 'rascunho'),
  ('portal_passo_visitas', 'site', 'familia', 'Visitas em casa', array[]::text[], 'rascunho'),
  ('portal_agora_contrato', 'site', 'familia',
   'Assim que o contrato for assinado, o próximo passo aparece aqui.', array[]::text[], 'rascunho'),
  ('portal_agora_pagamento', 'site', 'familia',
   'A equipe envia o link de pagamento. Depois da confirmação, seguimos para o agendamento.', array[]::text[], 'rascunho'),
  ('portal_agora_prenatal', 'site', 'familia',
   'A equipe combina com vocês o dia e o horário da consulta pré-natal online.', array[]::text[], 'rascunho'),
  ('portal_agora_enfermeira', 'site', 'familia',
   'A coordenação escolhe a enfermeira e avisa vocês assim que ela estiver definida.', array[]::text[], 'rascunho'),
  ('portal_agora_nascimento', 'site', 'familia',
   'Quando o bebê nascer, avisem a equipe. O nascimento e a alta são datas que vocês confirmam com a gente.',
   array[]::text[], 'rascunho'),
  ('portal_agora_alta', 'site', 'familia',
   'Assim que houver alta, contem para a equipe. É a partir dela que combinamos o início das visitas.',
   array[]::text[], 'rascunho'),
  ('portal_agora_visitas', 'site', 'familia',
   'As visitas aparecem aqui, com dia e horário, quando a coordenação confirmar com vocês.', array[]::text[], 'rascunho'),
  ('portal_datas_titulo', 'site', 'familia', 'Datas', array[]::text[], 'rascunho'),
  ('portal_dpp_nota', 'site', 'familia',
   'A data provável do parto é uma estimativa. Nascimento, alta e início das visitas são datas que a equipe confirma com vocês.',
   array[]::text[], 'rascunho'),
  ('portal_enfermeira_titulo', 'site', 'familia', 'Sua enfermeira', array[]::text[], 'rascunho'),
  ('portal_enfermeira_sem_nome', 'site', 'familia',
   'Uma enfermeira da equipe Kraamzorg vai acompanhar vocês. O nome dela aparece aqui quando ela autorizar.',
   array[]::text[], 'rascunho'),
  ('portal_enfermeira_sem_designacao', 'site', 'familia',
   'A enfermeira ainda está sendo escolhida. Vocês recebem o aviso da equipe assim que ela estiver definida.',
   array[]::text[], 'rascunho'),
  ('portal_guia_titulo', 'site', 'familia', 'Guia de início', array[]::text[], 'rascunho'),
  ('portal_guia_inicio', 'site', 'familia',
   'O guia de início chega pela equipe antes do nascimento. Ele reúne o que preparar em casa e o que esperar dos primeiros dias.',
   array[]::text[], 'rascunho'),
  ('portal_visitas_titulo', 'site', 'familia', 'Visitas em casa', array[]::text[], 'rascunho'),
  ('portal_visitas_vazio', 'site', 'familia',
   'As datas das visitas aparecem aqui assim que a coordenação confirmar com vocês.', array[]::text[], 'rascunho'),
  ('portal_pesquisa_titulo', 'site', 'familia', 'Sua opinião', array[]::text[], 'rascunho'),
  ('portal_pesquisa_espera', 'site', 'familia',
   'Depois da última visita, a equipe envia uma pesquisa curta. Ela ajuda a cuidar melhor das próximas famílias.',
   array[]::text[], 'rascunho'),
  ('portal_pesquisa_enviada', 'site', 'familia',
   'A pesquisa já foi enviada para vocês. Se ainda não responderam, procurem a mensagem da equipe.', array[]::text[], 'rascunho'),
  ('portal_pesquisa_respondida', 'site', 'familia',
   'Recebemos a resposta de vocês. Agradecemos por contar como foi.', array[]::text[], 'rascunho'),
  ('portal_evolucoes_titulo', 'site', 'familia', 'Evoluções de enfermagem', array[]::text[], 'rascunho'),
  ('portal_evolucoes_vazio', 'site', 'familia',
   'As evoluções aparecem aqui quando forem enviadas para vocês.', array[]::text[], 'rascunho'),
  ('portal_contato_titulo', 'site', 'familia', 'Fale com a equipe', array[]::text[], 'rascunho'),
  ('portal_contato_apoio', 'site', 'familia',
   'Para qualquer dúvida, é só chamar. Este espaço não atende urgências: se algo preocupar com você ou com o bebê, liguem para o SAMU (192) ou procurem o pronto-socorro mais próximo.',
   array[]::text[], 'rascunho'),
  ('portal_sensivel_titulo', 'site', 'familia', 'Olá, {nome}.', array['nome'], 'rascunho'),
  ('portal_sensivel_texto', 'site', 'familia',
   'A nossa equipe está por perto. Se quiser conversar, fale com esta pessoa, no seu tempo.', array[]::text[], 'rascunho'),
  ('portal_sensivel_contato_titulo', 'site', 'familia', 'Quem está com vocês', array[]::text[], 'rascunho'),
  -- e-mail do link mágico (o servidor troca {link}) e convite que a equipe envia
  ('portal_email_assunto', 'email', 'familia', 'Seu link para entrar no portal da Kraamzorg', array[]::text[], 'rascunho'),
  ('portal_email_corpo', 'email', 'familia',
   E'Olá, {nome}.\n\nPara entrar no portal da sua família, use este link:\n{link}\n\nEle serve uma vez e vale por pouco tempo. Se não foi você quem pediu, pode ignorar esta mensagem.\n\nKraamzorg Brasil',
   array['nome', 'link'], 'rascunho'),
  ('portal_convite', 'whatsapp', 'familia',
   'Oi, {nome}. Preparamos o portal da sua família na Kraamzorg. Nele você acompanha os próximos passos e as datas. Para entrar, abra {endereco} e digite este e-mail: o link de acesso chega nele, sem senha.',
   array['nome', 'endereco'], 'rascunho'),

  -- P51 · página pública de candidatura (desligada por padrão)
  ('candidatura_titulo', 'site', 'familia', 'Trabalhe com a Kraamzorg', array[]::text[], 'rascunho'),
  ('candidatura_desligada', 'site', 'familia',
   'No momento a Kraamzorg não está recebendo candidaturas. Quando abrirmos, o aviso aparece aqui.', array[]::text[], 'rascunho'),
  ('candidatura_abertura', 'site', 'familia',
   'Se você é enfermeira e quer conhecer o nosso trabalho de cuidado domiciliar, deixe seus dados. A coordenação entra em contato quando houver uma seleção.',
   array[]::text[], 'rascunho'),
  ('candidatura_privacidade', 'site', 'familia',
   'Usamos estes dados só para a seleção da equipe. Você pode pedir a exclusão a qualquer momento.', array[]::text[], 'rascunho'),
  ('candidatura_consentimento', 'site', 'familia',
   'Concordo que a Kraamzorg guarde os dados desta candidatura para avaliar minha participação em seleções.',
   array[]::text[], 'rascunho'),
  ('candidatura_recebido', 'site', 'familia',
   'Recebemos a sua candidatura. A coordenação entra em contato se houver uma seleção que combine com o seu perfil.',
   array[]::text[], 'rascunho'),
  ('candidatura_limite', 'site', 'familia',
   'Recebemos muitos envios deste aparelho em pouco tempo. Aguarde um pouco e tente de novo.', array[]::text[], 'rascunho'),
  ('candidatura_erro', 'site', 'familia',
   'Não conseguimos receber a candidatura agora. Nada foi enviado. Tente de novo em instantes.', array[]::text[], 'rascunho'),

  -- P50 · aviso da tela de parceiros médicos (para a equipe)
  ('parceiros_aviso_vedacao', 'site', 'equipe',
   'Parceria com médicos é relacionamento institucional. A Kraamzorg não paga nem oferece comissão, desconto, brinde ou qualquer contrapartida financeira por indicação de paciente, porque a ética médica veda isso. Esta tela não tem campo de valor e não deve ganhar um. Texto a validar com o jurídico da Kraamzorg.',
   array[]::text[], 'rascunho')
on conflict (chave) do update
  set canal = excluded.canal, destinatario = excluded.destinatario, texto = excluded.texto,
      variaveis = excluded.variaveis;

-- -----------------------------------------------------------------------------
-- 3. Canais de captação de exemplo (a equipe de marketing edita)
-- -----------------------------------------------------------------------------

insert into privado.canal_captacao (codigo, nome, origem, ativo) values
  ('SITE', 'Site da Kraamzorg', 'site', true),
  ('IGBIO', 'Instagram, link da bio', 'instagram_organico', true),
  ('META', 'Anúncios da Meta', 'meta_ads', true),
  ('GOOGLE', 'Anúncios do Google', 'google', true)
on conflict (codigo) do update set nome = excluded.nome, origem = excluded.origem, ativo = excluded.ativo;
