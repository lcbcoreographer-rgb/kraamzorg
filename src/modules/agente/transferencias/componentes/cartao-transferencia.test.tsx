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
  it("pedido de conversa (reuniao) leva à agenda com a transferência (P29)", () => {
    render(
      <CartaoTransferencia
        transferencia={transferencia({
          motivo: "reuniao",
          motivoRotulo: "Quer conversar",
        })}
        agora={AGORA}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Marcar na agenda" }),
    ).toHaveAttribute("href", "/sessoes-venda/nova?transferencia=t1");
  });

  it("outros motivos não oferecem a agenda", () => {
    render(
      <CartaoTransferencia transferencia={transferencia()} agora={AGORA} />,
    );
    expect(
      screen.queryByRole("link", { name: "Marcar na agenda" }),
    ).not.toBeInTheDocument();
  });

  it("mostra o motivo, de quem é e o prazo em frase", () => {
    render(
      <CartaoTransferencia transferencia={transferencia()} agora={AGORA} />,
    );
    expect(
      screen.getByRole("heading", { name: "Quer contratar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Família Teste Dália, com o comercial"),
    ).toBeInTheDocument();
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

  it("perda com prazo vencido: hora do relato, sem vermelho e sem relógio (DESIGN.md 11.8)", () => {
    const { container } = render(
      <CartaoTransferencia
        transferencia={transferencia({
          nomeFamilia: "Família Teste Bruma",
          motivo: "perda",
          motivoRotulo: "Perda gestacional",
          destino: "coordenacao_clinica",
          prioridade: "maxima",
          resumo: "A família contou que perdeu o bebê.",
          criadoEm: "2026-09-24T16:18:00.000Z",
          slaVenceEm: "2026-09-24T16:48:00.000Z",
          notificacaoOk: false,
        })}
        agora={AGORA}
      />,
    );
    expect(screen.getByText(/recebida às/)).toBeInTheDocument();
    expect(screen.getByText("13:18")).toBeInTheDocument();
    expect(
      screen.getByText("Ainda sem contato da equipe."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Família Teste Bruma, com a coordenação clínica"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/venceu há/)).not.toBeInTheDocument();
    // Nada em alerta no cartão: nem o prazo, nem a falha do aviso ao grupo.
    expect(container.querySelector(".text-alerta")).toBeNull();
    expect(container.querySelector(".bg-alerta-lavado")).toBeNull();
    expect(container.querySelector(".lucide-clock-alert")).toBeNull();
    expect(container.querySelector(".lucide-hourglass")).toBeNull();
    // A falha do aviso continua visível, em ameixa.
    expect(screen.getByText("O aviso ao grupo não saiu")).toBeInTheDocument();
  });

  it("perda já assumida: sem a linha de atraso", () => {
    render(
      <CartaoTransferencia
        transferencia={transferencia({
          motivo: "perda",
          motivoRotulo: "Perda gestacional",
          prioridade: "maxima",
          status: "assumido",
          assumidoPor: "u2",
          assumidoEm: "2026-09-24T16:30:00.000Z",
          criadoEm: "2026-09-24T16:18:00.000Z",
          slaVenceEm: "2026-09-24T16:48:00.000Z",
        })}
        agora={AGORA}
      />,
    );
    expect(
      screen.queryByText("Ainda sem contato da equipe."),
    ).not.toBeInTheDocument();
  });
});
