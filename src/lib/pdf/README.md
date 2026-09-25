Geração de PDF no servidor com @react-pdf/renderer: evoluções e contrato.
Sem Chromium; nome de paciente nunca entra no nome do arquivo.

## Evoluções em PDF (P41)

`gerarEvolucaoPuerperal(dados, textos)` e `gerarEvolucaoNeonatal(dados, textos)`
(`gerar.ts`) recebem os dados agregados do acompanhamento (`tipos.ts`,
`DadosEvolucaoPuerperal` e `DadosEvolucaoNeonatal`, uma chamada por bebê) e
os textos aprovados de `mensagem_modelo` com destinatário `medico`, chaves
`evo_*` (`TextosModelo`, um mapa chave -> texto com `{variavel}`; a lista de
chaves esperadas está no cabeçalho de `evolucao-puerperal.tsx` e
`evolucao-neonatal.tsx`). A biblioteca não lê o banco: quem chama monta o
agregado e passa os textos prontos.

Cada função valida antes de renderizar (PRD 9.5, `validacoes.ts`): datas
dentro do período, conclusão coerente com os achados (aleitamento contra
complemento, ganho contra perda de peso, icterícia), ferida operatória só
em cesárea, contato médico presente, conselho e UF da profissional. Erro de
validação devolve `{ ok: false, erros }` e não gera PDF; conclusão
incoerente bloqueia exatamente assim (aceite do P41). Sucesso devolve
`{ ok: true, buffer, nomeArquivo }`.

`curva-peso.ts` calcula a curva de peso (PRD 22.3 K-11): perda percentual,
menor peso, ganho absoluto e ganho médio diário com uma casa decimal, a
partir do menor peso registrado (não necessariamente o peso da alta); o dia
do nascimento conta como dia 0.

`textos.ts` preenche os textos-padrão (`preencherTexto`) e resolve a
concordância de gênero (`concordar`), usada nos trechos que descrevem o
bebê (identificação, genitália, conclusão) — o mesmo ponto onde os
documentos reais analisados (`docs/analise-evolucoes.md`) erravam o gênero.

`metadados.ts` cuida do nome do arquivo (`{id}.pdf`, nunca o nome da
paciente) e dos metadados controlados do PDF (autor "Kraamzorg Brasil",
idioma pt-BR); os tipos de entrada não têm campo de nome de paciente em
lugar nenhum que alimente essas duas funções.

`fontes.ts` e `tokens.ts` só repetem Jost/Inter/IBM Plex Mono e os nove
tokens de cor de `src/app/globals.css` (`CLAUDE.md`, "Tokens só em
`globals.css`"): o PDF não lê CSS, então os valores são copiados aqui, com
teste (`tokens.test.ts`) conferindo a mesma fórmula de mistura.

Sem tela própria: o rascunho e a aprovação da evolução e o envio por
e-mail ficam para a onda B (PROMPTS.md, P41).

### Nota de ambiente de teste

`@react-pdf/renderer` usa `pdfkit`, que resolve um caminho diferente
("browser" vs Node) conforme o Vite decide as condições de resolução do
pacote. Sob `environment: "jsdom"` (padrão do projeto), essa resolução
quebra a montagem de imagem local (`Image` com `Buffer`). Por isso todo
teste que efetivamente renderiza um PDF (`gerar.test.ts`) começa com o
comentário `// @vitest-environment node`, que troca o ambiente só daquele
arquivo para Node puro, igual ao runtime real (rota de servidor do
Next.js). Os módulos puros (`curva-peso`, `validacoes`, `textos`,
`metadados`, `tokens`) não têm essa exigência.
