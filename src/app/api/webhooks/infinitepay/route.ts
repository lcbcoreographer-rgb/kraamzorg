import "server-only";
import { paymentCheck } from "@/lib/integracoes/infinitepay/cliente";
import { processarWebhookInfinitePay } from "@/lib/integracoes/infinitepay/webhook";
import { criarClienteServico } from "@/lib/db/cliente-servico";

/**
 * Webhook de pagamento da InfinitePay (PRD 14, P32 item 2). Não é
 * assinado: o corpo nunca decide uma baixa sozinho, sempre confirma com
 * `payment_check` (só `paid: true` confirma, e o valor pago vem de lá).
 * Responde rápido e é idempotente (a baixa é condicional no banco).
 *
 * Falha de rede no `payment_check` ou de banco responde 500 sem detalhe,
 * para a InfinitePay reenviar; nada é gravado pela metade.
 */
export async function POST(request: Request): Promise<Response> {
  const handle = process.env.INFINITEPAY_HANDLE;
  // [conferir] opcional: o Checkout público autentica só pelo handle.
  const apiKey = process.env.INFINITEPAY_API_KEY || undefined;
  if (!handle) {
    return Response.json({ ok: false }, { status: 500 });
  }

  const corpo: unknown = await request.json().catch(() => null);

  try {
    const supabase = criarClienteServico("webhook_infinitepay");
    const resultado = await processarWebhookInfinitePay(
      { corpo },
      {
        buscarCobrancaPorOrderNsu: async (orderNsu) => {
          const { data, error } = await supabase
            .from("cobranca")
            .select("id, status, valor_centavos")
            .eq("external_id", orderNsu)
            .maybeSingle();
          if (error) throw new Error("falha ao ler a cobrança");
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
          // Condicional: só baixa se ainda não estiver paga, então dois
          // webhooks simultâneos nunca baixam duas vezes.
          const { data, error } = await supabase
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
            .eq("id", cobrancaId)
            .neq("status", "paga")
            .select("id");
          if (error) throw new Error("falha ao gravar a baixa");
          // [conferir] a transição da oportunidade para
          // `pagamento_confirmado` (ou `prenatal_urgente` acima de 34
          // semanas, P32 item 3), a tarefa e a nota fiscal pendente (P43)
          // ficam com a trilha de venda e automações; este webhook só
          // garante a baixa idempotente, confirmada por payment_check.
          return (data?.length ?? 0) > 0;
        },
      },
    );

    return Response.json(
      { ok: resultado.mudouEstado },
      { status: resultado.status },
    );
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
