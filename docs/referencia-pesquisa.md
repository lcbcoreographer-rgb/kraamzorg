# Pesquisa de satisfação · referência

Fonte da pesquisa nativa do pós-venda (P42, PRD 7.4, K-12). Este arquivo diz o que a pesquisa pergunta hoje, de onde cada pergunta vem e o que ainda depende de confirmação. As perguntas e os textos moram no banco, nunca no código: `parametro.pesquisa_perguntas` e as chaves `pesquisa_*` de `mensagem_modelo`.

## Estado da transcrição

**As perguntas do formulário atual do Google Forms ainda não foram transcritas.** O arquivo do formulário não está no repositório e não entra nele: fica no Drive da Kraamzorg, para leitura humana (CLAUDE.md, Segurança e LGPD). O que está na pesquisa nativa é a transcrição parcial abaixo, montada com o que o PRD 7.4 e o seed citam. As quatro perguntas do meio são provisórias.

[confirmar] Edilaine: abrir o formulário atual, conferir cada pergunta contra a tabela abaixo, corrigir o texto e a ordem, e dizer quais perguntas do formulário antigo entram na pesquisa nativa. A mudança se faz editando `parametro.pesquisa_perguntas` (Configurações), sem código. O banco valida qualquer lista no mesmo formato.

## Perguntas

| Id                      | Tipo             | Obrigatória | Texto                                                                                                              | Origem                                                                      |
| :---------------------- | :--------------- | :---------- | :----------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| `nps`                   | escala de 0 a 10 | sim         | De 0 a 10, o quanto você recomendaria a Kraamzorg a uma pessoa querida?                                            | PRD 7.4 (pergunta NPS). Extremos: "Nada provável" e "Muito provável".       |
| `recomendaria`          | opção            | não         | Você recomendaria o acompanhamento a outras famílias? (com certeza, provavelmente, talvez, provavelmente não, não) | Provisória [confirmar].                                                     |
| `destaque`              | texto            | não         | O que mais fez diferença para vocês nesses dias?                                                                   | Provisória [confirmar].                                                     |
| `sugestao`              | texto            | não         | Tem algo que a gente poderia fazer melhor?                                                                         | Provisória [confirmar].                                                     |
| `depoimento_autorizado` | sim ou não       | sim         | Podemos usar o seu depoimento, com o seu primeiro nome, para contar a outras famílias como foi?                    | PRD 7.4 e K-12 (autorização). Texto do consentimento [confirmar: jurídico]. |
| `autorizacao_imagem`    | sim ou não       | sim         | Podemos usar imagens do acompanhamento que vocês compartilharam em nossos materiais?                               | PRD 7.4 e K-12 (autorização). Texto do consentimento [confirmar: jurídico]. |

Regras que o banco impõe (`public.pesquisa_enviar`), qualquer que seja a lista cadastrada:

1. A pergunta `nps` é obrigatória e é a única que decide a classificação. Sem ela, a resposta volta para correção.
2. Chave que não está na lista cadastrada é descartada. Texto livre tem até 2.000 caracteres e é aparado.
3. `depoimento_autorizado` e `autorizacao_imagem` guardam sim ou não em colunas próprias de `pos_venda`, para o marketing filtrar sem ler a resposta inteira.

## Classificação do NPS

Corte em `parametro.pesquisa`: promotor de 9 a 10, neutro de 7 a 8, detrator abaixo de 7. A palavra "detrator" só aparece nas telas agregadas do pós-venda; nas telas de uma família, a nota baixa se chama pelo que aconteceu.

| Classe   | O que o sistema faz na mesma transação                                                                                                                                                                                     |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Promotor | Cria as tarefas de pedir o depoimento (1 dia depois) e de convidar para indicar (7 dias depois), com os prazos de `parametro.pesquisa`.                                                                                    |
| Neutro   | Cria a tarefa de escuta, com o prazo de `parametro.pesquisa` (2 dias).                                                                                                                                                     |
| Detrator | Abre uma **ocorrência privada** da coordenação (prioridade alta, prazo de `parametro.ocorrencia_sla`) e avisa a coordenação. Nenhuma mensagem automática sai, nenhum pedido de depoimento, indicação ou avaliação pública. |

## Envio e freio

1. A coordenação gera o link em `/pos-venda` (`api.gerar_link_pesquisa`). O token tem 32 bytes aleatórios; **só o sha256 fica no banco** e o token volta uma única vez, na tela. O link vale `parametro.pesquisa.validade_dias` (30) e uma resposta só.
2. O envio ao WhatsApp é uma mensagem pessoal da coordenação, com o texto `pesquisa_convite` de `mensagem_modelo` e o link no lugar de `@@LINK@@`. O sistema não manda a pesquisa sozinho.
3. O freio roda na hora de **gerar o link** (`venda_automacao_iniciar`, categoria marketing) e na hora de **abrir e enviar** a pesquisa. Família em `bloqueio_total`, `encerrado_sensivel` ou `atencao` (a matriz do freio só libera marketing em `normal`), ou com `nao_contatar`, não recebe link, e um link que já circulava deixa de abrir. O aborto fica registrado em `automacao_execucao`.
4. Abrir e enviar passam pelo servidor com o cliente de serviço (motivo `pesquisa_publica`): só `public.pesquisa_abrir` e `public.pesquisa_enviar` têm `execute` para ele. Elas devolvem o primeiro nome e as perguntas, nunca outro dado da família.
5. O limite de tentativas por origem (`tentativas_max` em `tentativas_janela_minutos`, hoje 5 em 15) conta só as tentativas com link inválido, e a origem é guardada como HMAC do endereço, nunca o endereço. O Turnstile confere o navegador antes do envio.

## Pendências

- [confirmar] Edilaine: transcrever o formulário atual do Google Forms e fechar a lista de perguntas.
- [confirmar] Jurídico: texto do consentimento de depoimento e de uso de imagem (LGPD).
- [confirmar] Edilaine e Leonardo: corte de promotor, neutro e detrator, prazos das tarefas de depoimento, indicação e escuta, validade do link.
- [confirmar] Leonardo: aprovação dos textos `pesquisa_*` (hoje em rascunho).
