/**
 * Valor em reais digitado ("100", "R$ 100" ou "100,50") vira centavos
 * (CLAUDE.md: dinheiro em centavos). Vazio vira null; texto que não é valor
 * vira NaN, para a tela pedir a correção.
 */
export function centavosDoTexto(valor: string): number | null {
  const limpo = valor
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (limpo === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return Number.NaN;
  return Math.round(Number(limpo) * 100);
}

/** Centavos de volta para o campo: 10000 vira "100", 10050 vira "100,50". */
export function textoDeCentavos(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return "";
  const reais = Math.trunc(centavos / 100);
  const resto = centavos % 100;
  return resto === 0
    ? String(reais)
    : `${reais},${String(resto).padStart(2, "0")}`;
}
