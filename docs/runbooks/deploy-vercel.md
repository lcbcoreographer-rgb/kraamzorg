# Runbook · Deploy na Vercel

Passo a passo para colocar o Kraamzorg OS na Vercel, com homologação, previews de pull request e produção. Complementa `ambientes.md` (variáveis, dados e regras). Base: PRD 5.5 e 21.4, P14 itens 1 a 3. As telas da Vercel mudam de nome com o tempo; onde este texto diz "Settings", confira o nome no painel.

## 0. Antes de tudo

- A conta da Vercel é da Kraamzorg, no plano **Pro** (uso comercial exige plano pago, PRD 21.4). A Drop entra como membro, com acesso revogável.
- Os projetos Supabase `kraamzorg-hml` e `kraamzorg-prod` já existem, com as migrations revisadas aplicadas por `supabase db push`, e cada um tem o segredo HMAC do log de auditoria no Vault.
- O repositório está na conta da Kraamzorg no GitHub, com os ramos `hml` e `main` protegidos (pull request obrigatório e os checks da CI exigidos).

## 1. Criar o projeto

1. Em **Add New Project**, importe o repositório.
2. **Framework:** Next.js (detectado). **Node.js:** 22. **Gerenciador:** pnpm (o `packageManager` do `package.json` já fixa a versão). Comandos padrão: instalar `pnpm install --frozen-lockfile`, build `pnpm build`.
3. **Production Branch:** `main`.
4. **Região das funções:** escolha a mais próxima do projeto Supabase (por exemplo, São Paulo, `gru1`, se o Supabase estiver em São Paulo) [confirmar: Drop]. Rota de API que fala com o banco fica mais rápida na mesma região.
5. **Cron da Vercel:** não use. Os agendamentos rodam no `pg_cron` do Supabase (recálculo diário às 10:00 UTC, que é 7h em Brasília). O que a Vercel oferece não substitui a verificação de `/api/saude`.

## 2. Ambientes e variáveis

O Kraamzorg tem dois ambientes de Supabase, então as variáveis se separam assim:

| Escopo na Vercel                    | Ramo ou uso              | Aponta para                                         |
| :---------------------------------- | :----------------------- | :-------------------------------------------------- |
| **Production**                      | `main`                   | Supabase `kraamzorg-prod` e o domínio de produção   |
| **Preview** com o ramo `hml`        | branch `hml`             | Supabase `kraamzorg-hml` e o domínio de homologação |
| **Preview** (todos os outros ramos) | previews de pull request | Supabase `kraamzorg-hml` (nunca o de produção)      |

Como fazer:

1. Em **Settings, Environment Variables**, crie cada variável de `ambientes.md` seção 3.
2. Para as de produção, marque só **Production**.
3. Para as de homologação, marque **Preview**. Para variáveis que valem só para o ramo `hml` (por exemplo, `APP_BASE_URL` de homologação), escolha **Preview** e o ramo `hml`.
4. Nenhuma variável de produção pode ficar marcada em **Preview**. Confira a lista antes de salvar: o Supabase de produção é o que mais importa.
5. Marque como **Sensitive** todo segredo (chave de serviço, tokens, segredos de webhook, chave privada VAPID). Eles não ficam legíveis depois de salvos.
6. `NEXT_PUBLIC_APP_ENV` vale `producao` em Production e `homologacao` em Preview. `KZ_DADOS` não existe em nenhum dos dois.

Conferir cada ambiente, sem mostrar segredo:

```bash
vercel env pull .env.homologacao --environment=preview --git-branch=hml
node --env-file=.env.homologacao scripts/checar-ambiente.mjs --env homologacao
vercel env pull .env.producao --environment=production
node --env-file=.env.producao scripts/checar-ambiente.mjs --env producao
rm .env.homologacao .env.producao
```

## 3. Domínio

1. Em **Settings, Domains**, adicione `app.kraamzorgbrasil.com.br` [confirmar] à produção e um endereço de homologação ao ramo `hml` (por exemplo, `hml.app.kraamzorgbrasil.com.br` [confirmar]).
2. No Cloudflare, crie o `CNAME` do endereço para o alvo que a Vercel mostrar, em modo **DNS only** (nuvem cinza). Sem proxy.
3. Espere a Vercel emitir o certificado. Abra o endereço e confira o cadeado.
4. Configure `APP_BASE_URL` de cada ambiente com o endereço final, **sem barra no fim**: o link de pagamento e o webhook da InfinitePay usam esse endereço.

## 4. Webhooks (cada ambiente com o seu endereço)

| Serviço            | Endereço                                                            | Autenticação                                                                                         |
| :----------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------- |
| Autentique         | `https://<app>/api/webhooks/autentique/<AUTENTIQUE_WEBHOOK_SECRET>` | segredo no caminho, comparado em tempo constante                                                     |
| InfinitePay        | `https://<app>/api/webhooks/infinitepay`                            | não assinado; o corpo nunca decide, o `payment_check` confirma                                       |
| WhatsApp Cloud API | `https://<app>/api/webhooks/whatsapp`                               | verificação com `WHATSAPP_VERIFY_TOKEN` e assinatura `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET` |

Em homologação, use a instância e os aplicativos de teste de cada serviço, nunca os de produção.

## 5. Monitor de disponibilidade

Aponte um monitor (o do próprio Cloudflare, o Better Stack, o UptimeRobot ou o que a Kraamzorg preferir) para `https://<app>/api/saude` a cada 5 minutos. Alerte em resposta **503** (estado `falha`: banco inacessível ou o recálculo das 7h atrasado). Para ver o motivo, chame com o cabeçalho `x-kz-interno-secret` igual a `INTERNAL_ROUTES_SECRET`.

## 6. Subir e promover

**Homologação.** Merge de um pull request em `hml` faz o deploy de homologação. Cada pull request ganha um preview; abra-o, entre com uma pessoa do seed e confirme o login e o MFA (roteiro em `docs/sessoes/P14.md`).

**Produção.** Depois do aceite em homologação:

1. Rodar a lista de "Antes de promover" de `ambientes.md` seção 2.
2. Revisar o SQL das migrations novas. Aplicar em produção com `supabase db push --linked` **antes** do deploy, para o código novo nunca chegar a um banco sem a migration. Migration destrutiva (apagar coluna) vai em duas etapas: primeiro o código deixa de usar, depois a migration apaga.
3. Abrir o pull request de `hml` para `main`, com um resumo das migrations. Merge = deploy de produção.
4. Conferir `https://<app>/api/saude`, o login com MFA e o `checar-ambiente`.

## 7. Voltar atrás

- **Código:** na Vercel, **Deployments**, escolha o deploy bom anterior e use **Instant Rollback** (ou **Promote to Production**). É imediato e não mexe no banco.
- **Banco:** migrations só andam para frente. Se uma migration causou o problema, crie outra que corrija. Restaurar backup do banco é decisão da diretoria e segue `restauracao.md` (perde dados novos desde o backup).
- Depois de voltar, abra uma nota de incidente (`incidente.md`) se o problema afetou dado de família.

## 8. O que não fazer

- Não apontar preview de pull request para o Supabase de produção.
- Não colar segredo em issue, pull request, chat ou log. Segredo só no cofre e nas variáveis da Vercel.
- Não ligar `KZ_DADOS` fora do desenvolvimento.
- Não rodar seed em produção.
- Não deixar o proxy da Cloudflare ligado no endereço do app.
