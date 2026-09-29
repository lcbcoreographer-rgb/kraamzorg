import { describe, expect, it } from "vitest";
import { centavosParaCampo, reaisParaCentavos } from "./valor";

describe("valor em reais para centavos", () => {
  it("aceita os jeitos de escrever", () => {
    expect(reaisParaCentavos("4550")).toBe(455000);
    expect(reaisParaCentavos("4.550")).toBe(455000);
    expect(reaisParaCentavos("4.550,00")).toBe(455000);
    expect(reaisParaCentavos("4550,5")).toBe(455050);
    expect(reaisParaCentavos("R$ 3.433,33")).toBe(343333);
    expect(reaisParaCentavos("1.234.567,89")).toBe(123456789);
    expect(reaisParaCentavos("4550.50")).toBe(455050);
    expect(reaisParaCentavos("0,01")).toBe(1);
  });

  it("recusa o que não é valor", () => {
    for (const ruim of [
      "",
      "  ",
      "abc",
      "0",
      "0,00",
      "-10",
      "10,999",
      "1,2,3",
      "R$",
      "4550,0x",
    ]) {
      expect(reaisParaCentavos(ruim), ruim).toBeNull();
    }
  });

  it("centavos para o campo", () => {
    expect(centavosParaCampo(455000)).toBe("4550,00");
    expect(centavosParaCampo(343333)).toBe("3433,33");
  });
});
