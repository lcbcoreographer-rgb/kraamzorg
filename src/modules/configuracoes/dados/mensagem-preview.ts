/**
 * Prévia das variáveis de uma mensagem (PRD 13, "Fazer" item 5: "edição com
 * prévia das variáveis, contagem de caracteres"; PRD 23, cabeçalho do
 * capítulo: "Quando {nome} estiver vazio, a função que monta o texto tira a
 * variável junto com a vírgula e o espaço vizinhos e acerta a maiúscula").
 * Puro, sem acesso a banco: a tela chama para mostrar como o texto fica
 * com valores de exemplo, antes de aprovar.
 */

const PADRAO_VARIAVEL = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/** Nomes das variáveis usadas no texto, na ordem em que aparecem, sem repetir. */
export function extrairVariaveis(texto: string): string[] {
  const vistas = new Set<string>();
  const encontradas: string[] = [];
  for (const encontro of texto.matchAll(PADRAO_VARIAVEL)) {
    const nome = encontro[1]!;
    if (!vistas.has(nome)) {
      vistas.add(nome);
      encontradas.push(nome);
    }
  }
  return encontradas;
}

function maiusculaPrimeira(texto: string): string {
  const semEspaco = texto.replace(/^\s+/, "");
  return semEspaco.length
    ? semEspaco[0]!.toUpperCase() + semEspaco.slice(1)
    : semEspaco;
}

/**
 * Substitui `{variavel}` pelo valor de exemplo. Quando o valor vem vazio,
 * some com a vírgula e o espaço vizinhos e reacerta a maiúscula da frase
 * (PRD 23), do mesmo jeito que a função real de produção vai fazer no
 * envio.
 */
export function montarPreviaMensagem(
  texto: string,
  valores: Record<string, string>,
): string {
  let resultado = texto.replace(PADRAO_VARIAVEL, (correspondencia, nome) => {
    const valor = valores[nome as string];
    return valor && valor.trim() !== "" ? valor : "";
  });

  // "Oi, , tudo bem?" -> "Oi, tudo bem?"; "Pelo que , você..." -> "Pelo que você..."
  resultado = resultado
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s+\./g, ".")
    .replace(/^,\s*/g, "")
    .replace(/,\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return maiusculaPrimeira(resultado);
}
