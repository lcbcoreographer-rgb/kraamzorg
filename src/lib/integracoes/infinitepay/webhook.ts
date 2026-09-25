import type { ResultadoPaymentCheck } from "./tipos";

/**
 * Regra do webhook (PRD 14, P32 item 2): o webhook da InfinitePay não é
 * assinado, então o corpo nunca é confiável. Antes de qualquer baixa, o app
 * confirma com `payment_check`. A função é idempotente (webhook duplicado
 * não baixa duas vezes) e devolve rápido (nenhum trabalho pesado síncrono).
 *
 * Pura em relação a rede e banco, como `autentique/webhook.ts`: recebe as
 * dependências já resolvidas, testável com "fetch interceptado".
 */

export interface CobrancaParaWebhookInfinitePay {
  id: string;
  status: string;
}

export interface DadosBaixaCobranca {
  valorPagoCentavos: number;
  parcelas: number | null;
  metodoCaptura: string | null;
  transactionNsu: string | null;
  invoiceSlug: string | null;
  reciboUrl: string | null;
}

export interface DependenciasWebhookInfinitePay {
  buscarCobrancaPorOrderNsu: (
    orderNsu: string,
  ) => Promise<CobrancaParaWebhookInfinitePay | null>;
  confirmarPagamento: (entrada: {
    orderNsu: string;
    transactionNsu?: string;
    invoiceSlug?: string;
  }) => Promise<ResultadoPaymentCheck>;
  marcarCobrancaPaga: (
    cobrancaId: string,
    dados: DadosBaixaCobranca,
  ) => Promise<void>;
}

export interface WebhookInfinitePayEntrada {
  /** Corpo bruto do POST, nunca confiável (PRD 14: "como o webhook não é
   * assinado"): só serve para achar o `order_nsu` e disparar a
   * confirmação por `payment_check`. */
  corpo: unknown;
}

export type MotivoResultadoWebhookInfinitePay =
  | "sem_order_nsu"
  | "cobranca_nao_encontrada"
  | "pagamento_nao_confirmado"
  | "ja_paga"
  | "paga";

export interface ResultadoWebhookInfinitePay {
  status: 200 | 400;
  mudouEstado: boolean;
  motivo: MotivoResultadoWebhookInfinitePay;
}

/** [conferir] Formato exato do payload do webhook da InfinitePay (PRD 14
 * lista `order_nsu`, `transaction_nsu`, `invoice_slug`, `capture_method`,
 * `installments`, `paid_amount`, `receipt_url`, mas o corpo nunca é usado
 * para decidir baixa, só para achar a cobrança). */
function extrairIdentificadores(corpo: unknown): {
  orderNsu: string | null;
  transactionNsu?: string;
  invoiceSlug?: string;
} {
  if (!corpo || typeof corpo !== "object") {
    return { orderNsu: null };
  }
  const objeto = corpo as Record<string, unknown>;
  const orderNsu =
    typeof objeto.order_nsu === "string" ? objeto.order_nsu : null;
  const transactionNsu =
    typeof objeto.transaction_nsu === "string"
      ? objeto.transaction_nsu
      : undefined;
  const invoiceSlug =
    typeof objeto.invoice_slug === "string" ? objeto.invoice_slug : undefined;
  return { orderNsu, transactionNsu, invoiceSlug };
}

export async function processarWebhookInfinitePay(
  entrada: WebhookInfinitePayEntrada,
  dependencias: DependenciasWebhookInfinitePay,
): Promise<ResultadoWebhookInfinitePay> {
  const { orderNsu, transactionNsu, invoiceSlug } = extrairIdentificadores(
    entrada.corpo,
  );
  if (!orderNsu) {
    return { status: 400, mudouEstado: false, motivo: "sem_order_nsu" };
  }

  const cobranca = await dependencias.buscarCobrancaPorOrderNsu(orderNsu);
  if (!cobranca) {
    return {
      status: 200,
      mudouEstado: false,
      motivo: "cobranca_nao_encontrada",
    };
  }

  if (cobranca.status === "paga") {
    // Idempotente: webhook duplicado não gera segunda baixa nem nova
    // chamada de payment_check.
    return { status: 200, mudouEstado: false, motivo: "ja_paga" };
  }

  // Nunca confia no corpo: confirma com payment_check antes de qualquer
  // baixa, mesmo que o corpo diga que o pagamento foi aprovado.
  const confirmacao = await dependencias.confirmarPagamento({
    orderNsu,
    transactionNsu,
    invoiceSlug,
  });

  if (!confirmacao.pago) {
    return {
      status: 200,
      mudouEstado: false,
      motivo: "pagamento_nao_confirmado",
    };
  }

  await dependencias.marcarCobrancaPaga(cobranca.id, {
    valorPagoCentavos: confirmacao.valorPagoCentavos ?? 0,
    parcelas: confirmacao.parcelas ?? null,
    metodoCaptura: confirmacao.metodoCaptura ?? null,
    transactionNsu: transactionNsu ?? null,
    invoiceSlug: invoiceSlug ?? null,
    reciboUrl: confirmacao.reciboUrl ?? null,
  });

  return { status: 200, mudouEstado: true, motivo: "paga" };
}
