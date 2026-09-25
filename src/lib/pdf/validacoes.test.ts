import { describe, expect, it } from "vitest";
import {
  dadosNeonatalTeste,
  dadosPuerperalTeste,
  profissionalTeste,
} from "./__fixtures__/acompanhamento-sintetico";
import {
  dataValida,
  validarConselhoProfissional,
  validarContatoMedico,
  validarDataEmissao,
  validarDatasNoPeriodo,
  validarDiasD,
  validarDor,
  validarEvolucaoNeonatal,
  validarEvolucaoPuerperal,
  validarFeridaOperatoria,
  validarGanhoPesoCoerente,
  validarIctericiaCoerente,
  validarPeriodo,
} from "./validacoes";

const periodo = { inicio: "2026-09-01", fim: "2026-09-10" };

describe("datas", () => {
  it("dataValida recusa formato brasileiro e dia que não existe", () => {
    expect(dataValida("2026-09-01")).toBe(true);
    expect(dataValida("01/09/2026")).toBe(false);
    expect(dataValida("2026-02-30")).toBe(false);
  });

  it("sem erro quando todas as datas caem dentro do período", () => {
    expect(
      validarDatasNoPeriodo(periodo, [
        { rotulo: "Pesagem 1", data: "2026-09-05" },
      ]),
    ).toEqual([]);
  });

  it("acusa data fora do período, dizendo qual", () => {
    const erros = validarDatasNoPeriodo(periodo, [
      { rotulo: "Pesagem 1", data: "2026-09-20" },
    ]);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain("Pesagem 1");
  });

  it("acusa período com fim antes do início", () => {
    expect(
      validarPeriodo({ inicio: "2026-09-10", fim: "2026-09-01" }),
    ).toHaveLength(1);
  });

  it("documento emitido no último dia ou depois passa; antes do fim é erro", () => {
    expect(validarDataEmissao(periodo, "2026-09-10")).toEqual([]);
    expect(validarDataEmissao(periodo, "2026-09-11")).toEqual([]);
    expect(validarDataEmissao(periodo, "2026-09-09")).toHaveLength(1);
  });

  it("dia D fora de D1 a Dn é erro (período de 10 dias)", () => {
    expect(validarDiasD(periodo, [{ rotulo: "Laser", dia: 10 }])).toEqual([]);
    expect(validarDiasD(periodo, [{ rotulo: "Laser", dia: 11 }])).toHaveLength(
      1,
    );
    expect(validarDiasD(periodo, [{ rotulo: "Laser", dia: 0 }])).toHaveLength(
      1,
    );
  });
});

describe("validarConselhoProfissional", () => {
  it("sem erro com dados completos", () => {
    expect(validarConselhoProfissional(profissionalTeste)).toEqual([]);
  });

  it("acusa UF inválida", () => {
    const erros = validarConselhoProfissional({
      ...profissionalTeste,
      conselhoUf: "SPX",
    });
    expect(erros.some((e) => e.includes("UF"))).toBe(true);
  });

  it("acusa conselho e número vazios", () => {
    const erros = validarConselhoProfissional({
      ...profissionalTeste,
      conselho: "",
      conselhoNumero: " ",
    });
    expect(erros).toHaveLength(2);
  });
});

describe("validarContatoMedico", () => {
  it("acusa contato ausente", () => {
    expect(validarContatoMedico("pediatra", undefined)).toHaveLength(1);
  });

  it("acusa contato sem e-mail, porque o envio é por e-mail", () => {
    expect(
      validarContatoMedico("obstetra", {
        nome: "Dr. Teste",
        telefoneE164: "+5511900000000",
      }),
    ).toHaveLength(1);
  });

  it("sem erro com e-mail preenchido", () => {
    expect(
      validarContatoMedico("obstetra", {
        nome: "Dr. Teste",
        email: "medico.teste@exemplo.invalid",
      }),
    ).toEqual([]);
  });
});

describe("validarFeridaOperatoria", () => {
  it("cesárea sem a seção é erro", () => {
    expect(validarFeridaOperatoria("cesarea", undefined)).toHaveLength(1);
  });

  it("cesárea com a seção preenchida não gera erro", () => {
    expect(
      validarFeridaOperatoria("cesarea", { semSinaisFlogisticos: true }),
    ).toEqual([]);
  });

  it("cesárea com sinais flogísticos e sem descrição é erro (a frase-padrão diria o contrário)", () => {
    expect(
      validarFeridaOperatoria("cesarea", { semSinaisFlogisticos: false }),
    ).toHaveLength(1);
    expect(
      validarFeridaOperatoria("cesarea", {
        semSinaisFlogisticos: false,
        textoLivre: "Hiperemia discreta em borda, sem secreção.",
      }),
    ).toEqual([]);
  });

  it("parto vaginal com a seção preenchida é erro", () => {
    expect(
      validarFeridaOperatoria("vaginal", { semSinaisFlogisticos: true }),
    ).toHaveLength(1);
  });

  it("parto vaginal sem a seção não gera erro", () => {
    expect(validarFeridaOperatoria("vaginal", undefined)).toEqual([]);
  });
});

describe("validarDor", () => {
  const base = dadosPuerperalTeste().dor;

  it("sem erro no caso sintético", () => {
    expect(validarDor(base)).toEqual([]);
  });

  it("remissão total com dor final acima de zero é erro", () => {
    expect(validarDor({ ...base, escalaFinal: 2 })).not.toEqual([]);
  });

  it("escala fora de 0 a 10 é erro", () => {
    expect(
      validarDor({ ...base, escalaInicial: 12, escalaMaxima: 12 }),
    ).not.toEqual([]);
  });
});

describe("validarGanhoPesoCoerente", () => {
  it("acusa ganho progressivo quando o bebê segue perdendo", () => {
    const erros = validarGanhoPesoCoerente(
      3200,
      "2026-09-01",
      [
        { data: "2026-09-03", pesoG: 3100, origem: "alta_hospitalar" },
        { data: "2026-09-08", pesoG: 3000, origem: "domicilio" },
      ],
      "progressivo",
    );
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain("progressivo");
  });

  it("aceita perda quando a curva ainda cai", () => {
    expect(
      validarGanhoPesoCoerente(
        3200,
        "2026-09-01",
        [{ data: "2026-09-08", pesoG: 3000, origem: "domicilio" }],
        "perda",
      ),
    ).toEqual([]);
  });

  it("acusa perda quando o bebê já voltou a ganhar desde o menor peso", () => {
    expect(
      validarGanhoPesoCoerente(
        3400,
        "2026-09-04",
        [
          { data: "2026-09-06", pesoG: 3150, origem: "domicilio" },
          { data: "2026-09-11", pesoG: 3380, origem: "domicilio" },
        ],
        "perda",
      ),
    ).toHaveLength(1);
  });
});

describe("validarIctericiaCoerente", () => {
  it("acusa conclusão sem icterícia quando há registro de icterícia", () => {
    expect(validarIctericiaCoerente({ zonaKramer: 2 }, "ausente")).toHaveLength(
      1,
    );
  });

  it("acusa conclusão com icterícia quando não há nenhum registro", () => {
    expect(validarIctericiaCoerente(undefined, "regressao")).toHaveLength(1);
  });

  it("acusa regressão na conclusão com tendência de progressão registrada", () => {
    expect(
      validarIctericiaCoerente(
        { zonaKramer: 3, tendencia: "progressao" },
        "regressao",
      ),
    ).toHaveLength(1);
  });

  it("sem erro quando os dois concordam", () => {
    expect(
      validarIctericiaCoerente(
        { zonaKramer: 1, zonaMaxima: 2, tendencia: "regressao" },
        "regressao",
      ),
    ).toEqual([]);
    expect(validarIctericiaCoerente({ zonaKramer: 2 }, "presente")).toEqual([]);
    expect(validarIctericiaCoerente(undefined, "ausente")).toEqual([]);
  });
});

describe("validarEvolucaoPuerperal (acompanhamento sintético)", () => {
  it("o caso sintético completo passa", () => {
    expect(validarEvolucaoPuerperal(dadosPuerperalTeste())).toEqual([]);
  });

  it("conclusão de aleitamento exclusivo com complemento registrado bloqueia", () => {
    const dados = dadosPuerperalTeste();
    dados.alimentacaoObservada = "complemento";
    const erros = validarEvolucaoPuerperal(dados);
    expect(erros.some((e) => e.includes("aleitamento"))).toBe(true);
  });

  it("laser em dia que não existe no período bloqueia", () => {
    const dados = dadosPuerperalTeste();
    dados.intervencoes.laser!.dias = [1, 9];
    expect(validarEvolucaoPuerperal(dados).some((e) => e.includes("D9"))).toBe(
      true,
    );
  });

  it("data em formato inválido vira erro, não exceção", () => {
    const dados = dadosPuerperalTeste();
    dados.dataEmissao = "12/09/2026";
    const erros = validarEvolucaoPuerperal(dados);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain("Data do documento");
  });
});

describe("validarEvolucaoNeonatal (acompanhamento sintético)", () => {
  it("o caso sintético completo passa, com pesagem da alta antes do início do período", () => {
    expect(validarEvolucaoNeonatal(dadosNeonatalTeste())).toEqual([]);
  });

  it("pesagem domiciliar fora do período bloqueia", () => {
    const dados = dadosNeonatalTeste();
    dados.pesagens.push({
      data: "2026-09-30",
      pesoG: 3500,
      origem: "domicilio",
    });
    const erros = validarEvolucaoNeonatal(dados);
    expect(erros.some((e) => e.includes("Pesagem 4"))).toBe(true);
  });

  it("pesagem antes do nascimento bloqueia, mesmo sendo da alta", () => {
    const dados = dadosNeonatalTeste();
    dados.pesagens[0] = { ...dados.pesagens[0]!, data: "2026-09-01" };
    expect(validarEvolucaoNeonatal(dados).length).toBeGreaterThan(0);
  });

  it("aleitamento exclusivo com complemento em ml bloqueia", () => {
    const dados = dadosNeonatalTeste();
    dados.alimentacao = { ...dados.alimentacao, complementoMl: 30 };
    const erros = validarEvolucaoNeonatal(dados);
    expect(erros.some((e) => e.includes("complemento"))).toBe(true);
  });

  it("peso zero vira erro, não exceção", () => {
    const dados = dadosNeonatalTeste();
    dados.pesagens[1] = { ...dados.pesagens[1]!, pesoG: 0 };
    expect(validarEvolucaoNeonatal(dados)).toHaveLength(1);
  });
});
