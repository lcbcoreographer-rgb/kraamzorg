import type {
  PapelDesignacao,
  PeriodoVisita,
  StatusConsulta,
  StatusDesignacao,
} from "@/lib/dados/tipos-operacao";

/** Rótulos de tela da operação. Sem travessão, sem meia-risca. */

export const ROTULO_PERIODO: Record<PeriodoVisita, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite_avaliar: "Noite (a avaliar)",
};

export const ROTULO_PAPEL_DESIGNACAO: Record<PapelDesignacao, string> = {
  titular: "Titular",
  backup: "Backup",
};

export const ROTULO_STATUS_DESIGNACAO: Record<StatusDesignacao, string> = {
  oferecida: "Oferta sem resposta",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Prazo vencido",
  cancelada: "Cancelada",
};

export const ROTULO_STATUS_CONSULTA: Record<StatusConsulta, string> = {
  pendente: "Para agendar",
  agendada: "Agendada",
  realizada: "Concluída",
  nao_realizada: "Não realizada",
  cancelada: "Cancelada",
};

export const ROTULO_ESTADO_ENFERMEIRA: Record<string, string> = {
  em_visita: "Em visita",
  em_atendimento: "Em atendimento",
  reservada: "Reservada",
  backup: "Backup",
  oferta_pendente: "Oferta pendente",
  folga: "Folga ou bloqueio",
  livre: "Livre",
};

/** "3 dias" / "hoje" / "amanhã" / "há 2 dias" a partir de dias até a data. */
export function fraseDias(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}

export const ROTULO_ESTADO_VISITA: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  a_caminho: "A caminho",
  iniciada: "Em andamento",
  concluida: "Concluída",
  ficha_pendente: "Ficha pendente",
  ficha_entregue: "Ficha entregue",
  encerrada: "Encerrada",
  reagendada: "Reagendada",
  cancelada: "Cancelada",
  nao_realizada_familia: "Não realizada (família)",
  nao_realizada_profissional: "Não realizada (profissional)",
};
