import { describe, expect, it } from "vitest";
import { avaliarCurvaPeso } from "./curva-peso";
import type { CondicaoCurvaPeso, VisitaSerie } from "./tipos";

const condicao: CondicaoCurvaPeso = {
  tipo: "curva_peso",
  campoPeso: "secao_3_1.peso_gramas",
  percentualPerdaMaximo: 10,
  diaVidaLimiteRecuperacao: 14,
};

describe("avaliarCurvaPeso (RN-13)", () => {
  it("dispara quando a perda desde o menor peso passa de 10%", () => {
    const dados = {
      registro: { secao_3_1: { peso_gramas: 2650 } }, // 11,7% abaixo de 3000 g
      contexto: { pesoNascimentoGramas: 3000, diaVidaAtual: 5 },
    };
    expect(avaliarCurvaPeso(condicao, dados)).toBe(true);
  });

  it("não dispara com perda dentro do esperado", () => {
    const dados = {
      registro: { secao_3_1: { peso_gramas: 2850 } }, // 5% abaixo
      contexto: { pesoNascimentoGramas: 3000, diaVidaAtual: 5 },
    };
    expect(avaliarCurvaPeso(condicao, dados)).toBe(false);
  });

  it("usa o MENOR peso da série, não só o peso do dia (K-11)", () => {
    const serieAnterior: VisitaSerie[] = [
      {
        visitaId: "v1",
        dataVisita: "2026-09-01T00:00:00Z",
        registro: { secao_3_1: { peso_gramas: 2650 } },
      },
    ];
    const dados = {
      registro: { secao_3_1: { peso_gramas: 2900 } }, // hoje recuperou, mas o menor peso já observado foi 2650
      serieAnterior,
      contexto: { pesoNascimentoGramas: 3000, diaVidaAtual: 10 },
    };
    expect(avaliarCurvaPeso(condicao, dados)).toBe(true);
  });

  it("dispara por não recuperação do peso de nascimento até o D14", () => {
    const dados = {
      registro: { secao_3_1: { peso_gramas: 2950 } }, // perda de 1,7%, dentro do limite
      contexto: { pesoNascimentoGramas: 3000, diaVidaAtual: 14 },
    };
    expect(avaliarCurvaPeso(condicao, dados)).toBe(true);
  });

  it("não dispara antes do D14 mesmo sem ter recuperado o peso", () => {
    const dados = {
      registro: { secao_3_1: { peso_gramas: 2950 } },
      contexto: { pesoNascimentoGramas: 3000, diaVidaAtual: 13 },
    };
    expect(avaliarCurvaPeso(condicao, dados)).toBe(false);
  });

  it("não dispara no D14 se já recuperou o peso de nascimento", () => {
    const dados = {
      registro: { secao_3_1: { peso_gramas: 3010 } },
      contexto: { pesoNascimentoGramas: 3000, diaVidaAtual: 14 },
    };
    expect(avaliarCurvaPeso(condicao, dados)).toBe(false);
  });

  it("sem peso ao nascer no contexto, nunca dispara", () => {
    const dados = {
      registro: { secao_3_1: { peso_gramas: 2000 } },
      contexto: {},
    };
    expect(avaliarCurvaPeso(condicao, dados)).toBe(false);
  });

  it("sem nenhum peso na série, nunca dispara", () => {
    const dados = { registro: {}, contexto: { pesoNascimentoGramas: 3000 } };
    expect(avaliarCurvaPeso(condicao, dados)).toBe(false);
  });
});
