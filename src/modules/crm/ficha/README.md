Ficha 360 e estado sensível, P16. Rota em `src/app/(app)/familias` (lista e
`/familias/[id]`).

- `tipos.ts`: modelo de tela por cima de `Ficha`, `EventoLinhaDoTempo` e
  `CartaoOportunidade` (fundação): datas prontas para `CabecalhoFamilia`,
  rótulo de estágio, resumo de conversa.
- `rotulos.ts`: rótulos sem "server-only" (a folha de reversão, que é de
  cliente, lê daqui): estados do freio e o efeito de cada um, rótulo de
  tipo de evento e `tituloEvento`, que monta a frase do evento a partir de
  `dados` (o banco grava o título como código, "normal → bloqueio_total").
  Reexporta `ROTULO_PAPEL_PESSOA` do pipeline (P15), sem duplicar.
- `dados.ts` (server-only): usa `obterRepositorios().ficha`, `.familias` e
  `.tarefas` (fundação) para ler a ficha, a linha do tempo, os dados de
  contrato mascarados, o freio e a tarefa de justificativa aberta; o prazo
  do "Desfazer" vem de `desfazer_ate` na resposta do acionamento (só a
  diretoria lê `parametro`). Acrescenta, dentro desta pasta, marcar "não
  contatar" e registrar as datas de nascimento e alta (update da coluna com
  RLS; `evento_familia` não tem insert para o app, ver pendências).
- `acoes.ts` ("use server"): só funções assíncronas. O freio em um toque
  sempre aciona `bloqueio_total`; a folha de reversão escolhe a porta
  (descer é `api.reverter_freio`, subir é `api.acionar_freio` com a
  justificativa como motivo).
- `estado-acoes.ts`: estado inicial e tipos de estado das ações. Fica fora
  de `acoes.ts` porque um arquivo "use server" que exporta um objeto quebra
  a ficha inteira ("A use server file can only export async functions").
- `componentes/`:
  - `cabecalho-ficha.tsx`: liga `CabecalhoFamilia` e `BotaoFreio` (já
    existiam em `src/components/ui`, da P10 parcial) às ações do freio, com
    `AvisoEfemero` e "Desfazer". Também usado pela conversa (P27).
  - `faixa-justificar-freio.tsx`: formulário embutido de justificativa, só
    para quem tem a tarefa aberta (quem acionou sem motivo).
  - `folha-reverter-freio.tsx`: reversão ou ajuste, só coordenação ou
    diretoria, com os outros estados (o atual não é opção).
  - `abas-ficha.tsx`, `linha-do-tempo.tsx`, `painel-pessoas.tsx`,
    `painel-comercial.tsx`, `painel-conversas.tsx`, `dados-contrato.tsx`,
    `controle-nao-contatar.tsx`, `controle-data-fato.tsx`.

Quem vê o quê (PRD 13): aba Comercial para comercial e diretoria (edição),
coordenação e financeiro (leitura); dados de contrato só comercial,
financeiro e diretoria; Conversas para comercial, coordenação e diretoria.
Datas de nascimento e alta são fato: a tela recusa data depois de hoje.

## Decisão: o botão de freio nunca pergunta `atencao` ou `bloqueio_total`

O item 2 do prompt P16 diz "escolhe `atencao` ou `bloqueio_total`, sem
justificativa prévia". `fluxos.md` (seção D), `telas.md` (C4) e o protótipo
`docs/prototipo/comercial-ficha.html` são unânimes e mais detalhados: um
botão só, que já aciona `bloqueio_total` na hora, sem pergunta de espécie
nenhuma (PRD 8.3: "sem pergunta, sem justificativa antes"). Como
`FichaRepositorio.acionarFreio` já recebe o estado como parâmetro, o botão
desta tela chama sempre com `bloqueio_total`; a função continua pronta para
outra entrada (a coordenação, por exemplo) acionar só `atencao` no futuro.

## O que ficou fora, e por quê

- **`historico_sensivel`**: nunca aparece nesta ficha, porque
  `FichaRepositorio.obterFicha` (fundação) não o expõe (a migration 0007
  já tira a coluna de todo grant; só sai por `api.ficha_assistencial`, RPC
  assistencial fora do escopo do P16). "Nunca para comercial sem
  permissão" (aceite do prompt) fica garantido por não existir na tela.
  Coordenação e diretoria deveriam ver na ficha (PRD 13); fica pendente.
- **Abas Pré-natal, Atendimento e Financeiro** do fluxo D geral: são de
  outros módulos (assistencial e P46); o prompt P16 lista "comercial,
  conversas em leitura" como o escopo desta sessão.
- **Eliminação a pedido do titular** (`privado.eliminar_titular`, item 6 do
  prompt): exige uma função nova no schema `privado`
  (`supabase/`, fora desta pasta) que ainda não existe nas migrations 0001
  a 0011. Fica pendente para quando a função existir; ver
  `docs/sessoes/p16-ficha.md`.
- **Busca por telefone** na lista de famílias:
  `FamiliasRepositorio.listarFamilias` (fundação) só filtra por nome hoje.
- **Evento de "não contatar" e das datas no Supabase**: `evento_familia`
  não tem insert para `authenticated` (0007); a demonstração grava o evento
  (simula a função que falta), o banco real só grava a coluna até existir
  uma função `api.*` que faça as duas coisas na mesma transação.
- **Eventos restritos no Supabase**: a política de `evento_familia` só deixa
  ler `not restrito`, para todo papel; a leitura dos restritos pela
  coordenação e pela diretoria depende de uma função com log (0007, "só por
  função com log (P16)") que ainda não existe. A demonstração já mostra.

Dono: P16. Não edita `src/lib/dados/repositorios.ts` nem as duas
implementações da fundação; o que faltava lá entrou aqui dentro.
