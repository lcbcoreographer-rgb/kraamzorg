// Embute o código das funções puras de `n8n/src/code/*.js` no `jsCode` de um
// nó Code (PRD 19.5: "o build embute o código no JSON e os testes importam as
// mesmas funções"). O nó Code do n8n roda o texto como script solto, sem
// `import`/`export`; por isso removemos só a palavra `export` das
// declarações de nível superior (o corpo das funções fica idêntico ao
// arquivo fonte, então uma mudança de regra entra num só lugar).

import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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

// [P24] Funções puras que importam umas às outras (`import { x } from
// './outro.js';`). O nó Code não aceita `import`, então o build junta o
// arquivo e as dependências locais num só script, na ordem em que cada uma
// é necessária, cada arquivo uma vez só, e tira as linhas de `import`. Só
// imports relativos de um nível (`./arquivo.js`) são aceitos: as funções
// puras não dependem de pacote nenhum.
const PADRAO_IMPORT_LOCAL = /^import\s*\{[^}]*\}\s*from\s*'(\.\/[^']+)';[ \t]*$/gm;
const PADRAO_IMPORT_QUALQUER = /^import\b/m;

export function importsLocais(codigoFonte) {
  return [...codigoFonte.matchAll(PADRAO_IMPORT_LOCAL)].map((match) => match[1]);
}

export function removerImports(codigoFonte) {
  const semLocais = codigoFonte.replace(PADRAO_IMPORT_LOCAL, '');
  if (PADRAO_IMPORT_QUALQUER.test(semLocais)) {
    throw new Error('função pura com import que não é local (./arquivo.js): o nó Code não teria como carregar');
  }
  return semLocais;
}

// Lista, em ordem de dependência, os arquivos que o script do nó precisa.
export function ordemDeDependencias(caminhoArquivo, lerArquivo = (c) => readFileSync(c, 'utf8')) {
  const ordem = [];
  const visitando = new Set();
  const visitados = new Set();

  function visitar(caminho) {
    const absoluto = path.resolve(caminho);
    if (visitados.has(absoluto)) return;
    if (visitando.has(absoluto)) throw new Error(`dependência circular entre funções puras: ${absoluto}`);
    visitando.add(absoluto);
    const fonte = lerArquivo(absoluto);
    for (const relativo of importsLocais(fonte)) {
      visitar(path.join(path.dirname(absoluto), relativo));
    }
    visitando.delete(absoluto);
    visitados.add(absoluto);
    ordem.push({ caminho: absoluto, fonte });
  }

  visitar(caminhoArquivo);
  return ordem;
}

export function embutirCodigoComDependencias({ caminhoArquivo, chamada, lerArquivo }) {
  const arquivos = ordemDeDependencias(caminhoArquivo, lerArquivo);
  const corpo = arquivos
    .map(({ caminho, fonte }) => `// --- ${path.basename(caminho)} ---\n${removerExport(removerImports(fonte)).trim()}`)
    .join('\n\n');
  return `${corpo}\n\n${chamada.trim()}\n`;
}
