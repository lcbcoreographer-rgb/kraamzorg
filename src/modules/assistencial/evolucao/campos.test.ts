// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  aplicarFormulario,
  camposVisiveis,
  definir,
  faltasDaEntrada,
  manuais,
  obter,
  tem,
} from "./campos";
import { comSugestoes, montar } from "./montar";
import { TEXTOS_PADRAO_EVOLUCAO } from "@/lib/dados/demonstracao/textos-padrao-evolucao";

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [chave, valor] of Object.entries(campos)) f.set(chave, valor);
  return f;
}

describe("caminho com pontos", () => {
  it("lê, grava sem mudar o original e apaga o objeto que ficar vazio", () => {
    const base = { a: { b: 1 } };
    const novo = definir(base, "a.c.d", 2);
    expect(obter(novo, "a.c.d")).toBe(2);
    expect(base).toEqual({ a: { b: 1 } });
    expect(definir(novo, "a.c.d", undefined)).toEqual({ a: { b: 1 } });
    expect(tem({ x: null }, "x")).toBe(false);
    expect(tem({ x: "" }, "x")).toBe(false);
    expect(tem({ x: 0 }, "x")).toBe(true);
    expect(tem({ x: false }, "x")).toBe(true);
  });
});

describe("aplicarFormulario", () => {
  it("campo que não veio não muda; campo vazio apaga", () => {
    const dados = { mamas: { turgencia: "túrgidas", producao: "adequada" } };
    const { dados: novo } = aplicarFormulario(
      "puerperal",
      dados,
      formulario({ "mamas.turgencia": "" }),
    );
    expect(obter(novo, "mamas.turgencia")).toBeUndefined();
    expect(obter(novo, "mamas.producao")).toBe("adequada");
  });

  it("número com vírgula, faixa, sim ou não e lista por linha", () => {
    const { dados, erros } = aplicarFormulario(
      "puerperal",
      {},
      formulario({
        "paciente.idade": "29",
        "sinaisVitais.temperatura.min": "36,4",
        "sinaisVitais.temperatura.max": "36,9",
        estabilidadeHemodinamica: "nao",
        "encaminhamentos.medicacoes": "sim",
        "orientacoesAlta.itensPersonalizados": "Repouso\n\n  Hidratação  \n",
      }),
    );
    expect(erros).toEqual([]);
    expect(obter(dados, "paciente.idade")).toBe(29);
    expect(obter(dados, "sinaisVitais.temperatura")).toEqual({
      min: 36.4,
      max: 36.9,
    });
    expect(obter(dados, "estabilidadeHemodinamica")).toBe(false);
    expect(obter(dados, "encaminhamentos.medicacoes")).toBe(true);
    expect(obter(dados, "orientacoesAlta.itensPersonalizados")).toEqual([
      "Repouso",
      "Hidratação",
    ]);
    // o que a enfermeira digitou por falta do dado fica marcado como manual
    expect(manuais(dados)).toEqual(
      expect.arrayContaining(["paciente.idade", "sinaisVitais.temperatura"]),
    );
  });

  it("número que não é número e faixa pela metade voltam como erro, sem gravar", () => {
    const { dados, erros } = aplicarFormulario(
      "puerperal",
      {},
      formulario({
        "paciente.idade": "vinte",
        "sinaisVitais.fc.min": "70",
      }),
    );
    expect(erros).toEqual([
      "Idade da paciente: escreva um número.",
      "Frequência cardíaca no período: preencha o menor e o maior valor.",
    ]);
    expect(obter(dados, "paciente.idade")).toBeUndefined();
    expect(obter(dados, "sinaisVitais.fc")).toBeUndefined();
  });
});

describe("campos visíveis e o que falta", () => {
  it("campo que depende de outro só aparece quando ele existe", () => {
    const sem = camposVisiveis("puerperal", {}).map((c) => c.caminho);
    expect(sem).not.toContain("mamas.lesao.grau");
    const com = camposVisiveis("puerperal", {
      mamas: { lesao: { lado: "esquerda" } },
    }).map((c) => c.caminho);
    expect(com).toContain("mamas.lesao.grau");
  });

  it("dado que veio do cadastro não se digita de novo, mas o digitado segue editável", () => {
    const doCadastro = camposVisiveis("puerperal", {
      paciente: { idade: 30 },
    }).map((c) => c.caminho);
    expect(doCadastro).not.toContain("paciente.idade");
    const digitado = camposVisiveis("puerperal", {
      paciente: { idade: 30 },
      _manual: ["paciente.idade"],
    }).map((c) => c.caminho);
    expect(digitado).toContain("paciente.idade");
  });

  it("sem nada preenchido, lista o que falta em frase, sem pontuação solta", () => {
    const faltas = faltasDaEntrada("puerperal", {});
    expect(faltas.length).toBeGreaterThan(5);
    expect(faltas.join(" ")).not.toMatch(/\?\./);
    expect(faltas).toContain("Falta a paciente no cadastro da família.");
  });
});

describe("montar", () => {
  it("com faltas devolve os erros e nenhum conteúdo", () => {
    const r = montar("neonatal", {}, TEXTOS_PADRAO_EVOLUCAO);
    expect(r.conteudo).toBeNull();
    expect(r.erros.length).toBeGreaterThan(0);
  });

  it("sugere a conclusão do neonatal pelo que o período mostrou, sem sobrescrever a escolha", () => {
    const dados = {
      alimentacao: { tipo: "exclusivo" },
      bebe: { dataNascimento: "2026-09-19", pesoNascimentoG: 3300 },
      pesagens: [
        { data: "2026-09-21", pesoG: 3150, origem: "alta_hospitalar" },
        { data: "2026-09-25", pesoG: 3250, origem: "domicilio" },
        { data: "2026-09-29", pesoG: 3400, origem: "domicilio" },
      ],
      estadoGeral: {},
    };
    const sugerido = comSugestoes("neonatal", dados);
    expect(obter(sugerido, "conclusao.aleitamento")).toBe("exclusivo");
    expect(obter(sugerido, "conclusao.ganhoPeso")).toBe("progressivo");
    expect(obter(sugerido, "conclusao.ictericia")).toBe("ausente");
    const escolhido = comSugestoes("neonatal", {
      ...dados,
      conclusao: { aleitamento: "misto" },
    });
    expect(obter(escolhido, "conclusao.aleitamento")).toBe("misto");
  });
});
