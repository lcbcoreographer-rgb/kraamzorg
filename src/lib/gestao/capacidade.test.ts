import { describe, expect, it } from "vitest";
import { inicioDaSemana, somarDias } from "@/lib/agenda/datas";
import {
  CONFIG_DISTRIBUICAO,
  PARAMETROS_GESTAO,
} from "@/lib/dados/demonstracao/gestao-fixtures";
import {
  capacidadeSemanal,
  cenarios,
  distribuicaoNascimento,
  origemDistribuicao,
  poissonBinomial,
  type ContratoCapacidade,
  type EntradaCapacidade,
} from "./capacidade";

/**
 * Capacidade probabilística (P45) em TypeScript. Os cenários são os mesmos do
 * pgTAP 026 (segunda-feira 03/03/2031, região com limite de 3, e assim por
 * diante): o que o banco devolve e o que a demonstração devolve têm de ser
 * os mesmos números.
 */

const REGIAO_A = "regiao-a";
const REGIAO_B = "regiao-b";
const REGIAO_C = "regiao-c";
const parametros = {
  alertaPct: PARAMETROS_GESTAO.capacidadeAlertaPct,
  sobrevendaProbPct: PARAMETROS_GESTAO.sobrevendaProbPct,
  visitasPorDia: PARAMETROS_GESTAO.visitasPorDia,
  reservaProfissionais: PARAMETROS_GESTAO.backupReservaProfissionais,
};
const dist = distribuicaoNascimento(CONFIG_DISTRIBUICAO, []);

function contratoFato(i: number, regiaoId: string): ContratoCapacidade {
  return {
    familiaId: `f${i}`,
    regiaoId,
    dias: 6,
    inicioFato: "2031-03-03",
    dpp: "2031-03-01",
    dataNascimento: null,
  };
}

function entrada(parcial: Partial<EntradaCapacidade>): EntradaCapacidade {
  return {
    contratos: [],
    regioes: [
      { id: REGIAO_A, nome: "Região A", limiteFamilias: 3 },
      { id: REGIAO_B, nome: "Região B", limiteFamilias: 1 },
      { id: REGIAO_C, nome: "Região C", limiteFamilias: 3 },
    ],
    profissionais: [
      { regioes: [REGIAO_A], bloqueios: [] },
      { regioes: [REGIAO_A], bloqueios: [] },
    ],
    dist,
    hoje: "2026-09-30",
    de: "2031-03-03",
    ate: "2031-03-03",
    deslocamentoInicio: CONFIG_DISTRIBUICAO.deslocamentoInicioDias,
    parametros,
    regiaoId: REGIAO_A,
    ...parcial,
  };
}

describe("soma de Bernoullis", () => {
  it("bate com as contas feitas à mão no pgTAP", () => {
    expect(poissonBinomial([0.5, 0.5])).toEqual([0.25, 0.5, 0.25]);
    expect(poissonBinomial([])).toEqual([1]);
    expect(poissonBinomial([1, 1, 0])).toEqual([0, 0, 1, 0]);
    const tres = poissonBinomial([0.5, 0.5, 0.2]);
    expect(tres[0]).toBeCloseTo(0.2, 12);
    expect(tres[1]).toBeCloseTo(0.45, 12);
    expect(tres[2]).toBeCloseTo(0.3, 12);
    expect(tres[3]).toBeCloseTo(0.05, 12);
  });

  it("soma 1 e recorta probabilidades fora de 0 a 1", () => {
    const pmf = poissonBinomial([0.3, 0.9, 1.4, -0.2]);
    expect(pmf.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
  });
});

describe("distribuição do nascimento", () => {
  it("a referência soma 1, tem 77 dias e 79% entre 38 e 41 semanas e 6 dias", () => {
    expect(dist).toHaveLength(77);
    expect(dist.reduce((s, x) => s + x.peso, 0)).toBeCloseTo(1, 12);
    const central = dist
      .filter((x) => x.deslocamento >= -14 && x.deslocamento <= 13)
      .reduce((s, x) => s + x.peso, 0);
    expect(central).toBeCloseTo(0.79, 4);
    expect(origemDistribuicao(CONFIG_DISTRIBUICAO, []).fonte).toBe(
      "referencia",
    );
  });

  it("o histórico próprio vence a referência quando há partos suficientes", () => {
    const partos = Array.from({ length: 30 }, (_, i) => ({
      dpp: somarDias("2029-01-10", i),
      nascimento: somarDias("2029-01-10", i),
    }));
    const d = distribuicaoNascimento(CONFIG_DISTRIBUICAO, partos);
    expect(origemDistribuicao(CONFIG_DISTRIBUICAO, partos).fonte).toBe(
      "historico",
    );
    const naFaixa = d
      .filter((x) => x.deslocamento >= 0 && x.deslocamento <= 6)
      .reduce((s, x) => s + x.peso, 0);
    expect(naFaixa).toBeCloseTo(1, 12);
    // um parto a menos que o mínimo: volta a referência
    expect(origemDistribuicao(CONFIG_DISTRIBUICAO, partos.slice(1)).fonte).toBe(
      "referencia",
    );
    expect(
      distribuicaoNascimento(CONFIG_DISTRIBUICAO, partos.slice(1)),
    ).toHaveLength(77);
  });

  it("sem faixas não há distribuição (nada inventado)", () => {
    expect(
      distribuicaoNascimento({ ...CONFIG_DISTRIBUICAO, faixas: [] }, []),
    ).toEqual([]);
  });
});

describe("cenários de início", () => {
  const base = { familiaId: "f", regiaoId: REGIAO_A, dias: 6 };

  it("fato vence estimativa: nascimento registrado vale mais que a DPP", () => {
    const [c, ...resto] = cenarios(
      [
        {
          ...base,
          inicioFato: null,
          dpp: "2031-06-10",
          dataNascimento: "2031-06-03",
        },
      ],
      dist,
      "2026-09-30",
      2,
    );
    expect(resto).toHaveLength(0);
    expect(c).toMatchObject({ inicio: "2031-06-05", peso: 1 });
  });

  it("início conhecido (alta ou início efetivo) é um cenário só", () => {
    const lista = cenarios(
      [
        {
          ...base,
          inicioFato: "2031-03-03",
          dpp: "2031-03-01",
          dataNascimento: null,
        },
      ],
      dist,
      "2026-09-30",
      2,
    );
    expect(lista).toEqual([{ ...base, inicio: "2031-03-03", peso: 1 }]);
  });

  it("DPP passada sem nascimento: nenhum início antes de hoje e os pesos somam 1", () => {
    const hoje = "2026-09-30";
    const lista = cenarios(
      [
        {
          ...base,
          inicioFato: null,
          dpp: somarDias(hoje, -5),
          dataNascimento: null,
        },
      ],
      dist,
      hoje,
      2,
    );
    expect(lista.every((c) => c.inicio >= somarDias(hoje, 2))).toBe(true);
    expect(lista.reduce((s, c) => s + c.peso, 0)).toBeCloseTo(1, 12);
  });

  it("DPP muito antiga: o nascimento é hoje", () => {
    const hoje = "2026-09-30";
    const lista = cenarios(
      [
        {
          ...base,
          inicioFato: null,
          dpp: somarDias(hoje, -200),
          dataNascimento: null,
        },
      ],
      dist,
      hoje,
      2,
    );
    expect(lista).toEqual([{ ...base, inicio: somarDias(hoje, 2), peso: 1 }]);
  });

  it("sem DPP nem fato o contrato não entra", () => {
    expect(
      cenarios(
        [{ ...base, inicioFato: null, dpp: null, dataNascimento: null }],
        dist,
        "2026-09-30",
        2,
      ),
    ).toEqual([]);
  });
});

describe("capacidade por semana com início conhecido", () => {
  it("quatro famílias na mesma semana num limite de três: sobrevenda com certeza", () => {
    const [s] = capacidadeSemanal(
      entrada({
        contratos: [1, 2, 3, 4].map((i) => contratoFato(i, REGIAO_A)),
      }),
    );
    expect(s).toMatchObject({
      familiasEsperadas: 4,
      familiasP90: 4,
      ocupacaoPct: 114.3,
      probExcessoPct: 100,
      nivel: "sobrevenda",
    });
  });

  it("três famílias no limite de três: sem sobrevenda, atenção pela ocupação", () => {
    const [s] = capacidadeSemanal(
      entrada({ contratos: [1, 2, 3].map((i) => contratoFato(i, REGIAO_A)) }),
    );
    expect(s).toMatchObject({
      familiasEsperadas: 3,
      ocupacaoPct: 85.7,
      probExcessoPct: 0,
      nivel: "atencao",
    });
  });

  it("duas famílias e duas profissionais livres: folga, cobertura ok", () => {
    const [s] = capacidadeSemanal(
      entrada({ contratos: [1, 2].map((i) => contratoFato(i, REGIAO_A)) }),
    );
    expect(s).toMatchObject({
      familiasEsperadas: 2,
      familiasP90: 2,
      ocupacaoPct: 57.1,
      profissionaisAtivas: 2,
      capacidadeEquipe: 4,
      cobertura: "ok",
      nivel: "folga",
    });
  });

  it("uma profissional de férias na semana: sem reserva de backup, atenção", () => {
    const [s] = capacidadeSemanal(
      entrada({
        contratos: [1, 2].map((i) => contratoFato(i, REGIAO_A)),
        profissionais: [
          {
            regioes: [REGIAO_A],
            bloqueios: [{ inicio: "2031-03-03", fim: "2031-03-09" }],
          },
          { regioes: [REGIAO_A], bloqueios: [] },
        ],
      }),
    );
    expect(s).toMatchObject({
      capacidadeEquipe: 2,
      cobertura: "sem_reserva",
      nivel: "atencao",
    });
  });

  it("região sem profissional: cobertura insuficiente", () => {
    const [s] = capacidadeSemanal(
      entrada({ contratos: [contratoFato(1, REGIAO_C)], regiaoId: REGIAO_C }),
    );
    expect(s).toMatchObject({
      profissionaisAtivas: 0,
      capacidadeEquipe: 0,
      cobertura: "insuficiente",
      nivel: "atencao",
    });
  });

  it("o limite de alerta e o de sobrevenda são parâmetros", () => {
    const contratos = [1, 2].map((i) => contratoFato(i, REGIAO_A));
    const [s50] = capacidadeSemanal(
      entrada({ contratos, parametros: { ...parametros, alertaPct: 50 } }),
    );
    expect(s50?.nivel).toBe("atencao");
    const quatro = [1, 2, 3, 4].map((i) => contratoFato(i, REGIAO_A));
    const [certeza] = capacidadeSemanal(
      entrada({
        contratos: quatro,
        parametros: { ...parametros, sobrevendaProbPct: 100 },
      }),
    );
    expect(certeza?.nivel).toBe("sobrevenda");
  });

  it("entre 03/03 e 27/04 são oito semanas; a seguinte, sem famílias, está em folga", () => {
    const semanas = capacidadeSemanal(
      entrada({
        contratos: [1, 2].map((i) => contratoFato(i, REGIAO_A)),
        ate: "2031-04-27",
      }),
    );
    expect(semanas).toHaveLength(8);
    expect(semanas[1]?.nivel).toBe("folga");
    expect(semanas.map((x) => x.semana)[7]).toBe(inicioDaSemana("2031-04-27"));
  });
});

describe("a probabilidade confere com a conta independente", () => {
  it("três famílias com a mesma DPP num limite de uma", () => {
    const contratos: ContratoCapacidade[] = [1, 2, 3].map((i) => ({
      familiaId: `b${i}`,
      regiaoId: REGIAO_B,
      dias: 6,
      inicioFato: null,
      dpp: "2031-06-10",
      dataNascimento: null,
    }));
    const semanas = capacidadeSemanal(
      entrada({
        contratos,
        regiaoId: REGIAO_B,
        de: "2031-04-01",
        ate: "2031-08-31",
      }),
    ).filter((x) => x.familiasEsperadas > 0);

    // p da semana = peso dos inícios cujos 6 dias tocam a semana
    const p = new Map<string, number>();
    for (const d of dist) {
      const inicio = somarDias("2031-06-10", d.deslocamento + 2);
      const tocadas = new Set([
        inicioDaSemana(inicio),
        inicioDaSemana(somarDias(inicio, 5)),
      ]);
      for (const s of tocadas) p.set(s, (p.get(s) ?? 0) + d.peso);
    }
    for (const s of semanas) {
      const pw = p.get(s.semana) ?? 0;
      const excesso = 1 - (1 - pw) ** 3 - 3 * pw * (1 - pw) ** 2;
      expect(s.probExcessoPct).toBeCloseTo(Math.round(1000 * excesso) / 10, 5);
      expect(s.familiasEsperadas).toBeCloseTo(Math.round(300 * pw) / 100, 5);
    }
    expect(semanas.some((s) => s.nivel === "sobrevenda")).toBe(true);
  });

  it("um contrato só com a DPP distribui exatamente os seus dias pelas semanas", () => {
    const semanas = capacidadeSemanal(
      entrada({
        contratos: [
          {
            familiaId: "d1",
            regiaoId: REGIAO_A,
            dias: 6,
            inicioFato: null,
            dpp: "2031-09-16",
            dataNascimento: null,
          },
        ],
        de: "2031-07-01",
        ate: "2031-12-31",
      }),
    );
    const total = semanas.reduce(
      (s, x) => s + x.ocupacaoPct * ((x.limiteFamilias * 7) / 100),
      0,
    );
    expect(total).toBeCloseTo(6, 0);
    expect(semanas.every((x) => x.nivel !== "sobrevenda")).toBe(true);
  });
});
