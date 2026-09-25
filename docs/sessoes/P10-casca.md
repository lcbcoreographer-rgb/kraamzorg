# P10 (item 3) · Casca por papel e rotas dos módulos

Data: 25/09/2026
Branch e commits: branch de trabalho atual, sem commit desta sessão (a tarefa proíbe commit e push).

Completa o P10: o que faltava depois de `docs/sessoes/P10-parcial.md` era a casca por papel, que dependia dos papéis do P07. A autenticação, o proxy e os repositórios desta mesma sessão estão em `docs/sessoes/P07-app.md`.

Leitura de contexto: PRD 20.4 (abas por papel e grupos da lateral), DESIGN.md seções 3 e 6 (grid, barra lateral, abas inferiores, estado vazio), protótipo `comercial-inicio.html`, `coordenacao-inicio.html`, `enfermeira-hoje.html` e `comercial.html` (a aba "Mais"). Direção já declarada no DESIGN.md ("Caderneta de visita", Operate, cor contida): nenhuma direção nova, a casca obedece ao sistema. O launcher da Impeccable não rodou (instrução da tarefa); o contexto foi lido direto do DESIGN.md e do PRODUCT.md. O arquivo de clima da interface-2026 não existe nesta sessão; a direção veio por princípio, como no DESIGN.md.

## Feito

1. **Registro único da navegação** (`src/lib/navegacao/index.ts`): `ROTAS` com caminho, rótulo, ícone (por nome, para o proxy não carregar React) e dono de cada tela; `NAVEGACAO` com as abas do celular e os grupos da barra lateral de cada papel. Funções derivadas: `abasDe`, `gruposDe` (junta os papéis sem repetir item, grupos sempre na ordem Comercial, Operação, Experiência, Gestão, Sistema), `gruposDoMais`, `caminhoInicial`, `podeAbrir`, `rotaDoCaminho` e `ativo`. O proxy usa a mesma lista para manter cada papel dentro da própria navegação.
2. **Abas por papel, PRD 20.4**: Enfermeira (Hoje, Famílias, Alertas, Perfil), Comercial (Início, Pipeline, Conversas, Famílias, Mais), Coordenação (Início, Radar, Agenda, Famílias, Mais), Financeiro (Início, Cobranças, Notas, Mais), Diretoria (Início, Pipeline, Radar, Financeiro, Mais). Marketing, que o PRD não lista: Início e Mais [confirmar].
3. **Barra lateral agrupada** como no protótipo: Comercial (Início, Pipeline, Conversas, Transferências, Famílias, Tarefas) e Sistema (Isadora) para o comercial; Operação (Início, Radar, Agenda, Equipe, Tarefas), Experiência (Famílias, Conversas, Transferências) e Sistema (Configurações) para a coordenação; Comercial (Famílias) e Gestão (Início, Cobranças, Notas, Tarefas) para o financeiro; Gestão (Início) para o marketing; Comercial, Operação, Gestão e Sistema (Isadora, Configurações, Sessões e acessos) para a diretoria. Pessoa com vários papéis vê a união; as abas do celular são as do papel de maior precedência (diretoria, coordenação, comercial, financeiro, marketing, enfermeira).
4. **Casca** (`src/components/shell`): `CascaApp` (celular: uma coluna, margem de 16 px, abas inferiores fixas de 56 px com a marca dourada de 3 px na ativa; computador a partir de 1024 px: barra lateral marinho de 248 px, conteúdo até 1240 px com margem de 32 px, nome e papéis da pessoa e "Sair" no rodapé da lateral), `CascaEnfermeira` (abas em qualquer largura, sem lateral, conteúdo até 720 px, como pede o telas.md), `CabecalhoTela` (título único em Jost, preso no topo com divisória fina) e `TelaEmConstrucao` (estado vazio que diz o que vai aparecer e a próxima ação possível). Link "Pular para o conteúdo" nas duas cascas. Os componentes `BarraLateral` e `AbasInferiores` da P10 parcial foram usados como estavam, com os itens vindos do registro.
5. **Rotas criadas com estado vazio, uma pasta por dono** (mapa abaixo), mais `/mais` (o resto da navegação do papel em cartões tocáveis, nos mesmos grupos, e o botão de sair) e a raiz `/`, que o proxy manda para o início do papel ou para `/entrar`.
6. **Tokens novos no `@theme`**: `--container-portal` (720 px, portal da enfermeira) e `--container-acesso` (400 px, coluna das telas de entrar), registrados também no `tailwind-merge`. `::selection` no tom da marca (marinho sobre dourado lavado). Um travessão num comentário antigo do `globals.css` (achado do `lint_slop.py`) virou vírgula.
7. **Testes**: Vitest da navegação por papel (`src/lib/navegacao/navegacao.test.ts`: abas do PRD na ordem, 2 a 5 abas, ordem fixa dos grupos, grupos do protótipo, sessões só para a diretoria, união sem repetir, Mais, caminho inicial, prefixo mais longo, item ativo em subcaminho, caminho único e dono de cada rota). Playwright `tests/e2e/navegacao-por-papel.spec.ts`: cada um dos seis papéis entra pelo seletor, passa pelo MFA quando o papel exige e confere as abas (celular) ou os grupos da lateral (computador), o item ativo, a ausência de rolagem lateral e o axe sem violação séria ou crítica; mais a rota fora da navegação voltando para o início, as rotas do comercial abrindo com o título certo e a aba "Mais" com o sair.

### Mapa de rotas e pastas (dono de cada uma)

| Rota                                                                                             | Pasta                          | Dono                                             | Quem abre                                     |
| :----------------------------------------------------------------------------------------------- | :----------------------------- | :----------------------------------------------- | :-------------------------------------------- |
| `/inicio`                                                                                        | `src/app/(app)/inicio`         | P18 e P27 (comercial); cada papel no módulo dele | todos menos enfermeira                        |
| `/pipeline`                                                                                      | `src/app/(app)/pipeline`       | P15                                              | comercial, diretoria                          |
| `/familias` e `/familias/[id]`                                                                   | `src/app/(app)/familias`       | P16                                              | comercial, coordenação, financeiro, diretoria |
| `/conversas`                                                                                     | `src/app/(app)/conversas`      | P27                                              | comercial, coordenação, diretoria             |
| `/transferencias`                                                                                | `src/app/(app)/transferencias` | P27                                              | comercial, coordenação, diretoria             |
| `/agente`                                                                                        | `src/app/(app)/agente`         | P27                                              | comercial, diretoria                          |
| `/tarefas`                                                                                       | `src/app/(app)/tarefas`        | P18                                              | comercial, coordenação, financeiro, diretoria |
| `/configuracoes`                                                                                 | `src/app/(app)/configuracoes`  | P13                                              | coordenação, diretoria                        |
| `/equipe`                                                                                        | `src/app/(app)/equipe`         | P37                                              | coordenação, diretoria                        |
| `/sessoes`                                                                                       | `src/app/(app)/sessoes`        | P07 (pronta)                                     | diretoria                                     |
| `/radar`                                                                                         | `src/app/(app)/radar`          | P36                                              | coordenação, diretoria                        |
| `/agenda`                                                                                        | `src/app/(app)/agenda`         | P37                                              | coordenação, diretoria                        |
| `/cobrancas`                                                                                     | `src/app/(app)/cobrancas`      | P32                                              | financeiro, diretoria                         |
| `/notas`                                                                                         | `src/app/(app)/notas`          | P43                                              | financeiro, diretoria                         |
| `/financeiro`                                                                                    | `src/app/(app)/financeiro`     | P46                                              | diretoria                                     |
| `/mais`                                                                                          | `src/app/(app)/mais`           | P10 (pronta)                                     | todos menos enfermeira                        |
| `/hoje`, `/minhas-familias`, `/perfil`                                                           | `src/app/(enfermeira)/...`     | P38                                              | enfermeira                                    |
| `/alertas`                                                                                       | `src/app/(enfermeira)/alertas` | P40                                              | enfermeira                                    |
| `/entrar`, `/mfa/*`, `/esqueci-senha`, `/definir-senha`, `/convidar`, `/auth/confirmar`, `/sair` | `src/app/(auth)/...`           | P07 (prontas)                                    | acesso; `/convidar` só diretoria              |

Regra para o módulo dono: trocar o `TelaEmConstrucao` da própria `page.tsx`, ler por `await obterRepositorios()` (`src/lib/dados`), gravar por Server Action na própria pasta, e acrescentar os métodos que faltarem no próprio domínio de `src/lib/dados` (interface e as duas implementações). Rota nova entra em `ROTAS` e em `NAVEGACAO`.

## Ficou de fora (e por quê)

- **Conteúdo das telas**: cada rota tem só o estado vazio; o conteúdo é do módulo dono (mapa acima).
- **Contadores das abas e da lateral** (alerta clínico, transferência vencendo): os componentes já aceitam `contador`, mas o número vem dos módulos P27 e P40.
- **Indicador de sincronização no cabeçalho da enfermeira** e o aviso de fila pendente ao sair: P12 e P38.
- **Componentes da seção 6 ainda sem código** (barra de ação fixa, esqueleto, abas de conteúdo da ficha, blocos, semana da equipe): continuam como pendência da P10 parcial; entram com o módulo que usar primeiro.

## Decisões tomadas nesta sessão

1. **Registro por papel, não por rota**: cada papel lista as próprias abas e grupos (o mesmo item pode estar em grupos diferentes para papéis diferentes, como Famílias em Comercial para o comercial e em Experiência para a coordenação, como no protótipo). Início entra no primeiro grupo do papel.
2. **Portal da enfermeira com caminhos próprios** (`/hoje`, `/minhas-familias`, `/alertas`, `/perfil`): `/familias` é a lista do CRM, e o portal lê só as famílias atribuídas por `api.familias_do_dia()`. Um prefixo comum também facilita o cache offline do P11 e do P12 [confirmar com o P38].
3. **Rotas das fases seguintes já existem** (radar, agenda, cobranças, notas, financeiro, alertas) para as abas do PRD 20.4 não levarem a erro 404; cada uma diz o que vai aparecer ali.
4. **"Mais" como página** (`/mais`), como `comercial.html` no protótipo: tudo o que a lateral do papel tem e não coube nas abas, nos mesmos grupos, com o sair no fim.
5. **Títulos de aba do navegador sem nome de família** (`Ficha da família · Kraamzorg OS`), conforme o DESIGN.md, microcopy 11.

## Mudanças no PRD

Nenhuma. Para confirmar e registrar no PRD 20.4: as abas do marketing (Início e Mais) e os caminhos do portal da enfermeira.

## Pendências novas ([confirmar], [clínico], terceiros)

- [confirmar: Leonardo] abas e Início do marketing.
- [confirmar: P38] caminhos do portal da enfermeira.

## Como testar

```bash
pnpm test src/lib/navegacao                     # navegação por papel
PW_PORT=3951 PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm e2e tests/e2e/navegacao-por-papel.spec.ts

# à mão, 390 e 1280 px
NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao pnpm build
NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao pnpm start -p 3950
# entrar como cada papel (código do MFA 123456) e conferir abas, lateral e "Mais"
```

Capturas de conferência (390 x 844 e 1280 x 800, uma rodada de correção: e-mail quebrando no meio no cartão da tela de sessões e a URL "/" depois do login, os dois corrigidos) em `/tmp/claude-0/-home-user-kraamzorg/bc859238-244a-5795-944c-406f72ec541c/scratchpad/crm-cap/`.

O que precisa de olho humano: a lateral da diretoria tem 15 itens e rola dentro dela em telas de 800 px de altura; conferir num computador real se a ordem dos grupos serve à rotina do Leonardo.

## Resultado dos invariantes

Os mesmos de `docs/sessoes/P07-app.md` (mesma sessão): `pnpm lint`, `pnpm typecheck`, `pnpm test` (304) e `pnpm build` verdes; `pnpm e2e` verde com 44 testes nos projetos celular e computador; axe sem violação séria ou crítica em todas as telas testadas; teste de cor solta verde. `supabase test db` não se aplica (nenhuma mudança em `supabase/`); `pnpm e2e:offline` segue o placeholder do P12.
