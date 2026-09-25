import { describe, expect, it } from "vitest";
import { formatarTelefone } from "./telefone";

describe("formatarTelefone", () => {
  it("formata celular (9 dígitos) com DDD entre parênteses", () => {
    expect(formatarTelefone("+5511990000001")).toBe("+55 (11) 99000-0001");
  });

  it("formata fixo (8 dígitos)", () => {
    expect(formatarTelefone("+551133334444")).toBe("+55 (11) 3333-4444");
  });

  it("aceita DDD de dois dígitos com zero à esquerda ausente (Ex: 21)", () => {
    expect(formatarTelefone("+5521998887777")).toBe("+55 (21) 99888-7777");
  });

  it("devolve o valor original quando não é um telefone brasileiro", () => {
    expect(formatarTelefone("+12025550123")).toBe("+12025550123");
  });

  it("devolve o valor original quando não está em E.164", () => {
    expect(formatarTelefone("11990000001")).toBe("11990000001");
  });

  it("devolve string vazia sem quebrar", () => {
    expect(formatarTelefone("")).toBe("");
  });

  it("tira espaços nas pontas antes de comparar", () => {
    expect(formatarTelefone("  +5511990000001  ")).toBe("+55 (11) 99000-0001");
  });
});
