import { describe, expect, it, vi } from "vitest";
import { processarWebhookInfinitePay } from "./webhook";

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
        buscarCobrancaPorOrderNsu: vi
          .fn()
          .mockResolvedValue({ id: "cobranca-1", status: "aberta" }),
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
    const marcarCobrancaPaga = vi.fn().mockResolvedValue(undefined);

    const resultado = await processarWebhookInfinitePay(
      { corpo: { order_nsu: "cobranca-1" } },
      {
        buscarCobrancaPorOrderNsu: vi
          .fn()
          .mockResolvedValue({ id: "cobranca-1", status: "aberta" }),
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
          .mockResolvedValue({ id: "cobranca-1", status: "paga" }),
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
});
