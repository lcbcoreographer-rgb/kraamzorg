# Revisão final de segurança (P53)

Data: 30/09/2026. Escopo: tudo o que entrou desde o commit `99ffe1a` (migrations 0018 a 0028 e 0045, rotas de API novas, formulário e portal públicos, webhooks, portal da enfermeira offline e copiloto), mais a varredura de texto da onda. Base: PRD 16 e 21, CLAUDE.md, revisão anterior em `revisao-2026-09-25.md`.

Este documento não reproduz segredo nem dado pessoal. Todo número, e-mail e token citado é sintético.

## Veredito

Sem achado crítico, alto ou médio. Dois achados baixos confirmados e corrigidos com teste que falhava antes, três baixos aceitos com motivo, e a pendência LGPD-03 da revisão anterior continua aberta (baixa). O banco, as rotas e os webhooks resistiram a todas as tentativas desta revisão.

## Achados por gravidade

| ID      | Área                     | Gravidade | Situação                                              |
| :------ | :----------------------- | :-------- | :---------------------------------------------------- |
| REV-01  | Sentry (dado em URL)     | Baixa     | Corrigido (`src/lib/observabilidade/limpar.ts`)       |
| REV-02  | Texto de interface       | Baixa     | Corrigido (`recibo-conta.tsx`) e varredura automática |
| REV-03  | Push (destino do envio)  | Baixa     | Aceito com motivo, proposta abaixo                    |
| REV-04  | Tamanho de corpo         | Baixa     | Aceito com motivo                                     |
| REV-05  | Origem do limite de taxa | Baixa     | Aceito com condição (só atrás da Vercel)              |
| LGPD-03 | Termo de busca na URL    | Baixa     | Continua pendente, da revisão de 25/09                |

### REV-01: o token da pesquisa de satisfação ia para o Sentry

Como era: a pesquisa de satisfação (P42) abre em `/pesquisa/<token>`, com o token de uso único no caminho. A limpeza do Sentry (`limparUrl`) escondia o trecho secreto de `/formulario/`, `/api/webhooks/autentique/` e `/auth/`, mas não de `/pesquisa/`. Um erro na página, a URL da requisição ou uma migalha de navegação levava o token inteiro ao Sentry. Quem lê o Sentry podia responder a pesquisa no lugar da família enquanto o link valesse.

Prova antes da correção: o teste novo "esconde o token de uso único da pesquisa de satisfação" em `src/lib/observabilidade/limpar.test.ts` falhou com `/pesquisa/token_sintetico_da_pesquisa_de_teste` no lugar de `/pesquisa/[oculto]`.

O que bloqueia agora: `/pesquisa/` entrou em `PREFIXOS_SEGREDO`. O teste cobre caminho, URL completa e migalha de navegação.

### REV-02: sinal de menos tipográfico no recibo da proposta

Achado da varredura de texto, confirmado: `src/modules/crm/proposta/componentes/recibo-conta.tsx` escrevia o desconto como `R$ 420` precedido do sinal de menos tipográfico (U+2212). Não é travessão nem meia-risca, mas na tela tem a mesma cara de uma meia-risca, e o formatador do projeto (`formatarMoeda`) já escreve negativo com hífen. Era o único caso em componente de tela.

Prova antes da correção: o teste novo `tests/texto/sem-traco-longo.test.ts` falhou apontando `recibo-conta.tsx:77`.

O que bloqueia agora: o recibo usa `formatarMoeda(-desconto)`, e o teste varre todo `src/**/*.tsx` (fora comentário) e recusa U+2014, U+2013 e U+2212. A única exceção é a expressão regular que detecta travessão na tela de mensagens.

### REV-03: o endereço de push aceita qualquer host https

`api.registrar_inscricao_push` guarda o endpoint que o aparelho informa, com a restrição do banco de ser https. Qualquer pessoa logada com papel pode, pelo PostgREST, gravar como endpoint um host https qualquer, e o servidor de push (`src/modules/mensageria/push/servidor.ts`) faz um POST para ele quando houver aviso para essa pessoa.

Por que é baixa e fica aceita: o POST é cego (a resposta não volta a ninguém), o corpo vai cifrado para as chaves do próprio atacante, só sai para avisos da própria pessoa e a função roda na Vercel, sem rede interna a alcançar. Proposta para uma sessão própria: lista dos serviços de push aceitos (FCM, Mozilla, Apple, Windows) num `parametro`, conferida no banco, com o ajuste dos testes 025 e 026 que usam `push.exemplo.invalid`.

### REV-04: corpo lido antes de conferir o tamanho

`POST /api/sync` aceita um lote sem teto de itens e `POST /api/visitas/[id]/audio` lê o arquivo antes de conferir o tamanho pelo parâmetro `audio_visita`. As duas rotas exigem sessão com papel e AAL2, e a Vercel corta o corpo em 4,5 MB, então o pior caso é uma pessoa da equipe gastando a própria função. Aceito.

### REV-05: origem do limite de taxa vem do primeiro `x-forwarded-for`

`origemDaRequisicao` usa o primeiro valor de `x-forwarded-for`. Na Vercel esse cabeçalho é reescrito pela borda, então vale como IP do cliente. Fora da Vercel (outro proxy na frente), ele seria forjável e o limite por origem dos formulários públicos cairia para o limite por e-mail e o Turnstile. Aceito com a condição, agora escrita em `docs/runbooks/ambientes.md` (seção 5), de que o app só roda atrás da Vercel, com o registro do Cloudflare em DNS only.

### LGPD-03 (pendente desde 25/09)

O termo da busca de famílias e do pipeline continua na query string. Segue aceito com o motivo da revisão anterior e fica para sessão própria.

### Registro sem gravidade

`api.transicoes_permitidas` confere se a máquina foi informada antes de conferir o papel, e devolve 22023 em vez de 42501 para quem não tem papel. Não lê nada nem devolve dado. Fica registrado no teste 053.

## O que foi atacado e ficou de pé

Banco (todas as migrations, pelo catálogo e por chamada real, em `supabase/tests/053_revisao_final.sql`):

1. Nenhuma função de `public`, `api`, `privado`, `assistencial`, `agente` ou `agente_n8n` é executável por `anon` ou por PUBLIC. As funções dos formulários e páginas públicas (`formulario_contrato_*`, `pesquisa_*`, `captacao_*`, `candidatura_*`, `portal_familia_*`) só pelo `service_role`, chamado pelo servidor depois do Turnstile.
2. Toda função `security definer` tem `search_path` vazio; toda função de `api` é `security definer`; todas as 88 tabelas dos schemas do app têm RLS; nenhuma extensão em `public`.
3. As 189 funções de `api` chamadas com cada papel fora da lista e com uma conta logada sem papel (a conta da família do portal): todas recusam com 42501, menos o registro acima.
4. IDOR: uma enfermeira sem designação e uma pessoa do marketing chamaram toda função de `api` que recebe id, com ids reais do seed de famílias, visitas, relatórios, alertas, registros, cobranças, notas, contratos e conversas. Nenhuma resposta trouxe id de família, pessoa ou visita. O teste pega o vazamento: trocando a enfermeira por coordenação, ele falha e aponta cinco funções.
5. RLS por tabela: a conta sem papel não lê nenhuma linha de `public` além do próprio perfil. Enfermeira sem designação não lê família, visita, bebê nem registro. Marketing lê só `mensagem_modelo`.
6. Caminho de arquivo: `api.registrar_anexo_audio` só aceita `visitas/<id da visita>/<uuid>.<ext>` e `api.profissional_portal_salvar` só `profissionais/<id>/foto.<ext>`, então ninguém aponta o áudio ou a foto para arquivo de outra pessoa.
7. Tokens de uso único: formulário do contrato e pesquisa guardam só o sha256, o token some quando usado, tem validade e cada tentativa inválida conta no limite por origem (HMAC do IP, nunca o IP). Portal da família: limite por origem e por e-mail, resposta igual para e-mail desconhecido, família em freio ou sem acesso. Captação e candidatura: limite por origem, sem IP gravado.
8. Avisos de segurança do Supabase, reproduzidos pelo catálogo: nenhuma função com `search_path` mutável, nenhuma view `security definer` em `public` ou `api`, nenhuma tabela sem RLS, nenhuma extensão em `public`, nenhuma chave estrangeira sem índice em `public`.

App e integrações:

1. Webhooks: WhatsApp Cloud API com HMAC `x-hub-signature-256` em tempo constante; Autentique com segredo no caminho comparado por hash em tempo constante; InfinitePay nunca confia no corpo e confirma por `payment_check`, com valor pago igual ou maior que a cobrança; rotas internas e de saúde com segredo por hash em tempo constante; rotas de teste só em homologação e com segredo.
2. Cabeçalhos: CSP com nonce por requisição e `strict-dynamic`, sem `unsafe-inline` em script, `frame-ancestors 'none'`, HSTS de um ano, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e COOP; CSP `default-src 'none'` nas rotas de API; `no-referrer`, `noindex` e `no-store` no formulário, na pesquisa e no retorno do pagamento.
3. Sentry: sem PII padrão, sem usuário, cabeçalho, cookie, corpo nem query string; máscara de e-mail, CPF e telefone; agora também o token da pesquisa (REV-01).
4. Nome de arquivo: todo `Content-Disposition` usa id ou data, nunca nome. Exportação de marketing com proteção contra fórmula no CSV.
5. Modo demonstração: recusa subir fora de `desenvolvimento` e em produção da Vercel, então o atalho de sessão fictícia do portal não existe em homologação nem em produção.
6. Segredos no pacote do navegador: build de produção com todos os segredos trocados por marcadores; nenhum marcador em `.next/static` nem em `.next/server`.
7. Portal da enfermeira offline: `/api/sync` exige sessão com papel e AAL2 e recusa item de outro usuário; o service worker guarda só o casco do portal, sem página com dado de família, e o dado de paciente fica no IndexedDB por até 24 horas, apagado no logout.
8. Copiloto: pergunta com termo assistencial é recusada antes de ir ao modelo; as ferramentas leem pela sessão da pessoa (o banco aplica a matriz); a chave do modelo fica só no servidor.

Cadeia:

1. `gitleaks detect` em todo o histórico (75 commits): nenhum vazamento. `gitleaks detect --no-git` na árvore de trabalho: nenhum.
2. `pnpm audit` (produção e desenvolvimento): nenhuma vulnerabilidade conhecida.

## Restauração e carga

1. Restauração: `resetar.sh` do zero com o seed e o ensaio do runbook (`supabase/sem-docker/scripts/restaurar-teste.sh`, registrado em `docs/runbooks/restauracao.md`, seção 8): backup, restauração num banco temporário sem agendador, conferência da seção 3 idêntica (88/88 com RLS, contagens, 189 funções de `api`, 156 políticas, 4 gatilhos do registro), HMAC igual na cópia e log com HMAC. Aprovado.
2. Carga do webhook do agente no banco (`supabase/sem-docker/scripts/carga-agente.sh`): 20 mensagens simultâneas de 20 números diferentes, cada uma pelo caminho do fluxo 3 como `n8n_agente` (registrar, termos de alerta, pode responder, contexto, pode enviar). 20 de 20, sem erro, 20 conversas distintas, latência máxima abaixo de 250 ms. A carga pelo n8n de verdade depende do ambiente de homologação da Drop.

## Comandos

```bash
PGDATA=/tmp/kz-pg-p53 PGPORT=54430 supabase/sem-docker/scripts/resetar.sh
PGDATA=/tmp/kz-pg-p53 PGPORT=54430 supabase/sem-docker/scripts/testar.sh
PGDATA=/tmp/kz-pg-p53 PGPORT=54430 supabase/sem-docker/scripts/restaurar-teste.sh
PGDATA=/tmp/kz-pg-p53 PGPORT=54430 supabase/sem-docker/scripts/carga-agente.sh
KZ_PG_PORTA=54430 node --test n8n/*.test.mjs
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=4800 CI=1 pnpm e2e
PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PW_PORT=4900 CI=1 pnpm e2e:offline
gitleaks detect --no-banner
pnpm audit
```

As saídas desta rodada estão em `docs/sessoes/P53.md`.
