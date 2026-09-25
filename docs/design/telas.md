# Inventário de telas · Kraamzorg OS (protótipo)

Para os três construtores: **enfermeira**, **comercial** e **coordenacao**. Cada tela é um HTML estático em `docs/prototipo/`, com o nome indicado, e segue `DESIGN.md` (direção "Caderneta de visita") e `fluxos.md`.

## Regras comuns a todos os construtores

1. Todo arquivo carrega, nesta ordem: `assets/tokens.css`, `assets/base.css`, `assets/icones.js`. Estilo específico da tela vai num `<style>` curto que usa só variáveis de `tokens.css` (nenhum hex, nenhuma fonte, raio ou sombra nova). Se faltar componente, descreva no retorno em vez de inventar um estilo paralelo.
2. Ícones só do sprite: `<svg class="icone"><use href="#i-nome"/></svg>`. A lista de nomes está no topo de `assets/icones.js`.
3. Português do Brasil, frases completas, sem travessão nem meia-risca, sem emoji, sem "mãezinha", "mamãe", "papai". Formatos: R$ 7.800, 24/09/2026, 11:42, 34s2d, 38,2 °C, 3.240 g, D4 de 6.
4. Só os dados fictícios da tabela abaixo. Nunca nome de paciente, médico ou profissional real.
5. Data de referência do protótipo: **quinta-feira, 24/09/2026**, fuso de Brasília.
6. Mostrar os estados pedidos em cada tela. Um jeito simples: a tela principal no estado típico e, abaixo dela, uma seção "Estados" com as variações lado a lado (no celular, empilhadas), cada uma com um título curto.
7. Verificar: `python3 <skill interface-2026>/scripts/lint_slop.py docs/prototipo` sem achado ALTA além da declaração de Inter; captura em 390 x 844 e 1280 x 800 com `scratchpad/tools/shot.mjs`; no máximo duas rodadas.
8. Nome de família nunca no `<title>` da página nem em nome de arquivo.

## Dados fictícios compartilhados

| Família | Pessoas | Situação em 24/09/2026 | Local | Contato |
| :-- | :-- | :-- | :-- | :-- |
| Família Teste Aurora | Lívia Teste (gestante, 31), Caio Teste, bebê Nina Teste | Essencial 6 dias, manhã 08:00, **D4 de 6**. DPP 25/09/2026 (estimativa), nascimento 18/09/2026, alta 20/09/2026, início 21/09/2026. Ficha do D3 pendente. Hoje: temperatura 38,2 °C dispara PU-01. Enfermeira Talita Moreno. | Rua Fictícia das Acácias, 120, Moema, São Paulo | +55 11 90000-0011 |
| Família Teste Brisa | Renata Teste | Aguardando nascimento, DPP 02/10/2026. **Freio em bloqueio total** desde 24/09/2026, 09:14, acionado por Otávio Lemos; justificativa pendente. | Pinheiros, São Paulo | +55 11 90000-0012 |
| Família Teste Cedro | Paula Teste, bebês Bento Teste e Lia Teste (gêmeos) | Gemelar Continuado 12 dias, tarde 14:00, **D7 de 12**. D5 teve RN-10 (icterícia zona III, fechado). Enfermeira Talita Moreno. | Vila Mariana, São Paulo | +55 11 90000-0013 |
| Família Teste Dália | Bianca Teste | Lead quente, **32s4d**, DPP 15/11/2026. Quer contratar Imersão (R$ 7.800), Pix. Transferência vence em 38 min. | Pinheiros, São Paulo | +55 11 90000-0014 |
| Família Teste Estrela | Carla Teste | Lead morno, 24s1d, DPP 13/01/2027. PDF enviado, follow-up D+3 vence hoje, 17:00. | Londrina, PR | +55 11 90000-0015 |
| Família Teste Figueira | Dora Teste, bebê Tomás Teste | Continuado 12 dias, manhã 09:00, D2 de 12. Enfermeira Marta Quintela. | Londrina, PR | +55 11 90000-0016 |
| Família Teste Garoa | Elisa Teste | **Relato de saúde** às 13:52 ("estou com dor de cabeça forte e vendo pontinhos"), 36s0d, DPP 22/10/2026. Prioridade máxima, coordenação clínica. | Santo André, SP | +55 11 90000-0017 |
| Família Teste Horizonte | Fernanda Teste | Pagamento confirmado, 33s0d, DPP 12/11/2026. Sem titular: **oferta pendente** para Rosana Vieira desde 23/09, 20:10, expira 26/09/2026, 18:00. | Moema, São Paulo | +55 11 90000-0018 |
| Família Teste Ipê | Gabriela Teste | Nutrição, 18s3d. | Tatuapé, São Paulo | +55 11 90000-0019 |
| Família Teste Jasmim | Helena Teste, Rui Teste | **Entrevista pré-natal em andamento**, parou na etapa 4 de 8 em 24/09/2026, 19:40. 34s2d, DPP 03/11/2026, Maternidade Fictícia do Sul. | Alphaville, Barueri | +55 11 90000-0020 |

Equipe fictícia: enfermeiras Talita Moreno (obstétrica, São Paulo, COREN-SP 000.001 fictício), Rosana Vieira (neonatal, São Paulo), Priscila Andrade (obstétrica, Alphaville e Cotia), Marta Quintela (obstétrica, Londrina), Joana Bastos (em contratação). Coordenação clínica: Beatriz Falcão. Comercial e diretoria: Otávio Lemos. Supervisão médica de plantão: +55 11 90000-0001. Coordenação: +55 11 90000-0002. Obstetra fictício: Dr. Sérgio Fictício (+55 11 90000-0030); pediatra fictícia: Dra. Vera Fictícia (+55 11 90000-0031).

---

## Grupo enfermeira

Abas inferiores: Hoje, Famílias, Alertas, Perfil. Viewport principal 390 x 844; conferir em 1280 (conteúdo centralizado em até 720 px, sem barra lateral para este papel).

### E1 · Hoje · `enfermeira-hoje.html`
- **Objetivo:** saber em 5 segundos onde ir agora e o que está pendente.
- **Conteúdo:** título "Hoje, quinta 24/09" (t-display), indicador de sincronização; cartão da visita das 08:00 (Família Teste Aurora, endereço, régua D4 de 6 com D3 hachurado, selo "Ficha do D3 ainda não assinada", botão "Cheguei, iniciar visita"); cartão das 14:00 (Família Teste Cedro, gêmeos, D7 de 12); faixa "Ficha pendente: D3 da Família Teste Aurora. Assine até hoje, 18:00."; amanhã em uma linha.
- **Estados:** carregando (esqueleto de dois cartões); vazio ("Nenhuma visita marcada para hoje..." com "Ver minha semana"); offline (faixa informativa, dados do dia em cache com a hora); oferta nova no topo (Família Teste Horizonte, "Aceitar" e "Recusar"); alerta aberto de uma família (faixa imediata no topo com link).

### E2 · Checklist, etapa Sinais vitais com alerta · `enfermeira-checklist-vitais.html`
- **Objetivo:** responder a etapa 3 do DOC 2 com uma mão e agir no alerta PU-01 sem perder nada.
- **Conteúdo:** cabeçalho fixo (Família Teste Aurora, D4, Freio, "Salvo no aparelho"), trilha de 8 etapas com a 3 atual; campos Temperatura 38,2 °C em alerta ("No D3 foi 36,9 °C"), PA 118/76, FC 88 bpm; faixa PU-01 com "Ligar para a supervisão" (tel +55 11 90000-0001) e "Registrar acionamento"; botão fixo "Registrar outro sinal de alerta"; barra inferior "Voltar" e "Próxima etapa".
- **Estados:** vazio da etapa (campos sem valor, nada pré-preenchido); erro de digitação (FC 8 bpm); offline (faixa "a coordenação recebe o alerta quando a conexão voltar. Se for urgente agora, ligue."); enviando; sincronizado; faixa presa no topo depois de rolar; folha "Registrar acionamento" aberta com os quatro campos (sinal PU-01, horário 10:14, orientação médica, conduta).

### E3 · Checklist, etapa Puérpera e amamentação · `enfermeira-checklist-perguntas.html`
- **Objetivo:** mostrar o ritmo de perguntas sim ou não, escala 0 a 10 e a cópia confirmada campo a campo.
- **Conteúdo:** etapa 2 (Puérpera): 6 perguntas sim ou não, dor 3 de 10, local "incisão", "Medicações em uso" com "Trazer o texto do D3" já acionado (estado copiado com "Vale para hoje"); etapa 4 resumida abaixo: EVN, lesão mamilar (chips não, direita, esquerda, ambas), LATCH 7 com link "Ver tabela LATCH" (folha de consulta DOC 4).
- **Estados:** pergunta sem resposta (nenhuma opção marcada); resposta que dispara prioritário (EVN 7: AM-05); colagem com nome de outra família ("O texto colado cita a Família Teste Cedro..."); cópia ainda não confirmada na lista de pendências.

### E4 · Checklist, etapa Bebê (gêmeos) · `enfermeira-checklist-bebe.html`
- **Objetivo:** registrar cada recém-nascido separado, sem confundir os dois.
- **Conteúdo:** Família Teste Cedro, D7; abas "Bento" e "Lia" com o estado de cada uma (completa, com pendência); icterícia em chips (zona II), respiração, choro, atividade; temperatura 36,8 °C, FC 138 bpm, FR 44 rpm, peso 2.815 g com "No D6: 2.790 g · ganho de 25 g"; cuidados (fraldas, banho, coto, vestimenta).
- **Estados:** bebê com RN-04 (sem diurese há 4 h, faixa imediata); aba do outro bebê incompleta; peso fora do esperado (aviso de digitação "28.150 g parece ter um zero a mais").

### E5 · Resumo e assinatura · `enfermeira-assinatura.html`
- **Objetivo:** fechar a visita com segurança: o que falta, resumo, assinatura.
- **Conteúdo:** lista "Para concluir o D4" (resumo descritivo pendente, assinatura) com links; campo de resumo (texto) e botão "Gravar áudio"; folha "Assinar o registro do D4?" com "Revisar" e "Assinar agora".
- **Estados:** com pendências (botão de assinar desabilitado e a razão escrita); tudo pronto; assinando (carregando); assinado offline ("Assinado às 11:42. Sobe quando houver sinal."); último dia (D6) com contatos do obstetra e do pediatra obrigatórios e "Não consegui, justificar".

### E6 · Famílias · `enfermeira-familias.html`
- **Objetivo:** achar as famílias atribuídas e o dia de cada uma.
- **Conteúdo:** lista: Família Teste Aurora (D4 de 6, régua fina), Família Teste Cedro (D7 de 12), Família Teste Horizonte (reservada, DPP 12/11/2026, régua tracejada "ainda não começou").
- **Estados:** vazio ("Você ainda não tem famílias atribuídas..."); carregando; família com freio (selo sensível, cabeçalho ameixa ao abrir); offline (lista do cache com a hora).

### E7 · Família (visão assistencial) · `enfermeira-familia.html`
- **Objetivo:** ver o acompanhamento inteiro da família e abrir um dia.
- **Conteúdo:** cabeçalho da família com Freio e as quatro datas; régua D1 a D6; cartões dos dias anteriores (D1 a D3) em leitura, com o que teve alerta; médicos (obstetra e pediatra fictícios) com telefone; plano de cuidado; "Fazer adendo" nos dias assinados.
- **Estados:** freio ativo (cabeçalho ameixa, o registro clínico continua liberado, mensagens automáticas pausadas); dia com adendo (marca "adendo em 23/09, 16:02"); carregando; sem permissão (família de outra enfermeira: "Esta família não está atribuída a você.").

### E8 · Alertas · `enfermeira-alertas.html`
- **Objetivo:** ver alertas abertos e o que falta registrar.
- **Conteúdo:** PU-01 Família Teste Aurora (aberto, acionamento registrado às 10:14, aguardando fechamento da coordenação); RN-10 Família Teste Cedro (fechado em 22/09).
- **Estados:** vazio ("Nenhum alerta aberto. Quando um valor do checklist passar do limite, o alerta aparece aqui e na tela da visita."); alerta sem registro (botão "Registrar acionamento"); offline.

### E9 · Perfil e semana · `enfermeira-perfil.html`
- **Objetivo:** ver a própria semana, ofertas e documentos.
- **Conteúdo:** nome e COREN fictício, estado de hoje ("Em visita"), semana em turnos, ofertas (se houver), documentos com validade, "Sair" (limpa o aparelho depois de enviar a fila).
- **Estados:** documento vencendo (aviso); sair com fila pendente ("Ainda há 2 respostas no aparelho. Conecte-se para enviar antes de sair.").

---

## Grupo comercial

Abas inferiores: Início, Pipeline, Conversas, Famílias, Mais. Viewport principal 390 x 844; no computador (1280 x 800) barra lateral e duas colunas.

### C1 · Início (fila de transferências) · `comercial-inicio.html`
- **Objetivo:** assumir a próxima conversa dentro do prazo.
- **Conteúdo:** título "Início"; fila: Família Teste Garoa (Relato de saúde, prioridade máxima, "agora", visível mas destinada à coordenação), Família Teste Dália ("Quer contratar", Imersão, Pix, "vence em 38 min", "Assumir conversa"), Família Teste Estrela ("Pediu desconto", vence em 3 h 10 min); tarefas do dia (follow-up D+3 da Família Teste Estrela, 17:00).
- **Estados:** vazio ("Nenhuma conversa esperando você..."); carregando; prazo perto (aviso); vencido ("venceu há 8 min"); assumida por outra pessoa ("Otávio assumiu às 14:05").

### C2 · Conversa · `comercial-conversa.html`
- **Objetivo:** ler o que a Isadora colheu e seguir com a família.
- **Conteúdo:** Família Teste Dália: mensagens da família e da Isadora, evento "Transferida ao comercial às 14:02...", mensagem de Otávio; painel com resumo interno (32s4d, DPP 15/11/2026, Pinheiros, cobertura confirmada, primeiro bebê, PDF enviado, Imersão, Pix), botões "Enviar formulário do contrato" (texto `formulario_contrato`), "Abrir no WhatsApp", "Marcar como resolvida".
- **Estados:** IA ainda ativa (antes de assumir: "A Isadora está conduzindo. Assumir conversa"); freio ativo (faixa ameixa, sem sugestão de texto comercial); falha de envio; mídia recebida (miniatura com "Pode conter informação de saúde. Abra com cuidado."); campo de resposta no app e alternativa só "Abrir no WhatsApp" (decisão pendente).

### C3 · Pipeline · `comercial-pipeline.html`
- **Objetivo:** ver e mover famílias entre estágios permitidos.
- **Conteúdo:** celular: pílulas de estágio (Novo 6, Em conversa 9, Qualificado 7, Sessão agendada 4, Nutrição 48) e lista do estágio escolhido com Família Teste Dália, Estrela, Ipê; computador (1280): quadro do pipeline 1 com colunas e contagem; aba pipeline 2 (Proposta, Negociação, Contrato, Pagamento, Aguardando nascimento).
- **Estados:** estágio vazio; carregando; menu "Mover para" só com destinos válidos; transição recusada (mensagem com os caminhos possíveis); família com freio no quadro (selo sensível).

### C4 · Ficha 360 · `comercial-ficha.html`
- **Objetivo:** ver a família inteira e puxar o freio em um toque.
- **Conteúdo:** cabeçalho de areia da Família Teste Dália (estágio Qualificado, 32s4d, Pinheiros, DPP 15/11/2026 estimativa, nascimento, alta e início "ainda não"), botão Freio; abas Linha do tempo, Comercial, Conversas, Financeiro (sem Pré-natal e Atendimento para o comercial); linha do tempo com marcos (entrada pelo Instagram em 02/09, qualificação pela Isadora, PDF enviado, transferência hoje).
- **Estados:** freio recém-acionado (aviso efêmero com "Desfazer" em 10 s, proposta); freio ativo (Família Teste Brisa, cabeçalho ameixa, texto do estado, tarefa "Justificar o freio"); carregando; duplicata detectada ("Parece a mesma família que Família Teste Ipê. Comparar e unir").

### C5 · Conversas · `comercial-conversas.html`
- **Objetivo:** ver todas as conversas e em que mão está cada uma.
- **Conteúdo:** lista com filtro (Isadora conduzindo, Com a equipe, Pausadas, Não lead): Família Teste Ipê (Isadora, nutrição), Família Teste Dália (com Otávio), Família Teste Brisa (freio, IA desativada), número desconhecido (não lead, fornecedor).
- **Estados:** vazio por filtro; carregando; conversa com IA pausada manualmente (volta às 18:00).

### C6 · Agente: regras de follow-up · `comercial-agente-regras.html`
- **Objetivo:** ajustar a janela de retomada da Isadora sem mexer em código.
- **Conteúdo:** "Retomar quem parou de responder depois de" com opções 24 h, 36 h, 48 h (padrão), 72 h; texto que sai em cada caso (rascunho para aprovação); aviso "A Isadora nunca retoma conversa de família com freio nem conversa já assumida pela equipe."; salvar com autor e hora.
- **Estados:** alteração não salva; salvo ("Alteração salva às 15:20 por Otávio Lemos."); sem permissão (só diretoria altera).

### C7 · Entrar · `entrar.html`
- **Objetivo:** login com MFA, sóbrio.
- **Conteúdo:** logo provisório completo sobre creme; campos E-mail e Senha; "Entrar"; segunda etapa com código de 6 dígitos (teclado numérico); aviso de dado de saúde em uma frase, sem travessão; "Esqueci a senha".
- **Estados:** erro de senha ("E-mail ou senha não conferem. Confira e tente de novo."); código errado; sessão expirada ("Sua sessão terminou depois de 8 horas. Entre de novo."); offline (explica que é preciso sinal para entrar).

---

## Grupo coordenacao

Abas inferiores: Início, Radar, Agenda, Famílias, Mais. Viewport principal 1280 x 800 para Equipe, Designar, Radar e Entrevista; 390 x 844 para Início e Alerta. Conferir sempre as duas.

### K1 · Início da coordenação · `coordenacao-inicio.html`
- **Objetivo:** ver primeiro o que pede decisão.
- **Conteúdo:** faixa imediata PU-01 Família Teste Aurora (acionamento registrado às 10:14 por Talita Moreno, "Fechar alerta"); transferência de saúde Família Teste Garoa ("Assumir agora"); fichas pendentes (D3 da Família Teste Aurora); decisões (oferta da Família Teste Horizonte sem resposta há 18 h; pré-natal da Família Teste Jasmim em andamento); síntese da equipe ("3 em visita agora, 1 livre...").
- **Estados:** nada pendente (vazio que ensina); carregando; offline; alerta de saúde mental (SM, ocorrência privada, faixa imediata sem detalhe na lista).

### K2 · Equipe · `coordenacao-equipe.html`
- **Objetivo:** estado de cada enfermeira hoje e na semana.
- **Conteúdo:** filtro de praça; linhas de Talita Moreno (Em visita; Aurora e Cedro), Rosana Vieira (Livre; backup na Aurora; oferta Horizonte), Priscila Andrade (Reservada; janela da Família Teste Brisa), Marta Quintela (Em atendimento; Figueira), Joana Bastos (Folga ou bloqueio: documentos pendentes); semana 21 a 27/09 em turnos; legenda.
- **Estados:** carregando; praça vazia; conflito de agenda (turno em alerta); sobrecarga (terceira visita no dia); documento vencendo.

### K3 · Designar enfermeira · `coordenacao-designar.html`
- **Objetivo:** oferecer titular e backup para a Família Teste Horizonte.
- **Conteúdo:** contexto da família (DPP 12/11/2026, janela 22/10 a 26/11, Moema, manhã, Essencial); candidatas ordenadas com a semana de cada uma sobre a janela; ações "Oferecer como titular", "Oferecer como backup"; oferta já feita a Rosana com prazo; "Atribuir direto" com motivo (urgência).
- **Estados:** sem candidata livre na janela ("Ninguém livre em toda a janela. Veja quem está livre na maior parte dela ou atribua direto."); oferta recusada (motivo); oferta expirada; atribuição direta confirmada.

### K4 · Entrevista pré-natal (DOC 1) · `coordenacao-entrevista.html`
- **Objetivo:** conduzir e retomar a entrevista em sequência lógica.
- **Conteúdo:** Família Teste Jasmim; computador em três colunas: lista das 8 etapas (1 a 3 completas, 4 em andamento "3 de 5", 5 a 8 não iniciadas), formulário da etapa 4 (gestações anteriores, filhos vivos, partos vaginais, cesáreas em contadores de toque; consultas de pré-natal; intercorrências), contexto (34s2d calculada, DPP 03/11/2026, maternidade, cidade); celular: uma etapa por tela com barra inferior.
- **Estados:** não iniciada ("Começar entrevista"); retomar ("Retomar da etapa 4"); dado do cadastro esperando confirmação ("veio do cadastro comercial"); offline (salvo no aparelho); pré-natal urgente (selo); concluída (leitura, "Alterar" com motivo); sem permissão (comercial vê só o estado).

### K5 · Alerta clínico · `coordenacao-alerta.html`
- **Objetivo:** acompanhar e fechar um alerta com o registro completo.
- **Conteúdo:** PU-01 Família Teste Aurora; linha do tempo (valor 38,2 °C salvo às 10:09 offline, sincronizado às 10:12, acionamento às 10:14, orientação médica registrada); registro obrigatório (sinal, horário, orientação médica, conduta); ações "Ligar para Talita Moreno", "Fechar alerta" (folha com observação).
- **Estados:** registro incompleto (o que falta, "Fechar alerta" desabilitado com a razão); fechado; prioritário (AM-05); saúde mental (ocorrência privada, visível só para coordenação e diretoria); família com freio.

### K6 · Radar de nascimentos · `coordenacao-radar.html`
- **Objetivo:** ver quem pode nascer nas próximas semanas e se há enfermeira para cada uma.
- **Conteúdo:** semanas de 21/09 a 16/11 em colunas; cada família aguardando como faixa hachurada na janela da DPP (menos 21 a mais 14 dias), com titular e backup ou "sem titular"; ocupação por praça em blocos segmentados (São Paulo 4 de 5 famílias na semana de 26/10, Londrina 1 de 3), com aviso a partir de 85%.
- **Estados:** família sem titular (selo aviso); nascimento informado (faixa vira fato, "bebe_nasceu" com designação urgente); ocupação acima do limite (alerta com texto); vazio da praça.

### K7 · Freio: reverter ou ajustar · `coordenacao-freio.html`
- **Objetivo:** tirar ou mudar o estado sensível com justificativa.
- **Conteúdo:** Família Teste Brisa com cabeçalho ameixa; histórico (acionado por Otávio Lemos em 24/09/2026, 09:14; justificativa pendente); folha com os quatro estados (normal, atenção, bloqueio total, encerrado sensível) e o efeito de cada um em uma frase; justificativa obrigatória; "Confirmar mudança" em sensível.
- **Estados:** sem permissão (enfermeira e comercial veem o estado, não a reversão); justificativa vazia (erro no campo); mudança salva (cabeçalho volta à areia, aviso com a hora e o autor); encerrado sensível (explica que a família sai de pesquisa, indicação e remarketing para sempre).

---

## Decisões que ainda dependem do cliente

1. "Desfazer" do freio por 10 s para quem acionou, sem exigir coordenação (fluxo D).
2. Orientações dos blocos 4 a 8 do DOC 2 como "feito hoje" em vez de sim ou não item a item (fluxo A, regra 7) [clínico].
3. Onde o comercial responde: no app pelo adaptador de mensageria ou no WhatsApp do aparelho (fluxo E).
4. Entrada dos nove derivados de cor no PRD 20.2 e no `globals.css` (DESIGN.md, seção 4).
5. Modo escuro fora desta fase (DESIGN.md, seção 2).
