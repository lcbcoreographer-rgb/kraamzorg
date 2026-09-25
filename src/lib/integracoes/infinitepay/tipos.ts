/**
 * Tipos do adaptador InfinitePay Checkout (PRD 14, P32). `order_nsu` é
 * sempre o id da cobrança (`cobranca.id`); itens sempre em centavos
 * (CLAUDE.md, "Dinheiro em centavos"). O webhook não é assinado: a
 * confirmação sempre passa por `payment_check` (webhook.ts).
 *
 * [conferir] T-06 ainda não fechou entre o Plano de Cobrança (endpoint que
 * trava o parcelamento no painel) e o link simples sem repasse de taxa
 * (PRD 14, 22.1). O código usa o endpoint de links documentado
 * publicamente e valida o limite de parcelas no próprio adaptador, para o
 * aceite do P32 valer com qualquer um dos dois: "o link gerado mostra no
 * máximo 3 parcelas; se mostrar mais, o teste falha".
 */

export interface ItemCobrancaInfinitePay {
  nome: string;
  valorCentavos: number;
  quantidade: number;
}

export interface ClienteInfinitePay {
  nome: string;
  email?: string;
  /** Telefone em E.164 (CLAUDE.md). */
  telefone?: string;
  /** CPF só quando necessário para o checkout; nunca aparece em log
   * (CLAUDE.md, "CPF nunca aparece em log"). */
  cpf?: string;
}

export interface CriarLinkPagamentoEntrada {
  /** Sempre `cobranca.id` (PRD 14). */
  orderNsu: string;
  itens: ItemCobrancaInfinitePay[];
  redirectUrl: string;
  webhookUrl: string;
  cliente: ClienteInfinitePay;
  /** Vem de `pacote_versao.parcelas_max_sem_juros`; nunca acima de 3
   * (PRD 14 v4.2, T-06). Validado antes de qualquer chamada de rede. */
  parcelasMaxSemJuros: number;
}

export interface LinkPagamentoInfinitePay {
  url: string;
  slug: string;
  orderNsu: string;
  parcelasMaxSemJuros: number;
}

export interface PaymentCheckEntrada {
  orderNsu: string;
  transactionNsu?: string;
  invoiceSlug?: string;
}

export interface ResultadoPaymentCheck {
  pago: boolean;
  valorPagoCentavos?: number;
  parcelas?: number;
  metodoCaptura?: string;
  reciboUrl?: string;
}

export interface ClienteInfinitePayOpcoes {
  handle: string;
  apiKey: string;
  /** Injeção de dependência para teste (fetch interceptado). */
  fetchImpl?: typeof fetch;
  endpointBase?: string;
}
