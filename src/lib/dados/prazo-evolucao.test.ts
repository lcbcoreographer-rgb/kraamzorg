import { describe, expect, it } from "vitest";
import {
  diasUteisApos,
  prazosDoAtendimento,
  situacaoDoPrazo,
} from "./prazo-evolucao";

/** Mesma conta de privado.dias_uteis_apos (0024): segunda a sexta, menos os feriados do parâmetro. */
describe("dias úteis do prazo da evolução", () => {
  // 2026-09-25 é sexta-feira
  it("de sexta, D+1 é segunda e D+2 é terça", () => {
    expect(diasUteisApos("2026-09-25", 1)).toBe("2026-09-28");
    expect(diasUteisApos("2026-09-25", 2)).toBe("2026-09-29");
  });

  it("de terça, D+1 é quarta", () => {
    expect(diasUteisApos("2026-09-29", 1)).toBe("2026-09-30");
  });

  it("fim de semana como último dia conta a partir da segunda", () => {
    expect(diasUteisApos("2026-09-26", 1)).toBe("2026-09-28");
    expect(diasUteisApos("2026-09-27", 1)).toBe("2026-09-28");
  });

  it("feriado do parâmetro não conta como dia útil", () => {
    expect(diasUteisApos("2026-10-09", 1, ["2026-10-12"])).toBe("2026-10-13");
    expect(diasUteisApos("2026-10-09", 2, ["2026-10-12"])).toBe("2026-10-14");
  });

  it("zero dias devolve a mesma data", () => {
    expect(diasUteisApos("2026-09-29", 0)).toBe("2026-09-29");
  });

  it("os dois prazos saem do parâmetro, sem número no código", () => {
    expect(
      prazosDoAtendimento("2026-09-25", {
        alertaDias: 1,
        escalaCoordenacaoDias: 3,
        feriados: [],
      }),
    ).toEqual({ aviso: "2026-09-28", escala: "2026-09-30" });
  });
});

describe("situação do acompanhamento pelo prazo", () => {
  const prazos = { aviso: "2026-09-28", escala: "2026-09-29" };

  it("antes do aviso está no prazo", () => {
    expect(situacaoDoPrazo("2026-09-26", prazos, [null, null])).toBe(
      "no_prazo",
    );
  });

  it("no dia do aviso avisa a enfermeira; no dia da escalada a coordenação assume", () => {
    expect(situacaoDoPrazo("2026-09-28", prazos, ["rascunho", null])).toBe(
      "aviso",
    );
    expect(situacaoDoPrazo("2026-09-29", prazos, ["rascunho", null])).toBe(
      "escalada",
    );
    expect(situacaoDoPrazo("2026-10-05", prazos, [null])).toBe("escalada");
  });

  it("todos fora do rascunho: em andamento, mesmo depois do prazo", () => {
    expect(
      situacaoDoPrazo("2026-10-05", prazos, [
        "em_revisao",
        "aprovado",
        "erro_envio",
      ]),
    ).toBe("em_andamento");
  });

  it("todos enviados: concluída", () => {
    expect(situacaoDoPrazo("2026-10-05", prazos, ["enviado", "enviado"])).toBe(
      "concluida",
    );
  });

  it("um documento ainda não iniciado mantém o prazo correndo", () => {
    expect(situacaoDoPrazo("2026-09-29", prazos, ["enviado", null])).toBe(
      "escalada",
    );
  });
});
