import type { Enums, Json } from "@/lib/db/types";

/**
 * Tipos do relacionamento da fase 3 (migration 0027): marketing e captação
 * (P47), copiloto (P48), portal da família (P49), parceiros e indicações
 * (P50) e tarefas por equipe, manuais, treinamentos e banco de talentos
 * (P51). Dinheiro em centavos (número inteiro), datas em texto ISO.
 */

export type OrigemLead = Enums<"origem_lead">;

// --- P47 · Marketing, atribuição e captação --------------------------------

export interface CanalCaptacao {
  id: string;
  codigo: string;
  nome: string;
  origem: OrigemLead;
  ativo: boolean;
  visitas: number;
  conversas: number;
}

export interface CanaisMarketing {
  /** Número do WhatsApp que a página de captação abre (E.164). */
  numeroE164: string | null;
  /** Prefixo do código de origem que vai no texto ("KZ"). */
  prefixo: string | null;
  /** Texto pré-preenchido do link, com {codigo} para trocar. */
  textoModelo: string | null;
  canais: CanalCaptacao[];
}

export interface PedidoCanal {
  id: string | null;
  codigo: string;
  nome: string;
  origem: OrigemLead;
  ativo: boolean;
}

export interface PedidoCusto {
  canalId: string;
  /** Qualquer dia do mês (aaaa-mm-dd); o banco guarda o primeiro. */
  mes: string;
  valorCentavos: number;
}

export interface FiltroPeriodo {
  desde?: string | null;
  ate?: string | null;
}

export interface ContagensMarketing {
  leads: number;
  qualificados: number;
  ganhos: number;
  /** Nulos quando o papel não vê valores (matriz do PRD 13). */
  contratosPagos: number | null;
  receitaCentavos: number | null;
  custoCentavos: number | null;
}

export interface LinhaOrigemMarketing extends ContagensMarketing {
  origem: OrigemLead;
}

export interface LinhaCanalMarketing extends ContagensMarketing {
  canalId: string;
  codigo: string;
  nome: string;
  origem: OrigemLead;
  ativo: boolean;
}

export interface RelatorioMarketing {
  desde: string | null;
  ate: string | null;
  veValores: boolean;
  soElegiveis: boolean;
  porOrigem: LinhaOrigemMarketing[];
  porCanal: LinhaCanalMarketing[];
  total: ContagensMarketing;
}

export interface LinhaExportacaoMarketing {
  nomeExibicao: string;
  dpp: string | null;
  gemelar: boolean;
  primeiraGestacao: boolean | null;
  origem: OrigemLead;
  codigoOrigem: string | null;
  utm: Record<string, string> | null;
  criadoEm: string;
}

export interface ExportacaoMarketing {
  linhas: LinhaExportacaoMarketing[];
  limite: number;
}

export interface MarketingRepositorio {
  canais(): Promise<CanaisMarketing>;
  salvarCanal(pedido: PedidoCanal): Promise<CanalCaptacao>;
  salvarCusto(pedido: PedidoCusto): Promise<void>;
  relatorio(filtro: FiltroPeriodo): Promise<RelatorioMarketing>;
  exportar(filtro: FiltroPeriodo): Promise<ExportacaoMarketing>;
}

// --- P48 · Copiloto interno ------------------------------------------------

export const FERRAMENTAS_COPILOTO = [
  "copiloto_pipeline",
  "copiloto_conversao",
  "copiloto_receita",
  "copiloto_ocupacao",
  "copiloto_leads_origem",
] as const;
export type NomeFerramentaCopiloto = (typeof FERRAMENTAS_COPILOTO)[number];

export type SituacaoPerguntaCopiloto =
  "respondida" | "recusada" | "desligado" | "orcamento" | "erro";

export interface ConfigCopiloto {
  ativo: boolean;
  /** Termos, sem acento e em minúsculas, que fazem o copiloto recusar. */
  termosAssistenciais: string[];
  perguntaMaxCaracteres: number;
  orcamentoMensalCentavos: number | null;
  /** Primeiro dia do mês da contagem (aaaa-mm-dd). */
  mes: string;
  perguntasMes: number;
  tokensEntradaMes: number;
  tokensSaidaMes: number;
  custoMesCentavos: number;
}

export interface PedidoRegistroPergunta {
  pergunta: string;
  ferramenta: NomeFerramentaCopiloto | null;
  parametros: Record<string, Json>;
  situacao: SituacaoPerguntaCopiloto;
  motivo?: string | null;
  tokensEntrada: number;
  tokensSaida: number;
}

export interface PerguntaCopiloto {
  id: string;
  em: string;
  pergunta: string;
  ferramenta: NomeFerramentaCopiloto | null;
  situacao: SituacaoPerguntaCopiloto;
  motivo: string | null;
  /** Só a diretoria vê quem perguntou. */
  quem: string | null;
}

export interface CopilotoRepositorio {
  config(): Promise<ConfigCopiloto>;
  registrar(pedido: PedidoRegistroPergunta): Promise<string>;
  historico(limite: number): Promise<PerguntaCopiloto[]>;
  /**
   * Chama a função de leitura escolhida (api.copiloto_*), sempre com as
   * permissões de quem pergunta. Devolve o JSON como o banco devolve.
   */
  executar(
    ferramenta: NomeFerramentaCopiloto,
    parametros: Record<string, Json>,
  ): Promise<Json>;
}

// --- P49 · Portal da família -------------------------------------------------

export type SituacaoAcessoPortal = "sem_acesso" | "liberado" | "suspenso";

export interface PessoaAcessoPortal {
  pessoaId: string;
  papel: string;
  primeiroNome: string;
  temEmail: boolean;
  situacao: SituacaoAcessoPortal;
  entrou: boolean;
  ultimoAcessoEm: string | null;
}

export interface FamiliaAcessoPortal {
  familiaId: string;
  nomeExibicao: string;
  estadoSensivel: Enums<"estado_sensivel">;
  pessoas: PessoaAcessoPortal[];
}

export interface ResultadoLiberarPortal {
  acessoId: string;
  jaLiberado: boolean;
  tarefaId: string | null;
}

export interface AutorizacaoEnfermeiraPortal {
  profissionalId: string;
  nome: string;
  autorizaNome: boolean;
  autorizaFoto: boolean;
  temFoto: boolean;
}

export interface PedidoAutorizacaoEnfermeira {
  profissionalId: string;
  autorizaNome: boolean;
  autorizaFoto: boolean;
  fotoPath?: string | null;
}

export interface AcessoFamiliaRepositorio {
  listar(familiaId?: string): Promise<FamiliaAcessoPortal[]>;
  liberar(pessoaId: string): Promise<ResultadoLiberarPortal>;
  suspender(pessoaId: string): Promise<void>;
  enfermeiras(): Promise<AutorizacaoEnfermeiraPortal[]>;
  salvarAutorizacao(pedido: PedidoAutorizacaoEnfermeira): Promise<void>;
}

/** Contato de uma pessoa da equipe (parametro.portal_familia). */
export interface ContatoEquipePortal {
  nome: string | null;
  telefoneE164: string | null;
  horario: string | null;
  funcao: string | null;
}

export interface PortalVisita {
  dia: number;
  data: string;
  hora: string | null;
  feita: boolean;
}

export type TextosPortal = Record<string, string>;

/** Portal em modo normal. */
export interface PortalFamiliaCompleto {
  situacao: "ok";
  primeiroNome: string;
  nomeFamilia: string;
  gemelar: boolean;
  datas: {
    dpp: string | null;
    dataNascimento: string | null;
    dataAlta: string | null;
    dataInicioEfetivo: string | null;
  };
  contratoAssinadoEm: string | null;
  pagamentoConfirmadoEm: string | null;
  prenatal: {
    estado: string;
    agendadaPara: string | null;
    realizadaEm: string | null;
  } | null;
  acompanhamento: {
    estado: string;
    diasContratados: number;
    inicioEfetivo: string | null;
    encerramento: string | null;
  } | null;
  enfermeira: { nome: string | null; fotoPath: string | null } | null;
  visitas: PortalVisita[];
  pesquisa: { enviada: boolean; respondida: boolean } | null;
  evolucoes: {
    ativo: boolean;
    itens: { id: string; tipo: string; enviadoEm: string | null }[];
  };
  contato: ContatoEquipePortal;
  textos: TextosPortal;
}

/** Portal em bloqueio_total ou encerrado_sensivel: só o contato de uma pessoa. */
export interface PortalFamiliaContato {
  situacao: "contato";
  primeiroNome: string;
  contato: ContatoEquipePortal;
  textos: TextosPortal;
}

export type PortalFamilia = PortalFamiliaCompleto | PortalFamiliaContato;

/** Quem entrou no portal (a conta da família, sem perfil de equipe). */
export interface PortalFamiliaRepositorio {
  /** null quando a conta não tem acesso ao portal (42501 do banco). */
  obter(): Promise<PortalFamilia | null>;
}

export type SituacaoPedidoLink =
  "ok" | "nao_encontrado" | "limite" | "indisponivel";

/**
 * Passos abertos, sem usuário logado (só o servidor, depois do Turnstile):
 * captação, link do portal e candidatura. Nenhuma devolve dado pessoal.
 */
export interface PaginaCaptacao {
  situacao: "ok" | "indisponivel";
  textos: TextosPortal;
}

export interface InicioCaptacao {
  situacao: "ok" | "indisponivel" | "limite";
  numeroE164?: string;
  codigo?: string;
  texto?: string;
  minutos?: number | null;
  textos: TextosPortal;
}

export interface AberturaCandidatura {
  situacao: "ok" | "desligada";
  termoVersao: string | null;
  textos: TextosPortal;
}

export interface DadosCandidatura {
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  conselho: string;
  apresentacao: string;
  consentimentoVersao: string;
}

export type ResultadoCandidatura =
  | { situacao: "recebido" }
  | { situacao: "desligada" }
  | { situacao: "limite"; minutos: number | null }
  | { situacao: "corrigir"; erros: Record<string, string> };

export interface RelacaoPublicaRepositorio {
  paginaCaptacao(canal: string): Promise<PaginaCaptacao>;
  iniciarCaptacao(
    canal: string,
    utm: Record<string, string>,
    origem: string | null,
  ): Promise<InicioCaptacao>;
  /** Textos da página de entrada do portal e do aviso de link vencido. */
  paginaEntradaPortal(): Promise<{ entrar: TextosPortal; link: TextosPortal }>;
  /** Passo 1 do link mágico: há acesso liberado para este e-mail? */
  localizarAcessoPortal(
    email: string,
    origem: string | null,
  ): Promise<{ situacao: SituacaoPedidoLink; minutos?: number | null }>;
  /** Passo 2, depois do link confirmado: liga a conta ao acesso. */
  vincularContaPortal(
    email: string,
    usuarioId: string,
  ): Promise<"ok" | "nao_encontrado" | "conflito">;
  abrirCandidatura(): Promise<AberturaCandidatura>;
  enviarCandidatura(
    dados: DadosCandidatura,
    origem: string | null,
  ): Promise<ResultadoCandidatura>;
}

// --- P50 · Parceiros médicos e indicações ---------------------------------------

export type EstadoParceiro = "prospeccao" | "ativo" | "pausado" | "encerrado";
export type EspecialidadeMedico = Enums<"especialidade_medico">;

export interface ParceiroMedico {
  medicoId: string;
  nome: string;
  especialidade: EspecialidadeMedico;
  hospital: string | null;
  telefoneE164: string | null;
  email: string | null;
  estado: EstadoParceiro;
  observacao: string | null;
  ultimoContatoEm: string | null;
  proximoContatoEm: string | null;
  diasSemContato: number | null;
  precisaContato: boolean;
  indicacoes: number;
  contratos: number;
  tarefasAbertas: number;
}

export interface ListaParceiros {
  /** Aviso sobre a vedação ética de contrapartida financeira. */
  aviso: string | null;
  relacionamentoDias: number | null;
  parceiros: ParceiroMedico[];
}

export interface PedidoParceiro {
  medicoId: string | null;
  nome: string;
  especialidade: EspecialidadeMedico;
  telefone: string;
  email: string;
  hospital: string;
  estado: EstadoParceiro;
  observacao: string;
  proximoContatoEm: string | null;
}

export interface PedidoIndicacao {
  familiaId: string;
  medicoId: string | null;
  familiaPromotoraId: string | null;
  observacao: string;
}

export interface LinhaIndicacaoMedico {
  medicoId: string;
  nome: string;
  especialidade: EspecialidadeMedico;
  indicacoes: number;
  qualificadas: number;
  contratos: number;
}

export interface LinhaIndicacaoPromotora {
  familiaId: string;
  nomeExibicao: string;
  indicacoes: number;
  qualificadas: number;
  contratos: number;
}

export interface RelatorioIndicacoes {
  desde: string | null;
  ate: string | null;
  total: number;
  porMedico: LinhaIndicacaoMedico[];
  porPromotora: LinhaIndicacaoPromotora[];
}

export interface ParceirosRepositorio {
  listar(): Promise<ListaParceiros>;
  salvar(pedido: PedidoParceiro): Promise<string>;
  registrarContato(
    medicoId: string,
    observacao: string,
  ): Promise<string | null>;
  criarTarefa(
    medicoId: string,
    titulo: string,
    venceEm: string | null,
  ): Promise<string>;
  registrarIndicacao(pedido: PedidoIndicacao): Promise<{ origem: OrigemLead }>;
  relatorio(filtro: FiltroPeriodo): Promise<RelatorioIndicacoes>;
}

// --- P51 · Tarefas por equipe, manuais, treinamentos e talentos ----------------

export interface EquipeTarefas {
  equipe: string;
  abertas: number;
  emAndamento: number;
  vencidas: number;
  semResponsavel: number;
  concluidas7d: number;
}

export interface PessoaTarefas {
  usuarioId: string;
  nome: string;
  equipe: string;
  abertas: number;
  vencidas: number;
}

export interface TarefaEquipe {
  id: string;
  titulo: string;
  tipo: string;
  prioridade: Enums<"prioridade">;
  status: string;
  venceEm: string | null;
  vencida: boolean;
  equipe: string;
  responsavel: string | null;
  familia: string | null;
}

export interface VisaoTarefasEquipe {
  equipes: EquipeTarefas[];
  pessoas: PessoaTarefas[];
  tarefas: TarefaEquipe[];
}

export interface TarefasEquipeRepositorio {
  visao(): Promise<VisaoTarefasEquipe>;
}

export type CategoriaManual = "manual" | "protocolo";

export interface ResumoManual {
  id: string;
  titulo: string;
  categoria: CategoriaManual;
  papeisAlvo: string[];
  ativo: boolean;
  versao: number;
  versaoId: string;
  publicadaEm: string;
  lido: boolean;
  /** Só coordenação e diretoria veem as confirmações. */
  confirmacoes: number | null;
}

export interface DetalheManual {
  id: string;
  titulo: string;
  categoria: CategoriaManual;
  papeisAlvo: string[];
  ativo: boolean;
  versao: number;
  versaoId: string;
  conteudo: string;
  publicadaEm: string;
  lido: boolean;
  historico: {
    versao: number;
    publicadaEm: string;
    resumoMudanca: string | null;
  }[];
}

export interface PedidoManual {
  manualId: string | null;
  titulo: string;
  categoria: CategoriaManual;
  papeisAlvo: string[];
  conteudo: string;
  resumoMudanca: string;
  ativo: boolean;
}

export interface LeituraManual {
  manualId: string;
  versao: number;
  pessoas: {
    usuarioId: string;
    nome: string;
    confirmou: boolean;
    confirmadaEm: string | null;
  }[];
}

export interface ItemTrilha {
  ordem: number;
  manualId: string;
  titulo: string;
  versao: number;
  versaoId: string;
  lido: boolean;
}

export interface Trilha {
  id: string;
  nome: string;
  papelAlvo: string;
  ativa: boolean;
  itens: ItemTrilha[];
  /** Coordenação e diretoria: o andamento de cada pessoa do papel-alvo. */
  equipe:
    { usuarioId: string; nome: string; feitos: number; total: number }[] | null;
}

export interface PedidoTrilha {
  trilhaId: string | null;
  nome: string;
  papelAlvo: string;
  ativa: boolean;
  manualIds: string[];
}

export interface ManuaisRepositorio {
  listar(): Promise<ResumoManual[]>;
  obter(manualId: string): Promise<DetalheManual | null>;
  salvar(
    pedido: PedidoManual,
  ): Promise<{ manualId: string; versao: number; novaVersao: boolean }>;
  confirmarLeitura(versaoId: string): Promise<void>;
  leituras(manualId: string): Promise<LeituraManual>;
  trilhas(): Promise<Trilha[]>;
  salvarTrilha(pedido: PedidoTrilha): Promise<string>;
}

export type EstadoCandidata =
  | "nova"
  | "em_triagem"
  | "entrevista_agendada"
  | "entrevistada"
  | "aprovada"
  | "banco_reserva"
  | "nao_seguiu"
  | "desistiu";

export const ESTADOS_CANDIDATA: readonly EstadoCandidata[] = [
  "nova",
  "em_triagem",
  "entrevista_agendada",
  "entrevistada",
  "aprovada",
  "banco_reserva",
  "nao_seguiu",
  "desistiu",
];

export interface PerguntaRoteiro {
  id: string;
  texto: string;
}
export interface BlocoRoteiro {
  id: string;
  nome: string;
  perguntas: PerguntaRoteiro[];
}
export interface CriterioRoteiro {
  id: string;
  nome: string;
}
export interface RoteiroTalentos {
  versao: string;
  escala: { min: number; max: number };
  blocos: BlocoRoteiro[];
  criterios: CriterioRoteiro[];
}

export interface ResumoCandidata {
  id: string;
  nome: string;
  cidade: string | null;
  origem: string;
  estado: EstadoCandidata;
  criadoEm: string;
  avaliacoes: number;
  mediaGeral: number | null;
}

export interface ListaTalentos {
  paginaPublicaAtiva: boolean;
  candidatas: ResumoCandidata[];
}

export interface AvaliacaoCandidata {
  id: string;
  avaliadorId: string;
  avaliador: string | null;
  em: string;
  roteiroVersao: string;
  respostas: Record<string, string>;
  notas: Record<string, number>;
  observacoes: string | null;
  criteriosAvaliados: number;
  media: number | null;
}

export interface DetalheCandidata {
  id: string;
  nome: string;
  telefoneE164: string | null;
  email: string | null;
  cidade: string | null;
  conselho: string | null;
  apresentacao: string | null;
  origem: string;
  estado: EstadoCandidata;
  observacoes: string | null;
  criadoEm: string;
  roteiro: RoteiroTalentos;
  avaliacoes: AvaliacaoCandidata[];
}

export interface PedidoCandidata {
  candidataId: string | null;
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  conselho: string;
  apresentacao: string;
  observacoes: string;
}

export interface PedidoAvaliacao {
  candidataId: string;
  respostas: Record<string, string>;
  notas: Record<string, number>;
  observacoes: string;
}

export interface ResultadoAvaliacao {
  avaliacaoId: string;
  criteriosAvaliados: number;
  criteriosTotal: number;
  completa: boolean;
  media: number | null;
}

export interface TalentosRepositorio {
  roteiro(): Promise<RoteiroTalentos>;
  listar(estado?: EstadoCandidata): Promise<ListaTalentos>;
  obter(candidataId: string): Promise<DetalheCandidata | null>;
  salvar(pedido: PedidoCandidata): Promise<string>;
  mudarEstado(candidataId: string, estado: EstadoCandidata): Promise<void>;
  avaliar(pedido: PedidoAvaliacao): Promise<ResultadoAvaliacao>;
}

/** Tudo do relacionamento da fase 3, com as permissões de quem está logado. */
export interface RelacaoRepositorio {
  marketing: MarketingRepositorio;
  copiloto: CopilotoRepositorio;
  acessoFamilia: AcessoFamiliaRepositorio;
  parceiros: ParceirosRepositorio;
  tarefasEquipe: TarefasEquipeRepositorio;
  manuais: ManuaisRepositorio;
  talentos: TalentosRepositorio;
}
