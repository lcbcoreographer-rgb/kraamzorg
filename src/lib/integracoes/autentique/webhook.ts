import type { DocumentoAutentique } from "./tipos";

/**
 * Regra do webhook (PRD 14, CLAUDE.md e P31 item 3): o corpo do POST nunca é
 * confiável (pode ser forjado); o app sempre reconsulta o documento pela API
 * da Autentique antes de mudar qualquer estado. O segredo no caminho
 * (`/api/webhooks/autentique/[segredo]`) é a primeira barreira; a reconsulta
 * é a segunda, mesmo que o segredo vaze.
 *
 * Esta função é pura em relação a rede e banco: recebe as dependências
 * (busca do documento, busca e gravação do contrato) já resolvidas, para
 * rodar em teste com "fetch interceptado" sem subir servidor nem banco
 * (CLAUDE.md, "integração com terceiro testada com respostas simuladas").
 */

export interface ContratoParaWebhookAutentique {
  id: string;
  status: string;
}

export interface DependenciasWebhookAutentique {
  segredoEsperado: string;
  buscarDocumento: (documentoId: string) => Promise<DocumentoAutentique>;
  buscarContratoPorDocumento: (
    documentoId: string,
  ) => Promise<ContratoParaWebhookAutentique | null>;
  marcarContratoAssinado: (
    contratoId: string,
    documento: DocumentoAutentique,
  ) => Promise<void>;
}

export interface WebhookAutentiqueEntrada {
  segredoRecebido: string;
  /** Corpo bruto do POST, nunca confiável: só serve para achar o id do
   * documento e disparar a reconsulta. */
  corpo: unknown;
}

export type MotivoResultadoWebhookAutentique =
  | "segredo_invalido"
  | "sem_id_documento"
  | "contrato_nao_encontrado"
  | "documento_nao_concluido"
  | "ja_assinado"
  | "assinado";

export interface ResultadoWebhookAutentique {
  status: 200 | 400 | 404;
  mudouEstado: boolean;
  motivo: MotivoResultadoWebhookAutentique;
}

/** [conferir] Formato exato do payload do webhook "documento finalizado" da
 * Autentique (configurado no painel, PRD 14); aceita as formas mais comuns
 * (`document.id`, `data.document.id`, `id`) e nunca lê status do corpo. */
export function extrairDocumentoId(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const objeto = corpo as Record<string, unknown>;

  const doc = objeto.document;
  if (
    doc &&
    typeof doc === "object" &&
    typeof (doc as { id?: unknown }).id === "string"
  ) {
    return (doc as { id: string }).id;
  }

  const dado = objeto.data;
  if (dado && typeof dado === "object") {
    const docAninhado = (dado as Record<string, unknown>).document;
    if (
      docAninhado &&
      typeof docAninhado === "object" &&
      typeof (docAninhado as { id?: unknown }).id === "string"
    ) {
      return (docAninhado as { id: string }).id;
    }
  }

  if (typeof objeto.id === "string") return objeto.id;

  return null;
}

export async function processarWebhookAutentique(
  entrada: WebhookAutentiqueEntrada,
  dependencias: DependenciasWebhookAutentique,
): Promise<ResultadoWebhookAutentique> {
  if (entrada.segredoRecebido !== dependencias.segredoEsperado) {
    return { status: 404, mudouEstado: false, motivo: "segredo_invalido" };
  }

  const documentoId = extrairDocumentoId(entrada.corpo);
  if (!documentoId) {
    return { status: 400, mudouEstado: false, motivo: "sem_id_documento" };
  }

  const contrato = await dependencias.buscarContratoPorDocumento(documentoId);
  if (!contrato) {
    return {
      status: 200,
      mudouEstado: false,
      motivo: "contrato_nao_encontrado",
    };
  }

  // Reconsulta pela API antes de mudar qualquer estado: o corpo do webhook
  // nunca decide sozinho, mesmo que diga "concluído".
  const documento = await dependencias.buscarDocumento(documentoId);

  if (!documento.concluido) {
    return {
      status: 200,
      mudouEstado: false,
      motivo: "documento_nao_concluido",
    };
  }

  if (contrato.status === "assinado") {
    // Idempotente: webhook duplicado não gera segunda gravação.
    return { status: 200, mudouEstado: false, motivo: "ja_assinado" };
  }

  await dependencias.marcarContratoAssinado(contrato.id, documento);
  return { status: 200, mudouEstado: true, motivo: "assinado" };
}
