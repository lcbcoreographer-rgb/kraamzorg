import type { Papel } from "@/lib/auth/papeis";
import type {
  ClassificacaoContato,
  DestinoHandoff,
  EstadoSensivel,
  MotivoHandoff,
  Prioridade,
  ResumoConversa,
  StatusHandoff,
  Transferencia,
} from "@/lib/dados/tipos";

/**
 * Tipos do módulo do agente no CRM (P27, PRD 11.3, 11.4, 11.12 e 20.5).
 * Ficam aqui, e não em `src/lib/dados/tipos.ts`, porque esta sessão só
 * acrescenta dentro da própria pasta de módulo (ver retorno da sessão): a
 * interface `AgenteRepositorio` continua com os quatro métodos que a
 * fundação já construiu (listarConversas, mensagensDaConversa,
 * listarTransferencias, assumirTransferencia); o que falta mora em
 * `repositorio.ts`, com as mesmas regras de RLS/demonstração.
 */

/** Em que mão está a conversa (protótipo `comercial-conversas.html`, C5). */
export type SituacaoConversa = "isadora" | "equipe" | "pausada" | "nao_lead";

export interface PreviaMensagem {
  conteudo: string | null;
  enviadoPor: "cliente" | "ia" | "humano" | "sistema";
}

/** O que a lista mostra da transferência aberta de uma conversa. */
export interface ResumoTransferenciaAberta {
  motivo: MotivoHandoff;
  motivoRotulo: string;
  prioridade: Prioridade;
  status: StatusHandoff;
}

/**
 * Perda gestacional e estado sensível nunca em vermelho (DESIGN.md, seção
 * 8: "nunca vermelho para luto"). Usado onde a prioridade máxima decide
 * cor (fila de transferências, selo na lista de conversas).
 */
export const MOTIVOS_SENSIVEIS: readonly MotivoHandoff[] = [
  "perda",
  "estado_sensivel_escreveu",
];

/** Conversa com o texto de pausa (não exposto por `ResumoConversa`). */
export interface ConversaComPausa extends ResumoConversa {
  /** "Assumida por Otávio Lemos às 15:26." ou pausa manual; null sem pausa. */
  pausaMotivo: string | null;
  situacao: SituacaoConversa;
  ultimaMensagem: PreviaMensagem | null;
  /** Transferência aberta ou assumida desta conversa, se houver. */
  transferenciaAberta: ResumoTransferenciaAberta | null;
  /**
   * O freio da família dona da conversa (PRD 8.3). A lista de conversas
   * precisa saber disso para não convidar ninguém a "assumir" ou "pausar
   * a Isadora" numa família em bloqueio total (crítica do CRM, P0 item 3);
   * `"normal"` quando a conversa não tem família (contato solto).
   */
  estadoSensivel: EstadoSensivel;
}

/** Desfecho de "Marcar como resolvida" (fluxos.md, fluxo E). */
export type DesfechoTransferencia =
  | "formulario_enviado"
  | "sessao_marcada"
  | "condicao_negociada"
  | "sem_retorno";

export const ROTULO_DESFECHO: Record<DesfechoTransferencia, string> = {
  formulario_enviado: "Formulário enviado",
  sessao_marcada: "Sessão marcada",
  condicao_negociada: "Condição negociada",
  sem_retorno: "Sem retorno",
};

/** Categorias de "não lead" com mensagem de encaminhamento pronta (seed.sql). */
export type ClassificacaoNaoLead = Extract<
  ClassificacaoContato,
  "candidata" | "fornecedor" | "consultorio"
>;

export const ROTULO_NAO_LEAD: Record<ClassificacaoNaoLead, string> = {
  candidata: "Candidata a vaga",
  fornecedor: "Fornecedor ou parceria",
  consultorio: "Consultório ou outro número",
};

export const CHAVE_MENSAGEM_NAO_LEAD: Record<ClassificacaoNaoLead, string> = {
  candidata: "nao_lead_candidata",
  fornecedor: "nao_lead_fornecedor",
  consultorio: "nao_lead_consultorio",
};

export const ROTULO_MOTIVO_HANDOFF: Record<MotivoHandoff, string> = {
  contratar: "Quer contratar",
  reuniao: "Quer a conversa com a coordenação",
  condicao_comercial: "Pediu condição especial",
  cobertura_taxa: "Dúvida de área ou taxa",
  reembolso_fiscal: "Dúvida de reembolso ou nota",
  duvida_sem_resposta: "Pergunta sem resposta na base",
  pediu_humano: "Pediu para falar com uma pessoa",
  bebe_nasceu: "Bebê nasceu",
  pos_venda_operacao: "Dúvida de horário ou visita",
  saude: "Relato de saúde",
  perda: "Perda gestacional",
  reclamacao: "Reclamação",
  parceiro_medico: "Médico ou parceiro",
  estado_sensivel_escreveu: "Família em estado sensível escreveu",
  midia_recebida: "Mandou foto ou documento",
  validacao_resposta: "Resposta barrada pelo validador",
  audio_nao_transcrito: "Áudio não transcrito",
  outro: "Outra situação",
};

/** De quem é a transferência, em frase ("É do comercial"). */
export const FRASE_DESTINO_HANDOFF: Record<DestinoHandoff, string> = {
  comercial: "É do comercial",
  coordenacao_clinica: "É da coordenação clínica",
  operacao: "É da operação",
};

/**
 * De qual destino é cada papel, para o cartão de transferência saber se
 * quem está vendo pode assumir ou só ligar para quem pode (crítica do
 * CRM, P0 item 4). Papel sem destino próprio (financeiro, marketing,
 * diretoria) não entra: `undefined` deixa o cartão sempre oferecer
 * "Assumir conversa", como hoje.
 */
export const DESTINO_DO_PAPEL: Partial<Record<Papel, DestinoHandoff>> = {
  comercial: "comercial",
  coordenacao: "coordenacao_clinica",
};

/** Transferência com a hora de abertura, para desenhar a régua de SLA. */
export interface TransferenciaTela extends Transferencia {
  motivoRotulo: string;
  /**
   * PRD 11.7: a pausa da conversa venceu com a transferência ainda aberta,
   * e a Isadora voltou a responder. A fila mostra em vermelho.
   */
  pausaVenceu?: boolean;
}

// --- Modo do agente e regra de retomada (item 3, item 1 do P27) -----------

export type ModoAgente = "desligado" | "teste" | "producao";

export const ROTULO_MODO_AGENTE: Record<ModoAgente, string> = {
  desligado: "Desligada",
  teste: "Em teste",
  producao: "Em produção",
};

export interface ConfiguracaoAgente {
  modo: ModoAgente;
  /** E.164 (PRD 11.7: números autorizados a receber resposta em modo teste). */
  numerosTeste: string[];
  atualizadoEm: string | null;
}

export const JANELAS_RETOMADA_HORAS = [24, 36, 48, 72] as const;
export type JanelaRetomadaHoras = (typeof JANELAS_RETOMADA_HORAS)[number];

export interface RegraRetomada {
  /** null quando o papel não lê `parametro` (RLS: só a diretoria). */
  horas: number | null;
  atualizadoEm: string | null;
}

// --- Base de conhecimento (item 4) -----------------------------------------

export type TipoConteudoBase =
  | "institucional"
  | "faq"
  | "objecao"
  | "politica"
  | "depoimento"
  | "equipe"
  | "cobertura"
  | "plano";

export const ROTULO_TIPO_CONTEUDO: Record<TipoConteudoBase, string> = {
  institucional: "Institucional",
  faq: "Pergunta frequente",
  objecao: "Objeção",
  politica: "Política",
  depoimento: "Depoimento",
  equipe: "Equipe",
  cobertura: "Cobertura",
  plano: "Plano",
};

export type StatusConteudoBase = "rascunho" | "aprovado" | "arquivado";

export interface ItemBaseConhecimento {
  id: string;
  tipo: TipoConteudoBase;
  titulo: string;
  texto: string;
  fonte: string | null;
  status: StatusConteudoBase;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  atualizadoEm: string;
}

export interface PedidoItemBaseConhecimento {
  id?: string;
  tipo: TipoConteudoBase;
  titulo: string;
  texto: string;
  fonte?: string;
}

export interface UltimaIngestao {
  em: string;
  ok: boolean;
  itens: number;
  erro: string | null;
}

// --- Métricas (item 5, PRD 11.12) ------------------------------------------

export interface MetricasAgente {
  periodoDesde: string;
  periodoAte: string;
  tempoPrimeiraRespostaMinutos: number | null;
  leadsQueRespondemPct: number | null;
  qualificadosComValorEPdfPct: number | null;
  conversasComEdilaineRegistradasPct: number | null;
  followupAposPdfPct: number | null;
  conversaoLeadsPct: number | null;
  condicoesForaDaTabela: number;
  leadsTotal: number;
}
