import "server-only";
import { validarParcelasMaxSemJuros } from "./limites";
import type {
  ClienteInfinitePayOpcoes,
  CriarLinkPagamentoEntrada,
  LinkPagamentoInfinitePay,
  PaymentCheckEntrada,
  ResultadoPaymentCheck,
} from "./tipos";

/**
 * Adaptador InfinitePay Checkout (PRD 14, P32). Nunca chama a API real em
 * teste: `fetchImpl` é interceptado (CLAUDE.md).
 *
 * [conferir] Endpoint exato do Plano de Cobrança (T-06); usa aqui o
 * endpoint de links documentado publicamente
 * (`POST https://api.checkout.infinitepay.io/links`) com o campo de
 * parcelamento marcado abaixo. O limite de 3 parcelas é aplicado no próprio
 * adaptador (`limites.ts`), então o aceite do P32 vale com qualquer um dos
 * dois endpoints que o T-06 escolher.
 */

const ENDPOINT_LINKS_PADRAO = "https://api.checkout.infinitepay.io";

interface RespostaLinkBruta {
  url?: string;
  payment_url?: string;
  checkout_url?: string;
  slug?: string;
  invoice_slug?: string;
}

interface RespostaPaymentCheckBruta {
  success?: boolean;
  paid?: boolean;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
  receipt_url?: string;
}

async function requisitar<T>(
  opcoes: ClienteInfinitePayOpcoes,
  caminho: string,
  corpo: Record<string, unknown>,
): Promise<T> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const base = opcoes.endpointBase ?? ENDPOINT_LINKS_PADRAO;

  const resposta = await fetchImpl(`${base}${caminho}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opcoes.apiKey}`,
    },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    throw new Error(
      `InfinitePay: resposta HTTP ${resposta.status} em ${caminho}`,
    );
  }

  return (await resposta.json()) as T;
}

export async function criarLinkPagamento(
  opcoes: ClienteInfinitePayOpcoes,
  entrada: CriarLinkPagamentoEntrada,
): Promise<LinkPagamentoInfinitePay> {
  // Validado antes de qualquer chamada de rede: um pedido de mais de 3
  // parcelas nunca chega a gerar link (aceite do P32).
  validarParcelasMaxSemJuros(entrada.parcelasMaxSemJuros);

  const bruta = await requisitar<RespostaLinkBruta>(opcoes, "/links", {
    handle: opcoes.handle,
    order_nsu: entrada.orderNsu,
    redirect_url: entrada.redirectUrl,
    webhook_url: entrada.webhookUrl,
    items: entrada.itens.map((item) => ({
      name: item.nome,
      price: item.valorCentavos,
      quantity: item.quantidade,
    })),
    customer: {
      name: entrada.cliente.nome,
      email: entrada.cliente.email,
      phone_number: entrada.cliente.telefone,
      document: entrada.cliente.cpf,
    },
    // [conferir] campo exato do Plano de Cobrança (T-06); trava o
    // parcelamento sem juros no limite validado acima.
    installments: {
      max: entrada.parcelasMaxSemJuros,
      free_max: entrada.parcelasMaxSemJuros,
    },
  });

  const url = bruta.url ?? bruta.payment_url ?? bruta.checkout_url;
  const slug = bruta.slug ?? bruta.invoice_slug;
  if (!url || !slug) {
    throw new Error(
      "InfinitePay: resposta de /links sem url ou slug reconhecíveis",
    );
  }

  return {
    url,
    slug,
    orderNsu: entrada.orderNsu,
    parcelasMaxSemJuros: entrada.parcelasMaxSemJuros,
  };
}

export async function paymentCheck(
  opcoes: ClienteInfinitePayOpcoes,
  entrada: PaymentCheckEntrada,
): Promise<ResultadoPaymentCheck> {
  const bruta = await requisitar<RespostaPaymentCheckBruta>(
    opcoes,
    "/payment_check",
    {
      handle: opcoes.handle,
      order_nsu: entrada.orderNsu,
      transaction_nsu: entrada.transactionNsu,
      slug: entrada.invoiceSlug,
    },
  );

  const pago = bruta.success === true || bruta.paid === true;
  return {
    pago,
    valorPagoCentavos: bruta.paid_amount,
    parcelas: bruta.installments,
    metodoCaptura: bruta.capture_method,
    reciboUrl: bruta.receipt_url,
  };
}
