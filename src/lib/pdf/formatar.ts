/**
 * Formatação brasileira dos números e datas que entram no documento
 * (CLAUDE.md, "Formatação brasileira: R$ 4.200, 24/09/2026"). As datas
 * chegam como coluna `date` ("aaaa-mm-dd") e saem "dd/mm/aaaa" por
 * `formatarData` de `src/lib/formatacao`; números saem com vírgula decimal
 * e ponto de milhar ("36,8 °C", "3.320 g", "57,1 g/dia").
 */
import { formatarData } from "@/lib/formatacao";
import type { DataIso, Faixa, ZonaKramer } from "./tipos";

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function numeroBr(valor: number): string {
  return NUMERO.format(valor);
}

/** "24/09/2026". Data fora do formato já foi barrada pela validação; aqui só recusa em vez de imprimir lixo. */
export function dataBr(data: DataIso): string {
  const formatada = formatarData(data);
  if (formatada === null) {
    throw new RangeError(`Data inválida no documento ("${data}").`);
  }
  return formatada;
}

/** "36,2 a 36,9" (sem unidade: quem chama põe a unidade do sinal). */
export function faixaBr(faixa: Faixa): string {
  return faixa.min === faixa.max
    ? numeroBr(faixa.min)
    : `${numeroBr(faixa.min)} a ${numeroBr(faixa.max)}`;
}

/** Zona de Kramer em algarismo romano, como nas evoluções reais (docs/analise-evolucoes.md, seção 2). */
export function zonaRomana(zona: ZonaKramer): string {
  return ["I", "II", "III", "IV", "V"][zona - 1]!;
}
