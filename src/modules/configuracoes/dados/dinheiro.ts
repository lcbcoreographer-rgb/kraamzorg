/**
 * Converte um preço digitado em formato brasileiro para centavos (CLAUDE.md,
 * "Dinheiro em centavos"; "Formatação brasileira: R$ 4.200"). A tela mostra
 * o preço vigente com `formatarMoeda` (ponto como separador de milhar,
 * vírgula como decimal, ex. "R$ 4.200,00" ou "R$ 4.200"), e é natural que a
 * pessoa digite a nova versão no mesmo formato que acabou de ver na tela.
 *
 * Um replace ingênuo de vírgula por ponto quebra com separador de milhar:
 * "4.200,00" vira "4.200.00" (dois pontos, `Number` devolve `NaN`) e
 * "4.200" (sem vírgula) vira `Number("4.200") === 4.2`, um preço 1000 vezes
 * menor gravado em silêncio, sem erro nenhum. Aqui o ponto só é decimal
 * quando aparece sozinho (sem vírgula) e com exatamente duas casas depois
 * dele; do contrário é separador de milhar e some.
 */
export function paraCentavosBRL(entrada: string): number | null {
  const limpo = entrada.trim().replace(/[^\d,.-]/g, "");
  if (limpo === "") return null;

  let normalizado: string;
  if (limpo.includes(",")) {
    // Vírgula é sempre o decimal aqui; qualquer ponto antes dela é milhar.
    normalizado = `${limpo.replace(/\./g, "").replace(",", ".")}`;
  } else if (limpo.includes(".")) {
    const partes = limpo.split(".");
    const ultima = partes[partes.length - 1]!;
    normalizado =
      partes.length > 1 && ultima.length === 2
        ? `${partes.slice(0, -1).join("")}.${ultima}`
        : limpo.replace(/\./g, "");
  } else {
    normalizado = limpo;
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : null;
}
