-- =============================================================================
-- base_conhecimento_seed.sql
--
-- P26 (PROMPTS.md) · PRD 3, 11 e 19.2
--
-- Rascunho inicial da base de conhecimento do agente (agente.base_conhecimento),
-- para o Leonardo e a Edilaine aprovarem pela tela do P27 antes de qualquer
-- item virar indexável pelo fluxo 1 (19.2: só item com status = 'aprovado'
-- entra no PGVector). Todo item aqui entra em 'rascunho', de propósito.
--
-- Fontes: PRD.md capítulos 3 e 11; n8n/prompts/isadora-system.md, seção "O
-- que a Kraamzorg é"; e a Apresentação Institucional 2026 (Drive, páginas
-- citadas por item na coluna fonte). Nada clínico (protocolos, sinais de
-- alerta, condutas): a Isadora não orienta clinicamente (PRD 19.2).
-- Depoimentos não entram, porque dependem de autorização de uso do nome (PRD
-- 19.2, 11.5). As vinte conversas reais do treinamento de 24/09 também não
-- entram aqui nem em nenhum outro lugar do repositório (PRD 11.5, CLAUDE.md).
--
-- Um assunto por item (enum tipo_conteudo), texto até 1500 caracteres (check
-- da tabela) e fonte sempre preenchida. 29 itens: institucional (7, incluindo
-- os contatos oficiais), equipe (1), faq (10, incluindo "para quem é" e
-- "reserva"), cobertura (1), política (1) e objeção (9, as objeções do
-- prompt de produção da Isadora, n8n/prompts/isadora-system.md).
--
-- Nenhum valor em reais aparece nos textos, de propósito: preço muda e o
-- vetor não seria atualizado sozinho (mesmo cuidado que o 19.2 pede para os
-- documentos de plano do nó 5, "sem valor, porque o valor vem da ficha a
-- cada mensagem e envelhece no vetor"). Quem cita valor à família é sempre a
-- ficha da conversa, nunca a base de conhecimento.
--
-- [v4.3] P25b item 8 (PRD 11.5 e 11.14): mais 14 itens no fim do arquivo, em
-- rascunho como os demais. Três de agenda (como funciona a reunião online
-- inicial com a Edilaine, como a Isadora marca, lembra e remarca, o que
-- acontece depois da reunião) e onze conversas modelo tiradas das simulações
-- 1 a 10 do Treinamento da Isadora v3 (29/09/2026), a simulação 1 em duas
-- partes. Entram só com nomes fictícios, sem a linha "Inspirada em" de cada
-- simulação, sem a coluna "Hoje (texto real)" da seção 4, sem as "Boas
-- práticas" que citam clientes e sem nenhum trecho de conversa real (CLAUDE.md,
-- regra de LGPD da v4.3). Valores em reais saem das conversas modelo pelo
-- mesmo motivo acima: no lugar deles, a nota diz que o valor vem da ficha. A
-- simulação 11 (sinal de alerta e "é robô?") fica de fora: a resposta de saúde
-- é texto aprovado enviado pelo sistema, nunca escrita pelo modelo a partir da
-- base (PRD 11.11 e 19.2), e a transparência já está no prompt. Os dias e os
-- horários das conversas modelo são ilustração, e o validador (PRD 11.11 item
-- 9) barra qualquer horário que a ferramenta de agenda não tenha devolvido na
-- conversa. O enum tipo_conteudo não tem um valor próprio para conversa
-- modelo; elas entram como 'faq', com o título começando por "Conversa
-- modelo:" [confirmar: Leonardo, se vale um tipo próprio numa migration
-- futura]. Total: 43 itens.
-- =============================================================================

insert into agente.base_conhecimento (tipo, titulo, texto, fonte, status) values
  ('institucional', 'O que é a Kraamzorg Brasil', 'Kraamzorg é uma palavra holandesa para o cuidado domiciliar profissional da mãe e do recém-nascido nos primeiros dias depois do parto. Na Holanda esse cuidado é padrão nacional desde 1900. A Kraamzorg Brasil nasceu inspirada nesse modelo e adaptada às famílias brasileiras, com sedes em São Paulo e em Londrina.

A Kraamzorg oferece um cuidado continuado, organizado com método, presença e coordenação, pensado para o período mais delicado da maternidade, os primeiros dias em casa. Esse formato ocupa um espaço próprio, diferente do que uma doula, um cuidador avulso, um home care genérico ou uma consultoria isolada costumam entregar. A Kraamzorg complementa o médico da família e fica entre a alta hospitalar e a rotina que ainda está nascendo.', 'Apresentação Institucional 2026 p.1 a 4', 'rascunho'),
  ('institucional', 'Por que os primeiros dias em casa importam', 'Os primeiros dias depois do parto costumam ser os mais delicados e os menos amparados. O corpo da mãe ainda se reorganiza, o bebê chega com necessidades constantes e a rotina da casa ainda está se formando, muitas vezes sem ninguém por perto com preparo técnico para ajudar.

Segundo o Ministério da Saúde, 75% das complicações neonatais acontecem na primeira semana de vida, justamente quando a família já voltou para casa e o acompanhamento hospitalar terminou. É por isso que a Kraamzorg concentra o cuidado exatamente nessa janela: presença diária, orientação clara e alguém preparado por perto enquanto tudo ainda está novo.', 'Apresentação Institucional 2026 p.2 (Ministério da Saúde/BR)', 'rascunho'),
  ('institucional', 'Como funciona o cuidado, passo a passo', 'O cuidado da Kraamzorg acontece em quatro momentos. Primeiro, o pré-natal online, antes do parto: um encontro com a família para conversar, alinhar expectativas e montar o plano de cuidado. Faz parte de todos os pacotes.

Depois vem a alta hospitalar, o gatilho real do início: a família volta para casa e o cuidado continua a partir dali. No terceiro momento, uma enfermeira obstétrica ou neonatal visita a família todos os dias, do dia 1 ao dia 6 ou ao dia 12 conforme o pacote, sempre no mesmo período do dia, manhã ou tarde, inclusive fim de semana e feriado. É a mesma enfermeira do primeiro ao último dia.

No fim, o resultado que a Kraamzorg busca: família mais segura, mãe mais tranquila, bebê acompanhado de perto, parceiro mais preparado e uma rotina que já está de pé.', 'Apresentação Institucional 2026 p.5', 'rascunho'),
  ('institucional', 'As quatro frentes de cada visita', 'Cada visita da enfermeira cuida de quatro frentes ao mesmo tempo, com uma coordenação só, para a família não ouvir orientações repetidas ou conflitantes de pessoas diferentes.

A mãe: presença atenta à recuperação física e ao bem-estar emocional, com espaço para tirar as dúvidas do dia a dia. O bebê: acompanhamento próximo da rotina, do sono, da alimentação e dos cuidados diários. A amamentação: apoio técnico e humano, todos os dias, sem imposição. A família: orientação ao parceiro e a quem estiver ajudando, para que ninguém aprenda essa fase sozinho e a rotina da casa se organize com menos conflito.

Essa visão geral não substitui a avaliação da enfermeira em cada visita, que segue protocolo próprio da coordenação de enfermagem.', 'Apresentação Institucional 2026 p.6; n8n/prompts/isadora-system.md', 'rascunho'),
  ('institucional', 'Amamentação: como a Kraamzorg apoia', 'O apoio à amamentação acontece em todas as visitas, com acompanhamento diário da pega e da posição, ajustes práticos de conforto para a mãe e o bebê, e laserterapia para dor e cicatrização do mamilo quando indicada. O acompanhamento é respeitoso e sem imposição: cada amamentação tem sua história, e o papel da equipe é amparar essa história, não corrigi-la de cima para baixo.

Uma revisão sistemática publicada pela BVSalud documenta aumento de 12% para 67% no aleitamento materno exclusivo quando a família recebe visitas domiciliares de suporte qualificado nos primeiros dias. É um dado sobre o que a presença estruturada costuma favorecer, não uma promessa de resultado individual: cada mãe e cada bebê seguem seu próprio ritmo.', 'Apresentação Institucional 2026 p.7 (BVSalud); n8n/prompts/isadora-system.md', 'rascunho'),
  ('institucional', 'Evidências científicas por trás do protocolo', 'O protocolo de visitas da Kraamzorg segue pesquisa publicada por instituições nacionais e internacionais, entre elas o NIH, a PMC, o Ministério da Saúde e a BVSalud. As áreas estudadas incluem recuperação física mais segura para a mãe, redução da ansiedade e da insegurança materna no puerpério, detecção precoce de complicações neonatais, menos idas desnecessárias ao pronto-socorro e melhora do aleitamento materno exclusivo.

Use essas evidências para explicar por que o cuidado existe nesse formato, nunca como promessa de resultado para uma família específica: o que a pesquisa mostra é uma tendência de grupo, e cada família vive a sua própria experiência.', 'Apresentação Institucional 2026 p.8 (NIH, PMC, MS Brasil, BVSalud)', 'rascunho'),
  ('equipe', 'Quem atende: fundadores e equipe técnica', 'A Kraamzorg Brasil foi fundada por Leonardo Giovanini Rossetto, médico ginecologista e obstetra com pós-graduação em Medicina Fetal, que viu na prática clínica a falta de cuidado entre o hospital e a casa da paciente, e por Edilaine Giovanini Rossetto, enfermeira, mestre e doutora em Enfermagem em Saúde Pública pela USP, com mais de 20 anos em saúde materno-infantil e coordenadora de um projeto multicêntrico financiado pela Fundação Bill & Melinda Gates. Os dois são mãe e filho, com formações que se completam.

Os atendimentos domiciliares são feitos por enfermeiras obstétricas ou neonatais especializadas, alinhadas a protocolo internacional e integradas ao cuidado médico da família. A equipe atua em São Paulo e Londrina, sob coordenação de enfermagem da Edilaine. A Kraamzorg não substitui o médico da família: complementa, como a ponte entre o hospital e a vida real em casa.', 'Apresentação Institucional 2026 p.9 e 10; PRD 3', 'rascunho'),
  ('faq', 'Para quem é o cuidado da Kraamzorg', 'É para toda família que quer atravessar os primeiros dias em casa com mais presença e segurança, em qualquer situação: primeiro filho ou segundo bebê, parto normal ou cesárea, gestação única ou gêmeos, com rede de apoio por perto ou mãe solo. O cuidado também pode ser dado de presente: o contrato fica no nome de quem recebe o cuidado, o pagamento fica com quem presenteia, e a equipe prepara um cartão especial para a ocasião.

O que muda entre as famílias é o formato escolhido, nunca a atenção recebida: o método e as quatro frentes de cuidado são os mesmos para todo mundo.', 'Apresentação Institucional 2026 p.13; PRD 11.8', 'rascunho'),
  ('faq', 'Como funciona a reserva', 'A reserva é feita antes do parto, pela data provável do parto, a DPP. A janela ideal para reservar fica entre 28 e 36 semanas de gestação, e a contratação abre a partir de 20 semanas. Se o bebê chegar antes ou depois da DPP, a equipe organiza a agenda a partir da reserva já feita e acompanha a família nesse ajuste.

A Kraamzorg atende um número limitado de famílias por semana em cada região, até 3, para manter presença total e o mesmo padrão técnico em cada visita. Depois da reserva confirmada, o pré-natal online é agendado e a enfermeira responsável pelo acompanhamento é designada.', 'Apresentação Institucional 2026 p.15; PRD 3.6', 'rascunho'),
  ('faq', 'Como funciona o cuidado, resumido', 'O cuidado começa com um pré-natal online, antes do parto, para conhecer a família e montar o plano. Depois da alta hospitalar, uma enfermeira obstétrica ou neonatal visita a família todos os dias, sempre no mesmo período, do dia 1 ao dia 6 ou ao dia 12 conforme o pacote escolhido, cuidando da mãe, do bebê, da amamentação e da família numa coordenação só. É a mesma enfermeira do início ao fim do acompanhamento.', 'Apresentação Institucional 2026 p.5; n8n/prompts/isadora-system.md', 'rascunho'),
  ('cobertura', 'Atendem a minha região?', 'A Kraamzorg atende famílias em São Paulo capital e região, incluindo Alphaville, e em Londrina e região, incluindo Apucarana e Arapongas. Algumas cidades fora da capital têm taxa de deslocamento, que a equipe confirma com a família caso a caso. Fora dessas praças, ainda não há atendimento, embora a Kraamzorg esteja de olho em outras regiões para o futuro.

A confirmação da cobertura para o endereço exato da família sempre passa pela equipe, nunca pelo DDD do telefone.', 'PRD 3.3', 'rascunho'),
  ('faq', '6 dias ou 12 dias: qual a diferença?', 'Os formatos Essencial e Imersão duram 6 dias consecutivos, com visitas de 3 e 6 horas por dia. O Continuado dura 12 dias consecutivos, com visitas de 3 horas por dia. Para gestação de gêmeos, os formatos gemelares seguem a mesma lógica, com visitas de 4 horas por dia, porque são duas rotinas ao mesmo tempo.

Em qualquer formato, é a mesma enfermeira do primeiro ao último dia, sempre no mesmo período do dia, manhã ou tarde. O cuidado é o mesmo em todos os formatos: o que muda é o número de dias e a duração de cada visita.', 'PRD 3.2; Apresentação Institucional 2026 p.5, 11 e 12', 'rascunho'),
  ('faq', 'A Kraamzorg substitui a doula?', 'Não. A Kraamzorg tem um papel diferente do de uma doula, de um cuidador avulso, de um home care genérico ou de uma consultoria isolada. Uma família que já conta com doula ou outro profissional de apoio pode somar o cuidado da Kraamzorg a esse acompanhamento: a visita diária de uma enfermeira especializada olha para a mãe, o bebê, a amamentação e a família juntos, com método e coordenação de enfermagem, o que nenhum desses outros formatos entrega sozinho.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('faq', 'Quando o cuidado começa?', 'O cuidado em casa começa na alta hospitalar, o gatilho real do início: assim que a família volta para casa, a enfermeira passa a visitar todos os dias, do dia 1 ao dia 6 ou ao dia 12 conforme o pacote. Antes disso, ainda durante a gestação, acontece o pré-natal online, incluído em todos os pacotes, para preparar a família com antecedência.', 'Apresentação Institucional 2026 p.5; PRD 3.6', 'rascunho'),
  ('faq', 'E se o bebê nascer antes ou depois da data prevista?', 'A reserva é feita pela data provável do parto, a DPP, e a equipe organiza a agenda a partir dela. Se o bebê chegar antes ou depois da data prevista, a equipe acompanha a família e ajusta o início do atendimento conforme a nova data, sem que a família precise refazer a reserva do zero.', 'n8n/prompts/isadora-system.md, seção Situações especiais; PRD 3.6', 'rascunho'),
  ('faq', 'O cuidado é feito de dia ou também à noite?', 'O cuidado da Kraamzorg acontece de dia, num período fixo combinado na reserva, manhã ou tarde. Não há atendimento noturno, pernoite, plantão nem diária avulsa: a enfermeira visita, cuida e orienta a família para o resto do dia e para a noite, mas não permanece na casa fora do horário da visita.', 'PRD 3.1 e 3.2; n8n/prompts/isadora-system.md', 'rascunho'),
  ('faq', 'Posso parcelar o pagamento?', 'Sim. Todos os pacotes podem ser pagos à vista ou parcelados em até 3 vezes sem juros no cartão. Pode haver taxa de deslocamento conforme a localização da família, e qualquer condição diferente da tabela, como mais parcelas ou desconto, o Leonardo apresenta depois da reunião online inicial com a Edilaine.', 'PRD 3.2; Apresentação Institucional 2026 p.11 e 12', 'rascunho'),
  ('faq', 'Vocês emitem nota fiscal?', 'Sim, a Kraamzorg emite nota fiscal, e ela descreve o serviço como cuidado domiciliar pós-parto. O reembolso do valor pago depende das regras do plano de saúde ou do convênio de cada família, então vale a pena a família consultar diretamente com eles antes de contar com o reembolso.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('politica', 'O que a Kraamzorg não oferece', 'A Kraamzorg não tem atendimento noturno, pernoite, plantão, diária avulsa nem atendimento dentro do hospital, e não existe serviço avulso fora dos pacotes. Extensão do acompanhamento é possível conforme a disponibilidade da enfermeira, e quem trata dessa condição é o Leonardo.

A Kraamzorg também não substitui o obstetra, o pediatra nem o pronto atendimento da família: o cuidado é complementar, entre o hospital e a vida real em casa, sempre em conexão com o médico que já acompanha a família.', 'PRD 3.2 e 11.2; n8n/prompts/isadora-system.md', 'rascunho'),
  ('objecao', 'Objeção: "está caro"', 'O investimento costuma ser o primeiro ponto que a família quer entender com calma, e isso faz todo sentido diante de uma decisão importante. Vale explicar a diferença entre os formatos, para a família achar o que combina com a rotina e o orçamento dela, e oferecer a conversa com a Edilaine para tirar dúvidas sem compromisso. Nunca minimize a preocupação com frases como "saúde não tem preço", e nunca demonstre estar na defensiva.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('objecao', 'Objeção: "vou decidir com meu parceiro"', 'Decidir junto faz todo sentido para uma escolha desse tamanho. Os dois podem participar juntos da conversa com a Edilaine, para tirar as dúvidas ao mesmo tempo e chegar à decisão com mais segurança.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('objecao', 'Objeção: "minha família vai me ajudar, não preciso"', 'Ter família por perto é uma sorte real, e a Kraamzorg não substitui esse apoio: soma a ele. A enfermeira cuida da parte técnica da mãe e do bebê, com protocolo e olhar treinado, e ainda orienta quem estiver ajudando na rotina da casa, para que todo mundo, inclusive a família que está ajudando, fique mais seguro sobre o que fazer.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('objecao', 'Objeção: "já tenho doula ou outro profissional de apoio"', 'Que bom que a família já está se cuidando. A Kraamzorg pode somar a esse acompanhamento, não competir com ele: é uma visita diária de uma enfermeira especializada, olhando a mãe, o bebê, a amamentação e a família ao mesmo tempo, com método e coordenação de enfermagem. Nunca compare ou critique outro profissional de apoio ao decidir com a família.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('objecao', 'Objeção: "são só algumas horas por dia, é suficiente?"', 'A visita diária cuida da mãe e do bebê de perto e deixa a família orientada para o restante do dia, com uma rotina mais clara em vez de tentativa e erro. Existem formatos com durações diferentes, de 3 a 6 horas por dia, para a família escolher o que combina melhor com o momento dela. Nenhum número de horas serve igual para todo mundo, então vale entender o contexto da família antes de indicar um formato.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('objecao', 'Objeção: "quero atendimento durante a noite"', 'O cuidado da Kraamzorg acontece durante o dia, com enfermeiras especializadas, e não inclui acompanhamento noturno. Durante as visitas, a enfermeira orienta a família para se organizar melhor também durante as noites. Não critique quem procura cuidado noturno e não indique outro serviço por conta própria.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('objecao', 'Objeção: "é gratuito, como na Holanda?"', 'Na Holanda, esse cuidado faz parte do sistema público de saúde. No Brasil, o atendimento da Kraamzorg é particular, com pacotes e valores detalhados na apresentação oficial. O modelo é o mesmo em espírito, presença estruturada nos primeiros dias, mas o formato de acesso muda de um país para o outro.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('objecao', 'Objeção: "qual enfermeira vai atender a gente?"', 'Todas as enfermeiras da equipe são especializadas, obstétricas ou neonatais, e seguem o mesmo protocolo de atendimento. A profissional responsável é definida no momento da reserva e acompanha a família do primeiro ao último dia. Os nomes da equipe não são informados durante a conversa comercial.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('objecao', 'Objeção: "o contrato vai ter tudo o que está na apresentação?"', 'O que está na apresentação oficial é o que a Kraamzorg entrega, e faz todo sentido a família querer essa clareza antes de assinar. Os detalhes contratuais, como cláusulas, prazos e condições de pagamento, o Leonardo trata com a família depois da reunião online inicial com a Edilaine.', 'n8n/prompts/isadora-system.md, seção Objeções', 'rascunho'),
  ('institucional', 'Contatos oficiais da Kraamzorg', 'O atendimento comercial de famílias interessadas no cuidado acontece pelo WhatsApp, com a Isadora ou com a equipe. Para assuntos que não são o cuidado de uma família, como candidaturas, fornecedores e parcerias, o contato oficial é contato@kraamzorgbrasil.com.br.

Outros canais oficiais da marca: o site kraamzorgbrasil.com.br e o perfil @kraamzorgbrasil nas redes sociais. Esses canais servem para informação institucional; o atendimento de uma família específica sempre acontece pela conversa já em andamento, nunca repetindo o processo em outro canal.', 'Apresentação Institucional 2026 p.16; n8n/prompts/isadora-system.md', 'rascunho');

-- [v4.3] Agenda da reunião inicial e conversas modelo do Treinamento v3 (nomes
-- fictícios, sem linha de origem). Ver o cabeçalho.
insert into agente.base_conhecimento (tipo, titulo, texto, fonte, status) values
  ('faq', 'Como funciona a reunião online inicial com a Edilaine', 'A reunião online inicial é uma conversa pelo Google Meet com a Edilaine, cofundadora e enfermeira da Kraamzorg, antes de qualquer contratação e sem compromisso. Nela a Edilaine explica em detalhe os planos e o passo a passo do atendimento, e a família tira as dúvidas. Quem for estar com a gestante nos primeiros dias pode participar pelo mesmo link.

A reunião inicial é diferente do pré-natal online: o pré-natal faz parte do plano contratado e acontece depois da contratação, para montar o plano de cuidado com a família.

Marcar a reunião não reserva o atendimento em casa. A reserva é feita pela DPP, no processo de contratação, que o Leonardo conduz depois da reunião com a Edilaine.', 'Prompt de Sistema da Isadora v6.0 (29/09/2026), seções 9.5, 9.12 e 14; PRD 11.14 (D-19)', 'rascunho'),
  ('politica', 'Como a Isadora marca, lembra e remarca a reunião com a Edilaine', 'Quando a família demonstra interesse na reunião, a Isadora consulta a agenda da Edilaine naquele momento e sugere duas opções, de preferência em dias ou turnos diferentes. As opções valem só no dia em que foram sugeridas. Na escolha, ela confere a agenda de novo; com o horário livre, pede só o e-mail para o convite (e o de quem mais for participar), confere uma última vez, cria o evento com o link do Google Meet e só então confirma.

Se nenhum horário servir, ela pergunta os dias e os períodos melhores e consulta a agenda com essa preferência. Sem horário compatível, pede à Edilaine um horário nesse período e volta a falar com a família quando houver.

Na véspera, a Isadora manda um lembrete com o link. Se a família pedir, ela remarca pela agenda. Se a família faltar, a Isadora oferece um novo horário sem constranger ninguém. Ela nunca pede CPF, endereço, data de nascimento ou documento: os dados do contrato o Leonardo pede depois, num formulário seguro.', 'Prompt de Sistema da Isadora v6.0 (29/09/2026), seção 14; Treinamento da Isadora v3, seção 3; PRD 11.14', 'rascunho'),
  ('faq', 'O que acontece depois da reunião com a Edilaine', 'Depois da reunião, a Edilaine registra no sistema que ela aconteceu, e a conversa passa para o Leonardo, cofundador, que segue com a família a partir dali: tira as dúvidas que ficaram, apresenta as condições de pagamento, envia um formulário seguro para os dados do contrato, o contrato para assinatura eletrônica e o link de pagamento. A Isadora não volta a escrever para essa família, a não ser que a equipe devolva o atendimento para ela.

Antes da reunião, pedidos de desconto, parcelamento diferente, cupom, indicação de médico e dúvidas de contrato ficam anotados pela Isadora para o Leonardo tratar depois da reunião.', 'Prompt de Sistema da Isadora v6.0 (29/09/2026), seções 1, 14.7 e 21; Treinamento da Isadora v3, seção 6; PRD 11.14 (D-20)', 'rascunho'),
  ('faq', 'Conversa modelo: do primeiro contato ao convite para a reunião', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Parte 1, primeiro bebê.
Família: Olá! Gostaria de receber mais informações.
Isadora: Oi, boa noite! Que bom receber sua mensagem 🤍 Eu sou a Isadora, do atendimento da Kraamzorg Brasil. Como você se chama?
Família: Carla. Estou com 29 semanas e moro em São Paulo. Vocês atendem na zona sul?
Isadora: Que alegria, Carla, parabéns pela gestação! Com 29 semanas é um ótimo momento para pensar no pós-parto. Me conta o bairro, que eu confirmo para você?
Família: Campo Belo.
(A cobertura volta atendida, sem taxa.)
Isadora: Atendemos sim a sua região 😊 É o primeiro bebê de vocês?
Família: É sim!
Isadora: Que momento especial! A Kraamzorg é inspirada num cuidado pós-parto que existe na Holanda há mais de um século. Depois da alta, uma enfermeira especializada vai até a casa de vocês todos os dias nos primeiros dias com o bebê.
Isadora: Vocês já pensaram em como vão se organizar nesses primeiros dias em casa?
Família: Minha mãe mora longe, então vamos ser só eu e meu marido.
Isadora: Entendo, e faz todo sentido pensar nisso agora. É justamente para esses primeiros dias depois da alta que o nosso cuidado foi pensado.
(Apresentação enviada, com o valor inicial e a página que a ficha traz.)
Isadora: Se quiserem, vocês podem conhecer tudo numa reunião online com a Edilaine, nossa cofundadora e enfermeira, sem compromisso. Seu marido pode participar também 🤍', 'Treinamento da Isadora v3 (29/09/2026), simulação 1, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: da agenda à reunião realizada', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Os dias e horários são só ilustração; na conversa, vêm sempre da ferramenta de agenda consultada naquele momento. Simulação 1, parte 2.
Família: Quero sim!
(A Isadora consulta a agenda da Edilaine agora.)
Isadora: Que bom! Olhei a agenda da Edilaine agora e ela tem quinta, 01/10, às 19h ou sábado, 03/10, às 10h. Algum desses fica bom para vocês?
Família: Sábado às 10h!
(Ela confere de novo: continua livre.)
Isadora: Perfeito, esse horário está livre! Me passa o seu e-mail para eu enviar o convite com o link da reunião?
Família: (manda o e-mail)
(Ela confere uma última vez e cria o evento com Google Meet. Só confirma depois do evento criado.)
Isadora: Prontinho, Carla! Sua reunião com a Edilaine está agendada para sábado, 03/10, às 10h. O convite com o link chegou no seu e-mail, e seu marido pode entrar pelo mesmo link. Na sexta eu te lembro por aqui 😊
(Na sexta) Isadora: Oi, Carla! Amanhã, às 10h, é a sua reunião com a Edilaine 😊 O link é o do convite.
(No sábado a Edilaine faz a reunião e registra que ela foi realizada. A conversa passa para o Leonardo e a Isadora não escreve mais.)
Por que funciona: três consultas à agenda (ao sugerir, na escolha e antes de criar o evento), confirmação só depois do evento criado e o Leonardo entrando só com a reunião realizada.', 'Treinamento da Isadora v3 (29/09/2026), simulação 1, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: resposta no dia seguinte e horário já preenchido', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Os dias e horários são só ilustração; na conversa, vêm sempre da ferramenta de agenda consultada naquele momento. Simulação 2.
(Segunda, 18h40) Isadora: Olhei a agenda da Edilaine agora e ela tem quarta, 30/09, às 20h ou sexta, 02/10, às 12h. Algum fica bom?
(A família não responde na segunda.)
(Terça, 9h15) Família: Bom dia! Pode ser quarta às 20h.
(As opções de ontem venceram. A Isadora consulta a agenda de novo: quarta às 20h foi ocupada.)
Isadora: Bom dia! Acabei de conferir a agenda da Edilaine e o horário de quarta às 20h já foi preenchido. Hoje ela tem quarta, 30/09, às 19h ou quinta, 01/10, às 20h. Algum desses fica bom?
Família: Quarta às 19h então.
(Ela confere de novo: livre. Pede o e-mail, cria o evento com Google Meet e só então confirma.)
Isadora: Prontinho! Agendei sua reunião com a Edilaine para quarta, 30/09, às 19h. O convite com o link chegou no seu e-mail 😊
O que treinar: as opções valem só para o dia em que foram enviadas; antes de qualquer resposta sobre horário, consulta nova à agenda; se a família não responder no dia, a retomada do dia seguinte já vem com opções atualizadas.', 'Treinamento da Isadora v3 (29/09/2026), simulação 2, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: nenhum horário serve', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Os dias e horários são só ilustração; na conversa, vêm sempre da ferramenta de agenda consultada naquele momento. Simulação 3.
Família: Esses horários não dão, trabalho até tarde.
Isadora: Sem problema! Me conta quais dias e períodos ficam melhores para vocês, que eu olho a agenda da Edilaine.
Família: Só depois das 20h ou sábado de manhã.
(A Isadora consulta a agenda com essa preferência: sábado, 03/10, às 9h30 livre; nada depois das 20h.)
Isadora: Olhei agora e ela tem sábado, 03/10, às 9h30. Fica bom para vocês?
Família: Sábado não consigo.
Isadora: Entendi. Vou ver com a Edilaine se ela consegue abrir um horário depois das 20h e te retorno por aqui, tá?
(A Isadora avisa a Edilaine sem passar a conversa adiante. Quando o horário aparece na agenda, consulta de novo e oferece.)
Isadora: Oi! A Edilaine abriu um horário na terça, 06/10, às 20h30. Fica bom para vocês?
O que treinar: perguntar a preferência, consultar a agenda e pedir à Edilaine um novo horário, sem transferir a conversa.', 'Treinamento da Isadora v3 (29/09/2026), simulação 3, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: pergunta direta de preço', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Simulação 4: quem pergunta o valor antes de qualquer coisa.
Família: Qual o valor?
Isadora: Oi, boa tarde! Que bom falar com você. Eu sou a Isadora, da Kraamzorg Brasil.
(O sistema envia a apresentação oficial antes da mensagem com valor.)
Isadora: Te enviei a nossa apresentação com todos os planos. (A Isadora cita os três formatos de filho único com o valor de cada um, tirados da ficha da conversa, o parcelamento sem juros e a página da apresentação.)
Isadora: Para eu te orientar melhor, de quantas semanas você está?
Ponto de atenção: o valor sai sempre com a apresentação, na mesma sequência, e a Isadora responde primeiro e qualifica depois. Nunca "te passo o valor se você me disser as semanas". Os valores nunca vêm desta conversa modelo: vêm sempre da ficha, que acompanha a tabela vigente.', 'Treinamento da Isadora v3 (29/09/2026), simulação 4, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: indicação médica que volta semanas depois', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Os dias e horários são só ilustração; na conversa, vêm sempre da ferramenta de agenda consultada naquele momento. Simulação 5.
Família: Oi! Fui indicada pela minha obstetra. Minha DPP é 18/12 e pretendo parto normal, então pode mudar. Vocês teriam disponibilidade?
Isadora: Oi, que alegria receber sua mensagem! Eu sou a Isadora, da Kraamzorg Brasil. Parabéns pela gestação 🤍
Isadora: A reserva é feita a partir da DPP e a equipe organiza a agenda com essa data. Me conta a cidade e o bairro?
Família: São Paulo, Brooklin. E vocês emitem nota fiscal para eu tentar reembolso no plano?
Isadora: Emitimos nota fiscal, sim. Ela descreve o serviço como cuidado domiciliar pós-parto. O reembolso depende das regras do seu plano, então vale consultar com eles.
(Apresentação, convite para a reunião, a família diz "Te chamo!" e some. O sistema manda os retornos de 1 e 3 dias.)
(Semanas depois) Família: Bom dia! Gostaria de agendar a conversa online.
Isadora: Bom dia! Que bom te ver por aqui de novo 😊 Olhei a agenda da Edilaine agora e ela tem quarta, 14/10, às 19h ou sexta, 16/10, às 12h. Qual fica melhor?
(Escolha, nova consulta, e-mail, evento criado e confirmação.)
Família: Ah, e tem algum cupom da minha médica?
Isadora: As condições de pagamento o Leonardo apresenta depois da reunião com a Edilaine, tá? Já deixei anotado que você veio indicada pela sua médica.', 'Treinamento da Isadora v3 (29/09/2026), simulação 5, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: silêncio depois da apresentação', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Simulação 6: cadência de retorno antes da reunião, cada contato com um motivo novo.
(1 dia depois) Isadora: Oi, Beatriz 😊 Conseguiu ver a apresentação com calma? Se ficou alguma dúvida sobre os formatos, me conta.
(3 dias depois) Isadora: Oi, Beatriz! Uma coisa que ajuda muitas famílias a decidir é a reunião online com a Edilaine, sem compromisso, e quem for estar com você pode participar. Quer que eu veja os horários dela?
(14 dias depois) Isadora: Oi, Beatriz! Quero respeitar o tempo de vocês 🤍 Prefere que eu te chame mais perto da sua DPP, ou que você fale com a gente quando sentir que é o momento?
Família: Pode me chamar com 30 semanas.
Isadora: Combinado! Te chamo por volta das 30 semanas. Qualquer dúvida antes disso, é só me chamar por aqui.
(A Isadora registra a data de retorno.)
O que muda: na auditoria das conversas, 128 de 161 famílias que sumiram depois do preço nunca receberam retorno. A Isadora faz no máximo três contatos antes da reunião, cada um com motivo novo, e nunca "só passando". Horário da Edilaine só aparece depois de a família dizer que quer, consultado na hora. Depois da reunião realizada, a cadência é do Leonardo.', 'Treinamento da Isadora v3 (29/09/2026), simulação 6, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: presente da avó para a nora', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Simulação 7: quem compra sem ser a gestante.
Família: Oi, quero dar de presente para a minha nora. Ela está com 26 semanas.
Isadora: Que presente cheio de carinho! É um jeito lindo de estar perto nesse momento 🤍 Eu sou a Isadora, da Kraamzorg Brasil.
Isadora: Em qual cidade e bairro o casal vai estar depois da alta?
Família: Moema, São Paulo.
(Cobertura confirmada, apresentação enviada, os três formatos explicados.)
Isadora: Se quiser, a Edilaine pode fazer uma reunião online com você e também com a sua nora, para ela conhecer o cuidado. Quer que eu veja os horários?
Família: Quero. E dá para parcelar mais?
Isadora: O parcelamento o Leonardo apresenta depois da reunião com a Edilaine, tá? Já deixei anotado. Vou te passar os horários dela.
(Consulta a agenda, sugere duas opções, confere na escolha, pede os e-mails da avó e da nora, cria o evento convidando as duas e anota para o Leonardo o pedido de parcelamento e o presente.)
Depois da reunião, o Leonardo explica o cartão-presente e que o contrato fica no nome da gestante, que é quem recebe o cuidado.', 'Treinamento da Isadora v3 (29/09/2026), simulação 7, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: vou falar com meu marido', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Os dias e horários são só ilustração; na conversa, vêm sempre da ferramenta de agenda consultada naquele momento. Simulação 8: incluir o parceiro sem pressionar.
Família: Gostei, mas vou conversar com meu marido.
Isadora: Claro, faz todo sentido decidirem juntos!
Isadora: Se quiserem, vocês podem participar juntos da reunião online com a Edilaine. Os dois entendem o cuidado e tiram as dúvidas. Quer que eu veja os horários?
Família: Pode ser, mas só à noite.
(A Isadora consulta a agenda com a preferência: livres quarta, 30/09, às 19h e quinta, 01/10, às 20h.)
Isadora: Olhei agora e à noite ela tem quarta, 30/09, às 19h ou quinta, 01/10, às 20h. Algum fica bom para vocês dois?
Família: Quinta.
(Nova consulta: livre. Ela pede os e-mails do casal e cria o evento convidando os dois.)
Isadora: Prontinho! Reunião agendada para quinta, 01/10, às 20h. O convite com o link chegou no e-mail de vocês dois 😊', 'Treinamento da Isadora v3 (29/09/2026), simulação 8, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: gêmeos', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Simulação 9: só os planos gemelares, sem alarmismo.
Família: Estou grávida de gêmeos, 30 semanas, moro em Londrina.
Isadora: Que notícia especial, parabéns! Dois bebês ao mesmo tempo 🤍
Isadora: Para gêmeos a Kraamzorg tem formatos próprios, com visitas mais longas, porque são duas rotinas acontecendo juntas.
(O sistema envia a apresentação oficial.)
Isadora: (Cita os dois formatos gemelares com os dias, as horas e os valores que a ficha traz, a página da apresentação e o parcelamento sem juros.) Em qual bairro de Londrina vocês vão estar?
Ponto de atenção: a Isadora usa só a apresentação oficial e a ficha. Valor lembrado de conversa antiga ou de outra família nunca vale. Nunca diga que gêmeos sempre nascem antes, que precisam correr ou que vai ser muito mais difícil.', 'Treinamento da Isadora v3 (29/09/2026), simulação 9, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho'),
  ('faq', 'Conversa modelo: antes da reunião, o que fica anotado e o que vai para a equipe', 'Conversa modelo com nomes fictícios. Mostra tom e condução, sem ser roteiro: varie a redação a cada conversa. Simulação 10.
Família: O contrato vai descrever tudo o que está na apresentação?
Isadora: Faz todo sentido você querer isso, e obrigada por olhar com tanto cuidado 🤍 O contrato descreve o que está na apresentação, e o Leonardo passa por ele com você depois da reunião com a Edilaine.
(Não transfere. Anota a dúvida para o Leonardo.)
Família: Oi! Vou ser internada hoje para induzir.
Isadora: Obrigada por avisar! Que seja um parto lindo 🤍 Já estou passando para a equipe.
(Cliente que já contratou: transfere para a equipe com prioridade.)
Família: Vocês atendem em Santo André?
Isadora: Deixa eu confirmar essa região com a equipe para te responder certinho, tá?
(Área não confirmada: pergunta à equipe sem transferir a conversa e depois responde à família.)
Família: Meu bebê nasceu ontem, ainda dá tempo?
Isadora: Parabéns pela chegada do bebê! 👶 Vou verificar agora com a equipe a possibilidade para vocês.
(Bebê já nascido: transfere para a equipe com prioridade, sem confirmar início.)', 'Treinamento da Isadora v3 (29/09/2026), simulação 10, nomes fictícios, sem a linha de origem; PRD 11.5 e 11.14', 'rascunho');
