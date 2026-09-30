import { dataEmBrasilia, diferencaEmDias } from "@/lib/agenda/datas";
import type {
  CoberturaBackup,
  Congelamento,
  MetasKraamzorg,
  NivelCapacidade,
  OrigemLead,
  PainelComercial,
  PainelExecutivo,
  PainelExperiencia,
  PainelFinanceiro,
  PainelMarketing,
  PainelOperacao,
  ProgressoMetas,
} from "@/lib/dados/tipos-gestao";
import {
  calcularDre,
  calcularInadimplencia,
  calcularPrevisao,
  inicioDoMes,
  somarMeses,
  type CobrancaBase,
  type DespesaBase,
} from "./financeiro";

/**
 * Painel executivo (P52, PRD 16.2, Fase 3): as cinco perguntas da diretoria.
 * Cada número tem a consulta documentada em docs/painel/consultas.md, a
 * função privado.painel_* que a executa no banco (0026_gestao.sql) e o teste
 * que a confere contra a tabela de origem (pgTAP 026 e painel.test.ts).
 * Este arquivo tem as duas coisas do lado do app: o registro dos indicadores
 * e a mesma conta em TypeScript, usada pelo modo demonstração.
 */

export type SecaoPainel =
  "comercial" | "marketing" | "operacao" | "experiencia" | "financeiro";

export type UnidadeIndicador =
  "numero" | "centavos" | "percentual" | "lista" | "texto";

export interface Indicador {
  /** `secao.chave`, igual ao que api.painel_executivo devolve. */
  id: string;
  secao: SecaoPainel;
  chave: string;
  rotulo: string;
  unidade: UnidadeIndicador;
  /** Frase que diz o que o número conta. */
  definicao: string;
  /** Função do banco que calcula o número. */
  consulta: string;
  /** Tela onde o mesmo número aparece (nula quando a tela ainda não existe). */
  tela: { rotulo: string; href: string } | null;
}

function ind(
  secao: SecaoPainel,
  chave: string,
  rotulo: string,
  unidade: UnidadeIndicador,
  definicao: string,
  consulta: string,
  tela: Indicador["tela"],
): Indicador {
  return {
    id: `${secao}.${chave}`,
    secao,
    chave,
    rotulo,
    unidade,
    definicao,
    consulta,
    tela,
  };
}

const PIPELINE = { rotulo: "Pipeline", href: "/pipeline" };
const SESSOES = { rotulo: "Sessões de venda", href: "/sessoes-venda" };
const FINANCEIRO = { rotulo: "Financeiro", href: "/financeiro" };
const CAPACIDADE = { rotulo: "Capacidade", href: "/capacidade" };
const AGENDA = { rotulo: "Agenda", href: "/agenda" };

/** Todos os números do painel, na ordem em que a tela mostra. */
export const INDICADORES: readonly Indicador[] = [
  ind(
    "comercial",
    "leads",
    "Leads novos",
    "numero",
    "Famílias criadas no mês, sem as mescladas.",
    "privado.painel_comercial",
    PIPELINE,
  ),
  ind(
    "comercial",
    "sessoes_realizadas",
    "Sessões realizadas",
    "numero",
    "Sessões de venda com status realizada e data de realização no mês.",
    "privado.painel_comercial",
    SESSOES,
  ),
  ind(
    "comercial",
    "contratos_assinados",
    "Contratos assinados",
    "numero",
    "Contratos com status assinado e data de assinatura no mês.",
    "privado.painel_comercial",
    PIPELINE,
  ),
  ind(
    "comercial",
    "conversao_pct",
    "Conversão",
    "percentual",
    "Contratos assinados no mês sobre leads novos do mês.",
    "privado.painel_comercial",
    PIPELINE,
  ),
  ind(
    "comercial",
    "faturamento_centavos",
    "Faturamento",
    "centavos",
    "Valor menos desconto mais taxa de deslocamento dos contratos assinados no mês.",
    "privado.painel_comercial",
    PIPELINE,
  ),
  ind(
    "comercial",
    "ticket_medio_centavos",
    "Ticket médio",
    "centavos",
    "Faturamento do mês sobre os contratos assinados no mês.",
    "privado.painel_comercial",
    PIPELINE,
  ),
  ind(
    "marketing",
    "leads_por_origem",
    "Leads por origem",
    "lista",
    "Leads novos do mês agrupados pela origem da família.",
    "privado.painel_marketing",
    PIPELINE,
  ),
  ind(
    "marketing",
    "custo_por_canal",
    "Custo por canal",
    "lista",
    "Despesas de marketing e anúncios do mês, por canal informado (sem canal fica à parte).",
    "privado.painel_marketing",
    { rotulo: "Despesas", href: "/financeiro/despesas" },
  ),
  ind(
    "marketing",
    "custo_total_centavos",
    "Custo total de marketing",
    "centavos",
    "Soma das despesas de marketing e anúncios do mês.",
    "privado.painel_marketing",
    { rotulo: "Despesas", href: "/financeiro/despesas" },
  ),
  ind(
    "marketing",
    "receita_por_origem",
    "Receita por origem",
    "lista",
    "Cobranças pagas no mês, agrupadas pela origem da família.",
    "privado.painel_marketing",
    FINANCEIRO,
  ),
  ind(
    "marketing",
    "receita_por_campanha",
    "Receita por campanha",
    "lista",
    "Cobranças pagas no mês, agrupadas pelo código de origem do link.",
    "privado.painel_marketing",
    FINANCEIRO,
  ),
  ind(
    "operacao",
    "familias_ativas",
    "Famílias ativas",
    "numero",
    "Famílias com acompanhamento em atendimento hoje.",
    "privado.painel_operacao",
    AGENDA,
  ),
  ind(
    "operacao",
    "familias_iniciadas",
    "Famílias que iniciaram",
    "numero",
    "Famílias cujo acompanhamento começou no mês (início efetivo).",
    "privado.painel_operacao",
    AGENDA,
  ),
  ind(
    "operacao",
    "visitas_realizadas",
    "Visitas realizadas",
    "numero",
    "Visitas concluídas com data no mês.",
    "privado.painel_operacao",
    AGENDA,
  ),
  ind(
    "operacao",
    "ocorrencias_abertas",
    "Ocorrências abertas",
    "numero",
    "Ocorrências que ainda não foram resolvidas nem encerradas, hoje.",
    "privado.painel_operacao",
    null,
  ),
  ind(
    "operacao",
    "capacidade_semanas",
    "Semanas da capacidade",
    "numero",
    "Quantas semanas a capacidade mostra (parâmetro).",
    "privado.painel_operacao",
    CAPACIDADE,
  ),
  ind(
    "operacao",
    "capacidade",
    "Capacidade das próximas semanas",
    "lista",
    "Ocupação, probabilidade de sobrevenda e cobertura de backup por região e semana.",
    "privado.capacidade_semanal",
    CAPACIDADE,
  ),
  ind(
    "operacao",
    "semanas_em_sobrevenda",
    "Semanas em sobrevenda",
    "numero",
    "Semanas das próximas semanas com probabilidade de sobrevenda acima do limite.",
    "privado.capacidade_semanal",
    CAPACIDADE,
  ),
  ind(
    "operacao",
    "semanas_em_atencao",
    "Semanas em atenção",
    "numero",
    "Semanas com ocupação acima do alerta ou cobertura de backup sem reserva.",
    "privado.capacidade_semanal",
    CAPACIDADE,
  ),
  ind(
    "experiencia",
    "respostas",
    "Respostas da pesquisa",
    "numero",
    "Pesquisas respondidas no mês com nota e classificação.",
    "privado.painel_experiencia",
    null,
  ),
  ind(
    "experiencia",
    "promotores",
    "Promotores",
    "numero",
    "Respostas classificadas como promotor no mês.",
    "privado.painel_experiencia",
    null,
  ),
  ind(
    "experiencia",
    "detratores",
    "Detratores",
    "numero",
    "Respostas classificadas como detrator no mês.",
    "privado.painel_experiencia",
    null,
  ),
  ind(
    "experiencia",
    "amostra_minima",
    "Amostra mínima do NPS",
    "numero",
    "Menor número de respostas para o NPS aparecer como número (parâmetro).",
    "privado.painel_experiencia",
    null,
  ),
  ind(
    "experiencia",
    "nps",
    "NPS",
    "numero",
    "Promotores menos detratores sobre as respostas do mês; sem a amostra mínima não é calculado.",
    "privado.painel_experiencia",
    null,
  ),
  ind(
    "experiencia",
    "indicacoes",
    "Indicações",
    "numero",
    "Famílias que chegaram no mês por indicação (médica, de cliente ou de amigo).",
    "privado.painel_experiencia",
    PIPELINE,
  ),
  ind(
    "experiencia",
    "depoimentos",
    "Depoimentos autorizados",
    "numero",
    "Pesquisas respondidas no mês com autorização de depoimento.",
    "privado.painel_experiencia",
    null,
  ),
  ind(
    "financeiro",
    "recebimentos_centavos",
    "Recebimentos",
    "centavos",
    "Cobranças pagas no mês (receita do DRE em regime de caixa).",
    "privado.dre_mes",
    FINANCEIRO,
  ),
  ind(
    "financeiro",
    "custos_centavos",
    "Custos",
    "centavos",
    "Despesas do mês, sem as removidas (DRE).",
    "privado.dre_mes",
    FINANCEIRO,
  ),
  ind(
    "financeiro",
    "resultado_centavos",
    "Resultado",
    "centavos",
    "Recebimentos menos custos do mês (DRE).",
    "privado.dre_mes",
    FINANCEIRO,
  ),
  ind(
    "financeiro",
    "margem_pct",
    "Margem",
    "percentual",
    "Resultado sobre recebimentos do mês; sem recebimento não há margem.",
    "privado.dre_mes",
    FINANCEIRO,
  ),
  ind(
    "financeiro",
    "inadimplencia_pct",
    "Inadimplência",
    "percentual",
    "Vencido em aberto sobre o que já venceu ou foi pago, hoje.",
    "privado.inadimplencia_resumo",
    FINANCEIRO,
  ),
  ind(
    "financeiro",
    "vencido_centavos",
    "Vencido em aberto",
    "centavos",
    "Cobranças em aberto com vencimento passado, hoje.",
    "privado.inadimplencia_resumo",
    FINANCEIRO,
  ),
  ind(
    "financeiro",
    "previsao_a_vencer_centavos",
    "Previsão a receber",
    "centavos",
    "Cobranças em aberto que vencem de hoje até o fim do último mês da previsão.",
    "privado.previsao_recebimentos",
    FINANCEIRO,
  ),
  ind(
    "financeiro",
    "previsao_atrasadas_centavos",
    "Atrasadas na previsão",
    "centavos",
    "Cobranças em aberto que já venceram (mesmo número do vencido).",
    "privado.previsao_recebimentos",
    FINANCEIRO,
  ),
  ind(
    "financeiro",
    "faturamento_centavos",
    "Faturamento do mês",
    "centavos",
    "O mesmo faturamento do comercial: contratos assinados no mês.",
    "privado.painel_comercial",
    PIPELINE,
  ),
];

export function indicadorPorId(id: string): Indicador | undefined {
  return INDICADORES.find((i) => i.id === id);
}

/** As chaves que cada seção do painel devolve, para conferir contra o banco. */
export function chavesDaSecao(secao: SecaoPainel): string[] {
  return INDICADORES.filter((i) => i.secao === secao).map((i) => i.chave);
}

// --- Metas ------------------------------------------------------------------------------

export interface MetaProgresso {
  chave: "contratos" | "familias" | "faturamento" | "nps";
  rotulo: string;
  atual: number | null;
  meta: number;
  unidade: "numero" | "centavos";
  /** 0 a 1, limitado a 1; nulo sem número atual. */
  fracao: number | null;
}

export function progressoDasMetas(
  metas: MetasKraamzorg,
  progresso: ProgressoMetas,
): MetaProgresso[] {
  const fracao = (atual: number | null, meta: number) =>
    atual === null || meta <= 0 ? null : Math.min(Math.max(atual / meta, 0), 1);
  return [
    {
      chave: "contratos",
      rotulo: "Contratos",
      atual: progresso.contratos,
      meta: metas.contratosMes,
      unidade: "numero",
      fracao: fracao(progresso.contratos, metas.contratosMes),
    },
    {
      chave: "familias",
      rotulo: "Famílias",
      atual: progresso.familias,
      meta: metas.familiasMes,
      unidade: "numero",
      fracao: fracao(progresso.familias, metas.familiasMes),
    },
    {
      chave: "faturamento",
      rotulo: "Faturamento",
      atual: progresso.faturamentoCentavos,
      meta: metas.faturamentoMesCentavos,
      unidade: "centavos",
      fracao: fracao(
        progresso.faturamentoCentavos,
        metas.faturamentoMesCentavos,
      ),
    },
    {
      chave: "nps",
      rotulo: "NPS",
      atual: progresso.nps,
      meta: metas.nps,
      unidade: "numero",
      fracao: fracao(progresso.nps, metas.nps),
    },
  ];
}

// --- A conta do painel em TypeScript (modo demonstração e prova cruzada) ------------------

export interface LeadPainel {
  familiaId: string;
  origem: OrigemLead;
  codigoOrigem: string | null;
  criadoEm: string;
  mesclada: boolean;
}

export interface ContratoPainel {
  familiaId: string;
  status: string;
  assinadoEm: string | null;
  totalCentavos: number;
}

export interface CobrancaPainel extends CobrancaBase {
  origem: OrigemLead;
  codigoOrigem: string | null;
}

export interface DespesaPainel extends DespesaBase {
  canal: OrigemLead | null;
}

export interface PesquisaPainel {
  respondidaEm: string | null;
  nps: number | null;
  classificacao: "promotor" | "neutro" | "detrator" | null;
  depoimentoAutorizado: boolean | null;
}

export interface BasePainel {
  hoje: string;
  leads: LeadPainel[];
  sessoes: { status: string; realizadaEm: string | null }[];
  contratos: ContratoPainel[];
  cobrancas: CobrancaPainel[];
  despesas: DespesaPainel[];
  acompanhamentos: {
    familiaId: string;
    estado: string;
    inicioEfetivo: string | null;
  }[];
  visitas: { data: string; estado: string }[];
  ocorrenciasAbertas: number;
  pesquisas: PesquisaPainel[];
  capacidade: {
    regiao: string;
    semana: string;
    ocupacaoPct: number;
    probExcessoPct: number;
    cobertura: CoberturaBackup;
    nivel: NivelCapacidade;
  }[];
  metas: MetasKraamzorg;
  congelamento: { data: string; tag: string } | null;
}

export interface ParametrosPainel {
  npsAmostraMinima: number;
  faixasInadimplenciaDias: number[];
  previsaoMeses: number;
  capacidadeSemanas: number;
  serieMeses: number;
}

const ESTADOS_ATIVOS = [
  "ativo",
  "em_execucao",
  "ultima_visita_realizada",
  "pendencias",
];
const VISITA_REALIZADA = [
  "concluida",
  "ficha_pendente",
  "ficha_entregue",
  "encerrada",
];
const INDICACAO: OrigemLead[] = [
  "indicacao_medica",
  "indicacao_cliente",
  "indicacao_amigo",
];

function noMes(instante: string | null, de: string, fim: string): boolean {
  if (!instante) return false;
  const dia = dataEmBrasilia(instante);
  return dia !== null && dia >= de && dia < fim;
}

function arredondar1(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10) / 10;
}

function agrupar<T, K extends string | null>(
  itens: T[],
  chave: (x: T) => K,
  valor: (x: T) => number,
): { chave: K; total: number }[] {
  const mapa = new Map<K, number>();
  for (const x of itens)
    mapa.set(chave(x), (mapa.get(chave(x)) ?? 0) + valor(x));
  return [...mapa.entries()].map(([k, total]) => ({ chave: k, total }));
}

export function calcularPainel(
  base: BasePainel,
  mesQualquerDia: string,
  p: ParametrosPainel,
  geradoEm: string,
): PainelExecutivo {
  const mes = inicioDoMes(mesQualquerDia);
  const fim = somarMeses(mes, 1);

  // Comercial
  const leads = base.leads.filter(
    (l) => !l.mesclada && noMes(l.criadoEm, mes, fim),
  );
  const contratos = base.contratos.filter(
    (k) => k.status === "assinado" && noMes(k.assinadoEm, mes, fim),
  );
  const faturamento = contratos.reduce((s, k) => s + k.totalCentavos, 0);
  const comercial: PainelComercial = {
    leads: leads.length,
    sessoesRealizadas: base.sessoes.filter(
      (s) => s.status === "realizada" && noMes(s.realizadaEm, mes, fim),
    ).length,
    contratosAssinados: contratos.length,
    conversaoPct:
      leads.length > 0
        ? arredondar1((100 * contratos.length) / leads.length)
        : null,
    faturamentoCentavos: faturamento,
    ticketMedioCentavos:
      contratos.length > 0 ? Math.round(faturamento / contratos.length) : null,
  };

  // Marketing
  const pagasNoMes = base.cobrancas.filter(
    (c) => c.status === "paga" && noMes(c.pagoEm, mes, fim),
  );
  const desMkt = base.despesas.filter(
    (d) =>
      !d.removida &&
      d.categoria === "marketing_anuncios" &&
      d.data >= mes &&
      d.data < fim,
  );
  const ordem = <T extends { total: number }>(a: T, b: T) => b.total - a.total;
  const marketing: PainelMarketing = {
    leadsPorOrigem: agrupar(
      leads,
      (l) => l.origem,
      () => 1,
    )
      .sort(
        (a, b) => ordem(a, b) || String(a.chave).localeCompare(String(b.chave)),
      )
      .map((x) => ({ origem: x.chave as OrigemLead, leads: x.total })),
    custoPorCanal: agrupar(
      desMkt,
      (d) => d.canal,
      (d) => d.valorCentavos,
    )
      .sort(
        (a, b) => ordem(a, b) || String(a.chave).localeCompare(String(b.chave)),
      )
      .map((x) => ({ canal: x.chave, centavos: x.total })),
    custoTotalCentavos: desMkt.reduce((s, d) => s + d.valorCentavos, 0),
    receitaPorOrigem: agrupar(
      pagasNoMes,
      (c) => c.origem,
      (c) => c.valorPagoCentavos ?? c.valorCentavos,
    )
      .sort(
        (a, b) => ordem(a, b) || String(a.chave).localeCompare(String(b.chave)),
      )
      .map((x) => ({ origem: x.chave as OrigemLead, centavos: x.total })),
    receitaPorCampanha: agrupar(
      pagasNoMes.filter((c) => c.codigoOrigem !== null),
      (c) => c.codigoOrigem as string,
      (c) => c.valorPagoCentavos ?? c.valorCentavos,
    )
      .sort(
        (a, b) => ordem(a, b) || String(a.chave).localeCompare(String(b.chave)),
      )
      .map((x) => ({ campanha: x.chave as string, centavos: x.total })),
  };

  // Operação
  const operacao: PainelOperacao = {
    familiasAtivas: new Set(
      base.acompanhamentos
        .filter((a) => ESTADOS_ATIVOS.includes(a.estado))
        .map((a) => a.familiaId),
    ).size,
    familiasIniciadas: new Set(
      base.acompanhamentos
        .filter(
          (a) =>
            a.inicioEfetivo !== null &&
            a.inicioEfetivo >= mes &&
            a.inicioEfetivo < fim,
        )
        .map((a) => a.familiaId),
    ).size,
    visitasRealizadas: base.visitas.filter(
      (v) =>
        VISITA_REALIZADA.includes(v.estado) && v.data >= mes && v.data < fim,
    ).length,
    ocorrenciasAbertas: base.ocorrenciasAbertas,
    capacidadeSemanas: p.capacidadeSemanas,
    capacidade: base.capacidade,
    semanasEmSobrevenda: base.capacidade.filter((c) => c.nivel === "sobrevenda")
      .length,
    semanasEmAtencao: base.capacidade.filter((c) => c.nivel === "atencao")
      .length,
  };

  // Experiência
  const respostas = base.pesquisas.filter(
    (r) =>
      r.nps !== null &&
      r.classificacao !== null &&
      noMes(r.respondidaEm, mes, fim),
  );
  const promotores = respostas.filter(
    (r) => r.classificacao === "promotor",
  ).length;
  const detratores = respostas.filter(
    (r) => r.classificacao === "detrator",
  ).length;
  const experiencia: PainelExperiencia = {
    respostas: respostas.length,
    promotores,
    detratores,
    amostraMinima: p.npsAmostraMinima,
    nps:
      respostas.length >= p.npsAmostraMinima && respostas.length > 0
        ? Math.round((100 * (promotores - detratores)) / respostas.length)
        : null,
    indicacoes: base.leads.filter(
      (l) =>
        !l.mesclada &&
        INDICACAO.includes(l.origem) &&
        noMes(l.criadoEm, mes, fim),
    ).length,
    depoimentos: base.pesquisas.filter(
      (r) => r.depoimentoAutorizado === true && noMes(r.respondidaEm, mes, fim),
    ).length,
  };

  // Financeiro
  const dre = calcularDre(base.cobrancas, base.despesas, mes, p.serieMeses);
  const inad = calcularInadimplencia(
    base.cobrancas,
    base.hoje,
    p.faixasInadimplenciaDias,
  );
  const previsao = calcularPrevisao(base.cobrancas, base.hoje, p.previsaoMeses);
  const financeiro: PainelFinanceiro = {
    recebimentosCentavos: dre.receitaCentavos,
    custosCentavos: dre.despesasCentavos,
    resultadoCentavos: dre.resultadoCentavos,
    margemPct: dre.margemPct,
    inadimplenciaPct: inad.taxaPct,
    vencidoCentavos: inad.vencidoCentavos,
    previsaoAVencerCentavos: previsao.aVencerCentavos,
    previsaoAtrasadasCentavos: previsao.atrasadasCentavos,
    faturamentoCentavos: faturamento,
  };

  const congelamento: Congelamento | null = base.congelamento
    ? {
        data: base.congelamento.data,
        tag: base.congelamento.tag,
        diasRestantes: diferencaEmDias(base.hoje, base.congelamento.data),
      }
    : null;

  return {
    geradoEm,
    mes,
    metas: base.metas,
    progresso: {
      contratos: comercial.contratosAssinados,
      familias: operacao.familiasIniciadas,
      faturamentoCentavos: faturamento,
      nps: experiencia.nps,
    },
    congelamento,
    comercial,
    marketing,
    operacao,
    experiencia,
    financeiro,
  };
}
