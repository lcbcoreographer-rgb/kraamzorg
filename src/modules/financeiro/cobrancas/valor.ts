/**
 * Valor digitado em reais ("4.550,00", "4550", "4550.5") para centavos
 * (CLAUDE.md: dinheiro em centavos, nunca ponto flutuante gravado).
 * Devolve null quando não é um valor em reais válido, positivo e com no
 * máximo duas casas.
 */
export function reaisParaCentavos(entrada: string): number | null {
  const limpo = entrada.trim().replace(/^R\$\s*/i, "");
  if (limpo === "") return null;
  let normalizado: string;
  if (limpo.includes(",")) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    normalizado = limpo.replace(/\./g, "");
  } else {
    normalizado = limpo;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  const [reais, centavos = ""] = normalizado.split(".");
  const total = Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

/** Centavos para o campo de valor ("4550,00"), sem símbolo. */
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}
