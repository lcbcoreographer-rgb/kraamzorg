import { describe, expect, it } from "vitest";
import type { PerguntaPesquisa } from "@/lib/dados/tipos-ocorrencia";
import { montarRespostas, respostasLimpas, validarPesquisa } from "./validacao";

const PERGUNTAS: PerguntaPesquisa[] = [
  { id: "nps", tipo: "escala_0_10", obrigatoria: true, texto: "Nota" },
  {
    id: "recomendaria",
    tipo: "opcao",
    obrigatoria: false,
    texto: "Recomendaria",
    opcoes: [
      { valor: "sim", rotulo: "Sim" },
      { valor: "talvez", rotulo: "Talvez" },
    ],
  },
  { id: "destaque", tipo: "texto", obrigatoria: false, texto: "Destaque" },
  {
    id: "depoimento_autorizado",
    tipo: "sim_nao",
    obrigatoria: true,
    texto: "Depoimento",
  },
];

describe("validarPesquisa", () => {
  it("obrigatória vazia, escala fora de 0 a 10, opção fora da lista e sim ou não inventado", () => {
    expect(validarPesquisa(PERGUNTAS, {})).toEqual({
      nps: "obrigatorio",
      depoimento_autorizado: "obrigatorio",
    });
    expect(
      validarPesquisa(PERGUNTAS, {
        nps: "11",
        recomendaria: "nunca",
        depoimento_autorizado: "talvez",
      }),
    ).toEqual({
      nps: "invalido",
      recomendaria: "invalido",
      depoimento_autorizado: "invalido",
    });
  });

  it("aceita 0 e 10, texto livre e deixa opcional em branco", () => {
    expect(
      validarPesquisa(PERGUNTAS, {
        nps: "0",
        depoimento_autorizado: "nao",
        destaque: "  A presença todos os dias.  ",
      }),
    ).toEqual({});
    expect(
      validarPesquisa(PERGUNTAS, { nps: "10", depoimento_autorizado: "sim" }),
    ).toEqual({});
  });

  it("texto passando do limite é recusado", () => {
    expect(
      validarPesquisa(PERGUNTAS, {
        nps: "9",
        depoimento_autorizado: "sim",
        destaque: "a".repeat(2001),
      }),
    ).toEqual({ destaque: "invalido" });
  });
});

describe("montarRespostas", () => {
  it("converte para número, verdadeiro ou falso e texto, e omite o que está em branco", () => {
    expect(
      montarRespostas(PERGUNTAS, {
        nps: "8",
        recomendaria: "",
        destaque: "  Ótimo  ",
        depoimento_autorizado: "nao",
      }),
    ).toEqual({ nps: 8, destaque: "Ótimo", depoimento_autorizado: false });
  });
});

describe("respostasLimpas (o que a ação do servidor aceita do navegador)", () => {
  it("aceita texto, número e booleano com chave conhecida", () => {
    expect(respostasLimpas({ nps: 9, destaque: "ok", dep: true })).toEqual({
      nps: 9,
      destaque: "ok",
      dep: true,
    });
  });

  it("descarta chave de forma estranha e recusa tipo estranho ou texto enorme", () => {
    expect(respostasLimpas({ "Nps Errado": 1, nps: 9 })).toEqual({ nps: 9 });
    expect(respostasLimpas({ nps: { x: 1 } })).toBeNull();
    expect(respostasLimpas({ nps: "a".repeat(2001) })).toBeNull();
    expect(respostasLimpas(null)).toBeNull();
    expect(respostasLimpas([1, 2])).toBeNull();
    expect(
      respostasLimpas(
        Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`p${i}`, 1])),
      ),
    ).toBeNull();
  });
});
