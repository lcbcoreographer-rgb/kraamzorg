import type { Json } from "@/lib/db/types";
import type { EstadoSensivel, EstagioP2 } from "../tipos";
import type { PeriodoVisita } from "../tipos-operacao";

/**
 * Dados fictícios da operação no modo demonstração (P35 e P36): as mesmas
 * regras de 0021_prenatal_nascimento.sql sobre famílias "Família Teste ...",
 * com datas relativas a hoje para o radar, os alertas e a janela da DPP
 * fazerem sentido em qualquer dia. Nenhum nome, telefone ou texto real.
 * Parâmetros iguais aos de supabase/seed.sql (seção P35 e P36).
 */

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

/** Parâmetros do seed que a operação lê (nenhum número fica no código da regra). */
export const PARAMETROS_OPERACAO = {
  prenatal_semanas_alerta: 34,
  designacao_prazo_resposta_horas: 24,
  alta_primeira_visita_dias: 1,
  visita_hora_por_periodo: { manha: "09:00", tarde: "14:00" } as Record<
    string,
    string
  >,
  visitas_maximo_por_dia: 2,
  radar_horizonte_dias: 56,
  radar_sem_contato_dias: 7,
  janela_dpp_dias: { antes: 21, depois: 14 },
  capacidade_alerta_pct: 85,
  /** automacao.gatilho.dias */
  checkin_dpp_dias: 7,
  dpp_sem_confirmacao_dias: 3,
  dpp_sem_contato_dias: 10,
};

export const REGIAO_SP = { id: id(2, 1), nome: "São Paulo", limite: 5 };
export const REGIAO_LONDRINA = { id: id(2, 2), nome: "Londrina", limite: 3 };

export interface ProfissionalDemo {
  id: string;
  nome: string;
  funcao: string;
  /** perfil.id de quem entra no sistema (só a enfermeira de teste). */
  usuarioId: string | null;
  ativa: boolean;
  regioes: string[];
}

/** A enfermeira de teste do login é a "Sul 2", como no seed (perfil.profissional_id). */
export const ID_PERFIL_ENFERMEIRA = id(1, 6);

export const PROFISSIONAIS: ProfissionalDemo[] = [
  {
    id: id(11, 1),
    nome: "Profissional Teste Sul 1",
    funcao: "enfermeira_obstetrica",
    usuarioId: null,
    ativa: true,
    regioes: [REGIAO_SP.id],
  },
  {
    id: id(11, 2),
    nome: "Profissional Teste Sul 2",
    funcao: "enfermeira_neonatal",
    usuarioId: ID_PERFIL_ENFERMEIRA,
    ativa: true,
    regioes: [REGIAO_SP.id],
  },
  {
    id: id(11, 3),
    nome: "Profissional Teste Sul 3",
    funcao: "enfermeira_obstetrica",
    usuarioId: null,
    ativa: true,
    regioes: [REGIAO_SP.id],
  },
  {
    id: id(11, 4),
    nome: "Profissional Teste Norte 1",
    funcao: "enfermeira_obstetrica",
    usuarioId: null,
    ativa: true,
    regioes: [REGIAO_LONDRINA.id],
  },
  {
    id: id(11, 5),
    nome: "Profissional Teste Em Contratação",
    funcao: "enfermeira_neonatal",
    usuarioId: null,
    ativa: false,
    regioes: [REGIAO_SP.id],
  },
];

export const SUL_1 = PROFISSIONAIS[0]!.id;
export const SUL_2 = PROFISSIONAIS[1]!.id;
export const SUL_3 = PROFISSIONAIS[2]!.id;

export interface FamiliaOperacaoSemente {
  chave: string;
  nome: string;
  bairro: string;
  cidade: string;
  uf: string;
  regiao: typeof REGIAO_SP;
  /** Dias de hoje até a DPP (negativo: já passou). */
  dppEmDias: number;
  estagioP2: EstagioP2;
  dias: 6 | 12;
  horas: number;
  gemelar?: boolean;
  estadoSensivel?: EstadoSensivel;
  /** Dias desde o último contato com a família; nulo = nunca. */
  contatoHaDias?: number | null;
  nascimentoHaDias?: number;
  previsaoAltaEmDias?: number;
  consulta?: {
    status: "pendente" | "agendada" | "realizada";
    urgente?: boolean;
    agendadaEmDias?: number;
    etapa?: number;
    ficha?: Record<string, Record<string, Json>>;
    periodo?: PeriodoVisita[];
  };
  titular?: { profissionalId: string; status: "aceita" | "oferecida" };
  backup?: { profissionalId: string; status: "aceita" | "oferecida" };
  tarefas?: { tipo: string; titulo: string; prioridade: string }[];
}

/** Famílias de teste da operação, uma para cada cena dos roteiros. */
export const FAMILIAS_OPERACAO: FamiliaOperacaoSemente[] = [
  {
    chave: "anturio",
    nome: "Família Teste Antúrio",
    bairro: "Vila Mariana",
    cidade: "São Paulo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 40,
    estagioP2: "pagamento_confirmado",
    dias: 6,
    horas: 3,
    consulta: { status: "pendente", urgente: true },
    tarefas: [
      {
        tipo: "agendar_prenatal",
        titulo: "Agendar a consulta pré-natal com urgência",
        prioridade: "maxima",
      },
    ],
  },
  {
    chave: "begonia",
    nome: "Família Teste Begônia",
    bairro: "Pinheiros",
    cidade: "São Paulo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 100,
    estagioP2: "pagamento_confirmado",
    dias: 6,
    horas: 3,
    consulta: { status: "pendente" },
    tarefas: [
      {
        tipo: "agendar_prenatal",
        titulo: "Agendar a consulta pré-natal",
        prioridade: "normal",
      },
    ],
  },
  {
    chave: "camelia",
    nome: "Família Teste Camélia",
    bairro: "Moema",
    cidade: "São Paulo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 60,
    estagioP2: "pagamento_confirmado",
    dias: 6,
    horas: 3,
    consulta: { status: "pendente" },
    tarefas: [
      {
        tipo: "agendar_prenatal",
        titulo: "Agendar a consulta pré-natal",
        prioridade: "normal",
      },
    ],
  },
  {
    chave: "jasmim",
    nome: "Família Teste Jasmim",
    bairro: "Alphaville",
    cidade: "Barueri",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 40,
    estagioP2: "consulta_prenatal_agendada",
    dias: 6,
    horas: 3,
    consulta: {
      status: "agendada",
      agendadaEmDias: 0,
      etapa: 4,
      ficha: {
        A: { como_chegou: "indicacao_de_amigo" },
        B: { local_maternidade: "Maternidade Fictícia do Sul" },
        C: {
          nome_da_gestante: "Helena Teste",
          nome_do_companheiro: "Rui Teste",
        },
      },
    },
  },
  {
    chave: "girassol",
    nome: "Família Teste Girassol",
    bairro: "Itaim Bibi",
    cidade: "São Paulo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 25,
    estagioP2: "consulta_realizada",
    dias: 6,
    horas: 3,
    contatoHaDias: 2,
    consulta: { status: "realizada", periodo: ["manha", "tarde"] },
    titular: { profissionalId: SUL_2, status: "oferecida" },
    backup: { profissionalId: SUL_3, status: "aceita" },
  },
  {
    chave: "hortensia",
    nome: "Família Teste Hortênsia",
    bairro: "Perdizes",
    cidade: "São Paulo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 5,
    estagioP2: "aguardando_nascimento",
    dias: 6,
    horas: 3,
    contatoHaDias: 3,
    consulta: { status: "realizada", periodo: ["manha"] },
    titular: { profissionalId: SUL_1, status: "aceita" },
    backup: { profissionalId: SUL_3, status: "aceita" },
    tarefas: [
      {
        tipo: "checkin_dpp",
        titulo: "Check-in de DPP: confirmar alocação e backup",
        prioridade: "normal",
      },
    ],
  },
  {
    chave: "ipe",
    nome: "Família Teste Ipê",
    bairro: "Santana",
    cidade: "São Paulo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: -12,
    estagioP2: "aguardando_nascimento",
    dias: 6,
    horas: 3,
    contatoHaDias: 20,
    consulta: { status: "realizada", periodo: ["tarde"] },
    titular: { profissionalId: SUL_1, status: "aceita" },
  },
  {
    chave: "lirio",
    nome: "Família Teste Lírio",
    bairro: "Tatuapé",
    cidade: "São Paulo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 30,
    estagioP2: "consulta_realizada",
    dias: 6,
    horas: 3,
    contatoHaDias: 6,
    consulta: { status: "realizada", periodo: ["manha"] },
    tarefas: [
      {
        tipo: "designar_profissional",
        titulo: "Designar a titular e o backup",
        prioridade: "normal",
      },
    ],
  },
  {
    chave: "orquidea",
    nome: "Família Teste Orquídea",
    bairro: "Jardim do Mar",
    cidade: "São Bernardo do Campo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 2,
    estagioP2: "aguardando_nascimento",
    dias: 6,
    horas: 3,
    contatoHaDias: 1,
    consulta: { status: "realizada", periodo: ["manha", "tarde"] },
    titular: { profissionalId: SUL_2, status: "aceita" },
    backup: { profissionalId: SUL_3, status: "aceita" },
  },
  {
    chave: "violeta",
    nome: "Família Teste Violeta",
    bairro: "Centro",
    cidade: "Santo André",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: 3,
    estagioP2: "aguardando_nascimento",
    dias: 12,
    horas: 3,
    contatoHaDias: 1,
    consulta: { status: "realizada", periodo: ["tarde"] },
    titular: { profissionalId: SUL_1, status: "aceita" },
    backup: { profissionalId: SUL_3, status: "aceita" },
  },
  {
    chave: "margarida",
    nome: "Família Teste Margarida",
    bairro: "Higienópolis",
    cidade: "São Paulo",
    uf: "SP",
    regiao: REGIAO_SP,
    dppEmDias: -1,
    estagioP2: "bebe_nasceu",
    dias: 6,
    horas: 3,
    nascimentoHaDias: 1,
    previsaoAltaEmDias: 1,
    contatoHaDias: 0,
    consulta: { status: "realizada", periodo: ["manha"] },
    titular: { profissionalId: SUL_1, status: "aceita" },
  },
];
