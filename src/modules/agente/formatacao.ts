import type { ResumoConversa } from "@/lib/dados/tipos";
import type { ConversaComPausa, SituacaoConversa } from "./tipos";

/**
 * Em que mão está a conversa (protótipo `comercial-conversas.html`, C5;
 * espelha exatamente o filtro que `AgenteRepositorio.listarConversas` já
 * aplica em `situacao`, para a tela calcular o selo sem pedir de novo ao
 * banco por filtro).
 */
export function situacaoDaConversa(
  conversa: Pick<
    ResumoConversa,
    "classificacao" | "agenteEncerradoEm" | "agentePausadoAte"
  >,
  agora: Date = new Date(),
): SituacaoConversa {
  const ehLead = ["lead", "cliente", "nao_classificado"].includes(
    conversa.classificacao,
  );
  if (!ehLead) return "nao_lead";
  if (conversa.agenteEncerradoEm) return "equipe";
  // Comparação por instante, não por string: o Supabase pode devolver
  // timestamptz com deslocamento numérico ("+00:00") em vez de "Z", e a
  // ordem lexical dos dois formatos não bate com a ordem cronológica.
  if (
    conversa.agentePausadoAte &&
    new Date(conversa.agentePausadoAte).getTime() > agora.getTime()
  ) {
    return "pausada";
  }
  return "isadora";
}

export function paraConversaComPausa(
  conversa: ResumoConversa,
  pausaMotivo: string | null,
  ultimaMensagem: ConversaComPausa["ultimaMensagem"],
  agora: Date = new Date(),
  transferenciaAberta: ConversaComPausa["transferenciaAberta"] = null,
  estadoSensivel: ConversaComPausa["estadoSensivel"] = "normal",
): ConversaComPausa {
  return {
    ...conversa,
    pausaMotivo,
    situacao: situacaoDaConversa(conversa, agora),
    ultimaMensagem,
    transferenciaAberta,
    estadoSensivel,
  };
}

/**
 * Transferência aberta cuja pausa já venceu (PRD 11.7, modo `pausado`: "se
 * o handoff continuar aberto quando a pausa vencer, o CRM mostra em
 * vermelho e a Isadora volta a responder"). Não vale para
 * `humano_comercial`, que não vence por prazo.
 */
export function pausaVenceuComTransferenciaAberta(
  conversa: Pick<ResumoConversa, "agentePausadoAte" | "agenteEncerradoEm">,
  transferenciaAberta: boolean,
  agora: Date = new Date(),
): boolean {
  if (!transferenciaAberta || conversa.agenteEncerradoEm) return false;
  if (!conversa.agentePausadoAte) return false;
  return new Date(conversa.agentePausadoAte).getTime() <= agora.getTime();
}

export type EstadoPrazo = "vencido" | "perto" | "normal";

/**
 * Cor do prazo (fluxos.md, fluxo E, "Prazos"): aviso quando falta menos de
 * 25% da janela entre a abertura e o vencimento; alerta quando vence.
 * Proporção da janela, e não minutos fixos, porque o SLA vai de "imediato"
 * a "1 dia" conforme o motivo (PRD 11.4).
 */
export function estadoPrazo(
  criadoEm: string,
  slaVenceEm: string | null,
  agora: Date,
): EstadoPrazo {
  if (!slaVenceEm) return "normal";
  const vence = new Date(slaVenceEm).getTime();
  if (Number.isNaN(vence)) return "normal";
  if (vence <= agora.getTime()) return "vencido";
  const inicio = new Date(criadoEm).getTime();
  const janela = vence - inicio;
  if (!Number.isFinite(janela) || janela <= 0) return "perto";
  return (vence - agora.getTime()) / janela < 0.25 ? "perto" : "normal";
}

/** "18:00" no fuso de Brasília; vazio para data inválida. */
export function horaBrasilia(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(data);
}

/**
 * Quando a pausa termina, em frase: "volta às 18:00" no mesmo dia,
 * "volta em 26/09 às 09:00" em outro dia (telas.md C5, "volta às 18:00").
 */
export function textoVoltaDaPausa(
  iso: string | null,
  agora: Date = new Date(),
): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  const dia = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
    }).format(d);
  const hora = horaBrasilia(iso);
  return dia(data) === dia(agora)
    ? `volta às ${hora}`
    : `volta em ${dia(data)} às ${hora}`;
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
  const primeiro = nome.trim().split(/\s+/)[0] ?? nome;
  // "Família Teste Aurora" não é nome de pessoa: "Escreva para Família"
  // soaria estranho. Nesse caso, a frase fala da família.
  if (!primeiro || /^fam[ií]lia$/i.test(primeiro) || primeiro.startsWith("+"))
    return "a família";
  return primeiro;
}
