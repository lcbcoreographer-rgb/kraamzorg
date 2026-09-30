import { somarDias } from "@/lib/agenda/datas";
import type { ConfigDistribuicao } from "@/lib/gestao/capacidade";
import {
  inicioDoMes,
  somarMeses,
  type RelatorioParaPagamento,
} from "@/lib/gestao/financeiro";
import type { CategoriaDespesa, OrigemLead } from "../tipos-gestao";
import { USUARIOS } from "./fixtures";

/**
 * Dados fictícios da gestão (P45, P46 e P52) para o modo demonstração.
 * Os parâmetros são cópia de supabase/dados/gestao_seed.sql (o teste
 * gestao.test.ts confere a paridade). Nomes de família só com "Teste"; nenhum
 * dado real. As datas nascem de `hoje`, para as telas sempre mostrarem as
 * próximas semanas.
 */

export const PARAMETROS_GESTAO = {
  capacidadeAlertaPct: 85,
  sobrevendaProbPct: 10,
  capacidadeSemanasPainel: 8,
  backupReservaProfissionais: 1,
  visitasPorDia: 2,
  distribuicao: {
    versao: "referencia-2026-09",
    descricao:
      "Distribuição de referência do nascimento em relação à DPP (dias antes ou depois de 40 semanas). Proposta do desenho do P45, sem fonte citada: concentra os nascimentos entre 38 e 40 semanas, com cauda de pré-termo tardio e de pós-data. Vale só até haver histórico próprio; a Edilaine e o Leonardo validam ou trocam os pesos [confirmar: Edilaine e Leonardo].",
    historicoMinimo: 30,
    deslocamentoInicioDias: 2,
    intervaloProvavelPct: 95,
    faixas: [
      { de: -56, ate: -43, peso: 1.5 },
      { de: -42, ate: -22, peso: 6.5 },
      { de: -21, ate: -15, peso: 10 },
      { de: -14, ate: -8, peso: 20 },
      { de: -7, ate: -1, peso: 27 },
      { de: 0, ate: 6, peso: 22 },
      { de: 7, ate: 13, peso: 10 },
      { de: 14, ate: 20, peso: 3 },
    ],
  },
  pagamentoEquipe: { valorHoraPadraoCentavos: 10000, diasPorAjuda: 6 },
  financeiro: {
    janelaExtratoDias: 3,
    janelaSugestaoDias: 30,
    extratoMaxLinhas: 2000,
    faixasInadimplenciaDias: [7, 30],
    previsaoMeses: 3,
    serieMeses: 6,
    despesaMaxCentavos: 100000000,
  },
  metas: {
    contratosMes: 18,
    familiasMes: 18,
    faturamentoMesCentavos: 7560000,
    nps: 90,
  },
  painel: { npsAmostraMinima: 5 },
  congelamento: { data: "2026-11-13", tag: "v1.0.0-rc.1" },
} as const;

export const CONFIG_DISTRIBUICAO: ConfigDistribuicao = {
  versao: PARAMETROS_GESTAO.distribuicao.versao,
  descricao: PARAMETROS_GESTAO.distribuicao.descricao,
  historicoMinimo: PARAMETROS_GESTAO.distribuicao.historicoMinimo,
  deslocamentoInicioDias: PARAMETROS_GESTAO.distribuicao.deslocamentoInicioDias,
  faixas: PARAMETROS_GESTAO.distribuicao.faixas.map((f) => ({ ...f })),
};

// --- Estrutura da loja ----------------------------------------------------------------

export interface RegiaoDemo {
  id: string;
  nome: string;
  limiteFamilias: number;
}

export interface ProfissionalGestaoDemo {
  id: string;
  usuarioId: string | null;
  nome: string;
  regioes: string[];
  valorHoraCentavos: number | null;
  ajudaDeslocamentoCentavos: number;
  bloqueios: { inicio: string; fim: string }[];
}

export interface AcompanhamentoGestaoDemo {
  id: string;
  familiaId: string;
  familiaNome: string;
  estado: string;
  horasPorVisita: number;
  diasContratados: number;
  inicioEfetivo: string | null;
  bebes: string[];
  relatorios: RelatorioParaPagamento[];
  /** Visitas realizadas, uma por linha, com quem fez. */
  visitas: { profissionalId: string; data: string }[];
}

export interface ContratoCapacidadeDemo {
  familiaId: string;
  regiaoId: string;
  dias: number;
  inicioFato: string | null;
  dpp: string | null;
  dataNascimento: string | null;
}

export interface FamiliaGestaoDemo {
  id: string;
  nome: string;
  origem: OrigemLead;
  codigoOrigem: string | null;
  criadoEm: string;
  mesclada: boolean;
}

export interface PesquisaDemo {
  acompanhamentoId: string;
  respondidaEm: string;
  nps: number;
  classificacao: "promotor" | "neutro" | "detrator";
  depoimentoAutorizado: boolean;
}

export interface CobrancaDemoGestao {
  id: string;
  contratoId: string;
  familiaId: string;
  familiaNome: string;
  parcela: number;
  valorCentavos: number;
  vencimento: string;
  status: "aberta" | "vencida" | "paga" | "cancelada" | "estornada";
  pagoEm: string | null;
  valorPagoCentavos: number | null;
}

export interface DespesaDemoGestao {
  id: string;
  data: string;
  categoria: CategoriaDespesa;
  descricao: string;
  fornecedor: string | null;
  valorCentavos: number;
  canal: OrigemLead | null;
  pagamentoEquipeId: string | null;
  removida: boolean;
  removidaMotivo: string | null;
}

export interface ContratoComercialDemo {
  familiaId: string;
  status: string;
  assinadoEm: string | null;
  totalCentavos: number;
}

export interface SessaoDemo {
  familiaId: string;
  status: string;
  realizadaEm: string | null;
}

export interface DadosGestaoDemo {
  hoje: string;
  regioes: RegiaoDemo[];
  profissionais: ProfissionalGestaoDemo[];
  contratosCapacidade: ContratoCapacidadeDemo[];
  familias: FamiliaGestaoDemo[];
  contratos: ContratoComercialDemo[];
  sessoes: SessaoDemo[];
  acompanhamentos: AcompanhamentoGestaoDemo[];
  visitas: { data: string; estado: string }[];
  pesquisas: PesquisaDemo[];
  cobrancas: CobrancaDemoGestao[];
  despesas: DespesaDemoGestao[];
  ocorrenciasAbertas: number;
}

export const ID_REGIAO_SP = "00000000-0000-4000-8a00-000000000001";
export const ID_REGIAO_LONDRINA = "00000000-0000-4000-8a00-000000000002";

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8a${String(grupo).padStart(2, "0")}-${String(n).padStart(12, "0")}`;

export const ID_PROF_ALFA = id(1, 1);
export const ID_PROF_BETA = id(1, 2);
export const ID_PROF_GAMA = id(1, 3);
export const ID_PROF_DELTA = id(1, 4);
export const ID_PROF_LONDRINA = id(1, 5);

export const ID_ACOMP_LIBERADO = id(2, 1);
export const ID_ACOMP_BLOQUEADO = id(2, 2);
export const ID_ACOMP_PAGO = id(2, 3);

/** Instante ISO ao meio-dia de Brasília (UTC-3) do dia informado. */
function meioDia(dia: string): string {
  return `${dia}T15:00:00.000Z`;
}

/** Monta os dados fictícios a partir de "hoje" (aaaa-mm-dd). */
export function criarDadosGestaoDemo(hoje: string): DadosGestaoDemo {
  const mesAtual = inicioDoMes(hoje);
  const mesAnterior = somarMeses(mesAtual, -1);
  const doisMeses = somarMeses(mesAtual, -2);
  const dia = (mes: string, n: number) => somarDias(mes, n - 1);
  const usuarioEnfermeira =
    USUARIOS.find((u) => u.papeis.includes("enfermeira"))?.id ?? null;

  const regioes: RegiaoDemo[] = [
    { id: ID_REGIAO_SP, nome: "São Paulo", limiteFamilias: 5 },
    { id: ID_REGIAO_LONDRINA, nome: "Londrina", limiteFamilias: 3 },
  ];

  const profissionais: ProfissionalGestaoDemo[] = [
    {
      id: ID_PROF_ALFA,
      usuarioId: usuarioEnfermeira,
      nome: "Enfermeira Teste Alfa",
      regioes: [ID_REGIAO_SP],
      valorHoraCentavos: null,
      ajudaDeslocamentoCentavos: 10000,
      bloqueios: [],
    },
    {
      id: ID_PROF_BETA,
      usuarioId: null,
      nome: "Enfermeira Teste Beta",
      regioes: [ID_REGIAO_SP],
      valorHoraCentavos: 12000,
      ajudaDeslocamentoCentavos: 0,
      bloqueios: [],
    },
    {
      id: ID_PROF_GAMA,
      usuarioId: null,
      nome: "Enfermeira Teste Gama",
      regioes: [ID_REGIAO_SP],
      valorHoraCentavos: null,
      ajudaDeslocamentoCentavos: 0,
      bloqueios: [{ inicio: somarDias(hoje, 20), fim: somarDias(hoje, 33) }],
    },
    {
      id: ID_PROF_DELTA,
      usuarioId: null,
      nome: "Enfermeira Teste Delta",
      regioes: [ID_REGIAO_SP],
      valorHoraCentavos: null,
      ajudaDeslocamentoCentavos: 0,
      bloqueios: [],
    },
    {
      id: ID_PROF_LONDRINA,
      usuarioId: null,
      nome: "Enfermeira Teste Londrina",
      regioes: [ID_REGIAO_LONDRINA],
      valorHoraCentavos: null,
      ajudaDeslocamentoCentavos: 0,
      bloqueios: [],
    },
  ];

  // Capacidade: Londrina com seis DPPs na mesma semana e meia num limite de três
  // (sobrevenda provável) e uma só profissional; São Paulo com famílias espalhadas.
  const contratosCapacidade: ContratoCapacidadeDemo[] = [
    ...[20, 21, 22, 24, 25, 27].map((d, i) => ({
      familiaId: id(3, 100 + i),
      regiaoId: ID_REGIAO_LONDRINA,
      dias: 6,
      inicioFato: null,
      dpp: somarDias(hoje, d),
      dataNascimento: null,
    })),
    ...[9, 15, 19, 28, 37, 44].map((d, i) => ({
      familiaId: id(3, 200 + i),
      regiaoId: ID_REGIAO_SP,
      dias: i % 2 === 0 ? 6 : 12,
      inicioFato: null,
      dpp: somarDias(hoje, d),
      dataNascimento: null,
    })),
    {
      familiaId: id(3, 300),
      regiaoId: ID_REGIAO_SP,
      dias: 6,
      inicioFato: somarDias(hoje, 1),
      dpp: somarDias(hoje, -14),
      dataNascimento: somarDias(hoje, -12),
    },
  ];

  const acompanhamentos: AcompanhamentoGestaoDemo[] = [
    {
      id: ID_ACOMP_LIBERADO,
      familiaId: id(4, 1),
      familiaNome: "Família Teste Aurora",
      estado: "encerrado",
      horasPorVisita: 3,
      diasContratados: 6,
      inicioEfetivo: dia(mesAnterior, 20),
      bebes: [id(5, 1)],
      relatorios: [
        { tipo: "puerperal", bebeId: null, enviado: true },
        { tipo: "neonatal", bebeId: id(5, 1), enviado: true },
      ],
      visitas: [1, 2, 3, 4]
        .map((n) => ({
          profissionalId: ID_PROF_ALFA,
          data: dia(mesAnterior, 20 + n),
        }))
        .concat(
          [5, 6].map((n) => ({
            profissionalId: ID_PROF_BETA,
            data: dia(mesAnterior, 20 + n),
          })),
        ),
    },
    {
      id: ID_ACOMP_BLOQUEADO,
      familiaId: id(4, 2),
      familiaNome: "Família Teste Brisa",
      estado: "ultima_visita_realizada",
      horasPorVisita: 6,
      diasContratados: 6,
      inicioEfetivo: somarDias(hoje, -7),
      bebes: [id(5, 2), id(5, 3)],
      relatorios: [
        { tipo: "puerperal", bebeId: null, enviado: true },
        { tipo: "neonatal", bebeId: id(5, 2), enviado: true },
        { tipo: "neonatal", bebeId: id(5, 3), enviado: false },
      ],
      visitas: [1, 2, 3, 4, 5, 6].map((n) => ({
        profissionalId: ID_PROF_ALFA,
        data: somarDias(hoje, -8 + n),
      })),
    },
    {
      id: ID_ACOMP_PAGO,
      familiaId: id(4, 3),
      familiaNome: "Família Teste Cecília",
      estado: "encerrado",
      horasPorVisita: 3,
      diasContratados: 6,
      inicioEfetivo: dia(doisMeses, 18),
      bebes: [id(5, 4)],
      relatorios: [
        { tipo: "puerperal", bebeId: null, enviado: true },
        { tipo: "neonatal", bebeId: id(5, 4), enviado: true },
      ],
      visitas: [1, 2, 3, 4, 5, 6].map((n) => ({
        profissionalId: ID_PROF_BETA,
        data: dia(doisMeses, 18 + n),
      })),
    },
  ];

  // Comercial e marketing do mês: leads por origem, sessões, contratos e a pesquisa
  const origens: [OrigemLead, string | null][] = [
    ["meta_ads", "wa-anuncio-01"],
    ["meta_ads", "wa-anuncio-01"],
    ["instagram_organico", "wa-bio"],
    ["instagram_organico", "wa-bio"],
    ["instagram_organico", null],
    ["google", null],
    ["site", "wa-site"],
    ["indicacao_amigo", null],
    ["indicacao_medica", null],
    ["indicacao_cliente", null],
  ];
  const familias: FamiliaGestaoDemo[] = origens.map(
    ([origem, codigoOrigem], i) => ({
      id: id(6, i + 1),
      nome: `Família Teste Lead ${i + 1}`,
      origem,
      codigoOrigem,
      criadoEm: meioDia(dia(mesAtual, 1 + i)),
      mesclada: false,
    }),
  );
  const contratos: ContratoComercialDemo[] = [
    {
      familiaId: id(6, 1),
      status: "assinado",
      assinadoEm: meioDia(dia(mesAtual, 3)),
      totalCentavos: 420000,
    },
    {
      familiaId: id(6, 3),
      status: "assinado",
      assinadoEm: meioDia(dia(mesAtual, 5)),
      totalCentavos: 780000,
    },
    {
      familiaId: id(6, 4),
      status: "assinado",
      assinadoEm: meioDia(dia(mesAtual, 7)),
      totalCentavos: 455000,
    },
    {
      familiaId: id(6, 7),
      status: "assinado",
      assinadoEm: meioDia(dia(mesAtual, 9)),
      totalCentavos: 810000,
    },
    {
      familiaId: id(6, 8),
      status: "rascunho",
      assinadoEm: null,
      totalCentavos: 420000,
    },
    {
      familiaId: id(4, 1),
      status: "assinado",
      assinadoEm: meioDia(dia(mesAnterior, 10)),
      totalCentavos: 420000,
    },
  ];
  const sessoes: SessaoDemo[] = [1, 2, 3, 4, 5].map((n) => ({
    familiaId: id(6, n),
    status: "realizada",
    realizadaEm: meioDia(dia(mesAtual, n + 1)),
  }));
  const pesquisas: PesquisaDemo[] = [
    [10, "promotor", true],
    [10, "promotor", false],
    [9, "promotor", true],
    [9, "promotor", null],
    [8, "neutro", false],
    [7, "neutro", false],
  ].map(([nps, classificacao, depoimento], i) => ({
    acompanhamentoId: id(7, i + 1),
    respondidaEm: meioDia(dia(mesAtual, 2 + i)),
    nps: nps as number,
    classificacao: classificacao as PesquisaDemo["classificacao"],
    depoimentoAutorizado: depoimento === true,
  }));

  // Cobranças: pagas nos dois meses anteriores e neste, vencidas e a vencer
  let n = 0;
  const cobranca = (
    familiaId: string,
    nome: string,
    valor: number,
    venc: string,
    status: CobrancaDemoGestao["status"],
    pagoDia: string | null,
  ): CobrancaDemoGestao => {
    n += 1;
    return {
      id: id(8, n),
      contratoId: id(9, n),
      familiaId,
      familiaNome: nome,
      parcela: 1,
      valorCentavos: valor,
      vencimento: venc,
      status,
      pagoEm: pagoDia ? meioDia(pagoDia) : null,
      valorPagoCentavos: status === "paga" ? valor : null,
    };
  };
  const cobrancas: CobrancaDemoGestao[] = [
    cobranca(
      id(6, 1),
      "Família Teste Lead 1",
      420000,
      dia(mesAtual, 4),
      "paga",
      dia(mesAtual, 4),
    ),
    cobranca(
      id(6, 3),
      "Família Teste Lead 3",
      780000,
      dia(mesAtual, 6),
      "paga",
      dia(mesAtual, 6),
    ),
    cobranca(
      id(6, 4),
      "Família Teste Lead 4",
      455000,
      dia(mesAtual, 8),
      "paga",
      dia(mesAtual, 8),
    ),
    cobranca(
      id(4, 1),
      "Família Teste Aurora",
      420000,
      dia(mesAnterior, 11),
      "paga",
      dia(mesAnterior, 11),
    ),
    cobranca(
      id(4, 2),
      "Família Teste Brisa",
      780000,
      dia(mesAnterior, 15),
      "paga",
      dia(mesAnterior, 16),
    ),
    cobranca(
      id(4, 3),
      "Família Teste Cecília",
      810000,
      dia(doisMeses, 12),
      "paga",
      dia(doisMeses, 12),
    ),
    cobranca(
      id(4, 3),
      "Família Teste Cecília",
      300000,
      dia(doisMeses, 20),
      "estornada",
      dia(doisMeses, 21),
    ),
    cobranca(
      id(6, 7),
      "Família Teste Lead 7",
      810000,
      somarDias(hoje, -5),
      "aberta",
      null,
    ),
    cobranca(
      id(6, 5),
      "Família Teste Lead 5",
      420000,
      somarDias(hoje, -21),
      "aberta",
      null,
    ),
    cobranca(
      id(6, 6),
      "Família Teste Lead 6",
      455000,
      somarDias(hoje, -40),
      "aberta",
      null,
    ),
    cobranca(
      id(6, 9),
      "Família Teste Lead 9",
      420000,
      somarDias(hoje, 6),
      "aberta",
      null,
    ),
    cobranca(
      id(6, 10),
      "Família Teste Lead 10",
      780000,
      somarDias(hoje, 34),
      "aberta",
      null,
    ),
  ];

  let d = 0;
  const despesa = (
    data: string,
    categoria: CategoriaDespesa,
    descricao: string,
    valor: number,
    canal: OrigemLead | null = null,
    fornecedor: string | null = null,
  ): DespesaDemoGestao => {
    d += 1;
    return {
      id: id(10, d),
      data,
      categoria,
      descricao,
      fornecedor,
      valorCentavos: valor,
      canal,
      pagamentoEquipeId: null,
      removida: false,
      removidaMotivo: null,
    };
  };
  const despesas: DespesaDemoGestao[] = [
    despesa(
      dia(mesAtual, 2),
      "marketing_anuncios",
      "Anúncios do mês (exemplo)",
      180000,
      "meta_ads",
      "Plataforma Teste",
    ),
    despesa(
      dia(mesAtual, 3),
      "marketing_anuncios",
      "Impulsionamento no Instagram (exemplo)",
      60000,
      "instagram_organico",
    ),
    despesa(
      dia(mesAtual, 4),
      "contabilidade",
      "Contabilidade do mês (exemplo)",
      90000,
      null,
      "Escritório Teste",
    ),
    despesa(
      dia(mesAtual, 4),
      "tecnologia",
      "Hospedagem e ferramentas (exemplo)",
      45000,
    ),
    despesa(dia(mesAtual, 5), "pro_labore", "Pró-labore (exemplo)", 500000),
    despesa(
      dia(mesAnterior, 3),
      "marketing_anuncios",
      "Anúncios do mês anterior (exemplo)",
      160000,
      "meta_ads",
    ),
    despesa(
      dia(mesAnterior, 5),
      "contabilidade",
      "Contabilidade do mês anterior (exemplo)",
      90000,
    ),
    despesa(
      dia(mesAnterior, 5),
      "pro_labore",
      "Pró-labore do mês anterior (exemplo)",
      500000,
    ),
    despesa(
      dia(mesAnterior, 28),
      "deslocamento",
      "Deslocamento da equipe (exemplo)",
      32000,
    ),
    despesa(dia(doisMeses, 3), "tecnologia", "Ferramentas (exemplo)", 45000),
    despesa(
      dia(doisMeses, 6),
      "outros",
      "Material de escritório (exemplo)",
      12000,
    ),
  ];

  const visitas = acompanhamentos.flatMap((a) =>
    a.visitas.map((v) => ({ data: v.data, estado: "concluida" })),
  );

  return {
    hoje,
    regioes,
    profissionais,
    contratosCapacidade,
    familias,
    contratos,
    sessoes,
    acompanhamentos,
    visitas,
    pesquisas,
    cobrancas,
    despesas,
    ocorrenciasAbertas: 2,
  };
}
