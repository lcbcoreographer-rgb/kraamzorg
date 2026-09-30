// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PainelConversas } from "./painel-conversas";
import type { ConversaResumoTela } from "../tipos";

function conversa(
  quemConduz: ConversaResumoTela["quemConduz"],
): ConversaResumoTela {
  return {
    conversaId: "c1",
    quemConduz,
    nomeContato: "Marina",
    telefoneE164: "+5511900000301",
    mensagens: [
      {
        id: "m1",
        direcao: "entrada",
        enviadoPor: "cliente",
        tipo: "texto",
        conteudo: "Oi!",
        enviadaEm: "2026-09-29T15:00:00Z",
      },
    ],
  };
}

describe("aba Conversas da ficha: quem conduz (D-20)", () => {
  it("Isadora até a reunião realizada", () => {
    render(<PainelConversas conversa={conversa("isadora")} />);
    expect(screen.getByText("Isadora conduz a conversa")).toBeInTheDocument();
    expect(screen.getByText(/cuida da agenda da reunião/)).toBeInTheDocument();
  });

  it("Leonardo depois da reunião, e a Isadora só volta se a equipe devolver", () => {
    render(<PainelConversas conversa={conversa("leonardo")} />);
    expect(screen.getByText("Leonardo conduz a conversa")).toBeInTheDocument();
    expect(
      screen.getByText(/só volta se a equipe devolver/),
    ).toBeInTheDocument();
  });

  it("equipe enquanto a pausa não acaba", () => {
    render(<PainelConversas conversa={conversa("equipe")} />);
    expect(screen.getByText("Equipe conduz a conversa")).toBeInTheDocument();
  });

  it("fora de lead e cliente, nenhum selo", () => {
    render(<PainelConversas conversa={conversa(null)} />);
    expect(screen.queryByText(/conduz a conversa/)).toBeNull();
  });
});
