# DESIGN.md · Kraamzorg OS

Direção visual e de experiência do Kraamzorg OS. Vale para todas as telas do app (enfermeira, comercial, coordenação, diretoria, financeiro). Tokens em `docs/prototipo/assets/tokens.css`; componentes em `docs/prototipo/assets/base.css`; vitrine em `docs/prototipo/_kit.html`. No produto, a fonte de tokens continua sendo `src/app/globals.css` (PRD 20.1): este arquivo diz o que entra lá. A camada de acolhimento, que vale sobre toda a direção, está na seção 11; voz e microcopy, em `docs/design/voz.md`. [v4.4] A direção passou de "Caderneta de visita" para "Colo" (seção 2); o que mudou em token está na seção 4, as ilustrações na 5.1, os componentes novos na 6 e o guia para aplicar numa tela na 6.1.

Leitura de contexto em três linhas. O PRD trava paleta, fontes e regras de acessibilidade; o que faltava era direção, hierarquia e padrão de componente. O arquivo de clima atual citado pela skill interface-2026 não existe nesta sessão, então a direção foi decidida por princípio (vocabulário estético, leis visuais), sem inventar tendência. O launcher da Impeccable não rodou (baixa binário); PRODUCT.md e este arquivo foram escritos lendo o projeto direto, e o sorteio de direção (`concept-seed`) não aconteceu.

---

## 1. Crítica do mockup antigo

> DEGRADED: contexto único (sem subagentes nesta sessão e sem o detector `impeccable detect`, que depende do launcher). Avaliação A (design) feita antes da varredura mecânica; varredura B feita por leitura do HTML e das capturas 390 e 1280.

Alvo: `scratchpad/mockup-inicial.html` (1 arquivo, 42 telas em abas, login como primeira dobra), capturas `brand/mockup-390.png` e `brand/mockup-1280.png`.

**Veredito de especificidade.** Parcial. O mockup acerta o que é específico da Kraamzorg no conteúdo (quatro datas com "estimativa" e "fato", freio na ficha, cadeia de transferência, "nenhuma automação dispara pela DPP") e erra no que é específico na forma: é um painel de SaaS de computador com a cor da marca trocada. Trocando fonte e acento, vira qualquer CRM. Nada nele foi desenhado para uma mão, um polegar e um quarto de bebê.

| Heurística (Nielsen)               | Nota 0 a 4 | Motivo                                                                                                                                                                     |
| :--------------------------------- | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Visibilidade do estado           |     2      | "Rascunho local" existe como frase, mas sem indicador de três estados nem progresso por bloco.                                                                             |
| 2 Correspondência com o mundo real |     2      | Fala a língua da equipe, mas mostra "Imersão 12 dias", pesquisa 48 h e janela de 24 h da API, já superados.                                                                |
| 3 Controle e liberdade             |     2      | Freio existe; não há desfazer, adendo nem retomada de etapa.                                                                                                               |
| 4 Consistência                     |     1      | Ícones feitos de 25 glifos Unicode diferentes (losango, quadrado listrado, meia-lua, estrela), emoji no login, rótulos em caixa alta por toda parte, paleta fora da marca. |
| 5 Prevenção de erro                |     1      | Checklist com "campos a definir"; nada impede copiar ficha; nenhum alerta clínico no campo.                                                                                |
| 6 Reconhecer em vez de lembrar     |     2      | Boa linha do tempo da ficha; agenda depende de ler tabela.                                                                                                                 |
| 7 Eficiência                       |     1      | Barra lateral com 23 itens; nenhuma resposta de um toque; formulário inexistente no celular.                                                                               |
| 8 Estética e minimalismo           |     2      | Limpo, mas denso de rótulos, KPIs sem comparação e gráficos decorativos.                                                                                                   |
| 9 Recuperar de erro                |     1      | Nenhuma mensagem de erro desenhada.                                                                                                                                        |
| 10 Ajuda                           |     2      | Notas explicativas úteis para quem avalia o mockup, não para quem usa.                                                                                                     |
| **Total**                          | **16/40**  | Faixa "Poor" (40%).                                                                                                                                                        |

**O que funciona (fica).**

1. A ficha 360 com linha do tempo e as quatro datas com tipo marcado. Vira o cabeçalho da família.
2. O freio como ação da ficha, com texto que diz o efeito ("Todas as réguas param na hora. Justificar depois é aceitável.").
3. A fila de transferências com motivo, destino e SLA, e a cadeia Agente, Comercial, Operação, Enfermeira, Coordenação.
4. Vocabulário semântico de estado (ok, aviso, alerta, sensível com cores próprias). As cores semânticas do PRD já vêm daí.

**Problemas prioritários (sai).**

- **[P0] Não existe fluxo de enfermeira no celular.** O portal aparece como miniatura dentro de uma tela de computador, e o registro do dia é "estrutura ilustrativa" com "campos a definir". A tarefa mais frequente e de maior risco do sistema não foi desenhada. Correção: fluxo do DOC 2 por blocos, uma mão, offline (ver `fluxos.md`, fluxo A).
- **[P0] Paleta fora da marca.** `--gold #AE8B48`, `--navy #10202E`, `--navy3 #2C4859`, `--ink #14232F` e mais nove cinzas próprios. Contraria o PRD 20.1 ("nenhuma tela inventa cor"). Correção: só os nove tokens e os derivados da tabela da seção 4.
- **[P1] Travessão em todo lugar e dado real.** O travessão separa quase toda linha de alerta e o aviso do login ("auditado", travessão, "inclusive leitura"); o login e a equipe usam o nome e o e-mail reais da coordenadora. Correção: texto sem travessão e dado só fictício ("Família Teste").
- **[P1] Ícone como glifo e emoji.** Emoji de cadeado no aviso de MFA, losangos, quadrados e meias-luas Unicode na navegação: pesos e alturas diferentes, sem nome acessível. Correção: Lucide, traço 1,75, 20 e 24 px.
- **[P1] Computador primeiro.** 23 itens na lateral, KPIs em grade de quatro, tabelas de sete colunas. No celular sobra só o login. Correção: abas inferiores por papel (PRD 20.4) e tabela que vira lista.
- **[P2] Rótulo em caixa alta com espaçamento e KPI sem comparação.** "E-MAIL", "SENHA", "Receita do mês R$ 74,9 k". Correção: rótulo em frase, número sempre com base de comparação.
- **[P2] Login com gradiente radial e anéis decorativos.** Arte que não mostra nada do produto. Correção: login sóbrio no creme com o logo como arquivo.

**Personas.**

- _Casey, celular com uma mão:_ ação primária no topo (Entrar, Preencher registro), nenhum estado preservado entre interrupções, campos de texto onde caberia toque. Abandona no primeiro bloco.
- _Sam, acessibilidade:_ glifos sem nome acessível, rótulos de 11 px em caixa alta, texto de apoio `--ink50 #7C8B95` sobre creme a 3,4:1 (reprova AA).
- _Enfermeira em campo (persona do projeto):_ luva ou mão úmida, bebê no colo, sinal que cai. Precisa de alvo de 52 px, resposta de um toque, alerta na tela sem depender da rede e confirmação de que nada se perdeu. Nada disso existe no mockup.

**Perguntas que mudam o desenho.** E se o registro do dia coubesse na tela do polegar, um bloco por vez? E se o estado da família (freio) mudasse a cor do cabeçalho inteiro, e não um selo? E se a cor da tela viesse só do estado clínico, deixando todo o resto quieto?

Modo de redesign (protocolo Taste 11 e Impeccable): **overhaul visual com preservação de conteúdo e arquitetura**. Preserva: nomes de módulos, a linha do tempo, as quatro datas, a cadeia de transferência, os agrupamentos Comercial, Operação, Experiência, Gestão, Sistema. Troca: todo o mundo visual, a navegação móvel, os componentes de formulário, os ícones, a paleta derivada, o texto.

---

## 2. Direção: Colo [v4.4]

Esta seção substitui a direção "Caderneta de visita" (25/09). Pedido do dono do projeto em 30/09: o visual tinha ficado com cara de IA, genérico e burocrático; ele quer um app mais vivo, mais acolhedor e mais gostoso de usar, com formas suaves, blocos de cor e informação muito mais bem dividida, seguindo as referências que mandou e sem sair da identidade da Kraamzorg. É um CRM interno, e o acolhimento precisa estar no dia de quem atende, principalmente no checklist que a enfermeira responde na casa da família.

Leitura de contexto. O arquivo de clima da interface-2026 continua ausente; a direção sai por princípio e pelas cinco referências do dono (lidas uma a uma, abaixo). A paleta, as fontes e o logo são da marca (PRD 20.2) e não mudam: a vivacidade vem dos tons de apoio [v4.4] e da forma. Modo Operate da Impeccable (a pessoa está numa tarefa), com cor Committed nas telas de abertura (Hoje, Início) e Restrained nas telas densas (tabelas, formulários da coordenação).

Diagnóstico em uma frase. O problema não era de cor: tudo morava em cartão branco igual, com o mesmo peso, sobre creme; nada dizia onde começa uma coisa e termina outra, nenhum número tinha tamanho de número e o checklist era uma planilha de linhas finas.

### 2.1 Nome, âncora e intenção

**Colo.** O símbolo da marca desenha um colo: a curva dourada segura as duas figuras. A direção herda o gesto, sem redesenhar o símbolo: todo conteúdo mora num bloco macio que o segura, com cantos generosos e uma base que às vezes se curva como a do símbolo. A informação se divide em blocos que encaixam uns nos outros, cada um com a cor do que ele é.

**Intenção.** Quem abre o app sente que alguém arrumou o dia para ela: o nome no topo, o dia, o que espera por ela em números grandes, cada assunto no seu bloco, e o que falta fazer com cara de coisa gostosa de completar. Nos momentos difíceis, a tela fica quieta.

**Família estética.** Suave estruturado em registro de app de trabalho: blocos de tom chapados (sem gradiente, sem vidro, sem textura), pílula e círculo para tudo que se toca, sombra quase imperceptível. Descartadas por escrito: o pastel saturado das referências (roxo, rosa, laranja de outras marcas), o 3D de mascote, o modo escuro, e a volta ao cartão branco em grade.

### 2.2 O que levamos de cada referência

| Referência | O que tem | Como entra na Kraamzorg |
| :-- | :-- | :-- |
| App de estudos em três telas (verde, amarelo, coral) | "Hi, Elizabeth" e a data no topo; três números grandes em tiles com o ícone num círculo colorido (44 total, 12 concluídas, 34 a seguir); abas "Weekly / Month" em pílula; blocos de cor com borda recortada e uma aba no meio da borda | Cumprimento pelo primeiro nome e o dia no topo do Hoje e do Início ("Bom dia, Talita" e "Hoje, quarta 30/09"). Trio de cartões-resumo com número grande: no Hoje, visitas de hoje, fichas pendentes e visitas de amanhã; no Início do comercial, transferências esperando, tarefas de hoje e conversas com a equipe. Abas do pipeline em pílula. |
| Painel com personagem e cartões pastel | Cartões de número com o ícone num quadradinho de cor, lista de tarefas em que cada linha tem o seu tile de cor e um selo de estado | Cartão-resumo com tile; lista em blocos (tarefas, evoluções, a agenda de amanhã) com tile por assunto e selo de estado à direita. Sem personagem e sem "You're doing great". |
| Coleção de telas de app (check-in diário, parabéns, planos) | Grade de check-in com rótulo pequeno e valor grande (Sono 9 h, Energia 1850); abas segmentadas; tela de conclusão com ilustração e uma ação | O resumo do checklist em grade de etapas, cada uma com o estado; a comemoração do checklist completo com a ilustração do caderno de visita e uma ação só ("Assinar registro do D4"), sem "Parabéns". |
| Quiz com personagem amarelo | Uma pergunta por tela, respostas em botões grandes e redondos, barra de progresso gorda com a porcentagem, blocos de número ("237 minutos", "78%") | Uma pergunta por cartão no checklist, com Sim e Não em pílulas de 56 px lado a lado; barra de progresso da etapa ("5 de 9 respondidas") e anel das etapas da visita. |
| Painel escuro de coleções | Abas em pílula no topo, cartões com a borda de cima em onda, botão de ação com o valor dentro de uma pílula | A forma "colo" (bloco com a base curva) no bloco de abertura do dia e no bloco da etapa do checklist. O escuro fica de fora: o marinho aparece como um bloco forte por tela, não como tema. |

### 2.3 Princípios

1. **Blocos, não linhas.** Cada assunto mora num bloco com fundo de tom, cantos de 28 px e espaço em volta. Divisória fina só dentro de tabela. Se dois assuntos dividem um cartão, viram dois blocos.
2. **A cor diz o que é.** Tom pelo papel, nunca por humor: `dourado-claro` é o agora (o dia, a visita em curso, a etapa atual); `areia-clara` é a família e o que já foi guardado; `salvia-clara` é o que está feito; `lavanda-clara` é o tempo (amanhã, a semana, a agenda); `argila-clara` são as pessoas e as conversas. Branco é o trabalho que ainda falta: a pergunta sem resposta, o cartão da tarefa. O marinho é a ação e o único bloco forte da tela.
3. **Número com tamanho de número.** Contagem de resumo em Jost de 44 px, com o contexto embaixo em frase ("manhã e tarde", "a primeira vence às 14:00"). Nenhum número sozinho.
4. **Tudo que se toca é redondo.** Botão, aba, seletor, filtro e navegação em pílula ou círculo, com 44 px no mínimo e 56 px nas respostas do checklist.
5. **Completar é gostoso.** Progresso aparece onde há algo a completar (etapas da visita, perguntas da etapa, fichas da semana), em anel segmentado e em barra de pílula, e fecha com a comemoração do checklist completo.
6. **Silêncio no difícil.** Em freio, perda, intercorrência e alerta clínico a tela perde tom, ilustração e movimento: fica creme, branco, ameixa e alerta, como na seção 11.8.

### 2.4 Formas

- **Raio, quatro degraus**: `raio-1` 6 px (caixa de seleção, marca pequena), `raio-2` 16 px (campo, faixa, item de lista, bloco da régua), `raio-3` 28 px (cartão, bloco, folha inferior, painel), `raio-pilula` (botão, aba, seletor, selo, navegação). O que se toca é pílula ou círculo; o que contém é 16 ou 28.
- **Colo** (`rounded-colo`): bloco com os cantos de cima em 28 px e a base inteira em arco raso (40 px de flecha), como a curva do símbolo. Um por tela, no bloco de abertura (cumprimento do dia, etapa do checklist, comemoração). Pede 40 px de respiro embaixo.
- **Encaixe**: tile, anel ou pílula que se apoia na borda entre dois blocos, ou um bloco de tom médio dentro de um claro (o tile do ícone dentro do cartão-resumo). Forma que encaixa em outra, nunca cartão dentro de cartão branco.
- **Aba** [polimento] (`encaixe-aba`, `BlocoAba`): o título do bloco mora numa aba no mesmo tom, colada no canto de cima à esquerda, e a junção fecha numa curva côncava de 20 px (a cor da curva vem de `--cor-aba`). O cumprimento das telas de abertura usa a mesma aba em cima do bloco colo. No bloco neutro (assunto sensível), a aba ganha a borda do bloco e perde a curva.
- **Sombra**: `sombra-1` só no que é trabalho a fazer (pergunta sem resposta, cartão tocável); bloco de tom não leva sombra. `sombra-2` para a navegação flutuante, a barra de ação e a folha inferior.

### 2.5 Blocos de cor

| Bloco | Fundo | Texto | Onde |
| :-- | :-- | :-- | :-- |
| Abertura do dia | `dourado-claro`, forma colo, cumprimento em aba | marinho e `marinho-72` | Topo do Hoje e do Início |
| Cartão-resumo [polimento] | o número principal em marinho (tile dourado); os outros no tom médio do assunto, tile branco | sobre marinho, creme e `creme-62`; sobre tom médio, só marinho | Trio de números dentro da abertura e no topo das listas |
| Bloco com aba [polimento] | tom claro do assunto, conteúdo em cartões brancos | marinho | Início da coordenação e da diretoria |
| Pergunta sem resposta | branco, `sombra-1` | marinho | Checklist, formulário da enfermeira |
| Pergunta respondida | `areia-clara`, sem sombra, marca de check em `salvia-media` | marinho | Checklist |
| Coluna do pipeline | `areia-clara` | marinho | Pipeline no computador |
| Agenda e amanhã | `lavanda-clara` | marinho e `marinho-72` | Hoje (amanhã), Perfil (semana) |
| Feito | `salvia-clara` | marinho | Comemoração, tarefa concluída |
| Bloco forte | marinho cheio | creme e `creme-62` | Navegação, um destaque por tela no máximo |

Regras: texto sobre tom claro em marinho ou `marinho-72`; sobre tom médio, só marinho; `marinho-62` nunca sobre tom (PRD 20.2). No máximo quatro tons diferentes por viewport, contando o marinho, e um bloco marinho por tela. Dentro do bloco `dourado-claro`, o tom médio da areia some (os dois têm o mesmo valor): ali o assunto "família" usa argila. Estado (alerta, aviso, sucesso, sensível) continua com lavado, borda, ícone e palavra, e nunca é pintado com tom de apoio.

### 2.6 Tipografia com números grandes

| Nível | Fonte | Tamanho | Uso |
| :-- | :-- | :-- | :-- |
| `text-numero` | Jost 500, -0,02em, tabular | 44 px / 1 | Número do cartão-resumo (2 visitas, 4 tarefas) |
| `text-numero-sm` | Jost 500, -0,01em | 24 px / 1 | Número dentro do anel, contagem da coluna do pipeline |
| `t-display` | Jost 400 | 32 px celular, 40 px computador | O dia no bloco de abertura, o nome da etapa |
| `saudacao` | Inter 500 | 17 px (`text-3`) | "Bom dia, Talita" acima do dia |

Jost carrega número e frase humana (PRD 20.2: "números grandes"); IBM Plex Mono continua só em medida de linha (hora, data, D4, R$, código PU-01). O número do cartão-resumo usa algarismos tabulares da Jost para não pular quando muda.

### 2.7 Ícone em tile

`TileIcone`: o ícone Lucide (traço 1,75, marinho) dentro de um círculo ou de um quadradinho de raio 16, no tom médio do assunto. Três tamanhos: 36, 44 e 56 px. O tile diz o assunto (visita, tarefa, conversa, agenda); estado continua com o ícone próprio na faixa (sirene, octógono), sem tile. Ícone de estado nunca vai num tile alegre.

### 2.8 Progresso

- **Anel segmentado** (`AnelProgresso`): um segmento por etapa, feito em marinho, atual em dourado, a fazer na trilha `marinho-14`, com o número no centro em Jost. Substitui a rosca contínua: cada segmento é uma etapa real. Usado no checklist (etapas completas da visita). [polimento] O bloco da etapa traz o anel da visita inteira, encaixado num disco branco, com a porcentagem das perguntas respondidas em número grande e a legenda "da visita".
- **Resposta escolhida** [polimento]: a opção escolhida fica em marinho cheio com o check; as outras recuam (sem fundo, borda `marinho-14`, texto `marinho-72`). Vale para sim ou não, escolha única e escala de 0 a 10. Sem resposta, todas iguais: nada sugerido.
- **Barra em pílula** (`BarraProgresso`): trilha de 10 px, preenchimento marinho com a ponta redonda, e a frase ao lado ("5 de 9 respondidas"). Completa, ganha o check e a frase "Tudo respondido nesta etapa".
- **Blocos segmentados** (régua de dias, `ProgressoEtapas`): continuam para tempo (D1 a D12) e para a trilha das etapas.
- Nunca anel ou barra decorativa: todo progresso conta uma coisa que a pessoa faz.

### 2.9 Navegação

- **Celular**: pílula marinho flutuante, 64 px, a 12 px das bordas e do fundo, sombra `sombra-2`. Ícone de 22 px e rótulo de 13 px em todas as abas; a aba ativa vira uma pílula creme com ícone e rótulo em marinho. Contador em `alerta` só para alerta clínico ou transferência vencendo.
- **Computador**: barra lateral marinho de 248 px, solta 12 px das bordas, com raio 28. Item ativo em pílula creme com o ícone marinho; os outros em `creme-62`.
- **Abas de conteúdo**: `AbasPilula`, trilha areia e a aba ativa em pílula marinho com texto creme [polimento; antes branca, sumia na trilha] (pipeline, filtros, períodos, abas da ficha).
- **Checklist** [polimento]: dentro de `/visita/...` a navegação em pílula se esconde e fica só a barra de ações, a 12 px do fundo; o fim da página reserva a altura dela, e o último cartão aparece inteiro acima da barra em 390 px. A saída é a seta de voltar do cabeçalho.

### 2.10 Estados vazios

Estado vazio é um bloco `areia-clara` com uma das ilustrações da casa (seção 5.1), o título que diz o que é, o texto que diz quando algo aparece ali e a próxima ação. Tipos e ilustração: sem tarefas (xícara quente), sem visitas hoje (janela com sol da manhã), sem conversas (sino calmo), busca sem resultado (folha e lupa), sem sinal (nuvem sem sinal), sem famílias atribuídas (chave de casa), ainda em construção (broto), dia tranquilo de plantão (lua e nuvem). O texto continua o da seção 11.7: fala do que a pessoa vai ter, nunca dos componentes da tela.

### 2.11 Comemoração do checklist completo

Quando a última pergunta obrigatória da visita é respondida e não há alerta na visita, o resumo abre um bloco `salvia-clara` em forma colo com a ilustração do caderno de visita: o traço se desenha em 700 ms, o check aparece por último, e para. Texto calmo, sem exclamação e sem "parabéns": "Checklist do D4 completo. Falta só a sua assinatura." Com `prefers-reduced-motion`, a ilustração aparece pronta. Com alerta na visita ou família em estado sensível, não há comemoração: fica a linha "Tudo respondido" em texto.

### 2.12 O que nunca fazer

- Cor ou tom fora do `globals.css`; roxo, rosa, laranja ou azul de outra marca; gradiente; vidro; textura.
- Tom de apoio, ilustração ou movimento em freio, perda, intercorrência ou alerta clínico.
- Tom de apoio para dizer estado; lavanda ao lado do ameixa ou argila ao lado do alerta no mesmo bloco.
- Mascote, rosto de bebê, coração, mãe desenhada, confete, estrela, emoji; imagem gerada por IA ou de banco.
- Grade de cartões iguais como estrutura da tela; cartão branco dentro de cartão branco; número sem contexto; anel ou barra sem uma tarefa real por trás.
- "Parabéns", "Ótimo trabalho", exclamação ou elogio dito pela interface.
- Rótulo em caixa alta acima de título, numeração decorativa, travessão.
- Raio fora da escala; sombra que se nota antes do conteúdo.

### 2.13 Contrato de direção (Impeccable, para quem revisa)

- THESIS: o app segura o dia de quem cuida em blocos macios, com cor pelo papel; recusa a grade de cartões brancos iguais.
- OWN-WORLD: creme de fundo, marinho de tinta e de ação, dourado-claro para o agora, areia para a família, sálvia para o feito, lavanda para o tempo, argila para as pessoas, ameixa para o luto; pílula e círculo para o toque; Jost para número e frase humana, mono para medida.
- STORY: a enfermeira chega na casa, responde uma pergunta por cartão com o polegar, vê a visita se completar e assina; o comercial abre o dia e vê em três números o que espera por ele.
- FIRST VIEWPORT (enfermeira, Hoje): bloco colo dourado com "Bom dia, Talita", "Hoje, quarta 30/09" e a frase do dia; trio de cartões-resumo; a próxima visita com a régua de dias e "Cheguei"; navegação em pílula.
- FORM: colo (bloco de base curva) e encaixe (tile e anel apoiados na borda do bloco).
- FINISH: telas-piloto (checklist, Hoje, Início do comercial, Pipeline) capturadas em 390 e 1280 px; as outras telas seguem o guia da seção 6.1.

### Modo escuro: não, nesta fase

Cena de uso: as visitas acontecem de manhã ou à tarde (não existe atendimento noturno, PRD 3.2), em ambiente interno claro; a coordenação e o comercial usam o celular de dia e no começo da noite. As cores semânticas (alerta, aviso, sensível) e os tons de apoio foram medidos sobre fundo claro; um segundo tema dobraria a verificação de contraste de cada estado clínico, com risco real de um alerta perder leitura. Decisão: um tema claro, `color-scheme: light`, sem seguir a preferência escura do sistema.

---

## 3. Grid e breakpoints

| Faixa      | Largura         | Estrutura                                                                                                                                                  |
| :--------- | :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Celular    | até 599 px      | Uma coluna, margem de 16 px, abas inferiores fixas, ação principal na barra inferior (zona do polegar), régua de 12 dias em duas linhas de 6.              |
| Tablet     | 600 a 1023 px   | Uma coluna mais larga, grades de cartão em 2 colunas, escala 0 a 10 em uma linha, abas inferiores mantidas.                                                |
| Computador | 1024 px ou mais | Barra lateral marinho de 248 px, conteúdo até 1240 px com margem de 32 px, duas colunas 62/38 (lista e detalhe, formulário e contexto), tabelas completas. |

Regras: espaçamento em múltiplos de 4; grupos próximos, grupos vizinhos separados por 24 a 32 px; mais espaço acima de título que abaixo. Tabela vira lista abaixo de 720 px. Nada de rolagem horizontal da página; só listas de abas e chips rolam de lado.

---

## 4. Tokens

### Cores (primitivos, PRD 20.2)

Contraste medido com a fórmula WCAG 2.x.

| Token      | Hex     | Papel                                                                          | Contraste                                                    |
| :--------- | :------ | :----------------------------------------------------------------------------- | :----------------------------------------------------------- |
| `marinho`  | #0F1F36 | Texto, ação primária, barra lateral, dia feito                                 | 15,6:1 no creme · 16,5:1 no branco · 12,0:1 na areia         |
| `dourado`  | #BC9C5D | "Hoje", "atual", "ativo": borda, marcador, trilha. Nunca texto no claro        | 2,5:1 no creme (reprova texto) · marinho sobre dourado 6,3:1 |
| `areia`    | #E8DAC5 | Cabeçalho da família, superfície secundária, bolha da Isadora, folga na escala | marinho sobre areia 12,0:1                                   |
| `creme`    | #FCF8ED | Fundo de toda tela; texto sobre marinho, alerta, sucesso e sensivel            | 15,6:1 sobre marinho                                         |
| `branco`   | #FFFFFF | Cartão, campo, folha inferior                                                  |                                                              |
| `sucesso`  | #4B7358 | Sincronizado, entregue, concluído                                              | 5,1:1 creme · 4,6:1 sobre o lavado                           |
| `aviso`    | #B5822A | Pendente, prazo perto: fundo lavado, borda, hachura                            | 3,2:1 creme (só elemento gráfico)                            |
| `alerta`   | #9E4438 | Alerta clínico imediato, erro, SLA vencido                                     | 5,9:1 creme · 5,3:1 sobre o lavado                           |
| `sensivel` | #63557A | Freio, perda, intercorrência                                                   | 6,4:1 creme · 5,7:1 sobre o lavado                           |

### Derivados (misturas fixas, nenhum matiz novo)

Precisam entrar no `@theme` do `globals.css` com estes nomes; é a única ampliação proposta ao PRD 20.2.

| Token           | Receita                       | Uso                                      | Contraste                            |
| :-------------- | :---------------------------- | :--------------------------------------- | :----------------------------------- |
| `marinho-72`    | marinho 72% + creme (#515C69) | Texto secundário                         | 6,4:1 creme · 4,9:1 areia            |
| `marinho-62`    | marinho 62% + creme (#69717C) | Placeholder, meta. Nunca sobre areia     | 4,7:1 creme                          |
| `marinho-50`    | marinho 50% + creme (#868B92) | Borda de campo e de controle             | 3,2:1 creme · 3,4:1 branco           |
| `marinho-14`    | marinho 14% + creme           | Divisória fina                           | decorativa                           |
| `marinho-08`    | marinho 8% + creme            | Hover neutro, selo neutro                |                                      |
| `marinho-claro` | marinho 84% + creme (#354253) | Hover do primário, item ativo da lateral | creme sobre ele 9,6:1                |
| `creme-62`      | creme 62% + marinho (#A2A6A7) | Texto de apoio sobre marinho             | 6,7:1                                |
| `aviso-texto`   | aviso 60% + marinho (#735A2F) | Texto de estado pendente                 | 6,1:1 creme · 5,6:1 sobre o lavado   |
| `*-lavado`      | token 12 a 18% + branco       | Fundo de selo, faixa e campo em estado   | ver acima                            |
| `*-borda`       | token 40 a 45% + branco       | Contorno de faixa em estado              | decorativa, sempre com ícone e texto |

Regra de uso: um acento dourado por tela. Cor semântica só com texto e ícone ao lado, nunca sozinha.

### Tons de apoio [v4.4] (PRD 20.2)

A paleta base não muda. Tons misturados das cores da marca, com versão clara (fundo de bloco) e média (tile, trilha, preenchimento). Superfície, nunca estado; nunca em momento sensível.

| Token           | Receita               | Uso                                                      | Texto por cima                               |
| :-------------- | :-------------------- | :------------------------------------------------------- | :------------------------------------------- |
| `dourado-claro` | dourado 30% + creme   | O agora: abertura do dia, etapa atual, hora da visita    | marinho 12,2:1 · `marinho-72` 5,0:1          |
| `dourado-medio` | dourado 55% + creme   | Tile e trilha dentro do bloco dourado                    | só marinho, 9,8:1                            |
| `areia-clara`   | areia 55% + creme     | Família, pergunta respondida, coluna, lista, estado vazio | marinho 13,6:1 · `marinho-72` 5,6:1          |
| `salvia-clara`  | sucesso 18% + creme   | Feito: comemoração, etapa completa                       | marinho 12,3:1 · `marinho-72` 5,1:1          |
| `salvia-media`  | sucesso 40% + creme   | Tile e marca de check do feito                           | só marinho, 9,0:1                            |
| `lavanda-clara` | sensivel 18% + branco | Tempo: amanhã, semana, agenda                            | marinho 12,7:1 · `marinho-72` 5,2:1          |
| `lavanda-media` | sensivel 36% + branco | Tile da agenda                                           | só marinho, 9,5:1                            |
| `argila-clara`  | alerta 14% + creme    | Pessoas e conversas: contato, transferências             | marinho 12,7:1 · `marinho-72` 5,2:1          |
| `argila-media`  | alerta 30% + creme    | Tile de pessoas e conversas                              | só marinho, 9,9:1                            |

`marinho-62` nunca vai sobre tom de apoio (3,6 a 4,1:1). Texto de estado (`sucesso`, `aviso-texto`, `alerta`) sobre tom de apoio vai numa pílula com o lavado do próprio estado: `sucesso` direto sobre `areia-clara` fica em 4,4:1.

### Tipografia

| Nível       | Fonte                      | Tamanho / entrelinha                   | Uso                                                          |
| :---------- | :------------------------- | :------------------------------------- | :----------------------------------------------------------- |
| `numero`    | Jost 500, -0,02em, tabular | 44 / 1                                 | Número do cartão-resumo [v4.4]                               |
| `numero-sm` | Jost 500, -0,01em          | 24 / 1                                 | Número no anel e na contagem [v4.4]                          |
| `t-display` | Jost 400, -0,02em          | 32 px celular, 40 px computador / 1,05 | Um por tela: "Hoje, quinta 24/09", "Pipeline", "Equipe"      |
| `t-1`       | Jost 500, -0,015em         | 26 / 1,12                              | Nome da família, título de etapa ou bloco                    |
| `t-2`       | Jost 500, -0,01em          | 20 / 1,2                               | Título de seção, título do cabeçalho de tela                 |
| `t-3`       | Inter 600                  | 17 / 1,35                              | Título de cartão, título de faixa                            |
| corpo       | Inter 400                  | 16 / 1,5                               | Texto, campo, pergunta (pergunta em 500)                     |
| apoio       | Inter 400 e 500            | 14 / 1,45                              | Rótulo (600), ajuda, metadado                                |
| mini        | Inter 500                  | 13 / 1,4                               | Menor texto permitido: selo, aba inferior                    |
| dado        | IBM Plex Mono 500, tabular | 14 ou 16; 18 em campo numérico         | Datas, horas, IG, R$, D1, códigos PU-01. Nunca frase inteira |

Justificativa escrita para Inter (o lint da interface-2026 marca como ALTA e a Taste desencoraja): Inter está travada no PRD 20.2 como fonte de interface, e o modo Operate da Impeccable autoriza a fonte de trabalho familiar. O caráter da marca fica com Jost nos títulos e com Plex Mono nos dados; Inter faz só o que precisa ser invisível. Escala fixa em rem, sem `clamp`. Nenhum rótulo em caixa alta.

### Espaço, raio, sombra, borda

- Espaço: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Margem de tela 16 px no celular, 32 px no computador.
- Raio, quatro degraus [v4.4]: `raio-1` 6 px (caixa de seleção, turno da escala), `raio-2` 16 px (campo, faixa, item de lista, dia da régua), `raio-3` 28 px (cartão, bloco, folha inferior), `raio-pilula` 999 px (botão, selo, seletor, aba, navegação). Mais a forma `colo` (seção 2.4), um por tela. Regra: o que se toca é pílula ou círculo; o que contém é 16 ou 28. Antes da v4.4 eram 4, 12 e 20 px.
- Toque: 44 px no mínimo; 52 px na linha de resposta; 56 px (`toque-grande`) nas respostas em cartão do checklist e em "Cheguei".
- Sombra, duas, tingidas de marinho: `sombra-1` para cartão (quase imperceptível), `sombra-2` para barra inferior, folha e aviso efêmero. Se a sombra é a primeira coisa que se nota, está errada.
- Borda: divisória 1 px `marinho-14`; campo e controle 1,5 px `marinho-50`; estado 2 px na cor do estado; tracejado só para "ainda não" e "confirme".

### Estados de interação

| Estado               | Botão                                                       | Campo                                                                   | Seletor sim ou não                         |
| :------------------- | :---------------------------------------------------------- | :---------------------------------------------------------------------- | :----------------------------------------- |
| Repouso              | pílula, 48 px                                               | caixa branca 52 px, borda `marinho-50`                                  | duas pílulas brancas                       |
| Hover (ponteiro)     | fundo `marinho-08` ou `marinho-claro`                       | borda `marinho-72`                                                      | fundo `marinho-08`                         |
| Pressionado          | desce 1 px e encolhe 1,5%                                   |                                                                         | encolhe 4%                                 |
| Foco (teclado)       | contorno 2 px marinho + halo dourado 5 px                   | borda marinho + halo dourado 4 px                                       | igual ao botão                             |
| Selecionado          |                                                             |                                                                         | marinho cheio, texto creme, ícone de check |
| Desabilitado         | fundo `marinho-08`, texto `marinho-62`, cursor bloqueado    | fundo `marinho-08`                                                      |                                            |
| Carregando           | `aria-busy`, ícone girando, texto no gerúndio ("Assinando") |                                                                         |                                            |
| Erro                 |                                                             | borda alerta 2 px + mensagem abaixo com ícone                           |                                            |
| Aviso                |                                                             | borda aviso 2 px + mensagem em `aviso-texto`                            |                                            |
| Alerta clínico       |                                                             | borda alerta 2 px, fundo `alerta-lavado`, faixa logo abaixo             | pergunta em alerta, faixa logo abaixo      |
| Copiado, a confirmar |                                                             | borda dourada tracejada, fundo `dourado-lavado`, bloco "Vale para hoje" |                                            |

Movimento: 140 ms para resposta de controle, 220 ms para entrada de aviso e para o preenchimento da barra de progresso, curva de saída suave. Nada de mola, rotação de entrada ou sequência de carregamento. A única animação autoral é a comemoração do checklist completo (`animate-desenhar`, 700 ms, uma vez). `prefers-reduced-motion` desliga tudo, o esqueleto vira fundo parado e a ilustração aparece pronta.

### Densidade por papel

| Papel                                 | Densidade   | Regra                                                                                                       |
| :------------------------------------ | :---------- | :---------------------------------------------------------------------------------------------------------- |
| Enfermeira                            | Confortável | Linha de resposta de 72 px, alvo de 52 px, um bloco por tela, corpo 16 px.                                  |
| Comercial                             | Média       | Cartões de lista com 3 linhas de informação, fila com ação no próprio cartão.                               |
| Coordenação e diretoria no computador | Compacta    | Tabela com linha de 40 px quando o ponteiro é fino; 48 px no toque. Nunca abaixo de 44 px de alvo no toque. |

---

## 5. Iconografia

Lucide (lucide-static 1.48.0, ISC), traço 1,75, 20 px ao lado de texto de 14 a 16 px, 24 px nas abas inferiores e nas faixas. Sprite em `assets/icones.js` (injeta `<symbol>` no documento; uso: `<svg class="icone"><use href="#i-hand"/></svg>`). Ícone nunca sozinho quando significa estado; botão só de ícone leva `aria-label`.

| Significado                                             | Ícone                                                      |
| :------------------------------------------------------ | :--------------------------------------------------------- |
| Freio (acionar)                                         | `hand`                                                     |
| Freio ativo, estado sensível                            | `octagon-pause`                                            |
| Alerta imediato                                         | `siren`                                                    |
| Alerta prioritário, atenção                             | `triangle-alert`                                           |
| Erro de campo                                           | `circle-alert`                                             |
| Salvo no aparelho / enviando / sincronizado / sem sinal | `smartphone` / `cloud-upload` / `cloud-check` / `wifi-off` |
| Ligar                                                   | `phone-call`                                               |
| Isadora (IA)                                            | `bot`                                                      |
| Assumir, designação aceita                              | `user-check`                                               |
| Prazo                                                   | `hourglass`, `clock`, `clock-alert`                        |
| Visita, endereço                                        | `map-pin`                                                  |
| Assinar                                                 | `pen-line`                                                 |
| Hoje, Famílias, Alertas, Perfil                         | `house`, `users`, `siren`, `user-round`                    |
| Pipeline, Radar, Agenda, Equipe                         | `kanban`, `radar`, `calendar-days`, `user-check`           |

### 5.1 Ilustrações [v4.4]

Decisão do dono do projeto (PRD 20.2): um conjunto pequeno de ilustrações próprias, quase como ícones. Desenhadas à mão em SVG, em `src/components/ilustracoes` (nunca imagem gerada por IA, nunca banco de imagem). Traço contínuo e arredondado em marinho, com a espessura dos ícones (1,75 px na tela, em qualquer tamanho, por `vector-effect`); uma mancha de fundo num tom claro e uma ou duas formas de destaque em dourado ou tom médio, um pouco fora do traço, como um carimbo. Sem rosto, sem coração, sem bebê, sem pessoa.

| Peça                      | Componente        | Onde entra                                       |
| :------------------------ | :---------------- | :----------------------------------------------- |
| Xícara quente             | `XicaraQuente`    | Sem tarefas para hoje                            |
| Janela com sol da manhã   | `JanelaManha`     | Sem visitas hoje                                 |
| Sino calmo                | `SinoCalmo`       | Sem conversas, nenhum alerta aberto              |
| Folha e lupa              | `FolhaLupa`       | Busca ou filtro sem resultado                    |
| Nuvem sem sinal           | `NuvemSemSinal`   | Sem sinal, com o registro guardado no aparelho   |
| Caderno de visita         | `CadernoDeVisita` | Comemoração do checklist completo                |
| Manta dobrada             | `MantaDobrada`    | Dia tranquilo, nenhuma família num estágio       |
| Chave de casa             | `ChaveDeCasa`     | Primeira vez, nenhuma família atribuída ainda    |
| Lua e nuvem               | `LuaENuvem`       | Plantão tranquilo, nada pendente até amanhã      |
| Broto no vaso             | `Broto`           | Parte ainda em construção                        |

Regras: decorativa (`aria-hidden`) quando o título do estado vazio já diz o que é; com `titulo`, vira `role="img"`. A mancha de fundo nunca some no bloco que a recebe: `sobre` diz o tom do bloco e, quando a mancha tem o mesmo tom ou um vizinho (areia e dourado claros), ela vira um disco branco, como o ícone num tile. O `EstadoVazio` passa `sobre="areia-clara"` sozinho e a comemoração passa `sobre="salvia-clara"`. Tamanho de 96 a 120 px. Uma por tela. Nunca em alerta clínico, perda, freio ou intercorrência. O catálogo (`ILUSTRACOES`) diz o uso de cada uma: a mesma ilustração conta sempre a mesma coisa.

---

## 6. Componentes

Nomes de classe de `base.css` entre crases. Todo componente interativo tem repouso, hover, foco, pressionado, desabilitado, carregando e erro quando se aplica.

**Botão** (`botao`, `--primario`, `--terciario`, `--alerta`, `--sensivel`, `--bloco`, `--compacto`, `--icone`). Pílula de 48 px, texto de 16 px em 600, verbo e objeto ("Assinar registro do D4", "Assumir conversa"). Um primário por tela. Primário marinho; secundário branco com borda; terciário sublinhado; alerta só dentro de faixa clínica ("Ligar para a supervisão"); sensível só na confirmação do freio. No celular, a ação principal mora na `barra-acao` fixa no rodapé.

**Campo** (`campo`, `campo__rotulo`, `campo__caixa`, `campo__entrada`, `campo__unidade`, `campo__ajuda`). Rótulo em cima, sempre visível; placeholder só como exemplo. Numérico com `inputmode="decimal"` e unidade à direita em mono (°C, bpm, mmHg, g). A ajuda mostra o valor do dia anterior da mesma família como referência, nunca como preenchimento. Estados por `data-estado`: `erro`, `aviso`, `alerta-clinico`, `copiado`, `desabilitado`. Salva no aparelho ao sair do campo.

**Seletor sim ou não em um toque** (`pergunta`, `sim-nao`). Pergunta à esquerda, duas pílulas de 52 px à direita. Um toque responde e grava; tocar de novo em outra opção troca. Nenhuma das opções tem cor de "certo" ou "errado"; só a resposta que dispara regra pinta a pergunta de alerta e abre a faixa logo abaixo. Sem valor padrão. Campo "sim/não + texto" abre o texto abaixo só quando a resposta pede.

**Escala 0 a 10** (`escala`). Onze alvos de 52 px: no celular em duas linhas (0 a 5, 6 a 10), a partir de 600 px em uma. Números em mono, extremos descritos ("0 · sem dor", "10 · pior dor possível"). Sem gradiente verde para vermelho: a escala não sugere resposta. O corte de alerta não aparece na escala; aparece a faixa depois da resposta.

**Marcação múltipla** (`marcas`). Chips para "o que foi feito hoje" nos blocos de orientação (4, 5, 6, 8), se a coordenação clínica aprovar a troca de sim ou não item a item (ver `fluxos.md`).

**Cartão** (`Cartao`, variantes `padrao`, `plano`, `areia` e, [v4.4], os tons `dourado`, `areia-clara`, `salvia`, `lavanda`, `argila`; `forma="colo"`; `tocavel`). Branco com `sombra-1` para o trabalho que falta; bloco de tom sem sombra para o que o assunto é. Raio 28, padding 20. Cartão tocável inteiro é link. Nunca cartão branco dentro de cartão branco.

**Cartão-resumo** [v4.4] (`CartaoResumo`, `src/components/ui/cartao-resumo.tsx`). Tile do assunto, número em Jost de 44 px, rótulo em frase e contexto ("a primeira às 09:00"). `fundo="branco"` dentro do bloco de abertura; `destaque` ocupa a linha no celular. Com `href`, o cartão inteiro é o link.

**Ícone em tile** [v4.4] (`TileIcone`, `tile-icone.tsx`). Círculo ou quadrado de raio 16, 36, 44 ou 56 px, no tom médio do assunto, ícone marinho. Nunca para estado.

**Abas em pílula** [v4.4] (`AbasPilula`, `abas-pilula.tsx`). Trilha areia, aba ativa em pílula branca com `sombra-1`; link ou botão, com `role="tab"`. `larga="celular"` ocupa a linha abaixo de 600 px e deixa o rótulo quebrar.

**Anel segmentado** [v4.4] (`AnelProgresso`, `anel-progresso.tsx`) e **barra em pílula** (`BarraProgresso`, `barra-progresso.tsx`). Seção 2.8. O anel é `aria-hidden`; a barra lê pela frase.

**Lista em blocos** [v4.4] (`ListaBlocos`, `ItemBloco`, `lista-blocos.tsx`). Item de raio 16 e 64 px, tile à esquerda, título e apoio, seta ou selo à direita; branco (trabalho) ou no tom do assunto.

**Comemoração** [v4.4] (`Comemoracao`, `comemoracao.tsx`). Seção 2.11. Quem usa decide quando: nunca com alerta na visita, nunca em estado sensível.

**Cabeçalho com cumprimento** [v4.4] (`CabecalhoSaudacao`, `src/components/shell/cabecalho-saudacao.tsx`, com `saudacao()` de `saudacao.ts`). Bloco colo `dourado-claro` com "Bom dia, Talita" pela hora de Brasília, o dia em `h1` e a frase do dia; o trio de cartões-resumo entra como filho. Telas de abertura (Hoje, Início).

**Pergunta em cartão** [v4.4] (`SimNao arranjo="cartao"`, `CampoInstrumento arranjo="cartao"`, `CampoDoChecklist`). Uma pergunta por cartão no checklist: pergunta em 17 px em cima, Sim e Não em pílulas de 56 px dividindo a largura. Sem resposta, branco com sombra; respondida, `areia-clara` sem sombra, com a marca de check `salvia-media` apoiada na borda de cima; com alerta, borda e lavado do estado; família em estado sensível, branco e plano.

**Selo de estado** (`selo`, `--sucesso`, `--aviso`, `--alerta`, `--sensivel`, `--marinho`, `--destaque`, `--contorno`). Pílula de 28 px, 13 px em 600, ícone de 16 quando o estado é de risco. Sempre texto. `--destaque` (dourado com texto marinho) só para "Oferta pendente" e "Quente".

**Faixa de alerta clínico** (`faixa`, `--imediato`, `--prioritario`, `--sensivel`, `--info`, `--sucesso`, `--fixa`). Fundo lavado da cor do estado, borda fina, ícone de 24, código da regra em mono (PU-01), título que diz o achado com o valor ("Febre de 38,2 °C na puérpera"), conduta em frase completa, o que precisa ser registrado antes de fechar, e ações. Imediato traz "Ligar para a supervisão" (link `tel:`, funciona sem dados) e "Registrar acionamento". A faixa aparece logo abaixo do campo que a disparou e fica presa no topo do checklist (`--fixa`) até ser registrada. `role="alert"` só na primeira aparição.

**Indicador de sincronização** (`sinc`, `data-estado="local|enviando|sincronizado"`). Três estados do PRD 15: "Salvo no aparelho" (aviso lavado, ícone de celular), "Enviando 3 respostas" (neutro, ícone subindo), "Sincronizado 11:42" (sucesso). Sem sinal: o estado continua "local" e a faixa `--info` diz "Sem sinal agora. O registro está salvo no aparelho e sobe sozinho quando a conexão voltar." Falha de envio: estado "local" com "Não enviou. Tentamos de novo em 30 s." e botão "Tentar agora". Fica no cabeçalho de toda tela da enfermeira.

**Cabeçalho da família com freio** (`familia-cab`, `botao-freio`, `data-freio="ativo"`). Faixa de areia de ponta a ponta: nome da família em Jost 26, selo do estágio, dia do acompanhamento, bairro, e as quatro datas em grade (DPP "estimativa"; nascimento, alta e início "fato"; "ainda não" tracejado quando não há). O botão "Freio" (mão, contorno ameixa, 44 px) fica no canto superior direito de toda tela da família. Um toque aciona bloqueio total, sem pergunta. Aparece o aviso efêmero "Freio acionado. Nenhuma mensagem automática sai para a Família Teste Aurora." e o cabeçalho inteiro vira ameixa com "Freio em bloqueio total desde 24/09/2026, 09:14. Só contato humano e nominal." Nasce a tarefa "Justificar o freio" para quem acionou. Reverter exige coordenação ou diretoria, com justificativa, numa folha inferior. Data ausente mostra só "ainda não" e uma legenda única para as quatro datas ("A DPP é estimativa. Nascimento, alta e início entram quando acontecem."); com o freio por perda ou intercorrência, as quatro datas continuam visíveis, as que não aconteceram aparecem como "sem registro" e nenhuma frase promete um nascimento (seção 11.8).

**Régua de dias** (`regua`, `regua--12`, `regua--fina`, `data-estado="feito|hoje|pendente|alerta|sensivel"`). Um segmento por dia com "D4" em mono e a data curta. Versão fina (10 px) em linhas de lista e cartões. Mesma família de forma em `blocos` (progresso do checklist) e `semana` (escala da equipe).

**Semana da equipe** (`semana`, `semana__turno`, `data-estado="visita|reservada|backup|oferta|folga"`, vazio = livre). Sete dias, dois turnos por dia. Legenda sempre visível.

**Tabela que vira lista** (`tabela`, `tabela__principal`, `tabela__canto`, `data-rotulo`). No computador, tabela com hairline entre linhas, número à direita em mono, ação da linha no menu de três pontos. Abaixo de 720 px, cada linha vira cartão: nome em destaque, selo no canto, demais campos como "Rótulo valor".

**Fila de transferências** (`fila`, `fila-item`, `data-prioridade="maxima"`, `prazo`). Motivo em frase ("Quer contratar"), família, IG e contexto em uma linha, prazo à direita ("vence em 38 min", aviso quando falta menos de 25% do SLA, alerta quando vence), botão "Assumir" no próprio cartão. Prioridade máxima fica no topo e nunca some por filtro: saúde em fundo alerta lavado; perda e estado sensível em ameixa lavado, com a hora do relato no lugar do prazo, sem relógio e sem vermelho (seção 11.8).

**Conversa** (`conversa`, `bolha--familia`, `bolha--isadora`, `bolha--pessoa`, `evento-conversa`). Família à esquerda em branco; Isadora à direita em areia com "Isadora (IA)" e ícone de robô; pessoa da equipe à direita em marinho com nome. Eventos do sistema centralizados ("Transferida ao comercial às 14:02. A IA não volta a responder nesta conversa.").

**Estado vazio** (`EstadoVazio`). [v4.4] Bloco `areia-clara` de raio 28 com uma ilustração da seção 5.1, título que diz o que é, texto que diz por que está vazio e o que vai aparecer, e a próxima ação como botão. `variante="tracejado"` guarda o contorno tracejado para o lugar de algo que ainda não aconteceu dentro de outro bloco, sem ilustração. Três tipos com texto diferente (dia tranquilo, primeira vez, ainda em construção), na seção 11.7; o texto fala do que a pessoa vai ter, nunca dos componentes da tela.

**Carregando** (`esqueleto`). Blocos no formato do conteúdo que vem. Nunca spinner no meio da tela.

**Aviso efêmero com desfazer** (`aviso-efemero`). Marinho, acima das abas inferiores, 6 s (10 s para o freio, se aprovado). Confirma o que aconteceu e oferece a volta.

**Folha inferior** (`folha`). Para confirmação que protege algo irreversível (assinar, reverter freio, recusar oferta com motivo). No computador vira diálogo centralizado de 520 px. Nunca para tarefa comum.

**Abas inferiores** (`AbasInferiores`). PRD 20.4 por papel, 4 ou 5 itens. [v4.4] Pílula marinho flutuante de 64 px, a 8 px das laterais e 12 px do fundo, ícone 22 e rótulo 13 em todas; a ativa vira pílula creme com ícone e rótulo em marinho. O conteúdo sobe `--altura-abas`. Contador em alerta só para alerta clínico ou transferência vencendo.

**Barra lateral** (`BarraLateral`). Computador, marinho, na coluna de 248 px, símbolo provisório e "Kraamzorg OS" em Jost. [v4.4] Bloco solto 12 px das bordas, raio 28; itens de 44 px em pílula; o ativo vira pílula creme com ícone e texto em marinho. Grupos do PRD 20.4 (Comercial, Operação, Experiência, Gestão, Sistema) com título em frase. Mostra só o que o papel pode abrir.

**Abas de conteúdo** (`abas`). Dentro da ficha: Linha do tempo, Comercial, Conversas, Pré-natal, Atendimento, Financeiro, conforme o papel. Sublinhado dourado de 2 px na ativa. Rolam de lado no celular. [v4.4] Troca de visão curta (duas a quatro opções) usa `AbasPilula`; a ficha passa para `AbasPilula` quando a tela dela for refeita.

### 6.1 Como aplicar o sistema numa tela [v4.4]

Para quem refaz as outras telas. Telas-piloto de referência: checklist (`src/modules/assistencial/checklist/tela-checklist.tsx`), Hoje (`src/app/(enfermeira)/hoje`), Início do comercial (`src/app/(app)/inicio`) e Pipeline (`src/app/(app)/pipeline`).

1. Leia o que a tela responde e para quem. Divida em assuntos: cada assunto é um bloco, e cada bloco tem um título que diz o que é.
2. Tela que abre o dia usa `CabecalhoSaudacao` com o trio de `CartaoResumo` (o primeiro com `destaque`). As outras usam `CabecalhoTela` com o nome da tela.
3. Escolha o tom de cada bloco pelo papel (seção 2.5), não por variedade: agora é dourado, família e guardado é areia, feito é sálvia, tempo é lavanda, pessoas e conversas é argila, trabalho a fazer é branco. No máximo quatro tons por viewport e um bloco forte (marinho) por tela.
4. Título de seção: `TileIcone` quadrado no tom do assunto mais `h2` em Jost 20; contagem numa pílula areia com o número em mono.
5. Número que resume vira `CartaoResumo` com contexto; lista vira `ListaBlocos`; troca de visão vira `AbasPilula`; progresso de uma tarefa real vira `BarraProgresso` ou `AnelProgresso`.
6. Estado vazio ganha a ilustração do catálogo (`ILUSTRACOES`) que corresponde ao caso; ainda em construção usa `TelaEmConstrucao`, que já traz o broto.
7. Família em estado sensível (freio, perda, intercorrência) ou alerta clínico: tire o tom de apoio e a ilustração daquele bloco; fica branco, creme, ameixa ou alerta (seção 11.8). Passe `semTom` onde o componente aceita.
8. Não crie cor, raio ou sombra: só `globals.css`. Não use valor arbitrário de cor. Texto sobre tom médio é sempre marinho.
9. Preserve os seletores dos testes: `rounded-3` continua sendo a classe do cartão, e `data-*` que os testes leem não mudam.
10. Capture em 390 e 1280 px, rode axe (`semViolacaoGrave`) e confira que nada rola de lado.

---

## 7. Microcopy

Regras completas por público, glossário e pares antes e depois em `docs/design/voz.md`.

1. Frase completa, voz ativa, segunda pessoa para a equipe ("Confira e digite de novo"), primeira pessoa do plural para a Kraamzorg falando com a família.
2. Rótulo diz o que é; botão diz o que acontece: "Assinar registro do D4", "Assumir conversa", "Cheguei, iniciar visita". Nada de "OK", "Enviar", "Sim" em confirmação.
3. Erro diz o que aconteceu e o que fazer: "8 bpm parece um dígito a menos. Confira e digite de novo." "Não enviou. Tentamos de novo em 30 s."
4. Offline, sempre: "Sem sinal agora. O registro está salvo no aparelho e sobe sozinho quando a conexão voltar."
5. Alerta clínico: código, achado com valor, conduta. "PU-01 · Febre de 38,2 °C na puérpera. Acione a supervisão médica agora e oriente a família a procurar atendimento de emergência."
6. Vazio ensina: "Nenhuma visita marcada para hoje. Quando a coordenação oferecer uma família, a oferta aparece aqui para você aceitar ou recusar."
7. Sucesso breve e sem exclamação: "Assinado às 11:42. Sobe quando houver sinal."
8. Estado sensível sem eufemismo e sem alarme: "Freio em bloqueio total. Só contato humano, pelo nome." Nunca prazo vencido nem relógio ao lado de uma perda (seção 11.8).
9. Formatos: R$ 4.200 (sem centavos quando zero), 24/09/2026, 11:42, 38s2d, 36,9 °C, 3.240 g, D4 de 6. Fuso de Brasília.
10. Proibido em qualquer texto: travessão e meia-risca (use vírgula, ponto, dois-pontos ou parênteses), "mãezinha", "mamãe", "papai", "Ops", jargão técnico para a família ("sincronização", "handoff", "SLA" ficam só para a equipe e, mesmo aí, "prazo" e "transferência" são preferidos), emoji em alerta.
11. Nome de paciente nunca em título de aba do navegador, URL ou notificação push visível na tela bloqueada: a notificação diz "Alerta imediato numa família atribuída a você".

---

## 8. Proibido

- Qualquer cor, fonte, raio ou sombra fora de `tokens.css` (e, no produto, fora do `globals.css`).
- Texto sobre dourado que não seja marinho. Dourado como texto no claro.
- Vermelho (`alerta`) para luto, perda ou freio.
- Pré-preencher resposta clínica, botão "tudo normal", copiar ficha de outra família, colar bloco inteiro de outro dia.
- Modal para tarefa comum; confirmação sem nome da ação.
- Ícone que não seja Lucide; emoji como ícone; ícone sem texto significando estado. Ilustração que não seja do catálogo da seção 5.1.
- Rótulo em caixa alta, kicker acima de título, numeração decorativa de seção.
- KPI sem comparação, anel ou barra decorativa (sem tarefa real por trás), barra padrão de biblioteca.
- Dado real de qualquer paciente, médico ou profissional em protótipo, seed ou captura.
- Relógio, contagem regressiva, vermelho ou ação comercial na tela de uma família em luto ou em intercorrência (seção 11.8).
- Coração, bebê desenhado, confete, emoji, "parabéns" ou exclamação ditos pela interface; foto de banco e imagem gerada (seção 11.6). [v4.4] As ilustrações da seção 5.1 são a única imagem desenhada, e só em estado vazio e na comemoração.
- [v4.4] Tom de apoio para dizer estado; tom de apoio, ilustração ou movimento em freio, perda, intercorrência ou alerta clínico.
- Estado vazio que descreve os componentes da tela em vez do que a pessoa vai ter.

---

## 9. Chutes e substituições

- Jost no lugar de Codec Pro; nenhuma TT Drugs (só no logo, que é imagem). Métrica: Jost é um pouco mais estreita; títulos podem ganhar uma linha a menos quando Codec Pro entrar.
- Logo e símbolo em PNG provisório (`assets/logo-provisorio.png`, `assets/simbolo-provisorio.png`). O símbolo dourado sobre marinho funciona na lateral; o logo completo marinho só vai sobre creme.
- Nove derivados de cor por mistura (seção 4) precisam entrar no PRD 20.2 e no `globals.css`.
- Ícones Lucide escolhidos por esta direção (a Taste prefere outra biblioteca; o briefing pediu Lucide).
- Nomes fictícios: famílias "Família Teste Aurora" a "Família Teste Horizonte", enfermeiras Talita Moreno, Rosana Vieira, Priscila Andrade, Marta Quintela e Joana Bastos, coordenação Beatriz Falcão, comercial Otávio Lemos.
- Registro das direções usadas (`claude/interface-direcoes-usadas.md`) não existe nesta sessão: registrar "25/09/2026 · Kraamzorg OS · Print-tech papel com dado (Operate) · régua de dias · blocos segmentados".
- [v4.4] Registro da direção nova, pelo mesmo motivo: "30/09/2026, Kraamzorg OS, Colo (suave estruturado em Operate), dispositivo: bloco de base curva e encaixe, forma de gráfico: anel segmentado e barra em pílula".
- [v4.4] O protótipo estático (`docs/prototipo`) recebeu só os tokens novos em `tokens.css`; as telas dele continuam na direção anterior e servem de referência de estrutura, não de visual.
- [v4.4] A vitalidade das telas de abertura depende do primeiro nome da pessoa; no modo demonstração o nome dos perfis de teste é "Perfil Teste ..." e a tela diz "Bom dia, Perfil".

## 10. Verificação feita

- [v4.4] Direção "Colo": `lint_slop.py` da interface-2026 em `src/components`, telas-piloto e `globals.css`: nenhum achado. Tons medidos pela fórmula WCAG 2.x (tabela da seção 4). Capturas 390 x 844 e 1280 x 800 das telas-piloto, antes e depois, fora do repositório; nenhuma rola de lado. Axe e testes de ponta a ponta do checklist, do pipeline, da navegação, do acolhimento e do design system: resultado em `docs/sessoes/colo-visual-vivo.md`.

- `lint_slop.py` em `docs/prototipo`: seis achados ALTA, todos a declaração de Inter em `tokens.css`, justificada na seção 4. Nenhum travessão, emoji, gradiente, `outline: none` ou raio fora da escala.
- Kit capturado em 390 x 844 e 1280 x 800, duas rodadas. Corrigidos na segunda: botão do aviso efêmero espremido, régua de 12 dias apertada no celular (virou duas semanas), frases inteiras em mono (prazo, "D4 de 6", rótulos da lista), cartão tocável sem espaçamento interno.
- O que precisa de olho humano: legibilidade ao sol e com brilho baixo num aparelho real; alvo de 52 px com luva; leitura de tela do seletor sim ou não no VoiceOver e no TalkBack.

---

## 11. Acolhimento

Pedido do dono do projeto para esta camada: como o assunto é gestação e pós-parto, a linguagem visual e a de fala precisam ser o mais aconchegantes e acolhedoras possível, no nível de excelência, sem nada genérico. Esta seção vale por cima da Caderneta de visita e não troca nenhum token: cor, fonte, raio, sombra e espaço continuam os da seção 4. Voz, microcopy e os pares antes e depois estão em `docs/design/voz.md`.

Leitura de contexto. O arquivo de clima da interface-2026 continua ausente; a direção sai por princípio. O launcher da Impeccable rodou nesta rodada, mas procura PRODUCT.md e DESIGN.md na raiz e não os achou em `docs/design`; os dois foram lidos direto. O app foi rodado em modo demonstração em 29/09/2026 e capturado em 390 e 1280 px (34 rotas nos seis papéis, mais ficha e conversa de uma família com freio). Portal da família e formulário público ainda não existem (`(familia)` e `(publico)` só têm README): o que está aqui para eles vale quando o P30, o P47 e o P49 forem construídos.

### 11.1 Onde o sistema esfria hoje

> DEGRADED: contexto único (sem subagentes nesta sessão). Avaliação A (capturas e código) terminou antes da varredura B: `impeccable detect` em `src` achou 1 aviso, falso positivo (sublinhado da aba do pipeline); `lint_slop.py` da interface-2026 achou só as guardas contra travessão e o emoji permitido nos textos de mensagem (PRD 11.6).

**Veredito.** A mecânica está boa: contraste, foco, alvo de toque, tokens, régua de dias, faixa de alerta clínico e freio passam, e o detector não acha vício de template. O que esfria a experiência está nas palavras, na ordem do que aparece e no jeito de tratar os momentos difíceis, e nenhum detector olha para isso. No teste dos trinta segundos da interface-2026, o Início do comercial reprova em dois itens: trocando fonte e acento vira qualquer CRM, e nenhuma forma da tela nasce do sistema (a régua de dias não aparece ali).

| #   | Tela                                                                                                                               | O que se vê                                                                                                                                                                                                    | Por que esfria                                                                                                                                                                                                                                                                   |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Conversa de uma família em luto (Família Teste Bruma, `/conversas/[id]`)                                                           | "A Isadora está conduzindo esta conversa", "Perda gestacional, venceu há 35 min", "Marcar como resolvida", "Marcar como não lead" e, no cabeçalho ameixa, "Nascimento: ainda não, vira fato quando acontecer". | É a tela mais grave do sistema. O relato "Infelizmente perdi o bebê essa semana" divide a página com uma contagem vencida, uma ação de triagem comercial e a promessa de um nascimento que não vai acontecer. A faixa também está errada: com o freio, a Isadora está desligada. |
| 2   | Fila de transferências (Início do comercial e Transferências)                                                                      | Cartão de perda em ameixa lavado, com o prazo "venceu há 31 min" em `alerta` e o texto "Relato de perda gestacional. Freio em bloqueio total. Contato humano e nominal."                                       | Vermelho encostado em luto, contra a seção 8. O luto aparece como prazo operacional, num texto em estilo de telegrama.                                                                                                                                                           |
| 3   | Telas ainda sem módulo (Hoje, Famílias, Alertas e Perfil da enfermeira; Início, Radar, Agenda e Equipe da coordenação; Financeiro) | "As visitas de hoje vão aparecer aqui. A próxima visita com o endereço e a régua de dias, o botão para iniciar a visita e as fichas pendentes, em ordem de horário."                                           | É a especificação lida em voz alta. Fala de componente ("a régua de dias", "o botão") em vez do que a pessoa vai ter.                                                                                                                                                            |
| 4   | Cabeçalho da família (ficha e conversa)                                                                                            | "ainda não" em pílula tracejada e "vira fato quando acontecer" em itálico, três vezes.                                                                                                                         | Linguagem de modelo de dados. São doze palavras de sistema logo abaixo do nome da família.                                                                                                                                                                                       |
| 5   | Título das telas de trabalho                                                                                                       | "Início", "Conversas", "Tarefas" em Jost 40 px; a frase útil ("Terça, 29/09. Três transferências abertas e quatro tarefas com prazo hoje.") em 14 px cinza.                                                    | O maior texto da tela repete a aba. O dia e o que espera por você ficam pequenos.                                                                                                                                                                                                |
| 6   | Conversas (lista)                                                                                                                  | Três ações por cartão; "Marcar como não lead" em todo cartão de família.                                                                                                                                       | Triagem comercial encostada no nome de uma gestante, com o mesmo peso da ação principal.                                                                                                                                                                                         |
| 7   | Configurações da coordenação                                                                                                       | "(PRD 11.2)" no texto de ajuda; coluna "Mensagem enviada" mostrando a chave `alerta_saude`.                                                                                                                    | Número de seção de documento interno e nome de variável na tela de quem cuida da saúde das famílias.                                                                                                                                                                             |
| 8   | Números do mês da Isadora                                                                                                          | Grade de sete cartões de KPI; "Conversão de leads 50%" calculado sobre 6 leads; o sétimo cartão sozinho na linha.                                                                                              | Grade de KPI está na lista de proibidos (seção 8); porcentagem sobre amostra pequena exagera; nenhum número diz se está bem ou mal diante da meta.                                                                                                                               |
| 9   | Pipeline no celular                                                                                                                | Sete campos de filtro antes da primeira família; a página mede 395 px numa tela de 390.                                                                                                                        | A primeira coisa que o comercial vê é um formulário, e a página escorrega de lado.                                                                                                                                                                                               |
| 10  | Evolução em PDF                                                                                                                    | Medidas em Inter, título de seção em 14 px cinza, parágrafos corridos.                                                                                                                                         | Lê como formulário preenchido. O médico não acha em um minuto o que importa.                                                                                                                                                                                                     |

**Picos da experiência.** Os picos de carga do produto são o alerta clínico, a notícia de perda, a assinatura, o fechamento do contrato e o último dia do acompanhamento. O alerta clínico está bem resolvido (achado com valor, conduta, ligação em um toque). A perda recebe a gramática da venda: prazo, triagem, estágio. O fim de um acompanhamento (D6 ou D12 assinado) não tem momento desenhado, e é ele que a enfermeira e a família lembram (regra do pico e do fim).

**O que já acolhe e fica.**

- A faixa de alerta clínico: achado com o valor, conduta em frase completa, "Ligar para a supervisão" em um toque.
- "Justificar depois é normal; o que importava era parar as mensagens automáticas." (faixa de justificar o freio): tira a culpa de quem acionou.
- "Aqui há dados de saúde de gestantes e bebês, e todo acesso fica registrado." (entrar): diz o porquê em linguagem de gente.
- "Escreva você, pelo nome" no campo de resposta de uma família com freio.
- "Edite à vontade. O WhatsApp abre com este texto; nada sai antes de você tocar em enviar lá." (texto sugerido da tarefa): devolve o controle a quem envia.

### 11.2 Princípios

1. **Chamar pelo nome.** A família aparece pelo nome da família; a pessoa, pelo primeiro nome ("Mensagem para Marina"); o bebê, pelo nome assim que ele existe no cadastro; a enfermeira e quem assumiu uma conversa, pelo nome ("Otávio assumiu às 14:05"). "Lead", "contato" e "usuário" ficam para número agregado. Onde nome de paciente não pode aparecer (aba do navegador, URL, notificação na tela bloqueada, assunto de e-mail, nome de arquivo), vale a seção 7.
2. **Situar no tempo da família.** Toda família está num ponto de uma linha que vai da gestação ao relatório final: 32s4d, "D4 de 6", "nasceu em 18/09", "alta em 20/09". Esse ponto aparece junto do nome em toda lista e todo cabeçalho, porque é ele que diz à equipe como falar com aquela família agora.
3. **Dizer o que acontece depois.** Todo estado termina no próximo passo e em quem faz. Sucesso diz a consequência ("Sobe quando houver sinal"); erro diz o que está a salvo e o que fazer; vazio diz quando algo vai aparecer ali.
4. **Poupar quem cuida.** A enfermeira tem uma mão livre, o comercial responde entre consultas, a coordenação recebe alerta a qualquer hora. Com a equipe, acolher quer dizer tirar trabalho: nada repetido na mesma tela, nenhuma confirmação à toa, nenhuma frase que culpe, e a certeza escrita de que o que foi feito está guardado.
5. **Baixar o volume quando a notícia é difícil.** Em perda, intercorrência e alerta clínico, a tela perde elementos: sai a contagem regressiva, sai a ação comercial, sai a cor que não carrega significado. Ficam o que aconteceu, a próxima ação humana e quem a faz (11.8).
6. **Nenhum calor fingido.** Coração, bebê desenhado, confete, "parabéns" dito pelo sistema, exclamação e adjetivo de entusiasmo ficam fora da interface. O carinho que a família sente vem da pessoa da equipe e dos textos aprovados em `mensagem_modelo`; a interface ajuda essa pessoa a acertar o tom, sem falar por cima dela.

Âncora. O símbolo da marca desenha um colo: a curva dourada segura as duas figuras. A interface herda dele só a ordem do gesto, sem redesenhar nem citar o desenho. Primeiro mostra que a família e o trabalho estão seguros (quem é, em que dia está, o que já foi salvo), depois pede a próxima ação.

### 11.3 Superfície e cor

Cada token ganha um papel de acolhimento. Nenhuma cor nova, nenhum rosa, azul-bebê, gradiente ou textura: o creme já é o papel. [v4.4] Os tons de apoio (seção 4) acrescentam blocos claros derivados da marca, com papel fixo (seção 2.5); eles não entram na tela de uma família em estado sensível, onde esta tabela vale sozinha.

| Token               | Papel no acolhimento                                                                                                     | Nunca                                                                  |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `creme`             | Papel de toda tela, formulário e documento.                                                                              | Atrás de texto de estado.                                              |
| `areia`             | O lugar da família: cabeçalho da família, painel de pessoas, fala da Isadora, texto sugerido antes de ir para a família. | Erro, aviso de sistema, cartão comercial, bloco de números.            |
| `branco`            | O lugar do trabalho: cartão, campo, folha.                                                                               |                                                                        |
| `marinho`           | Tinta e ação primária.                                                                                                   |                                                                        |
| `dourado`           | "Agora": hoje, ativo, atual. Uma vez por tela.                                                                           | Celebração; destaque de venda fora de "Quente" e "Oferta pendente".    |
| `sensivel` (ameixa) | Pausa, perda, intercorrência, freio.                                                                                     | Relógio, contagem regressiva, botão de urgência.                       |
| `alerta`            | Urgência clínica e erro operacional.                                                                                     | Qualquer elemento na tela de uma família em luto ou em intercorrência. |
| `sucesso`           | Concluído, sincronizado, assinado.                                                                                       | Festa.                                                                 |
| `aviso`             | Prazo perto, pendente.                                                                                                   | Momento sensível.                                                      |

Medido com `validate_palette.js` (skill dataviz) sobre creme: `alerta` e `sensivel` ficam a ΔE 13,7 na visão normal, abaixo do piso de 15, e a 10,5 em protanopia; `sucesso` e `alerta` ficam a 4,7 em deuteranopia. Por isso luto e urgência se distinguem pela forma e pela palavra, além do matiz. Ameixa leva o octógono de pausa, borda contínua fina, nenhum relógio e nenhum botão de urgência. Alerta leva a sirene, a conduta e "Ligar para a supervisão". Sincronizado e erro sempre com ícone e palavra.

Fundo lavado só atrás do bloco que tem o estado, nunca atrás da tela inteira. A exceção continua a da seção 6: o cabeçalho da família inteiro em ameixa com o freio puxado.

### 11.4 Tipografia

- Jost carrega a frase humana da tela: o nome da família, o dia ("Hoje, quinta 24/09"), a saudação nas superfícies da família. Nas telas de abertura (Hoje da enfermeira e Início de cada papel), o `t-display` é o dia, e a frase de estado vem logo abaixo em `text-3` marinho, nunca em cinza pequeno; o nome da aba fica na aba e no `<title>`. As outras telas mantêm o nome como título, com a frase de apoio em `texto-2`.
- Inter para pergunta, ação e explicação. Pergunta de formulário em 500.
- IBM Plex Mono só para medida: data, hora, IG, D4, R$, código de regra. Nunca nome de pessoa, nunca frase.
- Itálico só nas marcas "estimativa" e "fato" das quatro datas. Frase de sistema em itálico sai.
- Superfícies da família: nada abaixo de 16 px, pergunta em `text-3` (17 px) com peso 500, parágrafo com no máximo `container-leitura` (68ch). Proposta de token para parágrafo de leitura na 11.11.
- Maiúscula só no início da frase e em nome próprio, como no resto do sistema.

### 11.5 Ritmo, espaço e forma

- **Ordem humana.** O que a família disse ou viveu vem antes do estado do sistema, que vem antes das ações. Na conversa, no celular, a última mensagem da família aparece na primeira dobra; o resumo da Isadora vira uma linha ("Resumo da Isadora: Pinheiros, 9s1d, DPP 03/05/2027") que abre ao tocar.
- **Uma ação por cartão.** Em lista (Conversas, Pipeline, Tarefas, Transferências) o cartão mostra a ação principal e, quando o fluxo pede, a confirmação dela ("Abrir no WhatsApp" e "Enviei"); as outras vão para o menu de três pontos com nome acessível ("Mais ações para Família Teste Aurora").
- **Espaço em volta do que é sensível.** Bloco sensível tem 32 px acima e abaixo e, no computador, nenhum cartão comercial ao lado na mesma linha.
- **Filtro recolhido.** No celular, busca e um botão "Filtros" com a contagem dos ativos, que abre a folha inferior. A lista começa na primeira dobra.
- **Forma.** Os quatro raios da seção 4 (6, 16, 28 e pílula, v4.4). Tracejado quer dizer "ainda não" ou "confirme" e por isso nunca aparece em luto, onde nada está pendente. Superfícies da família usam `raio-3` nos contêineres e pílula nas ações.
- **Movimento.** [v4.4] Uma animação de celebração só, a do checklist completo (seção 2.11), e nunca numa família em estado sensível nem numa visita com alerta. A faixa de alerta entra uma vez (220 ms) e para. Nada pulsa, nada pisca.

### 11.6 Ícones e imagem

Lucide com traço 1,75, como na seção 5. Ícone serve para identificar.

- `baby` só onde separa o bebê da puérpera (abas do checklist, linha da pessoa). `heart`, `sparkles`, `party-popper`, `smile`, `gift` e `star` ficam fora.
- Perda e intercorrência usam `octagon-pause`, o mesmo do freio. `siren`, `triangle-alert`, `clock-alert` e `hourglass` nunca aparecem numa família em luto.
- [v4.4] Estado vazio com uma das ilustrações da seção 5.1 (decisão do dono do projeto); nunca em momento sensível.

Imagem: só os arquivos de `/public/brand` (logo e símbolo provisórios) ou nada.

- O logo entra em: entrar, topo do formulário público da família (uma vez), cabeçalho do PDF, portal da família (fase 3). O símbolo entra na barra lateral e no ícone do app.
- Fora de: estado vazio, tela de sucesso, cartão, e-mail (que é texto puro). O estado vazio leva a ilustração da seção 5.1, não o logo.
- Foto: nenhuma nesta fase. Ilustração: só as da seção 5.1 [v4.4]. Nada de banco de imagem e nada gerado por IA (pé de bebê na palma da mão, barriga em contraluz dourado, mãos em coração): é o visual que a anti-ai-slop-visual aponta como padrão de IA e que a família reconhece como anúncio. Se um dia entrar foto, ela é da Kraamzorg, real, com autorização de imagem registrada, e a decisão é do cliente.

### 11.7 Estados

**Vazio**, em três tipos, escrito para quem não conhece o sistema:

| Tipo                | Quando                                           | Exemplo                                                                                                                                            |
| :------------------ | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dia tranquilo       | Não há nada a fazer.                             | "Nenhum alerta aberto. Quando um valor do checklist passar do limite, o alerta aparece aqui e na tela da visita."                                  |
| Primeira vez        | A pessoa ainda não tem nada ali.                 | "Você ainda não tem famílias atribuídas. Quando a coordenação oferecer uma, a oferta aparece em Hoje para você aceitar ou recusar."                |
| Ainda em construção | A rota existe na navegação e o módulo ainda não. | "Esta parte ainda está em construção. Aqui você vai ver as visitas do dia, com endereço e horário." Em produção, item sem módulo sai da navegação. |

Filtro sem resultado diz qual filtro está ligado e oferece "Limpar filtros".

**Carregando.** Esqueleto no formato do conteúdo. Texto só se passar de 2 s, com o nome da operação ("Carregando as visitas de hoje"). No portal da enfermeira, nenhum carregamento bloqueia um campo já aberto.

**Erro.** O título diz a ação que falhou ("O aviso ao grupo não saiu", "O código não confere"); o texto diz o que está a salvo e o que fazer. "Não deu certo", "Algo não saiu como esperado" e "Erro" sozinhos saem. Erro não culpa: "8 bpm parece um dígito a menos" no lugar de "valor inválido".

**Sucesso.** Uma linha, sem exclamação: o fato e a consequência. "Assinado às 11:42. Sobe quando houver sinal." Marcos da família (nascimento registrado, alta registrada, contrato assinado, último dia assinado) entram na linha do tempo com a data em mono e a consequência operacional ("Nascimento registrado em 18/09/2026. A designação da enfermeira passa a ser urgente.").

**Checklist completo** [v4.4]. Quando tudo o que é obrigatório está respondido e a visita não teve alerta, o resumo mostra a comemoração da seção 2.11 ("Checklist do D4 completo. Falta só a sua assinatura."), com o botão de assinar dentro dela. Com alerta ou em estado sensível, fica a linha "Tudo o que é obrigatório está respondido."

**Fim do acompanhamento.** Quando o último dia é assinado, o cartão da família fecha com a régua completa em marinho e uma linha: "Acompanhamento da Família Teste Aurora concluído em 26/09/2026. A evolução final vai para a revisão da coordenação." Sem agradecimento automático e sem festa: o reconhecimento à enfermeira vem da coordenação, pessoa para pessoa.

### 11.8 Momentos sensíveis

| Momento                                                                       | Cor e forma                                                                     | O que some da tela                                                                                                                                                                                                  | O que fica                                                                                                                                                                                                                                                  |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perda gestacional ou neonatal (freio em bloqueio total ou encerrado sensível) | Ameixa, octógono de pausa, borda contínua.                                      | Prazo e contagem ("vence", "venceu"), ação comercial (mover estágio, texto sugerido, marcar como outro assunto, faixa da Isadora), IG, régua da gestação, a promessa de data futura (pílula tracejada "ainda não"). | Nome da família e da pessoa; as quatro datas (PRD 20.4), com "sem registro" nas que não aconteceram; o que ela escreveu, uma vez, na conversa; o que o sistema já fez ("Nenhuma mensagem automática sai para esta família"); quem faz o contato, pelo nome. |
| Intercorrência ou internação (mãe ou bebê)                                    | Ameixa, octógono de pausa.                                                      | Ação comercial, régua automática, texto sugerido.                                                                                                                                                                   | Quem da equipe acompanha, o último contato, a próxima ação.                                                                                                                                                                                                 |
| Alerta clínico imediato                                                       | `alerta` só na faixa; o resto da tela quieto.                                   | Nada do registro; saem os atalhos que tirem a enfermeira da visita antes de registrar o acionamento.                                                                                                                | Achado com valor, conduta aprovada, "Ligar para a supervisão", o que falta registrar.                                                                                                                                                                       |
| Saúde mental materna                                                          | `alerta` na faixa para quem atende; na lista, "Ocorrência privada" sem detalhe. | Detalhe na lista, prévia da conversa.                                                                                                                                                                               | Quem pode ver, a próxima ação. A conduta é a aprovada (PRD 9.3); a interface não parafraseia.                                                                                                                                                               |
| Família em estado sensível que volta a escrever                               | Ameixa na conversa.                                                             | Texto sugerido, atalhos de modelo.                                                                                                                                                                                  | A mensagem dela e "Responda você, pelo nome".                                                                                                                                                                                                               |
| Nota baixa na pesquisa                                                        | Neutro; ocorrência privada da coordenação.                                      | Qualquer mensagem automática (PRD 23.2 já tira).                                                                                                                                                                    | O contato pessoal da coordenação.                                                                                                                                                                                                                           |

Regras:

1. Em momento sensível, prazo vira a hora do acontecimento: "recebida às 13:18", em `texto-2`. O atraso continua visível para quem precisa agir ("ainda sem contato da equipe"), com o octógono, sem vermelho e sem relógio. A fila continua ordenada pelo prazo, e prioridade máxima fica sempre no topo.
2. Uma ação principal, nomeando a pessoa quando der: "Ligar para Camila", "Escrever para Camila". "Marcar como resolvida" vira "Registrar o contato com a família" [confirmar: Leonardo e Edilaine].
3. O cabeçalho ameixa depois de uma perda mantém as quatro datas visíveis (PRD 20.4): as que existem, como fato; as outras, como "sem registro", em texto simples, sem pílula tracejada e sem legenda de futuro. "vira fato quando acontecer" nunca aparece nele.
4. O texto automático que a família recebeu aparece na conversa com o rótulo "Resposta automática, texto aprovado", sem destaque. Foi o sistema quem falou, e a equipe precisa saber exatamente o quê.
5. Enfermeira e coordenação veem o estado sensível em toda tela da família, inclusive no portal da enfermeira, com o selo e a frase do estado.

### 11.9 Por superfície

**Telas da equipe (comercial, coordenação, diretoria, financeiro).**

- Abrem pelo dia e pela frase de estado (11.4).
- Cartão de lista: nome da família, tempo da família (IG ou "D4 de 6") e uma ação.
- Palavras de venda (lead, frio, morno, quente, ganho) só nas telas comerciais e em número agregado; nunca na visão da enfermeira e nunca ao lado de uma família em estado sensível.
- Linha da família (proposta, P2 na lista de mudanças): nos cartões do pipeline e no cabeçalho da ficha, uma régua fina da gestação herdada da régua de dias. Dez blocos de quatro semanas, cheios em marinho até a semana atual, os seguintes tracejados, e a DPP em mono com "estimativa". Na ficha, o bloco atual ganha a borda dourada; nas listas fica em marinho cheio, para não repetir o acento. Depois do nascimento, a mesma linha passa a mostrar D1 a Dn. Some em estado sensível. Nenhum token novo.

**Portal da enfermeira.**

- Hoje abre com o dia, o indicador de sincronização e a próxima visita (seção 2, primeira dobra).
- Fala curta, clínica e no imperativo gentil ("Confira", "Ligue"), com número e unidade.
- A frase mais acolhedora do portal é a que diz que nada se perdeu. "Salvo no aparelho" aparece em todo campo respondido, sem pedir atenção.
- Nenhum elogio automático ("Ótimo trabalho!"). A visita termina em "Assinado às 11:42. Sobe quando houver sinal." e na próxima visita.

**Formulário público da família (contrato no P30, captação no P47, pesquisa).**

- Creme de fundo, logo no topo uma vez, coluna única de até `container-leitura`, sem barra lateral.
- Abre dizendo quem pediu e por quê, com a duração: "Oi, Marina. O Leonardo pediu estes dados para preparar o contrato de vocês. Leva uns 3 minutos." Nome de quem pede, duração e texto vêm de `mensagem_modelo` e `parametro`.
- Mais de seis campos viram etapas, com "Etapa 2 de 3" em blocos (a mesma forma da régua).
- Opcional marcado com "(opcional)"; nenhum asterisco vermelho.
- Campo sensível explica em uma linha por que é pedido e onde fica ("Vai no contrato. Fica guardado com a equipe da Kraamzorg.") [confirmar: jurídico].
- Erro gentil e específico; o que foi digitado nunca some.
- A última tela diz o que acontece depois, por qual canal e quando.
- Sem temporizador, sem pop-up, sem "últimas vagas" (palavra que a marca evita, PRD 11.6).
- Pesquisa: uma pergunta por tela, escala 0 a 10 sem verde para vermelho (o componente já faz assim), texto livre com "Se quiser, conte mais".

**PDF (evolução aos médicos, contrato).**

- No PDF, acolher quer dizer respeitar o tempo do médico e a família: mãe e bebê pelo nome no corpo do documento (nunca no nome do arquivo nem nos metadados), período e plano na primeira linha, quem assina (nome e COREN) visível na primeira página [confirmar: Edilaine].
- Título de seção em Jost 500 marinho; medidas em IBM Plex Mono tabular; curva de peso em tabela de duas colunas (data e valor) alinhada, porque o médico lê o valor exato.
- Se um gráfico de peso entrar: uma linha marinho de 2 px, pontos de 8 px, o peso de nascimento como referência tracejada em `marinho-50`, nenhum vermelho para a perda esperada dos primeiros dias. Cor de estado só no dia em que uma regra de `regra_alerta` disparou.
- Rodapé LGPD como está. Sem marca d'água, sem ícone, sem caixa colorida.

**E-mail.**

- Texto puro, vindo de `mensagem_modelo`. Assunto sem nome de paciente e dizendo o que é ("Evolução de enfermagem, período de 05/09 a 11/09/2026"). Primeira linha: o que é e o que fazer. Assinatura com pessoa, papel e "Kraamzorg Brasil". Sem imagem, sem banner, sem modelo de marketing.

### 11.10 Dados e painéis

Com a skill dataviz e a interface-2026:

- **Painel que fala.** As cinco perguntas da diretoria e os números da Isadora respondem em frase, com o número em mono e a comparação ao lado: "Vendas: 4 contratos nesta semana, 1 a mais que na anterior." Uma linha por pergunta, nenhuma grade de KPI. Com meta, a palavra de estado vem com ícone ("abaixo da meta").
- **Amostra pequena.** Abaixo de um limiar guardado em `parametro` (proposta: 20 casos [confirmar: Leonardo]), a contagem vem antes da porcentagem ("3 de 6 leads, 50%"), com a nota "amostra pequena".
- **Forma-assinatura.** Blocos segmentados (régua) para meta, capacidade e prazo; hachura para o que é estimativa. Nenhuma barra padrão de biblioteca, nenhum anel de progresso.
- **Cor pelo dado, com parcimônia.** `sucesso`, `aviso` e `alerta` só quando uma regra diz que o número saiu do esperado. `sensivel` nunca entra em gráfico.
- **Ninguém vira ranking.** Nenhuma família, bebê ou enfermeira ordenada por número na tela. Ocupação é por praça.
- **O dado do bebê não assusta.** Perda de peso dentro do esperado aparece neutra; cor só quando `regra_alerta` dispara.

### 11.11 Proposta de token (não usar até aprovação)

`text-leitura`: 17 px (1,0625rem), entrelinha 1,55, Inter 400, para parágrafo lido pela família no formulário público e no portal. O `text-3` tem o mesmo tamanho com entrelinha 1,35, curta para parágrafo. Enquanto o token não entrar no PRD 20.2 e no `globals.css`, parágrafo da família usa `corpo` (16/1,5).

### 11.12 O que esta camada recusa

- Coração, bebê desenhado, cegonha, confete, estrela e emoji na interface. Emoji fica só nos textos aprovados de mensagem, no limite do PRD 11.6.
- Rosa, azul-bebê, gradiente, textura, foto de banco e imagem gerada. [v4.4] Os tons de apoio e as ilustrações da casa são a exceção decidida, com as regras da seção 2 e do PRD 20.2.
- "Parabéns", "Que alegria", "Ótimo trabalho", exclamação e adjetivo de entusiasmo ditos pela interface.
- Relógio, contagem regressiva e vermelho em qualquer tela de família em luto ou em intercorrência.
- Ação comercial visível ao lado de relato de saúde, perda ou intercorrência.
- Especificação lida em voz alta como estado vazio.
- Jargão de sistema na tela: "nominal", "vira fato", "handoff", "SLA", "ingestão", "reindexar", nome de variável, número de seção do PRD.
- Diminutivo carinhoso e intimidade forçada: "mãezinha", "mamãe", "papai", "bebezinho", "amiga", "princesa".
- Slogan e frase de efeito dentro do produto.

### 11.13 Verificação feita e chutes

- Capturas 390 x 844 e 1280 x 800 das 34 rotas em modo demonstração, mais ficha e conversa da Família Teste Bruma (freio em bloqueio total), guardadas fora do repositório (scratchpad da sessão).
- `validate_palette.js` (dataviz) nos estados sobre creme: `alerta` e `sensivel` a 13,7 (visão normal); `sucesso` e `alerta` a 4,7 (deuteranopia). A regra de forma e palavra da 11.3 e da 11.8 sai daí.
- `impeccable detect` em `src`: 1 aviso, falso positivo. `lint_slop.py` em `src`: só guardas contra travessão e emoji permitido em texto de mensagem.
- Chutes, na lista de pendências: "Não seguiu" no lugar de "Perdido" e "Outro assunto" no lugar de "Não lead" são propostas de rótulo, sem mudar enum [confirmar: Leonardo]; quem assina na primeira página do PDF [confirmar: Edilaine]; linha de privacidade do formulário [confirmar: jurídico]; a linha da família é proposta da direção, sem pedido do cliente.
- Precisa de olho humano: ler a conversa de uma família em luto junto com a coordenação clínica antes de fechar o texto dela; testar o formulário público com uma gestante de verdade (fora do sistema, nenhum dado no repositório) quando ele existir.
