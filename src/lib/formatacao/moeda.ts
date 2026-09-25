/**
 * Dinheiro sempre chega em centavos (PRD 5, "Dinheiro em centavos"). Este
 * formatador só exibe; nenhum valor de negócio mora aqui.
 *
 * Formato brasileiro (CLAUDE.md, "formatação brasileira"): "R$ 4.200" sem
 * casas quando os centavos são zero, "R$ 1.433,33" quando não são.
 *
 * Entrada inválida (não finita) lança erro em vez de devolver "R$ 0": um
 * valor financeiro corrompido não pode virar silenciosamente um zero visível
 * (achado da auditoria da P10 parcial).
 */
export function formatarMoeda(centavos: number): string {
  if (!Number.isFinite(centavos)) {
    throw new RangeError(
      `formatarMoeda: valor em centavos não finito (${String(centavos)})`,
    );
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
