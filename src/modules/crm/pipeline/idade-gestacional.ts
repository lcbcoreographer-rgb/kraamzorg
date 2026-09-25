import { formatarData, formatarIdadeGestacional } from "@/lib/formatacao";

/**
 * Idade gestacional nunca é gravada (PRD 6.10 regra 7): o banco calcula com
 * `ig(dpp, data) = (data − (dpp − 280 dias))`, em semanas e dias. Aqui é a
 * mesma conta do lado da tela, para o cartão do pipeline e os filtros de
 * semana, sem gravar nada. `dpp` e `referencia` são datas de calendário
 * ("aaaa-mm-dd"), tratadas por partes para não sofrer o desvio de fuso de
 * `new Date("aaaa-mm-dd")` (meia-noite UTC).
 */
const DATA_SIMPLES = /^(\d{4})-(\d{2})-(\d{2})$/;

function paraDiasEpoch(data: string): number | null {
  const partes = DATA_SIMPLES.exec(data);
  if (!partes) return null;
  const [, ano, mes, dia] = partes;
  const ms = Date.UTC(Number(ano), Number(mes) - 1, Number(dia));
  return Math.round(ms / 86_400_000);
}

export interface IdadeGestacional {
  semanas: number;
  dias: number;
}

/** null quando `dpp` está vazia ou não é uma data de calendário válida. */
export function calcularIdadeGestacional(
  dpp: string | null,
  referencia: string,
): IdadeGestacional | null {
  if (!dpp) return null;
  const diasDpp = paraDiasEpoch(dpp);
  const diasReferencia = paraDiasEpoch(referencia);
  if (diasDpp === null || diasReferencia === null) return null;

  const diasGestacao = diasReferencia - (diasDpp - 280);
  if (diasGestacao < 0) return null;

  return {
    semanas: Math.trunc(diasGestacao / 7),
    dias: diasGestacao % 7,
  };
}

/**
 * "38s2d" pronto para o cartão, ou o texto certo quando a conta de
 * semanas não faz mais sentido (crítica do CRM, P1 item 6): depois do
 * nascimento, "Nasceu em 16/08"; sem nascimento e com a DPP já passada
 * (a conta de `calcularIdadeGestacional` some depois de 40 semanas),
 * "DPP passou há N dias". `null` só quando não há DPP nem nascimento.
 */
export function textoIdadeGestacional(
  dpp: string | null,
  referencia: string,
  dataNascimento: string | null = null,
): string | null {
  if (dataNascimento) {
    const data = formatarData(dataNascimento);
    return data ? `Nasceu em ${data.slice(0, 5)}` : null;
  }

  const ig = calcularIdadeGestacional(dpp, referencia);
  // Além de 42 semanas sem nascimento registrado, a semana deixa de dizer
  // algo real (a gestação não continua contando para sempre): o prazo
  // passou, e é isso que a tela mostra.
  if (ig && ig.semanas <= 42) return formatarIdadeGestacional(ig.semanas, ig.dias);

  if (dpp) {
    const diasDpp = paraDiasEpoch(dpp);
    const diasReferencia = paraDiasEpoch(referencia);
    if (diasDpp !== null && diasReferencia !== null && diasReferencia > diasDpp) {
      const diasPassados = diasReferencia - diasDpp;
      return `DPP passou há ${diasPassados} ${diasPassados === 1 ? "dia" : "dias"}`;
    }
  }

  return null;
}

/** Data de calendário de hoje em Brasília ("aaaa-mm-dd"), sem hora. */
export function hojeBrasilia(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/** "Há 5 dias" / "Hoje" a partir de um instante ISO (aproximação por `atualizadoEm`). */
export function haQuantoTempo(
  instanteIso: string,
  agora: Date = new Date(),
): string {
  const instante = new Date(instanteIso);
  if (Number.isNaN(instante.getTime())) return "";
  const diasMs = agora.getTime() - instante.getTime();
  const dias = Math.floor(diasMs / 86_400_000);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Há 1 dia";
  return `Há ${dias} dias`;
}
