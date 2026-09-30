import { describe, expect, it } from "vitest";
import { calcularCurvaPeso, umaCasa } from "./curva-peso";

describe("curva de peso do recém-nascido (PRD 9.2, K-11)", () => {
  const base = {
    pesoNascimentoG: 3300,
    dataNascimento: "2026-09-20",
    pesoAltaG: 3100,
    dataAlta: "2026-09-22",
  };

  it("perda percentual, menor peso, ganho absoluto e ganho médio diário com uma casa decimal", () => {
    const curva = calcularCurvaPeso({
      ...base,
      pesosDasVisitas: [
        { data: "2026-09-23", pesoG: 3080 },
        { data: "2026-09-24", pesoG: 3120 },
        { data: "2026-09-26", pesoG: 3190 },
      ],
    });
    expect(curva).toEqual({
      pesoNascimentoG: 3300,
      menorPesoG: 3080,
      dataMenorPeso: "2026-09-23",
      ultimoPesoG: 3190,
      dataUltimoPeso: "2026-09-26",
      perdaPercentual: 6.7,
      ganhoAbsolutoG: 110,
      diasDesdeMenorPeso: 3,
      ganhoMedioDiarioG: 36.7,
    });
  });

  it("o ganho parte do MENOR peso registrado, não do peso ao nascer nem do primeiro", () => {
    const curva = calcularCurvaPeso({
      ...base,
      pesosDasVisitas: [
        { data: "2026-09-23", pesoG: 3200 },
        { data: "2026-09-24", pesoG: 3050 },
        { data: "2026-09-25", pesoG: 3110 },
      ],
    })!;
    expect(curva.menorPesoG).toBe(3050);
    expect(curva.dataMenorPeso).toBe("2026-09-24");
    expect(curva.ganhoAbsolutoG).toBe(60);
    expect(curva.ganhoMedioDiarioG).toBe(60);
  });

  it("o peso na alta também pode ser o menor", () => {
    const curva = calcularCurvaPeso({
      ...base,
      pesoAltaG: 3000,
      pesosDasVisitas: [{ data: "2026-09-23", pesoG: 3040 }],
    })!;
    expect(curva.menorPesoG).toBe(3000);
    expect(curva.dataMenorPeso).toBe("2026-09-22");
    expect(curva.ganhoMedioDiarioG).toBe(40);
  });

  it("sem perda, a perda percentual é zero, nunca negativa", () => {
    const curva = calcularCurvaPeso({
      ...base,
      pesoAltaG: 3300,
      pesosDasVisitas: [{ data: "2026-09-23", pesoG: 3400 }],
    })!;
    expect(curva.menorPesoG).toBe(3300);
    expect(curva.perdaPercentual).toBe(0);
  });

  it("um peso só: sem dias entre o menor e o último, o ganho médio diário fica em branco", () => {
    const curva = calcularCurvaPeso({
      pesoNascimentoG: null,
      dataNascimento: null,
      pesoAltaG: null,
      dataAlta: null,
      pesosDasVisitas: [{ data: "2026-09-23", pesoG: 3080 }],
    })!;
    expect(curva.ganhoAbsolutoG).toBe(0);
    expect(curva.ganhoMedioDiarioG).toBeNull();
    expect(curva.perdaPercentual).toBeNull();
  });

  it("sem nenhum peso não há curva", () => {
    expect(
      calcularCurvaPeso({
        pesoNascimentoG: null,
        dataNascimento: null,
        pesoAltaG: null,
        dataAlta: null,
        pesosDasVisitas: [],
      }),
    ).toBeNull();
  });

  it("ignora peso zero ou negativo (digitação)", () => {
    const curva = calcularCurvaPeso({
      ...base,
      pesosDasVisitas: [
        { data: "2026-09-23", pesoG: 0 },
        { data: "2026-09-24", pesoG: 3150 },
      ],
    })!;
    expect(curva.menorPesoG).toBe(3100);
  });

  it("umaCasa arredonda para uma casa", () => {
    expect(umaCasa(36.666)).toBe(36.7);
    expect(umaCasa(6.65)).toBe(6.7);
    expect(umaCasa(2)).toBe(2);
  });
});
