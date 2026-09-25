import { describe, expect, it } from "vitest";
import { formatarIdadeGestacional } from "./idade-gestacional";

describe("formatarIdadeGestacional", () => {
  it("formata semanas e dias no padrão 38s2d", () => {
    expect(formatarIdadeGestacional(38, 2)).toBe("38s2d");
  });

  it("formata zero dias", () => {
    expect(formatarIdadeGestacional(40, 0)).toBe("40s0d");
  });

  it("formata o limite superior comum (42 semanas)", () => {
    expect(formatarIdadeGestacional(42, 6)).toBe("42s6d");
  });

  it("trunca casas decimais em vez de arredondar (defensivo)", () => {
    expect(formatarIdadeGestacional(38.9, 2.9)).toBe("38s2d");
  });

  it("não quebra com entrada não finita", () => {
    expect(formatarIdadeGestacional(Number.NaN, Number.NaN)).toBe("0s0d");
  });

  it("lança erro com dias fora de 0 a 6", () => {
    expect(() => formatarIdadeGestacional(38, 9)).toThrow();
    expect(() => formatarIdadeGestacional(38, 7)).toThrow();
  });

  it("lança erro com valores negativos", () => {
    expect(() => formatarIdadeGestacional(-1, 2)).toThrow();
    expect(() => formatarIdadeGestacional(38, -1)).toThrow();
  });
});
