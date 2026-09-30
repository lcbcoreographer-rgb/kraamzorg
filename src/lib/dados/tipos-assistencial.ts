import type { DefinicaoInstrumento } from "@/lib/instrumentos/schema";
import type { LinhaRegraAlerta } from "@/lib/regras-alerta";
import type { EstadoSensivel } from "./tipos";

/**
 * Tipos do domínio assistencial: checklist diário (P39), registro assinado
 * e adendos, alertas clínicos (P40). Vêm das funções `api.checklist_visita`,
 * `api.alertas_clinicos` e afins (migration 0023). Nada aqui inventa campo
 * clínico: o formulário nasce da definição do instrumento aprovado.
 */

export type EstadoVisita =
  | "agendada"
  | "confirmada"
  | "a_caminho"
  | "iniciada"
  | "concluida"
  | "ficha_pendente"
  | "ficha_entregue"
  | "encerrada"
  | "reagendada"
  | "cancelada"
  | "nao_realizada_familia"
  | "nao_realizada_profissional";

export type SeveridadeAlerta =
  "imediato" | "prioritario" | "atencao" | "informativo";

export interface VisitaChecklist {
  id: string;
  acompanhamentoId: string;
  profissionalId: string;
  diaNumero: number;
  /** Data da visita (aaaa-mm-dd). */
  data: string;
  horaPrevista: string | null;
  estado: EstadoVisita;
  checkinEm: string | null;
  checkoutEm: string | null;
  versao: number;
}

export interface FamiliaChecklist {
  id: string;
  nomeExibicao: string;
  bairro: string | null;
  estadoSensivel: EstadoSensivel;
  dpp: string | null;
  dataNascimento: string | null;
  dataAlta: string | null;
  dataInicioEfetivo: string | null;
  gemelar: boolean;
}

export interface ProfissionalChecklist {
  id: string;
  nome: string;
  conselho: string | null;
  conselhoUf: string | null;
  conselhoNumero: string | null;
}

export interface BebeChecklist {
  id: string;
  ordem: number;
  nome: string | null;
  dataNascimento: string | null;
  pesoNascimentoG: number | null;
  pesoAltaG: number | null;
}

export interface MedicoChecklist {
  id: string;
  especialidade: "obstetra" | "pediatra" | "outro";
  nome: string;
  telefoneE164: string | null;
  email: string | null;
}

export interface AdendoRegistro {
  id: string;
  motivo: string;
  conteudo: string;
  criadoEm: string;
  autor: string | null;
}

export interface RegistroAssinado {
  id: string;
  profissionalId: string;
  instrumentoVersao: string;
  dados: Record<string, unknown>;
  resumoDescritivo: string;
  assinadoEm: string;
  assinatura: string;
  adendos: AdendoRegistro[];
}

/** Registro de um dia anterior do mesmo acompanhamento (referência e séries). */
export interface RegistroAnterior {
  visitaId: string;
  diaNumero: number;
  data: string;
  dados: Record<string, unknown>;
  resumoDescritivo: string | null;
}

export interface AlertaDaVisita {
  id: string;
  regraId: string;
  bebeId: string | null;
  severidade: SeveridadeAlerta;
  campo: string | null;
  valorObservado: string | null;
  conduta: string;
  reconhecidoEm: string | null;
  sinalIdentificado: string | null;
  acionadoEm: string | null;
  orientacaoMedica: string | null;
  condutaAdotada: string | null;
  fechadoEm: string | null;
  versao: number;
}

export interface AudioDaVisita {
  id: string;
  duracaoSeg: number | null;
  status: "pendente" | "transcrevendo" | "transcrito" | "erro";
  criadoEm: string;
  transcricao: string | null;
}

export interface LimitesAudio {
  duracaoMaxSeg: number;
  tamanhoMaxBytes: number;
  tipos: string[];
}

/** Parâmetros que a tela do checklist lê (nenhum limite fica no código). */
export interface ParametrosChecklist {
  transcricaoAudioAtiva: boolean;
  /** Seletor dos sinais do DOC 3 sem campo: desligado até a validação clínica (K-07). */
  seletorSinaisAtivo: boolean;
  /** Telefone da supervisão médica em E.164; vazio até a Kraamzorg informar. */
  supervisaoTelefone: string;
  audioUrlAssinadaSegundos: number;
  audio: LimitesAudio;
}

export interface ChecklistVisita {
  visita: VisitaChecklist;
  familia: FamiliaChecklist;
  diasContratados: number;
  ultimoDia: boolean;
  profissional: ProfissionalChecklist;
  /** Nulo enquanto nenhuma versão do DOC 2 estiver aprovada. */
  instrumento: { versao: string; definicao: DefinicaoInstrumento } | null;
  /** DOC 4: tabelas LATCH e NTS e protocolos de laserterapia. */
  instrumentoDoc4: DefinicaoInstrumento | null;
  bebes: BebeChecklist[];
  medicos: MedicoChecklist[];
  /** Linhas de `regra_alerta` da versão, para o cache do aparelho. */
  regras: LinhaRegraAlerta[];
  registro: RegistroAssinado | null;
  anteriores: RegistroAnterior[];
  alertas: AlertaDaVisita[];
  audios: AudioDaVisita[];
  parametros: ParametrosChecklist;
}

/** Linha da lista de alertas clínicos (enfermeira, coordenação e diretoria). */
export interface AlertaClinicoResumo {
  id: string;
  familiaId: string;
  nomeFamilia: string;
  estadoSensivel: EstadoSensivel;
  visitaId: string | null;
  diaNumero: number | null;
  bebeId: string | null;
  regraId: string;
  grupo: string;
  descricao: string;
  severidade: SeveridadeAlerta;
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

export type SituacaoAlertas = "abertos" | "fechados" | "todos";

export interface PedidoAcionamento {
  alertaId: string;
  versaoBase: number | null;
  sinalIdentificado?: string;
  acionadoEm?: string;
  orientacaoMedica?: string;
  condutaAdotada?: string;
}

export interface SituacaoContatoMedico {
  obstetra: boolean;
  pediatra: boolean;
  tarefaAberta: boolean;
  evolucaoBloqueada: boolean;
}

export interface AudioParaOuvir {
  arquivoPath: string;
  validadeSeg: number;
}

/** Registro assinado como o aparelho o envia (payload de `registro_atendimento`). */
export interface RegistroParaEnvio {
  visitaId: string;
  profissionalId: string;
  instrumentoVersao: string;
  dados: Record<string, unknown>;
  resumoDescritivo: string;
  assinadoEmMs: number;
  assinatura: string;
}

export interface AssistencialRepositorio {
  /** Nulo quando a visita não existe ou não é visível para o papel. */
  obterChecklist(visitaId: string): Promise<ChecklistVisita | null>;
  /** Grava o registro assinado (o servidor confere assinatura e obrigatórios). */
  registrarAtendimento(
    registro: RegistroParaEnvio,
    alertas: AlertaParaRegistro[],
  ): Promise<{ registroId: string; jaRegistrado: boolean }>;
  registrarAdendo(
    registroId: string,
    motivo: string,
    conteudo: string,
  ): Promise<void>;
  listarAlertas(
    situacao: SituacaoAlertas,
    familiaId?: string,
  ): Promise<AlertaClinicoResumo[]>;
  registrarAcionamento(pedido: PedidoAcionamento): Promise<void>;
  fecharAlerta(alertaId: string, versaoBase: number | null): Promise<void>;
  registrarAlerta(
    pedido: PedidoNovoAlerta,
  ): Promise<{ id: string; criado: boolean }>;
  /** Telefone da supervisão médica em E.164 (parâmetro); vazio se não informado. */
  telefoneSupervisao(): Promise<string>;
  situacaoContatoMedico(familiaId: string): Promise<SituacaoContatoMedico>;
  registrarAudio(
    visitaId: string,
    arquivoPath: string,
    duracaoSeg: number | null,
  ): Promise<{ id: string }>;
  audioParaOuvir(audioId: string): Promise<AudioParaOuvir>;
  /** Freio em um toque no cabeçalho do checklist (PRD 8.3). */
  acionarFreio(familiaId: string): Promise<void>;
}

/** Alerta que o servidor reavaliou e entrega junto do registro (PRD 9.3). */
export interface AlertaParaRegistro {
  regraId: string;
  bebeId: string | null;
  campo: string | null;
  valorObservado: string | null;
}

export interface PedidoNovoAlerta {
  visitaId: string;
  regraId: string;
  instrumentoVersao: string;
  bebeId: string | null;
  campo: string | null;
  valorObservado: string | null;
  /** Sinal escolhido no seletor do DOC 3 (K-07), não avaliado por regra. */
  manual: boolean;
}
