import type { Json } from "@/lib/db/types";
import { garantirDemonstracaoPermitida } from "../modo";
import type {
  AvaliacaoCandidata,
  CategoriaManual,
  EspecialidadeMedico,
  EstadoCandidata,
  EstadoParceiro,
  OrigemLead,
  PortalVisita,
} from "../tipos-relacao";
import { PARAMETROS_RELACAO } from "./relacao-seed.gerado";

/**
 * Banco em memória do relacionamento da fase 3 no modo demonstração (P47 a
 * P51). Nasce destes dados na primeira leitura e vive enquanto o processo do
 * servidor viver (globalThis, como a loja principal). Só dado fictício, na
 * faixa +55 11 90000-xxxx e com e-mails .invalid. Os parâmetros e os textos
 * vêm do seed (relacao-seed.gerado.ts), nunca escritos aqui.
 */

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-9${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

// --- P47 · canais, leads e custo ---------------------------------------------------

export interface CanalDemo {
  id: string;
  codigo: string;
  nome: string;
  origem: OrigemLead;
  ativo: boolean;
  visitas: number;
  conversas: number;
}

export interface LeadDemo {
  id: string;
  nome: string;
  origem: OrigemLead;
  codigoOrigem: string | null;
  utm: Record<string, string> | null;
  /** aaaa-mm-dd no fuso da operação. */
  criadoEm: string;
  qualificado: boolean;
  ganho: boolean;
  perdido: boolean;
  sessaoRealizada: boolean;
  /** Família em estado sensível ou "não contatar": fora do que o marketing vê. */
  elegivel: boolean;
  dpp: string | null;
  gemelar: boolean;
  primeiraGestacao: boolean | null;
  pagamentos: { contratoId: string; valorCentavos: number; data: string }[];
}

export interface CustoDemo {
  canalId: string;
  /** Primeiro dia do mês. */
  mes: string;
  valorCentavos: number;
}

const CANAIS: CanalDemo[] = [
  {
    id: id(1, 1),
    codigo: "SITE",
    nome: "Site da Kraamzorg",
    origem: "site",
    ativo: true,
    visitas: 41,
    conversas: 12,
  },
  {
    id: id(1, 2),
    codigo: "IGBIO",
    nome: "Instagram, link da bio",
    origem: "instagram_organico",
    ativo: true,
    visitas: 88,
    conversas: 21,
  },
  {
    id: id(1, 3),
    codigo: "META",
    nome: "Anúncios da Meta",
    origem: "meta_ads",
    ativo: true,
    visitas: 130,
    conversas: 34,
  },
  {
    id: id(1, 4),
    codigo: "GOOGLE",
    nome: "Anúncios do Google",
    origem: "google",
    ativo: true,
    visitas: 27,
    conversas: 6,
  },
];

function lead(
  n: number,
  nome: string,
  origem: OrigemLead,
  codigoOrigem: string | null,
  criadoEm: string,
  extras: Partial<LeadDemo> = {},
): LeadDemo {
  return {
    id: id(2, n),
    nome,
    origem,
    codigoOrigem,
    utm: null,
    criadoEm,
    qualificado: false,
    ganho: false,
    perdido: false,
    sessaoRealizada: false,
    elegivel: true,
    dpp: "2027-01-15",
    gemelar: false,
    primeiraGestacao: true,
    pagamentos: [],
    ...extras,
  };
}

const LEADS: LeadDemo[] = [
  lead(1, "Família Teste Aurora", "meta_ads", "META", "2026-08-12", {
    qualificado: true,
    ganho: true,
    sessaoRealizada: true,
    pagamentos: [
      { contratoId: id(3, 1), valorCentavos: 420000, data: "2026-09-05" },
    ],
  }),
  lead(2, "Família Teste Brisa", "meta_ads", "META", "2026-08-20", {
    qualificado: true,
    sessaoRealizada: true,
  }),
  lead(3, "Família Teste Cais", "meta_ads", "META", "2026-09-02"),
  lead(4, "Família Teste Duna", "instagram_organico", "IGBIO", "2026-08-25", {
    qualificado: true,
    ganho: true,
    sessaoRealizada: true,
    pagamentos: [
      { contratoId: id(3, 2), valorCentavos: 200000, data: "2026-09-10" },
      { contratoId: id(3, 2), valorCentavos: 180000, data: "2026-10-10" },
    ],
  }),
  lead(5, "Família Teste Eco", "instagram_organico", "IGBIO", "2026-09-08"),
  lead(6, "Família Teste Faro", "google", "GOOGLE", "2026-09-01", {
    qualificado: true,
    ganho: true,
    sessaoRealizada: true,
    pagamentos: [
      { contratoId: id(3, 3), valorCentavos: 450000, data: "2026-09-18" },
    ],
  }),
  lead(7, "Família Teste Gaia", "site", "SITE", "2026-09-05", {
    qualificado: true,
  }),
  lead(8, "Família Teste Hera", "indicacao_medica", null, "2026-09-09", {
    qualificado: true,
    ganho: true,
    sessaoRealizada: true,
    pagamentos: [
      { contratoId: id(3, 4), valorCentavos: 400000, data: "2026-09-21" },
    ],
  }),
  lead(9, "Família Teste Íris", "indicacao_cliente", null, "2026-09-11", {
    qualificado: true,
  }),
  lead(10, "Família Teste Jade", "desconhecida", null, "2026-09-12"),
  lead(11, "Família Teste Kalu", "meta_ads", "META", "2026-09-03", {
    qualificado: true,
    ganho: true,
    sessaoRealizada: true,
    elegivel: false,
    pagamentos: [
      { contratoId: id(3, 5), valorCentavos: 100000, data: "2026-09-15" },
    ],
  }),
  lead(12, "Família Teste Lua", "google", "GOOGLE", "2026-08-30", {
    perdido: true,
    qualificado: true,
  }),
];

const CUSTOS: CustoDemo[] = [
  { canalId: CANAIS[2]!.id, mes: "2026-08-01", valorCentavos: 150000 },
  { canalId: CANAIS[2]!.id, mes: "2026-09-01", valorCentavos: 200000 },
  { canalId: CANAIS[3]!.id, mes: "2026-09-01", valorCentavos: 90000 },
];

/** Cobranças em aberto e vencidas (só para o copiloto responder a receita). */
const COBRANCAS_ABERTAS = { emAbertoCentavos: 180000, vencidoCentavos: 20000 };

// --- P48 · copiloto ---------------------------------------------------------------------

export interface PerguntaDemo {
  id: string;
  usuarioId: string;
  quem: string;
  em: string;
  pergunta: string;
  ferramenta: string | null;
  situacao: string;
  motivo: string | null;
  tokensEntrada: number;
  tokensSaida: number;
}

// --- P49 · portal da família ------------------------------------------------------------

export interface PessoaPortalDemo {
  pessoaId: string;
  familiaId: string;
  papel: "mae" | "parceiro" | "acompanhante" | "responsavel" | "presenteador";
  nome: string;
  email: string | null;
  /** Acesso ao portal: ausente = ainda não liberado. */
  acesso: { ativo: boolean; ultimoAcessoEm: string | null } | null;
}

export interface FamiliaPortalDemo {
  familiaId: string;
  nomeExibicao: string;
  estadoSensivel:
    "normal" | "atencao" | "bloqueio_total" | "encerrado_sensivel";
  gemelar: boolean;
  dpp: string | null;
  dataNascimento: string | null;
  dataAlta: string | null;
  dataInicioEfetivo: string | null;
  contratoAssinadoEm: string | null;
  pagamentoConfirmadoEm: string | null;
  prenatal: {
    estado: string;
    agendadaPara: string | null;
    realizadaEm: string | null;
  } | null;
  acompanhamento: {
    estado: string;
    diasContratados: number;
    inicioEfetivo: string | null;
    encerramento: string | null;
  } | null;
  profissionalId: string | null;
  visitas: PortalVisita[];
  pesquisa: { enviada: boolean; respondida: boolean } | null;
}

export interface ProfissionalPortalDemo {
  profissionalId: string;
  nome: string;
  autorizaNome: boolean;
  autorizaFoto: boolean;
  fotoPath: string | null;
}

const FAMILIAS_PORTAL: FamiliaPortalDemo[] = [
  {
    familiaId: id(4, 1),
    nomeExibicao: "Família Teste Aurora",
    estadoSensivel: "normal",
    gemelar: false,
    dpp: "2026-10-20",
    dataNascimento: "2026-10-05",
    dataAlta: "2026-10-07",
    dataInicioEfetivo: "2026-10-08",
    contratoAssinadoEm: "2026-09-06T10:00:00-03:00",
    pagamentoConfirmadoEm: "2026-09-07T10:00:00-03:00",
    prenatal: {
      estado: "realizada",
      agendadaPara: "2026-09-12T10:00:00-03:00",
      realizadaEm: "2026-09-12T10:40:00-03:00",
    },
    acompanhamento: {
      estado: "em_execucao",
      diasContratados: 6,
      inicioEfetivo: "2026-10-08",
      encerramento: null,
    },
    profissionalId: id(5, 1),
    visitas: [
      { dia: 1, data: "2026-10-08", hora: "09:00", feita: true },
      { dia: 2, data: "2026-10-09", hora: "09:00", feita: true },
      { dia: 3, data: "2026-10-10", hora: "09:00", feita: false },
      { dia: 4, data: "2026-10-11", hora: "09:00", feita: false },
    ],
    pesquisa: { enviada: false, respondida: false },
  },
  {
    familiaId: id(4, 2),
    nomeExibicao: "Família Teste Brisa",
    estadoSensivel: "normal",
    gemelar: false,
    dpp: "2026-12-15",
    dataNascimento: null,
    dataAlta: null,
    dataInicioEfetivo: null,
    contratoAssinadoEm: "2026-09-20T15:00:00-03:00",
    pagamentoConfirmadoEm: null,
    prenatal: null,
    acompanhamento: null,
    profissionalId: null,
    visitas: [],
    pesquisa: null,
  },
  {
    familiaId: id(4, 3),
    nomeExibicao: "Família Teste Cais",
    estadoSensivel: "bloqueio_total",
    gemelar: false,
    dpp: "2026-11-02",
    dataNascimento: null,
    dataAlta: null,
    dataInicioEfetivo: null,
    contratoAssinadoEm: "2026-08-15T09:00:00-03:00",
    pagamentoConfirmadoEm: "2026-08-16T09:00:00-03:00",
    prenatal: null,
    acompanhamento: null,
    profissionalId: null,
    visitas: [],
    pesquisa: null,
  },
];

const PESSOAS_PORTAL: PessoaPortalDemo[] = [
  {
    pessoaId: id(6, 1),
    familiaId: id(4, 1),
    papel: "mae",
    nome: "Aurora Teste",
    email: "aurora.teste@exemplo.invalid",
    acesso: { ativo: true, ultimoAcessoEm: null },
  },
  {
    pessoaId: id(6, 2),
    familiaId: id(4, 1),
    papel: "parceiro",
    nome: "Bento Teste",
    email: "bento.teste@exemplo.invalid",
    acesso: null,
  },
  {
    pessoaId: id(6, 3),
    familiaId: id(4, 2),
    papel: "mae",
    nome: "Brisa Teste",
    email: "brisa.teste@exemplo.invalid",
    acesso: null,
  },
  {
    pessoaId: id(6, 4),
    familiaId: id(4, 3),
    papel: "mae",
    nome: "Cais Teste",
    email: "cais.teste@exemplo.invalid",
    acesso: { ativo: true, ultimoAcessoEm: null },
  },
];

const PROFISSIONAIS_PORTAL: ProfissionalPortalDemo[] = [
  {
    profissionalId: id(5, 1),
    nome: "Enfermeira Teste Alfa",
    autorizaNome: true,
    autorizaFoto: false,
    fotoPath: null,
  },
  {
    profissionalId: id(5, 2),
    nome: "Enfermeira Teste Beta",
    autorizaNome: false,
    autorizaFoto: false,
    fotoPath: null,
  },
];

// --- P50 · parceiros e indicações ------------------------------------------------------

export interface ParceiroDemo {
  medicoId: string;
  nome: string;
  especialidade: EspecialidadeMedico;
  hospital: string | null;
  telefoneE164: string | null;
  email: string | null;
  estado: EstadoParceiro;
  observacao: string | null;
  ultimoContatoEm: string | null;
  proximoContatoEm: string | null;
}

export interface IndicacaoDemo {
  id: string;
  familiaId: string;
  medicoId: string | null;
  familiaPromotoraId: string | null;
  observacao: string | null;
  criadaEm: string;
}

const PARCEIROS: ParceiroDemo[] = [
  {
    medicoId: id(7, 1),
    nome: "Dra. Teste Obstetra",
    especialidade: "obstetra",
    hospital: "Hospital de Teste",
    telefoneE164: "+5511900007001",
    email: "obstetra.teste@exemplo.invalid",
    estado: "ativo",
    observacao: "Conheceu a Kraamzorg num evento de teste.",
    ultimoContatoEm: "2026-08-01T12:00:00-03:00",
    proximoContatoEm: "2026-09-30",
  },
  {
    medicoId: id(7, 2),
    nome: "Dr. Teste Pediatra",
    especialidade: "pediatra",
    hospital: null,
    telefoneE164: "+5511900007002",
    email: null,
    estado: "prospeccao",
    observacao: null,
    ultimoContatoEm: null,
    proximoContatoEm: null,
  },
];

const INDICACOES: IndicacaoDemo[] = [
  {
    id: id(8, 1),
    familiaId: LEADS[7]!.id,
    medicoId: PARCEIROS[0]!.medicoId,
    familiaPromotoraId: null,
    observacao: null,
    criadaEm: "2026-09-09T12:00:00-03:00",
  },
  {
    id: id(8, 2),
    familiaId: LEADS[8]!.id,
    medicoId: null,
    familiaPromotoraId: LEADS[0]!.id,
    observacao: null,
    criadaEm: "2026-09-11T12:00:00-03:00",
  },
];

// --- P51 · manuais, trilhas e talentos ---------------------------------------------------

export interface VersaoManualDemo {
  id: string;
  versao: number;
  conteudo: string;
  resumoMudanca: string | null;
  publicadaEm: string;
}

export interface ManualDemo {
  id: string;
  titulo: string;
  categoria: CategoriaManual;
  papeisAlvo: string[];
  ativo: boolean;
  versoes: VersaoManualDemo[];
}

export interface TrilhaDemo {
  id: string;
  nome: string;
  papelAlvo: string;
  ativa: boolean;
  manualIds: string[];
}

export interface CandidataDemo {
  id: string;
  nome: string;
  telefoneE164: string | null;
  email: string | null;
  cidade: string | null;
  conselho: string | null;
  apresentacao: string | null;
  origem: string;
  estado: EstadoCandidata;
  observacoes: string | null;
  criadoEm: string;
  avaliacoes: (AvaliacaoCandidata & { candidataId: string })[];
}

const MANUAIS: ManualDemo[] = [
  {
    id: id(9, 1),
    titulo: "Como usar o portal da enfermeira",
    categoria: "manual",
    papeisAlvo: ["enfermeira"],
    ativo: true,
    versoes: [
      {
        id: id(10, 1),
        versao: 1,
        conteudo:
          "Texto de exemplo para teste. Abra o Hoje, veja as visitas do dia e registre chegada e saída.",
        resumoMudanca: null,
        publicadaEm: "2026-09-01T09:00:00-03:00",
      },
    ],
  },
  {
    id: id(9, 2),
    titulo: "Protocolo de exemplo (texto fictício)",
    categoria: "protocolo",
    papeisAlvo: ["enfermeira", "coordenacao"],
    ativo: true,
    versoes: [
      {
        id: id(10, 2),
        versao: 1,
        conteudo:
          "Texto fictício de protocolo, só para testar versão e confirmação de leitura.",
        resumoMudanca: null,
        publicadaEm: "2026-09-02T09:00:00-03:00",
      },
      {
        id: id(10, 3),
        versao: 2,
        conteudo:
          "Texto fictício de protocolo, segunda versão, só para testar versão e confirmação de leitura.",
        resumoMudanca: "Acrescentamos uma frase de exemplo.",
        publicadaEm: "2026-09-20T09:00:00-03:00",
      },
    ],
  },
  {
    id: id(9, 3),
    titulo: "Combinados do time comercial",
    categoria: "manual",
    papeisAlvo: ["comercial"],
    ativo: true,
    versoes: [
      {
        id: id(10, 4),
        versao: 1,
        conteudo: "Texto de exemplo para o time comercial.",
        resumoMudanca: null,
        publicadaEm: "2026-09-03T09:00:00-03:00",
      },
    ],
  },
];

const TRILHAS: TrilhaDemo[] = [
  {
    id: id(11, 1),
    nome: "Primeiros passos das enfermeiras",
    papelAlvo: "enfermeira",
    ativa: true,
    manualIds: [MANUAIS[0]!.id, MANUAIS[1]!.id],
  },
];

const CANDIDATAS: CandidataDemo[] = [
  {
    id: id(12, 1),
    nome: "Candidata Teste Um",
    telefoneE164: "+5511900012001",
    email: "candidata.um@exemplo.invalid",
    cidade: "São Paulo",
    conselho: "COREN-SP de teste",
    apresentacao: "Apresentação fictícia para teste.",
    origem: "coordenacao",
    estado: "entrevistada",
    observacoes: null,
    criadoEm: "2026-09-10T10:00:00-03:00",
    avaliacoes: [],
  },
  {
    id: id(12, 2),
    nome: "Candidata Teste Dois",
    telefoneE164: null,
    email: "candidata.dois@exemplo.invalid",
    cidade: "Londrina",
    conselho: null,
    apresentacao: null,
    origem: "indicacao",
    estado: "nova",
    observacoes: null,
    criadoEm: "2026-09-18T10:00:00-03:00",
    avaliacoes: [],
  },
];

// --- Loja ------------------------------------------------------------------------------------

export interface LojaRelacao {
  canais: CanalDemo[];
  leads: LeadDemo[];
  custos: CustoDemo[];
  cobrancasAbertas: typeof COBRANCAS_ABERTAS;
  perguntas: PerguntaDemo[];
  parametros: Record<string, Json>;
  familiasPortal: FamiliaPortalDemo[];
  pessoasPortal: PessoaPortalDemo[];
  profissionaisPortal: ProfissionalPortalDemo[];
  parceiros: ParceiroDemo[];
  indicacoes: IndicacaoDemo[];
  tarefasParceiro: {
    id: string;
    medicoId: string;
    titulo: string;
    venceEm: string | null;
    status: "aberta" | "concluida";
  }[];
  manuais: ManualDemo[];
  leituras: { versaoId: string; usuarioId: string; em: string }[];
  trilhas: TrilhaDemo[];
  candidatas: CandidataDemo[];
  /** Tentativas das páginas abertas por escopo e chave (limite de taxa). */
  tentativas: Record<string, number[]>;
  proximoId: number;
}

const CHAVE_GLOBAL = "__kraamzorgLojaRelacao";

export function criarLojaRelacao(): LojaRelacao {
  const clonar = <T>(valor: T): T => structuredClone(valor);
  return {
    canais: clonar(CANAIS),
    leads: clonar(LEADS),
    custos: clonar(CUSTOS),
    cobrancasAbertas: clonar(COBRANCAS_ABERTAS),
    perguntas: [],
    parametros: clonar(PARAMETROS_RELACAO),
    familiasPortal: clonar(FAMILIAS_PORTAL),
    pessoasPortal: clonar(PESSOAS_PORTAL),
    profissionaisPortal: clonar(PROFISSIONAIS_PORTAL),
    parceiros: clonar(PARCEIROS),
    indicacoes: clonar(INDICACOES),
    tarefasParceiro: [],
    manuais: clonar(MANUAIS),
    leituras: [],
    trilhas: clonar(TRILHAS),
    candidatas: clonar(CANDIDATAS),
    tentativas: {},
    proximoId: 1000,
  };
}

export function obterLojaRelacao(): LojaRelacao {
  garantirDemonstracaoPermitida();
  const g = globalThis as unknown as Record<string, LojaRelacao | undefined>;
  return (g[CHAVE_GLOBAL] ??= criarLojaRelacao());
}

export function reiniciarLojaRelacao(): LojaRelacao {
  garantirDemonstracaoPermitida();
  const g = globalThis as unknown as Record<string, LojaRelacao | undefined>;
  return (g[CHAVE_GLOBAL] = criarLojaRelacao());
}

/** Id novo e fictício (contador da loja). */
export function novoId(loja: LojaRelacao, grupo = 99): string {
  loja.proximoId += 1;
  return id(grupo, loja.proximoId);
}

/** Dia de hoje no fuso da operação, aaaa-mm-dd. */
export function hojeDemonstracao(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}
