import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReguaDias, type DiaRegua } from "./regua-dias";

const DIAS: DiaRegua[] = [
  { numero: 1, rotuloData: "18/09", estado: "feito" },
  { numero: 2, rotuloData: "19/09", estado: "feito" },
  { numero: 3, rotuloData: "20/09", estado: "hoje" },
  { numero: 4, rotuloData: "21/09", estado: "pendente" },
  { numero: 5, rotuloData: "22/09", estado: "futuro" },
  { numero: 6, rotuloData: "23/09", estado: "alerta" },
];

describe("ReguaDias", () => {
  it("mostra um item por dia, com o número em D", () => {
    render(<ReguaDias rotulo="Acompanhamento" dias={DIAS} />);

    for (const dia of DIAS) {
      expect(screen.getByText(`D${dia.numero}`)).toBeInTheDocument();
    }
  });

  it("marca só o dia de hoje com aria-current", () => {
    render(<ReguaDias rotulo="Acompanhamento" dias={DIAS} />);

    const itens = screen.getAllByRole("listitem");
    const hoje = itens.filter(
      (item) => item.getAttribute("aria-current") === "date",
    );

    expect(hoje).toHaveLength(1);
    expect(hoje[0]).toHaveTextContent("D3");
  });

  it("tem rótulo acessível na lista inteira", () => {
    render(<ReguaDias rotulo="Acompanhamento, D1 a D6" dias={DIAS} />);

    expect(
      screen.getByRole("list", { name: "Acompanhamento, D1 a D6" }),
    ).toBeInTheDocument();
  });

  it("na versão fina, esconde número e data visualmente mas mantém acessível", () => {
    render(<ReguaDias rotulo="Acompanhamento" dias={DIAS} fina />);

    expect(screen.getByText("D1, 18/09")).toHaveClass("sr-only");
  });
});
