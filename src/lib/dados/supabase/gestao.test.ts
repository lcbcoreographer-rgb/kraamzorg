// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Json } from "@/lib/db/types";
import type { ContextoSupabase } from "./comum";
import {
  capacidadeDoBanco,
  conferenciaDoBanco,
  criarGestaoSupabase,
  despesasDoBanco,
  dreDoBanco,
  extratoDoBanco,
  importacaoDoBanco,
  inadimplenciaDoBanco,
  lancamentosDoBanco,
  pagamentosDoBanco,
  painelDoBanco,
  previsaoDoBanco,
} from "./gestao";

/**
 * Caminho Supabase da gestão sem banco (P45, P46 e P52): o que as funções
 * api.* da 0026_gestao.sql devolvem vira os tipos da tela, e o que a tela
 * manda vira os argumentos certos. As respostas em __fixtures__ são a saída
 * real das funções no banco local, com o cenário do pgTAP 026.
 */

function fixture(nome: string): Json {
  return JSON.parse(
    readFileSync(path.join(__dirname, "__fixtures__", `gestao-${nome}.json`), "utf8"),
  ) as Json;
}

function clienteFalso(
  respostas: Record<string, Json | { erro: { code: string; message: string } }>,
) {
  const chamadas: { funcao: string; args: Record<string, unknown> }[] = [];
  const cliente = {
    schema: (nome: string) => {
      expect(nome).toBe("api");
      return {
        rpc: async (funcao: string, args: Record<string, unknown> = {}) => {
          chamadas.push({ funcao, args });
          const r = respostas[funcao];
          if (r && typeof r === "object" && !Array.isArray(r) && "erro" in r) {
            return { data: null, error: (r as { erro: { code: string; message: string } }).erro };
          }
          return { data: (r ?? null) as Json, error: null };
        },
      };
    },
  };
  return { contexto: { cliente, usuarioId: "u" } as unknown as ContextoSupabase, chamadas };
}

describe("capacidade do banco para a tela", () => {
  const c = capacidadeDoBanco(fixture("capacidade"));

  it("traz as regiões com as semanas, a origem da distribuição e os limites", () => {
    expect(c.semanas).toBe(8);
    expect(c.regioes.length).toBeGreaterThanOrEqual(4);
    const b = c.regioes.find((r) => r.regiao === "Região B Teste P45");
    expect(b?.limiteFamilias).toBe(1);
    expect(b?.semanas).toHaveLength(8);
    expect(c.distribuicao).toMatchObject({ modelo: "probabilistico", fonte: "referencia" });
    expect(c.distribuicao.faixas).toHaveLength(8);
    expect(c.limites.alertaPct).toBe(85);
    expect(c.limites.sobrevendaProbPct).toBeGreaterThan(0);
  });

  it("os alertas trazem a sobrevenda antes da atenção", () => {
    expect(c.alertas.length).toBeGreaterThan(0);
    expect(c.alertas[0]?.nivel).toBe("sobrevenda");
    for (const a of c.alertas) expect(a.nivel).not.toBe("folga");
  });

  it("cada semana tem os números e o nível tipados", () => {
    const s = c.regioes[0]?.semanas[0];
    expect(s).toMatchObject({
      semana: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      ocupacaoPct: expect.any(Number),
      cobertura: expect.stringMatching(/^(ok|sem_reserva|insuficiente)$/),
      nivel: expect.stringMatching(/^(folga|atencao|sobrevenda)$/),
    });
  });
});

describe("financeiro do banco para a tela", () => {
  it("DRE de maio: receita, despesas, categorias e série", () => {
    const d = dreDoBanco(fixture("dre"));
    expect(d).toMatchObject({
      mes: "2026-05-01",
      regime: "caixa",
      receitaCentavos: 1215000,
      despesasCentavos: 251000,
      resultadoCentavos: 964000,
      margemPct: 79.3,
    });
    expect(d.despesasPorCategoria).toHaveLength(7);
    expect(d.serie).toHaveLength(6);
  });

  it("lançamentos fecham com o DRE", () => {
    const l = lancamentosDoBanco(fixture("lancamentos"));
    expect(l.saldoCentavos).toBe(964000);
    expect(l.lancamentos).toHaveLength(7);
    const soma = l.lancamentos.reduce((s, x) => s + (x.tipo === "receita" ? x.valorCentavos : -x.valorCentavos), 0);
    expect(soma).toBe(l.saldoCentavos);
  });

  it("despesas do mês", () => {
    const d = despesasDoBanco(fixture("despesas"));
    expect(d.categorias).toHaveLength(7);
    expect(d.despesas).toHaveLength(5);
    expect(d.despesas.find((x) => x.canal === "meta_ads")?.categoria).toBe("marketing_anuncios");
    expect(d.totalCentavos).toBe(251000);
  });

  it("inadimplência e previsão", () => {
    const i = inadimplenciaDoBanco(fixture("inadimplencia"));
    expect(i.vencidoCentavos).toBeGreaterThanOrEqual(600000);
    expect(i.faixas.map((f) => f.deDias)).toEqual([1, 8, 31]);
    expect(i.faixas[2]?.ateDias).toBeNull();
    expect(i.itens.length).toBe(i.vencidasQtd);
    const p = previsaoDoBanco(fixture("previsao"));
    expect(p.meses).toHaveLength(3);
    expect(p.aVencerCentavos).toBe(p.meses.reduce((s, m) => s + m.centavos, 0));
  });

  it("pagamento da equipe: valores, motivo do bloqueio e resumo", () => {
    const p = pagamentosDoBanco(fixture("pagamentos"));
    const alfa = p.pagamentos.find((x) => x.profissionalNome === "Profissional A1 Teste P45");
    expect(alfa).toMatchObject({
      visitas: 4,
      horas: 12,
      valorHoraCentavos: 10000,
      totalCentavos: 126667,
      status: "pago",
      motivoBloqueio: null,
    });
    expect(p.pagamentos.some((x) => x.motivoBloqueio === "sem_valor_hora")).toBe(true);
    expect(p.resumo.pagoNoMesQtd).toBeGreaterThanOrEqual(1);
  });

  it("extrato: importações e linhas com o par", () => {
    const e = extratoDoBanco(fixture("extrato"));
    expect(e.importacoes.length).toBeGreaterThanOrEqual(1);
    expect(e.importacoes[0]).toMatchObject({ formato: "csv", linhas: 5 });
    expect(e.linhas).toHaveLength(5);
    expect(e.linhas.filter((l) => l.situacao === "conferida")).toHaveLength(3);
    expect(e.linhas.find((l) => l.situacao === "sugerida")?.cobrancaId).toBeTruthy();
    expect(e.linhas.every((l) => Number.isInteger(l.valorCentavos))).toBe(true);
  });

  it("resultados de importação e conferência", () => {
    expect(
      importacaoDoBanco({
        importacao_id: "i",
        ja_importado: true,
        linhas: 5,
        linhas_novas: 4,
        conferencia: { conferidas: 3, sugeridas: 1, sem_correspondencia: 1 },
      }),
    ).toEqual({
      importacaoId: "i",
      jaImportado: true,
      linhas: 5,
      linhasNovas: 4,
      conferencia: { conferidas: 3, sugeridas: 1, semCorrespondencia: 1 },
    });
    expect(conferenciaDoBanco({ conferidas: 1, sugeridas: 0, sem_correspondencia: 2 })).toEqual({
      conferidas: 1,
      sugeridas: 0,
      semCorrespondencia: 2,
    });
  });
});

describe("painel do banco para a tela", () => {
  const p = painelDoBanco(fixture("painel"));

  it("as cinco perguntas, as metas e o congelamento", () => {
    expect(p.mes).toBe("2026-05-01");
    expect(p.metas).toEqual({
      contratosMes: 18,
      familiasMes: 18,
      faturamentoMesCentavos: 7560000,
      nps: 90,
    });
    expect(p.comercial).toMatchObject({
      leads: 5,
      sessoesRealizadas: 2,
      contratosAssinados: 3,
      conversaoPct: 60,
      faturamentoCentavos: 1735000,
      ticketMedioCentavos: 578333,
    });
    expect(p.experiencia).toMatchObject({ respostas: 6, promotores: 4, detratores: 1, nps: 50, indicacoes: 2, depoimentos: 2 });
    expect(p.financeiro).toMatchObject({ recebimentosCentavos: 1215000, custosCentavos: 377667, margemPct: 68.9 });
    expect(p.marketing.custoTotalCentavos).toBe(170000);
    expect(p.marketing.custoPorCanal).toContainEqual({ canal: null, centavos: 20000 });
    expect(p.marketing.receitaPorCampanha).toEqual([{ campanha: "wa-teste-01", centavos: 435000 }]);
    expect(p.congelamento).toMatchObject({ data: "2026-11-13", tag: "v1.0.0-rc.1" });
    expect(p.progresso).toMatchObject({ contratos: 3, faturamentoCentavos: 1735000, nps: 50 });
  });

  it("operação traz a capacidade das próximas semanas", () => {
    expect(p.operacao.capacidadeSemanas).toBe(8);
    expect(p.operacao.capacidade.length).toBeGreaterThan(0);
    expect(p.operacao.semanasEmSobrevenda).toBe(
      p.operacao.capacidade.filter((c) => c.nivel === "sobrevenda").length,
    );
  });
});

describe("repositório real: argumentos e erros", () => {
  it("cada método chama a função certa com os argumentos certos", async () => {
    const { contexto, chamadas } = clienteFalso({
      capacidade: fixture("capacidade"),
      dre: fixture("dre"),
      salvar_despesa: { id: "novo" },
      remover_despesa: null,
      pagar_equipe: { pagamento_id: "p", despesa_id: "d", total_centavos: 100, pago_em: "2026-05-25" },
      importar_extrato: { importacao_id: "i", ja_importado: false, linhas: 1, linhas_novas: 1, conferencia: { conferidas: 0, sugeridas: 0, sem_correspondencia: 1 } },
      reconciliar_extrato: { conferidas: 0, sugeridas: 0, sem_correspondencia: 0 },
      meus_pagamentos: { pagamentos: [] },
    });
    const r = criarGestaoSupabase(contexto);
    await r.capacidade(4);
    await r.dre("2026-05-17");
    await r.dre();
    expect(await r.salvarDespesa({ data: "2026-05-05", categoria: "marketing_anuncios", descricao: "Anúncios", valorCentavos: 100, canal: "meta_ads" })).toEqual({ id: "novo" });
    await r.removerDespesa("d1", "Lançamento em duplicidade");
    expect((await r.pagarEquipe("p", "2026-05-25")).totalCentavos).toBe(100);
    await r.importarExtrato("a".repeat(64), "ofx", [{ data: "2026-05-10", valorCentavos: -100, descricao: "X" }]);
    await r.reconciliarExtrato("i");
    expect(await r.meusPagamentos()).toEqual([]);

    const por = (f: string) => chamadas.filter((c) => c.funcao === f);
    expect(por("capacidade")[0]?.args).toEqual({ semanas: 4 });
    expect(por("dre").map((c) => c.args)).toEqual([{ mes: "2026-05-17" }, { mes: null }]);
    expect(por("salvar_despesa")[0]?.args).toEqual({
      despesa_id: null,
      data: "2026-05-05",
      categoria: "marketing_anuncios",
      descricao: "Anúncios",
      fornecedor: null,
      valor_centavos: 100,
      canal: "meta_ads",
    });
    expect(por("remover_despesa")[0]?.args).toEqual({ despesa_id: "d1", motivo: "Lançamento em duplicidade" });
    expect(por("pagar_equipe")[0]?.args).toEqual({ pagamento_id: "p", data: "2026-05-25" });
    expect(por("importar_extrato")[0]?.args).toEqual({
      arquivo_hash: "a".repeat(64),
      formato: "ofx",
      linhas: [{ data: "2026-05-10", valor_centavos: -100, descricao: "X", documento: null }],
    });
    expect(por("reconciliar_extrato")[0]?.args).toEqual({ importacao_id: "i" });
  });

  it("permissão negada e recusa de negócio viram ErroRepositorio", async () => {
    const { contexto } = clienteFalso({
      painel_executivo: { erro: { code: "42501", message: "acesso negado: o papel do usuário não permite esta operação" } },
      pagar_equipe: { erro: { code: "P0001", message: "gestao:pagamento_bloqueado evolucao_nao_enviada" } },
    });
    const r = criarGestaoSupabase(contexto);
    await expect(r.painelExecutivo()).rejects.toMatchObject({ name: "ErroRepositorio", codigo: "sem_permissao" });
    await expect(r.pagarEquipe("p")).rejects.toMatchObject({ codigo: "recusado" });
  });
});
