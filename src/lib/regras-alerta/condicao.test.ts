import { describe, expect, it } from "vitest";
import {
  avaliarCondicao,
  camposDaCondicao,
  normalizarCondicao,
  obterValorPorCaminho,
} from "./condicao";
import type { VisitaSerie } from "./tipos";

describe("obterValorPorCaminho", () => {
  it("lê um caminho pontuado dentro de um objeto aninhado", () => {
    const registro = { secao_2_1: { temperatura_c: 38.2 } };
    expect(obterValorPorCaminho(registro, "secao_2_1.temperatura_c")).toBe(
      38.2,
    );
  });

  it("devolve undefined para caminho inexistente", () => {
    expect(obterValorPorCaminho({ a: 1 }, "a.b.c")).toBeUndefined();
  });

  it("devolve undefined quando a origem é undefined", () => {
    expect(obterValorPorCaminho(undefined, "a")).toBeUndefined();
  });
});

describe("avaliarCondicao · comparação", () => {
  it("maior_igual dispara quando o valor bate ou passa do limite", () => {
    const condicao = {
      tipo: "comparacao" as const,
      campo: "secao_2_1.temperatura_c",
      operador: "maior_igual" as const,
      valor: 38,
    };
    expect(
      avaliarCondicao(condicao, {
        registro: { secao_2_1: { temperatura_c: 38.2 } },
      }),
    ).toBe(true);
    expect(
      avaliarCondicao(condicao, {
        registro: { secao_2_1: { temperatura_c: 38 } },
      }),
    ).toBe(true);
    expect(
      avaliarCondicao(condicao, {
        registro: { secao_2_1: { temperatura_c: 37.9 } },
      }),
    ).toBe(false);
  });

  it("entre exige número finito dentro do intervalo inclusivo", () => {
    const condicao = {
      tipo: "comparacao" as const,
      campo: "x",
      operador: "entre" as const,
      valorMinimo: 37.5,
      valorMaximo: 37.9,
    };
    expect(avaliarCondicao(condicao, { registro: { x: 37.5 } })).toBe(true);
    expect(avaliarCondicao(condicao, { registro: { x: 37.9 } })).toBe(true);
    expect(avaliarCondicao(condicao, { registro: { x: 38 } })).toBe(false);
    // Texto numérico do formulário offline conta como número; texto livre não.
    expect(avaliarCondicao(condicao, { registro: { x: "37,6" } })).toBe(true);
    expect(avaliarCondicao(condicao, { registro: { x: "37.6 °C" } })).toBe(
      false,
    );
  });

  it("igual e diferente comparam primitivos", () => {
    expect(
      avaliarCondicao(
        { tipo: "comparacao", campo: "x", operador: "igual", valor: true },
        { registro: { x: true } },
      ),
    ).toBe(true);
    expect(
      avaliarCondicao(
        { tipo: "comparacao", campo: "x", operador: "diferente", valor: true },
        { registro: { x: false } },
      ),
    ).toBe(true);
  });

  it("diferente não dispara em campo sem resposta", () => {
    const condicao = {
      tipo: "comparacao" as const,
      campo: "x",
      operador: "diferente" as const,
      valor: true,
    };
    expect(avaliarCondicao(condicao, { registro: {} })).toBe(false);
    expect(avaliarCondicao(condicao, { registro: { x: null } })).toBe(false);
  });

  it("presente e ausente tratam string vazia, null e undefined como ausentes", () => {
    const presente = {
      tipo: "comparacao" as const,
      campo: "x",
      operador: "presente" as const,
    };
    const ausente = {
      tipo: "comparacao" as const,
      campo: "x",
      operador: "ausente" as const,
    };
    expect(avaliarCondicao(presente, { registro: { x: "" } })).toBe(false);
    expect(avaliarCondicao(presente, { registro: { x: null } })).toBe(false);
    expect(avaliarCondicao(presente, { registro: {} })).toBe(false);
    expect(avaliarCondicao(presente, { registro: { x: "febre" } })).toBe(true);
    expect(avaliarCondicao(ausente, { registro: {} })).toBe(true);
  });

  it("em verifica se o valor está numa lista", () => {
    const condicao = {
      tipo: "comparacao" as const,
      campo: "x",
      operador: "em" as const,
      valores: ["a", "b"],
    };
    expect(avaliarCondicao(condicao, { registro: { x: "b" } })).toBe(true);
    expect(avaliarCondicao(condicao, { registro: { x: "c" } })).toBe(false);
  });

  it("nunca lança para tipo de dado inesperado, só devolve false", () => {
    const condicao = {
      tipo: "comparacao" as const,
      campo: "x",
      operador: "maior" as const,
      valor: 5,
    };
    expect(avaliarCondicao(condicao, { registro: { x: "não é número" } })).toBe(
      false,
    );
    expect(avaliarCondicao(condicao, { registro: { x: undefined } })).toBe(
      false,
    );
  });
});

describe("avaliarCondicao · composição", () => {
  it("'e' exige todas verdadeiras", () => {
    const condicao = {
      tipo: "e" as const,
      condicoes: [
        {
          tipo: "comparacao" as const,
          campo: "a",
          operador: "igual" as const,
          valor: true,
        },
        {
          tipo: "comparacao" as const,
          campo: "b",
          operador: "igual" as const,
          valor: true,
        },
      ],
    };
    expect(avaliarCondicao(condicao, { registro: { a: true, b: true } })).toBe(
      true,
    );
    expect(avaliarCondicao(condicao, { registro: { a: true, b: false } })).toBe(
      false,
    );
  });

  it("'ou' exige ao menos uma verdadeira", () => {
    const condicao = {
      tipo: "ou" as const,
      condicoes: [
        {
          tipo: "comparacao" as const,
          campo: "a",
          operador: "igual" as const,
          valor: true,
        },
        {
          tipo: "comparacao" as const,
          campo: "b",
          operador: "igual" as const,
          valor: true,
        },
      ],
    };
    expect(avaliarCondicao(condicao, { registro: { a: false, b: true } })).toBe(
      true,
    );
    expect(
      avaliarCondicao(condicao, { registro: { a: false, b: false } }),
    ).toBe(false);
  });

  it("'nao' inverte o resultado", () => {
    const condicao = {
      tipo: "nao" as const,
      condicao: {
        tipo: "comparacao" as const,
        campo: "a",
        operador: "igual" as const,
        valor: true,
      },
    };
    expect(avaliarCondicao(condicao, { registro: { a: true } })).toBe(false);
    expect(avaliarCondicao(condicao, { registro: { a: false } })).toBe(true);
  });
});

describe("avaliarCondicao · série (PU-08)", () => {
  const condicaoPu08 = {
    tipo: "serie" as const,
    campo: "secao_2_1.temperatura_c",
    operador: "entre" as const,
    valorMinimo: 37.5,
    valorMaximo: 37.9,
    visitasConsecutivas: 2,
  };

  it("dispara com 37,6 na visita atual e 37,8 na visita anterior", () => {
    const serieAnterior: VisitaSerie[] = [
      {
        visitaId: "v-anterior",
        dataVisita: "2026-09-10T10:00:00Z",
        registro: { secao_2_1: { temperatura_c: 37.8 } },
      },
    ];
    const dados = {
      registro: { secao_2_1: { temperatura_c: 37.6 } },
      serieAnterior,
    };
    expect(avaliarCondicao(condicaoPu08, dados)).toBe(true);
  });

  it("não dispara se só a visita atual bate a faixa (falta a anterior)", () => {
    const dados = {
      registro: { secao_2_1: { temperatura_c: 37.6 } },
      serieAnterior: [],
    };
    expect(avaliarCondicao(condicaoPu08, dados)).toBe(false);
  });

  it("não dispara se a visita anterior está fora da faixa", () => {
    const dados = {
      registro: { secao_2_1: { temperatura_c: 37.6 } },
      serieAnterior: [
        {
          visitaId: "v-anterior",
          dataVisita: "2026-09-10T10:00:00Z",
          registro: { secao_2_1: { temperatura_c: 36.9 } },
        },
      ],
    };
    expect(avaliarCondicao(condicaoPu08, dados)).toBe(false);
  });

  it("38,2 °C não é febre baixa: fica fora da faixa de PU-08", () => {
    const dados = {
      registro: { secao_2_1: { temperatura_c: 38.2 } },
      serieAnterior: [
        {
          visitaId: "v-anterior",
          dataVisita: "2026-09-10T10:00:00Z",
          registro: { secao_2_1: { temperatura_c: 37.8 } },
        },
      ],
    };
    expect(avaliarCondicao(condicaoPu08, dados)).toBe(false);
  });
});

describe("formato curto do banco (regra_alerta.condicao do seed)", () => {
  it("'>=' e '=' viram comparação", () => {
    expect(
      avaliarCondicao(
        { campo: "2.1.temperatura", operador: ">=", valor: 38 },
        { registro: { "2.1": { temperatura: 38.2 } } },
      ),
    ).toBe(true);
    expect(
      avaliarCondicao(
        { campo: "2.1.temperatura", operador: ">=", valor: 38 },
        { registro: { "2.1": { temperatura: 36.5 } } },
      ),
    ).toBe(false);
    expect(
      avaliarCondicao(
        { campo: "3.atividade_preservada", operador: "=", valor: false },
        { registro: { "3": { atividade_preservada: false } } },
      ),
    ).toBe(true);
  });

  it("fora_da_faixa dispara abaixo do mínimo ou acima do máximo, nunca nas bordas", () => {
    const condicao = {
      campo: "t",
      operador: "fora_da_faixa" as const,
      min: 36,
      max: 38,
    };
    const avaliar = (t: number) =>
      avaliarCondicao(condicao, { registro: { t } });
    expect([35.9, 36, 37, 38, 38.1].map(avaliar)).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it("devolve sempre boolean: forma desconhecida é false, nunca o próprio objeto", () => {
    for (const condicao of [
      { campo: "t", operador: "~", valor: 1 },
      { campo: "t", operador: "fora_da_faixa", min: 38, max: 36 },
      { tipo: "comparacao", campo: "t", operador: "maior_igual" },
      {
        tipo: "serie",
        campo: "t",
        operador: "igual",
        valor: 1,
        visitasConsecutivas: 0,
      },
      { tipo: "ou", condicoes: [] },
      { tipo: "e", condicoes: [{ campo: "t", operador: "~" }] },
      null,
      undefined,
    ]) {
      expect(
        avaliarCondicao(condicao as never, { registro: { t: 100 } }),
        JSON.stringify(condicao),
      ).toBe(false);
    }
  });
});

describe("normalizarCondicao e camposDaCondicao", () => {
  it("normaliza o formato curto e lista os campos consultados", () => {
    expect(
      normalizarCondicao({
        campo: "3.1.temperatura",
        operador: "fora_da_faixa",
        min: 36,
        max: 38,
      }),
    ).toEqual({
      tipo: "ou",
      condicoes: [
        {
          tipo: "comparacao",
          campo: "3.1.temperatura",
          operador: "menor",
          valor: 36,
        },
        {
          tipo: "comparacao",
          campo: "3.1.temperatura",
          operador: "maior",
          valor: 38,
        },
      ],
    });
    expect(
      camposDaCondicao({
        tipo: "e",
        condicoes: [
          { campo: "a", operador: "=", valor: true },
          {
            tipo: "curva_peso",
            campoPeso: "b",
            percentualPerdaMaximo: 10,
            diaVidaLimiteRecuperacao: 14,
          },
        ],
      }),
    ).toEqual(["a", "b"]);
    expect(camposDaCondicao({ campo: "a", operador: "~" })).toEqual([]);
  });
});

describe("obterValorPorCaminho com a numeração do checklist", () => {
  it("lê chave literal com ponto, aninhamento por segmento e a mistura dos dois", () => {
    expect(
      obterValorPorCaminho({ "2.1": { temperatura: 38 } }, "2.1.temperatura"),
    ).toBe(38);
    expect(
      obterValorPorCaminho(
        { "2": { "1": { temperatura: 38 } } },
        "2.1.temperatura",
      ),
    ).toBe(38);
    expect(
      obterValorPorCaminho(
        { "3.2": { coto: { sinais: true } } },
        "3.2.coto.sinais",
      ),
    ).toBe(true);
    expect(
      obterValorPorCaminho({ "2.1.temperatura": 37 }, "2.1.temperatura"),
    ).toBe(37);
  });
});
