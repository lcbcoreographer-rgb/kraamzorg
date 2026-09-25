# Integração do CRM (P13, P15 a P18, P27)

Sessão de integração dos cinco módulos da onda do CRM, depois da verificação de
cada um: Configurações (P13), Pipeline e deduplicação (P15 e P17), Ficha 360
(P16), Tarefas e notificações (P18) e Agente, conversas e transferências (P27).
Cada verificação corrigiu o que cabia na pasta do próprio módulo e deixou uma
lista do que dependia de código compartilhado. Esta sessão aplicou essa lista,
regenerou os tipos do banco, deixou os comandos verdes e fez a conferência de
segurança do app inteiro.

Nada foi alterado em `PRD.md`, `CLAUDE.md`, `PROMPTS.md`, `docs/design`,
`docs/prototipo`, `supabase/` nem `n8n/`. Nenhum commit foi feito.

## O que foi integrado

### Fundação e componentes compartilhados

1. **Arquivos "use server" que exportavam objeto.** `src/modules/crm/pipeline/acoes.ts`
   e `src/modules/crm/deduplicacao/acoes.ts` ainda exportavam o estado inicial do
   `useActionState`. O Next recusa o módulo inteiro nesse caso e todos os botões
   da tela dão erro 500, sem o typecheck, o lint nem o Vitest perceberem. O
   estado foi para `estado-acoes.ts` em cada pasta, como a ficha, as tarefas e o
   agente já fazem. O teste novo `tests/integracao/use-server.test.ts` varre
   todo arquivo "use server" de `src/` e falha se algum exportar outra coisa
   que não função assíncrona, tipo ou interface.
2. **Botão "Freio ativo" com 44 px.** Em `src/components/ui/cabecalho-familia.tsx`,
   o selo vira botão quando abre a folha de reversão; ele tinha 28 px de altura.
   Agora usa `min-h-toque`. O selo só informativo continua com 28 px.
3. **`CampoTexto` aceita `min`, `max` e `step`.** A data de nascimento e a data
   de alta da ficha usam `max` (hoje): o seletor nativo não oferece dia depois de
   hoje. O formulário ficou com `noValidate`, então quem digita uma data
   impossível recebe a explicação do servidor, e não o balão genérico do
   navegador.
4. **Diálogo no computador rola.** `src/components/ui/dialogo.tsx` tinha
   `lg:max-h-none`: num formulário alto (cadastro de lead, nova versão de preço,
   perda, mesclagem) o botão de enviar ficava fora da tela em 1280 x 720, sem
   como chegar nele. Agora o limite é a altura da janela menos 4 rem, com
   rolagem interna.
5. **MFA por vontade própria.** `src/lib/auth/acesso.ts` mandava para o início
   qualquer pessoa sem MFA obrigatório que abrisse `/mfa/cadastro`. O comercial,
   que precisa de AAL2 para ver os dados completos do contrato (PRD 13), não
   tinha como ativar. Agora comercial e marketing sem fator cadastrado abrem o
   cadastro; o desafio continua fechado para eles. Teste novo em
   `acesso.test.ts`.
6. **Repositório de demonstração alinhado ao banco** (`src/lib/dados/demonstracao`):
   - `acionarFreio` devolve `desfazer_ate`, como `privado.acionar_freio` (0009).
     A ficha deixou de ler a loja de demonstração por conta própria para achar o
     prazo do "Desfazer": o módulo não sabe mais qual implementação está usando.
   - `reverterFreio` exige AAL2 e só desce o freio, como `privado.reverter_freio`.
   - A tarefa de justificativa do freio nasce com `payload.acao = "justificar_freio"`.
   - `listarTarefas` devolve o `payload` de verdade (antes era sempre `{}`), e o
     seed ganhou uma tarefa de follow-up com mensagem (Família Teste Dália). O
     texto sugerido é montado a partir de `mensagem_modelo` (`followup_d3`), com
     o primeiro nome do contato principal, e o telefone vem da pessoa. Nenhuma
     frase para a família ficou no código.
   - `listarFamilias` busca por nome ou por telefone (a partir de 4 dígitos, em
     qualquer formato), na demonstração e no Supabase. No Supabase, a busca só
     por dígitos procura em `pessoa.telefone_e164`, que tem a mesma RLS da família.
   - `FiltroConversas` ganhou `familiaId`. A aba Conversas da ficha pede só a
     conversa da família, em vez de listar 500 e procurar por cima.
7. **Configurações.** O valor em JSON dos parâmetros não tinha onde quebrar e
   empurrava a página 146 px para o lado no celular e 221 px no computador
   (`wrap-anywhere` em `secao-parametros.tsx`). O selo "gemelar" saiu de dentro
   do título do pacote: ele colava no nome e o nome acessível do cartão virava
   "Gemelar Essencialgemelar".
8. **`.env.example`** ganhou `RESEND_FROM_EMAIL`, `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`
   e `N8N_WEBHOOK_REINDEXAR_URL`, que o código já lia.
9. **`.prettierignore`** passou a ignorar `n8n/`, `supabase/` e `docs/adr/`,
   pastas das trilhas de banco e n8n escritas em paralelo (o n8n tem estilo
   próprio, com aspas simples). Sem isso, `pnpm format:check` nunca ficava verde
   sem reformatar o trabalho de outra trilha.

### Rota de captura da UAZAPI

`src/app/api/teste/uazapi` ficava aberta a qualquer pessoa em homologação,
inclusive o painel que lista as mensagens capturadas. Agora:

- a captura recusa também quando `VERCEL_ENV=production`, mesmo com
  `NEXT_PUBLIC_APP_ENV=homologacao` configurado errado;
- o painel (`GET` e `DELETE` na raiz) e o registro de transcrições exigem o
  segredo das rotas internas (`INTERNAL_ROUTES_SECRET` no cabeçalho
  `x-kz-interno-secret`, comparado em tempo constante como em
  `/api/interno/notificar`);
- os três caminhos que imitam a UAZAPI (`send/text`, `send/media`,
  `message/download`) continuam sem credencial, porque o n8n de homologação
  manda sem token de propósito (`n8n/src/lib/uazapi.mjs`). O roteiro do P28
  precisa mandar o cabeçalho quando for ler ou limpar a captura.

### Testes de ponta a ponta

As verificações dos módulos não rodaram o `pnpm e2e` junto. Rodando pela
primeira vez, 30 de 144 falharam. As causas:

- **Os dois projetos gravavam na mesma loja em memória.** Com um servidor só, o
  celular concluía a tarefa, resolvia a transferência ou aprovava a mensagem que
  o computador ainda ia ler. `playwright.config.ts` agora sobe um servidor por
  projeto (`PW_PORT` para o celular e `PW_PORT + 1` para o computador); o
  primeiro faz o build e o segundo só inicia outro processo.
- **Seletores ambíguos.** O botão de fechar do diálogo se chama "Fechar sem
  salvar" e casava com "Salvar"; "Termo" casava com "Termo ativo"; "Essencial"
  com "Gemelar Essencial"; `contains(@class,'p-5')` casava com `gap-5`; a lista
  do celular e o quadro do computador coexistem no DOM. Os specs passaram a usar
  nome exato, classe como palavra inteira e `filter({ visible: true })`.
- **Entrar como coordenação.** O botão do seletor diz "Coordenação", com acento;
  quatro specs usavam "Coordenacao". `entrarComo` agora limpa os cookies antes,
  para trocar de pessoa na mesma página.
- **Transferências** roda em série dentro do projeto: a lista confere a faixa
  vermelha antes de o "Reenviar aviso" tirá-la.
- **Tarefas**: teste novo confere que a tarefa com mensagem abre
  `wa.me/5511900000305` com o texto do modelo.
- **Deduplicação** passou a criar a duplicata com o telefone da Família Teste
  Bruma, e não da Aurora: a mesclagem leva a oportunidade da família nova para
  a que fica, e a busca da Aurora, que o spec do pipeline move de estágio no
  mesmo servidor, passava a achar dois cartões.
- **Diálogos no computador**: o limite de altura do item 4 acima veio daqui;
  cinco specs travavam com "element is outside of the viewport".

### O que foi conferido e ficou como estava

- **Pipeline para coordenação e financeiro.** A verificação do P15 perguntou se
  `src/lib/navegacao` devia abrir `/pipeline` para os dois. A matriz do PRD 13
  diz "Lead e origem: sem acesso" para os dois, e o PRD 20.4 não põe Pipeline
  nas abas deles. Ficou como está: a coordenação lê a ficha comercial pela
  ficha 360, e o financeiro, as famílias com contrato.
- **Nome do responsável da oportunidade.** Nenhuma tela mostra hoje; traduzir
  `responsavelId` em nome fica para quando uma tela precisar (exige leitura de
  `usuario` com RLS).

## Conferência de segurança

| Item              | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service_role`    | Só em `src/lib/db/cliente-servico.ts` (`import "server-only"`), usado só por `src/lib/dados/supabase/usuarios.ts` nos dois motivos declarados (convite e sessões da diretoria). `cliente-servico.test.ts` falha se outro arquivo importar. Nenhuma variável secreta tem prefixo `NEXT_PUBLIC_`.                                                                                                                                     |
| Rotas de API      | O proxy não passa por `/api`, então cada rota se protege. `/api/interno/notificar`: segredo em tempo constante. `/api/agente/reindexar`: sessão, papel e AAL2 (401 e 403), sem devolver a URL do webhook. `/api/teste/uazapi`: só em homologação e nunca em produção da Vercel; painel com segredo (acima).                                                                                                                         |
| Dado assistencial | Nenhuma tela lê tabela assistencial nem `pessoa_dados_contrato` direto. As únicas funções de leitura sensível chamadas são `api.dados_contrato` (AAL2 e log no banco) e `api.log_auditoria`. `api.ficha_assistencial` e `api.familias_do_dia` existem nos tipos e nenhuma tela chama ainda.                                                                                                                                         |
| RPC               | Toda chamada vai por `cliente.schema("api")`: as tipadas e as pendentes (`rpcPendente`). Nenhuma chama `privado` nem `assistencial`.                                                                                                                                                                                                                                                                                                |
| Modo demonstração | `garantirDemonstracaoPermitida` exige `KZ_DADOS=demonstracao`, `NEXT_PUBLIC_APP_ENV=desenvolvimento` e `VERCEL_ENV` diferente de `production`, e lança erro em qualquer outro caso. As três lojas em memória (`src/lib/dados/demonstracao/loja.ts`, `src/modules/configuracoes/dados/loja.ts`, `src/modules/agente/loja-extra.ts`) chamam a trava antes de devolver dado. `fabrica.test.ts` cobre a recusa fora de desenvolvimento. |
| Segredos          | `gitleaks detect --no-git`: nenhum vazamento.                                                                                                                                                                                                                                                                                                                                                                                       |

Ponto de atenção, sem risco hoje: alguns repositórios de módulo
(`src/modules/agente/repositorio.ts`, `conversa-detalhe/dados.ts`) importam a
loja de demonstração no topo do arquivo, então as fixtures fictícias entram no
bundle de servidor de produção. Não abrem nada (a loja lança erro fora de
desenvolvimento), mas o import dinâmico, como a ficha e o pipeline fazem,
deixaria o bundle mais limpo.

## Tipos do banco

`PGPORT=54352 pnpm db:types:local`, com o banco de `supabase/sem-docker` em
`PGDATA=/tmp/kz-pg-crm-i` recriado a partir de todas as migrations presentes
(0001 a 0007 e 0009 a 0011; 0008 é o seed). As migrations 0012 a 0014 ainda
não estavam na pasta: o arquivo gerado saiu igual ao anterior (51 tabelas e
views, 16 funções, 49 enums) e nada quebrou. Quando elas chegarem, rode de novo
e troque cada `rpcPendente` pela chamada tipada.

## O que depende do Supabase ligado

Tudo abaixo passa na demonstração e só pode ser provado com Supabase Auth,
PostgREST e as migrations aplicadas:

1. **Login real e MFA real.** Senha, convite por e-mail, TOTP, AAL1 e AAL2 no
   JWT, sessão de 8 horas, revogação de sessões pela diretoria.
2. **RLS ponta a ponta.** Cada papel vendo só o que a matriz do PRD 13 permite,
   pelo cliente de servidor com a chave anônima.
3. **Funções `api.*` que ainda não existem** (0012 a 0014, outra trilha). Até
   lá, a tela mostra "o banco ainda não tem essa função" e não grava nada:
   - pipeline: `buscar_duplicatas_pipeline`, `mesclar_familias`, `vincular_nova_gestacao`;
   - tarefas: `pode_enviar_mensagem(familia_id, categoria, canal)` e
     `registrar_envio_tarefa(tarefa_id, texto)` numa transação só;
   - agente: `pausar_conversa`, `retomar_pausa_conversa`, `retomar_agente`,
     `resolver_transferencia`, `reenviar_notificacao_handoff`,
     `base_conhecimento_listar`, `base_conhecimento_salvar`,
     `base_conhecimento_aprovar`, `ultima_ingestao_base`, `metricas_agente` e
     uma para gravar a mensagem enviada pelo app;
   - diretoria: `revogar_sessoes`;
   - ficha: uma função com log para coordenação e diretoria lerem os eventos
     restritos (hoje a política só deixa ler `not restrito`, então o evento do
     freio só aparece na demonstração), uma para gravar "não contatar" e as
     datas junto com o evento, e `privado.eliminar_titular`.
4. **Parâmetros que só a diretoria lê.** `comercial_resposta_no_app`,
   `agente_pausa_humano_horas` e `freio_desfazer_segundos` são usados por telas
   do comercial, e a RLS de `parametro` só libera a diretoria. O "Desfazer" já
   foi resolvido pelo `desfazer_ate` do banco; os outros dois precisam de função
   `api` ou exceção na política.
5. **Assumir e pausar não é atômico** até existir uma função única que assuma a
   transferência e pause a Isadora.

## Decisões que continuam com o Leonardo e a Edilaine

- Coordenação editando mensagem para médico (a RLS permite; a tela de
  Configurações só mostra Termos de alerta para ela).
- Quem vê `historico_sensivel` na ficha (PRD 13 diz coordenação e diretoria, com
  `[confirmar]`).
- Desfechos de "resolver" em transferência de saúde ou perda; comercial e
  coordenação cadastrando na base de conhecimento (PRD 13 diz leitura); metas do
  11.12 em `parametro`; canal do "Enviar pelo app" (T-01).
- Quando o freio sobe entre o envio pelo WhatsApp e o "Enviei": registrar a
  mensagem mesmo assim ou não.

## Roteiro para quando o Supabase ligar

1. `supabase start`, `supabase db reset` e `supabase test db` (as três provas
   finais do CLAUDE.md). Depois `pnpm db:types` e `pnpm typecheck`; troque as
   chamadas `rpcPendente` que já tiverem função pela versão tipada.
2. Preencha `.env.local` a partir do `.env.example`, com `KZ_DADOS` vazio e
   `NEXT_PUBLIC_APP_ENV=desenvolvimento`. Confirme que `/entrar` mostra e-mail e
   senha, não o seletor.
3. Crie pela tela `/convidar` (como diretoria) uma pessoa de cada papel com os
   e-mails do seed. Para cada uma:
   - entrar com senha; comercial e marketing entram em AAL1, os outros vão para
     o cadastro do MFA;
   - cadastrar o TOTP, sair, entrar de novo e passar pelo desafio;
   - abrir cada item da navegação do papel e uma rota de fora dela (tem que
     voltar ao início).
4. **RLS por papel**, com a pessoa certa logada:
   - comercial: pipeline 1 e 2, ficha com dados de contrato mascarados; "Mostrar"
     pede MFA; depois de cadastrar o MFA por `/mfa/cadastro`, mostra e grava a
     leitura em `log_auditoria`;
   - financeiro: `/familias` só com as famílias com contrato; aba Comercial sem
     os controles de escrita;
   - coordenação: ficha sem dados de contrato; `/configuracoes` só com Termos de
     alerta; `/pipeline` volta para o início;
   - diretoria: tudo, e a tela de sessões com último acesso.
5. **Freio**: comercial aciona na ficha, vê o "Desfazer" pelo tempo de
   `freio_desfazer_segundos`, desfaz; aciona de novo sem motivo e a faixa
   "Justificar o freio" aparece; coordenação em AAL2 reverte com justificativa;
   em AAL1 o banco recusa. Conferir em `log_auditoria` o motivo como "[oculto]".
6. **Tarefas**: uma tarefa de régua gravada pelo P20 aparece com o link do
   WhatsApp e o texto de `mensagem_modelo`; "Enviei" grava a mensagem mascarada
   e conclui a tarefa (quando `registrar_envio_tarefa` existir); família em
   bloqueio total mostra "Mensagem pausada para esta família".
7. **Agente**: assumir transferência pausa a Isadora pelas horas do parâmetro;
   resolver não reativa conversa em `humano_comercial`; "Devolver à Isadora"
   grava no log.
8. **Rotas de API**: `/api/interno/notificar` sem o segredo devolve 401;
   `/api/agente/reindexar` sem sessão devolve 401 e com enfermeira devolve 403;
   `/api/teste/uazapi` fora de homologação devolve 403 e o `GET` sem segredo
   devolve 401.
9. Rodar `pnpm e2e` contra o Supabase exige um roteiro de login com senha e
   TOTP; os specs de hoje usam o seletor da demonstração (`tests/e2e/apoio/entrar.ts`).

## Comandos

```bash
cd supabase/sem-docker
PGDATA=/tmp/kz-pg-crm-i PGPORT=54352 scripts/iniciar.sh
PGDATA=/tmp/kz-pg-crm-i PGPORT=54352 scripts/resetar.sh
cd ../..
PGPORT=54352 pnpm db:types:local
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
PW_PORT=3352 PW_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium pnpm e2e
gitleaks detect --no-git --no-banner
```

## Resultado nesta máquina

Veredito: **integrado e verde**, com as pendências de banco listadas acima.

| Comando                                                              | Resultado                                                                                                                                                     |
| :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PGPORT=54352 pnpm db:types:local`                                   | 51 tabelas e views, 16 funções, 49 enums; `types.ts` sem diferença (0012 a 0014 ainda não estão na pasta)                                                     |
| `pnpm lint`                                                          | 0 erros; 1 aviso em `n8n/referencia/comparar.mjs` (outra trilha, fora do alcance)                                                                             |
| `pnpm format:check`                                                  | Todos os arquivos no estilo do Prettier                                                                                                                       |
| `pnpm typecheck`                                                     | Sem erro                                                                                                                                                      |
| `pnpm test`                                                          | 74 arquivos, 937 testes, todos verdes (eram 73 e 910)                                                                                                         |
| `pnpm build`                                                         | Compilou; 41 rotas                                                                                                                                            |
| `pnpm e2e` (celular 390 px e computador, modo demonstração, com axe) | 143 passaram, 1 pulado de propósito (um teste de `p27-agente/conversas.spec.ts` roda só no computador e é pulado no celular); na primeira rodada, 30 falhavam |
| `gitleaks detect --no-git --no-banner`                               | Nenhum vazamento                                                                                                                                              |

## Crítica do CRM contra o protótipo: correções aplicadas em lote (P0 a P3)

Sessão seguinte, a partir da crítica do CRM contra o protótipo aprovado e o
DESIGN.md (Nielsen 24/40, rubrica da interface-2026 15/21). Aplicou as 26
correções listadas, priorizadas P0 a P3, todas no mesmo lote. Nada foi
alterado em `PRD.md`, `CLAUDE.md`, `PROMPTS.md`, `docs/design`,
`docs/prototipo`, `supabase/` nem `n8n/`; nenhum commit foi feito.

### Aplicado

**P0, todos os cinco:**

1. **Início do comercial.** `src/app/(app)/inicio/page.tsx` compõe agora
   `FilaTransferencias` e as tarefas que vencem hoje (`listarTarefasTela`,
   filtradas para `vencida`/`vence_hoje`), com a frase-resumo do dia
   (`formatarDiaSemanaEData`, novo em `src/lib/formatacao/data.ts`). No
   computador, duas colunas 62/38. A aba Início ganha contador em alerta
   só para o comercial (`contarTransferenciasCriticas`, novo em
   `transferencias/dados.ts`), plumado por `casca-app.tsx` e
   `navegacao-app.tsx` até `AbasInferiores` e `BarraLateral`, que já
   aceitavam contador.
2. **Perda gestacional nunca vermelha.** `cartao-transferencia.tsx` e
   `cartao-conversa.tsx` separam `perda` e `estado_sensivel_escreveu`
   (ameixa, `MOTIVOS_SENSIVEIS` em `agente/tipos.ts`) de `saude` (que
   continua em alerta). `cartao-oportunidade.tsx` (pipeline) também não
   usa mais `alerta` para esses casos, e o cartão do pipeline com freio
   saiu do `areia` (item 9).
3. **Conversas sabe do freio.** `ConversaComPausa` ganhou `estadoSensivel`
   (`agente/tipos.ts`, `formatacao.ts`); `conversas/dados.ts` busca o
   estado das famílias das conversas (`FiltroFamilias.ids`, novo, aceito
   pelos dois repositórios) e fecha a prévia de qualquer família em freio,
   não só de handoff sensível. Com `bloqueio_total`, `cartao-conversa.tsx`
   troca o cartão inteiro por um com selo "Freio: Isadora desligada",
   "Só contato humano e nominal. A prévia fica fechada nesta lista." e a
   ação única "Abrir com cuidado".
4. **Comercial não assume o que não é dele.** `cartao-transferencia.tsx`
   recebe `destinoDoPapel` (mapa `DESTINO_DO_PAPEL` em `agente/tipos.ts`)
   e `telefonePlantao` (`obterTelefonePlantao`, lê
   `parametro.plantao_telefones`); quando o destino não é do papel de
   quem vê, mostra "Ligar para a coordenação" (link `tel:`, só quando o
   telefone está disponível: a RLS de `parametro` só deixa a diretoria
   ler, dentro ou fora da demonstração) e "Ver conversa". Sem o telefone,
   fica só "Ver conversa" (o destino já aparece na linha de cima; um selo
   repetindo o mesmo texto não ajudava).
5. **Hidratação da ficha com freio.** `faixa-alerta.tsx` trocou o `<p>`
   que envolvia `children` por `<div>` (um `<form>` dentro de `<p>` é
   inválido). `faixa-justificar-freio.tsx` também parou de passar o
   formulário como `children`: ele vai na prop `acoes`, e a faixa começa
   fechada, com o prazo ("Escreva o motivo até..., a partir de
   `temJustificativaPendente`, que agora devolve `{ pendente, venceEm }`)
   e o botão "Escrever justificativa" (cobre o item 13 também).

**P1, sete dos oito primeiros itens de tela (7 e 8 não):**

6. **Idade gestacional depois do nascimento.** `textoIdadeGestacional`
   (`pipeline/idade-gestacional.ts`) recebe `dataNascimento`: com
   nascimento, "Nasceu em 16/08"; sem nascimento e mais de 42 semanas,
   "DPP passou há N dias". Os três lugares que chamavam a função
   (`ficha/dados.ts`, `pipeline/dados.ts`) passam a data.
9. **Cartão do pipeline com freio.** `bg-sensivel-lavado`, não `areia`
   (a mesma cor da família e da Isadora). A linha de próximo passo com
   prazo e o limite "Ver as N famílias" por estágio **não** entraram
   neste lote (ver "Não aplicado").
10. **Um primário por tela.** "Assumir conversa" (nos dois lugares do
    cartão de conversa) e "Reenviar aviso" (dentro da faixa) viraram
    `secundario`. No painel da conversa, "Marcar como resolvida" ganhou
    `self-start`: sem isso, esticava para a largura toda porque é filho
    direto de um contêiner `flex-col` (align-items: stretch), enquanto
    "Assumir conversa" (dentro do próprio `<form>`) não esticava.
11. **Tarefa "Justificar o freio".** `cartao-tarefa.tsx` detecta
    `payload.acao === "justificar_freio"` (`ehJustificarFreio`, novo em
    `tarefas/tipos.ts`) e mostra a faixa sensível com "Escrever
    justificativa" (leva à ficha), em vez do "Concluir" liso das demais
    tarefas internas.
12. **Ficha 360.** `familias/[id]/page.tsx` trocou o `CabecalhoTela`
    (segundo h1) pelo link de volta ("Pipeline" para comercial/diretoria,
    "Famílias" para os demais). `cabecalho-familia.tsx`: com o freio
    puxado, a linha de meta (estágio, IG, cidade) continua visível, numa
    linha própria acima da frase de bloqueio; "ainda não" virou pílula
    tracejada em Inter (não mais em mono) com a legenda "vira fato quando
    acontecer". A linha do tempo com os próximos passos tracejados
    **não** entrou (ver "Não aplicado").
17. **Selo de freio na lista de Famílias.** `familias/page.tsx`: o cartão
    virou coluna única, com o selo (agora com `octagon-pause`) abaixo do
    bairro/cidade, não mais ao lado do nome.
18. **Parcial: título do cartão de tarefa.** Trocado de `font-titulo`
    (Jost) para Inter 600 (`text-3 font-semibold`, igual aos outros
    cartões), e a linha repetida com o nome da família saiu (o título já
    traz o nome). As abas do pipeline e da ficha **não** foram unificadas
    num componente só (ver "Não aplicado").
19. **Hierarquia de títulos.** `fila-transferencias.tsx` ganhou um `h2`
    fora de tela ("Fila de transferências") entre o h1 da tela e o h3 de
    cada cartão. `lista-duplicatas.tsx` passou `nivelTitulo="h2"` para o
    estado vazio de Duplicatas (a prop já existia em `estado-vazio.tsx`;
    só não estava sendo usada ali).

**P2, dois dos cinco (13 e 15; 16 e 20 não):**

13. Coberto junto do item 5 (faixa fechada por padrão, com prazo).
14. **Aviso efêmero.** `aviso-efemero.tsx`: "Desfazer" ganhou contagem
    regressiva em segundos (medida com `useState`, não `useRef`, porque
    o projeto não deixa ler nem escrever ref durante a renderização); o
    raio vira `raio-3` (em vez de pílula) quando o texto mede três linhas
    ou mais (medido com `useLayoutEffect` depois de montado).
15. **Variante `erro` na faixa.** Nova variante em `faixa-alerta.tsx`
    (ícone `circle-alert`, mesma cor de `imediato`, que fica reservado ao
    alerta clínico de verdade). Usada em "O aviso ao grupo não saiu" e
    "Não deu certo" em `cartao-transferencia.tsx` e `cartao-conversa.tsx`.

**P3, dois dos cinco (22 e 24; 23, 25 e 26 não):**

21. **Jargão.** As duas frases com "E.164" viraram "Com DDD, por exemplo
    (11) 90000-0000." e "Um número por linha, com +55 e DDD."
22. **Bairro repetido na cidade.** `localidade()`, novo em
    `src/lib/formatacao/localidade.ts` (com teste): junta bairro e
    cidade sem repetir quando são o mesmo texto. Usado em
    `familias/page.tsx`, `familias/[id]/page.tsx`,
    `cartao-oportunidade.tsx` e `painel-resumo.tsx` (resumo da Isadora).
24. **Travessão em comentários.** Os três apontados pelo lint
    (`mesclagem-form.tsx`, `vincular-nova-gestacao.tsx`,
    `deduplicacao/tipos.ts`) viraram vírgula ou ponto.

### Não aplicado (por quê)

- **7. Conversa no celular** (cabeçalho compacto, resumo recolhido,
  mensagens antes da dobra) e **8. Pipeline no celular** (filtros em
  pílulas, folha "Mais filtros", `iconeEsquerda` com `asChild`, cabeçalho
  sem estourar): as duas são reformas de layout inteiras de uma tela,
  não um ajuste pontual, e não coube no tempo deste lote. O item 26
  (largura no computador de Transferências e Tarefas) é da mesma família
  de trabalho.
- **9, resto.** A linha de próximo passo com prazo ("Quer contratar.
  Vence hoje, 16:02.") e o limite "Ver as N famílias" por estágio
  dependem de dado que o cartão do pipeline ainda não recebe
  (`CartaoPipelineTela` não tem "próximo passo"); ficou só a cor.
- **12, resto.** A linha do tempo com os próximos passos tracejados
  ("Próximo passo", "Depois", "Quando a família avisar") é um desenho
  novo em `linha-do-tempo.tsx`, não uma correção pontual.
- **16. Página da Isadora.** Os cinco pontos (kicker da categoria, grade
  de KPI, espaço largo do mono em "48 h", botão "Salvar" sem alteração
  habilitado, página de 2.664 px sem abas) formam uma reforma inteira de
  `painel-base-conhecimento.tsx`, `painel-metricas.tsx` e
  `painel-regra-retomada.tsx`; não coube.
- **18, resto.** Unificar as abas do pipeline e da ficha num componente
  só (hoje uma sublinha em marinho com `Link role="tab"`, a outra em
  dourado) é uma extração de componente que toca as duas telas; ficou
  para outra sessão.
- **20. Cadastrar lead em rota própria.** Mover `formulario-lead.tsx` de
  folha para `/pipeline/novo` muda a navegação da tela (novo layout de
  página, botão "Cadastrar lead" preso ao rodapé no celular por causa do
  item 8) e não coube neste lote.
- **23. Máscaras do CPF e do nascimento.** Trocar `***`/`••` por um
  caractere só, no formato do protótipo, não foi feito: precisa achar e
  ajustar as duas máscaras em `contrato` sem tocar no dado real
  mascarado pelo banco, e não deu tempo de verificar os dois casos com
  segurança.
- **25. O que falta comparado ao protótipo** (selo "Isadora ligada" e
  "Atualizado HH:MM" no cabeçalho, legenda "Em que mão está cada
  conversa", linha "modo vendas, nutrição, 18s3d" no cartão, "O que a
  Isadora colheu" e a régua de prazo no cartão de transferência): são
  acréscimos de conteúdo novo às telas, não correções do que já existe;
  ficaram de fora deste lote de correções.
- **26. Largura no computador.** Duas colunas 62/38 ou largura de leitura
  limitada em Transferências e Tarefas: mesma família do item 7/8, fora
  do tempo deste lote.

### Verificação

`pnpm lint`, `pnpm typecheck`, `pnpm test` (942 testes, todos verdes) e
`pnpm build` (demonstração) ficaram verdes depois do lote; dois testes
precisaram de ajuste para acompanhar a mudança de comportamento, não para
esconder regressão:
`src/components/ui/cabecalho-familia.test.tsx` (a pílula de data ausente
agora tem duas `<dd>`, valor e legenda) e
`src/modules/crm/ficha/dados.test.ts` (`temJustificativaPendente` devolve
`{ pendente, venceEm }`, não mais um booleano). `pnpm e2e` (celular e
computador, modo demonstração) rodou três vezes: a primeira (antes do
lote saber do contador da aba Início e do novo h1 da ficha) tinha 3
falhas esperadas em `navegacao-por-papel.spec.ts`, corrigidas ajustando
o teste ao novo comportamento (contador opcional no texto da aba Início; o
h1 da ficha de exemplo virou o nome da família, "Família Teste Aurora").
As duas rodadas seguintes fecharam 143 passaram, 1 pulado de propósito,
0 falhas.

As capturas de antes e depois do lote estão em
`/tmp/claude-0/-home-user-kraamzorg/bc859238-244a-5795-944c-406f72ec541c/scratchpad/crm-capturas/`
(prefixo `refeito-`, 390 e 1280 px, dez rotas: início, transferências,
conversas, uma conversa em bloqueio total, famílias, duas fichas
(com e sem freio), pipeline, tarefas e a página da Isadora).
