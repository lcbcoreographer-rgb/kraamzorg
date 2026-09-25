import { describe, expect, it } from "vitest";
import { localidade } from "./localidade";

describe("localidade (crítica do CRM, P3 item 22)", () => {
  it("junta bairro e cidade diferentes", () => {
    expect(localidade("Vila Mariana", "São Paulo")).toBe(
      "Vila Mariana, São Paulo",
    );
  });

  it("mostra uma vez só quando o bairro é igual à cidade", () => {
    expect(localidade("Alphaville", "Alphaville")).toBe("Alphaville");
    expect(localidade("Granja Viana", "granja viana")).toBe("Granja Viana");
  });

  it("devolve só o que existe", () => {
    expect(localidade("Vila Mariana", null)).toBe("Vila Mariana");
    expect(localidade(null, "São Paulo")).toBe("São Paulo");
    expect(localidade(null, null)).toBeNull();
    expect(localidade("", "")).toBeNull();
  });
});
