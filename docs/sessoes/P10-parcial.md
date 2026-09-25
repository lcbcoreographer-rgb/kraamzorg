# P10 (parcial) · Tokens, fontes, componentes base e formatadores

Data: 25/09/2026
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q` (o commit desta sessão fica para o orquestrador, depois da verificação).

Esta sessão antecipou a parte do P10 que **não** depende dos papéis do P07 (PROMPTS.md diz "depende de P07"; o P07 ainda não rodou). A casca por papel (abas inferiores e barra lateral com a navegação de cada papel, rotas vazias por papel) fica para uma sessão depois do P07, como planejado.

## Feito

1. **Tokens da direção "Caderneta de visita"** (DESIGN.md seção 4) em `src/app/globals.css`, dentro do `@theme` do Tailwind v4: os nove primitivos do PRD 20.2, os dezessete derivados (misturas fixas por `color-mix`, nenhum matiz novo), os tokens semânticos (`fundo`, `superficie`, `texto`, `acao`, `destaque`...) e o tema do shadcn (`background`, `primary`, `border`...) apontando para os semânticos. `color-scheme: light` no `:root`, sem `.dark` nem `@custom-variant dark`: a decisão "Modo escuro: não, nesta fase" (DESIGN.md seção 2) foi seguida à risca. Tipografia com a escala fixa em rem (display, 1, 2, 3, corpo, apoio, mini, dado), raio em quatro degraus (`radius-1/2/3/pilula`), duas sombras tingidas de marinho, toque (44 e 52 px), `container` para largura de conteúdo/leitura/lateral, curvas de movimento.
2. **Fontes locais** (`src/app/fonts.ts`, `next/font/local`): Jost (400/500), Inter (400/500/600) e IBM Plex Mono (400/500), a partir dos `.woff2` já existentes em `docs/prototipo/assets/fonts` (subconjunto "latin", que cobre todo acento do português). Variáveis (`--font-jost`, `--font-inter`, `--font-plex-mono`) plugadas no `@theme` como `--font-titulo`, `--font-sans` e `--font-mono`. `src/app/layout.tsx` aplica as três variáveis no `<html>` e `font-sans` no `<body>`.
3. **Logo provisório**: `logo-provisorio.png` e `simbolo-provisorio.png` copiados de `docs/prototipo/assets` para `public/brand/`, com `public/brand/README.md` (três linhas) avisando que o SVG oficial substitui os dois quando chegar.
4. **Dezenove componentes base** em `src/components/ui`, API em português, texto sempre por propriedade (nenhum texto de negócio fixo no código): `Botao`, `CampoTexto` (com `multilinha` para texto longo), `CampoNumero`, `SimNao`, `Escala0a10`, `EscolhaUnica`, `EscolhaMultipla`, `Cartao`, `Selo`, `FaixaAlerta`, `IndicadorSincronizacao`, `ReguaDias`, `CabecalhoFamilia`, `Dialogo` e `PainelLateral` (sobre `@radix-ui/react-dialog`), `TabelaLista`, `EstadoVazio`, `AbasInferiores` e `BarraLateral` (estáticas, itens de exemplo por propriedade, sem papel). Foco visível herdado do `:focus-visible` global (contorno marinho + halo dourado), alvo de toque nunca abaixo de 44 px (52 px nos controles do checklist: `CampoNumero`, `SimNao`, `Escala0a10`), rótulo/descrição/erro sempre associados por `aria-describedby`, grupos de opção com `role="radiogroup"`/`aria-labelledby`.
5. **Formatadores** em `src/lib/formatacao`: `formatarMoeda` (centavos, "R$ 4.200" ou "R$ 1.433,33"), `formatarData`/`formatarDataHora` (dd/mm/aaaa, fuso America/Sao_Paulo, sem deslocar coluna `date` por causa do UTC), `formatarTelefone` (E.164 para exibição brasileira) e `formatarIdadeGestacional` (semanas/dias para "38s2d"; o cálculo continua em `ig()` no banco). 30 testes Vitest com casos de borda.
6. **`/design-system`**: vitrine de todos os componentes com dados fictícios (famílias "Família Teste", equipe com nome inventado, DESIGN.md seção 9), em `src/app/design-system/page.tsx` (checa `estaEmProducao()` e chama `notFound()`) e `src/app/design-system/vitrine.tsx` (o conteúdo interativo). A variável `NEXT_PUBLIC_APP_ENV` ("desenvolvimento" | "homologacao" | "producao") entra documentada em `.env.example`; `src/lib/ambiente.ts` guarda a checagem.
7. **Testes**:
   - Vitest dos componentes principais (`SimNao`, `Escala0a10`, `IndicadorSincronizacao`, `ReguaDias`, `CabecalhoFamilia`), mais os 30 de formatação: 51 testes de componente/formatação no total.
   - `tests/tokens/sem-cor-solta.test.ts` (PRD P10 item 6): varre todo `src/` menos `src/app/globals.css` e falha se aparecer hex, `rgb()`/`rgba()` ou `hsl()`/`hsla()` solto. Testado de propósito com um arquivo temporário para confirmar que ele pega o erro antes de confiar nele.
   - `tests/e2e/design-system.spec.ts`: Playwright com `@axe-core/playwright` na `/design-system`, nos dois projetos (celular e computador), sem violação séria ou crítica.
8. **Cinco achados corrigidos durante a verificação** (nenhum sobrou: `pnpm e2e` e o axe terminam sem violação séria ou crítica, nos dois projetos):
   - `Botao` com `asChild` quebrava o build (`next build` falhava em `/design-system`): o Radix `Slot` exige exatamente um elemento React como filho, e o `Botao` sempre envolvia `children` em ícone e `<span>`, mesmo com `asChild`. Corrigido: com `asChild`, o `Slot` recebe `children` direto, sem decoração.
   - O `cn()` (helper `tailwind-merge`) não reconhecia os nomes de token novos (`text-corpo`, `text-texto-inverso`...) e, sem saber que um é tamanho e o outro é cor, tratava os dois como o mesmo grupo ambíguo e apagava um na hora de resolver conflito. Isso tirava silenciosamente a cor do texto do botão "perigo" (ficava com o texto escuro herdado do corpo da página sobre fundo `alerta`, contraste 2,62:1: achado do axe). Corrigido estendendo o `tailwind-merge` em `src/lib/utils.ts` (`extendTailwindMerge`) com a lista de cores, tamanhos de texto, raios, sombras, espaçamentos e `container` do tema.
   - `ReguaDias`: a data curta do dia (11 px) usava a mesma opacidade reduzida (0,9) do protótipo estático; nos estados `alerta` e `sensivel`, sobre o fundo lavado, isso derrubava o contraste para 4,35:1 (achado do axe, abaixo do 4,5:1 AA). Corrigido tirando a opacidade: o texto cheio já cumpre os números da tabela de contraste do DESIGN.md ("sobre o lavado").
   - `BarraLateral`: o símbolo da marca (`next/image`) não aparecia nas capturas porque o carregamento preguiçoso padrão nunca disparava para um elemento tão abaixo na página numa captura de tela inteira sem rolagem real. Corrigido com `priority` (é um item de navegação persistente, não faz sentido adiar o carregamento mesmo fora do contexto da captura).
   - `vitest.config.ts`: `exclude: ["node_modules/**", ...]` não pega `node_modules` aninhado (ex: `n8n/referencia/node_modules`, de outra sessão em paralelo), então `pnpm test` varria milhares de testes de pacotes de terceiros e falhava por causa deles. Trocado para `"**/node_modules/**"`.

## Ficou de fora (e por quê)

- **Casca do app por papel** (abas inferiores com os itens reais de cada papel, barra lateral agrupada por papel, rotas vazias por papel): é o item 3 do prompt original do P10, e depende do P07 (papéis e RLS), que ainda não rodou. `AbasInferiores` e `BarraLateral` já existem como componentes estáticos, prontos para receber os itens de cada papel quando o P07 chegar.
- **Componentes que o prompt original do P10 não pediu** mas que o PRD 20.5/20.6 lista para fases seguintes (ex: `Conversa`/bolha de chat, `Fila` de transferências, `Semana` da equipe): não entraram porque não estavam na lista da tarefa desta sessão; a `TabelaLista` e o `Cartao` cobrem o que a vitrine precisa para demonstrar dado tabular e fila de forma genérica.
- **Ícones Lucide como sprite SVG único** (`assets/icones.js` do protótipo): o produto usa `lucide-react` (já instalado no P00) componente a componente, não um sprite; é a forma idiomática em React e o CLAUDE.md não pede sprite.

## Decisões tomadas nesta sessão

1. **`NEXT_PUBLIC_APP_ENV`** como a "variável de ambiente pública de ambiente" que a tarefa pediu, em vez de um booleano solto tipo `NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM`: ela identifica o ambiente inteiro ("desenvolvimento" | "homologacao" | "producao"), documentada em `.env.example`, e o P14 (ambientes e deploy) define o valor real em cada ambiente do Vercel. Sem valor, o app assume "desenvolvimento" (nunca esconde a vitrine por engano num ambiente não configurado, mas também nunca a mostra em produção por essa mesma omissão, porque produção precisa declarar o valor "producao" explicitamente no Vercel).
2. **Régua de dias com largura fluida** (`grid-template-columns: repeat(auto-fit, minmax(52px, 1fr))`) em vez do `grid-cols-6` fixo do protótipo estático: como `ReguaDias` é um componente React com número de dias variável (não só 12), a régua se adapta ao número de itens em vez de fixar duas linhas de seis só para o caso de 12 dias. No celular (390 px), 12 dias ainda quebram em duas linhas de seis, pelo espaço disponível.
3. **`Botao` com `asChild` não decora o filho** (sem ícone, sem `<span>` de rótulo): quando `asChild` funde as props num único elemento (ex: um `<a>` de navegação), o Radix Slot exige exatamente um elemento React como filho. Ícone e rótulo animado (`carregando`) só existem no `<button>` nativo; quem usa `asChild` monta o próprio conteúdo do link.
4. **`tailwind-merge` estendido** com o vocabulário de `globals.css` (`src/lib/utils.ts`), documentado no comentário do arquivo: é a correção de um dos achados do item 8 acima, e vale para qualquer componente futuro que combine um tamanho de texto customizado com uma cor customizada na mesma `className`.
5. **`estimativa`/`fato` fixos em `CabecalhoFamilia`**: são o vocabulário do próprio DESIGN.md (seção 2, "quatro datas com 'estimativa' e 'fato'"), não texto de negócio da tela; ficaram no componente, como o prefixo "D" em `ReguaDias` e os sufixos "s"/"d" em `formatarIdadeGestacional`. Todo o resto do texto visível (perguntas, rótulos de botão, mensagens de alerta) chega por propriedade.
6. **Régua de dias sem a opacidade 0,9 do protótipo estático** na data curta: ver achado do item 8. A forma continua igual (hoje com borda dourada, feito em marinho cheio, pendente hachurado, futuro tracejado, alerta e sensível nas cores do estado); só o texto ficou mais forte para não reprovar AA.

## Mudanças no PRD

Nenhuma. Os dezessete tokens derivados já estavam previstos como ampliação do PRD 20.2 pelo próprio DESIGN.md (seção 4: "Precisam entrar no `@theme` do `globals.css`... é a única ampliação proposta ao PRD 20.2"), mas a edição do PRD.md em si não está no escopo desta sessão (o arquivo está fora da lista do que esta sessão pode alterar).

## Pendências novas ([confirmar], [clínico], terceiros)

- Nenhuma pendência nova de negócio, clínica ou de terceiro. A única pendência é estrutural e já esperada: a casca por papel espera o P07 (ver "Ficou de fora").

## Como testar

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
pnpm build

# e2e (celular e computador), Chromium do ambiente:
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm e2e

# checagem manual: cor solta fora de globals.css (deve falhar)
echo 'export const x = "#123456";' > src/lib/__temp.ts
pnpm vitest run tests/tokens   # falha, mostra "#123456"
rm src/lib/__temp.ts
pnpm vitest run tests/tokens   # volta a passar

# vitrine e capturas (a rota só existe fora de produção; sem
# NEXT_PUBLIC_APP_ENV=producao ela aparece normalmente)
pnpm build && pnpm start -p 3933 &
node tools/shot.mjs http://127.0.0.1:3933/design-system saida-390.png 390 844 1
node tools/shot.mjs http://127.0.0.1:3933/design-system saida-1280.png 1280 800 1
# abrir saida-390.png e saida-1280.png, ou http://localhost:3933/design-system no navegador
```

## Resultado dos invariantes

Fora de escopo desta sessão (o P10 não é um dos quatro invariantes do capítulo 16.1: banco, mensageria/automação e sincronização offline não mudaram aqui). Os comandos de verificação do P10 estão em "Como testar"; resultado local nesta sessão:

| Comando                           | Resultado                                                                                                   |
| :-------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                       | Verde (1 aviso pré-existente em `n8n/referencia/comparar.mjs`, de outra sessão, fora do escopo)             |
| `pnpm format:check`               | Verde                                                                                                       |
| `pnpm typecheck`                  | Verde                                                                                                       |
| `pnpm test`                       | Verde, 94 testes (11 arquivos): 51 de componente/formatação, 43 de `sem-cor-solta` (um por arquivo varrido) |
| `pnpm build`                      | Verde, `/`, `/_not-found` e `/design-system` estáticas                                                      |
| `pnpm e2e` (celular + computador) | Verde, 6 testes: fumaça da `/`, título e axe (zero violação séria ou crítica) da `/design-system`           |

Capturas em `/tmp/claude-0/-home-user-kraamzorg/bc859238-244a-5795-944c-406f72ec541c/scratchpad/ds-capturas/design-system-390x844.png` e `design-system-1280x800.png`, olhadas inteiras (recortadas em blocos para leitura) e corrigidas uma vez (achados do item 8: cor do botão "perigo", contraste da régua de dias, símbolo da barra lateral).

## Auditoria da P10 parcial (segunda passada, mesma data)

Uma segunda sessão auditou o que está acima (leitura de todo o código, `next dev` em 390 e 1280 com `shot.mjs`, sondas no Playwright, contraste pela fórmula WCAG, `lint_slop.py`) e levantou 29 correções por prioridade. Esta seção documenta o que foi aplicado nessa auditoria, nesta mesma sessão de correção.

### P0, bloqueava

1. **`IndicadorSincronizacao` rolava a página de lado no celular.** Aplicado: tirado o `whitespace-nowrap` do contêiner, texto e botão agora quebram linha (`flex-wrap`, `min-w-0`); o `role="status"` ficou só no texto (ver item 10), o botão "Tentar agora" mora fora dele. Teste novo: `tests/e2e/overflow.spec.ts` confere `scrollWidth <= clientWidth` em 360 e 390 px na `/design-system` (passa nos dois projetos).

### P1, corrigido

2. **`/design-system` no ar por omissão.** Aplicado: `vitrineLiberada()` em `src/lib/ambiente.ts` libera só por lista explícita (`"desenvolvimento"` ou `"homologacao"`) e recusa quando `VERCEL_ENV === "production"`, mesmo sem `NEXT_PUBLIC_APP_ENV` configurada. Metadados da rota ganharam `robots: { index: false }`. Testes novos: `src/lib/ambiente.test.ts` (Vitest, cobre as duas funções e os dois erros medidos: variável ausente e "production" em inglês) e `src/app/design-system/page.test.tsx` (prova que `notFound()` é chamado nos quatro casos de bloqueio e não é chamado em desenvolvimento). `playwright.config.ts` passou a fixar `NEXT_PUBLIC_APP_ENV=desenvolvimento` no `webServer`, porque a rota é estática e o valor é gravado no HTML no `next build`, não lido em runtime.
3. **`CabecalhoFamilia` escondia as quatro datas com o freio ativo.** Aplicado: o `<dl>` das quatro datas fica sempre no DOM; com o freio ativo, rótulo e valor mudam para `texto-inverso` (creme sobre ameixa, 6,4:1). A frase de bloqueio entrou na linha de meta, no lugar do conteúdo normal (selo, dia, bairro). Teste do `cabecalho-familia.test.tsx` trocado para confirmar que "DPP" continua visível.
4. **Margens negativas fixas em `CabecalhoFamilia`.** Aplicado: `-mx-4 lg:-mx-8` saiu do componente; quem precisa do efeito de ponta a ponta usa a nova prop `sangrar`.
5. **Botão de freio sem componente próprio; foco perdido ao ativar.** Aplicado: `src/components/ui/botao-freio.tsx` novo (44 px, contorno ameixa, ícone `Hand`, um toque sem confirmação). `CabecalhoFamilia` leva o foco pro selo "Freio ativo" (`tabIndex={-1}`, ou pro próprio selo quando `acaoFreioAtivo` faz dele um botão) quando o freio liga, e a linha de meta virou `role="status"` pra anunciar a mudança. Teste novo confirma o foco depois do clique.
6. **Aviso efêmero inexistente.** Aplicado: `src/components/ui/aviso-efemero.tsx` novo (marinho, acima das abas, `role="status"`, ação "Desfazer", `duracaoSegundos` por prop — o valor real é `freio_desfazer_segundos`, não fixo aqui — `env(safe-area-inset-bottom)`). Ligado à demo do freio na vitrine.
7. **Estado da régua de dias só por cor/hachura.** Aplicado: `DiaRegua` ganhou `rotuloEstado`, renderizado num `sr-only` junto com dia e data; `alerta` e `sensivel` ganharam ícone (`TriangleAlert`/`OctagonPause`, 13 px) além da cor.
8. **Grade fluida da régua quebrava de jeito diferente por largura.** Aplicado: voltou à grade explícita (`repeat(dias.length, ...)`), com `repeat(6, ...)` abaixo de 600 px quando há mais de 6 dias. Teste novo `tests/e2e/regua-dias.spec.ts` confere 6 colunas em 390 e 430 px e 12 em 600 px (passa nos dois projetos).
9. **Foco inconsistente no `Campo`.** Aplicado: todo estado (não só o normal) ganhou `has-[:focus-visible]:outline-2 outline-foco outline-offset-2` na caixa, sem mudar a cor da borda de estado; `focus-visible:shadow-none` no `<input>`/`<textarea>` de `campo-texto.tsx` e `campo-numero.tsx` tira o halo duplicado.
10. **Alvo de "Tentar agora" de 80×18 px; texto do botão dentro do `role="status"`.** Aplicado junto do item 1: `min-h-toque px-3` no botão, que ficou fora do `role="status"` (que agora envolve só ícone + texto do estado).
11. **Cores fora de `globals.css`.** Aplicado: `--alerta-hover`, `--lateral-hover`, `--hachura-aviso` (via `--background-image-hachura-aviso`) e `--anel-hoje` (via `--shadow-anel-hoje`) entraram no `@theme`; `botao.tsx`, `barra-lateral.tsx` e `regua-dias.tsx` passaram a usar os utilitários gerados (`hover:bg-alerta-hover`, `hover:bg-lateral-hover`, `bg-hachura-aviso`, `shadow-anel-hoje`) em vez de `color-mix()`/gradiente/sombra arbitrários. `tests/tokens/sem-cor-solta.test.ts` não foi ampliado para pegar `color-mix(`/`oklch(`/`lab(`/`linear-gradient(` soltos fora de `globals.css` nem paleta padrão do Tailwind — ver "Não aplicado" abaixo.
12. **Tipografia fora da escala.** Aplicado: `regua-dias.tsx` usa o novo token `--text-micro` (11 px, documentado em `globals.css` como o único caso de texto abaixo de 13 px); `abas-inferiores.tsx` usa `text-mini`; `escala-0-a-10.tsx` usa `text-3`; `barra-lateral.tsx` usa o novo `--text-marca` (18 px, rastro 0,01em) em vez de `text-lg tracking-wide`; `campo-numero.tsx` usa `placeholder:text-corpo`.
13. **Travessão em comentário de `src/lib/utils.ts`.** Aplicado: trocado por vírgula.

### P2, aplicado nesta passada

14. **Selo "Freio ativo" com cara de botão sem ação; título fixo em `<h3>`; `<dd>` vazio no tipo "ausente".** Aplicado: `acaoFreioAtivo` (abre reversão) reduz o selo a 28 px quando não passado; `nivelTitulo` (`h1`/`h2`/`h3`) substitui o `<h3>` fixo; a segunda `<dd>` (rótulo "estimativa"/"fato") não renderiza mais para o tipo "ausente". `estado-vazio.tsx` não ganhou `nivelTitulo` nesta passada — ver "Não aplicado".
15. **Extremos da escala 0 a 10 sem `aria-describedby`; breakpoint `sm:` de 640 px.** Aplicado: `id` nos extremos, `aria-describedby` no `radiogroup`; `--breakpoint-tablet: 600px` novo no `@theme`, usado em `escala-0-a-10.tsx` (`tablet:grid-cols-11`) e `cabecalho-familia.tsx` (`tablet:grid-cols-4`).
16. **Unidade fora do nome acessível; `min`/`max`/`step` mortos num `type="text"`.** Aplicado: unidade entra por `aria-describedby` (`id` próprio); `min`/`max`/`step` saíram do DOM, `CampoNumero` ganhou `faixa?: { min, max }` e `aoValidarFaixa` (chamado no `onBlur` com o valor numérico e se está dentro da faixa; quem chama decide a mensagem de erro).
17. **Descrição sumia com erro; estado aviso sem ícone.** Aplicado: `campo-texto.tsx` e `campo-numero.tsx` renderizam descrição e erro juntos (o `aria-describedby` já apontava pros dois); `AjudaCampo` ganhou ícone `TriangleAlert` no estado `aviso`.
18. **`SimNao`, `Escala0a10`, `EscolhaUnica`, `EscolhaMultipla` só controlados.** Aplicado: hook próprio `useEstadoControlavel` (`src/lib/hooks/estado-controlavel.ts`, sem trazer `@radix-ui/react-use-controllable-state` como dependência nova) dá estado interno com `valorPadrao`/`valoresPadrao`. `EscolhaMultipla` ganhou `tamanho="checklist"` (52 px). Desabilitado trocou `opacity-60` por `bg-marinho-08 text-marinho-62` nos quatro componentes de escolha.
19. **Nome acessível "Alertas2"; grupos da lateral sem `<ul>`; `aria-label` da `nav` era o nome da marca; contador `creme-62` reprovava AA; comentário errado.** Aplicado: `rotuloContador` em `AbasInferiores`/`BarraLateral` (renderiza `<span className="sr-only">, N alertas</span>`, número visível com `aria-hidden`); grupos da lateral viraram `<ul aria-labelledby>`; `BarraLateral` ganhou prop `rotulo` própria pro `aria-label` da nav; contador neutro em item ativo usa `texto-inverso`; comentário de `contadorAlerta` corrigido ("fundo areia", não "vermelho").
20. **Visibilidade por breakpoint dentro do componente.** Aplicado: `AbasInferiores` e `BarraLateral` ganharam `visivelEm` (`"sempre"` por padrão, `"celular"`/`"computador"` reproduz o comportamento antigo); a vitrine usa o padrão `"sempre"`, então os dois aparecem em qualquer largura da captura.
21. **`tabela-lista.tsx` sem papéis explícitos; rótulo em mono; leitura duplicada.** Aplicado: `role="table"`/`"rowgroup"`/`"row"`/`"columnheader"`/`"cell"` explícitos; `font-sans` no rótulo inline do cartão; `aria-hidden` no rótulo inline (o cabeçalho `sr-only` já cobre o nome da coluna pro leitor de tela).
22. **`Dialogo` sem `safe-area-inset-bottom`; `Description` vazia como gambiarra.** Aplicado: `pb-[calc(2rem+env(safe-area-inset-bottom))]` na folha inferior (computador mantém `lg:pb-8`); `Dialogo` e `PainelLateral` passaram a controlar `aria-describedby` do `Content` diretamente (aponta pro id de um parágrafo só quando há `descricao`; `undefined` quando não há), sem `Description` vazia.
23. **Faltavam as variantes `sensivel` e `icone`; `whitespace-nowrap` transbordava; `carregando` usava `disabled`; `asChild` desabilitado navegava.** Aplicado: variantes `sensivel` (confirmação do freio) e `icone` (44×44, `aria-label` obrigatório por tipo) em `botao.tsx`; `largaTotal` permite quebra (`whitespace-normal text-balance`); `carregando` usa `aria-disabled` e bloqueia o clique num handler, sem tirar o botão do foco; o mesmo handler bloqueia o clique com `asChild` + desabilitado (previne a navegação do link).
24. **Testes acoplados a classe; faltava `@testing-library/user-event`.** Aplicado: `@testing-library/user-event` entrou como dependência de desenvolvimento; `sim-nao.test.tsx` e `regua-dias.test.tsx` trocaram `toHaveClass` por nome/estado acessível (`data-estado`, `toHaveAccessibleName`/conteúdo do item). Testes novos: teclado no `radiogroup` (`SimNao`, `Escala0a10`), erro e descrição ligados no `Campo` (`campo-texto.test.tsx`), `role="alert"`/`"status"` na `FaixaAlerta` (`faixa-alerta.test.tsx`), foco preso e Esc no `Dialogo` (`dialogo.test.tsx`), `Botao` carregando (`botao.test.tsx`), foco da `CabecalhoFamilia` depois do freio. `tests/e2e/overflow.spec.ts` cobre a rolagem horizontal do item 1.

### P3, aplicado nesta passada

26. **`formatarMoeda`/`formatarIdadeGestacional`/`formatarData` escondiam dado corrompido.** Aplicado: `formatarMoeda` lança `RangeError` com entrada não finita (em vez de "R$ 0"); `formatarIdadeGestacional` lança `RangeError` com dias fora de 0 a 6 ou valores negativos; `formatarData`/`formatarDataHora` devolvem `null` para data inválida, em vez do texto fixo "Data inválida" (a tela decide o que mostrar). Testes atualizados nos três arquivos.
27. **Comentário de `fonts.ts` citava `--font-mono`; seis (na prática, sete) `.woff2` latin-ext sem uso.** Aplicado: comentário corrigido para `--font-plex-mono`; os sete arquivos `*-latin-ext-*.woff2` (o subconjunto "latin" já cobre todo acento do português, conforme o próprio comentário do arquivo) foram apagados de `src/app/fonts.ts` e do disco.
28. **Camada de compatibilidade shadcn sem uso; `outline-foco/50` e raio herdado em qualquer elemento; contrastes baixos sem nota.** Aplicado: a camada shadcn (`--background`, `--primary`...) saiu de `globals.css` (nenhum componente ou primitivo Radix em uso a lia, conferido por busca no código); `outline-foco/50` e o raio herdado do `:focus-visible` ficaram restritos a `a, button, [tabindex]`; os dois contrastes abaixo de 3:1 (borda tracejada `marinho-50` sobre areia, 2,47:1; borda dourada de "hoje" sobre creme, 2,46:1) entraram como comentário no `globals.css`, porque o texto ao lado já passa AA sozinho.
29. **Ícone `Bot` reservado à Isadora; coluna IG sem marcação de dado; cores inconsistentes; `Secao` esticava os gatilhos; "Quatro achados" listava cinco.** Aplicado: `Bot` trocado por `UserRound` no rodapé da lateral; coluna "IG" da tabela ganhou `numerica: true` (mono); o selo "Em atendimento" da tabela estava `variante="sucesso"`, virou `variante="marinho"`, igual ao do cabeçalho; os gatilhos de `Dialogo`/`PainelLateral` ganharam `self-start` (o esticamento vinha de `align-items: stretch`, padrão de um contêiner `flex flex-col`, não do `Secao` em si — a correção ficou nos dois gatilhos, não no `Secao`, pra não desmontar os outros layouts em grade da vitrine); "Quatro achados" virou "Cinco achados" no item 8 acima. **Não confirmado:** o par "Frequência cardíaca 78 bpm, acima da faixa" só aparece uma vez na vitrine (seção Campos); não achamos uma segunda ocorrência em cor diferente para reconciliar com o cabeçalho, então esse ponto específico do item 29 ficou sem correção — pode ser um apontamento sobre outra tela deste produto, fora da vitrine, ou sobre uma leitura diferente do que já foi corrigido no `Selo` "Em atendimento".

### Não aplicado (registrado para a próxima passada)

- **Item 11, ampliação do `sem-cor-solta.test.ts`:** o teste ainda não pega `color-mix(`, `oklch(`, `lab(`, `linear-gradient(` soltos fora de `globals.css`, nem a paleta padrão do Tailwind (`bg-white`, `text-gray-*`, `red-*` etc). As três ocorrências que motivaram o achado (`botao.tsx`, `barra-lateral.tsx`, `regua-dias.tsx`) foram corrigidas na origem (agora usam token), então o teste não pegaria nada hoje, mas continua sem rede de segurança contra uma nova ocorrência.
- **Item 14, `nivelTitulo` em `estado-vazio.tsx`:** só `CabecalhoFamilia` ganhou a prop; `EstadoVazio` continua com `<h3>` fixo.
- **Item 24, componentes da seção 6 que ainda faltam:** `BarraAcao` fixa no rodapé, `Esqueleto`, `AbasConteudo` da ficha, `Blocos` (progresso do checklist) e `Semana` da equipe não entraram nesta passada (não estavam no escopo das 29 correções além de serem citados como pendência a registrar).
- **Item 29, "Frequência cardíaca 78 bpm, acima da faixa" em cores diferentes entre cabeçalho e tabela:** ver nota no item 29 acima.

### Resultado da verificação desta passada

| Comando                                | Resultado                                                                                                                                  |
| :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                            | Verde (mesmo aviso pré-existente de `n8n/referencia/comparar.mjs`, fora do escopo)                                                         |
| `pnpm format:check`                    | Verde                                                                                                                                      |
| `pnpm typecheck`                       | Verde                                                                                                                                      |
| `pnpm test`                            | Verde, 142 testes (17 arquivos)                                                                                                            |
| `pnpm build`                           | Verde, `/`, `/_not-found` e `/design-system` estáticas                                                                                     |
| `pnpm e2e` (celular + computador)      | Verde, 16 testes: fumaça da `/`, título e axe da `/design-system`, rolagem horizontal (2 larguras) e colunas da régua de dias (3 larguras) |
| `pnpm e2e:offline`                     | 1 teste pulado (placeholder do P12, sem mudança)                                                                                           |
| `gitleaks detect --no-git --no-banner` | Sem vazamento                                                                                                                              |

Capturas novas em `/tmp/claude-0/-home-user-kraamzorg/bc859238-244a-5795-944c-406f72ec541c/scratchpad/ds-capturas/design-system-390x844.png` e `design-system-1280x800.png` (rebuild com `NEXT_PUBLIC_APP_ENV=desenvolvimento`, porque a rota agora é bloqueada por omissão), olhadas inteiras e em recortes (indicador de sincronização em erro, confirmando a quebra de linha sem transbordo).
