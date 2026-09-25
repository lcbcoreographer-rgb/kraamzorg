import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Escala0a10 } from "./escala-0-a-10";

describe("Escala0a10", () => {
  it("mostra onze alvos, de 0 a 10", () => {
    render(<Escala0a10 rotulo="Dor agora" name="dor" />);

    for (let numero = 0; numero <= 10; numero += 1) {
      expect(
        screen.getByRole("radio", { name: String(numero) }),
      ).toBeInTheDocument();
    }
  });

  it("chama onMudar com o número escolhido", () => {
    const aoMudar = vi.fn();
    render(<Escala0a10 rotulo="Dor agora" name="dor" onMudar={aoMudar} />);

    fireEvent.click(screen.getByRole("radio", { name: "7" }));

    expect(aoMudar).toHaveBeenCalledWith(7);
  });

  it("marca a opção quando controlado", () => {
    render(
      <Escala0a10 rotulo="Dor agora" name="dor" valor={0} onMudar={() => {}} />,
    );

    expect(screen.getByRole("radio", { name: "0" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "10" })).not.toBeChecked();
  });

  it("mostra os extremos descritos quando informados", () => {
    render(
      <Escala0a10
        rotulo="Dor agora"
        name="dor"
        extremoMin="0 · sem dor"
        extremoMax="10 · pior dor possível"
      />,
    );

    expect(screen.getByText("0 · sem dor")).toBeInTheDocument();
    expect(screen.getByText("10 · pior dor possível")).toBeInTheDocument();
  });

  it("liga os extremos ao radiogroup por aria-describedby", () => {
    render(
      <Escala0a10
        rotulo="Dor agora"
        name="dor"
        extremoMin="0 · sem dor"
        extremoMax="10 · pior dor possível"
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Dor agora" }),
    ).toHaveAccessibleDescription("0 · sem dor 10 · pior dor possível");
  });

  it("funciona não controlado, com valorPadrao", async () => {
    const usuario = userEvent.setup();
    render(<Escala0a10 rotulo="Dor agora" name="dor" valorPadrao={3} />);

    expect(screen.getByRole("radio", { name: "3" })).toBeChecked();

    await usuario.click(screen.getByRole("radio", { name: "5" }));

    expect(screen.getByRole("radio", { name: "5" })).toBeChecked();
  });

  it("navega pelas opções com Tab e as setas do teclado", async () => {
    const usuario = userEvent.setup();
    render(<Escala0a10 rotulo="Dor agora" name="dor" valorPadrao={0} />);

    await usuario.tab();
    expect(screen.getByRole("radio", { name: "0" })).toHaveFocus();

    await usuario.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "1" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "1" })).toBeChecked();
  });
});
