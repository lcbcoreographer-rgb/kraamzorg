// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  INDICADORES,
  calcularPainel,
  chavesDaSecao,
  indicadorPorId,
  progressoDasMetas,
  type BasePainel,
  type CobrancaPainel,
  type DespesaPainel,
} from "./painel";

/**
 * Painel executivo (P52): o registro dos 35 números, a conta em TypeScript
 * (a da demonstração) sobre o mesmo cenário do pgTAP 026, e a conferência de
 * que este registro, docs/painel/consultas.md, a linha `@indicadores:` do
 * pgTAP e as funções da migration falam dos mesmos números.
 */

const RAIZ = path.resolve(__dirname, "../../..");
const lerArquivo = (rel: string) => readFileSync(path.join(RAIZ, rel), "utf8");

describe("registro dos indicadores", () => {
  it("são 35, com id secao.chave único", () => {
    expect(INDICADORES).toHaveLength(35);
    const ids = INDICADORES.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of INDICADORES) expect(i.id).toBe(`${i.secao}.${i.chave}`);
    expect(indicadorPorId("comercial.leads")?.rotulo).toBe("Leads novos");
    expect(chavesDaSecao("financeiro")).toHaveLength(9);
  });

  it("cada número tem uma consulta documentada em docs/painel/consultas.md", () => {
    const doc = lerArquivo("docs/painel/consultas.md");
    const titulos = [...doc.matchAll(/^### `([a-z_]+\.[a-z0-9_]+)`$/gm)].map(
      (m) => m[1],
    );
    expect(titulos.sort()).toEqual(INDICADORES.map((i) => i.id).sort());
  });

  it("a linha @indicadores do pgTAP 026 lista exatamente os mesmos números", () => {
    const teste = lerArquivo("supabase/tests/026_gestao.sql");
    const linha = /^-- @indicadores: (.*)$/m.exec(teste)?.[1] ?? "";
    expect(linha.split(" ").sort()).toEqual(
      INDICADORES.map((i) => i.id).sort(),
    );
  });

  it("a função do banco de cada número existe na migration 0026", () => {
    const sql = lerArquivo("supabase/migrations/0026_gestao.sql");
    for (const nome of new Set(INDICADORES.map((i) => i.consulta))) {
      expect(sql, nome).toContain(`create function ${nome}(`);
    }
  });

  it("a tela de origem, quando existe, é uma rota do sistema", () => {
    for (const i of INDICADORES) {
      if (i.tela) expect(i.tela.href).toMatch(/^\/[a-z/-]+$/);
    }
  });

  it("nenhum texto do registro usa travessão nem meia-risca", () => {
    const tudo = JSON.stringify(INDICADORES);
    expect(tudo).not.toMatch(/[—–]/);
  });
});

// --- O cenário do pgTAP 026 --------------------------------------------------------------

function cobranca(
  id: string,
  valor: number,
  status: CobrancaPainel["status"],
  pagoEm: string | null,
  origem: CobrancaPainel["origem"],
  codigoOrigem: string | null,
): CobrancaPainel {
  return {
    id,
    contratoId: `k${id}`,
    familiaId: `f${id}`,
    familiaNome: `Família Teste ${id}`,
    parcela: 1,
    valorCentavos: valor,
    vencimento: "2026-05-09",
    status,
    pagoEm,
    valorPagoCentavos: pagoEm ? valor : null,
    origem,
    codigoOrigem,
  };
}

function despesa(
  id: string,
  data: string,
  categoria: DespesaPainel["categoria"],
  valor: number,
  canal: DespesaPainel["canal"] = null,
): DespesaPainel {
  return {
    id,
    data,
    categoria,
    descricao: id,
    valorCentavos: valor,
    removida: false,
    canal,
  };
}

const BASE: BasePainel = {
  hoje: "2026-09-30",
  leads: [
    {
      familiaId: "1",
      origem: "meta_ads",
      codigoOrigem: "wa-teste-01",
      criadoEm: "2026-05-03T12:00:00.000Z",
      mesclada: false,
    },
    {
      familiaId: "2",
      origem: "instagram_organico",
      codigoOrigem: null,
      criadoEm: "2026-05-08T12:00:00.000Z",
      mesclada: false,
    },
    {
      familiaId: "3",
      origem: "instagram_organico",
      codigoOrigem: null,
      criadoEm: "2026-05-12T12:00:00.000Z",
      mesclada: false,
    },
    {
      familiaId: "4",
      origem: "indicacao_amigo",
      codigoOrigem: null,
      criadoEm: "2026-05-15T12:00:00.000Z",
      mesclada: false,
    },
    {
      familiaId: "5",
      origem: "indicacao_medica",
      codigoOrigem: null,
      criadoEm: "2026-05-20T12:00:00.000Z",
      mesclada: false,
    },
    {
      familiaId: "6",
      origem: "meta_ads",
      codigoOrigem: null,
      criadoEm: "2026-04-28T12:00:00.000Z",
      mesclada: false,
    },
    {
      familiaId: "7",
      origem: "meta_ads",
      codigoOrigem: null,
      criadoEm: "2026-05-25T12:00:00.000Z",
      mesclada: true,
    },
  ],
  sessoes: [
    { status: "realizada", realizadaEm: "2026-05-09T14:00:00.000Z" },
    { status: "realizada", realizadaEm: "2026-05-20T14:00:00.000Z" },
    { status: "realizada", realizadaEm: "2026-06-03T14:00:00.000Z" },
    { status: "agendada", realizadaEm: null },
  ],
  contratos: [
    {
      familiaId: "1",
      status: "assinado",
      assinadoEm: "2026-05-04T12:00:00.000Z",
      totalCentavos: 435000,
    },
    {
      familiaId: "2",
      status: "assinado",
      assinadoEm: "2026-05-11T12:00:00.000Z",
      totalCentavos: 780000,
    },
    {
      familiaId: "3",
      status: "assinado",
      assinadoEm: "2026-05-18T12:00:00.000Z",
      totalCentavos: 520000,
    },
    {
      familiaId: "4",
      status: "assinado",
      assinadoEm: "2026-06-02T12:00:00.000Z",
      totalCentavos: 420000,
    },
    {
      familiaId: "5",
      status: "rascunho",
      assinadoEm: null,
      totalCentavos: 420000,
    },
  ],
  cobrancas: [
    cobranca(
      "cb1",
      435000,
      "paga",
      "2026-05-10T15:00:00.000Z",
      "meta_ads",
      "wa-teste-01",
    ),
    cobranca(
      "cb2",
      780000,
      "paga",
      "2026-06-01T02:00:00.000Z",
      "instagram_organico",
      null,
    ),
    cobranca(
      "cb3",
      300000,
      "estornada",
      "2026-05-12T12:00:00.000Z",
      "instagram_organico",
      null,
    ),
    cobranca(
      "cb4",
      100000,
      "paga",
      "2026-06-01T04:00:00.000Z",
      "meta_ads",
      "wa-teste-01",
    ),
  ],
  despesas: [
    despesa("mkt", "2026-05-05", "marketing_anuncios", 150000, "meta_ads"),
    despesa("mkt2", "2026-05-06", "marketing_anuncios", 20000),
    despesa("cont", "2026-05-15", "contabilidade", 50000),
    despesa("tec", "2026-05-16", "tecnologia", 30000),
    despesa("out", "2026-05-20", "outros", 1000),
    despesa("jun", "2026-06-05", "tecnologia", 20000),
  ],
  acompanhamentos: [
    { familiaId: "a1", estado: "em_execucao", inicioEfetivo: "2026-05-06" },
    { familiaId: "a2", estado: "em_execucao", inicioEfetivo: "2026-05-13" },
    { familiaId: "a3", estado: "em_execucao", inicioEfetivo: "2026-04-20" },
    { familiaId: "a4", estado: "ativo", inicioEfetivo: null },
    { familiaId: "a5", estado: "encerrado", inicioEfetivo: "2026-04-01" },
  ],
  visitas: [
    ...[11, 12, 13, 14, 15, 16].map((d) => ({
      data: `2026-05-${d}`,
      estado: "concluida",
    })),
    { data: "2026-05-17", estado: "agendada" },
    { data: "2026-06-02", estado: "concluida" },
  ],
  ocorrenciasAbertas: 2,
  pesquisas: [
    {
      respondidaEm: "2026-05-21T12:00:00.000Z",
      nps: 10,
      classificacao: "promotor",
      depoimentoAutorizado: true,
    },
    {
      respondidaEm: "2026-05-22T12:00:00.000Z",
      nps: 10,
      classificacao: "promotor",
      depoimentoAutorizado: true,
    },
    {
      respondidaEm: "2026-05-23T12:00:00.000Z",
      nps: 9,
      classificacao: "promotor",
      depoimentoAutorizado: false,
    },
    {
      respondidaEm: "2026-05-24T12:00:00.000Z",
      nps: 9,
      classificacao: "promotor",
      depoimentoAutorizado: null,
    },
    {
      respondidaEm: "2026-05-25T12:00:00.000Z",
      nps: 8,
      classificacao: "neutro",
      depoimentoAutorizado: false,
    },
    {
      respondidaEm: "2026-05-26T12:00:00.000Z",
      nps: 3,
      classificacao: "detrator",
      depoimentoAutorizado: false,
    },
    {
      respondidaEm: "2026-06-04T12:00:00.000Z",
      nps: 10,
      classificacao: "promotor",
      depoimentoAutorizado: true,
    },
  ],
  capacidade: [
    {
      regiao: "Região A",
      semana: "2026-09-28",
      ocupacaoPct: 10,
      probExcessoPct: 0,
      cobertura: "ok",
      nivel: "folga",
    },
    {
      regiao: "Região B",
      semana: "2026-10-05",
      ocupacaoPct: 40,
      probExcessoPct: 38.5,
      cobertura: "ok",
      nivel: "sobrevenda",
    },
    {
      regiao: "Região B",
      semana: "2026-10-12",
      ocupacaoPct: 90,
      probExcessoPct: 2,
      cobertura: "sem_reserva",
      nivel: "atencao",
    },
  ],
  metas: {
    contratosMes: 18,
    familiasMes: 18,
    faturamentoMesCentavos: 7560000,
    nps: 90,
  },
  congelamento: { data: "2026-11-13", tag: "v1.0.0-rc.1" },
};

const PARAMETROS = {
  npsAmostraMinima: 5,
  faixasInadimplenciaDias: [7, 30],
  previsaoMeses: 3,
  capacidadeSemanas: 8,
  serieMeses: 6,
};

describe("a conta do painel", () => {
  const painel = calcularPainel(
    BASE,
    "2026-05-14",
    PARAMETROS,
    "2026-09-30T12:00:00.000Z",
  );

  it("comercial: leads, sessões, contratos, conversão, faturamento e ticket", () => {
    expect(painel.comercial).toEqual({
      leads: 5,
      sessoesRealizadas: 2,
      contratosAssinados: 3,
      conversaoPct: 60,
      faturamentoCentavos: 1735000,
      ticketMedioCentavos: 578333,
    });
  });

  it("marketing: leads por origem, custo por canal, receita por origem e por campanha", () => {
    expect(painel.marketing.leadsPorOrigem).toEqual([
      { origem: "instagram_organico", leads: 2 },
      { origem: "indicacao_amigo", leads: 1 },
      { origem: "indicacao_medica", leads: 1 },
      { origem: "meta_ads", leads: 1 },
    ]);
    expect(painel.marketing.custoPorCanal).toEqual([
      { canal: "meta_ads", centavos: 150000 },
      { canal: null, centavos: 20000 },
    ]);
    expect(painel.marketing.custoTotalCentavos).toBe(170000);
    expect(painel.marketing.receitaPorOrigem).toEqual([
      { origem: "instagram_organico", centavos: 780000 },
      { origem: "meta_ads", centavos: 435000 },
    ]);
    expect(painel.marketing.receitaPorCampanha).toEqual([
      { campanha: "wa-teste-01", centavos: 435000 },
    ]);
  });

  it("operação: ativas, iniciadas, visitas, ocorrências e a capacidade", () => {
    expect(painel.operacao).toMatchObject({
      familiasAtivas: 4,
      familiasIniciadas: 2,
      visitasRealizadas: 6,
      ocorrenciasAbertas: 2,
      capacidadeSemanas: 8,
      semanasEmSobrevenda: 1,
      semanasEmAtencao: 1,
    });
    expect(painel.operacao.capacidade).toHaveLength(3);
  });

  it("experiência: respostas, promotores, detratores, NPS, indicações e depoimentos", () => {
    expect(painel.experiencia).toEqual({
      respostas: 6,
      promotores: 4,
      detratores: 1,
      amostraMinima: 5,
      nps: 50,
      indicacoes: 2,
      depoimentos: 2,
    });
  });

  it("sem a amostra mínima o NPS não vira número, mas as respostas contam", () => {
    const poucas = calcularPainel(
      { ...BASE, pesquisas: BASE.pesquisas.slice(0, 3) },
      "2026-05-14",
      PARAMETROS,
      "x",
    );
    expect(poucas.experiencia).toMatchObject({ respostas: 3, nps: null });
    expect(poucas.progresso.nps).toBeNull();
  });

  it("financeiro: os mesmos números do DRE, da inadimplência e da previsão", () => {
    expect(painel.financeiro).toMatchObject({
      recebimentosCentavos: 1215000,
      custosCentavos: 251000,
      resultadoCentavos: 964000,
      margemPct: 79.3,
      faturamentoCentavos: 1735000,
    });
  });

  it("metas, progresso e congelamento", () => {
    expect(painel.metas).toEqual(BASE.metas);
    expect(painel.progresso).toEqual({
      contratos: 3,
      familias: 2,
      faturamentoCentavos: 1735000,
      nps: 50,
    });
    expect(painel.congelamento).toEqual({
      data: "2026-11-13",
      tag: "v1.0.0-rc.1",
      diasRestantes: 44,
    });
  });

  it("o painel devolve exatamente os números do registro", () => {
    const chaves = (o: object) => Object.keys(o).sort();
    expect(chaves(painel.comercial)).toEqual(
      chavesDaSecao("comercial").map(camel).sort(),
    );
    expect(chaves(painel.marketing)).toEqual(
      chavesDaSecao("marketing").map(camel).sort(),
    );
    expect(chaves(painel.operacao)).toEqual(
      chavesDaSecao("operacao").map(camel).sort(),
    );
    expect(chaves(painel.experiencia)).toEqual(
      chavesDaSecao("experiencia").map(camel).sort(),
    );
    expect(chaves(painel.financeiro)).toEqual(
      chavesDaSecao("financeiro").map(camel).sort(),
    );
  });
});

function camel(chave: string): string {
  return chave
    .replace(/_pct$/, "Pct")
    .replace(/_centavos$/, "Centavos")
    .replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
    .replace(/^previsaoAVencer/, "previsaoAVencer");
}

describe("progresso das metas", () => {
  it("fração limitada a 1 e nula sem número atual", () => {
    const metas = {
      contratosMes: 18,
      familiasMes: 18,
      faturamentoMesCentavos: 7560000,
      nps: 90,
    };
    const r = progressoDasMetas(metas, {
      contratos: 9,
      familias: 30,
      faturamentoCentavos: 1890000,
      nps: null,
    });
    expect(r.map((m) => [m.chave, m.fracao])).toEqual([
      ["contratos", 0.5],
      ["familias", 1],
      ["faturamento", 0.25],
      ["nps", null],
    ]);
  });
});
