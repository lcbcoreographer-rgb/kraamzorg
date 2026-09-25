import { createHash, timingSafeEqual } from "node:crypto";
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
  /** Grava a assinatura só se o contrato ainda não estiver assinado
   * (atualização condicional no banco) e devolve se alguma linha mudou.
   * Dois webhooks simultâneos nunca gravam duas vezes. Falha de banco
   * lança erro, para a rota responder 500 e a Autentique tentar de novo. */
  marcarContratoAssinado: (
    contratoId: string,
    documento: DocumentoAutentique,
  ) => Promise<boolean>;
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

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : null;
}

function idDe(valor: unknown): string | null {
  const objeto = comoObjeto(valor);
  return objeto && typeof objeto.id === "string" && objeto.id.length > 0
    ? objeto.id
    : null;
}

/**
 * Acha o id do documento no corpo do webhook. Formato da API v2 (conferido
 * em capturas públicas de `document.finished`): `{ event: { type, data: {
 * id, ... } } }`, em que `event.data` é o documento; em eventos de
 * assinatura, `event.data.document` traz o documento. O `id` da raiz é o do
 * próprio webhook, nunca o do documento, e por isso não é lido. Nunca lê
 * status do corpo: o estado vem só da reconsulta.
 * [conferir] reconfirmar com um disparo real no painel de homologação.
 */
export function extrairDocumentoId(corpo: unknown): string | null {
  const raiz = comoObjeto(corpo);
  if (!raiz) return null;

  const dadoEvento = comoObjeto(comoObjeto(raiz.event)?.data);
  if (dadoEvento) {
    const doDocumentoAninhado = idDe(dadoEvento.document);
    if (doDocumentoAninhado) return doDocumentoAninhado;
    if (typeof dadoEvento.document === "string" && dadoEvento.document) {
      return dadoEvento.document;
    }
    const doEvento = idDe(dadoEvento);
    if (doEvento) return doEvento;
  }

  return idDe(raiz.document);
}

/** Comparação em tempo constante (resumo SHA-256 dos dois lados, para
 * igualar o tamanho), para o segredo do caminho não vazar por tempo de
 * resposta. */
export function segredoConfere(recebido: string, esperado: string): boolean {
  if (!esperado) return false;
  const a = createHash("sha256").update(recebido, "utf8").digest();
  const b = createHash("sha256").update(esperado, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function processarWebhookAutentique(
  entrada: WebhookAutentiqueEntrada,
  dependencias: DependenciasWebhookAutentique,
): Promise<ResultadoWebhookAutentique> {
  if (!segredoConfere(entrada.segredoRecebido, dependencias.segredoEsperado)) {
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

  const mudou = await dependencias.marcarContratoAssinado(
    contrato.id,
    documento,
  );
  if (!mudou) {
    return { status: 200, mudouEstado: false, motivo: "ja_assinado" };
  }
  return { status: 200, mudouEstado: true, motivo: "assinado" };
}
