# Runbook · Ambientes

Como os três ambientes do Kraamzorg OS se separam, quais variáveis cada um tem, como o código sobe de um para o outro e como conferir que a produção não tem dado de teste nem a homologação tem dado real. Vale com `deploy-vercel.md` (passo a passo da Vercel e do domínio). Base: PRD 5.5, 21.2, 21.3 e 21.4.

## 1. Os três ambientes

| Ambiente    | Supabase                                           | Vercel                                                          | n8n e WhatsApp                                                                                              | Dados                                           |
| :---------- | :------------------------------------------------- | :-------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| Local       | `supabase start` (Docker) ou `supabase/sem-docker` | `pnpm dev`                                                      | sem agente                                                                                                  | Seed sintético. `KZ_DADOS=demonstracao` só aqui |
| Homologação | projeto `kraamzorg-hml`                            | branch `hml` e previews de pull request                         | fluxos com sufixo `(HML)`, instância UAZAPI de teste, Cloud API em captura ou número de teste, modo `teste` | Seed sintético                                  |
| Produção    | projeto `kraamzorg-prod`                           | branch `main`, domínio `app.kraamzorgbrasil.com.br` [confirmar] | fluxos de produção, número oficial pela Cloud API                                                           | Dados reais                                     |

Contas, projetos e repositório ficam em nome da Kraamzorg (D-12). A Drop opera com acesso revogável. Credencial só pelo cofre de senhas, nunca por WhatsApp ou e-mail.

`NEXT_PUBLIC_APP_ENV` diz em que ambiente o código está: `desenvolvimento`, `homologacao` ou `producao`. Ela decide o que existe (por exemplo, `/design-system` e as rotas `/api/teste/*` só fora de produção). `VERCEL_ENV=production` é a segunda trava: um deploy de produção nunca liga a vitrine, o modo demonstração nem a captura, mesmo que a variável do app esteja errada.

## 2. Ramos e promoção

- `hml` é a homologação. `main` é a produção. Todo trabalho nasce de um ramo `pNN-nome-curto` a partir de `hml` e volta para `hml` por pull request.
- A promoção de `hml` para `main` acontece só depois do aceite, num passo controlado, com as migrations revisadas por uma pessoa (CLAUDE.md). Nada é promovido com teste vermelho.
- Preview de pull request aponta para o Supabase de **homologação**, nunca para o de produção (seção 3).
- Migration nunca se edita depois de aplicada: cria-se outra. `supabase db push` só depois de revisão humana do SQL.

Antes de promover:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
supabase test db                      # ou supabase/sem-docker/scripts/testar.sh
pnpm e2e:offline                      # invariante 4
node --test n8n/build.test.mjs        # se mexeu no n8n
gitleaks detect --no-banner
node --env-file=.env.producao scripts/checar-ambiente.mjs --env producao
```

## 3. Variáveis por ambiente

`.env.example` lista todas, com o que cada uma faz. **Só os nomes** ficam neste runbook; os valores moram no cofre da Kraamzorg e nas variáveis da Vercel. `scripts/checar-ambiente.mjs` confere a lista abaixo sem imprimir nenhum valor.

| Grupo              | Variáveis                                                                                                                   | Homologação                                                       | Produção                                                               |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- | :--------------------------------------------------------------------- |
| Ambiente           | `NEXT_PUBLIC_APP_ENV`                                                                                                       | `homologacao`                                                     | `producao`                                                             |
| Supabase           | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                                    | do projeto `kraamzorg-hml`                                        | do projeto `kraamzorg-prod`                                            |
| Endereço do app    | `APP_BASE_URL`                                                                                                              | endereço de homologação                                           | `https://app.kraamzorgbrasil.com.br` [confirmar]                       |
| Segredos internos  | `CRON_SECRET`, `INTERNAL_ROUTES_SECRET`                                                                                     | próprios de hml, 24 caracteres ou mais                            | próprios de prod, diferentes dos de hml                                |
| E-mail             | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                                                                       | domínio verificado                                                | domínio verificado                                                     |
| Captcha            | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`                                                                    | widget do domínio de hml                                          | widget do domínio de produção. Chave de teste da Cloudflare é recusada |
| Erros              | `NEXT_PUBLIC_SENTRY_DSN`                                                                                                    | projeto Sentry de hml                                             | projeto Sentry de produção                                             |
| Contrato           | `AUTENTIQUE_API_TOKEN`, `AUTENTIQUE_WEBHOOK_SECRET`, `AUTENTIQUE_SANDBOX`                                                   | sandbox ligado                                                    | `AUTENTIQUE_SANDBOX=false` explícito                                   |
| Cobrança           | `INFINITEPAY_HANDLE`, `INFINITEPAY_API_KEY`                                                                                 | conta de teste [confirmar]                                        | conta da Kraamzorg                                                     |
| Push               | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                                                        | par próprio de hml                                                | par próprio de produção                                                |
| WhatsApp Cloud API | `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_VERSAO` | opcionais: sem elas o envio é capturado em `/api/teste/cloud-api` | obrigatórias (T-01)                                                    |
| UAZAPI             | `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`                                                                                           | instância de teste                                                | só avisos internos até a migração (T-01)                               |
| Agente             | `N8N_WEBHOOK_REINDEXAR_URL`, `OPENAI_API_KEY`, `OPENAI_MODELO_RESUMO`                                                       | de hml                                                            | de produção                                                            |
| NFS-e              | `NFSE_PROVEDOR_BASE_URL`, `NFSE_PROVEDOR_API_KEY`                                                                           | sandbox do provedor                                               | do provedor                                                            |

Regras que não mudam:

- `KZ_DADOS` (modo demonstração) **nunca** existe em homologação nem em produção. O app lança erro na primeira requisição se estiver.
- Segredo de homologação e de produção são sempre **diferentes**. Copiar o valor de um para o outro é incidente (ver `incidente.md`).
- `SUPABASE_SERVICE_ROLE_KEY` só no servidor: nunca `NEXT_PUBLIC_`, nunca no n8n (CLAUDE.md). O teste `src/lib/db/cliente-servico.test.ts` falha se um arquivo fora da lista a usar.
- Gerar o par VAPID: `node scripts/gerar-chaves-vapid.mjs`. A chave pública vai em `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; a privada só em `VAPID_PRIVATE_KEY`. Trocar o par derruba as inscrições de push existentes (cada aparelho liga os avisos de novo).

### Como conferir um ambiente

```bash
vercel env pull .env.homologacao --environment=preview --git-branch=hml   # arquivo fica fora do git
node --env-file=.env.homologacao scripts/checar-ambiente.mjs --env homologacao
```

A saída lista os nomes com problema e o motivo ("está vazia", "precisa começar com https://", "deveria valer producao neste ambiente"). Código de saída 1 se houver problema. Apague o arquivo `.env.*` depois: ele tem segredos.

## 4. Dados: o que entra em cada ambiente

**Homologação.** Migrations (depois de revisadas) e o seed sintético (`supabase/seed.sql`, `supabase/dados/*.sql`). Nome, telefone e e-mail do seed são fictícios (`exemplo.invalid`, DDD e números de teste). Nenhum arquivo do Drive do cliente entra.

**Produção.** Migrations e **só** dados reais de configuração (pacotes, localidades, parâmetros, textos aprovados), por migration de dados separada e revisada. O seed **não** roda em produção: `supabase db push` aplica migrations e não roda seed (o seed é do `supabase db reset`, que só existe local). Os dados reais de família entram pelo uso do sistema.

Antes de abrir a produção (e depois de cada promoção), rode no banco de produção, com papel somente leitura e sem imprimir linhas:

```sql
-- nenhuma família, pessoa, conversa ou mensagem de teste
select 'familia' as tabela, count(*) from public.familia where nome_exibicao like 'Família Teste%'
union all select 'pessoa', count(*) from public.pessoa where email like '%@exemplo.invalid'
union all select 'conversa', count(*) from public.conversa where telefone_e164 like '+5511900000%';
-- parâmetros de teste que não podem ir para produção
select chave from public.parametro where chave = 'agente_whitelist' and valor::text like '%+5511900000%';
```

Resultado esperado: zeros e nenhuma linha. Qualquer valor diferente de zero bloqueia a abertura.

Aceite do P14: "produção configurada sem nenhum dado de família". Isso se prova com a consulta acima em zero, o `checar-ambiente` sem problema e o `agente_modo` em `desligado` até a Cloud API estar homologada (PRD 22.1, T-01).

## 5. Cloudflare

- **Registro do app:** `CNAME` do endereço do app para o alvo que a Vercel indica, em modo **DNS only** (nuvem cinza). Sem proxy: a Vercel já entrega TLS e os cabeçalhos de segurança do app não podem ser alterados no meio do caminho. Também é por isso que o limite de tentativas dos formulários públicos pode confiar no primeiro `x-forwarded-for`, que a borda da Vercel reescreve: com outro proxy na frente, esse IP passa a ser forjável (revisão final P53, REV-05).
- **Resend:** os registros SPF, DKIM e (se indicado) DMARC do domínio remetente, exatamente como o painel do Resend mostra.
- **Turnstile:** um widget por ambiente, cada um com o domínio do respectivo ambiente. Os formulários públicos (contrato, pesquisa, captação) recusam envio sem token válido.
- **HSTS:** o app envia `Strict-Transport-Security` por um ano com subdomínios. Incluir o domínio na lista de pré-carga dos navegadores é decisão da diretoria, porque é difícil de desfazer [confirmar: Leonardo].

## 6. Cabeçalhos de segurança

Definidos em `src/lib/seguranca/cabecalhos.ts`, aplicados por `src/proxy.ts` (CSP com nonce novo por requisição, nas páginas) e por `next.config.ts` (cabeçalhos fixos em tudo e CSP fechada nas rotas de API):

| Cabeçalho                   | Valor                                                                                                                                                                                   |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `script-src` só com o nonce da requisição e `strict-dynamic` (mais o script do Turnstile); `frame-ancestors 'none'`; `object-src 'none'`; `connect-src` só o app, o Supabase e o Sentry |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`                                                                                                                                                   |
| `X-Frame-Options`           | `DENY`                                                                                                                                                                                  |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                                                                               |
| `Referrer-Policy`           | `strict-origin-when-cross-origin` (o formulário do contrato e o retorno do pagamento usam `no-referrer`)                                                                                |
| `Permissions-Policy`        | microfone só do próprio app (gravador da visita); câmera, localização, pagamento e USB fechados                                                                                         |

Domínio novo de terceiro (outro script, outro serviço de imagem, outro destino de `fetch`) exige mudar `cabecalhos.ts` e o teste `cabecalhos.test.ts` no mesmo commit. O teste `tests/e2e-infra` abre as telas principais e falha com qualquer violação de CSP.

## 7. Observabilidade

- **Sentry:** liga só com `NEXT_PUBLIC_SENTRY_DSN` em homologação e produção. Nunca envia nome, telefone, e-mail, CPF, conteúdo de mensagem, cabeçalho, cookie, corpo de requisição nem query string (`src/lib/observabilidade/limpar.ts`, testado). Erro de rota nunca leva dado de paciente na mensagem.
- **`/api/saude`:** aberta, devolve só `{estado, verificadoEm}` (200 para `ok` e `atencao`, 503 para `falha`). Com o cabeçalho `x-kz-interno-secret` igual a `INTERNAL_ROUTES_SECRET`, devolve cada verificação com o motivo. Confere o recálculo diário das 7h (10:00 UTC), os jobs do agendador, os últimos webhooks (Autentique, InfinitePay, WhatsApp) e as falhas de automação e de sincronização. Aponte o monitor de disponibilidade para ela e alerte em 503.
- **Parâmetros da saúde** (`parametro`, editáveis pela diretoria): `saude_recalculo_tolerancia_horas` (padrão 26) e `saude_janela_falhas_horas` (padrão 24).
- **n8n:** execuções com sucesso não guardam conteúdo; erros ficam por 7 dias (PRD 21.3).

## 8. Quem faz o quê

| Tarefa                                                | Quem                                                           |
| :---------------------------------------------------- | :------------------------------------------------------------- |
| Criar contas e projetos, guardar credenciais no cofre | Leonardo (Kraamzorg)                                           |
| Configurar variáveis, domínio, promoção e monitor     | Drop, com acesso revogável                                     |
| Revisar o SQL de migration antes do `db push`         | Uma pessoa da Kraamzorg ou da Drop, diferente de quem escreveu |
| Aprovar a promoção de `hml` para `main`               | Leonardo, depois do aceite                                     |
