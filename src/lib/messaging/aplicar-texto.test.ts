import { describe, expect, it } from "vitest";
import { aplicarNome, aplicarTexto, primeiroNome } from "./aplicar-texto";

describe("aplicarTexto (espelho de privado.aplicar_texto)", () => {
  it("troca {nome} e as outras variáveis numa passada só", () => {
    expect(
      aplicarTexto("Oi, {nome}! Amanhã, às {hora}: {link}.", "Juliana", {
        hora: "19:00",
        link: "https://x.invalid/{nome}",
      }),
    ).toBe("Oi, Juliana! Amanhã, às 19:00: https://x.invalid/{nome}.");
  });

  it("sem nome, o {nome} sai com a vírgula e a frase volta a começar em maiúscula", () => {
    expect(aplicarNome("{nome}, que bom.", null)).toBe("Que bom.");
    expect(aplicarNome("Oi, {nome}! Tudo bem?", "")).toBe("Oi! Tudo bem?");
  });

  it("variável sem valor vira vazio; chave estranha fica como está", () => {
    expect(aplicarTexto("A {x} e {Y}", null, {})).toBe("A  e {Y}");
  });
});

describe("primeiroNome", () => {
  it("primeira palavra que começa por letra", () => {
    expect(primeiroNome("Juliana Teste Gruta")).toBe("Juliana");
    expect(primeiroNome("  Ana-Clara, ")).toBe("Ana-Clara");
    expect(primeiroNome("123 Teste")).toBeNull();
    expect(primeiroNome(null)).toBeNull();
  });
});
