# Acolhimento · onda B, telas e componentes que já existem

Data: 29/09/2026
Branch: `worktree-wf_b1810e77-328-4` (worktree isolado, criado a partir de `claude/kraamzorg-delivery-review-6kzd8q` com a direção de acolhimento já commitada em `6dec5a1`). Sem push. Sem migration nova.

Pedido do dono do projeto, nas palavras dele: como o assunto é gestação, a linguagem visual e a de fala precisam ser o mais aconchegantes e acolhedoras possível, no nível de excelência, sem nada genérico.

Esta sessão aplicou a camada de acolhimento (`docs/design/DESIGN.md`, seção 11; `docs/design/voz.md`) às telas e componentes que já existiam, na ordem da lista de mudanças da onda B (P0 a P3). Só apresentação e texto: nenhuma regra de negócio, permissão, enum, migration ou contrato de dados mudou. Nenhuma cor, fonte, raio ou sombra fora do `@theme` de `src/app/globals.css`.

## Como a direção foi lida

- Leitura de contexto: DESIGN.md (seções 1 a 11), voz.md, PRODUCT.md, a lista de mudanças da onda B e as capturas de antes. Tratado como "peça dentro de sistema existente" (interface-2026) e como refinamento que preserva a identidade (Impeccable, modo Operate; Taste, "redesign preserve", discos 3/2/5). Lucide fica, porque o briefing e o DESIGN pedem, mesmo com a Taste preferindo outra biblioteca.
- Skills usadas juntas no visual: interface-2026 (antislop, gráficos e dados), anti-ai-slop-visual, Impeccable (craft floor, operate, clarify; `impeccable context` rodou e não achou PRODUCT.md na raiz, então os dois arquivos de `docs/design` foram lidos direto), Taste (redesign-skill e taste-skill) e dataviz (a tela de números do mês e a linha da gestação). No texto, anti-ai-slop, com o verificador `checar_slop.py` passando limpo (peso 0) em todos os textos novos.
- Diagnóstico em uma frase: o sistema estava mecanicamente certo e esfriava nas palavras, na ordem do que aparece e no jeito de tratar a perda; o conserto é de hierarquia e de texto, não de cor.

## Feito

### P0 · Luto e segurança emocional

1. **Conversa de família com freio** (`src/modules/agente/formatacao.ts`, `tipos.ts`): `situacaoDaConversa` ganhou a situação `freio`, que vence pausa, encerramento e classificação quando a família está em bloqueio total ou encerrada em estado sensível (`freioDesligaIsadora`). Em "atenção" a Isadora continua, como no PRD 8.3. O painel da conversa (`painel-resumo.tsx`) foi dividido em `FaixaEstadoConversa` e `PainelResumo`: com o freio, some "A Isadora está conduzindo", some "Assumir" da faixa, some "Pausar a Isadora", some "Marcar como não lead" e some o resumo comercial da Isadora; entra a faixa ameixa "A Isadora está desligada para esta família. Só a equipe responde, pelo nome. Nenhuma mensagem automática sai para Camila." O compositor deixa de oferecer texto comercial nessa situação. A lista ganhou o filtro "Com freio".
2. **Prazo vencido em vermelho no cartão de perda** (`cartao-transferencia.tsx`): perda e estado sensível sempre em ameixa lavado, com qualquer prioridade; no canto, "recebida às 13:43" (octógono de pausa, `texto-2`, hora em mono) e, depois do prazo e sem ninguém ter assumido, a linha "Ainda sem contato da equipe." Nenhum `text-alerta`, `ClockAlert` ou `Hourglass` nesse cartão; a falha do aviso ao grupo aparece em ameixa ali. A ordem da fila não muda. O mesmo tratamento vale no cartão de transferência dentro da conversa.
3. **Cabeçalho da família** (`cabecalho-familia.tsx`, `cabecalho-ficha.tsx`, novo `meta-ficha.tsx`): saiu "vira fato quando acontecer" de cada data; com data ausente, uma legenda única ("A DPP é estimativa. Nascimento, alta e início entram quando acontecem."). Nova prop `modoSensivel`: com bloqueio total ou encerrado sensível, as quatro datas continuam visíveis (PRD 20.4), a ausente vira "sem registro" em texto simples, a legenda some, e saem o selo do estágio e a IG da linha de meta. Ficha e conversa usam o mesmo `MetaFicha` e `datasDoCabecalho`.
4. **Resumo de perda na demonstração** (`src/lib/dados/demonstracao/fixtures.ts`): "A família contou que perdeu o bebê. Nenhuma mensagem automática sai mais para ela. A coordenação clínica faz o contato, pelo nome."
5. **"Marcar como resolvida" numa transferência sensível**: o rótulo agora sai de `src/lib/rotulos-a-confirmar.ts` (`resolverSensivel`), com "Registrar o contato com a família" preparado e `aprovado: false` [confirmar: Leonardo e Edilaine]. A ação no banco é a mesma.

### P1 · Linguagem, hierarquia e ruído

1. **Telas sem módulo** (`tela-em-construcao.tsx` e as páginas de Hoje, Famílias, Alertas, Perfil, Início por papel, Agenda, Radar, Equipe, Financeiro, Cobranças, Notas): título fixo "Esta parte ainda está em construção." e o texto no molde "Aqui você vai ver ...", sem nomear componente. `grep -rn "vai aparecer aqui\|vão aparecer aqui" src` volta vazio. Hoje perdeu o botão "Ver minhas famílias", que levava a outra tela em construção.
2. **Telas de abertura** (`cabecalho-tela.tsx` com `abertura`, `inicio/page.tsx`, `inicio/frase-do-dia.ts`): o título é o dia ("Terça, 29/09"; na enfermeira, "Hoje, terça 29/09") e a frase de estado vem logo abaixo em `text-3` marinho ("Duas transferências esperam alguém da equipe e quatro tarefas vencem hoje."). A frase conta só as transferências ainda sem ninguém e separa atrasadas de hoje. O `<title>` continua "Início".
3. **Conversas, uma ação por cartão** (`cartao-conversa.tsx`): a ação principal do estado fica visível ("Assumir conversa", "Abrir conversa", "Devolver agora", "Assumir na fila" ou "Abrir com cuidado"); "Pausar a Isadora", "Marcar como resolvida" e "Marcar como não lead" foram para o menu de três pontos "Mais ações para {família}" (`@radix-ui/react-dropdown-menu`). A prévia da resposta automática diz "Resposta automática", não "Sistema".
4. **Conversa no celular** (`conversas/[id]/page.tsx`): ordem humana. No celular: cabeçalho, faixa de estado, o que a família disse, o campo de resposta, e só depois o resumo e as ações. O resumo da Isadora vira uma linha que abre ao tocar ("Resumo da Isadora: Pinheiros, 9s1d, DPP 03/05/2027"). No computador, as duas colunas continuam.
5. **Destino da transferência** (`tipos.ts`): "com a coordenação clínica", "com o comercial", "com a operação", e o cartão diz "Família Teste Bruma, com a coordenação clínica".
6. **Configurações**: ajuda dos termos sem "(PRD 11.2)"; a coluna "Mensagem enviada" virou "Texto que a família recebe", com o começo do texto aprovado que abre para o texto inteiro e o estado da aprovação (`texto-da-familia.tsx`). O texto vem de `mensagem_modelo` pela leitura comum do repositório (a RLS deixa a coordenação ler), nunca de um mapa no código. O formulário do termo e o da faixa da régua escolhem pelo texto, não pela chave. "(PRD 7.2)" e "(PRD 13)" saíram de dois textos de tela.
7. **Base de conhecimento**: "A Isadora leu a base pela última vez em 27/09/2026, 15:49, com 2 itens aprovados." e o botão "Atualizar o que a Isadora sabe" (carregando: "Atualizando"). O tipo do item virou selo neutro ao lado do selo de estado.
8. **Números do mês** (`metricas/linhas.ts`, `painel-metricas.tsx`): a grade de sete cartões virou uma lista que fala, uma linha por métrica, com o número em mono, a meta ao lado e "na meta" ou "abaixo da meta" com ícone quando a meta é mensurável. Zero vira frase ("Nenhuma conversa com a Edilaine registrada no período."). A conversão traz a base ("50% dos 6 leads do período fecharam contrato."). A nota de amostra pequena depende de `parametro.agente_metricas_amostra_minima`, que ainda não existe: sem ele, nenhuma nota e nenhum número fixo no código (pendência abaixo).
9. **Pipeline no celular** (`filtros-pipeline.tsx`, novos `campos-filtro.tsx` e `filtros-pipeline-celular.tsx`): abaixo de 600 px, a busca fica à vista e o resto vai para "Filtros · n", que abre a folha "Filtrar o pipeline"; o cabeçalho quebra em duas linhas. `scrollWidth` do pipeline em 390 px: 395 antes, 390 depois.
10. **Tarefas no Início** (`lista-tarefas.tsx`): com um grupo só, um título só, "Tarefas de hoje · 4"; com mais de um, os grupos descem para h3.
11. **Erros com nome**: nenhum "Não deu certo" nem "Algo não saiu como esperado" (auth). Cada título nomeia a ação que falhou ("O aviso não foi reenviado", "A conversa não foi assumida", "A mensagem não saiu", "O item não foi salvo" etc.). As telas de erro dizem primeiro o que está a salvo. Além da lista: as faixas de erro operacional de 36 arquivos usavam a variante `imediato` (ícone de sirene, reservado ao alerta clínico, DESIGN.md seção 5 e o comentário de `faixa-alerta.tsx`); todas passaram para `erro`.
12. **Resposta automática**: "Resposta automática, texto aprovado".
13. **Pipeline**: "Neste estágio desde hoje", "Neste estágio há 3 dias". O cartão com encerrado sensível dizia "Freio em atenção"; agora cada estado tem o próprio rótulo, e o cartão em atenção não diz mais que nenhuma mensagem sai (em atenção, os avisos da operação continuam). Em perda, o cartão tira a IG e a palavra de venda (quente, morno, frio).
14. "Só contato humano e nominal" virou "pelo nome" em tarefas, verificador do freio e vitrine.

### P2 · Forma, dado e documento

1. **Linha da gestação** (novo `src/components/ui/linha-gestacao.tsx`, proposta da direção, a mostrar na revisão): dez blocos de quatro semanas herdados da régua de dias, cheios em marinho até a semana atual, os seguintes tracejados, frase inteira no `aria-label` ("32 semanas e 4 dias, DPP estimada em 15/11/2026"). Na ficha, o bloco atual tem a borda dourada; no cartão do pipeline, marinho cheio, sem o acento. Some depois do nascimento e em modo sensível. A semana sai de `calcularIdadeGestacional` (a mesma conta de `ig(dpp, data)`), nada gravado.
2. **Progresso do instrumento** (novo `progresso-etapas.tsx`): a barra de biblioteca virou blocos da régua (feitas em marinho, atual com borda dourada, seguintes tracejadas); acima de 12 etapas, um bloco por seção do instrumento, com largura proporcional. "Etapa 1 de 26" continua.
3. **Evolução em PDF** (`src/lib/pdf/componentes.tsx`, `documento.tsx`): título de seção em Jost 500 marinho; data, peso, temperatura, frequência e porcentagem em IBM Plex Mono dentro da frase (`partesComMedidas`); as pesagens da "Curva de peso" em tabela (data, dia de vida, peso alinhado à direita, onde foi pesado), sem cor. Só apresentação: o conteúdo e o rascunho continuam em campos de texto. Os testes que leem o PDF passam, e o rodapé continua dentro da folha.
4. **Vitrine** (`design-system/vitrine.tsx`): o exemplo de alerta clínico agora é 38,4 °C, que dispara a PU-01 do seed; 78 bpm ficou normal.

### P3 · Rótulos preparados

`src/lib/rotulos-a-confirmar.ts` guarda, com quem decide e `aprovado: false`: "Registrar o contato com a família" [Leonardo e Edilaine], "Outro assunto" e "Marcar como outro assunto" [Leonardo], "Não seguiu", "Encerrar: não seguiu com a Kraamzorg" e "Por que não seguiu" [Leonardo]. As telas já leem por `rotulo()` (situação, filtro, painel, lista, estágios, folha de perda); a troca vai ao ar mudando `aprovado` num commit com o nome de quem aprovou. O teste falha se algum for ligado sem esse passo. Enum `perdido` e modo `nao_lead` não mudam.

## Capturas

Antes e depois, 390 x 844 e 1280 x 800, modo demonstração (`NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao`, `next start`), fora do repositório: `scratchpad/onda-b/capturas/antes/` e `scratchpad/onda-b/capturas/depois/` (script `scratchpad/onda-b/cap.mjs`). Telas: entrar, `/design-system/instrumentos`, Início do comercial e da coordenação, Transferências, Conversas, Pipeline, Tarefas, ficha e conversa da Família Teste Bruma, Configurações (coordenação), Isadora (diretoria), Hoje, Perfil e Alertas da enfermeira; na segunda rodada, ficha e conversa da Família Teste Aurora. `medidas.txt` de cada pasta traz o `scrollWidth` de cada tela: todas em 390 no depois (o pipeline media 395 antes).

O que as capturas mostram de diferente:

- Conversa da Bruma: sem "conduzindo", sem "não lead", sem "venceu", sem "vira fato"; faixa ameixa de Isadora desligada, as mensagens logo abaixo do cabeçalho no celular, e a transferência com "recebida às".
- Início do comercial: "Terça, 29/09" como título e a frase de estado em marinho; o cartão de perda em ameixa com a hora do relato; "Tarefas de hoje · 4".
- Conversas: uma ação por cartão e o menu de três pontos; Bruma com "Abrir com cuidado".
- Pipeline 390: busca e "Filtros" numa linha, a primeira família na primeira dobra, a linha da gestação em cada cartão.
- Isadora (diretoria): os números do mês em lista, com meta e estado.

## Decisões tomadas

- **Alertas da enfermeira não diz "Nenhum alerta aberto"** (voz.md propunha). O módulo de alertas não está ligado a essa tela: dizer que não há alerta numa tela que não lê alertas seria uma tranquilidade falsa num assunto clínico. Ficou o molde de construção: "Aqui você vai ver os alertas abertos das famílias que você acompanha, com o que falta registrar em cada um." Quando o P40 ligar a tela, o texto de dia tranquilo de voz.md entra.
- **"3 de 6 leads"**: `MetricasAgente` não traz o numerador de cada métrica e a base da conversão (oportunidades) não é a mesma de `leadsTotal` (conversas). Para não inventar contagem, a frase traz a porcentagem com a base de leads do período ("50% dos 6 leads do período fecharam contrato."). A contagem exata pede que `api.metricas_agente` devolva numerador e denominador (pendência).
- **Metas do PRD 11.12** continuam no código, como já estavam, agora isoladas em `METAS_AGENTE` (`metricas/linhas.ts`), com a pendência de ir para `parametro`.
- **Desfecho de transferência sensível**: `api.resolver_transferencia` só aceita os quatro desfechos comerciais (formulário enviado, sessão marcada, condição negociada, sem retorno). Mudar isso pede migration, fora do escopo. A tela mantém as quatro opções; pendência abaixo.
- **"Mover para" no cartão de família em luto** continua: é o único caminho para mover a oportunidade (para intercorrência ou perdido), e esconder seria tirar uma capacidade do comercial. Pendência para o Leonardo decidir.
- **Resumo da Isadora no celular e no computador** mora duas vezes no DOM (um `<details>` no celular, um bloco aberto no computador) e o CSS mostra um: abrir o `<details>` por JavaScript depois da hidratação faria o bloco pular.
- **Transferência na conversa de um papel que não é o destino**: o cartão dentro da conversa ainda oferece "Assumir conversa" ao comercial numa transferência da coordenação (o cartão da fila já não oferece). Comportamento anterior, fora desta camada; anotado.

## O que ficou de fora

- Portal da família e formulário público (P30, P47, P49): as rotas ainda não existem.
- Linha D1 a Dn depois do nascimento nos cartões e na ficha: a régua existe, mas a tela comercial não tem o plano e o dia do acompanhamento; a linha da gestação simplesmente some depois do nascimento.
- Nome da enfermeira e COREN na primeira página do PDF [confirmar: Edilaine]: mexe na ordem do documento clínico; não foi feito.
- Textos para a família (`regua_28_34`, `regua_nasceu`, `promotor_indicacao`, e o resumo de perda que o fluxo do agente grava em produção): continuam como estão; vão para a rodada de aprovação de `mensagem_modelo` e para quem cuida de `n8n/`.
- Data no campo nativo (`input type="date"` mostrou mm/dd/yyyy no Chromium sem locale): as capturas desta sessão rodaram com `locale: pt-BR`; conferir num aparelho real antes de trocar o campo.
- `impeccable detect` continua marcando o sublinhado de 2 px da aba do pipeline (`pipeline/page.tsx`): falso positivo, é o padrão de aba do DESIGN.md seção 6.

## Pendências novas

- [confirmar: Leonardo e Edilaine] ligar `resolverSensivel` em `src/lib/rotulos-a-confirmar.ts`.
- [confirmar: Leonardo] ligar `naoLead`, `marcarNaoLead`, `estagioPerdido`, `marcarPerdido`, `motivoPerda`.
- [confirmar: Leonardo] criar `parametro.agente_metricas_amostra_minima` (proposta: 20) no seed e na migration da vez; a tela já lê.
- Levar `METAS_AGENTE` para `parametro` (metas do PRD 11.12).
- `api.metricas_agente` devolver numerador e denominador de cada métrica, para a contagem vir antes da porcentagem.
- Desfecho próprio para transferência sensível (por exemplo `contato_feito`) em `api.resolver_transferencia` [confirmar: Leonardo e Edilaine].
- Esconder "Mover para" no cartão de família em luto, se o Leonardo preferir mover pela ficha [confirmar: Leonardo].
- Em produção, tirar da navegação a rota sem módulo [confirmar: Leonardo].
- Resumo de perda gravado pelo fluxo do agente em produção: mesmo texto da demonstração, para quem cuida de `n8n/` e `mensagem_modelo`.
- A demonstração de `configuracoes` só deixa a diretoria listar mensagens em `listarMensagensDetalhe`, mais restrita que a RLS (que deixa a coordenação ler): a tela de termos passou a usar a leitura comum; alinhar a demonstração quando o módulo for revisto.

## Comandos para testar

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
PGPORT=54392 PGDATA=/tmp/kz-pg-acolhe supabase/sem-docker/scripts/iniciar.sh
PGPORT=54392 PGDATA=/tmp/kz-pg-acolhe supabase/sem-docker/scripts/testar.sh
PGPORT=54392 PGDATA=/tmp/kz-pg-acolhe supabase/sem-docker/scripts/parar.sh
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=4010 pnpm e2e
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=4010 pnpm exec playwright test tests/e2e/acolhimento
```

Roteiro manual, modo demonstração: entrar como Comercial, abrir Conversas e tocar em "Abrir com cuidado" na Família Teste Bruma (faixa ameixa, nenhuma ação comercial, "sem registro" nas datas); voltar ao Início (dia como título, cartão de perda com "recebida às"); abrir o Pipeline em 390 px (sem rolagem lateral, "Filtros" abre a folha); entrar como Diretoria e abrir Isadora (números do mês em lista).

## Testes novos e ajustados

- Unitários novos: `src/lib/rotulos-a-confirmar.test.ts`, `src/app/(app)/inicio/frase-do-dia.test.ts`, `src/modules/agente/metricas/linhas.test.ts`, `src/components/ui/progresso-etapas.test.tsx` (inclui a linha da gestação), `src/lib/pdf/apresentacao.test.ts`; casos novos em `formatacao.test.ts` (freio vence pausa e classificação), `lista-conversas.test.tsx` (cartão com freio, uma ação por cartão), `cartao-transferencia.test.tsx` (perda com prazo vencido sem `text-alerta` e com "recebida às") e `cabecalho-familia.test.tsx` (legenda única; "sem registro" no modo sensível).
- E2E novo: `tests/e2e/acolhimento/acolhimento.spec.ts` (conversa da Bruma, fila, Início, pipeline no celular, tela em construção, números do mês), nos dois projetos.
- E2E existentes, só seletor de texto (o que cada teste prova não mudou): `p16-ficha/ficha.spec.ts` ("Nenhum marco registrado ainda"; "estimativa" exato, porque a legenda nova também tem a palavra), `p27-agente/agente-admin.spec.ts` (a métrica em frase) e `p27-agente/transferencias.spec.ts` (na perda, a faixa diz que a Isadora está desligada, não pausada).

## Resultado dos comandos

- `pnpm lint`: 0 erros, 1 aviso anterior a esta sessão (`n8n/referencia/comparar.mjs`, variável sem uso).
- `pnpm format:check`: todos os arquivos no padrão.
- `pnpm typecheck`: sem erro.
- `pnpm test`: 105 arquivos, 1.362 testes, todos passando.
- `supabase/sem-docker/scripts/testar.sh` (porta 54392, `PGDATA=/tmp/kz-pg-acolhe`): 19 arquivos, 2.165 testes pgTAP, `Result: PASS`. Servidor parado no fim.
- `pnpm e2e` (`PW_PORT=4010`, Chromium de `/opt/pw-browsers/chromium`): 166 passaram, 2 pulados por desenho (o teste de 390 px só no celular e um anterior), 0 falhas. Na primeira rodada, 5 falhas de seletor de texto, corrigidas como descrito acima.
- `pnpm e2e:offline` (`PW_PORT=4020`, invariante 4): 3 passaram.
- `impeccable detect` em `src/components`, `src/modules/agente`, `src/modules/crm`, `src/modules/configuracoes` e `src/app`: 1 aviso, o falso positivo conhecido da aba do pipeline.
- `lint_slop.py` (interface-2026) em `src`: só as guardas de teste contra travessão e os emojis permitidos nos textos aprovados de mensagem (PRD 11.6).
- `checar_slop.py` (anti-ai-slop) nos textos novos da interface: peso 0.
- Capturas: 17 telas em 390 e 1280 no depois, todas com `scrollWidth` igual à largura da janela.
