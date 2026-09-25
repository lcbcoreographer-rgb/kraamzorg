import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReguaDias, type DiaRegua } from "./regua-dias";

const DIAS: DiaRegua[] = [
  { numero: 1, rotuloData: "18/09", estado: "feito", rotuloEstado: "feito" },
  { numero: 2, rotuloData: "19/09", estado: "feito", rotuloEstado: "feito" },
  { numero: 3, rotuloData: "20/09", estado: "hoje", rotuloEstado: "hoje" },
  {
    numero: 4,
    rotuloData: "21/09",
    estado: "pendente",
    rotuloEstado: "pendente",
  },
  {
    numero: 5,
    rotuloData: "22/09",
    estado: "futuro",
    rotuloEstado: "futuro",
  },
  {
    numero: 6,
    rotuloData: "23/09",
    estado: "alerta",
    rotuloEstado: "alerta",
  },
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

  it("anuncia o estado de cada dia para o leitor de tela, além da cor", () => {
    render(<ReguaDias rotulo="Acompanhamento" dias={DIAS} />);

    const itens = screen.getAllByRole("listitem");
    // Cada item carrega o rótulo do estado em texto (não só em cor ou
    // hachura), acessível mesmo com a parte visual escondida do AT.
    expect(itens[3]).toHaveTextContent("pendente");
    expect(itens[5]).toHaveTextContent("alerta");
  });

  it("na versão fina, o item carrega dia, data e estado como texto acessível ao leitor de tela", () => {
    render(<ReguaDias rotulo="Acompanhamento" dias={DIAS} fina />);

    const [primeiroItem] = screen.getAllByRole("listitem");
    // "listitem" não tem nome computado a partir do conteúdo (ARIA), mas o
    // texto continua exposto ao leitor de tela: consultamos o conteúdo do
    // item, não uma classe de apresentação como "sr-only".
    expect(
      within(primeiroItem!).getByText("D1, 18/09, feito"),
    ).toBeInTheDocument();
  });
});
