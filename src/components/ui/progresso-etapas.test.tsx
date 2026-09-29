import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinhaGestacao } from "./linha-gestacao";
import { ProgressoEtapas, segmentosDoProgresso } from "./progresso-etapas";

describe("ProgressoEtapas (DESIGN.md seção 6, família blocos)", () => {
  it("até 12 etapas, um bloco por etapa: feitas, atual e futuras", () => {
    const { container } = render(
      <ProgressoEtapas etapas={["A", "B", "C", "D"]} atual={1} />,
    );
    const blocos = [...container.querySelectorAll("[data-estado]")].map((b) =>
      b.getAttribute("data-estado"),
    );
    expect(blocos).toEqual(["feito", "atual", "futuro", "futuro"]);
  });

  it("acima de 12, agrupa por seção do instrumento", () => {
    const ids = ["1", "2", "2.1", "2.2", "2.3", "3", "3.1", "4", "5", "6"];
    const muitos = [...ids, "7", "8", "9", "ultimo_dia", "assinatura"];
    const segmentos = segmentosDoProgresso(muitos);
    expect(segmentos.map((s) => [s.chave, s.tamanho])).toEqual([
      ["1", 1],
      ["2", 4],
      ["3", 2],
      ["4", 1],
      ["5", 1],
      ["6", 1],
      ["7", 1],
      ["8", 1],
      ["9", 1],
      ["ultimo_dia", 1],
      ["assinatura", 1],
    ]);
  });

  it("não é barra de biblioteca: nenhum width em porcentagem", () => {
    const { container } = render(
      <ProgressoEtapas etapas={["A", "B"]} atual={0} />,
    );
    expect(container.innerHTML).not.toMatch(/width:\s*\d+%/);
  });
});

describe("LinhaGestacao (DESIGN.md 11.9, proposta P2-1)", () => {
  it("dez blocos de quatro semanas, cheios até a semana atual, com a frase no rótulo", () => {
    const { container, getByRole } = render(
      <LinhaGestacao semanas={32} dias={4} dpp="15/11/2026" destacarAtual />,
    );
    expect(
      getByRole("img", {
        name: "32 semanas e 4 dias, DPP estimada em 15/11/2026",
      }),
    ).toBeInTheDocument();
    const blocos = container.querySelectorAll("[role=img] > span");
    expect(blocos).toHaveLength(10);
    // Semana 32 cai no nono bloco (32 a 35): oito cheios antes dele.
    expect(blocos[8]!.className).toMatch(/border-dourado/);
    expect(blocos[9]!.className).toMatch(/border-dashed/);
    expect(container).toHaveTextContent("estimativa");
  });

  it("nas listas, sem o acento dourado", () => {
    const { container } = render(
      <LinhaGestacao semanas={20} dias={0} dpp="01/02/2027" semLegenda />,
    );
    expect(container.innerHTML).not.toMatch(/border-dourado/);
    expect(container).not.toHaveTextContent("estimativa");
  });
});
