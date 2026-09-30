import type { Enums, Json } from "@/lib/db/types";
import type { DefinicaoInstrumento } from "@/lib/instrumentos/schema";
import type { RespostasFormulario } from "@/lib/instrumentos/respostas";
import type { EstadoSensivel, EstagioP2 } from "./tipos";

/**
 * Tipos da operação (P35 consulta pré-natal e alerta de 34 semanas, P36
 * designação, radar de nascimentos, nascimento e alta), no mesmo padrão de
 * tipos.ts: camelCase na tela, datas em texto ISO. Ficam num arquivo próprio
 * para o domínio crescer sem mexer nos tipos das outras telas.
 *
 * As quatro datas nunca se confundem (PRD 6.10 regra 3): `dpp` é estimativa;
 * `dataNascimento`, `dataAlta` e `inicioEfetivo` (o D1) são fatos.
 */

export type StatusConsulta = Enums<"status_consulta">;
export type StatusDesignacao = Enums<"status_designacao">;
export type PapelDesignacao = Enums<"papel_designacao">;
export type PeriodoVisita = Enums<"periodo_visita">;
export type EstadoAcompanhamento = Enums<"estado_acompanhamento">;

// --- Consulta pré-natal (P35) --------------------------------------------------

/** Uma linha da lista da coordenação (`api.prenatal_consultas`). Sem o conteúdo da ficha. */
export interface ConsultaPrenatalResumo {
  consultaId: string;
  familiaId: string;
  nome: string;
  status: StatusConsulta;
  urgente: boolean;
  agendadaPara: string | null;
  realizadaEm: string | null;
  iniciadaEm: string | null;
  /** Etapa onde a pessoa parou (1 a N), nulo se ainda não começou. */
  etapa: number | null;
  parouEm: string | null;
  respondidos: number;
  dpp: string | null;
  /** Idade gestacional calculada da DPP, "34s2d" (nunca gravada). */
  ig: string | null;
  igSemanas: number | null;
  /** Já chegou às semanas de parametro.prenatal_semanas_alerta (34): aviso interno, só da coordenação. */
  chegouAlerta: boolean;
  cidade: string | null;
  uf: string | null;
  estagioP2: EstagioP2 | null;
}

/** O que o comercial vê da consulta: o estado, nunca o conteúdo (`api.prenatal_estado`). */
export interface EstadoPrenatal {
  existe: boolean;
  status: StatusConsulta | null;
  agendadaPara: string | null;
  realizadaEm: string | null;
  emAndamento: boolean;
}

export interface ProgressoEntrevista {
  etapa: number;
  /** "B.percentil": o campo onde a pessoa parou. */
  campo: string | null;
  em: string | null;
}

export interface EntrevistaPrenatal {
  consulta: {
    id: string;
    status: StatusConsulta;
    urgente: boolean;
    agendadaPara: string | null;
    realizadaEm: string | null;
    iniciadaEm: string | null;
    instrumentoVersao: string;
    /** Versão de conflito (PRD 6.10 regra 13): base do próximo campo salvo. */
    versao: number;
    progresso: ProgressoEntrevista | null;
  };
  definicao: DefinicaoInstrumento;
  respostas: RespostasFormulario;
  familia: {
    id: string;
    nome: string;
    dpp: string | null;
    gemelar: boolean;
    cidade: string | null;
    uf: string | null;
    ig: string | null;
    igSemanas: number | null;
  };
  /** "bloco.campo" para o valor que já está no cadastro da mesma família. */
  sugestoes: Record<string, string>;
  /** Nome de quem está conduzindo (o campo Coletador vem do login). */
  coletador: string | null;
}

export interface PedidoAgendarConsulta {
  familiaId: string;
  /** Instante ISO com fuso. */
  agendadaPara: string;
  conduzidaPor?: string | null;
}

export interface PedidoSalvarCampo {
  consultaId: string;
  bloco: string | null;
  campo: string | null;
  valor: Json | null;
  versaoBase: number | null;
  progresso?: { etapa: number; campo?: string | null } | null;
  /** Obrigatório para alterar depois de concluída. */
  motivo?: string | null;
  /** Id do item da fila do aparelho: torna o reenvio idempotente. */
  itemId?: string | null;
}

export interface ResultadoSalvarCampo {
  ok: boolean;
  versao: number;
  conflito: boolean;
  /** Valor que estava lá no conflito, se o banco o devolveu. */
  original: Json | null;
  repetido: boolean;
}

// --- Designação (P36) -------------------------------------------------------------

export interface DesignacaoLinha {
  id: string;
  papel: PapelDesignacao;
  status: StatusDesignacao;
  profissionalId: string;
  profissional: string;
  oferecidaEm: string;
  respondidaEm: string | null;
  prazoRespostaEm: string | null;
  direta: boolean;
  motivoRecusa: string | null;
}

/** Uma visita de D1 a Dn como o banco a gerou na alta. */
export interface VisitaDoAcompanhamento {
  diaNumero: number;
  data: string;
  horaPrevista: string | null;
  estado: Enums<"estado_visita">;
  profissionalId: string;
  profissional: string | null;
}

export interface Candidata {
  profissionalId: string;
  nome: string;
  funcao: string;
  /** Estado calculado de hoje (livre, reservada, em visita...), nulo se não deu para calcular. */
  estadoHoje: Enums<"status_profissional"> | null;
  naRegiao: boolean;
  titularesNaJanela: number;
  bloqueioNaJanela: boolean;
  ofertaPendente: boolean;
  jaNestaFamilia: boolean;
}

/** Tarefa aberta da família que a operação precisa fazer (designar, agendar, check-in, guia). */
export interface PendenciaOperacao {
  tipo: Enums<"tipo_tarefa">;
  titulo: string;
  prioridade: Enums<"prioridade">;
  venceEm: string | null;
}

export interface AlocacaoFamilia {
  familia: {
    id: string;
    nome: string;
    dpp: string | null;
    dataNascimento: string | null;
    dataAlta: string | null;
    dataInicioEfetivo: string | null;
    gemelar: boolean;
    estadoSensivel: EstadoSensivel;
    ig: string | null;
    estagioP2: EstagioP2 | null;
    cidade: string | null;
    uf: string | null;
    regiaoId: string | null;
    janelaInicio: string | null;
    janelaFim: string | null;
    /** Em ordem de preferência; da entrevista pré-natal. */
    periodoPreferido: PeriodoVisita[];
    consultaStatus: StatusConsulta | null;
  };
  acompanhamento: {
    id: string;
    estado: EstadoAcompanhamento;
    dias: number;
    horasPorVisita: number;
    periodo: PeriodoVisita | null;
    inicioEfetivo: string | null;
    previsaoAlta: string | null;
    visitas: number;
    listaVisitas: VisitaDoAcompanhamento[];
  } | null;
  designacoes: DesignacaoLinha[];
  candidatas: Candidata[];
  tarefas: PendenciaOperacao[];
}

export interface PedidoOferecer {
  familiaId: string;
  profissionalId: string;
  papel: PapelDesignacao;
}

export interface PedidoAtribuir extends PedidoOferecer {
  motivo: string;
}

export interface Oferta {
  designacaoId: string;
  papel: PapelDesignacao;
  oferecidaEm: string;
  prazoRespostaEm: string | null;
  vencida: boolean;
  familia: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  dpp: string | null;
  gemelar: boolean;
  dias: number;
  horasPorVisita: number;
  periodo: PeriodoVisita | null;
}

export type DesfechoRecusa =
  | "backup_assumiu"
  | "oferta_passou_ao_backup"
  | "sem_backup"
  | "backup_recusou";

export interface ResultadoResposta {
  ok: boolean;
  aceita: boolean;
  expirada: boolean;
  desfecho: DesfechoRecusa | null;
}

// --- Radar, nascimento e alta (P36) ---------------------------------------------------

export interface DesignadaNoRadar {
  designacaoId: string;
  profissionalId: string;
  nome: string;
  status: StatusDesignacao;
  prazoRespostaEm: string | null;
}

export interface RadarFamilia {
  familiaId: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  regiaoId: string | null;
  regiao: string | null;
  gemelar: boolean;
  dpp: string;
  ig: string;
  igSemanas: number;
  diasParaDpp: number;
  naJanela: boolean;
  passouDaJanela: boolean;
  estagioP2: EstagioP2;
  consultaStatus: StatusConsulta | null;
  titular: DesignadaNoRadar | null;
  backup: DesignadaNoRadar | null;
  ultimoContato: string | null;
  diasSemContato: number | null;
  semContato: boolean;
  checkinPendente: boolean;
  dppSemConfirmacao: boolean;
  dppSemContato: boolean;
  estadoSensivel: EstadoSensivel;
}

export interface RadarNasceu {
  familiaId: string;
  nome: string;
  regiaoId: string | null;
  dataNascimento: string;
  estagioP2: EstagioP2;
  previsaoAlta: string | null;
  titular: string | null;
}

export interface OcupacaoSemana {
  regiaoId: string;
  regiao: string;
  semana: string;
  ocupacaoPct: number;
  familias: number;
  acimaDoLimite: boolean;
}

export interface Radar {
  hoje: string;
  janela: { antes: number; depois: number };
  limiteAlertaPct: number | null;
  familias: RadarFamilia[];
  nasceram: RadarNasceu[];
  ocupacao: OcupacaoSemana[];
}

export interface BebeNascimento {
  nome?: string | null;
  sexo?: "feminino" | "masculino" | "nao_informado" | null;
  pesoNascimentoG?: number | null;
  tipoParto?: "vaginal" | "cesarea" | "nao_informado" | null;
}

export interface PedidoNascimento {
  familiaId: string;
  dataNascimento: string;
  bebes: BebeNascimento[];
  previsaoAlta?: string | null;
}

export interface PedidoAlta {
  familiaId: string;
  dataAlta: string;
  primeiraVisita?: string | null;
  periodo?: PeriodoVisita | null;
}

export interface ResultadoNascimento {
  estagioP2: EstagioP2 | null;
}

export interface ResultadoAlta {
  visitas: number;
  acompanhamentoEstado: EstadoAcompanhamento | null;
  inicioEfetivo: string | null;
  periodo: PeriodoVisita | null;
  estagioP2: EstagioP2 | null;
}
