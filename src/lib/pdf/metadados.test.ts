import { describe, expect, it } from "vitest";
import { metadadosEvolucao, nomeArquivoEvolucao } from "./metadados";

describe("nomeArquivoEvolucao", () => {
  it("gera o nome pelo id, com extensão .pdf", () => {
    expect(nomeArquivoEvolucao("a1b2c3d4-0000-0000-0000-000000000001")).toBe(
      "a1b2c3d4-0000-0000-0000-000000000001.pdf",
    );
  });

  it("recusa id vazio ou com caractere fora do padrão", () => {
    expect(() => nomeArquivoEvolucao("")).toThrow(RangeError);
    expect(() => nomeArquivoEvolucao("Família Teste Aurora")).toThrow(
      RangeError,
    );
  });
});

describe("metadadosEvolucao", () => {
  it("autor Kraamzorg Brasil e idioma pt-BR (a função não recebe nome de paciente em nenhum campo)", () => {
    const metadados = metadadosEvolucao("puerperal");
    expect(metadados.author).toBe("Kraamzorg Brasil");
    expect(metadados.language).toBe("pt-BR");
  });

  it("título muda por tipo de documento", () => {
    expect(metadadosEvolucao("puerperal").title).toContain("Puerperal");
    expect(metadadosEvolucao("neonatal").title).toContain("Neonatal");
  });
});
