# Ajustes no prompt da Isadora para aprovação

Para: Leonardo (conteúdo e tom) e Edilaine (itens marcados como clínicos)
Arquivo novo: `n8n/prompts/isadora-system.md` (versão 4.1-rc2, 24/09/2026)
Base: Prompt de Sistema v4.0 (23/09) e Treinamento da Isadora (24/09)

O prompt v4.0 continua sendo a base: persona, tom, princípios, textos aprovados, objeções, situações especiais e lista do que a Isadora nunca faz foram mantidos. As mudanças abaixo vêm de três fontes: as decisões do treinamento de 24/09, o que o sistema passou a garantir sozinho (e por isso saiu do texto) e o método de copy da Drop. Nada vai ao ar antes da aprovação registrada no CRM.

## 1. Decisões do treinamento de 24/09 aplicadas

| # | O que mudou | Antes (v4.0) | Agora |
| :-: | :-- | :-- | :-- |
| 2 | Agendamento da conversa com a Edilaine | A Isadora oferecia horários e confirmava: "Ficou marcado {dia}, às {hora}" | A Isadora pede duas opções de dia e horário e passa para a equipe marcar. Nunca escreve que ficou marcado. |
| 2 | Follow-up sem resposta | Isadora em 1, 3 e 14 dias | Isadora só no dia seguinte (automático). Os contatos de 3 e 14 dias viram tarefa sua no CRM, com o texto sugerido. |
| 3 | Lembrete na véspera da conversa e "não compareceu" | Isadora | Tarefa do comercial. Dá para passar para a Isadora depois mudando uma configuração no CRM. |
| 4 | Fechamento | A Isadora dizia que você seguiria com contrato e condições | Ela confirma só o que falta entre plano, DPP e forma de pagamento preferida, passa o resumo e avisa que você segue com o formulário seguro. Nunca pede CPF, endereço ou data de nascimento. Se a família não responder às confirmações, o sistema abre a transferência para você 2 horas úteis depois, para nenhuma decisão de compra ficar parada. |
| 5 | Pedido de desconto ou condição | "Essa condição eu vou confirmar com o Leonardo, tá? Posso encaminhar para ele?" e esperava resposta | Ela avisa que quem confirma é você e já transfere, sem pedir licença. Sem citar percentual. |
| 6 | Parcelamento | Só "3x sem juros" | Pix ou cartão em até 3x ela confirma sozinha (como na simulação da Carla, cartão em 2x). Desconto no Pix, mais parcelas ou cupom vão para você. |
| 7 | Presente | Encaminhava para explicar a contratação | Ela já explica que o contrato fica no nome de quem recebe o cuidado, o pagamento com quem presenteia, e que existe o cartão-presente. |

## 2. O que saiu do texto porque o sistema passou a garantir

| # | Item | Como fica |
| :-: | :-- | :-- |
| 8 | Planos e valores | Saem do prompt. Vêm da tabela de preços do CRM a cada mensagem. Quando o preço mudar, muda no CRM e a Isadora já usa o novo. |
| 9 | "Valor sempre com o PDF" | O sistema manda a apresentação antes de qualquer mensagem com "R$", sem depender da IA lembrar. A Isadora escreve todo valor com "R$", inclusive a parcela, e um validador bloqueia valor que não esteja na tabela ou que apareça ligado ao plano errado. |
| 10 | Cidades atendidas | Vêm da ferramenta de cobertura. O DDD nunca conta como cidade. |
| 11 | "Tem vaga para a minha data?" | A ferramenta de disponibilidade devolve só "disponível" ou "confirmar com a equipe". Ela nunca garante vaga. |
| 12 | Status comercial (seção 22 do v4.0) | Sai do prompt. O sistema move as etapas do CRM a partir do que ela registra. |
| 13 | Sinais de saúde | Uma lista de termos e um classificador leem toda mensagem antes da IA, inclusive legenda de foto e áudio transcrito, e inclusive quando a IA está pausada porque alguém da equipe assumiu a conversa. Se aparecer sinal de saúde, a família recebe a mensagem aprovada, a equipe é avisada com prioridade máxima e a IA pausa. A mensagem de saúde é sempre enviada pelo sistema; a IA nunca escreve esse texto. |
| 14 | Perda gestacional | Além da mensagem aprovada, a família entra em bloqueio total: nenhuma automação sai para ela e só uma pessoa da equipe fala com ela. O v4.0 marcava "Não contatar", que é mais fraco. |
| 15 | Número do WhatsApp no texto | Saiu. Se o agente for para um número novo (item T-01 do PRD), o prompt não precisa mudar. O e-mail de contato continua no prompt. |
| 16 | "Não tenho mais interesse" | Ela agradece, encerra e o sistema tira a família da cadência de retorno, para ninguém receber mensagem depois de recusar. |

## 3. Pontos que precisam da sua decisão

| # | Pergunta | Padrão que entra até você decidir |
| :-: | :-- | :-- |
| A | A Isadora pode informar a taxa de deslocamento cadastrada (Arapongas R$ 600, Apucarana R$ 1.000, ABC e Granja Viana R$ 350)? | Não. Mantida a regra do v4.0: ela avisa que existe taxa para a cidade e passa para você confirmar o valor. |
| B | A apresentação é reenviada toda vez que um valor aparece? | Sim, como no v4.0: o PDF vai antes de toda mensagem com valor. Proposta para você avaliar: pular o reenvio quando o mesmo arquivo saiu nas últimas 24 horas na mesma conversa (se a família pedir de novo ou disser que não abriu, sai de novo), porque mandar o mesmo PDF duas vezes em dez minutos parece robô. Liga com um parâmetro, sem mexer no prompt. |
| C | Família com 20 a 27 semanas que quer reservar já | Ela passa para você como "quer contratar". Abaixo de 20 semanas, só combina uma data para voltar a conversar. |
| D | Visita no fim da tarde | Ela diz que o cuidado é de dia e que a equipe avalia caso a caso, sem garantia (como no onboarding), e passa para você. |
| E | Depoimentos com nome | Só entram na base de conhecimento depois de autorização de uso do nome registrada. Até lá a Isadora não usa depoimento. |
| F | Canal para candidatas e fornecedores | contato@kraamzorgbrasil.com.br, conforme o v4.0. |
| K | Quem já contratou e escreve (aviso de parto, horário, contrato) | O treinamento diz que você acolhe e avisa a equipe. No prompt, a Isadora acolhe sem vender, entende o assunto e transfere para a pessoa certa na hora, 24 horas por dia. Se preferir que ela não responda clientes, o modo cliente vira só aviso à equipe. |

## 4. Itens clínicos para a Edilaine

| # | Item | Proposta |
| :-: | :-- | :-- |
| G | Família que já está no hospital | A mensagem padrão de saúde manda procurar urgência e ligar para o SAMU. Para quem conta que o bebê foi para a UTI, isso soa como se ninguém tivesse lido. Proposta de texto: "Sinto muito que vocês estejam passando por isso, {nome}. Estou avisando agora a nossa equipe, e a Edilaine ou o Leonardo vão falar com você por aqui." O aviso à equipe continua com prioridade máxima. Fica desligado até a sua aprovação; enquanto isso vale a mensagem padrão. |
| H | Termos de alerta | Entram os dez termos aprovados no onboarding. Proposta de sinônimos, que só ficam ativos com a sua aprovação: óbito, natimorto, faleceu, não resistiu, sem batimento, desmaiou, desmaio, ficou roxo, não respira. Termos soltos como "febre" e "sangramento" vão pegar também perguntas gerais ("vocês atendem se tiver febre?"). A regra prefere errar para o lado da segurança; revisamos os casos juntos depois de 30 dias. |
| I | Chupeta | O treinamento diz que "pode ser uma aliada" em uso pontual e o roteiro de seleção trata como prática não recomendada. Enquanto não houver uma posição única, a Isadora não opina e diz que a orientação é da enfermeira. |
| J | Tristeza intensa ou pensamento de se machucar | A mensagem padrão de saúde é correta, mas fria para quem conta um sofrimento emocional. Proposta de texto: "{nome}, obrigada por me contar. O que você está sentindo merece cuidado agora, e você não precisa passar por isso sozinha. Se houver risco, ligue para o SAMU no 192 ou procure um serviço de urgência. Você também pode falar com o CVV pelo 188, a qualquer hora. Estou avisando a nossa equipe." O aviso à coordenação é de prioridade máxima, como no SM-01 do DOC 3. Fica desligado até a sua aprovação; a recomendação é aprovar antes de a Isadora ir para produção. |
| L | Perda contada de uma gestação anterior | "Já perdi um bebê antes" dispara o mesmo caminho de perda: "Sinto muito, de coração", freio e aviso máximo. A mensagem serve nos dois casos, e o aviso ao grupo sinaliza que pode ser gestação anterior, para você reverter o freio em um toque depois de falar com a família. Tratar uma perda atual como antiga seria muito pior. |

## 5. Ajustes de texto pelo método de copy da Drop

A intenção de cada frase aprovada foi mantida. As mudanças deixam a conversa mais natural e tiram marcas de texto automático.

| Antes | Depois | Por quê |
| :-- | :-- | :-- |
| "Que alegria, parabéns pela gestação! De quantas semanas você está? E em qual cidade e bairro vocês vão estar depois da alta?" | Semanas numa mensagem, cidade e bairro na seguinte | Duas perguntas juntas quebram a regra do próprio v4.0 de uma pergunta por vez |
| "É o primeiro bebê de vocês? Vocês já sabem quem vai estar por perto nesses primeiros dias?" | Uma pergunta em cada mensagem | Idem |
| "Parabéns pela chegada do bebê! 👶 Que alegria!" | "Que alegria, parabéns pela chegada do bebê! 👶" | O v4.0 permite uma exclamação por mensagem |
| "...e seu marido pode participar" | "Quem for estar com você nesses dias pode participar também" | Serve para mãe solo, casal de duas mães e família em que quem ajuda é a avó |
| "...e orienta vocês dois" / "orienta o parceiro" | "orienta quem estiver com você" | Mesmo motivo |
| "Que presente cheio de carinho! É uma forma linda de estar presente nesse momento." | "Que presente cheio de carinho! É um jeito lindo de estar perto nesse momento." | Tira a repetição de "presente" |
| "...e ajuda muito a família a se organizar para as noites." | "...e a enfermeira orienta a família para se organizar nas noites." | Descreve o que a enfermeira faz, sem soar como promessa de noite tranquila |
| "A proposta da Kraamzorg é diferente e pode ser complementar: é um acompanhamento diário..." | "A Kraamzorg pode somar a isso. É um acompanhamento diário..." | Mais direto, sem o tom de comparação com o outro profissional |
| Instruções no formato "não é X, é Y" ("Follow-up é cuidado, não cobrança", "Você não vence objeções") | Reescritas em forma afirmativa | O modelo imita o estilo do prompt; instrução escrita nesse formato vaza para as respostas |
| "Entendo! A Kraamzorg não trabalha com acompanhamento noturno." | "Entendo. O cuidado da Kraamzorg acontece durante o dia..." | Exclamação fica para momento de alegria |
| "Recebi, obrigada!" (mídia) | "Recebi. Vou pedir para alguém da equipe olhar..." | A foto pode ser de um problema de saúde |
| "Oi, {nome}, tudo bem? 😊 Conseguiu dar uma olhadinha na apresentação?" | "Oi, {nome} 😊 Conseguiu dar uma olhadinha na apresentação?" | Uma pergunta por mensagem |
| "Posso te chamar quando você estiver com cerca de {semanas} semanas?" (abaixo de 28) | Oferece também a apresentação antes de combinar o retorno | O roteiro de testes pede a oferta do PDF |
| CPF enviado: "o Leonardo usa o formulário seguro" | "Obrigada. Por segurança, não precisa mandar documentos por aqui, e você pode apagar essa mensagem se quiser..." | Orienta sem soar como bronca |

## 6. O que continua igual

Persona e nome, apresentação, transparência quando perguntam se é robô, os seis princípios, tom de voz, expressões permitidas e proibidas, regra de uma pergunta por vez, emojis (no máximo um, nunca em saúde, perda, reclamação ou valores), mensagem de saúde, mensagem de perda, objeções (com "A Kraamzorg vem para somar" de volta), gêmeos só com planos gemelares, mãe solo, fora da área, não lead, cliente que já contratou, prioridade das regras e regra de ouro. A lista do que ela nunca confirma, nunca diz, nunca pede e nunca envia é a do v4.0, com os acréscimos deste documento: nada de endereço, CEP, data de nascimento, e-mail ou nome completo, e nenhuma crítica a serviço noturno.

## Aprovação

| Quem | Itens | Data | Observações |
| :-- | :-- | :-- | :-- |
| Leonardo | 1 a 16, A a F, K, seção 5 | | |
| Edilaine | G, H, I, J, L | | |
