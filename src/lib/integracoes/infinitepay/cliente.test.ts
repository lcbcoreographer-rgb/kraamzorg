import { describe, expect, it, vi } from "vitest";
import { criarLinkPagamento, paymentCheck } from "./cliente";

function respostaJson(corpo: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => corpo } as Response;
}

const entradaBase = {
  orderNsu: "cobranca-1",
  itens: [
    {
      nome: "Pacote Essencial · parcela 1/3",
      valorCentavos: 140000,
      quantidade: 1,
    },
  ],
  redirectUrl: "https://app.kraamzorg.example/contrato/cobranca-1",
  webhookUrl: "https://app.kraamzorg.example/api/webhooks/infinitepay",
  cliente: { nome: "Gestante Teste", email: "gestante@exemplo.invalid" },
  parcelasMaxSemJuros: 3,
};

describe("criarLinkPagamento", () => {
  it("envia order_nsu igual ao id da cobrança, itens em centavos e o limite de parcelas", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      respostaJson({
        url: "https://checkout.infinitepay.io/abc",
        slug: "abc",
      }),
    );

    const link = await criarLinkPagamento(
      { handle: "kraamzorg", apiKey: "chave", fetchImpl },
      entradaBase,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [endpoint, requisicao] = fetchImpl.mock.calls[0]!;
    expect(endpoint).toBe("https://api.checkout.infinitepay.io/links");
    const corpo = JSON.parse(requisicao.body as string);
    expect(corpo.order_nsu).toBe("cobranca-1");
    expect(corpo.items[0]).toEqual({
      name: "Pacote Essencial · parcela 1/3",
      price: 140000,
      quantity: 1,
    });
    expect(corpo.redirect_url).toBe(entradaBase.redirectUrl);
    expect(corpo.webhook_url).toBe(entradaBase.webhookUrl);
    expect(corpo.customer.name).toBe("Gestante Teste");
    expect(corpo.installments.max).toBe(3);

    expect(link.url).toBe("https://checkout.infinitepay.io/abc");
    expect(link.orderNsu).toBe("cobranca-1");
    expect(link.parcelasMaxSemJuros).toBe(3);
  });

  it("recusa link com mais de 3 parcelas e nunca chama a rede", async () => {
    const fetchImpl = vi.fn();

    await expect(
      criarLinkPagamento(
        { handle: "kraamzorg", apiKey: "chave", fetchImpl },
        { ...entradaBase, parcelasMaxSemJuros: 4 },
      ),
    ).rejects.toThrow(/3x/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recusa link com 12 parcelas (limite do checkout sem Plano de Cobrança)", async () => {
    const fetchImpl = vi.fn();

    await expect(
      criarLinkPagamento(
        { handle: "kraamzorg", apiKey: "chave", fetchImpl },
        { ...entradaBase, parcelasMaxSemJuros: 12 },
      ),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lança erro em resposta HTTP não ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaJson({}, false, 500));

    await expect(
      criarLinkPagamento(
        { handle: "kraamzorg", apiKey: "chave", fetchImpl },
        entradaBase,
      ),
    ).rejects.toThrow(/500/);
  });
});

describe("paymentCheck", () => {
  it("confirma pagamento aprovado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      respostaJson({
        success: true,
        paid_amount: 140000,
        installments: 3,
        capture_method: "credit_card",
        receipt_url: "https://recibo.invalid/1",
      }),
    );

    const resultado = await paymentCheck(
      { handle: "kraamzorg", apiKey: "chave", fetchImpl },
      { orderNsu: "cobranca-1", transactionNsu: "tx-1", invoiceSlug: "abc" },
    );

    const [endpoint, requisicao] = fetchImpl.mock.calls[0]!;
    expect(endpoint).toBe("https://api.checkout.infinitepay.io/payment_check");
    expect(JSON.parse(requisicao.body as string)).toEqual({
      handle: "kraamzorg",
      order_nsu: "cobranca-1",
      transaction_nsu: "tx-1",
      slug: "abc",
    });
    expect(resultado.pago).toBe(true);
    expect(resultado.valorPagoCentavos).toBe(140000);
    expect(resultado.parcelas).toBe(3);
  });

  it("devolve pago falso quando a API diz que não há pagamento", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(respostaJson({ success: false }));

    const resultado = await paymentCheck(
      { handle: "kraamzorg", apiKey: "chave", fetchImpl },
      { orderNsu: "cobranca-1" },
    );

    expect(resultado.pago).toBe(false);
  });
});
