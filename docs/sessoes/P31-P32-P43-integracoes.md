# P31 · P32 · P43 · Integrações externas (biblioteca e webhooks) e e-mail

Data: 25/09/2026
Branch e commits: `trilha/integracoes` (trilha paralela de multiagentes, escopo "fora do banco"). Construção em `04f56cc`; verificação e correções no commit seguinte do mesmo branch (seção "Verificação da trilha", no fim).

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
   Kraamzorg assinam com `SIGN`, parceiro como testemunha opcional com
   `SIGN_AS_A_WITNESS`, entrega por e-mail, WhatsApp ou link da própria
   Autentique, `sandbox` ligado a menos que `AUTENTIQUE_SANDBOX=false`) e
   `buscarDocumento` (reconsulta usada pelo webhook; concluído só com todas
   as assinaturas, testemunha inclusive, e nenhuma recusa).
   `processarWebhookAutentique` (`webhook.ts`) confere o segredo em tempo
   constante, lê o id do documento em `event.data.id`, nunca decide pelo
   corpo do POST: sempre chama `buscarDocumento` antes de marcar o contrato
   como assinado, e é idempotente (gravação condicional no banco).
2. **InfinitePay** (`src/lib/integracoes/infinitepay/`): `criarLinkPagamento`
   com `order_nsu` = id da cobrança, itens em centavos, `redirect_url`,
   `webhook_url` e dados do cliente; `limites.ts` recusa, antes de qualquer
   chamada de rede, link com mais parcelas que
   `pacote_versao.parcelas_max_sem_juros` (3 no seed; PRD 14 v4.2, T-06),
   sem número escrito no código. `paymentCheck` e
   `processarWebhookInfinitePay` (`webhook.ts`): o webhook não é assinado,
   então o corpo nunca decide uma baixa sozinho; sempre confirma com
   `payment_check` (só `paid: true` confirma), o valor pago vem de lá e
   precisa cobrir o valor da cobrança, e a baixa é idempotente (condicional
   no banco).
3. **NFS-e** (`src/lib/integracoes/nfse/`): `AdaptadorNfse`, interface
   provedor-agnóstica para o padrão nacional (tomador é quem paga, estados
   espelhando o enum `status_nota` do banco, código de serviço sempre
   recebido do cadastro). `EmissorNacionalAdaptador`: implementação com
   novas tentativas (3 por padrão, só para falha transitória de rede ou
   HTTP 5xx; erro de validação 4xx não tenta de novo e devolve o motivo do
   provedor), chave de idempotência igual ao id da cobrança em toda
   tentativa, e código e descrição do serviço ("cuidado domiciliar
   pós-parto") recebidos do cadastro, nunca escritos no código.
4. **E-mail** (`src/lib/integracoes/email/`): `enviarEmail` com Resend
   (anexo em base64) e a guarda de `guarda.ts`, que recusa o envio antes de
   qualquer chamada de rede se o assunto tiver nome de paciente (completo
   ou parte, sem acento e sem caixa), CPF, telefone ou e-mail, ou se o nome
   de um anexo tiver nome de paciente. A lista de nomes é obrigatória e a
   mensagem de erro nunca repete o dado. Assunto e corpo vêm de
   `mensagem_modelo`; nenhum texto fica no módulo.
5. **Rotas de webhook**: `src/app/api/webhooks/autentique/[segredo]/route.ts`
   (segredo no caminho, comparado em tempo constante com
   `AUTENTIQUE_WEBHOOK_SECRET`) e
   `src/app/api/webhooks/infinitepay/route.ts`. As duas rotas só ligam a
   lógica pura de `webhook.ts` ao cliente de serviço do Supabase
   (`criarClienteServico`, novos motivos `webhook_autentique` e
   `webhook_infinitepay` em `src/lib/db/cliente-servico.ts`) e ao cliente
   HTTP de cada adaptador; nenhuma regra de negócio mora na rota.
6. **Testes com fetch interceptado** (nenhum chama API real): 72 testes
   em `src/lib/integracoes/**` cobrindo os quatro adaptadores e a lógica
   das duas rotas de webhook, incluindo os três casos pedidos pela trilha:
   webhook forjado e duplicado não mudam nada (Autentique e InfinitePay,
   separadamente), link com mais de 3 parcelas falha antes de qualquer
   chamada de rede, e assunto de e-mail com nome de paciente é recusado.
7. `.env.example`: `AUTENTIQUE_WEBHOOK_SECRET`, `AUTENTIQUE_SANDBOX`,
   `NFSE_PROVEDOR_BASE_URL` e `NFSE_PROVEDOR_API_KEY` documentados (os
   demais já existiam; `INFINITEPAY_API_KEY` passou a opcional).
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
- O limite de parcelas da InfinitePay é aplicado no adaptador
  (`limites.ts`), antes de qualquer chamada de rede, com o valor de
  `pacote_versao.parcelas_max_sem_juros` passado por quem chama, para valer
  com qualquer um dos dois formatos que o T-06 ainda vai escolher entre o
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

- **[conferir]** Autentique: `docs.autentique.com.br` segue bloqueado. Na
  verificação, o enum de ação (`SIGN`, `SIGN_AS_A_WITNESS`), os campos do
  `SignerInput` (`name`, `email`, `phone`, `delivery_method`), os campos
  da query `document` e o formato do webhook (`event.data.id`) foram
  conferidos em implementações públicas da API v2. Reconfirmar com um
  disparo real no painel de homologação. A Autentique também assina o
  webhook com HMAC (`x-autentique-signature`); o PRD 14 adotou segredo no
  caminho, e checar o HMAC fica como reforço opcional.
- **[conferir]** InfinitePay: implementações públicas mostram o Checkout
  sem chave de API (só o `handle`), `payment_check` com `handle`,
  `order_nsu`, `transaction_nsu` e `slug`, e resposta com `success` e
  `paid` separados. `INFINITEPAY_API_KEY` ficou opcional até o T-06.
- Cobrança `cancelada` ou `estornada` que receba pagamento confirmado é
  baixada como qualquer outra aberta (o PRD não diz o contrário); se o
  financeiro preferir revisão manual nesse caso, é regra nova para o PRD.
- Chaves em `parametro` para o código e a descrição do serviço da NFS-e
  (sugestão: `nfse_servico` com `codigo` e `descricao`): pendência da
  trilha do banco; o adaptador já recebe os dois de quem chama.
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
- Resolvido na verificação: `n8n/*.test.mjs` falhavam sob `pnpm test`
  (Vitest tentava processá-los); o `exclude` do `vitest.config.ts`, que
  esta trilha já alterava, agora cobre `n8n/**`. Eles continuam rodando
  por `node --test n8n/build.test.mjs`.

## Como testar

```sh
pnpm install
pnpm exec vitest run src/lib/integracoes
pnpm test
node --test n8n/build.test.mjs
pnpm lint
pnpm typecheck
gitleaks detect --no-banner
```

## Resultado dos invariantes

Depois da verificação (25/09/2026):

- `pnpm test` (Vitest, suíte completa): 25 arquivos, 307 testes, 307 ok
  (72 em `src/lib/integracoes/**`).
- `node --test n8n/build.test.mjs`: 312 testes, 311 ok, 1 pulado (sem
  banco local).
- `pnpm lint`: 0 erros, 5 avisos pré-existentes fora do escopo.
- `pnpm typecheck`: sem erros.
- `gitleaks detect --no-banner`: nenhum vazamento.
- `pnpm build`: compila e passa a etapa de TypeScript; falha ao
  pré-renderizar `/agenda` e `/transferencias` ("Event handlers cannot be
  passed to Client Component props"), páginas de outra trilha que este
  branch não toca.
- Playwright: sem spec (a trilha não tem tela; as rotas são webhooks de
  servidor).
- `supabase test db` e `pnpm e2e:offline`: não se aplicam (sem banco nem
  fluxo offline nesta trilha).

## Verificação da trilha

Conferência contra o PRD 14, os aceites de P31, P32 e P43 e o CLAUDE.md.
Correções feitas:

1. **Segurança, crítico (InfinitePay):** `paymentCheck` tratava
   `success: true` como pago. `success` só diz que a consulta funcionou;
   um webhook forjado para um pedido não pago (`success: true, paid:
false`) baixava a cobrança. Agora só `paid: true` confirma, com teste de
   ponta a ponta (payment_check real, fetch interceptado).
2. **InfinitePay:** o valor pago vem do `payment_check` e precisa cobrir
   `cobranca.valor_centavos`; antes a baixa podia gravar valor 0.
3. **Autentique:** a testemunha ia com a ação `WITNESS`, que não existe na
   API (o certo é `SIGN_AS_A_WITNESS`), e o signatário ia sem `name` e sem
   `delivery_method`: o `createDocument` com testemunha seria recusado.
4. **Autentique:** o webhook lia o `id` da raiz do corpo, que é o id do
   webhook, não do documento; o contrato nunca seria achado. Agora lê
   `event.data.id` (ou `event.data.document.id`).
5. **Autentique:** conclusão exigia só quem assina; agora exige todas as
   assinaturas (testemunha inclusive, igual ao evento "documento
   finalizado") e nenhuma recusa, e lista vazia nunca conta como concluída.
6. **Autentique:** segredo do caminho comparado em tempo constante.
   Sandbox deixou de depender de `NEXT_PUBLIC_APP_ENV` (que o `.env.example`
   diz não servir a regra de negócio) e passou a `AUTENTIQUE_SANDBOX`,
   ligado por padrão.
7. **Rotas:** erro de banco era ignorado e a rota respondia 200 (a baixa
   ou a assinatura se perdia sem reenvio). Agora erro de banco ou de rede
   responde 500 sem detalhe, para o terceiro reenviar, e a gravação é
   condicional (`status` diferente do final), então dois webhooks
   simultâneos nunca gravam duas vezes.
8. **Regra "nada de limite ou texto no código":** saíram a constante de 3
   parcelas (o limite vem de `pacote_versao.parcelas_max_sem_juros`), a
   descrição fixa da NFS-e (`descricao.ts`, agora vem do cadastro com o
   código de serviço) e o assunto fixo de e-mail (`textos.ts`, o texto vem
   de `mensagem_modelo`).
9. **E-mail:** a mensagem de erro da guarda repetia o nome do paciente
   (vai para log); a lista de nomes era opcional (sem ela, nada era
   checado) e só o nome completo era comparado. Agora a lista é
   obrigatória, partes do nome contam, CPF, telefone e e-mail no assunto
   são recusados, e o nome dos anexos também passa pela guarda.
10. **NFS-e:** nova tentativa de emissão podia duplicar nota; agora toda
    tentativa leva o id da cobrança como chave de idempotência. O erro 4xx
    devolve o motivo do provedor (aceite do P43: "erro mostra o motivo"),
    a contagem de tentativas ficou certa e a referência do provedor vai
    codificada na URL.
11. **Testes:** `pnpm test` voltou a ficar verde com `n8n/**` fora do
    Vitest; um travessão num comentário de `vitest.stub-server-only.ts`
    saiu.
