import doc2 from "../../../../supabase/dados/instrumentos/doc2.json";
import doc4 from "../../../../supabase/dados/instrumentos/doc4.json";
import {
  lerDefinicao,
  type DefinicaoInstrumento,
} from "@/lib/instrumentos/schema";
import {
  CATALOGO_REGRAS,
  SINAIS_SEM_CAMPO,
  type LinhaRegraAlerta,
} from "@/lib/regras-alerta";
import type {
  BebeChecklist,
  EstadoVisita,
  MedicoChecklist,
  ParametrosChecklist,
  ProfissionalChecklist,
} from "../tipos-assistencial";
import type { EstadoSensivel } from "../tipos";

/**
 * Dados fictícios do checklist no modo demonstração (P39 e P40). Nenhum
 * nome, telefone ou texto de pessoa real: famílias "Família Teste ...",
 * bebês "Bebê Teste ...", telefones da faixa +55 11 90000-0xxx. O
 * instrumento é o aprovado (supabase/dados/instrumentos) e as regras são
 * as do catálogo espelhado do seed (`regra_alerta`). Nada clínico é
 * inventado aqui: os valores dos registros dos dias anteriores são só
 * exemplos plausíveis para as telas terem o que mostrar.
 */

export const VERSAO_INSTRUMENTO = "v1-2026-09";

export const DEFINICAO_DOC2: DefinicaoInstrumento = lerDefinicao(doc2);
export const DEFINICAO_DOC4: DefinicaoInstrumento = lerDefinicao(doc4);

const id = (grupo: number, n: number) =>
  `00000000-0000-4000-8${grupo.toString().padStart(3, "0")}-${n.toString().padStart(12, "0")}`;

/** Perfil de teste da enfermeira e da coordenação (mesmos ids do CRM de demonstração). */
export const ID_USUARIO_ENFERMEIRA = "00000000-0000-4000-8001-000000000006";
export const ID_USUARIO_COORDENACAO = "00000000-0000-4000-8001-000000000002";

export const PROFISSIONAL_ENFERMEIRA: ProfissionalChecklist & {
  usuarioId: string;
} = {
  id: id(500, 1),
  usuarioId: ID_USUARIO_ENFERMEIRA,
  nome: "Enfermeira Teste Lima",
  conselho: "COREN",
  conselhoUf: "SP",
  conselhoNumero: "000000",
};

/** Outra enfermeira: dona das visitas que a enfermeira de teste não pode abrir. */
export const PROFISSIONAL_OUTRA: ProfissionalChecklist & { usuarioId: string } =
  {
    id: id(500, 2),
    usuarioId: id(500, 92),
    nome: "Enfermeira Teste Souza",
    conselho: "COREN",
    conselhoUf: "SP",
    conselhoNumero: "000001",
  };

export interface FamiliaDemoAssistencial {
  id: string;
  nomeExibicao: string;
  bairro: string;
  estadoSensivel: EstadoSensivel;
  gemelar: boolean;
  dpp: string | null;
  dataNascimento: string | null;
  dataAlta: string | null;
  dataInicioEfetivo: string | null;
}

export interface VisitaDemoAssistencial {
  id: string;
  familiaId: string;
  acompanhamentoId: string;
  profissionalId: string;
  diaNumero: number;
  diasContratados: number;
  data: string;
  horaPrevista: string;
  estado: EstadoVisita;
  checkinEm: string | null;
  checkoutEm: string | null;
  versao: number;
}

export interface RegistroDemoAssistencial {
  id: string;
  visitaId: string;
  profissionalId: string;
  instrumentoVersao: string;
  dados: Record<string, unknown>;
  resumoDescritivo: string;
  assinadoEm: string;
  assinatura: string;
  adendos: {
    id: string;
    motivo: string;
    conteudo: string;
    criadoEm: string;
    autor: string | null;
    autorUsuarioId: string;
  }[];
}

export interface AlertaDemoAssistencial {
  id: string;
  familiaId: string;
  visitaId: string | null;
  bebeId: string | null;
  regraId: string;
  severidade: "imediato" | "prioritario" | "atencao" | "informativo";
  campo: string | null;
  valorObservado: string | null;
  conduta: string;
  criadoEm: string;
  reconhecidoEm: string | null;
  sinalIdentificado: string | null;
  acionadoEm: string | null;
  orientacaoMedica: string | null;
  condutaAdotada: string | null;
  fechadoEm: string | null;
  versao: number;
}

export interface MedicoDemoAssistencial extends MedicoChecklist {
  familiaId: string;
}

export interface TarefaDemoAssistencial {
  id: string;
  tipo: "obter_contato_medico";
  familiaId: string;
  titulo: string;
  status: "aberta" | "concluida";
  criadoEm: string;
}

export interface AudioDemoAssistencial {
  id: string;
  visitaId: string;
  arquivoPath: string;
  duracaoSeg: number | null;
  criadoEm: string;
}

export interface LojaAssistencial {
  familias: FamiliaDemoAssistencial[];
  bebes: (BebeChecklist & { familiaId: string })[];
  visitas: VisitaDemoAssistencial[];
  registros: RegistroDemoAssistencial[];
  alertas: AlertaDemoAssistencial[];
  medicos: MedicoDemoAssistencial[];
  tarefas: TarefaDemoAssistencial[];
  audios: AudioDemoAssistencial[];
  ocorrenciasPrivadas: { id: string; familiaId: string; regraId: string }[];
  avisosCoordenacao: { id: string; titulo: string; regraId: string }[];
  regras: LinhaRegraAlerta[];
  parametros: ParametrosChecklist;
}

/** Data de hoje em Brasília (aaaa-mm-dd), com deslocamento em dias. */
export function dataBrasilia(deslocamentoDias = 0, agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const base =
    Date.parse(`${partes}T12:00:00Z`) + deslocamentoDias * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

/** As linhas de `regra_alerta` do catálogo espelhado do seed (38 regras do DOC 3). */
export function regrasDoDoc3(): LinhaRegraAlerta[] {
  const vistas = new Set<string>();
  const linhas: LinhaRegraAlerta[] = [];
  for (const regra of CATALOGO_REGRAS) {
    if (regra.id !== regra.codigo || vistas.has(regra.codigo)) continue;
    if (!/^(PU|SM|RN|AM)-\d{2}$/.test(regra.codigo)) continue;
    vistas.add(regra.codigo);
    linhas.push({
      id: regra.codigo,
      grupo: regra.grupo,
      descricao: regra.descricao,
      severidade: regra.severidade,
      conduta: regra.conduta,
      campo: regra.campo,
      condicao: regra.condicao,
      instrumento_versao: VERSAO_INSTRUMENTO,
      ativa: regra.ativa,
    });
  }
  // Sinais do DOC 3 sem campo no checklist: no seed são linhas desligadas
  // e sem campo; o catálogo os traz na lista do seletor (K-07).
  for (const sinal of SINAIS_SEM_CAMPO) {
    if (vistas.has(sinal.codigo)) continue;
    vistas.add(sinal.codigo);
    linhas.push({
      id: sinal.codigo,
      grupo: sinal.grupo,
      descricao: sinal.descricao,
      severidade: sinal.severidade,
      conduta: sinal.conduta,
      campo: null,
      condicao: null,
      instrumento_versao: VERSAO_INSTRUMENTO,
      ativa: false,
    });
  }
  return linhas.sort((a, b) => a.id.localeCompare(b.id));
}

interface ValoresDoDia {
  data: string;
  horario?: string;
  temperatura: number;
  sistolica?: number;
  diastolica?: number;
  frequenciaCardiaca?: number;
  pesoBebe: number;
  temperaturaBebe?: number;
  medicacoes?: string;
  intervencoesDor?: string;
  quemApoia?: string;
}

/**
 * Um registro completo do dia (todos os obrigatórios do DOC 2 v1) para um
 * ou mais bebês, com valores neutros. Serve às fixtures e aos testes.
 */
export function dadosDeExemplo(
  v: ValoresDoDia,
  bebeIds: string[],
): Record<string, unknown> {
  const porBebe = (
    extra: (bebeId: string, i: number) => Record<string, unknown>,
  ) => bebeIds.map((bebeId, i) => ({ bebe_id: bebeId, ...extra(bebeId, i) }));
  const dados: Record<string, unknown> = {
    "1": { data: v.data, horario: v.horario ?? "09:30" },
    "2.1": {
      pressao_arterial: {
        partes: {
          sistolica: v.sistolica ?? 118,
          diastolica: v.diastolica ?? 76,
        },
      },
      temperatura: v.temperatura,
      frequencia_cardiaca: v.frequenciaCardiaca ?? 78,
    },
    "2.3": v.medicacoes ? { medicacoes_em_uso: v.medicacoes } : {},
    "2.5": {
      turgidas_ou_secretantes: true,
      flacidas: false,
      ingurgitadas: false,
    },
    "2.6": {
      dor_mamilos_amamentar: false,
      evn: 1,
      intervencoes_para_dor: v.intervencoesDor ?? "Nenhuma necessária",
    },
    "2.7": {
      lesao_mamilar: "nao",
      nts: 0,
      interrupcao_adequada_succao: true,
    },
    "2.8": {
      latch: { valor: 9, complemento: "otimo" },
      teste_da_linguinha: "normal",
    },
    "2.9": { fbm_aplicada: ["nao_aplicada"] },
    "2.10": {
      bicos_artificiais: false,
      forros_e_conchas: false,
      bomba_de_extracao: false,
    },
    "2.11": { succoes_por_dia: "mais_de_8" },
    "2.12": { producao_de_leite: "normal" },
    "2.13": {
      sente_se_apoiada: 8,
      quem_mais_apoia: v.quemApoia ?? "Parceiro",
    },
    "3": porBebe(() => ({
      respiracao_sem_sinais_esforco: true,
      atividade_responsividade_preservadas: true,
    })),
    "3.1": porBebe(() => ({
      temperatura: v.temperaturaBebe ?? 36.8,
      frequencia_cardiaca: 132,
      frequencia_respiratoria: 42,
      peso: v.pesoBebe,
    })),
  };
  if (!v.medicacoes) delete dados["2.3"];
  return dados;
}

export const FAMILIAS_DEMO = (): FamiliaDemoAssistencial[] => [
  {
    id: id(510, 1),
    nomeExibicao: "Família Teste Aurora",
    bairro: "Vila Teste",
    estadoSensivel: "normal",
    gemelar: false,
    dpp: dataBrasilia(-2),
    dataNascimento: dataBrasilia(-8),
    dataAlta: dataBrasilia(-5),
    dataInicioEfetivo: dataBrasilia(-4),
  },
  {
    id: id(510, 2),
    nomeExibicao: "Família Teste Brisa",
    bairro: "Jardim Teste",
    estadoSensivel: "normal",
    gemelar: true,
    dpp: dataBrasilia(2),
    dataNascimento: dataBrasilia(-4),
    dataAlta: dataBrasilia(-2),
    dataInicioEfetivo: dataBrasilia(-1),
  },
  {
    id: id(510, 3),
    nomeExibicao: "Família Teste Cedro",
    bairro: "Centro Teste",
    estadoSensivel: "normal",
    gemelar: false,
    dpp: dataBrasilia(-12),
    dataNascimento: dataBrasilia(-13),
    dataAlta: dataBrasilia(-10),
    dataInicioEfetivo: dataBrasilia(-9),
  },
  {
    id: id(510, 4),
    nomeExibicao: "Família Teste Dália",
    bairro: "Alto Teste",
    estadoSensivel: "normal",
    gemelar: false,
    dpp: dataBrasilia(-6),
    dataNascimento: dataBrasilia(-7),
    dataAlta: dataBrasilia(-5),
    dataInicioEfetivo: dataBrasilia(-4),
  },
  {
    id: id(510, 5),
    nomeExibicao: "Família Teste Bruma",
    bairro: "Praça Teste",
    estadoSensivel: "bloqueio_total",
    gemelar: false,
    dpp: dataBrasilia(-3),
    dataNascimento: null,
    dataAlta: null,
    dataInicioEfetivo: null,
  },
  {
    id: id(510, 6),
    nomeExibicao: "Família Teste Estrela",
    bairro: "Parque Teste",
    estadoSensivel: "normal",
    gemelar: false,
    dpp: dataBrasilia(-4),
    dataNascimento: dataBrasilia(-5),
    dataAlta: dataBrasilia(-3),
    dataInicioEfetivo: dataBrasilia(-2),
  },
];

export const BEBES_DEMO = (): (BebeChecklist & { familiaId: string })[] => [
  {
    id: id(520, 1),
    familiaId: id(510, 1),
    ordem: 1,
    nome: "Bebê Teste Aurora",
    dataNascimento: dataBrasilia(-8),
    pesoNascimentoG: 3320,
    pesoAltaG: 3110,
  },
  {
    id: id(520, 2),
    familiaId: id(510, 2),
    ordem: 1,
    nome: "Bebê Teste Brisa Um",
    dataNascimento: dataBrasilia(-4),
    pesoNascimentoG: 2480,
    pesoAltaG: 2390,
  },
  {
    id: id(520, 3),
    familiaId: id(510, 2),
    ordem: 2,
    nome: "Bebê Teste Brisa Dois",
    dataNascimento: dataBrasilia(-4),
    pesoNascimentoG: 2510,
    pesoAltaG: 2420,
  },
  {
    id: id(520, 4),
    familiaId: id(510, 3),
    ordem: 1,
    nome: "Bebê Teste Cedro",
    dataNascimento: dataBrasilia(-13),
    pesoNascimentoG: 3150,
    pesoAltaG: 3000,
  },
  {
    id: id(520, 5),
    familiaId: id(510, 4),
    ordem: 1,
    nome: "Bebê Teste Dália",
    dataNascimento: dataBrasilia(-7),
    pesoNascimentoG: 3400,
    pesoAltaG: 3250,
  },
  {
    id: id(520, 6),
    familiaId: id(510, 5),
    ordem: 1,
    nome: null,
    dataNascimento: null,
    pesoNascimentoG: null,
    pesoAltaG: null,
  },
  {
    id: id(520, 7),
    familiaId: id(510, 6),
    ordem: 1,
    nome: "Bebê Teste Estrela",
    dataNascimento: dataBrasilia(-5),
    pesoNascimentoG: 3050,
    pesoAltaG: 2960,
  },
];

function visita(
  n: number,
  familia: number,
  dia: number,
  dias: number,
  deslocamento: number,
  estado: EstadoVisita,
  profissionalId = PROFISSIONAL_ENFERMEIRA.id,
): VisitaDemoAssistencial {
  const data = dataBrasilia(deslocamento);
  const iniciada = !["agendada", "confirmada", "a_caminho"].includes(estado);
  return {
    id: id(530, n),
    familiaId: id(510, familia),
    acompanhamentoId: id(540, familia),
    profissionalId,
    diaNumero: dia,
    diasContratados: dias,
    data,
    horaPrevista: "09:30",
    estado,
    checkinEm: iniciada ? `${data}T12:35:00.000Z` : null,
    checkoutEm: null,
    versao: 1,
  };
}

/**
 * Visitas de hoje e dos dias anteriores. Aurora D4 de 6 (com D1 a D3
 * assinados), Brisa D2 de 6 com gêmeos, Cedro no último dia (D6 de 6), Dália
 * com o D3 já assinado, Bruma em estado sensível e uma visita de outra
 * enfermeira.
 */
export const VISITAS_DEMO = (): VisitaDemoAssistencial[] => [
  visita(1, 1, 1, 6, -3, "ficha_entregue"),
  visita(2, 1, 2, 6, -2, "ficha_entregue"),
  visita(3, 1, 3, 6, -1, "ficha_entregue"),
  visita(4, 1, 4, 6, 0, "iniciada"),
  visita(5, 2, 1, 6, -1, "ficha_entregue"),
  visita(6, 2, 2, 6, 0, "iniciada"),
  visita(7, 3, 5, 6, -1, "ficha_entregue"),
  visita(8, 3, 6, 6, 0, "iniciada"),
  visita(9, 4, 3, 6, 0, "ficha_entregue"),
  visita(10, 5, 2, 6, 0, "iniciada"),
  visita(11, 6, 2, 6, 0, "iniciada", PROFISSIONAL_OUTRA.id),
];

export const MEDICOS_DEMO = (): MedicoDemoAssistencial[] => [
  {
    id: id(550, 1),
    familiaId: id(510, 1),
    especialidade: "obstetra",
    nome: "Dra. Teste Obstetra",
    telefoneE164: "+5511900000801",
    email: null,
  },
];

export function parametrosDemo(): ParametrosChecklist {
  return {
    transcricaoAudioAtiva: false,
    // A demonstração liga o seletor para mostrar o fluxo; em produção ele
    // nasce desligado até a validação clínica da lista (K-07).
    seletorSinaisAtivo: true,
    supervisaoTelefone: "+5511900000099",
    audioUrlAssinadaSegundos: 60,
    audio: {
      duracaoMaxSeg: 1800,
      tamanhoMaxBytes: 26_214_400,
      tipos: ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"],
    },
  };
}

/** Registros assinados dos dias anteriores e do D3 de Dália. */
export function registrosIniciais(
  visitas: VisitaDemoAssistencial[],
  bebes: (BebeChecklist & { familiaId: string })[],
): RegistroDemoAssistencial[] {
  const porVisita = (n: number) => visitas.find((v) => v.id === id(530, n))!;
  const bebesDe = (familia: number) =>
    bebes.filter((b) => b.familiaId === id(510, familia)).map((b) => b.id);
  const registro = (
    n: number,
    familia: number,
    valores: Omit<ValoresDoDia, "data">,
    resumo: string,
    extra: Record<string, unknown> = {},
  ): RegistroDemoAssistencial => {
    const v = porVisita(n);
    return {
      id: id(560, n),
      visitaId: v.id,
      profissionalId: v.profissionalId,
      instrumentoVersao: VERSAO_INSTRUMENTO,
      dados: {
        ...dadosDeExemplo({ ...valores, data: v.data }, bebesDe(familia)),
        ...extra,
      },
      resumoDescritivo: resumo,
      assinadoEm: `${v.data}T15:10:00.000Z`,
      // Assinatura de fixture: o servidor de demonstração só confere a de
      // registro novo; estes já vêm gravados.
      assinatura: "0".repeat(64),
      adendos: [],
    };
  };
  return [
    registro(
      1,
      1,
      {
        temperatura: 36.7,
        pesoBebe: 3080,
        medicacoes: "Paracetamol 750 mg, se dor",
      },
      "Primeira visita: puérpera bem, amamentação em livre demanda.",
    ),
    registro(
      2,
      1,
      {
        temperatura: 36.8,
        pesoBebe: 3120,
        medicacoes: "Paracetamol 750 mg, se dor",
      },
      "Segunda visita: sem intercorrências.",
    ),
    registro(
      3,
      1,
      {
        temperatura: 36.9,
        pesoBebe: 3180,
        medicacoes: "Paracetamol 750 mg, se dor",
        intervencoesDor: "Compressa morna e pega corrigida",
        quemApoia: "Parceiro e avó materna",
      },
      "Terceira visita: pega corrigida, bebê ganhando peso.",
    ),
    registro(
      5,
      2,
      { temperatura: 36.7, pesoBebe: 2400 },
      "Primeira visita dos gêmeos: mamadas em livre demanda.",
    ),
    registro(
      7,
      3,
      { temperatura: 36.6, pesoBebe: 3160 },
      "Quinta visita: rotina organizada.",
    ),
    registro(
      9,
      4,
      { temperatura: 36.6, pesoBebe: 3300 },
      "Terceira visita de Dália: tudo tranquilo.",
    ),
  ];
}

export function alertasIniciais(): AlertaDemoAssistencial[] {
  const regras = regrasDoDoc3();
  const pu01 = regras.find((r) => r.id === "PU-01")!;
  const rn08 = regras.find((r) => r.id === "RN-08")!;
  return [
    {
      id: id(570, 1),
      familiaId: id(510, 3),
      visitaId: id(530, 7),
      bebeId: id(520, 4),
      regraId: "RN-08",
      severidade: "imediato",
      campo: "3.1.temperatura",
      valorObservado: "38,3",
      conduta: rn08.conduta,
      criadoEm: `${dataBrasilia(-1)}T14:00:00.000Z`,
      reconhecidoEm: null,
      sinalIdentificado: null,
      acionadoEm: null,
      orientacaoMedica: null,
      condutaAdotada: null,
      fechadoEm: null,
      versao: 1,
    },
    {
      id: id(570, 2),
      familiaId: id(510, 4),
      visitaId: id(530, 9),
      bebeId: null,
      regraId: "PU-01",
      severidade: "imediato",
      campo: "2.1.temperatura",
      valorObservado: "38,4",
      conduta: pu01.conduta,
      criadoEm: `${dataBrasilia(-2)}T13:00:00.000Z`,
      reconhecidoEm: `${dataBrasilia(-2)}T13:20:00.000Z`,
      sinalIdentificado: "Temperatura de 38,4 °C confirmada em reavaliação.",
      acionadoEm: `${dataBrasilia(-2)}T13:25:00.000Z`,
      orientacaoMedica: "Observação com antitérmico e reavaliação em 2 horas.",
      condutaAdotada: "Antitérmico administrado; temperatura normalizada.",
      fechadoEm: `${dataBrasilia(-2)}T16:00:00.000Z`,
      versao: 3,
    },
  ];
}
