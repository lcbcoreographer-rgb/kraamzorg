import type { ContaProposta, EnderecoFormulario } from "./tipos-venda";
import type { EstadoSensivel, EstagioP2 } from "./tipos";

/**
 * Tipos do contrato e da cobrança (P31 e P32), no mesmo padrão de
 * tipos-venda.ts: camelCase na tela, datas em texto ISO, dinheiro em
 * centavos. As funções do banco estão em 0019_contrato_cobranca.sql.
 */

// --- Contrato (P31) ---------------------------------------------------------------

export type EtapaContrato =
  | "sem_proposta"
  | "sem_formulario"
  | "aguardando_dados"
  | "formulario_vencido"
  | "pronto_para_gerar"
  | "gerado"
  | "envio_em_andamento"
  | "aguardando_assinatura"
  | "assinado"
  | "cancelado"
  | "distrato";

export type VarianteContrato = "completa" | "presente";

export type PapelAssinante = "gestante" | "kraamzorg" | "testemunha";

export interface Assinante {
  papel: PapelAssinante;
  nome: string | null;
  /** E-mail já mascarado pelo banco ("m***@exemplo.com"). */
  email: string | null;
  temContato: boolean;
}

/** Cobrança como o comercial vê (PRD 13, parcial: só o status). */
export interface CobrancaDoContrato {
  id: string | null;
  parcela: number;
  vencimento: string;
  status: "aberta" | "paga" | "vencida" | "cancelada" | "estornada";
  pagoEm: string | null;
  /** Só financeiro e diretoria. */
  valorCentavos: number | null;
  temLink: boolean | null;
}

export interface SituacaoContrato {
  familia: {
    id: string;
    nome: string;
    estadoSensivel: EstadoSensivel;
    naoContatar: boolean;
  };
  oportunidade: {
    id: string;
    estagioP2: EstagioP2 | null;
    paraQuem: string | null;
  } | null;
  contrato: {
    id: string;
    status: string;
    etapa: EtapaContrato;
    templateVersao: string;
    variante: VarianteContrato;
    conta: ContaProposta | null;
    pdfGerado: boolean;
    formularioRecebidoEm: string | null;
    enviadoEm: string | null;
    assinadoEm: string | null;
  } | null;
  assinantes: Assinante[];
  modelo: { versao: string | null; aprovado: boolean };
  cobrancas: CobrancaDoContrato[];
  podeGerar: boolean;
  podeEnviar: boolean;
  podeVerCobranca: boolean;
  sensivel: boolean;
}

/** Cláusula do modelo de contrato (parametro.contrato_modelo). */
export interface ClausulaModelo {
  titulo: string;
  texto: string;
  comFrentes?: boolean;
  valores?: boolean;
  somentePresente?: boolean;
}

export interface ModeloContrato {
  versao: string;
  aprovado: boolean;
  titulo: string;
  avisoRascunho: string | null;
  profissional: string;
  partes: {
    contratada: string;
    contratante: string;
    pagador: string;
    testemunha: string;
  };
  frentes: string[];
  valores: {
    pacote: string;
    desconto: string;
    taxa: string;
    total: string;
    forma: string;
    formaUmaVez: string;
    formaParcelada: string;
  };
  clausulas: ClausulaModelo[];
  assinaturas: string;
}

export interface DadosKraamzorgContrato {
  signatarioNome: string;
  signatarioEmail: string;
  razaoSocial: string;
  documento: string;
  endereco: string;
}

export interface PessoaDoContrato {
  nome: string;
  email: string | null;
  cpf: string;
  endereco: EnderecoFormulario;
  dataNascimento?: string | null;
}

/** Tudo o que o PDF imprime (api.dados_para_contrato). Contém CPF: só no servidor. */
export interface DadosParaContrato {
  contrato: {
    id: string;
    variante: VarianteContrato;
    conta: ContaProposta;
    parcelasMaxSemJuros: number;
  };
  pacote: {
    nome: string;
    linha: string | null;
    dias: number;
    gemelar: boolean;
    horasPorVisita: number;
  };
  familia: { id: string; enderecoAtendimento: EnderecoFormulario | null };
  contratante: PessoaDoContrato & { dataNascimento: string };
  pagador: PessoaDoContrato | null;
  testemunha: { nome: string; email: string | null } | null;
  modelo: ModeloContrato;
  kraamzorg: DadosKraamzorgContrato;
}

export interface ReservaEnvioContrato {
  contratoId: string;
  pdfPath: string;
  nomeDocumento: string;
  modeloVersao: string | null;
  modeloAprovado: boolean;
  gestante: { nome: string; email: string | null; telefone: string | null };
  testemunha: {
    nome: string;
    email: string | null;
    telefone: string | null;
  } | null;
  kraamzorg: { nome: string; email: string };
}

// --- Cobrança (P32) -----------------------------------------------------------------

export type SituacaoCobranca =
  "aberta" | "vencida" | "paga" | "cancelada" | "estornada";

export interface LinhaCobranca {
  id: string;
  contratoId: string;
  familiaId: string;
  familiaNome: string;
  parcela: number;
  valorCentavos: number;
  vencimento: string;
  situacao: SituacaoCobranca;
  pagoEm: string | null;
  valorPagoCentavos: number | null;
  metodo: string | null;
  parcelasCartao: number | null;
  temLink: boolean;
  notaStatus: string | null;
}

export interface ResumoCobrancas {
  abertas: number;
  vencidas: number;
  pagas: number;
  aReceberCentavos: number;
  recebidoCentavos: number;
}

export interface ListaCobrancas {
  resumo: ResumoCobrancas;
  cobrancas: LinhaCobranca[];
}

export interface CobrancaDetalhe {
  id: string;
  contratoId: string;
  contratoStatus: string;
  familiaId: string;
  familiaNome: string;
  pagadorNome: string | null;
  parcela: number;
  valorCentavos: number;
  vencimento: string;
  situacao: SituacaoCobranca;
  pagoEm: string | null;
  valorPagoCentavos: number | null;
  metodo: string | null;
  parcelasCartao: number | null;
  parcelasContrato: number;
  parcelasMax: number | null;
  acimaDoLimite: boolean;
  linkPagamento: string | null;
  /** "arquivo" (baixa manual, no storage), "recibo" (InfinitePay) ou nulo. */
  comprovante: "arquivo" | "recibo" | null;
  reciboUrl: string | null;
  /** Caminho do comprovante da baixa manual no armazenamento privado. */
  comprovantePath: string | null;
  nota: { status: string; numero: string | null } | null;
  podeGerarLink: boolean;
  podeBaixarManual: boolean;
  /** Tamanho máximo do comprovante da baixa manual (parametro.cobranca). */
  comprovanteMaxBytes: number | null;
}

/** O que o servidor precisa para pedir o link à InfinitePay. Sem CPF. */
export interface DadosLinkPagamento {
  cobrancaId: string;
  contratoId: string;
  familiaId: string;
  valorCentavos: number;
  parcelas: number;
  parcelasMax: number;
  acimaDoLimite: boolean;
  descricao: string;
  cliente: { nome: string; email: string | null; telefone: string | null };
}

export interface PedidoBaixaManual {
  cobrancaId: string;
  valorPagoCentavos: number;
  comprovantePath: string;
  motivo: string;
}
