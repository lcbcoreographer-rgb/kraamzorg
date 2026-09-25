# P27 · Tela do agente no CRM

Data: 25/09/2026
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q`, sem commit desta sessão (a tarefa proíbe commit e push).

A fundação (P07/P10) já deixava `AgenteRepositorio` com quatro métodos
(`listarConversas`, `mensagensDaConversa`, `listarTransferencias`,
`assumirTransferencia`, nas duas implementações), as quatro rotas
registradas em `src/lib/navegacao` com estado vazio provisório, e o
adaptador de mensageria (`src/lib/messaging`, P18) pronto. Esta sessão
trocou o estado vazio pelas telas e acrescentou, só dentro de
`src/app/(app)/conversas/**`, `src/app/(app)/transferencias/**`,
`src/app/(app)/agente/**`, `src/modules/agente/**`,
`src/app/api/teste/uazapi/**` e `src/app/api/agente/reindexar/**`, tudo
que faltava: conversas (lista, filtro, tela individual), fila de
transferências, painel da Isadora (regra de retomada, modo, base de
conhecimento, métricas) e as duas rotas que os fluxos n8n usam.

Direção seguida: `docs/design/DESIGN.md` (seção 6, componentes `fila`,
`conversa`, `selo`, `faixa`), `docs/design/fluxos.md` (fluxo E, "Conversas
da Isadora e fila de transferências com prazo") e os protótipos
`docs/prototipo/comercial-inicio.html` (fila), `comercial-conversas.html`
(lista, C5), `comercial-conversa.html` (conversa individual, C2) e
`comercial-agente-regras.html` (janela de retomada, C6), como o P27 do
PROMPTS.md pede. A skill interface-2026 e a Impeccable em modo Operate
(`reference/operate.md`, `reference/craft-floor.md`) foram lidas; o
launcher não rodou (proibido pela tarefa, sem detector mecânico nesta
máquina). Modo do agente, base de conhecimento e métricas não têm tela no
protótipo (só a regra de retomada, C6, tem): foram desenhadas seguindo o
mesmo vocabulário de componente das telas que têm referência (`Cartao`,
`Selo`, `FaixaAlerta`, `EscolhaUnica`, `CampoTexto`, `EstadoVazio`,
`Dialogo`), sem inventar cor, fonte ou raio novo, e reaproveitando
`CabecalhoFicha`, `obterFichaTela` e `obterFreioDesfazerSegundos` do P16
para o freio e as quatro datas na conversa individual, e `textoPrazo` e
`criarVerificadorFreio` do P18 para o prazo do SLA e o freio do compositor.

## Feito

1. **Conversas** (`/conversas`, `src/app/(app)/conversas/page.tsx` +
   `src/modules/agente/conversas/**`): lista com filtro por situação
   (Isadora conduzindo, com a equipe, pausadas, não lead; protótipo C5),
   contagem por aba, prévia da última mensagem (oculta quando a
   transferência aberta é de saúde, perda ou estado sensível escreveu),
   `Assumir conversa` e `Pausar a Isadora` (sem handoff), `Devolver agora`
   (pausa manual), `Marcar como não lead` e `Marcar como resolvida`
   (quando há transferência aberta), tudo no próprio cartão.
2. **Conversa individual** (`/conversas/[id]`, protótipo C2): linha de
   mensagens com quem enviou (família à esquerda; Isadora à direita em
   areia com "Isadora (IA)"; equipe à direita em marinho), painel de
   resumo recolhível (estágio, onde, DPP, apresentação enviada, reaproveita
   `obterFichaTela`), cabeçalho com o freio em um toque
   (`CabecalhoFicha`, P16) quando a conversa tem família, compositor com
   atalho do formulário do contrato (`mensagem_modelo.formulario_contrato`),
   "Abrir no WhatsApp" (sempre) e "Enviar pelo app" (só com
   `comercial_resposta_no_app` ligado, `fluxos.md` item 3). Conversa em
   `humano_comercial` mostra a faixa "A Isadora saiu desta conversa" com o
   botão **"Devolver à Isadora"**, único caminho que chama
   `privado.retomar_agente` (via `api.retomar_agente`), com confirmação
   numa folha explicando que a Isadora só responde a partir da próxima
   mensagem da família (PRD 11.7, D-17). **"Marcar como resolvida" nunca
   chama essa função**: só fecha a transferência com o desfecho (chips
   Formulário enviado / Sessão marcada / Condição negociada / Sem retorno)
   e mantém o modo atual da conversa, exatamente como o PROMPTS.md P27
   pede.
3. **Transferências** (`/transferencias`, protótipo `comercial-inicio.html`):
   fila por prioridade e prazo (`AgenteRepositorio.listarTransferencias` já
   ordena), prazo em texto com cor (`aviso-texto` perto do vencimento,
   `alerta` vencido, reaproveitando `textoPrazo` do P18), faixa vermelha
   (`FaixaAlerta variante="imediato"`) com "Reenviar aviso" quando
   `notificacaoOk` é falso, "Assumir conversa" (reaproveita
   `AgenteRepositorio.assumirTransferencia`, já pronto).
4. **Modo do agente e números de teste** (`/agente`, PRD 11.3, 11.7): só a
   diretoria altera (a tela recusa antes de tentar, o banco recusaria
   depois); comercial vê em modo leitura. Funciona hoje contra o Supabase
   real: `parametro` tem `grant select, insert, update` para `authenticated`
   com RLS restrita à diretoria (`0007_permissoes.sql`), sem RPC pendente.
5. **Regra de retomada** (`/agente`, protótipo C6): janela de 24 a 72 h
   (só a diretoria altera), com os textos `followup_d1_pos_pdf` e
   `followup_d1_pos_abertura` de `mensagem_modelo` (nunca escritos no
   código), e o aviso "a Isadora nunca retoma conversa de família com
   freio nem conversa já assumida pela equipe".
6. **Base de conhecimento** (`/agente`, PRD 6.8, 11.9): lista com status
   (rascunho/aprovado/arquivado), cadastro (comercial e coordenação
   leem e escrevem, PRD 13), aprovação só da diretoria, e o botão
   **"Reindexar"**, que chama `POST /api/agente/reindexar`.
7. **Métricas do 11.12** (`/agente`): os sete indicadores, cada um com
   base de comparação (a meta do PRD, nunca um número sozinho). As sete
   consultas SQL propostas para a função `api.metricas_agente(desde, ate)`
   ficam documentadas em `src/modules/agente/metricas/dados.ts`, uma por
   indicador.
8. **`POST /api/teste/uazapi/{send/text,send/media,message/download}`**
   (PROMPTS.md P25 item 5; `n8n/IMPORTAR.md` e `n8n/src/lib/uazapi.mjs`,
   que já apontam para os mesmos três caminhos e o mesmo formato de corpo):
   captura o que os fluxos 2 e 3 mandariam de verdade para a UAZAPI,
   guardado em memória (`_lib/loja.ts`); `GET`/`DELETE` na raiz para o
   roteiro de homologação (P28) conferir e limpar entre casos; `POST
/transcricoes` para o teste registrar de antemão o que
   `message/download` deve devolver (texto ou falha simulada, caso do
   Apêndice C "áudio com a transcrição forçada a falhar"). Recusa com 403
   fora de `NEXT_PUBLIC_APP_ENV=homologacao`, sempre, nunca em silêncio.
9. **`POST /api/agente/reindexar`** (PROMPTS.md P26 item 3: "rota do app
   que chama o webhook de reindexação, o botão vem no P27"): confere
   sessão e papel (comercial, coordenação ou diretoria) e repassa para o
   webhook do fluxo 1, cuja URL completa (com o segredo no próprio
   caminho, `n8n/IMPORTAR.md`) mora só na variável de servidor
   `N8N_WEBHOOK_REINDEXAR_URL` — nunca `NEXT_PUBLIC_*`, nunca no
   navegador.
10. **Testes**: 50 testes Vitest (comportamento, não só renderização) em 7
    arquivos — `formatacao.test.ts` (a regra de qual selo aparece),
    `acoes.test.ts` (assumir, pausar, devolver, resolver, marcar não
    lead, sempre contra a loja em memória do modo demonstração),
    `admin-acoes.test.ts` (permissão de diretoria, validação de horas e
    de tamanho de texto, aprovação), `lista-conversas.test.tsx` (filtro,
    interação de verdade com `userEvent`), e três arquivos de rota (`GET`
    e `DELETE` da captura, `send/text`, `message/download`,
    `/api/agente/reindexar`, cobrindo sessão, papel e a variável de
    ambiente). Mais 4 specs Playwright em
    `tests/e2e/p27-agente/` (modo demonstração): `conversas.spec.ts`,
    `transferencias.spec.ts`, `agente-admin.spec.ts` e
    `api-teste-uazapi.spec.ts`, com `axe` e sem rolagem lateral nas telas
    novas. Não rodei `pnpm e2e` (reservado para a integração final, como
    a tarefa pede); os arquivos seguem o mesmo padrão de
    `tests/e2e/p18-tarefas/tarefas.spec.ts` (`porProjeto`, para celular e
    computador não colidirem na mesma linha da loja em memória).

## Ficou de fora (e por quê)

- **Régua de SLA em blocos** (o gráfico de 8 barrinhas do protótipo
  `comercial-inicio.html`): a tela mostra o prazo em texto com cor
  (`vence em 38 min`, `venceu há 8 min`), sem o desenho segmentado. Puro
  corte de tempo; o dado (`slaVenceEm`) já está na tela.
- **Prévia de mensagem com N+1**: `listarConversasTela` busca a última
  mensagem de cada conversa com `agente.mensagensDaConversa` por
  conversa. Funciona bem para o volume de uma operação deste porte (é o
  que o protótipo assume), mas não escala para milhares de conversas
  simultâneas; documentado no comentário da função.
- **Cabeçalho da conversa sem família**: quando a conversa não tem
  `familiaId` (candidata, fornecedor, número desconhecido), a tela mostra
  só o nome, sem o botão de freio (que exige família). Corresponde ao
  próprio modelo de dados: freio é por família, não por conversa.
- **Estado "freio" da conversa como card especial na lista** (`comercial-conversas.html`
  mostra `Família Teste Brisa` com selo ameixa "Freio: Isadora
  desligada"): a lista hoje classifica pela `situacao` calculada
  (Isadora/equipe/pausada/não lead), que não inclui o estado sensível da
  família (isso pediria buscar a ficha de cada conversa, outro N+1). A
  conversa aparece normalmente (como "pausada", se `agentePausadoAte`
  estiver no futuro, ou "isadora" caso contrário); o freio de verdade
  aparece certo na conversa individual, via `CabecalhoFicha`.
- **Entrevistas** na barra lateral da coordenação: já registrado como
  pendência do P07 ("fica para o P39"), não é desta sessão.

## Decisões tomadas nesta sessão

1. **"Assumir conversa" e "Pausar a Isadora" sem handoff aberto** (cartões
   "Isadora conduzindo" da lista, protótipo C5) usam a mesma escrita no
   banco (`agente_pausado_ate`, `agente_pausa_motivo`), só com texto e
   duração diferentes por origem (`repositorio.ts`, `pausarConversa`). A
   coluna não é gravável direto por `authenticated`
   (`0007_permissoes.sql`: "a pausa e o modo do agente mudam só por
   função privado.retomar_agente, P22"), então as duas ações chamam
   `rpcPendente("pausar_conversa", ...)`; funcionam de verdade na
   demonstração.
2. **Duas funções de "devolver" separadas**, para não confundir a regra
   do PRD: `retomarPausaManual` (pausa manual comum, qualquer papel que
   vê a conversa) e `retomarAgenteComercial` (só para `humano_comercial`,
   chama `privado.retomar_agente`, único jeito de sair desse modo, PRD
   11.7 D-17). O botão "Devolver à Isadora" só aparece quando
   `agenteEncerradoEm` está preenchido; "Devolver agora" só quando há
   pausa manual sem handoff.
3. **"Marcar como não lead" funciona hoje contra o Supabase real**, sem
   RPC pendente: `conversa.classificacao` tem `grant update` direto para
   `authenticated` (`0007_permissoes.sql`). As três opções da tela
   (candidata, fornecedor, consultório) são as três que já têm
   `mensagem_modelo` no seed (`nao_lead_candidata/fornecedor/consultorio`);
   não incluí `parceiro_medico` nem `outro` do enum `classificacao_contato`
   por não terem texto de encaminhamento pronto.
4. **"Resolver transferência" com desfecho vai por RPC pendente**
   (`api.resolver_transferencia`), mesmo `handoff.status` e
   `resolvido_em` sendo graváveis direto: não existe coluna nem grant
   para gravar o desfecho (`dados` jsonb não está na lista de colunas
   liberadas). Preferi não gravar um "resolvido" incompleto (sem
   desfecho) em produção; documentado como pendência abaixo.
5. **Base de conhecimento e métricas em `rpcPendente`**: `agente.*` é
   schema que o PostgREST nunca expõe (PRD 5.2), e as métricas do 11.12
   pedem consultas agregadas que fazem mais sentido como função do banco
   (documentadas) do que como leituras soltas pelo `supabase-js`.
6. **Reindexar não é RPC de banco**: é uma chamada HTTP ao webhook do
   fluxo 1 do n8n (`POST /api/agente/reindexar`), com a URL completa
   (segredo no caminho) só em variável de servidor.
7. **Rota de captura da UAZAPI com os mesmos três caminhos da API real**
   (`/send/text`, `/send/media`, `/message/download`), porque
   `n8n/src/lib/uazapi.mjs` já constrói a URL assim
   (`homologacao.urlCaptura + caminho`); inventar outro formato quebraria
   o fluxo 2/3 quando `envioSimulado`/`transcricaoSimulada` ligarem.
   Acrescentei `GET`/`DELETE` na raiz e `POST /transcricoes` como
   protocolo de controle para o roteiro de homologação (P28), que ainda
   não existe: documentado no cabeçalho de `_lib/loja.ts` para quem
   escrever o P28 usar ou ajustar.

## Mudanças no PRD

Nenhuma. Não editei `PRD.md`, `CLAUDE.md`, `PROMPTS.md`, `docs/design/`,
`docs/prototipo/`, `supabase/` nem `n8n/`, como a tarefa pediu.

## Pendências novas ([confirmar], [clínico], terceiros)

Funções do schema `api` que este módulo já chama por `rpcPendente` e que
a trilha do banco (0012 a 0014) precisa escrever, com o contrato que a
tela espera:

- `api.pausar_conversa(conversa_id uuid, motivo text)`: grava
  `agente_pausado_ate` (a função decide a duração, hoje pensada como
  `agente_pausa_humano_horas`) e `agente_pausa_motivo`.
- `api.retomar_pausa_conversa(conversa_id uuid)`: limpa
  `agente_pausado_ate` e `agente_pausa_motivo`.
- `api.retomar_agente(conversa_id uuid)`: chama
  `privado.retomar_agente` (P22 item 4), limpa `agente_encerrado_em` e
  `agente_encerrado_motivo`, grava no log. Só diretoria, comercial ou
  coordenação (PRD 11.7).
- `api.resolver_transferencia(handoff_id uuid, desfecho text)`: grava
  `status = 'resolvido'`, `resolvido_em` e o desfecho (falta decidir
  onde: coluna nova em `handoff` ou dentro de `dados` jsonb com grant de
  update nessa coluna) **[confirmar: dono do P22/0012-0014]**.
- `api.base_conhecimento_listar()`, `api.base_conhecimento_salvar(id
uuid, tipo text, titulo text, texto text, fonte text)`,
  `api.base_conhecimento_aprovar(id uuid)`: wrappers de
  `agente.base_conhecimento` (schema não exposto pelo PostgREST).
- `api.metricas_agente(desde date, ate date)`: as sete consultas
  propostas estão em `src/modules/agente/metricas/dados.ts`.
- `api.reenviar_notificacao_handoff(handoff_id uuid)`: reenvia o aviso ao
  grupo quando `notificacao_ok` é falso.

Outras pendências:

- **`N8N_WEBHOOK_REINDEXAR_URL`**: variável de ambiente de servidor com a
  URL completa do webhook do fluxo 1 (`webhooks.fluxo1Reindexar` do
  config do n8n, `n8n/IMPORTAR.md`). Sem ela, o botão "Reindexar" volta
  503 com uma frase clara; não tentei adivinhar um endereço. Não editei
  `.env.example` (fora das minhas pastas); quem mantiver esse arquivo
  precisa acrescentar a linha.
- **`comercial_resposta_no_app`**: a tela já está desenhada para as duas
  saídas (`fluxos.md`, item 3, decisão pendente do Leonardo); hoje o
  parâmetro está `false` no seed, então só "Abrir no WhatsApp" aparece.
  Quando `true`, o botão "Enviar pelo app" grava a mensagem direto
  (`registrarEnvioConversa`), que tem a mesma pendência do P18
  (`src/modules/mensageria/tarefas/registrar-envio.ts`): não existe
  `grant insert` em `mensagem` nem função `api.*` para isso ainda; funciona
  na demonstração, falha com erro claro no Supabase real até a função
  existir.
- **Protocolo de captura da UAZAPI para o P28**: o roteiro automatizado
  de homologação ainda não existe. Documentei o contrato que a rota
  espera (`_lib/loja.ts`), mas quem escrever o P28 pode preferir outro
  desenho (por exemplo, registrar a transcrição esperada por telefone em
  vez de por id de mensagem, se for mais simples de orquestrar do lado
  do teste) **[confirmar: quem escrever o P28]**.
- **Classificações de "não lead"**: a tela só oferece candidata,
  fornecedor e consultório (as três com `mensagem_modelo` no seed).
  `parceiro_medico` e `outro` do enum existem no banco mas não têm texto
  de encaminhamento pronto **[confirmar: Leonardo, se precisam de tela]**.

## Como testar

```bash
# Nas minhas pastas
pnpm eslint "src/app/(app)/conversas" "src/app/(app)/transferencias" "src/app/(app)/agente" "src/modules/agente" "src/app/api/teste/uazapi" "src/app/api/agente/reindexar" "tests/e2e/p27-agente"
pnpm tsc --noEmit   # typecheck não tem como escopar por pasta
NEXT_PUBLIC_APP_ENV=desenvolvimento pnpm vitest run src/modules/agente "src/app/(app)/conversas" "src/app/(app)/transferencias" "src/app/(app)/agente" src/app/api/teste/uazapi src/app/api/agente/reindexar
NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao pnpm dev
# depois, no navegador: entrar como "Comercial" e abrir /conversas, /transferencias e /agente
```

Roteiro manual (modo demonstração, `KZ_DADOS=demonstracao`):

1. Entrar como comercial → `/conversas` → aba "Isadora conduzindo" →
   "Família Teste Aurora" → "Assumir conversa" → o cartão vira "Pausada"
   com "Devolver agora".
2. `/conversas` → "Família Teste Horizonte" (selo "Com a equipe") →
   "Abrir conversa" → ver a faixa "A Isadora saiu desta conversa" →
   "Devolver à Isadora" → confirmar na folha → mensagem de sucesso.
3. `/transferencias` → cartão "Pediu condição especial" (Família Teste
   Cedro) → faixa vermelha "O aviso ao grupo não saiu" → "Reenviar
   aviso" → a faixa some → "Assumir conversa" → selo "Assumida" →
   "Abrir conversa" → "Marcar como resolvida" → escolher um desfecho →
   salvar.
4. Sair e entrar como diretoria → `/agente` → mudar o modo para
   "Em produção" → salvar → mensagem de sucesso. Sair e entrar como
   comercial → `/agente` → o modo aparece só em leitura.
5. `/agente`, como comercial → "Novo item" na base de conhecimento →
   preencher e salvar → aparece "Rascunho para aprovação". Sair e entrar
   como diretoria → o mesmo item → "Aprovar" → selo "Aprovado".
6. `/agente` → seção "Números do mês" → todos os indicadores aparecem
   com a meta ao lado.

## Resultado dos invariantes

Esta sessão não roda os quatro invariantes do CLAUDE.md inteiros nem
`pnpm build`/`pnpm e2e` (a tarefa reserva isso para a integração no fim,
feita por outro agente). O que rodou, escopado às minhas pastas:

- `pnpm eslint "src/app/(app)/conversas" "src/app/(app)/transferencias" "src/app/(app)/agente" "src/modules/agente" "src/app/api/teste/uazapi" "src/app/api/agente/reindexar" "tests/e2e/p27-agente"`:
  **0 erros, 0 avisos.**
- `pnpm tsc --noEmit` (repositório inteiro, porque `typecheck` não tem
  como escopar por pasta): **0 erros no repositório inteiro** (nenhum
  erro pendente de outro agente no momento desta checagem).
- `NEXT_PUBLIC_APP_ENV=desenvolvimento pnpm vitest run src/modules/agente
"src/app/(app)/conversas" "src/app/(app)/transferencias"
"src/app/(app)/agente" src/app/api/teste/uazapi
src/app/api/agente/reindexar`: **50 testes, 7 arquivos, todos verdes.**
- `pnpm e2e` não rodou (reservado para a integração final). Os quatro
  specs de `tests/e2e/p27-agente/` passam por `pnpm eslint` e `tsc
--noEmit` limpos; a corrida real fica para quando a integração juntar
  todos os módulos.

## Atualização da verificação e da integração do CRM

Este relatório é da sessão de construção. Depois dela, a verificação mudou o
"Enviar pelo app" (devolve o link sem gravar a mensagem que não saiu), o
número de testes do módulo (78) e vários pontos da fila e da conversa. A
integração rodou os specs de `tests/e2e/p27-agente/` junto com o resto do app
e protegeu o painel da rota de captura da UAZAPI com o segredo das rotas
internas. O estado atual está em `docs/sessoes/CRM-integracao.md`.
