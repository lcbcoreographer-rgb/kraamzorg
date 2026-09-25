Geração de PDF no servidor com @react-pdf/renderer: evoluções e contrato.
Sem Chromium; nome de paciente nunca entra no nome do arquivo.

## Evoluções em PDF (P41)

Três passos, em `gerar.ts`:

1. `validarEvolucaoPuerperal` / `validarEvolucaoNeonatal` (`validacoes.ts`,
   PRD 9.5): datas no formato e dentro do período (pesagem da alta e do
   pediatra entre o nascimento e o fim; documento emitido no último dia ou
   depois; dias D de laser, ILIB, lesão e dor entre D1 e Dn), conclusão
   coerente com os achados (aleitamento contra o registrado e contra
   complemento em ml, ganho contra perda de peso pela curva, icterícia
   presente, ausente ou em regressão contra a tendência), ferida operatória
   só em cesárea e nunca com a frase de "sem sinais" sobre achado com
   sinais, dor coerente com a remissão, contato médico com e-mail, conselho,
   UF, número e especialidade da profissional.
2. `montarConteudoPuerperal` / `montarConteudoNeonatal`
   (`conteudo-puerperal.ts`, `conteudo-neonatal.ts`): monta o
   `ConteudoEvolucao` (`conteudo.ts`), seções com parágrafos, campos e
   listas. É o formato do rascunho (`relatorio_medico.conteudo`) que a
   onda B guarda e deixa a enfermeira editar. Os textos vêm de
   `mensagem_modelo` (`TextosModelo`, chaves `evo_*`, lista no cabeçalho de
   cada arquivo); nenhum trecho clínico fica no código.
3. `renderizarEvolucao(id, conteudo)` (`documento.tsx`): recusa conteúdo
   com travessão, meia-risca ou `{variavel}` sem preencher e imprime o PDF
   A4 com logo, rodapé com aviso LGPD art. 11 e paginação em toda página,
   metadados controlados em pt-BR e nome de arquivo `{id}.pdf`.

`rascunhoEvolucao*` junta 1 e 2; `gerarEvolucao*` junta os três. Erro de
validação, texto que falta em `mensagem_modelo` ou texto proibido devolvem
`{ ok: false, erros }` sem PDF (aceite do P41: conclusão incoerente
bloqueia).

Concordância de gênero (`textos.ts`, `preencherTextoPorSexo`): todo trecho
que descreve o bebê é procurado primeiro em `{chave}_masculino` ou
`{chave}_feminino` e só depois na chave neutra. As duas formas moram no
seed, escritas pela Edilaine; o código só escolhe pelo `bebe.sexo`.

`curva-peso.ts` (PRD 22.3 K-11): perda percentual, menor peso, ganho
absoluto e ganho médio diário com uma casa decimal, a partir do menor peso
registrado; o dia do nascimento é o dia 0. `classificarEvolucaoPeso` usa a
mesma base: bebê que voltou a ganhar desde o menor peso é "progressivo",
mesmo abaixo do peso de nascimento.

`formatar.ts`: datas em dd/mm/aaaa (por `src/lib/formatacao`), números com
vírgula decimal e ponto de milhar, zona de Kramer em romano.

`fontes.ts` e `tokens.ts` repetem Jost/Inter/IBM Plex Mono e os tokens de
cor de `src/app/globals.css`: o PDF não lê CSS. `tokens.test.ts` lê o
próprio `globals.css` e falha se um primitivo ou derivado mudar lá.

Armadilha conhecida do @react-pdf/renderer 4.9 (`componentes.tsx`): nenhum
`lineHeight` na página. Herdado pelo texto dinâmico da paginação, ele joga o
rodapé inteiro para fora da folha. E todo número em `lineHeight` é
multiplicado pelo `fontSize` do próprio estilo (18 pt quando falta), por isso
o corpo usa "14pt".

Testes que leem o PDF gerado (`__fixtures__/ler-pdf.ts`) decodificam o texto
e a posição de cada trecho, sem dependência nova: provam que o rodapé está
dentro de toda página e que a menina sai "filha" e "nascida" no próprio PDF.

Sem tela própria: o rascunho, a edição, a aprovação e o envio por e-mail
ficam para a onda B (PROMPTS.md, P41).

### Nota de ambiente de teste

`@react-pdf/renderer` usa `pdfkit`, que resolve um caminho diferente
("browser" vs Node) conforme o Vite decide as condições de resolução do
pacote. Sob `environment: "jsdom"` (padrão do projeto), essa resolução
quebra a montagem de imagem local (`Image` com `Buffer`). Por isso todo
teste que efetivamente renderiza um PDF (`gerar.test.ts`) começa com o
comentário `// @vitest-environment node`, que troca o ambiente só daquele
arquivo para Node puro, igual ao runtime real (rota de servidor do
Next.js). Os módulos puros (`curva-peso`, `validacoes`, `textos`,
`metadados`, `tokens`, `conteudo`) não têm essa exigência.
