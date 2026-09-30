/**
 * Tipos da evolução de enfermagem aos médicos (P41): a lista de
 * acompanhamentos com o prazo, a base para montar os documentos, o documento
 * salvo e o que o servidor precisa para enviar por e-mail. Vêm das funções
 * `api.evolucoes`, `api.base_evolucao`, `api.evolucao` e afins (migration
 * 0024). Nada aqui cria campo clínico: os campos da evolução são os de
 * `src/lib/pdf/tipos.ts` (PRD 9.5).
 */

export type TipoEvolucao = "puerperal" | "neonatal";

export type StatusEvolucao =
  "rascunho" | "em_revisao" | "aprovado" | "enviado" | "erro_envio";

/** Situação de um acompanhamento na lista, pelo prazo do PRD 9.5 (D+1 aviso, D+2 escalada). */
export type SituacaoEvolucao =
  "no_prazo" | "aviso" | "escalada" | "em_andamento" | "concluida";

export interface DocumentoDaLista {
  tipo: TipoEvolucao;
  bebeId: string | null;
  /** Ordem do bebê na família (1 e 2 em gemelares); 0 no puerperal. */
  bebeOrdem: number;
  bebeNome: string | null;
  /** Nulo enquanto o rascunho ainda não foi criado. */
  relatorioId: string | null;
  status: StatusEvolucao | null;
  enviadoEm: string | null;
  comErros: boolean;
}

export interface AcompanhamentoEvolucao {
  acompanhamentoId: string;
  familiaId: string;
  familiaNome: string;
  /** Data (aaaa-mm-dd) da visita do último dia contratado. */
  concluidoEm: string;
  prazoAviso: string;
  prazoEscala: string;
  situacao: SituacaoEvolucao;
  /** Nenhum médico da família com telefone ou e-mail (PRD 7.3): a evolução fica bloqueada. */
  bloqueadoContato: boolean;
  profissionalNome: string | null;
  documentos: DocumentoDaLista[];
}

export interface ListaEvolucoes {
  hoje: string;
  acompanhamentos: AcompanhamentoEvolucao[];
}

// --- Base para montar os documentos --------------------------------------------------------

export interface VisitaDaBase {
  visitaId: string;
  diaNumero: number;
  data: string;
  profissionalId: string;
  /** `registro_atendimento.dados`: um objeto por bloco do DOC 2, bloco do RN como lista. */
  dados: Record<string, unknown>;
}

export interface BebeDaBase {
  id: string;
  ordem: number;
  nome: string | null;
  sexo: "feminino" | "masculino" | "nao_informado" | null;
  tipoParto: "vaginal" | "cesarea" | "nao_informado" | null;
  dataNascimento: string | null;
  pesoNascimentoG: number | null;
  pesoAltaG: number | null;
}

export interface MedicoDaBase {
  id: string;
  especialidade: "obstetra" | "pediatra" | "outro";
  nome: string;
  temEmail: boolean;
  /** E-mail com a primeira letra e o domínio ("h***@exemplo.com"); o completo só chega no envio. */
  emailMascarado: string | null;
  temContato: boolean;
}

export interface ProfissionalDaBase {
  id: string;
  nome: string;
  funcao: string;
  conselho: string | null;
  conselhoUf: string | null;
  conselhoNumero: string | null;
}

export interface DocumentoExistente {
  id: string;
  tipo: TipoEvolucao;
  bebeId: string | null;
  status: StatusEvolucao;
  versao: number;
  enviadoEm: string | null;
}

export interface BaseEvolucao {
  acompanhamento: {
    id: string;
    familiaId: string;
    estado: string;
    diasContratados: number;
    inicio: string | null;
    fim: string | null;
    concluidoEm: string | null;
    dataAlta: string | null;
    dataNascimento: string | null;
  };
  hoje: string;
  familiaNome: string;
  paciente: { nome: string; idade: number | null } | null;
  filiacao: string[];
  bebes: BebeDaBase[];
  medicos: MedicoDaBase[];
  profissional: ProfissionalDaBase | null;
  /** Função da profissional (`enfermeira_obstetrica`) para o texto da assinatura (`parametro.profissional_funcoes`). */
  funcoes: Record<string, string>;
  visitas: VisitaDaBase[];
  relatorios: DocumentoExistente[];
  /** Textos padrão `evo_*` de `mensagem_modelo` (destinatário médico). */
  textos: Record<string, string>;
  /** Rótulos dos campos de orientação (blocos 4 e 5 do DOC 2 vigente), por "bloco.campo". */
  orientacoesRotulos: Record<string, string>;
}

// --- Documento salvo -------------------------------------------------------------------------

export interface EvolucaoDetalhe {
  id: string;
  acompanhamentoId: string;
  familiaId: string;
  familiaNome: string;
  tipo: TipoEvolucao;
  bebeId: string | null;
  bebeOrdem: number | null;
  bebeNome: string | null;
  status: StatusEvolucao;
  versao: number;
  /** `{ dados, conteudo }`: a entrada validada do gerador e as seções montadas (nulas enquanto há erro). */
  conteudo: ConteudoSalvo;
  errosValidacao: string[];
  notaRevisao: string | null;
  profissionalId: string;
  profissionalNome: string | null;
  aprovadoEm: string | null;
  enviadoEm: string | null;
  erroEnvio: string | null;
  temPdf: boolean;
  podeEditar: boolean;
  podeEnviarRevisao: boolean;
  podeAprovar: boolean;
  podeReenviar: boolean;
}

export interface ConteudoSalvo {
  dados: Record<string, unknown>;
  conteudo: Record<string, unknown> | null;
}

export interface PedidoSalvarEvolucao {
  acompanhamentoId: string;
  tipo: TipoEvolucao;
  bebeId: string | null;
  conteudo: ConteudoSalvo;
  erros: string[];
  versaoBase?: number | null;
}

export interface ResultadoSalvarEvolucao {
  id: string;
  versao: number;
  status: StatusEvolucao;
  criado: boolean;
}

export interface DestinatarioEnvio {
  medicoId: string;
  especialidade: "obstetra" | "pediatra" | "outro";
  nome: string;
  email: string;
}

export interface DadosEnvioEvolucao {
  relatorioId: string;
  tipo: TipoEvolucao;
  status: StatusEvolucao;
  conteudo: ConteudoSalvo;
  destinatarios: DestinatarioEnvio[];
  /** Nomes que o assunto e o nome do anexo nunca podem ter. */
  nomesProibidos: string[];
  config: { tratamento?: string; coordenacao?: string; contato?: string };
  textos: { assunto: string | null; corpo: string | null };
}

export interface PedidoRegistroEnvio {
  relatorioId: string;
  pdfPath: string | null;
  enviados: { especialidade: string; medicoId: string; enviadoEm: string }[];
  erro?: string | null;
}

export interface EvolucaoRepositorio {
  listar(situacao: "abertas" | "todas"): Promise<ListaEvolucoes>;
  base(acompanhamentoId: string): Promise<BaseEvolucao>;
  obter(relatorioId: string): Promise<EvolucaoDetalhe>;
  salvar(pedido: PedidoSalvarEvolucao): Promise<ResultadoSalvarEvolucao>;
  enviarParaRevisao(
    relatorioId: string,
    versaoBase: number | null,
  ): Promise<void>;
  devolver(relatorioId: string, motivo: string): Promise<void>;
  aprovar(relatorioId: string, versaoBase: number | null): Promise<void>;
  dadosEnvio(relatorioId: string): Promise<DadosEnvioEvolucao>;
  registrarEnvio(pedido: PedidoRegistroEnvio): Promise<void>;
  /** Caminho do PDF no storage privado (evolucoes/<id>.pdf). */
  caminhoPdf(relatorioId: string): Promise<string>;
}
