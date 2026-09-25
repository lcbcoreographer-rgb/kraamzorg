/**
 * Idade gestacional nunca é gravada: o banco calcula com `ig(dpp, data)`
 * (PRD 5, item 7). Aqui só formata o par semanas/dias que a função do banco
 * devolve, no formato "38s2d" (CLAUDE.md, "formatação brasileira").
 */
export function formatarIdadeGestacional(
  semanas: number,
  dias: number,
): string {
  const semanasValidas = Number.isFinite(semanas) ? Math.trunc(semanas) : 0;
  const diasValidos = Number.isFinite(dias) ? Math.trunc(dias) : 0;
  return `${semanasValidas}s${diasValidos}d`;
}
