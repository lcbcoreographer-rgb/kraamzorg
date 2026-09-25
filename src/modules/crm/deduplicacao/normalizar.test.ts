import { describe, expect, it } from "vitest";
import {
  diferencaDias,
  digitosTelefone,
  mesmoTelefone,
  normalizarNome,
  normalizarTelefoneBr,
  similaridadeNome,
} from "./normalizar";

describe("normalizarTelefoneBr", () => {
  it("celular com DDD, sem pontuação, vira E.164", () => {
    expect(normalizarTelefoneBr("11900000301")).toBe("+5511900000301");
  });

  it("com pontuação e espaços", () => {
    expect(normalizarTelefoneBr("(11) 90000-0301")).toBe("+5511900000301");
  });

  it("já em E.164 passa direto", () => {
    expect(normalizarTelefoneBr("+5511900000301")).toBe("+5511900000301");
  });

  it("com 55 mas sem +", () => {
    expect(normalizarTelefoneBr("5511900000301")).toBe("+5511900000301");
  });

  it("null para algo que não é um telefone", () => {
    expect(normalizarTelefoneBr("123")).toBeNull();
    expect(normalizarTelefoneBr("abc")).toBeNull();
  });
});

describe("mesmoTelefone", () => {
  it("compara os últimos 11 dígitos, com ou sem +55", () => {
    expect(mesmoTelefone("+5511900000301", "11900000301")).toBe(true);
    expect(mesmoTelefone("+5511900000301", "+5511900000302")).toBe(false);
  });
});

describe("digitosTelefone", () => {
  it("só os dígitos", () => {
    expect(digitosTelefone("+55 (11) 90000-0301")).toBe("5511900000301");
  });
});

describe("normalizarNome", () => {
  it("minúsculo, sem acento, um espaço só", () => {
    expect(normalizarNome("Família  Teste Íris")).toBe("familia teste iris");
  });
});

describe("similaridadeNome", () => {
  it("1 para o nome idêntico", () => {
    expect(
      similaridadeNome("Família Teste Aurora", "Família Teste Aurora"),
    ).toBe(1);
  });

  it("alta para nomes muito parecidos (erro de digitação)", () => {
    expect(
      similaridadeNome("Família Teste Aurora", "Familia Teste Arora"),
    ).toBeGreaterThan(0.5);
  });

  it("baixa para nomes bem diferentes", () => {
    expect(
      similaridadeNome("Beatriz Fernandes", "Ricardo Nogueira"),
    ).toBeLessThan(0.3);
  });

  it("moderada quando só o sobrenome de família é igual (não basta sozinho)", () => {
    // "Família Teste" em comum não deveria, sozinho, virar duplicata: por
    // isso a detecção também exige DPP próxima (deteccao.ts).
    expect(
      similaridadeNome("Família Teste Aurora", "Família Teste Íris"),
    ).toBeLessThan(0.6);
  });
});

describe("diferencaDias", () => {
  it("dias de calendário entre duas datas, sem depender da ordem", () => {
    expect(diferencaDias("2026-12-25", "2027-01-08")).toBe(14);
    expect(diferencaDias("2027-01-08", "2026-12-25")).toBe(14);
  });

  it("null para data fora do formato", () => {
    expect(diferencaDias("25/12/2026", "2027-01-08")).toBeNull();
  });
});
