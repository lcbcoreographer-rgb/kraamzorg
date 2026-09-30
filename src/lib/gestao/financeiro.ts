import { dataEmBrasilia, diferencaEmDias, somarDias } from "@/lib/agenda/datas";
import {
  CATEGORIAS_DESPESA,
  type CategoriaDespesa,
  type Conferencia,
  type Dre,
  type FaixaInadimplencia,
  type Inadimplencia,
  type ItemInadimplente,
  type Lancamentos,
  type LinhaExtratoEntrada,
  type MesPrevisao,
  type MotivoBloqueioPagamento,
  type PrevisaoRecebimentos,
  type SituacaoExtrato,
  type StatusPagamentoEquipe,
} from "@/lib/dados/tipos-gestao";

/**
 * Financeiro da Fase 3 (P46): DRE gerencial em regime de caixa, lançamentos,
 * inadimplência, previsão de recebimentos, pagamento da equipe e conferência
 * do extrato. É a mesma conta das funções api.* da 0026_gestao.sql, para o
 * modo demonstração; o pgTAP 026 prova o banco e financeiro.test.ts prova
 * aqui, com o mesmo cenário sintético. Dinheiro em centavos, inteiro.
 */

export type StatusCobranca =
  "aberta" | "vencida" | "paga" | "cancelada" | "estornada";

export interface CobrancaBase {
  id: string;
  contratoId: string;
  familiaId: string;
  familiaNome: string;
  parcela: number;
  valorCentavos: number;
  /** Data de calendário. */
  vencimento: string;
  status: StatusCobranca;
  /** Instante do pagamento (ISO). */
  pagoEm: string | null;
  valorPagoCentavos: number | null;
}

export interface DespesaBase {
  id: string;
  data: string;
  categoria: CategoriaDespesa;
  descricao: string;
  valorCentavos: number;
  removida: boolean;
  pagamentoEquipeId?: string | null;
}

// --- Datas do mês ---------------------------------------------------------------------

/** Primeiro dia do mês de uma data de calendário. */
export function inicioDoMes(dia: string): string {
  return `${dia.slice(0, 7)}-01`;
}

/** Soma (ou subtrai) meses inteiros a um primeiro dia de mês. */
export function somarMeses(primeiroDia: string, meses: number): string {
  const ano = Number(primeiroDia.slice(0, 4));
  const mes = Number(primeiroDia.slice(5, 7)) - 1 + meses;
  const a = ano + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  return `${String(a).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-01`;
}

function dentro(dia: string | null, de: string, ateExclusivo: string): boolean {
  return dia !== null && dia >= de && dia < ateExclusivo;
}

function diaDoPagamento(c: CobrancaBase): string | null {
  return c.pagoEm ? dataEmBrasilia(c.pagoEm) : null;
}

function valorRecebido(c: CobrancaBase): number {
  return c.valorPagoCentavos ?? c.valorCentavos;
}

// --- Receita, DRE e lançamentos -------------------------------------------------------

/** Soma das cobranças pagas no período; estornada e cancelada não contam. */
export function receitaPeriodo(
  cobrancas: CobrancaBase[],
  de: string,
  ateExclusivo: string,
): number {
  return cobrancas
    .filter(
      (c) => c.status === "paga" && dentro(diaDoPagamento(c), de, ateExclusivo),
    )
    .reduce((soma, c) => soma + valorRecebido(c), 0);
}

export function despesasPeriodo(
  despesas: DespesaBase[],
  de: string,
  ateExclusivo: string,
): DespesaBase[] {
  return despesas.filter(
    (d) => !d.removida && dentro(d.data, de, ateExclusivo),
  );
}

function arredondar1(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10) / 10;
}

export function calcularDre(
  cobrancas: CobrancaBase[],
  despesas: DespesaBase[],
  mesQualquerDia: string,
  serieMeses: number,
): Dre {
  const mes = inicioDoMes(mesQualquerDia);
  const fim = somarMeses(mes, 1);
  const doMes = despesasPeriodo(despesas, mes, fim);
  const receita = receitaPeriodo(cobrancas, mes, fim);
  const total = doMes.reduce((s, d) => s + d.valorCentavos, 0);
  const serie = [];
  for (let i = serieMeses - 1; i >= 0; i -= 1) {
    const m = somarMeses(mes, -i);
    const f = somarMeses(m, 1);
    const r = receitaPeriodo(cobrancas, m, f);
    const dsp = despesasPeriodo(despesas, m, f).reduce(
      (s, d) => s + d.valorCentavos,
      0,
    );
    serie.push({
      mes: m,
      receitaCentavos: r,
      despesasCentavos: dsp,
      resultadoCentavos: r - dsp,
    });
  }
  return {
    mes,
    regime: "caixa",
    receitaCentavos: receita,
    despesasCentavos: total,
    despesasPorCategoria: CATEGORIAS_DESPESA.map((categoria) => ({
      categoria,
      centavos: doMes
        .filter((d) => d.categoria === categoria)
        .reduce((s, d) => s + d.valorCentavos, 0),
    })),
    resultadoCentavos: receita - total,
    margemPct:
      receita > 0 ? arredondar1((100 * (receita - total)) / receita) : null,
    serie,
  };
}

export function calcularLancamentos(
  cobrancas: CobrancaBase[],
  despesas: DespesaBase[],
  mesQualquerDia: string,
): Lancamentos {
  const mes = inicioDoMes(mesQualquerDia);
  const fim = somarMeses(mes, 1);
  const linhas: Lancamentos["lancamentos"] = [
    ...cobrancas
      .filter((c) => c.status === "paga" && dentro(diaDoPagamento(c), mes, fim))
      .map((c) => ({
        tipo: "receita" as const,
        id: c.id,
        data: diaDoPagamento(c) ?? mes,
        categoria: "cobranca",
        descricao: c.familiaNome,
        valorCentavos: valorRecebido(c),
      })),
    ...despesasPeriodo(despesas, mes, fim).map((d) => ({
      tipo: "despesa" as const,
      id: d.id,
      data: d.data,
      categoria: d.categoria,
      descricao: d.descricao,
      valorCentavos: d.valorCentavos,
    })),
  ].sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      a.tipo.localeCompare(b.tipo) ||
      a.id.localeCompare(b.id),
  );
  const receitas = linhas
    .filter((l) => l.tipo === "receita")
    .reduce((s, l) => s + l.valorCentavos, 0);
  const desp = linhas
    .filter((l) => l.tipo === "despesa")
    .reduce((s, l) => s + l.valorCentavos, 0);
  return {
    mes,
    lancamentos: linhas,
    receitasCentavos: receitas,
    despesasCentavos: desp,
    saldoCentavos: receitas - desp,
  };
}

// --- Inadimplência e previsão ---------------------------------------------------------

const EM_ABERTO: StatusCobranca[] = ["aberta", "vencida"];

export function calcularInadimplencia(
  cobrancas: CobrancaBase[],
  hoje: string,
  faixasDias: number[],
): Inadimplencia {
  const limites = [...faixasDias].sort((a, b) => a - b);
  const vencidas = cobrancas.filter(
    (c) => EM_ABERTO.includes(c.status) && c.vencimento < hoje,
  );
  const vencido = vencidas.reduce((s, c) => s + c.valorCentavos, 0);
  const emitido = cobrancas
    .filter(
      (c) =>
        c.vencimento <= hoje &&
        (EM_ABERTO.includes(c.status) || c.status === "paga"),
    )
    .reduce(
      (s, c) => s + (c.status === "paga" ? valorRecebido(c) : c.valorCentavos),
      0,
    );

  const atraso = (c: CobrancaBase) => diferencaEmDias(c.vencimento, hoje);
  const faixas: FaixaInadimplencia[] = [];
  let de = 1;
  for (const teto of [...limites, null]) {
    const nessa = vencidas.filter(
      (c) => atraso(c) >= de && (teto === null || atraso(c) <= teto),
    );
    faixas.push({
      deDias: de,
      ateDias: teto,
      qtd: nessa.length,
      centavos: nessa.reduce((s, c) => s + c.valorCentavos, 0),
    });
    if (teto !== null) de = teto + 1;
  }
  const itens: ItemInadimplente[] = [...vencidas]
    .sort(
      (a, b) =>
        a.vencimento.localeCompare(b.vencimento) || a.id.localeCompare(b.id),
    )
    .map((c) => ({
      id: c.id,
      contratoId: c.contratoId,
      familiaId: c.familiaId,
      familiaNome: c.familiaNome,
      parcela: c.parcela,
      valorCentavos: c.valorCentavos,
      vencimento: c.vencimento,
      diasAtraso: atraso(c),
    }));
  return {
    em: hoje,
    vencidoCentavos: vencido,
    vencidasQtd: vencidas.length,
    emitidoAteHojeCentavos: emitido,
    taxaPct: emitido > 0 ? arredondar1((100 * vencido) / emitido) : null,
    faixas,
    itens,
  };
}

export function calcularPrevisao(
  cobrancas: CobrancaBase[],
  hoje: string,
  meses: number,
): PrevisaoRecebimentos {
  const abertas = cobrancas.filter((c) => EM_ABERTO.includes(c.status));
  const atrasadas = abertas
    .filter((c) => c.vencimento < hoje)
    .reduce((s, c) => s + c.valorCentavos, 0);
  const lista: MesPrevisao[] = [];
  const mes0 = inicioDoMes(hoje);
  for (let i = 0; i < meses; i += 1) {
    const m = somarMeses(mes0, i);
    const f = somarMeses(m, 1);
    const doMes = abertas.filter(
      (c) => c.vencimento >= hoje && c.vencimento >= m && c.vencimento < f,
    );
    lista.push({
      mes: m,
      qtd: doMes.length,
      centavos: doMes.reduce((s, c) => s + c.valorCentavos, 0),
    });
  }
  return {
    atrasadasCentavos: atrasadas,
    meses: lista,
    aVencerCentavos: lista.reduce((s, m) => s + m.centavos, 0),
  };
}

// --- Pagamento da equipe --------------------------------------------------------------

export interface ParametrosPagamentoEquipe {
  /** Valor da hora quando a profissional não tem o próprio. */
  valorHoraPadraoCentavos: number | null;
  /** Bloco de visitas que uma ajuda de deslocamento cobre. */
  diasPorAjuda: number | null;
}

export interface EntradaPagamentoEquipe {
  visitas: number;
  horasPorVisita: number;
  valorHoraProfissionalCentavos: number | null;
  ajudaDeslocamentoProfissionalCentavos: number;
  evolucoesEnviadas: boolean;
  parametros: ParametrosPagamentoEquipe;
}

export interface ResultadoPagamentoCalculado {
  horas: number;
  valorHoraCentavos: number | null;
  valorHorasCentavos: number;
  ajudaDeslocamentoCentavos: number;
  totalCentavos: number;
  status: Exclude<StatusPagamentoEquipe, "pago">;
  motivoBloqueio: MotivoBloqueioPagamento | null;
}

/**
 * Horas por visita vezes valor da hora, mais a ajuda de deslocamento
 * (adicional da profissional × visitas ÷ dias por ajuda). Liberado só com
 * todas as evoluções do acompanhamento enviadas (PRD 3.4).
 */
export function calcularPagamentoEquipe(
  e: EntradaPagamentoEquipe,
): ResultadoPagamentoCalculado {
  const valorHora =
    e.valorHoraProfissionalCentavos ?? e.parametros.valorHoraPadraoCentavos;
  const horas = e.visitas * e.horasPorVisita;
  const valorHoras = valorHora === null ? 0 : Math.round(horas * valorHora);
  const ajuda =
    e.ajudaDeslocamentoProfissionalCentavos > 0 &&
    (e.parametros.diasPorAjuda ?? 0) > 0
      ? Math.round(
          (e.ajudaDeslocamentoProfissionalCentavos * e.visitas) /
            (e.parametros.diasPorAjuda as number),
        )
      : 0;
  const bloqueio: MotivoBloqueioPagamento | null =
    valorHora === null
      ? "sem_valor_hora"
      : !e.evolucoesEnviadas
        ? "evolucao_nao_enviada"
        : null;
  return {
    horas,
    valorHoraCentavos: valorHora,
    valorHorasCentavos: valorHoras,
    ajudaDeslocamentoCentavos: ajuda,
    totalCentavos: valorHoras + ajuda,
    status: bloqueio ? "bloqueado" : "liberado",
    motivoBloqueio: bloqueio,
  };
}

export interface RelatorioParaPagamento {
  tipo: "puerperal" | "neonatal";
  bebeId: string | null;
  enviado: boolean;
}

/** A puerperal e uma neonatal por bebê da família, todas enviadas. */
export function evolucoesEnviadas(
  relatorios: RelatorioParaPagamento[],
  bebes: string[],
): boolean {
  const enviados = relatorios.filter((r) => r.enviado);
  return (
    enviados.some((r) => r.tipo === "puerperal") &&
    bebes.every((b) =>
      enviados.some((r) => r.tipo === "neonatal" && r.bebeId === b),
    )
  );
}

// --- Conferência com o extrato --------------------------------------------------------

export interface LinhaParaConferir extends LinhaExtratoEntrada {
  id: string;
  situacao: SituacaoExtrato;
  cobrancaId: string | null;
  despesaId: string | null;
}

export interface ParametrosExtrato {
  janelaDias: number;
  janelaSugestaoDias: number;
}

/**
 * Procura o par de cada linha ainda não conferida. Crédito: cobrança paga com
 * o mesmo valor perto da data (conferida) ou cobrança em aberto com o mesmo
 * valor (sugerida). Débito: despesa com o mesmo valor perto da data.
 * Cada cobrança e cada despesa casa com uma linha só. Nunca altera cobrança:
 * a baixa é só pelo webhook ou pela baixa manual (D-07).
 */
export function conciliarExtrato(
  linhas: LinhaParaConferir[],
  cobrancas: CobrancaBase[],
  despesas: DespesaBase[],
  p: ParametrosExtrato,
): Conferencia {
  const resultado: Conferencia = {
    conferidas: 0,
    sugeridas: 0,
    semCorrespondencia: 0,
  };
  const ordenadas = linhas
    .filter((l) => l.situacao !== "conferida")
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  for (const l of ordenadas) {
    let alvo: { cobranca?: string; despesa?: string } | null = null;
    let situacao: SituacaoExtrato = "sem_correspondencia";
    const usadaPorOutra = (campo: "cobrancaId" | "despesaId", id: string) =>
      linhas.some((o) => o.id !== l.id && o[campo] === id);

    if (l.valorCentavos > 0) {
      const paga = cobrancas
        .filter(
          (c) =>
            c.status === "paga" &&
            valorRecebido(c) === l.valorCentavos &&
            Math.abs(
              diferencaEmDias(l.data, diaDoPagamento(c) ?? "1970-01-01"),
            ) <= p.janelaDias &&
            !linhas.some(
              (o) =>
                o.id !== l.id &&
                o.cobrancaId === c.id &&
                o.situacao === "conferida",
            ),
        )
        .sort(
          (a, b) =>
            Math.abs(diferencaEmDias(l.data, diaDoPagamento(a) ?? l.data)) -
              Math.abs(diferencaEmDias(l.data, diaDoPagamento(b) ?? l.data)) ||
            a.id.localeCompare(b.id),
        )[0];
      if (paga) {
        alvo = { cobranca: paga.id };
        situacao = "conferida";
      } else {
        const aberta = cobrancas
          .filter(
            (c) =>
              EM_ABERTO.includes(c.status) &&
              c.valorCentavos === l.valorCentavos &&
              l.data >= somarDias(c.vencimento, -p.janelaDias) &&
              l.data <= somarDias(c.vencimento, p.janelaSugestaoDias) &&
              !usadaPorOutra("cobrancaId", c.id),
          )
          .sort(
            (a, b) =>
              Math.abs(diferencaEmDias(a.vencimento, l.data)) -
                Math.abs(diferencaEmDias(b.vencimento, l.data)) ||
              a.id.localeCompare(b.id),
          )[0];
        if (aberta) {
          alvo = { cobranca: aberta.id };
          situacao = "sugerida";
        }
      }
    } else {
      const desp = despesas
        .filter(
          (d) =>
            !d.removida &&
            d.valorCentavos === -l.valorCentavos &&
            Math.abs(diferencaEmDias(d.data, l.data)) <= p.janelaDias &&
            !usadaPorOutra("despesaId", d.id),
        )
        .sort(
          (a, b) =>
            Math.abs(diferencaEmDias(a.data, l.data)) -
              Math.abs(diferencaEmDias(b.data, l.data)) ||
            a.id.localeCompare(b.id),
        )[0];
      if (desp) {
        alvo = { despesa: desp.id };
        situacao = "conferida";
      }
    }
    l.situacao = situacao;
    l.cobrancaId = alvo?.cobranca ?? null;
    l.despesaId = alvo?.despesa ?? null;
    if (situacao === "conferida") resultado.conferidas += 1;
    else if (situacao === "sugerida") resultado.sugeridas += 1;
    else resultado.semCorrespondencia += 1;
  }
  return resultado;
}
