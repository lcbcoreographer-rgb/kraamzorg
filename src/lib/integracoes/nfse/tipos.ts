/**
 * Tipos do adaptador de NFS-e (PRD 14, P43). Interface pensada para o
 * padrão nacional (Emissor Nacional / ADN), provedor-agnóstica: qualquer
 * implementação (`emissor-nacional.ts` ou outra, quando o provedor real for
 * escolhido pela contadora, T-05) segue este mesmo contrato.
 */

/** Espelha o enum `status_nota` do banco (0003_comercial_conversa.sql),
 * sem repetir a definição: a implementação nunca inventa um estado novo. */
export type EstadoNotaFiscal =
  "pendente" | "processando" | "emitida" | "erro" | "cancelada";

export interface EnderecoTomador {
  logradouro: string;
  numero: string;
  bairro: string;
  /** Código IBGE do município, exigido pelo padrão nacional. */
  municipioCodigoIbge: string;
  uf: string;
  cep: string;
}

/** Tomador é quem paga (PRD 4, C-10), nunca necessariamente a gestante
 * (contrato de presente: quem presenteia é o tomador). */
export interface TomadorNfse {
  nome: string;
  cpfCnpj: string;
  email?: string;
  endereco?: EnderecoTomador;
}

export interface EmissaoNfseEntrada {
  /** `cobranca.id`: liga a nota à cobrança confirmada (P43, "disparada
   * pelo pagamento confirmado"). */
  cobrancaId: string;
  tomador: TomadorNfse;
  valorCentavos: number;
  /** Sempre lido do cadastro de serviço (parâmetro), nunca escrito fixo por
   * quem chama o adaptador (P43 item 2, "código de serviço do cadastro";
   * CLAUDE.md, "nenhum... valor... no código"). */
  codigoServico: string;
}

export interface ResultadoNfse {
  estado: EstadoNotaFiscal;
  /** Referência do provedor (`nota_fiscal.provider_ref`), presente a partir
   * do envio, mesmo antes de emitida. */
  providerRef?: string;
  numero?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  erro?: string;
  /** Quantas tentativas de envio o adaptador fez nesta chamada (novas
   * tentativas do P43 item 3). */
  tentativas: number;
}

/**
 * Interface do adaptador para o padrão nacional de NFS-e (P43 item 1).
 * Toda implementação: usa o tomador como quem paga, a descrição fixa de
 * cuidado domiciliar pós-parto, o código de serviço do cadastro (nunca
 * inventado), expõe os cinco estados de `status_nota` e tenta de novo
 * transitoriamente antes de devolver erro.
 */
export interface AdaptadorNfse {
  emitir(entrada: EmissaoNfseEntrada): Promise<ResultadoNfse>;
  consultar(providerRef: string): Promise<ResultadoNfse>;
  cancelar(providerRef: string, motivo: string): Promise<ResultadoNfse>;
}
