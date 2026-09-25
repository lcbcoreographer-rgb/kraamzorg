import { describe, expect, it } from "vitest";
import { validarParcelas } from "./limites";

// Limite do seed (pacote_versao.parcelas_max_sem_juros = 3, PRD 6.3). O
// número entra no teste como dado do banco, nunca no código de produção.
const LIMITE_DO_PACOTE = 3;

describe("validarParcelas", () => {
  it("aceita de 1 até o limite do pacote", () => {
    expect(() => validarParcelas(1, LIMITE_DO_PACOTE)).not.toThrow();
    expect(() => validarParcelas(3, LIMITE_DO_PACOTE)).not.toThrow();
  });

  it("recusa link com mais parcelas que o limite do pacote (4x e 12x)", () => {
    expect(() => validarParcelas(4, LIMITE_DO_PACOTE)).toThrow(/3x/);
    expect(() => validarParcelas(12, LIMITE_DO_PACOTE)).toThrow(/3x/);
  });

  it("segue o limite que vier do banco, sem teto escrito no código", () => {
    expect(() => validarParcelas(2, 2)).not.toThrow();
    expect(() => validarParcelas(3, 2)).toThrow(/2x/);
  });

  it("recusa parcelas ou limite não inteiros ou menores que 1", () => {
    expect(() => validarParcelas(0, LIMITE_DO_PACOTE)).toThrow();
    expect(() => validarParcelas(-1, LIMITE_DO_PACOTE)).toThrow();
    expect(() => validarParcelas(2.5, LIMITE_DO_PACOTE)).toThrow();
    expect(() => validarParcelas(1, 0)).toThrow();
    expect(() => validarParcelas(1, Number.NaN)).toThrow();
  });
});
