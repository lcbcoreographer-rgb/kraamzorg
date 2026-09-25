import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FaixaAlerta } from "./faixa-alerta";

describe("FaixaAlerta", () => {
  it("usa role alert nos estados de risco que devem anunciar", () => {
    render(
      <FaixaAlerta variante="imediato" titulo="Febre de 38,2 °C na puérpera">
        Acione a supervisão médica agora.
      </FaixaAlerta>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Febre de 38,2 °C na puérpera",
    );
  });

  it("usa role status no estado informativo, sem risco", () => {
    render(
      <FaixaAlerta variante="info" titulo="Sem sinal agora">
        O registro está salvo no aparelho.
      </FaixaAlerta>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Sem sinal agora");
  });

  it("respeita anunciar=false mesmo num estado de risco", () => {
    render(
      <FaixaAlerta
        variante="prioritario"
        titulo="Prazo de resposta perto do fim"
        anunciar={false}
      >
        Restam 22 minutos.
      </FaixaAlerta>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
