import { describe, expect, it } from "vitest";
import {
  dataEmBrasilia,
  diaDaSemanaDesdeSegunda,
  diferencaEmDias,
  eDataValida,
  horaCurta,
  horaEmBrasilia,
  hojeEmBrasilia,
  inicioDaSemana,
  instanteEmBrasilia,
  minutosDaHora,
  somarDias,
} from "./datas";

describe("datas de calendário", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-09-29", 2)).toBe("2026-10-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("diferença em dias com sinal", () => {
    expect(diferencaEmDias("2026-09-20", "2026-09-30")).toBe(10);
    expect(diferencaEmDias("2026-09-30", "2026-09-20")).toBe(-10);
  });

  it("a semana começa na segunda", () => {
    // 29/09/2026 é terça-feira
    expect(diaDaSemanaDesdeSegunda("2026-09-29")).toBe(1);
    expect(inicioDaSemana("2026-09-29")).toBe("2026-09-28");
    expect(inicioDaSemana("2026-09-28")).toBe("2026-09-28");
    expect(inicioDaSemana("2026-10-04")).toBe("2026-09-28");
    expect(inicioDaSemana("2026-10-05")).toBe("2026-10-05");
  });

  it("valida data de calendário", () => {
    expect(eDataValida("2026-02-28")).toBe(true);
    expect(eDataValida("2026-02-30")).toBe(false);
    expect(eDataValida("28/02/2026")).toBe(false);
  });
});

describe("hora e fuso", () => {
  it("hoje em Brasília não vira o dia pelo UTC", () => {
    // 01:30 UTC de 30/09 ainda é 22:30 de 29/09 em Brasília
    expect(hojeEmBrasilia(new Date("2026-09-30T01:30:00Z"))).toBe("2026-09-29");
    expect(hojeEmBrasilia(new Date("2026-09-30T03:00:00Z"))).toBe("2026-09-30");
  });

  it("hora e data de um instante, em Brasília", () => {
    expect(horaEmBrasilia("2026-09-29T11:07:00Z")).toBe("08:07");
    expect(dataEmBrasilia("2026-09-30T01:30:00Z")).toBe("2026-09-29");
    expect(horaEmBrasilia("lixo")).toBeNull();
  });

  it("minutos e hora curta", () => {
    expect(minutosDaHora("08:30:00")).toBe(510);
    expect(minutosDaHora("24:00")).toBeNull();
    expect(minutosDaHora(null)).toBeNull();
    expect(horaCurta("08:00:00")).toBe("08:00");
  });

  it("instante de uma data e hora de Brasília", () => {
    expect(instanteEmBrasilia("2026-09-29", "08:00")).toBe(
      "2026-09-29T11:00:00.000Z",
    );
    expect(instanteEmBrasilia("2026-13-29", "08:00")).toBeNull();
    expect(instanteEmBrasilia("2026-09-29", "25:00")).toBeNull();
  });
});
