import type { ResumoConversa } from "@/lib/dados/tipos";
import type { ConversaComPausa, SituacaoConversa } from "./tipos";

/**
 * Em que mão está a conversa (protótipo `comercial-conversas.html`, C5;
 * espelha exatamente o filtro que `AgenteRepositorio.listarConversas` já
 * aplica em `situacao`, para a tela calcular o selo sem pedir de novo ao
 * banco por filtro).
 */
export function situacaoDaConversa(
  conversa: Pick<ResumoConversa, "classificacao" | "agenteEncerradoEm" | "agentePausadoAte">,
  agora: Date = new Date(),
): SituacaoConversa {
  const ehLead = ["lead", "cliente", "nao_classificado"].includes(conversa.classificacao);
  if (!ehLead) return "nao_lead";
  if (conversa.agenteEncerradoEm) return "equipe";
  if (conversa.agentePausadoAte && conversa.agentePausadoAte > agora.toISOString()) {
    return "pausada";
  }
  return "isadora";
}

export function paraConversaComPausa(
  conversa: ResumoConversa,
  pausaMotivo: string | null,
  ultimaMensagem: ConversaComPausa["ultimaMensagem"],
  agora: Date = new Date(),
): ConversaComPausa {
  return {
    ...conversa,
    pausaMotivo,
    situacao: situacaoDaConversa(conversa, agora),
    ultimaMensagem,
  };
}

export const ROTULO_SITUACAO: Record<SituacaoConversa, string> = {
  isadora: "Isadora conduzindo",
  equipe: "Com a equipe",
  pausada: "Pausada",
  nao_lead: "Não lead",
};

export const TITULO_FILTRO: Record<"todas" | SituacaoConversa, string> = {
  todas: "Todas",
  isadora: "Isadora conduzindo",
  equipe: "Com a equipe",
  pausada: "Pausadas",
  nao_lead: "Não lead",
};

/** Primeiro nome, para textos como "Escreva para Bianca". */
export function primeiroNome(nome: string | null): string {
  if (!nome) return "a família";
  return nome.trim().split(/\s+/)[0] ?? nome;
}
