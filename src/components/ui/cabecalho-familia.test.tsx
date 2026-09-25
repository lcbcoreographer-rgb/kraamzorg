import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CabecalhoFamilia } from "./cabecalho-familia";

const DATAS = [
  { rotulo: "DPP", valor: "25/09/2026", tipo: "estimativa" as const },
  { rotulo: "Nascimento", valor: "18/09/2026", tipo: "fato" as const },
  { rotulo: "Alta", valor: "20/09/2026", tipo: "fato" as const },
  { rotulo: "Início", valor: "21/09/2026", tipo: "fato" as const },
];

describe("CabecalhoFamilia", () => {
  it("mostra o nome e as quatro datas com estimativa e fato", () => {
    render(
      <CabecalhoFamilia
        nome="Família Teste Aurora"
        datas={DATAS}
        acaoFreio={<button>Freio</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Família Teste Aurora" }),
    ).toBeInTheDocument();
    expect(screen.getByText("DPP")).toBeInTheDocument();
    expect(screen.getByText("25/09/2026")).toBeInTheDocument();
    expect(screen.getByText("estimativa")).toBeInTheDocument();
    expect(screen.getAllByText("fato")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Freio" })).toBeInTheDocument();
  });

  it("vira ameixa e mostra a frase de bloqueio quando o freio está ativo", () => {
    render(
      <CabecalhoFamilia
        nome="Família Teste Brisa"
        datas={DATAS}
        freioAtivo
        textoFreioAtivo="Freio em bloqueio total desde 24/09/2026, 09:14. Só contato humano e nominal."
        rotuloFreioAtivo="Freio ativo"
      />,
    );

    expect(
      screen.getByText(
        "Freio em bloqueio total desde 24/09/2026, 09:14. Só contato humano e nominal.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Freio ativo")).toBeInTheDocument();
    // As datas não aparecem mais: o freio ativo troca a área por só a frase de bloqueio.
    expect(screen.queryByText("DPP")).not.toBeInTheDocument();
  });
});
