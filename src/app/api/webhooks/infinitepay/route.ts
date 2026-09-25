import "server-only";
import { paymentCheck } from "@/lib/integracoes/infinitepay/cliente";
import { processarWebhookInfinitePay } from "@/lib/integracoes/infinitepay/webhook";
import { criarClienteServico } from "@/lib/db/cliente-servico";

/**
 * Webhook de pagamento da InfinitePay (PRD 14, P32 item 2). Não é
 * assinado: o corpo nunca decide uma baixa sozinho, sempre confirma com
 * `payment_check`. Responde rápido e é idempotente (cobrança já paga não
 * baixa de novo).
 */
export async function POST(request: Request): Promise<Response> {
  const handle = process.env.INFINITEPAY_HANDLE;
  const apiKey = process.env.INFINITEPAY_API_KEY;
  if (!handle || !apiKey) {
    return Response.json(
      { ok: false, erro: "webhook não configurado" },
      { status: 500 },
    );
  }

  const corpo = await request.json().catch(() => ({}));
  const supabase = criarClienteServico("webhook_infinitepay");

  const resultado = await processarWebhookInfinitePay(
    { corpo },
    {
      buscarCobrancaPorOrderNsu: async (orderNsu) => {
        const { data } = await supabase
          .from("cobranca")
          .select("id, status")
          .eq("external_id", orderNsu)
          .maybeSingle();
        return data;
      },
      confirmarPagamento: (entrada) =>
        paymentCheck(
          { handle, apiKey },
          {
            orderNsu: entrada.orderNsu,
            transactionNsu: entrada.transactionNsu,
            invoiceSlug: entrada.invoiceSlug,
          },
        ),
      marcarCobrancaPaga: async (cobrancaId, dados) => {
        await supabase
          .from("cobranca")
          .update({
            status: "paga",
            valor_pago_centavos: dados.valorPagoCentavos,
            parcelas_cartao: dados.parcelas,
            capture_method: dados.metodoCaptura,
            transaction_nsu: dados.transactionNsu,
            invoice_slug: dados.invoiceSlug,
            comprovante_url: dados.reciboUrl,
            pago_em: new Date().toISOString(),
          })
          .eq("id", cobrancaId);
        // [conferir] a transição do contrato para `pagamento_confirmado`
        // (ou `pagamento_confirmado_34s` acima de 34 semanas, PRD 10.1) e
        // o disparo da nota fiscal pendente (P43) ficam com a trilha de
        // venda/automações; este webhook só garante a baixa idempotente,
        // confirmada por payment_check.
      },
    },
  );

  return Response.json(
    { ok: resultado.mudouEstado },
    { status: resultado.status },
  );
}
