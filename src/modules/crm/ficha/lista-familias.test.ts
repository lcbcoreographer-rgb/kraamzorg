import { describe, expect, it } from "vitest";
import {
  agruparPorFase,
  combinaComBusca,
  contarPorFiltro,
  faseDaFamilia,
  ordenarFamilias,
  pareceTelefone,
  passaNoFiltro,
} from "./lista-familias";
import type { FamiliaListaTela } from "./tipos";

function familia(parcial: Partial<FamiliaListaTela>): FamiliaListaTela {
  const base: FamiliaListaTela = {
    id: parcial.nome ?? "id",
    nome: "Família Teste",
    bairro: null,
    cidade: null,
    uf: null,
    dpp: null,
    dataNascimento: null,
    dataAlta: null,
    dataInicioEfetivo: null,
    estadoSensivel: "normal",
    naoContatar: false,
    idadeGestacional: null,
    fase: "sem_data",
    tempo: null,
    estagio: null,
    proximoPasso: null,
  };
  const junta = { ...base, ...parcial };
  return { ...junta, fase: parcial.fase ?? faseDaFamilia(junta) };
}

describe("faseDaFamilia", () => {
  it("segue as quatro datas, nunca a DPP para o atendimento", () => {
    expect(faseDaFamilia(familia({ dpp: "2027-01-10" }))).toBe("gestando");
    expect(
      faseDaFamilia(
        familia({ dpp: "2026-09-01", dataNascimento: "2026-09-02" }),
      ),
    ).toBe("nasceu");
    expect(
      faseDaFamilia(
        familia({
          dpp: "2026-09-01",
          dataNascimento: "2026-09-02",
          dataInicioEfetivo: "2026-09-05",
        }),
      ),
    ).toBe("atendimento");
    expect(faseDaFamilia(familia({}))).toBe("sem_data");
  });

  it("freio em bloqueio ou encerrado sensível sai da palavra gestando; em atenção fica na fase", () => {
    expect(
      faseDaFamilia(
        familia({ dpp: "2027-01-10", estadoSensivel: "bloqueio_total" }),
      ),
    ).toBe("freio");
    expect(
      faseDaFamilia(
        familia({ dpp: "2027-01-10", estadoSensivel: "encerrado_sensivel" }),
      ),
    ).toBe("freio");
    expect(
      faseDaFamilia(familia({ dpp: "2027-01-10", estadoSensivel: "atencao" })),
    ).toBe("gestando");
  });
});

describe("filtros em pílula", () => {
  const lista = [
    familia({ nome: "Família Teste Aurora", dpp: "2027-05-03" }),
    familia({
      nome: "Família Teste Estrela",
      dpp: "2027-04-13",
      estadoSensivel: "atencao",
    }),
    familia({ nome: "Família Teste Bruma", estadoSensivel: "bloqueio_total" }),
    familia({
      nome: "Família Teste Lua",
      dpp: "2026-09-15",
      dataNascimento: "2026-09-17",
      dataInicioEfetivo: "2026-09-19",
    }),
  ];

  it("conta cada pílula; com freio junta atenção e bloqueio", () => {
    expect(contarPorFiltro(lista)).toEqual({
      todas: 4,
      gestando: 2,
      nasceu: 0,
      atendimento: 1,
      sem_data: 0,
      com_freio: 2,
    });
    expect(
      lista.filter((f) => passaNoFiltro(f, "com_freio")).map((f) => f.nome),
    ).toEqual(["Família Teste Estrela", "Família Teste Bruma"]);
  });

  it("agrupa pela linha do tempo, com o freio por último", () => {
    expect(agruparPorFase(lista).map((g) => g.fase)).toEqual([
      "gestando",
      "atendimento",
      "freio",
    ]);
  });
});

describe("busca na hora", () => {
  const dalia = familia({
    nome: "Família Teste Dália",
    bairro: "Vila Madalena",
    cidade: "São Paulo",
  });

  it("acha pelo nome, bairro ou cidade, sem acento e sem caixa", () => {
    expect(combinaComBusca(dalia, "dalia")).toBe(true);
    expect(combinaComBusca(dalia, "MADALENA")).toBe(true);
    expect(combinaComBusca(dalia, "sao paulo")).toBe(true);
    expect(combinaComBusca(dalia, "Londrina")).toBe(false);
    expect(combinaComBusca(dalia, "   ")).toBe(true);
  });

  it("telefone vai ao servidor: quatro dígitos e nenhuma letra", () => {
    expect(pareceTelefone("11 9000")).toBe(true);
    expect(pareceTelefone("(11) 90000-0305")).toBe(true);
    expect(pareceTelefone("123")).toBe(false);
    expect(pareceTelefone("Alphaville 10")).toBe(false);
  });
});

describe("ordenarFamilias", () => {
  const lista = [
    familia({
      nome: "Família Teste Cedro",
      dpp: "2027-02-12",
      cidade: "São Paulo",
      bairro: "Moema",
    }),
    familia({
      nome: "Família Teste Acácia",
      dpp: "2026-10-21",
      cidade: "São Paulo",
      bairro: "Pinheiros",
    }),
    familia({
      nome: "Família Teste Bambu",
      dpp: null,
      cidade: "Londrina",
      bairro: "Centro",
    }),
  ];

  it("por nome", () => {
    expect(ordenarFamilias(lista, "nome").map((f) => f.nome)).toEqual([
      "Família Teste Acácia",
      "Família Teste Bambu",
      "Família Teste Cedro",
    ]);
  });

  it("por semanas: a mais perto da DPP primeiro, sem DPP no fim", () => {
    expect(ordenarFamilias(lista, "semanas").map((f) => f.nome)).toEqual([
      "Família Teste Acácia",
      "Família Teste Cedro",
      "Família Teste Bambu",
    ]);
  });

  it("por cidade e bairro, sem mexer na lista original", () => {
    const copia = [...lista];
    expect(ordenarFamilias(lista, "cidade").map((f) => f.nome)).toEqual([
      "Família Teste Bambu",
      "Família Teste Cedro",
      "Família Teste Acácia",
    ]);
    expect(lista).toEqual(copia);
  });
});
