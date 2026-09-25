import { describe, expect, it } from "vitest";
import {
  chavePorSexo,
  preencherTexto,
  preencherTextoOpcional,
  preencherTextoPorSexo,
  semTravessaoOuMeiaRisca,
} from "./textos";

describe("preencherTexto", () => {
  const textos = {
    evo_abertura:
      "Paciente no {dia}º dia de puerpério, apresenta-se em bom estado geral.",
  };

  it("substitui a variável pelo valor", () => {
    expect(preencherTexto("evo_abertura", textos, { dia: 4 })).toBe(
      "Paciente no 4º dia de puerpério, apresenta-se em bom estado geral.",
    );
  });

  it("lança erro quando a chave não existe em mensagem_modelo", () => {
    expect(() => preencherTexto("evo_inexistente", textos, {})).toThrow(
      /Não há texto aprovado/,
    );
  });

  it("lança erro quando falta variável do modelo, em vez de imprimir {dia}", () => {
    expect(() => preencherTexto("evo_abertura", textos, {})).toThrow(
      /não foi informada/,
    );
  });
});

describe("concordância de gênero pela chave", () => {
  const textos = {
    evo_neo_conclusao_masculino: "RN calmo. Vínculo com o filho.",
    evo_neo_conclusao_feminino: "RN calma. Vínculo com a filha.",
    evo_neo_ictericia: "Icterícia em zona {zona}.",
  };

  it("usa a forma feminina para menina e a masculina para menino", () => {
    expect(
      preencherTextoPorSexo("evo_neo_conclusao", textos, "feminino", {}),
    ).toBe("RN calma. Vínculo com a filha.");
    expect(
      preencherTextoPorSexo("evo_neo_conclusao", textos, "masculino", {}),
    ).toBe("RN calmo. Vínculo com o filho.");
  });

  it("cai na chave neutra quando o texto não tem forma por sexo", () => {
    expect(chavePorSexo("evo_neo_ictericia", textos, "feminino")).toBe(
      "evo_neo_ictericia",
    );
    expect(
      preencherTextoPorSexo("evo_neo_ictericia", textos, "feminino", {
        zona: "II",
      }),
    ).toBe("Icterícia em zona II.");
  });

  it("sem forma por sexo nem neutra, a falta vira erro claro", () => {
    expect(() =>
      preencherTextoPorSexo("evo_neo_genitalia", textos, "feminino", {}),
    ).toThrow(/evo_neo_genitalia/);
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
  it("aceita texto sem travessão nem meia-risca (hífen comum é permitido)", () => {
    expect(semTravessaoOuMeiaRisca("Mal-estar em pequena quantidade.")).toBe(
      true,
    );
  });

  it("recusa travessão", () => {
    expect(semTravessaoOuMeiaRisca("Sem sinal agora \u2014 salvo.")).toBe(
      false,
    );
  });

  it("recusa meia-risca", () => {
    expect(semTravessaoOuMeiaRisca("Escala de dor 0\u201310.")).toBe(false);
  });
});
