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

## Polimento

Data: 30/09/2026. Mesma branch, sem migration, sem função de banco nova. Só apresentação: nenhuma regra, permissão, enum ou contrato de dados mudou.

Crítica que abriu esta passada: o visual ainda estava tímido (quase tudo em areia e tons lavados, muito branco); a resposta escolhida no checklist não ficava inconfundível; a barra de ações e a navegação cobriam conteúdo no fim da página; o Início da coordenação e o da diretoria ainda diziam "em construção".

### O que mudou por tela

- **Sistema.** `CartaoResumo` ganhou `fundo="medio"` e `fundo="marinho"`, e o padrão mudou: sem `fundo`, o número principal (`destaque`) sai em marinho com tile dourado e os outros no tom médio do assunto com tile branco. `AbasPilula` e as abas da ficha: aba ativa em marinho com texto creme. Nova forma `encaixe-aba` (utilitário em `globals.css`, só forma, cor pela variável `--cor-aba`) e novo componente `BlocoAba` (`src/components/ui/bloco-aba.tsx`): título numa aba do mesmo tom, colada no bloco, com a curva côncava na junção; `tom="neutro"` para assunto sensível. `CabecalhoSaudacao`: o cumprimento mora numa aba em cima do bloco colo; o indicador lateral passou para a linha do título.
- **Checklist da enfermeira.** Resposta escolhida em marinho cheio com check; as outras recuam (sem fundo, borda fina, texto de apoio), em sim ou não, escolha única (ganhou o check) e escala de 0 a 10. O bloco da etapa traz o anel da visita inteira num disco branco encaixado, com a porcentagem das perguntas respondidas em número grande e a legenda "da visita" (texto para leitor de tela: "N% da visita respondida"). A navegação em pílula se esconde dentro de `/visita/...`; a barra de ações desce para 12 px do fundo, e o fim da página reserva a altura dela: em 390 x 844, o último cartão termina a 32 px acima da barra (antes sobravam 232 px vazios, e a pílula e a barra empilhadas ocupavam cerca de 330 px do fim da tela).
- **Hoje da enfermeira.** Trio: visitas de hoje em marinho, ficha pendente em argila médio, amanhã em lavanda médio. Cumprimento em aba.
- **Início do comercial.** Trio: transferências esperando em marinho, com a equipe em sálvia médio, tarefas em lavanda médio; os tiles das seções seguem o tom do cartão que aponta para elas.
- **Início da coordenação** (novo, `src/app/(app)/inicio/inicio-gestao.tsx` e `textos-gestao.ts`, com teste). Frase "Equipe agora: ..."; trio com visitas de hoje (marinho, "com N enfermeiras"), fichas sem assinatura (argila médio, as visitas em `ficha_pendente` da agenda desta semana) e ofertas sem resposta (lavanda médio, "a mais antiga há 18 h"). Blocos com aba: alertas clínicos abertos (neutro: frase calma, o que espera registro do acionamento, até quatro famílias com o selo da severidade), visitas de hoje por enfermeira (argila: uma linha por enfermeira, barra em pílulas contra o limite do dia, horas e famílias), radar da semana (lavanda: nasceram e esperam alta, datas prováveis de hoje até domingo, sempre ditas estimativa) e conversas de orientação que esperam registro (argila).
- **Início da diretoria** (novo). Frase do mês do painel executivo; trio com contratos assinados no mês contra a meta (marinho), famílias em atendimento com quantas começaram no mês (argila médio) e visitas realizadas contra o mês anterior (lavanda médio). Blocos: alertas clínicos (neutro), visitas de hoje por enfermeira (argila), capacidade (lavanda: a frase do resumo e as semanas em atenção ou sobrevenda) e o atalho do painel executivo. Sem AAL2, o trio volta a ser o do dia e o bloco do painel diz que os números pedem a verificação em duas etapas.
- **Radar.** Trio: na janela do parto em marinho, próximas semanas em lavanda médio, já nasceram em sálvia médio.
- **Agenda.** Hoje em marinho (o único bloco marinho da tela), dia com visita em lavanda médio, dia vazio em lavanda claro.
- **Sessões de venda.** A frase da agenda num bloco lavanda médio com tile branco.
- **Portal da família.** O passo de agora em dourado médio com tile branco.
- **Captação.** O bloco da conversa em argila médio com o tile encaixado na borda de cima.
- **Pipeline, Ficha e Conversas.** Aba ativa em marinho (pipeline 1 e 2, abas da ficha); o resto já estava no padrão.
- Momentos sensíveis continuam sem tom de apoio e sem ilustração: freio, perda e intercorrência seguem com `semTom`; o bloco de alertas clínicos do Início é neutro, com a aba de borda e sem curva.

### Decisões

- Um bloco marinho por tela, no máximo quatro tons contando o marinho. Dentro do bloco `dourado-claro`, "família" usa argila: `areia` (o tom médio da areia) e `dourado-claro` têm o mesmo valor e o cartão sumia.
- Fichas sem assinatura contam a semana corrente da agenda (segunda a domingo), porque não existe leitura de "fichas pendentes" da equipe inteira sem janela; nenhum prazo novo entrou no código. A tela diz "nesta semana".
- Os alertas do Início vêm de `api.alertas_clinicos` (mesma leitura da tela de alertas, que grava o log de leitura); o Início mostra só família, dia, severidade e se falta o registro do acionamento, nunca o achado nem a conduta.
- O teste "tela sem módulo" do acolhimento (`tests/e2e/acolhimento/acolhimento.spec.ts`) usava o Início da diretoria como exemplo de tela em construção; passou para o Início do financeiro, que continua em construção. O que ele prova não mudou.
- `obterFraseEquipe` (`src/modules/operacao/equipe/dados.ts`) saiu: o Início agora lê a equipe junto com a agenda.

### O que ficou de fora

- Início do financeiro e do marketing continuam "em construção".
- Os títulos de seção do Hoje, das Sessões e do Portal continuam tile e título soltos; o `BlocoAba` pode entrar nelas numa próxima passada.
- O anel do checklist conta etapas nos segmentos e perguntas no número; se a enfermeira estranhar, o número pode virar "etapas completas".

### Capturas

`scratchpad/visual-vivo/polimento/antes` e `.../depois` (fora do repositório), 390 x 844 e 1280 x 800: hoje, checklist (topo, fim da página e resposta escolhida), inicio (comercial), inicio-coord, inicio-dir, pipeline, ficha, sessoes, conversas, agenda, radar, portal-familia e captacao. Nenhuma tela rola de lado.

### Resultado dos comandos

- `pnpm lint`: 0 erros. `pnpm format:check`: tudo no padrão. `pnpm typecheck`: sem erro.
- `pnpm test`: 3.108 testes passando, 80 pulados (já eram pulados). Novo: `src/app/(app)/inicio/textos-gestao.test.ts`.
- `pnpm e2e --workers=2`: 244 passando, 2 pulados (já eram pulados).
- `pnpm e2e:equipe-portal --workers=2`: 30 passando. `pnpm e2e:offline`: 5 passando (invariante 4).
- `gitleaks detect --no-banner`: nenhum vazamento. `lint_slop.py` (interface-2026) nos arquivos novos: nenhum achado.
- Não rodados: `supabase test db` (nada de banco mudou) e `node --test n8n/build.test.mjs` (nada do n8n mudou).
