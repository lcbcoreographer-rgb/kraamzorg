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
import userEvent from "@testing-library/user-event";
import type { TransferenciaTela } from "../../tipos";
import { FaixaTransferencia } from "./faixa-transferencia";

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

describe("FaixaTransferencia (a transferência aberta dentro da conversa)", () => {
  it("mostra motivo, prazo, com quem está e o resumo, com assumir e encerrar", async () => {
    const usuario = userEvent.setup();
    render(
      <FaixaTransferencia
        transferencia={transferencia()}
        conversaId="c1"
        destinoDoPapel="comercial"
        agora={AGORA}
      />,
    );
    const faixa = screen.getByRole("region", { name: "Transferência aberta" });
    expect(faixa).toHaveTextContent("Quer contratar");
    expect(faixa).toHaveTextContent("vence em 38 min");
    expect(faixa).toHaveTextContent("Com o comercial, desde as 12:38.");
    expect(faixa).toHaveTextContent("Imersão, Pix, DPP 15/11/2026.");
    expect(
      screen.getByRole("button", { name: "Assumir conversa" }),
    ).toBeInTheDocument();

    await usuario.click(
      screen.getByRole("button", { name: "Marcar como resolvida" }),
    );
    expect(screen.getByLabelText("Sem retorno")).toBeInTheDocument();
  });

  it("assumida por quem vê: diz 'assumida por você' e some o assumir", () => {
    render(
      <FaixaTransferencia
        transferencia={transferencia({
          status: "assumido",
          assumidoPor: "u1",
          assumidoEm: "2026-09-24T15:40:00.000Z",
        })}
        conversaId="c1"
        usuarioId="u1"
        agora={AGORA}
      />,
    );
    expect(screen.getByText("Assumida por você às 12:40")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Assumir conversa" }),
    ).not.toBeInTheDocument();
  });

  it("aviso ao grupo que falhou: a linha com 'Reenviar aviso', como na fila", () => {
    render(
      <FaixaTransferencia
        transferencia={transferencia({ notificacaoOk: false })}
        conversaId="c1"
        agora={AGORA}
      />,
    );
    expect(screen.getByText(/O aviso ao grupo não saiu/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reenviar aviso" }),
    ).toBeInTheDocument();
  });

  it("pedido de conversa com a coordenação leva à agenda (P29)", () => {
    render(
      <FaixaTransferencia
        transferencia={transferencia({
          motivo: "reuniao",
          motivoRotulo: "Quer a conversa com a coordenação",
          conversaId: null,
        })}
        conversaId={null}
        agora={AGORA}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Marcar na agenda" }),
    ).toHaveAttribute("href", "/sessoes-venda/nova?transferencia=t1");
  });

  it("perda vista pelo comercial: hora do relato, sem prazo, sem vermelho e sem assumir no lugar da coordenação (DESIGN.md 11.8)", () => {
    render(
      <FaixaTransferencia
        transferencia={transferencia({
          motivo: "perda",
          motivoRotulo: "Perda gestacional",
          prioridade: "maxima",
          destino: "coordenacao_clinica",
          slaVenceEm: "2026-09-24T16:00:00.000Z",
        })}
        conversaId="c1"
        destinoDoPapel="comercial"
        agora={AGORA}
      />,
    );
    const faixa = screen.getByRole("region", { name: "Transferência aberta" });
    expect(faixa).toHaveTextContent("recebida às 12:38");
    expect(faixa).toHaveTextContent("Ainda sem contato da equipe.");
    expect(faixa).not.toHaveTextContent(/vence em|venceu há/);
    expect(faixa.querySelector(".text-alerta, .bg-alerta-lavado")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Assumir conversa" }),
    ).not.toBeInTheDocument();
    expect(faixa).toHaveTextContent(
      "Quem assume e encerra esta transferência é a coordenação clínica.",
    );
  });

  it("relato de saúde continua destacado em alerta, como na fila", () => {
    render(
      <FaixaTransferencia
        transferencia={transferencia({
          motivo: "saude",
          motivoRotulo: "Relato de saúde",
          prioridade: "maxima",
        })}
        conversaId="c1"
        agora={AGORA}
      />,
    );
    const faixa = screen.getByRole("region", { name: "Transferência aberta" });
    expect(faixa.className).toContain("bg-alerta-lavado");
    expect(
      screen.getByRole("heading", { name: "Relato de saúde" }),
    ).toHaveClass("text-alerta");
  });
});
