import type { Enums } from "@/lib/db/types";
import type {
  EstadoSensivel,
  EstagioP1,
  EstagioP2,
  PapelPessoa,
  StatusHandoff,
} from "./tipos";

/**
 * Tipos da venda (P29 sessão de venda e P30 proposta e formulário seguro),
 * no mesmo padrão de tipos.ts: camelCase na tela, datas em texto ISO,
 * dinheiro em centavos. Ficam num arquivo próprio para o domínio crescer
 * sem mexer nos tipos das outras telas.
 */

export type StatusSessao = Enums<"status_sessao">;
export type CategoriaTarefa = Enums<"categoria_automacao">;
export type StatusContrato = Enums<"status_contrato">;
export type DesfechoSessao = Extract<
  StatusSessao,
  "realizada" | "nao_compareceu" | "cancelada"
>;

// --- Sessão de venda (P29) --------------------------------------------------

export interface Condutor {
  id: string;
  nome: string;
}

export interface FiltroSessoes {
  desde?: string;
  ate?: string;
  familiaId?: string;
  sessaoId?: string;
}

/** Quem marcou a reunião: a Isadora (Google Calendar) ou a equipe (P29). */
export type OrigemAgendamento = "isadora" | "humano";

/** Quem conduz a conversa com a família hoje (D-20). */
export type ConversaCom = "isadora" | "leonardo";

export interface SessaoVenda {
  id: string;
  familiaId: string;
  nomeFamilia: string;
  estadoSensivel: EstadoSensivel;
  dpp: string | null;
  dataNascimento: string | null;
  agendadaPara: string | null;
  status: StatusSessao;
  realizadaEm: string | null;
  linkReuniao: string | null;
  opcoesInformadas: string | null;
  parceiroPresente: boolean | null;
  conduzidaPor: string | null;
  conduzidaPorNome: string | null;
  criadoEm: string;
  /** Quem pede conduziu a sessão ou é diretoria (PRD 13). */
  podeVerGravacao: boolean;
  /** Só vem para quem pode ver e está em AAL2; null para os demais. */
  gravacaoRegistrada: boolean | null;
  /** [v4.3] Quem marcou: a Isadora, pelo Google Calendar, ou a equipe. */
  agendadaPor: OrigemAgendamento;
  /** [v4.3] Lembrete da véspera que a Isadora enviou. */
  lembreteEnviadoEm: string | null;
  /** [v4.3] Resultado escrito por quem registrou a reunião (campo curto). */
  resultado: string | null;
  /**
   * [v4.3] Resumo da Isadora para o Leonardo (dados da qualificação e
   * anotações), só no detalhe de uma sessão. Nunca o id do evento.
   */
  resumoIsadora: string | null;
  /** [v4.3] Isadora até a reunião realizada; depois, o Leonardo. */
  conversaCom: ConversaCom;
}

/** A transferência "reuniao" de onde a tela de agendar parte (D-15). */
export interface TransferenciaReuniao {
  id: string;
  familiaId: string;
  nomeFamilia: string;
  dpp: string | null;
  estadoSensivel: EstadoSensivel;
  status: StatusHandoff;
  /** As opções de dia e horário que a família passou à Isadora. */
  opcoes: string[];
  resumo: string;
}

export interface PedidoAgendarSessao {
  familiaId: string;
  agendadaPara: string;
  conduzidaPor: string;
  linkReuniao: string;
  opcoesInformadas?: string | null;
  handoffId?: string | null;
}

export interface ResultadoAgendarSessao {
  sessaoId: string;
  tarefaLembreteId: string | null;
  estagioP1: EstagioP1 | null;
}

export interface PedidoRemarcarSessao {
  sessaoId: string;
  agendadaPara: string;
  linkReuniao?: string | null;
  conduzidaPor?: string | null;
}

export interface ResultadoDesfecho {
  sessaoId: string;
  status: DesfechoSessao;
  tarefaId: string | null;
  estagioP1: EstagioP1 | null;
  /** [v4.3] Reunião realizada: a conversa passou ao Leonardo. */
  humanoComercial: boolean;
  /** [v4.3] Família não veio a uma reunião da Isadora: ela remarca. */
  remarcacaoDaIsadora: boolean;
}

/** Item do resumo: o texto e, quando veio da IA, o trecho da transcrição. */
export interface ItemResumo {
  texto: string;
  trecho?: string | null;
}

export interface ResumoSessao {
  duvidas: string[];
  objecoes: string[];
  planoInteresse: string | null;
  proximosPassos: string[];
  origem: "ia" | "pessoa";
  modelo: string | null;
  salvoEm?: string | null;
}

export interface GravacaoSessao {
  sessaoId: string;
  consentimento: boolean;
  consentimentoVersao: string | null;
  consentimentoEm: string | null;
  transcricao: string | null;
  resumo: ResumoSessao | null;
}

// --- Proposta (P30 item 1) -----------------------------------------------------

export type ParaQuem = "propria" | "presente" | "outro";

export interface PacoteProposta {
  pacoteVersaoId: string;
  pacoteId: string;
  nome: string;
  linha: string | null;
  dias: number;
  gemelar: boolean;
  horasPorVisita: number;
  valorCentavos: number;
  parcelasMaxSemJuros: number;
}

export interface CondicaoProposta {
  id: string;
  nome: string;
  tipo: "desconto_pct" | "parcelamento" | "bonificacao";
  valor: number;
  requerAprovacao: boolean;
}

export interface PessoaProposta {
  id: string;
  nome: string;
  papel: PapelPessoa;
  contatoPrincipal: boolean;
}

export interface ContaProposta {
  valorCentavos: number;
  taxaCentavos: number;
  descontoCentavos: number;
  totalCentavos: number;
  parcelas: number;
  parcelaCentavos: number;
  primeiraParcelaCentavos: number;
}

export type SituacaoFormulario =
  "nao_enviado" | "aguardando" | "vencido" | "recebido";

export interface ContratoProposta {
  id: string;
  status: StatusContrato;
  pacoteVersaoId: string;
  contratantePessoaId: string | null;
  pagadorPessoaId: string | null;
  testemunhaPessoaId: string | null;
  templateVersao: string;
  conta: ContaProposta;
  formulario: {
    situacao: SituacaoFormulario;
    expiraEm: string | null;
    recebidoEm: string | null;
  };
}

export interface Proposta {
  oportunidade: {
    id: string;
    familiaId: string;
    pipeline: 1 | 2;
    estagioP1: EstagioP1 | null;
    estagioP2: EstagioP2 | null;
    paraQuem: ParaQuem | null;
    pagadorPessoaId: string | null;
    condicaoId: string | null;
    descontoPct: number;
    planoInteressePacoteId: string | null;
    precisaAprovacao: boolean;
    descontoAprovado: boolean;
    descontoAprovadoPorNome: string | null;
  };
  familia: {
    id: string;
    nome: string;
    dpp: string | null;
    dataNascimento: string | null;
    gemelar: boolean;
    estadoSensivel: EstadoSensivel;
    naoContatar: boolean;
    cidade: {
      nome: string;
      uf: string;
      atendida: boolean;
      requerConfirmacao: boolean;
      taxaCentavos: number;
    } | null;
  };
  pessoas: PessoaProposta[];
  pacotes: PacoteProposta[];
  condicoes: CondicaoProposta[];
  contrato: ContratoProposta | null;
  formularioValidadeHoras: number | null;
  podeEditar: boolean;
  podeAprovar: boolean;
}

export interface PedidoProposta {
  oportunidadeId: string;
  pacoteVersaoId: string;
  parcelas: number;
  condicaoId: string | null;
  paraQuem: ParaQuem;
  pagadorPessoaId: string | null;
  pagadorNome: string | null;
  descontoPct: number;
  descontoMotivo: string | null;
}

export interface ResultadoProposta {
  contratoId: string;
  conta: ContaProposta;
  precisaAprovacao: boolean;
  descontoAprovado: boolean;
}

export interface LinkFormulario {
  /** Volta uma vez, para montar o link; nunca é gravado nem logado. */
  token: string;
  expiraEm: string;
  contratoId: string;
  tarefaId: string | null;
  estagioP2: EstagioP2 | null;
}

// --- Formulário público (P30 item 2) -------------------------------------------

export interface EnderecoFormulario {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface DadosFormularioContrato {
  gestante: {
    nomeCompleto: string;
    cpf: string;
    /** aaaa-mm-dd */
    dataNascimento: string;
    email: string;
    endereco: EnderecoFormulario;
  };
  atendimentoNoMesmoEndereco: boolean;
  enderecoAtendimento: EnderecoFormulario | null;
  pagador: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    endereco: EnderecoFormulario;
  } | null;
  testemunha: { nomeCompleto: string; email: string } | null;
  consentimento: { aceito: boolean; versao: string };
}

/** Textos formulario_* de mensagem_modelo, sem o prefixo, já preenchidos. */
export type TextosFormulario = Partial<
  Record<
    | "abertura"
    | "abertura_apoio"
    | "ajuda_cpf"
    | "ajuda_email"
    | "ajuda_endereco"
    | "pergunta_atendimento"
    | "ajuda_atendimento"
    | "ajuda_pagador"
    | "ajuda_testemunha"
    | "consentimento"
    | "privacidade"
    | "corrigir"
    | "sem_conexao"
    | "erro_envio"
    | "fim"
    | "link_invalido"
    | "limite",
    string
  >
>;

export type AberturaFormulario =
  | { situacao: "invalido"; textos: TextosFormulario }
  | { situacao: "limite"; minutos: number | null; textos: TextosFormulario }
  | {
      situacao: "valido";
      expiraEm: string;
      pedePagador: boolean;
      nomeGestante: string | null;
      nomePagador: string | null;
      nomeTestemunha: string | null;
      termoVersao: string | null;
      textos: TextosFormulario;
    };

export type ResultadoEnvioFormulario =
  | { situacao: "recebido" }
  | { situacao: "invalido" }
  | { situacao: "limite"; minutos: number | null }
  | { situacao: "corrigir"; erros: Record<string, string> };
