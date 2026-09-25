import { describe, expect, it, vi } from "vitest";
import { paymentCheck } from "./cliente";
import { processarWebhookInfinitePay } from "./webhook";

const COBRANCA_ABERTA = {
  id: "cobranca-1",
  status: "aberta",
  valor_centavos: 140000,
};

describe("processarWebhookInfinitePay", () => {
  it("corpo forjado (diz pago, payment_check real diz que não) não muda nada", async () => {
    const marcarCobrancaPaga = vi.fn();
    const confirmarPagamento = vi.fn().mockResolvedValue({ pago: false });

    const resultado = await processarWebhookInfinitePay(
      {
        // Corpo forjado tentando parecer aprovado; a função só usa o
        // order_nsu para achar a cobrança, o resto vem do payment_check.
        corpo: {
          order_nsu: "cobranca-1",
          paid_amount: 999999,
          capture_method: "credit_card",
        },
      },
      {
        buscarCobrancaPorOrderNsu: vi.fn().mockResolvedValue(COBRANCA_ABERTA),
        confirmarPagamento,
        marcarCobrancaPaga,
      },
    );

    expect(confirmarPagamento).toHaveBeenCalledWith({
      orderNsu: "cobranca-1",
      transactionNsu: undefined,
      invoiceSlug: undefined,
    });
    expect(resultado).toEqual({
      status: 200,
      mudouEstado: false,
      motivo: "pagamento_nao_confirmado",
    });
    expect(marcarCobrancaPaga).not.toHaveBeenCalled();
  });

  it("pagamento confirmado baixa a cobrança uma vez", async () => {
    const marcarCobrancaPaga = vi.fn().mockResolvedValue(true);

    const resultado = await processarWebhookInfinitePay(
      { corpo: { order_nsu: "cobranca-1" } },
      {
        buscarCobrancaPorOrderNsu: vi.fn().mockResolvedValue(COBRANCA_ABERTA),
        confirmarPagamento: vi.fn().mockResolvedValue({
          pago: true,
          valorPagoCentavos: 140000,
          parcelas: 3,
          metodoCaptura: "credit_card",
        }),
        marcarCobrancaPaga,
      },
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: true,
      motivo: "paga",
    });
    expect(marcarCobrancaPaga).toHaveBeenCalledTimes(1);
    expect(marcarCobrancaPaga).toHaveBeenCalledWith(
      "cobranca-1",
      expect.objectContaining({ valorPagoCentavos: 140000, parcelas: 3 }),
    );
  });

  it("webhook duplicado (cobrança já paga) não chama payment_check nem baixa de novo", async () => {
    const confirmarPagamento = vi.fn();
    const marcarCobrancaPaga = vi.fn();

    const resultado = await processarWebhookInfinitePay(
      { corpo: { order_nsu: "cobranca-1" } },
      {
        buscarCobrancaPorOrderNsu: vi
          .fn()
          .mockResolvedValue({ ...COBRANCA_ABERTA, status: "paga" }),
        confirmarPagamento,
        marcarCobrancaPaga,
      },
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: false,
      motivo: "ja_paga",
    });
    expect(confirmarPagamento).not.toHaveBeenCalled();
    expect(marcarCobrancaPaga).not.toHaveBeenCalled();
  });

  it("corpo sem order_nsu devolve 400 sem consultar nada", async () => {
    const buscarCobrancaPorOrderNsu = vi.fn();

    const resultado = await processarWebhookInfinitePay(
      { corpo: { foo: "bar" } },
      {
        buscarCobrancaPorOrderNsu,
        confirmarPagamento: vi.fn(),
        marcarCobrancaPaga: vi.fn(),
      },
    );

    expect(resultado).toEqual({
      status: 400,
      mudouEstado: false,
      motivo: "sem_order_nsu",
    });
    expect(buscarCobrancaPorOrderNsu).not.toHaveBeenCalled();
  });

  it("cobrança não encontrada não muda nada", async () => {
    const resultado = await processarWebhookInfinitePay(
      { corpo: { order_nsu: "desconhecida" } },
      {
        buscarCobrancaPorOrderNsu: vi.fn().mockResolvedValue(null),
        confirmarPagamento: vi.fn(),
        marcarCobrancaPaga: vi.fn(),
      },
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: false,
      motivo: "cobranca_nao_encontrada",
    });
  });

  it("forjado de ponta a ponta: payment_check real com fetch interceptado diz success true e paid false, nada muda", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, paid: false }),
    } as Response);
    const marcarCobrancaPaga = vi.fn();

    const resultado = await processarWebhookInfinitePay(
      {
        corpo: {
          order_nsu: "cobranca-1",
          transaction_nsu: "tx-inventado",
          invoice_slug: "slug-inventado",
          paid_amount: 140000,
          capture_method: "pix",
        },
      },
      {
        buscarCobrancaPorOrderNsu: vi.fn().mockResolvedValue(COBRANCA_ABERTA),
        confirmarPagamento: (entrada) =>
          paymentCheck({ handle: "kraamzorg", fetchImpl }, entrada),
        marcarCobrancaPaga,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body as string)).toEqual({
      handle: "kraamzorg",
      order_nsu: "cobranca-1",
      transaction_nsu: "tx-inventado",
      slug: "slug-inventado",
    });
    expect(resultado.motivo).toBe("pagamento_nao_confirmado");
    expect(marcarCobrancaPaga).not.toHaveBeenCalled();
  });

  it("valor confirmado abaixo do valor da cobrança não baixa", async () => {
    const marcarCobrancaPaga = vi.fn();

    const resultado = await processarWebhookInfinitePay(
      { corpo: { order_nsu: "cobranca-1" } },
      {
        buscarCobrancaPorOrderNsu: vi.fn().mockResolvedValue(COBRANCA_ABERTA),
        confirmarPagamento: vi
          .fn()
          .mockResolvedValue({ pago: true, valorPagoCentavos: 100 }),
        marcarCobrancaPaga,
      },
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: false,
      motivo: "valor_divergente",
    });
    expect(marcarCobrancaPaga).not.toHaveBeenCalled();
  });

  it("pago sem valor confirmado não baixa com valor zero", async () => {
    const marcarCobrancaPaga = vi.fn();

    const resultado = await processarWebhookInfinitePay(
      { corpo: { order_nsu: "cobranca-1" } },
      {
        buscarCobrancaPorOrderNsu: vi.fn().mockResolvedValue(COBRANCA_ABERTA),
        confirmarPagamento: vi.fn().mockResolvedValue({ pago: true }),
        marcarCobrancaPaga,
      },
    );

    expect(resultado.motivo).toBe("valor_divergente");
    expect(marcarCobrancaPaga).not.toHaveBeenCalled();
  });

  it("dois webhooks ao mesmo tempo: a baixa condicional não muda nada no segundo", async () => {
    const resultado = await processarWebhookInfinitePay(
      { corpo: { order_nsu: "cobranca-1" } },
      {
        buscarCobrancaPorOrderNsu: vi.fn().mockResolvedValue(COBRANCA_ABERTA),
        confirmarPagamento: vi
          .fn()
          .mockResolvedValue({ pago: true, valorPagoCentavos: 140000 }),
        marcarCobrancaPaga: vi.fn().mockResolvedValue(false),
      },
    );

    expect(resultado).toEqual({
      status: 200,
      mudouEstado: false,
      motivo: "ja_paga",
    });
  });

  it("falha do payment_check propaga o erro (a rota responde 500) sem baixar", async () => {
    const marcarCobrancaPaga = vi.fn();
    await expect(
      processarWebhookInfinitePay(
        { corpo: { order_nsu: "cobranca-1" } },
        {
          buscarCobrancaPorOrderNsu: vi.fn().mockResolvedValue(COBRANCA_ABERTA),
          confirmarPagamento: vi.fn().mockRejectedValue(new Error("rede")),
          marcarCobrancaPaga,
        },
      ),
    ).rejects.toThrow();
    expect(marcarCobrancaPaga).not.toHaveBeenCalled();
  });
});
