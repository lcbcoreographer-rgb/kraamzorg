import { describe, expect, it } from "vitest";
import { digitosTelefone, montarLinkWhatsApp } from "./link-whatsapp";

describe("montarLinkWhatsApp", () => {
  it("monta o link com o telefone só em dígitos e o texto codificado", () => {
    const link = montarLinkWhatsApp("+5511999998888", "Oi, Carla! Tudo bem?");
    expect(link).toBe(
      "https://wa.me/5511999998888?text=Oi%2C%20Carla!%20Tudo%20bem%3F",
    );
  });

  it("devolve null para telefone sem dígitos suficientes", () => {
    expect(montarLinkWhatsApp("+55", "texto")).toBeNull();
    expect(montarLinkWhatsApp("", "texto")).toBeNull();
  });

  it("ignora pontuação e espaços do telefone", () => {
    const link = montarLinkWhatsApp("+55 (11) 99999-8888", "Oi");
    expect(link).toContain("https://wa.me/5511999998888?");
  });
});

describe("digitosTelefone", () => {
  it("tira tudo que não é dígito", () => {
    expect(digitosTelefone("+55 (11) 99999-8888")).toBe("5511999998888");
  });
});
