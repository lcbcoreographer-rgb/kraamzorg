# P16 · Ficha 360º e estado sensível

Data: 25/09/2026
Branch e commits: `claude/kraamzorg-delivery-review-6kzd8q`, sem commit desta sessão (a tarefa proíbe commit e push).

A fundação (P07/P10/P15) já deixava `FichaRepositorio` completo em
`src/lib/dados` (ler a ficha, a linha do tempo, os dados de contrato
mascarados, acionar, desfazer, justificar e reverter o freio, nas duas
implementações), `FamiliasRepositorio.listarFamilias` pronto, e as rotas
`/familias` e `/familias/[id]` registradas na navegação (`src/lib/navegacao`,
dono P10) com um estado vazio provisório. Esta sessão trocou o estado vazio
pela tela e acrescentou, dentro de `src/modules/crm/ficha/**` e
`src/app/(app)/familias/**`, tudo que a fundação ainda não tinha: escrita de
"não contatar" e das datas de nascimento e alta, e todos os componentes de
tela.

Direção seguida: `docs/design/DESIGN.md` (seção 6, componentes
`familia-cab`, `botao-freio`, `aviso-efemero`, `folha`, `abas`),
`docs/design/fluxos.md` (fluxo D, "Pipeline comercial e ficha 360 com o
freio em um toque") e o protótipo `docs/prototipo/comercial-ficha.html`
(referência visual e de fluxo, como o P16 do PROMPTS.md pede), mais
`coordenacao-freio.html` para a folha de reversão. A skill interface-2026 e
a Impeccable em modo Operate (`reference/operate.md`, `reference/craft-floor.md`)
foram lidas; o launcher não rodou (proibido pela tarefa, sem detector
mecânico nesta máquina). A checagem foi por leitura direta contra o
DESIGN.md e reaproveitando, sem inventar nada novo, os componentes prontos
da P10 parcial: `CabecalhoFamilia`, `BotaoFreio` e `AvisoEfemero` (feitos
para exatamente este uso, com a própria doc-comment citando "cabeçalho da
família com freio" e "usado pelo Desfazer do freio"), mais `Botao`,
`Cartao`, `Selo`, `FaixaAlerta`, `Dialogo`, `CampoTexto`, `EscolhaUnica` e
`EstadoVazio`. Nenhuma cor, fonte ou raio novo: só classes Tailwind sobre os
tokens do `globals.css`. Vocabulário de componente único em toda a tela
(um só tipo de botão, uma só folha, um só cartão), sem kicker, sem número de
seção decorativo, sem modal para ação reversível simples (a justificativa do
freio e o "ver dados completos" ficam embutidos na própria faixa e no
próprio cartão, não em diálogo).

## Feito

1. **Lista de famílias** (`src/app/(app)/familias/page.tsx`): busca por
   nome (`FamiliasRepositorio.listarFamilias`), cartão por família com as
   semanas de gestação ou a data de nascimento, bairro e cidade, e selos de
   "Não contatar" e do estado sensível. Link para `/pipeline` para quem
   prefere ver agrupado por estágio.
2. **Ficha 360** (`src/app/(app)/familias/[id]/page.tsx`): cabeçalho com
   nome, selo do estágio, semanas de gestação, bairro e cidade, as quatro
   datas sempre visíveis (`CabecalhoFamilia`, já pronto da P10 parcial,
   "estimativa" na DPP e "fato" nas outras três, "ainda não" quando faltam).
   Abas Linha do tempo (sempre), Comercial e Conversas (comercial,
   coordenação e diretoria; a aba que o papel não pode ver não aparece,
   nem no próprio HTML). Pessoas na lateral, sempre.
3. **Linha do tempo** (`componentes/linha-do-tempo.tsx`): espinha vertical
   com marco mais recente em dourado, os demais em marinho; evento restrito
   mostra o cadeado e a frase "visível para quem pode ver". A filtragem em
   si (RLS no Supabase, `tem("coordenacao","diretoria")` na demonstração)
   já vinha pronta em `FichaRepositorio.linhaDoTempo`; este componente só
   desenha o que recebeu.
4. **Freio em um toque** (`componentes/cabecalho-ficha.tsx`,
   `faixa-justificar-freio.tsx`, `folha-reverter-freio.tsx`, PRD 8.3):
   - Um toque no botão "Freio" do cabeçalho aciona `bloqueio_total` direto,
     sem pergunta nenhuma antes (decisão detalhada no README do módulo).
   - Aviso efêmero confirma o efeito, com "Desfazer" por
     `parametro.freio_desfazer_segundos` (lido do banco, nunca fixo no
     código; 0 quer dizer sem Desfazer, mesma leitura de
     `privado.acionar_freio`).
   - Faixa "Justificar o freio" embutida na ficha, com o formulário de
     motivo, para quem acionou.
   - Selo "Freio ativo" é só informativo para quem não é coordenação nem
     diretoria (`<span>`, sem alvo de toque); vira botão para quem pode
     reverter, abrindo a folha com os quatro estados, o efeito de cada um
     em uma frase e a justificativa obrigatória (`api.reverter_freio`
     barra de verdade quem não tem o papel ou o AAL2; a tela só traduz a
     recusa).
5. **Não contatar** (`componentes/controle-nao-contatar.tsx`, P16 item 3):
   folha com motivo obrigatório para marcar; desmarcar é uma ação direta.
   Evento gravado na linha do tempo, não restrito (é dado comercial, não
   assistencial).
6. **Datas de nascimento e alta** (`componentes/controle-data-fato.tsx`,
   P16 item 4): registro como FATO, nunca calculado; nenhuma automação
   dispara por elas (as automações de verdade são do P36, fora desta
   sessão). Evento próprio na linha do tempo.
7. **Dados de contrato mascarados** (`componentes/dados-contrato.tsx`, P16
   item 5): CPF e endereço mascarados por padrão; "Ver dados completos"
   chama `api.dados_contrato(pessoa_id, completo: true)`, que exige AAL2 e
   grava a leitura no log; em AAL1 a tela explica o que fazer (confirmar o
   código do MFA), nunca mostra o dado.
8. **Conversas em leitura** (`componentes/painel-conversas.tsx`, P16
   item 1): últimas mensagens da conversa da família (bolha da família,
   da Isadora e da equipe, como no protótipo), sem nenhum campo de
   resposta; "Abrir em Conversas" leva para `/conversas` (P27), fora desta
   pasta.
9. **Camada de dados do módulo** (`src/modules/crm/ficha/dados.ts` e
   `acoes.ts`): `obterFichaTela`, `listarLinhaDoTempoTela`,
   `obterDadosContratoTela`, `obterConversaDaFamilia`, `listarFamiliasTela`
   usam os repositórios da fundação; `marcarNaoContatar`,
   `desmarcarNaoContatar` e `registrarDataFato` são acréscimos deste
   módulo, com o mesmo padrão que `src/modules/crm/pipeline/dados.ts` (P15)
   usou para `motivo_perda`: update direto na tabela `familia` no Supabase
   (colunas com `grant update` explícito para comercial e diretoria,
   migration 0007) e a mesma escrita na loja em memória no modo
   demonstração.
10. **Testes Vitest** (27 nos dois arquivos novos): conversão da `Ficha`
    bruta para o modelo de tela, visibilidade de evento restrito por papel,
    marcar/desmarcar não contatar com e sem permissão, registro de data com
    validação de formato, o freio em um toque criando `bloqueio_total`,
    desfazer dentro do prazo, reverter só com coordenação/diretoria e só
    com justificativa, e "ver dados completos" recusado em AAL1 e liberado
    em AAL2.
11. **Playwright** (`tests/e2e/p16-ficha/`, 8 specs, que a integração vai
    rodar): abrir a ficha pela lista com o resumo, a linha do tempo e as
    pessoas visíveis; aba Comercial com os dados mascarados e a recusa em
    AAL1; aba Conversas sem campo de enviar; freio em um toque no celular e
    no computador (`porProjeto`, mesmo padrão do P13); desfazer dentro do
    prazo; comercial sem a ação de reverter e coordenação revertendo com
    justificativa; marcar não contatar com evento na linha do tempo;
    registrar data de nascimento; financeiro sem os controles de escrita.
12. `docs/sessoes/p16-ficha.md` (este arquivo) e `src/modules/crm/ficha/README.md`.

## Ficou de fora (e por quê)

- **Eliminação a pedido do titular** (`privado.eliminar_titular`, prompt P16
  item 6, PRD 21.3): exige uma função nova no schema `privado` com pgTAP
  provando que `chat_memoria`, `mensagem` e `handoff` somem sem tocar no
  registro assistencial. As migrations 0001 a 0011 não têm essa função, e
  `supabase/` está fora das minhas pastas nesta sessão (a tarefa proíbe
  mexer lá). Fica pendente para quando a função existir; a tela da
  diretoria que a chamaria também fica de fora até lá.
- **Rodar os testes Playwright**: a tarefa proíbe `pnpm e2e` nesta sessão
  ("a integração roda no fim"). Os specs foram revisados por leitura
  contra os componentes e as ações reais (`aria-label`, texto exato de
  botão e rótulo), mas não executados.
- **Abas Pré-natal, Atendimento e Financeiro** do fluxo D geral
  (`fluxos.md`): são de outros módulos (assistencial, P46); o item 1 do
  prompt P16 lista "comercial, conversas em leitura, estado sensível" como
  o escopo desta sessão, sem citar essas três.
- **Resolução de nome do responsável comercial**: `CartaoOportunidade`
  (fundação) só tem `responsavelId` (UUID); sem `UsuariosRepositorio`
  exposto para toda tela (é de uso mais restrito, diretoria), a aba
  Comercial não mostra "Responsável: Otávio Lemos" como no protótipo, só
  os campos que já vêm com nome pronto (estágio, temperatura, próximo
  contato, apresentação enviada).
- **Busca por telefone** na lista de famílias: `listarFamiliasTela` só
  passa `busca` para `FamiliasRepositorio.listarFamilias` (fundação), que
  filtra só por nome nas duas implementações. Fora desta pasta.

## Decisões tomadas nesta sessão

1. **O botão de freio nunca pergunta `atencao` ou `bloqueio_total`; vai
   direto a `bloqueio_total`.** O prompt P16 ("escolhe `atencao` ou
   `bloqueio_total`") e o PRD 8.3/`fluxos.md`/protótipo (um botão só, sem
   pergunta) davam leituras diferentes; segui a mais detalhada e unânime
   entre design e protótipo, registrada no README do módulo.
2. **`historico_sensivel` nunca entra nesta ficha.** Não é uma restrição de
   tela: `FichaRepositorio.obterFicha` (fundação) não expõe a coluna (a
   migration 0007 já tira ela de todo grant; só sai por
   `api.ficha_assistencial`, fora do escopo do P16). O aceite "nunca para
   comercial sem permissão" fica garantido por a informação nem chegar à
   tela.
3. **"Não contatar" e as datas de nascimento/alta gravam direto na tabela
   `familia`, sem função `api.*`.** Mesmo precedente do P15
   (`pipeline/dados.ts`, motivo da perda): a migration 0007 já dá
   `grant update` dessas colunas para comercial e diretoria, com RLS
   própria; a ação confere o mesmo papel do lado da tela antes de escrever
   (defesa de verdade continua sendo o banco).
4. **Reverter o freio mostra os quatro estados** (normal, atenção,
   bloqueio total, encerrado sensível), como `telas.md` K7 pede, mesmo o
   toque só acionando `bloqueio_total`: a folha de reversão é o único
   lugar onde a coordenação ou a diretoria pode escolher entre os quatro.

## Mudanças no PRD

Nenhuma. Nada nesta sessão contradisse o PRD.

## Pendências novas ([confirmar], [clínico], terceiros)

- **`privado.eliminar_titular` ainda não existe** (item acima, "Ficou de
  fora"): quando a trilha do banco (0012 a 0014, em andamento) ou uma
  sessão futura criar a função, a tela de eliminação (a partir da ficha ou
  de uma lista própria da diretoria, PRD 21.3 e 22.4 L-05) entra como
  acréscimo a este módulo.
- **Resolução de nome do responsável comercial** (acima): se uma sessão
  futura expuser um jeito de traduzir `responsavelId` em nome sem dar
  `UsuariosRepositorio` inteiro a toda tela (por exemplo um método
  `nomeDoUsuario(id)` mais restrito), a aba Comercial passa a mostrar o
  responsável.
- **Busca por telefone na lista de famílias** (acima): precisa de um
  filtro novo em `FamiliasRepositorio.listarFamilias` (fundação), fora
  desta pasta.

## Como testar

```bash
# Nas minhas pastas
pnpm eslint "src/modules/crm/ficha" "src/app/(app)/familias"
pnpm tsc --noEmit   # typecheck não tem como escopar por pasta
NEXT_PUBLIC_APP_ENV=desenvolvimento pnpm vitest run src/modules/crm/ficha
NEXT_PUBLIC_APP_ENV=desenvolvimento KZ_DADOS=demonstracao pnpm dev
# depois, no navegador: entrar como "Comercial" e abrir /familias
```

Roteiro manual (modo demonstração, `KZ_DADOS=demonstracao`):

1. Entrar como comercial → `/familias` → buscar "Dália" → abrir a ficha →
   ver as quatro datas, a linha do tempo vazia (a Dália não tem evento no
   seed) e as pessoas na lateral.
2. Aba Comercial → "Ver dados completos" → a tela pede para confirmar o
   código do aplicativo (AAL1). Sair e entrar de novo confirmando o MFA →
   repetir → CPF e endereço completos aparecem, com o aviso de leitura
   registrada.
3. Abrir a ficha de outra família (ex: "Flor") → tocar "Freio" → o
   cabeçalho vira ameixa na hora, sem pergunta nenhuma → aviso efêmero com
   "Desfazer" → tocar "Desfazer" → volta ao normal.
4. Tocar "Freio" de novo → sair e entrar como coordenação → abrir a mesma
   ficha → tocar o selo "Freio ativo" → folha com os quatro estados →
   escolher "Normal" sem escrever a justificativa → a tela recusa →
   escrever e salvar → o cabeçalho volta à areia.
5. Aba Comercial → "Marcar não contatar" → sem motivo, recusa → com
   motivo, marca → o selo "Não contatar" aparece e o evento entra na linha
   do tempo.
6. Aba Comercial → "Registrar nascimento" → escolher uma data → o
   cabeçalho troca "ainda não" pela data, com o rótulo "fato".

## Resultado dos invariantes

Esta sessão não roda os quatro invariantes do CLAUDE.md inteiros nem
`pnpm build`/`pnpm e2e` (a tarefa reserva isso para a integração no fim,
feita por outro agente). O que rodou, escopado às minhas pastas:

- `pnpm eslint "src/modules/crm/ficha" "src/app/(app)/familias" "tests/e2e/p16-ficha"`:
  **0 erros, 0 avisos.**
- `pnpm tsc --noEmit` (repositório inteiro, porque `typecheck` não tem
  como escopar por pasta): **0 erros nas minhas pastas.** Um erro de tipo
  fora delas (`src/lib/messaging/uazapi.test.ts`) é de outro agente em
  andamento, ignorado sem mexer, como a tarefa pediu.
- `NEXT_PUBLIC_APP_ENV=desenvolvimento pnpm vitest run src/modules/crm/ficha`:
  **27 testes, 2 arquivos, todos verdes.**
- `npx prettier --check` nas minhas pastas: sem pendência (formatado com
  `--write` antes de terminar).
- `gitleaks detect --no-banner --no-git --source <cada uma das minhas
  pastas>`: **nenhum vazamento.**
- `pnpm e2e` (`tests/e2e/p16-ficha/`): não rodado nesta sessão (proibido
  pela tarefa; "não rode pnpm build nem pnpm e2e, a integração roda no
  fim"); specs revisados por leitura contra os componentes e as ações.
