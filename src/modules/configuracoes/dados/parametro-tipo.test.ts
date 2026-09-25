import { describe, expect, it } from "vitest";
import {
  ajudaPorTipo,
  classificarTipoParametro,
  listaParaTexto,
  textoParaLista,
  validarNovoValorParametro,
} from "./parametro-tipo";

describe("classificarTipoParametro", () => {
  it("classifica inteiro, decimal, texto, booleano e nulo", () => {
    expect(classificarTipoParametro(48)).toBe("inteiro");
    expect(classificarTipoParametro(0.6)).toBe("decimal");
    expect(classificarTipoParametro("desligado")).toBe("texto");
    expect(classificarTipoParametro(false)).toBe("booleano");
    expect(classificarTipoParametro(null)).toBe("nulo");
  });

  it("classifica lista de texto separado de objeto", () => {
    expect(classificarTipoParametro(["+5511900000001"])).toBe("lista_texto");
    expect(classificarTipoParametro({ inicio: "08:00", fim: "20:00" })).toBe(
      "objeto",
    );
    // Lista de números (nenhum parâmetro do seed hoje, mas a classificação
    // não pode confundir com lista_texto: editar como texto quebraria o
    // tipo dos itens).
    expect(classificarTipoParametro([1, 2, 3])).toBe("objeto");
  });
});

describe("validarNovoValorParametro", () => {
  it("aceita inteiro e recusa decimal ou texto no lugar de inteiro", () => {
    expect(validarNovoValorParametro("inteiro", "72")).toEqual({
      ok: true,
      valor: 72,
    });
    expect(validarNovoValorParametro("inteiro", "24,5").ok).toBe(false);
    expect(validarNovoValorParametro("inteiro", "vinte e quatro").ok).toBe(
      false,
    );
  });

  it("aceita decimal com vírgula ou ponto", () => {
    expect(validarNovoValorParametro("decimal", "0,6")).toEqual({
      ok: true,
      valor: 0.6,
    });
    expect(validarNovoValorParametro("decimal", "0.75")).toEqual({
      ok: true,
      valor: 0.75,
    });
  });

  it("recusa texto em branco", () => {
    const resultado = validarNovoValorParametro("texto", "   ");
    expect(resultado.ok).toBe(false);
  });

  it("aceita booleano só como sim ou não explícitos", () => {
    expect(validarNovoValorParametro("booleano", "true")).toEqual({
      ok: true,
      valor: true,
    });
    expect(validarNovoValorParametro("booleano", "false")).toEqual({
      ok: true,
      valor: false,
    });
    expect(validarNovoValorParametro("booleano", "sim").ok).toBe(false);
  });

  it("lista_texto vira um item por linha, sem linha em branco", () => {
    const resultado = validarNovoValorParametro(
      "lista_texto",
      "+5511900000001\n\n+5511900000002\n",
    );
    expect(resultado).toEqual({
      ok: true,
      valor: ["+5511900000001", "+5511900000002"],
    });
  });

  it("objeto exige JSON válido em forma de objeto ou lista", () => {
    expect(
      validarNovoValorParametro("objeto", '{"inicio":"08:00","fim":"20:00"}'),
    ).toEqual({ ok: true, valor: { inicio: "08:00", fim: "20:00" } });
    expect(validarNovoValorParametro("objeto", "não é json").ok).toBe(false);
    // Recusa trocar o objeto por um texto ou número soltos: muda a forma.
    expect(validarNovoValorParametro("objeto", '"48"').ok).toBe(false);
    expect(validarNovoValorParametro("objeto", "48").ok).toBe(false);
  });

  it("nulo aceita qualquer JSON válido, já que ainda não tinha forma", () => {
    expect(validarNovoValorParametro("nulo", '{"a":1}').ok).toBe(true);
    expect(validarNovoValorParametro("nulo", "42").ok).toBe(true);
    expect(validarNovoValorParametro("nulo", "não é json").ok).toBe(false);
  });
});

describe("listaParaTexto e textoParaLista", () => {
  it("são inversas para uma lista sem linha em branco", () => {
    const lista = ["a", "b", "c"];
    expect(textoParaLista(listaParaTexto(lista))).toEqual(lista);
  });
});

describe("ajudaPorTipo", () => {
  it("devolve uma frase para cada tipo, sem travessão", () => {
    const tipos = [
      "inteiro",
      "decimal",
      "booleano",
      "texto",
      "lista_texto",
      "objeto",
      "nulo",
    ] as const;
    for (const tipo of tipos) {
      expect(ajudaPorTipo(tipo)).not.toMatch(/—|--/);
      expect(ajudaPorTipo(tipo).length).toBeGreaterThan(0);
    }
  });
});
