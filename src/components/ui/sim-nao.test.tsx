import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SimNao } from "./sim-nao";

describe("SimNao", () => {
  it("não vem com valor marcado por padrão", () => {
    render(
      <SimNao
        pergunta="Febre nas últimas 24 horas?"
        name="febre"
        rotuloSim="Sim"
        rotuloNao="Não"
      />,
    );

    expect(screen.getByRole("radio", { name: "Sim" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Não" })).not.toBeChecked();
  });

  it("chama onMudar com o valor escolhido ao tocar na pílula", () => {
    const aoMudar = vi.fn();
    render(
      <SimNao
        pergunta="Febre nas últimas 24 horas?"
        name="febre"
        rotuloSim="Sim"
        rotuloNao="Não"
        onMudar={aoMudar}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Sim" }));

    expect(aoMudar).toHaveBeenCalledWith("sim");
  });

  it("mostra a opção marcada quando controlado", () => {
    render(
      <SimNao
        pergunta="Sangramento?"
        name="sangramento"
        rotuloSim="Sim"
        rotuloNao="Não"
        valor="nao"
        onMudar={() => {}}
      />,
    );

    expect(screen.getByRole("radio", { name: "Não" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Sim" })).not.toBeChecked();
  });

  it("marca o estado alerta-clinico na pergunta, sem depender só da cor", () => {
    render(
      <SimNao
        pergunta="Sangramento fora do esperado?"
        name="sangramento"
        rotuloSim="Sim"
        rotuloNao="Não"
        valor="sim"
        estado="alerta-clinico"
      />,
    );

    expect(screen.getByText("Sangramento fora do esperado?")).toHaveAttribute(
      "data-estado",
      "alerta-clinico",
    );
  });

  it("funciona não controlado, com valorPadrao e sem valor de fora", async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    render(
      <SimNao
        pergunta="Febre nas últimas 24 horas?"
        name="febre"
        rotuloSim="Sim"
        rotuloNao="Não"
        valorPadrao="nao"
        onMudar={aoMudar}
      />,
    );

    expect(screen.getByRole("radio", { name: "Não" })).toBeChecked();

    await usuario.click(screen.getByRole("radio", { name: "Sim" }));

    expect(screen.getByRole("radio", { name: "Sim" })).toBeChecked();
    expect(aoMudar).toHaveBeenCalledWith("sim");
  });

  it("navega entre as opções pelo teclado (Tab e setas do radiogroup)", async () => {
    const usuario = userEvent.setup();
    render(
      <SimNao
        pergunta="Febre nas últimas 24 horas?"
        name="febre"
        rotuloSim="Sim"
        rotuloNao="Não"
        valorPadrao="sim"
      />,
    );

    await usuario.tab();
    expect(screen.getByRole("radio", { name: "Sim" })).toHaveFocus();

    await usuario.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Não" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Não" })).toBeChecked();
  });

  it("associa a pergunta ao grupo de opções por aria-labelledby", () => {
    render(
      <SimNao pergunta="Febre?" name="febre" rotuloSim="Sim" rotuloNao="Não" />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "Febre?" }),
    ).toBeInTheDocument();
  });
});
