import { describe, expect, it } from "vitest";
import { formatarMoeda } from "./moeda";

describe("formatarMoeda", () => {
  it("formata milhar redondo sem casas decimais", () => {
    expect(formatarMoeda(420000)).toBe("R$ 4.200");
  });

  it("formata com centavos quando houver", () => {
    expect(formatarMoeda(143333)).toBe("R$ 1.433,33");
  });

  it("formata zero", () => {
    expect(formatarMoeda(0)).toBe("R$ 0");
  });

  it("formata um único centavo", () => {
    expect(formatarMoeda(1)).toBe("R$ 0,01");
  });

  it("formata valor negativo (estorno, desconto)", () => {
    expect(formatarMoeda(-420000)).toBe("-R$ 4.200");
  });

  it("formata valor negativo com centavos", () => {
    expect(formatarMoeda(-150)).toBe("-R$ 1,50");
  });

  it("arredonda centavos fracionários (defensivo)", () => {
    expect(formatarMoeda(100.4)).toBe("R$ 1");
  });

  it("não quebra com entrada não finita", () => {
    expect(formatarMoeda(Number.NaN)).toBe("R$ 0");
    expect(formatarMoeda(Number.POSITIVE_INFINITY)).toBe("R$ 0");
  });

  it("formata valores grandes com separador de milhar", () => {
    expect(formatarMoeda(100_000_000)).toBe("R$ 1.000.000");
  });
});
