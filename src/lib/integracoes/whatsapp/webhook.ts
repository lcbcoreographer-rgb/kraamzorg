import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook da Cloud API do WhatsApp (P18b item 4, PRD 14). Funções puras: a
 * rota `/api/webhooks/whatsapp` só liga estas ao banco.
 *
 * A Meta assina o corpo bruto com HMAC-SHA256 no cabeçalho
 * `X-Hub-Signature-256: sha256=<hex>`, usando o segredo do aplicativo. Sem a
 * assinatura certa, nada é lido. Da carga só saem o id da mensagem
 * (`wamid`), o estado, a hora e o NÚMERO do erro: nem o telefone do
 * destinatário (`recipient_id`) nem o texto do erro entram no que o resto do
 * sistema vê.
 */

/** Compara duas cadeias em tempo constante, sem vazar o tamanho. */
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function assinaturaValida(
  corpoBruto: string,
  cabecalho: string | null,
  segredoApp: string | undefined,
): boolean {
  if (!segredoApp || !cabecalho) return false;
  const esperado = `sha256=${createHmac("sha256", segredoApp).update(corpoBruto).digest("hex")}`;
  return iguaisEmTempoConstante(esperado, cabecalho);
}

/** Resposta ao desafio de inscrição do webhook (`hub.*`). Nulo se não confere. */
export function responderDesafio(
  parametros: URLSearchParams,
  tokenEsperado: string | undefined,
): string | null {
  if (!tokenEsperado) return null;
  if (parametros.get("hub.mode") !== "subscribe") return null;
  const recebido = parametros.get("hub.verify_token");
  const desafio = parametros.get("hub.challenge");
  if (!recebido || !desafio) return null;
  return iguaisEmTempoConstante(recebido, tokenEsperado) ? desafio : null;
}

export interface StatusEntrega {
  waMessageId: string;
  /** Como a Meta escreve: sent, delivered, read, failed. */
  status: string;
  ocorridoEm: string | null;
  /** Só o número do erro da Meta, quando houver. */
  codigoErro: string | null;
}

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Tira da carga os estados de entrega. Formato inesperado dá lista vazia. */
export function extrairStatus(carga: unknown): StatusEntrega[] {
  const raiz = objeto(carga);
  if (!raiz || !Array.isArray(raiz.entry)) return [];
  const saida: StatusEntrega[] = [];
  for (const entrada of raiz.entry) {
    const e = objeto(entrada);
    if (!e || !Array.isArray(e.changes)) continue;
    for (const mudanca of e.changes) {
      const valor = objeto(objeto(mudanca)?.value);
      if (!valor || !Array.isArray(valor.statuses)) continue;
      for (const item of valor.statuses) {
        const s = objeto(item);
        if (!s || typeof s.id !== "string" || typeof s.status !== "string") {
          continue;
        }
        const primeiroErro = Array.isArray(s.errors)
          ? objeto(s.errors[0])
          : null;
        const codigo = primeiroErro?.code;
        const segundos = Number(s.timestamp);
        saida.push({
          waMessageId: s.id,
          status: s.status,
          ocorridoEm:
            Number.isFinite(segundos) && segundos > 0
              ? new Date(segundos * 1000).toISOString()
              : null,
          codigoErro:
            typeof codigo === "number" || typeof codigo === "string"
              ? String(codigo)
              : null,
        });
      }
    }
  }
  return saida;
}
