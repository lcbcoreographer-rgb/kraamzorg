import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

  it("vira ameixa, mostra a frase de bloqueio e mantém as quatro datas visíveis (PRD 20.4)", () => {
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
    // As quatro datas continuam visíveis com o freio ativo (PRD 20.4: "sempre
    // visíveis na ficha"); só a linha de meta dá lugar à frase de bloqueio.
    expect(screen.getByText("DPP")).toBeInTheDocument();
    expect(screen.getByText("25/09/2026")).toBeInTheDocument();
  });

  it("mostra a data ausente como pílula tracejada, com a legenda de quando vira fato (P1 item 12)", () => {
    render(
      <CabecalhoFamilia
        nome="Família Teste Cedro"
        datas={[
          { rotulo: "Alta", valor: "Ainda não há", tipo: "ausente" as const },
        ]}
        acaoFreio={<button>Freio</button>}
      />,
    );

    const definicoes = screen.getAllByRole("definition");
    // O valor ("Ainda não há") e a legenda ("vira fato quando acontecer"),
    // nunca a legenda "estimativa"/"fato" de uma data que já aconteceu.
    expect(definicoes).toHaveLength(2);
    expect(definicoes[0]).toHaveTextContent("Ainda não há");
    expect(definicoes[1]).toHaveTextContent("vira fato quando acontecer");
  });

  it("leva o foco para o selo Freio ativo quando o botão de freio some do DOM", async () => {
    const usuario = userEvent.setup();

    function Exemplo() {
      const [ativo, definirAtivo] = React.useState(false);
      return (
        <CabecalhoFamilia
          nome="Família Teste Aurora"
          datas={DATAS}
          freioAtivo={ativo}
          textoFreioAtivo="Freio em bloqueio total."
          rotuloFreioAtivo="Freio ativo"
          acaoFreio={
            <button onClick={() => definirAtivo(true)}>Acionar freio</button>
          }
        />
      );
    }

    render(<Exemplo />);

    await usuario.click(screen.getByRole("button", { name: "Acionar freio" }));

    expect(screen.getByText("Freio ativo")).toHaveFocus();
  });

  it("chama acaoFreioAtivo ao tocar no selo Freio ativo, quando a prop é passada", async () => {
    const usuario = userEvent.setup();
    const aoAcionar = vi.fn();

    render(
      <CabecalhoFamilia
        nome="Família Teste Aurora"
        datas={DATAS}
        freioAtivo
        textoFreioAtivo="Freio em bloqueio total."
        rotuloFreioAtivo="Freio ativo"
        acaoFreioAtivo={aoAcionar}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: "Freio ativo" }));

    expect(aoAcionar).toHaveBeenCalledTimes(1);
  });
});
