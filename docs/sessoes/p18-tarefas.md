# P18 · Mensageria, tarefas e notificações internas

Data: 25/09/2026
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q` (sem commit; a sessão não fez commit nem push, como pedido). Base: `01e331a`.

## Feito

1. **`src/lib/messaging`**: interface `Mensageiro` com as três implementações do enum
   `modo_mensageria`.
   - `manual`: monta o link `wa.me` com o texto pré-preenchido, checando o freio antes de
     existir o link (não a implementação nem tenta enviar; quem envia é a pessoa, no
     próprio WhatsApp).
   - `uazapi`: `/send/text` com o cabeçalho `token` e `track_source: "kraamzorg-app"`;
     checa o freio só para mensagem à família (`destinatario: "familia"`), nunca para
     grupo interno (`destinatario: "equipe"`, categoria `interna`, PRD 8.2). Configurada
     por `UAZAPI_BASE_URL` e `UAZAPI_TOKEN`; sem as duas, devolve falha sem tentar a
     rede.
   - `cloud_api`: assinatura pronta, `enviar()` lança `ErroMensageiro("nao_implementado")`
     até o P18b, como o prompt pede.
   - Nenhuma implementação lança por causa do freio ou de falha de rede: devolvem
     `{ ok: false, motivo }`, porque "não deu para enviar agora" é resultado esperado da
     tela.
   - O `VerificadorFreio` é uma interface injetada (este módulo não importa
     `src/lib/dados`, de propósito); a implementação de verdade mora em
     `src/modules/mensageria/tarefas/verificador-freio.ts`.

2. **Tela `/tarefas`** (`src/app/(app)/tarefas`): tarefas por prioridade e vencimento
   (vencidas, vencem hoje, a vencer, sem prazo), texto sugerido editável, "Abrir no
   WhatsApp" (link calculado no cliente a partir do texto já editado) e "Enviei" (server
   action: confere o freio de novo, grava `mensagem` com `enviado_por = humano` e conclui
   a tarefa). Tarefa sem texto/telefone no `payload` (interna, como "Justificar o freio")
   mostra só "Concluir". Família com o freio acionado não mostra link nem campo de texto,
   só o aviso e um atalho para a ficha (checado no servidor, antes de renderizar — PRD
   8.3: "família em bloqueio_total não gera link").

3. **`src/modules/mensageria`** (aplicação, sobre os repositórios da fundação):
   - `tarefas/tipos.ts`: contrato do `payload` da tarefa (`textoSugerido`,
     `telefoneE164`, `mensagemChave`, `contexto` — PRD 6.4).
   - `tarefas/agrupar.ts`: agrupamento e ordenação, `textoPrazo` ("vence em 22 min",
     "venceu há 8 min", "até 17:00").
   - `tarefas/verificador-freio.ts`: no Supabase, chama `api.pode_enviar_mensagem` por
     `rpcPendente` (ainda não existe — 0012 a 0014 são de outra trilha — então devolve
     `pode: false` até a migration chegar, nunca `true` às cegas); em demonstração,
     aproxima a mesma matriz do PRD 8.2 a partir de `FichaRepositorio.obterFicha`
     (estado sensível e `nao_contatar`).
   - `tarefas/registrar-envio.ts`: grava a mensagem (demonstração: `loja.mensagens`, sem
     editar `src/lib/dados/demonstracao`; Supabase: insert direto em `conversa`/`mensagem`,
     que o grant e a RLS de `authenticated` já permitem — mesmo padrão que
     `src/modules/crm/pipeline/dados.ts` já usa para os mesmos motivos) e conclui a tarefa
     por cima do `TarefasRepositorio.concluirTarefa` já existente.
   - `notificacoes/`: canal "app" lido e marcado como lido direto da tabela
     `notificacao` (RLS pronta desde `0007_permissoes.sql`, sem RPC); `despachar.ts` cobre
     `whatsapp_interno` (pela UAZAPI, categoria `interna`) e `email` (Resend, HTTP direto,
     sem SDK nova); `push` documentado como pendente do P11 (sem inscrição salva em
     lugar nenhum ainda); `preferencias.ts` funciona de verdade em demonstração e devolve
     o padrão (tudo ligado) em Supabase, porque não há coluna nem tabela para gravar
     preferência por pessoa ainda.

4. **`POST /api/interno/notificar`**: segredo no cabeçalho `x-kz-interno-secret`, comparado
   com `INTERNAL_ROUTES_SECRET` em tempo constante (os dois lados viram hash SHA-256 antes
   de `crypto.timingSafeEqual`, para nem o tamanho do segredo vazar pelo tempo de
   resposta). Corpo validado com zod; despacha pelos canais `whatsapp_interno`, `email` e
   `push` (este último sempre "pendente"). Decisão de desenho: a rota não lê nem grava no
   banco — quem grava a linha em `notificacao` (canal "app") e resolve os destinatários
   dos outros canais é quem chama por `pg_net`, porque só ele tem o contexto SQL
   completo; a rota só é o portão de saída para os serviços externos (UAZAPI, Resend, e
   push quando existir), protegido pelo segredo.

## Ficou de fora (e por quê)

- **"Abrir no WhatsApp" e "Enviei" não são exercitáveis pela tela de verdade no modo
  demonstração desta máquina.** `TarefasRepositorio.listarTarefas` na demonstração
  (`src/lib/dados/demonstracao/index.ts`) sempre devolve `payload: {}`, e o seed
  (`TAREFAS` em `fixtures.ts`) não tem nenhuma tarefa de régua com texto e telefone. Os
  dois arquivos são da fundação, fora das pastas que esta sessão pode tocar. O
  comportamento está inteiramente coberto por Vitest (`cartao-tarefa.test.tsx`,
  `acoes.test.ts`, `registrar-envio.test.ts`), construindo a tarefa com o `payload` que o
  contrato pede; os specs de Playwright em `tests/e2e/p18-tarefas/` testam o que dá para
  testar hoje (lista, agrupamento, "Concluir", recorte por papel) e documentam a lacuna
  no próprio arquivo.
- **Central de notificação sem componente de tela.** O sino/painel mora no cabeçalho da
  casca (`src/components/shell`, P10), fora das minhas pastas. `central.ts` já lê e marca
  como lida; falta alguém montar o componente e importar.
- **`push`**: sem inscrição do navegador salva em lugar nenhum (P11). `despachar.ts`
  devolve pendente, documentado, sem crash.
- **Preferência por usuário no Supabase**: sem coluna ou tabela. Funciona de verdade em
  demonstração; documentado em `notificacoes/preferencias.ts`.
- **Avançar a régua/cadência depois do "Enviei"**: PRD 23.2 diz que o botão "avança a
  régua ou a cadência". Essa máquina de estado é do motor de automações (P20, ainda não
  construído). Esta sessão grava a mensagem com `enviado_por = humano` e conclui a
  tarefa; o avanço da régua acontece quando o P20 existir e processar a partir daí — não
  é responsabilidade de `src/lib/messaging` nem de `src/app/(app)/tarefas` inventar essa
  máquina de estado.

## Decisões tomadas nesta sessão

- O `VerificadorFreio` é uma interface de `src/lib/messaging`, implementada fora dele
  (`src/modules/mensageria`), para o adaptador de mensageria não importar
  `src/lib/dados` — mantém `src/lib/messaging` testável sem banco nem sessão.
- Onde falta uma função `api.*` (0012 a 0014 pendentes), segui o mesmo padrão que
  `src/modules/crm/pipeline/dados.ts` já usa: em demonstração, leio e gravo direto na
  loja em memória da fundação (`@/lib/dados/demonstracao/loja`, importado, nunca
  editado); no Supabase, uso `criarClienteServidor()` e insiro direto na tabela quando o
  grant e a RLS já permitem (nunca update de estágio), ou `rpcPendente` quando é mesmo
  função de banco que falta.
- `/api/interno/notificar` não lê nem grava no banco (ver "Decisão de desenho" acima).
- Tarefa sem `familiaId` (nenhuma no seed atual) não tenta o "Ver família": o link só
  aparece quando há para onde ir.

## Mudanças no PRD

Nenhuma.

## Pendências novas ([confirmar], [clínico], terceiros)

- **`.env.example`** (raiz, fora das minhas pastas) precisa de `UAZAPI_BASE_URL`,
  `UAZAPI_TOKEN` e `RESEND_FROM_EMAIL`. `UAZAPI_TOKEN` e `RESEND_API_KEY` (este já existe)
  vêm do cofre da Kraamzorg.
- **`src/lib/dados/demonstracao/index.ts`**: `TarefasRepositorio.listarTarefas` sempre
  devolve `payload: {}` (linha com `payload: {}` fixo no `.map`). Para o "Abrir no
  WhatsApp"/"Enviei" serem testáveis pela tela de verdade em demonstração, alguém da
  fundação (ou do P20, dono da régua) precisa: (a) devolver `t.payload` de verdade nesse
  `.map`, e (b) a `LojaDemonstracao.tarefas` (`Omit<Tarefa, "nomeFamilia" | "payload">`
  em `loja.ts`) parar de omitir `payload`, guardando o que o P20 gravar.
- **Seed de tarefas** (`TAREFAS` em `fixtures.ts`): não tem nenhuma tarefa de régua
  (`tipo: "nutricao_contato"`) com `payload.textoSugerido` e `payload.telefoneE164`. O
  aceite deste prompt ("tarefa da régua do seed aparece com o link certo") só fecha de
  ponta a ponta depois dessas duas pendências.
- **`api.pode_enviar_mensagem`**: não existe ainda no schema `api` (só
  `privado.pode_enviar_mensagem`, sem grant, 0009_freio.sql). Enquanto isso,
  `verificador-freio.ts` recusa por padrão no Supabase (nunca deixa passar às cegas).
  Quando a função chegar (0012 a 0014), a chamada por `rpcPendente` já está pronta; só
  troca para a versão tipada, como o comentário de `rpcPendente` pede.
- **`api.registrar_envio_tarefa`** (ou função equivalente): não existe. Hoje o "Enviei"
  grava a mensagem por insert direto (`registrar-envio.ts`), resolvendo a conversa pela
  família. Família sem `conversa` ainda registrada (por exemplo um lead cadastrado na
  mão) não tem onde gravar a mensagem: a tarefa é concluída mesmo assim, sem a mensagem.
  Fica documentado no próprio arquivo.
- **`src/lib/db/cliente-servico.ts`**: cogitei usar o cliente de serviço
  (`criarClienteServico`) na rota `/api/interno/notificar` para gravar a notificação e
  resolver destinatários; decidi não precisar dele (a rota só despacha, não lê nem grava
  no banco — ver "Decisões tomadas"). Se uma sessão futura precisar mesmo de
  `service_role` num caminho deste módulo, o `MotivoClienteServico` e o teste-guarda de
  `cliente-servico.test.ts` (ambos fora das minhas pastas) precisam de uma entrada nova,
  com o motivo documentado.
- **MFA do comercial**: fora do escopo do P18, mas notado no relatório da fundação como
  pendência de decisão do Leonardo (CPF completo exige MFA que o comercial não tem hoje).
  Não mexi nisso.
- **"Entrevistas" na barra lateral da coordenação**: fica para o P39 (nota da fundação),
  sem relação com este prompt.

## Como testar

```bash
pnpm vitest run src/lib/messaging src/modules/mensageria "src/app/(app)/tarefas" "src/app/api/interno"
pnpm lint -- "src/lib/messaging/**" "src/modules/mensageria/**" "src/app/(app)/tarefas/**" "src/app/api/interno/**"
pnpm typecheck
```

Playwright (roda na integração final, não nesta sessão):

```bash
pnpm e2e tests/e2e/p18-tarefas
```

Roteiro manual (modo demonstração): entrar como Comercial, abrir `/tarefas`, ver as
tarefas agrupadas por vencimento; concluir "Retomar a conversa com a Família Teste
Cedro" e ver que ela sai da lista; entrar como Coordenacao e ver "Agendar a consulta
pré-natal da Família Teste Íris".

## Resultado dos invariantes

Não apliquei os quatro invariantes completos desta sessão: o prompt pede para não rodar
`pnpm build` nem `pnpm e2e` (a integração roda no fim, com todos os módulos juntos) e
`supabase test db`/pgTAP não fazem parte do escopo de P18 (nenhuma migration nova). O que
rodei:

- `pnpm vitest run` nas minhas pastas: **67 testes, verde** (24 em `src/modules/mensageria`
  antes de notificações, mais os de `src/lib/messaging`, `tarefas` e a rota — ver "Como
  testar"; a suíte inteira do projeto, `pnpm test`, também ficou verde: **635 testes**,
  nenhum quebrado pelas minhas mudanças).
- `pnpm typecheck`: verde, projeto inteiro.
- `pnpm lint` nas minhas pastas: sem erro nem aviso.
- `gitleaks`: não rodei (não mexi em segredo nenhum; as variáveis novas citadas acima só
  existem como nome de variável, sem valor, em texto de documentação).
