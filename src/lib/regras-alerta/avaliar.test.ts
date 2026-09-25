import { describe, expect, it } from "vitest";
import { CATALOGO_REGRAS } from "./catalogo";
import {
  avaliarCampo,
  avaliarRegistro,
  exigeOcorrenciaPrivada,
} from "./avaliar";
import type { RegraAlerta, VisitaSerie } from "./tipos";

describe("avaliarCampo · PU-01", () => {
  it("38,2 °C dispara PU-01 (imediato, fonte DOC 3, ativa por padrão)", () => {
    const resultados = avaliarCampo({
      campo: "secao_2_1.temperatura_c",
      registro: { secao_2_1: { temperatura_c: 38.2 } },
    });
    expect(resultados).toHaveLength(1);
    expect(resultados[0]).toMatchObject({
      codigo: "PU-01",
      severidade: "imediato",
      grupo: "puerpera",
      exigeOcorrenciaPrivada: false,
    });
  });

  it("37,9 °C não dispara PU-01", () => {
    const resultados = avaliarCampo({
      campo: "secao_2_1.temperatura_c",
      registro: { secao_2_1: { temperatura_c: 37.9 } },
    });
    expect(resultados).toHaveLength(0);
  });

  it("roda offline: função pura, sem I/O, mesmo resultado em qualquer ambiente", () => {
    const entrada = {
      campo: "secao_2_1.temperatura_c",
      registro: { secao_2_1: { temperatura_c: 38.5 } },
    };
    expect(avaliarCampo(entrada)).toEqual(avaliarCampo({ ...entrada }));
  });
});

describe("avaliarCampo · PU-08 (série de visitas anteriores)", () => {
  // No catálogo padrão, PU-08 nasce inativa: o Apêndice B marca o corte de
  // "febre baixa persistente" (37,5 a 37,9 °C em duas visitas) como
  // [clínico], e CLAUDE.md manda regra [clínico] entrar desligada até a
  // aprovação da Edilaine. Este teste liga só esta regra, isolada, para
  // provar que o mecanismo de série (a mesma condição valendo na visita
  // atual e na anterior) funciona; o teste seguinte confirma que o
  // catálogo padrão, sem aprovação clínica, não dispara.
  const regraPu08Ativa: RegraAlerta = {
    ...CATALOGO_REGRAS.find((r) => r.id === "PU-08-temperatura-persistente")!,
    ativa: true,
  };

  it("37,6 e 37,8 em visitas seguidas dispara PU-08", () => {
    const serieAnterior: VisitaSerie[] = [
      {
        visitaId: "visita-anterior",
        dataVisita: "2026-09-10T10:00:00Z",
        registro: { secao_2_1: { temperatura_c: 37.8 } },
      },
    ];
    const resultados = avaliarCampo({
      campo: "secao_2_1.temperatura_c",
      registro: { secao_2_1: { temperatura_c: 37.6 } },
      serieAnterior,
      catalogo: [regraPu08Ativa],
    });
    expect(resultados).toHaveLength(1);
    expect(resultados[0]).toMatchObject({
      codigo: "PU-08",
      severidade: "prioritario",
    });
  });

  it("não dispara com uma visita só (sem a anterior na faixa)", () => {
    const resultados = avaliarCampo({
      campo: "secao_2_1.temperatura_c",
      registro: { secao_2_1: { temperatura_c: 37.6 } },
      catalogo: [regraPu08Ativa],
    });
    expect(resultados).toHaveLength(0);
  });

  it("regra inativa não dispara: o mesmo cenário de 37,6/37,8, no catálogo padrão, fica desligado (PU-08 é [clínico])", () => {
    const serieAnterior: VisitaSerie[] = [
      {
        visitaId: "visita-anterior",
        dataVisita: "2026-09-10T10:00:00Z",
        registro: { secao_2_1: { temperatura_c: 37.8 } },
      },
    ];
    const regraPadrao = CATALOGO_REGRAS.find(
      (r) => r.id === "PU-08-temperatura-persistente",
    )!;
    expect(regraPadrao.ativa).toBe(false);
    const resultados = avaliarCampo({
      campo: "secao_2_1.temperatura_c",
      registro: { secao_2_1: { temperatura_c: 37.6 } },
      serieAnterior,
      // usa o catálogo padrão (nenhum `catalogo` passado)
    });
    expect(resultados).toHaveLength(0);
  });
});

describe("exigeOcorrenciaPrivada e o grupo de saúde mental", () => {
  it("saúde mental imediata pede ocorrência privada", () => {
    for (const codigo of ["SM-01", "SM-02", "SM-03"]) {
      const resultados = avaliarCampo({
        campo: "secao_7.sofrimento_emocional_sinal",
        registro: { secao_7: { sofrimento_emocional_sinal: codigo } },
      });
      expect(resultados).toHaveLength(1);
      expect(resultados[0]).toMatchObject({
        codigo,
        severidade: "imediato",
        exigeOcorrenciaPrivada: true,
      });
    }
  });

  it("saúde mental prioritária não exige ocorrência privada", () => {
    const resultados = avaliarCampo({
      campo: "secao_7.sofrimento_emocional_sinal",
      registro: { secao_7: { sofrimento_emocional_sinal: "SM-04" } },
    });
    expect(resultados[0]).toMatchObject({
      codigo: "SM-04",
      exigeOcorrenciaPrivada: false,
    });
  });

  it("nenhuma regra fora de saúde mental imediata exige ocorrência privada", () => {
    expect(
      exigeOcorrenciaPrivada({ grupo: "puerpera", severidade: "imediato" }),
    ).toBe(false);
    expect(
      exigeOcorrenciaPrivada({
        grupo: "recem_nascido",
        severidade: "imediato",
      }),
    ).toBe(false);
    expect(
      exigeOcorrenciaPrivada({
        grupo: "saude_mental",
        severidade: "prioritario",
      }),
    ).toBe(false);
  });
});

describe("avaliarCampo · outras regras ativas por padrão (fonte DOC 3)", () => {
  it("RN-08: temperatura do RN acima de 38 °C dispara", () => {
    const resultados = avaliarCampo({
      campo: "secao_3_1.temperatura_rn_c",
      registro: { secao_3_1: { temperatura_rn_c: 38.4 } },
    });
    expect(resultados[0]).toMatchObject({
      codigo: "RN-08",
      severidade: "imediato",
    });
  });

  it("RN-08: hipotermia abaixo de 36 °C também dispara", () => {
    const resultados = avaliarCampo({
      campo: "secao_3_1.temperatura_rn_c",
      registro: { secao_3_1: { temperatura_rn_c: 35.5 } },
    });
    expect(resultados[0]).toMatchObject({ codigo: "RN-08" });
  });

  it("RN-04: diurese ausente por 4 horas ou mais dispara", () => {
    const resultados = avaliarCampo({
      campo: "secao_3_2.diurese_ausente_horas",
      registro: { secao_3_2: { diurese_ausente_horas: 5 } },
    });
    expect(resultados[0]).toMatchObject({
      codigo: "RN-04",
      severidade: "imediato",
    });
  });

  it("PU-04: cesárea sem sinais de infecção = não dispara", () => {
    const resultados = avaliarCampo({
      campo: "secao_2_2.cesarea_sem_sinais_infeccao",
      registro: { secao_2_2: { cesarea_sem_sinais_infeccao: false } },
    });
    expect(resultados[0]).toMatchObject({ codigo: "PU-04" });
  });

  it("campo sem nenhuma regra ligada devolve lista vazia", () => {
    expect(avaliarCampo({ campo: "campo.sem.regra", registro: {} })).toEqual(
      [],
    );
  });
});

describe("avaliarRegistro (reavaliação completa, ex.: na sincronização)", () => {
  it("avalia todas as regras ativas do catálogo, não só a do último campo", () => {
    const resultados = avaliarRegistro({
      registro: {
        secao_2_1: { temperatura_c: 38.5 },
        secao_3_1: { temperatura_rn_c: 38.4 },
      },
    });
    const codigos = resultados.map((r) => r.codigo).sort();
    expect(codigos).toEqual(["PU-01", "RN-08"]);
  });

  it("não avalia regras inativas mesmo em reavaliação completa", () => {
    const resultados = avaliarRegistro({
      registro: { secao_2_8: { latch: 3 } }, // dispararia K-03 LATCH se estivesse ativa
    });
    expect(resultados.find((r) => r.codigo === "K-03-LATCH")).toBeUndefined();
  });
});
