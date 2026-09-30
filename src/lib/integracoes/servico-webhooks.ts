import "server-only";
import type { DadosLinkPagamento } from "@/lib/dados/tipos-contrato";
import type { Json } from "@/lib/db/types";
import type { Cobrador } from "./fabrica";
import { gerarLinksPendentes, type ResultadoLinks } from "./links-pagamento";

/**
 * O que os webhooks da Autentique e da InfinitePay fazem no banco, pelas
 * funções `public.contrato_*` e `public.cobranca*` da 0019 (só
 * service_role). As rotas ficam finas e este arquivo é testado com um
 * cliente de mentira, sem rede nem banco.
 *
 * Erro de banco lança (a rota responde 500 sem detalhe e o terceiro
 * reenvia). Nada aqui escreve CPF, nome ou telefone em log.
 */

export interface ClienteRpc {
  rpc(
    nome: string,
    argumentos: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}

async function chamar(
  cliente: ClienteRpc,
  funcao: string,
  argumentos: Record<string, unknown>,
): Promise<Json> {
  const { data, error } = await cliente.rpc(funcao, argumentos);
  if (error) throw new Error(`falha em ${funcao}`);
  return (data ?? null) as Json;
}

function objeto(valor: Json): Record<string, Json | undefined> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, Json | undefined>)
    : {};
}

// --- Autentique ---------------------------------------------------------------------

export async function contratoDoDocumento(
  cliente: ClienteRpc,
  documentoId: string,
): Promise<{ id: string; status: string } | null> {
  const r = objeto(
    await chamar(cliente, "contrato_do_documento", {
      p_documento_id: documentoId,
    }),
  );
  return typeof r.id === "string"
    ? { id: r.id, status: String(r.status ?? "") }
    : null;
}

/** Devolve se o contrato mudou de estado (falso para documento repetido). */
export async function registrarAssinatura(
  cliente: ClienteRpc,
  documentoId: string,
  pdfPath: string | null,
): Promise<boolean> {
  const r = objeto(
    await chamar(cliente, "contrato_registrar_assinatura", {
      p_documento_id: documentoId,
      p_pdf_path: pdfPath,
    }),
  );
  return r.mudou === true;
}

// --- Link de pagamento -----------------------------------------------------------------

function textoOuNulo(v: Json | undefined): string | null {
  return typeof v === "string" ? v : null;
}

export function dadosLinkDoServico(valor: Json): DadosLinkPagamento {
  const x = objeto(valor);
  const c = objeto(x.cliente ?? null);
  const numero = (v: Json | undefined) => (typeof v === "number" ? v : 0);
  return {
    cobrancaId: String(x.cobranca_id),
    contratoId: String(x.contrato_id),
    familiaId: String(x.familia_id),
    valorCentavos: numero(x.valor_centavos),
    parcelas: numero(x.parcelas) || 1,
    parcelasMax: numero(x.parcelas_max) || 1,
    acimaDoLimite: x.acima_do_limite === true,
    descricao: textoOuNulo(x.descricao) ?? "",
    cliente: {
      nome: String(c.nome ?? ""),
      email: textoOuNulo(c.email),
      telefone: textoOuNulo(c.telefone),
    },
  };
}

/**
 * Cobranças abertas do contrato sem link: pede o link de cada uma à
 * InfinitePay e guarda no banco. Vale para o webhook da Autentique (logo
 * depois da assinatura) e para a repetição dele.
 */
export async function gerarLinksDoContrato(
  cliente: ClienteRpc,
  contratoId: string,
  obterCobrador: () => Cobrador,
): Promise<ResultadoLinks> {
  const bruto = await chamar(cliente, "cobrancas_sem_link", {
    p_contrato_id: contratoId,
  });
  const pendentes = (Array.isArray(bruto) ? bruto : []).map(dadosLinkDoServico);
  if (pendentes.length === 0) {
    return { criados: [], acimaDoLimite: [], falhas: [] };
  }
  let cobrador: Cobrador | null = null;
  try {
    cobrador = obterCobrador();
  } catch {
    cobrador = null;
  }
  return gerarLinksPendentes(pendentes, {
    criarLink: async (dados) => {
      if (!cobrador) throw new Error("InfinitePay sem credencial");
      return cobrador.criarLink(dados);
    },
    registrar: async (cobrancaId, url, slug) => {
      await chamar(cliente, "cobranca_registrar_link", {
        p_cobranca_id: cobrancaId,
        p_url: url,
        p_slug: slug,
      });
    },
    avisarFalha: async (cobrancaId, motivo) => {
      await chamar(cliente, "cobranca_avisar_falha_link", {
        p_cobranca_id: cobrancaId,
        p_motivo: motivo,
      });
    },
  });
}

// --- InfinitePay ---------------------------------------------------------------------------

export async function cobrancaDoPedido(
  cliente: ClienteRpc,
  orderNsu: string,
): Promise<{ id: string; status: string; valor_centavos: number } | null> {
  const r = objeto(
    await chamar(cliente, "cobranca_do_pedido", { p_order_nsu: orderNsu }),
  );
  return typeof r.id === "string"
    ? {
        id: r.id,
        status: String(r.status ?? ""),
        valor_centavos:
          typeof r.valor_centavos === "number" ? r.valor_centavos : 0,
      }
    : null;
}

export interface DadosBaixa {
  valorPagoCentavos: number;
  parcelas: number | null;
  metodoCaptura: string | null;
  transactionNsu: string | null;
  invoiceSlug: string | null;
  reciboUrl: string | null;
}

/** Devolve se a cobrança mudou para paga (falso para baixa repetida). */
export async function baixarCobranca(
  cliente: ClienteRpc,
  orderNsu: string,
  dados: DadosBaixa,
): Promise<boolean> {
  const r = objeto(
    await chamar(cliente, "cobranca_baixar", {
      p_order_nsu: orderNsu,
      p_valor_pago: dados.valorPagoCentavos,
      p_parcelas: dados.parcelas,
      p_metodo: dados.metodoCaptura,
      p_transaction_nsu: dados.transactionNsu,
      p_invoice_slug: dados.invoiceSlug,
      p_recibo_url: dados.reciboUrl,
    }),
  );
  return r.mudou === true;
}
