/**
 * Dinheiro sempre chega em centavos (PRD 5, "Dinheiro em centavos"). Este
 * formatador só exibe; nenhum valor de negócio mora aqui.
 *
 * Formato brasileiro (CLAUDE.md, "formatação brasileira"): "R$ 4.200" sem
 * casas quando os centavos são zero, "R$ 1.433,33" quando não são.
 */
export function formatarMoeda(centavos: number): string {
  if (!Number.isFinite(centavos)) {
    return "R$ 0";
  }

  const inteiro = Math.round(centavos);
  const negativo = inteiro < 0;
  const valorAbsoluto = Math.abs(inteiro);
  const reais = valorAbsoluto / 100;
  const temCentavos = valorAbsoluto % 100 !== 0;

  const numero = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: temCentavos ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(reais);

  return `${negativo ? "-" : ""}R$ ${numero}`;
}
