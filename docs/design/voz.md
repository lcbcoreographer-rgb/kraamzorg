# Voz e microcopy · Kraamzorg OS

Como o Kraamzorg OS escreve para três públicos: a família, a enfermeira no plantão e a equipe de comercial, coordenação e diretoria. Complementa o `DESIGN.md` (seção 7, regras curtas, e seção 11, acolhimento) e segue o PRD 20.3 (tom da interface) e o PRD 11.6 (persona e tom da Isadora). Se este arquivo e o PRD divergirem, vale o PRD.

Onde cada texto mora:

| Texto                                                                | Onde fica                                                                                                        | Quem aprova                               |
| :------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| Mensagem para a família (WhatsApp, texto sugerido de tarefa, e-mail) | `mensagem_modelo`, com status `rascunho` até aprovação                                                           | Leonardo (comercial) e Edilaine (clínico) |
| Fala da Isadora e dos classificadores                                | `n8n/prompts/`                                                                                                   | Leonardo, e Edilaine no que for clínico   |
| Trecho clínico de evolução e conduta de alerta                       | `mensagem_modelo` (destinatário `medico`) e `regra_alerta`                                                       | Edilaine                                  |
| Microcopy da interface (rótulo, botão, estado, erro)                 | No componente ou no arquivo de textos do módulo, como `src/app/(auth)/mensagens.ts`                              | Revisão de código, contra este arquivo    |
| Preço, prazo, duração, limite, lista de termos                       | `parametro`, `pacote_versao`, `termo_alerta`, `regua_faixa`, `condicao_comercial`; o texto recebe o valor pronto | Diretoria                                 |

Toda frase deste arquivo passou pelo verificador da skill anti-ai-slop. Os exemplos de "antes" estão entre aspas de propósito: são o que a tela mostra hoje.

---

## 1. Como a Kraamzorg fala

Calma, clara, segura e acolhedora (PRD 20.3). O modelo é a enfermeira mais experiente da equipe falando com alguém que ela respeita: sabe o que está fazendo, chama pelo nome, diz o que vem depois e não gasta palavra. A voz é a mesma em toda superfície; o tom muda com quem lê e com o momento. Com a família, mais devagar e com mais explicação. Com a enfermeira no plantão, curto e clínico. Com o comercial e a coordenação, direto e operacional.

Palavras que a marca usa (PRD 11.6): segurança, presença, cuidado estruturado, orientação clara, rotina, tranquilidade, discrição, protocolo, rede médica, sinais de alerta.

Palavras que a marca evita (PRD 11.6 e CLAUDE.md): mãezinha, mamãe, papai, amiga, princesa, empoderamento, transformação, milagre, vibe, energia, cura, método infalível, garantimos, última vaga, imperdível.

## 2. Regras para todo texto

1. Frase completa, voz ativa, sujeito claro. "A Isadora volta em 30/09 às 11:49." no lugar de "Retorno previsto: 30/09 11:49".
2. A primeira frase diz o fato. O contexto vem depois, e só se muda o que a pessoa vai fazer.
3. Nome da pessoa sempre que ela existe: "Mensagem para Marina", "Otávio assumiu às 14:05", "Ligar para Talita Moreno".
4. Todo estado termina no próximo passo e em quem faz.
5. Número exato, com unidade e formato brasileiro: R$ 4.200, 24/09/2026, 11:42, 38s2d, 36,9 °C, 3.240 g, D4 de 6.
6. Botão diz o que acontece, com verbo e objeto: "Assinar registro do D4", "Assumir conversa", "Ligar para a supervisão". Confirmação nomeia a ação nos dois botões ("Assinar agora" e "Revisar"), nunca "OK", "Sim", "Enviar".
7. Sem travessão e sem meia-risca. Vírgula, ponto, dois-pontos ou parênteses resolvem.
8. Sem exclamação na interface. Nos textos para a família, só como nos textos aprovados.
9. Sem as fórmulas de texto de máquina: contraste do tipo "não é X, é Y", pergunta retórica seguida da resposta, dois-pontos de revelação ("E o melhor:"), trio de adjetivos, frase de efeito, fecho com moral.
10. Palavra de sistema fica no código: nome de variável, chave de mensagem, número de seção do PRD, "nominal", "handoff", "SLA", "ingestão", "reindexar".
11. Nada inventado. Duração, prazo e valor vêm de `parametro`; texto para a família vem de `mensagem_modelo`; nenhum depoimento, número de resultado ou promessa sem fonte.
12. Maiúscula só no começo da frase e em nome próprio. Nada em caixa alta.

## 3. Família

**Quem lê.** A gestante, quem vai estar com ela nos primeiros dias (parceiro ou parceira, a mãe dela, outra pessoa da família) e, depois do parto, a puérpera. Lê no celular, entre o trabalho e o cansaço do terceiro trimestre, ou já em casa, dormindo pouco. Às vezes lê depois de uma notícia difícil.

**Onde lê.** WhatsApp (Isadora, textos sugeridos que a equipe envia, respostas automáticas aprovadas), formulário público (contrato, captação, pesquisa), e-mail de terceiros (Autentique, meio de pagamento) e, na fase 3, o portal da família.

Regras:

1. "Você" para ela. "Vocês" quando a decisão é da família ("conversar com vocês uns 15 minutos"). Para quem acompanha, "quem vai estar com você nesses dias", sem supor pai, marido ou casal.
2. O bebê pelo nome quando ele existe no cadastro; antes, "o bebê". Nunca "bebezinho", "pequeno", "príncipe", "princesa".
3. Explique por que um dado é pedido, em uma linha, e onde ele fica. Diga quanto tempo a tarefa leva, com o valor vindo de `parametro`.
4. Uma pergunta por mensagem e por tela. Duas mensagens curtas quando houver muito a explicar (PRD 11.6).
5. Nenhuma pressão: sem prazo inventado, sem escassez, sem "garantimos". Quando houver uma janela real (reservar entre 28 e 36 semanas), diga a janela e o motivo.
6. Emoji só nos textos aprovados, no máximo um, e nunca em saúde, perda, reclamação ou valores (PRD 11.6 e 23).
7. Saúde: a interface e a Isadora nunca tranquilizam sobre um sintoma. O texto é o aprovado (`alerta_saude`, `alerta_emocional`, `audio_nao_transcrito`), com o caminho de urgência e o número do SAMU.
8. Luto: poucas palavras, nenhum conselho, nenhuma explicação, nenhuma referência religiosa. O texto aprovado `perda` é o modelo: "Sinto muito, de coração. Se em algum momento precisar da gente, estamos aqui."

**Como deve soar o formulário público** (a construir no P30; os textos entram em `mensagem_modelo` e vão para aprovação):

| Momento        | Rascunho                                                                                                              |
| :------------- | :-------------------------------------------------------------------------------------------------------------------- |
| Abertura       | "Oi, Marina. O Leonardo pediu estes dados para preparar o contrato de vocês. Leva uns 3 minutos."                     |
| Ajuda de campo | CPF: "Vai no contrato. Fica guardado com a equipe da Kraamzorg e não aparece em mensagem." [confirmar: jurídico]      |
| Campo opcional | "Telefone de quem vai estar com você (opcional)"                                                                      |
| Erro           | "Esse CPF tem 10 números. Confira se faltou algum."                                                                   |
| Sem sinal      | "A conexão caiu. O que você já preencheu continua aqui; quando voltar, toque em Enviar de novo."                      |
| Fim            | "Recebemos. O contrato chega no seu e-mail pela Autentique, a plataforma de assinatura. É só abrir e assinar por lá." |
| Link vencido   | "Este link já foi usado ou venceu. Peça um novo ao Leonardo pelo WhatsApp."                                           |

**Antes e depois**, nos textos para a família que aparecem hoje nas telas (fixtures de `src/modules/configuracoes/dados/fixtures.ts`, espelho do PRD 23). São propostas para a próxima rodada de aprovação de `mensagem_modelo`; nenhum texto muda no código.

| Chave                | Antes                                                                                  | Depois                                                                                                                                                  | Por quê                                                                                                          |
| :------------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------- |
| `regua_28_34`        | "Você está entrando na janela ideal para reservar o pós-parto, entre 28 e 36 semanas." | "É entre 28 e 36 semanas que as famílias costumam organizar o pós-parto com a gente."                                                                   | "Janela ideal para reservar" soa como anúncio e empurra. A informação continua, sem pressão.                     |
| `regua_nasceu`       | "Parabéns pela chegada do bebê! 👶 Como vocês estão, já em casa com o bebê?"           | "Parabéns pela chegada do bebê 🤍 Como vocês estão? Quando souberem a previsão de alta, me contam que eu vejo com a equipe o começo do acompanhamento." | "Bebê" duas vezes; a pergunta supõe que já estão em casa (o bebê pode estar internado); faltava o próximo passo. |
| `promotor_indicacao` | "Vai ser um carinho enorme cuidar de mais uma família que chega por você."             | "Se alguém que você conhece estiver esperando bebê, pode passar o nosso contato. A gente conversa com calma, do mesmo jeito que conversou com vocês."   | "Carinho enorme" é entusiasmo que a marca evita. A versão nova diz o que acontece com quem for indicado.         |

Referência do tom certo, na conversa de demonstração: "Oi, Marina! Que alegria saber que você está esperando bebê 🤍 Me conta, de quantas semanas você está?" Comemora a gestação (PRD 11.8), faz uma pergunta só e chama pelo nome.

## 4. Enfermeira no plantão

**Quem lê.** Enfermeira obstétrica ou neonatal na casa da família, de pé, muitas vezes com o bebê no colo ou ajudando na pega, uma mão livre, sinal que cai. Conhece o protocolo melhor que o sistema.

Regras:

1. Curto, clínico, no imperativo gentil: "Confira", "Ligue", "Registre". Vocabulário do glossário é bem-vindo: PU-01, EVN, LATCH, zona de Kramer, diurese.
2. Número com unidade e o valor anterior como referência, nunca como preenchimento: "No D3 foi 36,9 °C."
3. A frase mais importante do portal é a que diz que nada se perdeu: "Salvo no aparelho", "Sem sinal agora. O registro está salvo no aparelho e sobe sozinho quando a conexão voltar."
4. Alerta clínico: código, achado com valor, conduta aprovada. Sem exclamação, sem caixa alta, sem adjetivo.
5. Erro de digitação trata a enfermeira como a profissional que ela é: "8 bpm parece um dígito a menos. Confira e digite de novo."
6. Assinatura diz a consequência antes: "Assinar o registro do D4? Depois de assinado, correção só por adendo."
7. Nenhum elogio automático. A visita fecha com o fato e a próxima visita.

**Antes e depois** (telas reais do portal):

| Tela                                                 | Antes                                                                                                                                                                | Depois                                                                                                                                       |
| :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| Hoje, tela sem módulo (`(enfermeira)/hoje/page.tsx`) | "As visitas de hoje vão aparecer aqui. A próxima visita com o endereço e a régua de dias, o botão para iniciar a visita e as fichas pendentes, em ordem de horário." | "Esta parte ainda está em construção. Aqui você vai ver as visitas do dia, com endereço e horário, e as fichas que faltam assinar."          |
| Hoje, sem visita (quando o módulo existir)           | (não existe ainda)                                                                                                                                                   | "Nenhuma visita marcada para hoje. Quando a coordenação oferecer uma família, a oferta aparece aqui para você aceitar ou recusar."           |
| Perfil (`(enfermeira)/perfil/page.tsx`)              | "A sua semana vai aparecer aqui. O estado de hoje, a semana em turnos, as ofertas de família para aceitar ou recusar e os documentos com a validade."                | "Esta parte ainda está em construção. Aqui você vai ver a sua semana, as ofertas de família e a validade dos seus documentos."               |
| Alertas (`(enfermeira)/alertas/page.tsx`)            | "Os alertas abertos vão aparecer aqui"                                                                                                                               | "Nenhum alerta aberto. Quando um valor do checklist passar do limite, o alerta aparece aqui e na tela da visita."                            |
| Vitrine de campos (`design-system/vitrine.tsx`)      | "78 bpm" com o erro "Acima da faixa esperada para a puérpera."                                                                                                       | Um valor que de fato dispara a regra, ou outro exemplo de erro. 78 bpm é normal, e a enfermeira que vê a vitrine perde a confiança no aviso. |

## 5. Comercial, coordenação e diretoria

**Quem lê.** O comercial responde entre consultas e reuniões, pelo celular, às vezes à noite. A coordenação clínica recebe alerta a qualquer hora e cuida das famílias em momento difícil. A diretoria olha números e decide.

Regras:

1. Direto e operacional: prazo em frase ("vence em 38 min"), quem faz ("Com a coordenação clínica"), o que falta.
2. A família pelo nome em toda linha. "Lead" só em número agregado ("6 leads nos últimos 30 dias"), nunca ao lado do nome de uma pessoa.
3. Palavras de venda (frio, morno, quente, ganho) só nas telas comerciais e nunca perto de uma família em estado sensível.
4. Texto de ajuda explica o efeito para quem usa, sem citar documento interno.
5. Número de painel em frase, com comparação e, abaixo do limiar de amostra guardado em `parametro`, com a contagem antes da porcentagem.
6. Momento sensível tem gramática própria (seção 6).

**Antes e depois** (telas reais):

| Tela e arquivo                                                                                                     | Antes                                                                                                                                                                                           | Depois                                                                                                                                                                                                                          |
| :----------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fila, cartão de perda (`agente/transferencias/componentes/cartao-transferencia.tsx`; texto do resumo vem do banco) | "Perda gestacional · venceu há 31 min", "Família Teste Bruma · É da coordenação clínica", "Relato de perda gestacional. Freio em bloqueio total. Contato humano e nominal."                     | "Perda gestacional · recebida às 13:18", "Família Teste Bruma, com a coordenação clínica", "A família contou que perdeu o bebê. Nenhuma mensagem automática sai mais para ela. A coordenação clínica faz o contato, pelo nome." |
| Destino da transferência (`agente/tipos.ts`)                                                                       | "É da coordenação clínica", "É do comercial", "É da operação"                                                                                                                                   | "Com a coordenação clínica", "Com o comercial", "Com a operação"                                                                                                                                                                |
| Conversa de família com freio (`conversa-detalhe/componentes/painel-resumo.tsx`)                                   | "A Isadora está conduzindo esta conversa. Se você assumir, ela fica pausada aqui até a pausa vencer ou até você devolver."                                                                      | "A Isadora está desligada para esta família. Só a equipe responde, pelo nome."                                                                                                                                                  |
| Rótulo da resposta automática (`conversa-detalhe/componentes/fio-mensagens.tsx`)                                   | "Texto aprovado, enviado pelo sistema"                                                                                                                                                          | "Resposta automática, texto aprovado"                                                                                                                                                                                           |
| Cabeçalho da família (`components/ui/cabecalho-familia.tsx`)                                                       | "Nascimento: ainda não, vira fato quando acontecer" (e o mesmo para alta e início)                                                                                                              | "Nascimento: ainda não", com uma legenda só abaixo das quatro datas: "A DPP é estimativa. Nascimento, alta e início entram quando acontecem." Com o freio depois de uma perda: "Nascimento: sem registro", sem legenda.         |
| Início do comercial (`(app)/inicio/page.tsx`)                                                                      | Título "Início"; abaixo, em cinza pequeno, "Terça, 29/09. Três transferências abertas e quatro tarefas com prazo hoje."                                                                         | Título "Terça, 29/09"; abaixo, em marinho, "Três transferências esperam alguém da equipe e quatro tarefas vencem hoje."                                                                                                         |
| Tarefas (`(app)/inicio/page.tsx` e `mensageria/tarefas/agrupar.ts`)                                                | "Tarefas de hoje" e, logo abaixo, "Vencem hoje · 4 tarefas"                                                                                                                                     | "Tarefas de hoje · 4"                                                                                                                                                                                                           |
| Conversas, ação secundária (`agente/conversas/componentes/cartao-conversa.tsx`)                                    | "Marcar como não lead", visível em todo cartão                                                                                                                                                  | "Marcar como outro assunto", dentro do menu "Mais ações" [confirmar: Leonardo]                                                                                                                                                  |
| Transferência sensível, ação (`cartao-transferencia.tsx`)                                                          | "Marcar como resolvida"                                                                                                                                                                         | "Registrar o contato com a família" [confirmar: Leonardo e Edilaine]                                                                                                                                                            |
| Termos de alerta (`configuracoes/componentes/secao-termos-alerta.tsx`)                                             | "Quando a família escrever um destes termos para a Isadora, o sistema aplica a ação na hora, antes de qualquer outra decisão do agente (PRD 11.2)." e a coluna "Mensagem enviada: alerta_saude" | "Quando uma família escreve um destes termos, o sistema age na hora, antes de a Isadora responder." e a coluna "Texto que a família recebe: Orientação de saúde", com a prévia do texto aprovado                                |
| Base de conhecimento (`agente/base-conhecimento/componentes/painel-base-conhecimento.tsx`, `botao-reindexar.tsx`)  | "Última ingestão em 27/09/2026, 15:49, 2 itens." e o botão "Reindexar"                                                                                                                          | "A Isadora leu a base pela última vez em 27/09/2026, 15:49, com 2 itens aprovados." e o botão "Atualizar o que a Isadora sabe"                                                                                                  |
| Números do mês (`agente/metricas/componentes/painel-metricas.tsx`)                                                 | "Conversão de leads 50%", "Meta: 7% ou mais"                                                                                                                                                    | "3 de 6 leads fecharam contrato (50%). Meta: 7% ou mais. Amostra pequena: um contrato a mais ou a menos muda muito a porcentagem."                                                                                              |
| Números do mês                                                                                                     | "Conversas com a Edilaine registradas 0%", "Meta: 100%, com data"                                                                                                                               | "Nenhuma conversa com a Edilaine registrada nos últimos 30 dias. Meta: todas, com data."                                                                                                                                        |
| Reenvio que falhou (`cartao-transferencia.tsx`)                                                                    | Título "Não deu certo"                                                                                                                                                                          | Título "O aviso não foi reenviado", com o motivo abaixo                                                                                                                                                                         |
| Pipeline, cartão (`crm/pipeline/componentes/cartao-oportunidade.tsx`)                                              | "Hoje neste estágio"                                                                                                                                                                            | "Neste estágio desde hoje"                                                                                                                                                                                                      |
| Pipeline, estágio e folha (`crm/pipeline/estagios.ts`, `folha-perda.tsx`)                                          | "Perdido", "Marcar como perdido", "Motivo da perda"                                                                                                                                             | "Não seguiu", "Encerrar: não seguiu com a Kraamzorg", "Por que não seguiu" [confirmar: Leonardo; o enum `perdido` continua]                                                                                                     |
| Início da coordenação, tela sem módulo (`(app)/inicio/page.tsx`)                                                   | "O que pede decisão vai aparecer aqui. Alertas clínicos abertos, transferências de saúde, fichas pendentes, ofertas sem resposta e a síntese da equipe."                                        | "Esta parte ainda está em construção. Aqui você vai ver primeiro o que pede a sua decisão: alertas clínicos abertos, fichas sem assinatura e ofertas sem resposta."                                                             |

O que já está bom e serve de modelo:

- "Freio em bloqueio total desde 23/09/2026, 01:15. Só contato humano e pelo nome." (`crm/ficha/componentes/cabecalho-ficha.tsx`)
- "Justificar depois é normal; o que importava era parar as mensagens automáticas." (`faixa-justificar-freio.tsx`)
- "Edite à vontade. O WhatsApp abre com este texto; nada sai antes de você tocar em enviar lá." (`cartao-tarefa.tsx`)
- "A equipe pode não ter visto esta transferência." com "Reenviar aviso" (`cartao-transferencia.tsx`)
- "E-mail ou senha não conferem. Confira e tente de novo." (`(auth)/mensagens.ts`)

## 6. Momentos sensíveis

Vale para as três audiências. A regra visual está no `DESIGN.md`, seção 11.8.

| Momento                               | Na interface da equipe                                                                                                                                   | Evite                                                                                  |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| Perda gestacional ou neonatal         | "Perda gestacional · recebida às 13:18". "A família contou que perdeu o bebê. Nenhuma mensagem automática sai mais para ela." Ação: "Ligar para Camila". | "venceu há", "óbito" fora do registro clínico, "insucesso", "caso", "lead", "resolver" |
| Família enlutada que volta a escrever | "Camila escreveu. A família está em estado sensível: responda você, pelo nome."                                                                          | Texto sugerido, atalho de modelo, "Isadora conduzindo"                                 |
| Intercorrência ou internação          | "Intercorrência: o bebê está internado desde 22/09. Quem acompanha: Beatriz Falcão."                                                                     | "problema", "complicação" sem nome, prazo em vermelho                                  |
| Alerta clínico imediato               | "PU-01 · Febre de 38,2 °C na puérpera. Acione a supervisão médica agora e oriente a família a procurar atendimento de emergência."                       | Exclamação, caixa alta, "URGENTE", adjetivo                                            |
| Saúde mental materna                  | Na lista: "Ocorrência privada". Na tela de quem atende: a conduta aprovada, sem paráfrase.                                                               | Detalhe na lista, prévia da conversa, termo diagnóstico escolhido pela interface       |
| Nota baixa na pesquisa                | "Ocorrência privada da coordenação. Contato pessoal, sem mensagem automática."                                                                           | "Detrator" em tela que não seja de número agregado                                     |

Regras:

1. Diga o que aconteceu com as palavras mais simples que forem verdadeiras. "Perdeu o bebê" é mais respeitoso que um eufemismo.
2. Uma ação, nomeando a pessoa.
3. Diga o que o sistema já fez por ela ("Nenhuma mensagem automática sai para esta família"), porque é isso que tranquiliza quem vai ligar.
4. Nunca uma frase de consolo escrita pela interface para a equipe ler. O consolo à família é da pessoa que liga e do texto aprovado `perda`.

## 7. Glossário: use e evite

| Use                                                              | Evite                                                                       | Por quê                                                                     |
| :--------------------------------------------------------------- | :-------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| transferência                                                    | handoff                                                                     | "handoff" é nome de tabela.                                                 |
| prazo                                                            | SLA                                                                         | Sigla de contrato de serviço.                                               |
| pelo nome                                                        | nominal                                                                     | Palavra de protocolo; a interface já usa "pelo nome" no cabeçalho da ficha. |
| estimativa, fato (só como marca das quatro datas)                | "vira fato quando acontecer"                                                | Linguagem de modelo de dados.                                               |
| outro assunto [confirmar: Leonardo]                              | não lead                                                                    | Classifica uma pessoa pelo que ela não é para a venda.                      |
| não seguiu [confirmar: Leonardo]                                 | perdido, perda (no pipeline)                                                | "Perda" já nomeia a perda gestacional no mesmo sistema.                     |
| família, gestante, puérpera, bebê, recém-nascido                 | mãezinha, mamãe, papai, paciente (para a família), cliente (para a família) | PRD 20.3 e glossário do PRODUCT.md.                                         |
| quem vai estar com você nesses dias                              | o pai, seu marido                                                           | Não supõe a família.                                                        |
| Isadora; para a família, "assistente virtual" quando perguntarem | robô, bot                                                                   | PRD 11.6.                                                                   |
| atualizar o que a Isadora sabe                                   | reindexar, ingestão                                                         | Nome da operação técnica.                                                   |
| resposta automática                                              | mensagem do sistema, disparo                                                | "Disparo" é vocabulário de marketing em massa.                              |
| acompanhamento, visita, D4 de 6                                  | serviço, sessão (para a visita)                                             | "Sessão" é a conversa de venda.                                             |

## 8. Marcas de texto de máquina neste produto

Padrões que já apareceram nas telas ou que o modelo tende a escrever aqui:

- Estado vazio que descreve a tela ("a régua de dias, o botão para iniciar a visita").
- "vai aparecer aqui" como título de toda tela sem conteúdo.
- "Não deu certo", "Algo não saiu como esperado", "Erro" sozinhos.
- "com sucesso" ("Salvo com sucesso"). Troque pelo fato: "Salvo às 15:20 por Otávio Lemos."
- Título que repete a aba.
- Rótulo pequeno acima do título ("Institucional", "Objeção" em cima do título do item da base de conhecimento): o tipo cabe como selo ao lado.
- "Que alegria", "Parabéns", "Ótimo trabalho" ditos pela interface.
- Rabo de gerúndio: "Registro salvo, garantindo a segurança dos dados."
- "De forma rápida e segura", "prático e simples": par de adjetivos que não diz nada.
- Emoji e "Olá!" em tela de equipe.

## 9. Como revisar antes do commit

1. Leia em voz alta, no ritmo de quem está cansada. Se soar como locutor, reescreva.
2. Confira três coisas em cada texto: tem o nome, tem o tempo da família, tem o próximo passo.
3. Rode o verificador da skill anti-ai-slop (`checar_slop.py`) no arquivo de textos alterado. Negrito e título de documento podem ser ignorados; o resto se corrige.
4. Texto para a família vai para `mensagem_modelo` como rascunho e só sai depois da aprovação do Leonardo ou da Edilaine.
5. Veja o texto na tela de 390 px: rótulo de botão em uma linha, frase de estado em até três linhas no cartão.
