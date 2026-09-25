import type { Json } from "@/lib/db/types";
import type {
  CartaoOportunidade,
  EstadoSensivel,
  EstagioP1,
  EstagioP2,
  EventoLinhaDoTempo,
  Ficha,
  FiltroConversas,
  FiltroFamilias,
  FiltroPipeline,
  FiltroTarefas,
  FiltroTransferencias,
  Mensagem,
  MensagemModelo,
  NumeroPipeline,
  PacoteVigente,
  Parametro,
  PedidoConvite,
  PedidoTransicao,
  Regiao,
  ResultadoConvite,
  ResultadoFreio,
  ResumoConversa,
  ResumoFamilia,
  Tarefa,
  Transferencia,
  UsuarioSistema,
} from "./tipos";

/**
 * Interfaces dos repositórios, uma por domínio. Toda tela lê e grava por
 * elas, e nunca sabe se do outro lado está o Supabase (a real, com RLS e as
 * funções do schema api) ou a demonstração (dados fictícios em memória).
 *
 * Regras que as duas implementações cumprem:
 * - Leitura passa pela RLS do usuário logado (na demonstração, pelo mesmo
 *   recorte simplificado por papel).
 * - Escrita relevante e dado sensível vão pelas funções do schema api
 *   (transição de estágio, freio, dados de contrato). Nada de update direto
 *   de estágio: o banco recusa (PRD 7).
 * - Erro vira ErroRepositorio com um código que a tela traduz em frase.
 *
 * Dono de cada domínio (quem acrescenta métodos): famílias e pipeline P15,
 * ficha P16, tarefas P18, configurações P13, agente P27, usuários P07.
 */

export interface FamiliasRepositorio {
  /** Cartões do pipeline 1 ou 2 com os filtros da tela (P15). */
  listarPipeline(filtro: FiltroPipeline): Promise<CartaoOportunidade[]>;
  /** Quantas oportunidades em cada estágio do pipeline. */
  contarPorEstagio(
    pipeline: NumeroPipeline,
  ): Promise<Partial<Record<EstagioP1 | EstagioP2, number>>>;
  listarFamilias(filtro?: FiltroFamilias): Promise<ResumoFamilia[]>;
  /** Muda o estágio por `api.transicionar` (única porta, PRD 7). */
  transicionar(pedido: PedidoTransicao): Promise<Json>;
}

export interface FichaRepositorio {
  /** null quando a família não existe ou a RLS não deixa ver. */
  obterFicha(familiaId: string): Promise<Ficha | null>;
  /** Eventos da família; os restritos só chegam para quem pode (RLS). */
  linhaDoTempo(familiaId: string): Promise<EventoLinhaDoTempo[]>;
  /** `api.dados_contrato`: completo exige AAL2 e grava a leitura no log. */
  dadosContrato(pessoaId: string, completo: boolean): Promise<Json>;
  acionarFreio(
    familiaId: string,
    estado: EstadoSensivel,
    motivo?: string,
  ): Promise<ResultadoFreio>;
  desfazerFreio(familiaId: string): Promise<ResultadoFreio>;
  justificarFreio(familiaId: string, motivo: string): Promise<ResultadoFreio>;
  reverterFreio(
    familiaId: string,
    estado: EstadoSensivel,
    justificativa: string,
  ): Promise<ResultadoFreio>;
}

export interface TarefasRepositorio {
  listarTarefas(filtro?: FiltroTarefas): Promise<Tarefa[]>;
  concluirTarefa(tarefaId: string): Promise<void>;
}

export interface ConfiguracoesRepositorio {
  /** null quando o parâmetro não existe ou o papel não lê parâmetros. */
  lerParametro(chave: string): Promise<Parametro | null>;
  listarParametros(): Promise<Parametro[]>;
  /** Texto para a família sempre vem daqui, nunca do código (CLAUDE.md). */
  obterMensagemModelo(chave: string): Promise<MensagemModelo | null>;
  listarMensagensModelo(filtro?: {
    destinatario?: string;
  }): Promise<MensagemModelo[]>;
  /** Versão vigente de cada pacote na data (PRD 6.3, D-06). */
  listarPacotesVigentes(data: string): Promise<PacoteVigente[]>;
  listarRegioes(): Promise<Regiao[]>;
}

export interface AgenteRepositorio {
  listarConversas(filtro?: FiltroConversas): Promise<ResumoConversa[]>;
  mensagensDaConversa(conversaId: string): Promise<Mensagem[]>;
  listarTransferencias(filtro?: FiltroTransferencias): Promise<Transferencia[]>;
  /** Assume a transferência para o usuário logado. */
  assumirTransferencia(transferenciaId: string): Promise<void>;
}

export interface UsuariosRepositorio {
  /** Perfis com papéis e último acesso (tela de sessões da diretoria). */
  listarUsuarios(): Promise<UsuarioSistema[]>;
  /** Convite da diretoria: cria o usuário, o perfil e os papéis. */
  convidarUsuario(pedido: PedidoConvite): Promise<ResultadoConvite>;
  /** Encerra todas as sessões abertas de uma pessoa (PRD 13 e 21.2). */
  revogarSessoes(usuarioId: string): Promise<void>;
}

export interface Repositorios {
  familias: FamiliasRepositorio;
  ficha: FichaRepositorio;
  tarefas: TarefasRepositorio;
  configuracoes: ConfiguracoesRepositorio;
  agente: AgenteRepositorio;
  usuarios: UsuariosRepositorio;
}
