// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));
vi.mock("@/lib/auth/sessao", () => ({
  obterSessao: async () => null,
  exigirSessao: async () => {
    throw new Error("sem sessão no teste");
  },
}));

import { render, screen } from "@testing-library/react";
import type { TransferenciaTela } from "../../tipos";
import { CartaoTransferencia, estadoPrazo } from "./cartao-transferencia";

const AGORA = new Date("2026-09-24T17:00:00.000Z");

function transferencia(
  sobrescreve: Partial<TransferenciaTela> = {},
): TransferenciaTela {
  return {
    id: "t1",
    conversaId: "c1",
    familiaId: "f1",
    nomeFamilia: "Família Teste Dália",
    motivo: "contratar",
    motivoRotulo: "Quer contratar",
    destino: "comercial",
    prioridade: "alta",
    resumo: "Imersão, Pix, DPP 15/11/2026.",
    status: "aberto",
    slaVenceEm: "2026-09-24T17:38:00.000Z",
    notificacaoOk: true,
    assumidoPor: null,
    assumidoEm: null,
    criadoEm: "2026-09-24T15:38:00.000Z",
    ...sobrescreve,
  };
}

describe("estadoPrazo (fluxos.md, fluxo E: aviso com menos de 25% da janela)", () => {
  it("com mais de 25% da janela: normal", () => {
    expect(
      estadoPrazo(
        "2026-09-24T16:00:00.000Z",
        "2026-09-24T18:00:00.000Z",
        AGORA,
      ),
    ).toBe("normal");
  });
  it("com menos de 25% da janela: perto", () => {
    expect(
      estadoPrazo(
        "2026-09-24T15:38:00.000Z",
        "2026-09-24T17:20:00.000Z",
        AGORA,
      ),
    ).toBe("perto");
  });
  it("passou do prazo: vencido", () => {
    expect(
      estadoPrazo(
        "2026-09-24T15:00:00.000Z",
        "2026-09-24T16:52:00.000Z",
        AGORA,
      ),
    ).toBe("vencido");
  });
});

describe("CartaoTransferencia (P27 item 2)", () => {
  it("mostra o motivo, de quem é e o prazo em frase", () => {
    render(
      <CartaoTransferencia transferencia={transferencia()} agora={AGORA} />,
    );
    expect(
      screen.getByRole("heading", { name: "Quer contratar" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/É do comercial/)).toBeInTheDocument();
    expect(screen.getByText("vence em 38 min")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Assumir conversa" }),
    ).toBeInTheDocument();
  });

  it("faixa vermelha com Reenviar aviso quando o aviso ao grupo falhou", () => {
    render(
      <CartaoTransferencia
        transferencia={transferencia({ notificacaoOk: false })}
        agora={AGORA}
      />,
    );
    expect(screen.getByText("O aviso ao grupo não saiu")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reenviar aviso" }),
    ).toBeInTheDocument();
  });

  it("sem faixa quando o aviso saiu", () => {
    render(
      <CartaoTransferencia transferencia={transferencia()} agora={AGORA} />,
    );
    expect(
      screen.queryByText("O aviso ao grupo não saiu"),
    ).not.toBeInTheDocument();
  });

  it("pausa vencida com a transferência aberta aparece em vermelho (PRD 11.7)", () => {
    render(
      <CartaoTransferencia
        transferencia={transferencia({ pausaVenceu: true })}
        agora={AGORA}
      />,
    );
    expect(
      screen.getByText("A Isadora voltou a responder"),
    ).toBeInTheDocument();
  });

  it("assumida por quem vê: diz 'Você assumiu' com a hora", () => {
    render(
      <CartaoTransferencia
        transferencia={transferencia({
          status: "assumido",
          assumidoPor: "u1",
          assumidoEm: "2026-09-24T17:05:00.000Z",
        })}
        agora={AGORA}
        usuarioId="u1"
      />,
    );
    expect(screen.getByText("Você assumiu às 14:05")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir conversa" }),
    ).toHaveAttribute("href", "/conversas/c1");
  });
});
