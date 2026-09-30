import { describe, expect, it, vi } from "vitest";
import { criarLinkPagamento } from "./cliente";

/**
 * P32 v4.2, aceite: "o link de pagamento gerado no teste mostra no máximo 3
 * parcelas sem juros; se mostrar mais, o teste falha". Duas travas: o
 * pedido acima do limite nem sai (limites.ts) e a resposta que revela mais
 * parcelas do que o pacote permite descarta o link.
 */
function resposta(corpo: unknown) {
  return { ok: true, status: 200, json: async () => corpo } as Response;
}

const entrada = {
  orderNsu: "cobranca-1",
  itens: [
    {
      nome: "Cuidado domiciliar pós-parto",
      valorCentavos: 455000,
      quantidade: 1,
    },
  ],
  redirectUrl: "https://app.exemplo.invalid/pagamento/recebido",
  webhookUrl: "https://app.exemplo.invalid/api/webhooks/infinitepay",
  cliente: { nome: "Gestante Teste" },
  parcelas: 3,
  parcelasMaxSemJuros: 3,
};

describe("parcelas que o link mostra", () => {
  it("o pedido leva no máximo o limite do pacote", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(resposta({ url: "https://pay.exemplo.invalid/1" }));
    await criarLinkPagamento({ handle: "h", fetchImpl }, entrada);
    const corpo = JSON.parse(String(fetchImpl.mock.calls[0]![1].body));
    expect(corpo.installments.max).toBeLessThanOrEqual(3);
    expect(corpo.installments.free_max).toBeLessThanOrEqual(3);
  });

  it("resposta que mostra até 3 parcelas passa; a quantidade mostrada volta no resultado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      resposta({
        url: "https://pay.exemplo.invalid/1",
        installments: { max: 3 },
      }),
    );
    const link = await criarLinkPagamento({ handle: "h", fetchImpl }, entrada);
    expect(link.parcelas).toBe(3);
  });

  it("resposta que mostra mais de 3 parcelas: o teste falha, o link é descartado", async () => {
    for (const corpo of [
      { url: "https://pay.exemplo.invalid/1", installments: { max: 12 } },
      { url: "https://pay.exemplo.invalid/1", installments: 12 },
      { url: "https://pay.exemplo.invalid/1", max_installments: 6 },
    ]) {
      const fetchImpl = vi.fn().mockResolvedValue(resposta(corpo));
      await expect(
        criarLinkPagamento({ handle: "h", fetchImpl }, entrada),
      ).rejects.toThrow(/acima do limite/);
    }
  });

  it("pedido de 4 parcelas nem chega à rede", async () => {
    const fetchImpl = vi.fn();
    await expect(
      criarLinkPagamento(
        { handle: "h", fetchImpl },
        { ...entrada, parcelas: 4 },
      ),
    ).rejects.toThrow(RangeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
