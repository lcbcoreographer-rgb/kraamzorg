# Product

<!-- impeccable:product-schema 1 -->

Contexto de produto do Kraamzorg OS para quem desenha e constrói telas. Fonte: PRD v4.1 (capítulos 3, 7, 8, 9, 11.4, 12, 13, 15, 20, 22.3, 23), CLAUDE.md, notas da reunião de 24/09/2026, checklist diário real (DOC 2) e Apresentação Institucional 2026. Não houve rodada de perguntas com o cliente nesta sessão: tudo o que está marcado "[inferido]" saiu dessas fontes e precisa de confirmação.

## Platform

web (PWA instalável, mobile primeiro, D-02). Um só sistema para celular e computador; no celular ele se comporta como app instalado, com cache offline para o portal da enfermeira.

## Stack

Definida no PRD 5.1: Next.js com Tailwind v4, tokens em `src/app/globals.css` (`@theme`), Supabase, IndexedDB via Dexie para o offline. O protótipo desta pasta é HTML e CSS estáticos que espelham esses tokens, para validação visual antes do código.

## Users

| Papel                    | Quem (nomes do produto real ficam fora do protótipo)                  | Situação real                                                                                                                                                           | Trabalho principal                                                                                                                                |
| :----------------------- | :-------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enfermeira               | 5 enfermeiras obstétricas e neonatais, MEI ou PJ                      | Na casa da família, de pé, muitas vezes com o bebê no colo ou ajudando na pega. Uma mão livre, celular, sinal instável. Até 2 visitas por dia, sempre no mesmo período. | Registrar a visita (DOC 2), perceber e acionar alerta clínico, assinar, ver a agenda de amanhã, aceitar ou recusar ofertas de família.            |
| Coordenação clínica      | Enfermeira coordenadora (sócia)                                       | Em movimento, pelo celular; às vezes no computador para revisar evoluções. Recebe alertas imediatos a qualquer hora.                                                    | Fechar alertas, cobrar fichas pendentes, designar enfermeiras (oferta e aceite), conduzir a entrevista pré-natal (DOC 1), aprovar evoluções.      |
| Diretoria e comercial    | Médico sócio que fecha as vendas; mais pessoas do comercial no futuro | Entre consultório e reuniões, responde pelo celular; à noite conduz conversas com famílias.                                                                             | Assumir a conversa depois da triagem da Isadora, cuidar do pipeline, mandar formulário, contrato e cobrança; ver as cinco perguntas da diretoria. |
| Financeiro               | Hoje acumulado pela diretoria                                         | Computador, em horário comercial.                                                                                                                                       | Cobranças, notas, pagamento da equipe (fase 3).                                                                                                   |
| Marketing                | Terceiro ou interno                                                   | Computador.                                                                                                                                                             | Só agregados, nunca ficha de família.                                                                                                             |
| Família (fase 3, portal) | Gestante, parceiro ou parceira                                        | Casa, celular, cansaço do puerpério.                                                                                                                                    | Ver próxima visita e documentos. Fora do escopo desta direção, mas o tom vale para ela.                                                           |

## Product Purpose

Tirar a operação da Kraamzorg Brasil das planilhas, do Word e do WhatsApp solto. O sistema une venda na gestação, espera pelo nascimento, atendimento domiciliar de 6 ou 12 dias a partir da alta e pós-venda, com registro clínico offline e uma agente de triagem (Isadora) no WhatsApp.

Sucesso, em termos do cliente: 18 contratos e 18 famílias atendidas por mês, nenhuma família sem follow-up depois do preço, nenhuma ficha copiada de outra paciente, nenhuma mensagem automática para família enlutada, alerta clínico visto pela coordenação no mesmo minuto.

## Positioning

Não é um CRM com agenda. É o único sistema que carrega a mesma família da 20ª semana de gestação até o relatório final ao obstetra, com o nascimento como gatilho que ninguém controla, a alta hospitalar como início real, o registro clínico que funciona sem sinal e um freio que silencia todas as automações em um toque.

## Operating Context

Cenas reais de uso (as telas são julgadas contra elas):

1. **Quarto do bebê, 10h, D4.** A enfermeira ajuda a puérpera a amamentar, mede a temperatura (38,2 °C), anota com o polegar esquerdo enquanto a mão direita segura o termômetro. O Wi-Fi da casa não está liberado para ela e o 4G cai no apartamento. Ela precisa ver na hora que isso é PU-01, ligar para a supervisão e registrar o acionamento sem perder o que já respondeu.
2. **Carro, entre duas visitas.** A enfermeira termina o resumo descritivo por áudio ou texto e assina. O registro sobe quando o sinal volta.
3. **Consulta pré-natal online, 19h.** A coordenadora conversa por vídeo com o casal (34s2d) e preenche a entrevista no celular apoiado na mesa ou no computador. A conversa não segue a ordem do papel; ela precisa pular de etapa e retomar depois.
4. **Consultório, entre pacientes.** O diretor comercial recebe no celular "Quer contratar, Família Teste Dália, vence em 38 min". Ele assume, lê o resumo da Isadora, abre o WhatsApp e manda o formulário. A Isadora não volta a responder nessa conversa.
5. **Notícia de perda gestacional numa conversa.** Qualquer pessoa com acesso à família puxa o freio em um toque, sem justificar antes. Tudo o que é automático para de sair.
6. **Segunda de manhã, coordenação.** Quem está em visita, quem está livre, quem está reservada para famílias que ainda não tiveram bebê, quem é backup e quem está de folga. Uma família com DPP em 10 dias ainda sem enfermeira designada.

Documentos e rituais que o sistema substitui: DOC 1 (entrevista pré-natal impressa e digitada), DOC 2 (planilha de checklist com D1 a D6 lado a lado), DOC 3 (sinais de alerta), DOC 4 (LATCH e NTS), evolução em Word, grupos internos de WhatsApp, Google Forms da pesquisa.

## Capabilities and Constraints

Tarefas críticas (em ordem de risco):

1. Registrar a visita do dia (DOC 2) em poucos minutos, com uma mão, por blocos, com salvamento por campo offline.
2. Disparar e fechar alerta clínico (DOC 3) na hora, com a conduta na tela e o registro obrigatório (sinal, horário do acionamento, orientação médica, conduta).
3. Acionar o freio em um toque no cabeçalho de qualquer tela da família.
4. Assumir uma transferência da Isadora dentro do prazo (SLA do PRD 11.4).
5. Conduzir e retomar a entrevista pré-natal (DOC 1) em sequência lógica.
6. Designar enfermeira por oferta e aceite, com backup, vendo o estado de cada uma.
7. Mover a família no pipeline sem estado livre (só transições permitidas).

Restrições que não se negociam:

- Dado de saúde de gestante e recém-nascido (LGPD art. 11). Leitura assistencial é auditada. Nome de paciente nunca em URL, arquivo ou log.
- Nenhuma ficha nasce copiada de outra família. Cópia dentro da mesma família (de outro dia) só campo a campo, com confirmação explícita. Oito fichas reais tinham texto herdado de outra paciente.
- `registro_atendimento` é append-only: assinado não muda, correção vira adendo.
- Campos clínicos vêm do instrumento aprovado pela coordenação clínica. A interface não cria, não remove e não renomeia campo; escolhe só o controle.
- As quatro datas (DPP estimativa; nascimento, alta e início como fatos) sempre visíveis na ficha e nunca confundidas.
- Mobile primeiro: toque de 44 px, contraste AA, foco visível, formulário longo em etapas com salvamento por campo, indicador de sincronização de três estados.
- Offline: cada campo grava no aparelho na hora; regras de alerta rodam no aparelho; cache do dia expira em 24 h.
- Permissões por papel (PRD 13): comercial não vê registro assistencial nem a entrevista pré-natal; enfermeira não vê nada comercial.
- Nenhum preço, prazo, texto ou limite fixo no código: tudo vem de `parametro`, `mensagem_modelo`, `regra_alerta`.

Terminologia (usar sempre igual): família, gestante, puérpera, recém-nascido ou bebê, acompanhamento, visita, D1 a D12, DPP, IG (38s2d), alta, freio, estado sensível, alerta imediato, alerta prioritário, transferência (handoff no código), Isadora, oferta, backup, ficha, adendo, evolução.

Em aberto [inferido, confirmar]: onde a pessoa do comercial digita a resposta (no app pelo adaptador de mensageria ou no WhatsApp do aparelho); se o freio aceita "desfazer" nos primeiros segundos sem exigir a coordenação; se as orientações dos blocos 4 a 8 do DOC 2 podem ser marcadas como "feito hoje" em vez de sim ou não item a item.

## Brand Commitments

- Nome: Kraamzorg Brasil. Produto interno: Kraamzorg OS. Agente: Isadora.
- Paleta da marca (brand guidelines e PRD 20.2): marinho #0F1F36, dourado #BC9C5D, areia #E8DAC5, creme #FCF8ED, branco #FFFFFF, mais os semânticos sucesso, aviso, alerta e sensivel.
- Logo como arquivo, nunca redesenhado. Hoje só o PNG provisório; SVG oficial e brand guidelines ainda não chegaram.
- Tipografia da marca: Codec Pro e TT Drugs (sem licença web ainda). Substitutas: Jost para títulos, Inter para interface, IBM Plex Mono para dados.
- Voz (apresentação 2026 e PRD 20.3): calma, clara, segura e acolhedora. "Ao seu lado no pós-parto." "Os primeiros dias importam e você não precisa atravessá-los sozinha." Frases completas, sem pressão, sem travessão, sem "mãezinha", "mamãe", "papai".
- Luto e intercorrência em ameixa (sensivel), nunca em vermelho.

## Evidence on Hand

- Checklist real DOC 2 (Drive, lido nesta sessão): 9 blocos, cerca de 60 linhas, colunas D1 a D6 lado a lado, respostas S/N, escalas 0 a 10, texto curto.
- Apresentação Institucional 2026 (Drive): planos, voz, fundadores, capacidade de 3 famílias por semana por região.
- Mockup antigo da Drop (`scratchpad/mockup-inicial.html`, capturas 390 e 1280): evidência e antirreferência.
- Logo provisório: `docs/prototipo/assets/logo-provisorio.png` e `simbolo-provisorio.png`.
- Não existem ainda: SVG do logo, brand guidelines, fotos próprias, fontes licenciadas. Nenhuma tela pode inventar depoimento, número de resultado ou foto de família real.
