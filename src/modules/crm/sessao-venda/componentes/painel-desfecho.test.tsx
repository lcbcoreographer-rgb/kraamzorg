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
import { PainelDesfecho } from "./painel-desfecho";

const SESSAO = "11111111-1111-4111-8111-111111111111";

describe("PainelDesfecho (P29 item 2, v4.3)", () => {
  it("a Edilaine vê aconteceu e não veio numa reunião da Isadora, e nunca cancelar", () => {
    render(
      <PainelDesfecho
        sessaoId={SESSAO}
        jaPassou
        podeRegistrar
        podeCancelar={false}
        daIsadora
      />,
    );
    expect(screen.getByLabelText("Aconteceu")).toBeInTheDocument();
    expect(screen.getByLabelText("A família não veio")).toBeInTheDocument();
    expect(screen.queryByLabelText("Foi cancelada")).toBeNull();
  });

  it("aconteceu abre o campo do resultado e diz que a conversa passa ao Leonardo", async () => {
    const usuario = userEvent.setup();
    render(
      <PainelDesfecho
        sessaoId={SESSAO}
        jaPassou
        podeRegistrar
        podeCancelar={false}
        daIsadora
      />,
    );
    expect(
      screen.queryByLabelText(/Como foi a reunião, em uma frase/),
    ).toBeNull();
    await usuario.click(screen.getByLabelText("Aconteceu"));
    expect(
      screen.getByLabelText(/Como foi a reunião, em uma frase/),
    ).toHaveAttribute("maxlength", "300");
    expect(
      screen.getByText(/a conversa passa para o Leonardo e a Isadora deixa de/),
    ).toBeInTheDocument();
  });

  it("não veio, numa reunião da Isadora, avisa que ela remarca sem cobrar", async () => {
    const usuario = userEvent.setup();
    render(
      <PainelDesfecho
        sessaoId={SESSAO}
        jaPassou
        podeRegistrar
        podeCancelar={false}
        daIsadora
      />,
    );
    await usuario.click(screen.getByLabelText("A família não veio"));
    expect(screen.getByText(/sem cobrar/)).toBeInTheDocument();
  });

  it("o comercial, numa reunião da Isadora, não tem botão: a tela diz quem registra", () => {
    render(
      <PainelDesfecho
        sessaoId={SESSAO}
        jaPassou
        podeRegistrar={false}
        podeCancelar={false}
        daIsadora
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByText(/A Edilaine registra como foi a reunião/),
    ).toBeInTheDocument();
  });

  it("o comercial, numa reunião da equipe que já passou, só pode cancelar", () => {
    render(
      <PainelDesfecho
        sessaoId={SESSAO}
        jaPassou
        podeRegistrar={false}
        podeCancelar
        daIsadora={false}
      />,
    );
    expect(screen.getByLabelText("Foi cancelada")).toBeInTheDocument();
    expect(screen.queryByLabelText("Aconteceu")).toBeNull();
  });

  it("antes do horário, numa reunião da Isadora, a tela explica e não oferece cancelar", () => {
    render(
      <PainelDesfecho
        sessaoId={SESSAO}
        jaPassou={false}
        podeRegistrar
        podeCancelar={false}
        daIsadora
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByText(/a Isadora cuida e o CRM se atualiza sozinho/),
    ).toBeInTheDocument();
  });

  it("antes do horário, numa reunião da equipe, dá para cancelar", () => {
    render(
      <PainelDesfecho
        sessaoId={SESSAO}
        jaPassou={false}
        podeRegistrar
        podeCancelar
        daIsadora={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Cancelar a conversa" }),
    ).toBeInTheDocument();
  });
});
