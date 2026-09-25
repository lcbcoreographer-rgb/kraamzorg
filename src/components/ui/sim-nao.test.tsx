import { fireEvent, render, screen } from "@testing-library/react";
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

  it("pinta a pergunta de alerta quando o estado é alerta-clinico", () => {
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

    expect(screen.getByText("Sangramento fora do esperado?")).toHaveClass(
      "text-alerta",
    );
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
