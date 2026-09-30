import "server-only";
import type { Json } from "@/lib/db/types";
import type {
  AlertaCapacidade,
  CapacidadeVisao,
  CategoriaDespesa,
  CoberturaBackup,
  Conferencia,
  Dre,
  ExtratoVisao,
  GestaoRepositorio,
  Inadimplencia,
  Lancamentos,
  ListaDespesas,
  NivelCapacidade,
  OrigemLead,
  PagamentoEquipe,
  PagamentosEquipe,
  PainelExecutivo,
  PrevisaoRecebimentos,
  RegiaoCapacidade,
  ResultadoImportacaoExtrato,
  ResultadoPagamentoEquipe,
  SemanaCapacidade,
} from "../tipos-gestao";
import { rpcPendente, type ContextoSupabase } from "./comum";

/**
 * Gestão da Fase 3 na real (P45, P46 e P52): funções do schema api da
 * 0026_gestao.sql. Cada função confere o papel e o AAL2 por dentro. Enquanto
 * `src/lib/db/types.ts` não for regenerado depois da migration, a chamada é
 * por nome (`rpcPendente`); o mapeamento do JSON para os tipos da tela é o
 * que os testes conferem.
 */

type Registro = Record<string, Json | undefined>;

function obj(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : {};
}
const lista = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const texto = (v: Json | undefined): string | null =>
  typeof v === "string" ? v : null;
const txt = (v: Json | undefined): string => texto(v) ?? "";
const num = (v: Json | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0) || 0;
const numOuNulo = (v: Json | undefined): number | null =>
  v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null;

// --- Capacidade -----------------------------------------------------------------------

function semanaDoBanco(valor: Json): SemanaCapacidade {
  const x = obj(valor);
  return {
    semana: txt(x.semana),
    ocupacaoPct: num(x.ocupacao_pct),
    familiasEsperadas: num(x.familias_esperadas),
    familiasP90: num(x.familias_p90),
    probExcessoPct: num(x.prob_excesso_pct),
    profissionaisAtivas: num(x.profissionais_ativas),
    capacidadeEquipe: num(x.capacidade_equipe),
    cobertura: (texto(x.cobertura) ?? "ok") as CoberturaBackup,
    nivel: (texto(x.nivel) ?? "folga") as NivelCapacidade,
  };
}

export function capacidadeDoBanco(valor: Json): CapacidadeVisao {
  const r = obj(valor);
  const d = obj(r.distribuicao);
  const lim = obj(r.limites);
  return {
    geradoEm: txt(r.gerado_em),
    semanas: num(r.semanas),
    distribuicao: {
      modelo: texto(d.modelo) === "uniforme" ? "uniforme" : "probabilistico",
      fonte: (texto(d.fonte) ?? "referencia") as CapacidadeVisao["distribuicao"]["fonte"],
      versao: texto(d.versao),
      descricao: texto(d.descricao),
      historicoN: num(d.historico_n),
      historicoMinimo: numOuNulo(d.historico_minimo),
      faixas: lista(d.faixas).map((f) => {
        const y = obj(f);
        return { de: num(y.de), ate: num(y.ate), peso: num(y.peso) };
      }),
    },
    limites: {
      alertaPct: num(lim.alerta_pct),
      sobrevendaProbPct: num(lim.sobrevenda_prob_pct),
    },
    regioes: lista(r.regioes).map((g): RegiaoCapacidade => {
      const y = obj(g);
      return {
        regiaoId: txt(y.regiao_id),
        regiao: txt(y.regiao),
        limiteFamilias: num(y.limite_familias),
        semanas: lista(y.semanas).map(semanaDoBanco),
      };
    }),
    alertas: lista(r.alertas).map((a): AlertaCapacidade => {
      const y = obj(a);
      return {
        regiaoId: txt(y.regiao_id),
        regiao: txt(y.regiao),
        semana: txt(y.semana),
        nivel: (texto(y.nivel) ?? "atencao") as NivelCapacidade,
        probExcessoPct: num(y.prob_excesso_pct),
        ocupacaoPct: num(y.ocupacao_pct),
        cobertura: (texto(y.cobertura) ?? "ok") as CoberturaBackup,
      };
    }),
  };
}

// --- Financeiro -----------------------------------------------------------------------

export function dreDoBanco(valor: Json): Dre {
  const r = obj(valor);
  return {
    mes: txt(r.mes),
    regime: "caixa",
    receitaCentavos: num(r.receita_centavos),
    despesasCentavos: num(r.despesas_centavos),
    despesasPorCategoria: lista(r.despesas_por_categoria).map((c) => {
      const y = obj(c);
      return { categoria: txt(y.categoria) as CategoriaDespesa, centavos: num(y.centavos) };
    }),
    resultadoCentavos: num(r.resultado_centavos),
    margemPct: numOuNulo(r.margem_pct),
    serie: lista(r.serie).map((p) => {
      const y = obj(p);
      return {
        mes: txt(y.mes),
        receitaCentavos: num(y.receita_centavos),
        despesasCentavos: num(y.despesas_centavos),
        resultadoCentavos: num(y.resultado_centavos),
      };
    }),
  };
}

export function lancamentosDoBanco(valor: Json): Lancamentos {
  const r = obj(valor);
  return {
    mes: txt(r.mes),
    receitasCentavos: num(r.receitas_centavos),
    despesasCentavos: num(r.despesas_centavos),
    saldoCentavos: num(r.saldo_centavos),
    lancamentos: lista(r.lancamentos).map((l) => {
      const y = obj(l);
      return {
        tipo: texto(y.tipo) === "despesa" ? "despesa" : "receita",
        id: txt(y.id),
        data: txt(y.data),
        categoria: txt(y.categoria),
        descricao: txt(y.descricao),
        valorCentavos: num(y.valor_centavos),
      };
    }),
  };
}

export function despesasDoBanco(valor: Json): ListaDespesas {
  const r = obj(valor);
  return {
    mes: txt(r.mes),
    categorias: lista(r.categorias).map((c) => String(c) as CategoriaDespesa),
    totalCentavos: num(r.total_centavos),
    despesas: lista(r.despesas).map((d) => {
      const y = obj(d);
      return {
        id: txt(y.id),
        data: txt(y.data),
        categoria: txt(y.categoria) as CategoriaDespesa,
        descricao: txt(y.descricao),
        fornecedor: texto(y.fornecedor),
        valorCentavos: num(y.valor_centavos),
        canal: texto(y.canal) as OrigemLead | null,
        daEquipe: y.da_equipe === true,
      };
    }),
  };
}

export function inadimplenciaDoBanco(valor: Json): Inadimplencia {
  const r = obj(valor);
  return {
    em: txt(r.em),
    vencidoCentavos: num(r.vencido_centavos),
    vencidasQtd: num(r.vencidas_qtd),
    emitidoAteHojeCentavos: num(r.emitido_ate_hoje_centavos),
    taxaPct: numOuNulo(r.taxa_pct),
    faixas: lista(r.faixas).map((f) => {
      const y = obj(f);
      return {
        deDias: num(y.de_dias),
        ateDias: numOuNulo(y.ate_dias),
        qtd: num(y.qtd),
        centavos: num(y.centavos),
      };
    }),
    itens: lista(r.itens).map((i) => {
      const y = obj(i);
      return {
        id: txt(y.id),
        contratoId: txt(y.contrato_id),
        familiaId: txt(y.familia_id),
        familiaNome: txt(y.familia_nome),
        parcela: num(y.parcela) || 1,
        valorCentavos: num(y.valor_centavos),
        vencimento: txt(y.vencimento),
        diasAtraso: num(y.dias_atraso),
      };
    }),
  };
}

export function previsaoDoBanco(valor: Json): PrevisaoRecebimentos {
  const r = obj(valor);
  return {
    atrasadasCentavos: num(r.atrasadas_centavos),
    aVencerCentavos: num(r.a_vencer_centavos),
    meses: lista(r.meses).map((m) => {
      const y = obj(m);
      return { mes: txt(y.mes), qtd: num(y.qtd), centavos: num(y.centavos) };
    }),
  };
}

export function pagamentoDoBanco(valor: Json): PagamentoEquipe {
  const y = obj(valor);
  return {
    id: txt(y.id),
    acompanhamentoId: txt(y.acompanhamento_id),
    profissionalId: txt(y.profissional_id),
    profissionalNome: txt(y.profissional_nome),
    familiaNome: texto(y.familia_nome),
    visitas: num(y.visitas),
    horas: num(y.horas),
    valorHoraCentavos: numOuNulo(y.valor_hora_centavos),
    valorHorasCentavos: num(y.valor_horas_centavos),
    ajudaDeslocamentoCentavos: num(y.ajuda_deslocamento_centavos),
    totalCentavos: num(y.total_centavos),
    status: txt(y.status) as PagamentoEquipe["status"],
    motivoBloqueio: texto(y.motivo_bloqueio) as PagamentoEquipe["motivoBloqueio"],
    pagoEm: texto(y.pago_em),
    estadoAcompanhamento: txt(y.estado_acompanhamento),
  };
}

export function pagamentosDoBanco(valor: Json): PagamentosEquipe {
  const r = obj(valor);
  const s = obj(r.resumo);
  return {
    resumo: {
      mes: txt(s.mes),
      bloqueadoCentavos: num(s.bloqueado_centavos),
      bloqueadoQtd: num(s.bloqueado_qtd),
      liberadoCentavos: num(s.liberado_centavos),
      liberadoQtd: num(s.liberado_qtd),
      pagoNoMesCentavos: num(s.pago_no_mes_centavos),
      pagoNoMesQtd: num(s.pago_no_mes_qtd),
    },
    pagamentos: lista(r.pagamentos).map(pagamentoDoBanco),
  };
}

export function conferenciaDoBanco(valor: Json): Conferencia {
  const r = obj(valor);
  return {
    conferidas: num(r.conferidas),
    sugeridas: num(r.sugeridas),
    semCorrespondencia: num(r.sem_correspondencia),
  };
}

export function importacaoDoBanco(valor: Json): ResultadoImportacaoExtrato {
  const r = obj(valor);
  return {
    importacaoId: txt(r.importacao_id),
    jaImportado: r.ja_importado === true,
    linhas: num(r.linhas),
    linhasNovas: num(r.linhas_novas),
    conferencia: conferenciaDoBanco(r.conferencia ?? null),
  };
}

export function extratoDoBanco(valor: Json): ExtratoVisao {
  const r = obj(valor);
  return {
    importacoes: lista(r.importacoes).map((i) => {
      const y = obj(i);
      return {
        id: txt(y.id),
        formato: texto(y.formato) === "ofx" ? "ofx" : "csv",
        linhas: num(y.linhas),
        linhasNovas: num(y.linhas_novas),
        periodoInicio: texto(y.periodo_inicio),
        periodoFim: texto(y.periodo_fim),
        importadoEm: txt(y.importado_em),
        conferidas: num(y.conferidas),
        sugeridas: num(y.sugeridas),
        semCorrespondencia: num(y.sem_correspondencia),
      };
    }),
    linhas: lista(r.linhas).map((l) => {
      const y = obj(l);
      return {
        id: txt(y.id),
        importacaoId: txt(y.importacao_id),
        data: txt(y.data),
        valorCentavos: num(y.valor_centavos),
        descricao: txt(y.descricao),
        situacao: txt(y.situacao) as ExtratoVisao["linhas"][number]["situacao"],
        cobrancaId: texto(y.cobranca_id),
        cobrancaParcela: numOuNulo(y.cobranca_parcela),
        cobrancaSituacao: texto(y.cobranca_situacao),
        familiaNome: texto(y.familia_nome),
        despesaId: texto(y.despesa_id),
        despesaDescricao: texto(y.despesa_descricao),
      };
    }),
  };
}

// --- Painel -----------------------------------------------------------------------------

export function painelDoBanco(valor: Json): PainelExecutivo {
  const r = obj(valor);
  const m = obj(r.metas);
  const p = obj(r.progresso);
  const co = obj(r.comercial);
  const ma = obj(r.marketing);
  const op = obj(r.operacao);
  const ex = obj(r.experiencia);
  const fi = obj(r.financeiro);
  const cg = r.congelamento ? obj(r.congelamento) : null;
  return {
    geradoEm: txt(r.gerado_em),
    mes: txt(r.mes),
    metas: {
      contratosMes: num(m.contratos_mes),
      familiasMes: num(m.familias_mes),
      faturamentoMesCentavos: num(m.faturamento_mes_centavos),
      nps: num(m.nps),
    },
    progresso: {
      contratos: num(p.contratos),
      familias: num(p.familias),
      faturamentoCentavos: num(p.faturamento_centavos),
      nps: numOuNulo(p.nps),
    },
    congelamento: cg
      ? { data: txt(cg.data), tag: txt(cg.tag), diasRestantes: num(cg.dias_restantes) }
      : null,
    comercial: {
      leads: num(co.leads),
      sessoesRealizadas: num(co.sessoes_realizadas),
      contratosAssinados: num(co.contratos_assinados),
      conversaoPct: numOuNulo(co.conversao_pct),
      faturamentoCentavos: num(co.faturamento_centavos),
      ticketMedioCentavos: numOuNulo(co.ticket_medio_centavos),
    },
    marketing: {
      leadsPorOrigem: lista(ma.leads_por_origem).map((x) => {
        const y = obj(x);
        return { origem: txt(y.origem) as OrigemLead, leads: num(y.leads) };
      }),
      custoPorCanal: lista(ma.custo_por_canal).map((x) => {
        const y = obj(x);
        return { canal: texto(y.canal) as OrigemLead | null, centavos: num(y.centavos) };
      }),
      custoTotalCentavos: num(ma.custo_total_centavos),
      receitaPorOrigem: lista(ma.receita_por_origem).map((x) => {
        const y = obj(x);
        return { origem: txt(y.origem) as OrigemLead, centavos: num(y.centavos) };
      }),
      receitaPorCampanha: lista(ma.receita_por_campanha).map((x) => {
        const y = obj(x);
        return { campanha: txt(y.campanha), centavos: num(y.centavos) };
      }),
    },
    operacao: {
      familiasAtivas: num(op.familias_ativas),
      familiasIniciadas: num(op.familias_iniciadas),
      visitasRealizadas: num(op.visitas_realizadas),
      ocorrenciasAbertas: num(op.ocorrencias_abertas),
      capacidadeSemanas: num(op.capacidade_semanas),
      capacidade: lista(op.capacidade).map((x) => {
        const y = obj(x);
        return {
          regiao: txt(y.regiao),
          semana: txt(y.semana),
          ocupacaoPct: num(y.ocupacao_pct),
          probExcessoPct: num(y.prob_excesso_pct),
          cobertura: (texto(y.cobertura) ?? "ok") as CoberturaBackup,
          nivel: (texto(y.nivel) ?? "folga") as NivelCapacidade,
        };
      }),
      semanasEmSobrevenda: num(op.semanas_em_sobrevenda),
      semanasEmAtencao: num(op.semanas_em_atencao),
    },
    experiencia: {
      respostas: num(ex.respostas),
      promotores: num(ex.promotores),
      detratores: num(ex.detratores),
      amostraMinima: num(ex.amostra_minima),
      nps: numOuNulo(ex.nps),
      indicacoes: num(ex.indicacoes),
      depoimentos: num(ex.depoimentos),
    },
    financeiro: {
      recebimentosCentavos: num(fi.recebimentos_centavos),
      custosCentavos: num(fi.custos_centavos),
      resultadoCentavos: num(fi.resultado_centavos),
      margemPct: numOuNulo(fi.margem_pct),
      inadimplenciaPct: numOuNulo(fi.inadimplencia_pct),
      vencidoCentavos: num(fi.vencido_centavos),
      previsaoAVencerCentavos: num(fi.previsao_a_vencer_centavos),
      previsaoAtrasadasCentavos: num(fi.previsao_atrasadas_centavos),
      faturamentoCentavos: num(fi.faturamento_centavos),
    },
  };
}

// --- Repositório ------------------------------------------------------------------------

export function criarGestaoSupabase(
  contexto: ContextoSupabase,
): GestaoRepositorio {
  const chamar = (funcao: string, args: Record<string, unknown> = {}) =>
    rpcPendente(contexto.cliente, funcao, args);

  return {
    async capacidade(semanas) {
      return capacidadeDoBanco(await chamar("capacidade", { semanas: semanas ?? null }));
    },
    async dre(mes) {
      return dreDoBanco(await chamar("dre", { mes: mes ?? null }));
    },
    async lancamentos(mes) {
      return lancamentosDoBanco(await chamar("lancamentos", { mes: mes ?? null }));
    },
    async despesas(mes) {
      return despesasDoBanco(await chamar("despesas", { mes: mes ?? null }));
    },
    async salvarDespesa(pedido) {
      const r = obj(
        await chamar("salvar_despesa", {
          despesa_id: pedido.id ?? null,
          data: pedido.data,
          categoria: pedido.categoria,
          descricao: pedido.descricao,
          fornecedor: pedido.fornecedor ?? null,
          valor_centavos: pedido.valorCentavos,
          canal: pedido.canal ?? null,
        }),
      );
      return { id: txt(r.id) };
    },
    async removerDespesa(despesaId, motivo) {
      await chamar("remover_despesa", { despesa_id: despesaId, motivo });
    },
    async inadimplencia() {
      return inadimplenciaDoBanco(await chamar("inadimplencia"));
    },
    async previsaoRecebimentos() {
      return previsaoDoBanco(await chamar("previsao_recebimentos"));
    },
    async pagamentosEquipe(mes) {
      return pagamentosDoBanco(await chamar("pagamentos_equipe", { mes: mes ?? null }));
    },
    async pagarEquipe(pagamentoId, data) {
      const r = obj(await chamar("pagar_equipe", { pagamento_id: pagamentoId, data: data ?? null }));
      const res: ResultadoPagamentoEquipe = {
        pagamentoId: txt(r.pagamento_id),
        despesaId: txt(r.despesa_id),
        totalCentavos: num(r.total_centavos),
        pagoEm: txt(r.pago_em),
      };
      return res;
    },
    async meusPagamentos() {
      const r = obj(await chamar("meus_pagamentos"));
      return lista(r.pagamentos).map(pagamentoDoBanco);
    },
    async importarExtrato(arquivoHash, formato, linhas) {
      return importacaoDoBanco(
        await chamar("importar_extrato", {
          arquivo_hash: arquivoHash,
          formato,
          linhas: linhas.map((l) => ({
            data: l.data,
            valor_centavos: l.valorCentavos,
            descricao: l.descricao,
            documento: l.documento ?? null,
          })),
        }),
      );
    },
    async reconciliarExtrato(importacaoId) {
      return conferenciaDoBanco(
        await chamar("reconciliar_extrato", { importacao_id: importacaoId ?? null }),
      );
    },
    async extrato(importacaoId) {
      return extratoDoBanco(await chamar("extrato", { importacao_id: importacaoId ?? null }));
    },
    async painelExecutivo(mes) {
      return painelDoBanco(await chamar("painel_executivo", { mes: mes ?? null }));
    },
  };
}
