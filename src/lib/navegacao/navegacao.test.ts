import { describe, expect, it } from "vitest";
import { PAPEIS, type Papel } from "@/lib/auth/papeis";
import {
  abasDe,
  ativo,
  caminhoInicial,
  cascaDoUsuario,
  gruposDe,
  gruposDoMais,
  NAVEGACAO,
  ORDEM_GRUPOS,
  podeAbrir,
  rotaDoCaminho,
  ROTAS,
} from ".";

const rotulos = (itens: { rotulo: string }[]) => itens.map((i) => i.rotulo);

describe("abas inferiores por papel (PRD 20.4)", () => {
  it.each<[Papel, string[]]>([
    ["enfermeira", ["Hoje", "Famílias", "Alertas", "Perfil"]],
    ["comercial", ["Início", "Pipeline", "Conversas", "Famílias", "Mais"]],
    ["coordenacao", ["Início", "Radar", "Agenda", "Famílias", "Mais"]],
    ["financeiro", ["Início", "Cobranças", "Notas", "Mais"]],
    ["diretoria", ["Início", "Pipeline", "Radar", "Financeiro", "Mais"]],
  ])("%s tem as abas do PRD, na ordem", (papel, esperado) => {
    expect(rotulos(abasDe([papel]))).toEqual(esperado);
  });

  it("todo papel tem de 2 a 5 abas", () => {
    for (const papel of PAPEIS) {
      const abas = NAVEGACAO[papel].abas;
      expect(abas.length).toBeGreaterThanOrEqual(2);
      expect(abas.length).toBeLessThanOrEqual(5);
    }
  });

  it("com vários papéis, as abas são as do papel de maior precedência", () => {
    expect(rotulos(abasDe(["comercial", "financeiro", "diretoria"]))).toEqual([
      "Início",
      "Pipeline",
      "Radar",
      "Financeiro",
      "Mais",
    ]);
    expect(rotulos(abasDe(["coordenacao", "diretoria"]))[2]).toBe("Radar");
  });
});

describe("barra lateral agrupada (PRD 20.4)", () => {
  it("os grupos saem sempre na ordem Comercial, Operação, Experiência, Gestão, Sistema", () => {
    for (const papel of PAPEIS) {
      const titulos = gruposDe([papel]).map((g) => g.titulo);
      const indices = titulos.map((t) => ORDEM_GRUPOS.indexOf(t));
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  it("comercial: Comercial e Sistema, como no protótipo comercial-inicio.html", () => {
    const grupos = gruposDe(["comercial"]);
    expect(grupos.map((g) => g.titulo)).toEqual(["Comercial", "Sistema"]);
    expect(rotulos(grupos[0]!.itens)).toEqual([
      "Início",
      "Pipeline",
      "Conversas",
      "Transferências",
      "Famílias",
      "Tarefas",
    ]);
  });

  it("coordenação: Operação, Experiência e Sistema, como no protótipo coordenacao-inicio.html", () => {
    const grupos = gruposDe(["coordenacao"]);
    expect(grupos.map((g) => g.titulo)).toEqual([
      "Operação",
      "Experiência",
      "Sistema",
    ]);
    expect(rotulos(grupos[0]!.itens).slice(0, 4)).toEqual([
      "Início",
      "Radar",
      "Agenda",
      "Equipe",
    ]);
  });

  it("diretoria vê sessões e configurações; ninguém mais vê sessões", () => {
    const sistema = gruposDe(["diretoria"]).find((g) => g.titulo === "Sistema");
    expect(rotulos(sistema!.itens)).toEqual([
      "Isadora",
      "Configurações",
      "Sessões e acessos",
    ]);
    for (const papel of PAPEIS.filter((p) => p !== "diretoria")) {
      expect(podeAbrir([papel], "/sessoes")).toBe(false);
    }
  });

  it("vários papéis juntam os itens sem repetir", () => {
    const grupos = gruposDe(["diretoria", "comercial", "financeiro"]);
    const ids = grupos.flatMap((g) => g.itens.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("cobrancas");
    expect(ids).toContain("sessoes");
  });

  it("a enfermeira não tem barra lateral e usa o portal", () => {
    expect(gruposDe(["enfermeira"])).toEqual([]);
    expect(cascaDoUsuario(["enfermeira"])).toBe("enfermeira");
    expect(cascaDoUsuario(["enfermeira", "coordenacao"])).toBe("app");
  });
});

describe("Mais, início e acesso", () => {
  it("Mais mostra o que não coube nas abas", () => {
    const ids = gruposDoMais(["comercial"]).flatMap((g) =>
      g.itens.map((i) => i.id),
    );
    expect(ids).toEqual(["transferencias", "tarefas", "agente"]);
  });

  it("tela de entrada por papel", () => {
    expect(caminhoInicial(["comercial"])).toBe("/inicio");
    expect(caminhoInicial(["enfermeira"])).toBe("/hoje");
    expect(caminhoInicial([])).toBe("/entrar");
  });

  it("rotaDoCaminho acha a rota pelo prefixo mais longo", () => {
    expect(rotaDoCaminho("/familias/123")).toBe("familias");
    expect(rotaDoCaminho("/minhas-familias")).toBe("minhasFamilias");
    expect(rotaDoCaminho("/mfa/desafio")).toBeNull();
    expect(rotaDoCaminho("/pipelines")).toBeNull();
  });

  it("item ativo segue o caminho atual, inclusive em subcaminho", () => {
    const familias = abasDe(["comercial"]).find((a) => a.id === "familias")!;
    expect(ativo(familias, "/familias/abc")).toBe(true);
    expect(ativo(familias, "/pipeline")).toBe(false);
  });

  it("toda rota da navegação tem caminho único e dono", () => {
    const caminhos = Object.values(ROTAS).map((r) => r.caminho);
    expect(new Set(caminhos).size).toBe(caminhos.length);
    for (const rota of Object.values(ROTAS)) expect(rota.dono).toMatch(/^P\d+/);
  });
});
