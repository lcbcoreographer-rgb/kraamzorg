import { describe, expect, it } from "vitest";
import type { MetricasAgente } from "../tipos";
import { linhasMetricas } from "./linhas";

const BASE: MetricasAgente = {
  periodoDesde: "2026-08-30",
  periodoAte: "2026-09-29",
  tempoPrimeiraRespostaMinutos: 3,
  leadsQueRespondemPct: 83.3,
  qualificadosComValorEPdfPct: 100,
  conversasComEdilaineRegistradasPct: 0,
  followupAposPdfPct: 100,
  conversaoLeadsPct: 50,
  condicoesForaDaTabela: 0,
  leadsTotal: 6,
};

function texto(l: { antes: string; numero: string | null; depois: string }) {
  return `${l.antes}${l.numero ?? ""}${l.depois}`;
}

describe("linhasMetricas (DESIGN.md 11.10, painel que fala)", () => {
  it("uma linha por métrica, em frase, com o número e a meta", () => {
    const linhas = linhasMetricas(BASE, null);
    expect(linhas).toHaveLength(7);
    expect(texto(linhas[1]!)).toBe(
      "83,3% dos leads responderam à mensagem de abertura.",
    );
    expect(linhas[1]!.meta).toBe("Meta: 85% ou mais");
    expect(linhas[1]!.estado).toBe("abaixo");
    expect(linhas[2]!.estado).toBe("na_meta");
  });

  it("zero vira frase com 'Nenhuma', sem porcentagem", () => {
    const linhas = linhasMetricas(BASE, null);
    expect(texto(linhas[3]!)).toBe(
      "Nenhuma conversa com a Edilaine registrada no período.",
    );
    expect(linhas[3]!.estado).toBe("abaixo");
  });

  it("conversão traz a contagem de leads e, abaixo do limiar, a nota de amostra pequena", () => {
    const conversao = linhasMetricas(BASE, 20).find(
      (l) => l.chave === "conversaoLeadsPct",
    )!;
    expect(texto(conversao)).toBe(
      "50% dos 6 leads do período fecharam contrato.",
    );
    expect(conversao.nota).toBe(
      "Amostra pequena: com 6 leads, um contrato a mais ou a menos muda muito a porcentagem.",
    );
  });

  it("sem o parâmetro do limiar, nenhuma nota inventada", () => {
    const conversao = linhasMetricas(BASE, null).find(
      (l) => l.chave === "conversaoLeadsPct",
    )!;
    expect(conversao.nota).toBeUndefined();
  });

  it("sem dado não pinta estado de meta", () => {
    const linhas = linhasMetricas(
      {
        ...BASE,
        leadsQueRespondemPct: null,
        tempoPrimeiraRespostaMinutos: null,
      },
      null,
    );
    expect(linhas[0]!.estado).toBe("sem_dado");
    expect(linhas[1]!.estado).toBe("sem_dado");
  });
});
