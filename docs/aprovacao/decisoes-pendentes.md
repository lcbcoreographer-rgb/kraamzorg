# Decisões pendentes para o Leonardo e a Edilaine

Este documento reúne todas as perguntas que ainda dependem de uma resposta do Leonardo, da Edilaine, dos dois juntos, do jurídico ou da contadora para o Kraamzorg OS seguir sem travar. As perguntas vêm do PRD (capítulo 22 e os pontos marcados "confirmar" ou "clínico" ao longo do texto), do documento de ajustes do prompt da Isadora e, na v4.3 (29/09), das pendências da seção 10 do Treinamento da Isadora v3 e da seção 31 do Prompt de Sistema v6.0 (última seção deste documento).

Para cada pergunta: o que o sistema faz hoje enquanto não há resposta (o padrão), o que muda se a resposta for diferente do padrão, quem decide e até quando a resposta precisa chegar, para não atrasar a sessão de construção que depende dela. As datas seguem o calendário do PROMPTS.md (versão 3, de 29/09, sobre o recálculo de 25/09).

Perguntas sem resposta até a data indicada não travam o projeto: o sistema segue com o padrão descrito, e a mudança entra depois, quando a resposta chegar.

## Resumo por grupo

| Quem decide | Quantidade de decisões |
| :-- | :-: |
| Leonardo | 23 |
| Edilaine | 22 |
| Leonardo e Edilaine juntos | 9 |
| Jurídico (com o Leonardo) | 5 |
| Contadora (com o Leonardo) | 3 |
| Novas na v4.3 (agenda da Isadora): Leonardo 8, Edilaine 3, os dois juntos 2, jurídico 1 | 14 |
| **Total** | **76** |

---

## Antes de tudo: WhatsApp com um número só ou com dois

Esta é a decisão mais urgente do grupo do Leonardo, então ela merece uma explicação maior antes da tabela.

Hoje a Isadora conversa pelo número de WhatsApp comum da Kraamzorg, ligado por uma ferramenta que não é a oficial do WhatsApp (a UAZAPI). Esse tipo de ferramenta vem sendo banida em 2026, com o número trocando ou não. Se o número for banido ou precisar trocar, toda conversa em andamento se perde, porque o sistema segue cada família por um único identificador de conversa, e a passagem da Isadora para o Leonardo acontece dentro dessa mesma conversa. Dois números significam dois fios separados: a família fala num número, mas se cair no outro no meio da negociação, o histórico não segue junto e o Leonardo perde o fio do que já foi combinado.

A alternativa mais segura é a API oficial do WhatsApp (a mesma Meta usa para empresas), funcionando junto com o aplicativo comum no mesmo número, sem precisar trocar de número nem duplicar contato. A Drop está confirmando se essa convivência é tecnicamente viável nesse número. Se não for, o plano B é migrar para um número novo, com uma mensagem de despedida explicando o novo contato antes de migrar.

A API oficial muda uma coisa importante no dia a dia: mensagens só podem sair livremente até 24 horas depois da última mensagem da família. Passado esse prazo, só é possível mandar um modelo de texto pré-aprovado pela Meta, sem poder escrever livremente. Isso afeta direto o retorno automático da Isadora quando a família some (hoje pensado para acontecer depois de 48 horas, ou seja, fora dessa janela de 24 horas) e os lembretes e avisos que o sistema manda sozinho. Na prática, esses textos vão precisar ser aprovados como modelos fixos pela Meta antes de entrar em produção, o que muda o texto e o prazo desde agora, e não só depois da migração.

**O que o sistema faz até a decisão:** a Isadora fica desligada em produção. Ela só funciona em um número de teste (homologação), e o time acompanha o WhatsApp real manualmente, com duas pessoas revezando, até a decisão sair. **Quem decide:** Leonardo (o custo) e a Drop (a viabilidade técnica). **Prazo:** o quanto antes, idealmente até 19/10 (início da sessão que desenha a fronteira entre a Isadora e o time humano), e no mais tardar até 26/10, porque é a condição para o aceite das Fases 0 e 1, marcado para essa semana.

---

## Decisões do Leonardo

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-- |
| 1 | Qual caminho seguir para o WhatsApp: API oficial convivendo com o número atual, número novo, ou continuar na ferramenta atual com risco de perda? (ver explicação acima) | Isadora desligada em produção; time acompanha o WhatsApp real manualmente | Muda a arquitetura de conexão, o texto de despedida se o número trocar, e libera a Isadora para produção | 19/10, no mais tardar 26/10 |
| 2 | [v4.3] O retorno automático da Isadora antes da reunião passou a ser em 1, 3 e 14 dias depois da última mensagem da família, os três feitos por ela, cada um com um motivo novo (treinamento v3 de 29/09; substitui as 48 horas da reunião de 24/09 e as tarefas suas de 3 e 14 dias). Esse é o valor final, e o ponto de contagem é a última mensagem da família? Depois da reunião realizada a cadência é sua, pelo CRM. | Retorno em 1, 3 e 14 dias, contados da última mensagem da família, com no mínimo 24 horas no primeiro, editável no CRM | Muda o parâmetro no sistema e o texto que explica o fluxo no prompt da Isadora | 13/10 |
| 3 | [v4.3] A Isadora só para de responder e passa a conversa para você quando a Edilaine registra a reunião como realizada no CRM, e não mais quando a reunião é marcada, quando a família quer contratar ou quando pede condição. Depois disso, só o botão "Devolver à Isadora" a traz de volta. Essa regra vale? | A conversa vai para você, e a Isadora para de responder, somente com a reunião realizada; a lista de motivos da versão anterior (reunião, contratar e condição comercial) deixa de valer | Muda quando a Isadora sai da conversa | 13/10 |
| 4 | O PDF da apresentação (hoje com cerca de 10 MB) precisa de uma versão leve, de até 3 MB, antes de a Isadora ir ao ar, com o Gemelar Essencial em R$ 5.400 em todos os materiais (pendência do treinamento v3). Quem prepara essa versão? | A Isadora não vai para produção até essa versão existir | Sem a versão leve, famílias com celular mais simples não conseguem abrir o arquivo | 26/10 |
| 5 | A credencial da InfinitePay: fica no Plano de Cobrança, limitado a 3 parcelas, ou num link simples sem repasse de taxa? | Plano de Cobrança limitado a 3 parcelas | Muda a taxa cobrada da família e como o pagamento é confirmado automaticamente | 19/10 |
| 6 | O e-mail contato@kraamzorgbrasil.com.br continua sendo o único canal para candidatas a enfermeira e para fornecedores? | Sim, é o canal único hoje | Muda a mensagem automática que a Isadora manda para quem não é família de cliente | 26/10 |
| 7 | As novas datas do cronograma valem (aceite das Fases 0 e 1 em 30/10, com WhatsApp e InfinitePay reais se os dois estiverem liberados até 26/10, ou em número de homologação se não estiverem; aceite da Fase 2 na semana de 16 a 20/11; aceite final na semana de 30/11 a 04/12)? A planilha do Drive é atualizada depois da sua confirmação por escrito | As sessões seguem o calendário do PROMPTS.md versão 3, com o P25b (agenda da Isadora) antes do P28 e do P33 | Se alguma data não servir, o calendário das sessões é refeito antes de seguir | O quanto antes, idealmente até 30/09 |
| 8 | A taxa de deslocamento do ABC Paulista (R$ 350) e da Granja Viana (R$ 350) pode ser cobrada como está, com confirmação caso a caso? | R$ 350 nos dois casos, sempre com confirmação manual antes de fechar | Muda o valor cadastrado e se a confirmação deixa de ser necessária | 13/10 |
| 9 | Qual é o limite de atendimentos simultâneos por semana e por região: o limite interno da v4.0 (5 em São Paulo, 3 em Londrina) ou o número que aparece na apresentação para a família (3 por semana por região)? | Limite interno da v4.0 para controle da equipe; número da apresentação como mensagem pública | Muda o cálculo de capacidade e o que a Isadora pode dizer sobre vagas | 13/10 |
| 10 | O desconto no Pix pode ser automático (e de quanto), ou continua sendo negociado caso a caso? | Nenhum desconto automático; qualquer condição precisa de aprovação registrada, e a Isadora nunca menciona percentual | Muda se o sistema aplica o desconto sozinho ou sempre passa para você | 19/10 |
| 11 | O parcelamento padrão é 3x sem juros. Casos de mais parcelas continuam exceção só com sua aprovação? | Sim, 3x é o padrão; mais que isso só com aprovação registrada caso a caso | Muda se o sistema passa a oferecer mais parcelas automaticamente | 19/10 |
| 12 | Famílias entre 20 e 27 semanas que já querem reservar podem contratar direto, ou só a partir de 28 semanas? | Podem contratar a partir de 20 semanas; abaixo disso, só combina um retorno | Muda a régua de contato e quando a Isadora oferece o contrato | 13/10 |
| 13 | Quando a família pede visita no fim da tarde, a resposta padrão (o cuidado é diurno, a equipe avalia caso a caso, sem garantia) está boa? | Essa é a resposta hoje | Muda o texto da Isadora e a forma como a agenda é montada | 09/11 |
| 14 | A extensão do acompanhamento (além do pacote contratado) continua sendo um aditivo manual, cobrando a diferença entre pacotes? | Sim, aditivo manual pelo comercial | Muda se existe um fluxo automático de extensão | 19/10 |
| 15 | O modelo de contrato atual (provisório) pode seguir em uso até você enviar o modelo atualizado com enfermeira, as quatro frentes de cuidado, dias e horas e o pré-natal online? | Modelo provisório em uso | Muda o texto do contrato assim que o modelo novo chegar | 19/10 |
| 16 | [v4.3] O lembrete da véspera da reunião com a Edilaine passa a ser enviado pela Isadora, com o link do Meet (treinamento v3). Está certo, ou continua sendo tarefa do comercial? | A Isadora envia o lembrete; a tarefa do comercial só existe para reunião marcada pela equipe | Muda quem manda essa mensagem | 13/10 |
| 17 | Os cortes de pontuação do lead em quente, morno e frio ficam em 70 e 40 (de 0 a 100)? | Quente a partir de 70, morno de 40 a 69, frio abaixo de 40 | Muda quando um lead aparece como prioridade na sua fila | 13/10 |
| 18 | Depoimentos de famílias com nome só entram na base de conhecimento da Isadora depois de autorização registrada, certo? | A Isadora não usa nenhum depoimento até a autorização existir | Muda o material que ela pode citar numa conversa | 26/10 |
| 19 | A Isadora pode informar o valor da taxa de deslocamento cadastrada, ou continua só avisando que existe taxa e passando para você confirmar? | Ela nunca confirma o valor; avisa que existe taxa e passa para você | Muda se a família recebe o valor direto da Isadora | 26/10 |
| 20 | Quando o mesmo PDF da apresentação já foi enviado há pouco tempo na mesma conversa, ele é reenviado de novo, ou o sistema pula o reenvio dentro de 24 horas? | Reenvia sempre, sem pular | Evita reenviar o mesmo arquivo duas vezes em poucos minutos, o que pode parecer robótico; a família ainda pode pedir de novo a qualquer momento | 26/10 |
| 21 | Depois que alguém da equipe assume uma conversa pelo aparelho, a resposta continua saindo pelo WhatsApp do celular, ou passa a sair por um campo dentro do próprio sistema? | Continua no WhatsApp do aparelho | Muda a forma como a equipe responde no dia a dia; depende também da decisão do número (item 1) | 13/10 |
| 22 | O vínculo com as enfermeiras continua misto (MEI e PJ), com escala por oferta e aceite? | Sim, como está hoje | Muda a forma como a escala é montada e paga | 09/11 |
| 23 | Os modelos de ficha em Word que têm trechos de uma paciente real precisam ser limpos e avaliados com o jurídico antes de qualquer novo uso? | Esses arquivos não entram no sistema de jeito nenhum | Nenhuma, essa parte já está decidida; falta só a limpeza dos arquivos originais fora do sistema | O quanto antes, antes de 05/10 |

## Decisões da Edilaine

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-- |
| 1 | [v4.3] O Google Meet, criado dentro do evento do Google Calendar, serve como ferramenta de vídeo da reunião inicial com as famílias? | Google Meet no convite; o campo livre de link continua existindo para reunião marcada pela equipe | Pode padronizar em outra ferramenta, o que muda o convite | 19/10 |
| 2 | O que fazer com os campos que aparecem na evolução mas não têm campo próprio no checklist diário (saturação de oxigênio da mãe e do bebê, aspecto e cor das secreções, abdômen, tipo de amamentação, entre outros)? | Ficam como texto livre até uma nova versão do checklist | Muda a estrutura do checklist e reduz digitação livre | 09/11 |
| 3 | Como tratar gêmeos no registro de pré-natal e na evolução diária, já que os modelos hoje pensam em um bebê só? | Um bloco de informações do bebê repetido para cada bebê | Muda a tela de preenchimento para famílias com gêmeos | 02/11 |
| 4 | O corte de alerta da avaliação de amamentação (escala LATCH) é 5 ou menos? | 5 ou menos, com o nível "atenção" | Muda quando o sistema avisa a equipe sobre dificuldade na amamentação | 09/11 |
| 5 | Dor relatada como 7 ou mais dispara alerta imediato ou alerta prioritário (não urgente no mesmo instante)? | Fica descrito no apêndice de regras do PRD, mas sem confirmação final | Muda a velocidade da resposta da equipe | 09/11 |
| 6 | Existe um corte de pressão arterial que deve gerar alerta automático, ou o valor só fica registrado para leitura manual? | Sem regra automática; o valor fica registrado, sem alerta sozinho | Cria um alerta automático quando a pressão passa de um certo valor | 09/11 |
| 7 | O texto de referência para o motor de alertas clínicos é o do arquivo Word mais recente, e não o do PDF nem o da versão v4.0? | Sim, vale o texto do Word | Muda o texto que dispara os alertas | 09/11 |
| 8 | Sinais citados no motor de alertas mas sem campo próprio no checklist (dor de cabeça forte, dor no peito, convulsão, sangue nas fezes) precisam de um campo novo? | Entram como um seletor de sinais dentro do checklist | Muda a tela de preenchimento da enfermeira | 02/11 |
| 9 | O resultado do teste de icterícia (ILIB) usa a cor vermelha, ou a cor vermelho-infravermelho, como está na v4.0? | Vermelho | Muda o texto na tela de avaliação do bebê | 02/11 |
| 10 | O registro de amamentação impede encerrar a visita, como diz o material de onboarding. Qual campo (ou combinação de campos) conta como "registro preenchido" para liberar o encerramento? | O bloco inteiro de amamentação precisa estar preenchido | Pode liberar com só um ou dois campos preenchidos, o que agiliza a visita | 09/11 |
| 11 | A evolução também deve ser enviada para a própria família, além dos médicos? | Sim, por tarefa manual de envio | Muda se isso vira automático | 09/11 |
| 12 | A regra de ganho de peso do bebê conta a partir do menor peso registrado, e o dia do nascimento conta como dia zero? | Sim, nos dois pontos | Muda o cálculo mostrado na evolução | 09/11 |
| 13 | A pesquisa de satisfação muda para incluir uma pergunta de 0 a 10 (NPS), além das perguntas atuais? | Pesquisa nova com as perguntas de hoje mais a pergunta de 0 a 10 | Muda o formulário enviado à família no fim do acompanhamento | 16/11 |
| 14 | Os termos que sobem o alerta máximo (bloqueio total: perda e óbito; os demais: aviso à equipe) estão certos, e os sinônimos propostos (óbito, natimorto, faleceu, entre outros) podem entrar ativos? | Os dez termos do treinamento estão ativos; os sinônimos ficam propostos, sem entrar em produção | Muda a lista de palavras que disparam alerta | 26/10 |
| 15 | Sobre chupeta: enquanto não houver uma posição única da Kraamzorg, a Isadora deve continuar sem opinar e dizer que a orientação é da enfermeira? | Sim, ela não opina | Muda se a Isadora passa a dar uma orientação própria | 26/10 |
| 16 | Para a família que já está com o bebê internado, este texto pode ir ao ar: "Sinto muito que vocês estejam passando por isso, {nome}. Estou avisando agora a nossa equipe, e a Edilaine ou o Leonardo vão falar com você por aqui"? | Esse texto fica desligado; vale o texto padrão de saúde (que manda procurar urgência), mesmo soando descolado da situação | Ativa um texto mais acolhedor para esse caso específico | 26/10 |
| 17 | Para tristeza intensa ou pensamento de se machucar, este texto pode ir ao ar, citando o CVV (188) além do SAMU (192)? | Esse texto fica desligado; vale o texto padrão de saúde | Ativa um texto pensado para sofrimento emocional; a recomendação é aprovar antes de a Isadora entrar em produção, por ser um caso sensível | 26/10 |
| 18 | No checklist diário, os blocos de orientação podem virar "marque o que foi feito", com "nada mais foi feito neste bloco" preenchendo o resto como "não", para reduzir toques na tela? | Cada item continua sendo marcado sim ou não, um por um | Agiliza o preenchimento da enfermeira, mas muda como fica registrada a diferença entre "não foi feito" e "não foi perguntado" | 09/11 |
| 19 | Para uma família já em bloqueio total (por uma perda) ou já encerrada por um motivo sensível, que relata um sintoma novo, ela recebe um texto de orientação próprio, ou só o aviso à equipe segue, sem nenhum texto para a família? | Só o aviso à equipe, sem texto para a família | Ativa um texto específico dizendo à família para procurar ajuda, mesmo nesse contexto delicado | 26/10 |
| 20 | Quando o áudio da família não pode ser transcrito, e quando a família manda foto ou vídeo sendo já cliente em atendimento, o texto e o prazo de resposta (hoje propostos: 1 hora corrida para o áudio, 2 horas para mídia de cliente em atendimento) estão certos? | Os textos e prazos propostos valem como estão | Muda o texto enviado e o tempo que a equipe tem para responder | 26/10 |
| 21 | Quais documentos (e por quanto tempo válidos) são exigidos de cada profissional no cadastro? | Cadastro livre, sem tipo fixo de documento | Cria uma lista fechada de documentos obrigatórios | 09/11 |
| 22 | Qual é a regra exata para o status "em atendimento" de uma enfermeira aparecer fora do horário de uma visita marcada? | O status é calculado sozinho a partir da agenda; fora do horário de visita, a regra exata ainda falta | Muda quando o CRM mostra a enfermeira como ocupada | 09/11 |
| 23 | O arquivo "1 Evolução MODELO.docx", que é uma evolução real com nomes trocados, pode ser descartado como modelo e seed, usando só textos padrão revisados? | Sim, esse arquivo não é usado como modelo nem como seed | Nenhuma, essa parte já está decidida; falta só confirmar e remover o arquivo original fora do sistema | O quanto antes, antes de 05/10 |

## Decisões do Leonardo e da Edilaine juntos

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-- |
| 1 | Existe um limite de dias depois do nascimento para ainda aceitar a família como cliente nova? | Sem limite definido; todo caso assim vira aviso prioritário para a equipe decidir | Cria um prazo fixo, depois do qual a família não é mais aceita como nova | 13/10 |
| 2 | Em caso de perda gestacional depois do pagamento, a família escolhe entre devolução integral do valor e manter o suporte, como diz um trecho do material de onboarding, ou só existe devolução integral, como diz outro trecho do mesmo material? | O sistema registra a escolha da família como decisão manual da diretoria, com o motivo anotado; nada acontece automaticamente | Define se a opção de manter o suporte sem devolução aparece como possibilidade real | 13/10 |
| 3 | A pesquisa de satisfação pode incluir a pergunta de NPS de 0 a 10? | Ver item 13 do grupo da Edilaine; aqui entra por ser decisão que passa pelos dois | Mesmo efeito do item da Edilaine | 16/11 |
| 4 | Os termos de alerta de saúde e o protocolo de perda, hoje desligados até aprovação, satisfazem a exigência do contrato de estarem prontos antes do início da Fase 1? A construção das telas segue normalmente, só a ativação em produção depende da aprovação da Edilaine. | Essa leitura é a adotada; se um dos dois discordar, as sessões da Fase 1 que dependem disso precisam ser replanejadas | Pode exigir refazer o cronograma de sessões dessa fase | O quanto antes, até 28/09 |
| 5 | Quando a família conta uma perda de uma gestação anterior (não desta gestação), o sistema deve seguir pelo caminho mais protegido (mesmo tratamento de uma perda atual, com aviso de que pode ser gestação anterior para reverter o alerta com um toque), ou por um caminho mais leve, sem acionar o alerta máximo? | Caminho mais protegido, igual ao de uma perda atual | Muda o texto e o nível de alerta para esse caso específico | 26/10 |
| 6 | Sobre quem pode ver o registro assistencial completo: a diretoria (incluindo o Leonardo) tem acesso total com registro de leitura, e o comercial não tem acesso nenhum, mesmo o material de onboarding indicando acesso total para os dois. Essa é a regra que vale? | Regra mais restritiva (comercial sem acesso; diretoria com acesso total registrado) até aprovação escrita dos dois | Pode abrir acesso do comercial, se for essa a decisão final | 05/10 |
| 7 | O botão "Desfazer" do freio de segurança, para quem acionou por engano, fica disponível por 10 segundos sem precisar da coordenação? Passado esse tempo, só a coordenação desfaz. | Sim, 10 segundos para quem acionou; 0 segundos desliga essa exceção | Muda a janela de tempo, ou remove a exceção | 05/10 |
| 8 | O sinônimo "perdi um bebê" (sem o artigo "o") deve entrar na lista de termos que bloqueiam a conversa por perda, igual a "perdi o bebê"? | Sim, os dois entram com a mesma ação de bloqueio total | Sem essa mudança, a frase "já perdi um bebê antes" não seria reconhecida do jeito mais seguro | 26/10 |
| 9 | Os nomes de família usados no mockup inicial da Drop são todos inventados, sem coincidir com nenhuma família atendida pela Kraamzorg? | O mockup fica fora do repositório e de qualquer publicação até a confirmação | Se algum nome coincidir, ele é trocado antes de o mockup ser guardado ou mostrado | 02/10 |

## Decisões que passam pelo jurídico (com o Leonardo)

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-- |
| 1 | Por quanto tempo os áudios das conversas ficam guardados depois do envio da evolução? | 90 dias depois do envio da evolução | Muda o prazo de retenção configurado no sistema | 05/10 |
| 2 | O registro assistencial da Kraamzorg é um prontuário, e a assinatura por login e senha com dupla verificação é suficiente, sem precisar de certificado digital ICP-Brasil? | Sim, é tratado como prontuário, com esse tipo de assinatura, e o sistema já deixa um caminho pronto para adicionar o certificado depois, se for exigido | Pode obrigar assinatura com certificado digital desde já, o que muda o fluxo de aprovação das evoluções | 05/10 |
| 3 | Por quanto tempo ficam guardados os dados de conversas e de contatos comerciais, incluindo os de quem nunca virou cliente? | Memória de conversa da Isadora apagada 180 dias depois da última mensagem; conversas e dados de quem nunca contratou apagados ou tornados anônimos 24 meses depois; endereço de IP tornado anônimo em 12 meses | Muda os prazos de guarda e quando os dados são apagados | 13/10 |
| 4 | A transcrição de áudio clínico por um serviço externo de terceiro pode ser ligada? | Fica desligada até aprovação | Ativa a transcrição automática desse tipo de áudio | 09/11 |
| 5 | Quando uma família pede para apagar seus dados, o que fica retido (registro assistencial, alertas, relatório médico, contrato, nota fiscal) e por quanto tempo, além do que a lei fiscal já exige? | O sistema já apaga conversa, memória da Isadora, mensagens, transferências e tarefas e torna o cadastro anônimo, mantendo o registro assistencial; falta decidir o restante | Define exatamente o que continua guardado e até quando | 05/10 |

## Decisões que passam pela contadora (com o Leonardo)

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-- |
| 1 | Qual provedor de nota fiscal de serviço (NFS-e) será usado, já que São Paulo passa a exigir o Emissor Nacional a partir de 01/11 e a Kraamzorg nunca emitiu certificado digital A1? | Um provedor com suporte ao Emissor Nacional; enquanto isso, emissão manual pela contadora | Muda o sistema de emissão de nota e o processo de cobrança | 09/11 |
| 2 | Quando o presente é comprado por outra pessoa, o contrato fica no nome de quem recebe o cuidado, e quem emite a nota fiscal é o pagador ou quem recebe o serviço? | Pagador separado do contratante, com um modelo de contrato próprio para esse caso | Muda quem aparece como tomador na nota fiscal | 19/10 |
| 3 | O texto usado com a família sobre reembolso ("cuidado domiciliar pós-parto; o reembolso depende do plano") está correto para efeito de nota fiscal e de pedidos de reembolso ao plano de saúde? | Esse é o texto usado hoje nas conversas | Muda a forma como o serviço é descrito para o plano de saúde da família | 19/10 |

---

## Decisões novas da v4.3: reunião inicial, agenda da Isadora e passagem ao Leonardo

Origem: Treinamento da Isadora v3, seção 10, e Prompt de Sistema v6.0, seção 31 (29/09/2026). A decisão de fundo já está tomada (PRD 4, D-19 a D-21): a Isadora qualifica até o agendamento da reunião online inicial de 30 minutos com a Edilaine, consulta o Google Calendar dela, cria o evento com Google Meet e só passa a conversa ao Leonardo depois de a Edilaine registrar a reunião como realizada. O que falta é confirmar os detalhes abaixo. Sem resposta, o sistema segue com o padrão indicado, e a produção da agenda só liga com a credencial do Google Calendar em nome da Kraamzorg (item N-E2).

### Onde ficou cada pendência das duas listas

| Pendência da lista do cliente | Onde está |
| :-- | :-- |
| Google Calendar da Edilaine: dias e faixas liberados, blocos de 30 minutos, antecedência mínima, intervalo entre reuniões, permissão para criar e mover eventos | N-E1 e N-E2 (PRD C-20, T-11) |
| Modelo do evento: título, descrição, link do Meet e quem é convidado | N-J1 (PRD C-21) |
| Como a Edilaine registra "reunião realizada" e como a conversa passa ao Leonardo | N-J2 (PRD C-22) |
| Tabela única de condições comerciais (Pix, parcelas, indicação médica, presente) | Leonardo 10 e 11 (Pix e parcelas) e N-L6 (indicação médica e presente) |
| Regra oficial para parto antes ou depois da DPP | N-L2 (PRD C-23) |
| Lista de bairros e cidades atendidos, regiões próximas e taxa de deslocamento | N-L3 (PRD C-24); taxa nos itens 8 e 19 do Leonardo |
| Formulário seguro para os dados do contrato e plataforma de assinatura | N-L4 (PRD C-25) |
| Modelo de contrato atualizado com o escopo da apresentação | Leonardo 15 |
| Versão leve do PDF e valor correto do Gemelar Essencial | Leonardo 4 |
| Desconto no Pix ou à vista | Leonardo 10 |
| Regra para quem quer reservar antes de 28 semanas | Leonardo 12 |
| Limite de dias depois do nascimento para iniciar o atendimento | Leonardo e Edilaine juntos 1 |
| Política de reembolso e documento fiscal | Contadora 3 |
| Processo de contrato e pagamento: quem envia e em quanto tempo | N-L5 (PRD C-26) |
| Canal oficial para recrutamento, fornecedores e parceiros | Leonardo 6 |
| Autorização de uso do nome nos depoimentos | Leonardo 18 |
| Regras de follow-up e janela de mensagens | Leonardo 2 (cadência) e N-L7 (janela) |

### Novas decisões do Leonardo

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-: |
| N-L1 | Quando a pessoa pede para "falar com alguém da equipe", a Isadora transfere para a equipe (como a seção 21 do prompt v6 manda) ou convida para a reunião com a Edilaine (como a seção 14.1 manda)? E quem diz que quer contratar antes de qualquer reunião: ela oferece a reunião e anota, ou transfere para você? | Pedir para marcar ou conversar com a Edilaine segue a agenda; pedir uma pessoa, você ou um atendente transfere; quem quer contratar antes da reunião recebe o convite e a anotação, e se insistir em falar com uma pessoa, a conversa é transferida | Muda quando a Isadora transfere e quantas conversas chegam a você antes da reunião (PRD C-27) | 13/10 |
| N-L2 | Qual é a regra oficial quando o bebê nasce antes ou depois da DPP? Ela substitui a frase antiga que garantia o atendimento independente da data. | A Isadora diz só que a reserva é feita pela DPP e que a equipe confirma a disponibilidade; qualquer regra sobre parto antes ou depois da DPP fica com a equipe | Define o que a Isadora pode dizer sobre parto antecipado ou atrasado (PRD C-23) | 26/10 |
| N-L3 | Qual é a lista oficial de cidades e bairros atendidos em São Paulo e Londrina, e como tratar regiões próximas (por exemplo, cidades vizinhas)? | A cobertura cadastrada no sistema; fora dela, a Isadora consulta a equipe sem transferir a conversa e responde à família | Muda o que a Isadora afirma sobre a área e quantas consultas chegam à equipe (PRD C-24) | 13/10 |
| N-L4 | O formulário seguro (link de uso único) e a Autentique como plataforma de assinatura estão confirmados para os dados e o contrato, depois da reunião? | Formulário seguro e Autentique | Muda a plataforma de assinatura e o texto do aviso antes do e-mail de assinatura (PRD C-25) | 19/10 |
| N-L5 | No contrato e no pagamento, quem envia o formulário, o contrato e o link, e em quanto tempo depois da reunião realizada? | Você envia depois da reunião realizada; sem prazo definido, e a Isadora nunca promete prazo | Cria um prazo e uma tarefa com vencimento no CRM (PRD C-26) | 26/10 |
| N-L6 | Na tabela única de condições, como ficam a indicação médica e o presente (cartão-presente e pagamento por outra pessoa)? Pix e parcelas já estão nos itens 10 e 11. | Nenhuma condição automática; tudo depende da sua aprovação registrada, e antes da reunião a Isadora só anota o pedido no resumo | Define o que você aplica depois da reunião | 26/10 |
| N-L7 | A janela de mensagens da Isadora (8h às 20h) e o limite de uma mensagem de conteúdo por dia valem também para o lembrete da véspera, a remarcação depois de falta e a cadência de 1, 3 e 14 dias? | Sim para a janela de horário; o lembrete da véspera não conta no limite diário de conteúdo, e a remarcação depois de falta e a devolutiva de consulta contam | Muda quando cada uma dessas mensagens pode sair | 19/10 |
| N-L8 | Com a API oficial do WhatsApp, o lembrete da véspera, a cadência, a retomada de horário, a remarcação por falta e a devolutiva de consulta viram modelos aprovados pela Meta, com texto fixo e variáveis. Você aprova o texto de cada modelo e o custo de submetê-los? (decisão junto com a Drop) | Textos do PRD 23.1 e 23.2 como base; a Drop submete depois da sua aprovação | Muda o texto e o prazo até a Isadora poder mandar essas mensagens fora da janela de 24 horas (PRD T-12) | 26/10 |

### Novas decisões da Edilaine

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-: |
| N-E1 | Como fica a agenda da reunião inicial: quais dias e faixas de horário ficam liberados, o bloco (30 minutos), a antecedência mínima, o intervalo entre reuniões e até quantos dias à frente a Isadora pode oferecer? A agenda que vale é a da reunião inicial ou a sua agenda principal? | Bloco de 30 minutos, antecedência de 24 horas, sem intervalo, até 14 dias à frente; sem faixa cadastrada a Isadora não oferece horário e avisa você | Muda os horários que a Isadora oferece (PRD C-20) | 19/10 |
| N-E2 | Quem cria a credencial do Google Calendar em nome da Kraamzorg e libera o acesso de edição só à agenda da reunião inicial para o n8n? A Isadora precisa poder criar e mover só os eventos da reunião inicial que ela mesma agenda. | A Isadora só é testada com um calendário de teste; produção só liga com essa credencial (PRD T-11) | Sem a credencial a Isadora não agenda em produção | 26/10 |
| N-E3 | Quanto tempo você leva para abrir um horário quando a Isadora avisa que a família não achou nenhum compatível? E qual perfil aparece como quem conduz a reunião no sistema? | Três dias antes de a tarefa subir de novo para você; o perfil da Edilaine como condutora | Muda o prazo da consulta de horário e quem aparece na agenda | 19/10 |

### Novas decisões dos dois juntos

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-: |
| N-J1 | O evento da reunião leva o título "Reunião inicial Kraamzorg" sem o nome da família (o título vira o assunto do e-mail de convite, e o projeto não usa nome de paciente em assunto), com o primeiro nome só como nome do convidado? O prompt v6 põe o nome no título. O Leonardo também recebe o convite? | Título sem o nome, primeiro nome no convidado, só a família como convidada | O título passa a levar o nome (basta um parâmetro), com o risco de o nome aparecer no assunto do e-mail (PRD C-21) | 19/10 |
| N-J2 | Como a Edilaine registra "reunião realizada" e "não compareceu" no CRM, e a passagem para o Leonardo acontece sozinha nesse momento? Quem lembra a Edilaine se o desfecho ficar sem registro? | Botão de desfecho da reunião no CRM, que passa a conversa ao Leonardo; a falta também é registrada por ela ou pela coordenação, nunca deduzida pela Isadora; se passar 24 horas do fim da reunião sem desfecho, nasce uma tarefa para a Edilaine | Muda o gatilho da passagem ao Leonardo e o prazo do lembrete (PRD C-22) | 19/10 |

### Nova decisão do jurídico (com o Leonardo)

| # | Pergunta | Padrão até a resposta | O que muda se a resposta for outra | Prazo |
| :-: | :-- | :-- | :-- | :-: |
| N-Ju1 | O Google (Calendar e Meet), na conta que a Kraamzorg já usa, pode ser operador para o e-mail e o horário da reunião das famílias? Quando uma família pede a eliminação dos dados, o evento da reunião é apagado do calendário? | Sim, com o mínimo de dados (só e-mail e primeiro nome do convidado, sem nome no título); a eliminação apaga o evento ainda marcado | Muda o contrato de tratamento com o Google e o que a eliminação apaga (PRD 21.3, T-11) | 19/10 |

---

Dúvidas sobre qualquer item deste documento podem ser respondidas direto aqui ou registradas no CRM, na ficha do item correspondente. Assim que uma resposta chega, ela entra no PRD com a marcação de quem decidiu e quando.
