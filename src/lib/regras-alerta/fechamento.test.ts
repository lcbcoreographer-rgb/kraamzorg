import { describe, expect, it } from "vitest";
import { validarFechamentoAlerta } from "./fechamento";

describe("validarFechamentoAlerta", () => {
  it("alerta não fecha sem os quatro campos", () => {
    expect(validarFechamentoAlerta({}).valido).toBe(false);
    expect(validarFechamentoAlerta({}).camposFaltando).toEqual([
      "sinalIdentificado",
      "acionadoEm",
      "orientacaoMedica",
      "condutaAdotada",
    ]);
  });

  it("aponta exatamente o que falta quando só parte dos campos está preenchida", () => {
    const resultado = validarFechamentoAlerta({
      sinalIdentificado: "Febre 38,2 °C",
      acionadoEm: "2026-09-25T14:00:00-03:00",
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.camposFaltando).toEqual([
      "orientacaoMedica",
      "condutaAdotada",
    ]);
  });

  it("fecha só com os quatro campos preenchidos", () => {
    const resultado = validarFechamentoAlerta({
      sinalIdentificado: "Febre 38,2 °C",
      acionadoEm: "2026-09-25T14:00:00-03:00",
      orientacaoMedica: "Encaminhar para pronto-socorro obstétrico.",
      condutaAdotada: "Família orientada e acompanhada até a saída.",
    });
    expect(resultado.valido).toBe(true);
    expect(resultado.camposFaltando).toEqual([]);
  });

  it("texto só com espaço não conta como preenchido", () => {
    const resultado = validarFechamentoAlerta({
      sinalIdentificado: "   ",
      acionadoEm: "2026-09-25T14:00:00-03:00",
      orientacaoMedica: "ok",
      condutaAdotada: "ok",
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.camposFaltando).toEqual(["sinalIdentificado"]);
  });

  it("null e undefined contam como faltando", () => {
    const resultado = validarFechamentoAlerta({
      sinalIdentificado: null,
      acionadoEm: undefined,
      orientacaoMedica: "ok",
      condutaAdotada: "ok",
    });
    expect(resultado.camposFaltando).toEqual([
      "sinalIdentificado",
      "acionadoEm",
    ]);
  });

  it("hora do acionamento em texto livre ou sem fuso não conta como preenchida", () => {
    for (const acionadoEm of [
      "ontem à tarde",
      "14h",
      "2026-09-25",
      "2026-09-25T14:00:00",
      "2026-13-45T99:00:00Z",
    ]) {
      const resultado = validarFechamentoAlerta({
        sinalIdentificado: "Febre 38,2 °C",
        acionadoEm,
        orientacaoMedica: "Encaminhar para pronto-socorro obstétrico.",
        condutaAdotada: "Família orientada e acompanhada até a saída.",
      });
      expect(resultado.valido, acionadoEm).toBe(false);
      expect(resultado.camposFaltando).toEqual(["acionadoEm"]);
    }
  });
});
