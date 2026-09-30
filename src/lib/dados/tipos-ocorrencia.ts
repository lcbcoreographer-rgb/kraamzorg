/**
 * Tipos das ocorrências, do pós-venda (pipeline 4) e da pesquisa pública
 * (P42, PRD 6.6 e 7.4). Vêm das funções `api.ocorrencias`, `api.pos_vendas` e
 * das funções de servidor `public.pesquisa_*` (migration 0024).
 */

export type TipoOcorrencia =
  | "intercorrencia"
  | "contato_perdido"
  | "registro_atrasado"
  | "capacidade"
  | "experiencia"
  | "reclamacao"
  | "detrator"
  | "outro";

export type StatusOcorrencia =
  | "aberta"
  | "triagem"
  | "responsavel_definido"
  | "em_acompanhamento"
  | "resolvida"
  | "encerrada";

export type PrioridadeOcorrencia = "normal" | "alta" | "maxima";

export type SituacaoOcorrencias = "abertas" | "fechadas" | "todas";

export interface OcorrenciaResumo {
  id: string;
  familiaId: string | null;
  familiaNome: string | null;
  profissionalId: string | null;
  profissionalNome: string | null;
  tipo: TipoOcorrencia;
  prioridade: PrioridadeOcorrencia;
  privada: boolean;
  titulo: string;
  status: StatusOcorrencia;
  responsavelId: string | null;
  responsavelNome: string | null;
  slaVenceEm: string | null;
  vencida: boolean;
  criadoEm: string;
  versao: number;
}

export interface EventoHistorico {
  em: string;
  por: string | null;
  acao: string;
  de?: string;
  para?: string;
  nota?: string;
  prioridade?: string;
  privada?: boolean;
  origem?: string;
}

export interface OcorrenciaDetalhe extends OcorrenciaResumo {
  descricao: string;
  historico: EventoHistorico[];
  resolvidaEm: string | null;
  podeGerir: boolean;
}

export interface ListaOcorrencias {
  resumo: { abertas: number; vencidas: number; privadas: number };
  ocorrencias: OcorrenciaResumo[];
}

export interface PedidoOcorrencia {
  familiaId: string | null;
  profissionalId: string | null;
  tipo: TipoOcorrencia;
  prioridade: PrioridadeOcorrencia;
  privada: boolean;
  titulo: string;
  descricao: string;
  responsavelId: string | null;
}

export interface PedidoAtualizarOcorrencia {
  ocorrenciaId: string;
  status?: StatusOcorrencia;
  responsavelId?: string | null;
  prioridade?: PrioridadeOcorrencia;
  privada?: boolean;
  nota?: string;
  versaoBase?: number | null;
}

export interface PessoaResponsavel {
  id: string;
  nome: string;
}

export interface OcorrenciaRepositorio {
  listar(
    situacao: SituacaoOcorrencias,
    familiaId?: string,
  ): Promise<ListaOcorrencias>;
  obter(ocorrenciaId: string): Promise<OcorrenciaDetalhe>;
  responsaveis(): Promise<PessoaResponsavel[]>;
  registrar(
    pedido: PedidoOcorrencia,
  ): Promise<{ id: string; privada: boolean }>;
  atualizar(
    pedido: PedidoAtualizarOcorrencia,
  ): Promise<{ id: string; status: StatusOcorrencia; versao: number }>;
}

// --- Pós-venda e pesquisa -----------------------------------------------------------------

export type EstagioPosVenda =
  | "protocolo_ultimo_dia_concluido"
  | "pesquisa_enviada"
  | "pesquisa_respondida"
  | "classificado"
  | "acao_executada"
  | "arquivado";

export type ClassificacaoNps = "promotor" | "neutro" | "detrator";

export interface PosVendaItem {
  id: string;
  acompanhamentoId: string;
  familiaId: string;
  familiaNome: string;
  estagio: EstagioPosVenda;
  nps: number | null;
  classificacao: ClassificacaoNps | null;
  depoimentoAutorizado: boolean | null;
  autorizacaoImagem: boolean | null;
  pesquisaEnviadaEm: string | null;
  pesquisaRespondidaEm: string | null;
  pesquisaExpiraEm: string | null;
  linkAtivo: boolean;
  /** O freio segura a pesquisa desta família: `freio` (estado sensível) ou `nao_contatar`. */
  bloqueio: "freio" | "nao_contatar" | null;
  podeGerarLink: boolean;
  acaoExecutadaEm: string | null;
  criadoEm: string;
}

export interface ResumoPosVenda {
  aguardandoEnvio: number;
  aguardandoResposta: number;
  respondidas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  /** NPS em pontos (promotores menos detratores, em % das respondidas); nulo sem resposta. */
  nps: number | null;
}

export interface ListaPosVenda {
  resumo: ResumoPosVenda;
  itens: PosVendaItem[];
}

export interface LinkPesquisa {
  token: string;
  expiraEm: string;
  /** Texto do convite (mensagem_modelo `pesquisa_convite`) com `@@LINK@@` no lugar do link. */
  texto: string | null;
}

export type ResultadoLinkPesquisa =
  ({ bloqueado: false } & LinkPesquisa) | { bloqueado: true; motivo: string };

export interface PosVendaRepositorio {
  listar(situacao: "abertos" | "todos"): Promise<ListaPosVenda>;
  gerarLink(posVendaId: string): Promise<ResultadoLinkPesquisa>;
  marcarEnviada(posVendaId: string): Promise<void>;
  avancar(posVendaId: string): Promise<{ estagio: EstagioPosVenda }>;
}

// --- Pesquisa pública (sem usuário; só o servidor chama) ----------------------------------

export type TipoPergunta = "escala_0_10" | "sim_nao" | "opcao" | "texto";

export interface PerguntaPesquisa {
  id: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  texto: string;
  opcoes?: { valor: string; rotulo: string }[];
  rotuloMin?: string;
  rotuloMax?: string;
}

export interface TextosPesquisa {
  titulo?: string;
  abertura?: string;
  enviar?: string;
  agradecimento?: string;
  link_invalido?: string;
  limite?: string;
  corrigir?: string;
}

export type AberturaPesquisa =
  | {
      situacao: "valido";
      nome: string | null;
      perguntas: PerguntaPesquisa[];
      textos: TextosPesquisa;
    }
  | { situacao: "invalido"; textos: TextosPesquisa }
  | { situacao: "limite"; minutos: number | null; textos: TextosPesquisa };

export type RespostasPesquisa = Record<string, string | number | boolean>;

export type ResultadoEnvioPesquisa =
  | { situacao: "recebido" }
  | { situacao: "invalido" }
  | { situacao: "limite"; minutos: number | null }
  | { situacao: "corrigir"; erros: Record<string, string> };

export interface PesquisaPublicaRepositorio {
  abrir(token: string, origem: string | null): Promise<AberturaPesquisa>;
  enviar(
    token: string,
    respostas: RespostasPesquisa,
    origem: string | null,
  ): Promise<ResultadoEnvioPesquisa>;
}
