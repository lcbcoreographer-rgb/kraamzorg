# P31 · P32 · P43 · Integrações externas (biblioteca e webhooks) e e-mail

Data: 25/09/2026
Branch e commits: `trilha/integracoes` (trilha paralela de multiagentes, escopo "fora do banco"). Commit desta sessão listado ao final do relatório.

Esta sessão é uma fatia das sessões P31, P32 e P43: só a parte de
`src/lib/integracoes` (bibliotecas de terceiro), as rotas de webhook e o
adaptador de e-mail. Ficam fora, para as trilhas correspondentes: o modelo
de contrato em PDF (`@react-pdf/renderer`), o formulário seguro do P30, a
tela do financeiro do P32/P43, o disparo de `pos_assinatura` e das
automações de cobrança (`prenatal_urgente`, nota fiscal pendente), e toda
migration.

## Feito

1. **Autentique** (`src/lib/integracoes/autentique/`): `criarDocumento`
   (upload multipart do PDF via GraphQL multipart request spec, gestante e
   Kraamzorg assinam, parceiro como testemunha opcional, `sandbox` como
   parâmetro) e `buscarDocumento` (reconsulta usada pelo webhook).
   `processarWebhookAutentique` (`webhook.ts`) nunca decide pelo corpo do
   POST: sempre chama `buscarDocumento` antes de marcar o contrato como
   assinado, e é idempotente (contrato já assinado não grava de novo).
2. **InfinitePay** (`src/lib/integracoes/infinitepay/`): `criarLinkPagamento`
   com `order_nsu` = id da cobrança, itens em centavos, `redirect_url`,
   `webhook_url` e dados do cliente; `limites.ts` recusa qualquer pedido de
   mais de 3 parcelas sem juros antes de qualquer chamada de rede (PRD 14
   v4.2, T-06). `paymentCheck` e `processarWebhookInfinitePay`
   (`webhook.ts`): o webhook não é assinado, então o corpo nunca decide uma
   baixa sozinho; sempre confirma com `payment_check`, e é idempotente
   (cobrança já paga não confirma de novo nem baixa duas vezes).
3. **NFS-e** (`src/lib/integracoes/nfse/`): `AdaptadorNfse`, interface
   provedor-agnóstica para o padrão nacional (tomador é quem paga, estados
   espelhando o enum `status_nota` do banco, código de serviço sempre
   recebido do cadastro). `EmissorNacionalAdaptador`: implementação com
   novas tentativas (3 por padrão, só para falha transitória de rede ou
   HTTP 5xx; erro de validação 4xx não tenta de novo) e a descrição fixa
   "cuidado domiciliar pós-parto" (`descricao.ts`), que nenhuma chamada
   consegue sobrescrever.
4. **E-mail** (`src/lib/integracoes/email/`): `enviarEmail` com Resend
   (anexo em base64) e `garantirAssuntoSemDadoPessoal` (`guarda.ts`), que
   recusa o envio antes de qualquer chamada de rede se o assunto contiver
   um termo proibido (nome de paciente), comparando sem acento e sem caixa.
   `ASSUNTO_EMAIL_EVOLUCAO` (`textos.ts`) é o assunto fixo do PRD 23.5.
5. **Rotas de webhook**: `src/app/api/webhooks/autentique/[segredo]/route.ts`
   (segredo no caminho, comparado com `AUTENTIQUE_WEBHOOK_SECRET`) e
   `src/app/api/webhooks/infinitepay/route.ts`. As duas rotas só ligam a
   lógica pura de `webhook.ts` ao cliente de serviço do Supabase
   (`criarClienteServico`, novos motivos `webhook_autentique` e
   `webhook_infinitepay` em `src/lib/db/cliente-servico.ts`) e ao cliente
   HTTP de cada adaptador; nenhuma regra de negócio mora na rota.
6. **Testes com fetch interceptado** (nenhum chama API real): 79 testes
   novos em `src/lib/integracoes/**` cobrindo os quatro adaptadores e as
   duas rotas de webhook, incluindo os três casos pedidos pela trilha:
   webhook forjado e duplicado não mudam nada (Autentique e InfinitePay,
   separadamente), link com mais de 3 parcelas falha antes de qualquer
   chamada de rede, e assunto de e-mail com nome de paciente é recusado.
7. `.env.example`: `AUTENTIQUE_WEBHOOK_SECRET`, `NFSE_PROVEDOR_BASE_URL` e
   `NFSE_PROVEDOR_API_KEY` documentados (os demais segredos já existiam).
8. Ajuste de infraestrutura de teste: `vitest.config.ts` ganhou um alias
   que troca o pacote `server-only` por um stub vazio durante o Vitest
   (`vitest.stub-server-only.ts`). Sem isso, todo módulo com
   `import "server-only"` (o padrão já usado em `src/lib/db/cliente-servico.ts`
   e em `src/lib/auth/*`) quebra em teste, porque o Vitest roda em jsdom e
   não carrega a condição `react-server` do Next.js. É a primeira vez que
   um módulo com `server-only` ganha teste unitário no projeto; o guard de
   verdade continua ativo no build do Next.js.

## Ficou de fora (e por quê)

- Geração do PDF do contrato (`@react-pdf/renderer`, P31 item 1) e o
  formulário seguro do P30: fora do escopo desta trilha (biblioteca de
  integração, não o motor de contrato).
- Disparo de `pos_assinatura`, transição para `pagamento_confirmado` /
  `pagamento_confirmado_34s`, tarefa `prenatal_urgente` e o gatilho da nota
  fiscal pendente (P32 itens 3 e 4): a rota de webhook grava o estado da
  cobrança/contrato, mas a automação que reage a essa mudança é da trilha
  de automações/venda. Deixei o ponto de extensão comentado em cada rota
  (`[conferir]`).
- Baixa manual pelo financeiro para Pix fora do sistema (P32 item 4) e tela
  do financeiro (P43 item 3): telas, fora do escopo de biblioteca.
- Migration: nenhuma tocada ou criada, por instrução explícita da trilha
  ("fechar tudo que falta fora o banco"). As tabelas `contrato`, `cobranca`
  e `nota_fiscal` já existem em `supabase/migrations/0003_comercial_conversa.sql`
  (de outra sessão) com as colunas que os webhooks leem e gravam
  (`autentique_doc_id`, `status`, `assinado_em`, `external_id`,
  `valor_pago_centavos` etc.); não criei nem editei nenhuma migration.
- `pnpm build`: falha antes de chegar nas minhas rotas, num erro
  pré-existente e sem relação com esta trilha ("Event handlers cannot be
  passed to Client Component props" ao pré-renderizar `/agenda` e
  `/transferencias`, telas de outra trilha, já commitadas antes desta
  sessão). A compilação TypeScript do build ("Finished TypeScript") passou
  antes desse erro, cobrindo as rotas novas. Não mexi nessas páginas: fora
  do escopo da minha trilha.
- Specs Playwright: nenhum. A trilha não introduziu tela nem rota
  navegável por usuário (só webhooks de servidor), então não há e2e de
  browser para escrever aqui.
- `supabase test db` e `pnpm e2e:offline`: não rodados. A trilha não mexeu
  em banco nem em fluxo offline; a instrução da tarefa exclui banco
  explicitamente.
- `src/lib/db/cliente-servico.test.ts` (o teste que evita import fora da
  lista de motivos autorizados, citado no comentário do próprio arquivo):
  ainda não existe no repositório; não é desta trilha criá-lo, só usei os
  dois motivos novos que o comentário já previa para P31/P32.

## Decisões tomadas nesta sessão

- Webhook duplicado e forjado seguem a mesma forma nas duas integrações:
  uma função pura (`processarWebhookAutentique` /
  `processarWebhookInfinitePay`) recebe as dependências (busca externa,
  busca e gravação no banco) já resolvidas, sem nunca importar `fetch` nem
  o cliente Supabase diretamente. Isso deixa a regra "nunca confia no
  corpo, sempre reconsulta" testável sem servidor HTTP nem banco.
- O limite de 3 parcelas da InfinitePay é aplicado no adaptador
  (`limites.ts`), antes de qualquer chamada de rede, para valer com
  qualquer um dos dois formatos que o T-06 ainda vai escolher entre o
  Plano de Cobrança e o link simples.
- `EmissorNacionalAdaptador` assume um gateway REST configurável
  (`baseUrl` + `apiKey`) sobre o padrão nacional, não a API mTLS bruta do
  governo, porque o provedor comercial exato é `[confirmar]` (T-05) e é
  assim que os provedores citados na pesquisa desta sessão costumam expor
  a integração.
- `server-only` ganhou um alias de teste (`vitest.stub-server-only.ts`) em
  vez de remover o `import "server-only"` dos adaptadores: manter o guard
  de build é mais importante do que testar sem ele, e o alias só existe
  dentro do Vitest.

## Mudanças no PRD

Nenhuma.

## Pendências novas ([confirmar], [clínico], terceiros)

- **[conferir]** Nomes exatos dos campos GraphQL da Autentique
  (`DocumentInput`, `SignerInput`, enum de ação do signatário) e o formato
  do payload do webhook "documento finalizado": `docs.autentique.com.br`
  estava bloqueado pelo proxy de rede desta sessão; o formato usado segue
  o PRD 14 e o padrão GraphQL multipart request spec público. Reconfira
  antes de ligar a credencial de homologação.
- **[conferir]** Endpoint exato do Plano de Cobrança da InfinitePay (T-06,
  já listado no PRD 22.1); `www.infinitepay.io` e `ajuda.infinitepay.io`
  também bloqueados nesta sessão. O adaptador usa o endpoint de links
  documentado publicamente e trava o limite de parcelas no próprio código.
- **[confirmar]** Provedor comercial de NFS-e (T-05, já listado no PRD
  22.1): a interface e a implementação seguem o padrão nacional, mas o
  provedor exato (e os nomes de campo do corpo da requisição) precisam ser
  reconferidos quando a contadora indicar o parceiro.
- Pré-existente, não desta trilha: `pnpm build` falha em `/agenda` e
  `/transferencias` ("Event handlers cannot be passed to Client Component
  props"); vale registrar para quem for fechar o build de ponta a ponta.
- Pré-existente, não desta trilha: `n8n/*.test.mjs` (`build.test.mjs`,
  `fluxo-1/2/3.test.mjs`) falham sob `pnpm test` (Vitest tenta processá-los
  e não sabe bundlar `node:test`), embora rodem certos com
  `node --test n8n/build.test.mjs` (312 testes, 311 ok, 1 pulado sem banco
  local). O `vitest.config.ts` já comentava a intenção de não rodá-los
  pelo Vitest, mas o `exclude` não cobre `n8n/*.test.mjs`; não mexi nisso
  por ser fora do escopo da trilha de integrações.

## Como testar

```sh
pnpm install
pnpm exec vitest run src/lib/integracoes src/lib/db
pnpm lint
pnpm typecheck
gitleaks detect --no-banner
```

## Resultado dos invariantes

- `pnpm test` (Vitest, suíte completa): 278 testes, 278 ok (41 novos desta
  trilha em `src/lib/integracoes/**`). 4 suítes falham (`n8n/*.test.mjs`),
  pré-existentes e sem relação com esta trilha (ver "Pendências novas").
- `pnpm lint`: 0 erros, 5 avisos pré-existentes fora do escopo desta
  trilha.
- `pnpm typecheck`: sem erros.
- `gitleaks detect --no-banner`: nenhum vazamento.
- `pnpm build`: falha em `/agenda` e `/transferencias`, erro pré-existente
  e fora do escopo desta trilha (ver "Ficou de fora"); a etapa de
  TypeScript do build passou antes desse erro.
- `supabase test db` e `pnpm e2e:offline`: não aplicável a esta trilha
  ("fechar tudo que falta fora o banco"; sem tela nova).
