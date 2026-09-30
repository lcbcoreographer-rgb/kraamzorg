import { describe, expect, it } from "vitest";
import { cumprimentoDoHorario, primeiroNome, saudacao } from "./saudacao";

describe("saudação das telas de abertura", () => {
  it("usa a hora de Brasília, não a do servidor", () => {
    // 11:30 UTC = 08:30 em Brasília.
    expect(cumprimentoDoHorario(new Date("2026-09-30T11:30:00Z"))).toBe(
      "Bom dia",
    );
    // 15:00 UTC = 12:00 em Brasília.
    expect(cumprimentoDoHorario(new Date("2026-09-30T15:00:00Z"))).toBe(
      "Boa tarde",
    );
    // 21:00 UTC = 18:00 em Brasília.
    expect(cumprimentoDoHorario(new Date("2026-09-30T21:00:00Z"))).toBe(
      "Boa noite",
    );
    // 06:00 UTC = 03:00 em Brasília.
    expect(cumprimentoDoHorario(new Date("2026-09-30T06:00:00Z"))).toBe(
      "Boa noite",
    );
  });

  it("chama pelo primeiro nome e dispensa o nome quando não há", () => {
    expect(primeiroNome("Talita Moreno")).toBe("Talita");
    expect(primeiroNome("  ")).toBeNull();
    expect(saudacao("Rosana Vieira", new Date("2026-09-30T13:00:00Z"))).toBe(
      "Bom dia, Rosana",
    );
    expect(saudacao(null, new Date("2026-09-30T13:00:00Z"))).toBe("Bom dia");
  });
});
