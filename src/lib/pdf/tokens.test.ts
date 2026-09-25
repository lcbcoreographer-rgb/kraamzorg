import { describe, expect, it } from "vitest";
import { CORES, MARINHO_14, MARINHO_62, MARINHO_72 } from "./tokens";

/** `color-mix(in srgb, var(--marinho) pct%, var(--creme))` de globals.css, refeito em JS para conferir os hexadecimais copiados aqui (o PDF não roda CSS). */
function colorMix(hexA: string, hexB: string, pctA: number): string {
  const canal = (hex: string, indice: number) =>
    parseInt(hex.slice(indice, indice + 2), 16);
  const canais = [1, 3, 5].map((indice) =>
    Math.round(canal(hexA, indice) * pctA + canal(hexB, indice) * (1 - pctA)),
  );
  return `#${canais.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

describe("tokens do PDF batem com os nove primitivos de globals.css", () => {
  it("os primitivos são os do CLAUDE.md/PRD 20.2", () => {
    expect(CORES).toEqual({
      marinho: "#0f1f36",
      dourado: "#bc9c5d",
      areia: "#e8dac5",
      creme: "#fcf8ed",
      branco: "#ffffff",
      sucesso: "#4b7358",
      aviso: "#b5822a",
      alerta: "#9e4438",
      sensivel: "#63557a",
    });
  });

  it("marinho-72, marinho-62 e marinho-14 seguem a mesma mistura de globals.css", () => {
    expect(MARINHO_72).toBe(colorMix(CORES.marinho, CORES.creme, 0.72));
    expect(MARINHO_62).toBe(colorMix(CORES.marinho, CORES.creme, 0.62));
    expect(MARINHO_14).toBe(colorMix(CORES.marinho, CORES.creme, 0.14));
  });
});
