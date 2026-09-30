# Colo · operação, portal da enfermeira e família

Data: 30/09/2026
Frente da direção "Colo" (v4.4) que cobre a operação, o portal da enfermeira, o portal da família e as páginas públicas. Sem migration. Só apresentação e texto de interface: nenhuma regra de negócio, permissão, contrato de dados ou teste de comportamento mudou. Base: o sistema da sessão `colo-visual-vivo.md` (tokens, componentes, ilustrações e o guia da seção 6.1 do `docs/design/DESIGN.md`).

## Telas feitas

Coordenação e diretoria

- **Radar** (`/radar`): trio de números (na janela do parto, próximas semanas, já nasceram), filtro de praça em pílula, seções com tile e contagem, cartão da família com titular e backup num bloco de pessoas, e a ocupação por praça em bloco lavanda com a régua de dez blocos por semana e o traço do limite. Só a semana acima do limite ganha selo; o "dentro do limite" em toda linha saiu (DESIGN.md 11.10).
- **Alocação** (`/radar/[familiaId]`): a família num bloco areia com as datas em blocos pequenos (estimativa e fato marcados), titular e backup lado a lado (argila quando há alguém, branco quando falta designar), nascimento e alta como trabalho a fazer, visitas em lavanda.
- **Pré-natal** (`/prenatal` e a entrevista): trio de números, cartões com a consulta marcada num bloco lavanda e a barra das etapas já passadas, concluídas encolhidas em blocos sálvia; na entrevista, marcar em branco, remarcar em lavanda, a família num bloco areia e as respostas guardadas em areia.
- **Agenda** (`/agenda`, reagendar e cascata): a semana em sete blocos com o número de visitas de cada dia (hoje em dourado), cada dia num bloco lavanda com a hora numa coluna, conversa de orientação em argila, abas de dia e semana e de enfermeira em pílula; reagendar e cascata com o "como está" em lavanda e o formulário em branco.
- **Equipe e escala** (`/equipe`, `/equipe/escala`, `/equipe/[id]`, `/equipe/nova`): trio de números (com famílias agora, livres, ofertas sem resposta), cartão da enfermeira com tile de pessoa e as famílias num bloco areia, escala em blocos lavanda, cadastro com semana e famílias lado a lado e documentos e bloqueios em blocos.
- **Alertas clínicos** (`/alertas-clinicos` e `/alertas` da enfermeira): calmos, sem tom de apoio. Cada alerta num cartão branco, a faixa clínica como antes, abas em pílula; só a lista vazia de abertos leva o sino calmo.
- **Evoluções** (lista, e o documento para coordenação e enfermeira): números de "para preencher" e "em revisão ou envio" (e "enviadas" em Todas), cartão por família com os documentos em blocos (bebê com o ícone do bebê, mãe com a prancheta), concluída em sálvia; no documento, cabeçalho em areia, "Próximo passo" em dourado e a prévia do médico sobre papel branco.
- **Ocorrências** (lista, detalhe e nova): tabela num bloco branco no computador, abas em pílula; no detalhe, duas colunas (situação e histórico à esquerda, andamento fixo à direita). Ocorrência privada fica neutra, sem tom.
- **Pós-venda** (`/pos-venda`): trio de números (a enviar, esperando a família, respondidas com a classificação e o NPS), cartão pela etapa (esperando em lavanda, ação feita em sálvia), nota em número grande. Família em pausa e nota baixa ficam neutras.

Portal da enfermeira

- **Famílias** (`/minhas-familias`): cada família num bloco areia com a régua do acompanhamento (feito, ficha pendente, hoje) e a próxima visita em dourado (hoje) ou lavanda. Família em pausa sem tom e sem régua.
- **Ficha da família** (`/minhas-familias/[id]`): abertura com a régua e a próxima visita; casa e contato, datas, bebê, médicos e visitas em blocos com linhas brancas.
- **Perfil**: quem ela é num bloco argila com o estado de hoje, a semana dia a dia (hoje em dourado), documentos em areia e os atalhos (ofertas, treinamentos, manuais, instalar) em lista de blocos; avisos no aparelho com tile.
- **Ofertas**: a oferta como o "agora" em bloco dourado, os dados em blocos brancos e o prazo num bloco dourado médio.
- **Treinamentos**: trilha em bloco areia com a barra dos manuais lidos; lidos em sálvia.
- **Sem sinal** (`/portal-offline`): cabeçalho novo (`CabecalhoTela`), ícones da navegação iguais aos do portal e a nuvem sem sinal nos alertas.

Família e páginas públicas

- **Portal da família** (`/familia`): abertura em forma colo com "Oi, Aurora."; próximos passos com o feito em sálvia, o agora em dourado e o que vem em tracejado; datas e visitas em lavanda, enfermeira em argila, guia em areia, opinião em argila e o contato da equipe como o único bloco forte, em marinho. Família em pausa vê só o contato, sem tom.
- **Entrar e confirmar** (`/familia/entrar`, `/familia/confirmar`): abertura colo; o link enviado aparece num bloco sálvia com o check.
- **Captação** (`/c/[canal]`): abertura colo, o "como funciona" e o botão do WhatsApp num bloco argila (conversa), privacidade com o cadeado.
- **Formulário seguro** (`/formulario/[token]`): abertura colo na primeira etapa, a etapa num cartão branco com a régua de etapas, e o recebido num bloco colo sálvia com o check. Link vencido num bloco branco.
- **Pesquisa** (`/pesquisa/[token]`): abertura colo, uma pergunta por cartão (sem resposta em branco, respondida em areia, as de sim ou não com as respostas largas), agradecimento num bloco colo sálvia.
- **Instalar**: abertura colo, o passo a passo em blocos numerados e o instalado em sálvia.
- **Candidatura**: abertura colo (areia quando a página está desligada), formulário em branco e o recebido em sálvia.

## Componente novo

- `src/modules/operacao/comum/titulo-secao.tsx` (`TituloSecao`): tile quadrado no tom do assunto, título em Jost 20, contagem numa pílula areia com a unidade para o leitor de tela e a frase de apoio. `tom="neutro"` deixa o tile branco para assunto sério. Criado no módulo, como pedido (nada novo em `src/components/ui`); a operação, a enfermeira e a família usam este. Se as outras frentes precisarem, vale subir para `src/components/ui` numa sessão própria.

Nenhum componente de `src/components/ui`, `src/components/shell` ou `src/components/ilustracoes` mudou.

## Decisões

- Ilustração só em estado vazio e nunca em momento sensível: janela da manhã (agenda vazia), manta dobrada (nada neste estágio: pré-natal, evoluções, pós-venda, ofertas, treinamentos, cascata), chave de casa (nenhuma família ou enfermeira ainda), folha e lupa (filtro ou busca sem resultado), sino calmo (nenhum alerta ou ocorrência aberta), nuvem sem sinal (alertas sem sinal).
- Tom pelo papel: dourado para o agora (na janela, a marcar, a oferta, o passo de agora), lavanda para o tempo (agenda, semana, datas, visitas), areia para a família e o guardado, argila para pessoas e conversas, sálvia para o feito. Estado continua com selo, faixa e ícone.
- Momentos sensíveis ficam sem tom: família em freio ou perda (radar, alocação, ficha da enfermeira, portal da família, pós-venda), alerta clínico, ocorrência privada e nota baixa.
- O selo "Na janela do parto" saiu de cada cartão do radar: a seção já diz, e o dourado repetido em todo cartão tirava o acento da tela.
- A régua da ocupação usa dez blocos preenchidos de forma contínua (3,3% não vira um bloco inteiro) e o traço do limite; a porcentagem passou a ter vírgula ("20,5%").
- Nas listas de definição (`dl`), o ícone mora dentro do `dt`, para o axe não reclamar de filho fora de `dt`/`dd`.
- Nenhum texto que fala com a família foi escrito aqui: os textos do portal, da captação, do formulário e da pesquisa continuam vindo de `mensagem_modelo`. Os rótulos novos da equipe ("com famílias agora", "a próxima data provável em 25 dias") são rótulo de tela.

## Teste alterado

- `tests/e2e-equipe-portal/agenda.spec.ts`, "sem conflito, salva direto": o teste passou a esperar a primeira conferência da agenda ("Sem conflito na agenda") antes de digitar o dia novo. Com a máquina carregada, o dia era digitado antes da hidratação, se perdia e o botão ficava desligado (o instantâneo mostrou o campo com a data antiga). O teste prova o mesmo de antes; nenhum código da tela mudou para isso.

## O que ficou de fora e pendências

- O `posVenda` da navegação usa o ícone `MessageSquareHeart` (coração), que o DESIGN.md 11.6 tira da interface. Mora em `src/components/shell/icones-navegacao.tsx`, fora desta frente.
- A escala 0 a 10 e a escolha única têm o rótulo em 14 px; nas superfícies da família o DESIGN.md 11.4 pede 17 px. São componentes compartilhados de `src/components/ui`.
- Na tabela de ocorrências do computador, a coluna Família quebra o nome em três linhas; a tabela é compartilhada.
- `TituloSecao` pode subir para `src/components/ui` se as outras frentes quiserem o mesmo título.

## Comandos para testar

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=5360 pnpm e2e tests/e2e/p35-p36-operacao tests/e2e/p39-p40-checklist/alertas.spec.ts tests/e2e/p29-p30-venda/formulario.spec.ts tests/e2e/acolhimento tests/e2e/overflow.spec.ts tests/e2e/navegacao-por-papel.spec.ts --workers=1
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=5360 pnpm e2e:equipe-portal --workers=1
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=5360 pnpm e2e:evolucao-ocorrencia-nf --workers=1
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=5360 pnpm e2e:relacao --workers=1
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=5360 pnpm e2e:offline --workers=1
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=5370 pnpm e2e:infra --workers=1
pnpm dev:demo --port 4763 --hostname 127.0.0.1
```

Roteiro manual em `http://127.0.0.1:4763`, em 390 e 1280 px: como Coordenação, `/radar`, a alocação de uma família, `/prenatal`, `/agenda`, `/equipe`, `/equipe/escala`, `/alertas-clinicos`, `/evolucoes`, `/ocorrencias`, `/pos-venda`; como Enfermeira, `/minhas-familias`, a ficha, `/perfil`, `/ofertas`, `/treinamentos`, `/minhas-evolucoes`; sem sessão, `/familia/entrar` com `aurora.teste@exemplo.invalid` e o link de demonstração, `/c/igbio`, `/instalar`, `/candidatura`.

## Resultado dos comandos

- `pnpm lint`: 0 erros. `pnpm format:check`: tudo no padrão. `pnpm typecheck`: sem erro.
- `pnpm test`: 214 arquivos, 3.093 testes passando, 80 pulados (já eram pulados).
- `pnpm e2e` (operação, alertas, formulário, acolhimento, sem rolagem lateral, navegação; `--workers=1`): 71 passando, 1 pulado (só roda em 390 px), com axe sem violação séria ou crítica.
- `pnpm e2e:equipe-portal`: 30 passando.
- `pnpm e2e:evolucao-ocorrencia-nf`: 38 passando.
- `pnpm e2e:relacao`: 46 passando.
- `pnpm e2e:offline`: 5 passando (invariante 4).
- `pnpm e2e:infra`: 35 passando, 1 pulado.
- `gitleaks detect --no-banner`: nenhum vazamento.
- `lint_slop.py` (interface-2026) nas pastas da frente: nenhum achado.
- Capturas 390 x 844 e 1280 x 800, antes e depois, fora do repositório (scratchpad da sessão, `visual-vivo/operacao/antes` e `.../depois`). Nenhuma tela rola de lado.
- Não rodados: `supabase test db` (nada de banco mudou) e `node --test n8n/build.test.mjs` (nada do n8n mudou).
