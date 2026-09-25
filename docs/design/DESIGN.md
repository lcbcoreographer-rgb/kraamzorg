# DESIGN.md · Kraamzorg OS

Direção visual e de experiência do Kraamzorg OS. Vale para todas as telas do app (enfermeira, comercial, coordenação, diretoria, financeiro). Tokens em `docs/prototipo/assets/tokens.css`; componentes em `docs/prototipo/assets/base.css`; vitrine em `docs/prototipo/_kit.html`. No produto, a fonte de tokens continua sendo `src/app/globals.css` (PRD 20.1): este arquivo diz o que entra lá.

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

## 2. Direção: Caderneta de visita

**Família estética.** Print-tech, papel com dado (interface-2026, família 2), em registro contido para app de trabalho (Impeccable, modo Operate, cor Restrained). Descartadas por escrito: Suave orgânico (a leitura óbvia de "saúde materna", raio alto e blob, cansa em uso diário e dilui o alerta clínico); Instrumento de precisão em quase-preto (contradiz a marca creme e o quarto claro de dia); Editorial impresso com serifa (bonito para a apresentação, lento para formulário e proibido como padrão pela Taste); Vasto e quieto (espaço demais para uma tela de polegar).

**Termos concretos.** Fundo creme de papel; régua de dias D1 a D12 em pílulas; dado em mono tabular (datas, IG, temperatura, códigos PU-01); rótulo em frase, nunca em caixa alta; um acento dourado por tela, só para "hoje", "ativo" e "atual"; cor semântica só quando há estado clínico ou operacional; hachura para o que é provável e ainda não é fato; tracejado para o que ainda não aconteceu; cabeçalho da família como faixa de areia que vira ameixa com o freio.

**Referência que ancora.** A própria planilha do DOC 2, com os dias lado a lado, e a caderneta de saúde que toda família brasileira leva para casa: papel, colunas por data, anotação curta, carimbo de quem atendeu. A tela é a caderneta da visita de hoje, não um painel.

**Intenção em uma frase.** A enfermeira abre, vê em que dia está, responde com o polegar e só vê cor quando algo pede ação.

**Dispositivos de repertório escolhidos.**

1. _Régua de dias_ (forma assinatura, derivada de "progresso em blocos segmentados"): toda noção de tempo do produto herda dela. Acompanhamento D1 a D12, progresso dos blocos do checklist, semana da equipe em turnos, prazo de SLA. Feito em marinho cheio, hoje com borda dourada, ficha pendente hachurada, futuro tracejado, alerta em alerta, sensível em ameixa.
2. _Estado desenhado, não omitido_ (repertório 1.4): o que falta aparece como forma tracejada no lugar onde vai estar; o que é provável (reserva, janela de DPP) aparece hachurado.
3. _Cabeçalho que muda de estado_ (variação da inversão, repertório 1.2): a faixa de areia com nome, quatro datas e freio vira ameixa inteira quando o freio está puxado. Um bloco de cor por tela, e ele significa algo.

**O que a direção recusa, por escrito.**

- Moldura de canvas com app flutuante de raio alto (rouba área útil no celular).
- Painel de KPIs em grade de quatro, número sem comparação, anel de progresso, gráfico decorativo.
- Rótulo pequeno em caixa alta acima de título (kicker). Numeração de seção 01, 02, 03.
- Gradiente, vidro fosco, blob, anéis decorativos, foto de banco.
- Glifo Unicode ou emoji como ícone. Mistura de bibliotecas de ícone.
- Cor por humor. Verde e vermelho como único uso de cor. Vermelho para luto.
- Dourado como cor de texto no claro (2,5:1). Branco sobre dourado.
- Sombra como separador. Borda colorida grossa à esquerda de cartão ou alerta.
- Modal como primeira ideia. Confirmação em lote ("marcar tudo como normal").
- Texto com travessão, "Ops!", ponto de exclamação em sucesso, jargão técnico para a família.

**Contrato de direção (Impeccable, para quem revisa).**

- THESIS: a tela é a caderneta da visita de hoje; recusa o painel de SaaS com lateral cheia e grade de KPIs.
- OWN-WORLD: creme de papel, marinho de tinta, dourado só para "agora", areia para a família, ameixa para o luto; pílulas para tudo que se toca e para os dias; mono para tudo que é medida.
- STORY: a enfermeira entende em que dia está, responde com uma mão e confia que nada se perdeu; a coordenação vê primeiro o que pede decisão.
- FIRST VIEWPORT (enfermeira, Hoje): título "Hoje, quinta 24/09" em Jost 32; indicador de sincronização à direita; cartão da próxima visita com régua de dias e o botão "Cheguei, iniciar visita" na metade inferior; abas inferiores.
- FORM: caderneta (lista 1 de 7 candidatos: caderneta de saúde, planilha DOC 2, prontuário, kraamdossier holandês, agenda de papel, quadro de escala, carimbo de visita). Sem chave de sorteio: launcher indisponível.
- FINISH: esta entrega termina no kit revisado e nestes documentos; cada tela construída depois passa por captura 390 e 1280, lint e revisão contra este arquivo.

### Modo escuro: não, nesta fase

Cena de uso: as visitas acontecem de manhã ou à tarde (não existe atendimento noturno, PRD 3.2), em ambiente interno claro; a coordenação e o comercial usam o celular de dia e no começo da noite. O quarto do bebê às vezes está na penumbra, mas ali o problema é brilho, que o próprio aparelho resolve. As cores semânticas (alerta, aviso, sensível) foram calibradas e medidas sobre fundo claro; um segundo tema dobraria a verificação de contraste de cada estado clínico, com risco real de um alerta perder leitura. Decisão: um tema claro, `color-scheme: light`, sem seguir a preferência escura do sistema. Os tokens são semânticos (`--fundo`, `--texto`, `--superficie`), então um tema escuro futuro troca uma camada. Revisitar se a coordenação passar a operar alertas de madrugada com frequência.

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

### Tipografia

| Nível       | Fonte                      | Tamanho / entrelinha                   | Uso                                                          |
| :---------- | :------------------------- | :------------------------------------- | :----------------------------------------------------------- |
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
- Raio, quatro degraus: `raio-1` 4 px (caixa de seleção, turno da escala), `raio-2` 12 px (campo, faixa, dia da régua), `raio-3` 20 px (cartão, folha inferior), `raio-pilula` 999 px (botão, selo, seletor sim ou não, aba). Regra: o que se toca é pílula; o que contém é 12 ou 20.
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

Movimento: 140 ms para resposta de controle, 220 ms para entrada de aviso, curva de saída suave. Nada de mola, rotação de entrada ou sequência de carregamento. `prefers-reduced-motion` desliga tudo e o esqueleto vira fundo parado.

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

---

## 6. Componentes

Nomes de classe de `base.css` entre crases. Todo componente interativo tem repouso, hover, foco, pressionado, desabilitado, carregando e erro quando se aplica.

**Botão** (`botao`, `--primario`, `--terciario`, `--alerta`, `--sensivel`, `--bloco`, `--compacto`, `--icone`). Pílula de 48 px, texto de 16 px em 600, verbo e objeto ("Assinar registro do D4", "Assumir conversa"). Um primário por tela. Primário marinho; secundário branco com borda; terciário sublinhado; alerta só dentro de faixa clínica ("Ligar para a supervisão"); sensível só na confirmação do freio. No celular, a ação principal mora na `barra-acao` fixa no rodapé.

**Campo** (`campo`, `campo__rotulo`, `campo__caixa`, `campo__entrada`, `campo__unidade`, `campo__ajuda`). Rótulo em cima, sempre visível; placeholder só como exemplo. Numérico com `inputmode="decimal"` e unidade à direita em mono (°C, bpm, mmHg, g). A ajuda mostra o valor do dia anterior da mesma família como referência, nunca como preenchimento. Estados por `data-estado`: `erro`, `aviso`, `alerta-clinico`, `copiado`, `desabilitado`. Salva no aparelho ao sair do campo.

**Seletor sim ou não em um toque** (`pergunta`, `sim-nao`). Pergunta à esquerda, duas pílulas de 52 px à direita. Um toque responde e grava; tocar de novo em outra opção troca. Nenhuma das opções tem cor de "certo" ou "errado"; só a resposta que dispara regra pinta a pergunta de alerta e abre a faixa logo abaixo. Sem valor padrão. Campo "sim/não + texto" abre o texto abaixo só quando a resposta pede.

**Escala 0 a 10** (`escala`). Onze alvos de 52 px: no celular em duas linhas (0 a 5, 6 a 10), a partir de 600 px em uma. Números em mono, extremos descritos ("0 · sem dor", "10 · pior dor possível"). Sem gradiente verde para vermelho: a escala não sugere resposta. O corte de alerta não aparece na escala; aparece a faixa depois da resposta.

**Marcação múltipla** (`marcas`). Chips para "o que foi feito hoje" nos blocos de orientação (4, 5, 6, 8), se a coordenação clínica aprovar a troca de sim ou não item a item (ver `fluxos.md`).

**Cartão** (`cartao`, `--plano`, `--areia`, `--tocavel`). Branco, raio 20, `sombra-1`, padding 20. Cartão tocável inteiro é link. Nunca cartão dentro de cartão.

**Selo de estado** (`selo`, `--sucesso`, `--aviso`, `--alerta`, `--sensivel`, `--marinho`, `--destaque`, `--contorno`). Pílula de 28 px, 13 px em 600, ícone de 16 quando o estado é de risco. Sempre texto. `--destaque` (dourado com texto marinho) só para "Oferta pendente" e "Quente".

**Faixa de alerta clínico** (`faixa`, `--imediato`, `--prioritario`, `--sensivel`, `--info`, `--sucesso`, `--fixa`). Fundo lavado da cor do estado, borda fina, ícone de 24, código da regra em mono (PU-01), título que diz o achado com o valor ("Febre de 38,2 °C na puérpera"), conduta em frase completa, o que precisa ser registrado antes de fechar, e ações. Imediato traz "Ligar para a supervisão" (link `tel:`, funciona sem dados) e "Registrar acionamento". A faixa aparece logo abaixo do campo que a disparou e fica presa no topo do checklist (`--fixa`) até ser registrada. `role="alert"` só na primeira aparição.

**Indicador de sincronização** (`sinc`, `data-estado="local|enviando|sincronizado"`). Três estados do PRD 15: "Salvo no aparelho" (aviso lavado, ícone de celular), "Enviando 3 respostas" (neutro, ícone subindo), "Sincronizado 11:42" (sucesso). Sem sinal: o estado continua "local" e a faixa `--info` diz "Sem sinal agora. O registro está salvo no aparelho e sobe sozinho quando a conexão voltar." Falha de envio: estado "local" com "Não enviou. Tentamos de novo em 30 s." e botão "Tentar agora". Fica no cabeçalho de toda tela da enfermeira.

**Cabeçalho da família com freio** (`familia-cab`, `botao-freio`, `data-freio="ativo"`). Faixa de areia de ponta a ponta: nome da família em Jost 26, selo do estágio, dia do acompanhamento, bairro, e as quatro datas em grade (DPP "estimativa"; nascimento, alta e início "fato"; "ainda não" tracejado quando não há). O botão "Freio" (mão, contorno ameixa, 44 px) fica no canto superior direito de toda tela da família. Um toque aciona bloqueio total, sem pergunta. Aparece o aviso efêmero "Freio acionado. Nenhuma mensagem automática sai para a Família Teste Aurora." e o cabeçalho inteiro vira ameixa com "Freio em bloqueio total desde 24/09/2026, 09:14. Só contato humano e nominal." Nasce a tarefa "Justificar o freio" para quem acionou. Reverter exige coordenação ou diretoria, com justificativa, numa folha inferior.

**Régua de dias** (`regua`, `regua--12`, `regua--fina`, `data-estado="feito|hoje|pendente|alerta|sensivel"`). Um segmento por dia com "D4" em mono e a data curta. Versão fina (10 px) em linhas de lista e cartões. Mesma família de forma em `blocos` (progresso do checklist) e `semana` (escala da equipe).

**Semana da equipe** (`semana`, `semana__turno`, `data-estado="visita|reservada|backup|oferta|folga"`, vazio = livre). Sete dias, dois turnos por dia. Legenda sempre visível.

**Tabela que vira lista** (`tabela`, `tabela__principal`, `tabela__canto`, `data-rotulo`). No computador, tabela com hairline entre linhas, número à direita em mono, ação da linha no menu de três pontos. Abaixo de 720 px, cada linha vira cartão: nome em destaque, selo no canto, demais campos como "Rótulo valor".

**Fila de transferências** (`fila`, `fila-item`, `data-prioridade="maxima"`, `prazo`). Motivo em frase ("Quer contratar"), família, IG e contexto em uma linha, prazo à direita ("vence em 38 min", aviso quando falta menos de 25% do SLA, alerta quando vence), botão "Assumir" no próprio cartão. Prioridade máxima (saúde, perda) fica no topo em fundo alerta lavado e nunca some por filtro.

**Conversa** (`conversa`, `bolha--familia`, `bolha--isadora`, `bolha--pessoa`, `evento-conversa`). Família à esquerda em branco; Isadora à direita em areia com "Isadora (IA)" e ícone de robô; pessoa da equipe à direita em marinho com nome. Eventos do sistema centralizados ("Transferida ao comercial às 14:02. A IA não volta a responder nesta conversa.").

**Estado vazio** (`vazio`). Contorno tracejado no lugar do conteúdo, título que diz o que é, texto que diz por que está vazio e o que vai aparecer, e a próxima ação como botão.

**Carregando** (`esqueleto`). Blocos no formato do conteúdo que vem. Nunca spinner no meio da tela.

**Aviso efêmero com desfazer** (`aviso-efemero`). Marinho, acima das abas inferiores, 6 s (10 s para o freio, se aprovado). Confirma o que aconteceu e oferece a volta.

**Folha inferior** (`folha`). Para confirmação que protege algo irreversível (assinar, reverter freio, recusar oferta com motivo). No computador vira diálogo centralizado de 520 px. Nunca para tarefa comum.

**Abas inferiores** (`abas-inf`). PRD 20.4 por papel, 4 ou 5 itens, 56 px, ícone 24 e rótulo 13. Ativa em marinho 600 com marca dourada de 3 px em cima. Contador em alerta só para alerta clínico ou transferência vencendo.

**Barra lateral** (`lateral`). Computador, marinho, 248 px, símbolo provisório e "Kraamzorg OS" em Jost. Grupos do PRD 20.4 (Comercial, Operação, Experiência, Gestão, Sistema) com título em frase, itens de 44 px, ativo em `marinho-claro` com ícone dourado. Mostra só o que o papel pode abrir.

**Abas de conteúdo** (`abas`). Dentro da ficha: Linha do tempo, Comercial, Conversas, Pré-natal, Atendimento, Financeiro, conforme o papel. Sublinhado dourado de 2 px na ativa. Rolam de lado no celular.

---

## 7. Microcopy

1. Frase completa, voz ativa, segunda pessoa para a equipe ("Confira e digite de novo"), primeira pessoa do plural para a Kraamzorg falando com a família.
2. Rótulo diz o que é; botão diz o que acontece: "Assinar registro do D4", "Assumir conversa", "Cheguei, iniciar visita". Nada de "OK", "Enviar", "Sim" em confirmação.
3. Erro diz o que aconteceu e o que fazer: "8 bpm parece um dígito a menos. Confira e digite de novo." "Não enviou. Tentamos de novo em 30 s."
4. Offline, sempre: "Sem sinal agora. O registro está salvo no aparelho e sobe sozinho quando a conexão voltar."
5. Alerta clínico: código, achado com valor, conduta. "PU-01 · Febre de 38,2 °C na puérpera. Acione a supervisão médica agora e oriente a família a procurar atendimento de emergência."
6. Vazio ensina: "Nenhuma visita marcada para hoje. Quando a coordenação oferecer uma família, a oferta aparece aqui para você aceitar ou recusar."
7. Sucesso breve e sem exclamação: "Assinado às 11:42. Sobe quando houver sinal."
8. Estado sensível sem eufemismo e sem alarme: "Freio em bloqueio total. Só contato humano e nominal."
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
- Ícone que não seja Lucide; emoji como ícone; ícone sem texto significando estado.
- Rótulo em caixa alta, kicker acima de título, numeração decorativa de seção.
- KPI sem comparação, anel de progresso, barra padrão de biblioteca.
- Dado real de qualquer paciente, médico ou profissional em protótipo, seed ou captura.

---

## 9. Chutes e substituições

- Jost no lugar de Codec Pro; nenhuma TT Drugs (só no logo, que é imagem). Métrica: Jost é um pouco mais estreita; títulos podem ganhar uma linha a menos quando Codec Pro entrar.
- Logo e símbolo em PNG provisório (`assets/logo-provisorio.png`, `assets/simbolo-provisorio.png`). O símbolo dourado sobre marinho funciona na lateral; o logo completo marinho só vai sobre creme.
- Nove derivados de cor por mistura (seção 4) precisam entrar no PRD 20.2 e no `globals.css`.
- Ícones Lucide escolhidos por esta direção (a Taste prefere outra biblioteca; o briefing pediu Lucide).
- Nomes fictícios: famílias "Família Teste Aurora" a "Família Teste Horizonte", enfermeiras Talita Moreno, Rosana Vieira, Priscila Andrade, Marta Quintela e Joana Bastos, coordenação Beatriz Falcão, comercial Otávio Lemos.
- Registro das direções usadas (`claude/interface-direcoes-usadas.md`) não existe nesta sessão: registrar "25/09/2026 · Kraamzorg OS · Print-tech papel com dado (Operate) · régua de dias · blocos segmentados".

## 10. Verificação feita

- `lint_slop.py` em `docs/prototipo`: seis achados ALTA, todos a declaração de Inter em `tokens.css`, justificada na seção 4. Nenhum travessão, emoji, gradiente, `outline: none` ou raio fora da escala.
- Kit capturado em 390 x 844 e 1280 x 800, duas rodadas. Corrigidos na segunda: botão do aviso efêmero espremido, régua de 12 dias apertada no celular (virou duas semanas), frases inteiras em mono (prazo, "D4 de 6", rótulos da lista), cartão tocável sem espaçamento interno.
- O que precisa de olho humano: legibilidade ao sol e com brilho baixo num aparelho real; alvo de 52 px com luva; leitura de tela do seletor sim ou não no VoiceOver e no TalkBack.
