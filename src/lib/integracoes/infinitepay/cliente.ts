import "server-only";
import { validarParcelas } from "./limites";
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
  success?: boolean;
  url?: string;
  link?: string;
  payment_url?: string;
  checkout_url?: string;
  slug?: string;
  invoice_slug?: string;
}

/** Resposta do `payment_check`: `success` diz só que a consulta funcionou;
 * quem diz se houve pagamento é `paid`. */
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

  const cabecalhos: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opcoes.apiKey) cabecalhos.Authorization = `Bearer ${opcoes.apiKey}`;

  const resposta = await fetchImpl(`${base}${caminho}`, {
    method: "POST",
    headers: cabecalhos,
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
  // Validado antes de qualquer chamada de rede: um pedido acima do limite
  // do pacote nunca chega a gerar link (aceite do P32).
  validarParcelas(entrada.parcelas, entrada.parcelasMaxSemJuros);

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
    // [conferir] T-06: o link simples do Checkout não trava o parcelamento
    // (PRD 14 v4.2). Este campo só vale se o endpoint escolhido (Plano de
    // Cobrança) aceitar limite; até a confirmação, o aceite do P32 em
    // homologação abre o link e confere que ele mostra no máximo o limite.
    installments: {
      max: entrada.parcelas,
      free_max: entrada.parcelas,
    },
  });

  if (bruta.success === false) {
    throw new Error("InfinitePay: /links recusou o pedido");
  }
  const url =
    bruta.url ?? bruta.checkout_url ?? bruta.payment_url ?? bruta.link;
  if (!url) {
    throw new Error("InfinitePay: resposta de /links sem url de pagamento");
  }

  return {
    url,
    slug: bruta.slug ?? bruta.invoice_slug,
    orderNsu: entrada.orderNsu,
    parcelas: entrada.parcelas,
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

  // Só `paid === true` confirma. `success: true` com `paid: false` é a
  // resposta de uma consulta que funcionou para um pedido NÃO pago (o caso
  // de um webhook forjado) e nunca pode virar baixa.
  const pago = bruta.success !== false && bruta.paid === true;
  return {
    pago,
    valorPagoCentavos: bruta.paid_amount,
    parcelas: bruta.installments,
    metodoCaptura: bruta.capture_method,
    reciboUrl: bruta.receipt_url,
  };
}
