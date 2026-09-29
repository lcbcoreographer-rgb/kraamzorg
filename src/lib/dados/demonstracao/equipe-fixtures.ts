import type { Json } from "@/lib/db/types";
import { somarDias } from "@/lib/agenda/datas";
import type { ParametrosAgenda } from "@/lib/agenda/regras";
import type {
  EnderecoAtendimento,
  EstadoVisita,
  VinculoProfissional,
} from "../tipos-equipe";
import { USUARIOS, familiaPorNome } from "./fixtures";

/**
 * Dados fictícios da equipe, da agenda e do portal da enfermeira (P37 e
 * P38) no modo demonstração. Os parâmetros são cópia do supabase/seed.sql
 * (o teste de paridade confere); as datas das visitas nascem relativas a
 * "hoje" na hora em que a demonstração sobe, para o portal sempre ter o
 * que mostrar. Nomes, telefones e endereços são de mentira, sempre sobre as
 * famílias "Família Teste ..." do seed.
 */

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

/** Valores de `parametro` (e da automação documento_vencendo) que a agenda lê. */
export const PARAMETROS_EQUIPE: Record<string, Json> = {
  agenda_visitas_por_dia: 2,
  periodos_visita: {
    manha: { inicio: "05:00", fim: "12:00" },
    tarde: { inicio: "12:00", fim: "20:00" },
  },
  visita_registro_horario: {
    tolerancia_futuro_minutos: 5,
    max_atraso_horas: 48,
  },
  documento_profissional_tipos: [
    "Carteira do conselho",
    "Contrato de prestação de serviço",
    "Comprovante de vacinação",
  ],
  janela_dpp_dias: { antes: 21, depois: 14 },
  acesso_enfermeira_pos_encerramento_dias: 7,
};

/** `automacao.gatilho.dias` de documento_vencendo (PRD 10.1). */
export const DOCUMENTO_AVISO_DIAS = 30;

export const PARAMETROS_AGENDA: ParametrosAgenda = {
  visitasPorDia: 2,
  periodos: {
    manha: { inicio: "05:00", fim: "12:00" },
    tarde: { inicio: "12:00", fim: "20:00" },
  },
  janelaDpp: { antes: 21, depois: 14 },
  documentoAvisoDias: DOCUMENTO_AVISO_DIAS,
  registro: { toleranciaFuturoMinutos: 5, maxAtrasoHoras: 48 },
};

const SP = id(2, 1);
const LONDRINA = id(2, 2);

export interface ProfissionalDemo {
  id: string;
  usuarioId: string | null;
  nome: string;
  funcao: string;
  conselhoUf: string | null;
  conselhoNumero: string | null;
  telefoneE164: string | null;
  regioes: string[];
  vinculo: VinculoProfissional;
  valorHoraCentavos: number | null;
  adicionalDeslocamentoCentavos: number;
  ativa: boolean;
}

export const ID_PROFISSIONAL_SUL_1 = id(30, 1);
export const ID_PROFISSIONAL_SUL_2 = id(30, 2);
export const ID_PROFISSIONAL_SUL_3 = id(30, 3);
export const ID_PROFISSIONAL_NORTE_1 = id(30, 4);
export const ID_PROFISSIONAL_CONTRATACAO = id(30, 5);
export const ID_PROFISSIONAL_COORDENACAO = id(30, 6);

const usuarioComPapel = (papel: "enfermeira" | "coordenacao") => {
  const achado = USUARIOS.find((u) => u.papeis.includes(papel));
  if (!achado) throw new Error(`usuário de demonstração sem o papel ${papel}`);
  return achado.id;
};
const ID_ENFERMEIRA_DEMONSTRACAO = usuarioComPapel("enfermeira");
const ID_COORDENACAO_USUARIO = usuarioComPapel("coordenacao");

/** As profissionais do seed (P08), com a Sul 2 ligada à enfermeira de teste. */
export const PROFISSIONAIS: ProfissionalDemo[] = [
  {
    id: ID_PROFISSIONAL_SUL_1,
    usuarioId: null,
    nome: "Profissional Teste Sul 1",
    funcao: "enfermeira_obstetrica",
    conselhoUf: "SP",
    conselhoNumero: "TESTE-SP-0001",
    telefoneE164: "+5511900000201",
    regioes: [SP],
    vinculo: "pj",
    valorHoraCentavos: 10000,
    adicionalDeslocamentoCentavos: 0,
    ativa: true,
  },
  {
    id: ID_PROFISSIONAL_SUL_2,
    usuarioId: ID_ENFERMEIRA_DEMONSTRACAO,
    nome: "Profissional Teste Sul 2",
    funcao: "enfermeira_neonatal",
    conselhoUf: "SP",
    conselhoNumero: "TESTE-SP-0002",
    telefoneE164: "+5511900000202",
    regioes: [SP],
    vinculo: "mei",
    valorHoraCentavos: 10000,
    adicionalDeslocamentoCentavos: 0,
    ativa: true,
  },
  {
    id: ID_PROFISSIONAL_SUL_3,
    usuarioId: null,
    nome: "Profissional Teste Sul 3",
    funcao: "enfermeira_obstetrica",
    conselhoUf: "SP",
    conselhoNumero: "TESTE-SP-0003",
    telefoneE164: "+5511900000203",
    regioes: [SP],
    vinculo: "clt",
    valorHoraCentavos: 10000,
    adicionalDeslocamentoCentavos: 0,
    ativa: true,
  },
  {
    id: ID_PROFISSIONAL_NORTE_1,
    usuarioId: null,
    nome: "Profissional Teste Norte 1",
    funcao: "enfermeira_obstetrica",
    conselhoUf: "PR",
    conselhoNumero: "TESTE-PR-0001",
    telefoneE164: "+5511900000204",
    regioes: [LONDRINA],
    vinculo: "autonoma",
    valorHoraCentavos: 10000,
    adicionalDeslocamentoCentavos: 10000,
    ativa: true,
  },
  {
    id: ID_PROFISSIONAL_CONTRATACAO,
    usuarioId: null,
    nome: "Profissional Teste Em Contratação",
    funcao: "enfermeira_neonatal",
    conselhoUf: null,
    conselhoNumero: null,
    telefoneE164: "+5511900000205",
    regioes: [SP],
    vinculo: "a_definir",
    valorHoraCentavos: null,
    adicionalDeslocamentoCentavos: 0,
    ativa: false,
  },
  {
    id: ID_PROFISSIONAL_COORDENACAO,
    usuarioId: ID_COORDENACAO_USUARIO,
    nome: "Profissional Teste Coordenação",
    funcao: "coordenacao",
    conselhoUf: "SP",
    conselhoNumero: "TESTE-SP-0000",
    telefoneE164: "+5511900000206",
    regioes: [SP, LONDRINA],
    vinculo: "socia",
    valorHoraCentavos: null,
    adicionalDeslocamentoCentavos: 0,
    ativa: true,
  },
];

export interface AcompanhamentoDemo {
  id: string;
  familiaId: string;
  diasContratados: number;
  horasPorVisita: number;
  periodo: "manha" | "tarde" | "noite_avaliar" | null;
  estado: string;
  inicioEfetivo: string | null;
  encerramento: string | null;
}

export interface DesignacaoDemo {
  id: string;
  acompanhamentoId: string;
  profissionalId: string;
  papel: "titular" | "backup";
  status: "oferecida" | "aceita" | "recusada" | "expirada" | "cancelada";
  /** Minutos atrás em que a oferta saiu (só faz diferença na oferecida). */
  oferecidaHaMinutos: number;
}

export interface VisitaDemo {
  id: string;
  acompanhamentoId: string;
  profissionalId: string;
  diaNumero: number;
  data: string;
  horaPrevista: string | null;
  estado: EstadoVisita;
  checkinEm: string | null;
  checkoutEm: string | null;
  versao: number;
}

export interface DocumentoDemo {
  id: string;
  profissionalId: string;
  tipo: string;
  numero: string | null;
  validade: string | null;
}

export interface BloqueioDemo {
  id: string;
  profissionalId: string;
  inicio: string;
  fim: string;
  motivo: string;
}

export interface BebeDemo {
  id: string;
  ordem: number;
  nome: string | null;
  sexo: string | null;
  pesoNascimentoG: number | null;
  pesoAltaG: number | null;
  tipoParto: string | null;
}

export interface MedicoDemo {
  id: string;
  especialidade: string;
  nome: string;
  telefoneE164: string | null;
  hospital: string | null;
}

const ACOMP = {
  mare: id(31, 1),
  jade: id(31, 2),
  lua: id(31, 3),
  horizonte: id(31, 4),
  iris: id(31, 5),
};

export function acompanhamentosIniciais(hoje: string): AcompanhamentoDemo[] {
  return [
    {
      id: ACOMP.mare,
      familiaId: familiaPorNome("Maré").id,
      diasContratados: 6,
      horasPorVisita: 3,
      periodo: "manha",
      estado: "em_execucao",
      inicioEfetivo: somarDias(hoje, -1),
      encerramento: null,
    },
    {
      id: ACOMP.jade,
      familiaId: familiaPorNome("Jade").id,
      diasContratados: 6,
      horasPorVisita: 3,
      periodo: "tarde",
      estado: "ativo",
      inicioEfetivo: hoje,
      encerramento: null,
    },
    {
      id: ACOMP.lua,
      familiaId: familiaPorNome("Lua").id,
      diasContratados: 6,
      horasPorVisita: 4,
      periodo: "manha",
      estado: "em_execucao",
      inicioEfetivo: somarDias(hoje, -2),
      encerramento: null,
    },
    {
      id: ACOMP.horizonte,
      familiaId: familiaPorNome("Horizonte").id,
      diasContratados: 6,
      horasPorVisita: 3,
      periodo: "manha",
      estado: "aguardando",
      inicioEfetivo: null,
      encerramento: null,
    },
    {
      id: ACOMP.iris,
      familiaId: familiaPorNome("Íris").id,
      diasContratados: 6,
      horasPorVisita: 3,
      periodo: "tarde",
      estado: "aguardando",
      inicioEfetivo: null,
      encerramento: null,
    },
  ];
}

export function designacoesIniciais(): DesignacaoDemo[] {
  return [
    {
      id: id(32, 1),
      acompanhamentoId: ACOMP.mare,
      profissionalId: ID_PROFISSIONAL_SUL_2,
      papel: "titular",
      status: "aceita",
      oferecidaHaMinutos: 60 * 24 * 12,
    },
    {
      id: id(32, 2),
      acompanhamentoId: ACOMP.jade,
      profissionalId: ID_PROFISSIONAL_SUL_2,
      papel: "titular",
      status: "aceita",
      oferecidaHaMinutos: 60 * 24 * 9,
    },
    {
      id: id(32, 3),
      acompanhamentoId: ACOMP.lua,
      profissionalId: ID_PROFISSIONAL_NORTE_1,
      papel: "titular",
      status: "aceita",
      oferecidaHaMinutos: 60 * 24 * 23,
    },
    {
      id: id(32, 4),
      acompanhamentoId: ACOMP.horizonte,
      profissionalId: ID_PROFISSIONAL_SUL_3,
      papel: "titular",
      status: "oferecida",
      oferecidaHaMinutos: 18 * 60,
    },
    {
      id: id(32, 5),
      acompanhamentoId: ACOMP.iris,
      profissionalId: ID_PROFISSIONAL_SUL_1,
      papel: "titular",
      status: "aceita",
      oferecidaHaMinutos: 60 * 24 * 4,
    },
    {
      id: id(32, 6),
      acompanhamentoId: ACOMP.iris,
      profissionalId: ID_PROFISSIONAL_SUL_3,
      papel: "backup",
      status: "aceita",
      oferecidaHaMinutos: 60 * 24 * 4,
    },
  ];
}

function instante(dia: string, hora: string): string {
  return new Date(`${dia}T${hora}:00-03:00`).toISOString();
}

export function visitasIniciais(hoje: string): VisitaDemo[] {
  let n = 0;
  const visita = (
    acompanhamentoId: string,
    profissionalId: string,
    diaNumero: number,
    dia: string,
    hora: string,
    estado: EstadoVisita,
    checkin?: string,
    checkout?: string,
  ): VisitaDemo => ({
    id: id(33, ++n),
    acompanhamentoId,
    profissionalId,
    diaNumero,
    data: dia,
    horaPrevista: hora,
    estado,
    checkinEm: checkin ? instante(dia, checkin) : null,
    checkoutEm: checkout ? instante(dia, checkout) : null,
    versao: 1,
  });

  const dia = (deslocamento: number) => somarDias(hoje, deslocamento);
  return [
    // Maré (SP, manhã, Sul 2): D1 ontem com a ficha por assinar, D2 hoje
    visita(
      ACOMP.mare,
      ID_PROFISSIONAL_SUL_2,
      1,
      dia(-1),
      "09:00",
      "ficha_pendente",
      "09:04",
      "12:10",
    ),
    visita(ACOMP.mare, ID_PROFISSIONAL_SUL_2, 2, dia(0), "09:00", "confirmada"),
    visita(ACOMP.mare, ID_PROFISSIONAL_SUL_2, 3, dia(1), "09:00", "agendada"),
    visita(ACOMP.mare, ID_PROFISSIONAL_SUL_2, 4, dia(2), "09:00", "agendada"),
    visita(ACOMP.mare, ID_PROFISSIONAL_SUL_2, 5, dia(3), "09:00", "agendada"),
    visita(ACOMP.mare, ID_PROFISSIONAL_SUL_2, 6, dia(4), "09:00", "agendada"),
    // Jade (SP, tarde, Sul 2): D1 hoje
    visita(ACOMP.jade, ID_PROFISSIONAL_SUL_2, 1, dia(0), "14:00", "agendada"),
    visita(ACOMP.jade, ID_PROFISSIONAL_SUL_2, 2, dia(1), "14:00", "agendada"),
    visita(ACOMP.jade, ID_PROFISSIONAL_SUL_2, 3, dia(2), "14:00", "agendada"),
    visita(ACOMP.jade, ID_PROFISSIONAL_SUL_2, 4, dia(3), "14:00", "agendada"),
    visita(ACOMP.jade, ID_PROFISSIONAL_SUL_2, 5, dia(4), "14:00", "agendada"),
    visita(ACOMP.jade, ID_PROFISSIONAL_SUL_2, 6, dia(5), "14:00", "agendada"),
    // Lua (Londrina, manhã, Norte 1): D1 e D2 feitas, D3 hoje
    visita(
      ACOMP.lua,
      ID_PROFISSIONAL_NORTE_1,
      1,
      dia(-2),
      "08:00",
      "encerrada",
      "08:03",
      "12:05",
    ),
    visita(
      ACOMP.lua,
      ID_PROFISSIONAL_NORTE_1,
      2,
      dia(-1),
      "08:00",
      "ficha_entregue",
      "08:06",
      "12:01",
    ),
    visita(
      ACOMP.lua,
      ID_PROFISSIONAL_NORTE_1,
      3,
      dia(0),
      "08:00",
      "confirmada",
    ),
    visita(ACOMP.lua, ID_PROFISSIONAL_NORTE_1, 4, dia(1), "08:00", "agendada"),
    visita(ACOMP.lua, ID_PROFISSIONAL_NORTE_1, 5, dia(2), "08:00", "agendada"),
    visita(ACOMP.lua, ID_PROFISSIONAL_NORTE_1, 6, dia(3), "08:00", "agendada"),
  ];
}

export function documentosIniciais(hoje: string): DocumentoDemo[] {
  return [
    {
      id: id(34, 1),
      profissionalId: ID_PROFISSIONAL_SUL_2,
      tipo: "Carteira do conselho",
      numero: "TESTE-SP-0002",
      validade: somarDias(hoje, 20),
    },
    {
      id: id(34, 2),
      profissionalId: ID_PROFISSIONAL_SUL_2,
      tipo: "Contrato de prestação de serviço",
      numero: null,
      validade: somarDias(hoje, 200),
    },
    {
      id: id(34, 3),
      profissionalId: ID_PROFISSIONAL_SUL_1,
      tipo: "Carteira do conselho",
      numero: "TESTE-SP-0001",
      validade: somarDias(hoje, 300),
    },
    {
      id: id(34, 4),
      profissionalId: ID_PROFISSIONAL_SUL_3,
      tipo: "Comprovante de vacinação",
      numero: null,
      validade: somarDias(hoje, -5),
    },
    {
      id: id(34, 5),
      profissionalId: ID_PROFISSIONAL_NORTE_1,
      tipo: "Carteira do conselho",
      numero: "TESTE-PR-0001",
      validade: somarDias(hoje, 90),
    },
  ];
}

export function bloqueiosIniciais(hoje: string): BloqueioDemo[] {
  return [
    {
      id: id(35, 1),
      profissionalId: ID_PROFISSIONAL_SUL_1,
      inicio: hoje,
      fim: somarDias(hoje, 3),
      motivo: "Folga",
    },
  ];
}

/** Endereço fictício de atendimento por família (não existe na loja de famílias). */
export const ENDERECOS: Record<string, EnderecoAtendimento> = {
  [familiaPorNome("Maré").id]: {
    logradouro: "Rua Fictícia das Acácias",
    numero: "120",
    complemento: "Apto 32",
    bairro: "Santana",
    cep: "02000-000",
    referencia: "Portaria pelo interfone 32",
  },
  [familiaPorNome("Jade").id]: {
    logradouro: "Alameda Fictícia dos Ipês",
    numero: "45",
    complemento: null,
    bairro: "Perdizes",
    cep: "05000-000",
    referencia: null,
  },
  [familiaPorNome("Lua").id]: {
    logradouro: "Rua Fictícia das Palmeiras",
    numero: "870",
    complemento: "Casa 2",
    bairro: "Centro",
    cep: "86000-000",
    referencia: null,
  },
  [familiaPorNome("Horizonte").id]: {
    logradouro: "Rua Fictícia dos Cedros",
    numero: "300",
    complemento: null,
    bairro: "Itaim Bibi",
    cep: "04500-000",
    referencia: null,
  },
  [familiaPorNome("Íris").id]: {
    logradouro: "Avenida Fictícia do Mar",
    numero: "1500",
    complemento: "Bloco B",
    bairro: "Jardim do Mar",
    cep: "09700-000",
    referencia: null,
  },
};

export const BEBES: Record<string, BebeDemo[]> = {
  [familiaPorNome("Maré").id]: [
    {
      id: id(36, 1),
      ordem: 1,
      nome: "Bebê Teste Maré",
      sexo: "feminino",
      pesoNascimentoG: 3210,
      pesoAltaG: 3090,
      tipoParto: "normal",
    },
  ],
  [familiaPorNome("Jade").id]: [
    {
      id: id(36, 2),
      ordem: 1,
      nome: "Bebê Teste Jade",
      sexo: "masculino",
      pesoNascimentoG: 3480,
      pesoAltaG: 3350,
      tipoParto: "cesarea",
    },
  ],
  [familiaPorNome("Lua").id]: [
    {
      id: id(36, 3),
      ordem: 1,
      nome: "Bebê Um Teste Lua",
      sexo: "feminino",
      pesoNascimentoG: 2620,
      pesoAltaG: 2540,
      tipoParto: "cesarea",
    },
    {
      id: id(36, 4),
      ordem: 2,
      nome: "Bebê Dois Teste Lua",
      sexo: "feminino",
      pesoNascimentoG: 2710,
      pesoAltaG: 2630,
      tipoParto: "cesarea",
    },
  ],
};

export const MEDICOS: Record<string, MedicoDemo[]> = {
  [familiaPorNome("Maré").id]: [
    {
      id: id(37, 1),
      especialidade: "obstetra",
      nome: "Médica Teste Obstetra",
      telefoneE164: "+5511900001101",
      hospital: "Hospital Fictício Santana",
    },
    {
      id: id(37, 2),
      especialidade: "pediatra",
      nome: "Médico Teste Pediatra",
      telefoneE164: "+5511900001102",
      hospital: null,
    },
  ],
  [familiaPorNome("Jade").id]: [
    {
      id: id(37, 3),
      especialidade: "obstetra",
      nome: "Médica Teste Perdizes",
      telefoneE164: "+5511900001103",
      hospital: null,
    },
  ],
  [familiaPorNome("Lua").id]: [
    {
      id: id(37, 4),
      especialidade: "pediatra",
      nome: "Médico Teste Londrina",
      telefoneE164: "+5511900001104",
      hospital: "Hospital Fictício Londrina",
    },
  ],
};
