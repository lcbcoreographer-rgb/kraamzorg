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
8. **Achado corrigido durante a verificação**: o `cn()` (helper `tailwind-merge`) não reconhecia os nomes de token novos (`text-corpo`, `text-texto-inverso`...) e, sem saber que um é tamanho e o outro é cor, tratava os dois como o mesmo grupo ambíguo e apagava um na hora de resolver conflito. Isso tirava silenciosamente a cor do texto do botão "perigo" (ficava com o texto escuro herdado do corpo da página sobre fundo `alerta`, contraste 2,6:1). Corrigido estendendo o `tailwind-merge` em `src/lib/utils.ts` (`extendTailwindMerge`) com a lista de cores, tamanhos de texto, raios, sombras, espaçamentos e `container` do tema. O axe pegou o problema; ver "Como testar".

## Ficou de fora (e por quê)

- **Casca do app por papel** (abas inferiores com os itens reais de cada papel, barra lateral agrupada por papel, rotas vazias por papel): é o item 3 do prompt original do P10, e depende do P07 (papéis e RLS), que ainda não rodou. `AbasInferiores` e `BarraLateral` já existem como componentes estáticos, prontos para receber os itens de cada papel quando o P07 chegar.
- **Componentes que o prompt original do P10 não pediu** mas que o PRD 20.5/20.6 lista para fases seguintes (ex: `Conversa`/bolha de chat, `Fila` de transferências, `Semana` da equipe): não entraram porque não estavam na lista da tarefa desta sessão; a `TabelaLista` e o `Cartao` cobrem o que a vitrine precisa para demonstrar dado tabular e fila de forma genérica.
- **Ícones Lucide como sprite SVG único** (`assets/icones.js` do protótipo): o produto usa `lucide-react` (já instalado no P00) componente a componente, não um sprite; é a forma idiomática em React e o CLAUDE.md não pede sprite.

## Decisões tomadas nesta sessão

1. **`NEXT_PUBLIC_APP_ENV`** como a "variável de ambiente pública de ambiente" que a tarefa pediu, em vez de um booleano solto tipo `NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM`: ela identifica o ambiente inteiro ("desenvolvimento" | "homologacao" | "producao"), documentada em `.env.example`, e o P14 (ambientes e deploy) define o valor real em cada ambiente do Vercel. Sem valor, o app assume "desenvolvimento" (nunca esconde a vitrine por engano num ambiente não configurado, mas também nunca a mostra em produção por essa mesma omissão, porque produção precisa declarar o valor "producao" explicitamente no Vercel).
2. **Régua de dias com largura fluida** (`grid-template-columns: repeat(auto-fit, minmax(52px, 1fr))`) em vez do `grid-cols-6` fixo do protótipo estático: como `ReguaDias` é um componente React com número de dias variável (não só 12), a régua se adapta ao número de itens em vez de fixar duas linhas de seis só para o caso de 12 dias. No celular (390 px), 12 dias ainda quebram em duas linhas de seis, pelo espaço disponível.
3. **`Botao` com `asChild` não decora o filho** (sem ícone, sem `<span>` de rótulo): quando `asChild` funde as props num único elemento (ex: um `<a>` de navegação), o Radix Slot exige exatamente um elemento React como filho. Ícone e rótulo animado (`carregando`) só existem no `<button>` nativo; quem usa `asChild` monta o próprio conteúdo do link.
4. **`tailwind-merge` estendido** com o vocabulário de `globals.css` (`src/lib/utils.ts`), documentado no comentário do arquivo: é a correção do achado do item 8 acima, e vale para qualquer componente futuro que combine um tamanho de texto customizado com uma cor customizada na mesma `className`.
5. **`estimativa`/`fato` fixos em `CabecalhoFamilia`**: são o vocabulário do próprio DESIGN.md (seção 2, "quatro datas com 'estimativa' e 'fato'"), não texto de negócio da tela; ficaram no componente, como o prefixo "D" em `ReguaDias` e os sufixos "s"/"d" em `formatarIdadeGestacional`. Todo o resto do texto visível (perguntas, rótulos de botão, mensagens de alerta) chega por propriedade.

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

# vitrine
pnpm build && pnpm start -p 3922
# abrir http://localhost:3922/design-system (celular: DevTools em 390x844)
```

## Resultado dos invariantes

Fora de escopo desta sessão (o P10 não é um dos quatro invariantes do capítulo 16.1: banco, mensageria/automação e sincronização offline não mudaram aqui). Os comandos de verificação do P10 (lint, format, typecheck, test, build, e2e) estão em "Como testar" e no resumo abaixo.
