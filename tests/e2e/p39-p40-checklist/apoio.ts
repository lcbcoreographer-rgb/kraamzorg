/**
 * Ids fixos da demonstração assistencial (src/lib/dados/demonstracao/
 * assistencial-fixtures.ts): `id(530, n)` é a visita n. Aurora D4 (n = 4) é
 * a visita aberta da enfermeira, com D1 a D3 assinados; Dália D3 (n = 9) já
 * tem o registro assinado e um alerta fechado; Cedro D6 (n = 8) é o último
 * dia; a visita 11 é de outra enfermeira.
 */
export function idVisita(n: number): string {
  return `00000000-0000-4000-8530-${String(n).padStart(12, "0")}`;
}

export const TELEFONE_SUPERVISAO_DEMO = "tel:+5511900000099";
