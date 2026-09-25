Ficha 360 e estado sensível, P16. Rota em `src/app/(app)/familias` (lista e
`/familias/[id]`).

- `tipos.ts`: modelo de tela por cima de `Ficha`, `EventoLinhaDoTempo` e
  `CartaoOportunidade` (fundação): datas prontas para `CabecalhoFamilia`,
  rótulo de estágio, resumo de conversa.
- `rotulos.ts`: rótulo de tipo de evento (`evento_familia.tipo` é texto
  livre no banco) e reexporta `ROTULO_PAPEL_PESSOA` do pipeline (P15), sem
  duplicar.
- `dados.ts`: usa `obterRepositorios().ficha` e `.familias` (fundação) para
  ler a ficha, a linha do tempo, os dados de contrato mascarados e o freio;
  acrescenta, dentro desta pasta, o que faltava: marcar "não contatar" e
  registrar as datas de nascimento e alta. As três colunas
  (`nao_contatar`, `data_nascimento`, `data_alta`) têm `grant update` direto
  para comercial e diretoria em `familia`
  (`supabase/migrations/0007_permissoes.sql`, seção 5.2), sem função `api.*`
  própria: a escrita segue o mesmo precedente que `pipeline/dados.ts` (P15)
  já usa para `motivo_perda` e o cadastro manual de lead (tabela direta por
  RLS no Supabase, a mesma loja em memória na demonstração).
- `acoes.ts`: Server Actions chamadas pelos componentes. O freio em um
  toque sempre aciona `bloqueio_total` (decisão abaixo); reverter, marcar
  não contatar e registrar data seguem o padrão `useActionState` +
  `FormData` do resto do projeto.
- `componentes/`:
  - `cabecalho-ficha.tsx`: liga `CabecalhoFamilia` e `BotaoFreio` (já
    existiam em `src/components/ui`, da P10 parcial) às ações do freio, com
    `AvisoEfemero` e "Desfazer".
  - `faixa-justificar-freio.tsx`: formulário embutido de justificativa,
    sem página nem tarefa à parte.
  - `folha-reverter-freio.tsx`: reversão ou ajuste, só coordenação ou
    diretoria (o banco é quem barra de verdade).
  - `abas-ficha.tsx`, `linha-do-tempo.tsx`, `painel-pessoas.tsx`,
    `painel-comercial.tsx`, `painel-conversas.tsx`, `dados-contrato.tsx`,
    `controle-nao-contatar.tsx`, `controle-data-fato.tsx`.

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

Dono: P16. Não edita `src/lib/dados/repositorios.ts` nem as duas
implementações da fundação; o que faltava lá entrou aqui dentro.
