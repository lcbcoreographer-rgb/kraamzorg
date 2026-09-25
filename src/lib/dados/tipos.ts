import type { Papel } from "@/lib/auth/papeis";
import type { Enums, Json } from "@/lib/db/types";

/**
 * Tipos de domínio que as telas recebem dos repositórios. Nomes em
 * camelCase na tela; no banco continuam snake_case (PRD 5.2). Datas chegam
 * como texto ISO (`date` como "2026-09-24", `timestamptz` com fuso) e são
 * formatadas na tela por src/lib/formatacao. Dinheiro em centavos.
 */

export type EstagioP1 = Enums<"estagio_p1">;
export type EstagioP2 = Enums<"estagio_p2">;
export type EstadoSensivel = Enums<"estado_sensivel">;
export type ClassificacaoLead = Enums<"classificacao_lead">;
export type Prioridade = Enums<"prioridade">;
export type StatusTarefa = Enums<"status_tarefa">;
export type TipoTarefa = Enums<"tipo_tarefa">;
export type StatusHandoff = Enums<"status_handoff">;
export type MotivoHandoff = Enums<"handoff_motivo">;
export type DestinoHandoff = Enums<"handoff_destino">;
export type ClassificacaoContato = Enums<"classificacao_contato">;
export type EnviadoPor = Enums<"enviado_por">;
export type DirecaoMensagem = Enums<"direcao_mensagem">;
export type StatusConteudo = Enums<"status_conteudo">;
export type PapelPessoa = Enums<"papel_pessoa">;
export type MotivoPerda = Enums<"motivo_perda">;

// --- Famílias e pipeline (P15, P16) -----------------------------------------

export type NumeroPipeline = 1 | 2;

export interface FiltroPipeline {
  pipeline: NumeroPipeline;
  estagio?: EstagioP1 | EstagioP2;
  regiaoId?: string;
  responsavelId?: string;
  classificacao?: ClassificacaoLead;
  /** Nome da família ou telefone (qualquer formato). */
  busca?: string;
}

/** Cartão da oportunidade no pipeline (P15 item 3). */
export interface CartaoOportunidade {
  oportunidadeId: string;
  familiaId: string;
  nomeFamilia: string;
  pipeline: NumeroPipeline;
  estagioP1: EstagioP1 | null;
  estagioP2: EstagioP2 | null;
  classificacao: ClassificacaoLead | null;
  score: number | null;
  responsavelId: string | null;
  dpp: string | null;
  dataNascimento: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  estadoSensivel: EstadoSensivel;
  proximoContatoEm: string | null;
  pdfEnviadoEm: string | null;
  motivoPerda: MotivoPerda | null;
  atualizadoEm: string;
  transferenciaAberta: boolean;
}

export interface FiltroFamilias {
  busca?: string;
  limite?: number;
  /** Só estas famílias (ex: as donas das conversas de uma lista). */
  ids?: string[];
}

export interface ResumoFamilia {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  dpp: string | null;
  dataNascimento: string | null;
  estadoSensivel: EstadoSensivel;
  naoContatar: boolean;
  gemelar: boolean;
}

export interface PedidoTransicao {
  /** Máquina de estado (PRD 7): "p1", "p2", "p3", "p4" ou "visita". */
  maquina: string;
  entidadeId: string;
  para: string;
  motivo?: string;
}

// --- Ficha 360 (P16) -------------------------------------------------------

export interface PessoaFicha {
  id: string;
  papel: PapelPessoa;
  nome: string;
  telefoneE164: string | null;
  email: string | null;
  contatoPrincipal: boolean;
}

export interface EventoLinhaDoTempo {
  id: number;
  tipo: string;
  titulo: string;
  criadoEm: string;
  restrito: boolean;
  dados: Json;
}

export interface Ficha {
  familia: ResumoFamilia & {
    dataAlta: string | null;
    dataInicioEfetivo: string | null;
    estadoSensivelEm: string | null;
    primeiraGestacao: boolean | null;
  };
  pessoas: PessoaFicha[];
  oportunidade: CartaoOportunidade | null;
}

export interface ResultadoFreio {
  ok: boolean;
  /** Resposta da função api.* do freio, como veio do banco. */
  resposta: Json;
}

// --- Tarefas (P18) ---------------------------------------------------------

export interface FiltroTarefas {
  status?: StatusTarefa[];
  familiaId?: string;
  /** Só as do usuário logado (responsável ou papel responsável). */
  minhas?: boolean;
}

export interface Tarefa {
  id: string;
  tipo: TipoTarefa;
  titulo: string;
  prioridade: Prioridade;
  status: StatusTarefa;
  venceEm: string | null;
  familiaId: string | null;
  nomeFamilia: string | null;
  responsavelId: string | null;
  papelResponsavel: Papel | null;
  payload: Json;
  criadoEm: string;
}

// --- Configurações (P13) ---------------------------------------------------

export interface Parametro {
  chave: string;
  valor: Json;
  descricao: string | null;
  atualizadoEm: string;
}

export interface MensagemModelo {
  chave: string;
  canal: Enums<"canal_contato">;
  destinatario: string;
  texto: string;
  variaveis: string[];
  status: StatusConteudo;
  aprovadoEm: string | null;
}

export interface PacoteVigente {
  pacoteId: string;
  versaoId: string;
  nome: string;
  dias: number;
  gemelar: boolean;
  valorCentavos: number;
  parcelasMaxSemJuros: number;
  vigenciaInicio: string;
}

export interface Regiao {
  id: string;
  nome: string;
  praca: string;
  taxaDeslocamentoCentavos: number;
  ativa: boolean;
}

// --- Agente: conversas e transferências (P27) -----------------------------

export interface FiltroConversas {
  /** Isadora conduzindo, com a equipe, pausadas ou não lead (C5). */
  situacao?: "isadora" | "equipe" | "pausada" | "nao_lead";
  /** Só as conversas desta família (aba Conversas da ficha, P16). */
  familiaId?: string;
  limite?: number;
}

export interface ResumoConversa {
  id: string;
  familiaId: string | null;
  nomeFamilia: string | null;
  nomeContato: string | null;
  telefoneE164: string | null;
  classificacao: ClassificacaoContato;
  agentePausadoAte: string | null;
  agenteEncerradoEm: string | null;
  agenteEncerradoMotivo: string | null;
  ultimaEntradaEm: string | null;
  ultimaSaidaEm: string | null;
  transferenciaAbertaId: string | null;
}

export interface Mensagem {
  id: string;
  direcao: DirecaoMensagem;
  enviadoPor: EnviadoPor;
  tipo: string;
  conteudo: string | null;
  enviadaEm: string;
}

export interface FiltroTransferencias {
  status?: StatusHandoff[];
  destino?: DestinoHandoff;
}

export interface Transferencia {
  id: string;
  conversaId: string | null;
  familiaId: string | null;
  nomeFamilia: string | null;
  motivo: MotivoHandoff;
  destino: DestinoHandoff;
  prioridade: Prioridade;
  resumo: string;
  status: StatusHandoff;
  slaVenceEm: string | null;
  notificacaoOk: boolean | null;
  assumidoPor: string | null;
  assumidoEm: string | null;
  criadoEm: string;
}

// --- Usuários, equipe e sessões (P07) --------------------------------------

export interface UsuarioSistema {
  id: string;
  nome: string;
  email: string;
  papeis: Papel[];
  ativo: boolean;
  /** Último login registrado no Supabase Auth; null se nunca entrou. */
  ultimoAcessoEm: string | null;
}

export interface PedidoConvite {
  nome: string;
  email: string;
  papeis: Papel[];
  /** Para onde o link do e-mail leva depois de conferido. */
  urlRetorno: string;
}

export type ResultadoConvite =
  | { ok: true; usuarioId: string }
  | { ok: false; erro: "email_em_uso" | "sem_permissao" | "indisponivel" };
