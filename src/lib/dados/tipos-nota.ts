/**
 * Tipos da nota fiscal de serviço (P43, PRD 14, 6.3). Vêm das funções
 * `api.notas_fiscais`, `api.nota_fiscal` e afins (migration 0024). O estado
 * espelha o enum `status_nota` do banco.
 */

export type EstadoNota =
  "pendente" | "processando" | "emitida" | "erro" | "cancelada";

export interface NotaResumo {
  id: string;
  cobrancaId: string;
  contratoId: string;
  familiaId: string;
  familiaNome: string;
  /** Quem paga é o tomador da nota (C-10): pode não ser a gestante. */
  tomadorNome: string | null;
  parcela: number;
  valorCentavos: number;
  pagoEm: string | null;
  status: EstadoNota;
  numero: string | null;
  provider: string | null;
  erro: string | null;
  tentativas: number;
  manual: boolean;
  temPdf: boolean;
  temXml: boolean;
  emitidaEm: string | null;
  criadoEm: string;
}

export interface ListaNotas {
  resumo: {
    pendentes: number;
    processando: number;
    emitidas: number;
    comErro: number;
    canceladas: number;
  };
  notas: NotaResumo[];
  emissaoAutomatica: boolean;
}

export interface NotaDetalhe {
  id: string;
  cobrancaId: string;
  contratoId: string;
  familiaId: string;
  familiaNome: string;
  tomadorNome: string | null;
  tomadorTemCpf: boolean;
  parcela: number;
  valorCentavos: number;
  pagoEm: string | null;
  cobrancaSituacao: string;
  status: EstadoNota;
  numero: string | null;
  provider: string | null;
  providerRef: string | null;
  erro: string | null;
  tentativas: number;
  manual: boolean;
  temPdf: boolean;
  temXml: boolean;
  emitidaEm: string | null;
  criadoEm: string;
  versao: number;
  codigoServico: string | null;
  descricaoServico: string | null;
  emissaoAutomatica: boolean;
  podeEmitir: boolean;
  podeConsultar: boolean;
}

/** Tudo o que a emissão pede, com o CPF completo de quem paga (lido com log no banco). */
export interface DadosEmissaoNota {
  notaId: string;
  cobrancaId: string;
  familiaId: string;
  status: EstadoNota;
  valorCentavos: number;
  codigoServico: string;
  descricaoServico: string;
  tomador: {
    nome: string;
    cpf: string;
    email: string | null;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      cep: string;
      uf: string;
      municipioCodigoIbge: string;
    } | null;
  };
}

export interface ResultadoNotaRegistro {
  estado: "emitida" | "erro" | "processando";
  providerRef?: string | null;
  numero?: string | null;
  pdfPath?: string | null;
  xmlPath?: string | null;
  erro?: string | null;
}

export interface PedidoNotaManual {
  notaId: string;
  numero: string;
  /** Data da nota no portal do provedor (aaaa-mm-dd). */
  emitidaEm: string;
  provider?: string | null;
  pdfPath?: string | null;
  xmlPath?: string | null;
}

export interface NotaRepositorio {
  listar(situacao?: EstadoNota): Promise<ListaNotas>;
  obter(notaId: string): Promise<NotaDetalhe>;
  dadosEmissao(notaId: string): Promise<DadosEmissaoNota>;
  iniciarEmissao(notaId: string): Promise<void>;
  registrarResultado(
    notaId: string,
    resultado: ResultadoNotaRegistro,
  ): Promise<{ status: EstadoNota; mudou: boolean }>;
  registrarManual(pedido: PedidoNotaManual): Promise<void>;
  /** Caminho do PDF ou do XML no storage privado. */
  caminhoArquivo(notaId: string, tipo: "pdf" | "xml"): Promise<string>;
}
