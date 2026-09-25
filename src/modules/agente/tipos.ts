import type {
  ClassificacaoContato,
  DestinoHandoff,
  MotivoHandoff,
  ResumoConversa,
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

/** Conversa com o texto de pausa (não exposto por `ResumoConversa`). */
export interface ConversaComPausa extends ResumoConversa {
  /** "Assumida por Otávio Lemos às 15:26." ou pausa manual; null sem pausa. */
  pausaMotivo: string | null;
  situacao: SituacaoConversa;
  ultimaMensagem: PreviaMensagem | null;
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

export const ROTULO_DESTINO_HANDOFF: Record<DestinoHandoff, string> = {
  comercial: "comercial",
  coordenacao_clinica: "coordenação clínica",
  operacao: "operação",
};

/** Transferência com a hora de abertura, para desenhar a régua de SLA. */
export interface TransferenciaTela extends Transferencia {
  motivoRotulo: string;
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
  horas: number;
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
