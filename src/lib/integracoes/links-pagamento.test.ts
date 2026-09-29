import { describe, expect, it, vi } from "vitest";
import type { DadosLinkPagamento } from "@/lib/dados/tipos-contrato";
import { gerarLinksPendentes } from "./links-pagamento";

function dados(id: string, parcelas = 3): DadosLinkPagamento {
  return {
    cobrancaId: id,
    contratoId: "k1",
    familiaId: "f1",
    valorCentavos: 455000,
    parcelas,
    parcelasMax: 3,
    acimaDoLimite: parcelas > 3,
    descricao: "Cuidado domiciliar pós-parto",
    cliente: { nome: "Marina", email: null, telefone: null },
  };
}

function deps(
  sobrescrever: Partial<Parameters<typeof gerarLinksPendentes>[1]> = {},
) {
  return {
    criarLink: vi
      .fn()
      .mockResolvedValue({ url: "https://pay.exemplo.invalid/1", slug: "s" }),
    registrar: vi.fn().mockResolvedValue(undefined),
    avisarFalha: vi.fn().mockResolvedValue(undefined),
    ...sobrescrever,
  };
}

describe("gerarLinksPendentes", () => {
  it("cria e guarda o link de cada cobrança", async () => {
    const d = deps();
    const r = await gerarLinksPendentes([dados("c1"), dados("c2")], d);
    expect(r.criados).toEqual(["c1", "c2"]);
    expect(d.registrar).toHaveBeenCalledWith(
      "c1",
      "https://pay.exemplo.invalid/1",
      "s",
    );
    expect(d.avisarFalha).not.toHaveBeenCalled();
  });

  it("acima do limite do pacote: não pede o link, avisa o financeiro", async () => {
    const d = deps();
    const r = await gerarLinksPendentes([dados("c1", 5)], d);
    expect(r.acimaDoLimite).toEqual(["c1"]);
    expect(d.criarLink).not.toHaveBeenCalled();
    expect(d.avisarFalha).toHaveBeenCalledWith("c1", "acima_do_limite");
  });

  it("falha da InfinitePay: avisa, segue para a próxima e nunca lança", async () => {
    const d = deps({
      criarLink: vi
        .fn()
        .mockRejectedValueOnce(new Error("503"))
        .mockResolvedValueOnce({
          url: "https://pay.exemplo.invalid/2",
          slug: null,
        }),
    });
    const r = await gerarLinksPendentes([dados("c1"), dados("c2")], d);
    expect(r.falhas).toEqual(["c1"]);
    expect(r.criados).toEqual(["c2"]);
    expect(d.avisarFalha).toHaveBeenCalledWith("c1", "falha_integracao");
  });

  it("falha ao guardar o link ou ao avisar também não lança", async () => {
    const d = deps({
      registrar: vi.fn().mockRejectedValue(new Error("banco")),
      avisarFalha: vi.fn().mockRejectedValue(new Error("banco")),
    });
    await expect(gerarLinksPendentes([dados("c1")], d)).resolves.toMatchObject({
      falhas: ["c1"],
    });
  });
});
