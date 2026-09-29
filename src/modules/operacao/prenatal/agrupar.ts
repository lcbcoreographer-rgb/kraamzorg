import type { ConsultaPrenatalResumo } from "@/lib/dados/tipos-operacao";

/**
 * Como a lista de Pré-natal se organiza: o que exige ação primeiro. Urgente
 * (pagamento com mais de 34 semanas) vem antes de tudo e não some por já
 * estar agendada; depois, o que ainda não tem data, o que já está marcado ou
 * em andamento e, por último, o que foi concluído.
 */
export interface ConsultasAgrupadas {
  urgentes: ConsultaPrenatalResumo[];
  paraAgendar: ConsultaPrenatalResumo[];
  agendadas: ConsultaPrenatalResumo[];
  concluidas: ConsultaPrenatalResumo[];
}

export function agruparConsultas(
  consultas: ConsultaPrenatalResumo[],
): ConsultasAgrupadas {
  const grupos: ConsultasAgrupadas = {
    urgentes: [],
    paraAgendar: [],
    agendadas: [],
    concluidas: [],
  };
  for (const c of consultas) {
    if (c.status === "realizada") grupos.concluidas.push(c);
    else if (c.urgente) grupos.urgentes.push(c);
    else if (c.status === "pendente") grupos.paraAgendar.push(c);
    else if (c.status === "agendada") grupos.agendadas.push(c);
  }
  const porData = (a: ConsultaPrenatalResumo, b: ConsultaPrenatalResumo) =>
    (a.agendadaPara ?? "9").localeCompare(b.agendadaPara ?? "9") ||
    a.nome.localeCompare(b.nome);
  grupos.agendadas.sort(porData);
  grupos.urgentes.sort(porData);
  grupos.concluidas.sort((a, b) =>
    (b.realizadaEm ?? "").localeCompare(a.realizadaEm ?? ""),
  );
  return grupos;
}

/** Quem já chegou às semanas do alerta interno (só a coordenação vê a lista). */
export function quemChegouAoAlerta(
  consultas: ConsultaPrenatalResumo[],
): ConsultaPrenatalResumo[] {
  return consultas.filter((c) => c.chegouAlerta && c.status !== "realizada");
}

/** "Etapa 4 de 8, parou em 24/09/2026, 19:40" ou "Não iniciada". */
export function frasePorOndeParou(
  c: Pick<
    ConsultaPrenatalResumo,
    "etapa" | "parouEm" | "iniciadaEm" | "status"
  >,
  totalEtapas: number,
  formatarDataHora: (valor: string) => string | null,
): string {
  if (c.status === "realizada") return "Entrevista concluída";
  if (!c.iniciadaEm && !c.etapa) return "Entrevista não iniciada";
  const quando = c.parouEm ? formatarDataHora(c.parouEm) : null;
  return c.etapa
    ? `Etapa ${c.etapa} de ${totalEtapas}${quando ? `, parou em ${quando}` : ""}`
    : "Entrevista em andamento";
}
