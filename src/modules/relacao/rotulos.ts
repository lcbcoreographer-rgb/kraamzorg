import { ROTULO_ORIGEM_LEAD } from "@/modules/crm/pipeline/estagios";
import type {
  EspecialidadeMedico,
  EstadoCandidata,
  EstadoParceiro,
  OrigemLead,
} from "@/lib/dados/tipos-relacao";

/** Nome de cada origem de lead: os mesmos rótulos do pipeline e da ficha. */
export const ROTULO_ORIGEM: Record<OrigemLead, string> = ROTULO_ORIGEM_LEAD;

/** Origens que um canal de captação pode gravar (a desconhecida fica de fora). */
export const ORIGENS_DE_CANAL: OrigemLead[] = [
  "instagram_organico",
  "meta_ads",
  "google",
  "site",
  "evento",
  "outro",
];

export const ROTULO_ESPECIALIDADE: Record<EspecialidadeMedico, string> = {
  obstetra: "Obstetra",
  pediatra: "Pediatra",
  outro: "Outra especialidade",
};

export const ROTULO_ESTADO_PARCEIRO: Record<EstadoParceiro, string> = {
  prospeccao: "Em conversa inicial",
  ativo: "Parceiro ativo",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

export const ROTULO_ESTADO_CANDIDATA: Record<EstadoCandidata, string> = {
  nova: "Nova",
  em_triagem: "Em triagem",
  entrevista_agendada: "Entrevista agendada",
  entrevistada: "Entrevistada",
  aprovada: "Aprovada",
  banco_reserva: "Banco de reserva",
  nao_seguiu: "Não seguiu",
  desistiu: "Desistiu",
};

/** Nome da equipe (papel responsável) nas telas de tarefas. */
export const ROTULO_EQUIPE: Record<string, string> = {
  diretoria: "Diretoria",
  coordenacao: "Coordenação",
  comercial: "Comercial",
  financeiro: "Financeiro",
  marketing: "Marketing",
  enfermeira: "Enfermagem",
  sem_equipe: "Sem equipe definida",
};

export const ROTULO_PAPEL_ALVO: Record<string, string> = {
  comercial: "Comercial",
  enfermeira: "Enfermagem",
  financeiro: "Financeiro",
  marketing: "Marketing",
  coordenacao: "Coordenação",
  diretoria: "Diretoria",
};
