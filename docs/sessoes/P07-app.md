# P07 (parte de app) · Autenticação, MFA, sessões e a fundação de dados do CRM

Data: 25/09/2026
Branch e commits: branch de trabalho atual, sem commit desta sessão (a tarefa proíbe commit e push; o orquestrador fez um commit de segurança, "Banco e CRM: trabalho em andamento", no meio do caminho).

A parte de banco do P07 (RLS, schema `api`, `privado.aal2`, perfil a partir do convite) já estava na migration 0007. Esta sessão fez a parte de app que o P07 lista (itens 6 e 7) e a fundação que os cinco módulos do CRM (P13, P15, P16, P18 e P27) vão usar: dependências, clientes do Supabase, tipos gerados, repositórios com duas implementações e o modo demonstração. A casca por papel está em `docs/sessoes/P10-casca.md`.

Direção seguida: `docs/design/DESIGN.md` ("Caderneta de visita"), protótipo `docs/prototipo/entrar.html` (C7) e as regras da skill interface-2026 e da Impeccable em modo Operate (craft floor). O launcher da Impeccable não rodou, por instrução da tarefa: o contexto foi lido direto do DESIGN.md e do PRODUCT.md.

## Feito

1. **Dependências** (os módulos não instalam nada): `@supabase/supabase-js` 2.117, `@supabase/ssr` 0.12, `zod` 4, `server-only`, `react-hook-form` e `@hookform/resolvers` (formulários longos do P13 e do P16), `date-fns` e `@date-fns/tz` (datas no fuso de Brasília), `qrcode` (QR do MFA no modo demonstração), `recharts` (métricas do agente, P27, já na stack do PRD 5.1), `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs` e `@radix-ui/react-popover` ("Mover para" do pipeline, abas da ficha, filtros). Em desenvolvimento: `pg` e `@types/pg` (gerador de tipos), `@types/qrcode`.
2. **`src/lib/db`**: `cliente-servidor.ts` (cookies e RLS; chama `cookies()` antes de tudo para a rota nunca ser pré-renderizada), `cliente-navegador.ts` (só chave anônima), `cliente-servico.ts` (`import "server-only"`, recebe o motivo do uso, e a lista de motivos é a lista inteira: `convite_usuario` e `sessoes_diretoria`), `configuracao.ts` e `types.ts` gerado (3.944 linhas: 51 tabelas e views, 16 funções, 49 enums, com `Constants` das listas de enum).
3. **Gerador de tipos sem Docker**: `scripts/gerar-tipos-local.mjs` faz a introspecção por SQL (pacote `pg`) nos schemas `public` e `api` e escreve o tipo `Database` no formato da CLI do Supabase (Tables com Row, Insert, Update e Relationships; Views; Functions com Args e Returns, inclusive `TABLE(...)` e `SETOF tabela`; Enums; CompositeTypes; e os utilitários `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `CompositeTypes` e `Constants`). Scripts `pnpm db:types:local` e `pnpm db:types` (CLI oficial, `--schema public --schema api`, para quando houver Docker). Os dois geram o mesmo formato, então o código não muda na troca.
4. **Repositórios** (`src/lib/dados`): interfaces por domínio em `repositorios.ts` (famílias e pipeline, ficha, tarefas, configurações, agente, usuários), tipos de domínio em `tipos.ts`, erro único `ErroRepositorio` com código traduzido do PostgREST (`sem_permissao`, `nao_encontrado`, `recusado`, `funcao_pendente`, `indisponivel`). Duas implementações:
   - `supabase/`: leitura pela RLS com colunas explícitas (nunca `select *` em `familia`, que tem colunas fora do grant), escrita e dado sensível por `cliente.schema("api").rpc(...)` (`transicionar`, `dados_contrato`, as quatro do freio).
   - `demonstracao/`: loja em memória criada das fixtures, que seguem o seed (as doze "Família Teste ...", as pessoas e os telefones +55 11 90000-03xx, estágios, pacotes, os 30 parâmetros e as transições de P1 e P2 copiadas de `privado.transicao_permitida`). Imita a RLS de forma simplificada (papel com MFA em AAL1 não vê nada, evento restrito só para coordenação e diretoria, parâmetro só para a diretoria) e recusa transição não permitida como o banco.
   - `fabrica.ts`: `await obterRepositorios()`, uma instância por renderização. `modo.ts` decide: demonstração só com `NEXT_PUBLIC_APP_ENV=desenvolvimento` e `KZ_DADOS=demonstracao`; pedida em qualquer outro ambiente (ou num deploy de produção da Vercel), lança `ErroModoDemonstracao` em vez de cair no Supabase em silêncio.
5. **Autenticação** (`src/lib/auth`): interface `ProvedorAutenticacao` com as duas implementações (Supabase Auth: senha, `mfa.enroll`, `challengeAndVerify`, `resetPasswordForEmail`, `verifyOtp`, `updateUser`; demonstração: seletor de pessoa fictícia e código 123456 do protótipo). A tela pergunta a forma de entrada (`formaDeEntrada()`) e não sabe qual implementação roda.
6. **Proxy** (`src/proxy.ts`, o antigo middleware: no Next 16 o arquivo se chama `proxy.ts` e exporta `proxy`, conferido em `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). A regra é a função pura `decidirAcesso` (`src/lib/auth/acesso.ts`): sem sessão vai para `/entrar?proximo=`; papel com MFA obrigatório (enfermeira, financeiro, coordenação, diretoria, espelho de `privado.perfil_exige_mfa()`) em AAL1 vai para o desafio, ou para o cadastro se ainda não tem fator; quem tem fator sempre passa pelo desafio; rota fora da navegação do papel volta para o início do papel; perfil sem papel ou desativado sai com aviso.
7. **Telas no grupo `(auth)`**, a partir do protótipo `entrar.html`: `/entrar` (e-mail e senha; na demonstração, seletor), `/mfa/desafio`, `/mfa/cadastro` (QR, chave em texto e três passos), `/esqueci-senha` (resposta igual exista ou não o e-mail), `/definir-senha` (convite e recuperação), `/convidar` (diretoria: nome, e-mail e papéis), `/auth/confirmar` (link do e-mail com `token_hash`) e `/sair` (POST do botão; GET só para o proxy tirar perfil sem acesso). Textos em `src/app/(auth)/mensagens.ts`, todos com o que aconteceu e o que fazer.
8. **Tela de sessões da diretoria** (`/sessoes`, P07 item 7): pessoas com papéis, situação e último acesso (tabela no computador, cartões no celular) e "Encerrar sessões" com confirmação em folha.
9. **Testes Vitest** (81 nos arquivos novos): fábrica e modo (inclusive o erro fora de desenvolvimento, na fábrica, na loja e no `criarRepositorios`), repositórios de demonstração, escrita pelo schema `api` na implementação Supabase com cliente falso, `decidirAcesso` caso a caso, o proxy de ponta a ponta com `NextRequest`, a lista de MFA contra a migration 0007, e o cliente de serviço importado só pelos arquivos autorizados e nunca por "use client".
10. **Playwright** (`tests/e2e/acesso.spec.ts`): raiz leva a entrar, tela pedida volta depois de entrar, desafio do MFA com código errado e certo, esqueci a senha, e o fluxo inteiro de convite pela diretoria, cadastro do MFA com QR pela pessoa convidada e revogação das sessões dela, com axe em cada tela, nos projetos celular e computador.

## Ficou de fora (e por quê)

- **Aceite com Supabase Auth de verdade** ("Playwright faz login com MFA no celular" com senha e TOTP reais): não há GoTrue nem PostgREST nesta máquina. O mesmo fluxo roda no modo demonstração; com Docker, falta um e2e contra `supabase start` com um usuário de teste com TOTP.
- **Função que revoga as sessões no banco**: o supabase-js não tem método de admin que encerre as sessões de outra pessoa pelo id. `auth.admin.signOut(jwt, scope)` pede o JWT da própria pessoa, que o servidor não tem; `updateUserById` com `ban_duration` bloqueia o login, mas não é revogação. O caminho é apagar as linhas de `auth.sessions` do usuário, o que derruba o refresh token de todas as sessões. A tela e o repositório já chamam `api.revogar_sessoes(usuario_id)` (via `rpcPendente`, que devolve `funcao_pendente` com frase clara enquanto a função não existir). Migration é da trilha de banco (pendência abaixo).
- **Lista de sessões por aparelho**: `auth.sessions` não é exposto; a tela mostra o último acesso de cada pessoa (Supabase Auth, pela chave de serviço, motivo `sessoes_diretoria`).
- **Métodos de escrita que ainda não têm função no banco** (cadastro manual de lead, resolver transferência, devolver à Isadora, enviei da tarefa): ficam para os módulos donos, que acrescentam na interface e nas duas implementações.

## Decisões tomadas nesta sessão

1. **Modo demonstração por variável de servidor** (`KZ_DADOS=demonstracao`), aceito só com `NEXT_PUBLIC_APP_ENV=desenvolvimento`. Pedir demonstração fora disso lança erro na primeira requisição: um ambiente mal configurado para na hora, não serve dado inventado. `.env.example` documenta a variável.
2. **Quem tem MFA cadastrado sempre passa pelo desafio**, mesmo o comercial, que não é obrigado. Quem é obrigado e não tem vai para o cadastro. O cadastro não é oferecido a quem já está em AAL2.
3. **Destino depois do login calculado na Server Action** (`destinoDepoisDoLogin`), com a mesma regra do proxy. O redirect de Server Action não passa pelo proxy, e sem isso a tela do MFA aparecia com a URL "/" (achado nas capturas).
4. **Convite**: `auth.admin.createUser` com o nome em `app_metadata` (o gatilho `privado.criar_perfil_do_convite` da 0007 cria o perfil), papéis gravados em `usuario_papel` pela sessão da diretoria (RLS, AAL2), e depois `auth.admin.inviteUserByEmail` com retorno para `/definir-senha`. Se a gravação dos papéis falha, a conta criada é apagada.
5. **Cliente de serviço com motivo declarado** e teste que falha se outro arquivo importar. Hoje só `src/lib/dados/supabase/usuarios.ts` usa (convite e último acesso).
6. **Sessão de 8 horas não é número no app**: é o time-box de sessão do Supabase Auth. A tela de entrar diz "Sua sessão terminou. Por segurança, entre de novo." sem citar horas.
7. **Fixtures com ids próprios**: o seed gera os ids com `gen_random_uuid()`, então a demonstração usa ids fixos e mantém nomes, telefones e estágios do seed. Transferências e tarefas não existem no seed; as da demonstração são inventadas sobre famílias do seed. O perfil fictício de financeiro nasce sem MFA cadastrado, para o cadastro com QR aparecer na demonstração.
8. **Ajustes fora de `src/lib`, necessários para os comandos ficarem verdes**:
   - `vitest.config.ts` passou a excluir `n8n/**` (os `n8n/*.test.mjs` são de `node:test` e quebravam o `pnpm test` antes desta sessão) e `.claude/**` (worktrees de outras sessões em paralelo); `eslint.config.mjs` e `tsconfig.json` também ignoram `.claude`.
   - `eslint.config.mjs`: `no-unused-vars` aceita `_nome` e irmãos de rest, para `{ campo: _campo, ...resto }`.
   - `playwright.config.ts`: `KZ_DADOS=demonstracao` no servidor de teste e porta por `PW_PORT` (padrão 3000), para não reaproveitar o servidor de outra sessão.
   - `Botao` virou componente cliente: com `asChild` ele passa `onClick` ao filho, o que um Server Component não pode fazer (o build quebrava).
   - `CampoTexto` ganhou `inputMode`, `pattern`, `spellCheck`, `autoCapitalize` e `acessorio` (o "Mostrar" da senha); `EscolhaMultipla` ganhou `erro`; `EstadoVazio` ganhou `nivelTitulo` (pendência da auditoria da P10 parcial).
9. **Raiz `/`** não tem mais conteúdo: o proxy manda para o início do papel ou para `/entrar`, e `src/app/page.tsx` só redireciona.

## Mudanças no PRD

Nenhuma (fora do escopo desta sessão). Divergências para quem edita o PRD e o CLAUDE.md:

- CLAUDE.md, "Comandos": `supabase gen types typescript --local > src/lib/db/types.ts` gera só `public`; o app precisa de `api` também. O script `pnpm db:types` usa `--schema public --schema api`.
- PRD 20.4 não lista as abas do marketing. Adotado Início e Mais, e o Início diz que o conteúdo é agregado [confirmar: Leonardo].

## Pendências novas ([confirmar], [clínico], terceiros)

Para a trilha de banco (migrations depois da 0011):

- `api.revogar_sessoes(usuario_id uuid) returns jsonb`, `security definer`, só diretoria em AAL2 (`privado.autorizar(array['diretoria'], true)`), apaga `auth.sessions` do usuário (as `auth.refresh_tokens` caem em cascata) e grava em `log_auditoria`. Grant para `authenticated`. Opcional: `api.sessoes_ativas()` com contagem por usuário, para a tela mostrar quantos aparelhos.
- Leitura de parâmetros não sensíveis por quem não é diretoria (hoje a RLS de `parametro` só deixa a diretoria ler): o comercial precisa de `freio_desfazer_segundos` no freio da ficha (P16) e de `comercial_resposta_no_app` na conversa (P27). Sugestão: `api.parametros_da_tela(chaves text[])` com uma lista fechada de chaves.
- Transições permitidas para a tela do pipeline (P15, "só aparecem as transições permitidas"): `privado.transicao_permitida` não é legível pelo app. Sugestão: `api.transicoes_permitidas(maquina, de)`.

Configuração do Supabase Auth (P14, terceiros):

- Time-box de sessão de 8 horas (PRD 5.1 e 13), MFA TOTP ligado, URLs de retorno do app.
- Modelos de e-mail de convite e de recuperação apontando para `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite` (ou `recovery`).
- [confirmar em homologação] que o `inviteUserByEmail` envia o convite para um usuário criado antes por `createUser` e ainda não confirmado (é assim que o perfil nasce com o nome, pela 0007).

## Como testar

```bash
pnpm install
pnpm lint && pnpm typecheck
pnpm test                      # Vitest: fábrica, modo, proxy, acesso, navegação, MFA x 0007, service_role
pnpm build

# e2e no modo demonstração (o playwright.config.ts já liga KZ_DADOS=demonstracao)
PW_PORT=3951 PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm e2e

# navegar à mão no modo demonstração
NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao pnpm build
NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao pnpm start -p 3950
# abrir http://127.0.0.1:3950, escolher o papel; código do MFA: 123456

# prova de que a demonstração não roda fora de desenvolvimento (o mesmo que
# src/lib/dados/fabrica.test.ts cobre): a primeira requisição falha com ErroModoDemonstracao
NEXT_PUBLIC_APP_ENV=homologacao KZ_DADOS=demonstracao pnpm build
NEXT_PUBLIC_APP_ENV=homologacao KZ_DADOS=demonstracao pnpm start -p 3952

# tipos do banco local (supabase/sem-docker no ar; porta da sua trilha)
PGDATA=/tmp/kz-pg-crm PGPORT=54350 supabase/sem-docker/scripts/iniciar.sh
PGDATA=/tmp/kz-pg-crm PGPORT=54350 supabase/sem-docker/scripts/resetar.sh
PGPORT=54350 pnpm db:types:local
```

## Resultado dos invariantes

| Comando                                   | Resultado                                                                                                                                                          |
| :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                               | Verde, 0 erro (1 aviso antigo em `n8n/referencia/comparar.mjs`, fora do escopo)                                                                                    |
| `pnpm typecheck`                          | Verde                                                                                                                                                              |
| `pnpm test`                               | Verde, 304 testes em 23 arquivos (81 novos nesta sessão)                                                                                                           |
| `pnpm build`                              | Verde, 33 rotas, proxy ativo                                                                                                                                       |
| `pnpm e2e` (celular e computador)         | Verde, 44 testes                                                                                                                                                   |
| `gitleaks detect --no-git --no-banner`    | Sem vazamento                                                                                                                                                      |
| `supabase test db` (invariantes 1, 2 e 3) | Não rodado: esta sessão não mexe em `supabase/` (trilha de banco)                                                                                                  |
| `pnpm e2e:offline` (invariante 4)         | Placeholder do P12, sem mudança                                                                                                                                    |
| `pnpm format:check`                       | Os arquivos desta sessão passam; 52 arquivos antigos de `supabase/`, `n8n/`, `docs/` e `scripts/baixar-municipios.mjs` continuam fora do Prettier (outras trilhas) |

## Verificação independente (depois da entrega)

Conferido: cliente de serviço só em `src/lib/dados/supabase/usuarios.ts`, que é `server-only`; nenhum componente cliente importa `src/lib/dados`, a autenticação do servidor ou os clientes de banco (o teste `src/lib/db/cliente-servico.test.ts` agora cobre também `dados/demonstracao`, `dados/modo` e `auth/sessao`, `auth/supabase`, `auth/demonstracao` e `auth/borda`); o `.next/static` do build não tem `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `auth.admin` nem o cookie da demonstração. Build de verdade com `NEXT_PUBLIC_APP_ENV=producao` e com `homologacao`, servido com `KZ_DADOS=demonstracao`: toda rota responde 500 com `ErroModoDemonstracao`, sem mostrar dado fictício. Tipos regenerados do banco local (0001 a 0011) batem byte a byte com `src/lib/db/types.ts`. Abas e grupos batem com o PRD 20.4.

Corrigido:

1. **Rota fora do registro seguia.** `decidirAcesso` deixava passar, com sessão, qualquer caminho que `podeAbrir` não conhecia (`/Financeiro`, `/%66inanceiro`, rota nova sem registro). Agora nega por padrão e volta para o início do papel; rota nova só abre depois de entrar em `src/lib/navegacao` ou nas listas de `acesso.ts`.
2. **O matcher do proxy pulava caminho terminado em `.png`, `.svg`, `.ico`, `.webp` ou `.woff2`.** `/familias/x.png` abria a rota dinâmica `/familias/[id]` sem passar pelo proxy (sem MFA nem papel). O matcher agora só deixa de fora `_next/`, `__nextjs`, `favicon.ico`, `brand/` e `api/`. Arquivo novo em `public/` que precise abrir sem sessão (manifest e service worker do P11 e do P12) entra no matcher pelo caminho exato.
3. **`exigirSessao` não conferia MFA nem papel.** Era a segunda barreira só de "tem sessão". Agora exige perfil ativo com papel e o AAL2 de quem precisa; com o caminho (`exigirSessao("/sessoes")`), aplica a mesma regra do proxy, papel incluído. As Server Actions de convite e de encerrar sessões usam o caminho, então a diretoria em AAL1 (ou outro papel por POST direto) não chega ao `auth.admin.createUser`. As telas do MFA, a de senha e a de convite também.
4. **Troca de senha pelo link do e-mail com MFA já cadastrado.** O Supabase Auth recusa trocar a senha de quem tem fator verificado em AAL1, e o link do e-mail sozinho não deve bastar. O proxy e a ação agora levam essa pessoa ao desafio antes de `/definir-senha` (`?proximo=/definir-senha`). A pessoa convidada, que ainda não tem fator, segue direto.
5. **Estado sem sinal das telas de acesso (telas.md, C7).** Sem conexão, o formulário não envia e a faixa explica que é preciso sinal, com o texto do protótipo em `/entrar`. O botão do desafio passou a "Usar outro e-mail", como no protótipo.

Testes novos: `src/lib/auth/sessao.test.ts`, casos em `acesso.test.ts` e `proxy.test.ts`, e dois e2e em `tests/e2e/acesso.spec.ts` (sem sinal no desafio; extensão, letra codificada e rota sem registro). Depois das correções: `pnpm test` 313 testes em 24 arquivos, `pnpm e2e` 48 testes, lint, typecheck e gitleaks verdes.

Pendência nova: o comercial não está em `privado.perfil_exige_mfa()`, mas `api.dados_contrato(..., completo = true)` exige AAL2 do comercial. Quem vai gerar contrato (P31) precisa ter o MFA cadastrado, ou o CPF completo nunca abre para o comercial. Decidir com o Leonardo se o comercial passa a ter MFA obrigatório.
