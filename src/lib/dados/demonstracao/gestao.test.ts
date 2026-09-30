// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Papel } from "@/lib/auth/papeis";
import { codigoGestao } from "../erros";
import type { GestaoRepositorio } from "../tipos-gestao";
import {
  CONFIG_DISTRIBUICAO,
  ID_ACOMP_BLOQUEADO,
  ID_ACOMP_LIBERADO,
  ID_ACOMP_PAGO,
  PARAMETROS_GESTAO,
} from "./gestao-fixtures";
import {
  criarGestaoDemonstracao,
  obterLojaGestao,
  reiniciarLojaGestao,
  simularEnvioEvolucaoDemonstracao,
} from "./gestao";
import { USUARIOS } from "./fixtures";

/**
 * Gestão no modo demonstração (P45, P46 e P52): as regras de
 * 0026_gestao.sql que o pgTAP 026 prova no banco, aqui na loja em memória que
 * as telas e o e2e usam, mais a paridade dos parâmetros com o seed.
 */

const HOJE = "2026-09-30";
const ORIGINAL = {
  KZ_DADOS: process.env.KZ_DADOS,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
};

function repo(papel: Papel, aal: "aal1" | "aal2" = "aal2"): GestaoRepositorio {
  const u = USUARIOS.find((x) => x.papeis.includes(papel));
  if (!u) throw new Error(papel);
  return criarGestaoDemonstracao({
    usuarioId: u.id,
    papeis: [...u.papeis],
    aal,
  });
}

async function recusa(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (erro) {
    return codigoGestao(erro) ?? (erro as { codigo?: string }).codigo ?? "erro";
  }
}

beforeEach(() => {
  process.env.KZ_DADOS = "demonstracao";
  process.env.NEXT_PUBLIC_APP_ENV = "desenvolvimento";
  reiniciarLojaGestao(HOJE);
});
afterEach(() => {
  process.env.KZ_DADOS = ORIGINAL.KZ_DADOS;
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL.NEXT_PUBLIC_APP_ENV;
  reiniciarLojaGestao();
});

describe("papel e AAL", () => {
  it("financeiro e diretoria abrem o financeiro; comercial, marketing e enfermeira não", async () => {
    for (const papel of ["financeiro", "diretoria"] as const) {
      await expect(repo(papel).dre()).resolves.toBeTruthy();
    }
    for (const papel of ["comercial", "marketing", "enfermeira"] as const) {
      expect(await recusa(repo(papel).dre())).toBe("sem_permissao");
      expect(await recusa(repo(papel).pagamentosEquipe())).toBe(
        "sem_permissao",
      );
    }
  });

  it("papel com MFA em AAL1 não abre nada", async () => {
    expect(await recusa(repo("financeiro", "aal1").dre())).toBe(
      "sem_permissao",
    );
    expect(await recusa(repo("diretoria", "aal1").painelExecutivo())).toBe(
      "sem_permissao",
    );
    expect(await recusa(repo("coordenacao", "aal1").capacidade())).toBe(
      "sem_permissao",
    );
  });

  it("a capacidade é da coordenação e da diretoria; o painel, só da diretoria", async () => {
    await expect(repo("coordenacao").capacidade()).resolves.toBeTruthy();
    await expect(repo("diretoria").capacidade()).resolves.toBeTruthy();
    expect(await recusa(repo("financeiro").capacidade())).toBe("sem_permissao");
    expect(await recusa(repo("coordenacao").painelExecutivo())).toBe(
      "sem_permissao",
    );
    expect(await recusa(repo("financeiro").painelExecutivo())).toBe(
      "sem_permissao",
    );
    await expect(repo("diretoria").painelExecutivo()).resolves.toBeTruthy();
  });
});

describe("capacidade (P45)", () => {
  it("mostra oito semanas por região, com sobrevenda em Londrina e a origem da distribuição", async () => {
    const c = await repo("coordenacao").capacidade();
    expect(c.semanas).toBe(8);
    expect(c.regioes.map((r) => r.regiao)).toEqual(["Londrina", "São Paulo"]);
    for (const r of c.regioes) expect(r.semanas).toHaveLength(8);
    expect(c.distribuicao).toMatchObject({
      modelo: "probabilistico",
      fonte: "referencia",
    });
    expect(
      c.alertas.some(
        (a) => a.regiao === "Londrina" && a.nivel === "sobrevenda",
      ),
    ).toBe(true);
    // sobrevenda vem antes de atenção na lista de alertas
    const primeiro = c.alertas[0];
    expect(primeiro?.nivel).toBe("sobrevenda");
    expect(c.limites).toEqual({ alertaPct: 85, sobrevendaProbPct: 10 });
  });

  it("a quantidade de semanas é escolhida e validada", async () => {
    const c = await repo("diretoria").capacidade(2);
    expect(c.regioes[0]?.semanas).toHaveLength(2);
    expect(await recusa(repo("diretoria").capacidade(0))).toBe(
      "semanas_invalidas",
    );
  });

  it("não traz nome de família", async () => {
    const c = await repo("diretoria").capacidade();
    expect(JSON.stringify(c)).not.toMatch(/Fam[ií]lia Teste/);
  });
});

describe("DRE, lançamentos e despesas (P46)", () => {
  it("o DRE do mês fecha com os lançamentos", async () => {
    const r = repo("financeiro");
    for (const mes of [HOJE, "2026-08-15", "2026-07-01"]) {
      const dre = await r.dre(mes);
      const l = await r.lancamentos(mes);
      expect(l.saldoCentavos).toBe(dre.resultadoCentavos);
      expect(l.receitasCentavos).toBe(dre.receitaCentavos);
      expect(l.despesasCentavos).toBe(dre.despesasCentavos);
    }
    const dre = await r.dre(HOJE);
    expect(dre.serie).toHaveLength(6);
    expect(dre.despesasPorCategoria).toHaveLength(7);
    expect(dre.receitaCentavos).toBeGreaterThan(0);
  });

  it("lançar, corrigir e remover despesa muda o DRE", async () => {
    const r = repo("financeiro");
    const antes = (await r.dre(HOJE)).despesasCentavos;
    const { id } = await r.salvarDespesa({
      data: HOJE,
      categoria: "tecnologia",
      descricao: "Ferramenta nova sintética",
      valorCentavos: 12345,
    });
    expect((await r.dre(HOJE)).despesasCentavos).toBe(antes + 12345);
    await r.salvarDespesa({
      id,
      data: HOJE,
      categoria: "tecnologia",
      descricao: "Ferramenta nova sintética corrigida",
      valorCentavos: 20000,
    });
    expect((await r.dre(HOJE)).despesasCentavos).toBe(antes + 20000);
    await r.removerDespesa(id, "Lançamento em duplicidade, conferido");
    expect((await r.dre(HOJE)).despesasCentavos).toBe(antes);
    expect(
      await recusa(
        r.removerDespesa(id, "Lançamento em duplicidade, conferido"),
      ),
    ).toBe("despesa_removida");
  });

  it("recusa data futura, valor inválido, canal fora do marketing e motivo curto", async () => {
    const r = repo("diretoria");
    const base = {
      data: HOJE,
      categoria: "outros" as const,
      descricao: "Teste",
      valorCentavos: 100,
    };
    expect(await recusa(r.salvarDespesa({ ...base, data: "2026-10-01" }))).toBe(
      "data_futura",
    );
    expect(await recusa(r.salvarDespesa({ ...base, valorCentavos: 0 }))).toBe(
      "valor_invalido",
    );
    expect(
      await recusa(r.salvarDespesa({ ...base, valorCentavos: 2_000_000_000 })),
    ).toBe("valor_invalido");
    expect(await recusa(r.salvarDespesa({ ...base, canal: "meta_ads" }))).toBe(
      "canal_so_no_marketing",
    );
    expect(await recusa(r.salvarDespesa({ ...base, descricao: "  " }))).toBe(
      "descricao_invalida",
    );
    const { id } = await r.salvarDespesa(base);
    expect(await recusa(r.removerDespesa(id, "curto"))).toBe("motivo_invalido");
  });

  it("inadimplência e previsão saem das cobranças abertas", async () => {
    const r = repo("financeiro");
    const i = await r.inadimplencia();
    expect(i.vencidasQtd).toBe(3);
    expect(i.faixas.reduce((s, f) => s + f.qtd, 0)).toBe(3);
    expect(i.taxaPct).not.toBeNull();
    const p = await r.previsaoRecebimentos();
    expect(p.atrasadasCentavos).toBe(i.vencidoCentavos);
    expect(p.meses).toHaveLength(3);
  });
});

describe("pagamento da equipe (P46)", () => {
  it("nasce bloqueado sem evolução enviada, liberado com ela e pago uma vez só", async () => {
    const r = repo("financeiro");
    const lista = await r.pagamentosEquipe(HOJE);
    const status = (acomp: string) =>
      lista.pagamentos
        .filter((p) => p.acompanhamentoId === acomp)
        .map((p) => p.status);
    expect(status(ID_ACOMP_LIBERADO)).toEqual(["liberado", "liberado"]);
    expect(status(ID_ACOMP_BLOQUEADO)).toEqual(["bloqueado"]);
    const bloqueado = lista.pagamentos.find(
      (p) => p.acompanhamentoId === ID_ACOMP_BLOQUEADO,
    );
    expect(bloqueado?.motivoBloqueio).toBe("evolucao_nao_enviada");
    expect(await recusa(r.pagarEquipe(bloqueado?.id ?? "", HOJE))).toBe(
      "pagamento_bloqueado",
    );

    simularEnvioEvolucaoDemonstracao(ID_ACOMP_BLOQUEADO);
    const depois = await r.pagamentosEquipe(HOJE);
    const liberado = depois.pagamentos.find((p) => p.id === bloqueado?.id);
    expect(liberado?.status).toBe("liberado");

    const antes = (await r.dre(HOJE)).despesasCentavos;
    const pago = await r.pagarEquipe(liberado?.id ?? "", HOJE);
    expect(pago.totalCentavos).toBe(liberado?.totalCentavos);
    expect((await r.dre(HOJE)).despesasCentavos).toBe(
      antes + pago.totalCentavos,
    );
    expect(await recusa(r.pagarEquipe(pago.pagamentoId, HOJE))).toBe(
      "pagamento_ja_pago",
    );
    expect(
      await recusa(
        r.removerDespesa(pago.despesaId, "Tentativa de tirar o pagamento"),
      ),
    ).toBe("despesa_da_equipe");
  });

  it("horas × valor da hora + ajuda de deslocamento: a Alfa fez 4 visitas de 3 horas", async () => {
    const lista = await repo("diretoria").pagamentosEquipe(HOJE);
    const alfa = lista.pagamentos.find(
      (p) =>
        p.acompanhamentoId === ID_ACOMP_LIBERADO &&
        p.profissionalNome.includes("Alfa"),
    );
    expect(alfa).toMatchObject({
      visitas: 4,
      horas: 12,
      valorHoraCentavos: 10000,
      valorHorasCentavos: 120000,
      ajudaDeslocamentoCentavos: 6667,
      totalCentavos: 126667,
    });
  });

  it("a enfermeira vê só os próprios pagamentos, sem o nome da família", async () => {
    const meus = await repo("enfermeira").meusPagamentos();
    expect(meus.length).toBeGreaterThan(0);
    expect(meus.every((p) => p.familiaNome === null)).toBe(true);
    expect(new Set(meus.map((p) => p.profissionalId)).size).toBe(1);
    expect(await recusa(repo("financeiro").meusPagamentos())).toBe(
      "sem_permissao",
    );
  });

  it("um pagamento já feito aparece como pago no mês dele", async () => {
    const r = repo("financeiro");
    const todos = await r.pagamentosEquipe("2026-07-15");
    expect(
      todos.pagamentos.some(
        (p) => p.acompanhamentoId === ID_ACOMP_PAGO && p.status === "pago",
      ),
    ).toBe(true);
  });
});

describe("extrato (P46)", () => {
  it("importa, confere, é idempotente e nunca dá baixa", async () => {
    const r = repo("financeiro");
    const l = obterLojaGestao();
    const paga = l.cobrancas.find((c) => c.status === "paga");
    const aberta = l.cobrancas.find(
      (c) => c.status === "aberta" && c.vencimento < HOJE,
    );
    if (!paga || !aberta || !paga.pagoEm) throw new Error("fixture");
    const abertasAntes = JSON.stringify(
      l.cobrancas.filter((c) => c.status === "aberta"),
    );
    const hash = "a".repeat(64);
    const res = await r.importarExtrato(hash, "csv", [
      {
        data: paga.pagoEm.slice(0, 10),
        valorCentavos: paga.valorCentavos,
        descricao: "PIX SINTETICO",
      },
      {
        data: aberta.vencimento,
        valorCentavos: aberta.valorCentavos,
        descricao: "PIX SINTETICO DOIS",
      },
      { data: "2026-01-02", valorCentavos: 123, descricao: "SEM PAR" },
    ]);
    expect(res).toMatchObject({
      jaImportado: false,
      linhas: 3,
      linhasNovas: 3,
    });
    expect(res.conferencia).toEqual({
      conferidas: 1,
      sugeridas: 1,
      semCorrespondencia: 1,
    });
    expect(
      JSON.stringify(l.cobrancas.filter((c) => c.status === "aberta")),
    ).toBe(abertasAntes);

    const de_novo = await r.importarExtrato(hash, "csv", [
      { data: "2026-01-02", valorCentavos: 1, descricao: "x" },
    ]);
    expect(de_novo.jaImportado).toBe(true);
    const v = await r.extrato(res.importacaoId);
    expect(v.importacoes).toHaveLength(1);
    expect(v.linhas).toHaveLength(3);
    expect(
      v.linhas.filter((x) => x.situacao === "sugerida")[0]?.cobrancaId,
    ).toBe(aberta.id);
  });

  it("linha repetida em outro arquivo não duplica", async () => {
    const r = repo("diretoria");
    const linha = {
      data: "2026-01-02",
      valorCentavos: 123,
      descricao: "SEM PAR",
    };
    await r.importarExtrato("a".repeat(64), "ofx", [linha]);
    const b = await r.importarExtrato("b".repeat(64), "ofx", [
      linha,
      { ...linha, data: "2026-01-03" },
    ]);
    expect(b.linhasNovas).toBe(1);
  });

  it("recusa hash, formato, arquivo vazio e linha inválida", async () => {
    const r = repo("financeiro");
    const linha = { data: "2026-01-02", valorCentavos: 1, descricao: "x" };
    expect(await recusa(r.importarExtrato("curto", "csv", [linha]))).toBe(
      "arquivo_invalido",
    );
    expect(
      await recusa(r.importarExtrato("c".repeat(64), "pdf" as never, [linha])),
    ).toBe("formato_invalido");
    expect(await recusa(r.importarExtrato("c".repeat(64), "csv", []))).toBe(
      "extrato_vazio",
    );
    expect(
      await recusa(
        r.importarExtrato("c".repeat(64), "csv", [
          { ...linha, data: "amanhã" },
        ]),
      ),
    ).toBe("linha_invalida");
  });
});

describe("painel executivo (P52)", () => {
  it("responde as cinco perguntas com as metas e o congelamento", async () => {
    const p = await repo("diretoria").painelExecutivo(HOJE);
    expect(p.mes).toBe("2026-09-01");
    expect(p.metas).toEqual(PARAMETROS_GESTAO.metas);
    expect(p.comercial).toMatchObject({
      leads: 10,
      sessoesRealizadas: 5,
      contratosAssinados: 4,
    });
    expect(p.comercial.conversaoPct).toBe(40);
    expect(p.experiencia).toMatchObject({
      respostas: 6,
      promotores: 4,
      detratores: 0,
      nps: 67,
    });
    expect(p.progresso).toMatchObject({ contratos: 4, nps: 67 });
    expect(p.congelamento).toEqual({
      data: "2026-11-13",
      tag: "v1.0.0-rc.1",
      diasRestantes: 44,
    });
    expect(p.operacao.semanasEmSobrevenda).toBeGreaterThan(0);
  });

  it("os números do painel são os das telas de origem", async () => {
    const r = repo("diretoria");
    const p = await r.painelExecutivo(HOJE);
    const dre = await r.dre(HOJE);
    const inad = await r.inadimplencia();
    const prev = await r.previsaoRecebimentos();
    const cap = await r.capacidade();
    expect(p.financeiro).toMatchObject({
      recebimentosCentavos: dre.receitaCentavos,
      custosCentavos: dre.despesasCentavos,
      resultadoCentavos: dre.resultadoCentavos,
      margemPct: dre.margemPct,
      inadimplenciaPct: inad.taxaPct,
      vencidoCentavos: inad.vencidoCentavos,
      previsaoAVencerCentavos: prev.aVencerCentavos,
      previsaoAtrasadasCentavos: prev.atrasadasCentavos,
    });
    expect(p.operacao.semanasEmSobrevenda).toBe(
      cap.alertas.filter((a) => a.nivel === "sobrevenda").length,
    );
    expect(p.operacao.capacidade).toHaveLength(
      cap.regioes.reduce((s, x) => s + x.semanas.length, 0),
    );
    expect(p.marketing.custoTotalCentavos).toBe(240000);
  });
});

describe("paridade com o seed", () => {
  const seed = readFileSync(
    path.resolve(__dirname, "../../../../supabase/dados/gestao_seed.sql"),
    "utf8",
  );
  // junta os literais adjacentes do SQL ('a' 'b' vira 'ab')
  const junto = seed.replace(/'\s*\n\s*'/g, "");

  function json(chave: string): unknown {
    const re = new RegExp(
      `\\('${chave}',\\s*\\(?'(\\{[\\s\\S]*?\\})'(?:\\)::jsonb)?,\\s*\\n`,
    );
    const achado = re.exec(junto);
    if (!achado) throw new Error(`parâmetro ${chave} não achado no seed`);
    return JSON.parse((achado[1] as string).replace(/''/g, "'"));
  }
  function escalar(chave: string): number {
    const achado = new RegExp(`\\('${chave}', '(\\d+)'`).exec(seed);
    if (!achado) throw new Error(`parâmetro ${chave} não achado no seed`);
    return Number(achado[1]);
  }

  it("distribuição do nascimento", () => {
    const s = json("distribuicao_nascimento") as {
      versao: string;
      descricao: string;
      historico_minimo: number;
      deslocamento_inicio_dias: number;
      intervalo_provavel_pct: number;
      faixas: { de: number; ate: number; peso: number }[];
    };
    expect(s.versao).toBe(CONFIG_DISTRIBUICAO.versao);
    expect(s.descricao).toBe(CONFIG_DISTRIBUICAO.descricao);
    expect(s.historico_minimo).toBe(CONFIG_DISTRIBUICAO.historicoMinimo);
    expect(s.deslocamento_inicio_dias).toBe(
      CONFIG_DISTRIBUICAO.deslocamentoInicioDias,
    );
    expect(s.intervalo_provavel_pct).toBe(
      PARAMETROS_GESTAO.distribuicao.intervaloProvavelPct,
    );
    expect(s.faixas).toEqual(CONFIG_DISTRIBUICAO.faixas);
    expect(s.faixas.reduce((t, f) => t + f.peso, 0)).toBe(100);
  });

  it("limites da capacidade", () => {
    expect(escalar("sobrevenda_prob_pct")).toBe(
      PARAMETROS_GESTAO.sobrevendaProbPct,
    );
    expect(escalar("capacidade_semanas_painel")).toBe(
      PARAMETROS_GESTAO.capacidadeSemanasPainel,
    );
    expect(escalar("backup_reserva_profissionais")).toBe(
      PARAMETROS_GESTAO.backupReservaProfissionais,
    );
  });

  it("pagamento da equipe, financeiro, metas, painel e congelamento", () => {
    const pe = json("pagamento_equipe") as {
      valor_hora_padrao_centavos: number;
      dias_por_ajuda: number;
    };
    expect(pe).toEqual({
      valor_hora_padrao_centavos:
        PARAMETROS_GESTAO.pagamentoEquipe.valorHoraPadraoCentavos,
      dias_por_ajuda: PARAMETROS_GESTAO.pagamentoEquipe.diasPorAjuda,
    });
    const f = json("financeiro") as Record<string, unknown>;
    expect(f).toEqual({
      janela_extrato_dias: PARAMETROS_GESTAO.financeiro.janelaExtratoDias,
      janela_sugestao_dias: PARAMETROS_GESTAO.financeiro.janelaSugestaoDias,
      extrato_max_linhas: PARAMETROS_GESTAO.financeiro.extratoMaxLinhas,
      faixas_inadimplencia_dias:
        PARAMETROS_GESTAO.financeiro.faixasInadimplenciaDias,
      previsao_meses: PARAMETROS_GESTAO.financeiro.previsaoMeses,
      serie_meses: PARAMETROS_GESTAO.financeiro.serieMeses,
      despesa_max_centavos: PARAMETROS_GESTAO.financeiro.despesaMaxCentavos,
    });
    expect(json("metas_kraamzorg")).toEqual({
      contratos_mes: 18,
      familias_mes: 18,
      faturamento_mes_centavos: 7560000,
      nps: 90,
    });
    expect(json("painel_executivo")).toEqual({
      nps_amostra_minima: PARAMETROS_GESTAO.painel.npsAmostraMinima,
    });
    expect(json("congelamento_desenvolvimento")).toEqual(
      PARAMETROS_GESTAO.congelamento,
    );
  });
});
