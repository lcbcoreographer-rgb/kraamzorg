/**
 * Limite de parcelamento do link (PRD 14 v4.2, T-06): o checkout nunca
 * oferece mais parcelas que `pacote_versao.parcelas_max_sem_juros` (3 no
 * seed, PRD 6.3). O limite vem sempre do banco, por quem chama; nenhum
 * número fica escrito aqui (CLAUDE.md, "nenhum limite no código").
 * Validado antes de qualquer chamada de rede.
 */
export function validarParcelas(
  parcelas: number,
  parcelasMaxSemJuros: number,
): void {
  if (!Number.isInteger(parcelasMaxSemJuros) || parcelasMaxSemJuros < 1) {
    throw new RangeError(
      `InfinitePay: limite de parcelas do pacote inválido (${String(parcelasMaxSemJuros)})`,
    );
  }
  if (!Number.isInteger(parcelas) || parcelas < 1) {
    throw new RangeError(
      `InfinitePay: número de parcelas inválido (${String(parcelas)})`,
    );
  }
  if (parcelas > parcelasMaxSemJuros) {
    throw new RangeError(
      `InfinitePay: link de ${parcelas}x acima do limite de ` +
        `${parcelasMaxSemJuros}x sem juros do pacote (PRD 14 v4.2, T-06).`,
    );
  }
}
