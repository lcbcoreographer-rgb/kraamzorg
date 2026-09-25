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
  /** Discriminação do serviço, lida do mesmo cadastro que o código (P43
   * item 2: "cuidado domiciliar pós-parto"). Texto nunca fica no código
   * (CLAUDE.md); a chave em `parametro` é pendência da trilha do banco. */
  descricaoServico: string;
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
  /** Quantas requisições o adaptador fez nesta chamada (novas tentativas do
   * P43 item 3). */
  tentativas: number;
}

/**
 * Interface do adaptador para o padrão nacional de NFS-e (P43 item 1).
 * Toda implementação: usa o tomador como quem paga, o código e a descrição
 * do serviço vindos do cadastro (nunca escritos no código), expõe os cinco
 * estados de `status_nota`, tenta de novo só em falha transitória e manda a
 * mesma chave de idempotência (id da cobrança) em toda tentativa, para uma
 * nova tentativa nunca emitir nota duplicada.
 */
export interface AdaptadorNfse {
  emitir(entrada: EmissaoNfseEntrada): Promise<ResultadoNfse>;
  consultar(providerRef: string): Promise<ResultadoNfse>;
  cancelar(providerRef: string, motivo: string): Promise<ResultadoNfse>;
}
