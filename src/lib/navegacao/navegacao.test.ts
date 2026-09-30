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
      // 30/09: as transferências moram dentro das conversas (filtro
      // "Esperando alguém"), com o contador no item Conversas.
      "Conversas",
      // P29: a agenda das conversas de orientação, logo depois dos pedidos.
      "Sessões de venda",
      "Famílias",
      "Tarefas",
      // P48 a P50: copiloto, parceiros médicos e acesso da família ao portal.
      "Copiloto",
      "Parceiros médicos",
      "Portal da família",
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
      "Manuais",
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

  it("P41 a P43: evoluções, ocorrências e pós-venda são da coordenação e da diretoria; notas, do financeiro e da diretoria", () => {
    for (const papel of ["coordenacao", "diretoria"] as const) {
      expect(podeAbrir([papel], "/evolucoes/abc/puerperal")).toBe(true);
      expect(podeAbrir([papel], "/ocorrencias/nova")).toBe(true);
      expect(podeAbrir([papel], "/pos-venda")).toBe(true);
    }
    for (const papel of ["comercial", "financeiro", "marketing"] as const) {
      expect(podeAbrir([papel], "/evolucoes")).toBe(false);
      expect(podeAbrir([papel], "/ocorrencias")).toBe(false);
      expect(podeAbrir([papel], "/pos-venda")).toBe(false);
    }
    expect(podeAbrir(["financeiro"], "/notas/abc")).toBe(true);
    expect(podeAbrir(["diretoria"], "/notas")).toBe(true);
    expect(podeAbrir(["coordenacao"], "/notas")).toBe(false);
    expect(podeAbrir(["comercial"], "/notas")).toBe(false);
  });

  it("a enfermeira abre as próprias evoluções, sem aba nem barra lateral", () => {
    expect(podeAbrir(["enfermeira"], "/minhas-evolucoes/abc/puerperal")).toBe(
      true,
    );
    expect(podeAbrir(["enfermeira"], "/evolucoes")).toBe(false);
    expect(podeAbrir(["enfermeira"], "/ocorrencias")).toBe(false);
    expect(abasDe(["enfermeira"]).map((a) => a.id)).not.toContain(
      "minhasEvolucoes",
    );
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
    expect(ids).toEqual([
      "sessoesVenda",
      "tarefas",
      "copiloto",
      "parceiros",
      "portalFamilia",
      "agente",
      "manuais",
    ]);
  });

  it("Transferências saiu da navegação, mas a rota continua aberta para quem já abria (leva às conversas)", () => {
    for (const papel of ["comercial", "coordenacao", "diretoria"] as const) {
      const ids = gruposDe([papel]).flatMap((g) => g.itens.map((i) => i.id));
      expect(ids).toContain("conversas");
      expect(ids).not.toContain("transferencias");
      expect(abasDe([papel]).map((a) => a.id)).not.toContain("transferencias");
      expect(podeAbrir([papel], "/transferencias")).toBe(true);
    }
    for (const papel of ["financeiro", "marketing", "enfermeira"] as const) {
      expect(podeAbrir([papel], "/transferencias")).toBe(false);
    }
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

describe("pré-natal e ofertas (P35 e P36)", () => {
  it("Pré-natal é da coordenação e da diretoria, no grupo Operação; comercial, financeiro e enfermeira não abrem", () => {
    for (const papel of ["coordenacao", "diretoria"] as const) {
      const operacao = gruposDe([papel]).find((g) => g.titulo === "Operação");
      expect(rotulos(operacao!.itens)).toContain("Pré-natal");
      expect(podeAbrir([papel], "/prenatal")).toBe(true);
      expect(podeAbrir([papel], "/prenatal/abc")).toBe(true);
    }
    for (const papel of [
      "comercial",
      "financeiro",
      "marketing",
      "enfermeira",
    ] as const) {
      expect(podeAbrir([papel], "/prenatal")).toBe(false);
    }
  });

  it("Ofertas só a enfermeira abre, sem aparecer nas abas nem em grupos", () => {
    expect(podeAbrir(["enfermeira"], "/ofertas")).toBe(true);
    expect(abasDe(["enfermeira"]).map((a) => a.id)).not.toContain("ofertas");
    expect(gruposDe(["enfermeira"])).toEqual([]);
    for (const papel of [
      "comercial",
      "coordenacao",
      "financeiro",
      "diretoria",
    ] as const) {
      expect(podeAbrir([papel], "/ofertas")).toBe(false);
    }
  });

  it("a capacidade é da coordenação e da diretoria, no grupo Operação (P45)", () => {
    for (const papel of ["coordenacao", "diretoria"] as const) {
      const operacao = gruposDe([papel]).find((g) => g.titulo === "Operação");
      expect(rotulos(operacao!.itens)).toContain("Capacidade");
      expect(podeAbrir([papel], "/capacidade")).toBe(true);
    }
    for (const papel of ["comercial", "financeiro", "enfermeira"] as const) {
      expect(podeAbrir([papel], "/capacidade")).toBe(false);
    }
  });

  it("o painel executivo é só da diretoria (P52)", () => {
    expect(podeAbrir(["diretoria"], "/painel")).toBe(true);
    const gestao = gruposDe(["diretoria"]).find((g) => g.titulo === "Gestão");
    expect(rotulos(gestao!.itens)).toContain("Painel executivo");
    for (const papel of [
      "comercial",
      "coordenacao",
      "financeiro",
      "enfermeira",
    ] as const) {
      expect(podeAbrir([papel], "/painel")).toBe(false);
    }
  });

  it("o financeiro abre as telas de dinheiro e a diretoria também (P46)", () => {
    for (const caminho of [
      "/financeiro",
      "/financeiro/despesas",
      "/financeiro/equipe",
      "/financeiro/extrato",
    ]) {
      expect(podeAbrir(["financeiro"], caminho)).toBe(true);
      expect(podeAbrir(["diretoria"], caminho)).toBe(true);
      expect(podeAbrir(["coordenacao"], caminho)).toBe(false);
      expect(podeAbrir(["comercial"], caminho)).toBe(false);
    }
  });

  it("o radar e a alocação de uma família são da coordenação e da diretoria", () => {
    expect(podeAbrir(["coordenacao"], "/radar/abc")).toBe(true);
    expect(podeAbrir(["diretoria"], "/radar")).toBe(true);
    expect(podeAbrir(["enfermeira"], "/radar/abc")).toBe(false);
    expect(podeAbrir(["comercial"], "/radar")).toBe(false);
  });
});
