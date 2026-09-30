import { describe, expect, it } from "vitest";
import type { Campo } from "@/lib/instrumentos/schema";
import { respostaParaLeitura } from "./formato";

describe("respostaParaLeitura", () => {
  it("mostra a data no formato brasileiro", () => {
    const campo = {
      id: "data",
      rotulo: "Data",
      tipo: "data",
    } as unknown as Campo;
    expect(respostaParaLeitura(campo, "2026-09-30")).toBe("30/09/2026");
  });

  it("deixa texto comum como veio", () => {
    const campo = {
      id: "obs",
      rotulo: "Observação",
      tipo: "texto",
    } as unknown as Campo;
    expect(respostaParaLeitura(campo, "2026-09-30 à tarde")).toBe(
      "2026-09-30 à tarde",
    );
  });
});
