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
        textoFreioAtivo="Freio em bloqueio total desde 24/09/2026, 09:14. Só contato humano e pelo nome."
        rotuloFreioAtivo="Freio ativo"
      />,
    );

    expect(
      screen.getByText(
        "Freio em bloqueio total desde 24/09/2026, 09:14. Só contato humano e pelo nome.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Freio ativo")).toBeInTheDocument();
    // As quatro datas continuam visíveis com o freio ativo (PRD 20.4: "sempre
    // visíveis na ficha"); só a linha de meta dá lugar à frase de bloqueio.
    expect(screen.getByText("DPP")).toBeInTheDocument();
    expect(screen.getByText("25/09/2026")).toBeInTheDocument();
  });

  it("data ausente mostra só 'ainda não', com uma legenda única para as quatro datas (DESIGN.md 11.1)", () => {
    render(
      <CabecalhoFamilia
        nome="Família Teste Cedro"
        datas={[
          { rotulo: "DPP", valor: "25/11/2026", tipo: "estimativa" as const },
          {
            rotulo: "Nascimento",
            valor: "ainda não",
            tipo: "ausente" as const,
          },
          { rotulo: "Alta", valor: "ainda não", tipo: "ausente" as const },
        ]}
        acaoFreio={<button>Freio</button>}
      />,
    );

    expect(screen.getAllByText("ainda não")).toHaveLength(2);
    expect(
      screen.queryByText("vira fato quando acontecer"),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        "A DPP é estimativa. Nascimento, alta e início entram quando acontecem.",
      ),
    ).toHaveLength(1);
  });

  it("sem data ausente, sem legenda", () => {
    render(
      <CabecalhoFamilia
        nome="Família Teste Aurora"
        datas={DATAS}
        acaoFreio={<button>Freio</button>}
      />,
    );
    expect(
      screen.queryByText(/entram quando acontecem/),
    ).not.toBeInTheDocument();
  });

  it("modo sensível: as quatro datas ficam, a ausente vira 'sem registro' e nenhuma frase promete o futuro (DESIGN.md 11.8)", () => {
    render(
      <CabecalhoFamilia
        nome="Família Teste Bruma"
        datas={[
          { rotulo: "DPP", valor: "ainda não", tipo: "ausente" as const },
          {
            rotulo: "Nascimento",
            valor: "ainda não",
            tipo: "ausente" as const,
          },
          { rotulo: "Alta", valor: "ainda não", tipo: "ausente" as const },
          { rotulo: "Início", valor: "ainda não", tipo: "ausente" as const },
        ]}
        freioAtivo
        modoSensivel
        textoFreioAtivo="Freio em bloqueio total desde 23/09/2026, 01:15. Só contato humano e pelo nome."
        rotuloFreioAtivo="Freio ativo"
      />,
    );

    for (const rotulo of ["DPP", "Nascimento", "Alta", "Início"]) {
      expect(screen.getByText(rotulo)).toBeInTheDocument();
    }
    expect(screen.getAllByText("sem registro")).toHaveLength(4);
    expect(screen.queryByText("ainda não")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/entram quando acontecem/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/vira fato/)).not.toBeInTheDocument();
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
