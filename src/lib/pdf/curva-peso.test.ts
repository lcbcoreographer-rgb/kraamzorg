import { describe, expect, it } from "vitest";
import {
  calcularCurvaPeso,
  calcularDiaDeVida,
  classificarEvolucaoPeso,
} from "./curva-peso";

describe("calcularDiaDeVida", () => {
  it("dia do nascimento é dia 0 (K-11)", () => {
    expect(calcularDiaDeVida("2026-09-01", "2026-09-01")).toBe(0);
  });

  it("conta os dias seguintes normalmente", () => {
    expect(calcularDiaDeVida("2026-09-01", "2026-09-08")).toBe(7);
  });
});

describe("calcularCurvaPeso", () => {
  it("acompanhamento sintético completo: menor peso, não a alta, é a base do ganho", () => {
    const curva = calcularCurvaPeso(3200, "2026-09-01", [
      { data: "2026-09-04", pesoG: 3000, origem: "alta_hospitalar" },
      { data: "2026-09-05", pesoG: 3050, origem: "domicilio" },
      { data: "2026-09-11", pesoG: 3400, origem: "domicilio" },
    ]);

    expect(curva.pesoNascimentoG).toBe(3200);
    expect(curva.menorPesoG).toBe(3000);
    expect(curva.dataMenorPeso).toBe("2026-09-04");
    expect(curva.diaVidaMenorPeso).toBe(3);
    // (3200 - 3000) / 3200 * 100 = 6.25 -> 6.3 (uma casa, arredondado)
    expect(curva.perdaPercentual).toBe(6.3);
    expect(curva.pesoFinalG).toBe(3400);
    expect(curva.dataPesoFinal).toBe("2026-09-11");
    expect(curva.diaVidaPesoFinal).toBe(10);
    expect(curva.ganhoAbsolutoG).toBe(400); // 3400 - 3000
    expect(curva.diasEntreMenorEFinal).toBe(7); // D10 - D3
    // 400 / 7 = 57.14... -> 57.1
    expect(curva.ganhoMedioDiarioGDia).toBe(57.1);
    expect(curva.recuperouPesoNascimento).toBe(true);
    expect(classificarEvolucaoPeso(curva)).toBe("progressivo");
  });

  it("sem nenhuma pesagem além do nascimento: ganho e perda zerados", () => {
    const curva = calcularCurvaPeso(3200, "2026-09-01", []);
    expect(curva.menorPesoG).toBe(3200);
    expect(curva.perdaPercentual).toBe(0);
    expect(curva.ganhoAbsolutoG).toBe(0);
    expect(curva.diasEntreMenorEFinal).toBe(0);
    expect(curva.ganhoMedioDiarioGDia).toBe(0);
    expect(classificarEvolucaoPeso(curva)).toBe("estavel");
  });

  it("bebê que segue perdendo peso até a última pesagem", () => {
    const curva = calcularCurvaPeso(3200, "2026-09-01", [
      { data: "2026-09-04", pesoG: 3000, origem: "alta_hospitalar" },
      { data: "2026-09-08", pesoG: 2900, origem: "domicilio" },
    ]);

    expect(curva.menorPesoG).toBe(2900);
    expect(curva.dataMenorPeso).toBe("2026-09-08");
    // (3200-2900)/3200*100 = 9.375 -> 9.4
    expect(curva.perdaPercentual).toBe(9.4);
    expect(curva.recuperouPesoNascimento).toBe(false);
    expect(classificarEvolucaoPeso(curva)).toBe("perda");
  });

  it("peso final igual ao de nascimento classifica como estável", () => {
    const curva = calcularCurvaPeso(3200, "2026-09-01", [
      { data: "2026-09-04", pesoG: 3000, origem: "alta_hospitalar" },
      { data: "2026-09-10", pesoG: 3200, origem: "domicilio" },
    ]);
    expect(classificarEvolucaoPeso(curva)).toBe("estavel");
  });

  it("rejeita peso de nascimento não finito ou não positivo", () => {
    expect(() => calcularCurvaPeso(0, "2026-09-01", [])).toThrow(RangeError);
    expect(() => calcularCurvaPeso(Number.NaN, "2026-09-01", [])).toThrow(
      RangeError,
    );
  });

  it("rejeita pesagem com peso inválido", () => {
    expect(() =>
      calcularCurvaPeso(3200, "2026-09-01", [
        { data: "2026-09-04", pesoG: -10, origem: "domicilio" },
      ]),
    ).toThrow(RangeError);
  });

  it("rejeita data fora do formato aaaa-mm-dd", () => {
    expect(() => calcularDiaDeVida("01/09/2026", "2026-09-01")).toThrow(
      RangeError,
    );
  });
});
