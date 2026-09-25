import { describe, expect, it } from "vitest";
import {
  validarConselhoProfissional,
  validarContatoMedico,
  validarDatasNoPeriodo,
  validarFeridaOperatoria,
  validarGanhoPesoCoerente,
  validarIctericiaCoerente,
} from "./validacoes";
import type { DadosProfissional } from "./tipos";

const profissional: DadosProfissional = {
  nome: "Enfermeira Teste",
  funcao: "enfermeira_obstetrica",
  conselho: "COREN",
  conselhoUf: "SP",
  conselhoNumero: "123456",
};

describe("validarDatasNoPeriodo", () => {
  const periodo = { inicio: "2026-09-01", fim: "2026-09-10" };

  it("sem erro quando todas as datas caem dentro do período", () => {
    expect(
      validarDatasNoPeriodo(periodo, [
        { rotulo: "Pesagem 1", data: "2026-09-05" },
      ]),
    ).toEqual([]);
  });

  it("acusa data fora do período", () => {
    const erros = validarDatasNoPeriodo(periodo, [
      { rotulo: "Pesagem 1", data: "2026-09-20" },
    ]);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain("Pesagem 1");
  });

  it("acusa período com fim antes do início", () => {
    const erros = validarDatasNoPeriodo(
      { inicio: "2026-09-10", fim: "2026-09-01" },
      [],
    );
    expect(erros).toHaveLength(1);
  });
});

describe("validarConselhoProfissional", () => {
  it("sem erro com dados completos", () => {
    expect(validarConselhoProfissional(profissional)).toEqual([]);
  });

  it("acusa UF inválida", () => {
    const erros = validarConselhoProfissional({
      ...profissional,
      conselhoUf: "SPX",
    });
    expect(erros.some((e) => e.includes("UF"))).toBe(true);
  });

  it("acusa conselho e número vazios", () => {
    const erros = validarConselhoProfissional({
      ...profissional,
      conselho: "",
      conselhoNumero: "",
    });
    expect(erros).toHaveLength(2);
  });
});

describe("validarContatoMedico", () => {
  it("acusa contato ausente", () => {
    expect(validarContatoMedico("pediatra", undefined)).toHaveLength(1);
  });

  it("acusa contato sem e-mail nem telefone", () => {
    const erros = validarContatoMedico("obstetra", { nome: "Dr. Fulano" });
    expect(erros).toHaveLength(1);
  });

  it("sem erro com e-mail preenchido", () => {
    expect(
      validarContatoMedico("obstetra", {
        nome: "Dr. Fulano",
        email: "a@b.com",
      }),
    ).toEqual([]);
  });
});

describe("validarFeridaOperatoria", () => {
  it("cesárea sem a seção é erro", () => {
    const erros = validarFeridaOperatoria("cesarea", undefined);
    expect(erros).toHaveLength(1);
  });

  it("cesárea com a seção preenchida não gera erro", () => {
    const erros = validarFeridaOperatoria("cesarea", {
      semSinaisFlogisticos: true,
    });
    expect(erros).toEqual([]);
  });

  it("parto vaginal com a seção preenchida é erro", () => {
    const erros = validarFeridaOperatoria("vaginal", {
      semSinaisFlogisticos: true,
    });
    expect(erros).toHaveLength(1);
  });

  it("parto vaginal sem a seção não gera erro", () => {
    expect(validarFeridaOperatoria("vaginal", undefined)).toEqual([]);
  });
});

describe("validarGanhoPesoCoerente", () => {
  it("acusa conclusão de ganho progressivo quando o bebê perdeu peso", () => {
    const erros = validarGanhoPesoCoerente(
      3200,
      "2026-09-01",
      [{ data: "2026-09-08", pesoG: 3000, origem: "domicilio" }],
      "progressivo",
    );
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain("progressivo");
  });

  it("sem erro quando a conclusão bate com a curva", () => {
    const erros = validarGanhoPesoCoerente(
      3200,
      "2026-09-01",
      [{ data: "2026-09-08", pesoG: 3000, origem: "domicilio" }],
      "perda",
    );
    expect(erros).toEqual([]);
  });
});

describe("validarIctericiaCoerente", () => {
  it("acusa conclusão sem icterícia quando há registro de icterícia", () => {
    const erros = validarIctericiaCoerente({ zonaKramer: 2 }, "ausente");
    expect(erros).toHaveLength(1);
  });

  it("acusa conclusão com icterícia quando não há nenhum registro", () => {
    const erros = validarIctericiaCoerente(undefined, "regressao");
    expect(erros).toHaveLength(1);
  });

  it("sem erro quando os dois concordam", () => {
    expect(validarIctericiaCoerente({ zonaKramer: 1 }, "regressao")).toEqual(
      [],
    );
    expect(validarIctericiaCoerente(undefined, "ausente")).toEqual([]);
  });
});
