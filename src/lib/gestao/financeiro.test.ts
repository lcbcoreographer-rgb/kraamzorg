import { describe, expect, it } from "vitest";
import {
  calcularDre,
  calcularInadimplencia,
  calcularLancamentos,
  calcularPagamentoEquipe,
  calcularPrevisao,
  conciliarExtrato,
  evolucoesEnviadas,
  inicioDoMes,
  somarMeses,
  type CobrancaBase,
  type DespesaBase,
  type LinhaParaConferir,
} from "./financeiro";

/**
 * Financeiro (P46) em TypeScript, com o cenário do pgTAP 026 (maio de 2026):
 * o DRE fecha com os lançamentos, no fuso de São Paulo, e o pagamento da
 * equipe fica bloqueado sem a evolução enviada.
 */

function cobranca(
  id: string,
  valor: number,
  vencimento: string,
  status: CobrancaBase["status"],
  pagoEm: string | null = null,
): CobrancaBase {
  return {
    id,
    contratoId: `k-${id}`,
    familiaId: `f-${id}`,
    familiaNome: `Família Teste ${id}`,
    parcela: 1,
    valorCentavos: valor,
    vencimento,
    status,
    pagoEm,
    valorPagoCentavos: pagoEm ? valor : null,
  };
}

function despesa(
  id: string,
  data: string,
  categoria: DespesaBase["categoria"],
  valor: number,
  removida = false,
): DespesaBase {
  return {
    id,
    data,
    categoria,
    descricao: `Despesa ${id}`,
    valorCentavos: valor,
    removida,
  };
}

const COBRANCAS: CobrancaBase[] = [
  cobranca("cb1", 435000, "2026-05-09", "paga", "2026-05-10T15:00:00.000Z"),
  // 23h de 31/05 em São Paulo, já 1º de junho em UTC: conta em maio
  cobranca("cb2", 780000, "2026-05-30", "paga", "2026-06-01T02:00:00.000Z"),
  cobranca(
    "cb3",
    300000,
    "2026-05-12",
    "estornada",
    "2026-05-12T12:00:00.000Z",
  ),
  // 1h de 1º de junho em São Paulo: conta em junho
  cobranca("cb4", 100000, "2026-06-01", "paga", "2026-06-01T04:00:00.000Z"),
];
const DESPESAS: DespesaBase[] = [
  despesa("mkt", "2026-05-05", "marketing_anuncios", 150000),
  despesa("mkt2", "2026-05-06", "marketing_anuncios", 20000),
  despesa("cont", "2026-05-15", "contabilidade", 50000),
  despesa("tec", "2026-05-16", "tecnologia", 30000),
  despesa("out", "2026-05-20", "outros", 1000),
  despesa("jun", "2026-06-05", "tecnologia", 20000),
];

describe("datas do mês", () => {
  it("início do mês e soma de meses, com virada de ano", () => {
    expect(inicioDoMes("2026-05-17")).toBe("2026-05-01");
    expect(somarMeses("2026-05-01", 1)).toBe("2026-06-01");
    expect(somarMeses("2026-01-01", -1)).toBe("2025-12-01");
    expect(somarMeses("2026-11-01", 3)).toBe("2027-02-01");
  });
});

describe("DRE gerencial em regime de caixa", () => {
  it("maio: receita, despesas por categoria, resultado e margem", () => {
    const dre = calcularDre(COBRANCAS, DESPESAS, "2026-05-17", 6);
    expect(dre).toMatchObject({
      mes: "2026-05-01",
      regime: "caixa",
      receitaCentavos: 1215000,
      despesasCentavos: 251000,
      resultadoCentavos: 964000,
      margemPct: 79.3,
    });
    expect(
      dre.despesasPorCategoria.map((c) => [c.categoria, c.centavos]),
    ).toEqual([
      ["equipe_assistencial", 0],
      ["marketing_anuncios", 170000],
      ["deslocamento", 0],
      ["contabilidade", 50000],
      ["tecnologia", 30000],
      ["pro_labore", 0],
      ["outros", 1000],
    ]);
    expect(dre.serie).toHaveLength(6);
    expect(dre.serie[5]).toMatchObject({
      mes: "2026-05-01",
      resultadoCentavos: 964000,
    });
  });

  it("estornada, cancelada e o pagamento de junho ficam fora de maio", () => {
    const dre = calcularDre(COBRANCAS, DESPESAS, "2026-05-01", 1);
    expect(dre.receitaCentavos).toBe(435000 + 780000);
  });

  it("despesa removida sai do DRE", () => {
    const com = [
      ...DESPESAS.slice(0, 4),
      despesa("out", "2026-05-20", "outros", 1000, true),
    ];
    expect(calcularDre(COBRANCAS, com, "2026-05-01", 1).despesasCentavos).toBe(
      250000,
    );
  });

  it("sem receita não há margem", () => {
    expect(calcularDre([], DESPESAS, "2026-05-01", 1).margemPct).toBeNull();
  });

  it("fecha com os lançamentos: a soma linha a linha é o resultado", () => {
    const dre = calcularDre(COBRANCAS, DESPESAS, "2026-05-01", 1);
    const l = calcularLancamentos(COBRANCAS, DESPESAS, "2026-05-01");
    expect(l.lancamentos).toHaveLength(7);
    expect(l.receitasCentavos).toBe(dre.receitaCentavos);
    expect(l.despesasCentavos).toBe(dre.despesasCentavos);
    expect(l.saldoCentavos).toBe(dre.resultadoCentavos);
    const soma = l.lancamentos.reduce(
      (s, x) => s + (x.tipo === "receita" ? x.valorCentavos : -x.valorCentavos),
      0,
    );
    expect(soma).toBe(dre.resultadoCentavos);
  });

  it("com o pagamento da equipe: despesas 3.776,67, resultado 8.373,33, margem 68,9%", () => {
    const comEquipe = [
      ...DESPESAS,
      despesa("eq", "2026-05-25", "equipe_assistencial", 126667),
    ];
    const dre = calcularDre(COBRANCAS, comEquipe, "2026-05-31", 1);
    expect(dre).toMatchObject({
      despesasCentavos: 377667,
      resultadoCentavos: 837333,
      margemPct: 68.9,
    });
    expect(
      calcularLancamentos(COBRANCAS, comEquipe, "2026-05-31").saldoCentavos,
    ).toBe(837333);
  });
});

describe("inadimplência e previsão", () => {
  const hoje = "2026-09-30";
  const dia = (n: number) => {
    const d = new Date(Date.UTC(2026, 8, 30 + n));
    return d.toISOString().slice(0, 10);
  };
  const cobrancas = [
    cobranca("i1", 200000, dia(-5), "aberta"),
    cobranca("i2", 300000, dia(-20), "aberta"),
    cobranca("i3", 100000, dia(-45), "aberta"),
    cobranca("i4", 400000, dia(10), "aberta"),
    cobranca("i5", 50000, dia(-40), "cancelada"),
    cobranca("p1", 700000, dia(-30), "paga", "2026-09-01T15:00:00.000Z"),
  ];

  it("vencido, faixas de atraso e a lista", () => {
    const r = calcularInadimplencia(cobrancas, hoje, [7, 30]);
    expect(r.vencidoCentavos).toBe(600000);
    expect(r.vencidasQtd).toBe(3);
    expect(r.faixas).toEqual([
      { deDias: 1, ateDias: 7, qtd: 1, centavos: 200000 },
      { deDias: 8, ateDias: 30, qtd: 1, centavos: 300000 },
      { deDias: 31, ateDias: null, qtd: 1, centavos: 100000 },
    ]);
    expect(r.itens.map((i) => i.diasAtraso)).toEqual([45, 20, 5]);
  });

  it("a taxa é o vencido sobre o emitido até hoje (pagas e em aberto, sem cancelada)", () => {
    const r = calcularInadimplencia(cobrancas, hoje, [7, 30]);
    expect(r.emitidoAteHojeCentavos).toBe(600000 + 700000);
    expect(r.taxaPct).toBe(46.2);
  });

  it("sem nada emitido não há taxa", () => {
    expect(calcularInadimplencia([], hoje, [7, 30]).taxaPct).toBeNull();
  });

  it("previsão: o que vence de hoje em diante por mês, mais as atrasadas", () => {
    const p = calcularPrevisao(cobrancas, hoje, 3);
    expect(p.atrasadasCentavos).toBe(600000);
    expect(p.aVencerCentavos).toBe(400000);
    expect(p.meses).toHaveLength(3);
    expect(p.meses[0]).toMatchObject({
      mes: "2026-09-01",
      qtd: 0,
      centavos: 0,
    });
    expect(p.meses[1]).toMatchObject({
      mes: "2026-10-01",
      qtd: 1,
      centavos: 400000,
    });
  });
});

describe("pagamento da equipe", () => {
  const parametros = { valorHoraPadraoCentavos: 10000, diasPorAjuda: 6 };

  it("horas por visita vezes valor da hora mais a ajuda de deslocamento", () => {
    const r = calcularPagamentoEquipe({
      visitas: 4,
      horasPorVisita: 3,
      valorHoraProfissionalCentavos: null,
      ajudaDeslocamentoProfissionalCentavos: 10000,
      evolucoesEnviadas: false,
      parametros,
    });
    expect(r).toMatchObject({
      horas: 12,
      valorHoraCentavos: 10000,
      valorHorasCentavos: 120000,
      ajudaDeslocamentoCentavos: 6667,
      totalCentavos: 126667,
    });
  });

  it("fica bloqueado sem a evolução enviada e é liberado quando todas foram", () => {
    const base = {
      visitas: 4,
      horasPorVisita: 3,
      valorHoraProfissionalCentavos: null,
      ajudaDeslocamentoProfissionalCentavos: 0,
      parametros,
    };
    expect(
      calcularPagamentoEquipe({ ...base, evolucoesEnviadas: false }),
    ).toMatchObject({
      status: "bloqueado",
      motivoBloqueio: "evolucao_nao_enviada",
    });
    expect(
      calcularPagamentoEquipe({ ...base, evolucoesEnviadas: true }),
    ).toMatchObject({
      status: "liberado",
      motivoBloqueio: null,
    });
  });

  it("valor da hora da profissional vence o padrão; a backup recebe pelo que fez", () => {
    const r = calcularPagamentoEquipe({
      visitas: 2,
      horasPorVisita: 3,
      valorHoraProfissionalCentavos: 12000,
      ajudaDeslocamentoProfissionalCentavos: 0,
      evolucoesEnviadas: true,
      parametros,
    });
    expect(r).toMatchObject({
      horas: 6,
      valorHorasCentavos: 72000,
      totalCentavos: 72000,
    });
  });

  it("sem valor da hora (nem o padrão) o pagamento não é inventado", () => {
    const r = calcularPagamentoEquipe({
      visitas: 1,
      horasPorVisita: 3,
      valorHoraProfissionalCentavos: null,
      ajudaDeslocamentoProfissionalCentavos: 0,
      evolucoesEnviadas: true,
      parametros: { valorHoraPadraoCentavos: null, diasPorAjuda: 6 },
    });
    expect(r).toMatchObject({
      status: "bloqueado",
      motivoBloqueio: "sem_valor_hora",
      totalCentavos: 0,
    });
  });

  it("evoluções enviadas: a puerperal e uma neonatal por bebê", () => {
    const bebes = ["b1", "b2"];
    const puerperal = {
      tipo: "puerperal" as const,
      bebeId: null,
      enviado: true,
    };
    const n1 = { tipo: "neonatal" as const, bebeId: "b1", enviado: true };
    const n2 = { tipo: "neonatal" as const, bebeId: "b2", enviado: false };
    expect(evolucoesEnviadas([puerperal, n1], bebes)).toBe(false);
    expect(evolucoesEnviadas([puerperal, n1, n2], bebes)).toBe(false);
    expect(
      evolucoesEnviadas([puerperal, n1, { ...n2, enviado: true }], bebes),
    ).toBe(true);
    expect(evolucoesEnviadas([n1], ["b1"])).toBe(false);
  });
});

describe("conferência com o extrato", () => {
  const parametros = { janelaDias: 3, janelaSugestaoDias: 30 };
  const hoje = "2026-09-30";
  const linha = (
    id: string,
    data: string,
    valor: number,
  ): LinhaParaConferir => ({
    id,
    data,
    valorCentavos: valor,
    descricao: id,
    situacao: "sem_correspondencia",
    cobrancaId: null,
    despesaId: null,
  });

  it("crédito casa com a paga, ou só sugere a aberta; débito casa com a despesa; nunca dá baixa", () => {
    const cobrancas = [
      cobranca("cb1", 435000, "2026-05-09", "paga", "2026-05-10T15:00:00.000Z"),
      cobranca("ab1", 200000, "2026-09-25", "aberta"),
    ];
    const despesas = [
      despesa("mkt", "2026-05-05", "marketing_anuncios", 150000),
      despesa("eq", "2026-05-25", "equipe_assistencial", 126667),
    ];
    const linhas = [
      linha("l1", "2026-05-10", 435000),
      linha("l2", hoje.slice(0, 8) + "25", 200000),
      linha("l3", "2026-05-25", -126667),
      linha("l4", "2026-05-05", -150000),
      linha("l5", "2026-05-07", 123),
    ];
    const antes = JSON.stringify(cobrancas);
    const r = conciliarExtrato(linhas, cobrancas, despesas, parametros);
    expect(r).toEqual({ conferidas: 3, sugeridas: 1, semCorrespondencia: 1 });
    expect(linhas.map((l) => [l.id, l.situacao])).toEqual([
      ["l1", "conferida"],
      ["l2", "sugerida"],
      ["l3", "conferida"],
      ["l4", "conferida"],
      ["l5", "sem_correspondencia"],
    ]);
    expect(linhas[1]?.cobrancaId).toBe("ab1");
    // D-07: a cobrança sugerida continua aberta, sem pagamento
    expect(JSON.stringify(cobrancas)).toBe(antes);
    expect(cobrancas[1]).toMatchObject({ status: "aberta", pagoEm: null });
  });

  it("cada cobrança e cada despesa casa com uma linha só", () => {
    const cobrancas = [
      cobranca("cb1", 1000, "2026-05-09", "paga", "2026-05-10T15:00:00.000Z"),
    ];
    const linhas = [
      linha("a", "2026-05-10", 1000),
      linha("b", "2026-05-10", 1000),
    ];
    const r = conciliarExtrato(linhas, cobrancas, [], parametros);
    expect(r).toEqual({ conferidas: 1, sugeridas: 0, semCorrespondencia: 1 });
  });

  it("depois da baixa manual, reconferir fecha o par sugerido", () => {
    const aberta = cobranca("ab1", 200000, "2026-09-25", "aberta");
    const linhas = [linha("l2", "2026-09-25", 200000)];
    conciliarExtrato(linhas, [aberta], [], parametros);
    expect(linhas[0]?.situacao).toBe("sugerida");
    const paga: CobrancaBase = {
      ...aberta,
      status: "paga",
      pagoEm: "2026-09-25T15:00:00.000Z",
      valorPagoCentavos: 200000,
    };
    const r = conciliarExtrato(linhas, [paga], [], parametros);
    expect(r.conferidas).toBe(1);
    expect(linhas[0]).toMatchObject({
      situacao: "conferida",
      cobrancaId: "ab1",
    });
  });

  it("fora da janela de dias não casa", () => {
    const cobrancas = [
      cobranca("cb1", 1000, "2026-05-09", "paga", "2026-05-10T15:00:00.000Z"),
    ];
    const linhas = [linha("a", "2026-05-20", 1000)];
    expect(
      conciliarExtrato(linhas, cobrancas, [], parametros).semCorrespondencia,
    ).toBe(1);
  });
});
