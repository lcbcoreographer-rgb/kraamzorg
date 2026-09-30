import type { Enums } from "@/lib/db/types";
import type { EstadoSensivel } from "./tipos";

/**
 * Tipos de domínio da equipe, da agenda (P37) e do portal da enfermeira
 * (P38). Espelham as funções `api` da migration 0022_agenda_portal.sql: os
 * campos do banco (snake_case) viram camelCase aqui, e a tela nunca vê o
 * formato do banco.
 */

export type EstadoVisita = Enums<"estado_visita">;
export type VinculoProfissional = Enums<"vinculo_profissional">;
export type EstadoAcompanhamento = Enums<"estado_acompanhamento">;
export type PapelDesignacao = Enums<"papel_designacao">;

/**
 * Estado calculado da profissional (fluxo C, PRD 6.5). Nunca digitado: sai
 * das designações, das visitas e dos bloqueios de agenda. A ordem é a da
 * precedência do banco (`privado.status_profissional`).
 */
export type EstadoProfissional = Enums<"status_profissional">;

export const ORDEM_ESTADOS_PROFISSIONAL: readonly EstadoProfissional[] = [
  "em_visita",
  "em_atendimento",
  "reservada",
  "backup",
  "oferta_pendente",
  "folga",
  "livre",
];

export type TurnoVisita = "manha" | "tarde";

export type CodigoConflito =
  | "profissional_inativa"
  | "bloqueio"
  | "limite_visitas_dia"
  | "periodo_diferente_do_d1"
  | "sobreposicao";

export interface ConflitoAgenda {
  codigo: CodigoConflito;
  /** Só em `limite_visitas_dia`: o limite do parâmetro e quantas ficariam. */
  limite?: number;
  quantas?: number;
  /** Só em `periodo_diferente_do_d1`: o turno pedido e o da família. */
  turno?: string;
  referencia?: string;
  /** Só em `sobreposicao`: a outra visita. */
  visitaId?: string;
}

export type SituacaoDocumento =
  "vencido" | "vencendo" | "em_dia" | "sem_validade";

export interface DocumentoProfissional {
  id: string;
  tipo: string;
  numero: string | null;
  validade: string | null;
  situacao: SituacaoDocumento;
}

export interface BloqueioAgenda {
  id: string;
  inicio: string;
  fim: string;
  motivo: string;
}

export interface FamiliaEmCurso {
  familiaId: string;
  nomeExibicao: string;
  papel: PapelDesignacao;
  acompanhamentoId: string;
  estado: EstadoAcompanhamento;
  diasContratados: number;
  /** "D3 de 6": o último dia já iniciado ou feito; null antes do primeiro. */
  diaAtual: number | null;
  dpp: string | null;
  dataNascimento: string | null;
}

export interface DiaDaSemana {
  dia: string;
  status: EstadoProfissional;
}

export interface ProfissionalEquipe {
  id: string;
  nome: string;
  funcao: string;
  /** A coordenação está na lista mas não faz visita. */
  atendeVisitas: boolean;
  conselho: string | null;
  conselhoUf: string | null;
  conselhoNumero: string | null;
  telefoneE164: string | null;
  regioes: string[];
  vinculo: VinculoProfissional;
  valorHoraCentavos: number | null;
  adicionalDeslocamentoCentavos: number;
  ativa: boolean;
  temUsuario: boolean;
  /** Quem entra no portal por esta profissional; null enquanto não há acesso. */
  usuarioId: string | null;
  /** Do dia pedido; null quando a profissional está inativa. */
  status: EstadoProfissional | null;
  visitasNoDia: number;
  semana: DiaDaSemana[];
  familias: FamiliaEmCurso[];
  ofertasPendentes: number;
  documentos: DocumentoProfissional[];
  bloqueios: BloqueioAgenda[];
}

export interface ResumoEquipe {
  emVisita: number;
  emAtendimento: number;
  reservada: number;
  backup: number;
  ofertaPendente: number;
  folga: number;
  livre: number;
  /** Horas da oferta mais antiga sem resposta; null sem oferta. */
  ofertaMaisAntigaHoras: number | null;
}

export interface EquipeVisao {
  dia: string;
  hoje: string;
  semanaInicio: string;
  /** Dias antes do vencimento em que o documento passa a "vencendo". */
  documentoAvisoDias: number;
  limiteVisitasDia: number;
  /** Sugestões de tipo de documento (parâmetro), a lista ainda é provisória. */
  documentoTipos: string[];
  resumo: ResumoEquipe;
  profissionais: ProfissionalEquipe[];
}

export interface FiltroEquipe {
  regiaoId?: string | null;
  /** Dia do estado calculado; padrão hoje. */
  dia?: string | null;
  incluirInativas?: boolean;
}

export type EstadoCelulaEscala =
  "visita" | "folga" | "reservada" | "backup" | "oferta" | "livre";

export interface CelulaEscala {
  estado: EstadoCelulaEscala;
  visitas: number;
  conflito: boolean;
}

export interface DiaEscala {
  dia: string;
  manha: CelulaEscala;
  tarde: CelulaEscala;
  visitas: number;
  /** Visitas do dia sem hora nem período, que não cabem em nenhum turno. */
  semTurno: number;
  sobrecarga: boolean;
  folga: boolean;
}

export interface LinhaEscala {
  profissionalId: string;
  nome: string;
  dias: DiaEscala[];
}

export interface EscalaSemana {
  semanaInicio: string;
  limiteVisitasDia: number;
  profissionais: LinhaEscala[];
}

export interface FiltroEscala {
  semana?: string | null;
  regiaoId?: string | null;
}

export interface VisitaAgenda {
  visitaId: string;
  acompanhamentoId: string;
  familiaId: string;
  nomeExibicao: string;
  bairro: string | null;
  cidade: string | null;
  diaNumero: number;
  diasContratados: number;
  data: string;
  horaPrevista: string | null;
  horasPorVisita: number;
  turno: TurnoVisita | null;
  estado: EstadoVisita;
  profissionalId: string;
  profissionalNome: string;
  /** Ainda dá para reagendar (a visita não começou). */
  movivel: boolean;
  conflitos: ConflitoAgenda[];
}

export interface AgendaPeriodo {
  desde: string;
  ate: string;
  limiteVisitasDia: number;
  visitas: VisitaAgenda[];
}

export interface FiltroAgenda {
  desde: string;
  ate: string;
  profissionalId?: string | null;
}

export interface PedidoReagendarVisita {
  visitaId: string;
  data: string;
  /** "HH:MM"; vazio mantém a hora (logo o período). */
  horaPrevista?: string | null;
  /** Vazio mantém a profissional. */
  profissionalId?: string | null;
  motivo?: string | null;
  /** Só devolve os conflitos, sem gravar. */
  simular?: boolean;
  /** Grava mesmo com conflito (exige motivo). */
  forcar?: boolean;
}

export interface ResultadoReagendarVisita {
  simulado: boolean;
  conflitos: ConflitoAgenda[];
}

export interface PedidoCascata {
  acompanhamentoId: string;
  novaDataInicio: string;
  motivo?: string | null;
  simular?: boolean;
  forcar?: boolean;
}

export interface VisitaDaCascata {
  visitaId: string;
  diaNumero: number;
  de: string;
  para: string;
  horaPrevista: string | null;
  profissionalId: string;
  conflitos: ConflitoAgenda[];
}

export interface ResultadoCascata {
  simulado: boolean;
  deslocamentoDias: number;
  conflitosTotal: number;
  visitas: VisitaDaCascata[];
}

export interface PedidoProfissional {
  /** Vazio cria. */
  id?: string | null;
  nome: string;
  funcao: string;
  conselhoUf?: string | null;
  conselhoNumero?: string | null;
  telefoneE164?: string | null;
  regioes: string[];
  vinculo: VinculoProfissional;
  valorHoraCentavos?: number | null;
  adicionalDeslocamentoCentavos?: number | null;
  ativa: boolean;
  usuarioId?: string | null;
}

export interface PedidoDocumento {
  id?: string | null;
  profissionalId: string;
  tipo: string;
  numero?: string | null;
  validade?: string | null;
}

export interface PedidoBloqueio {
  id?: string | null;
  profissionalId: string;
  inicio: string;
  fim: string;
  motivo: string;
}

export interface VisitaAfetada {
  visitaId: string;
  data: string;
  diaNumero: number;
}

export interface ResultadoBloqueio {
  id: string;
  visitasAfetadas: VisitaAfetada[];
}

// --- Portal da enfermeira (P38) ------------------------------------------------

export interface EnderecoAtendimento {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  referencia?: string | null;
}

export interface VisitaPortal {
  visitaId: string;
  acompanhamentoId: string;
  familiaId: string;
  nomeExibicao: string;
  bairro: string | null;
  endereco: EnderecoAtendimento | null;
  cidade: string | null;
  uf: string | null;
  diaNumero: number;
  diasContratados: number;
  data: string;
  horaPrevista: string | null;
  horasPorVisita: number;
  turno: TurnoVisita | null;
  estado: EstadoVisita;
  checkinEm: string | null;
  checkoutEm: string | null;
  versao: number;
  papel: PapelDesignacao | null;
  estadoSensivel: EstadoSensivel;
  gemelar: boolean;
  contatoNome: string | null;
  contatoTelefone: string | null;
}

export interface FichaPendentePortal {
  visitaId: string;
  familiaId: string;
  nomeExibicao: string;
  diaNumero: number;
  diasContratados: number;
  data: string;
  estado: EstadoVisita;
}

export interface PortalHoje {
  dia: string;
  profissionalId: string;
  profissionalNome: string;
  status: EstadoProfissional;
  visitas: VisitaPortal[];
  fichasPendentes: FichaPendentePortal[];
}

export interface VisitaDaFamiliaPortal {
  visitaId: string;
  diaNumero: number;
  data: string;
  horaPrevista: string | null;
  estado: EstadoVisita;
  checkinEm: string | null;
  checkoutEm: string | null;
}

export interface FamiliaPortal {
  familiaId: string;
  nomeExibicao: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  dpp: string | null;
  dataNascimento: string | null;
  dataAlta: string | null;
  dataInicioEfetivo: string | null;
  gemelar: boolean;
  estadoSensivel: EstadoSensivel;
  papel: PapelDesignacao;
  acompanhamento: {
    id: string;
    estado: EstadoAcompanhamento;
    diasContratados: number;
    periodo: "manha" | "tarde" | "noite_avaliar" | null;
    inicioEfetivo: string | null;
    encerramento: string | null;
  } | null;
  visitas: VisitaDaFamiliaPortal[];
}

export interface PessoaFichaPortal {
  id: string;
  papel: string;
  nome: string;
  telefoneE164: string | null;
  email: string | null;
  contatoPrincipal: boolean;
}

export interface BebeFichaPortal {
  id: string;
  ordem: number;
  nome: string | null;
  sexo: string | null;
  dataNascimento: string | null;
  pesoNascimentoG: number | null;
  pesoAltaG: number | null;
  tipoParto: string | null;
}

export interface MedicoFichaPortal {
  id: string;
  especialidade: string;
  nome: string;
  telefoneE164: string | null;
  hospital: string | null;
}

/** A ficha assistencial da família (`api.ficha_assistencial`), sem dado comercial. */
export interface FichaAssistencialPortal {
  familia: {
    id: string;
    nomeExibicao: string;
    bairro: string | null;
    endereco: EnderecoAtendimento | null;
    cidade: string | null;
    uf: string | null;
    dpp: string | null;
    idadeGestacional: string | null;
    dataNascimento: string | null;
    dataAlta: string | null;
    dataInicioEfetivo: string | null;
    gemelar: boolean;
    estadoSensivel: EstadoSensivel;
  };
  pessoas: PessoaFichaPortal[];
  bebes: BebeFichaPortal[];
  medicos: MedicoFichaPortal[];
}

export interface PerfilPortal {
  profissional: {
    id: string;
    nome: string;
    funcao: string;
    conselho: string | null;
    conselhoUf: string | null;
    conselhoNumero: string | null;
    telefoneE164: string | null;
    regioes: string[];
  };
  status: EstadoProfissional;
  documentos: DocumentoProfissional[];
  bloqueios: { id: string; inicio: string; fim: string }[];
}

/** O que o motor de sincronização precisa saber de uma visita (P12 + P38). */
export interface EstadoVisitaSync {
  visitaId: string;
  versao: number;
  estado: EstadoVisita;
  checkinEm: string | null;
  checkoutEm: string | null;
}
