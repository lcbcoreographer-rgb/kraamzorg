import type { DadoColuna } from "@/components/graficos/colunas";
import type { PainelExecutivo } from "@/lib/dados/tipos-gestao";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import type { MetaProgresso } from "@/lib/gestao/painel";
import {
  compararComAnterior,
  dataCurta,
  formatarPct,
  nomeMes,
  rotuloMes,
} from "@/lib/gestao/formato";
import { somarMeses } from "@/lib/gestao/financeiro";
import {
  ROTULO_COBERTURA,
  ROTULO_NIVEL,
  ESTADO_DA_COLUNA,
  faixaDaSemana,
} from "@/modules/operacao/capacidade/textos";

/**
 * Textos do painel executivo (P52). Cada pergunta da diretoria tem uma frase
 * que responde antes dos números (voz.md, seção 5), e cada número compara com
 * o mês anterior ou com a meta. Nada de meta, prazo ou limite escrito aqui:
 * tudo chega de `parametro`.
 */

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export const PERGUNTAS: Record<
  "comercial" | "marketing" | "operacao" | "experiencia" | "financeiro",
  string
> = {
  comercial: "Como está a venda?",
  marketing: "De onde vêm as famílias e quanto custa trazê-las?",
  operacao: "Como está a operação?",
  experiencia: "Como as famílias estão vivendo o cuidado?",
  financeiro: "Como está o dinheiro?",
};

/** Frase de abertura da tela: o mês, as metas e o congelamento. */
export function fraseDoPainel(p: PainelExecutivo): string {
  const c = p.comercial;
  const meta = p.metas;
  const partes = [
    `${rotuloMes(p.mes)}: ${plural(c.contratosAssinados, "contrato assinado", "contratos assinados")} de ${meta.contratosMes} e ${formatarMoeda(c.faturamentoCentavos)} de faturamento, para uma meta de ${formatarMoeda(meta.faturamentoMesCentavos)}.`,
  ];
  if (p.congelamento) {
    partes.push(textoDoCongelamento(p.congelamento));
  }
  return partes.join(" ");
}

export function textoDoCongelamento(c: {
  data: string;
  tag: string;
  diasRestantes: number;
}): string {
  const data = formatarData(c.data) ?? c.data;
  if (c.diasRestantes > 1) {
    return `O desenvolvimento congela em ${data}, com a tag ${c.tag}: faltam ${c.diasRestantes} dias.`;
  }
  if (c.diasRestantes === 1) {
    return `O desenvolvimento congela amanhã, ${data}, com a tag ${c.tag}.`;
  }
  if (c.diasRestantes === 0) {
    return `O desenvolvimento congela hoje, ${data}, com a tag ${c.tag}.`;
  }
  return `O desenvolvimento está congelado desde ${data}, com a tag ${c.tag}.`;
}

/** Comparação com o mês anterior, em frase curta. Vazio sem mês anterior. */
export function contraAnterior(
  atual: number,
  anterior: number | null | undefined,
  mesAtual: string,
  formatar?: (n: number) => string,
): string | undefined {
  if (anterior === null || anterior === undefined) return undefined;
  return compararComAnterior(
    atual,
    anterior,
    nomeMes(somarMeses(mesAtual, -1)),
    formatar,
  );
}

export function contraAnteriorPct(
  atual: number | null,
  anterior: number | null | undefined,
  mesAtual: string,
): string | undefined {
  if (atual === null || anterior === null || anterior === undefined) {
    return undefined;
  }
  return compararComAnterior(
    atual,
    anterior,
    nomeMes(somarMeses(mesAtual, -1)),
    (n) => formatarPct(Math.round(n * 10) / 10).replace("%", " pontos"),
  );
}

export function textoDaMeta(m: MetaProgresso): {
  atualTexto: string | null;
  metaTexto: string;
} {
  const fmt = (n: number) =>
    m.unidade === "centavos" ? formatarMoeda(n) : String(n);
  return {
    atualTexto: m.atual === null ? null : fmt(m.atual),
    metaTexto: fmt(m.meta),
  };
}

export function avisoDaMeta(
  m: MetaProgresso,
  amostraMinima: number,
): string | undefined {
  if (m.chave === "nps" && m.atual === null) {
    return `Ainda sem número: o NPS só aparece com pelo menos ${amostraMinima} respostas no mês.`;
  }
  return undefined;
}

export function frasesDeOperacao(p: PainelExecutivo): string {
  const o = p.operacao;
  const partes = [
    `${plural(o.familiasAtivas, "família em atendimento", "famílias em atendimento")} agora`,
    `${plural(o.familiasIniciadas, "começou", "começaram")} o acompanhamento no mês`,
    `${plural(o.visitasRealizadas, "visita realizada", "visitas realizadas")}`,
  ];
  return `${partes.join(", ")}.`;
}

/** Colunas da capacidade de uma região, no formato do gráfico. */
export function colunasDaCapacidade(
  linhas: PainelExecutivo["operacao"]["capacidade"],
): DadoColuna[] {
  return linhas.map((s) => ({
    id: `${s.regiao}-${s.semana}`,
    rotulo: dataCurta(s.semana),
    valor: s.ocupacaoPct,
    estado: ESTADO_DA_COLUNA[s.nivel],
    valorTexto:
      s.nivel === "folga" ? undefined : `${Math.round(s.ocupacaoPct)}%`,
    detalhe: [
      `Semana de ${faixaDaSemana(s.semana)}`,
      `Ocupação de ${formatarPct(s.ocupacaoPct)}`,
      `Chance de passar o limite: ${formatarPct(s.probExcessoPct)}`,
      ROTULO_COBERTURA[s.cobertura],
      ROTULO_NIVEL[s.nivel],
    ],
  }));
}

export function fraseDeFinanceiro(p: PainelExecutivo): string {
  const f = p.financeiro;
  if (f.recebimentosCentavos === 0 && f.custosCentavos === 0) {
    return `Ainda não há recebimento nem custo lançados em ${nomeMes(p.mes)}.`;
  }
  return `Em ${nomeMes(p.mes)} entraram ${formatarMoeda(f.recebimentosCentavos)} e saíram ${formatarMoeda(f.custosCentavos)}${
    f.margemPct !== null ? `, com margem de ${formatarPct(f.margemPct)}` : ""
  }.`;
}

export function fraseDeExperiencia(p: PainelExecutivo): string {
  const e = p.experiencia;
  if (e.nps === null) {
    return `${plural(e.respostas, "resposta da pesquisa", "respostas da pesquisa")} neste mês. O NPS aparece a partir de ${e.amostraMinima} respostas, porque uma porcentagem sobre poucas famílias engana.`;
  }
  return `NPS de ${e.nps} com ${plural(e.respostas, "resposta", "respostas")}: ${plural(e.promotores, "promotor", "promotores")} e ${plural(e.detratores, "detrator", "detratores")}.`;
}
