# Fluxos de experiência · Kraamzorg OS

Cinco fluxos que respondem aos pedidos da reunião de 24/09/2026. Cada um diz quem usa, em que cena, os passos tela a tela, os estados e as regras que protegem a família. Componentes e tokens em `DESIGN.md`; inventário de telas em `telas.md`. Dados de exemplo são fictícios.

Pedidos da reunião e onde estão resolvidos:

| Pedido (24/09)                                                                                                                                                                     | Fluxo |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---- |
| 11:12 "Planilha tem que ser rápida... telas de checklist bem práticas e fáceis de responder"                                                                                       | A     |
| 11:14 "Etapa da entrevista tem que seguir uma sequência lógica dentro do CRM"                                                                                                      | B     |
| 11:31 "Status para enfermeiras (em atendimento), (livre) ou coisas assim"                                                                                                          | C     |
| Freio em um toque (PRD 8.3) e pipeline (PRD 20.5)                                                                                                                                  | D     |
| 11:19 a 11:22 "Agente focado na triagem, para ele poder atender após a triagem"; "se já qualificou e caiu no Leo, não entra mais na conversa"; follow-up de 24 a 48 h configurável | E     |

---

## A. Checklist diário (DOC 2) em poucos minutos, com uma mão

**Quem e onde.** Enfermeira, celular, na casa da família, sinal instável. Um registro por visita, assinado.

**Meta.** Os blocos objetivos respondidos em até 5 minutos; o resumo descritivo à parte (texto ou áudio, no carro se preferir). Um toque por pergunta sim ou não, sem digitar nada que possa ser tocado.

### Estrutura: oito etapas, uma por tela

A planilha tem nove blocos e dezenas de linhas com D1 a D6 lado a lado. No celular a coluna vira uma tela por bloco, só do dia de hoje. A ordem segue a visita real (chegada, mãe, bebê, orientações, fechamento), não a ordem do papel quando ela atrapalha, e cada campo continua com o nome e o código do instrumento aprovado.

| Etapa                                   | Blocos do DOC 2               | Controles                                                                                                                                                                                | Pode disparar                                          |
| :-------------------------------------- | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| 1 Chegada                               | 1                             | Data e horário vêm do check-in (fato, editável); acompanhante sim ou não + quem; demais sim ou não                                                                                       |                                                        |
| 2 Puérpera                              | 2, 2.2, 2.3, 2.4              | Sim ou não; dor 0 a 10; local da dor em texto curto; medicações em texto                                                                                                                 | PU-02, PU-03, PU-04                                    |
| 3 Sinais vitais da puérpera             | 2.1                           | Temperatura (°C), PA (mmHg), FC (bpm) com teclado numérico; valor do dia anterior como referência                                                                                        | PU-01, PU-08                                           |
| 4 Mamas e amamentação                   | 2.5 a 2.13                    | Sim ou não; EVN 0 a 10; lesão (não, direita, esquerda, ambas); NTS 0 a 5 e LATCH 0 a 10 com a tabela do DOC 4 numa folha de consulta; FBM em chips; produção em três chips; apoio 0 a 10 | PU-11, PU-12, AM-04 a AM-06, atenção de LATCH e sucção |
| 5 Bebê (uma aba por bebê em gêmeos)     | 3, 3.1, 3.2                   | Icterícia em chips (ausente, zona I a V); sim ou não; temperatura, FC, FR, peso em g                                                                                                     | RN-01, RN-03, RN-04, RN-07, RN-08, RN-10, RN-13        |
| 6 Orientações do dia                    | 4, 5, 6                       | Marcação múltipla "feito hoje" (proposta, ver regra 7)                                                                                                                                   |                                                        |
| 7 Emocional, encerramento e comunicação | 7, 8, 9                       | Sim ou não; sofrimento emocional abre o seletor SM-01 a SM-07; contato com médico abre ocorrência                                                                                        | SM-01 a SM-07                                          |
| 8 Resumo e assinatura                   | Resumo descritivo, assinatura | Texto longo ou áudio; lista do que falta; assinar                                                                                                                                        |                                                        |

Sinais do DOC 3 sem campo próprio (cefaleia com alteração visual, dor torácica, convulsão, sangue nas fezes) ficam num botão fixo "Registrar outro sinal de alerta" no rodapé de toda etapa, que abre o seletor do DOC 3.

### Passo a passo

1. **Hoje.** Cartão da próxima visita: horário, família, endereço, régua de dias (D4 de 6) e o botão "Cheguei, iniciar visita" na metade de baixo da tela. O toque registra o check-in (hora e, se autorizado, localização) e abre a etapa 1 com data e horário já preenchidos, porque são fatos do check-in, não julgamento clínico.
2. **Cabeçalho do checklist**, fixo: nome da família, "D4", botão Freio, indicador de sincronização, trilha de progresso em oito segmentos. Tocar a trilha abre a lista de etapas com o estado de cada uma (completa, com pendência, com alerta, não iniciada) para pular direto.
3. **Responder.** Cada resposta grava no aparelho na hora (IndexedDB) e o indicador mostra "Salvo no aparelho". Ao responder, o foco desce para a próxima pergunta sem rolar a tela inteira. Nada vem marcado: não existe resposta padrão nem botão "tudo normal".
4. **Barra inferior**, na zona do polegar: "Voltar" e "Próxima etapa". Dá para avançar com pendências; a etapa fica marcada e a lista final mostra o que falta.
5. **Alerta na hora (exemplo PU-01).** A enfermeira digita 38,2 na temperatura e sai do campo. A regra roda no próprio aparelho, sem rede. O campo fica em estado de alerta e logo abaixo aparece a faixa:
   - "PU-01 · Febre de 38,2 °C na puérpera"
   - "Acione a supervisão médica agora e oriente a família a procurar atendimento de emergência."
   - "Antes de fechar: sinal, horário do acionamento, orientação médica recebida e conduta adotada."
   - Botões "Ligar para a supervisão" (link de telefone, funciona sem dados) e "Registrar acionamento".
     A faixa passa a ficar presa no topo do checklist em todas as etapas até o registro ser feito. A notificação para a coordenação (push e grupo clínico) entra na fila: com sinal, sai na hora; sem sinal, a faixa acrescenta "Sem sinal: a coordenação recebe o alerta quando a conexão voltar. Se for urgente agora, ligue."
6. **Registrar acionamento.** Folha inferior com os quatro campos obrigatórios do DOC 3: sinal (já vem PU-01, pela regra), horário do acionamento (agora, editável), orientação médica recebida (texto ou áudio), conduta adotada. Salvar fecha o alerta no checklist; o alerta continua aberto na coordenação até ela fechar.
7. **Etapa 8, resumo e assinatura.** Lista do que falta para concluir, cada item com link para o campo: data, horário, sinais vitais da puérpera, sinais vitais e peso de cada bebê, resumo descritivo, assinatura (PRD 9.2). No último dia entram também contato do obstetra, contato do pediatra (com "Não consegui, justificar") e resumo de encerramento. O resumo aceita texto ou áudio (transcrição na fase 2).
8. **Assinar.** Folha de confirmação: "Assinar o registro do D4? Depois de assinado, o registro não muda. Se precisar corrigir, você faz um adendo com o motivo." Botões "Revisar" e "Assinar agora". Depois: "Assinado às 11:42. Sobe quando houver sinal." A régua de dias marca D4 como feito quando o servidor confirma; até lá fica hachurada ("ficha pendente").

### Regras que protegem

1. **Nada vem de outra família.** O aparelho guarda só as famílias do dia da própria enfermeira, e nenhuma tela oferece copiar de outra família. Não existe "duplicar ficha".
2. **Nada vem de outro dia sem confirmação campo a campo.** Campos numéricos mostram o valor anterior só como referência ("No D3 foi 36,9 °C"), nunca preenchido. Campos de texto que costumam se repetir (medicações em uso, quem mais apoia, intervenções para dor) oferecem "Trazer o texto do D3". O texto entra com borda dourada tracejada e o bloco "Texto do D3 desta família (Família Teste Aurora). Confirme que continua valendo hoje antes de salvar." com "Vale para hoje" e "Apagar e escrever". Sem confirmação, o campo não conta como respondido e não é assinado. Não existe "trazer tudo do D3".
3. **Colagem vigiada.** Se o texto colado num campo cita o nome de outra família que está no aparelho, o campo avisa: "O texto colado cita a Família Teste Brisa, que não é esta família. Confira antes de salvar." (verificação local, sem rede).
4. **Salvar por campo, sempre.** Fechar o app, receber ligação ou perder a bateria não perde resposta. Ao reabrir, o checklist volta na etapa e no campo onde parou.
5. **Sem sinal é estado normal, não erro.** Faixa informativa, nunca vermelha. O envio segue a ordem de criação, com id gerado no aparelho.
6. **Assinado não muda.** Depois de assinar, a tela do D4 vira leitura com "Fazer adendo".
7. **[clínico, para aprovação]** Nos blocos de orientação (4, 5, 6 e 8), trocar sim ou não item a item por "toque no que foi feito hoje" com um fechamento explícito "Nada mais foi feito neste bloco", que grava "não" nos itens não marcados. Reduz cerca de 15 toques por visita sem apagar a diferença entre "não feito" e "não respondido". Até a aprovação, entra como sim ou não.

**Estados.** Carregando (esqueleto do cartão e da etapa), offline (faixa informativa e "Salvo no aparelho"), enviando, sincronizado, falha de envio ("Não enviou. Tentamos de novo em 30 s." com "Tentar agora"), alerta imediato, alerta prioritário, campo com erro de digitação ("8 bpm parece um dígito a menos"), família com freio (cabeçalho ameixa, o registro clínico continua liberado), sessão expirada com fila pendente (a fila sobe antes de limpar o aparelho).

---

## B. Entrevista pré-natal (DOC 1) em sequência lógica, dentro do CRM

**Quem e onde.** Coordenação clínica, durante a consulta pré-natal online (por volta de 34 semanas), celular ou computador. Só coordenação e diretoria veem o conteúdo; o comercial vê apenas o estado ("Entrevista feita em 24/09/2026").

**Onde mora.** Ficha da família, aba "Pré-natal". O cartão da aba mostra o estado: não iniciada, em andamento ("Etapa 4 de 8, parou em 24/09/2026, 19:40") ou concluída. O botão é "Começar entrevista", "Retomar da etapa 4" ou "Ver entrevista".

### Sequência (a ordem da conversa, não a do papel)

| Etapa                           | Blocos                                                                                 | Por que nesta ordem                                                                                                                                                          |
| :------------------------------ | :------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Abertura                      | B (data, hora de início automática, coletador do login), A (origem)                    | Registra o encontro. A origem já existe no cadastro: aparece com "veio do cadastro comercial" e pede confirmação.                                                            |
| 2 Quem é a família              | C                                                                                      | A conversa começa pelas pessoas: nomes, idades, ocupação, situação conjugal, escolaridade, contatos.                                                                         |
| 3 Esta gestação                 | B (DPP, maternidade, IG, percentil, ganho de peso, tipo de parto, parto agendado, ILA) | A IG é calculada da DPP e da data, nunca digitada nem gravada. Gêmeos: um bloco por bebê [clínico, K-02].                                                                    |
| 4 Gestações anteriores          | D                                                                                      | Contadores de toque (nenhuma, 1, 2, três ou mais).                                                                                                                           |
| 5 Amamentação antes             | E                                                                                      | Pulada inteira quando "amamentou anteriormente" = não se aplica.                                                                                                             |
| 6 Expectativas                  | F                                                                                      | Texto livre, com opção de áudio. A etapa mais longa fica no meio, quando a conversa já esquentou.                                                                            |
| 7 Temas conversados             | G                                                                                      | Marcação do que foi abordado (Golden Hour, apojadura, complemento, chupeta e mamadeira, leite materno, aviso do nascimento).                                                 |
| 8 Médicos, preferências e plano | H, plano de cuidado                                                                    | Obstetra e pediatra, pedidos especiais, período preferido em ordem (manhã, tarde) arrastando ou tocando 1 e 2. Fecha com hora de término automática e "Concluir entrevista". |

### Regras

1. **Começa em branco.** Toda entrevista nasce vazia (PRD 9.1). Não existe modelo nem "duplicar de outra família". Dados que já estão na ficha desta mesma família (DPP, cidade, telefone, origem) aparecem como sugestão com "veio do cadastro", e cada um exige toque de confirmação ou edição.
2. **Retomável.** Cada campo grava ao sair dele. Sair no meio da consulta e voltar abre na etapa e no campo onde parou. Qualquer etapa pode ser aberta pela lista de etapas, porque a conversa real pula.
3. **Etapa com estado.** Na lista: completa, em andamento (com contagem "5 de 9 respondidas"), não iniciada. Concluir não exige todas completas; exige os obrigatórios do instrumento, listados com link.
4. **Computador:** três colunas (lista de etapas, formulário, contexto da família com DPP, IG e cidade). **Celular:** uma etapa por tela, barra inferior com "Etapa anterior" e "Próxima etapa".
5. **Depois de concluir,** o plano de cuidado e o período preferido alimentam a designação (fluxo C). Alterar depois de concluída gera histórico com autor e motivo.

**Estados.** Não iniciada (vazio que ensina: "A entrevista acontece na consulta pré-natal, por volta de 34 semanas. Hoje a Família Teste Dália está com 32s4d."), urgente (pagamento com mais de 34 semanas: selo alerta e prioridade no Início da coordenação), em andamento, offline (salva no aparelho), concluída, sem permissão (comercial vê só o estado).

---

## C. Estado das enfermeiras no CRM

**Quem vê.** Coordenação e diretoria (celular e computador). A enfermeira vê só o próprio estado e as próprias ofertas.

### O conjunto de estados

O estado nunca é digitado nem escolhido numa lista. Ele é calculado das designações (`designacao`: oferecida, aceita, recusada, expirada; papel titular ou backup), das visitas do dia (`visita`) e dos bloqueios de agenda (`bloqueio_agenda`). Assim não existe "livre" desatualizado.

| Estado (selo)     | Quando                                                                                                                    | Cor                                  |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------ | :----------------------------------- |
| Em visita         | Check-in feito e visita ainda não concluída, agora                                                                        | marinho cheio                        |
| Em atendimento    | Titular de acompanhamento ativo nesta semana, fora de visita agora                                                        | neutro com a régua da família        |
| Reservada         | Titular aceita de família que ainda aguarda o nascimento, com a janela de DPP (menos 21 a mais 14 dias) cruzando a semana | hachura (provável, ainda não é fato) |
| Backup            | Backup aceita de alguma família na janela                                                                                 | contorno tracejado                   |
| Oferta pendente   | Existe oferta sem resposta para ela                                                                                       | dourado com texto marinho            |
| Folga ou bloqueio | Bloqueio de agenda no dia (folga, férias, documento vencido)                                                              | areia                                |
| Livre             | Nenhum dos anteriores no período                                                                                          | neutro claro                         |

Uma enfermeira pode ter mais de um estado na semana; o selo mostra o de hoje pela ordem acima, e a semana mostra o resto. Capacidade: no máximo 2 visitas por dia, sempre no mesmo período por família (PRD 3.4).

### Telas e passos

1. **Equipe (coordenação).** Filtro por praça (São Paulo, Londrina). Uma linha por enfermeira: nome, selo de hoje, famílias em curso com régua fina, e a semana em 7 dias por 2 turnos (visita, reservada, backup, oferta, folga, livre), com legenda sempre visível. No celular, a semana vira a linha de baixo de cada cartão.
2. **Início da coordenação** e **da diretoria** trazem a síntese: "3 em visita agora, 1 livre, 2 reservadas para esta semana, 1 oferta sem resposta há 18 h".
3. **Designar.** A partir de uma família sem titular (radar ou ficha), "Designar enfermeira" abre a lista de candidatas ordenada por: livre na janela de DPP, praça, período preferido da família, carga da semana. Cada candidata mostra a semana dela sobre a janela da família. Ação: "Oferecer como titular" ou "Oferecer como backup". Urgência (nascimento antes do previsto): "Atribuir direto" com motivo, só coordenação (PRD 22.4, O-01).
4. **Oferta na enfermeira.** Cartão no topo do Hoje: "Oferta: Família Teste Horizonte, Moema, DPP 12/11/2026, manhã, 6 dias, titular. Responda até 26/09/2026, 18:00." Botões "Aceitar" e "Recusar". Recusar pede motivo em chips (agenda, distância, outro com texto). A notificação push não mostra o nome da família.
5. **Resposta volta** para a coordenação como evento e muda o estado na hora. Oferta expirada vira tarefa "Oferecer a outra enfermeira".

**Estados da tela.** Carregando (esqueleto das linhas), vazio de praça ("Nenhuma enfermeira ativa em Londrina. Cadastre em Equipe, Nova profissional."), offline (dados do último carregamento com a hora), conflito (duas visitas no mesmo turno: turno em alerta e selo "Conflito de agenda"), sobrecarga (mais de 2 visitas no dia: aviso), documento vencendo (aviso no cartão).

---

## D. Pipeline comercial e ficha 360 com o freio em um toque

**Quem.** Comercial e diretoria; coordenação lê a ficha.

### Pipeline

1. **Celular:** lista agrupada por estágio. No topo, pílulas de estágio que rolam de lado com a contagem ("Qualificado 7", "Nutrição 48"). Cada cartão: família, IG (32s4d), cidade, temperatura do lead como selo de texto (Quente, Morno, Frio), próximo passo com data e prazo ("Follow-up D+3 vence hoje, 17:00"). Nada de pontinho colorido sem texto.
2. **Computador:** quadro por colunas dos pipelines 1 e 2 em abas; lista em tabela como alternativa.
3. **Mover** só pelas transições permitidas (PRD 7): o menu do cartão mostra apenas os destinos válidos daquele estágio, com o motivo quando exigido (perda pede motivo em chips). Arrastar no computador faz a mesma checagem e devolve o cartão com a mensagem "Esse passo não existe a partir de Qualificado. Os caminhos possíveis são: Sessão agendada, Nutrição, Perdido, Fora de cobertura ou Proposta enviada."
4. **Filtros** por praça, responsável, temperatura e "com prazo vencendo hoje".

### Ficha 360

1. **Cabeçalho da família** (fixo em todas as abas): nome, estágio, IG ou dia do acompanhamento, cidade, as quatro datas com "estimativa" e "fato", e o botão Freio.
2. **Abas por papel:** Linha do tempo, Comercial, Conversas, Pré-natal (coordenação), Atendimento (coordenação), Financeiro. A aba que o papel não pode ver não aparece.
3. **Linha do tempo** usa a régua como espinha: marcos de venda, nascimento, alta, dias do acompanhamento, pós-venda. Eventos restritos aparecem só para quem pode ("Evento clínico, visível para a coordenação").

### Freio em um toque

1. Toque no "Freio" em qualquer tela da família. Sem pergunta, sem justificativa antes (PRD 8.3).
2. Na hora: estado `bloqueio_total`, execuções pendentes reavaliadas, Isadora desativada para a família. O cabeçalho inteiro vira ameixa: "Freio em bloqueio total desde 24/09/2026, 09:14. Só contato humano e nominal." Aviso efêmero confirma o efeito.
3. Nasce a tarefa "Justificar o freio da Família Teste Brisa" para quem acionou, com prazo.
4. **[decisão do cliente]** Toque acidental: proposta de "Desfazer" por 10 s no aviso efêmero, só para quem acionou. Passados os 10 s, reverter exige coordenação ou diretoria.
5. **Reverter ou ajustar** (coordenação ou diretoria): folha inferior com os estados (atenção, bloqueio total, encerrado sensível), o efeito de cada um em uma frase e a justificativa obrigatória.
6. Em estado sensível, toda tela da família troca "réguas", "pesquisa" e "indicação" por "pausado pelo freio", e o botão de enviar modelo de mensagem some; o contato humano continua.

**Estados.** Pipeline vazio num estágio ("Nenhuma família em Sessão agendada. Quando a Isadora ou você marcar uma conversa com a coordenação, a família aparece aqui."), carregando (esqueleto de cartões), transição recusada, família com freio (cartão com selo sensível e sem ações automáticas), duplicata detectada (aviso com "Comparar e unir").

---

## E. Conversas da Isadora e fila de transferências com prazo

**Quem.** Comercial e diretoria (fila comercial); coordenação clínica (saúde, perda, reclamação, estado sensível); operação (nascimento, dúvidas de cliente).

### Início do comercial: a fila

1. A primeira tela do comercial é a **fila de transferências**, ordenada por prioridade e prazo. Prioridade máxima (saúde, perda) fica no topo em fundo de alerta e aparece também para a coordenação.
2. Cada cartão: motivo em frase ("Quer contratar", "Quer a conversa com a coordenação", "Pediu desconto", "Pediu para falar com uma pessoa"), família, IG e o que a Isadora já colheu (plano, DPP, pagamento preferido, duas opções de horário), o prazo ("vence em 38 min") e o botão "Assumir conversa".
3. **Assumir** grava quem assumiu e a hora, mantém a IA pausada nessa conversa e abre a conversa. A partir daqui, para lead já qualificado, a Isadora não volta a responder nessa conversa (reunião, 11:22). Não existe botão "devolver para a Isadora" nesse caso.
4. **Agendamento é humano** (reunião, 11:19): a transferência "Quer a conversa com a coordenação" mostra as duas opções que a família passou e o botão "Marcar na agenda", que cria o evento e sugere o texto `lembrete_sessao`.

### A conversa

1. Linha de mensagens: família à esquerda; Isadora à direita em areia com "Isadora (IA)"; pessoa da equipe à direita em marinho com o nome; eventos do sistema no meio ("Transferida ao comercial às 14:02. A IA não volta a responder nesta conversa.").
2. **Painel da família** ao lado no computador, e acima como resumo recolhível no celular: resumo interno da Isadora (PRD 23.3), estágio, IG, cidade e cobertura, PDF enviado, próximo passo.
3. **Responder:** [decisão do cliente] no app, pelo adaptador de mensageria (com freio e janela checados), ou "Abrir no WhatsApp" no aparelho. A tela está desenhada para as duas saídas; a escolha define se o campo de texto aparece.
4. **Encerrar a transferência:** "Marcar como resolvida" com o desfecho em chips (formulário enviado, sessão marcada, condição negociada, sem retorno).
5. **Follow-up** configurável (reunião, 11:20): em Agente, Regras, a janela de retomada de quem parou de responder, pré-configurada em 48 h, com mínimo de 24 h e a opção "a partir de 48 h" que o cliente pediu. Mostra o texto que sai (`followup_d1_pos_pdf`, `followup_d1_pos_abertura`) e a pausa por freio. D+3 e D+14 continuam como tarefa humana (PRD 22.2, C-12).

### Prazos (SLA do PRD 11.4)

- O prazo aparece como tempo restante em frase ("vence em 1 h 12 min"), com tabular, e muda para aviso quando falta menos de 25% e para alerta quando vence ("venceu há 8 min").
- Horas úteis seguem o expediente do comercial [confirmar]; prioridade máxima é imediata a qualquer hora e gera push e grupo interno.
- Transferência vencida sobe para o Início da diretoria.

**Estados.** Fila vazia ("Nenhuma conversa esperando você. A Isadora continua a triagem e avisa aqui quando alguém quiser contratar, marcar a conversa ou falar com uma pessoa."), carregando, conversa com freio (faixa ameixa, sem sugestão de texto comercial), IA pausada manualmente (faixa com a hora de retorno), falha de envio de mensagem ("Não saiu. A família não recebeu. Tente de novo ou abra no WhatsApp."), mídia recebida (miniatura, sem prévia automática quando pode ser saúde), conversa de não lead (classificação e texto de encaminhamento).
