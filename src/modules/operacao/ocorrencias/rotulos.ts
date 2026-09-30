import type {
  PrioridadeOcorrencia,
  StatusOcorrencia,
  TipoOcorrencia,
} from "@/lib/dados/tipos-ocorrencia";

/**
 * Rótulos das ocorrências (P42, PRD 6.6). Texto de interface, revisado contra
 * docs/design/voz.md: a palavra "detrator" fica nas telas agregadas de NPS;
 * aqui a ocorrência que nasce de nota baixa se chama pelo que aconteceu.
 */

export type VarianteSelo =
  "neutro" | "sucesso" | "aviso" | "alerta" | "sensivel" | "destaque";

export const TIPOS: readonly TipoOcorrencia[] = [
  "intercorrencia",
  "contato_perdido",
  "registro_atrasado",
  "capacidade",
  "experiencia",
  "reclamacao",
  "detrator",
  "outro",
];

export const ROTULO_TIPO: Record<TipoOcorrencia, string> = {
  intercorrencia: "Intercorrência",
  contato_perdido: "Contato perdido",
  registro_atrasado: "Registro atrasado",
  capacidade: "Capacidade da equipe",
  experiencia: "Experiência da família",
  reclamacao: "Reclamação",
  detrator: "Pesquisa com nota baixa",
  outro: "Outro assunto",
};

export const PRIORIDADES: readonly PrioridadeOcorrencia[] = [
  "normal",
  "alta",
  "maxima",
];

export const ROTULO_PRIORIDADE: Record<PrioridadeOcorrencia, string> = {
  normal: "Prioridade normal",
  alta: "Prioridade alta",
  maxima: "Prioridade máxima",
};

export const VARIANTE_PRIORIDADE: Record<PrioridadeOcorrencia, VarianteSelo> = {
  normal: "neutro",
  alta: "aviso",
  maxima: "alerta",
};

export const ORDEM_STATUS: readonly StatusOcorrencia[] = [
  "aberta",
  "triagem",
  "responsavel_definido",
  "em_acompanhamento",
  "resolvida",
  "encerrada",
];

export const ROTULO_STATUS: Record<StatusOcorrencia, string> = {
  aberta: "Aberta",
  triagem: "Em triagem",
  responsavel_definido: "Com responsável",
  em_acompanhamento: "Em acompanhamento",
  resolvida: "Resolvida",
  encerrada: "Encerrada",
};

export const VARIANTE_STATUS: Record<StatusOcorrencia, VarianteSelo> = {
  aberta: "aviso",
  triagem: "aviso",
  responsavel_definido: "neutro",
  em_acompanhamento: "neutro",
  resolvida: "sucesso",
  encerrada: "sucesso",
};

/** Verbo do botão que leva a ocorrência ao próximo passo (voz.md 2, item 6). */
export const ACAO_STATUS: Record<StatusOcorrencia, string> = {
  aberta: "Reabrir",
  triagem: "Passar para triagem",
  responsavel_definido: "Marcar com responsável",
  em_acompanhamento: "Iniciar o acompanhamento",
  resolvida: "Marcar como resolvida",
  encerrada: "Encerrar a ocorrência",
};

/**
 * Passos que o banco aceita a partir de um status: só para frente, com a volta
 * de "resolvida" para "em acompanhamento" (0024, api.atualizar_ocorrencia).
 */
export function proximosStatus(atual: StatusOcorrencia): StatusOcorrencia[] {
  if (atual === "encerrada") return [];
  const indice = ORDEM_STATUS.indexOf(atual);
  const adiante = ORDEM_STATUS.slice(indice + 1);
  return atual === "resolvida" ? ["em_acompanhamento", ...adiante] : adiante;
}

/** Status que o banco só aceita com nota de pelo menos 10 letras. */
export const STATUS_COM_NOTA: readonly StatusOcorrencia[] = [
  "resolvida",
  "encerrada",
];
