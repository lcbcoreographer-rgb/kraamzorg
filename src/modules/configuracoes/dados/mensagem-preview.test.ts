import { describe, expect, it } from "vitest";
import { extrairVariaveis, montarPreviaMensagem } from "./mensagem-preview";

describe("extrairVariaveis", () => {
  it("lista as variáveis na ordem, sem repetir", () => {
    expect(
      extrairVariaveis("Oi, {nome}! Amanhã, às {hora}, é a conversa. {nome}?"),
    ).toEqual(["nome", "hora"]);
  });

  it("texto sem variável devolve lista vazia", () => {
    expect(extrairVariaveis("Sinto muito, de coração.")).toEqual([]);
  });
});

describe("montarPreviaMensagem", () => {
  it("substitui a variável pelo valor de exemplo", () => {
    expect(
      montarPreviaMensagem("Oi, {nome}! Tudo bem?", { nome: "Marina" }),
    ).toBe("Oi, Marina! Tudo bem?");
  });

  it("variável vazia some com a vírgula vizinha e reacerta a maiúscula (PRD 23)", () => {
    const texto =
      "{nome}, pelo que você está me contando, isso precisa ser avaliado agora.";
    expect(montarPreviaMensagem(texto, { nome: "" })).toBe(
      "Pelo que você está me contando, isso precisa ser avaliado agora.",
    );
  });

  it("mantém o texto normal quando não há variável nenhuma", () => {
    expect(montarPreviaMensagem("Sinto muito, de coração.", {})).toBe(
      "Sinto muito, de coração.",
    );
  });
});
