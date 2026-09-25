// Embute o código das funções puras de `n8n/src/code/*.js` no `jsCode` de um
// nó Code (PRD 19.5: "o build embute o código no JSON e os testes importam as
// mesmas funções"). O nó Code do n8n roda o texto como script solto, sem
// `import`/`export`; por isso removemos só a palavra `export` das
// declarações de nível superior (o corpo das funções fica idêntico ao
// arquivo fonte, então uma mudança de regra entra num só lugar).

import { readFile } from 'node:fs/promises';

export async function lerFonte(caminhoArquivo) {
  return readFile(caminhoArquivo, 'utf8');
}

// Remove `export ` (e `export default `) do início de declarações de nível
// superior, sem tocar em nenhuma outra ocorrência da palavra no arquivo
// (comentário, string). Como as funções puras deste projeto só usam
// `export function nome(...)`, isso basta; se um arquivo futuro precisar de
// `export const`/`export default`, a mesma regra já cobre.
export function removerExport(codigoFonte) {
  return codigoFonte.replace(/^export default /gm, '').replace(/^export /gm, '');
}

// Monta o `jsCode` final de um nó Code: o código-fonte (sem `export`) mais a
// chamada que usa a função a partir do item de entrada do n8n
// (`$input`/`$json`). `chamada` é o trecho de JS que efetivamente invoca a
// função e devolve o array `[{ json: ... }]` que o n8n espera.
export function montarJsCode(codigoFonte, chamada) {
  const corpo = removerExport(codigoFonte).trim();
  return `${corpo}\n\n${chamada.trim()}\n`;
}

export async function embutirCodigo({ caminhoArquivo, chamada }) {
  const fonte = await lerFonte(caminhoArquivo);
  return montarJsCode(fonte, chamada);
}
