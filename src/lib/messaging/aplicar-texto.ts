/**
 * Preenche um texto de mensagem_modelo, espelho de privado.aplicar_nome e
 * privado.aplicar_texto (0013): {nome} vazio sai junto com a vírgula e o
 * espaço vizinhos e a primeira letra volta a ser maiúscula (PRD 23); as
 * demais variáveis {chave} trocam numa passada só (o valor trocado nunca é
 * relido); variável sem valor vira vazio.
 *
 * Usado pela demonstração (mesmo texto que o banco montaria) e pelas
 * prévias da tela, que mostram à pessoa da equipe exatamente o que a
 * família vai receber. O texto em si nunca mora no código.
 */
export function aplicarNome(texto: string, nome: string | null): string {
  if (!texto.includes("{nome}")) return texto;
  const limpo = nome?.trim();
  if (limpo) return texto.replaceAll("{nome}", limpo);
  const semNome = texto
    .replace(/,\s*\{nome\}/g, "")
    .replace(/\{nome\},?\s*/g, "")
    .trim();
  return semNome.charAt(0).toUpperCase() + semNome.slice(1);
}

export function aplicarTexto(
  texto: string,
  nome: string | null,
  variaveis: Record<string, string | number | null | undefined> = {},
): string {
  let resto = aplicarNome(texto, nome);
  let saida = "";
  for (;;) {
    const inicio = resto.indexOf("{");
    if (inicio < 0) break;
    const fim = resto.indexOf("}", inicio);
    if (fim < 0) break;
    const chave = resto.slice(inicio + 1, fim);
    if (/^[a-z_]+$/.test(chave)) {
      const valor = variaveis[chave];
      saida += resto.slice(0, inicio) + (valor == null ? "" : String(valor));
    } else {
      saida += resto.slice(0, fim + 1);
    }
    resto = resto.slice(fim + 1);
  }
  return saida + resto;
}

/** Primeira palavra do nome, só se começar por letra (privado.venda_primeiro_nome). */
export function primeiroNome(nome: string | null | undefined): string | null {
  const palavra = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^\p{L}/u.test(palavra)) return null;
  return palavra.replace(/[^\p{L}'-]+$/u, "");
}
