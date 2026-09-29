import { describe, expect, it } from "vitest";
import {
  linhas,
  normalizarParaBusca,
  resumoParaSalvar,
  textoDaTranscricao,
  trechoConfere,
  verificarSaidaIa,
} from "./resumo";

const TRANSCRICAO = `Coordenação: Oi, Juliana e Diego, tudo bem?
Juliana: Tudo. A gente ficou com medo da amamentação, sabe?
Diego: E achou o valor alto, para ser sincero.
Juliana: Queria saber se a enfermeira dorme em casa.
Coordenação: Combinamos então de mandar a proposta do Essencial até sexta.`;

describe("verificarSaidaIa: sem inventar", () => {
  it("fica só com item cujo trecho está na transcrição, sem ligar para acento, caixa e pontuação", () => {
    const { resumo, descartados } = verificarSaidaIa(
      {
        duvidas: [
          {
            texto: "Se a enfermeira dorme em casa.",
            trecho: "queria saber se a enfermeira dorme em casa",
          },
          {
            texto: "Quanto custa o plano de 12 dias.",
            trecho: "quanto custa o continuado",
          },
        ],
        objecoes: [
          { texto: "Acharam o valor alto.", trecho: "E achou o valor alto" },
          { texto: "Medo sem prova.", trecho: "" },
        ],
        plano_interesse: {
          texto: "Essencial",
          trecho: "mandar a proposta do Essencial",
        },
        proximos_passos: [
          {
            texto: "Mandar a proposta até sexta.",
            trecho: "Combinamos então de mandar a proposta",
          },
          { texto: "Curto demais", trecho: "até" },
        ],
      },
      TRANSCRICAO,
    );
    expect(resumo.duvidas.map((i) => i.texto)).toEqual([
      "Se a enfermeira dorme em casa.",
    ]);
    expect(resumo.objecoes.map((i) => i.texto)).toEqual([
      "Acharam o valor alto.",
    ]);
    expect(resumo.planoInteresse?.texto).toBe("Essencial");
    expect(resumo.proximosPassos.map((i) => i.texto)).toEqual([
      "Mandar a proposta até sexta.",
    ]);
    expect(descartados).toBe(3);
  });

  it("saída fora do formato vira resumo vazio, nunca erro", () => {
    expect(verificarSaidaIa("texto solto", TRANSCRICAO)).toEqual({
      resumo: {
        duvidas: [],
        objecoes: [],
        planoInteresse: null,
        proximosPassos: [],
      },
      descartados: 0,
    });
    expect(
      verificarSaidaIa(
        { duvidas: "não é lista", plano_interesse: null },
        TRANSCRICAO,
      ).resumo.duvidas,
    ).toEqual([]);
  });

  it("normaliza para a busca", () => {
    expect(normalizarParaBusca("  Amamentação, SABE?  ")).toBe(
      "amamentacao sabe",
    );
    expect(
      trechoConfere("Medo da AMAMENTAÇÃO", normalizarParaBusca(TRANSCRICAO)),
    ).toBe(true);
  });
});

describe("resumo editado pela pessoa", () => {
  it("uma linha por item, sem marcador de lista nem linha vazia", () => {
    expect(linhas("- primeira\n\n• segunda\r\n  terceira  ")).toEqual([
      "primeira",
      "segunda",
      "terceira",
    ]);
  });

  it("modelo só fica registrado quando a origem é a IA", () => {
    const campos = {
      duvidas: "a\nb",
      objecoes: "",
      planoInteresse: "  ",
      proximosPassos: "c",
    };
    expect(resumoParaSalvar(campos, "pessoa", "modelo-x")).toEqual({
      duvidas: ["a", "b"],
      objecoes: [],
      planoInteresse: null,
      proximosPassos: ["c"],
      origem: "pessoa",
      modelo: null,
    });
    expect(resumoParaSalvar(campos, "ia", "modelo-x").modelo).toBe("modelo-x");
  });
});

describe("textoDaTranscricao", () => {
  it("tira cabeçalho, número de bloco, tempo e marcação do WebVTT", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
<v Juliana>A gente ficou com medo da amamentação.

2
00:00:05.000 --> 00:00:07.000
Coordenação: Entendi.`;
    expect(textoDaTranscricao(vtt)).toBe(
      "A gente ficou com medo da amamentação.\nCoordenação: Entendi.",
    );
  });

  it("texto comum passa igual", () => {
    expect(textoDaTranscricao("  Linha um\nLinha dois ")).toBe(
      "Linha um\nLinha dois",
    );
  });
});
