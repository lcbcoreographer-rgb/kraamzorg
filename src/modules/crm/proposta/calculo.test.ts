import { describe, expect, it } from "vitest";
import type { CondicaoProposta, PacoteProposta } from "@/lib/dados/tipos-venda";
import {
  contaDaEscolha,
  contaDaProposta,
  descontoPorPercentual,
  parcelasMaximas,
  precisaAprovacao,
} from "./calculo";

const imersao: PacoteProposta = {
  pacoteVersaoId: "pv-imersao",
  pacoteId: "p-imersao",
  nome: "Imersão",
  linha: "Presença estendida",
  dias: 6,
  gemelar: false,
  horasPorVisita: 6,
  valorCentavos: 780_000,
  parcelasMaxSemJuros: 3,
};
const essencial: PacoteProposta = {
  ...imersao,
  pacoteVersaoId: "pv-essencial",
  pacoteId: "p-essencial",
  nome: "Essencial",
  horasPorVisita: 3,
  valorCentavos: 420_000,
};
const pix: CondicaoProposta = {
  id: "c-pix",
  nome: "Pix à vista",
  tipo: "desconto_pct",
  valor: 5,
  requerAprovacao: true,
};
const tresVezes: CondicaoProposta = {
  id: "c-3x",
  nome: "3x sem juros no cartão",
  tipo: "parcelamento",
  valor: 3,
  requerAprovacao: false,
};
const seisVezes: CondicaoProposta = {
  ...tresVezes,
  id: "c-6x",
  nome: "Exceção 6x",
  valor: 6,
  requerAprovacao: true,
};

describe("conta da proposta (espelho de privado.venda_conta)", () => {
  it("Imersão com taxa de R$ 350 em 3x: o resto vai na primeira (mesmo número do 018_venda.sql)", () => {
    expect(contaDaProposta(780_000, 35_000, 0, 3)).toEqual({
      valorCentavos: 780_000,
      taxaCentavos: 35_000,
      descontoCentavos: 0,
      totalCentavos: 815_000,
      parcelas: 3,
      parcelaCentavos: 271_666,
      primeiraParcelaCentavos: 271_668,
    });
  });

  it("Pix 5% incide só sobre o pacote, não sobre a taxa (39.000 e 21.000 no 018_venda.sql)", () => {
    expect(descontoPorPercentual(780_000, 5)).toBe(39_000);
    const conta = contaDaEscolha({
      pacote: essencial,
      condicao: pix,
      parcelas: 1,
      descontoPct: 0,
      taxaCentavos: 35_000,
    });
    expect(conta?.descontoCentavos).toBe(21_000);
    expect(conta?.totalCentavos).toBe(434_000);
  });

  it("Gemelar Continuado R$ 10.300 em 3x fica 3.433,34 + 3.433,33 + 3.433,33", () => {
    const conta = contaDaProposta(1_030_000, 0, 0, 3);
    expect(conta.parcelaCentavos).toBe(343_333);
    expect(conta.primeiraParcelaCentavos).toBe(343_334);
  });

  it("arredonda o desconto como o Postgres (meio para longe do zero)", () => {
    expect(descontoPorPercentual(1_001, 50)).toBe(501);
    expect(descontoPorPercentual(333, 10)).toBe(33);
  });

  it("sem pacote não há conta", () => {
    expect(
      contaDaEscolha({
        pacote: null,
        condicao: null,
        parcelas: 1,
        descontoPct: 0,
        taxaCentavos: 0,
      }),
    ).toBeNull();
  });
});

describe("limites e aprovação (C-04, C-05)", () => {
  const base = {
    pacote: imersao,
    parcelas: 3,
    descontoPct: 0,
    taxaCentavos: 0,
  };

  it("parcelas até o limite do pacote, ou até a condição de parcelamento", () => {
    expect(parcelasMaximas({ ...base, condicao: null })).toBe(3);
    expect(parcelasMaximas({ ...base, condicao: tresVezes })).toBe(3);
    expect(parcelasMaximas({ ...base, condicao: seisVezes })).toBe(6);
  });

  it("Pix e exceção de parcelamento pedem aprovação; 3x padrão não", () => {
    expect(precisaAprovacao({ ...base, condicao: pix })).toBe(true);
    expect(precisaAprovacao({ ...base, condicao: seisVezes })).toBe(true);
    expect(precisaAprovacao({ ...base, condicao: tresVezes })).toBe(false);
    expect(precisaAprovacao({ ...base, condicao: null })).toBe(false);
  });

  it("desconto manual fora da tabela pede aprovação", () => {
    expect(precisaAprovacao({ ...base, condicao: null, descontoPct: 10 })).toBe(
      true,
    );
  });
});
