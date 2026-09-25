// Carrega o texto de um prompt de `n8n/prompts/*.md` entre as marcas
// `=== INÍCIO DO PROMPT ===` e `=== FIM DO PROMPT ===`, procuradas no começo
// da linha (P23 item 2): o cabeçalho de cada arquivo cita essas marcas no
// meio do texto explicativo, então procurar a substring em qualquer lugar
// pegaria a menção errada. Aqui procuramos a linha que COMEÇA com a marca,
// não qualquer ocorrência da string.
//
// Depois de extraído, `trocarVariaveisPorExpressoes` troca cada `{{variavel}}`
// do prompt por uma expressão do n8n (`{{ $json.algo }}` ou
// `{{ $('Nó').item.json.algo }}`), mantendo a sintaxe de chave dupla que o
// n8n já usa para expressão.

import { readFile } from 'node:fs/promises';

export const MARCA_INICIO = '=== INÍCIO DO PROMPT ===';
export const MARCA_FIM = '=== FIM DO PROMPT ===';

function indiceLinhaComMarca(linhas, marca) {
  return linhas.findIndex((linha) => linha.startsWith(marca));
}

export function extrairPrompt(conteudo, origem = '(texto)') {
  const linhas = conteudo.split('\n');
  const inicio = indiceLinhaComMarca(linhas, MARCA_INICIO);
  const fim = indiceLinhaComMarca(linhas, MARCA_FIM);

  if (inicio === -1 || fim === -1 || fim <= inicio) {
    throw new Error(
      `nao encontrei as marcas "${MARCA_INICIO}" / "${MARCA_FIM}" no comeco de uma linha em ${origem}`,
    );
  }

  return linhas
    .slice(inicio + 1, fim)
    .join('\n')
    .trim();
}

export async function carregarPrompt(caminhoArquivo) {
  const conteudo = await readFile(caminhoArquivo, 'utf8');
  return extrairPrompt(conteudo, caminhoArquivo);
}

// Variáveis do prompt vêm como `{{nome}}`. O mapa dá, para cada nome, o
// conteúdo que entra dentro das chaves de expressão do n8n (sem o `{{ }}`),
// por exemplo `$json.data_hora` ou `$('Montar Contexto do Agente').item.json.ficha`.
export function trocarVariaveisPorExpressoes(texto, mapaVariaveis) {
  return texto.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, nome) => {
    const expressao = mapaVariaveis[nome];
    if (expressao === undefined) {
      throw new Error(`variável "${nome}" do prompt não tem expressão correspondente no mapa passado ao build`);
    }
    return `{{ ${expressao} }}`;
  });
}

// Lista as variáveis `{{nome}}` que aparecem no texto extraído, para o build
// (ou um teste) conferir que todas têm expressão mapeada antes de gerar o
// JSON final.
export function variaveisDoPrompt(texto) {
  const encontradas = new Set();
  for (const match of texto.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    encontradas.add(match[1]);
  }
  return [...encontradas];
}
