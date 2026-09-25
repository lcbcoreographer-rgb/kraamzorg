import { describe, expect, it } from "vitest";
import { paraCentavosBRL } from "./dinheiro";

describe("paraCentavosBRL", () => {
  it("lê o formato sem separador de milhar, como o placeholder pede", () => {
    expect(paraCentavosBRL("4200,00")).toBe(420000);
    expect(paraCentavosBRL("4200")).toBe(420000);
  });

  it("lê o mesmo formato que a tela mostra em formatarMoeda", () => {
    // formatarMoeda(420000) === "R$ 4.200"; alguém digitando de volta o que
    // acabou de ver na tela não pode virar um preço 1000 vezes menor.
    expect(paraCentavosBRL("4.200")).toBe(420000);
    expect(paraCentavosBRL("4.200,00")).toBe(420000);
    expect(paraCentavosBRL("R$ 4.200,00")).toBe(420000);
    expect(paraCentavosBRL("1.234.567,89")).toBe(123456789);
  });

  it("aceita ponto como decimal só quando não há vírgula e sobram duas casas", () => {
    expect(paraCentavosBRL("12.34")).toBe(1234);
    expect(paraCentavosBRL("100.00")).toBe(10000);
  });

  it("texto vazio ou inválido devolve null, nunca um número quebrado", () => {
    expect(paraCentavosBRL("")).toBeNull();
    expect(paraCentavosBRL("   ")).toBeNull();
    expect(paraCentavosBRL("abc")).toBeNull();
  });
});
