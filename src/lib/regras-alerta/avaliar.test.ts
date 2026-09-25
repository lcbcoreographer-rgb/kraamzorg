import { describe, expect, it } from "vitest";
import {
  avaliarCampo,
  avaliarRegistro,
  exigeOcorrenciaPrivada,
  regraDoBanco,
  validarCatalogo,
} from "./avaliar";
import { CATALOGO_REGRAS } from "./catalogo";
import { lerRegrasDoSeed } from "./seed-regra-alerta.test-util";
import type { LinhaRegraAlerta, RegraAlerta, VisitaSerie } from "./tipos";

// O caminho de produção: linhas de regra_alerta (aqui, as do seed) viram o
// cache que o aparelho e o servidor passam ao motor.
const CACHE_DO_BANCO: RegraAlerta[] = lerRegrasDoSeed().map(regraDoBanco);

/** Simula a aprovação clínica de uma regra do catálogo de referência. */
function aprovada(id: string): RegraAlerta {
  const regra = CATALOGO_REGRAS.find((r) => r.id === id);
  if (!regra) throw new Error(`regra ${id} não encontrada`);
  return { ...regra, ativa: true };
}

function visitaAnterior(registro: Record<string, unknown>): VisitaSerie {
  return {
    visitaId: "visita-anterior",
    dataVisita: "2026-09-10T10:00:00-03:00",
    registro,
  };
}

describe("PU-01 com as regras do banco (aceite do P40)", () => {
  it("38,2 °C dispara PU-01 imediato, com conduta e versão do instrumento, sem rede", () => {
    const resultados = avaliarCampo({
      campo: "2.1.temperatura",
      registro: { "2.1": { temperatura: 38.2 } },
      catalogo: CACHE_DO_BANCO,
    });
    expect(resultados).toHaveLength(1);
    expect(resultados[0]).toMatchObject({
      codigo: "PU-01",
      severidade: "imediato",
      grupo: "puerpera",
      conduta:
        "Acionar supervisão médica imediatamente e orientar busca de atendimento emergencial.",
      exigeOcorrenciaPrivada: false,
      valorObservado: 38.2,
      instrumentoVersao: "v1-2026-09",
    });
  });

  it("aceita o registro aninhado por segmento e o valor digitado com vírgula", () => {
    for (const registro of [
      { "2": { "1": { temperatura: 38.2 } } },
      { "2.1": { temperatura: "38,2" } },
      { "2.1": { temperatura: "38.2" } },
    ]) {
      const resultados = avaliarCampo({
        campo: "2.1.temperatura",
        registro,
        catalogo: CACHE_DO_BANCO,
      });
      expect(
        resultados.map((r) => r.codigo),
        JSON.stringify(registro),
      ).toEqual(["PU-01"]);
    }
  });

  it("38,0 °C dispara (≥ 38) e 37,9 °C não dispara", () => {
    const avaliar = (temperatura: number) =>
      avaliarCampo({
        campo: "2.1.temperatura",
        registro: { "2.1": { temperatura } },
        catalogo: CACHE_DO_BANCO,
      }).map((r) => r.codigo);
    expect(avaliar(38)).toEqual(["PU-01"]);
    expect(avaliar(37.9)).toEqual([]);
  });

  it("campo vazio ou texto que não é número não dispara", () => {
    for (const temperatura of [undefined, null, "", "febre", "38,2 graus"]) {
      expect(
        avaliarCampo({
          campo: "2.1.temperatura",
          registro: { "2.1": { temperatura } },
          catalogo: CACHE_DO_BANCO,
        }),
      ).toEqual([]);
    }
  });

  it("o catálogo de referência dá o mesmo resultado que o banco", () => {
    const entrada = {
      campo: "2.1.temperatura",
      registro: { "2.1": { temperatura: 38.2 } },
    };
    const doBanco = avaliarCampo({ ...entrada, catalogo: CACHE_DO_BANCO });
    const daReferencia = avaliarCampo({
      ...entrada,
      catalogo: CATALOGO_REGRAS,
    });
    expect(
      daReferencia.map((r) => [r.codigo, r.severidade, r.conduta]),
    ).toEqual(doBanco.map((r) => [r.codigo, r.severidade, r.conduta]));
  });
});

describe("PU-08 (série de visitas anteriores)", () => {
  // No banco e no catálogo, PU-08 está desligada ([clínico: corte de "febre
  // baixa persistente"]). Os testes do mecanismo ligam só esta regra, como
  // se a Edilaine tivesse aprovado o corte proposto no Apêndice B.
  const catalogo = [aprovada("PU-08")];
  const avaliar = (atual: number, anteriores: number[]) =>
    avaliarCampo({
      campo: "2.1.temperatura",
      registro: { "2.1": { temperatura: atual } },
      serieAnterior: anteriores.map((t) =>
        visitaAnterior({ "2.1": { temperatura: t } }),
      ),
      catalogo,
    }).map((r) => [r.codigo, r.severidade]);

  it("37,6 e 37,8 em visitas seguidas dispara PU-08 prioritário", () => {
    expect(avaliar(37.6, [37.8])).toEqual([["PU-08", "prioritario"]]);
  });

  it("uma visita só na faixa não dispara", () => {
    expect(avaliar(37.6, [])).toEqual([]);
  });

  it("visita anterior fora da faixa (36,9 ou 38,2) quebra a sequência", () => {
    expect(avaliar(37.6, [36.9])).toEqual([]);
    expect(avaliar(37.6, [38.2])).toEqual([]);
  });

  it("só a visita imediatamente anterior conta: 37,6 hoje, 36,8 ontem e 37,7 antes não dispara", () => {
    expect(avaliar(37.6, [36.8, 37.7])).toEqual([]);
  });
});

describe("regra inativa não dispara", () => {
  it("PU-08 como está no banco (inativa) não dispara com 37,6 e 37,8", () => {
    const resultados = avaliarCampo({
      campo: "2.1.temperatura",
      registro: { "2.1": { temperatura: 37.6 } },
      serieAnterior: [visitaAnterior({ "2.1": { temperatura: 37.8 } })],
      catalogo: CACHE_DO_BANCO,
    });
    expect(resultados).toEqual([]);
  });

  it("PU-08 do catálogo de referência, com condição mas inativa, não dispara", () => {
    const resultados = avaliarCampo({
      campo: "2.1.temperatura",
      registro: { "2.1": { temperatura: 37.6 } },
      serieAnterior: [visitaAnterior({ "2.1": { temperatura: 37.8 } })],
      catalogo: CATALOGO_REGRAS,
    });
    expect(resultados).toEqual([]);
  });

  it("PU-01 desligada no cache não dispara nem com 39,5 °C", () => {
    const desligada = CACHE_DO_BANCO.map((r) =>
      r.codigo === "PU-01" ? { ...r, ativa: false } : r,
    );
    expect(
      avaliarCampo({
        campo: "2.1.temperatura",
        registro: { "2.1": { temperatura: 39.5 } },
        catalogo: desligada,
      }),
    ).toEqual([]);
  });

  it("reavaliação completa também ignora as inativas (LATCH 3, icterícia zona IV)", () => {
    const resultados = avaliarRegistro({
      registro: { "2.8": { latch: 3 }, "3": { ictericia: 4 } },
      catalogo: CATALOGO_REGRAS,
    });
    expect(resultados).toEqual([]);
  });
});

describe("saúde mental e ocorrência privada", () => {
  const smAprovadas = [
    "SM-01",
    "SM-02",
    "SM-03",
    "SM-04",
    "SM-05",
    "SM-06",
    "SM-07",
  ].map(aprovada);

  it("saúde mental imediata pede ocorrência privada", () => {
    for (const codigo of ["SM-01", "SM-02", "SM-03"]) {
      const resultados = avaliarCampo({
        campo: "7.sofrimento_emocional",
        registro: { "7": { sofrimento_emocional: [codigo] } },
        catalogo: smAprovadas,
      });
      expect(resultados).toHaveLength(1);
      expect(resultados[0]).toMatchObject({
        codigo,
        severidade: "imediato",
        exigeOcorrenciaPrivada: true,
      });
    }
  });

  it("seletor com mais de um sinal dispara cada um; só o imediato pede ocorrência privada", () => {
    const resultados = avaliarCampo({
      campo: "7.sofrimento_emocional",
      registro: { "7": { sofrimento_emocional: ["SM-04", "SM-01"] } },
      catalogo: smAprovadas,
    });
    expect(
      resultados.map((r) => [r.codigo, r.exigeOcorrenciaPrivada]).sort(),
    ).toEqual([
      ["SM-01", true],
      ["SM-04", false],
    ]);
  });

  it("seletor com um sinal só guardado como texto também dispara", () => {
    const resultados = avaliarCampo({
      campo: "7.sofrimento_emocional",
      registro: { "7": { sofrimento_emocional: "SM-02" } },
      catalogo: smAprovadas,
    });
    expect(resultados.map((r) => r.codigo)).toEqual(["SM-02"]);
  });

  it("sem aprovação (banco e catálogo como estão) o seletor SM não dispara", () => {
    for (const catalogo of [CACHE_DO_BANCO, CATALOGO_REGRAS]) {
      expect(
        avaliarCampo({
          campo: "7.sofrimento_emocional",
          registro: { "7": { sofrimento_emocional: ["SM-01"] } },
          catalogo,
        }),
      ).toEqual([]);
    }
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
    expect(
      exigeOcorrenciaPrivada({ grupo: "saude_mental", severidade: "imediato" }),
    ).toBe(true);
  });
});

describe("demais regras ativas do banco (Fonte: DOC 3)", () => {
  const codigos = (campo: string, registro: Record<string, unknown>) =>
    avaliarCampo({ campo, registro, catalogo: CACHE_DO_BANCO }).map(
      (r) => r.codigo,
    );

  it("RN-08 (fora_da_faixa 36 a 38): 38,4 e 35,5 disparam; 36 e 38 não", () => {
    expect(
      codigos("3.1.temperatura", { "3.1": { temperatura: 38.4 } }),
    ).toEqual(["RN-08"]);
    expect(
      codigos("3.1.temperatura", { "3.1": { temperatura: 35.5 } }),
    ).toEqual(["RN-08"]);
    expect(codigos("3.1.temperatura", { "3.1": { temperatura: 36 } })).toEqual(
      [],
    );
    expect(codigos("3.1.temperatura", { "3.1": { temperatura: 38 } })).toEqual(
      [],
    );
  });

  it("RN-04: 4 horas sem diurese dispara, 3 horas não", () => {
    expect(
      codigos("3.2.horas_sem_diurese", { "3.2": { horas_sem_diurese: 4 } }),
    ).toEqual(["RN-04"]);
    expect(
      codigos("3.2.horas_sem_diurese", { "3.2": { horas_sem_diurese: 3 } }),
    ).toEqual([]);
  });

  it("PU-04: salvar o subcampo da condição (sem sinais de infecção = não) dispara, mesmo com o campo da regra sendo o item pai", () => {
    expect(
      codigos("2.2.sem_sinais_infeccao", {
        "2.2": { sem_sinais_infeccao: false },
      }),
    ).toEqual(["PU-04"]);
    expect(
      codigos("2.2.sem_sinais_infeccao", {
        "2.2": { sem_sinais_infeccao: true },
      }),
    ).toEqual([]);
    expect(codigos("2.2.sem_sinais_infeccao", { "2.2": {} })).toEqual([]);
  });

  it("RN-01, RN-03 e RN-07 disparam pelo sim ou não do DOC 2", () => {
    expect(
      codigos("3.respiracao_com_esforco", {
        "3": { respiracao_com_esforco: true },
      }),
    ).toEqual(["RN-01"]);
    expect(
      codigos("3.atividade_preservada", {
        "3": { atividade_preservada: false },
      }),
    ).toEqual(["RN-03"]);
    expect(
      codigos("3.2.coto_com_sinais_flogisticos", {
        "3.2": { coto_com_sinais_flogisticos: true },
      }),
    ).toEqual(["RN-07"]);
    expect(
      codigos("3.atividade_preservada", {
        "3": { atividade_preservada: true },
      }),
    ).toEqual([]);
  });

  it("campo sem nenhuma regra ligada devolve lista vazia", () => {
    expect(codigos("1.horario", { "1": { horario: "09:00" } })).toEqual([]);
  });
});

describe("RN-13 (curva de peso, série como entrada)", () => {
  const catalogo = [aprovada("RN-13")];
  it("perda acima de 10% desde o menor peso dispara depois de aprovada; no banco segue desligada", () => {
    const entrada = {
      campo: "3.1.peso",
      registro: { "3.1": { peso: 2900 } },
      serieAnterior: [visitaAnterior({ "3.1": { peso: 2650 } })],
      contexto: { pesoNascimentoGramas: 3000, diaVidaAtual: 5 },
    };
    expect(avaliarCampo({ ...entrada, catalogo }).map((r) => r.codigo)).toEqual(
      ["RN-13"],
    );
    expect(avaliarCampo({ ...entrada, catalogo: CACHE_DO_BANCO })).toEqual([]);
  });
});

describe("avaliarRegistro (reavaliação completa, na sincronização)", () => {
  it("avalia todas as regras ativas, não só a do último campo salvo", () => {
    const resultados = avaliarRegistro({
      registro: {
        "2.1": { temperatura: 38.5 },
        "3.1": { temperatura: 38.4 },
        "3.2": { horas_sem_diurese: 1 },
      },
      catalogo: CACHE_DO_BANCO,
    });
    expect(resultados.map((r) => r.codigo).sort()).toEqual(["PU-01", "RN-08"]);
  });

  it("registro sem alteração não gera alerta", () => {
    const resultados = avaliarRegistro({
      registro: {
        "2.1": { temperatura: 36.6 },
        "2.2": { sem_sinais_infeccao: true },
        "3": { respiracao_com_esforco: false, atividade_preservada: true },
        "3.1": { temperatura: 36.8 },
        "3.2": { horas_sem_diurese: 2, coto_com_sinais_flogisticos: false },
      },
      catalogo: CACHE_DO_BANCO,
    });
    expect(resultados).toEqual([]);
  });
});

describe("regra quebrada nunca dispara e aparece na carga do cache", () => {
  const linhaBase: LinhaRegraAlerta = {
    id: "PU-01",
    grupo: "puerpera",
    descricao: "Febre ≥ 38 °C",
    severidade: "imediato",
    conduta: "Acionar supervisão médica.",
    campo: "2.1.temperatura",
    condicao: { campo: "2.1.temperatura", operador: ">=", valor: 38 },
    instrumento_versao: "v1-2026-09",
    ativa: true,
  };

  it("condição com operador desconhecido, sem limite ou vazia não dispara, com qualquer valor", () => {
    for (const condicao of [
      { campo: "2.1.temperatura", operador: "~", valor: 38 },
      { campo: "2.1.temperatura", operador: ">=" },
      { campo: "2.1.temperatura", operador: ">=", valor: "38" },
      { tipo: "desconhecido", campo: "2.1.temperatura" },
      {},
    ]) {
      const catalogo = [regraDoBanco({ ...linhaBase, condicao })];
      for (const temperatura of [36.5, 38.2, 40]) {
        expect(
          avaliarCampo({
            campo: "2.1.temperatura",
            registro: { "2.1": { temperatura } },
            catalogo,
          }),
          JSON.stringify(condicao),
        ).toEqual([]);
      }
      expect(validarCatalogo(catalogo)).toEqual([
        { regraId: "PU-01", motivo: "regra ativa sem condição válida" },
      ]);
    }
  });

  it("regraDoBanco recusa grupo ou severidade fora do PRD 6.6", () => {
    expect(() => regraDoBanco({ ...linhaBase, grupo: "outro" })).toThrow(
      /grupo/,
    );
    expect(() => regraDoBanco({ ...linhaBase, severidade: "urgente" })).toThrow(
      /severidade/,
    );
  });
});
