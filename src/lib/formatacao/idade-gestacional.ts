/**
 * Idade gestacional nunca é gravada: o banco calcula com `ig(dpp, data)`
 * (PRD 5, item 7). Aqui só formata o par semanas/dias que a função do banco
 * devolve, no formato "38s2d" (CLAUDE.md, "formatação brasileira").
 *
 * `dias` é sempre o resto da divisão por 7 (0 a 6): fora dessa faixa, ou
 * negativo, é dado corrompido do lado de quem chama, não algo para
 * formatar em silêncio.
 */
export function formatarIdadeGestacional(
  semanas: number,
  dias: number,
): string {
  if (!Number.isFinite(semanas) || !Number.isFinite(dias)) {
    return "0s0d";
  }

  const semanasValidas = Math.trunc(semanas);
  const diasValidos = Math.trunc(dias);

  if (semanasValidas < 0 || diasValidos < 0 || diasValidos > 6) {
    throw new RangeError(
      `formatarIdadeGestacional: semanas ou dias fora da faixa (semanas=${semanasValidas}, dias=${diasValidos})`,
    );
  }

  return `${semanasValidas}s${diasValidos}d`;
}
