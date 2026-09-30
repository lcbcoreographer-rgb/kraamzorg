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
import type { AssistencialRepositorio } from "./tipos-assistencial";
import type {
  AberturaFormulario,
  Condutor,
  DadosFormularioContrato,
  DesfechoSessao,
  FiltroSessoes,
  GravacaoSessao,
  LinkFormulario,
  PedidoAgendarSessao,
  PedidoProposta,
  PedidoRemarcarSessao,
  Proposta,
  ResultadoAgendarSessao,
  ResultadoDesfecho,
  ResultadoEnvioFormulario,
  ResultadoProposta,
  ResumoSessao,
  SessaoVenda,
  TransferenciaReuniao,
} from "./tipos-venda";

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

/**
 * Venda (P29 sessão de venda, P30 proposta e link do formulário). Toda
 * escrita vai por função do schema api (0018_venda.sql), que move o P1 e o
 * P2, cria as tarefas e grava o log na mesma transação. Recusa de negócio
 * vira ErroRepositorio "recusado" com "venda:<código>" no detalhe
 * (codigoVenda em erros.ts).
 */
export interface VendaRepositorio {
  /** Quem pode conduzir a sessão (coordenação e diretoria ativas). */
  listarCondutores(): Promise<Condutor[]>;
  /** Agenda: `api.sessoes_venda`, com o nome de quem conduz. */
  listarSessoes(filtro?: FiltroSessoes): Promise<SessaoVenda[]>;
  /** A transferência "reuniao" com as opções que a família passou. */
  obterTransferenciaReuniao(
    handoffId: string,
  ): Promise<TransferenciaReuniao | null>;
  agendarSessao(pedido: PedidoAgendarSessao): Promise<ResultadoAgendarSessao>;
  remarcarSessao(pedido: PedidoRemarcarSessao): Promise<{ sessaoId: string }>;
  registrarDesfecho(
    sessaoId: string,
    desfecho: DesfechoSessao,
    parceiroPresente: boolean | null,
  ): Promise<ResultadoDesfecho>;
  /**
   * `api.sessao_venda_gravacao`: só quem conduziu e a diretoria, AAL2, com
   * a leitura gravada no log. null quando ainda não há nada registrado.
   */
  obterGravacao(sessaoId: string): Promise<GravacaoSessao | null>;
  registrarGravacao(
    sessaoId: string,
    consentimento: boolean,
    transcricao: string | null,
  ): Promise<void>;
  salvarResumo(sessaoId: string, resumo: ResumoSessao): Promise<void>;
  /** Oportunidade aberta da família (a proposta parte dela). */
  oportunidadeDaFamilia(familiaId: string): Promise<string | null>;
  obterProposta(oportunidadeId: string): Promise<Proposta>;
  salvarProposta(pedido: PedidoProposta): Promise<ResultadoProposta>;
  aprovarDesconto(oportunidadeId: string): Promise<void>;
  gerarLinkFormulario(oportunidadeId: string): Promise<LinkFormulario>;
}

export interface Repositorios {
  familias: FamiliasRepositorio;
  ficha: FichaRepositorio;
  tarefas: TarefasRepositorio;
  configuracoes: ConfiguracoesRepositorio;
  agente: AgenteRepositorio;
  usuarios: UsuariosRepositorio;
  venda: VendaRepositorio;
  /** Checklist diário, registro assinado e alertas clínicos (P39 e P40). */
  assistencial: AssistencialRepositorio;
}

/**
 * Formulário seguro público (P30 item 2): sem usuário logado. Na real, o
 * servidor chama as duas funções public.formulario_contrato_* com o
 * cliente de serviço (único papel com execute); na demonstração, a loja em
 * memória. A origem é o IP da requisição, que o banco guarda só como HMAC.
 */
export interface FormularioContratoRepositorio {
  abrir(token: string, origem: string | null): Promise<AberturaFormulario>;
  enviar(
    token: string,
    dados: DadosFormularioContrato,
    origem: string | null,
  ): Promise<ResultadoEnvioFormulario>;
}
