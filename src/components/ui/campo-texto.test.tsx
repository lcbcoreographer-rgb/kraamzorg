import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CampoTexto } from "./campo-texto";

describe("CampoTexto", () => {
  it("liga a descrição ao campo por aria-describedby", () => {
    render(
      <CampoTexto
        rotulo="Temperatura"
        descricao="Ontem: 36,6 °C."
        defaultValue="36,8"
      />,
    );

    const campo = screen.getByRole("textbox", { name: "Temperatura" });
    expect(campo).toHaveAccessibleDescription("Ontem: 36,6 °C.");
  });

  it("mantém a descrição visível junto com o erro, em vez de escondê-la", () => {
    render(
      <CampoTexto
        rotulo="Temperatura"
        descricao="Ontem: 36,6 °C."
        erro="8 bpm parece um dígito a menos. Confira e digite de novo."
        defaultValue="8"
      />,
    );

    // A referência do dia anterior não pode sumir quando o campo entra em
    // erro (achado da auditoria da P10 parcial).
    expect(screen.getByText("Ontem: 36,6 °C.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "8 bpm parece um dígito a menos. Confira e digite de novo.",
      ),
    ).toBeInTheDocument();

    const campo = screen.getByRole("textbox", { name: "Temperatura" });
    expect(campo).toHaveAccessibleDescription(
      "Ontem: 36,6 °C. 8 bpm parece um dígito a menos. Confira e digite de novo.",
    );
  });

  it("anuncia a mensagem de erro com role alert", () => {
    render(<CampoTexto rotulo="Temperatura" erro="Valor fora do esperado." />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Valor fora do esperado.",
    );
  });
});
