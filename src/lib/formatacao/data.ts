/**
 * Datas do banco chegam como `date` (calendário, sem hora) ou `timestamptz`
 * (fuso America/Sao_Paulo, PRD 5). Aqui só formata; nenhum cálculo de data
 * de negócio mora neste arquivo.
 *
 * Uma string "aaaa-mm-dd" (coluna `date`) é reescrita direto, sem passar por
 * `Date`: `new Date("aaaa-mm-dd")` é meia-noite UTC, e convertida para
 * America/Sao_Paulo (UTC-3) volta um dia. Uma string com hora, ou um
 * `Date`, é tratada como instante e convertida para o fuso de Brasília.
 */
const DATA_SIMPLES = /^\d{4}-\d{2}-\d{2}$/;

function paraDate(valor: string | Date): Date {
  return typeof valor === "string" ? new Date(valor) : valor;
}

function partesEmBrasilia(
  data: Date,
  comHora: boolean,
): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(comHora
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
  }).formatToParts(data);
}

function parte(partes: Intl.DateTimeFormatPart[], tipo: string): string {
  return partes.find((p) => p.type === tipo)?.value ?? "";
}

/**
 * "24/09/2026" a partir de uma data de calendário ou de um instante.
 * Devolve `null` quando `valor` não é uma data válida: "Data inválida" é
 * texto de interface, e este arquivo só formata, não decide o que a tela
 * mostra no lugar (CLAUDE.md, "nenhum texto de negócio no código").
 */
export function formatarData(valor: string | Date): string | null {
  if (typeof valor === "string" && DATA_SIMPLES.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  const data = paraDate(valor);
  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const partes = partesEmBrasilia(data, false);
  return `${parte(partes, "day")}/${parte(partes, "month")}/${parte(partes, "year")}`;
}

/**
 * "24/09/2026, 09:14" (PRD 20.4, cabeçalho da família), fuso de Brasília.
 * Devolve `null` para instante inválido, pelo mesmo motivo de `formatarData`.
 */
export function formatarDataHora(valor: string | Date): string | null {
  const data = paraDate(valor);
  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const partes = partesEmBrasilia(data, true);
  const dia = parte(partes, "day");
  const mes = parte(partes, "month");
  const ano = parte(partes, "year");
  const hora = parte(partes, "hour");
  const minuto = parte(partes, "minute");
  return `${dia}/${mes}/${ano}, ${hora}:${minuto}`;
}

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

/**
 * "Quinta, 24/09" (protótipo `comercial-inicio.html`, frase-resumo do
 * Início). O dia da semana é o de Brasília (CLAUDE.md), não o do fuso do
 * servidor. Devolve `null` para instante inválido, pelo mesmo motivo de
 * `formatarData`.
 */
export function formatarDiaSemanaEData(valor: string | Date): string | null {
  const data = paraDate(valor);
  if (Number.isNaN(data.getTime())) {
    return null;
  }
  const diaSemana = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(data);
  const indice = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    diaSemana,
  );
  const partes = partesEmBrasilia(data, false);
  const dia = parte(partes, "day");
  const mes = parte(partes, "month");
  return indice >= 0 ? `${DIAS_SEMANA[indice]}, ${dia}/${mes}` : null;
}
