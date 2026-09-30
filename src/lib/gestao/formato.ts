/**
 * Formatação das telas de gestão (P45, P46 e P52), no padrão brasileiro
 * (CLAUDE.md): 85,7%, 05/10, setembro de 2026. Nada de regra de negócio aqui.
 */

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "setembro de 2026" a partir de uma data de calendário. */
export function rotuloMes(data: string): string {
  const ano = data.slice(0, 4);
  const mes = Number(data.slice(5, 7));
  return `${MESES[mes - 1] ?? "mês"} de ${ano}`;
}

/** "setembro" a partir de uma data de calendário. */
export function nomeMes(data: string): string {
  return MESES[Number(data.slice(5, 7)) - 1] ?? "mês";
}

/** "05/10" a partir de "2026-10-05". */
export function dataCurta(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/** "85,7%" (uma casa, vírgula); inteiro fica sem casa: "85%". */
export function formatarPct(valor: number): string {
  const texto = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(valor);
  return `${texto}%`;
}

/** "3,5" para horas e semelhantes. */
export function formatarDecimal(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor);
}

/** "2026-09" (parâmetro da URL) a partir de um primeiro dia de mês. */
export function mesParaBusca(primeiroDia: string): string {
  return primeiroDia.slice(0, 7);
}

/** "2026-09-01" a partir de "2026-09"; nulo se não for um mês. */
export function buscaParaMes(busca: string | undefined | null): string | null {
  if (!busca || !/^\d{4}-(0[1-9]|1[0-2])$/.test(busca)) return null;
  return `${busca}-01`;
}

/** "R$ 350", "R$ 12,5 mil", "R$ 1,2 mi": para o eixo dos gráficos. */
export function formatarMoedaCurta(centavos: number): string {
  const reais = centavos / 100;
  const abs = Math.abs(reais);
  const sinal = reais < 0 ? "-" : "";
  const n = (v: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v);
  if (abs >= 1_000_000) return `${sinal}R$ ${n(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${sinal}R$ ${n(abs / 1_000)} mil`;
  return `${sinal}R$ ${n(abs)}`;
}

/** "3 a mais que em agosto", "3 a menos que em agosto" ou "igual a agosto". */
export function compararComAnterior(
  atual: number,
  anterior: number,
  nomeMesAnterior: string,
  formatar: (n: number) => string = (n) => String(n),
): string {
  const dif = atual - anterior;
  if (dif === 0) return `Igual a ${nomeMesAnterior}.`;
  return dif > 0
    ? `${formatar(dif)} a mais que em ${nomeMesAnterior}.`
    : `${formatar(-dif)} a menos que em ${nomeMesAnterior}.`;
}
