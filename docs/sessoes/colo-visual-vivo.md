# Colo · visual vivo e acolhedor (v4.4)

Data: 30/09/2026
Branch: `claude/kraamzorg-delivery-review-6kzd8q` (sem worktree). Sem migration. Só apresentação e texto de interface: nenhuma regra de negócio, permissão, enum, contrato de dados ou teste de comportamento mudou.

Pedido do dono do projeto: o visual tinha ficado com cara de IA, genérico e burocrático. Ele quer mais vivo, mais acolhedor, "mais fofo, mais confi", com formas suaves e arredondadas, blocos de cor e informação muito mais bem dividida, seguindo as cinco referências que mandou, sem sair da identidade da Kraamzorg. Decisão dele, no meio do trabalho: um conjunto pequeno de ilustrações próprias em traço, nas cores da marca, quase como ícones, para estados vazios e para comemorar o checklist completo.

## O que foi feito

1. **PRD v4.4**, em commit separado (`PRD v4.4: acrescenta os tons de apoio da paleta para o visual acolhedor`): tons de apoio no 20.2 com receita, valor, uso e contraste medido; regras (superfície, nunca estado, nunca em momento sensível); a direção "Colo" no 20.1; a regra das ilustrações; a linha 6 do 20.6; o 2.0 com o que mudou. Tabela de tokens do CLAUDE.md na mesma linha.
2. **Direção** (`docs/design/DESIGN.md`, seção 2 reescrita): nome, âncora (o colo do símbolo), o que se levou de cada referência, princípios, formas, blocos de cor, tipografia com números grandes, ícone em tile, progresso, navegação, estados vazios, comemoração, o que nunca fazer e o contrato para quem revisa. Seções 4, 5.1, 6, 6.1 (guia para as outras telas), 8, 9, 10 e 11 ajustadas ao que mudou; o que continua da seção 11 (momentos sensíveis, voz) ficou.
3. **Sistema**: tokens novos em `src/app/globals.css` (nove tons de apoio, raios 6/16/28/pílula e a forma `colo`, `text-numero`, `text-numero-sm`, `toque-grande`, `--altura-abas`, movimento `desenhar` e `surgir`), espelhados em `docs/prototipo/assets/tokens.css` e no `cn()` (`src/lib/utils.ts`). Componentes novos e refeitos em `src/components/ui` e `src/components/shell`; casca com navegação inferior em pílula e barra lateral solta.
4. **Ilustrações**: dez peças desenhadas à mão em SVG em `src/components/ilustracoes`, com catálogo de uso.
5. **Telas-piloto**: checklist da enfermeira (uma pergunta por cartão, respostas em pílulas de 56 px, bloco da etapa em forma colo com a barra das perguntas, anel das etapas no botão "Etapas", lista de etapas em blocos com selo de estado, resumo com a contagem do que falta, comemoração do checklist completo, registro assinado em blocos); Hoje da enfermeira (cumprimento, trio de números, ficha pendente em bloco com link para a visita, cartão da visita com hora em pílula e endereço e telefone em linhas de tile, amanhã em bloco lavanda); Início do comercial (cumprimento, trio de números com link, títulos de seção com tile); Pipeline (abas em pílula, filtros num bloco, colunas `areia-clara` com a contagem em pílula, atalhos de estágio em pílula). Início da coordenação, da diretoria e toda tela "em construção" ganharam o cumprimento e o broto.
6. **Design system** (`/design-system`): nova vitrine "Colo" no topo com tons, forma, cabeçalho com cumprimento, cartões-resumo, tiles, abas, progresso, pergunta em cartão, lista em blocos, as dez ilustrações e a comemoração com "Ver o movimento de novo".

## Tokens novos

| Token                                           | Onde          | Uso                                                       |
| :---------------------------------------------- | :------------ | :-------------------------------------------------------- |
| `dourado-claro`, `dourado-medio`                | `globals.css` | O agora (abertura do dia, etapa atual, hora da visita)    |
| `areia-clara`                                   | `globals.css` | Família, pergunta respondida, coluna, lista, estado vazio |
| `salvia-clara`, `salvia-media`                  | `globals.css` | Feito (comemoração, etapa completa, check)                |
| `lavanda-clara`, `lavanda-media`                | `globals.css` | Tempo e agenda                                            |
| `argila-clara`, `argila-media`                  | `globals.css` | Pessoas e conversas                                       |
| `radius-1/2/3` = 6, 16, 28 px; `radius-colo`    | `globals.css` | Cantos generosos e o bloco de base curva                  |
| `text-numero` (44 px), `text-numero-sm` (24 px) | `globals.css` | Número grande em Jost                                     |
| `spacing-toque-grande` (56 px)                  | `globals.css` | Respostas do checklist, "Cheguei"                         |
| `--altura-abas` (76 px)                         | `globals.css` | Altura da navegação flutuante                             |
| `animate-desenhar`, `animate-surgir`            | `globals.css` | Só a comemoração                                          |

## Componentes novos e refeitos

- `src/components/ui/tons.ts` (tipo `Tom` e classes de fundo)
- `src/components/ui/tile-icone.tsx` (`TileIcone`)
- `src/components/ui/cartao-resumo.tsx` (`CartaoResumo`, com `destaque` e `fundo="branco"`)
- `src/components/ui/abas-pilula.tsx` (`AbasPilula`)
- `src/components/ui/anel-progresso.tsx` (`AnelProgresso`)
- `src/components/ui/barra-progresso.tsx` (`BarraProgresso`)
- `src/components/ui/lista-blocos.tsx` (`ListaBlocos`, `ItemBloco`)
- `src/components/ui/comemoracao.tsx` (`Comemoracao`)
- `src/components/ui/cartao.tsx` (variantes de tom e `forma="colo"`)
- `src/components/ui/estado-vazio.tsx` (bloco com ilustração; `variante="tracejado"`)
- `src/components/ui/sim-nao.tsx` (`arranjo="cartao"`)
- `src/components/ui/abas-inferiores.tsx` (pílula flutuante; `posicao`)
- `src/components/ui/barra-lateral.tsx` (bloco solto; `posicao`)
- `src/components/shell/cabecalho-saudacao.tsx` (`CabecalhoSaudacao`) e `saudacao.ts` (com teste)
- `src/components/shell/cabecalho-tela.tsx`, `casca-app.tsx`, `tela-em-construcao.tsx`
- `src/components/instrumentos/campo-instrumento.tsx` (`arranjo="cartao"`)
- `src/components/ilustracoes/` (`base.tsx`, `pecas.tsx`, `catalogo.ts`, `index.ts`)

## Decisões

- Tons de apoio por papel, não por variedade (DESIGN.md 2.5). Lavanda e argila vêm de `sensivel` e `alerta`: por isso nunca dividem bloco com um estado, e estado continua com lavado, borda, ícone e palavra.
- Família em freio, perda ou intercorrência: sem tom de apoio (`semTom` no checklist, no cartão da visita e no registro assinado). Sem comemoração com alerta na visita.
- A comemoração não diz "parabéns" nem usa exclamação (voz.md continua valendo): "Checklist do D4 completo. Falta só a sua assinatura." O carinho está no desenho e no movimento.
- O título das telas de abertura continua o dia (`h1`, DESIGN 11.4, testes de acolhimento e do portal); o cumprimento fica acima dele, em 17 px.
- Raios mudaram de valor (4/12/20 para 6/16/28) sem mudar de nome: `rounded-3` continua sendo o cartão, e os testes que acham o cartão por essa classe seguem valendo.
- A navegação inferior fica a 8 px das laterais para cinco abas caberem em 390 px com o rótulo inteiro ("Conversas" mede 66 px em 13 px).
- A ficha pendente do Hoje virou link para a visita (só com sinal); é navegação para uma tela que a enfermeira já abre, sem regra nova.
- O único teste alterado é o seletor do título do `/design-system` ("Caderneta de visita" virou "Colo"); o que ele prova não mudou.

## O que ficou de fora

- As outras telas do app ainda estão na direção anterior (com os raios novos, a casca nova e o estado vazio novo). Guia para aplicar em `docs/design/DESIGN.md`, seção 6.1.
- A casca da página de sem sinal (`casco-offline.tsx`) mantém o cabeçalho antigo; o conteúdo dela (o Hoje e a nuvem sem sinal) já é o novo.
- O protótipo estático recebeu só os tokens.

## Pendências novas

- Mostrar as ilustrações e a direção para a Kraamzorg na homologação (linha 6 do PRD 20.6).
- No registro assinado, campo de data aparece como "2026-09-30" (vem de `respostaParaLeitura`, `src/lib/checklist/formato.ts`); o formato brasileiro pede "30/09/2026". Mudança de formatação, fora desta sessão.
- Os perfis de teste do modo demonstração se chamam "Perfil Teste ...", e o cumprimento aparece como "Bom dia, Perfil".
- `claude/interface-clima-atual.md` e `interface-direcoes-usadas.md` não existem nesta sessão; a direção saiu por princípio e pelas referências.

## Comandos para testar

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=4800 pnpm e2e tests/e2e/p39-p40-checklist tests/e2e/p15-p17-pipeline tests/e2e/design-system.spec.ts tests/e2e/navegacao-por-papel.spec.ts tests/e2e/acolhimento tests/e2e/overflow.spec.ts --workers=1
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=4800 pnpm e2e:equipe-portal tests/e2e-equipe-portal/portal.spec.ts --workers=1
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=4800 pnpm e2e:offline --workers=1
pnpm dev:demo --port 4710 --hostname 127.0.0.1
```

Roteiro manual em `http://127.0.0.1:4710`: `/design-system` (vitrine "Colo" e "Ver o movimento de novo"); entrar como Enfermeira e abrir `/hoje` e `/visita/00000000-0000-4000-8530-000000000004` (responder uma pergunta e ver o cartão assentar em areia, a barra andar e o anel em "Etapas"); `/visita/00000000-0000-4000-8530-000000000009` (registro assinado em blocos); entrar como Comercial e abrir `/inicio` e `/pipeline` em 390 e 1280 px.

## Resultado dos comandos

- `pnpm lint`: 0 erros. `pnpm format:check`: tudo no padrão. `pnpm typecheck`: sem erro.
- `pnpm test`: 214 arquivos, 3.092 testes passando, 80 pulados (já eram pulados). Novos: `src/components/ui/colo.test.tsx` e `src/components/shell/saudacao.test.ts`.
- `pnpm e2e` (checklist, pipeline, design system, navegação por papel, acolhimento e sem rolagem lateral, `--workers=1`): 73 passando, com axe sem violação séria ou crítica. Na primeira rodada, o teste "Início abre pelo dia" do acolhimento achou a frase e o trio de cartões com o mesmo seletor de texto; o seletor passou a olhar só o parágrafo da frase, e o teste prova o mesmo de antes.
- `pnpm e2e:equipe-portal tests/e2e-equipe-portal/portal.spec.ts`: 14 passando.
- `pnpm e2e:offline`: 5 passando (invariante 4).
- `gitleaks detect --no-banner`: nenhum vazamento.
- `lint_slop.py` (interface-2026) nos componentes, nas telas-piloto e no `globals.css`: nenhum achado.
- Capturas 390 x 844 e 1280 x 800, antes e depois, em `scratchpad/visual-vivo/piloto/antes` e `.../depois` (fora do repositório): design system, Hoje, checklist (etapas 1 a 3, lista de etapas, resumo, registro assinado), Início do comercial, da coordenação e da diretoria, e Pipeline. Nenhuma tela rola de lado.
- Não rodados nesta sessão: `supabase test db` (nada de banco mudou) e `node --test n8n/build.test.mjs` (nada do n8n mudou).
