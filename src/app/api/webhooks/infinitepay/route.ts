import "server-only";
import { after } from "next/server";
import { obterArmazenamento } from "@/lib/armazenamento";
import { obterEmissorNfse } from "@/lib/integracoes/fabrica";
import { paymentCheck } from "@/lib/integracoes/infinitepay/cliente";
import { processarWebhookInfinitePay } from "@/lib/integracoes/infinitepay/webhook";
import { criarClienteServico } from "@/lib/db/cliente-servico";
import {
  baixarCobranca,
  cobrancaDoPedido,
  emitirNotaAutomatica,
  registrarSaudeWebhook,
  type ClienteRpc,
} from "@/lib/integracoes/servico-webhooks";

/**
 * Nota fiscal automática (P43): só depois de a baixa mudar a cobrança, e só
 * com `parametro.nfse_emissao.automatica` ligado (o banco decide). Melhor
 * esforço: nunca muda a resposta do webhook, porque o pagamento já está
 * confirmado e a nota, se falhar, fica com o erro visível em /notas.
 */
async function tentarNotaAutomatica(
  supabase: ClienteRpc,
  cobrancaId: string,
): Promise<void> {
  try {
    await emitirNotaAutomatica(
      supabase,
      cobrancaId,
      obterEmissorNfse(),
      obterArmazenamento(),
    );
  } catch {
    // sem provedor configurado, ou o provedor caiu: a nota segue pendente ou com erro
  }
}

/** Roda depois de responder; fora de uma requisição (teste), roda na hora. */
async function depoisDaResposta(tarefa: () => Promise<void>): Promise<void> {
  try {
    after(tarefa);
  } catch {
    await tarefa();
  }
}

/**
 * Webhook de pagamento da InfinitePay (PRD 14, P32 item 2). Não é
 * assinado: o corpo nunca decide uma baixa sozinho, sempre confirma com
 * `payment_check` (só `paid: true` confirma, e o valor pago vem de lá).
 * Responde rápido e é idempotente (`public.cobranca_baixar` não baixa
 * cobrança já paga).
 *
 * A baixa move o P2 para `pagamento_confirmado`, deixa a nota fiscal
 * pendente (P43; com a emissão automática ligada, a nota sai logo depois) e cria as tarefas de mensagem e, com 34 semanas ou mais,
 * o aviso de `prenatal_urgente`, tudo dentro da função do banco.
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

  let saude: ClienteRpc | null = null;
  try {
    const supabase = criarClienteServico(
      "webhook_infinitepay",
    ) as unknown as ClienteRpc;
    saude = supabase;
    let orderNsu = "";
    const resultado = await processarWebhookInfinitePay(
      { corpo },
      {
        buscarCobrancaPorOrderNsu: async (pedido) => {
          orderNsu = pedido;
          return cobrancaDoPedido(supabase, pedido);
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
          const mudou = await baixarCobranca(supabase, orderNsu, {
            valorPagoCentavos: dados.valorPagoCentavos,
            parcelas: dados.parcelas,
            metodoCaptura: dados.metodoCaptura,
            transactionNsu: dados.transactionNsu,
            invoiceSlug: dados.invoiceSlug,
            reciboUrl: dados.reciboUrl,
          });
          if (mudou) {
            await depoisDaResposta(() =>
              tentarNotaAutomatica(supabase, cobrancaId),
            );
          }
          return mudou;
        },
      },
    );

    // Saúde (P14): só a chamada processada de verdade conta como acerto.
    if (resultado.status === 200) {
      await registrarSaudeWebhook(supabase, "infinitepay", true);
    }
    return Response.json(
      { ok: resultado.mudouEstado },
      { status: resultado.status },
    );
  } catch {
    if (saude) await registrarSaudeWebhook(saude, "infinitepay", false);
    return Response.json({ ok: false }, { status: 500 });
  }
}
