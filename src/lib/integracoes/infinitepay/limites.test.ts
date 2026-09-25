import { describe, expect, it } from "vitest";
import {
  PARCELAS_MAX_SEM_JUROS_PADRAO,
  validarParcelasMaxSemJuros,
} from "./limites";

describe("validarParcelasMaxSemJuros", () => {
  it("aceita até o padrão de 3 parcelas", () => {
    expect(() => validarParcelasMaxSemJuros(1)).not.toThrow();
    expect(() => validarParcelasMaxSemJuros(3)).not.toThrow();
    expect(PARCELAS_MAX_SEM_JUROS_PADRAO).toBe(3);
  });

  it("recusa mais de 3 parcelas", () => {
    expect(() => validarParcelasMaxSemJuros(4)).toThrow(/3x/);
    expect(() => validarParcelasMaxSemJuros(12)).toThrow();
  });

  it("recusa valor não inteiro ou menor que 1", () => {
    expect(() => validarParcelasMaxSemJuros(0)).toThrow();
    expect(() => validarParcelasMaxSemJuros(-1)).toThrow();
    expect(() => validarParcelasMaxSemJuros(2.5)).toThrow();
  });
});
