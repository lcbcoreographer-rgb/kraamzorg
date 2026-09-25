/**
 * Limite de parcelamento sem juros (PRD 14 v4.2, T-06; 22.1, decisão
 * registrada em `docs/aprovacao/decisoes-pendentes.md` item 5: Plano de
 * Cobrança limitado a 3 parcelas). Padrão até segunda ordem; a origem real
 * do valor é `pacote_versao.parcelas_max_sem_juros`, nunca um número livre.
 */
export const PARCELAS_MAX_SEM_JUROS_PADRAO = 3;

export function validarParcelasMaxSemJuros(parcelasMax: number): void {
  if (!Number.isInteger(parcelasMax) || parcelasMax < 1) {
    throw new RangeError(
      `InfinitePay: parcelasMaxSemJuros inválido (${String(parcelasMax)})`,
    );
  }
  if (parcelasMax > PARCELAS_MAX_SEM_JUROS_PADRAO) {
    throw new RangeError(
      `InfinitePay: parcelamento de ${parcelasMax}x acima do limite de ` +
        `${PARCELAS_MAX_SEM_JUROS_PADRAO}x sem juros (PRD 14 v4.2, T-06). ` +
        "Aceite do P32: o link gerado nunca mostra mais de 3 parcelas.",
    );
  }
}
