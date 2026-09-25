import { describe, expect, it } from "vitest";
import {
  concordar,
  preencherTexto,
  preencherTextoOpcional,
  semTravessaoOuMeiaRisca,
} from "./textos";

describe("concordar", () => {
  it("devolve a forma masculina para sexo masculino", () => {
    expect(concordar("masculino", "filho", "filha")).toBe("filho");
  });

  it("devolve a forma feminina para sexo feminino", () => {
    expect(concordar("feminino", "nascido", "nascida")).toBe("nascida");
  });
});

describe("preencherTexto", () => {
  const textos = {
    evo_abertura:
      "Paciente no {dia}º dia de puerpério, apresenta-se em bom estado geral.",
    evo_conclusao_neonatal:
      "RN estável, {adjetivos}, em evolução favorável, {aleitamento}, apresentando {evolucao_peso}, {estado_ictericia}, evolução progressiva do vínculo com o {filho}.",
  };

  it("substitui uma variável simples", () => {
    expect(preencherTexto("evo_abertura", textos, { dia: 4 })).toBe(
      "Paciente no 4º dia de puerpério, apresenta-se em bom estado geral.",
    );
  });

  it("substitui várias variáveis, inclusive as de concordância de gênero", () => {
    const texto = preencherTexto("evo_conclusao_neonatal", textos, {
      adjetivos: concordar(
        "feminino",
        "calmo, ativo e reativo",
        "calma, ativa e reativa",
      ),
      aleitamento: "em aleitamento materno exclusivo",
      evolucao_peso: "ganho de peso progressivo",
      estado_ictericia: "sem icterícia",
      filho: concordar("feminino", "filho", "filha"),
    });
    expect(texto).toContain("calma, ativa e reativa");
    expect(texto).toContain("com o filha");
  });

  it("lança erro quando a chave não existe em mensagem_modelo", () => {
    expect(() => preencherTexto("evo_inexistente", textos, {})).toThrow(
      /não há texto/,
    );
  });

  it("lança erro quando falta variável do modelo", () => {
    expect(() => preencherTexto("evo_abertura", textos, {})).toThrow(
      /não foi informada/,
    );
  });
});

describe("preencherTextoOpcional", () => {
  const textos = { evo_laser: "Realizada aplicação no dia {dia}." };

  it("devolve undefined quando a chave não foi aprovada ainda", () => {
    expect(preencherTextoOpcional("evo_ilib", textos, {})).toBeUndefined();
  });

  it("preenche normalmente quando a chave existe", () => {
    expect(preencherTextoOpcional("evo_laser", textos, { dia: 3 })).toBe(
      "Realizada aplicação no dia 3.",
    );
  });
});

describe("semTravessaoOuMeiaRisca", () => {
  it("aceita texto sem travessão nem meia-risca", () => {
    expect(semTravessaoOuMeiaRisca("Sangramento em pequena quantidade.")).toBe(
      true,
    );
  });

  it("recusa travessão", () => {
    expect(
      semTravessaoOuMeiaRisca("Sem sinal agora — o registro está salvo."),
    ).toBe(false);
  });

  it("recusa meia-risca", () => {
    expect(semTravessaoOuMeiaRisca("Escala de dor 0–10.")).toBe(false);
  });
});
