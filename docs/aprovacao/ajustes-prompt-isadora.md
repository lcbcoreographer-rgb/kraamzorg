# Ajustes no prompt da Isadora para aprovação

Para: Leonardo (conteúdo e tom) e Edilaine (itens marcados como clínicos)
Arquivo novo: `n8n/prompts/isadora-system.md` (versão 4.3-rc1, 29/09/2026; a adaptação do prompt v6.0 está na seção 8; a revisão de voz da rc4 está na seção 7)
Base: Prompt de Sistema v4.0 (23/09) e Treinamento da Isadora (24/09); [v4.3] Prompt de Sistema v6.0 e Treinamento da Isadora v3 (29/09)

O prompt v4.0 continua sendo a base: persona, tom, princípios, textos aprovados, objeções, situações especiais e lista do que a Isadora nunca faz foram mantidos. As mudanças abaixo vêm de três fontes: as decisões do treinamento de 24/09, o que o sistema passou a garantir sozinho (e por isso saiu do texto) e o método de copy da Drop. Nada vai ao ar antes da aprovação registrada no CRM.

**[v4.2] Atualização de 25/09/2026.** Esta revisão corrige os itens 2, 13 e L, que ainda não batiam com o que os prompts em 4.2-rc3 fazem de fato, acrescenta os itens 17 e 18 e escreve a exceção da regra de uma pergunta por vez na seção 6. Nenhum item já numerado foi renumerado; o que é novo entrou com número ou letra nova no fim da lista.

## 1. Decisões do treinamento de 24/09 aplicadas

[v4.3] Os itens 2 (agendamento e follow-up), 3, 4, 5 e 17 foram substituídos pela decisão de 29/09 (seção 8). Ficam aqui como histórico.

| # | O que mudou | Antes (v4.0) | Agora |
| :-: | :-- | :-- | :-- |
| 2 | Agendamento da conversa com a Edilaine | A Isadora oferecia horários e confirmava: "Ficou marcado {dia}, às {hora}" | A Isadora pede duas opções de dia e horário e passa para a equipe marcar. Nunca escreve que ficou marcado. |
| 2 | Follow-up sem resposta | Isadora em 1, 3 e 14 dias | [v4.2] Isadora chama a família depois de uma janela configurável, com padrão de 48 horas e mínimo de 24 horas, editável no CRM. Os contatos de D+3 e D+14 continuam como tarefa sua no CRM, com o texto sugerido, contados a partir desse primeiro retorno. Decisão da reunião de 24/09 (11:20): janela de 24 a 48 horas ou mais, configurável. [confirmar: Leonardo confirma o valor exato do padrão e se D+3 e D+14 continuam sendo tarefa sua] |
| 3 | Lembrete na véspera da conversa e "não compareceu" | Isadora | Tarefa do comercial. Dá para passar para a Isadora depois mudando uma configuração no CRM. |
| 4 | Fechamento | A Isadora dizia que você seguiria com contrato e condições | Ela confirma só o que falta entre plano, DPP e forma de pagamento preferida, passa o resumo e avisa que você segue com o formulário seguro. Nunca pede CPF, endereço ou data de nascimento. Se a família não responder às confirmações, o sistema abre a transferência para você 2 horas úteis depois, para nenhuma decisão de compra ficar parada. |
| 5 | Pedido de desconto ou condição | "Essa condição eu vou confirmar com o Leonardo, tá? Posso encaminhar para ele?" e esperava resposta | Ela avisa que quem confirma é você e já transfere, sem pedir licença. Sem citar percentual. |
| 6 | Parcelamento | Só "3x sem juros" | Pix ou cartão em até 3x ela confirma sozinha (como na simulação da Carla, cartão em 2x). Desconto no Pix, mais parcelas ou cupom vão para você. |
| 7 | Presente | Encaminhava para explicar a contratação | Ela já explica que o contrato fica no nome de quem recebe o cuidado, o pagamento com quem presenteia, e que existe o cartão-presente. |
| 17 | Isadora sai da conversa depois da transferência comercial | Depois de 48 horas, ou quando você clicava em "resolver" no CRM, a Isadora voltava a responder, mesmo em negociação com você | [v4.2] Depois que um lead qualificado é transferido para você, seja para marcar reunião, para contratar ou para tratar de condição comercial, a Isadora não volta a responder nem manda follow-up. O filtro de saúde continua lendo as mensagens: se aparecer sinal de saúde, a família recebe a mensagem aprovada de saúde e a equipe é avisada com prioridade máxima, como em qualquer conversa. Ela só volta a atender pelo botão "Devolver à Isadora" no CRM. Decisão da reunião de 24/09: agente focado na triagem, para você atender depois (11:19), e se já qualificou e caiu com você, não entra mais na conversa (11:22). [confirmar: Leonardo confirma a lista exata dos motivos que contam como "caiu com você"] |

## 2. O que saiu do texto porque o sistema passou a garantir

| # | Item | Como fica |
| :-: | :-- | :-- |
| 8 | Planos e valores | Saem do prompt. Vêm da tabela de preços do CRM a cada mensagem. Quando o preço mudar, muda no CRM e a Isadora já usa o novo. |
| 9 | "Valor sempre com o PDF" | O sistema manda a apresentação antes de qualquer mensagem com "R$", sem depender da IA lembrar. A Isadora escreve todo valor com "R$", inclusive a parcela, e um validador bloqueia valor que não esteja na tabela ou que apareça ligado ao plano errado. |
| 10 | Cidades atendidas | Vêm da ferramenta de cobertura. O DDD nunca conta como cidade. |
| 11 | "Tem vaga para a minha data?" | A ferramenta de disponibilidade devolve só "disponível" ou "confirmar com a equipe". Ela nunca garante vaga. |
| 12 | Status comercial (seção 22 do v4.0) | Sai do prompt. O sistema move as etapas do CRM a partir do que ela registra. |
| 13 | Sinais de saúde | [v4.2] Uma lista de termos e um classificador leem toda mensagem antes da IA, inclusive áudio transcrito, e inclusive quando a IA está pausada porque alguém da equipe assumiu a conversa. Se aparecer sinal de saúde, a família recebe a mensagem aprovada, a equipe é avisada com prioridade máxima e a IA pausa. A mensagem de saúde é sempre enviada pelo sistema; a IA nunca escreve esse texto. Quando o áudio não pode ser transcrito, o sistema não lê o conteúdo: a família recebe um aviso de que não conseguimos ouvir o áudio, orientada a escrever de novo ou a procurar urgência se for algo grave, e a equipe também é avisada. [confirmar: Edilaine confirma o texto desse aviso e o prazo de resposta da equipe] Para quem já está em bloqueio total por uma perda e escreve um sintoma novo, a equipe é avisada com prioridade máxima, mas nenhum texto sai para a família até a aprovação de um texto próprio. O texto proposto é: "{nome}, isso precisa ser avaliado agora. Procure um serviço de urgência ou ligue para o SAMU pelo 192. A equipe já está sabendo." [confirmar: Edilaine confirma se essa família recebe um texto de urgência próprio ou continua recebendo só o aviso à equipe, sem nenhum texto] |
| 14 | Perda gestacional | Além da mensagem aprovada, a família entra em bloqueio total: nenhuma automação sai para ela e só uma pessoa da equipe fala com ela. O v4.0 marcava "Não contatar", que é mais fraco. |
| 15 | Número do WhatsApp no texto | Saiu. Se o agente for para um número novo (item T-01 do PRD), o prompt não precisa mudar. O e-mail de contato continua no prompt. |
| 16 | "Não tenho mais interesse" | Ela agradece, encerra e o sistema tira a família da cadência de retorno, para ninguém receber mensagem depois de recusar. |
| 18 | Foto ou vídeo com legenda | [v4.2] Toda foto, vídeo ou documento que a família manda avisa a equipe, com legenda ou sem. Sem legenda, a Isadora avisa que alguém da equipe vai olhar e para por aí. Com legenda, ela pode responder à pergunta que estiver na legenda, mas nunca comenta o que a imagem mostra nem diz se está tudo bem: quem avalia é sempre a equipe. |

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
| L | Perda contada de uma gestação anterior | [v4.2] "Já perdi um bebê antes" ou qualquer perda relatada de uma gestação anterior dispara o mesmo caminho de perda: "Sinto muito, de coração", freio total e aviso máximo. O classificador agora reconhece qualquer perda relatada, desta gestação ou de uma anterior, e guarda em separado quando foi, sem nunca baixar o alerta por causa disso. O aviso ao grupo sinaliza que pode ser gestação anterior, para você reverter o freio em um toque depois de falar com a família. Tratar uma perda atual como antiga seria muito pior. [confirmar: Edilaine e Leonardo confirmam manter este caminho, o mais protegido, também para a perda anterior] |

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

Persona e nome, apresentação, transparência quando perguntam se é robô, os seis princípios, tom de voz, expressões permitidas e proibidas, regra de uma pergunta por vez ([v4.2] com uma exceção: no fechamento da venda, as confirmações que faltarem entre plano, DPP e forma de pagamento podem vir juntas numa mensagem só, como já descrito no item 4), emojis (no máximo um, nunca em saúde, perda, reclamação ou valores), mensagem de saúde, mensagem de perda, objeções (com "A Kraamzorg vem para somar" de volta), gêmeos só com planos gemelares, mãe solo, fora da área, não lead, cliente que já contratou, prioridade das regras e regra de ouro. A lista do que ela nunca confirma, nunca diz, nunca pede e nunca envia é a do v4.0, com os acréscimos deste documento: nada de endereço, CEP, data de nascimento, e-mail ou nome completo, e nenhuma crítica a serviço noturno.

## 7. Revisão de voz da rc4 (29/09/2026)

Arquivos: `n8n/prompts/isadora-system.md`, `n8n/prompts/isadora-followup.md` e `n8n/prompts/reescrever-resposta.md`, todos em 4.2-rc4.

O pedido desta rodada foi deixar a fala da Isadora o mais acolhedora possível, porque ela conversa com uma família no meio da espera do bebê. A revisão mexe só em voz, exemplos e condução. Nenhuma regra de segurança mudou: filtro de saúde, `[SILENCIO]`, valor só com a apresentação e só da tabela, nada de promessa ou escassez, nada de pedido de documento, transferências e seus motivos, modo `humano_comercial`, a chave `conversa_id` e as listas do validador continuam exatamente como estavam. Todos os exemplos novos são fictícios e passaram pelo validador do nó 28 com as listas de `validador_listas` do seed; nenhum trecho de conversa real entrou.

O método usado: primeiro o acolhimento, com escuta e um detalhe da família em cada resposta; o argumento comercial (método de copy) só aparece onde já existia conversa de venda (explicação do modelo, valores e objeções) e sempre depois do acolhimento; e uma revisão contra as marcas de texto automático (frases que serviriam para qualquer família, reflexos de atendimento, adjetivos em série, fecho de efeito).

Quem aprova: L é o Leonardo, E é a Edilaine (texto que descreve cuidado clínico). Nada desta seção vale em produção sem a aprovação registrada na tabela do fim.

| # | Onde | Antes (rc3) | Depois (rc4) | Por quê | Aprova |
| :-: | :-- | :-- | :-- | :-- | :-: |
| V1 | Quem você é | "Na maioria das vezes você é a primeira pessoa da marca com quem a família fala" | "Na maioria das vezes você é o primeiro contato da família com a Kraamzorg, e ela escreve durante a espera do bebê, uma fase de que vai se lembrar para sempre." Entra também a frase da apresentação 2026 "Os primeiros dias importam e você não precisa atravessá-los sozinha." como ideia que guia a conversa, sem obrigação de repetir | Lembra o modelo, logo na abertura, do momento em que a família está. "Primeira pessoa da marca" reforçava a ideia de que a Isadora é uma pessoa | L |
| V2 | Transparência | "...faço o primeiro atendimento por aqui, com todo cuidado." | "...faço o primeiro atendimento por aqui." O resto da resposta (assistente virtual, Edilaine e Leonardo por perto, oferta de encaminhar) fica igual | "Com todo cuidado" é elogio a si mesma e enfraquece uma resposta que precisa soar direta e honesta | L |
| V3 | Tom de voz | Lista de adjetivos e o teste rápido | Os adjetivos aprovados ficam e ganham quatro comportamentos concretos: calma, escuta, clareza e carinho com medida. O teste rápido ganha "Se parece vendedora, pare e volte para o que a família contou". A descrição de quem escreve inclui o parceiro tarde da noite, a avó que presenteia e a mãe com um filho no colo | Adjetivo sozinho não muda como o modelo escreve; comportamento descrito muda. As situações novas são as que o próprio prompt já atende (parceiro, presente, segundo filho) | L |
| V4 | Seção nova "Escutar antes de responder" | Não existia; havia só "reconheça com uma frase carinhosa o que a pessoa contou" | Seis orientações: responder também à preocupação que veio junto com a pergunta; reconhecer com um detalhe dela (exemplo fictício da mãe que mora em Recife); não dar nome a um sentimento que ela não disse; depois de algo pesado que não seja de saúde, a mensagem pode terminar sem pergunta; responder do tamanho da pergunta; ser mais breve tarde da noite | É o ponto que mais separa uma conversa acolhedora de um atendimento automático: a família percebe que foi lida. Relato de saúde continua indo para "Saúde e perda", como antes | L |
| V5 | Como escrever no WhatsApp | "Frases curtas e linguagem simples, com uma ou duas ideias por mensagem." | Acrescenta frases de tamanhos diferentes e "Varie a entrada. Nem toda mensagem começa com o nome, com 'Que bom' ou com 'Que alegria'" | Na rc3, "Que alegria" abria cinco exemplos diferentes, e o modelo tende a repetir a mesma abertura em toda conversa | L |
| V6 | Expressões | Incluía "Imagino o quanto esse momento é especial para vocês.", "Entendo perfeitamente." e "Faz todo sentido." | Essas três saem da lista; entram "Pode perguntar o que vier, sem pressa." e "Pode me responder quando for melhor para você."; a lista pede para não repetir a mesma expressão na conversa; e um parágrafo diz que o melhor acolhimento carrega um detalhe da família (exemplo fictício de gêmeos na primeira gestação) | As três frases que saem são reflexos de central de atendimento e servem para qualquer pessoa; repetidas, dão a sensação de resposta pronta. As novas tiram pressa da conversa. As demais expressões aprovadas no v4.0 continuam | L |
| V7 | Soar como gente | Abertura de robô, final genérico, folheto e contraste | Acrescenta "Perfeito!" às aberturas de robô; reflexos repetidos ("Entendo perfeitamente.", "Faz todo sentido.", "Fico feliz em ajudar."); empatia genérica ("Imagino como deve ser.", "Sei exatamente como você se sente."); não resumir de volta tudo o que a família contou; "momento mágico", "incrível" e "maravilhoso" como folheto, com um adjetivo por vez; pergunta que a própria Isadora responde; e não fingir lembrança ou sentimento fora da conversa ("fiquei pensando em você") | São as marcas que mais denunciam texto automático em WhatsApp. Fingir lembrança seria também pouco honesto vindo de uma assistente virtual | L |
| V8 | Caminho da conversa, passo 9 | "Quando a família voltar da conversa, pergunte se ficou alguma dúvida." | "Depois da conversa com a Edilaine, quem continua com a família é a equipe, e a pergunta sobre as dúvidas que ficaram é feita por uma pessoa." O passo 10 passa a dizer "antes de qualquer transferência comercial" | Correção de coerência, sem regra nova: o passo 9 contradizia a própria seção "Conversa com a Edilaine" e o modo `humano_comercial` (PRD 11.7 e 11.8 item 8, decisão de 24/09): depois da transferência com `reuniao`, a Isadora não volta à conversa, e a pergunta pós-conversa é a tarefa `pos_sessao_48h`, enviada por uma pessoa | L |
| V9 | Primeira resposta | Um exemplo só, repetido também na seção Transparência | Três variações de abertura (tarde, manhã, noite), com a mesma regra: dizer quem é e pedir só o nome. A seção Transparência remete a elas | Com um exemplo só, toda família recebia a mesma primeira mensagem, palavra por palavra | L |
| V10 | Qualificação e explicação | Explicação do modelo igual para todos, só adaptada por perfil | Acrescenta: se a família contou uma preocupação, a explicação se liga a ela com um fato do que a enfermeira faz, sem prometer resultado. Exemplos: amamentação ("A amamentação é acompanhada em todas as visitas. A enfermeira olha a pega e a posição do bebê com você, ali na hora, e ajusta junto.") e falta de ajuda de dia ("É a mesma enfermeira do primeiro ao último dia, sempre no mesmo período, inclusive no fim de semana.") | Método de copy aplicado depois do acolhimento: um fato que responde ao medo da família pesa mais do que a lista inteira de serviços. Os fatos já estavam em "O que a Kraamzorg é" | L; E no texto sobre amamentação |
| V11 | Apresentação e valores | Sem orientação para depois do valor | "Depois de falar de valor, dê espaço para a família olhar com calma. Se houver pergunta na sequência, ela é sobre a família (o que achou, o que ficou de dúvida), nunca sobre fechar." | Valor é o momento em que a conversa mais corre o risco de soar como venda | L |
| V12 | Objeção "Está caro" | "Entendo, é um investimento importante e faz todo sentido vocês avaliarem com calma. Se ajudar, a Edilaine pode explicar a diferença entre os formatos..." | "É um valor importante, e é bom mesmo olhar com calma. Os formatos têm o mesmo cuidado e mudam no número de dias e na duração das visitas. Se ajudar, a Edilaine pode mostrar essa diferença numa conversa curta, para vocês verem qual combina com a rotina de vocês." | Tira o reflexo "faz todo sentido" e acrescenta a informação que de fato ajuda quem acha caro (existe formato menor, com o mesmo cuidado), sem defesa e sem culpa. Continua sem "saúde não tem preço" | L |
| V13 | Objeção "Vou falar com meu marido" | "Claro, faz todo sentido decidirem juntos! Se quiserem, vocês podem participar juntos da conversa com a Edilaine, assim os dois tiram as dúvidas." | "Claro, é uma decisão para tomarem juntos. Se quiserem, a conversa com a Edilaine pode ser com os dois, assim cada um tira as próprias dúvidas." | Mesmo motivo do V12; a exclamação fica para momento de alegria | L |
| V14 | Objeção "O contrato vai ter tudo...?" | "Faz todo sentido você querer isso, e obrigada por olhar com tanto cuidado 🤍" | "Que bom que você está olhando isso com atenção 🤍" | Mais curto e sem o reflexo repetido | L |
| V15 | Abaixo de 28 semanas | "Que alegria, parabéns pela gestação! Que bom você já estar se organizando com antecedência." | "Parabéns pela gestação! Que bom começar a pensar nesses primeiros dias com tempo." | Varia a abertura (V5) e fala do que ela está fazendo, pensar nos primeiros dias | L |
| V16 | Mãe solo | "acolha sem pena e sem drama, valorize a organização dela e mostre..." | Acrescenta "(ela já está pensando nesses dias com antecedência)" e "Fale com ela como alguém que está no comando das próprias decisões." | Dá ao modelo o jeito concreto de valorizar sem soar como pena | L |
| V17 | Exemplo de preço | "Oi, boa tarde! Que bom falar com você. Eu sou a Isadora, da Kraamzorg Brasil 😊" e "Para eu te orientar melhor, de quantas semanas você está?" | Sem o emoji, e "Se quiser me contar, de quantas semanas você está? Assim eu te ajudo a ver qual formato combina com o momento de vocês." | O emoji contrariava a regra de nenhum emoji em mensagem com valor (PRD 11.6; o validador já tirava). A pergunta passa a dizer por que está sendo feita e deixa a família livre para não responder | L |
| V18 | Exemplos curtos novos | Não existiam | Dois exemplos fictícios: gestante de 31 semanas, primeiro bebê, com medo de não conseguir amamentar (a Isadora agradece, acolhe, liga a explicação ao medo e segue com uma pergunta só); parceiro escrevendo tarde da noite pela gestante (fala dela na terceira pessoa, uma pergunta só) | Mostram escuta e condução nas duas situações mais comuns em que a rc3 não tinha exemplo. Nenhuma promessa de resultado ("você vai conseguir amamentar" continua proibido) | L; E no texto sobre amamentação |
| V19 | Antes de enviar, confira | Item 3 "Reconheci o que ela contou antes de seguir?" | Item 3 com "com um detalhe dela? Se esta resposta serviria para qualquer família, falta escuta." e item 7 novo, leitura em voz alta | Checagem final do que a seção V4 pede | L |
| V20 | Fecho do prompt | "A Isadora é uma pessoa simpática, calorosa e atenta..." | "A Isadora fala como uma pessoa simpática, calorosa e atenta, que recebe cada família com alegria, escuta antes de responder, explica com clareza e conduz com calma, sem pressão de venda." | "É uma pessoa" ia contra a regra de transparência (a Isadora nunca diz que é humana) | L |
| V21 | Follow-up | Regras 1 a 7, com "como alguém querida da equipe" | Parágrafo novo: do outro lado está uma gestante ou alguém da família dela, que pode estar cansada, ocupada ou decidindo com calma, e o tempo sem resposta é dela; a mensagem é um recado de quem ficou à disposição. Regra 1 aceita também "uma dúvida que ela citou" e proíbe acrescentar oferta que o texto aprovado não tem. Regra 4: "calmo, caloroso e gentil, como uma pessoa querida da equipe falando no WhatsApp. Frases curtas e simples." Regra 6 nova: sem as aberturas gastas ("Oi, tudo bem?" seguido de outra pergunta, "Passando para lembrar", "Como estão as coisas?"), sem fecho genérico e sem fingir lembrança ou sentimento. As regras de travessão e de `[SILENCIO]` só mudaram de número (7 e 8), com o mesmo texto | O retorno é a mensagem que mais corre o risco de soar como cobrança. O limite de frases, perguntas, emoji, valores e as situações de `[SILENCIO]` continuam iguais | L |
| V22 | Reescrita (nó 29) | Regras 1 a 7 | Regra 8 nova: a resposta corrigida continua calma, acolhedora e em frases curtas; se o corte deixou a mensagem seca, ajusta a frase que ficou, sem acrescentar informação, promessa ou pergunta | A reescrita tirava o trecho proibido e podia deixar uma resposta fria. A regra 6 (não acrescentar informação nova) continua valendo | L |

Divergência encontrada e corrigida nesta revisão: o passo 9 do caminho da conversa (V8) pedia à Isadora uma ação que o modo `humano_comercial` impede. O sistema já não deixava a Isadora responder nesse caso, então nenhuma família recebia essa pergunta; o texto agora bate com o comportamento e com o PRD.

## 8. Versão 4.3: prompt v6.0 e treinamento v3 (29/09/2026)

Arquivos: `n8n/prompts/isadora-system.md` e `n8n/prompts/isadora-followup.md` em 4.3-rc1, `n8n/prompts/reescrever-resposta.md` em 4.3-rc1, `supabase/dados/base_conhecimento_seed.sql` (14 itens novos e 2 ajustados), `n8n/src/code/validar-resposta.js` e `parametro.validador_listas` (e-mail no convite).

A decisão de 29/09 muda o papel da Isadora: ela qualifica e agenda a reunião online inicial com a Edilaine no Google Calendar, lembra na véspera, remarca e, se a família faltar, remarca sem constranger. O Leonardo entra só depois de a Edilaine registrar a reunião como realizada. Isso substitui a decisão de 24/09 (agendamento só por humano) e os itens 2, 3, 4, 5 e 17 da seção 1, que ficam valendo só como histórico.

O prompt v6.0 é a fonte do conteúdo. A voz continua a da rc4 onde ela não contradiz o v6; quando contradiz, vale o v6, e cada caso está na tabela 8.3. O texto do v6 não foi copiado para o repositório: o prompt de produção é a adaptação dele à arquitetura que já existe (filtro de saúde antes do modelo, `[SILENCIO]`, validador, ferramentas, freio, `humano_comercial`).

Regra de LGPD desta versão: o treinamento v3 cita primeiros nomes de clientes reais nas linhas "Inspirada em", na coluna "Hoje (texto real)", nas "Boas práticas" e em "casos". Nada disso entrou em nenhum arquivo, nem nesta seção. Os depoimentos da seção 9.13 do v6 também ficaram de fora, porque dependem de autorização de uso do nome (item E da seção 3 e C-15). Os exemplos usam só nomes fictícios (Carla, Júlia, Renata, Beatriz, Fernanda). Os números da auditoria entram como números (78,4%, 128 de 161, 65 leads, 4,4%).

### 8.1 O que veio do v6

| # | Seção do v6 | Onde entrou no prompt | Observação |
| :-: | :-- | :-- | :-- |
| A1 | 1. Identidade | "Quem você é" | Escopo até o agendamento, com a lista do que ela faz e a entrada do Leonardo só depois da reunião realizada |
| A2 | 2. Fundadores | "Os fundadores" | Papéis atualizados (Edilaine faz a reunião inicial, Leonardo entra depois) e a frase "Unidos pela mesma certeza" |
| A3 | 3. Transparência | "Transparência" | Texto do v6 palavra por palavra, inclusive "com todo cuidado" (ver X1) |
| A4 | 4 a 8. Princípios, tom, como escrever, expressões, soar humana | "Como você atende", "Tom de voz", "Como escrever no WhatsApp", "Expressões", "Soar como gente" | Somados aos comportamentos da rc4 (calma, escuta, clareza, carinho com medida) e à seção "Escutar antes de responder", que o v6 não contradiz |
| A5 | 9. Base de conhecimento | "O que a Kraamzorg é" | Ficou o que é identidade e conduta. Números, contatos e depoimentos foram para a base de conhecimento; planos e valores vêm das variáveis (ver 8.2) |
| A6 | 10 a 12. O que descobrir, primeira resposta, qualificação | "Modo vendas", "Primeira resposta", "Qualificação e explicação" | Três variações de abertura da rc4 mantidas |
| A7 | 13. Valor sempre com o PDF | "Apresentação e valores" | Envio da apresentação assim que a família está qualificada, mesmo sem pedir preço; o sistema garante o PDF antes de todo "R$" |
| A8 | 14. Reunião e agendamento | "Reunião online inicial com a Edilaine" | Passo a passo com as ferramentas reais do fluxo 3 (ver 8.2) |
| A9 | 15. Objeções | "Objeções" | Com o texto do v6 onde ele difere da rc4 |
| A10 | 16. Follow-up | `isadora-followup.md` e "Vou pensar" | Cadência 1, 3 e 14 dias, cada um com motivo novo, feita pelo sistema |
| A11 | 17. Situações especiais | "Situações especiais" e "Modo cliente" | Com as ferramentas de consulta e de anotação no lugar da transferência |
| A12 | 19. Nunca | "O que você nunca faz" | Inclui horário não consultado e reunião confirmada sem evento |
| A13 | 20. Saúde | "Saúde e perda" | O texto de saúde do v6 é o `alerta_saude` que o sistema já envia; o modelo só aciona e fica em `[SILENCIO]` |
| A14 | 21. Quando o Leonardo entra | "Antes da reunião: o que fica para o Leonardo" e "Quando passar para a equipe" | Só as exceções transferem |
| A15 | 23. Despedida | "Vou pensar, retorno e despedida" | As três variações do v6 |
| A16 | 24. Exemplos | "Exemplos curtos" | Do primeiro contato até a reunião agendada, preço, retomada de valor, desconto, dia seguinte, nenhum horário, região, contrato, robô, com a anotação da ferramenta em cada um |
| A17 | 25. Pergunta final | "Antes de enviar, confira" | Itens 6 (horário e confirmação) e 7 (anotação) novos |
| A18 | 26 e 27. Prioridade e regra de ouro | "Prioridade das regras" e fecho | O item 4 ganhou "horário sempre consultado na hora" |
| A19 | Treinamento v3, simulações 1 a 10 | Base de conhecimento, 11 conversas modelo | Ver 8.5 |
| A20 | Treinamento v3, seção 8 | Casos 1 a 28 cobertos pelo texto | O teste automático dos 28 casos é do P28 |

### 8.2 O que foi adaptado à arquitetura, e por quê

| O v6 diz | O prompt faz | Por quê |
| :-- | :-- | :-- |
| Valores, parcelas, dias e horas dos planos escritos no prompt (9.10) | Tudo vem de `{{planos}}`, `{{valor.*}}`, `{{parcela.continuado}}` e `{{pagina.*}}`; os exemplos não citam dias, horas nem número de parcelas | Preço muda no CRM sem mexer no prompt, e o validador confere cada valor contra a tabela vigente |
| Contatos oficiais, bairros, "até 3 famílias por semana", números da apresentação (9.1, 9.2, 9.7, 9.12, 9.14, 9.15) | Contatos, números e evidências na `base_conhecimento`; bairros pela `verificar_cobertura` | Mesma regra do item 8: nada que mora no banco fica no texto. A janela de 28 a 36 semanas ficou, porque é regra de conduta |
| Reunião "de 30 minutos" em várias frases | A duração vem da linha "Reunião inicial" da ficha; sem ela, "reunião online curta" | A duração é o parâmetro `agenda_bloco_minutos`; se a Edilaine mudar, o texto acompanha |
| A Isadora consulta a agenda e cria o evento (14.2 a 14.6) | `consultar_horarios_edilaine` (`sugerir` e `conferir`), `agendar_reuniao`, `remarcar_reuniao`, `cancelar_reuniao`, com o `estado` devolvido guiando cada resposta | As regras de agenda valem pelo código e pelo validador (item 9 do PRD 11.11), não só pelo texto. Opção de outro dia é recusada pelo banco |
| Confirmação "Prontinho" depois do evento criado | Só com `criada` ou `remarcada`; `falhou` ou `indisponivel` vira "Vou conferir isso com a equipe e já te retorno por aqui" | Nenhuma reunião fantasma. O sistema abre a consulta à equipe |
| Nenhum horário serve: "avise a Edilaine" (14.5) | `consultar_horarios_edilaine` com `preferencia`; `sem_horario` já abre a consulta `horario_edilaine` | Aviso sem transferir e sem pausar a Isadora |
| Pede o e-mail para o convite (14.3) | E-mail só com a ficha em "aguardando e-mail", o único dado pedido | O validador libera o e-mail só nesse passo (8.6) |
| Título do evento com o nome da família (14.3) | O prompt não fala do título; o evento sai com `agenda_titulo_evento`, sem o nome | O título vira o assunto do e-mail de convite, e nome de paciente nunca vai em assunto (CLAUDE.md, C-21) |
| "Falta" como status que a Isadora atualiza (22) | A falta vem registrada pela equipe na ficha; a Isadora só oferece novo horário | Ela nunca conclui sozinha que a família faltou (C-22) |
| Status comerciais atualizados pela Isadora (22) | Fora do prompt; as ferramentas movem as etapas | Igual ao item 12 da seção 2 |
| Resumo interno para o Leonardo (21) | Montado pelo banco (`resumo_interno`); a Isadora alimenta com `atualizar_ficha` e `anotar_para_leonardo` | O resumo nunca passa pelo modelo, e nada nele vai à família |
| Desconto, parcelamento e contrato antes da reunião: "anote no resumo" (13, 15, 21) | `anotar_para_leonardo` obrigatório sempre que ela disser que o Leonardo trata depois | Item 10 do PRD 11.11; sem anotação, a promessa fica vazia |
| Área não confirmada e dúvida fora da base: "consulte a equipe sem transferir" (17, 21) | `consultar_equipe` com `area` ou `duvida` | A consulta não pausa, não muda o modo e a resposta volta pela Isadora |
| PDF não abriu: "avise a equipe" (13) | `consultar_equipe` com `duvida` | Antes era transferência com `outro`; agora a conversa continua com ela |
| Mensagem de saúde escrita pela Isadora (20) | Sistema envia o texto aprovado (o mesmo do v6) e o modelo responde `[SILENCIO]` | Filtro de saúde antes do modelo (PRD 11.11 e 19.4) |
| Bebê nascido, cliente, pedido de pessoa, insatisfação, médico: transferir (21) | `transferir_para_equipe` com `bebe_nasceu`, `pos_venda_operacao`, `outro`, `pediu_humano`, `reclamacao`, `parceiro_medico` | Contrato ou pagamento de quem já é cliente vai como `outro`, porque `condicao_comercial` e `contratar` saíram da ferramenta (PRD 11.9) |
| Negrito para horário (6) | Um negrito só na confirmação; as duas opções sem negrito | O validador deixa um negrito por mensagem; o treinamento pôs as duas opções em negrito |
| Follow-up com valor manda o PDF de novo (16) | O follow-up não cita valor | O prompt de follow-up não recebe a tabela de planos; valor fica para a resposta, com o PDF |
| Regras de follow-up e janela de mensagens (31) | Janela, uma mensagem por dia e cadência no banco (`agente_janela_envio`, `agente_cadencia_dias`) | Já garantidos pelo sistema |

### 8.3 Conflitos entre o v6 e a voz da rc4, e o que prevaleceu

Em todos, vale o v6, como pedido. A coluna "Rc4" mostra o que a revisão de voz tinha feito.

| # | Assunto | Rc4 | V6 (o que ficou) |
| :-: | :-- | :-- | :-- |
| X1 | Transparência | Tirou "com todo cuidado" (V2) | Volta "com todo cuidado" e "falar diretamente com a equipe" |
| X2 | Expressões | Tirou "Imagino o quanto esse momento é especial para vocês.", "Entendo perfeitamente." e "Faz todo sentido." (V6) | As três voltam para a lista. A orientação da rc4 fica como regra de uso: uma vez, quando for verdade, nunca como abertura de toda resposta |
| X3 | Aberturas de robô | "Perfeito!" era abertura de robô (V7) | Sai da lista, porque o v6 usa "Perfeito, esse horário está livre!" |
| X4 | Objeções "Vou falar com meu marido" e "Está caro" | Sem "faz todo sentido" (V12 e V13) | "Claro, faz todo sentido decidirem juntos!" e "Entendo, é um valor importante" voltam; a informação útil da rc4 (os formatos mudam em dias e horas) fica |
| X5 | Novas expressões do v6 | Não existiam | Entram "Fico muito feliz em te explicar como funciona.", "A Edilaine vai adorar conversar com vocês.", "Se fizer sentido para vocês, eu olho a agenda dela agora.", "Fico feliz que tenha gostado." e "Um abraço e uma ótima sequência de gestação! 🤍" |
| X6 | Emoji | Nunca em saúde, perda, reclamação ou valores | Acrescenta "preocupação" |
| X7 | Follow-up, `[SILENCIO]` | Silêncio quando a família disse que ia responder depois | Silêncio só quando ela pediu para ser chamada numa data que ainda não chegou; um "te chamo" sem data não para a cadência (simulação 5) |
| X8 | Follow-up, aberturas gastas | "Passando para lembrar" era abertura gasta (V21) | Sai da lista, porque o lembrete do v6 começa assim |
| X9 | Exceção de uma pergunta por vez no fechamento | Existia (v4.2) | Sai: a Isadora não fecha mais venda antes da reunião |

### 8.4 Divergências de dados e de regra encontradas

1. Valores: os cinco valores à vista do v6 batem com `pacote_versao` no `supabase/seed.sql` (Essencial R$ 4.200, Imersão R$ 7.800, Continuado R$ 8.100, Gemelar Essencial R$ 5.400, Gemelar Continuado R$ 10.300). As parcelas de 3x também batem, menos uma: o v6 diz "3x de R$ 3.433" no Gemelar Continuado, e o sistema calcula R$ 3.433,33 (10.300 dividido por 3). Se a Isadora escrever "R$ 3.433", o validador reprova, porque 3 vezes R$ 3.433 dá R$ 10.299. Decidir se a apresentação e o seed passam a dizer R$ 3.433,33, ou se a primeira parcela fica maior (como a `api` da sessão de venda já faz).
2. Selos: o v6 diz que o Imersão é "o mais escolhido" e o Gemelar Continuado é "recomendado", e a simulação 9 também. O seed deixa `destaque` nulo nos cinco planos até alguém confirmar no PDF (PRD 3.2). O prompt só cita selo quando o bloco de planos trouxer; basta preencher `destaque` para a Isadora usar.
3. Duração da reunião: o v6 e o PRD dizem 30 minutos. Ainda dizem "uns 15 minutos" e "me passa dois dias e horários" os textos de `mensagem_modelo` `followup_d3` e `regua_28_34` no `supabase/seed.sql` e o exemplo da regra 1 da família em `docs/design/voz.md`. O `followup_d3` é o ponto de partida do segundo retorno da cadência, então precisa ir para o texto do PRD 23.2 antes do P28.
4. Nota fiscal: o v6 (19.1) manda não confirmar tipo de documento fiscal, e o caso 22 do treinamento espera a resposta padrão ("descreve o serviço como cuidado domiciliar pós-parto"). Mantida a resposta padrão (C-16); o resto vira consulta à equipe.
5. Pix: o v6 só fala em 3x sem juros no cartão. A rc4 deixava a Isadora confirmar Pix ou cartão sozinha. Agora qualquer pergunta de pagamento além do parcelamento do bloco de planos vira anotação para o Leonardo.
6. Número do WhatsApp: o v6 põe o número na identidade. Fica fora do prompt, como no item 15.
7. Pedido de falar com a equipe: o v6 manda convidar para a reunião na 14.1 e transferir na 21. Padrão adotado: pedir a Edilaine ou para marcar segue a agenda; pedir uma pessoa, o Leonardo ou um atendente transfere (`pediu_humano`) (C-27).

### 8.5 Base de conhecimento

Entram 14 itens, todos em rascunho, para você e a Edilaine aprovarem pela tela da base antes de a Isadora ler:
- três de agenda: como funciona a reunião online inicial com a Edilaine, como a Isadora marca, lembra e remarca, e o que acontece depois da reunião;
- onze conversas modelo das simulações 1 a 10 do treinamento v3, com a simulação 1 em duas partes.

As conversas modelo entram sem as linhas "Inspirada em", sem a seção 4 ("Hoje (texto real)") e sem as "Boas práticas" que citam clientes. Os valores em reais saíram (a nota diz que eles vêm da ficha), e saiu também a "Correção importante" da simulação 9, que repetia um valor antigo tirado de conversa real. A simulação 11 (sinal de alerta e robô) ficou de fora: a mensagem de saúde é texto aprovado enviado pelo sistema, e a Isadora não deve aprender a escrevê-la pela base. Os dias e horários das conversas são ilustração, e o validador barra qualquer horário que a ferramenta não tenha devolvido.

Dois itens antigos mudaram uma frase para a regra nova: "Posso parcelar o pagamento?" e a objeção sobre o contrato passam a dizer que o Leonardo trata as condições e o contrato depois da reunião com a Edilaine.

A tabela da base não tem um tipo "conversa modelo"; os itens entram como perguntas frequentes, com o título começando por "Conversa modelo:".

### 8.6 E-mail no convite

O validador (nó 28) passa a aceitar o pedido de e-mail só quando a ficha está em "aguardando e-mail", isto é, depois de o horário escolhido ser conferido e estar livre. A lista do que pode ser pedido nesse passo mora em `parametro.validador_listas` (`pedido_dado_convite`, hoje "e-mail" e "email"). CPF, RG, endereço, CEP, data de nascimento e documento continuam barrados nesse passo e em qualquer outro, e o teste `n8n/validar-email-convite.test.mjs` prova isso. Sem a lista ou sem o estado, o e-mail continua barrado.

### 8.7 Reescrita (nó 29)

A regra 2 passa a dizer que as condições o Leonardo apresenta depois da reunião e que ficou anotado. A regra 3 deixa o pedido de e-mail do convite em paz quando ele não foi apontado como erro. A regra 9 nova tira horário não consultado ou confirmação sem evento, nunca troca por outro horário e, sem saída, devolve a mensagem de segurança. O formato da resposta não mudou.

### 8.8 O que precisa de decisão

Leonardo:
- L-1. Aprovar o texto da 4.3-rc1 do prompt, do follow-up e da reescrita, e os conflitos X1 a X9 (o v6 prevaleceu em todos).
- L-2. Parcela do Gemelar Continuado: R$ 3.433 ou R$ 3.433,33 (8.4, item 1).
- L-3. Selos "mais escolhido" e "recomendado": confirmar no PDF para preencher `destaque` (8.4, item 2).
- L-4. Pagamento no Pix sem desconto: a Isadora pode confirmar que existe, ou tudo fica para depois da reunião? Padrão: fica para depois (8.4, item 5).
- L-5. Família com 20 a 27 semanas que quer reservar já: padrão é convidar para a reunião e anotar, sem transferir (C-06).
- L-6. Objeções ditas pela família também vão para a anotação do resumo, com as palavras dela. Confirmar se quer esse nível de detalhe.
- L-7. Família que não quer passar o e-mail: padrão é não insistir e abrir consulta à equipe para combinar outro jeito.
- L-8. Contrato ou pagamento de quem já é cliente: transferência com o motivo "outro" para o comercial.
- L-9. Visita no fim da tarde e perguntas de reembolso além da resposta padrão: consulta à equipe, sem transferir.
- L-10. Pedido de falar com a equipe (C-27) e insistência em falar com você antes da reunião: `pediu_humano`.
- L-11. Cadência de 1, 3 e 14 dias contada da última mensagem da família e "te chamo" sem data não parando a cadência (C-28, X7).
- L-12. As 11 conversas modelo e os 3 itens de agenda da base de conhecimento.

Edilaine:
- E-1. O texto da reunião online inicial (o que ela explica, quem participa) e os três itens de agenda da base.
- E-2. A mensagem depois de uma falta ("Imagino que tenha surgido algum imprevisto, acontece. Quer que eu veja um novo horário com a Edilaine?").
- E-3. As conversas modelo que descrevem cuidado (simulações 1, 5 e 9).
- E-4. Saída da simulação 11 da base: confirmar que a resposta de saúde continua sendo só o texto aprovado enviado pelo sistema.

Leonardo e Edilaine juntos: C-21 (título do evento sem o nome da família) e C-22 (a falta registrada pela equipe no CRM).

## Aprovação

| Quem | Itens | Data | Observações |
| :-- | :-- | :-- | :-- |
| Leonardo | 1 a 17, A a F, K, L (decisão conjunta com Edilaine), seção 5, seção 7 (V1 a V22), [v4.3] seção 8 (A1 a A20, X1 a X9, L-1 a L-12, C-21 e C-22 com a Edilaine) | | |
| Edilaine | G, H, I, J, L (decisão conjunta com Leonardo), 13 (partes marcadas [confirmar]), 18, seção 7 (texto sobre amamentação em V10 e V18), [v4.3] seção 8 (E-1 a E-4, C-21 e C-22 com o Leonardo) | | |
