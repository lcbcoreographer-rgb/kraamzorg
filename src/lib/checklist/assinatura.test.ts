import { describe, expect, it } from "vitest";
import {
  calcularAssinatura,
  conferirAssinatura,
  jsonCanonico,
  textoAssinado,
} from "./assinatura";

// Vetor de referência: o mesmo do pgTAP 023_checklist_alertas.sql (seção 1).
const DADOS_DE_REFERENCIA = {
  "1": { data: "2026-09-29", horario: "09:30" },
  b: 'ação "x"\n',
  a: [1, 2.5, null, true],
  "2.1": {
    temperatura: 38.2,
    pressao_arterial: { partes: { sistolica: 120, diastolica: 80 } },
  },
};
const ENTRADA = {
  dados: DADOS_DE_REFERENCIA,
  resumo: "Resumo de teste",
  profissionalId: "d2300000-0000-4000-8000-000000000001",
  assinadoEmMs: 1790000000123,
};
const HASH_DE_REFERENCIA =
  "b21e5941d4eacc3b6c9c3b768ee1631267a08a6b6e405f8b7a7e64a3f04a7064";

describe("jsonCanonico", () => {
  it("ordena as chaves, sem espaço", () => {
    expect(jsonCanonico({ b: 1, a: { z: [1, 2], c: "x" } })).toBe(
      '{"a":{"c":"x","z":[1,2]},"b":1}',
    );
  });

  it("ignora chave indefinida e mantém nulo", () => {
    expect(jsonCanonico({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("escreve texto com acento e aspas como o JSON escreve", () => {
    expect(jsonCanonico({ t: 'ação "x"\n' })).toBe('{"t":"ação \\"x\\"\\n"}');
  });

  it("recusa número que não é finito", () => {
    expect(() => jsonCanonico({ a: Number.NaN })).toThrow(/não finito/);
    expect(() => jsonCanonico({ a: Infinity })).toThrow(/não finito/);
  });

  it("recusa função", () => {
    expect(() => jsonCanonico({ a: () => 1 })).toThrow();
  });
});

describe("assinatura do registro (P39 item 3)", () => {
  it("o texto assinado tem a forma combinada com o banco", () => {
    expect(textoAssinado(ENTRADA)).toBe(
      '{"assinado_em_ms":1790000000123,"dados":{"1":{"data":"2026-09-29","horario":"09:30"},"2.1":{"pressao_arterial":{"partes":{"diastolica":80,"sistolica":120}},"temperatura":38.2},"a":[1,2.5,null,true],"b":"ação \\"x\\"\\n"},"profissional_id":"d2300000-0000-4000-8000-000000000001","resumo":"Resumo de teste"}',
    );
  });

  it("dá o mesmo hash do banco (vetor de referência do pgTAP)", async () => {
    expect(await calcularAssinatura(ENTRADA)).toBe(HASH_DE_REFERENCIA);
  });

  it("não depende da ordem em que as chaves foram escritas", async () => {
    const embaralhado = {
      ...ENTRADA,
      dados: {
        "2.1": {
          pressao_arterial: { partes: { diastolica: 80, sistolica: 120 } },
          temperatura: 38.2,
        },
        b: 'ação "x"\n',
        a: [1, 2.5, null, true],
        "1": { horario: "09:30", data: "2026-09-29" },
      },
    };
    expect(await calcularAssinatura(embaralhado)).toBe(HASH_DE_REFERENCIA);
  });

  it("mudar qualquer parte muda a assinatura", async () => {
    const base = await calcularAssinatura(ENTRADA);
    expect(
      await calcularAssinatura({ ...ENTRADA, resumo: "Outro resumo" }),
    ).not.toBe(base);
    expect(
      await calcularAssinatura({ ...ENTRADA, assinadoEmMs: 1790000000124 }),
    ).not.toBe(base);
    expect(
      await calcularAssinatura({
        ...ENTRADA,
        profissionalId: "d2300000-0000-4000-8000-000000000002",
      }),
    ).not.toBe(base);
    expect(
      await calcularAssinatura({
        ...ENTRADA,
        dados: { ...DADOS_DE_REFERENCIA, "2.1": { temperatura: 38.3 } },
      }),
    ).not.toBe(base);
  });

  it("conferirAssinatura aceita a certa e recusa a adulterada", async () => {
    expect(await conferirAssinatura(ENTRADA, HASH_DE_REFERENCIA)).toBe(true);
    expect(
      await conferirAssinatura(
        { ...ENTRADA, resumo: "Resumo alterado" },
        HASH_DE_REFERENCIA,
      ),
    ).toBe(false);
  });
});
