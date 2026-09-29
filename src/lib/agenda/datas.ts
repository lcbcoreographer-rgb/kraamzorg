/**
 * Datas de calendário ("aaaa-mm-dd") e horas ("HH:MM") da agenda e do
 * portal, no fuso da operação (America/Sao_Paulo, sem horário de verão
 * desde 2019). Tudo por partes, sem `new Date("aaaa-mm-dd")`, que é meia-noite
 * UTC e volta um dia em Brasília.
 */
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^(\d{2}):(\d{2})(?::\d{2})?$/;

export function diasDesdeEpoch(data: string): number {
  const partes = DATA.exec(data);
  if (!partes) throw new Error(`data inválida: ${data}`);
  const [, ano, mes, dia] = partes;
  return Math.round(
    Date.UTC(Number(ano), Number(mes) - 1, Number(dia)) / 86_400_000,
  );
}

export function dataDeDiasEpoch(dias: number): string {
  const d = new Date(dias * 86_400_000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export function somarDias(data: string, dias: number): string {
  return dataDeDiasEpoch(diasDesdeEpoch(data) + dias);
}

/** Dias de `de` até `ate` (positivo quando `ate` vem depois). */
export function diferencaEmDias(de: string, ate: string): number {
  return diasDesdeEpoch(ate) - diasDesdeEpoch(de);
}

/** 0 = segunda ... 6 = domingo (a semana da agenda começa na segunda). */
export function diaDaSemanaDesdeSegunda(data: string): number {
  // 1970-01-01 foi quinta-feira
  return (((diasDesdeEpoch(data) + 3) % 7) + 7) % 7;
}

export function inicioDaSemana(data: string): string {
  return somarDias(data, -diaDaSemanaDesdeSegunda(data));
}

export function eDataValida(valor: string): boolean {
  const partes = DATA.exec(valor);
  if (!partes) return false;
  const [, ano, mes, dia] = partes;
  const d = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  return (
    d.getUTCFullYear() === Number(ano) &&
    d.getUTCMonth() === Number(mes) - 1 &&
    d.getUTCDate() === Number(dia)
  );
}

/** "aaaa-mm-dd" de hoje em Brasília. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
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

/** Minutos desde a meia-noite de "HH:MM" (ou "HH:MM:SS"); null se inválida. */
export function minutosDaHora(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const partes = HORA.exec(hora);
  if (!partes) return null;
  const h = Number(partes[1]);
  const m = Number(partes[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** "08:00" a partir de "08:00:00" ou "08:00". */
export function horaCurta(hora: string | null | undefined): string | null {
  const minutos = minutosDaHora(hora);
  if (minutos === null) return null;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** "08:07" de um instante, em Brasília. */
export function horaEmBrasilia(instante: string | Date): string | null {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  if (Number.isNaN(d.getTime())) return null;
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("hour")}:${valor("minute")}`;
}

/** Data de calendário, em Brasília, de um instante. */
export function dataEmBrasilia(instante: string | Date): string | null {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  if (Number.isNaN(d.getTime())) return null;
  return hojeEmBrasilia(d);
}

/** Instante ISO de uma data e hora de Brasília (deslocamento fixo de -03:00). */
export function instanteEmBrasilia(data: string, hora: string): string | null {
  const minutos = minutosDaHora(hora);
  if (!eDataValida(data) || minutos === null) return null;
  const instante = new Date(`${data}T${horaCurta(hora)}:00-03:00`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}
