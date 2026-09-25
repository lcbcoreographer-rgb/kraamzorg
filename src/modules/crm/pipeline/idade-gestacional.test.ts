import { describe, expect, it } from "vitest";
import {
  calcularIdadeGestacional,
  haQuantoTempo,
  hojeBrasilia,
  textoIdadeGestacional,
} from "./idade-gestacional";

describe("calcularIdadeGestacional: ig(dpp, data) = data - (dpp - 280 dias)", () => {
  it("no dia da DPP dá 40 semanas e 0 dias (termo)", () => {
    expect(calcularIdadeGestacional("2026-12-25", "2026-12-25")).toEqual({
      semanas: 40,
      dias: 0,
    });
  });

  it("14 dias antes da DPP dá 38 semanas e 0 dias", () => {
    expect(calcularIdadeGestacional("2026-12-25", "2026-12-11")).toEqual({
      semanas: 38,
      dias: 0,
    });
  });

  it("1 dia depois da DPP dá 40 semanas e 1 dia", () => {
    expect(calcularIdadeGestacional("2026-12-25", "2026-12-26")).toEqual({
      semanas: 40,
      dias: 1,
    });
  });

  it("null sem DPP", () => {
    expect(calcularIdadeGestacional(null, "2026-12-25")).toBeNull();
  });

  it("null com data fora do formato aaaa-mm-dd", () => {
    expect(calcularIdadeGestacional("2026-12-25", "25/12/2026")).toBeNull();
  });

  it("null quando a conta dá negativa (data muito antes de qualquer gestação)", () => {
    expect(calcularIdadeGestacional("2026-12-25", "2025-01-01")).toBeNull();
  });
});

describe("textoIdadeGestacional: formata em semanas e dias", () => {
  it("38s2d, como no cartão do pipeline", () => {
    expect(textoIdadeGestacional("2026-12-25", "2026-12-13")).toBe("38s2d");
  });

  it("null sem DPP, sem inventar 0s0d", () => {
    expect(textoIdadeGestacional(null, "2026-12-25")).toBeNull();
  });
});

describe("hojeBrasilia", () => {
  it("aaaa-mm-dd a partir de um instante UTC", () => {
    // 02:30 UTC de 25/12 é 23:30 de 24/12 em Brasília (UTC-3).
    expect(hojeBrasilia(new Date("2026-12-25T02:30:00Z"))).toBe("2026-12-24");
    // 04:30 UTC de 25/12 já é 01:30 de 25/12 em Brasília.
    expect(hojeBrasilia(new Date("2026-12-25T04:30:00Z"))).toBe("2026-12-25");
  });
});

describe("haQuantoTempo", () => {
  it("Hoje quando o instante é agora", () => {
    const agora = new Date("2026-09-24T12:00:00Z");
    expect(haQuantoTempo(agora.toISOString(), agora)).toBe("Hoje");
  });

  it("Há 1 dia no singular", () => {
    const agora = new Date("2026-09-24T12:00:00Z");
    const ontem = new Date(agora.getTime() - 25 * 60 * 60 * 1000);
    expect(haQuantoTempo(ontem.toISOString(), agora)).toBe("Há 1 dia");
  });

  it("Há N dias no plural", () => {
    const agora = new Date("2026-09-24T12:00:00Z");
    const antes = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(haQuantoTempo(antes.toISOString(), agora)).toBe("Há 5 dias");
  });
});
