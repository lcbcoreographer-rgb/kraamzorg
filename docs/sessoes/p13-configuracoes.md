# P13 · Configurações

Data: 25/09/2026
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q`, sem commit desta sessão (a tarefa proíbe commit e push).

A fundação (P07/P10) já deixava `ConfiguracoesRepositorio` com leitura de parâmetro, mensagem, pacote vigente e região (`src/lib/dados/repositorios.ts`) e a rota `/configuracoes` registrada na navegação (`src/lib/navegacao/index.ts`, dono P13), com um estado vazio provisório. Esta sessão substituiu o estado vazio pela tela e acrescentou, dentro de `src/modules/configuracoes/**` e `src/app/(app)/configuracoes/**`, tudo que a fundação ainda não tinha: escrita de parâmetro com histórico, pacotes e versões com vigência, regiões e localidades, condições comerciais, mensagens com o fluxo de rascunho para aprovado, termos de alerta e faixas da régua.

Direção seguida: `docs/design/DESIGN.md` (Caderneta de visita: cartão branco raio 20, abas de conteúdo com sublinhado dourado, tabela que vira lista, folha/diálogo para edição, sem travessão em texto nenhum). P13 não tem grupo de telas no protótipo (`docs/prototipo/`) nem cita `fluxos.md` no PROMPTS.md — é o único prompt de fase 0 sem tela de referência — então os padrões vieram do DESIGN.md e dos componentes já existentes em `src/components/ui`, reaproveitados como estão. A skill interface-2026 e a Impeccable em modo Operate foram lidas; o launcher da Impeccable não rodou (proibido pela tarefa, e sem detector mecânico nesta máquina), então a checagem foi por leitura direta do DESIGN.md e dos componentes prontos, sem sorteio de direção nova (a direção já está fixada desde o P10).

## Feito

1. **Parâmetros** (`dados/parametro-tipo.ts`, `componentes/secao-parametros.tsx`, `formulario-parametro.tsx`, `acoes/parametros.ts`): a "validação por tipo" classifica o valor atual (inteiro, decimal, booleano, texto, lista de texto, objeto ou nulo) sem lista de chaves fixada no código — a forma vem do próprio `jsonb` — e recusa um novo valor que mude de forma (texto no lugar de número, string solta no lugar de um objeto). Histórico por `historicoParametro`, que no Supabase chama `api.log_auditoria('parametro', chave)` (função já existente na migration 0007; o gatilho genérico de auditoria já grava toda escrita em `parametro`, então não precisou de função nova) e na demonstração fica num histórico próprio do módulo.
2. **Pacotes e versões** (`secao-pacotes.tsx`, `formulario-nova-versao.tsx`, `acoes/pacotes.ts`): "Nova versão de preço" sempre cria uma linha nova; se havia uma versão vigente (`vigencia_fim` nula), ela é fechada no dia anterior ao início da nova antes do insert, nunca editada de outro jeito. A versão fechada continua com o mesmo id e os mesmos valores, então um contrato que a referenciasse (P31, ainda não construído) não muda. Ativar/desativar pacote.
3. **Regiões e localidades** (`secao-regioes.tsx`, `formulario-regiao.tsx`, `formulario-cidade.tsx`, `acoes/regioes.ts`): taxa de deslocamento, limite semanal, `requer_confirmacao` e a lista de aliases (um por linha).
4. **Condições comerciais** (`secao-condicoes.tsx`, `formulario-condicao.tsx`, `acoes/condicoes.ts`): a "tabela única de condições" do PRD 6.3 (desconto, parcelamento, bonificação), com `requer_aprovacao` e ativa/inativa.
5. **Mensagens** (`secao-mensagens.tsx`, `formulario-mensagem.tsx`, `dados/mensagem-preview.ts`, `acoes/mensagens.ts`): lista agrupada por destinatário; edição com contagem de caracteres, prévia com valores de exemplo (a variável vazia some com a vírgula vizinha e a frase reacerta a maiúscula, como o PRD 23 descreve para a produção) e troca automática de travessão e meia-risca por vírgula antes de salvar, com aviso de que a troca aconteceu. Rascunho para aprovado com o aprovador e a hora registrados (`aprovado_por`, `aprovado_em`); editar uma mensagem aprovada volta para rascunho, porque o texto mudou e precisa de nova aprovação. "Arquivar" para o status `arquivado` que a migration já previa.
6. **Termos de alerta** (`secao-termos-alerta.tsx`, `formulario-termo.tsx`, `acoes/termos-alerta.ts`): ativar, desativar, ação (transferir para a equipe de saúde ou bloqueio total) e a mensagem enviada. Único domínio que a coordenação também grava, além de ler (PRD 13 e a RLS da migration 0007, que já liberava escrita de `termo_alerta` para coordenação e diretoria).
7. **Faixas da régua** (`secao-regua.tsx`, `formulario-faixa.tsx`, `acoes/regua.ts`): objetivo, gatilho comercial e a mensagem ligada a cada uma das cinco faixas do PRD 10.3.
8. **Tela** (`src/app/(app)/configuracoes/page.tsx`): abas de conteúdo (`componentes/abas.tsx`, links `?aba=`, sem depender de JavaScript para trocar de seção) com sublinhado dourado na ativa. Diretoria vê as sete abas; coordenação só "Termos de alerta" — a lista de abas é filtrada na própria tela, além do proxy e do `exigirSessao` já impedirem qualquer outro papel de chegar na rota (nenhum outro papel tem `/configuracoes` na própria navegação).
9. **Camada de dados do módulo** (`src/modules/configuracoes/dados/`): interface `ConfiguracoesModuloRepositorio`, própria do módulo (a `ConfiguracoesRepositorio` da fundação não tinha os métodos de escrita), com as duas implementações de sempre (`demonstracao.ts`, `supabase.ts`) escolhidas pela mesma fábrica (`modoDados()` e `obterSessao()`, sem duplicar a lógica de decisão). Parâmetro e mensagem gravam na loja em memória da fundação (`@/lib/dados/demonstracao/loja`, importada e não editada) para as outras telas que já leem por `ConfiguracoesRepositorio` continuarem vendo o mesmo dado; pacote, versão, região, cidade, condição comercial, termo de alerta e faixa da régua gravam numa loja própria do módulo (`dados/loja.ts`), porque a loja da fundação não tinha lugar mutável para esses domínios ainda (pendência abaixo).
10. **Testes Vitest** (29 nos 3 arquivos novos): classificação e validação por tipo de parâmetro, prévia de mensagem (variável vazia, substituição), e o repositório de demonstração caso a caso — diretoria só, coordenação só em termos de alerta, criação de versão fechando a anterior sem apagá-la, aprovação de mensagem registrando quem aprovou, edição de mensagem aprovada voltando a rascunho.
11. **Playwright** (`tests/e2e/p13-configuracoes/`, 12 specs): acesso por papel (diretoria vê tudo, coordenação só termos de alerta, comercial nem abre a rota) com axe; edição de parâmetro com histórico e recusa de tipo errado; nova versão de preço com a anterior continuando visível e consultável; ativar/desativar pacote; mensagem com prévia, aprovação com o nome registrado e travessão virando vírgula; termo de alerta pela coordenação e pela diretoria; edição de faixa da régua. Os testes que escrevem usam um registro por projeto (`porProjeto`, `tests/e2e/p13-configuracoes/apoio.ts`), porque o celular e o computador rodam contra o mesmo servidor de demonstração, possivelmente em paralelo, e cada um mexendo no mesmo parâmetro ou pacote quebraria o outro.
12. `docs/sessoes/p13-configuracoes.md` (este arquivo).

## Ficou de fora (e por quê)

- **Rodar os testes Playwright**: a tarefa proíbe `pnpm e2e` nesta sessão ("a integração roda no fim"). Os specs foram revisados por leitura contra os componentes e as ações reais (seletores, `aria-label`, texto exato de botão e rótulo), mas não foram executados.
- **Criar um pacote novo pela tela**: o repositório já tem `criarPacote`, mas a tela só oferece "Nova versão de preço" para um pacote existente. Os cinco pacotes do PRD (Essencial, Imersão, Continuado, Gemelar Essencial, Gemelar Continuado) já existem no seed; criar um pacote do zero é ação rara, deixada para quando fizer falta.
- **Selecionar a mensagem de um termo de alerta por lista**: o campo é texto livre (`alerta_saude`, `alerta_internacao`), não uma seleção. A coordenação também gerencia termos, e a leitura de mensagens deste módulo é só da diretoria (ver decisão 3); texto livre evita depender de outra permissão.
- **RPC no schema `api` para as escritas de configuração**: a migration 0007 já libera `insert`/`update` direto nas tabelas de configuração por RLS (`grant` explícito por papel, sem função intermediária) para `regiao`, `cidade`, `parametro`, `pacote`, `pacote_versao`, `condicao_comercial`, `mensagem_modelo`, `regua_faixa` e `termo_alerta` — é o mesmo padrão que o arquivo já existente `src/lib/dados/supabase/configuracoes.ts` usava para leitura. Escrita direta nessas tabelas segue esse precedente; RPC continua reservado para dado sensível e regra de máquina de estado (freio, transição), como o CLAUDE.md pede.

## Decisões tomadas nesta sessão

1. **Dentro da tela de Configurações, coordenação só enxerga termos de alerta**, mesmo em domínios cuja RLS real permite leitura mais ampla para ela (`pacote`, `pacote_versao`, `condicao_comercial`, `regiao`, `cidade`, `regua_faixa` liberam `select` para coordenação também, porque outras telas — pipeline, ficha — precisam mostrar nome de pacote ou de região). A matriz do PRD 13 ("Parâmetros e configurações: coordenação — termos de alerta e instrumentos") é mais estreita que "ter acesso à rota"; o repositório do módulo aplica essa regra mais estrita (`ehDiretoria`/`ehCoordenacaoOuDiretoria`) só para esta tela, sem mexer na RLS nem nas outras telas.
2. **Preço novo sempre cria versão; a versão fechada nunca é editada de novo.** Sem função no banco para isso (nenhuma migration cobre), a operação é sequencial (fecha a antiga, insere a nova) e não atômica: se o insert falhar depois do fechamento, fica um intervalo sem versão vigente até uma nova tentativa. Fica registrado como pendência de uma função `api` própria (abaixo).
3. **Mensagem editada depois de aprovada volta para rascunho** e perde o aprovador: o texto mudou, o "aprovado" antigo não vale para o texto novo.
4. **Formulário de campo de seleção próprio do módulo** (`componentes/campo-selecao.tsx`): o projeto ainda não tem um em `src/components/ui` (o mesmo caminho que o P15 seguiu em `src/modules/crm/pipeline/componentes/campo-selecao.tsx`, lido só como referência, sem importar).
5. **Tipo do parâmetro vem da forma do valor atual**, não de uma lista de chaves no código (isso seria "limite... no código", CLAUDE.md). Cobre os 30 parâmetros do seed sem exceção.

## Mudanças no PRD

Nenhuma. Nada nesta sessão contradisse o PRD.

## Pendências novas ([confirmar], terceiros)

- **Função `api` para criar versão de preço em uma transação só**: hoje a troca é dois comandos sequenciais (fechar a vigente, inserir a nova). Uma função `security definer` que faça os dois num só `begin/commit` evitaria o intervalo sem versão vigente se o segundo comando falhar. Migration de uma sessão de banco, fora do alcance desta (a tarefa proíbe mexer em `supabase/`).
- **Loja de demonstração da fundação sem lugar mutável para pacote, versão, região, cidade, condição comercial, termo de alerta e faixa da régua**: a `ConfiguracoesRepositorio` da fundação lê `pacote`/`pacote_versao`/`regiao` de listas estáticas (`PACOTES`, `VERSOES_PACOTE`, `REGIOES` em `src/lib/dados/demonstracao/fixtures.ts`), não da `LojaDemonstracao`. Este módulo criou a própria loja mutável (`src/modules/configuracoes/dados/loja.ts`) para poder escrever nesses domínios, mas isso significa que uma alteração feita em Configurações (nova versão de preço, região desativada) não aparece para outro módulo que leia pelo caminho da fundação (`obterRepositorios().configuracoes.listarPacotesVigentes`), só no modo demonstração — no Supabase real não há esse problema, porque as duas implementações leem a mesma tabela. Quando P15, P16, P31 ou outro módulo precisarem ver preço, versão ou região atualizados em demonstração, a correção é mover `pacotes`, `versoes`, `regioes` e `cidades` para dentro de `LojaDemonstracao` (a mesma loja que já guarda `parametros` e `mensagensModelo`) e trocar as duas implementações para lerem de lá. Fica fora do alcance desta sessão porque `src/lib/dados/demonstracao/` não é pasta do P13.
- **Contrato ligado a `pacote_versao`**: o aceite do P13 ("o contrato antigo continua na versão anterior") foi demonstrado sem um `contrato` de verdade, porque o P31 (contrato) ainda não foi construído. O comportamento que importa (a versão fechada mantém id e valores, nunca é editada de novo) está coberto por teste; quando o P31 existir, vale conferir que `contrato.pacote_versao_id` aponta para a versão certa depois de uma reversão de preço.
- **[confirmar: Leonardo]** Lista real dos termos de alerta (PRD 13, onboarding 9.6): o seed desta sessão usa termos fictícios ("sangramento", "febre alta", "internação") só para a tela funcionar; a lista de verdade é da Edilaine e entra pela própria tela, nunca pelo código.

## Como testar

```bash
# Nas pastas do módulo
pnpm eslint "src/modules/configuracoes" "src/app/(app)/configuracoes"
pnpm vitest run src/modules/configuracoes
NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao pnpm dev
# depois, no navegador: entrar como "Diretoria" ou "Coordenacao" e abrir /configuracoes
```

Roteiro manual (modo demonstração, `KZ_DADOS=demonstracao`):

1. Entrar como diretoria → `/configuracoes` → aba Parâmetros → editar `agente_debounce_segundos` para outro número inteiro → salvar → reabrir e ver o histórico com o valor antigo e o novo.
2. Digitar texto no lugar de um número → a tela recusa e explica o que fazer, nada é gravado.
3. Aba Pacotes e preços → "Nova versão de preço" no Essencial → preço novo → salvar → o preço da tela muda e a versão anterior aparece em "versão(ões) anterior(es)" com o valor de antes.
4. Aba Mensagens → editar uma mensagem rascunho → ver a prévia com o nome de exemplo e sem a variável vazia sobrando vírgula → salvar → "Aprovar" na lista → o status muda para Aprovado com o nome de quem aprovou.
5. Sair e entrar como coordenação → `/configuracoes` só mostra a aba Termos de alerta, nenhum preço aparece em texto nenhum da tela → criar um termo novo → desativar.

## Resultado dos invariantes

Esta sessão não roda os quatro invariantes do CLAUDE.md inteiros (a tarefa reserva `pnpm build`, `pnpm e2e` e a integração para o fim, feita por outro agente). O que rodou, escopado às minhas pastas:

- `pnpm eslint "src/modules/configuracoes" "src/app/(app)/configuracoes"`: **0 erros, 0 avisos.**
- `pnpm tsc --noEmit` (repositório inteiro, porque `typecheck` não tem como escopar por pasta): **0 erros em todo o projeto**, incluindo fora das minhas pastas — o trabalho em andamento de outro agente não deixou nada vermelho no momento em que rodei.
- `NEXT_PUBLIC_APP_ENV=desenvolvimento pnpm vitest run src/modules/configuracoes`: **29 testes, 3 arquivos, todos verdes.**
- `npx prettier --check` nas minhas pastas: **sem pendência** (formatado com `prettier --write` antes de terminar).
- `gitleaks detect --no-banner --source src/modules/configuracoes` e `--source "src/app/(app)/configuracoes"`: **nenhum vazamento.**
- `pnpm e2e` (`tests/e2e/p13-configuracoes/`): não rodado nesta sessão (proibido pela tarefa); specs revisados por leitura contra os componentes e as ações.
