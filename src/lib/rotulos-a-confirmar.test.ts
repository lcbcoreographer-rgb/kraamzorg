import { describe, expect, it } from "vitest";
import { ROTULOS_A_CONFIRMAR, rotulo } from "./rotulos-a-confirmar";

describe("rótulos à espera de aprovação (voz.md, seções 5 e 7)", () => {
  it("nenhum rótulo proposto vai ao ar sem aprovação registrada", () => {
    for (const [chave, item] of Object.entries(ROTULOS_A_CONFIRMAR)) {
      expect(item.aprovado, `${chave} não pode ir ao ar sem ${item.quem}`).toBe(
        false,
      );
      expect(rotulo(chave as keyof typeof ROTULOS_A_CONFIRMAR)).toBe(
        item.atual,
      );
    }
  });

  it("guarda as propostas da camada de acolhimento, com quem decide", () => {
    expect(ROTULOS_A_CONFIRMAR.resolverSensivel).toMatchObject({
      proposto: "Registrar o contato com a família",
      quem: "Leonardo e Edilaine",
    });
    expect(ROTULOS_A_CONFIRMAR.naoLead.proposto).toBe("Outro assunto");
    expect(ROTULOS_A_CONFIRMAR.estagioPerdido.proposto).toBe("Não seguiu");
  });

  it("nenhum rótulo, atual ou proposto, tem travessão ou meia-risca", () => {
    for (const item of Object.values(ROTULOS_A_CONFIRMAR)) {
      expect(`${item.atual} ${item.proposto}`).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
