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
import type { EvolucaoRepositorio } from "./tipos-evolucao";
import type { NotaRepositorio } from "./tipos-nota";
import type {
  OcorrenciaRepositorio,
  PesquisaPublicaRepositorio,
  PosVendaRepositorio,
} from "./tipos-ocorrencia";
import type { GestaoRepositorio } from "./tipos-gestao";
import type { RelacaoRepositorio } from "./tipos-relacao";
import type {
  AgendaPeriodo,
  EquipeVisao,
  EscalaSemana,
  EstadoVisitaSync,
  FamiliaPortal,
  FichaAssistencialPortal,
  FiltroAgenda,
  FiltroEquipe,
  FiltroEscala,
  PedidoBloqueio,
  PedidoCascata,
  PedidoDocumento,
  PedidoProfissional,
  PedidoReagendarVisita,
  PerfilPortal,
  PortalHoje,
  ResultadoBloqueio,
  ResultadoCascata,
  ResultadoReagendarVisita,
} from "./tipos-equipe";
import type {
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "@/lib/sync/tipos";
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
import type {
  CobrancaDetalhe,
  DadosLinkPagamento,
  DadosParaContrato,
  ListaCobrancas,
  PedidoBaixaManual,
  ReservaEnvioContrato,
  SituacaoCobranca,
  SituacaoContrato,
} from "./tipos-contrato";
import type {
  AlocacaoFamilia,
  ConsultaPrenatalResumo,
  EntrevistaPrenatal,
  EstadoPrenatal,
  Oferta,
  PedidoAgendarConsulta,
  PedidoAlta,
  PedidoAtribuir,
  PedidoNascimento,
  PedidoOferecer,
  PedidoSalvarCampo,
  Radar,
  ResultadoAlta,
  ResultadoNascimento,
  ResultadoResposta,
  ResultadoSalvarCampo,
} from "./tipos-operacao";

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
  /**
   * [v4.3] Realizada e não compareceu: só coordenação e diretoria (a
   * Edilaine). Realizada leva a conversa ao Leonardo (`humano_comercial`);
   * `resultado` é o campo curto que vai no resumo dele. Cancelada: só
   * reunião marcada pela equipe.
   */
  registrarDesfecho(
    sessaoId: string,
    desfecho: DesfechoSessao,
    parceiroPresente: boolean | null,
    resultado?: string | null,
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

/**
 * Contrato e assinatura eletrônica (P31). O PDF e a Autentique ficam no
 * servidor (src/modules/crm/contrato); aqui só o que o banco decide: etapa,
 * dados para o PDF (com CPF, leitura registrada), contrato gerado e o envio
 * em três passos (reservar, concluir, liberar).
 */
export interface ContratoRepositorio {
  obterSituacao(familiaId: string): Promise<SituacaoContrato>;
  dadosParaContrato(contratoId: string): Promise<DadosParaContrato>;
  registrarGerado(
    contratoId: string,
    pdfPath: string,
    pdfSha256: string,
  ): Promise<void>;
  reservarEnvio(contratoId: string): Promise<ReservaEnvioContrato>;
  concluirEnvio(contratoId: string, documentoId: string): Promise<void>;
  liberarEnvio(contratoId: string): Promise<void>;
}

/** Cobrança pela InfinitePay (P32): financeiro e diretoria, sempre em AAL2. */
export interface CobrancaRepositorio {
  listar(situacao?: SituacaoCobranca): Promise<ListaCobrancas>;
  obter(cobrancaId: string): Promise<CobrancaDetalhe>;
  /** Cobrança do contrato assinado (idempotente). Devolve o id da cobrança. */
  gerarDoContrato(contratoId: string): Promise<string>;
  dadosLinkPagamento(cobrancaId: string): Promise<DadosLinkPagamento>;
  registrarLink(
    cobrancaId: string,
    url: string,
    slug: string | null,
  ): Promise<void>;
  baixarManual(pedido: PedidoBaixaManual): Promise<void>;
}

/**
 * Operação (P35 consulta pré-natal, P36 designação, radar, nascimento e
 * alta). Toda escrita e toda leitura de dado assistencial vão por função do
 * schema api (0021_prenatal_nascimento.sql), que confere papel e AAL2 por
 * dentro, grava a leitura no log e move o P2 só por privado.transicionar.
 * Recusa de negócio vira ErroRepositorio "recusado" com "operacao:<código>"
 * no detalhe (codigoOperacao em erros.ts).
 */
export interface OperacaoRepositorio {
  // Consulta pré-natal (P35)
  /** Consultas vivas, sem conteúdo (coordenação e diretoria). */
  listarConsultas(): Promise<ConsultaPrenatalResumo[]>;
  /** Só o estado, para o comercial. */
  estadoPrenatal(familiaId: string): Promise<EstadoPrenatal>;
  agendarConsulta(pedido: PedidoAgendarConsulta): Promise<void>;
  /** Abre a entrevista em branco (a leitura vai para o log). */
  abrirEntrevista(familiaId: string): Promise<EntrevistaPrenatal>;
  /** Um campo por vez; é o que o motor offline sobe. */
  salvarCampo(pedido: PedidoSalvarCampo): Promise<ResultadoSalvarCampo>;
  concluirEntrevista(consultaId: string): Promise<ResultadoNascimento>;
  // Designação (P36)
  alocacao(familiaId: string): Promise<AlocacaoFamilia>;
  oferecer(pedido: PedidoOferecer): Promise<void>;
  atribuir(pedido: PedidoAtribuir): Promise<void>;
  /** As ofertas sem resposta da enfermeira logada. */
  minhasOfertas(): Promise<Oferta[]>;
  responder(
    designacaoId: string,
    aceita: boolean,
    motivo: string | null,
  ): Promise<ResultadoResposta>;
  // Radar, nascimento e alta (P36)
  radar(regiaoId?: string | null): Promise<Radar>;
  registrarNascimento(pedido: PedidoNascimento): Promise<ResultadoNascimento>;
  registrarPrevisaoAlta(familiaId: string, previsao: string): Promise<void>;
  registrarAlta(pedido: PedidoAlta): Promise<ResultadoAlta>;
}

/**
 * Equipe, agenda e escalas (P37). Toda leitura e escrita vai pelas funções
 * do schema api da 0022_agenda_portal.sql (coordenação e diretoria, AAL2).
 * O estado da profissional é sempre calculado pelo banco, nunca gravado.
 * Recusa de negócio vira ErroRepositorio "recusado" com "equipe:<código>"
 * no detalhe (codigoEquipe em erros.ts).
 */
export interface EquipeRepositorio {
  /** Profissionais com o estado do dia e da semana, famílias, documentos e bloqueios. */
  obterEquipe(filtro?: FiltroEquipe): Promise<EquipeVisao>;
  /** Sete dias por dois turnos por profissional. */
  obterEscala(filtro?: FiltroEscala): Promise<EscalaSemana>;
  obterAgenda(filtro: FiltroAgenda): Promise<AgendaPeriodo>;
  /** Com `simular`, só devolve os conflitos (a tela mostra antes de salvar). */
  reagendarVisita(
    pedido: PedidoReagendarVisita,
  ): Promise<ResultadoReagendarVisita>;
  reagendarCascata(pedido: PedidoCascata): Promise<ResultadoCascata>;
  salvarProfissional(
    pedido: PedidoProfissional,
  ): Promise<{ id: string; nova: boolean }>;
  salvarDocumento(pedido: PedidoDocumento): Promise<{ id: string }>;
  salvarBloqueio(pedido: PedidoBloqueio): Promise<ResultadoBloqueio>;
  removerBloqueio(bloqueioId: string): Promise<void>;
}

/**
 * Portal da enfermeira (P38): só as famílias atribuídas, sem dado comercial,
 * lidas por funções que gravam a leitura no log. Chegada e saída sobem pelo
 * motor offline do P12 (POST /api/sync): os métodos `sync*` e
 * `registrar*Sincronizada` são a porta que o servidor de sincronização usa,
 * com a sessão da própria enfermeira.
 */
export interface PortalRepositorio {
  obterHoje(dia?: string | null): Promise<PortalHoje>;
  listarFamilias(): Promise<FamiliaPortal[]>;
  /** null quando a família não está atribuída à enfermeira. */
  obterFichaAssistencial(
    familiaId: string,
  ): Promise<FichaAssistencialPortal | null>;
  obterPerfil(): Promise<PerfilPortal>;

  /** Estado da visita para o protocolo de sincronização (versão e horas). */
  estadoDaVisita(visitaId: string): Promise<EstadoVisitaSync | null>;
  registrarChegadaSincronizada(
    visitaId: string,
    quando: string,
  ): Promise<{ versao: number }>;
  registrarSaidaSincronizada(
    visitaId: string,
    quando: string,
  ): Promise<{ versao: number }>;
  /** Idempotência do item da fila do aparelho (fila_sincronizacao). */
  resultadoProcessado(
    itemId: string,
  ): Promise<ResultadoItemSincronizacao | null>;
  guardarProcessado(
    item: ItemSincronizacaoEntrada,
    resultado: ResultadoItemSincronizacao,
  ): Promise<void>;
}

export interface Repositorios {
  familias: FamiliasRepositorio;
  ficha: FichaRepositorio;
  tarefas: TarefasRepositorio;
  configuracoes: ConfiguracoesRepositorio;
  agente: AgenteRepositorio;
  usuarios: UsuariosRepositorio;
  venda: VendaRepositorio;
  contratos: ContratoRepositorio;
  cobrancas: CobrancaRepositorio;
  operacao: OperacaoRepositorio;
  equipe: EquipeRepositorio;
  portal: PortalRepositorio;
  /** Checklist diário, registro assinado e alertas clínicos (P39 e P40). */
  assistencial: AssistencialRepositorio;
  /** Evolução de enfermagem aos médicos: rascunho, revisão, aprovação e envio (P41). */
  evolucoes: EvolucaoRepositorio;
  /** Ocorrências com SLA, privada e histórico (P42). */
  ocorrencias: OcorrenciaRepositorio;
  /** Pipeline 4: pesquisa, NPS e as ações do pós-venda (P42). */
  posVenda: PosVendaRepositorio;
  /** Nota fiscal de serviço: estados, tentativas, arquivos e emissão manual assistida (P43). */
  notas: NotaRepositorio;
  /** Capacidade, financeiro e painel executivo da Fase 3 (P45, P46 e P52). */
  gestao: GestaoRepositorio;
  /** Marketing, copiloto, portal da família (equipe), parceiros, manuais e talentos (P47 a P51). */
  relacao: RelacaoRepositorio;
}

/** Pesquisa pública da família (P42): sem usuário logado, por isso fora de obterRepositorios(). */
export type { PesquisaPublicaRepositorio };

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
